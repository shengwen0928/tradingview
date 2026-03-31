import { DataManager } from './core/DataManager';

async function test() {
    const dm = DataManager.getInstance();
    try {
        const klines = await dm.getKlines('BTC/USDT:SPOT', '1m', 10);
        console.log(`DataManager returned ${klines.length} candles`);
        if (klines.length > 0) {
            console.log('First:', klines[0]);
            console.log('Last:', klines[klines.length - 1]);
        }
    } catch (e) {
        console.error('Error:', e);
    }
}
test();