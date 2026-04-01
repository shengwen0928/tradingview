import { DataManager } from './core/DataManager';
// 🚀 Deployment Trigger: 2026-03-31 20:45
import { ViewportEngine } from './core/ViewportEngine';
import { ScaleEngine } from './core/ScaleEngine';
import { RenderEngine } from './core/RenderEngine';
import { InteractionEngine } from './core/InteractionEngine';
import { LoaderController } from './core/LoaderController';
import { IndicatorEngine } from './core/IndicatorEngine';
import { DrawingEngine, DrawingObject } from './core/DrawingEngine';
import { formatPrice, formatFullTime } from './utils/math';

class ChartEngine {
  private cryptoManager: DataManager;
  private stockManager: DataManager;
  private activeManager: DataManager;
  private viewport: ViewportEngine;
  private scaleEngine: ScaleEngine;
  private renderEngine: RenderEngine;
  private loader: LoaderController;
  private indicatorEngine: IndicatorEngine;
  private drawingEngine: DrawingEngine;
  private interactionEngine: InteractionEngine;
  private overlayCanvas: HTMLCanvasElement;
  private connectionStatus: string = 'connecting';
  private currentSymbol: string = 'BTC/USDT'; 
  private currentTimeframe: string = '1m'; 
  private favorites: string[] = [];
  private activeCategory: string = 'CRYPTO';
  private hoveredDrawingId: string | null = null;

  // ... (allSymbols 定義不變)

  constructor() {
    this.overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    this.renderEngine = new RenderEngine(document.getElementById('grid-canvas') as HTMLCanvasElement, document.getElementById('candle-canvas') as HTMLCanvasElement, this.overlayCanvas);
    this.scaleEngine = new ScaleEngine();
    this.viewport = new ViewportEngine(() => this.requestRedraw());
    this.indicatorEngine = new IndicatorEngine();
    this.drawingEngine = new DrawingEngine();
    
    // 🚀 建立兩個完全獨立的數據管家實例，實現記憶體隔離
    const onDataUpdate = (candles: any[], isHistory: boolean) => {
        this.viewport.setDataCount(candles.length, isHistory);
        this.requestRedraw();
    };
    const onStatusChange = (status: any) => {
        this.connectionStatus = status;
        this.updateStatusUI();
    };

    this.cryptoManager = new DataManager(onDataUpdate, onStatusChange);
    this.stockManager = new DataManager(onDataUpdate, onStatusChange);
    
    // 預設對接 Crypto
    this.activeManager = this.cryptoManager;

    this.favorites = JSON.parse(localStorage.getItem('tf-favorites') || '["1m", "1H", "1D"]');
    this.initModalLogic();
    
    // 🚨 修正：LoaderController 需要對應當前的 Manager，我們改為在切換時重新綁定
    this.loader = new LoaderController(this.activeManager, this.viewport);

    this.interactionEngine = new InteractionEngine(
      this.overlayCanvas,
      (deltaX, deltaY, zone) => {
        if (zone === 'price') this.scaleEngine.handleVerticalPan(deltaY);
        else { this.viewport.handleScroll(deltaX); this.scaleEngine.handleVerticalPan(deltaY); }
        this.loader.checkLoadMore(); this.requestRedraw();
      },
      (mouseX, _mouseY, scale, zone) => {
        if (zone === 'price') this.scaleEngine.handleVerticalZoom(scale);
        else if (zone === 'time') this.viewport.handleZoom(this.renderEngine.getLogicalWidth() / 2, scale, this.renderEngine.getLogicalWidth());
        else this.viewport.handleZoom(mouseX, scale, this.renderEngine.getLogicalWidth());
        this.loader.checkLoadMore(); this.requestRedraw();
      },
      (mouseX, mouseY) => { this.updateCrosshair(mouseX, mouseY); }
    );

    this.initDrawingToolbar();
    this.initMagnetLogic();

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    this.init();
  }

