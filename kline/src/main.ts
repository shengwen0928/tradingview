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
  private visualLastPrice: number | null = null; // 🚀 新增：平滑視覺價格

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

    this.initInteraction();
    this.initControllers();
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
      () => this.requestRedraw(),
      (tool) => this.startDrawing(tool)
    );
    this.scriptEditor = new ScriptEditor(
      this.pineEngine,
      () => this.activeManager,
      () => this.requestRedraw()
    );

    // Initial status UI
    this.infoDisplay.updateStatus(this.connectionStatus, this.currentSymbol);

    // Keep references to suppress unused variable warnings if not immediately used elsewhere
    console.log('[ChartEngine] UI Controllers initialized', {
      symbolModal: !!this.symbolModal,
      drawingToolbar: !!this.drawingToolbar,
      scriptEditor: !!this.scriptEditor
    });
  }

  private startDrawing(tool: string) {
    this.interactionEngine.setDrawingMode(tool, (mouseX, mouseY, type) => {
        const { startIndex } = this.viewport.getRawRange();
        const candleWidth = this.viewport.getCandleWidth();
        const spacing = 2;
        
        // 🚨 畫筆專屬：使用浮點數索引以獲取子蠟燭級別的精確時間
        const rawIndex = mouseX / (candleWidth + spacing) + startIndex;
        const time = tool === 'brush' 
            ? this.activeManager.getTimeAtFloatIndex(rawIndex) 
            : this.activeManager.getTimeAtIndex(Math.round(rawIndex));
            
        const price = this.scaleEngine.yToPrice(mouseY);
        const point = { time, price };

        if (type === 'start') {
            const needed = this.drawingEngine.getPointsNeeded(tool as any);

            if (!this.drawingEngine.isPlacing()) {
                // 第一下點擊
                this.drawingEngine.startDrawing(tool as any, point);
                
                // 如果只需要 1 個點（水平線、垂直線、文字），立刻結束
                if (needed === 1) {
                    this.drawingEngine.endDrawing();
                    this.interactionEngine.setDrawingMode(null);
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                }
            } else {
                // 之後的點擊 (僅針對非畫筆工具)
                if (tool !== 'brush') {
                    const active = this.drawingEngine.getActiveDrawing();
                    const currentCount = active?.points.length || 0;
                    
                    if (currentCount === needed) {
                        this.drawingEngine.endDrawing();
                        this.interactionEngine.setDrawingMode(null);
                        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                    } else {
                        this.drawingEngine.addPoint(point);
                    }
                }
            }
        } else if (type === 'move') {
            if (this.drawingEngine.isPlacing()) {
                this.drawingEngine.updateDrawing(point);
            }
        } else if (type === 'end') {
            // 🚨 畫筆專屬：放開滑鼠時結束當前線段，但保持畫筆工具選中
            if (tool === 'brush' && this.drawingEngine.isPlacing()) {
                this.drawingEngine.endDrawing();
                // 不再呼叫 setDrawingMode(null)，允許連續畫下一筆
            }
        }
        this.requestRedraw();
    });
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
      const spacing = 2;
      const { startIndex } = this.viewport.getRawRange();
      
      // 🚨 修正索引計算邏輯
      const index = Math.round((mouseX) / (candleWidth + spacing) + startIndex);
      const candle = candles[index];
      if (!candle) return null;

      const centerX = (index - startIndex) * (candleWidth + spacing) + candleWidth / 2;
      
      // 磁鐵吸附點：高、低、開、收
      const prices = [candle.high, candle.low, candle.open, candle.close];
      const points = prices.map(p => ({ x: centerX, y: this.scaleEngine.priceToY(p) }));
      
      let closest = points[0];
      let minDist = Infinity;
      points.forEach(pt => {
        const d = Math.abs(pt.y - mouseY);
        if (d < minDist) { minDist = d; closest = pt; }
      });

      if (mode === 'weak' && (minDist > 30 || Math.abs(centerX - mouseX) > 20)) return null;
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
    if (candles.length === 0) return;

    const { start, end } = this.viewport.getVisibleRange();
    const { startIndex } = this.viewport.getRawRange();
    const visible = candles.slice(start, end);
    const cw = this.viewport.getCandleWidth();
    const lastCandle = candles[candles.length - 1];
    const actualPrice = lastCandle.close;

    // 🚀 平滑視覺價格邏輯 (Lerp)
    if (this.visualLastPrice === null) {
        this.visualLastPrice = actualPrice;
    } else {
        const diff = actualPrice - this.visualLastPrice;
        if (Math.abs(diff) > 0.0001) {
            // 每幀移動 20% 的差距，達到絲滑效果
            this.visualLastPrice += diff * 0.2;
            // 如果還在移動中，請求下一幀繼續渲染
            this.requestRedraw();
        } else {
            this.visualLastPrice = actualPrice;
        }
    }
    
    this.scaleEngine.updateScale(visible);
    this.renderEngine.drawGrid(this.scaleEngine);
    this.renderEngine.drawAxes(visible, startIndex, cw, 2, (idx) => this.activeManager.getTimeAtIndex(idx), this.scaleEngine);
    
    // 🚀 傳入視覺價格進行繪製
    this.renderEngine.drawCandles(visible, start, startIndex, cw, 2, this.scaleEngine, this.visualLastPrice);

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

    // 🚀 最新價格線也使用視覺價格
    const color = this.visualLastPrice >= lastCandle.open ? '#26a69a' : '#ef5350';
    this.renderEngine.drawLastPriceLine(this.visualLastPrice, color, this.scaleEngine);
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

  private showEditToolbar(x: number, y: number, hit: any) {
    console.log('[ChartEngine] Show drawing edit toolbar at', { x, y, hit });
    // TODO: Implement actual floating toolbar for drawing objects
  }

  private hideEditToolbar() {
    // console.log('[ChartEngine] Hide drawing edit toolbar');
    // TODO: Implement actual floating toolbar hiding
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
        .unit-btn.active { background: #2a2e39; color: #fff; border-color: #2962ff; }
        
        /* 🚀 繪圖工具列按鈕樣式優化 */
        .tool-btn:hover, .tool-btn.active { background: #2a2e39 !important; color: #fff !important; }
        .tool-btn.active { border-left: 3px solid #2962ff; } /* 保留一個小藍條作為選中提示，或可根據需求移除 */
        
        /* 🚀 提升全域清晰度 */
        body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
        canvas { image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }
    `;
    document.head.appendChild(style);
  }
}

window.onload = () => { new ChartEngine(); };
