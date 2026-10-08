import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='output/bomb-multimap-independent';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
let context;const checks=[],errors=[];
const check=(label,value,detail)=>{checks.push({label,pass:!!value,detail});assert.ok(value,label+' '+JSON.stringify(detail??''));console.log('PASS '+label);};
try{
 context=await browser.newContext({viewport:{width:1280,height:720}});let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);
 for(const [id,x,z] of [['town',10,-7],['factory',0,-7],['harbor',-23,-18]]){
  await page.click('#map-'+id);await page.click('#start-btn');await page.click('#buy-close');
  await page.evaluate(([x,z])=>{const {game}=__gameTest;game.ai.update=()=>{};advanceTime(15100);Object.assign(game.player,{x,y:0,z,vx:0,vy:0,vz:0,grounded:true});game.camera.state.yaw=game.camera.state.pitch=0;game.camera.update(0,game.player);__gameTest.render();},[x,z]);
  await page.keyboard.down('KeyW');await page.evaluate(()=>advanceTime(200));await page.keyboard.up('KeyW');await page.evaluate(()=>advanceTime(100));
  let state=await page.evaluate(()=>JSON.parse(render_game_to_text()));check(id+' real keyboard stays under ceiling and advances',Math.abs(state.player.x-x)<.02&&state.player.y===0&&state.player.z<z-.6,state.player);
  await page.keyboard.press('Space');await page.evaluate(()=>advanceTime(180));state=await page.evaluate(()=>JSON.parse(render_game_to_text()));
  const limit=id==='town'?2.8:id==='factory'?2.2:1.65;
  check(id+' real jump respects underside of upstairs floor',state.player.y+state.characterSize.height<=limit+.001&&Math.abs(state.player.x-x)<.02,state.player);
  check(id+' first-person eye remains below ceiling',state.camera.position.y<limit,state.camera.position);
  await page.evaluate(()=>advanceTime(850));state=await page.evaluate(()=>JSON.parse(render_game_to_text()));check(id+' underpass jump lands without sideways ejection',state.player.grounded&&state.player.y===0&&Math.abs(state.player.x-x)<.02,state.player);
  await page.evaluate(()=>{const {game}=__gameTest;game.camera.state.pitch=1.45;game.camera.update(0,game.player);__gameTest.render();});await page.screenshot({path:out+'/'+id+'-underpass-up.png'});
  await page.keyboard.down('KeyW');await page.keyboard.press('Escape');state=await page.evaluate(()=>JSON.parse(render_game_to_text()));check(id+' pause clears held input',state.mode==='paused'&&!state.touch.fire&&!state.touch.interactHeld&&state.touch.x===0&&state.touch.z===0);await page.keyboard.up('KeyW');await page.click('#home');
 }
 const resources=await page.evaluate(()=>{const {game,g,world}=__gameTest;game.setMap('town');__gameTest.render();const before={...g.renderer.info.memory};for(let i=0;i<24;i++){game.setMap(['factory','harbor','town'][i%3]);__gameTest.render();}return {before,after:{...g.renderer.info.memory},roots:g.scene.children.filter(c=>c.name.startsWith('map:')).length,labels:g.labels.length,attached:g.labels.every(l=>l.parent?.name==='map:town'),id:world.id};});
 check('24 map swaps do not grow GPU geometry or texture resources',resources.before.geometries===resources.after.geometries&&resources.before.textures===resources.after.textures,resources);
 check('map swaps leave only current map root and labels',resources.roots===1&&resources.attached&&resources.id==='town',resources);
 await context.close();context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));const cdp=await context.newCDPSession(page);
 await page.goto('http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);await page.locator('#map-factory').tap();await page.locator('#start-btn').tap();await page.locator('#buy-close').tap();await page.evaluate(()=>{__gameTest.game.ai.update=()=>{};advanceTime(15100);});
 const centers=await page.evaluate(()=>{const center=id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};};return {stick:center('#move-stick'),fire:center('#fire-button')};});
 const points=[{id:1,x:centers.stick.x,y:centers.stick.y},{id:2,x:centers.fire.x,y:centers.fire.y}];await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
 const before=await page.evaluate(()=>JSON.parse(render_game_to_text()));points[0].y-=32;points[1].x+=35;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points});await page.evaluate(()=>advanceTime(400));const after=await page.evaluate(()=>JSON.parse(render_game_to_text()));
 check('independent two-finger gesture moves aims and fires',Math.hypot(after.player.x-before.player.x,after.player.z-before.player.z)>.2&&Math.abs(after.camera.yaw-before.camera.yaw)>.03&&after.combat.shots>before.combat.shots,{before,after});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});const cancelled=await page.evaluate(()=>JSON.parse(render_game_to_text()));check('touch cancel pauses and releases both fingers',cancelled.mode==='paused'&&!cancelled.touch.fire&&cancelled.touch.x===0&&cancelled.touch.z===0,cancelled.touch);
 await page.screenshot({path:out+'/factory-mobile-cancelled.png'});check('no page or console errors in independent browser audit',errors.length===0,errors);
}finally{fs.writeFileSync(out+'/report.json',JSON.stringify({checks,errors},null,2));await context?.close();await browser.close();}
console.log(`PASS ${checks.length} independent browser checks`);
