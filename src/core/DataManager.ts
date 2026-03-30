import { Candle } from '../types/Candle';

/**
 * 負責資料載入 (OKX API + WebSocket)、快取及排序
 */
export class DataManager {
  private candles: Candle[] = [];
  private onDataUpdated: (candles: Candle[], isHistory: boolean) => void;
  private onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting') => void;
  private instId = 'BTC-USDT-SWAP'; // 使用合約數據，確保 WS 頻道穩定
  private bar = '1m'; 
  private intervalMs = 60000; // 🚨 新增：當前週期的毫秒數
  private ws: WebSocket | null = null;
  private pingInterval: number | null = null;

  constructor(
    onDataUpdated: (candles: Candle[], isHistory: boolean) => void,
    onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting') => void
  ) {
    this.onDataUpdated = onDataUpdated;
    this.onStatusChange = onStatusChange;
  }

  public getIntervalMs(): number {
    return this.intervalMs;
  }

  public async setTimeframe(bar: string): Promise<void> {
    if (this.bar === bar) return;
    
    this.bar = bar;
    this.intervalMs = this.parseBarToMs(bar);
    this.candles = [];
    
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    if (this.pingInterval) clearInterval(this.pingInterval);

    await this.loadInitialData();
  }

  private parseBarToMs(bar: string): number {
    const unit = bar.slice(-1);
    const value = parseInt(bar.slice(0, -1)) || 1;
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60000;
      case 'h': return value * 3600000;
      case 'D': return value * 86400000;
      case 'W': return value * 604800000;
      case 'M': return value * 2592000000; // 概算 30 天
      case 'Y': return value * 31536000000; // 概算 365 天
      default: return 60000;
    }
  }

  public async setSymbol(instId: string): Promise<void> {
    if (this.instId === instId) return;
    
    console.log(`[DataManager] Switching symbol to: ${instId}`);
    this.instId = instId;
    this.candles = [];
    
    // 關閉現有連線
    if (this.ws) {
      this.ws.onclose = null; // 暫時移除自動重連邏輯，避免競爭
      this.ws.close();
    }
    if (this.pingInterval) clearInterval(this.pingInterval);

    // 重新載入數據
    await this.loadInitialData();
  }

  public getCandles(): Candle[] {
    return this.candles;
  }

  public async loadInitialData(): Promise<void> {
    try {
      const url = `https://www.okx.com/api/v5/market/candles?instId=${this.instId}&bar=${this.bar}&limit=300`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.code === '0') {
        this.candles = this.parseOKXData(result.data).reverse();
        this.onDataUpdated(this.candles, false);
        this.setupWebSocket();
      }
    } catch (error) {
      console.error('Failed to load OKX initial data:', error);
    }
  }

  private setupWebSocket(): void {
    if (this.ws) this.ws.close();
    if (this.pingInterval) clearInterval(this.pingInterval);

    this.onStatusChange?.('connecting');
    // 修正：K 線數據屬於 Business 頻道，而非 Public 頻道
    this.ws = new WebSocket('wss://ws.okx.com:443/ws/v5/business');

    this.ws.onopen = () => {
      console.log('OKX WebSocket Connected ✅');
      this.onStatusChange?.('connected');
      const subMsg = {
        op: 'subscribe',
        args: [{
          channel: `candle${this.bar}`,
          instId: this.instId
        }]
      };
      this.ws?.send(JSON.stringify(subMsg));

      this.pingInterval = window.setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send('ping');
        }
      }, 20000);
    };

    this.ws.onmessage = (event) => {
      if (event.data === 'pong') return;
      
      const res = JSON.parse(event.data);
      
      if (res.arg?.channel === `candle${this.bar}` && res.data) {
        const raw = res.data[0];
        const candle: Candle = {
          time: parseInt(raw[0]),
          open: parseFloat(raw[1]),
          high: parseFloat(raw[2]),
          low: parseFloat(raw[3]),
          close: parseFloat(raw[4]),
          volume: parseFloat(raw[5]),
        };
        // 僅在偵錯時開啟以下日誌
        // console.log(`[Update] ${this.instId}: ${candle.close}`);
        this.appendRealtimeData(candle);
      } else {
        // console.log('[WS Msg]', res);
      }
    };

    this.ws.onclose = () => {
      this.onStatusChange?.('disconnected');
      if (this.pingInterval) clearInterval(this.pingInterval);
      setTimeout(() => this.setupWebSocket(), 5000);
    };
  }

  public async loadMoreHistory(beforeTime: number): Promise<Candle[]> {
    try {
      // 🚨 提升 limit 到 300，減少請求次數
      const url = `https://www.okx.com/api/v5/market/history-candles?instId=${this.instId}&bar=${this.bar}&after=${beforeTime}&limit=300`;
      console.log(`[API] Fetching history (300): ${url}`);
      const response = await fetch(url);
      
      if (response.status === 429) {
        console.warn('[API] ⚠️ 觸發頻率限制 (429)，請稍後再試');
        return [];
      }

      const result = await response.json();
      if (result.code === '0') {
        const moreData = this.parseOKXData(result.data).reverse();
        console.log(`[API] Received ${moreData.length} candles`);
        this.candles = [...moreData, ...this.candles];
        this.onDataUpdated(this.candles, true); 
        return moreData;
      }
    } catch (error) {
      console.error('Failed to load more OKX history:', error);
    }
    return [];
  }

  private parseOKXData(data: any[]): Candle[] {
    return data.map((item) => ({
      time: parseInt(item[0]),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));
  }

  public appendRealtimeData(candle: Candle): void {
    const last = this.candles[this.candles.length - 1];
    let isChanged = false;

    if (last && last.time === candle.time) {
      this.candles[this.candles.length - 1] = candle;
      isChanged = true;
      // 🚨 如果有成功收到數據，這裡一定會跳動
      console.log(`[OKX Update] Price: ${candle.close}`);
    } 
    else if (last && candle.time > last.time) {
      this.candles.push(candle);
      if (this.candles.length > 5000) this.candles.shift();
      isChanged = true;
      console.log(`[OKX New Candle] Time: ${new Date(candle.time).toLocaleTimeString()}`);
    }
    
    if (isChanged) {
      this.onDataUpdated(this.candles, false);
    }
  }
}
