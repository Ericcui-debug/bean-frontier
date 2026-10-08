import {clamp} from './physics.js';

// Pure geometry makes the maximum-size layout testable without a browser.
export function computeTouchLayout({width,height,safe={},size=1}){
 const l=safe.left||0,r=safe.right||0,t=safe.top||0,b=safe.bottom||0;
 const portrait=height>width,narrow=width-l-r<700,pad=14,gap=8;
 const small=Math.max(44,44*size),fire=Math.max(64,(narrow?72:78)*size),stick=Math.max(88,(narrow?96:112)*size),left=Math.max(44,48*size);
 const right=width-r-pad,bottom=height-b-16,stickX=l+pad,stickY=bottom-stick;
 const rowY=bottom-fire-gap-small-(portrait?small+gap:0),fireX=right-fire;
 const positions={stick:[stickX,stickY,stick,stick],fire:[fireX,bottom-fire,fire,fire],aim:[fireX-gap-small,bottom-small,small,small],jump:[right-small,rowY,small,small],reload:[right-small*2-gap,rowY,small,small],interact:[right-small*3-gap*2,rowY,small,small]};
 if(portrait)positions.aim=[right-small,bottom-fire-gap-small,small,small];
 const healthY=stickY-42;
 positions.left=portrait?[stickX,healthY-gap-left,left,left]:[stickX+stick+12,stickY-left+6,left,left];
 const weaponW=104,weaponY=portrait?rowY-70:bottom-44,weaponX=portrait?right-weaponW:(l+(width-l-r)/2-weaponW/2);
 const mapW=narrow?86:110,mapH=narrow?70:88,mapY=portrait?t+76:t+10;
 const toolsX=right-144,stripX=portrait?stickX:stickX+mapW+12,stripW=portrait?toolsX-gap-stickX:Math.min(242,toolsX-gap-stripX);
 const hintY=portrait?height/2-70:Math.min(rowY-28,height/2-44);
 return {portrait,width,height,safe:{left:l,right:r,top:t,bottom:b},small,fire,stick,positions,health:[stickX,healthY,Math.min(124,stick),34],arsenal:[weaponX,weaponY,weaponW,44],map:[stickX,mapY,mapW,mapH],tools:[toolsX,t+8,144,44],strip:[stripX,t+8,stripW,44],objective:portrait?[stickX+mapW+12,t+76,width-r-pad-stickX-mapW-12]:[l+(width-l-r)/2,t+58,Math.min(260,width-l-r-220)],hintY};
}

