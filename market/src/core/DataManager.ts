import { BinanceConnector } from '../connectors/BinanceConnector';
import { OKXConnector } from '../connectors/OKXConnector';
import { YahooConnector } from '../connectors/YahooConnector';
import { IConnector } from '../connectors/ConnectorInterface';
import { SymbolManager } from './SymbolManager';
import { Candle, MarketType } from '../types/Candle';
import { StorageManager } from './StorageManager';
import { AggregationUtils } from '../utils/AggregationUtils';

/**
 * 數據總管 (Data Manager)
 */
export class DataManager {
    private static instance: DataManager;
    private connectors: Map<string, IConnector> = new Map();
    private caches: Map<string, Candle[]> = new Map();
    private storage: StorageManager;
    private subscribers: Map<string, Array<(candle: Candle) => void>> = new Map();
    private activeSubscriptions: Set<string> = new Set();

    // 嚴格定義的原生週期 (交易所官方支援)
    private readonly nativeIntervals = [
        '1s', '1m', '3m', '5m', '15m', '30m',
        '1h', '2h', '4h', '6h', '8h', '12h',
        '1d', '3d', '1w', '1M'
    ];

    private constructor() {
        this.storage = StorageManager.getInstance();
        const binance = new BinanceConnector();
        const okx = new OKXConnector();
        const yahoo = new YahooConnector();
        this.connectors.set(binance.name, binance);
        this.connectors.set(okx.name, okx);
        this.connectors.set(yahoo.name, yahoo);
    }

    public static getInstance(): DataManager {
        if (!DataManager.instance) {
            DataManager.instance = new DataManager();
        }
        return DataManager.instance;
    }

    private getStrictTag(interval: string): string {
        const unit = interval.slice(-1);
        const val = interval.slice(0, -1);
        if (unit === 'M') return `${val}M`; 
        if (unit === 'm') return `${val}m`; 
        if (unit === 's') return `${val}s`; 
        return interval.toLowerCase();      
    }

    private parseIntervalToMs(interval: string): number {
        const tag = this.getStrictTag(interval);
        const msMap: any = {
            '1s': 1000, '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000, '30m': 1800000,
            '1h': 3600000, '2h': 7200000, '4h': 14400000, '6h': 21600000, '8h': 28800000, '12h': 43200000,
            '1d': 86400000, '2d': 172800000, '3d': 259200000, '5d': 432000000,
            '1w': 604800000, '1M': 2592000000, '3M': 7776000000, '1y': 31536000000
        };
        return msMap[tag] || 60000;
    }

    private alignTimestamp(timestamp: number, interval: string): number {
        const tag = this.getStrictTag(interval);
        const ms = this.parseIntervalToMs(tag);
        const d = new Date(timestamp);

        if (tag.endsWith('M')) {
            d.setUTCDate(1);
            d.setUTCHours(0, 0, 0, 0);
            const val = parseInt(tag.slice(0, -1)) || 1;
            const month = d.getUTCMonth();
            d.setUTCMonth(month - (month % val));
            return d.getTime();
        } else if (tag.endsWith('w')) {
            const day = d.getUTCDay();
            const diff = (day === 0 ? 6 : day - 1);
            d.setUTCDate(d.getUTCDate() - diff);
            d.setUTCHours(0, 0, 0, 0);
            return d.getTime();
        } else if (tag.endsWith('d')) {
            d.setUTCHours(0, 0, 0, 0);
            const val = parseInt(tag.slice(0, -1)) || 1;
            if (val > 1) {
                const daysSinceEpoch = Math.floor(d.getTime() / 86400000);
                const alignedDays = Math.floor(daysSinceEpoch / val) * val;
                return alignedDays * 86400000;
            }
            return d.getTime();
        } else if (ms >= 86400000) {
            d.setUTCHours(0, 0, 0, 0);
            return d.getTime();
        } else {
            return Math.floor(timestamp / ms) * ms;
        }
    }

    private getBestBaseInterval(targetMs: number): string {
        const sortedNatives = [
            { s: '1d', ms: 86400000 },
            { s: '4h', ms: 14400000 },
            { s: '1h', ms: 3600000 },
            { s: '1m', ms: 60000 }
        ];
        for (const native of sortedNatives) {
            if (targetMs > native.ms && targetMs % native.ms === 0) return native.s;
        }
        return '1m';
    }

