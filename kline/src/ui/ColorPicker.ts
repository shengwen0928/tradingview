import { hsvToHex, hexToHsv, clamp } from '../utils/math';

export class ColorPicker {
    private h: number = 0;
    private s: number = 0;
    private v: number = 0;

    constructor(
        private container: HTMLElement,
        initialColor: string,
        private onChange: (hex: string) => void
    ) {
        const { h, s, v } = hexToHsv(initialColor);
        this.h = h; this.s = s; this.v = v;
        this.render();
        this.initEvents();
    }

    private render() {
        this.container.innerHTML = `
            <div class="custom-picker-container">
                <canvas id="sv-canvas" width="120" height="80"></canvas>
                <div class="sv-cursor" id="sv-cursor"></div>
                <canvas id="hue-canvas" width="120" height="12"></canvas>
                <div class="hue-cursor" id="hue-cursor"></div>
            </div>
        `;
        this.updateUI(false);
    }

    private updateUI(triggerChange: boolean = true) {
        const svCanvas = this.container.querySelector('#sv-canvas') as HTMLCanvasElement;
        const hueCanvas = this.container.querySelector('#hue-canvas') as HTMLCanvasElement;
        const svCursor = this.container.querySelector('#sv-cursor') as HTMLElement;
        const hueCursor = this.container.querySelector('#hue-cursor') as HTMLElement;

        if (!svCanvas || !hueCanvas || !svCursor || !hueCursor) return;

        // 1. SV 區域
        const svCtx = svCanvas.getContext('2d');
        if (svCtx) {
            svCtx.clearRect(0, 0, svCanvas.width, svCanvas.height);
            svCtx.fillStyle = hsvToHex(this.h, 100, 100);
            svCtx.fillRect(0, 0, svCanvas.width, svCanvas.height);
            
            const whiteGrd = svCtx.createLinearGradient(0, 0, svCanvas.width, 0);
            whiteGrd.addColorStop(0, 'rgba(255,255,255,1)'); 
            whiteGrd.addColorStop(1, 'rgba(255,255,255,0)');
            svCtx.fillStyle = whiteGrd; svCtx.fillRect(0, 0, svCanvas.width, svCanvas.height);

            const blackGrd = svCtx.createLinearGradient(0, 0, 0, svCanvas.height);
            blackGrd.addColorStop(0, 'rgba(0,0,0,0)'); 
            blackGrd.addColorStop(1, 'rgba(0,0,0,1)');
            svCtx.fillStyle = blackGrd; svCtx.fillRect(0, 0, svCanvas.width, svCanvas.height);
        }

        // 2. Hue 區域
        const hueCtx = hueCanvas.getContext('2d');
        if (hueCtx) {
            hueCtx.clearRect(0, 0, hueCanvas.width, hueCanvas.height);
            const hueGrd = hueCtx.createLinearGradient(0, 0, hueCanvas.width, 0);
            for(let i=0; i<=360; i+=30) hueGrd.addColorStop(i/360, hsvToHex(i, 100, 100));
            hueCtx.fillStyle = hueGrd; hueCtx.fillRect(0, 0, hueCanvas.width, hueCanvas.height);
        }

        // 3. 游標位置
        svCursor.style.left = `${(this.s/100) * svCanvas.width}px`;
        svCursor.style.top = `${(1 - this.v/100) * svCanvas.height}px`;
        hueCursor.style.left = `${(this.h/360) * hueCanvas.width}px`;

        if (triggerChange) {
            this.onChange(hsvToHex(this.h, this.s, this.v));
        }
    }

    private initEvents() {
        const svCanvas = this.container.querySelector('#sv-canvas') as HTMLElement;
        const hueCanvas = this.container.querySelector('#hue-canvas') as HTMLElement;

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
    }
}
