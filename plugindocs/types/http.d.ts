/**
 * BedrockProxy HTTP API
 * 
 * 外部APIとの通信やWebhookの作成に使用するHTTPクライアントです。
 * GET、POST、PUT、DELETE、PATCHなどの全てのHTTPメソッドをサポートします。
 * 
 * @module HttpAPI
 */

/**
 * HTTPメソッド
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * HTTPリクエストオプション
 * リクエストの動作をカスタマイズするための設定
 */
export interface HttpRequestOptions {
  /** 
   * HTTPメソッド
   * @default 'GET'
   */
  method?: HttpMethod;
  
  /** 
   * リクエストヘッダー
   * @example { 'Authorization': 'Bearer token123', 'Content-Type': 'application/json' }
   */
  headers?: Record<string, string>;
  
  /** 
   * リクエストボディ（自動的にシリアライズされます）
   * オブジェクトの場合は自動的にJSON文字列に変換されます
   */
  body?: any;
  
  /** 
   * クエリパラメータ
   * URLに自動的に追加されます
   * @example { page: 1, limit: 10 }
   */
  params?: Record<string, string | number | boolean>;
  
  /** 
   * リクエストタイムアウト（ミリ秒）
   * @default 30000
   */
  timeout?: number;
  
  /** 
   * レスポンスタイプ
   * レスポンスデータをどの形式で受け取るか指定します
   * @default 'json'
   */
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  
  /** 
   * リダイレクトを自動で追跡するか
   * @default true
   */
  followRedirects?: boolean;
  
  /** 
   * 最大リダイレクト回数
   * @default 5
   */
  maxRedirects?: number;
  
  /** 
   * ステータスコードの検証
   * @default true
   */
  validateStatus?: boolean;
}

/**
 * HTTPレスポンス
 * サーバーからの応答データとメタ情報を含みます
 * 
 * @template T レスポンスデータの型
 */
export interface HttpResponse<T = any> {
  /** レスポンスデータ */
  data: T;
  
  /** HTTPステータスコード（例: 200, 404, 500） */
  status: number;
  
  /** HTTPステータステキスト（例: "OK", "Not Found"） */
  statusText: string;
  
  /** レスポンスヘッダー */
  headers: Record<string, string>;
  
  /** 使用されたリクエスト設定 */
  config: HttpRequestOptions;
}

/**
 * HTTP API
 * 
 * 外部サービスとのHTTP通信を行うためのAPIです。
 * REST API、Webhook、ファイルダウンロードなどに使用できます。
 * 
 * @example
 * ```javascript
 * // GETリクエスト
 * const response = await api.http.get('https://api.example.com/users');
 * api.info(`Users: ${response.data.length}`);
 * 
 * // POSTリクエスト
 * const result = await api.http.post('https://api.example.com/users', {
 *   name: 'John',
 *   email: 'john@example.com'
 * });
 * 
 * // ヘッダー付きリクエスト
 * const data = await api.http.get('https://api.example.com/protected', {
 *   headers: {
 *     'Authorization': 'Bearer your-token-here'
 *   }
 * });
 * ```
 */
