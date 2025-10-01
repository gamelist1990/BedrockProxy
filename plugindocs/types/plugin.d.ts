/**
 * Plugin metadata and lifecycle definitions
 */

/**
 * Plugin metadata read from package.json or defined inline
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
  
  /** Plugin homepage or repository URL */
  homepage?: string;
  
  /** Plugin license */
  license?: string;
  
  /** Plugin dependencies (other plugins) */
  dependencies?: Record<string, string>;
  
  /** Plugin keywords for search */
  keywords?: string[];
  
  /** Minimum BedrockProxy version required */
  minBedrockProxyVersion?: string;
}

/**
 * Plugin context provided to lifecycle hooks
 */
export interface PluginContext {
  /** Plugin metadata */
  metadata: PluginMetadata;
  
  /** Plugin API instance */
  api: import('./api').PluginAPI;
  
  /** Plugin data directory path */
  dataDir: string;
  
  /** Plugin directory path */
  pluginDir: string;
  
  /** Server ID this plugin is attached to */
  serverId: string;
  
  /** Store for plugin-specific data (persists between reloads) */
  storage: Map<string, any>;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
  /**
   * Called when plugin is first loaded (before enable)
   * Use for: initialization, validation, dependency checks
   */
  onLoad?(context: PluginContext): Promise<void> | void;
  
  /**
   * Called when plugin is enabled
   * Use for: starting services, registering listeners, scheduling tasks
   */
  onEnable?(context: PluginContext): Promise<void> | void;
  
  /**
   * Called when plugin is disabled
   * Use for: cleanup, unregistering listeners, stopping tasks
   */
  onDisable?(context: PluginContext): Promise<void> | void;
  
  /**
   * Called when plugin is unloaded (after disable)
   * Use for: final cleanup, releasing resources
   */
  onUnload?(context: PluginContext): Promise<void> | void;
  
  /**
   * Called when plugin configuration is reloaded
   * Use for: refreshing settings without full restart
   */
  onReload?(context: PluginContext): Promise<void> | void;
}

/**
 * Complete plugin definition
 */
export interface Plugin extends PluginLifecycle {
  /** Plugin metadata */
  metadata: PluginMetadata;
}

/**
 * Plugin registration function
 * @param factory - Function that returns plugin definition
 */
export function registerPlugin(factory: () => Plugin): void;

/**
 * Global plugin registration (injected by BedrockProxy)
 */
declare global {
  function registerPlugin(factory: () => Plugin): void;
}
