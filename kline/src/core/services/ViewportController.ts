import { ViewportEngine } from './ViewportEngine';
import { ScaleEngine } from '../engines/ScaleEngine';
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
            // 🚀 價格軸拖動：手動縮放 Y 軸
            this.scaleEngine.handleAxisDrag(dY, 'price');
        } else if (zone === 'time') {
            // 🚀 時間軸拖動：手動縮放 X 軸 (CandleWidth)
            const zoomFactor = 1 + dX / 500;
            this.viewport.handleZoom(0, zoomFactor, 0); // 在時間軸拖動時，使用固定點縮放
        } else {
            // 圖表區域拖動：平移
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
            // 時間軸滾輪縮放
            this.viewport.handleZoom(mX, scale, logicalWidth);
        } else {
            this.viewport.handleZoom(mX, scale, logicalWidth);
        }
        this.getLoader().checkLoadMore();
        this.requestRedraw();
    }
}
