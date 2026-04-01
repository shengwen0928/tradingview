import { DataManager } from './core/DataManager';
// 🚀 Deployment Trigger: 2026-03-31 20:45
import { ViewportEngine } from './core/ViewportEngine';
import { ScaleEngine } from './core/ScaleEngine';
import { RenderEngine } from './core/RenderEngine';
import { InteractionEngine } from './core/InteractionEngine';
import { LoaderController } from './core/LoaderController';
import { PineScriptEngine } from './core/PineScriptEngine'; // 🚀 切換至專業版
import { DrawingEngine, DrawingObject, DrawingPoint } from './core/DrawingEngine';
import { formatPrice, formatFullTime } from './utils/math';

class ChartEngine {
  private cryptoManager: DataManager;
  private stockManager: DataManager;
  private activeManager: DataManager;
  private pineEngine: PineScriptEngine; // 🚀 更新類型
  private indicatorPlots: any[] = []; 
  private viewport: ViewportEngine;
  private scaleEngine: ScaleEngine;
  private renderEngine: RenderEngine;
  private loader: LoaderController;
  private drawingEngine: DrawingEngine;
  private interactionEngine: InteractionEngine;
  private overlayCanvas: HTMLCanvasElement;
  private connectionStatus: string = 'connecting';
  private currentSymbol: string = 'BTC/USDT'; 
  private currentTimeframe: string = '1m'; 
  private favorites: string[] = [];
  private activeCategory: string = 'CRYPTO';
  private hoveredDrawingId: string | null = null;

  // ... (allSymbols 定義)

  constructor() {
    this.overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    this.renderEngine = new RenderEngine(document.getElementById('grid-canvas') as HTMLCanvasElement, document.getElementById('candle-canvas') as HTMLCanvasElement, this.overlayCanvas);
    this.scaleEngine = new ScaleEngine();
    this.viewport = new ViewportEngine(() => this.requestRedraw());
    this.pineEngine = new PineScriptEngine(); // 🚀 初始化專業引擎
    this.drawingEngine = new DrawingEngine();
    
    // ... (onDataUpdate, cryptoManager 初始化)

    this.cryptoManager = new DataManager(onDataUpdate, onStatusChange);
    this.stockManager = new DataManager(onDataUpdate, onStatusChange);
    this.activeManager = this.cryptoManager;

    this.favorites = JSON.parse(localStorage.getItem('tf-favorites') || '["1m", "1H", "1D"]');
    this.initModalLogic();
    this.loader = new LoaderController(this.activeManager, this.viewport);

    // ... (interactionEngine, drawingToolbar 初始化)

    this.initDrawingToolbar();
    this.initMagnetLogic();
    this.injectCustomStyles();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    this.init();
  }

  // ... (方法保持)

  private draw() {
    const candles = this.activeManager.getCandles();
    const { start, end } = this.viewport.getVisibleRange();
    const { startIndex } = this.viewport.getRawRange();
    const visible = candles.slice(start, end);
    const cw = this.viewport.getCandleWidth();
    
    this.scaleEngine.updateScale(visible);
    this.renderEngine.drawGrid(this.scaleEngine);
    this.renderEngine.drawAxes(visible, startIndex, cw, 2, (idx) => this.activeManager.getTimeAtIndex(idx), this.scaleEngine);
    this.renderEngine.drawCandles(visible, start, startIndex, cw, 2, this.scaleEngine);

    // 🚀 專業指標引擎：僅執行用戶腳本，不再有硬編碼 MA
    const script = localStorage.getItem('pine-script-default') || 'plot(close, "Close", "#2962ff")';
    const compiledJs = this.pineEngine.compile(script);
    this.indicatorPlots = this.pineEngine.run(candles, compiledJs);

    // 🎨 全自動渲染指標數列
    this.renderEngine.drawIndicators(this.indicatorPlots, start, end, startIndex, cw, 2, this.scaleEngine);
    
    const oCtx = (document.getElementById('overlay-canvas') as HTMLCanvasElement).getContext('2d')!;
    // ... (其餘繪圖邏輯)
  }
