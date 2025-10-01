// フロントエンド向けのWebSocket APIクライアント（改良版）

import { WebSocketConnectionManager, type ConnectionEventType } from './connectionManager.js';

export type ServerStatus = "online" | "offline" | "starting" | "stopping" | "error";

export interface Player {
  id: string;
  name: string;
  joinTime: Date;
  ipAddress?: string;
}

export interface Server {
  id: string;
  name: string;
  address: string;
  destinationAddress: string;
  status: ServerStatus;
  playersOnline: number;
  maxPlayers: number;
  iconUrl?: string;
  tags?: string[];
  autoRestart?: boolean;
  blockSameIP?: boolean;
  forwardAddress?: string;
  description?: string;
  players?: Player[];
  executablePath?: string;
  serverDirectory?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebSocketMessage<T = any> {
  type: string;
  id?: string;
  data?: T;
  timestamp: number;
  success?: boolean;
  error?: string;
  event?: string;
}

export type EventCallback<T = any> = (data: T) => void;

export class BedrockProxyAPI {
  private connectionManager: WebSocketConnectionManager;
  private eventCallbacks = new Map<string, EventCallback[]>();
  private requestCallbacks = new Map<string, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(wsUrl: string = 'ws://localhost:8080') {
    // WebSocketConnectionManagerを初期化
    this.connectionManager = new WebSocketConnectionManager({
      url: wsUrl,
      reconnect: {
        enabled: true,
        maxAttempts: 10,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 1.5,
        jitter: true
      },
      heartbeat: {
        enabled: true,
        interval: 30000,
        timeout: 10000,
        maxMissedBeats: 3
      },
      connectionTimeout: 10000,
      messageTimeout: 30000
    });

    this.setupConnectionEventHandlers();
  }

  // 接続イベントハンドラーのセットアップ
  private setupConnectionEventHandlers(): void {
    this.connectionManager.on('connected', () => {
      console.log('✅ API Connected to Bedrock Proxy Backend');
      // 自動購読
      this.subscribe(['*']).catch(error => {
        console.error('❌ Auto-subscription failed:', error);
      });
    });

    this.connectionManager.on('disconnected', (data) => {
      console.log('📡 API Disconnected from backend:', data);
      // 保留中のリクエストをクリア
      this.clearPendingRequests();
    });

    this.connectionManager.on('reconnecting', (data) => {
      console.log(`🔄 API Reconnecting... (attempt ${data.attempt}/${data.maxAttempts})`);
    });

    this.connectionManager.on('error', (data) => {
      console.error('❌ API Connection error:', data);
      // エラーイベントを転送
      this.emitEvent('connection.error', data);
    });

    this.connectionManager.on('message', (message) => {
      this.handleMessage(message);
    });

    this.connectionManager.on('latencyUpdate', (data) => {
      this.emitEvent('connection.latency', { latency: data.latency });
    });
  }

  // WebSocket接続
  public async connect(): Promise<void> {
    return this.connectionManager.connect();
  }

  // WebSocket切断
  public disconnect(): void {
    this.connectionManager.disconnect();
    this.clearPendingRequests();
  }

  // メッセージハンドリング
  private handleMessage(message: WebSocketMessage): void {
    try {
      // レスポンスメッセージの処理
      if (message.id && this.requestCallbacks.has(message.id)) {
        const callback = this.requestCallbacks.get(message.id)!;
        clearTimeout(callback.timeout);
        this.requestCallbacks.delete(message.id);
        
        if (message.data?.success !== false && !message.error) {
          callback.resolve(message.data);
        } else {
          callback.reject(new Error(message.error || 'Unknown error'));
        }
        return;
      }

      // イベントメッセージの処理
      if (message.type === 'event' && message.event) {
        this.emitEvent(message.event, message.data);
        return;
      }

      // 接続メッセージの処理
      if (message.type === 'connection') {
        console.log('🔗 Connection established:', message.data);
        this.emitEvent('connection.established', message.data);
        return;
      }

    } catch (error) {
      console.error('❌ Error handling API message:', error);
    }
  }

  // APIリクエスト送信
  private async sendRequest<T>(type: string, data?: any, timeout: number = 30000): Promise<T> {
    if (!this.connectionManager.isConnected()) {
      throw new Error('WebSocket is not connected');
    }

    const id = this.generateRequestId();
    const message: WebSocketMessage = {
      type,
      id,
      data,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.requestCallbacks.delete(id);
        reject(new Error('Request timeout'));
      }, timeout);

