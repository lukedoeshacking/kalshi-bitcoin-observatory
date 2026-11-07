import {snapshot, api} from './forecast.mjs';
import {readFileSync, mkdirSync, writeFileSync, existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {sign, constants, randomUUID} from 'node:crypto';
const live = process.argv.includes('--live');
const dir = join(homedir(), '.kalshi-btc-orders');
mkdirSync(dir,{recursive:true});
async function tick() {
  const s = await snapshot();
  if (Date.parse(s.closes)-Date.now()<90000 || s.ask<=0 || s.ask>=1 || s.probability-s.ask<0.10) return console.log(s.ticker,'pass');
  if (!live) return console.log(s.ticker,'paper signal: buy one YES at limit',s.ask);
  const budget = Number(process.env.KALSHI_MAX_CONTRACTS);
  if (!Number.isSafeInteger(budget)||budget<1) throw Error('Set a lifetime contract limit');
  if (existsSync(join(dir,'STOP'))) throw Error('STOP file present');
  const key = readFileSync(process.env.KALSHI_PRIVATE_KEY_PATH);
  const id = process.env.KALSHI_API_KEY_ID;
  if (!id) throw Error('Missing key ID');
  const client_order_id = randomUUID();
  const body = {ticker:s.ticker, client_order_id, side:'bid', count:'1.00',price:s.ask.toFixed(4),time_in_force:'immediate_or_cancel',self_trade_prevention_type:'taker_at_cross'};
  const reserve = file => {
    try {writeFileSync(join(dir,file),JSON.stringify(body),{flag:'wx'}); return true;}
    catch(e){if(e.code==='EEXIST') return false; throw e;}
  };
  if (!reserve(s.ticker+'.json')) return;
  let slot=1;
  while(slot<=budget && !reserve('slot-'+slot)) slot++;
  if(slot>budget) throw Error('Lifetime limit reached');
  const path='/portfolio/events/orders', stamp=String(Date.now());
  const signature=sign('sha256',Buffer.from(stamp+'POST/trade-api/v2'+path),{key,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32}).toString('base64');
  const r=await fetch(api+path,{method:'POST',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json','KALSHI-ACCESS-KEY':id,'KALSHI-ACCESS-TIMESTAMP':stamp,'KALSHI-ACCESS-SIGNATURE':signature},body:JSON.stringify(body)});
  writeFileSync(join(dir,client_order_id+'.response'),await r.text());
  if(!r.ok) throw Error('Order HTTP '+r.status+'; inspect local receipt');
  console.log('Order acknowledged',client_order_id);
}
do {
  try {await tick();} catch(e){console.error(e.message); if(live || !process.argv.includes('--watch')) process.exit(1);}
  if(!process.argv.includes('--watch')) break;
  await new Promise(resolve=>setTimeout(resolve,30000));
} while(true);
