// One cached coordinate system for rendering, HUD and pointer input. Reading
// the cache never forces layout; only resize/settings handlers refresh it.
let cached=null,probe=null;
export function refreshViewport(){
 if(typeof document==='undefined')return cached={width:1,height:1,offsetLeft:0,offsetTop:0,left:0,right:0,top:0,bottom:0};
 if(!probe){probe=document.createElement('div');probe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:var(--safe-top,env(safe-area-inset-top,0px)) var(--safe-right,env(safe-area-inset-right,0px)) var(--safe-bottom,env(safe-area-inset-bottom,0px)) var(--safe-left,env(safe-area-inset-left,0px))';document.documentElement.append(probe);}
 const viewport=globalThis.visualViewport,root=document.documentElement,style=getComputedStyle(probe),positive=(n,f)=>Number.isFinite(n)&&n>0?n:f;
 const width=positive(viewport?.width,root.clientWidth||globalThis.innerWidth||1),height=positive(viewport?.height,root.clientHeight||globalThis.innerHeight||1);
 cached={width,height,offsetLeft:viewport?.offsetLeft||0,offsetTop:viewport?.offsetTop||0,left:parseFloat(style.paddingLeft)||0,right:parseFloat(style.paddingRight)||0,top:parseFloat(style.paddingTop)||0,bottom:parseFloat(style.paddingBottom)||0};
 for(const [name,value] of Object.entries({width,height,left:cached.offsetLeft,top:cached.offsetTop}))root.style.setProperty('--viewport-'+name,value+'px');
 return cached;
}
export function readViewport(){return cached??refreshViewport();}
