import { ALL_SYMBOLS } from '../constants/symbols';

export class SymbolModal {
  private modal: HTMLDivElement;
  private input: HTMLInputElement;
  private listDiv: HTMLDivElement;
  private tabBtns: NodeListOf<Element>;
  private activeCategory: string = 'CRYPTO';

  constructor(private onSelect: (symbol: string, category: string) => void) {
    this.modal = document.getElementById('symbol-modal') as HTMLDivElement;
    this.input = document.getElementById('modal-search-input') as HTMLInputElement;
    this.listDiv = document.getElementById('modal-list') as HTMLDivElement;
    this.tabBtns = document.querySelectorAll('.tab-btn');
    this.init();
  }

  private init() {
    const btn = document.getElementById('symbol-search-btn') as HTMLButtonElement;
    btn.onclick = () => {
      this.modal.classList.add('show');
      this.input.value = '';
      this.updateList('');
      setTimeout(() => this.input.focus(), 50);
    };

    window.addEventListener('click', (e) => {
      if (e.target === this.modal) this.modal.classList.remove('show');
    });

    this.input.oninput = () => this.updateList(this.input.value.trim());
    this.input.onkeydown = (e) => {
      if (e.key === 'Enter' && this.input.value.trim()) {
        this.onSelect(this.input.value.trim(), this.activeCategory);
        this.modal.classList.remove('show');
      }
    };

    this.tabBtns.forEach(t => {
      t.addEventListener('click', () => {
        this.tabBtns.forEach(b => b.classList.remove('active'));
        t.classList.add('active');
        this.activeCategory = (t as HTMLElement).dataset.cat || 'CRYPTO';
        this.updateList(this.input.value.trim());
      });
    });
  }

  public updateList(search: string) {
    const query = search.toUpperCase();
    this.listDiv.innerHTML = '';
    
    if (query) {
      const isNum = /^\d{4}$/.test(query);
      const div = document.createElement('div');
      div.className = 'symbol-item';
      div.style.borderLeft = '4px solid #2962ff';
      const exch = (isNum || this.activeCategory === 'TW_STOCK') ? 'Yahoo' : 'Binance';
      div.innerHTML = `<div><div class="symbol-name">🔍 搜尋 "${query}${isNum ? '.TW' : ''}"</div><div class="symbol-desc">按 Enter 載入</div></div><div class="symbol-exch">${exch}</div>`;
      div.onclick = () => {
        this.onSelect(query, this.activeCategory);
        this.modal.classList.remove('show');
      };
      this.listDiv.appendChild(div);
    }

    const items = ALL_SYMBOLS[this.activeCategory] || [];
    items.filter(i => i.s.includes(query) || i.d.toUpperCase().includes(query)).forEach(item => {
      const div = document.createElement('div');
      div.className = 'symbol-item';
      div.innerHTML = `<div><div class="symbol-name">${item.s}</div><div class="symbol-desc">${item.d}</div></div><div class="symbol-exch">${this.activeCategory === 'CRYPTO' ? 'Binance' : 'Yahoo'}</div>`;
      div.onclick = () => {
        this.onSelect(item.s, this.activeCategory);
        this.modal.classList.remove('show');
      };
      this.listDiv.appendChild(div);
    });
  }

  public close() {
    this.modal.classList.remove('show');
  }
}
