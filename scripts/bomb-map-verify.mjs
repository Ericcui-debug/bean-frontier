import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../src/world.js';
import {MAPS} from '../src/maps.js';
import {CHARACTER} from '../src/dimensions.js';
import {moveActor,rampHeight,segmentSolid} from '../src/physics.js';
const scene=new THREE.Scene(),labels=[],mat=c=>new THREE.MeshBasicMaterial({color:c});const mesh=(geo,c,parent=scene)=>{const m=new THREE.Mesh(geo,mat(c));parent.add(m);return m;};
const box=(x,y,z,w,h,d,c,parent=scene)=>{const m=mesh(new THREE.BoxGeometry(w,h,d),c,parent);m.position.set(x,y,z);return m;};const cylinder=(x,y,z,r,h,c,parent=scene)=>{const m=mesh(new THREE.CylinderGeometry(r,r,h),c,parent);m.position.set(x,y,z);return m;};const ball=(x,y,z,sx,sy,sz,c,parent=scene)=>{const m=mesh(new THREE.SphereGeometry(1),c,parent);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;};const label=(text,x,y,z)=>{const s=new THREE.Sprite();s.position.set(x,y,z);scene.add(s);labels.push(s);return s;};
const world=createWorld({scene,mesh,box,cylinder,ball,label,labels}),checks=[];
function check(name,pass){assert.ok(pass,name);checks.push(name);}
for(const def of MAPS){world.loadMap(def.id);check(def.id+' stable map metadata',world.id===def.id&&world.name===def.name);
 check(def.id+' ten clear spawns',Object.values(world.spawns).flat().every(p=>world.walkable(p.x,p.z)!==null));
 check(def.id+' blocked spawn firing lanes',world.spawns.attack.every(a=>world.spawns.defend.every(b=>world.blocked({...a,y:a.y+CHARACTER.eye},{...b,y:b.y+CHARACTER.eye}))));
 for(const role of ['attack','defend'])for(const spawn of world.spawns[role])for(const site of world.sites){const path=world.path(spawn,site);check(`${def.id} ${role} spawn to ${site.id}`,path.length>0);let from=spawn;for(const point of path){check(def.id+' every edge clears body',world.canWalk(from,point));from=point;}check('route ends at correct site',Math.hypot(from.x-site.x,from.z-site.z)<.01);}
 for(const [site,variants] of Object.entries(world.routeVariants)){check(def.id+' '+site+' two attack routes',variants.length>=2);for(const route of variants){let previous=world.spawns.attack[0];for(const point of route){check(def.id+' route waypoint clear '+JSON.stringify(point),world.canWalk(point,point));check(def.id+' authored route connected',world.path(previous,point).length>0);previous=point;}}}
 for(const points of [...Object.values(world.defenseByTactic),...Object.values(world.postPlantPositions)])for(const point of points){check(def.id+' tactical anchor clear '+JSON.stringify(point),world.canWalk(point,point));check(def.id+' tactical anchor reachable',world.path(world.spawns.defend[0],point).length>0);}
 for(const ramp of world.surfaces.filter(s=>s.shape==='ramp')){const center={x:(ramp.x0+ramp.x1)/2,z:(ramp.z0+ramp.z1)/2},axis=ramp.axis,start={...center,y:ramp.y0},end={...center,y:ramp.y1};start[axis]=ramp.sign>0?ramp[axis+'0']+.05:ramp[axis+'1']-.05;end[axis]=ramp.sign>0?ramp[axis+'1']-.05:ramp[axis+'0']+.05;start.y=rampHeight(ramp,start.x,start.z);end.y=rampHeight(ramp,end.x,end.z);check(def.id+' ramp accessible on both layers',world.path(world.spawns.attack[0],end).length>0);check(def.id+' ramp supports continuous walking',world.canWalk(start,end));check(def.id+' wedge blocks below visible slope',!!segmentSolid({...center,y:ramp.y0+.05},{...center,y:ramp.y1+1},ramp));
  for(const fps of [15,30,60]){const actor={...start,vx:axis==='x'?ramp.sign*2:0,vz:axis==='z'?ramp.sign*2:0,vy:0,grounded:true,radius:CHARACTER.radius,height:CHARACTER.height};const distance=Math.abs(end[axis]-start[axis]);for(let i=0;i<Math.floor(distance/2*fps);i++)moveActor(actor,1/fps,world);check(`${def.id} ${ramp.axis} ramp smooth at ${fps} FPS`,actor.y>ramp.y1-.15&&Math.abs(actor[axis]-end[axis])<.15);}
 }
 check(def.id+' genuine stacked navigation',Array.from(world.nav.values()).some(p=>p.y>1&&Array.from(world.nav.values()).some(q=>q.x===p.x&&q.z===p.z&&q.y===0)));
 const obstacle=world.solids.find(s=>s.type==='wall'&&s.x0<0&&s.x1>0&&s.z0>12);for(const fps of [15,30,60]){const actor={x:0,y:0,z:world.spawns.attack[0].z,vx:0,vz:-40,vy:0,grounded:true,radius:CHARACTER.radius,height:CHARACTER.height};for(let i=0;i<fps;i++)moveActor(actor,1/fps,world);check(`${def.id} no wall tunneling ${fps} FPS`,actor.z>=obstacle.z1+CHARACTER.radius-.01);}
 const roots=scene.children.filter(p=>p.name.startsWith('map:'));check(def.id+' only current map root',roots.length===1);check(def.id+' labels only current map',labels.every(l=>l.parent===roots[0]));
}
world.dispose();check('dispose removes map and labels',scene.children.length===0&&labels.length===0&&world.nav.size===0&&world.solids.length===0);
console.log(`PASS ${checks.length} three-map / layered navigation / collision checks`);
