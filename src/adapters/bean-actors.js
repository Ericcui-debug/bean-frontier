import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CHARACTER,LOW_CHARACTER} from '../dimensions.js';
import {poseForActor,foldBeanVertex} from '../character-pose.js';

// Team geometry/materials are shared. Only the shell and uniform have a morph
// target; face, eyes and shoes keep their shape through the entire crouch.
const bodies=new Map(),arms=new Map();
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:0});
function painted(geometry,color,position=[0,0,0],scale=[1,1,1],zone=0){
 geometry=geometry.index?geometry.toNonIndexed():geometry.clone();geometry.scale(...scale);geometry.translate(...position);
 const c=new THREE.Color(color),n=geometry.attributes.position.count,values=new Float32Array(n*3),zones=new Float32Array(n);
 for(let i=0;i<n;i++){values[i*3]=c.r;values[i*3+1]=c.g;values[i*3+2]=c.b;zones[i]=zone;}
 geometry.setAttribute('color',new THREE.BufferAttribute(values,3));geometry.setAttribute('hitZone',new THREE.BufferAttribute(zones,1));return geometry;
}
function oval(color,p,s,zone=0){return painted(new THREE.SphereGeometry(1,20,14),color,p,s,zone);}
function merge(parts){const result=mergeGeometries(parts);parts.forEach(p=>p.dispose());return result;}
function uniform(team){return team==='ct'?0x354c62:0x736148;}
function bodyGeometry(team){
 if(!bodies.has(team)){
  const col=team==='ct'?0x5cbfb6:0xe69cbc;
  const shell=painted(new THREE.CapsuleGeometry(.53,.7,8,24),col,[0,1.06,0]);
  const pos=shell.attributes.position,zone=shell.attributes.hitZone;
  for(let i=0;i<pos.count;i+=3){const y=(pos.getY(i)+pos.getY(i+1)+pos.getY(i+2))/3;const z=y>=1.34?1:y<.65?2:0;zone.setX(i,z);zone.setX(i+1,z);zone.setX(i+2,z);}
  const geo=merge([shell,oval(uniform(team),[0,.98,-.435],[.43,.29,.115]),...[-.25,0,.25].map(x=>painted(new THREE.BoxGeometry(.19,.16,.055),0x4d6065,[x,.92,-.548]))]);
  const base=geo.attributes.position,normal=geo.attributes.normal,low=new Float32Array(base.array.length),norm=new Float32Array(base.array.length),v={},a={},b={};
  for(let i=0;i<base.count;i++){
   const x=base.getX(i),y=base.getY(i),z=base.getZ(i);foldBeanVertex(x,y,z,1,v);low.set([v.x,v.y,v.z],i*3);
   foldBeanVertex(x,y-.0001,z,1,a);foldBeanVertex(x,y+.0001,z,1,b);
   const dy=(b.y-a.y)/.0002,dz=(b.z-a.z)/.0002;
   foldBeanVertex(x,y,z-.0001,1,a);foldBeanVertex(x,y,z+.0001,1,b);const zz=(b.z-a.z)/.0002;
   const nx=normal.getX(i),nz=normal.getZ(i)/zz,ny=(normal.getY(i)-dz*nz)/dy,l=Math.hypot(nx,ny,nz)||1;
   norm.set([nx/l,ny/l,nz/l],i*3);
  }
  geo.morphAttributes.position=[new THREE.BufferAttribute(low,3)];geo.morphAttributes.normal=[new THREE.BufferAttribute(norm,3)];geo.computeBoundingBox();geo.computeBoundingSphere();bodies.set(team,geo);
 }return bodies.get(team);
}
const maskGeometry=oval(0xffedcc,[0,0,0],[.35,.4,.092],1);
// The bean has no neck seam: the lower face patch continues onto the belly.
// Keep eyes/upper mask in the head zone and the chin/bib in the torso zone.
for(let i=0;i<maskGeometry.attributes.position.count;i+=3){const p=maskGeometry.attributes.position,z=maskGeometry.attributes.hitZone;const zone=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3>=-.12?1:0;z.setX(i,zone);z.setX(i+1,zone);z.setX(i+2,zone);}
const faceGeometry=merge([maskGeometry,...[-.12,.12].map(x=>oval(0x1d2534,[x,.04,-.083],[.047,.10,.024],1))]);
function armGeometry(team){if(!arms.has(team))arms.set(team,merge([painted(new THREE.CapsuleGeometry(.145,.46,5,16),team==='ct'?0x5cbfb6:0xe69cbc,[0,-.34,0]),oval(uniform(team),[0,-.23,0],[.16,.22,.16]),oval(0x253239,[0,-.55,-.01],[.15,.13,.15])]));return arms.get(team);}
const footGeometry=oval(0x253239,[0,0,0],[.225,.17,.31],2);
function mesh(geo){const result=new THREE.Mesh(geo,material);result.castShadow=true;result.receiveShadow=true;return result;}
export function createBeanActor(bot){
 const root=new THREE.Group(),body=new THREE.Group();body.scale.setScalar(CHARACTER.scale);root.add(body);
 const shell=mesh(bodyGeometry(bot.team)),face=new THREE.Group(),mask=mesh(faceGeometry);body.add(shell,face);face.add(mask);
 const limbs=[],feet=[];
 for(const side of [-1,1]){const joint=new THREE.Group();joint.position.set(side*.4,1.42,0);joint.add(mesh(armGeometry(bot.team)));body.add(joint);limbs.push(joint);const foot=mesh(footGeometry);body.add(foot);feet.push(foot);}
 const gunAnchor=new THREE.Group();body.add(gunAnchor);
 bot.bean={body,shell,face,limbs,feet,gunAnchor,hitMeshes:[shell,mask,...feet],pose:{},phase:0,retract:0,clearanceClock:0,world:null};bot.parts=null;root.userData.bean=true;root.userData.bot=bot;return root;
}
const origin=new THREE.Vector3(),direction=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0),target=new THREE.Vector3();
function applyPose(bot){
 const b=bot.bean,p=poseForActor(bot,b.pose);bot.mesh.position.copy(bot.pos);bot.mesh.rotation.set(0,bot.yaw||0,0);
 b.body.scale.setScalar(CHARACTER.scale);b.body.position.y=0;b.shell.morphTargetInfluences[0]=p.crouch;
 b.face.position.set(0,p.faceY,p.faceZ);b.face.rotation.x=p.facePitch;
 b.gunAnchor.scale.setScalar(1);b.gunAnchor.position.set(.24,(p.gunY-b.retract*.10)/CHARACTER.scale,(p.gunZ+b.retract)/CHARACTER.scale);
 const tuck=Math.min(1,b.retract/.70);
 b.gunAnchor.rotation.set((bot.aimPitch||0)*(1-.85*tuck)+(bot.fireAnim||0)*.07,.65*tuck,0);
 const run=Math.min(1,(bot.moveSpeed||0)/4.6);
 b.feet.forEach((foot,i)=>{const wave=Math.sin(b.phase+i*Math.PI);foot.position.set((i===0?-1:1)*p.footSpread,.17+Math.abs(wave)*.025*run,p.footZ+wave*.19*run*(1-.45*p.crouch));foot.rotation.x=wave*.16*run;});
 b.gunAnchor.updateWorldMatrix(true,false);
 b.limbs.forEach((joint,i)=>{joint.position.set((i===0?-1:1)*.4,p.shoulderY/CHARACTER.scale,p.shoulderZ/CHARACTER.scale);target.set(i===0?-.05:0,i===0?-.02:-.12,i===0?-.28:0);b.gunAnchor.localToWorld(target);b.body.worldToLocal(target);direction.copy(target).sub(joint.position);joint.scale.y=Math.max(.25,Math.min(1.4,direction.length()/.55));joint.quaternion.setFromUnitVectors(down,direction.normalize());});
 if(bot.heldWeapon)bot.heldWeapon.scale.setScalar(1);
 bot.mesh.updateWorldMatrix(true,true);return p;
}
export function animateBeanActor(bot,dt,world){
 const b=bot.bean;if(!b)return;b.world=world||b.world;b.deathSupport=null;b.deathArmPose=null;if(bot.heldWeapon)bot.heldWeapon.visible=true;
 b.phase+=Math.max(0,bot.moveSpeed||0)*dt*2.4;bot.fireAnim=Math.max(0,(bot.fireAnim||0)-dt*8);
 const p=applyPose(bot);b.clearanceClock-=dt;
 if(bot.heldWeapon&&world?.raycast&&b.clearanceClock<=0){
  b.clearanceClock=1/30;const spec=bot.heldWeapon.userData.muzzle;
  if(Array.isArray(spec)){
   // Sample the rest pose, not the retracted barrel, to avoid wall oscillation.
   const saved=b.retract;b.retract=0;applyPose(bot);target.fromArray(spec);bot.heldWeapon.localToWorld(target);origin.copy(bot.pos);origin.y+=p.shoulderY;direction.copy(target).sub(origin);const length=direction.length();
   const hit=length>.01?world.raycast(origin,direction.normalize(),length+.05):null;b.retractTarget=hit?Math.max(0,Math.min(.70,length-hit.distance+.07)):0;b.retract=saved;
  }
 }
 b.retract+=((b.retractTarget||0)-b.retract)*(1-Math.exp(-18*dt));applyPose(bot);
}
const corpseBounds=new THREE.Box3(),probe=new THREE.Vector3(),restEuler=new THREE.Euler(),restQuat=new THREE.Quaternion();
export function animateBeanDeath(bot,time,world=bot.bean?.world){
 const b=bot.bean;if(!b)return;if(bot.heldWeapon)bot.heldWeapon.visible=false;if(bot.corpseSettled&&b.deathSupport!==null)return;
 const t=Math.min(1,Math.max(0,(time-bot.deathTime)/.5));
 // A dead bean lets go: a held barrel must not prop the corpse above ground.
 if(bot.heldWeapon)bot.heldWeapon.visible=false;
 b.deathArmPose??=b.limbs.map(joint=>({rotation:joint.quaternion.clone(),scale:joint.scale.y}));
 b.limbs.forEach((joint,i)=>{restQuat.setFromEuler(restEuler.set(.25,0,i===0?-.1:.1));joint.quaternion.slerpQuaternions(b.deathArmPose[i].rotation,restQuat,t);joint.scale.y=b.deathArmPose[i].scale+(1-b.deathArmPose[i].scale)*t;});
 bot.mesh.position.copy(bot.pos);bot.mesh.rotation.set(t*Math.PI*.47,bot.yaw||0,0);bot.mesh.updateWorldMatrix(true,true);
 corpseBounds.makeEmpty();for(const part of [...b.hitMeshes,...b.limbs])corpseBounds.expandByObject(part,true);
 let floor=bot.pos.y;
 if(world?.raycast){
  const points=[[bot.pos.x,bot.pos.z],[corpseBounds.min.x,corpseBounds.min.z],[corpseBounds.max.x,corpseBounds.min.z],[corpseBounds.min.x,corpseBounds.max.z],[corpseBounds.max.x,corpseBounds.max.z]];
  for(const [x,z]of points){probe.set(x,bot.pos.y+.35,z);const hit=world.raycast(probe,down,3);if(hit&&(!hit.normal||hit.normal.y>.6))floor=Math.max(floor,hit.point.y);}
 }
 bot.mesh.position.y+=floor+.003-corpseBounds.min.y;bot.mesh.updateWorldMatrix(true,true);bot.corpseSettled=t>=1;b.deathSupport=floor;
}
// Viewmodel limbs have the same rounded mittens and team sleeves. The grip
// origin is shared with the native weapon wrapper, so reload/throw remain locked.
const viewArms=new Map();
export function createBeanViewArms(team,id,model){
 const key=team+':'+id+':'+JSON.stringify([model?.nodes?.gripR?.pos,model?.nodes?.gripL?.pos]);
 let geometry=viewArms.get(key);
 if(!geometry){
  const parts=[],long=['ak47','m4a1','mp5','awp'].includes(id);
  const nodes=model?.nodes;
  const grips=[nodes?.gripR?.pos||[.024,-.08,.015]];
  if(long)grips.push(nodes?.gripL?.pos||[-.04,-.03,-.20]);
  for(let i=0;i<grips.length;i++){
   const wrist=new THREE.Vector3().fromArray(grips[i]);
   if(i===1){wrist.x+=.04;wrist.y-=.045;}
   const elbow=wrist.clone().add(new THREE.Vector3(i===0?.12:-.08,-.19,.37));
   const delta=elbow.clone().sub(wrist),mid=elbow.clone().add(wrist).multiplyScalar(.5);
   const sleeve=new THREE.CapsuleGeometry(.032,Math.max(.01,delta.length()-.064),5,16).toNonIndexed();
   sleeve.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
   parts.push(painted(sleeve,uniform(team),mid.toArray()));
   parts.push(oval(team==='ct'?0x5cbfb6:0xe69cbc,wrist.toArray(),[.029,.027,.030]));
   const glove=wrist.clone().add(new THREE.Vector3(i===0?-.005:.023,-.007,-.031));
   parts.push(oval(0x253239,glove.toArray(),[.033,.041,.037]));
  }
  geometry=merge(parts);viewArms.set(key,geometry);
 }
 const group=new THREE.Group();group.name='bean-view-arms';group.userData.team=team;
 const hands=mesh(geometry);hands.castShadow=false;hands.receiveShadow=false;hands.frustumCulled=false;group.add(hands);return group;
}

