import WebSocket, { Server } from 'ws';
import http from 'http';
import { DataManager } from '../core/DataManager';

/**
 * 實時網關 (Realtime Gateway)
 * 提供 WebSocket 介面給前端 Client 訂閱即時數據
 */
export class RealtimeGateway {
    private wss: Server;
    private dataManager: DataManager;
    // 🚨 新增：追蹤每個連線的訂閱回調，用於清理
    private clientSubscriptions: Map<WebSocket, Map<string, (candle: any) => void>> = new Map();

    constructor(server: http.Server) {
        this.dataManager = DataManager.getInstance();
        this.wss = new Server({ server });
        
        console.log(`[RealtimeGateway] WebSocket server integrated with HTTP server`);
        this.setup();
    }

    private setup() {
        this.wss.on('connection', (ws) => {
            console.log('[RealtimeGateway] New client connected');
            this.clientSubscriptions.set(ws, new Map());

            ws.on('message', (message: string) => {
                try {
                    const payload = JSON.parse(message);
                    this.handleRequest(ws, payload);
                } catch (error) {
                    console.error('[RealtimeGateway] Message parse error:', error);
                }
            });

            ws.on('close', () => {
                console.log('[RealtimeGateway] Client disconnected, cleaning up subscriptions');
                this.cleanupClient(ws);
            });
        });
    }

    private cleanupClient(ws: WebSocket) {
        const subs = this.clientSubscriptions.get(ws);
        if (subs) {
            subs.forEach((callback, key) => {
                const [id, interval] = key.split('|');
                this.dataManager.unsubscribe(id, interval, callback);
            });
            this.clientSubscriptions.delete(ws);
        }
    }

    private handleRequest(ws: WebSocket, payload: any) {
        const { type, id, interval, source } = payload;

        if (type === 'subscribe') {
            if (!id || !interval) {
                return ws.send(JSON.stringify({ type: 'error', message: 'Missing id or interval' }));
            }

            // 1. 如果該連線已經訂閱過同一標的，先移除舊的 (防止重複推送)
            const clientSubs = this.clientSubscriptions.get(ws)!;
            const subKey = `${id}|${interval}`;
            if (clientSubs.has(subKey)) {
                this.dataManager.unsubscribe(id, interval, clientSubs.get(subKey)!);
            }

            console.log(`[RealtimeGateway] Client subscribing to ${id} ${interval} from ${source || 'default'}`);
            
            // 2. 建立新的訂閱回調
            const onUpdate = (candle: any) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'kline',
                        id,
                        interval,
                        data: candle
                    }));
                }
            };

            // 3. 註冊到 DataManager 並記錄到 clientSubs
            this.dataManager.subscribe(id, interval, onUpdate, source);
            clientSubs.set(subKey, onUpdate);
            
            ws.send(JSON.stringify({ type: 'subscribed', id, interval, source }));
        }
    }
}
