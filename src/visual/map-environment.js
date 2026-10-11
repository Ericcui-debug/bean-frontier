// Detail derives from measured solids. It is inset into opaque surfaces and
// never creates an opening, extra collider or false tactical silhouette.
export function decorateMapEnvironment(g,root,map){
 const box=(x,y,z,w,h,d,c)=>{const m=g.box(x,y,z,w,h,d,c,root);m.castShadow=false;return m;};
 const paint=(x,z,w,d,c,y=.022)=>box(x,y,z,w,.018,d,c);
 const warehouse=map.id==='assault',U=map.reference?.unit||1,o=map.reference?.origin;
 const Q=(x,z,y=0)=>({x:(x+o.xShift)*U,z:(o.yCenter-z)*U,y:(y-o.zBase)*U});
 const rawBox=(x,z,y,w,d,h,c)=>{const q=Q(x,z,y);return box(q.x,q.y,q.z,w*U,h*U,d*U,c);};
 const frame=(x,y,z,w,h,axis,color=0x716653)=>{
  const pane=axis==='x'?box(x,y,z,.022,h,w,0x627e83):box(x,y,z,w,h,.022,0x627e83);pane.name='sealed-wall-inset';
  for(const sign of [-1,1])if(axis==='x'){box(x,y,z+sign*w/2,.026,h+.12,.06,color);box(x,y+sign*h/2,z,.026,.06,w+.12,color);}else{box(x+sign*w/2,y,z,.06,h+.12,.026,color);box(x,y+sign*h/2,z,w+.12,.06,.026,color);}
 };
 for(const s of map.terrain){
  if(s.type!=='wall'||s.h<3||Math.min(s.w,s.d)>.75)continue;
  const alongX=s.w>s.d,len=alongX?s.w:s.d,c=warehouse?0x697980:0xad9878,y=s.y||0;
  if(alongX){box(s.x,y+.21,s.z,s.w,.42,s.d+.018,c);box(s.x,y+s.h-.12,s.z,s.w,.18,s.d+.018,warehouse?0x626e75:0xe0cba5);}
  else{box(s.x,y+.21,s.z,s.w+.018,.42,s.d,c);box(s.x,y+s.h-.12,s.z,s.w+.018,.18,s.d,warehouse?0x626e75:0xe0cba5);}
  // At most three windows per wall. Actual portals are separate wall segments,
  // so no trim spans a doorway, vent shaft or window opening.
  const count=Math.min(3,Math.floor(len/(warehouse?4:5)));
  for(let i=0;i<count;i++){const t=-len/2+len*(i+.5)/count,level=y+Math.min(s.h-1.2,warehouse?5.7:3.5);if(level<y+1.4)continue;
   for(const sign of [-1,1])if(alongX)frame(s.x+t,level,s.z+sign*(s.d/2+.012),1.45,1.1,'z',c);else frame(s.x+sign*(s.w/2+.012),level,s.z+t,1.45,1.1,'x',c);
  }
 }
 if(warehouse){
  // Ribs coincide with the roof underside; narrow suspended lighting does not
  // conceal the higher gallery, ladders or under-roof ducts on low quality.
  for(const x of [-624,-352,-80,192,464]){rawBox(x,2128,490,8,1136,10,0x3f515e);rawBox(x,1900,476,72,16,5,0xffe7aa);}
  for(const z of [1650,1900,2150,2400,2650])for(const x of [-724,724])rawBox(x,z,256,6,8,512,0x586970);
  // The two exterior approaches have different street directions.
  for(const z of [384,576,768,960,1152,1344,1536,1728,1920,2112,2304,2496,2688]){const q=Q(784,z);paint(q.x,q.z,.10,2.2,0xd9cd97);}
  for(const x of [-1088,-832,-576,-320,-64,192]){const q=Q(x,128);paint(q.x,q.z,2.8,.11,0xf0e3ac);}
  for(const x of [-512,-384,-256,-128,0,128,256,384]){const q=Q(x,1504);paint(q.x,q.z,1.2,.18,0xd9ba58);}
  for(const z of [768,1088,1408,1728,2048]){const q=Q(-1600,z,256);paint(q.x,q.z,5.5,.10,0xd9cd97,q.y+.022);}
  // Gallery paint follows each measured gallery floor rather than floating at
  // the previous map's 3.2m height.
  for(const z of [1750,1950,2150]){const q=Q(-640,z,304);paint(q.x,q.z,1.2,.08,0xd2bd71,q.y+.022);}
  for(const z of [2380,2540,2700]){const q=Q(-640,z,336);paint(q.x,q.z,2.1,.08,0xd2bd71,q.y+.022);}
  for(const z of [2320,2400,2560,2640])for(const x of [-47,47])rawBox(x,z,462,2,4,48,0x465c65);
 }else{
  // Desert roads are level-specific; pit and ramps get no floating road paint.
  for(const z of [960,1216,1472,1728,1984]){const q=Q(1500,z,0);paint(q.x,q.z,6,.085,0xc3a37b,q.y+.022);}
  for(const z of [320,576,832,1088,1280]){const q=Q(-640,z,0);paint(q.x,q.z,6,.06,0xc9b18d,q.y+.022);}
  for(const z of [160,416,672,928]){const q=Q(-1856,z,0);paint(q.x,q.z,4.4,.07,0xbba17e,q.y+.022);}
  for(const s of map.terrain.filter(s=>['mid-door','long-door','b-door'].includes(s.type))){
   for(const y of [.45,1.2,Math.min(s.h-.18,2.4)])if(s.w>s.d)box(s.x,s.y+y,s.z,s.w-.04,.08,s.d+.014,0x554e42);else box(s.x,s.y+y,s.z,s.w+.014,.08,s.d-.04,0x554e42);
  }
  for(const site of map.sites)for(const sign of [-1,1]){const r=site.radius+.18,c=site.id==='A'?0xae714a:0x778c95;paint(site.x+sign*r,site.z,.08,r*2,c,site.y+.022);paint(site.x,site.z+sign*r,r*2,.08,c,site.y+.022);}
 }
}
