/**
 * BedrockProxy File System API
 * 
 * プラグインディレクトリ内のファイル操作を安全に行うためのAPIです。
 * セキュリティのため、プラグインディレクトリ外へのアクセスは禁止されています。
 * 
 * @module FileSystemAPI
 */

/**
 * ファイル統計情報
 * ファイルまたはディレクトリのメタデータを含みます
 */
export interface FileStats {
  /** 
   * ファイルサイズ（バイト単位）
   * ディレクトリの場合は0
   */
  size: number;
  
  /** 
   * ディレクトリかどうか
   */
  isDirectory: boolean;
  
  /** 
   * ファイルかどうか
   */
  isFile: boolean;
  
  /** 
   * 作成日時
   */
  createdAt: Date;
  
  /** 
   * 最終更新日時
   */
  modifiedAt: Date;
  
  /** 
   * 最終アクセス日時
   */
  accessedAt: Date;
}

/**
 * ディレクトリエントリ
 * ディレクトリ内のファイルまたはサブディレクトリの情報
 */
export interface DirectoryEntry {
  /** 
   * エントリ名（ファイル名またはディレクトリ名）
   */
  name: string;
  
  /** 
   * 相対パス
   */
  path: string;
  
  /** 
   * ディレクトリかどうか
   */
  isDirectory: boolean;
  
  /** 
   * ファイルかどうか
   */
  isFile: boolean;
}

/**
 * ファイルエンコーディング
 * ファイル読み書き時の文字エンコーディング
 */
export type FileEncoding = 'utf8' | 'ascii' | 'base64' | 'binary' | 'hex';

/**
 * ファイル書き込みオプション
 */
export interface WriteFileOptions {
  /** 
   * ファイルエンコーディング
   * @default 'utf8'
   */
  encoding?: FileEncoding;
  
  /** 
   * ファイルモード（パーミッション）
   * Unix形式のパーミッション（例: 0o644）
   * @example 0o755
   */
  mode?: number;
  
  /** 
   * 親ディレクトリが存在しない場合、自動的に作成します
   * @default false
   */
  recursive?: boolean;
}

/**
 * ファイル読み込みオプション
 */
export interface ReadFileOptions {
  /** 
   * ファイルエンコーディング
   * 指定しない場合はBufferとして返されます
   * @default 'utf8'
   */
  encoding?: FileEncoding;
}

/**
 * ファイルシステムAPI
 * 
 * プラグインディレクトリ内に限定された安全なファイル操作を提供します。
 * パストラバーサル攻撃を防ぐため、ディレクトリ外へのアクセスは自動的にブロックされます。
 * 
 * @example
 * ```javascript
 * // ファイルの読み書き
 * await api.fs.writeFile('config.txt', 'Hello World');
 * const content = await api.fs.readFile('config.txt');
 * 
 * // JSON操作
 * await api.fs.writeJSON('data.json', { users: [] });
 * const data = await api.fs.readJSON('data.json');
 * 
 * // ディレクトリ操作
 * await api.fs.mkdir('logs', true);
 * const files = await api.fs.readDir('logs');
 * 
 * // ファイル監視
 * const watcherId = api.fs.watch('config.txt', (event, filename) => {
 *   api.info(`ファイルが${event}されました: ${filename}`);
 * });
 * ```
 */
export interface FileSystemAPI {
  /**
   * ファイル内容を読み込みます
   * パスはプラグインディレクトリからの相対パスで指定します
   * 
   * @param path - ファイルパス（プラグインディレクトリからの相対パス）
   * @param options - 読み込みオプション
   * @returns 文字列またはBuffer
   * 
   * @example
   * ```javascript
   * // テキストファイルを読み込む
   * const text = await api.fs.readFile('config.txt', { encoding: 'utf8' });
   * 
   * // バイナリファイルを読み込む
   * const buffer = await api.fs.readFile('image.png');
   * ```
   */
  readFile(path: string, options?: ReadFileOptions): Promise<string | Buffer>;
  
