import { snapshot } from './forecast.mjs';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
const path = 'docs/feed.json';
const old = JSON.parse(readFileSync(path, 'utf8'));
const now = await snapshot();
const history = [now, ...old.history.filter(row => row.ticker !== now.ticker)].slice(0, 96);
writeFileSync(path + '.tmp', JSON.stringify({history}, null, 2) + '\n');
renameSync(path + '.tmp', path);
console.log(now.ticker, now.probability);

