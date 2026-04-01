import WebSocket, { Server } from 'ws';
import http from 'http';
import { CryptoDataManager } from '../core/CryptoDataManager';
import { StockDataManager } from '../core/StockDataManager';

/**
 * 實時網關 (Realtime Gateway)
 */
export class RealtimeGateway {
    private wss: Server;
    private cryptoManager: CryptoDataManager;
    private stockManager: StockDataManager;
    private clientSubscriptions: Map<WebSocket, Map<string, (candle: any) => void>> = new Map();

    constructor(server: http.Server) {
        this.cryptoManager = CryptoDataManager.getInstance();
        this.stockManager = StockDataManager.getInstance();
        this.wss = new Server({ server });
        this.setup();
    }

    private setup() {
        this.wss.on('connection', (ws) => {
            this.clientSubscriptions.set(ws, new Map());
            ws.on('message', (msg: string) => {
                try {
                    const payload = JSON.parse(msg);
                    if (payload.type === 'ping') return ws.send(JSON.stringify({ type: 'pong' }));
                    this.handleRequest(ws, payload);
                } catch (e) {}
            });
            ws.on('close', () => this.cleanupClient(ws));
        });
    }

    private handleRequest(ws: WebSocket, payload: any) {
        const { type, id, interval, source } = payload;
        if (type !== 'subscribe' || !id || !interval) return;

        const isStock = id.includes(':STOCK');
        const manager = isStock ? this.stockManager : this.cryptoManager;

        const onUpdate = (candle: any) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'kline', id, interval, data: candle }));
            }
        };

        manager.subscribe(id, interval, onUpdate, source);
        this.clientSubscriptions.get(ws)!.set(`${id}|${interval}`, onUpdate);
        ws.send(JSON.stringify({ type: 'subscribed', id, interval }));
    }

    private cleanupClient(ws: WebSocket) {
        const subs = this.clientSubscriptions.get(ws);
        if (subs) {
            subs.forEach((cb, key) => {
                const [id, interval] = key.split('|');
                const manager = id.includes(':STOCK') ? this.stockManager : this.cryptoManager;
                manager.unsubscribe(id, interval, cb);
            });
            this.clientSubscriptions.delete(ws);
        }
    }
}
