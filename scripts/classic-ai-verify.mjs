import assert from 'node:assert/strict';
import {setup,perceptionFixture} from './bomb-fixture.mjs';
const checks=[];const check=(v,s)=>{assert.ok(v,s);checks.push(s);};
const run=(g,s)=>{for(let t=0;t<s-1e-8;t+=.1)g.update(Math.min(.1,s-t));};
for(const id of ['assault','dust2']){
 const {game:g,world}=setup(false,id);g.start();run(g,15);g.actors.forEach(a=>a.alive=false);const shooter=g.actors[1],enemy=g.actors[5],p=perceptionFixture(world);Object.assign(shooter,{...p.from,alive:true});Object.assign(enemy,{...p.visible,alive:true});g.ai.decide(shooter,g.state.time);check(shooter.lastSeen?.id===enemy.id,id+' sightrecord');check(shooter.reactionUntil-g.state.time>=.5,id+' reaction');const last={...shooter.lastSeen};Object.assign(enemy,p.hidden);g.ai.decide(shooter,g.state.time+.2);check(shooter.lastSeen.x===last.x&&shooter.lastSeen.z===last.z,id+' hiddenmemorycopy');check(shooter.visibleTargetId===null,id+' obstruction');g.ai.decide(shooter,g.state.time+3.2);check(shooter.lastSeen===null&&g.ai.reports[shooter.team].size===0,id+' expirememory');
}
{
 const {game:g,world}=setup(false,'assault');g.start();run(g,15);g.down(g.player);for(const a of g.actors.filter(a=>a.team!==g.state.ctTeam)){a.isPlayer=true;a.x=1000+a.id;a.z=1000;a.decisionAt=Infinity;a.goal={x:a.x,y:a.y,z:a.z};a.visibleTargetId=null;} // Out-of-play living sentinels isolate autonomous objective navigation.
 let end=false;for(let t=0;t<180;t+=.25){g.update(.25);if(g.state.phase==='round_end'){end=true;break;}}
 check(end,'rescue autonomous resolves');check(g.hostages.rescuedCount()>=2&&g.state.roundResult.winner===g.state.ctTeam,'rescue bots recruitandescort withoutplayer');check(g.actors.some(a=>a.team===g.state.ctTeam&&Math.hypot(a.x-world.spawns.attack[a.id%5].x,a.z-world.spawns.attack[a.id%5].z)>8),'rescue botsleave spawn');
}
{
 const {game:g}=setup(false,'dust2');g.start();run(g,15);g.down(g.player);for(const a of g.actors.filter(a=>a.team!==g.state.attackTeam)){a.isPlayer=true;a.x=1000+a.id;a.z=1000;a.decisionAt=Infinity;a.goal={x:a.x,y:a.y,z:a.z};a.visibleTargetId=null;}let planted=false;for(let t=0;t<160;t+=.25){g.update(.25);if(g.state.phase==='planted'){planted=true;break;}if(g.state.phase==='round_end')break;}check(planted,'bomb AIrecoverplant afterplayerdeath');
}
{
 const {game:g,world}=setup(false,'dust2');g.start('defend');run(g,15);const site=world.sites[0],a=g.actors[1];Object.assign(a,{x:site.x,y:site.y,z:site.z});g.state.phase='planted';g.state.bomb={planted:true,carrierId:null,siteId:site.id,x:site.x,y:site.y,z:site.z,explodesAt:g.state.time+8};g.state.phaseEndsAt=g.state.bomb.explodesAt;for(const enemy of g.actors.filter(v=>v.team!==g.player.team)){enemy.decisionAt=Infinity;enemy.goal={x:enemy.x,y:enemy.y,z:enemy.z};enemy.visibleTargetId=null;}g.down(g.player);run(g,6);check(g.state.roundResult?.reason==='炸弹已拆除','bomb AIdefuse afterplayerdeath');
}
{
 const {game:g,world}=setup(false,'assault');g.start();run(g,15);for(const a of g.actors.filter(a=>a.team===g.state.ctTeam&&a.id!==3))g.down(a);for(const a of g.actors.filter(a=>a.team!==g.state.ctTeam)){a.isPlayer=true;a.x=1000+a.id;a.z=1000;}let rescued=false,ascended=false,descended=false;const soldier=g.actors[3];for(let t=0;t<130;t+=.25){g.update(.25);if(soldier.y>6.5)ascended=true;if(ascended&&soldier.y<3.5)descended=true;if(g.hostages.rescuedCount()){rescued=true;break;}}check(ascended&&descended,'roof AIclimbs anddescends withoutmidladder repath');check(!world.solids.find(s=>s.id==='roof-grille').active&&soldier.shots>=3,'roof AIshootsgrille');check(rescued,'roof AIusesduct thenescort groundroute');
}
for(const id of ['assault','dust2']){
 const {game:g,world}=setup(false,id);g.start();run(g,15);g.down(g.player);let ended=false;for(let t=0;t<220;t+=.25){g.update(.25);if(g.state.phase==='round_end'){ended=true;break;}}check(ended,id+' completecombatround withoutplayer');check(g.actors.some(a=>a.shots>0),id+' naturalAIshoots');check(g.actors.some(a=>a.id!==0&&Math.hypot(a.x-world.spawns[a.role][a.id%5].x,a.z-world.spawns[a.role][a.id%5].z)>8),id+' naturalAIprogress');
}
console.log('PASS '+checks.length+' classic AI / visibility / independent objectives checks');
