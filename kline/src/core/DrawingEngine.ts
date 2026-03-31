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
        getTimeAtIndex: (idx: number) => number
    ) {
        const all = [...this.drawings];
        if (this.activeDrawing) all.push(this.activeDrawing);

        all.forEach(draw => {
            ctx.strokeStyle = draw.color;
            ctx.lineWidth = draw.lineWidth;
            
            if (draw.type === 'trendline' && draw.points.length >= 2) {
                this.drawTrendLine(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing);
            }
        });
    }

    private drawTrendLine(
        ctx: CanvasRenderingContext2D,
        draw: DrawingObject,
        scaleEngine: ScaleEngine,
        exactStartIndex: number,
        candleWidth: number,
        spacing: number
    ) {
        const p1 = draw.points[0];
        const p2 = draw.points[1];

        // 轉換時間為索引
        const x1 = this.timeToX(p1.time, scaleEngine, exactStartIndex, candleWidth, spacing);
        const y1 = scaleEngine.priceToY(p1.price);
        const x2 = this.timeToX(p2.time, scaleEngine, exactStartIndex, candleWidth, spacing);
        const y2 = scaleEngine.priceToY(p2.price);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // 繪製端點小圓球 (裝飾)
        ctx.fillStyle = draw.color;
        ctx.beginPath();
        ctx.arc(x1, y1, 4, 0, Math.PI * 2);
        ctx.arc(x2, y2, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * 輔助函數：將精確時間轉換為 X 像素
     * 這在繪圖中非常重要，因為繪圖點可能落在 K 棒之間
     */
    private timeToX(
        time: number,
        scaleEngine: ScaleEngine,
        exactStartIndex: number,
        candleWidth: number,
        spacing: number
    ): number {
        // 這是一個近似計算，實際應對比 DataManager 的時間軸
        // 暫時簡化：假設時間是連續的 (這對繪圖預覽已足夠)
        // 理想情況應透過 DataManager 尋找最接近的 Index
        const drawWidth = scaleEngine.getDrawWidth();
        // 暫時使用簡單的線性估算
        // TODO: 這裡未來需要優化以支援非交易時段的跳空
        const refIndex = 0; // 需外部傳入參考點
        return scaleEngine.indexToX(0, exactStartIndex, candleWidth, spacing); // placeholder
    }

    // 🚨 修正版 timeToX 邏輯需整合 DataManager，我會在 ChartEngine 中注入
    public calculateX(time: number, findIndex: (t: number) => number, scaleEngine: ScaleEngine, exactStartIndex: number, candleWidth: number, spacing: number): number {
        const idx = findIndex(time);
        return scaleEngine.indexToX(idx, exactStartIndex, candleWidth, spacing) + candleWidth / 2;
    }
}
