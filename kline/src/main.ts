import { DataManager } from './core/DataManager';
import { ViewportEngine } from './core/ViewportEngine';
import { ScaleEngine } from './core/ScaleEngine';
import { RenderEngine } from './core/RenderEngine';
import { InteractionEngine } from './core/InteractionEngine';
import { LoaderController } from './core/LoaderController';
import { PineScriptEngine } from './core/PineScriptEngine';
import { DrawingEngine } from './core/DrawingEngine';
import { formatPrice, formatFullTime } from './utils/math';

// UI Components
import { SymbolModal } from './ui/SymbolModal';
import { TimeframeController } from './ui/TimeframeController';
import { DrawingToolbar } from './ui/DrawingToolbar';
import { ScriptEditor } from './ui/ScriptEditor';
import { InfoDisplay } from './ui/InfoDisplay';

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
  private overlayCanvas!: HTMLCanvasElement;
  
  private symbolModal!: SymbolModal;
  private tfController!: TimeframeController;
  private drawingToolbar!: DrawingToolbar;
  private scriptEditor!: ScriptEditor;
  private infoDisplay!: InfoDisplay;

  private connectionStatus: string = 'connecting';
  private currentSymbol: string = 'BTC/USDT'; 
  private lastMousePos = { x: 0, y: 0 };
  private hoveredDrawingId: string | null = null;

  constructor() {
    this.overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    this.renderEngine = new RenderEngine(
      document.getElementById('grid-canvas') as HTMLCanvasElement, 
      document.getElementById('candle-canvas') as HTMLCanvasElement, 
      this.overlayCanvas
    );
    this.scaleEngine = new ScaleEngine();
    this.viewport = new ViewportEngine(() => this.requestRedraw());
    this.pineEngine = new PineScriptEngine();
    this.drawingEngine = new DrawingEngine();
    
    const onDataUpdate = (candles: any[], isHistory: boolean) => {
        this.viewport.setDataCount(candles.length, isHistory);
        this.requestRedraw();
    };
    const onStatusChange = (status: any) => {
        this.connectionStatus = status;
        this.infoDisplay.updateStatus(status, this.currentSymbol);
    };

    this.cryptoManager = new DataManager(onDataUpdate, onStatusChange);
    this.stockManager = new DataManager(onDataUpdate, onStatusChange);
    this.activeManager = this.cryptoManager;

    this.loader = new LoaderController(this.activeManager, this.viewport);
    this.infoDisplay = new InfoDisplay();

    this.initControllers();
    this.initInteraction();
    this.initMagnetSnapping();
    
    this.injectCustomStyles();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    this.init();
  }

  private initControllers() {
    this.symbolModal = new SymbolModal((symbol, category) => this.loadSymbol(symbol, category));
    this.tfController = new TimeframeController(
      (tf) => {
        this.activeManager.setTimeframe(tf);
        this.scaleEngine.resetAutoScale();
      },
      () => this.requestRedraw()
    );
    this.drawingToolbar = new DrawingToolbar(
      this.interactionEngine,
      this.drawingEngine,
      this.scaleEngine,
      () => this.activeManager,
      () => this.requestRedraw(),
      (x, y, hit) => this.showEditToolbar(x, y, hit),
      () => this.hideEditToolbar()
    );
    this.scriptEditor = new ScriptEditor(
      this.pineEngine,
      () => this.activeManager,
      () => this.requestRedraw()
    );

    // Initial status UI
    this.infoDisplay.updateStatus(this.connectionStatus, this.currentSymbol);
  }

  private initInteraction() {
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
  }

  private initMagnetSnapping() {
    this.interactionEngine.setSnapProvider((mouseX, mouseY, mode) => {
      const candles = this.activeManager.getCandles();
      const candleWidth = this.viewport.getCandleWidth();
      const { startIndex } = this.viewport.getRawRange();
      const index = Math.round(mouseX / (candleWidth + 2) + startIndex);
      const candle = candles[index];
      if (!candle) return null;
      const centerX = (index - startIndex) * (candleWidth + 2) + candleWidth / 2;
      const prices = [candle.open, candle.high, candle.low, candle.close];
      const points = prices.map(p => ({ x: centerX, y: this.scaleEngine.priceToY(p) }));
      let closest = points[0];
      let minDist = Infinity;
      points.forEach(pt => { const d = Math.abs(pt.y - mouseY); if (d < minDist) { minDist = d; closest = pt; } });
      if (mode === 'weak' && minDist > 30) return null;
      return closest;
    });

    this.overlayCanvas.addEventListener('click', (e: MouseEvent) => {
      if (this.interactionEngine.getDrawingMode()) return;
      const rect = this.overlayCanvas.getBoundingClientRect();
      const { startIndex } = this.viewport.getRawRange();
      const hit = this.drawingEngine.hitTest(
        e.clientX - rect.left, 
        e.clientY - rect.top, 
        this.scaleEngine, 
        startIndex, 
        this.viewport.getCandleWidth(), 
        2, 
        (t) => this.activeManager.getIndexAtTime(t)
      );
      if (hit) this.showEditToolbar(e.clientX, e.clientY, hit); else this.hideEditToolbar();
    });
  }

  private async loadSymbol(symbol: string, category: string) {
    let s = symbol.toUpperCase();
    let isStock = category.includes('STOCK') || s.includes('.TW') || s.includes('.TWO');
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
    
    await this.activeManager.update('', '', ''); 
    this.activeManager = isStock ? this.stockManager : this.cryptoManager;
    this.loader = new LoaderController(this.activeManager, this.viewport);
    this.scaleEngine.resetAutoScale();
    await this.activeManager.update(fullId, this.tfController.getCurrentTimeframe(), exch);
    this.infoDisplay.updateStatus(this.connectionStatus, this.currentSymbol);
    this.requestRedraw();
  }

  private requestRedraw() { requestAnimationFrame(() => this.draw()); }

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

    const script = localStorage.getItem('pine-script-default') || 'plot(close, "Close", "#2962ff")';
    const compiledJs = this.pineEngine.compile(script);
    this.indicatorPlots = this.pineEngine.run(candles, compiledJs);

    this.renderEngine.drawIndicators(this.indicatorPlots, start, end, startIndex, cw, 2, this.scaleEngine);
    
    const oCtx = this.overlayCanvas.getContext('2d')!;
    this.drawingEngine.render(oCtx, this.scaleEngine, startIndex, cw, 2, (t) => this.activeManager.getIndexAtTime(t), this.hoveredDrawingId);
    
    if (this.lastMousePos.x > 0 || this.lastMousePos.y > 0) {
        const price = this.scaleEngine.yToPrice(this.lastMousePos.y);
        const time = this.activeManager.getTimeAtIndex(this.lastMousePos.x / (this.viewport.getCandleWidth() + 2) + startIndex);
        this.renderEngine.drawCrosshair(this.lastMousePos.x, this.lastMousePos.y, formatPrice(price), formatFullTime(time));
    }
    const last = candles[candles.length - 1];
    if (last) this.renderEngine.drawLastPriceLine(last.close, last.close >= last.open ? '#26a69a' : '#ef5350', this.scaleEngine);
  }

  private updateCrosshair(mouseX: number, mouseY: number) {
    this.lastMousePos = { x: mouseX, y: mouseY };
    const { startIndex } = this.viewport.getRawRange();
    const candleWidth = this.viewport.getCandleWidth();
    this.hoveredDrawingId = this.drawingEngine.hitTest(mouseX, mouseY, this.scaleEngine, startIndex, candleWidth, 2, (t) => this.activeManager.getIndexAtTime(t))?.id || null;
    const index = Math.round(mouseX / (candleWidth + 2) + startIndex);
    const candles = this.activeManager.getCandles();
    this.infoDisplay.updateOHLC(candles[index]);
    this.requestRedraw();
  }

  private showEditToolbar(_x: number, _y: number, _hit: any) {
    // Placeholder for drawing edit toolbar logic if needed
    console.log('[ChartEngine] Show drawing edit toolbar', _hit);
  }

  private hideEditToolbar() {
    // Placeholder for hiding drawing edit toolbar
  }

  private handleResize() { 
    const w = window.innerWidth, h = window.innerHeight; 
    this.renderEngine.resize(w, h); 
    this.scaleEngine.updateDimensions(w, h); 
    this.requestRedraw(); 
  }

  private async init() { await this.activeManager.loadInitialData(); }

  private injectCustomStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        .unit-btn { background: #1e222d; border: 1px solid #363c4e; color: #d1d4dc; padding: 6px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s; }
        .unit-btn:hover { background: #2a2e39; color: #fff; }
        .unit-btn.active { background: #2962ff; color: #fff; border-color: #2962ff; }
    `;
    document.head.appendChild(style);
  }
}

window.onload = () => { new ChartEngine(); };
