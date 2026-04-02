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
        canvas { image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }

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

        /* 🚀 顏色收納選單樣式 */
        .color-menu-wrapper { position: relative; display: flex; align-items: center; }
        .color-main-btn { width: 20px; height: 20px; border-radius: 4px; cursor: pointer; border: 2px solid #363c4e; transition: border-color 0.2s; }
        .color-main-btn:hover { border-color: #2962ff; }
        .color-popover { position: absolute; bottom: 30px; left: 0; background: #1e222d; border: 1px solid #363c4e; border-radius: 6px; padding: 10px; box-shadow: 0 4px 16px rgba(0,0,0,0.6); z-index: 1001; min-width: 130px; }
        .color-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; justify-items: center; }
        .color-popover-divider { height: 1px; background: #363c4e; margin: 8px 0; }
        
        .width-btn.active { background: #2962ff !important; color: #fff !important; }

        /* 🚀 全自定義色盤 CSS */
        .custom-picker-container { position: relative; display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
        #sv-canvas { border-radius: 4px; cursor: crosshair; background: #000; }
        #hue-canvas { border-radius: 2px; cursor: ew-resize; }
        .sv-cursor { position: absolute; width: 8px; height: 8px; border: 2px solid #fff; border-radius: 50%; pointer-events: none; transform: translate(-5px, -5px); box-shadow: 0 0 4px rgba(0,0,0,0.5); }
        .hue-cursor { position: absolute; width: 4px; height: 14px; border: 2px solid #fff; border-radius: 2px; pointer-events: none; transform: translate(-3px, 84px); box-shadow: 0 0 4px rgba(0,0,0,0.5); }
        .custom-color-label { font-size: 11px; color: #d1d4dc; white-space: nowrap; pointer-events: none; width: 100%; text-align: center; }
        .popover-custom-picker { display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 8px 0; border-radius: 4px; transition: background 0.2s; position: relative; width: 100%; }
        .popover-custom-picker:hover { background: #2a2e39; }
    `;
    document.head.appendChild(style);
};
