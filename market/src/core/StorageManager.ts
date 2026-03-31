import fs from 'fs';
import path from 'path';
import { Candle } from '../types/Candle';

/**
 * 存儲管理員 (Storage Manager)
 * 負責將 K 線數據持久化到硬碟，並在啟動時載入。
 * 這是計畫書中 Cold/Warm Storage 的基礎實作。
 */
export class StorageManager {
    private static instance: StorageManager;
    private readonly storageDir = path.join(process.cwd(), 'data', 'klines');

    private constructor() {
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }

    public static getInstance(): StorageManager {
        if (!StorageManager.instance) {
            StorageManager.instance = new StorageManager();
        }
        return StorageManager.instance;
    }

    /**
     * 生成儲存檔案路徑
     * 格式: data/klines/BTC_USDT_1_min.json
     */
    private getFilePath(id: string, interval: string): string {
        const safeId = id.replace('/', '_');
        // 🚨 致命修復：解決 Windows 檔案系統不區分大小寫的問題
        // 否則 1m 和 1M 會寫入同一個檔案互相覆蓋污染
        let safeInterval = interval;
        if (interval.endsWith('M')) safeInterval = interval.replace('M', '_Month');
        if (interval.endsWith('m')) safeInterval = interval.replace('m', '_min');
        
        return path.join(this.storageDir, `${safeId}_${safeInterval}.json`);
    }

    /**
     * 儲存 K 線數據到檔案
     */
    public async saveKlines(id: string, interval: string, candles: Candle[]): Promise<void> {
        const filePath = this.getFilePath(id, interval);
        try {
            // 讀取現有資料進行合併 (去重)
            let existing: Candle[] = [];
            if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, 'utf-8');
                existing = JSON.parse(raw);
            }

            // 合併新舊資料並根據時間戳去重
            const mergedMap = new Map<number, Candle>();
            existing.forEach(c => mergedMap.set(c.timestamp, c));
            candles.forEach(c => mergedMap.set(c.timestamp, c));

            // 轉回陣列並排序
            const sorted = Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
            
            // 限制單個檔案的大小 (例如保留最近 10,000 根，其餘移至 Cold Storage)
            const finalData = sorted.slice(-10000);

            fs.writeFileSync(filePath, JSON.stringify(finalData, null, 2));
            // console.log(`[StorageManager] Saved ${candles.length} candles to ${filePath}`);
        } catch (error) {
            console.error(`[StorageManager] Save failed for ${id}:`, error);
        }
    }

    /**
     * 從檔案載入 K 線數據
     */
    public async loadKlines(id: string, interval: string): Promise<Candle[]> {
        const filePath = this.getFilePath(id, interval);
        try {
            if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(raw);
            }
        } catch (error) {
            console.error(`[StorageManager] Load failed for ${id}:`, error);
        }
        return [];
    }
}
