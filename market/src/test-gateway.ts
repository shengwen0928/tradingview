import WebSocket from 'ws';

const wsUrl = 'ws://localhost:3002';
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('--- 成功連線至 Realtime Gateway ---');
    
    // 傳送訂閱請求
    const subRequest = {
        type: 'subscribe',
        id: 'BTC/USDT',
        interval: '1m'
    };
    
    console.log('發送訂閱請求:', subRequest);
    ws.send(JSON.stringify(subRequest));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    
    if (msg.type === 'subscribed') {
        console.log('訂閱成功確認:', msg);
    } else if (msg.type === 'kline') {
        console.log('收到即時 K 線廣播:', msg.data);
    } else {
        console.log('收到其他訊息:', msg);
    }
});

ws.on('error', (err) => {
    console.error('連線錯誤:', err);
});

ws.on('close', () => {
    console.log('連線已關閉');
});

// 20 秒後自動結束
setTimeout(() => {
    console.log('測試結束，關閉連線');
    ws.close();
    process.exit(0);
}, 20000);
