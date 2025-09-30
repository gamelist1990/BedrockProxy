import { spawn, ChildProcess } from "child_process";
import { readFileSync, existsSync, watchFile, unwatchFile } from "fs";
import { join } from "path";
import { logger } from "./logger.js";
import type { PlayerPacket, PlayerAction } from "../types/index.js";

export interface MinecraftServerConfig {
  executablePath: string;
  serverDirectory: string;
  logFilePath?: string;
  autoRestart?: boolean;
  timeout?: number;
}

export interface ServerLogEntry {
  timestamp: Date;
  level: string;
  message: string;
  raw: string;
}

export class MinecraftServerManager {
  private process: ChildProcess | null = null;
  private config: MinecraftServerConfig;
  private isRunning = false;
  private isStarting = false;
  private logWatcher: NodeJS.Timeout | null = null;
  private lastLogPosition = 0;

  // イベントハンドラー
  private onPlayerAction?: (packet: PlayerPacket) => void;
  private onStatusChange?: (status: 'starting' | 'running' | 'stopped' | 'error', message?: string) => void;
  private onLogEntry?: (entry: ServerLogEntry) => void;

  // プレイヤー管理
  private connectedPlayers = new Map<string, { name: string; xuid: string; joinTime: Date; ipAddress?: string }>();

