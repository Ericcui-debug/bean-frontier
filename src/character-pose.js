import {CHARACTER,LOW_CHARACTER} from './dimensions.js';

const clamp=value=>Math.max(0,Math.min(1,value));
const mix=(a,b,t)=>a+(b-a)*t;

// Gameplay values are metres; model anchors are in the unscaled Bean Blitz
// coordinates. The actor root is always uniformly scaled by CHARACTER.scale.
export function poseAtHeight(height=CHARACTER.height,out={}) {
 const h=Number.isFinite(height)?height:CHARACTER.height;
 const c=clamp((CHARACTER.height-h)/(CHARACTER.height-LOW_CHARACTER.height));
 out.crouch=c;out.height=mix(CHARACTER.height,LOW_CHARACTER.height,c);
 out.eye=mix(CHARACTER.eye,LOW_CHARACTER.eye,c);
 out.aimHeight=mix(CHARACTER.aimHeight,LOW_CHARACTER.aimHeight,c);
 out.faceY=mix(1.24,.60,c);out.facePitch=.22*c;out.faceZ=mix(-.475,-.55,c);
 out.gunY=mix(CHARACTER.hold.y,LOW_CHARACTER.hold.y,c);out.gunZ=mix(CHARACTER.hold.z,LOW_CHARACTER.hold.z,c);
 out.shoulderY=mix(1.136,.67,c);out.shoulderZ=-.025*c;
 out.footZ=mix(-.055,-.28,c);out.footSpread=mix(.26,.31,c);
 return out;
}

export function poseForActor(actor,out={}) {
 const height=actor?._heightCur??actor?.height;
 return poseAtHeight(Number.isFinite(height)?height:
  actor?.crouching||actor?.crouched||actor?.stance==='low'?LOW_CHARACTER.height:CHARACTER.height,out);
}

// Only the lower shell folds. The upper cap keeps its curvature; the separate
// rigid face and eyes rotate/translate without scaling. Used for the shared
// morph target, so visible and hittable vertices are identical.
export function foldBeanVertex(x,y,z,c=1,out={}) {
 let lowY=y>=1.41?y-.84:.06+(y-.18)*(.51/1.23);
 // C1 transition between the tucked belly and the unchanged upper cap.
 if(y>1.17&&y<1.50){const t=(y-1.17)/.33,t2=t*t,t3=t2*t;
  const a=.06+(.99)*(.51/1.23),b=.66;
  lowY=(2*t3-3*t2+1)*a+(t3-2*t2+t)*.33*(.51/1.23)+(-2*t3+3*t2)*b+(t3-t2)*.33;
 }
 const bend=Math.sin(Math.PI*clamp((y-.18)/1.76));
 const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
 const wy=lowY*CHARACTER.scale;
 const bulge=(.16*smooth(.58,.80,wy)+.10*(1-smooth(.15,.35,wy))*smooth(.02,.13,wy))/CHARACTER.scale;
 out.x=x;out.y=mix(y,lowY,c);out.z=z-(.045*bend+bulge*Math.max(0,-z/.53))*c;
 return out;
}
