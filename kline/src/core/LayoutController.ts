import { RenderEngine } from './RenderEngine';
import { ScaleEngine } from './ScaleEngine';

export class LayoutController {
    constructor(
        private renderEngine: RenderEngine,
        private scaleEngine: ScaleEngine,
        private requestRedraw: () => void
    ) {}

    public init() {
        window.addEventListener('resize', () => this.handleResize());
        this.handleResize();
    }

    public handleResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderEngine.resize(w, h);
        this.scaleEngine.updateDimensions(w, h);
        this.requestRedraw();
    }
}