    public async getKlines(id: string, interval: string, limit: number = 500, endTime?: number, source?: string): Promise<Candle[]> {
        const tag = this.getStrictTag(interval);
        const cacheKey = `${id}_${tag}`;
        const intervalMs = this.parseIntervalToMs(tag);

        let cached = this.caches.get(cacheKey) || [];
        if (cached.length === 0 && !endTime) {
            cached = await this.storage.loadKlines(id, tag);
            if (cached.length > 0) this.caches.set(cacheKey, cached);
        }

        let forceFetch = false;
        if (!endTime && cached.length > 0) {
            if (Date.now() - cached[cached.length - 1].timestamp > intervalMs * 1.1) forceFetch = true;
        }
        const needsMore = !endTime && cached.length < limit;

        if (!endTime && !forceFetch && !needsMore && cached.length >= limit) {
            return cached.slice(-limit);
        }

        const isNative = this.nativeIntervals.includes(tag);
        let finalResult: Candle[] = [];

        if (isNative) {
            finalResult = await this.fetchFromConnectors(id, tag, limit, endTime, source);
        } else {
            const baseInterval = this.getBestBaseInterval(intervalMs);
            const baseMs = this.parseIntervalToMs(baseInterval);
            const ratio = Math.ceil(intervalMs / baseMs);
            let neededBaseCount = limit * ratio;
            let allBaseData: Candle[] = [];
            let curEndTime = endTime;

            for (let i = 0; i < 5 && allBaseData.length < neededBaseCount; i++) {
                const batch = await this.getKlines(id, baseInterval, Math.min(1000, neededBaseCount - allBaseData.length), curEndTime, source);
                if (batch.length === 0) break;
                allBaseData = [...batch, ...allBaseData];
                curEndTime = batch[0].timestamp - 1;
            }
            finalResult = AggregationUtils.aggregate(allBaseData, intervalMs);
        }

        if (!endTime && finalResult.length > 0) {
            this.updateCache(id, tag, finalResult);
            this.storage.saveKlines(id, tag, this.caches.get(cacheKey)!);
            return this.caches.get(cacheKey)!.slice(-limit);
        }
        return finalResult.slice(-limit);
    }

    private async fetchFromConnectors(id: string, interval: string, limit: number, endTime?: number, source?: string): Promise<Candle[]> {
        const symbolInfo = SymbolManager.getSymbolById(id);
        if (!symbolInfo) return [];
        let sources = source ? [source] : Object.keys(symbolInfo.sourceMap);
        for (const s of sources) {
            const connector = this.connectors.get(s);
            if (connector) {
                try {
                    return await connector.fetchKlines(symbolInfo.sourceMap[s], interval, limit, endTime);
                } catch (e) {}
            }
        }
        return [];
    }

    private updateCache(id: string, interval: string, newKlines: Candle[]) {
        const key = `${id}_${interval}`;
        let current = this.caches.get(key) || [];
        const mergedMap = new Map<number, Candle>();
        current.forEach(c => mergedMap.set(c.timestamp, c));
        newKlines.forEach(newC => {
            const oldC = mergedMap.get(newC.timestamp);
            if (oldC) {
                mergedMap.set(newC.timestamp, {
                    ...newC,
                    open: oldC.open, // 🚨 關鍵：保護現有開盤價，不被歷史更新覆蓋
                    high: Math.max(oldC.high, newC.high),
                    low: Math.min(oldC.low, newC.low),
                    volume: Math.max(oldC.volume, newC.volume)
                });
            } else mergedMap.set(newC.timestamp, newC);
        });
        const sorted = Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        this.caches.set(key, sorted.slice(-5000));
    }

    public async subscribe(id: string, interval: string, onUpdate: (candle: Candle) => void, source?: string) {
        const tag = this.getStrictTag(interval);
        const symbolInfo = SymbolManager.getSymbolById(id);
        const effectiveSource = source || (symbolInfo?.market === MarketType.STOCK ? 'Yahoo' : 'Binance');
        const cacheKey = `${id}_${tag}`;
        const intervalMs = this.parseIntervalToMs(tag);
        
        if (!this.subscribers.has(cacheKey)) this.subscribers.set(cacheKey, []);
        this.subscribers.get(cacheKey)?.push(onUpdate);

        if (!this.caches.has(cacheKey)) {
            const stored = await this.storage.loadKlines(id, tag);
            if (stored.length > 0) this.caches.set(cacheKey, stored);
        }

        const isNative = this.nativeIntervals.includes(tag);
        const subInterval = isNative ? tag : (intervalMs < 86400000 ? '1m' : '1d');
        const subKey = `${id}_${subInterval}_${effectiveSource}`;

        if (!this.activeSubscriptions.has(subKey)) {
            if (symbolInfo) {
                // 確保基礎週期快取已載入
                if (!this.caches.has(`${id}_${subInterval}`)) {
                    const storedBase = await this.storage.loadKlines(id, subInterval);
                    if (storedBase.length > 0) this.caches.set(`${id}_${subInterval}`, storedBase);
                }

                const connector = this.connectors.get(effectiveSource);
                if (connector) {
                    connector.subscribeKlines(symbolInfo.sourceMap[effectiveSource], subInterval, (c) => this.onNewUpdate(id, subInterval, c, effectiveSource));
                    this.activeSubscriptions.add(subKey);
                }
            }
        }
    }

