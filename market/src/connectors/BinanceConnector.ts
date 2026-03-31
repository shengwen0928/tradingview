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

    private ws: WebSocket | null = null;

    /**
     * 將週期字串轉換為 Binance 格式
     * Binance 規範: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
     */
    private formatInterval(interval: string): string {
        const unit = interval.slice(-1);
        if (unit === 'M') return interval; // 月線必須是大寫 M
        return interval.toLowerCase(); // 分鐘、小時、天、週為小寫
    }

    /**
     * 檢查 Binance 是否原生支援此週期
     */
    private isNativeSupported(interval: string): boolean {
        const supported = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
        return supported.includes(this.formatInterval(interval));
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

            return response.data.map((item: any[]) => ({
                timestamp: item[0],
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            }));
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
        
        // 雙流模式：kline + aggTrade
        const streams = `${s}@kline_${binanceInterval}/${s}@aggTrade`;
        const url = `${baseWs}/stream?streams=${streams}`;

        if (this.ws) {
            this.ws.close();
        }

        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
            console.log(`[BinanceConnector] ${useFutures ? 'Futures' : 'Spot'} WS connected to ${streams}`);
        });

        this.ws.on('message', (data: string) => {
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
                    isTrade: true
                } as any);
            }
        });

        this.ws.on('error', (err) => console.error(`[BinanceConnector] WS error:`, err));
        this.ws.on('close', () => console.log(`[BinanceConnector] WS closed for ${symbol}`));
    }

    public close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
