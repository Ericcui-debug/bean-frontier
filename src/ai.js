import {CHARACTER,stanceDimensions} from './dimensions.js';
import {poseBean} from './character.js';
import {moveActor,sweepActor} from './physics.js';
import {insideView,turnToward,aligned,actorEye,hearEvents} from './ai-perception.js';
import {createTeamTactics} from './ai-tactics.js';
// Visual knowledge expires in three seconds. Reports copy observations rather
// than holding live references to a hidden opponent's position.
export function createAI(g,world,actors,{state,combat,hostages,nearestInteraction,interactActor,soundEvents}){
 const reports=[new Map(),new Map()],gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),eye=a=>({x:a.x,y:a.y+stanceDimensions(a).sight,z:a.z});
 const tactics=createTeamTactics(actors,state,world,hostages);
 function reset(){tactics.reset();reports.forEach(m=>m.clear());actors.forEach(a=>Object.assign(a,{aiMode:'prepare',lastHeard:null,heardCursor:0,aimTarget:null,retakeFlankDone:false,yieldUntil:0,friendBlocked:0,passRoute:null,passUntil:0,decisionAt:0,path:[],pathTarget:null,repathAt:0,visibleTargetId:null,lastSeen:null,memoryUntil:0,reactionUntil:0,burstRemaining:0,burstRestUntil:0,routeIndex:0,routeKey:null,holdUse:false,stuck:0,cover:null,coverUntil:0,goal:null,aiSpread:.009+(a.id%3)*.003}));}
 function validPoint(x,z,a){const y=world.groundAt(x,z,a.y+.38),p={x,y,z};return y!==null&&world.canWalk(p,p,CHARACTER.navRadius)?p:null;}
 function seekCover(a,seen,time){
  let best=null;for(const s of world.solids){if(!s.active||s.shape==='ramp'||s.type==='floor'||s.type==='boundary'||s.y1<a.y+stanceDimensions(a).sight||s.y0>a.y+.2||s.x1-s.x0>8||s.z1-s.z0>10)continue;const cx=(s.x0+s.x1)/2,cz=(s.z0+s.z1)/2;if(Math.hypot(cx-a.x,cz-a.z)>8)continue;
   const xSide=Math.abs(seen.x-cx)>Math.abs(seen.z-cz),sign=xSide?(seen.x<cx?1:-1):(seen.z<cz?1:-1);
   const hide=xSide?validPoint(sign>0?s.x1+1.0:s.x0-1.0,cz,a):validPoint(cx,sign>0?s.z1+1.0:s.z0-1.0,a);if(!hide||!world.blocked(eye(hide),seen))continue;
   const peek=xSide?[validPoint(hide.x,s.z0-1.0,a),validPoint(hide.x,s.z1+1.0,a)]:[validPoint(s.x0-1.0,hide.z,a),validPoint(s.x1+1.0,hide.z,a)];
   const options=peek.filter(p=>p&&world.canWalk(hide,p,CHARACTER.navRadius)&&!world.blocked(eye(p),seen));if(!options.length)continue;const p=options.sort((x,y)=>gap(a,x)-gap(a,y))[0],score=gap(a,hide);if(!best||score<best.score)best={hide,peek:p,score,phase:'hide',until:time+.45+(a.id%3)*.12};
  }return best;
 }
 function observe(a,time){
  hearEvents(a,soundEvents?.recent?.(a.heardCursor||0)||[],time,world);
  let target=null,distance=Infinity;for(const other of actors){if(!other.alive||other.team===a.team)continue;const d=gap(a,other);if(d>43||d>=distance||!insideView(a,other)||world.blocked(eye(a),eye(other)))continue;target=other;distance=d;}
  if(target){if(a.visibleTargetId!==target.id)a.reactionUntil=time+.5+(a.id%3)*.04;a.visibleTargetId=target.id;
   const seen={id:target.id,x:target.x,groundY:target.y,y:target.y+stanceDimensions(target).aimHeight,z:target.z,vx:target.vx,vz:target.vz,at:time};a.lastSeen={...seen};a.memoryUntil=time+3;reports[a.team].set(target.id,{...seen});return seen;
  }
  a.visibleTargetId=null;if(a.lastSeen&&time>=a.memoryUntil)a.lastSeen=null;
  if(!a.lastSeen){let latest=null;for(const [id,report] of reports[a.team]){if(time-report.at>3){reports[a.team].delete(id);continue;}if(!latest||gap(a,report)<gap(a,latest))latest=report;}if(latest){a.lastSeen={...latest};a.memoryUntil=latest.at+3;a.reactionUntil=time+.55;}}
  return null;
 }
 function bombGoal(a,time){
  const b=state.bomb;a.holdUse=false;
  if(state.phase==='planted'){
   if(a.team!==state.attackTeam){const use=nearestInteraction(a);if(use?.type==='defuse'){a.holdUse=true;a.aiMode='defuse';return {x:a.x,y:a.y,z:a.z};}a.aiMode='retake';const positions=world.postPlantPositions?.[b.siteId]||[];if(a.teamDuty==='retake-flank'&&!a.retakeFlankDone&&positions.length&&gap(a,b)>9){const flank=positions[(a.formationIndex??a.id)%positions.length];if(gap(a,flank)>1.4)return {...flank};a.retakeFlankDone=true;}return {x:b.x,y:b.y,z:b.z};}
   const site=world.sites.find(s=>s.id===b.siteId),positions=world.postPlantPositions?.[site.id]||[site];a.aiMode='guard';return {...positions[(a.formationIndex??a.id)%positions.length]};
  }
  if(a.team===state.attackTeam){
   if(b.carrierId===null){a.aiMode='recover';if(gap(a,b)<2.2){interactActor(a);if(b.carrierId===a.id)return bombGoal(a,time);}return {x:b.x,y:b.y,z:b.z};}
   const site=world.sites.find(s=>s.id===(a.team===actors[0].team?state.tactic:state.enemyTactic||'A')),isCarrier=b.carrierId===a.id,use=nearestInteraction(a);
   if(isCarrier&&use?.type==='plant'){a.holdUse=true;a.aiMode='plant';return {x:a.x,y:a.y,z:a.z};}
   const variants=world.routeVariants?.[site.id]||[world.routes[site.id]],variant=isCarrier?0:(a.routeVariant??a.id%variants.length),route=variants[variant%variants.length];
   const routeKey=site.id+':'+variant;if(a.routeKey!==routeKey){a.routeIndex=0;a.routeKey=routeKey;}
   while(a.routeIndex<route.length-1&&gap(a,route[a.routeIndex])<1.4&&Math.abs(a.y-route[a.routeIndex].y)<.4)a.routeIndex++;
   a.aiMode=isCarrier?'carry':'push';return {...route[a.routeIndex]};
  }
  a.aiMode='hold';const tactic=a.team===actors[0].team?state.tactic:'balanced',positions=world.defenseByTactic?.[tactic]||world.defensePositions;return {...positions[(a.formationIndex??a.id)%positions.length]};
 }
 function rescueGoal(a,time){
  a.holdUse=false;
  if(a.team!==state.ctTeam){a.aiMode='guard';const tactic=a.team===actors[0].team?state.tactic:'balanced',positions=world.defenseByTactic?.[tactic]||world.defensePositions;return {...positions[(a.formationIndex??a.id)%positions.length]};}
  const followers=hostages.list.filter(h=>h.leaderId===a.id&&h.state==='following');
  if(followers.length){const zone=[...(world.rescueZones||[])].sort((x,y)=>gap(a,x)-gap(a,y))[0];a.aiMode='escort';return {...zone};}
  if(a.teamDuty==='escort-cover'&&a.supportId!==null){const leader=actors.find(v=>v.id===a.supportId&&v.alive&&v.team===a.team);if(leader){const side=(a.id%2?1:-1)*2.2;a.aiMode='escort-cover';return validPoint(leader.x+Math.cos(leader.yaw)*side,leader.z+Math.sin(leader.yaw)*side,a)||{x:leader.x,y:leader.y,z:leader.z};}}
  const available=hostages.list.filter(h=>h.state==='waiting');if(!available.length){a.aiMode='support';return {...(world.rescueZones?.[a.id%(world.rescueZones?.length||1)]||world.spawns.attack[a.id%5])};}
  const nearby=nearestInteraction(a);if(nearby?.type==='hostage'){interactActor(a);return rescueGoal(a,time);}
  const target=available.find(h=>h.id===a.hostageAssignment)||available.sort((x,y)=>gap(a,x)-gap(a,y))[0],primary=a.team===actors[0].team?state.tactic:state.enemyTactic||'A',tactic=a.teamDuty==='flank'?(primary==='A'?'B':primary==='B'?'A':'B'):a.teamDuty==='cover'?(primary==='C'?'A':'C'):primary,variants=world.routeVariants?.[tactic]||[world.routes?.[tactic]||world.routes?.A||[]],variant=a.id%variants.length,key=tactic+':'+variant+':rescue',route=variants[variant];
  if(a.routeKey!==key){a.routeKey=key;a.routeIndex=0;}
  while(a.routeIndex<route.length&&gap(a,route[a.routeIndex])<1.5&&Math.abs(a.y-route[a.routeIndex].y)<.4)a.routeIndex++;
  a.aiMode='rescue';return {...(route[a.routeIndex]||target)};
 }
 function decide(a,time){
  tactics.update(time);
  const seen=observe(a,time);a.visible=!!seen;a.goal=world.mode==='rescue'?rescueGoal(a,time):bombGoal(a,time);
  if(seen){
   const d=gap(a,seen);a.aimTarget={x:seen.x+seen.vx*.045,y:seen.y+(a.id%4===0?.256:0),z:seen.z+seen.vz*.045};
   // Urgent late defuses continue under fire; otherwise fight before interaction.
   if(a.holdUse&&d<12&&!(state.phase==='planted'&&a.team!==state.attackTeam&&state.bomb.explodesAt-time<7))a.holdUse=false;
   if(a.holdUse)return;
   if(time>=a.coverUntil){a.cover=seekCover(a,seen,time);a.coverUntil=time+3.5;}
   if(a.cover){if(time>=a.cover.until){a.cover.phase=a.cover.phase==='hide'?'peek':'hide';a.cover.until=time+(a.cover.phase==='hide'?.55:1.0);}a.goal=a.cover.phase==='hide'?a.cover.hide:a.cover.peek;a.aiMode=a.cover.phase;}
   else if(d<6){const dx=a.x-seen.x,dz=a.z-seen.z;a.goal=validPoint(a.x+dx/d*2,a.z+dz/d*2,a)||{x:a.x,y:a.y,z:a.z};a.aiMode='retreat';}
   else if(d<27){const hit=combat.actorHit?.(eye(a),a.aimTarget,a);if(hit?.actor.team===a.team){const dx=seen.x-a.x,dz=seen.z-a.z;a.goal=validPoint(a.x+(a.id%2?1:-1)*(-dz/d)*1.8,a.z+(a.id%2?1:-1)*(dx/d)*1.8,a)||a.goal;a.aiMode='flank';}else if(state.bomb?.carrierId!==a.id||d<13){a.goal={x:a.x,y:a.y,z:a.z};a.aiMode='engage';}}
  }else if(a.lastSeen&&!a.holdUse&&state.bomb?.carrierId!==a.id&&(a.team===state.attackTeam?a.teamDuty!=='objective':['reserve','retake-cover','retake-flank'].includes(a.teamDuty))){a.aiMode='search';a.goal={x:a.lastSeen.x,y:a.lastSeen.groundY??a.lastSeen.y-CHARACTER.aimHeight,z:a.lastSeen.z};a.cover=null;}
  else if(a.lastHeard&&!a.holdUse&&a.teamDuty!=='objective'&&a.teamDuty!=='escort-cover'){a.aiMode='investigate';a.goal={x:a.lastHeard.x,y:a.lastHeard.y,z:a.lastHeard.z};a.cover=null;}
  else a.cover=null;
  if(a.reloadUntil>time&&seen){a.cover=seekCover(a,seen,time)||a.cover;if(a.cover){a.goal=a.cover.hide;a.aiMode='reload-cover';}}
  const o=nearestInteraction(a);if(o?.type==='door'&&!o.open)interactActor(a);if(o?.type==='weapon'&&(!a.equipment[1]||o.equipment.id>a.equipment[1].id))interactActor(a);
 }
 function update(dt,time,c){
  if(!['active','planted'].includes(state.phase))return;
  for(const a of actors){if(a.isPlayer||!a.alive)continue;
   if(time>=a.decisionAt){decide(a,time);a.decisionAt=time+.18+(a.id%4)*.025;}
   const visibleActor=actors.find(v=>v.id===a.visibleTargetId&&v.alive),hasSight=visibleActor&&insideView(a,visibleActor)&&!world.blocked(eye(a),eye(visibleActor));
   const facingTarget=hasSight||a.aiMode==='clear-grille'?a.aimTarget:a.lastSeen?{x:a.lastSeen.x,y:a.lastSeen.y,z:a.lastSeen.z}:a.lastHeard?{x:a.lastHeard.x,y:a.lastHeard.y+stanceDimensions(a).sight,z:a.lastHeard.z}:a.path[0]?{...a.path[0],y:a.path[0].y+stanceDimensions(a).sight}:a.goal?{...a.goal,y:a.goal.y+stanceDimensions(a).sight}:null;
   turnToward(a,facingTarget,dt);a.gunPitch=-(a.pitch||0);
   const equipped=a.equipment[a.slot]||a.equipment[0];if(equipped?.ammo===0){if(equipped.reserve>0)c.reload(a);else if(a.slot===1)c.select(a,0);}
   const friendlyBlock=hasSight&&combat.actorHit?.(eye(a),a.aimTarget,a)?.actor?.team===a.team;
   const firing=hasSight&&aligned(a,a.aimTarget)&&!friendlyBlock&&!a.holdUse&&time>=a.reactionUntil&&a.cover?.phase!=='hide'&&time>=a.burstRestUntil;
   if(firing&&c.fire(a)){if(!a.burstRemaining)a.burstRemaining=2+(a.id%3);a.burstRemaining--;if(!a.burstRemaining)a.burstRestUntil=time+.22+(a.id%3)*.06;}
   if(a.passRoute&&time>a.passUntil){a.passRoute=null;a.pathTarget=null;a.repathAt=0;}
   const target=a.passRoute?.[0]||a.goal||{x:a.x,y:a.y,z:a.z},changed=!a.pathTarget||(gap(target,a.pathTarget)>1.5||Math.abs(target.y-a.pathTarget.y)>.38);
   if(!a.ladderId&&(time>=a.repathAt||changed)){a.path=world.path(a,target,{profile:'soldier'});a.pathTarget={...target};a.repathAt=time+.75+(a.id%4)*.1;}
   while(a.path.length&&((gap(a,a.path[0])<.22&&Math.abs(a.y-a.path[0].y)<.38&&!(a.path[0].action==='grille'&&a.path[0].solid?.active))||(a.path.length>1&&!['ladder','low','door','grille'].includes(a.path[0].action||a.path[0].kind)&&world.canWalk(a,a.path[1],CHARACTER.navRadius))))a.path.shift();
   const direct=!a.ladderId&&world.canWalk(a,target,CHARACTER.navRadius),waypoint=direct?target:a.path[0];let vx=0,vz=0;
   if(waypoint?.action==='grille'&&waypoint.solid?.active&&gap(a,waypoint)<2.2&&!hasSight){const s=waypoint.solid;a.aimTarget={x:(s.x0+s.x1)/2,y:(s.y0+s.y1)/2,z:(s.z0+s.z1)/2};a.gunPitch=-(a.pitch||0);a.aiMode='clear-grille';if(aligned(a,a.aimTarget))c.fire(a);}

   if(waypoint&&!a.holdUse&&!(waypoint.action==='grille'&&waypoint.solid?.active&&gap(a,waypoint)<.7)){const dx=waypoint.x-a.x,dz=waypoint.z-a.z,len=Math.hypot(dx,dz),stop=direct?(a.passRoute?.length?.005:.35):.08;if(len>stop){const speed=['low','crouch'].includes(a.stance)?2.1:a.aiMode==='engage'||a.aiMode==='peek'?2.0:4.3,pace=Math.min(speed,(len-stop)/dt);vx=dx/len*pace;vz=dz/len*pace;}}
   if(!a.holdUse)for(const other of actors){if(other===a||!other.alive||Math.abs(other.y-a.y)>=CHARACTER.height)continue;const dx=a.x-other.x,dz=a.z-other.z,d=Math.hypot(dx,dz);if(d>0&&d<CHARACTER.radius*2+.2){vx+=dx/d*(CHARACTER.radius*2+.2-d)*3;vz+=dz/d*(CHARACTER.radius*2+.2-d)*3;}}
   // Yield at narrow crossings instead of repeatedly pushing the same teammate.
   const ahead=actors.find(o=>o!==a&&o.alive&&o.team===a.team&&o.id<a.id&&Math.abs(o.y-a.y)<.8&&gap(a,o)<1.25&&((o.x-a.x)*vx+(o.z-a.z)*vz)>.1);
   if(ahead&&!a.holdUse&&!a.passRoute){a.friendBlocked=(a.friendBlocked||0)+dt;const intent=Math.max(.01,Math.hypot(vx,vz)),forward={x:vx/intent,z:vz/intent};vx*=.15;vz*=.15;if(a.friendBlocked>.5){
    for(const offset of [.86,-.86,.65,-.65,1.3,-1.3]){const side=validPoint(a.x-forward.z*offset,a.z+forward.x*offset,a);if(!side||!world.canWalk(a,side,CHARACTER.navRadius))continue;const past=validPoint(side.x+forward.x*2.3,side.z+forward.z*2.3,a);if(!past||!world.canWalk(side,past,CHARACTER.navRadius))continue;const dx=past.x-side.x,dz=past.z-side.z,t=Math.max(0,Math.min(1,((ahead.x-side.x)*dx+(ahead.z-side.z)*dz)/(dx*dx+dz*dz))),clearance=Math.hypot(side.x+dx*t-ahead.x,side.z+dz*t-ahead.z);if(clearance<CHARACTER.radius+ahead.radius+.005)continue;a.passRoute=[side,past];a.passUntil=time+3.5;a.pathTarget=null;a.repathAt=0;a.aiMode='yield';break;}
    a.friendBlocked=0;
   }}else a.friendBlocked=0;
   a.vx=vx;a.vz=vz;a.traverseWaypoint=waypoint;a.traverseForward=(waypoint?.action==='ladder'||waypoint?.kind==='ladder')?Math.sign((waypoint.targetY??waypoint.y)-a.y):Math.hypot(vx,vz);a.traverseJump=false;const old={x:a.x,y:a.y,z:a.z};moveActor(a,dt,world);
   if(a.passRoute?.length&&gap(a,a.passRoute[0])<.018&&Math.abs(a.y-a.passRoute[0].y)<.1){a.passRoute.shift();if(!a.passRoute.length)a.passRoute=null;a.pathTarget=null;a.repathAt=0;}
   if(gap(a,old)<dt*.08&&Math.hypot(vx,vz)>.15){a.stuck+=dt;if(a.stuck>.65){a.repathAt=0;a.cover=null;a.pathTarget=null;const nudge=validPoint(a.x+(a.id%2?1:-1)*1.5,a.z+1.2,a);if(nudge)a.goal=nudge;a.decisionAt=time+.45;a.stuck=0;}}else a.stuck=0;
   for(const other of actors){if(other===a||!other.alive||Math.abs(other.y-a.y)>=CHARACTER.height)continue;const dx=a.x-other.x,dz=a.z-other.z,d=Math.hypot(dx,dz),minimum=a.radius+other.radius;if(d<minimum&&d>.001)sweepActor(a,dx/d*(minimum-d)*(other.isPlayer?1:.5),dz/d*(minimum-d)*(other.isPlayer?1:.5),world);}
   if(a.y< -8){a.hp=0;a.alive=false;continue;}
   // Facing follows the limited turn pass; movement never snaps it around.
   a.gunPitch=-(a.pitch||0);poseBean(a,time,true);
   if(a.holdUse)interactActor(a,true);
   // No firing and stationary body are required throughout the hold.
   const use=nearestInteraction(a);if(a.holdUse&&use&&['plant','defuse'].includes(use.type)){const moving=gap(a,old)>.006; // callback installed by game below
    if(typeof api.advanceInteraction==='function')api.advanceInteraction(a,true,moving,false,dt);
   }else a.interaction=null;
   if(state.phase==='round_end')break;
  }
 }
 const api={reset,update,reports,decide,tactics,advanceInteraction:null};return api;
}
