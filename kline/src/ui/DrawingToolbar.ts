import { InteractionEngine } from '../core/InteractionEngine';
import { DrawingEngine } from '../core/DrawingEngine';

export class DrawingToolbar {
  constructor(
    private interactionEngine: InteractionEngine,
    private drawingEngine: DrawingEngine,
    private onRequestRedraw: () => void,
    private startDrawing: (tool: string) => void
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
          const isActive = btn.classList.contains('active');
          
          // 清除所有按鈕的 active 狀態
          document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));

          if (tool === 'cursor' || isActive) {
            // 如果點擊的是游標，或是重複點擊目前的工具 -> 切換回游標模式
            document.getElementById('tool-cursor')?.classList.add('active');
            this.interactionEngine.setDrawingMode(null);
            this.drawingEngine.endDrawing(); // 確保停止任何進行中的繪圖
          } else {
            // 正常切換到新工具
            btn.classList.add('active');
            this.startDrawing(tool);
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
  }

  private initMagnetLogic() {
    const btn = document.getElementById('tool-magnet')!;
    const icon = document.getElementById('magnet-icon')!;
    
    // 初始化一次狀態 (確保同步)
    const initialMode = this.interactionEngine.getMagnetMode();
    this.updateMagnetUI(initialMode, btn, icon);

    btn.onclick = () => {
      const current = this.interactionEngine.getMagnetMode();
      let next: 'off' | 'weak' | 'strong' = 'off';
      if (current === 'off') next = 'weak';
      else if (current === 'weak') next = 'strong';
      else next = 'off';
      
      this.interactionEngine.setMagnetMode(next);
      this.updateMagnetUI(next, btn, icon);
    };
  }

  private updateMagnetUI(mode: 'off' | 'weak' | 'strong', btn: HTMLElement, icon: HTMLElement) {
    if (mode === 'off') {
      icon.style.stroke = '#787b86';
      btn.title = '磁鐵模式 (關閉)';
      btn.classList.remove('active');
    } else if (mode === 'weak') {
      icon.style.stroke = '#2962ff';
      btn.title = '磁鐵模式 (弱磁鐵)';
      btn.classList.add('active');
    } else {
      icon.style.stroke = '#f0b90b';
      btn.title = '磁鐵模式 (強磁鐵)';
      btn.classList.add('active');
    }
  }
}
