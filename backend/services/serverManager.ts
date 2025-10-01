import { randomUUID } from "crypto";
import * as path from "path";
import { access, readFile, writeFile } from "fs/promises";
import type { 
  Server, 
  ServerStatus, 
  Player, 
  ServerAPI,
  Events,
  PlayerPacket
} from "../types/index.js";
import { APIError } from "../types/index.js";
import { dataStorage } from "./dataStorage.js";
import { minecraftServerDetector, type DetectedServerInfo } from "./minecraftServerDetector.js";
import { processManager } from "./processManager.js";
import { UDPProxy } from "./udpProxy.js";
import { logger, LogLevel } from "./logger.js";
import { PluginLoader } from "./pluginLoader.js";

export class ServerManager {
  private servers = new Map<string, Server>();
  private eventCallbacks = new Map<string, Function[]>();
  private udpProxies = new Map<string, UDPProxy>();
  private pluginLoaders = new Map<string, PluginLoader>(); // serverId -> PluginLoader
  // serverId -> (clientKey -> { client, lastActivity })
  private recentClientActivity = new Map<string, Map<string, { client: string; lastActivity: Date }>>();
  private initPromise: Promise<void> = Promise.resolve();

  constructor() {
    // 初期化を開始して完了を待てるように Promise を保持
    this.initPromise = this.initializeData();
    // プロセスマネージャーのイベントハンドラーを設定
    this.setupProcessManagerEvents();
  }

  // データの初期化
  private async initializeData(): Promise<void> {
    try {
      await dataStorage.initialize();
      const servers = await dataStorage.loadServers();
      
      // メモリ上のマップに復元
      servers.forEach(server => {
        this.servers.set(server.id, server);
      });
      
      console.log(`📦 Loaded ${servers.length} servers from persistent storage`);
    } catch (error) {
      console.error("❌ Failed to initialize data:", error);
      // フォールバック: デモデータを読み込み
      this.loadInitialData();
    }
  }

