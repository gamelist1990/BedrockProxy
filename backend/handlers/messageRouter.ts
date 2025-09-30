import type {
  RequestMessage,
  ResponseMessage,
  WSClient,
  ServerAPI
} from "../types/index.js";
import { APIError } from "../types/index.js";
import { ServerManager } from "../services/serverManager.js";

export class MessageRouter {
  private serverManager: ServerManager;

  constructor() {
    this.serverManager = new ServerManager();
    this.setupEventHandlers();
  }

  public async handleMessage(message: RequestMessage, client: WSClient): Promise<ResponseMessage | null> {
    try {
      console.log(`🔍 Handling message: ${message.type} from ${client.id}`);

      let data: any = null;

      switch (message.type) {
        // サーバー関連API
        case "servers.getAll":
          data = this.handleGetServers(message.data);
          break;

        case "servers.getDetails":
          data = this.handleGetServerDetails(message.data);
          break;

        case "servers.add":
          data = await this.handleAddServer(message.data);
          break;

        case "servers.update":
          data = await this.handleUpdateServer(message.data);
          break;

        case "servers.delete":
          data = await this.handleDeleteServer(message.data);
          break;

        case "servers.action":
          data = await this.handleServerAction(message.data);
          break;

        case "servers.detect":
          data = await this.handleDetectServer(message.data);
          break;

        case "servers.addFromDetection":
          data = await this.handleAddServerFromDetection(message.data);
          break;

        case "servers.getConsole":
          data = this.handleGetServerConsole(message.data);
          break;

        case "servers.consoleCommand":
          data = await this.handleConsoleCommand(message.data);
          break;

        // 設定関連
        case "config.get":
          data = await this.handleGetConfig(message.data);
          break;

        case "config.save":
          data = await this.handleSaveConfig(message.data);
          break;

        // イベント購読関連
        case "subscribe":
          return this.handleSubscribe(message.data, client);

        case "unsubscribe":
          return this.handleUnsubscribe(message.data, client);

        // ping/pong
        case "ping":
          return this.createResponse(message.id, true, { 
            pong: Date.now(),
            timestamp: message.data?.timestamp || Date.now()
          });

        default:
          throw new APIError(`Unknown message type: ${message.type}`, "UNKNOWN_MESSAGE_TYPE", 400);
      }

      return this.createResponse(message.id, true, data);

    } catch (error) {
      console.error(`❌ Error handling message ${message.type}:`, error);
      
      const errorMessage = error instanceof APIError 
        ? error.message 
        : "Internal server error";
      
      const errorCode = error instanceof APIError 
        ? error.code 
        : "INTERNAL_ERROR";

      return this.createResponse(message.id, false, null, `${errorCode}: ${errorMessage}`);
    }
  }

  // サーバー一覧取得
  private handleGetServers(data: ServerAPI.GetServersRequest): ServerAPI.GetServersResponse {
    const servers = this.serverManager.getServers();
    return { servers };
  }

  // サーバー詳細取得
  private handleGetServerDetails(data: ServerAPI.GetServerDetailsRequest): ServerAPI.GetServerDetailsResponse {
    console.log(`🔎 getServerDetails called for id=${data?.id}`);
    if (!data || !data.id) {
      console.warn('⚠️ getServerDetails missing id');
      throw new APIError("Server ID is required", "MISSING_SERVER_ID", 400);
    }

    const server = this.serverManager.getServer(data.id);
    if (!server) {
      console.warn(`⚠️ Server not found for id=${data.id}. Available servers: ${this.serverManager.getServers().map(s => s.id).join(', ')}`);
      throw new APIError(`Server with id ${data.id} not found`, "SERVER_NOT_FOUND", 404);
    }

    return {
      server,
      players: server.players || []
    };
  }

  // サーバー追加
  private async handleAddServer(data: ServerAPI.AddServerRequest): Promise<ServerAPI.AddServerResponse> {
    if (!data) {
      throw new APIError("Server data is required", "MISSING_SERVER_DATA", 400);
    }

    const server = await this.serverManager.addServer(data);
    return { server };
  }

  // サーバー更新
  private async handleUpdateServer(data: ServerAPI.UpdateServerRequest): Promise<ServerAPI.UpdateServerResponse> {
    if (!data || !data.id) {
      throw new APIError("Server ID is required", "MISSING_SERVER_ID", 400);
    }

    const server = await this.serverManager.updateServer(data);
    return { server };
  }