// Each pointer owns one action. Camera ownership can transfer without replaying
// the passive finger's previous movement, including a finger on the fire key.
export function createInput({canvas,onLook,onPause,onAction,playing,getScope=()=>false,aimSlowdown=()=>1}){
 const mobile=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
 document.body.classList.toggle('touch',mobile);
 const keys=new Set(),actions=new Map(),lookPointers=new Map();
 const stick=document.querySelector('#move-stick'),thumb=stick.querySelector('b'),look=document.querySelector('#look-zone');
 const state={x:0,z:0,fire:false,aim:false,interactHeld:false,mobile};
 const safeProbe=document.createElement('div');safeProbe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding-left:var(--safe-left);padding-right:var(--safe-right);padding-top:var(--safe-top);padding-bottom:var(--safe-bottom)';document.body.appendChild(safeProbe);
 const sensitivity={look:1,ads:.6,sniper:.35},layout={size:1,opacity:.72};
 let stickId=null,lookId=null,drag=null,touchAim=false,hadPointerLock=false;
 let metrics={width:Math.max(240,innerWidth),stick:{x:0,y:0,radius:40}},metricsFrame=0;
 function refreshMetrics(){
  metricsFrame=0;
  const css=getComputedStyle(safeProbe),safe={left:parseFloat(css.paddingLeft)||0,right:parseFloat(css.paddingRight)||0,top:parseFloat(css.paddingTop)||0,bottom:parseFloat(css.paddingBottom)||0};
  const width=window.visualViewport?.width||innerWidth,height=window.visualViewport?.height||innerHeight;
  const geometry=computeTouchLayout({width,height,safe,size:layout.size}),root=document.documentElement.style;
  if(mobile){
   for(const [key,rect] of Object.entries(geometry.positions))for(let i=0;i<4;i++)root.setProperty(`--${key}-${['x','y','w','h'][i]}`,rect[i]+'px');
   for(const [key,rect] of Object.entries({health:geometry.health,arsenal:geometry.arsenal,map:geometry.map,tools:geometry.tools,strip:geometry.strip}))for(let i=0;i<4;i++)root.setProperty(`--${key}-${['x','y','w','h'][i]}`,rect[i]+'px');
   root.setProperty('--objective-x',geometry.objective[0]+'px');root.setProperty('--objective-y',geometry.objective[1]+'px');root.setProperty('--objective-w',geometry.objective[2]+'px');root.setProperty('--hint-y',geometry.hintY+'px');
  }
  const rect=stick.getBoundingClientRect(),thumbWidth=thumb.getBoundingClientRect().width;
  metrics={width:Math.max(240,width-safe.left-safe.right),height,safe,geometry,stick:{x:rect.left+rect.width/2,y:rect.top+rect.height/2,radius:Math.max(20,rect.width/2-thumbWidth/2-4)}};
 }
 function scheduleMetrics(){if(!metricsFrame)metricsFrame=requestAnimationFrame(refreshMetrics);}
 for(const event of ['resize','orientationchange','pageshow'])window.addEventListener(event,scheduleMetrics);
 document.addEventListener('fullscreenchange',scheduleMetrics);
 window.visualViewport?.addEventListener('resize',scheduleMetrics);
 window.visualViewport?.addEventListener('scroll',scheduleMetrics);
 screen.orientation?.addEventListener?.('change',scheduleMetrics);
 // Custom safe-area overrides used by embedding pages and test fixtures also refresh.
 let observedLayoutStyle='';
 new MutationObserver(()=>{const style=document.documentElement.style,signature=['--safe-left','--safe-right','--safe-top','--safe-bottom','--control-size'].map(k=>style.getPropertyValue(k)).join('|');if(signature!==observedLayoutStyle){observedLayoutStyle=signature;scheduleMetrics();}}).observe(document.documentElement,{attributes:true,attributeFilter:['style']});
 const prevent=e=>{if(e.cancelable)e.preventDefault();};
 const capture=(el,id)=>{try{el.setPointerCapture(id);}catch{}};
 const fireAction=a=>a==='fire'||a==='fire-left';
 function refreshHeld(){state.fire=[...actions.values()].some(v=>fireAction(v.action));state.interactHeld=keys.has('KeyE')||[...actions.values()].some(v=>v.action==='interact');}
 function reset(){
  const captures=new Map([...actions].map(([id,v])=>[id,v.el]));
  for(const [id,v] of lookPointers)captures.set(id,v.el);
  if(stickId!==null)captures.set(stickId,stick);
  keys.clear();actions.clear();lookPointers.clear();stickId=lookId=null;drag=null;touchAim=false;
  state.x=state.z=0;state.fire=state.aim=state.interactHeld=false;thumb.style.transform='';
  document.querySelectorAll('#touch .pressed,#touch .selected').forEach(b=>b.classList.remove('pressed','selected'));
  for(const [id,el] of captures)try{if(el.hasPointerCapture(id))el.releasePointerCapture(id);}catch{}
 }
 function interrupt(){reset();onPause();}
 function getSensitivity(){return {...sensitivity};}
 function setSensitivity(values={}){
  for(const [key,min,max] of [['look',.25,2],['ads',.1,2],['sniper',.1,2]])if(Number.isFinite(values[key]))sensitivity[key]=clamp(values[key],min,max);
  return getSensitivity();
 }
 function getLayout(){return {...layout};}
 function setLayout(values={},opacity){
  if(typeof values==='number')values={size:values,opacity};
  if(Number.isFinite(values.size))layout.size=clamp(values.size,.8,1.25);
  if(Number.isFinite(values.opacity))layout.opacity=clamp(values.opacity,.35,1);
  document.documentElement.style.setProperty('--control-size',layout.size);
  document.documentElement.style.setProperty('--control-opacity',layout.opacity);
  refreshMetrics();
  return getLayout();
 }
 function lookFactor(touch){
  const scope=getScope(),sniper=scope==='sniper'||scope==='scope'||scope===true||scope?.scope;
  const factor=state.aim?(sniper?sensitivity.sniper:sensitivity.ads):sensitivity.look;
  const slowdown=Number(aimSlowdown());
  // Normalize by usable CSS width, including Safari visualViewport and cutouts.
  return factor*(touch?Math.PI/metrics.width:.003)*clamp(Number.isFinite(slowdown)?slowdown:1,.45,1);
 }
 window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLElement&&e.target.matches('input,select,textarea'))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))prevent(e);
  if(e.repeat)return;
  if(e.code==='Escape'){onPause();return;}
  if(e.code==='KeyF'){onAction('fullscreen');return;}
  if(!playing()){if(e.code==='Enter')onAction('start');if(e.code==='KeyB')onAction('buy');return;}
  keys.add(e.code);if(e.code==='KeyE')state.interactHeld=true;
  const action={Space:'jump',KeyR:'reload',KeyE:'interact',Digit1:'weapon0',Digit2:'weapon1',KeyB:'buy'}[e.code];
  if(action)onAction(action);
 });
 window.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyE')refreshHeld();});
 canvas.addEventListener('contextmenu',prevent);
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||!playing())return;
  if(e.button===0)state.fire=true;
  if(e.button===2){touchAim=!touchAim;state.aim=touchAim;}
  drag={x:e.clientX,y:e.clientY};
  if(document.pointerLockElement!==canvas&&canvas.requestPointerLock)try{canvas.requestPointerLock()?.catch?.(()=>{});}catch{}
 });
 window.addEventListener('pointerup',e=>{if(e.pointerType==='touch')return;if(e.button===0)refreshHeld();drag=null;});
 window.addEventListener('mousemove',e=>{
  if(!playing()||mobile)return;
  const factor=lookFactor(false);
  if(document.pointerLockElement===canvas)onLook(e.movementX*factor,-e.movementY*factor);
  else if(drag){onLook((e.clientX-drag.x)*factor,-(e.clientY-drag.y)*factor);drag={x:e.clientX,y:e.clientY};}
 });
 document.addEventListener('pointerlockchange',()=>{
  const locked=document.pointerLockElement===canvas;
  if(hadPointerLock&&!locked&&playing())interrupt();hadPointerLock=locked;
 });
 window.addEventListener('blur',interrupt);window.addEventListener('pagehide',interrupt);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt();});
 window.addEventListener('orientationchange',interrupt);
 screen.orientation?.addEventListener?.('change',interrupt);
 function stickMove(e){
  const {radius,x,y}=metrics.stick;
  const dx=e.clientX-x,dz=e.clientY-y,length=Math.hypot(dx,dz),m=Math.min(1,length/radius);
  const power=Math.max(0,(m-.1)/.9);
  thumb.style.transform=`translate(${length?dx/length*m*radius:0}px,${length?dz/length*m*radius:0}px)`;
  state.x=length?dx/length*power:0;state.z=length?-dz/length*power:0;
 }
 function beginLook(e,el){lookPointers.set(e.pointerId,{el,x:e.clientX,y:e.clientY});if(lookId===null)lookId=e.pointerId;capture(el,e.pointerId);}
 function moveLook(e){
  const item=lookPointers.get(e.pointerId);if(!item)return;prevent(e);
  if(playing()&&e.pointerId===lookId){const factor=lookFactor(true);onLook((e.clientX-item.x)*factor,-(e.clientY-item.y)*factor);}
  item.x=e.clientX;item.y=e.clientY;
 }
 function release(e){
  if(e.pointerId===stickId){stickId=null;state.x=state.z=0;thumb.style.transform='';}
  lookPointers.delete(e.pointerId);if(e.pointerId===lookId)lookId=lookPointers.keys().next().value??null;
  const item=actions.get(e.pointerId);
  if(item){actions.delete(e.pointerId);if(![...actions.values()].some(v=>v.el===item.el))item.el.classList.remove('pressed');refreshHeld();}
 }
 function attachRelease(el){el.addEventListener('pointerup',release);el.addEventListener('lostpointercapture',release);el.addEventListener('pointercancel',interrupt);}
 stick.addEventListener('pointerdown',e=>{prevent(e);if(!playing()||stickId!==null)return;stickId=e.pointerId;capture(stick,stickId);stickMove(e);});
 stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId){prevent(e);stickMove(e);}});attachRelease(stick);attachRelease(look);
 look.addEventListener('pointerdown',e=>{prevent(e);if(playing())beginLook(e,look);});look.addEventListener('pointermove',moveLook);
 document.querySelectorAll('[data-action]').forEach(el=>{
  el.addEventListener('pointerdown',e=>{
   prevent(e);if(!playing())return;
   const action=el.dataset.action;actions.set(e.pointerId,{action,el});el.classList.add('pressed');capture(el,e.pointerId);
   if(fireAction(action)){refreshHeld();if(action==='fire')beginLook(e,el);}
   else if(action==='aim'){touchAim=!touchAim;state.aim=touchAim;el.classList.toggle('selected',touchAim);}
   else{if(action==='interact')refreshHeld();onAction(action);}
  });
  if(el.dataset.action==='fire')el.addEventListener('pointermove',moveLook);attachRelease(el);
 });
 const touch=document.querySelector('#touch');
 const visibilityObserver=new MutationObserver(scheduleMetrics);
 for(const el of [touch,document.querySelector('#hud')])visibilityObserver.observe(el,{attributes:true,attributeFilter:['class']});
 for(const event of ['contextmenu','selectstart','dragstart'])touch.addEventListener(event,prevent);
 for(const event of ['touchstart','touchmove'])touch.addEventListener(event,prevent,{passive:false});
 function sample(){
  if(!playing())return {...state,x:0,z:0,fire:false,aim:false,interactHeld:false};
  if(!mobile){state.x=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));state.z=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));refreshHeldDesktop();}
  return state;
 }
 function refreshHeldDesktop(){state.interactHeld=keys.has('KeyE')||[...actions.values()].some(v=>v.action==='interact');}
 setLayout();
 return {state,keys,reset,sample,mobile,getMetrics:()=>({...metrics,geometry:undefined}),getSensitivity,setSensitivity,getLayout,setLayout,getSettings:()=>({...sensitivity,...layout}),setSettings:values=>{setSensitivity(values);setLayout(values);}};
}
