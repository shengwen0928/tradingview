import { Candle } from '../types/Candle';

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

    let min = visibleCandles[0].low;
    let max = visibleCandles[0].high;

    for (const candle of visibleCandles) {
      if (candle.low < min) min = candle.low;
      if (candle.high > max) max = candle.high;
    }

    const diff = max - min;
    // 🚨 應用垂直縮放倍率
    const scaledDiff = (diff * this.verticalScale);
    const center = (max + min) / 2;

    this.minPrice = center - scaledDiff * (0.5 + this.padding);
    this.maxPrice = center + scaledDiff * (0.5 + this.padding);
  }

  public handleVerticalZoom(scaleFactor: number): void {
    this.verticalScale *= scaleFactor;
    // 限制縮放範圍，避免過大或過小
    this.verticalScale = Math.max(0.1, Math.min(10, this.verticalScale));
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

  public getMinMax(): { min: number; max: number } {
    return { min: this.minPrice, max: this.maxPrice };
  }
}
