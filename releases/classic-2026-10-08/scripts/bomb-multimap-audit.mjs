// Independent audit: exercise every actual vertical edge, not just authored ramps.
import assert from 'node:assert/strict';
import {setup} from './bomb-fixture.mjs';
import {MAPS} from '../src/maps.js';
import {CHARACTER} from '../src/dimensions.js';
import {moveActor} from '../src/physics.js';
let checks=0,edges=0;
const check=(pass,label)=>{assert.ok(pass,label);checks++;};
for(const def of MAPS){
 const {game,world,controls}=setup(true,def.id);
 const groundNodes=[...world.nav.values()].filter(p=>Math.abs(p.y)<.001),spawn=world.spawns.attack[0],entry=groundNodes.reduce((best,p)=>Math.hypot(p.x-spawn.x,p.z-spawn.z)<Math.hypot(best.x-spawn.x,best.z-spawn.z)?p:best);
 const visited=new Set([entry.id]),queue=[entry.id];while(queue.length){const id=queue.pop();for(const next of world.nav.get(id).neighbors)if(!visited.has(next)){visited.add(next);queue.push(next);}}
 check(groundNodes.every(p=>visited.has(p.id)),def.id+' every valid ground-level room is reachable from spawn');
 if(def.id==='town'){
  const visitor={x:16,y:0,z:-7,radius:CHARACTER.radius,height:CHARACTER.height,grounded:true,vy:0,vx:-2,vz:0};
  for(let i=0;i<360;i++)moveActor(visitor,1/120,world);
  check(Math.abs(visitor.x-10)<.01&&visitor.y===0&&visitor.z===-7,'town ground-level shop door is genuinely enterable beneath its roof');
 }
 let occupied=0;for(const node of world.nav.values()){
  const actor={...node,radius:CHARACTER.radius,height:CHARACTER.height,grounded:true,vy:0,vx:0,vz:0};moveActor(actor,1/120,world);occupied++;
  check(Math.hypot(actor.x-node.x,actor.z-node.z)<1e-7&&Math.abs(actor.y-node.y)<.04,def.id+' nav node can retain its actual body without being ejected');
 }
 for(const fps of [15,30,60])for(const from of world.nav.values())for(const id of from.neighbors){
  const to=world.nav.get(id);if(Math.abs(from.y-to.y)<.1)continue;
  const actor={...from,radius:CHARACTER.radius,height:CHARACTER.height,grounded:true,vy:0};
  for(let step=0;step<fps;step++){
   const dx=to.x-actor.x,dz=to.z-actor.z,distance=Math.hypot(dx,dz);if(distance<.01)break;
   const speed=Math.min(4.3,distance*fps);actor.vx=dx/distance*speed;actor.vz=dz/distance*speed;moveActor(actor,1/fps,world);
  }
  check(Math.hypot(actor.x-to.x,actor.z-to.z)<.1&&Math.abs(actor.y-to.y)<.1,`${def.id} vertical edge ${from.id}->${id} at ${fps} FPS`);edges++;
 }
 const stacked=[...world.nav.values()].find(p=>p.y>1.7&&world.canWalk({x:p.x,y:0,z:p.z},{x:p.x,y:0,z:p.z}));
 check(!!stacked,def.id+' has actual upstairs and downstairs');
 const support=world.solids.find(s=>s.shape!=='ramp'&&s.y0>1.0&&stacked.x>s.x0&&stacked.x<s.x1&&stacked.z>s.z0&&stacked.z<s.z1);
 check(!!support,def.id+' stacked layer has a real ceiling');
 check(support.y0>=CHARACTER.height,def.id+' underpass genuinely clears full bean body');
 const jumper={x:stacked.x,y:0,z:stacked.z,radius:CHARACTER.radius,height:CHARACTER.height,grounded:false,vx:0,vz:0,vy:7.4};
 for(let i=0;i<120;i++){moveActor(jumper,1/120,world);check(jumper.y+CHARACTER.height<=support.y0+1e-6&&Math.hypot(jumper.x-stacked.x,jumper.z-stacked.z)<1e-6,def.id+' jump never enters ceiling or gets ejected sideways');}
 check(jumper.grounded&&jumper.y===0,def.id+' ceiling jump lands downstairs');
 game.start('defend');game.update(15);Object.assign(game.player,{x:stacked.x,y:0,z:stacked.z,vx:0,vz:0});
 game.state.phase='planted';game.state.bomb={carrierId:null,planted:true,siteId:'A',x:stacked.x,y:stacked.y,z:stacked.z,explodesAt:game.state.time+35};
 check(game.nearestInteraction()===null,def.id+' downstairs cannot defuse upstairs');
 Object.assign(game.player,{y:stacked.y});game.state.bomb.y=0;check(game.nearestInteraction()===null,def.id+' upstairs cannot defuse downstairs');
 game.reset();game.start();game.update(15);const victim=game.actors[5];Object.assign(victim,{x:0,y:0,z:0});game.actors.forEach(a=>a.alive=a===victim||a===game.player);
 check(game.combat.actorHit({x:.45,y:CHARACTER.body.y,z:-2},{x:.45,y:CHARACTER.body.y,z:2},game.player)===null,def.id+' former wide body outline is no longer hittable');
 check(game.combat.actorHit({x:0,y:CHARACTER.head.y,z:-2},{x:0,y:CHARACTER.head.y,z:2},game.player)?.head,def.id+' resized head is hittable');
 game.reset();controls.fire=controls.interactHeld=true;game.ai.reports[0].set(99,{x:1,y:1,z:1,at:1});game.state.drops.push({id:999,type:'weapon',x:1,y:0,z:1});
 game.setMap(def.id);check(!controls.fire&&!controls.interactHeld&&!game.ai.reports[0].size&&!game.state.drops.length,def.id+' full reset removes held input drops and reports');
 check(world.id===def.id&&game.state.time===0&&game.player.money===800,def.id+' restart retains map and resets match');
 const other=MAPS.find(m=>m.id!==def.id);game.setMap(other.id);check(game.world===world&&world.id===other.id,def.id+' swap retains world identity');
 check(game.g.scene.children.filter(o=>o.name.startsWith('map:')).length===1,def.id+' swap leaves exactly one map root');
 console.log('PASS independent audit '+def.id+' with '+occupied+' stationary node probes');
}
console.log(`PASS ${checks} independent checks including ${edges} vertical edge traversals`);
