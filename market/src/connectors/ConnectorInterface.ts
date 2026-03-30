import { Candle } from '../types/Candle';

/**
 * 交易所接入器統一介面
 */
export interface IConnector {
    name: string;

    /**
     * 獲取歷史 K 線
     * @param symbol 來源標的
     * @param interval 時間週期
     * @param limit 資料筆數
     * @param endTime 結束時間戳 (用於回溯歷史)
     */
    fetchKlines(symbol: string, interval: string, limit?: number, endTime?: number): Promise<Candle[]>;

    /**
     * 訂閱即時 K 線
     * @param symbol 來源標的
     * @param interval 時間週期
     * @param onUpdate 更新時的回調
     */
    subscribeKlines(symbol: string, interval: string, onUpdate: (candle: Candle) => void): void;

    /**
     * 關閉連線
     */
    close(): void;
}
