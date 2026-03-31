import { DataManager } from './core/DataManager';
// 🚀 Deployment Trigger: 2026-03-31 15:58
import { ViewportEngine } from './core/ViewportEngine';
import { ScaleEngine } from './core/ScaleEngine';
import { RenderEngine } from './core/RenderEngine';
import { InteractionEngine } from './core/InteractionEngine';
import { LoaderController } from './core/LoaderController';
import { IndicatorEngine } from './core/IndicatorEngine';
import { DrawingEngine, DrawingObject } from './core/DrawingEngine'; // 🚨 新增
import { formatPrice, formatFullTime } from './utils/math';

/**
 * 圖表引擎核心進入點
 */
class ChartEngine {
  private dataManager: DataManager;
  private viewport: ViewportEngine;
  private scaleEngine: ScaleEngine;
  private renderEngine: RenderEngine;
  private loader: LoaderController;
  private indicatorEngine: IndicatorEngine;
  private drawingEngine: DrawingEngine; // 🚨 新增
  private interactionEngine: InteractionEngine; // 🚨 改為私有屬性方便存取
  private connectionStatus: string = 'connecting';
  private currentSymbol: string = 'BTC/USDT'; 
  private currentTimeframe: string = '1m'; 
  private allTimeframes = [
    '1s', '1m', '3m', '5m', '15m', '30m', 
    '1H', '2H', '4H', '6h', '8h', '12h', 
    '1D', '2D', '3D', '5D', '1W', '1M', '3M'
  ];
  private favorites: string[] = [];

