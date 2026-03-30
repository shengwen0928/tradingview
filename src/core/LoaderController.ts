import { DataManager } from './DataManager';
import { ViewportEngine } from './ViewportEngine';

/**
 * 負責 Lazy Load 與 API 控制
 */
export class LoaderController {
  private isLoading: boolean = false;
  private hasMoreHistory: boolean = true; // 🚨 新增：紀錄是否還有歷史資料
  private threshold: number = 200; 

  constructor(
    private dataManager: DataManager,
    private viewport: ViewportEngine
  ) {}

  public async checkLoadMore(): Promise<void> {
    if (this.isLoading || !this.hasMoreHistory) return; // 🚨 如果已無歷史，直接返回

    const { startIndex } = this.viewport.getRawRange();

    if (startIndex < this.threshold) {
      console.log('[Loader] 🚀 觸發歷史載入...');
      this.isLoading = true;
      const candles = this.dataManager.getCandles();
      if (candles.length > 0) {
        const firstTime = candles[0].time;
        const moreData = await this.dataManager.loadMoreHistory(firstTime);
        
        // 🚨 如果回傳數據太少，代表 OKX 那邊沒資料了
        if (moreData.length < 10) {
          console.log('[Loader] 🏁 已達歷史資料終點，停止後續載入');
          this.hasMoreHistory = false;
        } else {
          console.log(`[Loader] ✅ 載入成功，新增 ${moreData.length} 根 K 線`);
        }
      }
      this.isLoading = false;
    }
  }

  public getLoadingStatus(): boolean {
    return this.isLoading;
  }
}
