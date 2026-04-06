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
    private subscribers: Map<string, { symbol: string, interval: string, onUpdate: (candle: Candle) => void }> = new Map();
    private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map();

    /**
     * 週期轉換與支援檢查 (保持不變)
     */
    private formatInterval(interval: string): string {
        const binanceMap: any = {
            '1s': '1s', '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
            '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
            '1d': '1d', '3d': '3d', '1w': '1w', '1M': '1M'
        };
        return binanceMap[interval] || binanceMap[interval.toLowerCase()] || '1m';
    }

    private isNativeSupported(interval: string): boolean {
        const norm = interval.slice(-1) === 'M' ? interval : interval.toLowerCase();
        const supported = ['1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
        return supported.includes(norm);
    }

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
        const subKey = `${symbol}_${interval}`;
        this.subscribers.set(subKey, { symbol, interval, onUpdate });
        this.connectWebSocket(subKey);
    }

    private connectWebSocket(subKey: string): void {
        const subInfo = this.subscribers.get(subKey);
        if (!subInfo) return;

        const { symbol, interval, onUpdate } = subInfo;
        const binanceInterval = this.formatInterval(interval);
        const s = symbol.toLowerCase();
        const useFutures = this.isFutures(symbol);
        const baseWs = useFutures ? this.futuresWs : this.spotWs;
        
        // 雙流模式：kline + aggTrade
        const streams = `${s}@kline_${binanceInterval}/${s}@aggTrade`;
        const url = `${baseWs}/stream?streams=${streams}`;

        // 清理舊的
        this.cleanupWebSocket(subKey);

        console.log(`[BinanceConnector] Connecting to ${useFutures ? 'Futures' : 'Spot'} WS: ${streams}`);
        const ws = new WebSocket(url);
        this.activeWebSockets.set(subKey, ws);

        let pingInterval: NodeJS.Timeout;

        ws.on('open', () => {
            console.log(`[BinanceConnector] WS Connected: ${subKey}`);
            if (this.reconnectTimeouts.has(subKey)) {
                clearTimeout(this.reconnectTimeouts.get(subKey)!);
                this.reconnectTimeouts.delete(subKey);
            }

            // 心跳機制
            pingInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.ping();
                }
            }, 30000);
        });

        ws.on('message', (data) => {
            try {
                const payload = JSON.parse(data.toString());
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
            } catch (e) {
                console.error(`[BinanceConnector] Parse error:`, e);
            }
        });

        ws.on('error', (err) => {
            console.error(`[BinanceConnector] WS Error (${subKey}):`, err.message);
        });

        ws.on('close', () => {
            console.warn(`[BinanceConnector] WS Closed (${subKey}). Reconnecting in 5s...`);
            clearInterval(pingInterval);
            
            if (this.activeWebSockets.get(subKey) === ws) {
                this.activeWebSockets.delete(subKey);
            }

            // 自動重連
            if (!this.reconnectTimeouts.has(subKey)) {
                const timeout = setTimeout(() => {
                    this.reconnectTimeouts.delete(subKey);
                    this.connectWebSocket(subKey);
                }, 5000);
                this.reconnectTimeouts.set(subKey, timeout);
            }
        });
    }

    private cleanupWebSocket(subKey: string): void {
        const oldWs = this.activeWebSockets.get(subKey);
        if (oldWs) {
            oldWs.removeAllListeners();
            if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
                oldWs.close();
            }
            this.activeWebSockets.delete(subKey);
        }
        
        const timeout = this.reconnectTimeouts.get(subKey);
        if (timeout) {
            clearTimeout(timeout);
            this.reconnectTimeouts.delete(subKey);
        }
    }

    public close(): void {
        this.subscribers.clear();
        this.activeWebSockets.forEach((ws, key) => this.cleanupWebSocket(key));
    }
}
