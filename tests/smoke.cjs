'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const script=source.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script); // Syntax check for the exact shipped bundle.
const storage=new Map();
function context(){
 const nodes=new Map();
 function el(){return {style:{},dataset:{},classList:{add(){},remove(){},toggle(){},contains(){return false}},innerHTML:'',textContent:'',append(){},appendChild(){},replaceChildren(){},focus(){},click(){},querySelector(){return el()},querySelectorAll(){return []},getContext(){return new Proxy({},{get:()=>()=>{},set:()=>true})}}}
 const doc={getElementById(id){if(!nodes.has(id))nodes.set(id,el());return nodes.get(id)},querySelectorAll(){return []},createElement:el,body:el(),activeElement:el(),hidden:false,addEventListener(){}};
 let seed=20260911;const math=Object.create(Math);math.random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const ctx={document:doc,console,Math:math,Date,performance:{now:()=>0},requestAnimationFrame(){},setTimeout(){return 1},clearTimeout(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},addEventListener(){}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(script,ctx);return ctx;
}
let c=context();const run=code=>vm.runInContext(code,c,{timeout:10000});
run("state.started=true; rt.offline=true; state.gold=321; state.scrap=77; save()");
c=context();assert.equal(run('state.gold'),321);assert.equal(run('state.scrap'),77);
assert.equal(run("validate({...fresh(),gold:-1,base:99,zone:99,mod:99}).gold"),0);
assert.equal(run("validate({...fresh(),base:99}).base"),6);
assert.equal(run("state=fresh();state.started=true;resetRuntime();offlineProgress(999999).seconds"),28800);
assert.equal(run('state.spins'),0);assert.equal(run('state.totalKills'),0);
run('state=fresh();state.started=true;resetRuntime();rt.offline=true;for(let a=0;a<5;a++)for(let b=0;b<5;b++)for(let d=0;d<5;d++){spawn();rt.roll={time:1.12,target:[a,b,d]};settleSpin()}');
assert.equal(run('state.spins'),125);assert.equal(run('state.energy'),5);assert.ok(run('state.work<=100&&state.gold>0&&state.scrap>0'));
run(`state=fresh();state.started=true;resetRuntime();rt.offline=true;spawn();
for(let step=0;step<48000;step++){
 let z=state.zone;if(canBuild())startBuild();
 if(state.base>=1){let target={weapon:[9,18,26][z],armor:[6,13,21][z],charm:[3,6,8][z]};for(let k of ['weapon','armor','charm']){let p=cost(k);if(state.up[k]<target[k]&&state.gold>=p.g&&state.scrap>=p.s)upgrade(k)}}
 if(state.bosses>state.zone&&state.zone<2)changeZone(state.zone+1);
 if(!rt.boss&&state.bosses===state.zone&&state.kills[state.zone]>=ZONES[state.zone].need&&atk()>[40,170,500][state.zone]&&maxHP()>[250,650,1500][state.zone])challenge();
 state.mode=rt.boss?'hunt':'build';tick(.1);if(state.base===6)break;
}`);
assert.equal(run('state.base'),6);assert.equal(run('state.bosses'),3);assert.equal(run('state.cores'),0);
run('rt.launch=0;for(let i=0;i<100;i++)tick(.1)');assert.equal(run('state.launched'),true);assert.equal(run('state.base'),6);
console.log('PASS: bundle syntax, save roundtrip (mock storage), validation, offline cap, all 125 slot results, zero-cheat full progression and rocket launch');
console.log(run('JSON.stringify({seconds:Math.round(state.playtime),spins:state.spins,kills:state.totalKills,base:state.base,bosses:state.bosses})'));
