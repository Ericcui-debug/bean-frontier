import {chromium} from 'playwright';
import fs from 'node:fs';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const page=await browser.newPage({viewport:{width:1440,height:900}}), checks=[], errors=[];
const out='output/final-audit';fs.mkdirSync(out,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});if(!pass)console.log('FAIL',name,detail);};
async function walk(x,z){for(let i=0;i<120;i++){const s=await state();if(s.mode!=='playing')throw new Error('unexpected mode '+s.mode);const dx=x-s.player.x,dz=z-s.player.z;if(Math.hypot(dx,dz)<.6)return;const keys=[];if(Math.abs(dx)>.25)keys.push(dx>0?'KeyD':'KeyA');if(Math.abs(dz)>.25)keys.push(dz>0?'KeyS':'KeyW');keys.push('ShiftLeft');for(const k of keys)await page.keyboard.down(k);await advance(Math.min(130,Math.hypot(dx,dz)/9*1000));for(const k of keys)await page.keyboard.up(k);if(!s.player.alive)throw new Error('died along collect route');}throw new Error('walk blocked '+x+','+z+' '+JSON.stringify((await state()).player));}
try{
await page.goto('http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest);await page.locator('#start-btn').click();await advance(50);
await walk(12,7);await page.keyboard.press('KeyE');await advance(10);check('collect begins with real keyboard at flag',(await state()).challenge?.id==='collect');
const coins=await page.evaluate(()=>window.__gameTest.world.coins.map(c=>({x:c.x,z:c.z})));
for(const c of coins)await walk(c.x,c.z);await advance(100);
check('all eight coins completed through unmodified player traversal',(await state()).challenges.find(f=>f.id==='collect').complete,await state());await page.screenshot({path:out+'/collect-complete.png'});
const report=await page.evaluate(()=>{
const {game,world,input,step}=window.__gameTest;const r=[];const add=(name,pass,detail)=>r.push({name,pass:!!pass,detail});
// Independent state arrangements cover failure and cancellation branches.
game.reset();game.start();game.beginChallenge(world.flags[0]);step(1);game.beginChallenge(world.flags[1]);add('switch challenges removes targets',world.targets.every(t=>!t.active)&&game.state.challenge.id==='collect');game.beginChallenge(world.flags[2]);add('switch removes collectibles',world.coins.every(t=>!t.active)&&game.enemies.filter(e=>e.challenge).length===3);game.beginChallenge(world.flags[2]);add('restarting combat does not accumulate enemies',game.enemies.filter(e=>e.challenge).length===3);game.state.challenge.time=.02;step(.1);add('timeout removes spawned enemies',game.state.challenge===null&&game.enemies.length===12);
// Every scripted goal and weapon has an on-foot route from beach, not only teleport proximity.
for(const obj of [...world.flags,...world.pickups,...world.camps]){const path=world.path(world.spawn,obj);add('reachable '+(obj.name||obj.type+' '+obj.weapon),path.length>0,{x:obj.x,y:obj.y,z:obj.z,nodes:path.length});}
game.beginChallenge(world.flags[0]);game.player.invuln=0;game.combat.hurt(game.player,100,{x:0,z:0,y:0});add('death clears held aim/fire inputs',!input.state.fire&&!input.state.aim&&!input.keys.size);step(1.5);add('respawn challenge continues and player protected',game.player.alive&&game.player.invuln>0&&game.state.challenge?.id==='targets');
for(const c of world.camps)for(const e of game.enemies.filter(e=>e.camp===c.id))game.combat.hurt(e,999,{x:e.x,y:e.y,z:e.z});for(const flag of world.flags)flag.complete=true;game.stopChallenge();step(.01);add('all objectives open completion modal',game.state.mode==='complete');game.start();step(.02);add('completed round supports resumed freeplay',game.state.mode==='playing'&&game.state.completed);game.beginChallenge(world.flags[1]);add('freeplay can replay challenge',game.state.challenge?.id==='collect');game.reset();game.start();add('round reset removes goals props drops enemy state',world.flags.every(f=>!f.complete)&&world.camps.every(c=>!c.cleared)&&world.props.every(p=>p.active&&p.hp===p.maxHp)&&game.enemies.length===12&&game.state.respawns===0&&game.state.challenge===null);
return r;});checks.push(...report);
await page.keyboard.down('KeyW');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));check('blur pauses game and clears keyboard',(await state()).mode==='paused'&&await page.evaluate(()=>window.__gameTest.input.keys.size===0));await page.keyboard.up('KeyW');await page.locator('#resume').click();const a=await state();await advance(600);const b=await state();check('resume clears held input and settles ordinary movement inertia',Math.abs(a.player.z-b.player.z)<.25&&Math.abs(b.player.vz)<.01,{before:a.player,after:b.player});await page.screenshot({path:out+'/freeplay.png'});
check('browser emitted no runtime or console errors',errors.length===0,errors);
}catch(e){checks.push({name:'audit execution',pass:false,detail:e.stack});await page.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{fs.writeFileSync(out+'/report.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks:checks.map(c=>({name:c.name,pass:c.pass})),errors},null,2));if(checks.some(c=>!c.pass))process.exitCode=1;await page.close();await browser.close();}
