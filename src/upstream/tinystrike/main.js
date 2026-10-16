// Bean Frontier 4.0 adapter. Upstream gameplay/render modules are vendored at
// 04db555c4fc9f43fef3325c37930ad97a0c27aa3; no online service is constructed.
import * as THREE from 'three';
import {EventBus} from './shared/events.js';
import {CONFIG} from './shared/config.js';
import Input from './core/input.js';
import GameSettings from './core/settings.js';
import TouchControls,{shouldEnableTouchControls} from './core/touch-controls.js';
import World from './world/map.js';
import {MaterialSystem} from './gfx/materials/index.js';
import {PostChain} from './gfx/post/index.js';
import Player from './player/player.js';
import Weapons from './weapons/weapons.js';
import ViewModel from './weapons/viewmodel.js';
import Combat from './combat/combat.js';
import Bots from './ai/bots.js';
import Rounds from './game/rounds.js';
import HUD from './ui/hud.js';
import AudioSys from './audio/audio.js';
import Effects from './effects/effects.js';
import {DEFAULT_MAP_ID,normalizeMapId,MAP_CATALOG} from './maps/catalog.js';
import {CHARACTER,LOW_CHARACTER} from '../../dimensions.js';
import {poseForActor} from '../../character-pose.js';
import {RenderBudget,RenderPacer} from '../../render-budget.js';
import {installTouchGestureGuard} from '../../touch-gesture-guard.js';

const search=new URLSearchParams(location.search),touch=shouldEnableTouchControls();
const loading=globalThis.TINY_STRIKE_LOADING;
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=touch?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
document.getElementById('app').appendChild(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(CONFIG.PLAYER.FOV,1,.035,400);
scene.add(camera);
const game={config:CONFIG,events:new EventBus(),renderer,scene,camera,canvas:renderer.domElement,
 hudRoot:document.getElementById('hud'),debug:search.has('test'),debugAutoStart:false,
 sessionMode:'solo',selectedMapId:normalizeMapId(search.get('map')||DEFAULT_MAP_ID),selectedTeam:'ct',
 gfxQuality:touch?'low':'high',touchDevice:touch,paused:false,loading:false,
 state:{phase:'menu',round:0,scores:{ct:0,t:0},timer:0,money:CONFIG.ECON.START_MONEY,
 bomb:{planted:false,site:null,pos:null,defusingBy:null,defuseProgress:0,carrierId:null},canBuy:false,buyOpen:false},
 profile:{name:'豆豆',callsign:'豆豆',characterId:'vanguard',appearanceId:'vanguard'},
 multiplayer:{active:false,remotePlayers:[],roster:[],isAuthority:()=>true},leaderboard:null,
 perf:{frameMs:0,drawCalls:0,triangles:0,pixelRatio:1.5,physicsHz:120,frames:0}};
game.settings=new GameSettings(game);
game.materials=new MaterialSystem({renderer,quality:game.gfxQuality,anisotropy:Math.min(8,renderer.capabilities.getMaxAnisotropy())});
game.post=!touch&&search.get('post')!=='off'&&PostChain.supported(renderer)?new PostChain(game,{aa:'auto',ssao:true}):null;
game.input=new Input(game);
game.world=new World(game);
game.effects=new Effects(game);
game.audio=new AudioSys(game);
game.player=new Player(game);
game.player.networkId='player';
game.weapons=new Weapons(game);
game.viewmodel=new ViewModel(game);
game.combat=new Combat(game);
game.bots=new Bots(game);
game.bots._root.visible=false;
game.rounds=new Rounds(game);
let accumulator=0,lastTime=performance.now(),manual=false,generation=0;
const renderBudget=new RenderBudget(touch),renderPacer=new RenderPacer();
const STEP=1/120;
const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));

