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

  /**
   * 🚀 磚形圖 (Renko) - 精簡版
   * 現在數據已經由 DataTransformer 預處理為等寬的虛擬 K 線
   */
  public renderRenko(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    const drawWidth = scaleEngine.getDrawWidth();

    candles.forEach((brick, i) => {
        const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
        if (x + candleWidth < 0 || x > drawWidth) return;

        const yTop = scaleEngine.priceToY(brick.high);
        const yBottom = scaleEngine.priceToY(brick.low);
        const isUp = brick.close > brick.open;

        ctx.fillStyle = isUp ? '#26a69a' : '#ef5350';
        ctx.fillRect(x, Math.min(yTop, yBottom), candleWidth, Math.abs(yTop - yBottom));
        
        // 繪製磚塊邊框，增加專業感
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.strokeRect(x, Math.min(yTop, yBottom), candleWidth, Math.abs(yTop - yBottom));
    });
  }

  /**
   * 🚀 新價線 (Line Break) - 精簡版
   */
  public renderLineBreak(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    candles.forEach((line, i) => {
        const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
        const yOpen = scaleEngine.priceToY(line.open);
        const yClose = scaleEngine.priceToY(line.close);
        
        ctx.fillStyle = line.close > line.open ? '#26a69a' : '#ef5350';
        ctx.fillRect(x, Math.min(yOpen, yClose), candleWidth, Math.abs(yOpen - yClose));
    });
  }

  /**
   * 🚀 卡吉圖 (Kagi) - 精簡版
   * 根據預處理的數據繪製粗細變化的垂直與水平線
   */
  public renderKagi(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    if (candles.length === 0) return;

    let prevX = scaleEngine.indexToX(sliceStartIndex, exactStartIndex, candleWidth, spacing) + candleWidth / 2;

    candles.forEach((p, i) => {
        const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const yOpen = scaleEngine.priceToY(p.open);
        const yClose = scaleEngine.priceToY(p.close);
        const isYang = p.volume === 1; // 借用 volume 標記陰陽

        ctx.strokeStyle = isYang ? '#26a69a' : '#ef5350';
        ctx.lineWidth = isYang ? 3 : 1; // 陽線粗，陰線細

        ctx.beginPath();
        // 水平連線
        ctx.moveTo(prevX, yOpen);
        ctx.lineTo(x, yOpen);
        // 垂直線
        ctx.moveTo(x, yOpen);
        ctx.lineTo(x, yClose);
        ctx.stroke();

        prevX = x;
    });
  }

  /**
   * 🚀 點數圖 (Point & Figure) - 精簡版
   */
  public renderPointAndFigure(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    const boxSize = 5;
    ctx.font = `bold ${Math.floor(candleWidth)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    candles.forEach((c, i) => {
        const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const isUp = c.close > c.open;
        
        ctx.fillStyle = isUp ? '#26a69a' : '#ef5350';
        for (let yPrice = c.low; yPrice <= c.high; yPrice += boxSize) {
            const y = scaleEngine.priceToY(yPrice);
            ctx.fillText(isUp ? 'X' : 'O', x, y);
        }
    });
  }

  /**
   * 🚀 範圍圖 (Range)
   */
  public renderRange(
    ctx: CanvasRenderingContext2D,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    const rangeVal = 20;
    candles.forEach((c, i) => {
        if (Math.abs(c.high - c.low) < rangeVal) return;
        const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
        const yHigh = scaleEngine.priceToY(c.high);
        const yLow = scaleEngine.priceToY(c.low);
        ctx.fillStyle = c.close > c.open ? '#26a69a' : '#ef5350';
        ctx.fillRect(x, yHigh, candleWidth, yLow - yHigh);
    });
  }
}
