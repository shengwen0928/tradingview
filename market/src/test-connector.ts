import { BinanceConnector } from './connectors/BinanceConnector';

async function test() {
    const connector = new BinanceConnector();
    
    console.log('--- 測試 1: 抓取歷史 K 線 (REST) ---');
    try {
        const klines = await connector.fetchKlines('BTCUSDT', '1m', 5);
        console.log('成功抓取 5 筆 K 線:', klines);
    } catch (err) {
        console.error('REST 抓取失敗:', err);
    }

    console.log('\n--- 測試 2: 監聽即時更新 (WebSocket) ---');
    console.log('正在訂閱 BTCUSDT 1m 更新 (請等待 5-10 秒)...');
    
    connector.subscribeKlines('BTCUSDT', '1m', (candle) => {
        console.log('收到即時更新:', candle);
        // 收到第一筆後關閉，僅作測試
        connector.close();
        process.exit(0);
    });

    // 30 秒後超時關閉
    setTimeout(() => {
        console.log('測試結束 (超時)');
        connector.close();
        process.exit(0);
    }, 30000);
}

test();
