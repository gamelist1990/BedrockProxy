import { join } from "path";
import { mkdir, readFile, writeFile, access } from "fs/promises";
import { homedir } from "os";
import type { Server } from "../types/index.js";

export interface AppConfig {
  language: string;
  theme: string;
  autoStart: boolean;
  checkUpdates: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
}

export interface DataStore {
  servers: Server[];
  config: AppConfig;
  version: string;
  lastModified: string;
}

export class DataStorage {
  private dataDir: string;
  private configPath: string;
  private serversPath: string;
  private cache: DataStore | null = null;

  constructor() {
    // ドキュメントフォルダの PEXData/BedrockProxy を使用
    this.dataDir = join(homedir(), "Documents", "PEXData", "BedrockProxy");
    this.configPath = join(this.dataDir, "config.json");
    this.serversPath = join(this.dataDir, "servers.json");
  }

  // 初期化（ディレクトリ作成）
  public async initialize(): Promise<void> {
    try {
      await mkdir(this.dataDir, { recursive: true });
      console.log(`📁 Data directory initialized: ${this.dataDir}`);
      
      // 初期データファイルの作成
      await this.ensureDefaultFiles();
    } catch (error) {
      console.error("❌ Failed to initialize data directory:", error);
      throw error;
    }
  }

  // デフォルトファイルの作成
  private async ensureDefaultFiles(): Promise<void> {
    // config.json の作成
    try {
      await access(this.configPath);
    } catch {
      const defaultConfig: AppConfig = {
        language: "ja-JP",
        theme: "light",
        autoStart: false,
        checkUpdates: true,
        logLevel: "info"
      };
      await this.saveConfig(defaultConfig);
      console.log("📄 Created default config.json");
    }

    // servers.json の作成
    try {
      await access(this.serversPath);
    } catch {
      await this.saveServers([]);
      console.log("📄 Created default servers.json");
    }
  }

  // 設定の読み込み
  public async loadConfig(): Promise<AppConfig> {
    try {
      const data = await readFile(this.configPath, 'utf-8');
      const config = JSON.parse(data);
      console.log("📖 Config loaded successfully");
      return config;
    } catch (error) {
      console.warn("⚠️ Failed to load config, using defaults:", error);
      return {
        language: "ja-JP",
        theme: "light",
        autoStart: false,
        checkUpdates: true,
        logLevel: "info"
      };
    }
  }

  // 設定の保存
  public async saveConfig(config: AppConfig): Promise<void> {
    try {
      const data = JSON.stringify(config, null, 2);
      await writeFile(this.configPath, data, 'utf-8');
      console.log("💾 Config saved successfully");
      
      // キャッシュ更新
      if (this.cache) {
        this.cache.config = config;
        this.cache.lastModified = new Date().toISOString();
      }
    } catch (error) {
      console.error("❌ Failed to save config:", error);
      throw error;
    }
  }

  // サーバー一覧の読み込み
  public async loadServers(): Promise<Server[]> {
    try {
      const data = await readFile(this.serversPath, 'utf-8');
      const servers = JSON.parse(data);
      
      // 日付オブジェクトに変換
      const processedServers = servers.map((server: any) => ({
        ...server,
        createdAt: new Date(server.createdAt),
        updatedAt: new Date(server.updatedAt),
        players: server.players?.map((player: any) => ({
          ...player,
          joinTime: new Date(player.joinTime)
        })) || []
      }));

      console.log(`📖 Loaded ${processedServers.length} servers from storage`);
      return processedServers;
    } catch (error) {
      console.warn("⚠️ Failed to load servers, using empty array:", error);
      return [];
    }
  }

  // サーバー一覧の保存
  public async saveServers(servers: Server[]): Promise<void> {
    try {
      // 日付を文字列に変換してシリアライズ
      const serializableServers = servers.map(server => ({
        ...server,
        createdAt: server.createdAt.toISOString(),
        updatedAt: server.updatedAt.toISOString(),
        players: server.players?.map(player => ({
          ...player,
          joinTime: player.joinTime.toISOString()
        })) || []
      }));

      const data = JSON.stringify(serializableServers, null, 2);
      await writeFile(this.serversPath, data, 'utf-8');
      console.log(`💾 Saved ${servers.length} servers to storage`);
      
      // キャッシュ更新
      if (this.cache) {
        this.cache.servers = servers;
        this.cache.lastModified = new Date().toISOString();
      }
    } catch (error) {
      console.error("❌ Failed to save servers:", error);
      throw error;
    }
  }

