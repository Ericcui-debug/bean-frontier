import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {MAPS} from '../src/maps.js';
import {mapShapes,shapeTriangles,shapeFor} from '../src/map-geometry.js';
import {segmentSolid} from '../src/physics.js';
import {exposedBoxFaces,exposedBoxGeometry} from '../src/visual/exposed-surfaces.js';
import {projectWorldUV} from '../src/visual/world-uv.js';
let checks=0;const check=(name,pass)=>{assert.ok(pass,name);checks++;};
let seed=9417;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const point=new THREE.Vector3(),normal=new THREE.Vector3(),ray=new THREE.Raycaster(),reports=[];
for(const map of MAPS){
 const shapes=mapShapes(map,{dynamic:false}),original=JSON.stringify(shapes),plan=exposedBoxFaces(shapes),scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),owned=[];
 for(const solid of shapes){let geometry;if(solid.shape==='ramp'){geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(shapeTriangles(solid),3));geometry.computeVertexNormals();}else{const faces=plan.get(solid);if(!faces?.length)continue;geometry=exposedBoxGeometry(solid,faces,2);}
  const mesh=new THREE.Mesh(geometry,material);if(solid.shape!=='ramp')mesh.position.set((solid.x0+solid.x1)/2,solid.y0,(solid.z0+solid.z1)/2);scene.add(mesh);owned.push(geometry);
  projectWorldUV(mesh,2,{clone:false});const pos=geometry.getAttribute('position'),norm=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');mesh.updateWorldMatrix(true,false);
  for(let i=0;i<pos.count;i++){point.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);normal.fromBufferAttribute(norm,i);const [nx,ny,nz]=[Math.abs(normal.x),Math.abs(normal.y),Math.abs(normal.z)];const expected=ny>=nx&&ny>=nz?[point.x,point.z]:nx>=nz?[point.z,point.y]:[point.x,point.y];check(map.id+' UV finite and metre-correct',Number.isFinite(uv.getX(i))&&Number.isFinite(uv.getY(i))&&Math.abs(uv.getX(i)-expected[0]/2)<1e-5&&Math.abs(uv.getY(i)-expected[1]/2)<1e-5);}
 }
 scene.updateMatrixWorld(true);let exteriorRays=0;
 for(let attempt=0;attempt<4000&&exteriorRays<1000;attempt++){
  const b=map.bounds,a={x:b.x0+random()*(b.x1-b.x0),y:.08+random()*17,z:b.z0+random()*(b.z1-b.z0)},target={x:b.x0+random()*(b.x1-b.x0),y:.08+random()*17,z:b.z0+random()*(b.z1-b.z0)};
  if(shapes.some(s=>segmentSolid(a,a,s)))continue;
  let closest=null;for(const s of shapes){const hit=segmentSolid(a,target,s);if(hit&&(!closest||hit.t<closest.t))closest=hit;}
  const start=new THREE.Vector3(a.x,a.y,a.z),end=new THREE.Vector3(target.x,target.y,target.z),length=start.distanceTo(end);ray.set(start,end.sub(start).normalize());ray.near=0;ray.far=length;const actual=ray.intersectObjects(scene.children,false)[0];
  check(map.id+' clipped rendered terrain preserves first collision boundary',(closest===null&&!actual)||(closest&&actual&&Math.abs(actual.distance/length-closest.t)<2e-5));exteriorRays++;
 }
 check(map.id+' 1000 actual external rays covered',exteriorRays===1000);check(map.id+' source collision byte identity',JSON.stringify(shapes)===original);reports.push({map:map.id,exteriorRays,meshes:scene.children.length,vertices:owned.reduce((n,g)=>n+g.getAttribute('position').count,0)});owned.forEach(g=>g.dispose());material.dispose();
}
// Translation/nonuniform scales must project using inverse-transpose normals;
// otherwise ramp/wall classification changes and stretches the masonry.
const geometry=new THREE.BoxGeometry(1,1,1),before=geometry.getAttribute('uv').array.slice(),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.position.set(11,3,-9);mesh.rotation.z=.2;mesh.scale.set(4,2,3);projectWorldUV(mesh,1.6);check('projection isolates lifetime shared primitive',mesh.geometry!==geometry&&before.every((v,i)=>v===geometry.getAttribute('uv').array[i]));mesh.geometry.dispose();geometry.dispose();mesh.material.dispose();
fs.mkdirSync('output/surface-final-review',{recursive:true});fs.writeFileSync('output/surface-final-review/pure-report.json',JSON.stringify({checks,reports},null,2));console.log('PASS '+checks+' independent render/collision boundary, terrain UV and shared-buffer checks');console.log(JSON.stringify(reports));
