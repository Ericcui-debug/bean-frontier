import {stanceDimensions} from './dimensions.js';

export const PERCEPTION={fov:110*Math.PI/180,range:43,turnRate:Math.PI,reactionMin:.5,reactionMax:.62,memory:3};
export const angleDelta=(target,current)=>Math.atan2(Math.sin(target-current),Math.cos(target-current));
export const actorEye=a=>({x:a.x,y:a.y+stanceDimensions(a).sight,z:a.z});
export function insideView(a,b){
 const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
 return d<=PERCEPTION.range&&(d<.001||Math.abs(angleDelta(Math.atan2(dx,-dz),a.yaw||0))<=PERCEPTION.fov/2);
}
export function turnToward(a,target,dt){
 if(!target)return;
 const dx=target.x-a.x,dz=target.z-a.z,desired=Math.atan2(dx,-dz),limit=PERCEPTION.turnRate*dt;
 a.yaw=(a.yaw||0)+Math.max(-limit,Math.min(limit,angleDelta(desired,a.yaw||0)));
 const pitch=Math.atan2(target.y-actorEye(a).y,Math.max(.01,Math.hypot(dx,dz)));
 a.pitch=(a.pitch||0)+Math.max(-limit,Math.min(limit,pitch-(a.pitch||0)));
}
export function aligned(a,target,tolerance=.105){
 if(!target)return false;
 const dx=target.x-a.x,dz=target.z-a.z,pitch=Math.atan2(target.y-actorEye(a).y,Math.max(.01,Math.hypot(dx,dz)));
 return Math.abs(angleDelta(Math.atan2(dx,-dz),a.yaw||0))<=tolerance&&Math.abs(pitch-(a.pitch||0))<=tolerance;
}

// Hearing is an immutable historical location, with no actor reference or id
// usable for querying a hidden enemy's later position.
export function hearEvents(a,events,time,world){
 let best=null;
 for(const event of events){
  if(event.id<=(a.heardCursor||0))continue;
  a.heardCursor=Math.max(a.heardCursor||0,event.id);
  if(event.team===a.team||event.actorId===a.id||time-event.at>2||event.at>time)continue;
  const distance=Math.hypot(event.x-a.x,event.z-a.z),blocked=!!world.blocked(actorEye(a),{x:event.x,y:event.y+.8,z:event.z});
  if(distance>(event.radius??20)*(blocked?.5:1))continue;
  const uncertainty=blocked?2.4:.35,hash=((event.id*13+a.id*7)%17)/17*Math.PI*2;
  const heard={x:event.x+Math.cos(hash)*uncertainty,y:event.groundY??world.groundAt?.(event.x,event.z,event.y+.1)??event.y,z:event.z+Math.sin(hash)*uncertainty,at:event.at,expiresAt:event.at+2,uncertainty,type:event.type};
  if(!best||heard.at>best.at)best=heard;
 }
 if(best)a.lastHeard=best;
 if(a.lastHeard&&time>=a.lastHeard.expiresAt)a.lastHeard=null;
 return a.lastHeard;
}
