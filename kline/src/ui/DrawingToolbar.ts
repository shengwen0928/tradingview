import { InteractionEngine } from '../core/InteractionEngine';
import { DrawingEngine } from '../core/DrawingEngine';
import { ScaleEngine } from '../core/ScaleEngine';
import { DataManager } from '../core/DataManager';

export class DrawingToolbar {
  constructor(
    private interactionEngine: InteractionEngine,
    private drawingEngine: DrawingEngine,
    private scaleEngine: ScaleEngine,
    private activeManagerProvider: () => DataManager,
    private onRequestRedraw: () => void,
    private showEditToolbar: (x: number, y: number, hit: any) => void,
    private hideEditToolbar: () => void
  ) {
    this.init();
    this.initMagnetLogic();
  }

  private init() {
    const tools = ['cursor', 'move', 'trendline', 'ray', 'arrow', 'horizontal', 'vertical', 'rect', 'fibonacci', 'text', 'priceRange', 'brush', 'parallelChannel', 'triangle', 'ellipse'];
    tools.forEach(tool => {
      const btn = document.getElementById(`tool-${tool}`);
      if (btn) {
        btn.onclick = () => {
          document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          if (tool === 'cursor') {
            this.interactionEngine.setDrawingMode(null);
          } else {
            this.interactionEngine.setDrawingMode(tool as any);
          }
        };
      }
    });

    const clear = document.getElementById('tool-clear');
    if (clear) {
      clear.onclick = () => {
        if (confirm('清除所有繪圖？')) {
          this.drawingEngine.getDrawings().forEach(d => this.drawingEngine.deleteDrawing(d.id));
          this.onRequestRedraw();
        }
      };
    }

    const overlayCanvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
    overlayCanvas.addEventListener('click', (e: MouseEvent) => {
      if (this.interactionEngine.getDrawingMode()) return;
      const rect = overlayCanvas.getBoundingClientRect();
      const hit = this.drawingEngine.hitTest(
        e.clientX - rect.left,
        e.clientY - rect.top,
        this.scaleEngine,
        0, // Will be updated by caller if needed or we could pass viewport
        0, // candleWidth
        2, // spacing
        (t) => this.activeManagerProvider().getIndexAtTime(t)
      );
      // Note: hitTest parameters need to be consistent with main draw loop
      // This is a simplified version, the actual hit test might need more context
    });
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
      if (next === 'off') {
        icon.style.stroke = '#787b86';
        btn.title = '磁鐵模式 (關閉)';
      } else if (next === 'weak') {
        icon.style.stroke = '#2962ff';
        btn.title = '磁鐵模式 (弱磁鐵)';
      } else {
        icon.style.stroke = '#f0b90b';
        btn.title = '磁鐵模式 (強磁鐵)';
      }
    };
  }
}
