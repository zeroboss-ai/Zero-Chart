/**
 * Real-Time Binance WebSocket & REST API Feed Adapter
 * 100% Free, Public, Zero API Key required.
 * Provides real tick-by-tick streaming and historical OHLCV data.
 */

const BINANCE_REST_ENDPOINTS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
];

const BINANCE_WS_ENDPOINT = 'wss://stream.binance.com:9443/ws';

export function mapIntervalToBinance(interval) {
  const norm = (interval || '5m').toLowerCase().trim();
  if (norm === '1d' || norm === 'd') return '1d';
  if (norm === '1w' || norm === 'w') return '1w';
  if (norm === '1m' || (norm === 'm' && interval === 'M')) return '1M';
  if (['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'].includes(norm)) {
    return norm;
  }
  return '5m';
}

export class BinanceFeed {
  constructor() {
    this._activeWs = null;
    this._reconnectTimer = null;
  }

  /**
   * Fetch historical candlestick bars from Binance REST API
   */
  async getBars(reqOrSymbol, intervalArg, fromArg, toArg, limitArg = 500) {
    let symbol = 'BTCUSDT';
    let interval = '5m';
    let from = undefined;
    let to = undefined;
    let limit = 500;

    if (typeof reqOrSymbol === 'string') {
      symbol = reqOrSymbol;
      interval = intervalArg || '5m';
      from = fromArg;
      to = toArg;
      limit = limitArg || 500;
    } else if (reqOrSymbol && typeof reqOrSymbol === 'object') {
      symbol = reqOrSymbol.symbol || 'BTCUSDT';
      interval = reqOrSymbol.interval || '5m';
      from = reqOrSymbol.from;
      to = reqOrSymbol.to;
      limit = reqOrSymbol.countBack || reqOrSymbol.limit || 500;
    }

    const sym = (symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const binanceInterval = mapIntervalToBinance(interval);

    let query = `symbol=${sym}&interval=${binanceInterval}&limit=${Math.min(1000, limit || 500)}`;
    const nowSec = Math.floor(Date.now() / 1000);
    if (from && to && to < nowSec - 600) {
      query += `&startTime=${from * 1000}&endTime=${to * 1000}`;
    }

    let lastError = null;
    for (const host of BINANCE_REST_ENDPOINTS) {
      try {
        const url = `${host}/api/v3/klines?${query}`;
        const resp = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        const data = await resp.json();
        if (Array.isArray(data)) {
          const map = new Map();
          for (const k of data) {
            const t = Math.floor(k[0] / 1000);
            const o = parseFloat(k[1]);
            const h = parseFloat(k[2]);
            const l = parseFloat(k[3]);
            const c = parseFloat(k[4]);
            const v = parseFloat(k[5]) || 0;
            if (t > 0 && Number.isFinite(c)) {
              map.set(t, {
                time: t,
                open: o,
                high: Math.max(h, o, c),
                low: Math.min(l, o, c),
                close: c,
                volume: v,
              });
            }
          }
          return Array.from(map.values()).sort((a, b) => a.time - b.time);
        }
      } catch (err) {
        lastError = err;
        console.warn(`[BinanceFeed] Endpoint ${host} failed:`, err.message);
      }
    }

    console.error('[BinanceFeed] All REST endpoints failed:', lastError);
    return [];
  }

  /**
   * Subscribe to real-time sub-second live candlestick updates via Binance WebSocket
   */
  subscribeBars(reqOrSymbol, onBarOrInterval, optsOrOnTick) {
    let symbol = 'BTCUSDT';
    let interval = '5m';
    let onTick = () => {};

    if (typeof reqOrSymbol === 'string') {
      symbol = reqOrSymbol;
      interval = typeof onBarOrInterval === 'string' ? onBarOrInterval : '5m';
      onTick = typeof optsOrOnTick === 'function' ? optsOrOnTick : (typeof onBarOrInterval === 'function' ? onBarOrInterval : () => {});
    } else if (reqOrSymbol && typeof reqOrSymbol === 'object') {
      symbol = reqOrSymbol.symbol || 'BTCUSDT';
      interval = reqOrSymbol.interval || '5m';
      onTick = typeof onBarOrInterval === 'function' ? onBarOrInterval : () => {};
    }

    const sym = (symbol || 'BTCUSDT').toLowerCase().replace(/[^a-z0-9]/g, '');
    const binanceInterval = mapIntervalToBinance(interval);
    const streamName = `${sym}@kline_${binanceInterval}`;
    const wsUrl = `${BINANCE_WS_ENDPOINT}/${streamName}`;

    let isSubscribed = true;
    let ws = null;

    const connect = () => {
      if (!isSubscribed) return;

      try {
        ws = new WebSocket(wsUrl);
        this._activeWs = ws;

        ws.onopen = () => {
          console.log(`[Binance WS] Connected to ${streamName}`);
        };

        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.e === 'kline' && msg.k) {
              const k = msg.k;
              const bar = {
                time: Math.floor(k.t / 1000),
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
              };
              onTick(bar, { provisional: !k.x });
            }
          } catch (e) {
            console.error('[Binance WS] Parse error:', e);
          }
        };

        ws.onerror = (err) => {
          console.warn(`[Binance WS] Error on ${streamName}:`, err);
        };

        ws.onclose = () => {
          if (isSubscribed) {
            this._reconnectTimer = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error('[Binance WS] Connection failed:', err);
      }
    };

    connect();

    return () => {
      isSubscribed = false;
      if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch (_) {}
      }
    };
  }

  /**
   * Fetch 24-hour ticker statistics for symbols
   */
  async fetch24hrTickers(symbols = []) {
    let query = '';
    if (symbols && symbols.length > 0) {
      const symArray = symbols.map((s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''));
      query = `?symbols=${encodeURIComponent(JSON.stringify(symArray))}`;
    }
    for (const host of BINANCE_REST_ENDPOINTS) {
      try {
        const resp = await fetch(`${host}/api/v3/ticker/24hr${query}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!resp.ok) continue;
        const data = await resp.json();
        const list = Array.isArray(data) ? data : [data];
        const result = {};
        for (const item of list) {
          if (!item || !item.symbol) continue;
          const last = parseFloat(item.lastPrice);
          const open = parseFloat(item.openPrice);
          const chg = parseFloat(item.priceChange);
          const chgPct = parseFloat(item.priceChangePercent);
          result[item.symbol] = {
            symbol: item.symbol,
            last,
            open,
            high: parseFloat(item.highPrice),
            low: parseFloat(item.lowPrice),
            chg,
            chgPct,
            volume: parseFloat(item.volume),
          };
        }
        return result;
      } catch (_) {
        // try next endpoint
      }
    }
    return {};
  }

  /**
   * Subscribe to real-time 24hr miniTickers for multiple symbols in a single lightweight stream
   */
  subscribe24hrMiniTickers(symbols, onTicker) {
    const symList = (symbols || []).map((s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')).filter(Boolean);
    if (symList.length === 0) return () => {};

    const streamNames = symList.map((s) => `${s}@miniTicker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamNames}`;

    let isSubscribed = true;
    let ws = null;
    let reconnectTimer = null;

    const connect = () => {
      if (!isSubscribed) return;
      try {
        ws = new WebSocket(wsUrl);
        ws.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const msg = JSON.parse(event.data);
            const d = msg.data || msg;
            if (d && d.s) {
              const last = parseFloat(d.c);
              const open = parseFloat(d.o);
              const high = parseFloat(d.h);
              const low = parseFloat(d.l);
              const chg = last - open;
              const chgPct = open !== 0 ? ((last - open) / open) * 100 : 0;
              if (typeof onTicker === 'function') {
                onTicker({
                  symbol: d.s,
                  last,
                  open,
                  high,
                  low,
                  chg,
                  chgPct,
                });
              }
            }
          } catch (_) {}
        };
        ws.onerror = () => {};
        ws.onclose = () => {
          if (isSubscribed) {
            reconnectTimer = setTimeout(connect, 3000);
          }
        };
      } catch (_) {}
    };

    connect();

    return () => {
      isSubscribed = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch (_) {}
      }
    };
  }
}
