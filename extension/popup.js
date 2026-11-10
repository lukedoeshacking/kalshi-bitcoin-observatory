async function refresh() {
  const response = await fetch('https://lukedoeshacking.github.io/kalshi-bitcoin-observatory/feed.json', {cache:'no-store', signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw Error();
  const row = (await response.json()).history[0];
  if (!Number.isFinite(row?.probability) || !Number.isFinite(Date.parse(row.closes)) || !Number.isFinite(Date.parse(row.at))) throw Error();
  const closed = Date.now() >= Date.parse(row.closes);
  document.getElementById('prob').textContent = (row.probability * 100).toFixed(1) + '%';
  document.getElementById('status').textContent = (closed ? 'Contract closed' : 'Published snapshot') + ' · Observed ' + new Date(row.at).toLocaleString() + '.';
}
function load() {
  refresh().catch(() => {
    document.getElementById('prob').textContent = '—';
    document.getElementById('status').textContent = 'Forecast unavailable.';
  });
}
load();
setInterval(load, 30000);
