// Decoration is attached to existing solid faces. Horizontal details are
// clipped against real support, openings and occupiers instead of guessed Y.
import {shapeFor} from '../map-geometry.js';
import {clipToSupports,overlapsVolume} from './decoration-geometry.js';
export function createMapDecorationPlan(map){
 const plan=[],solids=map.terrain.map((s,index)=>({...shapeFor(s),index})),b=map.bounds;
 const ground={...b,y0:-2,y1:0,index:-1,type:'floor'};
 const surfaces=[ground,...solids.filter(s=>['deck','roof','step'].includes(s.type))];
 const box=(x,y,z,w,h,d,color,kind='trim',supportIndex=null)=>{const spec={x,y,z,w,h,d,color,kind,supportIndex,x0:x-w/2,x1:x+w/2,y0:y-h/2,y1:y+h/2,z0:z-d/2,z1:z+d/2};if(w>1e-5&&h>1e-5&&d>1e-5)plan.push(spec);return spec;};
 const paint=(x,z,w,d,c,y=.022)=>{
  const floor=y-.022,rect={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2},supports=surfaces.filter(s=>Math.abs(s.y1-floor)<.001);
  // A lower floor underneath a raised slab is not visible support. Ramp bounds
  // are conservatively excluded rather than laying a flat strip through it.
  const obstacles=[...solids.filter(s=>s.y0<floor+.012&&s.y1>floor+.002),...plan.filter(s=>s.kind==='paint'&&Math.abs(s.y0-(floor+.004))<.001)];
  for(const p of clipToSupports(rect,supports,obstacles))box((p.x0+p.x1)/2,floor+.007,(p.z0+p.z1)/2,p.x1-p.x0,.006,p.z1-p.z0,c,'paint',p.supportIndex);
 };
 const warehouse=map.id==='assault',U=map.reference?.unit||1,o=map.reference?.origin;
 const Q=(x,z,y=0)=>({x:(x+o.xShift)*U,z:(o.yCenter-z)*U,y:(y-o.zBase)*U});
 const frame=(s,x,y,z,w,h,axis,color=0x716653)=>{
  const pieces=axis==='x'?[[x,y,z,.022,h,w],[x,y,z-w/2,.026,h+.12,.06],[x,y,z+w/2,.026,h+.12,.06],[x,y-h/2,z,.026,.06,w+.12],[x,y+h/2,z,.026,.06,w+.12]]:[[x,y,z,w,h,.022],[x-w/2,y,z,.06,h+.12,.026],[x+w/2,y,z,.06,h+.12,.026],[x,y-h/2,z,w+.12,.06,.026],[x,y+h/2,z,w+.12,.06,.026]];
  // Skip inset panes masked by another wall, deck, stair or duct. No pane or
  // frame may extend around a wall segment's end and look like a fake portal.
  const bounds=pieces.map(([x,y,z,w,h,d])=>({x0:x-w/2,x1:x+w/2,y0:y-h/2,y1:y+h/2,z0:z-d/2,z1:z+d/2}));
  if(bounds.some(q=>q.y0<s.y0+.01||q.y1>s.y1-.01||(axis==='x'?q.z0<s.z0+.01||q.z1>s.z1-.01:q.x0<s.x0+.01||q.x1>s.x1-.01)))return;
  if(bounds.some(q=>solids.some(other=>other.index!==s.index&&overlapsVolume(q,other))))return;
  pieces.forEach((p,i)=>box(...p,i?color:0x627e83,i?'window-frame':'sealed-wall-inset',s.index));
 };
 for(const s of solids){
  if(s.type!=='wall'||s.h<3||Math.min(s.w,s.d)>.75)continue;
  const alongX=s.w>s.d,len=alongX?s.w:s.d,c=warehouse?0x697980:0xad9878,y=s.y0;
  // Trim remains within the wall's tangential extent and vertical bounds.
  if(alongX){box(s.x,y+.21,s.z,s.w,.42,s.d+.018,c,'wall-trim',s.index);box(s.x,y+s.h-.12,s.z,s.w,.18,s.d+.018,warehouse?0x626e75:0xe0cba5,'wall-trim',s.index);}
  else{box(s.x,y+.21,s.z,s.w+.018,.42,s.d,c,'wall-trim',s.index);box(s.x,y+s.h-.12,s.z,s.w+.018,.18,s.d,warehouse?0x626e75:0xe0cba5,'wall-trim',s.index);}
  const count=Math.min(3,Math.floor(len/(warehouse?4:5)));
  for(let i=0;i<count;i++){const t=-len/2+len*(i+.5)/count,level=y+Math.min(s.h-1.2,warehouse?5.7:3.5);if(level<y+1.4)continue;
   for(const sign of [-1,1])if(alongX)frame(s,s.x+t,level,s.z+sign*(s.d/2+.012),1.45,1.1,'z',c);else frame(s,s.x+sign*(s.w/2+.012),level,s.z+t,1.45,1.1,'x',c);
  }
  // Steel uprights follow each actual wall segment. The former full-height
  // posts continued through ladder notches and above shorter warehouse walls.
  if(warehouse)for(let i=0;i<count;i++){const t=-len/2+len*(i+.5)/count;
   if(alongX)box(s.x+t,y+s.h/2,s.z,.10,s.h,s.d+.024,0x586970,'wall-upright',s.index);
   else box(s.x,y+s.h/2,s.z+t,s.w+.024,s.h,.10,0x586970,'wall-upright',s.index);
  }
 }
 if(warehouse){
  const roofBottom=Q(0,0,496).y,roofSupports=solids.filter(s=>s.type==='roof'&&Math.abs(s.y0-roofBottom)<.001);
  const lowVoids=map.lowZones.map(z=>({...z}));
  for(const x of [-624,-352,-80,192,464]){
   const center=Q(x,2128),rect={x0:center.x-4*U,x1:center.x+4*U,z0:center.z-568*U,z1:center.z+568*U},bottom=roofBottom-10*U,top=roofBottom+.003;
   const obstacles=[...lowVoids.filter(s=>s.y0<top&&s.y1>bottom),...solids.filter(s=>!roofSupports.includes(s)&&s.y0<top&&s.y1>bottom)];
   for(const p of clipToSupports(rect,roofSupports,obstacles))box((p.x0+p.x1)/2,(bottom+top)/2,(p.z0+p.z1)/2,p.x1-p.x0,top-bottom,p.z1-p.z0,0x3f515e,'roof-rib',p.supportIndex);
   const light=Q(x,1900,476),footprint={x0:light.x-36*U,x1:light.x+36*U,z0:light.z-8*U,z1:light.z+8*U},support=roofSupports.find(s=>footprint.x0>=s.x0&&footprint.x1<=s.x1&&footprint.z0>=s.z0&&footprint.z1<=s.z1);
   if(support&&!lowVoids.some(s=>overlapsVolume({...footprint,y0:light.y,y1:roofBottom},s))){box(light.x,light.y,light.z,72*U,5*U,16*U,0xffe7aa,'industrial-light',support.index);const top=roofBottom+.003,base=light.y+2.5*U;box(light.x,(base+top)/2,light.z,.024,top-base,.024,0x586970,'light-mount',support.index);}
  }
  for(const z of [384,576,768,960,1152,1344,1536,1728,1920,2112,2304,2496,2688]){const q=Q(784,z);paint(q.x,q.z,.10,2.2,0xd9cd97);}
  for(const x of [-1088,-832,-576,-320,-64,192]){const q=Q(x,128);paint(q.x,q.z,2.8,.11,0xf0e3ac);}
  for(const x of [-512,-384,-256,-128,0,128,256,384]){const q=Q(x,1504);paint(q.x,q.z,1.2,.18,0xd9ba58);}
  for(const z of [768,1088,1408,1728,2048]){const q=Q(-1600,z,256);paint(q.x,q.z,5.5,.10,0xd9cd97,q.y+.022);}
  for(const z of [1750,1950,2150]){const q=Q(-640,z,304);paint(q.x,q.z,1.2,.08,0xd2bd71,q.y+.022);}
  for(const z of [2380,2540,2700]){const q=Q(-640,z,336);paint(q.x,q.z,2.1,.08,0xd2bd71,q.y+.022);}
  // Bare duct panels preserve the entire collision-defined low passage.

 }else{
  for(const z of [960,1216,1472,1728,1984]){const q=Q(1500,z,0);paint(q.x,q.z,6,.085,0xc3a37b,q.y+.022);}
  for(const z of [320,576,832,1088,1280]){const q=Q(-640,z,0);paint(q.x,q.z,6,.06,0xc9b18d,q.y+.022);}
  for(const z of [160,416,672,928]){const q=Q(-1856,z,0);paint(q.x,q.z,4.4,.07,0xbba17e,q.y+.022);}
  for(const s of solids.filter(s=>['mid-door','long-door','b-door'].includes(s.type))){
   for(const y of [.45,1.2,Math.min(s.h-.18,2.4)])if(s.w>s.d)box(s.x,s.y0+y,s.z,s.w-.04,.08,s.d+.014,0x554e42,'door-band',s.index);else box(s.x,s.y0+y,s.z,s.w+.014,.08,s.d-.04,0x554e42,'door-band',s.index);
  }
  for(const site of map.sites)for(const sign of [-1,1]){const r=site.radius+.18,c=site.id==='A'?0xae714a:0x778c95;paint(site.x+sign*r,site.z,.08,r*2,c,site.y+.022);paint(site.x,site.z+sign*r,r*2,.08,c,site.y+.022);}
 }
 return plan;
}
export function decorateMapEnvironment(g,root,map){for(const spec of createMapDecorationPlan(map)){const m=g.box(spec.x,spec.y,spec.z,spec.w,spec.h,spec.d,spec.color,root);m.castShadow=false;m.name=spec.kind;m.userData.surfaceDecoration={kind:spec.kind,supportIndex:spec.supportIndex};}}