// Cancel rather than release a primed grenade. Both hardware and virtual
// release paths can emit mouseup, so neutralize the state machine first.
game.clearInputs=()=>{
 const w=game.weapons;
 w.cancelInputActivity?.();
 if(w._state==='winding'||w._state==='throwing'){w._state='idle';w._stateT=0;w._thrown=false;}
 w._semiQueued=false;w._rmbQueued=false;w._releaseQueued=false;
 game.input._releaseAll(false);
 game.touchControls?.reset?.();
 w._releaseQueued=false;
 accumulator=0;renderPacer.reset();renderBudget.reset();
};
game.pause=(reason='暂停')=>{
 if(game.state.phase==='menu'||game.loading)return;
 game.paused=true;game.pauseReason=reason;game.clearInputs();
 game.input.locked=false;
 if(document.pointerLockElement)document.exitPointerLock();
 game.audio.ctx?.suspend().catch(()=>{});
 game.events.emit('game:pause',{reason});game.renderFrame?.();
};
game.resume=()=>{
 if(game.loading||!game.paused)return;
 game.clearInputs();game.paused=false;lastTime=performance.now();if(!game.debug)manual=false;
 game.input.requestLock();game.audio.ctx?.resume().catch(()=>{});
 game.events.emit('game:resume');
};
const resetTransient=()=>{
 game.clearInputs();game.paused=false;clearPoseDebug();
 game.combat?._onRoundStart?.();
 game.effects?._clearAll?.();
 game.events.emit('session:reset');
};
game.startSession=async()=>{
 if(game.loading||game.contextLost||game.state.phase!=='menu')return;
 const ticket=++generation;game.loading=true;resetTransient();if(!game.debug)manual=false;
 game.player.team=game.selectedTeam==='t'?'t':'ct';
 const map=game.selectedMapId==='random'?MAP_CATALOG[Math.floor(Math.random()*MAP_CATALOG.length)].id:normalizeMapId(game.selectedMapId);
 game.selectedMapId=map;
 game.events.emit('session:loading',{map});loading?.setStage?.('正在构建战场与材质',25);
 try{
  await paint();if(ticket!==generation)return;
  await game.viewmodel.ready;
  for(const [id,model] of Object.entries(game.viewmodel._models))game.viewmodel._attachNPCArms(model,id);
  if(ticket!==generation)return;
  renderBudget.restore();resize();
  await game.world.loadMap(map,{force:true});
  if(ticket!==generation){game.world.unload();return;}
  game.bots.configureRoster(game.player.team==='ct'?4:5,game.player.team==='t'?4:5);
  game.bots._root.visible=true;game.rounds._startMatch();game.player.update(0);game.viewmodel.update(0);game.loading=false;
  game.input.requestLock();loading?.finish?.();
  game.events.emit('session:ready',{map});
 }catch(error){
  game.loading=false;game.state.phase='menu';game.world.unload();
  game.events.emit('session:error',{message:'战场加载失败，请重试',error:String(error)});
  console.error(error);
 }
};
game.cancelLoading=()=>{
 generation++;game.loading=false;game.paused=false;game.state.phase='menu';
 game.rounds._matchStarted=false;game.clearInputs();game.world.unload();
 game.rounds._removeBombMesh();game.viewmodel.rig.visible=false;game.bots._root.visible=false;
 game.events.emit('session:cancel');game.renderFrame?.();
};
game.restartSession=()=>{
 if(game.loading)return;
 resetTransient();game.rounds._matchStarted=false;game.weapons._everReset=false;
 game.rounds._removeBombMesh();game.rounds._cosmeticArmed=false;
 game.rounds._startMatch();game.player.update(0);game.viewmodel.update(0);game.input.requestLock();game.events.emit('session:ready',{map:game.selectedMapId});
};
game.returnToLobby=()=>{
 generation++;game.loading=false;resetTransient();game.state.phase='menu';game.state.buyOpen=false;
 game.world.unload();game.rounds._matchStarted=false;game.rounds._removeBombMesh();
 game.input.locked=false;if(document.pointerLockElement)document.exitPointerLock();
 game.viewmodel.rig.visible=false;game.bots._root.visible=false;
 game.events.emit('session:lobby');game.renderFrame?.();
};
const loadingPanel=document.getElementById('loading-screen');
if(loadingPanel){
 loadingPanel.innerHTML='<div style="text-align:center"><p class="load-text">正在构建战场与材质…</p><button class="load-cancel" style="min-height:48px;padding:0 30px">取消加载</button><button class="load-retry" hidden style="min-height:48px;padding:0 30px">重试</button></div>';
 loadingPanel.querySelector('.load-cancel').onclick=()=>game.cancelLoading();
 loadingPanel.querySelector('.load-retry').onclick=()=>game.startSession();
 game.events.on('session:loading',()=>{loadingPanel.hidden=false;loadingPanel.querySelector('.load-text').textContent='正在构建战场与材质…';loadingPanel.querySelector('.load-cancel').hidden=false;loadingPanel.querySelector('.load-retry').hidden=true;});
 game.events.on('session:error',p=>{loadingPanel.hidden=false;loadingPanel.querySelector('.load-text').textContent=p.message;loadingPanel.querySelector('.load-retry').hidden=false;});
 for(const e of ['session:ready','session:cancel','session:lobby'])game.events.on(e,()=>{loadingPanel.hidden=true;});
}
game.hud=new HUD(game);
game.touchControls=new TouchControls(game);
installTouchGestureGuard({enabled:touch,
 isPlaying:()=>!game.paused&&!game.loading&&game.state.phase!=='menu',
 isControlling:()=>!game.paused&&!game.loading&&!game.state.buyOpen&&
  !game.hud._settingsOpen&&!game.hud._profileOpen&&!game.hud._leaderboardOpen&&!!game.touchControls._active,
 interrupt:reason=>game.pause(reason)});

