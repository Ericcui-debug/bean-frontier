import assert from 'node:assert/strict';
import fs from 'node:fs';
import {THREE} from '../src/gfx.js';
import {createWorld} from '../src/world.js';
import {moveActor,STEP,segmentSolid} from '../src/physics.js';
import {chromium} from 'playwright';
const scene=new THREE.Scene(),mat=c=>new THREE.MeshBasicMaterial({color:c});
const mesh=(geo,color,parent=scene)=>{const m=new THREE.Mesh(geo,mat(color));parent.add(m);return m;};
const box=(x,y,z,w,h,d,c,parent=scene)=>{const m=mesh(new THREE.BoxGeometry(w,h,d),c,parent);m.position.set(x,y,z);return m;};
const g={scene,mat,mesh,box,ball:(x,y,z,sx,sy,sz,c,p)=>{const m=mesh(new THREE.SphereGeometry(1),c,p);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;},cylinder:(x,y,z,r,h,c,p)=>{const m=mesh(new THREE.CylinderGeometry(r,r,h),c,p);m.position.set(x,y,z);return m;},label:()=>({})};
const world=createWorld(g),results=[];
const check=(name,value,detail)=>{results.push({name,pass:!!value,detail});assert.ok(value,`${name}: ${JSON.stringify(detail)}`);};
const actor=(x,z,y=0)=>({x,z,y,vx:0,vy:0,vz:0,radius:.53,height:1.94,grounded:true});
function advance(r,seconds,fps){let accumulated=0;for(let elapsed=0;elapsed<seconds-1e-7;elapsed+=1/fps){accumulated+=Math.min(1/fps,seconds-elapsed);while(accumulated+1e-9>=STEP){moveActor(r,STEP,world);accumulated-=STEP;}}}
for(const fps of [15,30,60]){
 let r=actor(-18,-14);r.vz=-6.8;advance(r,4,fps);check(`north ramp joins plateau @${fps}`,r.y===6&&r.z< -37,{...r});
 r=actor(-18,-37,6);r.vz=6.8;advance(r,4,fps);check(`plateau descends smoothly @${fps}`,r.y===0&&r.z> -14,{...r});
 r=actor(43,0);r.vz=-6.8;advance(r,4,fps);check(`east ramp reaches platform @${fps}`,r.y===4.8&&r.z< -20,{...r});
 r=actor(-20,4,10);r.grounded=false;advance(r,1.5,fps);check(`flat roof lands at visible height @${fps}`,r.y===5.05&&r.grounded,{...r});
 r=actor(-10,-28);r.vx=-6.8;advance(r,1,fps);check(`ramp high side blocks entry below slope @${fps}`,r.x>=-11.47-.005,{...r});
 r=actor(-39,-58,6);r.vx=-6.8;advance(r,1,fps);check(`leaving raised platform falls to base @${fps}`,r.y<6,{...r});
}
const path=world.path({x:-18,z:-14},{x:-18,z:-48});check('A* connects northern ramp and plateau',path.length>0&&path.some(p=>p.y===6),{length:path.length});
check('ramp continuous walk line',world.canWalk({x:-18,y:0,z:-14},{x:-18,y:6,z:-40}));
check('no navigation through high platform side',!world.canWalk({x:-43,y:0,z:-51},{x:-38,y:6,z:-51}));
const roof=world.solids.find(s=>s.type==='roof'&&s.x0===-24.35);check('roof bullet/camera shares solid',!!world.blocked({x:-20,y:7,z:4},{x:-20,y:4.8,z:4})?.solid&&roof.y1===5.05);
const ramp=world.solids.find(s=>s.shape==='ramp'&&s.rise===6);check('wedge slope blocks descending ray',!!segmentSolid({x:-18,y:5,z:-24},{x:-18,y:0,z:-24},ramp));check('ray above wedge remains open',!segmentSolid({x:-18,y:5,z:-20},{x:-18,y:5,z:-28},ramp));
world.solid(60,0,3,3,.5,0xffffff,3);let r=actor(60,0);r.vy=11;r.grounded=false;advance(r,1.5,60);check('overhead slab prevents jump and preserves ground below',r.y===0&&r.grounded,{...r});
fs.mkdirSync('output/verification',{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');const page=await browser.newPage({viewport:{width:1440,height:900}});
try{await page.goto('http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);await page.click('#start-btn');const report=await page.evaluate(()=>{const {game,input,step}=window.__gameTest;game.enemies.forEach(e=>e.alive=false);Object.assign(game.player,{x:-18,y:0,z:-14,grounded:true});input.keys.add('KeyW');for(let i=0;i<480;i++)step(1/120);input.reset();window.__gameTest.render();return game.snapshot();});check('browser actual player climbs plateau',report.player.y===6&&report.player.z< -33,report.player);await page.screenshot({path:'output/verification/terrain-highland.png'});
 await page.evaluate(()=>{const {game,step}=window.__gameTest;game.reset();game.start();game.player.invuln=100;for(let i=0;i<1200;i++)step(1/120);});const movement=await page.evaluate(()=>window.__gameTest.game.enemies.map(e=>({id:e.id,x:e.x,z:e.z,home:e.home,mode:e.aiMode,path:e.path.length,ground:window.__gameTest.world.walkable(e.x,e.z)})));check('AI does not remain in static obstacles',movement.every(e=>e.ground!==null),movement);await page.evaluate(()=>{const {game}=window.__gameTest;game.pause();});
}finally{await page.close();await browser.close();}
fs.writeFileSync('output/verification/terrain-report.json',JSON.stringify(results,null,2));console.log('PASS',results.length,'terrain checks');
