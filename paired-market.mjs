const api='https://external-api.kalshi.com/trade-api/v2';
export async function get(path){
  for(let i=0;i<12;i++){
    const r=await fetch(api+path,{signal:AbortSignal.timeout(20000)});
    if(r.ok)return r.json();
    if(r.status!==429)throw Error('HTTP '+r.status);
    await new Promise(resolve=>setTimeout(resolve,Math.min(30000,1500*2**i)+Math.random()*1000));
  }
  throw Error('Rate limited');
}
export async function pairedFills(m){
  let yes=0,no=0,cursor='';
  do{
    const page=await get('/markets/trades?ticker='+m.ticker+'&limit=1000&cursor='+encodeURIComponent(cursor));
    for(const t of page.trades){
      if(t.is_block_trade || Date.parse(t.created_time)<Date.parse(m.open_time) || Date.parse(t.created_time)>=Date.parse(m.close_time))continue;
      // Strict trade-through only. Ignore prints exactly at our limit.
      if(t.taker_side==='no' && +t.yes_price_dollars<.4)yes=Math.min(100,yes+Number(t.count_fp));
      if(t.taker_side==='yes' && +t.no_price_dollars<.4)no=Math.min(100,no+Number(t.count_fp));
    }
    cursor=page.cursor;
  }while(cursor && (yes<100 || no<100));
  return {yes,no};
}

