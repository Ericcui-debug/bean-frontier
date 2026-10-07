import {THREE} from './gfx.js';
import {clamp} from './physics.js';
export function createCamera(g,world,player){
 const state={yaw:0,pitch:-.18,aim:false,distance:5.7,avatarOpacity:1};let initialized=false;
 const cameraBlocked=(a,b)=>world.cameraBlocked?world.cameraBlocked(a,b,.28):world.blocked(a,b,.28);
 function clearRay(origin,position){const hit=cameraBlocked(origin,position);if(hit){const length=origin.distanceTo(position);position.lerpVectors(origin,position,Math.max(0,hit.t-.04/Math.max(.04,length)));}return position;}
 function opacity(target,dt,snap){state.avatarOpacity+=(target-state.avatarOpacity)*(snap?1:1-Math.exp(-dt*(target<state.avatarOpacity?22:7)));player.avatarOpacity=state.avatarOpacity;}
 function look(dx,dy){state.yaw+=dx;state.pitch=clamp(state.pitch+dy,-.95,.68);}
 function direction(){return new THREE.Vector3(Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),-Math.cos(state.yaw)*Math.cos(state.pitch));}
 function update(dt,lobby=false,snap=false){
  if(lobby){g.camera.fov=53;g.camera.position.set(24,18,65);g.camera.lookAt(-8,2,2);g.camera.updateProjectionMatrix();initialized=false;opacity(1,dt,true);return;}
  const dir=direction(),focus=new THREE.Vector3(player.x,player.y+1.48,player.z),right=new THREE.Vector3(Math.cos(state.yaw),0,Math.sin(state.yaw));
  const length=state.aim?3.45:5.7,desired=focus.clone().addScaledVector(dir,-length).addScaledVector(right,state.aim?.65:.9);
  clearRay(focus,desired);
  if(!initialized||snap){g.camera.position.copy(desired);initialized=true;}else{
   const previous=g.camera.position.clone(),next=previous.clone().lerp(desired,1-Math.exp(-dt*14));
   clearRay(focus,next);
   // A safe endpoint alone is insufficient at wall corners or roof edges.
   // Sweep the actual interpolated path; recover from an already obstructed
   // old location immediately, rather than trapping the camera inside geometry.
   const sweep=cameraBlocked(previous,next);
   if(sweep&&sweep.t>1e-5)clearRay(previous,next);
   else if(sweep)next.copy(desired);
   clearRay(focus,next);g.camera.position.copy(next);
  }
  const target=g.camera.position.clone().addScaledVector(dir,30);g.camera.lookAt(target);g.camera.fov+=( (state.aim?43:60)-g.camera.fov)*(snap?1:1-Math.exp(-dt*12));g.camera.updateProjectionMatrix();state.distance=g.camera.position.distanceTo(focus);
  // Preserve the full-size avatar while protecting the aiming view when the
  // wall or a low camera angle compresses the shoulder camera into its body.
  const visibility=clamp((state.distance-2)/1.1,0,1);opacity(visibility*visibility,dt,snap);
 }
 function reset(){state.yaw=0;state.pitch=-.18;state.aim=false;state.avatarOpacity=1;player.avatarOpacity=1;initialized=false;}
 return {state,look,direction,update,reset};
}
