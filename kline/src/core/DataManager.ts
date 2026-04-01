import { Candle } from '../types/Candle';

/**
 * 負責資料載入 (OKX API + WebSocket)、快取及排序
 */
export class DataManager {
  private candles: Candle[] = [];
  private onDataUpdated: (candles: Candle[], isHistory: boolean) => void;
  private onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting') => void;
  private instId = 'BTC/USDT'; 
  private currentSource = ''; // 🚨 新增：當前交易所來源
  private bar = '1m'; 
  private intervalMs = 60000; 
  private ws: WebSocket | null = null;
  private pingInterval: any = null;
  private reconnectTimeout: any = null; // 🚨 新增：重連定時器

  // Backend URLs
  private apiUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port === '5173')
    ? 'http://localhost:3001' 
    : 'https://tradingviewer-gtr2.onrender.com';
    
  private wsUrl = this.apiUrl.replace('http', 'ws');

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
    
    // 🚨 修正：絕對禁止推算資料開盤前的時間 (過去)
    if (dataIdx < 0) return NaN;

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

  public async update(instId: string, bar: string, source: string): Promise<void> {
    const formattedBar = bar
      .replace('h', 'H').replace('d', 'D').replace('w', 'W').replace('y', 'Y').replace('M', 'M');
    
    // 如果全部沒變，不執行
    if (this.instId === instId && this.bar === formattedBar && this.currentSource === source) return;

    console.log(`[DataManager] Full update: ${instId} (${formattedBar}) from ${source || 'Auto'}`);
    
    this.instId = instId;
    this.bar = formattedBar;
    this.currentSource = source;
    this.intervalMs = this.parseBarToMs(formattedBar);
    this.candles = [];

    await this.reload();
  }

  public async setTimeframe(bar: string): Promise<void> {
    const formattedBar = bar
      .replace('h', 'H').replace('d', 'D').replace('w', 'W').replace('y', 'Y').replace('M', 'M');
    
    if (this.bar === formattedBar) return;
    
    this.bar = formattedBar;
    this.intervalMs = this.parseBarToMs(formattedBar);
    this.candles = [];
    await this.reload();
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
    this.reload();
  }

  public async setExchange(source: string): Promise<void> {
    if (this.currentSource === source) return;
    
    console.log(`[DataManager] Switching exchange to: ${source || 'Auto'}`);
    this.currentSource = source;
    this.candles = [];
    this.reload();
  }

  private async reload(): Promise<void> {
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

  /**
   * 將時間戳轉換回索引 (支援浮點數索引，用於 K 棒之間的點位)
   */
  public getIndexAtTime(time: number): number {
    if (this.candles.length === 0) return 0;

    // 1. 如果在數據範圍內，使用二分搜尋尋找最接近的 K 棒
    const first = this.candles[0].time;
    const last = this.candles[this.candles.length - 1].time;

    if (time >= first && time <= last) {
      // 簡單起見，這裡假設時間間隔大致固定進行二分搜尋
      let low = 0;
      let high = this.candles.length - 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (this.candles[mid].time === time) return mid;
        if (this.candles[mid].time < time) low = mid + 1;
        else high = mid - 1;
      }
      // 如果沒找到精確的，推算浮點索引
      const idx = Math.max(0, high);
      const ratio = (time - this.candles[idx].time) / this.intervalMs;
      return idx + ratio;
    }

    // 2. 如果在未來或過去，根據邊界推算
    const refTime = time > last ? last : first;
    const refIdx = time > last ? this.candles.length - 1 : 0;
    return refIdx + (time - refTime) / this.intervalMs;
  }

  public async loadInitialData(): Promise<void> {
    try {
      this.onStatusChange?.('connecting');
      // 🚨 修正：參數必須進行 URL 編碼
      const encodedId = encodeURIComponent(this.instId);
      const encodedBar = encodeURIComponent(this.bar);
      let url = `${this.apiUrl}/klines?id=${encodedId}&interval=${encodedBar}`;
      if (this.currentSource) url += `&source=${encodeURIComponent(this.currentSource)}`;

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
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout); // 成功連線，取消重連定時器
      
      const subMsg: any = {
        type: 'subscribe',
        id: this.instId,
        interval: this.bar
      };
      if (this.currentSource) subMsg.source = this.currentSource;

      console.log(`[DataManager] Subscribing via Backend:`, JSON.stringify(subMsg));
      this.ws?.send(JSON.stringify(subMsg));

      // 🚨 啟動心跳機制 (Ping)
      this.pingInterval = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // 每 30 秒 Ping 一次
    };

    this.ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      if (res.type === 'pong') return; // 忽略 Pong 回應
      
      // 🚨 關鍵修復：嚴格檢查 res.interval
      // 只有當前訂閱的標的且週期完全一致時才接受數據
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
        this.appendRealtimeData(candle, res.interval);
      } else if (res.type === 'error') {
        console.error(`[DataManager] Backend WebSocket Error:`, res.message);
      }
    };

    this.ws.onclose = (event) => {
      console.warn(`[DataManager] WebSocket Closed: ${event.code} ${event.reason}`);
      this.onStatusChange?.('disconnected');
      if (this.pingInterval) clearInterval(this.pingInterval);

      // 🚨 自動重連邏輯
      if (!this.reconnectTimeout) {
        console.log('[DataManager] Attempting to reconnect in 5s...');
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectTimeout = null;
          this.setupWebSocket();
        }, 5000);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[DataManager] WebSocket Error Details:', err);
      // 🚨 提示使用者確認後端網址
      console.warn(`[DataManager] Check if backend is alive: ${this.apiUrl}/health`);
      this.ws?.close();
    };
  }

  public async loadMoreHistory(beforeTime: number): Promise<Candle[]> {
    try {
      let url = `${this.apiUrl}/klines?id=${this.instId}&interval=${this.bar}&endTime=${beforeTime}`;
      if (this.currentSource) url += `&source=${this.currentSource}`;
      
      console.log(`[DataManager] Fetching history from backend: ${url}`);
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        const moreData = this.parseBackendData(result.data);
        
        if (moreData.length === 0) return [];
        
        const firstExistingTime = this.candles[0]?.time || Infinity;
        const validNewData = moreData.filter(c => c.time < firstExistingTime);

        if (validNewData.length === 0) {
          console.log(`[DataManager] 🏁 No unique history found, stopping.`);
          return [];
        }

        // 🚨 再次檢查，確保歷史資料在載入過程中沒有切換 Timeframe
        // (雖然這種情況少見，但為求嚴謹)

        console.log(`[DataManager] Received ${validNewData.length} unique history candles`);
        this.candles = [...validNewData, ...this.candles];
        this.onDataUpdated(this.candles, true); 
        return validNewData;
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

  public appendRealtimeData(candle: Candle, candleInterval: string): void {
    // 🚨 最終防護：如果進來的資料週期與目前 DataManager 鎖定的週期不符，絕對不寫入
    if (candleInterval !== this.bar) {
      // console.warn(`[DataManager] Discarding mismatched candle: expected ${this.bar}, got ${candleInterval}`);
      return;
    }

    const last = this.candles[this.candles.length - 1];
    let isChanged = false;

    if (last && last.time === candle.time) {
      this.candles[this.candles.length - 1] = candle;
      isChanged = true;
      // console.log(`[Backend Update] Price: ${candle.close}`);
    } 
    else if (last && candle.time > last.time) {
      this.candles.push(candle);
      if (this.candles.length > 5000) this.candles.shift();
      isChanged = true;
      console.log(`[Backend New Candle] ${this.bar} Time: ${new Date(candle.time).toLocaleTimeString()}`);
    }
    
    if (isChanged) {
      this.onDataUpdated(this.candles, false);
    }
  }
}
