import {readFileSync} from 'node:fs';
import {get,pairedFills} from './paired-market.mjs';
const snapshots=JSON.parse(readFileSync('docs/feed.json')).history.toReversed();
let bank=1000, pair=0;
for(const s of snapshots){
  const {market:m}=await get('/markets/'+s.ticker);
  if(!['yes','no'].includes(m.result))continue;
  const {yes,no}=await pairedFills(m);
  const paired=(m.result==='yes'?yes:no)-.4*(yes+no);
  pair+=paired;
  const side=s.probability-s.ask >= (1-s.probability)-(1-s.bid)?'yes':'no';
  const p=side==='yes'?s.probability:1-s.probability;
  const price=side==='yes'?s.ask:1-s.bid;
  const cost=price+.07*price*(1-price);
  const fraction=cost>0 && cost<1?Math.max(0,(p-cost)/(1-cost))/4:0;
  const qty=fraction?Math.floor(bank*Math.min(.02,fraction)/cost):0;
  const fee=Math.ceil(100*.07*qty*price*(1-price)-1e-9)/100;
  bank+=qty*(Number(m.result===side)-price)-fee;
  console.log(s.ticker,m.result,yes.toFixed(2),no.toFixed(2),paired.toFixed(2),side,qty,bank.toFixed(2));
}
console.log('Pair gross P&L',pair.toFixed(2),'Kelly net P&L',(bank-1000).toFixed(2));

