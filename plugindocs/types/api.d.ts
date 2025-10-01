/**
 * BedrockProxy Plugin API - Main Interface
 * 
 * このファイルはプラグイン開発で使用するメインAPIの型定義を提供します。
 * プラグインコンテキストの `api` オブジェクトを通じてアクセスできます。
 * 
 * @module PluginAPI
 */

import type { ServerInfo, ServerStats } from './server';
import type { Player, PlayerStats } from './player';
import type { EventType, EventHandler, EventDataMap } from './events';
import type { StorageAPI } from './storage';
import type { HttpAPI } from './http';
import type { FileSystemAPI } from './filesystem';

/**
 * ログレベル
 * プラグインのログ出力時に使用されるレベル
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * メインプラグインAPI
 * 
 * プラグインが利用できる全ての機能を提供するインターフェース。
 * サーバー操作、プレイヤー管理、イベントハンドリング、
 * ストレージ、HTTP通信、ファイル操作などが含まれます。
 * 
 * @example
 * ```javascript
 * registerPlugin(() => ({
 *   async onEnable(context) {
 *     const { api } = context;
 *     api.info('Plugin enabled!');
 *     
 *     // プレイヤー参加イベントをリスン
 *     api.on('playerJoin', (event) => {
 *       api.info(`${event.player.name} joined!`);
 *     });
 *   }
 * }));
 * ```
 */
export interface PluginAPI {
  // ==================== Sub-APIs ====================
  
  /**
   * 永続ストレージAPI
   * プラグインデータを保存・取得できます
   * @see {@link StorageAPI}
   */
  readonly storage: StorageAPI;
  
  /**
   * HTTP通信API
   * 外部APIとの通信やWebhookの作成に使用します
   * @see {@link HttpAPI}
   */
  readonly http: HttpAPI;
  
  /**
   * ファイルシステムAPI
   * プラグインディレクトリ内のファイル操作（サンドボックス化）
   * @see {@link FileSystemAPI}
   */
  readonly fs: FileSystemAPI;
  
  // ==================== Logging ====================
  
  /**
   * 指定されたレベルでログメッセージを出力します
   * ログはコンソールとクライアントの両方に送信されます
   * 
   * @param level - ログレベル（debug/info/warn/error）
   * @param message - ログメッセージ
   * @param data - 追加データ（オプション）
   * 
   * @example
   * ```javascript
   * api.log('info', 'Server started', { port: 19132 });
   * ```
   */
  log(level: LogLevel, message: string, data?: any): void;
  
  /**
   * デバッグメッセージを出力します
   * 開発時のトラブルシューティングに使用します
   * 
   * @param message - デバッグメッセージ
   * @param data - 追加データ（オプション）
   * 
   * @example
   * ```javascript
   * api.debug('Player position', { x: 100, y: 64, z: 200 });
   * ```
   */
  debug(message: string, data?: any): void;
  
  /**
   * 情報メッセージを出力します
   * 通常の動作ログに使用します
   * 
   * @param message - 情報メッセージ
   * @param data - 追加データ（オプション）
   * 
   * @example
   * ```javascript
   * api.info('Plugin initialized successfully');
   * ```
   */
  info(message: string, data?: any): void;
  
  /**
   * 警告メッセージを出力します
   * 問題の可能性がある状況を報告します
   * 
   * @param message - 警告メッセージ
   * @param data - 追加データ（オプション）
   * 
   * @example
   * ```javascript
   * api.warn('Configuration file not found, using defaults');
   * ```
   */
  warn(message: string, data?: any): void;
  
  /**
   * エラーメッセージを出力します
   * エラー状況や例外を報告します
   * 
   * @param message - エラーメッセージ
   * @param data - 追加データ（オプション）
   * 
   * @example
   * ```javascript
   * api.error('Failed to connect to database', error);
   * ```
   */
  error(message: string, data?: any): void;
  
  // ==================== Server ====================
  
