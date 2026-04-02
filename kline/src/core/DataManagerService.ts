import { DataManager } from './DataManager';
import { ViewportEngine } from './ViewportEngine';
import { LoaderController } from './LoaderController';

export class DataManagerService {
    private cryptoManager: DataManager;
    private stockManager: DataManager;
    private activeManager: DataManager;
    private loader: LoaderController;

    constructor(
        private viewport: ViewportEngine,
        private onStatusChange: (status: string, symbol: string) => void,
        private requestRedraw: () => void
    ) {
        const onUpdate = (candles: any[], isHistory: boolean) => {
            this.viewport.setDataCount(candles.length, isHistory);
            this.requestRedraw();
        };

        const statusCb = (status: string) => {
            this.onStatusChange(status, this.activeManager.getSymbol());
        };

        this.cryptoManager = new DataManager(onUpdate, statusCb);
        this.stockManager = new DataManager(onUpdate, statusCb);
        this.activeManager = this.cryptoManager;
        this.loader = new LoaderController(this.activeManager, this.viewport);
    }

    public getActiveManager() { return this.activeManager; }
    public getCryptoManager() { return this.cryptoManager; }
    public getStockManager() { return this.stockManager; }
    public getLoader() { return this.loader; }

    public setActiveManager(manager: DataManager) {
        this.activeManager = manager;
        this.loader = new LoaderController(manager, this.viewport);
    }
}
