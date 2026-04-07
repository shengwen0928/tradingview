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

    /**
     * 🚀 渲染管線執行核心
     */
    public execute(activeManager: DataManager, requestRedraw: () => void) {
        let rawCandles = activeManager.getCandles();
        if (rawCandles.length === 0) return;

        const currentType = this.chartType;
        const isNonLinear = ['renko', 'line_break', 'kagi', 'point_and_figure'].includes(currentType);
        
        // 1. 偵測數據或類型變更
        const dataHash = `${currentType}_${rawCandles.length}_${rawCandles[rawCandles.length-1]?.time}`;
        const typeChanged = this.lastDataHash.split('_')[0] !== currentType;
        
        if (this.lastDataHash !== dataHash || typeChanged) {
            this.lastDataHash = dataHash;
            
            // 執行數據轉換
            if (isNonLinear) {
                this.visualCandles = DataTransformer.transform(rawCandles, currentType);
            } else {
                this.visualCandles = [...rawCandles];
            }

            // 同步視口狀態 (禁止 isHistory 補償，避免切換時索引飛走)
            this.viewport.setDataCount(this.visualCandles.length, false);
            
            // 如果是切換圖表，強制把視角拉到最右側數據端
            if (typeChanged) {
                const count = this.visualCandles.length;
                this.viewport.setRange(Math.max(0, count - 100), count);
            }
            
            // 🚨 重要：數據變更後立即觸發下一幀重繪並跳出，防止本幀使用舊索引渲染新數據
            requestRedraw();
            return;
        }

        // 2. 準備渲染數據
        const candles = this.visualCandles;
        if (candles.length === 0) return;

        const { start, end } = this.viewport.getVisibleRange();
        const { startIndex } = this.viewport.getRawRange();
        const visible = candles.slice(start, end);
        const cw = this.viewport.getCandleWidth();
        const lastCandle = candles[candles.length - 1];

        // 3. 動態更新價格平滑
        const visualPrice = this.priceAnimator.update(lastCandle.close, requestRedraw);
        
        // 4. 背景層渲染 (座標軸標籤現在是基於密度的，不再依賴固定間隔)
        this.scaleEngine.updateScale(visible);
        this.renderEngine.drawGrid(this.scaleEngine);
        this.renderEngine.drawAxes(visible, startIndex, cw, 2, (idx: number) => {
            return candles[idx]?.time || NaN;
        }, this.scaleEngine);
        
        // 5. 主圖層渲染
        this.renderEngine.drawMainChart(currentType, visible, start, startIndex, cw, 2, this.scaleEngine, visualPrice);
        
        // 指標僅在線性圖表下顯示 (進階圖表座標系統不同)
        if (!isNonLinear) {
            const indicatorResult = this.indicatorController.run(candles);
            this.renderEngine.drawIndicators(indicatorResult.plots, start, end, startIndex, cw, 2, this.scaleEngine);
            this.renderEngine.drawIndicatorLabels(indicatorResult.labels, startIndex, cw, 2, this.scaleEngine);
            this.renderEngine.drawIndicatorBoxes(indicatorResult.boxes, startIndex, cw, 2, this.scaleEngine);
        }
        
        // 6. 計算畫面內最高最低點並標註
        let maxHigh = -Infinity, minLow = Infinity;
        let maxIdx = -1, minIdx = -1;
        for (let i = 0; i < visible.length; i++) {
            const c = visible[i];
            const h = c.high !== 0 ? c.high : Math.max(c.open, c.close);
            const l = c.low !== 0 ? c.low : Math.min(c.open, c.close);
            if (h > maxHigh) { maxHigh = h; maxIdx = start + i; }
            if (l < minLow) { minLow = l; minIdx = start + i; }
        }

        if (maxIdx !== -1) {
            this.renderEngine.drawMinMaxLabels(
                { price: maxHigh, index: maxIdx }, 
                { price: minLow, index: minIdx }, 
                startIndex, cw, 2, this.scaleEngine
            );
        }

        // 7. 互動層渲染 (清理十字線殘留)
        this.renderEngine.clearOverlay();
        if (!isNonLinear) {
            this.drawingEngine.render(this.renderEngine.getOverlayContext(), this.scaleEngine, startIndex, cw, 2, (t: number) => activeManager.getIndexAtTime(t), this.crosshairController.getHoveredDrawingId());
        }
        
        const getTime = (idx: number) => candles[Math.round(idx)]?.time || NaN;
        this.crosshairController.draw(getTime, candles);

        // 8. 價格線渲染
        this.renderEngine.drawLastPriceLine(visualPrice, visualPrice >= lastCandle.open ? '#26a69a' : '#ef5350', this.scaleEngine);
    }
}
