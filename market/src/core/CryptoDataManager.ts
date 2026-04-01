import { BinanceConnector } from '../connectors/BinanceConnector';
import { OKXConnector } from '../connectors/OKXConnector';
import { IConnector } from '../connectors/ConnectorInterface';
import { SymbolManager } from './SymbolManager';
import { Candle } from '../types/Candle';
import { StorageManager } from './StorageManager';
import { AggregationUtils } from '../utils/AggregationUtils';

/**
 * 加密貨幣數據管家 (Crypto Data Manager)
 * 🚀 絕對隔離：僅處理加密貨幣數據 (SPOT/PERP)
 */
export class CryptoDataManager {
    private static instance: CryptoDataManager;
    private connectors: Map<string, IConnector> = new Map();
    private caches: Map<string, Candle[]> = new Map();
    private storage: StorageManager;
    private subscribers: Map<string, Array<(candle: Candle) => void>> = new Map();
    private activeSubscriptions: Set<string> = new Set();
    private serverTimeOffset: number = 0;

    private readonly nativeIntervals = [
        '1s', '1m', '3m', '5m', '15m', '30m',
        '1h', '2h', '4h', '6h', '8h', '12h',
        '1d', '3d', '1w', '1M'
    ];

    private constructor() {
        this.storage = StorageManager.getInstance();
        const binance = new BinanceConnector();
        const okx = new OKXConnector();
        this.connectors.set(binance.name, binance);
        this.connectors.set(okx.name, okx);
        this.syncClock();
    }

    private async syncClock() {
        try {
            const start = Date.now();
            const response = await fetch('https://api.binance.com/api/v3/time');
            const data = await response.json();
            const end = Date.now();
            this.serverTimeOffset = data.serverTime - (end - (end - start) / 2);
            console.log(`[CryptoDataManager] Time Offset: ${this.serverTimeOffset}ms`);
        } catch (e) {
            console.warn('[CryptoDataManager] Clock sync failed.');
        }
    }

    private getCorrectedNow(): number { return Date.now() + this.serverTimeOffset; }

    public static getInstance(): CryptoDataManager {
        if (!CryptoDataManager.instance) CryptoDataManager.instance = new CryptoDataManager();
        return CryptoDataManager.instance;
    }

    private getStrictTag(interval: string): string {
        const unit = interval.slice(-1);
        const val = interval.slice(0, -1);
        return (unit === 'M' || unit === 'm' || unit === 's') ? `${val}${unit}` : interval.toLowerCase();
    }

    private parseIntervalToMs(interval: string): number {
        const tag = this.getStrictTag(interval);
        const msMap: any = {
            '1s': 1000, '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000, '30m': 1800000,
            '1h': 3600000, '2h': 7200000, '4h': 14400000, '6h': 21600000, '8h': 28800000, '12h': 43200000,
            '1d': 86400000, '2d': 172800000, '3d': 259200000, '1w': 604800000, '1M': 2592000000
        };
        return msMap[tag] || 60000;
    }

    private alignTimestamp(timestamp: number, interval: string): number {
        const tag = this.getStrictTag(interval);
        const ms = this.parseIntervalToMs(tag);
        return Math.floor(timestamp / ms) * ms; // 加密貨幣通常使用簡單對齊
    }

    public async getKlines(id: string, interval: string, limit: number = 500, endTime?: number, source?: string): Promise<Candle[]> {
        const tag = this.getStrictTag(interval);
        const cacheKey = `${id}_${tag}`;
        let cached = this.caches.get(cacheKey) || [];
        
        if (cached.length === 0 && !endTime) {
            cached = await this.storage.loadKlines(id, tag);
            if (cached.length > 0) this.caches.set(cacheKey, cached);
        }

        const isNative = this.nativeIntervals.includes(tag);
        let finalResult: Candle[] = [];

        if (isNative) {
            finalResult = await this.fetchFromConnectors(id, tag, limit, endTime, source);
        } else {
            // 處理非原生週期聚合 (如 2m, 2h)
            const baseInterval = '1m';
            const batch = await this.getKlines(id, baseInterval, limit * 10, endTime, source);
            finalResult = AggregationUtils.aggregate(batch, this.parseIntervalToMs(tag));
        }

        if (!endTime && finalResult.length > 0) {
            this.updateCache(id, tag, finalResult);
            return this.caches.get(cacheKey)!.slice(-limit);
        }
        return finalResult.slice(-limit);
    }

    private async fetchFromConnectors(id: string, interval: string, limit: number, endTime?: number, source?: string): Promise<Candle[]> {
        const symbolInfo = SymbolManager.getSymbolById(id);
        if (!symbolInfo) return [];
        let sources = source ? [source] : ['Binance', 'OKX'];
        for (const s of sources) {
            const connector = this.connectors.get(s);
            if (connector) {
                try { return await connector.fetchKlines(symbolInfo.sourceMap[s], interval, limit, endTime); } catch (e) {}
            }
        }
        return [];
    }

    private updateCache(id: string, interval: string, newKlines: Candle[]) {
        const key = `${id}_${interval}`;
        let current = this.caches.get(key) || [];
        const mergedMap = new Map<number, Candle>();
        current.forEach(c => mergedMap.set(c.timestamp, c));
        newKlines.forEach(newC => mergedMap.set(newC.timestamp, newC));
        const sorted = Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        this.caches.set(key, sorted.slice(-5000));
    }

    public async subscribe(id: string, interval: string, onUpdate: (candle: Candle) => void, source?: string) {
        const tag = this.getStrictTag(interval);
        const symbolInfo = SymbolManager.getSymbolById(id);
        const effectiveSource = source || 'Binance';
        const subKey = `${id}_${tag}_${effectiveSource}`;

        if (!this.subscribers.has(subKey)) this.subscribers.set(subKey, []);
        this.subscribers.get(subKey)?.push(onUpdate);

        if (!this.activeSubscriptions.has(subKey)) {
            const connector = this.connectors.get(effectiveSource);
            if (connector && symbolInfo) {
                connector.subscribeKlines(symbolInfo.sourceMap[effectiveSource], tag, (c) => {
                    const subs = this.subscribers.get(subKey);
                    if (subs) subs.forEach(cb => cb(c));
                });
                this.activeSubscriptions.add(subKey);
            }
        }
    }

    public unsubscribe(id: string, interval: string, onUpdate: (candle: Candle) => void) {
        const tag = this.getStrictTag(interval);
        const subKey = `${id}_${tag}_Binance`; // 簡化處理
        const subs = this.subscribers.get(subKey);
        if (subs) {
            const idx = subs.indexOf(onUpdate);
            if (idx !== -1) subs.splice(idx, 1);
        }
    }
}
