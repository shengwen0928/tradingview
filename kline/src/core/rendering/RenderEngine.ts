import { Candle, ChartType } from '../../types/Candle';
import { ScaleEngine } from '../engines/ScaleEngine';
import { BasicCandleRenderer } from './renderers/BasicCandleRenderer';
import { LineChartRenderer } from './renderers/LineChartRenderer';
import { AdvancedChartRenderer } from './renderers/AdvancedChartRenderer';
import { IndicatorRenderer } from './renderers/IndicatorRenderer';

/**
 * 負責 Canvas 渲染協調與分層調度
 */
export class RenderEngine {
  private gridCtx: CanvasRenderingContext2D;
  private candleCtx: CanvasRenderingContext2D;
  private overlayCtx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  private dpr: number = window.devicePixelRatio || 1;

  // 🚀 專用渲染器實例
  private basicRenderer = new BasicCandleRenderer();
  private lineRenderer = new LineChartRenderer();
  private advancedRenderer = new AdvancedChartRenderer();
  private indicatorRenderer = new IndicatorRenderer();

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
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    });
  }

  public getLogicalWidth(): number { return this.width; }
  public getLogicalHeight(): number { return this.height; }
  public getOverlayCanvas(): HTMLCanvasElement { return this.overlayCanvas; }
  public getOverlayContext(): CanvasRenderingContext2D { return this.overlayCtx; }

  /**
   * 清理互動層 (十字線、預覽點等)
   */
  public clearOverlay(): void {
    this.overlayCtx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * 繪製背景網格
   */
  public drawGrid(scaleEngine: ScaleEngine): void {
    this.indicatorRenderer.drawGrid(this.gridCtx, this.width, this.height, scaleEngine);
  }

  /**
   * 繪製價格軸與時間軸刻度
   */
  public drawAxes(
    _candles: Candle[],
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

    const ticks = scaleEngine.getNiceTickSteps();
    for (const price of ticks) {
      const y = scaleEngine.priceToY(price);
      ctx.textAlign = 'left';
      ctx.fillText(price.toFixed(2), drawWidth + 5, y);
    }

    ctx.textAlign = 'center';
    
    // 🚀 重寫：基於密度的時間軸渲染
    const startIndex = Math.floor(exactStartIndex);
    const visibleCount = drawWidth / (candleWidth + spacing);
    const endIndex = Math.ceil(exactStartIndex + visibleCount);
    
    let lastLabelX = -200;
    const minLabelSpacing = 100; // 每個時間標籤最少間隔 100px

    for (let idx = startIndex; idx <= endIndex; idx++) {
      if (idx < 0) continue;
      const time = getTimeAtIndex(idx);
      if (isNaN(time)) continue; 

      const x = scaleEngine.indexToX(idx, exactStartIndex, candleWidth, spacing);
      const centerX = x + candleWidth / 2;
      if (centerX < 0 || centerX > drawWidth) continue;

      // 只有當距離上一個標籤夠遠時才繪製
      if (centerX > lastLabelX + minLabelSpacing) {
        const date = new Date(time);
        const label = this.formatAutoTimeLabel(date);
        ctx.fillStyle = '#929498';
        ctx.fillText(label, centerX, drawHeight + 15);
        lastLabelX = centerX;
      }
    }
  }

  /**
   * 自動格式化時間標籤 (根據日期變化調整)
   */
  private formatAutoTimeLabel(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate();
    const month = date.getMonth() + 1;
    
    if (hours === '00' && mins === '00') {
        return `${month}/${day}`;
    }
    return `${hours}:${mins}`;
  }

  /**
   * 核心調度方法：根據類型委派繪圖
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
      case 'bars':
        this.basicRenderer.renderBars(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      case 'hollow':
        this.basicRenderer.renderHollowCandles(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      case 'volume_candles':
        this.basicRenderer.renderVolumeCandles(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      case 'line':
        this.lineRenderer.renderLineChart(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice, 'line');
        break;
      case 'line_with_markers':
        this.lineRenderer.renderLineChart(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice, 'markers');
        break;
      case 'step_line':
        this.lineRenderer.renderLineChart(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice, 'step');
        break;
      case 'area':
        this.lineRenderer.renderLineChart(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice, 'area');
        break;
      case 'hlc_area':
        this.lineRenderer.renderHLCArea(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      case 'baseline':
        this.lineRenderer.renderBaseline(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice, this.width, this.height);
        break;
      case 'columns':
        this.advancedRenderer.renderColumns(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      case 'high_low':
        this.advancedRenderer.renderHighLow(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      case 'volume_footprint':
        this.advancedRenderer.renderVolumeFootprint(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      case 'tpo':
        this.advancedRenderer.renderTPO(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      case 'volume_profile':
        this.advancedRenderer.renderVolumeProfile(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      case 'renko':
        this.advancedRenderer.renderRenko(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine);
        break;
      case 'line_break':
        this.advancedRenderer.renderLineBreak(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine);
        break;
      case 'kagi':
        this.advancedRenderer.renderKagi(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine);
        break;
      case 'point_and_figure':
        this.advancedRenderer.renderPointAndFigure(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine);
        break;
      case 'range':
        this.advancedRenderer.renderRange(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine);
        break;
      case 'heikin_ashi':
        this.renderHeikinAshi(candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
      default:
        this.basicRenderer.renderNormalCandles(ctx, candles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
        break;
    }

    ctx.restore();
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
    if (candles.length === 0) return;
    let haPrevOpen = candles[0].open;
    let haPrevClose = candles[0].close;

    const haCandles = candles.map((c, i) => {
      const close = (c.open + c.high + c.low + c.close) / 4;
      const open = i === 0 ? (c.open + c.close) / 2 : (haPrevOpen + haPrevClose) / 2;
      const high = Math.max(c.high, open, close);
      const low = Math.min(c.low, open, close);
      haPrevOpen = open; haPrevClose = close;
      return { time: c.time, open, high, low, close, volume: c.volume };
    });

    this.basicRenderer.renderNormalCandles(this.candleCtx, haCandles, sliceStartIndex, exactStartIndex, candleWidth, spacing, scaleEngine, visualLastPrice);
  }

  public drawIndicator(
    values: number[],
    startIndex: number,
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    color: string,
    scaleEngine: ScaleEngine
  ): void {
    this.indicatorRenderer.drawIndicator(this.candleCtx, values, startIndex, exactStartIndex, candleWidth, spacing, color, scaleEngine);
  }

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
    this.indicatorRenderer.drawLabel(ctx, price, this.width - 40, mouseY, '#363c4e');
    this.indicatorRenderer.drawLabel(ctx, time, mouseX, this.height - 10, '#363c4e');
  }

  public drawPreviewPoint(x: number, y: number): void {
    const ctx = this.overlayCtx;
    ctx.fillStyle = '#2962ff'; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill(); ctx.globalAlpha = 1.0;
  }

  public drawLastPriceLine(price: number, color: string, scaleEngine: ScaleEngine): void {
    const ctx = this.candleCtx;
    const y = scaleEngine.priceToY(price);
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y);
    ctx.stroke();
    ctx.restore();
    this.indicatorRenderer.drawLabel(ctx, price.toFixed(2), this.width - 40, y, color);
  }

  public drawMinMaxLabels(
    highCandle: { price: number, index: number },
    lowCandle: { price: number, index: number },
    exactStartIndex: number,
    candleWidth: number,
    spacing: number,
    scaleEngine: ScaleEngine
  ): void {
    this.indicatorRenderer.drawMinMaxLabels(this.candleCtx, highCandle, lowCandle, exactStartIndex, candleWidth, spacing, scaleEngine);
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
}