  /**
   * 現在のサーバー情報を取得します
   * サーバーID、名前、アドレス、ステータスなどが含まれます
   * 
   * @returns サーバー情報
   * @throws サーバーが見つからない場合
   * 
   * @example
   * ```javascript
   * const info = await api.getServerInfo();
   * api.info(`Server: ${info.name} (${info.status})`);
   * api.info(`Players: ${info.playersOnline}/${info.maxPlayers}`);
   * ```
   */
  getServerInfo(): Promise<ServerInfo>;
  
  /**
   * サーバーの統計情報を取得します
   * 稼働時間、総プレイヤー数、処理パケット数などが含まれます
   * 
   * @returns サーバー統計情報
   * @throws サーバーが見つからない場合
   * 
   * @example
   * ```javascript
   * const stats = await api.getServerStats();
   * api.info(`Uptime: ${stats.uptime}ms`);
   * api.info(`Total players: ${stats.totalPlayers}`);
   * ```
   */
  getServerStats(): Promise<ServerStats>;
  
  /**
   * Minecraftサーバーのコンソールにコマンドを送信します
   * スラッシュ（/）は不要です
   * 
   * @param command - 送信するコマンド（スラッシュなし）
   * @returns Promise（完了時に解決）
   * 
   * @example
   * ```javascript
   * // プレイヤー全員に時刻を設定
   * await api.sendCommand('time set day');
   * 
   * // 天候を変更
   * await api.sendCommand('weather clear');
   * ```
   */
  sendCommand(command: string): Promise<void>;
  
  /**
   * サーバーコンソールの最近の出力を取得します
   * 
   * @param lineCount - 取得する行数（デフォルト: 100）
   * @returns コンソール出力の配列
   * 
   * @example
   * ```javascript
   * const logs = await api.getConsoleOutput(50);
   * logs.forEach(line => api.debug(line));
   * ```
   */
  getConsoleOutput(lineCount?: number): Promise<string[]>;
  
  // ==================== Players ====================
  
  /**
   * 現在オンラインのプレイヤーリストを取得します
   * 
   * @returns プレイヤーの配列
   * 
   * @example
   * ```javascript
   * const players = await api.getPlayers();
   * api.info(`Online players: ${players.length}`);
   * players.forEach(p => api.info(`- ${p.name}`));
   * ```
   */
  getPlayers(): Promise<Player[]>;
  
  /**
   * IDまたはXUIDで特定のプレイヤーを取得します
   * 
   * @param playerId - プレイヤーIDまたはXUID
   * @returns プレイヤー情報、見つからない場合はnull
   * 
   * @example
   * ```javascript
   * const player = await api.getPlayer('12345678');
   * if (player) {
   *   api.info(`Found: ${player.name}`);
   * }
   * ```
   */
  getPlayer(playerId: string): Promise<Player | null>;
  
  /**
   * 名前でプレイヤーを検索します
   * 大文字小文字を区別しません
   * 
   * @param playerName - プレイヤー名
   * @returns プレイヤー情報、見つからない場合はnull
   * 
   * @example
   * ```javascript
   * const player = await api.getPlayerByName('Steve');
   * if (player) {
   *   api.info(`${player.name} is online!`);
   * }
   * ```
   */
  getPlayerByName(playerName: string): Promise<Player | null>;
  
  /**
   * プレイヤーの統計情報を取得します
   * プレイ時間、最終接続時刻、参加回数などが含まれます
   * 
   * @param playerId - プレイヤーIDまたはXUID
   * @returns プレイヤー統計情報、見つからない場合はnull
   * 
   * @example
   * ```javascript
   * const stats = await api.getPlayerStats('12345678');
   * if (stats) {
   *   const hours = Math.floor(stats.totalPlayTime / 3600000);
   *   api.info(`Play time: ${hours} hours`);
   * }
   * ```
   */
  getPlayerStats(playerId: string): Promise<PlayerStats | null>;
  
