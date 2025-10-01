/**
 * File System API Implementation
 * Provides sandboxed file system operations within plugin directory
 */

import { 
  readFile, 
  writeFile, 
  appendFile,
  unlink,
  stat as fsStat,
  mkdir,
  readdir,
  rmdir,
  copyFile as fsCopyFile,
  rename,
  watch as fsWatch
} from "fs/promises";
import { join, resolve, relative } from "path";
import { watch as fsWatchLegacy } from "fs";

export type FileEncoding = 'utf8' | 'ascii' | 'base64' | 'binary' | 'hex';

export interface FileStats {
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  createdAt: Date;
  modifiedAt: Date;
  accessedAt: Date;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}

export interface WriteFileOptions {
  encoding?: FileEncoding;
  mode?: number;
  recursive?: boolean;
}

export interface ReadFileOptions {
  encoding?: FileEncoding;
}

export class FileSystemAPI {
  private pluginDir: string;
  private watchers = new Map<number, ReturnType<typeof fsWatchLegacy>>();
  private nextWatcherId = 1;
  
  constructor(pluginDir: string) {
    this.pluginDir = pluginDir;
  }
  
  /**
   * Validate path is within plugin directory (security)
   */
  private validatePath(path: string): string {
    const fullPath = resolve(this.pluginDir, path);
    const relativePath = relative(this.pluginDir, fullPath);
    
    if (relativePath.startsWith('..') || resolve(relativePath) === relativePath) {
      throw new Error('Path traversal not allowed: path must be within plugin directory');
    }
    
    return fullPath;
  }
  
  /**
   * Read file contents
   */
  async readFile(path: string, options: ReadFileOptions = {}): Promise<string | Buffer> {
    const fullPath = this.validatePath(path);
    const encoding = options.encoding || 'utf8';
    
    if (encoding === 'utf8' || encoding === 'ascii') {
      return await readFile(fullPath, { encoding });
    } else {
      return await readFile(fullPath);
    }
  }
  
  /**
   * Write file contents
   */
  async writeFile(path: string, data: string | Buffer, options: WriteFileOptions = {}): Promise<void> {
    const fullPath = this.validatePath(path);
    
    // Create directories if recursive is true
    if (options.recursive) {
      const dir = join(fullPath, '..');
      await mkdir(dir, { recursive: true });
    }
    
    const writeOptions: any = {};
    if (options.encoding) {
      writeOptions.encoding = options.encoding;
    }
    if (options.mode) {
      writeOptions.mode = options.mode;
    }
    
    await writeFile(fullPath, data, writeOptions);
  }
  
  /**
   * Append to file
   */
  async appendFile(path: string, data: string | Buffer, options: WriteFileOptions = {}): Promise<void> {
    const fullPath = this.validatePath(path);
    
    const writeOptions: any = {};
    if (options.encoding) {
      writeOptions.encoding = options.encoding;
    }
    
    await appendFile(fullPath, data, writeOptions);
  }
  
  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    const fullPath = this.validatePath(path);
    await unlink(fullPath);
  }
  
  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    try {
      const fullPath = this.validatePath(path);
      await fsStat(fullPath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get file stats
   */
  async stat(path: string): Promise<FileStats> {
    const fullPath = this.validatePath(path);
    const stats = await fsStat(fullPath);
    
    return {
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      accessedAt: stats.atime
    };
  }
  
  /**
   * Create directory
   */
  async mkdir(path: string, recursive: boolean = false): Promise<void> {
    const fullPath = this.validatePath(path);
    await mkdir(fullPath, { recursive });
  }
  
  /**
   * Read directory contents
   */
  async readDir(path: string): Promise<DirectoryEntry[]> {
    const fullPath = this.validatePath(path);
    const entries = await readdir(fullPath, { withFileTypes: true });
    
    return entries.map(entry => ({
      name: entry.name,
      path: join(path, entry.name),
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile()
    }));
  }
  
  /**
   * Delete directory
   */
  async rmdir(path: string, recursive: boolean = false): Promise<void> {
    const fullPath = this.validatePath(path);
    await rmdir(fullPath, { recursive });
  }
  
  /**
   * Copy file
   */
  async copyFile(source: string, destination: string): Promise<void> {
    const sourcePath = this.validatePath(source);
    const destPath = this.validatePath(destination);
    await fsCopyFile(sourcePath, destPath);
  }
  
  /**
   * Move/rename file
   */
  async moveFile(source: string, destination: string): Promise<void> {
    const sourcePath = this.validatePath(source);
    const destPath = this.validatePath(destination);
    await rename(sourcePath, destPath);
  }
  
  /**
   * Read JSON file
   */
  async readJSON<T = any>(path: string): Promise<T> {
    const content = await this.readFile(path, { encoding: 'utf8' }) as string;
    return JSON.parse(content);
  }
  
  /**
   * Write JSON file
   */
  async writeJSON(path: string, data: any, pretty: boolean = false): Promise<void> {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await this.writeFile(path, content, { encoding: 'utf8', recursive: true });
  }
  
  /**
   * Watch file or directory for changes
   */
  watch(path: string, callback: (event: 'change' | 'rename', filename: string) => void): number {
    const fullPath = this.validatePath(path);
    const watcherId = this.nextWatcherId++;
    
    const watcher = fsWatchLegacy(fullPath, (eventType, filename) => {
      if (eventType === 'change' || eventType === 'rename') {
        callback(eventType, filename || path);
      }
    });
    
    this.watchers.set(watcherId, watcher);
    return watcherId;
  }
  
  /**
   * Stop watching file or directory
   */
  unwatch(watcherId: number): void {
    const watcher = this.watchers.get(watcherId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(watcherId);
    }
  }
  
  /**
   * Cleanup all watchers
   */
  cleanup(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
  }
}
