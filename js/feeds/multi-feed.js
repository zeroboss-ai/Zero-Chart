/**
 * Unified Multi-Asset Data Feed Router for Zero Chart
 * Seamlessly switches between Binance Live WebSocket, Commodities, and OpenAlgo feeds.
 */

import { BinanceFeed } from './binance-feed.js';
import { CommodityFeed } from './commodity-feed.js';
import { OpenAlgoLiveFeed } from './openalgo-feed.js';
import { findInstrument } from '../watchlist-data.js';

export class MultiAssetFeed {
  constructor() {
    this.binanceFeed = new BinanceFeed();
    this.commodityFeed = new CommodityFeed();
    this.openalgoFeed = new OpenAlgoLiveFeed();
  }

  _getFeedForSymbol(reqOrSymbol) {
    let symStr = 'BTCUSDT';
    if (typeof reqOrSymbol === 'string') {
      symStr = reqOrSymbol;
    } else if (reqOrSymbol && typeof reqOrSymbol === 'object') {
      symStr = reqOrSymbol.symbol || 'BTCUSDT';
    }

    const inst = findInstrument(symStr);
    const sym = (symStr || '').toUpperCase();

    if (inst) {
      if (inst.feedType === 'binance') return this.binanceFeed;
      if (inst.feedType === 'commodity') return this.commodityFeed;
      if (inst.feedType === 'openalgo') return this.openalgoFeed;
      return this.openalgoFeed;
    }

    // Auto-detect by symbol name
    if (sym.endsWith('USDT') || sym.endsWith('BUSD') || sym.endsWith('BTC') || sym.endsWith('ETH')) {
      return this.binanceFeed;
    }
    if (
      sym.includes('GOLD') ||
      sym.includes('SILVER') ||
      sym.includes('CRUDE') ||
      sym.includes('OIL') ||
      sym.includes('XAU') ||
      sym.includes('XAG')
    ) {
      return this.commodityFeed;
    }

    return this.openalgoFeed;
  }

  async getBars(reqOrSymbol, intervalArg, fromArg, toArg, limitArg) {
    const feed = this._getFeedForSymbol(reqOrSymbol);
    return feed.getBars(reqOrSymbol, intervalArg, fromArg, toArg, limitArg);
  }

  subscribeBars(reqOrSymbol, onBarOrInterval, optsOrOnTick) {
    const feed = this._getFeedForSymbol(reqOrSymbol);
    return feed.subscribeBars(reqOrSymbol, onBarOrInterval, optsOrOnTick);
  }
}
