#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;

const OPENALGO_HOST = process.env.OPENALGO_HOST || 'http://127.0.0.1:5000';
const DEFAULT_PORT = parseInt(process.env.PORT || '3000', 10);

// ─── 1. LOAD BROKER & ENVIRONMENT CONFIG ───
function loadEnv() {
  const candidates = [
    path.join(ROOT, '.env.txt'),
    path.join(ROOT, '.env'),
    path.join(ROOT, '..', 'openalgo-main', '.env.txt'),
    path.join(ROOT, '..', 'openalgo-main', '.env'),
  ];
  const env = {};
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        for (const rawLine of raw.split(/\r?\n/)) {
          const line = rawLine.trim();
          if (!line || line.startsWith('#')) continue;
          const eqIdx = line.indexOf('=');
          if (eqIdx !== -1) {
            const k = line.substring(0, eqIdx).trim().replace(/\s+/g, '_').toUpperCase();
            const v = line.substring(eqIdx + 1).trim();
            env[k] = v;
          }
        }
      } catch (_) {}
    }
  }
  return { ...process.env, ...env };
}

const ENV_VARS = loadEnv();

// ─── 2. ANGELONE SMARTAPI INTEGRATION ───
function base32Decode(str) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let cleaned = (str || '').toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTOTP(secret) {
  if (!secret) return '';
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30);
  const timeBuf = Buffer.alloc(8);
  timeBuf.writeBigInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', key).update(timeBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

const angelSession = {
  jwtToken: null,
  feedToken: null,
  refreshToken: null,
  clientCode: ENV_VARS.SMARTAPI_CLIENT_CODE || ENV_VARS.ANGELONE_CLIENT_ID || ENV_VARS.CLIENT_ID || 'AABZ002908',
  apiKey: ENV_VARS.SMARTAPI_API_KEY || ENV_VARS.API_KEY || ENV_VARS.CONSUMER_KEY || '',
  mpin: ENV_VARS.SMARTAPI_PIN || ENV_VARS.MPIN || ENV_VARS.PIN || '',
  totpSecret: ENV_VARS.SMARTAPI_TOTP_KEY || ENV_VARS.TOTP_SECRET || ENV_VARS.TOTP_KEY || '',
  lastAuthTime: 0,
  isAuthenticated: false,
};

async function authenticateAngelOne() {
  if (!angelSession.apiKey || !angelSession.totpSecret || !angelSession.mpin) {
    return false;
  }

  try {
    const totp = generateTOTP(angelSession.totpSecret);
    const resp = await fetch('https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '127.0.0.1',
        'X-MACAddress': 'fe80::1',
        'X-PrivateKey': angelSession.apiKey,
      },
      body: JSON.stringify({
        clientcode: angelSession.clientCode,
        password: angelSession.mpin,
        totp: totp,
      }),
    });

    const data = await resp.json();
    if (data.status && data.data?.jwtToken) {
      angelSession.jwtToken = data.data.jwtToken;
      angelSession.feedToken = data.data.feedToken;
      angelSession.refreshToken = data.data.refreshToken;
      angelSession.lastAuthTime = Date.now();
      angelSession.isAuthenticated = true;
      console.log(`[AngelOne] ✅ Authenticated SmartAPI session for Client ${angelSession.clientCode}`);
      return true;
    }
  } catch (err) {
    console.warn('[AngelOne] Auth error:', err.message);
  }
  return false;
}

if (angelSession.apiKey && angelSession.totpSecret) {
  authenticateAngelOne();
  setInterval(() => {
    if (Date.now() - angelSession.lastAuthTime > 3 * 3600 * 1000) {
      authenticateAngelOne();
    }
  }, 10 * 60 * 1000);
}

// ─── 3. ANGELONE INSTRUMENT MASTER & DYNAMIC INDEXING ───
let angelInstruments = [];
const nseEquitiesMap = new Map(); // 'MUTHOOTFIN' -> scrip
const nseTokensMap = new Map();    // token -> scrip
const futuresMap = new Map();       // 'NIFTY' -> [futures sorted by expiry]
const commoditiesMap = new Map();   // 'GOLD' -> [mcx scrips sorted by expiry]
const indicesMap = new Map([
  ['NIFTY 50', { token: '99926000', symbol: 'NIFTY', exch_seg: 'NSE', name: 'NIFTY 50' }],
  ['NIFTY50', { token: '99926000', symbol: 'NIFTY', exch_seg: 'NSE', name: 'NIFTY 50' }],
  ['NIFTY', { token: '99926000', symbol: 'NIFTY', exch_seg: 'NSE', name: 'NIFTY 50' }],
  ['BANKNIFTY', { token: '99926009', symbol: 'BANKNIFTY', exch_seg: 'NSE', name: 'NIFTY BANK' }],
  ['BANK NIFTY', { token: '99926009', symbol: 'BANKNIFTY', exch_seg: 'NSE', name: 'NIFTY BANK' }],
  ['FINNIFTY', { token: '99926037', symbol: 'FINNIFTY', exch_seg: 'NSE', name: 'NIFTY FINANCIAL SERVICES' }],
  ['SENSEX', { token: '99919000', symbol: 'SENSEX', exch_seg: 'BSE', name: 'BSE SENSEX' }],
  ['CNXIT', { token: '99926008', symbol: 'CNXIT', exch_seg: 'NSE', name: 'NIFTY IT' }],
  ['CNXAUTO', { token: '99926004', symbol: 'CNXAUTO', exch_seg: 'NSE', name: 'NIFTY AUTO' }],
  ['NIFTYMIDCAP', { token: '99926014', symbol: 'NSEMDCP50', exch_seg: 'NSE', name: 'NIFTY MIDCAP 50' }],
  // MCX Indices
  ['MCXBULLDEX', { token: '99920005', symbol: 'MCXBULLDEX', exch_seg: 'MCX', name: 'MCX BULLION INDEX' }],
  ['MCXMETLDEX', { token: '99920004', symbol: 'MCXMETLDEX', exch_seg: 'MCX', name: 'MCX METAL INDEX' }],
  ['MCXENRGDEX', { token: '99920015', symbol: 'MCXENERGY', exch_seg: 'MCX', name: 'MCX ENERGY INDEX' }],
  ['MCXENERGY', { token: '99920015', symbol: 'MCXENERGY', exch_seg: 'MCX', name: 'MCX ENERGY INDEX' }],
  ['MCXCRUDEX', { token: '99920000', symbol: 'MCXCRUDEX', exch_seg: 'MCX', name: 'MCX CRUDE INDEX' }],
  ['MCXSILVDEX', { token: '99920002', symbol: 'MCXSILVDEX', exch_seg: 'MCX', name: 'MCX SILVER INDEX' }],
  ['MCXGOLDEX', { token: '99920003', symbol: 'MCXGOLDEX', exch_seg: 'MCX', name: 'MCX GOLD INDEX' }],
  ['MCXCOPRDEX', { token: '99920001', symbol: 'MCXCOPRDEX', exch_seg: 'MCX', name: 'MCX COPPER INDEX' }],
  ['MCXCOMPDEX', { token: '99920006', symbol: 'MCXCOMPDEX', exch_seg: 'MCX', name: 'MCX COMPOSITE INDEX' }],
]);

