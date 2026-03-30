import axios from 'axios';
import { Candle } from '../types/Candle';
import { IConnector } from './ConnectorInterface';

/**
 * Yahoo Finance 資料接入器 (股票市場)
 * 支援 美股、台股、外匯等
 * 註：Yahoo 本身不具備公開免費 WebSocket，故即時更新採輪詢模擬
 */
export class YahooConnector implements IConnector {
    public readonly name = 'Yahoo';
    private readonly baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';
    private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

    /**
     * 週期轉換 (Yahoo 使用 1m, 5m, 1h, 1d)
     */
    private formatInterval(interval: string): string {
        const map: any = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '60m', '1d': '1d' };
        return map[interval] || '1d';
    }

    /**
     * 抓取歷史 K 線資料
     */
    public async fetchKlines(symbol: string, interval: string, limit: number = 500, endTime?: number): Promise<Candle[]> {
        const yahooInterval = this.formatInterval(interval);
        
        try {
            // 計算時間範圍
            let range = '5d'; // 預設 5 天
            if (yahooInterval === '1d') range = '1y';

            const url = `${this.baseUrl}/${symbol}`;
            const params: any = {
                interval: yahooInterval,
                range: range
            };

            if (endTime) {
                params.period2 = Math.floor(endTime / 1000);
                params.period1 = params.period2 - (limit * 60 * 60 * 24); // 粗略回溯
            }

            const response = await axios.get(url, { params });
            const result = response.data.chart.result[0];
            const indicators = result.indicators.quote[0];
            const timestamps = result.timestamp;

            return timestamps.map((ts: number, i: number) => ({
                timestamp: ts * 1000,
                open: indicators.open[i] || indicators.close[i],
                high: indicators.high[i] || indicators.close[i],
                low: indicators.low[i] || indicators.close[i],
                close: indicators.close[i],
                volume: indicators.volume[i] || 0
            })).filter((c: any) => c.close !== null).slice(-limit);

        } catch (error) {
            console.error(`[YahooConnector] Fetch error for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * 訂閱即時更新 (模擬)
     */
    public subscribeKlines(symbol: string, interval: string, onUpdate: (candle: Candle) => void): void {
        this.unsubscribe(symbol, interval);

        console.log(`[YahooConnector] Starting simulation for ${symbol}...`);
        
        // 首次立即抓取
        this.fetchKlines(symbol, interval, 1).then(klines => {
            if (klines.length > 0) onUpdate(klines[0]);
        }).catch(() => {});

        // 開啟輪詢 (每 10 秒檢查一次股票價格)
        const timer = setInterval(async () => {
            try {
                const klines = await this.fetchKlines(symbol, interval, 1);
                if (klines.length > 0) {
                    onUpdate(klines[0]);
                }
            } catch (err) {
                // 忽略輪詢報錯
            }
        }, 10000);

        this.pollingIntervals.set(`${symbol}_${interval}`, timer);
    }

    private unsubscribe(symbol: string, interval: string) {
        const key = `${symbol}_${interval}`;
        const timer = this.pollingIntervals.get(key);
        if (timer) {
            clearInterval(timer);
            this.pollingIntervals.delete(key);
        }
    }

    public close(): void {
        this.pollingIntervals.forEach(timer => clearInterval(timer));
        this.pollingIntervals.clear();
    }
}
