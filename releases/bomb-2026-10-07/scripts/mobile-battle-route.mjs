import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// Acceptance route: all game state reads are read-only; every action uses actual CDP touch events.
const out='output/mobile-battle-route';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const page=await context.newPage(),cdp=await context.newCDPSession(page),checks=[],events=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const camera=()=>page.evaluate(()=>({state:{...window.__gameTest.game.camera.state},position:window.__gameTest.g.camera.position.toArray()}));
const point=async(selector,id)=>{const r=await page.locator(selector).boundingBox();assert.ok(r,selector);return{id,x:r.x+r.width/2,y:r.y+r.height/2,radiusX:5,radiusY:5,force:1};};
const active=new Map();
async function start(p){active.set(p.id,p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[...active.values()]});}
async function move(p){active.set(p.id,p);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[...active.values()]});}
async function end(id){const p=active.get(id);if(!p)return;await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p]});active.delete(id);}
async function release(){if(!active.size)return;await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});active.clear();}
async function tap(selector){const p=await point(selector,9);await start(p);await end(9);}
function check(name,value,detail){checks.push({name,pass:!!value,detail});assert.ok(value,name+' '+JSON.stringify(detail??''));console.log('PASS',name);}
async function mode(){const s=await state();if(s.mode==='paused'){await release();await tap('#resume');events.push({resumed:s.time});}return s;}
async function look(yaw,pitch=-.08,fire=false,settle=10){
 await mode();const selector=fire?'#fire-button':null;
 for(let i=0;i<8;i++){
  const c=await camera();let dx=Math.atan2(Math.sin(yaw-c.state.yaw),Math.cos(yaw-c.state.yaw)),dy=pitch-c.state.pitch;
  if(Math.abs(dx)<.005&&Math.abs(dy)<.005)break;
  const s=await state(),factor=.005*(s.touch.aim?.6:1);
  let p=active.get(2);if(!p){p=selector?await point(selector,2):{id:2,x:530,y:195,radiusX:5,radiusY:5,force:1};await start(p);}
  // Finger movement stays inside the display and is segmented at the edge.
  const next={...p,x:Math.max(370,Math.min(824,p.x+Math.max(-1,Math.min(1,dx))/factor)),y:Math.max(165,Math.min(371,p.y-Math.max(-.55,Math.min(.55,dy))/factor))};
  if(Math.abs(next.x-p.x)<1&&Math.abs(next.y-p.y)<1){await end(2);continue;}
  await move(next);await advance(settle);
 }
 if(!fire)await end(2);
}
async function stick(dx=0,dy=-50){let p=active.get(1);if(!p){p=await point('#move-stick',1);await start(p);}const center=await point('#move-stick',1);await move({...p,x:center.x+dx,y:center.y+dy});}
async function walk(x,z){
 await end(2);await end(1);
 for(let i=0;i<150;i++){
  const s=await mode();if(!s.player.alive){await release();await advance(1600);continue;}
  const dx=x-s.player.x,dz=z-s.player.z,d=Math.hypot(dx,dz);if(d<.65){await end(1);await advance(60);return;}
  await look(Math.atan2(dx,-dz),-.08,false,7);await stick();await advance(Math.min(300,d/9*1000));
  const after=await state();if(i%12===0)console.log('walk',x,z,after.player.x,after.player.z,after.player.hp);
  if(i>2&&Math.hypot(after.player.x-s.player.x,after.player.z-s.player.z)<.07)throw new Error(`route blocked toward ${x},${z} at ${JSON.stringify(after.player)}`);
 }
 throw new Error('walk timeout '+x+','+z);
}
async function aimAt(x,y,z,fire=false,enemyId=null){
 for(let i=0;i<5;i++){
  if(enemyId!==null){const e=await page.evaluate(id=>{const e=window.__gameTest.game.enemies.find(e=>e.alive&&e.id===id);return e?{x:e.x+(e.vx||0)*.13,y:e.y+1,z:e.z+(e.vz||0)*.13}:null;},enemyId);if(!e)return;x=e.x;y=e.y;z=e.z;}
  const {position:p}=await camera(),dx=x-p[0],dz=z-p[2],dy=y-p[1];await look(Math.atan2(dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)),fire,enemyId===null?60:25);
 }
}
try{
 await page.goto(process.argv[2]||'http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);await tap('#start-btn');await advance(0);
 let s=await state();check('safe spawn starts from untouched game',s.player.x===0&&s.player.z===46&&s.player.hp===100,s.player);
 await stick();await tap('#jump-button');await advance(230);s=await state();check('jump via independent button while left thumb moves',s.player.y>.8&&!s.player.grounded&&s.touch.z>.9,s.player);await release();await advance(750);
 await walk(-10,35);await tap('#interact-button');await advance(100);s=await state();check('shotgun collected through touch traversal and interaction',s.combat.inventory[1].unlocked&&s.combat.weapon===1,s.player);
 await tap('[data-weapon="0"]');await walk(0,35);await walk(12,34);await tap('#interact-button');await advance(70);s=await state();check('target challenge starts with touch interaction',s.challenge?.id==='targets',s.challenge);
 await tap('#aim-button');await advance(200);check('tap ADS toggles aim',(await state()).camera.aim);
 for(let i=0;i<6;i++){
  const x=9+i*2.5,z=24-(i%2)*3;await aimAt(x,1.8,z);await start(await point('#fire-button',2));await advance(280);await end(2);await advance(50);events.push({target:i,challenge:(await state()).challenge});
 }
 s=await state();check('six-target challenge completed by actual touch aiming and shooting',s.challenges.find(c=>c.id==='targets').complete,s.challenge);await page.screenshot({path:out+'/targets-complete.png',timeout:8000});
 await tap('#reload-button');await advance(1250);s=await state();check('touch reload refills rifle after challenge',s.combat.inventory[0].ammo===24&&!s.combat.reloading,s.combat.inventory[0]);await tap('#aim-button');
 await walk(0,33);await walk(-29,33);await walk(-30,28);
 let dualFrames=0,minHp=100,respawns=0;
 for(let fight=0;fight<100;fight++){
  s=await mode();minHp=Math.min(minHp,s.player.hp);respawns=s.respawns;if(s.camps[0].cleared)break;
  if(!s.player.alive){await release();await advance(1700);await walk(-29,33);await walk(-30,28);continue;}
  const candidates=s.enemies.filter(e=>e.camp===0).sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z));
  const visible=await page.evaluate(()=>{const {game,world}=window.__gameTest,p=game.player;return game.enemies.filter(e=>e.alive&&e.camp===0&&!world.blocked({x:p.x,y:p.y+1.2,z:p.z},{x:e.x,y:e.y+1,z:e.z})).map(e=>e.id);});const e=candidates.find(e=>visible.includes(e.id));
  if(!e){await release();const path=await page.evaluate(to=>window.__gameTest.world.path(window.__gameTest.game.player,to).map(p=>({x:p.x,z:p.z})),candidates[0]);if(path.length)await walk(path[0].x,path[0].z);else await walk(-31,21);continue;}
  await tap('[data-weapon="0"]');await aimAt(e.x,e.y+1,e.z,false,e.id);await start(await point('#fire-button',2));await stick(fight%2?30:-30,0);
  for(let burst=0;burst<10;burst++){
   const now=await state(),enemy=now.enemies.find(v=>v.id===e.id);minHp=Math.min(minHp,now.player.hp);if(!enemy||!now.player.alive)break;
   await aimAt(enemy.x,enemy.y+1,enemy.z,true,e.id);await advance(85);const dual=await state();if(dual.touch.fire&&Math.abs(dual.touch.x)>.5)dualFrames++;
  }
  await release();await advance(50);s=await state();events.push({fight,hp:s.player.hp,kills:s.kills,remaining:s.camps[0].enemies,respawns:s.respawns});console.log('fight',fight,s.player.hp,s.kills,s.camps[0].enemies);
  if(s.combat.inventory[0].ammo<4){await tap('#reload-button');await advance(1250);}
 }
 s=await state();check('town camp cleared using genuine dual-thumb controls',s.camps[0].cleared,{camp:s.camps[0],minHp,respawns,dualFrames});check('move plus right-fire dragging exercised during combat',dualFrames>=3,{dualFrames,minHp});check('cleared camp sets safe checkpoint',s.checkpoint.x===-31&&s.checkpoint.z===12,s.checkpoint);await page.screenshot({path:out+'/camp-complete.png',timeout:8000});
 check('no stuck input after combat',s.touch.x===0&&s.touch.z===0&&!s.touch.fire,s.touch);check('no browser errors',errors.length===0,errors);
 fs.writeFileSync(out+'/report.json',JSON.stringify({checks,events,errors,final:s},null,2));console.log('PASS real mobile battle route');
}catch(error){await release().catch(()=>{});const s=await state().catch(()=>null);fs.writeFileSync(out+'/report.json',JSON.stringify({checks,events,errors,error:error.stack,final:s},null,2));await page.screenshot({path:out+'/failure.png',timeout:8000}).catch(()=>{});console.error(error);process.exitCode=1;}finally{await context.close();await browser.close();}
