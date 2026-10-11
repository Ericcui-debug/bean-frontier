import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAPS} from '../src/maps.js';
const checks=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name);assert.ok(pass,name+' '+JSON.stringify(detail??''));};
for(const map of MAPS){
 check(map.id+' modes match classic objectives',map.mode===(map.id==='assault'?'rescue':'bomb'));
 check(map.id+' areas and route variants are distinct',new Set(map.areas.map(a=>a.name)).size===map.areas.length&&Object.keys(map.routeVariants).length>=2);
 check(map.id+' every objective and spawn fits current map bounds',[...map.spawns.attack,...map.spawns.defend,...(map.mode==='rescue'?[...map.hostagePositions,...map.rescueZones]:map.sites)].every(p=>p.x>map.bounds.x0&&p.x<map.bounds.x1&&p.z>map.bounds.z0&&p.z<map.bounds.z1));
}
if(process.argv.includes('--pure')){console.log('PASS '+checks.length+' map contract checks');process.exit(0);}
const {chromium}=await import('playwright');
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const base=process.argv.slice(2).find(v=>!v.startsWith('--'))||'http://localhost:5180/';
const folder='output/space-release-audit'+(base.startsWith('file:')?'-offline':'');fs.mkdirSync(folder,{recursive:true});
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
await context.addInitScript(()=>localStorage.setItem('bean-frontier-onboarding',JSON.stringify({version:1})));
if(base.startsWith('file:'))await context.setOffline(true);
const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[],requests=[];
const heldTouches=new Map();
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
const advance=async ms=>{await page.evaluate(ms=>advanceTime(ms),ms);await page.waitForTimeout(80);await page.evaluate(()=>advanceTime(0));};
const place=async p=>page.evaluate(p=>{Object.assign(__gameTest.game.player,{x:p.x,y:p.y,z:p.z,vx:0,vy:0,vz:0,grounded:true,ladderId:null,ladderCooldown:0});__gameTest.input.reset();__gameTest.game.camera.update(0,__gameTest.game.player);advanceTime(0);},p);
const tap=async selector=>{const b=await page.locator(selector).boundingBox();assert.ok(b,'button exists '+selector);await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);};
const pointer=async(selector,type,id,dx=0,dy=0)=>{
 const r=await page.locator(selector).boundingBox();assert.ok(r,selector+' touch target');
 const point={id,x:r.x+r.width/2+dx,y:r.y+r.height/2+dy,radiusX:4,radiusY:4,force:1};
 if(type==='pointercancel'){heldTouches.clear();await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});return;}
 if(type==='pointerup')heldTouches.delete(id);else heldTouches.set(id,point);
 await cdp.send('Input.dispatchTouchEvent',{type:type==='pointerdown'?'touchStart':type==='pointerup'?'touchEnd':'touchMove',touchPoints:[...heldTouches.values()]});
};
try{
 for(const map of MAPS){
  const url=new URL(base);url.search='test&lazy';await page.goto(url.href);await page.waitForFunction(()=>!!window.__gameTest);
  await tap('[data-map="'+map.id+'"]');await tap('#start-btn');await page.waitForFunction(()=>JSON.parse(render_game_to_text()).mode==='playing',null,{timeout:90000});
  await page.evaluate(()=>{__gameTest.game.ai.update=()=>{};__gameTest.game.player.money=8000;});
  await tap('[data-buy="3"]');await tap('#buy-close');await advance(15010);
  await tap('[data-action="aim"]');await advance(250);let s=await state();
  check(map.id+' real mobile aim button activates sniper scope',s.camera.scope&&s.camera.fov<25&&await page.locator('#scope-overlay').isVisible(),s.camera);
  check(map.id+' scoped view hides weapon mesh',!await page.evaluate(()=>__gameTest.game.camera.view.visible));
  await page.screenshot({path:folder+'/'+map.id+'-scope.png'});
  await tap('[data-action="aim"]');await advance(250);
  check(map.id+' second mobile aim tap restores first-person weapon',!(await state()).camera.scope&&await page.evaluate(()=>__gameTest.game.camera.view.visible));
  const before=(await state()).camera.yaw;
  await pointer('#move-stick','pointerdown',41,0,-30);await pointer('[data-action="fire"]','pointerdown',42);await pointer('[data-action="fire"]','pointermove',42,22,-8);await advance(100);
  s=await state();check(map.id+' moving plus dragged fire updates camera and shoots',s.touch.z>.1&&s.combat.shots>0&&Math.abs(s.camera.yaw-before)>.01,s.touch);
  await pointer('[data-action="fire"]','pointercancel',42);s=await state();check(map.id+' pointer cancellation clears both fingers and pauses',s.mode==='paused'&&!s.touch.fire&&s.touch.x===0&&s.touch.z===0,s.touch);await tap('#resume');
  await page.evaluate(()=>{const {game,world}=__gameTest;for(const a of game.actors.slice(1)){const p=world.spawns.attack[a.id%5];Object.assign(a,{x:p.x,y:p.y,z:p.z,vx:0,vy:0,vz:0});a.group.position.set(a.x,a.y,a.z);}});
  if(map.id==='assault'){
   const door=await page.evaluate(()=>{const d=__gameTest.world.solids.find(s=>s.type==='door');return {x:(d.x0+d.x1)/2,y:d.y0,z:(d.z0+d.z1)/2,wx:d.x1-d.x0,dz:d.z1-d.z0,id:d.id};});
   const side={x:door.x+(door.wx<door.dz?1.2:0),y:door.y,z:door.z+(door.wx<door.dz?0:1.2)};await place(side);
   check('Assault rear door produces contextual interaction',(await page.evaluate(()=>__gameTest.game.nearestInteraction()))?.type==='door');await tap('[data-action="interact"]');await advance(0);
   check('real touch opens rear door and updates collision',await page.evaluate(id=>{const d=__gameTest.world.solids.find(s=>s.id===id);return d.open&&!d.active&&!d.group.visible;},door.id));
   await tap('[data-action="interact"]');await advance(0);check('second real touch closes rear door',await page.evaluate(id=>{const d=__gameTest.world.solids.find(s=>s.id===id);return !d.open&&d.active&&d.group.visible;},door.id));
   const ductLadder=await page.evaluate(()=>__gameTest.world.ladders.find(l=>l.id==='duct-drop'));
   await page.evaluate(()=>{__gameTest.game.camera.state.yaw=0;__gameTest.game.camera.state.pitch=0;});await place({x:ductLadder.bottom.x,y:ductLadder.bottom.y,z:ductLadder.bottom.z+.6});
   await page.keyboard.down('KeyW');await advance(450);await page.keyboard.up('KeyW');let climbed=(await state()).player;
   check('flat forward walk through upper gallery does not attach duct ladder',!climbed.ladderId&&Math.abs(climbed.y-ductLadder.bottom.y)<.08&&climbed.z<ductLadder.z-.3,{climbed,ductLadder});
   await page.evaluate(l=>{__gameTest.game.camera.state.pitch=.8;__gameTest.game.camera.state.yaw=Math.atan2(l.x-l.bottom.x,-(l.z-l.bottom.z));},ductLadder);await place(ductLadder.bottom);
   await page.keyboard.down('KeyW');await advance(450);await page.keyboard.up('KeyW');climbed=(await state()).player;
   check('looking up and real W climbs metadata duct ladder',climbed.ladderId===ductLadder.id&&climbed.y>ductLadder.y0+.8,{climbed,ductLadder});
   await advance(160);check('releasing W holds duct ladder height',Math.abs((await state()).player.y-climbed.y)<.01);
   await page.keyboard.down('KeyW');await advance(Math.ceil((ductLadder.y1-climbed.y)/2.8*1000)+30);await page.keyboard.up('KeyW');const ductTop=(await state()).player;
   check('duct ladder exits onto authored safe upper landing',!ductTop.ladderId&&Math.abs(ductTop.y-ductLadder.exit.y)<.1&&Math.hypot(ductTop.x-ductLadder.exit.x,ductTop.z-ductLadder.exit.z)<.2,{ductTop,exit:ductLadder.exit});
   await page.screenshot({path:folder+'/assault-duct-ladder.png'});
   await page.evaluate(l=>{__gameTest.game.camera.state.pitch=-.8;__gameTest.game.camera.state.yaw=Math.atan2(l.x-l.exit.x,-(l.z-l.exit.z));},ductLadder);await place(ductLadder.exit);
   await page.keyboard.down('KeyW');await advance(650);await page.keyboard.up('KeyW');const descending=(await state()).player;
   check('looking down and real W enters duct ladder descent',descending.ladderId===ductLadder.id&&descending.y<ductLadder.y1-.4,{descending,ductLadder});
   await advance(160);check('releasing W holds descending duct ladder height',Math.abs((await state()).player.y-descending.y)<.01);
   await page.keyboard.down('KeyW');await advance(Math.ceil((descending.y-ductLadder.y0)/2.8*1000)+30);await page.keyboard.up('KeyW');const ductBottom=(await state()).player;
   check('duct ladder descent exits onto gallery bottom landing',!ductBottom.ladderId&&Math.abs(ductBottom.y-ductLadder.bottom.y)<.1&&Math.hypot(ductBottom.x-ductLadder.bottom.x,ductBottom.z-ductLadder.bottom.z)<.2,{ductBottom,bottom:ductLadder.bottom});
   const hostage=await page.evaluate(()=>{__gameTest.game.camera.state.pitch=0;__gameTest.game.camera.state.yaw=0;const h=__gameTest.game.hostages.list[0];return {x:h.x+.1,y:h.y,z:h.z,id:h.id};});await place(hostage);await tap('[data-action="interact"]');await advance(0);
   check('real touch recruits human at upper hostage room',await page.evaluate(()=>__gameTest.game.hostages.list[0].leaderId===0));
   await page.screenshot({path:folder+'/assault-hostage-room.png'});
   await page.evaluate(()=>__gameTest.game.down(__gameTest.game.player));await advance(20);check('leader death releases human without relocation',await page.evaluate(()=>{const h=__gameTest.game.hostages.list[0];return h.leaderId===null&&h.state==='waiting';}));
   await page.evaluate(()=>{const {game}=__gameTest,h=game.hostages.list[0],ally=game.actors[1];Object.assign(ally,{x:h.x+.1,y:h.y,z:h.z});game.interactActor(ally);});
   check('surviving teammate takes over hostage after player death',await page.evaluate(()=>__gameTest.game.hostages.list[0].leaderId===1));
  }else{
   await place(map.sites[0]);await advance(0);check('Dust2 site activates hold-to-plant action',(await page.evaluate(()=>__gameTest.game.nearestInteraction()))?.type==='plant');
   await pointer('[data-action="interact"]','pointerdown',55);await advance(1000);check('real held mobile interaction accumulates plant progress',await page.evaluate(()=>__gameTest.game.player.interaction?.progress>.25));
   await pointer('[data-action="interact"]','pointerup',55);await advance(10);check('releasing mobile interaction cancels planting',!(await state()).bomb.planted&&!await page.evaluate(()=>__gameTest.game.player.interaction));
   await pointer('[data-action="interact"]','pointerdown',56);await advance(3010);await pointer('[data-action="interact"]','pointerup',56);check('continuous real mobile interaction plants C4',(await state()).phase==='planted');await page.screenshot({path:folder+'/dust2-planted.png'});
   await page.evaluate(()=>__gameTest.game.down(__gameTest.game.player));await advance(20);check('dead attacker leaves planted round active and observes teammate',(await state()).phase==='planted'&&(await state()).spectateId!=null);
  }
  await advance(20);
  check(map.id+' spectated teammate body is hidden after a simulation step',await page.evaluate(()=>{const {game}=__gameTest,a=game.actors.find(a=>a.id===game.state.spectateId);return a?.firstPersonHidden&&!a.body.visible;}));
  await page.screenshot({path:folder+'/'+map.id+'-spectate.png'});
  if(map.id==='dust2')for(const [width,height,safe] of [[568,320,{left:44,right:44,top:0,bottom:21}],[844,390,{left:47,right:47,top:0,bottom:21}],[390,844,{left:0,right:0,top:47,bottom:34}]]){
   await page.setViewportSize({width,height});await page.evaluate(safe=>{for(const [k,v]of Object.entries(safe))document.documentElement.style.setProperty('--safe-'+k,v+'px');__gameTest.input.setLayout({size:1.25});},safe);await page.waitForTimeout(150);if((await state()).mode==='paused')await tap('#resume');await advance(0);
   const layout=await page.evaluate(()=>{const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};},spect=document.querySelector('#spectate-hud');return {spectate:rect(spect),buttons:[...spect.querySelectorAll('button')].map(rect),protected:['#ammo','#weapons','#health','.tools','.match-strip','#map'].map(selector=>({selector,...rect(document.querySelector(selector))}))};});
   const r=layout.spectate,overlap=(a,b)=>a.x<b.right-.5&&a.right>b.x+.5&&a.y<b.bottom-.5&&a.bottom>b.y+.5;
   check(`spectator HUD ${width}x${height} maximum buttons stays inside cutout bounds`,r.x>=safe.left&&r.right<=width-safe.right&&r.y>=safe.top&&r.bottom<=height-safe.bottom,layout);
   check(`spectator HUD ${width}x${height} preserves ammo, weapons and status`,layout.protected.every(p=>!overlap(r,p)),layout);
   check(`spectator HUD ${width}x${height} both controls remain at least 44px`,layout.buttons.every(r=>r.w>=44&&r.h>=44),layout.buttons);
   await page.screenshot({path:`${folder}/spectate-${width}x${height}.png`});
  }
  check(map.id+' no enemy position markers reach minimap',await page.evaluate(()=>[...document.querySelectorAll('#map [data-marker]')].every(n=>!n.dataset.marker.startsWith('enemy'))));
 }
 if(base.startsWith('file:'))check('offline independent play does not access network',requests.every(url=>!/^https?:/.test(url)),requests);
 check('no browser or console errors in independent mobile play',errors.length===0,errors);
}finally{fs.writeFileSync(folder+'/report.json',JSON.stringify({base,checks,errors,requests,limitations:['Browser touch input and rendering inspected; physical iPhone/Safari FPS, heat and tactile comfort unverified.','Objective checks relocate fixtures using map metadata; they are not full-map human speedruns.']},null,2));await context.close();await browser.close();}
console.log('PASS '+checks.length+' independent release checks');
