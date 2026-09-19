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
import '../lib/openalgo-charts.indicators.mjs';
import { FakeBroker, OrderEngine, TradeController } from '../lib/openalgo-charts.trade.mjs';
import { MultiAssetFeed } from './feeds/multi-feed.js';
import { MASTER_INSTRUMENTS, DEFAULT_WATCHLISTS, findInstrument } from './watchlist-data.js';

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

    // 7. Initialize Mobile Navigation & Drawer Handlers
    this.initMobileUI();

    // 8. Start Real-Time Market Streams
    this.startLiveMarketStream();
    this.checkBrokerStatus();

    // 9. Initialize Progressive Web App (PWA)
    this.initPWA();
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

    pane.widget = createWidget(container, {
      feed: this.multiFeed,
      symbol: pane.instrument.symbol,
      exchange: pane.instrument.exchange,
      interval: pane.interval,
      chartType: pane.chartType,
      theme: this.currentTheme,
      topbar: false, // Unified topbar managed by Zero Chart
      statusline: true,
      rail: paneIndex === 0, // Drawing rail on primary pane
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
    });

    try {
      if (pane.widget.chart?.setAxisChromeOptions) {
        pane.widget.chart.setAxisChromeOptions({
          barCountdown: true,
          sessionClock: true,
        });
      }
    } catch (_) {}

    // Wire on-chart trading controller
    pane.tradeController = new TradeController(pane.widget.chart.tradeHost(0));
    this.broker.onBook((orders, positions) => pane.tradeController.reconcile(orders, positions));
    this.broker.onLtp((sym, ltp) => pane.tradeController.onLtp(sym, ltp));

    // Listen to crosshair move for Data Window
    pane.widget.chart.on('crosshair:move', (data) => {
      if (this.activePaneIndex === paneIndex && data && data.bar) {
        this.updateDataWindow(data.bar, data.time);
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

    if (paneIndex === 0) {
      window.__zeroChartWidget = pane.widget;
    }

    // Auto-restore saved drawings for this symbol
    setTimeout(() => {
      this.restoreSymbolState(paneIndex, pane.instrument.symbol);
    }, 150);

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
    const prevSym = this.currentInstrument?.symbol;
    if (prevSym) {
      this.saveSymbolState(this.activePaneIndex, prevSym);
    }

    this.currentInstrument = inst;
    const activeWidget = this.widget;
    if (activeWidget) {
      activeWidget.setSymbol(inst.symbol, inst.exchange);
      try {
        if (activeWidget.chart?.setAxisChromeOptions) {
          activeWidget.chart.setAxisChromeOptions({ barCountdown: true, sessionClock: true });
        }
      } catch (_) {}
      setTimeout(() => {
        this.restoreSymbolState(this.activePaneIndex, inst.symbol);
      }, 150);
    }

    this.updateHeaderDisplay();
    this.renderWatchlist();
    this.closeModal('search-modal');
    if (window.innerWidth <= 768) {
      this.closeMobileDrawer();
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
        const activeSymbols = this.getActiveWatchlist().symbols;
        // Include active pane symbols
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
    setInterval(pollQuotes, 1200);
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

    // Dispatch live tick directly to chart widget feed for in-place candle updates
    if (this.multiFeed?.openalgoFeed?._dispatchRealtimeTick) {
      this.multiFeed.openalgoFeed._dispatchRealtimeTick(inst.symbol, newPrice);
    }

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

  openAlertModal(existingAlert = null) {
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
      const activeSym = this.currentInstrument?.symbol || 'NIFTY 50';
      symSelect.value = activeSym;
      if (condSelect) condSelect.value = 'CROSSING_UP';
      const q = this.livePrices.get(activeSym);
      const inst = findInstrument(activeSym);
      const currentPrice = q?.last || inst?.basePrice || 100;
      if (priceInput) priceInput.value = currentPrice;
      if (freqSelect) freqSelect.value = 'ONCE';
      if (expSelect) expSelect.value = 'NEVER';
      if (nameInput) nameInput.value = `${activeSym} Alert`;
      if (msgInput) msgInput.value = `${activeSym} price reached target`;
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

    // Limit visible toasts to maximum 3 to prevent clutter
    while (container.children.length >= 3) {
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
    }, 8000);
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
          this.alerts = this.alerts.filter((a) => a.id !== alert.id);
          this.saveAlerts();
          this.updateAlertBadgeCount();
          this.renderAlertsList();
        };
      }

      list.appendChild(card);
    });
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
        this.closeMobileDrawer();
        updateMobNav('mob-nav-chart');
      };
    }

    if (mobNavWatchlist) {
      mobNavWatchlist.onclick = () => {
        this.openMobileDrawer('watchlist');
        updateMobNav('mob-nav-watchlist');
      };
    }

    if (topbarWlBtn) {
      topbarWlBtn.onclick = () => {
        if (window.innerWidth <= 768) {
          this.openMobileDrawer('watchlist');
          updateMobNav('mob-nav-watchlist');
        } else {
          this.openSidebarTab('watchlist');
        }
      };
    }

    if (mobNavAlerts) {
      mobNavAlerts.onclick = () => {
        this.openMobileDrawer('alerts');
        updateMobNav('mob-nav-alerts');
      };
    }

    if (mobNavDraw) {
      mobNavDraw.onclick = () => {
        if (rail) {
          const isVisible = rail.classList.toggle('mobile-visible');
          mobNavDraw.classList.toggle('active', isVisible);
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
        this.closeMobileDrawer();
      };
    });

    // Backdrop click on sidebar closes drawer
    if (sidebar) {
      sidebar.onclick = (e) => {
        if (e.target === sidebar) {
          this.closeMobileDrawer();
        }
      };
    }
  }

  openMobileDrawer(tabName) {
    const sidebar = document.querySelector('.tv-right-sidebar');
    const rightPanel = document.getElementById('right-panel');
    const tabPanes = document.querySelectorAll('.tv-right-content .tv-tab-pane');

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
    } else if (tabName === 'alerts') {
      this.renderAlertsList();
    }
  }

  closeMobileDrawer() {
    const sidebar = document.querySelector('.tv-right-sidebar');
    if (sidebar) {
      sidebar.classList.remove('mobile-open');
    }
    document.querySelectorAll('.tv-mob-nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.id === 'mob-nav-chart');
    });
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
  showToast(message, duration = 4000) {
    const container = document.getElementById('alert-toast-container');
    if (!container) return;

    while (container.children.length >= 3) {
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
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  new ZeroChartApp();
});
