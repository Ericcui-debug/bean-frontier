import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setup} from './bomb-fixture.mjs';
import {CHARACTER} from '../src/dimensions.js';
import {moveActor,STEP,segmentSolid} from '../src/physics.js';
import {shapeFor} from '../src/map-geometry.js';
let checks=0;const check=(name,pass,detail)=>{assert.ok(pass,name+' '+JSON.stringify(detail??''));checks++;};
const make=(p)=>({...p,vx:0,vz:0,vy:7.4,height:CHARACTER.height,radius:CHARACTER.radius,grounded:false,ladderCooldown:10,stance:'stand'});
const simulate=(a,world,seconds,fps)=>{let maxY=a.y,maxHead=a.y+a.height,penetrates=false;const points=[];for(let frame=0;frame<Math.ceil(seconds*fps);frame++){for(let i=0;i<120/fps;i++){moveActor(a,STEP,world);maxY=Math.max(maxY,a.y);maxHead=Math.max(maxHead,a.y+a.height);if(world.probe&&segmentSolid({x:a.x,y:a.y+a.height-.002,z:a.z},{x:a.x,y:a.y+a.height-.002,z:a.z},world.probe))penetrates=true;}points.push({x:a.x,y:a.y,z:a.z});}return {maxY,maxHead,penetrates,final:{x:a.x,y:a.y,z:a.z},points};};
const ramp=shapeFor({x:0,z:0,y:2.4,w:6,d:6,rise:2,type:'ramp',direction:'south'});
const floor=(x,z,maxY)=>{if(x>=ramp.x0&&x<=ramp.x1&&z>=ramp.z0&&z<=ramp.z1){const y=ramp.y0+ramp.rise*(z-ramp.z0)/(ramp.z1-ramp.z0);if(y<=maxY+.001)return y;}return 0;};
const synthetic={solids:[ramp],probe:ramp,groundAt:floor,collisionCandidates:()=>[ramp]};
const results=[];
for(const fps of [15,30,60]){
 const under=make({x:0,y:0,z:0}),roofResult=simulate(under,synthetic,1.2,fps);check('closed ramp underside blocks rising player head at '+fps,roofResult.maxHead<=ramp.y0+1e-6&&!roofResult.penetrates,roofResult);check('head contact lands back on original floor at '+fps,Math.abs(under.y)<1e-6&&under.grounded,roofResult);
 const clear=make({x:5,y:0,z:0}),clearResult=simulate(clear,synthetic,1.2,fps);check('adjacent uncovered area preserves full jump at '+fps,clearResult.maxY>1.3&&clearResult.maxY>roofResult.maxY+.4&&!clearResult.penetrates,clearResult);
 const top=make({x:0,y:3.4,z:0}),topResult=simulate(top,synthetic,1.2,fps);check('standing on ramp still jumps and returns to slope at '+fps,topResult.maxY>4.7&&Math.abs(top.y-3.4)<1e-6&&top.grounded,topResult);
 const walker={...make({x:0,y:floor(0,-1,Infinity),z:-1}),vy:0,grounded:true,vz:1},walkResult=simulate(walker,synthetic,.6,fps);check('ramp roof walk retains slope support at '+fps,Math.abs(walker.y-floor(walker.x,walker.z,Infinity))<1e-6&&walker.grounded,walkResult);
 const {world}=setup(true,'dust2'),actualRamp=world.solids.find(s=>s.shape==='ramp'&&Math.abs(s.x0+11.036444444444445)<1e-5&&Math.abs(s.z0-21.383111111111113)<1e-5);assert.ok(actualRamp,'measured T ramp is present');const actual=make({x:actualRamp.x0+.6,y:0,z:actualRamp.z0+.6});world.probe=actualRamp;check('Dust2 measured underside start is normally walkable at '+fps,world.canWalk(actual,actual));const actualResult=simulate(actual,world,1.2,fps);check('Dust2 measured ramp jump cannot penetrate solid at '+fps,actualResult.maxHead<=actualRamp.y0+1e-6&&!actualResult.penetrates,actualResult);delete world.probe;results.push({fps,under:roofResult.maxY,clear:clearResult.maxY,top:topResult.maxY,actual:actualResult.maxHead});
}
check('15/30/60 renderer schedules retain identical fixed-step jump results',results.every(r=>['under','clear','top','actual'].every(k=>Math.abs(r[k]-results[0][k])<1e-6)),results);
// Ordinary flat underside and inactive objects retain their previous behavior.
const flat=shapeFor({x:0,z:0,y:2.4,w:6,d:6,h:1,type:'roof'}),flatWorld={solids:[flat],groundAt:()=>0,collisionCandidates:()=>[flat]};const actor=make({x:0,y:0,z:0});check('flat roof still blocks upward jump',simulate(actor,flatWorld,1.2,30).maxHead<=2.4+1e-6);flat.active=false;check('inactive overhead objects do not block jumping',simulate(make({x:0,y:0,z:0}),flatWorld,1.2,30).maxY>1.3);
fs.mkdirSync('output/surface-audit',{recursive:true});fs.writeFileSync('output/surface-audit/jump-verify.json',JSON.stringify({checks,results},null,2));console.log('PASS '+checks+' ramp underside / jump / slope / fixed-rate regressions');
