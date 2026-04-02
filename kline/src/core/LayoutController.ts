import { RenderEngine } from './RenderEngine';
import { ScaleEngine } from './ScaleEngine';
import { ViewportEngine } from './ViewportEngine';
import { InteractionEngine } from './InteractionEngine';

export class LayoutController {
    constructor(
        private renderEngine: RenderEngine,
        private scaleEngine: ScaleEngine,
        private viewport: ViewportEngine,
        private interactionEngine: InteractionEngine,
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
        this.viewport.resize(w);
        this.interactionEngine.resize();
        this.requestRedraw();
    }
}
