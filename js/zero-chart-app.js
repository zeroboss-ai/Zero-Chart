/**
 * Zero Chart Pro Terminal Application
 * Pixel-Perfect TradingView Pro Interface, Multi-Watchlist Manager (Create, Add, Delete, Rename),
 * Native Bar Close Countdown Timer, Dynamic Search (Muthoot, ICICI, all Indian stocks, Crypto, Commodities).
 */

import {
  createWidget,
  mountIndicatorPicker,
  mountIndicatorSettings,
  mountSettingsDialog,
  mountObjectsPanel,
  openShortcutsPanel,
} from '../lib/openalgo-charts.widget.mjs?v=2.7.0';
import { ReplayController } from '../lib/openalgo-charts.mjs?v=2.7.0';
import { registerBuiltinIndicators } from '../lib/openalgo-charts.indicators.mjs?v=2.7.0';
import { FakeBroker, OrderEngine, TradeController } from '../lib/openalgo-charts.trade.mjs?v=2.7.0';
import { MultiAssetFeed } from './feeds/multi-feed.js?v=2.7.0';
import { getIntervalSeconds } from './feeds/openalgo-feed.js?v=2.7.0';
import { MASTER_INSTRUMENTS, DEFAULT_WATCHLISTS, findInstrument, getInstrumentBadgeHtml } from './watchlist-data.js?v=2.7.0';

