import * as THREE from 'three';
// Continuous metre-based projection across adjacent slabs, ramps and wall
// segments. Geometry is private; the shared unit cube must remain unchanged.
export function projectWorldUV(mesh,tileMeters=mesh.material.userData.tileMeters,{clone=true}={}){
 mesh.updateWorldMatrix(true,false);if(clone)mesh.geometry=mesh.geometry.clone();
 const positions=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal'),values=new Float32Array(positions.count*2),point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
 for(let i=0;i<positions.count;i++){
  point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);normal.fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize();
  const nx=Math.abs(normal.x),ny=Math.abs(normal.y),nz=Math.abs(normal.z);let u,v;
  if(ny>=nx&&ny>=nz){u=point.x;v=point.z;}else if(nx>=nz){u=point.z;v=point.y;}else{u=point.x;v=point.y;}
  values[i*2]=u/tileMeters;values[i*2+1]=v/tileMeters;
 }
 mesh.geometry.setAttribute('uv',new THREE.BufferAttribute(values,2));mesh.userData.worldUV=true;return mesh.geometry;
}
