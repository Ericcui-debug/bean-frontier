import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const offline=process.argv.includes('--offline'),pages=process.argv.includes('--pages');
const base=offline?pathToFileURL(path.resolve('Bean-Frontier.html')).href:pages?'https://ericcui-debug.github.io/bean-frontier/':process.env.GAME_URL||'http://127.0.0.1:5180/';
const dir=`output/v4/${offline?'offline':pages?'pages':'browser'}`;fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
const errors=[],requests=[],report={base,checks:[],maps:[],errors,requests};
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
const state=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
const check=(ok,label)=>{assert.ok(ok,label);report.checks.push(label);};
async function shot(name){await page.evaluate(()=>advanceTime(0));await page.screenshot({path:`${dir}/${name}.png`});}
async function start(map,team='ct'){
 await page.locator(`[data-map-id="${map}"]`).click();await page.locator(`[data-team="${team}"]`).click();await page.locator('#hud-start').click();
 await page.waitForFunction(()=>window.__game?.state.phase==='freeze'&&!window.__game.loading,null,{timeout:120000});
 await page.evaluate(()=>{__game.test.manual(true);advanceTime(0);});
}
try{
 await page.goto(base+'?test',{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>typeof render_game_to_text==='function',null,{timeout:120000});
 await page.evaluate(()=>__game.test.manual(true));
 check((await state()).mode==='lobby','metadata-only lobby');
 check(await page.evaluate(()=>__game.world.colliders.length===0),'lobby has no map collision/build');
 await start('dustyard','ct');let s=await state();check(s.teamAlive.ct===5&&s.teamAlive.t===5,'CT initial5v5');
 check(await page.evaluate(()=>__game.state.canBuy),'purchase eligibility is initialized without needing a physics tick');
 check(await page.evaluate(()=>__game.camera.position.y>=__game.player.position.y+1.29),'initial camera starts at bean eye height');
 check(s.quality.tier==='high'&&s.quality.post&&s.quality.antialias,'native desktop HDR/PBR+antialias');
 await page.keyboard.press('b');await page.evaluate(()=>advanceTime(0));
 await page.locator('.buy-item').filter({hasText:'M4-A1'}).click();await page.evaluate(()=>advanceTime(800));
 s=await state();check(s.weapon.id==='m4a1'&&s.weapon.slots[1]==='m4a1','real buy UI selects rifle in HUD/inventory');
 await page.keyboard.press('b');await page.evaluate(()=>{__game.hud._setBuyOpen(false);advanceTime(6500);});
 const p0=(await state()).player.position;
 await page.keyboard.down('w');await page.evaluate(()=>advanceTime(500));await page.keyboard.up('w');
 s=await state();check(Math.hypot(s.player.position.x-p0.x,s.player.position.z-p0.z)>.3,'real keyboard movement');
 await page.keyboard.down('Control');await page.evaluate(()=>advanceTime(500));s=await state();check(s.player.crouching,'keyboard crouch');await page.keyboard.up('Control');await page.evaluate(()=>advanceTime(500));
 await page.keyboard.press('Space');await page.evaluate(()=>advanceTime(100));check((await state()).player.position.y>.05,'keyboard jump');await page.evaluate(()=>advanceTime(1000));
 const yaw=(await state()).player.yaw;await page.mouse.move(400,350);await page.mouse.move(540,380);await page.evaluate(()=>advanceTime(20));check(Math.abs((await state()).player.yaw-yaw)>.01,'real mouse aim');
 const mag=(await state()).weapon.ammo.mag;await page.mouse.down();await page.evaluate(()=>advanceTime(250));await page.mouse.up();check((await state()).weapon.ammo.mag<mag,'native rifle trigger consumes ammo');
 await page.keyboard.press('r');await page.evaluate(()=>advanceTime(4000));check((await state()).weapon.ammo.mag===30,'native reload chain');
 await page.keyboard.press('Escape');s=await state();const pausedTimer=s.timer;await page.evaluate(()=>advanceTime(1000));check((await state()).timer===pausedTimer,'pause freezes match time');await page.keyboard.press('Escape');
 // Round boundary retains selected firearm, armor and native inventory.
 await page.evaluate(()=>{const g=__game;g.player.armor=71;g.rounds._endRound('ct','elimination');advanceTime(5010);});s=await state();check(s.weapon.id==='m4a1'&&s.player.armor===71,'survivor gun selection and armor persist next round');
 await page.evaluate(()=>{const g=__game;g.player.takeDamage(10000,{from:g.bots.all.find(b=>b.team==='t')});g.state.phase='live';g.rounds._endRound('ct','time');advanceTime(5010);});s=await state();check(!s.weapon.slots[1]&&s.weapon.id==='usp'&&s.player.armor===0,'death loses primary/armor and resets native pistol');
 // Every real map, native material scopes and full routes; compare fixed images.
 for(const map of ['dustyard','frostline','neon_foundry','harbor','citadel']){
  await page.evaluate(()=>__game.returnToLobby());await start(map);
  const entry={id:map,views:[],metrics:await state()};
  const views=await page.evaluate(()=>{const w=__game.world;const nodes=w.waypoints.nodes;const picks=[{tag:'spawn',pos:w.spawns.ct[0].pos,yaw:w.spawns.ct[0].yaw},{tag:'route',pos:nodes[Math.floor(nodes.length/3)].pos,yaw:.8},{tag:'A',pos:w.bombSites[0].center,yaw:1.7},{tag:'B',pos:w.bombSites[1].center,yaw:-.8},{tag:'interior',pos:nodes[Math.floor(nodes.length*.65)].pos,yaw:-2.6},{tag:'platform',pos:[...nodes].sort((a,b)=>b.pos.y-a.pos.y)[0].pos,yaw:.6},{tag:'wall',pos:w.spawns.ct[0].pos,yaw:Math.PI}];return picks.map(v=>({...v,pos:{x:v.pos.x,y:v.pos.y,z:v.pos.z}}));});
  for(const view of views){await page.evaluate(v=>{const g=__game;g.player.resetForRound({pos:new g.player.position.constructor(v.pos.x,v.pos.y,v.pos.z),yaw:v.yaw});g.player.update(0);g.viewmodel.update(.5);g.renderFrame();},view);await shot(`${map}-${view.tag}`);entry.views.push(view);}
  // AI plays after the player dies. Explicit fixture creates ordinary player death;
  // all bot movement, perception, gunfight and C4 logic run unmodified.
  await page.evaluate(()=>{const g=__game;g.player.resetForRound(g.world.spawns.ct[0]);g.player.takeDamage(10000,{});advanceTime(125000);});
  const played=await state();check(played.round>1||played.scores.ct+played.scores.t>0,`${map}: AI independently resolves dead-player round`);
  const nav=await page.evaluate(()=>__game.world.waypoints.nodes.length);check(nav>=30,`${map}: full native navigation layout`);
  entry.afterAI=played;entry.resources=await page.evaluate(()=>__game.materials.resourceStats());report.maps.push(entry);
 }
 // Human T objective, real held key, no CT defuse privilege accidentally granted.
 await page.evaluate(()=>__game.returnToLobby());await start('dustyard','t');s=await state();check(s.teamAlive.ct===5&&s.teamAlive.t===5&&s.bomb.carrier==='player','T5v5 and initial human C4');
 await page.evaluate(()=>{const g=__game;g.state.phase='live';g.state.timer=3.2;g.state.canBuy=false;g.player.position.copy(g.world.bombSites[0].center);g.player.onGround=true;g.player.velocity.set(0,0,0);for(const b of g.bots.all){b.state='hold';b.thinkTimer=1000;b.fireCooldown=1000;b.hasGoal=false;b.path=null;}});
 await page.keyboard.down('e');await page.evaluate(()=>advanceTime(3200));await page.keyboard.up('e');s=await state();check(s.phase==='planted'&&Math.abs(s.timer-40)<.009,'T human plants at exact3.2deadline via heldE');await shot('T-planted');
 await page.evaluate(()=>__game.restartSession());s=await state();check(s.round===1&&s.scores.ct===0&&s.scores.t===0&&!s.weapon.slots[1]&&s.money===8000&&s.map.id==='dustyard','full restart clears match and preserves map');
 await page.evaluate(()=>{const g=__game;g.state.phase='live';g.state.timer=115;g.player.takeDamage(10000,{});});s=await state();check(s.bomb.dropped&&!s.bomb.carrier,'human death drops C4');
 await page.evaluate(()=>advanceTime(40000));check(!(await state()).bomb.dropped|| (await state()).round>1,'AI retrieves dropped human C4');
 // Fresh production page: no mutable game globals, no backend service calls.
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof render_game_to_text==='function',null,{timeout:120000});
 check(await page.evaluate(()=>typeof window.__game==='undefined'),'production omits mutable game global');await page.locator('#hud-start').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).map.loaded,null,{timeout:120000});
 await page.evaluate(()=>advanceTime(7000));check(['live','planted','roundEnd'].includes((await state()).phase),'production offline start and combat');await page.screenshot({path:`${dir}/production.png`});
 check(errors.length===0,'no console or browser errors');
 if(offline)check(requests.length===0,'self-contained file makes zero HTTP requests');
 else check(requests.every(u=>u.startsWith(base.replace(/\/$/,''))), 'no online room/account/leaderboard requests');
 if(pages){const expected=fs.readFileSync('Bean-Frontier.html'),online=Buffer.from(await(await fetch(base,{cache:'no-store'})).arrayBuffer());check(expected.equals(online),'published bytes equal tested standalone');report.sha256=createHash('sha256').update(online).digest('hex');}
 report.ok=true;console.log(JSON.stringify({ok:true,checks:report.checks.length,maps:report.maps.length,errors:errors.length,offline}));
}catch(error){report.ok=false;report.failure=String(error);try{await page.screenshot({path:`${dir}/failure.png`});report.failureState=await state();}catch{}throw error;}finally{fs.writeFileSync(`${dir}/report.json`,JSON.stringify(report,null,2));await context.close();await browser.close();}
