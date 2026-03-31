import { MarketSymbol, MarketType, AssetClass } from '../types/Candle';

/**
 * 統一的 Symbol 資訊
 */
export interface EnhancedMarketSymbol extends Omit<MarketSymbol, 'sourceSymbol'> {
    sourceMap: Record<string, string>; // 例如 { Binance: "BTCUSDT", OKX: "BTC-USDT-SWAP" }
}

/**
 * Symbol 管理系統
 */
export class SymbolManager {
    private static symbols: Map<string, EnhancedMarketSymbol> = new Map<string, EnhancedMarketSymbol>([
        // --- 現貨 (SPOT) ---
        ['BTC/USDT:SPOT', {
            id: 'BTC/USDT:SPOT',
            sourceMap: { 'Binance': 'BTCUSDT', 'OKX': 'BTC-USDT' },
            market: MarketType.SPOT,
            assetClass: AssetClass.CRYPTO,
            precision: 2
        }],
        ['ETH/USDT:SPOT', {
            id: 'ETH/USDT:SPOT',
            sourceMap: { 'Binance': 'ETHUSDT', 'OKX': 'ETH-USDT' },
            market: MarketType.SPOT,
            assetClass: AssetClass.CRYPTO,
            precision: 2
        }],
        
        // --- 永續合約 (PERP) ---
        ['BTC/USDT:PERP', {
            id: 'BTC/USDT:PERP',
            sourceMap: { 'Binance': 'BTCUSDT', 'OKX': 'BTC-USDT-SWAP' },
            market: MarketType.PERP,
            assetClass: AssetClass.CRYPTO,
            precision: 2
        }],
        ['ETH/USDT:PERP', {
            id: 'ETH/USDT:PERP',
            sourceMap: { 'Binance': 'ETHUSDT', 'OKX': 'ETH-USDT-SWAP' },
            market: MarketType.PERP,
            assetClass: AssetClass.CRYPTO,
            precision: 2
        }],
        
        // --- 股票 (STOCK) ---
        ['AAPL:STOCK', {
            id: 'AAPL:STOCK',
            sourceMap: { 'Yahoo': 'AAPL' },
            market: MarketType.STOCK,
            assetClass: AssetClass.STOCK,
            precision: 2
        }],
        ['TSLA:STOCK', {
            id: 'TSLA:STOCK',
            sourceMap: { 'Yahoo': 'TSLA' },
            market: MarketType.STOCK,
            assetClass: AssetClass.STOCK,
            precision: 2
        }],
        ['2330.TW:STOCK', {
            id: '2330.TW:STOCK',
            sourceMap: { 'Yahoo': '2330.TW' },
            market: MarketType.STOCK,
            assetClass: AssetClass.STOCK,
            precision: 2
        }]
    ]);

    /**
     * 獲取所有支援的 Symbol
     */
    public static getAllSymbols(): EnhancedMarketSymbol[] {
        return Array.from(this.symbols.values());
    }

    /**
     * 根據內部 ID 獲取 Symbol 資訊 (支援相容性查尋與動態解析)
     */
    public static getSymbolById(id: string): EnhancedMarketSymbol | undefined {
        let symbol = this.symbols.get(id);
        
        // 1. 相容性：如果沒帶市場標籤，預設查找現貨
        if (!symbol && !id.includes(':')) {
            symbol = this.symbols.get(`${id}:SPOT`);
        }

        // 2. 🚨 關鍵升級：動態解析 (Dynamic Resolution)
        // 如果還是找不到，但格式符合 TICKER:TYPE，則動態生成定義
        if (!symbol && id.includes(':')) {
            const [ticker, type] = id.split(':');
            const marketType = type.toLowerCase() as MarketType;
            
            if (marketType === MarketType.STOCK) {
                // 🚨 關鍵升級：台股代碼自動補全
                // 如果是純數字 (例如 2330)，自動加上 .TW 後綴
                let yahooTicker = ticker;
                if (/^\d+$/.test(ticker)) {
                    yahooTicker = `${ticker}.TW`;
                    console.log(`[SymbolManager] Auto-suffixing ${ticker} to ${yahooTicker} for Taiwan Stock Market`);
                }

                return {
                    id: id,
                    sourceMap: { 'Yahoo': yahooTicker },
                    market: MarketType.STOCK,
                    assetClass: AssetClass.STOCK,
                    precision: 2
                };
            } else if (marketType === MarketType.SPOT || marketType === MarketType.PERP) {
                // 自動生成 Binance/OKX 的加密貨幣定義 (假設符號一致)
                const cryptoSymbol = ticker.replace('/', '');
                return {
                    id: id,
                    sourceMap: { 
                        'Binance': cryptoSymbol, 
                        'OKX': marketType === MarketType.PERP ? `${ticker.replace('/', '-')}-SWAP` : ticker.replace('/', '-')
                    },
                    market: marketType,
                    assetClass: AssetClass.CRYPTO,
                    precision: 2
                };
            }
        }
        
        return symbol;
    }

    /**
     * 將內部 ID 轉換為特定來源的 Symbol
     */
    public static toSourceSymbol(id: string, source: string): string | undefined {
        return this.symbols.get(id)?.sourceMap[source];
    }
}