const COMMODITY_METAS = {
  GOLD: { name: 'MCX Gold Futures (10g)', basePrice: 74500, badge: 'GLD', color: '#ffd700', tickSize: 1.0 },
  GOLDM: { name: 'MCX Gold Mini Futures (100g)', basePrice: 74500, badge: 'GM', color: '#ffd700', tickSize: 1.0 },
  GOLDPETAL: { name: 'MCX Gold Petal Futures (1g)', basePrice: 7450, badge: 'GP', color: '#ffd700', tickSize: 1.0 },
  SILVER: { name: 'MCX Silver Futures (30kg)', basePrice: 89500, badge: 'SLV', color: '#b0bec5', tickSize: 1.0 },
  SILVERM: { name: 'MCX Silver Mini Futures (5kg)', basePrice: 89500, badge: 'SM', color: '#b0bec5', tickSize: 1.0 },
  SILVERMIC: { name: 'MCX Silver Micro Futures (1kg)', basePrice: 89500, badge: 'SMC', color: '#b0bec5', tickSize: 1.0 },
  CRUDEOIL: { name: 'MCX WTI Crude Oil Futures', basePrice: 5980, badge: 'OIL', color: '#455a64', tickSize: 1.0 },
  CRUDEOILM: { name: 'MCX Crude Oil Mini Futures', basePrice: 5980, badge: 'CLM', color: '#455a64', tickSize: 1.0 },
  NATURALGAS: { name: 'MCX Natural Gas Futures', basePrice: 235.5, badge: 'GAS', color: '#ff7043', tickSize: 0.1 },
  NATGASMINI: { name: 'MCX Natural Gas Mini Futures', basePrice: 235.5, badge: 'NGM', color: '#ff7043', tickSize: 0.1 },
  COPPER: { name: 'MCX Copper Futures (2.5 MT)', basePrice: 815, badge: 'CPR', color: '#d84315', tickSize: 0.05 },
  ZINC: { name: 'MCX Zinc Futures (5 MT)', basePrice: 275, badge: 'ZNC', color: '#78909c', tickSize: 0.05 },
  ZINCMINI: { name: 'MCX Zinc Mini Futures', basePrice: 275, badge: 'ZNM', color: '#78909c', tickSize: 0.05 },
  ALUMINIUM: { name: 'MCX Aluminium Futures (5 MT)', basePrice: 230, badge: 'ALU', color: '#90a4ae', tickSize: 0.05 },
  ALUMINI: { name: 'MCX Aluminium Mini Futures', basePrice: 230, badge: 'ALM', color: '#90a4ae', tickSize: 0.05 },
  LEAD: { name: 'MCX Lead Futures (5 MT)', basePrice: 180, badge: 'LED', color: '#546e7a', tickSize: 0.05 },
  LEADMINI: { name: 'MCX Lead Mini Futures', basePrice: 180, badge: 'LDM', color: '#546e7a', tickSize: 0.05 },
  NICKEL: { name: 'MCX Nickel Futures', basePrice: 1420, badge: 'NCK', color: '#607d8b', tickSize: 0.1 },
  COTTON: { name: 'MCX Cotton Bales Futures', basePrice: 56200, badge: 'CTN', color: '#8bc34a', tickSize: 10.0 },
  MCXBULLDEX: { name: 'MCX Bullion Index (Gold & Silver)', basePrice: 18200, badge: 'BUL', color: '#ff9800', tickSize: 1.0 },
  MCXMETLDEX: { name: 'MCX Base Metals Index', basePrice: 19500, badge: 'MET', color: '#00bcd4', tickSize: 1.0 },
  MCXENRGDEX: { name: 'MCX Energy Index (Crude & Gas)', basePrice: 5600, badge: 'ENR', color: '#e91e63', tickSize: 1.0 },
  MCXCRUDEX: { name: 'MCX Crude Oil Index', basePrice: 5980, badge: 'CRU', color: '#455a64', tickSize: 1.0 },
  MCXSILVDEX: { name: 'MCX Silver Index', basePrice: 89500, badge: 'SLV', color: '#b0bec5', tickSize: 1.0 },
  MCXGOLDEX: { name: 'MCX Gold Index', basePrice: 74500, badge: 'GLD', color: '#ffd700', tickSize: 1.0 },
};

function parseExpiryDate(expStr) {
  if (!expStr) return 9999999999999;
  const match = String(expStr).match(/^(\d{2})([A-Z]{3})(\d{4})$/i);
  if (!match) return 9999999999999;
  const months = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  const d = parseInt(match[1], 10);
  const m = months[match[2].toUpperCase()] || 0;
  const y = parseInt(match[3], 10);
  return new Date(Date.UTC(y, m, d)).getTime();
}

const COMPANY_NAMES = {
  'MUTHOOTFIN': 'Muthoot Finance Ltd.',
  'MUTHOOTCAP': 'Muthoot Capital Services Ltd.',
  'MUTHOOTMF': 'Muthoot Microfin Ltd.',
  'ICICIBANK': 'ICICI Bank Ltd.',
  'ICICIGI': 'ICICI Lombard General Insurance',
  'ICICIPRULI': 'ICICI Prudential Life Insurance',
  'RELIANCE': 'Reliance Industries Ltd.',
  'TCS': 'Tata Consultancy Services Ltd.',
  'HDFCBANK': 'HDFC Bank Ltd.',
  'HDFCLIFE': 'HDFC Life Insurance Co.',
  'HDFCAMC': 'HDFC Asset Management Co.',
  'INFY': 'Infosys Ltd.',
  'TMPV': 'Tata Motors Ltd.',
  'TATAMOTORS': 'Tata Motors Ltd.',
  'TATASTEEL': 'Tata Steel Ltd.',
  'TATAPOWER': 'Tata Power Co. Ltd.',
  'TATACONSUM': 'Tata Consumer Products Ltd.',
  'TATACOMM': 'Tata Communications Ltd.',
  'SBIN': 'State Bank of India',
  'SBILIFE': 'SBI Life Insurance Co.',
  'SBICARD': 'SBI Cards & Payment Services',
  'AXISBANK': 'Axis Bank Ltd.',
  'KOTAKBANK': 'Kotak Mahindra Bank Ltd.',
  'BAJFINANCE': 'Bajaj Finance Ltd.',
  'BAJAJFINSV': 'Bajaj Finserv Ltd.',
  'BAJAJ-AUTO': 'Bajaj Auto Ltd.',
  'LT': 'Larsen & Toubro Ltd.',
  'ITC': 'ITC Limited',
  'MARUTI': 'Maruti Suzuki India Ltd.',
  'SUNPHARMA': 'Sun Pharmaceutical Industries',
  'TITAN': 'Titan Company Ltd.',
  'ASIANPAINT': 'Asian Paints Ltd.',
  'WIPRO': 'Wipro Ltd.',
  'HCLTECH': 'HCL Technologies Ltd.',
  'NTPC': 'NTPC Ltd.',
  'POWERGRID': 'Power Grid Corporation of India',
  'ONGC': 'Oil & Natural Gas Corporation',
  'COALINDIA': 'Coal India Ltd.',
  'ADANIENT': 'Adani Enterprises Ltd.',
  'ADANIPORTS': 'Adani Ports & SEZ',
  'ADANIPOWER': 'Adani Power Ltd.',
  'ADANIGREEN': 'Adani Green Energy Ltd.',
  'HAL': 'Hindustan Aeronautics Ltd.',
  'BEL': 'Bharat Electronics Ltd.',
  'BHEL': 'Bharat Heavy Electricals Ltd.',
  'TRENT': 'Trent Ltd.',
  'VBL': 'Varun Beverages Ltd.',
  'BSE': 'BSE Limited',
  'CDSL': 'Central Depository Services (India)',
  'MCX': 'Multi Commodity Exchange of India',
  'JIOFIN': 'Jio Financial Services Ltd.',
  'ETERNAL': 'Eternal Ltd. (Zomato)',
  'ZOMATO': 'Zomato Ltd. (Eternal)',
  'PAYTM': 'One 97 Communications (Paytm)',
  'SUZLON': 'Suzlon Energy Ltd.',
  'IREDA': 'Indian Renewable Energy Dev Agency',
  'IRFC': 'Indian Railway Finance Corp',
  'RVNL': 'Rail Vikas Nigam Ltd.',
  'YESBANK': 'Yes Bank Ltd.',
  'IDEA': 'Vodafone Idea Ltd.',
  'VEDL': 'Vedanta Ltd.',
  'POLYCAB': 'Polycab India Ltd.',
  'PERSISTENT': 'Persistent Systems Ltd.',
  'COFORGE': 'Coforge Ltd.',
  'DIXON': 'Dixon Technologies (India)',
};

