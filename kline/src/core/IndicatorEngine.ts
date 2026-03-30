import { Candle } from '../types/Candle';

/**
 * 負責技術指標計算 (MA, EMA)
 */
export class IndicatorEngine {
  /**
   * 計算移動平均線 (MA)
   */
  public calculateMA(candles: Candle[], period: number): number[] {
    const ma: number[] = [];
    if (candles.length === 0) return ma;
    for (let i = 0; i < candles.length; i++) {
      if (i < period - 1) {
        ma.push(NaN);
        continue;
      }
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[i - j].close;
      }
      ma.push(sum / period);
    }
    return ma;
  }

  /**
   * 計算指數移動平均線 (EMA) - 支援增量更新概念
   */
  public calculateEMA(candles: Candle[], period: number): number[] {
    const ema: number[] = [];
    if (candles.length === 0) return ema;
    const k = 2 / (period + 1);

    let prevEma = candles[0].close;
    ema.push(prevEma);

    for (let i = 1; i < candles.length; i++) {
      const currentEma = (candles[i].close - prevEma) * k + prevEma;
      ema.push(currentEma);
      prevEma = currentEma;
    }
    return ema;
  }
}
