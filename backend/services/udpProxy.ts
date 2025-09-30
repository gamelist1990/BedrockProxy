import { createSocket, Socket } from "dgram";
import { logger } from "./logger.js";
import type { PlayerPacket, PlayerAction } from "../types/index.js";

export interface UDPProxyConfig {
  listenPort: number;
  targetHost: string;
  targetPort: number;
  timeout: number;
}

export interface ProxyConnection {
  clientAddress: string;
  clientPort: number;
  targetSocket: Socket;
  lastActivity: Date;
}

export class UDPProxy {
  private server: Socket;
  private connections = new Map<string, ProxyConnection>();
  private config: UDPProxyConfig;
  private isRunning = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // イベントハンドラー
  private onPlayerAction?: (packet: PlayerPacket) => void;
  private onConnectionActivity?: (clientIP: string, clientPort: number, data: Buffer) => void;

  constructor(config: UDPProxyConfig) {
    this.config = config;
    this.server = createSocket('udp4');
    this.setupServerEvents();
  }

  private setupServerEvents(): void {
    this.server.on('message', (data, rinfo) => {
      this.handleClientMessage(data, rinfo.address, rinfo.port);
    });

    this.server.on('error', (error) => {
      logger.error('udp-proxy', 'Server error', { error: error.message });
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      logger.info('udp-proxy', 'UDP Proxy listening', {
        address: address?.address,
        port: address?.port,
        target: `${this.config.targetHost}:${this.config.targetPort}`
      });
    });
  }

  private handleClientMessage(data: Buffer, clientAddress: string, clientPort: number): void {
    const connectionKey = `${clientAddress}:${clientPort}`;
    
    // 接続アクティビティを記録
    if (this.onConnectionActivity) {
      this.onConnectionActivity(clientAddress, clientPort, data);
    }

    let connection = this.connections.get(connectionKey);
    
    if (!connection) {
      // 新しい接続を作成
      connection = this.createConnection(clientAddress, clientPort);
      this.connections.set(connectionKey, connection);
      
      logger.debug('udp-proxy', 'New connection established', {
        client: connectionKey,
        target: `${this.config.targetHost}:${this.config.targetPort}`
      });
    }

    // 最終アクティビティ時間を更新
    connection.lastActivity = new Date();

    // メッセージを転送
    connection.targetSocket.send(data, this.config.targetPort, this.config.targetHost, (error) => {
      if (error) {
        logger.error('udp-proxy', 'Failed to forward message to target', {
          client: connectionKey,
          error: error.message
        });
      }
    });
  }

  private createConnection(clientAddress: string, clientPort: number): ProxyConnection {
    const targetSocket = createSocket('udp4');
    
    // ターゲットからのレスポンスを処理
    targetSocket.on('message', (data) => {
      this.server.send(data, clientPort, clientAddress, (error) => {
        if (error) {
          logger.error('udp-proxy', 'Failed to send response to client', {
            client: `${clientAddress}:${clientPort}`,
            error: error.message
          });
        }
      });
    });

    targetSocket.on('error', (error) => {
      logger.error('udp-proxy', 'Target socket error', {
        client: `${clientAddress}:${clientPort}`,
        error: error.message
      });
    });

    return {
      clientAddress,
      clientPort,
      targetSocket,
      lastActivity: new Date()
    };
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        resolve();
        return;
      }

      this.server.on('error', (error) => {
        reject(error);
      });

      this.server.bind(this.config.listenPort, () => {
        this.isRunning = true;
        this.startCleanupTimer();
        
        logger.info('udp-proxy', 'UDP Proxy started', {
          listenPort: this.config.listenPort,
          target: `${this.config.targetHost}:${this.config.targetPort}`
        });
        
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isRunning) {
        resolve();
        return;
      }

      // クリーンアップタイマーを停止
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // すべての接続を閉じる
      this.connections.forEach((connection, key) => {
        connection.targetSocket.close();
        logger.debug('udp-proxy', 'Connection closed', { client: key });
      });
      
      this.connections.clear();

      // サーバーを閉じる
      this.server.close(() => {
        this.isRunning = false;
        logger.info('udp-proxy', 'UDP Proxy stopped');
        resolve();
      });
    });
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 30000); // 30秒間隔
  }

  private cleanupStaleConnections(): void {
    const now = new Date();
    const staleConnections: string[] = [];

    this.connections.forEach((connection, key) => {
      const timeSinceLastActivity = now.getTime() - connection.lastActivity.getTime();
      
      if (timeSinceLastActivity > this.config.timeout) {
        staleConnections.push(key);
        connection.targetSocket.close();
      }
    });

    staleConnections.forEach(key => {
      this.connections.delete(key);
      logger.debug('udp-proxy', 'Stale connection cleaned up', { client: key });
    });

    if (staleConnections.length > 0) {
      logger.info('udp-proxy', 'Cleanup completed', {
        cleanedConnections: staleConnections.length,
        activeConnections: this.connections.size
      });
    }
  }

  // プレイヤーアクションハンドラーを設定
  public setPlayerActionHandler(handler: (packet: PlayerPacket) => void): void {
    this.onPlayerAction = handler;
  }

  // 接続アクティビティハンドラーを設定
  public setConnectionActivityHandler(handler: (clientIP: string, clientPort: number, data: Buffer) => void): void {
    this.onConnectionActivity = handler;
  }

  // プレイヤーアクションを発火
  public emitPlayerAction(packet: PlayerPacket): void {
    if (this.onPlayerAction) {
      this.onPlayerAction(packet);
    }
  }

  // 統計情報を取得
  public getStats() {
    return {
      isRunning: this.isRunning,
      activeConnections: this.connections.size,
      config: this.config,
      connections: Array.from(this.connections.entries()).map(([key, conn]) => ({
        client: key,
        lastActivity: conn.lastActivity,
        timeSinceActivity: Date.now() - conn.lastActivity.getTime()
      }))
    };
  }

  // 設定を更新
  public updateConfig(newConfig: Partial<UDPProxyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('udp-proxy', 'Configuration updated', { config: this.config });
  }

  // 接続状態を確認
  public isActive(): boolean {
    return this.isRunning;
  }

  // 特定のクライアントをブロック
  public blockClient(clientAddress: string): void {
    const blockedConnections: string[] = [];
    
    this.connections.forEach((connection, key) => {
      if (connection.clientAddress === clientAddress) {
        connection.targetSocket.close();
        blockedConnections.push(key);
      }
    });

    blockedConnections.forEach(key => {
      this.connections.delete(key);
    });

    logger.info('udp-proxy', 'Client blocked', {
      clientAddress,
      blockedConnections: blockedConnections.length
    });
  }
}