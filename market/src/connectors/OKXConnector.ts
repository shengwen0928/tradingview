import axios from 'axios';
import WebSocket from 'ws';
import { Candle, MarketType } from '../types/Candle';
import { IConnector } from './ConnectorInterface';
import { SymbolManager } from '../core/SymbolManager';

/**
 * OKX 資料接入器 (V5 規範)
 * 支援 Spot (現貨) 與 SWAP (永續合約)
 */
export class OKXConnector implements IConnector {
    public readonly name = 'OKX';
    private readonly baseUrl = 'https://www.okx.com/api/v5';
    private readonly wsUrl = 'wss://ws.okx.com:8443/ws/v5/public';
    private ws: WebSocket | null = null;
    private subscribers: Map<string, { symbol: string, interval: string, onUpdate: (candle: Candle) => void }> = new Map();
    private isConnecting = false;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;

    /**
     * 將週期轉換為 OKX 格式 (保持不變)
     */
    private translateInterval(interval: string): string {
        const okxMap: any = {
            '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
            '1h': '1H', '2h': '2H', '4h': '4H', '6h': '6H', '12h': '12H',
            '1d': '1DUTC', '3d': '3DUTC', '1w': '1WUTC',
            '1M': '1Mon', '3M': '3Mon', '1Y': '1YUTC'
        };
        const norm = interval.slice(-1) === 'M' ? interval : interval.toLowerCase();
        return okxMap[norm] || okxMap[interval] || interval;
    }

    /**
     * 抓取歷史 K 線資料 (REST API)
     */
    public async fetchKlines(symbol: string, interval: string, limit: number = 500, endTime?: number): Promise<Candle[]> {
        try {
            const okxInterval = this.translateInterval(interval);
            const url = `${this.baseUrl}/market/history-candles`;
            const params: any = {
                instId: symbol.toUpperCase(),
                bar: okxInterval,
                limit
            };

            if (endTime) {
                params.after = endTime; 
            }

            const response = await axios.get(url, { params });
            const data = response.data.data || [];

            return data.map((item: any[]) => ({
                timestamp: parseInt(item[0]),
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            })).reverse();
        } catch (error) {
            console.error(`[OKXConnector] Fetch error for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * 訂閱即時 K 線更新
     */
    public subscribeKlines(symbol: string, interval: string, onUpdate: (candle: Candle) => void): void {
        const subKey = `${symbol}_${interval}`;
        this.subscribers.set(subKey, { symbol, interval, onUpdate });
        
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.connect();
        } else {
            this.sendSubscription(symbol, interval);
        }
    }

    private connect() {
        if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
        this.isConnecting = true;

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        console.log(`[OKXConnector] Connecting to ${this.wsUrl}...`);
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
            console.log('[OKXConnector] WebSocket Connected ✅');
            this.isConnecting = false;
            
            // 恢復所有訂閱
            this.subscribers.forEach(sub => {
                this.sendSubscription(sub.symbol, sub.interval);
            });

            // 心跳機制 (OKX 期待收到 "ping" 字符串)
            if (this.pingInterval) clearInterval(this.pingInterval);
            this.pingInterval = setInterval(() => {
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.ws.send('ping');
                }
            }, 25000);
        });

        this.ws.on('message', (data: string) => {
            const dataStr = data.toString();
            if (dataStr === 'pong') return;
            
            try {
                const msg = JSON.parse(dataStr);
                if (!msg.data || !msg.data[0]) return;

                const instId = msg.arg.instId;
                const channel = msg.arg.channel;
                
                // 尋找對應的訂閱者
                this.subscribers.forEach((sub) => {
                    if (sub.symbol === instId) {
                        if (channel.startsWith('candles')) {
                            const k = msg.data[0];
                            sub.onUpdate({
                                timestamp: parseInt(k[0]),
                                open: parseFloat(k[1]),
                                high: parseFloat(k[2]),
                                low: parseFloat(k[3]),
                                close: parseFloat(k[4]),
                                volume: parseFloat(k[5])
                            });
                        } else if (channel === 'trades') {
                            const t = msg.data[0];
                            sub.onUpdate({
                                timestamp: parseInt(t.ts),
                                close: parseFloat(t.px),
                                isTrade: true
                            } as any);
                        }
                    }
                });
            } catch (e) {
                // 忽略非 JSON 消息
            }
        });

        this.ws.on('error', (err) => {
            console.error('[OKXConnector] WS Error:', err.message);
        });

        this.ws.on('close', () => {
            this.isConnecting = false;
            console.warn('[OKXConnector] WS Closed. Reconnecting in 5s...');
            if (this.pingInterval) clearInterval(this.pingInterval);
            
            this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
        });
    }

    private sendSubscription(symbol: string, interval: string) {
        if (this.ws?.readyState !== WebSocket.OPEN) return;

        const okxInterval = this.translateInterval(interval);
        const channel = `candles${okxInterval}`;
        
        console.log(`[OKXConnector] Subscribing to ${symbol} (${channel})`);
        const subMsg = {
            op: 'subscribe',
            args: [
                { channel: channel, instId: symbol },
                { channel: 'trades', instId: symbol }
            ]
        };
        this.ws.send(JSON.stringify(subMsg));
    }

    public close(): void {
        this.subscribers.clear();
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws.close();
            this.ws = null;
        }
        if (this.pingInterval) clearInterval(this.pingInterval);
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    }
}
