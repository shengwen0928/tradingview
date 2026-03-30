import axios from 'axios';
import WebSocket from 'ws';
import { Candle } from '../types/Candle';
import { IConnector } from './ConnectorInterface';

/**
 * OKX 資料接入器
 * 使用 OKX API V5 規範
 */
export class OKXConnector implements IConnector {
    public readonly name = 'OKX';
    private readonly baseUrl = 'https://www.okx.com/api/v5';
    private readonly wsUrl = 'wss://ws.okx.com:8443/ws/v5/public';
    private ws: WebSocket | null = null;

    /**
     * 將系統 Interval 轉換為 OKX 格式
     */
    private translateInterval(interval: string): string {
        const map: any = {
            '1m': '1m',
            '5m': '5m',
            '15m': '15m',
            '1h': '1H',
            '4h': '4H',
            '1d': '1DUTC'
        };
        return map[interval] || interval;
    }

    public async fetchKlines(symbol: string, interval: string, limit: number = 500, endTime?: number): Promise<Candle[]> {
        try {
            const okxInterval = this.translateInterval(interval);
            const url = `${this.baseUrl}/market/history-candles`;
            const params: any = {
                instId: symbol,
                bar: okxInterval,
                limit
            };

            if (endTime) {
                params.after = endTime; // OKX 使用 after 表示獲取該時間之前的數據
            }

            const response = await axios.get(url, { params });
            
            // OKX 格式: [ [Time, Open, High, Low, Close, Volume, ...] ]
            // 注意: OKX 的順序是 [ts, o, h, l, c, vol, volCcy, confirm]
            // 且 OKX 的資料是倒序排列 (最新的在前面)，我們需要 reverse()
            return response.data.data.map((item: any[]) => ({
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

    public subscribeKlines(symbol: string, interval: string, onUpdate: (candle: Candle) => void): void {
        const okxInterval = this.translateInterval(interval);
        
        if (this.ws) this.ws.close();
        
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
            console.log(`[OKXConnector] Connected, subscribing to ${symbol}`);
            const subMsg = {
                op: 'subscribe',
                args: [{
                    channel: `candles${okxInterval}`,
                    instId: symbol
                }]
            };
            this.ws?.send(JSON.stringify(subMsg));
        });

        this.ws.on('message', (data: string) => {
            const msg = JSON.parse(data);
            if (msg.data && msg.data[0]) {
                const k = msg.data[0];
                const candle: Candle = {
                    timestamp: parseInt(k[0]),
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                };
                onUpdate(candle);
            }
        });
    }

    public close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
