/**
 * 負責顯示範圍控制 (startIndex / endIndex) 與 Zoom/Scroll 邏輯
 */
export class ViewportEngine {
  private totalDataCount: number = 0;
  private startIndex: number = 0;
  private endIndex: number = 0;
  private minStartIndex: number = 0; // 🚨 新增：動態最小索引 (預設 0)
  private candleWidth: number = 10;
  private spacing: number = 2;
  private onRangeChanged: () => void;
  private canvasWidth: number;

  constructor(onRangeChanged: () => void, initialWidth: number) {
    this.onRangeChanged = onRangeChanged;
    this.canvasWidth = initialWidth;
  }

  // 🚨 新增：讓外部可以設定最小索引
  public setMinStartIndex(min: number): void {
    this.minStartIndex = min;
  }

  public getLogicalWidth(): number {
    return this.canvasWidth;
  }

  public setRange(start: number, end: number): void {
    this.startIndex = start;
    this.endIndex = end;
    this.updateCandleWidth(this.canvasWidth);
    this.onRangeChanged();
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
        
        // 🚨 如果之前已經處於負數區間 (留白)，則 minStartIndex 不變
        // 否則，minStartIndex 也應該跟著向右推移，維持在 0 的位置
        if (this.minStartIndex >= 0) {
          // 這裡不需處理，因為 loadMoreHistory 邏輯中會處理 hasMoreHistory
        }
      } else if (isAtEnd) {
        // 實時數據：如果在最右端則自動跟隨
        this.startIndex += added;
        this.endIndex += added;
      }
    }
    
    this.updateCandleWidth(this.canvasWidth);
    this.onRangeChanged();
  }

  private updateCandleWidth(canvasWidth: number): void {
    const visibleCount = this.endIndex - this.startIndex;
    const drawWidth = canvasWidth - 60; // 🚨 扣除右側價格軸寬度 (需與 ScaleEngine 一致)
    this.candleWidth = (drawWidth / visibleCount) - this.spacing;
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

  public getVisibleCount(): number {
    return this.endIndex - this.startIndex;
  }

  public getCandleWidth(): number {
    return this.candleWidth;
  }

  public handleScroll(deltaX: number): void {
    const candlesMoved = deltaX / (this.candleWidth + this.spacing);
    const visibleCount = this.endIndex - this.startIndex;
    
    // 🚨 修正：強硬鎖定邊界，絕對禁止 startIndex 小於 0
    const maxStartIndex = this.totalDataCount - visibleCount / 2;
    this.startIndex = Math.max(0, Math.min(maxStartIndex, this.startIndex + candlesMoved));
    this.endIndex = this.startIndex + visibleCount;
    
    this.onRangeChanged();
  }

  public handleZoom(mouseX: number, scaleFactor: number, canvasWidth: number): void {
    this.canvasWidth = canvasWidth;
    const drawWidth = canvasWidth - 60;

    const relativeX = Math.min(drawWidth, mouseX);
    const ratio = relativeX / drawWidth;

    const visibleCount = this.endIndex - this.startIndex;
    const newVisibleCount = Math.min(this.totalDataCount, Math.max(5, visibleCount * scaleFactor));

    if (newVisibleCount > 1000) return;

    const mouseIndex = this.startIndex + visibleCount * ratio;

    let nextStart = mouseIndex - newVisibleCount * ratio;
    const maxStartIndex = this.totalDataCount - newVisibleCount / 2;

    this.startIndex = Math.max(0, Math.min(maxStartIndex, nextStart));
    this.endIndex = this.startIndex + newVisibleCount;

    this.updateCandleWidth(canvasWidth);
    this.onRangeChanged();
  }

  public resize(canvasWidth: number) {
    this.canvasWidth = canvasWidth;
    this.updateCandleWidth(canvasWidth);
  }
}
