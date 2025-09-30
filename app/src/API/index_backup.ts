// フロントエンド向けのWebSocket APIクライアント

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
  private ws: WebSocket | null = null;
  private eventCallbacks = new Map<string, EventCallback[]>();
  private requestCallbacks = new Map<string, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionPromise: Promise<void> | null = null;

  constructor(private wsUrl: string = 'ws://localhost:8080') {}

  // WebSocket接続
  public async connect(): Promise<void> {
    // 既に接続済みの場合
    if (this.connectionState === 'connected') {
      console.log('🔗 Already connected to WebSocket');
      return;
    }
    
    // 接続中の場合は既存のPromiseを返す
    if (this.connectionState === 'connecting' && this.connectionPromise) {
      console.log('🔄 Connection already in progress, waiting...');
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionState = 'connecting';
      
      try {
        this.ws = new WebSocket(this.wsUrl);
        
        this.ws.onopen = () => {
          console.log('✅ Connected to Bedrock Proxy Backend');
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.connectionPromise = null;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = (event) => {
          console.log('📡 WebSocket connection closed:', event.code, event.reason);
          this.connectionState = 'disconnected';
          this.connectionPromise = null;
          this.ws = null;
          
          // 意図的な切断でなければ自動再接続
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log('🔄 Scheduling reconnection...');
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.connectionState = 'disconnected';
          this.connectionPromise = null;
          reject(new Error('WebSocket connection failed'));
        };

      } catch (error) {
        this.connectionState = 'disconnected';
        this.connectionPromise = null;
        reject(error);
      }
    });
  }

  // WebSocket切断
  public disconnect(): void {
    console.log('🔌 Disconnecting WebSocket...');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = 'disconnected';
    this.connectionPromise = null;
    this.clearPendingRequests();
  }

  // 再接続のスケジュール
  private scheduleReconnect(): void {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('❌ Reconnection failed:', error);
      });
    }, delay);
  }

  // メッセージハンドリング
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      // レスポンスメッセージの処理
      if (message.id && this.requestCallbacks.has(message.id)) {
        const callback = this.requestCallbacks.get(message.id)!;
        clearTimeout(callback.timeout);
        this.requestCallbacks.delete(message.id);
        
        if (message.success) {
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
        return;
      }

    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
    }
  }

  // APIリクエスト送信
  private async sendRequest<T>(type: string, data?: any, timeout: number = 10000): Promise<T> {
    if (!this.ws || this.connectionState !== 'connected') {
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

      this.ws!.send(JSON.stringify(message));
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
  public getConnectionState(): 'disconnected' | 'connecting' | 'connected' {
    return this.connectionState;
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
}

// シングルトンインスタンス
export const bedrockProxyAPI = new BedrockProxyAPI();