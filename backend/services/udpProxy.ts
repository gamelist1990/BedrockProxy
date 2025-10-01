import { createSocket, Socket } from "dgram";
import { logger } from "./logger.js";
import type { PlayerPacket, PlayerAction } from "../types/index.js";
import {
  isProxyProtocolV2,
  parseProxyProtocolV2,
  parseProxyProtocolChain,
  stripProxyProtocolV2Header,
  generateProxyProtocolV2Header,
  type ProxyProtocolV2Header,
  type ProxyProtocolChain
} from "./proxyProtocolParser.js";

export interface UDPProxyConfig {
  listenPort: number;
  targetHost: string;
  targetPort: number;
  timeout: number;
  proxyProtocolV2Enabled?: boolean; // Proxy Protocol v2サポートを有効化
  maxConnections?: number; // 最大接続数制限(デフォルト: 1000)
  rateLimit?: number; // クライアントごとの秒間パケット数制限(デフォルト: 100)
  socketReuseEnabled?: boolean; // ソケット再利用を有効化(デフォルト: true)
}

export interface ProxyConnection {
  clientAddress: string;
  clientPort: number;
  targetSocket: Socket;
  lastActivity: number; // Date型からnumber型(timestamp)に変更してメモリ効率化
  hasLoggedSuccess?: boolean;
  hasLoggedResponseSuccess?: boolean;
  realClientAddress?: string; // Proxy Protocol v2で解析された真のクライアントIP
  realClientPort?: number; // Proxy Protocol v2で解析された真のクライアントポート
  packetCount?: number; // レート制限用のパケット数カウンター
  lastReset?: number; // レート制限リセット時刻
}

export class UDPProxy {
  private server: Socket;
  private connections = new Map<string, ProxyConnection>();
  private realClientInfo = new Map<string, { address: string; port: number }>(); // clientAddressごとの真のIP情報
  private config: UDPProxyConfig;
  private isRunning = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private sharedSocket: Socket | null = null; // 再利用される共有ソケット
  private socketPool: Socket[] = []; // ソケットプール(高負荷時用)
  private poolIndex = 0; // ラウンドロビン用インデックス
  private readonly DEFAULT_MAX_CONNECTIONS = 1000;
  private readonly DEFAULT_RATE_LIMIT = 100; // 秒間パケット数
  private readonly SOCKET_POOL_SIZE = 10; // ソケットプールのサイズ

  // イベントハンドラー
  private onPlayerAction?: (packet: PlayerPacket) => void;
  private onConnectionActivity?: (clientIP: string, clientPort: number, data: Buffer) => void;

  constructor(config: UDPProxyConfig) {
    this.config = {
      maxConnections: this.DEFAULT_MAX_CONNECTIONS,
      rateLimit: this.DEFAULT_RATE_LIMIT,
      socketReuseEnabled: true,
      ...config
    };
    this.server = createSocket('udp4');
    // UDPソケットのバッファサイズを増やして高負荷に対応
    this.server.setRecvBufferSize(1024 * 1024 * 4); // 4MB
    this.server.setSendBufferSize(1024 * 1024 * 4); // 4MB
    this.setupServerEvents();
    this.initializeSocketPool();
  }

  private initializeSocketPool(): void {
    if (!this.config.socketReuseEnabled) return;

    // 共有ソケットを作成
    this.sharedSocket = createSocket('udp4');
    this.sharedSocket.setRecvBufferSize(1024 * 1024 * 2);
    this.sharedSocket.setSendBufferSize(1024 * 1024 * 2);
    
    // 高負荷用のソケットプールを作成
    for (let i = 0; i < this.SOCKET_POOL_SIZE; i++) {
      const socket = createSocket('udp4');
      socket.setRecvBufferSize(1024 * 1024);
      socket.setSendBufferSize(1024 * 1024);
      this.socketPool.push(socket);
    }

    logger.info('udp-proxy', 'Socket pool initialized', {
      poolSize: this.SOCKET_POOL_SIZE,
      reuseEnabled: true
    });
  }

