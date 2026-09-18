# Zero Chart — Standalone Multi-Asset TradingView Pro Terminal

**Zero Chart** is a dedicated, standalone, high-performance financial charting and trading terminal engineered for **Indian Equities & Indices (NSE / BSE / MCX)**, **Crypto (24/7 Live Binance)**, **Spot Commodities (Gold, Silver, Crude Oil)**, and **Global Forex**.

---

## 📁 Project Structure

```
D:\Open Algo\zero-chart\
├── index.html                   # Zero Chart Pro Terminal UI
├── server.mjs                   # Fast HTTP Server & OpenAlgo Reverse Proxy
├── start-zerochart.bat          # 🚀 Windows 1-Click Launch Script
├── start-zerochart.ps1          # 🚀 PowerShell 1-Click Launch Script
├── package.json                 # Standalone NPM package
├── css/
│   └── zero-chart.css           # Pro Dark/Light TradingView Themes & Modals
├── js/
│   ├── zero-chart-app.js        # Terminal App Controller & Trade Engine
│   ├── watchlist-data.js        # Asset Catalog & Indian Market Prices (Nifty 23300, BankNifty 56180)
│   └── feeds/
│       ├── binance-feed.js      # 24/7 Live Binance WebSockets & REST API
│       ├── commodity-feed.js    # Spot Gold (XAU), Silver, Crude Oil, Natural Gas
│       ├── openalgo-feed.js     # Live OpenAlgo Broker Gateway + WebSocket Proxy
│       └── multi-feed.js        # Dynamic Multi-Asset Feed Router
└── lib/                         # Self-contained Chart Engine Bundles
```

---

## 🚀 How to Run

### Method 1: Double-Click (Windows)
Double-click:
```
D:\Open Algo\zero-chart\start-zerochart.bat
```

### Method 2: Command Line
```powershell
cd "D:\Open Algo\zero-chart"
npm start
```

Your browser will automatically open:
```
http://localhost:3000/index.html
```

---

## 🔑 Connecting Live Indian Market Broker Feed (OpenAlgo)

1. Click the **"API Key / Broker"** button in the topbar (or the **CALIBRATED FEED** badge).
2. Paste your **OpenAlgo API Key**.
3. Set your Gateway URL (`http://127.0.0.1:5000`) and WebSocket Proxy URL (`ws://127.0.0.1:8765`).
4. Click **"Test Connection"** to verify, then click **"Save & Connect"**.
5. Zero Chart will switch to **LIVE BROKER** mode and stream real-time tick quotes and historical candles directly from your connected broker (Zerodha, AngelOne, Fyers, Upstox, Dhan, Shoonya, AliceBlue, etc.).

---

## 📊 Available Markets & Feeds

| Asset Class | Live Streaming Protocol | Sample Symbols |
| :--- | :--- | :--- |
| **🇮🇳 Indian Equities & Indices** | OpenAlgo Broker WS + REST | `NIFTY 50`, `BANKNIFTY`, `FINNIFTY`, `RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `TATAMOTORS`, `SBIN` |
| **🪙 Crypto** | Binance Public WebSocket (24/7 Live) | `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `BNBUSDT`, `XRPUSDT`, `DOGEUSDT`, `ADAUSDT`, `LINKUSDT`, `AVAXUSDT`, `SUIUSDT` |
| **🛢️ Commodities** | Spot / Binance Paxos Gold (24/7) + MCX | `XAU/USD (Spot Gold)`, `XAG/USD (Silver)`, `WTI Crude Oil`, `Brent Crude`, `Natural Gas`, `MCX GOLD`, `MCX CRUDE` |
| **🌐 Global & Forex** | Calibrated Multi-Asset Ticker | `AAPL`, `NVDA`, `TSLA`, `EUR/USD`, `USD/INR` |