export interface HttpAPI {
  /**
   * GETリクエストを送信します
   * データの取得に使用します
   * 
   * @param url - リクエストURL
   * @param options - リクエストオプション
   * @returns HTTPレスポンス
   * 
   * @example
   * ```javascript
   * // シンプルなGET
   * const response = await api.http.get('https://api.example.com/data');
   * api.info(response.data);
   * 
   * // クエリパラメータ付き
   * const response = await api.http.get('https://api.example.com/search', {
   *   params: { q: 'minecraft', limit: 10 }
   * });
   * // URL: https://api.example.com/search?q=minecraft&limit=10
   * ```
   */
  get<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  
  /**
   * POSTリクエストを送信します
   * データの作成や送信に使用します
   * 
   * @param url - リクエストURL
   * @param data - 送信するデータ
   * @param options - リクエストオプション
   * @returns HTTPレスポンス
   * 
   * @example
   * ```javascript
   * // JSON送信
   * const response = await api.http.post('https://api.example.com/users', {
   *   name: 'Steve',
   *   role: 'admin'
   * });
   * 
   * // カスタムヘッダー付き
   * const response = await api.http.post('https://api.example.com/data', data, {
   *   headers: {
   *     'Content-Type': 'application/json',
   *     'Authorization': 'Bearer token123'
   *   }
   * });
   * ```
   */
  post<T = any>(url: string, data?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  
  /**
   * PUTリクエストを送信します
   * データの更新（完全置き換え）に使用します
   * 
   * @param url - リクエストURL
   * @param data - 送信するデータ
   * @param options - リクエストオプション
   * @returns HTTPレスポンス
   * 
   * @example
   * ```javascript
   * const response = await api.http.put('https://api.example.com/users/123', {
   *   name: 'Updated Name',
   *   email: 'new@example.com'
   * });
   * ```
   */
  put<T = any>(url: string, data?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  
  /**
   * DELETEリクエストを送信します
   * データの削除に使用します
   * 
   * @param url - リクエストURL
   * @param options - リクエストオプション
   * @returns HTTPレスポンス
   * 
   * @example
   * ```javascript
   * const response = await api.http.delete('https://api.example.com/users/123');
   * if (response.status === 204) {
   *   api.info('削除に成功しました');
   * }
   * ```
   */
  delete<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  
  /**
   * PATCHリクエストを送信します
   * データの部分更新に使用します
   * 
   * @param url - リクエストURL
   * @param data - 送信するデータ（変更箇所のみ）
   * @param options - リクエストオプション
   * @returns HTTPレスポンス
   * 
   * @example
   * ```javascript
   * // 名前だけを更新
   * const response = await api.http.patch('https://api.example.com/users/123', {
   *   name: 'New Name'
   * });
   * ```
   */
  patch<T = any>(url: string, data?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  
  /**
   * カスタムHTTPリクエストを送信します
   * 全てのオプションを指定できる汎用メソッドです
   * 
   * @param options - リクエストオプション（URLを含む）
   * @returns HTTPレスポンス
   * 
   * @example
   * ```javascript
   * const response = await api.http.request({
   *   url: 'https://api.example.com/data',
   *   method: 'GET',
   *   headers: { 'Custom-Header': 'value' },
   *   timeout: 5000,
   *   params: { id: 123 }
   * });
   * ```
   */
  request<T = any>(options: HttpRequestOptions & { url: string }): Promise<HttpResponse<T>>;
  
  /**
   * ファイルをダウンロードします
   * プラグインデータディレクトリにファイルを保存します
   * 
   * @param url - ダウンロードするファイルのURL
   * @param destination - 保存先のパス（プラグインデータディレクトリからの相対パス）
   * 
   * @example
   * ```javascript
   * // プラグインデータディレクトリに画像をダウンロード
   * await api.http.download(
   *   'https://example.com/image.png',
   *   'downloads/image.png'
   * );
   * api.info('ファイルをダウンロードしました');
   * 
   * // ダウンロード後に読み込む
   * const data = await api.fs.readFile('downloads/image.png');
   * ```
   */
  download(url: string, destination: string): Promise<void>;
  
  /**
   * Webhookエンドポイントを作成します
   * 外部サービスからのコールバックを受け取ることができます
   * 注意: この機能を使用するには、サーバー側でルーティング設定が必要です
   * 
   * @param path - エンドポイントパス
   * @param handler - リクエストハンドラ関数
   * 
   * @example
   * ```javascript
   * // Webhookエンドポイントを作成
   * api.http.createWebhook('/my-plugin/webhook', (req, res) => {
   *   api.info('Webhook received:', req.body);
   *   
   *   // レスポンスを返す
   *   res.status(200).json({ success: true });
   * });
   * 
   * // 外部サービスはこのURLにPOSTリクエストを送信できます:
   * // POST http://your-server/webhooks/my-plugin/webhook
   * ```
   */
  createWebhook(path: string, handler: (req: any, res: any) => void): void;
  
  /**
   * Webhookハンドラを取得します
   * 内部使用向けのメソッドです
   * 
   * @param path - エンドポイントパス
   * @returns ハンドラ関数、見つからない場合はundefined
   */
  getWebhookHandler(path: string): Function | undefined;
  
  /**
   * Webhookエンドポイントを削除します
   * 
   * @param path - エンドポイントパス
   * @returns 削除成功時true
   * 
   * @example
   * ```javascript
   * const removed = api.http.removeWebhook('/my-plugin/webhook');
   * if (removed) {
   *   api.info('Webhookを削除しました');
   * }
   * ```
   */
  removeWebhook(path: string): boolean;
}

