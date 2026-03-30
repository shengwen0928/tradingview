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
 * 統一的市場定義 (細分為現貨、永續合約、期貨)
 */
export enum MarketType {
    SPOT = "spot",      // 現貨
    PERP = "perp",      // 永續合約
    FUTURES = "futures",// 定期期貨
    STOCK = "stock",    // 股票
    FOREX = "forex"     // 外匯
}

/**
 * 統一的市場分類 (大類)
 */
export enum AssetClass {
    CRYPTO = "crypto",
    STOCK = "stock",
    FOREX = "forex",
    COMMODITY = "commodity"
}

/**
 * 統一的 Symbol 資訊
 */
export interface MarketSymbol {
    id: string;        // 系統內部統一 ID (例如: BTC/USDT:SPOT)
    sourceSymbol: string; 
    market: MarketType;
    assetClass: AssetClass;
    precision: number; 
}