  // イベントリスナーを追加
  public on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  // イベントを発火
  private emit(event: string, data: any): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event callback for ${event}:`, error);
        }
      });
    }
  }

  // プレイヤーイベントハンドラー
  private handlePlayerJoined(serverId: string, player: PlayerPacket): void {
    const server = this.servers.get(serverId);
    if (!server || !server.players) return;
    
    // プレイヤーをサーバーのプレイヤーリストに追加
    const existingPlayer = server.players.find(p => p.xuid === player.xuid || p.name === player.name);
    if (!existingPlayer) {
      const newPlayer: Player = {
        id: player.xuid || randomUUID(),
        name: player.name,
        xuid: player.xuid,
        joinTime: player.timestamp ? new Date(player.timestamp) : new Date(),
        ipAddress: player.ipAddress,
        port: (player as any).port
      };

      // Log inference detail for debugging
      try {
        if (player.ipAddress) {
          logger.info('ServerManager', `Inferred IP for join: ${player.name}`, { serverId, playerName: player.name, ipAddress: player.ipAddress, port: (player as any).port, xuid: player.xuid, timestamp: new Date().toISOString() });
        } else {
          logger.info('ServerManager', `No IP inferred at join for: ${player.name}`, { serverId, playerName: player.name, xuid: player.xuid, timestamp: new Date().toISOString() });
        }
      } catch (e) {
        // ignore logging failures
      }

      server.players.push(newPlayer);
      server.playersOnline = server.players.length;
      server.updatedAt = new Date();
      this.servers.set(serverId, server);
      
      // イベントを発行
      const joinData = {
        serverId,
        player: newPlayer,
        currentPlayerCount: server.playersOnline
      };
      this.emit('playerJoined', joinData);
      
      // プラグインにイベントを転送
      this.triggerPluginEvent(serverId, 'playerJoin', joinData);
      
      logger.info('ServerManager', `Player joined: ${player.name}`, { serverId, playerName: player.name, xuid: player.xuid, ipAddress: player.ipAddress, port: (player as any).port });
    }
  }
  
  private handlePlayerLeft(serverId: string, player: PlayerPacket): void {
    const server = this.servers.get(serverId);
    if (!server || !server.players) return;
    
    // プレイヤーをサーバーのプレイヤーリストから削除
    const playerIndex = server.players.findIndex(p => p.xuid === player.xuid);
    if (playerIndex !== -1) {
      const leftPlayer = server.players[playerIndex];
      leftPlayer.leaveTime = new Date();
      
      server.players.splice(playerIndex, 1);
      server.playersOnline = server.players.length;
      server.updatedAt = new Date();
      this.servers.set(serverId, server);
      
      // イベントを発行
      const leftData = {
        serverId,
        player: leftPlayer,
        currentPlayerCount: server.playersOnline
      };
      this.emit('playerLeft', leftData);
      
      // プラグインにイベントを転送
      this.triggerPluginEvent(serverId, 'playerLeave', leftData);
      
      logger.info('ServerManager', `Player left: ${player.name}`, { serverId, playerName: player.name });
    }
  }

  // サーバー一覧を取得
  public getServers(): Server[] {
    return Array.from(this.servers.values()).sort((a, b) => 
      a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  // 特定のサーバーを取得
  public getServer(id: string): Server | null {
    return this.servers.get(id) || null;
  }

  // 特定のサーバーのUDPプロキシを取得 (プラグインAPI用)
  public getUdpProxy(id: string): UDPProxy | null {
    return this.udpProxies.get(id) || null;
  }

  // サーバーを追加
  public async addServer(request: ServerAPI.AddServerRequest): Promise<Server> {
    // バリデーション
    this.validateServerRequest(request);

    // 重複チェック
    const existingServer = Array.from(this.servers.values()).find(
      server => server.address === request.address
    );
    
    if (existingServer) {
      throw new APIError(
        `Server with address ${request.address} already exists`,
        "DUPLICATE_ADDRESS",
        400
      );
    }

    const now = new Date();
    const server: Server = {
      id: randomUUID(),
      name: request.name,
      address: request.address,
      destinationAddress: request.destinationAddress,
      status: "offline",
      mode: request.mode || "normal", // デフォルトはnormal
      playersOnline: 0,
      maxPlayers: request.maxPlayers,
      iconUrl: request.iconUrl,
      tags: request.tags || [],
      autoRestart: request.autoRestart || false,
      blockSameIP: request.blockSameIP || false,
      forwardAddress: request.forwardAddress,
      pluginsEnabled: request.pluginsEnabled || false,
      plugins: {}, // プラグイン設定を初期化
      description: request.description,
      executablePath: request.executablePath,
      serverDirectory: request.serverDirectory,
      players: [],
      udpConnections: [], // Proxy Onlyモード用
      createdAt: now,
      updatedAt: now,
    };

    this.servers.set(server.id, server);

    // データを永続化
    await this.saveServersToStorage();

    // イベント発火
    this.emit("serverCreated", {
      server
    } as Events.ServerCreated);

    console.log(`✅ Server created: ${server.name} (${server.id})`);
    return server;
  }

  // データストレージへの保存
  private async saveServersToStorage(): Promise<void> {
    try {
      const serversList = Array.from(this.servers.values());
      await dataStorage.saveServers(serversList);
    } catch (error) {
      console.error("❌ Failed to save servers to storage:", error);
    }
  }

  // データストレージへの保存 (public wrapper)
  public async saveServers(): Promise<void> {
    await this.saveServersToStorage();
  }

  // サーバーを更新
  public async updateServer(request: ServerAPI.UpdateServerRequest): Promise<Server> {
    const server = this.servers.get(request.id);
    if (!server) {
      throw new APIError(
        `Server with id ${request.id} not found`,
        "SERVER_NOT_FOUND",
        404
      );
    }

    // 更新前の状態を保存
    const oldServer = { ...server };
    const changes: string[] = [];

    // 更新を適用
    Object.entries(request.updates).forEach(([key, value]) => {
      if (key in server && (server as any)[key] !== value) {
        changes.push(key);
        (server as any)[key] = value;
      }
    });

    server.updatedAt = new Date();
    this.servers.set(server.id, server);

    // データを永続化
    if (changes.length > 0) {
      await this.saveServersToStorage();
      
      this.emit("serverUpdated", {
        server,
        changes
      } as Events.ServerUpdated);

      console.log(`🔄 Server updated: ${server.name} (${changes.join(', ')})`);

      // 非同期で server.properties を更新（存在すれば）
      (async () => {
        try {
          await this.updateServerProperties(server, changes);
        } catch (err) {
          console.warn(`⚠️ Failed to update server.properties for ${server.name}:`, err);
        }
      })();
    }

    return server;
  }

  // サーバーを削除
  public async deleteServer(id: string): Promise<boolean> {
    const server = this.servers.get(id);
    if (!server) {
      throw new APIError(
        `Server with id ${id} not found`,
        "SERVER_NOT_FOUND",
        404
      );
    }

    // アクティブなサーバーは先に停止を試みる（強制停止）
    if (server.status === "online" || server.status === "starting" || server.status === "stopping") {
      try {
        await this.stopServer(server, true);
      } catch (stopErr) {
        console.warn(`⚠️ Failed to cleanly stop server ${server.name} before delete:`, stopErr);
        // 強制クリーンアップ: UDPProxy とプロセス情報を削除して続行
        const udpProxy = this.udpProxies.get(id);
        if (udpProxy) {
          try { await udpProxy.stop(); } catch (e) { /* ignore */ }
          this.udpProxies.delete(id);
        }
        try { processManager.cleanupProcess(id); } catch (e) { /* ignore */ }
      }
    }

    // 追加のクリーンアップ（念のため）

    const udpProxy = this.udpProxies.get(id);
    if (udpProxy) {
      try { await udpProxy.stop(); } catch (e) { /* ignore */ }
      this.udpProxies.delete(id);
    }

    // プロセスマネージャーのリソースも強制クリーン
    try { processManager.cleanupProcess(id); } catch (e) { /* ignore */ }

    this.servers.delete(id);

    // データを永続化
    await this.saveServersToStorage();

    // イベント発火
    this.emit("serverDeleted", {
      serverId: id,
      serverName: server.name
    } as Events.ServerDeleted);

    console.log(`🗑️  Server deleted: ${server.name} (${id})`);
    return true;
  }

  // サーバー操作（開始/停止/再起動）
  public async performServerAction(request: ServerAPI.ServerActionRequest): Promise<Server> {
    const server = this.servers.get(request.id);
    if (!server) {
      throw new APIError(
        `Server with id ${request.id} not found`,
        "SERVER_NOT_FOUND",
        404
      );
    }

    const oldStatus = server.status;
    
    switch (request.action) {
      case "start":
        try {
          await this.startServer(server);
        } catch (err: any) {
          if (err && err.code === 'EXECUTABLE_PATH_MISSING' && server.destinationAddress && server.address) {
            const [, bindPort] = server.address.split(':');
            const [destIP, destPort] = server.destinationAddress.split(':');
            const udpProxy = new UDPProxy({
              listenPort: parseInt(bindPort),
              targetHost: destIP,
              targetPort: parseInt(destPort),
              timeout: 30000,
              proxyProtocolV2Enabled: server.proxyProtocolV2Enabled ?? false
            });
            udpProxy.setConnectionActivityHandler((clientIP, clientPort /*, data */) => {
              try {
                const key = `${clientIP}:${clientPort}`;
                let map = this.recentClientActivity.get(server.id);
                if (!map) {
                  map = new Map();
                  this.recentClientActivity.set(server.id, map);
                }
                map.set(key, { client: key, lastActivity: new Date() });
              } catch (e) {
                // ignore
              }
            });
            
            // ネットワーク統計ハンドラーを設定
            udpProxy.setNetworkStatsHandler((networkStats, clientStats) => {
              this.emit('networkStats', {
                serverId: server.id,
                networkStats,
                clientStats
              });
            });
            
            await udpProxy.start();
            this.udpProxies.set(server.id, udpProxy);

            // exe が設定されている場合は、プロキシ専用でもローカルのプロセスを起動してログを流す試みを行う
            if (server.executablePath) {
              try {
                server.status = 'starting';
                server.updatedAt = new Date();
                this.servers.set(server.id, server);
                await this.saveServersToStorage();

                await processManager.startProcess(server.id, server.executablePath);
                console.log(`✅ Started local process for ${server.name} to stream logs`);
                // processManager のイベントで状態更新される
              } catch (procErr) {
                console.warn(`⚠️ Failed to start process for ${server.name}:`, procErr);
                server.status = 'online';
                server.updatedAt = new Date();
                this.servers.set(server.id, server);
                await this.saveServersToStorage();
              }
            } else {
              server.status = 'online';
              server.updatedAt = new Date();
              this.servers.set(server.id, server);
              await this.saveServersToStorage();
            }

            console.log(`✅ Proxy server started: ${server.name}`);
            break;
          }

          throw err;
        }
        break;
      case "stop":
        await this.stopServer(server);
        break;
      case "restart":
        await this.restartServer(server);
        break;
      
      default:
        throw new APIError(
          `Unknown action: ${request.action}`,
          "INVALID_ACTION",
          400
        );
    }

    // ステータスが変更された場合はイベント発火
    if (oldStatus !== server.status) {
      this.emit("serverStatusChanged", {
        serverId: server.id,
        oldStatus,
        newStatus: server.status,
        server
      } as Events.ServerStatusChanged);
    }

    return server;
  }

  // プロセスマネージャーのイベントハンドラーを設定
  private setupProcessManagerEvents(): void {
    processManager.on('processStatusChanged', (data: any) => {
      const server = this.servers.get(data.serverId);
      if (!server) return;

      const oldStatus = server.status;

      // プロセス状態をサーバー状態にマッピング
      switch (data.status) {
        case 'starting':
          server.status = 'starting';
          break;
        case 'running':
          server.status = 'online';
          // サーバーがオンラインになったら、有効化されているプラグインを自動起動
          this.autoEnablePluginsForServer(server.id).catch((err: Error) => {
            console.error(`❌ Failed to auto-enable plugins for ${server.id}:`, err);
          });
          break;
        case 'stopping':
          server.status = 'stopping';
          break;
        case 'stopped':
          server.status = 'offline';
          server.playersOnline = 0;
          server.players = [];
          break;
        case 'error':
          server.status = 'error';
          break;
      }

      // lastExit 情報を保存（存在すれば）
      if (typeof data.exitCode !== 'undefined' || typeof data.signal !== 'undefined') {
        (server as any).lastExit = {
          code: data.exitCode ?? null,
          signal: data.signal ?? null,
          time: new Date()
        };
      }

      server.updatedAt = new Date();
      this.servers.set(server.id, server);

      // コンソールにも人間向けのイベントを流す（クライアントのコンソールに表示される）
      try {
        const lines: { text: string; type: 'stdout' | 'stderr' }[] = [];

        if (data.status === 'starting') {
          lines.push({ text: `Process is starting...`, type: 'stdout' });
        }
        if (data.status === 'running') {
          lines.push({ text: `Process started (pid: ${data.pid ?? 'unknown'})`, type: 'stdout' });
        }
        if (data.status === 'stopping') {
          lines.push({ text: `Process is stopping...`, type: 'stdout' });
        }
        if (data.status === 'stopped') {
          const code = (data.exitCode ?? null);
          lines.push({ text: `Process exited${code !== null ? ` with code ${code}` : ''}${data.signal ? ` (signal: ${data.signal})` : ''}.`, type: 'stderr' });
        }
        if (data.status === 'error') {
          lines.push({ text: `Process error occurred: ${data.error ?? 'unknown error'}`, type: 'stderr' });
        }

        lines.forEach(l => {
          this.emit('consoleOutput', {
            serverId: server.id,
            line: `[${new Date().toLocaleTimeString()}] ${l.text}`,
            timestamp: new Date(),
            type: l.type
          });
        });
      } catch (e) {
        // noop
      }

      // ステータス変更イベントを発火
      if (oldStatus !== server.status) {
        this.emit("serverStatusChanged", {
          serverId: server.id,
          oldStatus,
          newStatus: server.status,
          server
        } as Events.ServerStatusChanged);
      }
    });

  processManager.on('consoleOutput', (data: any) => {
      // コンソール出力イベントをそのまま転送
      this.emit('consoleOutput', data);

      // プレイヤー接続/切断の検出 (processManagerの出力から)
      try {
        const rawLine = typeof data.line === 'string' ? data.line.replace(/^\[[\d:]+\]\s*/, '') : '';
        const connectMatch = rawLine.match(/Player connected: (.+), xuid: (\d+)/);
        if (connectMatch) {
          const [, playerName, xuid] = connectMatch;
          // Determine reference time: prefer data.timestamp but fallback to now if it seems skewed
          let refTime: Date | undefined = data.timestamp ? new Date(data.timestamp) : undefined;
          if (refTime) {
            const skew = Math.abs(Date.now() - refTime.getTime());
            if (skew > 2 * 60 * 1000) { // >2 minutes skew
              try { logger.warn('ServerManager', 'Console timestamp skew detected, falling back to now', { serverId: data.serverId, providedTimestamp: refTime.toISOString(), skewMs: skew }); } catch (e) {}
              refTime = new Date();
            }
          }
          const conn = this.findRecentClientConnection(data.serverId, 10000, refTime);
          this.handlePlayerJoined(data.serverId, { name: playerName, xuid, action: 'join', timestamp: data.timestamp, ipAddress: conn?.ip, port: conn?.port } as PlayerPacket);
        }
        const disconnectMatch = rawLine.match(/Player disconnected: (.+), xuid: (\d+),/);
        if (disconnectMatch) {
          const [, playerName, xuid] = disconnectMatch;
          let refTimeL: Date | undefined = data.timestamp ? new Date(data.timestamp) : undefined;
          if (refTimeL) {
            const skew = Math.abs(Date.now() - refTimeL.getTime());
            if (skew > 2 * 60 * 1000) {
              try { logger.warn('ServerManager', 'Console timestamp skew detected (leave), falling back to now', { serverId: data.serverId, providedTimestamp: refTimeL.toISOString(), skewMs: skew }); } catch (e) {}
              refTimeL = new Date();
            }
          }
          const connL = this.findRecentClientConnection(data.serverId, 10000, refTimeL);
          this.handlePlayerLeft(data.serverId, { name: playerName, xuid, action: 'leave', timestamp: data.timestamp, ipAddress: connL?.ip, port: connL?.port } as PlayerPacket);
        }
      } catch (e) {
        // ignore
      }

      // サーバー側にも最新のスニペットを保存しておく（デバッグ用）
      const server = this.servers.get(data.serverId);
      if (server) {
        try {
          const snippet = processManager.getConsoleOutput(data.serverId, 50);
          (server as any).lastConsoleSnippet = snippet;
          this.servers.set(server.id, server);
        } catch (e) {
          // ignore
        }
      }
    });
  }

  // UDPProxy の統計を参照して、最近アクティブだったクライアントの IP を返す（ベストエフォート）
  private findRecentClientConnection(serverId: string, maxAgeMs: number = 10000, referenceTime?: Date): { ip: string; port?: number } | undefined {
    try {
      const refMs = referenceTime ? referenceTime.getTime() : Date.now();

      // First, check the in-memory recentClientActivity map populated by UDPProxy handlers
      const activityMap = this.recentClientActivity.get(serverId);
      let bestFromMap: { client: string; lastActivity: Date; delta: number } | null = null;
      if (activityMap && activityMap.size > 0) {
        for (const [client, info] of activityMap.entries()) {
          const delta = Math.abs(refMs - info.lastActivity.getTime());
          if (!bestFromMap || delta < bestFromMap.delta) {
            bestFromMap = { client: info.client, lastActivity: info.lastActivity, delta };
          }
        }

        // If we found a near candidate within threshold, return it
        if (bestFromMap && bestFromMap.delta <= maxAgeMs) {
          const parts = (bestFromMap.client || '').split(':');
          const ip = parts[0] || undefined;
          const port = parts.length > 1 ? parseInt(parts[1]) : undefined;
          return ip ? { ip, port } : undefined;
        }

        // Otherwise log debug info
        try {
          const debugEntries = Array.from(activityMap.entries()).map(([k, v]) => ({ client: k, lastActivity: v.lastActivity.toISOString(), deltaMs: Math.abs(refMs - v.lastActivity.getTime()) }));
          logger.warn('ServerManager', 'No UDP activity candidate within threshold (recentClientActivity)', { serverId, referenceTime: new Date(refMs).toISOString(), maxAgeMs, entries: debugEntries });
        } catch (e) {
          // ignore logging failures
        }
      }

      // Fallback: query UDPProxy.getStats() if available
      const udpProxy = this.udpProxies.get(serverId);
      if (!udpProxy) return undefined;

      const stats: any = (udpProxy as any).getStats ? (udpProxy as any).getStats() : null;
      if (!stats || !Array.isArray(stats.connections)) return undefined;

      let bestFromStats: { client: string; lastActivity: Date; delta: number } | null = null;
      for (const c of stats.connections) {
        const last = new Date(c.lastActivity);
        const delta = Math.abs(refMs - last.getTime());
        if (!bestFromStats || delta < bestFromStats.delta) {
          bestFromStats = { client: c.client, lastActivity: last, delta };
        }
      }

      if (bestFromStats && bestFromStats.delta <= maxAgeMs) {
        const parts = (bestFromStats.client || '').split(':');
        const ip = parts[0] || undefined;
        const port = parts.length > 1 ? parseInt(parts[1]) : undefined;
        return ip ? { ip, port } : undefined;
      }

      // Last-resort: if we have any candidate from the map, pick the most-recent one even if it exceeded threshold
      if (bestFromMap) {
        const parts = (bestFromMap.client || '').split(':');
        const ip = parts[0] || undefined;
        const port = parts.length > 1 ? parseInt(parts[1]) : undefined;
        logger.warn('ServerManager', 'No UDP activity within threshold, selecting most-recent entry from recentClientActivity as last-resort', { serverId, client: bestFromMap.client, deltaMs: bestFromMap.delta });
        return ip ? { ip, port } : undefined;
      }

      // Otherwise pick most recent from stats if present
      if (bestFromStats) {
        const parts = (bestFromStats.client || '').split(':');
        const ip = parts[0] || undefined;
        const port = parts.length > 1 ? parseInt(parts[1]) : undefined;
        logger.warn('ServerManager', 'No UDP activity within threshold, selecting most-recent entry from udpProxy.getStats() as last-resort', { serverId, client: bestFromStats.client, deltaMs: bestFromStats.delta });
        return ip ? { ip, port } : undefined;
      }

      logger.warn('ServerManager', 'No UDP activity candidates found at all', { serverId });
      return undefined;
    } catch (err) {
      // 予期せぬエラーは無視して undefined を返す
      return undefined;
    }
  }

  // server.properties を更新するヘルパー
  private async updateServerProperties(server: Server, changes: string[]): Promise<void> {
    // 必要な変更がなければ何もしない
    const relevant = changes.some(c => ['maxPlayers', 'name', 'destinationAddress'].includes(c));
    if (!relevant) return;

    if (!server.serverDirectory) return;

    const propsPath = `${server.serverDirectory}/server.properties`;
    try {
      // 既存ファイルを読み込み
      const content = await readFile(propsPath, 'utf-8');
      const lines = content.split(/\r?\n/);

      const updatedLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return line;
        const [key, ...rest] = line.split('=');
        const k = key.trim();

        if (k.toLowerCase() === 'max-players' && changes.includes('maxPlayers')) {
          return `max-players=${server.maxPlayers}`;
        }

        if (k.toLowerCase() === 'server-name' && changes.includes('name')) {
          // escape any equals in name
          const escaped = String(server.name).replace(/\r?\n/g, ' ');
          return `server-name=${escaped}`;
        }

        if ((k.toLowerCase() === 'server-port' || k.toLowerCase() === 'server-portv4') && changes.includes('destinationAddress')) {
          // destinationAddress is like ip:port
          const parts = String(server.destinationAddress || '').split(':');
          const port = parts.length > 1 ? parts[1] : parts[0] || '';
          return `${k}=${port}`;
        }

        return line;
      });

      // 書き込み（上書き）
      await writeFile(propsPath, updatedLines.join('\n'), 'utf-8');
      logger.info('ServerManager', `Updated server.properties for ${server.name}`, { path: propsPath, changes });
      // emit success event
      this.emit('serverPropertiesUpdated', { serverId: server.id, path: propsPath, changes });
    } catch (err) {
      // ファイルが存在しないか書き込み権限がない場合は警告を出すだけ
      logger.warn('ServerManager', `Could not update server.properties at ${propsPath}: ${err}`);
      this.emit('serverPropertiesUpdateFailed', { serverId: server.id, path: propsPath, error: String(err) });
    }
  }

  // サーバー開始
  private async startServer(server: Server): Promise<void> {
    if (server.status === "online") {
      throw new APIError("Server is already running", "SERVER_RUNNING", 400);
    }

    if (server.status === "starting") {
      throw new APIError("Server is already starting", "SERVER_STARTING", 400);
    }

    // 実行ファイルパスが設定されているかチェック
    if (!server.executablePath) {
      // serverDirectory が設定されている場合は、候補の実行ファイルを探して自動検出を試みる
      if (server.serverDirectory) {
        try {
          const possibleNames = [
            "bedrock_server.exe",
            "server.exe",
            "bedrock_server",
            "server"
          ];
          for (const name of possibleNames) {
            const candidate = path.join(server.serverDirectory, name);
            try {
              await access(candidate);
              server.executablePath = candidate;
              console.log(`🔎 Auto-detected executable for ${server.name}: ${candidate}`);
              break;
            } catch {
              // 存在しない場合は次へ
            }
          }
        } catch (err) {
          console.warn(`⚠️ Failed to search for executable in ${server.serverDirectory}:`, err);
        }
      }

      if (!server.executablePath) {
        throw new APIError(
          "Server executable path is not configured. Provide executablePath or set serverDirectory with a valid server executable.",
          "EXECUTABLE_PATH_MISSING",
          400
        );
      }
    }

    console.log(`🚀 Starting server: ${server.name}`);
    server.status = "starting";
    server.updatedAt = new Date();
    this.servers.set(server.id, server);
    
    // データを永続化
    await this.saveServersToStorage();

    try {
      // UDPProxyを作成・開始
      if (server.address && server.destinationAddress) {
        const [, bindPort] = server.address.split(':');
        const [destIP, destPort] = server.destinationAddress.split(':');

        const udpProxy = new UDPProxy({
          listenPort: parseInt(bindPort),
          targetHost: destIP,
          targetPort: parseInt(destPort),
          timeout: 30000,
          proxyProtocolV2Enabled: server.proxyProtocolV2Enabled ?? false
        });

        // Register connection activity handler to keep a lightweight recent-activity map
        udpProxy.setConnectionActivityHandler((clientIP, clientPort /*, data */) => {
          try {
            const key = `${clientIP}:${clientPort}`;
            let map = this.recentClientActivity.get(server.id);
            if (!map) {
              map = new Map();
              this.recentClientActivity.set(server.id, map);
            }
            map.set(key, { client: key, lastActivity: new Date() });
            try {
              logger.debug('ServerManager', 'Recorded UDP activity', { serverId: server.id, client: key, time: new Date().toISOString() });
            } catch (e) {
              // ignore logging errors
            }
          } catch (e) {
            // ignore
          }
        });

        // ネットワーク統計ハンドラーを設定
        udpProxy.setNetworkStatsHandler((networkStats, clientStats) => {
          this.emit('networkStats', {
            serverId: server.id,
            networkStats,
            clientStats
          });
        });

        await udpProxy.start();
        this.udpProxies.set(server.id, udpProxy);
      }

      // プロセスマネージャーでサーバープロセスを起動（一元管理）
      await processManager.startProcess(server.id, server.executablePath);
    } catch (error) {
      console.error(`❌ Failed to start server ${server.name}:`, error);
      
      // エラー時はクリーンアップ（minecraftServers が存在する場合のみ）
      if ((this as any).minecraftServers && typeof (this as any).minecraftServers.get === 'function') {
        const minecraftServer = (this as any).minecraftServers.get(server.id);
        if (minecraftServer) {
          await minecraftServer.stop();
          (this as any).minecraftServers.delete(server.id);
        }
      }
      
      const udpProxy = this.udpProxies.get(server.id);
      if (udpProxy) {
        await udpProxy.stop();
        this.udpProxies.delete(server.id);
      }
      
      server.status = "error";
      server.updatedAt = new Date();
      this.servers.set(server.id, server);
      await this.saveServersToStorage();
      throw error;
    }
  }

  // サーバー停止
  private async stopServer(server: Server, force: boolean = false): Promise<void> {
    if (server.status === "offline") {
      throw new APIError("Server is already stopped", "SERVER_STOPPED", 400);
    }

    if (server.status === "stopping") {
      throw new APIError("Server is already stopping", "SERVER_STOPPING", 400);
    }

    console.log(`🛑 Stopping server: ${server.name}`);
    server.status = "stopping";
    server.updatedAt = new Date();
    this.servers.set(server.id, server);
    
    // データを永続化
    await this.saveServersToStorage();

    // プレイヤーを全員切断の通知
    const connectedPlayers = server.players || [];
    connectedPlayers.forEach(player => {
      this.emit("playerLeft", {
        serverId: server.id,
        playerId: player.id,
        playerName: player.name,
        currentPlayerCount: 0
      } as Events.PlayerLeft);
    });

    try {
      // MinecraftServerManagerを停止

      // UDPProxyを停止
      const udpProxy = this.udpProxies.get(server.id);
      if (udpProxy) {
        try { await udpProxy.stop(); } catch (e) { console.warn(`⚠️ Failed to stop UDPProxy for ${server.name}:`, e); }
        this.udpProxies.delete(server.id);
        // clear recent client activity cache
        try { this.recentClientActivity.delete(server.id); } catch (e) { /* ignore */ }
      }

      // プロセスマネージャーでサーバープロセスを停止（存在しない場合は無視）
      try {
        await processManager.stopProcess(server.id, force);
      } catch (procErr: any) {
        if (procErr && (procErr.code === 'PROCESS_NOT_FOUND' || procErr.code === 'PROCESS_NOT_RUNNING')) {
          console.warn(`⚠️ No running process to stop for ${server.name}, continuing cleanup`);
        } else {
          throw procErr;
        }
      }

      // 最終的に状態を offline に更新（成功時）
      server.status = "offline";
      server.playersOnline = 0;
      server.players = [];
      server.updatedAt = new Date();
      this.servers.set(server.id, server);
      await this.saveServersToStorage();

    } catch (error) {
      console.error(`❌ Failed to stop server ${server.name}:`, error);
      // エラーが発生しても停止処理の副作用を残さないため、可能な限り offline にする
      try {
        server.status = "offline";
        server.playersOnline = 0;
        server.players = [];
        server.updatedAt = new Date();
        this.servers.set(server.id, server);
        await this.saveServersToStorage();
      } catch (e) {
        console.error(`❌ Failed to persist offline state for ${server.name}:`, e);
      }
      // rethrow original error so callers are aware
      throw error;
    }
  }

  // サーバー再起動
  private async restartServer(server: Server): Promise<void> {
    console.log(`🔄 Restarting server: ${server.name}`);
    
    if (!server.executablePath) {
      throw new APIError(
        "Server executable path is not configured", 
        "EXECUTABLE_PATH_MISSING", 
        400
      );
    }

    try {
      // プロセスマネージャーでサーバープロセスを再起動
      await processManager.restartProcess(server.id, server.executablePath);
    } catch (error) {
      console.error(`❌ Failed to restart server ${server.name}:`, error);
      server.status = "error";
      server.updatedAt = new Date();
      this.servers.set(server.id, server);
      await this.saveServersToStorage();
      throw error;
    }
  }

  

  // プレイヤー参加処理
  public addPlayer(serverId: string, playerName: string, ipAddress?: string): Player {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new APIError(`Server with id ${serverId} not found`, "SERVER_NOT_FOUND", 404);
    }

    if (server.status !== "online") {
      throw new APIError("Server is not online", "SERVER_OFFLINE", 400);
    }

    if (server.playersOnline >= server.maxPlayers) {
      throw new APIError("Server is full", "SERVER_FULL", 400);
    }

    // 同一IP接続ブロック確認
    if (server.blockSameIP && ipAddress) {
      const existingPlayer = (server.players || []).find(p => p.ipAddress === ipAddress);
      if (existingPlayer) {
        throw new APIError("Player from this IP is already connected", "IP_ALREADY_CONNECTED", 400);
      }
    }

    const player: Player = {
      id: randomUUID(),
      name: playerName,
      xuid: randomUUID(), // 仮のxuid、実際のxuidは後で更新
      joinTime: new Date(),
      ipAddress,
    };

    server.players = server.players || [];
    server.players.push(player);
    server.playersOnline = server.players.length;
    server.updatedAt = new Date();
    this.servers.set(serverId, server);

    // イベント発火
    this.emit("playerJoined", {
      serverId,
      player,
      currentPlayerCount: server.playersOnline
    } as Events.PlayerJoined);

    console.log(`👤 Player joined: ${playerName} -> ${server.name}`);
    return player;
  }

  // プレイヤー離脱処理
  public removePlayer(serverId: string, playerId: string): boolean {
    const server = this.servers.get(serverId);
    if (!server || !server.players) {
      return false;
    }

    const playerIndex = server.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return false;
    }

    const player = server.players[playerIndex];
    server.players.splice(playerIndex, 1);
    server.playersOnline = server.players.length;
    server.updatedAt = new Date();
    this.servers.set(serverId, server);

    // イベント発火
    this.emit("playerLeft", {
      serverId,
      playerId,
      playerName: player.name,
      currentPlayerCount: server.playersOnline
    } as Events.PlayerLeft);

    console.log(`👤 Player left: ${player.name} <- ${server.name}`);
    return true;
  }

  // プレイヤーキック
  public kickPlayer(serverId: string, playerId: string): boolean {
    // 実際の実装では、プロキシサーバーにキックコマンドを送信
    console.log(`👮 Kicking player ${playerId} from server ${serverId}`);
    return this.removePlayer(serverId, playerId);
  }

  // 初期データの読み込み（デモ用）
  private loadInitialData(): void {
    const demoServers: Omit<Server, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: "Lobby",
        address: "127.0.0.1:19132",
        destinationAddress: "192.168.1.10:19132",
        status: "online",
        playersOnline: 12,
        maxPlayers: 100,
        tags: ["Proxy", "入口"],
        autoRestart: true,
        blockSameIP: false,
        forwardAddress: "192.168.1.50:19132",
        description: "メインロビーサーバー",
        players: [],
      },
      {
        name: "Survival East",
        address: "10.0.0.45:19132",
        destinationAddress: "10.0.0.100:19133", 
        status: "starting",
        playersOnline: 3,
        maxPlayers: 50,
        iconUrl: "https://api.dicebear.com/8.x/shapes/svg?seed=survival",
        tags: ["Survival", "Whitelist"],
        autoRestart: false,
        blockSameIP: true,
        description: "サバイバルサーバー東館",
        players: [],
      },
      {
        name: "Creative",
        address: "10.0.0.76:19133",
        destinationAddress: "127.0.0.1:19134",
        status: "offline",
        playersOnline: 0,
        maxPlayers: 60,
        tags: ["Creative", "Sandbox"],
        autoRestart: true,
        blockSameIP: false,
        forwardAddress: "10.0.0.100:19133",
        description: "クリエイティブモードサーバー",
        players: [],
      },
    ];

    const now = new Date();
    demoServers.forEach(serverData => {
      const server: Server = {
        ...serverData,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      this.servers.set(server.id, server);
    });

    console.log(`📦 Loaded ${demoServers.length} demo servers`);
  }

  // バリデーション
  private validateServerRequest(request: ServerAPI.AddServerRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new APIError("Server name is required", "INVALID_NAME", 400);
    }

    if (!request.address || !this.isValidAddress(request.address)) {
      throw new APIError("Valid server address is required", "INVALID_ADDRESS", 400);
    }

    if (!request.destinationAddress || !this.isValidAddress(request.destinationAddress)) {
      throw new APIError("Valid destination address is required", "INVALID_DESTINATION", 400);
    }

    if (request.maxPlayers < 1 || request.maxPlayers > 1000) {
      throw new APIError("Max players must be between 1 and 1000", "INVALID_MAX_PLAYERS", 400);
    }

    // Proxy Onlyモードの場合はexecutablePathは不要
    if (request.mode !== "proxyOnly" && !request.executablePath) {
      console.warn("⚠️ Server added without executablePath (normal mode). Server process management may not work.");
    }
  }

  // Minecraftサーバーの自動検出
  public async detectMinecraftServer(executablePath: string): Promise<DetectedServerInfo> {
    return await minecraftServerDetector.detectServerConfig(executablePath);
  }

  // 検出された情報からサーバーを追加
  public async addServerFromDetection(
    detectedInfo: DetectedServerInfo, 
    customConfig?: Partial<ServerAPI.AddServerRequest>
  ): Promise<Server> {
    const recommendedConfig = minecraftServerDetector.generateRecommendedConfig(detectedInfo);
    
    const serverRequest: ServerAPI.AddServerRequest = {
      ...recommendedConfig,
      ...customConfig, // カスタム設定で上書き
      executablePath: detectedInfo.executablePath, // 実行ファイルパスを設定
      serverDirectory: detectedInfo.serverDirectory, // サーバーディレクトリを設定
    };

    return await this.addServer(serverRequest);
  }
  
  // サーバーコンソールログを取得
  public getServerConsoleOutput(serverId: string, lineCount?: number): string[] {
    try {
      const procInfo = processManager.getProcessInfo(serverId);
      const server = this.servers.get(serverId);

      // 実行中プロセスがあれば通常のバッファを返す
      if (procInfo && processManager.isProcessRunning(serverId)) {
        return processManager.getConsoleOutput(serverId, lineCount);
      }

      // Proxy Onlyモードの場合はUDPプロキシのログを表示
      if (server && server.mode === "proxyOnly") {
        const udpLogs = logger.getLogs({
          category: 'udp-proxy',
          limit: lineCount || 50
        });

        if (udpLogs.length > 0) {
          return udpLogs.map(log => {
            const time = log.timestamp.toLocaleTimeString();
            const level = LogLevel[log.level].toUpperCase();
            return `[${time}] [${level}] ${log.message}`;
          });
        } else {
          return ["Proxy active: waiting for connections..."];
        }
      }

      // プロセスが存在しない／停止中の場合は、サーバーに保存された直近のスニペットや終了情報を返す
      const lines: string[] = [];

      if (server) {
        const lastExit = (server as any).lastExit;
        if (lastExit) {
          const exitLine = lastExit.code !== null
            ? `Process exited with code ${lastExit.code} at ${new Date(lastExit.time).toLocaleString()}`
            : `Process exited (signal: ${lastExit.signal}) at ${new Date(lastExit.time).toLocaleString()}`;
          lines.push(exitLine);
        }

        const snippet = (server as any).lastConsoleSnippet as string[] | undefined;
        if (snippet && snippet.length > 0) {
          lines.push('--- Recent console output ---');
          lines.push(...snippet);
        }
      }

      if (lines.length === 0) {
        return [
          "Console output not available: no server process running (proxy-only or not started)"
        ];
      }

      if (lineCount && lineCount > 0) return lines.slice(-lineCount);
      return lines;

    } catch (error) {
      console.warn(`Failed to get console output for ${serverId}:`, error);
      return [`Console output not available: ${error}`];
    }
  }

  // サーバーにコンソールコマンドを送信
  public sendConsoleCommand(serverId: string, command: string): void {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new APIError(`Server with id ${serverId} not found`, "SERVER_NOT_FOUND", 404);
    }

    if (server.status !== "online") {
      throw new APIError(
        "Server must be online to send commands", 
        "SERVER_NOT_ONLINE", 
        400
      );
    }

    try {
      processManager.sendCommand(serverId, command);
      console.log(`📤 Command sent to ${server.name}: ${command}`);
    } catch (error) {
      console.error(`❌ Failed to send command to ${server.name}:`, error);
      throw error;
    }
  }

  // プラグインからのコンソールログをクライアントにブロードキャスト
  public broadcastConsoleOutput(serverId: string, message: string): void {
    // Emit console.output event so messageRouter can broadcast to clients
    this.emit('console.output', {
      serverId,
      line: message,
      timestamp: new Date().toISOString()
    });
  }

  // サーバーディレクトリの検証
  public async validateServerDirectory(serverDirectory: string) {
    return await minecraftServerDetector.validateServerDirectory(serverDirectory);
  }

  // 設定の取得と保存
  public async getAppConfig() {
    return await dataStorage.loadConfig();
  }

  public async saveAppConfig(config: any) {
    await dataStorage.saveConfig(config);
  }

  // システム情報取得
  public getPluginsDirectory(): string {
    return dataStorage.getPluginsDirectory();
  }

  public getDataDirectory(): string {
    return dataStorage.getDataDirectory();
  }
  
  // ==================== Plugin Management ====================
  
  /**
   * Get or create plugin loader for a server
   */
  private getPluginLoader(serverId: string): PluginLoader {
    if (!this.pluginLoaders.has(serverId)) {
      const pluginDir = dataStorage.getPluginsDirectory();
      const storageDir = dataStorage.getDataDirectory();
      
      console.log(`🔌 Creating PluginLoader for server ${serverId}`);
      console.log(`  - Plugin Directory: ${pluginDir}`);
      console.log(`  - Storage Directory: ${storageDir}`);
      
      const loader = new PluginLoader(serverId, pluginDir, this, storageDir);
      this.pluginLoaders.set(serverId, loader);
    }
    return this.pluginLoaders.get(serverId)!;
  }
  
  /**
   * Load all plugins for a server
   */
  public async loadPlugins(serverId: string) {
    console.log(`🔌 [Plugin] Loading plugins for server ${serverId}`);
    const loader = this.getPluginLoader(serverId);
    
    try {
      const plugins = await loader.loadPlugins();
      // Merge persisted enabled/metadata state from server config if available
      try {
        const server = this.servers.get(serverId);
        if (server && server.plugins) {
          plugins.forEach(p => {
            const persisted = server.plugins && server.plugins[p.id];
            if (persisted) {
              p.enabled = persisted.enabled === true;
              // merge some metadata if missing
              p.metadata = p.metadata || {};
              p.metadata.name = p.metadata.name || persisted.name;
              p.metadata.version = p.metadata.version || persisted.version;
              p.filePath = p.filePath || persisted.filePath;
              p.error = p.error || persisted.error;
            }
          });
        }
      } catch (mergeErr) {
        console.warn(`⚠️ Failed to merge persisted plugin state for ${serverId}:`, mergeErr);
      }

      console.log(`✅ [Plugin] Loaded ${plugins.length} plugins:`, plugins.map(p => ({
        id: p.id,
        name: p.metadata?.name,
        version: p.metadata?.version,
        loaded: p.loaded,
        enabled: p.enabled,
        error: p.error
      })));

      return plugins;
    } catch (error) {
      console.error(`❌ [Plugin] Failed to load plugins for server ${serverId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all plugins for a server
   */
  public getPlugins(serverId: string) {
    const loader = this.getPluginLoader(serverId);
    const plugins = loader.getPlugins();
    // Merge persisted enabled state for quick getPlugins
    try {
      const server = this.servers.get(serverId);
      if (server && server.plugins) {
        plugins.forEach(p => {
          const persisted = server.plugins && server.plugins[p.id];
          if (persisted) {
            p.enabled = persisted.enabled === true;
            p.metadata = p.metadata || {};
            p.metadata.name = p.metadata.name || persisted.name;
            p.metadata.version = p.metadata.version || persisted.version;
            p.filePath = p.filePath || persisted.filePath;
            p.error = p.error || persisted.error;
          }
        });
      }
    } catch (mergeErr) {
      console.warn(`⚠️ Failed to merge persisted plugin state for ${serverId}:`, mergeErr);
    }

    console.log(`📋 [Plugin] Getting plugins for server ${serverId}: ${plugins.length} found`);
    return plugins;
  }
  
  /**
   * Enable a plugin
   */
  public async enablePlugin(serverId: string, pluginId: string) {
    console.log(`🔌 [Plugin] Enabling plugin ${pluginId} for server ${serverId}`);
    const loader = this.getPluginLoader(serverId);
    
    try {
      const plugin = await loader.enablePlugin(pluginId);
      console.log(`✅ [Plugin] Enabled plugin ${pluginId}:`, {
        name: plugin.metadata.name,
        version: plugin.metadata.version
      });
      // Persist plugin enabled state into server config
      try {
        const server = this.servers.get(serverId);
        if (server) {
          server.plugins = server.plugins || {};
          server.plugins[pluginId] = {
            id: plugin.id,
            name: plugin.metadata.name,
            version: plugin.metadata.version,
            filePath: plugin.filePath,
            enabled: true
          };
          // update timestamp so saveServers writes a fresh updatedAt
          server.updatedAt = new Date();
          this.servers.set(serverId, server);
          await this.saveServersToStorage();
          console.log(`💾 Persisted enabled plugin ${pluginId} into server ${serverId}`);
        }
      } catch (err) {
        console.error('❌ Failed to persist plugin enable state:', err);
      }
      return plugin;
    } catch (error) {
      console.error(`❌ [Plugin] Failed to enable plugin ${pluginId}:`, error);
      throw error;
    }
  }
  
  /**
   * Disable a plugin
   */
  public async disablePlugin(serverId: string, pluginId: string) {
    console.log(`🔌 [Plugin] Disabling plugin ${pluginId} for server ${serverId}`);
    const loader = this.getPluginLoader(serverId);
    
    try {
      const plugin = await loader.disablePlugin(pluginId);
      console.log(`✅ [Plugin] Disabled plugin ${pluginId}`);
      // Persist plugin disabled state into server config
      try {
        const server = this.servers.get(serverId);
        if (server && server.plugins && server.plugins[pluginId]) {
          // Mark as disabled; keep metadata for inspection
          server.plugins[pluginId].enabled = false;
          server.updatedAt = new Date();
          this.servers.set(serverId, server);
          await this.saveServersToStorage();
          console.log(`💾 Persisted disabled plugin ${pluginId} into server ${serverId}`);
        }
      } catch (err) {
        console.error('❌ Failed to persist plugin disable state:', err);
      }
      return plugin;
    } catch (error) {
      console.error(`❌ [Plugin] Failed to disable plugin ${pluginId}:`, error);
      throw error;
    }
  }
  
  /**
   * Reload a plugin
   */
  public async reloadPlugin(serverId: string, pluginId: string) {
    console.log(`🔄 [Plugin] Reloading plugin ${pluginId} for server ${serverId}`);
    const loader = this.getPluginLoader(serverId);
    
    try {
      const plugin = await loader.reloadPlugin(pluginId);
      console.log(`✅ [Plugin] Reloaded plugin ${pluginId}:`, {
        name: plugin.metadata.name,
        version: plugin.metadata.version
      });
      return plugin;
    } catch (error) {
      console.error(`❌ [Plugin] Failed to reload plugin ${pluginId}:`, error);
      throw error;
    }
  }
  
  /**
   * Trigger event in all plugins
   */
  public triggerPluginEvent(serverId: string, eventName: string, data: any) {
    const loader = this.pluginLoaders.get(serverId);
    if (loader) {
      loader.triggerEvent(eventName, data);
    }
  }

  /**
   * Auto-enable plugins that were enabled before server stopped
   */
  private async autoEnablePluginsForServer(serverId: string): Promise<void> {
    console.log(`🔌 [Plugin] Auto-enabling plugins for server ${serverId}`);
    
    try {
      const server = this.servers.get(serverId);
      if (!server) {
        console.warn(`⚠️ [Plugin] Server ${serverId} not found for auto-enable`);
        return;
      }

      // Load all plugins first
      await this.loadPlugins(serverId);

      // Get plugins that should be enabled
      const plugins = this.getPlugins(serverId);
      const toEnable = plugins.filter(p => p.enabled === true && p.loaded);

      if (toEnable.length === 0) {
        console.log(`📋 [Plugin] No plugins to auto-enable for server ${serverId}`);
        return;
      }

      console.log(`🚀 [Plugin] Auto-enabling ${toEnable.length} plugin(s) for server ${serverId}: ${toEnable.map(p => p.metadata?.name || p.id).join(', ')}`);

      // Enable each plugin
      for (const plugin of toEnable) {
        try {
          await this.enablePlugin(serverId, plugin.id);
          console.log(`✅ [Plugin] Auto-enabled plugin: ${plugin.metadata?.name || plugin.id}`);
        } catch (err) {
          console.error(`❌ [Plugin] Failed to auto-enable plugin ${plugin.id}:`, err);
          // Continue with other plugins even if one fails
        }
      }
    } catch (error) {
      console.error(`❌ [Plugin] Failed to auto-enable plugins for server ${serverId}:`, error);
    }
  }

  // データの整合性チェック
  public async validateData() {
    return await dataStorage.validateData();
  }

  // バックアップ作成
  public async createBackup() {
    return await dataStorage.createBackup();
  }

  private isValidAddress(address: string): boolean {
    const regex = /^[\w.-]+:\d+$/;
    return regex.test(address);
  }
}