import { ScaleEngine } from './ScaleEngine';
import { ViewportEngine } from './ViewportEngine';
import { DataManager } from './DataManager';
import { RenderEngine } from './RenderEngine';
import { InfoDisplay } from '../ui/InfoDisplay';
import { DrawingEngine } from './DrawingEngine';
import { InteractionEngine } from './InteractionEngine';
import { formatPrice, formatFullTime } from '../utils/math';

export class CrosshairController {
    private lastMousePos = { x: 0, y: 0 };
    private hoveredDrawingId: string | null = null;

    constructor(
        private viewport: ViewportEngine,
        private scaleEngine: ScaleEngine,
        private renderEngine: RenderEngine,
        private infoDisplay: InfoDisplay,
        private drawingEngine: DrawingEngine,
        public interactionEngine?: InteractionEngine
    ) {}

    public update(mouseX: number, mouseY: number, activeManager: DataManager, requestRedraw: () => void) {
        this.lastMousePos = { x: mouseX, y: mouseY };
        const { startIndex } = this.viewport.getRawRange();
        const cw = this.viewport.getCandleWidth();
        const spacing = 2;

        // 1. 偵測懸停的繪圖物件
        this.hoveredDrawingId = this.drawingEngine.hitTest(
            mouseX, mouseY, this.scaleEngine, startIndex, cw, spacing, 
            (t) => activeManager.getIndexAtTime(t)
        )?.id || null;

        // 2. 更新 OHLC 顯示
        const index = Math.round(mouseX / (cw + spacing) + startIndex);
        const candles = activeManager.getCandles();
        if (candles[index]) {
            this.infoDisplay.updateOHLC(candles[index]);
        }

        requestRedraw();
    }

    public draw(activeManager: DataManager) {
        if (this.lastMousePos.x <= 0 && this.lastMousePos.y <= 0) return;

        const { startIndex } = this.viewport.getRawRange();
        const cw = this.viewport.getCandleWidth();
        const spacing = 2;

        const price = this.scaleEngine.yToPrice(this.lastMousePos.y);
        const time = activeManager.getTimeAtIndex(this.lastMousePos.x / (cw + spacing) + startIndex);

        // 1. 畫十字線與標籤
        this.renderEngine.drawCrosshair(
            this.lastMousePos.x, 
            this.lastMousePos.y, 
            formatPrice(price), 
            formatFullTime(time)
        );

        // 2. 畫繪圖預覽點
        const mode = this.interactionEngine?.getDrawingMode();
        if (mode && mode !== 'cursor' && mode !== 'move' && !this.drawingEngine.isPlacing()) {
            const snapped = this.interactionEngine!.getSnappedPos(this.lastMousePos.x, this.lastMousePos.y);
            this.renderEngine.drawPreviewPoint(snapped.x, snapped.y);
        }
    }

    public getHoveredDrawingId() {
        return this.hoveredDrawingId;
    }

    public getLastMousePos() {
        return this.lastMousePos;
    }
}
