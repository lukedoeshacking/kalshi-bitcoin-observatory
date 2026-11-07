# Bitcoin Observatory
[Forecast dashboard](https://lukedoeshacking.github.io/kalshi-bitcoin-observatory/)

Node 24+, no packages. Run from the repository root.

- `node publish.mjs` fetches public Kalshi KXBTC15M quotes and Coinbase BTC-USD candles and trades. It records a timestamped forecast in docs/feed.json. GitHub Actions requests a refresh every five minutes. Scheduling and publication can be delayed.
- `node bot.mjs --watch` checks every 30 seconds and prints hypothetical one-contract YES entries when the forecast exceeds the ask by ten percentage points. Paper signals do not simulate fills or fees.
- To run live on one trusted computer, set KALSHI_API_KEY_ID, KALSHI_PRIVATE_KEY_PATH (absolute path to the RSA PEM outside this repository), and KALSHI_MAX_CONTRACTS (your lifetime maximum number of one-contract submissions). Run `node bot.mjs --watch --live`. Each contract risks its purchase price plus exchange fees. The cap is local to this installation. The runner uses a limit order with immediate-or-cancel execution and stops on errors. Ctrl+C stops it. A STOP file in ~/.kalshi-btc-orders blocks new qualifying orders.
- Keep ~/.kalshi-btc-orders intact. It holds exclusive per-contract reservations, lifetime slots, and exchange receipts. A timeout, rejection, or crash consumes the reservation. Check Kalshi order history for uncertain fills. Never run a second installation against the same budget. The public workflow has no account keys.
- Forecasts assume zero log-price drift and constant near-term volatility. The market settles on averaged BRTI. Coinbase basis, fees and spreads can erase apparent edge. Validate against official settlements using fixed-horizon pre-close observations before interpreting accuracy or profitability. Git history retains snapshots for later evaluation.

[Kalshi order specification](https://docs.kalshi.com/api-reference/orders/create-order-v2)
