/**
 * Storage API Implementation
 * Provides persistent storage with encryption, compression, and TTL support
 */

import { join } from "path";
import { readFile, writeFile, mkdir, readdir, unlink, stat } from "fs/promises";
import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { gzip, gunzip } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface StorageOptions {
  encrypt?: boolean;
  compress?: boolean;
  ttl?: number;
}

interface StorageEntry {
  value: any;
  createdAt: number;
  ttl?: number;
  encrypted?: boolean;
  compressed?: boolean;
}

export class StorageAPI {
  private storageDir: string;
  private namespacePrefix: string;
  private encryptionKey: Buffer;
  
  constructor(storageDir: string, namespacePrefix: string = "") {
    this.storageDir = storageDir;
    this.namespacePrefix = namespacePrefix;
    // Generate encryption key from environment or default
    const keyString = process.env.STORAGE_KEY || "bedrock-proxy-default-key-change-me";
    this.encryptionKey = createHash('sha256').update(keyString).digest();
  }
  
  /**
   * Initialize storage directory
   */
  async initialize(): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });
  }
  
  /**
   * Get full key with namespace
   */
  private getFullKey(key: string): string {
    return this.namespacePrefix ? `${this.namespacePrefix}:${key}` : key;
  }
  
  /**
   * Get file path for key
   */
  private getFilePath(key: string): string {
    const fullKey = this.getFullKey(key);
    const hash = createHash('md5').update(fullKey).digest('hex');
    return join(this.storageDir, `${hash}.json`);
  }
  
  /**
   * Encrypt data
   */
  private encrypt(data: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }
  
  /**
   * Decrypt data
   */
  private decrypt(data: string): string {
    const parts = data.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  
  /**
   * Get a value from storage
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      const filePath = this.getFilePath(key);
      const content = await readFile(filePath, 'utf-8');
      const entry: StorageEntry = JSON.parse(content);
      
      // Check TTL
      if (entry.ttl && Date.now() - entry.createdAt > entry.ttl) {
        await this.delete(key);
        return defaultValue;
      }
      
      let value = entry.value;
      
      // Decompress if needed
      if (entry.compressed) {
        const buffer = Buffer.from(value, 'base64');
        const decompressed = await gunzipAsync(buffer);
        value = decompressed.toString('utf-8');
      }
      
      // Decrypt if needed
      if (entry.encrypted) {
        value = this.decrypt(value);
      }
      
      // Parse if it's a string
      if (typeof value === 'string') {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }
      
      return value as T;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  }
  
  /**
   * Set a value in storage
   */
  async set<T = any>(key: string, value: T, options: StorageOptions = {}): Promise<void> {
    await this.initialize();
    
    let processedValue: any = typeof value === 'string' ? value : JSON.stringify(value);
    
    // Encrypt if requested
    if (options.encrypt) {
      processedValue = this.encrypt(processedValue);
    }
    
    // Compress if requested
    if (options.compress) {
      const buffer = Buffer.from(processedValue, 'utf-8');
      const compressed = await gzipAsync(buffer);
      processedValue = compressed.toString('base64');
    }
    
    const entry: StorageEntry = {
      value: processedValue,
      createdAt: Date.now(),
      ttl: options.ttl,
      encrypted: options.encrypt,
      compressed: options.compress
    };
    
    const filePath = this.getFilePath(key);
    await writeFile(filePath, JSON.stringify(entry), 'utf-8');
  }
  
  /**
   * Check if key exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await stat(filePath);
      
      // Check TTL
      const value = await this.get(key);
      return value !== undefined;
    } catch {
      return false;
    }
  }
  
  /**
   * Delete a key from storage
   */
  async delete(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    try {
      const files = await readdir(this.storageDir);
      await Promise.all(
        files.map(file => unlink(join(this.storageDir, file)))
      );
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  }
  
  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    try {
      const files = await readdir(this.storageDir);
      return files.map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }
  
  /**
   * Get all values
   */
  async values(): Promise<any[]> {
    const keys = await this.keys();
    const values = await Promise.all(keys.map(key => this.get(key)));
    return values.filter(v => v !== undefined);
  }
  
  /**
   * Get all entries
   */
  async entries(): Promise<Array<[string, any]>> {
    const keys = await this.keys();
    const entries = await Promise.all(
      keys.map(async key => [key, await this.get(key)] as [string, any])
    );
    return entries.filter(([_, value]) => value !== undefined);
  }
  
  /**
   * Get storage size in bytes
   */
  async size(): Promise<number> {
    try {
      const files = await readdir(this.storageDir);
      const sizes = await Promise.all(
        files.map(async file => {
          const filePath = join(this.storageDir, file);
          const stats = await stat(filePath);
          return stats.size;
        })
      );
      return sizes.reduce((sum, size) => sum + size, 0);
    } catch {
      return 0;
    }
  }
  
  /**
   * Create a namespaced storage
   */
  namespace(namespace: string): StorageAPI {
    const newNamespace = this.namespacePrefix 
      ? `${this.namespacePrefix}:${namespace}` 
      : namespace;
    return new StorageAPI(this.storageDir, newNamespace);
  }
}
