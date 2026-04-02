export const ALL_SYMBOLS: { [key: string]: { s: string, d: string }[] } = {
  'CRYPTO': [
    { s: 'BTC/USDT', d: 'Bitcoin' }, { s: 'ETH/USDT', d: 'Ethereum' }, { s: 'SOL/USDT', d: 'Solana' },
    { s: 'BNB/USDT', d: 'Binance Coin' }, { s: 'XRP/USDT', d: 'Ripple' }, { s: 'ADA/USDT', d: 'Cardano' },
    { s: 'DOGE/USDT', d: 'Dogecoin' }, { s: 'DOT/USDT', d: 'Polkadot' }, { s: 'MATIC/USDT', d: 'Polygon' },
    { s: 'LTC/USDT', d: 'Litecoin' }, { s: 'SHIB/USDT', d: 'Shiba Inu' }, { s: 'AVAX/USDT', d: 'Avalanche' },
    { s: 'TRX/USDT', d: 'TRON' }, { s: 'LINK/USDT', d: 'Chainlink' }, { s: 'UNI/USDT', d: 'Uniswap' },
    { s: 'PEPE/USDT', d: 'Pepe' }, { s: 'STX/USDT', d: 'Stacks' }, { s: 'APT/USDT', d: 'Aptos' },
    { s: 'OP/USDT', d: 'Optimism' }, { s: 'ARB/USDT', d: 'Arbitrum' }, { s: 'NEAR/USDT', d: 'Near' },
    { s: 'FIL/USDT', d: 'Filecoin' }, { s: 'ICP/USDT', d: 'Internet Computer' }, { s: 'ETC/USDT', d: 'Ethereum Classic' },
    { s: 'XLM/USDT', d: 'Stellar' }, { s: 'SUI/USDT', d: 'Sui' }, { s: 'TIA/USDT', d: 'Celestia' }
  ],
  'TW_STOCK': [
    { s: '2330.TW', d: '台積電' }, { s: '2317.TW', d: '鴻海' }, { s: '2454.TW', d: '聯發科' },
    { s: '3105.TWO', d: '穩懋' }, { s: '2603.TW', d: '長榮' }, { s: '2609.TW', d: '陽明' },
    { s: '2308.TW', d: '台達電' }, { s: '2881.TW', d: '富邦金' }, { s: '2882.TW', d: '國泰金' },
    { s: '2357.TW', d: '華碩' }, { s: '3231.TW', d: '緯創' }, { s: '2382.TW', d: '廣達' },
    { s: '1101.TW', d: '台泥' }, { s: '2002.TW', d: '中鋼' }, { s: '2412.TW', d: '中華電' },
    { s: '2886.TW', d: '兆豐金' }, { s: '2884.TW', d: '玉山金' }, { s: '5880.TW', d: '合庫金' },
    { s: '2303.TW', d: '聯電' }, { s: '2618.TW', d: '星宇航空' }, { s: '2610.TW', d: '華航' },
    { s: '2337.TW', d: '旺宏' }, { s: '2409.TW', d: '友達' }, { s: '3481.TW', d: '群創' },
    { s: '2324.TW', d: '仁寶' }, { s: '2353.TW', d: '宏碁' }, { s: '2376.TW', d: '技嘉' },
    { s: '2377.TW', d: '微星' }, { s: '3034.TW', d: '聯詠' }, { s: '3711.TW', d: '日月光' },
    { s: '2408.TW', d: '南亞科' }, { s: '2344.TW', d: '華邦電' }, { s: '2301.TW', d: '光寶科' },
    { s: '2313.TW', d: '華通' }, { s: '2327.TW', d: '國巨' }, { s: '2352.TW', d: '佳世達' },
    { s: '2356.TW', d: '英業達' }, { s: '2360.TW', d: '致茂' }, { s: '2379.TW', d: '瑞昱' },
    { s: '2383.TW', d: '台光電' }, { s: '2385.TW', d: '群光' }, { s: '2395.TW', d: '研華' },
    { s: '3008.TW', d: '大立光' }, { s: '3037.TW', d: '欣興' }, { s: '3045.TW', d: '台灣大' },
    { s: '4904.TW', d: '遠傳' }, { s: '4938.TW', d: '和碩' }, { s: '0050.TW', d: '元大台灣50' },
    { s: '0056.TW', d: '元大高股息' }, { s: '00878.TW', d: '國泰永續高股息' }
  ],
  'US_STOCK': [
    { s: 'AAPL', d: 'Apple' }, { s: 'NVDA', d: 'NVIDIA' }, { s: 'TSLA', d: 'Tesla' },
    { s: 'MSFT', d: 'Microsoft' }, { s: 'GOOGL', d: 'Alphabet' }, { s: 'AMZN', d: 'Amazon' },
    { s: 'META', d: 'Meta' }, { s: 'NFLX', d: 'Netflix' }, { s: 'AMD', d: 'AMD' },
    { s: 'INTC', d: 'Intel' }, { s: 'PYPL', d: 'PayPal' }, { s: 'COIN', d: 'Coinbase' },
    { s: 'BRK-B', d: 'Berkshire Hathaway' }, { s: 'V', d: 'Visa' }, { s: 'JPM', d: 'JPMorgan Chase' },
    { s: 'WMT', d: 'Walmart' }, { s: 'DIS', d: 'Disney' }, { s: 'MA', d: 'Mastercard' },
    { s: 'UNH', d: 'UnitedHealth' }, { s: 'HD', d: 'Home Depot' }, { s: 'BAC', d: 'Bank of America' },
    { s: 'PG', d: 'P&G' }, { s: 'ORCL', d: 'Oracle' }, { s: 'ABNV', d: 'Airbnb' },
    { s: 'AVGO', d: 'Broadcom' }, { s: 'COST', d: 'Costco' }, { s: 'CRM', d: 'Salesforce' }
  ]
};
