import {CHARACTER,stanceDimensions} from './dimensions.js';
import {C} from './gfx.js';
import {createBean,poseBean,disposeBean} from './character.js';
import {moveActor} from './physics.js';
// Hostages are private scene objects, never combat actors: they neither take
// damage nor block hitscan. Their knowledge is their leader, not enemy state.
export function createHostages(g,world,actors,{state,notify}){
 const list=[];const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 function reset(){for(const h of list)disposeBean(h);list.length=0;if(world.mode!=='rescue')return;
  for(const [i,p] of (world.hostagePositions||world.hostageSpawns||[]).entries()){
   const h=Object.assign(createBean(g,[C.cream,C.yellow,C.mint,C.orange][i%4]),p,{id:i,name:'人质 '+(i+1),state:'waiting',isHostage:true,faction:'civilian',leaderId:null,alive:true,hp:100,radius:CHARACTER.radius*.85,height:CHARACTER.height,eye:CHARACTER.eye,navigationProfile:'hostage',vx:0,vy:0,vz:0,grounded:true,yaw:0,path:[],repathAt:0,stuck:0,goal:null});h.gun.visible=false;h.healthBar?.setVisible?.(false);poseBean(h,state.time,true);list.push(h);
  }
 }
 function nearest(a){if(world.mode!=='rescue'||a.team!==state.ctTeam||!a.alive)return null;let best=null,d=2.3;for(const h of list){if(h.state==='rescued'||h.leaderId!==null&&h.leaderId!==a.id)continue;const gap=distance(a,h);if(gap<d&&Math.abs(a.y-h.y)<.75&&!world.blocked({x:a.x,y:a.y+CHARACTER.sight,z:a.z},{x:h.x,y:h.y+CHARACTER.sight,z:h.z})){best=h;d=gap;}}return best?{type:'hostage',id:best.id,name:best.leaderId===a.id?'停止跟随':'带领人质',x:best.x,y:best.y,z:best.z}:null;}
 function interact(a,id){const o=nearest(a);if(!o||o.id!==id)return false;const h=list.find(h=>h.id===id);if(h.leaderId===a.id){h.leaderId=null;h.state='waiting';}else{h.leaderId=a.id;h.state='following';}h.path=[];h.repathAt=0;notify(h.state==='following'?'人质正在跟随 · 护送至室外救援区':'人质停止跟随');return true;}
 function releaseLeader(id){for(const h of list)if(h.leaderId===id&&h.state!=='rescued'){h.leaderId=null;h.state='waiting';h.path=[];h.vx=h.vz=0;}}
 function update(dt,time){if(world.mode!=='rescue'||state.phase!=='active')return;
  for(const h of list){if(h.state==='rescued')continue;const leader=actors.find(a=>a.id===h.leaderId&&a.alive&&a.team===state.ctTeam);if(!leader){if(h.leaderId!==null)releaseLeader(h.leaderId);h.vx=h.vz=0;continue;}
   const siblings=list.filter(v=>v.leaderId===leader.id&&v.state==='following'),index=siblings.indexOf(h),offset=.9+Math.floor(index/2)*.7,side=(index%2?1:-1)*.65;
   let goal={x:leader.x-Math.sin(leader.yaw)*offset+Math.cos(leader.yaw)*side,y:leader.y,z:leader.z+Math.cos(leader.yaw)*offset+Math.sin(leader.yaw)*side};
   // Follow the last safe leader position when the leader enters a duct/ladder.
   if((leader.ladderId||['low','crouch','ladder'].includes(leader.stance))||!world.canWalk(goal,goal,h.radius,{profile:'hostage'})){goal=h.goal||{x:h.x,y:h.y,z:h.z};}else h.goal={...goal};
   if(time>=h.repathAt){h.path=world.path(h,goal,{profile:'hostage'});if(h.path.some(p=>['ladder','low'].includes(p.action||p.kind)))h.path=[];h.repathAt=time+.55+h.id*.04;}
   while(h.path.length&&distance(h,h.path[0])<.18&&Math.abs(h.y-h.path[0].y)<.35)h.path.shift();const direct=world.canWalk(h,goal,h.radius,{profile:'hostage'}),p=direct?goal:h.path[0];h.vx=h.vz=0;
   if(p){const dx=p.x-h.x,dz=p.z-h.z,d=Math.hypot(dx,dz);if(d>.5||!direct){const pace=Math.min(3.9,Math.max(0,d-(direct?.5:.08))/dt);h.vx=dx/d*pace;h.vz=dz/d*pace;}}
   // Separate the trailing queue without pushing it through solid geometry.
   for(const other of siblings){if(other===h||Math.abs(other.y-h.y)>.8)continue;const dx=h.x-other.x,dz=h.z-other.z,d=Math.hypot(dx,dz);if(d>.01&&d<h.radius*2+.12){h.vx+=dx/d*(h.radius*2+.12-d)*2;h.vz+=dz/d*(h.radius*2+.12-d)*2;}}
   const before={x:h.x,z:h.z};h.traverseWaypoint=null;moveActor(h,dt,world);if(distance(before,h)<dt*.05&&Math.hypot(h.vx,h.vz)>.5){h.stuck+=dt;if(h.stuck>.6){h.path=[];h.repathAt=0;h.stuck=0;}}else h.stuck=0;
   if(Math.hypot(h.vx,h.vz)>.05)h.yaw=Math.atan2(h.vx,-h.vz);poseBean(h,time,true);h.gun.visible=false;
   const zone=(world.rescueZones||[]).find(z=>distance(h,z)<=z.radius&&Math.abs(h.y-(z.y||0))<.8);if(zone){h.state='rescued';h.leaderId=null;h.vx=h.vz=0;h.group.visible=false;leader.money=Math.min(8000,leader.money+300);notify('人质已救出 · '+rescuedCount()+' / 2');}
  }
 }
 function rescuedCount(){return list.filter(h=>h.state==='rescued').length;}
 function snapshot(viewer=null){return list.map(({id,x,y,z,state:status,leaderId})=>{if(viewer&&viewer.team!==state.ctTeam&&(status==='rescued'||world.blocked({x:viewer.x,y:viewer.y+1.2,z:viewer.z},{x,y:y+1,z})))return {id,state:status};return {id,x,y,z,state:status,leaderId};});}
 return {list,reset,nearest,interact,releaseLeader,update,rescuedCount,snapshot};
}
