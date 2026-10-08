import {CHARACTER,stanceDimensions} from './dimensions.js';
import {THREE,C} from './gfx.js';
import {createBean,poseBean} from './character.js';
import {createCamera} from './camera.js';
import {createCombat,WEAPONS} from './combat.js';
import {createAI} from './ai.js';
import {createHostages} from './hostages.js';
import {GameAudio} from './audio.js';
import {moveActor,sweepActor,STEP} from './physics.js';
const EPS=1e-7;
export const RULES={buy:15,active:180,plant:3,bomb:35,defuse:5,result:4,target:5};
export function createGame(g,world){
 const actors=Array.from({length:10},(_,id)=>Object.assign(createBean(g,id<5?C.pink:C.blue),{id,name:id===0?'你':id<5?'队友 '+id:'对手 '+(id-4),team:id<5?0:1,isPlayer:id===0,money:800,armor:0,slot:0,equipment:[],role:'attack',kx:0,kz:0,invuln:0}));
 const player=actors[0],enemies=actors.filter(a=>a.team===1),audio=new GameAudio(),camera=createCamera(g,world,player);
 const state={mode:'ready',phase:'buy',time:0,round:1,scores:[0,0],attackTeam:0,ctTeam:world.mode==='rescue'?0:1,initialSide:'attack',phaseEndsAt:0,bomb:null,interaction:null,tactic:'A',spectateId:null,spectateSpeed:1,roundResult:null,matchWinner:null,kills:0,hit:0,hurt:0,toast:'',toastUntil:0,drops:[],jumpBuffer:0,coyote:0,buyOpen:false};
 let input=null,onMode=()=>{},dropSerial=0,inStep=false,pendingWipe=false;
 function notify(text){state.toast=text;state.toastUntil=state.time+3.2;}
 function mode(value){state.mode=value;input?.reset();audio.setPlaying(value==='playing');onMode(value);}
 const combat=createCombat({g,world,player,actors,getTime:()=>state.time,audio,notify,onDown:down,onHit:killed=>{state.hit=killed?.24:.12;audio.tone(killed?880:650,.055,'triangle',.045);},onHurt:a=>{if(a===player)state.hurt=.4;}});
 const hostages=createHostages(g,world,actors,{state,notify});state.hostages=hostages.list;
 const ai=createAI(g,world,actors,{state,combat,hostages,nearestInteraction,interactActor});ai.advanceInteraction=advanceInteraction;
 function destroyDrop(d){d.group?.removeFromParent();}
 function clearDrops(){state.drops.forEach(destroyDrop);state.drops=[];}
 function addDrop(type,actor,equipment=null){const group=new THREE.Group();g.scene.add(group);const color=type==='bomb'?C.yellow:C.cream;g.box(0,.2,0,type==='bomb'?.5:.7,.3,.4,color,group);group.position.set(actor.x,actor.y,actor.z);const d={id:++dropSerial,type,x:actor.x,y:actor.y,z:actor.z,equipment:equipment?{...equipment}:null,group};state.drops.push(d);return d;}
 function down(victim,killer=null){
  if(!victim||victim.downHandled)return;victim.downHandled=true;victim.alive=false;victim.hp=0;victim.group.visible=false;victim.interaction=null;victim.vx=victim.vz=0;
  if(victim.equipment?.[1])addDrop('weapon',victim,victim.equipment[1]);victim.equipment[1]=null;victim.slot=0;victim.armor=0;hostages.releaseLeader(victim.id);
  if(killer&&killer.team!==victim.team){killer.money=Math.min(8000,killer.money+300);if(killer===player)state.kills++;}
  if(state.bomb?.carrierId===victim.id&&!state.bomb.planted){state.bomb.carrierId=null;Object.assign(state.bomb,{x:victim.x,y:victim.y,z:victim.z});addDrop('bomb',victim);notify('炸弹掉落 · 进攻方可拾取');}
  if(victim===player){input?.reset();state.spectateSpeed=1;selectSpectator();notify('你已阵亡 · 观战队友至下一回合');}
  pendingWipe=true; // Evaluate the entire event batch on the next simulation step.
 }
 function selectSpectator(next=false){const living=actors.filter(a=>a.team===player.team&&a.alive);if(!living.length){state.spectateId=null;return;}const index=living.findIndex(a=>a.id===state.spectateId);state.spectateId=living[next?(index+1)%living.length:Math.max(0,index)].id;}
 function finishRound(winner,reason){
  if(state.mode!=='playing'||!['active','planted'].includes(state.phase))return false;
  state.phase='round_end';state.roundResult={winner,reason,at:state.time};state.scores[winner]++;state.phaseEndsAt=state.time+RULES.result;state.interaction=null;
  actors.forEach(a=>{a.money=Math.min(8000,a.money+(a.team===winner?3000:2000));a.interaction=null;a.vx=a.vz=0;});input?.reset();state.buyOpen=false;
  if(reason==='炸弹爆炸'){combat.burst(new THREE.Vector3(state.bomb.x,state.bomb.y+.8,state.bomb.z),C.yellow,40);audio.tone(105,.3,'triangle');}notify((winner===player.team?'本回合胜利':'本回合失利')+' · '+reason);audio.tone(winner===player.team?880:240,.2,'triangle');onMode(state.mode);return true;
 }
 function checkWipe(){pendingWipe=false;if(!['active','planted'].includes(state.phase))return;
  const attackers=actors.some(a=>a.alive&&a.team===state.attackTeam),defenders=actors.some(a=>a.alive&&a.team!==state.attackTeam);
  // A same-time mutual elimination belongs to the guarding side. Planted C4
  // remains live even when neither team has surviving actors.
  if(!attackers&&!defenders){if(state.phase==='active')finishRound(1-state.attackTeam,world.mode==='rescue'?'双方全灭 · 守卫获胜':'双方全灭 · 防守获胜');return;}
  if(world.mode==='rescue'&&hostages.rescuedCount()>=2){finishRound(state.ctTeam,'两名人质已救出');return;}
  if(!defenders){finishRound(state.attackTeam,world.mode==='rescue'?'守卫方全灭':'防守方全灭');return;}
  if(!attackers&&state.phase==='active')finishRound(1-state.attackTeam,world.mode==='rescue'?'反恐方全灭':'进攻方全灭');
 }
 function placeActors(fresh=false){actors.forEach(a=>{const keep=!fresh&&a.alive&&state.round>1;combat.resetActor(a,keep);a.hp=a.maxHp=100;a.alive=true;a.downHandled=false;a.armor=keep?a.armor:0;a.role=a.team===state.attackTeam?'attack':'defend';a.faction=a.team===state.ctTeam?'CT':'T';const spawn=world.spawns[a.role][a.id%5];Object.assign(a,{...spawn,vx:0,vy:0,vz:0,kx:0,kz:0,grounded:true,yaw:spawn.yaw??(a.role==='attack'?0:Math.PI),invuln:0,interaction:null,healthUntil:0,stance:'standing',height:CHARACTER.height,eye:CHARACTER.eye,traverseForward:0,traverseJump:false,traverseWaypoint:null,ladderId:null,ladderCooldown:0});a.group.visible=a!==player;poseBean(a,state.time,true);if(fresh)a.money=800;});}
 function beginRound(){
  const half=state.round===5;if(half){state.attackTeam=1-state.attackTeam;notify('交换攻守 · 存活装备与资金保留');}
  state.ctTeam=world.mode==='rescue'?state.attackTeam:1-state.attackTeam;
  clearDrops();world.reset();placeActors(false);hostages.reset();const carrier=state.attackTeam===player.team?player:actors.find(a=>a.team===state.attackTeam);
  state.bomb=world.mode==='rescue'?null:{carrierId:carrier.id,planted:false,siteId:null,x:carrier.x,y:carrier.y,z:carrier.z,explodesAt:null};state.enemyTactic=Math.random()<.5?'A':'B';state.phase='buy';state.phaseEndsAt=state.time+RULES.buy;state.roundResult=null;state.interaction=null;state.spectateId=null;state.spectateSpeed=1;state.jumpBuffer=state.coyote=0;state.buyOpen=true;input?.reset();camera.reset();camera.state.yaw=player.yaw;ai.reset();
  for(const a of actors)if(a!==player)buyFor(a,'recommended');onMode(state.mode);camera.update(0,player);
 }
 function reset(){input?.reset();clearDrops();world.reset();combat.clearEffects();combat.resetStats?.();Object.assign(state,{mode:'ready',phase:'buy',time:0,round:1,scores:[0,0],attackTeam:0,ctTeam:world.mode==='rescue'?0:1,initialSide:'attack',phaseEndsAt:0,bomb:null,interaction:null,tactic:'A',spectateId:null,spectateSpeed:1,roundResult:null,matchWinner:null,kills:0,hit:0,hurt:0,toast:'',toastUntil:0,buyOpen:false});actors.forEach(a=>{a.money=800;a.armor=0;a.alive=true;combat.resetActor(a,false);});placeActors(true);hostages.reset();ai.reset();camera.reset();camera.state.yaw=player.yaw;camera.update(0,player);audio.reset();mode('ready');}
 function setMap(id){if(!['ready','match_end'].includes(state.mode))return false;reset();world.loadMap(id);reset();camera.update(0,true);return true;}
 function start(side='attack',fresh=false){if(typeof side==='boolean'){fresh=side;side=state.initialSide;}if(fresh)reset();if(state.mode==='paused'){pause();return;}if(state.mode!=='ready'&&state.mode!=='match_end')return;if(state.mode==='match_end')reset();state.initialSide=side==='defend'?'defend':'attack';state.attackTeam=state.initialSide==='attack'?0:1;mode('playing');beginRound();audio.unlock().then(()=>audio.setPlaying(state.mode==='playing'));notify(world.mode==='rescue'?'购买装备 · 选择正门 / 后门 / 屋顶战术':'购买装备 · 选择 A 或 B 战术');}
 function pause(){if(state.mode==='playing'){mode('paused');if(document.pointerLockElement)document.exitPointerLock?.();}else if(state.mode==='paused')mode('playing');actors.forEach(a=>a.interaction=null);state.interaction=null;}
 function buyFor(a,id){if(state.phase!=='buy'||!a.alive)return false;
  if(id==='recommended'){let bought=false;if(!a.equipment[1]){const desired=[3,2,1].filter(v=>v!==3||a.id%4===2).find(v=>a.money>=WEAPONS[v].price+((a.armor?0:600)))??[2,1].find(v=>a.money>=WEAPONS[v].price);if(desired)bought=buyFor(a,desired)||bought;}if(a.money>=600&&!a.armor)bought=buyFor(a,'armor')||bought;return bought;}
  if(id==='armor'){if(a.armor||a.money<600)return false;a.money-=600;a.armor=100;return true;}
  const weapon=WEAPONS[Number(id)];if(!weapon||Number(id)===0||a.equipment[1]?.id===Number(id)||a.money<weapon.price)return false;
  if(a.equipment[1])addDrop('weapon',a,a.equipment[1]);a.money-=weapon.price;combat.equip(a,Number(id));combat.select(a,1);return true;
 }
 function buy(id){if(state.mode!=='playing'||state.phase!=='buy')return false;const result=buyFor(player,id);notify(result?'装备购买成功':'资金不足或已经拥有护甲');return result;}
 function setTactic(id){if(state.phase==='buy'&&(world.mode==='rescue'?['A','B','C']:['A','B']).includes(id))state.tactic=id;}
 function nearestInteraction(a=player){if(!a.alive||!['active','planted'].includes(state.phase))return null;
  const captive=hostages.nearest(a);if(captive)return captive;
  const door=world.nearestDoor?.(a)||world.interactionAt?.(a);if(door)return {...door,name:door.label||'开关后门'};
  const b=state.bomb,close=o=>Math.hypot(a.x-o.x,a.z-o.z)<=o.radius&&Math.abs(a.y-o.y)<.75&&!world.blocked({x:a.x,y:a.y+stanceDimensions(a).sight,z:a.z},{x:o.x,y:o.y+.35,z:o.z},.01);
  if(b?.planted&&a.team!==state.attackTeam&&close({...b,radius:2.5}))return {type:'defuse',name:'按住拆包',duration:RULES.defuse,...b};
  if(!b?.planted&&b?.carrierId===a.id){const site=world.sites.find(s=>close(s));if(site)return {type:'plant',name:'按住安包',duration:RULES.plant,siteId:site.id,...site};}
  let best=null,dist=2.3;for(const d of state.drops){if(!['weapon','bomb'].includes(d.type))continue;if(world.blocked({x:a.x,y:a.y+stanceDimensions(a).sight,z:a.z},{x:d.x,y:d.y+.35,z:d.z},.01))continue;if(d.type==='bomb'&&(a.team!==state.attackTeam||b?.planted))continue;const gap=Math.hypot(a.x-d.x,a.z-d.z);if(d.type==='bomb'&&gap<2.3&&Math.abs(a.y-d.y)<.75)return {...d,name:'拾取炸弹'};if(gap<dist&&Math.abs(a.y-d.y)<.75){best=d;dist=gap;}}
  return best?{...best,name:best.type==='bomb'?'拾取炸弹':'拾取 '+WEAPONS[best.equipment.id].name}:null;
 }
 function interactActor(a,hold=false){const o=nearestInteraction(a);if(!o)return false;
  if(o.type==='plant'||o.type==='defuse'){if(!hold)return false;return true;}
  if(o.type==='hostage')return hostages.interact(a,o.id);if(o.type==='door')return world.toggleDoor?.(o.id)??false;
  const d=state.drops.find(v=>v.id===o.id);if(!d)return false;
  if(d.type==='bomb'){state.bomb.carrierId=a.id;notify(a===player?'已拾取炸弹':'队友接管炸弹');}
  else{if(a.equipment[1])addDrop('weapon',a,a.equipment[1]);a.equipment[1]={...d.equipment};a.reloadUntil=0;a.reloadSlot=null;a.cooldown=Math.max(.12,a.cooldown||0);combat.select(a,1);}
  destroyDrop(d);state.drops=state.drops.filter(v=>v!==d);return true;
 }
 function advanceInteraction(a,held,moving,shooting,dt){
  const o=nearestInteraction(a);if(!held||moving||shooting||!a.grounded||Math.abs(a.vy)> .1||!o||!['plant','defuse'].includes(o.type)){a.interaction=null;return;}
  if(!a.interaction||a.interaction.type!==o.type||a.interaction.siteId!==o.siteId)a.interaction={actorId:a.id,type:o.type,siteId:o.siteId,duration:o.duration,elapsed:0,startedAt:state.time-dt};
  const use=a.interaction;use.elapsed+=dt;use.progress=Math.min(1,use.elapsed/use.duration);
  if(use.elapsed+EPS<use.duration)return;
  if(use.type==='plant'&&state.phase==='active'&&state.time<=state.phaseEndsAt+EPS){const site=world.sites.find(s=>s.id===use.siteId);state.bomb={carrierId:null,planted:true,siteId:site.id,x:a.x,y:a.y,z:a.z,explodesAt:state.time+RULES.bomb};state.phase='planted';state.phaseEndsAt=state.bomb.explodesAt;a.money=Math.min(8000,a.money+300);addDrop('planted',a);notify('炸弹已安放 · 防守到爆炸');audio.tone(1000,.15);}
  else if(use.type==='defuse'&&state.phase==='planted'&&state.time<=state.bomb.explodesAt+EPS){a.money=Math.min(8000,a.money+300);finishRound(a.team,'炸弹已拆除');}
  a.interaction=null;
 }
 function action(id){if(id==='start'){start();return;}if(state.mode!=='playing')return;
  if(id==='spectate-next'&&!player.alive){selectSpectator(true);return;}if(id==='speed'&&!player.alive){state.spectateSpeed=state.spectateSpeed===4?1:4;return;}
  if(id==='buy'&&state.phase==='buy'){state.buyOpen=!state.buyOpen;input?.reset();return;}
  if(!player.alive||!['active','planted'].includes(state.phase))return;
  if(id==='jump'){state.jumpBuffer=.13;player.interaction=null;state.interaction=null;}if(id==='reload')combat.reload(player);if(id==='interact')interactActor(player);if(id==='weapon0'||id==='weapon1')combat.select(player,Number(id.slice(-1)));
 }
 function step(dt){
  if(state.mode!=='playing')return;inStep=true;state.time+=dt;state.hit=Math.max(0,state.hit-dt);state.hurt=Math.max(0,state.hurt-dt);
  const controls=input?.sample()||{x:0,z:0,aim:false,fire:false,interactHeld:false};
  if(state.phase==='round_end'){if(state.time+EPS>=state.phaseEndsAt){if(state.scores.some(s=>s>=RULES.target)||state.round>=9){state.phase='match_end';state.matchWinner=state.scores[0]>state.scores[1]?0:1;state.buyOpen=false;mode('match_end');}else{state.round++;beginRound();}}inStep=false;return;}
  if(state.phase==='buy'){camera.state.aim=false;if(state.time+EPS>=state.phaseEndsAt){state.phase='active';state.phaseEndsAt=state.time+RULES.active;state.buyOpen=false;input?.reset();actors.forEach(a=>a.vx=a.vz=0);notify(world.mode==='rescue'?'交战开始 · '+(player.team===state.ctTeam?'救出两名人质':'阻止反恐方救援'):'交战开始 · '+(player.team===state.attackTeam?'推进 '+state.tactic+' 点安包':'守住 A / B 包点'));onMode(state.mode);}camera.update(dt,player);inStep=false;return;}
  if(!['active','planted'].includes(state.phase)){inStep=false;return;}
  combat.update(dt);camera.state.aim=controls.aim;
  if(player.alive){const mag=Math.hypot(controls.x,controls.z),norm=Math.max(1,mag),speed=['low','crouch'].includes(player.stance)?2.1:controls.aim?3.3:5.5,yaw=camera.state.yaw,dx=(Math.cos(yaw)*controls.x+Math.sin(yaw)*controls.z)/norm,dz=(Math.sin(yaw)*controls.x-Math.cos(yaw)*controls.z)/norm;
   const blend=1-Math.exp(-dt*24);player.vx+=(dx*speed-player.vx)*blend;player.vz+=(dz*speed-player.vz)*blend;state.coyote=player.grounded?.09:Math.max(0,state.coyote-dt);state.jumpBuffer=Math.max(0,state.jumpBuffer-dt);
   if(state.jumpBuffer>0&&state.coyote>0&&!['low','crouch'].includes(player.stance)){player.vy=7.4;player.grounded=false;state.jumpBuffer=state.coyote=0;}player.traverseForward=controls.z;player.traverseJump=!!controls.jump||state.jumpBuffer>0;moveActor(player,dt,world);
   // First-person eye must not enter another bean's body while strafing past it.
   for(const other of actors){if(other===player||!other.alive||Math.abs(other.y-player.y)>=CHARACTER.height)continue;const dx=player.x-other.x,dz=player.z-other.z,d=Math.hypot(dx,dz),minimum=player.radius+other.radius;if(d<minimum&&d>.001)sweepActor(player,dx/d*(minimum-d),dz/d*(minimum-d),world);}
   player.yaw=camera.state.yaw;poseBean(player,state.time,true);player.group.visible=false;if(player.y< -8)down(player);
   camera.update(dt,player);if(controls.fire)combat.fire(player,g.camera);
   if(player.alive)advanceInteraction(player,controls.interactHeld,mag>.04||Math.hypot(player.vx,player.vz)>.25,controls.fire,dt);
  }
  ai.update(dt,state.time,combat);
  hostages.update(dt,state.time);for(const a of actors)if(!a.alive&&!a.downHandled)down(a);checkWipe();
  if(state.phase==='active'&&state.time+EPS>=state.phaseEndsAt)finishRound(1-state.attackTeam,world.mode==='rescue'?'救援时间耗尽':'交战时间耗尽');
  else if(state.phase==='planted'&&state.time+EPS>=state.bomb.explodesAt)finishRound(state.attackTeam,'炸弹爆炸');
  state.interaction=player.interaction?{...player.interaction}:null;
  if(!player.alive){if(!actors.find(a=>a.id===state.spectateId)?.alive)selectSpectator();const a=actors.find(a=>a.id===state.spectateId)||player;if(a!==player){camera.state.yaw=a.yaw;camera.state.pitch=a.pitch||0;camera.state.aim=false;}camera.update(dt,a);}
  inStep=false;
 }
 function update(dt){if(state.mode!=='playing'){if(state.mode==='ready')camera.update(dt,true);return;}let remaining=dt*(!player.alive?state.spectateSpeed:1);while(remaining>EPS&&state.mode==='playing'){let part=Math.min(STEP,remaining);if(state.phaseEndsAt>state.time&&state.phaseEndsAt-state.time<part)part=state.phaseEndsAt-state.time;step(part);remaining-=part;}}
 function snapshot(){const r=v=>Math.round((v||0)*1000)/1000;const summary=a=>({id:a.id,team:a.team,role:a.role,faction:a.faction,stance:a.ladderId?'climbing':a.stance||'standing',ladderId:a.ladderId??null,region:world.areaAt?.(a),x:r(a.x),y:r(a.y),z:r(a.z),hp:a.hp,alive:a.alive,money:a.money,armor:a.armor,slot:a.slot,equipment:a.equipment.map(v=>v?{...v}:null),aiMode:a.aiMode,interaction:a.interaction?{...a.interaction}:null});return {coordinateSystem:'x east, y height, z south; yaw 0 faces north (-z)',map:{id:world.id,name:world.name,mode:world.mode||'bomb',bounds:{...world.bounds}},characterSize:{scale:CHARACTER.scale,radius:CHARACTER.radius,height:CHARACTER.height,eye:CHARACTER.eye},mode:state.mode,phase:state.phase,time:r(state.time),round:state.round,scores:[...state.scores],attackTeam:state.attackTeam,ctTeam:state.ctTeam,gameMode:world.mode||'bomb',hostages:hostages.snapshot(player.alive?player:actors.find(a=>a.id===state.spectateId)||player),rescuedCount:hostages.rescuedCount(),tactic:state.tactic,phaseEndsAt:r(state.phaseEndsAt),remaining:r(Math.max(0,state.phaseEndsAt-state.time)),bomb:state.bomb?(()=>{const b={...state.bomb},carrier=actors.find(a=>a.id===b.carrierId);if(carrier&&carrier.team!==player.team&&!b.planted){delete b.x;delete b.y;delete b.z;}return b;})():null,interaction:state.interaction,roundResult:state.roundResult,matchWinner:state.matchWinner,spectateId:state.spectateId,spectateSpeed:state.spectateSpeed,player:{...summary(player),vx:r(player.vx),vy:r(player.vy),vz:r(player.vz),grounded:player.grounded},actors:actors.map(a=>{if(a.team===player.team)return summary(a);const viewer=actors.find(v=>v.id===state.spectateId)||player;const visible=a.alive&&!world.blocked({x:viewer.x,y:viewer.y+stanceDimensions(viewer).sight,z:viewer.z},{x:a.x,y:a.y+stanceDimensions(a).sight,z:a.z});return visible?{id:a.id,team:a.team,role:a.role,faction:a.faction,stance:a.ladderId?'climbing':a.stance||'standing',ladderId:a.ladderId??null,region:world.areaAt?.(a),x:r(a.x),y:r(a.y),z:r(a.z),hp:a.hp,alive:true}:{id:a.id,team:a.team,alive:a.alive};}),camera:{yaw:r(camera.state.yaw),pitch:r(camera.state.pitch),aim:camera.state.aim,scope:camera.state.scope,position:{x:r(g.camera.position.x),y:r(g.camera.position.y),z:r(g.camera.position.z)},fov:r(g.camera.fov)},combat:{...combat.state,inventory:combat.inventory.map(v=>v?{...v}:null)},drops:state.drops.map(({id,type,x,y,z,equipment})=>({id,type,x,y,z,equipment})),kills:state.kills,physicsHz:120,touch:input?{...input.state}:null,audio:audio.status()};}
 reset();return {g,world,player,actors,enemies,state,audio,camera,combat,ai,hostages,notify,mode,reset,setMap,start,pause,down,finishRound,beginRound,action,buy,setTactic,update,snapshot,nearestInteraction,interact:()=>interactActor(player),interactActor,advanceInteraction,bindInput:value=>{input=value;},bindMode:fn=>{onMode=fn;}};
}