  // サーバー削除
  private async handleDeleteServer(data: ServerAPI.DeleteServerRequest): Promise<ServerAPI.DeleteServerResponse> {
    if (!data || !data.id) {
      throw new APIError("Server ID is required", "MISSING_SERVER_ID", 400);
    }

    await this.serverManager.deleteServer(data.id);
    return { success: true };
  }

  // サーバー操作
  private async handleServerAction(data: ServerAPI.ServerActionRequest): Promise<ServerAPI.ServerActionResponse> {
    if (!data || !data.id || !data.action) {
      throw new APIError("Server ID and action are required", "MISSING_ACTION_DATA", 400);
    }

    const server = await this.serverManager.performServerAction(data);

    // Broadcast an immediate event so clients receive an OUT corresponding to the INPUT action.
    try {
      this.broadcastEvent('server.updated', { server });
      this.broadcastEvent('server.action', { serverId: server.id, action: data.action, server });
      // Also emit a console-like notification for UI feedback
      this.broadcastEvent('console.output', {
        serverId: server.id,
        line: `[action] ${data.action} requested`,
        timestamp: new Date(),
        type: 'stdout'
      });
    } catch (e) {
      console.warn('⚠️ Failed to broadcast immediate server action events:', e);
    }

    return { server };
  }

  // イベント購読
  private handleSubscribe(data: { events?: string[] }, client: WSClient): ResponseMessage {
    const events = data?.events || ["*"];
    
    if (!Array.isArray(events)) {
      throw new APIError("Events must be an array", "INVALID_EVENTS", 400);
    }

    events.forEach(event => {
      client.subscriptions.add(event);
    });

    console.log(`📡 Client ${client.id} subscribed to: ${events.join(', ')}`);

    return this.createResponse("", true, {
      subscribed: events,
      totalSubscriptions: client.subscriptions.size
    });
  }

  // イベント購読解除
  private handleUnsubscribe(data: { events?: string[] }, client: WSClient): ResponseMessage {
    const events = data?.events || [];
    
    if (!Array.isArray(events)) {
      throw new APIError("Events must be an array", "INVALID_EVENTS", 400);
    }

    events.forEach(event => {
      client.subscriptions.delete(event);
    });

    console.log(`📡 Client ${client.id} unsubscribed from: ${events.join(', ')}`);

    return this.createResponse("", true, {
      unsubscribed: events,
      totalSubscriptions: client.subscriptions.size
    });
  }

  // レスポンス作成ヘルパー
  private createResponse(id: string, success: boolean, data: any = null, error?: string): ResponseMessage {
    return {
      type: "response",
      id,
      success,
      data,
      error,
      timestamp: Date.now(),
    };
  }

  // イベントハンドラーのセットアップ
  private setupEventHandlers(): void {
    // ServerManagerからのイベントをWebSocketクライアントに転送
    this.serverManager.on("serverCreated", (data: any) => {
      this.broadcastEvent("server.created", data);
    });

    this.serverManager.on("serverUpdated", (data: any) => {
      this.broadcastEvent("server.updated", data);
    });

    this.serverManager.on("serverDeleted", (data: any) => {
      this.broadcastEvent("server.deleted", data);
    });

    this.serverManager.on("serverStatusChanged", (data: any) => {
      this.broadcastEvent("server.statusChanged", data);
    });

    this.serverManager.on("playerJoined", (data: any) => {
      this.broadcastEvent("player.joined", data);
    });

    this.serverManager.on("playerLeft", (data: any) => {
      this.broadcastEvent("player.left", data);
    });

    this.serverManager.on("consoleOutput", (data: any) => {
      this.broadcastEvent("console.output", data);
    });
    // server.properties update events
    this.serverManager.on("serverPropertiesUpdated", (data: any) => {
      this.broadcastEvent("server.properties.updated", data);
    });
    this.serverManager.on("serverPropertiesUpdateFailed", (data: any) => {
      this.broadcastEvent("server.properties.updateFailed", data);
    });
  }

  // イベントブロードキャスト（WebSocketServerに委譲）
  private broadcastEvent(eventType: string, data: any): void {
    // この関数は実際にはWebSocketServerから呼び出されるように設計する
    // 現在はログ出力のみ
    console.log(`📡 Broadcasting event: ${eventType}`, data);
  }

  // WebSocketServerからイベントブロードキャスト機能を設定
  public setBroadcastFunction(broadcastFn: (eventType: string, data: any) => void): void {
    this.broadcastEvent = broadcastFn;
  }

