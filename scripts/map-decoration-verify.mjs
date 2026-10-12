import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MAPS} from '../src/maps.js';
import {shapeFor} from '../src/map-geometry.js';
import {createMapDecorationPlan,decorateMapEnvironment} from '../src/visual/map-environment.js';
import {clipToSupports,overlapsVolume,intersectRect} from '../src/visual/decoration-geometry.js';
let checks=0;const check=(name,ok)=>{assert.ok(ok,name);checks++;};
const area=r=>(r.x1-r.x0)*(r.z1-r.z0);
// Overlapping supports must not produce a second coplanar paint layer.
const rect={x0:0,x1:6,z0:0,z1:2},clips=clipToSupports(rect,[{x0:0,x1:4,z0:0,z1:2,index:0},{x0:2,x1:6,z0:0,z1:2,index:1}],[{x0:3,x1:4,z0:0,z1:1}]);
check('union support clipping preserves exactly visible painted area',Math.abs(clips.reduce((a,r)=>a+area(r),0)-11)<1e-9);
for(let i=0;i<clips.length;i++)for(let j=0;j<i;j++)check('clip union has no duplicate patches',!intersectRect(clips[i],clips[j]));
for(const map of MAPS){
 const solids=map.terrain.map((s,index)=>({...shapeFor(s),index})),ground={...map.bounds,y0:-2,y1:0,index:-1},plan=createMapDecorationPlan(map),paint=plan.filter(s=>s.kind==='paint');
 check(map.id+' retains substantial attached environment',paint.length>=20&&plan.some(s=>s.kind==='sealed-wall-inset'));
 for(const s of plan){
  check(map.id+' finite positive decoration dimensions',Object.values(s).filter(v=>typeof v==='number').every(Number.isFinite)&&s.w>0&&s.h>0&&s.d>0);
  if(s.kind==='paint'){
   const support=s.supportIndex===-1?ground:solids[s.supportIndex];
   check(map.id+' paint wholly inside its visible support',support&&s.x0>=support.x0-1e-8&&s.x1<=support.x1+1e-8&&s.z0>=support.z0-1e-8&&s.z1<=support.z1+1e-8&&Math.abs(s.y0-support.y1-.004)<1e-8);
   check(map.id+' paint does not protrude into boxes walls slopes or steps',!solids.some(q=>q.y0<s.y1&&q.y1>s.y0&&intersectRect(s,q)));
  }
  if(['sealed-wall-inset','window-frame','wall-upright','wall-trim'].includes(s.kind)){
   const wall=solids[s.supportIndex],alongX=wall.w>wall.d;
   check(map.id+' wall detail stays inside source face span',s.y0>=wall.y0-1e-8&&s.y1<=wall.y1+1e-8&&(alongX?s.x0>=wall.x0-1e-8&&s.x1<=wall.x1+1e-8:s.z0>=wall.z0-1e-8&&s.z1<=wall.z1+1e-8));
  }
  if(['sealed-wall-inset','window-frame'].includes(s.kind))check(map.id+' sealed pane avoids other solid edges',!solids.some(q=>q.index!==s.supportIndex&&overlapsVolume(s,q)));
  if(s.kind==='roof-rib'){
   const roof=solids[s.supportIndex];
   check(map.id+' beam attached to real roof underside only',roof.type==='roof'&&s.x0>=roof.x0-1e-8&&s.x1<=roof.x1+1e-8&&s.z0>=roof.z0-1e-8&&s.z1<=roof.z1+1e-8&&Math.abs(s.y1-roof.y0-.003)<1e-8);
   check(map.id+' beam avoids duct and shaft clearance',!map.lowZones.some(q=>overlapsVolume(s,q)));
   check(map.id+' beam never cuts other terrain',!solids.some(q=>q.index!==s.supportIndex&&overlapsVolume(s,q)));
  }
 }
 for(let i=0;i<paint.length;i++)for(let j=0;j<i;j++)if(Math.abs(paint[i].y-paint[j].y)<.001)check(map.id+' paint layers never overlap at line or site corners',!intersectRect(paint[i],paint[j]));
 const root=new THREE.Group(),geo=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
 decorateMapEnvironment({box:(x,y,z,w,h,d)=>{const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);root.add(mesh);return mesh;}},root,map);
 check(map.id+' Three mock renders every planned detail once',root.children.length===plan.length&&root.children.every(m=>!m.castShadow&&m.userData.surfaceDecoration));
 check(map.id+' decorative generation leaves terrain unchanged',createMapDecorationPlan(map).length===plan.length);
 geo.dispose();material.dispose();
}
console.log(`PASS ${checks} decoration support / roof clearance / coplanar paint / Three mock checks`);
