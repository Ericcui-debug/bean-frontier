import {THREE,C} from './gfx.js';
import {segmentSphere,clamp} from './physics.js';
import {CHARACTER,stanceDimensions} from './dimensions.js';
import {poseBean} from './character.js';
export const WEAPONS=[
 {id:0,name:'糖豆手枪',price:0,mag:12,reserve:60,damage:20,interval:.24,reload:1.05,spread:.004,color:C.yellow},
 {id:1,name:'泡泡冲锋枪',price:1000,mag:30,reserve:120,damage:18,interval:.10,reload:1.45,spread:.009,color:C.blue},
 {id:2,name:'彩弹步枪',price:2400,mag:30,reserve:90,damage:30,interval:.14,reload:1.65,spread:.005,color:C.pink},
 {id:3,name:'糖果狙击枪',price:3500,mag:5,reserve:20,damage:80,interval:1.15,reload:2.1,spread:.001,color:C.purple}
];
export function createCombat({g,world,player,actors,getTime,onDown=()=>{},onHit=()=>{},onHurt=()=>{},notify=()=>{},audio}){
 const particles=[],traces=[],particleGeo=new THREE.BoxGeometry(1,1,1),materials=new Map();
 const state={shots:0,kills:0,lastHit:null};
 const now=()=>Number(getTime?.())||0;
 const current=actor=>actor.equipment?.[actor.slot||0]||actor.equipment?.[0];
 const definition=actor=>WEAPONS[current(actor)?.id??0];
 Object.defineProperties(state,{weapon:{enumerable:true,get:()=>current(player)?.id??0},cooldown:{enumerable:true,get:()=>player.cooldown||0},reloading:{enumerable:true,get:()=>Math.max(0,(player.reloadUntil||0)-now())}});
 function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshBasicMaterial({color}));return materials.get(color);}
 function burst(pos,color,count=10){for(let i=0;i<count&&particles.length<100;i++){const mesh=new THREE.Mesh(particleGeo,material(color));mesh.position.copy(pos);mesh.scale.setScalar(.055+Math.random()*.065);g.scene.add(mesh);particles.push({mesh,v:new THREE.Vector3((Math.random()-.5)*4,1+Math.random()*3,(Math.random()-.5)*4),life:.25+Math.random()*.35});}}
 function equip(actor,id){const w=WEAPONS[id];if(!w)return false;actor.equipment??=[null,null];actor.equipment[id===0?0:1]={id,ammo:w.mag,reserve:w.reserve};actor.slot=id===0?0:1;actor.reloadUntil=0;actor.cooldown=.12;return true;}
 function resetActor(actor,keep=false){if(!keep||!actor.equipment?.[0]){actor.equipment=[{id:0,ammo:12,reserve:60},null];actor.slot=0;}else{for(const item of actor.equipment){if(!item)continue;item.ammo=WEAPONS[item.id].mag;item.reserve=WEAPONS[item.id].reserve;}if(!actor.equipment[actor.slot])actor.slot=0;}actor.cooldown=0;actor.reloadUntil=0;actor.reloadSlot=null;actor.recoil=0;actor.shots=0;actor.healthUntil=0;}
 function select(actor,slot){if(!actor.equipment?.[slot])return false;if(actor.slot===slot)return true;actor.slot=slot;actor.reloadUntil=0;actor.reloadSlot=null;actor.cooldown=Math.max(actor.cooldown||0,.12);return true;}
 function reload(actor=player){const item=current(actor),w=definition(actor);if(!actor.alive||actor.reloadUntil>now()||!item||item.ammo>=w.mag||item.reserve<=0)return false;actor.reloadSlot=actor.slot;actor.reloadUntil=now()+w.reload;if(actor===player)audio?.tone(330,.09,'triangle',.03);return true;}
 function actorHit(a,b,ignore){let best=null;for(const actor of actors){if(actor===ignore||!actor.alive)continue;for(const v of stanceDimensions(actor).hitVolumes){const ratio=(v.ry??v.r)/v.r,from={x:a.x,y:actor.y+(a.y-actor.y)/ratio,z:a.z},to={x:b.x,y:actor.y+(b.y-actor.y)/ratio,z:b.z},t=segmentSphere(from,to,new THREE.Vector3(actor.x,actor.y+v.y/ratio,actor.z),v.r);if(t!==null&&(!best||t<best.t))best={t,actor,head:v.head};}}return best;}
 function trace(a,b,color){if(traces.length>=36){const old=traces.shift();old.mesh.removeFromParent();old.mesh.geometry.dispose();old.mesh.material.dispose();}const geometry=new THREE.BufferGeometry().setFromPoints([a,b]),mesh=new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.75}));g.scene.add(mesh);traces.push({mesh,life:.055});}
 function damage(victim,amount,killer,head=false){if(!victim.alive||victim.team===killer.team)return false;const actual=amount*(head?2:victim.armor>0?.8:1);victim.hp=Math.max(0,victim.hp-actual);victim.healthUntil=now()+1.25;onHurt(victim);const killed=victim.hp<=0,size=stanceDimensions(victim);if(killed){victim.alive=false;victim.group.visible=false;burst(new THREE.Vector3(victim.x,victim.y+size.body.y,victim.z),victim.color,24);if(killer===player)state.kills++;onDown(victim,killer);}else burst(new THREE.Vector3(victim.x,victim.y+size.aimHeight,victim.z),victim.color,5);if(killer===player){state.lastHit={victimId:victim.id,head,killed,damage:actual,time:now()};onHit(killed);audio?.tone(killed?920:670,.06,'sine',.035);}return killed;}
 function fire(actor=player,camera=null){const item=current(actor),w=definition(actor);if(!actor.alive||!item||actor.cooldown>1e-7||actor.reloadUntil>now())return false;if(item.ammo<=0){reload(actor);return false;}
  const size=stanceDimensions(actor),eye=new THREE.Vector3(actor.x,actor.y+size.eye,actor.z),dir=new THREE.Vector3();
  if(camera){camera.getWorldDirection(dir);eye.copy(camera.position);}else if(actor.aimTarget){dir.copy(actor.aimTarget).sub(eye).normalize();}else return false;
  if(!Number.isFinite(dir.x+dir.y+dir.z)||dir.lengthSq()<.9)return false;
  const gunDirection=dir.clone();
  item.ammo--;actor.cooldown=w.interval;actor.recoil=Math.min(1.8,(actor.recoil||0)+.8);actor.shots=(actor.shots||0)+1;if(actor===player){state.shots++;audio?.tone(w.id===3?105:190+w.id*70,w.id===3?.15:.055,'square',.03);}
  const aimed=camera?!!actor.aiming:true,moving=Math.hypot(actor.vx||0,actor.vz||0)>.8;
  let spread=w.spread*(aimed?.4:1)+(moving?.018:0)+(actor.grounded===false?.05:0)+Math.min(.016,(actor.recoil||0)*.003);
  if(w.id===3&&!aimed)spread+=.035;if(!camera)spread+=Math.max(0,actor.aiSpread||0);
  const right=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,dir).normalize();
  dir.addScaledVector(right,(Math.random()-.5)*spread*2).addScaledVector(up,(Math.random()-.5)*spread*2).normalize();
  const far=eye.clone().addScaledVector(dir,130),sightWall=world.blocked(eye,far),sightActor=actorHit(eye,far,actor);let sightT=sightWall?.t??1;if(sightActor&&sightActor.t<sightT)sightT=Math.min(sightT,sightActor.t+.001);
  const target=eye.clone().lerp(far,sightT),muzzle=new THREE.Vector3();
  if(camera&&camera.userData?.muzzle){camera.userData.muzzle.getWorldPosition(muzzle);}else if(actor.muzzle&&actor.body&&actor.gun){
   // AI fires before its movement/pose pass: sync to this actor's current
   // position and aim so the obstruction ray starts at the visible barrel.
   actor.yaw=Math.atan2(gunDirection.x,-gunDirection.z);actor.gunPitch=-Math.asin(clamp(gunDirection.y,-1,1));poseBean(actor,now(),true);actor.group.updateMatrixWorld(true);actor.muzzle.getWorldPosition(muzzle);
  }else{muzzle.copy(eye).addScaledVector(right,size.fallbackMuzzle.right).addScaledVector(dir,size.fallbackMuzzle.forward);muzzle.y-=size.fallbackMuzzle.down;}
  const obstruction=world.blocked(eye,muzzle,.025);let hit=null,wall=null,end;
  if(obstruction){wall=obstruction;end=eye.clone().lerp(muzzle,obstruction.t);}else{wall=world.blocked(muzzle,target);hit=actorHit(muzzle,target,actor);if(hit&&(!wall||hit.t<wall.t))end=muzzle.clone().lerp(target,hit.t);else{hit=null;end=wall?muzzle.clone().lerp(target,wall.t):target;}}
  trace(muzzle,end,w.color);if(hit){damage(hit.actor,w.damage,actor,hit.head);}else if(wall){world.damageSolid?.(wall.solid,w.damage,actor);burst(end,w.color,4);}
  return true;
 }
 function update(dt){for(const actor of actors){actor.cooldown=Math.max(0,(actor.cooldown||0)-dt);actor.recoil=Math.max(0,(actor.recoil||0)-dt*5);if(actor.reloadUntil>0&&actor.reloadUntil<=now()+1e-8){const item=actor.equipment?.[actor.reloadSlot];if(item){const need=Math.min(WEAPONS[item.id].mag-item.ammo,item.reserve);item.ammo+=need;item.reserve-=need;}actor.reloadUntil=0;actor.reloadSlot=null;}}
  for(let i=traces.length-1;i>=0;i--){const p=traces[i];p.life-=dt;if(p.life<=0){p.mesh.removeFromParent();p.mesh.geometry.dispose();p.mesh.material.dispose();traces.splice(i,1);}}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y-=8*dt;p.mesh.position.addScaledVector(p.v,dt);p.mesh.rotation.x+=dt*4;if(p.life<=0){p.mesh.removeFromParent();particles.splice(i,1);}}
 }
 function clearEffects(){for(const p of particles)p.mesh.removeFromParent();for(const t of traces){t.mesh.removeFromParent();t.mesh.geometry.dispose();t.mesh.material.dispose();}particles.length=traces.length=0;state.lastHit=null;}
 function resetStats(){state.shots=0;state.kills=0;state.lastHit=null;}
 function aimSlowdown(camera=g.camera){const dir=new THREE.Vector3();camera.getWorldDirection(dir);for(const actor of actors){if(!actor.alive||actor.team===player.team)continue;const center=new THREE.Vector3(actor.x,actor.y+stanceDimensions(actor).aimHeight,actor.z),offset=center.clone().sub(camera.position);if(offset.length()<40&&offset.normalize().dot(dir)>.995&&!world.blocked(camera.position,center))return .65;}return 1;}
 return {state,get inventory(){return player.equipment;},particles,traces,equip,resetActor,select,reload,fire,update,clearEffects,burst,resetStats,aimSlowdown,actorHit,damage};
}
