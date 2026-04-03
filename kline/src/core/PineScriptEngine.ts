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

    public static sma(src: Series, len: number): number {
        if (src.length < len || isNaN(src.get(len - 1))) return NaN;
        let sum = 0;
        for (let i = 0; i < len; i++) sum += src.get(i);
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

    public static rsi(src: Series, len: number, context: any, id: string): number {
        if (!context.vars[id]) context.vars[id] = { rsi_up: 0, rsi_down: 0, initialized: false };
        const state = context.vars[id];
        const diff = src.get(0) - src.get(1);
        const up = diff > 0 ? diff : 0;
        const down = diff < 0 ? -diff : 0;

        if (!state.initialized) {
            state.rsi_up = up;
            state.rsi_down = down;
            state.initialized = true;
            return NaN;
        }

        state.rsi_up = (state.rsi_up * (len - 1) + up) / len;
        state.rsi_down = (state.rsi_down * (len - 1) + down) / len;

        if (state.rsi_down === 0) return 100;
        const rs = state.rsi_up / state.rsi_down;
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

    public static atr(high: Series, low: Series, close: Series, len: number, context: any, id: string): number {
        if (!context.vars[id]) context.vars[id] = { prev_atr: NaN };
        const state = context.vars[id];
        const tr = Math.max(
            high.get(0) - low.get(0),
            Math.abs(high.get(0) - close.get(1)),
            Math.abs(low.get(0) - close.get(1))
        );
        if (isNaN(state.prev_atr)) state.prev_atr = tr;
        const atr = (state.prev_atr * (len - 1) + tr) / len;
        state.prev_atr = atr;
        return atr;
    }

    public static stdev(src: Series | number, len: number): number {
        if (typeof src === 'number' || src.length < len) return 0;
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

    public static color_new(c: string, a: number): string { return c; }
    public static color_rgb(r: number, g: number, b: number, a?: number): string { return `rgb(${r},${g},${b})`; }

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
}

// --- 3. 引擎核心 ---
export class PineScriptEngine {
    private plots: Map<string, { data: number[], color: string, title: string }> = new Map();

    constructor() {}

    public compile(code: string): string {
        const rawLines = code.split('\n');
        let jsLines: string[] = [];
        let idCounter = 0;
        const indentStack: number[] = [0];

        const getFirstArgClean = (inner: string) => {
            const defvalMatch = inner.match(/defval\s*=\s*([^,)]+)/);
            if (defvalMatch) return defvalMatch[1].trim();
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
            let final = result.trim();
            if (final.includes('=') && !final.startsWith('"') && !final.startsWith("'")) {
                const parts = final.split('=');
                final = parts[parts.length - 1].trim();
            }
            return final;
        };

        rawLines.forEach(line => {
            const currentIndent = line.match(/^\s*/)?.[0].length || 0;
            let trimmed = line.trim();

            while (currentIndent < indentStack[indentStack.length - 1]) {
                jsLines.push('}');
                indentStack.pop();
            }

            if (!trimmed || trimmed.startsWith('//')) return;

            if (trimmed.startsWith('indicator(') || trimmed.startsWith('strategy(') || trimmed.startsWith('type ') || trimmed.startsWith('method ') || trimmed.startsWith('export ')) {
                jsLines.push('// ' + trimmed);
                return;
            }

            if (trimmed.startsWith('switch')) {
                jsLines.push('// [SWITCH_SKIP] ' + trimmed);
                jsLines.push('let _sw_val = NaN;');
                return;
            }

            if (trimmed.includes('=>')) {
                const parts = trimmed.split('=>');
                let head = parts[0].trim();
                const body = parts[1].trim();
                if (head.includes('(')) {
                    head = head.replace('(', ' = (');
                    if (body) {
                        jsLines.push(`const ${head} => { return ${body} };`);
                    } else {
                        jsLines.push(`const ${head} => {`);
                        indentStack.push(currentIndent + 1);
                    }
                } else {
                    jsLines.push('// ' + trimmed);
                }
                return;
            }

            trimmed = trimmed.replace(/input(?:\.\w+)?\s*\((.*)/g, (_m, rest) => getFirstArgClean(rest));
            
            trimmed = trimmed.replace(/ta\.sma\(([^,]+),\s*([^)]+)\)/g, '_PINE_LIB_.sma($1, $2)');
            trimmed = trimmed.replace(/ta\.ema\(([^,]+),\s*([^)]+)\)/g, `_PINE_LIB_.ema($1, $2, ctx.getVar('ema_${idCounter++}'))`);
            trimmed = trimmed.replace(/ta\.rma\(([^,]+),\s*([^)]+)\)/g, `_PINE_LIB_.rma($1, $2, ctx.getVar('rma_${idCounter++}'))`);
            trimmed = trimmed.replace(/ta\.rsi\(([^,]+),\s*([^)]+)\)/g, `_PINE_LIB_.rsi($1, $2, ctx, 'rsi_${idCounter++}')`);
            trimmed = trimmed.replace(/ta\.atr\(([^)]+)\)/g, `_PINE_LIB_.atr(high, low, close, $1, ctx, 'atr_${idCounter++}')`);
            trimmed = trimmed.replace(/ta\.barssince\(([^)]+)\)/g, `_PINE_LIB_.barssince($1, ctx, 'bs_${idCounter++}')`);
            trimmed = trimmed.replace(/ta\.valuewhen\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, `_PINE_LIB_.valuewhen($1, $2, $3, ctx, 'vw_${idCounter++}')`);
            
            trimmed = trimmed.replace(/\bna\s*\(([^)]+)\)/g, 'isNaN($1)'); 
            trimmed = trimmed.replace(/\bna\b/g, 'NaN');
            trimmed = trimmed.replace(/\bnot\b/g, '!');
            trimmed = trimmed.replace(/\band\b/g, '&&');
            trimmed = trimmed.replace(/\bor\b/g, '||');
            trimmed = trimmed.replace(/math\./g, 'Math.');
            trimmed = trimmed.replace(/color\.new/g, '_PINE_LIB_.color_new');
            trimmed = trimmed.replace(/(#[0-9a-fA-F]{6,8})/g, '"$1"');

            if (trimmed.startsWith('else if ')) {
                const cond = trimmed.replace(/^else if\s+/, '').trim();
                jsLines.push(`} else if (${cond}) {`);
                return;
            } else if (trimmed.startsWith('else')) {
                jsLines.push('} else {');
                return;
            } else if (trimmed.startsWith('if ') && !trimmed.includes('{')) {
                const cond = trimmed.replace(/^if\s+/, '').trim();
                jsLines.push(`if (${cond}) {`);
                indentStack.push(currentIndent + 1);
                return;
            }

            trimmed = trimmed.replace(/plot\(([^,]+)[^)]*\)/g, 'ctx.plot($1)');
            if (trimmed.match(/^var\s+/)) {
                trimmed = trimmed.replace(/^var\s+(?:bool|int|float|string|color)?\s*([a-zA-Z_]\w*)\s*=\s*(.*)/, `if (ctx.vars['$1'] === undefined) ctx.vars['$1'] = $2; let $1 = ctx.vars['$1']`);
                jsLines.push(trimmed + ';');
                return;
            }

            trimmed = trimmed.replace(/([a-zA-Z_]\w*)\s*:=\s*(.*)/g, '$1 = $2; ctx.vars["$1"] = $1;');
            trimmed = trimmed.replace(/:=/g, '=');

            const isKnownDeclare = trimmed.startsWith('let ') || trimmed.startsWith('const ') || trimmed.startsWith('var ') || trimmed.startsWith('if ') || trimmed.startsWith('//');
            const isAssignment = (/^[a-zA-Z_]\w*\s*=/.test(trimmed) || /^\[.*\]\s*=/.test(trimmed)) && !isKnownDeclare;
            if (isAssignment) {
                trimmed = 'let ' + trimmed;
            }

            jsLines.push(trimmed + (trimmed.endsWith('{') ? '' : ';'));
        });

        while (indentStack.length > 1) { jsLines.push('}'); indentStack.pop(); }

        return jsLines.join('\n');
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
        const labels: any[] = [];
        const boxes: any[] = [];

        const ctx = {
            open: seriesData.open, high: seriesData.high, low: seriesData.low, close: seriesData.close, volume: seriesData.volume,
            bar_index: 0, vars: {} as any, labels, boxes,
            getVar: (key: string) => { if (!ctx.vars[key]) ctx.vars[key] = {}; return ctx.vars[key]; },
            plot: (val: any, title: string = 'Plot', color: string = '#2962ff') => {
                if (!plotBuffers.has(title)) plotBuffers.set(title, { data: new Array(size).fill(NaN), color });
                const v = (val instanceof Series) ? val.get(0) : val;
                plotBuffers.get(title)!.data[ctx.bar_index] = v;
            }
        };

        const request = { security: (_s: string, _tf: string, src: any) => src };
        const table = { 
            new: () => ({}), cell: () => {}, set_border_width: () => {}, set_frame_width: () => {}, 
            set_border_color: () => {}, set_frame_color: () => {}, merge_cells: () => {}, set_position: () => {} 
        };
        const syminfo = { tickerid: 'CURRENT' };
        const timeframe = { period: '60', is_intraday: true };
        const barstate = { islast: true, isconfirmed: true };
        const position = { top_right: 'tr', bottom_right: 'br', top_left: 'tl', bottom_left: 'bl', middle_center: 'mc' };
        const pSize = { tiny: 'tiny', small: 'small', normal: 'normal', large: 'large', huge: 'huge' };
        const str = { tostring: (v: any) => String(v) };
        const color = { new: (c: any, a: any) => c, white: '#fff', black: '#000', red: '#f00', green: '#0f0', gray: '#888' };
        const barmerge = { gaps_off: 0, gaps_on: 1 };
        const display = { all: 1, none: 0 };
        const shape = { labelup: 'up', labeldown: 'down', square: 'sq', xcross: 'x' };
        const location = { belowbar: 'below', abovebar: 'above', bottom: 'bottom', top: 'top' };
        const yloc = { belowbar: 'below', abovebar: 'above', price: 'price' };

        const executeBar = new Function('ctx', '_PINE_LIB_', 'Math', 'close', 'open', 'high', 'low', 'volume', 'bar_index', 
            'request', 'table', 'syminfo', 'timeframe', 'barstate', 'position', 'size', 'str', 'color', 'barmerge', 'display', 'shape', 'location', 'yloc', 
            compiledJs);

        for (let i = 0; i < size; i++) {
            ctx.bar_index = i;
            ctx.open.setCurrentIndex(i); ctx.high.setCurrentIndex(i); ctx.low.setCurrentIndex(i); ctx.close.setCurrentIndex(i); ctx.volume.setCurrentIndex(i);
            try {
                executeBar(ctx, PineLibrary, Math, ctx.close, ctx.open, ctx.high, ctx.low, ctx.volume, ctx.bar_index, 
                    request, table, syminfo, timeframe, barstate, position, pSize, str, color, barmerge, display, shape, location, yloc);
            } catch (e) { }
        }
        
        const finalPlots: any[] = [];
        plotBuffers.forEach((info, title) => {
            finalPlots.push({ type: 'plot', data: info.data, title, color: info.color });
        });

        return { plots: finalPlots, labels: ctx.labels, boxes: ctx.boxes };
    }
}
