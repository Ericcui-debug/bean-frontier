import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
// The user permits only the dedicated Codex browser, never their regular Chrome profile.
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
const page=await context.newPage(),cdp=await context.newCDPSession(page),checks=[],errors=[];
const out='output/mobile-dual';fs.mkdirSync(out,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,pass,detail)=>{console.log((pass?'PASS ':'FAIL ')+name);checks.push({name,pass:!!pass,detail});assert.ok(pass,name+' '+JSON.stringify(detail??''));};
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const point=async(selector,id=1)=>{const r=await page.locator(selector).boundingBox();assert.ok(r,selector);return {id,x:r.x+r.width/2,y:r.y+r.height/2,radiusX:5,radiusY:5,force:1};};
let touches=[];
const touch=async(type,points=[])=>{if((type==='touchEnd'||type==='touchCancel')&&!touches.length)return;await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});touches=type==='touchCancel'?[]:type==='touchEnd'?(points.length?touches.filter(p=>!points.some(end=>end.id===p.id)):[]):points;};
const tap=async(selector)=>{await touch('touchStart',[await point(selector)]);await touch('touchEnd');};
const release=()=>touch('touchEnd');
const clear=async()=>{await release();await page.evaluate(()=>{const {game}=window.__gameTest;game.reset();game.start();});await advance(0);};
const yaw=()=>page.evaluate(()=>window.__gameTest.game.camera.state.yaw);
const turn=async(action,aim=false)=>{
 await clear();if(aim)await tap('#aim-button');const p=await point(action,1);const initial=await yaw();
 await touch('touchStart',[p]);await touch('touchMove',[{...p,x:p.x+40,y:p.y-5}]);const delta=(await yaw())-initial;await release();return delta;
};
try{
 await page.goto(process.argv[2]||'http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);
 await page.evaluate(()=>localStorage.setItem('bean-frontier-settings',JSON.stringify({music:false,sound:true})));await page.reload();await page.waitForFunction(()=>window.__gameTest);
 const migrated=await page.evaluate(()=>({sensitivity:window.__gameTest.input.getSensitivity(),audio:window.__gameTest.game.audio.status()}));
 check('old audio preferences survive sensitivity defaults',migrated.audio.musicEnabled===false&&migrated.audio.effectsEnabled===true&&migrated.sensitivity.look===1&&migrated.sensitivity.ads===.6,migrated);
 await tap('#start-btn');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='playing');await advance(0);
 const stick=await point('#move-stick',1),fire=await point('#fire-button',2),initial=await state();
 await touch('touchStart',[stick,fire]);await touch('touchMove',[{...stick,y:stick.y-50},{...fire,x:fire.x-45,y:fire.y-12}]);await advance(330);const dual=await state();
 check('two real fingers move, drag aim and shoot simultaneously',dual.touch.z>.9&&dual.touch.sprint&&dual.touch.fire&&dual.combat.shots>initial.combat.shots&&dual.camera.yaw<initial.camera.yaw-.18&&dual.camera.pitch>initial.camera.pitch+.04&&Math.hypot(dual.player.x-initial.player.x,dual.player.z-initial.player.z)>1,{before:initial.player,after:dual.player,touch:dual.touch});
 await release();check('two-finger release clears controls',(await state()).touch.z===0&&!(await state()).touch.fire&&!(await state()).touch.sprint);
 for(const [direction,x,y,sprint] of [['forward',0,-55,true],['backward',0,55,false],['left',-55,0,false],['right',55,0,false]]){
  await clear();const p=await point('#move-stick');await touch('touchStart',[p]);await touch('touchMove',[{...p,x:p.x+x,y:p.y+y}]);const s=await state();check('outer stick '+direction+' sprint policy',s.touch.sprint===sprint,s.touch);await release();
 }
 await clear();const left=await point('#left-fire-button',1),y0=await yaw();await touch('touchStart',[left]);await touch('touchMove',[{...left,x:left.x+30,y:left.y+20}]);await advance(220);check('left fire shoots without changing camera yaw',(await state()).combat.shots>0&&Math.abs((await yaw())-y0)<1e-7);await release();
 await clear();const pStick=await point('#move-stick',1),pLeft=await point('#left-fire-button',2),pLook={id:3,x:570,y:225,radiusX:5,radiusY:5,force:1};const y3=await yaw();await touch('touchStart',[pStick,pLeft,pLook]);await touch('touchMove',[{...pStick,y:pStick.y-45},pLeft,{...pLook,x:pLook.x+28}]);await advance(260);const triple=await state();check('optional three-finger left-fire route',triple.touch.z>.9&&triple.touch.fire&&triple.combat.shots>0&&triple.camera.yaw>y3+.1);await release();
 await clear();const lookA={id:1,x:510,y:210,radiusX:5,radiusY:5,force:1},fireB=await point('#fire-button',2);const ownerYaw=await yaw();
 await touch('touchStart',[lookA,fireB]);await touch('touchMove',[{...lookA,x:lookA.x+20},{...fireB,x:fireB.x-30}]);let yOwner=await yaw();check('only one finger owns camera',Math.abs(yOwner-ownerYaw-.1)<.005,{delta:yOwner-ownerYaw});
 const movedB={...fireB,x:fireB.x-30};await touch('touchEnd',[{...lookA,x:lookA.x+20}]);const afterUp=await yaw();await touch('touchMove',[{...movedB,x:movedB.x-20}]);check('replacement finger starts from latest position without jump',Math.abs((await yaw())-afterUp+.1)<.005,{before:afterUp,after:await yaw()});await release();
 const normal=await turn('#fire-button'),ads=await turn('#fire-button',true);check('ADS default is 60% of normal actual turn',Math.abs(ads/normal-.6)<.02,{normal,ads,ratio:ads/normal});
 await clear();await tap('#aim-button');const aimStick=await point('#move-stick',1),aimFire=await point('#fire-button',2);await touch('touchStart',[aimStick,aimFire]);await touch('touchMove',[{...aimStick,y:aimStick.y-40},{...aimFire,x:aimFire.x-20}]);await advance(280);const adsState=await state();check('ADS toggle survives dual-thumb firing',adsState.touch.aim&&adsState.camera.aim&&adsState.camera.fov<46&&adsState.touch.fire&&adsState.combat.shots>0);await release();await tap('#aim-button');
 await clear();const l=await point('#left-fire-button',1),r=await point('#fire-button',2);await touch('touchStart',[l,r]);await touch('touchEnd',[l]);check('releasing one fire retains other held fire',(await state()).touch.fire);await release();check('last fire release stops firing',!(await state()).touch.fire);
 await clear();await tap('#aim-button');await touch('touchStart',[await point('#move-stick',1),await point('#fire-button',2)]);await touch('touchCancel');let s=await state();check('touch cancellation pauses and clears every held/toggled input',s.mode==='paused'&&!s.touch.aim&&!s.touch.fire&&!s.touch.sprint&&s.touch.x===0&&s.touch.z===0&&!s.audio.playing);await tap('#resume');
 await tap('#pause');check('settings visible in mobile pause',await page.locator('#mobile-settings').isVisible());
 await page.evaluate(()=>{for(const [id,value] of [['camera-sensitivity','1.25'],['ads-sensitivity','.4']]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));}});
 const saved=await page.evaluate(()=>({settings:JSON.parse(localStorage.getItem('bean-frontier-settings')),values:window.__gameTest.input.getSensitivity(),look:document.querySelector('#camera-sensitivity-value').textContent,ads:document.querySelector('#ads-sensitivity-value').textContent}));
 check('sensitivity sliders preserve audio and update values',saved.settings.music===false&&saved.settings.sound===true&&saved.settings.lookSensitivity===1.25&&saved.settings.adsSensitivity===.4&&saved.values.look===1.25&&saved.values.ads===.4&&saved.look==='125%'&&saved.ads==='40%',saved);
 await page.screenshot({timeout:8000,path:out+'/pause-settings.png'});await page.reload();await page.waitForFunction(()=>window.__gameTest);const restored=await page.evaluate(()=>window.__gameTest.input.getSensitivity());check('sensitivity survives reload',restored.look===1.25&&restored.ads===.4,restored);await tap('#start-btn');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='playing');
 const changedNormal=await turn('#fire-button'),changedAds=await turn('#fire-button',true);check('normal and ADS sensitivity sliders affect real drag deltas',Math.abs(changedNormal-.25)<.005&&Math.abs(changedAds-.08)<.005,{changedNormal,changedAds});
 const clamped=await page.evaluate(()=>{const i=window.__gameTest.input;i.setSensitivity({look:100,ads:-1});const bounds=i.getSensitivity();i.setSensitivity({look:NaN,ads:Infinity});const invalid=i.getSensitivity();i.setSensitivity({look:1,ads:.6});return {bounds,invalid};});check('sensitivity clamps finite values and rejects invalid numbers',clamped.bounds.look===1.5&&clamped.bounds.ads===.2&&clamped.invalid.look===1.5&&clamped.invalid.ads===.2,clamped);
 for(const size of [{width:844,height:390},{width:667,height:375},{width:568,height:320},{width:390,height:844},{width:375,height:667}]){
  await page.setViewportSize(size);if((await state()).mode==='paused')await tap('#resume');await advance(0);
  // Include visible hints and a running challenge, rather than only testing an empty HUD.
  await page.evaluate(()=>{document.querySelector('#toast').textContent='捡到补给 · 生命与弹药已恢复';document.querySelector('#toast').classList.add('show');document.querySelector('#interact-hint').textContent='点击互动 · 开始射靶挑战';document.querySelector('#challenge-hud').textContent='★ 射靶挑战　2/6　30 秒';document.querySelector('#challenge-hud').classList.remove('hidden');});
  const geometry=await page.evaluate(()=>{
   const controlSelectors=['#move-stick','#fire-button','#left-fire-button','#jump-button','#aim-button','#reload-button','#interact-button','[data-weapon="0"]','[data-weapon="1"]','[data-weapon="2"]'];
   const rect=sel=>{const e=document.querySelector(sel),r=e.getBoundingClientRect();return {sel,x:r.x,y:r.y,w:r.width,h:r.height};};
   const controls=controlSelectors.map(sel=>{const e=document.querySelector(sel),r=rect(sel),hit=document.elementFromPoint(r.x+r.w/2,r.y+r.h/2);return {...r,hit:e===hit||e.contains(hit)};});
   const intersects=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>2;
   const overlaps=[];for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++)if(intersects(controls[i],controls[j]))overlaps.push([controls[i].sel,controls[j].sel]);
   const reticle=rect('#crosshair'),map=rect('#map'),key=rect('.map-key'),hints=['#toast','#challenge-hud','#interact-hint'].map(rect);
   for(const c of controls)for(const v of [map,key,...hints])if(intersects(c,v))overlaps.push([c.sel,v.sel]);
   return {controls,overlaps,hints,reticle,hintsAtCrosshair:hints.filter(h=>intersects(h,reticle)),rotate:getComputedStyle(document.querySelector('#rotate-hint')).display};
  });
  check(`controls exposed and in viewport ${size.width}x${size.height}`,geometry.controls.every(b=>b.hit&&b.x>=0&&b.y>=0&&b.x+b.w<=size.width&&b.y+b.h<=size.height),geometry.controls);
  check(`controls, map, messages stay separated ${size.width}x${size.height}`,geometry.overlaps.length===0,geometry.overlaps);
  check(`messages avoid reticle ${size.width}x${size.height}`,geometry.hintsAtCrosshair.length===0,geometry.hintsAtCrosshair);
  check(`portrait guidance ${size.width}x${size.height}`,size.height>size.width?geometry.rotate!=='none':geometry.rotate==='none');
  await page.screenshot({timeout:8000,path:out+`/mobile-${size.width}x${size.height}.png`});
  await tap('#pause');const modal=await page.locator('.modal-content').evaluate(e=>{const r=e.getBoundingClientRect();return {height:r.height,scroll:e.scrollHeight,viewport:innerHeight};});check(`pause settings remain scrollable in ${size.width}x${size.height}`,modal.height<=size.height&&await page.locator('#camera-sensitivity').isVisible(),modal);await tap('#resume');
 }
 await page.setViewportSize({width:844,height:390});if((await state()).mode==='paused')await tap('#resume');
 await page.evaluate(()=>{for(const [k,v] of [['--safe-left','44px'],['--safe-right','44px'],['--safe-bottom','21px']])document.documentElement.style.setProperty(k,v);});
 const safe=await page.evaluate(()=>['#move-stick','#left-fire-button','#fire-button','#jump-button','#aim-button','#reload-button','#interact-button','#weapons','.tools','#map'].map(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {sel,x:r.x,y:r.y,w:r.width,h:r.height};}));
 check('notch and home-indicator safe areas keep controls accessible',safe.every(r=>r.x>=44&&r.x+r.w<=800&&r.y+r.h<=369),safe);
 await page.evaluate(()=>{for(const k of ['--safe-left','--safe-right','--safe-bottom'])document.documentElement.style.removeProperty(k);});
 await clear();await touch('touchStart',[await point('#move-stick',1),await point('#fire-button',2)]);await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenOrientation:{type:'portraitPrimary',angle:0}});await page.waitForTimeout(100);s=await state();check('orientation change pauses and clears dual-thumb gestures',s.mode==='paused'&&!s.touch.fire&&s.touch.z===0);await release();
 check('no browser errors',errors.length===0,errors);console.log(JSON.stringify({checks,errors},null,2));console.log(`PASS ${checks.length} mobile dual-thumb checks`);
}finally{fs.writeFileSync(out+'/report.json',JSON.stringify({checks,errors},null,2));await context.close();await browser.close();}
