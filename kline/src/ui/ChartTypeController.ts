import { ChartType } from '../types/Candle';

export class ChartTypeController {
  private currentType: ChartType = 'candles';
  private btn: HTMLElement;
  private popup: HTMLElement;
  private icon: HTMLElement;

  constructor(
    private onTypeChange: (type: ChartType) => void,
    private requestRedraw: () => void
  ) {
    this.btn = document.getElementById('chart-type-btn')!;
    this.popup = document.getElementById('chart-type-popup')!;
    this.icon = document.getElementById('current-chart-icon')!;
    this.init();
  }

  private init() {
    this.btn.onclick = (e) => {
      e.stopPropagation();
      const isShow = this.popup.classList.contains('show');
      
      // 先隱藏所有彈窗
      document.querySelectorAll('.menu-popup').forEach(p => p.classList.remove('show'));
      
      if (!isShow) {
        this.popup.classList.add('show');
      }
    };

    // 點擊外部關閉
    window.addEventListener('click', () => {
      this.popup.classList.remove('show');
    });

    // 綁定選項點擊
    this.popup.querySelectorAll('.menu-item').forEach(item => {
      (item as HTMLElement).onclick = () => {
        const type = item.getAttribute('data-type') as ChartType;
        this.setChartType(type);
      };
    });

    // 初始化第一個選項為 active
    this.updateActiveUI();
  }

  public setChartType(type: ChartType) {
    this.currentType = type;
    this.updateActiveUI();
    this.updateIcon(type);
    this.onTypeChange(type);
    this.requestRedraw();
  }

  private updateActiveUI() {
    this.popup.querySelectorAll('.menu-item').forEach(item => {
      if (item.getAttribute('data-type') === this.currentType) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  private updateIcon(type: ChartType) {
    let svgPath = '';
    switch (type) {
      case 'bars':
        svgPath = '<path d="M5 11v14M12 9v14M19 5v14M5 11h-2M12 9h-2M19 5h-2M5 25h2M12 23h2M19 19h2"/>';
        break;
      case 'candles':
        svgPath = '<path d="M19 5v14M12 9v14M5 11v14"/>';
        break;
      case 'hollow':
        svgPath = '<rect x="5" y="11" width="2" height="10"/><rect x="11" y="7" width="2" height="14"/><rect x="17" y="3" width="2" height="18"/>';
        break;
      case 'volume_candles':
        svgPath = '<rect x="4" y="10" width="4" height="12" fill="currentColor"/><rect x="11" y="6" width="2" height="16"/><rect x="16" y="2" width="6" height="20" fill="currentColor"/>';
        break;
      case 'line':
        svgPath = '<path d="M3 17l6-6 4 4 8-8"/>';
        break;
      case 'line_with_markers':
        svgPath = '<path d="M3 17l6-6 4 4 8-8"/><circle cx="3" cy="17" r="2" fill="currentColor"/><circle cx="9" cy="11" r="2" fill="currentColor"/><circle cx="13" cy="15" r="2" fill="currentColor"/><circle cx="21" cy="7" r="2" fill="currentColor"/>';
        break;
      case 'step_line':
        svgPath = '<path d="M3 17h6v-6h4v4h8"/>';
        break;
      case 'area':
        svgPath = '<path d="M3 17l6-6 4 4 8-8v10H3z"/>';
        break;
      case 'hlc_area':
        svgPath = '<path d="M3 15l6-4 4 4 8-8v6l-8 8-4-4-6 4z" fill="currentColor" fill-opacity="0.2"/>';
        break;
      case 'baseline':
        svgPath = '<path d="M3 12h18M3 17l6-6 4 4 8-8"/>';
        break;
      case 'columns':
        svgPath = '<rect x="4" y="12" width="3" height="10"/><rect x="10" y="8" width="3" height="14"/><rect x="16" y="4" width="3" height="18"/>';
        break;
      case 'high_low':
        svgPath = '<path d="M7 5v14M17 9v14M7 5h2M7 19h2M17 9h2M17 23h2"/>';
        break;
      case 'heikin_ashi':
        svgPath = '<path d="M5 15l7-7 7 7"/>';
        break;
      default:
        svgPath = '<path d="M19 5v14M12 9v14M5 11v14"/>'; // 預設使用 K 線圖示
        break;
    }
    this.icon.innerHTML = svgPath;
  }
}
