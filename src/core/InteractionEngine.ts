/**
 * 負責指標事件 (Pointer Events)、捲動、縮放與十字線控制
 */
export class InteractionEngine {
  private isDragging: boolean = false;
  private velocity: number = 0;
  private animationId: number | null = null;
  private lastMoveTime: number = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private onScroll: (deltaX: number) => void,
    private onZoom: (mouseX: number, scale: number) => void,
    private onMouseMove: (mouseX: number, mouseY: number) => void
  ) {
    this.initEvents();
  }

  private initEvents(): void {
    // 使用 Pointer Events 支援觸控與滑鼠，並解決事件丟失問題
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.velocity = 0;
      this.stopInertia();
      
      // 鎖定指標，即使移出畫布範圍也能繼續捕捉事件
      this.canvas.setPointerCapture(e.pointerId);
      
      const { mouseX, mouseY } = this.getMousePos(e);
      this.onMouseMove(mouseX, mouseY);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const { mouseX, mouseY } = this.getMousePos(e);

      if (this.isDragging) {
        // 使用 movementX 獲取相對位移，最為精確且不受座標系縮放影響
        // 注意：OKX 資料是時間軸向右，拖拽向左應為捲動
        const deltaX = -e.movementX; 
        this.onScroll(deltaX);

        // 計算速度用於慣性
        const now = performance.now();
        const dt = now - this.lastMoveTime;
        if (dt > 0) {
          this.velocity = deltaX;
        }
        this.lastMoveTime = now;
      }

      this.onMouseMove(mouseX, mouseY);
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.releasePointerCapture(e.pointerId);
        
        // 如果放開時還有速度，啟動慣性
        if (Math.abs(this.velocity) > 0.5) {
          this.startInertia();
        }
      }
    });

    this.canvas.addEventListener('pointercancel', (e) => {
      this.isDragging = false;
      this.canvas.releasePointerCapture(e.pointerId);
      this.stopInertia();
    });

    // 縮放邏輯
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const { mouseX } = this.getMousePos(e);
      // 根據滾輪方向決定縮放比例
      const scale = e.deltaY > 0 ? 1.05 : 0.95;
      this.onZoom(mouseX, scale);
    }, { passive: false });
  }

  private getMousePos(e: PointerEvent | WheelEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      mouseX: e.clientX - rect.left,
      mouseY: e.clientY - rect.top
    };
  }

  /**
   * 慣性捲動：讓滑動感覺更絲滑
   */
  private startInertia(): void {
    const friction = 0.92; // 摩擦力
    const step = () => {
      if (Math.abs(this.velocity) < 0.1) {
        this.stopInertia();
        return;
      }
      this.velocity *= friction;
      this.onScroll(this.velocity);
      this.animationId = requestAnimationFrame(step);
    };
    this.animationId = requestAnimationFrame(step);
  }

  private stopInertia(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
