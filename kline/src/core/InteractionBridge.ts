import { ViewportController } from './ViewportController';
import { CrosshairController } from './CrosshairController';
import { DataManagerService } from './DataManagerService';

export class InteractionBridge {
    constructor(
        private vpController: ViewportController,
        private crosshairController: CrosshairController,
        private dataService: DataManagerService,
        private requestRedraw: () => void
    ) {}

    public getHandlers() {
        return {
            onScroll: (dX: number, dY: number, z: string) => 
                this.vpController.handleScroll(dX, dY, z),
            onZoom: (mX: number, _mY: number, s: number, z: string) => 
                this.vpController.handleZoom(mX, s, z, 0), // logicalWidth will be handled inside if needed or passed differently
            onMouseMove: (mX: number, mY: number) => 
                this.crosshairController.update(mX, mY, this.dataService.getActiveManager(), this.requestRedraw)
        };
    }
}