  /**
   * ファイルに内容を書き込みます
   * 既存のファイルは上書きされます
   * 
   * @param path - ファイルパス（プラグインディレクトリからの相対パス）
   * @param data - 書き込むデータ
   * @param options - 書き込みオプション
   * 
   * @example
   * ```javascript
   * // テキストを書き込む
   * await api.fs.writeFile('log.txt', 'ログメッセージ\n');
   * 
   * // recursive: trueで親ディレクトリを自動作成
   * await api.fs.writeFile('data/users/player.txt', 'data', { recursive: true });
   * 
   * // Bufferを書き込む
   * await api.fs.writeFile('binary.dat', Buffer.from([0x01, 0x02, 0x03]));
   * ```
   */
  writeFile(path: string, data: string | Buffer, options?: WriteFileOptions): Promise<void>;
  
  /**
   * ファイルの末尾にデータを追加します
   * ファイルが存在しない場合は新規作成されます
   * 
   * @param path - ファイルパス（プラグインディレクトリからの相対パス）
   * @param data - 追加するデータ
   * @param options - 書き込みオプション
   * 
   * @example
   * ```javascript
   * // ログファイルに追記
   * await api.fs.appendFile('logs/server.log', `[${new Date().toISOString()}] Server started\n`);
   * ```
   */
  appendFile(path: string, data: string | Buffer, options?: WriteFileOptions): Promise<void>;
  
  /**
   * ファイルを削除します
   * 
   * @param path - ファイルパス（プラグインディレクトリからの相対パス）
   * @throws ファイルが存在しない場合
   * 
   * @example
   * ```javascript
   * await api.fs.deleteFile('temp/old-data.txt');
   * ```
   */
  deleteFile(path: string): Promise<void>;
  
  /**
   * ファイルまたはディレクトリが存在するか確認します
   * 
   * @param path - パス（プラグインディレクトリからの相対パス）
   * @returns 存在する場合true
   * 
   * @example
   * ```javascript
   * if (await api.fs.exists('config.json')) {
   *   api.info('設定ファイルが存在します');
   * } else {
   *   // デフォルト設定を作成
   *   await api.fs.writeJSON('config.json', { enabled: true });
   * }
   * ```
   */
  exists(path: string): Promise<boolean>;
  
  /**
   * ファイルまたはディレクトリの統計情報を取得します
   * 
   * @param path - パス（プラグインディレクトリからの相対パス）
   * @returns ファイル統計情報
   * 
   * @example
   * ```javascript
   * const stats = await api.fs.stat('data.json');
   * api.info(`ファイルサイズ: ${stats.size} bytes`);
   * api.info(`最終更新: ${stats.modifiedAt.toISOString()}`);
   * 
   * if (stats.isDirectory) {
   *   api.info('これはディレクトリです');
   * }
   * ```
   */
  stat(path: string): Promise<FileStats>;
  
  /**
   * ディレクトリを作成します
   * 
   * @param path - ディレクトリパス（プラグインディレクトリからの相対パス）
   * @param recursive - 親ディレクトリも作成する場合true
   * 
   * @example
   * ```javascript
   * // 単一ディレクトリを作成
   * await api.fs.mkdir('logs');
   * 
   * // ネストされたディレクトリを一度に作成
   * await api.fs.mkdir('data/backups/2024', true);
   * ```
   */
  mkdir(path: string, recursive?: boolean): Promise<void>;
  
  /**
   * ディレクトリ内のファイルとサブディレクトリを取得します
   * 
   * @param path - ディレクトリパス（プラグインディレクトリからの相対パス）
   * @returns ディレクトリエントリの配列
   * 
   * @example
   * ```javascript
   * const entries = await api.fs.readDir('logs');
   * for (const entry of entries) {
   *   if (entry.isFile) {
   *     api.info(`ファイル: ${entry.name}`);
   *   } else if (entry.isDirectory) {
   *     api.info(`ディレクトリ: ${entry.name}`);
   *   }
   * }
   * ```
   */
  readDir(path: string): Promise<DirectoryEntry[]>;
  