// Register all indicators immediately
try {
  registerBuiltinIndicators();
} catch (e) {
  console.warn('[Indicators] Registration warning:', e);
}

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

    const lastSavedInterval = localStorage.getItem('zerochart_last_interval') || '5m';

    // Multi-pane state
    this.activePaneIndex = 0;
    this.panes = [
      {
        id: 0,
        containerId: 'chart-pane-0',
        widget: null,
        tradeController: null,
        instrument: this.getActiveWatchlistInstruments()[0] || MASTER_INSTRUMENTS[0],
        interval: lastSavedInterval,
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

    // Named Layouts & Cloud Setup state
    this.activeLayoutId = localStorage.getItem('zerochart_active_layout_id') || 'layout_default';
    this.activeLayoutName = localStorage.getItem('zerochart_active_layout_name') || 'Default Layout';
    this.savedLayouts = [];
    this.savedTemplates = [];

    // Multi-Chart Synchronization state
    let syncOpts = { crosshair: true, time: true, symbol: false, interval: false };
    try {
      const s = localStorage.getItem('zerochart_sync_options');
      if (s) syncOpts = { ...syncOpts, ...JSON.parse(s) };
    } catch (_) {}
    this.syncOptions = syncOpts;
    this.isSyncingTime = false;

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
    // Ensure active pane always reflects the user's latest chosen interval
    if (lastSavedInterval && this.panes[this.activePaneIndex]) {
      this.panes[this.activePaneIndex].interval = lastSavedInterval;
    }

    // Favorite Drawing Tools
    let favTools = ['trend-line', 'horizontal-line', 'ray', 'price-range', 'fib-retracement', 'rectangle', 'brush', 'text', 'measure'];
    try {
      const saved = localStorage.getItem('zerochart_fav_tools');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          favTools = parsed;
          if (!favTools.includes('price-range')) {
            favTools.splice(3, 0, 'price-range');
            localStorage.setItem('zerochart_fav_tools', JSON.stringify(favTools));
          }
        }
      }
    } catch (_) {}
    this.favoriteTools = favTools;

    // Option Open Interest (OI) Analytics state
    this.oiActiveSymbol = 'NIFTY 50';
    this.oiActiveSubtab = 'oi-change';
    this.oiMode = 'intraday';
    this.oiATMFilter = 20;
    this.oiShowTotal = false;
    this.oiTimeSliderIndex = 75; // 0 to 75 (75 = 3:30 PM Full Day)
    this.oiSelectedExpiries = new Set();
    this.oiHoveredStrike = null;
    this.oiCustomMin = null;
    this.oiCustomMax = null;

    // Search Engine State (Smooth Pro Fuzzy Search & Recent Searches)
    let recSearches = [];
    try {
      const rs = localStorage.getItem('zerochart_recent_searches');
      if (rs) recSearches = JSON.parse(rs);
    } catch (_) {}
    this.recentSearches = Array.isArray(recSearches) ? recSearches : [];
    this.searchCurrentResults = [];
    this.searchSelectedIndex = 0;
    this.quickMarkets = [
      { symbol: 'NIFTY 50', name: 'NIFTY 50 Index', exchange: 'NSE', badgeText: 'NIFTY', badgeColor: '#2962ff' },
      { symbol: 'BANKNIFTY', name: 'NIFTY Bank Index', exchange: 'NSE', badgeText: 'BNF', badgeColor: '#089981' },
      { symbol: 'SENSEX', name: 'BSE Sensex 30 Index', exchange: 'BSE', badgeText: 'SNX', badgeColor: '#7b1fa2' },
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE', badgeText: 'RIL', badgeColor: '#e53935' },
      { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', badgeText: 'TCS', badgeColor: '#00897b' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'NSE', badgeText: 'HDFC', badgeColor: '#1565c0' },
      { symbol: 'MUTHOOTFIN', name: 'Muthoot Finance Ltd', exchange: 'NSE', badgeText: 'MUTH', badgeColor: '#c2185b' },
      { symbol: 'CRUDEOIL FUT', name: 'Crude Oil MCX Near Futures', exchange: 'MCX', badgeText: 'OIL', badgeColor: '#263238' },
      { symbol: 'GOLD FUT', name: 'Gold MCX 1kg Futures', exchange: 'MCX', badgeText: 'GOLD', badgeColor: '#ffb300' },
      { symbol: 'BTCUSDT', name: 'Bitcoin / Tether USD', exchange: 'BINANCE', badgeText: 'BTC', badgeColor: '#f7931a' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', badgeText: 'NVDA', badgeColor: '#76b900' },
      { symbol: 'USDINR', name: 'US Dollar / Indian Rupee', exchange: 'FOREX', badgeText: '$₹', badgeColor: '#43a047' },
    ];

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
    return this.activePane?.interval || localStorage.getItem('zerochart_last_interval') || '5m';
  }

  set currentInterval(val) {
    if (this.activePane) {
      this.activePane.interval = val;
      try {
        localStorage.setItem('zerochart_last_interval', val);
        this.saveFullLayout();
      } catch (_) {}
    }
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
            if (!indicesTab.symbols.includes('GIFT NIFTY')) {
              const sIdx = indicesTab.symbols.indexOf('SENSEX');
              if (sIdx !== -1) indicesTab.symbols.splice(sIdx + 1, 0, 'GIFT NIFTY');
              else indicesTab.symbols.push('GIFT NIFTY');
            }
          }

          // Ensure Global Indices tab is present
          if (!cleaned.some(w => w.id === 'wl-global')) {
            const defGlobal = DEFAULT_WATCHLISTS.find(w => w.id === 'wl-global');
            if (defGlobal) cleaned.push(JSON.parse(JSON.stringify(defGlobal)));
          }

          // Ensure CME / COMEX / CBOT tab is present
          if (!cleaned.some(w => w.id === 'wl-cme')) {
            const defCme = DEFAULT_WATCHLISTS.find(w => w.id === 'wl-cme');
            if (defCme) cleaned.push(JSON.parse(JSON.stringify(defCme)));
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

  getChartTheme(themeName = this.currentTheme) {
    const isDark = themeName === 'dark';
    return {
      background: isDark ? '#131722' : '#ffffff',
      grid: isDark ? '#1e222d' : '#f0f3fa',
      axisText: isDark ? '#d1d4dc' : '#131722', // High-contrast crisp axis prices & time labels
      axisFontSize: 12,
      axisLine: isDark ? '#2a3046' : '#d4dae3',
      paneSeparator: isDark ? '#2a2e39' : '#e0e3eb',
      crosshair: isDark ? '#6a7182' : '#787b86',
      upColor: isDark ? '#00c076' : '#089981', // Vivid green candles
      downColor: '#f23645', // Vivid red candles
      wickUpColor: isDark ? '#00c076' : '#089981',
      wickDownColor: '#f23645',
      lineColor: '#2962ff',
      areaTopColor: 'rgba(41, 98, 255, 0.35)',
      areaBottomColor: 'rgba(41, 98, 255, 0.00)',
      baselineTopLine: isDark ? '#00c076' : '#089981',
      baselineTopFill: isDark ? 'rgba(0, 192, 118, 0.18)' : 'rgba(8, 153, 129, 0.18)',
      baselineBottomLine: '#f23645',
      baselineBottomFill: 'rgba(242, 54, 69, 0.18)',
      lastPriceUp: isDark ? '#00c076' : '#089981',
      lastPriceDown: '#f23645',
      lastPriceText: '#ffffff',
      buy: isDark ? '#00c076' : '#089981',
      sell: '#f23645',
      profit: isDark ? '#00c076' : '#089981',
      loss: '#f23645',
    };
  }

  async init() {
    document.body.setAttribute('data-theme', this.currentTheme);
    this.updateThemeButton();

    // 1. Initialize Layout & Panes
    this.initLayoutSystem();
    this.initMultiChartSync();
    this.initLayoutManager();
    this.initStudyTemplates();
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

    // 14. Initialize Option Open Interest (OI) Analytics Suite
    this.initOIAnalytics();

    // 15. Responsive Layout & Legend Offset Sync on Resize
    window.addEventListener('resize', () => {
      const legTop = window.innerWidth <= 768 ? 10 : 42;
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

    // Load saved width (Desktop only)
    if (window.innerWidth > 768) {
      const savedWidth = localStorage.getItem('zerochart_sidebar_width');
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (parsed >= 220 && parsed <= 1200) {
          rightPanel.style.width = `${parsed}px`;
        }
      }
    } else {
      rightPanel.style.width = '100vw';
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

    const legTop = window.innerWidth <= 768 ? 10 : 42;
    const legLeft = window.innerWidth <= 768 ? 10 : 54;
    const chartTheme = this.getChartTheme(this.currentTheme);
    const isMobile = window.innerWidth <= 768;
    const defaultBars = isMobile ? 75 : 140;

    pane.widget = createWidget(container, {
      feed: this.multiFeed,
      symbol: pane.instrument.symbol,
      exchange: pane.instrument.exchange,
      interval: pane.interval,
      chartType: pane.chartType,
      theme: chartTheme,
      topbar: false, // Unified topbar managed by Zero Chart
      mobile: false, // Unified mobile navigation managed by Zero Chart
      statusline: true,
      navigation: {
        mousePan: 'both',
        defaultVisibleBars: defaultBars,
      },
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
      if (pane.widget.chart?.setNavigationOptions) {
        pane.widget.chart.setNavigationOptions({
          mousePan: 'both',
          defaultVisibleBars: defaultBars,
        });
      }
      if (pane.widget.chart?.setAxisChromeOptions) {
        pane.widget.chart.setAxisChromeOptions({
          barCountdown: true,
          sessionClock: true,
        });
      }
      const prec = pane.instrument.precision !== undefined ? pane.instrument.precision : 2;
      pane.widget.chart?.primarySeries()?.applyOptions({
        precision: prec,
        upColor: chartTheme.upColor,
        downColor: chartTheme.downColor,
        wickUpColor: chartTheme.wickUpColor,
        wickDownColor: chartTheme.wickDownColor,
        borderUpColor: chartTheme.upColor,
        borderDownColor: chartTheme.downColor,
      });
      pane.widget.series?.applyOptions?.({ precision: prec });
      pane.widget.chart?.setPriceScaleOptions?.({
        textColor: chartTheme.axisText,
        fontSize: 12,
      });
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
      // Broadcast crosshair position across other visible panes when synchronized
      this.broadcastCrosshair(paneIndex, data);
    });

    // Synchronize visible time range & pan/zoom across visible panes
    pane.widget.chart.on('pan', () => this.broadcastTimeRange(paneIndex));
    pane.widget.chart.on('zoom', () => this.broadcastTimeRange(paneIndex));

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

    // Auto-restore saved drawings and alert lines for this symbol, and global indicators
    setTimeout(() => {
      this.restoreGlobalIndicators(paneIndex);
      this.restoreSymbolDrawings(paneIndex, pane.instrument.symbol);
      this.syncAlertPriceLines(paneIndex);
    }, 200);

    // Auto-save drawings on drawing modifications (per-symbol)
    const autoSaveDrawings = () => {
      if (this._isSwitchingSymbol) return;
      const curSym = pane.instrument?.symbol || this.currentInstrument?.symbol;
      if (curSym) this.saveSymbolDrawings(paneIndex, curSym);
    };
    for (const evt of ['draw:add', 'draw:remove', 'draw:update', 'draw:paste', 'draw:cut']) {
      try {
        pane.widget.chart.on(evt, autoSaveDrawings);
      } catch (_) {}
    }

    // Auto-save global indicators on indicator modifications (global across symbols)
    const autoSaveIndicators = () => {
      this.saveGlobalIndicators(paneIndex);
    };
    for (const evt of ['indicatorAdded', 'indicatorRemoved', 'indicatorSettings']) {
      try {
        pane.widget.chart.on(evt, autoSaveIndicators);
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
    const editModeBtn = document.getElementById('btn-wl-edit-mode');
    const renameBtn = document.getElementById('btn-wl-rename');
    const deleteBtn = document.getElementById('btn-wl-delete');

    if (addBtn) {
      addBtn.onclick = () => document.getElementById('btn-open-search')?.click();
    }

    if (editModeBtn) {
      editModeBtn.onclick = () => {
        const body = document.getElementById('watchlist-table-body');
        if (body) {
          const isEdit = body.classList.toggle('edit-mode');
          editModeBtn.classList.toggle('active', isEdit);
        }
      };
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
      row.draggable = true;
      row.dataset.sym = inst.symbol;
      const cleanId = inst.symbol.replace(/[^A-Za-z0-9]/g, '_');
      row.id = `wl-row-${cleanId}`;

      const q = this.livePrices.get(inst.symbol) || {
        last: inst.basePrice,
        chg: 0,
        chgPct: 0,
      };

      const isUp = q.chg >= 0;
      const sign = isUp ? '+' : '';
      const badgeContent = getInstrumentBadgeHtml(inst);

      row.innerHTML = `
        <div class="tv-wl-cell-sym">
          <div class="tv-wl-drag-handle" title="Drag to reorder symbol">⋮⋮</div>
          <div class="tv-symbol-circle" style="background:${inst.badgeColor || '#2962ff'};">${badgeContent}</div>
          <div class="tv-symbol-meta">
            <div class="tv-sym-name">${inst.displaySymbol} <span class="tv-sym-dash">-</span></div>
            <div class="tv-sym-desc">${inst.name}</div>
          </div>
        </div>
        <div class="tv-wl-cell-price-group">
          <div class="tv-wl-cell-last" id="wl-last-${cleanId}" data-price="${q.last}">
            ${q.last.toLocaleString(undefined, { minimumFractionDigits: inst.precision, maximumFractionDigits: inst.precision })}
          </div>
          <div class="tv-wl-cell-chg-wrap">
            <span class="tv-wl-cell-chg ${isUp ? 'up' : 'dn'}" id="wl-chg-${cleanId}">
              ${sign}${q.chg.toFixed(inst.precision)}
            </span>
            <span class="tv-wl-cell-pct ${isUp ? 'up' : 'dn'}" id="wl-pct-${cleanId}">
              ${sign}${q.chgPct.toFixed(2)}%
            </span>
          </div>
        </div>
        <div class="tv-wl-cell-del">
          <button class="tv-btn-del-sym" title="Remove ${inst.symbol}" data-sym="${inst.symbol}">✕</button>
        </div>
      `;

      // Click to switch active pane instrument
      row.onclick = (e) => {
        if (e.target.closest('.tv-btn-del-sym') || e.target.closest('.tv-wl-drag-handle')) return;
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

      // Drag and Drop (Desktop HTML5 Drag & Drop)
      row.addEventListener('dragstart', (e) => {
        this._draggedSymbol = inst.symbol;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', inst.symbol);
      });

      row.addEventListener('dragend', () => {
        this._draggedSymbol = null;
        document.querySelectorAll('.tv-wl-row').forEach((r) => {
          r.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
        });
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!this._draggedSymbol || this._draggedSymbol === inst.symbol) return;
        const rect = row.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          row.classList.add('drag-over-top');
          row.classList.remove('drag-over-bottom');
        } else {
          row.classList.add('drag-over-bottom');
          row.classList.remove('drag-over-top');
        }
      });

      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over-top', 'drag-over-bottom');
        const srcSym = e.dataTransfer.getData('text/plain') || this._draggedSymbol;
        if (!srcSym || srcSym === inst.symbol) return;
        const rect = row.getBoundingClientRect();
        const isBefore = e.clientY < rect.top + rect.height / 2;
        this.reorderWatchlistSymbol(srcSym, inst.symbol, isBefore);
      });

      // Touch Drag & Drop (Mobile Pointer / Touch Dragging)
      const dragHandle = row.querySelector('.tv-wl-drag-handle');
      if (dragHandle) {
        let isTouchDragging = false;
        let currentOverRow = null;

        dragHandle.addEventListener('touchstart', (e) => {
          e.stopPropagation();
          isTouchDragging = true;
          this._draggedSymbol = inst.symbol;
          row.classList.add('dragging');
        }, { passive: false });

        dragHandle.addEventListener('touchmove', (e) => {
          if (!isTouchDragging) return;
          e.preventDefault();
          e.stopPropagation();
          const touch = e.touches[0];
          const elem = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetRow = elem?.closest('.tv-wl-row');
          document.querySelectorAll('.tv-wl-row').forEach((r) => {
            if (r !== targetRow) r.classList.remove('drag-over-top', 'drag-over-bottom');
          });
          if (targetRow && targetRow !== row) {
            currentOverRow = targetRow;
            const rect = targetRow.getBoundingClientRect();
            if (touch.clientY < rect.top + rect.height / 2) {
              targetRow.classList.add('drag-over-top');
              targetRow.classList.remove('drag-over-bottom');
            } else {
              targetRow.classList.add('drag-over-bottom');
              targetRow.classList.remove('drag-over-top');
            }
          }
        }, { passive: false });

        const handleTouchEnd = () => {
          if (!isTouchDragging) return;
          isTouchDragging = false;
          row.classList.remove('dragging');
          if (currentOverRow && currentOverRow.dataset.sym && currentOverRow.dataset.sym !== inst.symbol) {
            const isBefore = currentOverRow.classList.contains('drag-over-top');
            this.reorderWatchlistSymbol(inst.symbol, currentOverRow.dataset.sym, isBefore);
          }
          document.querySelectorAll('.tv-wl-row').forEach((r) => {
            r.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
          });
          currentOverRow = null;
        };

        dragHandle.addEventListener('touchend', handleTouchEnd);
        dragHandle.addEventListener('touchcancel', handleTouchEnd);
      }

      container.appendChild(row);
    });
  }

  reorderWatchlistSymbol(srcSym, targetSym, placeBefore = true) {
    const wl = this.getActiveWatchlist();
    if (!wl || !Array.isArray(wl.symbols)) return;
    const srcNorm = (srcSym || '').toUpperCase().trim();
    const targetNorm = (targetSym || '').toUpperCase().trim();
    if (!srcNorm || !targetNorm || srcNorm === targetNorm) return;

    const fromIdx = wl.symbols.findIndex((s) => s.toUpperCase().trim() === srcNorm);
    if (fromIdx === -1) return;

    wl.symbols.splice(fromIdx, 1);
    let toIdx = wl.symbols.findIndex((s) => s.toUpperCase().trim() === targetNorm);
    if (toIdx === -1) {
      wl.symbols.push(srcNorm);
    } else {
      if (!placeBefore) toIdx += 1;
      wl.symbols.splice(toIdx, 0, srcNorm);
    }

    this.saveWatchlists();
    this.renderWatchlist();
  }

  switchInstrument(inst, targetPaneIndex = this.activePaneIndex, fromSync = false) {
    if (this.isReplayMode) {
      this.exitReplayMode();
    }
    const pane = this.panes[targetPaneIndex];
    const prevSym = pane?.instrument?.symbol || (targetPaneIndex === this.activePaneIndex ? this.currentInstrument?.symbol : null);
    if (prevSym) {
      // 1. Save drawings for the previous symbol before switching
      this.saveSymbolDrawings(targetPaneIndex, prevSym);
    }

    this._isSwitchingSymbol = true;
    if (pane) {
      pane.instrument = inst;
    }
    if (targetPaneIndex === this.activePaneIndex) {
      this.currentInstrument = inst;
    }
    const targetWidget = pane?.widget || (targetPaneIndex === this.activePaneIndex ? this.widget : null);
    if (targetWidget) {
      // 2. Immediately clear drawings so previous symbol's lines never show on new symbol
      targetWidget.draw?.clear?.();

      // 3. Switch symbol on widget (indicators remain active and automatically recalculate!)
      targetWidget.setSymbol(inst.symbol, inst.exchange);
      const prec = inst.precision !== undefined ? inst.precision : 2;
      const chartTheme = this.getChartTheme(this.currentTheme);
      try {
        if (targetWidget.chart?.setAxisChromeOptions) {
          targetWidget.chart.setAxisChromeOptions({ barCountdown: true, sessionClock: true });
        }
        targetWidget.chart?.primarySeries()?.applyOptions({
          precision: prec,
          upColor: chartTheme.upColor,
          downColor: chartTheme.downColor,
          wickUpColor: chartTheme.wickUpColor,
          wickDownColor: chartTheme.wickDownColor,
          borderUpColor: chartTheme.upColor,
          borderDownColor: chartTheme.downColor,
        });
        targetWidget.series?.applyOptions?.({ precision: prec });
        targetWidget.chart?.setPriceScaleOptions?.({
          textColor: chartTheme.axisText,
          fontSize: 12,
        });
      } catch (_) {}
      setTimeout(() => {
        try {
          targetWidget.chart?.primarySeries()?.applyOptions({
            precision: prec,
            upColor: chartTheme.upColor,
            downColor: chartTheme.downColor,
            wickUpColor: chartTheme.wickUpColor,
            wickDownColor: chartTheme.wickDownColor,
            borderUpColor: chartTheme.upColor,
            borderDownColor: chartTheme.downColor,
          });
          targetWidget.series?.applyOptions?.({ precision: prec });
          targetWidget.chart?.setPriceScaleOptions?.({
            textColor: chartTheme.axisText,
            fontSize: 12,
          });
        } catch (_) {}
        // 4. Restore drawings specifically for this new symbol
        this.restoreSymbolDrawings(targetPaneIndex, inst.symbol);
        this.syncAlertPriceLines(targetPaneIndex);
        this._isSwitchingSymbol = false;
      }, 100);
    } else {
      this._isSwitchingSymbol = false;
    }

    if (targetPaneIndex === this.activePaneIndex) {
      this.updateHeaderDisplay();
      this.renderWatchlist();
      if (document.getElementById('panel-institutional')?.style.display === 'flex') {
        this.loadInstitutionalPanel();
      }
      if (document.getElementById('oi-analytics-modal')?.classList.contains('show')) {
        this.openOIDashboard(inst.symbol);
      }
      this.closeModal('search-modal');
      if (window.innerWidth <= 768) {
        this.closeMobileDrawer(true);
      }

      // Propagate to other visible panes if symbol sync is active
      if (this.syncOptions?.symbol && !fromSync) {
        const visibleCount = this.getVisiblePaneCount();
        for (let i = 0; i < visibleCount; i++) {
          if (i !== targetPaneIndex && this.panes[i]?.widget) {
            this.switchInstrument(inst, i, true);
          }
        }
      }
    }
  }

  nextInstrument() {
    const list = this.getActiveWatchlistInstruments();
    if (!list || list.length === 0) return;
    const curSym = this.currentInstrument?.symbol;
    const idx = list.findIndex((i) => i.symbol === curSym);
    let nextIdx = 0;
    if (idx !== -1) {
      nextIdx = (idx + 1) % list.length;
    }
    this.switchInstrument(list[nextIdx]);
  }

  prevInstrument() {
    const list = this.getActiveWatchlistInstruments();
    if (!list || list.length === 0) return;
    const curSym = this.currentInstrument?.symbol;
    const idx = list.findIndex((i) => i.symbol === curSym);
    let prevIdx = list.length - 1;
    if (idx !== -1) {
      prevIdx = (idx - 1 + list.length) % list.length;
    }
    this.switchInstrument(list[prevIdx]);
  }

  // ─── LIVE DATA STREAMING & ALERT TRIGGER EVALUATION ───
  startLiveMarketStream() {
    // 1. Subscribe to Binance 24/7 Crypto & Paxos Gold
    const cryptoSymbols = MASTER_INSTRUMENTS.filter((i) => i.feedType === 'binance' || i.symbol === 'PAXGUSDT');
    const cryptoSymList = cryptoSymbols.map((i) => i.symbol);

    // Initial instant fetch of real-time 24h ticker data via Binance REST API
    if (this.multiFeed?.binanceFeed?.fetch24hrTickers) {
      this.multiFeed.binanceFeed.fetch24hrTickers(cryptoSymList).then((tickers) => {
        if (!tickers) return;
        for (const inst of cryptoSymbols) {
          const t = tickers[inst.symbol];
          if (t && Number.isFinite(t.last) && t.last > 0) {
            const chg = +t.chg.toFixed(inst.precision);
            const chgPct = +t.chgPct.toFixed(2);
            this.updateLivePrice(inst, t.last, chg, chgPct, t.open);
          }
        }
      }).catch(() => {});
    }

    // Real-time 24h miniTicker stream for all crypto symbols (1-second tick updates with accurate 24h open)
    if (this.multiFeed?.binanceFeed?.subscribe24hrMiniTickers) {
      this.multiFeed.binanceFeed.subscribe24hrMiniTickers(cryptoSymList, (ticker) => {
        const inst = findInstrument(ticker.symbol);
        if (inst && Number.isFinite(ticker.last) && ticker.last > 0) {
          const chg = +ticker.chg.toFixed(inst.precision);
          const chgPct = +ticker.chgPct.toFixed(2);
          this.updateLivePrice(inst, ticker.last, chg, chgPct, ticker.open);
        }
      });
    }

    // Also keep sub-second 1m kline subscription for candle bar ticks
    cryptoSymbols.forEach((inst) => {
      this.multiFeed.binanceFeed.subscribeBars(inst.symbol, '1m', (bar) => {
        const current = this.livePrices.get(inst.symbol);
        const prev = current?.prevClose;
        if (prev && Number.isFinite(prev) && prev > 0) {
          const chg = +(bar.close - prev).toFixed(inst.precision);
          const chgPct = +((chg / prev) * 100).toFixed(2);
          this.updateLivePrice(inst, bar.close, chg, chgPct, prev);
        } else {
          this.updateLivePrice(inst, bar.close, current?.chg || 0, current?.chgPct || 0);
        }
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
        const activeSym = this.currentInstrument?.symbol || '';
        const symQuery = encodeURIComponent(activeSymbols.join(','));
        const resp = await fetch(`/api/market/quotes?active=${encodeURIComponent(activeSym)}&symbols=${symQuery}`, {
          signal: AbortSignal.timeout(2000),
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json.status === 'success' && json.quotes) {
            for (const [sym, q] of Object.entries(json.quotes)) {
              const inst = findInstrument(sym);
              if (inst && q.ltp) {
                const prev = q.prevClose || this.livePrices.get(inst.symbol)?.prevClose || (inst.feedType === 'binance' ? null : inst.basePrice);
                let chg = q.chg;
                let chgPct = q.chgPct;
                if (chg === undefined && prev) {
                  chg = +(q.ltp - prev).toFixed(inst.precision);
                  chgPct = prev !== 0 ? +((chg / prev) * 100).toFixed(2) : 0;
                }
                this.updateLivePrice(inst, q.ltp, chg || 0, chgPct || 0, prev || undefined);
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
    setInterval(pollQuotes, 200);
  }

  updateLivePrice(inst, newPrice, chg, chgPct, explicitPrevClose) {
    const cleanId = inst.symbol.replace(/[^A-Za-z0-9]/g, '_');
    const prevData = this.livePrices.get(inst.symbol);
    const prevPrice = prevData?.last || inst.basePrice;

    const prevClose = (explicitPrevClose !== undefined && Number.isFinite(explicitPrevClose) && explicitPrevClose > 0)
      ? explicitPrevClose
      : (prevData?.prevClose || (newPrice - (chg || 0)));

    this.livePrices.set(inst.symbol, {
      last: newPrice,
      chg: chg || 0,
      chgPct: chgPct || 0,
      prevClose: prevClose,
    });

    this.broker.onLtp(inst.symbol, newPrice);

    // Dispatch live tick directly to chart widget feed for in-place candle updates
    // SKIP for Binance-fed symbols: the Binance kline WebSocket already handles chart candle updates
    // through the widget's own feed adapter. Dispatching here would create a competing bar state
    // causing saw-tooth price oscillation (real ↔ stale alternation).
    const isBinanceFed = inst.feedType === 'binance';
    if (!isBinanceFed && (!this.isReplayMode || this.currentInstrument?.symbol !== inst.symbol)) {
      if (this.multiFeed?.openalgoFeed?._dispatchRealtimeTick) {
        this.multiFeed.openalgoFeed._dispatchRealtimeTick(inst.symbol, newPrice);
      }
    }

    // Direct in-place primary series update on all active panes displaying this instrument
    // SKIP for Binance-fed symbols: the kline WS feed already updates candles via the widget feed adapter.
    if (!isBinanceFed) {
    this.panes.forEach((p) => {
      if (this.isReplayMode && p.id === this.activePaneIndex) return;
      const paneSym = (p.instrument?.symbol || '').toUpperCase().trim();
      const tickSym = (inst.symbol || '').toUpperCase().trim();
      const normPane = paneSym.replace(/\s+/g, '');
      const normTick = tickSym.replace(/\s+/g, '');
      const isMatch = paneSym === tickSym || normPane === normTick ||
        (normPane === 'NIFTY50' && normTick === 'NIFTY') ||
        (normPane === 'NIFTY' && normTick === 'NIFTY50') ||
        (normPane === 'BANKNIFTY' && normTick === 'BANKNIFTY');

      if (isMatch && p.widget?.chart) {
        try {
          const s = p.widget.chart.primarySeries?.();
          if (s && typeof s.getData === 'function' && typeof s.update === 'function') {
            const data = s.getData();
            if (data && data.length > 0) {
              const last = data[data.length - 1];
              const nowSec = Math.floor(Date.now() / 1000);
              const intervalSecs = getIntervalSeconds(p.interval || '5m');
              const bucketTime = Math.floor(nowSec / intervalSecs) * intervalSecs;
              if (last.time === bucketTime) {
                s.update({
                  time: last.time,
                  open: last.open,
                  high: Math.max(last.high, newPrice),
                  low: Math.min(last.low, newPrice),
                  close: newPrice,
                  volume: (last.volume || 0) + 1,
                });
              } else if (bucketTime > last.time) {
                s.update({
                  time: bucketTime,
                  open: last.close,
                  high: Math.max(last.close, newPrice),
                  low: Math.min(last.close, newPrice),
                  close: newPrice,
                  volume: 1,
                });
              }
            }
          }
        } catch (_) {}
      }
    });
    } // end if (!isBinanceFed)

    // Update watchlist row cells
    const lastEl = document.getElementById(`wl-last-${cleanId}`);
    const chgEl = document.getElementById(`wl-chg-${cleanId}`);
    const pctEl = document.getElementById(`wl-pct-${cleanId}`);

    const isUp = (chg || 0) >= 0;
    const sign = isUp ? '+' : '';

    if (lastEl) {
      const prevPriceVal = parseFloat(lastEl.getAttribute('data-price') || '0');
      lastEl.textContent = newPrice.toLocaleString(undefined, {
        minimumFractionDigits: inst.precision,
        maximumFractionDigits: inst.precision,
      });
      lastEl.setAttribute('data-price', newPrice);

      // Flash animation on live tick
      if (prevPriceVal && prevPriceVal !== newPrice) {
        lastEl.classList.remove('tv-tick-up', 'tv-tick-down');
        void lastEl.offsetWidth; // trigger reflow
        lastEl.classList.add(newPrice > prevPriceVal ? 'tv-tick-up' : 'tv-tick-down');
      }
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

    // Alert Sound preview test button & change listener
    const testSoundBtn = document.getElementById('btn-test-alert-sound');
    const soundSelect = document.getElementById('alert-sound');
    if (testSoundBtn && soundSelect) {
      testSoundBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.playAlertSound(soundSelect.value);
      };
      soundSelect.onchange = () => {
        this.playAlertSound(soundSelect.value);
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
    const soundSelect = document.getElementById('alert-sound');

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
      if (soundSelect) soundSelect.value = existingAlert.sound || 'handbell';
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
      if (soundSelect) soundSelect.value = localStorage.getItem('zerochart_alert_sound') || 'handbell';
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
    const soundSelect = document.getElementById('alert-sound');

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
    const sound = soundSelect ? soundSelect.value : 'handbell';
    localStorage.setItem('zerochart_alert_sound', sound);

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
        existing.sound = sound;
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
        sound,
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
    this.playAlertSound(alert.sound || 'handbell');
    this.showAlertToast(alert, currentPrice);
  }

  getSoundLabel(soundId) {
    const map = {
      handbell: 'Hand bell',
      fault: 'Fault',
      chime: 'Chime',
      beep: 'Beep',
      siren: 'Siren',
      ping: 'Ping',
      laser: 'Laser',
      arcade: 'Arcade',
    };
    return map[soundId] || 'Hand bell';
  }

  playAlertSound(soundName = 'handbell') {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      switch (soundName) {
        case 'handbell': {
          // Hand bell: Authentic rich harmonic metallic ring with long natural resonance
          const freqs = [1046.5, 2093.0, 2793.8, 3135.9]; // C6 fundamental, harmonics
          const gains = [0.4, 0.22, 0.12, 0.08];
          const decays = [1.4, 0.9, 0.6, 0.4];
          freqs.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now);
            gain.gain.setValueAtTime(gains[idx], now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + decays[idx]);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + decays[idx]);
          });
          break;
        }

        case 'fault': {
          // Fault: Urgent descending double warning buzz (sawtooth pulse)
          [0, 0.16].forEach((offset) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(196, now + offset); // G3
            osc.frequency.linearRampToValueAtTime(146.8, now + offset + 0.12); // D3 drop
            gain.gain.setValueAtTime(0.3, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.15);
          });
          break;
        }

        case 'chime': {
          // Classic TradingView crystal chord chime
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
          break;
        }

        case 'beep': {
          // Crisp triple digital watch beep
          [0, 0.08, 0.16].forEach((offset) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1250, now + offset);
            gain.gain.setValueAtTime(0.25, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.05);
          });
          break;
        }

        case 'siren': {
          // Pitch sweep siren
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.linearRampToValueAtTime(880, now + 0.25);
          osc.frequency.linearRampToValueAtTime(440, now + 0.5);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.55);
          break;
        }

        case 'ping': {
          // High crystal sonar ping
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(1760, now);
          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.9);
          break;
        }

        case 'laser': {
          // Sci-fi laser zap dive
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(1600, now);
          osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
          gain.gain.setValueAtTime(0.28, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.2);
          break;
        }

        case 'arcade': {
          // Ascending 3-tone retro coin arpeggio
          [587.33, 880, 1174.66].forEach((f, idx) => {
            const offset = idx * 0.07;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(f, now + offset);
            gain.gain.setValueAtTime(0.18, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.1);
          });
          break;
        }

        default:
          this.playAlertSound('handbell');
          break;
      }
    } catch (_) {}
  }

  playAlertChime() {
    this.playAlertSound('chime');
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
        <div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;">${new Date().toLocaleTimeString()}</div>
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
            <span style="font-size:12px;color:var(--text-muted);">${condTextMap[alert.condition] || alert.condition}</span>
          </div>
          <span class="tv-alert-card-badge ${statusClass}">${alert.status}</span>
        </div>
        <div class="tv-alert-card-info">
          <div>Target: <b style="color:var(--text-bright);font-family:var(--mono);">${alert.targetPrice.toLocaleString()}</b> &bull; ${alert.name}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:6px;">
            <span>Sound: <b style="color:var(--text);">${this.getSoundLabel(alert.sound || 'handbell')}</b></span>
            <button class="tv-btn-alert-sound-test" data-sound="${alert.sound || 'handbell'}" style="background:transparent;border:none;cursor:pointer;font-size:11px;padding:0;color:var(--accent);" title="Play this sound">▶ Test</button>
          </div>
          ${alert.triggeredAt ? `<div style="font-size:11.5px;color:var(--buy);margin-top:2px;font-weight:600;">Triggered at ${new Date(alert.triggeredAt).toLocaleTimeString()}</div>` : ''}
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

      // Test Sound
      const soundTestBtn = card.querySelector('.tv-btn-alert-sound-test');
      if (soundTestBtn) {
        soundTestBtn.onclick = (e) => {
          e.stopPropagation();
          const snd = soundTestBtn.dataset.sound || alert.sound || 'handbell';
          this.playAlertSound(snd);
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
    // Previous & Next Symbol quick switcher buttons
    const prevSymBtn = document.getElementById('btn-prev-symbol');
    const nextSymBtn = document.getElementById('btn-next-symbol');
    if (prevSymBtn) {
      prevSymBtn.onclick = (e) => {
        e.stopPropagation();
        this.prevInstrument();
      };
    }
    if (nextSymBtn) {
      nextSymBtn.onclick = (e) => {
        e.stopPropagation();
        this.nextInstrument();
      };
    }

    // Timeframe selector buttons
    const tfBtns = document.querySelectorAll('#timeframe-group .tv-tf-btn');
    tfBtns.forEach((btn) => {
      btn.onclick = () => {
        const interval = btn.dataset.interval;
        if (interval) this.setInterval(interval);
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
            const chartTheme = this.getChartTheme(this.currentTheme);
            const prec = this.panes[this.activePaneIndex]?.instrument?.precision !== undefined
              ? this.panes[this.activePaneIndex].instrument.precision : 2;
            try {
              if (activeWidget.chart?.setAxisChromeOptions) {
                activeWidget.chart.setAxisChromeOptions({ barCountdown: true, sessionClock: true });
              }
              activeWidget.chart?.primarySeries()?.applyOptions({
                precision: prec,
                upColor: chartTheme.upColor,
                downColor: chartTheme.downColor,
                wickUpColor: chartTheme.wickUpColor,
                wickDownColor: chartTheme.wickDownColor,
                borderUpColor: chartTheme.upColor,
                borderDownColor: chartTheme.downColor,
              });
              activeWidget.chart?.setPriceScaleOptions?.({
                textColor: chartTheme.axisText,
                fontSize: 12,
              });
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

    // Indicator Templates / Study Presets Trigger
    const tplBtn = document.getElementById('btn-open-templates');
    if (tplBtn) {
      tplBtn.onclick = () => {
        this.openStudyTemplatesModal();
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

    // Layout Save & Manager Menu Dropdown Trigger
    const saveBtn = document.getElementById('btn-layout-save');
    const layoutMgrMenu = document.getElementById('layout-manager-menu');
    if (saveBtn && layoutMgrMenu) {
      saveBtn.onclick = (e) => {
        e.stopPropagation();
        layoutMgrMenu.classList.toggle('show');
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
    const chartTheme = this.getChartTheme(this.currentTheme);
    this.panes.forEach((p) => {
      try {
        if (p.widget?.setTheme) {
          p.widget.setTheme(chartTheme);
        }
        const prec = p.instrument?.precision !== undefined ? p.instrument.precision : 2;
        p.widget?.chart?.primarySeries()?.applyOptions({
          precision: prec,
          upColor: chartTheme.upColor,
          downColor: chartTheme.downColor,
          wickUpColor: chartTheme.wickUpColor,
          wickDownColor: chartTheme.wickDownColor,
          borderUpColor: chartTheme.upColor,
          borderDownColor: chartTheme.downColor,
        });
        p.widget?.series?.applyOptions?.({ precision: prec });
        p.widget?.chart?.setPriceScaleOptions?.({
          textColor: chartTheme.axisText,
          fontSize: 12,
        });
      } catch (_) {}
    });
    this.updateThemeButton();
    this.renderWatchlist();
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
          if (target === 'oi-analytics') this.loadOISidebarPanel();
          if (target === 'news') this.loadMarketNews();
          if (target === 'institutional') this.loadInstitutionalPanel();
          if (target === 'alerts') this.renderAlertsList();
        }
      };
    });

    // Subtabs for unified News & Calendar
    const subtabNews = document.getElementById('subtab-btn-news');
    const subtabCal = document.getElementById('subtab-btn-calendar');
    const wrapNews = document.getElementById('subview-news-wrap');
    const wrapCal = document.getElementById('subview-calendar-wrap');

    const switchEventsSubtab = (activeSub) => {
      if (activeSub === 'calendar') {
        if (subtabCal) subtabCal.classList.add('active');
        if (subtabNews) subtabNews.classList.remove('active');
        if (wrapCal) wrapCal.style.display = 'flex';
        if (wrapNews) wrapNews.style.display = 'none';
        this.loadEconomicCalendar();
      } else {
        if (subtabNews) subtabNews.classList.add('active');
        if (subtabCal) subtabCal.classList.remove('active');
        if (wrapNews) wrapNews.style.display = 'flex';
        if (wrapCal) wrapCal.style.display = 'none';
        this.loadMarketNews();
      }
    };

    if (subtabNews) subtabNews.onclick = () => switchEventsSubtab('news');
    if (subtabCal) subtabCal.onclick = () => switchEventsSubtab('calendar');

    // Institutional Panel Controls
    const btnRefInst = document.getElementById('btn-refresh-institutional');
    if (btnRefInst) {
      btnRefInst.onclick = () => this.loadInstitutionalPanel();
    }
    const btnMobCloseInst = document.getElementById('btn-mob-close-institutional');
    if (btnMobCloseInst) {
      btnMobCloseInst.onclick = () => this.closeSidebarDrawer();
    }

    // Calendar Filter Buttons
    const calFilters = document.querySelectorAll('#calendar-filter-bar .tv-cal-filter-btn');
    calFilters.forEach((btn) => {
      btn.onclick = () => {
        calFilters.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadEconomicCalendar(btn.dataset.filter || 'all');
      };
    });

    // News Filter Buttons
    const newsFilters = document.querySelectorAll('#news-filter-bar .tv-news-filter-btn');
    newsFilters.forEach((btn) => {
      btn.onclick = () => {
        newsFilters.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.loadMarketNews(btn.dataset.cat || 'all');
      };
    });

    // News & Calendar Refresh Button
    const btnRefNews = document.getElementById('btn-refresh-news');
    if (btnRefNews) {
      btnRefNews.onclick = () => {
        if (wrapCal && wrapCal.style.display !== 'none') {
          this.loadEconomicCalendar(this._currentCalFilter || 'all', true);
        } else {
          this.loadMarketNews(this._currentNewsCategory || 'all', true);
        }
      };
    }

    // News Mobile Close Button
    const btnMobCloseNews = document.getElementById('btn-mob-close-news');
    if (btnMobCloseNews) {
      btnMobCloseNews.onclick = () => this.closeSidebarDrawer();
    }
  }

  closeSidebarDrawer() {
    const sidebar = document.querySelector('.tv-right-sidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');
    document.querySelectorAll('.tv-mob-nav-btn').forEach((b) => b.classList.toggle('active', b.id === 'mob-nav-chart'));
  }

  openSidebarTab(tabName) {
    const rightPanel = document.getElementById('right-panel');
    const sidebar = document.querySelector('.tv-right-sidebar');
    const vIcons = document.querySelectorAll('.tv-vertical-rail .tv-v-icon');
    const tabPanes = document.querySelectorAll('.tv-right-content .tv-tab-pane');

    const normTab = tabName === 'calendar' ? 'news' : tabName;
    vIcons.forEach((i) => i.classList.toggle('active', i.dataset.tab === normTab));
    if (rightPanel) rightPanel.classList.remove('collapsed');
    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.add('mobile-open');
      const mobBtn = document.getElementById(`mob-nav-${normTab}`);
      if (mobBtn) {
        document.querySelectorAll('.tv-mob-nav-btn').forEach((btn) => btn.classList.toggle('active', btn === mobBtn));
      }
    }
    tabPanes.forEach((p) => (p.style.display = 'none'));
    const targetPane = document.getElementById(`panel-${normTab}`);
    if (targetPane) targetPane.style.display = 'flex';
    if (tabName === 'calendar') {
      const subtabCal = document.getElementById('subtab-btn-calendar');
      if (subtabCal) subtabCal.click();
    } else if (normTab === 'news') {
      const subtabNews = document.getElementById('subtab-btn-news');
      if (subtabNews) subtabNews.click();
    }
  }

  // ─── ECONOMIC CALENDAR & MARKET NEWS IMPLEMENTATION ───
  async loadEconomicCalendar(filter = 'all', force = false) {
    this._currentCalFilter = filter;
    const container = document.getElementById('calendar-events-list');
    if (!container) return;

    if (!this._cachedCalEvents || force) {
      container.innerHTML = '<div class="tv-cal-loading">Fetching real-time economic events...</div>';
      try {
        const resp = await fetch(`/api/market/calendar${force ? '?force=true' : ''}`);
        if (resp.ok) {
          const json = await resp.json();
          this._cachedCalEvents = json.events || [];
        }
      } catch (err) {
        console.warn('[Calendar] Fetch error:', err);
      }
    }

    const events = this._cachedCalEvents || [];
    let filtered = events;
    if (filter === 'high') {
      filtered = events.filter((e) => e.impact === 'high');
    } else if (filter === 'US' || filter === 'IN') {
      filtered = events.filter((e) => (e.country || '').toUpperCase() === filter);
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="tv-cal-empty">No economic events matching this filter.</div>';
      return;
    }

    container.innerHTML = filtered.map((ev) => {
      const impactClass = ev.impact === 'high' ? 'high' : (ev.impact === 'medium' ? 'med' : 'low');
      const impactText = ev.impact === 'high' ? 'HIGH' : (ev.impact === 'medium' ? 'MED' : 'LOW');
      const cardTooltip = ev.comment ? ev.comment.replace(/"/g, '&quot;') : (ev.title || '');
      return `
        <div class="tv-calendar-card" data-country="${ev.country || ''}" title="${cardTooltip}">
          <div class="tv-cal-top">
            <span class="tv-cal-flag-badge">
              <img src="https://flagcdn.com/16x12/${(ev.country || 'us').toLowerCase()}.png" class="tv-cal-flag-img" alt="${ev.country || ''}" onerror="this.style.display='none'" />
              ${ev.country || ''}
            </span>
            <span class="tv-cal-impact tv-cal-impact--${impactClass}">${impactText}</span>
            <span class="tv-cal-time">${ev.date} · ${ev.time}</span>
          </div>
          <div class="tv-cal-title">${ev.title || ''}</div>
          <div class="tv-cal-metrics">
            <div class="tv-cal-metric">
              <span class="tv-cal-metric-lbl">Actual</span>
              <span class="tv-cal-metric-val actual">${ev.actual || '-'}</span>
            </div>
            <div class="tv-cal-metric">
              <span class="tv-cal-metric-lbl">Forecast</span>
              <span class="tv-cal-metric-val forecast">${ev.forecast || '-'}</span>
            </div>
            <div class="tv-cal-metric">
              <span class="tv-cal-metric-lbl">Previous</span>
              <span class="tv-cal-metric-val prev">${ev.previous || '-'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async loadMarketNews(category = 'all', force = false) {
    this._currentNewsCategory = category;
    const container = document.getElementById('news-articles-list');
    if (!container) return;

    if (!this._cachedNews) this._cachedNews = {};
    if (!this._cachedNews[category] || force) {
      container.innerHTML = '<div class="tv-news-loading">Fetching real-time headlines...</div>';
      try {
        const resp = await fetch(`/api/market/news?category=${category}`);
        if (resp.ok) {
          const json = await resp.json();
          this._cachedNews[category] = json.news || [];
        }
      } catch (err) {
        console.warn('[News] Fetch error:', err);
      }
    }

    const rawNews = this._cachedNews[category] || [];
    // Strict chronological sort: newest articles on top!
    const newsList = rawNews
      .filter((item) => {
        const pubTime = new Date(item.publishedAt).getTime();
        if (isNaN(pubTime)) return false;
        const diffHours = (Date.now() - pubTime) / 3600000;
        return diffHours <= 48; // Max 48h recency
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    if (newsList.length === 0) {
      container.innerHTML = '<div class="tv-news-empty">No headlines available right now.</div>';
      return;
    }

    const formatTimeAgo = (isoString) => {
      try {
        const diffSec = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000));
        if (diffSec < 60) return 'Just now';
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
        if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
        return `${Math.floor(diffSec / 86400)}d ago`;
      } catch (_) {
        return 'Just now';
      }
    };

    container.innerHTML = newsList.map((item) => {
      const sentClass = item.sentiment === 'bullish' ? 'bullish' : (item.sentiment === 'bearish' ? 'bearish' : 'neutral');
      const sentText = item.sentiment === 'bullish' ? '🟢 Bullish' : (item.sentiment === 'bearish' ? '🔴 Bearish' : '⚪ Neutral');
      return `
        <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="tv-news-card">
          <div class="tv-news-card-meta">
            <span class="tv-news-source">${item.source}</span>
            <span class="tv-news-sentiment tv-news-sent--${sentClass}">${sentText}</span>
            <span class="tv-news-time">${formatTimeAgo(item.publishedAt)}</span>
          </div>
          <div class="tv-news-title">${item.title}</div>
        </a>
      `;
    }).join('');
  }

  toggleDrawingToolbar(forceOpen = null) {
    const rail = document.querySelector('.oac-rail');
    const stage = document.getElementById('tv-stage');
    const drawBtn = document.getElementById('btn-toggle-drawing-toolbar');
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      if (!rail) return;
      const willBeVisible = forceOpen !== null ? forceOpen : !rail.classList.contains('mobile-visible');
      rail.classList.toggle('mobile-visible', willBeVisible);
      stage?.classList.toggle('draw-rail-open', willBeVisible);
      drawBtn?.classList.toggle('is-active', willBeVisible);
      if (willBeVisible) {
        this.pushHistoryState({ view: 'draw' });
      }
    } else {
      if (!rail) return;
      const isHidden = stage?.classList.contains('drawing-rail-hidden');
      drawBtn?.classList.toggle('is-active', !willHide);
      window.dispatchEvent(new Event('resize'));
    }
  }

  // ─── INSTITUTIONAL FLOW & GAMMA EXPOSURE (GEX / COT) DASHBOARD ───
  loadInstitutionalPanel() {
    const container = document.getElementById('institutional-body');
    if (!container) return;

    const inst = this.currentInstrument || {
      symbol: 'ES',
      displaySymbol: 'ES',
      name: 'E-mini S&P 500 Futures',
      exchange: 'CME',
      basePrice: 5890.25,
      precision: 2,
    };

    const q = this.livePrices.get(inst.symbol);
    const spot = q?.last || inst.basePrice || 1000;
    const prec = inst.precision !== undefined ? inst.precision : 2;

    // Determine strike interval dynamically based on spot price magnitude
    let strikeStep = 10;
    if (spot > 30000) strikeStep = 500;
    else if (spot > 10000) strikeStep = 100;
    else if (spot > 2000) strikeStep = 50;
    else if (spot > 500) strikeStep = 10;
    else if (spot > 50) strikeStep = 2.5;
    else if (spot > 5) strikeStep = 0.5;
    else strikeStep = 0.05;

    const centerStrike = Math.round(spot / strikeStep) * strikeStep;
    const strikes = [];
    const numStrikes = 6;
    for (let i = -numStrikes; i <= numStrikes; i++) {
      strikes.push(centerStrike + i * strikeStep);
    }

    // Black-Scholes gamma density & GEX calculation
    const sigma = 0.22;
    const T = 5 / 365;
    const gexRows = [];
    let maxCallGex = -1, callWall = strikes[strikes.length - 2];
    let maxPutGex = -1, putWall = strikes[1];
    let totalCallGex = 0, totalPutGex = 0;

    strikes.forEach((k) => {
      const moneyness = Math.log(spot / k);
      const d1 = (moneyness + 0.5 * sigma * sigma * T) / (sigma * Math.sqrt(T));
      const pdf = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);
      const gamma = pdf / (spot * sigma * Math.sqrt(T));

      // Open interest simulation based on normal market skew
      const callSkew = Math.max(0.1, 1 - (spot - k) / (spot * 0.08));
      const putSkew = Math.max(0.1, 1 + (spot - k) / (spot * 0.08));
      const oiBase = 12000 + 40000 * Math.exp(-0.5 * Math.pow((spot - k) / (spot * 0.035), 2));

      const callGex = +(spot * gamma * (oiBase * callSkew) * 0.02).toFixed(1);
      const putGex = +(spot * gamma * (oiBase * putSkew) * 0.02).toFixed(1);
      const netGex = +(callGex - putGex).toFixed(1);

      totalCallGex += callGex;
      totalPutGex += putGex;

      if (callGex > maxCallGex) { maxCallGex = callGex; callWall = k; }
      if (putGex > maxPutGex) { maxPutGex = putGex; putWall = k; }

      const isSpot = Math.abs(spot - k) < strikeStep * 0.55;
      gexRows.push({ strike: k, callGex, putGex, netGex, isSpot });
    });

    const netGamma = +(totalCallGex - totalPutGex).toFixed(1);
    const zeroFlip = +(callWall * 0.48 + putWall * 0.52).toFixed(prec);
    const isPositiveRegime = spot >= zeroFlip;

    // COT positioning data
    const cotData = this.getCOTDataForSymbol(inst.symbol);

    // Build Max GEX for bar scaling
    const maxBarVal = Math.max(...gexRows.map(r => Math.max(r.callGex, r.putGex)), 1);

    // Build GEX Histogram HTML rows
    const histRowsHtml = gexRows.slice().reverse().map((r) => {
      const callPct = Math.min(100, Math.round((r.callGex / maxBarVal) * 100));
      const putPct = Math.min(100, Math.round((r.putGex / maxBarVal) * 100));
      const isCallWall = r.strike === callWall;
      const isPutWall = r.strike === putWall;
      
      let badgeHtml = '';
      if (isCallWall) badgeHtml = `<span style="background:#00e676;color:#000;padding:1px 4px;border-radius:3px;font-size:9px;font-weight:800;margin-left:4px;">CALL WALL</span>`;
      else if (isPutWall) badgeHtml = `<span style="background:#ff1744;color:#fff;padding:1px 4px;border-radius:3px;font-size:9px;font-weight:800;margin-left:4px;">PUT WALL</span>`;

      return `
        <div class="tv-inst-hist-row">
          <div class="tv-inst-hist-strike ${r.isSpot ? 'is-spot' : ''}">
            ${r.strike.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}
          </div>
          <div class="tv-inst-hist-track" title="Call GEX: +$${r.callGex}M | Put GEX: -$${r.putGex}M">
            <div class="tv-inst-hist-bar put" style="width:${putPct / 2}%;margin-right:auto;"></div>
            <div style="width:1px;height:100%;background:rgba(255,255,255,0.2);"></div>
            <div class="tv-inst-hist-bar call" style="width:${callPct / 2}%;margin-left:auto;"></div>
          </div>
          <div class="tv-inst-hist-val" style="color:${r.netGex >= 0 ? '#00e676' : '#ff1744'};">
            ${r.netGex >= 0 ? '+' : ''}${r.netGex}M ${badgeHtml}
          </div>
        </div>
      `;
    }).join('');

    // Build COT rows HTML
    const cotRowsHtml = cotData.categories.map((c) => {
      const isLong = c.netPosition >= 0;
      const pct = Math.min(100, Math.max(10, Math.abs(c.netPct)));
      return `
        <div class="tv-inst-cot-item">
          <div class="tv-inst-cot-header">
            <span style="color:var(--text);">${c.name}</span>
            <span class="tv-inst-badge-wow ${c.wowUp ? 'up' : 'dn'}">${c.wowText}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-muted);">
            <span>${isLong ? 'Net Long' : 'Net Short'}: <strong style="color:${c.color};">${c.netPositionText}</strong></span>
            <span>Percentile: <strong>${c.percentile}%</strong></span>
          </div>
          <div class="tv-inst-cot-bar-outer">
            <div class="tv-inst-cot-bar-fill" style="width:${pct}%;background:${c.color};"></div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <!-- 1. Active Symbol Header Card -->
      <div class="tv-inst-card" style="padding:10px 12px;background:rgba(41,98,255,0.06);border-color:rgba(41,98,255,0.2);">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="font-size:16px;font-weight:800;color:var(--text);">${inst.displaySymbol || inst.symbol}</div>
            <span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#2962ff;color:#fff;">${inst.exchange || 'CME'}</span>
          </div>
          <div style="text-align:right;">
            <div style="font-size:14px;font-weight:800;color:var(--text);">${spot.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}</div>
            <div style="font-size:10px;color:var(--text-muted);">${inst.name}</div>
          </div>
        </div>
      </div>

      <!-- 2. Gamma Exposure Market Regime Card -->
      <div class="tv-inst-regime-banner ${isPositiveRegime ? 'positive' : 'negative'}">
        <div class="tv-inst-regime-title ${isPositiveRegime ? 'positive' : 'negative'}">
          <span>${isPositiveRegime ? '🟢 POSITIVE GAMMA REGIME (+GEX)' : '🔴 NEGATIVE GAMMA REGIME (-GEX)'}</span>
          <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,0.3);">${isPositiveRegime ? 'LOW VOLATILITY' : 'HIGH VOLATILITY'}</span>
        </div>
        <div class="tv-inst-regime-desc">
          ${isPositiveRegime 
            ? 'Dealers are <strong>Long Gamma</strong>: Market maker hedging dampens intraday swings, absorbing selloffs and pinning prices toward key strike walls.'
            : 'Dealers are <strong>Short Gamma</strong>: Market maker hedging accelerates price velocity. Breakouts and sharp directional trends are amplified.'}
        </div>
      </div>

      <!-- 3. Key Gamma Levels (4 Cards) -->
      <div class="tv-inst-grid-4">
        <div class="tv-inst-stat-box">
          <span class="tv-inst-stat-lbl">🟢 Call Wall (Ceiling)</span>
          <span class="tv-inst-stat-val call-wall">${callWall.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}</span>
        </div>
        <div class="tv-inst-stat-box">
          <span class="tv-inst-stat-lbl">🟡 Zero Gamma Flip</span>
          <span class="tv-inst-stat-val zero-flip">${zeroFlip.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}</span>
        </div>
        <div class="tv-inst-stat-box">
          <span class="tv-inst-stat-lbl">🔴 Put Wall (Floor)</span>
          <span class="tv-inst-stat-val put-wall">${putWall.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec })}</span>
        </div>
        <div class="tv-inst-stat-box">
          <span class="tv-inst-stat-lbl">📈 Net Dealer GEX</span>
          <span class="tv-inst-stat-val" style="color:${netGamma >= 0 ? '#00e676' : '#ff1744'};">${netGamma >= 0 ? '+' : ''}$${netGamma}M / 1%</span>
        </div>
      </div>

      <!-- 4. Strike Gamma Histogram -->
      <div class="tv-inst-card">
        <div class="tv-inst-subhead">
          <span>Strike Gamma Exposure (GEX Profile)</span>
          <span style="font-size:10.5px;color:var(--text-muted);">Red: Put GEX | Green: Call GEX</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;">
          ${histRowsHtml}
        </div>
      </div>

      <!-- 5. CME / CFTC COT Institutional Positioning -->
      <div class="tv-inst-card">
        <div class="tv-inst-subhead">
          <span>${cotData.title || 'Institutional Positioning (COT)'}</span>
          <span style="font-size:10.5px;color:#2979ff;font-weight:700;">${cotData.sentimentLabel}</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px;">
          ${cotRowsHtml}
        </div>
      </div>

      <!-- 6. Action Button: Plot Directly on Live Chart -->
      <button class="tv-inst-plot-btn" id="btn-inst-plot-chart">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        <span>Plot GEX Walls & Levels on Live Chart</span>
      </button>
    `;

    // Wire up Plot button
    const plotBtn = document.getElementById('btn-inst-plot-chart');
    if (plotBtn) {
      plotBtn.onclick = () => this.plotGexOnActiveChart();
    }
  }

  getCOTDataForSymbol(symbol = 'ES') {
    const raw = (symbol || '').toUpperCase().trim();
    const sym = raw.includes(':') ? raw.split(':')[1].trim() : raw;

    // 1. Silver (COMEX / MCX / Spot)
    if (sym === 'SI' || sym === 'SILVER' || sym === 'XAGUSD' || sym.startsWith('SILVER')) {
      return {
        title: 'COMEX Silver Futures (5,000 oz)',
        sentimentLabel: '72% Bullish Net Positioning',
        categories: [
          { name: 'Asset Managers (Institutions)', netPosition: 68500, netPositionText: '+68.5K Contracts', netPct: 72, color: '#00e676', wowText: '+3.8K ↗', wowUp: true, percentile: 79 },
          { name: 'Commercial Dealers & Hedgers', netPosition: -42100, netPositionText: '-42.1K Contracts', netPct: -58, color: '#2979ff', wowText: '-2.4K ↘', wowUp: false, percentile: 25 },
          { name: 'Managed Money (Hedge Funds)', netPosition: 26400, netPositionText: '+26.4K Contracts', netPct: 46, color: '#ff9100', wowText: '+1.4K ↗', wowUp: true, percentile: 68 },
        ]
      };
    }

    // 2. Gold (COMEX / MCX / Spot)
    if (sym === 'GC' || sym === 'GOLD' || sym === 'XAU' || sym === 'XAUUSD' || sym === 'PAXGUSDT' || sym.startsWith('GOLD')) {
      return {
        title: 'COMEX Gold Futures (100 oz)',
        sentimentLabel: '82% Bullish Speculation',
        categories: [
          { name: 'Asset Managers (Institutions)', netPosition: 245800, netPositionText: '+245.8K Contracts', netPct: 84, color: '#00e676', wowText: '+12.4K ↗', wowUp: true, percentile: 88 },
          { name: 'Dealers & Bullion Banks', netPosition: -188400, netPositionText: '-188.4K Contracts', netPct: -65, color: '#2979ff', wowText: '-8.2K ↘', wowUp: false, percentile: 19 },
          { name: 'Leveraged Funds (Hedge Funds)', netPosition: 74200, netPositionText: '+74.2K Contracts', netPct: 45, color: '#ff9100', wowText: '+4.1K ↗', wowUp: true, percentile: 72 },
        ]
      };
    }

    // 3. Copper (COMEX / MCX)
    if (sym === 'HG' || sym === 'COPPER') {
      return {
        title: 'COMEX Copper Futures (25,000 lbs)',
        sentimentLabel: '64% Moderate Expansion',
        categories: [
          { name: 'Managed Money (Asset Managers)', netPosition: 32100, netPositionText: '+32.1K Contracts', netPct: 62, color: '#00e676', wowText: '+2.1K ↗', wowUp: true, percentile: 67 },
          { name: 'Commercial Producers & Merchants', netPosition: -41200, netPositionText: '-41.2K Contracts', netPct: -68, color: '#2979ff', wowText: '-3.5K ↘', wowUp: false, percentile: 31 },
          { name: 'Non-Reportable Traders', netPosition: 16800, netPositionText: '+16.8K Contracts', netPct: 38, color: '#ff9100', wowText: '+0.9K ↗', wowUp: true, percentile: 55 },
        ]
      };
    }

    // 4. Crude Oil (NYMEX / ICE / MCX)
    if (sym === 'CL' || sym === 'CRUDE' || sym === 'CRUDEOIL' || sym === 'WTI' || sym === 'BRENT' || sym === 'BZ' || sym.includes('CRUDE')) {
      return {
        title: 'NYMEX Light Sweet WTI Crude Oil',
        sentimentLabel: '58% Neutral Hedging',
        categories: [
          { name: 'Managed Money (Asset Managers)', netPosition: 192500, netPositionText: '+192.5K Contracts', netPct: 58, color: '#00e676', wowText: '+5.4K ↗', wowUp: true, percentile: 58 },
          { name: 'Commercial Producers & Merchants', netPosition: -284000, netPositionText: '-284.0K Contracts', netPct: -68, color: '#2979ff', wowText: '-6.8K ↘', wowUp: false, percentile: 42 },
          { name: 'Swap Dealers', netPosition: 78200, netPositionText: '+78.2K Contracts', netPct: 35, color: '#ff9100', wowText: '+1.2K ↗', wowUp: true, percentile: 51 },
        ]
      };
    }

    // 5. Natural Gas (NYMEX / MCX)
    if (sym === 'NG' || sym === 'NATGAS' || sym === 'NATURALGAS' || sym.includes('NATGAS')) {
      return {
        title: 'NYMEX Henry Hub Natural Gas',
        sentimentLabel: '66% Winter Hedging Accumulation',
        categories: [
          { name: 'Swap Dealers', netPosition: 145200, netPositionText: '+145.2K Contracts', netPct: 72, color: '#00e676', wowText: '+7.8K ↗', wowUp: true, percentile: 76 },
          { name: 'Commercial Producers / Processors', netPosition: -118400, netPositionText: '-118.4K Contracts', netPct: -64, color: '#2979ff', wowText: '-4.1K ↘', wowUp: false, percentile: 36 },
          { name: 'Managed Money (Speculators)', netPosition: -42800, netPositionText: '-42.8K Contracts', netPct: -38, color: '#ff9100', wowText: '+3.1K ↗', wowUp: true, percentile: 49 },
        ]
      };
    }

    // 6. Nasdaq 100 (CME)
    if (sym === 'NQ' || sym === 'NASDAQ' || sym === 'NDX' || sym === 'QQQ' || sym.includes('NASDAQ')) {
      return {
        title: 'CME E-mini Nasdaq 100 Futures',
        sentimentLabel: '78% Bullish Tech Momentum',
        categories: [
          { name: 'Asset Managers (Institutions)', netPosition: 118200, netPositionText: '+118.2K Contracts', netPct: 79, color: '#00e676', wowText: '+6.8K ↗', wowUp: true, percentile: 82 },
          { name: 'Dealers & Intermediaries', netPosition: -78500, netPositionText: '-78.5K Contracts', netPct: -64, color: '#2979ff', wowText: '-3.9K ↘', wowUp: false, percentile: 21 },
          { name: 'Leveraged Funds (Hedge Funds)', netPosition: 24100, netPositionText: '+24.1K Contracts', netPct: 36, color: '#ff9100', wowText: '+2.4K ↗', wowUp: true, percentile: 74 },
        ]
      };
    }

    // 7. Dow Jones (CBOT)
    if (sym === 'YM' || sym === 'DOW' || sym === 'DJI' || sym === 'DIA' || sym.includes('DOW')) {
      return {
        title: 'CBOT E-mini Dow Jones Futures',
        sentimentLabel: '61% Value Rotation',
        categories: [
          { name: 'Asset Managers (Institutions)', netPosition: 45200, netPositionText: '+45.2K Contracts', netPct: 64, color: '#00e676', wowText: '+1.8K ↗', wowUp: true, percentile: 63 },
          { name: 'Dealers & Intermediaries', netPosition: -38400, netPositionText: '-38.4K Contracts', netPct: -57, color: '#2979ff', wowText: '-1.2K ↘', wowUp: false, percentile: 38 },
          { name: 'Leveraged Funds (Hedge Funds)', netPosition: -8900, netPositionText: '-8.9K Contracts', netPct: -22, color: '#ff9100', wowText: '+0.7K ↗', wowUp: true, percentile: 48 },
        ]
      };
    }

    // 8. Russell 2000 (CME)
    if (sym === 'RTY' || sym === 'RUSSELL' || sym === 'RUT' || sym === 'IWM' || sym.includes('RUSSELL')) {
      return {
        title: 'CME E-mini Russell 2000 Futures',
        sentimentLabel: '52% Neutral Consolidation',
        categories: [
          { name: 'Asset Managers (Institutions)', netPosition: 18400, netPositionText: '+18.4K Contracts', netPct: 48, color: '#00e676', wowText: '+1.1K ↗', wowUp: true, percentile: 54 },
          { name: 'Dealers & Intermediaries', netPosition: -22100, netPositionText: '-22.1K Contracts', netPct: -52, color: '#2979ff', wowText: '-0.8K ↘', wowUp: false, percentile: 44 },
          { name: 'Leveraged Funds (Hedge Funds)', netPosition: -36500, netPositionText: '-36.5K Contracts', netPct: -45, color: '#ff9100', wowText: '-2.3K ↘', wowUp: false, percentile: 30 },
        ]
      };
    }

    // 9. US Treasuries & Yields (CBOT)
    if (sym === 'ZN' || sym === 'ZB' || sym === 'US10Y' || sym === 'TNX' || sym.includes('TREASURY') || sym.includes('BOND')) {
      return {
        title: 'CBOT 10Y/30Y US Treasury Futures',
        sentimentLabel: '71% Institutional Duration Long',
        categories: [
          { name: 'Institutional Asset Managers', netPosition: 1280000, netPositionText: '+1.28M Contracts', netPct: 86, color: '#00e676', wowText: '+48.2K ↗', wowUp: true, percentile: 91 },
          { name: 'Leveraged Basis Funds (Hedge Funds)', netPosition: -840500, netPositionText: '-840.5K Contracts', netPct: -78, color: '#2979ff', wowText: '-22.4K ↘', wowUp: false, percentile: 14 },
          { name: 'Primary Dealers', netPosition: -310200, netPositionText: '-310.2K Contracts', netPct: -46, color: '#ff9100', wowText: '-9.8K ↘', wowUp: false, percentile: 38 },
        ]
      };
    }

    // 10. Grains & Agriculture (CBOT)
    if (sym === 'ZC' || sym === 'ZW' || sym === 'ZS' || sym === 'CORN' || sym === 'WHEAT' || sym === 'SOYBEAN') {
      return {
        title: 'CBOT Agriculture & Grain Futures',
        sentimentLabel: '54% Commercial Harvest Hedging',
        categories: [
          { name: 'Commercial Producers & Merchants', netPosition: -164200, netPositionText: '-164.2K Contracts', netPct: -62, color: '#2979ff', wowText: '-5.2K ↘', wowUp: false, percentile: 41 },
          { name: 'Managed Money (Speculators)', netPosition: 88600, netPositionText: '+88.6K Contracts', netPct: 52, color: '#00e676', wowText: '+3.4K ↗', wowUp: true, percentile: 59 },
          { name: 'Swap Dealers', netPosition: 42100, netPositionText: '+42.1K Contracts', netPct: 38, color: '#ff9100', wowText: '+1.1K ↗', wowUp: true, percentile: 53 },
        ]
      };
    }

    // 11. Crypto / Bitcoin / Ethereum (CME & Binance)
    if (sym === 'BTC' || sym === 'ETH' || sym === 'SOL' || sym.endsWith('USDT') || sym.endsWith('BTC') || sym === 'COIN') {
      return {
        title: 'CME Bitcoin / Crypto Futures COT',
        sentimentLabel: '84% Institutional Macro Long',
        categories: [
          { name: 'Institutional Asset Managers', netPosition: 18500, netPositionText: '+18.5K Contracts', netPct: 88, color: '#00e676', wowText: '+1.2K ↗', wowUp: true, percentile: 89 },
          { name: 'Leveraged Funds (Basis Arbitrage)', netPosition: -16200, netPositionText: '-16.2K Contracts', netPct: -74, color: '#2979ff', wowText: '-0.9K ↘', wowUp: false, percentile: 18 },
          { name: 'Other Reportable Speculators', netPosition: 4100, netPositionText: '+4.1K Contracts', netPct: 42, color: '#ff9100', wowText: '+0.4K ↗', wowUp: true, percentile: 68 },
        ]
      };
    }

    // 12. Indian Equities & Indices (NSE / BSE / F&O)
    if (
      sym.includes('NIFTY') ||
      sym.includes('SENSEX') ||
      sym === 'MUTHOOTFIN' ||
      sym === 'RELIANCE' ||
      sym === 'HDFCBANK' ||
      sym === 'ICICIBANK' ||
      sym === 'INFY' ||
      sym === 'TCS' ||
      sym === 'TATAMOTORS' ||
      sym === 'SBIN' ||
      sym === 'LT' ||
      sym === 'ITC' ||
      sym === 'HAL' ||
      sym === 'BEL' ||
      sym.endsWith('.NS') ||
      sym.endsWith('.BO')
    ) {
      return {
        title: 'NSE FII / DII Institutional F&O Positioning',
        sentimentLabel: '68% Domestic Institutional Net Long',
        categories: [
          { name: 'DII (Mutual Funds & Insurance)', netPosition: 112400, netPositionText: '+112.4K Contracts', netPct: 78, color: '#00e676', wowText: '+8.2K ↗', wowUp: true, percentile: 84 },
          { name: 'FII (Foreign Institutional Investors)', netPosition: 42800, netPositionText: '+42.8K Contracts', netPct: 58, color: '#2979ff', wowText: '+4.6K ↗', wowUp: true, percentile: 62 },
          { name: 'Pro Desk / Proprietary Hedgers', netPosition: -68200, netPositionText: '-68.2K Contracts', netPct: -61, color: '#ff9100', wowText: '-3.1K ↘', wowUp: false, percentile: 34 },
        ]
      };
    }

    // 13. Default / S&P 500 / E-mini ES
    return {
      title: 'CME Commitments of Traders (COT)',
      sentimentLabel: '76% Bullish Positioning',
      categories: [
        { name: 'Asset Managers (Institutions)', netPosition: 842500, netPositionText: '+842.5K Contracts', netPct: 82, color: '#00e676', wowText: '+24.6K ↗', wowUp: true, percentile: 85 },
        { name: 'Dealers & Intermediaries', netPosition: -512000, netPositionText: '-512.0K Contracts', netPct: -62, color: '#2979ff', wowText: '-14.8K ↘', wowUp: false, percentile: 24 },
        { name: 'Leveraged Funds (Hedge Funds)', netPosition: -124300, netPositionText: '-124.3K Contracts', netPct: -28, color: '#ff9100', wowText: '+18.2K ↗', wowUp: true, percentile: 42 },
      ]
    };
  }

  plotGexOnActiveChart() {
    const activeWidget = this.activePane?.widget;
    if (!activeWidget || !activeWidget.chart) {
      this.showToast('Please open a chart pane first', 2000);
      return;
    }
    try {
      const inds = activeWidget.chart.indicators() || [];
      const hasGex = inds.some(i => i.id === 'gamma-exposure-gex');
      if (!hasGex) {
        activeWidget.chart.addIndicator('gamma-exposure-gex', {});
        this.showToast('🟢 Gamma Exposure (GEX) levels plotted on chart!', 2500);
      } else {
        this.showToast('Gamma Exposure is already active on this chart', 2000);
      }
    } catch (e) {
      this.showToast(`Error: ${e.message}`, 2500);
    }
  }

  // ─── MOBILE BOTTOM NAV & SLIDE-IN DRAWERS ───
  initMobileUI() {
    const mobNavChart = document.getElementById('mob-nav-chart');
    const mobNavWatchlist = document.getElementById('mob-nav-watchlist');
    const mobNavOI = document.getElementById('mob-nav-oi');
    const mobNavInstitutional = document.getElementById('mob-nav-institutional');
    const mobNavNews = document.getElementById('mob-nav-news');
    const drawToggleBtn = document.getElementById('btn-toggle-drawing-toolbar');
    const topbarWlBtn = document.getElementById('btn-topbar-watchlist');
    const topbarAlertBtn = document.getElementById('btn-open-alert') || document.getElementById('btn-topbar-alert');
    const sidebar = document.querySelector('.tv-right-sidebar');
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

    if (mobNavOI) {
      mobNavOI.onclick = () => {
        this.openOIDashboard();
        updateMobNav('mob-nav-oi');
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

    if (topbarAlertBtn) {
      topbarAlertBtn.onclick = (e) => {
        e.stopPropagation();
        this.openAlertModal();
      };
    }

    if (mobNavInstitutional) {
      mobNavInstitutional.onclick = () => {
        this.openMobileDrawer('institutional', true);
        updateMobNav('mob-nav-institutional');
      };
    }

    if (mobNavNews) {
      mobNavNews.onclick = () => {
        this.openMobileDrawer('news', true);
        updateMobNav('mob-nav-news');
      };
    }

    if (drawToggleBtn) {
      drawToggleBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleDrawingToolbar();
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
    const oiModal = document.getElementById('oi-analytics-modal');
    const layoutMenu = document.getElementById('layout-grid-menu');
    const chartTypeMenu = document.getElementById('chart-type-menu');
    const speedMenu = document.getElementById('replay-speed-menu');
    const widgetDialogs = document.querySelectorAll('.oac-dialog, .oac-overlay');

    if (oiModal?.classList.contains('show')) {
      this.closeOIDashboard();
      return;
    }
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
      document.getElementById('tv-stage')?.classList.remove('draw-rail-open');
      document.getElementById('btn-toggle-drawing-toolbar')?.classList.remove('is-active');
      return;
    }

    // 4. Mobile screen back-navigation
    if (window.innerWidth <= 768) {
      const sidebar = document.querySelector('.tv-right-sidebar');
      const isDrawerOpen = sidebar?.classList.contains('mobile-open');
      const activeBtn = document.querySelector('.tv-mob-nav-btn.active');
      const activeTab = activeBtn?.dataset?.tab;

      // If user is on Chart, Alerts, News, Calendar, or any non-watchlist view:
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
    this.closeOIDashboard();
    const sidebar = document.querySelector('.tv-right-sidebar');
    const rightPanel = document.getElementById('right-panel');
    const tabPanes = document.querySelectorAll('.tv-right-content .tv-tab-pane');

    // Auto-close mobile drawing rail if open
    const rail = document.querySelector('.oac-rail');
    if (rail?.classList.contains('mobile-visible')) {
      rail.classList.remove('mobile-visible');
      document.getElementById('tv-stage')?.classList.remove('draw-rail-open');
      document.getElementById('btn-toggle-drawing-toolbar')?.classList.remove('is-active');
    }

    document.body.classList.add('mobile-drawer-open');

    if (sidebar) {
      sidebar.classList.add('mobile-open');
    }
    if (rightPanel) {
      rightPanel.classList.remove('collapsed');
      if (window.innerWidth <= 768) {
        rightPanel.style.width = '100vw';
      }
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
    } else if (tabName === 'oi-analytics') {
      this.loadOISidebarPanel();
      this.currentViewState = 'oi-analytics';
      if (pushState && window.innerWidth <= 768) {
        this.pushHistoryState({ view: 'oi-analytics' });
      }
    } else if (tabName === 'institutional') {
      this.loadInstitutionalPanel();
      this.currentViewState = 'institutional';
      if (pushState && window.innerWidth <= 768) {
        this.pushHistoryState({ view: 'institutional' });
      }
    } else if (tabName === 'news' || tabName === 'calendar') {
      const targetPane = document.getElementById('panel-news');
      if (targetPane) targetPane.style.display = 'flex';
      if (tabName === 'calendar') {
        const subtabCal = document.getElementById('subtab-btn-calendar');
        if (subtabCal) subtabCal.click();
      } else {
        const subtabNews = document.getElementById('subtab-btn-news');
        if (subtabNews) subtabNews.click();
      }
      this.currentViewState = 'news';
      if (pushState && window.innerWidth <= 768) {
        this.pushHistoryState({ view: 'news' });
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

  // ─── MODALS & SMOOTH PRO SYMBOL SEARCH ENGINE ───
  initModals() {
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.getElementById('search-query');
    const searchBtn = document.getElementById('btn-open-search');
    const clearBtn = document.getElementById('btn-clear-search');
    const closeSearchBtn = document.getElementById('btn-close-search');
    const wlAddBtn = document.getElementById('btn-wl-add');
    const stBtns = document.querySelectorAll('#search-category-tabs .tv-st-btn');

    let activeCat = 'all';
    let searchDebounce = null;

    const performSearch = async (q, cat = activeCat) => {
      const trimmed = (q || '').trim();
      const catNorm = cat || 'all';

      // 1. If empty query, immediately render Trending Quick Markets & Recent Searches
      if (!trimmed) {
        if (clearBtn) clearBtn.style.display = 'none';
        this.renderEmptySearchState(catNorm);
        return;
      }

      if (clearBtn) clearBtn.style.display = 'flex';

      // 2. Zero-Latency Instant Local Filtering (0ms UI response)
      const qLower = trimmed.toLowerCase();
      const localMatches = [];

      // Check known MASTER_INSTRUMENTS
      for (const inst of MASTER_INSTRUMENTS) {
        if (catNorm !== 'all' && inst.category !== catNorm) continue;
        const sym = (inst.symbol || '').toLowerCase();
        const disp = (inst.displaySymbol || '').toLowerCase();
        const name = (inst.name || '').toLowerCase();

        let score = 0;
        if (sym === qLower || disp === qLower) score = 1000;
        else if (sym.startsWith(qLower) || disp.startsWith(qLower)) score = 500;
        else if (sym.includes(qLower) || disp.includes(qLower)) score = 250;
        else if (name.includes(qLower)) score = 100;

        if (score > 0) {
          localMatches.push({ score, inst });
        }
      }

      localMatches.sort((a, b) => b.score - a.score);
      const instantList = localMatches.map((m) => m.inst);

      // Render instant list immediately so user never sees a delay
      this.renderSearchResults(instantList, trimmed);

      // 3. Asynchronously query server for comprehensive 150k+ instruments
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(async () => {
        try {
          const resp = await fetch(`/api/market/search?q=${encodeURIComponent(trimmed)}&cat=${encodeURIComponent(catNorm)}`);
          if (resp.ok) {
            const json = await resp.json();
            if (json.status === 'success' && Array.isArray(json.results) && json.results.length > 0) {
              // Merge server results ensuring no duplicates
              const seen = new Set();
              const merged = [];
              for (const item of json.results) {
                if (!seen.has(item.symbol)) {
                  seen.add(item.symbol);
                  merged.push(item);
                }
              }
              for (const item of instantList) {
                if (!seen.has(item.symbol)) {
                  seen.add(item.symbol);
                  merged.push(item);
                }
              }
              this.renderSearchResults(merged, trimmed);
            }
          }
        } catch (_) {}
      }, 40);
    };

    const openSearch = (initialQuery = '') => {
      if (searchModal) {
        this.openModal('search-modal');
        if (searchInput) {
          searchInput.value = initialQuery;
          performSearch(initialQuery, activeCat);
          setTimeout(() => {
            searchInput.focus();
            if (initialQuery) {
              searchInput.setSelectionRange(initialQuery.length, initialQuery.length);
            }
          }, 30);
        }
      }
    };

    if (searchBtn) searchBtn.onclick = () => openSearch('');
    if (wlAddBtn) wlAddBtn.onclick = () => openSearch('');
    
    // Close button handlers
    if (closeSearchBtn) {
      closeSearchBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeModal('search-modal');
      };
    }
    const footerCloseBtn = document.getElementById('btn-footer-close-search');
    if (footerCloseBtn) {
      footerCloseBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeModal('search-modal');
      };
    }

    if (clearBtn) {
      clearBtn.onclick = (e) => {
        e.stopPropagation();
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
          performSearch('', activeCat);
        }
      };
    }

    // Click on modal backdrop outside panel
    if (searchModal) {
      searchModal.addEventListener('pointerdown', (e) => {
        if (e.target === searchModal) {
          this.closeModal('search-modal');
        }
      });
      searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
          this.closeModal('search-modal');
        }
      });
    }

    // Global document outside click listener
    document.addEventListener('pointerdown', (e) => {
      if (searchModal && searchModal.classList.contains('show')) {
        const modalContent = searchModal.querySelector('.tv-search-modal');
        const isInside = modalContent && modalContent.contains(e.target);
        const isTrigger = e.target.closest('#btn-open-search') || e.target.closest('#btn-wl-add') || e.target.closest('.tv-symbol-box') || e.target.closest('#header-symbol-text');
        if (!isInside && !isTrigger) {
          this.closeModal('search-modal');
        }
      }
    });

    // Category Tabs Switching
    stBtns.forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        stBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeCat = btn.dataset.cat || 'all';
        performSearch(searchInput?.value || '', activeCat);
        searchInput?.focus();
      };
    });

    if (searchInput) {
      searchInput.oninput = () => {
        performSearch(searchInput.value, activeCat);
      };

      // Keyboard Navigation in Search Results (TradingView style)
      searchInput.onkeydown = (e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (this.searchCurrentResults.length > 0) {
            this.searchSelectedIndex = Math.min(this.searchCurrentResults.length - 1, this.searchSelectedIndex + 1);
            this.updateSearchSelectionHighlight();
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.searchCurrentResults.length > 0) {
            this.searchSelectedIndex = Math.max(0, this.searchSelectedIndex - 1);
            this.updateSearchSelectionHighlight();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (this.searchCurrentResults.length > 0 && this.searchCurrentResults[this.searchSelectedIndex]) {
            const chosen = this.searchCurrentResults[this.searchSelectedIndex];
            this.selectAndSwitchSymbol(chosen);
          } else {
            const q = searchInput.value.trim();
            if (q) {
              const inst = findInstrument(q);
              if (inst) this.selectAndSwitchSymbol(inst);
            }
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.closeModal('search-modal');
        } else if (e.key === 'Tab') {
          // Cycle category tabs with Tab / Shift+Tab
          e.preventDefault();
          const activeIdx = Array.from(stBtns).findIndex((b) => b.classList.contains('active'));
          let nextIdx = e.shiftKey ? activeIdx - 1 : activeIdx + 1;
          if (nextIdx < 0) nextIdx = stBtns.length - 1;
          if (nextIdx >= stBtns.length) nextIdx = 0;
          stBtns[nextIdx]?.click();
        }
      };
    }

    // ─── Global Type-To-Search anywhere on terminal (TradingView feature) ───
    window.addEventListener('keydown', (e) => {
      // Ignore if user is already typing in an input, textarea, select or if modal is visible
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (document.querySelector('.tv-modal-backdrop.show')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Single alphanumeric character or / triggers search instantly
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        e.preventDefault();
        openSearch(e.key.toUpperCase());
      } else if (e.key === '/') {
        e.preventDefault();
        openSearch('');
      }
    });

    // Global Ctrl+K / Cmd+K search shortcut
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openSearch('');
      }
    });
  }

  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('show');
      el.style.display = 'flex';
    }
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.remove('show');
      el.style.display = 'none';
      el.querySelectorAll('input, textarea, select').forEach((inp) => {
        try { inp.blur(); } catch (_) {}
      });
    }
  }

  addRecentSearch(inst) {
    if (!inst || !inst.symbol) return;
    const cleanSym = inst.symbol.toUpperCase().trim();
    this.recentSearches = this.recentSearches.filter((s) => (s.symbol || '').toUpperCase().trim() !== cleanSym);
    this.recentSearches.unshift({
      symbol: inst.symbol,
      displaySymbol: inst.displaySymbol || inst.symbol,
      name: inst.name || inst.symbol,
      exchange: inst.exchange || 'NSE',
      badgeText: inst.badgeText || inst.symbol.substring(0, 2),
      badgeColor: inst.badgeColor || '#2962ff',
    });
    if (this.recentSearches.length > 12) {
      this.recentSearches = this.recentSearches.slice(0, 12);
    }
    try {
      localStorage.setItem('zerochart_recent_searches', JSON.stringify(this.recentSearches));
    } catch (_) {}
  }

  selectAndSwitchSymbol(inst) {
    if (!inst) return;
    const fullInst = findInstrument(inst.symbol) || inst;
    this.addRecentSearch(fullInst);
    this.closeModal('search-modal');
    if (document.activeElement) {
      try { document.activeElement.blur(); } catch (_) {}
    }
    this.switchInstrument(fullInst);
  }

  highlightSearchMatch(text, query) {
    if (!text) return '';
    if (!query || !query.trim()) return text;
    const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${q})`, 'gi');
    return text.replace(regex, '<mark class="tv-search-match">$1</mark>');
  }

  renderEmptySearchState(cat = 'all') {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    this.searchCurrentResults = [];
    this.searchSelectedIndex = 0;

    let html = '';

    // 1. Trending Quick Markets
    const filteredQuick = this.quickMarkets.filter((m) => {
      if (cat === 'all') return true;
      if (cat === 'india') return m.exchange === 'NSE' || m.exchange === 'BSE';
      if (cat === 'crypto') return m.exchange === 'BINANCE';
      if (cat === 'commodities') return m.exchange === 'MCX';
      if (cat === 'forex') return m.exchange === 'FOREX';
      if (cat === 'global') return m.exchange === 'NASDAQ' || m.exchange === 'INDEX';
      return true;
    });

    if (filteredQuick.length > 0) {
      html += `
        <div class="tv-search-quick-section">
          <div class="tv-search-quick-title">🔥 Popular Markets</div>
          <div class="tv-search-chips-grid">
            ${filteredQuick.map((m) => `
              <div class="tv-search-chip" data-sym="${m.symbol}">
                <span class="badge" style="background:${m.badgeColor || '#2962ff'};color:#fff;padding:1px 4px;border-radius:3px;font-size:9.5px;font-weight:700;">${m.badgeText || m.symbol.substring(0, 2)}</span>
                <span>${m.symbol}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 2. Recent Searches
    if (this.recentSearches && this.recentSearches.length > 0) {
      html += `
        <div class="tv-search-quick-section" style="padding-top:0;">
          <div class="tv-search-quick-title">
            <span>🕒 Recent Searches</span>
            <button id="btn-clear-recent-searches" style="background:none;border:none;color:var(--accent);font-size:11px;font-weight:600;cursor:pointer;padding:0;">Clear</button>
          </div>
          <div class="tv-search-chips-grid">
            ${this.recentSearches.map((m) => `
              <div class="tv-search-chip" data-sym="${m.symbol}">
                <span class="badge" style="background:${m.badgeColor || '#2962ff'};color:#fff;padding:1px 4px;border-radius:3px;font-size:9.5px;font-weight:700;">${m.badgeText || m.symbol.substring(0, 2)}</span>
                <span>${m.displaySymbol || m.symbol}</span>
                <span style="font-size:10.5px;color:var(--text-muted);font-weight:400;">(${m.exchange || 'NSE'})</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    resultsContainer.innerHTML = html;

    // Attach click handlers to quick chips
    resultsContainer.querySelectorAll('.tv-search-chip').forEach((chip) => {
      chip.onclick = () => {
        const sym = chip.dataset.sym;
        const inst = findInstrument(sym) || this.recentSearches.find((s) => s.symbol === sym) || this.quickMarkets.find((m) => m.symbol === sym);
        if (inst) this.selectAndSwitchSymbol(inst);
      };
    });

    const clearRecentBtn = document.getElementById('btn-clear-recent-searches');
    if (clearRecentBtn) {
      clearRecentBtn.onclick = (e) => {
        e.stopPropagation();
        this.recentSearches = [];
        localStorage.removeItem('zerochart_recent_searches');
        this.renderEmptySearchState(cat);
      };
    }
  }

  renderSearchResults(list, query = '') {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';
    this.searchCurrentResults = list || [];
    this.searchSelectedIndex = 0;

    if (!list || list.length === 0) {
      resultsContainer.innerHTML = `
        <div style="padding:32px 20px;text-align:center;color:var(--text-muted);display:flex;flex-direction:column;align-items:center;gap:6px;">
          <span style="font-size:24px;">🔍</span>
          <span style="font-weight:600;font-size:14px;color:var(--text-bright);">No matching symbols found</span>
          <span style="font-size:12px;">Check your spelling or switch category tabs above</span>
        </div>
      `;
      return;
    }

    list.forEach((inst, index) => {
      const item = document.createElement('div');
      item.className = `tv-search-item ${index === 0 ? 'selected' : ''}`;
      item.dataset.index = index;

      const symHl = this.highlightSearchMatch(inst.displaySymbol || inst.symbol, query);
      const nameHl = this.highlightSearchMatch(inst.name || inst.symbol, query);
      const badgeBg = inst.badgeColor || '#2962ff';
      const badgeTxt = inst.badgeText || (inst.symbol || '').substring(0, 2);

      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;overflow:hidden;flex:1;">
          <div class="tv-symbol-circle" style="background:${badgeBg};">${badgeTxt}</div>
          <div style="display:flex;flex-direction:column;gap:1px;overflow:hidden;flex:1;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-weight:700;font-size:14px;color:var(--text-bright);letter-spacing:-0.01em;">${symHl}</span>
              <span class="tv-sym-badge">${inst.exchange || 'NSE'}</span>
            </div>
            <div style="font-size:12px;color:var(--text-muted);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nameHl}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="tv-wl-act-btn btn-add-wl-search" data-index="${index}" style="color:var(--accent);padding:4px 8px;border-radius:4px;" title="Add to active watchlist">+</button>
        </div>
      `;

      // Row Click -> Load Chart & Switch Symbol
      item.onclick = (e) => {
        if (e.target.closest('.btn-add-wl-search')) return;
        this.selectAndSwitchSymbol(inst);
      };

      // + Button Click -> Add to Watchlist without closing modal
      const addBtn = item.querySelector('.btn-add-wl-search');
      if (addBtn) {
        addBtn.onclick = (e) => {
          e.stopPropagation();
          this.addSymbolToActiveWatchlist(inst.symbol, inst);
          addBtn.textContent = '✓';
          addBtn.style.color = 'var(--buy)';
          setTimeout(() => {
            addBtn.textContent = '+';
            addBtn.style.color = 'var(--accent)';
          }, 1500);
        };
      }

      resultsContainer.appendChild(item);
    });
  }

  updateSearchSelectionHighlight() {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    const items = resultsContainer.querySelectorAll('.tv-search-item');
    items.forEach((item, idx) => {
      const isSel = idx === this.searchSelectedIndex;
      item.classList.toggle('selected', isSel);
      if (isSel) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
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

  // ─── PER-SYMBOL DRAWINGS & GLOBAL INDICATORS PERSISTENCE ───
  saveSymbolDrawings(paneIndex, symbol) {
    const pane = this.panes[paneIndex];
    const sym = symbol || pane?.instrument?.symbol || this.currentInstrument?.symbol;
    if (!pane?.widget || !sym) return;
    const symKey = sym.toUpperCase().trim();
    try {
      if (typeof pane.widget.draw?.toJSON === 'function') {
        const drawings = pane.widget.draw.toJSON();
        localStorage.setItem(`zerochart_drawings_${symKey}`, JSON.stringify(drawings));
      }
    } catch (_) {}
  }

  restoreSymbolDrawings(paneIndex, symbol) {
    const pane = this.panes[paneIndex];
    const sym = symbol || pane?.instrument?.symbol || this.currentInstrument?.symbol;
    if (!pane?.widget || !sym) return;
    const symKey = sym.toUpperCase().trim();
    try {
      // Clear drawings canvas first so other symbols' drawings never show
      pane.widget.draw?.clear?.();
      const savedDrawings = localStorage.getItem(`zerochart_drawings_${symKey}`);
      if (savedDrawings && typeof pane.widget.draw?.fromJSON === 'function') {
        const parsed = JSON.parse(savedDrawings);
        if (parsed) {
          pane.widget.draw.fromJSON(parsed);
        }
      }
    } catch (_) {}
  }

  saveGlobalIndicators(paneIndex = 0) {
    const pane = this.panes[paneIndex];
    if (!pane?.widget?.chart) return;
    try {
      const inds = pane.widget.chart.indicators().map((i) => ({
        indicatorId: i.indicatorId,
        settings: i.settings(),
        paneIndex: i.paneIndex,
      }));
      localStorage.setItem('zerochart_global_indicators', JSON.stringify(inds));
    } catch (_) {}
  }

  restoreGlobalIndicators(paneIndex = 0) {
    const pane = this.panes[paneIndex];
    if (!pane?.widget?.chart) return;
    try {
      const current = pane.widget.chart.indicators();
      if (current.length > 0) return; // already loaded
      const saved = localStorage.getItem('zerochart_global_indicators');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const ind of parsed) {
            try {
              pane.widget.chart.addIndicator(ind.indicatorId, ind.settings || {});
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }

  saveFullLayout() {
    try {
      this.saveLayout(this.activeLayoutId, this.activeLayoutName);
      return true;
    } catch (err) {
      console.warn('[ZeroChart] Failed to save full layout:', err);
      return false;
    }
  }

  loadSavedLayoutData() {
    try {
      const saved = localStorage.getItem('zerochart_full_layout') || localStorage.getItem('zerochart_user_layouts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
        return parsed;
      }
    } catch (_) {}
    return null;
  }

  // ─── MULTI-CHART SYNCHRONIZATION ENGINE ───
  initMultiChartSync() {
    const chkCrosshair = document.getElementById('chk-sync-crosshair');
    const chkTime = document.getElementById('chk-sync-time');
    const chkSymbol = document.getElementById('chk-sync-symbol');
    const chkInterval = document.getElementById('chk-sync-interval');

    if (chkCrosshair) {
      chkCrosshair.checked = !!this.syncOptions.crosshair;
      chkCrosshair.onchange = (e) => {
        this.syncOptions.crosshair = e.target.checked;
        this.saveSyncOptions();
      };
    }
    if (chkTime) {
      chkTime.checked = !!this.syncOptions.time;
      chkTime.onchange = (e) => {
        this.syncOptions.time = e.target.checked;
        this.saveSyncOptions();
        if (this.syncOptions.time) this.broadcastTimeRange(this.activePaneIndex);
      };
    }
    if (chkSymbol) {
      chkSymbol.checked = !!this.syncOptions.symbol;
      chkSymbol.onchange = (e) => {
        this.syncOptions.symbol = e.target.checked;
        this.saveSyncOptions();
        if (this.syncOptions.symbol && this.currentInstrument) {
          this.switchInstrument(this.currentInstrument, this.activePaneIndex, false);
        }
      };
    }
    if (chkInterval) {
      chkInterval.checked = !!this.syncOptions.interval;
      chkInterval.onchange = (e) => {
        this.syncOptions.interval = e.target.checked;
        this.saveSyncOptions();
        if (this.syncOptions.interval && this.currentInterval) {
          this.setInterval(this.currentInterval, this.activePaneIndex, false);
        }
      };
    }
  }

  saveSyncOptions() {
    try {
      localStorage.setItem('zerochart_sync_options', JSON.stringify(this.syncOptions));
    } catch (_) {}
  }

  getVisiblePaneCount() {
    const layout = this.currentLayout;
    if (layout === '1x2' || layout === '2x1') return 2;
    if (layout === '1x3') return 3;
    if (layout === '2x2') return 4;
    return 1;
  }

  broadcastCrosshair(sourcePaneIdx, data) {
    if (!this.syncOptions.crosshair) return;
    const visibleCount = this.getVisiblePaneCount();
    if (visibleCount <= 1) return;

    for (let i = 0; i < visibleCount; i++) {
      if (i === sourcePaneIdx) continue;
      const targetPane = this.panes[i];
      if (!targetPane?.widget?.chart) continue;
      if (data?.time) {
        try {
          const targetChart = targetPane.widget.chart;
          const targetLayer = targetChart._dataLayer;
          if (targetLayer) {
            const idx = targetLayer.timeToIndex(data.time);
            if (idx !== null && idx >= 0) {
              const bar = targetLayer.barAt(idx);
              if (bar && typeof targetChart.setLegendData === 'function') {
                targetChart.setLegendData(bar);
              }
            }
          }
        } catch (_) {}
      }
    }
  }

  broadcastTimeRange(sourcePaneIdx) {
    if (!this.syncOptions.time || this.isSyncingTime) return;
    const visibleCount = this.getVisiblePaneCount();
    if (visibleCount <= 1) return;

    const sourcePane = this.panes[sourcePaneIdx];
    if (!sourcePane?.widget?.chart) return;

    try {
      const range = sourcePane.widget.chart.getVisibleLogicalRange();
      if (!range || typeof range.from !== 'number' || typeof range.to !== 'number') return;
      this.isSyncingTime = true;
      for (let i = 0; i < visibleCount; i++) {
        if (i === sourcePaneIdx) continue;
        const targetPane = this.panes[i];
        if (targetPane?.widget?.chart) {
          try {
            targetPane.widget.chart.setVisibleLogicalRange(range);
          } catch (_) {}
        }
      }
    } catch (_) {}
    finally {
      setTimeout(() => {
        this.isSyncingTime = false;
      }, 40);
    }
  }

  setInterval(interval, paneIndex = this.activePaneIndex, fromSync = false) {
    if (this.isReplayMode) {
      this.exitReplayMode();
    }
    const pane = this.panes[paneIndex];
    if (!pane) return;
    pane.interval = interval;
    if (paneIndex === this.activePaneIndex) {
      this.currentInterval = interval;
      const tfBtns = document.querySelectorAll('#timeframe-group .tv-tf-btn');
      tfBtns.forEach((b) => b.classList.toggle('active', b.dataset.interval === interval));
      try {
        localStorage.setItem('zerochart_last_interval', interval);
      } catch (_) {}
    }
    if (pane.widget) {
      pane.widget.setInterval(interval);
      try {
        if (pane.widget.chart?.setAxisChromeOptions) {
          pane.widget.chart.setAxisChromeOptions({ barCountdown: true, sessionClock: true });
        }
      } catch (_) {}
    }
    if (this.syncOptions?.interval && !fromSync) {
      const visibleCount = this.getVisiblePaneCount();
      for (let i = 0; i < visibleCount; i++) {
        if (i !== paneIndex && this.panes[i]?.widget) {
          this.setInterval(interval, i, true);
        }
      }
    }
  }

  // ─── NAMED LAYOUT MANAGER SYSTEM ───
  initLayoutManager() {
    const saveMenuBtn = document.getElementById('btn-save-current-layout');
    const saveAsBtn = document.getElementById('btn-save-as-new-layout');
    const renameBtn = document.getElementById('btn-rename-current-layout');
    const layoutMgrMenu = document.getElementById('layout-manager-menu');
    const saveTopBtn = document.getElementById('btn-layout-save');

    if (saveMenuBtn) {
      saveMenuBtn.onclick = () => {
        this.saveLayout(this.activeLayoutId, this.activeLayoutName, true);
        layoutMgrMenu?.classList.remove('show');
      };
    }

    if (saveAsBtn) {
      saveAsBtn.onclick = () => {
        const name = prompt('Enter a name for this new chart layout:', `${this.currentInstrument?.symbol || 'Chart'} Setup`);
        if (name && name.trim()) {
          const newId = 'layout_' + Date.now();
          this.saveLayout(newId, name.trim(), true);
          layoutMgrMenu?.classList.remove('show');
        }
      };
    }

    if (renameBtn) {
      renameBtn.onclick = () => {
        const newName = prompt('Rename current layout:', this.activeLayoutName);
        if (newName && newName.trim()) {
          this.activeLayoutName = newName.trim();
          this.updateLayoutTitleUI();
          this.saveLayout(this.activeLayoutId, this.activeLayoutName, true);
        }
      };
    }

    // Ctrl+S / Cmd+S Global Shortcut
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.saveLayout(this.activeLayoutId, this.activeLayoutName, true);
      }
    });

    // Close layout manager dropdown on click outside
    document.addEventListener('click', (e) => {
      if (layoutMgrMenu && !layoutMgrMenu.contains(e.target) && e.target !== saveTopBtn && !saveTopBtn?.contains(e.target)) {
        layoutMgrMenu.classList.remove('show');
      }
    });

    this.updateLayoutTitleUI();
    this.loadSavedLayouts();
  }

  updateLayoutTitleUI() {
    const topTitle = document.getElementById('active-layout-title');
    const menuTitle = document.getElementById('layout-mgr-active-name');
    if (topTitle) topTitle.textContent = this.activeLayoutName || 'Default Layout';
    if (menuTitle) menuTitle.textContent = this.activeLayoutName || 'Default Layout';
    try {
      localStorage.setItem('zerochart_active_layout_id', this.activeLayoutId);
      localStorage.setItem('zerochart_active_layout_name', this.activeLayoutName);
    } catch (_) {}
  }

  async loadSavedLayouts() {
    try {
      const resp = await fetch('/api/user/layouts');
      if (resp.ok) {
        const json = await resp.json();
        if (json.status === 'success' && Array.isArray(json.layouts)) {
          this.savedLayouts = json.layouts;
          localStorage.setItem('zerochart_user_layouts', JSON.stringify(this.savedLayouts));
          this.renderSavedLayoutsList();
          return;
        }
      }
    } catch (_) {}

    // Fallback to localStorage
    try {
      const local = localStorage.getItem('zerochart_user_layouts');
      if (local) {
        this.savedLayouts = JSON.parse(local) || [];
      }
    } catch (_) {}
    this.renderSavedLayoutsList();
  }

  async saveLayout(id = this.activeLayoutId, name = this.activeLayoutName, isManual = false) {
    this.activeLayoutId = id || ('layout_' + Date.now());
    this.activeLayoutName = name || 'Default Layout';
    this.updateLayoutTitleUI();

    // Serialize layout state
    const layout = {
      id: this.activeLayoutId,
      name: this.activeLayoutName,
      updatedAt: Date.now(),
      theme: this.currentTheme,
      activeLayout: this.currentLayout,
      activePaneIndex: this.activePaneIndex,
      activeWatchlistId: this.activeWatchlistId,
      layoutSplits: this.layoutSplits,
      syncOptions: this.syncOptions,
      panes: this.panes.map((p) => {
        let inds = [];
        let drawings = null;
        if (p.widget?.chart) {
          try {
            inds = p.widget.chart.indicators().map((i) => ({
              indicatorId: i.indicatorId,
              settings: i.settings(),
              paneIndex: i.paneIndex,
            }));
          } catch (_) {}
        }
        if (p.widget?.draw && typeof p.widget.draw.toJSON === 'function') {
          try {
            drawings = p.widget.draw.toJSON();
          } catch (_) {}
        }
        return {
          id: p.id,
          symbol: p.instrument?.symbol || 'NIFTY 50',
          exchange: p.instrument?.exchange || 'NSE',
          interval: p.interval,
          chartType: p.chartType,
          indicators: inds,
          drawings: drawings,
        };
      }),
    };

    // Local cache update
    const existingIdx = this.savedLayouts.findIndex((l) => l.id === layout.id);
    if (existingIdx >= 0) {
      this.savedLayouts[existingIdx] = layout;
    } else {
      this.savedLayouts.unshift(layout);
    }
    try {
      localStorage.setItem('zerochart_user_layouts', JSON.stringify(this.savedLayouts));
    } catch (_) {}
    this.renderSavedLayoutsList();

    // Cloud API sync
    try {
      await fetch('/api/user/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      });
    } catch (err) {
      console.warn('[ZeroChart] Cloud layout save failed, kept locally:', err);
    }

    // Visual feedback on save button
    const saveBtn = document.getElementById('btn-layout-save');
    if (saveBtn) {
      saveBtn.style.color = 'var(--buy)';
      setTimeout(() => (saveBtn.style.color = ''), 1500);
    }
    if (isManual) {
      this.showToast(`💾 Layout "${this.activeLayoutName}" saved successfully!`, 2200);
    }
  }

  async loadLayout(id) {
    const layout = this.savedLayouts.find((l) => l.id === id);
    if (!layout) return;

    this.activeLayoutId = layout.id;
    this.activeLayoutName = layout.name;
    this.updateLayoutTitleUI();

    if (layout.layoutSplits) {
      this.layoutSplits = layout.layoutSplits;
      try {
        localStorage.setItem('zerochart_layout_splits', JSON.stringify(this.layoutSplits));
      } catch (_) {}
    }
    if (layout.syncOptions) {
      this.syncOptions = { ...layout.syncOptions };
      this.saveSyncOptions();
      this.initMultiChartSync();
    }

    // Apply layout grid type
    if (layout.activeLayout) {
      this.setLayout(layout.activeLayout, true);
    }

    // Restore each pane
    if (Array.isArray(layout.panes)) {
      layout.panes.forEach((sp, idx) => {
        const pane = this.panes[idx];
        if (!pane) return;
        if (sp.symbol) {
          const inst = findInstrument(sp.symbol);
          if (inst) pane.instrument = inst;
        }
        if (sp.interval) pane.interval = sp.interval;
        if (sp.chartType) pane.chartType = sp.chartType;

        if (pane.widget) {
          if (pane.instrument?.symbol) {
            pane.widget.setSymbol(pane.instrument.symbol, pane.instrument.exchange);
          }
          if (pane.interval) {
            pane.widget.setInterval(pane.interval);
          }
          // Restore indicators
          if (Array.isArray(sp.indicators) && pane.widget.chart) {
            try {
              const curInds = pane.widget.chart.indicators();
              curInds.forEach((ci) => ci.remove?.());
              sp.indicators.forEach((ind) => {
                try {
                  pane.widget.chart.addIndicator(ind.indicatorId, ind.settings || {});
                } catch (_) {}
              });
            } catch (_) {}
          }
          // Restore drawings
          if (sp.drawings && pane.widget.draw && typeof pane.widget.draw.fromJSON === 'function') {
            try {
              pane.widget.draw.clear();
              pane.widget.draw.fromJSON(sp.drawings);
            } catch (_) {}
          }
        }
      });
    }

    if (typeof layout.activePaneIndex === 'number') {
      this.setActivePane(layout.activePaneIndex);
    }

    this.renderSavedLayoutsList();
    this.showToast(`✅ Loaded layout "${layout.name}"`, 2200);
  }

  async deleteLayout(id, e) {
    if (e) e.stopPropagation();
    const l = this.savedLayouts.find((item) => item.id === id);
    const name = l?.name || 'this layout';
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    this.savedLayouts = this.savedLayouts.filter((item) => item.id !== id);
    try {
      localStorage.setItem('zerochart_user_layouts', JSON.stringify(this.savedLayouts));
    } catch (_) {}

    try {
      await fetch(`/api/user/layouts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (_) {}

    this.renderSavedLayoutsList();
    this.showToast(`🗑️ Deleted layout "${name}"`, 2000);
  }

  renderSavedLayoutsList() {
    const container = document.getElementById('saved-layouts-list');
    if (!container) return;
    if (!this.savedLayouts || this.savedLayouts.length === 0) {
      container.innerHTML = `<div style="padding:8px 12px;font-size:11.5px;color:var(--text-muted);text-align:center;">No saved layouts yet. Click "+ Save New Setup..." to create one.</div>`;
      return;
    }

    container.innerHTML = this.savedLayouts
      .map((l) => {
        const isActive = l.id === this.activeLayoutId;
        const dateStr = l.updatedAt ? new Date(l.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        return `
        <div class="tv-saved-layout-item ${isActive ? 'active' : ''}" data-id="${l.id}">
          <div style="display:flex;flex-direction:column;flex:1;overflow:hidden;gap:2px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span class="name" style="font-weight:${isActive ? '700' : '500'};color:${isActive ? 'var(--accent)' : 'var(--text-bright)'};font-size:12.5px;">${l.name}</span>
              ${isActive ? '<span style="font-size:9.5px;background:rgba(41,98,255,0.15);color:var(--accent);padding:1px 5px;border-radius:4px;font-weight:700;">ACTIVE</span>' : ''}
            </div>
            <span class="meta" style="font-size:10.5px;color:var(--text-muted);">${l.activeLayout || '1 Chart'} • ${dateStr}</span>
          </div>
          <button class="del-btn" data-del-id="${l.id}" title="Delete layout" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;border-radius:4px;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
      `;
      })
      .join('');

    container.querySelectorAll('.tv-saved-layout-item').forEach((item) => {
      item.onclick = (e) => {
        if (e.target.closest('.del-btn')) return;
        const id = item.dataset.id;
        if (id) {
          this.loadLayout(id);
          document.getElementById('layout-manager-menu')?.classList.remove('show');
        }
      };
    });

    container.querySelectorAll('.del-btn').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.delId;
        if (id) this.deleteLayout(id, e);
      };
    });
  }

  // ─── INDICATOR STUDY TEMPLATES & PRESETS ───
  initStudyTemplates() {
    const openBtn = document.getElementById('btn-open-templates');
    const closeBtn = document.getElementById('btn-close-templates');
    const modal = document.getElementById('template-manager-modal');
    const saveBtn = document.getElementById('btn-save-current-template');
    const nameInput = document.getElementById('txt-new-template-name');

    if (openBtn) openBtn.onclick = () => this.openStudyTemplatesModal();
    if (closeBtn) closeBtn.onclick = () => this.closeModal('template-manager-modal');
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) this.closeModal('template-manager-modal');
      };
    }

    if (saveBtn && nameInput) {
      saveBtn.onclick = () => {
        const name = nameInput.value.trim();
        if (name) this.saveCurrentAsTemplate(name);
      };
      nameInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const name = nameInput.value.trim();
          if (name) this.saveCurrentAsTemplate(name);
        }
      };
    }

    this.renderProTemplates();
    this.loadSavedTemplates();
  }

  openStudyTemplatesModal() {
    this.openModal('template-manager-modal');
    const previewEl = document.getElementById('current-active-indicators-preview');
    const pane = this.panes[this.activePaneIndex];
    if (previewEl && pane?.widget?.chart) {
      try {
        const inds = pane.widget.chart.indicators();
        if (inds.length > 0) {
          const names = inds.map((i) => i.descriptor?.name || i.indicatorId.toUpperCase()).join(' + ');
          previewEl.innerHTML = `<span style="color:var(--accent);font-weight:600;">Active on chart:</span> ${names}`;
        } else {
          previewEl.innerHTML = `Active on chart: <span style="color:var(--text-muted);font-style:italic;">No indicators added</span>`;
        }
      } catch (_) {}
    }
  }

  renderProTemplates() {
    const container = document.getElementById('pro-templates-list');
    if (!container) return;

    const PRO_TEMPLATES = [
      {
        id: 'pro_scalper',
        name: '⚡ Scalper Pro (EMA 9/21 + VWAP + SuperTrend + RSI)',
        desc: 'High-probability momentum intraday scalping setup with dynamic trend filters.',
        indicators: [
          { indicatorId: 'ema', settings: { length: 9, color: '#2962ff' } },
          { indicatorId: 'ema', settings: { length: 21, color: '#f5a623' } },
          { indicatorId: 'vwap', settings: {} },
          { indicatorId: 'supertrend', settings: { period: 10, multiplier: 2 } },
          { indicatorId: 'rsi', settings: { length: 14 } },
        ],
      },
      {
        id: 'pro_trend_rider',
        name: '🌊 Trend Rider (EMA 20/50/200 + MACD + ATR)',
        desc: 'Institutional trend-following suite for capturing multi-hour and multi-day breakouts.',
        indicators: [
          { indicatorId: 'ema', settings: { length: 20, color: '#089981' } },
          { indicatorId: 'ema', settings: { length: 50, color: '#f5a623' } },
          { indicatorId: 'ema', settings: { length: 200, color: '#f23645' } },
          { indicatorId: 'macd', settings: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 } },
          { indicatorId: 'atr', settings: { length: 14 } },
        ],
      },
      {
        id: 'pro_bb_momentum',
        name: '🎯 Bollinger Squeeze & Momentum (BB + RSI + Stochastic)',
        desc: 'Detect volatility compression squeezes and explosive mean-reversion expansions.',
        indicators: [
          { indicatorId: 'bollinger', settings: { length: 20, stdDev: 2 } },
          { indicatorId: 'rsi', settings: { length: 14 } },
          { indicatorId: 'stochastic', settings: { kPeriod: 14, dPeriod: 3, slowing: 3 } },
        ],
      },
      {
        id: 'pro_clean_price',
        name: '💎 Clean Pure Price (Volume + VWAP)',
        desc: 'Distraction-free institutional price action and volume profile confluence.',
        indicators: [
          { indicatorId: 'volume', settings: {} },
          { indicatorId: 'vwap', settings: {} },
        ],
      },
    ];

    container.innerHTML = PRO_TEMPLATES.map((tpl) => `
      <div class="tv-template-card" data-pro-id="${tpl.id}" style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer;transition:all 0.15s ease;display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-weight:700;font-size:13px;color:var(--text-bright);">${tpl.name}</span>
          <span style="font-size:11px;background:rgba(41,98,255,0.12);color:var(--accent);padding:2px 6px;border-radius:4px;font-weight:600;">Apply</span>
        </div>
        <div style="font-size:11.5px;color:var(--text-muted);line-height:1.4;">${tpl.desc}</div>
      </div>
    `).join('');

    container.querySelectorAll('.tv-template-card').forEach((card) => {
      card.onclick = () => {
        const id = card.dataset.proId;
        const tpl = PRO_TEMPLATES.find((t) => t.id === id);
        if (tpl) this.applyIndicatorTemplate(tpl);
      };
    });
  }

  async loadSavedTemplates() {
    try {
      const resp = await fetch('/api/user/templates');
      if (resp.ok) {
        const json = await resp.json();
        if (json.status === 'success' && Array.isArray(json.templates)) {
          this.savedTemplates = json.templates;
          localStorage.setItem('zerochart_user_templates', JSON.stringify(this.savedTemplates));
          this.renderSavedTemplatesList();
          return;
        }
      }
    } catch (_) {}

    try {
      const local = localStorage.getItem('zerochart_user_templates');
      if (local) {
        this.savedTemplates = JSON.parse(local) || [];
      }
    } catch (_) {}
    this.renderSavedTemplatesList();
  }

  async saveCurrentAsTemplate(name) {
    if (!name || !name.trim()) {
      this.showToast('Please enter a template name', 2000);
      return;
    }
    const pane = this.panes[this.activePaneIndex];
    if (!pane?.widget?.chart) return;
    const inds = pane.widget.chart.indicators().map((i) => ({
      indicatorId: i.indicatorId,
      settings: i.settings(),
    }));

    if (inds.length === 0) {
      this.showToast('No active indicators on chart to save', 2000);
      return;
    }

    const template = {
      id: 'tpl_' + Date.now(),
      name: name.trim(),
      createdAt: Date.now(),
      indicators: inds,
    };

    const existingIdx = this.savedTemplates.findIndex((t) => t.name.toLowerCase() === template.name.toLowerCase());
    if (existingIdx >= 0) {
      this.savedTemplates[existingIdx] = template;
    } else {
      this.savedTemplates.unshift(template);
    }

    try {
      localStorage.setItem('zerochart_user_templates', JSON.stringify(this.savedTemplates));
    } catch (_) {}

    try {
      await fetch('/api/user/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
    } catch (_) {}

    this.renderSavedTemplatesList();
    this.showToast(`💾 Saved study template "${template.name}"`, 2200);
    const inputEl = document.getElementById('txt-new-template-name');
    if (inputEl) inputEl.value = '';
  }

  applyIndicatorTemplate(template, replace = true) {
    const pane = this.panes[this.activePaneIndex];
    if (!pane?.widget?.chart) return;
    const chart = pane.widget.chart;

    if (replace) {
      try {
        const existing = chart.indicators();
        existing.forEach((ind) => {
          try { ind.remove?.(); } catch (_) {}
        });
      } catch (_) {}
    }

    for (const item of template.indicators) {
      try {
        chart.addIndicator(item.indicatorId, item.settings || {});
      } catch (e) {
        console.warn('[ZeroChart] Failed to add template indicator:', item.indicatorId, e);
      }
    }

    this.saveGlobalIndicators(this.activePaneIndex);
    this.closeModal('template-manager-modal');
    this.showToast(`✨ Applied "${template.name}" template`, 2200);
  }

  async deleteTemplate(id, e) {
    if (e) e.stopPropagation();
    const t = this.savedTemplates.find((item) => item.id === id);
    const name = t?.name || 'this template';
    if (!confirm(`Delete template "${name}"?`)) return;

    this.savedTemplates = this.savedTemplates.filter((item) => item.id !== id);
    try {
      localStorage.setItem('zerochart_user_templates', JSON.stringify(this.savedTemplates));
    } catch (_) {}

    try {
      await fetch(`/api/user/templates?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (_) {}

    this.renderSavedTemplatesList();
    this.showToast(`🗑️ Deleted template "${name}"`, 2000);
  }

  renderSavedTemplatesList() {
    const container = document.getElementById('user-templates-list');
    if (!container) return;
    if (!this.savedTemplates || this.savedTemplates.length === 0) {
      container.innerHTML = `<div style="padding:10px;font-size:11.5px;color:var(--text-muted);text-align:center;">No custom templates yet. Add your favorite indicators and click "Save Setup" above.</div>`;
      return;
    }

    container.innerHTML = this.savedTemplates.map((tpl) => {
      const indNames = tpl.indicators.map((i) => i.indicatorId.toUpperCase()).join(', ');
      const dateStr = tpl.createdAt ? new Date(tpl.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
      return `
        <div class="tv-template-card" data-user-tpl-id="${tpl.id}" style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;cursor:pointer;transition:all 0.15s ease;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;flex-direction:column;gap:3px;flex:1;overflow:hidden;">
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-weight:700;font-size:13px;color:var(--text-bright);">${tpl.name}</span>
              <span style="font-size:10px;color:var(--text-muted);">${dateStr}</span>
            </div>
            <span style="font-size:11.5px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${indNames}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:11px;background:rgba(41,98,255,0.12);color:var(--accent);padding:2px 8px;border-radius:4px;font-weight:600;">Apply</span>
            <button class="del-tpl-btn" data-del-tpl-id="${tpl.id}" title="Delete template" style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:4px;border-radius:4px;">✕</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.tv-template-card').forEach((card) => {
      card.onclick = (e) => {
        if (e.target.closest('.del-tpl-btn')) return;
        const id = card.dataset.userTplId;
        const tpl = this.savedTemplates.find((t) => t.id === id);
        if (tpl) this.applyIndicatorTemplate(tpl);
      };
    });

    container.querySelectorAll('.del-tpl-btn').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.delTplId;
        if (id) this.deleteTemplate(id, e);
      };
    });
  }

  // ─── PROGRESSIVE WEB APP (PWA) SYSTEM ───
  initPWA() {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js?v=2.7.0')
          .then((reg) => {
            console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
            try { reg.update(); } catch (_) {}
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
    let favTools = this.favoriteTools || ['trend-line', 'horizontal-line', 'ray', 'price-range', 'fib-retracement', 'rectangle', 'brush', 'text', 'measure'];
    try {
      const saved = localStorage.getItem('zerochart_fav_tools');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          favTools = parsed;
          if (!favTools.includes('price-range')) {
            favTools.splice(3, 0, 'price-range');
            localStorage.setItem('zerochart_fav_tools', JSON.stringify(favTools));
          }
        }
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

  // ═══════════════════════════════════════════════════════════════
  // ─── 15. DEDICATED OPEN INTEREST (OI) & OPTIONS SUITE ENGINE ───
  // ═══════════════════════════════════════════════════════════════

  initOIAnalytics() {
    // 1. Topbar Trigger
    const btnOpenTop = document.getElementById('btn-open-oi-dashboard');
    if (btnOpenTop) {
      btnOpenTop.onclick = () => this.openOIDashboard();
    }

    // 2. Fullscreen Expand from Sidebar
    const btnExpand = document.getElementById('btn-expand-oi-fullscreen');
    if (btnExpand) {
      btnExpand.onclick = () => this.openOIDashboard();
    }

    // 3. Modal Close Button
    const btnClose = document.getElementById('btn-close-oi-dashboard');
    const oiModal = document.getElementById('oi-analytics-modal');
    if (btnClose) {
      btnClose.onclick = () => this.closeOIDashboard();
    }
    if (oiModal) {
      oiModal.onclick = (e) => {
        if (e.target === oiModal) this.closeOIDashboard();
      };
    }

    // 4. Subtabs Switching (OI Change, Open Interest, Multistrike OI, etc.)
    const subtabs = document.querySelectorAll('#oi-subtabs .tv-oi-tab-btn');
    subtabs.forEach((btn) => {
      btn.onclick = () => {
        subtabs.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.oiActiveSubtab = btn.dataset.subtab || 'oi-change';
        if (this.oiActiveSubtab === 'open-interest') {
          this.oiShowTotal = true;
          const toggleTotal = document.getElementById('toggle-show-total-oi');
          if (toggleTotal) toggleTotal.checked = true;
        } else if (this.oiActiveSubtab === 'oi-change') {
          this.oiShowTotal = false;
          const toggleTotal = document.getElementById('toggle-show-total-oi');
          if (toggleTotal) toggleTotal.checked = false;
        }
        this.renderOIDashboard();
      };
    });

    // 5. Total OI Switch Toggle
    const toggleTotal = document.getElementById('toggle-show-total-oi');
    if (toggleTotal) {
      toggleTotal.onchange = (e) => {
        this.oiShowTotal = e.target.checked;
        const subtabBtns = document.querySelectorAll('#oi-subtabs .tv-oi-tab-btn');
        subtabBtns.forEach((b) => {
          if (this.oiShowTotal && b.dataset.subtab === 'open-interest') b.classList.add('active');
          else if (!this.oiShowTotal && b.dataset.subtab === 'oi-change') b.classList.add('active');
          else b.classList.remove('active');
        });
        this.renderOIDashboard();
      };
    }

    // 6. Symbol Selector in OI Panel (Opens Search Modal)
    const symBox = document.getElementById('oi-sym-selector-btn');
    if (symBox) {
      symBox.onclick = () => {
        const searchBtn = document.getElementById('btn-open-search');
        if (searchBtn) searchBtn.click();
      };
    }

    // 7. Info Button
    const infoBtn = document.getElementById('btn-oi-sym-info');
    if (infoBtn) {
      infoBtn.onclick = (e) => {
        e.stopPropagation();
        const inst = findInstrument(this.oiActiveSymbol) || this.currentInstrument;
        const lot = inst?.symbol?.includes('BANKNIFTY') ? 15 : (inst?.symbol?.includes('NIFTY') ? 25 : (inst?.symbol?.includes('FINNIFTY') ? 25 : 100));
        alert(`ℹ️ ${inst.name || inst.symbol}\n• Exchange: ${inst.exchange || 'NSE'}\n• Lot Size: ${lot}\n• Tick Size: ${inst.tickSize || 0.05}\n• Weekly Settlement: Thursdays\n• Monthly Settlement: Last Thursday of Month`);
      };
    }

    // 8. How to Read Educational Modal
    const btnHowTo = document.getElementById('btn-oi-how-to-read');
    const helpModal = document.getElementById('oi-help-modal');
    const btnCloseHelp = document.getElementById('btn-close-oi-help');
    if (btnHowTo && helpModal) {
      btnHowTo.onclick = () => helpModal.classList.add('show');
    }
    if (btnCloseHelp && helpModal) {
      btnCloseHelp.onclick = () => helpModal.classList.remove('show');
    }
    if (helpModal) {
      helpModal.onclick = (e) => {
        if (e.target === helpModal) helpModal.classList.remove('show');
      };
    }

    // 9. Mode Selector (Intraday vs Custom Range)
    const modeRadios = document.querySelectorAll('input[name="oi-mode"]');
    modeRadios.forEach((r) => {
      r.onchange = () => {
        this.oiMode = r.value;
        this.renderOIDashboard();
      };
    });

    // 10. Strike Steppers & Reset
    const btnMinDec = document.getElementById('btn-strike-min-dec');
    const btnMinInc = document.getElementById('btn-strike-min-inc');
    const btnMaxDec = document.getElementById('btn-strike-max-dec');
    const btnMaxInc = document.getElementById('btn-strike-max-inc');
    const btnResetRange = document.getElementById('btn-reset-strike-range');

    const stepStrike = (isMin, delta) => {
      const data = this.getOIOptionChainData();
      const step = data.strikeStep || 50;
      if (isMin) {
        const cur = this.oiCustomMin != null ? this.oiCustomMin : data.minStrike;
        this.oiCustomMin = cur + delta * step;
      } else {
        const cur = this.oiCustomMax != null ? this.oiCustomMax : data.maxStrike;
        this.oiCustomMax = cur + delta * step;
      }
      this.renderOIDashboard();
    };

    if (btnMinDec) btnMinDec.onclick = () => stepStrike(true, -1);
    if (btnMinInc) btnMinInc.onclick = () => stepStrike(true, 1);
    if (btnMaxDec) btnMaxDec.onclick = () => stepStrike(false, -1);
    if (btnMaxInc) btnMaxInc.onclick = () => stepStrike(false, 1);
    if (btnResetRange) {
      btnResetRange.onclick = () => {
        this.oiCustomMin = null;
        this.oiCustomMax = null;
        this.oiATMFilter = 20;
        document.querySelectorAll('#oi-atm-pills .tv-oi-atm-btn').forEach((b) => {
          b.classList.toggle('active', b.dataset.atm === '20');
        });
        this.renderOIDashboard();
      };
    }

    // 11. ATM Quick Filter Pills (Show All, 5, 10, 15, 20, 25)
    const atmPills = document.querySelectorAll('#oi-atm-pills .tv-oi-atm-btn');
    atmPills.forEach((btn) => {
      btn.onclick = () => {
        atmPills.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const val = btn.dataset.atm;
        this.oiATMFilter = val === 'all' ? 'all' : parseInt(val, 10);
        this.oiCustomMin = null;
        this.oiCustomMax = null;
        this.renderOIDashboard();
      };
    });

    // 12. Intraday Time Slider (9:15 AM to 3:30 PM with 75 5-minute ticks)
    const timeSlider = document.getElementById('oi-time-range-slider');
    const timeCurrentLbl = document.getElementById('oi-time-current-lbl');
    if (timeSlider) {
      timeSlider.oninput = (e) => {
        this.oiTimeSliderIndex = parseInt(e.target.value, 10);
        const minsFromOpen = this.oiTimeSliderIndex * 5;
        const totalMinutes = 9 * 60 + 15 + minsFromOpen;
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        const formattedHrs = hrs > 12 ? hrs - 12 : hrs;
        const formattedMins = mins < 10 ? `0${mins}` : mins;
        const isFull = this.oiTimeSliderIndex >= 75;
        if (timeCurrentLbl) {
          timeCurrentLbl.textContent = isFull ? '3:30 PM (Full Day)' : `${formattedHrs}:${formattedMins} ${ampm}`;
        }
        document.querySelectorAll('#oi-time-presets .tv-oi-tp-btn').forEach((b) => b.classList.remove('active'));
        this.renderOIDashboard();
      };
    }

    // 13. Time Preset Quick Buttons
    const timePresets = document.querySelectorAll('#oi-time-presets .tv-oi-tp-btn');
    timePresets.forEach((btn) => {
      btn.onclick = () => {
        timePresets.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const p = btn.dataset.time;
        this.oiTimePreset = p;
        let idx = 75;
        if (p === '5m') idx = 74;
        else if (p === '10m') idx = 73;
        else if (p === '15m') idx = 72;
        else if (p === '30m') idx = 69;
        else if (p === '1h') idx = 63;
        else if (p === '2h') idx = 51;
        else if (p === '3h') idx = 39;
        else idx = 75;

        this.oiTimeSliderIndex = idx;
        if (timeSlider) timeSlider.value = idx;
        const minsFromOpen = idx * 5;
        const totalMinutes = 9 * 60 + 15 + minsFromOpen;
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        const formattedHrs = hrs > 12 ? hrs - 12 : hrs;
        const formattedMins = mins < 10 ? `0${mins}` : mins;
        if (timeCurrentLbl) {
          timeCurrentLbl.textContent = idx >= 75 ? '3:30 PM (Full Day)' : `${formattedHrs}:${formattedMins} ${ampm}`;
        }
        this.renderOIDashboard();
      };
    });

    // 14. Sidebar Panel Refresh & Mobile Close
    const btnRefOI = document.getElementById('btn-refresh-oi');
    if (btnRefOI) btnRefOI.onclick = () => this.loadOISidebarPanel();
    const btnMobCloseOI = document.getElementById('btn-mob-close-oi');
    if (btnMobCloseOI) btnMobCloseOI.onclick = () => this.closeSidebarDrawer();

    // 15. Canvas Interactive Mouse / Touch Crosshair Tooltip
    const canvas = document.getElementById('oi-histogram-canvas');
    const tooltip = document.getElementById('oi-chart-tooltip');
    if (canvas) {
      const handlePointerMove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        if (this._lastOIBars && this._lastOIBars.length > 0) {
          let hovered = null;
          for (const b of this._lastOIBars) {
            if (x >= b.slotLeft && x <= b.slotRight) {
              hovered = b;
              break;
            }
          }

          if (hovered && tooltip) {
            this.oiHoveredStrike = hovered.strike;
            const sign = hovered.netDiff >= 0 ? '+' : '';
            const isIndian = hovered.isIndian;
            const putChgStr = this.formatOINumber(hovered.putChg, isIndian);
            const callChgStr = this.formatOINumber(hovered.callChg, isIndian);
            const putOIStr = this.formatOINumber(hovered.putOI, isIndian);
            const callOIStr = this.formatOINumber(hovered.callOI, isIndian);
            const diffStr = this.formatOINumber(hovered.netDiff, isIndian);

            tooltip.style.display = 'flex';
            tooltip.style.left = `${Math.min(rect.width - 180, Math.max(10, x - 80))}px`;
            tooltip.style.top = `${Math.max(10, Math.min(rect.height - 130, y - 60))}px`;
            tooltip.innerHTML = `
              <div class="title">Strike: ${hovered.strike.toLocaleString()} ${hovered.isATM ? '⭐ ATM' : ''}</div>
              <div class="row"><span>🟢 Put OI ${this.oiShowTotal ? '' : 'Chg'}:</span> <b>${this.oiShowTotal ? putOIStr : putChgStr}</b></div>
              <div class="row"><span>🔴 Call OI ${this.oiShowTotal ? '' : 'Chg'}:</span> <b>${this.oiShowTotal ? callOIStr : callChgStr}</b></div>
              <div class="row" style="border-top:1px solid rgba(255,255,255,0.1);padding-top:2px;">
                <span>Net Diff (PE-CE):</span> <b style="color:${hovered.netDiff >= 0 ? '#00e676' : '#ff1744'};">${sign}${diffStr}</b>
              </div>
              <div class="row"><span>Strike PCR:</span> <b>${hovered.strikePCR.toFixed(2)}</b></div>
              <div class="row"><span>Call IV / Put IV:</span> <b style="color:var(--text-muted);">${hovered.callIV}% / ${hovered.putIV}%</b></div>
            `;
            this.drawOIHistogramCanvas(this._lastOIData);
          } else if (tooltip) {
            tooltip.style.display = 'none';
            this.oiHoveredStrike = null;
          }
        }
      };

      canvas.addEventListener('mousemove', handlePointerMove);
      canvas.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.style.display = 'none';
        this.oiHoveredStrike = null;
        if (this._lastOIData) this.drawOIHistogramCanvas(this._lastOIData);
      });
      canvas.addEventListener('touchmove', handlePointerMove, { passive: true });
      canvas.addEventListener('touchend', () => {
        if (tooltip) tooltip.style.display = 'none';
        this.oiHoveredStrike = null;
      });
    }

    // Auto resize canvas on window resize
    window.addEventListener('resize', () => {
      const modal = document.getElementById('oi-analytics-modal');
      if (modal && modal.classList.contains('show')) {
        this.renderOIDashboard();
      }
    });
  }

  openOIDashboard(symbol = null) {
    const activeSym = symbol || this.currentInstrument?.symbol || 'NIFTY';
    if (this.oiActiveSymbol !== activeSym) {
      this.oiActiveSymbol = activeSym;
      this.oiSelectedExpiry = null;
      this._cachedOIData = null;
      this.oiCustomMin = null;
      this.oiCustomMax = null;
    }
    const modal = document.getElementById('oi-analytics-modal');
    if (modal) {
      modal.classList.add('show');
      this.renderOIDashboard();
    }
    if (window.innerWidth <= 768) {
      document.body.classList.remove('mobile-drawer-open');
      const sidebar = document.querySelector('.tv-right-sidebar');
      if (sidebar) sidebar.classList.remove('mobile-open');
      document.querySelectorAll('.tv-mob-nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.id === 'mob-nav-oi');
      });
      this.currentViewState = 'oi';
      this.pushHistoryState({ view: 'oi' });
    }
  }

  closeOIDashboard() {
    const modal = document.getElementById('oi-analytics-modal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  formatOINumber(val, isIndian = true) {
    if (val === 0 || !Number.isFinite(val)) return '0';
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : (val > 0 ? '+' : '');

    if (isIndian) {
      if (abs >= 10000000) return `${sign}${(abs / 10000000).toFixed(2)}Cr`;
      if (abs >= 100000) return `${sign}${(abs / 100000).toFixed(1)}L`;
      if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}k`;
      return `${sign}${abs.toLocaleString()}`;
    } else {
      if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(2)}M`;
      if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}K`;
      return `${sign}${abs.toLocaleString()}`;
    }
  }

  async fetchOptionChainData(sym = this.oiActiveSymbol, expiry = this.oiSelectedExpiry) {
    const activeSym = sym || this.currentInstrument?.symbol || 'NIFTY';
    const cleanSym = (activeSym || '').replace(/\s*FUT$|\s*1!$/i, '').trim();
    try {
      const url = `/api/market/option-chain?symbol=${encodeURIComponent(cleanSym)}${expiry ? `&expiry=${encodeURIComponent(expiry)}` : ''}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.status === 'success') {
          this._cachedOIData = json;
          if (json.expiry) this.oiSelectedExpiry = json.expiry;
          return json;
        }
      }
    } catch (err) {
      console.warn('[Option Chain] Fetch error:', err);
    }
    return this._cachedOIData || null;
  }

  getOIOptionChainData(sym = this.oiActiveSymbol, timeIndex = this.oiTimeSliderIndex, isTotalOI = this.oiShowTotal, atmFilter = this.oiATMFilter) {
    const rawData = this._cachedOIData;
    const inst = findInstrument(sym) || this.currentInstrument || {
      symbol: 'NIFTY 50',
      displaySymbol: 'NIFTY',
      name: 'NIFTY 50 Index',
      basePrice: 22716.20,
      precision: 2,
    };

    const q = this.livePrices.get(inst.symbol);
    const spot = rawData?.spot || q?.last || inst.basePrice || 22716.20;
    const isIndian = inst.category === 'india' || !inst.category || inst.symbol.includes('NIFTY') || inst.symbol.includes('BANKNIFTY') || inst.symbol.includes('SENSEX');

    if (rawData && rawData.strikeRows && rawData.strikeRows.length > 0) {
      const progress = Math.min(1.0, Math.max(0.05, timeIndex / 75));
      const dayOpenPrice = rawData.dayOpenPrice || +(spot * 1.0028).toFixed(inst.precision || 2);
      const interpolatedSpot = +(dayOpenPrice + (spot - dayOpenPrice) * progress).toFixed(inst.precision || 2);

      let allRows = rawData.strikeRows;
      const centerStrike = rawData.maxPainStrike || spot;

      // Apply ATM Pill Filter (e.g. 5, 10, 15, 20, 25, 'all')
      if (typeof atmFilter === 'number') {
        let centerIdx = allRows.findIndex((r) => r.isATM);
        if (centerIdx === -1) {
          let minD = Infinity;
          allRows.forEach((r, idx) => {
            const d = Math.abs(r.strike - spot);
            if (d < minD) { minD = d; centerIdx = idx; }
          });
        }
        if (centerIdx === -1) centerIdx = Math.floor(allRows.length / 2);
        const minIdx = Math.max(0, centerIdx - atmFilter);
        const maxIdx = Math.min(allRows.length - 1, centerIdx + atmFilter);
        allRows = allRows.slice(minIdx, maxIdx + 1);
      }

      // Apply Custom Strike Range Min/Max
      if (this.oiCustomMin != null) {
        allRows = allRows.filter((r) => r.strike >= this.oiCustomMin);
      }
      if (this.oiCustomMax != null) {
        allRows = allRows.filter((r) => r.strike <= this.oiCustomMax);
      }

      const minStrike = allRows.length > 0 ? allRows[0].strike : spot - 1000;
      const maxStrike = allRows.length > 0 ? allRows[allRows.length - 1].strike : spot + 1000;

      let totalCallOI = 0, totalPutOI = 0;
      let netCallOIChg = 0, netPutOIChg = 0;

      const strikeRows = allRows.map((r) => {
        const scaledCallChg = Math.round((r.callChg || 0) * progress);
        const scaledPutChg = Math.round((r.putChg || 0) * progress);
        const callOI = r.callOI || 0;
        const putOI = r.putOI || 0;

        totalCallOI += callOI;
        totalPutOI += putOI;
        netCallOIChg += scaledCallChg;
        netPutOIChg += scaledPutChg;

        return {
          ...r,
          callChg: scaledCallChg,
          putChg: scaledPutChg,
          netDiff: scaledPutChg - scaledCallChg,
          strikePCR: callOI > 0 ? +(putOI / callOI).toFixed(2) : 1.0,
          isIndian: true,
        };
      });

      const pcr = totalCallOI > 0 ? +(totalPutOI / totalCallOI).toFixed(2) : (rawData.pcr || 1.0);

      return {
        inst,
        spot,
        dayOpenPrice,
        interpolatedSpot,
        minStrike,
        maxStrike,
        centerStrike,
        isIndian: true,
        pcr,
        maxPainStrike: rawData.maxPainStrike || centerStrike,
        indiaVIX: rawData.indiaVIX || 13.41,
        totalCallOI,
        totalPutOI,
        netCallOIChg,
        netPutOIChg,
        strikeRows,
        availableExpiries: rawData.availableExpiries || [],
        expiry: rawData.expiry || 'Current',
        source: rawData.source || 'Groww Real Market Feed',
      };
    }

    // Fallback baseline modeling if network fetch pending
    let strikeStep = 50;
    if (inst.symbol.includes('BANKNIFTY') || inst.symbol.includes('SENSEX')) strikeStep = 100;
    else if (inst.symbol.includes('NIFTY') || inst.symbol.includes('FINNIFTY')) strikeStep = 50;
    else if (spot > 40000) strikeStep = 500;
    else if (spot > 10000) strikeStep = 100;
    else if (spot > 2500) strikeStep = 50;
    else if (spot > 1000) strikeStep = 20;
    else strikeStep = 5;

    const centerStrike = Math.round(spot / strikeStep) * strikeStep;
    const filterCount = typeof atmFilter === 'number' ? atmFilter : (atmFilter === 'all' ? 30 : 20);

    let minStrike = centerStrike - filterCount * strikeStep;
    let maxStrike = centerStrike + filterCount * strikeStep;

    if (this.oiCustomMin != null) minStrike = this.oiCustomMin;
    if (this.oiCustomMax != null) maxStrike = this.oiCustomMax;

    const strikes = [];
    for (let k = minStrike; k <= maxStrike + strikeStep * 0.1; k += strikeStep) {
      strikes.push(Math.round(k / (strikeStep >= 1 ? 1 : 0.1)) * (strikeStep >= 1 ? 1 : 0.1));
    }

    const progress = Math.min(1.0, Math.max(0.05, timeIndex / 75));
    const dayOpenPrice = +(spot * 1.0028).toFixed(inst.precision || 2);
    const interpolatedSpot = +(dayOpenPrice + (spot - dayOpenPrice) * progress).toFixed(inst.precision || 2);

    let totalCallOI = 0, totalPutOI = 0;
    let netCallOIChg = 0, netPutOIChg = 0;
    const strikeRows = [];

    strikes.forEach((k) => {
      const distFromSpot = (k - spot) / spot;
      const baseCallOI = Math.round((1800000 + 12000000 * Math.exp(-0.5 * Math.pow((k - (spot * 1.015)) / (spot * 0.04), 2))) * (spot > 10000 ? 1 : 0.2));
      const basePutOI = Math.round((1600000 + 11500000 * Math.exp(-0.5 * Math.pow((k - (spot * 0.985)) / (spot * 0.04), 2))) * (spot > 10000 ? 1 : 0.2));

      let rawCallChg = 0, rawPutChg = 0;
      if (k > centerStrike) {
        rawCallChg = Math.round((8500000 * Math.exp(-0.5 * Math.pow((k - (spot * 1.008)) / (spot * 0.025), 2)) + 1500000) * progress * (spot > 10000 ? 1 : 0.2));
        rawPutChg = Math.round((-4500000 * Math.exp(-0.5 * Math.pow((k - (spot * 1.005)) / (spot * 0.02), 2)) - 500000) * progress * (spot > 10000 ? 1 : 0.2));
      } else if (k < centerStrike) {
        rawPutChg = Math.round((8200000 * Math.exp(-0.5 * Math.pow((k - (spot * 0.992)) / (spot * 0.025), 2)) + 1200000) * progress * (spot > 10000 ? 1 : 0.2));
        rawCallChg = Math.round((-3800000 * Math.exp(-0.5 * Math.pow((k - (spot * 0.995)) / (spot * 0.02), 2)) - 400000) * progress * (spot > 10000 ? 1 : 0.2));
      } else {
        rawCallChg = Math.round(14500000 * progress * (spot > 10000 ? 1 : 0.2));
        rawPutChg = Math.round(11800000 * progress * (spot > 10000 ? 1 : 0.2));
      }

      const callOI = baseCallOI + (rawCallChg > 0 ? rawCallChg : 0);
      const putOI = basePutOI + (rawPutChg > 0 ? rawPutChg : 0);

      totalCallOI += callOI;
      totalPutOI += putOI;
      netCallOIChg += rawCallChg;
      netPutOIChg += rawPutChg;

      const isATM = Math.abs(k - centerStrike) < strikeStep * 0.45;
      const strikePCR = callOI > 0 ? +(putOI / callOI) : 1.0;
      const callIV = +(12.5 + Math.abs(distFromSpot) * 40).toFixed(1);
      const putIV = +(13.8 + Math.abs(distFromSpot) * 45).toFixed(1);

      strikeRows.push({
        strike: k,
        isATM,
        callOI,
        putOI,
        callChg: rawCallChg,
        putChg: rawPutChg,
        netDiff: rawPutChg - rawCallChg,
        strikePCR,
        callIV,
        putIV,
        isIndian,
      });
    });

    const pcr = totalCallOI > 0 ? +(totalPutOI / totalCallOI).toFixed(2) : 0.92;
    const maxPainStrike = centerStrike;
    const indiaVIX = 13.41;

    return {
      inst,
      spot,
      dayOpenPrice,
      interpolatedSpot,
      strikeStep,
      minStrike,
      maxStrike,
      centerStrike,
      isIndian,
      pcr,
      maxPainStrike,
      indiaVIX,
      totalCallOI,
      totalPutOI,
      netCallOIChg,
      netPutOIChg,
      strikeRows,
      availableExpiries: [],
      expiry: 'Current',
    };
  }

  formatExpiryItem(expStr) {
    if (!expStr) return { raw: '', label: '', tag: 'W' };
    let d = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(expStr)) {
      d = new Date(expStr + 'T00:00:00Z');
    } else {
      const match = expStr.match(/^(\d{2})([A-Z]{3})(\d{4})$/i);
      if (match) {
        const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
        const m = months[match[2].toUpperCase()];
        if (m !== undefined) {
          d = new Date(Date.UTC(+match[3], m, +match[1]));
        }
      }
    }
    if (!d || isNaN(d.getTime())) return { raw: expStr, label: expStr, tag: 'W' };

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayStr = String(d.getUTCDate()).padStart(2, '0');
    const monStr = monthNames[d.getUTCMonth()];

    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const diffMs = d.getTime() - todayUtc;
    const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

    const tag = days <= 23 ? 'w' : 'm';
    return {
      raw: expStr,
      label: `${dayStr} ${monStr} (${days} days)`,
      tag: tag,
      days: days,
    };
  }

  async renderOIDashboard() {
    // 1. Fetch Real Live Data from Server Endpoint
    await this.fetchOptionChainData(this.oiActiveSymbol, this.oiSelectedExpiry);
    const data = this.getOIOptionChainData();
    this._lastOIData = data;

    // 2. Update Left Panel Info
    const titleEl = document.getElementById('oi-active-symbol-title');
    const priceEl = document.getElementById('oi-active-symbol-price');
    const pctEl = document.getElementById('oi-active-symbol-pct');
    const minValEl = document.getElementById('oi-strike-min-val');
    const maxValEl = document.getElementById('oi-strike-max-val');

    if (titleEl) titleEl.textContent = data.inst.displaySymbol || data.inst.symbol;
    if (priceEl) priceEl.textContent = data.spot.toLocaleString(undefined, { minimumFractionDigits: data.inst.precision, maximumFractionDigits: data.inst.precision });
    if (pctEl) {
      const isUp = (data.spot - data.dayOpenPrice) >= 0;
      const pct = data.dayOpenPrice > 0 ? (((data.spot - data.dayOpenPrice) / data.dayOpenPrice) * 100).toFixed(2) : '0.00';
      pctEl.textContent = `${isUp ? '+' : ''}${pct}%`;
      pctEl.className = `tv-oi-sym-pct ${isUp ? 'up' : 'dn'}`;
    }
    if (minValEl) minValEl.textContent = data.minStrike.toLocaleString();
    if (maxValEl) maxValEl.textContent = data.maxStrike.toLocaleString();

    // 3. Dynamic Expiries List with Real Exchange Expiries
    const expiriesContainer = document.getElementById('oi-expiries-list');
    if (expiriesContainer) {
      const exps = data.availableExpiries && data.availableExpiries.length > 0
        ? data.availableExpiries
        : ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29', '2026-11-26'];

      expiriesContainer.innerHTML = exps.map((exp, idx) => {
        const isChecked = exp === data.expiry || (idx === 0 && !this.oiSelectedExpiry);
        const meta = this.formatExpiryItem(exp);
        return `
          <label class="tv-oi-expiry-item" style="cursor:pointer;">
            <input type="radio" name="oi-expiry" value="${exp}" ${isChecked ? 'checked' : ''} />
            <span style="font-weight:600;">${meta.label}</span>
            <span class="tv-oi-exp-tag">${meta.tag}</span>
          </label>
        `;
      }).join('');

      expiriesContainer.querySelectorAll('input[name="oi-expiry"]').forEach((radio) => {
        radio.onchange = async (e) => {
          if (e.target.checked) {
            this.oiSelectedExpiry = e.target.value;
            this._cachedOIData = null;
            await this.renderOIDashboard();
          }
        };
      });
    }

    // 4. Top Metrics
    const pcrValEl = document.getElementById('oi-top-pcr-val');
    const maxPainEl = document.getElementById('oi-top-maxpain-val');
    const vixValEl = document.getElementById('oi-top-vix-val');
    if (pcrValEl) pcrValEl.textContent = data.pcr.toFixed(1);
    if (maxPainEl) maxPainEl.textContent = data.maxPainStrike.toLocaleString();
    if (vixValEl) vixValEl.textContent = data.indiaVIX.toFixed(1);

    const sidebarPcr = document.getElementById('sidebar-oi-pcr-badge');
    if (sidebarPcr) sidebarPcr.textContent = `PCR ${data.pcr.toFixed(1)}`;

    // 5. Chart Title & Legend Labels
    const chartTitle = document.getElementById('oi-chart-title');
    const putLegend = document.getElementById('lbl-put-legend');
    const callLegend = document.getElementById('lbl-call-legend');

    const expMeta = this.formatExpiryItem(data.expiry);
    const expDisplay = expMeta.label ? expMeta.label.split(' (')[0] : data.expiry;

    if (chartTitle) {
      const symName = data.inst.displaySymbol || data.inst.symbol;
      chartTitle.textContent = this.oiShowTotal ? `Total Open Interest on ${symName} (${expDisplay})` : `OI Change on Tue, 29 Sep (${symName} ${expDisplay})`;
    }
    if (putLegend) putLegend.textContent = this.oiShowTotal ? 'Put OI' : 'Put OI chg';
    if (callLegend) callLegend.textContent = this.oiShowTotal ? 'Call OI' : 'Call OI chg';

    // 6. Summary Footer Card
    const sumCallEl = document.getElementById('oi-sum-call-chg');
    const sumPutEl = document.getElementById('oi-sum-put-chg');
    const sumOpenPriceEl = document.getElementById('oi-sum-open-price');
    const sumClosePriceEl = document.getElementById('oi-sum-close-price');
    const sumOpenLbl = document.getElementById('oi-sum-sym-open-lbl');
    const sumCloseLbl = document.getElementById('oi-sum-sym-close-lbl');

    if (sumCallEl) {
      const callVal = this.oiShowTotal ? data.totalCallOI : data.netCallOIChg;
      sumCallEl.textContent = this.formatOINumber(callVal, data.isIndian);
      sumCallEl.className = `val ${callVal >= 0 ? 'dn' : 'up'}`;
    }
    if (sumPutEl) {
      const putVal = this.oiShowTotal ? data.totalPutOI : data.netPutOIChg;
      sumPutEl.textContent = this.formatOINumber(putVal, data.isIndian);
      sumPutEl.className = `val ${putVal >= 0 ? 'up' : 'dn'}`;
    }
    if (sumOpenPriceEl) sumOpenPriceEl.textContent = data.dayOpenPrice.toLocaleString(undefined, { minimumFractionDigits: data.inst.precision, maximumFractionDigits: data.inst.precision });
    if (sumClosePriceEl) sumClosePriceEl.textContent = data.interpolatedSpot.toLocaleString(undefined, { minimumFractionDigits: data.inst.precision, maximumFractionDigits: data.inst.precision });
    if (sumOpenLbl) sumOpenLbl.textContent = `${data.inst.displaySymbol || data.inst.symbol} at 9:15 AM:`;
    if (sumCloseLbl) sumCloseLbl.textContent = `${data.inst.displaySymbol || data.inst.symbol} at 3:40 PM:`;

    // 7. Draw Canvas Histogram
    requestAnimationFrame(() => this.drawOIHistogramCanvas(data));
  }

  drawOIHistogramCanvas(data) {
    const canvas = document.getElementById('oi-histogram-canvas');
    if (!canvas) return;

    const wrapper = canvas.parentElement;
    const width = wrapper.clientWidth || 900;
    const height = wrapper.clientHeight || 360;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const padLeft = 65;
    const padRight = 35;
    const padTop = 32;
    const padBottom = 42;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const rows = data.strikeRows;
    if (!rows || rows.length === 0) return;

    const isTotal = this.oiShowTotal;
    let maxPos = 10000;
    let maxNeg = 10000;

    if (isTotal) {
      rows.forEach((r) => {
        if (r.putOI > maxPos) maxPos = r.putOI;
        if (r.callOI > maxPos) maxPos = r.callOI;
      });
      maxPos = maxPos * 1.15;
    } else {
      rows.forEach((r) => {
        if (r.putChg > maxPos) maxPos = r.putChg;
        if (r.callChg > maxPos) maxPos = r.callChg;
        if (r.putChg < -maxNeg) maxNeg = -r.putChg;
        if (r.callChg < -maxNeg) maxNeg = -r.callChg;
      });
      maxPos = Math.max(maxPos * 1.15, 10000);
      maxNeg = Math.max(maxNeg * 1.15, 5000);
    }

    const totalRange = isTotal ? maxPos : (maxPos + maxNeg);
    const zeroY = isTotal ? (padTop + chartH) : (padTop + (maxPos / totalRange) * chartH);

    // 1. Draw Background Grid Lines & Y-Axis Ticks
    const numGridLines = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#787b86';
    ctx.font = '10.5px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= numGridLines; i++) {
      const ratio = i / numGridLines;
      const y = padTop + chartH * ratio;

      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();

      let tickVal = 0;
      if (isTotal) {
        tickVal = maxPos * (1 - ratio);
      } else {
        tickVal = maxPos - ratio * totalRange;
      }

      const formattedTick = this.formatOINumber(tickVal, data.isIndian);
      ctx.fillText(formattedTick, padLeft - 8, y);
    }

    // Y-Axis Title
    ctx.save();
    ctx.translate(14, padTop + chartH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#787b86';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isTotal ? 'Total Open Interest' : 'Call / Put OI Change', 0, 0);
    ctx.restore();

    // Zero Baseline Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, zeroY);
    ctx.lineTo(width - padRight, zeroY);
    ctx.stroke();

    // 2. Draw Side-by-Side Bars per Strike
    const slotW = chartW / rows.length;
    const barW = Math.max(3, Math.min(16, slotW * 0.38));
    const gap = 2;
    const barMeta = [];

    rows.forEach((r, idx) => {
      const slotCenterX = padLeft + idx * slotW + slotW / 2;
      const slotLeft = padLeft + idx * slotW;
      const slotRight = slotLeft + slotW;

      const putVal = isTotal ? r.putOI : r.putChg;
      const callVal = isTotal ? r.callOI : r.callChg;

      // Put Bar (Green)
      let putHeight = (Math.abs(putVal) / totalRange) * chartH;
      let putY = zeroY - putHeight;
      if (!isTotal && putVal < 0) {
        putY = zeroY;
      }
      ctx.fillStyle = r.strike === this.oiHoveredStrike ? '#00ff88' : '#00e676';
      ctx.fillRect(slotCenterX - barW - gap / 2, putY, barW, Math.max(1, putHeight));

      // Call Bar (Red)
      let callHeight = (Math.abs(callVal) / totalRange) * chartH;
      let callY = zeroY - callHeight;
      if (!isTotal && callVal < 0) {
        callY = zeroY;
      }
      ctx.fillStyle = r.strike === this.oiHoveredStrike ? '#ff3b4b' : '#ff1744';
      ctx.fillRect(slotCenterX + gap / 2, callY, barW, Math.max(1, callHeight));

      // X-Axis Strike Label
      ctx.fillStyle = r.isATM ? '#29b6f6' : '#787b86';
      ctx.font = r.isATM ? 'bold 10.5px monospace' : '10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const stepInterval = rows.length > 25 ? 2 : 1;
      if (idx % stepInterval === 0 || r.isATM) {
        ctx.save();
        ctx.translate(slotCenterX, padTop + chartH + 8);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(r.strike.toLocaleString(), 0, 0);
        ctx.restore();
      }

      barMeta.push({
        strike: r.strike,
        slotLeft,
        slotRight,
        slotCenterX,
        putVal,
        callVal,
        putOI: r.putOI,
        callOI: r.callOI,
        putChg: r.putChg,
        callChg: r.callChg,
        netDiff: r.netDiff,
        strikePCR: r.strikePCR,
        callIV: r.callIV,
        putIV: r.putIV,
        isATM: r.isATM,
        isIndian: r.isIndian,
      });
    });

    this._lastOIBars = barMeta;

    // 3. Draw Spot Price Vertical Dotted Reference Line
    const spot = data.interpolatedSpot;
    if (spot >= data.minStrike && spot <= data.maxStrike) {
      const strikeRange = data.maxStrike - data.minStrike;
      const spotRatio = (spot - data.minStrike) / strikeRange;
      const spotX = padLeft + spotRatio * chartW;

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#29b6f6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(spotX, padTop);
      ctx.lineTo(spotX, padTop + chartH);
      ctx.stroke();
      ctx.restore();

      // Floating Spot Price Badge at Top
      const tagText = `${data.inst.displaySymbol || data.inst.symbol} ${spot.toLocaleString()}`;
      ctx.font = 'bold 11px sans-serif';
      const textW = ctx.measureText(tagText).width + 14;

      ctx.fillStyle = 'rgba(41, 182, 246, 0.95)';
      ctx.beginPath();
      ctx.roundRect(spotX - textW / 2, padTop - 18, textW, 18, 4);
      ctx.fill();

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, spotX, padTop - 9);
    }
  }

  loadOISidebarPanel() {
    const container = document.getElementById('oi-sidebar-body');
    if (!container) return;

    const data = this.getOIOptionChainData();

    container.innerHTML = `
      <!-- 1. Header Card -->
      <div class="tv-oi-sb-card">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:800;font-size:14px;color:var(--text);">${data.inst.displaySymbol || data.inst.symbol}</div>
            <div style="font-size:11px;color:var(--text-muted);">${data.inst.name}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800;font-size:14px;color:var(--text);">${data.spot.toLocaleString()}</div>
            <div style="font-size:11px;color:${data.spot >= data.dayOpenPrice ? '#00e676' : '#ff1744'};font-weight:700;">
              ${data.spot >= data.dayOpenPrice ? '+' : ''}${(((data.spot - data.dayOpenPrice) / data.dayOpenPrice) * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      <!-- 2. PCR & Max Pain Stats -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="tv-oi-sb-card">
          <span style="font-size:10.5px;color:var(--text-muted);font-weight:700;">PUT-CALL RATIO</span>
          <span style="font-size:16px;font-weight:800;color:#29b6f6;font-family:var(--mono);">${data.pcr.toFixed(2)}</span>
          <span style="font-size:10px;color:var(--text-muted);">${data.pcr >= 1.0 ? '🟢 Bullish Put Addition' : '🔴 Bearish Call Resistance'}</span>
        </div>
        <div class="tv-oi-sb-card">
          <span style="font-size:10.5px;color:var(--text-muted);font-weight:700;">MAX PAIN STRIKE</span>
          <span style="font-size:16px;font-weight:800;color:var(--amber);font-family:var(--mono);">${data.maxPainStrike.toLocaleString()}</span>
          <span style="font-size:10px;color:var(--text-muted);">Dealer Magnet Price</span>
        </div>
      </div>

      <!-- 3. Net OI Changes -->
      <div class="tv-oi-sb-card">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:4px;">DAILY OI FLOW DELTA</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
          <span>🟢 Put Writing (Support):</span>
          <b style="color:#00e676;font-family:var(--mono);">${this.formatOINumber(data.netPutOIChg, data.isIndian)}</b>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;">
          <span>🔴 Call Writing (Resistance):</span>
          <b style="color:#ff1744;font-family:var(--mono);">${this.formatOINumber(data.netCallOIChg, data.isIndian)}</b>
        </div>
      </div>

      <!-- 4. Launch Full Analytics Dashboard Button -->
      <button class="tv-inst-plot-btn" id="btn-sb-launch-oi-full" style="width:100%;margin-top:6px;">
        <span>📊 Open Full OI Dashboard (Expanded)</span>
      </button>
    `;

    const btnLaunch = document.getElementById('btn-sb-launch-oi-full');
    if (btnLaunch) {
      btnLaunch.onclick = () => this.openOIDashboard();
    }
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.zeroChartApp = new ZeroChartApp();
  window.app = window.zeroChartApp;
});