  // Minecraftサーバー検出
  private async handleDetectServer(data: ServerAPI.DetectServerRequest): Promise<ServerAPI.DetectServerResponse> {
    if (!data || !data.executablePath) {
      throw new APIError("Executable path is required", "MISSING_EXECUTABLE_PATH", 400);
    }

    const detectedInfo = await this.serverManager.detectMinecraftServer(data.executablePath);
    const recommendedConfig = {
      name: detectedInfo.config.serverName || "Minecraft Server",
      address: `127.0.0.1:${detectedInfo.suggestedProxyPort || 19133}`,
      destinationAddress: `127.0.0.1:${detectedInfo.config.serverPort || 19132}`,
      maxPlayers: detectedInfo.config.maxPlayers || 10,
      description: detectedInfo.config.motd || `Auto-detected ${detectedInfo.config.gamemode || 'survival'} server`,
      tags: [
        detectedInfo.config.gamemode || 'survival',
        detectedInfo.config.difficulty || 'easy',
        'Auto-detected'
      ]
    };

    return { 
      detectedInfo: {
        ...detectedInfo,
        suggestedProxyPort: detectedInfo.suggestedProxyPort || 19133
      }, 
      recommendedConfig 
    };
  }

  // 検出情報からサーバー追加
  private async handleAddServerFromDetection(data: ServerAPI.AddServerFromDetectionRequest): Promise<ServerAPI.AddServerResponse> {
    if (!data || !data.detectedInfo) {
      throw new APIError("Detected info is required", "MISSING_DETECTED_INFO", 400);
    }

    const server = await this.serverManager.addServerFromDetection(data.detectedInfo, data.customConfig);
    return { server };
  }

  // 設定取得
  private async handleGetConfig(data: ServerAPI.GetConfigRequest): Promise<ServerAPI.GetConfigResponse> {
    const config = await this.serverManager.getAppConfig();
    return { config };
  }

  // 設定保存
  private async handleSaveConfig(data: ServerAPI.SaveConfigRequest): Promise<ServerAPI.SaveConfigResponse> {
    if (!data || !data.config) {
      throw new APIError("Config data is required", "MISSING_CONFIG_DATA", 400);
    }

    await this.serverManager.saveAppConfig(data.config);
    return { success: true };
  }

  // サーバーコンソール取得
  private handleGetServerConsole(data: { id: string; lineCount?: number }): { lines: string[] } {
    if (!data || !data.id) {
      throw new APIError("Server ID is required", "MISSING_SERVER_ID", 400);
    }

    const server = this.serverManager.getServer(data.id);
    if (!server) {
      throw new APIError(`Server with id ${data.id} not found`, "SERVER_NOT_FOUND", 404);
    }

    // プロセスマネージャーから実際のコンソールログを取得
    const lines = this.serverManager.getServerConsoleOutput(data.id, data.lineCount);
    
    return { lines };
  }

  // コンソールコマンド送信
  private async handleConsoleCommand(data: { id: string; command: string }): Promise<{ success: true } | { success: false; message: string }> {
    if (!data || !data.id || !data.command) {
      throw new APIError("Server ID and command are required", "MISSING_COMMAND_DATA", 400);
    }

    const server = this.serverManager.getServer(data.id);
    if (!server) {
      throw new APIError(`Server with id ${data.id} not found`, "SERVER_NOT_FOUND", 404);
    }

    try {
      // プロセスマネージャー経由でコマンドを送信
      this.serverManager.sendConsoleCommand(data.id, data.command);
      // Immediately broadcast an echo of the command so the client sees an OUT for their INPUT
      try {
        this.broadcastEvent('console.output', {
          serverId: data.id,
          line: `> ${data.command}`,
          timestamp: new Date(),
          type: 'stdin'
        });
      } catch (e) {
        console.warn('Failed to broadcast console command echo:', e);
      }
      return { success: true };
    } catch (err: any) {
      // プロセスが実行されていない場合はユーザ向けメッセージを返す
      if (err && (err.code === 'PROCESS_NOT_RUNNING' || err.code === 'PROCESS_NOT_FOUND')) {
        console.warn(`Console command failed - no process for ${data.id}`);
        // Still broadcast a message indicating command could not be delivered
        try {
          this.broadcastEvent('console.output', {
            serverId: data.id,
            line: `> ${data.command} (failed: no running process)`,
            timestamp: new Date(),
            type: 'stderr'
          });
        } catch (e) {
          // noop
        }
        return { success: false, message: 'No running server process to receive commands' };
      }
      throw err;
    }
  }

  // ServerManagerのインスタンスを取得（テスト用など）
  public getServerManager(): ServerManager {
    return this.serverManager;
  }
}
