// Display requests stay inside the initiating gesture. Audio recovery only
// touches an existing context; it never enables music or changes user settings.
export function createMobileRuntime({input,audio,onTip=()=>{},onResize=()=>{}}){
 let disposed=false,recoveryQueued=false;
 async function recover(){
  if(disposed||document.hidden||!audio.ctx)return false;
  if(audio.ctx.state==='running')return true;
  recoveryQueued=true;
  const ok=await audio.recover();
  if(ok)recoveryQueued=false;
  return ok;
 }
 const gesture=()=>{if(recoveryQueued||audio.ctx?.state!=='running')void recover();};
 const foreground=()=>{if(!document.hidden){recoveryQueued=true;void recover();}};
 for(const name of ['pointerdown','keydown'])window.addEventListener(name,gesture,{capture:true});
 window.addEventListener('pageshow',foreground);
 document.addEventListener('visibilitychange',foreground);
 async function requestDisplay(){
  if(!input.mobile)return {fullscreen:!!document.fullscreenElement,landscape:innerWidth>innerHeight};
  let fullscreen=!!document.fullscreenElement,landscape=false;
  try{
   if(!fullscreen&&document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();fullscreen=!!document.fullscreenElement;}
  }catch{}
  try{if(screen.orientation?.lock){await screen.orientation.lock('landscape');landscape=true;}}catch{}
  if(!landscape)landscape=(window.visualViewport?.width||innerWidth)>(window.visualViewport?.height||innerHeight);
  if(!fullscreen||!landscape)onTip(!landscape?'请把手机转为横屏，浏览器未提供横屏锁定':'浏览器未提供全屏；横屏仍可正常游玩');
  onResize();
  return {fullscreen,landscape};
 }
 function unlockDisplay(){try{screen.orientation?.unlock?.();}catch{}}
 function dispose(){
  disposed=true;
  for(const name of ['pointerdown','keydown'])window.removeEventListener(name,gesture,{capture:true});
  window.removeEventListener('pageshow',foreground);document.removeEventListener('visibilitychange',foreground);
 }
 return {requestDisplay,unlockDisplay,recoverAudio:recover,dispose};
}

export const INPUT_INTERRUPTION_MESSAGES={
 'touch-cancel':'触控已中断。所有操作已释放，点击继续重新操作。',
 rotation:'屏幕方向已改变。所有操作已释放，请确认布局后继续。',
 background:'离开页面后已暂停。返回时点击继续，计时保持不变。',
 blur:'窗口失去焦点后已暂停。点击继续返回战场。',
};
