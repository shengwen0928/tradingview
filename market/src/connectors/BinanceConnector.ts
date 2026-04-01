import axios from 'axios';
import WebSocket from 'ws';
import { Candle, MarketType } from '../types/Candle';
import { IConnector } from './ConnectorInterface';
import { SymbolManager } from '../core/SymbolManager';

/**
 * Binance 資料接入器
 * 支援 Spot (現貨) 與 USDT-M Futures (永續合約)
 */
export class BinanceConnector implements IConnector {
    public readonly name = 'Binance';
    
    // Spot URLs
    private readonly spotApi = 'https://api.binance.com/api/v3';
    private readonly spotWs = 'wss://stream.binance.com:9443';
    
    // Futures (USDT-M) URLs
    private readonly futuresApi = 'https://fapi.binance.com/fapi/v1';
    private readonly futuresWs = 'wss://fstream.binance.com';

    private activeWebSockets: Map<string, WebSocket> = new Map();

    /**
     * 將週期字串轉換為 Binance 官方格式 (硬性映射)
     */
    private formatInterval(interval: string): string {
        const binanceMap: any = {
            '1s': '1s', '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
            '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
            '1d': '1d', '3d': '3d', '1w': '1w', '1M': '1M'
        };
        return binanceMap[interval] || binanceMap[interval.toLowerCase()] || '1m';
    }

    /**
     * 檢查 Binance 是否原生支援此週期
     */
    private isNativeSupported(interval: string): boolean {
        const norm = interval.slice(-1) === 'M' ? interval : interval.toLowerCase();
        const supported = ['1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
        return supported.includes(norm);
    }

    /**
     * 判定是否為合約交易對
     */
    private isFutures(symbol: string): boolean {
        const allSymbols = SymbolManager.getAllSymbols();
        const found = allSymbols.find(s => s.sourceMap['Binance'] === symbol);
        return found?.market === MarketType.PERP;
    }

    /**
     * 抓取歷史 K 線資料 (REST API)
     */
    public async fetchKlines(symbol: string, interval: string, limit: number = 500, endTime?: number): Promise<Candle[]> {
        if (!this.isNativeSupported(interval)) {
            throw new Error(`Binance does not support native interval: ${interval}`);
        }
        
        const binanceInterval = this.formatInterval(interval);
        const useFutures = this.isFutures(symbol);
        const baseUrl = useFutures ? this.futuresApi : this.spotApi;

        try {
            const url = `${baseUrl}/klines`;
            const params: any = {
                symbol: symbol.toUpperCase(),
                interval: binanceInterval,
                limit
            };

            if (endTime) {
                params.endTime = endTime;
            }

            const response = await axios.get(url, { params });

            return response.data.map((item: any[]) => {
                let timestamp = item[0];
                if (binanceInterval === '1M') {
                    const d = new Date(timestamp);
                    d.setUTCDate(1);
                    d.setUTCHours(0, 0, 0, 0);
                    timestamp = d.getTime();
                }
                return {
                    timestamp,
                    open: parseFloat(item[1]),
                    high: parseFloat(item[2]),
                    low: parseFloat(item[3]),
                    close: parseFloat(item[4]),
                    volume: parseFloat(item[5])
                };
            });
        } catch (error) {
            console.error(`[BinanceConnector] Fetch error for ${symbol} (${useFutures ? 'Futures' : 'Spot'}):`, error);
            throw error;
        }
    }

    /**
     * 訂閱即時 K 線更新 (WebSocket)
     */
    public subscribeKlines(symbol: string, interval: string, onUpdate: (candle: Candle) => void): void {
        const binanceInterval = this.formatInterval(interval);
        const s = symbol.toLowerCase();
        const useFutures = this.isFutures(symbol);
        const baseWs = useFutures ? this.futuresWs : this.spotWs;
        const subKey = `${symbol}_${interval}`;
        
        // 雙流模式：kline + aggTrade
        const streams = `${s}@kline_${binanceInterval}/${s}@aggTrade`;
        const url = `${baseWs}/stream?streams=${streams}`;

        // 🚨 修正：如果已經有相同訂閱，先清理舊的
        if (this.activeWebSockets.has(subKey)) {
            const oldWs = this.activeWebSockets.get(subKey);
            oldWs?.close();
            this.activeWebSockets.delete(subKey);
        }

        const ws = new WebSocket(url);
        this.activeWebSockets.set(subKey, ws);

        ws.on('open', () => {
            console.log(`[BinanceConnector] ${useFutures ? 'Futures' : 'Spot'} WS connected to ${streams}`);
        });

        ws.on('message', (data: string) => {
            const payload = JSON.parse(data);
            const stream = payload.stream;
            const msg = payload.data;

            if (stream.includes('@kline')) {
                const k = msg.k;
                onUpdate({
                    timestamp: k.t,
                    open: parseFloat(k.o),
                    high: parseFloat(k.h),
                    low: parseFloat(k.l),
                    close: parseFloat(k.c),
                    volume: parseFloat(k.v)
                });
            } else if (stream.includes('@aggTrade')) {
                onUpdate({
                    timestamp: msg.T, 
                    close: parseFloat(msg.p),
                    volume: parseFloat(msg.q),
                    isTrade: true
                } as any);
            }
        });

        ws.on('error', (err) => console.error(`[BinanceConnector] WS error for ${subKey}:`, err));
        ws.on('close', () => {
            console.log(`[BinanceConnector] WS closed for ${subKey}`);
            if (this.activeWebSockets.get(subKey) === ws) {
                this.activeWebSockets.delete(subKey);
            }
        });
    }

    public close(): void {
        this.activeWebSockets.forEach(ws => ws.close());
        this.activeWebSockets.clear();
    }
}
