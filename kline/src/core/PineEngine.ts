import { Candle } from '../types/Candle';
import { IndicatorEngine } from './IndicatorEngine';

/**
 * Pine Script 數列 (Series) 模擬
 * 支援透過 offset 存取歷史數據，例如 series[1]
 */
export class Series extends Array<number> {
    constructor(size: number = 0) {
        super(size);
        Object.setPrototypeOf(this, Series.prototype);
    }

    // 取得指定偏移的歷史值 (模擬 Pine Script 的 [index])
    public get(offset: number, currentIndex: number): number {
        const target = currentIndex - offset;
        return (target >= 0 && target < this.length) ? this[target] : NaN;
    }
}

/**
 * Pine Script 執行引擎 (核心)
 */
export class PineEngine {
    private indicatorEngine: IndicatorEngine;
    private plots: Map<string, { data: number[], color: string, title: string }> = new Map();

    constructor() {
        this.indicatorEngine = new IndicatorEngine();
    }

    /**
     * 執行轉譯後的腳本邏輯
     * @param candles 原始 K 線數據
     * @param scriptFn 轉譯後的 JavaScript 函數
     */
    public execute(candles: Candle[], scriptFn: (ctx: any) => void) {
        this.plots.clear();
        const size = candles.length;
        
        // 建立上下文環境
        const ctx = {
            close: new Series(size),
            open: new Series(size),
            high: new Series(size),
            low: new Series(size),
            volume: new Series(size),
            index: 0,
            // 內建繪圖函數
            plot: (series: number[], title: string = 'Plot', color: string = '#2962ff') => {
                this.plots.set(title, { data: series, color, title });
            },
            // 內建指標映射
            sma: (src: number[], len: number) => this.indicatorEngine.sma(src, len),
            ema: (src: number[], len: number) => this.indicatorEngine.ema(src, len),
            rsi: (src: number[], len: number) => this.indicatorEngine.rsi(src, len)
        };

        // 初始化基礎數列
        candles.forEach((c, i) => {
            ctx.close[i] = c.close;
            ctx.open[i] = c.open;
            ctx.high[i] = c.high;
            ctx.low[i] = c.low;
            ctx.volume[i] = c.volume;
        });

        // 執行用戶腳本 (目前先採全量數組計算模式，優化效能)
        try {
            scriptFn(ctx);
        } catch (e) {
            console.error('[PineEngine] Script Execution Error:', e);
        }

        return Array.from(this.plots.values());
    }

    /**
     * 簡易轉譯器：將 Pine 字串轉為 JS 函數
     * 階段一：僅支援基本的 plot(sma(close, 20)) 語法
     */
    public compile(pineCode: string): (ctx: any) => void {
        // 極簡轉譯邏輯 (後續會強化)
        let jsCode = pineCode
            .replace(/ta\.sma/g, 'ctx.sma')
            .replace(/ta\.ema/g, 'ctx.ema')
            .replace(/ta\.rsi/g, 'ctx.rsi')
            .replace(/plot\(/g, 'ctx.plot(')
            .replace(/close/g, 'ctx.close')
            .replace(/open/g, 'ctx.open')
            .replace(/high/g, 'ctx.high')
            .replace(/low/g, 'ctx.low');

        try {
            return new Function('ctx', jsCode) as any;
        } catch (e) {
            console.error('[PineEngine] Compilation Error:', e);
            return () => {};
        }
    }
}
