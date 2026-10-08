import {THREE,C} from './gfx.js';
import {CHARACTER} from './dimensions.js';
// Original Bean Blitz proportions, scaled once at the visual body root.
export function createBean(g,color=C.pink){
 const group=new THREE.Group(),body=new THREE.Group();body.scale.setScalar(CHARACTER.scale);group.add(body);g.scene.add(group);
 const torso=g.mesh(new THREE.CapsuleGeometry(.53,.7,12,32),color,body);torso.position.y=1.05;
 g.ball(0,1.24,-.475,.35,.4,.092,C.cream,body);for(const x of [-.12,.12])g.ball(x,1.28,-.558,.047,.1,.024,C.dark,body);
 const arms=[];for(const s of [-1,1]){const joint=new THREE.Group();joint.position.set(s*.4,1.42,0);body.add(joint);const arm=g.mesh(new THREE.CapsuleGeometry(.145,.46,5,16),color,joint);arm.position.set(s*.08,-.34,0);joint.rotation.z=s*.3;arms.push(joint);}
 const feet=[-1,1].map(s=>g.ball(s*.26,.17,-.055,.225,.17,.31,color,body));
 const gun=new THREE.Group();gun.position.set(.39,1.1,-.58);body.add(gun);
 g.box(0,0,-.16,.22,.25,.64,C.cream,gun);g.box(0,.06,-.28,.26,.14,.48,C.blue,gun);g.box(0,-.17,.03,.13,.22,.12,C.dark,gun);const barrel=g.cylinder(0,.02,-.55,.08,.22,C.yellow,gun);barrel.rotation.x=Math.PI/2;
 const muzzle=new THREE.Object3D();muzzle.position.set(0,.02,-.7);gun.add(muzzle);
 const hat=g.cylinder(0,1.92,0,.34,.14,color===C.pink?C.yellow:C.cream,body);hat.visible=color!==C.pink;
 const health=new THREE.Group();health.position.y=CHARACTER.healthBar;health.scale.setScalar(CHARACTER.scale);group.add(health);const track=g.box(0,0,0,1.1,.095,.06,C.dark,health),fill=g.box(0,.003,.05,1.04,.065,.035,C.yellow,health);health.visible=false;
 for(const mesh of [track,fill]){mesh.material=new THREE.MeshBasicMaterial({color:mesh.material.color,depthTest:true,depthWrite:false});mesh.castShadow=false;mesh.receiveShadow=false;}
 // Scene materials are cached by color. Fade only this bean's private copies;
 // never make crates, enemies or paint effects transparent with the player.
 const copies=new Map(),displayMaterials=[];body.traverse(o=>{if(!o.isMesh)return;const shared=o.material;if(!copies.has(shared)){const copy=shared.clone();copies.set(shared,copy);displayMaterials.push(copy);}o.material=copies.get(shared);});
 const ownedGeometries=[torso.geometry,...arms.map(a=>a.children[0].geometry),barrel.geometry,hat.geometry];
 return {group,body,arms,feet,gun,muzzle,hat,health,healthFill:fill,displayMaterials,ownedGeometries,avatarOpacity:1,healthUntil:0,aiming:false,phase:0,recoil:0,color,x:0,y:0,z:0,vx:0,vy:0,vz:0,yaw:0,hp:100,maxHp:100,grounded:true,radius:CHARACTER.radius,height:CHARACTER.height,alive:true};
}
export function poseBean(r,time,aim=false){
 const speed=Math.hypot(r.vx,r.vz),running=speed>.2,cycle=time*speed*1.6,bob=running?Math.abs(Math.sin(cycle))*.06:Math.sin(time*2)*.025;
 r.group.position.set(r.x,r.y,r.z);r.group.rotation.y=-r.yaw;r.body.position.y=bob*CHARACTER.scale;r.body.rotation.z=running?Math.sin(cycle)*.025:0;r.body.rotation.x=0;r.body.scale.setScalar(CHARACTER.scale);r.aiming=aim;
 r.arms.forEach((a,i)=>{a.rotation.x=aim?1.35+(i?.12:0):running?Math.sin(cycle+i*Math.PI)*.55:.05;a.rotation.z=aim?(i?-.3:.18):(i?1:-1)*.3;});
 r.feet.forEach((f,i)=>{f.position.z=-.055+(running?Math.sin(cycle+i*Math.PI)*.22:0);f.position.y=.17-bob+(running?Math.max(0,Math.cos(cycle+i*Math.PI))*.12:0)+(r.grounded?0:.07);f.rotation.x=r.grounded?0:.2;});
 r.gun.position.z=-.58+r.recoil*.11;r.gun.rotation.x=-(r.gunPitch||0)-r.recoil*.1;r.gun.scale.setScalar(1);
 r.healthFill.scale.x=Math.max(.001,r.hp/r.maxHp);r.healthFill.position.x=-(1-r.hp/r.maxHp)*.52;
}
const displayPoint=new THREE.Vector3(),barPoint=new THREE.Vector3(),inverseParent=new THREE.Quaternion(),armDirection=new THREE.Vector3(),armDown=new THREE.Vector3(0,-1,0);
export function disposeBean(r){for(const geo of r.ownedGeometries)geo.dispose();for(const m of r.displayMaterials)m.dispose();r.health.traverse(o=>{if(o.isMesh)o.material.dispose();});r.group.removeFromParent();}
export function updateBeanDisplay(r,camera,world,time,isPlayer=false){
 const opacity=(isPlayer||r.firstPersonHidden)?0:1;r.body.visible=!!r.alive&&opacity>.015;
 for(const m of r.displayMaterials){if(opacity<.999&&!m.transparent){m.transparent=true;m.needsUpdate=true;}m.opacity=opacity;m.depthWrite=opacity>.5;}
 // Hands follow the actual pitched gun, including recoil, rather than leaving
 // rigid horizontal arms behind when aiming far above or below the bean.
 if(r.aiming){for(let i=0;i<r.arms.length;i++){armDirection.set(i===0?-.04:0,i===0?-.015:-.17,i===0?-.19:.035).applyQuaternion(r.gun.quaternion).add(r.gun.position).sub(r.arms[i].position).normalize();r.arms[i].quaternion.setFromUnitVectors(armDown,armDirection);}}
 r.group.updateMatrixWorld(true);
 r.health.visible=false;
 if(isPlayer||!r.alive||r.hp>=r.maxHp||time>=(r.healthUntil??0))return;
 displayPoint.set(r.x,r.y+CHARACTER.healthTarget,r.z);r.health.getWorldPosition(barPoint);
 const blocked=world.cameraBlocked??world.blocked;
 if(blocked(camera.position,displayPoint,.02)||blocked(camera.position,barPoint,.02))return;
 r.group.getWorldQuaternion(inverseParent).invert();r.health.quaternion.copy(inverseParent.multiply(camera.quaternion));r.health.visible=true;
}
