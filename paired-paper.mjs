import {existsSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {get,pairedFills} from './paired-market.mjs';
const file='paired-paper.json';
const state=existsSync(file)?JSON.parse(readFileSync(file)): {start:new Date().toISOString(),rows:[]};
function save(){
  writeFileSync(file+'.tmp',JSON.stringify(state,null,2));
  renameSync(file+'.tmp',file);
}
save();
async function update(){
  const known=new Set(state.rows.map(r=>r.ticker));
  let cursor='';
  do{
    const page=await get('/markets?series_ticker=KXBTC15M&status=settled&limit=100&min_close_ts='+Math.floor(Date.parse(state.start)/1000)+'&cursor='+encodeURIComponent(cursor));
    for(const m of page.markets){
      if(known.has(m.ticker)||Date.parse(m.open_time)<Date.parse(state.start)||!['yes','no'].includes(m.result))continue;
      const {yes,no}=await pairedFills(m);
      const gross=(m.result==='yes'?yes:no)-.4*(yes+no);
      state.rows.push({ticker:m.ticker,close:m.close_time,result:m.result,yes,no,gross});
      known.add(m.ticker);save();
    }
    cursor=page.cursor;
  }while(cursor);
  const touched=state.rows.filter(r=>r.yes+r.no>0);
  const bothFull=touched.filter(r=>r.yes===100&&r.no===100);
  console.log('Since',state.start,'| settled:',state.rows.length,'| any fill:',touched.length,'| both full:',bothFull.length,'| gross USD:',state.rows.reduce((s,r)=>s+r.gross,0).toFixed(2));
}
do{
  try{await update();}catch(e){console.error(e.message);if(!process.argv.includes('--watch'))process.exit(1);}
  if(!process.argv.includes('--watch'))break;
  await new Promise(resolve=>setTimeout(resolve,60000));
}while(true);
