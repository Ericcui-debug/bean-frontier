import {THREE,C} from './gfx.js';
import {segmentSolid,clamp,rampHeight} from './physics.js';
import {CHARACTER} from './dimensions.js';
import {MAPS} from './maps.js';
export function createWorld(g,id='town'){
 const solids=[],surfaces=[],bounds={},nav=new Map(),ownedGeometry=[],ownedLabels=[],ownedInstances=[];let root=null,definition=null;
 const api={bounds,solids,surfaces,cameraSolids:[],nav,groundAt,blocked,cameraBlocked:blocked,walkable,canWalk,path,rebuildNav,reset(){},solid,loadMap,dispose,areaAt};
 function geometry(geo){ownedGeometry.push(geo);return geo;}
 function label(text,x,y,z,opts){const m=g.label(text,x,y,z,opts);root.add(m);ownedLabels.push(m);return m;}
 function solid(x,z,w,d,h,color,y=0,type='wall'){
  const group=new THREE.Group();root.add(group);group.position.set(x,y,z);g.box(0,h/2,0,w,h,d,color,group);
  const s={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:y,y1:y+h,active:true,group,type};solids.push(s);if(['floor','deck'].includes(type))surfaces.push(s);return s;
 }
 function ramp(s){
  const axis=['east','west'].includes(s.direction)?'x':'z',sign=['east','south'].includes(s.direction)?1:-1;
  const shape={x0:s.x-s.w/2,x1:s.x+s.w/2,z0:s.z-s.d/2,z1:s.z+s.d/2,y0:s.y||0,y1:(s.y||0)+s.rise,rise:s.rise,axis,sign,shape:'ramp',active:true,type:'ramp'};
  const corners=[[-s.w/2,-s.d/2],[s.w/2,-s.d/2],[s.w/2,s.d/2],[-s.w/2,s.d/2]],vertices=corners.map(([x,z])=>[x,rampHeight(shape,x+s.x,z+s.z)-shape.y0,z]),low=corners.map(([x,z])=>[x,0,z]);
  const data=[],tri=(a,b,c)=>data.push(...a,...b,...c);tri(vertices[0],vertices[2],vertices[1]);tri(vertices[0],vertices[3],vertices[2]);
  for(let i=0;i<4;i++){const j=(i+1)%4;tri(low[i],vertices[j],vertices[i]);tri(low[i],low[j],vertices[j]);}tri(low[0],low[1],low[2]);tri(low[0],low[2],low[3]);
  const geo=geometry(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(data,3));geo.computeVertexNormals();const group=new THREE.Group();root.add(group);group.position.set(s.x,shape.y0,s.z);g.mesh(geo,s.color,group);shape.group=group;solids.push(shape);surfaces.push(shape);
 }
 // Map geometry is static. Batch shared unit boxes/balls by material while
 // preserving the same authored collision shapes and private ramp geometry.
 function batchStatic(){root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),matrix=new THREE.Matrix4(),buckets=new Map();root.traverse(m=>{if(!m.isMesh||m.isInstancedMesh||Array.isArray(m.material))return;const key=m.geometry.uuid+':'+m.material.uuid+':'+m.castShadow+':'+m.receiveShadow;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(m);});for(const list of buckets.values()){if(list.length<2)continue;const first=list[0],batch=new THREE.InstancedMesh(first.geometry,first.material,list.length);batch.name='static-map-batch';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;list.forEach((m,i)=>{batch.setMatrixAt(i,matrix.multiplyMatrices(inverse,m.matrixWorld));m.removeFromParent();});batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere();root.add(batch);ownedInstances.push(batch);}}
 function dispose(){for(const m of ownedInstances)m.dispose();ownedInstances.length=0;if(root)root.removeFromParent();for(const l of ownedLabels){const i=g.labels?.indexOf(l);if(i>=0)g.labels.splice(i,1);l.material?.map?.dispose();l.material?.dispose();}ownedLabels.length=0;for(const geo of ownedGeometry)geo.dispose();ownedGeometry.length=0;solids.length=surfaces.length=0;nav.clear();root=null;}
 function loadMap(id){const next=MAPS.find(m=>m.id===id);if(!next)throw new Error(`Unknown map: ${id}`);dispose();definition=next;root=new THREE.Group();root.name='map:'+id;g.scene.add(root);Object.assign(bounds,next.bounds);Object.assign(api,{id:next.id,name:next.name,metadata:{id:next.id,name:next.name,bounds},sites:next.sites.map(p=>({...p})),spawns:next.spawns,routes:next.routes,routeVariants:next.routeVariants,defensePositions:next.defensePositions,defenseByTactic:next.defenseByTactic,postPlantPositions:next.postPlantPositions,areas:next.areas,spawn:next.spawns.attack[0]});
  const w=bounds.x1-bounds.x0,d=bounds.z1-bounds.z0;
  const sea=g.mesh(geometry(new THREE.PlaneGeometry(400,400)),0x76cbd8,root);sea.rotation.x=-Math.PI/2;sea.position.y=-3;sea.castShadow=false;
  solid(0,0,w+2,d+2,2,C.cream,-2,'floor');g.box(0,.004,0,w,.008,d,next.colors.floor,root);
  for(const [x,z,ww,dd] of [[bounds.x0,0,.6,d],[bounds.x1,0,.6,d],[0,bounds.z0,w,.6],[0,bounds.z1,w,.6]]){solid(x,z,ww,dd,4.3,next.colors.boundary,0,'boundary');g.box(x,4.35,z,ww+.15,.12,dd+.15,C.cream,root);}
  // Thin street paving is decorative; all walls, balconies and ramps are solids.
  let pavingLayer=0;for(const [x,z,ww,dd,c] of [[-20,0,7,d-6,0xf2d8bc],[20,0,7,d-6,0xc4ddea],[0,0,5,d-6,0xe7ddec],[0,-14,w-7,4,0xdfdbc9]])g.box(x,.012+pavingLayer++*.008,z,ww,.014,dd,c,root);
  for(const s of next.terrain){if(s.type==='ramp')ramp(s);else{solid(s.x,s.z,s.w,s.d,s.h,s.color,s.y||0,s.type);if(s.type==='wall'&&s.h>2){g.box(s.x,(s.y||0)+s.h-.12,s.z,s.w+.04,.12,s.d+.04,C.cream,root);if(s.w>4&&s.d>3){for(const dx of [-.25,.25])g.box(s.x+s.w*dx,(s.y||0)+1.7,s.z+s.d/2+.014,s.w*.22,.6,.02,C.cream,root);}}}}
  // Theme-specific readable silhouettes and detail, placed outside movement lanes.
  for(let i=0;i<6;i++){const x=i<3?bounds.x0-4:bounds.x1+4,z=-18+i%3*17;if(id==='town'){const m=g.cylinder(x,1,z,1.9,6,[C.pink,C.purple,C.orange][i%3],root);ownedGeometry.push(m.geometry);g.ball(x,4.2,z,2.2,1.4,2.2,C.cream,root);}else if(id==='factory'){g.box(x,2,z,3,5,3,C.purple,root);g.box(x,4.8,z,4,.6,4,C.yellow,root);}else{g.box(x,0,z,2,1,9,C.cream,root);g.box(x,2.5,z,1,5,1,C.orange,root);g.box(x+2,5,z,6,.45,.45,C.orange,root);}}
  if(id==='town'){
   // Striped shop awnings, display windows, a plaza fountain and street furniture.
   for(const [x,z,color] of [[-14.3,6,C.pink],[14.3,-7,C.mint]]){
    for(let k=0;k<6;k++)solid(x,z-2.5+k,.8,.95,.1,k%2?C.cream:color,1.95,'awning');
    solid(x,z-3.5,.22,.22,1.95,C.dark,0,'post');solid(x,z+3.5,.22,.22,1.95,C.dark,0,'post');
   }
   for(const [x,z] of [[-28,1],[28,-15]]){solid(x,z,2.5,1.3,.85,C.teal,0,'cover');g.box(x,1.01,z,2.8,.12,1.6,C.cream,root);g.ball(x,1.5,z,.45,.55,.45,C.pink,root);}
   for(const [x,z] of [[-27,18],[27,-19]]){solid(x,z,.28,.28,2.5,C.dark,0,'post');g.ball(x,2.7,z,.5,.5,.5,C.yellow,root);}
  }else if(id==='factory'){
   // Compact production machines occupy the same cover shapes used by combat.
   for(const x of [-19,19]){solid(x,-4,4.3,3.3,.18,C.dark,1,'machine-top');solid(x-.8,-4,1.1,1.4,.6,C.teal,1.15,'machine');solid(x+.8,-4,1.1,1.4,.6,C.orange,1.15,'machine');for(let k=0;k<4;k++)solid(x-1.4+k*.9,-2.5,.55,.3,.12,C.yellow,1.18,'conveyor');
    for(const z of [-6,0])g.box(x,2.82,z,4,.18,1.7,C.blue,root);
   }
   for(const x of [-6,6])g.box(x,3.04,3,1.9,.12,3,C.yellow,root);
   for(const x of [-26,26]){solid(x,18,1.4,2,1.3,C.teal,0,'cover');g.box(x,1.44,18,1.5,.2,2.1,C.yellow,root);}
  }else{
   // Container corrugation and identification bands; crane silhouettes offshore.
   for(const s of next.terrain.filter(s=>s.type==='wall'&&s.w>=5&&s.d>=6)){
    for(let k=0;k<Math.floor(s.d);k+=2)g.box(s.x+s.w/2+.018,1.2,s.z-s.d/2+.4+k,.06,2.2,.12,C.cream,root);
    g.box(s.x,1.8,s.z+s.d/2+.015,s.w*.55,.35,.04,C.cream,root);
   }
   for(const x of [-30,30]){solid(x,20,2.4,2.4,.75,C.purple,0,'cover');g.box(x,.86,20,2.6,.18,2.6,C.cream,root);}
   for(let k=0;k<7;k++)g.box(-28+k*1.6,1.815,-18,.045,.02,5.8,C.orange,root);
  }
  for(const site of api.sites){const ring=g.mesh(geometry(new THREE.TorusGeometry(site.radius,.055,5,48)),site.color,root);ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.035,site.z);g.box(site.x,.025,site.z,3.2,.03,3.2,site.color,root);const l=label(site.id,site.x,3.4,site.z,{size:.7});l.userData.site=true;}
  label(next.name,0,6,bounds.z0+1,{size:1.0});for(const a of next.areas)if(!a.name.includes(' A')&&!a.name.includes(' B'))label(a.name,a.x,(a.y||0)+3.5,a.z,{size:.45});
  batchStatic();g.fitBounds?.(bounds);rebuildNav();return api;
 }
 function groundAt(x,z,maxY=Infinity){if(x<bounds.x0||x>bounds.x1||z<bounds.z0||z>bounds.z1)return null;let h=0;for(const s of solids){if(!s.active||x<s.x0||x>s.x1||z<s.z0||z>s.z1)continue;const y=s.shape==='ramp'?rampHeight(s,x,z):s.y1;if(y<=maxY+.001)h=Math.max(h,y);}return h;}
 function blocked(a,b,pad=0){let best=null;for(const s of solids){if(!s.active)continue;const h=segmentSolid(a,b,s,pad);if(h&&(!best||h.t<best.t))best={...h,solid:s};}return best;}
 function clearAt(x,z,y,radius=CHARACTER.navRadius){if(x-radius<bounds.x0||x+radius>bounds.x1||z-radius<bounds.z0||z+radius>bounds.z1)return false;for(const s of solids){if(!s.active||s.y0>=y+CHARACTER.height)continue;if(s.shape==='ramp'){if(x>s.x0-radius&&x<s.x1+radius&&z>s.z0-radius&&z<s.z1+radius){const top=rampHeight(s,clamp(x,s.x0,s.x1),clamp(z,s.z0,s.z1));if(top>y+.03)return false;}continue;}if(s.y1<=y+.38)continue;if(x>s.x0-radius&&x<s.x1+radius&&z>s.z0-radius&&z<s.z1+radius)return false;}return true;}
 function floorsAt(x,z){const result=[0];for(const s of surfaces){if(s.type==='floor'||!s.active||x<s.x0||x>s.x1||z<s.z0||z>s.z1)continue;const y=s.shape==='ramp'?rampHeight(s,x,z):s.y1;if(y<=3.01&&!result.some(v=>Math.abs(v-y)<.04))result.push(y);}return result.sort((a,b)=>a-b);}
 function walkable(x,z,maxY=.38){const choices=floorsAt(x,z).filter(h=>h<=maxY+.001&&clearAt(x,z,h));return choices.length?Math.max(...choices):null;}
 function canWalk(a,b,radius=CHARACTER.navRadius){let h=groundAt(a.x,a.z,(a.y??0)+.38);if(h===null||Math.abs(h-(a.y??h))>.38)return false;const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.22));for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,next=groundAt(x,z,h+.38);if(next===null||Math.abs(next-h)>.38||!clearAt(x,z,next,radius))return false;h=next;}return Math.abs(h-(b.y??0))<=.38;}
 const cell=1.0;
 function rebuildNav(){nav.clear();const buckets=new Map(),nx=Math.ceil((bounds.x1-bounds.x0)/cell)-1,nz=Math.ceil((bounds.z1-bounds.z0)/cell)-1;for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){const x=bounds.x0+1+ix*cell,z=bounds.z0+1+iz*cell,list=[];for(const y of floorsAt(x,z)){if(!clearAt(x,z,y))continue;const id=nav.size,p={id,ix,iz,x,y,z,neighbors:[]};nav.set(id,p);list.push(p);}buckets.set(ix+','+iz,list);}for(const p of nav.values())for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])for(const q of buckets.get((p.ix+dx)+','+(p.iz+dz))||[]){if(Math.abs(q.y-p.y)>1.0||!canWalk(p,q))continue;p.neighbors.push(q.id);}}
 function nearest(a,linked=false){let best=null,d=Infinity;for(const p of nav.values()){const n=(p.x-a.x)**2+(p.z-a.z)**2+9*(p.y-(a.y??0))**2;if(n<d&&(!linked||canWalk(a,p,CHARACTER.navEntryRadius))){best=p;d=n;}}return best;}
 function path(from,to){if(canWalk(from,to))return [{...to,y:to.y??0}];const a=nearest(from,true),b=nearest(to,true);if(!a||!b)return [];const open=[a.id],cost=new Map([[a.id,0]]),parent=new Map(),closed=new Set();while(open.length){let index=0,best=Infinity;for(let i=0;i<open.length;i++){const p=nav.get(open[i]),f=cost.get(p.id)+Math.hypot(p.x-b.x,p.z-b.z,p.y-b.y);if(f<best){best=f;index=i;}}const id=open.splice(index,1)[0];if(id===b.id){const route=[];let k=id;while(k!==a.id){route.push(nav.get(k));k=parent.get(k);}route.push(a);route.reverse();if(canWalk(b,to))route.push({...to,y:to.y??b.y});return route;}closed.add(id);for(const next of nav.get(id).neighbors){if(closed.has(next))continue;const p=nav.get(id),q=nav.get(next),nc=cost.get(id)+Math.hypot(p.x-q.x,p.z-q.z,p.y-q.y);if(nc<(cost.get(next)??Infinity)){cost.set(next,nc);parent.set(next,id);if(!open.includes(next))open.push(next);}}}return [];}
 function areaAt(p){let best=null,d=Infinity;for(const a of api.areas){const n=Math.hypot(p.x-a.x,p.z-a.z,p.y-(a.y||0));if(n<d){d=n;best=a;}}return best?.name||api.name;}
 loadMap(id);return api;
}
