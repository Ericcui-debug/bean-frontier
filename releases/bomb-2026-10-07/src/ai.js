import {poseBean} from './character.js';
import {moveActor,sweepActor} from './physics.js';
// Visual knowledge expires in three seconds. Reports copy observations rather
// than holding live references to a hidden opponent's position.
export function createAI(g,world,actors,{state,combat,nearestInteraction,interactActor}){
 const reports=[new Map(),new Map()],gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),eye=a=>({x:a.x,y:a.y+1.5,z:a.z});
 function reset(){reports.forEach(m=>m.clear());actors.forEach(a=>Object.assign(a,{aiMode:'prepare',decisionAt:0,path:[],pathTarget:null,repathAt:0,visibleTargetId:null,lastSeen:null,memoryUntil:0,reactionUntil:0,burstRemaining:0,burstRestUntil:0,routeIndex:0,holdUse:false,stuck:0,cover:null,coverUntil:0,goal:null,aiSpread:.009+(a.id%3)*.003}));}
 function validPoint(x,z,a){const y=world.groundAt(x,z,a.y+.38),p={x,y,z};return y!==null&&world.canWalk(p,p,.58)?p:null;}
 function seekCover(a,seen,time){
  let best=null;for(const s of world.solids){if(!s.active||s.shape==='ramp'||s.type==='floor'||s.type==='boundary'||s.y1<a.y+1.5||s.y0>a.y+.2||s.x1-s.x0>8||s.z1-s.z0>10)continue;const cx=(s.x0+s.x1)/2,cz=(s.z0+s.z1)/2;if(Math.hypot(cx-a.x,cz-a.z)>8)continue;
   const xSide=Math.abs(seen.x-cx)>Math.abs(seen.z-cz),sign=xSide?(seen.x<cx?1:-1):(seen.z<cz?1:-1);
   const hide=xSide?validPoint(sign>0?s.x1+1.0:s.x0-1.0,cz,a):validPoint(cx,sign>0?s.z1+1.0:s.z0-1.0,a);if(!hide||!world.blocked(eye(hide),seen))continue;
   const peek=xSide?[validPoint(hide.x,s.z0-1.0,a),validPoint(hide.x,s.z1+1.0,a)]:[validPoint(s.x0-1.0,hide.z,a),validPoint(s.x1+1.0,hide.z,a)];
   const options=peek.filter(p=>p&&world.canWalk(hide,p,.57)&&!world.blocked(eye(p),seen));if(!options.length)continue;const p=options.sort((x,y)=>gap(a,x)-gap(a,y))[0],score=gap(a,hide);if(!best||score<best.score)best={hide,peek:p,score,phase:'hide',until:time+.45+(a.id%3)*.12};
  }return best;
 }
 function observe(a,time){
  let target=null,distance=Infinity;for(const other of actors){if(!other.alive||other.team===a.team)continue;const d=gap(a,other);if(d>43||d>=distance||world.blocked(eye(a),eye(other)))continue;target=other;distance=d;}
  if(target){if(a.visibleTargetId!==target.id)a.reactionUntil=time+.5+(a.id%3)*.04;a.visibleTargetId=target.id;
   const seen={id:target.id,x:target.x,y:target.y+1.32,z:target.z,vx:target.vx,vz:target.vz,at:time};a.lastSeen={...seen};a.memoryUntil=time+3;reports[a.team].set(target.id,{...seen});return seen;
  }
  a.visibleTargetId=null;if(a.lastSeen&&time>=a.memoryUntil)a.lastSeen=null;
  if(!a.lastSeen){let latest=null;for(const [id,report] of reports[a.team]){if(time-report.at>3){reports[a.team].delete(id);continue;}if(!latest||gap(a,report)<gap(a,latest))latest=report;}if(latest){a.lastSeen={...latest};a.memoryUntil=latest.at+3;a.reactionUntil=time+.55;}}
  return null;
 }
 function bombGoal(a,time){
  const b=state.bomb;a.holdUse=false;
  if(state.phase==='planted'){
   if(a.team!==state.attackTeam){const use=nearestInteraction(a);if(use?.type==='defuse'){a.holdUse=true;a.aiMode='defuse';return {x:a.x,y:a.y,z:a.z};}a.aiMode='retake';return {x:b.x,y:b.y,z:b.z};}
   const angle=(a.id%5)*1.256,site=world.sites.find(s=>s.id===b.siteId),point=validPoint(site.x+Math.sin(angle)*5.5,site.z+Math.cos(angle)*5.5,a);a.aiMode='guard';return point||{x:site.x,y:site.y,z:site.z};
  }
  if(a.team===state.attackTeam){
   if(b.carrierId===null){a.aiMode='recover';if(gap(a,b)<2.2){interactActor(a);if(b.carrierId===a.id)return bombGoal(a,time);}return {x:b.x,y:b.y,z:b.z};}
   const site=world.sites.find(s=>s.id===(a.team===actors[0].team?state.tactic:state.enemyTactic||'A')),isCarrier=b.carrierId===a.id,use=nearestInteraction(a);
   if(isCarrier&&use?.type==='plant'){a.holdUse=true;a.aiMode='plant';return {x:a.x,y:a.y,z:a.z};}
   // Most teammates follow the called site; one uses its inner connecting lane.
   const route=world.routes[site.id],offset=a.id%5===3?(site.id==='A'?7:-7):0;
   while(a.routeIndex<route.length-1&&gap(a,{...route[a.routeIndex],x:route[a.routeIndex].x+offset})<2)a.routeIndex++;
   a.aiMode=isCarrier?'carry':'push';const target=route[a.routeIndex];return {...target,x:target.x+(a.routeIndex<route.length-1?offset:0)};
  }
  a.aiMode='hold';if(a.team===actors[0].team){const side=state.tactic==='A'?-1:1,defense=[{x:side*18,y:0,z:-10},{x:side*18,y:0,z:-10},{x:side*10,y:0,z:-17},{x:-side*18,y:0,z:-10},{x:0,y:0,z:-10}];return defense[a.id%5];}return world.defensePositions[a.id%5];
 }
 function decide(a,time){
  const seen=observe(a,time);a.visible=!!seen;a.goal=bombGoal(a,time);
  if(seen){
   const d=gap(a,seen);a.aimTarget={x:seen.x+seen.vx*.045,y:seen.y+(a.id%4===0?.32:0),z:seen.z+seen.vz*.045};
   // Urgent late defuses continue under fire; otherwise fight before interaction.
   if(a.holdUse&&d<12&&!(state.phase==='planted'&&a.team!==state.attackTeam&&state.bomb.explodesAt-time<7))a.holdUse=false;
   if(a.holdUse)return;
   if(time>=a.coverUntil){a.cover=seekCover(a,seen,time);a.coverUntil=time+3.5;}
   if(a.cover){if(time>=a.cover.until){a.cover.phase=a.cover.phase==='hide'?'peek':'hide';a.cover.until=time+(a.cover.phase==='hide'?.55:1.0);}a.goal=a.cover.phase==='hide'?a.cover.hide:a.cover.peek;a.aiMode=a.cover.phase;}
   else if(d<6){const dx=a.x-seen.x,dz=a.z-seen.z;a.goal=validPoint(a.x+dx/d*2,a.z+dz/d*2,a)||{x:a.x,y:a.y,z:a.z};a.aiMode='retreat';}
   else if(d<27){const hit=combat.actorHit?.(eye(a),a.aimTarget,a);if(hit?.actor.team===a.team){const dx=seen.x-a.x,dz=seen.z-a.z;a.goal=validPoint(a.x+(a.id%2?1:-1)*(-dz/d)*1.8,a.z+(a.id%2?1:-1)*(dx/d)*1.8,a)||a.goal;a.aiMode='flank';}else if(state.bomb.carrierId!==a.id||d<13){a.goal={x:a.x,y:a.y,z:a.z};a.aiMode='engage';}}
  }else if(a.lastSeen&&!a.holdUse&&state.bomb.carrierId!==a.id&&(a.team===state.attackTeam?a.id%2===0:[2,4].includes(a.id%5))){a.aiMode='search';a.goal={x:a.lastSeen.x,y:a.lastSeen.y-1.32,z:a.lastSeen.z};a.cover=null;}
  else a.cover=null;
  const o=nearestInteraction(a);if(o?.type==='weapon'&&(!a.equipment[1]||o.equipment.id>a.equipment[1].id))interactActor(a);
 }
 function update(dt,time,c){
  if(!['active','planted'].includes(state.phase))return;
  for(const a of actors){if(a.isPlayer||!a.alive)continue;
   if(time>=a.decisionAt){decide(a,time);a.decisionAt=time+.18+(a.id%4)*.025;}
   const visibleActor=actors.find(v=>v.id===a.visibleTargetId&&v.alive),hasSight=visibleActor&&!world.blocked(eye(a),eye(visibleActor));
   const equipped=a.equipment[a.slot]||a.equipment[0];if(equipped?.ammo===0){if(equipped.reserve>0)c.reload(a);else if(a.slot===1)c.select(a,0);}
   const firing=hasSight&&!a.holdUse&&time>=a.reactionUntil&&a.cover?.phase!=='hide'&&time>=a.burstRestUntil;
   if(firing&&c.fire(a)){if(!a.burstRemaining)a.burstRemaining=2+(a.id%3);a.burstRemaining--;if(!a.burstRemaining)a.burstRestUntil=time+.22+(a.id%3)*.06;}
   const target=a.goal||{x:a.x,y:a.y,z:a.z},changed=!a.pathTarget||gap(target,a.pathTarget)>1.5;
   if(time>=a.repathAt||changed){a.path=world.path(a,target);a.pathTarget={...target};a.repathAt=time+.75+(a.id%4)*.1;}
   while(a.path.length&&(gap(a,a.path[0])<.22||(a.path.length>1&&world.canWalk(a,a.path[1],.56))))a.path.shift();
   const direct=world.canWalk(a,target,.56),waypoint=direct?target:a.path[0];let vx=0,vz=0;
   if(waypoint&&!a.holdUse){const dx=waypoint.x-a.x,dz=waypoint.z-a.z,len=Math.hypot(dx,dz),stop=direct?.35:.08;if(len>stop){const speed=a.aiMode==='engage'||a.aiMode==='peek'?2.0:4.3,pace=Math.min(speed,(len-stop)/dt);vx=dx/len*pace;vz=dz/len*pace;}}
   if(!a.holdUse)for(const other of actors){if(other===a||!other.alive||Math.abs(other.y-a.y)>1.7)continue;const dx=a.x-other.x,dz=a.z-other.z,d=Math.hypot(dx,dz);if(d>0&&d<1.15){vx+=dx/d*(1.15-d)*3;vz+=dz/d*(1.15-d)*3;}}
   a.vx=vx;a.vz=vz;const old={x:a.x,y:a.y,z:a.z};moveActor(a,dt,world);
   if(gap(a,old)<dt*.08&&Math.hypot(vx,vz)>.8){a.stuck+=dt;if(a.stuck>.65){a.repathAt=0;a.cover=null;a.pathTarget=null;const nudge=validPoint(a.x+(a.id%2?1:-1)*1.5,a.z+1.2,a);if(nudge)a.goal=nudge;a.decisionAt=time+.45;a.stuck=0;}}else a.stuck=0;
   for(const other of actors){if(other===a||!other.alive||Math.abs(other.y-a.y)>1.7)continue;const dx=a.x-other.x,dz=a.z-other.z,d=Math.hypot(dx,dz),minimum=a.radius+other.radius;if(d<minimum&&d>.001)sweepActor(a,dx/d*(minimum-d)*(other.isPlayer?1:.5),dz/d*(minimum-d)*(other.isPlayer?1:.5),world);}
   if(a.y< -8){a.hp=0;a.alive=false;continue;}
   if(hasSight){const target=a.aimTarget;a.yaw=Math.atan2(target.x-a.x,-(target.z-a.z));a.pitch=Math.atan2(target.y-(a.y+1.5),Math.max(.1,gap(a,target)));}else if(Math.hypot(a.vx,a.vz)>.1){a.yaw=Math.atan2(a.vx,-a.vz);a.pitch=0;}
   poseBean(a,time,true);a.gun.rotation.x=(a.pitch||0)-a.recoil*.1;
   if(a.holdUse)interactActor(a,true);
   // No firing and stationary body are required throughout the hold.
   const use=nearestInteraction(a);if(a.holdUse&&use&&['plant','defuse'].includes(use.type)){const moving=gap(a,old)>.006; // callback installed by game below
    if(typeof api.advanceInteraction==='function')api.advanceInteraction(a,true,moving,false,dt);
   }else a.interaction=null;
   if(state.phase==='round_end')break;
  }
 }
 const api={reset,update,reports,decide,advanceInteraction:null};return api;
}
