import './style.css';
import {createGraphics} from './gfx.js';
import {createWorld} from './world.js';
import {createInput} from './input.js';
import {createGame} from './game.js';
import {STEP} from './physics.js';
import {WEAPONS} from './combat.js';
import * as characterDisplay from './character.js';
const $=s=>document.querySelector(s),mobile=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
// Canvas text textures must be painted after the embedded font is ready.
try{await document.fonts.load('900 57px "Noto Sans SC"','豆豆火力岛糖果小镇积木工厂高地营地');await document.fonts.ready;}catch{}
const g=createGraphics($('#game'),mobile),world=createWorld(g),game=createGame(g,world);
const input=createInput({canvas:$('#game'),onLook:(x,y)=>game.camera.look(x,y),onPause:()=>game.pause(),onAction:id=>game.action(id),playing:()=>game.state.mode==='playing'});game.bindInput(input);
let helpOpen=false,uiTime=-1;
async function enterMobileFullscreen(){
 if(!input.mobile)return;
 try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();}catch{}
 try{if(screen.orientation?.lock)await screen.orientation.lock('landscape');}catch{}
 g.resize();
}
async function launch(fresh=false){game.audio.unlock();await enterMobileFullscreen();game.start(fresh);}

function modeUI(mode){$('#lobby').classList.toggle('hidden',mode!=='ready');$('#hud').classList.toggle('hidden',mode==='ready');$('#modal').classList.toggle('hidden',!['paused','complete'].includes(mode));$('#help-copy').classList.add('hidden');helpOpen=false;if(mode==='complete'){$('#modal-title').textContent='整座岛，拿下！';$('#modal-copy').textContent='三个据点和三项挑战全部完成。继续探索，或再开一局新的冒险。';$('#resume').textContent='继续自由探索 ↗';}else{$('#modal-title').textContent='休息一下';$('#modal-copy').textContent='岛屿等你回来。所有本局进度都保留。';$('#resume').textContent='继续冒险 ↗';}}
game.bindMode(modeUI);
$('#start-btn').onclick=()=>launch();$('#pause').onclick=()=>game.pause();$('#resume').onclick=()=>{if(helpOpen){$('#modal').classList.add('hidden');helpOpen=false;return;}if(game.state.mode==='complete')game.mode('playing');else game.pause();};$('#restart').onclick=()=>launch(true);$('#home').onclick=()=>game.reset();$('#full').onclick=()=>game.action('fullscreen');
$('#help-btn').onclick=()=>{helpOpen=true;$('#modal').classList.remove('hidden');$('#modal-title').textContent='上岛指南';$('#modal-copy').textContent='找到武器和补给，用彩弹清理岛屿。';$('#help-copy').classList.remove('hidden');$('#resume').textContent='知道了 ↗';};
function settings(){try{const saved=JSON.parse(localStorage.getItem('bean-frontier-settings')||'{}');if(typeof saved.music==='boolean')game.audio.setMusic(saved.music);if(typeof saved.sound==='boolean')game.audio.setEffects(saved.sound);input.setSensitivity?.({look:saved.lookSensitivity??1,ads:saved.adsSensitivity??.6});}catch{}}
function saveSettings(){try{localStorage.setItem('bean-frontier-settings',JSON.stringify({music:game.audio.musicEnabled,sound:game.audio.effectsEnabled,lookSensitivity:input.getSensitivity?.().look??1,adsSensitivity:input.getSensitivity?.().ads??.6}));}catch{}}
$('#music').onclick=()=>{game.audio.setMusic(!game.audio.musicEnabled);saveSettings();};$('#sound').onclick=()=>{game.audio.setEffects(!game.audio.effectsEnabled);saveSettings();};document.querySelectorAll('[data-weapon]').forEach(b=>b.onclick=()=>game.action('weapon'+b.dataset.weapon));
function map(){const s=game.state,p=game.player;let svg='<svg viewBox="-76 -88 152 176" xmlns="http://www.w3.org/2000/svg"><ellipse cx="0" cy="0" rx="72" ry="84" fill="#7baf94"/><path d="M0 48V-56M-40 12H8M0-14H42M-18-14V-63" fill="none" stroke="#edcc95" stroke-width="5"/><rect x="-40" y="-70" width="44" height="37" rx="3" fill="#b2a0ce"/>';
 for(const c of world.camps)svg+=`<path d="M${c.x} ${c.z-4}l4 4-4 4-4-4Z" fill="${c.cleared?'#c3f0a7':'#f97998'}"/>`;
 for(const f of world.flags)svg+=`<text x="${f.x}" y="${f.z+3}" text-anchor="middle" fill="${f.complete?'#c3f0a7':'#ffe283'}" font-size="9">★</text>`;
 for(const v of world.pickups)if(v.active)svg+=`<text x="${v.x}" y="${v.z+3}" text-anchor="middle" fill="${v.type==='weapon'?'#fff3a1':'#edffde'}" font-size="8">${v.type==='weapon'?'▣':'+'}</text>`;
 svg+=`<g transform="translate(${p.x} ${p.z}) rotate(${game.camera.state.yaw*180/Math.PI})"><path d="M0-5L3.5 4 0 2-3.5 4Z" fill="#fff" stroke="#325854" stroke-width=".8"/></g></svg>`;$('#map').innerHTML=svg;
}
function updateUI(force=false){const s=game.state,p=game.player;if(!force&&s.time-uiTime<.08&&s.mode==='playing')return;uiTime=s.time;
 const cleared=world.camps.filter(c=>c.cleared).length,completed=world.flags.filter(f=>f.complete).length;$('#progress').textContent=`据点 ${cleared} / 3 · 挑战 ${completed} / 3`;
 const region=p.z< -33&&p.x<5?'高地营地':p.x>15&&p.z<0?'积木工厂':p.x< -12?'糖果小镇':'糖果海岸';$('#district').textContent=region;
 const near=world.camps.find(c=>!c.cleared&&Math.hypot(c.x-p.x,c.z-p.z)<20);$('#objective').textContent=s.completed?'自由探索 · 挑战可重复开启':near?`${near.name} · 剩余 ${game.enemies.filter(e=>e.camp===near.id&&e.alive).length} 名敌人`:cleared===3?'到金色旗帜旁开启挑战':'探索岛屿，清理三个据点';
 $('#health-fill').style.width=Math.max(0,p.hp)+'%';$('#health-text').textContent=Math.ceil(p.hp);const cs=game.combat.state,slot=game.combat.inventory[cs.weapon];$('#ammo-count').textContent=slot.ammo;$('#ammo-reserve').textContent='/ '+slot.reserve;$('#reload-state').textContent=cs.reloading>0?`换弹中 ${cs.reloading.toFixed(1)}s`:WEAPONS[cs.weapon].name;
 document.querySelectorAll('[data-weapon]').forEach((b,i)=>{const unlocked=game.combat.inventory[i].unlocked;b.classList.toggle('active',cs.weapon===i);b.classList.toggle('locked',!unlocked);const span=b.querySelector('span');if(span)span.classList.toggle('hidden',unlocked);});
 $('#hitmarker').style.opacity=s.hit>0?1:0;$('#hurt').style.opacity=s.hurt*.65;$('#toast').textContent=s.toast;$('#toast').classList.toggle('show',s.toastUntil>s.time&&s.mode==='playing');$('#crosshair').style.opacity=p.alive?1:0;
 const nearest=game.nearestInteraction();$('#interact-hint').textContent=nearest?(input.mobile?'点击互动':'E')+' · '+(nearest.type==='weapon'?'拾取'+WEAPONS[nearest.weapon].name:(nearest.complete?'重玩':'开始')+nearest.name):'';
 $('#challenge-hud').classList.toggle('hidden',!s.challenge);if(s.challenge){const f=world.flags.find(f=>f.id===s.challenge.id);$('#challenge-hud').textContent=`★ ${f.name}　${s.challenge.progress}/${s.challenge.total}　${Math.max(0,Math.ceil(s.challenge.time))} 秒`;}
 $('#music').classList.toggle('off',!game.audio.musicEnabled);$('#sound').classList.toggle('off',!game.audio.effectsEnabled);map();
}
let accumulator=0,last=performance.now(),manualUntil=0,disposed=false;
function step(seconds){accumulator+=Math.max(0,seconds);while(accumulator>=STEP){game.update(STEP);accumulator-=STEP;}}
function render(){if(characterDisplay.updateBeanDisplay){characterDisplay.updateBeanDisplay(game.player,g.camera,world,game.state.time,true);for(const enemy of game.enemies)characterDisplay.updateBeanDisplay(enemy,g.camera,world,game.state.time,false);}g.updateLabels?.();g.renderer.render(g.scene,g.camera);updateUI();}
function frame(now){if(disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(now> manualUntil){step(dt);if(game.state.mode==='ready')game.camera.update(dt,true);}render();requestAnimationFrame(frame);}
window.addEventListener('resize',()=>{g.resize();game.camera.update(0,game.state.mode==='ready',true);render();});window.addEventListener('pagehide',()=>{disposed=true;game.audio.setPlaying(false);});
function sensitivityUI(){const values=input.getSensitivity?.()||{look:1,ads:.6};for(const [id,key] of [['camera','look'],['ads','ads']]){const el=$('#'+id+'-sensitivity'),out=$('#'+id+'-sensitivity-value');if(el)el.value=String(values[key]);if(out)out.textContent=Math.round(values[key]*100)+'%';}}
settings();sensitivityUI();for(const [id,key] of [['camera','look'],['ads','ads']]){const el=$('#'+id+'-sensitivity');if(el)el.addEventListener('input',()=>{input.setSensitivity?.({[key]:Number(el.value)});sensitivityUI();saveSettings();});}
game.reset();updateUI(true);requestAnimationFrame(frame);
window.render_game_to_text=()=>JSON.stringify(game.snapshot());
window.advanceTime=ms=>{manualUntil=performance.now()+250;step(Math.max(0,ms/1000));render();};
if(new URLSearchParams(location.search).has('test'))window.__gameTest={game,g,world,input,step,render,WEAPONS,characterDisplay};