      this.requestCallbacks.set(id, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      if (!this.connectionManager.send(message)) {
        this.requestCallbacks.delete(id);
        clearTimeout(timeoutHandle);
        reject(new Error('Failed to send message'));
      }
    });
  }

  // サーバー一覧取得
  public async getServers(): Promise<Server[]> {
    const response = await this.sendRequest<{ servers: Server[] }>('servers.getAll');
    return response.servers.map(server => ({
      ...server,
      createdAt: new Date(server.createdAt),
      updatedAt: new Date(server.updatedAt),
      players: server.players?.map(player => ({
        ...player,
        joinTime: new Date(player.joinTime),
      })),
    }));
  }

  // サーバー詳細取得
  public async getServerDetails(id: string): Promise<{ server: Server; players: Player[] }> {
    const response = await this.sendRequest<{ server: Server; players: Player[] }>('servers.getDetails', { id });
    return {
      server: {
        ...response.server,
        createdAt: new Date(response.server.createdAt),
        updatedAt: new Date(response.server.updatedAt),
      },
      players: response.players.map(player => ({
        ...player,
        joinTime: new Date(player.joinTime),
      })),
    };
  }

  // サーバー追加
  public async addServer(serverData: {
    name: string;
    address: string;
    destinationAddress: string;
    maxPlayers: number;
    iconUrl?: string;
    tags?: string[];
    description?: string;
    autoRestart?: boolean;
    blockSameIP?: boolean;
    forwardAddress?: string;
    executablePath?: string;
    serverDirectory?: string;
  }): Promise<Server> {
    const response = await this.sendRequest<{ server: Server }>('servers.add', serverData);
    return {
      ...response.server,
      createdAt: new Date(response.server.createdAt),
      updatedAt: new Date(response.server.updatedAt),
    };
  }

  // サーバー更新
  public async updateServer(id: string, updates: Partial<Omit<Server, 'id' | 'createdAt' | 'updatedAt' | 'players' | 'playersOnline'>>): Promise<Server> {
    const response = await this.sendRequest<{ server: Server }>('servers.update', { id, updates });
    return {
      ...response.server,
      createdAt: new Date(response.server.createdAt),
      updatedAt: new Date(response.server.updatedAt),
    };
  }

  // サーバー削除
  public async deleteServer(id: string): Promise<void> {
    await this.sendRequest<{ success: true }>('servers.delete', { id });
  }

  // サーバー操作（開始/停止/再起動/ブロック）
  public async performServerAction(id: string, action: 'start' | 'stop' | 'restart' | 'block', targetIP?: string): Promise<Server> {
    // Implement frontend-side restart as stop -> start sequence to ensure
    // proxy and process lifecycle are properly handled. This avoids relying
    // on a single 'restart' action on the backend which sometimes doesn't
    // fully reinitialize proxy state.
    if (action === 'restart') {
      // First attempt to stop the server (ignore if already stopped)
      try {
        await this.sendRequest<{ success: true }>('servers.action', { id, action: 'stop' }, 30000);
      } catch (err) {
        // Log but continue to attempt start — stop may already be in progress/absent
        console.warn('performServerAction(restart): stop failed or returned error, continuing to start', err);
      }

      // Small delay to let backend settle sockets/processes
      await new Promise((r) => setTimeout(r, 500));

      // Now start
      const startResp = await this.sendRequest<{ server: Server }>('servers.action', { id, action: 'start', targetIP }, 60000);
      return {
        ...startResp.server,
        createdAt: new Date(startResp.server.createdAt),
        updatedAt: new Date(startResp.server.updatedAt),
      };
    }

    const response = await this.sendRequest<{ server: Server }>('servers.action', { id, action, targetIP });
    return {
      ...response.server,
      createdAt: new Date(response.server.createdAt),
      updatedAt: new Date(response.server.updatedAt),
    };
  }

  // イベント購読
  public async subscribe(events: string[]): Promise<void> {
    await this.sendRequest('subscribe', { events });
  }

  // イベント購読解除
  public async unsubscribe(events: string[]): Promise<void> {
    await this.sendRequest('unsubscribe', { events });
  }

  // イベントリスナー追加
  public on<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  // イベントリスナー削除
  public off(event: string, callback?: EventCallback): void {
    if (!this.eventCallbacks.has(event)) {
      return;
    }

    if (callback) {
      const callbacks = this.eventCallbacks.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.eventCallbacks.delete(event);
    }
  }

  // 接続イベントリスナー（接続マネージャー用）
  public onConnection<T = any>(event: ConnectionEventType, callback: EventCallback<T>): void {
    this.connectionManager.on(event, callback);
  }

  public offConnection(event: ConnectionEventType, callback?: EventCallback): void {
    this.connectionManager.off(event, callback);
  }

  // Minecraftサーバー検出
  public async detectMinecraftServer(executablePath: string): Promise<{
    detectedInfo: any;
    recommendedConfig: {
      name: string;
      address: string;
      destinationAddress: string;
      maxPlayers: number;
      description: string;
      tags: string[];
    };
  }> {
    const response = await this.sendRequest<{
      detectedInfo: any;
      recommendedConfig: {
        name: string;
        address: string;
        destinationAddress: string;
        maxPlayers: number;
        description: string;
        tags: string[];
      };
    }>('servers.detect', { executablePath });
    return response;
  }

  // 検出情報からサーバー追加
  public async addServerFromDetection(detectedInfo: any, customConfig?: Partial<{
    name: string;
    address: string;
    destinationAddress: string;
    maxPlayers: number;
    iconUrl?: string;
    tags?: string[];
    description?: string;
    autoRestart?: boolean;
    blockSameIP?: boolean;
    forwardAddress?: string;
    executablePath?: string;
    serverDirectory?: string;
  }>): Promise<Server> {
    const response = await this.sendRequest<{ server: Server }>('servers.addFromDetection', { 
      detectedInfo, 
      customConfig 
    });
    return {
      ...response.server,
      createdAt: new Date(response.server.createdAt),
      updatedAt: new Date(response.server.updatedAt),
    };
  }

  // サーバーコンソール取得
  public async getServerConsole(id: string): Promise<{ lines: string[] }> {
    const response = await this.sendRequest<{ lines: string[] }>('servers.getConsole', { id });
    return response;
  }

  // コンソールコマンド送信
  public async sendConsoleCommand(id: string, command: string): Promise<void> {
    await this.sendRequest<{ success: true }>('servers.consoleCommand', { id, command });
  }

  // 設定取得
  public async getConfig(): Promise<{
    language: string;
    theme: string;
    autoStart: boolean;
    checkUpdates: boolean;
    logLevel: string;
  }> {
    const response = await this.sendRequest<{ config: {
      language: string;
      theme: string;
      autoStart: boolean;
      checkUpdates: boolean;
      logLevel: string;
    } }>('config.get');
    return response.config;
  }

  // 設定保存
  public async saveConfig(config: {
    language?: string;
    theme?: string;
    autoStart?: boolean;
    checkUpdates?: boolean;
    logLevel?: string;
  }): Promise<void> {
    await this.sendRequest<{ success: true }>('config.save', { config });
  }

  // Ping送信
  public async ping(): Promise<number> {
    const startTime = Date.now();
    await this.sendRequest<{ pong: number }>('ping');
    return Date.now() - startTime;
  }

  // 接続状態取得
  public getConnectionState() {
    return this.connectionManager.getState();
  }

  // 接続設定取得
  public getConnectionConfig() {
    return this.connectionManager.getConfig();
  }

  // レイテンシ取得
  public getLatency(): number {
    return this.connectionManager.getLatency();
  }

  // 接続確認
  public isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  // 接続設定更新
  public updateConnectionConfig(config: any): void {
    this.connectionManager.updateConfig(config);
  }

  // イベント発火
  private emitEvent(event: string, data: any): void {
    const callbacks = this.eventCallbacks.get(event);
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

  // リクエストID生成
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 保留中のリクエストをクリア
  private clearPendingRequests(): void {
    this.requestCallbacks.forEach(callback => {
      clearTimeout(callback.timeout);
      callback.reject(new Error('Connection closed'));
    });
    this.requestCallbacks.clear();
  }

  // クリーンアップ
  public destroy(): void {
    console.log('🧹 Destroying BedrockProxyAPI...');
    
    this.clearPendingRequests();
    this.eventCallbacks.clear();
    this.connectionManager.destroy();
    
    console.log('🧹 BedrockProxyAPI destroyed');
  }
}

// シングルトンインスタンス
export const bedrockProxyAPI = new BedrockProxyAPI();