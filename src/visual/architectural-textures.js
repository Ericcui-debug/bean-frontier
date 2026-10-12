import * as THREE from 'three';
const SIZE=512;
function hash(x,y,seed){let v=Math.imul(x+seed,374761393)^Math.imul(y+seed,668265263);v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967295;}
const wrap=(n,d)=>(n%d+d)%d;
function noise(x,y,grid,seed){const px=x/SIZE*grid,py=y/SIZE*grid,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);const a=hash(wrap(ix,grid),wrap(iy,grid),seed),b=hash(wrap(ix+1,grid),wrap(iy,grid),seed),c=hash(wrap(ix,grid),wrap(iy+1,grid),seed),d=hash(wrap(ix+1,grid),wrap(iy+1,grid),seed);return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;}
const fields=new Map();
function variation(kind){const key=kind==='sand'?'sand':'mineral';if(fields.has(key))return fields.get(key);const field=new Float32Array(SIZE*SIZE);for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)field[y*SIZE+x]=key==='sand'?(noise(x,y,8,29)-.5)*5+(hash(x,y,113)-.5)*8:(noise(x,y,4,71)-.5)*7+(noise(x,y,16,103)-.5)*3+(hash(x,y,29)-.5)*5;fields.set(key,field);return field;}
// Small mineral/grit variation rather than repeated metre-long marble veins.
// All noise wraps at the tile boundary; joints have a consistent real scale.
export function makeArchitecturalTexture(kind,base){
 const c=document.createElement('canvas');c.width=c.height=SIZE;const ctx=c.getContext('2d'),data=ctx.createImageData(SIZE,SIZE),rgb=[1,3,5].map(i=>parseInt(base.slice(i,i+2),16));
 const field=variation(kind);
 const masonry=kind==='brick'||kind==='stone',rows=kind==='brick'?8:4,brickH=SIZE/rows,brickW=kind==='brick'?128:256;
 for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
  let delta=field[y*SIZE+x];
  if(masonry){const row=Math.floor(y/brickH),offset=(row%2)*brickW/2,bx=wrap(x+offset,brickW),by=y%brickH,col=Math.floor((x+offset)/brickW);delta+=(hash(wrap(col,SIZE/brickW),row,97)-.5)*(kind==='brick'?17:11);const joint=kind==='brick'?2:1.5;
   if(bx<joint||by<joint)delta=kind==='brick'?-29:-18;else if(bx<joint+1||by<joint+1)delta+=5;
  }else if(kind==='plaster'||kind==='wall')delta*=.65;
  const grain=hash(x,y,137);if(grain>.9985)delta-=kind==='concrete'?18:8;
  const i=(y*SIZE+x)*4;for(let k=0;k<3;k++)data.data[i+k]=Math.max(0,Math.min(255,rgb[k]+delta));data.data[i+3]=255;
 }
 ctx.putImageData(data,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;t.name='Bean architectural '+kind;t.userData={kind,procedural:true,seamless:true};return t;
}
