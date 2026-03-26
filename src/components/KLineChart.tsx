import React, { useEffect, useRef, useState } from 'react';
import { init, dispose, registerLocale, type Period } from 'klinecharts';

// 註冊繁體中文
registerLocale('zh-TW', {
  time: '時間', open: '開', high: '高', low: '低', close: '收', volume: '量',
  change: '幅', turnover: '額', second: '秒', minute: '分', hour: '時',
  day: '日', week: '周', month: '月', year: '年'
});

interface PeriodOption {
  label: string;
  value: Period;
}

const periods: PeriodOption[] = [
  { label: '1分', value: { type: 'minute', span: 1 } },
  { label: '15分', value: { type: 'minute', span: 15 } },
  { label: '1小時', value: { type: 'hour', span: 1 } },
  { label: '4小時', value: { type: 'hour', span: 4 } },
  { label: '日線', value: { type: 'day', span: 1 } },
];

const KLineChart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const loadingRef = useRef(false);
  const earliestTsRef = useRef<number | null>(null); // 手動記錄最老的時間戳

  const [symbols, setSymbols] = useState<any[]>([]);
  const [currentSymbol, setCurrentSymbol] = useState('BTCUSDT');
  const [currentPeriod, setCurrentPeriod] = useState(periods[2]);

  // 1. 獲取幣種
  useEffect(() => {
    fetch('https://api.binance.com/api/v3/exchangeInfo')
      .then(res => res.json())
      .then(data => {
        const pairs = data.symbols
          .filter((s: any) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
          .map((s: any) => ({ ticker: s.symbol, pricePrecision: s.pricePrecision, volumePrecision: s.quantityPrecision }))
          .sort((a: any, b: any) => a.ticker.localeCompare(b.ticker));
        setSymbols(pairs);
      });
  }, []);

  // 2. 初始化圖表
  useEffect(() => {
    if (symbols.length === 0 || !containerRef.current) return;

    const chartInstance = init(containerRef.current, {
      locale: 'zh-TW',
      styles: { grid: { show: false }, candle: { tooltip: { showRule: 'follow_cross' } } }
    });
    if (!chartInstance) return;
    chartRef.current = chartInstance;
    earliestTsRef.current = null; // 重置最老時間戳

    chartInstance.createIndicator('MA', true, { id: 'candle_pane' });
    chartInstance.createIndicator('VOL', true, { height: 100 });

    chartInstance.setDataLoader({
      getBars: async ({ type, symbol, period, timestamp, callback }: any) => {
        if (type === 'forward') { callback([], false); return; }
        if (loadingRef.current) return;
        loadingRef.current = true;

        try {
          const ticker = symbol.ticker;
          const intervalMap: any = { minute: 'm', hour: 'h', day: 'd', week: 'w', month: 'M' };
          const interval = `${period.span}${intervalMap[period.type]}`;
          const limit = 1000;

          const fetchK = async (endTime?: number) => {
            const url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=${interval}&limit=${limit}${endTime ? `&endTime=${endTime}` : ''}`;
            const res = await fetch(url);
            const data = await res.json();
            return Array.isArray(data) ? data : [];
          };

          let allData: any[] = [];
          if (type === 'init') {
            let last = undefined;
            for (let i = 0; i < 3; i++) {
              const batch = await fetchK(last);
              if (!batch.length) break;
              allData = [...batch, ...allData];
              last = batch[0][0] - 1;
              if (batch.length < limit) break;
            }
          } else {
            // 向左捲動時，優先使用我們記錄的最早時間，防止圖表庫傳入錯誤的 timestamp
            const referenceTs = Math.min(timestamp || Infinity, earliestTsRef.current || Infinity);
            allData = await fetchK(referenceTs - 1);
          }

          if (!allData.length) {
            console.log(`[getBars] ${type} 未獲取到更多數據，停止加載歷史`);
            callback([], false);
            return;
          }

          const kLineData = allData.map((item: any) => ({
            timestamp: item[0], open: parseFloat(item[1]), high: parseFloat(item[2]),
            low: parseFloat(item[3]), close: parseFloat(item[4]), volume: parseFloat(item[5]),
          })).sort((a: any, b: any) => a.timestamp - b.timestamp);

          if (!earliestTsRef.current || kLineData[0].timestamp < earliestTsRef.current) {
            earliestTsRef.current = kLineData[0].timestamp;
          }

          if (earliestTsRef.current) {
            console.log(`[getBars] ${type} 成功: ${kLineData.length} 根, 最早時間推移至: ${new Date(earliestTsRef.current).toLocaleString()}`);
          }
          
          // 使用最簡單的 true，強制開啟無限歷史模式
          callback(kLineData, true);
        } catch (e) {
          console.error('[getBars] 請求異常:', e);
          callback([], false);
        } finally {
          setTimeout(() => { loadingRef.current = false; }, 200);
        }
      },
      subscribeBar: ({ symbol, period, callback }: any) => {
        const ticker = symbol.ticker.toLowerCase();
        const intervalMap: any = { minute: 'm', hour: 'h', day: 'd', week: 'w', month: 'M' };
        const interval = `${period.span}${intervalMap[period.type]}`;

        if (socketRef.current) {
          socketRef.current.onmessage = null;
          socketRef.current.close();
        }
        
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${ticker}@kline_${interval}`);
        socketRef.current = ws;
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          if (msg.e === 'kline') {
            const k = msg.k;
            callback({
              timestamp: k.t, open: parseFloat(k.o), high: parseFloat(k.h),
              low: parseFloat(k.l), close: parseFloat(k.c), volume: parseFloat(k.v),
            });
          }
        };
      },
      unsubscribeBar: () => {
        if (socketRef.current) {
          socketRef.current.onmessage = null;
          socketRef.current.close();
          socketRef.current = null;
        }
      }
    });

    const initialSymbol = symbols.find(s => s.ticker === currentSymbol) || symbols[0];
    chartInstance.setSymbol(initialSymbol);
    chartInstance.setPeriod(currentPeriod.value);

    const handleResize = () => chartInstance.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socketRef.current) socketRef.current.close();
      dispose(containerRef.current!);
    };
  }, [symbols, currentPeriod]);

  const handleSymbolChange = (e: any) => {
    const ticker = e.target.value;
    setCurrentSymbol(ticker);
    earliestTsRef.current = null; // 切換幣種，重置時間記錄
    const info = symbols.find(s => s.ticker === ticker);
    if (chartRef.current && info) chartRef.current.setSymbol(info);
  };

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#131722', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 12px', backgroundColor: '#1e222d', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #363c4e', zIndex: 10 }}>
        <select value={currentSymbol} onChange={handleSymbolChange} style={{ backgroundColor: '#2a2e39', color: '#d1d4dc', border: '1px solid #363c4e', padding: '4px 8px', borderRadius: '4px' }}>
          {symbols.map(s => <option key={s.ticker} value={s.ticker}>{s.ticker}</option>)}
        </select>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#2a2e39', borderRadius: '4px', padding: '2px' }}>
          {periods.map((p) => (
            <button key={p.label} onClick={() => { earliestTsRef.current = null; setCurrentPeriod(p); }} style={{ backgroundColor: currentPeriod.label === p.label ? '#363c4e' : 'transparent', color: currentPeriod.label === p.label ? '#fff' : '#848e9c', border: 'none', padding: '4px 10px', borderRadius: '2px', cursor: 'pointer', fontSize: '13px' }}>
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ color: '#00b07c', fontSize: '12px', marginLeft: 'auto' }}>● 實時傳輸中</div>
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
};

export default KLineChart;
