import { InteractionEngine } from './InteractionEngine';
import { DrawingEngine, DrawingObject } from './DrawingEngine';
import { ViewportEngine } from './ViewportEngine';
import { ScaleEngine } from './ScaleEngine';
import { DataManager } from './DataManager';

export class DrawingController {
    private moveTarget: DrawingObject | null = null;
    private moveStartMouseIndex: number = 0; // 🚀 新增：記錄滑鼠起始 K 棒索引
    private moveStartMousePrice: number = 0; // 🚀 新增：記錄滑鼠起始價格
    private moveInitialPoints: { index: number, price: number }[] = []; // 🚀 新增：物件端點初始數據座標

    constructor(
        private interactionEngine: InteractionEngine,
        private drawingEngine: DrawingEngine,
        private viewport: ViewportEngine,
        private scaleEngine: ScaleEngine,
        private requestRedraw: () => void
    ) {}

    public startDrawing(tool: string, activeManager: DataManager) {
        this.interactionEngine.setDrawingMode(tool, (mouseX: number, mouseY: number, type: 'start' | 'move' | 'end') => {
            const { startIndex } = this.viewport.getRawRange();
            const candleWidth = this.viewport.getCandleWidth();
            const spacing = 2;
            
            // 🚀 始終使用高精度的 FloatIndex 進行計算
            const rawIndex = mouseX / (candleWidth + spacing) + startIndex;
            const price = this.scaleEngine.yToPrice(mouseY);
            const time = activeManager.getTimeAtFloatIndex(rawIndex);
            const point = { time, price };

            if (type === 'start') {
                if (tool === 'move') {
                    const hit = this.drawingEngine.hitTest(mouseX, mouseY, this.scaleEngine, startIndex, candleWidth, spacing, (t: number) => activeManager.getIndexAtTime(t));
                    if (hit) {
                        this.moveTarget = hit;
                        this.moveStartMouseIndex = rawIndex;
                        this.moveStartMousePrice = price;
                        // 🚀 關鍵：在開始移動時，記錄所有點的數據空間位置 (Index + Price)
                        this.moveInitialPoints = hit.points.map(p => ({
                            index: activeManager.getIndexAtTime(p.time),
                            price: p.price
                        }));
                    }
                    return;
                }

                const needed = this.drawingEngine.getPointsNeeded(tool as any);
                if (!this.drawingEngine.isPlacing()) {
                    this.drawingEngine.startDrawing(tool as any, point);
                    if (needed === 1) this.finishDrawing();
                } else {
                    if (tool !== 'brush') {
                        const active = this.drawingEngine.getActiveDrawing();
                        if ((active?.points.length || 0) === needed) this.finishDrawing();
                        else this.drawingEngine.addPoint(point);
                    }
                }
            } else if (type === 'move') {
                if (tool === 'move' && this.moveTarget) {
                    // 🚀 核心改動：計算數據空間的「相對位移」
                    const deltaIndex = rawIndex - this.moveStartMouseIndex;
                    const deltaPrice = price - this.moveStartMousePrice;
                    
                    this.drawingEngine.moveDrawingRelative(
                        this.moveTarget.id, 
                        this.moveInitialPoints,
                        deltaIndex, 
                        deltaPrice, 
                        (idx: number) => activeManager.getTimeAtFloatIndex(idx)
                    );
                } else if (this.drawingEngine.isPlacing()) {
                    this.drawingEngine.updateDrawing(point);
                }
            } else if (type === 'end') {
                if (tool === 'move') {
                    this.moveTarget = null;
                    this.moveInitialPoints = [];
                } else if (tool === 'brush' && this.drawingEngine.isPlacing()) {
                    this.drawingEngine.endDrawing();
                }
            }
            this.requestRedraw();
        });
    }

    private finishDrawing() {
        this.drawingEngine.endDrawing();
        this.interactionEngine.setDrawingMode(null);
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    }
}
