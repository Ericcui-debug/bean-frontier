import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Bake per-object texture repetition into UVs before merging. Leaving the
// per-dimension material uniforms in place would silently stretch brickwork.
export function batchStaticChunks(root,{dynamicGroups=[],chunkSize=16}={}){
 root.updateMatrixWorld(true);
 const inverse=root.matrixWorld.clone().invert(),matrix=new THREE.Matrix4(),center=new THREE.Vector3(),buckets=new Map(),materials=new Map(),geometries=[],meshes=[],sources=[];
 const dynamic=new Set(dynamicGroups);
 root.traverse(source=>{
  if(!source.isMesh||source.isInstancedMesh||Array.isArray(source.material)||source.material.transparent||!source.visible)return;
  for(let ancestor=source;ancestor&&ancestor!==root;ancestor=ancestor.parent)if(dynamic.has(ancestor))return;
  source.getWorldPosition(center);center.applyMatrix4(inverse);
  const original=source.material,key=[original.type,original.map?.uuid,original.color?.getHex(),original.roughness,original.metalness,original.side,original.alphaTest,original.depthTest,original.depthWrite,original.emissive?.getHex(),original.emissiveIntensity,original.normalMap?.uuid,original.vertexColors].join(':');
  const surface=original.userData?.repeat;
  // Non-surface custom shaders cannot be baked generically; retain them.
  if(!surface&&original.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile)return;
  if(!materials.has(key)){const copy=original.clone();copy.onBeforeCompile=()=>{};copy.customProgramCacheKey=()=> 'bean-baked-static-v1';materials.set(key,copy);}
  const bucketKey=[Math.floor(center.x/chunkSize),Math.floor(center.z/chunkSize),key,source.castShadow,source.receiveShadow].join('|');
  if(!buckets.has(bucketKey))buckets.set(bucketKey,{material:materials.get(key),castShadow:source.castShadow,receiveShadow:source.receiveShadow,parts:[],sources:[]});
  const bucket=buckets.get(bucketKey),geometry=source.geometry.index?source.geometry.toNonIndexed():source.geometry.clone(),uv=geometry.getAttribute('uv'),normals=geometry.getAttribute('normal');
  if(surface&&uv&&normals)for(let index=0;index<uv.count;index++){const nx=Math.abs(normals.getX(index)),ny=Math.abs(normals.getY(index));uv.setXY(index,uv.getX(index)*(ny>.5?surface.x:nx>.5?surface.z:surface.x),uv.getY(index)*(ny>.5?surface.z:surface.y));}
  matrix.multiplyMatrices(inverse,source.matrixWorld);geometry.applyMatrix4(matrix);bucket.parts.push(geometry);bucket.sources.push(source);sources.push(source);
 });
 for(const [key,bucket] of buckets){
  const geometry=mergeGeometries(bucket.parts,false);for(const part of bucket.parts)part.dispose();
  if(!geometry)throw new Error('Incompatible static geometry: '+key);
  geometry.computeBoundingSphere();geometry.computeBoundingBox();geometries.push(geometry);
  const mesh=new THREE.Mesh(geometry,bucket.material);mesh.name='map-chunk:'+key.split('|').slice(0,2).join(',');mesh.castShadow=bucket.castShadow;mesh.receiveShadow=bucket.receiveShadow;root.add(mesh);meshes.push(mesh);
  for(const source of bucket.sources)source.removeFromParent();
 }
 return {geometries,materials:[...materials.values()],meshes,metrics:{chunkSize,sourceMeshes:sources.length,drawBatches:meshes.length},dispose(){for(const mesh of meshes)mesh.removeFromParent();for(const geometry of geometries)geometry.dispose();for(const material of materials.values())material.dispose();}};
}
