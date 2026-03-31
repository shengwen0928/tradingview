import { BinanceConnector } from './connectors/BinanceConnector';
import { SymbolManager } from './core/SymbolManager';

async function test() {
    const b = new BinanceConnector();
    try {
        const klines = await b.fetchKlines('BTCUSDT', '1m', 10);
        console.log(`Binance fetched: ${klines.length} candles`);
    } catch (e) {
        console.error('Binance error:', e);
    }
}
test();