const ALIAS_MAP = {
  'MUTHOOT FINANCE': 'MUTHOOTFIN',
  'MUTHOOT': 'MUTHOOTFIN',
  'ICICI BANK': 'ICICIBANK',
  'ICICI': 'ICICIBANK',
  'TATA MOTORS': 'TMPV',
  'TATAMOTORS': 'TMPV',
  'SBI': 'SBIN',
  'STATE BANK': 'SBIN',
  'STATE BANK OF INDIA': 'SBIN',
  'HDFC BANK': 'HDFCBANK',
  'HDFC': 'HDFCBANK',
  'BAJAJ FINANCE': 'BAJFINANCE',
  'BAJAJ FINSERV': 'BAJAJFINSV',
  'L&T': 'LT',
  'LARSEN': 'LT',
  'LARSEN & TOUBRO': 'LT',
  'ZOMATO': 'ETERNAL',
  'PAYTM': 'PAYTM',
  'SUZLON': 'SUZLON',
};

function indexInstruments(instruments) {
  angelInstruments = instruments;
  for (const item of angelInstruments) {
    if (item.exch_seg === 'NSE' && item.symbol?.endsWith('-EQ')) {
      const rawSym = item.symbol.replace(/-EQ$/, '').toUpperCase();
      nseEquitiesMap.set(rawSym, item);
      nseTokensMap.set(item.token, item);
    } else if (item.exch_seg === 'NFO' && (item.instrumenttype === 'FUTIDX' || item.instrumenttype === 'FUTSTK')) {
      const baseName = item.name.toUpperCase();
      if (!futuresMap.has(baseName)) futuresMap.set(baseName, []);
      futuresMap.get(baseName).push(item);
    } else if (item.exch_seg === 'MCX') {
      if (item.instrumenttype === 'AMXIDX') {
        indicesMap.set(item.symbol.toUpperCase(), item);
        indicesMap.set(item.name.toUpperCase(), item);
      } else if (item.instrumenttype === 'FUTCOM' || item.instrumenttype === 'COMDTY' || item.instrumenttype === 'FUTIDX') {
        const baseName = item.name.toUpperCase();
        if (!commoditiesMap.has(baseName)) commoditiesMap.set(baseName, []);
        commoditiesMap.get(baseName).push(item);
      }
    }
  }

  // Sort futures and commodities by nearest active expiry
  for (const [k, list] of futuresMap.entries()) {
    list.sort((a, b) => parseExpiryDate(a.expiry) - parseExpiryDate(b.expiry));
  }
  for (const [k, list] of commoditiesMap.entries()) {
    list.sort((a, b) => parseExpiryDate(a.expiry) - parseExpiryDate(b.expiry));
  }

  console.log(`[AngelOne] Loaded ${angelInstruments.length} instruments. Indexed ${nseEquitiesMap.size} NSE Equities, ${futuresMap.size} Futures bases, ${commoditiesMap.size} Commodities bases.`);
}

async function loadInstrumentMaster() {
  const masterPath = path.join(ROOT, 'angel-instruments.json');
  if (fs.existsSync(masterPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        indexInstruments(data);
        return;
      }
    } catch (err) {
      console.warn('[AngelOne] Local master file corrupt or unreadable:', err.message);
    }
  }

  // Auto-download from official CDN if missing
  console.log('[AngelOne] ⬇️ Downloading latest instrument master from SmartAPI CDN...');
  try {
    const resp = await fetch('https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        fs.writeFileSync(masterPath, JSON.stringify(data));
        indexInstruments(data);
        return;
      }
    }
  } catch (downloadErr) {
    console.warn('[AngelOne] CDN download failed:', downloadErr.message);
  }
}
loadInstrumentMaster();

// Find AngelOne instrument metadata for any symbol
function resolveAngelInstrument(symbol) {
  const norm = (symbol || '').toUpperCase().trim();
  if (indicesMap.has(norm)) return indicesMap.get(norm);

  // Check direct NSE equity
  if (nseEquitiesMap.has(norm)) return nseEquitiesMap.get(norm);

  // Check alias
  if (ALIAS_MAP[norm] && nseEquitiesMap.has(ALIAS_MAP[norm])) {
    return nseEquitiesMap.get(ALIAS_MAP[norm]);
  }

  // Check MCX commodities & NFO futures
  if (norm.endsWith(' FUT') || norm.endsWith('FUT') || norm.endsWith('1!')) {
    const base = norm.replace(/\s*FUT$|\s*1!$/i, '').trim();
    if (commoditiesMap.has(base)) {
      const list = commoditiesMap.get(base);
      if (list && list.length > 0) return list[0];
    }
    const futList = futuresMap.get(base);
    if (futList && futList.length > 0) {
      return futList[0]; // Nearest active future
    }
  }

  // Check direct commodity name only if explicitly tagged MCX
  if (norm.includes('MCX') && commoditiesMap.has(norm.replace(/MCX/g, '').trim())) {
    const list = commoditiesMap.get(norm.replace(/MCX/g, '').trim());
    if (list && list.length > 0) return list[0];
  }

  return null;
}

