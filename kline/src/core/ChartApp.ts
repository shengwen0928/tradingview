import { ViewportEngine } from './ViewportEngine';
import { ScaleEngine } from './ScaleEngine';
import { RenderEngine } from './RenderEngine';
import { InteractionEngine } from './InteractionEngine';
import { PineScriptEngine } from './PineScriptEngine';
import { DrawingEngine } from './DrawingEngine';
import { SymbolController } from './SymbolController';
import { DrawingController } from './DrawingController';
import { MagnetService } from './MagnetService';
import { CrosshairController } from './CrosshairController';
import { PriceAnimator } from './PriceAnimator';
import { IndicatorController } from './IndicatorController';
import { InteractionCoordinator } from './InteractionCoordinator';
import { ViewportController } from './ViewportController';
import { DataManagerService } from './DataManagerService';
import { RenderPipeline } from './RenderPipeline';
import { LayoutController } from './LayoutController';
import { RenderLoop } from './RenderLoop';
import { InteractionBridge } from './InteractionBridge';
import { APP_CONFIG } from '../constants/AppConfig';

// UI Components
import { SymbolModal } from '../ui/SymbolModal';
import { TimeframeController } from '../ui/TimeframeController';
import { DrawingToolbar } from '../ui/DrawingToolbar';
import { ScriptEditor } from '../ui/ScriptEditor';
import { InfoDisplay } from '../ui/InfoDisplay';
import { DrawingEditToolbar } from '../ui/DrawingEditToolbar';
import { injectStyles } from '../ui/Styles';

export class ChartApp {
  constructor() {
    injectStyles();
    
    // 1. 底層引擎
    const renderEngine = new RenderEngine(
      document.getElementById(APP_CONFIG.DOM_IDS.GRID_CANVAS) as HTMLCanvasElement, 
      document.getElementById(APP_CONFIG.DOM_IDS.CANDLE_CANVAS) as HTMLCanvasElement, 
      document.getElementById(APP_CONFIG.DOM_IDS.OVERLAY_CANVAS) as HTMLCanvasElement
    );
    const scaleEngine = new ScaleEngine();
    const drawingEngine = new DrawingEngine();
    const infoDisplay = new InfoDisplay();
    
    // 預先建立數據服務，用於循環依賴
    const viewport = new ViewportEngine(() => renderLoop.requestRedraw());
    const dataService = new DataManagerService(viewport, infoDisplay, () => renderLoop.requestRedraw());
    const magnetService = new MagnetService(viewport, scaleEngine);
    const layoutController = new LayoutController(renderEngine, scaleEngine, () => renderLoop.requestRedraw());
    const indicatorController = new IndicatorController(new PineScriptEngine());
    const priceAnimator = new PriceAnimator();

    // 3. 控制器與渲染管線
    const crosshairController = new CrosshairController(viewport, scaleEngine, renderEngine, infoDisplay, drawingEngine, null as any);
    const renderPipeline = new RenderPipeline(viewport, scaleEngine, renderEngine, priceAnimator, indicatorController, drawingEngine, crosshairController);
    const renderLoop = new RenderLoop(renderPipeline, dataService);

    // 4. 互動橋接與事件
    const vpController = new ViewportController(viewport, scaleEngine, () => dataService.getLoader(), renderLoop.requestRedraw);
    
    // 修改橋接邏輯以傳遞正確的 width
    const onZoomHandler = (mX: number, mY: number, s: number, z: string) => 
        vpController.handleZoom(mX, s, z, renderEngine.getLogicalWidth());

    const interactionEngine = new InteractionEngine(
        renderEngine.getOverlayCanvas(), 
        (dX, dY, z) => vpController.handleScroll(dX, dY, z),
        onZoomHandler,
        (mX, mY) => crosshairController.update(mX, mY, dataService.getActiveManager(), renderLoop.requestRedraw)
    );

    (crosshairController as any).interactionEngine = interactionEngine; 

    const symbolController = new SymbolController(dataService.getCryptoManager(), dataService.getStockManager(), viewport, scaleEngine, infoDisplay, (m) => dataService.setActiveManager(m), renderLoop.requestRedraw);
    const drawingController = new DrawingController(interactionEngine, drawingEngine, viewport, scaleEngine, renderLoop.requestRedraw);
    
    // 5. UI 組件
    const tfController = new TimeframeController((tf) => { dataService.getActiveManager().setTimeframe(tf); scaleEngine.resetAutoScale(); }, renderLoop.requestRedraw);
    new SymbolModal((s, c) => symbolController.loadSymbol(s, c, tfController, dataService.getConnectionStatus()));
    new DrawingToolbar(interactionEngine, drawingEngine, renderLoop.requestRedraw, (t) => drawingController.startDrawing(t, dataService.getActiveManager()));
    new ScriptEditor(new PineScriptEngine(), () => dataService.getActiveManager(), renderLoop.requestRedraw);
    
    const editToolbar = new DrawingEditToolbar(drawingEngine, renderLoop.requestRedraw);
    const interactionCoordinator = new InteractionCoordinator(renderEngine.getOverlayCanvas(), interactionEngine, drawingEngine, editToolbar, viewport, scaleEngine);

    // 6. 啟動
    interactionEngine.setSnapProvider(magnetService.getSnapProvider(dataService.getActiveManager()));
    interactionCoordinator.init(() => dataService.getActiveManager());
    layoutController.init();
    dataService.getActiveManager().loadInitialData();
    renderLoop.start();
  }
}
