import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
// Attach only to the dedicated Codex browser, never a hand-operated profile.
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
const page=await context.newPage(),cdp=await context.newCDPSession(page),checks=[],errors=[];
const out='output/verification';fs.mkdirSync(out,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,pass,detail)=>{console.log((pass?'PASS ':'FAIL ')+name);checks.push({name,pass:!!pass,detail});assert.ok(pass,name+' '+JSON.stringify(detail??''));};
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const point=async(selector,id=1)=>{const r=await page.locator(selector).boundingBox();assert.ok(r,selector);return {id,x:r.x+r.width/2,y:r.y+r.height/2,radiusX:5,radiusY:5,force:1};};
let activeTouches=0;
const touch=async(type,points=[])=>{if((type==='touchEnd'||type==='touchCancel')&&!activeTouches)return;await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});activeTouches=type==='touchCancel'?0:points.length;};
const tap=async(selector)=>{await touch('touchStart',[await point(selector)]);await touch('touchEnd');};
const release=()=>touch('touchEnd');
const clear=async()=>{await release();await page.evaluate(()=>{const {game}=window.__gameTest;game.reset();game.start();});await advance(0);};
try{
 await page.goto(process.argv[2]||'http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);await page.waitForTimeout(300);await page.screenshot({timeout:8000,path:out+'/mobile-lobby.png'});
 await page.evaluate(()=>{window.__displayRequests={fullscreen:0,landscape:0,errors:[]};const full=document.documentElement.requestFullscreen;if(full)document.documentElement.requestFullscreen=function(...args){window.__displayRequests.fullscreen++;return full.apply(this,args);};const lock=screen.orientation?.lock;if(lock)screen.orientation.lock=function(mode){if(mode==='landscape')window.__displayRequests.landscape++;return lock.call(this,mode).catch(e=>{window.__displayRequests.errors.push(e.name);throw e;});};});
 await tap('#start-btn');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='playing');await advance(0);const display=await page.evaluate(()=>({...window.__displayRequests,fullscreenActive:!!document.fullscreenElement,hasLock:!!screen.orientation?.lock}));check('mobile launch requests fullscreen',display.fullscreen===1,display);check('mobile launch requests landscape with playable fallback',!display.hasLock||display.landscape===1,display);check('touch start enters playing',(await state()).mode==='playing');check('coarse touch mode enabled',(await state()).touch.mobile);
 const stick=await point('#move-stick',1),look={id:2,x:520,y:210,radiusX:5,radiusY:5,force:1},fire=await point('#fire-button',3);
 const before=await state();await touch('touchStart',[stick,look,fire]);await touch('touchMove',[{...stick,y:stick.y-45},{...look,x:look.x+35,y:look.y-12},fire]);await advance(350);const held=await state();
 check('three real touches move, look, and fire together',held.touch.z>.9&&held.touch.fire&&held.touch.sprint&&held.combat.shots>before.combat.shots&&held.camera.yaw>before.camera.yaw+.1&&Math.hypot(held.player.x-before.player.x,held.player.z-before.player.z)>1,{before:before.player,after:held.player,touch:held.touch});
 await release();const stopped=await state();check('touch release clears movement, sprint, and fire',stopped.touch.z===0&&stopped.touch.x===0&&!stopped.touch.fire&&!stopped.touch.sprint);
 await clear();await tap('#jump-button');await advance(140);check('touch jump raises character',(await state()).player.y>.5);await advance(1000);
 await tap('#aim-button');await advance(300);let s=await state();check('touch precision toggles aim and narrows FOV',s.touch.aim&&s.camera.aim&&s.camera.fov<45);await tap('#aim-button');await advance(100);check('second aim tap disables precision',!(await state()).touch.aim);
 await page.evaluate(()=>{const g=window.__gameTest.game;g.combat.inventory[0].ammo=5;});await tap('#reload-button');s=await state();check('touch reload begins',s.combat.reloading>0);await advance(1200);s=await state();check('touch reload finishes and consumes reserve',s.combat.inventory[0].ammo===24&&s.combat.inventory[0].reserve===125);
 await page.evaluate(()=>{const {game,world}=window.__gameTest;const w=world.pickups.find(p=>p.type==='weapon'&&p.weapon===1);Object.assign(game.player,{x:w.x,y:w.y,z:w.z,vx:0,vz:0});});await tap('#interact-button');s=await state();check('touch interaction picks up shotgun',s.combat.inventory[1].unlocked&&s.combat.weapon===1);
 await tap('[data-weapon="0"]');check('weapon HUD receives touch above camera zone',(await state()).combat.weapon===0);await tap('[data-weapon="1"]');check('touch weapon switching equips unlocked gun',(await state()).combat.weapon===1);
 await clear();await tap('#aim-button');await touch('touchStart',[await point('#move-stick',1),await point('#fire-button',2)]);await touch('touchCancel');s=await state();check('real touchCancel pauses and resets held inputs',s.mode==='paused'&&!s.touch.fire&&!s.touch.aim&&s.touch.x===0&&s.touch.z===0&&!s.audio.playing);check('pause removes precision button selected marker',!(await page.locator('#aim-button').evaluate(e=>e.classList.contains('selected'))));await tap('#resume');
 await tap('#pause');check('touch pause opens modal',(await state()).mode==='paused');await tap('#resume');check('touch resume restores play',(await state()).mode==='playing');
 // Activating another actual browser tab exercises real document visibilitychange.
 const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await page.waitForTimeout(120);const headlessVisibility=await page.evaluate(()=>document.visibilityState);await other.close();await page.bringToFront();
 if(headlessVisibility==='visible')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});
 s=await state();check('background visibility listener pauses audio and game',s.mode==='paused'&&!s.audio.playing,{realTabVisibility:headlessVisibility,simulation:headlessVisibility==='visible'});await tap('#resume');
 for(const size of [{width:844,height:390},{width:667,height:375},{width:568,height:320},{width:390,height:844},{width:375,height:667}]){
  await page.setViewportSize(size);if((await state()).mode==='paused')await tap('#resume');await advance(3300);
  const geometry=await page.evaluate(()=>{
   const selectors=['#move-stick','#fire-button','#left-fire-button','#jump-button','#aim-button','#reload-button','#interact-button','[data-weapon="0"]','[data-weapon="1"]','[data-weapon="2"]'];
   const boxes=selectors.map(sel=>{const e=document.querySelector(sel),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {sel,x:r.x,y:r.y,w:r.width,h:r.height,hit:e===hit||e.contains(hit)};});const overlaps=[];
   const intersect=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>2;
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(intersect(boxes[i],boxes[j]))overlaps.push([boxes[i].sel,boxes[j].sel]);
   const map=document.querySelector('#map').getBoundingClientRect(),key=document.querySelector('.map-key').getBoundingClientRect();for(const b of boxes)for(const [id,r]of [['map',map],['key',key]])if(intersect(b,{x:r.x,y:r.y,w:r.width,h:r.height}))overlaps.push([b.sel,id]);
   return {boxes,overlaps,viewport:{w:innerWidth,h:innerHeight},rotate:getComputedStyle(document.querySelector('#rotate-hint')).display};
  });
  check(`all touch targets exposed and within ${size.width}x${size.height}`,geometry.boxes.every(r=>r.hit&&r.x>=0&&r.y>=0&&r.x+r.w<=size.width&&r.y+r.h<=size.height),geometry);check(`touch controls and map do not overlap ${size.width}x${size.height}`,geometry.overlaps.length===0,geometry.overlaps);
  check(`portrait guidance ${size.width}x${size.height}`,size.height>size.width?geometry.rotate!=='none':geometry.rotate==='none');
  await page.screenshot({timeout:8000,path:out+`/mobile-${size.width}x${size.height}.png`});
 }
 await page.setViewportSize({width:844,height:390});if((await state()).mode==='paused')await tap('#resume');await advance(0);await page.evaluate(()=>window.__gameTest.game.camera.state.yaw=.1);await touch('touchStart',[await point('#move-stick',1),await point('#fire-button',2)]);await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'portraitPrimary',angle:0}});await page.waitForTimeout(100);s=await state();check('real device orientation clears held input and pauses',s.mode==='paused'&&!s.touch.fire&&s.touch.z===0);await release();
 check('no browser errors',errors.length===0,errors);
 console.log(JSON.stringify({checks,errors},null,2));console.log(`PASS ${checks.length} mobile checks`);
}finally{
 fs.writeFileSync(out+'/mobile-report.json',JSON.stringify({checks,errors},null,2));await context.close();await browser.close();
}
