export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartType = 'candles' | 'hollow' | 'line' | 'area' | 'heikin_ashi';