  constructor(config: MinecraftServerConfig) {
    this.config = {
      timeout: 60000, // 60秒のタイムアウト
      ...config
    };

    // ログファイルパスが指定されていない場合はデフォルトを設定
    if (!this.config.logFilePath) {
      this.config.logFilePath = join(this.config.serverDirectory, 'logs', 'latest.log');
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning || this.isStarting) {
      throw new Error('Server is already running or starting');
    }

    if (!existsSync(this.config.executablePath)) {
      throw new Error(`Server executable not found: ${this.config.executablePath}`);
    }

    this.isStarting = true;
    this.emitStatusChange('starting', 'Starting Minecraft server...');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanup();
        this.emitStatusChange('error', 'Server start timeout');
        reject(new Error('Server start timeout'));
      }, this.config.timeout);

      try {
        // サーバープロセスを開始
        this.process = spawn(this.config.executablePath, [], {
          cwd: this.config.serverDirectory,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // stdout監視（サーバーログ）
        this.process.stdout?.on('data', (data: Buffer) => {
          const logLines = data.toString().split('\n').filter(line => line.trim());
          
          for (const line of logLines) {
            this.processLogLine(line);
            
            // "Server started."が出力されたら起動完了
            if (line.includes('Server started.')) {
              clearTimeout(timeout);
              this.isStarting = false;
              this.isRunning = true;
              this.startLogWatcher();
              this.emitStatusChange('running', 'Server started successfully');
              
              logger.info('minecraft-server', 'Server started successfully', {
                executablePath: this.config.executablePath,
                serverDirectory: this.config.serverDirectory
              });
              
              resolve();
              return;
            }
          }
        });

        // stderr監視（エラーログ）
        this.process.stderr?.on('data', (data: Buffer) => {
          const errorMessage = data.toString();
          logger.error('minecraft-server', 'Server error output', { error: errorMessage });
        });

        // プロセス終了処理
        this.process.on('exit', (code, signal) => {
          this.isRunning = false;
          this.isStarting = false;
          this.stopLogWatcher();
          
          logger.info('minecraft-server', 'Server process exited', { code, signal });
          this.emitStatusChange('stopped', `Server exited with code ${code}`);

          // 自動再起動が有効な場合
          if (this.config.autoRestart && code !== 0) {
            logger.info('minecraft-server', 'Auto-restarting server...');
            setTimeout(() => {
              this.start().catch(error => {
                logger.error('minecraft-server', 'Auto-restart failed', { error: error.message });
              });
            }, 5000); // 5秒後に再起動
          }
        });

        this.process.on('error', (error) => {
          clearTimeout(timeout);
          this.cleanup();
          this.emitStatusChange('error', error.message);
          reject(error);
        });

      } catch (error) {
        clearTimeout(timeout);
        this.cleanup();
        this.emitStatusChange('error', error instanceof Error ? error.message : 'Unknown error');
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning && !this.isStarting) {
      return;
    }

    return new Promise((resolve) => {
      if (this.process) {
        this.process.once('exit', () => {
          this.cleanup();
          resolve();
        });

        // 優雅な停止を試行
        this.sendCommand('stop');
        
        // 5秒後に強制終了
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGTERM');
            
            // さらに5秒後にSIGKILL
            setTimeout(() => {
              if (this.process && !this.process.killed) {
                this.process.kill('SIGKILL');
              }
            }, 5000);
          }
        }, 5000);
      } else {
        this.cleanup();
        resolve();
      }
    });
  }

  public sendCommand(command: string): void {
    if (!this.isRunning || !this.process) {
      throw new Error('Server is not running');
    }

    this.process.stdin?.write(command + '\n');
    logger.debug('minecraft-server', 'Command sent', { command });
  }

  private processLogLine(line: string): void {
    const logEntry = this.parseLogLine(line);
    
    if (this.onLogEntry) {
      this.onLogEntry(logEntry);
    }

    // プレイヤー接続検知
    this.detectPlayerActions(logEntry);
  }

  private parseLogLine(line: string): ServerLogEntry {
    // ログフォーマット: [2025-09-29 21:52:17:970 INFO] Message
    const logRegex = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d{3}) (\w+)\] (.+)$/;
    const match = line.match(logRegex);

    if (match) {
      const [, timestampStr, level, message] = match;
      const timestamp = this.parseTimestamp(timestampStr);
      
      return { timestamp, level, message, raw: line };
    }

    // パースできない場合はそのまま記録
    return {
      timestamp: new Date(),
      level: 'UNKNOWN',
      message: line,
      raw: line
    };
  }

  private parseTimestamp(timestampStr: string): Date {
    // フォーマット: 2025-09-29 21:52:17:970
    const parts = timestampStr.split(' ');
    const datePart = parts[0];
    const timePart = parts[1];
    
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second, millisecond] = timePart.split(':').map(Number);
    
    return new Date(year, month - 1, day, hour, minute, second, millisecond);
  }

  private detectPlayerActions(logEntry: ServerLogEntry): void {
    const message = logEntry.message;

    // プレイヤー接続: Player connected: PEXkoukunn, xuid: 2535459105874433
    const connectMatch = message.match(/Player connected: (.+), xuid: (\d+)/);
    if (connectMatch) {
      const [, playerName, xuid] = connectMatch;
      
      const player = {
        name: playerName,
        xuid,
        joinTime: logEntry.timestamp
      };
      
      this.connectedPlayers.set(xuid, player);
      
      const packet: PlayerPacket = {
        name: playerName,
        xuid,
        action: 'join',
        timestamp: logEntry.timestamp
      };
      
      this.emitPlayerAction(packet);
      logger.info('minecraft-server', 'Player joined', { playerName, xuid });
      return;
    }

    // プレイヤー切断: Player disconnected: PEXkoukunn, xuid: 2535459105874433, pfid: 225181122338717d
    const disconnectMatch = message.match(/Player disconnected: (.+), xuid: (\d+), pfid: (.+)/);
    if (disconnectMatch) {
      const [, playerName, xuid] = disconnectMatch;
      
      const connectedPlayer = this.connectedPlayers.get(xuid);
      this.connectedPlayers.delete(xuid);
      
      const packet: PlayerPacket = {
        name: playerName,
        xuid,
        action: 'leave',
        timestamp: logEntry.timestamp
      };
      
      this.emitPlayerAction(packet);
      logger.info('minecraft-server', 'Player left', { playerName, xuid });
      return;
    }
  }

  private startLogWatcher(): void {
    if (!this.config.logFilePath || !existsSync(this.config.logFilePath)) {
      logger.warn('minecraft-server', 'Log file not found, skipping log monitoring', {
        logFilePath: this.config.logFilePath
      });
      return;
    }

    // ファイル監視を開始
    watchFile(this.config.logFilePath, { interval: 1000 }, () => {
      this.readNewLogEntries();
    });

    // 初期ログ位置を設定
    try {
      const stats = require('fs').statSync(this.config.logFilePath);
      this.lastLogPosition = stats.size;
    } catch (error) {
      this.lastLogPosition = 0;
    }

    logger.debug('minecraft-server', 'Log watcher started', {
      logFilePath: this.config.logFilePath,
      initialPosition: this.lastLogPosition
    });
  }

  private stopLogWatcher(): void {
    if (this.config.logFilePath) {
      unwatchFile(this.config.logFilePath);
    }
    logger.debug('minecraft-server', 'Log watcher stopped');
  }

  private readNewLogEntries(): void {
    if (!this.config.logFilePath || !existsSync(this.config.logFilePath)) {
      return;
    }

    try {
      const stats = require('fs').statSync(this.config.logFilePath);
      
      if (stats.size <= this.lastLogPosition) {
        return; // ファイルサイズが変わっていない
      }

      const buffer = Buffer.alloc(stats.size - this.lastLogPosition);
      const fd = require('fs').openSync(this.config.logFilePath, 'r');
      
      require('fs').readSync(fd, buffer, 0, buffer.length, this.lastLogPosition);
      require('fs').closeSync(fd);
      
      const newContent = buffer.toString('utf8');
      const lines = newContent.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        this.processLogLine(line);
      }
      
      this.lastLogPosition = stats.size;
      
    } catch (error) {
      logger.error('minecraft-server', 'Error reading log file', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private cleanup(): void {
    this.isRunning = false;
    this.isStarting = false;
    this.process = null;
    this.connectedPlayers.clear();
    this.stopLogWatcher();
  }

  // イベントハンドラー設定
  public setPlayerActionHandler(handler: (packet: PlayerPacket) => void): void {
    this.onPlayerAction = handler;
  }

  public setStatusChangeHandler(handler: (status: 'starting' | 'running' | 'stopped' | 'error', message?: string) => void): void {
    this.onStatusChange = handler;
  }

  public setLogEntryHandler(handler: (entry: ServerLogEntry) => void): void {
    this.onLogEntry = handler;
  }

  // プレイヤーアクションを発火
  private emitPlayerAction(packet: PlayerPacket): void {
    if (this.onPlayerAction) {
      this.onPlayerAction(packet);
    }
  }

  // ステータス変更を発火
  private emitStatusChange(status: 'starting' | 'running' | 'stopped' | 'error', message?: string): void {
    if (this.onStatusChange) {
      this.onStatusChange(status, message);
    }
  }

  // 統計情報取得
  public getStats() {
    return {
      isRunning: this.isRunning,
      isStarting: this.isStarting,
      connectedPlayersCount: this.connectedPlayers.size,
      connectedPlayers: Array.from(this.connectedPlayers.values()),
      config: this.config,
      processId: this.process?.pid
    };
  }

  // プレイヤー一覧取得
  public getConnectedPlayers() {
    return Array.from(this.connectedPlayers.values());
  }

  // 設定更新
  public updateConfig(newConfig: Partial<MinecraftServerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('minecraft-server', 'Configuration updated', { config: this.config });
  }

  // サーバー状態取得
  public getStatus(): 'starting' | 'running' | 'stopped' | 'error' {
    if (this.isStarting) return 'starting';
    if (this.isRunning) return 'running';
    return 'stopped';
  }
}