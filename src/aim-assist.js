import {Vector3} from 'three';
import {stanceDimensions} from './dimensions.js';

// A continuous input multiplier; this never changes a camera direction.
export function createAimAssist({camera,world,actors,player,getViewport}){
 const projected=new Vector3(),eye=new Vector3();let value=1,target=1,scanIn=0,wasEnabled=false;
 function reset(){value=target=1;scanIn=0;wasEnabled=false;}
 function update(dt,enabled){
  scanIn-=dt;
  if(!enabled){target=1;scanIn=0;}
  if(enabled&&(scanIn<=0||!wasEnabled)){
   scanIn=1/30;target=1;
   const viewport=getViewport(),width=Math.max(1,viewport.width),height=Math.max(1,viewport.height),short=Math.min(width,height),outer=short*.04,inner=short*.015;
   camera.updateMatrixWorld(true);
   for(const a of actors){
    if(!a.alive||a.team===player.team)continue;
    eye.set(a.x,a.y+stanceDimensions(a).aimHeight,a.z);
    const distance=eye.distanceTo(camera.position);if(distance<1||distance>32)continue;
    projected.copy(eye).project(camera);if(projected.z< -1||projected.z>1)continue;
    const radius=Math.hypot(projected.x*width*.5,projected.y*height*.5);if(radius>=outer||world.blocked(camera.position,eye,.01))continue;
    const weight=Math.max(0,Math.min(1,(outer-radius)/(outer-inner))),smooth=weight*weight*(3-2*weight);
    target=Math.min(target,1-.3*smooth);
   }
  }
  wasEnabled=enabled;
  value+=(target-value)*(1-Math.exp(-Math.max(0,dt)/.08));
  if(Math.abs(value-target)<1e-6)value=target;
  return value;
 }
 return {update,reset,get value(){return value;}};
}
