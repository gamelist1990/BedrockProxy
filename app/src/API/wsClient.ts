// Lightweight, robust WebSocket client wrapper for frontend
// - single global instance
// - reconnect with backoff + jitter
// - heartbeat (ping/pong) and latency reporting
// - JSON parsing and 'message' event emission with parsed object
// - connection state events: connecting, connected, disconnected, reconnecting, error, latencyUpdate

type ConnState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type WSMessage = any;

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private state: ConnState = 'disconnected';
  private listeners = new Map<string, Function[]>();
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private lastPingTime = 0;
  private latency = 0;
  private connectingPromise: Promise<void> | null = null;

  constructor(url: string = 'ws://localhost:8080') {
    this.url = url;
  }

  public updateConfig(updates: Partial<{ url: string }>) {
    if (updates.url && updates.url !== this.url) {
      this.url = updates.url;
      // if connected, reconnect to apply new URL
      if (this.isConnected()) {
        try { this.disconnect(); } catch (e) {}
        this.connect().catch(() => {});
      }
    }
  }


  public getState() {
    return { status: this.state, reconnectAttempts: this.reconnectAttempts, latency: this.latency };
  }

  public getLatency() { return this.latency; }

  public isConnected() { return this.state === 'connected' && !!this.ws; }

  // Event emitter
  public on(event: string, cb: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(cb);
  }

  public off(event: string, cb?: Function) {
    if (!this.listeners.has(event)) return;
    if (!cb) { this.listeners.delete(event); return; }
    const arr = this.listeners.get(event)!;
    const idx = arr.indexOf(cb);
    if (idx >= 0) arr.splice(idx, 1);
  }

  private emit(event: string, data?: any) {
    const arr = this.listeners.get(event) || [];
    for (const cb of arr) {
      try { cb(data); } catch (e) { console.error('Error in ws listener', e); }
    }
  }

  public async connect(): Promise<void> {
    if (this.isConnected()) return Promise.resolve();
    if (this.state === 'connecting' && this.connectingPromise) return this.connectingPromise;
    // If this is a deliberate connect call (not an ongoing reconnect), reset attempts
    if (this.state !== 'reconnecting') {
      this.reconnectAttempts = 0;
    }

    this.state = 'connecting';
    this.emit('connecting', {});

    this.connectingPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        const cleanup = () => {
          if (!this.ws) return;
          this.ws.onopen = null; this.ws.onmessage = null; this.ws.onclose = null; this.ws.onerror = null;
        };

        this.ws.onopen = () => {
          this.state = 'connected';
          this.reconnectAttempts = 0;
          this.emit('connected', { url: this.url });
          this.startHeartbeat();
          this.connectingPromise = null;
          resolve();
        };

        this.ws.onmessage = (ev) => {
          try {
            const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
            // handle ping/pong at this client level
            if (data && data.type === 'ping') {
              this.send({ type: 'pong', timestamp: data.timestamp || Date.now() });
              return;
            }
            if (data && data.type === 'pong') {
              const now = Date.now();
              const sent = data.timestamp || this.lastPingTime || now;
              this.latency = now - sent;
              this.emit('latencyUpdate', { latency: this.latency });
              return;
            }
            this.emit('message', data);
          } catch (err) {
            console.error('Failed to parse WS message', err);
            this.emit('error', err);
          }
        };

        this.ws.onclose = (ev) => {
          cleanup();
          this.stopHeartbeat();
          this.state = 'disconnected';
          this.emit('disconnected', { code: ev.code, reason: ev.reason, wasClean: ev.wasClean });
          if (ev.code !== 1000) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (err) => {
          console.error('WebSocket error', err);
          this.emit('error', err);
        };

      } catch (error) {
        this.connectingPromise = null;
        // schedule reconnect so transient failures still trigger retry loop
        try {
          this.scheduleReconnect();
        } catch (e) {
          /* ignore schedule errors */
        }
        reject(error);
      }
    });

    return this.connectingPromise;
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    this.connectingPromise = null;
    if (this.ws) {
      try { this.ws.close(1000, 'Client disconnect'); } catch (e) {}
      this.ws = null;
    }
    this.state = 'disconnected';
    this.emit('disconnected', { reason: 'client' });
  }

  public destroy(): void {
    this.disconnect();
    this.listeners.clear();
  }

  public getConfig() {
    return { url: this.url };
  }

  public send(data: any): boolean {
    if (!this.ws || this.state !== 'connected') {
      console.warn('Cannot send message: WebSocket not connected');
      return false;
    }
    try {
      const str = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(str);
      return true;
    } catch (err) {
      console.error('Failed to send ws message', err);
      this.emit('error', err);
      return false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts++;
    const base = 1000 * Math.min(30, Math.pow(1.5, this.reconnectAttempts));
    const jitter = Math.random() * 500;
    const delay = Math.min(base + jitter, 30000);
    this.state = 'reconnecting';
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay, maxAttempts: 9999 });
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(err => { console.error('Reconnect failed', err); });
    }, delay);
  }

  private startHeartbeat() {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.ws) return;
      this.lastPingTime = Date.now();
      this.send({ type: 'ping', timestamp: this.lastPingTime });
      // ping timeout not enforced here; rely on reconnect on close
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }
}

// Export a singleton instance
export const wsClient = new WebSocketClient();
