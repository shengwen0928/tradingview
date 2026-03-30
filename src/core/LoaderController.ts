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
    const candles = this.dataManager.getCandles();
    
    // 如果資料是空的 (例如剛切換幣種)，重置狀態
    if (candles.length === 0) {
      this.hasMoreHistory = true;
      this.viewport.setMinStartIndex(0);
      return;
    }

    if (this.isLoading || !this.hasMoreHistory || Date.now() < this.cooldownUntil) return;

    const { startIndex } = this.viewport.getRawRange();

    if (startIndex < this.threshold) {
      console.log('[Loader] 🚀 觸發歷史載入...');
      this.isLoading = true;
      
      const firstTime = candles[0].time;
      const moreData = await this.dataManager.loadMoreHistory(firstTime);
      
      if (moreData.length === 0) {
        console.log('[Loader] 🏁 已達歷史資料終點，啟用左側留白模式');
        this.hasMoreHistory = false;
        
        // 🚨 關鍵：允許向左滑動直到第一根 K 棒到中間
        const visibleCount = this.viewport.getVisibleCount();
        this.viewport.setMinStartIndex(-visibleCount / 2);
      } else {
        console.log(`[Loader] ✅ 載入成功，新增 ${moreData.length} 根 K 線`);
      }
      this.isLoading = false;
    }
  }

  public getLoadingStatus(): boolean {
    return this.isLoading;
  }
}
