// World-space dimensions for every player and AI bean. Model vertices remain
// in the original Bean Blitz proportions and are scaled once at the body root.
const head=Object.freeze({y:1.256,r:.232,head:true});
const body=Object.freeze({y:.816,r:.424,head:false});
const lower=Object.freeze({y:.384,r:.36,head:false});
export const CHARACTER=Object.freeze({
 scale:.8,radius:.424,height:1.552,eye:1.296,sight:1.2,aimHeight:1.08,
 navRadius:.45,navEntryRadius:.416,head,body,lower,
 hitVolumes:Object.freeze([head,body,lower]),
 healthBar:1.92,healthTarget:1.16,viewScale:.52,
 muzzle:Object.freeze({x:.312,y:.896,z:-1.024}),
 fallbackMuzzle:Object.freeze({right:.168,forward:.384,down:.16})
});
