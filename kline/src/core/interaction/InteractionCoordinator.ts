import { InteractionEngine } from './InteractionEngine';
import { DrawingEngine } from './DrawingEngine';
import { DrawingEditToolbar } from '../../ui/DrawingEditToolbar';
import { ViewportEngine } from '../services/ViewportEngine';
import { ScaleEngine } from '../engines/ScaleEngine';
import { DataManager } from '../services/DataManager';

export class InteractionCoordinator {
    constructor(
        private canvas: HTMLCanvasElement,
        private interactionEngine: InteractionEngine,
        private drawingEngine: DrawingEngine,
        private editToolbar: DrawingEditToolbar,
        private viewport: ViewportEngine,
        private scaleEngine: ScaleEngine
    ) {}

    public init(getActiveManager: () => DataManager) {
        this.canvas.addEventListener('click', (e: MouseEvent) => {
            if (this.interactionEngine.getDrawingMode()) return;

            const rect = this.canvas.getBoundingClientRect();
            const { startIndex } = this.viewport.getRawRange();
            const candleWidth = this.viewport.getCandleWidth();
            const manager = getActiveManager();

            const hit = this.drawingEngine.hitTest(
                e.clientX - rect.left, 
                e.clientY - rect.top, 
                this.scaleEngine, 
                startIndex, 
                candleWidth, 
                2, 
                (t) => manager.getIndexAtTime(t)
            );

            if (hit) {
                this.editToolbar.show(e.clientX, e.clientY, hit);
            } else {
                this.editToolbar.hide();
            }
        });
    }
}
