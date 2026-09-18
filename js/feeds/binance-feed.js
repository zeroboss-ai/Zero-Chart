/**
 * Real-Time Binance WebSocket & REST API Feed Adapter
 * 100% Free, Public, Zero API Key required.
 * Provides real tick-by-tick streaming and historical OHLCV data.
 */

const BINANCE_REST_ENDPOINTS = [
  'https://api.binance.com',
  'https://data-api.binance.vision',
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
          return data.map((k) => ({
            time: Math.floor(k[0] / 1000),
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          }));
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
}
