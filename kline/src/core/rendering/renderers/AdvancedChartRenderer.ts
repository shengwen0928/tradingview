import { Candle } from '../../../types/Candle';
import { ScaleEngine } from '../../engines/ScaleEngine';

/**
 * 負責專業圖表渲染 (Volume Footprint, TPO, Volume Profile, Columns, High Low)
 */
export class AdvancedChartRenderer {
  public renderVolumeFootprint(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    _visualLastPrice?: number
  ): void {
    const drawWidth = scaleEngine.getDrawWidth();
    const rowHeight = 4;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
      if (x + candleWidth < 0 || x > drawWidth) continue;

      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);
      const centerX = x + candleWidth / 2;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(x, yHigh, candleWidth, yLow - yHigh);

      const steps = Math.ceil((yLow - yHigh) / rowHeight);
      for (let s = 0; s < steps; s++) {
          const rowY = yHigh + s * rowHeight;
          const buyVol = Math.random() * 50;
          const sellVol = Math.random() * 50;
          
          const total = buyVol + sellVol;
          const buyWidth = (buyVol / total) * (candleWidth / 2);
          const sellWidth = (sellVol / total) * (candleWidth / 2);

          ctx.fillStyle = 'rgba(38, 166, 154, 0.6)';
          ctx.fillRect(centerX - buyWidth, rowY, buyWidth, rowHeight - 1);
          
          ctx.fillStyle = 'rgba(239, 83, 80, 0.6)';
          ctx.fillRect(centerX, rowY, sellWidth, rowHeight - 1);

          if (candleWidth > 40) {
              ctx.fillStyle = '#fff';
              ctx.font = '6px sans-serif';
              ctx.textAlign = 'right';
              ctx.fillText(Math.floor(buyVol).toString(), centerX - 2, rowY + rowHeight - 1);
              ctx.textAlign = 'left';
              ctx.fillText(Math.floor(sellVol).toString(), centerX + 2, rowY + rowHeight - 1);
          }
      }
    }
  }

  public renderTPO(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    _visualLastPrice?: number
  ): void {
    const drawWidth = scaleEngine.getDrawWidth();
    const rowHeight = 6;

    const priceMap = new Map<number, number>();
    candles.forEach(c => {
        const key = Math.floor(c.close / 10) * 10;
        priceMap.set(key, (priceMap.get(key) || 0) + 1);
    });

    const maxCount = Math.max(...Array.from(priceMap.values()), 1);

    for (let i = 0; i < candles.length; i += 20) {
        const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
        if (x > drawWidth) break;

        priceMap.forEach((count, price) => {
            const y = scaleEngine.priceToY(price);
            const w = (count / maxCount) * candleWidth * 5;
            
            const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
            gradient.addColorStop(0, 'rgba(41, 98, 255, 0.5)');
            gradient.addColorStop(1, 'rgba(41, 98, 255, 0.0)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, w, rowHeight);
        });
    }
  }

  public renderVolumeProfile(
    _ctx: CanvasRenderingContext2D,
    candles: Candle[],
    _sliceStartIndex: number,
    _exactStartIndex: number,
    _candleWidth: number,
    _spacing: number,
    scaleEngine: ScaleEngine,
    _visualLastPrice?: number
  ): void {
    const ctx = _ctx;
    const drawWidth = scaleEngine.getDrawWidth();
    const rowHeight = 3;

    const volMap = new Map<number, number>();
    candles.forEach(c => {
        const key = Math.floor(c.close / 5) * 5;
        volMap.set(key, (volMap.get(key) || 0) + (c.volume || 0));
    });

    const maxVol = Math.max(...Array.from(volMap.values()), 1);

    volMap.forEach((vol, price) => {
        const y = scaleEngine.priceToY(price);
        const barWidth = (vol / maxVol) * (drawWidth * 0.3);
        
        ctx.fillStyle = 'rgba(120, 120, 120, 0.3)';
        ctx.fillRect(drawWidth - barWidth, y, barWidth, rowHeight);
    });
  }

  public renderColumns(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    const zeroY = scaleEngine.getDrawHeight();

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candle.close;
      const y = scaleEngine.priceToY(displayClose);

      const rectW = Math.max(1, Math.floor(candleWidth));
      const rectX = Math.floor(x);
      
      ctx.fillStyle = displayClose >= candle.open ? 'rgba(38, 166, 154, 0.7)' : 'rgba(239, 83, 80, 0.7)';
      ctx.fillRect(rectX, y, rectW, zeroY - y);
    }
  }

  public renderHighLow(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    const bodyWidth = Math.max(2, candleWidth);

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
      const centerX = Math.floor(x + candleWidth / 2) + 0.5;
      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);

      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candle.close;
      const isUp = displayClose >= candle.open;
      const color = isUp ? '#26a69a' : '#ef5350';
      
      ctx.fillStyle = color;
      const rectW = Math.max(1, Math.floor(bodyWidth));
      ctx.fillRect(Math.floor(centerX - rectW / 2), yHigh, rectW, Math.max(1, yLow - yHigh));
      
      ctx.font = '8px sans-serif';
      ctx.fillText(candle.high.toFixed(1), centerX - 10, yHigh - 5);
      ctx.fillText(candle.low.toFixed(1), centerX - 10, yLow + 10);
    }
  }
}
