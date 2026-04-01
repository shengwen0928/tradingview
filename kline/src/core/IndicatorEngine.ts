import { Candle } from '../types/Candle';

/**
 * 類 Pine Script 指標引擎
 * 🚀 核心邏輯：將 K 線數據轉化為各種指標數列 (Series)
 */
export class IndicatorEngine {
  
  /**
   * 簡單移動平均線 (SMA)
   * Pine: ta.sma(source, length)
   */
  public sma(source: number[], length: number): number[] {
    const result: number[] = new Array(source.length).fill(NaN);
    if (source.length < length) return result;

    let sum = 0;
    for (let i = 0; i < source.length; i++) {
      sum += source[i];
      if (i >= length) {
        sum -= source[i - length];
      }
      if (i >= length - 1) {
        result[i] = sum / length;
      }
    }
    return result;
  }

  /**
   * 指數移動平均線 (EMA)
   * Pine: ta.ema(source, length)
   */
  public ema(source: number[], length: number): number[] {
    const result: number[] = new Array(source.length).fill(NaN);
    if (source.length === 0) return result;

    const alpha = 2 / (length + 1);
    let prevEMA = source[0];
    result[0] = prevEMA;

    for (let i = 1; i < source.length; i++) {
      const currentEMA = (source[i] - prevEMA) * alpha + prevEMA;
      result[i] = currentEMA;
      prevEMA = currentEMA;
    }
    return result;
  }

  /**
   * 相對強弱指數 (RSI)
   * Pine: ta.rsi(source, length)
   */
  public rsi(source: number[], length: number): number[] {
    const result: number[] = new Array(source.length).fill(NaN);
    if (source.length <= length) return result;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= length; i++) {
      const diff = source[i] - source[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }

    let avgGain = gains / length;
    let avgLoss = losses / length;
    result[length] = 100 - (100 / (1 + avgGain / avgLoss));

    for (let i = length + 1; i < source.length; i++) {
      const diff = source[i] - source[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;

      avgGain = (avgGain * (length - 1) + gain) / length;
      avgLoss = (avgLoss * (length - 1) + loss) / length;

      const rs = avgGain / avgLoss;
      result[i] = 100 - (100 / (1 + rs));
    }
    return result;
  }

  /**
   * 布林通道 (Bollinger Bands)
   * Pine: [basis, upper, lower] = ta.bb(source, length, mult)
   */
  public bb(source: number[], length: number, mult: number): { basis: number[], upper: number[], lower: number[] } {
    const basis = this.sma(source, length);
    const upper: number[] = new Array(source.length).fill(NaN);
    const lower: number[] = new Array(source.length).fill(NaN);

    for (let i = length - 1; i < source.length; i++) {
      const slice = source.slice(i - length + 1, i + 1);
      const mean = basis[i];
      const stdDev = Math.sqrt(slice.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / length);
      upper[i] = mean + mult * stdDev;
      lower[i] = mean - mult * stdDev;
    }

    return { basis, upper, lower };
  }

  /**
   * 獲取 Close 價序列 (常用作 Source)
   */
  public getClose(candles: Candle[]): number[] {
    return candles.map(c => c.close);
  }
}

