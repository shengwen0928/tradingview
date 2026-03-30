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

  public setDataCount(count: number): void {
    const isFirstLoad = this.totalDataCount === 0;
    const isAtEnd = this.endIndex >= this.totalDataCount - 1; // 檢測是否在最右端
    
    const oldCount = this.totalDataCount;
    this.totalDataCount = count;

    if (isFirstLoad) {
      this.endIndex = count;
      this.startIndex = Math.max(0, count - 100);
    } else {
      const added = count - oldCount;
      
      // 如果原本就在最右端，則自動跟隨新數據向右推移
      if (isAtEnd) {
        this.startIndex += added;
        this.endIndex += added;
      }
      // 如果在看歷史資料，則不推移範圍，但總數已更新，防止跳動
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
