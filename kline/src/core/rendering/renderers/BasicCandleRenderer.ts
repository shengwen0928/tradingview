import { Candle } from '../../../types/Candle';
import { ScaleEngine } from '../../engines/ScaleEngine';

/**
 * 負責基礎 K 線渲染 (Bars, Candles, Hollow, Volume Candles)
 */
export class BasicCandleRenderer {
  public renderBars(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    const drawWidth = scaleEngine.getDrawWidth();
    const halfWidth = Math.max(1, candleWidth / 2);

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
      if (x + candleWidth < 0 || x > drawWidth) continue;

      const centerX = Math.floor(x + candleWidth / 2) + 0.5;
      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candle.close;
      const yOpen = scaleEngine.priceToY(candle.open);
      const yClose = scaleEngine.priceToY(displayClose);
      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);

      ctx.strokeStyle = displayClose >= candle.open ? '#26a69a' : '#ef5350';
      ctx.lineWidth = Math.max(1, Math.floor(candleWidth * 0.2));

      ctx.beginPath();
      ctx.moveTo(centerX, yHigh);
      ctx.lineTo(centerX, yLow);
      ctx.moveTo(centerX, yOpen);
      ctx.lineTo(centerX - halfWidth, yOpen);
      ctx.moveTo(centerX, yClose);
      ctx.lineTo(centerX + halfWidth, yClose);
      ctx.stroke();
    }
  }

  public renderNormalCandles(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    const drawWidth = scaleEngine.getDrawWidth();

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
      if (x + candleWidth < 0 || x > drawWidth) continue;

      const centerX = Math.floor(x + candleWidth / 2) + 0.5;
      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candle.close;
      const yOpen = scaleEngine.priceToY(candle.open);
      const yClose = scaleEngine.priceToY(displayClose);
      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);

      const color = displayClose >= candle.open ? '#26a69a' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.moveTo(centerX, yHigh);
      ctx.lineTo(centerX, yLow);
      ctx.stroke();

      const rectW = Math.max(1, Math.floor(candleWidth));
      const rectX = Math.floor(centerX - rectW / 2);
      const rectY = Math.floor(Math.min(yOpen, yClose));
      const rectH = Math.max(1, Math.floor(Math.abs(yOpen - yClose)));
      ctx.fillRect(rectX, rectY, rectW, rectH);
    }
  }

  public renderHollowCandles(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    const drawWidth = scaleEngine.getDrawWidth();

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
      if (x + candleWidth < 0 || x > drawWidth) continue;

      const centerX = Math.floor(x + candleWidth / 2) + 0.5;
      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candle.close;
      const yOpen = scaleEngine.priceToY(candle.open);
      const yClose = scaleEngine.priceToY(displayClose);
      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);

      const color = displayClose >= candle.open ? '#26a69a' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.moveTo(centerX, yHigh);
      ctx.lineTo(centerX, yLow);
      ctx.stroke();

      const rectW = Math.max(1, Math.floor(candleWidth));
      const rectX = Math.floor(centerX - rectW / 2);
      const rectY = Math.floor(Math.min(yOpen, yClose));
      const rectH = Math.max(1, Math.floor(Math.abs(yOpen - yClose)));

      if (displayClose >= candle.open) {
        ctx.strokeRect(rectX + 0.5, rectY + 0.5, rectW - 1, rectH - 1);
      } else {
        ctx.fillRect(rectX, rectY, rectW, rectH);
      }
    }
  }

  public renderVolumeCandles(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    const drawWidth = scaleEngine.getDrawWidth();
    let totalVol = 0;
    candles.forEach(c => totalVol += (c.volume || 0));
    const avgVol = totalVol / (candles.length || 1);

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
      const volRatio = avgVol > 0 ? (candle.volume || 0) / avgVol : 1;
      const dynamicWidth = candleWidth * Math.min(1.5, Math.max(0.3, volRatio));
      
      if (x + dynamicWidth < 0 || x > drawWidth) continue;

      const centerX = Math.floor(x + candleWidth / 2) + 0.5;
      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candle.close;
      const yOpen = scaleEngine.priceToY(candle.open);
      const yClose = scaleEngine.priceToY(displayClose);
      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);

      const color = displayClose >= candle.open ? '#26a69a' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      const rectW = Math.max(1, Math.floor(dynamicWidth));
      const rectX = Math.floor(centerX - rectW / 2);
      const rectY = Math.floor(Math.min(yOpen, yClose));
      const rectH = Math.max(1, Math.floor(Math.abs(yOpen - yClose)));

      ctx.beginPath();
      ctx.moveTo(centerX, yHigh);
      ctx.lineTo(centerX, yLow);
      ctx.stroke();
      ctx.fillRect(rectX, rectY, rectW, rectH);
    }
  }
}
