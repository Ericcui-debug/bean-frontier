// World-space dimensions for every player and AI bean. Model vertices remain
// in the original Bean Blitz proportions and are scaled once at the body root.
const head=Object.freeze({y:1.256,r:.232,head:true});
const body=Object.freeze({y:.816,r:.424,head:false});
const lower=Object.freeze({y:.384,r:.36,head:false});
export const CHARACTER=Object.freeze({
 scale:.8,radius:.424,height:1.552,eye:1.296,sight:1.2,aimHeight:1.08,verticalScale:1,
 navRadius:.45,navEntryRadius:.416,head,body,lower,
 hitVolumes:Object.freeze([head,body,lower]),
 healthBar:1.92,healthTarget:1.16,viewScale:.52,
 muzzle:Object.freeze({x:.312,y:.896,z:-1.024}),
 fallbackMuzzle:Object.freeze({right:.168,forward:.384,down:.16})
});
const lowRatio=.88/CHARACTER.height;
const lowVolumes=Object.freeze(CHARACTER.hitVolumes.map(v=>Object.freeze({...v,y:v.y*lowRatio,ry:v.r*lowRatio})));
export const LOW_CHARACTER=Object.freeze({...CHARACTER,height:.88,eye:.72,sight:.68,aimHeight:.61,verticalScale:lowRatio,
 head:lowVolumes[0],body:lowVolumes[1],lower:lowVolumes[2],hitVolumes:lowVolumes,
 healthBar:CHARACTER.healthBar*lowRatio,healthTarget:CHARACTER.healthTarget*lowRatio,
 muzzle:Object.freeze({...CHARACTER.muzzle,y:.88*lowRatio+.016}),
 fallbackMuzzle:Object.freeze({...CHARACTER.fallbackMuzzle,down:CHARACTER.fallbackMuzzle.down*lowRatio})});
export function stanceDimensions(actor){return actor?.stance==='low'||actor?.stance==='crouch'||actor?.crouched===true?LOW_CHARACTER:CHARACTER;}
