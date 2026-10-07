import * as THREE from 'three';
import {createWorld} from '../src/world.js';
import {createGame} from '../src/game.js';
globalThis.window={};globalThis.document={pointerLockElement:null};
export function setup(freeze=true){const scene=new THREE.Scene(),mat=c=>new THREE.MeshBasicMaterial({color:c}),mesh=(geo,c,parent=scene)=>{const m=new THREE.Mesh(geo,mat(c));parent.add(m);return m;};
 const box=(x,y,z,w,h,d,c,parent=scene)=>{const m=mesh(new THREE.BoxGeometry(w,h,d),c,parent);m.position.set(x,y,z);return m;};
 const cylinder=(x,y,z,r,h,c,parent=scene)=>{const m=mesh(new THREE.CylinderGeometry(r,r,h),c,parent);m.position.set(x,y,z);return m;};
 const ball=(x,y,z,sx,sy,sz,c,parent=scene)=>{const m=mesh(new THREE.SphereGeometry(1,8,8),c,parent);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;};
 const label=(text,x,y,z)=>{const s=new THREE.Sprite();s.position.set(x,y,z);scene.add(s);return s;};
 const g={scene,mat,mesh,box,cylinder,ball,label,camera:new THREE.PerspectiveCamera(72,1,.05,200)},world=createWorld(g),game=createGame(g,world),controls={x:0,z:0,fire:false,aim:false,interactHeld:false};
 game.bindInput({sample:()=>controls,reset(){controls.x=controls.z=0;controls.fire=controls.aim=controls.interactHeld=false;},state:controls});if(freeze)game.ai.update=()=>{};return {game,controls,world};}
