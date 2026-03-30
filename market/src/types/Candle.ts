/**
 * 統一的 K 線資料格式
 */
export interface Candle {
    timestamp: number; // 毫秒時間戳
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * 統一的市場定義
 */
export enum MarketType {
    CRYPTO = "crypto",
    STOCK = "stock",
    FOREX = "forex"
}

/**
 * 統一的 Symbol 資訊
 */
export interface MarketSymbol {
    id: string;        // 系統內部統一 ID (例如: BTC/USDT)
    sourceSymbol: string; // 原始來源 Symbol (例如: BTCUSDT)
    market: MarketType;
    source: string;    // 來源名稱 (例如: Binance)
    precision: number; // 價格精度
}
