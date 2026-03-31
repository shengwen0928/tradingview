import { Candle } from '../types/Candle';
import { ScaleEngine } from './ScaleEngine';

/**
 * 負責 Canvas 渲染與分層繪製
 */
export class RenderEngine {
  private gridCtx: CanvasRenderingContext2D;
  private candleCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  private dpr: number = window.devicePixelRatio || 1;

  constructor(
    private gridCanvas: HTMLCanvasElement,
    private candleCanvas: HTMLCanvasElement,
    private overlayCanvas: HTMLCanvasElement
  ) {
    this.gridCtx = gridCanvas.getContext('2d')!;
    this.candleCtx = candleCanvas.getContext('2d')!;
    this.overlayCtx = overlayCanvas.getContext('2d')!;
  }

  /**
   * 處理 DPI 縮放與視窗大小變化
   */
  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    const canvases = [this.gridCanvas, this.candleCanvas, this.overlayCanvas];
    const contexts = [this.gridCtx, this.candleCtx, this.overlayCtx];

    canvases.forEach((canvas, i) => {
      canvas.width = width * this.dpr;
      canvas.height = height * this.dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = contexts[i];
      ctx.scale(this.dpr, this.dpr);
      ctx.imageSmoothingEnabled = false;
    });
  }

  public getLogicalWidth(): number { return this.width; }
  public getLogicalHeight(): number { return this.height; }

  /**
   * 繪製背景網格
   */
  public drawGrid(scaleEngine: ScaleEngine): void {
    const ctx = this.gridCtx;
    ctx.clearRect(0, 0, this.width, this.height);
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

  /**
   * 繪製價格軸與時間軸的刻度文字
   */
  public drawAxes(
    candles: Candle[],
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    getTimeAtIndex: (index: number) => number,
    scaleEngine: ScaleEngine
  ): void {
    const ctx = this.gridCtx; 
    const drawWidth = scaleEngine.getDrawWidth();
    const drawHeight = scaleEngine.getDrawHeight();
    
    ctx.fillStyle = '#929498';
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'middle';

    // 價格標籤
    const ticks = scaleEngine.getNiceTickSteps();
    for (const price of ticks) {
      const y = scaleEngine.priceToY(price);
      ctx.textAlign = 'left';
      ctx.fillText(price.toFixed(2), drawWidth + 5, y);
    }

    ctx.textAlign = 'center';
    if (candles.length === 0) return;

    // 取得當前週期跨度 (精確計算)
    const t0 = getTimeAtIndex(0);
    const t1 = getTimeAtIndex(1);
    const interval = isNaN(t0) || isNaN(t1) ? 60000 : Math.abs(t1 - t0);

    const visibleCount = drawWidth / (candleWidth + spacing);
    const startIndex = Math.floor(exactStartIndex);
    const endIndex = Math.ceil(exactStartIndex + visibleCount);
    
    let lastLabelX = -100;

    for (let idx = startIndex; idx <= endIndex; idx++) {
      // 🚨 修正：過去不畫，未來可以畫 (推算時間)
      if (idx < 0) continue;

      const time = getTimeAtIndex(idx);
      if (isNaN(time)) continue; 

      const date = new Date(time);
      
      let shouldShow = false;
      let label = "";
      let isBold = false;

      // 使用當地時間判斷，增加易讀性 (或可改回 UTC，視需求而定)
      // 這裡改回跟 eab11dc 一致的當地時間判斷，但保留對齊邏輯
      const mins = date.getMinutes();
      const hours = date.getHours();
      const day = date.getDate();
      const month = date.getMonth();
      const year = date.getFullYear();

      if (interval < 60000) { // 秒級
        shouldShow = date.getSeconds() % 15 === 0;
        label = `${hours}:${mins.toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
      } else if (interval < 3600000) { // 分級
        shouldShow = mins % 5 === 0;
        label = `${hours}:${mins.toString().padStart(2, '0')}`;
      } else if (interval < 86400000) { // 時級
        shouldShow = hours % 4 === 0 && mins === 0;
        label = `${hours.toString().padStart(2, '0')}:00`;
      } else { // 日級、月級、年級 (跨天/跨月/跨年)
        const prevTime = getTimeAtIndex(idx - 1);
        const prevDate = !isNaN(prevTime) ? new Date(prevTime) : null;
        
        if (interval < 604800001) { // 日
          shouldShow = !prevDate || date.getDate() !== prevDate.getDate();
          label = `${month + 1}/${day}`;
        } else { // 月/年
          shouldShow = !prevDate || date.getMonth() !== prevDate.getMonth();
          label = `${month + 1}月`;
        }
      }

      // 高優先級標籤
      const isNewYear = month === 0 && day === 1 && hours === 0;
      const isNewDay = hours === 0 && mins === 0;

      if (isNewYear) {
        shouldShow = true;
        isBold = true;
        label = year.toString();
      } else if (isNewDay && interval < 86400000) {
        shouldShow = true;
        isBold = true;
        label = `${month + 1}/${day}`;
      }

      const x = scaleEngine.indexToX(idx, exactStartIndex, candleWidth, spacing);
      const centerX = x + candleWidth / 2;

      if (centerX < 0 || centerX > drawWidth) continue;

      if (shouldShow && (centerX > lastLabelX + 80 || isBold)) {
        ctx.fillStyle = isBold ? '#fff' : '#929498';
        ctx.fillText(label, centerX, drawHeight + 15);
        lastLabelX = centerX;
      }
    }
  }

  public drawCandles(
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    const ctx = this.candleCtx;
    const drawWidth = scaleEngine.getDrawWidth();
    const drawHeight = scaleEngine.getDrawHeight();
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, drawWidth, drawHeight);
    ctx.clip();

    const bodyWidth = Math.max(0.1, candleWidth);
    const isVeryThin = bodyWidth < 1.5;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const actualIndex = sliceStartIndex + i;
      const x = scaleEngine.indexToX(actualIndex, exactStartIndex, candleWidth, spacing);
      
      if (x + bodyWidth < 0 || x > drawWidth) continue;

      const trueCenter = x + bodyWidth / 2;
      const centerX = Math.floor(trueCenter) + 0.5;

      const yOpen = scaleEngine.priceToY(candle.open);
      const yClose = scaleEngine.priceToY(candle.close);
      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);

      const color = candle.close >= candle.open ? '#26a69a' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      if (isVeryThin) {
        ctx.beginPath();
        ctx.moveTo(centerX, Math.floor(yHigh));
        ctx.lineTo(centerX, Math.floor(yLow));
        ctx.stroke();
      } else {
        const rectW = Math.max(1, Math.floor(bodyWidth));
        const rectX = Math.floor(centerX - rectW / 2);
        ctx.beginPath();
        ctx.moveTo(centerX, Math.floor(yHigh));
        ctx.lineTo(centerX, Math.floor(yLow));
        ctx.stroke();
        const rectY = Math.floor(Math.min(yOpen, yClose));
        const rectH = Math.max(1, Math.floor(Math.abs(yOpen - yClose)));
        ctx.fillRect(rectX, rectY, rectW, rectH);
      }
    }
    ctx.restore();
  }

  /**
   * 繪製指標線 (如 MA, EMA)
   */
  public drawIndicator(
    values: number[],
    startIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    color: string,
    scaleEngine: ScaleEngine
  ): void {
    const ctx = this.candleCtx;
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

  public drawCrosshair(mouseX: number, mouseY: number, price: string, time: string): void {
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#758696';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.floor(mouseX) + 0.5, 0);
    ctx.lineTo(Math.floor(mouseX) + 0.5, this.height);
    ctx.moveTo(0, Math.floor(mouseY) + 0.5);
    ctx.lineTo(this.width, Math.floor(mouseY) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    this.drawLabel(ctx, price, this.width - 40, mouseY, '#363c4e');
    this.drawLabel(ctx, time, mouseX, this.height - 10, '#363c4e');
  }

  public drawLastPriceLine(price: number, color: string, scaleEngine: ScaleEngine): void {
    const ctx = this.candleCtx;
    const y = scaleEngine.priceToY(price);
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.width, y);
    ctx.stroke();
    ctx.restore();
    this.drawLabel(ctx, price.toFixed(2), this.width - 40, y, color);
  }

  private drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bgColor: string): void {
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
}
