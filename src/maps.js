// Hand-authored solids calibrated against the CS1.6 reference BSP measurements.
// Only measurements are retained; no reference BSP, texture or engine ships.
export const CLASSIC_UNIT=1.552/72;
const p=(x,z,y=0)=>({x,y,z});
const palette={brick:0xaa7866,steel:0x748792,metal:0x748792,concrete:0xb9b9ae,crate:0xa58a5a,sand:0xd5b78b,stone:0xb89972,plaster:0xd8c49e,wood:0x99764c};
const box=(x,z,w,d,h,material='brick',y=0,type='wall')=>({x,z,w,d,h,color:palette[material],y,type,material});
function author(xShift,yCenter,zBase=0){
 const terrain=[],U=CLASSIC_UNIT,Q=(x,z,y=0)=>p((x+xShift)*U,(yCenter-z)*U,(y-zBase)*U);
 const B=(x0,x1,z0,z1,y0,y1,material='brick',type='wall',extra={})=>{const q=Q((x0+x1)/2,(z0+z1)/2,y0),s={...box(q.x,q.z,(x1-x0)*U,(z1-z0)*U,(y1-y0)*U,material,q.y,type),...extra};terrain.push(s);return s;};
 const R=(x0,x1,z0,z1,y0,y1,direction,material='concrete')=>{const q=Q((x0+x1)/2,(z0+z1)/2,y0);const s={...q,w:(x1-x0)*U,d:(z1-z0)*U,rise:(y1-y0)*U,direction,color:palette[material],type:'ramp',material};terrain.push(s);return s;};
 const S=(x0,x1,z0,z1,y0,y1,direction,material='concrete')=>{const n=Math.ceil((y1-y0)*U/.24);for(let i=0;i<n;i++){const horizontal=['east','west'].includes(direction),reverse=['west','north'].includes(direction),t0=i/n,t1=(i+1)/n,h=reverse?y1-i*(y1-y0)/n:y0+(i+1)*(y1-y0)/n;B(horizontal?x0+t0*(x1-x0):x0,horizontal?x0+t1*(x1-x0):x1,horizontal?z0:z1-t1*(z1-z0),horizontal?z1:z1-t0*(z1-z0),y0,h,material,'step');}};
 const W=(x0,x1,z0,z1,y0=0,y1=512,material='brick')=>B(x0,x1,z0,z1,y0,y1,material);
 return {terrain,Q,B,R,S,W};
}
const as=author(256,1800),{Q:A,B:AB,R:AR,S:AS,W:AW}=as;
// Warehouse: measured 1408 x 1344 units; upper room is an annex, not a
// ground-floor room inside an oversized symmetric warehouse.
AW(-720,-704,1536,2880,0,336);AW(-720,-704,1536,2368,336,512);AW(-720,-704,2816,2880,336,512);AW(-720,-704,2368,2816,480,512);AW(704,720,1536,1744);AW(704,720,1744,1984,0,392);AW(704,720,1984,2176);AW(704,720,2256,2880);
AW(-704,-576,1536,1552);AW(512,704,1536,1552);AW(-576,512,1536,1552,256,512,'steel');
AW(-704,704,2880,2896);AW(704,720,2176,2256,112,512);
AB(704,720,2176,2256,0,112,'metal','door',{id:'rear-door',open:false});
// South mezzanine and narrow west catwalk retain ground-level space below.
AB(-688,448,1616,1696,288,304,'steel','deck');
AB(-688,-576,1696,2256,288,304,'steel','deck');
AR(-560,-400,1728,2240,0,304,'north');
AB(-576,-400,2240,2256,288,304,'steel','deck');
AS(-576,-400,2256,2336,304,336,'north');
AB(-688,-448,2336,2752,320,336,'steel','deck');
AB(-688,448,2752,2880,320,336,'steel','deck');
// Rear freight dais and access steps, beneath the hostage gallery.
AB(-688,-96,2368,2640,0,128,'concrete','deck');
AS(-448,-288,2240,2368,0,128,'north');
// Hostage office is outside the west wall; its actual upper double-door span
// remains open here, while the east service door is the interactive rear door.
AB(-1152,-704,2368,2816,320,336,'steel','deck');
// Flush doorway threshold bridges the wall-to-gallery seam.
AB(-720,-672,2496,2624,320,336,'steel','deck');
AW(-1168,-1152,2368,2816,336,480);AW(-1152,-704,2816,2832,336,480);AW(-1152,-704,2352,2368,336,480);
AW(-720,-704,2368,2496,336,480);AW(-720,-704,2624,2816,336,480);AW(-720,-704,2496,2624,448,480);
AB(-1168,-704,2352,2832,480,496,'metal','roof');
// Rails are outside the walkable strip, with the staircase opening left clear.
AB(-576,-568,1696,1856,304,344,'steel','rail');AB(-576,-568,2240,2256,304,344,'steel','rail');
AB(-448,-440,2336,2752,336,376,'steel','rail');AB(-440,448,2744,2752,336,376,'steel','rail');
for(const q of [[-320,-96,1792,1952,0,128],[160,384,1856,2080,0,160],[352,512,2528,2688,0,96],[-96,96,2400,2528,0,96],[512,672,1696,1824,0,64],[-496,-384,2560,2640,128,208]])AB(...q,'crate','cover');
AB(-144,16,1576,1660,0,44,'steel','cover');
// Roof is split around two genuinely open service shafts and a ladder notch.
const roofCuts=[[ -48,48,2128,2240],[-640,-560,2424,2504],[640,720,1744,1984]];
let roofRects=[[-720,720,1536,2896]];
for(const [cx0,cx1,cz0,cz1]of roofCuts){const next=[];for(const [x0,x1,z0,z1]of roofRects){const lx=Math.max(x0,cx0),rx=Math.min(x1,cx1),lz=Math.max(z0,cz0),rz=Math.min(z1,cz1);if(lx>=rx||lz>=rz){next.push([x0,x1,z0,z1]);continue;}if(x0<lx)next.push([x0,lx,z0,z1]);if(rx<x1)next.push([rx,x1,z0,z1]);if(z0<lz)next.push([lx,rx,z0,lz]);if(rz<z1)next.push([lx,rx,rz,z1]);}roofRects=next;}
for(const r of roofRects)AB(...r,496,512,'metal','roof');
AB(704,800,1712,1760,376,392,'metal','deck');AR(640,800,1760,1984,392,512,'north','metal');AB(704,800,1984,2048,496,512,'metal','deck');
// Low ducts retain their measured height; local width is 96 units (2.07m)
// so two 0.848m beans can yield instead of blocking a whole squad.
AB(-48,48,2240,2752,428,436,'metal','deck');AB(-48,48,2240,2752,488,496,'metal','ceiling');
AB(48,56,2240,2752,436,488,'metal');
AB(-56,-48,2240,2408,436,488,'metal');AB(-56,-48,2520,2752,436,488,'metal');
AB(-576,-48,2416,2512,428,436,'metal','deck');AB(-640,-48,2416,2512,488,496,'metal','ceiling');
AB(-640,-48,2408,2416,436,488,'metal');AB(-640,-48,2512,2520,436,488,'metal');
AB(-48,48,2312,2320,436,486,'steel','grille',{id:'roof-grille',hp:45});
// Street, elevated bridge and offset frontage establish genuine exterior lanes.
AB(-1792,-1408,576,2112,240,256,'concrete','deck');AR(-1792,-1408,320,704,0,256,'north');AR(-1792,-1408,1984,2368,0,256,'south');
AB(-1792,-1784,576,2112,256,300,'steel','rail');AB(-1416,-1408,576,2112,256,300,'steel','rail');
AW(-2720,-2304,-128,2880,0,640);AW(-2304,-2176,128,416,0,512);AW(-2304,-2176,1856,2496,0,512);
AW(-1216,-544,448,960,0,384);AW(832,1280,576,1728,0,512);AW(-512,704,-128,-64,0,512);AW(-720,448,3008,3136,0,640);
AB(448,704,128,352,0,104,'metal','truck');AB(384,448,128,288,0,144,'steel','truck');
AB(-848,-624,1280,1408,0,64,'crate','cover');AB(912,1056,2496,2640,0,112,'crate','cover');
const ladders=[{id:'roof-ladder',...A(744,1744),y0:0,y1:392*CLASSIC_UNIT,bottom:A(744,1744),exit:A(744,1744,392),normal:{x:-1,z:0}},{id:'roof-vent',...A(0,2184),y0:436*CLASSIC_UNIT,y1:512*CLASSIC_UNIT,bottom:A(0,2272,436),exit:A(0,2120,512),normal:{x:0,z:1},duct:true},{id:'duct-drop',...A(-608,2464),y0:336*CLASSIC_UNIT,y1:436*CLASSIC_UNIT,bottom:A(-624,2464,336),exit:A(-552,2464,436),normal:{x:1,z:0},duct:true}];
const region=(name,q)=>({name,...q}),bound=(Q,x0,x1,z0,z1)=>{const a=Q(x0,z0),b=Q(x1,z1);return{x0:a.x,x1:b.x,z0:b.z,z1:a.z};};
const assault={id:'assault',name:'Assault 工业仓库',mode:'rescue',bounds:bound(A,-2720,1280,-1088,3136),boundaryHeight:18,terrain:as.terrain,spawns:{attack:[A(-576,128),A(-576,352),A(-320,128),A(-320,352),A(-832,128)],defend:[A(-1088,2416,336),A(-960,2416,336),A(-832,2416,336),A(-1088,2752,336),A(-960,2752,336)]},sites:[{id:'A',...A(0,1800),radius:3,color:0xd5a44c},{id:'B',...A(768,2216),radius:3,color:0x709dcc}],hostagePositions:[A(-1056,2592,336),A(-992,2592,336),A(-760,2720,336),A(-800,2720,336)],rescueZones:[{id:'street-rescue',...A(-576,192),radius:4.8}],ladders,lowZones:[{...bound(A,-64,64,2112,2768),y0:428*CLASSIC_UNIT,y1:504*CLASSIC_UNIT},{...bound(A,-656,-32,2400,2528),y0:428*CLASSIC_UNIT,y1:504*CLASSIC_UNIT}],tactics:[{id:'A',label:'正门突入'},{id:'B',label:'后门包抄'},{id:'C',label:'屋顶渗透'}],routeVariants:{A:[[A(-384,384),A(-320,1120),A(-160,1480),A(-128,1700),A(-480,1680),A(-480,2260,304),A(-520,2380,336),A(-624,2560,336),A(-960,2592,336)],[A(128,384),A(384,1200),A(256,1700),A(48,2180),A(-480,1680),A(-480,2260,304),A(-520,2380,336),A(-960,2592,336)]],B:[[A(768,384),A(784,1480),A(784,2216),A(664,2216),A(128,2180),A(-480,1680),A(-480,2260,304),A(-520,2380,336),A(-960,2592,336)]],C:[[A(768,448),A(784,1480),A(744,1744),A(744,1744,392),A(704,2016,512),A(0,2120,512),A(0,2272,436),A(0,2464,436),A(-552,2464,436),A(-624,2464,336),A(-960,2592,336)]]},defensePositions:[A(-624,2544,336),A(-224,2816,336),A(608,2336),A(-128,2144),A(448,1568)],postPlantPositions:{A:[A(-128,2144),A(448,1568)],B:[A(608,2336),A(-624,2544,336)]},areas:[region('反恐救援街道',A(-576,192)),region('仓库正门',A(-128,1536)),region('仓库箱区',A(0,2048)),region('后门巷道',A(768,2216)),region('高架桥',A(-1600,1344,256)),region('人质房',A(-960,2592,336)),region('上层走道',A(-624,2016,304)),region('仓库屋顶',A(256,2048,512)),region('屋顶通风管',A(0,2464,436))],colors:{floor:0xb7b2a6,boundary:0x8e8173,accent:0xb7a25c},checklist:['front_entry','rear_door','warehouse_boxes','upper_stairs','upper_walkway','hostage_room','roof_ladder','branched_duct','duct_drop','street_bridge','rescue_zone'],reference:{unit:CLASSIC_UNIT,origin:{xShift:256,yCenter:1800,zBase:0},source:'cs_assault.bsp v30 from wasm cs1.6-web',warehouse:{x0:-704,x1:704,z0:1536,z1:2880},landmarks:{door:A(712,2216),grille:A(0,2316,436),window:null,ladder:A(744,1744),roofEntry:A(0,2120,512),ductEnd:A(-552,2464,436),ductExit:A(-624,2464,336)},portalWidth:96*CLASSIC_UNIT}};
// Dust2 keeps the original offset spawns and distinct vertical relationships:
// CT -128, B/long/upper tunnel 0, A/short 96, T 128 reference units.
const du=author(384,1120,-128),{Q:D,B:DB,R:DR,S:DS,W:DW}=du;
// Outer city outline; closed blocks define the routes, not a symmetric template.
DW(-2688,-2432,-1280,3200,-128,384,'stone');DW(1920,2048,-768,3072,-128,352,'stone');DW(-2304,1920,3072,3200,-128,384,'stone');DW(-2432,704,-1280,-1152,-128,384,'stone');
// T platform, broad west approach and an offset central blind building.
DB(-2304,256,-1152,-256,-128,128,'stone','deck');DW(-256,128,-256,384,128,384,'plaster');DW(128,384,-256,-128,0,384,'plaster');DW(640,768,-256,-128,0,384,'plaster');DB(256,768,-768,-512,-128,128,'stone','deck');
DR(-896,-256,-256,128,0,128,'south','sand');DR(-2048,-1536,-256,0,0,128,'south','sand');
DB(-992,-128,128,640,-128,0,'sand','deck');DB(-992,-128,896,1280,-128,0,'sand','deck');DB(-864,-128,640,896,-128,0,'sand','deck');DR(-1248,-864,640,896,-128,0,'east','sand');
// T east courtyard and the enclosed offset long double-door vestibule.
DR(256,768,-512,-128,0,128,'south','sand');DB(256,1920,-128,2176,-128,0,'sand','deck');
DW(640,768,64,768,0,352,'plaster');DW(768,1408,768,832,0,352,'plaster');DW(1216,1280,256,640,0,352,'plaster');DW(960,1664,192,256,0,352,'plaster');
DB(800,864,768,784,0,192,'wood','long-door');DB(1216,1232,272,336,0,192,'wood','long-door');DB(768,1408,256,768,224,240,'stone','ceiling');
// Main island, catwalk and the long outer lane. Stepped corners represent
// measured bevels while keeping collision/LOS identical to the rendered wall.
DW(128,1152,832,1408,0,352,'plaster');DW(640,1280,1408,2048,0,352,'plaster');
for(let i=0;i<4;i++)DW(128+i*64,192+i*64,768+i*64,832+i*64,0,352,'plaster');
// Lower mid drops towards the genuinely low CT arch and doors.
DW(-1056,-992,128,1408,0,352,'stone');DW(-1056,-992,1536,1728,-128,352,'stone');
DR(-896,-256,1280,1600,-128,0,'south','sand');DW(-992,-256,1664,1680,-128,320,'stone');DW(128,240,1664,1680,-128,320,'stone');DW(528,576,1664,1680,-128,320,'stone');DW(240,528,1664,1680,96,320,'stone');
DB(-224,-96,1664,1676,-128,64,'wood','mid-door');DB(32,160,1688,1700,-128,64,'wood','mid-door');DB(-256,128,1660,1684,96,144,'stone','arch-crown');
// Catwalk runs beside mid, turns above CT, then climbs the short stairs.
DB(-256,32,256,1408,-16,0,'stone','deck');DB(-256,512,1408,1600,-16,0,'stone','deck');
DB(256,512,1600,1760,-16,0,'stone','deck');DR(256,512,1760,1920,0,96,'north','stone');
DB(256,640,1920,2752,64,96,'stone','deck');
DB(-272,-256,320,1408,0,32,'stone','rail');DB(-256,256,1600,1616,0,32,'stone','rail');
// A site is suspended over part of CT; long is lower and pit lower again.
DB(640,1664,2304,2880,64,96,'stone','deck');DR(1280,1664,2176,2304,0,96,'north','sand');
DR(-128,256,2560,2816,-128,96,'east','sand');
// Pit is a real depressed pocket rather than an isolated mark on level sand.
for(let i=du.terrain.length-1;i>=0;i--){const s=du.terrain[i];if(s.type==='deck'&&s.x===D(1088,1024).x&&s.d===2304*CLASSIC_UNIT)du.terrain.splice(i,1);}
// Split the long floor around the east pit pocket.
DB(256,1664,-128,2176,-128,0,'sand','deck');DB(1664,1920,896,2176,-128,0,'sand','deck');DB(1664,1920,-128,256,-128,0,'sand','deck');DR(1664,1920,640,896,-128,0,'north','sand');
DB(1728,1856,352,608,-128,-64,'stone','cover');
for(const q of [[928,1056,2432,2560,96,224],[1216,1344,2560,2752,96,208],[704,832,2496,2688,96,192],[1472,1568,1920,2016,0,48]])DB(...q,'crate','cover');
// B courtyard has independent door and window entries, with a tunnel choke.
DB(-2304,-1024,1792,3072,-128,0,'sand','deck');
DW(-2320,-2304,1728,3072,-128,384,'stone');DW(-2304,-1792,1792,1808,0,352,'stone');DW(-1664,-1024,1792,1808,0,352,'stone');
DW(-1040,-1024,1792,2112,-128,352,'stone');DW(-1040,-1024,2304,2560,-128,352,'stone');DW(-1040,-1024,2752,3072,-128,352,'stone');
DW(-1040,-1024,2112,2304,192,352,'stone');DW(-1040,-1024,2560,2752,160,352,'stone');DB(-1040,-1024,2560,2752,-128,64,'stone','sill');
DB(-1056,-1040,2128,2192,0,176,'wood','b-door');DB(-1024,-1008,2240,2304,0,176,'wood','b-door');
DR(-1024,-640,2560,2752,-128,64,'west','sand');DR(-1408,-1040,2560,2752,0,64,'east','sand');
// A short rise leads from the low CT courtyard to B doors, avoiding teleport.
DR(-1024,-768,2112,2304,-128,0,'west','sand');
for(const q of [[-1728,-1600,2496,2624,0,128],[-2240,-2112,2112,2240,0,112],[-1280,-1152,1904,2032,0,112],[-2048,-1920,2816,2944,0,80]])DB(...q,'crate','cover');
// Upper tunnel: enclosed T-side room, bent north connector and real B portal.
DB(-2176,-1536,0,640,-128,0,'stone','deck');DB(-2176,-1536,896,1024,-128,0,'stone','deck');DB(-2176,-1792,640,896,-128,0,'stone','deck');DW(-2192,-2176,0,1024,0,256,'stone');DW(-1536,-1520,0,640,0,256,'stone');DW(-2176,-2048,0,16,0,256,'stone');DW(-1664,-1536,0,16,0,256,'stone');DB(-2176,-1536,0,1024,240,256,'stone','ceiling');
DW(-2176,-1920,1024,1040,0,256,'stone');DW(-1664,-1536,1024,1040,0,256,'stone');DB(-1920,-1664,1024,1792,-128,0,'stone','deck');
DW(-1936,-1920,1024,1792,0,256,'stone');DW(-1664,-1648,1024,1792,0,256,'stone');DB(-1920,-1664,1024,1792,224,240,'stone','ceiling');
DB(-1920,-1664,1792,1808,160,224,'stone','arch-crown');
DB(-2080,-1952,448,576,0,96,'crate','cover');
// Lower tunnel approaches under its ceiling, with a half-turn stair flight.
DW(-1536,-1024,896,912,-128,224,'stone');DW(-1536,-992,624,640,-128,224,'stone');
DB(-1536,-992,640,896,208,224,'stone','ceiling');DR(-1792,-1536,640,896,-128,0,'west','stone');
// Low-cost municipal cover blocks the T/CT spawn ray without fake invisible walls.
DB(-256,-96,1760,1952,-128,128,'crate','cover');DB(-992,-864,-864,-736,128,192,'crate','cover');
const dust2={id:'dust2',name:'Dust2 沙漠城镇',mode:'bomb',bounds:bound(D,-2816,2048,-1664,3904),boundaryHeight:16,terrain:du.terrain,spawns:{attack:[D(-832,-704,128),D(-832,-800,128),D(-736,-800,128),D(-640,-800,128),D(-544,-704,128)],defend:[D(64,2240,-128),D(160,2240,-128),D(256,2240,-128),D(352,2240,-128),D(448,2240,-128)]},sites:[{id:'A',...D(1152,2464,96),radius:3.0,color:0xd58a48},{id:'B',...D(-1536,2688,0),radius:3.6,color:0x6885ac}],hostagePositions:[],rescueZones:[],ladders:[],lowZones:[],tactics:[{id:'A',label:'进攻 A 点'},{id:'B',label:'进攻 B 点'}],routeVariants:{A:[[D(128,-768,128),D(448,-512,128),D(512,-128,0),D(1088,96,0),D(1100,420,0),D(920,650,0),D(1500,900,0),D(1500,2110,0),D(1472,2340,96),D(1152,2464,96)],[D(-480,-256,128),D(-480,256,0),D(-128,512,0),D(-128,1440,0),D(384,1664,0),D(384,1960,96),D(512,2440,96),D(1152,2464,96)],[D(-480,-256,128),D(-512,1200,0),D(-480,1728,-128),D(0,2400,-128),D(-160,2688,-128),D(320,2688,96),D(1152,2464,96)]],B:[[D(-1856,-640,128),D(-1856,64,0),D(-1856,800,0),D(-1728,1160,0),D(-1728,1840,0),D(-1536,2688,0)],[D(-480,-256,128),D(-512,768,0),D(-1248,768,-128),D(-1856,768,0),D(-1728,1160,0),D(-1728,1840,0),D(-1536,2688,0)],[D(-480,-256,128),D(-512,1200,0),D(-480,1728,-128),D(-720,2208,-128),D(-1088,2208,0),D(-1536,2688,0)]]},defensePositions:[D(1088,2816,96),D(-1856,2944,0),D(-480,1952,-128),D(1408,2400,96),D(-1184,2400,0)],postPlantPositions:{A:[D(512,2440,96),D(1500,2816,96),D(64,2400,-128)],B:[D(-2112,2880,0),D(-1120,2496,0),D(-1728,1728,0)]},areas:[region('T 出生庭院',D(-736,-800,128)),region('A 大双门',D(1088,512,0)),region('A 大道',D(1500,1536,0)),region('坑位',D(1792,512,-128)),region('A 包点平台',D(1152,2464,96)),region('A 斜坡',D(64,2688,0)),region('A 小道楼梯',D(384,1840,48)),region('中路猫道',D(-128,1024,0)),region('中路',D(-512,768,0)),region('中门',D(-32,1664,-128)),region('上层隧道',D(-1856,384,0)),region('下层隧道',D(-1248,768,-128)),region('B 隧道出口',D(-1728,1760,0)),region('B 双门',D(-1040,2208,0)),region('B 窗口',D(-1032,2656,64)),region('B 包点平台',D(-1536,2688,0)),region('CT 出生区',D(256,2240,-128))],colors:{floor:0xd7c29c,boundary:0xba9c72,accent:0xb67445},checklist:['t_spawn','long_double_doors','pit','long_lane','a_platform','a_ramp','short_stairs','catwalk','middle','mid_doors','upper_tunnel','lower_tunnel','b_tunnel_exit','b_doors','b_window','b_platform','ct_spawn'],reference:{unit:CLASSIC_UNIT,origin:{xShift:384,yCenter:1120,zBase:-128},source:'de_dust2.bsp v30 from wasm cs1.6-web',landmarks:{window:D(-1032,2656,64),upperSouth:D(-1856,64,0),upperNorth:D(-1728,1680,0),lower:D(-1248,768,-128),aRampLow:D(-160,2688,-128),aRampHigh:D(320,2688,96),longDoor:D(1088,512,0),midDoor:D(-32,1664,-128),midApproach:D(-512,1200,0),midExit:D(-480,1728,-128)},levels:{T:128,CT:-128,A:96,B:0,upper:0,lower:-128}}};
export const MAPS=[assault,dust2];
for(const m of MAPS){m.spawns.CT=m.mode==='rescue'?m.spawns.attack:m.spawns.defend;m.spawns.T=m.mode==='rescue'?m.spawns.defend:m.spawns.attack;m.routes=Object.fromEntries(Object.entries(m.routeVariants).map(([id,r])=>[id,r[0]]));m.defenseByTactic=Object.fromEntries(m.tactics.map(t=>[t.id,m.defensePositions]));m.hostageSpawns=m.hostagePositions;}
