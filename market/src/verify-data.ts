import { DataManager } from './core/DataManager';
import { BinanceConnector } from './connectors/BinanceConnector';
import { YahooConnector } from './connectors/YahooConnector';
import { SymbolManager } from './core/SymbolManager';

async function verifyData(symbolId: string, interval: string) {
    const dataManager = DataManager.getInstance();
    const symbolInfo = SymbolManager.getSymbolById(symbolId);
    
    if (!symbolInfo) {
        console.error(`❌ 符號未找到: ${symbolId}`);
        return;
    }

    const source = symbolId.includes(':STOCK') ? 'Yahoo' : 'Binance';
    const connectorSymbol = symbolInfo.sourceMap[source];
    
    console.log(`\n🔍 比對驗證 [${symbolId}] [${interval}] 來源: ${source}`);
    console.log(`=============================================================`);

    // 1. 從 DataManager (快取/聚合層) 抓取最後 5 根
    const dmKlines = await dataManager.getKlines(symbolId, interval, 5);
    
    // 2. 直接從交易所 Connector (原始層) 抓取最後 5 根
    let connectorKlines;
    if (source === 'Binance') {
        const binance = new BinanceConnector();
        connectorKlines = await binance.fetchKlines(connectorSymbol, interval, 5);
    } else {
        const yahoo = new YahooConnector();
        connectorKlines = await yahoo.fetchKlines(connectorSymbol, interval, 5);
    }

    const formatRow = (c: any) => {
        const time = new Date(c.timestamp).toLocaleTimeString();
        return `[${time}] O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume.toFixed(2)}`;
    };

    console.log(`\n--- [1] DataManager (本地聚合/快取層) ---`);
    dmKlines.forEach((c, i) => console.log(`${i+1}. ${formatRow(c)}`));

    console.log(`\n--- [2] ${source} Connector (交易所原始數據) ---`);
    connectorKlines.forEach((c, i) => console.log(`${i+1}. ${formatRow(c)}`));

    // 3. 檢查差異
    console.log(`\n--- [3] 差異分析 ---`);
    for (let i = 0; i < 5; i++) {
        const dm = dmKlines[dmKlines.length - 1 - i];
        const conn = connectorKlines[connectorKlines.length - 1 - i];
        
        if (!dm || !conn) continue;
        
        const diffClose = Math.abs(dm.close - conn.close);
        const diffVol = Math.abs(dm.volume - conn.volume);
        const timeDiff = dm.timestamp - conn.timestamp;

        if (diffClose > 0.0001 || diffVol > 0.0001 || timeDiff !== 0) {
            console.warn(`⚠️ 第 ${i+1} 根數據不一致!`);
            if (timeDiff !== 0) console.log(`   時間戳差異: ${timeDiff}ms`);
            if (diffClose > 0) console.log(`   價格差異: ${diffClose}`);
            if (diffVol > 0) console.log(`   成交量差異: ${diffVol}`);
        } else {
            console.log(`✅ 第 ${i+1} 根數據完全一致`);
        }
    }
}

async function main() {
    // 測試加密貨幣 (原生週期)
    await verifyData('BTC/USDT', '1m');
    
    // 測試台股 (Yahoo 來源)
    await verifyData('2017.TW:STOCK', '1d');

    process.exit(0);
}

main();
