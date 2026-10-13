import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {CONFIG} from '../src/upstream/tinystrike/shared/config.js';
import {EventBus} from '../src/upstream/tinystrike/shared/events.js';
import Rounds from '../src/upstream/tinystrike/game/rounds.js';
import Bots from '../src/upstream/tinystrike/ai/bots.js';
import Weapons from '../src/upstream/tinystrike/weapons/weapons.js';
import TouchControls from '../src/upstream/tinystrike/core/touch-controls.js';
function fixture(team='t'){
 const events=new EventBus();
 const g={config:CONFIG,events,state:{phase:'menu',scores:{ct:0,t:0},money:8000,round:1,bomb:{}},
 player:{team,networkId:'player',alive:true,onGround:true,hasKit:false,armor:0,position:new THREE.Vector3(),velocity:new THREE.Vector3(),moveSpeed2D:0},
 input:{isDown:k=>k==='e',firing:false},multiplayer:{active:false},
 world:{bombSites:[{name:'A',center:new THREE.Vector3(),box:new THREE.Box3(new THREE.Vector3(-2,-2,-2),new THREE.Vector3(2,2,2))}]},
 bots:{all:[{team:'ct',alive:true},{team:'t',alive:true}],aliveOf(t){return this.all.filter(b=>b.alive&&b.team===t).length;}}};
 const r=g.rounds=new Rounds(g);r._placeBombMesh=()=>{};r._updateBombVisual=()=>{};r._setBombDefusedVisual=()=>{};r._removeBombMesh=()=>{};
 g.state.phase='live';g.state.timer=3.2;g.state.bomb.carrierId='player';return g;
}
function advance(g,seconds,fps){let accumulator=0,ticks=0;for(let time=0;time<seconds-1e-8;time+=1/fps){accumulator+=Math.min(1/fps,seconds-time);while(accumulator+1e-10>=1/120){g.rounds.update(1/120);accumulator-=1/120;ticks++;}}return ticks;}
for(const fps of [15,30,60]){
 test(`T human plants at exact deadline, ${fps} rendering FPS`,()=>{const g=fixture();advance(g,3.2,fps);assert.equal(g.state.phase,'planted');assert.equal(g.state.timer,40);assert.equal(g.state.bomb.site,'A');});
 test(`CT kit defuses at exact deadline only once, ${fps} FPS`,()=>{const g=fixture('ct');g.rounds._onBombPlanted({site:'A',pos:new THREE.Vector3()});g.state.timer=5;g.player.hasKit=true;advance(g,5,fps);assert.equal(g.state.phase,'roundEnd');assert.equal(g.state.scores.ct,1);g.events.emit('bomb:defused',{by:'player'});assert.equal(g.state.scores.ct,1);});
 test(`late plant/defuse cannot beat fuse, ${fps} FPS`,()=>{let g=fixture();g.state.timer=3.19;advance(g,3.2,fps);assert.equal(g.state.phase,'roundEnd');assert.equal(g.rounds.lastRoundResult().reason,'time');g=fixture('ct');g.player.hasKit=true;g.rounds._onBombPlanted({site:'A',pos:new THREE.Vector3()});g.state.timer=4.99;advance(g,5,fps);assert.equal(g.rounds.lastRoundResult().reason,'bomb');});
}
test('plant cancels on release, movement and shooting; T cannot defuse',()=>{const g=fixture();g.rounds.update(1);assert.ok(g.state.bomb.plantProgress>0);g.input.firing=true;g.rounds.update(.1);assert.equal(g.state.bomb.plantProgress,0);g.input.firing=false;g.player.moveSpeed2D=1;g.rounds.update(.1);assert.equal(g.state.bomb.plantProgress,0);g.player.moveSpeed2D=0;g.input.isDown=()=>false;g.rounds.update(.1);assert.equal(g.state.bomb.plantProgress,0);g.input.isDown=()=>true;g.rounds._onBombPlanted({site:'A',pos:new THREE.Vector3()});g.rounds.update(1);assert.equal(g.state.bomb.defuseProgress,0);});
test('T eliminated after plant continues fuse; unplanted CT hold; simultaneous wipe native T win',()=>{let g=fixture('ct');g.rounds._onBombPlanted({site:'A',pos:new THREE.Vector3()});g.bots.all[1].alive=false;g.rounds.update(.1);assert.equal(g.state.phase,'planted');g=fixture('ct');g.bots.all[1].alive=false;g.rounds.update(.1);assert.equal(g.state.scores.ct,1);g=fixture();g.player.alive=false;g.bots.all.forEach(b=>b.alive=false);g.rounds.update(.1);assert.equal(g.state.scores.t,1);});
test('first eight wins ends one match, restart is fresh economics',()=>{const g=fixture();g.state.round=15;g.state.scores.t=7;g.rounds._endRound('t','elimination');assert.equal(g.rounds._matchWinner,'t');assert.equal(g.state.scores.t,8);g.rounds.update(5);assert.equal(g.state.phase,'gameEnd');});
test('AI surviving guns remain selected, deaths reset purchased inventory using native prices',()=>{const g=fixture('ct');g.state.round=3;const b={team:'ct',_survived:true,weaponId:'awp',armor:63,money:4200,mag:1};const bots=Object.assign(Object.create(Bots.prototype),{game:g,all:[b],_applyGunLook(){}});bots._assignLoadouts(3);assert.equal(b.weaponId,'awp');assert.equal(b.armor,63);assert.equal(b.money,4200);assert.equal(b.mag,10);b._survived=false;b.money=0;bots._assignLoadouts(3);assert.equal(b.weaponId,'usp');assert.equal(b.armor,0);});
test('AI objective timer is fixed-time rather than ten-Hz think time, kit uses five seconds',()=>{const g=fixture('ct'),bot={state:'defuse',pos:new THREE.Vector3(),defuseTimer:0,hasKit:true};const bots=Object.assign(Object.create(Bots.prototype),{game:g,_match:CONFIG.MATCH,_bombPos:new THREE.Vector3(),_enemyVisibleQuick:()=>false});g.rounds._onBombPlanted({site:'A',pos:new THREE.Vector3()});for(let n=0;n<600;n++)bots._advanceObjective(bot,1/120);assert.equal(g.state.scores.ct,1);});

