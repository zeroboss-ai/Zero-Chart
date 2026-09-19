/**
 * Real-Time Commodities Feed Adapter
 * Provides authoritative live exchange data for Gold, Silver, Crude Oil, Natural Gas, and Forex.
 */

import { BinanceFeed } from './binance-feed.js';
import { sanitizeBars } from './openalgo-feed.js';

export class CommodityFeed {
  constructor() {
    this._binance = new BinanceFeed();
    this._cache = new Map();
    this._subscribers = new Map();
  }

  async getBars(reqOrSymbol, intervalArg, fromArg, toArg, limitArg = 500) {
    let symbol = 'XAGUSD';
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
      symbol = reqOrSymbol.symbol || 'XAGUSD';
      interval = reqOrSymbol.interval || '5m';
      from = reqOrSymbol.from;
      to = reqOrSymbol.to;
      limit = reqOrSymbol.countBack || reqOrSymbol.limit || 500;
    }

    const sym = (symbol || '').toUpperCase().trim();
    const cacheKey = `${sym}_${interval}`;

    const cached = this._cache.get(cacheKey);
    if (cached && Date.now() - cached.time < 3000 && Array.isArray(cached.data) && cached.data.length > 0) {
      return cached.data;
    }

    // 1. Live Gold (XAU/USD tracks PAXGUSDT 1:1 in USD) via Binance 24/7 API
    if (sym === 'PAXGUSDT' || sym === 'PAXG' || sym === 'XAUUSD' || sym.includes('GOLD')) {
      try {
        const bars = await this._binance.getBars({ symbol: 'PAXGUSDT', interval, from, to, limit });
        if (bars && bars.length > 0) {
          const clean = sanitizeBars(bars);
          this._cache.set(cacheKey, { time: Date.now(), data: clean });
          return clean;
        }
      } catch (_) {}
    }

    // 2. Fetch real live candles from authoritative backend history endpoint
    try {
      const resp = await fetch(
        `/api/market/history?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(interval)}`
      );
      if (resp.ok) {
        const json = await resp.json();
        if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
          const clean = sanitizeBars(json.data);
          this._cache.set(cacheKey, { time: Date.now(), data: clean });
          return clean;
        }
      }
    } catch (err) {
      console.warn(`[CommodityFeed] Failed to fetch real history for ${sym}:`, err.message);
    }

    return [];
  }

  subscribeBars(reqOrSymbol, onBarOrInterval, optsOrOnTick) {
    let symbol = 'XAGUSD';
    let interval = '5m';
    let onTick = () => {};

    if (typeof reqOrSymbol === 'string') {
      symbol = reqOrSymbol;
      interval = typeof onBarOrInterval === 'string' ? onBarOrInterval : '5m';
      onTick = typeof optsOrOnTick === 'function' ? optsOrOnTick : (typeof onBarOrInterval === 'function' ? onBarOrInterval : () => {});
    } else if (reqOrSymbol && typeof reqOrSymbol === 'object') {
      symbol = reqOrSymbol.symbol || 'XAGUSD';
      interval = reqOrSymbol.interval || '5m';
      onTick = typeof onBarOrInterval === 'function' ? onBarOrInterval : () => {};
    }

    const sym = (symbol || '').toUpperCase().trim();

    // If Gold, subscribe to Binance live Paxos Gold stream
    if (sym === 'PAXGUSDT' || sym === 'PAXG' || sym === 'XAUUSD' || sym.includes('GOLD')) {
      return this._binance.subscribeBars('PAXGUSDT', interval, onTick);
    }

    if (!this._subscribers.has(sym)) {
      this._subscribers.set(sym, new Set());
    }
    this._subscribers.get(sym).add(onTick);

    // Initial quote fetch to fire first tick immediately
    fetch(`/api/market/quotes?symbols=${encodeURIComponent(sym)}`)
      .then((r) => r.json())
      .then((json) => {
        const q = json.quotes?.[sym];
        if (q && q.ltp) {
          const nowSec = Math.floor(Date.now() / 1000);
          onTick({
            time: q.time || nowSec,
            open: q.open || q.ltp,
            high: q.high || q.ltp,
            low: q.low || q.ltp,
            close: q.ltp,
            volume: 10,
          });
        }
      })
      .catch(() => {});

    return () => {
      const set = this._subscribers.get(sym);
      if (set) {
        set.delete(onTick);
        if (set.size === 0) this._subscribers.delete(sym);
      }
    };
  }
}
