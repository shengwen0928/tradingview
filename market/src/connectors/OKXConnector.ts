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

    /**
     * 將週期轉換為 OKX 格式 (硬性映射)
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
            // 注意：OKX 合約與現貨共用此 Endpoint
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
     * 訂閱即時 K 線更新 (WebSocket)
     * 同時訂閱 candles 與 trades 頻道實現高頻跳動
     */
    public subscribeKlines(symbol: string, interval: string, onUpdate: (candle: Candle) => void): void {
        const okxInterval = this.translateInterval(interval);
        
        if (this.ws) this.ws.close();
        
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
            // 注意：OKX 的頻道名如果包含大寫 Mon，必須維持大寫
            const channel = `candles${okxInterval}`;
            console.log(`[OKXConnector] Subscribing to ${symbol} (Channel: ${channel} & Trades)`);
            const subMsg = {
                op: 'subscribe',
                args: [
                    { channel: channel, instId: symbol },
                    { channel: 'trades', instId: symbol }
                ]
            };
            this.ws?.send(JSON.stringify(subMsg));
        });

        this.ws.on('message', (data: string) => {
            const msg = JSON.parse(data);
            if (!msg.data || !msg.data[0]) return;

            if (msg.arg.channel.startsWith('candles')) {
                const k = msg.data[0];
                onUpdate({
                    timestamp: parseInt(k[0]),
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                });
            } else if (msg.arg.channel === 'trades') {
                const t = msg.data[0];
                onUpdate({
                    timestamp: parseInt(t.ts),
                    close: parseFloat(t.px),
                    isTrade: true
                } as any);
            }
        });

        this.ws.on('error', (err) => console.error(`[OKXConnector] WS error:`, err));
        this.ws.on('close', () => console.log(`[OKXConnector] WS closed for ${symbol}`));
    }

    public close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