  /**
   * ディレクトリを削除します
   * 
   * @param path - ディレクトリパス（プラグインディレクトリからの相対パス）
   * @param recursive - サブディレクトリとファイルも削除する場合true
   * 
   * @example
   * ```javascript
   * // 空のディレクトリを削除
   * await api.fs.rmdir('empty-folder');
   * 
   * // ディレクトリとその内容を全て削除
   * await api.fs.rmdir('old-data', true);
   * ```
   */
  rmdir(path: string, recursive?: boolean): Promise<void>;
  
  /**
   * ファイルをコピーします
   * 
   * @param source - コピー元パス（プラグインディレクトリからの相対パス）
   * @param destination - コピー先パス（プラグインディレクトリからの相対パス）
   * 
   * @example
   * ```javascript
   * await api.fs.copyFile('config.json', 'config.backup.json');
   * ```
   */
  copyFile(source: string, destination: string): Promise<void>;
  
  /**
   * ファイルを移動またはリネームします
   * 
   * @param source - 移動元パス（プラグインディレクトリからの相対パス）
   * @param destination - 移動先パス（プラグインディレクトリからの相対パス）
   * 
   * @example
   * ```javascript
   * // ファイルをリネーム
   * await api.fs.moveFile('old-name.txt', 'new-name.txt');
   * 
   * // ファイルを別のディレクトリに移動
   * await api.fs.moveFile('temp/file.txt', 'archive/file.txt');
   * ```
   */
  moveFile(source: string, destination: string): Promise<void>;
  
  /**
   * JSONファイルを読み込んで解析します
   * 
   * @param path - ファイルパス（プラグインディレクトリからの相対パス）
   * @returns 解析されたJSONオブジェクト
   * 
   * @example
   * ```javascript
   * const config = await api.fs.readJSON('config.json');
   * api.info(`設定: ${JSON.stringify(config)}`);
   * ```
   */
  readJSON<T = any>(path: string): Promise<T>;
  
  /**
   * オブジェクトをJSONファイルとして保存します
   * 
   * @param path - ファイルパス（プラグインディレクトリからの相対パス）
   * @param data - 保存するデータ
   * @param pretty - インデント付きで整形する場合true
   * 
   * @example
   * ```javascript
   * // コンパクトなJSON
   * await api.fs.writeJSON('data.json', { users: [] });
   * 
   * // 読みやすい整形されたJSON
   * await api.fs.writeJSON('config.json', { enabled: true, port: 19132 }, true);
   * ```
   */
  writeJSON(path: string, data: any, pretty?: boolean): Promise<void>;
  
  /**
   * ファイルまたはディレクトリの変更を監視します
   * 
   * @param path - 監視するパス（プラグインディレクトリからの相対パス）
   * @param callback - 変更時に呼ばれるコールバック関数
   * @returns 監視ID（unwatch()で使用）
   * 
   * @example
   * ```javascript
   * const watcherId = api.fs.watch('config.json', (event, filename) => {
   *   if (event === 'change') {
   *     api.info(`${filename}が変更されました。設定を再読み込みします...`);
   *     // 設定を再読み込み
   *   }
   * });
   * 
   * // プラグイン無効化時に監視を停止
   * api.fs.unwatch(watcherId);
   * ```
   */
  watch(path: string, callback: (event: 'change' | 'rename', filename: string) => void): number;
  
  /**
   * ファイル監視を停止します
   * 
   * @param watcherId - watch()から返された監視ID
   * 
   * @example
   * ```javascript
   * const watcherId = api.fs.watch('config.json', handler);
   * // 後で停止
   * api.fs.unwatch(watcherId);
   * ```
   */
  unwatch(watcherId: number): void;
}
