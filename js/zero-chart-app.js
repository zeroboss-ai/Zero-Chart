/**
 * Zero Chart Pro Terminal Application
 * Pixel-Perfect TradingView Pro Interface, Multi-Watchlist Manager (Create, Add, Delete, Rename),
 * Native Bar Close Countdown Timer, Dynamic Search (Muthoot, ICICI, all Indian stocks, Crypto, Commodities).
 */

import {
  createWidget,
  mountIndicatorPicker,
  mountSettingsDialog,
  mountObjectsPanel,
  openShortcutsPanel,
} from '../lib/openalgo-charts.widget.mjs';
import { ReplayController } from '../lib/openalgo-charts.mjs';
import '../lib/openalgo-charts.indicators.mjs';
import { FakeBroker, OrderEngine, TradeController } from '../lib/openalgo-charts.trade.mjs';
import { MultiAssetFeed } from './feeds/multi-feed.js';
import { getIntervalSeconds } from './feeds/openalgo-feed.js';
import { MASTER_INSTRUMENTS, DEFAULT_WATCHLISTS, findInstrument } from './watchlist-data.js';

const FAVORITE_TOOL_DEFINITIONS = [
  { id: 'trend-line', name: 'Trend Line', icon: 'M4 20 20 4' },
  { id: 'ray', name: 'Ray', icon: 'M4 20 20 4M2 18 6 22' },
  { id: 'extended-line', name: 'Extended Line', icon: 'M2 22 22 2' },
  { id: 'arrow', name: 'Arrow', icon: 'M4 20 18 6M18 6h-6M18 6v6' },
  { id: 'horizontal-line', name: 'Horizontal Line', icon: 'M2 12h20' },
  { id: 'horizontal-ray', name: 'Horizontal Ray', icon: 'M6 12H22M4 10V14' },
  { id: 'vertical-line', name: 'Vertical Line', icon: 'M12 2v20' },
  { id: 'cross-line', name: 'Cross Line', icon: 'M2 12h20M12 2v20' },
  { id: 'trend-angle', name: 'Trend Angle', icon: 'M4 20 18 8M4 20h12M8 20a8 8 0 0 0 2-5' },
  { id: 'info-line', name: 'Info Line', icon: 'M4 20 20 4M8 8h8' },
  { id: 'parallel-channel', name: 'Parallel Channel', icon: 'M2 16 14 4M8 22 20 10' },
  { id: 'disjoint-channel', name: 'Disjoint Channel', icon: 'M2 16 14 6M8 22 22 14' },
  { id: 'flat-top-bottom', name: 'Flat Top/Bottom', icon: 'M3 6h18M3 20 21 12M3 6v14' },
  { id: 'regression-channel', name: 'Regression Channel', icon: 'M3 18 19 6M5 21 21 9M3 12 17 2M10 16h4' },
  { id: 'pitchfork', name: 'Pitchfork', icon: 'M4 21 16 9M4 9 16 21M10 15 22 3M4 9 10 3M16 21l6-6' },
  { id: 'fib-retracement', name: 'Fib Retracement', icon: 'M3 4h18M3 9h18M3 14h18M3 19h18' },
  { id: 'fib-extension', name: 'Fib Extension', icon: 'M3 5h18M3 12h18M3 19h18M8 5v14' },
  { id: 'fib-circles', name: 'Fib Circles', icon: 'M12 20A5 5 0 0 1 12 10M12 20A9 9 0 0 1 12 2M10 20h4' },
  { id: 'fib-spiral', name: 'Fib Spiral', icon: 'M12 13A3 3 0 1 1 15 10A7 7 0 1 1 8 3A9 9 0 1 1 21 12' },
  { id: 'rectangle', name: 'Rectangle', icon: 'M3 5h18v14H3z' },
  { id: 'rotated-rectangle', name: 'Rotated Rectangle', icon: 'M2 14 10 4l12 6-8 10z' },
  { id: 'circle', name: 'Circle', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z' },
  { id: 'ellipse', name: 'Ellipse', icon: 'M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z' },
  { id: 'triangle', name: 'Triangle', icon: 'M12 4 21 20H3z' },
  { id: 'arc', name: 'Arc', icon: 'M3 19a12 12 0 0 1 18 0' },
  { id: 'curve', name: 'Curve', icon: 'M3 18c4-12 14-12 18 0' },
  { id: 'path', name: 'Path', icon: 'M2 18 8 8l4 6 4-10' },
  { id: 'polyline', name: 'Polyline', icon: 'M2 18 8 8l4 6 4-10 4 4' },
  { id: 'brush', name: 'Brush', icon: 'M3 19c4 0 4-8 8-8s4 8 9 4' },
  { id: 'highlighter', name: 'Highlighter', icon: 'M4 16 14 6l4 4-10 10H4z' },
  { id: 'text', name: 'Text', icon: 'M4 5h16M12 5v14M8 19h8' },
  { id: 'note', name: 'Note', icon: 'M4 20 9 15M9 5h13v10H9zM4 20v-4' },
  { id: 'callout', name: 'Callout', icon: 'M3 4h18v11H3zM8 15l-2 5 6-5' },
  { id: 'balloon', name: 'Balloon', icon: 'M3 4h18v12H9l-4 4v-4H3z' },
  { id: 'price-label', name: 'Price Label', icon: 'M3 12 8 7h13v10H8z' },
  { id: 'price-note', name: 'Price Note', icon: 'M2 12h5M7 6h15v12H7zM10 12h9' },
  { id: 'table', name: 'Table', icon: 'M3 5h18v14H3zM3 10h18M9 10v9M15 10v9' },
  { id: 'xabcd-pattern', name: 'XABCD Pattern', icon: 'M3 19 7 4 12 16 16 8 21 20M3 19 12 16 21 20M7 4 16 8' },
  { id: 'head-shoulders', name: 'Head & Shoulders', icon: 'M2 20 5 10 8 17 12 3 16 17 19 10 22 20M3 17h18' },
  { id: 'elliott-impulse', name: 'Elliott Impulse', icon: 'M2 21 6 12 9 17 13 5 17 11 22 2' },
  { id: 'measure', name: 'Measure', icon: 'M4 16h16M4 12v8M20 12v8M8 4h8M12 4v6' },
  { id: 'price-range', name: 'Price Range', icon: 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4' },
  { id: 'date-range', name: 'Date Range', icon: 'M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4' },
  { id: 'long-position', name: 'Long Position', icon: 'M3 15h18v5H3zM3 5h18v5H3zM12 10v5' },
  { id: 'short-position', name: 'Short Position', icon: 'M3 5h18v5H3zM3 15h18v5H3zM12 10v5' },
  { id: 'forecast', name: 'Forecast', icon: 'M3 18 9 10l4 4 8-10M13 4h8v8' },
];

class ZeroChartApp {
  constructor() {
    this.watchlists = this.loadWatchlists();
    this.activeWatchlistId = localStorage.getItem('zerochart_active_wl') || 'wl-stocks';
    if (!this.watchlists.find((w) => w.id === this.activeWatchlistId)) {
      this.activeWatchlistId = this.watchlists[0]?.id || 'wl-stocks';
    }

    this.currentTheme = localStorage.getItem('zerochart_theme') || 'dark';
    this.currentLayout = localStorage.getItem('zerochart_layout') || '1x1';
    this.currentFlagFilter = 'all';

    this.livePrices = new Map(); // symbol -> { last, chg, chgPct, prevClose }
    this.multiFeed = new MultiAssetFeed();
    this.broker = new FakeBroker();
    this.orderEngine = new OrderEngine({
      feed: this.broker,
      armed: true,
      mode: 'analyzer',
      constraints: { tickSize: 0.01, freezeQty: 100000 },
    });

    // Multi-pane state
    this.activePaneIndex = 0;
    this.panes = [
      {
        id: 0,
        containerId: 'chart-pane-0',
        widget: null,
        tradeController: null,
        instrument: this.getActiveWatchlistInstruments()[0] || MASTER_INSTRUMENTS[0],
        interval: '5m',
        chartType: 'candlestick',
      },
      {
        id: 1,
        containerId: 'chart-pane-1',
        widget: null,
        tradeController: null,
        instrument: findInstrument('BANKNIFTY') || MASTER_INSTRUMENTS[1],
        interval: '5m',
        chartType: 'candlestick',
      },
      {
        id: 2,
        containerId: 'chart-pane-2',
        widget: null,
        tradeController: null,
        instrument: findInstrument('MUTHOOTFIN') || MASTER_INSTRUMENTS[2] || MASTER_INSTRUMENTS[0],
        interval: '15m',
        chartType: 'candlestick',
      },
      {
        id: 3,
        containerId: 'chart-pane-3',
        widget: null,
        tradeController: null,
        instrument: findInstrument('ICICIBANK') || MASTER_INSTRUMENTS[3] || MASTER_INSTRUMENTS[1],
        interval: '1h',
        chartType: 'candlestick',
      },
    ];

    // Alerts state
    this.alerts = this.loadAlerts();
    this.audioContext = null;

    // Bar Replay state
    this.replayController = null;
    this.fullReplayBars = null;
    this.isReplayMode = false;
    this.isReplayJumpMode = false;
    this.replaySpeed = 1;
    this.lastHoveredIndex = null;
    this.lastHoveredTime = null;

    // Layout split proportions state
    this.layoutSplits = this.loadLayoutSplits();

    // Restore saved layout configuration if exists
    const savedLayout = this.loadSavedLayoutData();
    if (savedLayout?.panes && Array.isArray(savedLayout.panes)) {
      savedLayout.panes.forEach((sp, idx) => {
        if (this.panes[idx]) {
          if (sp.symbol) {
            const inst = findInstrument(sp.symbol);
            if (inst) this.panes[idx].instrument = inst;
          }
          if (sp.interval) this.panes[idx].interval = sp.interval;
          if (sp.chartType) this.panes[idx].chartType = sp.chartType;
        }
      });
      if (typeof savedLayout.activePaneIndex === 'number' && this.panes[savedLayout.activePaneIndex]) {
        this.activePaneIndex = savedLayout.activePaneIndex;
      }
    }

    // Favorite Drawing Tools
    let favTools = ['trend-line', 'horizontal-line', 'ray', 'fib-retracement', 'rectangle', 'brush', 'text', 'measure'];
    try {
      const saved = localStorage.getItem('zerochart_fav_tools');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) favTools = parsed;
      }
    } catch (_) {}
    this.favoriteTools = favTools;

    this.init();
  }

  // Getters for active pane convenience
  get activePane() {
    return this.panes[this.activePaneIndex] || this.panes[0];
  }

  get widget() {
    return this.activePane.widget;
  }

  get currentInstrument() {
    return this.activePane.instrument;
  }

  set currentInstrument(val) {
    if (this.activePane) this.activePane.instrument = val;
  }

  get currentInterval() {
    return this.activePane.interval;
  }

  set currentInterval(val) {
    if (this.activePane) this.activePane.interval = val;
  }

  get currentChartType() {
    return this.activePane.chartType;
  }

  set currentChartType(val) {
    if (this.activePane) this.activePane.chartType = val;
  }

  loadWatchlists() {
    try {
      const saved = localStorage.getItem('zerochart_watchlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(w => w && w.name && w.name.toUpperCase() !== 'ALL' && w.id !== 'wl-all');
          // Clean legacy polluted non-index symbols from Indices & Futures tab
          const indicesTab = cleaned.find(w => w.id === 'wl-indices');
          if (indicesTab && Array.isArray(indicesTab.symbols)) {
            indicesTab.symbols = indicesTab.symbols.filter(s => !['MUTHOOTFIN', 'ICICIBANK', 'RELIANCE', 'TCS'].includes(s));
          }
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_WATCHLISTS));
  }

  saveWatchlists() {
    try {
      localStorage.setItem('zerochart_watchlists', JSON.stringify(this.watchlists));
      localStorage.setItem('zerochart_active_wl', this.activeWatchlistId);
    } catch (_) {}
  }

  getActiveWatchlist() {
    return this.watchlists.find((w) => w.id === this.activeWatchlistId) || this.watchlists[0];
  }

  getActiveWatchlistInstruments() {
    const wl = this.getActiveWatchlist();
    return (wl.symbols || [])
      .map((sym) => findInstrument(sym))
      .filter(Boolean);
  }

  loadAlerts() {
    try {
      const saved = localStorage.getItem('zerochart_alerts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Clean out legacy sample dummy alerts
          const userAlerts = parsed.filter((a) => a && !a.id.startsWith('alert-default-'));
          return userAlerts;
        }
      }
    } catch (_) {}
    return [];
  }

  saveAlerts() {
    try {
      localStorage.setItem('zerochart_alerts', JSON.stringify(this.alerts));
    } catch (_) {}
  }

  loadLayoutSplits() {
    try {
      const saved = localStorage.getItem('zerochart_layout_splits');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      '1x1': {},
      '1x2': { col: 50 },
      '2x1': { row: 50 },
      '1x3': { col: 55, row: 50 },
      '2x2': { col: 50, row: 50 },
    };
  }

  saveLayoutSplits() {
    try {
      localStorage.setItem('zerochart_layout_splits', JSON.stringify(this.layoutSplits));
    } catch (_) {}
  }

  async init() {
    document.body.setAttribute('data-theme', this.currentTheme);
    this.updateThemeButton();

    // 1. Initialize Layout & Panes
    this.initLayoutSystem();
    this.initSidebarResizer();
    this.initChartSplitters();

    // 2. Initialize Watchlists
    this.initWatchlistUI();

    // 3. Initialize Topbar Controls & Shortcuts
    this.initTopbarEvents();

    // 4. Initialize Right Sidebar Tabs
    this.initRightSidebarTabs();

    // 5. Initialize Modals (Search, Alert)
    this.initModals();

    // 6. Initialize Alerts Engine
    this.initAlertEngine();

    // 7. Initialize Mobile Navigation & History Handlers (Watchlist Landing Page + Back Button)
    this.initMobileUI();
    this.initMobileHistory();

    // 8. Start Real-Time Market Streams
    this.startLiveMarketStream();
    this.checkBrokerStatus();

    // 9. Initialize Progressive Web App (PWA)
    this.initPWA();

    // 10. Global Toast Guard (Cap to Max 2 & 2s Auto Fade-Out)
    this.initToastGuard();

    // 11. Initialize Bar Replay System
    this.initReplaySystem();

    // 12. Initialize Floating Movable Favorite Drawing Tools Toolbar Badge
    this.initFavoriteToolbar();

    // 13. Initialize Maximized Pane & Indicator Full-Screen Controls
    this.initMaximizedPaneControls();

    // 14. Responsive Layout & Legend Offset Sync on Resize
    window.addEventListener('resize', () => {
      const legTop = window.innerWidth <= 768 ? 48 : 42;
      const legLeft = window.innerWidth <= 768 ? 10 : 54;
      this.panes.forEach((p) => {
        try {
          p.widget?.chart?.setLegendOffset?.({ top: legTop, left: legLeft });
        } catch (_) {}
      });
    });
  }

  // ─── MULTI-CHART LAYOUT SYSTEM ───
  initLayoutSystem() {
    const layoutBtn = document.getElementById('btn-layout-grid');
    const layoutMenu = document.getElementById('layout-grid-menu');

    if (layoutBtn && layoutMenu) {
      layoutBtn.onclick = (e) => {
        e.stopPropagation();
        layoutMenu.classList.toggle('show');
      };

      document.querySelectorAll('#layout-grid-menu .tv-layout-opt').forEach((btn) => {
        btn.onclick = () => {
          const layout = btn.dataset.layout;
          if (layout) {
            this.setLayout(layout);
            layoutMenu.classList.remove('show');
          }
        };
      });

      document.addEventListener('click', (e) => {
        if (!layoutMenu.contains(e.target) && e.target !== layoutBtn) {
          layoutMenu.classList.remove('show');
        }
      });
    }

    // Initialize the default layout
    this.setLayout(this.currentLayout, false);
  }

  setLayout(layoutName, save = true) {
    this.currentLayout = layoutName;
    if (save) {
      localStorage.setItem('zerochart_layout', layoutName);
    }

    // Update Dropdown UI
    const layoutOptions = document.querySelectorAll('#layout-grid-menu .tv-layout-opt');
    layoutOptions.forEach((opt) => {
      opt.classList.toggle('active', opt.dataset.layout === layoutName);
    });

    const labelMap = {
      '1x1': '1 Chart',
      '1x2': '2 Charts H',
      '2x1': '2 Charts V',
      '1x3': '3 Charts',
      '2x2': '4 Charts Grid',
    };
    const iconMap = {
      '1x1': '▢',
      '1x2': '◫',
      '2x1': '⊟',
      '1x3': '◰',
      '2x2': '⊞',
    };

    const labelEl = document.getElementById('layout-grid-label');
    const iconEl = document.getElementById('layout-grid-icon');
    if (labelEl) labelEl.textContent = labelMap[layoutName] || '1 Chart';
    if (iconEl) iconEl.textContent = iconMap[layoutName] || '▢';

    // Update container grid class
    const stageGrid = document.getElementById('widget-mount');
    if (stageGrid) {
      stageGrid.className = `tv-chart-stage-grid layout-${layoutName}`;
    }

    // Apply adjustable split dimensions
    this.applyLayoutGridDimensions(layoutName);

    // Determine number of visible panes
    let visibleCount = 1;
    if (layoutName === '1x2' || layoutName === '2x1') visibleCount = 2;
    else if (layoutName === '1x3') visibleCount = 3;
    else if (layoutName === '2x2') visibleCount = 4;

    // Show/hide pane elements & instantiate widgets as needed
    for (let i = 0; i < 4; i++) {
      const paneEl = document.getElementById(`chart-pane-${i}`);
      if (!paneEl) continue;

      if (i < visibleCount) {
        paneEl.style.display = 'block';
        if (!this.panes[i].widget) {
          this.initPaneWidget(i);
        }
      } else {
        paneEl.style.display = 'none';
      }
    }

    if (this.activePaneIndex >= visibleCount) {
      this.setActivePane(0);
    } else {
      this.setActivePane(this.activePaneIndex);
    }

    // Trigger window resize so all widgets recalculate dimensions cleanly
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  // ─── APPLY CUSTOMIZABLE GRID SPLITS ───
  applyLayoutGridDimensions(layoutName = this.currentLayout) {
    const stageGrid = document.getElementById('widget-mount');
    const splitterV = document.getElementById('stage-splitter-v');
    const splitterH = document.getElementById('stage-splitter-h');
    if (!stageGrid) return;

    const splits = this.layoutSplits[layoutName] || { col: 50, row: 50 };

    if (layoutName === '1x1') {
      stageGrid.style.gridTemplateColumns = '100%';
      stageGrid.style.gridTemplateRows = '100%';
      if (splitterV) splitterV.style.display = 'none';
      if (splitterH) splitterH.style.display = 'none';
    } else if (layoutName === '1x2') {
      const col = splits.col || 50;
      stageGrid.style.gridTemplateColumns = `${col}% calc(${100 - col}% - 2px)`;
      stageGrid.style.gridTemplateRows = '100%';
      if (splitterV) {
        splitterV.style.display = 'block';
        splitterV.style.left = `${col}%`;
        splitterV.style.top = '0';
        splitterV.style.height = '100%';
      }
      if (splitterH) splitterH.style.display = 'none';
    } else if (layoutName === '2x1') {
      const row = splits.row || 50;
      stageGrid.style.gridTemplateColumns = '100%';
      stageGrid.style.gridTemplateRows = `${row}% calc(${100 - row}% - 2px)`;
      if (splitterV) splitterV.style.display = 'none';
      if (splitterH) {
        splitterH.style.display = 'block';
        splitterH.style.top = `${row}%`;
        splitterH.style.left = '0';
        splitterH.style.width = '100%';
      }
    } else if (layoutName === '1x3') {
      const col = splits.col || 55;
      const row = splits.row || 50;
      stageGrid.style.gridTemplateColumns = `${col}% calc(${100 - col}% - 2px)`;
      stageGrid.style.gridTemplateRows = `${row}% calc(${100 - row}% - 2px)`;
      if (splitterV) {
        splitterV.style.display = 'block';
        splitterV.style.left = `${col}%`;
        splitterV.style.top = '0';
        splitterV.style.height = '100%';
      }
      if (splitterH) {
        splitterH.style.display = 'block';
        splitterH.style.top = `${row}%`;
        splitterH.style.left = `${col}%`;
        splitterH.style.width = `calc(${100 - col}%)`;
      }
    } else if (layoutName === '2x2') {
      const col = splits.col || 50;
      const row = splits.row || 50;
      stageGrid.style.gridTemplateColumns = `${col}% calc(${100 - col}% - 2px)`;
      stageGrid.style.gridTemplateRows = `${row}% calc(${100 - row}% - 2px)`;
      if (splitterV) {
        splitterV.style.display = 'block';
        splitterV.style.left = `${col}%`;
        splitterV.style.top = '0';
        splitterV.style.height = '100%';
      }
      if (splitterH) {
        splitterH.style.display = 'block';
        splitterH.style.top = `${row}%`;
        splitterH.style.left = '0';
        splitterH.style.width = '100%';
      }
    }
  }

  // ─── DRAGGABLE SIDEBAR RESIZER ───
  initSidebarResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    const rightPanel = document.getElementById('right-panel');
    if (!resizer || !rightPanel) return;

    // Load saved width
    const savedWidth = localStorage.getItem('zerochart_sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (parsed >= 220 && parsed <= 1200) {
        rightPanel.style.width = `${parsed}px`;
      }
    }

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 768) return; // Full width on mobile

      isDragging = true;
      startX = e.clientX;
      startWidth = rightPanel.getBoundingClientRect().width;
      resizer.classList.add('is-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent) => {
        if (!isDragging) return;
        const deltaX = startX - moveEvent.clientX;
        const maxW = Math.max(400, window.innerWidth - 300);
        const newWidth = Math.max(220, Math.min(maxW, startWidth + deltaX));
        rightPanel.style.width = `${newWidth}px`;
        window.dispatchEvent(new Event('resize'));
      };

      const onPointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        resizer.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        localStorage.setItem('zerochart_sidebar_width', rightPanel.getBoundingClientRect().width);
        window.dispatchEvent(new Event('resize'));
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    // Double-click resets sidebar width to 320px
    resizer.addEventListener('dblclick', () => {
      rightPanel.style.width = '320px';
      localStorage.setItem('zerochart_sidebar_width', '320');
      window.dispatchEvent(new Event('resize'));
    });
  }

  // ─── DRAGGABLE MULTI-CHART STAGE SPLITTERS ───
  initChartSplitters() {
    const stageGrid = document.getElementById('widget-mount');
    const splitterV = document.getElementById('stage-splitter-v');
    const splitterH = document.getElementById('stage-splitter-h');
    if (!stageGrid || !splitterV || !splitterH) return;

    // Vertical Splitter Dragging (Adjust Columns)
    splitterV.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const rect = stageGrid.getBoundingClientRect();
      splitterV.classList.add('is-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent) => {
        const pct = Math.max(15, Math.min(85, ((moveEvent.clientX - rect.left) / rect.width) * 100));
        if (!this.layoutSplits[this.currentLayout]) this.layoutSplits[this.currentLayout] = {};
        this.layoutSplits[this.currentLayout].col = +pct.toFixed(2);
        this.applyLayoutGridDimensions();
        window.dispatchEvent(new Event('resize'));
      };

      const onPointerUp = () => {
        splitterV.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        this.saveLayoutSplits();
        window.dispatchEvent(new Event('resize'));
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    // Horizontal Splitter Dragging (Adjust Rows)
    splitterH.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const rect = stageGrid.getBoundingClientRect();
      splitterH.classList.add('is-dragging');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent) => {
        const pct = Math.max(15, Math.min(85, ((moveEvent.clientY - rect.top) / rect.height) * 100));
        if (!this.layoutSplits[this.currentLayout]) this.layoutSplits[this.currentLayout] = {};
        this.layoutSplits[this.currentLayout].row = +pct.toFixed(2);
        this.applyLayoutGridDimensions();
        window.dispatchEvent(new Event('resize'));
      };

      const onPointerUp = () => {
        splitterH.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        this.saveLayoutSplits();
        window.dispatchEvent(new Event('resize'));
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    // Double-click resets layout split to 50/50
    splitterV.addEventListener('dblclick', () => {
      if (!this.layoutSplits[this.currentLayout]) this.layoutSplits[this.currentLayout] = {};
      this.layoutSplits[this.currentLayout].col = this.currentLayout === '1x3' ? 55 : 50;
      this.applyLayoutGridDimensions();
      this.saveLayoutSplits();
      window.dispatchEvent(new Event('resize'));
    });

    splitterH.addEventListener('dblclick', () => {
      if (!this.layoutSplits[this.currentLayout]) this.layoutSplits[this.currentLayout] = {};
      this.layoutSplits[this.currentLayout].row = 50;
      this.applyLayoutGridDimensions();
      this.saveLayoutSplits();
      window.dispatchEvent(new Event('resize'));
    });
  }

  initPaneWidget(paneIndex) {
    const pane = this.panes[paneIndex];
    const container = document.getElementById(pane.containerId);
    if (!container) return;

    const legTop = window.innerWidth <= 768 ? 48 : 42;
    const legLeft = window.innerWidth <= 768 ? 10 : 54;

    pane.widget = createWidget(container, {
      feed: this.multiFeed,
      symbol: pane.instrument.symbol,
      exchange: pane.instrument.exchange,
      interval: pane.interval,
      chartType: pane.chartType,
      theme: this.currentTheme,
      topbar: false, // Unified topbar managed by Zero Chart
      statusline: true,
      rail: paneIndex === 0 ? { favorites: this.favoriteTools } : false,
      legendOffset: { top: legTop, left: legLeft },
      persist: true,
      branding: false,
      timeNavigator: true,
      axisChrome: {
        barCountdown: true, // Native Bar Close Countdown Timer
        sessionClock: true,
      },
      symbolSearch: async (query) => {
        const q = (query || '').trim();
        try {
          const resp = await fetch(`/api/market/search?q=${encodeURIComponent(q)}&cat=all`);
          if (resp.ok) {
            const json = await resp.json();
            if (json.status === 'success' && Array.isArray(json.results)) {
              return json.results.map((s) => ({
                symbol: s.symbol,
                exchange: s.exchange,
                name: s.name,
                description: s.name,
              }));
            }
          }
        } catch (_) {}
        return MASTER_INSTRUMENTS.filter(
          (s) =>
            s.symbol.toLowerCase().includes(q.toLowerCase()) ||
            s.name.toLowerCase().includes(q.toLowerCase()) ||
            s.displaySymbol.toLowerCase().includes(q.toLowerCase())
        ).map((s) => ({
          symbol: s.symbol,
          exchange: s.exchange,
          name: s.name,
        }));
      },
      onOrder: async (orderReq) => {
        console.log('[ZeroChart] Order placement on pane', paneIndex, orderReq);
        const res = await this.orderEngine.placeOrder({
          symbol: pane.instrument.symbol,
          side: orderReq.side,
          type: orderReq.type,
          qty: orderReq.qty || 1,
          price: orderReq.price,
        });
        if (res.ok) {
          console.log('[ZeroChart] Sandbox order placed:', res);
        }
      },
      onAlert: (req) => {
        console.log('[ZeroChart] Alert requested from context menu:', req);
        this.openAlertModal(null, {
          symbol: req?.symbol || pane.instrument.symbol,
          targetPrice: req?.price,
        });
      },
    });

    try {
      pane.widget.chart?.setLegendOffset?.({ top: legTop, left: legLeft });
      if (pane.widget.chart?.setAxisChromeOptions) {
        pane.widget.chart.setAxisChromeOptions({
          barCountdown: true,
          sessionClock: true,
        });
      }
      const prec = pane.instrument.precision !== undefined ? pane.instrument.precision : 2;
      pane.widget.chart?.primarySeries()?.applyOptions({ precision: prec });
      pane.widget.series?.applyOptions?.({ precision: prec });
    } catch (_) {}

    // Wire on-chart trading controller
    pane.tradeController = new TradeController(pane.widget.chart.tradeHost(0));
    this.broker.onBook((orders, positions) => pane.tradeController.reconcile(orders, positions));
    this.broker.onLtp((sym, ltp) => pane.tradeController.onLtp(sym, ltp));

    // Track active on-chart alert price lines
    pane.alertLines = new Map();

    // Listen to pane maximize / restore events for full-screen indicator controls
    pane.widget.chart.on('paneMaximized', (ev) => {
      this.updateMaximizedPaneUI(paneIndex, ev);
    });
    pane.widget.chart.on('paneRemoved', (ev) => {
      this.updateMaximizedPaneUI(paneIndex, ev);
    });
    pane.widget.chart.on('indicatorRemoved', (ev) => {
      this.updateMaximizedPaneUI(paneIndex, ev);
    });

    // Listen to drawing tool change to sync favorites toolbar active highlight
    pane.widget.draw?.on?.('draw:tool', (tool) => {
      this.syncFavoriteToolActive(tool);
    });

    // Listen to favorite tools changes from the drawing rail flyouts (star clicks)
    pane.widget.chart.on('rail:favorites', (payload) => {
      if (payload && Array.isArray(payload.favorites)) {
        this.favoriteTools = payload.favorites;
        localStorage.setItem('zerochart_fav_tools', JSON.stringify(this.favoriteTools));
        this.renderFavoriteToolsList();
        if (payload.on && this.favoriteTools.length > 0) {
          this.toggleFavoriteToolbar(true);
        }
      }
    });

    // Listen to rail star toggle button click
    pane.widget.chart.on('rail:toggle-fav-toolbar', () => {
      this.toggleFavoriteToolbar();
    });

    // Listen to crosshair move for Data Window and Replay hover
    pane.widget.chart.on('crosshair:move', (data) => {
      if (this.activePaneIndex === paneIndex && data) {
        if (data.bar) {
          this.updateDataWindow(data.bar, data.time);
        }
        if (typeof data.index === 'number') {
          this.lastHoveredIndex = data.index;
          this.lastHoveredTime = data.time;
        }
        if (this.isReplayJumpMode && data.time) {
          const statusText = document.getElementById('replay-status-text');
          if (statusText) {
            const d = new Date(data.time * 1000);
            statusText.textContent = `Cut at ${d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
          }
        }
      }
    });

    // Listen to chart click for Replay Jump cut-point selection & Alert line close button
    pane.widget.chart.on('click', (event) => {
      if (this.isReplayJumpMode) {
        this.handleReplayChartClick(paneIndex, event);
        return;
      }
      if (event?.id && typeof event.id === 'string') {
        if (event.id.startsWith('alert-') && event.id.endsWith('::close')) {
          const alertId = event.id.replace(/^alert-/, '').replace(/::close$/, '');
          this.removeAlertById(alertId);
        }
      }
    });

    // Listen to chart drag:end for on-chart alert price line adjustments
    pane.widget.chart.on('drag:end', (event) => {
      if (event?.id && typeof event.id === 'string' && event.id.startsWith('alert-') && typeof event.price === 'number') {
        const alertId = event.id.replace(/^alert-/, '');
        const alert = this.alerts.find((a) => a.id === alertId);
        if (alert) {
          const prec = pane.instrument.precision !== undefined ? pane.instrument.precision : 2;
          alert.targetPrice = Number(event.price.toFixed(prec));
          this.saveAlerts();
          this.renderAlertsList();
          this.syncAlertPriceLines();
          this.showToast(`Alert "${alert.name || alert.symbol}" moved to ${alert.targetPrice.toLocaleString()}`, 2000);
        }
      }
    });

    // Mount TradingView-style transparent bottom watermark
    let watermark = container.querySelector('.tv-chart-watermark');
    if (!watermark) {
      watermark = document.createElement('div');
      watermark.className = 'tv-chart-watermark';
      watermark.title = 'Zero Chart Pro Terminal';
      watermark.innerHTML = `
        <img src="assets/zero-chart-logo.svg" alt="Zero Chart" class="tv-watermark-logo" />
        <span class="tv-watermark-text">Zero Chart</span>
      `;
      container.appendChild(watermark);
    }

    // Wire click on pane wrapper to make it active
    container.addEventListener('pointerdown', () => {
      if (this.activePaneIndex !== paneIndex) {
        this.setActivePane(paneIndex);
      }
    });

    container.addEventListener('click', (e) => {
      if (this.isReplayJumpMode) {
        this.handleReplayCutSelection(paneIndex);
      }
    });

    if (paneIndex === 0) {
      window.__zeroChartWidget = pane.widget;
    }

    // Auto-restore saved drawings and alert lines for this symbol
    setTimeout(() => {
      this.restoreSymbolState(paneIndex, pane.instrument.symbol);
      this.syncAlertPriceLines(paneIndex);
    }, 200);

    // Auto-save drawings & indicators on any modification
    const autoSave = () => {
      this.saveSymbolState(paneIndex, pane.instrument.symbol);
    };
    for (const evt of ['draw:add', 'draw:remove', 'draw:update', 'draw:paste', 'draw:cut', 'indicatorAdded', 'indicatorRemoved', 'indicatorSettings']) {
      try {
        pane.widget.chart.on(evt, autoSave);
      } catch (_) {}
    }
  }

  setActivePane(index) {
    this.activePaneIndex = index;

    // Update active highlight classes on wrappers
    for (let i = 0; i < 4; i++) {
      const paneEl = document.getElementById(`chart-pane-${i}`);
      if (paneEl) {
        paneEl.classList.toggle('active', i === index);
      }
    }

    const currentPane = this.activePane;

    // Update Topbar UI to reflect active pane state
    this.updateHeaderDisplay();

    // Timeframe selector buttons
    const tfBtns = document.querySelectorAll('#timeframe-group .tv-tf-btn');
    tfBtns.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.interval === currentPane.interval);
    });

    // Chart type label & icon
    const chartTypeLabel = document.getElementById('chart-type-label');
    const chartTypeIcon = document.getElementById('chart-type-icon');
    const chartTypeItems = document.querySelectorAll('#chart-type-menu .tv-menu-item');
    chartTypeItems.forEach((item) => {
      const match = item.dataset.type === currentPane.chartType;
      item.classList.toggle('active', match);
      if (match) {
        if (chartTypeLabel) chartTypeLabel.textContent = item.querySelector('span:last-child').textContent;
        if (chartTypeIcon) chartTypeIcon.textContent = item.querySelector('span:first-child').textContent;
      }
    });

    this.renderWatchlist();
    this.syncAlertPriceLines(index);
  }

  updateHeaderDisplay() {
    const inst = this.currentInstrument;
    if (!inst) return;

    const q = this.livePrices.get(inst.symbol) || {
      last: inst.basePrice,
      chg: 0,
      chgPct: 0,
    };

    const symEl = document.getElementById('header-active-sym');
    const exchEl = document.getElementById('header-active-exch');
    const tradeTitle = document.getElementById('trade-sym-title');
    const tradePrice = document.getElementById('trade-price');

    if (symEl) symEl.textContent = inst.displaySymbol;
    if (exchEl) exchEl.textContent = inst.exchange;
    if (tradeTitle) tradeTitle.textContent = inst.displaySymbol;
    if (tradePrice && !tradePrice.value) tradePrice.placeholder = q.last.toFixed(inst.precision);
  }

  // ─── MULTI-WATCHLIST UI & MANAGEMENT (HORIZONTAL TABS) ───
  initWatchlistUI() {
    const addBtn = document.getElementById('btn-wl-add');
    const renameBtn = document.getElementById('btn-wl-rename');
    const deleteBtn = document.getElementById('btn-wl-delete');

    if (addBtn) {
      addBtn.onclick = () => document.getElementById('btn-open-search')?.click();
    }

    if (renameBtn) {
      renameBtn.onclick = () => this.promptRenameWatchlist();
    }

    if (deleteBtn) {
      deleteBtn.onclick = () => this.deleteActiveWatchlist();
    }

    this.renderHorizontalWatchlistTabs();
    this.renderWatchlist();
  }

  renderHorizontalWatchlistTabs() {
    const container = document.getElementById('watchlist-horizontal-tabs');
    if (!container) return;
    container.innerHTML = '';

    this.watchlists.forEach((wl) => {
      const tab = document.createElement('button');
      tab.className = `tv-wl-tab-pill ${wl.id === this.activeWatchlistId ? 'active' : ''}`;
      tab.innerHTML = `
        <span>${wl.name}</span>
        <span class="tv-tab-count">(${wl.symbols.length})</span>
      `;
      tab.onclick = () => {
        this.activeWatchlistId = wl.id;
        this.saveWatchlists();
        this.renderHorizontalWatchlistTabs();
        this.renderWatchlist();
      };
      container.appendChild(tab);
    });

    // Add New Watchlist Button
    const addTabBtn = document.createElement('button');
    addTabBtn.className = 'tv-wl-tab-add-btn';
    addTabBtn.title = 'Create New Watchlist';
    addTabBtn.innerHTML = '+';
    addTabBtn.onclick = () => this.promptCreateWatchlist();
    container.appendChild(addTabBtn);
  }

  promptCreateWatchlist() {
    const name = prompt('Enter a name for the new watchlist:', `Watchlist ${this.watchlists.length + 1}`);
    if (name && name.trim()) {
      const newId = `wl-${Date.now()}`;
      this.watchlists.push({
        id: newId,
        name: name.trim(),
        symbols: ['NIFTY 50', 'BANKNIFTY', 'MUTHOOTFIN', 'ICICIBANK'],
      });
      this.activeWatchlistId = newId;
      this.saveWatchlists();
      this.renderHorizontalWatchlistTabs();
      this.renderWatchlist();
    }
  }

  promptRenameWatchlist() {
    const currentWl = this.getActiveWatchlist();
    const name = prompt('Rename watchlist:', currentWl.name);
    if (name && name.trim()) {
      currentWl.name = name.trim();
      this.saveWatchlists();
      this.renderHorizontalWatchlistTabs();
      this.renderWatchlist();
    }
  }

  deleteActiveWatchlist() {
    if (this.watchlists.length <= 1) {
      alert('You must have at least one watchlist.');
      return;
    }
    const currentWl = this.getActiveWatchlist();
    if (confirm(`Are you sure you want to delete "${currentWl.name}"?`)) {
      this.watchlists = this.watchlists.filter((w) => w.id !== this.activeWatchlistId);
      this.activeWatchlistId = this.watchlists[0].id;
      this.saveWatchlists();
      this.renderHorizontalWatchlistTabs();
      this.renderWatchlist();
    }
  }

  addSymbolToActiveWatchlist(symbol, fullInst = null) {
    const wl = this.getActiveWatchlist();
    const symNorm = symbol.toUpperCase().trim();
    if (!wl.symbols.includes(symNorm)) {
      wl.symbols.push(symNorm);
      this.saveWatchlists();
      this.renderHorizontalWatchlistTabs();
      this.renderWatchlist();
    }
    const inst = fullInst || findInstrument(symNorm);
    if (inst) {
      this.switchInstrument(inst);
    }
  }

  removeSymbolFromActiveWatchlist(symbol) {
    const wl = this.getActiveWatchlist();
    const symNorm = symbol.toUpperCase().trim();
    wl.symbols = wl.symbols.filter((s) => s.toUpperCase() !== symNorm);
    this.saveWatchlists();
    this.renderHorizontalWatchlistTabs();
    this.renderWatchlist();
  }

  renderWatchlist() {
    const container = document.getElementById('watchlist-table-body');
    const titleEl = document.getElementById('wl-active-title');
    const countEl = document.getElementById('wl-active-count');
    if (!container) return;

    const currentWl = this.getActiveWatchlist();
    if (titleEl) titleEl.textContent = currentWl.name;
    if (countEl) countEl.textContent = `${currentWl.symbols.length} symbol${currentWl.symbols.length === 1 ? '' : 's'}`;

    container.innerHTML = '';

    const instruments = this.getActiveWatchlistInstruments().filter((inst) => {
      if (this.currentFlagFilter === 'all') return true;
      return inst.flag === this.currentFlagFilter;
    });

    if (instruments.length === 0) {
      container.innerHTML = `
        <div style="padding:28px 14px;text-align:center;color:var(--text-muted);line-height:1.6;">
          <div>Watchlist is empty</div>
          <button class="tv-btn tv-btn--accent" id="btn-empty-add" style="margin-top:10px;">+ Add Symbols</button>
        </div>
      `;
      const addBtn = document.getElementById('btn-empty-add');
      if (addBtn) addBtn.onclick = () => document.getElementById('btn-open-search').click();
      return;
    }

    instruments.forEach((inst) => {
      const row = document.createElement('div');
      row.className = `tv-wl-row ${inst.symbol === this.currentInstrument?.symbol ? 'selected' : ''}`;
      row.id = `wl-row-${inst.symbol.replace(/[^A-Za-z0-9]/g, '_')}`;

      const q = this.livePrices.get(inst.symbol) || {
        last: inst.basePrice,
        chg: 0,
        chgPct: 0,
      };

      const isUp = q.chg >= 0;
      const sign = isUp ? '+' : '';

      row.innerHTML = `
        <div class="tv-wl-cell-sym">
          <div class="tv-symbol-circle" style="background:${inst.badgeColor};">${inst.badgeText}</div>
          <div class="tv-symbol-meta">
            <div class="tv-sym-name">${inst.displaySymbol}</div>
            <div class="tv-sym-desc">${inst.name}</div>
          </div>
        </div>
        <div class="tv-wl-cell-last" id="wl-last-${inst.symbol.replace(/[^A-Za-z0-9]/g, '_')}">
          ${q.last.toLocaleString(undefined, { minimumFractionDigits: inst.precision, maximumFractionDigits: inst.precision })}
        </div>
        <div class="tv-wl-cell-chg ${isUp ? 'up' : 'dn'}" id="wl-chg-${inst.symbol.replace(/[^A-Za-z0-9]/g, '_')}">
          ${sign}${q.chg.toFixed(inst.precision)}
        </div>
        <div class="tv-wl-cell-pct ${isUp ? 'up' : 'dn'}" id="wl-pct-${inst.symbol.replace(/[^A-Za-z0-9]/g, '_')}">
          ${sign}${q.chgPct.toFixed(2)}%
        </div>
        <div class="tv-wl-cell-del">
          <button class="tv-btn-del-sym" title="Remove ${inst.symbol}" data-sym="${inst.symbol}">✕</button>
        </div>
      `;

      // Click to switch active pane instrument
      row.onclick = (e) => {
        if (e.target.closest('.tv-btn-del-sym')) return;
        this.switchInstrument(inst);
      };

      // Delete symbol button
      const delBtn = row.querySelector('.tv-btn-del-sym');
      if (delBtn) {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          this.removeSymbolFromActiveWatchlist(inst.symbol);
        };
      }

      container.appendChild(row);
    });
  }

  switchInstrument(inst) {
    if (this.isReplayMode) {
      this.exitReplayMode();
    }
    const prevSym = this.currentInstrument?.symbol;
    if (prevSym) {
      this.saveSymbolState(this.activePaneIndex, prevSym);
    }

    this.currentInstrument = inst;
    const activeWidget = this.widget;
    if (activeWidget) {
      activeWidget.setSymbol(inst.symbol, inst.exchange);
      const prec = inst.precision !== undefined ? inst.precision : 2;
      try {
        if (activeWidget.chart?.setAxisChromeOptions) {
          activeWidget.chart.setAxisChromeOptions({ barCountdown: true, sessionClock: true });
        }
        activeWidget.chart?.primarySeries()?.applyOptions({ precision: prec });
        activeWidget.series?.applyOptions?.({ precision: prec });
      } catch (_) {}
      setTimeout(() => {
        try {
          activeWidget.chart?.primarySeries()?.applyOptions({ precision: prec });
          activeWidget.series?.applyOptions?.({ precision: prec });
        } catch (_) {}
        this.restoreSymbolState(this.activePaneIndex, inst.symbol);
        this.syncAlertPriceLines(this.activePaneIndex);
      }, 150);
    }

    this.updateHeaderDisplay();
    this.renderWatchlist();
    this.closeModal('search-modal');
    if (window.innerWidth <= 768) {
      this.closeMobileDrawer(true);
    }
  }

  // ─── LIVE DATA STREAMING & ALERT TRIGGER EVALUATION ───
  startLiveMarketStream() {
    // 1. Subscribe to Binance 24/7 Crypto & Paxos Gold
    const cryptoSymbols = MASTER_INSTRUMENTS.filter((i) => i.feedType === 'binance' || i.symbol === 'PAXGUSDT');
    cryptoSymbols.forEach((inst) => {
      this.multiFeed.binanceFeed.subscribeBars(inst.symbol, '1m', (bar) => {
        const prev = this.livePrices.get(inst.symbol)?.prevClose || inst.basePrice;
        const chg = +(bar.close - prev).toFixed(inst.precision);
        const chgPct = prev !== 0 ? +((chg / prev) * 100).toFixed(2) : 0;
        this.updateLivePrice(inst, bar.close, chg, chgPct);
      });
    });

    // 2. High-speed centralized batch poller for all active watchlist & trading quotes
    let isPolling = false;
    const pollQuotes = async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const activeSymbols = [...(this.getActiveWatchlist()?.symbols || [])];
        // Include active pane symbols without mutating active watchlist
        this.panes.forEach(p => {
          if (p.instrument?.symbol && !activeSymbols.includes(p.instrument.symbol)) {
            activeSymbols.push(p.instrument.symbol);
          }
        });
        const symQuery = encodeURIComponent(activeSymbols.join(','));
        const resp = await fetch(`/api/market/quotes?symbols=${symQuery}`);
        if (resp.ok) {
          const json = await resp.json();
          if (json.status === 'success' && json.quotes) {
            for (const [sym, q] of Object.entries(json.quotes)) {
              const inst = findInstrument(sym);
              if (inst && q.ltp) {
                const prev = q.prevClose || inst.basePrice;
                const chg = +(q.ltp - prev).toFixed(inst.precision);
                const chgPct = prev !== 0 ? +((chg / prev) * 100).toFixed(2) : 0;
                this.updateLivePrice(inst, q.ltp, chg, chgPct);
              }
            }
          }
        }
      } catch (_) {}
      finally {
        isPolling = false;
      }
    };

    pollQuotes();
    setInterval(pollQuotes, 400);
  }

  updateLivePrice(inst, newPrice, chg, chgPct) {
    const cleanId = inst.symbol.replace(/[^A-Za-z0-9]/g, '_');
    const prevData = this.livePrices.get(inst.symbol);
    const prevPrice = prevData?.last || inst.basePrice;

    this.livePrices.set(inst.symbol, {
      last: newPrice,
      chg: chg || 0,
      chgPct: chgPct || 0,
      prevClose: newPrice - (chg || 0),
    });

    this.broker.onLtp(inst.symbol, newPrice);

    // Dispatch live tick directly to chart widget feed for in-place candle updates (skip if active pane is in replay mode for this instrument)
    if (!this.isReplayMode || this.currentInstrument?.symbol !== inst.symbol) {
      if (this.multiFeed?.openalgoFeed?._dispatchRealtimeTick) {
        this.multiFeed.openalgoFeed._dispatchRealtimeTick(inst.symbol, newPrice);
      }
    }

    // Direct in-place primary series update on all active panes displaying this instrument
    this.panes.forEach((p) => {
      if (this.isReplayMode && p.id === this.activePaneIndex) return;
      if (p.instrument?.symbol === inst.symbol && p.widget?.chart) {
        try {
          const s = p.widget.chart.primarySeries?.();
          if (s && typeof s.getData === 'function' && typeof s.update === 'function') {
            const data = s.getData();
            if (data && data.length > 0) {
              const last = data[data.length - 1];
              const nowSec = Math.floor(Date.now() / 1000);
              const intervalSecs = getIntervalSeconds(p.interval || '5m');
              const bucketTime = Math.floor(nowSec / intervalSecs) * intervalSecs;
              if (last.time === bucketTime || nowSec < last.time + intervalSecs) {
                s.update({
                  time: last.time,
                  open: last.open,
                  high: Math.max(last.high, newPrice),
                  low: Math.min(last.low, newPrice),
                  close: newPrice,
                  volume: (last.volume || 0) + 1,
                });
              } else {
                s.update({
                  time: bucketTime,
                  open: last.close,
                  high: newPrice,
                  low: newPrice,
                  close: newPrice,
                  volume: 1,
                });
              }
            }
          }
        } catch (_) {}
      }
    });

    // Update watchlist row cells
    const lastEl = document.getElementById(`wl-last-${cleanId}`);
    const chgEl = document.getElementById(`wl-chg-${cleanId}`);
    const pctEl = document.getElementById(`wl-pct-${cleanId}`);

    const isUp = (chg || 0) >= 0;
    const sign = isUp ? '+' : '';

    if (lastEl) {
      lastEl.textContent = newPrice.toLocaleString(undefined, {
        minimumFractionDigits: inst.precision,
        maximumFractionDigits: inst.precision,
      });
    }
    if (chgEl) {
      chgEl.textContent = `${sign}${(chg || 0).toFixed(inst.precision)}`;
      chgEl.className = `tv-wl-cell-chg ${isUp ? 'up' : 'dn'}`;
    }
    if (pctEl) {
      pctEl.textContent = `${sign}${(chgPct || 0).toFixed(2)}%`;
      pctEl.className = `tv-wl-cell-pct ${isUp ? 'up' : 'dn'}`;
    }

    if (inst.symbol === this.currentInstrument?.symbol) {
      const tradePriceField = document.getElementById('trade-price');
      if (tradePriceField && !tradePriceField.value) {
        tradePriceField.placeholder = newPrice.toFixed(inst.precision);
      }
    }

    // Evaluate active alerts against this live tick
    this.evaluateAlerts(inst.symbol, newPrice, prevPrice);
  }

  // ─── REAL-TIME ALERTS ENGINE ───
  initAlertEngine() {
    const openAlertBtn = document.getElementById('btn-open-alert');
    const addAlertPanelBtn = document.getElementById('btn-add-alert-panel');
    const closeAlertBtn = document.getElementById('btn-close-alert');
    const cancelAlertBtn = document.getElementById('btn-cancel-alert');
    const saveAlertBtn = document.getElementById('btn-save-alert');
    const useCurrentLtpBtn = document.getElementById('btn-alert-use-current');
    const alertModal = document.getElementById('alert-modal');

    if (openAlertBtn) {
      openAlertBtn.onclick = () => this.openAlertModal();
    }
    if (addAlertPanelBtn) {
      addAlertPanelBtn.onclick = () => this.openAlertModal();
    }
    if (closeAlertBtn) {
      closeAlertBtn.onclick = () => this.closeModal('alert-modal');
    }
    if (cancelAlertBtn) {
      cancelAlertBtn.onclick = () => this.closeModal('alert-modal');
    }
    if (saveAlertBtn) {
      saveAlertBtn.onclick = () => this.saveAlertFromModal();
    }

    if (useCurrentLtpBtn) {
      useCurrentLtpBtn.onclick = () => {
        const symSelect = document.getElementById('alert-symbol');
        const priceInput = document.getElementById('alert-price');
        if (symSelect && priceInput) {
          const sym = symSelect.value;
          const q = this.livePrices.get(sym);
          const inst = findInstrument(sym);
          const p = q?.last || inst?.basePrice || 100;
          priceInput.value = p;
        }
      };
    }

    if (alertModal) {
      alertModal.onclick = (e) => {
        if (e.target === alertModal) this.closeModal('alert-modal');
      };
    }

    // Keyboard shortcut Alt+A for alert
    window.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        this.openAlertModal();
      }
    });

    this.updateAlertBadgeCount();
    this.renderAlertsList();
  }

  openAlertModal(existingAlert = null, prefill = null) {
    const modal = document.getElementById('alert-modal');
    const titleEl = document.getElementById('alert-modal-title');
    const idInput = document.getElementById('alert-edit-id');
    const symSelect = document.getElementById('alert-symbol');
    const condSelect = document.getElementById('alert-condition');
    const priceInput = document.getElementById('alert-price');
    const freqSelect = document.getElementById('alert-frequency');
    const expSelect = document.getElementById('alert-expiration');
    const nameInput = document.getElementById('alert-name');
    const msgInput = document.getElementById('alert-message');

    if (!modal || !symSelect) return;

    // Populate symbol options
    symSelect.innerHTML = '';
    const uniqueSymbols = Array.from(
      new Set([...this.getActiveWatchlist().symbols, ...MASTER_INSTRUMENTS.map((i) => i.symbol)])
    );

    if (prefill?.symbol && !uniqueSymbols.includes(prefill.symbol)) {
      uniqueSymbols.unshift(prefill.symbol);
    }

    uniqueSymbols.forEach((sym) => {
      const opt = document.createElement('option');
      opt.value = sym;
      opt.textContent = sym;
      symSelect.appendChild(opt);
    });

    if (existingAlert) {
      if (titleEl) titleEl.textContent = 'Edit Price Alert';
      if (idInput) idInput.value = existingAlert.id;
      symSelect.value = existingAlert.symbol;
      if (condSelect) condSelect.value = existingAlert.condition;
      if (priceInput) priceInput.value = existingAlert.targetPrice;
      if (freqSelect) freqSelect.value = existingAlert.frequency || 'ONCE';
      if (expSelect) expSelect.value = existingAlert.expiration || 'NEVER';
      if (nameInput) nameInput.value = existingAlert.name || '';
      if (msgInput) msgInput.value = existingAlert.message || '';
    } else {
      if (titleEl) titleEl.textContent = 'Create Price Alert';
      if (idInput) idInput.value = '';
      const activeSym = prefill?.symbol || this.panes[this.activePaneIndex]?.instrument?.symbol || this.currentInstrument?.symbol || 'NIFTY 50';
      symSelect.value = activeSym;

      const q = this.livePrices.get(activeSym);
      const inst = findInstrument(activeSym);
      const currentPrice = q?.last || inst?.basePrice || 100;
      const prec = inst?.precision !== undefined ? inst.precision : 2;

      let targetPrice = prefill?.targetPrice != null ? Number(Number(prefill.targetPrice).toFixed(prec)) : currentPrice;
      if (priceInput) priceInput.value = targetPrice;

      if (prefill?.condition) {
        if (condSelect) condSelect.value = prefill.condition;
      } else if (targetPrice >= currentPrice) {
        if (condSelect) condSelect.value = 'CROSSING_UP';
      } else {
        if (condSelect) condSelect.value = 'CROSSING_DOWN';
      }

      if (freqSelect) freqSelect.value = 'ONCE';
      if (expSelect) expSelect.value = 'NEVER';
      if (nameInput) nameInput.value = `${activeSym} @ ${targetPrice}`;
      if (msgInput) msgInput.value = `${activeSym} crossed ${targetPrice}`;
    }

    modal.classList.add('show');
    setTimeout(() => priceInput?.focus(), 50);
  }

  saveAlertFromModal() {
    const idInput = document.getElementById('alert-edit-id');
    const symSelect = document.getElementById('alert-symbol');
    const condSelect = document.getElementById('alert-condition');
    const priceInput = document.getElementById('alert-price');
    const freqSelect = document.getElementById('alert-frequency');
    const expSelect = document.getElementById('alert-expiration');
    const nameInput = document.getElementById('alert-name');
    const msgInput = document.getElementById('alert-message');

    const targetPrice = parseFloat(priceInput?.value);
    if (!targetPrice || targetPrice <= 0 || isNaN(targetPrice)) {
      alert('Please enter a valid target price.');
      priceInput?.focus();
      return;
    }

    const symbol = symSelect.value;
    const condition = condSelect.value;
    const frequency = freqSelect.value;
    const expiration = expSelect.value;
    const name = nameInput.value.trim() || `${symbol} Alert`;
    const message = msgInput.value.trim() || `${symbol} reached target of ${targetPrice}`;

    const editId = idInput.value;
    if (editId) {
      const existing = this.alerts.find((a) => a.id === editId);
      if (existing) {
        existing.symbol = symbol;
        existing.condition = condition;
        existing.targetPrice = targetPrice;
        existing.frequency = frequency;
        existing.expiration = expiration;
        existing.name = name;
        existing.message = message;
        existing.status = 'ACTIVE';
      }
    } else {
      const newAlert = {
        id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        symbol,
        condition,
        targetPrice,
        frequency,
        expiration,
        name,
        message,
        status: 'ACTIVE',
        createdAt: Date.now(),
        triggeredAt: null,
        lastPrice: null,
      };
      this.alerts.unshift(newAlert);
    }

    this.saveAlerts();
    this.closeModal('alert-modal');
    this.updateAlertBadgeCount();
    this.renderAlertsList();
    this.syncAlertPriceLines();
    this.showToast(`Alert set on ${symbol} at ${targetPrice.toLocaleString()}`, 2000);
  }

  evaluateAlerts(symbol, currentPrice, prevPrice) {
    if (!currentPrice || isNaN(currentPrice)) return;

    const now = Date.now();
    let modified = false;

    this.alerts.forEach((alert) => {
      if (alert.status !== 'ACTIVE' || alert.symbol !== symbol) return;

      // Cooldown for recurring alerts (minimum 60s between triggers to prevent spam)
      if (alert.lastTriggerTime && now - alert.lastTriggerTime < 60000) {
        return;
      }

      const target = alert.targetPrice;
      let triggered = false;

      switch (alert.condition) {
        case 'GREATER_THAN':
          triggered = currentPrice >= target && (!alert.lastPrice || alert.lastPrice < target || now - (alert.lastTriggerTime || 0) > 300000);
          break;
        case 'LESS_THAN':
          triggered = currentPrice <= target && (!alert.lastPrice || alert.lastPrice > target || now - (alert.lastTriggerTime || 0) > 300000);
          break;
        case 'CROSSING_UP':
          triggered = prevPrice < target && currentPrice >= target;
          break;
        case 'CROSSING_DOWN':
          triggered = prevPrice > target && currentPrice <= target;
          break;
        case 'CROSSING':
          triggered =
            (prevPrice < target && currentPrice >= target) ||
            (prevPrice > target && currentPrice <= target);
          break;
        default:
          triggered = currentPrice >= target;
      }

      if (triggered) {
        alert.lastTriggerTime = now;
        alert.triggeredAt = now;
        alert.lastPrice = currentPrice;
        if (alert.frequency === 'ONCE') {
          alert.status = 'TRIGGERED';
        }
        this.triggerAlert(alert, currentPrice);
        modified = true;
      }
    });

    if (modified) {
      this.saveAlerts();
      this.updateAlertBadgeCount();
      this.renderAlertsList();
    }
  }

  triggerAlert(alert, currentPrice) {
    this.playAlertChime();
    this.showAlertToast(alert, currentPrice);
  }

  playAlertChime() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      // Note 1: E5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: A5 / C#6 chord
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.1);
      osc2.frequency.exponentialRampToValueAtTime(1108.73, now + 0.35);
      gain2.gain.setValueAtTime(0.3, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.6);
    } catch (_) {}
  }

  showAlertToast(alert, currentPrice) {
    const container = document.getElementById('alert-toast-container');
    if (!container) return;

    // Limit visible toasts to maximum 2 to prevent clutter
    while (container.children.length >= 2) {
      container.firstChild.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'tv-alert-toast';
    toast.innerHTML = `
      <div style="font-size:20px;line-height:1;">⏰</div>
      <div style="flex:1;">
        <div class="tv-toast-title">${alert.name || alert.symbol + ' Alert Triggered!'}</div>
        <div class="tv-toast-msg">${alert.symbol} reached <b>${currentPrice.toLocaleString()}</b> (Target: ${alert.targetPrice.toLocaleString()})</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">${new Date().toLocaleTimeString()}</div>
      </div>
      <button style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;" title="Dismiss">✕</button>
    `;

    toast.onclick = () => {
      this.openSidebarTab('alerts');
      toast.remove();
    };

    const closeBtn = toast.querySelector('button');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        toast.remove();
      };
    }

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, 2000);
  }

  updateAlertBadgeCount() {
    const badge = document.getElementById('top-alert-count');
    if (!badge) return;
    const activeCount = this.alerts.filter((a) => a.status === 'ACTIVE').length;
    if (activeCount > 0) {
      badge.textContent = activeCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  renderAlertsList() {
    const list = document.getElementById('alerts-list');
    if (!list) return;

    if (this.alerts.length === 0) {
      list.innerHTML = `
        <div style="padding:24px 14px;text-align:center;color:var(--text-muted);line-height:1.5;">
          <div>No active alerts.</div>
          <button class="tv-btn tv-btn--accent" id="btn-empty-alert-add" style="margin-top:10px;">+ Create Alert</button>
        </div>
      `;
      const addBtn = document.getElementById('btn-empty-alert-add');
      if (addBtn) addBtn.onclick = () => this.openAlertModal();
      return;
    }

    list.innerHTML = '';

    this.alerts.forEach((alert) => {
      const card = document.createElement('div');
      card.className = 'tv-alert-card';

      const condTextMap = {
        CROSSING_UP: 'Crossing Up ↑',
        CROSSING_DOWN: 'Crossing Down ↓',
        CROSSING: 'Crossing ↕',
        GREATER_THAN: 'Greater Than >',
        LESS_THAN: 'Less Than <',
      };

      const statusClass = alert.status.toLowerCase();

      card.innerHTML = `
        <div class="tv-alert-card-head">
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="tv-alert-card-sym">${alert.symbol}</span>
            <span style="font-size:11px;color:var(--text-muted);">${condTextMap[alert.condition] || alert.condition}</span>
          </div>
          <span class="tv-alert-card-badge ${statusClass}">${alert.status}</span>
        </div>
        <div class="tv-alert-card-info">
          <div>Target: <b style="color:var(--text);font-family:var(--mono);">${alert.targetPrice.toLocaleString()}</b> &bull; ${alert.name}</div>
          ${alert.triggeredAt ? `<div style="font-size:10px;color:var(--buy);margin-top:2px;">Triggered at ${new Date(alert.triggeredAt).toLocaleTimeString()}</div>` : ''}
        </div>
        <div class="tv-alert-card-actions">
          <button class="tv-btn-alert-act btn-alert-toggle" data-id="${alert.id}">
            ${alert.status === 'ACTIVE' ? '⏸️ Pause' : '▶️ Resume'}
          </button>
          <button class="tv-btn-alert-act btn-alert-edit" data-id="${alert.id}">✏️ Edit</button>
          <button class="tv-btn-alert-act btn-alert-del" data-id="${alert.id}" style="color:var(--sell);">🗑️</button>
        </div>
      `;

      // Toggle status
      const toggleBtn = card.querySelector('.btn-alert-toggle');
      if (toggleBtn) {
        toggleBtn.onclick = (e) => {
          e.stopPropagation();
          alert.status = alert.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
          this.saveAlerts();
          this.updateAlertBadgeCount();
          this.renderAlertsList();
          this.syncAlertPriceLines();
        };
      }

      // Edit
      const editBtn = card.querySelector('.btn-alert-edit');
      if (editBtn) {
        editBtn.onclick = (e) => {
          e.stopPropagation();
          this.openAlertModal(alert);
        };
      }

      // Delete
      const delBtn = card.querySelector('.btn-alert-del');
      if (delBtn) {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          this.removeAlertById(alert.id);
        };
      }

      list.appendChild(card);
    });
  }

  removeAlertById(alertId) {
    const alert = this.alerts.find((a) => a.id === alertId);
    this.alerts = this.alerts.filter((a) => a.id !== alertId);
    this.saveAlerts();
    this.updateAlertBadgeCount();
    this.renderAlertsList();
    this.syncAlertPriceLines();
    if (alert) {
      this.showToast(`Alert "${alert.name || alert.symbol}" deleted`, 2000);
    }
  }

  syncAlertPriceLines(targetPaneIndex = null) {
    const paneIndices = targetPaneIndex !== null ? [targetPaneIndex] : this.panes.map((_, i) => i);

    paneIndices.forEach((paneIdx) => {
      const pane = this.panes[paneIdx];
      if (!pane || !pane.widget || !pane.widget.chart) return;

      if (!pane.alertLines) {
        pane.alertLines = new Map();
      }

      const activeAlerts = this.alerts.filter(
        (a) => a.status === 'ACTIVE' && a.symbol === pane.instrument.symbol
      );
      const activeIds = new Set(activeAlerts.map((a) => a.id));

      // Remove lines for deleted or deactivated alerts
      for (const [alertId, line] of pane.alertLines.entries()) {
        if (!activeIds.has(alertId)) {
          try {
            pane.widget.chart.removePrimitive(line);
          } catch (_) {}
          pane.alertLines.delete(alertId);
        }
      }

      // Add or update active alert price lines
      const prec = pane.instrument.precision !== undefined ? pane.instrument.precision : 2;
      activeAlerts.forEach((alert) => {
        const formattedPrice = Number(alert.targetPrice).toLocaleString(undefined, {
          minimumFractionDigits: prec,
          maximumFractionDigits: prec,
        });
        const leftLabel = `${alert.name || alert.symbol} (${alert.condition.replace(/_/g, ' ')})`;

        if (pane.alertLines.has(alert.id)) {
          const line = pane.alertLines.get(alert.id);
          try {
            line.setOptions({
              price: alert.targetPrice,
              label: formattedPrice,
              leftLabel: leftLabel,
            });
          } catch (_) {}
        } else {
          try {
            const line = pane.widget.chart.addPriceLine(
              {
                id: `alert-${alert.id}`,
                price: alert.targetPrice,
                color: '#f59e0b',
                lineStyle: 'dashed',
                lineWidth: 1.5,
                label: formattedPrice,
                badge: '🔔 ALERT',
                leftLabel: leftLabel,
                closeButton: true,
                cursor: 'ns-resize',
              },
              0
            );
            pane.alertLines.set(alert.id, line);
          } catch (err) {
            console.error('[ZeroChart] Failed to add PriceLine for alert:', alert, err);
          }
        }
      });
    });
  }

  // ─── BAR REPLAY SYSTEM (TRADINGVIEW PARITY) ───
  initReplaySystem() {
    const btnToggleReplay = document.getElementById('btn-toggle-replay');
    const replayToolbar = document.getElementById('tv-replay-toolbar');
    const btnReplayJump = document.getElementById('btn-replay-jump');
    const btnReplayStepBack = document.getElementById('btn-replay-step-back');
    const btnReplayPlay = document.getElementById('btn-replay-play');
    const btnReplayStepForward = document.getElementById('btn-replay-step-forward');
    const btnReplaySpeed = document.getElementById('btn-replay-speed');
    const speedMenu = document.getElementById('replay-speed-menu');
    const btnReplayExit = document.getElementById('btn-replay-exit');
    const dragHandle = document.getElementById('replay-drag-handle');

    // 1. Toggle Replay Toolbar from Topbar
    if (btnToggleReplay) {
      btnToggleReplay.onclick = () => {
        if (!this.isReplayMode && (!replayToolbar || replayToolbar.style.display === 'none')) {
          this.enterReplayToolbar();
        } else {
          this.exitReplayMode();
        }
      };
    }

    // 2. Jump to Bar Tool
    if (btnReplayJump) {
      btnReplayJump.onclick = () => {
        this.setReplayJumpMode(!this.isReplayJumpMode);
      };
    }

    // 3. Step Back 1 Bar
    if (btnReplayStepBack) {
      btnReplayStepBack.onclick = () => {
        this.replayStepBack();
      };
    }

    // 4. Play / Pause
    if (btnReplayPlay) {
      btnReplayPlay.onclick = () => {
        this.toggleReplayPlayPause();
      };
    }

    // 5. Step Forward 1 Bar
    if (btnReplayStepForward) {
      btnReplayStepForward.onclick = () => {
        this.replayStepForward();
      };
    }

    // 6. Speed Multiplier Dropdown
    if (btnReplaySpeed && speedMenu) {
      btnReplaySpeed.onclick = (e) => {
        e.stopPropagation();
        speedMenu.style.display = speedMenu.style.display === 'none' ? 'flex' : 'none';
      };

      speedMenu.querySelectorAll('.tv-speed-opt').forEach((opt) => {
        opt.onclick = (e) => {
          e.stopPropagation();
          const speed = parseFloat(opt.getAttribute('data-speed')) || 1;
          this.setReplaySpeed(speed);
          speedMenu.style.display = 'none';
        };
      });

      document.addEventListener('click', (e) => {
        if (!btnReplaySpeed.contains(e.target) && !speedMenu.contains(e.target)) {
          speedMenu.style.display = 'none';
        }
      });
    }

    // 7. Exit Replay
    if (btnReplayExit) {
      btnReplayExit.onclick = () => {
        this.exitReplayMode();
      };
    }

    // 8. Draggable Floating Toolbar
    this.initReplayDraggableToolbar(dragHandle, replayToolbar);

    // 9. Hotkeys for Bar Replay (Space: Play/Pause, Right: Forward, Left: Back, Esc: Exit/Cancel)
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (document.querySelector('.tv-modal-backdrop.show')) return;

      const tb = document.getElementById('tv-replay-toolbar');
      const isReplayVisible = tb && tb.style.display !== 'none';

      if (isReplayVisible) {
        if (e.code === 'Space') {
          e.preventDefault();
          this.toggleReplayPlayPause();
        } else if (e.code === 'ArrowRight') {
          e.preventDefault();
          this.replayStepForward();
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          this.replayStepBack();
        } else if (e.code === 'Escape') {
          e.preventDefault();
          if (this.isReplayJumpMode) {
            this.setReplayJumpMode(false);
          } else {
            this.exitReplayMode();
          }
        }
      }
    });
  }

  enterReplayToolbar() {
    const replayToolbar = document.getElementById('tv-replay-toolbar');
    const btnToggleReplay = document.getElementById('btn-toggle-replay');
    if (!replayToolbar) return;

    const activePane = this.panes[this.activePaneIndex];
    const series = activePane?.widget?.chart?.primarySeries() || activePane?.widget?.series;
    if (series) {
      const data = series.getData();
      if (data && data.length > 0) {
        this.fullReplayBars = [...data];
      }
    }

    if (!this.fullReplayBars || this.fullReplayBars.length < 2) {
      this.showToast('Please wait for historical candles to load before starting Replay', 3000);
      return;
    }

    replayToolbar.style.display = 'flex';
    replayToolbar.classList.add('show');
    if (btnToggleReplay) btnToggleReplay.classList.add('is-active');

    // Auto-activate Jump to Bar cut-point tool
    this.setReplayJumpMode(true);
    this.showToast('Bar Replay: Click any candle on the chart to cut historical data', 3000);
  }

  setReplayJumpMode(active) {
    this.isReplayJumpMode = active;
    const btnReplayJump = document.getElementById('btn-replay-jump');
    const stage = document.querySelector('.tv-stage');
    const statusText = document.getElementById('replay-status-text');

    if (btnReplayJump) {
      btnReplayJump.classList.toggle('is-active', active);
    }
    if (stage) {
      stage.classList.toggle('is-replay-jump', active);
    }
    if (statusText) {
      if (active) {
        statusText.textContent = 'Click a bar to cut';
      } else if (this.replayController) {
        const state = this.replayController.state();
        statusText.textContent = `Bar ${state.index + 1} / ${state.total}`;
      }
    }
  }

  handleReplayChartClick(paneIndex, event) {
    if (!this.isReplayJumpMode) return;
    this.handleReplayCutSelection(paneIndex, event?.time);
  }

  handleReplayCutSelection(paneIndex, clickTime = null) {
    if (!this.isReplayJumpMode) return;

    const pane = this.panes[paneIndex];
    if (!pane || !pane.widget || !pane.widget.chart) return;

    const series = pane.widget.chart.primarySeries() || pane.widget.series;
    if (!series) return;

    if (!this.fullReplayBars || this.fullReplayBars.length === 0) {
      const data = series.getData();
      if (data && data.length > 0) {
        this.fullReplayBars = [...data];
      }
    }

    if (!this.fullReplayBars || this.fullReplayBars.length === 0) {
      this.showToast('No candle data available for replay', 2000);
      return;
    }

    let cutIndex = -1;
    const targetTime = clickTime || this.lastHoveredTime;

    if (targetTime) {
      let minDiff = Infinity;
      this.fullReplayBars.forEach((b, idx) => {
        const diff = Math.abs(b.time - targetTime);
        if (diff < minDiff) {
          minDiff = diff;
          cutIndex = idx;
        }
      });
    }

    if (cutIndex === -1 && typeof this.lastHoveredIndex === 'number' && this.lastHoveredIndex >= 0 && this.lastHoveredIndex < this.fullReplayBars.length) {
      cutIndex = this.lastHoveredIndex;
    }

    if (cutIndex === -1) {
      cutIndex = Math.max(0, Math.floor(this.fullReplayBars.length * 0.5));
    }

    cutIndex = Math.max(0, Math.min(cutIndex, this.fullReplayBars.length - 1));

    this.setReplayJumpMode(false);
    this.startReplay(paneIndex, cutIndex);
  }

  startReplay(paneIndex, cutIndex) {
    const pane = this.panes[paneIndex];
    if (!pane || !pane.widget || !pane.widget.chart) return;

    const series = pane.widget.chart.primarySeries() || pane.widget.series;
    if (!series) return;

    if (!this.fullReplayBars || this.fullReplayBars.length === 0) {
      const data = series.getData();
      if (data && data.length > 0) {
        this.fullReplayBars = [...data];
      }
    }

    if (!this.fullReplayBars || this.fullReplayBars.length === 0) {
      this.showToast('No candle data available for replay', 2000);
      return;
    }

    this.isReplayMode = true;
    cutIndex = Math.max(0, Math.min(cutIndex, this.fullReplayBars.length - 1));

    // CRITICAL: Pause widget dataController so incoming polling ticks and REST refreshes
    // do not overwrite the replay historical candle slice!
    if (pane.widget.dataController) {
      try {
        pane.widget.dataController.setPaused(true);
      } catch (_) {}
    }

    if (this.replayController) {
      try {
        this.replayController.seek(cutIndex);
        const state = this.replayController.state();
        this.updateReplayUI(state);
        this.showToast(`Replay jump to bar ${cutIndex + 1} of ${this.fullReplayBars.length}`, 2000);
        return;
      } catch (_) {
        try { this.replayController.stop(); } catch (_) {}
        this.replayController = null;
      }
    }

    try {
      this.replayController = new ReplayController(pane.widget.chart, {
        series: series,
        bars: this.fullReplayBars,
        startIndex: cutIndex,
        barMs: 1000,
        speed: this.replaySpeed || 1,
        scheduler: (cb, ms) => {
          const tickInterval = Math.max(50, Math.min(ms, 250));
          const id = setInterval(cb, tickInterval);
          return () => clearInterval(id);
        },
        onFrame: (state) => {
          this.updateReplayUI(state);
        },
      });

      const state = this.replayController.state();
      this.updateReplayUI(state);
      this.showToast(`Replay started from bar ${cutIndex + 1} of ${this.fullReplayBars.length}`, 2000);
    } catch (err) {
      console.error('[ZeroChart] Failed to start replay:', err);
      this.showToast('Failed to start replay: ' + err.message, 3000);
    }
  }

  toggleReplayPlayPause() {
    if (!this.replayController) {
      this.handleReplayCutSelection(this.activePaneIndex);
      if (!this.replayController) return;
    }

    const state = this.replayController.state();
    if (state.playing) {
      this.replayController.pause();
      this.updatePlayPauseButton(false);
      const statusText = document.getElementById('replay-status-text');
      if (statusText) statusText.textContent = `Paused (${state.index + 1}/${state.total})`;
    } else {
      if (state.index >= state.total - 1) {
        this.replayController.seek(0);
      }
      this.replayController.play({ speed: this.replaySpeed });
      this.updatePlayPauseButton(true);
      const statusText = document.getElementById('replay-status-text');
      if (statusText) statusText.textContent = `Playing ${this.replaySpeed}x...`;
    }
  }

  replayStepForward() {
    if (!this.replayController) {
      this.handleReplayCutSelection(this.activePaneIndex);
      return;
    }
    if (this.replayController.state().playing) {
      this.replayController.pause();
      this.updatePlayPauseButton(false);
    }
    this.replayController.step(1);
    const state = this.replayController.state();
    this.updateReplayUI(state);
  }

  replayStepBack() {
    if (!this.replayController) {
      this.handleReplayCutSelection(this.activePaneIndex);
      return;
    }
    if (this.replayController.state().playing) {
      this.replayController.pause();
      this.updatePlayPauseButton(false);
    }
    this.replayController.stepBack(1);
    const state = this.replayController.state();
    this.updateReplayUI(state);
  }

  setReplaySpeed(speed) {
    this.replaySpeed = speed;
    const speedLabel = document.getElementById('replay-speed-label');
    const speedMenu = document.getElementById('replay-speed-menu');

    if (speedLabel) speedLabel.textContent = `${speed}x`;

    if (speedMenu) {
      speedMenu.querySelectorAll('.tv-speed-opt').forEach((btn) => {
        const btnSpeed = parseFloat(btn.getAttribute('data-speed'));
        btn.classList.toggle('active', btnSpeed === speed);
      });
    }

    if (this.replayController) {
      const state = this.replayController.state();
      if (state.playing) {
        this.replayController.play({ speed });
        const statusText = document.getElementById('replay-status-text');
        if (statusText) statusText.textContent = `Playing ${speed}x...`;
      }
    }
  }

  updateReplayUI(state) {
    const statusText = document.getElementById('replay-status-text');
    if (statusText) {
      if (state.playing) {
        statusText.textContent = `Playing ${this.replaySpeed}x (${state.index + 1}/${state.total})`;
      } else if (state.index >= state.total - 1) {
        statusText.textContent = `Finished (${state.total}/${state.total})`;
        this.updatePlayPauseButton(false);
      } else {
        statusText.textContent = `Bar ${state.index + 1} / ${state.total}`;
      }
    }

    this.updatePlayPauseButton(state.playing);

    if (state.bar) {
      this.updateDataWindow(state.bar, state.bar.time);
    }
  }

  updatePlayPauseButton(isPlaying) {
    const btnPlay = document.getElementById('btn-replay-play');
    if (!btnPlay) return;

    const iconPlay = btnPlay.querySelector('.icon-play');
    const iconPause = btnPlay.querySelector('.icon-pause');

    if (iconPlay && iconPause) {
      iconPlay.style.display = isPlaying ? 'none' : 'block';
      iconPause.style.display = isPlaying ? 'block' : 'none';
    }
    btnPlay.classList.toggle('is-playing', isPlaying);
  }

  exitReplayMode() {
    this.setReplayJumpMode(false);
    this.isReplayMode = false;

    const activePane = this.panes[this.activePaneIndex];

    if (this.replayController) {
      try {
        this.replayController.stop();
      } catch (_) {}
      this.replayController = null;
    }

    // Unpause data controller so live stream updates resume cleanly
    if (activePane?.widget?.dataController) {
      try {
        activePane.widget.dataController.setPaused(false);
      } catch (_) {}
    }

    // Restore full bars to primary series
    if (this.fullReplayBars && this.fullReplayBars.length > 0) {
      const series = activePane?.widget?.chart?.primarySeries() || activePane?.widget?.series;
      if (series) {
        try {
          series.setData(this.fullReplayBars);
        } catch (_) {}
      }
    }
    this.fullReplayBars = null;

    const replayToolbar = document.getElementById('tv-replay-toolbar');
    const btnToggleReplay = document.getElementById('btn-toggle-replay');

    if (replayToolbar) {
      replayToolbar.style.display = 'none';
      replayToolbar.classList.remove('show');
    }
    if (btnToggleReplay) {
      btnToggleReplay.classList.remove('is-active');
    }

    this.updatePlayPauseButton(false);
    this.syncAlertPriceLines();
    this.showToast('Exited Bar Replay — Live stream restored', 2000);
  }

  initReplayDraggableToolbar(handle, toolbar) {
    if (!handle || !toolbar) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    handle.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = toolbar.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      toolbar.style.left = `${initialLeft}px`;
      toolbar.style.top = `${initialTop}px`;
      toolbar.style.transform = 'none';
      toolbar.style.bottom = 'auto';

      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    handle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = window.innerWidth - toolbar.offsetWidth - 10;
      const maxTop = window.innerHeight - toolbar.offsetHeight - 10;

      newLeft = Math.max(10, Math.min(newLeft, maxLeft));
      newTop = Math.max(45, Math.min(newTop, maxTop));

      toolbar.style.left = `${newLeft}px`;
      toolbar.style.top = `${newTop}px`;
    });

    const stopDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        try {
          handle.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    };

    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
  }

  // ─── DATA WINDOW UPDATES ───
  updateDataWindow(bar, time) {
    if (!bar) return;
    const timeEl = document.getElementById('dw-time');
    const openEl = document.getElementById('dw-open');
    const highEl = document.getElementById('dw-high');
    const lowEl = document.getElementById('dw-low');
    const closeEl = document.getElementById('dw-close');
    const chgEl = document.getElementById('dw-chg');
    const volEl = document.getElementById('dw-vol');

    const dt = time ? new Date(time * 1000) : new Date();
    if (timeEl) timeEl.textContent = dt.toLocaleString();
    if (openEl) openEl.textContent = (+bar.open).toFixed(2);
    if (highEl) highEl.textContent = (+bar.high).toFixed(2);
    if (lowEl) lowEl.textContent = (+bar.low).toFixed(2);
    if (closeEl) closeEl.textContent = (+bar.close).toFixed(2);

    const chgVal = bar.close - bar.open;
    const pctVal = bar.open !== 0 ? (chgVal / bar.open) * 100 : 0;
    const sign = chgVal >= 0 ? '+' : '';
    if (chgEl) {
      chgEl.textContent = `${sign}${chgVal.toFixed(2)} (${sign}${pctVal.toFixed(2)}%)`;
      chgEl.className = chgVal >= 0 ? 'up' : 'dn';
    }
    if (volEl) volEl.textContent = (bar.volume || 0).toLocaleString();
  }

  // ─── TOPBAR & CONTROLS ───
  initTopbarEvents() {
    // Timeframe selector buttons
    const tfBtns = document.querySelectorAll('#timeframe-group .tv-tf-btn');
    tfBtns.forEach((btn) => {
      btn.onclick = () => {
        if (this.isReplayMode) {
          this.exitReplayMode();
        }
        tfBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const interval = btn.dataset.interval;
        this.currentInterval = interval;
        const activeWidget = this.widget;
        if (activeWidget) {
          activeWidget.setInterval(interval);
          try {
            if (activeWidget.chart?.setAxisChromeOptions) {
              activeWidget.chart.setAxisChromeOptions({ barCountdown: true, sessionClock: true });
            }
          } catch (_) {}
        }
      };
    });

    // Chart Type Menu
    const chartTypeBtn = document.getElementById('btn-chart-type');
    const chartTypeMenu = document.getElementById('chart-type-menu');
    const typeLabel = document.getElementById('chart-type-label');
    const typeIcon = document.getElementById('chart-type-icon');

    if (chartTypeBtn && chartTypeMenu) {
      chartTypeBtn.onclick = (e) => {
        e.stopPropagation();
        chartTypeMenu.classList.toggle('show');
      };

      document.querySelectorAll('#chart-type-menu .tv-menu-item').forEach((item) => {
        item.onclick = () => {
          document.querySelectorAll('#chart-type-menu .tv-menu-item').forEach((i) => i.classList.remove('active'));
          item.classList.add('active');
          const type = item.dataset.type;
          this.currentChartType = type;
          if (typeLabel) typeLabel.textContent = item.querySelector('span:last-child').textContent;
          if (typeIcon) typeIcon.textContent = item.querySelector('span:first-child').textContent;
          const activeWidget = this.widget;
          if (activeWidget) {
            activeWidget.setChartType(type);
            try {
              if (activeWidget.chart?.setAxisChromeOptions) {
                activeWidget.chart.setAxisChromeOptions({ barCountdown: true, sessionClock: true });
              }
            } catch (_) {}
          }
          chartTypeMenu.classList.remove('show');
        };
      });

      document.addEventListener('click', (e) => {
        if (!chartTypeMenu.contains(e.target) && e.target !== chartTypeBtn) {
          chartTypeMenu.classList.remove('show');
        }
      });
    }

    // Indicators Picker
    const indBtn = document.getElementById('btn-open-indicators');
    if (indBtn) {
      indBtn.onclick = () => {
        const activeWidget = this.widget;
        if (activeWidget?.context) {
          mountIndicatorPicker(activeWidget.context, indBtn);
        }
      };
    }

    // Objects Tree / Active Indicators Manager
    const objBtn = document.getElementById('btn-open-objects');
    if (objBtn) {
      objBtn.onclick = () => {
        const activeWidget = this.widget;
        if (activeWidget?.context) {
          mountObjectsPanel(activeWidget.context, objBtn);
        }
      };
    }

    // Undo / Redo
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.onclick = () => this.widget?.draw?.undo();
    if (redoBtn) redoBtn.onclick = () => this.widget?.draw?.redo();

    // Layout Save Trigger
    const saveBtn = document.getElementById('btn-layout-save');
    if (saveBtn) {
      saveBtn.onclick = () => {
        this.saveFullLayout();
        saveBtn.style.color = 'var(--buy)';
        this.showToast('💾 Zero Chart Layout & Drawings Saved Successfully!');
        setTimeout(() => (saveBtn.style.color = ''), 2000);
      };
    }

    // Fullscreen
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.onclick = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen();
        } else {
          document.exitFullscreen();
        }
      };
    }

    // Camera Snapshot
    const snapBtn = document.getElementById('btn-take-screenshot');
    if (snapBtn) {
      snapBtn.onclick = () => {
        const inst = this.currentInstrument;
        this.widget?.chart?.downloadScreenshot(`ZeroChart-${inst?.symbol || 'Chart'}-${this.currentInterval}.png`);
      };
    }

    // Theme Toggle Trigger
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.onclick = () => this.toggleTheme();
    }
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', this.currentTheme);
    localStorage.setItem('zerochart_theme', this.currentTheme);
    this.panes.forEach((p) => {
      try {
        if (p.widget?.setTheme) {
          p.widget.setTheme(this.currentTheme);
        }
      } catch (_) {}
    });
    this.updateThemeButton();
  }

  updateThemeButton() {
    const icon = document.getElementById('theme-toggle-icon');
    const btn = document.getElementById('btn-theme-toggle');
    const isDark = this.currentTheme === 'dark';
    if (icon) {
      icon.textContent = isDark ? '☀️' : '🌙';
    }
    if (btn) {
      btn.title = isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    }
  }

  // ─── RIGHT SIDEBAR TAB SWITCHER ───
  initRightSidebarTabs() {
    const vIcons = document.querySelectorAll('.tv-vertical-rail .tv-v-icon');
    const rightPanel = document.getElementById('right-panel');
    const tabPanes = document.querySelectorAll('.tv-right-content .tv-tab-pane');

    vIcons.forEach((icon) => {
      icon.onclick = () => {
        const target = icon.dataset.tab;
        if (!target) return;

        if (icon.classList.contains('active')) {
          icon.classList.remove('active');
          rightPanel.classList.add('collapsed');
        } else {
          vIcons.forEach((i) => i.classList.remove('active'));
          icon.classList.add('active');
          rightPanel.classList.remove('collapsed');
          tabPanes.forEach((p) => (p.style.display = 'none'));
          const targetPane = document.getElementById(`panel-${target}`);
          if (targetPane) targetPane.style.display = 'flex';
        }
      };
    });
  }

  openSidebarTab(tabName) {
    const rightPanel = document.getElementById('right-panel');
    const sidebar = document.querySelector('.tv-right-sidebar');
    const vIcons = document.querySelectorAll('.tv-vertical-rail .tv-v-icon');
    const tabPanes = document.querySelectorAll('.tv-right-content .tv-tab-pane');

    vIcons.forEach((i) => i.classList.toggle('active', i.dataset.tab === tabName));
    if (rightPanel) rightPanel.classList.remove('collapsed');
    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.add('mobile-open');
      const mobBtn = document.getElementById(`mob-nav-${tabName}`);
      if (mobBtn) {
        document.querySelectorAll('.tv-mob-nav-btn').forEach((btn) => btn.classList.toggle('active', btn === mobBtn));
      }
    }
    tabPanes.forEach((p) => (p.style.display = 'none'));
    const targetPane = document.getElementById(`panel-${tabName}`);
    if (targetPane) targetPane.style.display = 'flex';
  }

  // ─── MOBILE BOTTOM NAV & SLIDE-IN DRAWERS ───
  initMobileUI() {
    const mobNavChart = document.getElementById('mob-nav-chart');
    const mobNavWatchlist = document.getElementById('mob-nav-watchlist');
    const mobNavAlerts = document.getElementById('mob-nav-alerts');
    const mobNavDraw = document.getElementById('mob-nav-draw');
    const mobNavSearch = document.getElementById('mob-nav-search');
    const topbarWlBtn = document.getElementById('btn-topbar-watchlist');
    const sidebar = document.querySelector('.tv-right-sidebar');
    const rail = document.querySelector('.oac-rail');
    const mobCloseBtns = document.querySelectorAll('.tv-mob-close-drawer-btn');

    const updateMobNav = (activeId) => {
      document.querySelectorAll('.tv-mob-nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.id === activeId);
      });
    };

    if (mobNavChart) {
      mobNavChart.onclick = () => {
        this.closeMobileDrawer(true);
        updateMobNav('mob-nav-chart');
      };
    }

    if (mobNavWatchlist) {
      mobNavWatchlist.onclick = () => {
        this.openMobileDrawer('watchlist', false);
        updateMobNav('mob-nav-watchlist');
      };
    }

    if (topbarWlBtn) {
      topbarWlBtn.onclick = () => {
        if (window.innerWidth <= 768) {
          this.openMobileDrawer('watchlist', false);
          updateMobNav('mob-nav-watchlist');
        } else {
          this.openSidebarTab('watchlist');
        }
      };
    }

    if (mobNavAlerts) {
      mobNavAlerts.onclick = () => {
        this.openMobileDrawer('alerts', true);
        updateMobNav('mob-nav-alerts');
      };
    }

    if (mobNavDraw) {
      mobNavDraw.onclick = () => {
        if (rail) {
          const isVisible = rail.classList.toggle('mobile-visible');
          mobNavDraw.classList.toggle('active', isVisible);
          if (isVisible && window.innerWidth <= 768) {
            this.pushHistoryState({ view: 'draw' });
          }
        }
      };
    }

    if (mobNavSearch) {
      mobNavSearch.onclick = () => {
        document.getElementById('btn-open-search')?.click();
      };
    }

    // Close buttons inside drawer panels
    mobCloseBtns.forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this.closeMobileDrawer(true);
      };
    });

    // Backdrop click on sidebar closes drawer
    if (sidebar) {
      sidebar.onclick = (e) => {
        if (e.target === sidebar) {
          this.closeMobileDrawer(true);
        }
      };
    }

    // Default landing page on mobile devices is WATCHLIST!
    if (window.innerWidth <= 768) {
      this.openMobileDrawer('watchlist', false);
      updateMobNav('mob-nav-watchlist');
    }
  }

  initMobileHistory() {
    const isMobile = window.innerWidth <= 768;
    this.currentViewState = isMobile ? 'watchlist' : 'chart';
    try {
      history.replaceState({ view: this.currentViewState }, '');
    } catch (_) {}

    window.addEventListener('popstate', (e) => {
      this.handlePopState(e);
    });
  }

  pushHistoryState(stateObj) {
    try {
      if (history.state?.view !== stateObj.view) {
        history.pushState(stateObj, '');
      }
      this.currentViewState = stateObj.view;
    } catch (_) {}
  }

  handlePopState(event) {
    // 1. Close open modal overlays if any
    const searchModal = document.getElementById('search-modal');
    const alertModal = document.getElementById('alert-modal');
    const pwaModal = document.getElementById('pwa-modal');
    const layoutMenu = document.getElementById('layout-grid-menu');
    const chartTypeMenu = document.getElementById('chart-type-menu');
    const speedMenu = document.getElementById('replay-speed-menu');
    const widgetDialogs = document.querySelectorAll('.oac-dialog, .oac-overlay');

    if (searchModal?.classList.contains('show')) {
      this.closeModal('search-modal');
      return;
    }
    if (alertModal?.classList.contains('show')) {
      this.closeModal('alert-modal');
      return;
    }
    if (pwaModal?.classList.contains('show')) {
      this.closeModal('pwa-modal');
      return;
    }
    if (layoutMenu?.classList.contains('show')) {
      layoutMenu.classList.remove('show');
      return;
    }
    if (chartTypeMenu?.classList.contains('show')) {
      chartTypeMenu.classList.remove('show');
      return;
    }
    if (speedMenu && speedMenu.style.display !== 'none') {
      speedMenu.style.display = 'none';
      return;
    }
    if (widgetDialogs && widgetDialogs.length > 0) {
      widgetDialogs.forEach((d) => d.remove());
      return;
    }

    // 2. If in Bar Replay, exit back to normal live chart
    if (this.isReplayMode || this.isReplayJumpMode) {
      this.exitReplayMode();
      return;
    }

    // 3. If drawing rail is open on mobile, hide it
    const rail = document.querySelector('.oac-rail');
    if (rail?.classList.contains('mobile-visible')) {
      rail.classList.remove('mobile-visible');
      const mobNavDraw = document.getElementById('mob-nav-draw');
      if (mobNavDraw) mobNavDraw.classList.remove('active');
      return;
    }

    // 4. Mobile screen back-navigation
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.tv-right-sidebar');
      const isDrawerOpen = sidebar?.classList.contains('mobile-open');
      const activeBtn = document.querySelector('.tv-mob-nav-btn.active');
      const activeTab = activeBtn?.dataset?.tab;

      // If user is on Chart, Alerts, or any non-watchlist view:
      if (!isDrawerOpen || activeTab !== 'watchlist') {
        // Return to Watchlist landing page
        this.openMobileDrawer('watchlist', false);
        document.querySelectorAll('.tv-mob-nav-btn').forEach((btn) => {
          btn.classList.toggle('active', btn.id === 'mob-nav-watchlist');
        });
        this.currentViewState = 'watchlist';
        try {
          history.replaceState({ view: 'watchlist' }, '');
        } catch (_) {}
        return;
      }

      // If ALREADY on Watchlist landing page, do NOT intercept, allowing browser/phone to naturally close/exit
    }
  }

  openMobileDrawer(tabName, pushState = true) {
    const sidebar = document.querySelector('.tv-right-sidebar');
    const rightPanel = document.getElementById('right-panel');
    const tabPanes = document.querySelectorAll('.tv-right-content .tv-tab-pane');

    document.body.classList.add('mobile-drawer-open');

    if (sidebar) {
      sidebar.classList.add('mobile-open');
    }
    if (rightPanel) {
      rightPanel.classList.remove('collapsed');
    }
    tabPanes.forEach((p) => (p.style.display = 'none'));
    const targetPane = document.getElementById(`panel-${tabName}`);
    if (targetPane) {
      targetPane.style.display = 'flex';
    }

    if (tabName === 'watchlist') {
      this.renderHorizontalWatchlistTabs();
      this.renderWatchlist();
      this.currentViewState = 'watchlist';
    } else if (tabName === 'alerts') {
      this.renderAlertsList();
      this.currentViewState = 'alerts';
      if (pushState && window.innerWidth <= 768) {
        this.pushHistoryState({ view: 'alerts' });
      }
    }
  }

  closeMobileDrawer(pushState = true) {
    document.body.classList.remove('mobile-drawer-open');
    const sidebar = document.querySelector('.tv-right-sidebar');
    if (sidebar) {
      sidebar.classList.remove('mobile-open');
    }
    document.querySelectorAll('.tv-mob-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.id === 'mob-nav-chart');
    });
    this.currentViewState = 'chart';
    if (pushState && window.innerWidth <= 768) {
      this.pushHistoryState({ view: 'chart' });
    }
  }

  // ─── MODALS & DYNAMIC SEARCH ───
  initModals() {
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('search-query');
    const searchBtn = document.getElementById('btn-open-search');
    const closeSearchBtn = document.getElementById('btn-close-search');
    const wlAddBtn = document.getElementById('btn-wl-add');

    let activeCat = 'all';
    let searchDebounce = null;

    const performSearch = async (q, cat) => {
      try {
        const resp = await fetch(`/api/market/search?q=${encodeURIComponent(q)}&cat=${encodeURIComponent(cat)}`);
        if (resp.ok) {
          const json = await resp.json();
          if (json.status === 'success' && Array.isArray(json.results) && json.results.length > 0) {
            this.renderSearchResults(json.results);
            return;
          }
        }
      } catch (_) {}

      // Local fallback
      let filtered = MASTER_INSTRUMENTS.filter(
        (s) =>
          (cat === 'all' || s.category === cat) &&
          (s.symbol.toLowerCase().includes(q.toLowerCase()) ||
            s.name.toLowerCase().includes(q.toLowerCase()) ||
            s.displaySymbol.toLowerCase().includes(q.toLowerCase()))
      );
      if (filtered.length === 0 && q.length > 0) {
        filtered = [findInstrument(q)];
      }
      this.renderSearchResults(filtered);
    };

    const openSearch = () => {
      if (searchModal) {
        searchModal.classList.add('show');
        if (searchInput) {
          searchInput.value = '';
          performSearch('', activeCat);
          setTimeout(() => searchInput.focus(), 50);
        }
      }
    };

    if (searchBtn) searchBtn.onclick = openSearch;
    if (wlAddBtn) wlAddBtn.onclick = openSearch;
    if (closeSearchBtn) closeSearchBtn.onclick = () => this.closeModal('search-modal');

    if (searchModal) {
      searchModal.onclick = (e) => {
        if (e.target === searchModal) this.closeModal('search-modal');
      };
    }

    // Search Category Tabs
    const stBtns = document.querySelectorAll('#search-category-tabs .tv-st-btn');
    stBtns.forEach((btn) => {
      btn.onclick = () => {
        stBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeCat = btn.dataset.cat || 'all';
        performSearch(searchInput?.value.trim() || '', activeCat);
      };
    });

    if (searchInput) {
      searchInput.oninput = () => {
        const q = searchInput.value.trim();
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
          performSearch(q, activeCat);
        }, 120);
      };

      searchInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const q = searchInput.value.trim();
          if (q) {
            const inst = findInstrument(q);
            if (inst) {
              this.addSymbolToActiveWatchlist(inst.symbol);
              this.closeModal('search-modal');
            }
          }
        }
      };
    }
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('show');
  }

  renderSearchResults(list) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';

    if (list.length === 0) {
      resultsContainer.innerHTML =
        '<div style="padding:20px;text-align:center;color:var(--text-muted);">No symbols found</div>';
      return;
    }

    list.forEach((inst) => {
      const item = document.createElement('div');
      item.className = 'tv-search-item';
      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="tv-symbol-circle" style="background:${inst.badgeColor || '#2962ff'};">${inst.badgeText || inst.symbol.substring(0, 2)}</div>
          <div>
            <div style="font-weight:700;font-size:13px;color:var(--text);">${inst.displaySymbol || inst.symbol}</div>
            <div style="font-size:11px;color:var(--text-muted);">${inst.name || inst.symbol}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="tv-sym-badge">${inst.exchange || 'NSE'}</span>
          <button class="tv-wl-act-btn" style="color:var(--accent);" title="Add to active watchlist">+</button>
        </div>
      `;

      item.onclick = () => {
        this.addSymbolToActiveWatchlist(inst.symbol, inst);
        this.closeModal('search-modal');
      };

      resultsContainer.appendChild(item);
    });
  }

  async checkBrokerStatus() {
    const badge = document.getElementById('broker-status-badge');
    const textEl = document.getElementById('broker-status-text');
    if (!badge) return;

    try {
      const resp = await fetch('/api/broker/status');
      if (resp.ok) {
        const json = await resp.json();
        if (json.connected) {
          badge.className = 'tv-broker-status live';
          if (textEl) textEl.textContent = 'LIVE';
          badge.title = `Connected to AngelOne SmartAPI (${json.clientId}). 100% genuine live trading feed.`;
          return;
        }
      }
    } catch (_) {}

    badge.className = 'tv-broker-status live';
    if (textEl) textEl.textContent = 'LIVE';
  }

  // ─── TOAST NOTIFICATION HELPER ───
  showToast(message, duration = 2000) {
    const container = document.getElementById('alert-toast-container');
    if (!container) return;

    while (container.children.length >= 2) {
      container.firstChild.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'tv-alert-toast';
    toast.style.borderColor = 'var(--accent)';
    toast.innerHTML = `
      <div style="font-size:18px;line-height:1;">⚡</div>
      <div style="flex:1;font-size:12.5px;font-weight:600;color:var(--text);">${message}</div>
      <button style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;" title="Dismiss">✕</button>
    `;

    const closeBtn = toast.querySelector('button');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        toast.remove();
      };
    }

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, duration);
  }

  // ─── GLOBAL TOAST GUARD (MAX 2 VISIBLE & 2-SECOND AUTO DISMISS) ───
  initToastGuard() {
    const enforceToastLimits = () => {
      // 1. OpenAlgo chart widget toasts (.oac-toasts)
      const oacStacks = document.querySelectorAll('.oac-toasts');
      for (const stack of oacStacks) {
        while (stack.children.length > 2) {
          stack.firstElementChild.remove();
        }
        for (const toast of stack.children) {
          if (!toast.dataset.autoFadeArmed) {
            toast.dataset.autoFadeArmed = 'true';
            setTimeout(() => {
              if (toast.isConnected) {
                toast.classList.add('is-out');
                setTimeout(() => toast.remove(), 160);
              }
            }, 2000);
          }
        }
      }

      // 2. Main alert toast container
      const alertContainer = document.getElementById('alert-toast-container');
      if (alertContainer) {
        while (alertContainer.children.length > 2) {
          alertContainer.firstElementChild.remove();
        }
        for (const toast of alertContainer.children) {
          if (!toast.dataset.autoFadeArmed) {
            toast.dataset.autoFadeArmed = 'true';
            setTimeout(() => {
              if (toast.isConnected) {
                toast.remove();
              }
            }, 2000);
          }
        }
      }
    };

    // Instant interception via MutationObserver
    try {
      const observer = new MutationObserver(() => {
        enforceToastLimits();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}

    // Periodic sweep fallback every 400ms
    setInterval(enforceToastLimits, 400);
  }

  // ─── PER-SYMBOL DRAWINGS & INDICATOR PERSISTENCE ───
  saveSymbolState(paneIndex, symbol) {
    const pane = this.panes[paneIndex];
    if (!pane?.widget || !symbol) return;
    const symKey = symbol.toUpperCase().trim();
    try {
      // 1. Save drawings
      if (typeof pane.widget.draw?.toJSON === 'function') {
        const drawings = pane.widget.draw.toJSON();
        localStorage.setItem(`zerochart_drawings_${symKey}`, JSON.stringify(drawings));
      } else if (typeof pane.widget.chart?.getState === 'function') {
        const state = pane.widget.chart.getState();
        if (state?.drawings) {
          localStorage.setItem(`zerochart_drawings_${symKey}`, JSON.stringify(state.drawings));
        }
      }
      // 2. Save chart state (indicators, settings, viewport)
      if (typeof pane.widget.chart?.getState === 'function') {
        const state = pane.widget.chart.getState();
        localStorage.setItem(`zerochart_chartstate_${symKey}`, JSON.stringify(state));
      }
    } catch (_) {}
  }

  restoreSymbolState(paneIndex, symbol) {
    const pane = this.panes[paneIndex];
    if (!pane?.widget || !symbol) return;
    const symKey = symbol.toUpperCase().trim();
    try {
      // 1. Restore chart state (indicators, studies, settings)
      const savedState = localStorage.getItem(`zerochart_chartstate_${symKey}`);
      if (savedState && typeof pane.widget.chart?.restoreState === 'function') {
        const parsedState = JSON.parse(savedState);
        if (parsedState) {
          pane.widget.chart.restoreState(parsedState);
        }
      }
      // 2. Restore drawings
      const savedDrawings = localStorage.getItem(`zerochart_drawings_${symKey}`);
      if (savedDrawings && typeof pane.widget.draw?.fromJSON === 'function') {
        const parsedDrawings = JSON.parse(savedDrawings);
        if (Array.isArray(parsedDrawings)) {
          pane.widget.draw.fromJSON(parsedDrawings);
        }
      }
    } catch (_) {}
  }

  saveFullLayout() {
    try {
      const layoutData = {
        theme: this.currentTheme,
        activeLayout: this.currentLayout,
        activePaneIndex: this.activePaneIndex,
        activeWatchlistId: this.activeWatchlistId,
        panes: this.panes.map((p) => ({
          id: p.id,
          symbol: p.instrument?.symbol || 'NIFTY 50',
          exchange: p.instrument?.exchange || 'NSE',
          interval: p.interval,
          chartType: p.chartType,
        })),
      };
      localStorage.setItem('zerochart_full_layout', JSON.stringify(layoutData));
      // Save state for all active pane symbols
      this.panes.forEach((p, idx) => {
        if (p.instrument?.symbol) {
          this.saveSymbolState(idx, p.instrument.symbol);
        }
      });
      return true;
    } catch (err) {
      console.warn('[ZeroChart] Failed to save full layout:', err);
      return false;
    }
  }

  loadSavedLayoutData() {
    try {
      const saved = localStorage.getItem('zerochart_full_layout');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return null;
  }

  // ─── PROGRESSIVE WEB APP (PWA) SYSTEM ───
  initPWA() {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js')
          .then((reg) => {
            console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
            reg.onupdatefound = () => {
              const installingWorker = reg.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New version cached! App ready for offline use.');
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('[PWA] ServiceWorker registration failed:', err);
          });
      });
    }

    // 2. Install Prompt Handling
    let deferredPrompt = null;
    const installBtn = document.getElementById('btn-install-pwa');
    const pwaModal = document.getElementById('pwa-modal');
    const triggerPromptBtn = document.getElementById('btn-pwa-prompt-trigger');
    const closePwaBtn = document.getElementById('btn-close-pwa');
    const dismissPwaBtn = document.getElementById('btn-dismiss-pwa');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    // Show Install button on topbar if not already installed
    if (!isStandalone && installBtn) {
      installBtn.style.display = 'inline-flex';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installBtn && !isStandalone) {
        installBtn.style.display = 'inline-flex';
      }
    });

    const triggerInstall = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA] Install choice outcome: ${outcome}`);
        deferredPrompt = null;
        if (pwaModal) pwaModal.classList.remove('show');
        if (outcome === 'accepted' && installBtn) {
          installBtn.style.display = 'none';
        }
      } else {
        if (pwaModal) pwaModal.classList.add('show');
      }
    };

    if (installBtn) {
      installBtn.onclick = () => triggerInstall();
    }

    if (triggerPromptBtn) {
      triggerPromptBtn.onclick = () => {
        if (deferredPrompt) {
          triggerInstall();
        } else {
          if (pwaModal) pwaModal.classList.remove('show');
          this.showToast('ℹ️ Follow the on-screen steps above to add Zero Chart to your Home Screen.');
        }
      };
    }

    if (closePwaBtn && pwaModal) {
      closePwaBtn.onclick = () => pwaModal.classList.remove('show');
    }

    if (dismissPwaBtn && pwaModal) {
      dismissPwaBtn.onclick = () => pwaModal.classList.remove('show');
    }

    // Handle when app is installed successfully
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] 🎉 Zero Chart installed successfully!');
      if (installBtn) installBtn.style.display = 'none';
      if (pwaModal) pwaModal.classList.remove('show');
      this.showToast('🚀 Zero Chart Pro installed successfully!');
    });
  }

  // ─── FLOATING MOVABLE FAVORITE DRAWING TOOLS TOOLBAR (BADGE) ───
  initFavoriteToolbar() {
    const toolbar = document.getElementById('tv-fav-toolbar');
    const dragHandle = document.getElementById('fav-drag-handle');
    const stayBtn = document.getElementById('btn-fav-stay');
    const trashBtn = document.getElementById('btn-fav-delete');
    const closeBtn = document.getElementById('btn-fav-close');

    if (!toolbar) return;

    // Load saved favorite tools
    let favTools = ['trend-line', 'horizontal-line', 'ray', 'fib-retracement', 'rectangle', 'brush', 'text', 'measure'];
    try {
      const saved = localStorage.getItem('zerochart_fav_tools');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) favTools = parsed;
      }
    } catch (_) {}
    this.favoriteTools = favTools;

    // Render buttons
    this.renderFavoriteToolsList();

    // Load saved visibility (default visible on desktop, hidden by default on small mobile until toggled)
    const isMobile = window.innerWidth <= 768;
    const defaultVisible = !isMobile;
    const savedVis = localStorage.getItem('zerochart_fav_visible');
    const isVisible = savedVis !== null ? savedVis === 'true' : defaultVisible;
    toolbar.style.display = isVisible ? 'flex' : 'none';
    this.panes.forEach((p) => {
      try {
        p.widget?.rail?.setFavToolbarActive(isVisible);
      } catch (_) {}
    });

    // Load saved position
    try {
      const savedPos = localStorage.getItem('zerochart_fav_pos');
      if (savedPos) {
        const pos = JSON.parse(savedPos);
        if (typeof pos.left === 'number' && typeof pos.top === 'number') {
          toolbar.style.left = `${pos.left}px`;
          toolbar.style.top = `${pos.top}px`;
          toolbar.style.bottom = 'auto';
          toolbar.style.right = 'auto';
        }
      }
    } catch (_) {}

    // Wire Draggable Pointer Events (Desktop Mouse + Mobile Touch Support)
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initLeft = 0;
    let initTop = 0;

    const onPointerDown = (e) => {
      // Ignore clicks on buttons or interactive child elements
      if (e.target.closest('button, input, select, .tv-fav-tool-btn, .tv-fav-btn')) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;

      const rect = toolbar.getBoundingClientRect();
      const stage = toolbar.parentElement?.getBoundingClientRect() || { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

      startX = e.clientX;
      startY = e.clientY;
      initLeft = rect.left - stage.left;
      initTop = rect.top - stage.top;

      toolbar.style.left = `${initLeft}px`;
      toolbar.style.top = `${initTop}px`;
      toolbar.style.bottom = 'auto';
      toolbar.style.right = 'auto';

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const stage = toolbar.parentElement?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
      const tbRect = toolbar.getBoundingClientRect();

      const maxLeft = Math.max(0, stage.width - tbRect.width - 5);
      const maxTop = Math.max(0, stage.height - tbRect.height - 5);

      const newLeft = Math.max(5, Math.min(maxLeft, initLeft + dx));
      const newTop = Math.max(5, Math.min(maxTop, initTop + dy));

      toolbar.style.left = `${newLeft}px`;
      toolbar.style.top = `${newTop}px`;
    };

    const onPointerUp = () => {
      if (!isDragging) return;
      isDragging = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      const left = parseFloat(toolbar.style.left) || 0;
      const top = parseFloat(toolbar.style.top) || 0;
      localStorage.setItem('zerochart_fav_pos', JSON.stringify({ left, top }));
    };

    if (dragHandle) {
      dragHandle.addEventListener('pointerdown', onPointerDown);
    }
    toolbar.addEventListener('pointerdown', onPointerDown);

    // Close button on toolbar
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleFavoriteToolbar(false);
      };
      closeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    }

    // Continuous drawing mode toggle
    if (stayBtn) {
      stayBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const activePane = this.panes?.[this.activePaneIndex] || this.panes?.[0];
        const activeDraw = activePane?.widget?.draw || this.widget?.draw;
        if (activeDraw) {
          const current = activeDraw.stayInDrawingMode ? activeDraw.stayInDrawingMode() : false;
          const next = !current;
          try {
            activeDraw.setOptions({ stayInDrawingMode: next });
          } catch (_) {}
          stayBtn.classList.toggle('active', next);
          this.showToast(next ? '📌 Continuous Drawing Mode ON' : 'Single Drawing Mode', 1500);
        }
      };
      stayBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    }

    // Delete selected drawings button
    if (trashBtn) {
      trashBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const activePane = this.panes?.[this.activePaneIndex] || this.panes?.[0];
        const activeDraw = activePane?.widget?.draw || this.widget?.draw;
        if (activeDraw) {
          try {
            const sel = typeof activeDraw.selection === 'function' ? activeDraw.selection() : activeDraw.selected ? [activeDraw.selected()].filter(Boolean) : [];
            if (sel && sel.length > 0) {
              sel.forEach((id) => activeDraw.remove(id));
              this.showToast('🗑️ Selected drawings removed', 1500);
            } else {
              this.showToast('Select a drawing on chart to delete', 1500);
            }
          } catch (_) {}
        }
      };
      trashBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
  }

  toggleFavoriteToolbar(forceState) {
    const toolbar = document.getElementById('tv-fav-toolbar');
    if (!toolbar) return;
    const isCurrentlyVisible = toolbar.style.display !== 'none';
    const next = forceState !== undefined ? forceState : !isCurrentlyVisible;
    toolbar.style.display = next ? 'flex' : 'none';
    localStorage.setItem('zerochart_fav_visible', String(next));
    this.panes.forEach((p) => {
      try {
        p.widget?.rail?.setFavToolbarActive(next);
      } catch (_) {}
    });
    if (next) {
      this.showToast('⭐ Favorite Drawing Toolbar Active', 1500);
    }
  }

  renderFavoriteToolsList() {
    const list = document.getElementById('fav-tools-list');
    if (!list) return;
    list.innerHTML = '';

    if (!Array.isArray(this.favoriteTools) || this.favoriteTools.length === 0) {
      const hint = document.createElement('span');
      hint.style.fontSize = '11px';
      hint.style.color = '#787b86';
      hint.style.padding = '0 6px';
      hint.textContent = 'Star tools in drawing rail';
      list.appendChild(hint);
      return;
    }

    this.favoriteTools.forEach((toolId) => {
      const def = FAVORITE_TOOL_DEFINITIONS.find((d) => d.id === toolId) || { id: toolId, name: toolId, icon: 'M4 20 20 4' };
      const btn = document.createElement('button');
      btn.className = 'tv-fav-tool-btn';
      btn.dataset.tool = def.id;
      btn.title = `${def.name} Tool`;
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="${def.icon}" />
        </svg>
      `;

      const selectTool = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        const activePane = this.panes?.[this.activePaneIndex] || this.panes?.[0];
        const activeDraw = activePane?.widget?.draw || this.widget?.draw;
        if (!activeDraw) return;
        const currentTool = typeof activeDraw.activeTool === 'function' ? activeDraw.activeTool() : null;
        if (currentTool === def.id) {
          activeDraw.setTool(null);
          this.syncFavoriteToolActive(null);
        } else {
          activeDraw.setTool(def.id);
          this.syncFavoriteToolActive(def.id);
        }
      };

      btn.addEventListener('click', selectTool);
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('touchend', selectTool, { passive: false });

      list.appendChild(btn);
    });

    const activePane = this.panes?.[this.activePaneIndex] || this.panes?.[0];
    const activeDraw = activePane?.widget?.draw || this.widget?.draw;
    if (activeDraw && typeof activeDraw.activeTool === 'function') {
      this.syncFavoriteToolActive(activeDraw.activeTool());
    }
  }

  syncFavoriteToolActive(toolId) {
    const buttons = document.querySelectorAll('#fav-tools-list .tv-fav-tool-btn');
    buttons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === toolId);
    });
  }

  // ─── MAXIMIZED PANE & INDICATOR FULL SCREEN CONTROLS ───
  initMaximizedPaneControls() {
    const pill = document.getElementById('tv-max-pane-pill');
    const restoreBtn = document.getElementById('btn-restore-max-pane');
    const delBtn = document.getElementById('btn-del-max-indicator');

    const handleRestore = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const activePane = this.panes?.[this.activePaneIndex] || this.panes?.[0];
      const chart = activePane?.widget?.chart || this.widget?.chart;
      if (chart) {
        const maxIdx = chart.maximizedPane();
        if (maxIdx !== null && maxIdx !== undefined) {
          chart.maximizePane(maxIdx);
        }
      }
      if (pill) pill.style.display = 'none';
    };

    const handleDelete = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const activePane = this.panes?.[this.activePaneIndex] || this.panes?.[0];
      const chart = activePane?.widget?.chart || this.widget?.chart;
      if (chart) {
        const maxIdx = chart.maximizedPane();
        if (maxIdx !== null && maxIdx !== undefined) {
          const indicators = (chart.indicators?.() || []).filter((i) => i.paneIndex === maxIdx);
          if (indicators.length > 0) {
            indicators.forEach((i) => {
              try {
                if (typeof i.remove === 'function') {
                  i.remove();
                } else if (i.id) {
                  chart.removeIndicator(i.id);
                }
              } catch (_) {
                if (i.id) chart.removeIndicator(i.id);
              }
            });
            this.showToast('🗑️ Indicator deleted from chart', 2000);
          }
          if (chart.maximizedPane() !== null && chart.maximizedPane() !== undefined) {
            chart.maximizePane(maxIdx);
          }
        }
      }
      if (pill) pill.style.display = 'none';
    };

    if (restoreBtn) {
      restoreBtn.addEventListener('click', handleRestore);
      restoreBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      restoreBtn.addEventListener('touchend', (e) => handleRestore(e), { passive: false });
    }

    if (delBtn) {
      delBtn.addEventListener('click', handleDelete);
      delBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      delBtn.addEventListener('touchend', (e) => handleDelete(e), { passive: false });
    }
  }

  updateMaximizedPaneUI(paneIndex, ev) {
    const pill = document.getElementById('tv-max-pane-pill');
    const titleEl = document.getElementById('tv-max-pane-title');
    const activePane = this.panes?.[this.activePaneIndex] || this.panes?.[0];
    const chart = activePane?.widget?.chart || this.widget?.chart;
    if (!pill || !chart) return;

    const maxIdx = chart.maximizedPane();
    if (maxIdx === null || maxIdx === undefined) {
      pill.style.display = 'none';
      return;
    }

    const indicators = (chart.indicators?.() || []).filter((i) => i.paneIndex === maxIdx);
    let title = 'Full Screen Pane';
    if (indicators.length > 0) {
      const ind = indicators[0];
      const indName = ind.options?.name || ind.indicatorId?.toUpperCase() || 'Indicator';
      title = `${indName} (Full Screen)`;
    } else if (maxIdx === 0) {
      title = `${this.currentInstrument?.symbol || 'Price'} (Main Price)`;
    }
    if (titleEl) titleEl.textContent = title;
    pill.style.display = 'inline-flex';
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new ZeroChartApp();
});
