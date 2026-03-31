/**
 * 負責指標事件 (Pointer Events)、捲動、縮放與十字線控制
 */
export class InteractionEngine {
  private isDragging: boolean = false;
  private dragZone: 'chart' | 'price' | 'time' = 'chart';
  private velocityX: number = 0;
  private velocityY: number = 0;
  private animationId: number | null = null;
  private lastMoveTime: number = 0;

  // 🚨 新增：繪圖相關狀態
  private drawingMode: string | null = null;
  private magnetMode: boolean = true; // 預設開啟磁吸
  private onDrawingClick?: (mouseX: number, mouseY: number, type: 'start' | 'move' | 'end') => void;
  private snapProvider?: (x: number, y: number) => { x: number, y: number } | null;

  constructor(
    private canvas: HTMLCanvasElement,
    private onScroll: (deltaX: number, deltaY: number, zone: 'chart' | 'price' | 'time') => void,
    private onZoom: (mouseX: number, mouseY: number, scale: number, zone: 'chart' | 'price' | 'time') => void,
    private onMouseMove: (mouseX: number, mouseY: number) => void
  ) {
    this.initEvents();
  }

  public setDrawingMode(type: string | null, onClick?: (x: number, y: number, t: 'start' | 'move' | 'end') => void) {
    this.drawingMode = type;
    this.onDrawingClick = onClick;
    this.canvas.style.cursor = type ? 'crosshair' : 'default';
  }

  public getDrawingMode() {
    return this.drawingMode;
  }

  public setSnapProvider(provider: (x: number, y: number) => { x: number, y: number } | null) {
    this.snapProvider = provider;
  }

  public setMagnetMode(enabled: boolean) {
    this.magnetMode = enabled;
  }

  private initEvents(): void {
    const getZone = (x: number, y: number): 'chart' | 'price' | 'time' => {
      const drawWidth = this.canvas.clientWidth - 60;
      const drawHeight = this.canvas.clientHeight - 30;
      if (x > drawWidth) return 'price';
      if (y > drawHeight) return 'time';
      return 'chart';
    };

    const handleDrawingPos = (x: number, y: number) => {
      if (this.magnetMode && this.snapProvider) {
        const snapped = this.snapProvider(x, y);
        if (snapped) return snapped;
      }
      return { x, y };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      const { mouseX, mouseY } = this.getMousePos(e);
      const zone = getZone(mouseX, mouseY);

      // 🚨 修正：如果是繪圖模式且在圖表區，觸發繪圖點
      if (this.drawingMode && zone === 'chart') {
        const { x, y } = handleDrawingPos(mouseX, mouseY);
        this.onDrawingClick?.(x, y, 'start');
        return;
      }

      this.isDragging = true;
      this.dragZone = zone;
      
      this.velocityX = 0;
      this.velocityY = 0;
      this.stopInertia();
      
      this.canvas.setPointerCapture(e.pointerId);
      this.onMouseMove(mouseX, mouseY);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const { mouseX, mouseY } = this.getMousePos(e);

      if (this.drawingMode) {
        const { x, y } = handleDrawingPos(mouseX, mouseY);
        this.onDrawingClick?.(x, y, 'move');
      }

      if (this.isDragging) {
        const deltaX = -e.movementX;
        const deltaY = e.movementY;
        
        this.onScroll(deltaX, deltaY, this.dragZone);

        const now = performance.now();
        const dt = now - this.lastMoveTime;
        if (dt > 0) {
          this.velocityX = deltaX;
          this.velocityY = deltaY;
        }
        this.lastMoveTime = now;
      }

      this.onMouseMove(mouseX, mouseY);
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (this.drawingMode) {
        const { mouseX, mouseY } = this.getMousePos(e);
        const { x, y } = handleDrawingPos(mouseX, mouseY);
        this.onDrawingClick?.(x, y, 'end');
        return;
      }

      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.releasePointerCapture(e.pointerId);
        
        if (Math.abs(this.velocityX) > 0.5 || Math.abs(this.velocityY) > 0.5) {
          this.startInertia();
        }
      }
    });

    this.canvas.addEventListener('pointercancel', (e) => {
      this.isDragging = false;
      this.canvas.releasePointerCapture(e.pointerId);
      this.stopInertia();
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const { mouseX, mouseY } = this.getMousePos(e);
      const scale = e.deltaY > 0 ? 1.05 : 0.95;
      const zone = getZone(mouseX, mouseY);
      this.onZoom(mouseX, mouseY, scale, zone);
    }, { passive: false });
  }

  private getMousePos(e: PointerEvent | WheelEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      mouseX: e.clientX - rect.left,
      mouseY: e.clientY - rect.top
    };
  }

  private startInertia(): void {
    const friction = 0.92;
    const step = () => {
      if (Math.abs(this.velocityX) < 0.1 && Math.abs(this.velocityY) < 0.1) {
        this.stopInertia();
        return;
      }
      this.velocityX *= friction;
      this.velocityY *= friction;
      this.onScroll(this.velocityX, this.velocityY, this.dragZone);
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
