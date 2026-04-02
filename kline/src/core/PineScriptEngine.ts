import { Candle } from '../types/Candle';

/**
 * 🌲 Pine Script V6 專業執行引擎 (進化版 - 支援進階語法與標準庫)
 */

export class Series {
    private data: number[] = [];
    private currentIndex: number = 0;

    constructor(initialData: number[] = []) {
        this.data = initialData;
    }
    public push(value: number) { this.data.push(value); }
    public setCurrentIndex(index: number) { this.currentIndex = index; }
    public get(offset: number = 0): number {
        const target = this.currentIndex - offset;
        return (target >= 0 && target < this.data.length) ? this.data[target] : NaN;
    }
    public set(val: number) { this.data[this.currentIndex] = val; }
    public get raw(): number[] { return this.data; }
    public get length(): number { return this.data.length; }
}

class PineLibrary {
    public static nz(val: any, replacement: number = 0): number { return isNaN(val) || val === null || val === undefined ? replacement : val; }
    
    public static sma(src: Series, len: number): number {
        if (src.length < len || isNaN(src.get(len - 1))) return NaN;
        let sum = 0; for (let i = 0; i < len; i++) sum += src.get(i);
        return sum / len;
    }
    
    public static ema(src: Series, len: number, prevEMA: number): number {
        const alpha = 2 / (len + 1);
        const current = src.get(0);
        if (isNaN(prevEMA)) return current;
        return (current - prevEMA) * alpha + prevEMA;
    }
    
    public static rma(src: Series, len: number, prevRMA: number): number {
        const alpha = 1 / len;
        const current = src.get(0);
        if (isNaN(prevRMA)) return current;
        return (current - prevRMA) * alpha + prevRMA;
    }
    
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

    public static vwma(src: Series, vol: Series, len: number): number {
        if (src.length < len || vol.length < len) return NaN;
        let sumVol = 0, sumSrcVol = 0;
        for (let i = 0; i < len; i++) {
            sumVol += vol.get(i);
            sumSrcVol += src.get(i) * vol.get(i);
        }
        return sumSrcVol / sumVol;
    }

    public static rsi(src: Series, len: number, ctx: any, id: string): number {
        if (!ctx.vars[id]) ctx.vars[id] = { up: 0, down: 0 };
        const diff = src.get(0) - src.get(1);
        let up = diff > 0 ? diff : 0, down = diff < 0 ? -diff : 0;
        ctx.vars[id].up = (ctx.vars[id].up * (len - 1) + up) / len;
        ctx.vars[id].down = (ctx.vars[id].down * (len - 1) + down) / len;
        const rs = ctx.vars[id].up / ctx.vars[id].down;
        return 100 - (100 / (1 + rs));
    }
    