  // ... (initMagnetLogic, initModalLogic, updateModalList 不變)

  private async loadSymbol(symbol: string) {
    let s = symbol.toUpperCase();
    let isStock = this.activeCategory.includes('STOCK') || s.includes('.TW') || s.includes('.TWO');
    
    if (/^\d{4,6}$/.test(s)) {
        isStock = true;
        const otcPrefixes = ['31', '80', '54', '61', '62'];
        const isOTC = otcPrefixes.some(p => s.startsWith(p));
        s += isOTC ? '.TWO' : '.TW';
    }

    this.currentSymbol = s;
    document.getElementById('symbol-search-btn')!.innerText = `${s} ▾`;
    
    const exch = isStock ? 'Yahoo' : 'Binance';
    document.getElementById('exchange-display')!.innerText = exch;
    const fullId = s + (isStock ? ':STOCK' : ':SPOT');

    // 🚀 關鍵隔離切換：先清理舊的，再切換管家
    console.log(`[ChartEngine] Switching to ${isStock ? 'Stock' : 'Crypto'} mode...`);
    
    // 1. 斷開舊的實時連線
    await this.activeManager.update('', '', ''); 

    // 2. 切換實體
    this.activeManager = isStock ? this.stockManager : this.cryptoManager;
    
    // 3. 重新綁定 Loader
    this.loader = new LoaderController(this.activeManager, this.viewport);
    
    this.scaleEngine.resetAutoScale();
    await this.activeManager.update(fullId, this.currentTimeframe, exch);
    this.requestRedraw();
  }

  // ... (其他方法中將 this.dataManager 替換為 this.activeManager)

  private startDrawing(type: string) {
    let cur: DrawingObject | null = null;
    let clickCount = 0;

    this.interactionEngine.setDrawingMode(type, (x, y, ev) => {
      const price = this.scaleEngine.yToPrice(y);
      // 🚨 替換
      const time = this.activeManager.getTimeAtIndex(x / (this.viewport.getCandleWidth() + 2) + this.viewport.getRawRange().startIndex);
      
      // ... (餘下邏輯)
    });
  }

  // ... (餘下方法比照辦理)

  private draw() {
    const candles = this.activeManager.getCandles(); // 🚨 替換
    const { start, end } = this.viewport.getVisibleRange();
    const { startIndex } = this.viewport.getRawRange();
    const visible = candles.slice(start, end);
    const cw = this.viewport.getCandleWidth();
    
    // ... (繪圖邏輯)
    
    if (this.lastMousePos.x > 0 || this.lastMousePos.y > 0) {
        const price = this.scaleEngine.yToPrice(this.lastMousePos.y);
        // 🚨 替換
        const time = this.activeManager.getTimeAtIndex(this.lastMousePos.x / (this.viewport.getCandleWidth() + 2) + startIndex);
        this.renderEngine.drawCrosshair(this.lastMousePos.x, this.lastMousePos.y, formatPrice(price), formatFullTime(time));
    }
    // ...
  }

  private updateCrosshair(mouseX: number, mouseY: number) {
    this.lastMousePos = { x: mouseX, y: mouseY };
    
    const { startIndex } = this.viewport.getRawRange();
    const candleWidth = this.viewport.getCandleWidth();
    this.hoveredDrawingId = this.drawingEngine.hitTest(
      mouseX, mouseY, 
      this.scaleEngine, 
      startIndex, 
      candleWidth, 2, 
      (t) => this.activeManager.getIndexAtTime(t) // 🚨 替換
    )?.id || null;

    const index = Math.round(mouseX / (candleWidth + 2) + startIndex);
    const candles = this.activeManager.getCandles(); // 🚨 替換
    const candle = candles[index];
    this.updateOHLCUI(candle);
    this.requestRedraw();
  }

  private async init() { await this.activeManager.loadInitialData(); } // 🚨 替換
}

window.onload = () => { new ChartEngine(); };
