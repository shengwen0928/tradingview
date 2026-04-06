import { RenderPipeline } from './RenderPipeline';
import { DataManagerService } from '../services/DataManagerService';

export class RenderLoop {
    private animationId: number | null = null;

    constructor(
        private pipeline: RenderPipeline,
        private dataService: DataManagerService
    ) {}

    public start() {
        this.requestRedraw();
    }

    public requestRedraw = () => {
        if (this.animationId !== null) return;
        this.animationId = requestAnimationFrame(() => {
            this.animationId = null;
            this.pipeline.execute(
                this.dataService.getActiveManager(), 
                this.requestRedraw
            );
        });
    }
}