// ─── 4. SYMBOL MAPPER & YAHOO/GLOBAL FALLBACK ───
const SYMBOL_MAP = {
  // Indices
  'NIFTY 50': '^NSEI',
  'NIFTY50': '^NSEI',
  'NIFTY': '^NSEI',
  BANKNIFTY: '^NSEBANK',
  'BANK NIFTY': '^NSEBANK',
  FINNIFTY: 'NIFTY_FIN_SERVICE.NS',
  'FIN NIFTY': 'NIFTY_FIN_SERVICE.NS',
  CNXIT: '^CNXIT',
  'NIFTY IT': '^CNXIT',
  CNXAUTO: '^CNXAUTO',
  'NIFTY AUTO': '^CNXAUTO',
  NIFTYMIDCAP: '^NSEMDCP50',
  'NIFTY MIDCAP': '^NSEMDCP50',
  SENSEX: '^BSESN',
  'BSE SENSEX': '^BSESN',

  // Equities
  MUTHOOTFIN: 'MUTHOOTFIN.NS',
  'MUTHOOT FINANCE': 'MUTHOOTFIN.NS',
  ICICIBANK: 'ICICIBANK.NS',
  'ICICI BANK': 'ICICIBANK.NS',
  AXISBANK: 'AXISBANK.NS',
  KOTAKBANK: 'KOTAKBANK.NS',
  BAJFINANCE: 'BAJFINANCE.NS',
  BAJAJFINSV: 'BAJAJFINSV.NS',
  RELIANCE: 'RELIANCE.NS',
  TCS: 'TCS.NS',
  HDFCBANK: 'HDFCBANK.NS',
  'HDFC BANK': 'HDFCBANK.NS',
  INFY: 'INFY.NS',
  INFOSYS: 'INFY.NS',
  TATAMOTORS: 'TMPV.NS',
  'TATA MOTORS': 'TMPV.NS',
  TMPV: 'TMPV.NS',
  SBIN: 'SBIN.NS',
  SBI: 'SBIN.NS',
  LT: 'LT.NS',
  ITC: 'ITC.NS',
  MARUTI: 'MARUTI.NS',
  SUNPHARMA: 'SUNPHARMA.NS',
  TITAN: 'TITAN.NS',
  ASIANPAINT: 'ASIANPAINT.NS',
  WIPRO: 'WIPRO.NS',
  HCLTECH: 'HCLTECH.NS',
  TATASTEEL: 'TATASTEEL.NS',
  JSWSTEEL: 'JSWSTEEL.NS',
  NTPC: 'NTPC.NS',
  POWERGRID: 'POWERGRID.NS',
  ONGC: 'ONGC.NS',
  COALINDIA: 'COALINDIA.NS',
  ADANIENT: 'ADANIENT.NS',
  ADANIPORTS: 'ADANIPORTS.NS',
  HAL: 'HAL.NS',
  BEL: 'BEL.NS',
  TRENT: 'TRENT.NS',
  VBL: 'VBL.NS',
  MCX: 'MCX.NS',
  BSE: 'BSE.NS',
  CDSL: 'CDSL.NS',
  JIOFIN: 'JIOFIN.NS',
  IRFC: 'IRFC.NS',
  RVNL: 'RVNL.NS',

  // MCX Commodities & Indices
  'GOLD FUT': 'GC=F',
  'GOLD': 'GC=F',
  'GOLD MCX': 'GC=F',
  'GOLDM FUT': 'GC=F',
  'GOLDM': 'GC=F',
  'SILVER FUT': 'SI=F',
  'SILVER': 'SI=F',
  'SILVERM FUT': 'SI=F',
  'SILVERM': 'SI=F',
  'SILVERMIC FUT': 'SI=F',
  'CRUDEOIL FUT': 'CL=F',
  'CRUDEOIL': 'CL=F',
  'CRUDEOILM FUT': 'CL=F',
  'CRUDEOILM': 'CL=F',
  'CRUDE OIL': 'CL=F',
  'CRUDE OIL FUT': 'CL=F',
  'NATURALGAS FUT': 'NG=F',
  'NATURALGAS': 'NG=F',
  'NATGASMINI FUT': 'NG=F',
  'NATURAL GAS': 'NG=F',
  'NATURAL GAS FUT': 'NG=F',
  'COPPER FUT': 'HG=F',
  'COPPER': 'HG=F',
  'ZINC FUT': 'ZNC=F',
  'ZINC': 'ZNC=F',
  'ALUMINIUM FUT': 'ALI=F',
  'ALUMINIUM': 'ALI=F',
  'LEAD FUT': 'LED=F',
  'LEAD': 'LED=F',
  'MCXBULLDEX': '^MCXBULLDEX',
  'MCXMETLDEX': '^MCXMETLDEX',
  'MCXENRGDEX': '^MCXENRGDEX',
  'MCXCRUDEX': 'CL=F',
  'MCXSILVDEX': 'SI=F',
  'MCXGOLDEX': 'GC=F',
  XAGUSD: 'SI=F',
  PAXGUSDT: 'GC=F',
  US10Y: '^TNX',
  AAPL: 'AAPL',
  NVDA: 'NVDA',
  TSLA: 'TSLA',
  EURUSD: 'EURUSD=X',
  USDINR: 'USDINR=X',
};

function resolveTicker(symbol) {
  const norm = (symbol || '').toUpperCase().trim();
  if (SYMBOL_MAP[norm]) return SYMBOL_MAP[norm];
  if (norm.endsWith('.NS') || norm.endsWith('.BO') || norm.includes('=') || norm.startsWith('^')) {
    return norm;
  }
  return `${norm}.NS`;
}

function mapInterval(interval) {
  const norm = (interval || '5m').toLowerCase().trim();
  if (norm === '1m' || norm === '1') return '1m';
  if (norm === '2m' || norm === '2') return '2m';
  if (norm === '3m' || norm === '3') return '3m';
  if (norm === '5m' || norm === '5') return '5m';
  if (norm === '15m' || norm === '15') return '15m';
  if (norm === '30m' || norm === '30') return '30m';
  if (norm === '60m' || norm === '1h' || norm === '60') return '60m';
  if (norm === '1d' || norm === 'd' || norm === 'day') return '1d';
  if (norm === '1w' || norm === 'w') return '1wk';
  if (norm === '1m' || norm === 'm' || norm === 'month') return '1mo';
  return '5m';
}

function mapAngelInterval(interval) {
  const norm = (interval || '5m').toLowerCase().trim();
  if (norm === '1m' || norm === '1') return 'ONE_MINUTE';
  if (norm === '3m' || norm === '3') return 'THREE_MINUTE';
  if (norm === '5m' || norm === '5') return 'FIVE_MINUTE';
  if (norm === '15m' || norm === '15') return 'FIFTEEN_MINUTE';
  if (norm === '30m' || norm === '30') return 'THIRTY_MINUTE';
  if (norm === '60m' || norm === '1h' || norm === '60') return 'ONE_HOUR';
  if (norm === '1d' || norm === 'd' || norm === 'day' || norm === '1w' || norm === '1wk') return 'ONE_DAY';
  return 'FIVE_MINUTE';
}

const candleCache = new Map();
const quoteCache = new Map();

// Helper to format Date to IST string "YYYY-MM-DD HH:MM"
function formatISTDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffset);
  return `${istDate.getUTCFullYear()}-${pad(istDate.getUTCMonth() + 1)}-${pad(istDate.getUTCDate())} ${pad(istDate.getUTCHours())}:${pad(istDate.getUTCMinutes())}`;
}

let angelCandleRateLimitUntil = 0;

