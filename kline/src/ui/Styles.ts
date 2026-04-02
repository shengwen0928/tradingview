export const injectStyles = () => {
    const style = document.createElement('style');
    style.innerHTML = `
        .unit-btn { background: #1e222d; border: 1px solid #363c4e; color: #d1d4dc; padding: 6px; border-radius: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s; }
        .unit-btn:hover { background: #2a2e39; color: #fff; }
        .unit-btn.active { background: #2a2e39; color: #fff; border-color: #2962ff; }
        
        /* 🚀 繪圖工具列按鈕樣式優化 */
        .tool-btn:hover, .tool-btn.active { background: #2a2e39 !important; color: #fff !important; }
        
        /* 🚀 提升全域清晰度 */
        body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
        canvas { image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; touch-action: none; }

        /* 🚀 浮動編輯工具列 */
        .edit-toolbar { position: absolute; background: #1e222d; border: 1px solid #363c4e; border-radius: 6px; display: flex; align-items: center; padding: 4px 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 1000; gap: 8px; }
        .toolbar-section { display: flex; align-items: center; gap: 6px; }
        .toolbar-divider { width: 1px; height: 20px; background: #363c4e; margin: 0 4px; }
        .color-dot { width: 16px; height: 16px; border-radius: 50%; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); transition: transform 0.1s; }
        .color-dot:hover { transform: scale(1.2); }
        .width-btn, .style-btn { color: #d1d4dc; font-size: 11px; cursor: pointer; padding: 2px 6px; border-radius: 3px; }
        .width-btn:hover, .style-btn:hover { background: #2a2e39; color: #fff; }
        .delete-btn { cursor: pointer; font-size: 14px; padding: 2px 4px; filter: grayscale(1); transition: filter 0.2s; }
        .delete-btn:hover { filter: grayscale(0); transform: scale(1.1); }

        /* 🚀 線條樣式收納選單 (歸類介面) */
        .width-menu-wrapper { position: relative; display: flex; align-items: center; }
        .width-main-btn { background: #363c4e; color: #d1d4dc; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; min-width: 36px; text-align: center; border: 1px solid transparent; transition: all 0.2s; }
        .width-main-btn:hover { background: #454b5e; border-color: #2962ff; color: #fff; }
        .width-popover { position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); background: #1e222d; border: 1px solid #363c4e; border-radius: 6px; padding: 4px; box-shadow: 0 8px 24px rgba(0,0,0,0.7); z-index: 1001; display: flex; flex-direction: column; gap: 2px; }
        .width-item { padding: 6px 16px; color: #d1d4dc; cursor: pointer; font-size: 11px; border-radius: 4px; white-space: nowrap; transition: background 0.2s; text-align: center; }
        .width-item:hover { background: #2a2e39; color: #fff; }
        .width-item.active { background: #2962ff; color: #fff; }

        /* 🚀 顏色收納選單樣式 */
        .color-menu-wrapper { position: relative; display: flex; align-items: center; }
        .color-main-btn { width: 20px; height: 20px; border-radius: 4px; cursor: pointer; border: 2px solid #363c4e; transition: border-color 0.2s; }
        .color-main-btn:hover { border-color: #2962ff; }
        .color-popover { position: absolute; bottom: 30px; left: 0; background: #1e222d; border: 1px solid #363c4e; border-radius: 6px; padding: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.7); z-index: 1001; width: 144px; display: flex; flex-direction: column; }
        .color-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; justify-items: center; }
        .color-popover-divider { height: 1px; background: #363c4e; margin: 4px 0 12px 0; }
        
        /* 🚀 全自定義色盤 CSS 修復 */
        .custom-picker-container { position: relative; width: 120px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
        .picker-area { position: relative; width: 100%; }
        #sv-canvas { width: 120px; height: 80px; background: #000; border-radius: 4px; cursor: crosshair; display: block; }
        #hue-canvas { width: 120px; height: 12px; border-radius: 2px; cursor: ew-resize; display: block; }
        
        .sv-cursor { position: absolute; width: 100%; height: 10px; border: 2px solid #fff; border-radius: 50%; pointer-events: none; transform: translate(-50%, -50%); box-shadow: 0 0 4px rgba(0,0,0,0.5); z-index: 10; width: 10px; }
        .hue-cursor, .alpha-cursor { position: absolute; width: 4px; height: 16px; border: 2px solid #fff; border-radius: 2px; pointer-events: none; transform: translate(-50%, -50%); box-shadow: 0 0 4px rgba(0,0,0,0.5); z-index: 10; top: 50%; }
        
        /* 🚀 透明度背景棋盤格 */
        .alpha-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 2px; z-index: -1; background-image: linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%); background-size: 8px 8px; background-position: 0 0, 0 4px, 4px -4px, -4px 0px; background-color: #1e222d; }
        #alpha-canvas { width: 120px; height: 12px; border-radius: 2px; cursor: ew-resize; display: block; }
        
        .width-btn.active { background: #2962ff !important; color: #fff !important; }
    `;
    document.head.appendChild(style);
};
