import { MarketSymbol, MarketType } from '../types/Candle';

/**
 * 統一的 Symbol 資訊
 */
export interface EnhancedMarketSymbol extends Omit<MarketSymbol, 'sourceSymbol' | 'source'> {
    sourceMap: Record<string, string>; // 例如 { Binance: "BTCUSDT", OKX: "BTC-USDT" }
}

/**
 * Symbol 管理系統
 * 負責將內部統一 ID 與外部來源 Symbol 進行映射
 */
export class SymbolManager {
    private static symbols: Map<string, EnhancedMarketSymbol> = new Map([
        ['BTC/USDT', {
            id: 'BTC/USDT',
            sourceMap: {
                'Binance': 'BTCUSDT',
                'OKX': 'BTC-USDT'
            },
            market: MarketType.CRYPTO,
            precision: 2
        }],
        ['ETH/USDT', {
            id: 'ETH/USDT',
            sourceMap: {
                'Binance': 'ETHUSDT',
                'OKX': 'ETH-USDT'
            },
            market: MarketType.CRYPTO,
            precision: 2
        }],
        ['SOL/USDT', {
            id: 'SOL/USDT',
            sourceMap: {
                'Binance': 'SOLUSDT',
                'OKX': 'SOL-USDT'
            },
            market: MarketType.CRYPTO,
            precision: 3
        }]
    ]);

    /**
     * 獲取所有支援的 Symbol
     */
    public static getAllSymbols(): EnhancedMarketSymbol[] {
        return Array.from(this.symbols.values());
    }

    /**
     * 根據內部 ID 獲取 Symbol 資訊
     */
    public static getSymbolById(id: string): EnhancedMarketSymbol | undefined {
        return this.symbols.get(id);
    }

    /**
     * 將內部 ID 轉換為特定來源的 Symbol
     */
    public static toSourceSymbol(id: string, source: string): string | undefined {
        return this.symbols.get(id)?.sourceMap[source];
    }
}
