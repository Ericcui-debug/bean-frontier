import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
const page=await context.newPage(),cdp=await context.newCDPSession(page),checks=[],errors=[];
page.setDefaultTimeout(10000);
const out='output/bomb-multimap-mobile';fs.mkdirSync(out,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,pass,detail)=>{console.log((pass?'PASS ':'FAIL ')+name);checks.push({name,pass:!!pass,detail});assert.ok(pass,name+' '+JSON.stringify(detail??''));};
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=async ms=>{await page.evaluate(ms=>window.advanceTime(ms),ms);await page.waitForTimeout(75);await page.evaluate(()=>window.advanceTime(0));};
const point=async(selector,id=1)=>{await page.locator(selector).scrollIntoViewIfNeeded();const r=await page.locator(selector).boundingBox();assert.ok(r,selector);return {id,x:r.x+r.width/2,y:r.y+r.height/2,radiusX:5,radiusY:5,force:1};};
let touches=[];
const touch=async(type,points=[])=>{if((type==='touchEnd'||type==='touchCancel')&&!touches.length)return;await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});touches=type==='touchCancel'?[]:type==='touchEnd'?(points.length?touches.filter(p=>!points.some(end=>end.id===p.id)):[]):points;};
const tap=async selector=>{await touch('touchStart',[await point(selector)]);await touch('touchEnd');};
const release=()=>touch('touchEnd');
const home=async()=>{await release();if(await page.locator('#buy-panel').isVisible())await tap('#buy-close');if((await state()).mode==='playing')await tap('#pause');if((await state()).mode!=='ready')await tap('#home');await page.waitForTimeout(100);await advance(0);};
const start=async(id,side='attack')=>{await home();await tap('#map-'+id);await tap('#side-'+side);await tap('#start-btn');await page.waitForFunction(()=>window.__gameTest.game.state.mode==='playing');await page.evaluate(()=>{window.__gameTest.game.ai.update=()=>{};window.__gameTest.settings.assist=false;});await advance(0);};
try{
 await page.goto(process.argv[2]||'http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);
 check('town is the default map; no saved match selection',(await state()).map.id==='town'&&(await state()).selectedMap==='town'&&await page.locator('#map-town').getAttribute('aria-pressed')==='true');
 for(const size of [{width:844,height:390},{width:568,height:320},{width:390,height:844},{width:375,height:667}]){
  await page.setViewportSize(size);await page.waitForTimeout(100);await home();
  for(const id of ['town','factory','harbor','random']){
   await page.locator('#map-'+id).scrollIntoViewIfNeeded();const geometry=await page.locator('#map-'+id).evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {w:r.width,h:r.height,x:r.x,y:r.y,hit:el===hit||el.contains(hit)};});
   check(`map card ${id} is a large reachable touch target ${size.width}x${size.height}`,geometry.w>=110&&geometry.h>=44&&geometry.x>=0&&geometry.x+geometry.w<=size.width+.1&&geometry.y>=0&&geometry.y+geometry.h<=size.height+.1&&geometry.hit,geometry);
  }
  await page.locator('#start-btn').scrollIntoViewIfNeeded();const accessible=await page.locator('#start-btn').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {height:r.height,y:r.y,bottom:r.bottom,hit:el===hit||el.contains(hit)};});check(`start remains reachable ${size.width}x${size.height}`,accessible.height>=44&&accessible.y>=0&&accessible.bottom<=size.height+1&&accessible.hit,accessible);
  await page.screenshot({path:out+`/lobby-${size.width}x${size.height}.png`,timeout:8000});
 }
 await page.setViewportSize({width:844,height:390});await page.waitForTimeout(100);
 const names={town:'糖果小镇',factory:'积木工厂',harbor:'奶油港口'};
 const resourceSamples=[];
 for(const id of Object.keys(names)){
  await home();const old=(await state()).map.id;await tap('#map-'+id);check(`${id} choice updates card and copy without changing running world`,(await state()).selectedMap===id&&(await state()).map.id===old&&await page.locator('#selected-map-name').textContent()===names[id]&&await page.locator('#map-'+id).getAttribute('aria-pressed')==='true');
  await tap('#side-attack');await tap('#start-btn');await page.waitForFunction(()=>window.__gameTest.game.state.mode==='playing');await page.evaluate(()=>{window.__gameTest.game.ai.update=()=>{};window.__gameTest.settings.assist=false;});await advance(0);
  check(`${id} real touch starts chosen map with clean buy input`,(await state()).map.id===id&&(await state()).phase==='buy'&&!(await state()).touch.fire&&(await state()).touch.z===0&&await page.locator('#map-name').textContent()===names[id]);
  await tap('#recommend');check(`${id} recommendation remains usable`,(await state()).player.armor===100&&(await state()).player.money===200);await tap('#tactic-b');check(`${id} B tactic remains usable`,(await state()).tactic==='B');
  await advance(15000);const before=await state(),stick=await point('#move-stick',1),fire=await point('#fire-button',2);await touch('touchStart',[stick,fire]);await touch('touchMove',[{...stick,y:stick.y-50},{...fire,x:fire.x-30}]);await advance(280);const moved=await state();
  check(`${id} dual-thumb movement, drag aim and firing`,moved.touch.z>.9&&moved.touch.fire&&moved.combat.shots>before.combat.shots&&moved.camera.yaw<before.camera.yaw-.08&&Math.hypot(moved.player.x-before.player.x,moved.player.z-before.player.z)>.5,{touch:moved.touch,shots:moved.combat.shots});await release();
  await tap('#aim-button');await advance(20);check(`${id} ADS toggles independently`,(await state()).camera.aim);await tap('#aim-button');await tap('#jump-button');await advance(120);check(`${id} jump responds after smaller body upgrade`,(await state()).player.y>.1);await advance(1000);
  await tap('#reload-button');await advance(3000);check(`${id} reload remains independent`,(await state()).player.equipment[0].ammo===12);
  await page.evaluate(()=>{const {game}=window.__gameTest;game.combat.equip(game.player,2);game.combat.select(game.player,1);});await tap('#weapon-secondary');check(`${id} switch to pistol`,(await state()).player.slot===0);await tap('#weapon-primary');check(`${id} switch to primary`,(await state()).player.slot===1);
  await touch('touchStart',[await point('#move-stick',1),await point('#fire-button',2)]);await touch('touchCancel');check(`${id} canceled touch pauses and clears input`,(await state()).mode==='paused'&&!(await state()).touch.fire&&(await state()).touch.z===0);await tap('#resume');
  await page.evaluate(()=>{const {game,world}=window.__gameTest,s=world.sites[0];Object.assign(game.player,{x:s.x,y:s.y,z:s.z,vx:0,vz:0,vy:0,grounded:true});});await advance(0);await touch('touchStart',[await point('#interact-button')]);await advance(3000);check(`${id} held touch plants on authored site`,(await state()).phase==='planted');await release();
  await page.screenshot({path:out+`/${id}-active.png`,timeout:8000});
  resourceSamples.push(await page.evaluate(()=>({map:window.__gameTest.world.id,roots:window.__gameTest.g.scene.children.filter(c=>c.name.startsWith('map:')).length,labels:window.__gameTest.g.labels.length})));
  await tap('#pause');await tap('#restart');await page.waitForFunction(()=>window.__gameTest.game.state.mode==='playing');await advance(0);check(`${id} restart retains map and resets match`,(await state()).map.id===id&&(await state()).round===1&&(await state()).scores.every(n=>n===0)&&(await state()).phase==='buy'&&!(await state()).touch.fire);
  await start(id,'defend');await advance(15000);await page.evaluate(()=>{const {game,world}=window.__gameTest,s=world.sites[0];Object.assign(game.player,{x:s.x,y:s.y,z:s.z,vx:0,vz:0,vy:0,grounded:true});game.state.phase='planted';game.state.bomb={carrierId:null,planted:true,siteId:'A',x:s.x,y:s.y,z:s.z,explodesAt:game.state.time+35};game.state.phaseEndsAt=game.state.bomb.explodesAt;});await advance(0);await touch('touchStart',[await point('#interact-button')]);await advance(5000);check(`${id} held touch defuses on authored site`,(await state()).phase==='round_end'&&(await state()).roundResult.reason==='炸弹已拆除');await release();
 }
 check('switching maps keeps only one map root and bounded labels',resourceSamples.every(r=>r.roots===1&&r.labels<25),resourceSamples);
 await home();await tap('#map-random');check('random is selected without choosing a map early',(await state()).selectedMap==='random'&&await page.locator('#selected-map-name').textContent()==='开始时随机选择');await tap('#start-btn');await page.waitForFunction(()=>window.__gameTest.game.state.mode==='playing');await advance(0);const rolled=(await state()).map.id;check('random starts a concrete supported map',Object.keys(names).includes(rolled));await tap('#buy-close');await tap('#pause');await tap('#restart');await page.waitForFunction(()=>window.__gameTest.game.state.mode==='playing');await advance(0);check('random match restart retains rolled map',(await state()).map.id===rolled);await home();check('home returns to accessible map choice',(await state()).mode==='ready'&&await page.locator('#map-random').isVisible());
 await page.evaluate(()=>{for(const [key,value] of [['--safe-left','44px'],['--safe-right','44px'],['--safe-bottom','21px']])document.documentElement.style.setProperty(key,value);});await page.locator('#start-btn').scrollIntoViewIfNeeded();const safe=await page.locator('#start-btn').boundingBox();check('start respects notch and home indicator',safe.x>=44&&safe.x+safe.width<=800&&safe.y+safe.height<=369,safe);
 check('browser runtime and console are clean',errors.length===0,errors);console.log(`PASS ${checks.length} multimap mobile checks`);
}finally{fs.writeFileSync(out+'/report.json',JSON.stringify({checks,errors},null,2));await context.close();await browser.close();}
