// Angles are radians; the same deterministic pattern drives every actor.
export const RECOIL=Object.freeze([
 {pitch:[.007,.009,.010,.012],yaw:[0,.001,-.001,.002],scale:.78,settle:.13,returnRate:10},
 {pitch:[.009,.010,.011,.012,.013,.014,.014,.015],yaw:[-.001,.001,.002,.003,.003,-.002,-.003,-.003],scale:.80,settle:.15,returnRate:8},
 {pitch:[.012,.014,.016,.018,.019,.021,.021,.022],yaw:[0,-.002,-.003,.003,.004,.004,-.004,-.005],scale:.82,settle:.16,returnRate:7},
 {pitch:[.027,.031],yaw:[.001,-.001],scale:.70,settle:.19,returnRate:8}
]);
export function resetRecoil(actor){actor.recoilAim={yaw:0,pitch:0,index:0,id:-1,since:9};actor.recoil=0;}
export function kickRecoil(actor,id,aimed=false){const p=RECOIL[id],r=actor.recoilAim??(resetRecoil(actor),actor.recoilAim);if(r.id!==id||r.since>.55){r.index=0;r.id=id;}const i=Math.min(r.index,p.pitch.length-1),j=r.index%p.yaw.length,scale=aimed?p.scale:1;r.pitch=Math.min(.19,r.pitch+p.pitch[i]*scale);r.yaw=Math.max(-.06,Math.min(.06,r.yaw+p.yaw[j]*scale));r.index++;r.since=0;actor.recoil=Math.min(1.8,(actor.recoil||0)+.8);}
export function updateRecoil(actor,dt){const r=actor.recoilAim;if(!r)return;const p=RECOIL[r.id]??RECOIL[0],before=r.since;r.since+=dt;const recovery=Math.max(0,r.since-p.settle)-Math.max(0,before-p.settle);if(recovery>0){const decay=Math.exp(-p.returnRate*recovery);r.yaw*=decay;r.pitch*=decay;}actor.recoil=Math.max(0,(actor.recoil||0)-dt*5);}
export function aimAngles(actor,yaw,pitch){return {yaw:yaw+(actor.recoilAim?.yaw||0),pitch:Math.max(-1.50,Math.min(1.50,pitch+(actor.recoilAim?.pitch||0)))};}
export function seededRandom(seed=1){let value=seed>>>0;return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
