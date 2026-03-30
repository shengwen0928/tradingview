import WebSocket, { Server } from 'ws';
import { DataManager } from '../core/DataManager';

/**
 * 實時網關 (Realtime Gateway)
 * 提供 WebSocket 介面給前端 Client 訂閱即時數據
 */
export class RealtimeGateway {
    private wss: Server;
    private dataManager: DataManager;

    constructor(port: number) {
        this.dataManager = DataManager.getInstance();
        this.wss = new Server({ port });
        
        console.log(`[RealtimeGateway] WebSocket server running on ws://localhost:${port}`);
        this.setup();
    }

    private setup() {
        this.wss.on('connection', (ws) => {
            console.log('[RealtimeGateway] New client connected');

            ws.on('message', (message: string) => {
                try {
                    const payload = JSON.parse(message);
                    this.handleRequest(ws, payload);
                } catch (error) {
                    console.error('[RealtimeGateway] Message parse error:', error);
                }
            });

            ws.on('close', () => {
                console.log('[RealtimeGateway] Client disconnected');
            });
        });
    }

    private handleRequest(ws: WebSocket, payload: any) {
        const { type, id, interval, source } = payload;

        if (type === 'subscribe') {
            if (!id || !interval) {
                return ws.send(JSON.stringify({ type: 'error', message: 'Missing id or interval' }));
            }

            console.log(`[RealtimeGateway] Client subscribing to ${id} ${interval} from ${source || 'default'}`);
            
            // 呼叫 DataManager 訂閱
            this.dataManager.subscribe(id, interval, (candle) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'kline',
                        id,
                        interval,
                        data: candle
                    }));
                }
            }, source);
            
            ws.send(JSON.stringify({ type: 'subscribed', id, interval, source }));
        }
    }
}
