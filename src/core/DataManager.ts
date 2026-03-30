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

  // 🚨 新增：按照 OKX 邏輯精確推算任何 Index 的時間戳
  public getTimeAtIndex(targetIndex: number): number {
    if (this.candles.length === 0) return Date.now();

    const refCandle = this.candles[this.candles.length - 1];
    const refIndex = this.candles.length - 1;
    const diff = targetIndex - refIndex;

    if (diff === 0) return refCandle.time;

    const unit = this.bar.slice(-1);
    const value = parseInt(this.bar.slice(0, -1)) || 1;

    // 線性週期 (秒、分、時、日)
    if (unit === 's' || unit === 'm' || unit === 'H' || unit === 'D') {
      return refCandle.time + diff * this.intervalMs;
    }

    // 非線性週期 (週、月、年)
    const d = new Date(refCandle.time);
    
    // 🚨 關鍵：先對齊到該週期的「開盤起始點」
    if (unit === 'W') {
      // 週線：對齊到週一 (OKX 規範)
      const day = d.getUTCDay();
      const diffToMonday = (day === 0 ? 6 : day - 1);
      d.setUTCDate(d.getUTCDate() - diffToMonday);
      d.setUTCHours(0, 0, 0, 0);
      return d.getTime() + diff * 7 * 86400000;
    } else if (unit === 'M') {
      // 月線：對齊到該月 1 號 00:00
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCMonth(d.getUTCMonth() + diff * value);
      return d.getTime();
    } else if (unit === 'Y') {
      // 年線：對齊到該年 1 月 1 號 00:00
      d.setUTCMonth(0, 1);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCFullYear(d.getUTCFullYear() + diff * value);
      return d.getTime();
    }

    return refCandle.time + diff * this.intervalMs;
  }

  public async setTimeframe(bar: string): Promise<void> {
    // 🚨 格式化為 OKX 規格：h->H, d->D, w->W, M->M, y->Y, 只有 s 和 m 維持小寫
    const formattedBar = bar
      .replace('h', 'H')
      .replace('d', 'D')
      .replace('w', 'W')
      .replace('y', 'Y')
      .replace('M', 'M'); // 月份本來就是大寫，確保一致性
    
    if (this.bar === formattedBar) return;
    
    this.bar = formattedBar;
    this.intervalMs = this.parseBarToMs(formattedBar);
    this.candles = [];
    
    console.log(`[DataManager] Timeframe changed to: ${this.bar} (${this.intervalMs}ms)`);

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    if (this.pingInterval) clearInterval(this.pingInterval);

    await this.loadInitialData();
  }

  private parseBarToMs(bar: string): number {
    const unit = bar.slice(-1); // 這裡不再轉小寫，直接判斷大寫
    const value = parseInt(bar.slice(0, -1)) || 1;
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60000;
      case 'H': return value * 3600000; // 🚨 改為大寫 H
      case 'D': return value * 86400000; // 🚨 改為大寫 D
      case 'W': return value * 604800000; // 🚨 改為大寫 W
      case 'M': return value * 2592000000; 
      case 'Y': return value * 31536000000; // 🚨 改為大寫 Y
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
      this.ws.onclose = null;
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
      // 🚨 此處 bar 現在已經是正確的大寫格式
      const url = `https://www.okx.com/api/v5/market/candles?instId=${this.instId}&bar=${this.bar}&limit=300`;
      console.log(`[DataManager] Fetching initial data: ${url}`);
      const response = await fetch(url);
      const result = await response.json();

      if (result.code === '0') {
        console.log(`[DataManager] Received ${result.data.length} initial candles`);
        this.candles = this.parseOKXData(result.data).reverse();
        this.onDataUpdated(this.candles, false);
        this.setupWebSocket();
      } else {
        console.error(`[DataManager] OKX API Error:`, result);
      }
    } catch (error) {
      console.error('[DataManager] Failed to load OKX initial data:', error);
    }
  }

  private setupWebSocket(): void {
    if (this.ws) this.ws.close();
    if (this.pingInterval) clearInterval(this.pingInterval);

    const wsUrl = 'wss://ws.okx.com:443/ws/v5/business';
    console.log(`[DataManager] Connecting to WebSocket: ${wsUrl}`);
    this.onStatusChange?.('connecting');
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[DataManager] WebSocket Connected ✅');
      this.onStatusChange?.('connected');
      
      const subMsg = {
        op: 'subscribe',
        args: [{
          channel: `candle${this.bar}`, // 🚨 直接使用正確格式的 bar
          instId: this.instId
        }]
      };
      console.log(`[DataManager] Subscribing:`, JSON.stringify(subMsg));
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
      
      // 記錄訂閱回應
      if (res.event === 'subscribe') {
        console.log(`[DataManager] Subscription Success:`, res.arg);
        return;
      }

      if (res.arg?.channel === `candle${this.bar}` && res.data) { // 🚨 直接比較
        const raw = res.data[0];
        const candle: Candle = {
          time: parseInt(raw[0]),
          open: parseFloat(raw[1]),
          high: parseFloat(raw[2]),
          low: parseFloat(raw[3]),
          close: parseFloat(raw[4]),
          volume: parseFloat(raw[5]),
        };
        this.appendRealtimeData(candle);
      } else if (res.event === 'error') {
        console.error(`[DataManager] WebSocket Error Message:`, res);
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
