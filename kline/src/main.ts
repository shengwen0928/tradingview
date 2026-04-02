import { ViewportEngine } from './core/ViewportEngine';
import { ScaleEngine } from './core/ScaleEngine';
import { RenderEngine } from './core/RenderEngine';
import { InteractionEngine } from './core/InteractionEngine';
import { PineScriptEngine } from './core/PineScriptEngine';
import { DrawingEngine } from './core/DrawingEngine';
import { SymbolController } from './core/SymbolController';
import { DrawingController } from './core/DrawingController';
import { MagnetService } from './core/MagnetService';
import { CrosshairController } from './core/CrosshairController';
import { PriceAnimator } from './core/PriceAnimator';
import { IndicatorController } from './core/IndicatorController';
import { InteractionCoordinator } from './core/InteractionCoordinator';
import { ViewportController } from './core/ViewportController';
import { DataManagerService } from './core/DataManagerService';
import { RenderPipeline } from './core/RenderPipeline';
import { LayoutController } from './core/LayoutController';
import { APP_CONFIG } from './constants/AppConfig';

// UI Components
import { SymbolModal } from './ui/SymbolModal';
import { TimeframeController } from './ui/TimeframeController';
import { DrawingToolbar } from './ui/DrawingToolbar';
import { ScriptEditor } from './ui/ScriptEditor';
import { InfoDisplay } from './ui/InfoDisplay';
import { DrawingEditToolbar } from './ui/DrawingEditToolbar';
import { injectStyles } from './ui/Styles';

class ChartEngine {
  private viewport!: ViewportEngine;
  private scaleEngine!: ScaleEngine;
  private renderEngine!: RenderEngine;
  private interactionEngine!: InteractionEngine;
  private dataService!: DataManagerService;
  private renderPipeline!: RenderPipeline;
  private vpController!: ViewportController;
  private layoutController!: LayoutController;
  private symbolController!: SymbolController;
  private drawingController!: DrawingController;
  private magnetService!: MagnetService;
  private crosshairController!: CrosshairController;
  private interactionCoordinator!: InteractionCoordinator;
  
  private symbolModal!: SymbolModal;
  private tfController!: TimeframeController;
  private drawingToolbar!: DrawingToolbar;
  private scriptEditor!: ScriptEditor;
  private infoDisplay!: InfoDisplay;

  constructor() {
    injectStyles();
    
    // 1. 初始化基礎引擎
    this.renderEngine = new RenderEngine(
      document.getElementById(APP_CONFIG.DOM_IDS.GRID_CANVAS) as HTMLCanvasElement, 
      document.getElementById(APP_CONFIG.DOM_IDS.CANDLE_CANVAS) as HTMLCanvasElement, 
      document.getElementById(APP_CONFIG.DOM_IDS.OVERLAY_CANVAS) as HTMLCanvasElement
    );
    this.scaleEngine = new ScaleEngine();
    this.viewport = new ViewportEngine(() => this.requestRedraw());
    this.drawingEngine = new DrawingEngine();
    this.infoDisplay = new InfoDisplay();

    // 2. 初始化核心服務
    this.dataService = new DataManagerService(this.viewport, this.infoDisplay, () => this.requestRedraw());
    this.magnetService = new MagnetService(this.viewport, this.scaleEngine);
    this.layoutController = new LayoutController(this.renderEngine, this.scaleEngine, () => this.requestRedraw());

    this.initControllers();
    this.initInteraction();
    this.initPipeline();
    
    // 3. 啟動
    this.layoutController.init();
    this.dataService.getActiveManager().loadInitialData();
  }

  private initControllers() {
    const active = () => this.dataService.getActiveManager();
    const loader = () => this.dataService.getLoader();

    this.vpController = new ViewportController(this.viewport, this.scaleEngine, loader, () => this.requestRedraw());
    
    this.symbolController = new SymbolController(
        this.dataService.getCryptoManager(), this.dataService.getStockManager(), 
        this.viewport, this.scaleEngine, this.infoDisplay,
        (m) => this.dataService.setActiveManager(m),
        () => this.requestRedraw()
    );

    this.tfController = new TimeframeController((tf) => { active().setTimeframe(tf); this.scaleEngine.resetAutoScale(); }, () => this.requestRedraw());
    this.symbolModal = new SymbolModal((s, c) => this.symbolController.loadSymbol(s, c, this.tfController, this.dataService.getConnectionStatus()));
    
    this.interactionEngine = new InteractionEngine(this.renderEngine.getOverlayCanvas(), 
        (dX, dY, z) => this.vpController.handleScroll(dX, dY, z),
        (mX, mY, s, z) => this.vpController.handleZoom(mX, s, z, this.renderEngine.getLogicalWidth()),
        (mX, mY) => this.crosshairController.update(mX, mY, active(), () => this.requestRedraw())
    );

    this.drawingController = new DrawingController(this.interactionEngine, this.drawingEngine, this.viewport, this.scaleEngine, () => this.requestRedraw());
    this.drawingToolbar = new DrawingToolbar(this.interactionEngine, this.drawingEngine, () => this.requestRedraw(), (tool) => this.drawingController.startDrawing(tool, active()));
    
    const editToolbar = new DrawingEditToolbar(this.drawingEngine, () => this.requestRedraw());
    this.interactionCoordinator = new InteractionCoordinator(this.renderEngine.getOverlayCanvas(), this.interactionEngine, this.drawingEngine, editToolbar, this.viewport, this.scaleEngine);
    this.crosshairController = new CrosshairController(this.viewport, this.scaleEngine, this.renderEngine, this.infoDisplay, this.drawingEngine, this.interactionEngine);
    
    this.scriptEditor = new ScriptEditor(new PineScriptEngine(), active, () => this.requestRedraw());
  }

  private initInteraction() {
    this.interactionEngine.setSnapProvider(this.magnetService.getSnapProvider(this.dataService.getActiveManager()));
    this.interactionCoordinator.init(() => this.dataService.getActiveManager());
  }

  private initPipeline() {
    this.renderPipeline = new RenderPipeline(
        this.viewport, this.scaleEngine, this.renderEngine, 
        new PriceAnimator(), new IndicatorController(new PineScriptEngine()), 
        this.drawingEngine, this.crosshairController
    );
  }

  private requestRedraw() { requestAnimationFrame(() => this.draw()); }

  private draw() {
    this.renderPipeline.execute(this.dataService.getActiveManager(), () => this.requestRedraw());
  }
}

window.onload = () => { new ChartEngine(); };
