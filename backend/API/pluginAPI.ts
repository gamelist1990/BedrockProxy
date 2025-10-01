/**
 * Main Plugin API Implementation
 * Provides complete API for plugins including logging, server, players, events, etc.
 */

import { join } from "path";
import type { Server, Player } from "../types/index.js";
import { StorageAPI } from "./storageAPI.js";
import { HttpAPI } from "./httpAPI.js";
import { FileSystemAPI } from "./fileSystemAPI.js";
import { logger } from "../services/logger.js";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ServerInfo {
  id: string;
  name: string;
  address: string;
  destinationAddress: string;
  status: string;
  playersOnline: number;
  maxPlayers: number;
}

export interface ServerStats {
  uptime: number;
  totalPlayers: number;
  peakPlayers: number;
  packetsProcessed: number;
  bytesTransferred: number;
}

export interface PlayerStats {
  playerId: string;
  totalPlayTime: number;
  lastSeen: Date;
  joinCount: number;
}

export type EventType = 
  | 'serverStart'
  | 'serverStop'
  | 'playerJoin'
  | 'playerLeave'
  | 'playerMessage'
  | 'consoleOutput'
  | 'error';

export type EventHandler<T = any> = (data: T) => void | Promise<void>;

export class PluginAPI {
  private pluginName: string;
  private pluginPath: string;
  private serverId: string;
  private serverManager: any;
  private eventHandlers = new Map<string, Set<EventHandler>>();
  private timers = new Map<number, NodeJS.Timeout>();
  private nextTimerId = 1;
  
  // Sub-APIs
  public storage: StorageAPI;
  public http: HttpAPI;
  public fs: FileSystemAPI;
  
  constructor(
    pluginName: string,
    pluginPath: string,
    serverId: string,
    serverManager: any,
    storageDir: string
  ) {
    this.pluginName = pluginName;
    this.pluginPath = pluginPath;
    this.serverId = serverId;
    this.serverManager = serverManager;
    
    // Initialize sub-APIs
    const pluginDataDir = join(storageDir, pluginName);
    const pluginStorageDir = join(pluginDataDir, 'storage');
    
    this.storage = new StorageAPI(pluginStorageDir);
    this.http = new HttpAPI(pluginDataDir);
    this.fs = new FileSystemAPI(this.pluginPath);
  }
  
  // ==================== Logging ====================
  
