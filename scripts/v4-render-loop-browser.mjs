import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const base=process.argv.includes('--offline')?pathToFileURL(path.resolve('Bean-Frontier.html')).href:process.env.GAME_URL||'http://127.0.0.1:5180/';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333'),checks=[],errors=[],samples=[];
fs.mkdirSync('output/desktop-perf',{recursive:true});
const reportPath='output/desktop-perf/'+(process.argv.includes('--offline')?'offline-':'')+'render-loop.json';
const save=extra=>fs.writeFileSync(reportPath,JSON.stringify({checks,errors,samples,...extra},null,2));
const check=(value,name)=>{assert.ok(value,name);checks.push(name);};
async function measure(page,hz){
 await page.bringToFront();
 const initial=await page.evaluate(hz=>{const g=__game;g.settings.setPreference('targetFps',hz);if(g.paused)g.resume();g.test.manual(false);return g.perf.frames;},hz);
 // Shader completion / a software GPU can delay the first RAF beyond a short
 // wall-clock sample. Start after a real paint and include at least2 paints.
 await page.waitForFunction(first=>__game.perf.frames>first,initial,{polling:100,timeout:120000});
 const result=await page.evaluate(async()=>{const g=__game,start=performance.now(),first=g.perf.frames;
  while((performance.now()-start<2200||g.perf.frames-first<2)&&performance.now()-start<60000)await new Promise(r=>setTimeout(r,100));
  g.test.manual(true);return{seconds:(performance.now()-start)/1000,frames:g.perf.frames-first,visibility:document.visibilityState,state:JSON.parse(render_game_to_text())};
 });samples.push({hz,...result});save();return result;
}
try{
 for(const mobile of [false,true]){
  const c=await browser.newContext({viewport:mobile?{width:844,height:390}:process.env.CI?{width:960,height:540}:{width:1440,height:900},deviceScaleFactor:mobile?(process.env.CI?1:3):2,hasTouch:mobile,isMobile:mobile});c.setDefaultTimeout(180000);
  const page=await c.newPage();
  try{if(process.env.PERF_CPU_THROTTLE){const session=await c.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.PERF_CPU_THROTTLE)});}
   page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'?test'+(mobile?'&touch=1':''));await page.waitForFunction(()=>window.__game,null,{timeout:120000});await page.evaluate(()=>__game.test.manual(true));await page.locator('#hud-start').click();await page.waitForFunction(()=>__game.world._loaded&&!__game.loading,null,{timeout:120000});await page.evaluate(()=>{advanceTime(0);advanceTime(0);});
   if(!mobile){
    const q=await page.evaluate(()=>({pixels:__game.renderer.domElement.width*__game.renderer.domElement.height,state:JSON.parse(render_game_to_text())}));check(q.pixels<=2_000_001&&q.state.quality.post&&q.state.quality.antialias&&q.state.quality.tier==='high','Retina desktop retains HDR/PBR/MSAA within2M pixels');
    const r=await measure(page,60);check(r.state.mode==='playing'&&r.frames>=2&&r.frames<=r.seconds*60+3,'real desktop rendering stays within60FPS cap: '+JSON.stringify(r));
    const f=await page.evaluate(()=>__game.perf.frames);await page.waitForTimeout(200);check(await page.evaluate(f=>__game.perf.frames===f,f),'manual time owns simulation and rendering');
    await page.keyboard.down('w');await page.evaluate(()=>__game.pause());check(await page.evaluate(()=>!__game.input.isDown('w')&&__game.paused),'pause clears pending movement');await page.keyboard.up('w');
   }else{
    const a=await measure(page,30);check(a.state.mode==='playing'&&a.frames>=2&&a.frames<=a.seconds*30+3&&a.state.quality.targetFps===30,'saved30FPS mode uses real render cap');
    const b=await measure(page,60);check(b.state.mode==='playing'&&b.frames>=2&&b.frames<=b.seconds*60+3&&b.state.quality.targetFps===60,'phone60FPS mode uses real render cap');
    check(b.state.quality.antialias&&!b.state.quality.post&&b.state.quality.pixelRatio>=1&&b.state.quality.pixelRatio<=1.5&&b.state.perf.physicsHz===120,'phone MSAA/resolution and120Hz physics remain intact');
   }
  }catch(error){save({failure:String(error),diagnostic:await page.evaluate(()=>({state:typeof render_game_to_text==='function'?JSON.parse(render_game_to_text()):null,visibility:document.visibilityState})).catch(()=>null)});await page.screenshot({path:'output/desktop-perf/render-loop-failure.png',timeout:120000}).catch(()=>{});throw error;}finally{await c.close();}
 }
 check(errors.length===0,'no real-clock browser exceptions');save();console.log(JSON.stringify({ok:true,checks:checks.length,errors}));
}finally{await browser.close();}
