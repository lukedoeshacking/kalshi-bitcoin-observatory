export const api = 'https://external-api.kalshi.com/trade-api/v2';
async function get(url) {
  const target = new URL(url); target.searchParams.set("t", String(Date.now()));
  const r = await fetch(target, {signal: AbortSignal.timeout(10000)});
  if (!r.ok) throw Error('Feed HTTP ' + r.status);
  return r.json();
}
export function erfApprox(x) {
  const t = 1 / (1 + .3275911 * Math.abs(x));
  return Math.sign(x) * (1 - (((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x));
}
export async function snapshot() {
  const [book, candles, trade] = await Promise.all([
    get(api + '/markets?series_ticker=KXBTC15M&status=open&limit=10'),
    get('https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60'),
    get('https://api.exchange.coinbase.com/products/BTC-USD/ticker')
  ]);
  const now = Date.now();
  const m = book.markets.find(m => m.status === 'active' && new Date(m.open_time)<=now && new Date(m.close_time)>now && m.strike_type === 'greater_or_equal' && Number(m.floor_strike)>0);
  if (!m) throw Error('No eligible open contract');
  const rows = candles.filter(c => (c[0]+60)*1000<=now).sort((a,b)=>b[0]-a[0]).slice(0,61);
  const age = now - Date.parse(trade.time);
  if (!(age >= -5000 && age < 30000 && rows.length === 61 && now-rows[0][0]*1000<150000)) throw Error('Insufficient recent prices');
  const returns = rows.slice(1).map((r,i)=>{
    if(rows[i][0]-r[0]!==60) throw Error('Candle gap');
    return Math.log(rows[i][4]/r[4]);
  });
  const sigma = Math.sqrt(returns.reduce((sum,r)=>sum+r*r,0)/returns.length);
  const minutes = (Date.parse(m.close_time)-now)/60000;
  const spot = Number(trade.price);
  const z = Math.log(spot/m.floor_strike)/(sigma*Math.sqrt(minutes));
  if (!Number.isFinite(z)) throw Error('Invalid volatility or price');
  const bid = Number(m.yes_bid_dollars), ask = Number(m.yes_ask_dollars);
  if (!(m.yes_bid_dollars && m.yes_ask_dollars && bid>=0 && ask<=1 && bid<=ask)) throw Error('Invalid quote');
  return {ticker:m.ticker, at:new Date(now).toISOString(), closes:m.close_time, spot, strike:Number(m.floor_strike),
    probability:(1+erfApprox(z/Math.SQRT2))/2, bid, ask, prices:rows.map(r=>r[4]).reverse()};
}

