import { hsvToHex8, hexToHsv, clamp } from '../utils/math';

export class ColorPicker {
    private h: number = 0;
    private s: number = 0;
    private v: number = 0;
    private a: number = 1; // 🚀 新增：透明度

    constructor(
        private container: HTMLElement,
        initialColor: string,
        private onChange: (hex: string) => void
    ) {
        const { h, s, v, a } = hexToHsv(initialColor);
        this.h = h; this.s = s; this.v = v; this.a = a;
        this.render();
        this.initEvents();
    }

    private render() {
        this.container.innerHTML = `
            <div class="custom-picker-container">
                <div class="picker-area" style="height: 80px;">
                    <canvas id="sv-canvas" width="120" height="80"></canvas>
                    <div class="sv-cursor" id="sv-cursor"></div>
                </div>
                <div class="picker-area" style="height: 12px;">
                    <canvas id="hue-canvas" width="120" height="12"></canvas>
                    <div class="hue-cursor" id="hue-cursor"></div>
                </div>
                <div class="picker-area" style="height: 12px;">
                    <div class="alpha-bg"></div>
                    <canvas id="alpha-canvas" width="120" height="12"></canvas>
                    <div class="alpha-cursor" id="alpha-cursor"></div>
                </div>
            </div>
        `;
        // 🚀 延遲一幀執行，確保 DOM 已掛載
        requestAnimationFrame(() => this.updateUI(false));
    }

    private updateUI(triggerChange: boolean = true) {
        const svCanvas = this.container.querySelector('#sv-canvas') as HTMLCanvasElement;
        const hueCanvas = this.container.querySelector('#hue-canvas') as HTMLCanvasElement;
        const alphaCanvas = this.container.querySelector('#alpha-canvas') as HTMLCanvasElement;
        
        const svCursor = this.container.querySelector('#sv-cursor') as HTMLElement;
        const hueCursor = this.container.querySelector('#hue-cursor') as HTMLElement;
        const alphaCursor = this.container.querySelector('#alpha-cursor') as HTMLElement;

        if (!svCanvas || !hueCanvas || !alphaCanvas || !svCursor || !hueCursor || !alphaCursor) return;

        // 1. SV 區域
        const svCtx = svCanvas.getContext('2d');
        if (svCtx) {
            const baseHex = hsvToHex8(this.h, 100, 100, 1);
            svCtx.clearRect(0, 0, svCanvas.width, svCanvas.height);
            svCtx.fillStyle = baseHex;
            svCtx.fillRect(0, 0, svCanvas.width, svCanvas.height);
            
            const whiteGrd = svCtx.createLinearGradient(0, 0, svCanvas.width, 0);
            whiteGrd.addColorStop(0, 'rgba(255,255,255,1)'); whiteGrd.addColorStop(1, 'rgba(255,255,255,0)');
            svCtx.fillStyle = whiteGrd; svCtx.fillRect(0, 0, svCanvas.width, svCanvas.height);

            const blackGrd = svCtx.createLinearGradient(0, 0, 0, svCanvas.height);
            blackGrd.addColorStop(0, 'rgba(0,0,0,0)'); blackGrd.addColorStop(1, 'rgba(0,0,0,1)');
            svCtx.fillStyle = blackGrd; svCtx.fillRect(0, 0, svCanvas.width, svCanvas.height);
        }

        // 2. Hue 區域
        const hueCtx = hueCanvas.getContext('2d');
        if (hueCtx) {
            hueCtx.clearRect(0, 0, hueCanvas.width, hueCanvas.height);
            const hueGrd = hueCtx.createLinearGradient(0, 0, hueCanvas.width, 0);
            for(let i=0; i<=360; i+=30) hueGrd.addColorStop(i/360, hsvToHex8(i, 100, 100, 1));
            hueCtx.fillStyle = hueGrd; hueCtx.fillRect(0, 0, hueCanvas.width, hueCanvas.height);
        }

        // 3. Alpha 區域
        const alphaCtx = alphaCanvas.getContext('2d');
        if (alphaCtx) {
            alphaCtx.clearRect(0, 0, alphaCanvas.width, alphaCanvas.height);
            const alphaGrd = alphaCtx.createLinearGradient(0, 0, alphaCanvas.width, 0);
            const rgbHex = hsvToHex8(this.h, this.s, this.v, 1).substring(0, 7);
            alphaGrd.addColorStop(0, `${rgbHex}00`);
            alphaGrd.addColorStop(1, `${rgbHex}ff`);
            alphaCtx.fillStyle = alphaGrd;
            alphaCtx.fillRect(0, 0, alphaCanvas.width, alphaCanvas.height);
        }

        // 4. 游標位置
        svCursor.style.left = `${(this.s/100) * svCanvas.width}px`;
        svCursor.style.top = `${(1 - this.v/100) * svCanvas.height}px`;
        hueCursor.style.left = `${(this.h/360) * hueCanvas.width}px`;
        alphaCursor.style.left = `${this.a * alphaCanvas.width}px`;

        if (triggerChange) {
            this.onChange(hsvToHex8(this.h, this.s, this.v, this.a));
        }
    }

    private initEvents() {
        const svCanvas = this.container.querySelector('#sv-canvas') as HTMLElement;
        const hueCanvas = this.container.querySelector('#hue-canvas') as HTMLElement;
        const alphaCanvas = this.container.querySelector('#alpha-canvas') as HTMLElement;

        const setupDrag = (el: HTMLElement, fn: (e: PointerEvent) => void) => {
            el.onpointerdown = (e) => {
                el.setPointerCapture(e.pointerId);
                fn(e);
                el.onpointermove = fn;
                el.onpointerup = () => { el.onpointermove = null; el.onpointerup = null; };
            };
        };

        setupDrag(svCanvas, (e) => {
            const rect = svCanvas.getBoundingClientRect();
            this.s = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100);
            this.v = clamp((1 - (e.clientY - rect.top) / rect.height) * 100, 0, 100);
            this.updateUI();
        });

        setupDrag(hueCanvas, (e) => {
            const rect = hueCanvas.getBoundingClientRect();
            this.h = clamp(((e.clientX - rect.left) / rect.width) * 360, 0, 360);
            this.updateUI();
        });

        setupDrag(alphaCanvas, (e) => {
            const rect = alphaCanvas.getBoundingClientRect();
            this.a = clamp((e.clientX - rect.left) / rect.width, 0, 1);
            this.updateUI();
        });
    }
}
