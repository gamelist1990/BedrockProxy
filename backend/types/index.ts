// WebSocket通信用の型定義

export type ServerStatus = "online" | "offline" | "starting" | "stopping" | "error";

export interface Player {
  id: string;
  name: string;
  xuid: string; // Xbox User ID
  joinTime: Date;
  leaveTime?: Date;
  ipAddress?: string;
  port?: number;
  icon?: string; // base64エンコードされたプレイヤーアイコン
}

// プレイヤーアクションの型
export type PlayerAction = "join" | "leave";

// プレイヤーパケット情報
export interface PlayerPacket {
  name: string;
  xuid: string;
  action: PlayerAction;
  ipAddress?: string;
  port?: number;
  icon?: string;
  timestamp: Date;
}

export interface Server {
  id: string;
  name: string;
  address: string; // 受信用アドレス（例: 127.0.0.1:19132）
  destinationAddress: string; // 転送先アドレス（例: 192.168.1.10:19132）
  status: ServerStatus;
  playersOnline: number;
  maxPlayers: number;
  iconUrl?: string;
  tags?: string[];
  autoStart?: boolean; // アプリ起動時に自動起動
  autoRestart?: boolean;
  blockSameIP?: boolean;
  forwardAddress?: string; // バックアップ転送サーバー
  pluginsEnabled?: boolean; // プラグインシステムの有効/無効
  description?: string;
  players?: Player[];
  executablePath?: string; // サーバー実行ファイルのパス
  serverDirectory?: string; // サーバーディレクトリのパス
  createdAt: Date;
  updatedAt: Date;
}

// WebSocketメッセージの基本構造
export interface WebSocketMessage<T = any> {
  type: string;
  id?: string; // リクエストID（レスポンス時に使用）
  data?: T;
  timestamp: number;
}

// リクエストメッセージ
export interface RequestMessage<T = any> extends WebSocketMessage<T> {
  id: string; // リクエストには必須
}

// レスポンスメッセージ
export interface ResponseMessage<T = any> extends WebSocketMessage<T> {
  id: string; // レスポンスには必須
  success: boolean;
  error?: string;
}

// イベント通知メッセージ
export interface EventMessage<T = any> extends WebSocketMessage<T> {
  event: string;
}

// サーバー関連のAPIタイプ
export namespace ServerAPI {
  // サーバー一覧取得
  export interface GetServersRequest {}
  export interface GetServersResponse {
    servers: Server[];
  }

  // サーバー追加
  export interface AddServerRequest {
    name: string;
    address: string;
    destinationAddress: string;
    maxPlayers: number;
    iconUrl?: string;
    tags?: string[];
    description?: string;
    autoStart?: boolean;
    autoRestart?: boolean;
    blockSameIP?: boolean;
    forwardAddress?: string;
    executablePath?: string; // サーバー実行ファイルのパス
    serverDirectory?: string; // サーバーディレクトリのパス
  }
  export interface AddServerResponse {
    server: Server;
  }

  // サーバー更新
  export interface UpdateServerRequest {
    id: string;
    updates: Partial<Omit<Server, 'id' | 'createdAt' | 'updatedAt' | 'players' | 'playersOnline'>>;
  }
  export interface UpdateServerResponse {
    server: Server;
  }

  // サーバー削除
  export interface DeleteServerRequest {
    id: string;
  }
  export interface DeleteServerResponse {
    success: true;
  }

  // サーバー操作（開始/停止/再起動）
  export interface ServerActionRequest {
    id: string;
    action: "start" | "stop" | "restart" | "block";
    targetIP?: string; // block操作で使用
  }
  export interface ServerActionResponse {
    server: Server;
  }

  // サーバー詳細取得
  export interface GetServerDetailsRequest {
    id: string;
  }
  export interface GetServerDetailsResponse {
    server: Server;
    players: Player[];
  }

  // Minecraftサーバー検出
  export interface DetectServerRequest {
    executablePath: string;
  }
  export interface DetectServerResponse {
    detectedInfo: {
      executablePath: string;
      serverDirectory: string;
      propertiesPath: string;
      config: any; // MinecraftServerConfig
      suggestedProxyPort: number;
    };
    recommendedConfig: {
      name: string;
      address: string;
      destinationAddress: string;
      maxPlayers: number;
      description: string;
      tags: string[];
    };
  }

  // 検出情報からサーバー追加
  export interface AddServerFromDetectionRequest {
    detectedInfo: any; // DetectedServerInfo
    customConfig?: Partial<AddServerRequest>;
  }

  // 設定関連
  export interface GetConfigRequest {}
  export interface GetConfigResponse {
    config: {
      language: string;
      theme: string;
      autoStart: boolean;
      checkUpdates: boolean;
      logLevel: string;
    };
  }

  export interface SaveConfigRequest {
    config: {
      language?: string;
      theme?: string;
      autoStart?: boolean;
      checkUpdates?: boolean;
      logLevel?: string;
    };
  }
  export interface SaveConfigResponse {
    success: true;
  }
}

// イベント通知のタイプ
export namespace Events {
  export interface ServerStatusChanged {
    serverId: string;
    oldStatus: ServerStatus;
    newStatus: ServerStatus;
    server: Server;
  }

  export interface PlayerJoined {
    serverId: string;
    player: Player;
    currentPlayerCount: number;
  }

  export interface PlayerLeft {
    serverId: string;
    playerId: string;
    playerName: string;
    currentPlayerCount: number;
  }

  export interface ServerCreated {
    server: Server;
  }

  export interface ServerUpdated {
    server: Server;
    changes: string[];
  }

  export interface ServerDeleted {
    serverId: string;
    serverName: string;
  }
}

// WebSocketクライアント情報
export interface WSClient {
  id: string;
  ws: any; // BunのWebSocket型
  connectedAt: Date;
  subscriptions: Set<string>; // 購読しているイベント
}

// エラータイプ
export class APIError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// プラグイン関連の型
export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  docs?: string;
}

export interface Plugin {
  id: string;
  metadata: PluginMetadata;
  enabled: boolean;
  filePath: string;
  loaded: boolean;
  error?: string;
  hasNodeModules?: boolean; // Indicates if plugin has its own node_modules folder
}

export interface PluginContext {
  serverId: string;
  metadata: PluginMetadata;
}

// プラグインAPI
export namespace PluginAPI {
  // プラグイン一覧取得
  export interface GetPluginsRequest {
    serverId: string;
  }
  export interface GetPluginsResponse {
    plugins: Plugin[];
  }

  // プラグイン有効化/無効化
  export interface TogglePluginRequest {
    serverId: string;
    pluginId: string;
    enabled: boolean;
  }
  export interface TogglePluginResponse {
    plugin: Plugin;
  }

  // プラグイン再読み込み
  export interface RefreshPluginsRequest {
    serverId: string;
  }
  export interface RefreshPluginsResponse {
    plugins: Plugin[];
  }
}