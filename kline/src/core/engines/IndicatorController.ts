import { PineScriptEngine } from './PineScriptEngine';
import { Candle } from '../../types/Candle';

export class IndicatorController {
    constructor(private pineEngine: PineScriptEngine) {}

    public run(candles: Candle[]): { plots: any[], labels: any[], boxes: any[] } {
        const script = localStorage.getItem('pine-script-default') || 'plot(close, "Close", "#2962ff")';
        try {
            const compiledJs = this.pineEngine.compile(script);
            return this.pineEngine.run(candles, compiledJs);
        } catch (e) {
            console.error('[IndicatorController] Compilation error:', e);
            return { plots: [], labels: [], boxes: [] };
        }
    }
}
