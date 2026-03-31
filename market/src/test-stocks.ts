import { DataManager } from './core/DataManager';
import { Candle } from './types/Candle';

async function testStock(id: string, interval: string) {
    const dm = DataManager.getInstance();
    console.log(`\n[Stock Test] Checking ${id} (${interval})...`);
    
    try {
        // 測試 1: 數量是否足夠 (測試分頁抓取)
        const limit = 300;
        const klines = await dm.getKlines(id, interval, limit);
        console.log(`   - Count: ${klines.length}/${limit}`);
        
        if (klines.length < limit * 0.8) {
            console.error(`   ❌ [FAIL] Data volume insufficient!`);
        } else {
            console.log(`   ✅ [PASS] Data volume OK`);
        }

        // 測試 2: 即時更新 (訂閱並等待 15 秒)
        return new Promise((resolve) => {
            let receivedUpdate = false;
            console.log(`   - Waiting 15s for real-time update (Polling)...`);
            
            dm.subscribe(id, interval, (candle) => {
                if (!receivedUpdate) {
                    console.log(`   ✅ [PASS] Received real-time update! Price: ${candle.close}`);
                    receivedUpdate = true;
                }
            }, 'Yahoo');

            setTimeout(() => {
                if (!receivedUpdate) {
                    console.error(`   ❌ [FAIL] No real-time update received within 15s`);
                }
                resolve(receivedUpdate);
            }, 15000);
        });

    } catch (err: any) {
        console.error(`   ❌ [ERROR] ${err.message}`);
        return false;
    }
}

async function run() {
    // 測試台股與美股
    const targets = [
        { id: '2330:STOCK', interval: '1d' },
        { id: 'NVDA:STOCK', interval: '1h' }
    ];

    for (const target of targets) {
        await testStock(target.id, target.interval);
    }
    process.exit(0);
}

run();
