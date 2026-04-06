import { Candle } from '../../../types/Candle';
import { ScaleEngine } from '../../engines/ScaleEngine';

/**
 * 負責線形圖渲染 (Line, Area, Baseline, HLC Area, Step Line)
 */
export class LineChartRenderer {
  public renderLineChart(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice: number | undefined,
    mode: 'line' | 'area' | 'markers' | 'step'
  ): void {
    const drawHeight = scaleEngine.getDrawHeight();

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2962ff';

    let firstX = 0, lastX = 0;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
      const centerX = x + candleWidth / 2;
      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candle.close;
      const y = scaleEngine.priceToY(displayClose);

      if (i === 0) {
        ctx.moveTo(centerX, y);
        firstX = centerX;
      } else {
        if (mode === 'step') {
            const prevY = scaleEngine.priceToY(candles[i-1].close);
            ctx.lineTo(centerX, prevY);
            ctx.lineTo(centerX, y);
        } else {
            ctx.lineTo(centerX, y);
        }
      }
      lastX = centerX;
    }
    ctx.stroke();

    if (mode === 'markers') {
        ctx.fillStyle = '#2962ff';
        for (let i = 0; i < candles.length; i++) {
            const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing) + candleWidth / 2;
            const y = scaleEngine.priceToY(candles[i].close);
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
    }

    if (mode === 'area' && candles.length > 0) {
      ctx.lineTo(lastX, drawHeight);
      ctx.lineTo(firstX, drawHeight);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, 0, 0, drawHeight);
      gradient.addColorStop(0, 'rgba(41, 98, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(41, 98, 255, 0.0)');
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  public renderHLCArea(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    if (candles.length < 2) return;

    ctx.beginPath();
    for (let i = 0; i < candles.length; i++) {
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing) + candleWidth / 2;
      const y = scaleEngine.priceToY(candles[i].high);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    for (let i = candles.length - 1; i >= 0; i--) {
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing) + candleWidth / 2;
      const y = scaleEngine.priceToY(candles[i].low);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(41, 98, 255, 0.2)';
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = '#2962ff';
    ctx.lineWidth = 2;
    for (let i = 0; i < candles.length; i++) {
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing) + candleWidth / 2;
      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candles[i].close;
      const y = scaleEngine.priceToY(displayClose);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  public renderBaseline(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number,
    canvasWidth: number = 0,
    canvasHeight: number = 0
  ): void {
    if (candles.length === 0) return;

    const baselinePrice = candles[0].close;
    const baseY = scaleEngine.priceToY(baselinePrice);

    ctx.strokeStyle = 'rgba(209, 212, 220, 0.5)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    ctx.lineTo(canvasWidth, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    const points: {x: number, y: number}[] = [];
    for (let i = 0; i < candles.length; i++) {
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing) + candleWidth / 2;
      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candles[i].close;
      const y = scaleEngine.priceToY(displayClose);
      points.push({x, y});
    }

    const drawSection = (isUp: boolean) => {
        ctx.beginPath();
        ctx.save();
        ctx.rect(0, isUp ? 0 : baseY, canvasWidth, isUp ? baseY : canvasHeight - baseY);
        ctx.clip();

        ctx.moveTo(points[0].x, points[0].y);
        for(let i=1; i<points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        
        ctx.lineTo(points[points.length-1].x, baseY);
        ctx.lineTo(points[0].x, baseY);
        ctx.closePath();
        
        ctx.fillStyle = isUp ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)';
        ctx.fill();
        ctx.restore();
    };

    drawSection(true);
    drawSection(false);

    ctx.beginPath();
    ctx.strokeStyle = '#d1d4dc';
    ctx.lineWidth = 1.5;
    ctx.moveTo(points[0].x, points[0].y);
    for(let i=1; i<points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
}
