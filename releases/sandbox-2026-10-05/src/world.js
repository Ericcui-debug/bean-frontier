import {THREE,C} from './gfx.js';
import {segmentBox,segmentSolid,clamp} from './physics.js';
export function createWorld(g){
 const solids=[],cameraSolids=[],surfaces=[],props=[],pickups=[],pads=[],camps=[],flags=[],coins=[],targets=[],decor=[];
 const rng=(n)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
 function solid(x,z,w,d,h,color,y=0,{breakable=false,type='wall',hp=40}={}){const group=new THREE.Group();g.scene.add(group);g.box(0,h/2,0,w,h,d,color,group);group.position.set(x,y,z);const s={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:y,y1:y+h,active:true,group,type,hp,maxHp:hp,breakable};solids.push(s);if(breakable){props.push(s);if(type==='barrel'){g.box(0,h*.25,0,w+.03,.12,d+.03,C.cream,group);g.box(0,h*.75,0,w+.03,.12,d+.03,C.cream,group);s.label=g.label('!',x,y+h+.5,z,{size:.6});}else{for(const off of [-.28,.28])g.box(off*w,h/2,-d/2-.015,.12,h,.04,C.cream,group);}}return s;}
 function surface(x,z,w,d,y,color){surfaces.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y,type:'flat'});return solid(x,z,w,d,y+.7,color,-.7);}
 function ramp(x,z,w,d,rise,color){const group=new THREE.Group();g.scene.add(group);group.position.set(x,0,z);
  const support={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y:rise,type:'ramp',rise};surfaces.push(support);
  // Closed wedge: its roof, side triangles and high wall all match the slope.
  const A=[-w/2,0,d/2],B=[w/2,0,d/2],C0=[-w/2,rise,-d/2],D=[w/2,rise,-d/2],E=[-w/2,0,-d/2],F=[w/2,0,-d/2];
  const vertices=new Float32Array([...A,...B,...C0,...B,...D,...C0,...A,...C0,...E,...B,...F,...D,...E,...C0,...D,...E,...D,...F,...A,...E,...F,...A,...F,...B]);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.computeVertexNormals();const m=g.mesh(geo,color,group);m.material=new THREE.MeshStandardMaterial({color,roughness:.85,side:THREE.DoubleSide});
  solids.push({...support,y0:0,y1:rise,shape:'ramp',active:true,group,type:'ramp',breakable:false});
 }
 function groundAt(x,z,maxY=Infinity){if((x/72)**2+(z/84)**2>1)return null;let height=0;
  for(const s of surfaces)if(x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1){const y=s.type==='ramp'?(s.z1-z)/(s.z1-s.z0)*s.rise:s.y;if(y<=maxY+.001)height=Math.max(height,y);}
  for(const s of solids)if(s.active&&s.shape!=='ramp'&&x>=s.x0&&x<=s.x1&&z>=s.z0&&z<=s.z1&&s.y1<=maxY+.001)height=Math.max(height,s.y1);
  return height;
 }
 function road(x,z,w,d){g.box(x,.012,z,w,.03,d,0xf2d8a5);for(let p=-d/2+2;p<d/2;p+=5)g.box(x,.036,z+p,.14,.018,1.1,C.cream);}
 const sea=g.mesh(new THREE.PlaneGeometry(1500,1500),0x74c6d7);sea.rotation.x=-Math.PI/2;sea.position.y=-4;sea.castShadow=false;
 const island=g.mesh(new THREE.CylinderGeometry(1,1.035,4,80),C.mint);island.position.y=-2;island.scale.set(72,1,84);
 const shore=g.mesh(new THREE.CylinderGeometry(1,1.016,.6,80),0xf4dfa9);shore.position.y=-2.8;shore.scale.set(74,1,86);
 road(0,2,8,113);road(-15,12,54,7);road(20,-14,43,7);road(-15,-48,47,6);
 // The northern plateau and both ramps are rendered from the same support definitions.
 surface(-18,-51.5,44,37,6,0xb6a6d9);ramp(-18,-24,12,18,6,0xebc89d);
 surface(43,-27,18,20,4.8,0x69b8b8);ramp(43,-9,9,16,4.8,0xffd16d);
 const raisedPath=g.mesh(new THREE.PlaneGeometry(8.9,Math.hypot(16,4.8)),C.yellow);raisedPath.rotation.x=-Math.PI/2+Math.atan(4.8/16);raisedPath.position.set(43,2.42,-9); // Visual slope agrees with support (north is high).
 const spawn={x:0,y:0,z:46};
 g.cylinder(0,.06,46,4.6,.12,C.cream);const spawnRing=g.mesh(new THREE.TorusGeometry(3.8,.12,8,48),C.teal);spawnRing.rotation.x=-Math.PI/2;spawnRing.position.set(0,.16,46);g.label('BEAN FRONTIER',0,5,48,{size:1.4});
 // Town buildings: solid toy houses with roofs, windows and candy awnings.
 for(const [x,z,w,d,h,c] of [[-42,23,10,10,7,C.orange],[-43,3,9,10,6,C.purple],[-17,26,10,8,6,C.blue],[-20,4,8,7,4.5,C.yellow]]){
  solid(x,z,w,d,h,c);solid(x,z,w+.7,d+.7,.55,C.cream,h,{type:'roof'});
  for(const off of [-2.2,2.2]){g.box(x+off,3,z+d/2+.025,1.5,1.6,.05,C.dark);g.box(x+off,3,z+d/2+.075,1.15,1.25,.06,0xa4e1df);}
  g.box(x,1.5,z+d/2+.03,1.6,3,.08,C.cream);g.box(x,h*.62,z+d/2+.7,w+.5,.23,1.5,C.pink);
  // Rendered overhangs obstruct the camera without changing actor navigation.
  cameraSolids.push({x0:x-(w+.5)/2,x1:x+(w+.5)/2,y0:h*.62-.115,y1:h*.62+.115,z0:z+d/2-.05,z1:z+d/2+1.45,active:true,type:'awning'});
 }
 // Low climbing steps reach the town's lookout deck via real jumpable supports.
 for(let i=0;i<4;i++)surface(-9,27-i*2,3,2,1+i*.8,[C.yellow,C.orange,C.blue,C.cream][i]);surface(-9,17,6,8,3.4,C.orange);
 for(const [x,z,w,d,h] of [[19,-31,11,9,7],[27,-39,10,8,8],[52,-42,8,9,6]]){solid(x,z,w,d,h,C.teal);for(let y=1.5;y<h;y+=2)for(let off=-w/2+1.5;off<w/2;off+=3)g.box(x+off,y,z+d/2+.03,1.5,.9,.08,C.yellow);g.cylinder(x,h+.9,z,1.6,1.8,C.orange);}
 // Camp defenses leave multiple approach routes.
 const campSpecs=[{id:0,name:'糖果小镇',x:-31,z:12,y:0,color:C.orange},{id:1,name:'积木工厂',x:27,z:-17,y:0,color:C.blue},{id:2,name:'高地营地',x:-18,z:-50,y:6,color:C.purple}];
 for(const c of campSpecs){const group=new THREE.Group();g.scene.add(group);const ring=g.mesh(new THREE.TorusGeometry(8.7,.09,6,64),c.color,group);ring.rotation.x=-Math.PI/2;ring.position.set(c.x,c.y+.06,c.z);const pole=g.cylinder(c.x,c.y+3,c.z,.1,6,C.cream,group);const banner=g.box(c.x+1.1,c.y+5.1,c.z,2.2,1.25,.07,c.color,group);g.label(c.name,c.x,c.y+7,c.z,{size:1.15});camps.push({...c,cleared:false,group,banner});
  for(const [ox,oz,w,d] of [[-7,-5,3,1],[6,-4,1,4],[-2,7,4,1]])solid(c.x+ox,c.z+oz,w,d,1.2,C.cream,c.y);
  solid(c.x+5,c.z+4,1.2,1.2,1.8,C.red,c.y,{breakable:true,type:'barrel',hp:35});
 }
 for(const [x,z] of [[-14,38],[-34,17],[22,-9],[35,-21],[-26,-47],[8,9],[-3,-35]])solid(x,z,1.6,1.6,1.5,C.orange,groundAt(x,z)||0,{breakable:true,type:'crate',hp:30});
 function pickup(type,x,z,weapon=null){let label=null;const y=groundAt(x,z)||0,group=new THREE.Group();g.scene.add(group);group.position.set(x,y+.65,z);g.cylinder(0,-.5,0,1,.12,C.cream,group);const box=g.box(0,0,0,.8,.55,.8,type==='weapon'?C.yellow:C.mint,group);if(type==='supply'){g.box(0,.01,.43,.48,.14,.04,C.cream,group);g.box(0,.01,.43,.14,.48,.04,C.cream,group);}else{g.box(0,.6,0,.2,.24,1.1,C.dark,group);label=g.label(weapon===1?'泡泡散射枪':'糖果炮',x,y+2.5,z,{size:.65});}const p={type,x,y,z,weapon,group,label,active:true,readyAt:0};pickups.push(p);return p;}
 pickup('weapon',-10,35,1);pickup('weapon',43,-25,2);for(const [x,z] of [[0,40],[-26,29],[18,1],[43,-21],[-12,-38],[-34,-60]])pickup('supply',x,z);
 // Optional challenge stations, activated by E or touch interaction.
 for(const f of [{id:'targets',name:'彩弹打靶',x:12,z:34},{id:'collect',name:'糖果寻宝',x:12,z:7},{id:'combat',name:'限时清敌',x:8,z:-43}]){const y=groundAt(f.x,f.z)||0;const group=new THREE.Group();g.scene.add(group);group.position.set(f.x,y,f.z);g.cylinder(0,1.5,0,.07,3.1,C.dark,group);const banner=g.box(.75,2.6,0,1.5,.9,.07,C.yellow,group);g.cylinder(0,.07,0,1.5,.14,C.cream,group);g.label('★ '+f.name,f.x,y+4,f.z,{size:.85});flags.push({...f,y,group,banner,complete:false});}
 for(let i=0;i<6;i++){const x=9+i*2.5,z=24-(i%2)*3,y=1.8;const group=new THREE.Group();g.scene.add(group);group.position.set(x,y,z);const disk=g.cylinder(0,0,0,.58,.18,C.cream,group);disk.rotation.x=Math.PI/2;const inner=g.cylinder(0,0,.13,.34,.05,C.pink,group);inner.rotation.x=Math.PI/2;g.cylinder(0,-.9,0,.045,1.8,C.teal,group);group.visible=false;targets.push({x,y,z,r:.65,group,active:false});}
 for(let i=0;i<8;i++){const angle=i/8*Math.PI*2,x=12+Math.sin(angle)*(i%2?11:7),z=7+Math.cos(angle)*(i%2?11:7),y=(groundAt(x,z)||0)+1;const group=new THREE.Group();g.scene.add(group);const ring=g.mesh(new THREE.TorusGeometry(.4,.17,7,16),C.yellow,group);group.position.set(x,y,z);group.visible=false;coins.push({x,y,z,group,active:false});}
 for(const [x,z] of [[-7,29],[40,-1],[-18,-13]]){const y=groundAt(x,z)||0;const group=new THREE.Group();g.scene.add(group);g.cylinder(x,y+.18,z,1.05,.35,C.pink,group);const top=g.cylinder(x,y+.39,z,.85,.08,C.yellow,group);pads.push({x,y,z,r:1.05,top});}
 // Trees use solid trunks, leaving their soft canopies above playable space.
 for(let i=0;i<34;i++){const a=i/34*Math.PI*2,x=Math.sin(a)*(58+rng(i)*7),z=Math.cos(a)*(69+rng(i+80)*7),y=groundAt(x,z);if(y===null)continue;solid(x,z,.7,.7,3.5,0xc69c76,y);g.ball(x,y+4.5,z,2.2,2.8,2.2,[C.teal,C.mint,C.orange][i%3]);g.ball(x+1,y+5.8,z,1.7,1.8,1.7,C.mint);cameraSolids.push({x,y:y+4.5,z,rx:2.2,ry:2.8,rz:2.2,shape:'ellipsoid',active:true,type:'canopy'},{x:x+1,y:y+5.8,z,rx:1.7,ry:1.8,rz:1.7,shape:'ellipsoid',active:true,type:'canopy'});}
 for(let i=0;i<18;i++){const a=i*.9,x=Math.sin(a)*90,z=Math.cos(a)*110;const cloud=new THREE.Group();g.scene.add(cloud);for(let j=0;j<3;j++){const m=g.ball(x+j*3,26+rng(i)*15,z,4,1.1,1.8,0xfffcf3,cloud);m.castShadow=false;}decor.push(cloud);}
 function blocked(a,b,pad=0){let best=null;for(const s of solids){if(!s.active)continue;const h=segmentSolid(a,b,s,pad);if(h&&(!best||h.t<best.t))best={...h,solid:s};}return best;}
 function cameraBlocked(a,b,pad=.28){
  let best=blocked(a,b,pad);
  for(const s of cameraSolids){let h;if(s.shape==='ellipsoid'){const rx=s.rx+pad,ry=s.ry+pad,rz=s.rz+pad,ox=(a.x-s.x)/rx,oy=(a.y-s.y)/ry,oz=(a.z-s.z)/rz,dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry,dz=(b.z-a.z)/rz,A=dx*dx+dy*dy+dz*dz,B=2*(ox*dx+oy*dy+oz*dz),D=ox*ox+oy*oy+oz*oz-1,disc=B*B-4*A*D;const t=D<=0?0:A>1e-10&&disc>=0?(-B-Math.sqrt(disc))/(2*A):-1;h=t>=0&&t<=1?{t,normal:{x:0,y:0,z:0}}:null;}else h=segmentBox(a,b,s,pad);if(h&&(!best||h.t<best.t))best={...h,solid:s};}
  // The island top was rendered but absent from the solid list. Clip against
  // its exact ellipse so steep upward views never put the near plane underground.
  if(b.y<pad&&b.y<a.y){const t=Math.max(0,(a.y-pad)/(a.y-b.y)),x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(t<=1&&(x/72)**2+(z/84)**2<=1.01&&(!best||t<best.t))best={t,normal:{x:0,y:1,z:0},solid:{type:'island'}};}
  return best;
 }
 function walkable(x,z){const h=groundAt(x,z);if(h===null)return null;for(const s of solids)if(s.active&&s.shape!=='ramp'&&s.y1>h+.38&&s.y0<h+1.94&&x>s.x0-.6&&x<s.x1+.6&&z>s.z0-.6&&z<s.z1+.6)return null;return h;}
 // Ground-following visibility shares actor clearance; vertical ray padding must
 // not turn a continuous ramp/plateau seam into an artificial wall.
 function canWalk(a,b,radius=.54){const distance=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.max(1,Math.ceil(distance/.3));let previous=groundAt(a.x,a.z,a.y===undefined?Infinity:a.y+.38);
  for(let i=0;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,h=groundAt(x,z,previous+.38);if(h===null||Math.abs(h-previous)>.38)return false;
   for(const s of solids){if(!s.active||s.shape==='ramp'||s.y1<=h+.38||s.y0>=h+1.94)continue;if(x>s.x0-radius&&x<s.x1+radius&&z>s.z0-radius&&z<s.z1+radius)return false;}previous=h;
  }return Math.abs(previous-(b.y??groundAt(b.x,b.z)))<=.38;
 }
 // Navigation grid encodes height connectivity. A ramp is the route onto a plateau.
 const cell=2.5,nx=57,nz=67,nav=new Map();
 function rebuildNav(){nav.clear();for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){const x=-70+ix*cell,z=-82.5+iz*cell,h=walkable(x,z);if(h!==null)nav.set(ix+iz*nx,{id:ix+iz*nx,ix,iz,x,z,y:h});}}
 function nearest(x,z,origin=null){const candidates=[...nav.values()].sort((a,b)=>(a.x-x)**2+(a.z-z)**2-((b.x-x)**2+(b.z-z)**2));if(!origin)return candidates[0]??null;return candidates.find(p=>Math.hypot(p.x-x,p.z-z)<8&&canWalk(origin,p))??null;}
 function path(from,to){const start=nearest(from.x,from.z,{...from,y:from.y??groundAt(from.x,from.z)}),end=nearest(to.x,to.z);if(!start||!end)return [];const open=[start],cost=new Map([[start.id,0]]),prev=new Map(),done=new Set();let iterations=0;
  while(open.length&&iterations++<2200){let bi=0,bf=Infinity;for(let i=0;i<open.length;i++){const p=open[i],f=cost.get(p.id)+Math.hypot(p.ix-end.ix,p.iz-end.iz);if(f<bf){bf=f;bi=i;}}const p=open.splice(bi,1)[0];if(p.id===end.id){const out=[];let k=p;while(k.id!==start.id){out.push(k);k=nav.get(prev.get(k.id));if(!k)break;}const route=out.reverse();if(Math.hypot(from.x-start.x,from.z-start.z)>.65)route.unshift(start);return route;}done.add(p.id);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const q=nav.get(p.ix+dx+(p.iz+dz)*nx);if(!q||q.ix!==p.ix+dx||q.iz!==p.iz+dz||done.has(q.id)||Math.abs(p.y-q.y)>1.05)continue;if(!canWalk(p,q))continue;const nc=cost.get(p.id)+1;if(nc<(cost.get(q.id)??Infinity)){prev.set(q.id,p.id);cost.set(q.id,nc);if(!open.includes(q))open.push(q);}}
  }return [];
 }
 rebuildNav();
 function reset(){for(const s of props){s.active=true;s.hp=s.maxHp;s.group.visible=true;if(s.label)s.label.visible=true;}for(const p of pickups){p.active=true;p.readyAt=0;p.group.visible=true;if(p.label)p.label.visible=true;}for(const c of camps){c.cleared=false;c.banner.material=g.mat(c.color);}for(const f of flags){f.complete=false;f.banner.material=g.mat(C.yellow);}for(const v of [...targets,...coins]){v.active=false;v.group.visible=false;}rebuildNav();}
 return {solids,cameraSolids,surfaces,props,pickups,pads,camps,flags,coins,targets,spawn,groundAt,blocked,cameraBlocked,walkable,canWalk,path,rebuildNav,reset,solid,pickup};
}
