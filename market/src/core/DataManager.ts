import { BinanceConnector } from '../connectors/BinanceConnector';
import { OKXConnector } from '../connectors/OKXConnector';
import { YahooConnector } from '../connectors/YahooConnector';
import { IConnector } from '../connectors/ConnectorInterface';
import { SymbolManager } from './SymbolManager';
import { Candle } from '../types/Candle';
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
        '1d', '3d', '1w'
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

    /**
     * 嚴格的週期標籤格式化 (絕不混淆 m 與 M)
     */
    private getStrictTag(interval: string): string {
        const unit = interval.slice(-1);
        const val = interval.slice(0, -1);
        if (unit === 'M') return `${val}M`; // 月線
        if (unit === 'm') return `${val}m`; // 分鐘
        if (unit === 's') return `${val}s`; // 秒
        return interval.toLowerCase();      // h, d, w 統一小寫
    }

    private parseIntervalToMs(interval: string): number {
        const tag = this.getStrictTag(interval);
        const msMap: any = {
            '1s': 1000, '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000, '30m': 1800000,
            '1h': 3600000, '2h': 7200000, '4h': 14400000, '6h': 21600000, '8h': 28800000, '12h': 43200000,
            '1d': 86400000, '2d': 172800000, '3d': 259200000, '5d': 432000000,
            '1w': 604800000, '1M': 2592000000, '3M': 7776000000, '1Y': 31536000000
        };
        return msMap[tag] || 60000;
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

        // 1. 讀取快取
        let cached = this.caches.get(cacheKey) || [];
        if (cached.length === 0 && !endTime) {
            cached = await this.storage.loadKlines(id, tag);
            if (cached.length > 0) this.caches.set(cacheKey, cached);
        }

        // 2. 判斷是否需要抓取
        let forceFetch = false;
        if (!endTime && cached.length > 0) {
            if (Date.now() - cached[cached.length - 1].timestamp > intervalMs * 1.5) forceFetch = true;
        }
        const needsMore = !endTime && cached.length < limit;

        if (!endTime && !forceFetch && !needsMore && cached.length >= limit) {
            return cached.slice(-limit);
        }

        // 3. 抓取逻辑
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
                    high: Math.max(oldC.high, newC.high),
                    low: Math.min(oldC.low, newC.low),
                    volume: Math.max(oldC.volume, newC.volume)
                });
            } else mergedMap.set(newC.timestamp, newC);
        });
        const sorted = Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        this.caches.set(key, sorted.slice(-5000));
    }

    public subscribe(id: string, interval: string, onUpdate: (candle: Candle) => void, source?: string) {
        const tag = this.getStrictTag(interval);
        const cacheKey = `${id}_${tag}`;
        if (!this.subscribers.has(cacheKey)) this.subscribers.set(cacheKey, []);
        this.subscribers.get(cacheKey)?.push(onUpdate);

        if (!this.activeSubscriptions.has(cacheKey)) {
            const symbolInfo = SymbolManager.getSymbolById(id);
            if (symbolInfo) {
                const isNative = this.nativeIntervals.includes(tag);
                // 🚨 修正：如果是合成週期，我們訂閱 1d (日線) 作為更新源，這比 1m 穩定的多
                const subInterval = isNative ? tag : '1d';
                const subKey = `${id}_${subInterval}`;
                if (!this.activeSubscriptions.has(subKey)) {
                    const selSource = (source && symbolInfo.sourceMap[source]) ? source : Object.keys(symbolInfo.sourceMap)[0];
                    const connector = this.connectors.get(selSource);
                    if (connector) {
                        connector.subscribeKlines(symbolInfo.sourceMap[selSource], subInterval, (c) => this.onNewUpdate(id, subInterval, c));
                        this.activeSubscriptions.add(subKey);
                    }
                }
                if (!isNative) this.activeSubscriptions.add(cacheKey);
            }
        }
    }

    private onNewUpdate(id: string, interval: string, data: any) {
        const tag = this.getStrictTag(interval);
        const intervalMs = this.parseIntervalToMs(tag);
        const cacheKey = `${id}_${tag}`;

        let currentCache = this.caches.get(cacheKey) || [];
        const alignedTs = Math.floor((data.timestamp || data.time) / intervalMs) * intervalMs;

        let candleToPush: Candle | null = null;
        if (data.isTrade) {
            if (currentCache.length === 0) return;
            const last = currentCache[currentCache.length - 1];
            if (alignedTs === last.timestamp) {
                last.close = data.close;
                last.high = Math.max(last.high, data.close);
                last.low = Math.min(last.low, data.close);
                candleToPush = last;
            } else if (alignedTs > last.timestamp) {
                const newC = { timestamp: alignedTs, open: data.close, high: data.close, low: data.close, close: data.close, volume: 0 };
                currentCache.push(newC);
                candleToPush = newC;
            }
        } else {
            const candle = data as Candle;
            if (currentCache.length > 0) {
                const last = currentCache[currentCache.length - 1];
                if (candle.timestamp === last.timestamp) {
                    last.high = Math.max(last.high, candle.high);
                    last.low = Math.min(last.low, candle.low);
                    last.close = candle.close;
                    last.volume = Math.max(last.volume, candle.volume);
                } else if (candle.timestamp > last.timestamp) currentCache.push(candle);
            } else currentCache.push(candle);
            candleToPush = currentCache[currentCache.length - 1];
        }

        if (candleToPush) {
            // 1. 推送給當前週期的訂閱者
            const subs = this.subscribers.get(cacheKey);
            if (subs) subs.forEach(cb => cb(candleToPush!));

            // 2. 🚨 級聯推送：如果當前是 1d 更新，且有人訂閱了合成大週期 (如 1M, 5d)
            if (tag === '1d') {
                this.subscribers.forEach((syntheticSubs, sKey) => {
                    const [sId, sTag] = sKey.split('_');
                    if (sId === id && !this.nativeIntervals.includes(sTag)) {
                        const sMs = this.parseIntervalToMs(sTag);
                        let sCache = this.caches.get(sKey) || [];
                        const lastS = sCache.length > 0 ? sCache[sCache.length - 1] : null;
                        const updated = AggregationUtils.updateAggregated(lastS, candleToPush!, sMs);
                        if (!lastS || lastS.timestamp !== updated.timestamp) {
                            sCache.push(updated);
                            this.caches.set(sKey, sCache);
                        } else sCache[sCache.length - 1] = updated;
                        syntheticSubs.forEach(cb => cb(updated));
                    }
                });
            }
        }
    }

    public getSymbols() { return SymbolManager.getAllSymbols(); }
}
