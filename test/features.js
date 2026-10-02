const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
async function run() {
  const node = {querySelector:()=>({}),querySelectorAll:()=>[]};
  const delivered=[];
  function Notification(title) { delivered.push(title); }
  Notification.permission='granted';
  let game={id:'1',away:{id:'2',abbreviation:'BOS',score:90},home:{id:'3',abbreviation:'NYK',score:91},status:{state:'pre',period:0,clock:''}};
  let stale=false;
  const context=vm.createContext({window:{Notification},Notification, URL,Date,Map,Set,
    escapeHtml:String,document:{querySelector:()=>node},hubState:{teams:[],favoriteTeam:'',notifications:{tipoff:true,close:true,final:true}},transactionState:{data:[]},
    dateValue:()=> '2026-09-12',setInterval:()=>{},fetchApi:async()=>({json:async()=>({games:[game]}),headers:{get:()=>stale?'stale':null}})});
  let script=fs.readFileSync(require('node:path').join(__dirname,'../public/features.js'),'utf8');
  script=script.replace('window.CourtsideFeatures={favorite,timeline}', 'window.CourtsideFeatures={favorite,timeline,poll,status,safeUrl}');
  vm.runInContext(script,context);
  const features=context.window.CourtsideFeatures;
  context.hubState.favoriteTeam='2';
  await features.poll();assert.equal(delivered.length,0,'initial load must not alert');
  game={...game,status:{state:'in',period:1,clock:'12:00'}};
  await features.poll();assert.deepEqual(delivered,['Tip-off']);
  game={...game,status:{state:'in',period:4,clock:'4:30'}};
  stale=true;await features.poll();assert.equal(delivered.length,1,'cached updates must not alert');
  stale=false;await features.poll();await features.poll();assert.equal(delivered.length,2,'close game alerts once');
  game={...game,status:{state:'post',completed:true}};
  await features.poll();await features.poll();assert.equal(delivered.length,3,'final alerts once');
  assert.equal(features.status({verification:{status:'matched'}}),'reported');
  assert.equal(features.status({verification:{status:'confirmed',source:'ESPN public transactions'}}),'confirmed');
  assert.equal(features.status({url:'https://www.nba.com/news/trades',verification:{status:'confirmed',source:'NBA trade tracker'}}),'official');
  assert.equal(features.safeUrl('javascript:alert(1)'),'');
  console.log('✓ Alert transitions, deduplication, stale suppression, verification categories, and source links verified');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
