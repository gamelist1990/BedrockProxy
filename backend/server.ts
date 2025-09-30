import type { ServerWebSocket } from "bun";
import type { 
  WSClient, 
  WebSocketMessage, 
  RequestMessage, 
  ResponseMessage, 
  EventMessage 
} from "./types/index.js";
import { MessageRouter } from "./handlers/messageRouter.js";
import { ConnectionManager } from "./services/connectionManager.js";

export class WebSocketServer {
  private connectionManager: ConnectionManager;
  private router = new MessageRouter();
  private server: any;

  constructor(private port: number = 8080) {
    // ConnectionManagerを初期化
    this.connectionManager = new ConnectionManager({
      heartbeatInterval: 30000, // 30秒
      clientTimeout: 60000, // 60秒
      maxReconnectDelay: 30000, // 30秒
      pingTimeout: 10000, // 10秒
    });

    // ルーターにブロードキャスト機能を提供
    this.router.setBroadcastFunction((eventType: string, data: any) => {
      this.connectionManager.broadcastToSubscribers({
        type: "event",
        event: eventType,
        data,
        timestamp: Date.now(),
      });
    });
  }

  public start(): void {
    this.server = Bun.serve({
      port: this.port,
      fetch: this.handleHTTP.bind(this),
      websocket: {
        message: this.handleMessage.bind(this),
        open: this.handleOpen.bind(this),
        close: this.handleClose.bind(this),
        drain: this.handleDrain.bind(this),
      },
    });

    console.log(`🚀 WebSocket server running on http://localhost:${this.port}`);
  }

  public async stop(): Promise<void> {
    try {
      // Ask router to stop all managed servers first
      if (this.router && typeof (this.router as any).stopAllServers === 'function') {
        await (this.router as any).stopAllServers();
      }
    } catch (e) {
      console.warn('⚠️ Error while stopping managed servers during shutdown:', e);
    }

    if (this.server) {
      try {
        this.connectionManager.cleanup();
      } catch (e) {
        console.warn('⚠️ Error during connectionManager.cleanup():', e);
      }

      try {
        // Bun's server.stop may be synchronous; call it and ignore promise if not present
        const res = (this.server as any).stop();
        if (res && typeof res.then === 'function') {
          await res;
        }
      } catch (e) {
        console.warn('⚠️ Error while stopping HTTP/WebSocket server:', e);
      }

      console.log("📦 WebSocket server stopped");
    }
  }

