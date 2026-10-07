import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const out='output/visual-upgrade';fs.mkdirSync(out,{recursive:true});
const results=[],check=(name,pass,detail)=>{results.push({name,pass:!!pass,detail});assert.ok(pass,`${name}: ${JSON.stringify(detail)}`);};
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(process.argv[2]||'http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);await page.click('#start-btn');
 const scenarios=[
  {name:'sky-look',x:0,y:0,z:46,yaw:0,pitch:.68},
  {name:'down-look',x:0,y:0,z:46,yaw:0,pitch:-.95},
  {name:'wall-camera',x:-20,y:0,z:9.2,yaw:Math.PI,pitch:0},
  {name:'wall-corner',x:-15.4,y:0,z:8.8,yaw:Math.PI+.5,pitch:.1,orbit:true},
  {name:'under-awning',x:-20,y:0,z:8.2,yaw:Math.PI,pitch:-.5},
  {name:'roof-edge',x:-20,y:5.05,z:7,yaw:0,pitch:.68},
  {name:'ramp-seam',x:-18,y:5.9,z:-32.7,yaw:Math.PI,pitch:.68},
  {name:'jump-pad-air',x:-18,y:8,z:-13,yaw:1,pitch:.5},
  {name:'ordinary-avatar',x:0,y:0,z:46,yaw:0,pitch:-.18}
 ];
 for(const fps of [15,30,60])for(const s of scenarios){
  const report=await page.evaluate(async({s,fps})=>{
   const {game,g,world,input,characterDisplay:{poseBean,updateBeanDisplay}}=window.__gameTest;input.reset();game.enemies.forEach(e=>{e.alive=false;e.group.visible=false;});
   Object.assign(game.player,{x:s.x,y:s.y,z:s.z,vx:0,vy:0,vz:0,yaw:s.yaw,alive:true,invuln:1000,grounded:s.name!=='jump-pad-air'});Object.assign(game.camera.state,{yaw:s.yaw,pitch:s.pitch,aim:false});
   poseBean(game.player,game.state.time,true);game.player.gun.rotation.x=s.pitch;game.camera.update(0,false,true);let safe=true,lowest=Infinity,largest=0;
   for(let i=0;i<fps*2;i++){if(s.orbit)game.camera.state.yaw=s.yaw+i/fps*2;game.camera.update(1/fps);const focus={x:game.player.x,y:game.player.y+1.48,z:game.player.z};const hit=world.cameraBlocked(focus,g.camera.position,.27);safe&&=!hit;lowest=Math.min(lowest,g.camera.position.y);largest=Math.max(largest,game.camera.state.distance);}
   updateBeanDisplay(game.player,g.camera,world,game.state.time,true);window.__gameTest.render();
   const shared=g.mat(game.player.color),playerMaterials=game.player.displayMaterials,forward=game.camera.direction(),tan=Math.tan(g.camera.fov*Math.PI/360);let labelBounds=true;
   for(const label of g.labels){const delta=label.position.clone().sub(g.camera.position),depth=delta.dot(forward);if(depth<=0||label.material.opacity<.02)continue;labelBounds&&=label.scale.x/(2*tan*g.camera.aspect*depth)<=.301&&label.scale.y/(2*tan*depth)<=.076;}
   const title=g.labels.find(l=>l.position.x===0&&l.position.y===5&&l.position.z===48);
   return {camera:g.camera.position.toArray(),distance:game.camera.state.distance,opacity:game.player.avatarOpacity,safe,lowest,largest,scale:game.player.body.scale.toArray(),sharedOpacity:shared.opacity,privateMaterials:playerMaterials.every(m=>m!==shared),fadedMaterials:playerMaterials.every(m=>Math.abs(m.opacity-game.player.avatarOpacity)<.001),labelBounds,titleOpacity:title.material.opacity};
  },{s,fps});
  check(`${s.name}: safe camera @${fps}`,report.safe&&report.lowest>=.279,report);
  check(`${s.name}: original size and independent material @${fps}`,report.scale.every(v=>v===1)&&report.sharedOpacity===1&&report.privateMaterials&&report.fadedMaterials,report);
  check(`${s.name}: world labels bounded on screen @${fps}`,report.labelBounds,report);
  if(s.name==='down-look')check(`near spawn title fades before obstructing reticle @${fps}`,report.titleOpacity===0,report);
  if(s.name==='wall-camera')check(`wall avatar fades out @${fps}`,report.opacity<.08&&report.distance<1.6,report);
  if(s.name==='ordinary-avatar')check(`avatar recovers at open distance @${fps}`,report.opacity>.999,report);
  if(fps===60)await page.screenshot({path:`${out}/${s.name}.png`,timeout:8000});
 }
 const bars=await page.evaluate(async()=>{
  const {game,g,world,characterDisplay:{poseBean,updateBeanDisplay}}=window.__gameTest;const e=game.enemies[0];e.alive=true;e.hp=e.maxHp-10;e.healthUntil=game.state.time+1.6;
  Object.assign(e,{x:0,y:0,z:35,yaw:2});poseBean(e,game.state.time,true);g.camera.position.set(0,3,42);g.camera.lookAt(0,1.4,35);updateBeanDisplay(e,g.camera,world,game.state.time,false);const hitVisible=e.health.visible,barDirection=e.health.getWorldQuaternion(e.health.quaternion.clone()),aligned=Math.abs(barDirection.dot(g.camera.quaternion));
  updateBeanDisplay(e,g.camera,world,game.state.time+2,false);const expiredHidden=!e.health.visible;
  Object.assign(e,{x:-20,y:0,z:2,yaw:0});poseBean(e,game.state.time,true);g.camera.position.set(-20,3,12);g.camera.lookAt(-20,1.4,2);updateBeanDisplay(e,g.camera,world,game.state.time,false);const wallHidden=!e.health.visible;
  Object.assign(e,{x:-20,y:0,z:8.2,yaw:0});poseBean(e,game.state.time,true);g.camera.position.set(-20,4,9.5);g.camera.lookAt(-20,1.45,8.2);updateBeanDisplay(e,g.camera,world,game.state.time,false);const awningHidden=!e.health.visible,awningOnly=!world.blocked(g.camera.position,{x:-20,y:1.45,z:8.2})&&world.cameraBlocked(g.camera.position,{x:-20,y:1.45,z:8.2})?.solid.type==='awning';
  const tree=world.cameraSolids.find(s=>s.type==='canopy');Object.assign(e,{x:tree.x+5,y:tree.y,z:tree.z,yaw:0});poseBean(e,game.state.time,true);g.camera.position.set(tree.x-5,tree.y+1.45,tree.z);g.camera.lookAt(e.x,e.y+1.45,e.z);updateBeanDisplay(e,g.camera,world,game.state.time,false);const canopyHidden=!e.health.visible;
  game.player.healthUntil=game.state.time+1;game.player.hp=60;updateBeanDisplay(game.player,g.camera,world,game.state.time,true);return {hitVisible,aligned,expiredHidden,wallHidden,awningHidden,awningOnly,canopyHidden,playerHidden:!game.player.health.visible};
 });
 check('only visible injured enemy has temporary camera-facing health bar',bars.hitVisible&&bars.aligned>.999&&bars.expiredHidden&&bars.wallHidden&&bars.playerHidden,bars);
 check('camera-only awning and canopy hide enemy health bars',bars.awningHidden&&bars.awningOnly&&bars.canopyHidden,bars);
 const memories=await page.evaluate(()=>{const {game,g}=window.__gameTest,counts=[];for(let i=0;i<6;i++){game.reset();game.start();window.__gameTest.render();counts.push(g.renderer.info.memory.geometries);}return counts;});
 check('restarting releases only private bean geometries',memories.every(v=>v===memories[0]),memories);
 await page.evaluate(()=>window.__gameTest.game.pause());check('browser errors',errors.length===0,errors);
}finally{await page.close();await browser.close();fs.writeFileSync(`${out}/report.json`,JSON.stringify(results,null,2));}
console.log('PASS',results.length,'visual checks');
