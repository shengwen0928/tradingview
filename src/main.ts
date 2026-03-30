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
  private connectionStatus: string = 'connecting';
  private currentSymbol: string = 'BTC-USDT'; // 🚨 新增：記錄當前幣種

  constructor() {
    const gridCanvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    const candleCanvas = document.getElementById('candle-canvas') as HTMLCanvasElement;
    const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    const symbolSelect = document.getElementById('symbol-select') as HTMLSelectElement;
    const timeframeSelect = document.getElementById('timeframe-select') as HTMLSelectElement;

    this.renderEngine = new RenderEngine(gridCanvas, candleCanvas, overlayCanvas);
    this.scaleEngine = new ScaleEngine();
    this.viewport = new ViewportEngine(() => this.requestRedraw());
    
    this.dataManager = new DataManager(
      (candles, isHistory) => {
        // setDataCount 內部會呼叫 onRangeChanged，進而觸發 requestRedraw
        this.viewport.setDataCount(candles.length, isHistory);
      },
      (status) => {
        this.connectionStatus = status;
        this.updateStatusUI();
      }
    );

    // 🚨 監聽幣種切換
    symbolSelect.addEventListener('change', () => {
      this.currentSymbol = symbolSelect.options[symbolSelect.selectedIndex].text;
      this.dataManager.setSymbol(symbolSelect.value);
      this.scaleEngine.resetAutoScale(); // 切換幣種時恢復自動縮放
    });

    // 🚨 監聽週期切換
    timeframeSelect.addEventListener('change', () => {
      this.dataManager.setTimeframe(timeframeSelect.value);
      this.scaleEngine.resetAutoScale(); // 切換週期時恢復自動縮放
    });

    this.loader = new LoaderController(this.dataManager, this.viewport);

    this.interaction = new InteractionEngine(
      overlayCanvas,
      (deltaX, deltaY, zone) => {
        if (zone === 'price') {
          // 🚨 右側價格軸：僅垂直移動
          this.scaleEngine.handleVerticalPan(deltaY);
        } else {
          // 🚨 圖表區域：自由移動 (上下左右)
          this.viewport.handleScroll(deltaX);
          this.scaleEngine.handleVerticalPan(deltaY);
        }
        
        this.loader.checkLoadMore();
        this.requestRedraw();
      },
      (mouseX, mouseY, scale, zone) => {
        if (zone === 'price') {
          // 🚨 右側價格軸：垂直縮放
          this.scaleEngine.handleVerticalZoom(scale);
        } else if (zone === 'time') {
          // 🚨 下方時間軸：水平縮放 (以畫面中心為準)
          this.viewport.handleZoom(this.renderEngine.getLogicalWidth() / 2, scale, this.renderEngine.getLogicalWidth());
        } else {
          // 🚨 圖表區域：以滑鼠為中心縮放
          this.viewport.handleZoom(mouseX, scale, this.renderEngine.getLogicalWidth());
        }
        
        this.loader.checkLoadMore();
        this.requestRedraw();
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
    
    // 更新：傳遞精確的範圍參數以對齊時間軸刻度
    this.renderEngine.drawAxes(
      visibleCandles, 
      start, 
      startIndex, 
      candleWidth, 
      2, 
      this.dataManager.getIntervalMs(), 
      this.scaleEngine
    );
    
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
      const isUp = lastCandle.close >= lastCandle.open;
      const color = isUp ? '#26a69a' : '#ef5350';
      this.renderEngine.drawLastPriceLine(lastCandle.close, color, this.scaleEngine);
    }

    // 🚨 每一幀重繪時更新 UI 狀態文字
    this.updateStatusUI();
  }

  private updateStatusUI() {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;

    if (this.connectionStatus === 'connected') {
      dot.style.background = '#26a69a';
      dot.style.boxShadow = '0 0 5px #26a69a';
      text.innerText = `${this.currentSymbol} Live | Visible: ${Math.round(this.viewport.getVisibleCount())}`;
    } else if (this.connectionStatus === 'connecting') {
      dot.style.background = '#ffa726';
      dot.style.boxShadow = '0 0 5px #ffa726';
      text.innerText = 'Connecting...';
    } else {
      dot.style.background = '#ef5350';
      dot.style.boxShadow = '0 0 5px #ef5350';
      text.innerText = 'Disconnected';
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
