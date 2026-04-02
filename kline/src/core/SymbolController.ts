import { DataManager } from './DataManager';
import { ScaleEngine } from './ScaleEngine';
import { TimeframeController } from '../ui/TimeframeController';
import { InfoDisplay } from '../ui/InfoDisplay';

export class SymbolController {
    private currentSymbol: string = 'BTC/USDT';

    constructor(
        private cryptoManager: DataManager,
        private stockManager: DataManager,
        private scaleEngine: ScaleEngine,
        private infoDisplay: InfoDisplay,
        private updateLoader: (manager: DataManager) => void,
        private requestRedraw: () => void
    ) {}

    public async loadSymbol(symbol: string, category: string, tfController: TimeframeController, connectionStatus: string): Promise<DataManager> {
        let s = symbol.toUpperCase();
        let isStock = category.includes('STOCK') || s.includes('.TW') || s.includes('.TWO');
        
        if (/^\d{4,6}$/.test(s)) {
            isStock = true;
            const otcPrefixes = ['31', '80', '54', '61', '62'];
            const isOTC = otcPrefixes.some(p => s.startsWith(p));
            s += isOTC ? '.TWO' : '.TW';
        }

        this.currentSymbol = s;
        document.getElementById('symbol-search-btn')!.innerText = `${s} ▾`;
        
        const exch = isStock ? 'Yahoo' : 'Binance';
        document.getElementById('exchange-display')!.innerText = exch;
        const fullId = s + (isStock ? ':STOCK' : ':SPOT');
        
        const activeManager = isStock ? this.stockManager : this.cryptoManager;
        
        // 切換前清理
        await this.cryptoManager.update('', '', '');
        await this.stockManager.update('', '', '');

        this.updateLoader(activeManager);
        this.scaleEngine.resetAutoScale();
        
        await activeManager.update(fullId, tfController.getCurrentTimeframe(), exch);
        this.infoDisplay.updateStatus(connectionStatus, this.currentSymbol);
        this.requestRedraw();

        return activeManager;
    }

    public getCurrentSymbol() {
        return this.currentSymbol;
    }
}