function sanitizeCandles(rawBars, precision = null) {
  if (!Array.isArray(rawBars) || rawBars.length === 0) return [];
  const map = new Map();
  for (const b of rawBars) {
    if (!b) continue;
    const t = Math.floor(Number(b.time));
    if (!Number.isFinite(t) || t <= 0) continue;

    let c = Number(b.close);
    if (!Number.isFinite(c) || c <= 0) continue;

    let o = Number(b.open);
    if (!Number.isFinite(o) || o <= 0) o = c;

    let h = Number(b.high);
    let l = Number(b.low);
    if (!Number.isFinite(h) || h <= 0) h = Math.max(o, c);
    if (!Number.isFinite(l) || l <= 0) l = Math.min(o, c);

    h = Math.max(h, o, c, l);
    l = Math.min(l, o, c, h);

    const v = Number.isFinite(Number(b.volume)) && Number(b.volume) >= 0 ? Number(b.volume) : 0;

    map.set(t, {
      time: t,
      open: precision !== null ? +o.toFixed(precision) : (o < 1 ? +o.toFixed(4) : +o.toFixed(2)),
      high: precision !== null ? +h.toFixed(precision) : (h < 1 ? +h.toFixed(4) : +h.toFixed(2)),
      low: precision !== null ? +l.toFixed(precision) : (l < 1 ? +l.toFixed(4) : +l.toFixed(2)),
      close: precision !== null ? +c.toFixed(precision) : (c < 1 ? +c.toFixed(4) : +c.toFixed(2)),
      volume: v,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

// ─── BINANCE 24/7 CRYPTO CANDLE & QUOTE HELPERS ───
const CRYPTO_SYMBOLS_SET = new Set([
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'SUIUSDT', 'PAXGUSDT'
]);

function isCryptoSymbol(sym) {
  const s = (sym || '').toUpperCase().trim();
  return CRYPTO_SYMBOLS_SET.has(s) || s.endsWith('USDT');
}

function mapIntervalToBinance(interval) {
  const norm = (interval || '5m').toLowerCase().trim();
  if (norm === '1d' || norm === 'd') return '1d';
  if (norm === '1w' || norm === 'w') return '1w';
  if (norm === '1m' || (norm === 'm' && interval === 'M')) return '1M';
  if (['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'].includes(norm)) {
    return norm;
  }
  return '5m';
}

async function fetchBinanceCandles(symbol, interval) {
  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bInt = mapIntervalToBinance(interval);
  const endpoints = [
    'https://data-api.binance.vision',
    'https://api.binance.com',
    'https://api1.binance.com',
  ];
  for (const host of endpoints) {
    try {
      const resp = await fetch(`${host}/api/v3/klines?symbol=${sym}&interval=${bInt}&limit=500`, {
        signal: AbortSignal.timeout(2500),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (Array.isArray(data)) {
        const bars = [];
        for (const k of data) {
          const t = Math.floor(k[0] / 1000);
          const o = parseFloat(k[1]);
          const h = parseFloat(k[2]);
          const l = parseFloat(k[3]);
          const c = parseFloat(k[4]);
          const v = parseFloat(k[5]) || 0;
          if (t > 0 && Number.isFinite(c)) {
            bars.push({
              time: t,
              open: o,
              high: Math.max(h, o, c),
              low: Math.min(l, o, c),
              close: c,
              volume: v,
            });
          }
        }
        const isFourDecimals = ['XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'SUIUSDT'].includes(sym) || (bars[0] && bars[0].close < 2);
        return sanitizeCandles(bars, isFourDecimals ? 4 : 2);
      }
    } catch (_) {}
  }
  return [];
}

let lastBinanceFetchTime = 0;
let binanceFetchPromise = null;

async function refreshBinanceQuotes(symbols = []) {
  const now = Date.now();
  if (now - lastBinanceFetchTime < 1500) {
    return;
  }
  if (binanceFetchPromise) {
    return binanceFetchPromise;
  }

  binanceFetchPromise = (async () => {
    try {
      const symArray = symbols.length > 0
        ? symbols.filter(isCryptoSymbol).map((s) => s.toUpperCase().trim())
        : Array.from(CRYPTO_SYMBOLS_SET);
      if (symArray.length === 0) return;

      const endpoints = [
        'https://data-api.binance.vision',
        'https://api.binance.com',
        'https://api1.binance.com',
      ];
      for (const host of endpoints) {
        try {
          const url = `${host}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symArray))}`;
          const resp = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(2500),
          });
          if (!resp.ok) continue;
          const data = await resp.json();
          if (Array.isArray(data)) {
            for (const item of data) {
              if (!item || !item.symbol) continue;
              const last = parseFloat(item.lastPrice);
              const open = parseFloat(item.openPrice);
              const chg = parseFloat(item.priceChange);
              const chgPct = parseFloat(item.priceChangePercent);
              quoteCache.set(item.symbol, {
                ltp: last,
                open: open,
                high: parseFloat(item.highPrice),
                low: parseFloat(item.lowPrice),
                close: last,
                prevClose: open,
                chg: chg,
                chgPct: chgPct,
                time: Math.floor(now / 1000),
              });
            }
            lastBinanceFetchTime = Date.now();
            break;
          }
        } catch (_) {}
      }
    } catch (_) {}
    finally {
      binanceFetchPromise = null;
    }
  })();

  return binanceFetchPromise;
}

// ─── 5. ANGELONE HISTORICAL CANDLES FETCHER ───
async function fetchAngelOneCandles(angelInst, interval) {
  if (Date.now() < angelCandleRateLimitUntil) {
    throw new Error('AngelOne candle rate-limit active cooldown');
  }

  if (!angelSession.jwtToken) {
    await authenticateAngelOne();
  }
  if (!angelSession.jwtToken) throw new Error('AngelOne SmartAPI not authenticated');

  const angelInt = mapAngelInterval(interval);
  const now = new Date();
  const toDateStr = formatISTDate(now);
  
  // Calculate fromDate based on interval
  let daysBack = 7;
  if (angelInt === 'ONE_MINUTE') daysBack = 4;
  else if (angelInt === 'THREE_MINUTE' || angelInt === 'FIVE_MINUTE') daysBack = 10;
  else if (angelInt === 'FIFTEEN_MINUTE' || angelInt === 'THIRTY_MINUTE') daysBack = 25;
  else if (angelInt === 'ONE_HOUR') daysBack = 60;
  else if (angelInt === 'ONE_DAY') daysBack = 365;

  const fromDateStr = formatISTDate(new Date(now.getTime() - daysBack * 24 * 3600 * 1000));

  const resp = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/historical/v1/getCandleData', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '127.0.0.1',
      'X-MACAddress': 'fe80::1',
      'X-PrivateKey': angelSession.apiKey,
      'Authorization': `Bearer ${angelSession.jwtToken}`,
    },
    body: JSON.stringify({
      exchange: angelInst.exch_seg || 'NSE',
      symboltoken: String(angelInst.token),
      interval: angelInt,
      fromdate: fromDateStr,
      todate: toDateStr,
    }),
  });

  const text = await resp.text();
  if (resp.status === 403 || text.includes('exceeding access rate')) {
    angelCandleRateLimitUntil = Date.now() + 60000;
    throw new Error('AngelOne historical rate limit reached');
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (_) {
    throw new Error(`Invalid response from AngelOne historical candle API: ${text.slice(0, 80)}`);
  }

  if (!json.status || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(json.message || 'No historical candle data from AngelOne');
  }

  const rawBars = [];
  for (const item of json.data) {
    // item: [ "2026-09-18T13:25:00+05:30", open, high, low, close, volume ]
    const timeSec = Math.floor(new Date(item[0]).getTime() / 1000);
    const o = +item[1];
    const h = +item[2];
    const l = +item[3];
    const c = +item[4];
    const v = +item[5] || 0;

    if (timeSec && Number.isFinite(c)) {
      rawBars.push({
        time: timeSec,
        open: o,
        high: h,
        low: l,
        close: c,
        volume: v,
      });
    }
  }

  return sanitizeCandles(rawBars);
}

// ─── 6. ANGELONE REAL-TIME LTP FETCHER ───
async function fetchAngelOneLtp(angelInst) {
  if (!angelSession.jwtToken) {
    await authenticateAngelOne();
  }
  if (!angelSession.jwtToken) return null;

  try {
    const resp = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/getLtpData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '127.0.0.1',
        'X-MACAddress': 'fe80::1',
        'X-PrivateKey': angelSession.apiKey,
        'Authorization': `Bearer ${angelSession.jwtToken}`,
      },
      body: JSON.stringify({
        exchange: angelInst.exch_seg || 'NSE',
        tradingsymbol: angelInst.symbol,
        symboltoken: String(angelInst.token),
      }),
    });

    const json = await resp.json();
    if (json.status && json.data) {
      const d = json.data;
      const ltp = +d.ltp;
      const prevClose = +d.close || +d.open || ltp;
      const netChg = +(ltp - prevClose).toFixed(2);
      const pctChg = prevClose !== 0 ? +((netChg / prevClose) * 100).toFixed(2) : 0;

      return {
        ltp,
        open: +d.open,
        high: +d.high,
        low: +d.low,
        close: +d.close,
        prevClose,
        chg: netChg,
        chgPct: pctChg,
        time: Math.floor(Date.now() / 1000),
      };
    }
  } catch (_) {}
  return null;
}

