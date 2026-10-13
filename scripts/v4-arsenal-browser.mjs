import {chromium} from 'playwright';import fs from 'node:fs';import assert from 'node:assert/strict';
const base=process.env.GAME_URL||'http://127.0.0.1:5180/',dir=process.env.OUTPUT_DIR||'output/v4/arsenal';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333'),context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});const ok=(value,message)=>{assert.ok(value,message);checks.push(message);};
try{
 await page.goto(base+'?test');await page.waitForFunction(()=>window.__game,null,{timeout:120000});await page.evaluate(()=>__game.test.manual(true));await page.locator('#hud-start').click();await page.waitForFunction(()=>__game.world._loaded&&!__game.loading,null,{timeout:120000});await page.evaluate(()=>__game.test.manual(true));await page.mouse.move(650,360);
 for(const id of ['glock','usp','deagle','mp5','ak47','m4a1','awp','knife']){
  await page.evaluate(id=>{const g=__game;g.restartSession();g.state.phase='live';g.state.timer=115;g.hud._setBuyOpen(false);g.weapons.give(id);g.weapons.equip(id);g.test.setSeed(123);g.bots._perceive=()=>{};g.bots._combatFrame=()=>{};
   for(const b of g.bots.all){b.state='hold';b.hasGoal=false;b.path=null;b.thinkTimer=1000;b.moveSpeed=0;}
   const e=g.bots.all.find(b=>b.team==='t');e.pos.copy(g.player.position);e.pos.z+=id==='knife'?1.1:3;e.health=100;e.armor=0;e.alive=true;g.player.pitch=id==='knife'?-.3:-.16;g.player.yaw=Math.PI;g.player.onGround=true;advanceTime(900);window.__target=e;},id);
  const before=await page.evaluate(()=>({hp:__target.health,mag:__game.weapons.currentAmmo()?.mag}));await page.mouse.down();await page.evaluate(()=>advanceTime(250));await page.mouse.up();await page.evaluate(()=>advanceTime(100));
  const after=await page.evaluate(()=>({hp:__target.health,mag:__game.weapons.currentAmmo()?.mag,source:__game.viewmodel._models[__game.weapons.currentId].userData.weaponSource}));ok(after.hp<before.hp,`${id}: actual equipped weapon damages bean target`);if(id!=='knife')ok(after.source==='procedural',`${id}: native detailed firearm model visible`);
 }
 // Three real throws use ordinary mouse down/up, projectile bounce and fuse.
 for(const id of ['hegrenade','flashbang','smokegrenade']){
  await page.evaluate(id=>{const g=__game;g.restartSession();g.state.phase='live';g.state.timer=115;g.weapons.give(id);g.weapons.equip(id);g.player.pitch=.25;g.test.setSeed(12);for(const b of g.bots.all)b.thinkTimer=1000;window.__fx=[];for(const key of ['fx:explosion','fx:flash','fx:smoke'])g.events.on(key,p=>__fx.push({key,pos:p.pos.toArray()}));advanceTime(800);},id);
  await page.mouse.down();await page.evaluate(()=>advanceTime(300));await page.mouse.up();await page.evaluate(()=>advanceTime(6000));
  const event=id==='hegrenade'?'fx:explosion':id==='flashbang'?'fx:flash':'fx:smoke';ok(await page.evaluate(event=>__fx.some(e=>e.key===event),event),`${id}: real projectile/fuse produces native effect`);
  if(id==='smokegrenade')ok(await page.evaluate(()=>__game.combat.smokes.length>0),'smoke creates LOS-blocking cloud');
 }
 // Interruption routes cancel wind-up before synthetic release can throw.
 for(const event of ['blur','orientationchange']){
  await page.evaluate(()=>{const g=__game;g.restartSession();g.state.phase='live';g.weapons.give('hegrenade');g.weapons.equip('hegrenade');advanceTime(800);});
  await page.mouse.down();await page.evaluate(()=>advanceTime(100));await page.evaluate(event=>window.dispatchEvent(new Event(event)),event);await page.mouse.up();
  ok(await page.evaluate(()=>__game.paused&&!__game.input.firing&&__game.weapons._state!=='winding'&&__game.weapons._grenadeCount('hegrenade')===1),`${event}: pauses and cancels grenade without consumption`);await page.evaluate(()=>__game.resume());
 }
 await page.screenshot({path:`dir/complete.png`.replace('dir/',dir+'/')});ok(errors.length===0,'arsenal has no browser errors');fs.writeFileSync(`${dir}/report.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({ok:true,checks:checks.length,errors}));
}catch(e){await page.screenshot({path:`${dir}/failure.png`});fs.writeFileSync(`${dir}/report.json`,JSON.stringify({checks,errors,failure:String(e)},null,2));throw e;}finally{await context.close();await browser.close();}
