import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const output=process.env.OUTPUT_DIR||'output/v4/mobile';await mkdir(output,{recursive:true});
const errors=[],results=[];let context;
try {
 context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const base=process.env.GAME_URL||'http://127.0.0.1:5180/';await page.goto(base+(base.includes('?')?'&':'?')+'test&touch=1');
 await page.waitForFunction(()=>window.__game?.hud,null,{timeout:120000});await page.evaluate(()=>{__game.test.manual(true);});
 assert.equal(await page.locator('[data-map-id]').count(),6);assert.equal(await page.locator('#hud-online-open,#hud-profile,#hud-leaderboard').count(),0);
 await page.locator('[data-team="t"]').tap();await page.locator('#hud-start').tap();
 await page.waitForFunction(()=>__game.world._loaded&&!__game.loading&&__game.state.phase==='freeze',null,{timeout:120000});
 await page.evaluate(()=>{advanceTime(0);advanceTime(0);});
 assert.equal(await page.evaluate(()=>__game.player.team),'t');
 const session=await context.newCDPSession(page);
 const rect=sel=>page.locator(sel).evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
 let stick=await rect('.tc-stick'),fire=await rect('.tc-fire');
 const touch=(type,points)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,p])=>({id,x:p.x,y:p.y,radiusX:5,radiusY:5,force:1}))});
 await page.evaluate(()=>{__game.state.phase='live';__game.state.timer=110;__game.state.canBuy=true;__game.state.money=16000;__game.bots.update=()=>{};__game.weapons.buy('m4a1');advanceTime(800);});
 const before=await page.evaluate(()=>({yaw:__game.player.yaw,pos:__game.player.position.clone(),ammo:__game.weapons.currentAmmo().mag}));
 await touch('touchStart',[[1,stick],[2,fire]]);await touch('touchMove',[[1,{x:stick.x,y:stick.y-38}],[2,{x:fire.x+30,y:fire.y-10}]]);await page.evaluate(()=>advanceTime(300));
 const after=await page.evaluate(()=>({yaw:__game.player.yaw,pos:__game.player.position.clone(),ammo:__game.weapons.currentAmmo().mag}));
 assert.ok(Math.abs(after.yaw-before.yaw)>.02,'right fire drag changes aim');assert.ok(Math.hypot(after.pos.x-before.pos.x,after.pos.z-before.pos.z)>.1,'left stick moves while firing');assert.ok(after.ammo<before.ammo,'held right fire shoots');results.push('双指移动 + 拖动开火瞄准');
 await touch('touchEnd',[]);await page.evaluate(()=>advanceTime(20));
 // Three fingers: the empty look surface owns the camera; right fire cannot drive it a second time.
 const look={x:580,y:180};fire=await rect('.tc-fire');await touch('touchStart',[[3,look],[4,fire]]);await touch('touchMove',[[3,{x:look.x+12,y:look.y}],[4,{x:fire.x+48,y:fire.y}]]);
 const owner=await page.evaluate(()=>({owner:__game.touchControls._cameraPointer,dx:__game.input._dx}));assert.ok(owner.owner!==null);assert.ok(Math.abs(owner.dx-12*1.18)<.1,`single look owner: ${owner.dx}`);await touch('touchEnd',[]);await page.evaluate(()=>advanceTime(20));results.push('多指单一镜头控制者');
 await page.evaluate(()=>{__game.state.canBuy=true;__game.state.money=16000;__game.weapons.buy('awp');advanceTime(1000);});
 await page.locator('.tc-scope').tap();await page.evaluate(()=>advanceTime(20));assert.equal(await page.evaluate(()=>__game.weapons.scopeLevel),1);
 await page.locator('.tc-scope').tap();await page.evaluate(()=>advanceTime(20));assert.equal(await page.evaluate(()=>__game.weapons.scopeLevel),2);results.push('AWP 一档 / 二档镜');
 await page.locator('.tc-crouch').tap();await page.evaluate(()=>advanceTime(500));assert.equal(await page.evaluate(()=>__game.player.crouching),true);await page.locator('.tc-crouch').tap();await page.evaluate(()=>advanceTime(200));results.push('独立蹲下切换');
 await page.locator('.tc-buy').tap();await page.evaluate(()=>advanceTime(0));assert.equal(await page.evaluate(()=>__game.state.buyOpen),true);
 const recommended=await page.evaluate(()=>({gun:__game.weapons.slots[1],money:__game.state.money}));await page.locator('#hud-recommend').tap();assert.equal(await page.evaluate(()=>__game.weapons.slots[1]),recommended.gun);assert.equal(await page.evaluate(()=>__game.player.armor),100);
 await page.locator('#hud-buy-close').tap();await page.evaluate(()=>advanceTime(0));assert.equal(await page.evaluate(()=>__game.input.firing),false);results.push('购买面板 / 推荐保留主武器 / 关闭清空触控');
 await page.locator('.tc-slot[data-slot="3"]').tap();await page.evaluate(()=>advanceTime(500));assert.equal(await page.evaluate(()=>__game.weapons.currentId),'knife');
 await page.locator('.tc-slot[data-slot="1"]').tap();await page.evaluate(()=>{advanceTime(600);__game.weapons.currentAmmo().mag=2;});await page.locator('.tc-reload').tap();await page.evaluate(()=>advanceTime(5000));assert.equal(await page.evaluate(()=>__game.weapons.currentAmmo().mag),10);results.push('独立武器栏 / 换弹');
 await page.evaluate(()=>{__game.state.canBuy=true;__game.state.money=16000;__game.weapons.buy('hegrenade');__game.weapons.equip('hegrenade');advanceTime(1000);});
 fire=await rect('.tc-fire');const grenadesBefore=await page.evaluate(()=>__game.weapons.slots[4].length);
 await touch('touchStart',[[5,fire]]);await page.evaluate(()=>advanceTime(100));assert.equal(await page.evaluate(()=>__game.weapons._state),'winding');await touch('touchCancel',[]);
 assert.equal(await page.evaluate(()=>__game.paused),true);await page.evaluate(()=>{__game.resume();advanceTime(1000);});assert.equal(await page.evaluate(()=>__game.weapons.slots[4].length),grenadesBefore);assert.equal(await page.evaluate(()=>__game.input.firing),false);results.push('触控取消暂停且不意外投掷');
 fire=await rect('.tc-fire');await touch('touchStart',[[6,fire]]);await page.evaluate(()=>advanceTime(100));await touch('touchEnd',[]);await page.evaluate(()=>advanceTime(700));assert.equal(await page.evaluate(()=>__game.weapons.slots[4].length),grenadesBefore-1);results.push('按住蓄力 / 松开实际投掷');
 await page.evaluate(()=>{for(const p of __game.combat._projectiles){p.active=false;if(p.mesh)p.mesh.visible=false;}const site=__game.world.bombSites[0];__game.player.position.copy(site.center);__game.player.position.y+=.06;__game.player.velocity.set(0,0,0);__game.player.onGround=true;__game.state.phase='live';__game.state.timer=100;__game.state.bomb.carrierId=__game.player.networkId;advanceTime(0);advanceTime(0);});
 await page.waitForFunction(()=>!document.querySelector('.tc-use').hidden);let use=await rect('.tc-use');await touch('touchStart',[[7,use]]);await page.evaluate(()=>advanceTime(3300));assert.equal(await page.evaluate(()=>__game.state.bomb.planted),true);await touch('touchEnd',[]);results.push('包点按住互动完成安包');
 await page.evaluate(()=>{__game.player.team='ct';__game.player.hasKit=true;__game.player.position.copy(__game.state.bomb.pos);__game.player.position.y+=.06;__game.player.velocity.set(0,0,0);advanceTime(0);advanceTime(0);});use=await rect('.tc-use');await touch('touchStart',[[8,use]]);await page.evaluate(()=>advanceTime(5100));await touch('touchEnd',[]);assert.equal(await page.evaluate(()=>__game.state.phase),'roundEnd');assert.equal(await page.evaluate(()=>__game.state.scores.ct),1);results.push('带工具按住互动完成拆包');
 await page.evaluate(()=>{__game.state.phase='live';__game.state.timer=100;__game.state.bomb.planted=false;__game.player.team='t';__game.player.alive=true;__game.player.health=100;});
 await page.evaluate(()=>{__game.settings.setPreference('buttonSize',1.3);__game.settings.setPreference('buttonOpacity',1);__game.weapons.equip('awp');advanceTime(800);});
 await page.evaluate(()=>{const g=__game;g.weapons.give('glock');g.weapons.equip('glock');advanceTime(800);});
 const semiBefore=await page.evaluate(()=>__game.weapons.currentAmmo().mag),semiFire=await rect('.tc-fire');
 await touch('touchStart',[[19,semiFire]]);await page.evaluate(()=>advanceTime(700));await touch('touchEnd',[]);
 assert.ok(await page.evaluate(before=>before-__game.weapons.currentAmmo().mag>=3,semiBefore));results.push('半自动手枪按住按原射速连发，取消后停止');
 await page.evaluate(()=>{__game.weapons.equip('awp');advanceTime(800);});
 const viewports=[{width:844,height:390},{width:667,height:375},{width:568,height:320},{width:390,height:844},{width:375,height:667}];
 for(const viewport of viewports){await page.setViewportSize(viewport);await page.waitForFunction(v => Math.abs(document.querySelector('#hud').getBoundingClientRect().width-v.width)<1,viewport);await page.evaluate(()=>{__game.resume();advanceTime(0);advanceTime(0);document.querySelector('.tc-use').hidden=false;});
  const rects=await page.evaluate(()=>[...document.querySelectorAll('#touch-controls button:not([hidden]),.tc-stick')].filter(e=>{const s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden';}).map(e=>{const r=e.getBoundingClientRect();return{selector:e.className,x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(const r of rects){assert.ok(r.w>=43.9&&r.h>=43.9,`${viewport.width}: ${r.selector} below 44`);assert.ok(r.x>=-.1&&r.y>=-.1&&r.x+r.w<=viewport.width+.1&&r.y+r.h<=viewport.height+.1,`${viewport.width}: ${r.selector} outside viewport`);}
  for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){const a=rects[i],b=rects[j],overlap=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1;assert.equal(overlap,false,`${viewport.width}x${viewport.height}: ${a.selector} overlaps ${b.selector}`);}
  await page.screenshot({path:`${output}/${viewport.width}x${viewport.height}.png`});results.push(`${viewport.width}×${viewport.height} 最大按钮无重叠且至少 44 CSS 像素`);
 }
 assert.deepEqual(errors,[]);await writeFile(`${output}/report.json`,JSON.stringify({checks:results,errors,physicalIPhoneTested:false},null,2));console.log(JSON.stringify({passed:results.length,checks:results,errors}));
} finally {await context?.close();await browser.close();}
