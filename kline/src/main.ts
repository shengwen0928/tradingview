import { DataManager } from './core/DataManager';
import { ViewportEngine } from './core/ViewportEngine';
import { ScaleEngine } from './core/ScaleEngine';
import { RenderEngine } from './core/RenderEngine';
import { InteractionEngine } from './core/InteractionEngine';
import { LoaderController } from './core/LoaderController';
import { PineScriptEngine } from './core/PineScriptEngine';
import { DrawingEngine } from './core/DrawingEngine';
import { SymbolController } from './core/SymbolController';
import { DrawingController } from './core/DrawingController';
import { MagnetService } from './core/MagnetService';
import { CrosshairController } from './core/CrosshairController';

// UI Components
import { SymbolModal } from './ui/SymbolModal';
import { TimeframeController } from './ui/TimeframeController';
import { DrawingToolbar } from './ui/DrawingToolbar';
import { ScriptEditor } from './ui/ScriptEditor';
import { InfoDisplay } from './ui/InfoDisplay';
import { DrawingEditToolbar } from './ui/DrawingEditToolbar';
import { injectStyles } from './ui/Styles';

class ChartEngine {
  private cryptoManager!: DataManager;
  private stockManager!: DataManager;
  private activeManager!: DataManager;
  private pineEngine!: PineScriptEngine; 
  private viewport!: ViewportEngine;
  private scaleEngine!: ScaleEngine;
  private renderEngine!: RenderEngine;
  private loader!: LoaderController;
  private drawingEngine!: DrawingEngine;
  private interactionEngine!: InteractionEngine;
  private symbolController!: SymbolController;
  private drawingController!: DrawingController;
  private magnetService!: MagnetService;
  private crosshairController!: CrosshairController;
  private editToolbar!: DrawingEditToolbar;
  
  private symbolModal!: SymbolModal;
  private tfController!: TimeframeController;
  private drawingToolbar!: DrawingToolbar;
  private scriptEditor!: ScriptEditor;
  private infoDisplay!: InfoDisplay;

  private connectionStatus: string = 'connecting';
  private visualLastPrice: number | null = null; 

  constructor() {
    injectStyles();
    this.renderEngine = new RenderEngine(
      document.getElementById('grid-canvas') as HTMLCanvasElement, 
      document.getElementById('candle-canvas') as HTMLCanvasElement, 
      document.getElementById('overlay-canvas') as HTMLCanvasElement
    );
    this.scaleEngine = new ScaleEngine();
    this.viewport = new ViewportEngine(() => this.requestRedraw());
    this.pineEngine = new PineScriptEngine();
    this.drawingEngine = new DrawingEngine();
    this.editToolbar = new DrawingEditToolbar(this.drawingEngine, () => this.requestRedraw());
    
    const onDataUpdate = (candles: any[], isHistory: boolean) => {
        this.viewport.setDataCount(candles.length, isHistory);
        this.requestRedraw();
    };
    const onStatusChange = (status: any) => {
        this.connectionStatus = status;
        this.infoDisplay.updateStatus(status, this.symbolController?.getCurrentSymbol() || 'BTC/USDT');
    };

    this.cryptoManager = new DataManager(onDataUpdate, onStatusChange);
    this.stockManager = new DataManager(onDataUpdate, onStatusChange);
    this.activeManager = this.cryptoManager;
    this.loader = new LoaderController(this.activeManager, this.viewport);
    this.infoDisplay = new InfoDisplay();

    this.initMagnetService();
    this.initControllers();
    this.initInteraction();
    
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();
    this.init();
  }

  private initMagnetService() {
    this.magnetService = new MagnetService(this.viewport, this.scaleEngine);
  }

  private initControllers() {
    this.symbolController = new SymbolController(
        this.cryptoManager, this.stockManager, this.viewport, this.scaleEngine, this.infoDisplay,
        (m) => { this.activeManager = m; this.loader = new LoaderController(m, this.viewport); },
        () => this.requestRedraw()
    );

    this.symbolModal = new SymbolModal((s, c) => this.symbolController.loadSymbol(s, c, this.tfController, this.connectionStatus));
    
    this.tfController = new TimeframeController(
      (tf) => { this.activeManager.setTimeframe(tf); this.scaleEngine.resetAutoScale(); },
      () => this.requestRedraw()
    );

    this.drawingController = new DrawingController(this.interactionEngine, this.drawingEngine, this.viewport, this.scaleEngine, () => this.requestRedraw());

    this.drawingToolbar = new DrawingToolbar(
      this.interactionEngine, this.drawingEngine, () => this.requestRedraw(),
      (tool) => this.drawingController.startDrawing(tool, this.activeManager)
    );

    this.scriptEditor = new ScriptEditor(this.pineEngine, () => this.activeManager, () => this.requestRedraw());
    
    this.crosshairController = new CrosshairController(
        this.viewport, this.scaleEngine, this.renderEngine, this.infoDisplay, this.drawingEngine, this.interactionEngine
    );
  }

