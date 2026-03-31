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

    // 支援的原生週期列表 (Binance/OKX 通用)
    private readonly nativeIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M', '3M', '1Y'];

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
     * 標準化週期字串 (處理大小寫不一)
     */
    private normalizeInterval(interval: string): string {
        const unit = interval.slice(-1);
        const val = interval.slice(0, -1);
        if (unit === 'M') return `${val}M`; // 月線保留大寫
        if (unit === 'm') return `${val}m`; // 分鐘線保留小寫
        return interval.toLowerCase(); // 其餘 (h, d, w) 轉小寫
    }

    /**
     * 找出最適合用來合成目標週期的原生週期
     */
    private getBestBaseInterval(targetMs: number): string {
        // 按時間從大到小檢查原生週期
        const sortedNatives = [
            { s: '1M', ms: 2592000000 },
            { s: '1d', ms: 86400000 },
            { s: '4h', ms: 14400000 },
            { s: '1h', ms: 3600000 },
            { s: '15m', ms: 900000 },
            { s: '5m', ms: 300000 },
            { s: '1m', ms: 60000 }
        ];

        for (const native of sortedNatives) {
            if (targetMs > native.ms && targetMs % native.ms === 0) {
                return native.s;
            }
        }
        return '1m';
    }

    /**
     * 獲取指定標的的 K 線數據 (支援 Gap Filling 與 Timeframe 合成)
     */
    public async getKlines(id: string, interval: string, limit: number = 500, endTime?: number, source?: string): Promise<Candle[]> {
        const normInterval = this.normalizeInterval(interval);
        const cacheKey = `${id}_${normInterval}`;
        const intervalMs = this.parseIntervalToMs(normInterval);
        
        // 1. 檢查是否為「非原生週期」
        const isNative = this.nativeIntervals.includes(normInterval);
        if (!isNative) {
            // 🚨 智能選取基準週期
            const baseInterval = this.getBestBaseInterval(intervalMs);
            const baseMs = this.parseIntervalToMs(baseInterval);
            const ratio = Math.ceil(intervalMs / baseMs);
            
            console.log(`[DataManager] 🛠 Synthetic: ${normInterval}. Using ${baseInterval} as base (Ratio: ${ratio})`);
            
            // 限制抓取筆數，防止過大請求
            const fetchLimit = Math.min(1000, limit * ratio);
            const rawBase = await this.getKlines(id, baseInterval, fetchLimit, endTime, source);
            
            if (rawBase.length === 0) return [];
            return AggregationUtils.aggregate(rawBase, intervalMs).slice(-limit);
        }

        // 2. 優先嘗試從 Memory 或 Disk 獲取
        let cached = this.caches.get(cacheKey) || [];
        if (cached.length === 0 && !endTime) {
            cached = await this.storage.loadKlines(id, normInterval);
            if (cached.length > 0) this.caches.set(cacheKey, cached);
        }

        // 3. 判斷是否需要「補齊」 (Gap Filling)
        let finalLimit = limit;
        let forceFetch = false;

        if (!endTime && cached.length > 0) {
            const lastTs = cached[cached.length - 1].timestamp;
            const now = Date.now();
            const gapMs = now - lastTs;
            
            // 針對日線以上長週期 (>= 1d)，只要最後更新時間超過 1 小時，就強制補齊
            if (intervalMs >= 86400000 && gapMs > 3600000) {
                forceFetch = true;
                finalLimit = Math.max(10, Math.ceil(gapMs / intervalMs) + 5);
            } 
            // 針對短週期，維持 1.5 倍判定
            else if (gapMs > intervalMs * 1.5) {
                const missingCount = Math.ceil(gapMs / intervalMs);
                finalLimit = Math.max(limit, missingCount + 10);
                if (finalLimit > 1000) finalLimit = 1000;
                forceFetch = true;
                console.log(`[DataManager] 🧩 Gap detected for ${id} (${normInterval}). Missing ~${missingCount} candles. Fetching ${finalLimit}...`);
            }
        }

        // 如果資料量夠且沒斷層且不需強制更新，直接回傳
        if (!endTime && !forceFetch && cached.length >= limit && (Date.now() - cached[cached.length-1].timestamp < intervalMs * 1.5)) {
            return cached.slice(-limit);
        }

        const symbolInfo = SymbolManager.getSymbolById(id);
        if (!symbolInfo) throw new Error(`Unsupported symbol ID: ${id}`);

        let sources = Object.keys(symbolInfo.sourceMap);
        if (source && symbolInfo.sourceMap[source]) {
            sources = [source, ...sources.filter(s => s !== source)];
        }

        let lastError = null;

        for (const source of sources) {
            const connector = this.connectors.get(source);
            const sourceSymbol = symbolInfo.sourceMap[source];
            
            if (connector && sourceSymbol) {
                try {
                    const klines = await connector.fetchKlines(sourceSymbol, normInterval, finalLimit, endTime);
                    
                    if (!endTime) {
                        this.updateCache(id, normInterval, klines);
                        this.storage.saveKlines(id, normInterval, klines); 
                    }
                    
                    return klines.slice(-limit);
                } catch (err) {
                    console.warn(`[DataManager] Source ${source} failed for ${id}, trying next...`);
                    lastError = err;
                }
            }
        }

        throw lastError || new Error(`No available source for ${id}`);
    }

    /**
     * 安全地更新/合併快取資料 (具備價格保護機制)
     */
    private updateCache(id: string, interval: string, newKlines: Candle[]) {
        const cacheKey = `${id}_${interval}`;
        let current = this.caches.get(cacheKey) || [];
        
        const mergedMap = new Map<number, Candle>();
        current.forEach(c => mergedMap.set(c.timestamp, c));
        
        const lastTsBefore = current.length > 0 ? current[current.length - 1].timestamp : 0;

        newKlines.forEach(newC => {
            const oldC = mergedMap.get(newC.timestamp);
            if (oldC) {
                // 診斷 Log：只盯著最後一根
                if (newC.timestamp === lastTsBefore) {
                    console.log(`[DataManager] 🔍 merging latest candle ${id} @ ${new Date(newC.timestamp).toLocaleTimeString()}`);
                    console.log(`   - Before: H:${oldC.high} L:${oldC.low} C:${oldC.close}`);
                    console.log(`   - New (API): H:${newC.high} L:${newC.low} C:${newC.close}`);
                }

                mergedMap.set(newC.timestamp, {
                    timestamp: newC.timestamp,
                    open: newC.open,
                    high: Math.max(oldC.high, newC.high),
                    low: Math.min(oldC.low, newC.low),
                    close: newC.close,
                    volume: Math.max(oldC.volume, newC.volume)
                });

                if (newC.timestamp === lastTsBefore) {
                    const final = mergedMap.get(newC.timestamp);
                    console.log(`   - Final: H:${final?.high} L:${final?.low} C:${final?.close}`);
                }
            } else {
                mergedMap.set(newC.timestamp, newC);
            }
        });
        
        const sorted = Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        this.caches.set(cacheKey, sorted.slice(-5000));
    }

    /**
     * 訂閱即時 K 線更新
     */
    public subscribe(id: string, interval: string, onUpdate: (candle: Candle) => void, source?: string) {
        const normInterval = this.normalizeInterval(interval);
        const cacheKey = `${id}_${normInterval}`;
        
        if (!this.subscribers.has(cacheKey)) {
            this.subscribers.set(cacheKey, []);
        }
        this.subscribers.get(cacheKey)?.push(onUpdate);

        // 如果還沒發起連線
        if (!this.activeSubscriptions.has(cacheKey)) {
            const symbolInfo = SymbolManager.getSymbolById(id);
            if (symbolInfo) {
                // 🚨 關鍵修復：使用 normInterval 判斷
                const isNative = this.nativeIntervals.includes(normInterval);
                const subInterval = isNative ? normInterval : '1m';
                const subKey = `${id}_${subInterval}`;

                if (!this.activeSubscriptions.has(subKey)) {
                    const selectedSource = (source && symbolInfo.sourceMap[source]) ? source : Object.keys(symbolInfo.sourceMap)[0];
                    const connector = this.connectors.get(selectedSource);
                    const sourceSymbol = symbolInfo.sourceMap[selectedSource];

                    if (connector && sourceSymbol) {
                        console.log(`[DataManager] Starting ${selectedSource} WS subscription for ${id} ${subInterval}`);
                        connector.subscribeKlines(sourceSymbol, subInterval, (candle) => {
                            this.onNewCandle(id, subInterval, candle);
                        });
                        this.activeSubscriptions.add(subKey);
                    }
                }
                
                if (!isNative) this.activeSubscriptions.add(cacheKey);
            }
        }
    }

    /**
     * 將週期字串轉換為毫秒數
     */
    private parseIntervalToMs(interval: string): number {
        const unit = interval.slice(-1);
        const value = parseInt(interval.slice(0, -1));
        switch (unit) {
            case 'm': return value * 60000;
            case 'h': case 'H': return value * 3600000;
            case 'd': case 'D': return value * 86400000;
            case 'w': case 'W': return value * 604800000;
            case 'M': return value * 2592000000;
            default: return 60000;
        }
    }

    /**
     * 當收到來自 Ingestion 的新數據時 (支援精準時間對齊與銜接)
     */
    private onNewCandle(id: string, interval: string, data: any) {
        const cacheKey = `${id}_${interval}`;
        const intervalMs = this.parseIntervalToMs(interval);
        
        let currentCache = this.caches.get(cacheKey);
        if (!currentCache) {
            currentCache = [];
            this.caches.set(cacheKey, currentCache);
        }

        let candleToPush: Candle | null = null;

        // 計算目前這筆數據「理應」屬於哪一個 K 棒起始時間 (時間對齊)
        const dataTs = data.timestamp || data.time;
        const alignedTs = Math.floor(dataTs / intervalMs) * intervalMs;

        if (data.isTrade) {
            // --- 成交流更新 (毫秒級) ---
            if (currentCache.length === 0) return;
            
            const lastCandle = currentCache[currentCache.length - 1];

            if (alignedTs === lastCandle.timestamp) {
                // ✅ 更新最後一根 (銜接)
                lastCandle.close = data.close;
                lastCandle.high = Math.max(lastCandle.high, data.close);
                lastCandle.low = Math.min(lastCandle.low, data.close);
                candleToPush = lastCandle;
            } else if (alignedTs > lastCandle.timestamp) {
                // ✅ 跨週期了，開新 K 棒
                const newCandle: Candle = {
                    timestamp: alignedTs,
                    open: data.close,
                    high: data.close,
                    low: data.close,
                    close: data.close,
                    volume: 0
                };
                currentCache.push(newCandle);
                if (currentCache.length > 5000) currentCache.shift();
                candleToPush = newCandle;
            }
        } else {
            // --- 官方 K 線更新 ---
            const candle = data as Candle;
            if (currentCache.length > 0) {
                const lastCandle = currentCache[currentCache.length - 1];
                
                if (candle.timestamp === lastCandle.timestamp) {
                    // ✅ 官方數據同步：更新目前這根
                    lastCandle.high = Math.max(lastCandle.high, candle.high);
                    lastCandle.low = Math.min(lastCandle.low, candle.low);
                    lastCandle.close = candle.close;
                    lastCandle.volume = Math.max(lastCandle.volume, candle.volume);
                } else if (candle.timestamp > lastCandle.timestamp) {
                    // ✅ 官方新 K 棒：直接推入
                    currentCache.push(candle);
                    if (currentCache.length > 5000) currentCache.shift();
                }
            } else {
                currentCache.push(candle);
            }
            candleToPush = currentCache[currentCache.length - 1];
        }

        // 1. 推送給當前週期的訂閱者
        if (candleToPush) {
            const subs = this.subscribers.get(cacheKey);
            if (subs) subs.forEach(callback => callback(candleToPush!));

            // 2. 🚨 關鍵：如果當前是 1m 更新，且存在「非原生週期」的訂閱，執行合成推送
            if (interval === '1m') {
                this.subscribers.forEach((subs, key) => {
                    const [subId, subInterval] = key.split('_');
                    if (subId === id && !this.nativeIntervals.includes(subInterval)) {
                        // 執行合成邏輯
                        const targetIntervalMs = this.parseIntervalToMs(subInterval);
                        let subCache = this.caches.get(key) || [];
                        const lastSubCandle = subCache.length > 0 ? subCache[subCache.length - 1] : null;
                        
                        const updated = AggregationUtils.updateAggregated(lastSubCandle, candleToPush!, targetIntervalMs);
                        
                        if (!lastSubCandle || lastSubCandle.timestamp !== updated.timestamp) {
                            subCache.push(updated);
                            if (subCache.length > 5000) subCache.shift();
                            this.caches.set(key, subCache);
                        } else {
                            subCache[subCache.length - 1] = updated;
                        }
                        
                        subs.forEach(callback => callback(updated));
                    }
                });
            }
        }
    }

    /**
     * 獲取所有支援的標的清單
     */
    public getSymbols() {
        return SymbolManager.getAllSymbols();
    }
}
