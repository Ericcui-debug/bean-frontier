import {THREE,C} from './gfx.js';
import {CHARACTER,stanceDimensions} from './dimensions.js';
import {createWeaponVisual} from './weapon-models.js';
// Original Bean Blitz proportions, scaled once at the visual body root.
export function createBean(g,color=C.pink){
 const group=new THREE.Group(),body=new THREE.Group();body.scale.setScalar(CHARACTER.scale);group.add(body);g.scene.add(group);
 const torso=g.mesh(new THREE.CapsuleGeometry(.53,.7,12,32),color,body);torso.position.y=1.05;
 g.ball(0,1.24,-.475,.35,.4,.092,C.cream,body);for(const x of [-.12,.12])g.ball(x,1.28,-.558,.047,.1,.024,C.dark,body);
 const arms=[];for(const s of [-1,1]){const joint=new THREE.Group();joint.position.set(s*.4,1.42,0);body.add(joint);const arm=g.mesh(new THREE.CapsuleGeometry(.145,.46,5,16),color,joint);arm.position.set(s*.08,-.34,0);joint.rotation.z=s*.3;arms.push(joint);}
 const feet=[-1,1].map(s=>g.ball(s*.26,.17,-.055,.225,.17,.31,color,body));
 const gunRig=new THREE.Group(),gun=new THREE.Group();body.add(gunRig);gunRig.add(gun);gun.position.set(.39,1.1,-.58);const fallbackGun=new THREE.Group();gun.add(fallbackGun);
 g.box(0,0,-.16,.22,.25,.64,C.cream,fallbackGun);g.box(0,.06,-.28,.26,.14,.48,C.blue,fallbackGun);g.box(0,-.17,.03,.13,.22,.12,C.dark,fallbackGun);const barrel=g.cylinder(0,.02,-.55,.08,.22,C.yellow,fallbackGun);barrel.rotation.x=Math.PI/2;
 const muzzle=new THREE.Object3D();muzzle.position.set(0,.02,-.7);gun.add(muzzle);
 const hat=g.cylinder(0,1.92,0,.34,.14,color===C.pink?C.yellow:C.cream,body);hat.visible=false;
 // Tactical details retain the small round bean silhouette. Only equipment
 // colors change with the side; the base team color remains easy to identify.
 const vest=new THREE.Group();body.add(vest);const vestPanels=[];
 vestPanels.push(g.ball(0,.99,-.435,.43,.31,.115,0x354c52,vest));
 for(const x of [-.25,0,.25])vestPanels.push(g.box(x,.93,-.548,.19,.18,.055,0x516366,vest));
 for(const x of [-.27,.27])vestPanels.push(g.box(x,1.22,-.44,.10,.28,.06,0x354c52,vest));
 g.box(0,.83,.455,.64,.13,.06,0x354c52,vest);
 const badge=g.box(.24,1.15,-.557,.12,.08,.028,0x95d2ea,vest);
 const health=new THREE.Group();health.position.y=CHARACTER.healthBar;health.scale.setScalar(CHARACTER.scale);group.add(health);const track=g.box(0,0,0,1.1,.095,.06,C.dark,health),fill=g.box(0,.003,.05,1.04,.065,.035,C.yellow,health);health.visible=false;
 for(const mesh of [track,fill]){mesh.material=new THREE.MeshBasicMaterial({color:mesh.material.color,depthTest:true,depthWrite:false});mesh.castShadow=false;mesh.receiveShadow=false;}
 // Scene materials are cached by color. Fade only this bean's private copies;
 // never make crates, enemies or paint effects transparent with the player.
 const copies=new Map(),displayMaterials=[];body.traverse(o=>{if(!o.isMesh)return;const shared=o.material;if(!copies.has(shared)){const copy=shared.clone();copies.set(shared,copy);displayMaterials.push(copy);}o.material=copies.get(shared);});
 const ownedGeometries=[torso.geometry,...arms.map(a=>a.children[0].geometry),barrel.geometry,hat.geometry];
 return {group,body,arms,feet,gunRig,gun,muzzle,hat,vest,vestPanels,badge,fallbackGun,weaponVisuals:new Map(),visualWeaponId:-1,visualFaction:null,health,healthFill:fill,displayMaterials,ownedGeometries,avatarOpacity:1,healthUntil:0,aiming:false,phase:0,recoil:0,color,x:0,y:0,z:0,vx:0,vy:0,vz:0,yaw:0,hp:100,maxHp:100,grounded:true,radius:CHARACTER.radius,height:CHARACTER.height,alive:true};
}
export function updateBeanWeapon(r){
 if(!r.weaponVisuals)return;r.vest.visible=!r.isHostage;if(r.isHostage){r.gun.visible=false;return;}const id=r.equipment?.[r.slot||0]?.id??0;
 if(!r.weaponVisuals.has(id)){const visual=createWeaponVisual(id);if(visual){r.weaponVisuals.set(id,visual);r.gun.add(visual.group);}}
 const current=r.weaponVisuals.get(id);for(const [other,visual] of r.weaponVisuals)visual.group.visible=other===id;
 r.fallbackGun.visible=!current;r.visualWeaponId=current?id:-1;
 if(current)r.muzzle.position.copy(current.muzzle.position);else r.muzzle.position.set(0,.02,-.7);
 const faction=r.faction==='CT'||r.faction==='T'?r.faction:r.role==='defend'?'CT':'T';if(r.visualFaction!==faction){const color=faction==='CT'?0x354c62:0x736148;r.vestPanels.forEach(m=>m.material.color.setHex(color));r.badge.material.color.setHex(faction==='CT'?0x95d2ea:0xf3c777);r.visualFaction=faction;}
}
export function poseBean(r,time,aim=false){
 const size=stanceDimensions(r);updateBeanWeapon(r);
 const speed=Math.hypot(r.vx,r.vz),running=speed>.2,cycle=time*speed*1.6,bob=running?Math.abs(Math.sin(cycle))*.06:Math.sin(time*2)*.025;
 r.group.position.set(r.x,r.y,r.z);r.group.rotation.y=-r.yaw;r.body.position.y=bob*CHARACTER.scale*size.verticalScale;r.body.rotation.z=running?Math.sin(cycle)*.025:0;r.body.rotation.x=0;r.body.scale.set(CHARACTER.scale,CHARACTER.scale*size.verticalScale,CHARACTER.scale);r.health.position.y=size.healthBar;r.aiming=aim;
 r.arms.forEach((a,i)=>{a.rotation.x=aim?1.35+(i?.12:0):running?Math.sin(cycle+i*Math.PI)*.55:.05;a.rotation.z=aim?(i?-.3:.18):(i?1:-1)*.3;});
 r.feet.forEach((f,i)=>{f.position.z=-.055+(running?Math.sin(cycle+i*Math.PI)*.22:0);f.position.y=.17-bob+(running?Math.max(0,Math.cos(cycle+i*Math.PI))*.12:0)+(r.grounded?0:.07);f.rotation.x=r.grounded?0:.2;});
 // Lower the bean in ducts while keeping a rigid gun's shape and pitch.
 r.gunRig?.scale.set(1,1/size.verticalScale,1);r.gun.position.y=1.1*size.verticalScale;r.gun.position.z=-.58+r.recoil*.11;r.gun.rotation.x=-(r.gunPitch||0)-r.recoil*.1;r.gun.scale.setScalar(1);
 r.healthFill.scale.x=Math.max(.001,r.hp/r.maxHp);r.healthFill.position.x=-(1-r.hp/r.maxHp)*.52;
}
const displayPoint=new THREE.Vector3(),barPoint=new THREE.Vector3(),inverseParent=new THREE.Quaternion(),armDirection=new THREE.Vector3(),armDown=new THREE.Vector3(0,-1,0);
export function disposeBean(r){for(const visual of r.weaponVisuals?.values()??[])visual.dispose();for(const geo of r.ownedGeometries)geo.dispose();for(const m of r.displayMaterials)m.dispose();r.health.traverse(o=>{if(o.isMesh)o.material.dispose();});r.group.removeFromParent();}
export function updateBeanDisplay(r,camera,world,time,isPlayer=false){
 const opacity=(isPlayer||r.firstPersonHidden)?0:1;r.body.visible=!!r.alive&&opacity>.015;
 for(const m of r.displayMaterials){if(opacity<.999&&!m.transparent){m.transparent=true;m.needsUpdate=true;}m.opacity=opacity;m.depthWrite=opacity>.5;}
 // Hands follow the actual pitched gun, including recoil, rather than leaving
 // rigid horizontal arms behind when aiming far above or below the bean.
 r.group.updateMatrixWorld(true);
 if(r.aiming){for(let i=0;i<r.arms.length;i++){armDirection.set(i===0?-.04:0,i===0?-.015:-.17,i===0?-.19:.035);r.gun.localToWorld(armDirection);r.body.worldToLocal(armDirection);armDirection.sub(r.arms[i].position).normalize();r.arms[i].quaternion.setFromUnitVectors(armDown,armDirection);}}
 r.group.updateMatrixWorld(true);
 r.health.visible=false;
 if(isPlayer||!r.alive||r.hp>=r.maxHp||time>=(r.healthUntil??0))return;
 displayPoint.set(r.x,r.y+stanceDimensions(r).healthTarget,r.z);r.health.getWorldPosition(barPoint);
 const blocked=world.cameraBlocked??world.blocked;
 if(blocked(camera.position,displayPoint,.02)||blocked(camera.position,barPoint,.02))return;
 r.group.getWorldQuaternion(inverseParent).invert();r.health.quaternion.copy(inverseParent.multiply(camera.quaternion));r.health.visible=true;
}
