export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartType = 
  | 'bars'              // 美國線
  | 'candles'           // K線
  | 'hollow'            // 空心K線
  | 'volume_candles'     // 成交量K線
  | 'line'              // 線形圖
  | 'line_with_markers'  // 帶標記線
  | 'step_line'         // 階梯線
  | 'area'              // 面積圖
  | 'hlc_area'          // HLC區
  | 'baseline'          // 基準線
  | 'columns'           // 列
  | 'high_low'          // 高低圖
  | 'volume_footprint'   // 成交量軌跡
  | 'tpo'               // 時間價格機會
  | 'volume_profile'    // 交易時段成交量分佈圖
  | 'heikin_ashi'       // 平均K線
  | 'renko'             // 磚形圖
  | 'line_break'        // 新價線
  | 'kagi'              // 卡吉圖
  | 'point_and_figure'  // 點數圖
  | 'range';            // 範圍
