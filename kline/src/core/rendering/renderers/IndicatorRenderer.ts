import { ScaleEngine } from '../engines/ScaleEngine';

/**
 * 負責指標與輔助渲染 (Indicators, Grid, Axes, Crosshair, Labels)
 */
export class IndicatorRenderer {
  public drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, scaleEngine: ScaleEngine): void {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#232631'; 
    ctx.lineWidth = 1;
    
    const drawWidth = scaleEngine.getDrawWidth();
    const drawHeight = scaleEngine.getDrawHeight();

    ctx.beginPath();
    const ticks = scaleEngine.getNiceTickSteps();
    for (const price of ticks) {
      const y = scaleEngine.priceToY(price);
      ctx.moveTo(0, y);
      ctx.lineTo(drawWidth, y);
    }
    ctx.stroke();

    ctx.strokeStyle = '#363c4e';
    ctx.beginPath();
    ctx.moveTo(drawWidth, 0);
    ctx.lineTo(drawWidth, drawHeight);
    ctx.moveTo(0, drawHeight);
    ctx.lineTo(drawWidth, drawHeight);
    ctx.stroke();
  }

  public drawIndicator(
    ctx: CanvasRenderingContext2D,
    values: number[],
    startIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    color: string,
    scaleEngine: ScaleEngine
  ): void {
    const drawWidth = scaleEngine.getDrawWidth();
    const drawHeight = scaleEngine.getDrawHeight();

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, drawWidth, drawHeight);
    ctx.clip();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    let first = true;
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (isNaN(val)) continue;

      const x = scaleEngine.indexToX(startIndex + i, exactStartIndex, candleWidth, spacing);
      const centerX = x + candleWidth / 2;
      const y = scaleEngine.priceToY(val);

      if (first) {
        ctx.moveTo(centerX, y);
        first = false;
      } else {
        ctx.lineTo(centerX, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  public drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bgColor: string): void {
    const padding = 4;
    ctx.font = '12px sans-serif';
    const textWidth = ctx.measureText(text).width;
    const rectW = textWidth + padding * 2;
    const rectH = 18;
    ctx.fillStyle = bgColor;
    ctx.fillRect(x - rectW / 2, y - rectH / 2, rectW, rectH);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  public drawMinMaxLabels(
    ctx: CanvasRenderingContext2D,
    highCandle: { price: number, index: number },
    lowCandle: { price: number, index: number },
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const drawLabel = (price: number, index: number, isHigh: boolean) => {
      const x = (index - exactStartIndex) * (candleWidth + spacing) + candleWidth / 2;
      const y = scaleEngine.priceToY(price);
      const text = `${isHigh ? '▼ ' : '▲ '}${price.toFixed(2)}`;
      
      const labelY = isHigh ? y - 12 : y + 12;

      ctx.fillStyle = isHigh ? '#ef5350' : '#26a69a';
      ctx.fillText(text, x, labelY);

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, isHigh ? labelY + 5 : labelY - 5);
      ctx.strokeStyle = 'rgba(209, 212, 220, 0.3)';
      ctx.stroke();
    };

    if (!isNaN(highCandle.price)) drawLabel(highCandle.price, highCandle.index, true);
    if (!isNaN(lowCandle.price)) drawLabel(lowCandle.price, lowCandle.index, false);
    ctx.restore();
  }
}
