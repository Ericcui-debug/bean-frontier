import assert from 'node:assert/strict';
import {setup} from './bomb-fixture.mjs';
const checks=[];function check(name,value){assert.ok(value,name);checks.push(name);}
function run(game,s,fps=30){for(let t=0;t<s-1e-7;t+=1/fps)game.update(Math.min(1/fps,s-t));}
{
 const {game}=setup(false);game.start();run(game,15);game.down(game.player);
 const firstTime=game.state.time;let planted=false,roundEnd=false;for(let t=0;t<115;t+=.25){game.update(.25);if(game.state.phase==='planted')planted=true;if(game.state.phase==='round_end'){roundEnd=true;break;}}
 check('AI independent round resolves after playerdeath',roundEnd);check('bots moved from spawn',game.actors.some(a=>a.id!==0&&Math.abs(a.z-20)>5&&a.team===0));check('bots use gunshots and ammo',game.actors.some(a=>a.shots>0));check('round does not exceedactiveorbomb deadline',game.state.time-firstTime<=125);
 console.log('AI autonomousresult',game.state.roundResult,'plantobserved',planted,'clock',game.state.time);
}
{
 const {game}=setup(false);game.start();run(game,15);const shooter=game.actors[1],enemy=game.actors[5];Object.assign(shooter,{x:-18,y:0,z:0});Object.assign(enemy,{x:-18,y:0,z:-6});game.ai.decide(shooter,game.state.time);
 check('visible target recorded',shooter.lastSeen?.id===enemy.id);check('reactionhalfsecond',shooter.reactionUntil-game.state.time>=.5);
 const copy={...shooter.lastSeen};Object.assign(enemy,{x:0,z:-22});game.ai.decide(shooter,game.state.time+.2);check('hiddentargetlastseen copied not live',shooter.lastSeen.x===copy.x&&shooter.lastSeen.z===copy.z);check('hiddenenemy not availablefor fire',shooter.visibleTargetId===null);
 game.ai.decide(shooter,game.state.time+3.2);check('memory expires3seconds',shooter.lastSeen===null);check('teamreport expires without realtime refresh',game.ai.reports[shooter.team].size===0);
}
{
 const {game}=setup(false);game.start('defend');run(game,15);const defender=game.actors[1];Object.assign(defender,{x:-18,y:0,z:-6});game.state.phase='planted';game.state.bomb={carrierId:null,planted:true,siteId:'A',x:-18,y:0,z:-6,explodesAt:game.state.time+8};game.state.phaseEndsAt=game.state.bomb.explodesAt;
 // Freezeattackerdecisions behindspawnwall to isolate autonomousdefusehold.
 for(const a of game.actors.filter(a=>a.team===1)){a.decisionAt=Infinity;a.goal={x:a.x,y:a.y,z:a.z};a.visibleTargetId=null;}
 game.down(game.player);run(game,6);check('teamAI autonomously completesdefuse withoutplayer',game.state.roundResult?.reason==='炸弹已拆除');
}
console.log(`PASS ${checks.length} team AI perception / reactions / autonomousobjective checks`);
{
 const {game}=setup(false);game.start();run(game,15);for(const a of game.actors.filter(a=>a.team===1)){a.decisionAt=Infinity;a.goal={x:a.x,y:a.y,z:a.z};a.visibleTargetId=null;}game.down(game.player);let planted=false;for(let t=0;t<40;t+=.25){game.update(.25);if(game.state.phase==='planted'){planted=true;break;}}
 check('AI recovers deadplayer bomb and completes autonomousplant',planted&&game.state.bomb.siteId==='A');check('AI holdsstationary for3secondplant',game.state.time>=18);
 console.log('AI recoveredbomb plantat',game.state.time);
}
console.log(`PASS ${checks.length} total team AI checks`);
{
 const {game}=setup(false);game.start('defend');game.state.enemyTactic='B';game.setTactic('A');run(game,15);game.ai.decide(game.actors[6],game.state.time);game.ai.decide(game.actors[1],game.state.time);
 check('defensive A/B command does not reveal or control opponent attack plan',game.actors[6].goal.x>0);check('defensive teammates reinforce the called site',game.actors[1].goal.x<0);
}
console.log(`PASS ${checks.length} total team AI and independent tactics checks`);
