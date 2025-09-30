import type { ServerWebSocket } from "bun";
import type { WSClient, WebSocketMessage, EventMessage } from "../types/index.js";
import { logger } from "./logger.js";

export interface ConnectionConfig {
  heartbeatInterval: number;
  clientTimeout: number;
  maxReconnectDelay: number;
  pingTimeout: number;
}

export interface ClientStats {
  id: string;
  connectedAt: Date;
  lastPing: Date;
  lastPong: Date;
  pingLatency: number;
  subscriptions: string[];
  isAlive: boolean;
  missedPings: number;
}

export class ConnectionManager {
  private clients = new Map<string, WSClient>();
  private clientStats = new Map<string, ClientStats>();
  private heartbeatTimer: Timer | null = null;
  private config: ConnectionConfig;

  constructor(config?: Partial<ConnectionConfig>) {
    this.config = {
      heartbeatInterval: 30000, // 30秒
      clientTimeout: 60000, // 60秒
      maxReconnectDelay: 30000, // 30秒
      pingTimeout: 10000, // 10秒
      ...config
    };

    this.startHeartbeat();
  }

  // クライアント接続処理
  public addClient(clientId: string, ws: ServerWebSocket<any>, connectedAt: Date): WSClient {
    const client: WSClient = {
      id: clientId,
      ws,
      connectedAt,
      subscriptions: new Set(),
    };

    const stats: ClientStats = {
      id: clientId,
      connectedAt,
      lastPing: new Date(),
      lastPong: new Date(),
      pingLatency: 0,
      subscriptions: [],
      isAlive: true,
      missedPings: 0
    };

    this.clients.set(clientId, client);
    this.clientStats.set(clientId, stats);

    logger.connection('connected', clientId, { 
      totalClients: this.clients.size,
      connectedAt: connectedAt.toISOString()
    });

    return client;
  }

  // クライアント切断処理
  public removeClient(clientId: string): boolean {
    const existed = this.clients.has(clientId);
    
    this.clients.delete(clientId);
    this.clientStats.delete(clientId);

    if (existed) {
      logger.connection('disconnected', clientId, { 
        totalClients: this.clients.size
      });
    }

    return existed;
  }

  // クライアント取得
  public getClient(clientId: string): WSClient | undefined {
    return this.clients.get(clientId);
  }

  // 全クライアント取得
  public getAllClients(): WSClient[] {
    return Array.from(this.clients.values());
  }

  // クライアント統計情報取得
  public getClientStats(clientId: string): ClientStats | undefined {
    return this.clientStats.get(clientId);
  }

  // 全クライアント統計情報取得
  public getAllClientStats(): ClientStats[] {
    return Array.from(this.clientStats.values());
  }

  // イベント購読
  public subscribeClient(clientId: string, eventType: string): boolean {
    const client = this.clients.get(clientId);
    const stats = this.clientStats.get(clientId);
    
    if (!client || !stats) {
      return false;
    }

    // 重複購読をチェック
    if (client.subscriptions.has(eventType)) {
      logger.debug('subscription', `Client already subscribed to event`, { eventType }, clientId);
      return false; // 既に購読済み（新規購読ではない）
    }

    client.subscriptions.add(eventType);
    stats.subscriptions = Array.from(client.subscriptions);

    logger.info('subscription', `Client subscribed to event`, { 
      eventType, 
      totalSubscriptions: client.subscriptions.size 
    }, clientId);
    return true;
  }

  // イベント購読解除
  public unsubscribeClient(clientId: string, eventType: string): boolean {
    const client = this.clients.get(clientId);
    const stats = this.clientStats.get(clientId);
    
    if (!client || !stats) {
      return false;
    }

    const wasSubscribed = client.subscriptions.delete(eventType);
    stats.subscriptions = Array.from(client.subscriptions);

    if (wasSubscribed) {
      logger.info('subscription', `Client unsubscribed from event`, { 
        eventType, 
        totalSubscriptions: client.subscriptions.size 
      }, clientId);
    }

    return wasSubscribed;
  }

