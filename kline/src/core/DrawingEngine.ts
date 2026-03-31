import { ScaleEngine } from './ScaleEngine';

export interface DrawingPoint {
    time: number;
    price: number;
}

export interface DrawingObject {
    id: string;
    type: 'trendline' | 'horizontal' | 'vertical' | 'rect';
    points: DrawingPoint[];
    color: string;
    lineWidth: number;
}

/**
 * 負責管理、計算與渲染繪圖物件 (如趨勢線)
 */
export class DrawingEngine {
    private drawings: DrawingObject[] = [];
    private activeDrawing: DrawingObject | null = null;

    constructor() {}

    public addDrawing(drawing: DrawingObject) {
        this.drawings.push(drawing);
    }

    public setActiveDrawing(drawing: DrawingObject | null) {
        this.activeDrawing = drawing;
    }

    public getDrawings() {
        return this.drawings;
    }

    public getActiveDrawing() {
        return this.activeDrawing;
    }

    /**
     * 繪製所有圖形
     */
    public render(
        ctx: CanvasRenderingContext2D,
        scaleEngine: ScaleEngine,
        exactStartIndex: number,
        candleWidth: number,
        spacing: number,
        timeToIndex: (time: number) => number
    ) {
        const all = [...this.drawings];
        if (this.activeDrawing) all.push(this.activeDrawing);

        all.forEach(draw => {
            ctx.strokeStyle = draw.color;
            ctx.fillStyle = draw.color; // 矩形或點點需要填充色
            ctx.lineWidth = draw.lineWidth;
            
            if (draw.points.length < 1) return;

            if (draw.type === 'trendline' && draw.points.length >= 2) {
                this.drawTrendLine(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex);
            } else if (draw.type === 'horizontal') {
                this.drawHorizontalLine(ctx, draw, scaleEngine);
            } else if (draw.type === 'rect' && draw.points.length >= 2) {
                this.drawRectangle(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex);
            }
        });
    }

    private drawTrendLine(
        ctx: CanvasRenderingContext2D,
        draw: DrawingObject,
        scaleEngine: ScaleEngine,
        exactStartIndex: number,
        candleWidth: number,
        spacing: number,
        timeToIndex: (time: number) => number
    ) {
        const p1 = draw.points[0];
        const p2 = draw.points[1];

        const x1 = scaleEngine.indexToX(timeToIndex(p1.time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y1 = scaleEngine.priceToY(p1.price);
        const x2 = scaleEngine.indexToX(timeToIndex(p2.time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y2 = scaleEngine.priceToY(p2.price);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        this.drawPoint(ctx, x1, y1);
        this.drawPoint(ctx, x2, y2);
    }

    private drawHorizontalLine(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine) {
        const y = scaleEngine.priceToY(draw.points[0].price);
        const width = scaleEngine.getDrawWidth();

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        
        this.drawPoint(ctx, 10, y); // 在左側畫一個定位點
    }

    private drawRectangle(
        ctx: CanvasRenderingContext2D,
        draw: DrawingObject,
        scaleEngine: ScaleEngine,
        exactStartIndex: number,
        candleWidth: number,
        spacing: number,
        timeToIndex: (time: number) => number
    ) {
        const p1 = draw.points[0];
        const p2 = draw.points[1];

        const x1 = scaleEngine.indexToX(timeToIndex(p1.time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y1 = scaleEngine.priceToY(p1.price);
        const x2 = scaleEngine.indexToX(timeToIndex(p2.time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y2 = scaleEngine.priceToY(p2.price);

        const w = x2 - x1;
        const h = y2 - y1;

        // 畫外框
        ctx.strokeRect(x1, y1, w, h);
        
        // 畫半透明填充
        ctx.globalAlpha = 0.15;
        ctx.fillRect(x1, y1, w, h);
        ctx.globalAlpha = 1.0;

        this.drawPoint(ctx, x1, y1);
        this.drawPoint(ctx, x2, y2);
    }

    private drawPoint(ctx: CanvasRenderingContext2D, x: number, y: number) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}
