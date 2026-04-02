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
  private lastDragX: number = 0; 
  private lastDragY: number = 0; 
  private cachedRect: DOMRect | null = null;
  private cachedDrawWidth: number = 0;

  // 繪圖相關狀態
  private drawingMode: string | null = null;
  private magnetMode: 'off' | 'weak' | 'strong' = 'off'; 
  private onDrawingClick?: (mouseX: number, mouseY: number, type: 'start' | 'move' | 'end') => void;
  private snapProvider?: (x: number, y: number, mode: 'weak' | 'strong') => { x: number, y: number } | null;

  constructor(
    private canvas: HTMLCanvasElement,
    private onScroll: (deltaX: number, deltaY: number, zone: 'chart' | 'price' | 'time') => void,
    private onZoom: (mouseX: number, mouseY: number, scale: number, zone: 'chart' | 'price' | 'time') => void,
    private onMouseMove: (mouseX: number, mouseY: number) => void
  ) {
    this.updateCache();
    this.initEvents();
  }

  private updateCache() {
    this.cachedRect = this.canvas.getBoundingClientRect();
    this.cachedDrawWidth = this.canvas.clientWidth - 60;
  }

  public resize() {
    this.updateCache();
  }

  public setDrawingMode(type: string | null, onClick?: (x: number, y: number, t: 'start' | 'move' | 'end') => void) {
    this.drawingMode = type;
    this.onDrawingClick = onClick;
    if (type === 'move') {
        this.canvas.style.cursor = 'move';
    } else {
        this.canvas.style.cursor = type ? 'crosshair' : 'default';
    }
  }

  public getDrawingMode() {
    return this.drawingMode;
  }

  public setSnapProvider(provider: (x: number, y: number, mode: 'weak' | 'strong') => { x: number, y: number } | null) {
    this.snapProvider = provider;
  }

  public setMagnetMode(mode: 'off' | 'weak' | 'strong') {
    this.magnetMode = mode;
  }

  public getMagnetMode() {
    return this.magnetMode;
  }

  public getSnappedPos(mouseX: number, mouseY: number): { x: number, y: number } {
    if (this.magnetMode !== 'off' && this.snapProvider) {
      const snapped = this.snapProvider(mouseX, mouseY, this.magnetMode);
      if (snapped) return snapped;
    }
    return { x: mouseX, y: mouseY };
  }

  private initEvents(): void {
    const getZone = (x: number, y: number): 'chart' | 'price' | 'time' => {
      const drawWidth = this.cachedDrawWidth;
      const drawHeight = (this.cachedRect?.height || this.canvas.clientHeight) - 30;
      if (x > drawWidth) return 'price';
      if (y > drawHeight) return 'time';
      return 'chart';
    };

    const handleDrawingPos = (x: number, y: number) => {
      if (this.magnetMode !== 'off' && this.snapProvider) {
        const snapped = this.snapProvider(x, y, this.magnetMode);
        if (snapped) return snapped;
      }
      return { x, y };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      const { mouseX, mouseY } = this.getMousePos(e);
      const zone = getZone(mouseX, mouseY);

      // 1. 如果在繪圖模式，優先處理繪圖起始點
      if (this.drawingMode && zone === 'chart') {
        const { x, y } = handleDrawingPos(mouseX, mouseY);
        this.onDrawingClick?.(x, y, 'start');

        // 只有筆刷或移動工具需要啟動拖曳狀態
        if (this.drawingMode === 'brush' || this.drawingMode === 'move') {
          this.isDragging = true;
          this.dragZone = zone;
          this.lastDragX = mouseX;
          this.lastDragY = mouseY;
          this.canvas.setPointerCapture(e.pointerId);
        }
        return;
      }

      // 2. 否則進入圖表平移拖曳
      this.isDragging = true;
      this.dragZone = zone;
      this.lastDragX = mouseX;
      this.lastDragY = mouseY;
      this.velocityX = 0;
      this.velocityY = 0;
      this.stopInertia();
      this.canvas.setPointerCapture(e.pointerId);
      this.onMouseMove(mouseX, mouseY);
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const { mouseX, mouseY } = this.getMousePos(e);

      // 處理繪圖事件
      if (this.drawingMode) {
        const { x, y } = handleDrawingPos(mouseX, mouseY);
        // 非筆刷且非移動時，僅移動即預覽；其餘需拖曳
        if (this.drawingMode !== 'brush' && this.drawingMode !== 'move') {
          this.onDrawingClick?.(x, y, 'move');
        } else if (this.isDragging) {
          this.onDrawingClick?.(x, y, 'move');
        }
      }

      // 處理拖曳事件 (平移圖表)
      if (this.isDragging) {
        const deltaX = this.lastDragX - mouseX;
        const deltaY = mouseY - this.lastDragY;

        // 只有在非繪圖模式，或在側邊欄，才觸發平移
        if (!this.drawingMode || this.dragZone !== 'chart') {
          this.onScroll(deltaX, deltaY, this.dragZone);
        }

        this.lastDragX = mouseX;
        this.lastDragY = mouseY;

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
      if (this.isDragging) {
        if (this.drawingMode && this.dragZone === 'chart') {
          const { x, y } = handleDrawingPos(this.lastDragX, this.lastDragY);
          this.onDrawingClick?.(x, y, 'end');
        }

        this.isDragging = false;
        this.canvas.releasePointerCapture(e.pointerId);
        
        if (!this.drawingMode && (Math.abs(this.velocityX) > 0.5 || Math.abs(this.velocityY) > 0.5)) {
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
    const rect = this.cachedRect || this.canvas.getBoundingClientRect();
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
