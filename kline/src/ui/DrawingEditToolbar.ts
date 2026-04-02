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
                <div class="width-menu-wrapper">
                    <div class="width-main-btn" id="width-trigger">${hit.lineWidth || 2}px</div>
                    <div class="width-popover" id="width-popover" style="display:none">
                        ${widths.map(w => `<div class="width-item ${hit.lineWidth === w ? 'active' : ''}" data-width="${w}">${w}px</div>`).join('')}
                    </div>
                </div>
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

        // 1. 顏色彈窗處理
        const colorTrigger = toolbar.querySelector('#color-trigger') as HTMLElement;
        const colorPopover = toolbar.querySelector('#color-popover') as HTMLElement;
        colorTrigger.onclick = (e) => {
            e.stopPropagation();
            widthPopover.style.display = 'none'; // 互斥
            colorPopover.style.display = colorPopover.style.display === 'none' ? 'block' : 'none';
        };

        // 2. 寬度彈窗處理 (歸類收納)
        const widthTrigger = toolbar.querySelector('#width-trigger') as HTMLElement;
        const widthPopover = toolbar.querySelector('#width-popover') as HTMLElement;
        widthTrigger.onclick = (e) => {
            e.stopPropagation();
            colorPopover.style.display = 'none'; // 互斥
            widthPopover.style.display = widthPopover.style.display === 'none' ? 'block' : 'none';
        };

        // 3. 初始化自定義色盤
        const pickerRoot = toolbar.querySelector('#custom-picker-root') as HTMLElement;
        new ColorPicker(pickerRoot, hit.color, (newColor) => {
            update({ color: newColor });
            colorTrigger.style.background = newColor;
        });

        // 4. 預設顏色點點擊
        toolbar.querySelectorAll('.color-dot').forEach(dot => {
            (dot as HTMLElement).onclick = () => {
                const newColor = (dot as HTMLElement).dataset.color!;
                update({ color: newColor });
                colorTrigger.style.background = newColor;
                colorPopover.style.display = 'none';
            };
        });

        // 5. 寬度項目點擊
        toolbar.querySelectorAll('.width-item').forEach(item => {
            (item as HTMLElement).onclick = () => {
                const lineWidth = parseInt((item as HTMLElement).dataset.width!);
                update({ lineWidth });
                widthTrigger.innerText = `${lineWidth}px`;
                toolbar.querySelectorAll('.width-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                widthPopover.style.display = 'none';
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
