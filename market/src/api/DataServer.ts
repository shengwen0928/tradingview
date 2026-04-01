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

// CORS 完整設定
app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // 處理預檢請求 (Preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
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

// 🚨 簡化：只保留健康檢查端點，不主動發送請求以防止啟動崩潰
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// 🏠 根目錄路由，防止 404 並確認伺服器運作中
app.get('/', (req, res) => {
    res.status(200).send('Market Data Server is running ✅');
});

// 🖼️ 防止 Favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

server.listen(Number(port), '0.0.0.0', () => {
    console.log(`[Market Data Platform] Server running on port ${port} (0.0.0.0)`);
});
