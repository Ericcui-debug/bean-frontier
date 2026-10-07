import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../src/world.js';
import {moveActor} from '../src/physics.js';
const scene=new THREE.Scene(),mat=c=>new THREE.MeshBasicMaterial({color:c});const mesh=(geo,c,parent=scene)=>{const m=new THREE.Mesh(geo,mat(c));parent.add(m);return m;};
const box=(x,y,z,w,h,d,c,parent=scene)=>{const m=mesh(new THREE.BoxGeometry(w,h,d),c,parent);m.position.set(x,y,z);return m;};const cylinder=(x,y,z,r,h,c)=>{const m=mesh(new THREE.CylinderGeometry(r,r,h),c);m.position.set(x,y,z);return m;};const ball=(x,y,z,sx,sy,sz,c)=>{const m=mesh(new THREE.SphereGeometry(1),c);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;};const label=(text,x,y,z)=>{const s=new THREE.Sprite();s.position.set(x,y,z);scene.add(s);return s;};
const world=createWorld({scene,mesh,box,cylinder,ball,label}),checks=[];
function check(name,pass){assert.ok(pass,name);checks.push(name);}
check('ten spawn points on walkable terrain',Object.values(world.spawns).flat().every(p=>world.walkable(p.x,p.z)!==null));
check('no direct spawn to spawn firing lane',world.spawns.attack.every(a=>world.spawns.defend.every(b=>world.blocked({...a,y:a.y+1.62},{...b,y:b.y+1.62}))));
for(const role of ['attack','defend'])for(const spawn of world.spawns[role])for(const site of world.sites){const path=world.path(spawn,site);check(`${role} spawn ${spawn.x} to ${site.id} connected`,path.length>0);let from=spawn;for(const point of path){check('every path edge respects actor clearance',world.canWalk(from,point));from=point;}}
for(const site of world.sites)for(const point of [{x:site.x,y:0,z:site.z+4},{x:site.x+(site.x<0?-6:6),y:0,z:site.z+3}])check(`${site.id} multiple site approaches`,world.path(point,site).length>0);
for(const fps of [15,30,60]){const actor={x:0,y:0,z:20,vx:0,vz:-40,vy:0,grounded:true,radius:.53,height:1.94};for(let i=0;i<fps;i++)moveActor(actor,1/fps,world);check(`actor cannot tunnel through spawn wall at ${fps} FPS`,actor.z>=14.5);}
console.log(`PASS ${checks.length} tactical map / path / collision checks`);
