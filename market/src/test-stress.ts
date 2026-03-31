import { DataManager } from './core/DataManager';
import { Candle } from './types/Candle';

async function testInterval(id: string, interval: string) {
    const dataManager = DataManager.getInstance();
    
    try {
        // 我們嘗試請求 100 根，看合成邏輯是否能滿足
        const klines = await dataManager.getKlines(id, interval, 100);
        
        const count = klines.length;
        const diff = klines.length > 1 ? (klines[1].timestamp - klines[0].timestamp) : 0;
        const diffMin = diff / 60000;
        const diffSec = diff / 1000;
        
        const msMap: any = {
            '1s': 0.0166, '1m': 1, '3m': 3, '5m': 5, '15m': 15, '30m': 30,
            '1h': 60, '2h': 120, '4h': 240, '6h': 360, '8h': 480, '12h': 720,
            '1d': 1440, '3d': 4320, '5d': 7200, '1w': 10080,
            '1M': 43200, '3M': 129600, '1Y': 525600
        };
        const expected = msMap[interval];
        
        // 檢查 Count 是否足夠 (對於長週期，如果交易所沒那麼多歷史則放寬，但不能只有 1 根)
        const minExpectedCount = interval === '1Y' || interval === '3M' ? 5 : 50;
        
        if (count < minExpectedCount) {
            console.error(`❌ [FAIL] ${interval}: Count too low. Expected at least ${minExpectedCount}, got ${count}`);
            return false;
        }

        if (expected && Math.abs(diffMin - expected) > 0.1 && diff !== 0) {
            console.error(`❌ [FAIL] ${interval}: Grain mismatch. Expected ${expected} min, got ${diffMin} min`);
            return false;
        }

        console.log(`✅ [PASS] ${interval.padEnd(4)} | Count: ${count.toString().padEnd(3)} | Grain: ${interval === '1s' ? diffSec + 's' : diffMin + 'm'}`);
        return true;
    } catch (err: any) {
        console.error(`❌ [ERROR] ${interval}: ${err.message}`);
        return false;
    }
}

async function runAllTests() {
    // 這裡我們測試您提到的所有問題週期
    const intervals = ['1s', '1m', '1h', '1d', '2d', '5d', '1M', '3M'];
    const symbol = 'BTC/USDT:SPOT';
    
    console.log(`=== Stress Test: Data Volume & Grain Alignment ===\n`);
    
    let passCount = 0;
    for (const interval of intervals) {
        const ok = await testInterval(symbol, interval);
        if (ok) passCount++;
    }
    
    console.log(`\n=== Test Summary: ${passCount}/${intervals.length} Passed ===`);
    process.exit(passCount === intervals.length ? 0 : 1);
}

runAllTests();
