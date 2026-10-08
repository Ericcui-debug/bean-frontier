import assert from 'node:assert/strict';
import {setup} from './bomb-fixture.mjs';

let checks=0;function check(condition,message){assert.ok(condition,message);checks++;}
function run(game,seconds,fps=30){for(let time=0;time<seconds-1e-8;time+=1/fps)game.update(Math.min(1/fps,seconds-time));}
{
 const {game,controls}=setup();game.start('attack');check(game.actors.length===10,'5v5 actors');check(game.player.money===800,'openingmoney800');check(game.state.phase==='buy','opening purchasephase');
 const start={x:game.player.x,z:game.player.z};controls.z=1;controls.fire=true;run(game,2);check(game.player.x===start.x&&game.player.z===start.z,'preparation movementlocked');check(game.combat.state.shots===0,'preparation firelocked');check(game.buy('armor'),'armor buy600');check(game.player.money===200&&game.player.armor===100,'armor economics');check(!game.buy(2),'cannot buyunaffordable');game.setTactic('B');check(game.state.tactic==='B','B tacticcalled');
 game.pause();const t=game.state.time;run(game,5);check(game.state.time===t,'pause freezesclock');game.pause();run(game,13);check(game.state.phase==='active','buyends15 seconds');check(!controls.fire&&!controls.z,'purchaseend clearsheldinput');check(Math.abs(game.state.phaseEndsAt-game.state.time-180)<1e-6,'180second combat');
 game.player.money=8000;check(!game.buy(2),'no purchases afterbuy');game.reset();check(game.player.money===800&&game.player.equipment[1]===null,'freshmatchreset economy equipment');
}
for(const fps of [15,30,60]){
 const {game,controls,world}=setup();game.start();run(game,15,fps);Object.assign(game.player,{x:world.sites[0].x,y:world.sites[0].y,z:world.sites[0].z,vx:0,vz:0});game.state.phaseEndsAt=game.state.time+3;controls.interactHeld=true;run(game,3,fps);check(game.state.phase==='planted',`plant exactlycombatdeadline valid ${fps}`);check(Math.abs(game.state.bomb.explodesAt-game.state.time-35)<1e-6,`bomb35seconds ${fps}`);check(game.player.money===1100,`planterreward ${fps}`);
 // Continue after attackwipe; only bomb decides outcome.
 game.actors.filter(a=>a.team===game.state.attackTeam).forEach(a=>game.down(a));check(game.state.phase==='planted',`attackwipe postplant continues ${fps}`);run(game,35,fps);check(game.state.phase==='round_end'&&game.state.roundResult.winner===0,`bombexplosion attackwin ${fps}`);const score=game.state.scores[0];game.finishRound(1,'duplicate');check(game.state.scores[0]===score,`onlyone settlement ${fps}`);
}
for(const fps of [15,30,60]){
 const {game,controls,world}=setup();game.start('defend');run(game,15,fps);Object.assign(game.player,{x:world.sites[0].x,y:world.sites[0].y,z:world.sites[0].z,vx:0,vz:0});game.state.phase='planted';game.state.bomb={carrierId:null,planted:true,siteId:'A',x:game.player.x,y:game.player.y,z:game.player.z,explodesAt:game.state.time+5};game.state.phaseEndsAt=game.state.bomb.explodesAt;controls.interactHeld=true;run(game,5,fps);check(game.state.roundResult?.winner===0&&game.state.roundResult.reason==='炸弹已拆除',`defuse exactlybombdeadline valid ${fps}`);check(game.player.money===4100,`defuse+win rewards ${fps}`);
}
{
 const {game,controls,world}=setup();game.start();run(game,15);Object.assign(game.player,{x:world.sites[0].x,y:world.sites[0].y,z:world.sites[0].z,vx:0,vz:0});controls.interactHeld=true;run(game,1);check(game.state.interaction?.progress>.3,'continuoushold progresses');controls.interactHeld=false;game.update(1/30);check(!game.state.interaction,'release cancels');controls.interactHeld=true;run(game,1);controls.z=1;game.update(1/30);check(!game.state.interaction,'movement cancels');controls.z=0;game.player.vx=game.player.vz=0;controls.interactHeld=true;run(game,1);controls.fire=true;game.update(1/30);check(!game.state.interaction,'fire cancels');controls.fire=false;controls.interactHeld=true;Object.assign(game.player,{...world.spawns.attack[0],vx:0,vz:0});game.update(1/30);check(!game.state.interaction,'leave radius cancels');
 game.combat.equip(game.player,2);const killer=game.actors[5],money=killer.money;game.down(game.player,killer);check(killer.money===money+300,'killreward300');check(game.state.bomb.carrierId===null,'carrier deathdropsbomb');check(game.state.drops.filter(d=>d.type==='weapon').length===1,'primarydrops');const teammate=game.actors[1];Object.assign(teammate,{x:game.player.x,y:game.player.y,z:game.player.z});game.interactActor(teammate);check(game.state.bomb.carrierId===teammate.id,'teammatebombtakeover');check(!game.player.alive&&game.state.spectateId!==null,'deathteam spectator');game.action('speed');const time=game.state.time;game.update(.25);check(Math.abs(game.state.time-time-1)<1e-6,'4x spectator clock');
 game.reset();game.start('defend');run(game,15);game.actors.filter(a=>a.team===1).forEach(a=>game.down(a));game.update(1/120);check(game.state.roundResult?.winner===0,'preplant attackwipe defensewin');
}
{
 const {game}=setup();game.start();game.player.money=8000;check(game.buy(2),'rifle buy');check(game.buy('armor'),'armor buy');for(let round=1;round<=4;round++){run(game,15);game.finishRound(round%2,'test');run(game,4);}
 check(game.state.round===5&&game.state.attackTeam===1,'halftimeafter4');check(game.player.money===8000&&game.player.armor===100&&game.player.equipment[1]?.id===2,'half retainsmoneyarmorweapon');check(game.state.scores.join(',')==='2,2','teamidentical scores afterhalf');
 for(let round=5;round<=9;round++){run(game,15);game.finishRound(round<8?0:1,'test');run(game,4);if(game.state.mode==='match_end')break;}
 check(game.state.mode==='match_end'&&game.state.scores[0]===5,'firstto5 endsmatch');game.start('attack',true);check(game.state.round===1&&game.state.scores.join(',')==='0,0','restart resetswholematch');
}
{
 const {game}=setup();game.start();game.player.money=3000;game.buy(2);run(game,15);game.player.equipment[1].ammo=2;game.finishRound(0,'test');run(game,4);check(game.player.equipment[1]?.id===2&&game.player.equipment[1].ammo===30,'survivor retainsand refillsgear');
 check(game.snapshot().actors.filter(a=>a.team===1).every(a=>a.x===undefined),'hidden enemy coordinates not exposed');
}
console.log(`PASS ${checks} bomb match / economy / deadline / lifecycle checks`);
{
 const {game}=setup();game.start();run(game,15);for(const a of game.actors){a.alive=false;a.hp=0;}game.update(1/30);check(game.state.phase==='round_end'&&game.state.scores[0]+game.state.scores[1]===1,'simultaneouswipe resolvesonce');const result={...game.state.roundResult};game.update(1/30);check(game.state.roundResult.winner===result.winner&&game.state.scores[0]+game.state.scores[1]===1,'no duplicatebothwipe rewards');
 const capped=setup().game;capped.start();run(capped,15);capped.player.money=7900;capped.finishRound(0,'cap');check(capped.player.money===8000,'winmoney cap8000');
 const timeout=setup().game;timeout.start();run(timeout,195);check(timeout.state.roundResult?.winner===1,'unplantedtimeout defensewin');
}
console.log(`PASS ${checks} total bomb match checks including simultaneous wipe and funding cap`);
{
 const {game}=setup();game.start();for(let round=1;round<=9;round++){run(game,15);game.finishRound(round%2===1?0:1,'nine');run(game,4);if(round<9)check(game.state.mode==='playing'&&game.state.round===round+1,'nine-round limit continuesuntil decidinground');}
 check(game.state.mode==='match_end'&&game.state.round===9&&game.state.scores.join(',')==='5,4','maximumnine rounds ends5-4');
 const survivor=setup().game;survivor.start();survivor.player.money=6000;survivor.buy(2);survivor.buy('armor');run(survivor,15);survivor.finishRound(0,'alive');run(survivor,4);const before=survivor.player.money;survivor.buy('recommended');check(survivor.player.money===before,'recommendationdoesnotrebuy retainedriflearmor');
}
console.log(`PASS ${checks} comprehensive match checks`);
