import express from 'express';
import { DataManager } from '../core/DataManager';
import { RealtimeGateway } from './RealtimeGateway';

/**
 * API 伺服器 (Aggregation API)
 * 提供外部查詢 K 線、標的清單等介面
 */
const app = express();
const port = 3001;
const wsPort = 3002;
const dataManager = DataManager.getInstance();

// 啟動實時網關
new RealtimeGateway(wsPort);

// CORS 簡易設定
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

/**
 * 查詢所有支援的標的
 * GET /symbols
 */
app.get('/symbols', (req, res) => {
    try {
        const symbols = dataManager.getSymbols();
        res.json({ success: true, data: symbols });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

/**
 * 查詢標的的 K 線數據
 * GET /klines?id=BTC/USDT&interval=1m&endTime=1774859640000
 */
app.get('/klines', async (req, res) => {
    const { id, interval, endTime } = req.query;

    if (!id || !interval) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        const endTs = endTime ? parseInt(endTime as string) : undefined;
        const klines = await dataManager.getKlines(id as string, interval as string, 500, endTs);
        res.json({ success: true, data: klines });
    } catch (error: any) {
        console.error(`[DataServer] Kline query error:`, error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(port, () => {
    console.log(`[Market Data Platform] API server running on http://localhost:${port}`);
});
