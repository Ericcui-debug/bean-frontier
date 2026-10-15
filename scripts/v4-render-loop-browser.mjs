import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const base=process.argv.includes('--offline')?pathToFileURL(path.resolve('Bean-Frontier.html')).href:process.env.GAME_URL||'http://127.0.0.1:5180/';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333'),checks=[],errors=[];
const check=(value,name)=>{assert.ok(value,name);checks.push(name);};
async function measure(page,hz){return page.evaluate(async hz=>{const g=__game;g.settings.setPreference('targetFps',hz);g.test.manual(false);const start=performance.now(),first=g.perf.frames;await new Promise(r=>setTimeout(r,2200));g.test.manual(true);return{seconds:(performance.now()-start)/1000,frames:g.perf.frames-first,state:JSON.parse(render_game_to_text())};},hz);}
try{
 for(const mobile of [false,true]){
  const c=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1440,height:900},deviceScaleFactor:mobile?3:2,hasTouch:mobile,isMobile:mobile});c.setDefaultTimeout(180000);
  try{const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'?test'+(mobile?'&touch=1':''));await page.waitForFunction(()=>window.__game,null,{timeout:120000});await page.evaluate(()=>__game.test.manual(true));await page.locator('#hud-start').click();await page.waitForFunction(()=>__game.world._loaded&&!__game.loading,null,{timeout:120000});await page.evaluate(()=>{advanceTime(0);advanceTime(0);});
   if(!mobile){
    const q=await page.evaluate(()=>({pixels:__game.renderer.domElement.width*__game.renderer.domElement.height,state:JSON.parse(render_game_to_text())}));check(q.pixels<=2_000_001&&q.state.quality.post&&q.state.quality.antialias&&q.state.quality.tier==='high','Retina desktop retains HDR/PBR/MSAA within2M pixels');
    const r=await measure(page,60);check(r.frames>0&&r.frames<=r.seconds*60+3,'real desktop rendering stays within60FPS cap');
    const f=await page.evaluate(()=>__game.perf.frames);await page.waitForTimeout(200);check(await page.evaluate(f=>__game.perf.frames===f,f),'manual time owns simulation and rendering');
    await page.keyboard.down('w');await page.evaluate(()=>__game.pause());check(await page.evaluate(()=>!__game.input.isDown('w')&&__game.paused),'pause clears pending movement');await page.keyboard.up('w');
   }else{
    const a=await measure(page,30);check(a.frames>0&&a.frames<=a.seconds*30+3&&a.state.quality.targetFps===30,'saved30FPS mode uses real render cap');
    const b=await measure(page,60);check(b.frames>0&&b.frames<=b.seconds*60+3&&b.state.quality.targetFps===60,'phone60FPS mode uses real render cap');
    check(b.state.quality.antialias&&!b.state.quality.post&&b.state.quality.pixelRatio>=1&&b.state.quality.pixelRatio<=1.5&&b.state.perf.physicsHz===120,'phone MSAA/resolution and120Hz physics remain intact');
   }
  }finally{await c.close();}
 }
 check(errors.length===0,'no real-clock browser exceptions');fs.mkdirSync('output/desktop-perf',{recursive:true});fs.writeFileSync('output/desktop-perf/'+(process.argv.includes('--offline')?'offline-':'')+'render-loop.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({ok:true,checks:checks.length,errors}));
}finally{await browser.close();}
