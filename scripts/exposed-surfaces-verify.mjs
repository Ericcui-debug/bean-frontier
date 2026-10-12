import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {MAPS} from '../src/maps.js';
import {mapShapes,shapeFor} from '../src/map-geometry.js';
import {exposedBoxFaces,exposedBoxGeometry,replaceExposedBoxMeshes} from '../src/visual/exposed-surfaces.js';
import {projectWorldUV} from '../src/visual/world-uv.js';
let checks=0;const check=(name,pass)=>{assert.ok(pass,name);checks++;};
const area=face=>(face.x1-face.x0)*(face.z1-face.z0),overlap=(a,b)=>Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)>1e-5&&Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0)>1e-5;
const floor=shapeFor({x:0,z:0,y:0,w:8,d:6,h:2,type:'deck'}),stone=shapeFor({x:0,z:0,y:1,w:4,d:2,h:1,type:'deck'}),wall=shapeFor({x:3,z:0,y:2,w:2,d:6,h:3,type:'wall'}),ramp=shapeFor({x:-3,z:0,y:2,w:2,d:6,rise:3,type:'ramp',direction:'south'}),door=shapeFor({x:0,z:0,y:2,w:1,d:1,h:2,type:'door'});
const fixtures=[floor,stone,wall,ramp,door],original=JSON.stringify(fixtures),plan=exposedBoxFaces(fixtures);
check('planning leaves collision dimensions and active flags byte-identical',JSON.stringify(fixtures)===original);
check('ramp and interactive door remain complete independent render objects',!plan.has(ramp)&&!plan.has(door));
const top=plan.get(floor).filter(f=>f.axis==='y'&&f.sign===1),stoneTop=plan.get(stone).filter(f=>f.axis==='y'&&f.sign===1);
check('later coplanar architectural slab owns the shared visible region',Math.abs(top.reduce((a,f)=>a+area(f),0)-28)<1e-6&&stoneTop.reduce((a,f)=>a+area(f),0)===8);
check('solid wall touching ground hides its internal supporting patch',top.every(f=>!overlap(f,{x0:2,x1:4,z0:-3,z1:3})));
// A roof adjoining a wall must keep its top while removing both internal sides.
const left=shapeFor({x:-1,z:0,y:0,w:2,d:2,h:2,type:'wall'}),right=shapeFor({x:1,z:0,y:0,w:2,d:2,h:2,type:'wall'}),adjacent=exposedBoxFaces([left,right]);
check('opposite contacting internal faces are removed on both sides',!adjacent.get(left).some(f=>f.axis==='x'&&f.sign===1)&&!adjacent.get(right).some(f=>f.axis==='x'&&f.sign===-1));
const hangingWall=shapeFor({x:0,z:0,y:2.4,w:2,d:2,h:3,type:'wall'}),raisedRamp=shapeFor({x:0,z:0,y:2.4,w:6,d:6,rise:2,type:'ramp',direction:'south'}),rampPlan=exposedBoxFaces([hangingWall,raisedRamp]);
check('exact closed-ramp bottom owns coincident wall underside',!rampPlan.get(hangingWall).some(f=>f.axis==='y'&&f.sign===-1)&&!rampPlan.has(raisedRamp));
check('ramp bounding volume never crops vertical box sides',Math.abs(rampPlan.get(hangingWall).filter(f=>f.axis==='x'&&f.sign===1).reduce((a,f)=>a+area(f),0)-6)<1e-6);
const unit=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial();material.userData.tileMeters=2;const scene=new THREE.Scene(),owned=[];let sharedDisposed=0;unit.addEventListener('dispose',()=>sharedDisposed++);
for(const box of [floor,stone,wall]){box.group=new THREE.Group();box.group.position.set((box.x0+box.x1)/2,box.y0,(box.z0+box.z1)/2);scene.add(box.group);const mesh=new THREE.Mesh(unit,material);mesh.position.y=(box.y1-box.y0)/2;mesh.scale.set(box.x1-box.x0,box.y1-box.y0,box.z1-box.z0);box.group.add(mesh);}
replaceExposedBoxMeshes([floor,stone,wall],{ownGeometry:g=>(owned.push(g),g),projectUV:(mesh,tile)=>projectWorldUV(mesh,tile,{clone:false})});scene.updateMatrixWorld(true);
check('render clipping never disposes lifetime shared unit cube',sharedDisposed===0&&owned.length===3);
for(const box of [floor,stone,wall]){const mesh=box.group.children[0],pos=mesh.geometry.getAttribute('position'),normal=mesh.geometry.getAttribute('normal'),uv=mesh.geometry.getAttribute('uv');check('every clipped vertex carries a normal and UV',pos.count===normal.count&&uv.count===pos.count);for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2),n=new THREE.Vector3().fromBufferAttribute(normal,i);check('clipped faces retain front-face winding',b.sub(a).cross(c.sub(a)).dot(n)>0);}for(let i=0;i<pos.count;i++){const p=new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld),n=new THREE.Vector3().fromBufferAttribute(normal,i),u=Math.abs(n.y)>.5?p.x:Math.abs(n.x)>.5?p.z:p.x,v=Math.abs(n.y)>.5?p.z:p.y;check('UV uses uninterrupted world metres after clipping',Math.abs(uv.getX(i)-u/2)<1e-6&&Math.abs(uv.getY(i)-v/2)<1e-6);}}
let released=0;for(const g of owned){g.addEventListener('dispose',()=>released++);g.dispose();}check('map ownership can release every new clipped buffer exactly once',released===owned.length&&sharedDisposed===0);
const reports=[];
for(const map of MAPS){const shapes=mapShapes(map),signature=JSON.stringify(shapes),faces=exposedBoxFaces(shapes),flat=[...faces.values()].flat();let duplicates=0;for(let i=0;i<flat.length;i++)for(let j=i+1;j<flat.length;j++){const a=flat[i],b=flat[j];if(a.axis===b.axis&&a.sign===b.sign&&Math.abs(a.plane-b.plane)<1e-6&&overlap(a,b))duplicates++;}check(map.id+' has zero duplicate outward planar regions after clipping',duplicates===0);check(map.id+' collision and baked definitions are unchanged',JSON.stringify(shapes)===signature);check(map.id+' trimmed surfaces retain finite valid UV geometry',[...faces].every(([s,f])=>{if(!f.length)return true;const g=exposedBoxGeometry(s,f),valid=Array.from(g.getAttribute('position').array).every(Number.isFinite)&&Array.from(g.getAttribute('uv').array).every(Number.isFinite);g.dispose();return valid;}));reports.push({map:map.id,boxes:faces.size,faceRectangles:flat.length,triangles:flat.length*2,duplicateRegions:duplicates});}
fs.mkdirSync('output/surface-audit',{recursive:true});fs.writeFileSync('output/surface-audit/exposed-verify.json',JSON.stringify({checks,reports},null,2));console.log('PASS '+checks+' exposed surface clipping / world UV / immutable collision / resource ownership checks');console.log(JSON.stringify(reports));
