import { Candle, ChartType } from '../../types/Candle';

/**
 * 🚀 專業級數據轉換器
 * 將原始 K 線轉換為非線性圖表所需的虛擬數據集 (Event-based)
 */
export class DataTransformer {
  
  public static transform(candles: Candle[], type: ChartType): Candle[] {
    switch (type) {
      case 'renko': return this.toRenko(candles);
      case 'line_break': return this.toLineBreak(candles);
      case 'kagi': return this.toKagi(candles);
      case 'point_and_figure': return this.toPointAndFigure(candles);
      default: return candles;
    }
  }

  /**
   * 🧱 磚形圖轉換 (Renko)
   * 邏輯：僅當價格變動超過固定點數時，生成一個等高的磚塊
   */
  private static toRenko(candles: Candle[]): Candle[] {
    if (candles.length === 0) return [];
    
    // 策略：使用動態 ATR 或固定點數 (這裡先用簡單固定點數，後續可擴充)
    const boxSize = this.calculateBoxSize(candles);
    const bricks: Candle[] = [];
    
    let lastClose = candles[0].close;
    
    candles.forEach(c => {
      let diff = c.close - lastClose;
      while (Math.abs(diff) >= boxSize) {
        const isUp = diff > 0;
        const open = lastClose;
        const close = isUp ? lastClose + boxSize : lastClose - boxSize;
        
        bricks.push({
          time: c.time, // 繼承原始觸發時間
          open,
          high: Math.max(open, close),
          low: Math.min(open, close),
          close,
          volume: c.volume // 分配部分成交量
        });
        
        lastClose = close;
        diff = c.close - lastClose;
      }
    });
    
    return bricks;
  }

  /**
   * 📈 新價線轉換 (Line Break)
   * 邏輯：僅當收盤價突破前 N 根線的最高或最低點時，才畫出新線
   */
  private static toLineBreak(candles: Candle[], n: number = 3): Candle[] {
    if (candles.length === 0) return [];
    
    const lines: Candle[] = [];
    
    candles.forEach(c => {
      if (lines.length === 0) {
        lines.push({ ...c });
        return;
      }
      
      const lastLine = lines[lines.length - 1];
      const isUp = lastLine.close > lastLine.open;
      
      if (isUp) {
        if (c.close > lastLine.close) {
          lines.push({ time: c.time, open: lastLine.close, close: c.close, high: c.close, low: lastLine.close, volume: c.volume });
        } else if (lines.length >= n) {
          const recentLines = lines.slice(-n);
          const minLow = Math.min(...recentLines.map(l => Math.min(l.open, l.close)));
          if (c.close < minLow) {
            lines.push({ time: c.time, open: lastLine.close, close: c.close, high: lastLine.close, low: c.close, volume: c.volume });
          }
        }
      } else {
        if (c.close < lastLine.close) {
          lines.push({ time: c.time, open: lastLine.close, close: c.close, high: lastLine.close, low: c.close, volume: c.volume });
        } else if (lines.length >= n) {
          const recentLines = lines.slice(-n);
          const maxHigh = Math.max(...recentLines.map(l => Math.max(l.open, l.close)));
          if (c.close > maxHigh) {
            lines.push({ time: c.time, open: lastLine.close, close: c.close, high: c.close, low: lastLine.close, volume: c.volume });
          }
        }
      }
    });
    
    return lines;
  }

  /**
   * 🎋 卡吉圖轉換 (Kagi)
   * 邏輯：根據反轉比例生成線段，並切換陰陽屬性 (粗細變化)
   */
  private static toKagi(candles: Candle[]): Candle[] {
    if (candles.length === 0) return [];
    
    const reversal = this.calculateBoxSize(candles) * 2;
    const kagiLines: Candle[] = [];
    
    let lastY = candles[0].close;
    let direction = 0; // 1: up, -1: down
    let isYang = true; // 陽線 (粗), 陰線 (細)

    candles.forEach(c => {
      const diff = c.close - lastY;
      
      if (direction === 0) {
        if (Math.abs(diff) >= reversal) direction = diff > 0 ? 1 : -1;
      } else if (direction === 1) {
        if (c.close > lastY) {
          lastY = c.close;
          // 檢查是否突破前高轉陽
          if (!isYang && kagiLines.length > 0) {
             const prevMax = Math.max(...kagiLines.slice(-2).map(l => Math.max(l.open, l.close)));
             if (c.close > prevMax) isYang = true;
          }
        } else if (diff <= -reversal) {
          kagiLines.push({ time: c.time, open: kagiLines.length > 0 ? kagiLines[kagiLines.length-1].close : lastY, close: lastY, high: Math.max(lastY, c.close), low: Math.min(lastY, c.close), volume: isYang ? 1 : 0 }); // 借用 volume 存陰陽
          direction = -1;
          lastY = c.close;
        }
      } else {
        if (c.close < lastY) {
          lastY = c.close;
          // 檢查是否跌破前低轉陰
          if (isYang && kagiLines.length > 0) {
             const prevMin = Math.min(...kagiLines.slice(-2).map(l => Math.min(l.open, l.close)));
             if (c.close < prevMin) isYang = false;
          }
        } else if (diff >= reversal) {
          kagiLines.push({ time: c.time, open: kagiLines.length > 0 ? kagiLines[kagiLines.length-1].close : lastY, close: lastY, high: Math.max(lastY, c.close), low: Math.min(lastY, c.close), volume: isYang ? 1 : 0 });
          direction = 1;
          lastY = c.close;
        }
      }
    });
    
    return kagiLines;
  }

  /**
   * ❌⭕ 點數圖轉換 (Point & Figure)
   */
  private static toPointAndFigure(candles: Candle[]): Candle[] {
    const boxSize = 5;
    // 簡化實作：將每一根 K 線轉換為一個 X 或 O 的垂直序列數據
    // 在專業模式下，它通常也是一列一列排列的
    return candles.map(c => ({
        ...c,
        high: Math.ceil(c.high / boxSize) * boxSize,
        low: Math.floor(c.low / boxSize) * boxSize
    }));
  }

  private static calculateBoxSize(candles: Candle[]): number {
    if (candles.length < 14) return 10;
    // 簡易 ATR 估算
    let sum = 0;
    for (let i = 1; i < 14; i++) {
      sum += Math.abs(candles[i].high - candles[i].low);
    }
    return Math.max(1, Math.round(sum / 14));
  }
}
