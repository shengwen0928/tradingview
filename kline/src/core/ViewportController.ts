import { ViewportEngine } from './ViewportEngine';
import { ScaleEngine } from './ScaleEngine';
import { LoaderController } from './LoaderController';

export class ViewportController {
    constructor(
        private viewport: ViewportEngine,
        private scaleEngine: ScaleEngine,
        private getLoader: () => LoaderController,
        private requestRedraw: () => void
    ) {}

    public handleScroll(dX: number, dY: number, zone: string) {
        if (zone === 'price') {
            this.scaleEngine.handleVerticalPan(dY);
        } else {
            this.viewport.handleScroll(dX);
            this.scaleEngine.handleVerticalPan(dY);
        }
        this.getLoader().checkLoadMore();
        this.requestRedraw();
    }

    public handleZoom(mX: number, scale: number, zone: string, logicalWidth: number) {
        if (zone === 'price') {
            this.scaleEngine.handleVerticalZoom(scale);
        } else if (zone === 'time') {
            this.viewport.handleZoom(logicalWidth / 2, scale, logicalWidth);
        } else {
            this.viewport.handleZoom(mX, scale, logicalWidth);
        }
        this.getLoader().checkLoadMore();
        this.requestRedraw();
    }
}
