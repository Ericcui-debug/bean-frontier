import {clamp} from './physics.js';

export function createInput({canvas,onLook,onPause,onAction,playing}){
 const mobile=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
 document.body.classList.toggle('touch',mobile);
 const keys=new Set(),actions=new Map(),lookPointers=new Map();
 const stick=document.querySelector('#move-stick'),thumb=stick.querySelector('b'),look=document.querySelector('#look-zone');
 const state={x:0,z:0,fire:false,aim:false,sprint:false,mobile};
 const sensitivity={look:1,ads:.6};
 let stickId=null,lookId=null,drag=null,touchAim=false;
 const fireAction=action=>action==='fire'||action==='fire-left';
 const prevent=e=>{if(e.cancelable)e.preventDefault();};
 const capture=(el,id)=>{try{el.setPointerCapture(id);}catch{}};
 function refreshFire(){state.fire=[...actions.values()].some(v=>fireAction(v.action));}
 function reset(){
  const captures=new Map([...actions].map(([id,v])=>[id,v.el]));
  for(const [id,v] of lookPointers)captures.set(id,v.el);
  if(stickId!==null)captures.set(stickId,stick);
  keys.clear();actions.clear();lookPointers.clear();stickId=lookId=null;drag=null;touchAim=false;
  state.x=state.z=0;state.fire=state.aim=state.sprint=false;thumb.style.transform='';
  document.querySelectorAll('#touch .pressed,#touch .selected').forEach(b=>b.classList.remove('pressed','selected'));
  for(const [id,el] of captures)if(el.hasPointerCapture(id))el.releasePointerCapture(id);
 }
 function interrupt(){reset();if(playing())onPause();}
 function getSensitivity(){return {...sensitivity};}
 function setSensitivity(values={}){
  for(const [key,min,max] of [['look',.5,1.5],['ads',.2,1]]){
   if(typeof values[key]==='number'&&Number.isFinite(values[key]))sensitivity[key]=clamp(values[key],min,max);
  }
  return getSensitivity();
 }
 window.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='Escape'){onPause();return;}
  if(e.code==='KeyF'){onAction('fullscreen');return;}
  if(!playing()){if(e.code==='Enter')onAction('start');return;}
  keys.add(e.code);
  const action={Space:'jump',KeyR:'reload',KeyE:'interact',Digit1:'weapon0',Digit2:'weapon1',Digit3:'weapon2'}[e.code];
  if(action)onAction(action);
 });
 window.addEventListener('keyup',e=>keys.delete(e.code));
 canvas.addEventListener('contextmenu',prevent);
 canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||!playing())return;
  if(e.button===0)state.fire=true;if(e.button===2)state.aim=true;
  drag={x:e.clientX,y:e.clientY};
  if(document.pointerLockElement!==canvas&&canvas.requestPointerLock)try{const p=canvas.requestPointerLock();p?.catch?.(()=>{});}catch{}
 });
 window.addEventListener('pointerup',e=>{if(e.pointerType==='touch')return;if(e.button===0)state.fire=false;if(e.button===2)state.aim=false;drag=null;});
 window.addEventListener('mousemove',e=>{
  if(!playing()||mobile)return;
  if(document.pointerLockElement===canvas)onLook(e.movementX*.003,-e.movementY*.003);
  else if(drag){onLook((e.clientX-drag.x)*.003,-(e.clientY-drag.y)*.003);drag={x:e.clientX,y:e.clientY};}
 });
 document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&playing())interrupt();});
 window.addEventListener('blur',interrupt);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt();});
 window.addEventListener('orientationchange',interrupt);
 function stickMove(e){
  const rect=stick.getBoundingClientRect(),radius=rect.width/2-22;
  const dx=e.clientX-rect.left-rect.width/2,dz=e.clientY-rect.top-rect.height/2,length=Math.hypot(dx,dz);
  const m=Math.min(1,length/radius),power=Math.max(0,(m-.12)/.88);
  thumb.style.transform=`translate(${length?dx/length*m*radius:0}px,${length?dz/length*m*radius:0}px)`;
  state.x=length?dx/length*power:0;state.z=length?-dz/length*power:0;
  state.sprint=m>.92&&state.z>.75;
 }
 function beginLook(e,el){
  lookPointers.set(e.pointerId,{el,x:e.clientX,y:e.clientY});
  if(lookId===null)lookId=e.pointerId;
  capture(el,e.pointerId);
 }
 function moveLook(e){
  const item=lookPointers.get(e.pointerId);if(!item)return;
  prevent(e);
  if(playing()&&e.pointerId===lookId){
   const factor=.005*(state.aim?sensitivity.ads:sensitivity.look);
   onLook((e.clientX-item.x)*factor,-(e.clientY-item.y)*factor);
  }
  // Remember passive fingers too, so promoting one never replays its old movement.
  item.x=e.clientX;item.y=e.clientY;
 }
 function release(e){
  if(e.pointerId===stickId){stickId=null;state.x=state.z=0;state.sprint=false;thumb.style.transform='';}
  lookPointers.delete(e.pointerId);
  if(e.pointerId===lookId)lookId=lookPointers.keys().next().value??null;
  const item=actions.get(e.pointerId);
  if(item){actions.delete(e.pointerId);if(![...actions.values()].some(v=>v.el===item.el))item.el.classList.remove('pressed');refreshFire();}
 }
 function attachRelease(el){
  el.addEventListener('pointerup',release);el.addEventListener('lostpointercapture',release);el.addEventListener('pointercancel',interrupt);
 }
 stick.addEventListener('pointerdown',e=>{prevent(e);if(!playing()||stickId!==null)return;stickId=e.pointerId;capture(stick,stickId);stickMove(e);});
 stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId){prevent(e);stickMove(e);}});
 attachRelease(stick);attachRelease(look);
 look.addEventListener('pointerdown',e=>{prevent(e);if(playing())beginLook(e,look);});
 look.addEventListener('pointermove',moveLook);
 document.querySelectorAll('[data-action]').forEach(el=>{
  el.addEventListener('pointerdown',e=>{
   prevent(e);if(!playing())return;
   const action=el.dataset.action;actions.set(e.pointerId,{action,el});el.classList.add('pressed');capture(el,e.pointerId);
   if(fireAction(action)){refreshFire();if(action==='fire')beginLook(e,el);}
   else if(action==='aim'){touchAim=!touchAim;state.aim=touchAim;el.classList.toggle('selected',touchAim);}
   else onAction(action);
  });
  if(el.dataset.action==='fire')el.addEventListener('pointermove',moveLook);
  attachRelease(el);
 });
 const touch=document.querySelector('#touch');
 for(const event of ['contextmenu','selectstart','dragstart'])touch.addEventListener(event,prevent);
 for(const event of ['touchstart','touchmove'])touch.addEventListener(event,prevent,{passive:false});
 function sample(){
  if(!playing())return {...state,x:0,z:0,fire:false,aim:false,sprint:false};
  if(!mobile){state.x=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));state.z=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));state.sprint=keys.has('ShiftLeft')||keys.has('ShiftRight');}
  return state;
 }
 return {state,keys,reset,sample,mobile,getSensitivity,setSensitivity};
}
