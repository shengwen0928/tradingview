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
   * 🚀 磚形圖 (Renko)
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
    if (candles.length === 0) return;
    const boxSize = 10; // 預設固定 10 點
    let lastPrice = candles[0].close;
    let bricks: { top: number, bottom: number, isUp: boolean }[] = [];

    candles.forEach(c => {
        let diff = c.close - lastPrice;
        while (Math.abs(diff) >= boxSize) {
            const isUp = diff > 0;
            const top = isUp ? lastPrice + boxSize : lastPrice;
            const bottom = isUp ? lastPrice : lastPrice - boxSize;
            bricks.push({ top, bottom, isUp });
            lastPrice = isUp ? lastPrice + boxSize : lastPrice - boxSize;
            diff = c.close - lastPrice;
        }
    });

    bricks.forEach((brick, i) => {
        const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
        const yTop = scaleEngine.priceToY(brick.top);
        const yBottom = scaleEngine.priceToY(brick.bottom);
        ctx.fillStyle = brick.isUp ? '#26a69a' : '#ef5350';
        ctx.fillRect(x, Math.min(yTop, yBottom), candleWidth, Math.abs(yTop - yBottom));
        ctx.strokeStyle = '#000';
        ctx.strokeRect(x, Math.min(yTop, yBottom), candleWidth, Math.abs(yTop - yBottom));
    });
  }

  /**
   * 🚀 新價線 (Line Break)
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
    if (candles.length === 0) return;
    const breakCount = 3;
    let lines: { open: number, close: number }[] = [];
    
    candles.forEach(c => {
        if (lines.length === 0) {
            lines.push({ open: c.open, close: c.close });
            return;
        }
        const lastLine = lines[lines.length - 1];
        const isUp = lastLine.close > lastLine.open;

        if (isUp) {
            if (c.close > lastLine.close) {
                lines.push({ open: lastLine.close, close: c.close });
            } else if (lines.length >= breakCount) {
                const minLow = Math.min(...lines.slice(-breakCount).map(l => Math.min(l.open, l.close)));
                if (c.close < minLow) lines.push({ open: lastLine.close, close: c.close });
            }
        } else {
            if (c.close < lastLine.close) {
                lines.push({ open: lastLine.close, close: c.close });
            } else if (lines.length >= breakCount) {
                const maxHigh = Math.max(...lines.slice(-breakCount).map(l => Math.max(l.open, l.close)));
                if (c.close > maxHigh) lines.push({ open: lastLine.close, close: c.close });
            }
        }
    });

    lines.forEach((line, i) => {
        const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
        const yOpen = scaleEngine.priceToY(line.open);
        const yClose = scaleEngine.priceToY(line.close);
        ctx.fillStyle = line.close > line.open ? '#26a69a' : '#ef5350';
        ctx.fillRect(x, Math.min(yOpen, yClose), candleWidth, Math.abs(yOpen - yClose));
    });
  }

  /**
   * 🚀 卡吉圖 (Kagi)
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
    const reversal = 15; // 反轉值
    let points: { y: number, isYang: boolean }[] = [];
    let lastY = candles[0].close;
    let direction = 0; // 1: up, -1: down
    let isYang = true;

    candles.forEach(c => {
        const diff = c.close - lastY;
        if (direction === 0) {
            if (Math.abs(diff) >= reversal) direction = diff > 0 ? 1 : -1;
        } else if (direction === 1) {
            if (c.close > lastY) lastY = c.close;
            else if (diff <= -reversal) {
                points.push({ y: lastY, isYang });
                direction = -1; lastY = c.close;
            }
        } else {
            if (c.close < lastY) lastY = c.close;
            else if (diff >= reversal) {
                points.push({ y: lastY, isYang });
                direction = 1; lastY = c.close;
            }
        }
    });

    ctx.lineWidth = 2;
    let currX = scaleEngine.indexToX(sliceStartIndex, exactStartIndex, candleWidth, spacing);
    ctx.beginPath();
    points.forEach((p, i) => {
        const y = scaleEngine.priceToY(p.y);
        if (i === 0) ctx.moveTo(currX, y);
        else {
            ctx.lineTo(currX, y);
            currX += candleWidth + spacing;
            ctx.lineTo(currX, y);
        }
        ctx.strokeStyle = p.isYang ? '#26a69a' : '#ef5350';
        ctx.stroke();
    });
  }

  /**
   * 🚀 點數圖 (Point & Figure)
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
    ctx.font = `${Math.floor(candleWidth)}px sans-serif`;
    ctx.textAlign = 'center';

    candles.forEach((c, i) => {
        const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing) + candleWidth / 2;
        const isUp = c.close > c.open;
        const startY = Math.min(c.open, c.close);
        const endY = Math.max(c.open, c.close);
        
        ctx.fillStyle = isUp ? '#26a69a' : '#ef5350';
        for (let yPrice = startY; yPrice <= endY; yPrice += boxSize) {
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
