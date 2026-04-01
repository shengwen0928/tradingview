import express from 'express';
import http from 'http'; 
import { CryptoDataManager } from '../core/CryptoDataManager';
import { StockDataManager } from '../core/StockDataManager';
import { RealtimeGateway } from './RealtimeGateway';

/**
 * API 伺服器 (Aggregation API)
 */
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3001;

const cryptoManager = CryptoDataManager.getInstance();
const stockManager = StockDataManager.getInstance();

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
 * --- 加密貨幣 API 組 ---
 */
app.get('/crypto/klines', async (req, res) => {
    const { id, interval, endTime, source } = req.query;
    if (!id || !interval) return res.status(400).json({ success: false, message: 'Missing parameters' });
    try {
        const klines = await cryptoManager.getKlines(id as string, interval as string, 500, endTime ? parseInt(endTime as string) : undefined, source as string);
        res.json({ success: true, data: klines });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

/**
 * --- 股票 API 組 ---
 */
app.get('/stock/klines', async (req, res) => {
    const { id, interval, endTime } = req.query;
    if (!id || !interval) return res.status(400).json({ success: false, message: 'Missing parameters' });
    try {
        const klines = await stockManager.getKlines(id as string, interval as string, 500, endTime ? parseInt(endTime as string) : undefined);
        res.json({ success: true, data: klines });
    } catch (e: any) { res.status(500).json({ success: false, message: e.message }); }
});

// 🏠 根目錄路由，防止 404 並確認伺服器運作中
app.get('/', (req, res) => {
    res.status(200).send('Market Separation Server is running ✅');
});

// 🖼️ 防止 Favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

server.listen(Number(port), '0.0.0.0', () => {
    console.log(`[Market Data Platform] Server running on port ${port} (0.0.0.0)`);
});
