import { InteractionEngine } from './InteractionEngine';
import { DrawingEngine } from './DrawingEngine';
import { ViewportEngine } from './ViewportEngine';
import { ScaleEngine } from './ScaleEngine';
import { DataManager } from './DataManager';

export class DrawingController {
    constructor(
        private interactionEngine: InteractionEngine,
        private drawingEngine: DrawingEngine,
        private viewport: ViewportEngine,
        private scaleEngine: ScaleEngine,
        private requestRedraw: () => void
    ) {}

    public startDrawing(tool: string, activeManager: DataManager) {
        this.interactionEngine.setDrawingMode(tool, (mouseX, mouseY, type) => {
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
                const needed = this.drawingEngine.getPointsNeeded(tool as any);

                if (!this.drawingEngine.isPlacing()) {
                    this.drawingEngine.startDrawing(tool as any, point);
                    if (needed === 1) {
                        this.finishDrawing();
                    }
                } else {
                    if (tool !== 'brush') {
                        const active = this.drawingEngine.getActiveDrawing();
                        const currentCount = active?.points.length || 0;
                        if (currentCount === needed) {
                            this.finishDrawing();
                        } else {
                            this.drawingEngine.addPoint(point);
                        }
                    }
                }
            } else if (type === 'move') {
                if (this.drawingEngine.isPlacing()) {
                    this.drawingEngine.updateDrawing(point);
                }
            } else if (type === 'end') {
                if (tool === 'brush' && this.drawingEngine.isPlacing()) {
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
