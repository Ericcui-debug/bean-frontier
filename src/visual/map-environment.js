// Map-only trim is inset into existing opaque walls, or drawn on floors.
// Traversable arches, cover and platforms remain authored collision solids.
export function decorateMapEnvironment(g,root,map){
 const box=(x,y,z,w,h,d,c)=>{const m=g.box(x,y,z,w,h,d,c,root);m.castShadow=false;return m;};
 const stripe=(x,z,w,d,c,y=.022)=>box(x,y,z,w,.018,d,c);
 const frame=(x,y,z,w,h,axis,color=0x716653)=>{
  const pane=axis==='x'?box(x,y,z,.032,h,w,0x627e83):box(x,y,z,w,h,.032,0x627e83);
  pane.name='sealed-wall-inset';
  for(const side of [-1,1]){
   if(axis==='x'){box(x,y,z+side*w/2,.048,h+.16,.09,color);box(x,y+side*h/2,z,.048,.09,w+.16,color);}
   else{box(x+side*w/2,y,z,.09,h+.16,.048,color);box(x,y+side*h/2,z,w+.16,.09,.048,color);}
  }
  if(axis==='x')box(x,y,z,.05,h,.06,color);else box(x,y,z,.06,h,.05,color);
 };
 const warehouse=map.id==='assault';
 // Bands and buttresses share the actual wall face and do not fake openings.
 for(const s of map.terrain){
  if(s.type!=='wall'||s.y>0||s.h<4||Math.min(s.w,s.d)>.99&&Math.min(s.w,s.d)>2)continue;
  const alongX=s.w>s.d,len=alongX?s.w:s.d;
  const c=warehouse?0x697980:0xad9878;
  if(alongX){box(s.x,.28,s.z,s.w,.55,s.d+.025,c);box(s.x,s.h-.16,s.z,s.w,.22,s.d+.025,warehouse?0x626e75:0xe0cba5);}
  else{box(s.x,.28,s.z,s.w+.025,.55,s.d,c);box(s.x,s.h-.16,s.z,s.w+.025,.22,s.d,warehouse?0x626e75:0xe0cba5);}
  const divisions=Math.floor(len/(warehouse?7:8));
  for(let i=1;i<divisions;i++){
   const t=-len/2+len*i/divisions;
   if(alongX)box(s.x+t,s.h/2,s.z,.19,s.h,s.d+.04,c);
   else box(s.x,s.h/2,s.z+t,s.w+.04,s.h,.19,c);
  }
 }
 if(warehouse){
  // Exterior warehouse windows are sealed high clerestories on solid walls.
  for(const z of [-16,-8,0,8]){for(const x of [-23.515,-22.485,22.485,23.515])frame(x,4.9,z,2.5,1.25,'x');}
  for(const x of [-18,-12,-6,0,6])frame(x,4.9,-21.485,2.2,1.1,'z');
  for(const x of [-19,-15,9,15,20])frame(x,4.85,18.515,2.2,1.1,'z');
  for(const z of [-20,-10,0,10,20])frame(-37.485,5.5,z,2.4,1.65,'x',0x8f8170);
  for(const z of [-18,-6,6,18])frame(30.985,4.6,z,2.5,1.6,'x',0x8f8170);
  for(const x of [-12,-4,4,12])frame(x,5.5,41.985,2.7,1.6,'z',0x8f8170);
  // Loading markings, worn street dashes and safety boundaries are flat paint.
  for(const z of [-26,-18,-10,-2,6,14,22,30])stripe(27,z,.14,3.5,0xd9cd97);
  for(const x of [-20,-12,-4,4,12,20])stripe(x,40,3,.13,0xf0e3ac);
  for(const x of [-9,-7,-5,-3,-1,1,3])stripe(x,19.05,.9,.25,0xd9ba58);
  for(const z of [-18,-9,0,9]){stripe(-32,z,4.3,.12,0xd9cd97,4.821);stripe(-17,z,5.5,.10,0xd2bd71,3.221);}
  // Office trim belongs to the existing opaque room envelope.
  for(const z of [-20,-18,-16,-14])box(-21.48,4.75,z,.035,.18,1.5,0xb6c7c3);
  box(-17,5.9,-20.485,8,.18,.035,0xdfd7b8);
  // Steel ribs in the duct remain within its metal panels.
  for(const z of [-6,-3,0,3,6])for(const x of [14.66,17.34])box(x,7.95,z,.04,1.02,.08,0x465c65);
 }else{
  // Desert windows are inset shutters, repeated only on actual opaque walls.
  for(const z of [-12,-5,2])frame(27.485,4.3,z,1.3,1.7,'x',0x8e7653);
  for(const z of [-18,-6,6,18,30])frame(43.485,4.2,z,1.45,1.8,'x',0x8e7653);
  for(const z of [-20,-8,4,16,28])frame(-44.485,4.2,z,1.45,1.8,'x',0x8e7653);
  for(const x of [-37,-27,-17,-7,3])frame(x,4.2,-36.485,1.5,1.7,'z',0x8e7653);
  // Mid's blind building has weathered shutters and courses at visible height.
  for(const z of [3,8,13])frame(-5.015,4.4,z,1.25,1.5,'x',0x92795c);
  for(const z of [-6,0,6,12])frame(-8.985,4.2,z,1.3,1.5,'x',0x92795c);
  // Sand/stone paving establishes route direction without adding collider work.
  for(const z of [-10,-2,6,14])stripe(39,z,7.5,.11,0xc3a37b,z===14?1/3+.022:2.022);
  for(const z of [-12,-4,4,12,20])stripe(-6.9,z,4.3,.07,0xc9b18d);
  for(const x of [-35,-31,-27])stripe(x,18,.07,20,0xbba17e,1.622);
  // Wood door braces sit inside the existing real door planes.
  for(const s of map.terrain.filter(s=>['mid-door','long-door','b-door'].includes(s.type))){
   if(s.w>s.d){for(const y of [.7,2,3.4])box(s.x,(s.y||0)+y,s.z+.12,s.w-.1,.12,.03,0x554e42);}
   else{for(const y of [.7,2,3.4])box(s.x+.12,(s.y||0)+y,s.z,.03,.12,s.d-.1,0x554e42);}
  }
  // A/B platform boundary paint, clearly distinct at low resolution.
  for(const [x,z,y,c] of [[29,-26,3.222,0xae714a],[-33,-26,.522,0x778c95]])for(const sign of [-1,1]){
   stripe(x+sign*4.6,z,.10,9.2,c,y);stripe(x,z+sign*4.6,9.2,.10,c,y);
  }
 }
}
