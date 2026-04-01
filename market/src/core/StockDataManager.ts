import { YahooConnector } from '../connectors/YahooConnector';
import { AlpacaConnector } from '../connectors/AlpacaConnector';
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
        newKlines.forEach(newC => { if (newC.close !== null) mergedMap.set(newC.timestamp, newC); });
        const sorted = Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        this.caches.set(key, sorted.slice(-2000));
    }

    public async subscribe(id: string, interval: string, onUpdate: (candle: Candle) => void) {
        const tag = this.getStrictTag(interval);
        const symbolInfo = SymbolManager.getSymbolById(id);
        if (!symbolInfo) return;

        const subKey = `${id}_${tag}`;
        const cacheKey = subKey;

        if (!this.subscribers.has(cacheKey)) this.subscribers.set(cacheKey, []);
        this.subscribers.get(cacheKey)?.push(onUpdate);

        if (!this.activeSubscriptions.has(subKey)) {
            // 🚀 統一使用 Yahoo (完全免費且免 Key)
            const connector = this.connectors.get('Yahoo');
            const sourceSymbol = symbolInfo.sourceMap['Yahoo'];

            if (connector && sourceSymbol) {
                console.log(`[StockDataManager] Subscribing ${id} via Yahoo Polling...`);
                connector.subscribeKlines(sourceSymbol, tag, (c) => {
                    this.onNewUpdate(id, tag, c, cacheKey);
                });
                this.activeSubscriptions.add(subKey);
            }
        }
    }

    private onNewUpdate(id: string, tag: string, data: any, cacheKey: string) {
        // 🚨 修正：針對 Yahoo 數據進行嚴格的分鐘邊界對齊
        const intervalMs = this.parseIntervalToMs(tag);
        const alignedTs = Math.floor(data.timestamp / intervalMs) * intervalMs;
        
        let currentCache = this.caches.get(cacheKey) || [];
        let candleToPush: Candle | null = null;

        if (currentCache.length > 0) {
            const last = currentCache[currentCache.length - 1];
            if (alignedTs === last.timestamp) {
                // 🔄 更新當前 K 棒
                last.high = Math.max(last.high, data.high);
                last.low = Math.min(last.low, data.low);
                last.close = data.close;
                last.volume = Math.max(last.volume, data.volume || 0);
                candleToPush = last;
            } else if (alignedTs > last.timestamp) {
                // 🆕 產生新 K 棒
                const newC = { ...data, timestamp: alignedTs };
                currentCache.push(newC);
                candleToPush = newC;
            }
        } else {
            const newC = { ...data, timestamp: alignedTs };
            currentCache.push(newC);
            candleToPush = newC;
        }

        if (candleToPush) {
            if (currentCache.length > 2000) currentCache.shift();
            this.caches.set(cacheKey, currentCache);
            const subs = this.subscribers.get(cacheKey);
            if (subs) subs.forEach(cb => cb(candleToPush!));
        }
    }

    public unsubscribe(id: string, interval: string, onUpdate: (candle: Candle) => void) {
        const tag = this.getStrictTag(interval);
        const cacheKey = `${id}_${tag}`;
        const subs = this.subscribers.get(cacheKey);
        if (subs) {
            const idx = subs.indexOf(onUpdate);
            if (idx !== -1) subs.splice(idx, 1);
        }
    }
}

