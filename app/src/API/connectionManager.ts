// WebSocket接続管理のための高度なモジュール

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  lastConnected?: Date;
  lastDisconnected?: Date;
  reconnectAttempts: number;
  latency: number;
  errorMessage?: string;
}

export interface ReconnectConfig {
  enabled: boolean;
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface HeartbeatConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  maxMissedBeats: number;
}

export interface ConnectionManagerConfig {
  url: string;
  protocols?: string[];
  reconnect: ReconnectConfig;
  heartbeat: HeartbeatConfig;
  connectionTimeout: number;
  messageTimeout: number;
}

export type ConnectionEventType = 
  | 'connecting' 
  | 'connected' 
  | 'disconnected' 
  | 'reconnecting' 
  | 'error' 
  | 'message'
  | 'latencyUpdate';

export type ConnectionEventCallback<T = any> = (data: T) => void;

export class WebSocketConnectionManager {
  private ws: WebSocket | null = null;
  private config: ConnectionManagerConfig;
  private state: ConnectionState;
  private eventListeners = new Map<ConnectionEventType, ConnectionEventCallback[]>();
  
  // タイマー管理
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private connectionTimeoutTimer: number | null = null;
  private pingTimeoutTimer: number | null = null;
  
  // ハートビート管理
  private lastPingTime: number = 0;
  private missedHeartbeats: number = 0;
  private isWaitingForPong: boolean = false;
  
  // 接続管理
  private connectionPromise: Promise<void> | null = null;
  private isIntentionalDisconnect: boolean = false;

  constructor(config: Partial<ConnectionManagerConfig> & { url: string }) {
    this.config = {
      url: config.url,
      protocols: config.protocols,
      connectionTimeout: config.connectionTimeout || 10000,
      messageTimeout: config.messageTimeout || 30000,
      reconnect: {
        enabled: true,
        maxAttempts: 10,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 1.5,
        jitter: true,
        ...config.reconnect
      },
      heartbeat: {
        enabled: true,
        interval: 30000,
        timeout: 10000,
        maxMissedBeats: 3,
        ...config.heartbeat
      }
    };

    this.state = {
      status: 'disconnected',
      reconnectAttempts: 0,
      latency: 0
    };
  }

  // 接続開始
  public async connect(): Promise<void> {
    if (this.state.status === 'connected') {
      console.log('🔗 Already connected');
      return;
    }

    if (this.state.status === 'connecting' && this.connectionPromise) {
      console.log('🔄 Connection already in progress, waiting...');
      return this.connectionPromise;
    }

    this.isIntentionalDisconnect = false;
    this.connectionPromise = this.performConnection();
    return this.connectionPromise;
  }

  // 実際の接続処理
  private async performConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.updateState({ status: 'connecting' });
        this.emit('connecting', { attempt: this.state.reconnectAttempts + 1 });

        // 接続タイムアウトタイマー設定
        this.connectionTimeoutTimer = window.setTimeout(() => {
          this.cleanup();
          this.updateState({ 
            status: 'error', 
            errorMessage: 'Connection timeout' 
          });
          reject(new Error('Connection timeout'));
        }, this.config.connectionTimeout);

        // WebSocket作成
        this.ws = new WebSocket(this.config.url, this.config.protocols);

