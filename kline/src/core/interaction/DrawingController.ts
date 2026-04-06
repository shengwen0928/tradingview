import { InteractionEngine } from './InteractionEngine';
import { DrawingEngine, DrawingObject } from './DrawingEngine';
import { ViewportEngine } from '../services/ViewportEngine';
import { ScaleEngine } from '../engines/ScaleEngine';
import { DataManager } from '../services/DataManager';

export class DrawingController {
    private moveTarget: DrawingObject | null = null;
    private moveStartMouseIndex: number = 0; 
    private moveStartMousePrice: number = 0; 
    private moveInitialPoints: { index: number, price: number }[] = []; 

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
            
            // 基礎座標計算
            const rawIndex = mouseX / (candleWidth + spacing) + startIndex;
            const price = this.scaleEngine.yToPrice(mouseY);
            
            // 決定點位吸附：移動工具與筆刷用高精度，其餘用 K 棒整數
            const time = (tool === 'move' || tool === 'brush')
                ? activeManager.getTimeAtFloatIndex(rawIndex)
                : activeManager.getTimeAtIndex(Math.round(rawIndex));
            
            const point = { time, price };

            if (type === 'start') {
                if (tool === 'move') {
                    // 🚀 尋找被抓取的物件
                    const hit = this.drawingEngine.hitTest(mouseX, mouseY, this.scaleEngine, startIndex, candleWidth, spacing, (t: number) => activeManager.getIndexAtTime(t));
                    if (hit) {
                        this.moveTarget = hit;
                        this.moveStartMouseIndex = rawIndex;
                        this.moveStartMousePrice = price;
                        // 記錄所有點的「數據坐標」
                        this.moveInitialPoints = hit.points.map(p => ({
                            index: activeManager.getIndexAtTime(p.time),
                            price: p.price
                        }));
                    }
                    return;
                }

                // 正常繪圖起始
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
                    // 🚀 核心移動邏輯：數據空間相對位移
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
