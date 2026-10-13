import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.GAME_URL||'http://127.0.0.1:5180/',dir=process.env.OUTPUT_DIR||'output/v4/mobile-maps';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333'),context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:3,isMobile:true,hasTouch:true}),page=await context.newPage();
const errors=[],maps=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(ok,label)=>{assert.ok(ok,label);checks.push(label);};
try{
 await page.goto(base+'?test',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__game,null,{timeout:120000});await page.evaluate(()=>__game.test.manual(true));
 for(const id of ['dustyard','frostline','neon_foundry','harbor','citadel']){
  await page.evaluate(()=>__game.returnToLobby());await page.locator(`[data-map-id="${id}"]`).tap();await page.locator('[data-team="ct"]').tap();const started=Date.now();await page.locator('#hud-start').tap();await page.waitForFunction(()=>__game.world._loaded&&!__game.loading&&__game.state.phase==='freeze',null,{timeout:120000});
  const entry={id,loadMs:Date.now()-started,views:[]};
  const quality=await page.evaluate(()=>{const g=__game,gl=g.renderer.getContext();return{tier:g.gfxQuality,post:!!g.post,samples:gl.getParameter(gl.SAMPLES),ratio:g.renderer.getPixelRatio(),library:g.materials.resourceStats()};});
  check(quality.tier==='low'&&!quality.post&&quality.samples>=2&&quality.ratio>=1&&quality.ratio<=1.5,`${id}: low native PBR, no HDR, real MSAA and1–1.5ratio`);entry.quality=quality;
  const views=await page.evaluate(()=>{const w=__game.world,n=w.waypoints.nodes;return[{tag:'spawn',pos:w.spawns.ct[0].pos,yaw:w.spawns.ct[0].yaw},{tag:'route',pos:n[Math.floor(n.length/3)].pos,yaw:.8},{tag:'A',pos:w.bombSites[0].center,yaw:1.7},{tag:'B',pos:w.bombSites[1].center,yaw:-.8},{tag:'interior',pos:n[Math.floor(n.length*.65)].pos,yaw:-2.6},{tag:'platform',pos:[...n].sort((a,b)=>b.pos.y-a.pos.y)[0].pos,yaw:.6},{tag:'wall',pos:w.spawns.ct[0].pos,yaw:Math.PI}].map(v=>({...v,pos:{x:v.pos.x,y:v.pos.y,z:v.pos.z}}));});
  for(const view of views){await page.evaluate(v=>{const g=__game;g.player.resetForRound({pos:new g.player.position.constructor(v.pos.x,v.pos.y,v.pos.z),yaw:v.yaw});g.player.update(0);g.viewmodel.update(.5);advanceTime(0);},view);await page.screenshot({path:`${dir}/${id}-${view.tag}.png`});entry.views.push(view.tag);}
  // Deterministic peaceful objective fixture: navigation/collision/planning and
  // objective timers remain real; only combat/perception are disabled so their
  // reachability can be checked without gunfight outcomes masking route faults.
  const objective=await page.evaluate(()=>{
   const g=__game,b=g.bots;g.restartSession();g.test.setSeed(20261013);g.player.takeDamage(10000,{});
   const original={perceive:b._perceive,enemy:b._enemyVisibleQuick,combat:b._combatFrame,ct:b._thinkCT};
   b._perceive=()=>{};b._enemyVisibleQuick=()=>false;b._combatFrame=()=>{};
   const snapshots=[];let planted=false;
   for(let i=0;i<24;i++){advanceTime(5000);snapshots.push({time:(i+1)*5,phase:g.state.phase,t:b.all.filter(x=>x.team==='t').map(x=>({name:x.name,pos:x.pos.toArray(),state:x.state,blocked:x.blockedTime}))});if(g.state.phase==='planted'){planted=true;break;}if(g.state.phase==='roundEnd')break;}
   b._thinkCT=original.ct;
   if(planted)for(let i=0;i<10&&g.state.phase==='planted';i++){advanceTime(5000);snapshots.push({ctTime:(i+1)*5,phase:g.state.phase,ct:b.all.filter(x=>x.team==='ct').map(x=>({name:x.name,pos:x.pos.toArray(),state:x.state,goal:x.goal?.toArray(),path:x.path?.map(v=>v.toArray()),hasGoal:x.hasGoal,blocked:x.blockedTime,recovery:x.recoveryCount}))});}
   const result={planted,roundResult:g.rounds.lastRoundResult(),phase:g.state.phase,snapshots};
   Object.assign(b,{_perceive:original.perceive,_enemyVisibleQuick:original.enemy,_combatFrame:original.combat,_thinkCT:original.ct});return result;
  });
  entry.objective=objective;maps.push(entry);check(objective.planted,`${id}: native AI walks from spawn and plants`);entry.defusePassed=objective.roundResult?.reason==='defuse';
  // Stable scene metrics, actual short render loop on this DESKTOP browser
  // emulating mobile. No claim about physical iPhone FPS/temperature.
  await page.evaluate(()=>{__game.restartSession();__game.test.manual(false);});await page.waitForTimeout(1200);
  entry.browserMeasurement=await page.evaluate(()=>({fps:__game.fps,perf:{...__game.perf},resources:__game.materials.resourceStats()}));await page.evaluate(()=>__game.test.manual(true));
  // entry was recorded before objective checks
 }
 // Repeat visits: each map's scoped texture count must settle to its own count.
 const visits=[];for(const id of ['dustyard','harbor','dustyard','harbor','dustyard']){await page.evaluate(()=>__game.returnToLobby());await page.locator(`[data-map-id="${id}"]`).tap();await page.locator('#hud-start').tap();await page.waitForFunction(()=>__game.world._loaded&&!__game.loading,null,{timeout:120000});visits.push(await page.evaluate(()=>({id:__game.selectedMapId,resources:__game.materials.resourceStats(),textures:__game.renderer.info.memory.textures})));}
 check(visits.filter(v=>v.id==='dustyard').every(v=>v.resources.textureSets===visits[0].resources.textureSets),'repeated map visits do not accumulate retired texture sets');
 // Explicit browser cutout simulation supplements plain viewport tests.
 await page.setViewportSize({width:844,height:390});await page.addStyleTag({content:'#touch-controls{--safe-l:47px!important;--safe-r:47px!important;--safe-b:21px!important}'});await page.evaluate(()=>{__game.settings.setPreference('buttonSize',1.3);__game.resume();advanceTime(7000);});
 const bounds=await page.evaluate(()=>[...document.querySelectorAll('#touch-controls button:not([hidden]),.tc-stick')].filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,name:e.className};}));
 for(const b of bounds)check(b.x>=47-.1&&b.x+b.w<=844-47+.1&&b.y+b.h<=390-21+.1,`cutout-safe: ${b.name}`);
 await page.screenshot({path:`${dir}/cutout.png`});check(maps.every(m=>m.defusePassed),'every mobile map CT return objective');check(errors.length===0,'all mobile map renders have zero browser errors');
 fs.writeFileSync(`${dir}/report.json`,JSON.stringify({maps,visits,checks,errors,physicalIPhoneTested:false},null,2));console.log(JSON.stringify({ok:true,maps:maps.length,checks:checks.length,errors}));
}catch(error){await page.screenshot({path:`${dir}/failure.png`});fs.writeFileSync(`${dir}/report.json`,JSON.stringify({maps,checks,errors,failure:String(error)},null,2));throw error;}finally{await context.close();await browser.close();}
