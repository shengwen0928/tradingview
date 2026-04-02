import { PineScriptEngine } from '../core/PineScriptEngine';
import { DataManager } from '../core/DataManager';

export class IndicatorModal {
    private modal: HTMLElement;
    private listContainer: HTMLElement;
    private searchInput: HTMLInputElement;
    
    private indicators = [
        {
            id: 'sykes_leain',
            name: '賽克斯X獵影 (Sykes X Leain)',
            description: '專業交易系統：包含 Vegas 通道、QQE MOD 與自動止盈止損標註。',
            author: 'User',
            script: `// 賽克斯X獵影 精簡執行版\n// 基於您的 指標.pine 核心邏輯\n\nema144 = ta.ema(close, 144)\nema169 = ta.ema(close, 169)\nema576 = ta.ema(close, 576)\nema676 = ta.ema(close, 676)\nema12 = ta.ema(close, 12)\n\nplot(ema144, "EMA 144", "#1848cc")\nplot(ema169, "EMA 169", "#1848cc")\nplot(ema576, "EMA 576", "#f23645")\nplot(ema676, "EMA 676", "#f23645")\nplot(ema12, "EMA 12", "#ff9800")\n\n// 訊號範例\nlong_signal = ta.crossover(ema12, math.max(ema144, ema169))\nif long_signal\n    label.new(bar_index, low, "BUY", color="#00ff00")\n\nshort_signal = ta.crossunder(ema12, math.min(ema144, ema169))\nif short_signal\n    label.new(bar_index, high, "SELL", color="#ff0000")`
        },
        {
            id: 'ma_cross',
            name: '均線交叉 (MA Cross)',
            description: '經典快慢均線交叉訊號。',
            author: 'System',
            script: `fast = ta.sma(close, 9)\nslow = ta.sma(close, 21)\nplot(fast, "Fast MA", "#2962ff")\nplot(slow, "Slow MA", "#ff9800")\nif ta.crossover(fast, slow)\n    label.new(bar_index, low, "UP", style="up")`
        }
    ];

    constructor(
        private pineEngine: PineScriptEngine,
        private activeManagerProvider: () => DataManager,
        private onRequestRedraw: () => void
    ) {
        this.modal = document.getElementById('indicator-modal')!;
        this.listContainer = document.getElementById('indicator-list')!;
        this.searchInput = document.getElementById('indicator-search') as HTMLInputElement;
        this.init();
    }

    private init() {
        const menuBtn = document.getElementById('indicator-menu-btn')!;
        const closeBtn = document.getElementById('indicator-modal-close')!;

        menuBtn.onclick = () => this.modal.classList.add('show');
        closeBtn.onclick = () => this.modal.classList.remove('show');

        this.renderList(this.indicators);

        this.searchInput.oninput = () => {
            const term = this.searchInput.value.toLowerCase();
            const filtered = this.indicators.filter(i => 
                i.name.toLowerCase().includes(term) || i.description.toLowerCase().includes(term)
            );
            this.renderList(filtered);
        };
    }

    private renderList(list: any[]) {
        this.listContainer.innerHTML = list.map(i => `
            <div class="symbol-item" data-id="${i.id}">
                <div style="display: flex; flex-direction: column;">
                    <span class="symbol-name">${i.name}</span>
                    <span class="symbol-desc">${i.description}</span>
                </div>
                <span class="symbol-exch">${i.author}</span>
            </div>
        `).join('');

        this.listContainer.querySelectorAll('.symbol-item').forEach(item => {
            (item as HTMLElement).onclick = () => {
                const id = (item as HTMLElement).dataset.id;
                const indicator = this.indicators.find(ind => ind.id === id);
                if (indicator) {
                    this.applyIndicator(indicator.script);
                    this.modal.classList.remove('show');
                }
            };
        });
    }

    private applyIndicator(script: string) {
        localStorage.setItem('pine-script-default', script);
        // 同步到編輯器 (如果有打開的話)
        const editorCode = document.getElementById('pine-code') as HTMLTextAreaElement;
        if (editorCode) editorCode.value = script;

        try {
            const compiledJs = this.pineEngine.compile(script);
            this.pineEngine.run(this.activeManagerProvider().getCandles(), compiledJs);
            this.onRequestRedraw();
        } catch (e) {
            console.error('[IndicatorModal] Error applying script:', e);
        }
    }
}
