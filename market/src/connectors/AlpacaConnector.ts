import WebSocket from 'ws';
import { Candle } from '../types/Candle';
import { IConnector } from './ConnectorInterface';

/**
 * Alpaca 數據接入器 (美股專用)
 * 🚀 提供免費的 WebSocket 即時 K 線推播 (IEX 數據源)
 */
export class AlpacaConnector implements IConnector {
    public readonly name = 'Alpaca';
    private ws: WebSocket | null = null;
    private apiKey: string = process.env.ALPACA_API_KEY || '';
    private apiSecret: string = process.env.ALPACA_SECRET || '';
    private subscribers: Map<string, (candle: Candle) => void> = new Map();
    private authenticated: boolean = false;

    // Alpaca 免費數據終端 (IEX)
    private readonly wsUrl = 'wss://stream.data.alpaca.markets/v2/iex';

    constructor() {}

    public async fetchKlines(symbol: string, interval: string, limit: number, endTime?: number): Promise<Candle[]> {
        // 🚨 歷史數據維持使用 Yahoo，此處僅作為介面實作
        return [];
    }

    public subscribeKlines(symbol: string, interval: string, callback: (candle: Candle) => void): void {
        const cleanSymbol = symbol.toUpperCase(); // 例如 AAPL
        this.subscribers.set(cleanSymbol, callback);
        this.connect();
    }

    private connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            if (this.authenticated) this.resubscribe();
            return;
        }

        console.log(`[AlpacaConnector] Connecting to ${this.wsUrl}...`);
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
            console.log('[AlpacaConnector] WebSocket Opened. Authenticating...');
            this.authenticate();
        });

        this.ws.on('message', (data: string) => {
            const msgs = JSON.parse(data);
            msgs.forEach((msg: any) => {
                if (msg.T === 'success' && msg.msg === 'connected') {
                    // 等待 auth
                } else if (msg.T === 'success' && msg.msg === 'authenticated') {
                    console.log('[AlpacaConnector] Authenticated ✅');
                    this.authenticated = true;
                    this.resubscribe();
                } else if (msg.T === 'b') { // Bar (K-line) 數據
                    this.handleBar(msg);
                } else if (msg.T === 'error') {
                    console.error('[AlpacaConnector] Error:', msg.msg);
                }
            });
        });

        this.ws.on('close', () => {
            console.warn('[AlpacaConnector] Closed. Reconnecting in 5s...');
            this.authenticated = false;
            setTimeout(() => this.connect(), 5000);
        });
    }

    private authenticate() {
        if (!this.apiKey) {
            console.error('[AlpacaConnector] Missing ALPACA_API_KEY. Real-time data disabled.');
            return;
        }
        this.ws?.send(JSON.stringify({
            action: 'auth',
            key: this.apiKey,
            secret: this.apiSecret
        }));
    }

    private resubscribe() {
        const symbols = Array.from(this.subscribers.keys());
        if (symbols.length === 0) return;

        this.ws?.send(JSON.stringify({
            action: 'subscribe',
            bars: symbols
        }));
        console.log(`[AlpacaConnector] Subscribed to bars: ${symbols.join(', ')}`);
    }

    private handleBar(msg: any) {
        const callback = this.subscribers.get(msg.S);
        if (callback) {
            const candle: Candle = {
                timestamp: new Date(msg.t).getTime(),
                open: msg.o,
                high: msg.h,
                low: msg.l,
                close: msg.c,
                volume: msg.v
            };
            callback(candle);
        }
    }

    public unsubscribeKlines(symbol: string, interval: string): void {
        const cleanSymbol = symbol.toUpperCase();
        this.subscribers.delete(cleanSymbol);
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                action: 'unsubscribe',
                bars: [cleanSymbol]
            }));
        }
    }

    public close(): void {
        this.ws?.close();
        this.subscribers.clear();
    }
}
