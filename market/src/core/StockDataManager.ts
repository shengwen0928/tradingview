import { YahooConnector } from '../connectors/YahooConnector';
import { IConnector } from '../connectors/ConnectorInterface';
import { SymbolManager } from './SymbolManager';
import { Candle } from '../types/Candle';
import { StorageManager } from './StorageManager';
import { AggregationUtils } from '../utils/AggregationUtils';

/**
 * 股票數據管家 (Stock Data Manager)
 * 🚀 絕對隔離：僅處理股票數據 (STOCK)
 */
export class StockDataManager {
    private static instance: StockDataManager;
    private connectors: Map<string, IConnector> = new Map();
    private caches: Map<string, Candle[]> = new Map();
    private storage: StorageManager;
    private subscribers: Map<string, Array<(candle: Candle) => void>> = new Map();
    private activeSubscriptions: Set<string> = new Set();

    private readonly nativeIntervals = ['1m', '5m', '15m', '30m', '1h', '1d', '1w', '1M'];

    private constructor() {
        this.storage = StorageManager.getInstance();
        const yahoo = new YahooConnector();
        this.connectors.set(yahoo.name, yahoo);
    }

    public static getInstance(): StockDataManager {
        if (!StockDataManager.instance) StockDataManager.instance = new StockDataManager();
        return StockDataManager.instance;
    }

    private getStrictTag(interval: string): string {
        const unit = interval.slice(-1);
        const val = interval.slice(0, -1);
        return (unit === 'M' || unit === 'm' || unit === 's') ? `${val}${unit}` : interval.toLowerCase();
    }

    public async getKlines(id: string, interval: string, limit: number = 500, endTime?: number): Promise<Candle[]> {
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
            finalResult = await this.fetchFromYahoo(id, tag, limit, endTime);
        } else {
            // 股票聚合通常基於 1d 或 1h
            const baseInterval = '1d';
            const batch = await this.getKlines(id, baseInterval, limit * 2);
            finalResult = AggregationUtils.aggregate(batch, this.parseIntervalToMs(tag));
        }

        if (!endTime && finalResult.length > 0) {
            this.updateCache(id, tag, finalResult);
            return this.caches.get(cacheKey)!.slice(-limit);
        }
        return finalResult.slice(-limit);
    }

    private parseIntervalToMs(interval: string): number {
        const tag = this.getStrictTag(interval);
        const msMap: any = { '1m': 60000, '5m': 300000, '15m': 900000, '1d': 86400000, '1w': 604800000, '1M': 2592000000 };
        return msMap[tag] || 86400000;
    }

    private async fetchFromYahoo(id: string, interval: string, limit: number, endTime?: number): Promise<Candle[]> {
        const symbolInfo = SymbolManager.getSymbolById(id);
        if (!symbolInfo || !symbolInfo.sourceMap['Yahoo']) return [];
        
        const connector = this.connectors.get('Yahoo');
        if (connector) {
            try { return await connector.fetchKlines(symbolInfo.sourceMap['Yahoo'], interval, limit, endTime); } catch (e) {}
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
        this.caches.set(key, sorted.slice(-2000));
    }

    public async subscribe(id: string, interval: string, onUpdate: (candle: Candle) => void) {
        const tag = this.getStrictTag(interval);
        const symbolInfo = SymbolManager.getSymbolById(id);
        const subKey = `${id}_${tag}`;

        if (!this.subscribers.has(subKey)) this.subscribers.set(subKey, []);
        this.subscribers.get(subKey)?.push(onUpdate);

        if (!this.activeSubscriptions.has(subKey)) {
            const connector = this.connectors.get('Yahoo');
            if (connector && symbolInfo && symbolInfo.sourceMap['Yahoo']) {
                connector.subscribeKlines(symbolInfo.sourceMap['Yahoo'], tag, (c) => {
                    const subs = this.subscribers.get(subKey);
                    if (subs) subs.forEach(cb => cb(c));
                });
                this.activeSubscriptions.add(subKey);
            }
        }
    }

    public unsubscribe(id: string, interval: string, onUpdate: (candle: Candle) => void) {
        const tag = this.getStrictTag(interval);
        const subKey = `${id}_${tag}`;
        const subs = this.subscribers.get(subKey);
        if (subs) {
            const idx = subs.indexOf(onUpdate);
            if (idx !== -1) subs.splice(idx, 1);
        }
    }
}
