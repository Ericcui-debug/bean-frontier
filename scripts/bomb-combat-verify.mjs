import assert from 'node:assert/strict';
import {THREE} from '../src/gfx.js';
import {createCombat,WEAPONS} from '../src/combat.js';
import {CHARACTER} from '../src/dimensions.js';
import {createBean,poseBean,disposeBean,updateBeanDisplay} from '../src/character.js';
import {segmentBox} from '../src/physics.js';
const realRandom=Math.random;Math.random=()=>.5;
const g={scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera()},solids=[];
const world={blocked(a,b,pad=0){let best=null;for(const solid of solids){const hit=segmentBox(a,b,solid,pad);if(hit&&(!best||hit.t<best.t))best={...hit,solid};}return best;}};
const actor=(id,team,z)=>({id,team,x:0,y:0,z,hp:100,maxHp:100,alive:true,grounded:true,vx:0,vz:0,armor:0,color:0xff7777,group:new THREE.Group()});
const player=actor(0,0,0),enemy=actor(1,1,-10),friend=actor(2,0,-5),actors=[player,enemy,friend];friend.alive=false;
let clock=0,deaths=0,hits=0;const combat=createCombat({g,world,player,actors,getTime:()=>clock,onDown(){deaths++;},onHit(){hits++;}});
for(const r of actors)combat.resetActor(r);
player.aimTarget=new THREE.Vector3(0,CHARACTER.body.y,-10);player.aiming=true;
assert.equal(combat.fire(player),true);assert.equal(enemy.hp,80,'pistol body damage');assert.equal(hits,1);
clock+=.24;combat.update(.24);player.aimTarget.y=CHARACTER.head.y;combat.fire(player);assert.equal(enemy.hp,40,'double head damage');
clock+=.24;combat.update(.24);player.aimTarget.y=CHARACTER.body.y;enemy.armor=100;combat.fire(player);assert.equal(enemy.hp,24,'armor reduces body by20%');
friend.alive=true;clock+=.24;combat.update(.24);combat.fire(player);assert.equal(friend.hp,100);assert.equal(enemy.hp,24,'friendly body blocks bullet');
friend.alive=false;solids.push({x0:-1,x1:1,y0:0,y1:3,z0:-6,z1:-5});clock+=.24;combat.update(.24);combat.fire(player);assert.equal(enemy.hp,24,'terrain occlusion');solids.length=0;
clock+=.24;combat.update(.24);combat.equip(player,2);combat.update(.12);combat.fire(player);assert.equal(enemy.hp,0);assert.equal(deaths,1);assert.equal(combat.state.weapon,2);
const gun=player.equipment[1];gun.ammo=0;assert.equal(combat.reload(player),true);clock+=WEAPONS[2].reload;combat.update(WEAPONS[2].reload);assert.equal(gun.ammo,30);assert.equal(gun.reserve,60);
assert.equal(combat.select(player,0),true);assert.equal(combat.state.weapon,0);combat.resetActor(player,true);assert.equal(player.equipment[1].id,2);assert.equal(player.equipment[1].reserve,90);
combat.resetActor(player,false);assert.equal(player.equipment[1],null);assert.equal(player.equipment[0].ammo,12);
assert.equal(WEAPONS.length,4);assert.deepEqual(WEAPONS.map(w=>w.damage),[20,18,30,80]);combat.clearEffects();assert.equal(g.scene.children.length,0);Math.random=realRandom;
console.log('Bomb combat: damage, headshot, armor, friend blocking, occlusion, death, reload and loadout checks passed.');
// A camera-visible target cannot be hit through an obstruction between eye and barrel.
enemy.alive=true;enemy.hp=100;player.alive=true;player.cooldown=0;
g.camera.position.set(0,CHARACTER.eye,0);g.camera.lookAt(0,CHARACTER.body.y,-10);g.camera.updateMatrixWorld(true);
const muzzle=new THREE.Object3D();muzzle.position.set(.4,1.05,-.6);g.scene.add(muzzle);g.camera.userData.muzzle=muzzle;
solids.push({x0:.2,x1:.6,y0:.8,y1:1.5,z0:-.7,z1:-.25});combat.fire(player,g.camera);assert.equal(enemy.hp,100,'eye-to-muzzle obstruction blocks hit');solids.length=0;g.camera.userData.muzzle=null;muzzle.removeFromParent();combat.clearEffects();
const {createCamera}=await import('../src/camera.js');player.body=new THREE.Group();player.equipment=[{id:0},null];player.slot=0;const camera=createCamera(g,world,player);
camera.look(2,10);camera.update(1/60);assert.equal(camera.state.pitch,1.45);assert.equal(g.camera.position.y,CHARACTER.eye);assert.equal(player.body.visible,false);assert.equal(camera.view.scale.x,CHARACTER.viewScale);
camera.look(0,-20);camera.update(1/60);assert.equal(camera.state.pitch,-1.45);assert.equal(g.camera.position.y,CHARACTER.eye,'pitch does not enter ground');
player.equipment[1]={id:3};player.slot=1;camera.state.aim=true;camera.update(1/30);assert.equal(camera.state.scope,true);assert.equal(camera.view.visible,false);
camera.state.aim=false;camera.state.pitch=0;camera.state.yaw=0;solids.push({x0:-1,x1:1,y0:0,y1:3,z0:-.45,z1:-.3});camera.update(1/60);assert.ok(camera.view.position.z>.15,'weapon retracts at wall');assert.ok(camera.state.wallDistance<.4);world.bounds={x0:10,x1:74,z0:-40,z1:16};camera.update(0,true);assert.equal(g.camera.position.x,42);const landscapeHeight=g.camera.position.y;g.camera.aspect=.5;camera.update(0,true);assert.ok(g.camera.position.y>landscapeHeight,'portrait lobby frames full map width');camera.dispose();console.log('First-person camera: pitch, hidden body, scope, wall retraction and bounds-aware lobby framing checks passed.');