test('native automatic cadence and recoil are identical at 15/30/60 rendering FPS',()=>{
 const results=[];
 for(const fps of [15,30,60]){
  const g=fixture('ct');g.camera=new THREE.PerspectiveCamera();g.input={locked:true,firing:true,isDown:()=>false};g.player.eyePos=()=>new THREE.Vector3(0,1.296,0);g.player.onGround=true;g.state.canBuy=true;
  const w=g.weapons=new Weapons(g);w.resetForRound({died:true});w.give('ak47');w.equip('ak47');g.state.phase='freeze';w.update(1);g.state.phase='live';let shots=0;g.events.on('weapon:fire',()=>shots++);
  let accumulator=0;for(let frame=0;frame<fps*2;frame++){accumulator+=1/fps;while(accumulator+1e-10>=1/120){w.update(1/120);accumulator-=1/120;}}
  results.push({shots,mag:w.currentAmmo().mag,pitch:w._driftP,yaw:w._driftY});
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);assert.ok(results[0].shots>10);
});

test('held mobile semi-auto trigger retains native cadence across15/30/60FPS',()=>{
 const shots=[];
 for(const fps of [15,30,60]){
  const g=fixture('ct');g.camera=new THREE.PerspectiveCamera();g.input={locked:true,firing:true,isDown:()=>false};g.player.eyePos=()=>new THREE.Vector3(0,1.296,0);g.player.onGround=true;g.state.canBuy=true;
  const w=g.weapons=new Weapons(g);w.resetForRound({died:true});w.give('glock');w.equip('glock');g.state.phase='freeze';w.update(1);g.state.phase='live';let count=0;g.events.on('weapon:fire',()=>count++);
  const touch=Object.assign(Object.create(TouchControls.prototype),{game:g,_firePointers:new Set([1])});
  let acc=0;for(let frame=0;frame<fps*2;frame++){acc+=1/fps;while(acc+1e-10>=1/120){touch.updateTrigger();w.update(1/120);acc-=1/120;}}
  shots.push(count);touch._firePointers.clear();g.input.firing=false;for(let i=0;i<120;i++){touch.updateTrigger();w.update(1/120);}assert.equal(count,shots.at(-1));
 }
 assert.equal(shots[0],shots[1]);assert.equal(shots[1],shots[2]);assert.ok(shots[0]>10);
});