export {CHARACTER,LOW_CHARACTER};

export function beanMuzzleWorld(bot,out=new THREE.Vector3()) {
 if(bot.bean)applyPose(bot);
 const gun=bot.heldWeapon,spec=gun?.userData?.muzzle;
 if(gun&&Array.isArray(spec)){out.fromArray(spec);gun.localToWorld(out);return out;}
 return out.copy(bot.pos).add(new THREE.Vector3(0,poseForActor(bot).gunY,0));
}

// Exact CPU ray queries use the very same morph target and rigid face as
// rendering. One off-scene proxy covers the local first-person body and pure
// scalar callers; visible bots use their actual meshes and current gait.
const hitRaycaster=new THREE.Raycaster(),hitList=[],hitBox=new THREE.Box3();
let proxy=null;
export function raycastBeanBody(ox,oy,oz,dx,dy,dz,maxDist,fx,fy,fz,height,actor,out={}){
 let targetActor=actor?.bean?actor:null;
 if(!targetActor){if(!proxy){proxy={team:'ct',pos:new THREE.Vector3(),yaw:0,moveSpeed:0,height:CHARACTER.height};proxy.mesh=createBeanActor(proxy);}targetActor=proxy;proxy.pos.set(fx,fy,fz);proxy.height=height;proxy.yaw=actor?.yaw||0;}
 applyPose(targetActor);
 hitRaycaster.ray.origin.set(ox,oy,oz);hitRaycaster.ray.direction.set(dx,dy,dz);hitRaycaster.near=0;hitRaycaster.far=maxDist;
 // Conservative broad phase includes the face and gait, not the held gun.
 const padding=.65;hitBox.min.set(fx-padding,fy-.03,fz-padding);hitBox.max.set(fx+padding,fy+height+.03,fz+padding);
 if(!hitRaycaster.ray.intersectsBox(hitBox)){out.distance=-1;return out;}
 hitList.length=0;const side=material.side;material.side=THREE.DoubleSide;
 try{hitRaycaster.intersectObjects(targetActor.bean.hitMeshes,false,hitList);}finally{material.side=side;}
 const hit=hitList[0];out.distance=hit?.distance??-1;
 if(hit){const attr=hit.object.geometry.attributes.hitZone,zone=attr?.getX(hit.face.a)||0;out.part=zone===1?'head':zone===2?'legs':'body';out.y=hit.point.y;}
 return out;
}
