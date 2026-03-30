import { Candle } from '../types/Candle';

/**
 * 負責資料載入 (OKX API + WebSocket)、快取及排序
 */
export class DataManager {
  private candles: Candle[] = [];
  private onDataUpdated: (candles: Candle[], isHistory: boolean) => void;
  private onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting') => void;
  private instId = 'BTC/USDT'; // 使用統一的 ID
  private bar = '1m'; 
  private intervalMs = 60000; 
  private ws: WebSocket | null = null;
  private pingInterval: number | null = null;

  // Backend URLs
  private apiUrl = 'http://localhost:3001';
  private wsUrl = 'ws://localhost:3002';

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

  // 🚨 修正：優先使用實際數據時間，徹底解決對齊偏移問題
  public getTimeAtIndex(targetIndex: number): number {
    if (this.candles.length === 0) return Date.now();

    const dataIdx = Math.floor(targetIndex);

    // 1. 🚨 關鍵優先：如果在現有數據範圍內，直接回傳該 K 棒的精確時間
    // 這能自動處理任何數據空隙 (Gaps)，確保標籤與 K 棒絕對對齊
    if (dataIdx >= 0 && dataIdx < this.candles.length) {
      return this.candles[dataIdx].time;
    }

    // 2. 否則：才根據邊界進行推算 (未來或更遠的過去)
    const isFuture = dataIdx >= this.candles.length;
    const refCandle = isFuture ? this.candles[this.candles.length - 1] : this.candles[0];
    const refIndex = isFuture ? this.candles.length - 1 : 0;
    const diff = dataIdx - refIndex;

    const unit = this.bar.slice(-1);
    const value = parseInt(this.bar.slice(0, -1)) || 1;

    if (unit === 's' || unit === 'm' || unit === 'H' || unit === 'D') {
      return refCandle.time + diff * this.intervalMs;
    }

    const d = new Date(refCandle.time);
    if (unit === 'W') {
      const day = d.getUTCDay();
      const diffToMonday = (day === 0 ? 6 : day - 1);
      d.setUTCDate(d.getUTCDate() - diffToMonday);
      d.setUTCHours(0, 0, 0, 0);
      return d.getTime() + diff * 7 * 86400000;
    } else if (unit === 'M') {
      d.setUTCDate(1);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCMonth(d.getUTCMonth() + diff * value);
      return d.getTime();
    } else if (unit === 'Y') {
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
      const url = `${this.apiUrl}/klines?id=${this.instId}&interval=${this.bar}`;
      console.log(`[DataManager] Fetching initial data from backend: ${url}`);
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        const rawData = result.data;
        console.log(`[DataManager] Received ${rawData.length} initial candles`);
        
        this.candles = this.parseBackendData(rawData);
        
        if (this.candles.length > 0) {
          console.log(`[DataManager] Latest Candle: ${new Date(this.candles[this.candles.length - 1].time).toLocaleString()}`);
        }

        this.onDataUpdated(this.candles, false);
        this.setupWebSocket();
      } else {
        console.error(`[DataManager] Backend API Error:`, result.message);
      }
    } catch (error) {
      console.error('[DataManager] Failed to load initial data from backend:', error);
    }
  }

  private setupWebSocket(): void {
    if (this.ws) this.ws.close();
    if (this.pingInterval) clearInterval(this.pingInterval);

    console.log(`[DataManager] Connecting to Backend WebSocket: ${this.wsUrl}`);
    this.onStatusChange?.('connecting');
    
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('[DataManager] Backend WebSocket Connected ✅');
      this.onStatusChange?.('connected');
      
      const subMsg = {
        type: 'subscribe',
        id: this.instId,
        interval: this.bar
      };
      console.log(`[DataManager] Subscribing via Backend:`, JSON.stringify(subMsg));
      this.ws?.send(JSON.stringify(subMsg));
    };

    this.ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      
      if (res.type === 'kline' && res.id === this.instId && res.interval === this.bar) {
        const raw = res.data;
        const candle: Candle = {
          time: raw.timestamp,
          open: raw.open,
          high: raw.high,
          low: raw.low,
          close: raw.close,
          volume: raw.volume,
        };
        this.appendRealtimeData(candle);
      } else if (res.type === 'error') {
        console.error(`[DataManager] Backend WebSocket Error:`, res.message);
      }
    };

    this.ws.onclose = () => {
      this.onStatusChange?.('disconnected');
      setTimeout(() => this.setupWebSocket(), 5000);
    };
  }

  public async loadMoreHistory(beforeTime: number): Promise<Candle[]> {
    try {
      const url = `${this.apiUrl}/klines?id=${this.instId}&interval=${this.bar}&endTime=${beforeTime}`;
      console.log(`[DataManager] Fetching history from backend: ${url}`);
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        const moreData = this.parseBackendData(result.data);
        console.log(`[DataManager] Received ${moreData.length} history candles`);
        this.candles = [...moreData, ...this.candles];
        this.onDataUpdated(this.candles, true); 
        return moreData;
      }
    } catch (error) {
      console.error('Failed to load more history from backend:', error);
    }
    return [];
  }

  private parseBackendData(data: any[]): Candle[] {
    return data.map((item) => ({
      time: item.timestamp,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }));
  }

  public appendRealtimeData(candle: Candle): void {
    const last = this.candles[this.candles.length - 1];
    let isChanged = false;

    if (last && last.time === candle.time) {
      this.candles[this.candles.length - 1] = candle;
      isChanged = true;
      console.log(`[Backend Update] Price: ${candle.close}`);
    } 
    else if (last && candle.time > last.time) {
      this.candles.push(candle);
      if (this.candles.length > 5000) this.candles.shift();
      isChanged = true;
      console.log(`[Backend New Candle] Time: ${new Date(candle.time).toLocaleTimeString()}`);
    }
    
    if (isChanged) {
      this.onDataUpdated(this.candles, false);
    }
  }
}