function resize(){
 const root=document.documentElement,visual=window.visualViewport;
 const width=Math.max(1,Math.round(visual?.width||root.clientWidth||innerWidth));
 const height=Math.max(1,Math.round(visual?.height||root.clientHeight||innerHeight));
 root.style.setProperty('--layout-width',`${width}px`);root.style.setProperty('--layout-height',`${height}px`);
 root.style.setProperty('--app-width',`${width}px`);root.style.setProperty('--app-height',`${height}px`);
 root.style.setProperty('--app-left',`${visual?.offsetLeft||0}px`);root.style.setProperty('--app-top',`${visual?.offsetTop||0}px`);
 const ratio=renderBudget.resize(width,height,devicePixelRatio||1);
 game.perf.pixelRatio=ratio;
 renderer.setPixelRatio(ratio);renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();game.post?.setSize();
 game.events.emit('viewport:changed',{width,height});
}
resize();window.addEventListener('resize',resize,{passive:true});window.visualViewport?.addEventListener('resize',resize,{passive:true});
window.addEventListener('pointercancel',()=>game.pause('触控中断'),{capture:true});
window.addEventListener('orientationchange',()=>{game.pause('屏幕旋转');resize();});
window.addEventListener('blur',()=>game.pause('切出游戏'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)game.pause('切到后台');});
// Capture before Input's release-to-throw blur handler.
window.addEventListener('blur',()=>game.clearInputs(),{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)game.clearInputs();},{capture:true});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();if(game.paused)game.resume();else game.pause();}
 if(e.key.toLowerCase()==='f'&&!e.repeat){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>{});}
});
game.events.on('input:unlock',()=>{if(!game.paused&&!game.state.buyOpen)game.pause('鼠标已释放');});
game.events.on('ui:toggle-buy',()=>game.clearInputs());
game.events.on('round:start',()=>game.clearInputs());
game.events.on('ui:start',()=>{
 if(!touch)return;
 document.documentElement.requestFullscreen?.().then(()=>screen.orientation?.lock?.('landscape')).catch(()=>{});
});
renderer.domElement.addEventListener('webglcontextlost',e=>{
 e.preventDefault();game.contextLost=true;generation++;
 game.viewmodel._buildRevision=(game.viewmodel._buildRevision||0)+1;
 game.clearInputs();game.loading=false;
 if(game.state.phase!=='menu')game.pause('画面恢复中');
});
renderer.domElement.addEventListener('webglcontextrestored',async()=>{
 game.contextLost=false;
 const ticket=++generation,active=game.state.phase!=='menu'&&game.world._loaded;
 game.clearInputs();game.loading=true;game.viewmodel.rig.visible=false;game.bots._root.visible=false;
 game.events.emit('session:loading',{map:game.selectedMapId});
 try{
  game.world.unload();game.materials.dispose();
  game.materials=new MaterialSystem({renderer,quality:game.gfxQuality,anisotropy:Math.min(8,renderer.capabilities.getMaxAnisotropy())});
  for(const b of game.bots.all){b.heldWeapon?.removeFromParent();b.heldWeapon=null;b.heldWeaponId=null;}
  // Share the NEW readiness barrier with a cancel→start retry. A stale restore
  // must never put its old scene back after the user returned to the lobby.
  game.viewmodel.ready=Promise.all([game.viewmodel._buildProceduralWeapons(),game.viewmodel.assetReady]);
  await game.viewmodel.ready;
  if(ticket!==generation)return;
  if(active){game.world.loadMap(game.selectedMapId,{force:true});for(const b of game.bots.all)game.bots._applyGunLook(b);game.bots._root.visible=true;}
  game.loading=false;resize();
  game.events.emit(active?'session:ready':'session:lobby',{map:game.selectedMapId});
  game.renderFrame?.();
  if(active)game.events.emit('hud:notice',{text:'画面已恢复，点击继续'});
 }catch(error){
  if(ticket!==generation)return;
  game.loading=false;game.events.emit('session:error',{message:'画面恢复失败，请返回大厅重试'});console.error(error);
 }
});
function fixedStep(dt){
 if(game.paused||game.loading||game.state.phase==='menu'){game.input.update(dt);return;}
 game.touchControls?.updateTrigger();
 const before=game.state.phase;
 for(const key of ['player','weapons','bots','combat'])game[key]?.update?.(dt);
 if(before===game.state.phase)game.rounds.update(dt);else game.rounds._updateCanBuy();
 game.spectator?.update();game.effects.update(dt);game.viewmodel.update(dt);
 game.simulationTime=(game.simulationTime||0)+dt;game.input.update(dt);
}
function render(dt){
 if(game.contextLost){game.hud.update(0);game.touchControls.update(0);return;}
 game.world.update?.(game.paused?0:dt);game.materials.update?.(game.paused?0:dt);
 game.touchControls.update(dt);game.hud.update(dt);
 game.audio.update(game.paused?0:dt);
 const audio=game.audio,settings=game.settings;
 if(audio.sfx)audio.sfx.gain.value=settings.sfxEnabled===false?0:1;
 if(audio.music)audio.music.gain.value=settings.musicEnabled===false?0:1;
 renderer.info.autoReset=false;renderer.info.reset();
 if(game.post&&game.world._loaded)game.post.render(scene,camera);else renderer.render(scene,camera);
 game.perf.drawCalls=renderer.info.render.calls;game.perf.triangles=renderer.info.render.triangles;
 game.perf.textures=renderer.info.memory.textures;game.perf.geometries=renderer.info.memory.geometries;
 game.perf.audioSources=audio._voices||0;game.perf.frames++;
 loading?.finish?.();
}
game.renderFrame=()=>render(0);
let perfTime=0,frames=0;
renderer.setAnimationLoop(now=>{
 const elapsed=Math.max(0,(now-lastTime)/1000);lastTime=now;
 if(manual)return;
 perfTime+=elapsed;
 if(perfTime>=1){game.fps=frames/perfTime;frames=0;perfTime=0;}
 accumulator+=Math.min(elapsed,.5);
 if(game.paused||game.loading)accumulator=0;
 const simulationStart=performance.now();
 while(accumulator+1e-10>=STEP){fixedStep(STEP);accumulator-=STEP;}
 game.perf.simulationMs=performance.now()-simulationStart;
 const targetFps=touch?(game.settings.targetFps||60):60;
 if(renderPacer.advance(elapsed,game.paused?10:targetFps)){
  const frameDt=renderPacer.frameDt;game.perf.frameMs=frameDt*1000;
  const start=performance.now();frames++;render(Math.min(frameDt,.5));game.perf.renderCpuMs=performance.now()-start;
  if(!game.paused&&!game.loading&&game.world._loaded&&renderBudget.observe(frameDt,targetFps)){
   // A resize changes only render targets; maps, PBR, shadows and MSAA remain.
   const width=renderer.domElement.clientWidth,height=renderer.domElement.clientHeight;
   renderer.setPixelRatio(renderBudget.ratio);renderer.setSize(width,height,false);game.post?.setSize();game.perf.pixelRatio=renderBudget.ratio;
  }
 }

});
window.advanceTime=ms=>{
 ms=Number(ms);if(!Number.isFinite(ms)||ms<0)return;
 // Explicit time stepping replaces RAF, including production smoke tests.
 // Ordinary UI start/resume restores the production wall-clock loop.
 manual=true;
 accumulator+=Math.min(ms,300000)/1000;
 while(accumulator+1e-10>=STEP){fixedStep(STEP);accumulator-=STEP;}
 render(ms/1000);lastTime=performance.now();
};
window.render_game_to_text=()=>{
 const p=game.player,w=game.weapons,s=game.state,pose=poseForActor(p);
 const vec=v=>v?{x:+v.x.toFixed(3),y:+v.y.toFixed(3),z:+v.z.toFixed(3)}:null;
 return JSON.stringify({version:'4.0.3',coordinateSystem:'meters; +X east, +Z south, +Y up',
 mode:game.loading?'loading':game.paused?'paused':s.phase==='menu'?'lobby':'playing',phase:s.phase,
 map:{id:game.selectedMapId,name:MAP_CATALOG.find(m=>m.id===game.selectedMapId)?.name,loaded:!!game.world._loaded,bounds:game.world.bounds,available:MAP_CATALOG.map(m=>m.id)},
 rules:CONFIG.MATCH,round:s.round,scores:s.scores,timer:+s.timer.toFixed(3),money:s.money,
 character:{radius:CHARACTER.radius,height:CHARACTER.height,eye:CHARACTER.eye},
 player:{team:p.team,alive:p.alive,health:p.health,armor:p.armor,kit:p.hasKit,position:vec(p.position),yaw:p.yaw,pitch:p.pitch,crouching:p.crouching,eye:+p.eyeHeight.toFixed(4),height:+pose.height.toFixed(4),stanceBlend:+pose.crouch.toFixed(4),crouchBlocked:!!p.crouchBlocked},
 weapon:{id:w.currentId,slot:w.current()?.slot,slots:w.slots,ammo:w.currentAmmo(),scope:w.scopeLevel,state:w._state},
 bomb:{planted:s.bomb.planted,site:s.bomb.site,timer:s.phase==='planted'?s.timer:0,carrier:s.bomb.carrierId,dropped:game.bots._bombDropped,droppedPosition:game.bots._bombDropped?vec(game.bots._droppedBombPos):null,position:vec(s.bomb.pos),plantProgress:s.bomb.plantProgress||0,defuseProgress:s.bomb.defuseProgress||0},
 teamAlive:{ct:game.bots.aliveOf('ct')+(p.alive&&p.team==='ct'?1:0),t:game.bots.aliveOf('t')+(p.alive&&p.team==='t'?1:0)},
 teammates:game.bots.all.filter(b=>b.team===p.team).map(b=>({name:b.name,alive:b.alive,position:vec(b.pos),weapon:b.weaponId})),
 quality:{tier:game.gfxQuality,post:!!game.post,antialias:renderer.getContext().getContextAttributes().antialias,pixelRatio:renderer.getPixelRatio(),targetFps:touch?(game.settings.targetFps||60):60},perf:game.perf});
};
function clearPoseDebug(){
 for(const overlay of game._poseDebugMeshes||[]){overlay.removeFromParent();overlay.geometry.dispose();overlay.material.dispose();}
 game._poseDebugMeshes=[];
}
if(game.debug){
 window.__game=game;
 game.test={manual:on=>{manual=on;lastTime=performance.now();},setSeed:seed=>{let a=seed>>>0;Math.random=()=>{a+=0x6d2b79f5;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}};
 game.test.setPose=(index,crouch,pitch=0)=>{
  const c=THREE.MathUtils.clamp(Number(crouch)||0,0,1),actor=index==='player'?game.player:game.bots.all[index];if(!actor)return;
  const height=CHARACTER.height+(LOW_CHARACTER.height-CHARACTER.height)*c;
  if(actor===game.player){actor._heightCur=height;actor.eyeHeight=CHARACTER.eye+(LOW_CHARACTER.eye-CHARACTER.eye)*c;}
  else{actor.height=height;actor.aimPitch=THREE.MathUtils.clamp(pitch,-1.45,1.45);actor.fireAnim=0;actor.bean.retract=0;game.bots._animateBot(actor,0);}
  actor.crouching=c>.5;
 };
 game.test.showHitGeometry=enabled=>{
  clearPoseDebug();if(!enabled)return;
  for(const actor of game.bots.all)for(const part of actor.bean?.hitMeshes||[]){
   const geometry=part.geometry.clone(),zones=geometry.attributes.hitZone,colors=new Float32Array(zones.count*3);
   for(let i=0;i<zones.count;i++){const color=new THREE.Color(zones.getX(i)===1?0xffbb55:0x55e9ff);colors.set([color.r,color.g,color.b],i*3);}
   geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
   const overlay=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,wireframe:true,transparent:true,opacity:.5,depthTest:false}));
   overlay.morphTargetInfluences=part.morphTargetInfluences;part.add(overlay);game._poseDebugMeshes.push(overlay);
  }
 };

}
loading?.finish?.();
