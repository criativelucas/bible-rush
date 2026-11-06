// Runtime regressions without WebGL: execute the real functions with visual effects stubbed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as C from './src/content.js';
import { nextHordeScale } from './src/sim.js';
const source = fs.readFileSync(new URL('./src/main.js', import.meta.url), 'utf8');
const fn = name => source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))[0];
const noop = () => {};
let passed = 0;
function test(name, run) { run(); passed++; console.log(`ok - ${name}`); }

test('timeout ends the frame before regeneration or combat', () => {
  const c=vm.createContext({time:0,state:'play',M:{shared:{uTime:{}}},updateSky:noop,
    tower:{clear:false,left:0},P:{hp:100,st:{revives:1}},toast:noop,
    updatePlayer:()=>assert.fail('regeneration must not run after timeout')});
  vm.runInContext(fn('towerDirector')+'\n'+fn('step')+"\nfunction startDeath(){state='dying'}; function director(dt){towerDirector(dt)}; step(1/30)",c);
  assert.equal(c.state,'dying'); assert.equal(c.P.hp,0); assert.equal(c.P.st.revives,0);
});
test('Tower record stores floor independently of elapsed time', () => {
  const profile={records:{babel:{best:900,bestFloor:2}}};
  const c=vm.createContext({BABEL:true,profile,tower:{n:3},HEROES:C.HEROES,P:{hero:'davi'},time:180,SURV:false,BIOME_ID:'babel',endScreen:noop});
  vm.runInContext(fn('die')+'\ndie();',c);
  vm.runInContext(source.match(/  const recordKey =[^]*?  if \(won\) rec.fastest/)[0].replace(/  if \(won\) rec.fastest$/,''),c);
  assert.equal(profile.records.babel.bestFloor,3); assert.equal(profile.records.babel.bestSeconds,180);
});
test('a reserved weapon cannot be evolved by a second chest', () => {
  const w={id:'funda',level:5}; const relics=[{id:'pedras'}];
  assert.equal(C.readyToEvolve([w],relics).length,1);
  w.evolving=true; assert.equal(C.readyToEvolve([w],relics).length,0);
  const c=vm.createContext({w,WEAPONS:C.WEAPONS,EVOLUTIONS:C.EVOLUTIONS,RELICS:C.RELICS,MAX_LEVEL:5,refreshWeapons:noop,banner:noop,ICON:{weapon:{}},award:noop,burst:noop,chord:noop,P:{pos:{x:0,y:0,z:0}}});
  vm.runInContext(fn('evolve')+'\nevolve(w);evolve(w);',c);
  assert.equal(w.id,'funda_evo'); assert.equal(w.evolving,false);
});
test('Davi fifth projectile is 5x without a forced critical', () => {
  const fields=['x','y','z','speed','life','bounce','pierce','last','dmg','seek','size','kind','crit','ret','glow','burn','src'];
  const S={n:0,...Object.fromEntries(fields.map(k=>[k,new Float64Array(10)]))};
  const E={type:[0],elite:[0],hp:[1000],engaged:[-1],lc:[0],flash:[0],x:[0],y:[0],z:[0],h:[1.6]};
  const P={hero:'davi',shotCount:4,pos:{x:0,y:0,z:0},psalms:[],st:{crit:0.05,critDmg:0,burn:0},dmgBy:{}};
  const c=vm.createContext({S,E,P,MAX_SHOTS:600,aimShot:noop,PROJ:['stone'],srcSlot:0,ENEMIES:C.ENEMIES,globalDmg:()=>1,dmgSrc:'funda',random:()=>0.9,dmgNumber:noop,burst:noop,time:0,lastHitSound:0,s:C.weaponStats('funda',1,C.baseStats(C.HEROES.davi))});
  vm.runInContext(fn('fireShot')+'\n'+fn('damage')+'\nfireShot(s,0,0);damage(0,S.dmg[0],0,0,0,S.crit[0]>0);',c);
  assert.equal(E.hp[0],940); assert.equal(E.engaged[0],0);
});
test('large swarms keep finite positions with more units than target slots', () => {
  const E={n:30,hp:Array(30).fill(1),x:Array.from({length:30},(_,i)=>i/2),z:Array(30).fill(0)};
  const c=vm.createContext({E,targets:new Int32Array(16),targetD:new Float32Array(16),P:{pos:{x:0,z:0}},time:0,terrainH:()=>0,hitArea:noop,swarmDraw:[],w:{timer:0},s:{count:32,cd:0.3,speed:10,radius:2,dmg:5}});
  vm.runInContext(fn('nearestEnemies')+'\n'+fn('updateSwarms')+'\nupdateSwarms(w,s,1/30);',c);
  assert.equal(c.w.swarm.length,32);
  assert.ok(c.w.swarm.every(s=>[s.x,s.z,s.vx,s.vz].every(Number.isFinite)));
});
test('movement remains positive after repeated slow pacts', () => {
  const P={st:C.baseStats(C.HEROES.davi),mods:{},hp:100};
  const c=vm.createContext({P,refreshWeapons:noop,award:noop,toast:noop,pc:C.PACTS.find(p=>p.good[0]==='regen')});
  vm.runInContext(fn('applyPact')+'\nfor(let i=0;i<10;i++) applyPact(pc);',c);
  assert.equal(P.st.speed,-0.75);
});
test('adaptive pressure freezes on stale/insufficient samples and changes gradually', () => {
  assert.equal(nextHordeScale(2,0,60,0,0),2);
  assert.equal(nextHordeScale(2,0,60,100,11),2);
  assert.equal(nextHordeScale(2,6,30,100,0),2);
  assert.ok(Math.abs(nextHordeScale(2,0,30,100,0)-2.2)<1e-10);
  assert.ok(nextHordeScale(2,12,30,100,0)<2);
  assert.equal(nextHordeScale(8,0,30,100,0),8);
  assert.equal(nextHordeScale(1,12,30,100,0),1);
});
test('capped cooldown and critical scrolls are not offered', () => {
  const list=C.rollOffers({weapons:[],luck:0,stats:{cd:0.6,crit:1}},()=>0.5,100);
  assert.ok(!list.some(o=>o.kind==='scroll'&&['prontidao','precisao'].includes(o.id)));
});
test('free chests count in the payout', () => {
  const line=source.match(/  const pay = runDenarios\([^\n]+/)[0];
  const c=vm.createContext({runDenarios:C.runDenarios,time:0,P:{kills:0,chests:3},stonesDone:0,chestsOpened:0,won:false});
  assert.equal(vm.runInContext(line+'\npay.total',c),15);
});
test('floor transition removes all state of an abandoned secret boss', () => {
  const pos={set:noop};
  const mapFoe={model:'ninrode'};
  const c=vm.createContext({boss:{spawned:true,idx:5},bossRig:{group:{visible:true}},$:()=>({hidden:false}),FOE:{model:'serpente'},MAP_FOE:mapFoe,KIT:{},BOSS_KITS:{ninrode:{}},hordeK:4,
    tower:{layout:'trono'},floorTime:C.floorTime,floorGoal:C.floorGoal,world:{door:{set:noop},towerFloor:()=>({fire:false})},TOWER_LAYOUTS:C.TOWER_LAYOUTS,
    random:()=>0,E:{n:1},EP:{n:3},hazards:[1],clearBossFx:noop,G:{n:0},reindexObstacles:noop,FLOOR_MAPS:C.FLOOR_MAPS,MOB_TYPES:[],B:{},BIOMES:C.BIOMES,
    terrainH:()=>0,obstacles:[],P:{pos,vel:{set:noop}},heroRig:null,banner:noop,chord:noop});
  vm.runInContext(fn('towerFloorStart')+'\ntowerFloorStart(2);',c);
  assert.equal(c.E.n,0);assert.equal(c.boss.spawned,false);assert.equal(c.boss.idx,-1);
  assert.equal(c.bossRig.group.visible,false);assert.equal(c.FOE,mapFoe);assert.equal(c.hordeK,1);
});
test('legacy Tower seconds are not migrated into a fake floor record', () => {
  const old={records:{babel:{best:900}},trophies:{babel:1}};
  const migrated=C.migrateProfile(old);
  assert.equal(migrated.records.babel.bestFloor,10);
  assert.equal(old.records.babel.bestFloor,undefined);
  assert.deepEqual(C.migrateProfile(migrated),migrated);
  assert.equal(C.migrateProfile({records:{babel:{best:180}},pending:[{p_mode:'babel',p_floor:3}]}).records.babel.bestFloor,3);
});
test('new Arsenal weapons stay locked until purchased, then can evolve', () => {
  const fresh=C.migrateProfile({v:C.PROFILE_VERSION,trophies:{inicio:1}});
  const ids=['espada','incensario','rolo'];
  for (const id of ids) assert.ok(C.lockedWeapons(fresh).has(id));
  const locked=C.rollOffers({weapons:[],luck:0,locked:C.lockedWeapons(fresh)},()=>0.5,100);
  assert.ok(!locked.some(o=>ids.includes(o.id)));
  for (const id of ids) {
    const purchased=C.migrateProfile({...fresh,unlocked:[`weapon:${id}`]});
    const offers=C.rollOffers({weapons:[],luck:0,locked:C.lockedWeapons(purchased)},()=>0.5,100);
    assert.ok(offers.some(o=>o.kind==='weapon'&&o.id===id));
    const evo=C.EVOLUTIONS[id];
    assert.ok(C.openSet(fresh).has(`relic:${evo.needs}`));
    assert.equal(C.readyToEvolve([{id,level:4}],[{id:evo.needs}]).length,0);
    assert.equal(C.readyToEvolve([{id,level:5}],[{id:evo.needs}]).length,1);
    const st=C.baseStats(C.HEROES.davi);
    const base=C.weaponStats(id,5,st), evolved=C.weaponStats(evo.into,5,st);
    const throughput=w=>w.dmg*(w.count||1)/w.cd;
    const ratio=throughput(evolved)/throughput(base);
    assert.ok(ratio>1 && ratio<2.5,`${id}: evolution should be a useful, bounded improvement`);
  }
});
test('incense slows nearby living common enemies, never bosses or distant targets', () => {
  const E={hp:[100,100,0,100],type:[0,C.BOSS,0,0],x:[1,1,1,20],z:[0,0,0,0],y:[0,0,0,0],r:[0.4,1.4,0.4,0.4],h:[2,4.6,2,2],slow:[0,0,0,0]};
  const hits=[];
  const c=vm.createContext({E,ENEMIES:C.ENEMIES,MAX_R:1.4,near:[0,1,2,3],hash:{query:()=>4},damage:(i)=>hits.push(i)});
  vm.runInContext(fn('hitArea')+'\nhitArea(0,1,0,4,5,0,0,0,0.35);',c);
  assert.deepEqual(hits,[0,1]);
  assert.deepEqual(E.slow,[0.35,0,0,0]);
  E.slow[0]=2;
  vm.runInContext('hitArea(0,1,0,4,5,0,0,0,0.35);',c);
  assert.equal(E.slow[0],2,'incense must not shorten a stronger active slow');
});
test('new relic bonuses scale with rarity and survive profile export', () => {
  for (const id of ['la','amendoeira','selo']) {
    const relic=C.RELICS[id];
    const st=C.baseStats(C.HEROES.davi), before=st[relic.stat];
    C.applyEntry(st,relic,4);
    assert.ok(Math.abs(st[relic.stat]-before-relic.base*5)<1e-10);
  }
  const profile=C.migrateProfile({v:C.PROFILE_VERSION,unlocked:['weapon:espada','weapon:incensario','weapon:rolo'],mastery:{espada:2},bestiary:{r:{la:1,amendoeira:1,selo:1}}});
  assert.deepEqual(C.importCode(C.exportCode(profile)),profile);
  assert.equal(C.masteryOf(profile,'espada_evo'),2);
});
test('Elias unlocks from existing dawn trophies and has a complete animated model', () => {
  assert.ok(!C.openSet({}).has('hero:elias'));
  assert.ok(C.openSet({trophies:{noite:1}}).has('hero:elias'));
  const st=C.baseStats(C.HEROES.elias);
  assert.equal(st.maxHp,95);assert.equal(st.burn,0.15);assert.equal(st.faith,0.2);
  assert.equal(C.HEROES.elias.weapon,'brasas');
  assert.equal(C.readyToEvolve([{id:'brasas',level:5}],[{id:'manto'}]).length,1);
  const glb=fs.readFileSync(new URL('./assets/models/heroes/elias.glb',import.meta.url));
  assert.equal(glb.toString('utf8',0,4),'glTF');
  const model=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
  const clips=new Set(model.animations.map(a=>a.name.split('|').at(-1)));
  for(const name of ['idle','walk','attack','cast','jump','slide']) assert.ok(clips.has(name),name);
  assert.ok(model.skins.length>0 && model.meshes.length>0);
});
test('Elias special move applies burn and miracle spends faith once', () => {
  const P={hero:'elias',dashT:0.3,dashId:1,dashX:1,dashZ:0,pos:{x:0,y:0,z:0},fe:100,miracles:0};
  const E={mark:[0],hp:[100],x:[1],y:[0],z:[0],r:[0.4],burn:[0]};
  const strikes=[];
  const c=vm.createContext({P,E,hash:{query:()=>1},near:[0],MAX_R:1.4,damage:noop,ember:noop,ENEMIES:C.ENEMIES,
    flash:noop,yaw:0,terrainH:()=>0,nearestEnemies:()=>1,targets:[0],addStrike:(...args)=>strikes.push(args),toast:noop,burst:noop,chord:noop});
  vm.runInContext(fn('dashHits')+'\n'+fn('useMiracle')+'\ndashHits();useMiracle();useMiracle();',c);
  assert.equal(E.burn[0],2);assert.equal(P.fe,0);assert.equal(P.miracles,1);
  assert.equal(strikes.length,12);assert.ok(strikes.every(s=>s[5]===1&&s[6]===3));
});
test('Gideão, Daniel, Monte Carmelo and Babilônia unlock and ship their own models', () => {
  const glbJson=(path)=>{const b=fs.readFileSync(new URL(path,import.meta.url));assert.equal(b.toString('utf8',0,4),'glTF',path);return JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));};
  for (const [hero,trophy] of [['gideao','ungido'],['daniel','carmelo']]) {
    assert.ok(!C.openSet({}).has(`hero:${hero}`));assert.ok(C.openSet({trophies:{[trophy]:1}}).has(`hero:${hero}`));
    const clips=new Set(glbJson(`./assets/models/heroes/${hero}.glb`).animations.map(a=>a.name.split('|').at(-1)));
    for(const name of ['idle','walk','attack','cast','jump','slide']) assert.ok(clips.has(name),`${hero} ${name}`);
  }
  assert.ok(Math.abs(C.baseStats(C.HEROES.gideao).crit-0.15)<1e-9);assert.equal(C.baseStats(C.HEROES.daniel).rerolls,2);
  assert.equal(C.readyToEvolve([{id:'escrita',level:5}],[{id:'candelabro'}]).length,1);
  const mobs=new Set(glbJson('./assets/models/mobs.glb').nodes.map(n=>n.name));
  for (const [map,trophy] of [['carmelo','valentes'],['babilonia','relicario']]) {
    assert.ok(C.openSet({trophies:{[trophy]:1}}).has(`map:${map}`));
    for (const t of C.MOB_TYPES) assert.ok(mobs.has(`mob_${t}_${map}`),`mob_${t}_${map}`);
    for (const model of [C.BIOMES[map].bossModel,C.SECRET_BOSSES[map].model]) assert.ok(glbJson(`./assets/models/bosses/${model}.glb`).skins.length,model);
    assert.equal(C.BEAST_NAMES[map].length,12);
  }
});
test('Ester, the new enemies, the mini-bosses and the 20% larger maps', () => {
  assert.ok(C.openSet({trophies:{salomao:1}}).has('hero:ester'));
  const st=C.baseStats(C.HEROES.ester);assert.equal(st.gold,0.25);assert.equal(st.area,0.1);
  assert.equal(C.readyToEvolve([{id:'cetro',level:5}],[{id:'anel'}]).length,1);
  const b=fs.readFileSync(new URL('./assets/models/heroes/ester.glb',import.meta.url));assert.equal(b.toString('utf8',0,4),'glTF');
  for (const t of [9,10,11,12]) assert.ok(C.MOB_TYPES.includes(t));
  assert.ok(C.ENEMIES[9].lobber && C.ENEMIES[10].healer && C.ENEMIES[11].mini && C.ENEMIES[12].mini);
  assert.equal(C.spawnWeights(600)[11],0,'mini-bosses only come by event');assert.ok(C.spawnWeights(600)[9]>0&&C.spawnWeights(600)[10]>0);
  for (const [id,bm] of Object.entries(C.BIOMES)) { assert.ok(bm.radius>=144,id); assert.equal(C.BEAST_NAMES[id].length,12,id); }
});
// Offline retry: use the real module with a mocked network; never contact the production server.
const previousFetch=globalThis.fetch;
let fail=true;
globalThis.fetch=async()=>({ok:!fail,status:fail?400:200,json:async()=>fail?{message:'partidas sobrepostas'}:'ok'});
try {
  const {flushPending,submitRun}=await import('./src/online.js');
  const profile={pid:'test',name:'Tester',pending:[{p_seconds:300}]};
  await flushPending(profile); assert.equal(profile.pending.length,1);
  fail=false; await flushPending(profile); assert.equal(profile.pending.length,0);
  passed++; console.log('ok - overlapping offline submissions stay queued until accepted');
  globalThis.fetch=async()=>({ok:false,status:400,json:async()=>({message:'dados inválidos'})});
  const next={pid:'test',name:'Tester',pending:[]};
  const result=await submitRun(next,{hero:'elias',map:'ela',mode:'classic',diff:0,kills:0,seconds:60,won:false});
  assert.match(result,/aguardando atualização/);assert.equal(next.pending.length,1);
  await flushPending(next);assert.equal(next.pending.length,1);
  globalThis.fetch=async()=>({ok:true,json:async()=>'ok'});
  await flushPending(next);assert.equal(next.pending.length,0);
  passed++; console.log('ok - Elias runs survive an outdated server and submit after migration');
} finally { globalThis.fetch=previousFetch; }
console.log(`${passed} regression checks passed`);
