import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {CHARACTER,LOW_CHARACTER} from '../src/dimensions.js';
import {poseAtHeight} from '../src/character-pose.js';
import {createBeanActor,animateBeanActor,animateBeanDeath,raycastBeanBody,beanMuzzleWorld} from '../src/adapters/bean-actors.js';
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} vs ${b}`);
function actor(c=0){const a={team:'ct',pos:new T.Vector3(),height:CHARACTER.height-(CHARACTER.height-LOW_CHARACTER.height)*c,yaw:0,moveSpeed:0,aimPitch:0,deathTime:0};a.mesh=createBeanActor(a);animateBeanActor(a,0,null);return a;}
function ray(a,x,y,z=-3,dx=0,dy=0,dz=1){return {...raycastBeanBody(x,y,z,dx,dy,dz,10,...a.pos.toArray(),a.height,a,{})};}

test('all stance phases preserve rigid face, eye and shoe proportions, uniform root and clearance',()=>{
 let faceDistance,footSize;
 for(const c of [0,.1,.25,.5,.75,.9,1]){
  const a=actor(c),b=a.bean;assert.deepEqual(b.body.scale.toArray(),[.8,.8,.8]);
  const mask=b.face.children[0],v1=mask.localToWorld(new T.Vector3(.12,.04,-.083)),v2=mask.localToWorld(new T.Vector3(-.12,.04,-.083));
  faceDistance??=v1.distanceTo(v2);near(v1.distanceTo(v2),faceDistance);
  const size=new T.Box3().setFromObject(b.feet[0],true).getSize(new T.Vector3());footSize??=size.toArray();size.toArray().forEach((v,i)=>near(v,footSize[i]));
  const box=new T.Box3().setFromObject(a.mesh,true);near(box.max.y,a.height);assert.ok(box.min.y>=-.001);
  near(b.gunAnchor.getWorldPosition(new T.Vector3()).y,poseAtHeight(a.height).gunY);
 }
});

test('previous visible head-tip and side misses now hit head; high empty space remains a miss',()=>{
 const a=actor();for(const[x,y]of[[0,1.52],[.3,1.3],[-.3,1.3]]){const h=ray(a,x,y);assert.ok(h.distance>0);assert.equal(h.part,'head');}
 const low=actor(1);assert.equal(ray(low,0,1.1).distance,-1);assert.equal(ray(low,0,.83).part,'head');
});

test('eyes are headshots and shared AI chest points are torso hits throughout the transition',()=>{
 for(const c of [0,.25,.5,.75,1]){const a=actor(c),p=poseAtHeight(a.height);assert.equal(ray(a,0,p.aimHeight).part,'body');
  for(const x of [-.12,.12]){const eye=a.bean.face.localToWorld(new T.Vector3(x,.04,-.083));assert.equal(ray(a,eye.x,eye.y).part,'head');}
 }
});

test('exact hit geometry matches visible body from front, back, sides and elevated rays',()=>{
 const caster=new T.Raycaster(),hits=[];let compared=0;
 for(const c of [0,.3,.65,1]){const a=actor(c);
  for(const yaw of [0,.7,1.8,3.14]){a.yaw=yaw;animateBeanActor(a,0,null);
   for(const origin of [new T.Vector3(0,a.height*.7,-3),new T.Vector3(3,a.height*.45,0),new T.Vector3(-3,a.height*.6,1),new T.Vector3(.1,3,.1)]){
    const direction=new T.Vector3(0,a.height*.6,0).sub(origin).normalize();caster.set(origin,direction);caster.far=10;hits.length=0;caster.intersectObjects(a.bean.hitMeshes,false,hits);
    const actual=raycastBeanBody(...origin.toArray(),...direction.toArray(),10,0,0,0,a.height,a,{});if(hits.length){near(actual.distance,hits[0].distance,1e-6);compared++;}else assert.equal(actual.distance,-1);
   }
  }
 }assert.ok(compared>=48);
});

test('ray ranges and inside-body hits are bounded and do not change render material state',()=>{
 const a=actor(),h=ray(a,0,.74);assert.ok(h.distance>0);const m=a.bean.shell.material,side=m.side;
 assert.equal(raycastBeanBody(0,.74,-3,0,0,1,h.distance-.01,0,0,0,a.height,a,{}).distance,-1);
 assert.ok(ray(a,0,.74,0,1,0,0).distance>0);assert.equal(m.side,side);
});

test('positive and negative aim pitch agree with barrel direction in every stance',()=>{
 for(const c of [0,.5,1])for(const pitch of [-1.3,-.35,0,.35,1.3]){
  const a=actor(c);a.aimPitch=pitch;a.yaw=.6;const gun=new T.Group();gun.userData.muzzle=[0,0,-.5];a.bean.gunAnchor.add(gun);a.heldWeapon=gun;animateBeanActor(a,0,null);
  const direction=new T.Vector3(0,0,-1).transformDirection(a.bean.gunAnchor.matrixWorld),expected=new T.Vector3(-Math.sin(a.yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(a.yaw)*Math.cos(pitch));near(direction.dot(expected),1);
  assert.ok(beanMuzzleWorld(a).toArray().every(Number.isFinite));assert.deepEqual(gun.scale.toArray(),[1,1,1]);
 }
});

test('wall clearance retracts and tucks a full-size gun without oscillating',()=>{
 const a=actor(),gun=new T.Group();gun.userData.muzzle=[0,0,-.8];a.bean.gunAnchor.add(gun);a.heldWeapon=gun;
 const world={raycast(o,d,max){const t=(-.45-o.z)/d.z;return t>=0&&t<=max?{distance:t,point:o.clone().addScaledVector(d,t),normal:new T.Vector3(0,0,1)}:null;}};
 for(let n=0;n<240;n++)animateBeanActor(a,1/120,world);assert.deepEqual(gun.scale.toArray(),[1,1,1]);const ret=a.bean.retract;assert.ok(ret>.2);assert.ok(beanMuzzleWorld(a).z>-.45);
 for(let n=0;n<120;n++)animateBeanActor(a,1/120,world);near(a.bean.retract,ret,.001);
 const empty={raycast(){return null;}};for(let n=0;n<180;n++)animateBeanActor(a,1/120,empty);assert.ok(a.bean.retract<.001);
});

test('standing/crouched corpses rest on flat, elevated, sloped and stepped support and freeze once settled',()=>{
 for(const c of [0,.5,1])for(const shape of ['flat','elevated','slope','step']){
  const a=actor(c);if(shape==='elevated')a.pos.y=.8;const base=a.pos.y;
  const world={raycast(o,d,max){const y=shape==='slope'?.08*o.x+.05*o.z:shape==='step'&&o.z>.4?.25:base;const t=(y-o.y)/d.y;return t>=0&&t<=max?{point:new T.Vector3(o.x,y,o.z),normal:new T.Vector3(0,1,0),distance:t}:null;}};
  for(let n=0;n<=60;n++)animateBeanDeath(a,n/120,world);
  const box=new T.Box3().setFromObject(a.mesh,true);assert.ok(box.min.y>=base+.002);if(shape==='step')assert.ok(box.min.y>=.252);
  const position=a.mesh.position.clone();animateBeanDeath(a,3,world);assert.ok(position.equals(a.mesh.position));assert.ok(a.corpseSettled);
 }
});

test('production player pose and exact hit outcomes agree at15/30/60 rendering schedules',async()=>{
 const {default:Player}=await import('../src/upstream/tinystrike/player/player.js');const {CONFIG}=await import('../src/upstream/tinystrike/shared/config.js');
 const results=[];
 for(const fps of [15,30,60]){
  const game={config:CONFIG,events:{on(){},emit(){}},state:{phase:'freeze'},camera:new T.PerspectiveCamera(),input:{isDown:key=>key==='control'},world:{colliders:[],resolveMovement(pos){return{pos:new T.Vector3(pos.x,0,pos.z),onGround:true};}}};
  const p=new Player(game);p.onGround=true;let acc=0;for(let frame=0;frame<fps/2;frame++){acc+=Math.min(1/fps,.5-frame/fps);while(acc+1e-10>=1/120){p._updateMovement(1/120,'freeze');acc-=1/120;}}
  const pose=poseAtHeight(p._heightCur);const h=raycastBeanBody(0,pose.height-.06,-3,0,0,1,10,0,0,0,p._heightCur,p,{});results.push({height:p._heightCur,eye:p.eyeHeight,blend:pose.crouch,hit:h.distance,part:h.part});
 }assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);assert.equal(results[0].part,'head');
});

test('death releases held weapon and relaxes arms; the body rests on the floor and respawn restores the gun',()=>{
 const a=actor(),gun=new T.Mesh(new T.BoxGeometry(.1,.1,2),new T.MeshBasicMaterial());gun.position.z=-1;gun.userData.muzzle=[0,0,-2];a.bean.gunAnchor.add(gun);a.heldWeapon=gun;animateBeanActor(a,0,null);animateBeanDeath(a,1);assert.equal(gun.visible,false);
 const bounds=new T.Box3();for(const part of [...a.bean.hitMeshes,...a.bean.limbs])bounds.expandByObject(part,true);near(bounds.min.y,.003);assert.ok(bounds.max.y<1.2);
 gun.visible=true;animateBeanDeath(a,2);assert.equal(gun.visible,false);
 a.corpseSettled=false;animateBeanActor(a,1/120,null);assert.equal(gun.visible,true);assert.equal(a.bean.deathArmPose,null);near(a.mesh.rotation.x,0);
});
