/**
 * イベントシステム型定義
 * 
 * BedrockProxy プラグインのイベントシステムで使用される
 * 型定義を提供します。
 * 
 * イベントシステムは、サーバーやプレイヤーの状態変化を
 * プラグインに通知するための仕組みです。
 * 
 * @module events
 * @example イベントリスナーの登録
 * ```javascript
 * // プレイヤー参加イベント
 * api.on('playerJoin', (event) => {
 *   console.log(`${event.player.name} が参加しました`);
 *   console.log(`現在のプレイヤー数: ${event.currentPlayerCount}`);
 * });
 * 
 * // 一度だけ実行されるリスナー
 * api.once('serverStart', (event) => {
 *   console.log(`サーバー ${event.server.name} が起動しました`);
 * });
 * 
 * // リスナーの解除
 * api.off('playerJoin');
 * ```
 */

import type { Player, PlayerPacket } from './player';
import type { ServerInfo } from './server';

/**
 * イベントタイプ
 * 
 * BedrockProxy で発火される全てのイベントタイプです。
 * 
 * @example
 * ```javascript
 * // 全てのイベントタイプに対してリスナーを登録
 * const eventTypes = ['playerJoin', 'playerLeave', 'serverStart'];
 * eventTypes.forEach(type => {
 *   api.on(type, (event) => {
 *     api.info(`イベント発生: ${type}`);
 *   });
 * });
 * ```
 */
export type EventType =
  | 'playerJoin'        // プレイヤーがサーバーに参加した
  | 'playerLeave'       // プレイヤーがサーバーから退出した
  | 'serverStart'       // サーバーが起動した
  | 'serverStop'        // サーバーが停止した
  | 'serverStatusChange' // サーバーのステータスが変更された
  | 'consoleOutput'     // コンソール出力が発生した
  | 'consoleCommand'    // コンソールコマンドが実行された
  | 'error';            // エラーが発生した

/**
 * イベントハンドラー関数
 * 
 * イベントが発火された時に呼び出される関数の型です。
 * 同期・非同期どちらでも可能です。
 * 
 * @template T - イベントデータの型
 * @param data - イベントデータ
 * @returns void または Promise<void>
 * 
 * @example 同期ハンドラー
 * ```javascript
 * api.on('playerJoin', (event) => {
 *   console.log(event.player.name);
 * });
 * ```
 * 
 * @example 非同期ハンドラー
 * ```javascript
 * api.on('playerJoin', async (event) => {
 *   await api.storage.set('lastPlayer', event.player.name);
 * });
 * ```
 */
export type EventHandler<T = any> = (data: T) => void | Promise<void>;

/**
 * プレイヤー参加イベントデータ
 * 
 * プレイヤーがサーバーに参加した時に発火されるイベントのデータです。
 * 
 * @example ウェルカムメッセージを表示
 * ```javascript
 * api.on('playerJoin', (event) => {
 *   const { player, currentPlayerCount } = event;
 *   api.broadcast(`§a${player.name} さんが参加しました！`);
 *   api.broadcast(`§e現在のプレイヤー数: ${currentPlayerCount}`);
 * });
 * ```
 * 
 * @example 参加回数をカウント
 * ```javascript
 * api.on('playerJoin', async (event) => {
 *   const key = `joins:${event.player.xuid}`;
 *   const count = await api.storage.get(key, 0) + 1;
 *   await api.storage.set(key, count);
 *   api.info(`${event.player.name} の参加回数: ${count}`);
 * });
 * ```
 */
export interface PlayerJoinEvent {
  /** プレイヤー情報（名前、XUID、IDなど） */
  player: Player;
  
  /** サーバーID */
  serverId: string;
  
  /** 参加後の現在のプレイヤー数 */
  currentPlayerCount: number;
}

/**
 * プレイヤー退出イベントデータ
 * 
 * プレイヤーがサーバーから退出した時に発火されるイベントのデータです。
 * 
 * @example 退出メッセージを表示
 * ```javascript
 * api.on('playerLeave', (event) => {
 *   const { player, reason } = event;
 *   api.broadcast(`§c${player.name} さんが退出しました`);
 *   if (reason) {
 *     api.info(`退出理由: ${reason}`);
 *   }
 * });
 * ```
 * 
 * @example プレイ時間を記録
 * ```javascript
 * api.on('playerLeave', async (event) => {
 *   const { player } = event;
 *   if (player.joinTime && player.leaveTime) {
 *     const duration = player.leaveTime - player.joinTime;
 *     await api.storage.set(`playtime:${player.xuid}`, duration);
 *   }
 * });
 * ```
 */
export interface PlayerLeaveEvent {
  /** プレイヤー情報 */
  player: Player;
  
  /** サーバーID */
  serverId: string;
  
  /** 退出後の現在のプレイヤー数 */
  currentPlayerCount: number;
  
  /** 退出理由（利用可能な場合） */
  reason?: string;
}

/**
 * サーバー起動イベントデータ
 * 
 * サーバーが起動した時に発火されるイベントのデータです。
 * 
 * @example 起動メッセージをログ出力
 * ```javascript
 * api.on('serverStart', (event) => {
 *   const { server, timestamp } = event;
 *   api.info(`サーバー ${server.name} が ${timestamp} に起動しました`);
 * });
 * ```
 * 
 * @example 起動回数をカウント
 * ```javascript
 * api.on('serverStart', async (event) => {
 *   const key = `starts:${event.server.id}`;
 *   const count = await api.storage.get(key, 0) + 1;
 *   await api.storage.set(key, count);
 *   api.info(`起動回数: ${count}`);
 * });
 * ```
 */
