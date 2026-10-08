// Classic-inspired hand-authored topology; no Valve binaries or textures are used.
const p=(x,z,y=0)=>({x,y,z});
const palette={brick:0xaa7866,steel:0x748792,metal:0x748792,concrete:0xb9b9ae,crate:0xa58a5a,sand:0xd5b78b,stone:0xb89972,wood:0x99764c};
const box=(x,z,w,d,h,material='brick',y=0,type='wall')=>({x,z,w,d,h,color:palette[material]??0xb8aaa0,y,type,material});
const slope=(x,z,w,d,rise,direction,y=0,material='concrete')=>({x,z,w,d,rise,direction,color:palette[material],y,type:'ramp',material});
const stairs=(x,z,w,d,rise,direction,y=0,material='concrete')=>{const n=Math.ceil(rise/.24),out=[];for(let i=0;i<n;i++){const q=(i+.5)/n,h=(i+1)*rise/n;out.push(box(x+(['east','west'].includes(direction)?(q-.5)*w:0),z+(['north','south'].includes(direction)?(q-.5)*d:0),['east','west'].includes(direction)?w/n:w,['north','south'].includes(direction)?d/n:d,direction==='west'||direction==='north'?rise-i*rise/n:h,material,y,'step'));}return out;};
const wall=(arr,x,z,w,d,h=5,material='brick',y=0)=>arr.push(box(x,z,w,d,h,material,y));
const teamSpawn=(x,z,y=0)=>Array.from({length:5},(_,i)=>p(x+(i%3-1)*2.2,z+Math.floor(i/3)*2.2,y));
const a=[];
// Assault warehouse (front to south), rear alley to north, broad external street.
wall(a,-23,-2,1,40,6.6);wall(a,23,-2,1,40,6.6);
// Three front segments create the broad rolling-shutter main entry.
wall(a,-17,18,12,1,6.6);wall(a,15,18,16,1,6.6);wall(a,-4,18,14,1,2.5,'steel',4.1);
// Rear opening at east, closed by an interactive door.
wall(a,-5,-22,36,1,6.6);wall(a,21,-22,4,1,6.6);wall(a,16,-22,6,1,3.6,'brick',3);
a.push({...box(16,-22,5.8,.35,3,'metal',0,'door'),id:'rear-door',open:false});
// Tall warehouse roof and upper internal walkway; a real ground aisle beneath.
a.push(box(-2,-2,42,38,.22,'metal',6.6,'roof'));
// Cut a roof opening for a branched duct reaching down to the upper walkway.
a.pop();a.push(box(-15,-5,16,32,.22,'metal',6.6,'roof'),box(6.5,-5,17,32,.22,'metal',6.6,'roof'),box(-4,-2,4,26,.22,'metal',6.6,'roof'),box(18,-14,8,14,.22,'metal',6.6,'roof'),box(18.8,8,9.6,20,.22,'metal',6.6,'roof'));
a.push(box(-17,-16,10,10,.2,'steel',3.0,'deck'),box(-17,-5,10,24,.2,'steel',3.0,'deck'),box(-7,-15,10,4,.2,'steel',3.0,'deck'));
a.push(...stairs(-17,11,6,8,3.2,'north'));
// Human-scale hostage-room doorway faces the upper landing.
wall(a,-12,-19.5,1,3,3.4,'brick',3.2);wall(a,-12,-12,1,2,3.4,'brick',3.2);wall(a,-17,-21,10,1,3.4,'brick',3.2);
wall(a,-22,-16,1,10,3.4,'brick',3.2);wall(a,-20,-11,4,1,3.4,'brick',3.2);wall(a,-12.7,-11,1.4,1,3.4,'brick',3.2);
// Walkway rails leave stair and room entrances open.
a.push(box(-11.85,-2,.18,15,.7,'steel',3.2,'rail'),box(-21.5,7,1,.18,.7,'steel',3.2,'rail'),box(-12.5,7,1,.18,.7,'steel',3.2,'rail'));
for(const [x,z,w,d,h] of [[-5,7,5,5,2.8],[6,8,5,4,2.6],[7,-5,5,5,3.5],[-3,-5,4,4,1.6],[16,0,4,6,2.2],[-16,-4,3,3,1.1]])a.push(box(x,z,w,d,h,'crate',0,'cover'));
// Exterior bridge, truck/loading platform and urban buildings.
a.push(box(-32,5,6,42,.35,'concrete',4.45,'deck'),...stairs(-32,30,6,8,4.8,'north'),...stairs(-32,-21,6,10,4.8,'south'));
a.push(box(-34,3,.22,40,.8,'steel',4.8,'rail'),box(-29.8,3,.22,40,.8,'steel',4.8,'rail'));
wall(a,-41,0,7,60,10,'brick');wall(a,34,-1,6,48,9,'brick');wall(a,0,44,37,4,8,'brick');wall(a,8,-34,31,3,7,'brick');
a.push(box(-7,29,9,4,2.2,'steel',0,'truck'),box(-10,29,3,4,3.1,'metal',0,'truck'),box(24,31,4,4,1.6,'crate',0,'cover'));
// Roof access ladder; roof exit onto open roof, a duct system above it.
const ladders=[{id:'roof-ladder',x:24.5,z:11,y0:0,y1:6.82,exit:p(23.1,11,6.82),bottom:p(24.5,11),normal:{x:-1,z:0}}];
// Duct trunk north/south and western branch, with low but usable interiors.
const duct=(x,z,w,d)=>{a.push(box(x,z,w,d,.12,'metal',7.3,'deck'),box(x,z,w,d,.12,'metal',8.52,'ceiling'));if(w>d){a.push(box(x,z-d/2,w,.12,1.1,'metal',7.42),box(x,z+d/2,w,.12,1.1,'metal',7.42));}else{a.push(box(x-w/2,z,.12,d,1.1,'metal',7.42),box(x+w/2,z,.12,d,1.1,'metal',7.42));}};
duct(16,0,2.8,18);duct(6,-8,22,2.8);duct(-4,-15,2.8,12);
// Open hatch at the end of the western branch: bullets and camera see down
// through the same opening used by the climb connection.
const hatchFloor=a.findIndex(s=>s.type==='deck'&&s.x===-4&&s.y===7.3);a.splice(hatchFloor,1,box(-4,-12.5,2.8,7,.12,'metal',7.3,'deck'));
// Union junctions: split side panels so the T junction has full interior width.
for(let i=a.length-1;i>=0;i--){const s=a[i];if(s.y===7.42&&((s.x===14.6)||(s.z===-9.4)||(s.x===16&&(s.z===-9||s.z===9))))a.splice(i,1);}
for(let i=a.length-1;i>=0;i--)if(a[i].y===7.42&&a[i].z===-6.6)a.splice(i,1);a.push(box(14.6,1.3,.12,15.4,1.1,'metal',7.42),box(7.3,-9.4,19.4,.12,1.1,'metal',7.42),box(4.7,-6.6,19.4,.12,1.1,'metal',7.42));
a.push(slope(16,12,2.8,6,.6,'north',6.82,'metal'));
// Downward duct chute ends onto upper landing, modeled as climb link.
ladders.push({id:'duct-drop',x:-4,z:-17,y0:3.2,y1:7.42,exit:p(-4,-15,7.42),bottom:p(-5.5,-17,3.2),normal:{x:0,z:1},duct:true});
a.push({...box(16,8.6,2.6,.12,1.08,'steel',7.42,'grille'),id:'roof-grille',hp:45});
const assault={id:'assault',name:'Assault 工业仓库',mode:'rescue',bounds:{x0:-47,x1:43,z0:-42,z1:47},terrain:a,spawns:{attack:teamSpawn(-8,38),defend:teamSpawn(4,-12)},sites:[{id:'A',...p(-4,10),radius:3,color:0xd5a44c},{id:'B',...p(16,-26),radius:3,color:0x709dcc}],hostagePositions:[p(-19,-16,3.2),p(-16,-18,3.2),p(-19,-19,3.2),p(-16,-15,3.2)],rescueZones:[{id:'street-rescue',...p(-19,36),radius:4.8}],ladders,lowZones:[{x0:14.5,x1:17.5,z0:-9.5,z1:15,y0:6.8,y1:8.7},{x0:-5.5,x1:17.5,z0:-9.5,z1:-6.5,y0:7.2,y1:8.7},{x0:-5.5,x1:-2.5,z0:-21,z1:-7,y0:7.2,y1:8.7}],tactics:[{id:'A',label:'正门突入'},{id:'B',label:'后门包抄'},{id:'C',label:'屋顶渗透'}],routeVariants:{A:[[p(-1,32),p(-4,20),p(-9,14),p(-17,15.8),p(-17,11,1.6),p(-17,4,3.2),p(-17,-9,3.2),p(-17,-16,3.2)],[p(12,26),p(12,19),p(11,2),p(-9,1),p(-17,15.8),p(-17,4,3.2),p(-17,-16,3.2)]],B:[[p(28,28),p(28,0),p(28,-27),p(16,-27),p(16,-18),p(-6,-18),p(-9,1),p(-17,15.8),p(-17,4,3.2),p(-17,-16,3.2)]],C:[[p(28,24),p(24.5,11),p(23.1,11,6.82),p(16,13,6.92),p(16,5,7.42),p(16,-8,7.42),p(-4,-8,7.42),p(-4,-15,7.42),p(-5.5,-17,3.2),p(-8,-15,3.2),p(-16,-9,3.2),p(-17,-16,3.2)]]},defensePositions:[p(-17,-12,3.2),p(-7,-15,3.2),p(13,-14),p(-9,3),p(4,1)],postPlantPositions:{A:[p(-9,3),p(12,2)],B:[p(14,-17),p(-8,-16,3.2)]},areas:[{name:'反恐救援街道',...p(-19,36)},{name:'仓库正门',...p(-4,19)},{name:'仓库箱区',...p(5,5)},{name:'后门巷道',...p(16,-27)},{name:'高架桥',...p(-32,4,4.8)},{name:'人质房',...p(-17,-17,3.2)},{name:'上层走道',...p(-17,0,3.2)},{name:'仓库屋顶',...p(4,6,6.82)},{name:'屋顶通风管',...p(16,-2,7.42)}],colors:{floor:0xb7b2a6,boundary:0x8e8173,accent:0xb7a25c},checklist:['front_entry','rear_door','warehouse_boxes','upper_stairs','upper_walkway','hostage_room','roof_ladder','branched_duct','duct_drop','street_bridge','rescue_zone']};
// Dust2 topology: south T spawn, west upper/lower tunnels and B; mid at center;
// east long doors/pit/long to A; elevated short/catwalk links mid to A.
const d=[];
// Polygonal arrangement authored as rooms/lanes with interrupted wall runs.
wall(d,-45,8,1,72,7,'stone');wall(d,44,7,1,75,7,'stone');wall(d,0,42,64,1,7,'stone');wall(d,-16,-37,57,1,7,'stone');wall(d,34,-37,20,1,7,'stone');
// T spawn courtyard south, separated from CT by a blind central block.
wall(d,-12,25,24,2,7,'stone');wall(d,18,25,14,2,7,'stone');wall(d,-.5,8,9,15,8,'stone');
// Mid (diagonal feeling through staggered side walls) and double doors.
wall(d,-10,5,2,34,7,'stone');wall(d,13,1,2,29,2.1,'stone');wall(d,-6,-16,9,1,6,'stone');wall(d,7,-16,7,1,6,'stone');
d.push(box(-3.2,-16,2.8,.22,4.5,'wood',0,'mid-door'),box(3.2,-15,2.8,.22,4.5,'wood',0,'mid-door'));
// Long doors entrance uses offset vestibule (no straight spawn-to-site ray).
wall(d,28,28,1,18,6,'stone');wall(d,36,21,15,1,6,'stone');wall(d,28,13,1,6,6,'stone');wall(d,20,17,16,1,6,'stone');
d.push(box(29.2,20,1,.2,4.3,'wood',0,'long-door'),box(33.5,21,.2,1.8,4.3,'wood',0,'long-door'));
// Longlane east of buildings, pit lower by 2m relative to raised long shoulder.
wall(d,28,-5,1,20,7,'stone');wall(d,34,8,12,1,5,'stone');
d.push(box(38,-2,11,22,2,'sand',0,'deck'),slope(38,12,11,6,2,'north',0,'sand'));
// Pit stays ground level behind outerwall and two overlapping cover lips.
d.push(box(35,16,3,5,1.4,'stone',0,'cover'));
// A platform at height3.2, longramp and CT ramp; catwalk short at2.1.
d.push(box(30,-26,25,18,3.2,'stone',0,'deck'),slope(38,-14,10,8,1.2,'north',2,'sand'),slope(17,-27,8,9,3.2,'east',0,'sand'));
d.push(box(21,-30,3,4,2.3,'crate',3.2,'cover'),box(31,-29,4,4,2.4,'crate',3.2,'cover'),box(36,-22,4,3,1.3,'crate',3.2,'cover'));
// Short/catwalk from T side ofmid, corner, stair up toAplatform.
d.push(box(8,18,8,12,.24,'stone',1.86,'deck'),slope(8,28,8,8,2.1,'north',0,'sand'),box(12,7,8,16,.24,'stone',1.86,'deck'),box(20,-6,9,10,.24,'stone',1.86,'deck'),box(16,-2,8,6,.24,'stone',1.86,'deck'),...stairs(23,-14,6,6,1.1,'north',2.1,'stone'));
wall(d,5,10,.25,23,.65,'stone',2.1);wall(d,15,9,.25,14,.65,'stone',2.1);wall(d,20,-1,9,.3,.65,'stone',2.1);
// CT spawn open region north ofmid; Bdoor/window two different entries.
wall(d,-18,-34,1,6,6,'stone');wall(d,-18,-24.5,1,3,6,'stone');wall(d,-18,-11.75,1,12.5,6,'stone');wall(d,-18,-28.5,1,5,1.7,'stone');wall(d,-18,-28.5,1,5,1.5,'stone',4.5);wall(d,-18,-20.5,1,5,2,'stone',4);
// B window at north-west connects CT floor via short2.2mstep/ramp.
d.push(box(-17.6,-28,.8,5,1.7,'stone',0,'sill'),slope(-14,-28,6,5,1.7,'west',0,'sand'),slope(-22,-28,7,5,1.7,'east',0,'sand'));
// Bcourtyard and platform, exitfrom upper tunnel southward.
wall(d,-39,-7,10,1,7,'stone');wall(d,-22,-7,8,1,7,'stone');wall(d,-21,-11,1,8,7,'stone');
d.push(box(-33,-28,15,13,.5,'sand',0,'deck'),slope(-33,-20,15,3,.5,'north',0,'sand'),box(-32,-29,4,4,2.7,'crate',.5,'cover'),box(-26,-19,4,4,2.3,'crate',0,'cover'),box(-40,-19,4,4,2.6,'crate',0,'cover'),box(-33,-11,3,2,1.1,'crate',0,'cover'));
// Upper tunnels southwest room, vaultedroof; lower tunnel links mid.
wall(d,-38,14,1,28,6,'stone');wall(d,-22,20,1,16,6,'stone');wall(d,-30,28,17,1,6,'stone');wall(d,-30,3,17,1,3.3,'stone',2.7);
d.push(box(-30,16,16,24,.25,'stone',5.6,'ceiling'),box(-30,4,16,4,.25,'stone',5.6,'ceiling'),box(-28,15,4,4,2.0,'crate',1.6,'cover'));
// Upper tunnel floor is raised; a real stair flight descends to lower tunnels.
d.push(box(-30,16,16,24,1.6,'stone',0,'deck'),slope(-30,32,8,8,1.6,'north',0,'sand'),slope(-30,1,8,6,1.6,'south',0,'sand'),...stairs(-19,5,6,5,1.6,'west',0,'stone'));
// Lower tunnel passage underraisedcatwalk; open entry to mid and stairtransition.
wall(d,-17,10,10,1,5,'stone');wall(d,-19,0,6,1,5,'stone');d.push(box(-17,5,10,10,.2,'stone',4.8,'ceiling'));
// Courtyard accentsallsolidshared cover; no arbitraryroads fromoldmaps.
for(const [x,z,w,dd,h] of [[-4,34,4,3,1.5],[18,33,4,4,1.8],[2,-27,4,3,1.4],[39,-31,2,3,1.2]])d.push(box(x,z,w,dd,h,'crate',0,'cover'));
const dust2={id:'dust2',name:'Dust2 沙漠城镇',mode:'bomb',bounds:{x0:-49,x1:49,z0:-42,z1:47},terrain:d,spawns:{attack:teamSpawn(3,36),defend:teamSpawn(7,-34)},sites:[{id:'A',...p(29,-26,3.2),radius:4.5,color:0xd58a48},{id:'B',...p(-33,-26,.5),radius:4.5,color:0x6885ac}],hostagePositions:[],rescueZones:[],ladders:[],lowZones:[],tactics:[{id:'A',label:'进攻 A 点'},{id:'B',label:'进攻 B 点'}],routeVariants:{A:[[p(21,34),p(24,22),p(32,17),p(39,14),p(39,6,2),p(38,-11,2),p(38,-18,3.2),p(29,-26,3.2)],[p(8,31),p(8,20,2.1),p(12,11,2.1),p(12,0,2.1),p(20,-3,2.1),p(23,-11,2.1),p(23,-17,3.2),p(29,-26,3.2)],[p(-7,20),p(-7,0),p(-1,-13),p(6,-21),p(12,-27),p(21,-27,3.2),p(29,-26,3.2)]],B:[[p(-19,34),p(-30,35,.2),p(-32,22,1.6),p(-32,10,1.6),p(-30,0,.5333333333333333),p(-30,-4),p(-30,-12),p(-32,-19),p(-33,-26,.5)],[p(-7,20),p(-7,5),p(-15,5),p(-24,5,1.6),p(-30,7,1.6),p(-30,0,.5333333333333333),p(-30,-4),p(-30,-12),p(-33,-26,.5)],[p(-7,20),p(-7,-10),p(1,-20),p(-10,-23),p(-23,-21),p(-33,-26,.5)]]},defensePositions:[p(27,-31,3.2),p(-35,-32,.5),p(7,-22),p(25,-19,3.2),p(-23,-24)],postPlantPositions:{A:[p(26,-20,3.2),p(40,-24,3.2),p(14,-27)],B:[p(-39,-30,.5),p(-24,-23),p(-32,-3)]},areas:[{name:'T 出生庭院',...p(3,36)},{name:'A 大双门',...p(30,21)},{name:'A 大道',...p(38,-2,2)},{name:'坑位',...p(40,17)},{name:'A 包点平台',...p(29,-26,3.2)},{name:'A 斜坡',...p(16,-27,1.6)},{name:'A 小道楼梯',...p(23,-13,2.65)},{name:'中路猫道',...p(12,9,2.1)},{name:'中路',...p(-4,2)},{name:'中门',...p(0,-16)},{name:'上层隧道',...p(-32,16,1.6)},{name:'下层隧道',...p(-17,5)},{name:'B 隧道出口',...p(-25,-3)},{name:'B 双门',...p(-18,-21)},{name:'B 窗口',...p(-18,-28,1.7)},{name:'B 包点平台',...p(-33,-26,.5)},{name:'CT 出生区',...p(4,-28)}],colors:{floor:0xd7c29c,boundary:0xba9c72,accent:0xb67445},checklist:['t_spawn','long_double_doors','pit','long_lane','a_platform','a_ramp','short_stairs','catwalk','middle','mid_doors','upper_tunnel','lower_tunnel','b_tunnel_exit','b_doors','b_window','b_platform','ct_spawn']};
export const MAPS=[assault,dust2];
for(const m of MAPS){m.spawns.CT=m.mode==='rescue'?m.spawns.attack:m.spawns.defend;m.spawns.T=m.mode==='rescue'?m.spawns.defend:m.spawns.attack;m.routes=Object.fromEntries(Object.entries(m.routeVariants).map(([id,r])=>[id,r[0]]));m.defenseByTactic=Object.fromEntries(m.tactics.map(t=>[t.id,m.defensePositions]));m.hostageSpawns=m.hostagePositions;}
