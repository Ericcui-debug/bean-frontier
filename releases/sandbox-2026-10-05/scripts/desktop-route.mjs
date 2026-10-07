import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const out='output/desktop-route';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[],events=[],checks=[];let cursor={x:720,y:450};
page.on('pageerror',e=>errors.push(e.message));
const snapshot=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const readAim=()=>page.evaluate(()=>({camera:{...window.__gameTest.game.camera.state},pos:window.__gameTest.g.camera.position.toArray(),player:{x:window.__gameTest.game.player.x,y:window.__gameTest.game.player.y,z:window.__gameTest.game.player.z},mode:window.__gameTest.game.state.mode}));
async function mode(){const s=await snapshot();if(s.mode==='paused'){await page.locator('#resume').click();events.push({resumeAt:s.time});}return s;}
async function look(yaw,pitch=-.08,settle=15){
 await mode();await page.mouse.move(cursor.x,cursor.y);await page.mouse.down({button:'right'});
 for(let i=0;i<4;i++){
  const {camera}=await readAim();let dx=yaw-camera.yaw;dx=Math.atan2(Math.sin(dx),Math.cos(dx));const dy=pitch-camera.pitch;
  if(Math.abs(dx)<.005&&Math.abs(dy)<.005)break;
  cursor.x+=dx/.003;cursor.y-=dy/.003;
  await page.mouse.move(cursor.x,cursor.y);await advance(settle);
 }
 await page.mouse.up({button:'right'});await advance(8);
}
async function walk(x,z){
 for(let i=0;i<100;i++){
  let s=await mode();const dx=x-s.player.x,dz=z-s.player.z,d=Math.hypot(dx,dz);if(d<.7)return;
  await look(Math.atan2(dx,-dz),-.08);await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');await advance(Math.min(500,d/9*1000));await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');await advance(65);
  const after=await snapshot();if(i%8===0)console.log('walk',x,z,after.player);
  if(Math.hypot(after.player.x-s.player.x,after.player.z-s.player.z)<.1)throw new Error(`route blocked aiming for ${x},${z}; at ${JSON.stringify(after.player)}`);
 }throw new Error('walk timeout');
}
async function aimAt(x,y,z,enemyId=null){
 for(let i=0;i<5;i++){
 if(enemyId!==null){const e=await page.evaluate(id=>{const e=window.__gameTest.game.enemies.find(e=>e.id===id&&e.alive);return e?{x:e.x+(e.vx||0)*.15,y:e.y+1,z:e.z+(e.vz||0)*.15}:null;},enemyId);if(!e)return;if(e){x=e.x;y=e.y;z=e.z;}}
 const {pos}=await readAim();const dx=x-pos[0],dz=z-pos[2],dy=y-pos[1];await look(Math.atan2(dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)),enemyId!==null?35:110);
 }
}
function check(name,value,data){checks.push({name,pass:!!value,data});assert.ok(value,name);}
try{
 await page.goto(process.argv[2]||'http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);await page.locator('#start-btn').click();await advance(80);
 const start=await snapshot();check('starts at safe spawn',Math.abs(start.player.x)<.01&&Math.abs(start.player.z-46)<.1,start.player);
 await walk(-10,35);await page.keyboard.press('KeyE');await advance(100);let s=await snapshot();check('shotgun obtained via keyboard exploration',s.combat.inventory[1].unlocked&&s.combat.weapon===1,s.player);
 await page.keyboard.press('Digit1');await walk(0,35);await walk(12,34);await page.keyboard.press('KeyE');await advance(100);s=await snapshot();check('target flag activated via E',s.challenge?.id==='targets');
 for(let i=0;i<6;i++){
 const x=9+i*2.5,z=24-(i%2)*3;await aimAt(x,1.8,z);await page.mouse.down({button:'left'});await advance(300);await page.mouse.up({button:'left'});await advance(100);s=await snapshot();events.push({target:i,state:s.challenge});console.log('target',i,s.challenge);
 }
 s=await snapshot();check('six targets completed using mouse fire',s.challenges.find(c=>c.id==='targets').complete,s.challenge);await page.screenshot({path:out+'/targets-complete.png'});
 // Open southern approach avoids the town building and its climbing deck.
 await walk(0,33);await walk(-29,33);await walk(-30,28);
 for(let i=0;i<120;i++){
  s=await mode();if(s.camps[0].cleared)break;
  const alive=s.enemies.filter(e=>e.camp===0);if(!alive.length)break;
  const p=s.player;const visible=await page.evaluate(()=>{const {game,world}=window.__gameTest;const p=game.player;return game.enemies.filter(e=>e.alive&&e.camp===0&&!world.blocked({x:p.x,y:p.y+1.2,z:p.z},{x:e.x,y:e.y+1,z:e.z})).map(e=>e.id);});
  const enemies=alive.sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));const e=enemies.find(e=>visible.includes(e.id));
  if(!e){const path=await page.evaluate(to=>window.__gameTest.world.path(window.__gameTest.game.player,to).map(p=>({x:p.x,z:p.z})),enemies[0]);if(path.length){await walk(path[0].x,path[0].z);}else await walk(-31,21);continue;}
  await page.keyboard.press('Digit1');
  for(let burst=0;burst<8;burst++){
   const current=(await snapshot()).enemies.find(v=>v.id===e.id);if(!current)break;
   await aimAt(current.x,current.y+1,current.z,e.id);await page.mouse.down({button:'left'});
   await advance(100);await page.mouse.up({button:'left'});await advance(8);
   const now=await snapshot();if(!now.player.alive)break;
  }
  s=await snapshot();
  events.push({fight:i,hp:s.player.hp,kills:s.kills,remaining:s.camps[0].enemies,respawns:s.respawns});console.log('fight',i,s.player.hp,s.kills,s.camps[0].enemies);
  if(s.combat.inventory[0].ammo<4){await page.keyboard.press('KeyR');await advance(1200);}
  if(!s.player.alive){await advance(1700);await walk(-29,33);await walk(-30,28);}
 }
 s=await snapshot();check('town camp cleared through actual keyboard and mouse controls',s.camps[0].cleared,s.camps[0]);check('checkpoint set on cleared camp',s.checkpoint.x===-31&&s.checkpoint.z===12,s.checkpoint);await page.screenshot({path:out+'/camp-complete.png'});check('no page runtime errors',errors.length===0,errors);
 fs.writeFileSync(out+'/report.json',JSON.stringify({checks,events,errors,final:s},null,2));console.log('PASS real desktop route');
}catch(error){const state=await snapshot().catch(()=>null);fs.writeFileSync(out+'/report.json',JSON.stringify({checks,events,errors,error:error.stack,final:state},null,2));await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.error(error);process.exitCode=1;}finally{await page.close();await browser.close();}