  log(level: LogLevel, message: string, data?: any): void {
    const formattedMessage = `[${this.pluginName}]: ${message}`;
    logger[level](this.pluginName, message, data);
    
    // Also broadcast to clients via console.output event with plugin name prefix
    try {
      if (this.serverManager && typeof this.serverManager.broadcastConsoleOutput === 'function') {
        this.serverManager.broadcastConsoleOutput(this.serverId, formattedMessage);
      }
    } catch (err) {
      // Ignore broadcast errors to avoid infinite loops
    }
  }
  
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }
  
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }
  
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }
  
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }
  
  // ==================== Server ====================
  
  async getServerInfo(): Promise<ServerInfo> {
    const server = this.serverManager.getServer(this.serverId);
    if (!server) {
      throw new Error('Server not found');
    }
    
    return {
      id: server.id,
      name: server.name,
      address: server.address,
      destinationAddress: server.destinationAddress,
      status: server.status,
      playersOnline: server.playersOnline,
      maxPlayers: server.maxPlayers
    };
  }
  
  async getServerStats(): Promise<ServerStats> {
    const server = this.serverManager.getServer(this.serverId);
    if (!server) {
      throw new Error('Server not found');
    }
    
    // Mock stats for now - implement real tracking later
    return {
      uptime: Date.now() - server.createdAt.getTime(),
      totalPlayers: server.players?.length || 0,
      peakPlayers: server.maxPlayers,
      packetsProcessed: 0,
      bytesTransferred: 0
    };
  }
  
  async sendCommand(command: string): Promise<void> {
    // Delegate to ServerManager to send a console command to the server
    this.info(`Sending command: ${command}`);
    try {
      if (!this.serverManager || typeof this.serverManager.sendConsoleCommand !== 'function') {
        this.warn('ServerManager does not support sendConsoleCommand');
        return;
      }
      this.serverManager.sendConsoleCommand(this.serverId, command);
    } catch (err) {
      this.error('Failed to send command', err);
      throw err;
    }
  }
  
  async getConsoleOutput(lineCount: number = 100): Promise<string[]> {
    try {
      if (!this.serverManager || typeof this.serverManager.getServerConsoleOutput !== 'function') {
        this.warn('ServerManager does not support getServerConsoleOutput');
        return [];
      }
      const lines = this.serverManager.getServerConsoleOutput(this.serverId, lineCount);
      return Array.isArray(lines) ? lines : [];
    } catch (err) {
      this.error('Failed to get console output', err);
      return [];
    }
  }
  
  // ==================== Players ====================
  
  async getPlayers(): Promise<Player[]> {
    const server = this.serverManager.getServer(this.serverId);
    if (!server) {
      throw new Error('Server not found');
    }
    
    return server.players || [];
  }
  
  async getPlayer(playerId: string): Promise<Player | null> {
    const players = await this.getPlayers();
    return players.find(p => p.id === playerId || p.xuid === playerId) || null;
  }
  
  async getPlayerByName(playerName: string): Promise<Player | null> {
    const players = await this.getPlayers();
    return players.find(p => p.name.toLowerCase() === playerName.toLowerCase()) || null;
  }
  
  async getPlayerStats(playerId: string): Promise<PlayerStats | null> {
    const player = await this.getPlayer(playerId);
    if (!player) {
      return null;
    }
    
    // Calculate stats
    const playTime = player.leaveTime 
      ? player.leaveTime.getTime() - player.joinTime.getTime()
      : Date.now() - player.joinTime.getTime();
    
    return {
      playerId: player.id,
      totalPlayTime: playTime,
      lastSeen: player.leaveTime || new Date(),
      joinCount: 1 // TODO: Track this properly
    };
  }
  
  async kickPlayer(playerId: string, reason?: string): Promise<void> {
    const player = await this.getPlayer(playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    this.info(`Kicking player ${player.name}${reason ? `: ${reason}` : ''}`);
    // TODO: Implement actual kick through MinecraftServerManager
  }
  
  async tellPlayer(playerId: string, message: string): Promise<void> {
    const player = await this.getPlayer(playerId);
    if (!player) {
      throw new Error('Player not found');
    }
    
    this.info(`Sending message to ${player.name}: ${message}`);
    // TODO: Implement actual tell through MinecraftServerManager
  }
  
  async broadcast(message: string): Promise<void> {
    this.info(`Broadcasting: ${message}`);
    try {
      // Prefer a dedicated broadcast if ServerManager exposes one
      if (this.serverManager && typeof this.serverManager.broadcast === 'function') {
        await this.serverManager.broadcast(this.serverId, message);
        return;
      }

      // Fallback: send a server console "say" command so players see the message
      if (this.serverManager && typeof this.serverManager.sendConsoleCommand === 'function') {
        this.serverManager.sendConsoleCommand(this.serverId, `say ${message}`);
        return;
      }

      this.warn('No broadcast method available on ServerManager');
    } catch (err) {
      this.error('Failed to broadcast message', err);
      throw err;
    }
  }
  
  // ==================== Events ====================
  
  on<T = any>(event: EventType | string, handler: EventHandler<T>): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }
  
  once<T = any>(event: EventType | string, handler: EventHandler<T>): void {
    const wrappedHandler: EventHandler<T> = async (data: T) => {
      await handler(data);
      this.off(event, wrappedHandler);
    };
    this.on(event, wrappedHandler);
  }
  
  off<T = any>(event: EventType | string, handler: EventHandler<T>): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Internal method to trigger events from system
   */
  _triggerEvent<T = any>(event: EventType | string, data: T): void {
    this.emit(event, data);
  }
  
  // ==================== Timing ====================
  
  setInterval(intervalMs: number, callback: () => void | Promise<void>): number {
    const timerId = this.nextTimerId++;
    const timer = setInterval(async () => {
      try {
        await callback();
      } catch (error) {
        this.error(`Error in interval callback:`, error);
      }
    }, intervalMs);
    
    this.timers.set(timerId, timer);
    return timerId;
  }
  
  setTimeout(delayMs: number, callback: () => void | Promise<void>): number {
    const timerId = this.nextTimerId++;
    const timer = setTimeout(async () => {
      try {
        await callback();
      } catch (error) {
        this.error(`Error in timeout callback:`, error);
      }
      this.timers.delete(timerId);
    }, delayMs);
    
    this.timers.set(timerId, timer);
    return timerId;
  }
  
  clearTimer(timerId: number): void {
    const timer = this.timers.get(timerId);
    if (timer) {
      clearTimeout(timer);
      clearInterval(timer);
      this.timers.delete(timerId);
    }
  }
  
  // ==================== Storage (Deprecated methods) ====================
  
  async getData(key: string): Promise<any> {
    this.warn('getData() is deprecated, use storage.get() instead');
    return this.storage.get(key);
  }
  
  async setData(key: string, value: any): Promise<void> {
    this.warn('setData() is deprecated, use storage.set() instead');
    return this.storage.set(key, value);
  }
  
  // ==================== Utilities ====================
  
  getVersion(): string {
    return '1.0.0'; // Plugin API version
  }
  
  isPluginLoaded(pluginName: string): boolean {
    try {
      // Try to find plugin by id or metadata.name
      if (!this.serverManager) return false;
      const plugins = typeof this.serverManager.getPlugins === 'function'
        ? this.serverManager.getPlugins(this.serverId)
        : [];

      for (const p of plugins) {
        if (!p) continue;
        const name = p.id || p.metadata?.name;
        if (p.id === pluginName || p.metadata?.name === pluginName) {
          return !!p.loaded;
        }
      }
      return false;
    } catch (err) {
      this.error('isPluginLoaded check failed', err);
      return false;
    }
  }
  
  getLoadedPlugins(): string[] {
    try {
      if (!this.serverManager || typeof this.serverManager.getPlugins !== 'function') return [];
      const plugins = this.serverManager.getPlugins(this.serverId) || [];
      return plugins.filter((p: any) => p && p.loaded).map((p: any) => p.metadata?.name || p.id);
    } catch (err) {
      this.error('getLoadedPlugins failed', err);
      return [];
    }
  }
  
  async callPlugin(pluginName: string, functionName: string, ...args: any[]): Promise<any> {
    try {
      if (!this.serverManager) {
        throw new Error('ServerManager not available');
      }

      // Try to access the PluginLoader via ServerManager (private helper may exist)
      const loader = (this.serverManager as any).getPluginLoader
        ? (this.serverManager as any).getPluginLoader(this.serverId)
        : (this.serverManager as any).pluginLoaders && (this.serverManager as any).pluginLoaders.get(this.serverId);

      if (!loader) {
        throw new Error('PluginLoader not available for server');
      }

      // Find plugin by id or metadata.name
      const plugins = typeof loader.getPlugins === 'function' ? loader.getPlugins() : [];
      const target = plugins.find((p: any) => p && (p.id === pluginName || p.metadata?.name === pluginName));
      if (!target) throw new Error(`Plugin not found: ${pluginName}`);

      const pluginId = target.id;

      // Try to access the plugin instance context (stored internally on loader)
      const pluginContexts = (loader as any).pluginContexts;
      const instance = pluginContexts && pluginContexts.get ? pluginContexts.get(pluginId) : undefined;

      if (!instance) throw new Error(`Plugin instance not available: ${pluginName}`);

      const fn = instance[functionName];
      if (typeof fn !== 'function') throw new Error(`Function ${functionName} not found on plugin ${pluginName}`);

      // Call the function and return result (support async)
      return await fn.apply(instance, args);
    } catch (err) {
      this.error('callPlugin failed', err);
      throw err;
    }
  }
  
  // ==================== Cleanup ====================
  
  /**
   * Clean up all resources
   */
  cleanup(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers.clear();
    
    // Clear event handlers
    this.eventHandlers.clear();
    
    // Cleanup file system watchers
    this.fs.cleanup();
  }
}
