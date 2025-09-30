import { readFile, access } from "fs/promises";
import { dirname, basename } from "path";
import { APIError } from "../types/index.js";

export interface MinecraftServerConfig {
  serverName?: string;
  serverPort?: number;
  maxPlayers?: number;
  gamemode?: "survival" | "creative" | "adventure" | "spectator";
  difficulty?: "peaceful" | "easy" | "normal" | "hard";
  worldName?: string;
  enableWhitelist?: boolean;
  motd?: string;
  levelSeed?: string;
  allowCheats?: boolean;
  serverAuthoritative?: boolean;
}

export interface DetectedServerInfo {
  executablePath: string;
  serverDirectory: string;
  propertiesPath: string;
  config: MinecraftServerConfig;
  suggestedProxyPort?: number;
}

export class MinecraftServerDetector {
  
  // サーバー実行ファイルの検証と設定検出
  public async detectServerConfig(executablePath: string): Promise<DetectedServerInfo> {
    try {
      // 実行ファイルの存在確認
      await access(executablePath);
      
      const fileName = basename(executablePath).toLowerCase();
      
      // 対応ファイル名の確認
      if (!this.isValidServerExecutable(fileName)) {
        throw new APIError(
          `Unsupported executable: ${fileName}. Expected bedrock_server.exe or server.exe`,
          "INVALID_EXECUTABLE",
          400
        );
      }

      const serverDirectory = dirname(executablePath);
      const propertiesPath = this.getPropertiesPath(serverDirectory);

      // server.properties の読み込み
      const config = await this.parseServerProperties(propertiesPath);
      
      // プロキシ用のポート番号を提案
      const suggestedProxyPort = this.suggestProxyPort(config.serverPort || 19132);

      console.log(`🎮 Detected Minecraft server: ${executablePath}`);
      console.log(`📋 Server config:`, config);

      return {
        executablePath,
        serverDirectory,
        propertiesPath,
        config,
        suggestedProxyPort
      };

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      
      console.error(`❌ Failed to detect server config:`, error);
      throw new APIError(
        `Failed to detect server configuration: ${error}`,
        "DETECTION_FAILED",
        500
      );
    }
  }

  // 実行ファイル名の検証
  private isValidServerExecutable(fileName: string): boolean {
    const validNames = [
      "bedrock_server.exe",
      "server.exe",
      "bedrock_server",
      "server"
    ];
    
    return validNames.includes(fileName);
  }

  // server.properties のパスを取得
  private getPropertiesPath(serverDirectory: string): string {
    return `${serverDirectory}/server.properties`;
  }

  // server.properties の解析
  private async parseServerProperties(propertiesPath: string): Promise<MinecraftServerConfig> {
    try {
      await access(propertiesPath);
      const content = await readFile(propertiesPath, 'utf-8');
      
      console.log(`📖 Reading server.properties: ${propertiesPath}`);
      
      const config: MinecraftServerConfig = {};
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // コメント行や空行をスキップ
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }

        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim();

        if (!key || value === undefined) {
          continue;
        }

        this.parseConfigValue(config, key.trim(), value);
      }

