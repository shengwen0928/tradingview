import { Candle, ChartType } from '../types/Candle';
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
      canvas.width = Math.round(width * this.dpr);
      canvas.height = Math.round(height * this.dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = contexts[i];
      ctx.scale(this.dpr, this.dpr);
      // 🚀 開啟抗鋸齒，讓曲線和文字更清晰絲滑
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    });
  }

  public getLogicalWidth(): number { return this.width; }
  public getLogicalHeight(): number { return this.height; }

  // 🚀 補上重構所需的 Getter
  public getOverlayCanvas(): HTMLCanvasElement { return this.overlayCanvas; }
  public getOverlayContext(): CanvasRenderingContext2D { return this.overlayCtx; }

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

  /**
   * 🚀 主繪圖入口：根據 ChartType 決定渲染方式
   */
  public drawMainChart(
    chartType: ChartType,
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    const ctx = this.candleCtx;
    const drawWidth = scaleEngine.getDrawWidth();
    const drawHeight = scaleEngine.getDrawHeight();
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, drawWidth, drawHeight);
    ctx.clip();

    switch (chartType) {
      case 'hollow':
        this.renderHollowCandles(candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      case 'line':
        this.renderLineChart(candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice, false);
        break;
      case 'area':
        this.renderLineChart(candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice, true);
        break;
      case 'heikin_ashi':
        this.renderHeikinAshi(candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      default:
        this.renderNormalCandles(candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
    }

    ctx.restore();
  }

  private renderNormalCandles(
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    const ctx = this.candleCtx;
    const drawWidth = scaleEngine.getDrawWidth();
    const bodyWidth = Math.max(0.1, candleWidth);
    const isVeryThin = bodyWidth < 1.5;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
      if (x + bodyWidth < 0 || x > drawWidth) continue;

      const centerX = Math.floor(x + bodyWidth / 2) + 0.5;
      const yOpen = scaleEngine.priceToY(candle.open);
      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candle.close;
      const yClose = scaleEngine.priceToY(displayClose);
      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);

      const color = displayClose >= candle.open ? '#26a69a' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      if (isVeryThin) {
        ctx.beginPath();
        ctx.moveTo(centerX, yHigh);
        ctx.lineTo(centerX, yLow);
        ctx.stroke();
      } else {
        const rectW = Math.max(1, Math.floor(bodyWidth));
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

  private renderHollowCandles(
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    const ctx = this.candleCtx;
    const drawWidth = scaleEngine.getDrawWidth();
    const bodyWidth = Math.max(0.1, candleWidth);

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const isLast = i === candles.length - 1;
      const x = scaleEngine.indexToX(sliceStartIndex + i, exactStartIndex, candleWidth, spacing);
      if (x + bodyWidth < 0 || x > drawWidth) continue;

      const centerX = Math.floor(x + bodyWidth / 2) + 0.5;
      const displayClose = (isLast && visualLastPrice !== undefined) ? visualLastPrice : candle.close;
      const yOpen = scaleEngine.priceToY(candle.open);
      const yClose = scaleEngine.priceToY(displayClose);
      const yHigh = scaleEngine.priceToY(candle.high);
      const yLow = scaleEngine.priceToY(candle.low);

      const isUp = displayClose >= candle.open;
      const prevClose = i > 0 ? candles[i-1].close : candle.open;
      const isHigherThanPrev = displayClose >= prevClose;

      const color = isHigherThanPrev ? '#26a69a' : '#ef5350';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;

      const rectW = Math.max(1, Math.floor(bodyWidth));
      const rectX = Math.floor(centerX - rectW / 2);
      const rectY = Math.floor(Math.min(yOpen, yClose));
      const rectH = Math.max(1, Math.floor(Math.abs(yOpen - yClose)));

      ctx.beginPath();
      ctx.moveTo(centerX, yHigh);
      ctx.lineTo(centerX, yLow);
      ctx.stroke();

      if (isUp) {
        ctx.strokeRect(rectX + 0.5, rectY + 0.5, rectW - 1, rectH - 1);
      } else {
        ctx.fillRect(rectX, rectY, rectW, rectH);
      }
    }
  }

  private renderLineChart(
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice: number | undefined,
    isArea: boolean
  ): void {
    const ctx = this.candleCtx;
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
        ctx.lineTo(centerX, y);
      }
      lastX = centerX;
    }
    ctx.stroke();

    if (isArea && candles.length > 0) {
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

  private renderHeikinAshi(
    candles: Candle[],
    sliceStartIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine,
    visualLastPrice?: number
  ): void {
    let haPrevOpen = candles[0].open;
    let haPrevClose = candles[0].close;

    const haCandles = candles.map((c, i) => {
      const close = (c.open + c.high + c.low + c.close) / 4;
      const open = i === 0 ? (c.open + c.close) / 2 : (haPrevOpen + haPrevClose) / 2;
      const high = Math.max(c.high, open, close);
      const low = Math.min(c.low, open, close);
      haPrevOpen = open;
      haPrevClose = close;
      return { time: c.time, open, high, low, close, volume: c.volume };
    });

    this.renderNormalCandles(haCandles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
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

  /**
   * 🚀 新增：繪製多組動態指標 (來自 PineEngine)
   */
  public drawIndicators(
    plots: any[],
    start: number,
    end: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    plots.forEach(plot => {
        const visibleData = plot.data.slice(start, end);
        this.drawIndicator(visibleData, start, exactStartIndex, candleWidth, spacing, plot.color, scaleEngine);
    });
  }

  public drawCrosshair(mouseX: number, mouseY: number, price: string, time: string): void {
    const ctx = this.overlayCtx;
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

  public drawPreviewPoint(x: number, y: number): void {
    const ctx = this.overlayCtx;
    ctx.fillStyle = '#2962ff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
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

  /**
   * 🚀 新增：繪製畫面內最高與最低點標籤
   */
  public drawMinMaxLabels(
    highCandle: { price: number, index: number },
    lowCandle: { price: number, index: number },
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    const ctx = this.candleCtx;
    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const drawLabel = (price: number, index: number, isHigh: boolean) => {
      const x = (index - exactStartIndex) * (candleWidth + spacing) + candleWidth / 2;
      const y = scaleEngine.priceToY(price);
      const text = `${isHigh ? '▼ ' : '▲ '}${price.toFixed(2)}`;
      
      const labelY = isHigh ? y - 12 : y + 12;

      // 🚀 只畫文字，不畫框
      ctx.fillStyle = isHigh ? '#ef5350' : '#26a69a'; // 使用紅/綠區分
      ctx.fillText(text, x, labelY);

      // 畫一條極淡的指引線
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

  public drawIndicatorLabels(labels: any[], exactStartIndex: number, candleWidth: number, spacing: number, scaleEngine: ScaleEngine): void {
    const ctx = this.candleCtx;
    ctx.save();
    labels.forEach(l => {
        const x = (l.x - exactStartIndex) * (candleWidth + spacing) + candleWidth / 2;
        const y = scaleEngine.priceToY(l.y);
        ctx.fillStyle = l.textcolor || '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.text, x, l.style === 'down' ? y + 15 : y - 10);
    });
    ctx.restore();
  }

  public drawIndicatorBoxes(boxes: any[], exactStartIndex: number, candleWidth: number, spacing: number, scaleEngine: ScaleEngine): void {
    const ctx = this.candleCtx;
    ctx.save();
    boxes.forEach(b => {
        const x1 = (b.left - exactStartIndex) * (candleWidth + spacing);
        const x2 = (b.right - exactStartIndex) * (candleWidth + spacing) + candleWidth;
        const y1 = scaleEngine.priceToY(b.top);
        const y2 = scaleEngine.priceToY(b.bottom);
        
        ctx.fillStyle = b.bgcolor || 'rgba(255,255,255,0.1)';
        ctx.strokeStyle = b.border_color || '#fff';
        ctx.fillRect(x1, Math.min(y1, y2), x2 - x1, Math.abs(y2 - y1));
        ctx.strokeRect(x1, Math.min(y1, y2), x2 - x1, Math.abs(y2 - y1));
    });
    ctx.restore();
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