  private initInteraction() {
    this.interactionEngine = new InteractionEngine(
      this.renderEngine.getOverlayCanvas(),
      (dX, dY, z) => { 
        if (z === 'price') this.scaleEngine.handleVerticalPan(dY);
        else { this.viewport.handleScroll(dX); this.scaleEngine.handleVerticalPan(dY); }
        this.loader.checkLoadMore(); this.requestRedraw();
      },
      (mX, _mY, s, z) => {
        if (z === 'price') this.scaleEngine.handleVerticalZoom(s);
        else if (z === 'time') this.viewport.handleZoom(this.renderEngine.getLogicalWidth() / 2, s, this.renderEngine.getLogicalWidth());
        else this.viewport.handleZoom(mX, s, this.renderEngine.getLogicalWidth());
        this.loader.checkLoadMore(); this.requestRedraw();
      },
      (mX, mY) => this.crosshairController.update(mX, mY, this.activeManager, () => this.requestRedraw())
    );

    this.interactionEngine.setSnapProvider(this.magnetService.getSnapProvider(this.activeManager));

    this.renderEngine.getOverlayCanvas().addEventListener('click', (e: MouseEvent) => {
      if (this.interactionEngine.getDrawingMode()) return;
      const rect = this.renderEngine.getOverlayCanvas().getBoundingClientRect();
      const hit = this.drawingEngine.hitTest(
        e.clientX - rect.left, e.clientY - rect.top, this.scaleEngine, 
        this.viewport.getRawRange().startIndex, this.viewport.getCandleWidth(), 2, (t) => this.activeManager.getIndexAtTime(t)
      );
      if (hit) this.editToolbar.show(e.clientX, e.clientY, hit); else this.editToolbar.hide();
    });
  }

  private requestRedraw() { requestAnimationFrame(() => this.draw()); }

  private draw() {
    const candles = this.activeManager.getCandles();
    if (candles.length === 0) return;

    const { start, end } = this.viewport.getVisibleRange();
    const { startIndex } = this.viewport.getRawRange();
    const visible = candles.slice(start, end);
    const cw = this.viewport.getCandleWidth();
    const lastPrice = candles[candles.length - 1].close;

    // 平滑視覺價格
    if (this.visualLastPrice === null) this.visualLastPrice = lastPrice;
    else {
        const diff = lastPrice - this.visualLastPrice;
        if (Math.abs(diff) > 0.0001) { this.visualLastPrice += diff * 0.2; this.requestRedraw(); }
        else this.visualLastPrice = lastPrice;
    }
    
    this.scaleEngine.updateScale(visible);
    this.renderEngine.drawGrid(this.scaleEngine);
    this.renderEngine.drawAxes(visible, startIndex, cw, 2, (idx) => this.activeManager.getTimeAtIndex(idx), this.scaleEngine);
    this.renderEngine.drawCandles(visible, start, startIndex, cw, 2, this.scaleEngine, this.visualLastPrice);

    this.renderEngine.drawIndicators(this.pineEngine.run(candles, this.pineEngine.compile(localStorage.getItem('pine-script-default') || 'plot(close, "Close", "#2962ff")')), start, end, startIndex, cw, 2, this.scaleEngine);
    
    this.drawingEngine.render(this.renderEngine.getOverlayContext(), this.scaleEngine, startIndex, cw, 2, (t) => this.activeManager.getIndexAtTime(t), this.crosshairController.getHoveredDrawingId());
    
    this.crosshairController.draw(this.activeManager);

    const last = candles[candles.length - 1];
    this.renderEngine.drawLastPriceLine(this.visualLastPrice, this.visualLastPrice >= last.open ? '#26a69a' : '#ef5350', this.scaleEngine);
  }

  private handleResize() { 
    const w = window.innerWidth, h = window.innerHeight; 
    this.renderEngine.resize(w, h); 
    this.scaleEngine.updateDimensions(w, h); 
    this.requestRedraw(); 
  }

  private async init() { await this.activeManager.loadInitialData(); }
}

window.onload = () => { new ChartEngine(); };
