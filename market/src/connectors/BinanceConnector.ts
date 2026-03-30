import axios from 'axios';
import WebSocket from 'ws';
import { Candle } from '../types/Candle';
import { IConnector } from './ConnectorInterface';

/**
 * Binance 資料接入器
 * 負責 REST API 歷史數據抓取與 WebSocket 即時數據訂閱
 */
export class BinanceConnector implements IConnector {
    public readonly name = 'Binance';
    private readonly baseUrl = 'https://api.binance.com/api/v3';
    private readonly wsUrl = 'wss://stream.binance.com:9443/ws';
    private ws: WebSocket | null = null;

    /**
     * 抓取歷史 K 線資料 (REST API)
     * @param symbol 標的 (例如: BTCUSDT)
     * @param interval 時間週期 (例如: 1m, 1h, 1d)
     * @param limit 資料筆數 (最大 1000)
     * @param endTime 結束時間戳 (毫秒)
     */
    public async fetchKlines(symbol: string, interval: string, limit: number = 500, endTime?: number): Promise<Candle[]> {
        try {
            const url = `${this.baseUrl}/klines`;
            const params: any = {
                symbol: symbol.toUpperCase(),
                interval,
                limit
            };

            if (endTime) {
                params.endTime = endTime;
            }

            const response = await axios.get(url, { params });

            // Binance 格式: [ [OpenTime, Open, High, Low, Close, Volume, CloseTime, ...] ]
            return response.data.map((item: any[]) => ({
                timestamp: item[0],
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            }));
        } catch (error) {
            console.error(`[BinanceConnector] Fetch error for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * 訂閱即時 K 線更新 (WebSocket)
     * @param symbol 標的
     * @param interval 時間週期
     * @param onUpdate 收到更新時的回調函式
     */
    public subscribeKlines(symbol: string, interval: string, onUpdate: (candle: Candle) => void): void {
        const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
        const url = `${this.wsUrl}/${streamName}`;

        if (this.ws) {
            this.ws.close();
        }

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log(`[BinanceConnector] WebSocket connected to ${streamName}`);
        });

        this.ws.on('message', (data: string) => {
            const msg = JSON.parse(data);
            if (msg.e === 'kline') {
                const k = msg.k;
                const candle: Candle = {
                    timestamp: k.t,
                    open: parseFloat(k.o),
                    high: parseFloat(k.h),
                    low: parseFloat(k.l),
                    close: parseFloat(k.c),
                    volume: parseFloat(k.v)
                };
                onUpdate(candle);
            }
        });

        this.ws.on('error', (err) => {
            console.error(`[BinanceConnector] WebSocket error for ${symbol}:`, err);
        });

        this.ws.on('close', () => {
            console.log(`[BinanceConnector] WebSocket closed for ${symbol}`);
        });
    }

    /**
     * 關閉連線
     */
    public close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
