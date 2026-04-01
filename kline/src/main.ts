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
