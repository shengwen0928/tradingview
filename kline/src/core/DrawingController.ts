import { InteractionEngine } from './InteractionEngine';
import { DrawingEngine, DrawingObject, DrawingPoint } from './DrawingEngine';
import { ViewportEngine } from './ViewportEngine';
import { ScaleEngine } from './ScaleEngine';
import { DataManager } from './DataManager';

export class DrawingController {
    private moveTarget: DrawingObject | null = null;
    private moveStartPos = { x: 0, y: 0 };
    private moveInitialPoints: DrawingPoint[] = []; // 🚀 新增：記錄移動前的原始座標快照

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
            
            const rawIndex = mouseX / (candleWidth + spacing) + startIndex;
            const time = tool === 'brush' 
                ? activeManager.getTimeAtFloatIndex(rawIndex) 
                : activeManager.getTimeAtIndex(Math.round(rawIndex));
                
            const price = this.scaleEngine.yToPrice(mouseY);
            const point = { time, price };

            if (type === 'start') {
                if (tool === 'move') {
                    // 🚀 移動模式：尋找點擊到的物件
                    const hit = this.drawingEngine.hitTest(mouseX, mouseY, this.scaleEngine, startIndex, candleWidth, spacing, (t: number) => activeManager.getIndexAtTime(t));
                    if (hit) {
                        this.moveTarget = hit;
                        this.moveStartPos = { x: mouseX, y: mouseY };
                        // 🚀 關鍵：在開始移動時，深拷貝一份原始座標快照
                        this.moveInitialPoints = hit.points.map(p => ({ ...p }));
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
                    // 🚀 執行移動：計算相對於「起始點」的總位移
                    const totalDx = mouseX - this.moveStartPos.x;
                    const totalDy = mouseY - this.moveStartPos.y;
                    
                    // 🚀 呼叫新的絕對位移移動函式
                    this.drawingEngine.moveDrawingAbsolute(
                        this.moveTarget.id, 
                        this.moveInitialPoints,
                        totalDx, 
                        totalDy, 
                        this.scaleEngine, 
                        this.viewport, 
                        spacing, 
                        (t: number) => activeManager.getIndexAtTime(t), 
                        (idx: number) => activeManager.getTimeAtIndex(idx)
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
