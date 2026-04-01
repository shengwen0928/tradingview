import { DataManager } from './core/DataManager';
// 🚀 Deployment Trigger: 2026-03-31 20:45
import { ViewportEngine } from './core/ViewportEngine';
import { ScaleEngine } from './core/ScaleEngine';
import { RenderEngine } from './core/RenderEngine';
import { InteractionEngine } from './core/InteractionEngine';
import { LoaderController } from './core/LoaderController';
import { IndicatorEngine } from './core/IndicatorEngine';
import { DrawingEngine, DrawingObject, DrawingPoint } from './core/DrawingEngine';
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

  private allSymbols: { [key: string]: { s: string, d: string }[] } = {
    'CRYPTO': [
      { s: 'BTC/USDT', d: 'Bitcoin' }, { s: 'ETH/USDT', d: 'Ethereum' }, { s: 'SOL/USDT', d: 'Solana' },
      { s: 'BNB/USDT', d: 'Binance Coin' }, { s: 'XRP/USDT', d: 'Ripple' }, { s: 'ADA/USDT', d: 'Cardano' },
      { s: 'DOGE/USDT', d: 'Dogecoin' }, { s: 'DOT/USDT', d: 'Polkadot' }, { s: 'MATIC/USDT', d: 'Polygon' },
      { s: 'LTC/USDT', d: 'Litecoin' }, { s: 'SHIB/USDT', d: 'Shiba Inu' }, { s: 'AVAX/USDT', d: 'Avalanche' },
      { s: 'TRX/USDT', d: 'TRON' }, { s: 'LINK/USDT', d: 'Chainlink' }, { s: 'UNI/USDT', d: 'Uniswap' },
      { s: 'PEPE/USDT', d: 'Pepe' }, { s: 'STX/USDT', d: 'Stacks' }, { s: 'APT/USDT', d: 'Aptos' },
      { s: 'OP/USDT', d: 'Optimism' }, { s: 'ARB/USDT', d: 'Arbitrum' }, { s: 'NEAR/USDT', d: 'Near' },
      { s: 'FIL/USDT', d: 'Filecoin' }, { s: 'ICP/USDT', d: 'Internet Computer' }, { s: 'ETC/USDT', d: 'Ethereum Classic' },
      { s: 'XLM/USDT', d: 'Stellar' }, { s: 'SUI/USDT', d: 'Sui' }, { s: 'TIA/USDT', d: 'Celestia' }
    ],
    'TW_STOCK': [
      { s: '2330.TW', d: '台積電' }, { s: '2317.TW', d: '鴻海' }, { s: '2454.TW', d: '聯發科' },
      { s: '3105.TWO', d: '穩懋' }, { s: '2603.TW', d: '長榮' }, { s: '2609.TW', d: '陽明' },
      { s: '2308.TW', d: '台達電' }, { s: '2881.TW', d: '富邦金' }, { s: '2882.TW', d: '國泰金' },
      { s: '2357.TW', d: '華碩' }, { s: '3231.TW', d: '緯創' }, { s: '2382.TW', d: '廣達' },
      { s: '1101.TW', d: '台泥' }, { s: '2002.TW', d: '中鋼' }, { s: '2412.TW', d: '中華電' },
      { s: '2886.TW', d: '兆豐金' }, { s: '2884.TW', d: '玉山金' }, { s: '5880.TW', d: '合庫金' },
      { s: '2303.TW', d: '聯電' }, { s: '2618.TW', d: '星宇航空' }, { s: '2610.TW', d: '華航' },
      { s: '2337.TW', d: '旺宏' }, { s: '2409.TW', d: '友達' }, { s: '3481.TW', d: '群創' },
      { s: '2324.TW', d: '仁寶' }, { s: '2353.TW', d: '宏碁' }, { s: '2376.TW', d: '技嘉' },
      { s: '2377.TW', d: '微星' }, { s: '3034.TW', d: '聯詠' }, { s: '3711.TW', d: '日月光' },
      { s: '2408.TW', d: '南亞科' }, { s: '2344.TW', d: '華邦電' }, { s: '2301.TW', d: '光寶科' },
      { s: '2313.TW', d: '華通' }, { s: '2327.TW', d: '國巨' }, { s: '2352.TW', d: '佳世達' },
      { s: '2356.TW', d: '英業達' }, { s: '2360.TW', d: '致茂' }, { s: '2379.TW', d: '瑞昱' },
      { s: '2383.TW', d: '台光電' }, { s: '2385.TW', d: '群光' }, { s: '2395.TW', d: '研華' },
      { s: '3008.TW', d: '大立光' }, { s: '3037.TW', d: '欣興' }, { s: '3045.TW', d: '台灣大' },
      { s: '4904.TW', d: '遠傳' }, { s: '4938.TW', d: '和碩' }, { s: '0050.TW', d: '元大台灣50' },
      { s: '0056.TW', d: '元大高股息' }, { s: '00878.TW', d: '國泰永續高股息' }
    ],
    'US_STOCK': [
      { s: 'AAPL', d: 'Apple' }, { s: 'NVDA', d: 'NVIDIA' }, { s: 'TSLA', d: 'Tesla' },
      { s: 'MSFT', d: 'Microsoft' }, { s: 'GOOGL', d: 'Alphabet' }, { s: 'AMZN', d: 'Amazon' },
      { s: 'META', d: 'Meta' }, { s: 'NFLX', d: 'Netflix' }, { s: 'AMD', d: 'AMD' },
      { s: 'INTC', d: 'Intel' }, { s: 'PYPL', d: 'PayPal' }, { s: 'COIN', d: 'Coinbase' },
      { s: 'BRK-B', d: 'Berkshire Hathaway' }, { s: 'V', d: 'Visa' }, { s: 'JPM', d: 'JPMorgan Chase' },
      { s: 'WMT', d: 'Walmart' }, { s: 'DIS', d: 'Disney' }, { s: 'MA', d: 'Mastercard' },
      { s: 'UNH', d: 'UnitedHealth' }, { s: 'HD', d: 'Home Depot' }, { s: 'BAC', d: 'Bank of America' },
      { s: 'PG', d: 'P&G' }, { s: 'ORCL', d: 'Oracle' }, { s: 'ABNV', d: 'Airbnb' },
      { s: 'AVGO', d: 'Broadcom' }, { s: 'COST', d: 'Costco' }, { s: 'CRM', d: 'Salesforce' }
    ]
  };

  constructor() {
    this.overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    this.renderEngine = new RenderEngine(document.getElementById('grid-canvas') as HTMLCanvasElement, document.getElementById('candle-canvas') as HTMLCanvasElement, this.overlayCanvas);
    this.scaleEngine = new ScaleEngine();
    this.viewport = new ViewportEngine(() => this.requestRedraw());
    this.indicatorEngine = new IndicatorEngine();
    this.drawingEngine = new DrawingEngine();
    
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
    this.activeManager = this.cryptoManager;

    this.favorites = JSON.parse(localStorage.getItem('tf-favorites') || '["1m", "1H", "1D"]');
    this.initModalLogic();
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
    this.injectCustomStyles();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
    this.init();
  }

  private initMagnetLogic() {
    const btn = document.getElementById('tool-magnet')!;
    const icon = document.getElementById('magnet-icon')!;
    btn.onclick = () => {
      const current = this.interactionEngine.getMagnetMode();
      let next: 'off' | 'weak' | 'strong' = 'off';
      if (current === 'off') next = 'weak';
      else if (current === 'weak') next = 'strong';
      else next = 'off';
      this.interactionEngine.setMagnetMode(next);
      if (next === 'off') { icon.style.stroke = '#787b86'; btn.title = '磁鐵模式 (關閉)'; }
      else if (next === 'weak') { icon.style.stroke = '#2962ff'; btn.title = '磁鐵模式 (弱磁鐵)'; }
      else { icon.style.stroke = '#f0b90b'; btn.title = '磁鐵模式 (強磁鐵)'; }
    };
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
  }

  private initModalLogic() {
    const btn = document.getElementById('symbol-search-btn') as HTMLButtonElement;
    const modal = document.getElementById('symbol-modal') as HTMLDivElement;
    const input = document.getElementById('modal-search-input') as HTMLInputElement;
    const tabBtns = document.querySelectorAll('.tab-btn');
    btn.onclick = () => { modal.classList.add('show'); input.value = ''; this.updateModalList(''); setTimeout(() => input.focus(), 50); };
    window.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('show'); });
    input.oninput = () => this.updateModalList(input.value.trim());
    input.onkeydown = (e) => { if (e.key === 'Enter' && input.value.trim()) { this.loadSymbol(input.value.trim()); modal.classList.remove('show'); } };
    tabBtns.forEach(t => {
      t.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        t.classList.add('active');
        this.activeCategory = (t as HTMLElement).dataset.cat || 'CRYPTO';
        this.updateModalList(input.value.trim());
      });
    });
    // 🚀 專業時間週期 Modal 邏輯
    const tfBtn = document.getElementById('tf-main-btn')!;
    const tfModal = document.getElementById('tf-modal')!;
    const tfModalClose = document.getElementById('tf-modal-close')!;
    
    tfBtn.onclick = () => { tfModal.classList.add('show'); this.renderTfPopup(); };
    tfModalClose.onclick = () => tfModal.classList.remove('show');
    window.addEventListener('click', (e) => { if (e.target === tfModal) tfModal.classList.remove('show'); });

    // 🚀 時區按鈕邏輯
    const tzBtns = document.querySelectorAll('#tz-btn-group .unit-btn');
    tzBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tzBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tz = (btn as HTMLElement).dataset.tz;
            console.log(`[ChartEngine] Timezone set to: ${tz}`);
            this.requestRedraw();
        });
    });

    // 🚀 自訂週期單位邏輯
    let selectedUnit = 'm';
    const unitBtns = document.querySelectorAll('[data-unit]');
    unitBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            unitBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedUnit = (btn as HTMLElement).dataset.unit || 'm';
        });
    });

    const customAddBtn = document.getElementById('tf-custom-add')!;
    const customValInput = document.getElementById('tf-custom-val') as HTMLInputElement;
    customAddBtn.onclick = () => {
        const val = customValInput.value;
        if (val && parseInt(val) > 0) {
            this.switchTimeframe(`${val}${selectedUnit}`);
            tfModal.classList.remove('show');
        }
    };

    this.renderTfFavorites(); this.renderTfPopup();
  }

  // ... (方法保持)

  private renderTfPopup() {
    const grid = document.getElementById('tf-grid')!; grid.innerHTML = '';
    const intervals = [
      { label: '1m', val: '1m' }, { label: '3m', val: '3m' }, { label: '5m', val: '5m' }, { label: '15m', val: '15m' },
      { label: '30m', val: '30m' }, { label: '1H', val: '1H' }, { label: '2H', val: '2H' }, { label: '4H', val: '4H' },
      { label: '1D', val: '1D' }, { label: '1W', val: '1W' }, { label: '1M', val: '1M' }
    ];

    intervals.forEach(item => {
      const btn = document.createElement('div');
      btn.style.cssText = 'background:#1e222d; border:1px solid #363c4e; border-radius:4px; padding:10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; font-size:13px;';
      
      const label = document.createElement('span'); 
      label.innerText = item.label;
      label.style.flex = '1';
      label.onclick = () => { this.switchTimeframe(item.val); document.getElementById('tf-modal')?.classList.remove('show'); };

      const star = document.createElement('span');
      const isFav = this.favorites.includes(item.val);
      star.innerText = isFav ? '★' : '☆';
      star.style.color = isFav ? '#ffb100' : '#787b86';
      star.style.fontSize = '16px';
      star.onclick = (e) => {
        e.stopPropagation();
        if (this.favorites.includes(item.val)) this.favorites = this.favorites.filter(f => f !== item.val);
        else this.favorites.push(item.val);
        this.renderTfPopup(); this.renderTfFavorites();
      };

      btn.appendChild(label); btn.appendChild(star); grid.appendChild(btn);
    });
  }

  private injectCustomStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
        .unit-btn { background: #1e222d; border: 1px solid #363c4e; color: #d1d4dc; padding: 6px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s; }
        .unit-btn:hover { background: #2a2e39; }
        .unit-btn.active { background: #2962ff; color: #fff; border-color: #2962ff; }
    `;
    document.head.appendChild(style);
  }

  private updateModalList(search: string) {
    const listDiv = document.getElementById('modal-list')!;
    const query = search.toUpperCase();
    listDiv.innerHTML = '';
    if (query) {
        const isNum = /^\d{4}$/.test(query);
        const div = document.createElement('div');
        div.className = 'symbol-item';
        div.style.borderLeft = '4px solid #2962ff';
        const exch = (isNum || this.activeCategory === 'TW_STOCK') ? 'Yahoo' : 'Binance';
        div.innerHTML = `<div><div class="symbol-name">🔍 搜尋 "${query}${isNum ? '.TW' : ''}"</div><div class="symbol-desc">按 Enter 載入</div></div><div class="symbol-exch">${exch}</div>`;
        div.onclick = () => { this.loadSymbol(query); document.getElementById('symbol-modal')?.classList.remove('show'); };
        listDiv.appendChild(div);
    }
    const items = this.allSymbols[this.activeCategory] || [];
    items.filter(i => i.s.includes(query) || i.d.toUpperCase().includes(query)).forEach(item => {
        const div = document.createElement('div');
        div.className = 'symbol-item';
        div.innerHTML = `<div><div class="symbol-name">${item.s}</div><div class="symbol-desc">${item.d}</div></div><div class="symbol-exch">${this.activeCategory === 'CRYPTO' ? 'Binance' : 'Yahoo'}</div>`;
        div.onclick = () => { this.loadSymbol(item.s); document.getElementById('symbol-modal')?.classList.remove('show'); };
        listDiv.appendChild(div);
    });
  }

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
    console.log(`[ChartEngine] Switching to ${isStock ? 'Stock' : 'Crypto'} mode...`);
    await this.activeManager.update('', '', ''); 
    this.activeManager = isStock ? this.stockManager : this.cryptoManager;
    this.loader = new LoaderController(this.activeManager, this.viewport);
    this.scaleEngine.resetAutoScale();
    await this.activeManager.update(fullId, this.currentTimeframe, exch);
    this.requestRedraw();
  }

  private initDrawingToolbar() {
    const tools = ['cursor', 'move', 'trendline', 'ray', 'arrow', 'horizontal', 'vertical', 'rect', 'fibonacci', 'text', 'priceRange', 'brush', 'parallelChannel', 'triangle', 'ellipse'];
    tools.forEach(tool => {
      const btn = document.getElementById(`tool-${tool}`);
      if (btn) btn.onclick = () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (tool === 'cursor') this.interactionEngine.setDrawingMode(null);
        else this.startDrawing(tool);
      };
    });
    const clear = document.getElementById('tool-clear');
    if (clear) clear.onclick = () => { if (confirm('清除所有繪圖？')) { this.drawingEngine.getDrawings().forEach(d => this.drawingEngine.deleteDrawing(d.id)); this.requestRedraw(); } };
    this.overlayCanvas.addEventListener('click', (e: MouseEvent) => {
      if (this.interactionEngine.getDrawingMode()) return;
      const rect = this.overlayCanvas.getBoundingClientRect();
      const hit = this.drawingEngine.hitTest(e.clientX - rect.left, e.clientY - rect.top, this.scaleEngine, this.viewport.getRawRange().startIndex, this.viewport.getCandleWidth(), 2, (t) => this.activeManager.getIndexAtTime(t));
      if (hit) this.showEditToolbar(e.clientX, e.clientY, hit); else this.hideEditToolbar();
    });
  }

  private showEditToolbar(x: number, y: number, obj: DrawingObject) {
    let t = document.getElementById('edit-toolbar');
    if (!t) { t = document.createElement('div'); t.id = 'edit-toolbar'; t.style.cssText = 'position: fixed; z-index: 1000; background: #1e222d; border: 1px solid #363c4e; padding: 8px; border-radius: 6px; display: flex; gap: 8px; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5);'; document.body.appendChild(t); }
    t.style.display = 'flex'; t.style.left = `${x}px`; t.style.top = `${y - 50}px`;
    t.innerHTML = `<input type="color" id="edit-color" value="${obj.color}" style="width: 24px; height: 24px; border: none; background: transparent;"><button id="edit-delete" style="background:transparent;border:none;color:#ef5350;padding:4px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>`;
    (t.querySelector('#edit-color') as HTMLInputElement).oninput = (e) => { this.drawingEngine.updateDrawingColor(obj.id, (e.target as HTMLInputElement).value); this.requestRedraw(); };
    (t.querySelector('#edit-delete') as HTMLButtonElement).onclick = () => { this.drawingEngine.deleteDrawing(obj.id); this.hideEditToolbar(); this.requestRedraw(); };
  }

  private hideEditToolbar() { const t = document.getElementById('edit-toolbar'); if (t) t.style.display = 'none'; }

  private startDrawing(type: string) {
    let cur: DrawingObject | null = null;
    let clickCount = 0;
    let lastX = 0, lastY = 0;
    let startPointsSnapshot: DrawingPoint[] = [];

    this.interactionEngine.setDrawingMode(type, (x, y, ev) => {
      const price = this.scaleEngine.yToPrice(y);
      const time = this.activeManager.getTimeAtIndex(x / (this.viewport.getCandleWidth() + 2) + this.viewport.getRawRange().startIndex);
      
      if (type === 'move') {
        if (ev === 'start') {
            const hit = this.drawingEngine.hitTest(x, y, this.scaleEngine, this.viewport.getRawRange().startIndex, this.viewport.getCandleWidth(), 2, (t) => this.activeManager.getIndexAtTime(t));
            if (hit) { cur = hit; lastX = x; lastY = y; startPointsSnapshot = JSON.parse(JSON.stringify(hit.points)); }
        } else if (ev === 'move' && cur && startPointsSnapshot.length > 0) {
            const dx = x - lastX, dy = y - lastY;
            cur.points.forEach((p, i) => {
                const snapP = startPointsSnapshot[i];
                const snapX = this.scaleEngine.indexToX(this.activeManager.getIndexAtTime(snapP.time), this.viewport.getRawRange().startIndex, this.viewport.getCandleWidth(), 2);
                const snapY = this.scaleEngine.priceToY(snapP.price);
                const nextX = snapX + dx, nextY = snapY + dy;
                p.time = this.activeManager.getTimeAtIndex(this.scaleEngine.xToIndex(nextX, this.viewport.getRawRange().startIndex, this.viewport.getCandleWidth(), 2));
                p.price = this.scaleEngine.yToPrice(nextY);
            });
        } else if (ev === 'end') { cur = null; startPointsSnapshot = []; }
        this.requestRedraw(); return;
      }

      if (type === 'brush') {
        if (ev === 'start') { cur = { id: Date.now().toString(), type: 'brush', points: [{ time, price }], color: '#2962ff', lineWidth: 2 }; this.drawingEngine.setActiveDrawing(cur); }
        else if (ev === 'move' && cur) { cur.points.push({ time, price }); }
        else if (ev === 'end' && cur) { this.drawingEngine.addDrawing(cur); this.drawingEngine.setActiveDrawing(null); cur = null; }
        this.requestRedraw(); return;
      }
      if (ev === 'start') {
        clickCount++;
        if (clickCount === 1) {
          if (type === 'text') { const c = prompt('內容:'); if (c) this.drawingEngine.addDrawing({ id: Date.now().toString(), type: 'text', points: [{ time, price }], color: '#fff', lineWidth: 2, text: c }); this.finishDrawing(); }
          else if (type === 'horizontal' || type === 'vertical') { const obj: DrawingObject = { id: Date.now().toString(), type: type as any, points: [{ time, price }], color: '#2962ff', lineWidth: 2 }; this.drawingEngine.addDrawing(obj); this.finishDrawing(); }
          else if (type === 'parallelChannel' || type === 'triangle') { cur = { id: Date.now().toString(), type: type as any, points: [{ time, price }, { time, price }, { time, price }], color: '#2962ff', lineWidth: 2 }; this.drawingEngine.setActiveDrawing(cur); }
          else { cur = { id: Date.now().toString(), type: type as any, points: [{ time, price }, { time, price }], color: '#2962ff', lineWidth: 2 }; this.drawingEngine.setActiveDrawing(cur); }
        } else if (clickCount === 2) {
          if (type === 'parallelChannel' || type === 'triangle') { if (cur) cur.points[1] = { time, price }; }
          else { if (cur) { cur.points[1] = { time, price }; this.drawingEngine.addDrawing(cur); } this.finishDrawing(); }
        } else if (clickCount === 3) { if (cur) { cur.points[2] = { time, price }; this.drawingEngine.addDrawing(cur); } this.finishDrawing(); }
      } else if (ev === 'move' && cur) {
        if (clickCount === 1) { cur.points[1] = { time, price }; if (cur.points[2]) cur.points[2] = { time, price }; }
        else if (clickCount === 2) { cur.points[2] = { time, price }; }
      }
      this.requestRedraw();
    });
  }

  private finishDrawing() { this.interactionEngine.setDrawingMode(null); this.drawingEngine.setActiveDrawing(null); document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); document.getElementById('tool-cursor')?.classList.add('active'); }

  private renderTfFavorites() {
    const c = document.getElementById('tf-favorites')!; c.innerHTML = '';
    this.favorites.forEach(tf => {
      const b = document.createElement('button'); b.className = `fav-btn ${this.currentTimeframe === tf ? 'active' : ''}`;
      b.innerText = tf; b.onclick = () => this.switchTimeframe(tf); c.appendChild(b);
    });
  }

  private switchTimeframe(tf: string) { this.currentTimeframe = tf; this.activeManager.setTimeframe(tf); this.scaleEngine.resetAutoScale(); this.renderTfFavorites(); }
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
    const ma20 = this.indicatorEngine.calculateMA(candles, 20);
    this.renderEngine.drawIndicator(ma20.slice(start, end), start, startIndex, cw, 2, '#ffeb3b', this.scaleEngine);
    const oCtx = (document.getElementById('overlay-canvas') as HTMLCanvasElement).getContext('2d')!;
    this.drawingEngine.render(oCtx, this.scaleEngine, startIndex, cw, 2, (t) => this.activeManager.getIndexAtTime(t), this.hoveredDrawingId);
    if (this.lastMousePos.x > 0 || this.lastMousePos.y > 0) {
        const price = this.scaleEngine.yToPrice(this.lastMousePos.y);
        const time = this.activeManager.getTimeAtIndex(this.lastMousePos.x / (this.viewport.getCandleWidth() + 2) + startIndex);
        this.renderEngine.drawCrosshair(this.lastMousePos.x, this.lastMousePos.y, formatPrice(price), formatFullTime(time));
    }
    const last = candles[candles.length - 1];
    if (last) this.renderEngine.drawLastPriceLine(last.close, last.close >= last.open ? '#26a69a' : '#ef5350', this.scaleEngine);
    this.updateStatusUI();
  }

  private updateStatusUI() {
    const dot = document.getElementById('status-dot'), text = document.getElementById('status-text');
    if (!dot || !text) return;
    if (this.connectionStatus === 'connected') { dot.style.background = '#26a69a'; text.innerText = `${this.currentSymbol} Live`; }
    else { dot.style.background = '#ef5350'; text.innerText = `${this.currentSymbol} Disconnected`; }
  }

  private lastMousePos = { x: 0, y: 0 };
  private updateCrosshair(mouseX: number, mouseY: number) {
    this.lastMousePos = { x: mouseX, y: mouseY };
    const { startIndex } = this.viewport.getRawRange();
    const candleWidth = this.viewport.getCandleWidth();
    this.hoveredDrawingId = this.drawingEngine.hitTest(mouseX, mouseY, this.scaleEngine, startIndex, candleWidth, 2, (t) => this.activeManager.getIndexAtTime(t))?.id || null;
    const index = Math.round(mouseX / (candleWidth + 2) + startIndex);
    const candles = this.activeManager.getCandles();
    this.updateOHLCUI(candles[index]);
    this.requestRedraw();
  }

  private updateOHLCUI(candle: any) {
    const o = document.getElementById('ohlc-o'), h = document.getElementById('ohlc-h'), l = document.getElementById('ohlc-l'), c = document.getElementById('ohlc-c'), chg = document.getElementById('ohlc-chg');
    if (!o || !h || !l || !c || !chg) return;
    if (!candle || typeof candle.open === 'undefined') { o.innerText = h.innerText = l.innerText = c.innerText = chg.innerText = '--'; chg.style.color = '#929498'; return; }
    const diff = candle.close - candle.open, pct = ((diff / candle.open) * 100).toFixed(2), color = diff >= 0 ? '#26a69a' : '#ef5350';
    o.innerText = candle.open.toFixed(2); h.innerText = candle.high.toFixed(2); l.innerText = candle.low.toFixed(2); c.innerText = candle.close.toFixed(2);
    chg.innerText = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${pct}%)`; chg.style.color = color;
  }

  private handleResize() { const w = window.innerWidth, h = window.innerHeight; this.renderEngine.resize(w, h); this.scaleEngine.updateDimensions(w, h); this.requestRedraw(); }
  private async init() { await this.activeManager.loadInitialData(); }
}

window.onload = () => { new ChartEngine(); };