// ─── 7. EXCHANGE HISTORY WITH ANGELONE PRIMARY & YAHOO FALLBACK ───
async function fetchLiveExchangeHistory(symbol, interval) {
  const symNorm = symbol.toUpperCase().trim();
  const cacheKey = `${symNorm}_${interval}`;

  const cached = candleCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1500) {
    return cached.data;
  }

  // Handle Binance Crypto directly
  if (isCryptoSymbol(symNorm)) {
    try {
      const binanceBars = await fetchBinanceCandles(symNorm, interval);
      if (binanceBars && binanceBars.length > 0) {
        candleCache.set(cacheKey, { timestamp: Date.now(), data: binanceBars });
        return binanceBars;
      }
    } catch (_) {}
  }

  // Try AngelOne SmartAPI first if authenticated
  const angelInst = resolveAngelInstrument(symNorm);
  if (angelInst && angelSession.isAuthenticated && Date.now() >= angelCandleRateLimitUntil) {
    try {
      const angelBars = await fetchAngelOneCandles(angelInst, interval);
      if (angelBars && angelBars.length > 0) {
        // Also fetch latest LTP to ensure last bar has real-time tick
        const ltpData = await fetchAngelOneLtp(angelInst);
        if (ltpData && Number.isFinite(ltpData.ltp) && ltpData.ltp > 0) {
          quoteCache.set(symNorm, ltpData);
          const lastBar = angelBars[angelBars.length - 1];
          if (lastBar && Date.now() / 1000 - lastBar.time < 300) {
            lastBar.close = +ltpData.ltp.toFixed(2);
            lastBar.high = Math.max(lastBar.high, lastBar.open, lastBar.close);
            lastBar.low = Math.min(lastBar.low, lastBar.open, lastBar.close);
          }
        }
        const cleaned = sanitizeCandles(angelBars);
        candleCache.set(cacheKey, { timestamp: Date.now(), data: cleaned });
        return cleaned;
      }
    } catch (angelErr) {
      // Gentle fallback
    }
  }

  // Fallback to Yahoo Finance / global exchange feeds
  const mappedTicker = resolveTicker(symNorm);
  const mappedInt = mapInterval(interval);
  const mappedRng = mappedInt === '1m' ? '2d' : (mappedInt === '1d' ? '1y' : '5d');

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(mappedTicker)}?interval=${mappedInt}&range=${mappedRng}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });

  if (!resp.ok) {
    throw new Error(`Exchange HTTP ${resp.status}: ${resp.statusText}`);
  }

  const json = await resp.json();
  const result = json.chart?.result?.[0];
  if (!result || !result.timestamp || result.timestamp.length === 0) {
    throw new Error('No candle data returned for symbol');
  }

  const timestamps = result.timestamp;
  const quote = result.indicators?.quote?.[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const rawBars = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const c = closes[i];
    if (!t || !Number.isFinite(c)) continue;
    const o = Number.isFinite(opens[i]) ? opens[i] : c;
    const h = Number.isFinite(highs[i]) ? highs[i] : Math.max(o, c);
    const l = Number.isFinite(lows[i]) ? lows[i] : Math.min(o, c);
    const v = Number.isFinite(volumes[i]) && volumes[i] >= 0 ? volumes[i] : 0;

    rawBars.push({
      time: t,
      open: o,
      high: Math.max(h, o, c),
      low: Math.min(l, o, c),
      close: c,
      volume: v,
    });
  }

  const bars = sanitizeCandles(rawBars);

  if (bars.length > 0) {
    const lastBar = bars[bars.length - 1];
    const ltp = result.meta?.regularMarketPrice || lastBar.close;
    const prevClose = result.meta?.previousClose || lastBar.open;
    const netChg = +(ltp - prevClose).toFixed(2);
    const pctChg = prevClose !== 0 ? +((netChg / prevClose) * 100).toFixed(2) : 0;

    quoteCache.set(symNorm, {
      ltp: ltp,
      time: lastBar.time,
      prevClose: prevClose,
      chg: netChg,
      chgPct: pctChg,
    });
    candleCache.set(cacheKey, { timestamp: Date.now(), data: bars });
  }

  return bars;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.wasm': 'application/wasm',
};