  private setupServerEvents(): void {
    this.server.on('message', (data, rinfo) => {
      // 非同期処理で即座にリターンし、次のパケットを受信可能にする
      setImmediate(() => {
        this.handleClientMessage(data, rinfo.address, rinfo.port);
      });
    });

    this.server.on('error', (error) => {
      logger.error('udp-proxy', 'Server error', { error: error.message });
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      logger.info('udp-proxy', 'UDP Proxy listening', {
        address: address?.address,
        port: address?.port,
        target: `${this.config.targetHost}:${this.config.targetPort}`,
        maxConnections: this.config.maxConnections,
        rateLimit: this.config.rateLimit
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
    const now = Date.now();
    
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
      connection.packetCount = 0;
      connection.lastReset = now;
      
      this.connections.set(connectionKey, connection);
      
      logger.info('udp-proxy', 'New connection established', {
        client: connectionKey,
        realClient: `${realClientAddress}:${realClientPort}`,
        target: `${this.config.targetHost}:${this.config.targetPort}`,
        totalConnections: this.connections.size
      });
    }

    // レート制限チェック
    if (this.config.rateLimit && connection.packetCount !== undefined && connection.lastReset !== undefined) {
      const timeSinceReset = now - connection.lastReset;
      if (timeSinceReset >= 1000) {
        // 1秒経過したのでリセット
        connection.packetCount = 0;
        connection.lastReset = now;
      } else if (connection.packetCount >= this.config.rateLimit) {
        // レート制限超過
        logger.warn('udp-proxy', 'Rate limit exceeded, dropping packet', {
          client: connectionKey,
          packetCount: connection.packetCount,
          limit: this.config.rateLimit
        });
        return;
      }
      connection.packetCount++;
    }

    // 最終アクティビティ時間を更新
    connection.lastActivity = now;

    // メッセージを転送
    // 真のIPが取得できている場合は常にProxy Protocol v2ヘッダーを付加
    let dataToSend = actualData;
    if (realClientAddress !== clientAddress) {
      const proxyHeader = generateProxyProtocolV2Header(
        realClientAddress,
        realClientPort,
        this.config.targetHost,
        this.config.targetPort
      );
      dataToSend = Buffer.concat([proxyHeader, actualData]);
      
      logger.debug('udp-proxy', 'Added Proxy Protocol v2 header to outgoing packet', {
        realClient: `${realClientAddress}:${realClientPort}`,
        headerSize: proxyHeader.length,
        payloadSize: actualData.length
      });
    }

    connection.targetSocket.send(dataToSend, this.config.targetPort, this.config.targetHost, (error) => {
      if (error) {
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
        if (!connection.hasLoggedSuccess) {
          logger.info('udp-proxy', 'Message forwarded successfully', {
            client: connectionKey,
            realClient: `${realClientAddress}:${realClientPort}`,
            target: `${this.config.targetHost}:${this.config.targetPort}`,
            size: dataToSend.length
          });
          connection.hasLoggedSuccess = true;
        }
      }
    });
  }

  private createConnection(clientAddress: string, clientPort: number): ProxyConnection {
    // ソケット再利用が有効な場合は共有ソケットまたはプールから取得
    let targetSocket: Socket;
    if (this.config.socketReuseEnabled && this.connections.size < 50) {
      // 接続数が少ない場合は共有ソケットを使用
      targetSocket = this.sharedSocket!;
    } else if (this.config.socketReuseEnabled && this.socketPool.length > 0) {
      // ラウンドロビンでプールからソケットを取得
      targetSocket = this.socketPool[this.poolIndex];
      this.poolIndex = (this.poolIndex + 1) % this.socketPool.length;
    } else {
      // 新しいソケットを作成(フォールバック)
      targetSocket = createSocket('udp4');
    }

    const connection: ProxyConnection = {
      clientAddress,
      clientPort,
      targetSocket,
      lastActivity: Date.now()
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
        // ソケット再利用が無効な場合、または共有ソケット/プール以外の場合のみ閉じる
        if (!this.config.socketReuseEnabled || 
            (connection.targetSocket !== this.sharedSocket && 
             !this.socketPool.includes(connection.targetSocket))) {
          try {
            connection.targetSocket.close();
          } catch (e) {
            // エラーを無視
          }
        }
        logger.debug('udp-proxy', 'Connection closed', { client: key });
      });
      
      // 共有ソケットとプールをクリーンアップ
      if (this.sharedSocket) {
        try {
          this.sharedSocket.close();
        } catch (e) {}
        this.sharedSocket = null;
      }
      
      this.socketPool.forEach(socket => {
        try {
          socket.close();
        } catch (e) {}
      });
      this.socketPool = [];
      
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
    const now = Date.now();
    const staleConnections: string[] = [];

    this.connections.forEach((connection, key) => {
      const timeSinceLastActivity = now - connection.lastActivity;
      
      if (timeSinceLastActivity > this.config.timeout) {
        staleConnections.push(key);
        // ソケット再利用が有効な場合は、共有ソケットやプールのソケットは閉じない
        if (!this.config.socketReuseEnabled || 
            (connection.targetSocket !== this.sharedSocket && 
             !this.socketPool.includes(connection.targetSocket))) {
          try {
            connection.targetSocket.close();
          } catch (e) {
            // ソケットが既に閉じている場合のエラーを無視
          }
        }
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
        lastActivity: new Date(conn.lastActivity),
        timeSinceActivity: Date.now() - conn.lastActivity,
        packetCount: conn.packetCount || 0,
        realClient: conn.realClientAddress ? `${conn.realClientAddress}:${conn.realClientPort}` : undefined
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

  // 真のクライアント情報を取得(プラグインAPI用)
  public getRealClientInfo(localAddress: string, localPort: number): { realIP: string; realPort: number } | null {
    const connectionKey = `${localAddress}:${localPort}`;
    const connection = this.connections.get(connectionKey);
    if (connection?.realClientAddress && connection.realClientPort) {
      return { realIP: connection.realClientAddress, realPort: connection.realClientPort };
    }
    const savedInfo = this.realClientInfo.get(localAddress);
    if (savedInfo) {
      return { realIP: savedInfo.address, realPort: savedInfo.port };
    }
    return null;
  }
}

