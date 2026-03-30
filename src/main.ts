import { DataManager } from './core/DataManager';
import { ViewportEngine } from './core/ViewportEngine';
import { ScaleEngine } from './core/ScaleEngine';
import { RenderEngine } from './core/RenderEngine';
import { InteractionEngine } from './core/InteractionEngine';
import { LoaderController } from './core/LoaderController';
import { formatPrice, formatTime, formatFullTime } from './utils/math';

/**
 * 圖表引擎核心進入點
 */
class ChartEngine {
  private dataManager: DataManager;
  private viewport: ViewportEngine;
  private scaleEngine: ScaleEngine;
  private renderEngine: RenderEngine;
  private interaction: InteractionEngine;
  private loader: LoaderController;

  constructor() {
    const gridCanvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    const candleCanvas = document.getElementById('candle-canvas') as HTMLCanvasElement;
    const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;

    this.renderEngine = new RenderEngine(gridCanvas, candleCanvas, overlayCanvas);
    this.scaleEngine = new ScaleEngine();
    this.viewport = new ViewportEngine(() => this.requestRedraw());
    
    this.dataManager = new DataManager(
      (candles, isHistory) => {
        // setDataCount 內部會呼叫 onRangeChanged，進而觸發 requestRedraw
        this.viewport.setDataCount(candles.length, isHistory);
      },
      (status) => {
        const dot = document.getElementById('status-dot');
        const text = document.getElementById('status-text');
        if (!dot || !text) return;

        if (status === 'connected') {
          dot.style.background = '#26a69a';
          dot.style.boxShadow = '0 0 5px #26a69a';
          text.innerText = 'BTC-USDT Live';
        } else if (status === 'connecting') {
          dot.style.background = '#ffa726';
          dot.style.boxShadow = '0 0 5px #ffa726';
          text.innerText = 'Connecting...';
        } else {
          dot.style.background = '#ef5350';
          dot.style.boxShadow = '0 0 5px #ef5350';
          text.innerText = 'Disconnected';
        }
      }
    );

    this.loader = new LoaderController(this.dataManager, this.viewport);

    this.interaction = new InteractionEngine(
      overlayCanvas,
      (deltaX) => {
        this.viewport.handleScroll(deltaX);
        this.loader.checkLoadMore();
      },
      (mouseX, scale) => {
        this.viewport.handleZoom(mouseX, scale, this.renderEngine.getLogicalWidth());
      },
      (mouseX, mouseY) => {
        this.updateCrosshair(mouseX, mouseY);
      }
    );

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    
    this.init();
  }

  private handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderEngine.resize(width, height);
    this.scaleEngine.updateDimensions(width, height);
    this.requestRedraw();
  }

  private async init() {
    await this.dataManager.loadInitialData();
  }

  private isRedrawRequested = false;

  private requestRedraw() {
    if (this.isRedrawRequested) return;
    this.isRedrawRequested = true;
    requestAnimationFrame(() => {
      try {
        this.draw();
      } finally {
        this.isRedrawRequested = false;
      }
    });
  }

  private draw() {
    // console.log('[Render] Drawing Frame...'); // 偵錯用
    const candles = this.dataManager.getCandles();
    const { start, end } = this.viewport.getVisibleRange();
    const { startIndex } = this.viewport.getRawRange(); // 取得精確的浮點數起始點
    
    const visibleCandles = candles.slice(start, end);
    const candleWidth = this.viewport.getCandleWidth();

    this.scaleEngine.updateScale(visibleCandles);
    this.renderEngine.drawGrid(this.scaleEngine);
    this.renderEngine.drawAxes(visibleCandles, start, this.scaleEngine);
    
    // 渲染時傳遞：資料切片、該切片的第一根索引、精確的視窗起始索引
    this.renderEngine.drawCandles(
      visibleCandles,
      start, // 切片的開始索引
      startIndex, // 精確的浮點數視窗開始索引
      candleWidth,
      2,
      this.scaleEngine
    );

    // 繪製最新成交價橫線
    const lastCandle = candles[candles.length - 1];
    if (lastCandle) {
      this.renderEngine.drawLastPriceLine(lastCandle.close, this.scaleEngine);
    }
  }

  private updateCrosshair(mouseX: number, mouseY: number) {
    const price = this.scaleEngine.yToPrice(mouseY);
    const candles = this.dataManager.getCandles();
    const { startIndex, endIndex } = this.viewport.getRawRange();
    
    const visibleCount = endIndex - startIndex;
    const ratio = mouseX / this.renderEngine.getLogicalWidth();
    const dataIndex = Math.floor(startIndex + visibleCount * ratio);
    
    const candle = candles[dataIndex];
    const timeStr = candle ? formatFullTime(candle.time) : '';
    const priceStr = formatPrice(price);

    this.renderEngine.drawCrosshair(mouseX, mouseY, priceStr, timeStr);
  }
}

// 啟動引擎
window.onload = () => {
  new ChartEngine();
};
