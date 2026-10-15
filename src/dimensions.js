// Metres in world space. Render roots are uniformly scaled; posture and exact
// hit geometry live in character-pose.js and adapters/bean-actors.js.
export const CHARACTER=Object.freeze({
 scale:.8,radius:.424,height:1.552,eye:1.296,sight:1.2,aimHeight:.74,
 navRadius:.45,navEntryRadius:.416,healthBar:1.92,healthTarget:1.16,viewScale:.52,
 hold:Object.freeze({x:.192,y:.84,z:-.288}),
 fallbackMuzzle:Object.freeze({right:.168,forward:.384,down:.16})
});
export const LOW_CHARACTER=Object.freeze({...CHARACTER,height:.88,eye:.72,sight:.68,aimHeight:.24,
 healthBar:1.12,healthTarget:.60,
 hold:Object.freeze({...CHARACTER.hold,y:.34,z:-.30})});
export function stanceDimensions(actor){return actor?.stance==='low'||actor?.stance==='crouch'||actor?.crouched===true||actor?.crouching===true?LOW_CHARACTER:CHARACTER;}
