import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const base=process.argv.slice(2).find(v=>!v.startsWith('--'))||'http://localhost:5180/';
const folder='output/space-runtime'+(base.startsWith('file:')?'-offline':base.startsWith('https:')?'-live':'');
fs.mkdirSync(folder,{recursive:true});
const errors=[],checks=[],measurements=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name}`);assert.ok(pass,`${name}: ${JSON.stringify(detail)}`);};
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
await context.addInitScript(()=>localStorage.setItem('bean-frontier-onboarding',JSON.stringify({version:1})));
if(base.startsWith('file:'))await context.setOffline(true);
const requests=[];const page=await context.newPage();page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/context.*lost/i.test(m.text()))errors.push(m.text());});
const url=(query='')=>{const u=new URL(base);u.search=query;return u.href;};
const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
const ready=async query=>{await page.goto(url(query));await page.waitForFunction(()=>typeof render_game_to_text==='function',null,{timeout:90000});};
const start=async id=>{if(id)await page.locator(`[data-map="${id}"]`).click();await page.locator('#start-btn').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).mode==='playing',null,{timeout:90000});};
const home=async()=>{await page.evaluate(()=>{if(__gameTest.game.state.mode==='playing')__gameTest.game.pause();});await page.locator('#home').click();};
try{
 await ready();let s=await state();check('production lobby has no mutation API or decoded navigation',!await page.evaluate(()=>!!window.__gameTest)&&s.mode==='ready'&&s.loading.navigation.decodedMap===null,s.loading);
 await start('assault');s=await state();check('production start asynchronously loads only selected navigation',s.loading.state==='ready'&&s.loading.navigation.decodedMap==='assault'&&s.loading.navigation.worker,s.loading);
 await page.screenshot({path:`${folder}/assault-first-launch.png`});
 await ready('test&lazy');check('debug lazy fixture follows lightweight production lobby',!await page.evaluate(()=>__gameTest.world.loaded)&&(await state()).loading.navigation.decodedMap===null);
 // Delay a real decode result, retaining production sequence checks. Cancel
 // after navigation is ready but before scene construction.
 await page.evaluate(()=>{const w=__gameTest.world,original=w.prepareMap;w.prepareMap=async(...args)=>{const value=await original(...args);await new Promise(r=>setTimeout(r,500));return value;};window.__prepareOriginal=original;});
 await page.locator('#start-btn').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).loading.navigation.state==='ready');
 const frozen=(await state()).time;await page.evaluate(()=>advanceTime(10000));check('loading freezes match clock',(await state()).time===frozen);
 await page.locator('#map-loading-cancel').click();await page.waitForTimeout(650);s=await state();check('cancelled asynchronous start cannot enter a round or retain decoded map',s.mode==='ready'&&s.loading.state==='idle'&&s.loading.navigation.decodedMap===null&&!await page.evaluate(()=>__gameTest.world.loaded),s.loading);
 await page.evaluate(()=>{__gameTest.world.prepareMap=window.__prepareOriginal;});
 await start('dust2');s=await state();check('start after cancellation selects correct map without stale cache',s.map.id==='dust2'&&s.loading.navigation.decodedMap==='dust2',s.map);
 await home();check('return to lobby disposes full world and decoded navigation',!await page.evaluate(()=>__gameTest.world.loaded)&&(await state()).loading.navigation.decodedMap===null);
 await page.evaluate(()=>{const w=__gameTest.world,original=w.prepareMap;w.prepareMap=async()=>{w.prepareMap=original;throw new Error('fixture decode failure');};});
 await page.locator('#start-btn').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).loading.state==='error');
 check('load error leaves game stopped with visible retry',await page.locator('#map-loading-retry').isVisible()&&(await state()).mode==='ready');
 await page.locator('#map-loading-retry').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).mode==='playing',null,{timeout:90000});check('retry completes without reloading page',(await state()).loading.state==='ready');
 await home();await page.evaluate(()=>{const g=__gameTest.g,original=g.decorateSurface;g.decorateSurface=(...args)=>{g.decorateSurface=original;throw new Error('fixture scene construction failure');};});await page.locator('#start-btn').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).loading.state==='error');check('failed scene construction disposes partial world',!await page.evaluate(()=>__gameTest.world.loaded)&&!await page.evaluate(()=>__gameTest.world.navigation));await page.locator('#map-loading-retry').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).mode==='playing',null,{timeout:90000});check('scene construction retry builds collision and navigation',await page.evaluate(()=>__gameTest.world.loaded&&!!__gameTest.world.navigation&&!!__gameTest.world.bvh));
 await home();await page.evaluate(()=>{const w=__gameTest.world,original=w.prepareMap;w.prepareMap=async(...args)=>{const value=await original(...args);await new Promise(r=>setTimeout(r,400));return value;};});
 await page.locator('[data-map="assault"]').click();await page.locator('#start-btn').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).loading.state==='loading');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForFunction(()=>JSON.parse(render_game_to_text()).loading.state==='ready',null,{timeout:90000});
 check('interruption during loading enters a paused round with cleared input',(await state()).mode==='paused'&&!(await state()).touch.fire);
 await ready('test&lazy');await page.evaluate(()=>{window.Worker=class{constructor(){throw new Error('fixture unavailable Worker');}};});await start('assault');check('worker unavailable uses offline-compatible fallback',!(await state()).loading.navigation.worker&&(await state()).loading.navigation.decodedMap==='assault');
 await ready('test&lazy');await start('assault');await page.evaluate(()=>{__gameTest.game.ai.update=()=>{};advanceTime(15000);});
 // Keep two opposing teams visible for representative gameplay submission.
 for(const id of ['assault','dust2']){
  if((await state()).map.id!==id){await home();await start(id);await page.evaluate(()=>advanceTime(15000));}
  await page.evaluate(()=>{__gameTest.game.ai.update=()=>{};__gameTest.input.reset();__gameTest.setBuy(false);});
  await page.waitForTimeout(1800);await page.evaluate(()=>advanceTime(0));s=await state();measurements.push({map:id,kind:'spawn browser sample',...s.performance});
  const matrices=await page.evaluate(()=>{const {g,game,render}=__gameTest;const actors=[...game.actors,...game.hostages.list];render();const batched=g.renderer.info.render.calls;actors.forEach(a=>g.actorBatches.unregister(a));g.actorBatches.update();render();const direct=g.renderer.info.render.calls;actors.forEach(a=>g.actorBatches.register(a));render();return {batched,direct,restored:g.renderer.info.render.calls,metrics:g.actorBatches.metrics()};});
  check(`${id} actor batching restores rendering and reduces calls`,matrices.restored===matrices.batched&&matrices.batched<=matrices.direct,matrices);measurements.push({map:id,kind:'same scene actor batching',...matrices});
  check(`${id} mobile spawn within 300 draw-call budget`,s.performance.drawCalls<=300,s.performance);
  await page.screenshot({path:`${folder}/${id}-mobile.png`});
  const persistent=await page.evaluate(()=>{const node=document.querySelector('#map svg');advanceTime(100);return node===document.querySelector('#map svg');});check(`${id} minimap retains static SVG across updates`,persistent);
  if(id==='dust2'){const sizes=await page.evaluate(()=>[...document.querySelectorAll('#map svg text')].map(t=>{const m=t.getScreenCTM();return parseFloat(getComputedStyle(t).fontSize)*Math.hypot(m.a,m.b);}));check('Dust2 minimap labels remain at least 11 CSS pixels',sizes.length===2&&sizes.every(n=>n>=10.8),sizes);}
 }
 const mem=[];for(let i=0;i<4;i++){await home();await start(i%2?'dust2':'assault');await page.evaluate(()=>advanceTime(0));const p=(await state()).performance;mem.push({map:(await state()).map.id,geometries:p.geometries,textures:p.textures,actors:p.actorBatches.actors});}
 check('repeated map switches keep actor registrations bounded',mem.every(m=>m.actors<=14),mem);
 check('same-map geometry counts do not grow after repeated release/reload',mem[2].geometries<=mem[0].geometries+3&&mem[3].geometries<=mem[1].geometries+3,mem);
 await page.evaluate(()=>{__gameTest.game.ai.update=()=>{};__gameTest.setBuy(false);advanceTime(15000);window.__lost=__gameTest.g.renderer.getContext().getExtension('WEBGL_lose_context');window.__lost.loseContext();});
 await page.waitForFunction(()=>JSON.parse(render_game_to_text()).loading.contextLost);s=await state();check('real WebGL loss pauses match and clears input',s.mode==='paused'&&!s.touch.fire&&!s.audio.playing,s.loading);
 const lostTime=s.time;await page.evaluate(()=>advanceTime(10000));check('context loss freezes physical and round clocks',(await state()).time===lostTime);
 await page.waitForTimeout(500);await page.evaluate(()=>window.__lost.restoreContext());await page.waitForFunction(()=>!JSON.parse(render_game_to_text()).loading.contextLost,null,{timeout:30000});
 check('restored WebGL stays paused until explicit resume',(await state()).mode==='paused');await page.locator('#resume').click();await page.waitForTimeout(100);check('restored materials and world render after resume',(await state()).mode==='playing'&&(await state()).performance.drawCalls>0);
 await page.screenshot({path:`${folder}/context-restored.png`});
 if(base.startsWith('file:'))check('offline runtime issues no network requests',requests.every(v=>!/^https?:/.test(v)),requests);
 check('browser runtime remains error free',errors.length===0,errors);
}finally{fs.writeFileSync(`${folder}/report.json`,JSON.stringify({base,checks,errors,requests,measurements,limitations:['Browser CPU/render submission measurements are not physical iPhone GPU FPS or thermal measurements.','Representative spawn views are not worst-case visibility coverage.']},null,2));await context.close();await browser.close();}
