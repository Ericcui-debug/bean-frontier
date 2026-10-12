import * as THREE from 'three';
import {subtractRect} from './decoration-geometry.js';
const EPS=1e-6;
export const isStaticBox=s=>s.active!==false&&s.shape!=='ramp'&&s.type!=='ramp'&&!s.dynamic&&!['door','grille'].includes(s.type);
// Collision solids stay intact. Only rendered planar faces are partitioned.
// Later definitions own coincident outward faces: architectural decks/roofs
// retain their materials over the earlier broad ground or wall solids.
export function exposedBoxFaces(solids){
 const boxes=solids.filter(isStaticBox),ramps=solids.filter(s=>s.active!==false&&s.shape==='ramp'&&!s.dynamic),result=new Map();
 for(let index=0;index<boxes.length;index++){
  const box=boxes[index],faces=[];
  for(const axis of ['x','y','z'])for(const sign of [-1,1]){
   const [u,v]=['x','y','z'].filter(k=>k!==axis),plane=box[axis+(sign>0?'1':'0')];
   let pieces=[{x0:box[u+'0'],x1:box[u+'1'],z0:box[v+'0'],z1:box[v+'1']}];
   for(let otherIndex=0;otherIndex<boxes.length&&pieces.length;otherIndex++){
    if(index===otherIndex)continue;const other=boxes[otherIndex],outward=plane+sign*EPS*2;
    const coversOutside=other[axis+'0']<outward&&other[axis+'1']>outward;
    const sameFace=Math.abs(other[axis+(sign>0?'1':'0')]-plane)<EPS&&otherIndex>index;
    if(!coversOutside&&!sameFace)continue;
    const mask={x0:other[u+'0'],x1:other[u+'1'],z0:other[v+'0'],z1:other[v+'1']};
    pieces=pieces.flatMap(piece=>subtractRect(piece,mask));
   }
   // A closed ramp's flat underside is an exact rectangle, unlike its
   // sloped roof and triangular sidewalls. Preserve the whole ramp mesh and
   // let that known bottom face own only coincident box undersides.
   if(axis==='y'&&sign===-1)for(const ramp of ramps){
    if(Math.abs(ramp.y0-plane)>EPS)continue;
    pieces=pieces.flatMap(piece=>subtractRect(piece,{x0:ramp.x0,x1:ramp.x1,z0:ramp.z0,z1:ramp.z1}));
   }
   for(const rect of pieces)faces.push({axis,sign,plane,u,v,...rect});
  }
  result.set(box,faces);
 }
 return result;
}
export function exposedBoxGeometry(box,faces,tileMeters=4){
 const positions=[],normals=[],uv=[],center={x:(box.x0+box.x1)/2,y:box.y0,z:(box.z0+box.z1)/2};
 for(const face of faces){
  const points=[[face.x0,face.z0],[face.x1,face.z0],[face.x1,face.z1],[face.x0,face.z1]].map(([u,v])=>({[face.axis]:face.plane,[face.u]:u,[face.v]:v}));
  const naturalSign=face.axis==='y'?-1:1,indices=naturalSign===face.sign?[0,1,2,0,2,3]:[0,2,1,0,3,2];
  for(const index of indices){const p=points[index];positions.push(p.x-center.x,p.y-center.y,p.z-center.z);normals.push(face.axis==='x'?face.sign:0,face.axis==='y'?face.sign:0,face.axis==='z'?face.sign:0);
   if(face.axis==='y')uv.push(p.x/tileMeters,p.z/tileMeters);else if(face.axis==='x')uv.push(p.z/tileMeters,p.y/tileMeters);else uv.push(p.x/tileMeters,p.y/tileMeters);
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
export function replaceExposedBoxMeshes(solids,{ownGeometry=g=>g,projectUV=null}={}){
 const plan=exposedBoxFaces(solids);let hidden=0,triangles=0;
 for(const [box,faces]of plan){const mesh=box.group?.children.find(o=>o.isMesh&&!o.isInstancedMesh);if(!mesh)continue;
  if(!faces.length){mesh.visible=false;hidden++;continue;}
  // Each authored box group is a translation to its x/y0/z origin. Shared
  // unit-cube buffers remain owned by graphics and must never be disposed here.
  mesh.geometry=ownGeometry(exposedBoxGeometry(box,faces,mesh.material.userData?.tileMeters??4));mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);
  mesh.userData.exposedSurface=true;if(projectUV)projectUV(mesh,mesh.material.userData?.tileMeters??4);triangles+=faces.length*2;
 }
 return {boxes:plan.size,hidden,triangles};
}
