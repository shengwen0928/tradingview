export class InfoDisplay {
  private dot: HTMLElement | null;
  private statusText: HTMLElement | null;
  private o: HTMLElement | null;
  private h: HTMLElement | null;
  private l: HTMLElement | null;
  private c: HTMLElement | null;
  private chg: HTMLElement | null;

  constructor() {
    this.dot = document.getElementById('status-dot');
    this.statusText = document.getElementById('status-text');
    this.o = document.getElementById('ohlc-o');
    this.h = document.getElementById('ohlc-h');
    this.l = document.getElementById('ohlc-l');
    this.c = document.getElementById('ohlc-c');
    this.chg = document.getElementById('ohlc-chg');
  }

  public updateStatus(status: string, symbol: string) {
    if (!this.dot || !this.statusText) return;
    if (status === 'connected') {
      this.dot.style.background = '#26a69a';
      this.statusText.innerText = `${symbol} Live`;
    } else {
      this.dot.style.background = '#ef5350';
      this.statusText.innerText = `${symbol} Disconnected`;
    }
  }

  public updateOHLC(candle: any) {
    if (!this.o || !this.h || !this.l || !this.c || !this.chg) return;
    if (!candle || typeof candle.open === 'undefined') {
      this.o.innerText = this.h.innerText = this.l.innerText = this.c.innerText = this.chg.innerText = '--';
      this.chg.style.color = '#929498';
      return;
    }
    const diff = candle.close - candle.open;
    const pct = ((diff / candle.open) * 100).toFixed(2);
    const color = diff >= 0 ? '#26a69a' : '#ef5350';
    
    this.o.innerText = candle.open.toFixed(2);
    this.h.innerText = candle.high.toFixed(2);
    this.l.innerText = candle.low.toFixed(2);
    this.c.innerText = candle.close.toFixed(2);
    this.chg.innerText = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} (${pct}%)`;
    this.chg.style.color = color;
  }
}
