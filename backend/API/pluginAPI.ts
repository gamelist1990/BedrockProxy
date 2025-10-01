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
    logger[level](this.pluginName, message, data);
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
    // This would send command to Minecraft server console
    this.info(`Sending command: ${command}`);
    // TODO: Implement actual command sending through MinecraftServerManager
  }
  
  async getConsoleOutput(lineCount: number = 100): Promise<string[]> {
    // TODO: Implement console output buffering
    return [];
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
    // TODO: Implement actual broadcast through MinecraftServerManager
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
    // TODO: Implement plugin registry check
    return false;
  }
  
  getLoadedPlugins(): string[] {
    // TODO: Implement plugin registry
    return [];
  }
  
  async callPlugin(pluginName: string, functionName: string, ...args: any[]): Promise<any> {
    // TODO: Implement inter-plugin communication
    throw new Error('Inter-plugin communication not yet implemented');
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