  /**
   * プレイヤーをサーバーからキックします
   * 注意: 現在実装中です
   * 
   * @param playerId - プレイヤーIDまたはXUID
   * @param reason - キックの理由（オプション）
   * 
   * @example
   * ```javascript
   * await api.kickPlayer('12345678', 'ルール違反');
   * ```
   */
  kickPlayer(playerId: string, reason?: string): Promise<void>;
  
  /**
   * 特定のプレイヤーにメッセージを送信します
   * 注意: 現在実装中です
   * 
   * @param playerId - プレイヤーIDまたはXUID
   * @param message - 送信するメッセージ
   * 
   * @example
   * ```javascript
   * await api.tellPlayer('12345678', 'こんにちは！');
   * ```
   */
  tellPlayer(playerId: string, message: string): Promise<void>;
  
  /**
   * 全プレイヤーにメッセージをブロードキャストします
   * サーバーコンソールの `say` コマンドを使用します
   * 
   * @param message - ブロードキャストするメッセージ
   * 
   * @example
   * ```javascript
   * await api.broadcast('サーバーメンテナンスのため5分後に再起動します');
   * ```
   */
  broadcast(message: string): Promise<void>;
  
  // ==================== Events ====================
  
  /**
   * イベントリスナーを登録します
   * プレイヤー参加、サーバー起動などのイベントを監視できます
   * 
   * @param event - イベント名
   * @param handler - イベントハンドラ関数
   * 
   * @example
   * ```javascript
   * api.on('playerJoin', (event) => {
   *   api.info(`${event.player.name} がサーバーに参加しました`);
   *   api.broadcast(`ようこそ ${event.player.name}！`);
   * });
   * 
   * api.on('playerLeave', (event) => {
   *   api.info(`${event.player.name} がサーバーから退出しました`);
   * });
   * ```
   */
  on<K extends EventType>(event: K, handler: EventHandler<EventDataMap[K]>): void;
  
  /**
   * 一度だけ実行されるイベントリスナーを登録します
   * イベント発火後、自動的に登録解除されます
   * 
   * @param event - イベント名
   * @param handler - イベントハンドラ関数
   * 
   * @example
   * ```javascript
   * api.once('serverStart', (event) => {
   *   api.info('サーバーが起動しました（初回のみ）');
   * });
   * ```
   */
  once<K extends EventType>(event: K, handler: EventHandler<EventDataMap[K]>): void;
  
  /**
   * イベントリスナーの登録を解除します
   * 
   * @param event - イベント名
   * @param handler - 解除するイベントハンドラ関数
   * 
   * @example
   * ```javascript
   * const handler = (event) => api.info('Player joined');
   * api.on('playerJoin', handler);
   * // 後で解除
   * api.off('playerJoin', handler);
   * ```
   */
  off<K extends EventType>(event: K, handler: EventHandler<EventDataMap[K]>): void;
  
  /**
   * カスタムイベントを発火します
   * プラグイン内部やプラグイン間の通信に使用できます
   * 
   * @param event - イベント名
   * @param data - イベントデータ
   * 
   * @example
   * ```javascript
   * // イベントを発火
   * api.emit('customEvent', { message: 'Hello!' });
   * 
   * // 他の場所でリスン
   * api.on('customEvent', (data) => {
   *   api.info(data.message);
   * });
   * ```
   */
  emit(event: string, data: any): void;
  
  // ==================== Timing ====================
  
  /**
   * 定期的に実行されるタスクをスケジュールします
   * プラグイン無効化時に自動的にクリーンアップされます
   * 
   * @param intervalMs - 実行間隔（ミリ秒）
   * @param callback - コールバック関数
   * @returns タイマーID（キャンセル用）
   * 
   * @example
   * ```javascript
   * // 1分ごとにプレイヤー数をログ
   * const timerId = api.setInterval(60000, async () => {
   *   const players = await api.getPlayers();
   *   api.info(`現在のプレイヤー数: ${players.length}`);
   * });
   * 
   * // 必要に応じてキャンセル
   * api.clearTimer(timerId);
   * ```
   */
  setInterval(intervalMs: number, callback: () => void | Promise<void>): number;
  