export interface ServerStartEvent {
  /** サーバー情報 */
  server: ServerInfo;
  
  /** 起動タイムスタンプ */
  timestamp: Date;
}

/**
 * サーバー停止イベントデータ
 * 
 * サーバーが停止した時に発火されるイベントのデータです。
 * 
 * @example 停止時に統計を保存
 * ```javascript
 * api.on('serverStop', async (event) => {
 *   const { server, timestamp, reason } = event;
 *   await api.fs.writeJSON('last-stop.json', {
 *     server: server.name,
 *     timestamp,
 *     reason
 *   });
 * });
 * ```
 */
export interface ServerStopEvent {
  /** サーバー情報 */
  server: ServerInfo;
  
  /** 停止タイムスタンプ */
  timestamp: Date;
  
  /** 停止理由（利用可能な場合） */
  reason?: string;
}

/**
 * サーバーステータス変更イベントデータ
 * 
 * サーバーのステータスが変更された時に発火されるイベントのデータです。
 * 
 * @example ステータス変更を監視
 * ```javascript
 * api.on('serverStatusChange', (event) => {
 *   const { server, oldStatus, newStatus } = event;
 *   api.info(`${server.name}: ${oldStatus} → ${newStatus}`);
 * });
 * ```
 */
export interface ServerStatusChangeEvent {
  /** サーバー情報 */
  server: ServerInfo;
  
  /** 変更前のステータス */
  oldStatus: ServerInfo['status'];
  
  /** 変更後のステータス */
  newStatus: ServerInfo['status'];
  
  /** タイムスタンプ */
  timestamp: Date;
}

/**
 * コンソール出力イベントデータ
 * 
 * サーバーのコンソールに出力が発生した時に発火されるイベントのデータです。
 * 
 * @example エラーログをファイルに保存
 * ```javascript
 * api.on('consoleOutput', async (event) => {
 *   if (event.line.includes('ERROR') || event.type === 'stderr') {
 *     await api.fs.appendFile('errors.log', 
 *       `[${event.timestamp}] ${event.line}\n`
 *     );
 *   }
 * });
 * ```
 * 
 * @example 特定のパターンを検出
 * ```javascript
 * api.on('consoleOutput', (event) => {
 *   if (event.line.includes('Server started')) {
 *     api.info('サーバーが完全に起動しました');
 *   }
 * });
 * ```
 */
export interface ConsoleOutputEvent {
  /** 出力された行 */
  line: string;
  
  /** サーバーID */
  serverId: string;
  
  /** 出力タイプ（標準出力 or 標準エラー出力） */
  type: 'stdout' | 'stderr';
  
  /** タイムスタンプ */
  timestamp: Date;
}

/**
 * コンソールコマンドイベントデータ
 * 
 * コンソールコマンドが実行された時に発火されるイベントのデータです。
 * 
 * @example コマンド実行をログ出力
 * ```javascript
 * api.on('consoleCommand', (event) => {
 *   api.info(`コマンド実行: ${event.command}`);
 *   if (event.user) {
 *     api.info(`実行者: ${event.user}`);
 *   }
 * });
 * ```
 */
export interface ConsoleCommandEvent {
  /** コマンド文字列 */
  command: string;
  
  /** サーバーID */
  serverId: string;
  
  /** コマンドを送信したユーザー（該当する場合） */
  user?: string;
  
  /** タイムスタンプ */
  timestamp: Date;
}

/**
 * エラーイベントデータ
 * 
 * エラーが発生した時に発火されるイベントのデータです。
 * 
 * @example エラーをログファイルに保存
 * ```javascript
 * api.on('error', async (event) => {
 *   const errorLog = {
 *     message: event.message,
 *     stack: event.stack,
 *     code: event.code,
 *     timestamp: event.timestamp
 *   };
 *   await api.fs.appendFile('error.log', 
 *     JSON.stringify(errorLog) + '\n'
 *   );
 * });
 * ```
 * 
 * @example Discordに通知
 * ```javascript
 * api.on('error', async (event) => {
 *   await api.http.post('https://discord.com/api/webhooks/...', {
 *     content: `🚨 エラー発生: ${event.message}`
 *   });
 * });
 * ```
 */
export interface ErrorEvent {
  /** エラーメッセージ */
  message: string;
  
  /** エラースタックトレース */
  stack?: string;
  
  /** エラーコード */
  code?: string;
  
  /** タイムスタンプ */
  timestamp: Date;
}

/**
 * イベントデータマッピング
 * 
 * イベント名とそのデータ型のマッピングです。
 * TypeScript で型安全なイベントハンドラーを作成する際に使用します。
 * 
 * @example 型安全なイベントハンドラー
 * ```typescript
 * import type { EventDataMap } from './types';
 * 
 * function handlePlayerJoin(event: EventDataMap['playerJoin']) {
 *   console.log(event.player.name);
 * }
 * 
 * api.on('playerJoin', handlePlayerJoin);
 * ```
 */
export interface EventDataMap {
  playerJoin: PlayerJoinEvent;
  playerLeave: PlayerLeaveEvent;
  serverStart: ServerStartEvent;
  serverStop: ServerStopEvent;
  serverStatusChange: ServerStatusChangeEvent;
  consoleOutput: ConsoleOutputEvent;
  consoleCommand: ConsoleCommandEvent;
  error: ErrorEvent;
}
