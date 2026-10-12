import * as THREE from 'three';
import {makeCrateTexture,makeMetalTexture} from './tinystrike-textures.js';

import {makeArchitecturalTexture} from './architectural-textures.js';
import {projectWorldUV} from './world-uv.js';

// Original local wood planks for architectural doors. Supply-crate stencils
// belong to crates; no remote image or new licensed asset is introduced.
function makeWoodPlanks(base){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,512,512);
 for(let plank=0;plank<8;plank++){const x=plank*64;ctx.fillStyle=`rgba(24,13,5,${.035+(plank%3)*.025})`;ctx.fillRect(x,0,64,512);ctx.fillStyle='rgba(30,19,9,.5)';ctx.fillRect(x,0,2,512);ctx.fillStyle='rgba(255,230,185,.16)';ctx.fillRect(x+2,0,2,512);
  for(let line=0;line<7;line++){ctx.strokeStyle=`rgba(40,25,12,${.07+(line%3)*.035})`;ctx.lineWidth=.8;ctx.beginPath();for(let y=0;y<=512;y+=8){const px=x+7+line*8+Math.sin(y/53+plank*3+line)*1.8+Math.sin(y/19+line)*.5;y?ctx.lineTo(px,y):ctx.moveTo(px,y);}ctx.stroke();}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

// Local architectural materials plus the ISC wood-crate/metal generators.
// Metre-based geometry UVs work identically before and after batching.
export function createSurfaceLibrary({mobile=false}={}){
 const images=new Map(),materials=new Map();
 const palette={wall:0xb8b2a7,plaster:0xd3b58a,brick:0xa96950,concrete:0x9fa6a6,steel:0x6c777d,metal:0x6c777d,crate:0xbaa27b,sand:0xc4af88,stone:0xb4b0a4,wood:0xa88765};
 function surface(kind='plaster',color=palette[kind]??palette.plaster,w=4,h=4,d=w){
  kind=kind in palette?kind:'plaster';color=color??palette[kind];const imageKey=kind==='crate'?'original-crate':kind+':'+color,tileMeters={brick:1.6,steel:1.5,metal:1.5,sand:2,stone:2,wood:1.5,crate:2}[kind]??3,key=kind+':'+imageKey;
  if(materials.has(key))return materials.get(key);
  if(!images.has(imageKey)){const base='#'+new THREE.Color(color).getHexString();let texture;
   if(kind==='steel'||kind==='metal')texture=makeMetalTexture({base});
   else if(kind==='crate')texture=makeCrateTexture();
   else if(kind==='wood')texture=makeWoodPlanks(base);
   else texture=makeArchitecturalTexture(kind,base);
   texture.name=(['metal','steel','crate'].includes(kind)?'TinyStrike ':'Bean architectural ')+imageKey;images.set(imageKey,texture);
  }
  const metallic=kind==='steel'||kind==='metal';
  const texture=images.get(imageKey),mat=new THREE.MeshStandardMaterial({map:texture,bumpMap:mobile?null:texture,bumpScale:metallic?.007:kind==='brick'?.012:.006,color:0xffffff,roughness:metallic?.72:.97,metalness:metallic?.15:0});
  mat.name='Bean '+kind;mat.userData.surface=kind;mat.userData.tileMeters=tileMeters;
  materials.set(key,mat);return mat;
 }
 function decorateSurface(mesh,kind,color){mesh.material=surface(kind,color);projectWorldUV(mesh);mesh.userData.surface=kind;return mesh;}

 function dispose(){for(const m of materials.values())m.dispose();for(const t of images.values())t.dispose();materials.clear();images.clear();}
 return {surface,decorateSurface,dispose,materials,images};
}