    public unsubscribe(id: string, interval: string, onUpdate: (candle: Candle) => void) {
        const tag = this.getStrictTag(interval);
        const cacheKey = `${id}_${tag}`;
        const subs = this.subscribers.get(cacheKey);
        if (subs) {
            const index = subs.indexOf(onUpdate);
            if (index !== -1) {
                subs.splice(index, 1);
                console.log(`[DataManager] Unsubscribed from ${cacheKey}. Remaining: ${subs.length}`);
            }
            
            // 🚨 如果該週期的所有訂閱者都沒了，可以考慮清理 activeSubscriptions
            // 但為了效能，通常保留 Connector 訂閱沒關係，除非切換標的
        }
    }

    private onNewUpdate(id: string, interval: string, data: any, source: string) {
        const tag = this.getStrictTag(interval);
        const cacheKey = `${id}_${tag}`;
        const alignedTs = this.alignTimestamp(data.timestamp || data.time, tag);

        let currentCache = this.caches.get(cacheKey) || [];
        let candleToPush: Candle | null = null;

        if (data.isTrade) {
            if (currentCache.length === 0) {
                const initCandle = { timestamp: alignedTs, open: data.close, high: data.close, low: data.close, close: data.close, volume: data.volume || 0 };
                currentCache.push(initCandle);
                candleToPush = initCandle;
            } else {
                const last = currentCache[currentCache.length - 1];
                if (alignedTs === last.timestamp) {
                    last.close = data.close;
                    last.high = Math.max(last.high, data.close);
                    last.low = Math.min(last.low, data.close);
                    last.volume += (data.volume || 0);
                    candleToPush = last;
                } else if (alignedTs > last.timestamp) {
                    const newC = { timestamp: alignedTs, open: data.close, high: data.close, low: data.close, close: data.close, volume: data.volume || 0 };
                    currentCache.push(newC);
                    candleToPush = newC;
                }
            }
        } else {
            const candle = data as Candle;
            const incomingTs = this.alignTimestamp(candle.timestamp, tag);
            
            if (currentCache.length > 0) {
                const last = currentCache[currentCache.length - 1];
                if (incomingTs === last.timestamp) {
                    // 🚨 關鍵：合併時保護開盤價，並更新高低點
                    last.high = Math.max(last.high, candle.high, candle.close);
                    last.low = Math.min(last.low, candle.low, candle.close);
                    last.close = candle.close;
                    last.volume = Math.max(last.volume, candle.volume);
                    // 如果原有的開盤價是 0 或無效，才使用新的
                    if (!last.open || last.open === 0) last.open = candle.open;
                } else if (incomingTs > last.timestamp) {
                    currentCache.push({ ...candle, timestamp: incomingTs });
                }
            } else {
                currentCache.push({ ...candle, timestamp: incomingTs });
            }
            candleToPush = currentCache[currentCache.length - 1];
        }

        if (candleToPush) {
            this.caches.set(cacheKey, currentCache);
            const subs = this.subscribers.get(cacheKey);
            if (subs) subs.forEach(cb => cb(candleToPush!));

            if (tag === '1d' || tag === '1m') {
                this.subscribers.forEach((syntheticSubs, sKey) => {
                    if (sKey.startsWith(`${id}_`) && sKey !== cacheKey) {
                        const sTag = sKey.replace(`${id}_`, '');
                        if (!this.nativeIntervals.includes(sTag)) {
                            const sMs = this.parseIntervalToMs(sTag);
                            let sCache = this.caches.get(sKey) || [];
                            const lastS = sCache.length > 0 ? sCache[sCache.length - 1] : null;
                            const updated = AggregationUtils.updateAggregated(lastS, candleToPush!, sMs);
                            
                            if (!lastS || lastS.timestamp !== updated.timestamp) {
                                sCache.push(updated);
                                this.caches.set(sKey, sCache);
                            } else {
                                sCache[sCache.length - 1] = updated;
                            }
                            syntheticSubs.forEach(cb => cb(updated));
                        }
                    }
                });
            }
        }
    }

    public getSymbols() { return SymbolManager.getAllSymbols(); }
}
