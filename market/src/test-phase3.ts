import { DataManager } from './core/DataManager';

async function test() {
    const dataManager = DataManager.getInstance();

    console.log('--- 測試 1: 測試多交易所抓取 (預設優先順序) ---');
    try {
        const klines = await dataManager.getKlines('BTC/USDT', '1h', 5);
        console.log('成功從優先交易所抓取 5 筆 K 線');
        console.log('最後一筆時間戳:', klines[klines.length - 1].timestamp);
    } catch (err) {
        console.error('抓取失敗:', err);
    }

    console.log('\n--- 測試 2: 測試 Lazy Load (回溯歷史) ---');
    try {
        // 抓取 24 小時前 (約 86,400,000 毫秒前) 的數據
        const pastTime = Date.now() - (24 * 60 * 60 * 1000);
        console.log(`正在請求 ${new Date(pastTime).toISOString()} 以前的數據...`);
        
        const pastKlines = await dataManager.getKlines('BTC/USDT', '1h', 5, pastTime);
        console.log(`成功抓取歷史數據，第一筆時間戳: ${pastKlines[0].timestamp}`);
        console.log(`資料是否早於請求時間: ${pastKlines[pastKlines.length - 1].timestamp <= pastTime}`);
    } catch (err) {
        console.error('Lazy Load 測試失敗:', err);
    }

    console.log('\n--- 測試 3: 測試即時訂閱 (觀察 DataManager 輸出) ---');
    dataManager.subscribe('ETH/USDT', '1m', (candle) => {
        console.log('收到 ETH/USDT 更新:', candle);
        process.exit(0);
    });

    setTimeout(() => {
        console.log('測試超時');
        process.exit(0);
    }, 15000);
}

test();
