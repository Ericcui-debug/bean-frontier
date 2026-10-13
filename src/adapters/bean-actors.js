import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CHARACTER,LOW_CHARACTER} from '../dimensions.js';

// Bean Blitz proportions; shared geometry and one material per team. Vertex
// colors merge the face, vest and cuffs without adding mobile draw calls.
const bodies=new Map(),arms=new Map();
const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,metalness:0});
function painted(geometry,color,position=[0,0,0],scale=[1,1,1]){
 geometry=geometry.index?geometry.toNonIndexed():geometry.clone();geometry.scale(...scale);geometry.translate(...position);
 const c=new THREE.Color(color),values=new Float32Array(geometry.attributes.position.count*3);
 for(let i=0;i<values.length;i+=3){values[i]=c.r;values[i+1]=c.g;values[i+2]=c.b;}
 geometry.setAttribute('color',new THREE.BufferAttribute(values,3));return geometry;
}
function oval(color,p,s){return painted(new THREE.SphereGeometry(1,20,14),color,p,s);}
function merge(parts){const result=mergeGeometries(parts);parts.forEach(p=>p.dispose());return result;}
function uniform(team){return team==='ct'?0x354c62:0x736148;}
function bodyGeometry(team){
 if(!bodies.has(team)){const col=team==='ct'?0x5cbfb6:0xe69cbc;
 bodies.set(team,merge([
 painted(new THREE.CapsuleGeometry(.53,.7,8,24),col,[0,1.06,0]),
 oval(0xffedcc,[0,1.24,-.475],[.35,.4,.092]),
 ...[-.12,.12].map(x=>oval(0x1d2534,[x,1.28,-.558],[.047,.10,.024])),
 oval(uniform(team),[0,.98,-.435],[.43,.29,.115]),
 ...[-.25,0,.25].map(x=>painted(new THREE.BoxGeometry(.19,.16,.055),0x4d6065,[x,.92,-.548])),
 ]));}return bodies.get(team);
}
function armGeometry(team){if(!arms.has(team))arms.set(team,merge([
 painted(new THREE.CapsuleGeometry(.145,.46,5,16),team==='ct'?0x5cbfb6:0xe69cbc,[0,-.34,0]),
 oval(uniform(team),[0,-.23,0],[.16,.22,.16]),
 oval(0x253239,[0,-.55,-.01],[.15,.13,.15]),
 ]));return arms.get(team);}
const footGeometry=oval(0x253239,[0,0,0],[.225,.17,.31]);
function mesh(geo){const result=new THREE.Mesh(geo,material);result.castShadow=true;result.receiveShadow=true;return result;}
export function createBeanActor(bot){
 const root=new THREE.Group(),body=new THREE.Group();body.scale.setScalar(CHARACTER.scale);root.add(body);
 body.add(mesh(bodyGeometry(bot.team)));const limbs=[],feet=[];
 for(const side of [-1,1]){const joint=new THREE.Group();joint.position.set(side*.4,1.42,0);joint.add(mesh(armGeometry(bot.team)));body.add(joint);limbs.push(joint);
 const foot=mesh(footGeometry);foot.position.set(side*.26,.17,-.055);body.add(foot);feet.push(foot);}
 const gunAnchor=new THREE.Group();gunAnchor.position.set(.24,1.05,-.36);body.add(gunAnchor);
 bot.bean={body,limbs,feet,gunAnchor,phase:0,clearanceClock:0,clearance:1};bot.parts=null;root.userData.bean=true;root.userData.bot=bot;return root;
}
const origin=new THREE.Vector3(),direction=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0),target=new THREE.Vector3();
export function animateBeanActor(bot,dt,world){
 const b=bot.bean;if(!b)return;
 bot.mesh.position.copy(bot.pos);bot.mesh.rotation.set(0,bot.yaw,0);
 const vertical=(bot.height??CHARACTER.height)/CHARACTER.height;
 b.body.scale.set(CHARACTER.scale,CHARACTER.scale*vertical,CHARACTER.scale);
 b.phase+=Math.max(0,bot.moveSpeed||0)*dt*2.4;const run=Math.min(1,(bot.moveSpeed||0)/4.6);
 bot.fireAnim=Math.max(0,(bot.fireAnim||0)-dt*8);
 b.body.position.y=Math.abs(Math.sin(b.phase))*.025*run;
 b.gunAnchor.scale.y=1/vertical;b.gunAnchor.position.y=1.05*vertical;
 b.gunAnchor.rotation.x=-(bot.aimPitch||0)+(bot.fireAnim||0)*.07;
 b.feet.forEach((foot,i)=>{foot.position.z=-.055+Math.sin(b.phase+i*Math.PI)*.19*run;foot.rotation.x=Math.sin(b.phase+i*Math.PI)*.16*run;});
 // Hands meet the gun in body local coordinates, also at extreme pitch.
 b.gunAnchor.updateMatrixWorld(true);
 b.limbs.forEach((joint,i)=>{target.set(i===0?-.05:0,i===0?-.02:-.12,i===0?-.28:0);b.gunAnchor.localToWorld(target);b.body.worldToLocal(target);direction.copy(target).sub(joint.position);joint.scale.y=Math.max(.25,Math.min(1.4,direction.length()/.55));joint.quaternion.setFromUnitVectors(down,direction.normalize());});
 // Sweep from the shoulder to the actual barrel tip. A wall retracts the
 // complete held gun instead of leaving its receiver through the cover.
 b.clearanceClock-=dt;
 if(bot.heldWeapon&&world?.raycast&&b.clearanceClock<=0){b.clearanceClock=.12;const gun=bot.heldWeapon;gun.scale.setScalar(1);
 const spec=gun.userData.muzzle;if(Array.isArray(spec)){target.fromArray(spec);gun.localToWorld(target);origin.copy(bot.pos);origin.y+=(bot.height||CHARACTER.height)*.63;direction.copy(target).sub(origin);const length=direction.length();
 const hit=length>.01?world.raycast(origin,direction.normalize(),length+.05):null;b.clearance=hit?Math.max(.16,Math.min(1,(hit.distance-.06)/length)):1;}}
 if(bot.heldWeapon)bot.heldWeapon.scale.setScalar(b.clearance);
}
export function animateBeanDeath(bot,time){const t=Math.min(1,Math.max(0,(time-bot.deathTime)/.5));bot.mesh.position.copy(bot.pos);bot.mesh.rotation.set(t*Math.PI*.47,bot.yaw,0);bot.mesh.position.y+=.18*t;bot.corpseSettled=t>=1;}
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
 const gun=bot.heldWeapon,spec=gun?.userData?.muzzle;
 if(gun&&Array.isArray(spec)){out.fromArray(spec);gun.localToWorld(out);return out;}
 return out.copy(bot.pos).add(new THREE.Vector3(0,(bot.height||CHARACTER.height)*.65,0));
}
