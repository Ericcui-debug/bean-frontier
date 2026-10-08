import assert from 'node:assert/strict';
import {computeTouchLayout} from '../src/input.js';
let checks=0;
const overlap=(a,b)=>Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0])>1&&Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1])>1;
for(const [width,height] of [[844,390],[667,375],[568,320],[390,844],[375,667]])for(const size of [.8,1,1.25])for(const safe of [{},{left:44,right:44,bottom:21}]){
 const g=computeTouchLayout({width,height,safe,size}),controls={...g.positions,weapons:g.arsenal,tools:g.tools};
 for(const [name,r]of Object.entries(controls)){assert.ok(r[2]>=44&&r[3]>=44,`${name} >=44`);assert.ok(r[0]>=(safe.left||0)&&r[1]>=(safe.top||0)&&r[0]+r[2]<=width-(safe.right||0)+.01&&r[1]+r[3]<=height-(safe.bottom||0)+.01,`${width}x${height} ${name} inside safe viewport`);checks+=2;}
 for(const [i,a]of Object.entries(controls))for(const [j,b]of Object.entries(controls))if(i<j){assert.ok(!overlap(a,b),`${width}x${height} size${size} safe${JSON.stringify(safe)} ${i}/${j} overlap`);checks++;}
 for(const [name,r]of Object.entries(controls))for(const [key,box] of Object.entries({health:g.health,map:g.map,strip:g.strip})){assert.ok(!overlap(r,box),`${width}x${height} size${size} safe${JSON.stringify(safe)} ${name}/${key} overlap`);checks++;}
 const reticle=[width/2-12,height/2-12,24,24];
 for(const [name,r]of Object.entries(controls))assert.ok(!overlap(r,reticle),`${name} hides reticle`);
 assert.ok(!overlap(g.strip,g.tools),'score overlaps toolbar');assert.ok(!overlap([width/2-70,g.hintY,140,22],reticle),'context hint hides reticle');checks+=2;
}
console.log(`PASS ${checks} pure mobile layout checks (5 viewports, 3 sizes, 2 cutouts)`);
