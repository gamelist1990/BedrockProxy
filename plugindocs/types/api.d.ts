/**
 * Plugin API - Main interface
 */

import type { ServerInfo, ServerStats } from './server';
import type { Player, PlayerStats } from './player';
import type { EventType, EventHandler, EventDataMap } from './events';
import type { StorageAPI } from './storage';
import type { HttpAPI } from './http';
import type { FileSystemAPI } from './filesystem';

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Main Plugin API
 */
export interface PluginAPI {
  // ==================== Logging ====================
  
  /**
   * Log a message
   * @param level - Log level
   * @param message - Message to log
   * @param data - Additional data to log
   */
  log(level: LogLevel, message: string, data?: any): void;
  
  /**
   * Log debug message
   */
  debug(message: string, data?: any): void;
  
  /**
   * Log info message
   */
  info(message: string, data?: any): void;
  
  /**
   * Log warning message
   */
  warn(message: string, data?: any): void;
  
  /**
   * Log error message
   */
  error(message: string, data?: any): void;
  
  // ==================== Server ====================
  
  /**
   * Get current server information
   */
  getServerInfo(): Promise<ServerInfo>;
  
  /**
   * Get server statistics
   */
  getServerStats(): Promise<ServerStats>;
  
  /**
   * Send a command to the Minecraft server console
   * @param command - Command to send (without leading /)
   */
  sendCommand(command: string): Promise<void>;
  
  /**
   * Get recent console output
   * @param lineCount - Number of lines to retrieve (default: 100)
   */
  getConsoleOutput(lineCount?: number): Promise<string[]>;
  
  // ==================== Players ====================
  
  /**
   * Get list of online players
   */
  getPlayers(): Promise<Player[]>;
  
  /**
   * Get specific player by ID
   * @param playerId - Player ID or XUID
   */
  getPlayer(playerId: string): Promise<Player | null>;
  
  /**
   * Get player by name
   * @param playerName - Player name
   */
  getPlayerByName(playerName: string): Promise<Player | null>;
  
  /**
   * Get player statistics
   * @param playerId - Player ID or XUID
   */
  getPlayerStats(playerId: string): Promise<PlayerStats | null>;
  
  /**
   * Kick a player
   * @param playerId - Player ID
   * @param reason - Kick reason
   */
  kickPlayer(playerId: string, reason?: string): Promise<void>;
  
  /**
   * Send message to a specific player
   * @param playerId - Player ID
   * @param message - Message to send
   */
  tellPlayer(playerId: string, message: string): Promise<void>;
  
  /**
   * Broadcast message to all players
   * @param message - Message to broadcast
   */
  broadcast(message: string): Promise<void>;
  
  // ==================== Events ====================
  
  /**
   * Register an event listener
   * @param event - Event name
   * @param handler - Event handler function
   */
  on<K extends EventType>(event: K, handler: EventHandler<EventDataMap[K]>): void;
  
  /**
   * Register a one-time event listener
   * @param event - Event name
   * @param handler - Event handler function
   */
  once<K extends EventType>(event: K, handler: EventHandler<EventDataMap[K]>): void;
  
  /**
   * Unregister an event listener
   * @param event - Event name
   * @param handler - Event handler function to remove
   */
  off<K extends EventType>(event: K, handler: EventHandler<EventDataMap[K]>): void;
  
  /**
   * Emit a custom event
   * @param event - Event name
   * @param data - Event data
   */
  emit(event: string, data: any): void;
  
  // ==================== Timing ====================
  
  /**
   * Schedule a recurring task
   * @param intervalMs - Interval in milliseconds
   * @param callback - Callback function
   * @returns Timer ID for cancellation
   */
  setInterval(intervalMs: number, callback: () => void | Promise<void>): number;
  
  /**
   * Schedule a one-time task
   * @param delayMs - Delay in milliseconds
   * @param callback - Callback function
   * @returns Timer ID for cancellation
   */
  setTimeout(delayMs: number, callback: () => void | Promise<void>): number;
  
  /**
   * Cancel a scheduled task
   * @param timerId - Timer ID from setInterval or setTimeout
   */
  clearTimer(timerId: number): void;
  
  // ==================== Storage ====================
  
  /**
   * Storage API for persistent data
   */
  storage: StorageAPI;
  
  /**
   * Get data from plugin storage (deprecated, use storage.get)
   * @deprecated Use storage.get() instead
   */
  getData(key: string): Promise<any>;
  
  /**
   * Set data in plugin storage (deprecated, use storage.set)
   * @deprecated Use storage.set() instead
   */
  setData(key: string, value: any): Promise<void>;
  
  // ==================== HTTP ====================
  
  /**
   * HTTP client API
   */
  http: HttpAPI;
  
  // ==================== File System ====================
  
  /**
   * File system API (sandboxed to plugin directory)
   */
  fs: FileSystemAPI;
  
  // ==================== Utilities ====================
  
  /**
   * Get plugin version
   */
  getVersion(): string;
  
  /**
   * Check if another plugin is loaded
   * @param pluginName - Plugin name
   */
  isPluginLoaded(pluginName: string): boolean;
  
  /**
   * Get list of loaded plugins
   */
  getLoadedPlugins(): string[];
  
  /**
   * Call a function from another plugin (inter-plugin communication)
   * @param pluginName - Target plugin name
   * @param functionName - Function name to call
   * @param args - Function arguments
   */
  callPlugin(pluginName: string, functionName: string, ...args: any[]): Promise<any>;
}
