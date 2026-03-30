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
      // 設定物理像素大小
      canvas.width = width * this.dpr;
      canvas.height = height * this.dpr;
      
      // 設定 CSS 顯示大小
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // 縮放座標系統
      const ctx = contexts[i];
      ctx.scale(this.dpr, this.dpr);
      
      // 改善線條清晰度 (抗鋸齒優化)
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
    ctx.strokeStyle = '#232631'; // 稍淡的網格色
    ctx.lineWidth = 1;
    ctx.beginPath();

    const { min, max } = scaleEngine.getMinMax();
    const range = max - min;
    
    // 繪製橫向價格線
    const step = range / 10;
    for (let i = 0; i <= 10; i++) {
      const price = min + step * i;
      const y = scaleEngine.priceToY(price);
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
  }

  /**
   * 繪製 K 線
   * @param sliceStartIndex 切片數據在原數組中的開始 index
   * @param exactStartIndex 視窗目前精確的開始 index (浮點數)
   */
  public drawCandles(
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    const ctx = this.candleCtx;
    ctx.clearRect(0, 0, this.width, this.height);

    const bodyWidth = Math.max(1, candleWidth);
    const halfBody = bodyWidth / 2;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      // 關鍵：使用 exactStartIndex 作為座標偏移基準點
      const actualIndex = sliceStartIndex + i;
      const x = scaleEngine.indexToX(actualIndex, exactStartIndex, candleWidth, spacing);
      
      // 超出畫布範圍的略過不畫
      if (x + bodyWidth < 0 || x > this.width) continue;

      const centerX = Math.floor(x + halfBody) + 0.5;

      const yOpen = scaleEngine.priceToY(candle.open);
      const yClose = scaleEngine.priceToY(candle.close);
      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);

      const isUp = candle.close >= candle.open;
      const color = isUp ? '#26a69a' : '#ef5350';
      ctx.fillStyle = color;
      ctx.strokeStyle = color;

      // 繪製影線
      ctx.beginPath();
      ctx.moveTo(centerX, Math.floor(yHigh));
      ctx.lineTo(centerX, Math.floor(yLow));
      ctx.stroke();

      // 繪製實體
      const rectX = Math.floor(x);
      const rectY = Math.floor(Math.min(yOpen, yClose));
      const rectW = Math.max(1, Math.floor(bodyWidth));
      const rectH = Math.max(1, Math.floor(Math.abs(yOpen - yClose)));
      ctx.fillRect(rectX, rectY, rectW, rectH);
    }
  }

  /**
   * 繪製十字線
   */
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

    // 標籤樣式
    this.drawLabel(ctx, price, this.width - 40, mouseY, '#363c4e');
    this.drawLabel(ctx, time, mouseX, this.height - 10, '#363c4e');
  }

  /**
   * 繪製最新成交價橫線
   */
  public drawLastPriceLine(price: number, scaleEngine: ScaleEngine): void {
    const ctx = this.candleCtx; // 繪製在 K 線層，或可分層
    const y = scaleEngine.priceToY(price);
    
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#26a69a'; // 使用綠色代表最新價
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.width, y);
    ctx.stroke();
    ctx.restore();

    // 繪製價格標籤
    this.drawLabel(ctx, price.toFixed(2), this.width - 40, y, '#26a69a');
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