    public static cross(src1: Series | number, src2: Series | number): boolean {
        const val1 = typeof src1 === 'number' ? src1 : src1.get(0);
        const val2 = typeof src2 === 'number' ? src2 : src2.get(0);
        const prev1 = typeof src1 === 'number' ? src1 : src1.get(1);
        const prev2 = typeof src2 === 'number' ? src2 : src2.get(1);
        return (val1 > val2 && prev1 <= prev2) || (val1 < val2 && prev1 >= prev2);
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
    
    public static atr(high: Series, low: Series, close: Series, len: number, ctx: any, id: string): number {
        if (!ctx.vars[id]) ctx.vars[id] = { prevAtr: NaN };
        const tr = Math.max(high.get(0) - low.get(0), Math.abs(high.get(0) - close.get(1)), Math.abs(low.get(0) - close.get(1)));
        const prevAtr = ctx.vars[id].prevAtr;
        const atr = isNaN(prevAtr) ? tr : (prevAtr * (len - 1) + tr) / len; // RMA 平滑
        ctx.vars[id].prevAtr = atr;
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
    
    public static valuewhen(condition: boolean, source: number, occurrence: number, ctx: any, id: string): number {
        if (!ctx.vars[id]) ctx.vars[id] = { history: [] };
        if (condition) ctx.vars[id].history.unshift(source);
        if (ctx.vars[id].history.length > occurrence) return ctx.vars[id].history[occurrence];
        return NaN;
    }
    
    public static change(src: Series, length: number = 1): number { return src.get(0) - src.get(length); }
    
    public static cum(val: number, ctx: any, id: string): number {
        if (!ctx.vars[id]) ctx.vars[id] = { sum: 0 };
        ctx.vars[id].sum += isNaN(val) ? 0 : val;
        return ctx.vars[id].sum;
    }
    
    public static highest(src: Series, len: number): number {
        let max = -Infinity;
        for (let i = 0; i < len; i++) { const v = src.get(i); if (!isNaN(v) && v > max) max = v; }
        return max === -Infinity ? NaN : max;
    }
    
    public static lowest(src: Series, len: number): number {
        let min = Infinity;
        for (let i = 0; i < len; i++) { const v = src.get(i); if (!isNaN(v) && v < min) min = v; }
        return min === Infinity ? NaN : min;
    }
    
    public static barssince(condition: boolean, ctx: any, id: string): number {
        if (!ctx.vars[id]) ctx.vars[id] = { count: NaN };
        if (condition) ctx.vars[id].count = 0;
        else if (!isNaN(ctx.vars[id].count)) ctx.vars[id].count += 1;
        return ctx.vars[id].count;
    }

    public static color_new(hex: string, _transp: number): string {
        return hex; 
    }
    public static color_rgb(r: number, g: number, b: number, t: number = 0): string {
        return `rgba(${r},${g},${b},${1 - t/100})`;
    }
}

export class PineScriptEngine {
    private plots: Map<string, { data: number[], color: string, title: string }> = new Map();
    
    constructor() {}

    /**
     * 🚀 增強版轉譯器 (Transpiler)
     * 能解析 TradingView 的標準庫、變數狀態、與各種輸入宣告
     */
    public compile(code: string): string {
        let lines = code.split('\n');
        let jsLines: string[] = [];
        let idCounter = 0;

        lines.forEach(line => {
            let trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) return;

            // 1. 過濾與 Mock 處理 V6 複雜物件類型
            if (trimmed.startsWith('type ') || trimmed.startsWith('array.') || trimmed.startsWith('box.') || trimmed.startsWith('label.') || trimmed.startsWith('table.') || trimmed.startsWith('alert') || trimmed.startsWith('strategy')) {
                jsLines.push('/* [Unsupported V6 Object/Type/Alert Mocked] ' + trimmed.replace(/\/\*|\*\//g, '') + ' */'); 
                return;
            }

            // 2. 處理 input 系統 (Mock 預設值)
            trimmed = trimmed.replace(/input\.bool\(([^,]+)[^)]*\)/g, '$1');
            trimmed = trimmed.replace(/input\.int\(([^,]+)[^)]*\)/g, '$1');
            trimmed = trimmed.replace(/input\.float\(([^,]+)[^)]*\)/g, '$1');
            trimmed = trimmed.replace(/input\.string\(([^,]+)[^)]*\)/g, '$1');
            trimmed = trimmed.replace(/input\.source\(([^,]+)[^)]*\)/g, '$1');
            trimmed = trimmed.replace(/input\.timeframe\(([^,]+)[^)]*\)/g, '$1');
            trimmed = trimmed.replace(/input\(([^,]+)[^)]*\)/g, '$1');

            // 3. 處理 color.* 與 math.*
            trimmed = trimmed.replace(/color\.new/g, 'Lib.color_new');
            trimmed = trimmed.replace(/color\.rgb/g, 'Lib.color_rgb');
            trimmed = trimmed.replace(/color\.([a-zA-Z]+)/g, '"$1"');
            trimmed = trimmed.replace(/math\.max/g, 'Math.max');
            trimmed = trimmed.replace(/math\.min/g, 'Math.min');
            trimmed = trimmed.replace(/math\.abs/g, 'Math.abs');
            trimmed = trimmed.replace(/math\.sign/g, 'Math.sign');

            // 4. 處理 ta.* 技術指標轉換為 Lib.*
            trimmed = trimmed.replace(/ta\.sma\(([^,]+),\s*([^)]+)\)/g, 'Lib.sma($1, $2)');
            trimmed = trimmed.replace(/ta\.ema\(([^,]+),\s*([^)]+)\)/g, `Lib.ema($1, $2, ctx.getVar('ema_${idCounter++}'))`);
            trimmed = trimmed.replace(/ta\.rma\(([^,]+),\s*([^)]+)\)/g, `Lib.rma($1, $2, ctx.getVar('rma_${idCounter++}'))`);
            trimmed = trimmed.replace(/ta\.wma\(([^,]+),\s*([^)]+)\)/g, 'Lib.wma($1, $2)');
            trimmed = trimmed.replace(/ta\.vwma\(([^,]+),\s*([^)]+)\)/g, 'Lib.vwma($1, ctx.volume, $2)');
            trimmed = trimmed.replace(/ta\.rsi\(([^,]+),\s*([^)]+)\)/g, `Lib.rsi($1, $2, ctx, 'rsi_${idCounter++}')`);
            trimmed = trimmed.replace(/ta\.cross\(([^,]+),\s*([^)]+)\)/g, 'Lib.cross($1, $2)');
            trimmed = trimmed.replace(/ta\.crossover\(([^,]+),\s*([^)]+)\)/g, 'Lib.crossover($1, $2)');
            trimmed = trimmed.replace(/ta\.crossunder\(([^,]+),\s*([^)]+)\)/g, 'Lib.crossunder($1, $2)');
            trimmed = trimmed.replace(/ta\.atr\(([^)]+)\)/g, `Lib.atr(ctx.high, ctx.low, ctx.close, $1, ctx, 'atr_${idCounter++}')`);
            trimmed = trimmed.replace(/ta\.stdev\(([^,]+),\s*([^)]+)\)/g, 'Lib.stdev($1, $2)');
            trimmed = trimmed.replace(/ta\.pivothigh\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, 'Lib.pivothigh($1, $2, $3)');
            trimmed = trimmed.replace(/ta\.pivotlow\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, 'Lib.pivotlow($1, $2, $3)');
            trimmed = trimmed.replace(/ta\.valuewhen\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, `Lib.valuewhen($1, $2, $3, ctx, 'vw_${idCounter++}')`);
            trimmed = trimmed.replace(/ta\.change\(([^,]+)(?:,\s*([^)]+))?\)/g, 'Lib.change($1, $2)');
            trimmed = trimmed.replace(/ta\.cum\(([^)]+)\)/g, `Lib.cum($1, ctx, 'cum_${idCounter++}')`);
            trimmed = trimmed.replace(/ta\.highest\(([^,]+),\s*([^)]+)\)/g, 'Lib.highest($1, $2)');
            trimmed = trimmed.replace(/ta\.lowest\(([^,]+),\s*([^)]+)\)/g, 'Lib.lowest($1, $2)');
            trimmed = trimmed.replace(/ta\.barssince\(([^)]+)\)/g, `Lib.barssince($1, ctx, 'bs_${idCounter++}')`);

            // 5. 處理 var 狀態初始化與賦值 (:=)
            if (trimmed.match(/^var\s+(bool|int|float|string|color)\s+([a-zA-Z_]\w*)\s*=\s*(.*)/)) {
                trimmed = trimmed.replace(/^var\s+(bool|int|float|string|color)\s+([a-zA-Z_]\w*)\s*=\s*(.*)/, `if (ctx.vars['$2'] === undefined) ctx.vars['$2'] = $3; let $2 = ctx.vars['$2'];`);
            } else if (trimmed.match(/^var\s+([a-zA-Z_]\w*)\s*=\s*(.*)/)) {
                trimmed = trimmed.replace(/^var\s+([a-zA-Z_]\w*)\s*=\s*(.*)/, `if (ctx.vars['$1'] === undefined) ctx.vars['$1'] = $2; let $1 = ctx.vars['$1'];`);
            }
            
            // 將 := 轉為標準 JS 賦值
            trimmed = trimmed.replace(/([a-zA-Z_]\w*)\s*:=\s*(.*)/g, '$1 = $2; ctx.vars["$1"] = $1;');

            // 6. 處理標準賦值宣告 (自動補上 let)
            if (trimmed.includes('=') && !trimmed.includes('==') && !trimmed.includes('!=') && !trimmed.includes('>=') && !trimmed.includes('<=') && !trimmed.startsWith('if') && !trimmed.startsWith('let') && !trimmed.startsWith('ctx.') && !trimmed.startsWith('plot')) {
                 if (trimmed.startsWith('[')) {
                     trimmed = 'let ' + trimmed; // 多重賦值 [a, b] = ...
                 } else {
                     let varName = trimmed.split('=')[0].trim();
                     trimmed = `let ${varName} = ` + trimmed.substring(trimmed.indexOf('=') + 1);
                 }
            }

            // 7. 歷史陣列索引轉換 [] -> .get()
            trimmed = trimmed.replace(/([a-zA-Z_]\w*)\[(\d+)\]/g, (_match, p1, p2) => {
                return `(typeof ${p1} === 'object' && ${p1}.get ? ${p1}.get(${p2}) : NaN)`;
            });

            // 8. Plot 轉換
            trimmed = trimmed.replace(/plot\(([^,]+),\s*([^,]+),\s*color=([^,)]+)[^)]*\)/g, 'ctx.plot($1, $2, $3)');
            trimmed = trimmed.replace(/plot\(([^,]+)[^)]*\)/g, 'ctx.plot($1)');

            jsLines.push(trimmed + (trimmed.endsWith('{') || trimmed.endsWith('}') ? '' : ';'));
        });

        const finalJS = `
            try {
                ${jsLines.join('\n')}
            } catch (e) {
                // Mock Transpiler 錯誤忽略
            }
        `;
        return finalJS;
    }

    public run(candles: Candle[], compiledJs: string) {
        this.plots.clear();

        const size = candles.length;
        const seriesData = {
            open: new Series(candles.map(c => c.open)),
            high: new Series(candles.map(c => c.high)),
            low: new Series(candles.map(c => c.low)),
            close: new Series(candles.map(c => c.close)),
            volume: new Series(candles.map(c => c.volume))
        };

        const plotBuffers: Map<string, { data: number[], color: string }> = new Map();

        const ctx = {
            open: seriesData.open,
            high: seriesData.high,
            low: seriesData.low,
            close: seriesData.close,
            volume: seriesData.volume,
            bar_index: 0,
            vars: {} as any, // 🚀 全域狀態儲存區
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

        const executeBar = new Function('ctx', 'Lib', 'Math', 'close', 'open', 'high', 'low', 'volume', compiledJs);

        // 逐根掃描執行
        for (let i = 0; i < size; i++) {
            ctx.bar_index = i;
            ctx.open.setCurrentIndex(i);
            ctx.high.setCurrentIndex(i);
            ctx.low.setCurrentIndex(i);
            ctx.close.setCurrentIndex(i);
            ctx.volume.setCurrentIndex(i);

            // 執行當前 K 棒的腳本
            executeBar(ctx, PineLibrary, Math, ctx.close, ctx.open, ctx.high, ctx.low, ctx.volume);
        }

        const finalPlots: any[] = [];
        plotBuffers.forEach((info, title) => {
            finalPlots.push({ data: info.data, title, color: info.color });
        });

        return finalPlots;
    }
}
