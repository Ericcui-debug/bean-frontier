import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {createWorld} from '../src/world.js';
import {MAPS} from '../src/maps.js';
import {CHARACTER} from '../src/dimensions.js';
import {moveActor,STEP} from '../src/physics.js';
const scene=new THREE.Scene(),labels=[],material=new THREE.MeshBasicMaterial(),unit=new THREE.BoxGeometry(1,1,1);
const mesh=(geo,c,parent=scene)=>{const m=new THREE.Mesh(geo,material);parent.add(m);return m;};
const box=(x,y,z,w,h,d,c,parent=scene)=>{const m=mesh(unit,c,parent);m.position.set(x,y,z);m.scale.set(w,h,d);return m;};
const label=(text,x,y,z)=>{const m=new THREE.Sprite(new THREE.SpriteMaterial());m.position.set(x,y,z);scene.add(m);labels.push(m);return m;};
const w=createWorld({scene,mesh,box,label,labels});
function travel(start,waypoints,fps,hostage=false,observers=[]){
 const a={...start,vx:0,vy:0,vz:0,grounded:true,radius:CHARACTER.radius,height:CHARACTER.height,navigationProfile:hostage?'hostage':'soldier',isHostage:hostage};
 let elapsed=0,distance=0,firstSight=null;
 for(const destination of waypoints){
  const path=w.path(a,destination,{profile:a.navigationProfile});assert.ok(path.length,'path to '+JSON.stringify(destination));
  let index=0;
  for(let frame=0;index<path.length&&frame<fps*120;frame++)for(let step=0;step<Math.round(1/fps/STEP)&&index<path.length;step++){
   const q=path[index];
   if(q.kind==='door'){w.toggleDoor(q.id);index++;continue;}
   if(q.kind==='grille'){w.damageSolid(q.solid,100);index++;continue;}
   const delta=Math.hypot(q.x-a.x,q.z-a.z);if(delta<.12&&Math.abs(q.y-a.y)<.35){index++;continue;}
   const speed=hostage?2.8:w.stanceAt(a)==='crouch'?2.2:5.5,pace=Math.min(speed,delta/STEP);
   a.vx=delta?(q.x-a.x)/delta*pace:0;a.vz=delta?(q.z-a.z)/delta*pace:0;a.traverseWaypoint=q;a.traverseForward=q.kind==='ladder'?Math.sign(q.y-a.y):Math.hypot(a.vx,a.vz);
   const old={x:a.x,y:a.y,z:a.z};moveActor(a,STEP,w);elapsed+=STEP;distance+=Math.hypot(a.x-old.x,a.y-old.y,a.z-old.z);
   if(firstSight===null&&observers.some(o=>Math.hypot(a.x-o.x,a.z-o.z)<=43&&!w.blocked({x:a.x,y:a.y+(a.eye||CHARACTER.eye),z:a.z},{x:o.x,y:o.y+CHARACTER.eye,z:o.z})))firstSight=elapsed;
  }
  assert.ok(index===path.length,'physically reached '+JSON.stringify({destination,actor:a,remaining:path.slice(index)}));
 }
 return {seconds:+elapsed.toFixed(3),meters:+distance.toFixed(2),firstStaticDefenderSightSeconds:firstSight===null?null:+firstSight.toFixed(3)};
}
const rows=[];
for(const map of MAPS){w.loadMap(map.id);for(const fps of [15,30,60]){
 for(const [tactic,routes] of Object.entries(map.routeVariants))for(let variant=0;variant<routes.length;variant++){
  w.reset();rows.push({map:map.id,kind:'attack',route:tactic+'-'+(variant+1),fps,...travel(map.spawns.attack[0],routes[variant],fps,false,map.defensePositions)});
 }
 if(map.id==='assault')for(let i=0;i<map.hostagePositions.length;i++){w.reset();rows.push({map:map.id,kind:'escort',route:'hostage-'+(i+1),fps,...travel(map.hostagePositions[i],[map.rescueZones[0]],fps,true)});}
 else for(const [from,to] of [[0,1],[1,0]]){w.reset();rows.push({map:map.id,kind:'rotation',route:map.sites[from].id+'→'+map.sites[to].id,fps,...travel(map.sites[from],[map.sites[to]],fps)});}
}}
for(const row of rows){const same=rows.filter(r=>r.map===row.map&&r.kind===row.kind&&r.route===row.route);assert.ok(same.every(r=>Math.abs(r.seconds-row.seconds)<.001&&r.meters===row.meters&&r.firstStaticDefenderSightSeconds===row.firstStaticDefenderSightSeconds),'FPS invariant '+JSON.stringify(row));}
const description='Independent physical navigation timing, no AI, shooting or combat delays. Constant 5.5 m/s soldier, 2.2 m/s duct, 2.8 m/s ladder/hostage. Authored route waypoints are mandatory. First contact is the first unobstructed ray within 43 m to a stationary defensive anchor; it is a geometry benchmark, not live match balance or an AI knowledge signal.';
fs.mkdirSync('output/core-map',{recursive:true});fs.writeFileSync('output/core-map/route-timing.json',JSON.stringify({description,rows},null,2));
const lines=['# 经典双地图独立路线计时','','固定物理导航基准，无 AI、交火或犹豫。士兵 5.5 m/s、管道 2.2 m/s、梯子及人质 2.8 m/s。按路线锚点连续行走。首次接敌列仅表示对静止防守锚点的首次 43 米内无遮挡视线，不代表实战反应或 AI 已知信息。15／30／60 FPS 的时间、路程和首次视线均一致。','','| 地图 | 类型 | 路线 | 秒 | 米 | 首次静态防守视线（秒） |','|---|---|---|---:|---:|---:|'];
for(const r of rows.filter(r=>r.fps===60))lines.push(`| ${r.map} | ${r.kind} | ${r.route} | ${r.seconds} | ${r.meters} | ${r.firstStaticDefenderSightSeconds??'—'} |`);
fs.writeFileSync('output/core-map/ROUTE-TIMING.md',lines.join('\n')+'\n');
w.dispose();console.log('PASS '+rows.length+' physical attack / escort / rotation timings, 15/30/60 FPS identical');
