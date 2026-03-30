import { BinanceConnector } from '../connectors/BinanceConnector';
import { OKXConnector } from '../connectors/OKXConnector';
import { IConnector } from '../connectors/ConnectorInterface';
import { SymbolManager } from './SymbolManager';
import { Candle } from '../types/Candle';

/**
 * 數據總管 (Data Manager)
 * 協調整個系統的數據獲取、緩存與推送
 */
export class DataManager {
    private static instance: DataManager;
    private connectors: Map<string, IConnector> = new Map();
    private caches: Map<string, Candle[]> = new Map();
    
    // 訂閱清單：Key 為 "Symbol_Interval"，Value 為回調函式陣列
    private subscribers: Map<string, Array<(candle: Candle) => void>> = new Map();
    // 追蹤哪些 Symbol 已經對外部發起訂閱
    private activeSubscriptions: Set<string> = new Set();

    private constructor() {
        // 註冊所有可用的接入器
        const binance = new BinanceConnector();
        const okx = new OKXConnector();
        this.connectors.set(binance.name, binance);
        this.connectors.set(okx.name, okx);
    }

    public static getInstance(): DataManager {
        if (!DataManager.instance) {
            DataManager.instance = new DataManager();
        }
        return DataManager.instance;
    }

    /**
     * 獲取指定標的的 K 線數據
     * @param id 內部 ID
     * @param interval 週期
     * @param limit 筆數
     * @param endTime 結束時間戳 (用於 Lazy Load)
     */
    public async getKlines(id: string, interval: string, limit: number = 500, endTime?: number): Promise<Candle[]> {
        const symbolInfo = SymbolManager.getSymbolById(id);
        if (!symbolInfo) throw new Error(`Unsupported symbol ID: ${id}`);

        // 尋找可用的來源 (優先序: Binance > OKX)
        const sources = Object.keys(symbolInfo.sourceMap);
        let lastError = null;

        for (const source of sources) {
            const connector = this.connectors.get(source);
            const sourceSymbol = symbolInfo.sourceMap[source];
            
            if (connector && sourceSymbol) {
                try {
                    const klines = await connector.fetchKlines(sourceSymbol, interval, limit, endTime);
                    
                    // 只有在抓取「最新」數據時才更新緩存
                    if (!endTime) {
                        const cacheKey = `${id}_${interval}`;
                        this.caches.set(cacheKey, klines);
                    }
                    
                    return klines;
                } catch (err) {
                    console.warn(`[DataManager] Source ${source} failed for ${id}, trying next...`);
                    lastError = err;
                }
            }
        }

        throw lastError || new Error(`No available source for ${id}`);
    }

    /**
     * 訂閱即時 K 線更新
     */
    public subscribe(id: string, interval: string, onUpdate: (candle: Candle) => void) {
        const cacheKey = `${id}_${interval}`;
        
        if (!this.subscribers.has(cacheKey)) {
            this.subscribers.set(cacheKey, []);
        }
        this.subscribers.get(cacheKey)?.push(onUpdate);

        // 如果還沒發起連線
        if (!this.activeSubscriptions.has(cacheKey)) {
            const symbolInfo = SymbolManager.getSymbolById(id);
            if (symbolInfo) {
                // 訂閱第一個可用的來源
                const source = Object.keys(symbolInfo.sourceMap)[0];
                const connector = this.connectors.get(source);
                const sourceSymbol = symbolInfo.sourceMap[source];

                if (connector && sourceSymbol) {
                    console.log(`[DataManager] Starting ${source} WS subscription for ${id} ${interval}`);
                    connector.subscribeKlines(sourceSymbol, interval, (candle) => {
                        this.onNewCandle(id, interval, candle);
                    });
                    this.activeSubscriptions.add(cacheKey);
                }
            }
        }
    }

    /**
     * 當收到來自 Ingestion 的新 K 線時，分發給所有訂閱者
     */
    private onNewCandle(id: string, interval: string, candle: Candle) {
        const cacheKey = `${id}_${interval}`;
        
        // 更新緩存的最後一筆 (Hot Storage 概念)
        const currentCache = this.caches.get(cacheKey);
        if (currentCache && currentCache.length > 0) {
            const lastCandle = currentCache[currentCache.length - 1];
            if (lastCandle.timestamp === candle.timestamp) {
                // 更新當前 K 線 (進行中)
                currentCache[currentCache.length - 1] = candle;
            } else if (candle.timestamp > lastCandle.timestamp) {
                // 新產生的 K 線
                currentCache.push(candle);
                if (currentCache.length > 1000) currentCache.shift(); // 限制緩存大小
            }
        }

        // 廣播給所有訂閱者
        const subs = this.subscribers.get(cacheKey);
        if (subs) {
            subs.forEach(callback => callback(candle));
        }
    }

    /**
     * 獲取所有支援的標的清單
     */
    public getSymbols() {
        return SymbolManager.getAllSymbols();
    }
}
