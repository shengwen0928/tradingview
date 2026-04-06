import { ViewportEngine } from '../services/ViewportEngine';
import { ScaleEngine } from '../engines/ScaleEngine';
import { RenderEngine } from './RenderEngine';
import { DataManager } from '../services/DataManager';
import { PriceAnimator } from './PriceAnimator';
import { IndicatorController } from '../engines/IndicatorController';
import { DrawingEngine } from '../interaction/DrawingEngine';
import { CrosshairController } from '../interaction/CrosshairController';
import { ChartType, Candle } from '../../types/Candle';
import { DataTransformer } from '../engines/DataTransformer';

export class RenderPipeline {
    private chartType: ChartType = 'candles';
    private visualCandles: Candle[] = [];
    private lastDataHash: string = '';

    constructor(
        private viewport: ViewportEngine,
        private scaleEngine: ScaleEngine,
        private renderEngine: RenderEngine,
        private priceAnimator: PriceAnimator,
        private indicatorController: IndicatorController,
        private drawingEngine: DrawingEngine,
        private crosshairController: CrosshairController
    ) {}

    public setChartType(type: ChartType) {
        this.chartType = type;
    }

    public execute(activeManager: DataManager, requestRedraw: () => void) {
        let rawCandles = activeManager.getCandles();
        if (rawCandles.length === 0) return;

        // 🚀 核心：數據轉換攔截 (非線性 X 軸處理)
        const isNonLinear = ['renko', 'line_break', 'kagi', 'point_and_figure'].includes(this.chartType);
        const dataHash = `${this.chartType}_${rawCandles.length}_${rawCandles[rawCandles.length-1]?.time}`;
        
        if (isNonLinear) {
            if (this.lastDataHash !== dataHash) {
                this.visualCandles = DataTransformer.transform(rawCandles, this.chartType);
                this.viewport.setDataCount(this.visualCandles.length, true);
                this.lastDataHash = dataHash;
            }
        } else {
            this.visualCandles = rawCandles;
            this.viewport.setDataCount(rawCandles.length, false);
            this.lastDataHash = dataHash;
        }

        const candles = this.visualCandles;
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
        this.renderEngine.drawAxes(visible, startIndex, cw, 2, (idx: number) => {
            // 在非線性模式下，時間標籤應從虛擬數據中獲取
            return candles[idx]?.time || NaN;
        }, this.scaleEngine);
        
        // 3. 渲染數據層 (Main Chart, Indicators)
        this.renderEngine.drawMainChart(this.chartType, visible, start, startIndex, cw, 2, this.scaleEngine, visualPrice);
        
        // 只有在線性模式下才運行指標 (進階圖表通常有自己的指標系統)
        if (!isNonLinear) {
            const indicatorResult = this.indicatorController.run(candles);
            this.renderEngine.drawIndicators(indicatorResult.plots, start, end, startIndex, cw, 2, this.scaleEngine);
            this.renderEngine.drawIndicatorLabels(indicatorResult.labels, startIndex, cw, 2, this.scaleEngine);
            this.renderEngine.drawIndicatorBoxes(indicatorResult.boxes, startIndex, cw, 2, this.scaleEngine);
        }
        
        // 4. 計算畫面內最高最低點
        let maxHigh = -Infinity, minLow = Infinity;
        let maxIdx = -1, minIdx = -1;
        const scanStart = Math.max(0, Math.floor(start));
        const scanEnd = Math.min(candles.length, Math.ceil(end));

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

        // 5. 渲染互動層 (Drawings, Crosshair)
        if (!isNonLinear) {
            this.drawingEngine.render(this.renderEngine.getOverlayContext(), this.scaleEngine, startIndex, cw, 2, (t: number) => activeManager.getIndexAtTime(t), this.crosshairController.getHoveredDrawingId());
        }
        this.crosshairController.draw(activeManager);

        // 6. 渲染價格線
        this.renderEngine.drawLastPriceLine(visualPrice, visualPrice >= lastCandle.open ? '#26a69a' : '#ef5350', this.scaleEngine);
    }
}