  /**
   * 一度だけ実行されるタスクをスケジュールします
   * プラグイン無効化時に自動的にクリーンアップされます
   * 
   * @param delayMs - 遅延時間（ミリ秒）
   * @param callback - コールバック関数
   * @returns タイマーID（キャンセル用）
   * 
   * @example
   * ```javascript
   * // 5秒後にメッセージを送信
   * api.setTimeout(5000, async () => {
   *   await api.broadcast('5秒経過しました');
   * });
   * ```
   */
  setTimeout(delayMs: number, callback: () => void | Promise<void>): number;
  
  /**
   * スケジュールされたタスクをキャンセルします
   * 
   * @param timerId - setIntervalまたはsetTimeoutから返されたタイマーID
   * 
   * @example
   * ```javascript
   * const timerId = api.setInterval(1000, () => {
   *   api.info('Tick');
   * });
   * 
   * // 10秒後に停止
   * api.setTimeout(10000, () => {
   *   api.clearTimer(timerId);
   * });
   * ```
   */
  clearTimer(timerId: number): void;
  
  // ==================== Storage (Deprecated) ====================
  
  /**
   * プラグインストレージからデータを取得します
   * @deprecated storage.get() を使用してください
   * 
   * @param key - ストレージキー
   * @returns 保存された値
   * 
   * @example
   * ```javascript
   * // 非推奨
   * const data = await api.getData('config');
   * 
   * // 推奨
   * const data = await api.storage.get('config');
   * ```
   */
  getData(key: string): Promise<any>;
  
  /**
   * プラグインストレージにデータを保存します
   * @deprecated storage.set() を使用してください
   * 
   * @param key - ストレージキー
   * @param value - 保存する値
   * 
   * @example
   * ```javascript
   * // 非推奨
   * await api.setData('config', { enabled: true });
   * 
   * // 推奨
   * await api.storage.set('config', { enabled: true });
   * ```
   */
  setData(key: string, value: any): Promise<void>;
  
  // ==================== Utilities ====================
  
  /**
   * プラグインAPIのバージョンを取得します
   * 
   * @returns APIバージョン文字列
   * 
   * @example
   * ```javascript
   * const version = api.getVersion();
   * api.info(`Plugin API version: ${version}`);
   * ```
   */
  getVersion(): string;
  
  /**
   * 指定されたプラグインがロードされているか確認します
   * プラグイン間の依存関係チェックに使用できます
   * 
   * @param pluginName - プラグイン名
   * @returns ロードされていればtrue
   * 
   * @example
   * ```javascript
   * if (api.isPluginLoaded('EconomyPlugin')) {
   *   api.info('経済プラグインが利用可能です');
   * } else {
   *   api.warn('経済プラグインが見つかりません');
   * }
   * ```
   */
  isPluginLoaded(pluginName: string): boolean;
  
  /**
   * 現在ロードされているプラグインのリストを取得します
   * 
   * @returns プラグイン名の配列
   * 
   * @example
   * ```javascript
   * const plugins = api.getLoadedPlugins();
   * api.info(`ロード済みプラグイン: ${plugins.join(', ')}`);
   * ```
   */
  getLoadedPlugins(): string[];
  
  /**
   * 他のプラグインの関数を呼び出します
   * プラグイン間通信に使用します
   * 
   * @param pluginName - 対象プラグイン名
   * @param functionName - 呼び出す関数名
   * @param args - 関数の引数
   * @returns 関数の戻り値
   * @throws プラグインまたは関数が見つからない場合
   * 
   * @example
   * ```javascript
   * // 他のプラグインの関数を呼び出す
   * const balance = await api.callPlugin('EconomyPlugin', 'getBalance', playerId);
   * api.info(`残高: ${balance}`);
   * 
   * // 他のプラグインで定義されている関数
   * // registerPlugin(() => ({
   * //   getBalance(playerId) {
   * //     return 1000; // 実装例
   * //   }
   * // }));
   * ```
   */
  callPlugin(pluginName: string, functionName: string, ...args: any[]): Promise<any>;
}
