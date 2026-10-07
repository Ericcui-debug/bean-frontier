import assert from 'node:assert/strict';
import {setup} from './bomb-fixture.mjs';
import {MAPS} from '../src/maps.js';
import {CHARACTER} from '../src/dimensions.js';
let checks=0;const check=(v,n)=>{assert.ok(v,n);checks++;},run=(game,s,fps=30)=>{for(let t=0;t<s-1e-8;t+=1/fps)game.update(Math.min(1/fps,s-t));};
const fixture=setup(),{game,world,controls}=fixture;
for(const map of MAPS){
 check(game.setMap(map.id),'lobby can select '+map.id);check(game.world===world,'stable world reference '+map.id);check(world.id===map.id&&world.name===map.name,'metadata '+map.id);game.start();run(game,15);
 check(!game.setMap(MAPS.find(m=>m.id!==map.id).id),'cannot change map during match');
 game.combat.equip(game.player,2);game.combat.damage(game.player,100,game.actors[5],true);check(game.state.drops.length>=2,'fixture creates old map drops');check(!game.player.alive,'fixture old map player down');
 controls.fire=controls.interactHeld=true;game.reset();game.setMap(map.id);const snapshot=game.snapshot();check(snapshot.map.id===map.id,'text reports selected map');check(snapshot.characterSize.radius===CHARACTER.radius&&snapshot.characterSize.eye===CHARACTER.eye,'text shares physical dimensions');
 check(game.state.time===0&&game.state.scores.every(n=>n===0)&&game.player.alive&&game.player.money===800&&!game.player.equipment[1],'new map starts clean match');check(!game.state.drops.length&&!game.ai.reports[0].size&&!controls.fire&&!controls.interactHeld,'map change clears drops memory and input');
 for(const fps of [15,30,60]){
  game.reset();game.start();run(game,15,fps);const site=world.sites[0];Object.assign(game.player,{x:site.x,y:site.y,z:site.z,vx:0,vz:0});controls.interactHeld=true;game.state.phaseEndsAt=game.state.time+3;run(game,3,fps);check(game.state.phase==='planted',map.id+' exact plant '+fps);check(Math.abs(game.state.bomb.explodesAt-game.state.time-35)<1e-6,map.id+' bomb deadline '+fps);
  game.reset();game.start('defend');run(game,15,fps);Object.assign(game.player,{x:site.x,y:site.y,z:site.z,vx:0,vz:0});game.state.phase='planted';game.state.bomb={carrierId:null,planted:true,siteId:'A',x:site.x,y:site.y,z:site.z,explodesAt:game.state.time+5};game.state.phaseEndsAt=game.state.bomb.explodesAt;controls.interactHeld=true;run(game,5,fps);check(game.state.roundResult?.reason==='炸弹已拆除',map.id+' exact defuse '+fps);
 }
 game.reset();
}
// All floors must reject using a bomb or pickup through another floor.
for(const map of MAPS){game.setMap(map.id);game.start();run(game,15);const stacked=[...world.nav.values()].find(p=>p.y>1.6&&world.canWalk({x:p.x,y:0,z:p.z},{x:p.x,y:0,z:p.z}));if(stacked){Object.assign(game.player,{x:stacked.x,y:0,z:stacked.z});game.state.phase='planted';game.state.bomb={carrierId:null,planted:true,siteId:'A',x:stacked.x,y:stacked.y,z:stacked.z,explodesAt:game.state.time+35};check(game.nearestInteraction()===null,map.id+' no cross-floor defuse');}game.reset();}
console.log(`PASS ${checks} multi-map lifecycle and timing checks`);
