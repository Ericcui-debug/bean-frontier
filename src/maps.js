import {C} from './gfx.js';
const p=(x,z,y=0)=>({x,y,z});
const box=(x,z,w,d,h,color=C.cream,y=0,type='wall')=>({x,z,w,d,h,color,y,type});
const slope=(x,z,w,d,rise,direction,color=C.purple,y=0)=>({x,z,w,d,rise,direction,color,y,type:'ramp'});
const spawn=(z)=>Array.from({length:5},(_,i)=>p((i-2)*2,z+(i%2?1:0)));
// Hand-authored architecture, tactical routes and vertical circulation. All
// structural shapes below are shared by rendering, collision and navigation.
function house(x,z,w,d,color,door='south',roof=2.8){
 const t=.45,parts=[];for(const side of ['west','east','north','south']){
  const horizontal=['north','south'].includes(side),cx=horizontal?x:x+(side==='west'?-w/2:w/2),cz=horizontal?z+(side==='north'?-d/2:d/2):z;
  if(side===door){const length=(horizontal?w:d)-3.2,offset=length/4+1.6;for(const sign of [-1,1])parts.push(box(cx+(horizontal?sign*offset:0),cz+(horizontal?0:sign*offset),horizontal?length/2:t,horizontal?t:length/2,roof,color));}
  else parts.push(box(cx,cz,horizontal?w:t,horizontal?t:d,roof,color));
 }parts.push(box(x,z,w+.35,d+.35,.18,C.cream,roof,roof===2.8?'deck':'roof'));return parts;
}
const townTerrain=[
 box(0,16,16,2.2,3.0,C.orange),box(0,-19,15,2,3.0,C.blue),
 ...house(-10,6,8,10,C.pink,'west'),...house(10,-7,8,10,C.mint,'east'),
 ...house(-23,-16,9,7,C.orange,'south'),...house(23,15,9,7,C.blue,'north'),
 box(-8,-7,6,6,3,C.purple),box(9,9,6,5,3,C.yellow),
 box(0,1,4,5,2.6,C.teal),box(-23,3,3,3,1.05,C.cream),box(23,-3,3,3,1.05,C.yellow),
 box(-18,-11,4,1.2,1.0,C.yellow),box(25,-11,4,1.2,1.0,C.cream),
 // Two-direction ramp circulation and a balcony above a real walkable shop.
 slope(-10,14,4,6,2.98,'north',C.pink),slope(17,-10.8,6,4,2.98,'west',C.mint),
 box(-10,1,8.4,.25,.5,C.pink,2.98,'rail'),box(10,-12,8.4,.25,.5,C.mint,2.98,'rail')
];
const factoryTerrain=[
 box(0,15,15,2.2,3,C.orange),box(0,-18,14,2,3,C.blue),
 // Production halls with wide doorways, open maintenance aisles and roof lights.
 ...house(-19,-3,13,13,C.yellow,'south',2.6),...house(19,-3,13,13,C.blue,'south',2.6),
 // Open north service doors: replace the middle of each north wall below.
 box(-6,1,2,15,3,C.teal),box(6,3,2,9,3,C.purple),
 box(-19,-4,4,3,1.0,C.orange),box(19,-4,4,3,1.0,C.cream),
 box(-24,11,3,5,1.1,C.yellow),box(24,11,3,5,1.1,C.purple),
 box(-9,-12,4,2,1.1,C.cream),box(10,-12,4,2,1.1,C.yellow),
 // Catwalk has ground-level passage beneath it and two opposing ramps.
 box(0,-7,10,3,.2,C.orange,2.2,'deck'),
 slope(-8,-7,6,3,2.4,'east',C.orange),slope(8,-7,6,3,2.4,'west',C.orange),
 box(0,-8.55,10,.2,.45,C.cream,2.4,'rail'),
 box(0,-5.45,3,.2,.45,C.cream,2.4,'rail'),
 box(-4,-7,.5,.5,2.2,C.teal),box(4,-7,.5,.5,2.2,C.teal)
];
// Open service doors provide two genuinely separate entries to both halls.
for(const x of [-19,19]){const index=factoryTerrain.findIndex(s=>s.x===x&&s.z===-9.5&&s.type==='wall');factoryTerrain.splice(index,1,box(x-4.05,-9.5,4.9,.45,2.6,x<0?C.yellow:C.blue),box(x+4.05,-9.5,4.9,.45,2.6,x<0?C.yellow:C.blue));}
const harborTerrain=[
 box(0,16,17,2.3,3,C.blue),box(0,-20,16,2,3,C.orange),
 // Different length container banks force turns before a long exterior lane.
 box(-10,7,6,10,2.5,C.orange),box(10,-8,6,10,2.5,C.blue),
 box(-8,-7,5,6,2.5,C.purple),box(11,9,5,7,2.5,C.mint),
 ...house(23,-4,13,14,C.teal,'south',2.6),
 box(-28,-12,3,2,1.05,C.yellow),box(-18,-1,3,3,1.0,C.cream),
 box(23,-5,3,4,1.05,C.orange),box(-25,10,3,6,1.2,C.orange),
 // Elevated loading pier reached from south; second ramp returns through middle.
 box(-23,-18,14,6,.15,C.yellow,1.65,'deck'),
 slope(-23,-12,5,6,1.8,'north',C.yellow),slope(-13,-18,6,4,1.8,'west',C.yellow),
 box(-23,-21.15,14,.2,.45,C.cream,1.8,'rail'),
 box(-30.15,-18,.2,6,.45,C.cream,1.8,'rail')
];
const northWarehouse=harborTerrain.findIndex(s=>s.x===23&&s.z===-11&&s.type==='wall');harborTerrain.splice(northWarehouse,1,box(18.95,-11,4.9,.45,2.6,C.teal),box(27.05,-11,4.9,.45,2.6,C.teal));
const common=(id,name,w,d,terrain,sites,routes,areas,colors)=>({id,name,bounds:{x0:-w/2,x1:w/2,z0:-d/2,z1:d/2},terrain,sites:sites.map((s,i)=>({...s,id:i?'B':'A',radius:3.0,color:i?C.blue:C.orange})),spawns:{attack:spawn(d/2-5),defend:spawn(-d/2+4)},routeVariants:routes,areas,colors});
export const MAPS=[
 common('town','糖果小镇',64,56,townTerrain,[p(-20,-6),p(20,-6)],{
  A:[[p(-16,21),p(-20,10),p(-20,-6)],[p(0,10),p(-3,-8),p(-16,-6),p(-20,-6)]],
  B:[[p(18,21),p(20,8),p(20,-6)],[p(0,10),p(3,-2),p(16,-1),p(20,-6)]]
 },[{name:'糖果主街',x:0,z:7},{name:'棒棒糖广场',x:-20,z:-6},{name:'奶油庭院',x:20,z:-6},{name:'草莓商店',x:-10,z:6}],{floor:0xdbe5c4,boundary:C.teal,accent:C.pink}),
 common('factory','积木工厂',60,54,factoryTerrain,[p(-19,-1),p(19,-1)],{
  A:[[p(-13,21),p(-19,8),p(-19,-1)],[p(-11,0),p(-12,-14),p(-19,-13),p(-19,-1)]],
  B:[[p(13,21),p(19,8),p(19,-1)],[p(11,3),p(13,-14),p(19,-13),p(19,-1)]]
 },[{name:'生产大厅 A',x:-19,z:-1},{name:'包装车间 B',x:19,z:-1},{name:'维修中路',x:0,z:4},{name:'装卸连桥',x:0,z:-7,y:2.4}],{floor:0xe1e6e1,boundary:C.purple,accent:C.yellow}),
 common('harbor','奶油港口',68,56,harborTerrain,[p(-22,-5),p(23,-1)],{
  A:[[p(-17,21),p(-20,12),p(-22,-5)],[p(0,9),p(-3,-12),p(-16,-5),p(-22,-5)]],
  B:[[p(18,21),p(23,8),p(23,-1)],[p(0,9),p(4,0),p(15,1),p(23,8),p(23,-1)],[p(4,-16),p(23,-15),p(23,-1)]]
 },[{name:'集装箱通道',x:-20,z:8},{name:'糖霜码头 A',x:-22,z:-5},{name:'冷库 B',x:23,z:-1},{name:'装卸平台',x:-23,z:-18,y:1.8}],{floor:0xcde4e7,boundary:C.blue,accent:C.orange})
];
for(const m of MAPS){const [A,B]=m.sites;m.routes={A:m.routeVariants.A[0],B:m.routeVariants.B[0]};m.defensePositions=[p(A.x,A.z-3.6),p(B.x,B.z-3.6),p(-11,-16),p(11,-16),p(0,-11)];m.defenseByTactic={A:[p(A.x,A.z-3.6),p(A.x-4,A.z+2),p(-13,-14),p(B.x,B.z-3.6),p(0,-11)],B:[p(A.x,A.z-3.6),p(B.x,B.z-3.6),p(13,-14),p(B.x+4,B.z+2),p(0,-11)]};m.postPlantPositions={A:[p(A.x-4,A.z+2),p(A.x+4,A.z+2),p(A.x,A.z-3.7)],B:[p(B.x-4,B.z+2),p(B.x+4,B.z+2),p(B.x,B.z-3.7)]};}
// Guard anchors are authored around actual cover rather than guessed offsets.
MAPS[0].defenseByTactic.B[3]=p(25,-8);
MAPS[0].postPlantPositions.B[1]=p(25,-8);
for(const key of ['defensePositions']){MAPS[1][key][0]=p(-23,-5);MAPS[1][key][1]=p(23,-5);MAPS[2][key][1]=p(27,-5);}
MAPS[1].defenseByTactic.A[0]=p(-23,-5);MAPS[1].defenseByTactic.A[3]=p(23,-5);MAPS[1].defenseByTactic.B[0]=p(-23,-5);MAPS[1].defenseByTactic.B[1]=p(23,-5);
MAPS[1].postPlantPositions.A[2]=p(-23,-5);MAPS[1].postPlantPositions.B[2]=p(23,-5);
MAPS[2].defenseByTactic.A[3]=p(27,-5);MAPS[2].defenseByTactic.B[1]=p(27,-5);MAPS[2].postPlantPositions.B[2]=p(27,-5);
MAPS[0].defenseByTactic.A[2]=p(-10,6,2.98);MAPS[0].defenseByTactic.B[2]=p(10,-7,2.98);
MAPS[0].postPlantPositions.A.push(p(-10,6,2.98));MAPS[0].postPlantPositions.B.push(p(10,-7,2.98));
MAPS[1].defenseByTactic.A[2]=p(-2,-7,2.4);MAPS[1].defenseByTactic.B[2]=p(2,-7,2.4);
MAPS[1].postPlantPositions.A.push(p(-2,-7,2.4));MAPS[1].postPlantPositions.B.push(p(2,-7,2.4));
MAPS[2].defenseByTactic.A[2]=p(-23,-18,1.8);MAPS[2].postPlantPositions.A.push(p(-23,-18,1.8));
