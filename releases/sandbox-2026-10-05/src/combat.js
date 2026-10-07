import {THREE,C} from './gfx.js';
import {segmentSphere,clamp} from './physics.js';
export const WEAPONS=[
 {name:'彩弹连射枪',mag:24,reserve:144,interval:.14,reload:1.05,speed:80,damage:18,color:C.pink,radius:.12,spread:.008,pellets:1},
 {name:'泡泡散射枪',mag:8,reserve:48,interval:.65,reload:1.45,speed:64,damage:13,color:C.blue,radius:.13,spread:.085,pellets:7},
 {name:'糖果炮',mag:4,reserve:20,interval:.95,reload:1.75,speed:38,damage:65,color:C.yellow,radius:.23,spread:0,pellets:1,explosive:true}
];
export function createCombat({g,world,player,enemies,getTime,onEnemyDown,onHit,onPlayerHurt,notify}){
 const bullets=[],particles=[],inventory=WEAPONS.map((w,i)=>({unlocked:i===0,ammo:w.mag,reserve:w.reserve}));const state={weapon:0,cooldown:0,reloading:0,shots:0,kills:0};
 let updating=false,pendingClear=false;
 const sphere=new THREE.SphereGeometry(1,7,6),particleGeo=new THREE.BoxGeometry(1,1,1);
 function burst(pos,color,count=14){for(let i=0;i<count&&particles.length<140;i++){const mesh=new THREE.Mesh(particleGeo,g.mat(color));mesh.position.copy(pos);mesh.scale.setScalar(.09+Math.random()*.14);g.scene.add(mesh);particles.push({mesh,v:new THREE.Vector3((Math.random()-.5)*7,2+Math.random()*4,(Math.random()-.5)*7),life:.45+Math.random()*.4});}}
 function hurt(r,damage,source){if(!r.alive||r===player&&r.invuln>0)return;const actual=Math.max(0,damage);r.hp=Math.max(0,r.hp-actual);if(source){const d=new THREE.Vector3(r.x-source.x,0,r.z-source.z).normalize();r.kx=(r.kx||0)+d.x*2;r.kz=(r.kz||0)+d.z*2;}if(r===player){onPlayerHurt();return;}
  r.healthUntil=getTime()+1.6;if(r.hp<=0){r.alive=false;r.group.visible=false;state.kills++;burst(new THREE.Vector3(r.x,r.y+1,r.z),r.color,24);onEnemyDown(r);}onHit(r.hp<=0);
 }
 function destroy(s,damage,source){if(!s.breakable||!s.active)return;s.hp-=damage;if(s.hp>0)return;s.active=false;s.group.visible=false;if(s.label)s.label.visible=false;const pos=new THREE.Vector3((s.x0+s.x1)/2,s.y0+.7,(s.z0+s.z1)/2);burst(pos,s.type==='barrel'?C.yellow:C.orange,20);if(s.type==='barrel')explode(pos,5,75,source,'barrel');else{player.hp=Math.min(100,player.hp+15);for(const item of inventory)if(item.unlocked)item.reserve=Math.min(WEAPONS[inventory.indexOf(item)].reserve,item.reserve+24);notify('补给箱打开 · 生命与弹药补充');}world.rebuildNav();}
 function explode(pos,radius,damage,owner,reason='cannon'){
  burst(pos,C.yellow,28);const actors=[...enemies,player];for(const r of actors){if(!r.alive||r===owner&&reason!=='barrel')continue;const center=new THREE.Vector3(r.x,r.y+1,r.z),distance=center.distanceTo(pos);if(distance>radius)continue;const origin=pos.clone().lerp(center,.02);if(world.blocked(origin,center))continue;hurt(r,damage*(1-distance/radius*.65),pos);}
  for(const s of world.props){if(!s.active)continue;const center=new THREE.Vector3((s.x0+s.x1)/2,s.y0+.6,(s.z0+s.z1)/2);if(center.distanceTo(pos)>radius)continue;const hit=world.blocked(pos.clone().lerp(center,.025),center);if(!hit||hit.solid===s)destroy(s,damage,owner);}
 }
 function projectile(owner,pos,dir,w){if(bullets.length>=110){const old=bullets.shift();g.scene.remove(old.mesh);}const mesh=new THREE.Mesh(sphere,g.mat(w.color));mesh.scale.setScalar(w.radius);mesh.position.copy(pos);g.scene.add(mesh);bullets.push({mesh,pos:pos.clone(),velocity:dir.clone().multiplyScalar(w.speed),owner,w,life:w.explosive?3:1.7});}
 function reload(){const slot=inventory[state.weapon],w=WEAPONS[state.weapon];if(state.reloading||slot.ammo>=w.mag||slot.reserve<=0)return;state.reloading=w.reload;}
 function select(index){if(!inventory[index]?.unlocked){notify('探索岛屿，寻找这件武器');return false;}state.weapon=index;state.reloading=0;state.cooldown=Math.max(state.cooldown,.12);player.gun.children[1].material.color.setHex(WEAPONS[index].color);return true;}
 function aimPoint(camera,mobile){const a=camera.position.clone(),dir=new THREE.Vector3();camera.getWorldDirection(dir);const b=a.clone().addScaledVector(dir,100),wall=world.blocked(a,b);let best=wall?wall.t:1,point=a.clone().lerp(b,best);
  for(const r of enemies){if(!r.alive)continue;const center=new THREE.Vector3(r.x,r.y+1,r.z),t=segmentSphere(a,b,center,.72);if(t!==null&&t<best){best=t;point.copy(a.clone().lerp(b,t));}}
  if(mobile){let score=.993;for(const r of enemies){if(!r.alive)continue;const center=new THREE.Vector3(r.x,r.y+1.12,r.z),v=center.clone().sub(a),distance=v.length(),dot=v.normalize().dot(dir);if(distance<35&&dot>score&&!world.blocked(a,center)){score=dot;point.copy(center);}}}return point;
 }
 function fire(camera,mobile=false){const slot=inventory[state.weapon],w=WEAPONS[state.weapon];if(state.reloading||state.cooldown>0)return false;if(slot.ammo<=0){reload();return false;}slot.ammo--;state.cooldown=w.interval;state.shots++;player.recoil=1;
  player.group.updateMatrixWorld(true);const muzzle=new THREE.Vector3();player.muzzle.getWorldPosition(muzzle);const center=new THREE.Vector3(player.x,player.y+1.15,player.z);const nearWall=world.blocked(center,muzzle,w.radius);const target=aimPoint(camera,mobile),dir=target.clone().sub(muzzle).normalize();
  if(nearWall){burst(center.clone().lerp(muzzle,nearWall.t),w.color,5);destroy(nearWall.solid,w.damage,player);if(w.explosive)explode(center.clone().lerp(muzzle,nearWall.t),4.5,w.damage,player);return true;}
  for(let i=0;i<w.pellets;i++){const v=dir.clone().add(new THREE.Vector3((Math.random()-.5)*w.spread,(Math.random()-.5)*w.spread,(Math.random()-.5)*w.spread)).normalize();projectile(player,muzzle,v,w);}return true;
 }
 function enemyFire(r,observed=null){
  if(!player.alive||player.invuln>0)return false;
  const seen=observed||{x:player.x,y:player.y,z:player.z,vx:0,vz:0};
  const body=new THREE.Vector3(r.x,r.y+1.2,r.z),target=new THREE.Vector3(seen.x,seen.y+1.05,seen.z),distance=target.distanceTo(body);
  if(distance>20.15||world.blocked(body,target))return false;
  // Prediction uses only the latest visible observation, with capped lead and aim error.
  const lead=Math.min(.35,distance/28*.58),vx=Number.isFinite(seen.vx)?clamp(seen.vx,-9,9):0,vz=Number.isFinite(seen.vz)?clamp(seen.vz,-9,9):0;
  target.x+=vx*lead;target.z+=vz*lead;
  const error=Math.min(.45,.08+distance*.017),phase=getTime()*2.9+r.id*2.31;
  target.x+=Math.sin(phase)*error;target.z+=Math.cos(phase*.83)*error;target.y+=Math.sin(phase*1.37)*error*.38;
  r.group.updateMatrixWorld(true);const pos=new THREE.Vector3();r.muzzle.getWorldPosition(pos);
  // Both body-to-muzzle and muzzle-to-aim must be clear: no barrel sticking through cover.
  if(world.blocked(body,pos,.16)||world.blocked(pos,target,.16))return false;
  const dir=target.sub(pos).normalize();if(!Number.isFinite(dir.x+dir.y+dir.z))return false;
  projectile(r,pos,dir,{speed:28,damage:8,color:C.orange,radius:.16,explosive:false});return true;
 }
 function update(dt){updating=true;state.cooldown=Math.max(0,state.cooldown-dt);if(state.reloading>0){state.reloading=Math.max(0,state.reloading-dt);if(!state.reloading){const slot=inventory[state.weapon],need=Math.min(WEAPONS[state.weapon].mag-slot.ammo,slot.reserve);slot.ammo+=need;slot.reserve-=need;}}
  for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];if(!b)continue;const next=b.pos.clone().addScaledVector(b.velocity,dt);let best=1,hit=null;const wall=world.blocked(b.pos,next,b.w.radius);if(wall){best=wall.t;hit={kind:'wall',obj:wall.solid};}
   const actors=b.owner===player?enemies:[player];for(const r of actors){if(!r.alive)continue;const t=segmentSphere(b.pos,next,new THREE.Vector3(r.x,r.y+1,r.z),r===player?.75:.77);if(t!==null&&t<best){best=t;hit={kind:'actor',obj:r};}}
   if(b.owner===player)for(const t of world.targets){if(!t.active)continue;const v=segmentSphere(b.pos,next,t,t.r+b.w.radius);if(v!==null&&v<best){best=v;hit={kind:'target',obj:t};}}
   // Ground and slope contacts are swept at small fixed steps, including cannon drops.
   const floor=world.groundAt(next.x,next.z);if(floor!==null&&next.y-b.w.radius<=floor&&!hit){const oldFloor=world.groundAt(b.pos.x,b.pos.z)??floor;const den=(b.pos.y-oldFloor)-(next.y-floor);best=clamp(den?((b.pos.y-oldFloor-b.w.radius)/den):0,0,1);hit={kind:'ground'};}
   b.life-=dt;if(hit){const point=b.pos.clone().lerp(next,best);if(b.w.explosive)explode(point,5,b.w.damage,b.owner);else if(hit.kind==='actor')hurt(hit.obj,b.w.damage,point);else if(hit.kind==='wall')destroy(hit.obj,b.w.damage,b.owner);if(hit.kind==='target'){hit.obj.active=false;hit.obj.group.visible=false;onHit(false);}burst(point,b.w.color,5);b.life=0;}
   if(b.life<=0){g.scene.remove(b.mesh);bullets.splice(i,1);}else{b.pos.copy(next);b.mesh.position.copy(next);if(b.w.explosive)b.velocity.y-=9*dt;}
  }
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.v.y-=12*dt;p.mesh.position.addScaledVector(p.v,dt);p.mesh.rotation.x+=dt*5;p.mesh.rotation.y+=dt*3;if(p.life<=0){g.scene.remove(p.mesh);particles.splice(i,1);}}
  updating=false;if(pendingClear){pendingClear=false;clearEffects();}
 }
 function clearEffects(){if(updating){pendingClear=true;return;}for(const b of bullets)g.scene.remove(b.mesh);for(const p of particles)g.scene.remove(p.mesh);bullets.length=particles.length=0;}
 function reset(){clearEffects();inventory.forEach((s,i)=>Object.assign(s,{unlocked:i===0,ammo:WEAPONS[i].mag,reserve:WEAPONS[i].reserve}));Object.assign(state,{weapon:0,cooldown:0,reloading:0,shots:0,kills:0});player.gun.children[1].material.color.setHex(C.blue);}
 return {state,inventory,bullets,particles,fire,reload,select,enemyFire,hurt,destroy,explode,burst,update,reset,clearEffects,aimPoint};
}
