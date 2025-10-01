/**
 * Plugin Loader Service
 * Manages loading, execution, and lifecycle of plugins
 */

import { readdir, readFile, watch } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import type { Plugin, PluginMetadata } from '../types';

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private pluginContexts: Map<string, any> = new Map();
  private watchers: Map<string, any> = new Map();

  constructor(private serverId: string, private pluginDirectory: string) {}

  /**
   * Load all plugins from the plugin directory
   */
  async loadPlugins(): Promise<Plugin[]> {
    const plugins: Plugin[] = [];

    if (!existsSync(this.pluginDirectory)) {
      console.log(`Plugin directory not found: ${this.pluginDirectory}`);
      return plugins;
    }

    try {
      const files = await readdir(this.pluginDirectory);
      const jsFiles = files.filter(f => f.endsWith('.js'));

      for (const file of jsFiles) {
        try {
          const plugin = await this.loadPlugin(file);
          if (plugin) {
            plugins.push(plugin);
            this.plugins.set(plugin.id, plugin);
          }
        } catch (error) {
          console.error(`Failed to load plugin ${file}:`, error);
          plugins.push({
            id: file,
            metadata: { name: file, version: 'unknown' },
            enabled: false,
            filePath: join(this.pluginDirectory, file),
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
   * Load a single plugin file
   */
  private async loadPlugin(filename: string): Promise<Plugin | null> {
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

    // TODO: Execute plugin in sandboxed environment
    plugin.enabled = true;
    this.plugins.set(pluginId, plugin);

    console.log(`Plugin ${plugin.metadata.name} enabled`);
    return plugin;
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<Plugin> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // TODO: Stop plugin execution
    plugin.enabled = false;
    this.plugins.set(pluginId, plugin);

    console.log(`Plugin ${plugin.metadata.name} disabled`);
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
