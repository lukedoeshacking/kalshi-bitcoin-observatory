import {get} from './paired-market.mjs';
import {existsSync,readFileSync,appendFileSync,writeFileSync} from 'node:fs';
const end=Date.parse('2026-11-09T23:45:00Z')/1000, start=end-360000;
const markets=[];
let cursor='';
do {
 const page=await get('/markets?series_ticker=KXBTC15M&limit=1000&min_close_ts='+(start+1)+'&max_close_ts='+end+'&cursor='+encodeURIComponent(cursor));
 markets.push(...page.markets);cursor=page.cursor;
}while(cursor);
const valid=markets.filter(m=>['yes','no'].includes(m.result)&&Date.parse(m.open_time)/1000>=start&&Date.parse(m.close_time)/1000<=end);
console.log('Eligible markets:',valid.length);
const path='paired-100h.ndjson';
const rows=existsSync(path)?readFileSync(path,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const seen=new Set(rows.map(r=>r.ticker));
const queue=valid.filter(m=>!seen.has(m.ticker));
await Promise.all(Array.from({length:5},async()=>{
 while(queue.length){
 const m=queue.pop();
 const {yes,no}=await studyFills(m);
 const units=((m.result==='yes'?yes:no)-.4*(yes+no))/40;
 const row={ticker:m.ticker,close:m.close_time,result:m.result,yes,no,units};
 appendFileSync(path,JSON.stringify(row)+'\n');rows.push(row);
 if(rows.length%50===0)console.log(rows.length);
 }
}));
rows.sort((a,b)=>a.close.localeCompare(b.close));
writeFileSync(path,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
let total=0,peak=0,drawdown=0;
for(const r of rows){total+=r.units;peak=Math.max(peak,total);drawdown=Math.max(drawdown,peak-total);}
console.log({count:rows.length,total,avg:total/rows.length,drawdown,full:rows.filter(r=>r.yes===100&&r.no===100).length,loss:rows.filter(r=>r.units<0).length,distribution:Object.fromEntries([...new Set(rows.map(r=>r.units))].map(u=>[u,rows.filter(r=>r.units===u).length]))});

async function studyFills(m){
 const start=Date.parse(m.open_time)/1000,end=Date.parse(m.close_time)/1000;
 const candles=(await get('/series/KXBTC15M/markets/'+m.ticker+'/candlesticks?start_ts='+start+'&end_ts='+end+'&period_interval=1')).candlesticks;
 const byEnd=new Map(candles.map(c=>[c.end_period_ts,c]));
 const legs=[0,0];
 for(let side=0;side<2;side++){
   const windows=[];
   for(let e=start+60;e<=end;e+=60){
     const c=byEnd.get(e);
     const extreme=side?c?.price?.high_dollars:c?.price?.low_dollars;
     if(extreme==null || (side?+extreme>.6:+extreme<.4))windows.push({e,rank:extreme==null?0:side?1-extreme:+extreme});
   }
   windows.sort((a,b)=>a.rank-b.rank);
   for(const {e} of windows){
     let cursor='';
     do{
       const page=await get('/markets/trades?ticker='+m.ticker+'&min_ts='+(e-60)+'&max_ts='+e+'&limit=1000&cursor='+encodeURIComponent(cursor));
       for(const t of page.trades){
         const ts=Date.parse(t.created_time)/1000;
         if(t.is_block_trade||ts<e-60||ts>=e)continue;
         if(side?t.taker_side==='yes'&&+t.no_price_dollars<.4:t.taker_side==='no'&&+t.yes_price_dollars<.4)legs[side]=Math.min(100,legs[side]+Number(t.count_fp));
       }
       cursor=page.cursor;
     }while(cursor && legs[side]<100);
     if(legs[side]>=100)break;
   }
 }
 return {yes:legs[0],no:legs[1]};
}
