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

    public set(val: number) {
        this.data[this.currentIndex] = val;
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
    public static nz(val: any, replacement: number = 0): number { 
        return isNaN(val) || val === null || val === undefined ? replacement : val; 
    }

    // 簡單移動平均 (逐根計算版)
    public static sma(src: Series, len: number): number {
        if (src.length < len || isNaN(src.get(len - 1))) return NaN;
        let sum = 0;
        for (let i = 0; i < len; i++) {
            sum += src.get(i);
        }
        return sum / len;
    }

    // 指數移動平均
    public static ema(src: Series, len: number, prevEMA: number): number {
        const alpha = 2 / (len + 1);
        const current = src.get(0);
        if (isNaN(prevEMA)) return current;
        return (current - prevEMA) * alpha + prevEMA;
    }

    // 指數加權移動平均 (TradingView 常用於 ATR/RSI)
    public static rma(src: Series, len: number, prevRMA: number): number {
        const alpha = 1 / len;
        const current = src.get(0);
        if (isNaN(prevRMA)) return current;
        return (current - prevRMA) * alpha + prevRMA;
    }

    // 加權移動平均
    public static wma(src: Series, len: number): number {
        if (src.length < len || isNaN(src.get(len - 1))) return NaN;
        let norm = 0, sum = 0;
        for (let i = 0; i < len; i++) {
            const weight = (len - i) * len;
            norm += weight;
            sum += src.get(i) * weight;
        }
        return sum / norm;
    }

    // 成交量加權移動平均
    public static vwma(src: Series, vol: Series, len: number): number {
        if (src.length < len || vol.length < len) return NaN;
        let sumVol = 0, sumSrcVol = 0;
        for (let i = 0; i < len; i++) {
            sumVol += vol.get(i);
            sumSrcVol += src.get(i) * vol.get(i);
        }
        return sumSrcVol / sumVol;
    }

    // 相對強弱指標 (RSI)
    public static rsi(src: Series, len: number, context: any): number {
        const diff = src.get(0) - src.get(1);
        let up = diff > 0 ? diff : 0;
        let down = diff < 0 ? -diff : 0;

        context.rsi_up = (context.rsi_up * (len - 1) + up) / len;
        context.rsi_down = (context.rsi_down * (len - 1) + down) / len;

        const rs = context.rsi_up / context.rsi_down;
        return 100 - (100 / (1 + rs));
    }

    public static crossover(src1: Series | number, src2: Series | number): boolean {
        const val1 = typeof src1 === 'number' ? src1 : src1.get(0);
        const val2 = typeof src2 === 'number' ? src2 : src2.get(0);
        const prev1 = typeof src1 === 'number' ? src1 : src1.get(1);
        const prev2 = typeof src2 === 'number' ? src2 : src2.get(1);
        return val1 > val2 && prev1 <= prev2;
    }

    public static crossunder(src1: Series | number, src2: Series | number): boolean {
        const val1 = typeof src1 === 'number' ? src1 : src1.get(0);
        const val2 = typeof src2 === 'number' ? src2 : src2.get(0);
        const prev1 = typeof src1 === 'number' ? src1 : src1.get(1);
        const prev2 = typeof src2 === 'number' ? src2 : src2.get(1);
        return val1 < val2 && prev1 >= prev2;
    }

    public static atr(high: Series, low: Series, close: Series, len: number, context: any): number {
        const tr = Math.max(
            high.get(0) - low.get(0),
            Math.abs(high.get(0) - close.get(1)),
            Math.abs(low.get(0) - close.get(1))
        );
        if (isNaN(context.prev_atr)) context.prev_atr = tr;
        const atr = (context.prev_atr * (len - 1) + tr) / len;
        context.prev_atr = atr;
        return atr;
    }

    public static stdev(src: Series | number, len: number): number {
        if (typeof src === 'number') return 0;
        if (src.length < len || isNaN(src.get(len - 1))) return NaN;
        const avg = PineLibrary.sma(src, len);
        let sumSq = 0;
        for (let i = 0; i < len; i++) sumSq += Math.pow(src.get(i) - avg, 2);
        return Math.sqrt(sumSq / len);
    }

    public static highest(src: Series, len: number): number {
        let max = -Infinity;
        for (let i = 0; i < len; i++) {
            const v = src.get(i);
            if (!isNaN(v) && v > max) max = v;
        }
        return max === -Infinity ? NaN : max;
    }

    public static lowest(src: Series, len: number): number {
        let min = Infinity;
        for (let i = 0; i < len; i++) {
            const v = src.get(i);
            if (!isNaN(v) && v < min) min = v;
        }
        return min === Infinity ? NaN : min;
    }

    public static pivothigh(src: Series, left: number, right: number): number {
        const center = src.get(right);
        if (isNaN(center)) return NaN;
        for (let i = 0; i < left + right + 1; i++) {
            if (i === right) continue;
            if (src.get(i) >= center) return NaN;
        }
        return center;
    }

    public static pivotlow(src: Series, left: number, right: number): number {
        const center = src.get(right);
        if (isNaN(center)) return NaN;
        for (let i = 0; i < left + right + 1; i++) {
            if (i === right) continue;
            if (src.get(i) <= center) return NaN;
        }
        return center;
    }

    public static valuewhen(condition: boolean, source: any, occurrence: number, context: any, id: string): number {
        if (!context.vars[id]) context.vars[id] = { history: [] };
        if (condition) {
            const val = (source instanceof Series) ? source.get(0) : source;
            context.vars[id].history.unshift(val);
            if (context.vars[id].history.length > 10) context.vars[id].history.pop();
        }
        return context.vars[id].history[occurrence] ?? NaN;
    }

    public static barssince(condition: boolean, context: any, id: string): number {
        if (!context.vars[id]) context.vars[id] = { count: NaN };
        if (condition) context.vars[id].count = 0;
        else if (!isNaN(context.vars[id].count)) context.vars[id].count += 1;
        return context.vars[id].count;
    }

    public static change(src: Series, length: number = 1): number {
        return src.get(0) - src.get(length);
    }

    public static cum(val: number, context: any, id: string): number {
        if (!context.vars[id]) context.vars[id] = { sum: 0 };
        context.vars[id].sum += isNaN(val) ? 0 : val;
        return context.vars[id].sum;
    }

    // --- 🚀 繪圖物件支援 ---
    public static label_new(x: number, y: number, text: string, color: string, textcolor: string, style: string, ctx: any): any {
        const label = { type: 'label', x, y, text, color, textcolor, style, bar_index: ctx.bar_index };
        ctx.labels.push(label);
        return label;
    }

    public static box_new(left: number, top: number, right: number, bottom: number, border_color: string, bgcolor: string, ctx: any): any {
        const box = { type: 'box', left, top, right, bottom, border_color, bgcolor, bar_index: ctx.bar_index };
        ctx.boxes.push(box);
        return box;
    }

    public static box_set_right(box: any, right: number) {
        if (box) box.right = right;
    }

    public static box_delete(box: any, ctx: any) {
        if (!box) return;
        ctx.boxes = ctx.boxes.filter((b: any) => b !== box);
    }

    public static label_delete(label: any, ctx: any) {
        if (!label) return;
        ctx.labels = ctx.labels.filter((l: any) => l !== label);
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
        let idCounter = 0;
        let indentLevel = 0;

        // 🚀 輔助函式：提取的第一個參數 (保留字串引號，處理嵌套)
        const getFirstArgRaw = (inner: string) => {
            let depth = 0, quote = null, result = '';
            for (let i = 0; i < inner.length; i++) {
                const c = inner[i];
                if (quote) { if (c === quote) quote = null; result += c; }
                else if (c === "'" || c === '"') { quote = c; result += c; }
                else if (c === '(') { depth++; result += c; }
                else if (c === ')') { depth--; if (depth < 0) break; result += c; }
                else if (c === ',' && depth === 0) break;
                else result += c;
            }
            return result.trim();
        };

        lines.forEach(line => {
            let trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) return;

            // 🚀 0. 移除指標與類型宣告
            if (trimmed.startsWith('indicator(') || trimmed.startsWith('strategy(') || trimmed.startsWith('type ') || trimmed.startsWith('method ')) {
                jsLines.push('// ' + trimmed);
                return;
            }

            // 1. 處理函數定義 (f_name() => ...)
            if (trimmed.includes('=>')) {
                const parts = trimmed.split('=>');
                let head = parts[0].trim();
                const body = parts[1].trim();
                if (!head.includes('(')) head = `const ${head} = ()`;
                else head = `const ${head.replace('(', ' = (')}`;

                if (body) {
                    jsLines.push(`${head} => { return ${body} };`);
                } else {
                    jsLines.push(`${head} => {`);
                    indentLevel++;
                }
                return;
            }

            // 2. 徹底攔截 input 系統 (支援複雜字串與嵌套)
            trimmed = trimmed.replace(/input(?:\.\w+)?\s*\((.*)/g, (_match, rest) => {
                return getFirstArgRaw(rest);
            });

            // 3. 處理數學、顏色與關鍵字
            trimmed = trimmed.replace(/\bna\b/g, 'NaN');
            trimmed = trimmed.replace(/\bnot\b/g, '!');
            trimmed = trimmed.replace(/\band\b/g, '&&');
            trimmed = trimmed.replace(/\bor\b/g, '||');

            trimmed = trimmed.replace(/math\.max/g, 'Math.max');
            trimmed = trimmed.replace(/math\.min/g, 'Math.min');
            trimmed = trimmed.replace(/math\.abs/g, 'Math.abs');
            trimmed = trimmed.replace(/math\.sign/g, 'Math.sign');
            trimmed = trimmed.replace(/color\.new/g, '_PINE_LIB_.color_new');
            trimmed = trimmed.replace(/color\.rgb/g, '_PINE_LIB_.color_rgb');
            trimmed = trimmed.replace(/(#[0-9a-fA-F]{6,8})/g, '"$1"');

            // 4. 指標映射 (使用 _PINE_LIB_)
            trimmed = trimmed.replace(/ta\.sma\(([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.sma($1, $2)');
            trimmed = trimmed.replace(/ta\.ema\(([^,]+),\s*([^)]+)\)/g, `_PINE_LIB_.ema($1, $2, ctx.getVar('ema_${idCounter++}'))`);
            trimmed = trimmed.replace(/ta\.rma\(([^,]+),\s*([^)]+)\)/g, `_PINE_LIB_.rma($1, $2, ctx.getVar('rma_${idCounter++}'))`);
            trimmed = trimmed.replace(/ta\.wma\(([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.wma($1, $2)');
            trimmed = trimmed.replace(/ta\.vwma\(([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.vwma($1, volume, $2)');
            trimmed = trimmed.replace(/ta\.rsi\(([^,]+),\s*([^)]+)\)/g, `_PINE_LIB_.rsi($1, $2, ctx, 'rsi_${idCounter++}')`);
            trimmed = trimmed.replace(/ta\.crossover\(([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.crossover($1, $2)');
            trimmed = trimmed.replace(/ta\.crossunder\(([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.crossunder($1, $2)');
            trimmed = trimmed.replace(/ta\.atr\(([^)]+)\)/g, `_PINE_LIB_.atr(high, low, close, $1, ctx, 'atr_${idCounter++}')`);
            trimmed = trimmed.replace(/ta\.stdev\(([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.stdev($1, $2)');
            trimmed = trimmed.replace(/ta\.pivothigh\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.pivothigh($1, $2, $3)');
            trimmed = trimmed.replace(/ta\.pivotlow\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.pivotlow($1, $2, $3)');
            trimmed = trimmed.replace(/ta\.valuewhen\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, `_PINE_LIB_.valuewhen($1, $2, $3, ctx, 'vw_${idCounter++}')`);
            trimmed = trimmed.replace(/ta\.highest\(([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.highest($1, $2)');
            trimmed = trimmed.replace(/ta\.lowest\(([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.lowest($1, $2)');
            trimmed = trimmed.replace(/ta\.barssince\(([^)]+)\)/g, `_PINE_LIB_.barssince($1, ctx, 'bs_${idCounter++}')`);

            // 5. 繪圖映射
            trimmed = trimmed.replace(/label\.new\(([^,]+),\s*([^,]+),\s*(?:text=)?([^,]+)[^)]*\)/g, '_PINE_LIB_.label_new($1, $2, $3, "#fff", "#fff", "down", ctx)');
            trimmed = trimmed.replace(/box\.new\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+)[^)]*\)/g, '_PINE_LIB_.box_new($1, $2, $3, $4, "#fff", "rgba(255,255,255,0.1)", ctx)');

            // 6. 移除類型前綴
            trimmed = trimmed.replace(/^(?:float|int|bool|string|color|line|label|box|table)\s+/g, '');

            // 7. 語法結構與 := 處理
            trimmed = trimmed.replace(/([a-zA-Z_]\w*)\[(\d+)\]/g, (_match, p1, p2) => `(typeof ${p1} === 'object' && ${p1}.get ? ${p1}.get(${p2}) : NaN)`);
            trimmed = trimmed.replace(/plot\(([^,]+)[^)]*\)/g, 'ctx.plot($1)');
            trimmed = trimmed.replace(/([a-zA-Z_]\w*)\s*:=\s*(.*)/g, '$1 = $2; ctx.vars["$1"] = $1;');

            if (trimmed.startsWith('if ') && !trimmed.includes('{')) {
                const cond = trimmed.replace(/^if\s+/, '').trim();
                jsLines.push(`if (${cond}) {`);
                indentLevel++;
                return;
            }

            // 🚀 偵測賦值並自動補 let
            const isAssignment = (trimmed.includes('=') && !trimmed.includes('==') && !trimmed.includes('>') && !trimmed.includes('<') && !trimmed.includes('(')) || trimmed.startsWith('[');
            const isKnownDeclare = trimmed.startsWith('let') || trimmed.startsWith('const') || trimmed.startsWith('var');

            if (isAssignment && !isKnownDeclare && !trimmed.startsWith('if')) {
                trimmed = 'let ' + trimmed;
            }

            jsLines.push(trimmed + (trimmed.endsWith('{') ? '' : ';'));
        });

        while (indentLevel > 0) { jsLines.push('}'); indentLevel--; }

        const finalJS = jsLines.join('\n');
        console.log('[PineScriptEngine] Final Transpiled JS:\n', finalJS);
        return finalJS;
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

        const plotBuffers: Map<string, { data: number[], color: string }> = new Map();
        const labels: any[] = []; // 🚀 捕獲所有標籤
        const boxes: any[] = [];  // 🚀 捕獲所有盒子

        // 建立執行上下文
        const ctx = {
            open: seriesData.open,
            high: seriesData.high,
            low: seriesData.low,
            close: seriesData.close,
            volume: seriesData.volume,
            bar_index: 0,
            vars: {} as any,
            labels, 
            boxes,
            getVar: (key: string) => {
                if (!ctx.vars[key]) ctx.vars[key] = {};
                return ctx.vars[key];
            },
            plot: (val: any, title: string = 'Plot', color: string = '#2962ff') => {
                if (!plotBuffers.has(title)) {
                    plotBuffers.set(title, { data: new Array(size).fill(NaN), color });
                }
                const v = (val instanceof Series) ? val.get(0) : val;
                plotBuffers.get(title)!.data[ctx.bar_index] = v;
            }
        };

        // 🚀 終極沙盒物件注入 (Mock 進階 Pine 命名空間)
        const request = {
            security: (_s: string, _tf: string, src: any) => src
        };
        const table = {
            new: () => ({}),
            cell: () => {}
        };
        const syminfo = { tickerid: 'CURRENT' };
        const timeframe = { period: '60', is_intraday: true };
        const barstate = { islast: true, isconfirmed: true };

        const executeBar = new Function('ctx', '_PINE_LIB_', 'Math', 'close', 'open', 'high', 'low', 'volume', 'bar_index', 'request', 'table', 'syminfo', 'timeframe', 'barstate', compiledJs);

        for (let i = 0; i < size; i++) {
            ctx.bar_index = i;
            ctx.open.setCurrentIndex(i);
            ctx.high.setCurrentIndex(i);
            ctx.low.setCurrentIndex(i);
            ctx.close.setCurrentIndex(i);
            ctx.volume.setCurrentIndex(i);

            try {
                executeBar(ctx, PineLibrary, Math, ctx.close, ctx.open, ctx.high, ctx.low, ctx.volume, ctx.bar_index, request, table, syminfo, timeframe, barstate);
            } catch (e) {
                // 忽略 Bar 級別錯誤
            }
        }
        // 整理結果 (包含線條與繪圖物件)
        const finalPlots: any[] = [];
        plotBuffers.forEach((info, title) => {
            finalPlots.push({ type: 'plot', data: info.data, title, color: info.color });
        });

        return {
            plots: finalPlots,
            labels: ctx.labels,
            boxes: ctx.boxes
        };
    }
}
