export class TimeframeController {
  private favorites: string[];
  private currentTf: string;
  private selectedUnit: string = 'm';

  constructor(
    private onSwitch: (tf: string) => void,
    private onRequestRedraw: () => void
  ) {
    this.favorites = JSON.parse(localStorage.getItem('tf-favorites') || '["1m", "1H", "1D"]');
    this.currentTf = '1m';
    this.init();
  }

  private init() {
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
            console.log(`[TimeframeController] Timezone set to: ${tz}`);
            this.onRequestRedraw();
        });
    });

    // 🚀 自訂週期單位邏輯
    const unitBtns = document.querySelectorAll('[data-unit]');
    unitBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            unitBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.selectedUnit = (btn as HTMLElement).dataset.unit || 'm';
        });
    });

    const customAddBtn = document.getElementById('tf-custom-add')!;
    const customValInput = document.getElementById('tf-custom-val') as HTMLInputElement;
    customAddBtn.onclick = () => {
        const val = customValInput.value;
        if (val && parseInt(val) > 0) {
            this.switchTimeframe(`${val}${this.selectedUnit}`);
            tfModal.classList.remove('show');
        }
    };

    this.renderTfFavorites();
    this.renderTfPopup();
  }

  public switchTimeframe(tf: string) {
    this.currentTf = tf;
    this.onSwitch(tf);
    this.renderTfFavorites();
    localStorage.setItem('tf-favorites', JSON.stringify(this.favorites));
  }

  public renderTfFavorites() {
    const c = document.getElementById('tf-favorites')!;
    c.innerHTML = '';
    this.favorites.forEach(tf => {
      const b = document.createElement('button');
      b.className = `fav-btn ${this.currentTf === tf ? 'active' : ''}`;
      b.innerText = tf;
      b.onclick = () => this.switchTimeframe(tf);
      c.appendChild(b);
    });
  }

  public renderTfPopup() {
    const grid = document.getElementById('tf-grid')!;
    grid.innerHTML = '';
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
        if (this.favorites.includes(item.val)) {
          this.favorites = this.favorites.filter(f => f !== item.val);
        } else {
          this.favorites.push(item.val);
        }
        this.renderTfPopup();
        this.renderTfFavorites();
      };

      btn.appendChild(label);
      btn.appendChild(star);
      grid.appendChild(btn);
    });
  }

  public getCurrentTimeframe() {
    return this.currentTf;
  }
}
