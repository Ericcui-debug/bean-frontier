import {THREE,C} from './gfx.js';
import {segmentSolid,clamp} from './physics.js';
// Every solid and ramp below is simultaneously render geometry, body terrain,
// bullet occlusion, and navigation. No invisible walls inside the arena.
export function createWorld(g){
 const solids=[],surfaces=[],bounds={x0:-28,x1:28,z0:-25,z1:25};
 function solid(x,z,w,d,h,color,y=0,type='wall'){
  const group=new THREE.Group();g.scene.add(group);group.position.set(x,y,z);g.box(0,h/2,0,w,h,d,color,group);
  const s={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:y,y1:y+h,active:true,group,type};solids.push(s);return s;
 }
 function ramp(x,z,w,d,rise,color){
  const A=[-w/2,0,d/2],B=[w/2,0,d/2],D=[w/2,rise,-d/2],E=[-w/2,rise,-d/2],F=[-w/2,0,-d/2],H=[w/2,0,-d/2];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([...A,...B,...E,...B,...D,...E,...A,...E,...F,...B,...H,...D,...F,...E,...D,...F,...D,...H,...A,...F,...H,...A,...H,...B],3));geometry.computeVertexNormals();
  const group=new THREE.Group();g.scene.add(group);group.position.set(x,0,z);g.mesh(geometry,color,group);
  const s={x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,y0:0,y1:rise,rise,shape:'ramp',active:true,group,type:'ramp'};solids.push(s);surfaces.push(s);return s;
 }
 // Enclosed toy plaza floating above a turquoise sea.
 const sea=g.mesh(new THREE.PlaneGeometry(1000,1000),0x76cbd8);sea.rotation.x=-Math.PI/2;sea.position.y=-3;sea.castShadow=false;
 solid(0,0,58,52,2,C.cream,-2,'floor');g.box(0,.004,0,56,.008,50,0xd2e6c3);
 for(const [x,z,w,d] of [[-28,0,1,50],[28,0,1,50],[0,-25,57,1],[0,25,57,1]])solid(x,z,w,d,4.4,C.teal,0,'boundary');
 for(const z of [-25,25])g.box(0,4.5,z,57,.18,1.1,C.cream);
 for(const x of [-28,28])g.box(x,4.5,0,1.1,.18,50,C.cream);
 // Routes have contrasting floor insets. The staggered middle blocks deny spawn LOS.
 for(const [x,z,w,d,c] of [[-19,0,9,42,0xf2d5b4],[19,0,9,42,0xc4d9ee],[0,0,8,43,0xe8dcef],[-10,5,14,5,0xf2d5b4],[10,-10,14,5,0xc4d9ee]])g.box(x,.013,z,w,.016,d,c);
 for(const [x,z,w,d,h,c] of [
  [0,13,15,2,3.4,C.orange],[0,-16,15,2,3.4,C.blue],
  [-6,5,4,10,4.3,C.purple],[6,-7,4,10,4.3,C.orange],
  [0,0,4,4,3.4,C.teal],[-6,-7,4,4,3.4,C.purple],[6,6,4,4,3.4,C.yellow],
  [-23,5,3,7,2.8,C.orange],[23,4,3,7,2.8,C.blue],
  [-18,-12,5,2,2.5,C.orange],[18,-12,5,2,2.5,C.blue],
  [-11,-1,2,5,2.5,C.teal],[11,0,2,5,2.5,C.teal],
  [-22,-7,2.2,2.2,1.15,C.cream],[-14,-6,2.2,2.2,1.15,C.yellow],
  [22,-6,2.2,2.2,1.15,C.cream],[14,-7,2.2,2.2,1.15,C.yellow],
  [-14,15,2,3,1.4,C.cream],[14,15,2,3,1.4,C.cream],
  [-24,-18,3,3,2.2,C.purple],[24,-18,3,3,2.2,C.purple]
 ]){const s=solid(x,z,w,d,h,c);solid(x,z,w+.08,d+.08,.12,C.cream,h,'trim');
  if(h>3){g.box(x,h*.64,z+d/2+.006,w*.6,.5,.012,C.cream);}
 }
 // A small watch deck and a gradual ramp; neither bomb site needs jumping.
 solid(-10,-13,3,4,.8,C.purple,0,'deck');ramp(-10,-9,3,4,.8,C.purple);
 const sites=[{id:'A',x:-18,y:0,z:-6,radius:3.2,color:C.orange},{id:'B',x:18,y:0,z:-6,radius:3.2,color:C.blue}];
 for(const site of sites){const ring=g.mesh(new THREE.TorusGeometry(site.radius,.055,5,48),site.color);ring.rotation.x=-Math.PI/2;ring.position.set(site.x,.04,site.z);g.box(site.x,.025,site.z,3.2,.03,3.2,site.color);const l=g.label(site.id,site.x,3.1,site.z,{size:.75});l.userData.site=true;}
 const spawns={attack:Array.from({length:5},(_,i)=>({x:-4+i*2,y:0,z:20+(i%2)})),defend:Array.from({length:5},(_,i)=>({x:4-i*2,y:0,z:-21-(i%2)}))};
 const routes={A:[{x:-10,y:0,z:17},{x:-18,y:0,z:10},{x:-18,y:0,z:2},{x:-18,y:0,z:-6}],B:[{x:10,y:0,z:17},{x:18,y:0,z:10},{x:18,y:0,z:2},{x:18,y:0,z:-6}]};
 const defensePositions=[{x:-18,y:0,z:-10},{x:18,y:0,z:-10},{x:-10,y:0,z:-17},{x:10,y:0,z:-17},{x:0,y:0,z:-10}];
 g.label('糖果竞技场',0,7,-23,{size:1.2});
 // Decorative towers sit outside the arena, never on navigable routes.
 for(let i=0;i<10;i++){const x=i<5?-34:34,z=-22+(i%5)*11;g.cylinder(x,1,z,2.3,7,[C.pink,C.purple,C.orange][i%3]);g.ball(x,5,z,2.5,1.3,2.5,C.cream);}
 function groundAt(x,z,maxY=Infinity){if(x<bounds.x0||x>bounds.x1||z<bounds.z0||z>bounds.z1)return null;let h=0;
  for(const s of solids){if(!s.active||x<s.x0||x>s.x1||z<s.z0||z>s.z1)continue;const y=s.shape==='ramp'?s.y0+s.rise*clamp((s.z1-z)/(s.z1-s.z0),0,1):s.y1;if(y<=maxY+.001)h=Math.max(h,y);}return h;}
 function blocked(a,b,pad=0){let best=null;for(const s of solids){if(!s.active)continue;const h=segmentSolid(a,b,s,pad);if(h&&(!best||h.t<best.t))best={...h,solid:s};}return best;}
 function walkable(x,z){const h=groundAt(x,z,.85);if(h===null)return null;for(const s of solids){if(!s.active||s.shape==='ramp'||s.y1<=h+.38||s.y0>=h+1.94)continue;if(x>s.x0-.58&&x<s.x1+.58&&z>s.z0-.58&&z<s.z1+.58)return null;}return h;}
 function canWalk(a,b,radius=.56){let h=groundAt(a.x,a.z,(a.y??.8)+.38);if(h===null)return false;const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.3));
  for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,next=groundAt(x,z,h+.38);if(next===null||Math.abs(next-h)>.38)return false;h=next;for(const s of solids){if(!s.active||s.shape==='ramp'||s.y1<=h+.38||s.y0>=h+1.94)continue;if(x>s.x0-radius&&x<s.x1+radius&&z>s.z0-radius&&z<s.z1+radius)return false;}}return Math.abs(h-(b.y??groundAt(b.x,b.z,.85)))<=.38;
 }
 const cell=1.5,nx=37,nz=33,nav=new Map();
 function rebuildNav(){nav.clear();for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++){const x=-27+ix*cell,z=-24+iz*cell,y=walkable(x,z);if(y!==null)nav.set(ix+iz*nx,{id:ix+iz*nx,ix,iz,x,y,z,neighbors:[]});}for(const p of nav.values())for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const q=nav.get(p.id+dx+dz*nx);if(q&&q.ix===p.ix+dx&&q.iz===p.iz+dz&&canWalk(p,q))p.neighbors.push(q.id);}}
 function nearest(a,linked=false){let best=null,d=Infinity;for(const p of nav.values()){const n=(p.x-a.x)**2+(p.z-a.z)**2;if(n<d&&(!linked||canWalk(a,p,.52))){best=p;d=n;}}return best;}
 function path(from,to){if(canWalk(from,to))return [{...to,y:to.y??groundAt(to.x,to.z,.85)}];const a=nearest(from,true),b=nearest(to);if(!a||!b)return [];const open=[a.id],cost=new Map([[a.id,0]]),parent=new Map(),closed=new Set();
  while(open.length){let index=0,best=Infinity;for(let i=0;i<open.length;i++){const p=nav.get(open[i]),f=cost.get(p.id)+Math.hypot(p.ix-b.ix,p.iz-b.iz);if(f<best){best=f;index=i;}}const id=open.splice(index,1)[0];if(id===b.id){const route=[];let k=id;while(k!==a.id){route.push(nav.get(k));k=parent.get(k);}route.push(a);route.reverse();if(canWalk(b,to))route.push({...to,y:to.y??b.y});return route;}closed.add(id);for(const next of nav.get(id).neighbors){if(closed.has(next))continue;const nc=cost.get(id)+1;if(nc<(cost.get(next)??Infinity)){cost.set(next,nc);parent.set(next,id);if(!open.includes(next))open.push(next);}}}return [];
 }
 rebuildNav();
 return {bounds,solids,surfaces,cameraSolids:[],sites,spawns,spawn:spawns.attack[0],routes,defensePositions,groundAt,blocked,cameraBlocked:blocked,walkable,canWalk,path,rebuildNav,reset(){},solid,nav};
}
