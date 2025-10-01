/**
 * HTTP API for making web requests
 */

/**
 * HTTP method
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  /** HTTP method */
  method?: HttpMethod;
  
  /** Request headers */
  headers?: Record<string, string>;
  
  /** Request body (automatically serialized) */
  body?: any;
  
  /** Query parameters */
  params?: Record<string, string | number | boolean>;
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Response type */
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  
  /** Follow redirects (default: true) */
  followRedirects?: boolean;
  
  /** Maximum redirects (default: 5) */
  maxRedirects?: number;
  
  /** Validate SSL certificates (default: true) */
  validateStatus?: boolean;
}

/**
 * HTTP response
 */
export interface HttpResponse<T = any> {
  /** Response data */
  data: T;
  
  /** HTTP status code */
  status: number;
  
  /** HTTP status text */
  statusText: string;
  
  /** Response headers */
  headers: Record<string, string>;
  
  /** Request configuration */
  config: HttpRequestOptions;
}

/**
 * HTTP API
 */
export interface HttpAPI {
  /**
   * Make a GET request
   * @param url - Request URL
   * @param options - Request options
   */
  get<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  
  /**
   * Make a POST request
   * @param url - Request URL
   * @param data - Request body
   * @param options - Request options
   */
  post<T = any>(url: string, data?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  
  /**
   * Make a PUT request
   * @param url - Request URL
   * @param data - Request body
   * @param options - Request options
   */
  put<T = any>(url: string, data?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  
  /**
   * Make a DELETE request
   * @param url - Request URL
   * @param options - Request options
   */
  delete<T = any>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  
  /**
   * Make a PATCH request
   * @param url - Request URL
   * @param data - Request body
   * @param options - Request options
   */
  patch<T = any>(url: string, data?: any, options?: HttpRequestOptions): Promise<HttpResponse<T>>;
  
  /**
   * Make a custom request
   * @param options - Request options with URL
   */
  request<T = any>(options: HttpRequestOptions & { url: string }): Promise<HttpResponse<T>>;
  
  /**
   * Download a file
   * @param url - File URL
   * @param destination - Destination path (relative to plugin data directory)
   */
  download(url: string, destination: string): Promise<void>;
  
  /**
   * Create a webhook server endpoint
   * @param path - Endpoint path
   * @param handler - Request handler
   */
  createWebhook(path: string, handler: (req: any, res: any) => void): void;
}
