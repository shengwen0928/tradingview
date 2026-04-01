import { ScaleEngine } from './ScaleEngine';

export interface DrawingPoint {
    time: number;
    price: number;
}

export interface DrawingObject {
    id: string;
    type: 'trendline' | 'horizontal' | 'vertical' | 'rect' | 'fibonacci' | 'text' | 'ray' | 'arrow' | 'priceRange' | 'brush' | 'parallelChannel' | 'triangle' | 'ellipse';
    points: DrawingPoint[];
    color: string;
    lineWidth: number;
    text?: string;
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

    public deleteDrawing(id: string) {
        this.drawings = this.drawings.filter(d => d.id !== id);
    }

    public updateDrawingColor(id: string, color: string) {
        const draw = this.drawings.find(d => d.id === id);
        if (draw) draw.color = color;
    }

    public updateDrawingText(id: string, text: string) {
        const draw = this.drawings.find(d => d.id === id);
        if (draw) draw.text = text;
    }

    /**
     * 判斷滑鼠是否點擊在某個物件上
     */
    public hitTest(
        mouseX: number, 
        mouseY: number, 
        scaleEngine: ScaleEngine, 
        exactStartIndex: number, 
        candleWidth: number, 
        spacing: number, 
        timeToIndex: (time: number) => number
    ): DrawingObject | null {
        // 從最後畫的開始找 (最上層)
        for (let i = this.drawings.length - 1; i >= 0; i--) {
            const draw = this.drawings[i];
            if (draw.points.length < 1) continue;

            const p1 = draw.points[0];
            const x1 = scaleEngine.indexToX(timeToIndex(p1.time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
            const y1 = scaleEngine.priceToY(p1.price);

            if (draw.type === 'horizontal' || draw.type === 'priceRange') {
                if (Math.abs(mouseY - y1) < 10) return draw;
            } else if (draw.type === 'vertical') {
                if (Math.abs(mouseX - x1) < 10) return draw;
            } else if (draw.type === 'text' || draw.type === 'brush') {
                if (Math.abs(mouseX - x1) < 20 && Math.abs(mouseY - y1) < 20) return draw;
            } else if (draw.points.length >= 2) {
                const p2 = draw.points[1];
                const x2 = scaleEngine.indexToX(timeToIndex(p2.time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
                const y2 = scaleEngine.priceToY(p2.price);

                if (draw.type === 'trendline' || draw.type === 'fibonacci' || draw.type === 'ray' || draw.type === 'arrow' || draw.type === 'parallelChannel') {
                    // 計算點到線段的距離
                    const dist = this.distToSegment(mouseX, mouseY, x1, y1, x2, y2);
                    if (dist < 10) return draw;
                } else if (draw.type === 'rect' || draw.type === 'ellipse') {
                    const minX = Math.min(x1, x2);
                    const maxX = Math.max(x1, x2);
                    const minY = Math.min(y1, y2);
                    const maxY = Math.max(y1, y2);
                    if (mouseX >= minX && mouseX <= maxX && mouseY >= minY && mouseY <= maxY) return draw;
                } else if (draw.type === 'triangle' && draw.points.length >= 3) {
                    const p3 = draw.points[2];
                    const x3 = scaleEngine.indexToX(timeToIndex(p3.time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
                    const y3 = scaleEngine.priceToY(p3.price);
                    const dist1 = this.distToSegment(mouseX, mouseY, x1, y1, x2, y2);
                    const dist2 = this.distToSegment(mouseX, mouseY, x2, y2, x3, y3);
                    const dist3 = this.distToSegment(mouseX, mouseY, x3, y3, x1, y1);
                    if (dist1 < 10 || dist2 < 10 || dist3 < 10) return draw;
                }
            }
        }
        return null;
    }

    private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt((px - (x1 + t * (x2 - x1))) ** 2 + (py - (y1 + t * (y2 - y1))) ** 2);
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
        timeToIndex: (time: number) => number,
        hoveredId: string | null = null // 🚨 新增：懸停 ID
    ) {
        // 🚨 修正：清除畫布防止殘影
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const all = [...this.drawings];
        if (this.activeDrawing) all.push(this.activeDrawing);

        ctx.save();
        ctx.setLineDash([]); 
        ctx.globalAlpha = 1.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        all.forEach(draw => {
            if (draw.points.length < 1) return;

            ctx.strokeStyle = draw.color;
            ctx.fillStyle = draw.color;
            ctx.lineWidth = draw.lineWidth || 2;
            
            // 🚨 判斷是否要顯示端點
            const isHovered = draw.id === hoveredId || draw === this.activeDrawing;

            if (draw.type === 'trendline' && draw.points.length >= 2) {
                this.drawTrendLine(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            } else if (draw.type === 'horizontal') {
                this.drawHorizontalLine(ctx, draw, scaleEngine, isHovered);
            } else if (draw.type === 'vertical') {
                this.drawVerticalLine(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            } else if (draw.type === 'rect' && draw.points.length >= 2) {
                this.drawRectangle(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            } else if (draw.type === 'fibonacci' && draw.points.length >= 2) {
                this.drawFibonacci(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            } else if (draw.type === 'text') {
                this.drawText(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            } else if (draw.type === 'ray' && draw.points.length >= 2) {
                this.drawRay(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            } else if (draw.type === 'arrow' && draw.points.length >= 2) {
                this.drawArrow(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            } else if (draw.type === 'priceRange' && draw.points.length >= 2) {
                this.drawPriceRange(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            } else if (draw.type === 'brush') {
                this.drawBrush(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex);
            } else if (draw.type === 'parallelChannel' && draw.points.length >= 3) {
                this.drawParallelChannel(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            } else if (draw.type === 'triangle' && draw.points.length >= 3) {
                this.drawTriangle(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            } else if (draw.type === 'ellipse' && draw.points.length >= 2) {
                this.drawEllipse(ctx, draw, scaleEngine, exactStartIndex, candleWidth, spacing, timeToIndex, isHovered);
            }
        });

        ctx.restore();
    }

    private drawBrush(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine, exactStartIndex: number, candleWidth: number, spacing: number, timeToIndex: (time: number) => number) {
        if (draw.points.length < 2) return;
        ctx.beginPath();
        draw.points.forEach((p, i) => {
            const x = scaleEngine.indexToX(timeToIndex(p.time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
            const y = scaleEngine.priceToY(p.price);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    private drawParallelChannel(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine, exactStartIndex: number, candleWidth: number, spacing: number, timeToIndex: (time: number) => number, isHovered: boolean) {
        const pts = draw.points.map(p => ({ x: scaleEngine.indexToX(timeToIndex(p.time), exactStartIndex, candleWidth, spacing) + candleWidth / 2, y: scaleEngine.priceToY(p.price) }));
        const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pts[2].x, pts[2].y); ctx.lineTo(pts[2].x + dx, pts[2].y + dy); ctx.stroke();
        ctx.save(); ctx.setLineDash([5, 5]); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo((pts[0].x + pts[2].x) / 2, (pts[0].y + pts[2].y) / 2); ctx.lineTo((pts[0].x + pts[2].x) / 2 + dx, (pts[0].y + pts[2].y) / 2 + dy); ctx.stroke(); ctx.restore();
        ctx.save(); ctx.globalAlpha = 0.1; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(pts[1].x, pts[1].y); ctx.lineTo(pts[2].x + dx, pts[2].y + dy); ctx.lineTo(pts[2].x, pts[2].y); ctx.closePath(); ctx.fill(); ctx.restore();
        if (isHovered) pts.forEach(p => this.drawPoint(ctx, p.x, p.y));
    }

    private drawTriangle(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine, exactStartIndex: number, candleWidth: number, spacing: number, timeToIndex: (time: number) => number, isHovered: boolean) {
        if (draw.points.length < 3) return;

        // 1. 預先計算座標，避免在路徑中執行複雜邏輯
        const pts = draw.points.map(p => ({
            x: scaleEngine.indexToX(timeToIndex(p.time), exactStartIndex, candleWidth, spacing) + candleWidth / 2,
            y: scaleEngine.priceToY(p.price)
        }));

        // 2. 建立連續路徑 (不中斷)
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.closePath();
        
        // 3. 渲染填充與邊框
        ctx.save(); ctx.globalAlpha = 0.2; ctx.fill(); ctx.restore();
        ctx.stroke();

        // 4. 路徑結束後，如果懸停才畫圓圈
        if (isHovered) {
            pts.forEach(p => this.drawPoint(ctx, p.x, p.y));
        }
    }

    private drawEllipse(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine, exactStartIndex: number, candleWidth: number, spacing: number, timeToIndex: (time: number) => number, isHovered: boolean) {
        const x1 = scaleEngine.indexToX(timeToIndex(draw.points[0].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y1 = scaleEngine.priceToY(draw.points[0].price);
        const x2 = scaleEngine.indexToX(timeToIndex(draw.points[1].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y2 = scaleEngine.priceToY(draw.points[1].price);
        ctx.beginPath(); ctx.ellipse(x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1), 0, 0, Math.PI * 2);
        ctx.save(); ctx.globalAlpha = 0.1; ctx.fill(); ctx.restore();
        ctx.stroke();
        if (isHovered) { this.drawPoint(ctx, x1, y1); this.drawPoint(ctx, x2, y2); }
    }

    private drawTrendLine(
        ctx: CanvasRenderingContext2D,
        draw: DrawingObject,
        scaleEngine: ScaleEngine,
        exactStartIndex: number,
        candleWidth: number,
        spacing: number,
        timeToIndex: (time: number) => number,
        isHovered: boolean
    ) {
        const x1 = scaleEngine.indexToX(timeToIndex(draw.points[0].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y1 = scaleEngine.priceToY(draw.points[0].price);
        const x2 = scaleEngine.indexToX(timeToIndex(draw.points[1].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y2 = scaleEngine.priceToY(draw.points[1].price);

        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        if (isHovered) { this.drawPoint(ctx, x1, y1); this.drawPoint(ctx, x2, y2); }
    }

    private drawHorizontalLine(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine, isHovered: boolean) {
        const y = scaleEngine.priceToY(draw.points[0].price);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(scaleEngine.getDrawWidth(), y); ctx.stroke();
        if (isHovered) this.drawPoint(ctx, 10, y); 
    }

    private drawVerticalLine(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine, exactStartIndex: number, candleWidth: number, spacing: number, timeToIndex: (time: number) => number, isHovered: boolean) {
        const x = scaleEngine.indexToX(timeToIndex(draw.points[0].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, scaleEngine.getDrawHeight()); ctx.stroke();
        if (isHovered) this.drawPoint(ctx, x, 10);
    }

    private drawRectangle(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine, exactStartIndex: number, candleWidth: number, spacing: number, timeToIndex: (time: number) => number, isHovered: boolean) {
        const x1 = scaleEngine.indexToX(timeToIndex(draw.points[0].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y1 = scaleEngine.priceToY(draw.points[0].price);
        const x2 = scaleEngine.indexToX(timeToIndex(draw.points[1].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y2 = scaleEngine.priceToY(draw.points[1].price);
        ctx.save(); ctx.globalAlpha = 0.2; ctx.fillRect(x1, y1, x2 - x1, y2 - y1); ctx.restore();
        ctx.beginPath(); ctx.rect(x1, y1, x2 - x1, y2 - y1); ctx.stroke();
        if (isHovered) { this.drawPoint(ctx, x1, y1); this.drawPoint(ctx, x2, y2); }
    }

    private drawRay(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine, exactStartIndex: number, candleWidth: number, spacing: number, timeToIndex: (time: number) => number, isHovered: boolean) {
        const x1 = scaleEngine.indexToX(timeToIndex(draw.points[0].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y1 = scaleEngine.priceToY(draw.points[0].price);
        const x2 = scaleEngine.indexToX(timeToIndex(draw.points[1].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y2 = scaleEngine.priceToY(draw.points[1].price);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const length = 5000; 
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + Math.cos(angle) * length, y1 + Math.sin(angle) * length); 
        ctx.stroke(); // 🚨 補回：渲染線條
        if (isHovered) this.drawPoint(ctx, x1, y1);
    }

    private drawArrow(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine, exactStartIndex: number, candleWidth: number, spacing: number, timeToIndex: (time: number) => number, isHovered: boolean) {
        const x1 = scaleEngine.indexToX(timeToIndex(draw.points[0].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y1 = scaleEngine.priceToY(draw.points[0].price);
        const x2 = scaleEngine.indexToX(timeToIndex(draw.points[1].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y2 = scaleEngine.priceToY(draw.points[1].price);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); 
        ctx.stroke(); // 🚨 補回：渲染主幹
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 15 * Math.cos(angle - Math.PI / 6), y2 - 15 * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - 15 * Math.cos(angle + Math.PI / 6), y2 - 15 * Math.sin(angle + Math.PI / 6));
        ctx.closePath(); ctx.fill();
        if (isHovered) this.drawPoint(ctx, x1, y1);
    }

    private drawPriceRange(ctx: CanvasRenderingContext2D, draw: DrawingObject, scaleEngine: ScaleEngine, exactStartIndex: number, candleWidth: number, spacing: number, timeToIndex: (time: number) => number, isHovered: boolean) {
        const x1 = scaleEngine.indexToX(timeToIndex(draw.points[0].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y1 = scaleEngine.priceToY(draw.points[0].price);
        const x2 = scaleEngine.indexToX(timeToIndex(draw.points[1].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y2 = scaleEngine.priceToY(draw.points[1].price);
        const p1 = draw.points[0].price, p2 = draw.points[1].price;
        const diff = p2 - p1, pct = (diff / p1) * 100;
        ctx.save(); ctx.globalAlpha = 0.1; ctx.fillStyle = diff >= 0 ? '#26a69a' : '#ef5350'; ctx.fillRect(x1, y1, x2 - x1, y2 - y1); ctx.restore();
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); ctx.moveTo(x1, y2); ctx.lineTo(x2, y2); 
        ctx.stroke(); // 🚨 補回：渲染水平邊界線
        ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${diff.toFixed(2)} (${pct.toFixed(2)}%)`, (x1 + x2) / 2, (y1 + y2) / 2);
        if (isHovered) { this.drawPoint(ctx, x1, y1); this.drawPoint(ctx, x2, y2); }
    }

    private drawFibonacci(
        ctx: CanvasRenderingContext2D,
        draw: DrawingObject,
        scaleEngine: ScaleEngine,
        exactStartIndex: number,
        candleWidth: number,
        spacing: number,
        timeToIndex: (time: number) => number,
        isHovered: boolean
    ) {
        const x1 = scaleEngine.indexToX(timeToIndex(draw.points[0].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y1 = scaleEngine.priceToY(draw.points[0].price);
        const x2 = scaleEngine.indexToX(timeToIndex(draw.points[1].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y2 = scaleEngine.priceToY(draw.points[1].price);
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
        const diff = draw.points[1].price - draw.points[0].price;
        const width = scaleEngine.getDrawWidth();

        ctx.save();
        ctx.setLineDash([5, 5]); ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); 
        ctx.stroke(); // 🚨 補回：渲染趨勢連線 (虛線)
        ctx.restore();

        levels.forEach(level => {
            const price = draw.points[0].price + diff * level;
            const y = scaleEngine.priceToY(price);
            ctx.beginPath(); ctx.moveTo(Math.min(x1, x2), y); ctx.lineTo(width, y); 
            ctx.globalAlpha = 0.6; 
            ctx.stroke(); // 🚨 補回：渲染水平回撤線
            ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
            ctx.fillText(`${(level * 100).toFixed(1)}% (${price.toFixed(2)})`, width - 5, y - 5);
        });
        if (isHovered) { this.drawPoint(ctx, x1, y1); this.drawPoint(ctx, x2, y2); }
    }

    private drawText(
        ctx: CanvasRenderingContext2D,
        draw: DrawingObject,
        scaleEngine: ScaleEngine,
        exactStartIndex: number,
        candleWidth: number,
        spacing: number,
        timeToIndex: (time: number) => number,
        isHovered: boolean
    ) {
        const x = scaleEngine.indexToX(timeToIndex(draw.points[0].time), exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const y = scaleEngine.priceToY(draw.points[0].price);

        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(draw.text || '文字', x + 10, y + 5);
        if (isHovered) this.drawPoint(ctx, x, y);
    }

    private drawPoint(ctx: CanvasRenderingContext2D, x: number, y: number) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}
