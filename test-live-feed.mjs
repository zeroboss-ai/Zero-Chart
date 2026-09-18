// Test Live Real-Time Indian Market Data Fetch
const symbols = [
  { sym: '^NSEI', name: 'NIFTY 50' },
  { sym: '^NSEBANK', name: 'BANKNIFTY' },
  { sym: 'RELIANCE.NS', name: 'RELIANCE' },
  { sym: 'TCS.NS', name: 'TCS' },
  { sym: 'HDFCBANK.NS', name: 'HDFCBANK' },
  { sym: 'INFY.NS', name: 'INFY' },
  { sym: 'SBIN.NS', name: 'SBIN' },
  { sym: 'TATAMOTORS.NS', name: 'TATAMOTORS' }
];

async function main() {
  console.log('Fetching live real-time market data from public exchange endpoints...');
  for (const item of symbols) {
    try {
      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(item.sym) + '?interval=5m&range=5d';
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const result = json.chart.result[0];
      const meta = result.meta;
      const timestamps = result.timestamp || [];
      const quote = result.indicators.quote[0];
      console.log(`✅ ${item.name} (${item.sym}): Live LTP = ₹${meta.regularMarketPrice}, PrevClose = ₹${meta.previousClose}, Candles count = ${timestamps.length}`);
    } catch (err) {
      console.error(`❌ ${item.name} error:`, err.message);
    }
  }
}

main();
