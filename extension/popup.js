import {snapshot} from './forecast.mjs';
const el = id => document.getElementById(id);
const usd = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'});
let closeTime = 0;
function clear(message) {
  closeTime = 0;
  for (const id of ['prob','strike','spot','quote','left','contract']) el(id).textContent = '—';
  el('status').textContent = message;
}
function countdown() {
  if (!closeTime) return;
  const seconds = Math.ceil((closeTime-Date.now())/1000);
  if (seconds <= 0) return clear('Finding the next contract…');
  el('left').textContent = Math.floor(seconds/60)+'m '+seconds%60+'s';
}
async function refresh() {
  try {
    const row = await snapshot();
    closeTime = Date.parse(row.closes);
    el('prob').textContent = (row.probability*100).toFixed(1)+'%';
    el('strike').textContent = usd.format(row.strike);
    el('spot').textContent = usd.format(row.spot);
    el('quote').textContent = (100*row.bid).toFixed(1)+'¢ / '+(100*row.ask).toFixed(1)+'¢';
    el('contract').textContent = row.ticker;
    el('status').textContent = 'Updated '+new Date(row.at).toLocaleTimeString();
    countdown();
  } catch (e) {
    clear('Forecast unavailable. '+e.message+'. Retrying…');
  } finally {
    setTimeout(refresh,5000);
  }
}
refresh();
setInterval(countdown,1000);
