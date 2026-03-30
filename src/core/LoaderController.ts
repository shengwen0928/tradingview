import { DataManager } from './DataManager';
import { ViewportEngine } from './ViewportEngine';

/**
 * 負責 Lazy Load 與 API 控制
 */
export class LoaderController {
  private isLoading: boolean = false;
  private hasMoreHistory: boolean = true;
  private cooldownUntil: number = 0; // 🚨 新增：冷卻截止時間戳
  private threshold: number = 200; 

  constructor(
    private dataManager: DataManager,
    private viewport: ViewportEngine
  ) {}

  public async checkLoadMore(): Promise<void> {
    // 🚨 檢查是否在冷卻中
    if (this.isLoading || !this.hasMoreHistory || Date.now() < this.cooldownUntil) return;

    const { startIndex } = this.viewport.getRawRange();

    if (startIndex < this.threshold) {
      console.log('[Loader] 🚀 觸發歷史載入...');
      this.isLoading = true;
      const candles = this.dataManager.getCandles();
      
      if (candles.length > 0) {
        const firstTime = candles[0].time;
        const moreData = await this.dataManager.loadMoreHistory(firstTime);
        
        if (moreData.length === 0) {
          // 🚨 如果回傳 0，進入 3 秒冷卻，避免狂發 429
          console.log('[Loader] ❄️ 未取得新資料，進入 3 秒冷卻');
          this.cooldownUntil = Date.now() + 3000;
        } else if (moreData.length < 10) {
          console.log('[Loader] 🏁 已達歷史資料終點');
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
