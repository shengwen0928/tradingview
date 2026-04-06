import { PineScriptEngine } from '../core/engines/PineScriptEngine';
import { DataManager } from '../core/services/DataManager';

export class IndicatorModal {
    private modal: HTMLElement;
    private listContainer: HTMLElement;
    private searchInput: HTMLInputElement;
    
    private indicators = [
        {
            id: 'sykes_leain',
            name: '賽克斯X獵影 (V6 引擎版)',
            description: '使用強化後的 Pine 引擎運行原始 V6 策略邏輯。',
            author: 'User',
            script: `// 這裡之後可以貼入您完整的 指標.pine 內容\nema144 = ta.ema(close, 144)\nema169 = ta.ema(close, 169)\nplot(ema144, "EMA 144", "#1848cc")\nplot(ema169, "EMA 169", "#1848cc")`
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
