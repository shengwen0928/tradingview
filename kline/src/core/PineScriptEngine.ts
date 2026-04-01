import { Candle } from '../types/Candle';

/**
 * 🌲 Pine Script 專業執行引擎 (獨立版)
 * 🚀 支援 Bar-by-Bar 逐根執行模型與歷史引用 [] 語法
 */

// --- 1. Series 數列核心 ---
export class Series {
    private data: number[] = [];
    private currentIndex: number = 0;

    constructor(initialData: number[] = []) {
        this.data = initialData;
    }

    public push(value: number) {
        this.data.push(value);
    }

    public setCurrentIndex(index: number) {
        this.currentIndex = index;
    }

    // 模擬 Pine Script 的歷史運算子 [offset]
    public get(offset: number = 0): number {
        const target = this.currentIndex - offset;
        return (target >= 0 && target < this.data.length) ? this.data[target] : NaN;
    }

    public get raw(): number[] { return this.data; }
    public get length(): number { return this.data.length; }
}

// --- 2. 內建函式庫 (ta.* / math.*) ---
class PineLibrary {
    // 簡單移動平均 (逐根計算版)
    public static sma(src: Series, len: number, barIndex: number): number {
        if (barIndex < len - 1) return NaN;
        let sum = 0;
        for (let i = 0; i < len; i++) {
            sum += src.get(i);
        }
        return sum / len;
    }

    // 指數移動平均
    public static ema(src: Series, len: number, barIndex: number, prevEMA: number): number {
        const alpha = 2 / (len + 1);
        const current = src.get(0);
        if (isNaN(prevEMA)) return current;
        return (current - prevEMA) * alpha + prevEMA;
    }

    // 相對強弱指標 (RSI)
    public static rsi(src: Series, len: number, barIndex: number, context: any): number {
        const diff = src.get(0) - src.get(1);
        let up = diff > 0 ? diff : 0;
        let down = diff < 0 ? -diff : 0;

        if (barIndex < len) return NaN;

        context.rsi_up = (context.rsi_up * (len - 1) + up) / len;
        context.rsi_down = (context.rsi_down * (len - 1) + down) / len;

        const rs = context.rsi_up / context.rsi_down;
        return 100 - (100 / (1 + rs));
    }
}

// --- 3. 引擎核心 ---
export class PineScriptEngine {
    private plots: Map<string, { data: number[], color: string, title: string }> = new Map();
    private varState: Map<string, any> = new Map(); // 儲存 'var' 宣告的變數

    constructor() {}

    /**
     * 編譯 Pine Script 為高效 JavaScript 執行序列
     */
    public compile(code: string): string {
        let lines = code.split('\n');
        let jsLines: string[] = [];

        lines.forEach(line => {
            let trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) return;

            // 轉譯語法：
            // 1. 處理 [] -> .get()
            let processed = trimmed.replace(/(\w+)\[(\d+)\]/g, '$1.get($2)');
            
            // 2. 處理 ta.sma(close, 20) -> Lib.sma(ctx.close, 20, ctx.bar_index)
            processed = processed.replace(/ta\.sma\(([^,]+),\s*([^)]+)\)/g, 'Lib.sma($1, $2, ctx.bar_index)');
            processed = processed.replace(/ta\.ema\(([^,]+),\s*([^)]+)\)/g, 'Lib.ema($1, $2, ctx.bar_index, ctx.prev_val)');
            
            // 3. 處理 plot(src, title, color) -> ctx.plot(src, title, color)
            processed = processed.replace(/plot\(/g, 'ctx.plot(');

            // 4. 基礎變數賦值 (簡單轉譯為 JS 變數)
            if (processed.includes('=') && !processed.includes('==') && !processed.includes('ctx.plot')) {
                processed = 'let ' + processed;
            }

            jsLines.push(processed + ';');
        });

        return jsLines.join('\n');
    }

    /**
     * 執行引擎：逐根執行模式 (Bar-by-Bar)
     */
    public run(candles: Candle[], compiledJs: string) {
        this.plots.clear();
        this.varState.clear();

        const size = candles.length;
        const seriesData = {
            open: new Series(candles.map(c => c.open)),
            high: new Series(candles.map(c => c.high)),
            low: new Series(candles.map(c => c.low)),
            close: new Series(candles.map(c => c.close)),
            volume: new Series(candles.map(c => c.volume))
        };

        const plotBuffers: Map<string, number[]> = new Map();

        // 建立執行上下文
        const ctx = {
            open: seriesData.open,
            high: seriesData.high,
            low: seriesData.low,
            close: seriesData.close,
            volume: seriesData.volume,
            bar_index: 0,
            prev_val: NaN, // 用於遞迴指標
            plot: (val: any, title: string = 'Plot', color: string = '#2962ff') => {
                if (!plotBuffers.has(title)) {
                    plotBuffers.set(title, new Array(size).fill(NaN));
                }
                const v = (val instanceof Series) ? val.get(0) : val;
                plotBuffers.get(title)![ctx.bar_index] = v;
            }
        };

        // 建立執行沙盒
        const executeBar = new Function('ctx', 'Lib', compiledJs);

        // 🚀 核心：Bar-by-Bar Loop (逐根掃描)
        for (let i = 0; i < size; i++) {
            ctx.bar_index = i;
            // 更新 Series 當前指針
            ctx.open.setCurrentIndex(i);
            ctx.high.setCurrentIndex(i);
            ctx.low.setCurrentIndex(i);
            ctx.close.setCurrentIndex(i);
            ctx.volume.setCurrentIndex(i);

            try {
                executeBar(ctx, PineLibrary);
            } catch (e) {
                console.error(`[PineScriptEngine] Error at bar ${i}:`, e);
                break;
            }
        }

        // 整理繪圖結果
        const finalPlots: any[] = [];
        plotBuffers.forEach((data, title) => {
            finalPlots.push({ data, title, color: '#2962ff' }); // 顏色可擴充
        });

        return finalPlots;
    }
}
