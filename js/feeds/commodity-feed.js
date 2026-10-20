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
    this._lastBars = new Map();
  }

  async getBars(reqOrSymbol, intervalArg, fromArg, toArg, limitArg = 500) {
    let symbol = 'XAUUSD';
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
      symbol = reqOrSymbol.symbol || 'XAUUSD';
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

    // Only route explicit crypto token PAXGUSDT to Binance
    if (sym === 'PAXGUSDT' || sym === 'PAXG') {
      try {
        const bars = await this._binance.getBars({ symbol: 'PAXGUSDT', interval, from, to, limit });
        if (bars && bars.length > 0) {
          const clean = sanitizeBars(bars);
          this._cache.set(cacheKey, { time: Date.now(), data: clean });
          if (clean.length > 0) this._lastBars.set(cacheKey, { ...clean[clean.length - 1] });
          return clean;
        }
      } catch (_) {}
    }

    // Fetch real live TradingView / exchange candles from backend
    try {
      const resp = await fetch(
        `/api/market/history?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(interval)}`
      );
      if (resp.ok) {
        const json = await resp.json();
        if (json.status === 'success' && Array.isArray(json.data) && json.data.length > 0) {
          const clean = sanitizeBars(json.data);
          this._cache.set(cacheKey, { time: Date.now(), data: clean });
          if (clean.length > 0) this._lastBars.set(cacheKey, { ...clean[clean.length - 1] });
          return clean;
        }
      }
    } catch (err) {
      console.warn(`[CommodityFeed] Failed to fetch real history for ${sym}:`, err.message);
    }

    return [];
  }

  subscribeBars(reqOrSymbol, onBarOrInterval, optsOrOnTick) {
    let symbol = 'XAUUSD';
    let interval = '5m';
    let onTick = () => {};

    if (typeof reqOrSymbol === 'string') {
      symbol = reqOrSymbol;
      interval = typeof onBarOrInterval === 'string' ? onBarOrInterval : '5m';
      onTick = typeof optsOrOnTick === 'function' ? optsOrOnTick : (typeof onBarOrInterval === 'function' ? onBarOrInterval : () => {});
    } else if (reqOrSymbol && typeof reqOrSymbol === 'object') {
      symbol = reqOrSymbol.symbol || 'XAUUSD';
      interval = reqOrSymbol.interval || '5m';
      onTick = typeof onBarOrInterval === 'function' ? onBarOrInterval : () => {};
    }

    const sym = (symbol || '').toUpperCase().trim();
    const subKey = `${sym}_${interval}`;

    // Only route explicit crypto token PAXGUSDT to Binance live stream
    if (sym === 'PAXGUSDT' || sym === 'PAXG') {
      return this._binance.subscribeBars('PAXGUSDT', interval, onTick);
    }

    if (!this._subscribers.has(sym)) {
      this._subscribers.set(sym, new Set());
    }
    this._subscribers.get(sym).add(onTick);

    // High-frequency live quote poller without generating fake nowSec ticks
    let isFetching = false;
    const intervalSecs = 300;
    const poller = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const resp = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(sym)}`);
        if (resp.ok) {
          const json = await resp.json();
          const q = json.quotes?.[sym];
          if (q && q.ltp) {
            const nowSec = Math.floor(Date.now() / 1000);
            const quoteTime = (typeof q.time === 'number' && q.time > 0) ? q.time : nowSec;
            const isStale = (nowSec - quoteTime) > 600;

            let bar = this._lastBars.get(subKey);
            if (bar) {
              const bucketTime = Math.floor(quoteTime / intervalSecs) * intervalSecs;
              if (bucketTime <= bar.time || isStale) {
                bar.high = Math.max(bar.high, q.ltp);
                bar.low = Math.min(bar.low, q.ltp);
                bar.close = q.ltp;
                onTick({ ...bar });
              } else if (bucketTime > bar.time && !isStale) {
                const openPrice = bar.close;
                bar = {
                  time: bucketTime,
                  open: openPrice,
                  high: Math.max(openPrice, q.ltp),
                  low: Math.min(openPrice, q.ltp),
                  close: q.ltp,
                  volume: 1,
                };
                this._lastBars.set(subKey, bar);
                onTick({ ...bar });
              }
            }
          }
        }
      } catch (_) {}
      finally {
        isFetching = false;
      }
    };

    const timer = setInterval(poller, 1000);

    return () => {
      clearInterval(timer);
      const set = this._subscribers.get(sym);
      if (set) {
        set.delete(onTick);
        if (set.size === 0) this._subscribers.delete(sym);
      }
    };
  }
}