      return config;

    } catch (error) {
      console.warn(`⚠️ Could not read server.properties: ${error}`);
      
      // server.properties が見つからない場合はデフォルト値を返す
      return {
        serverName: "Minecraft Server",
        serverPort: 19132,
        maxPlayers: 10,
        gamemode: "survival",
        difficulty: "easy",
        worldName: "Bedrock level"
      };
    }
  }

  // 設定値の解析とマッピング
  private parseConfigValue(config: MinecraftServerConfig, key: string, value: string): void {
    switch (key.toLowerCase()) {
      case 'server-name':
        config.serverName = value || "Minecraft Server";
        break;
        
      case 'server-port':
      case 'server-portv4':
        const port = parseInt(value);
        if (!isNaN(port) && port > 0 && port <= 65535) {
          config.serverPort = port;
        }
        break;
        
      case 'max-players':
        const maxPlayers = parseInt(value);
        if (!isNaN(maxPlayers) && maxPlayers > 0) {
          config.maxPlayers = maxPlayers;
        }
        break;
        
      case 'gamemode':
        if (['survival', 'creative', 'adventure', 'spectator'].includes(value.toLowerCase())) {
          config.gamemode = value.toLowerCase() as any;
        }
        break;
        
      case 'difficulty':
        if (['peaceful', 'easy', 'normal', 'hard'].includes(value.toLowerCase())) {
          config.difficulty = value.toLowerCase() as any;
        }
        break;
        
      case 'level-name':
        config.worldName = value || "Bedrock level";
        break;
        
      case 'white-list':
      case 'whitelist':
        config.enableWhitelist = this.parseBoolean(value);
        break;
        
      case 'motd':
        config.motd = value;
        break;
        
      case 'level-seed':
        config.levelSeed = value;
        break;
        
      case 'allow-cheats':
        config.allowCheats = this.parseBoolean(value);
        break;
        
      case 'server-authoritative-movement':
        config.serverAuthoritative = this.parseBoolean(value);
        break;
    }
  }

  // boolean値の解析
  private parseBoolean(value: string): boolean {
    const normalized = value.toLowerCase().trim();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  // プロキシ用ポートの提案
  private suggestProxyPort(serverPort: number): number {
    // サーバーポートが19132の場合は19133を提案
    // それ以外の場合は +1 したポートを提案
    if (serverPort === 19132) {
      return 19133;
    }
    
    // ポート範囲の確認
    const suggestedPort = serverPort + 1;
    if (suggestedPort > 65535) {
      return serverPort - 1;
    }
    
    return suggestedPort;
  }

  // 推奨設定の生成
  public generateRecommendedConfig(detectedInfo: DetectedServerInfo): {
    name: string;
    address: string;
    destinationAddress: string;
    maxPlayers: number;
    description: string;
    tags: string[];
  } {
    const config = detectedInfo.config;
    
    return {
      name: config.serverName || "Minecraft Server",
      address: `127.0.0.1:${detectedInfo.suggestedProxyPort || 19133}`,
      destinationAddress: `127.0.0.1:${config.serverPort || 19132}`,
      maxPlayers: config.maxPlayers || 10,
      description: config.motd || `Auto-detected ${config.gamemode || 'survival'} server`,
      tags: [
        config.gamemode || 'survival',
        config.difficulty || 'easy',
        ...(config.enableWhitelist ? ['Whitelist'] : []),
        ...(config.allowCheats ? ['Cheats'] : []),
        'Auto-detected'
      ].filter(tag => tag).map(tag => 
        tag.charAt(0).toUpperCase() + tag.slice(1)
      )
    };
  }

  // 設定ファイルの妥当性チェック
  public async validateServerDirectory(serverDirectory: string): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // 必要なファイルの存在確認
      const requiredFiles = [
        'server.properties',
        'whitelist.json',
        'permissions.json'
      ];

      const optionalFiles = [
        'valid_known_packs.json',
        'resource_packs',
        'behavior_packs'
      ];

      for (const file of requiredFiles) {
        try {
          await access(`${serverDirectory}/${file}`);
        } catch {
          issues.push(`Missing required file: ${file}`);
        }
      }

      for (const file of optionalFiles) {
        try {
          await access(`${serverDirectory}/${file}`);
        } catch {
          recommendations.push(`Consider adding: ${file}`);
        }
      }

      // 設定ファイルの検証
      try {
        const config = await this.parseServerProperties(`${serverDirectory}/server.properties`);
        
        if (!config.serverName || config.serverName === "Dedicated Server") {
          recommendations.push("Consider setting a custom server-name");
        }
        
        if (!config.motd) {
          recommendations.push("Consider adding a server MOTD");
        }
        
        if (config.maxPlayers && config.maxPlayers > 100) {
          recommendations.push("High max-players setting may impact performance");
        }
        
      } catch (error) {
        issues.push(`Invalid server.properties: ${error}`);
      }

    } catch (error) {
      issues.push(`Failed to validate directory: ${error}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }
}

// シングルトンインスタンス
export const minecraftServerDetector = new MinecraftServerDetector();