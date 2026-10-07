import {C} from './gfx.js';
import {createBean,poseBean,disposeBean} from './character.js';
import {moveActor,sweepActor} from './physics.js';

export function createAI(g,world,player,enemies){
 let serial=0;
 const memorySeconds=3,leash=31;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 const eye=p=>({x:p.x,y:p.y+1.2,z:p.z});
 function spawn(x,z,camp=null,type='shooter',challenge=false){
  const r=createBean(g,type==='shooter'?C.blue:C.orange),y=world.groundAt(x,z)||0;
  Object.assign(r,{id:serial++,x,z,y,home:{x,z,y},camp,type,challenge,hp:type==='shooter'?54:45,maxHp:type==='shooter'?54:45,cooldown:0,alert:0,lastSeen:null,memoryUntil:0,reaction:0,visibleLast:false,path:[],repath:0,patrolPhase:serial*1.7,kx:0,kz:0,stuck:0,tacticUntil:0,cover:null,coverPhase:null,healthUntil:0});
  r.gun.visible=type==='shooter';poseBean(r,0,type==='shooter');enemies.push(r);return r;
 }
 function populate(){for(const r of enemies)disposeBean(r);enemies.length=0;serial=0;for(const c of world.camps)for(const [i,ox,oz] of [[0,-3,0],[1,3,-2],[2,0,4],[3,-2,-4]])spawn(c.x+ox,c.z+oz,c.id,i===2?'charger':'shooter');}
 function clearMemory(r){r.lastSeen=null;r.memoryUntil=0;r.alert=0;r.reaction=0;r.cover=null;r.coverPhase=null;r.tacticUntil=0;}
 function point(r,x,z){
  const y=world.groundAt(x,z,r.y+.38);
  if(y===null||Math.abs(y-r.y)>.38||distance({x,z},r.home)>leash)return null;
  // canWalk from the point to itself checks body clearance at this support height.
  const p={x,y,z};return world.canWalk(p,p,.59)?p:null;
 }
 function chooseCover(r,target){
  const options=[];
  for(const s of world.solids){
   if(!s.active||s.shape==='ramp'||s.y0>r.y+.2||s.y1<r.y+1.2||s.y1>r.y+12)continue;
   const cx=(s.x0+s.x1)/2,cz=(s.z0+s.z1)/2;
   if(Math.hypot(cx-r.x,cz-r.z)>11||s.x1-s.x0>13||s.z1-s.z0>13)continue;
   const dx=target.x-cx,dz=target.z-cz;
   let hide,ends;
   if(Math.abs(dx)>Math.abs(dz)){
    const x=dx<0?s.x1+1.35:s.x0-1.35;
    hide=point(r,x,cz);ends=[point(r,x,s.z0-1.35),point(r,x,s.z1+1.35)];
   }else{
    const z=dz<0?s.z1+1.35:s.z0-1.35;
    hide=point(r,cx,z);ends=[point(r,s.x0-1.35,z),point(r,s.x1+1.35,z)];
   }
   if(!hide||!world.blocked(eye(hide),eye(target)))continue;
   const peeks=ends.filter(p=>p&&!world.blocked(eye(p),eye(target))&&world.canWalk(hide,p,.59));
   if(!peeks.length)continue;
   const peek=peeks.sort((a,b)=>distance(r,a)-distance(r,b))[r.id%peeks.length];
   // Reject inaccessible scenery; only a few nearby candidates require A*.
   if(!world.canWalk(r,hide,.59)){const route=world.path(r,hide);if(!route.length||!world.canWalk(route[route.length-1],hide,.59))continue;}
   const gap=distance(peek,target);if(gap<6||gap>20)continue;
   options.push({hide,peek,score:distance(r,hide)+Math.abs(gap-12)*.25});
  }
  return options.sort((a,b)=>a.score-b.score)[0]||null;
 }
 function flank(r,target,range){
  const dx=r.x-target.x,dz=r.z-target.z,angle=Math.atan2(dz,dx)+(r.id%2?1:-1)*.32;
  for(const a of [angle,angle+.3,angle-.3]){const p=point(r,target.x+Math.cos(a)*range,target.z+Math.sin(a)*range);if(p)return p;}
  return {x:r.x,y:r.y,z:r.z};
 }
 function shooterTarget(r,target,visible,time){
  const gap=distance(r,target);
  if(gap<6){r.cover=null;r.coverPhase=null;r.aiMode='retreat';return flank(r,target,9);}
  if(r.cover){
   if(distance(r,r.cover.hide)<.8&&r.coverPhase==='seek'){r.coverPhase='hide';r.phaseUntil=time+.7+(r.id%3)*.16;}
   if(r.coverPhase==='hide'&&time>=r.phaseUntil){r.coverPhase='peek';r.phaseUntil=time+1.45;}
   if(r.coverPhase==='peek'&&time>=r.phaseUntil){r.coverPhase='hide';r.phaseUntil=time+.7+(r.id%3)*.16;}
   // A demolished crate or a changed approach must not leave an actor camping empty space.
   if(!world.blocked(eye(r.cover.hide),eye(target))||gap>23){r.cover=null;r.coverPhase=null;r.tacticUntil=0;}
   else{r.aiMode=r.coverPhase==='peek'?'peek':'cover';return r.coverPhase==='peek'?r.cover.peek:r.cover.hide;}
  }
  if(visible&&gap<=20&&time>=r.tacticUntil){
   r.tacticUntil=time+3.5+(r.id%3)*.4;
   r.cover=chooseCover(r,target);
   if(r.cover){r.coverPhase='seek';r.aiMode='cover';return r.cover.hide;}
  }
  r.aiMode=gap>20?'advance':'flank';return flank(r,target,gap>20?15:Math.min(15,Math.max(9,gap)));
 }
 function update(dt,time,combat){
  for(const r of enemies){
   if(!r.alive)continue;
   r.cooldown-=dt;r.repath-=dt;r.reaction=Math.max(0,r.reaction-dt);
   const gap=distance(r,player),protectedPlayer=!player.alive||(player.invuln||0)>0;
   const visible=!protectedPlayer&&gap<25&&distance(player,r.home)<leash&&distance(r,r.home)<leash&&!world.blocked(eye(r),eye(player));
   if(protectedPlayer)clearMemory(r);
   if(visible){
    if(!r.lastSeen){r.reaction=.48+(r.id%3)*.025;r.tacticUntil=time+.55;}
    const vx=Number.isFinite(player.vx)?player.vx:0,vz=Number.isFinite(player.vz)?player.vz:0,speed=Math.hypot(vx,vz),scale=speed>9?9/speed:1;
    r.lastSeen={x:player.x,y:player.y,z:player.z,vx:vx*scale,vz:vz*scale,time};r.memoryUntil=time+memorySeconds;
   }else if(r.lastSeen&&time>=r.memoryUntil)clearMemory(r);
   r.alert=r.lastSeen?Math.max(0,r.memoryUntil-time):0;r.visibleLast=visible;
   let target;
   if(r.lastSeen){
    // Hidden players never refresh the search destination or observed velocity.
    const seen=r.lastSeen;
    if(!visible){if(r.type==='shooter'&&r.cover)target=shooterTarget(r,seen,false,time);else{r.aiMode='search';target={x:seen.x,y:seen.y,z:seen.z};}}
    else if(r.type==='shooter')target=shooterTarget(r,seen,true,time);
    else{
     r.aiMode='charge';
     // Separate approach lanes converge near the player, rather than zigzagging every frame.
     const lane=gap>4?(r.id%2?1:-1)*Math.min(3,gap*.2):0,ux=(seen.x-r.x)/Math.max(.01,gap),uz=(seen.z-r.z)/Math.max(.01,gap);
     target=point(r,seen.x-uz*lane,seen.z+ux*lane)||seen;
     if(gap<1.55&&Math.abs(seen.y-r.y)<1.4&&r.reaction<=0&&r.cooldown<=0){combat.hurt(player,12,eye(r));r.cooldown=1;r.recoil=1;r.aiMode='attack';target={x:r.x,y:r.y,z:r.z};}
    }
    if(r.type==='shooter'&&visible&&gap<=20&&r.reaction<=0&&r.cooldown<=0&&r.coverPhase!=='hide'&&r.coverPhase!=='seek'){
     r.yaw=Math.atan2(seen.x-r.x,-(seen.z-r.z));poseBean(r,time,true);
     if(combat.enemyFire(r,seen)){r.cooldown=.85+(r.id%6)*.05;r.recoil=1;}else r.cooldown=.16;
    }
   }else{
    r.aiMode=distance(r,r.home)>7?'return':'patrol';
    target=point(r,r.home.x+Math.sin(Math.floor(time/7)+r.patrolPhase)*3,r.home.z+Math.cos(Math.floor(time/7)+r.patrolPhase)*3)||r.home;
   }
   r.target={x:target.x,y:target.y??r.y,z:target.z};
   const targetChanged=!r.pathTarget||distance(target,r.pathTarget)>2;
   if(r.repath<=0||targetChanged){
    if(targetChanged)r.routeEnd=null;
    r.path=world.path(r,target);if(r.path.length)r.routeEnd=r.path[r.path.length-1];
    r.pathTarget={...target};r.repath=.65+r.id%4*.1;
   }
   while(r.path.length&&(distance(r.path[0],r)<.12||(r.path.length>1&&world.canWalk(r,r.path[1],.57))))r.path.shift();
   const direct=world.canWalk(r,{...target,y:target.y??world.groundAt(target.x,target.z,r.y+.38)},.57);
   // A* can report an empty route inside its last cell; finish reaching that cell before the exact cover point.
   const end=r.routeEnd&&distance(r,r.routeEnd)>.01&&world.canWalk(r,r.routeEnd,.57)?r.routeEnd:null;
   const waypoint=direct?target:(r.path[0]||end);let vx=0,vz=0;
   if(waypoint){const dx=waypoint.x-r.x,dz=waypoint.z-r.z,len=Math.hypot(dx,dz),speed=r.type==='charger'?4.1:2.9;if(len>(direct?.35:.005)){const pace=Math.min(speed,len/dt);vx=dx/len*pace;vz=dz/len*pace;}}
   for(const other of enemies){if(other===r||!other.alive||Math.abs(other.y-r.y)>1.7)continue;const dx=r.x-other.x,dz=r.z-other.z,d=Math.hypot(dx,dz);if(d<1.15&&d>.001){vx+=dx/d*(1.15-d)*3;vz+=dz/d*(1.15-d)*3;}}
   r.kx*=Math.exp(-dt*9);r.kz*=Math.exp(-dt*9);r.vx=vx+r.kx;r.vz=vz+r.kz;
   const old={x:r.x,z:r.z};moveActor(r,dt,world);
   if(distance(r,old)<dt*.1&&Math.hypot(vx,vz)>.5){r.stuck+=dt;if(r.stuck>.55){r.repath=0;r.path=[];r.cover=null;r.coverPhase=null;r.tacticUntil=time+.7;r.stuck=0;}}else r.stuck=0;
   if(r.y< -8){r.x=r.home.x;r.z=r.home.z;r.y=r.home.y;r.vy=0;r.grounded=true;clearMemory(r);}
   if(player.alive&&Math.abs(player.y-r.y)<1.7){const sx=r.x-player.x,sz=r.z-player.z,d=Math.hypot(sx,sz),minimum=r.radius+player.radius;if(d<minimum){const ux=d>.001?sx/d:1,uz=d>.001?sz/d:0;sweepActor(r,ux*(minimum-d+.001),uz*(minimum-d+.001),world);}}
   const dx=visible?player.x-r.x:r.vx,dz=visible?player.z-r.z:r.vz;if(Math.hypot(dx,dz)>.01)r.yaw=Math.atan2(dx,-dz);
   r.recoil=Math.max(0,r.recoil-dt*7);poseBean(r,time,r.type==='shooter');
   if(visible&&r.type==='shooter')r.gun.rotation.x=Math.atan2(r.lastSeen.y+1.05-(r.y+1.12),Math.max(.1,gap))-r.recoil*.1;
  }
 }
 function removeChallenge(){for(let i=enemies.length-1;i>=0;i--)if(enemies[i].challenge){disposeBean(enemies[i]);enemies.splice(i,1);}}
 return {spawn,populate,update,removeChallenge};
}
