// 統一されたロギングシステム

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  clientId?: string;
  requestId?: string;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private categories = new Set<string>();

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    console.log(`🔧 Log level set to: ${LogLevel[level]}`);
  }

  public getLogLevel(): LogLevel {
    return this.logLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);
    this.categories.add(entry.category);
    
    // ログ数制限
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private formatMessage(category: string, message: string, data?: any, clientId?: string, requestId?: string): string {
    let formatted = `[${category.toUpperCase()}]`;
    
    if (clientId) {
      formatted += ` [${clientId}]`;
    }
    
    if (requestId) {
      formatted += ` [${requestId}]`;
    }
    
    formatted += ` ${message}`;
    
    if (data && typeof data === 'object') {
      formatted += ` ${JSON.stringify(data)}`;
    } else if (data !== undefined) {
      formatted += ` ${data}`;
    }
    
    return formatted;
  }

  public error(category: string, message: string, data?: any, clientId?: string, requestId?: string): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      category,
      message,
      data,
      clientId,
      requestId
    };
    
    this.addLog(entry);
    console.error(`❌ ${this.formatMessage(category, message, data, clientId, requestId)}`);
  }

  public warn(category: string, message: string, data?: any, clientId?: string, requestId?: string): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.WARN,
      category,
      message,
      data,
      clientId,
      requestId
    };
    
    this.addLog(entry);
    console.warn(`⚠️  ${this.formatMessage(category, message, data, clientId, requestId)}`);
  }

  public info(category: string, message: string, data?: any, clientId?: string, requestId?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      category,
      message,
      data,
      clientId,
      requestId
    };
    
    this.addLog(entry);
    console.log(`ℹ️  ${this.formatMessage(category, message, data, clientId, requestId)}`);
  }

  public debug(category: string, message: string, data?: any, clientId?: string, requestId?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      category,
      message,
      data,
      clientId,
      requestId
    };
    
    this.addLog(entry);
    console.debug(`🐛 ${this.formatMessage(category, message, data, clientId, requestId)}`);
  }

  public trace(category: string, message: string, data?: any, clientId?: string, requestId?: string): void {
    if (!this.shouldLog(LogLevel.TRACE)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.TRACE,
      category,
      message,
      data,
      clientId,
      requestId
    };
    
    this.addLog(entry);
    console.trace(`🔍 ${this.formatMessage(category, message, data, clientId, requestId)}`);
  }

  // WebSocket専用のログメソッド
  public connection(action: string, clientId: string, data?: any): void {
    switch (action) {
      case 'connected':
        this.info('websocket', `Client connected: ${clientId}`, data, clientId);
        break;
      case 'disconnected':
        this.info('websocket', `Client disconnected: ${clientId}`, data, clientId);
        break;
      case 'error':
        this.error('websocket', `Connection error for client: ${clientId}`, data, clientId);
        break;
      case 'timeout':
        this.warn('websocket', `Connection timeout for client: ${clientId}`, data, clientId);
        break;
      default:
        this.debug('websocket', `${action}: ${clientId}`, data, clientId);
    }
  }

  public message(action: string, type: string, clientId: string, data?: any, requestId?: string): void {
    switch (action) {
      case 'received':
        this.debug('message', `Received ${type} from ${clientId}`, data, clientId, requestId);
        break;
      case 'sent':
        this.debug('message', `Sent ${type} to ${clientId}`, data, clientId, requestId);
        break;
      case 'error':
        this.error('message', `Error processing ${type} from ${clientId}`, data, clientId, requestId);
        break;
      case 'timeout':
        this.warn('message', `Request timeout for ${type} from ${clientId}`, data, clientId, requestId);
        break;
      default:
        this.trace('message', `${action} ${type}: ${clientId}`, data, clientId, requestId);
    }
  }

  public heartbeat(action: string, clientId?: string, data?: any): void {
    switch (action) {
      case 'ping':
        this.trace('heartbeat', `Ping sent${clientId ? ` to ${clientId}` : ''}`, data, clientId);
        break;
      case 'pong':
        this.trace('heartbeat', `Pong received${clientId ? ` from ${clientId}` : ''}`, data, clientId);
        break;
      case 'timeout':
        this.warn('heartbeat', `Heartbeat timeout${clientId ? ` for ${clientId}` : ''}`, data, clientId);
        break;
      case 'missed':
        this.warn('heartbeat', `Missed heartbeat${clientId ? ` from ${clientId}` : ''}`, data, clientId);
        break;
      default:
        this.debug('heartbeat', `${action}${clientId ? ` - ${clientId}` : ''}`, data, clientId);
    }
  }

  // ログ取得
  public getLogs(options?: {
    level?: LogLevel;
    category?: string;
    clientId?: string;
    limit?: number;
    since?: Date;
  }): LogEntry[] {
    let filtered = this.logs;

    if (options?.level !== undefined) {
      filtered = filtered.filter(log => log.level <= options.level!);
    }

    if (options?.category) {
      filtered = filtered.filter(log => log.category === options.category);
    }

    if (options?.clientId) {
      filtered = filtered.filter(log => log.clientId === options.clientId);
    }

    if (options?.since) {
      filtered = filtered.filter(log => log.timestamp >= options.since!);
    }

    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  // 統計情報
  public getStats() {
    const levelCounts = Object.values(LogLevel)
      .filter(v => typeof v === 'number')
      .reduce((acc, level) => {
        acc[LogLevel[level as number]] = this.logs.filter(log => log.level === level).length;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalLogs: this.logs.length,
      levelCounts,
      categories: Array.from(this.categories),
      oldestLog: this.logs.length > 0 ? this.logs[0].timestamp : null,
      newestLog: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null,
    };
  }

  // ログクリア
  public clearLogs(): void {
    this.logs = [];
    this.categories.clear();
    this.info('logger', 'Logs cleared');
  }

  // ログエクスポート
  public exportLogs(): string {
    return JSON.stringify({
      exported: new Date().toISOString(),
      logLevel: LogLevel[this.logLevel],
      stats: this.getStats(),
      logs: this.logs
    }, null, 2);
  }
}

// シングルトンインスタンス
export const logger = Logger.getInstance();