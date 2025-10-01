/**
 * BedrockProxy Plugin API Type Definitions
 * 
 * This module provides type definitions for creating plugins for BedrockProxy.
 * Plugins allow extending the functionality of BedrockProxy servers with custom JavaScript code.
 */

/**
 * Plugin metadata interface
 */
export interface PluginMetadata {
  /** Plugin name (required) */
  name: string;
  
  /** Plugin version (required) */
  version: string;
  
  /** Plugin description */
  description?: string;
  
  /** Plugin author */
  author?: string;
  
  /** Plugin documentation URL or markdown content */
  docs?: string;
}

/**
 * Player information
 */
export interface Player {
  /** Player unique ID */
  id: string;
  
  /** Player display name */
  name: string;
  
  /** Player IP address (if available) */
  ip?: string;
  
  /** Player join time */
  joinTime: Date;
}

/**
 * Server information
 */
export interface ServerInfo {
  /** Server ID */
  id: string;
  
  /** Server name */
  name: string;
  
  /** Server status */
  status: 'online' | 'offline' | 'starting' | 'stopping' | 'error';
  
  /** Current player count */
  playersOnline: number;
  
  /** Maximum players */
  maxPlayers: number;
}

/**
 * Plugin API for interacting with BedrockProxy
 */
export interface PluginAPI {
  /**
   * Log a message to the console
   * @param level - Log level: 'info', 'warn', 'error', 'debug'
   * @param message - Message to log
   */
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string): void;
  
  /**
   * Get current server information
   */
  getServerInfo(): Promise<ServerInfo>;
  
  /**
   * Get list of online players
   */
  getPlayers(): Promise<Player[]>;
  
  /**
   * Send a command to the Minecraft server console
   * @param command - Command to send
   */
  sendCommand(command: string): Promise<void>;
  
  /**
   * Register an event listener
   * @param event - Event name
   * @param handler - Event handler function
   */
  on(event: 'playerJoin' | 'playerLeave' | 'serverStart' | 'serverStop' | 'consoleOutput', 
     handler: (data: any) => void): void;
  
  /**
   * Unregister an event listener
   * @param event - Event name
   * @param handler - Event handler function
   */
  off(event: string, handler: (data: any) => void): void;
  
  /**
   * Store plugin data (persisted)
   * @param key - Data key
   * @param value - Data value
   */
  setData(key: string, value: any): Promise<void>;
  
  /**
   * Retrieve plugin data
   * @param key - Data key
   */
  getData(key: string): Promise<any>;
  
  /**
   * Schedule a recurring task
   * @param intervalMs - Interval in milliseconds
   * @param callback - Function to call
   * @returns Task ID for cancellation
   */
  setInterval(intervalMs: number, callback: () => void): number;
  
  /**
   * Cancel a scheduled task
   * @param taskId - Task ID returned from setInterval
   */
  clearInterval(taskId: number): void;
}

/**
 * Plugin initialization context
 */
export interface PluginContext {
  /** Plugin API instance */
  api: PluginAPI;
  
  /** Plugin metadata */
  metadata: PluginMetadata;
  
  /** Server ID this plugin is running for */
  serverId: string;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginHooks {
  /**
   * Called when the plugin is loaded
   */
  onLoad?(context: PluginContext): void | Promise<void>;
  
  /**
   * Called when the plugin is enabled
   */
  onEnable?(context: PluginContext): void | Promise<void>;
  
  /**
   * Called when the plugin is disabled
   */
  onDisable?(context: PluginContext): void | Promise<void>;
  
  /**
   * Called when the plugin is unloaded
   */
  onUnload?(context: PluginContext): void | Promise<void>;
}

/**
 * Complete plugin definition
 */
export interface Plugin extends PluginHooks {
  /** Plugin metadata */
  metadata: PluginMetadata;
}

/**
 * Register a plugin with BedrockProxy
 * 
 * @example
 * ```javascript
 * registerPlugin(() => ({
 *   metadata: {
 *     name: 'MyPlugin',
 *     version: '1.0.0',
 *     description: 'My custom plugin',
 *     author: 'Your Name'
 *   },
 *   onEnable: async (context) => {
 *     context.api.log('info', 'Plugin enabled!');
 *     
 *     // Listen for player joins
 *     context.api.on('playerJoin', (player) => {
 *       context.api.log('info', `Player ${player.name} joined`);
 *     });
 *   },
 *   onDisable: async (context) => {
 *     context.api.log('info', 'Plugin disabled!');
 *   }
 * }));
 * ```
 */
export function registerPlugin(factory: () => Plugin): void;

/**
 * Global plugin registration function
 * This is the main entry point for plugins
 */
declare global {
  function registerPlugin(factory: () => Plugin): void;
}
