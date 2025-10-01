/**
 * Plugin Loader Service
 * Manages loading, execution, and lifecycle of plugins
 * Supports both single-file and folder-based plugins with node_modules
 */

import { readdir, readFile, watch, stat } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { Module } from 'module';
import { PluginAPI } from '../API/pluginAPI.js';
import type { Plugin, PluginMetadata } from '../types';

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private pluginContexts: Map<string, any> = new Map();
  private pluginAPIs: Map<string, PluginAPI> = new Map();
  private watchers: Map<string, any> = new Map();

  constructor(
    private serverId: string, 
    private pluginDirectory: string,
    private serverManager: any,
    private storageDir: string
  ) {}

  /**
   * Load all plugins from the plugin directory
   * Supports both:
   * - Direct JS files: plugins/myplugin.js
   * - Folder structure: plugins/myplugin/index.js (with optional node_modules)
   */
  async loadPlugins(): Promise<Plugin[]> {
    const plugins: Plugin[] = [];

    if (!existsSync(this.pluginDirectory)) {
      console.log(`Plugin directory not found: ${this.pluginDirectory}`);
      return plugins;
    }

    try {
      const entries = await readdir(this.pluginDirectory, { withFileTypes: true });

      for (const entry of entries) {
        try {
          let plugin: Plugin | null = null;

          if (entry.isDirectory()) {
            // Check for index.js in the folder
            const indexPath = join(this.pluginDirectory, entry.name, 'index.js');
            if (existsSync(indexPath)) {
              plugin = await this.loadPluginFromFolder(entry.name);
            }
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            // Legacy support: direct .js files
            plugin = await this.loadPluginFile(entry.name);
          }

          if (plugin) {
            plugins.push(plugin);
            this.plugins.set(plugin.id, plugin);
          }
        } catch (error) {
          console.error(`Failed to load plugin ${entry.name}:`, error);
          plugins.push({
            id: entry.name,
            metadata: { name: entry.name, version: 'unknown' },
            enabled: false,
            filePath: join(this.pluginDirectory, entry.name),
            loaded: false,
            error: String(error)
          });
        }
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }

    return plugins;
  }

  /**
   * Load a plugin from a folder structure
   * Folder structure: plugins/pluginName/index.js
   * Optional: plugins/pluginName/package.json for metadata
   * Optional: plugins/pluginName/node_modules/ for dependencies
   */
  private async loadPluginFromFolder(folderName: string): Promise<Plugin | null> {
    const pluginPath = join(this.pluginDirectory, folderName);
    const indexPath = join(pluginPath, 'index.js');
    const packageJsonPath = join(pluginPath, 'package.json');
    const nodeModulesPath = join(pluginPath, 'node_modules');
    
    try {
      const code = await readFile(indexPath, 'utf-8');
      
      // Check if plugin has its own node_modules
      const hasNodeModules = existsSync(nodeModulesPath);
      
      // Try to load metadata from package.json first
      let metadata: PluginMetadata;
      
      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
          metadata = {
            name: packageJson.name || folderName,
            version: packageJson.version || '1.0.0',
            description: packageJson.description,
            author: packageJson.author?.name || packageJson.author,
            homepage: packageJson.homepage,
            license: packageJson.license,
            dependencies: packageJson.bedrockproxy?.dependencies || packageJson.peerDependencies,
            keywords: packageJson.keywords,
            minBedrockProxyVersion: packageJson.bedrockproxy?.minVersion
          };
          
          console.log(`📦 Loaded plugin metadata from package.json: ${metadata.name}@${metadata.version}`);
        } catch (error) {
          console.warn(`Failed to parse package.json for ${folderName}, falling back to code parsing:`, error);
          metadata = this.parsePluginMetadata(code);
        }
      } else {
        // Fall back to parsing metadata from code
        metadata = this.parsePluginMetadata(code);
      }
      
      const plugin: Plugin = {
        id: folderName,
        metadata,
        enabled: false,
        filePath: indexPath,
        loaded: true,
        hasNodeModules,
        pluginPath // Store the full plugin directory path
      };

      console.log(`✅ Loaded plugin: ${metadata.name}@${metadata.version}${hasNodeModules ? ' (with node_modules)' : ''}`);
      return plugin;
    } catch (error) {
      console.error(`❌ Error loading plugin folder ${folderName}:`, error);
      return null;
    }
  }

  /**
   * Load a single plugin file (legacy support)
   */
  private async loadPluginFile(filename: string): Promise<Plugin | null> {
    const filePath = join(this.pluginDirectory, filename);
    
    try {
      const code = await readFile(filePath, 'utf-8');
      
      // Parse plugin metadata
      const metadata = this.parsePluginMetadata(code);
      
      const plugin: Plugin = {
        id: basename(filename, '.js'),
        metadata,
        enabled: false,
        filePath,
        loaded: true
      };

      console.log(`Loaded plugin file: ${filename}`);
      return plugin;
    } catch (error) {
      console.error(`Error loading plugin ${filename}:`, error);
      return null;
    }
  }

  /**
   * Parse plugin metadata from code
   */
  private parsePluginMetadata(code: string): PluginMetadata {
    let metadata: PluginMetadata = {
      name: 'Unknown Plugin',
      version: '1.0.0'
    };

    // Try to extract metadata from registerPlugin call
    const registerMatch = code.match(/registerPlugin\s*\(\s*\(\s*\)\s*=>\s*\({([^}]+)}\)/s);
    if (registerMatch) {
      const metadataStr = registerMatch[1];
      
      // Extract name
      const nameMatch = metadataStr.match(/name\s*:\s*['"]([^'"]+)['"]/);
      if (nameMatch) metadata.name = nameMatch[1];
      
      // Extract version
      const versionMatch = metadataStr.match(/version\s*:\s*['"]([^'"]+)['"]/);
      if (versionMatch) metadata.version = versionMatch[1];
      
      // Extract description
      const descMatch = metadataStr.match(/description\s*:\s*['"]([^'"]+)['"]/);
      if (descMatch) metadata.description = descMatch[1];
      
      // Extract author
      const authorMatch = metadataStr.match(/author\s*:\s*['"]([^'"]+)['"]/);
      if (authorMatch) metadata.author = authorMatch[1];
    }

    return metadata;
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<Plugin> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!plugin.loaded) {
      throw new Error(`Plugin ${pluginId} failed to load`);
    }

    try {
      // Create Plugin API instance
      const api = new PluginAPI(
        plugin.metadata.name,
        plugin.pluginPath || dirname(plugin.filePath),
        this.serverId,
        this.serverManager,
        this.storageDir
      );
      
      this.pluginAPIs.set(pluginId, api);
      
      // Load and execute plugin code
      const code = await readFile(plugin.filePath, 'utf-8');
      
      // Create plugin context with API
      const pluginContext: any = {
        api,
        require: (moduleName: string) => {
          // Allow requiring from plugin's node_modules if it exists
          if (plugin.pluginPath && plugin.hasNodeModules) {
            try {
              const modulePath = join(plugin.pluginPath, 'node_modules', moduleName);
              return require(modulePath);
            } catch (error) {
              // Fall back to global require
              return require(moduleName);
            }
          }
          return require(moduleName);
        },
        console: {
          log: (...args: any[]) => api.info(args.join(' ')),
          error: (...args: any[]) => api.error(args.join(' ')),
          warn: (...args: any[]) => api.warn(args.join(' ')),
          info: (...args: any[]) => api.info(args.join(' ')),
          debug: (...args: any[]) => api.debug(args.join(' '))
        },
        setTimeout: (callback: Function, ms: number) => api.setTimeout(ms, () => callback()),
        setInterval: (callback: Function, ms: number) => api.setInterval(ms, () => callback()),
        clearTimeout: (id: number) => api.clearTimer(id),
        clearInterval: (id: number) => api.clearTimer(id)
      };
      
      // Register the registerPlugin function
      let pluginInstance: any = null;
      pluginContext.registerPlugin = (factory: Function) => {
        pluginInstance = factory();
      };
      
      // Execute plugin code in context
      const func = new Function(...Object.keys(pluginContext), code);
      func(...Object.values(pluginContext));
      
      // Create full context for lifecycle callbacks
      const lifecycleContext = {
        api,
        serverId: this.serverId,
        metadata: plugin.metadata,
        pluginDir: plugin.pluginPath || dirname(plugin.filePath),
        dataDir: join(this.storageDir, pluginId)
      };
      
      // Call onLoad if it exists
      if (pluginInstance && pluginInstance.onLoad) {
        await pluginInstance.onLoad(lifecycleContext);
      }
      
      // Call onEnable if it exists
      if (pluginInstance && pluginInstance.onEnable) {
        await pluginInstance.onEnable(lifecycleContext);
      }
      
      this.pluginContexts.set(pluginId, pluginInstance);
      plugin.enabled = true;
      this.plugins.set(pluginId, plugin);

      console.log(`✅ Plugin ${plugin.metadata.name} enabled`);
      return plugin;
    } catch (error) {
      console.error(`❌ Failed to enable plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<Plugin> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Attempt graceful disable. Any errors from plugin code or cleanup
    // should be captured and logged, but we want to ensure the loader
    // state is consistent and return the plugin object rather than
    // throwing an unhandled exception which produces INTERNAL_ERROR to clients.
    const pluginInstance = this.pluginContexts.get(pluginId);
    const api = this.pluginAPIs.get(pluginId);
    
    if (pluginInstance && pluginInstance.onDisable) {
      try {
        const lifecycleContext = {
          api,
          serverId: this.serverId,
          metadata: plugin.metadata,
          pluginDir: plugin.pluginPath || dirname(plugin.filePath),
          dataDir: join(this.storageDir, pluginId)
        };
        await pluginInstance.onDisable(lifecycleContext);
      } catch (err) {
        console.error(`❌ Error in plugin.onDisable for ${pluginId}:`, err);
        // Record plugin-level error for UI/inspection
        plugin.error = String(err);
      }
    }

    // Cleanup API resources
    if (api) {
      try {
        api.cleanup();
      } catch (err) {
        console.error(`❌ Error during PluginAPI.cleanup for ${pluginId}:`, err);
        plugin.error = plugin.error ? plugin.error + '\n' + String(err) : String(err);
      }
      this.pluginAPIs.delete(pluginId);
    }

    // Finalize loader state
    this.pluginContexts.delete(pluginId);
    plugin.enabled = false;
    this.plugins.set(pluginId, plugin);

    console.log(`✅ Plugin ${plugin.metadata.name} disabled` + (plugin.error ? ` (with error)` : ''));
    return plugin;
  }

  /**
   * Get all plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a specific plugin
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }
  
  /**
   * Trigger event in all enabled plugins
   */
  triggerEvent(eventName: string, data: any): void {
    for (const [pluginId, api] of this.pluginAPIs.entries()) {
      try {
        api._triggerEvent(eventName, data);
      } catch (error) {
        console.error(`Error triggering event ${eventName} in plugin ${pluginId}:`, error);
      }
    }
  }
  
  /**
   * Get plugin API instance
   */
  getPluginAPI(pluginId: string): PluginAPI | undefined {
    return this.pluginAPIs.get(pluginId);
  }

  /**
   * Start watching for plugin file changes
   */
  async startWatching(): Promise<void> {
    if (!existsSync(this.pluginDirectory)) {
      return;
    }

    try {
      const watcher = watch(this.pluginDirectory);
      
      (async () => {
        for await (const event of watcher) {
          if (event.filename?.endsWith('.js')) {
            console.log(`Plugin file changed: ${event.filename}`);
            // TODO: Reload plugin
            await this.loadPlugins();
          }
        }
      })().catch(err => {
        console.error('Plugin watcher error:', err);
      });

      console.log(`Watching for plugin changes in ${this.pluginDirectory}`);
    } catch (error) {
      console.error('Failed to start plugin watcher:', error);
    }
  }

  /**
   * Stop watching
   */
  stopWatching(): void {
    // Cleanup watchers
    for (const [, watcher] of this.watchers) {
      if (watcher && watcher.close) {
        watcher.close();
      }
    }
    this.watchers.clear();
  }

  /**
   * Cleanup all plugins
   */
  async cleanup(): Promise<void> {
    // Disable all plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.enabled) {
        await this.disablePlugin(plugin.id);
      }
    }

    this.stopWatching();
    this.plugins.clear();
    this.pluginContexts.clear();
  }
}
