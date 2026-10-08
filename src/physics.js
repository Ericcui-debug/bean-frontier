export const STEP=1/120,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Segment against a box, shared by body sweeps, bullets and camera obstruction.
export function segmentBox(a,b,box,pad=0){
 let near=0,far=1,normal={x:0,y:0,z:0};
 for(const k of ['x','y','z']){const lo=box[k+'0']-pad,hi=box[k+'1']+pad,d=b[k]-a[k];if(Math.abs(d)<1e-9){if(a[k]<lo||a[k]>hi)return null;continue;}
  let t0=(lo-a[k])/d,t1=(hi-a[k])/d,sign=-1;if(t0>t1){[t0,t1]=[t1,t0];sign=1;}if(t0>near){near=t0;normal={x:0,y:0,z:0};normal[k]=sign;}far=Math.min(far,t1);if(near>far)return null;}
 if(near<0||near>1)return null;return {t:near,normal};
}
export function rampHeight(s,x,z){const axis=s.axis||'z',sign=s.sign??-1,value=axis==='x'?x:z,lo=s[axis+'0'],hi=s[axis+'1'];return s.y0+s.rise*clamp(sign>0?(value-lo)/(hi-lo):(hi-value)/(hi-lo),0,1);}
// A ramp is a convex wedge. Clip against its sloped roof as well as its box.
export function segmentSolid(a,b,s,pad=0){
 if(s.shape!=='ramp')return segmentBox(a,b,s,pad);
 const axis=s.axis||'z',sign=s.sign??-1,k=s.rise/(s[axis+'1']-s[axis+'0']),nx=axis==='x'?-sign*k:0,nz=axis==='z'?-sign*k:0,c=s.y0+(sign>0?-k*s[axis+'0']:k*s[axis+'1']),planes=[[-1,0,0,-s.x0],[1,0,0,s.x1],[0,-1,0,-s.y0],[0,0,-1,-s.z0],[0,0,1,s.z1],[nx,1,nz,c]];
 let near=0,far=1,normal={x:0,y:0,z:0};
 for(const [nx,ny,nz,c] of planes){const length=Math.hypot(nx,ny,nz),da=nx*a.x+ny*a.y+nz*a.z-c-pad*length,db=nx*b.x+ny*b.y+nz*b.z-c-pad*length,d=db-da;
  if(Math.abs(d)<1e-9){if(da>0)return null;continue;}const t=-da/d;if(d<0){if(t>near){near=t;normal={x:nx/length,y:ny/length,z:nz/length};}}else far=Math.min(far,t);if(near>far)return null;
 }return near>=0&&near<=1?{t:near,normal}:null;
}
export function segmentSphere(a,b,c,r){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,ox=a.x-c.x,oy=a.y-c.y,oz=a.z-c.z,A=dx*dx+dy*dy+dz*dz,B=2*(ox*dx+oy*dy+oz*dz),D=ox*ox+oy*oy+oz*oz-r*r;if(D<=0)return 0;if(A<1e-10)return null;const disc=B*B-4*A*D;if(disc<0)return null;const t=(-B-Math.sqrt(disc))/(2*A);return t>=0&&t<=1?t:null;}
export function sweepActor(r,dx,dz,world){
 let x=r.x,z=r.z,rx=dx,rz=dz;const y=r.y+.06;
 for(let pass=0;pass<3;pass++){
  let hit=null;for(const s of world.collisionCandidates?.(x,z,rx,rz,r.y,r.height,r.radius)||world.solids){if(!s.active||r.y+r.height<s.y0+.02||y>=s.y1-.025)continue;const top=s.shape==='ramp'?rampHeight(s,x,z):s.y1;if((r.grounded&&top<=r.y+.38)||(s.shape==='ramp'&&y>=top-.025))continue;const box={x0:s.x0-r.radius,x1:s.x1+r.radius,y0:-100,y1:100,z0:s.z0-r.radius,z1:s.z1+r.radius};const h=segmentBox({x,y:0,z},{x:x+rx,y:0,z:z+rz},box);if(h&&(h.normal.x||h.normal.z)&&(!hit||h.t<hit.t))hit=h;}
  if(!hit){x+=rx;z+=rz;break;}const t=Math.max(0,hit.t-.001);x+=rx*t;z+=rz*t;rx*=1-t;rz*=1-t;if(hit.normal.x)rx=0;if(hit.normal.z)rz=0;
 }
 // Resolve any overlap from explosion knockback or a newly moved actor.
 for(const s of world.collisionCandidates?.(x,z,0,0,r.y,r.height,r.radius)||world.solids){if(!s.active||r.y+r.height<=s.y0||y>=s.y1-.025)continue;const top=s.shape==='ramp'?rampHeight(s,x,z):s.y1;if((r.grounded&&top<=r.y+.38)||(s.shape==='ramp'&&y>=top-.025))continue;const x0=s.x0-r.radius,x1=s.x1+r.radius,z0=s.z0-r.radius,z1=s.z1+r.radius;if(x>x0&&x<x1&&z>z0&&z<z1){const d=[x-x0,x1-x,z-z0,z1-z],i=d.indexOf(Math.min(...d));if(i===0)x=x0-.001;if(i===1)x=x1+.001;if(i===2)z=z0-.001;if(i===3)z=z1+.001;}}
 r.x=x;r.z=z;
}
export function moveActor(r,dt,world){
 if(world.traverse?.(r,dt))return;
 const old={x:r.x,y:r.y,z:r.z};sweepActor(r,r.vx*dt,r.vz*dt,world);
 const floor=world.groundAt(r.x,r.z,old.y+.38),oldFloor=world.groundAt(old.x,old.z,old.y+.38);
 if(r.grounded&&floor!==null&&oldFloor!==null&&Math.abs(old.y-oldFloor)<.38&&Math.abs(floor-oldFloor)<.38){r.y=floor;r.vy=0;}else{r.grounded=false;r.vy-=20*dt;let ny=r.y+r.vy*dt;
  for(const s of world.solids){if(!s.active||r.x<s.x0-r.radius*.5||r.x>s.x1+r.radius*.5||r.z<s.z0-r.radius*.5||r.z>s.z1+r.radius*.5)continue;if(s.shape!=='ramp'&&r.vy>0&&old.y+r.height<=s.y0&&ny+r.height>=s.y0){ny=s.y0-r.height;r.vy=0;}}
  // Top contacts use the visible support rectangle, including roof edges.
  if(floor!==null&&r.vy<=0&&old.y>=floor-.08&&ny<=floor){r.y=floor;r.vy=0;r.grounded=true;}else r.y=ny;
 }
}
