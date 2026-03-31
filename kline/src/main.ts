import { DataManager } from './core/DataManager';
// 🚀 Deployment Trigger: 2026-03-31 15:58
import { ViewportEngine } from './core/ViewportEngine';
import { ScaleEngine } from './core/ScaleEngine';
import { RenderEngine } from './core/RenderEngine';
import { InteractionEngine } from './core/InteractionEngine';
import { LoaderController } from './core/LoaderController';
import { IndicatorEngine } from './core/IndicatorEngine';
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
  private connectionStatus: string = 'connecting';
  private currentSymbol: string = 'BTC/USDT'; 
  private currentTimeframe: string = '1m'; 
  private allTimeframes = [
    '1s', '1m', '3m', '5m', '15m', '30m', 
    '1H', '2H', '4H', '6H', '12H', 
    '1D', '2D', '3D', '5D', '1W', '1M', '3M'
  ];
  private favorites: string[] = []; // 我的最愛

  // 🚨 新增：週期權重排序 (用於快捷列)
  private sortTimeframes(tfs: string[]): string[] {
    const weights: { [key: string]: number } = {
      's': 1, 'm': 60, 'H': 3600, 'D': 86400, 'W': 604800, 'M': 2592000
    };
    return [...tfs].sort((a, b) => {
      const getVal = (s: string) => {
        const val = parseInt(s.slice(0, -1)) || 1;
        const unit = s.slice(-1);
        return val * (weights[unit] || 0);
      };
      return getVal(a) - getVal(b);
    });
  }

  // 🚨 新增：轉換週期顯示文字為中文
  private formatTfLabel(tf: string): string {
    const value = parseInt(tf.slice(0, -1)) || 1;
    const unit = tf.slice(-1);
    const unitMap: { [key: string]: string } = {
      's': '秒', 'm': '分鐘', 'H': '小時', 'D': '日', 'W': '週', 'M': '月', 'Y': '年'
    };
    return `${value}${unitMap[unit] || unit}`;
  }

  constructor() {
    // 1. 取得所有 UI 元素
    const gridCanvas = document.getElementById('grid-canvas') as HTMLCanvasElement;
    const candleCanvas = document.getElementById('candle-canvas') as HTMLCanvasElement;
    const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    
    const marketTypeSelect = document.getElementById('market-type-select') as HTMLSelectElement;
    const symbolSearch = document.getElementById('symbol-search') as HTMLInputElement;
    const exchangeSelect = document.getElementById('exchange-select') as HTMLSelectElement;
    
    const tfMainBtn = document.getElementById('tf-main-btn') as HTMLButtonElement;
    const tfPopup = document.getElementById('tf-popup') as HTMLDivElement;
    const tfCustomInput = document.getElementById('tf-custom-input') as HTMLInputElement;

    // 2. 初始化引擎組件
    this.renderEngine = new RenderEngine(gridCanvas, candleCanvas, overlayCanvas);
    this.scaleEngine = new ScaleEngine();
    this.viewport = new ViewportEngine(() => this.requestRedraw());
    this.indicatorEngine = new IndicatorEngine();
    
    this.dataManager = new DataManager(
      (candles, isHistory) => {
        this.viewport.setDataCount(candles.length, isHistory);
      },
      (status) => {
        this.connectionStatus = status;
        this.updateStatusUI();
      }
    );

    // 3. 載入持久化狀態 (我的最愛等)
    const savedFavs = localStorage.getItem('tf-favorites');
    this.favorites = savedFavs ? JSON.parse(savedFavs) : ['1m', '1H', '1D'];

    // 4. UI 渲染初始化
    this.renderTfFavorites();
    this.renderTfPopup();

    // 5. 事件監聽設定
    
    // 🚨 監聽搜尋輸入框 (Enter 鍵)
    symbolSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && symbolSearch.value.trim() !== "") {
        const ticker = symbolSearch.value.trim().toUpperCase();
        const type = marketTypeSelect.value;
        const fullId = ticker.includes(':') ? ticker : `${ticker}:${type}`;
        
        console.log(`[ChartEngine] Searching for: ${fullId}`);
        
        this.currentSymbol = ticker;
        this.dataManager.setSymbol(fullId);
        this.scaleEngine.resetAutoScale();
        symbolSearch.blur();
      }
    });

    // 監聽市場類型切換
    marketTypeSelect.addEventListener('change', () => {
      const type = marketTypeSelect.value;
      if (type === 'STOCK') {
        marketTypeSelect.style.color = '#ff9800'; 
        exchangeSelect.value = 'Yahoo';
      } else if (type === 'PERP') {
        marketTypeSelect.style.color = '#f44336';
      } else {
        marketTypeSelect.style.color = '#2962ff';
      }
    });

    // 監聽交易所切換
    exchangeSelect.addEventListener('change', () => {
      this.dataManager.setExchange(exchangeSelect.value);
      this.scaleEngine.resetAutoScale();
    });

    // 監聽週期切換相關
    tfMainBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tfPopup.classList.toggle('show');
    });

    window.addEventListener('click', () => tfPopup.classList.remove('show'));
    tfPopup.addEventListener('click', (e) => e.stopPropagation());

    tfCustomInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && tfCustomInput.value.trim() !== "") {
        const val = tfCustomInput.value.trim();
        this.switchTimeframe(val);
        tfPopup.classList.remove('show');
        tfCustomInput.value = "";
      }
    });

    // 6. 其他模組初始化
    this.loader = new LoaderController(this.dataManager, this.viewport);

    new InteractionEngine(
      overlayCanvas,
      (deltaX, deltaY, zone) => {
        if (zone === 'price') {
          this.scaleEngine.handleVerticalPan(deltaY);
        } else {
          this.viewport.handleScroll(deltaX);
          this.scaleEngine.handleVerticalPan(deltaY);
        }
        this.loader.checkLoadMore();
        this.requestRedraw();
      },
      (mouseX, _mouseY, scale, zone) => {
        if (zone === 'price') {
          this.scaleEngine.handleVerticalZoom(scale);
        } else if (zone === 'time') {
          this.viewport.handleZoom(this.renderEngine.getLogicalWidth() / 2, scale, this.renderEngine.getLogicalWidth());
        } else {
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

  // 🚨 新增：渲染我的最愛快捷按鈕
  private renderTfFavorites() {
    const container = document.getElementById('tf-favorites')!;
    container.innerHTML = '';
    
    // 🚨 排序後再渲染
    const sortedFavs = this.sortTimeframes(this.favorites);
    
    sortedFavs.forEach(tf => {
      const btn = document.createElement('button');
      btn.className = `fav-btn ${this.currentTimeframe === tf ? 'active' : ''}`;
      btn.innerText = this.formatTfLabel(tf); // 🚨 中文化顯示
      btn.onclick = () => this.switchTimeframe(tf);
      container.appendChild(btn);
    });
  }

  // 🚨 新增：渲染彈窗內的週期列表
  private renderTfPopup() {
    const list = document.getElementById('tf-list')!;
    list.innerHTML = '';
    this.allTimeframes.forEach(tf => {
      const item = document.createElement('div');
      item.className = 'tf-item';
      
      const label = document.createElement('span');
      label.innerText = this.formatTfLabel(tf); // 🚨 中文化顯示
      label.style.flex = '1';
      label.onclick = () => {
        this.switchTimeframe(tf);
        document.getElementById('tf-popup')?.classList.remove('show');
      };

      const star = document.createElement('span');
      star.className = `star ${this.favorites.includes(tf) ? 'active' : ''}`;
      star.innerHTML = this.favorites.includes(tf) ? '★' : '☆';
      star.onclick = (e) => {
        e.stopPropagation();
        this.toggleFavorite(tf);
      };

      item.appendChild(label);
      item.appendChild(star);
      list.appendChild(item);
    });
  }

  // 🚨 新增：切換週期邏輯
  private switchTimeframe(tf: string) {
    this.currentTimeframe = tf;
    this.dataManager.setTimeframe(tf);
    this.scaleEngine.resetAutoScale();
    
    // 更新主按鈕文字
    const tfMainBtn = document.getElementById('tf-main-btn')!;
    tfMainBtn.innerText = `${this.formatTfLabel(tf)} ▾`; // 🚨 中文化顯示
    
    this.renderTfFavorites(); // 重新渲染快捷區以更新 active 狀態
  }

  // 🚨 新增：切換我的最愛
  private toggleFavorite(tf: string) {
    if (this.favorites.includes(tf)) {
      this.favorites = this.favorites.filter(f => f !== tf);
    } else {
      this.favorites.push(tf);
    }
    localStorage.setItem('tf-favorites', JSON.stringify(this.favorites));
    this.renderTfFavorites();
    this.renderTfPopup();
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
      startIndex, 
      candleWidth, 
      2, 
      (idx) => this.dataManager.getTimeAtIndex(idx), // 🚨 使用精確回調
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

    // 🚨 繪製技術指標
    const ma20 = this.indicatorEngine.calculateMA(candles, 20);
    const ema50 = this.indicatorEngine.calculateEMA(candles, 50);
    
    // 只繪製可見範圍內的指標，需對齊 start 索引
    this.renderEngine.drawIndicator(ma20.slice(start, end), start, startIndex, candleWidth, 2, '#ffeb3b', this.scaleEngine);
    this.renderEngine.drawIndicator(ema50.slice(start, end), start, startIndex, candleWidth, 2, '#e040fb', this.scaleEngine);

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
    
    // 🚨 修正：反推 Index 的邏輯必須考慮 drawWidth 與精確位移
    const { startIndex } = this.viewport.getRawRange();
    const candleWidth = this.viewport.getCandleWidth();
    const spacing = 2; // 固定間距
    
    // 逆運算：x = (index - startIndex) * (w + s)  =>  index = x / (w + s) + startIndex
    // 這裡我們需要的是滑鼠相對於繪圖區左側的位移
    const dataIndex = Math.floor(mouseX / (candleWidth + spacing) + startIndex);
    
    let timeStr = '';
    if (candles.length > 0) {
      // 使用精確的 DataManager 邏輯推算時間
      const projectedTime = this.dataManager.getTimeAtIndex(dataIndex);
      timeStr = formatFullTime(projectedTime);
    }
    
    const priceStr = formatPrice(price);
    this.renderEngine.drawCrosshair(mouseX, mouseY, priceStr, timeStr);
  }
}

// 啟動引擎
window.onload = () => {
  new ChartEngine();
};
