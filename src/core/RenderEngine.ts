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
    ctx.strokeStyle = '#232631'; 
    ctx.lineWidth = 1;
    
    const drawWidth = scaleEngine.getDrawWidth();
    const drawHeight = scaleEngine.getDrawHeight();

    ctx.beginPath();
    
    // 🚨 修正：使用整數價格刻度繪製網格線
    const ticks = scaleEngine.getNiceTickSteps();
    for (const price of ticks) {
      const y = scaleEngine.priceToY(price);
      ctx.moveTo(0, y);
      ctx.lineTo(drawWidth, y);
    }
    ctx.stroke();

    // 繪製右側與下方的軸線
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
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    getTimeAtIndex: (index: number) => number, // 🚨 改為回調函數
    scaleEngine: ScaleEngine
  ): void {
    const ctx = this.gridCtx; 
    const drawWidth = scaleEngine.getDrawWidth();
    const drawHeight = scaleEngine.getDrawHeight();
    
    ctx.fillStyle = '#929498';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const ticks = scaleEngine.getNiceTickSteps();
    for (const price of ticks) {
      const y = scaleEngine.priceToY(price);
      ctx.fillText(price.toFixed(2), drawWidth + 5, y);
    }

    ctx.textAlign = 'center';
    
    if (candles.length === 0) return;

    const visibleCount = drawWidth / (candleWidth + spacing);
    const endIndex = Math.ceil(exactStartIndex + visibleCount);
    
    let lastLabelX = -100;

    for (let idx = Math.floor(exactStartIndex); idx <= endIndex; idx++) {
      // 🚨 使用精確的回調獲取時間
      const time = getTimeAtIndex(idx);
      const date = new Date(time);
      
      let shouldShow = false;
      let label = "";
      let isBold = false;

      const mins = date.getUTCMinutes();
      const secs = date.getUTCSeconds();
      const hours = date.getUTCHours();

      // 🚨 統一使用 UTC 邏輯判斷邊界 (符合 OKX 規範)
      const isNewDay = hours === 0 && mins === 0 && secs === 0;

      // 根據座標計算當前的「密度」來決定顯示頻率 (這裡簡化處理)
      if (isNewDay) {
        shouldShow = true;
        isBold = true;
        label = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
      } else {
        if (mins % 5 === 0 && secs === 0) {
          shouldShow = true;
          label = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        }
      }

      const x = scaleEngine.indexToX(idx, exactStartIndex, candleWidth, spacing);
      const centerX = x + candleWidth / 2;

      if (centerX < 0 || centerX > drawWidth) continue;

      if (shouldShow && centerX > lastLabelX + 70) {
        ctx.fillStyle = isBold ? '#fff' : '#929498';
        ctx.fillText(label, centerX, drawHeight + 15);
        lastLabelX = centerX;
      }
    }
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
    const drawWidth = scaleEngine.getDrawWidth();
    const drawHeight = scaleEngine.getDrawHeight();
    
    ctx.clearRect(0, 0, this.width, this.height);

    // 🚨 裁剪區域：確保 K 棒繪製被限制在左側繪圖區內
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, drawWidth, drawHeight);
    ctx.clip();

    const bodyWidth = Math.max(0.1, candleWidth);
    
    // 🚨 效能與對齊優化：如果 K 棒太細 (例如小於 1.5px)，直接畫一條線即可
    const isVeryThin = bodyWidth < 1.5;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const actualIndex = sliceStartIndex + i;
      const x = scaleEngine.indexToX(actualIndex, exactStartIndex, candleWidth, spacing);
      
      // 🚨 這裡改用 drawWidth 判斷，避免越過右側價格軸
      if (x + bodyWidth < 0 || x > drawWidth) continue;

      const trueCenter = x + bodyWidth / 2;
      const centerX = Math.floor(trueCenter) + 0.5;

      const yOpen = scaleEngine.priceToY(candle.open);
      const yClose = scaleEngine.priceToY(candle.close);
      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);

      const isUp = candle.close >= candle.open;
      const color = isUp ? '#26a69a' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      if (isVeryThin) {
        // 🚨 極小縮放模式：只畫一條線，解決「雙線」問題
        ctx.beginPath();
        ctx.moveTo(centerX, Math.floor(yHigh));
        ctx.lineTo(centerX, Math.floor(yLow));
        ctx.stroke();
      } else {
        // 標準模式：實體 + 影線
        const rectW = Math.max(1, Math.floor(bodyWidth));
        const rectX = Math.floor(centerX - rectW / 2);

        // 1. 影線
        ctx.beginPath();
        ctx.moveTo(centerX, Math.floor(yHigh));
        ctx.lineTo(centerX, Math.floor(yLow));
        ctx.stroke();

        // 2. 實體
        const rectY = Math.floor(Math.min(yOpen, yClose));
        const rectH = Math.max(1, Math.floor(Math.abs(yOpen - yClose)));
        ctx.fillRect(rectX, rectY, rectW, rectH);
      }
    }

    ctx.restore(); // 🚨 解除裁剪
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
  public drawLastPriceLine(price: number, color: string, scaleEngine: ScaleEngine): void {
    const ctx = this.candleCtx; // 繪製在 K 線層，或可分層
    const y = scaleEngine.priceToY(price);
    
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = color; // 使用傳入的顏色
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(this.width, y);
    ctx.stroke();
    ctx.restore();

    // 繪製價格標籤
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
