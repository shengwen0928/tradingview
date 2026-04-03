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
import { IndicatorModal } from '../ui/IndicatorModal';
import { TimeframeController } from '../ui/TimeframeController';
import { ChartTypeController } from '../ui/ChartTypeController';
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
    
    // 2. 核心服務 (解決循環依賴)
    const renderLoopProxy = { requestRedraw: () => {} };
    const viewport = new ViewportEngine(() => renderLoopProxy.requestRedraw(), renderEngine.getLogicalWidth());
    const dataService = new DataManagerService(viewport, infoDisplay, () => renderLoopProxy.requestRedraw());
    const magnetService = new MagnetService(viewport, scaleEngine);
    const indicatorController = new IndicatorController(new PineScriptEngine());
    const priceAnimator = new PriceAnimator();

    // 3. 控制器與渲染管線
    const crosshairController = new CrosshairController(viewport, scaleEngine, renderEngine, infoDisplay, drawingEngine);
    const renderPipeline = new RenderPipeline(viewport, scaleEngine, renderEngine, priceAnimator, indicatorController, drawingEngine, crosshairController);
    const renderLoop = new RenderLoop(renderPipeline, dataService);
    renderLoopProxy.requestRedraw = renderLoop.requestRedraw;

    const vpController = new ViewportController(viewport, scaleEngine, () => dataService.getLoader(), renderLoop.requestRedraw);
    const bridge = new InteractionBridge(vpController, crosshairController, dataService, renderLoop.requestRedraw);
    const handlers = bridge.getHandlers();

    // 4. 互動引擎
    const interactionEngine = new InteractionEngine(
        renderEngine.getOverlayCanvas(), 
        handlers.onScroll,
        (mX, _mY, s, z) => vpController.handleZoom(mX, s, z, renderEngine.getLogicalWidth()),
        handlers.onMouseMove
    );

    const layoutController = new LayoutController(renderEngine, scaleEngine, viewport, interactionEngine, () => renderLoop.requestRedraw());

    crosshairController.interactionEngine = interactionEngine; 

    const symbolController = new SymbolController(dataService.getCryptoManager(), dataService.getStockManager(), scaleEngine, infoDisplay, (m) => dataService.setActiveManager(m), renderLoop.requestRedraw);
    const drawingController = new DrawingController(interactionEngine, drawingEngine, viewport, scaleEngine, renderLoop.requestRedraw);
    
    // 5. UI 組件
    const tfController = new TimeframeController((tf) => { dataService.getActiveManager().setTimeframe(tf); scaleEngine.resetAutoScale(); }, renderLoop.requestRedraw);
    new ChartTypeController((type) => renderPipeline.setChartType(type), renderLoop.requestRedraw);
    new SymbolModal((s, c) => symbolController.loadSymbol(s, c, tfController, dataService.getConnectionStatus()));
    new IndicatorModal(new PineScriptEngine(), () => dataService.getActiveManager(), renderLoop.requestRedraw);
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
