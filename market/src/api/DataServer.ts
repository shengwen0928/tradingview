import express from 'express';
import http from 'http'; // 🚨 新增：用於 WebSocket 共用連接埠
import { DataManager } from '../core/DataManager';
import { RealtimeGateway } from './RealtimeGateway';

/**
 * API 伺服器 (Aggregation API)
 * 提供外部查詢 K 線、標的清單等介面
 */
const app = express();
const server = http.createServer(app); // 🚨 新增：HTTP Server
const port = process.env.PORT || 3001; // 🚨 修正：由環境變數決定
const dataManager = DataManager.getInstance();

// 啟動實時網關 (共用 HTTP Server)
new RealtimeGateway(server);

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
    const { id, interval, endTime, source } = req.query;

    if (!id || !interval) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        const endTs = endTime ? parseInt(endTime as string) : undefined;
        const klines = await dataManager.getKlines(id as string, interval as string, 500, endTs, source as string);
        res.json({ success: true, data: klines });
    } catch (error: any) {
        console.error(`[DataServer] Kline query error:`, error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 🚨 新增：自我喚醒機制，防止 Render.com 休眠
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
setInterval(() => {
    http.get(`${SELF_URL}/health`, (res) => {
        console.log(`[Self-Ping] Status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error('[Self-Ping] Error:', err.message);
    });
}, 10 * 60 * 1000); // 每 10 分鐘一次

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

server.listen(port, () => {
    console.log(`[Market Data Platform] Server running on port ${port}`);
});
