import { DataManager } from '../services/DataManager';
import { ViewportEngine } from '../services/ViewportEngine';
import { ScaleEngine } from '../engines/ScaleEngine';

export class MagnetService {
    constructor(
        private viewport: ViewportEngine,
        private scaleEngine: ScaleEngine
    ) {}

    public getSnapProvider(activeManager: DataManager) {
        return (mouseX: number, mouseY: number, mode: 'weak' | 'strong') => {
            const candles = activeManager.getCandles();
            const candleWidth = this.viewport.getCandleWidth();
            const spacing = 2;
            const { startIndex } = this.viewport.getRawRange();
            
            const index = Math.round(mouseX / (candleWidth + spacing) + startIndex);
            const candle = candles[index];
            if (!candle) return null;

            const centerX = (index - startIndex) * (candleWidth + spacing) + candleWidth / 2;
            const prices = [candle.high, candle.low, candle.open, candle.close];
            const points = prices.map(p => ({ x: centerX, y: this.scaleEngine.priceToY(p) }));
            
            let closest = points[0];
            let minDist = Infinity;
            points.forEach(pt => {
                const d = Math.abs(pt.y - mouseY);
                if (d < minDist) { minDist = d; closest = pt; }
            });

            if (mode === 'weak' && (minDist > 30 || Math.abs(centerX - mouseX) > 20)) return null;
            return closest;
        };
    }
}
