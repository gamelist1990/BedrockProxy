// フロントエンド向けのWebSocket APIクライアント（改良版）

import { wsClient, type WSMessage } from './wsClient.js';
import { Command } from '@tauri-apps/plugin-shell';
import type { ConnectionEventType } from './connectionManager.js';

export type ServerStatus = "online" | "offline" | "starting" | "stopping" | "error";
export type ServerMode = "normal" | "proxyOnly"; // Server operation mode

export interface Player {
  id: string;
  name: string;
  joinTime: Date;
  ipAddress?: string;
  port?: number;
}

export interface UDPConnection {
  id: string;
  ipAddress: string;
  port: number;
  connectTime: Date;
  disconnectTime?: Date;
  isActive: boolean;
}

export interface Server {
  id: string;
  name: string;
  address: string;
  destinationAddress: string;
  status: ServerStatus;
  mode?: ServerMode; // Operation mode
  playersOnline: number;
  maxPlayers: number;
  iconUrl?: string;
  tags?: string[];
  autoStart?: boolean;
  autoRestart?: boolean;
  blockSameIP?: boolean;
  forwardAddress?: string;
  pluginsEnabled?: boolean;
  plugins?: Record<string, any>; // プラグイン設定（プラグインID -> 設定オブジェクト）
  description?: string;
  docs?: string;
  players?: Player[];
  udpConnections?: UDPConnection[]; // For Proxy Only mode
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
  private connectionManager = wsClient;
  private eventCallbacks = new Map<string, EventCallback[]>();
  private requestCallbacks = new Map<string, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  // Whether we've already attempted auto-starting the backend in this session
  private autoStartAttempted = false;

  constructor(_wsUrl: string = 'ws://localhost:8080') {
    // WebSocketConnectionManagerを初期化
    // wsClient is a singleton that will manage connection details
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

    this.connectionManager.on('disconnected', (data: any) => {
      console.log('📡 API Disconnected from backend:', data);
      // 保留中のリクエストをクリア
      this.clearPendingRequests();
    });

    this.connectionManager.on('reconnecting', async (data: any) => {
      console.log(`🔄 API Reconnecting... (attempt ${data.attempt}/${data.maxAttempts})`);
      // If we've retried several times and haven't attempted auto-start yet, try spawning backend.exe
      try {
        const attemptThreshold = 1; // when to try auto-start (tweakable)
        if (!this.autoStartAttempted && typeof data?.attempt === 'number' && data.attempt >= attemptThreshold) {
          this.autoStartAttempted = true;
          console.info('Attempting auto-start of backend.exe after repeated reconnect failures');
          this.emitEvent('backend.autoStartAttempt', { attempt: data.attempt });
          // Try auto-start using Tauri sidecar (preferred)
          try {
            console.info('Attempting sidecar auto-start: binaries/backend');
            const sidecarCmd = Command.sidecar('binaries/backend');
            const child = await sidecarCmd.spawn();
            (window as any).__bp_spawned_backend = { cmd: sidecarCmd, child } as any;
            // small delay to let the backend initialize
            await new Promise((r) => setTimeout(r, 1200));
            this.emitEvent('backend.autoStartResult', { success: true });
            console.info('Auto-start sidecar finished (success or backend started)');
          } catch (autoErr) {
            this.emitEvent('backend.autoStartResult', { success: false, error: String(autoErr) });
            console.error('Auto-start sidecar failed:', autoErr);
          }
        }
      } catch (e) {
        console.error('Error during auto-start trigger:', e);
      }
    });

    this.connectionManager.on('error', (data: any) => {
      console.error('❌ API Connection error:', data);
      // エラーイベントを転送
      this.emitEvent('connection.error', data);
    });
    // wsClient emits a generic 'message' with parsed JSON
    this.connectionManager.on('message', (message: WSMessage) => {
      this.handleMessage(message as WebSocketMessage);
    });

    this.connectionManager.on('latencyUpdate', (data: any) => {
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
    autoStart?: boolean;
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
  public async performServerAction(id: string, action: 'start' | 'stop' | 'restart', targetIP?: string): Promise<Server> {
    const response = await this.sendRequest<{ server: Server }>('servers.action', { id, action, targetIP });
    return {
      ...response.server,
      createdAt: new Date(response.server.createdAt),
      updatedAt: new Date(response.server.updatedAt),
    };
  }

  // イベント購読
  public async subscribe(events: string[]): Promise<void> {
    // 重複チェック（クライアント側でも）
    const uniqueEvents = [...new Set(events)];
    await this.sendRequest('subscribe', { events: uniqueEvents });
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
    const response = await this.sendRequest<{
      config: {
        language: string;
        theme: string;
        autoStart: boolean;
        checkUpdates: boolean;
        logLevel: string;
      }
    }>('config.get');
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

  // sidecar-based auto-start handled inline in reconnect event

  // システム情報を取得
  public async getSystemInfo(): Promise<{ pluginsDirectory: string; dataDirectory: string }> {
    const response = await this.sendRequest<{ pluginsDirectory: string; dataDirectory: string }>('system.getInfo', {});
    return response;
  }
  
  // ==================== Plugin API ====================
  
  // プラグイン読み込み
  public async loadPlugins(serverId: string): Promise<any[]> {
    console.log(`[API] Loading plugins for server ${serverId}`);
    const response = await this.sendRequest<{ plugins: any[] }>('plugins.load', { serverId });
    console.log(`[API] Loaded plugins:`, response.plugins);
    return response.plugins;
  }
  
  // プラグイン一覧取得
  public async getPlugins(serverId: string): Promise<any[]> {
    console.log(`[API] Getting plugins for server ${serverId}`);
    const response = await this.sendRequest<{ plugins: any[] }>('plugins.getAll', { serverId });
    console.log(`[API] Got plugins:`, response.plugins);
    return response.plugins;
  }
  
  // プラグイン有効化
  public async enablePlugin(serverId: string, pluginId: string): Promise<any> {
    console.log(`[API] Enabling plugin ${pluginId} for server ${serverId}`);
    const response = await this.sendRequest<{ plugin: any }>('plugins.enable', { serverId, pluginId });
    console.log(`[API] Plugin enabled:`, response.plugin);
    return response.plugin;
  }
  
  // プラグイン無効化
  public async disablePlugin(serverId: string, pluginId: string): Promise<any> {
    console.log(`[API] Disabling plugin ${pluginId} for server ${serverId}`);
    const response = await this.sendRequest<{ plugin: any }>('plugins.disable', { serverId, pluginId });
    console.log(`[API] Plugin disabled:`, response.plugin);
    return response.plugin;
  }
}

// シングルトンインスタンス
export const bedrockProxyAPI = new BedrockProxyAPI();