function createServer() {
  const server = http.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      });
      res.end();
      return;
    }

    const reqUrl = new URL(req.url, 'http://localhost');

    // ─── HEALTH CHECK & KEEP-ALIVE PING (UptimeRobot / Render) ───
    if (reqUrl.pathname === '/health' || reqUrl.pathname === '/ping' || reqUrl.pathname === '/api/health') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now(), uptime: Math.floor(process.uptime()) }));
      return;
    }

    // ─── 8. BROKER STATUS ENDPOINT ───
    if (reqUrl.pathname === '/api/broker/status') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(
        JSON.stringify({
          status: 'success',
          connected: angelSession.isAuthenticated,
          broker: angelSession.isAuthenticated ? 'AngelOne SmartAPI' : 'NSE Live Feeds',
          clientId: angelSession.clientCode,
          hasCredentials: !!angelSession.apiKey,
        })
      );
      return;
    }

    // ─── 9. DYNAMIC MULTI-ASSET SEARCH API ───
    if (reqUrl.pathname === '/api/market/search') {
      const q = (reqUrl.searchParams.get('q') || '').trim().toUpperCase();
      const cat = (reqUrl.searchParams.get('cat') || 'all').toLowerCase();
      const cleanQ = q.replace(/\s*FUT$|\s*FUTURE$|\s*INDEX$/i, '').trim();
      const candidates = [];

      // 1. Search Indices (NSE, BSE, MCX)
      if (cat === 'all' || cat === 'india' || cat === 'indices' || cat === 'commodities' || cat === 'futures') {
        for (const [name, meta] of indicesMap.entries()) {
          const isMcx = meta.exch_seg === 'MCX';
          if (cat === 'india' && isMcx) continue;
          if (cat === 'commodities' && !isMcx) continue;
          const metaInfo = COMMODITY_METAS[name] || {};
          const fullName = metaInfo.name || meta.name;
          const upperName = fullName.toUpperCase();

          let score = 0;
          if (!q) score = isMcx ? 35 : 60;
          else if (name === q || name === cleanQ) score = 220;
          else if (name.startsWith(cleanQ) || name.startsWith(q)) score = 170;
          else if (name.includes(cleanQ) || cleanQ.includes(name)) score = 120;
          else if (upperName.includes(cleanQ)) score = 90;

          if (score > 0 && !candidates.find((c) => c.item.symbol === name)) {
            candidates.push({
              score,
              item: {
                symbol: name,
                displaySymbol: name,
                name: fullName,
                exchange: meta.exch_seg,
                category: isMcx ? 'commodities' : 'india',
                feedType: 'openalgo',
                basePrice: metaInfo.basePrice || 0,
                tickSize: metaInfo.tickSize || 0.05,
                precision: 2,
                badgeText: metaInfo.badge || name.substring(0, 3),
                badgeColor: metaInfo.color || (isMcx ? '#ff9800' : '#2962ff'),
              },
            });
          }
        }
      }

      // 2. Search MCX Commodities & Futures
      if (cat === 'all' || cat === 'commodities' || cat === 'futures') {
        for (const [baseName, list] of commoditiesMap.entries()) {
          const meta = COMMODITY_METAS[baseName] || {};
          const compName = meta.name || `${baseName} Commodity`;
          const compUpper = compName.toUpperCase();
          const isMain = !!COMMODITY_METAS[baseName];

          let score = 0;
          if (!q) score = isMain ? 40 : 5;
          else if (baseName === cleanQ || baseName === q) score = isMain ? 210 : 150;
          else if (baseName.startsWith(cleanQ)) score = isMain ? 160 : 110;
          else if (baseName.includes(cleanQ) || cleanQ.includes(baseName)) score = isMain ? 110 : 70;
          else if (compUpper.includes(cleanQ)) score = isMain ? 80 : 50;

          if (score > 0) {
            const nearFut = list[0];
            const symKey = `${baseName} FUT`;
            if (!candidates.find((c) => c.item.symbol === symKey)) {
              const expText = nearFut?.expiry ? ` (${nearFut.expiry})` : '';
              candidates.push({
                score,
                item: {
                  symbol: symKey,
                  displaySymbol: symKey,
                  name: `${meta.name || baseName}${expText}`,
                  exchange: 'MCX',
                  category: 'commodities',
                  feedType: 'openalgo',
                  basePrice: meta.basePrice || 0,
                  tickSize: +nearFut?.tick_size / 100 || meta.tickSize || 0.05,
                  precision: 2,
                  badgeText: meta.badge || 'MCX',
                  badgeColor: meta.color || '#ff9800',
                },
              });
            }
          }
        }

        // Add built-in COMMODITY_METAS if not in commoditiesMap
        for (const [sym, meta] of Object.entries(COMMODITY_METAS)) {
          if (!sym.startsWith('MCX')) {
            const symKey = `${sym} FUT`;
            if (!candidates.find((c) => c.item.symbol === symKey)) {
              let score = 0;
              if (!q) score = 40;
              else if (sym === cleanQ || sym === q) score = 210;
              else if (sym.startsWith(cleanQ)) score = 160;
              else if (sym.includes(cleanQ) || cleanQ.includes(sym)) score = 110;
              else if (meta.name.toUpperCase().includes(cleanQ)) score = 80;

              if (score > 0) {
                candidates.push({
                  score,
                  item: {
                    symbol: symKey,
                    displaySymbol: symKey,
                    name: meta.name,
                    exchange: 'MCX',
                    category: 'commodities',
                    feedType: 'openalgo',
                    basePrice: meta.basePrice || 0,
                    tickSize: meta.tickSize || 0.05,
                    precision: 2,
                    badgeText: meta.badge || 'MCX',
                    badgeColor: meta.color || '#ff9800',
                  },
                });
              }
            }
          }
        }

        // Global Commodities (Spot Gold, Silver, Forex)
        const topComm = [
          { symbol: 'PAXGUSDT', name: 'Paxos Spot Gold (XAU/USD)', exchange: 'BINANCE', badge: 'GOLD', color: '#ffb300' },
          { symbol: 'XAGUSD', name: 'Spot Silver (SI)', exchange: 'FOREX', badge: 'AG', color: '#90a4ae' },
          { symbol: 'USDINR', name: 'US Dollar / Indian Rupee', exchange: 'NSE', badge: '$₹', color: '#43a047' },
        ];
        for (const m of topComm) {
          let score = 0;
          if (!q) score = 25;
          else if (m.symbol === q || m.symbol === cleanQ) score = 190;
          else if (m.symbol.startsWith(cleanQ)) score = 140;
          else if (m.symbol.includes(cleanQ) || m.name.toUpperCase().includes(cleanQ)) score = 90;

          if (score > 0 && !candidates.find((c) => c.item.symbol === m.symbol)) {
            candidates.push({
              score,
              item: {
                symbol: m.symbol,
                displaySymbol: m.symbol,
                name: m.name,
                exchange: m.exchange,
                category: 'commodities',
                feedType: m.symbol === 'PAXGUSDT' ? 'binance' : 'openalgo',
                basePrice: 0,
                tickSize: 0.05,
                precision: 2,
                badgeText: m.badge,
                badgeColor: m.color,
              },
            });
          }
        }
      }

      // 3. Search NSE Equities
      if (cat === 'all' || cat === 'india') {
        const qCleanEquities = q.replace(/[^A-Z0-9]/g, '');

        if (ALIAS_MAP[q] && nseEquitiesMap.has(ALIAS_MAP[q])) {
          const sym = ALIAS_MAP[q];
          const scrip = nseEquitiesMap.get(sym);
          candidates.push({
            score: 210,
            item: {
              symbol: sym,
              displaySymbol: sym,
              name: COMPANY_NAMES[sym] || scrip.name || sym,
              exchange: 'NSE',
              category: 'india',
              feedType: 'openalgo',
              basePrice: 0,
              tickSize: +scrip.tick_size / 100 || 0.05,
              precision: 2,
              badgeText: sym.substring(0, 2),
              badgeColor: '#e53935',
            },
          });
        }

        for (const [sym, scrip] of nseEquitiesMap.entries()) {
          const compName = COMPANY_NAMES[sym] || scrip.name || sym;
          const compUpper = compName.toUpperCase();
          const compClean = compUpper.replace(/[^A-Z0-9]/g, '');

          let score = 0;
          if (!q) score = COMPANY_NAMES[sym] ? 20 : 5;
          else if (sym === q || sym === cleanQ) score = 200;
          else if (sym.startsWith(cleanQ)) score = 150;
          else if (sym.includes(cleanQ)) score = 90;
          else if (qCleanEquities.length > 2 && compClean.includes(qCleanEquities)) score = 70;
          else if (compUpper.includes(cleanQ)) score = 50;

          if (score > 0 && !candidates.find((c) => c.item.symbol === sym)) {
            candidates.push({
              score,
              item: {
                symbol: sym,
                displaySymbol: sym,
                name: compName,
                exchange: 'NSE',
                category: 'india',
                feedType: 'openalgo',
                basePrice: 0,
                tickSize: +scrip.tick_size / 100 || 0.05,
                precision: 2,
                badgeText: sym.substring(0, 2),
                badgeColor: '#e53935',
              },
            });
          }
        }
      }

      // 4. Search NFO Futures
      if (cat === 'all' || cat === 'futures' || cat === 'indices') {
        for (const [baseName, list] of futuresMap.entries()) {
          const compName = COMPANY_NAMES[baseName] || baseName;
          let score = 0;
          if (!q) score = 15;
          else if (baseName === cleanQ || baseName === q) score = 190;
          else if (baseName.startsWith(cleanQ)) score = 140;
          else if (baseName.includes(cleanQ) || cleanQ.includes(baseName)) score = 80;

          if (score > 0) {
            const nearFut = list[0];
            const symKey = `${baseName} FUT`;
            if (nearFut && !candidates.find((c) => c.item.symbol === symKey)) {
              candidates.push({
                score,
                item: {
                  symbol: symKey,
                  displaySymbol: symKey,
                  name: `${compName} (${nearFut.expiry})`,
                  exchange: 'NFO',
                  category: 'futures',
                  feedType: 'openalgo',
                  basePrice: 0,
                  tickSize: +nearFut.tick_size / 100 || 0.05,
                  precision: 2,
                  badgeText: 'FUT',
                  badgeColor: '#ff9800',
                },
              });
            }
          }
        }
      }

      // 5. Search Crypto (24/7 Binance)
      if (cat === 'all' || cat === 'crypto') {
        const topCrypto = [
          { symbol: 'BTCUSDT', name: 'Bitcoin / Tether USD', basePrice: 91000 },
          { symbol: 'ETHUSDT', name: 'Ethereum / Tether USD', basePrice: 3300 },
          { symbol: 'SOLUSDT', name: 'Solana / Tether USD', basePrice: 190 },
          { symbol: 'BNBUSDT', name: 'BNB / Tether USD', basePrice: 650 },
          { symbol: 'XRPUSDT', name: 'Ripple / Tether USD', basePrice: 2.2 },
          { symbol: 'DOGEUSDT', name: 'Dogecoin / Tether USD', basePrice: 0.25 },
          { symbol: 'ADAUSDT', name: 'Cardano / Tether USD', basePrice: 0.8 },
          { symbol: 'LINKUSDT', name: 'Chainlink / Tether USD', basePrice: 18 },
          { symbol: 'AVAXUSDT', name: 'Avalanche / Tether USD', basePrice: 32 },
          { symbol: 'SUIUSDT', name: 'Sui / Tether USD', basePrice: 3.5 },
        ];
        for (const c of topCrypto) {
          let score = 0;
          if (!q) score = 20;
          else if (c.symbol === q || c.symbol === cleanQ) score = 190;
          else if (c.symbol.startsWith(cleanQ)) score = 140;
          else if (c.symbol.includes(cleanQ) || c.name.toUpperCase().includes(cleanQ)) score = 80;

          if (score > 0 && !candidates.find((cand) => cand.item.symbol === c.symbol)) {
            candidates.push({
              score,
              item: {
                symbol: c.symbol,
                displaySymbol: c.symbol,
                name: c.name,
                exchange: 'BINANCE',
                category: 'crypto',
                feedType: 'binance',
                basePrice: c.basePrice,
                tickSize: 0.01,
                precision: 2,
                badgeText: c.symbol.substring(0, 2),
                badgeColor: '#f7931a',
              },
            });
          }
        }
      }

      // Sort all matched candidates by relevance score descending
      candidates.sort((a, b) => b.score - a.score);
      const results = candidates.slice(0, 60).map((c) => c.item);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ status: 'success', count: results.length, results }));
      return;
    }

    // ─── 10. LIVE MARKET DATA API ENDPOINT ───
    if (reqUrl.pathname === '/api/market/history' || reqUrl.pathname === '/api/v1/history') {
      let body = {};
      if (req.method === 'POST') {
        try {
          const buffers = [];
          for await (const chunk of req) buffers.push(chunk);
          body = JSON.parse(Buffer.concat(buffers).toString());
        } catch (_) {}
      }

      const symbol = reqUrl.searchParams.get('symbol') || body.symbol || 'NIFTY 50';
      const interval = reqUrl.searchParams.get('interval') || body.interval || '5m';

      try {
        const bars = await fetchLiveExchangeHistory(symbol, interval);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        });
        res.end(JSON.stringify({ status: 'success', symbol, interval, data: bars }));
        return;
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'error', message: err.message }));
        return;
      }
    }

    // ─── 11. LIVE MARKET QUOTES API ENDPOINT ───
    if (reqUrl.pathname === '/api/market/quotes' || reqUrl.pathname === '/api/v1/quotes' || reqUrl.pathname === '/api/v1/multiquotes') {
      const symbolsParam = reqUrl.searchParams.get('symbols');
      const symbols = symbolsParam ? symbolsParam.split(',') : Array.from(nseEquitiesMap.keys()).slice(0, 30);
      const quotes = {};

      const cryptoInRequest = symbols.filter(isCryptoSymbol);
      if (cryptoInRequest.length > 0) {
        await refreshBinanceQuotes(cryptoInRequest);
      }

      for (const sym of symbols) {
        const s = sym.trim().toUpperCase();
        let cached = quoteCache.get(s);
        if (!cached) {
          if (isCryptoSymbol(s)) {
            refreshBinanceQuotes([s]).catch(() => {});
          } else {
            const angelInst = resolveAngelInstrument(s);
            if (angelInst && angelSession.isAuthenticated) {
              // Asynchronously fetch live LTP from AngelOne
              fetchAngelOneLtp(angelInst).then((ltpData) => {
                if (ltpData) quoteCache.set(s, ltpData);
              }).catch(() => {});
            } else {
              fetchLiveExchangeHistory(s, '5m').catch(() => {});
            }
          }
        } else {
          quotes[s] = cached;
        }
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ status: 'success', quotes }));
      return;
    }

    let reqPath = decodeURIComponent(reqUrl.pathname);
    if (reqPath === '/' || reqPath === '') {
      reqPath = '/index.html';
    }

    const filePath = path.join(ROOT, reqPath);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`404 Not Found: ${reqPath}`);
        return;
      }

      let actualFile = filePath;
      if (stats.isDirectory()) {
        const indexHtml = path.join(filePath, 'index.html');
        if (fs.existsSync(indexHtml)) {
          actualFile = indexHtml;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end(`404 Not Found: Directory index missing for ${reqPath}`);
          return;
        }
      }

      const ext = path.extname(actualFile).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(actualFile, (readErr, data) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`500 Internal Server Error: ${readErr.message}`);
          return;
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        });
        res.end(data);
      });
    });
  });

  return server;
}

function startListening(port) {
  const server = createServer();

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying port ${port + 1}...`);
      startListening(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}/index.html`;
    console.log('\n======================================================');
    console.log(`  🚀 Zero Chart — TradingView Pro Terminal is running!`);
    console.log(`  👉 URL: \x1b[36m${url}\x1b[0m`);
    console.log(`  📊 Crypto: \x1b[32mBinance 24/7 Live WebSockets\x1b[0m`);
    console.log(`  🇮🇳 India Equities: \x1b[33m100% LIVE REAL-TIME NSE / BSE / MCX\x1b[0m`);
    if (angelSession.apiKey) {
      console.log(`  🔑 Broker API: \x1b[32mAngelOne SmartAPI Connected (${angelSession.clientCode})\x1b[0m`);
    }
    console.log(`  🛢️ Commodities: \x1b[35mSpot Gold (XAU), Silver, Crude Oil\x1b[0m`);
    console.log('======================================================\n');
  });
}

startListening(DEFAULT_PORT);