  // 全データの読み込み
  public async loadAll(): Promise<DataStore> {
    if (this.cache) {
      return this.cache;
    }

    const [config, servers] = await Promise.all([
      this.loadConfig(),
      this.loadServers()
    ]);

    this.cache = {
      config,
      servers,
      version: "1.0.0",
      lastModified: new Date().toISOString()
    };

    return this.cache;
  }

  // 全データの保存
  public async saveAll(dataStore: Partial<DataStore>): Promise<void> {
    const promises: Promise<void>[] = [];

    if (dataStore.config) {
      promises.push(this.saveConfig(dataStore.config));
    }

    if (dataStore.servers) {
      promises.push(this.saveServers(dataStore.servers));
    }

    await Promise.all(promises);
    
    // キャッシュ更新
    if (this.cache) {
      Object.assign(this.cache, dataStore);
      this.cache.lastModified = new Date().toISOString();
    }
  }

  // キャッシュクリア
  public clearCache(): void {
    this.cache = null;
    console.log("🗑️ Data cache cleared");
  }

  // データディレクトリのパスを取得
  public getDataDirectory(): string {
    return this.dataDir;
  }

  // バックアップ作成
  public async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = join(this.dataDir, "backups");
    const backupPath = join(backupDir, `backup_${timestamp}.json`);

    try {
      await mkdir(backupDir, { recursive: true });
      
      const dataStore = await this.loadAll();
      const backupData = {
        ...dataStore,
        backupCreatedAt: new Date().toISOString(),
        originalVersion: dataStore.version
      };

      await writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
      console.log(`💾 Backup created: ${backupPath}`);
      
      return backupPath;
    } catch (error) {
      console.error("❌ Failed to create backup:", error);
      throw error;
    }
  }

  // バックアップから復元
  public async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      const data = await readFile(backupPath, 'utf-8');
      const backupData = JSON.parse(data);

      // 現在のデータのバックアップを作成
      await this.createBackup();

      // データを復元
      if (backupData.config) {
        await this.saveConfig(backupData.config);
      }

      if (backupData.servers) {
        // 日付オブジェクトに変換
        const servers = backupData.servers.map((server: any) => ({
          ...server,
          createdAt: new Date(server.createdAt),
          updatedAt: new Date(server.updatedAt),
          players: server.players?.map((player: any) => ({
            ...player,
            joinTime: new Date(player.joinTime)
          })) || []
        }));
        
        await this.saveServers(servers);
      }

      this.clearCache();
      console.log(`✅ Data restored from backup: ${backupPath}`);
    } catch (error) {
      console.error("❌ Failed to restore from backup:", error);
      throw error;
    }
  }

  // データの整合性チェック
  public async validateData(): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const config = await this.loadConfig();
      
      // 設定の検証
      if (!config.language || typeof config.language !== 'string') {
        errors.push("Invalid language setting");
      }
      
      if (!['light', 'dark'].includes(config.theme)) {
        errors.push("Invalid theme setting");
      }

      const servers = await this.loadServers();
      
      // サーバーデータの検証
      servers.forEach((server, index) => {
        if (!server.id || typeof server.id !== 'string') {
          errors.push(`Server ${index}: Invalid ID`);
        }
        
        if (!server.name || typeof server.name !== 'string') {
          errors.push(`Server ${index}: Invalid name`);
        }
        
        if (!server.address || !this.isValidAddress(server.address)) {
          errors.push(`Server ${index}: Invalid address`);
        }
        
        if (!server.destinationAddress || !this.isValidAddress(server.destinationAddress)) {
          errors.push(`Server ${index}: Invalid destination address`);
        }
      });

    } catch (error) {
      errors.push(`Data validation failed: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidAddress(address: string): boolean {
    const regex = /^[\w.-]+:\d+$/;
    return regex.test(address);
  }
}

// シングルトンインスタンス
export const dataStorage = new DataStorage();