  constructor() {
    const gridCanvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    const candleCanvas = document.getElementById('candle-canvas') as HTMLCanvasElement;
    const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    
    const marketTypeSelect = document.getElementById('market-type-select') as HTMLSelectElement;
    const symbolSearch = document.getElementById('symbol-search') as HTMLInputElement;
    const exchangeSelect = document.getElementById('exchange-select') as HTMLSelectElement;
    
    const tfMainBtn = document.getElementById('tf-main-btn') as HTMLButtonElement;
    const tfPopup = document.getElementById('tf-popup') as HTMLDivElement;
    const tfCustomInput = document.getElementById('tf-custom-input') as HTMLInputElement;

    this.renderEngine = new RenderEngine(gridCanvas, candleCanvas, overlayCanvas);
    this.scaleEngine = new ScaleEngine();
    this.viewport = new ViewportEngine(() => this.requestRedraw());
    this.indicatorEngine = new IndicatorEngine();
    this.drawingEngine = new DrawingEngine(); // 🚨 初始化
    
    this.dataManager = new DataManager(
      (candles, isHistory) => {
        this.viewport.setDataCount(candles.length, isHistory);
      },
      (status) => {
        this.connectionStatus = status;
        this.updateStatusUI();
      }
    );

    const savedFavs = localStorage.getItem('tf-favorites');
    this.favorites = savedFavs ? JSON.parse(savedFavs) : ['1m', '1H', '1D'];

    this.renderTfFavorites();
    this.renderTfPopup();
    this.initDrawingToolbar(); // 🚨 初始化工具列

    this.loader = new LoaderController(this.dataManager, this.viewport);

    this.interactionEngine = new InteractionEngine(
      overlayCanvas,
      (deltaX, deltaY, zone) => {
        if (zone === 'price') this.scaleEngine.handleVerticalPan(deltaY);
        else { this.viewport.handleScroll(deltaX); this.scaleEngine.handleVerticalPan(deltaY); }
        this.loader.checkLoadMore();
        this.requestRedraw();
      },
      (mouseX, _mouseY, scale, zone) => {
        if (zone === 'price') this.scaleEngine.handleVerticalZoom(scale);
        else if (zone === 'time') this.viewport.handleZoom(this.renderEngine.getLogicalWidth() / 2, scale, this.renderEngine.getLogicalWidth());
        else this.viewport.handleZoom(mouseX, scale, this.renderEngine.getLogicalWidth());
        this.loader.checkLoadMore();
        this.requestRedraw();
      },
      (mouseX, mouseY) => {
        this.updateCrosshair(mouseX, mouseY);
      }
    );

    symbolSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && symbolSearch.value.trim() !== "") {
        const ticker = symbolSearch.value.trim().toUpperCase();
        const type = marketTypeSelect.value;
        const fullId = ticker.includes(':') ? ticker : `${ticker}:${type}`;
        this.currentSymbol = ticker;
        this.dataManager.setSymbol(fullId);
        this.scaleEngine.resetAutoScale();
        symbolSearch.blur();
      }
    });

    marketTypeSelect.addEventListener('change', () => {
      const type = marketTypeSelect.value;
      if (type === 'STOCK') { marketTypeSelect.style.color = '#ff9800'; exchangeSelect.value = 'Yahoo'; }
      else if (type === 'PERP') marketTypeSelect.style.color = '#f44336';
      else marketTypeSelect.style.color = '#2962ff';
    });

    exchangeSelect.addEventListener('change', () => {
      this.dataManager.setExchange(exchangeSelect.value);
      this.scaleEngine.resetAutoScale();
    });

    tfMainBtn.addEventListener('click', (e) => { e.stopPropagation(); tfPopup.classList.toggle('show'); });
    window.addEventListener('click', () => tfPopup.classList.remove('show'));
    tfPopup.addEventListener('click', (e) => e.stopPropagation());

    tfCustomInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && tfCustomInput.value.trim() !== "") {
        this.switchTimeframe(tfCustomInput.value.trim());
        tfPopup.classList.remove('show');
        tfCustomInput.value = "";
      }
    });

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    this.init();
  }

  // 🚨 新增：初始化繪圖工具列邏輯
  private initDrawingToolbar() {
    const tools = ['cursor', 'trendline', 'horizontal', 'rect'];
    tools.forEach(tool => {
      const btn = document.getElementById(`tool-${tool}`);
      if (!btn) return;
      btn.onclick = () => {
        // 清除所有按鈕 active 狀態
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        if (tool === 'cursor') {
          this.interactionEngine.setDrawingMode(null);
          btn.classList.add('active');
        } else {
          btn.classList.add('active');
          this.startDrawing(tool);
        }
      };
    });

    const clearBtn = document.getElementById('tool-clear');
    if (clearBtn) clearBtn.onclick = () => {
        // TODO: 實作清除邏輯
        console.log('Clear all drawings');
    };
  }

  private startDrawing(type: string) {
    let currentDrawing: DrawingObject | null = null;

    this.interactionEngine.setDrawingMode(type, (x, y, eventType) => {
      const price = this.scaleEngine.yToPrice(y);
      const { startIndex } = this.viewport.getRawRange();
      const candleWidth = this.viewport.getCandleWidth();
      const dataIndex = x / (candleWidth + 2) + startIndex;
      const time = this.dataManager.getTimeAtIndex(dataIndex);

      if (eventType === 'start') {
        currentDrawing = {
          id: Date.now().toString(),
          type: type as any,
          points: [{ time, price }, { time, price }],
          color: '#2962ff',
          lineWidth: 2
        };
        this.drawingEngine.setActiveDrawing(currentDrawing);
      } else if (eventType === 'move' && currentDrawing) {
        currentDrawing.points[1] = { time, price };
      } else if (eventType === 'end' && currentDrawing) {
        this.drawingEngine.addDrawing(currentDrawing);
        this.drawingEngine.setActiveDrawing(null);
        currentDrawing = null;
        // 畫完後自動切回游標 (可選)
        // this.interactionEngine.setDrawingMode(null);
      }
      this.requestRedraw();
    });
  }

  private sortTimeframes(tfs: string[]): string[] {
    const weights: { [key: string]: number } = { 's': 1, 'm': 60, 'H': 3600, 'D': 86400, 'W': 604800, 'M': 2592000 };
    return [...tfs].sort((a, b) => {
      const getVal = (s: string) => { const val = parseInt(s.slice(0, -1)) || 1; const unit = s.slice(-1); return val * (weights[unit] || 0); };
      return getVal(a) - getVal(b);
    });
  }

  private formatTfLabel(tf: string): string {
    const value = parseInt(tf.slice(0, -1)) || 1;
    const unit = tf.slice(-1);
    const unitMap: { [key: string]: string } = { 's': '秒', 'm': '分', 'H': '時', 'D': '日', 'W': '週', 'M': '月' };
    return `${value}${unitMap[unit] || unit}`;
  }

  private handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderEngine.resize(width, height);
    this.scaleEngine.updateDimensions(width, height);
    this.requestRedraw();
  }

  private async init() { await this.dataManager.loadInitialData(); }

  private renderTfFavorites() {
    const container = document.getElementById('tf-favorites')!;
    container.innerHTML = '';
    this.sortTimeframes(this.favorites).forEach(tf => {
      const btn = document.createElement('button');
      btn.className = `fav-btn ${this.currentTimeframe === tf ? 'active' : ''}`;
      btn.innerText = this.formatTfLabel(tf);
      btn.onclick = () => this.switchTimeframe(tf);
      container.appendChild(btn);
    });
  }

  private renderTfPopup() {
    const list = document.getElementById('tf-list')!;
    list.innerHTML = '';
    this.allTimeframes.forEach(tf => {
      const item = document.createElement('div');
      item.className = 'tf-item';
      const label = document.createElement('span');
      label.innerText = this.formatTfLabel(tf);
      label.style.flex = '1';
      label.onclick = () => { this.switchTimeframe(tf); document.getElementById('tf-popup')?.classList.remove('show'); };
      const star = document.createElement('span');
      star.className = `star ${this.favorites.includes(tf) ? 'active' : ''}`;
      star.innerHTML = this.favorites.includes(tf) ? '★' : '☆';
      star.onclick = (e) => { e.stopPropagation(); this.toggleFavorite(tf); };
      item.appendChild(label);
      item.appendChild(star);
      list.appendChild(item);
    });
  }

  private switchTimeframe(tf: string) {
    this.currentTimeframe = tf;
    this.dataManager.setTimeframe(tf);
    this.scaleEngine.resetAutoScale();
    document.getElementById('tf-main-btn')!.innerText = `${this.formatTfLabel(tf)} ▾`;
    this.renderTfFavorites();
  }

  private toggleFavorite(tf: string) {
    if (this.favorites.includes(tf)) this.favorites = this.favorites.filter(f => f !== tf);
    else this.favorites.push(tf);
    localStorage.setItem('tf-favorites', JSON.stringify(this.favorites));
    this.renderTfFavorites();
    this.renderTfPopup();
  }

  private isRedrawRequested = false;
  private requestRedraw() {
    if (this.isRedrawRequested) return;
    this.isRedrawRequested = true;
    requestAnimationFrame(() => { try { this.draw(); } finally { this.isRedrawRequested = false; } });
  }

  private draw() {
    const candles = this.dataManager.getCandles();
    const { start, end } = this.viewport.getVisibleRange();
    const { startIndex } = this.viewport.getRawRange();
    const visibleCandles = candles.slice(start, end);
    const candleWidth = this.viewport.getCandleWidth();

    this.scaleEngine.updateScale(visibleCandles);
    this.renderEngine.drawGrid(this.scaleEngine);
    this.renderEngine.drawAxes(visibleCandles, startIndex, candleWidth, 2, (idx) => this.dataManager.getTimeAtIndex(idx), this.scaleEngine);
    this.renderEngine.drawCandles(visibleCandles, start, startIndex, candleWidth, 2, this.scaleEngine);

    const ma20 = this.indicatorEngine.calculateMA(candles, 20);
    this.renderEngine.drawIndicator(ma20.slice(start, end), start, startIndex, candleWidth, 2, '#ffeb3b', this.scaleEngine);

    // 🚨 繪製圖形
    const overlayCtx = (document.getElementById('overlay-canvas') as HTMLCanvasElement).getContext('2d')!;
    this.drawingEngine.render(
        overlayCtx, 
        this.scaleEngine, 
        startIndex, 
        candleWidth, 
        2, 
        (t) => this.dataManager.getIndexAtTime(t)
    );

    const lastCandle = candles[candles.length - 1];
    if (lastCandle) {
      const color = lastCandle.close >= lastCandle.open ? '#26a69a' : '#ef5350';
      this.renderEngine.drawLastPriceLine(lastCandle.close, color, this.scaleEngine);
    }
    this.updateStatusUI();
  }

  private updateStatusUI() {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;
    if (this.connectionStatus === 'connected') {
      dot.style.background = '#26a69a'; text.innerText = `${this.currentSymbol} Live`;
    } else {
      dot.style.background = '#ef5350'; text.innerText = 'Disconnected';
    }
  }

  private updateCrosshair(mouseX: number, mouseY: number) {
    const price = this.scaleEngine.yToPrice(mouseY);
    const { startIndex } = this.viewport.getRawRange();
    const candleWidth = this.viewport.getCandleWidth();
    const dataIndex = mouseX / (candleWidth + 2) + startIndex;
    const timeStr = formatFullTime(this.dataManager.getTimeAtIndex(dataIndex));
    this.renderEngine.drawCrosshair(mouseX, mouseY, formatPrice(price), timeStr);
    
    // 🚨 重新繪製繪圖層 (因為 Crosshair 會清除畫布)
    const overlayCtx = (document.getElementById('overlay-canvas') as HTMLCanvasElement).getContext('2d')!;
    this.drawingEngine.render(overlayCtx, this.scaleEngine, startIndex, candleWidth, 2, (t) => this.dataManager.getIndexAtTime(t));
  }
}

window.onload = () => { new ChartEngine(); };

