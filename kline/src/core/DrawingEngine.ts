import { ScaleEngine } from './ScaleEngine';

export interface DrawingPoint {
    time: number;
    price: number;
}

export interface DrawingObject {
    id: string;
    type: 'trendline' | 'horizontal' | 'vertical' | 'rect' | 'fibonacci';
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

        ctx.save(); // 🚨 關鍵：儲存 Canvas 原始狀態
        
        // 🚨 顯式重設狀態，防止被十字線等其他繪圖汙染
        ctx.setLineDash([]); 
        ctx.globalAlpha = 1.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        all.forEach(draw => {
            if (draw.points.length < 1) return;

            ctx.strokeStyle = draw.color;
            ctx.fillStyle = draw.color;
            ctx.lineWidth = draw.lineWidth || 2;
            
            if (draw.type === 'trendline' && draw.points.length >= 2) {
                this.drawTrendLine(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex);
            } else if (draw.type === 'horizontal') {
                this.drawHorizontalLine(ctx, draw, scaleEngine);
            } else if (draw.type === 'vertical') {
                this.drawVerticalLine(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex);
            } else if (draw.type === 'rect' && draw.points.length >= 2) {
                this.drawRectangle(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex);
            } else if (draw.type === 'fibonacci' && draw.points.length >= 2) {
                this.drawFibonacci(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex);
            }
        });

        ctx.restore(); // 🚨 關鍵：還原狀態
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

        // 畫主線
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // 畫端點
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
        
        this.drawPoint(ctx, 10, y); 
    }

    private drawVerticalLine(
        ctx: CanvasRenderingContext2D,
        draw: DrawingObject,
        scaleEngine: ScaleEngine,
        exactStartIndex: number,
        candleWidth: number,
        spacing: number,
        timeToIndex: (time: number) => number
    ) {
        const x = scaleEngine.indexToX(timeToIndex(draw.points[0].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const height = scaleEngine.getDrawHeight();

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        this.drawPoint(ctx, x, 10);
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

        // 畫半透明填充
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillRect(x1, y1, w, h);
        ctx.restore();

        // 畫外框
        ctx.beginPath();
        ctx.rect(x1, y1, w, h);
        ctx.stroke();

        // 畫端點
        this.drawPoint(ctx, x1, y1);
        this.drawPoint(ctx, x2, y2);
    }

    private drawFibonacci(
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

        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
        const diff = p2.price - p1.price;
        const width = scaleEngine.getDrawWidth();

        // 畫主連線 (虛線)
        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();

        levels.forEach(level => {
            const price = p1.price + diff * level;
            const y = scaleEngine.priceToY(price);

            // 畫水平線
            ctx.beginPath();
            ctx.moveTo(Math.min(x1, x2), y);
            ctx.lineTo(width, y);
            ctx.globalAlpha = 0.6;
            ctx.stroke();

            // 標註百分比與價格
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`${(level * 100).toFixed(1)}% (${price.toFixed(2)})`, width - 5, y - 5);
        });

        // 畫端點
        this.drawPoint(ctx, x1, y1);
        this.drawPoint(ctx, x2, y2);
    }

    private drawPoint(ctx: CanvasRenderingContext2D, x: number, y: number) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}
}
