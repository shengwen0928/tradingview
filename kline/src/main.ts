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
import { formatPrice, formatFullTime } from './utils/math';

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
  private indicatorPlots: any[] = []; 
  private viewport!: ViewportEngine;
  private scaleEngine!: ScaleEngine;
  private renderEngine!: RenderEngine;
  private loader!: LoaderController;
  private drawingEngine!: DrawingEngine;
  private interactionEngine!: InteractionEngine;
  private symbolController!: SymbolController;
  private drawingController!: DrawingController;
  private editToolbar!: DrawingEditToolbar;
  
  private symbolModal!: SymbolModal;
  private tfController!: TimeframeController;
  private drawingToolbar!: DrawingToolbar;
  private scriptEditor!: ScriptEditor;
  private infoDisplay!: InfoDisplay;

  private connectionStatus: string = 'connecting';
  private lastMousePos = { x: 0, y: 0 };
  private hoveredDrawingId: string | null = null;
  private visualLastPrice: number | null = null; 

  constructor() {
    injectStyles();
    const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    
    this.renderEngine = new RenderEngine(
      document.getElementById('grid-canvas') as HTMLCanvasElement, 
      document.getElementById('candle-canvas') as HTMLCanvasElement, 
      overlayCanvas
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

    this.initControllers();
    this.initInteraction();
    this.initMagnetSnapping();
    
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    this.init();
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
  }

  private initInteraction() {
    this.interactionEngine = new InteractionEngine(
      this.renderEngine.getOverlayCanvas(),
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
  }

  private initMagnetSnapping() {
    this.interactionEngine.setSnapProvider((mouseX, mouseY, mode) => {
      const candles = this.activeManager.getCandles();
      const candleWidth = this.viewport.getCandleWidth();
      const spacing = 2;
      const { startIndex } = this.viewport.getRawRange();
      const index = Math.round(mouseX / (candleWidth + spacing) + startIndex);
      const candle = candles[index];
      if (!candle) return null;

      const centerX = (index - startIndex) * (candleWidth + spacing) + candleWidth / 2;
      const prices = [candle.high, candle.low, candle.open, candle.close];
      const points = prices.map(p => ({ x: centerX, y: this.scaleEngine.priceToY(p) }));
      
      let closest = points[0], minDist = Infinity;
      points.forEach(pt => {
        const d = Math.abs(pt.y - mouseY);
        if (d < minDist) { minDist = d; closest = pt; }
      });

      if (mode === 'weak' && (minDist > 30 || Math.abs(centerX - mouseX) > 20)) return null;
      return closest;
    });

    this.renderEngine.getOverlayCanvas().addEventListener('click', (e: MouseEvent) => {
      if (this.interactionEngine.getDrawingMode()) return;
      const rect = this.renderEngine.getOverlayCanvas().getBoundingClientRect();
      const { startIndex } = this.viewport.getRawRange();
      const hit = this.drawingEngine.hitTest(
        e.clientX - rect.left, e.clientY - rect.top, this.scaleEngine, 
        startIndex, this.viewport.getCandleWidth(), 2, (t) => this.activeManager.getIndexAtTime(t)
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

    // 平滑視覺價格 (Lerp)
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

    const script = localStorage.getItem('pine-script-default') || 'plot(close, "Close", "#2962ff")';
    this.indicatorPlots = this.pineEngine.run(candles, this.pineEngine.compile(script));
    this.renderEngine.drawIndicators(this.indicatorPlots, start, end, startIndex, cw, 2, this.scaleEngine);
    
    this.drawingEngine.render(this.renderEngine.getOverlayContext(), this.scaleEngine, startIndex, cw, 2, (t) => this.activeManager.getIndexAtTime(t), this.hoveredDrawingId);
    
    if (this.lastMousePos.x > 0 || this.lastMousePos.y > 0) {
        const price = this.scaleEngine.yToPrice(this.lastMousePos.y);
        const time = this.activeManager.getTimeAtIndex(this.lastMousePos.x / (cw + 2) + startIndex);
        this.renderEngine.drawCrosshair(this.lastMousePos.x, this.lastMousePos.y, formatPrice(price), formatFullTime(time));
        
        const mode = this.interactionEngine.getDrawingMode();
        if (mode && mode !== 'cursor' && mode !== 'move' && !this.drawingEngine.isPlacing()) {
            const snapped = this.interactionEngine.getSnappedPos(this.lastMousePos.x, this.lastMousePos.y);
            this.renderEngine.drawPreviewPoint(snapped.x, snapped.y);
        }
    }

    const last = candles[candles.length - 1];
    this.renderEngine.drawLastPriceLine(this.visualLastPrice, this.visualLastPrice >= last.open ? '#26a69a' : '#ef5350', this.scaleEngine);
  }

  private updateCrosshair(mouseX: number, mouseY: number) {
    this.lastMousePos = { x: mouseX, y: mouseY };
    const { startIndex } = this.viewport.getRawRange();
    const cw = this.viewport.getCandleWidth();
    this.hoveredDrawingId = this.drawingEngine.hitTest(mouseX, mouseY, this.scaleEngine, startIndex, cw, 2, (t) => this.activeManager.getIndexAtTime(t))?.id || null;
    const index = Math.round(mouseX / (cw + 2) + startIndex);
    this.infoDisplay.updateOHLC(this.activeManager.getCandles()[index]);
    this.requestRedraw();
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
