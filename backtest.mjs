import {readFileSync} from 'node:fs';
const api='https://external-api.kalshi.com/trade-api/v2';
async function get(path){
  for(let i=0;i<5;i++){
    const r=await fetch(api+path,{signal:AbortSignal.timeout(20000)});
    if(r.ok)return r.json();
    if(r.status!==429)throw Error('HTTP '+r.status);
    await new Promise(resolve=>setTimeout(resolve,1000*(i+1)));
  }
  throw Error('Rate limited');
}
const snapshots=JSON.parse(readFileSync('docs/feed.json')).history.toReversed();
let bank=1000, pair=0;
for(const s of snapshots){
  const {market:m}=await get('/markets/'+s.ticker);
  if(!['yes','no'].includes(m.result))continue;
  let yes=0,no=0,cursor='';
  do{
    const page=await get('/markets/trades?ticker='+s.ticker+'&limit=1000&cursor='+encodeURIComponent(cursor));
    for(const t of page.trades){
      if(t.is_block_trade || Date.parse(t.created_time)<Date.parse(m.open_time) || Date.parse(t.created_time)>=Date.parse(m.close_time))continue;
      // Strict trade-through only. Ignore prints exactly at our limit.
      if(t.taker_side==='no' && +t.yes_price_dollars<.4)yes=Math.min(100,yes+Number(t.count_fp));
      if(t.taker_side==='yes' && +t.no_price_dollars<.4)no=Math.min(100,no+Number(t.count_fp));
    }
    cursor=page.cursor;
  }while(cursor && (yes<100 || no<100));
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
