import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.OUTPUT_DIR||'output/v4/independent-audit';await mkdir(output,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');let context;const checks=[],errors=[];
const ok=(value,message)=>{assert.ok(value,message);checks.push(message);};
try{
 context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:process.env.CI?1:3,isMobile:true,hasTouch:true});
 const page=await context.newPage();context.setDefaultTimeout(180000);page.on('pageerror',error=>errors.push(error.message));
 const base=process.env.GAME_URL||'http://127.0.0.1:5180/';
 await page.goto(base+(base.includes('?')?'&':'?')+'test');await page.waitForFunction(()=>window.__game,null,{timeout:120000});await page.evaluate(()=>__game.test.manual(true));
 ok(await page.evaluate(()=>!__game.world._loaded&&__game.world.colliders.length===0),'大厅无预加载地图');
 await page.locator('[data-team="t"]').tap();await page.locator('#hud-start').tap();await page.waitForFunction(()=>__game.world._loaded&&!__game.loading&&__game.state.phase==='freeze',null,{timeout:120000});await page.evaluate(()=>advanceTime(100));
 ok(await page.evaluate(()=>__game.bots.aliveOf('ct')===5&&__game.bots.aliveOf('t')===4&&__game.state.bomb.carrierId==='player'),'T 玩家阵营和 C4 携带正确，双方各五人');
 ok(await page.evaluate(()=>Object.values(__game.viewmodel._models).every(m=>m.userData.npcArms?.userData.team==='t')),'T 方首局所有武器使用本队豆豆袖口');
 // Equipment state uses the real round reset and weapon purchase paths.
 const gear=await page.evaluate(()=>{const g=__game;g.state.money=16000;g.state.canBuy=true;g.weapons.buy('ak47');g.weapons.equip('ak47');g.player.armor=77;g.player.hasKit=true;g.state.phase='live';g.rounds._endRound('t','elimination');g.rounds._startRound();advanceTime(0);return{id:g.weapons.currentId,inventory:g.weapons.slots[1],armor:g.player.armor,hud:g.hud._el.weaponName?.textContent};});
 ok(gear.id==='ak47'&&gear.inventory==='ak47'&&gear.armor===77,'存活回合保持主武器、选中枪械和护甲');
 const drop=await page.evaluate(()=>{const g=__game;g.state.phase='live';g.state.timer=115;g.player.takeDamage(10000,{weapon:'awp',from:g.bots.all[0],headshot:true});return{dropped:g.bots._bombDropped,carrier:g.state.bomb.carrierId,retrievers:g.bots.all.filter(b=>b.alive&&b.plan==='retrieve').length};});
 ok(drop.dropped&&drop.carrier===null&&drop.retrievers===1,'玩家真实死亡掉包并指定唯一 AI 接管');
 const picked=await page.evaluate(()=>{const g=__game,b=g.bots.all.find(b=>b.plan==='retrieve');b.pos.copy(g.bots._droppedBombPos);b.state='hold';b.hasGoal=false;b.path=null;b.thinkTimer=0;advanceTime(500);return{dropped:g.bots._bombDropped,carrier:g.bots.bombCarrier?.team,alive:g.bots.bombCarrier?.alive};});
 ok(!picked.dropped&&picked.carrier==='t'&&picked.alive,'AI 实际接触死亡掉包后接管');
 const observing=await page.evaluate(()=>{advanceTime(2000);return __game.player.spectator.current();});
 ok(observing?.team==='t','玩家死亡后自动观战存活同阵营队友');
 await page.keyboard.down('Space');await page.evaluate(()=>advanceTime(20));await page.keyboard.up('Space');
 const cycled=await page.evaluate(()=>__game.player.spectator.current());
 ok(cycled?.id&&cycled.id!==observing.id,'观战时真实空格输入切换队友');
 const dead=await page.evaluate(()=>{const g=__game;g.player.armor=77;g.rounds._startRound();advanceTime(0);return{armor:g.player.armor,kit:g.player.hasKit,primary:g.weapons.slots[1],id:g.weapons.currentId};});
 ok(dead.armor===0&&!dead.kit&&!dead.primary&&dead.id==='glock','死亡后失去主武器、护甲、工具，HUD 和当前装备回到阵营手枪');
 await page.evaluate(()=>{const g=__game;g.state.canBuy=true;g.state.money=16000;g.weapons.buy('ak47');g.weapons.equip('ak47');advanceTime(900);g.test.manual(true);});
 const before=await page.evaluate(()=>({textureSets:__game.materials.resourceStats().textureSets,slots:JSON.stringify(__game.weapons.slots),id:__game.weapons.currentId,actors:__game.bots.all.length}));
 await page.evaluate(()=>{window.__auditExtension=__game.renderer.getContext().getExtension('WEBGL_lose_context');window.__auditOldMaterials=__game.materials;__auditExtension.loseContext();});await page.waitForTimeout(200);await page.evaluate(()=>__auditExtension.restoreContext());await page.waitForFunction(()=>__game.materials!==window.__auditOldMaterials&&!__game.loading&&__game.world._loaded,null,{timeout:120000});
 const restored=await page.evaluate(()=>({paused:__game.paused,sets:__game.materials.resourceStats().textureSets,id:__game.weapons.currentId,slots:JSON.stringify(__game.weapons.slots),actors:__game.bots.all.length,guns:__game.bots.all.every(b=>!!b.heldWeapon)}));
 const gunFresh=await page.evaluate(()=>{const g=__game,maps=new Set([...g.materials._sets.values()].flatMap(set=>[set.albedo,set.normal,set.orm]));let seen=0,fresh=0;g.viewmodel._models[g.weapons.currentId].traverse(object=>{if(object.isMesh){for(const material of Array.isArray(object.material)?object.material:[object.material])if(material.map){seen++;if(maps.has(material.map))fresh++;}}});return{seen,fresh};});
 ok(gunFresh.seen>0&&gunFresh.fresh===gunFresh.seen,'恢复后的真实枪械贴图全部属于新烘焙材质库');
 ok(restored.paused&&restored.sets>10&&restored.slots===before.slots&&restored.id===before.id&&restored.actors===before.actors&&restored.guns,'WebGL 完整重烘焙 PBR，保持装备与豆豆角色，并暂停等待继续');
 await page.evaluate(()=>{__game.resume();advanceTime(0);advanceTime(0);});await page.screenshot({path:`${output}/restored-mobile.png`});
 // Keep the real rebuild behind a test-only barrier so cancellation is
 // guaranteed to happen while restore is in flight, independent of GPU speed.
 await page.evaluate(()=>{const g=__game;window.__realBuild=g.viewmodel._buildProceduralWeapons;g.viewmodel._buildProceduralWeapons=function(){return __realBuild.call(this).then(()=>new Promise(resolve=>{window.__finishRestore=resolve;}));};window.__auditExtension=g.renderer.getContext().getExtension('WEBGL_lose_context');__auditExtension.loseContext();});
 await page.waitForFunction(()=>__game.contextLost,null,{timeout:120000});await page.evaluate(()=>__auditExtension.restoreContext());
 await page.waitForFunction(()=>typeof window.__finishRestore==='function',null,{timeout:120000});
 await page.evaluate(()=>{__game.cancelLoading();__finishRestore();__game.viewmodel._buildProceduralWeapons=__realBuild;});await page.waitForTimeout(50);
 ok(await page.evaluate(()=>__game.state.phase==='menu'&&!__game.loading&&!__game.world._loaded&&!__game.rounds._matchStarted),'取消进行中的画面恢复后保持大厅，旧回调不会重建旧地图');
 await page.locator('#hud-start').tap();await page.waitForFunction(()=>__game.world._loaded&&!__game.loading&&__game.state.phase==='freeze',null,{timeout:120000});await page.evaluate(()=>advanceTime(0));
 ok(await page.evaluate(()=>__game.state.round===1&&__game.state.money===8000),'取消画面恢复后可重新开始整场');
 await page.evaluate(()=>{__game.returnToLobby();window.__auditExtension=__game.renderer.getContext().getExtension('WEBGL_lose_context');__auditExtension.loseContext();});await page.waitForFunction(()=>__game.contextLost,null,{timeout:120000});await page.evaluate(()=>__auditExtension.restoreContext());
 await page.waitForFunction(()=>!__game.contextLost&&!__game.loading&&__game.state.phase==='menu',null,{timeout:120000});
 ok(await page.evaluate(()=>!__game.world._loaded&&__game.materials.resourceStats().textureSets>5),'大厅丢失画面也会重新烘焙枪械，不提前建立地图');
 await page.locator('#hud-start').tap();await page.waitForFunction(()=>__game.world._loaded&&!__game.loading,null,{timeout:120000});await page.evaluate(()=>advanceTime(0));
 ok(await page.evaluate(()=>__game.state.phase==='freeze'&&__game.state.canBuy),'大厅画面恢复后开局与购买仍正常');
 // A cancellation on the joystick must clear the OTHER fire finger as well.
 const session=await context.newCDPSession(page);
 const rect=sel=>page.locator(sel).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});const stick=await rect('.tc-stick'),fire=await rect('.tc-fire');
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...stick},{id:2,...fire}]});await page.evaluate(()=>advanceTime(50));
 await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 ok(await page.evaluate(()=>__game.paused&&!__game.input.firing&&!__game.input.isDown('w')&&__game.touchControls._cameraPointer===null),'任意触控取消暂停并清空同时移动、开火及镜头指针');
 await page.goto(base);await page.waitForFunction(()=>window.render_game_to_text);ok(await page.evaluate(()=>!('__game'in window)),'生产入口没有可修改游戏对象');
 ok(errors.length===0,'浏览器无未捕获错误');
 await writeFile(`${output}/report.json`,JSON.stringify({checks,errors,physicalIPhoneTested:false},null,2));console.log(JSON.stringify({passed:checks.length,checks,errors}));
}finally{await context?.close();await browser.close();}
