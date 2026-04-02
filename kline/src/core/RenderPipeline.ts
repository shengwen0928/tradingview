import { ViewportEngine } from './ViewportEngine';
import { ScaleEngine } from './ScaleEngine';
import { RenderEngine } from './RenderEngine';
import { DataManager } from './DataManager';
import { PriceAnimator } from './PriceAnimator';
import { IndicatorController } from './IndicatorController';
import { DrawingEngine } from './DrawingEngine';
import { CrosshairController } from './CrosshairController';

export class RenderPipeline {
    constructor(
        private viewport: ViewportEngine,
        private scaleEngine: ScaleEngine,
        private renderEngine: RenderEngine,
        private priceAnimator: PriceAnimator,
        private indicatorController: IndicatorController,
        private drawingEngine: DrawingEngine,
        private crosshairController: CrosshairController
    ) {}

    public execute(activeManager: DataManager, requestRedraw: () => void) {
        const candles = activeManager.getCandles();
        if (candles.length === 0) return;

        const { start, end } = this.viewport.getVisibleRange();
        const { startIndex } = this.viewport.getRawRange();
        const visible = candles.slice(start, end);
        const cw = this.viewport.getCandleWidth();
        const lastCandle = candles[candles.length - 1];

        // 1. 動態更新價格平滑
        const visualPrice = this.priceAnimator.update(lastCandle.close, requestRedraw);
        
        // 2. 更新與渲染背景層 (Grid, Axes)
        this.scaleEngine.updateScale(visible);
        this.renderEngine.drawGrid(this.scaleEngine);
        this.renderEngine.drawAxes(visible, startIndex, cw, 2, (idx: number) => activeManager.getTimeAtIndex(idx), this.scaleEngine);
        
        // 3. 渲染數據層 (Candles, Indicators)
        this.renderEngine.drawCandles(visible, start, startIndex, cw, 2, this.scaleEngine, visualPrice);
        
        const indicatorResult = this.indicatorController.run(candles);
        this.renderEngine.drawIndicators(indicatorResult.plots, start, end, startIndex, cw, 2, this.scaleEngine);
        this.renderEngine.drawIndicatorLabels(indicatorResult.labels, startIndex, cw, 2, this.scaleEngine);
        this.renderEngine.drawIndicatorBoxes(indicatorResult.boxes, startIndex, cw, 2, this.scaleEngine);
        
        // 🚀 核心：計算畫面內最高最低點並標註 (使用精確的 rawRange 提升靈敏度)
        const { startIndex: rawStart, endIndex: rawEnd } = this.viewport.getRawRange();
        let maxHigh = -Infinity, minLow = Infinity;
        let maxIdx = -1, minIdx = -1;
        
        const scanStart = Math.max(0, Math.floor(rawStart));
        const scanEnd = Math.min(candles.length, Math.ceil(rawEnd));

        for (let i = scanStart; i < scanEnd; i++) {
            const c = candles[i];
            if (c.high > maxHigh) { maxHigh = c.high; maxIdx = i; }
            if (c.low < minLow) { minLow = c.low; minIdx = i; }
        }

        this.renderEngine.drawMinMaxLabels(
            { price: maxHigh, index: maxIdx }, 
            { price: minLow, index: minIdx }, 
            startIndex, cw, 2, this.scaleEngine
        );

        // 4. 渲染互動層 (Drawings, Crosshair)
        this.drawingEngine.render(this.renderEngine.getOverlayContext(), this.scaleEngine, startIndex, cw, 2, (t: number) => activeManager.getIndexAtTime(t), this.crosshairController.getHoveredDrawingId());
        this.crosshairController.draw(activeManager);

        // 5. 渲染價格線
        this.renderEngine.drawLastPriceLine(visualPrice, visualPrice >= lastCandle.open ? '#26a69a' : '#ef5350', this.scaleEngine);
    }
}
