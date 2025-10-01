/**
 * BedrockProxy Storage API
 * 
 * プラグインの永続ストレージ機能を提供します。
 * 暗号化、圧縮、TTL（有効期限）をサポートしています。
 * 
 * @module StorageAPI
 */

/**
 * ストレージオプション
 * データ保存時の追加設定
 */
export interface StorageOptions {
  /** 
   * データを暗号化して保存します
   * デフォルトはfalse
   * @default false
   */
  encrypt?: boolean;
  
  /** 
   * データを圧縮して保存します
   * 大きなデータの保存に有用
   * @default false
   */
  compress?: boolean;
  
  /** 
   * データの有効期限（ミリ秒）
   * 指定した時間経過後、データは自動削除されます
   * @example 3600000 // 1時間
   */
  ttl?: number;
}

/**
 * ストレージAPI
 * 
 * キーバリュー形式でデータを永続保存します。
 * プラグイン専用のディレクトリにJSON形式で保存されます。
 * 
 * @example
 * ```javascript
 * // シンプルな保存と取得
 * await api.storage.set('config', { enabled: true });
 * const config = await api.storage.get('config');
 * 
 * // 暗号化して保存
 * await api.storage.set('secret', 'password123', { encrypt: true });
 * 
 * // TTL付きで保存（1時間後に自動削除）
 * await api.storage.set('temp', data, { ttl: 3600000 });
 * 
 * // 名前空間を使用
 * const userStorage = api.storage.namespace('users');
 * await userStorage.set('player1', { score: 100 });
 * ```
 */
export interface StorageAPI {
  /**
   * ストレージから値を取得します
   * TTLが設定されている場合、期限切れデータは自動的に削除されます
   * 
   * @param key - ストレージキー
   * @param defaultValue - キーが存在しない場合のデフォルト値
   * @returns 保存された値、または存在しない場合はdefaultValue
   * 
   * @example
   * ```javascript
   * // デフォルト値なしで取得
   * const value = await api.storage.get('myKey');
   * 
   * // デフォルト値付きで取得
   * const config = await api.storage.get('config', { enabled: true });
   * ```
   */
  get<T = any>(key: string, defaultValue?: T): Promise<T | undefined>;
  
  /**
   * ストレージに値を保存します
   * オブジェクトは自動的にJSON形式にシリアライズされます
   * 
   * @param key - ストレージキー
   * @param value - 保存する値（オブジェクト、配列、プリミティブなど）
   * @param options - ストレージオプション（暗号化、圧縮、TTL）
   * 
   * @example
   * ```javascript
   * // シンプルな保存
   * await api.storage.set('playerName', 'Steve');
   * 
   * // オブジェクトを保存
   * await api.storage.set('config', { theme: 'dark', lang: 'ja' });
   * 
   * // 暗号化して保存
   * await api.storage.set('apiKey', 'secret123', { encrypt: true });
   * 
   * // 1時間後に自動削除
   * await api.storage.set('session', data, { ttl: 3600000 });
   * ```
   */
  set<T = any>(key: string, value: T, options?: StorageOptions): Promise<void>;
  
  /**
   * キーが存在するか確認します
   * TTLが設定されている場合、期限切れの場合はfalseを返します
   * 
   * @param key - ストレージキー
   * @returns 存在する場合true
   * 
   * @example
   * ```javascript
   * if (await api.storage.has('config')) {
   *   api.info('設定が存在します');
   * }
   * ```
   */
  has(key: string): Promise<boolean>;
  
  /**
   * ストレージからキーを削除します
   * 
   * @param key - 削除するストレージキー
   * @returns 削除成功時true、キーが存在しない場合false
   * 
   * @example
   * ```javascript
   * const deleted = await api.storage.delete('oldData');
   * if (deleted) {
   *   api.info('データを削除しました');
   * }
   * ```
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * ストレージ内の全データを削除します
   * 注意: この操作は元に戻せません
   * 
   * @example
   * ```javascript
   * await api.storage.clear();
   * api.info('全データを削除しました');
   * ```
   */
  clear(): Promise<void>;
  
  /**
   * ストレージ内の全キーを取得します
   * 
   * @returns キー名の配列
   * 
   * @example
   * ```javascript
   * const keys = await api.storage.keys();
   * api.info(`保存されているキー: ${keys.join(', ')}`);
   * ```
   */
  keys(): Promise<string[]>;
  
  /**
   * ストレージ内の全値を取得します
   * 期限切れのデータは除外されます
   * 
   * @returns 全ての値の配列
   * 
   * @example
   * ```javascript
   * const allValues = await api.storage.values();
   * api.info(`${allValues.length}個のデータが保存されています`);
   * ```
   */
  values(): Promise<any[]>;
  
  /**
   * ストレージ内の全エントリ（キーと値のペア）を取得します
   * 
   * @returns [key, value]の配列
   * 
   * @example
   * ```javascript
   * const entries = await api.storage.entries();
   * for (const [key, value] of entries) {
   *   api.info(`${key}: ${JSON.stringify(value)}`);
   * }
   * ```
   */
  entries(): Promise<Array<[string, any]>>;
  
  /**
   * ストレージの合計サイズをバイト単位で取得します
   * 
   * @returns ストレージサイズ（バイト）
   * 
   * @example
   * ```javascript
   * const bytes = await api.storage.size();
   * const mb = (bytes / 1024 / 1024).toFixed(2);
   * api.info(`ストレージ使用量: ${mb} MB`);
   * ```
   */
  size(): Promise<number>;
  
  /**
   * 名前空間付きストレージを作成します
   * 同じプラグイン内で異なるデータカテゴリを分離するのに便利です
   * 
   * @param namespace - 名前空間プレフィックス
   * @returns 名前空間付きStorageAPIインスタンス
   * 
   * @example
   * ```javascript
   * // ユーザーデータ用の名前空間
   * const userStorage = api.storage.namespace('users');
   * await userStorage.set('player1', { score: 100 });
   * 
   * // 設定用の名前空間
   * const configStorage = api.storage.namespace('config');
   * await configStorage.set('theme', 'dark');
   * 
   * // それぞれ独立したキー空間を持つ
   * ```
   */
  namespace(namespace: string): StorageAPI;
}
