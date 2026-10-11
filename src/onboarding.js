const KEY='bean-frontier-onboarding',VERSION=1;
const STEPS=[
 {title:'左手移动，右手瞄准',copy:'左下摇杆小幅推动慢走，外圈正常跑动。空白区域都能滑动转镜头；另一根手指移动时也能瞄准。',icon:'↔',caption:'移动与瞄准可以同时操作'},
 {title:'按住开火，同时拖动',copy:'右开火键按住射击，拖动即可压枪与瞄准。开镜点击切换，换弹、跳跃和切枪独立操作；左开火键供多指使用。',icon:'◎',caption:'两根手指即可移动、瞄准、开火'},
 {title:'看互动提示，完成任务',copy:'救援时点按互动带领人质，再护送到室外救援区。爆破时按住安包或拆包；移动、射击或松手会中断。触控取消、切后台或旋转会暂停。',icon:'◈',caption:'操作提示优先显示当前可执行任务'},
];

export function createOnboarding({isMobile=true,onShow=()=>{},onHide=()=>{}}={}){
 const panel=document.querySelector('#onboarding');
 let step=0,resolve=null,previousFocus=null;
 const $=selector=>panel.querySelector(selector);
 function seen(){try{return JSON.parse(localStorage.getItem(KEY)||'{}').version===VERSION;}catch{return false;}}
 function render(){
  const item=STEPS[step];$('#guide-title').textContent=item.title;$('#guide-copy').textContent=item.copy;$('#guide-icon').textContent=item.icon;$('#guide-caption').textContent=item.caption;
  $('#guide-step').textContent=`${step+1} / ${STEPS.length}`;$('#guide-next').textContent=step===STEPS.length-1?'开始行动 ↗':'下一步 →';
  $('#guide-back').disabled=step===0;
  $('#guide-next').focus({preventScroll:true});
 }
 function close(){
  if(!resolve)return;
  try{localStorage.setItem(KEY,JSON.stringify({version:VERSION}));}catch{}
  panel.classList.add('hidden');onHide();const done=resolve;resolve=null;
  previousFocus?.focus?.({preventScroll:true});done(true);
 }
 function show(){
  if(resolve)return Promise.resolve(false);
  previousFocus=document.activeElement;step=0;onShow();panel.classList.remove('hidden');render();
  return new Promise(done=>{resolve=done;});
 }
 $('#guide-next').addEventListener('click',()=>{if(step===STEPS.length-1)close();else{step++;render();}});
 $('#guide-back').addEventListener('click',()=>{if(step>0){step--;render();}});
 $('#guide-skip').addEventListener('click',close);
 panel.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
  if(event.key==='Tab'){
   const buttons=[...panel.querySelectorAll('button')].filter(button=>!button.disabled),first=buttons[0],last=buttons.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
 });
 return {maybeShow:()=>isMobile&&!seen()?show():Promise.resolve(false),show,close,visible:()=>!panel.classList.contains('hidden'),seen};
}