  // メッセージ送信（安全な送信）
  public sendMessage(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('websocket', `Error sending message to client`, { error }, clientId);
      this.removeClient(clientId);
      return false;
    }
  }

  // ブロードキャスト（全クライアント）
  public broadcast(message: EventMessage): { sent: number; failed: number } {
    const messageStr = JSON.stringify(message);
    let sent = 0;
    let failed = 0;
    const failedClients: string[] = [];

    for (const client of this.clients.values()) {
      try {
        client.ws.send(messageStr);
        sent++;
      } catch (error) {
        logger.error('broadcast', `Error broadcasting to client`, { error }, client.id);
        failedClients.push(client.id);
        failed++;
      }
    }

    // 失敗したクライアントを削除
    failedClients.forEach(clientId => this.removeClient(clientId));

    logger.info('broadcast', `Broadcasted event to clients`, { 
      event: message.event, 
      sent, 
      failed 
    });
    return { sent, failed };
  }

  // 購読者にのみブロードキャスト
  public broadcastToSubscribers(message: EventMessage): { sent: number; failed: number; skipped: number } {
    const messageStr = JSON.stringify(message);
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const failedClients: string[] = [];

    for (const client of this.clients.values()) {
      // 購読チェック
      if (!client.subscriptions.has(message.event) && !client.subscriptions.has("*")) {
        skipped++;
        continue;
      }

      try {
        client.ws.send(messageStr);
        sent++;
      } catch (error) {
        logger.error('broadcast', `Error broadcasting to subscriber`, { error }, client.id);
        failedClients.push(client.id);
        failed++;
      }
    }

    // 失敗したクライアントを削除
    failedClients.forEach(clientId => this.removeClient(clientId));

    logger.info('broadcast', `Broadcasted event to subscribers`, { 
      event: message.event, 
      sent, 
      failed, 
      skipped 
    });
    return { sent, failed, skipped };
  }

  // ハートビート開始
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.config.heartbeatInterval);

    logger.info('heartbeat', `Heartbeat started`, { 
      interval: this.config.heartbeatInterval 
    });
  }

  // ハートビート停止
  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      logger.info('heartbeat', `Heartbeat stopped`);
    }
  }

  // ハートビート実行
  private performHeartbeat(): void {
    const now = new Date();
    const deadClients: string[] = [];

    logger.debug('heartbeat', `Performing heartbeat check`, { 
      clientCount: this.clients.size 
    });

    for (const [clientId, stats] of this.clientStats.entries()) {
      const client = this.clients.get(clientId);
      if (!client) {
        deadClients.push(clientId);
        continue;
      }

      // 最後のpongからの経過時間をチェック
      const timeSinceLastPong = now.getTime() - stats.lastPong.getTime();
      
      if (timeSinceLastPong > this.config.clientTimeout) {
        logger.heartbeat('timeout', clientId, { 
          timeSinceLastPong, 
          timeout: this.config.clientTimeout 
        });
        deadClients.push(clientId);
        continue;
      }

      // pingを送信
      const pingSuccess = this.sendPing(clientId);
      if (!pingSuccess) {
        deadClients.push(clientId);
      }
    }

    // 死んだクライアントを削除
    deadClients.forEach(clientId => {
      logger.connection('timeout', clientId, { reason: 'heartbeat_timeout' });
      this.removeClient(clientId);
    });

    if (deadClients.length > 0) {
      logger.info('heartbeat', `Heartbeat completed`, { 
        removedClients: deadClients.length 
      });
    }
  }

  // Ping送信
  private sendPing(clientId: string): boolean {
    const stats = this.clientStats.get(clientId);
    if (!stats) {
      return false;
    }

    const pingMessage: WebSocketMessage = {
      type: "ping",
      timestamp: Date.now(),
    };

    stats.lastPing = new Date();
    const success = this.sendMessage(clientId, pingMessage);
    
    if (!success) {
      stats.missedPings++;
    }

    return success;
  }

  // Pong受信処理
  public handlePong(clientId: string, timestamp?: number): void {
    const stats = this.clientStats.get(clientId);
    if (!stats) {
      return;
    }

    const now = new Date();
    stats.lastPong = now;
    stats.isAlive = true;
    stats.missedPings = 0;

    // レイテンシ計算
    if (timestamp) {
      stats.pingLatency = now.getTime() - timestamp;
    } else {
      stats.pingLatency = now.getTime() - stats.lastPing.getTime();
    }

    logger.heartbeat('pong', clientId, { 
      latency: stats.pingLatency 
    });
  }

  // 接続統計情報
  public getConnectionStats() {
    const stats = this.getAllClientStats();
    
    return {
      totalClients: this.clients.size,
      aliveClients: stats.filter(s => s.isAlive).length,
      avgLatency: stats.length > 0 ? 
        stats.reduce((sum, s) => sum + s.pingLatency, 0) / stats.length : 0,
      oldestConnection: stats.length > 0 ? 
        Math.min(...stats.map(s => s.connectedAt.getTime())) : null,
      totalSubscriptions: stats.reduce((sum, s) => sum + s.subscriptions.length, 0),
      config: this.config
    };
  }

  // クリーンアップ
  public cleanup(): void {
    logger.info('connection', `Cleaning up ConnectionManager`, { 
      clientCount: this.clients.size 
    });
    
    this.stopHeartbeat();
    
    // 全クライアントに切断通知を送信
    const disconnectMessage: EventMessage = {
      type: "event",
      event: "server.shutdown",
      data: { reason: "Server is shutting down" },
      timestamp: Date.now(),
    };

    this.broadcast(disconnectMessage);

    // 全クライアントを削除
    this.clients.clear();
    this.clientStats.clear();

    logger.info('connection', `ConnectionManager cleanup completed`);
  }
}