        // イベントハンドラー設定
        this.ws.onopen = () => {
          this.clearTimer('connectionTimeout');
          this.updateState({ 
            status: 'connected',
            lastConnected: new Date(),
            reconnectAttempts: 0,
            errorMessage: undefined
          });
          
          console.log('✅ WebSocket connected');
          this.emit('connected', { url: this.config.url });
          
          // ハートビート開始
          if (this.config.heartbeat.enabled) {
            this.startHeartbeat();
          }
          
          this.connectionPromise = null;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          this.handleClose(event);
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.cleanup();
          this.updateState({ 
            status: 'error', 
            errorMessage: 'WebSocket error occurred' 
          });
          this.emit('error', { error, code: 'WEBSOCKET_ERROR' });
          
          if (this.connectionPromise) {
            this.connectionPromise = null;
            reject(new Error('WebSocket error'));
          }
        };

      } catch (error) {
        this.cleanup();
        this.updateState({ 
          status: 'error', 
          errorMessage: error instanceof Error ? error.message : 'Unknown error' 
        });
        this.connectionPromise = null;
        reject(error);
      }
    });
  }

  // メッセージハンドリング
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // pongメッセージの処理
      if (message.type === 'pong') {
        this.handlePong(message.timestamp);
        return;
      }

      // pingメッセージの処理（サーバーからのping）
      if (message.type === 'ping') {
        this.sendPong(message.timestamp);
        return;
      }

      // 通常のメッセージを転送
      this.emit('message', message);

    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
      this.emit('error', { error, code: 'MESSAGE_PARSE_ERROR' });
    }
  }

  // 切断処理
  private handleClose(event: CloseEvent): void {
    console.log(`📡 WebSocket closed: ${event.code} - ${event.reason || 'No reason'}`);
    
    this.cleanup();
    this.updateState({ 
      status: 'disconnected',
      lastDisconnected: new Date(),
      errorMessage: event.reason || undefined
    });

    this.emit('disconnected', { 
      code: event.code, 
      reason: event.reason,
      wasClean: event.wasClean 
    });

    // 自動再接続
    if (!this.isIntentionalDisconnect && this.config.reconnect.enabled) {
      this.scheduleReconnect();
    }

    this.connectionPromise = null;
  }

  // 切断
  public disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    this.isIntentionalDisconnect = true;
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
    }
    
    this.cleanup();
    this.updateState({ status: 'disconnected' });
  }

  // メッセージ送信
  public send(data: any): boolean {
    if (!this.ws || this.state.status !== 'connected') {
      console.warn('⚠️  Cannot send message: WebSocket not connected');
      return false;
    }

    try {
      const messageStr = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(messageStr);
      return true;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      this.emit('error', { error, code: 'SEND_ERROR' });
      return false;
    }
  }

  // 再接続スケジュール
  private scheduleReconnect(): void {
    if (this.state.reconnectAttempts >= this.config.reconnect.maxAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.updateState({ 
        status: 'error', 
        errorMessage: 'Max reconnection attempts reached' 
      });
      this.emit('error', { code: 'MAX_RECONNECT_ATTEMPTS' });
      return;
    }

    const delay = this.calculateReconnectDelay();
    this.state.reconnectAttempts++;
    
    console.log(`🔄 Scheduling reconnection in ${delay}ms (attempt ${this.state.reconnectAttempts}/${this.config.reconnect.maxAttempts})`);
    
    this.updateState({ status: 'reconnecting' });
    this.emit('reconnecting', { 
      attempt: this.state.reconnectAttempts, 
      delay,
      maxAttempts: this.config.reconnect.maxAttempts 
    });

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(error => {
        console.error('❌ Reconnection failed:', error);
      });
    }, delay);
  }

  // 再接続遅延計算
  private calculateReconnectDelay(): number {
    const { initialDelay, maxDelay, backoffMultiplier, jitter } = this.config.reconnect;
    
    let delay = initialDelay * Math.pow(backoffMultiplier, this.state.reconnectAttempts - 1);
    delay = Math.min(delay, maxDelay);
    
    // ジッターを追加
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  // ハートビート開始
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return;
    }

    console.log(`💓 Starting heartbeat (interval: ${this.config.heartbeat.interval}ms)`);
    
    this.heartbeatTimer = window.setInterval(() => {
      if (this.isWaitingForPong) {
        this.missedHeartbeats++;
        console.warn(`⚠️  Missed heartbeat ${this.missedHeartbeats}/${this.config.heartbeat.maxMissedBeats}`);
        
        if (this.missedHeartbeats >= this.config.heartbeat.maxMissedBeats) {
          console.error('❌ Too many missed heartbeats, reconnecting...');
          this.ws?.close(1006, 'Heartbeat timeout');
          return;
        }
      }

      this.sendPing();
    }, this.config.heartbeat.interval);
  }

  // ハートビート停止
  private stopHeartbeat(): void {
    this.clearTimer('heartbeat');
    this.clearTimer('pingTimeout');
    this.isWaitingForPong = false;
    this.missedHeartbeats = 0;
  }

  // Ping送信
  private sendPing(): void {
    if (!this.send({ type: 'ping', timestamp: Date.now() })) {
      return;
    }

    this.lastPingTime = Date.now();
    this.isWaitingForPong = true;
    
    // pingタイムアウト設定
    this.pingTimeoutTimer = window.setTimeout(() => {
      if (this.isWaitingForPong) {
        console.warn('⚠️  Ping timeout');
        this.missedHeartbeats++;
      }
    }, this.config.heartbeat.timeout);
  }

  // Pong受信処理
  private handlePong(timestamp?: number): void {
    this.isWaitingForPong = false;
    this.missedHeartbeats = 0;
    this.clearTimer('pingTimeout');
    
    // レイテンシ計算
    const now = Date.now();
    let latency = 0;
    
    if (timestamp) {
      latency = now - timestamp;
    } else if (this.lastPingTime) {
      latency = now - this.lastPingTime;
    }
    
    this.updateState({ latency });
    this.emit('latencyUpdate', { latency });
    
    console.log(`🏓 Pong received (latency: ${latency}ms)`);
  }

  // Pong送信
  private sendPong(timestamp?: number): void {
    this.send({ 
      type: 'pong', 
      timestamp: timestamp || Date.now() 
    });
  }

  // イベントリスナー管理
  public on<T = any>(event: ConnectionEventType, callback: ConnectionEventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: ConnectionEventType, callback?: ConnectionEventCallback): void {
    if (!this.eventListeners.has(event)) {
      return;
    }

    if (callback) {
      const callbacks = this.eventListeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  // イベント発火
  private emit(event: ConnectionEventType, data?: any): void {
    const callbacks = this.eventListeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  // 状態更新
  private updateState(updates: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...updates };
  }

  // タイマークリア
  private clearTimer(timer: 'reconnect' | 'heartbeat' | 'connectionTimeout' | 'pingTimeout'): void {
    switch (timer) {
      case 'reconnect':
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        break;
      case 'heartbeat':
        if (this.heartbeatTimer) {
          clearInterval(this.heartbeatTimer);
          this.heartbeatTimer = null;
        }
        break;
      case 'connectionTimeout':
        if (this.connectionTimeoutTimer) {
          clearTimeout(this.connectionTimeoutTimer);
          this.connectionTimeoutTimer = null;
        }
        break;
      case 'pingTimeout':
        if (this.pingTimeoutTimer) {
          clearTimeout(this.pingTimeoutTimer);
          this.pingTimeoutTimer = null;
        }
        break;
    }
  }

  // クリーンアップ
  private cleanup(): void {
    this.stopHeartbeat();
    this.clearTimer('reconnect');
    this.clearTimer('connectionTimeout');
    
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws = null;
    }
  }

  // ゲッター
  public getState(): ConnectionState {
    return { ...this.state };
  }

  public getConfig(): ConnectionManagerConfig {
    return { ...this.config };
  }

  public isConnected(): boolean {
    return this.state.status === 'connected';
  }

  public getLatency(): number {
    return this.state.latency;
  }

  // 設定更新
  public updateConfig(updates: Partial<ConnectionManagerConfig>): void {
    this.config = { ...this.config, ...updates };
    
    // ハートビート設定が変更された場合、再起動
    if (updates.heartbeat && this.config.heartbeat.enabled && this.isConnected()) {
      this.stopHeartbeat();
      this.startHeartbeat();
    }
  }

  // 完全なクリーンアップ
  public destroy(): void {
    console.log('🧹 Destroying WebSocketConnectionManager...');
    
    this.isIntentionalDisconnect = true;
    this.disconnect();
    this.cleanup();
    this.eventListeners.clear();
    
    console.log('🧹 WebSocketConnectionManager destroyed');
  }
}