// The model, colliders and damage volumes share one scale; posing must not
// restore the old size or scale a child twice.
const sharedBox=new THREE.BoxGeometry(1,1,1),sharedSphere=new THREE.SphereGeometry(1,8,6),sharedMat=new THREE.MeshStandardMaterial({color:0xf455a6});
const modelG={scene:new THREE.Scene(),mesh(geo,color,parent){const m=new THREE.Mesh(geo,sharedMat);parent.add(m);return m;},box(x,y,z,w,h,d,color,parent){const m=this.mesh(sharedBox,color,parent);m.position.set(x,y,z);m.scale.set(w,h,d);return m;},ball(x,y,z,sx,sy,sz,color,parent){const m=this.mesh(sharedSphere,color,parent);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;},cylinder(x,y,z,r,h,color,parent){const m=this.mesh(new THREE.CylinderGeometry(r,r,h,8),color,parent);m.position.set(x,y,z);return m;}};
const bean=createBean(modelG);poseBean(bean,0,true);bean.group.updateMatrixWorld(true);
const equalNear=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-9,label+`: ${a} != ${b}`);
assert.equal(bean.radius,CHARACTER.radius);assert.equal(bean.height,CHARACTER.height);assert.equal(bean.group.scale.x,1);assert.equal(bean.body.scale.x,.8);
const actualMuzzle=bean.muzzle.getWorldPosition(new THREE.Vector3());for(const key of ['x','y','z'])equalNear(actualMuzzle[key],CHARACTER.muzzle[key],`neutral muzzle ${key}`);
assert.equal(bean.health.position.y,1.92);assert.equal(bean.health.scale.x,.8);
for(const t of [0,.3,2]){bean.vx=4;poseBean(bean,t,true);assert.equal(bean.body.scale.x,.8);assert.equal(bean.gun.scale.x,1);}
bean.vx=0;bean.x=2;bean.y=1.5;bean.z=3;bean.gunPitch=-.6;poseBean(bean,0,true);bean.group.updateMatrixWorld(true);const pitched=bean.muzzle.getWorldPosition(new THREE.Vector3());assert.ok(pitched.y>bean.y+CHARACTER.muzzle.y,'pitched mesh raises its real muzzle');
// Shrunk head/body hit volumes have the expected edge: the old silhouette
// above the head and outside the smaller torso no longer blocks a bullet.
enemy.alive=true;enemy.hp=100;friend.alive=false;
assert.equal(combat.actorHit(new THREE.Vector3(.45,CHARACTER.body.y,-8),new THREE.Vector3(.45,CHARACTER.body.y,-12),player),null,'old outer torso space is clear');
assert.equal(combat.actorHit(new THREE.Vector3(0,1.52,-8),new THREE.Vector3(0,1.52,-12),player),null,'old upper head space is clear');
assert.equal(combat.actorHit(new THREE.Vector3(0,CHARACTER.head.y,-8),new THREE.Vector3(0,CHARACTER.head.y,-12),player).head,true);
// AI uses the current model muzzle even when its previous render pose was at
// another position, rather than a larger synthetic barrel offset.
bean.id=7;bean.team=0;bean.aimTarget=new THREE.Vector3(0,CHARACTER.body.y,-10);bean.x=bean.y=bean.z=0;bean.vx=bean.vz=0;bean.gunPitch=0;bean.yaw=0;
const realGunCombat=createCombat({g:modelG,world,player:bean,actors:[bean,enemy],getTime:()=>0});realGunCombat.resetActor(bean);solids.push({x0:.15,x1:.42,y0:.75,y1:1.18,z0:-.8,z1:-.5});assert.equal(realGunCombat.fire(bean),true);assert.equal(enemy.hp,100,'mesh muzzle obstruction blocks AI shot');solids.length=0;
const liveMuzzle=bean.muzzle.getWorldPosition(new THREE.Vector3()),traceStart=realGunCombat.traces[0].mesh.geometry.attributes.position;for(const [i,key] of ['x','y','z'].entries())assert.ok(Math.abs(traceStart.array[i]-liveMuzzle[key])<1e-6,'AI trace starts at current model muzzle');
realGunCombat.clearEffects();disposeBean(bean);sharedBox.dispose();sharedSphere.dispose();sharedMat.dispose();
assert.ok(Object.isFrozen(CHARACTER)&&Object.isFrozen(CHARACTER.hitVolumes)&&CHARACTER.hitVolumes.every(Object.isFrozen));
console.log('Scaled bean: model proportions, immutable dimensions, hit-volume edges, health bar and actual AI muzzle checks passed.');
