/**
 * 負責顯示範圍控制 (startIndex / endIndex) 與 Zoom/Scroll 邏輯
 */
export class ViewportEngine {
  private totalDataCount: number = 0;
  private startIndex: number = 0;
  private endIndex: number = 0;
  private candleWidth: number = 10;
  private spacing: number = 2;
  private onRangeChanged: () => void;

  constructor(onRangeChanged: () => void) {
    this.onRangeChanged = onRangeChanged;
  }

  public setDataCount(count: number, isHistory: boolean = false): void {
    const isFirstLoad = this.totalDataCount === 0;
    const isAtEnd = this.endIndex >= this.totalDataCount - 1;
    
    const oldCount = this.totalDataCount;
    this.totalDataCount = count;

    if (isFirstLoad) {
      this.endIndex = count;
      this.startIndex = Math.max(0, count - 100);
    } else {
      const added = count - oldCount;
      
      if (isHistory) {
        // 🚨 關鍵補償：如果載入的是歷史資料，視窗索引必須向後推移
        // 這樣畫面才會鎖定在目前的 K 棒位置，而不會跳走
        this.startIndex += added;
        this.endIndex += added;
      } else if (isAtEnd) {
        // 實時數據：如果在最右端則自動跟隨
        this.startIndex += added;
        this.endIndex += added;
      }
    }
    
    this.updateCandleWidth(window.innerWidth);
    this.onRangeChanged();
  }

  private updateCandleWidth(canvasWidth: number): void {
    const visibleCount = this.endIndex - this.startIndex;
    this.candleWidth = (canvasWidth / visibleCount) - this.spacing;
  }

  /**
   * 獲取精確的浮點數範圍 (用於座標計算)
   */
  public getRawRange() {
    return { startIndex: this.startIndex, endIndex: this.endIndex };
  }

  /**
   * 獲取用於 Slice 的整數範圍 (包含緩衝區)
   */
  public getVisibleRange() {
    return {
      start: Math.max(0, Math.floor(this.startIndex) - 2),
      end: Math.min(this.totalDataCount, Math.ceil(this.endIndex) + 2)
    };
  }

  public getCandleWidth(): number {
    return this.candleWidth;
  }

  public handleScroll(deltaX: number): void {
    const candlesMoved = deltaX / (this.candleWidth + this.spacing);
    const visibleCount = this.endIndex - this.startIndex;
    
    this.startIndex = Math.max(0, Math.min(this.totalDataCount - visibleCount, this.startIndex + candlesMoved));
    this.endIndex = this.startIndex + visibleCount;
    
    this.onRangeChanged();
  }

  public handleZoom(mouseX: number, scaleFactor: number, canvasWidth: number): void {
    const visibleCount = this.endIndex - this.startIndex;
    const newVisibleCount = visibleCount * scaleFactor;

    // 限制顯示數量在 5 ~ 2000 根之間
    if (newVisibleCount < 5 || newVisibleCount > 2000) return;

    // 以滑鼠位置作為 anchor 的核心邏輯
    const ratio = mouseX / canvasWidth;
    const mouseIndex = this.startIndex + visibleCount * ratio;

    this.startIndex = Math.max(0, mouseIndex - newVisibleCount * ratio);
    this.endIndex = Math.min(this.totalDataCount, this.startIndex + newVisibleCount);
    
    // 確保縮放後重新校準位移，防止邊界漂移
    if (this.endIndex === this.totalDataCount) {
      this.startIndex = this.endIndex - newVisibleCount;
    }

    this.updateCandleWidth(canvasWidth);
    this.onRangeChanged();
  }

  public resize(canvasWidth: number) {
    this.updateCandleWidth(canvasWidth);
  }
}
