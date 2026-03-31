import { Candle } from '../types/Candle';

/**
 * K 線聚合工具 (Timeframe Aggregator)
 * 負責將細粒度週期 (如 1m) 合併為粗粒度週期 (如 5m, 1h)
 */
export class AggregationUtils {
    /**
     * 將細粒度 K 線陣列聚合為指定週期的 K 線陣列
     * @param candles 原始 K 線數據 (必須是排序好的)
     * @param intervalMs 目標週期的毫秒數
     */
    public static aggregate(candles: Candle[], intervalMs: number): Candle[] {
        if (candles.length === 0) return [];

        const aggregated: Candle[] = [];
        let currentCandle: Candle | null = null;

        for (const candle of candles) {
            // 計算該筆數據屬於哪個週期的起始點
            const bucketTs = candle.timestamp - (candle.timestamp % intervalMs);

            if (!currentCandle || currentCandle.timestamp !== bucketTs) {
                // 如果是新的週期區間，將舊的推入結果，並開新的
                if (currentCandle) {
                    aggregated.push(currentCandle);
                }
                currentCandle = {
                    timestamp: bucketTs,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume
                };
            } else {
                // 如果還在同一個週期內，更新數值
                currentCandle.high = Math.max(currentCandle.high, candle.high);
                currentCandle.low = Math.min(currentCandle.low, candle.low);
                currentCandle.close = candle.close;
                currentCandle.volume += candle.volume;
            }
        }

        // 推入最後一個進行中的 K 線
        if (currentCandle) {
            aggregated.push(currentCandle);
        }

        return aggregated;
    }

    /**
     * 單筆數據即時更新聚合 (用於 WebSocket 流)
     * @param existingCandle 目前已存在的目標週期 K 棒
     * @param newData 新進來的細粒度數據
     */
    public static updateAggregated(existingCandle: Candle | null, newData: Candle, intervalMs: number): Candle {
        const bucketTs = newData.timestamp - (newData.timestamp % intervalMs);

        if (!existingCandle || existingCandle.timestamp !== bucketTs) {
            // 開啟新的一根
            return {
                timestamp: bucketTs,
                open: newData.open,
                high: newData.high,
                low: newData.low,
                close: newData.close,
                volume: newData.volume
            };
        } else {
            // 更新現有 K 棒
            return {
                ...existingCandle,
                high: Math.max(existingCandle.high, newData.high),
                low: Math.min(existingCandle.low, newData.low),
                close: newData.close,
                volume: existingCandle.volume + newData.volume
            };
        }
    }
}
