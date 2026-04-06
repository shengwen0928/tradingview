import { PineScriptEngine } from '../core/engines/PineScriptEngine';
import { DataManager } from '../core/services/DataManager';

export class ScriptEditor {
  private editorPanel: HTMLElement;
  private editorCode: HTMLTextAreaElement;

  constructor(
    private pineEngine: PineScriptEngine,
    private activeManagerProvider: () => DataManager,
    private onRequestRedraw: () => void
  ) {
    this.editorPanel = document.getElementById('pine-editor')!;
    this.editorCode = document.getElementById('pine-code') as HTMLTextAreaElement;
    this.init();
  }

  private init() {
    const editorBtn = document.getElementById('pine-editor-btn')!;
    const editorClose = document.getElementById('pine-close')!;
    const editorApply = document.getElementById('pine-apply')!;
    const editorSave = document.getElementById('pine-save')!;

    editorBtn.onclick = () => {
      this.editorPanel.style.display = (this.editorPanel.style.display === 'flex' ? 'none' : 'flex');
    };
    editorClose.onclick = () => this.editorPanel.style.display = 'none';

    // 載入儲存的腳本
    const savedScript = localStorage.getItem('pine-script-default');
    if (savedScript) {
      this.editorCode.value = savedScript;
    } else {
      this.editorCode.value = `// 範例：SMA 20\nplot(ta.sma(close, 20), "MA20", "#ffeb3b")`;
    }

    editorApply.onclick = () => {
      const code = this.editorCode.value;
      console.log('[ScriptEditor] Applying script...');
      try {
        // 立即執行一次計算測試
        const compiledJs = this.pineEngine.compile(code);
        this.pineEngine.run(this.activeManagerProvider().getCandles(), compiledJs);
        this.onRequestRedraw();
      } catch (e) {
        alert('腳本錯誤，請檢查語法');
      }
    };

    editorSave.onclick = () => {
      localStorage.setItem('pine-script-default', this.editorCode.value);
      alert('指標已儲存 ✅');
    };
  }

  public getScript() {
    return this.editorCode.value;
  }
}
