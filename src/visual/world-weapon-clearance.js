import * as THREE from 'three';
import {rampHeight} from '../physics.js';
const box=new THREE.Box3(),inverse=new THREE.Matrix4(),transform=new THREE.Matrix4(),point=new THREE.Vector3();
// Geometry is shared or instanced; source meshes may be hidden by the batcher.
// Compute bounds from their buffers rather than their render visibility.
export function localWeaponBounds(actor){
 const visual=actor.weaponVisuals?.get(actor.visualWeaponId),root=visual?.group||actor.fallbackGun,key=root.uuid;
 actor.weaponBounds??=new Map();if(actor.weaponBounds.has(key))return actor.weaponBounds.get(key);
 actor.gun.updateWorldMatrix(true,true);inverse.copy(actor.gun.matrixWorld).invert();const bounds=new THREE.Box3().makeEmpty();
 root.traverse(node=>{if(!node.isMesh)return;node.geometry.computeBoundingBox();transform.multiplyMatrices(inverse,node.matrixWorld);box.copy(node.geometry.boundingBox).applyMatrix4(transform);bounds.union(box);});
 bounds.expandByPoint(actor.muzzle.position);actor.weaponBounds.set(key,bounds);return bounds;
}
function sweptBounds(full,anchor,scale,pad){return {x0:Math.min(anchor.x,anchor.x+(full.min.x-anchor.x)*scale)-pad,x1:Math.max(anchor.x,anchor.x+(full.max.x-anchor.x)*scale)+pad,y0:Math.min(anchor.y,anchor.y+(full.min.y-anchor.y)*scale)-pad,y1:Math.max(anchor.y,anchor.y+(full.max.y-anchor.y)*scale)+pad,z0:Math.min(anchor.z,anchor.z+(full.min.z-anchor.z)*scale)-pad,z1:Math.max(anchor.z,anchor.z+(full.max.z-anchor.z)*scale)+pad};}
function overlap(a,s){if(a.x0>=s.x1||a.x1<=s.x0||a.y0>=s.y1||a.y1<=s.y0||a.z0>=s.z1||a.z1<=s.z0)return false;if(s.shape==='ramp'){const x0=Math.max(a.x0,s.x0),x1=Math.min(a.x1,s.x1),z0=Math.max(a.z0,s.z0),z1=Math.min(a.z1,s.z1),top=Math.max(rampHeight(s,x0,z0),rampHeight(s,x0,z1),rampHeight(s,x1,z0),rampHeight(s,x1,z1));if(a.y0>=top)return false;}return true;}
export function worldWeaponScale(actor,world,time){
 const bounds=localWeaponBounds(actor);actor.gun.updateWorldMatrix(true,false);const full=box.copy(bounds).applyMatrix4(actor.gun.matrixWorld),anchor=point.set(0,actor.gun.position.y,0).applyMatrix4(actor.gunRig.matrixWorld),pad=.025;
 // Include the entire path from the safe torso grip to the model, so a thin
 // wall still retracts a barrel whose tip is already on the wall's far side.
 const maximum=sweptBounds(full,anchor,1,pad),candidates=(world.solids||[]).filter(s=>s.active&&overlap(maximum,s));
 let safe=1;if(candidates.length){let lo=0,hi=1;for(let i=0;i<12;i++){const mid=(lo+hi)/2,bounds=sweptBounds(full,anchor,mid,pad);if(candidates.some(s=>overlap(bounds,s)))hi=mid;else lo=mid;}safe=Math.max(0,lo-.001);}
 const previous=actor.worldWeaponScale??1,dt=Math.max(0,Math.min(.1,time-(actor.weaponPoseAt??time)));actor.weaponPoseAt=time;
 // Approach is already continuous with clearance. Clamp immediately when a
 // turn or teleport reduces clearance; recover gently when the wall recedes.
 const scale=safe<previous?safe:Math.min(safe,previous+(1-previous)*(1-Math.exp(-dt*9)));actor.worldWeaponScale=scale;return scale;
}
