import axios from 'axios';
import { Candle } from '../types/Candle';
import { IConnector } from './ConnectorInterface';

/**
 * Yahoo Finance 資料接入器 (股票市場)
 * 支援 美股、台股、外匯等
 */
export class YahooConnector implements IConnector {
    public readonly name = 'Yahoo';
    private readonly baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';
    private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

    /**
     * 週期轉換 (Yahoo 規格)
     */
    private formatInterval(interval: string): string {
        const norm = interval.toLowerCase();
        const map: any = { 
            '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
            '1h': '60m', '1d': '1d', '1w': '1wk', '1M': '1mo'
        };
        return map[interval] || map[norm] || '1d';
    }

    /**
     * 抓取歷史 K 線資料
     */
    public async fetchKlines(symbol: string, interval: string, limit: number = 500, endTime?: number): Promise<Candle[]> {
        const yahooInterval = this.formatInterval(interval);
        
        try {
            const p2 = endTime ? Math.floor(endTime / 1000) : Math.floor(Date.now() / 1000);
            
            // 🚨 修正：大幅增加回溯緩衝 (10倍)，確保覆蓋所有非交易時段
            const msMap: any = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '60m': 3600, '1d': 86400, '1wk': 604800, '1mo': 2592000 };
            const secondsPerBar = msMap[yahooInterval] || 86400;
            const p1 = p2 - (limit * secondsPerBar * 10); 

            const url = `${this.baseUrl}/${symbol}`;
            const params: any = {
                interval: yahooInterval,
                period1: Math.floor(p1),
                period2: p2,
                includePrePost: false
            };

            const response = await axios.get(url, { params });
            const result = response.data.chart.result[0];
            if (!result || !result.timestamp) return [];

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

        } catch (error: any) {
            // console.error(`[YahooConnector] Fetch error for ${symbol}:`, error.message);
            return [];
        }
    }

    /**
     * 訂閱即時更新 (模擬)
     */
    public subscribeKlines(symbol: string, interval: string, onUpdate: (candle: Candle) => void): void {
        this.unsubscribe(symbol, interval);
        console.log(`[YahooConnector] Starting robust simulation for ${symbol} @ ${interval}...`);
        
        const timer = setInterval(async () => {
            try {
                // 🚨 修正：輪詢時抓取最近 10 根，取最後一根有效數據，確保跳過休市期
                const klines = await this.fetchKlines(symbol, interval, 10);
                if (klines.length > 0) {
                    const latest = klines[klines.length - 1];
                    onUpdate(latest);
                }
            } catch (err) {}
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
