import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333'),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});fs.mkdirSync('output/verification',{recursive:true});
const checks=[];const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
try{
 await page.goto(process.argv[2]||'http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);await page.waitForTimeout(750);await page.screenshot({path:'output/verification/lobby.png'});
 await page.click('#start-btn');await page.keyboard.down('KeyW');await page.evaluate(()=>window.advanceTime(450));await page.keyboard.up('KeyW');let data=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));check('keyboard movement',data.player.z<44);
 await page.keyboard.press('Space');await page.evaluate(()=>window.advanceTime(160));data=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));check('jump rises',data.player.y>.7&&!data.player.grounded);await page.evaluate(()=>window.advanceTime(900));data=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));check('jump lands',data.player.y===0&&data.player.grounded);
 await page.keyboard.press('Escape');const paused=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));await page.keyboard.down('KeyW');await page.evaluate(()=>window.advanceTime(1000));await page.keyboard.up('KeyW');data=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));check('pause freezes world and audio',data.time===paused.time&&data.player.z===paused.player.z&&!data.audio.playing);await page.click('#resume');
 const report=await page.evaluate(()=>{
  const {game,world,g,WEAPONS,step}=window.__gameTest,results=[];const ok=(name,value,detail)=>{results.push({name,pass:!!value,detail});};
  const fresh=()=>{game.reset();game.start();game.player.invuln=0;};
  fresh();game.player.x=-10;game.player.z=35;game.interact();ok('pickup unlocks and equips shotgun',game.combat.inventory[1].unlocked&&game.combat.state.weapon===1);game.player.x=43;game.player.z=-25;game.player.y=4.8;game.interact();ok('pickup unlocks cannon',game.combat.inventory[2].unlocked&&game.combat.state.weapon===2);
  game.combat.inventory[2].ammo=0;game.combat.inventory[2].reserve=5;game.combat.reload();step(2);ok('reload consumes reserve',game.combat.inventory[2].ammo===4&&game.combat.inventory[2].reserve===1);
  game.player.hp=21;game.player.x=43;game.player.z=-21;game.player.y=4.8;step(.1);ok('supply heals and refills all unlocked guns',game.player.hp===100&&game.combat.inventory[2].reserve===20);
  for(const fps of [15,30,60]){
   fresh();game.enemies.forEach(e=>{e.alive=false;e.group.visible=false;});Object.assign(game.player,{x:-20,z:10.8,y:0});window.__gameTest.input.keys.add('KeyW');for(let i=0;i<fps;i++)step(1/fps);window.__gameTest.input.reset();const building=world.solids.find(s=>s.x0===-24&&s.z0===.5);ok('body sweep blocks wall @'+fps,game.player.z>=7.5+game.player.radius-.01,{z:game.player.z});
   fresh();game.enemies.forEach(e=>{e.alive=false;e.group.visible=false;});Object.assign(game.player,{x:0,z:30,y:0});const enemy=game.ai.spawn(0,22,null,'shooter',true);enemy.vx=enemy.vz=0;enemy.repath=999;enemy.home={x:0,y:0,z:22};game.camera.state.yaw=0;game.camera.state.pitch=-.01;game.camera.update(0,false,true);game.player.yaw=0;game.player.group.position.set(0,0,30);game.player.group.rotation.y=0;
   for(let i=0;i<3;i++){game.combat.state.cooldown=0;game.combat.fire(g.camera);for(let j=0;j<Math.ceil(fps*.18);j++)game.combat.update(1/fps);}ok('swept bullets kill and update score @'+fps,!enemy.alive&&game.state.kills===1,{hp:enemy.hp});
  }
  fresh();game.enemies.forEach(e=>{e.alive=false;e.group.visible=false;});Object.assign(game.player,{x:0,z:30,y:0,invuln:0});let victim=game.ai.spawn(0,22,null,'shooter',true);const blocker=world.solid(0,26,4,1,3,0xeeeeee);game.camera.state.yaw=0;game.camera.state.pitch=-.01;game.camera.update(0,false,true);game.player.group.position.set(0,0,30);game.combat.fire(g.camera);for(let i=0;i<120;i++)game.combat.update(1/120);ok('shots cannot damage through walls',victim.hp===54);ok('AI cannot fire through walls',!game.combat.enemyFire(victim));blocker.active=false;blocker.group.visible=false;
  const crate=world.props.find(s=>s.type==='crate');game.combat.destroy(crate,100,game.player);ok('crate breaks and removes solid',!crate.active&&!crate.group.visible);
  const barrel=world.props.find(s=>s.type==='barrel');victim=game.ai.spawn((barrel.x0+barrel.x1)/2+1.9,(barrel.z0+barrel.z1)/2,null,'shooter',true);game.combat.destroy(barrel,100,game.player);ok('barrel explosion damages nearby enemy',victim.hp<54);
  fresh();game.enemies.filter(e=>e.camp===0).forEach(e=>game.combat.hurt(e,100,{x:e.x,y:e.y,z:e.z+2}));ok('camp clears and updates checkpoint',world.camps[0].cleared&&game.state.checkpoint.x===world.camps[0].x);
  game.player.x=-10;game.player.z=35;game.interact();game.combat.hurt(game.player,200,{x:-5,y:0,z:35});ok('death starts respawn',!game.player.alive&&game.state.respawn>0);step(1.5);ok('respawn retains weapons and camp with protection',game.player.alive&&game.player.hp===100&&game.combat.inventory[1].unlocked&&world.camps[0].cleared&&game.player.invuln>0);
  Object.assign(game.player,{x:73,z:0,y:0,grounded:false});step(2);ok('island edge causes fall respawn',game.state.respawn>0||game.state.respawns>=2);
  fresh();game.beginChallenge(world.flags[0]);world.targets.forEach(t=>{t.active=false;t.group.visible=false;});step(.01);ok('targets complete challenge',world.flags[0].complete&&!game.state.challenge);
  game.beginChallenge(world.flags[1]);for(const coin of world.coins){Object.assign(game.player,{x:coin.x,y:world.groundAt(coin.x,coin.z)||0,z:coin.z,grounded:true});step(.01);}ok('collect challenge counts pickups and completes',world.flags[1].complete&&!game.state.challenge);
  game.beginChallenge(world.flags[2]);game.enemies.filter(e=>e.challenge&&e.alive).forEach(e=>game.combat.hurt(e,100,{x:e.x,y:e.y,z:e.z+1}));step(.01);ok('combat challenge completes',world.flags[2].complete);
  game.beginChallenge(world.flags[2]);game.state.challenge.time=.01;step(.02);ok('challenge timeout cleans its enemies only',!game.state.challenge&&!game.enemies.some(e=>e.challenge)&&game.enemies.filter(e=>e.camp!==null).length===12);
  for(const e of game.enemies)if(e.alive)game.combat.hurt(e,100,{x:e.x,y:e.y,z:e.z+1});step(.01);ok('all objectives produce complete state',game.state.completed&&game.state.mode==='complete');game.mode('playing');step(.01);ok('completion allows free play',game.state.mode==='playing');
  fresh();ok('new round resets world and inventory',game.state.kills===0&&game.state.time===0&&world.camps.every(c=>!c.cleared)&&world.flags.every(f=>!f.complete)&&world.props.every(s=>s.active)&&!game.combat.inventory[1].unlocked);
  Object.assign(game.player,{x:-18,z:-14,y:0});window.__gameTest.input.keys.add('KeyW');for(let i=0;i<400;i++)step(1/120);window.__gameTest.input.reset();ok('ramp reaches highland without teleport',game.player.y===6&&game.player.z< -33,{y:game.player.y,z:game.player.z});
  fresh();Object.assign(game.player,{x:-20,z:9.2,y:0});game.camera.state.yaw=Math.PI;game.camera.state.pitch=0;game.camera.update(0,false,true);ok('camera contracts at walls',game.camera.state.distance<2,{distance:game.camera.state.distance});
  fresh();game.camera.state.aim=true;game.camera.update(1);ok('aim narrows FOV',g.camera.fov<44);
  const path=world.path({x:-18,z:-14},{x:-18,z:-48});ok('AI navigation connects ramp to plateau',path.length>0&&path.some(p=>p.y===6),{length:path.length});
  game.reset();game.start();return results;
 });
 console.log(JSON.stringify(report,null,2));fs.writeFileSync('output/verification/physics-report.json',JSON.stringify(report,null,2));for(const row of report)check(row.name,row.pass);
 await page.screenshot({path:'output/verification/gameplay.png'});check('no browser errors',errors.length===0);fs.writeFileSync('output/verification/report.json',JSON.stringify({checks,report,errors},null,2));console.log('PASS',checks.length,'checks');
}finally{await page.close();await browser.close();}
