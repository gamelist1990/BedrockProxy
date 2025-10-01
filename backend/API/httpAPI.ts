/**
 * HTTP API Implementation
 * Provides HTTP client for making web requests
 */

import { request as httpsRequest } from "https";
import { request as httpRequest } from "http";
import { URL } from "url";
import { writeFile } from "fs/promises";
import { join } from "path";

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface HttpRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer';
  followRedirects?: boolean;
  maxRedirects?: number;
  validateStatus?: boolean;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: HttpRequestOptions;
}

export class HttpAPI {
  private pluginDataDir: string;
  private webhooks = new Map<string, Function>();
  
  constructor(pluginDataDir: string) {
    this.pluginDataDir = pluginDataDir;
  }
  
  /**
   * Make HTTP request
   */
  private async makeRequest<T = any>(
    url: string, 
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    return new Promise((resolve, reject) => {
      try {
        // Parse URL and add query parameters
        const urlObj = new URL(url);
        if (options.params) {
          Object.entries(options.params).forEach(([key, value]) => {
            urlObj.searchParams.append(key, String(value));
          });
        }
        
        const isHttps = urlObj.protocol === 'https:';
        const requestFn = isHttps ? httpsRequest : httpRequest;
        
        // Prepare headers
        const headers: Record<string, string> = {
          'User-Agent': 'BedrockProxy-Plugin/1.0',
          ...options.headers
        };
        
        // Add content type for body
        if (options.body && !headers['Content-Type']) {
          headers['Content-Type'] = 'application/json';
        }
        
        // Serialize body
        let bodyData: string | undefined;
        if (options.body) {
          if (typeof options.body === 'string') {
            bodyData = options.body;
          } else if (headers['Content-Type']?.includes('json')) {
            bodyData = JSON.stringify(options.body);
          } else {
            bodyData = String(options.body);
          }
          headers['Content-Length'] = String(Buffer.byteLength(bodyData));
        }
        
        const req = requestFn({
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method: options.method || 'GET',
          headers,
          timeout: options.timeout || 30000
        }, (res) => {
          const chunks: Buffer[] = [];
          
          res.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          
          res.on('end', () => {
            const buffer = Buffer.concat(chunks);
            let data: any;
            
            // Parse response based on type
            const responseType = options.responseType || 'json';
            try {
              if (responseType === 'json') {
                data = JSON.parse(buffer.toString('utf-8'));
              } else if (responseType === 'text') {
                data = buffer.toString('utf-8');
              } else if (responseType === 'arraybuffer') {
                data = buffer;
              } else {
                data = buffer;
              }
            } catch (error) {
              // If JSON parse fails, return as text
              data = buffer.toString('utf-8');
            }
            
            // Handle redirects
            if (options.followRedirects !== false && 
                res.statusCode && 
                [301, 302, 303, 307, 308].includes(res.statusCode) &&
                res.headers.location) {
              const maxRedirects = options.maxRedirects || 5;
              if (maxRedirects > 0) {
                const redirectUrl = new URL(res.headers.location, url).toString();
                return this.makeRequest<T>(redirectUrl, {
                  ...options,
                  maxRedirects: maxRedirects - 1
                }).then(resolve).catch(reject);
              }
            }
            
            resolve({
              data: data as T,
              status: res.statusCode || 200,
              statusText: res.statusMessage || 'OK',
              headers: res.headers as Record<string, string>,
              config: options
            });
          });
        });
        
        req.on('error', (error) => {
          reject(new Error(`HTTP request failed: ${error.message}`));
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('HTTP request timeout'));
        });
        
        // Send body if present
        if (bodyData) {
          req.write(bodyData);
        }
        
        req.end();
      } catch (error: any) {
        reject(new Error(`Failed to make HTTP request: ${error.message}`));
      }
    });
  }
  
  /**
   * Make a GET request
   */
  async get<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.makeRequest<T>(url, { ...options, method: 'GET' });
  }
  
  /**
   * Make a POST request
   */
  async post<T = any>(url: string, data?: any, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.makeRequest<T>(url, { ...options, method: 'POST', body: data });
  }
  
  /**
   * Make a PUT request
   */
  async put<T = any>(url: string, data?: any, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.makeRequest<T>(url, { ...options, method: 'PUT', body: data });
  }
  
  /**
   * Make a DELETE request
   */
  async delete<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.makeRequest<T>(url, { ...options, method: 'DELETE' });
  }
  
  /**
   * Make a PATCH request
   */
  async patch<T = any>(url: string, data?: any, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.makeRequest<T>(url, { ...options, method: 'PATCH', body: data });
  }
  
  /**
   * Make a custom request
   */
  async request<T = any>(options: HttpRequestOptions & { url: string }): Promise<HttpResponse<T>> {
    const { url, ...requestOptions } = options;
    return this.makeRequest<T>(url, requestOptions);
  }
  
  /**
   * Download a file
   */
  async download(url: string, destination: string): Promise<void> {
    const response = await this.makeRequest<Buffer>(url, { responseType: 'arraybuffer' });
    const fullPath = join(this.pluginDataDir, destination);
    await writeFile(fullPath, response.data);
  }
  
  /**
   * Create a webhook server endpoint
   */
  createWebhook(path: string, handler: (req: any, res: any) => void): void {
    this.webhooks.set(path, handler);
    console.log(`📡 Webhook registered: ${path}`);
  }
  
  /**
   * Get webhook handler
   */
  getWebhookHandler(path: string): Function | undefined {
    return this.webhooks.get(path);
  }
  
  /**
   * Remove webhook
   */
  removeWebhook(path: string): boolean {
    return this.webhooks.delete(path);
  }
}
