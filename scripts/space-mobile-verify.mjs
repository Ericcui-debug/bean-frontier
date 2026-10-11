import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

// Connect only to the user-approved dedicated Codex browser. Each run owns a
// new context and closes only that context; unrelated tabs are never touched.
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
const page=await context.newPage(),cdp=await context.newCDPSession(page),checks=[],errors=[];
const url=process.argv.slice(2).find(a=>!a.startsWith('--'))||'http://localhost:5180/?test';
const output='output/space-mobile'+(url.startsWith('file:')?'-offline':url.startsWith('https:')?'-live':'');
fs.mkdirSync(output,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});console.log(`${pass?'PASS':'FAIL'} ${name}`);assert.ok(pass,`${name}: ${JSON.stringify(detail??'')}`);};
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=async ms=>{await page.evaluate(ms=>advanceTime(ms),ms);await page.waitForTimeout(75);await page.evaluate(()=>advanceTime(0));};
let points=[];
const touch=async(type,next=[])=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:next});points=(type==='touchEnd'||type==='touchCancel')?[]:next;};
const release=async()=>{if(points.length)await touch('touchEnd');};
const point=async(selector,id=1)=>{const r=await page.locator(selector).boundingBox();assert.ok(r,selector);return {id,x:r.x+r.width/2,y:r.y+r.height/2,radiusX:4,radiusY:4,force:1};};
const tap=async selector=>{await touch('touchStart',[await point(selector)]);await touch('touchEnd');};
const start=async()=>{await tap('#start-btn');await page.waitForFunction(()=>__gameTest.game.state.mode==='playing',null,{timeout:90000});await page.evaluate(()=>__gameTest.game.ai.update=()=>{});await tick(15000);};
const active=async()=>{await release();await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');await page.evaluate(()=>{__gameTest.input.reset();if(__gameTest.game.state.mode==='paused')__gameTest.game.pause();});await tick(0);};

try{
 await page.goto(url);await page.waitForFunction(()=>window.__gameTest,null,{timeout:90000});
 await page.evaluate(()=>{localStorage.removeItem('bean-frontier-onboarding');localStorage.setItem('bean-frontier-settings',JSON.stringify({music:false,sound:true,lookSensitivity:1.2,adsSensitivity:.55,buttonSize:1.25,buttonOpacity:.55,fps:30}));});
 await page.reload();await page.waitForFunction(()=>window.__gameTest,null,{timeout:90000});
 await tap('#start-btn');await page.waitForSelector('#onboarding:not(.hidden)',{timeout:90000});
 check('first launch shows guide before the round starts',(await state()).mode==='ready');
 check('guide first step is accessible and all guide controls have large targets',await page.locator('#onboarding').evaluate(e=>e.getAttribute('aria-modal')==='true'&&[...e.querySelectorAll('button')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44;})));
 await tap('#guide-next');check('guide advances through shooting instruction',(await page.locator('#guide-step').textContent())==='2 / 3');
 await tap('#guide-back');check('guide can return to first instruction',(await page.locator('#guide-step').textContent())==='1 / 3');
 await tap('#guide-skip');await page.waitForFunction(()=>__gameTest.game.state.mode==='playing',null,{timeout:90000});
 const prefs=await page.evaluate(()=>({guide:JSON.parse(localStorage.getItem('bean-frontier-onboarding')),settings:JSON.parse(localStorage.getItem('bean-frontier-settings'))}));
 check('skip saves only guide completion and preserves prior audio/layout settings',prefs.guide.version===1&&!prefs.settings.music&&prefs.settings.sound&&prefs.settings.buttonSize===1.25,prefs);
 await page.evaluate(()=>__gameTest.game.ai.update=()=>{});await tick(15000);
 const stick=await point('#move-stick',1),fire=await point('#fire-button',2),before=await state();
 await touch('touchStart',[stick,fire]);await touch('touchMove',[{...stick,y:stick.y-55},{...fire,x:fire.x-30,y:fire.y-5}]);await tick(300);
 let s=await state();check('dual fingers still move, drag aim and fire',s.touch.z>.9&&s.touch.fire&&s.combat.shots>before.combat.shots&&s.camera.yaw<before.camera.yaw-.05,s.touch);await release();
 const cameraStart=await page.evaluate(()=>__gameTest.game.camera.state.yaw),blank={id:1,x:250,y:85,radiusX:4,radiusY:4,force:1};
 await touch('touchStart',[blank]);await touch('touchMove',[{...blank,x:270}]);
 check('upper-left unused screen now accepts look gestures',(await page.evaluate(()=>__gameTest.game.camera.state.yaw))-cameraStart>.02);await release();
 await page.keyboard.down('KeyW');await tick(80);check('touch-capable browser also accepts WASD',(await state()).touch.z===1);
 await page.keyboard.down('KeyD');const hybridStick=await point('#move-stick');await touch('touchStart',[hybridStick]);await touch('touchMove',[{...hybridStick,y:hybridStick.y-55}]);await tick(50);
 s=await state();check('combined keyboard and joystick cannot boost movement above one',Math.hypot(s.touch.x,s.touch.z)<=1.00001&&s.touch.x>0&&s.touch.z>0,s.touch);await release();await page.keyboard.up('KeyW');await page.keyboard.up('KeyD');
 await active();await page.evaluate(()=>document.querySelector('#fire-button').addEventListener('pointerdown',e=>window.__lastFirePointer=e.pointerId,{once:true}));const lostCapture=await point('#fire-button');await touch('touchStart',[lostCapture]);await touch('touchMove',[{...lostCapture,x:lostCapture.x-1}]);await page.evaluate(()=>document.querySelector('#fire-button').releasePointerCapture(window.__lastFirePointer));await touch('touchMove',[{...lostCapture,x:lostCapture.x-2}]);await page.waitForTimeout(75);
 check('native lost capture immediately releases the fire action',!(await state()).touch.fire);await release();
 await page.evaluate(()=>{const el=document.querySelector('#fire-button');window.__savedCapture=el.setPointerCapture;el.setPointerCapture=()=>{throw new DOMException('fixture capture unavailable');};});const failedCapture=await point('#fire-button');await touch('touchStart',[failedCapture]);await touch('touchMove',[{...failedCapture,x:260,y:110}]);await release();await page.evaluate(()=>{document.querySelector('#fire-button').setPointerCapture=window.__savedCapture;delete window.__savedCapture;});
 check('window release recovers an action when pointer capture fails',!(await state()).touch.fire&&(await state()).touch.x===0&&(await state()).touch.z===0);
 await touch('touchStart',[await point('#move-stick',1),await point('#fire-button',2)]);await touch('touchCancel');s=await state();
 check('any actual touch cancellation pauses whole game and releases all fingers',s.mode==='paused'&&!s.touch.fire&&!s.touch.aim&&!s.touch.interactHeld&&s.touch.x===0&&s.touch.z===0&&!s.audio.playing,s.touch);
 check('cancellation explains why play stopped',(await page.locator('#modal-copy').textContent()).includes('触控'));
 await tap('#guide-replay');check('completed guide can replay from paused settings',await page.locator('#onboarding').isVisible());
 await tap('#guide-next');await tap('#guide-next');check('third guide step explains objectives',(await page.locator('#guide-step').textContent())==='3 / 3');await tap('#guide-next');
 check('guide replay returns to paused match without starting a new round',(await state()).mode==='paused'&&(await state()).round===1);
 await page.evaluate(async()=>{const a=__gameTest.game.audio;if(a.ctx?.state==='running')await a.ctx.suspend();});await tap('#resume');await page.waitForFunction(()=>__gameTest.game.audio.ctx?.state==='running',null,{timeout:5000});
 check('foreground user gesture resumes existing AudioContext without changing mute preferences',!(await state()).audio.musicEnabled&&(await state()).audio.effectsEnabled);
 await tap('#pause');await page.evaluate(async()=>{const a=__gameTest.game.audio;a.setMusic(false);a.setEffects(false);await a.ctx.suspend();});await tap('#guide-replay');await page.waitForTimeout(100);
 check('muted and paused guide does not resume audio or enable music',(await state()).audio.context==='suspended'&&!(await state()).audio.musicEnabled&&!(await state()).audio.effectsEnabled&&!(await state()).audio.playing);await tap('#guide-skip');
 await page.evaluate(async()=>{__gameTest.game.audio.setEffects(true);await __gameTest.game.audio.recover();});check('recovering while paused keeps battle and music stopped',!(await state()).audio.playing&&(await state()).mode==='paused');
 for(const fixture of [{width:844,height:390},{width:667,height:375},{width:568,height:320},{width:390,height:844},{width:375,height:667}]){
  await page.setViewportSize(fixture);await page.waitForTimeout(150);await active();await page.evaluate(()=>__gameTest.input.setLayout({size:1.25}));await tick(0);
  const result=await page.evaluate(()=>{
   const sels=['#move-stick','#fire-button','#left-fire-button','#aim-button','#jump-button','#reload-button','#interact-button','#weapon-secondary','#weapon-primary','#buy-open','#pause','#full'],boxes=sels.map(sel=>{const e=document.querySelector(sel),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {sel,x:r.x,y:r.y,w:r.width,h:r.height,hit:hit===e||e.contains(hit)};}).filter(box=>box.w>0&&box.h>0),overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>2;
   const collision=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(overlap(boxes[i],boxes[j]))collision.push([boxes[i].sel,boxes[j].sel]);
   const tooSmall=[...document.querySelectorAll('#hud *')].filter(e=>[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=='hidden'&&parseFloat(getComputedStyle(e).fontSize)<11).map(e=>[e.id||e.tagName,getComputedStyle(e).fontSize]);
   const viewport=__gameTest.input.getMetrics();return {boxes,collision,tooSmall,viewport:{width:viewport.width,height:viewport.height},visible:{width:visualViewport.width,height:visualViewport.height}};
  });
  check(`maximum controls accessible and non-overlapping ${fixture.width}x${fixture.height}`,result.collision.length===0&&result.boxes.every(b=>b.w>=44&&b.h>=44&&b.hit&&b.x>=0&&b.y>=0&&b.x+b.w<=fixture.width+.1&&b.y+b.h<=fixture.height+.1),result);
  check(`visible mobile information is at least 11 px ${fixture.width}x${fixture.height}`,result.tooSmall.length===0,result.tooSmall);
  check(`cached input and visual viewport agree ${fixture.width}x${fixture.height}`,Math.abs(result.viewport.width-result.visible.width)<.1&&Math.abs(result.viewport.height-result.visible.height)<.1,result);
  if(process.argv.includes('--screenshots')){await page.screenshot({path:`${output}/active-${fixture.width}x${fixture.height}.png`});}
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await active();await page.evaluate(()=>{for(const [name,value] of [['--safe-left','44px'],['--safe-right','44px'],['--safe-bottom','21px']])document.documentElement.style.setProperty(name,value);});await page.waitForTimeout(100);await tick(0);
 const notch=await page.evaluate(()=>['#move-stick','#fire-button','#interact-button','#pause','#full','#round-label','#timer','#score'].map(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {sel,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
 check('notched portrait keeps buttons and score inside safe area',notch.every(r=>r.x>=44-.1&&r.right<=346+.1&&r.bottom<=823+.1),notch);
 await page.evaluate(()=>{for(const k of ['--safe-left','--safe-right','--safe-bottom'])document.documentElement.style.removeProperty(k);});await page.waitForTimeout(100);
 await tap('#pause');await tap('#home');await start();check('completed guide does not reappear on subsequent start',!(await page.locator('#onboarding').isVisible())&&(await state()).mode==='playing');
 check('runtime and console remain error free',errors.length===0,errors);
}finally{
 fs.writeFileSync(`${output}/report.json`,JSON.stringify({url,checks,errors,limitations:['Browser touch emulation is not physical iPhone/Safari performance or feel validation.','Audio context recovery was checked; audible speaker output is not claimed.']},null,2));
 await context.close();await browser.close();
}
