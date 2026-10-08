import {clamp} from './physics.js';

// Each pointer owns one action. Camera ownership can transfer without replaying
// the passive finger's previous movement, including a finger on the fire key.
export function createInput({canvas,onLook,onPause,onAction,playing,getScope=()=>false,aimSlowdown=()=>1}){
 const mobile=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
 document.body.classList.toggle('touch',mobile);
 const keys=new Set(),actions=new Map(),lookPointers=new Map();
 const stick=document.querySelector('#move-stick'),thumb=stick.querySelector('b'),look=document.querySelector('#look-zone');
 const state={x:0,z:0,fire:false,aim:false,interactHeld:false,mobile};
 const safeProbe=document.createElement('div');safeProbe.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px)';document.body.appendChild(safeProbe);
 const sensitivity={look:1,ads:.6,sniper:.35},layout={size:1,opacity:.72};
 let stickId=null,lookId=null,drag=null,touchAim=false,hadPointerLock=false;
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
  return getLayout();
 }
 function lookFactor(touch){
  const scope=getScope(),sniper=scope==='sniper'||scope==='scope'||scope===true||scope?.scope;
  const factor=state.aim?(sniper?sensitivity.sniper:sensitivity.ads):sensitivity.look;
  const slowdown=Number(aimSlowdown());
  // Normalize by usable CSS width, including Safari visualViewport and cutouts.
  const css=getComputedStyle(safeProbe),safe=Number.parseFloat(css.paddingLeft)+Number.parseFloat(css.paddingRight);
  const width=Math.max(240,(window.visualViewport?.width||window.innerWidth)-(Number.isFinite(safe)?safe:0));
  return factor*(touch?Math.PI/width:.003)*clamp(Number.isFinite(slowdown)?slowdown:1,.45,1);
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
  const rect=stick.getBoundingClientRect(),radius=Math.max(20,rect.width/2-thumb.getBoundingClientRect().width/2-4);
  const dx=e.clientX-rect.left-rect.width/2,dz=e.clientY-rect.top-rect.height/2,length=Math.hypot(dx,dz),m=Math.min(1,length/radius);
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
 for(const event of ['contextmenu','selectstart','dragstart'])touch.addEventListener(event,prevent);
 for(const event of ['touchstart','touchmove'])touch.addEventListener(event,prevent,{passive:false});
 function sample(){
  if(!playing())return {...state,x:0,z:0,fire:false,aim:false,interactHeld:false};
  if(!mobile){state.x=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));state.z=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));refreshHeldDesktop();}
  return state;
 }
 function refreshHeldDesktop(){state.interactHeld=keys.has('KeyE')||[...actions.values()].some(v=>v.action==='interact');}
 setLayout();
 return {state,keys,reset,sample,mobile,getSensitivity,setSensitivity,getLayout,setLayout,getSettings:()=>({...sensitivity,...layout}),setSettings:values=>{setSensitivity(values);setLayout(values);}};
}
