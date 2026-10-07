import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// Independent boundary audit. State arrangements below deliberately exercise geometry and hidden-player branches.
const out='output/upgrade-final-audit';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const page=await browser.newPage({viewport:{width:1365,height:768}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(process.argv[2]||'http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);await page.locator('#start-btn').click();await page.evaluate(()=>window.advanceTime(0));
 const report=await page.evaluate(()=>{
  const {game,world,g,render,characterDisplay:{poseBean,updateBeanDisplay}}=window.__gameTest,checks=[];
  const check=(name,pass,detail)=>checks.push({name,pass:!!pass,detail});
  const actor=game.player;const paths=[...world.camps,...world.flags,...world.pickups].flatMap(p=>world.path(world.spawn,p));
  const distinct=[...new Map(paths.map(p=>[p.x+':'+p.z,p])).values()].filter(p=>world.canWalk(p,p,.59));
  const samples=distinct.filter((_,i)=>i%Math.max(1,Math.floor(distinct.length/38))===0).slice(0,38);
  let positions=0,unsafe=[];
  for(const p of samples){
   Object.assign(actor,{x:p.x,y:p.y,z:p.z,vx:0,vy:0,vz:0,alive:true,grounded:true});
   for(let i=0;i<10;i++)for(const pitch of [-.95,-.4,0,.68])for(const hz of [15,30,60]){
    game.camera.state.yaw=i*Math.PI/5;game.camera.state.pitch=pitch;game.camera.state.aim=i%2===0;game.camera.update(1/hz,false,positions===0);
    const cp=g.camera.position,focus={x:actor.x,y:actor.y+1.48,z:actor.z};positions++;
    if(!cp.toArray().every(Number.isFinite)||cp.y<.279||world.cameraBlocked(focus,cp,.27))unsafe.push({p:{...p},pitch,hz,yaw:game.camera.state.yaw,camera:cp.toArray()});
   }
  }
  check('broad terrain/roof/path camera sweep stays above ground and unobstructed',unsafe.length===0,{samples:samples.length,positions,unsafe:unsafe.slice(0,5)});
  game.reset();game.start();render();const minimap=document.querySelector('#map svg');
  check('minimap includes no enemy red-dot or enemy elements',!minimap.outerHTML.includes('#ea5469')&&!minimap.querySelector('[data-enemy],.enemy,.enemy-marker'),{circles:minimap.querySelectorAll('circle').length});
  const e=game.enemies[0];Object.assign(e,{x:0,y:0,z:35,hp:30,healthUntil:game.state.time+1.6,yaw:0});poseBean(e,game.state.time,true);
  g.camera.position.set(0,3,42);g.camera.lookAt(0,1,35);updateBeanDisplay(e,g.camera,world,game.state.time,false);const shown=e.health.visible;
  const temp=world.solid(0,38.5,4,.6,4,0xff00ff);updateBeanDisplay(e,g.camera,world,game.state.time,false);const hidden=!e.health.visible;temp.active=false;temp.group.visible=false;
  updateBeanDisplay(e,g.camera,world,game.state.time+1.61,false);check('damage health bar is line-of-sight gated and expires without enemy tracing',shown&&hidden&&!e.health.visible,{shown,hidden,expired:!e.health.visible});
  game.reset();game.start();game.enemies.forEach(e=>{e.alive=false;e.group.visible=false;});
  Object.assign(actor,{x:-20,y:0,z:-3,invuln:0,vx:0,vz:0,hp:100});const hiddenShooter=game.ai.spawn(-20,12,null,'shooter',true),shots=[];
  const mock={hurt:()=>{},enemyFire:(r,seen)=>{shots.push({time:game.state.time,seen:{...seen},blocked:!!world.blocked({x:r.x,y:r.y+1.2,z:r.z},{x:actor.x,y:actor.y+1.2,z:actor.z})});return true;}};
  for(let i=0;i<1440;i++){game.state.time+=1/120;game.ai.update(1/120,game.state.time,mock);}
  check('existing town wall blocks detection and attack for twelve seconds',hiddenShooter.lastSeen===null&&shots.length===0,{mode:hiddenShooter.aiMode,shots:shots.length});
  game.reset();game.start();game.enemies.forEach(e=>{e.alive=false;e.group.visible=false;});Object.assign(actor,{x:0,y:0,z:16,invuln:0,vx:0,vz:0});const searching=game.ai.spawn(0,0,null,'shooter',true);
  for(let i=0;i<30;i++){game.state.time+=1/120;game.ai.update(1/120,game.state.time,mock);}
  const seen={...searching.lastSeen};const wall=world.solid(0,8,12,.6,4,0xff00ff);Object.assign(actor,{x:2,z:17,vx:9,vz:4});
  for(let i=0;i<180;i++){game.state.time+=1/120;game.ai.update(1/120,game.state.time,mock);}
  check('unseen movement keeps exact last observation rather than following current coordinates',searching.lastSeen?.x===seen.x&&searching.lastSeen?.z===seen.z&&searching.lastSeen?.time===seen.time&&searching.lastSeen?.vx===seen.vx,{seen,current:searching.lastSeen,target:searching.target});
  for(let i=0;i<240;i++){game.state.time+=1/120;game.ai.update(1/120,game.state.time,mock);}
  check('search returns to patrol after three second blind memory',searching.lastSeen===null&&['patrol','return'].includes(searching.aiMode),{mode:searching.aiMode});wall.active=false;wall.group.visible=false;
  game.reset();game.start();Object.assign(actor,{x:-31,y:0,z:26,invuln:0,vx:0,vz:0});let blockedShots=0,escapeFailures=0;const movement=new Map(game.enemies.map(e=>[e.id,[]]));
  const longMock={hurt:()=>{},enemyFire:(r,seen)=>{if(world.blocked({x:r.x,y:r.y+1.2,z:r.z},{x:actor.x,y:actor.y+1.2,z:actor.z}))blockedShots++;return true;}};
  for(let i=0;i<7200;i++){
   game.state.time+=1/120;actor.x=-31+Math.sin(game.state.time*.3)*4;actor.z=26+Math.cos(game.state.time*.3)*1.5;game.ai.update(1/120,game.state.time,longMock);
   if(i%120===0)for(const r of game.enemies){movement.get(r.id).push({x:r.x,z:r.z,mode:r.aiMode});if(!Number.isFinite(r.x)||!Number.isFinite(r.z)||r.y< -8||Math.hypot(r.x-r.home.x,r.z-r.home.z)>33)escapeFailures++;}
  }
  check('sixty seconds of cover pursuit never attacks through walls or escapes camp leash',blockedShots===0&&escapeFailures===0,{blockedShots,escapeFailures});
  const locked=[];for(const r of game.enemies.filter(e=>e.camp===0)){const points=movement.get(r.id);for(let i=0;i<=points.length-15;i++){const range=points.slice(i,i+15);if(range.every(p=>['advance','flank','retreat','search','charge','cover','peek'].includes(p.mode))&&range.every(p=>Math.hypot(p.x-range[0].x,p.z-range[0].z)<.08))locked.push({id:r.id,start:i,mode:range[0].mode});}}
  check('town combat actors do not remain motionless against obstacles for fifteen seconds',locked.length===0,locked);
  Object.assign(actor,{...world.spawn,hp:100,invuln:2.5});for(let i=0;i<300;i++){game.state.time+=1/120;game.ai.update(1/120,game.state.time,longMock);}check('safe respawn clears every current enemy acquisition',game.enemies.every(e=>!e.lastSeen&&e.alert===0));
  game.reset();game.start();check('final reset restores original scene and weapon restrictions',game.enemies.length===12&&world.flags.every(f=>!f.complete)&&world.camps.every(c=>!c.cleared)&&game.combat.inventory[0].unlocked&&!game.combat.inventory[1].unlocked&&!game.combat.inventory[2].unlocked);
  return checks;
 });
 fs.writeFileSync(out+'/report.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors},null,2));assert.ok(report.every(c=>c.pass));assert.equal(errors.length,0);
}finally{await page.close();await browser.close();}
