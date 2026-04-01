import express from 'express';
import http from 'http'; 
import axios from 'axios'; // 🚨 改用 axios 以支援 https
import { DataManager } from '../core/DataManager';
import { RealtimeGateway } from './RealtimeGateway';

/**
 * API 伺服器 (Aggregation API)
 */
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3001;
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

// 🚨 修正：自我喚醒機制
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
setInterval(async () => {
    try {
        const res = await axios.get(`${SELF_URL}/health`);
        console.log(`[Self-Ping] Status: ${res.status}`);
    } catch (err: any) {
        console.error('[Self-Ping] Error:', err.message);
    }
}, 10 * 60 * 1000); // 每 10 分鐘一次

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

server.listen(port, () => {
    console.log(`[Market Data Platform] Server running on port ${port}`);
});
