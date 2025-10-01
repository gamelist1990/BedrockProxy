/**
 * File System API (sandboxed to plugin directory)
 */

/**
 * File stats
 */
export interface FileStats {
  /** File size in bytes */
  size: number;
  
  /** Is directory */
  isDirectory: boolean;
  
  /** Is file */
  isFile: boolean;
  
  /** Creation time */
  createdAt: Date;
  
  /** Last modified time */
  modifiedAt: Date;
  
  /** Last accessed time */
  accessedAt: Date;
}

/**
 * Directory entry
 */
export interface DirectoryEntry {
  /** Entry name */
  name: string;
  
  /** Entry path */
  path: string;
  
  /** Is directory */
  isDirectory: boolean;
  
  /** Is file */
  isFile: boolean;
}

/**
 * File encoding
 */
export type FileEncoding = 'utf8' | 'ascii' | 'base64' | 'binary' | 'hex';

/**
 * File write options
 */
export interface WriteFileOptions {
  /** File encoding */
  encoding?: FileEncoding;
  
  /** File mode (permissions) */
  mode?: number;
  
  /** Create directories if they don't exist */
  recursive?: boolean;
}

/**
 * File read options
 */
export interface ReadFileOptions {
  /** File encoding */
  encoding?: FileEncoding;
}

/**
 * File System API
 */
export interface FileSystemAPI {
  /**
   * Read file contents
   * @param path - File path (relative to plugin directory)
   * @param options - Read options
   */
  readFile(path: string, options?: ReadFileOptions): Promise<string | Buffer>;
  
  /**
   * Write file contents
   * @param path - File path (relative to plugin directory)
   * @param data - File contents
   * @param options - Write options
   */
  writeFile(path: string, data: string | Buffer, options?: WriteFileOptions): Promise<void>;
  
  /**
   * Append to file
   * @param path - File path (relative to plugin directory)
   * @param data - Data to append
   * @param options - Write options
   */
  appendFile(path: string, data: string | Buffer, options?: WriteFileOptions): Promise<void>;
  
  /**
   * Delete a file
   * @param path - File path (relative to plugin directory)
   */
  deleteFile(path: string): Promise<void>;
  
  /**
   * Check if file exists
   * @param path - File path (relative to plugin directory)
   */
  exists(path: string): Promise<boolean>;
  
  /**
   * Get file stats
   * @param path - File path (relative to plugin directory)
   */
  stat(path: string): Promise<FileStats>;
  
  /**
   * Create directory
   * @param path - Directory path (relative to plugin directory)
   * @param recursive - Create parent directories
   */
  mkdir(path: string, recursive?: boolean): Promise<void>;
  
  /**
   * Read directory contents
   * @param path - Directory path (relative to plugin directory)
   */
  readDir(path: string): Promise<DirectoryEntry[]>;
  
  /**
   * Delete directory
   * @param path - Directory path (relative to plugin directory)
   * @param recursive - Delete recursively
   */
  rmdir(path: string, recursive?: boolean): Promise<void>;
  
  /**
   * Copy file
   * @param source - Source path (relative to plugin directory)
   * @param destination - Destination path (relative to plugin directory)
   */
  copyFile(source: string, destination: string): Promise<void>;
  
  /**
   * Move/rename file
   * @param source - Source path (relative to plugin directory)
   * @param destination - Destination path (relative to plugin directory)
   */
  moveFile(source: string, destination: string): Promise<void>;
  
  /**
   * Read JSON file
   * @param path - File path (relative to plugin directory)
   */
  readJSON<T = any>(path: string): Promise<T>;
  
  /**
   * Write JSON file
   * @param path - File path (relative to plugin directory)
   * @param data - Data to write
   * @param pretty - Format JSON with indentation
   */
  writeJSON(path: string, data: any, pretty?: boolean): Promise<void>;
  
  /**
   * Watch file or directory for changes
   * @param path - Path to watch (relative to plugin directory)
   * @param callback - Callback function
   * @returns Watcher ID for cleanup
   */
  watch(path: string, callback: (event: 'change' | 'rename', filename: string) => void): number;
  
  /**
   * Stop watching file or directory
   * @param watcherId - Watcher ID from watch()
   */
  unwatch(watcherId: number): void;
}
