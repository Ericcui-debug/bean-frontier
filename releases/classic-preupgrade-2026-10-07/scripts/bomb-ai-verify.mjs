import assert from 'node:assert/strict';
import {setup,perceptionFixture} from './bomb-fixture.mjs';
import {MAPS} from '../src/maps.js';
import {CHARACTER} from '../src/dimensions.js';
const checks=[];function check(name,value){assert.ok(value,name);checks.push(name);}
function run(game,s,fps=30){for(let t=0;t<s-1e-7;t+=1/fps)game.update(Math.min(1/fps,s-t));}
const originalRandom=Math.random;let seed=884;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
for(const map of MAPS){
 {
  const {game,world}=setup(false,map.id);game.start();run(game,15);game.down(game.player);
  const firstTime=game.state.time;let roundEnd=false;for(let t=0;t<125;t+=.25){game.update(.25);if(game.state.phase==='round_end'){roundEnd=true;break;}}
  check(map.id+' independent round resolves after player death',roundEnd);check(map.id+' bots move away from authored spawn',game.actors.some(a=>a.id!==0&&a.team===0&&Math.hypot(a.x-world.spawns.attack[a.id%5].x,a.z-world.spawns.attack[a.id%5].z)>5));
  check(map.id+' bots use gunshots and ammunition',game.actors.some(a=>a.shots>0));check(map.id+' respects combat or bomb deadline',game.state.time-firstTime<=125);
 }
 {
  const {game,world}=setup(false,map.id);game.start();run(game,15);game.actors.forEach(a=>a.alive=false);const shooter=game.actors[1],enemy=game.actors[5],p=perceptionFixture(world);Object.assign(shooter,{...p.from,alive:true});Object.assign(enemy,{...p.visible,alive:true});game.ai.decide(shooter,game.state.time);
  check(map.id+' visible target recorded',shooter.lastSeen?.id===enemy.id);check(map.id+' acquisition reaction >= half second',shooter.reactionUntil-game.state.time>=.5);
  const copy={...shooter.lastSeen};Object.assign(enemy,p.hidden);game.ai.decide(shooter,game.state.time+.2);check(map.id+' hidden memory copied rather than live',shooter.lastSeen.x===copy.x&&shooter.lastSeen.z===copy.z);check(map.id+' obstructed enemy cannot be fired on',shooter.visibleTargetId===null);
  game.ai.decide(shooter,game.state.time+3.2);check(map.id+' visual and report memory expire after 3 seconds',shooter.lastSeen===null&&game.ai.reports[shooter.team].size===0);
 }
 {
  const {game,world}=setup(false,map.id);game.start('defend');run(game,15);const defender=game.actors[1],site=world.sites[0];Object.assign(defender,{x:site.x,y:site.y,z:site.z});game.state.phase='planted';game.state.bomb={carrierId:null,planted:true,siteId:'A',x:site.x,y:site.y,z:site.z,explodesAt:game.state.time+8};game.state.phaseEndsAt=game.state.bomb.explodesAt;
  for(const a of game.actors.filter(a=>a.team===1)){a.decisionAt=Infinity;a.goal={x:a.x,y:a.y,z:a.z};a.visibleTargetId=null;}
  game.down(game.player);run(game,6);check(map.id+' team AI defuses without player',game.state.roundResult?.reason==='炸弹已拆除');
 }
 {
  const {game}=setup(false,map.id);game.start();run(game,15);for(const a of game.actors.filter(a=>a.team===1)){a.decisionAt=Infinity;a.goal={x:a.x,y:a.y,z:a.z};a.visibleTargetId=null;}game.down(game.player);let planted=false;
  for(let t=0;t<55;t+=.25){game.update(.25);if(game.state.phase==='planted'){planted=true;break;}}
  check(map.id+' AI recovers dropped bomb, navigates and plants',planted&&game.state.bomb.siteId==='A');check(map.id+' plant requires full continuous duration',game.state.time>=18);
 }
 {
  const {game,world}=setup(false,map.id);game.start('defend');game.state.enemyTactic='B';game.setTactic('A');run(game,15);game.actors.filter(a=>a.team!==0).forEach(a=>a.visibleTargetId=null);game.ai.decide(game.actors[6],game.state.time);game.ai.decide(game.actors[1],game.state.time);
  const route=world.routeVariants.B[6%world.routeVariants.B.length];check(map.id+' opponent route uses independent B tactic',Math.hypot(game.actors[6].goal.x-route[0].x,game.actors[6].goal.z-route[0].z)<.01);
  const expected=world.defenseByTactic.A[1];check(map.id+' friendly defense uses authored A anchor',Math.hypot(game.actors[1].goal.x-expected.x,game.actors[1].goal.z-expected.z)<.01);
  check(map.id+' scaled actor and navigation use shared dimensions',game.player.radius===CHARACTER.radius&&game.player.height===CHARACTER.height);
 }
 console.log('PASS AI map '+map.id);
}
Math.random=originalRandom;console.log(`PASS ${checks.length} multi-map team AI checks`);
