import { DataManager } from './core/DataManager';
import { Candle } from './types/Candle';

async function testInterval(id: string, interval: string) {
    const dataManager = DataManager.getInstance();
    
    try {
        const klines = await dataManager.getKlines(id, interval, 10);
        if (klines.length === 0) {
            console.error(`❌ [FAIL] ${interval}: Received 0 candles`);
            return false;
        }

        const diff = klines.length > 1 ? (klines[1].timestamp - klines[0].timestamp) : 0;
        const diffMin = diff / 60000;
        
        // 預期分鐘數
        const msMap: any = {
            '1m': 1, '3m': 3, '5m': 5, '15m': 15, '30m': 30,
            '1h': 60, '2h': 120, '4h': 240, '6h': 360, '8h': 480, '12h': 720,
            '1d': 1440, '3d': 4320, '5d': 7200, '1w': 10080,
            '1M': 43200, '3M': 129600, '1Y': 525600
        };
        const expected = msMap[interval];
        
        if (expected && diffMin !== expected && diff !== 0) {
            console.error(`❌ [FAIL] ${interval}: Grain mismatch. Expected ${expected} min, got ${diffMin} min`);
            return false;
        }

        console.log(`✅ [PASS] ${interval.padEnd(4)} | Count: ${klines.length.toString().padEnd(2)} | Grain: ${diffMin.toString().padEnd(6)} min`);
        return true;
    } catch (err: any) {
        console.error(`❌ [ERROR] ${interval}: ${err.message}`);
        return false;
    }
}

async function runAllTests() {
    const intervals = [
        '1m', '3m', '5m', '15m', '30m', 
        '1h', '2h', '4h', '6h', '8h', '12h', 
        '1d', '3d', '5d', '1w', '1M', '3M', '1Y'
    ];
    const symbol = 'BTC/USDT:SPOT';
    
    console.log(`=== Exhaustive Interval Test [${intervals.length} cycles] ===\n`);
    
    let passCount = 0;
    for (const interval of intervals) {
        const ok = await testInterval(symbol, interval);
        if (ok) passCount++;
    }
    
    console.log(`\n=== Test Summary: ${passCount}/${intervals.length} Passed ===`);
    process.exit(passCount === intervals.length ? 0 : 1);
}

runAllTests();
