import { DataManager } from './DataManager';
import { ViewportEngine } from './ViewportEngine';

/**
 * 負責 Lazy Load 與 API 控制
 */
export class LoaderController {
  private isLoading: boolean = false;
  private threshold: number = 200; // 當剩下 200 根時載入歷史

  constructor(
    private dataManager: DataManager,
    private viewport: ViewportEngine
  ) {}

  /**
   * 檢查是否需要載入更多資料
   */
  public async checkLoadMore(): Promise<void> {
    if (this.isLoading) return;

    const { startIndex } = this.viewport.getRawRange();
    // console.log(`[Loader] startIndex: ${Math.floor(startIndex)}, threshold: ${this.threshold}`);

    if (startIndex < this.threshold) {
      console.log('[Loader] 🚀 觸發歷史載入...');
      this.isLoading = true;
      const candles = this.dataManager.getCandles();
      if (candles.length > 0) {
        const firstTime = candles[0].time;
        console.log(`[Loader] 請求 ${new Date(firstTime).toLocaleString()} 之前的資料`);
        const moreData = await this.dataManager.loadMoreHistory(firstTime);
        console.log(`[Loader] ✅ 載入成功，新增 ${moreData.length} 根 K 線`);
      }
      this.isLoading = false;
    }
  }

  public getLoadingStatus(): boolean {
    return this.isLoading;
  }
}
