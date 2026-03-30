import { Candle } from '../types/Candle';

/**
 * 負責資料載入 (OKX API + WebSocket)、快取及排序
 */
export class DataManager {
  private candles: Candle[] = [];
  private onDataUpdated: (candles: Candle[]) => void;
  private onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting') => void;
  private instId = 'BTC-USDT';
  private bar = '1m'; 
  private ws: WebSocket | null = null;
  private pingInterval: number | null = null;

  constructor(
    onDataUpdated: (candles: Candle[]) => void,
    onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting') => void
  ) {
    this.onDataUpdated = onDataUpdated;
    this.onStatusChange = onStatusChange;
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
        this.onDataUpdated(this.candles);
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
    this.ws = new WebSocket('wss://ws.okx.com:443/ws/v5/public');

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
      console.log('WS Raw Message:', event.data); // 🚨 打印所有原始訊息
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
        this.appendRealtimeData(candle);
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
      const url = `https://www.okx.com/api/v5/market/candles?instId=${this.instId}&bar=${this.bar}&after=${beforeTime}&limit=100`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.code === '0') {
        const moreData = this.parseOKXData(result.data).reverse();
        this.candles = [...moreData, ...this.candles];
        this.onDataUpdated(this.candles);
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
      // 🚨 這裡會持續打印，如果數據有在跳動，你會看到 Close 價格在變化
      console.log(`[Update] Price: ${candle.close}`);
    } 
    else if (last && candle.time > last.time) {
      this.candles.push(candle);
      if (this.candles.length > 5000) this.candles.shift();
      isChanged = true;
      console.log(`[New K-Line] Time: ${new Date(candle.time).toLocaleTimeString()}`);
    }
    
    if (isChanged) {
      this.onDataUpdated(this.candles);
    }
  }
}
