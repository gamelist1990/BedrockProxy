import { createSocket, Socket } from "dgram";
import { logger } from "./logger.js";
import type { PlayerPacket, PlayerAction } from "../types/index.js";
import {
  isProxyProtocolV2,
  parseProxyProtocolV2,
  parseProxyProtocolChain,
  stripProxyProtocolV2Header,
  type ProxyProtocolV2Header,
  type ProxyProtocolChain
} from "./proxyProtocolParser.js";

export interface UDPProxyConfig {
  listenPort: number;
  targetHost: string;
  targetPort: number;
  timeout: number;
  proxyProtocolV2Enabled?: boolean; // Proxy Protocol v2サポートを有効化
}

export interface ProxyConnection {
  clientAddress: string;
  clientPort: number;
  targetSocket: Socket;
  lastActivity: Date;
  hasLoggedSuccess?: boolean;
  hasLoggedResponseSuccess?: boolean;
  realClientAddress?: string; // Proxy Protocol v2で解析された真のクライアントIP
  realClientPort?: number; // Proxy Protocol v2で解析された真のクライアントポート
}

export class UDPProxy {
  private server: Socket;
  private connections = new Map<string, ProxyConnection>();
  private realClientInfo = new Map<string, { address: string; port: number }>(); // clientAddressごとの真のIP情報
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

    // Proxy Protocol v2の解析（有効な場合）
    let proxyChain: ProxyProtocolChain | null = null;
    let actualData = data;
    let realClientAddress = clientAddress;
    let realClientPort = clientPort;

    if (this.config.proxyProtocolV2Enabled && isProxyProtocolV2(data)) {
      // 多段Proxy Protocolを解析
      proxyChain = parseProxyProtocolChain(data);
      
      if (proxyChain) {
        // 最も元のクライアント情報を使用
        realClientAddress = proxyChain.originalClientIP;
        realClientPort = proxyChain.originalClientPort;
        actualData = proxyChain.payload;

        // ペイロードが空の場合は接続情報を保存するだけで、接続は作成しない
        if (actualData.length === 0) {
          // clientAddressごとに真のIP情報を保存
          this.realClientInfo.set(clientAddress, {
            address: realClientAddress,
            port: realClientPort
          });
          
          logger.debug('udp-proxy', 'Proxy Protocol header-only packet, real client info saved', {
            clientAddress,
            realClient: `${realClientAddress}:${realClientPort}`
          });
          return; // 空ペイロードは転送しない
        }
      }
    }

    // ペイロードが空の場合は接続情報更新のみ(転送しない)
    if (actualData.length === 0) {
      return;
    }

    // 接続アクティビティを記録（真のクライアントアドレスを使用）
    if (this.onConnectionActivity) {
      this.onConnectionActivity(realClientAddress, realClientPort, actualData);
    }

    let connection = this.connections.get(connectionKey);
    
    if (!connection) {
      // 新しい接続を作成
      connection = this.createConnection(clientAddress, clientPort);
      
      // Proxy Protocol v2で真のIPが検出されていない場合、
      // realClientInfoマップから情報を取得
      if (realClientAddress === clientAddress && realClientPort === clientPort) {
        const savedInfo = this.realClientInfo.get(clientAddress);
        if (savedInfo) {
          realClientAddress = savedInfo.address;
          realClientPort = savedInfo.port;
          logger.debug('udp-proxy', 'Using saved real client info', {
            client: connectionKey,
            realClient: `${realClientAddress}:${realClientPort}`
          });
        }
      }
      
      connection.realClientAddress = realClientAddress;
      connection.realClientPort = realClientPort;
      
      this.connections.set(connectionKey, connection);
      
      logger.info('udp-proxy', 'New connection established', {
        client: connectionKey,
        realClient: `${realClientAddress}:${realClientPort}`,
        target: `${this.config.targetHost}:${this.config.targetPort}`
      });
    }

    // 最終アクティビティ時間を更新
    connection.lastActivity = new Date();

    // メッセージを転送（元のペイロードのみ）
    connection.targetSocket.send(actualData, this.config.targetPort, this.config.targetHost, (error) => {
      if (error) {
        // Suppress noisy 'Socket is closed' messages; treat them as debug
        if (String(error.message).includes('Socket is closed') || String(error.message).includes('closed')) {
          logger.debug('udp-proxy', 'Failed to forward message to target (socket closed)', {
            client: connectionKey,
            error: error.message
          });
        } else {
          logger.error('udp-proxy', 'Failed to forward message to target', {
            client: connectionKey,
            error: error.message
          });
        }
      } else {
        // 転送成功時のログ（最初の転送時のみ）
        if (!connection.hasLoggedSuccess) {
          logger.info('udp-proxy', 'Message forwarded successfully', {
            client: connectionKey,
            target: `${this.config.targetHost}:${this.config.targetPort}`,
            size: data.length
          });
          connection.hasLoggedSuccess = true;
        }
      }
    });
  }

  private createConnection(clientAddress: string, clientPort: number): ProxyConnection {
    const targetSocket = createSocket('udp4');
    const connection: ProxyConnection = {
      clientAddress,
      clientPort,
      targetSocket,
      lastActivity: new Date()
    };
    
    // ターゲットからのレスポンスを処理
    targetSocket.on('message', (data) => {
      this.server.send(data, clientPort, clientAddress, (error) => {
        if (error) {
          if (String(error.message).includes('Socket is closed') || String(error.message).includes('closed')) {
            logger.debug('udp-proxy', 'Failed to send response to client (socket closed)', {
              client: `${clientAddress}:${clientPort}`,
              error: error.message
            });
          } else {
            logger.error('udp-proxy', 'Failed to send response to client', {
              client: `${clientAddress}:${clientPort}`,
              error: error.message
            });
          }
        } else {
          // レスポンス転送成功時のログ（最初のレスポンス時のみ）
          if (!connection.hasLoggedResponseSuccess) {
            logger.info('udp-proxy', 'Response forwarded to client', {
              client: `${clientAddress}:${clientPort}`,
              target: `${this.config.targetHost}:${this.config.targetPort}`,
              size: data.length
            });
            connection.hasLoggedResponseSuccess = true;
          }
        }
      });
    });

    targetSocket.on('error', (error) => {
      logger.error('udp-proxy', 'Target socket error', {
        client: `${clientAddress}:${clientPort}`,
        error: error.message
      });
    });

    return connection;
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
      this.realClientInfo.clear();

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