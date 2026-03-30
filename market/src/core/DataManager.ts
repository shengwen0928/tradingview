import { BinanceConnector } from '../connectors/BinanceConnector';
import { OKXConnector } from '../connectors/OKXConnector';
import { YahooConnector } from '../connectors/YahooConnector';
import { IConnector } from '../connectors/ConnectorInterface';
import { SymbolManager } from './SymbolManager';
import { Candle } from '../types/Candle';

import { StorageManager } from './StorageManager';

/**
 * 數據總管 (Data Manager)
 * 協調整個系統的數據獲取、緩存與推送
 */
export class DataManager {
    private static instance: DataManager;
    private connectors: Map<string, IConnector> = new Map();
    private caches: Map<string, Candle[]> = new Map();
    private storage: StorageManager;
    
    // 訂閱清單：Key 為 "Symbol_Interval"，Value 為回調函式陣列
    private subscribers: Map<string, Array<(candle: Candle) => void>> = new Map();
    // 追蹤哪些 Symbol 已經對外部發起訂閱
    private activeSubscriptions: Set<string> = new Set();

    private constructor() {
        this.storage = StorageManager.getInstance();
        // 註冊所有可用的接入器
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
     * 獲取指定標的的 K 線數據 (支援 Gap Filling 自動補齊)
     */
    public async getKlines(id: string, interval: string, limit: number = 500, endTime?: number, source?: string): Promise<Candle[]> {
        const cacheKey = `${id}_${interval}`;
        const intervalMs = this.parseIntervalToMs(interval);
        
        // 1. 優先嘗試從 Memory 或 Disk 獲取
        let cached = this.caches.get(cacheKey) || [];
        if (cached.length === 0 && !endTime) {
            cached = await this.storage.loadKlines(id, interval);
            if (cached.length > 0) this.caches.set(cacheKey, cached);
        }

        // 2. 判斷是否需要「補齊」 (Gap Filling)
        // 如果不是在查歷史資料，且本地有資料，檢查最後一筆時間
        let finalLimit = limit;
        if (!endTime && cached.length > 0) {
            const lastTs = cached[cached.length - 1].timestamp;
            const now = Date.now();
            const gapMs = now - lastTs;
            
            if (gapMs > intervalMs * 1.5) {
                // 算出中間差了幾根，並要求交易所多給一些
                const missingCount = Math.ceil(gapMs / intervalMs);
                finalLimit = Math.max(limit, missingCount + 10); // 多抓 10 根緩衝
                if (finalLimit > 1000) finalLimit = 1000; // Binance 單次上限通常是 1000
                console.log(`[DataManager] 🧩 Gap detected for ${id}. Missing ~${missingCount} candles. Fetching ${finalLimit}...`);
            }
        }

        // 如果資料量夠且沒斷層，直接回傳
        if (!endTime && cached.length >= limit && (Date.now() - cached[cached.length-1].timestamp < intervalMs * 1.5)) {
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
                    // 使用計算後的 finalLimit
                    const klines = await connector.fetchKlines(sourceSymbol, interval, finalLimit, endTime);
                    
                    if (!endTime) {
                        this.updateCache(id, interval, klines);
                        this.storage.saveKlines(id, interval, klines); 
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
     * 安全地更新/合併快取資料
     */
    private updateCache(id: string, interval: string, newKlines: Candle[]) {
        const cacheKey = `${id}_${interval}`;
        let current = this.caches.get(cacheKey) || [];
        
        const mergedMap = new Map<number, Candle>();
        current.forEach(c => mergedMap.set(c.timestamp, c));
        newKlines.forEach(c => mergedMap.set(c.timestamp, c));
        
        const sorted = Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        this.caches.set(cacheKey, sorted.slice(-5000));
    }

    /**
     * 訂閱即時 K 線更新
     */
    public subscribe(id: string, interval: string, onUpdate: (candle: Candle) => void, source?: string) {
        const cacheKey = `${id}_${interval}`;
        
        if (!this.subscribers.has(cacheKey)) {
            this.subscribers.set(cacheKey, []);
        }
        this.subscribers.get(cacheKey)?.push(onUpdate);

        // 如果還沒發起連線
        if (!this.activeSubscriptions.has(cacheKey)) {
            const symbolInfo = SymbolManager.getSymbolById(id);
            if (symbolInfo) {
                const selectedSource = (source && symbolInfo.sourceMap[source]) ? source : Object.keys(symbolInfo.sourceMap)[0];
                const connector = this.connectors.get(selectedSource);
                const sourceSymbol = symbolInfo.sourceMap[selectedSource];

                if (connector && sourceSymbol) {
                    console.log(`[DataManager] Starting ${selectedSource} WS subscription for ${id} ${interval}`);
                    connector.subscribeKlines(sourceSymbol, interval, (candle) => {
                        this.onNewCandle(id, interval, candle);
                    });
                    this.activeSubscriptions.add(cacheKey);
                }
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
            default: return 60000;
        }
    }

    /**
     * 當收到來自 Ingestion 的新數據時 (K 線或成交流)
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

        if (data.isTrade) {
            // --- 成交流更新 ---
            if (currentCache.length === 0) return;

            const lastCandle = currentCache[currentCache.length - 1];
            const candleStartTs = data.timestamp - (data.timestamp % intervalMs);

            if (candleStartTs === lastCandle.timestamp) {
                lastCandle.close = data.close;
                if (data.close > lastCandle.high) lastCandle.high = data.close;
                if (data.close < lastCandle.low) lastCandle.low = data.close;
                candleToPush = lastCandle;
            } else if (data.timestamp > lastCandle.timestamp + intervalMs) {
                // 如果是新的一根 K 棒的成交，先創建一個臨時 K 棒，直到官方 kline 更新
                const newCandle: Candle = {
                    timestamp: candleStartTs,
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
                if (lastCandle.timestamp === candle.timestamp) {
                    Object.assign(lastCandle, candle);
                } else if (candle.timestamp > lastCandle.timestamp) {
                    currentCache.push(candle);
                    if (currentCache.length > 5000) currentCache.shift();
                }
            } else {
                currentCache.push(candle);
            }
            candleToPush = currentCache[currentCache.length - 1];
        }

        if (candleToPush) {
            const subs = this.subscribers.get(cacheKey);
            if (subs) {
                subs.forEach(callback => callback(candleToPush!));
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
