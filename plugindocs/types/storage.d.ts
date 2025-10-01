/**
 * Storage API for persistent data
 */

/**
 * Storage options
 */
export interface StorageOptions {
  /** Encrypt data at rest */
  encrypt?: boolean;
  
  /** Compression */
  compress?: boolean;
  
  /** TTL in milliseconds (time to live) */
  ttl?: number;
}

/**
 * Storage API
 */
export interface StorageAPI {
  /**
   * Get a value from storage
   * @param key - Storage key
   * @param defaultValue - Default value if key doesn't exist
   */
  get<T = any>(key: string, defaultValue?: T): Promise<T | undefined>;
  
  /**
   * Set a value in storage
   * @param key - Storage key
   * @param value - Value to store
   * @param options - Storage options
   */
  set<T = any>(key: string, value: T, options?: StorageOptions): Promise<void>;
  
  /**
   * Check if key exists
   * @param key - Storage key
   */
  has(key: string): Promise<boolean>;
  
  /**
   * Delete a key from storage
   * @param key - Storage key
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * Clear all storage
   */
  clear(): Promise<void>;
  
  /**
   * Get all keys
   */
  keys(): Promise<string[]>;
  
  /**
   * Get all values
   */
  values(): Promise<any[]>;
  
  /**
   * Get all entries
   */
  entries(): Promise<Array<[string, any]>>;
  
  /**
   * Get storage size in bytes
   */
  size(): Promise<number>;
  
  /**
   * Create a namespaced storage
   * @param namespace - Namespace prefix
   */
  namespace(namespace: string): StorageAPI;
}
