import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const out='output/ai-upgrade';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.argv[2]||'http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);await page.locator('#start-btn').click();
 const report=await page.evaluate(()=>{
  const {game,world,g,render}=window.__gameTest,out=[],temporary=[];
  const ok=(name,pass,detail)=>out.push({name,pass:!!pass,detail:detail===undefined?undefined:JSON.parse(JSON.stringify(detail))});
  function fresh(x=0,z=12){for(const s of temporary){s.active=false;s.group.visible=false;}game.reset();game.start();game.enemies.forEach(r=>{r.alive=false;r.group.visible=false;});Object.assign(game.player,{x,y:0,z,hp:100,alive:true,invuln:0,vx:0,vz:0});game.combat.clearEffects();game.state.time=0;}
  function spawn(x=0,z=0,type='shooter'){const r=game.ai.spawn(x,z,null,type,true);r.id=0;return r;}
  function run(seconds,fire=game.combat){for(let i=0;i<Math.ceil(seconds*120);i++){game.state.time+=1/120;game.ai.update(1/120,game.state.time,fire);}}
  function wall(x,z,w,d,h=3){const s=world.solid(x,z,w,d,h,0xf3e6d0);temporary.push(s);return s;}
  // First-sighting reaction and firing cadence are tested independently of projectile damage.
  fresh();const shooter=spawn(),shots=[];const mock={hurt:game.combat.hurt,enemyFire:(r,seen)=>{shots.push({time:game.state.time,seen:{...seen}});return true;}};
  run(.4,mock);ok('new sighting retains about half a second of reaction',shots.length===0&&shooter.reaction>0,{reaction:shooter.reaction});
  run(.25,mock);ok('first shot occurs after reaction, never instantly',shots.length===1&&shots[0].time>=.47&&shots[0].time<.56,shots);
  run(3.5,mock);const intervals=shots.slice(1).map((s,i)=>s.time-shots[i].time);ok('shooter firing intervals stay within 0.85–1.1 seconds',intervals.length>=3&&intervals.every(d=>d>=.84&&d<=1.11),intervals);
  fresh(0,19);const ranged=spawn();run(.56);ok('shooter can engage beyond old 14 metre range',game.combat.bullets.length>0,{gap:Math.hypot(ranged.x-game.player.x,ranged.z-game.player.z),bullets:game.combat.bullets.length});
  const shot=game.combat.bullets[0];ok('enemy projectile speed is 28 and damage stays 8',shot&&Math.abs(shot.velocity.length()-28)<1e-9&&shot.w.damage===8,shot&&{speed:shot.velocity.length(),damage:shot.w.damage});
  fresh(0,22);const outside=spawn();run(.56);ok('enemy never shoots outside twenty metre range',game.combat.bullets.length===0&&outside.aiMode==='advance',{mode:outside.aiMode,bullets:game.combat.bullets.length});
  fresh();const predict=spawn();game.state.time=.75;game.player.vx=9;const observed={x:0,y:0,z:12,vx:9,vz:0};game.combat.enemyFire(predict,observed);const predicted=game.combat.bullets[0];const atTarget=predicted&&predicted.pos.x+predicted.velocity.x/predicted.velocity.z*(12-predicted.pos.z);
  ok('enemy uses bounded movement prediction',Number.isFinite(atTarget)&&atTarget>.5&&atTarget<3.7,{atTarget});
  game.combat.clearEffects();game.state.time=1.13;game.combat.enemyFire(predict,observed);const variant=game.combat.bullets[0];const atVariant=variant&&variant.pos.x+variant.velocity.x/variant.velocity.z*(12-variant.pos.z);
  ok('aim error varies rather than guaranteeing identical perfect shots',Number.isFinite(atVariant)&&Math.abs(atTarget-atVariant)>.025,{atTarget,atVariant});
  game.combat.clearEffects();game.combat.enemyFire(predict,{x:0,y:0,z:12,vx:Infinity,vz:NaN});ok('invalid observed velocities cannot create invalid projectiles',game.combat.bullets.length===1&&game.combat.bullets[0].velocity.toArray().every(Number.isFinite));
  fresh();const memory=spawn();run(.1,mock);const remembered={...memory.lastSeen};wall(0,7,8,.6);Object.assign(game.player,{x:1,z:13,vx:9,vz:8});run(.7,mock);
  ok('hidden player does not refresh last seen position or velocity',memory.lastSeen?.x===remembered.x&&memory.lastSeen?.z===remembered.z&&memory.lastSeen?.vx===remembered.vx&&memory.lastSeen?.time===remembered.time,{remembered,lastSeen:memory.lastSeen});
  ok('search target uses remembered location',memory.aiMode==='search'&&memory.target.x===remembered.x&&memory.target.z===remembered.z,{mode:memory.aiMode,target:memory.target});
  Object.assign(game.player,{x:18,z:18,vx:-9});run(1,mock);ok('hidden movements cannot redirect pursuit',memory.target.x===remembered.x&&memory.target.z===remembered.z,memory.target);
  run(1.4,mock);ok('blind memory expires after at most three seconds',memory.lastSeen===null&&memory.alert===0&&['patrol','return'].includes(memory.aiMode),{mode:memory.aiMode,alert:memory.alert,time:game.state.time});
  fresh();wall(0,6,8,.6);const blocked=spawn();run(2);ok('walls prevent acquisition and attacks',blocked.lastSeen===null&&game.combat.bullets.length===0);
  fresh();const clipped=spawn();clipped.yaw=0;clipped.group.rotation.y=0;wall(.39,-.8,1,.2);const emitted=game.combat.enemyFire(clipped);ok('blocked body to muzzle cannot emit a through-wall shot',!emitted&&game.combat.bullets.length===0);
  fresh();const guarded=spawn();run(.6);game.player.invuln=2.5;game.combat.clearEffects();run(1);ok('respawn protection stops attacks and clears targeting memory',guarded.lastSeen===null&&game.combat.bullets.length===0&&game.player.hp===100);
  game.combat.hurt(game.player,8,{x:0,z:0});ok('protected player takes no enemy damage',game.player.hp===100);
  fresh();Object.assign(game.player,{x:-31,z:26});const covered=spawn(-30,19),modes=new Set(),coverPhases=new Set();let coverPicked=null;
  for(let i=0;i<1200;i++){run(1/120,mock);modes.add(covered.aiMode);if(covered.coverPhase)coverPhases.add(covered.coverPhase);if(covered.cover)coverPicked={hide:covered.cover.hide,peek:covered.cover.peek};}
  ok('shooter chooses reachable actual cover',!!coverPicked,coverPicked);
  ok('cover behavior includes seeking, hiding and peeking',coverPhases.has('seek')&&coverPhases.has('hide')&&coverPhases.has('peek'),[...coverPhases]);
  fresh();const flank=spawn();run(.8,mock);ok('open-ground shooter advances on a lateral angle',flank.aiMode==='flank'&&Math.abs(flank.target.x)>1,{mode:flank.aiMode,target:flank.target});
  fresh(0,3);const retreat=spawn();run(.2,mock);ok('close shooter keeps distance rather than charging',retreat.aiMode==='retreat'&&Math.hypot(retreat.target.x-game.player.x,retreat.target.z-game.player.z)>8,retreat.target);
  fresh();const chargeA=spawn(-1,0,'charger'),chargeB=spawn(1,0,'charger');chargeA.id=2;chargeB.id=3;run(.1,mock);
  ok('chargers use separate approach lanes',chargeA.target.x*chargeB.target.x<0&&Math.abs(chargeA.target.x-chargeB.target.x)>3,{a:chargeA.target,b:chargeB.target});
  ok('AI health remains 54 shooter and 45 charger',flank.maxHp===54&&chargeA.maxHp===45,{shooter:flank.maxHp,charger:chargeA.maxHp});
  fresh();const melee=spawn(0,10.6,'charger'),hits=[];const meleeMock={enemyFire:()=>true,hurt:(r,d)=>hits.push({time:game.state.time,damage:d})};run(.3,meleeMock);ok('charger also honors first-sighting reaction',hits.length===0);run(.4,meleeMock);ok('charger retains twelve-damage attack',hits.length===1&&hits[0].damage===12,hits);
  fresh(0,46);game.ai.populate();run(10);ok('camp patrols stay local and do not hunt safe starting spawn',game.enemies.every(r=>Math.hypot(r.x-r.home.x,r.z-r.home.z)<7&&r.lastSeen===null)&&game.player.hp===100);
  fresh();const timed=spawn();game.state.time=4;game.combat.hurt(timed,18,{x:0,z:12});ok('damage sets temporary 1.6 second health visibility window',timed.hp===36&&Math.abs(timed.healthUntil-5.6)<1e-9,{hp:timed.hp,healthUntil:timed.healthUntil});
  function accuracy(moving){
   fresh(0,16);const r=spawn();r.yaw=Math.PI;r.group.rotation.y=-Math.PI;r.group.updateMatrixWorld(true);game.player.hp=1000;let shots=0,next=.5;
   for(let i=0;i<3600;i++){
    game.state.time+=1/120;const t=game.state.time;game.player.x=moving?5*Math.sin(t*.8):0;game.player.vx=moving?4*Math.cos(t*.8):0;
    if(t>=next){if(game.combat.enemyFire(r,{x:game.player.x,y:0,z:16,vx:game.player.vx,vz:0}))shots++;next+=.9;}
    game.combat.update(1/120);
   }
   return {shots,hits:(1000-game.player.hp)/8,damage:1000-game.player.hp};
  }
  const stationary=accuracy(false),moving=accuracy(true);
  ok('stationary uncovered player experiences meaningful shooting pressure',stationary.shots>=30&&stationary.hits>=stationary.shots*.8,stationary);
  ok('continuously moving player is hittable but does not face perfect aim',moving.hits>0&&moving.hits<moving.shots*.9&&moving.hits<stationary.hits,{stationary,moving});
  // Leave a genuine rendering of the tougher town encounter for visual inspection.
  fresh(-31,26);game.ai.populate();game.camera.state.yaw=0;game.camera.state.pitch=-.1;run(.9);game.camera.update(0,false,true);render();return out;
 });
 fs.writeFileSync(out+'/report.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify(report,null,2));await page.screenshot({path:out+'/town-encounter.png'});assert.deepEqual(report.filter(r=>!r.pass),[]);assert.deepEqual(errors,[]);console.log('PASS AI upgrade',report.length);
}catch(error){console.error(error);process.exitCode=1;}finally{await page.close();await browser.close();}
