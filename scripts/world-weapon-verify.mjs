import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../src/world.js';
import {createBean,poseBean,updateBeanDisplay,disposeBean} from '../src/character.js';
import {loadVisualAssets} from '../src/weapon-models.js';
import {createCombat} from '../src/combat.js';
import {overlapsVolume} from '../src/visual/decoration-geometry.js';
await loadVisualAssets();let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++;};
const scene=new THREE.Scene(),unit=new THREE.BoxGeometry(),sphere=new THREE.SphereGeometry(1,8,6),material=new THREE.MeshStandardMaterial({color:0xaaaaaa}),labels=[];
const g={scene,labels,sharedCylinders:true,mesh(geo,color,parent=scene){const m=new THREE.Mesh(geo,material);parent.add(m);return m;},box(x,y,z,w,h,d,c,p){const m=this.mesh(unit,c,p);m.position.set(x,y,z);m.scale.set(w,h,d);return m;},ball(x,y,z,w,h,d,c,p){const m=this.mesh(sphere,c,p);m.position.set(x,y,z);m.scale.set(w,h,d);return m;},cylinder(x,y,z,r,h,c,p){return this.box(x,y,z,r*2,h,r*2,c,p);},label(t,x,y,z){const m=new THREE.Sprite(new THREE.SpriteMaterial());m.position.set(x,y,z);labels.push(m);scene.add(m);return m;}};
const world=createWorld(g),actor=createBean(g),camera=new THREE.PerspectiveCamera();Object.assign(actor,{id:7,team:0,alive:true,slot:1,equipment:[{id:0,ammo:12,reserve:60},{id:3,ammo:5,reserve:20}]});
const as=world.solids.find(s=>s.type==='wall'&&Math.abs(s.x0+10.001778)<.001&&s.z0<-8.795&&s.z1>-8.795&&s.y0===0);
check('reported thin warehouse wall is the real map geometry',!!as);
const cases=[{name:'thin warehouse west wall',map:'assault',x:-10.456,y:0,z:-8.795,yaw:Math.PI/2,wall:as},{name:'closed rear door',map:'assault',door:true},{name:'low duct metal wall',map:'assault',low:true},{name:'thick Dust2 short-side wall',map:'dust2',thick:true}];
for(const fixture of cases){
 world.loadMap(fixture.map);let wall=fixture.wall;
 if(fixture.door){wall=world.solids.find(s=>s.id==='rear-door');Object.assign(fixture,{x:wall.x1+.46,y:wall.y0,z:wall.z,yaw:-Math.PI/2});}
 if(fixture.low){wall=world.solids.find(s=>s.type==='wall'&&s.material==='metal'&&s.w<.2&&s.y0>9&&s.x>6&&s.z0<-13.8&&s.z1>-13.8);Object.assign(fixture,{x:wall.x0-.46,y:wall.y0,z:-13.8,yaw:Math.PI/2,crouched:true});}
 if(fixture.thick){wall=world.solids.find(s=>s.type==='wall'&&s.x0>21&&s.x0<23&&s.w>10&&s.z0<-18.96&&s.z1>-18.96);Object.assign(fixture,{x:wall.x0-.46,y:4.828444444444445,z:-18.969,yaw:Math.PI/2});}
 check(fixture.name+' uses a legal collision-clear actor stance',world.canWalk(fixture,fixture));
 for(let id=0;id<4;id++)for(const pitch of [0,.7,-.7]){
  Object.assign(actor,{x:fixture.x,y:fixture.y,z:fixture.z,yaw:fixture.yaw,crouched:!!fixture.crouched,stance:fixture.crouched?'crouch':'standing',gunPitch:pitch,vx:0,vz:0,worldWeaponScale:1,weaponPoseAt:0});actor.equipment[1]={id,ammo:30,reserve:90};poseBean(actor,.016,true,world);actor.group.updateMatrixWorld(true);
  const visual=actor.weaponVisuals.get(id),bounds=new THREE.Box3().setFromObject(visual.group),gunVolume={x0:bounds.min.x,x1:bounds.max.x,y0:bounds.min.y,y1:bounds.max.y,z0:bounds.min.z,z1:bounds.max.z},muzzle=actor.muzzle.getWorldPosition(new THREE.Vector3());
  check(fixture.name+' '+id+' '+pitch+' entire GLB stays in front of wall',!overlapsVolume(gunVolume,wall));
  check(fixture.name+' '+id+' '+pitch+' visible barrel and actual muzzle share transform',muzzle.distanceTo(visual.muzzle.getWorldPosition(new THREE.Vector3()))<1e-8);
  check(fixture.name+' '+id+' '+pitch+' retraction is applied to the complete model',actor.gun.scale.x<1&&actor.gun.scale.x===actor.gun.scale.y&&actor.gun.scale.x===actor.gun.scale.z&&Math.abs(actor.gun.position.x-.39*actor.worldWeaponScale)<1e-9);
  const previous=actor.worldWeaponScale;poseBean(actor,.032,true);check('combat pose reuses the cached world instead of extending through it',actor.worldWeaponScale<=previous+1e-6);
  updateBeanDisplay(actor,camera,world,.032);check('hands shorten with the compact gun and remain finite',actor.arms.every(a=>Number.isFinite(a.scale.y)&&a.scale.y>0&&Number.isFinite(a.quaternion.w)));
  Object.assign(actor,world.spawns.attack[0],{crouched:false,stance:'standing',gunPitch:0});const before=actor.worldWeaponScale;poseBean(actor,.048,true,world);check('wall departure recovers progressively',actor.worldWeaponScale>before&&actor.worldWeaponScale<1);for(let i=1;i<100;i++)poseBean(actor,.048+i/60,true,world);check('free-space weapon restores original size',actor.worldWeaponScale>.999);
 }
 if(fixture.door){Object.assign(actor,fixture,{worldWeaponScale:1,weaponPoseAt:0,crouched:false,gunPitch:0});poseBean(actor,0,true,world);const closed=actor.worldWeaponScale;world.toggleDoor(wall.id);poseBean(actor,.1,true,world);check('opening the real door releases weapon obstruction smoothly',actor.worldWeaponScale>closed&&actor.worldWeaponScale<1);}
}
// Combat must use this same compact muzzle and keep the hidden target blocked.
world.loadMap('assault');Object.assign(actor,{x:-10.456,y:0,z:-8.795,yaw:Math.PI/2,crouched:false,stance:'standing',gunPitch:0,worldWeaponScale:1,weaponPoseAt:0});actor.equipment=[{id:0,ammo:12,reserve:60},{id:3,ammo:5,reserve:20}];actor.slot=1;poseBean(actor,0,true,world);
const enemy={id:8,team:1,x:-8,y:0,z:-8.795,hp:100,maxHp:100,alive:true,group:new THREE.Group(),color:0xff00ff},combat=createCombat({g,world,player:actor,actors:[actor,enemy],getTime:()=>0});combat.resetActor(actor,true);check('AI fires without damaging an opponent beyond the wall',combat.fire(actor)&&enemy.hp===100);const muzzle=actor.muzzle.getWorldPosition(new THREE.Vector3()),trace=combat.traces[0].mesh.geometry.attributes.position.array;check('combat trace starts at the compact visible muzzle',Math.hypot(trace[0]-muzzle.x,trace[1]-muzzle.y,trace[2]-muzzle.z)<1e-6);combat.clearEffects();disposeBean(actor);world.dispose();unit.dispose();sphere.dispose();material.dispose();
console.log(`PASS ${checks} four licensed world guns / thin thick door duct walls / recovery / hands / muzzle combat checks`);
