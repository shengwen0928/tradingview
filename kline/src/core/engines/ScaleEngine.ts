import { Candle } from '../../types/Candle';

/**
 * 負責座標轉換：price -> y, index -> x
 */
export class ScaleEngine {
  private width: number = 0;
  private height: number = 0;
  private minPrice: number = 0;
  private maxPrice: number = 0;
  private padding: number = 0.1; 
  private verticalScale: number = 1; // 🚨 新增：垂直縮放倍率
  private isAutoScale: boolean = true; // 🚨 新增：是否自動縮放模式

  // 🚨 新增預留空間
  private rightPadding: number = 60; // 價格軸寬度
  private bottomPadding: number = 30; // 時間軸高度

  public updateDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public getDrawWidth(): number {
    return this.width - this.rightPadding;
  }

  public getDrawHeight(): number {
    return this.height - this.bottomPadding;
  }

  public updateScale(visibleCandles: Candle[]): void {
    if (visibleCandles.length === 0) return;

    // 🚨 如果是自動縮放模式，才根據可見 K 棒計算 min/max
    if (this.isAutoScale) {
      let min = visibleCandles[0].low;
      let max = visibleCandles[0].high;

      for (const candle of visibleCandles) {
        if (candle.low < min) min = candle.low;
        if (candle.high > max) max = candle.high;
      }

      const diff = max - min;
      const scaledDiff = (diff * this.verticalScale);
      const center = (max + min) / 2;

      this.minPrice = center - scaledDiff * (0.5 + this.padding);
      this.maxPrice = center + scaledDiff * (0.5 + this.padding);
    } 
    // 如果是非自動縮放模式 (手動模式)，則不更新 minPrice/maxPrice
    // 位移會由 handleVerticalPan 直接修改這兩個值
  }

  public handleVerticalZoom(scaleFactor: number): void {
    this.isAutoScale = false; // 🚨 轉為手動模式
    
    const range = this.maxPrice - this.minPrice;
    const center = (this.maxPrice + this.minPrice) / 2;
    const newRange = range * scaleFactor;
    
    this.minPrice = center - newRange / 2;
    this.maxPrice = center + newRange / 2;
  }

  public handleVerticalPan(deltaY: number): void {
    this.isAutoScale = false; // 🚨 轉為手動模式
    
    const drawHeight = this.getDrawHeight();
    const priceRange = this.maxPrice - this.minPrice;
    const priceDelta = (deltaY / drawHeight) * priceRange;
    
    this.minPrice += priceDelta;
    this.maxPrice += priceDelta;
  }

  /**
   * 🚀 新增：處理座標軸拖動縮放
   * @param delta 拖動像素位移
   * @param zone 'price' 或 'time'
   */
  public handleAxisDrag(delta: number, zone: 'price' | 'time'): void {
    if (zone === 'price') {
      this.isAutoScale = false;
      const range = this.maxPrice - this.minPrice;
      // 根據拖動位移比例縮放區間 (向上拖動為負，代表擴張；向下拖動為正，代表壓縮)
      const factor = 1 + delta / 200; 
      const center = (this.maxPrice + this.minPrice) / 2;
      const newRange = range * factor;
      
      this.minPrice = center - newRange / 2;
      this.maxPrice = center + newRange / 2;
    }
  }

  public getIsAutoScale(): boolean {
    return this.isAutoScale;
  }

  /**
   * 恢復自動縮放 (例如雙擊價格軸時呼叫)
   */
  public resetAutoScale(): void {
    this.isAutoScale = true;
    this.verticalScale = 1;
  }

  public priceToY(price: number): number {
    const drawHeight = this.getDrawHeight();
    if (this.maxPrice === this.minPrice) return drawHeight / 2;
    return drawHeight - ((price - this.minPrice) / (this.maxPrice - this.minPrice)) * drawHeight;
  }

  public yToPrice(y: number): number {
    const drawHeight = this.getDrawHeight();
    return this.minPrice + (1 - y / drawHeight) * (this.maxPrice - this.minPrice);
  }

  public indexToX(index: number, startIndex: number, candleWidth: number, spacing: number): number {
    return (index - startIndex) * (candleWidth + spacing);
  }

  /**
   * 🚀 新增：將螢幕 X 座標轉為數據索引
   */
  public xToIndex(x: number, startIndex: number, candleWidth: number, spacing: number): number {
    return x / (candleWidth + spacing) + startIndex;
  }

  public getMinMax(): { min: number; max: number } {
    return { min: this.minPrice, max: this.maxPrice };
  }

  /**
   * 🚨 新增：計算適合顯示的整數價格刻度
   */
  public getNiceTickSteps(): number[] {
    const range = this.maxPrice - this.minPrice;
    if (range <= 0) return [];

    const drawHeight = this.getDrawHeight();
    const maxTicks = Math.max(2, Math.floor(drawHeight / 50)); // 每 50px 一個刻度
    
    let rawStep = range / maxTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const rem = rawStep / mag;

    let step: number;
    if (rem < 1.5) step = mag;
    else if (rem < 3) step = mag * 2;
    else if (rem < 7) step = mag * 5;
    else step = mag * 10;

    const firstTick = Math.ceil(this.minPrice / step) * step;
    const ticks: number[] = [];
    for (let t = firstTick; t <= this.maxPrice; t += step) {
      ticks.push(t);
    }
    return ticks;
  }
}
