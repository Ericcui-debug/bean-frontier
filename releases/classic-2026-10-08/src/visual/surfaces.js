import * as THREE from 'three';
import {makeWallTexture,makeFloorTexture,makeCrateTexture,makeMetalTexture} from './tinystrike-textures.js';

// Reuse the original ISC canvas textures through Three's stock StandardMaterial.
// Only UV repetition is added; no extra render passes or GPU material pipeline.
export function createSurfaceLibrary(){
 const images=new Map(),materials=new Map();
 const palette={wall:0xb8b2a7,plaster:0xd3b58a,brick:0xa96950,concrete:0x9fa6a6,steel:0x6c777d,metal:0x6c777d,crate:0xbaa27b,sand:0xc4af88,stone:0xb4b0a4,wood:0xa88765};
 function surface(kind='plaster',color=palette[kind]??palette.plaster,w=4,h=4,d=w){
  kind=kind in palette?kind:'plaster';color=color??palette[kind];const imageKey=kind==='crate'||kind==='wood'?'original-crate':kind+':'+color,repeat=new THREE.Vector3(Math.max(.12,w/4),Math.max(.12,h/4),Math.max(.12,d/4)),key=kind+':'+imageKey+':'+repeat.toArray().join(':');
  if(materials.has(key))return materials.get(key);
  if(!images.has(imageKey)){const base='#'+new THREE.Color(color).getHexString();let texture;
   if(kind==='steel'||kind==='metal')texture=makeMetalTexture({base});
   else if(kind==='crate'||kind==='wood')texture=makeCrateTexture();
   else if(kind==='concrete'||kind==='sand'||kind==='stone')texture=makeFloorTexture({base});
   else texture=makeWallTexture({base,accent:kind==='brick'?'#91634c':base});
   texture.name='TinyStrike '+imageKey;images.set(imageKey,texture);
  }
  const metallic=kind==='steel'||kind==='metal';
  const mat=new THREE.MeshStandardMaterial({map:images.get(imageKey),color:0xffffff,roughness:metallic?.58:.9,metalness:metallic?.34:0});
  mat.name='Bean '+kind;mat.userData.surface=kind;mat.userData.repeat=repeat;
  mat.onBeforeCompile=shader=>{shader.uniforms.surfaceRepeat={value:repeat};shader.vertexShader='uniform vec3 surfaceRepeat;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvec3 surfaceFace=abs(normal);\nvec2 faceRepeat=surfaceFace.y>.5?surfaceRepeat.xz:surfaceFace.x>.5?surfaceRepeat.zy:surfaceRepeat.xy;\nvMapUv *= faceRepeat;\n#endif');};
  mat.customProgramCacheKey=()=> 'bean-surface-repeat-v1';materials.set(key,mat);return mat;
 }
 function decorateSurface(mesh,kind,color,w,h){mesh.geometry.computeBoundingBox();const size=mesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiply(mesh.scale);mesh.material=surface(kind,color,Math.abs(size.x),Math.abs(size.y),Math.abs(size.z));mesh.userData.surface=kind;return mesh;}
 function dispose(){for(const m of materials.values())m.dispose();for(const t of images.values())t.dispose();materials.clear();images.clear();}
 return {surface,decorateSurface,dispose,materials,images};
}