  private async handleHTTP(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // WebSocket接続のハンドシェイク
    if (request.headers.get("upgrade") === "websocket") {
      const success = this.server.upgrade(request, {
        data: {
          clientId: this.generateClientId(),
          connectedAt: new Date(),
        },
      });

      return success
        ? undefined!
        : new Response("WebSocket upgrade failed", { status: 400 });
    }

    // HTTP APIやヘルスチェック
    if (url.pathname === "/health") {
      const stats = this.connectionManager.getConnectionStats();
      return new Response(JSON.stringify({
        status: "ok",
        clients: stats.totalClients,
        aliveClients: stats.aliveClients,
        avgLatency: stats.avgLatency,
        timestamp: Date.now(),
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Debug broadcast endpoint (POST) - used only for local testing
    if (url.pathname === "/debug/broadcast" && request.method === "POST") {
      try {
        const body = await request.text();
        const payload = body ? JSON.parse(body) : {};
        const event = payload.event || payload.type || "console.output";
        const data = payload.data || payload || { message: payload.message || "test" };

        // Broadcast to subscribers
        this.broadcast({
          type: "event",
          event,
          data,
          timestamp: Date.now(),
        });

        return new Response(JSON.stringify({ ok: true, event, data }), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (err) {
        console.error('Failed to handle debug broadcast:', err);
        return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }

    // CORS対応
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  private handleOpen(ws: ServerWebSocket<any>): void {
    const { clientId, connectedAt } = ws.data;
    
    const client = this.connectionManager.addClient(clientId, ws, connectedAt);

    // 接続成功メッセージを送信
    this.connectionManager.sendMessage(clientId, {
      type: "connection",
      data: {
        clientId,
        connectedAt: connectedAt.toISOString(),
        serverTime: new Date().toISOString(),
      },
      timestamp: Date.now(),
    });
  }

  private async handleMessage(ws: ServerWebSocket<any>, message: string | Buffer): Promise<void> {
    try {
      const data = JSON.parse(message.toString());
      const clientId = ws.data.clientId;
      const client = this.connectionManager.getClient(clientId);

      if (!client) {
        console.warn(`⚠️  Message from unknown client: ${clientId}`);
        return;
      }

      // ping/pong はログを抑制して通常処理を行う
      if (data.type === "ping") {
        this.connectionManager.sendMessage(clientId, {
          type: "pong",
          timestamp: data.timestamp || Date.now(),
        });
        return;
      }

      if (data.type === "pong") {
        this.connectionManager.handlePong(clientId, data.timestamp);
        return;
      }

      // その他メッセージのみログ出力
      console.log(`📨 Received message from ${client.id}:`, data.type);

      // 購読処理
      if (data.type === "subscribe") {
        // Accept multiple shapes: { events: [...] } or { data: { events: [...] } } or a single string
        const raw = data.events ?? data.data?.events ?? data.data ?? "*";
        const eventsArray = Array.isArray(raw) ? raw : [raw];
        const stringEvents = eventsArray.flatMap((e: any) => {
          if (typeof e === 'string') return [e];
          // if the client accidentally sent { events: [{ events: [...] }] }
          if (e && typeof e === 'object' && Array.isArray(e.events)) return e.events.filter((s: any) => typeof s === 'string');
          return [];
        });
        const uniqueEvents = [...new Set(stringEvents)]; // remove duplicates
        const subscribedEvents: string[] = [];

        uniqueEvents.forEach((event: string) => {
          if (this.connectionManager.subscribeClient(clientId, event)) {
            subscribedEvents.push(event);
          }
        });

        this.connectionManager.sendMessage(clientId, {
          type: "response",
          id: data.id,
          data: { subscribed: subscribedEvents, success: true },
          timestamp: Date.now(),
        });
        return;
      }

      if (data.type === "unsubscribe") {
        const raw = data.events ?? data.data?.events ?? data.data ?? [];
        const eventsArray = Array.isArray(raw) ? raw : [raw];
        const stringEvents = eventsArray.flatMap((e: any) => {
          if (typeof e === 'string') return [e];
          if (e && typeof e === 'object' && Array.isArray(e.events)) return e.events.filter((s: any) => typeof s === 'string');
          return [];
        });

        const unsubscribedEvents: string[] = [];

        stringEvents.forEach((event: string) => {
          if (this.connectionManager.unsubscribeClient(clientId, event)) {
            unsubscribedEvents.push(event);
          }
        });

        this.connectionManager.sendMessage(clientId, {
          type: "response",
          id: data.id,
          data: { unsubscribed: unsubscribedEvents, success: true },
          timestamp: Date.now(),
        });
        return;
      }

      // その他のメッセージはルーターに転送
      const response = await this.router.handleMessage(data as RequestMessage, client);

      // レスポンスがある場合は送信
      if (response) {
        this.connectionManager.sendMessage(clientId, response);
      }

    } catch (error) {
      console.error("❌ Error handling message:", error);
      
      // エラーレスポンスを送信
      this.connectionManager.sendMessage(ws.data.clientId, {
        type: "error",
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        timestamp: Date.now(),
      } as ResponseMessage);
    }
  }

  private handleClose(ws: ServerWebSocket<any>, code: number, reason: string): void {
    const clientId = ws.data.clientId;
    this.connectionManager.removeClient(clientId);
  }

  private handleDrain(ws: ServerWebSocket<any>): void {
    // バックプレッシャー処理
    console.log(`💧 WebSocket drain for client: ${ws.data.clientId}`);
  }

  // すべてのクライアントにブロードキャスト
  public broadcast(message: EventMessage): void {
    this.connectionManager.broadcast(message);
  }

  // 特定のクライアントにメッセージ送信
  public sendToClient(clientId: string, message: WebSocketMessage): boolean {
    return this.connectionManager.sendMessage(clientId, message);
  }

  // イベント購読管理
  public subscribeClient(clientId: string, eventType: string): boolean {
    return this.connectionManager.subscribeClient(clientId, eventType);
  }

  public unsubscribeClient(clientId: string, eventType: string): boolean {
    return this.connectionManager.unsubscribeClient(clientId, eventType);
  }

  // 購読者にのみイベント送信  
  public broadcastToSubscribers(message: EventMessage): void {
    this.connectionManager.broadcastToSubscribers(message);
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 現在の接続状況を取得
  public getStatus() {
    const stats = this.connectionManager.getConnectionStats();
    const clientStats = this.connectionManager.getAllClientStats();
    
    return {
      clientCount: stats.totalClients,
      aliveClients: stats.aliveClients,
      avgLatency: stats.avgLatency,
      clients: clientStats.map(stat => ({
        id: stat.id,
        connectedAt: stat.connectedAt,
        subscriptions: stat.subscriptions,
        isAlive: stat.isAlive,
        latency: stat.pingLatency,
      })),
    };
  }
}