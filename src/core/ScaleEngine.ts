import { Candle } from '../types/Candle';

/**
 * 負責座標轉換：price -> y, index -> x
 */
export class ScaleEngine {
  private width: number = 0;
  private height: number = 0;
  private minPrice: number = 0;
  private maxPrice: number = 0;
  private padding: number = 0.1; // 上下各留 10% 空間

  public updateDimensions(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  /**
   * 根據當前可見資料計算 y 軸縮放
   */
  public updateScale(visibleCandles: Candle[]): void {
    if (visibleCandles.length === 0) return;

    let min = visibleCandles[0].low;
    let max = visibleCandles[0].high;

    for (const candle of visibleCandles) {
      if (candle.low < min) min = candle.low;
      if (candle.high > max) max = candle.high;
    }

    const diff = max - min;
    this.minPrice = min - diff * this.padding;
    this.maxPrice = max + diff * this.padding;
  }

  public priceToY(price: number): number {
    if (this.maxPrice === this.minPrice) return this.height / 2;
    return this.height - ((price - this.minPrice) / (this.maxPrice - this.minPrice)) * this.height;
  }

  public yToPrice(y: number): number {
    return this.minPrice + (1 - y / this.height) * (this.maxPrice - this.minPrice);
  }

  public indexToX(index: number, startIndex: number, candleWidth: number, spacing: number): number {
    return (index - startIndex) * (candleWidth + spacing);
  }

  public getMinMax(): { min: number; max: number } {
    return { min: this.minPrice, max: this.maxPrice };
  }
}
