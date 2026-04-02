import { ColorPicker } from './ColorPicker';

export class DrawingEditToolbar {
    private toolbar: HTMLElement | null = null;

    constructor(
        private drawingEngine: any,
        private requestRedraw: () => void
    ) {}

    public show(x: number, y: number, hit: any) {
        this.hide();

        const toolbar = document.createElement('div');
        toolbar.id = 'drawing-edit-toolbar';
        toolbar.className = 'edit-toolbar';
        toolbar.style.left = `${x + 20}px`;
        toolbar.style.top = `${y - 20}px`;

        const colors = ['#2962ff', '#ef5350', '#26a69a', '#f0b90b', '#ffffff', '#000000', '#9c27b0', '#ff9800'];
        const widths = [1, 2, 3, 4];

        toolbar.innerHTML = `
            <div class="toolbar-section">
                <div class="color-menu-wrapper">
                    <div class="color-main-btn" id="color-trigger" style="background:${hit.color}"></div>
                    <div class="color-popover" id="color-popover" style="display:none">
                        <div class="color-grid">
                            ${colors.map(c => `<div class="color-dot" style="background:${c}" data-color="${c}"></div>`).join('')}
                        </div>
                        <div class="color-popover-divider"></div>
                        <div id="custom-picker-root"></div>
                    </div>
                </div>
            </div>
            <div class="toolbar-divider"></div>
            <div class="toolbar-section">
                ${widths.map(w => `<div class="width-btn ${hit.lineWidth === w ? 'active' : ''}" data-width="${w}">${w}px</div>`).join('')}
            </div>
            <div class="toolbar-divider"></div>
            <div class="toolbar-section">
                <div class="style-btn" id="toggle-dash">${hit.isDash ? '實線' : '虛線'}</div>
                <div class="delete-btn" id="delete-drawing">🗑️</div>
            </div>
        `;

        document.body.appendChild(toolbar);
        this.toolbar = toolbar;

        // 統一更新輔助函式
        const update = (props: any) => {
            this.drawingEngine.updateDrawingProperties(hit.id, props);
            this.requestRedraw();
        };

        // 1. 初始化顏色彈出選單
        const trigger = toolbar.querySelector('#color-trigger') as HTMLElement;
        const popover = toolbar.querySelector('#color-popover') as HTMLElement;
        trigger.onclick = (e) => {
            e.stopPropagation();
            popover.style.display = popover.style.display === 'none' ? 'block' : 'none';
        };

        // 2. 初始化自定義色盤
        const pickerRoot = toolbar.querySelector('#custom-picker-root') as HTMLElement;
        new ColorPicker(pickerRoot, hit.color, (newColor) => {
            update({ color: newColor });
            trigger.style.background = newColor;
        });

        // 3. 預設顏色點點擊
        toolbar.querySelectorAll('.color-dot').forEach(dot => {
            (dot as HTMLElement).onclick = () => {
                const newColor = (dot as HTMLElement).dataset.color!;
                update({ color: newColor });
                trigger.style.background = newColor;
                popover.style.display = 'none';
            };
        });

        // 4. 寬度調整 (歸類處理)
        toolbar.querySelectorAll('.width-btn').forEach(btn => {
            (btn as HTMLElement).onclick = () => {
                const lineWidth = parseInt((btn as HTMLElement).dataset.width!);
                update({ lineWidth });
                toolbar.querySelectorAll('.width-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            };
        });

        // 5. 虛線切換
        const dashBtn = toolbar.querySelector('#toggle-dash') as HTMLElement;
        dashBtn.onclick = () => {
            hit.isDash = !hit.isDash;
            update({ isDash: hit.isDash });
            dashBtn.innerText = hit.isDash ? '實線' : '虛線';
        };

        // 6. 刪除
        const deleteBtn = toolbar.querySelector('#delete-drawing') as HTMLElement;
        deleteBtn.onclick = () => {
            this.drawingEngine.deleteDrawing(hit.id);
            this.hide();
            this.requestRedraw();
        };

        toolbar.onclick = (e) => e.stopPropagation();
    }

    public hide() {
        if (this.toolbar) {
            this.toolbar.remove();
            this.toolbar = null;
        }
    }
}
