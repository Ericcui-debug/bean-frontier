import {THREE} from './gfx.js';
import {clamp} from './physics.js';
import {WEAPONS} from './combat.js';
import {CHARACTER,stanceDimensions} from './dimensions.js';
import {createWeaponVisual} from './weapon-models.js';
import {aimAngles} from './recoil.js';
export function createCamera(g,world,player){
 const state={yaw:0,pitch:0,aim:false,scope:false,distance:0,avatarOpacity:0,wallDistance:1};
 g.scene.add(g.camera);g.camera.near=.045;
 const view=new THREE.Group();view.name='First-person bean arms';g.camera.add(view);view.scale.setScalar(CHARACTER.viewScale);const meshes=[],owned=[];
 function box(x,y,z,w,h,d,color,parent=view){const geo=new THREE.BoxGeometry(w,h,d),mat=new THREE.MeshStandardMaterial({color,roughness:.5,depthTest:false,depthWrite:false});const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=20;parent.add(mesh);meshes.push(mesh);owned.push(geo,mat);return mesh;}
 function arm(from,to){const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),axis=end.clone().sub(start),geo=new THREE.CapsuleGeometry(.078,Math.max(.1,axis.length()-.156),6,12),mat=new THREE.MeshStandardMaterial({color:0x354c62,roughness:.85,depthTest:false,depthWrite:false});const mesh=new THREE.Mesh(geo,mat);mesh.userData.armStart=start.clone();mesh.userData.armEnd=end.clone();mesh.userData.armLength=axis.length();mesh.position.copy(start.clone().add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());mesh.renderOrder=20;view.add(mesh);meshes.push(mesh);owned.push(geo,mat);return mesh;}
 const rightArm=arm([.49,-.68,-.18],[.22,-.32,-.43]),leftArm=arm([-.29,-.66,-.25],[.17,-.25,-.67]),gun=new THREE.Group();view.add(gun);const fallbackGun=new THREE.Group(),weaponVisuals=new Map();gun.add(fallbackGun);
 const gloves=[box(.22,-.30,-.43,.115,.12,.14,0x253239),box(.17,-.22,-.67,.115,.11,.14,0x253239)];
 box(.22,-.325,-.40,.13,.06,.07,0x52636a);box(.17,-.25,-.64,.13,.05,.07,0x52636a);
 box(.19,-.2,-.53,.115,.13,.46,0xfff4da,fallbackGun);const colored=box(.19,-.15,-.62,.13,.07,.35,0xf455a6,fallbackGun);box(.19,-.29,-.41,.09,.19,.08,0x284c50,fallbackGun);const barrel=box(.19,-.19,-.85,.055,.055,.23,0xffd56e,fallbackGun);const scope=box(.19,-.07,-.63,.075,.08,.19,0x284c50,fallbackGun);scope.visible=false;
 const muzzle=new THREE.Object3D();muzzle.position.set(.19,-.19,-.98);gun.add(muzzle);g.camera.userData.muzzle=muzzle;
 let previousActor=null;
 function showWeapon(id){if(!weaponVisuals.has(id)){const visual=createWeaponVisual(id,{firstPerson:true});if(visual){visual.group.position.set(.19,-.23,-.34);gun.add(visual.group);weaponVisuals.set(id,visual);}}const selected=weaponVisuals.get(id);for(const [other,visual] of weaponVisuals)visual.group.visible=other===id;fallbackGun.visible=!selected;if(selected)muzzle.position.copy(selected.muzzle.position).add(selected.group.position);else muzzle.position.set(.19,-.19,-.98);view.userData.weaponId=id;view.userData.weaponModel=selected?.group.name??'offline loading placeholder';}
 function look(dx,dy){state.yaw+=dx;state.pitch=clamp(state.pitch+dy,-1.45,1.45);}
 function direction(actor=player){const aim=aimAngles(actor,state.yaw,state.pitch);return new THREE.Vector3(Math.sin(aim.yaw)*Math.cos(aim.pitch),Math.sin(aim.pitch),-Math.cos(aim.yaw)*Math.cos(aim.pitch));}
 function update(dt,actor=player){
  if(typeof actor==='boolean'){const lobby=actor;if(lobby){const bounds=world.bounds??{x0:-28,x1:28,z0:-25,z1:25},cx=(bounds.x0+bounds.x1)/2,cz=(bounds.z0+bounds.z1)/2,span=Math.max((bounds.x1-bounds.x0)/Math.max(.35,g.camera.aspect),bounds.z1-bounds.z0);view.visible=false;g.camera.fov=60;g.camera.position.set(cx,span*.68,cz+span*.58);g.camera.lookAt(cx,0,cz);g.camera.updateProjectionMatrix();return;}actor=player;}
  if(previousActor&&previousActor!==actor&&previousActor!==player){previousActor.firstPersonHidden=false;previousActor.body.visible=previousActor.alive;}
  const dimensions=stanceDimensions(actor);
  if(actor!==player){state.yaw=actor.yaw||0;state.pitch=actor.pitch??-(actor.gunPitch||0);}
  previousActor=actor;player.firstPersonHidden=true;player.body.visible=false;actor.firstPersonHidden=true;actor.body.visible=false;
  g.camera.position.set(actor.x,actor.y+dimensions.eye,actor.z);const dir=direction(actor);const rendered=aimAngles(actor,state.yaw,state.pitch);state.renderedYaw=rendered.yaw;state.renderedPitch=rendered.pitch;g.camera.userData.recoilApplied=true;g.camera.lookAt(g.camera.position.clone().add(dir));
  const item=actor.equipment?.[actor.slot||0],id=item?.id??0;showWeapon(id);state.scope=!!state.aim&&id===3;if(actor===player){actor.aiming=!!state.aim;actor.gunPitch=-state.pitch;}
  const fov=state.scope?24:state.aim?52:72;g.camera.fov+=(fov-g.camera.fov)*(1-Math.exp(-Math.max(dt,1/120)*16));g.camera.updateProjectionMatrix();
  view.scale.setScalar(CHARACTER.viewScale*clamp(g.camera.aspect/.9,.52,1));
  const portrait=1-clamp((g.camera.aspect-.45)/.45,0,1);for(const [i,arm] of [rightArm,leftArm].entries()){const start=arm.userData.armStart.clone().lerp(new THREE.Vector3(i===0?.58:-.45,-1.02,i===0?-.16:-.21),portrait),end=arm.userData.armEnd,axis=end.clone().sub(start);arm.userData.currentStart=start;arm.scale.y=axis.length()/arm.userData.armLength;arm.scale.x=arm.scale.z=1-portrait*(state.aim?.55:.4);arm.position.copy(start).add(end).multiplyScalar(.5);arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());}
  const near=world.blocked(g.camera.position,g.camera.position.clone().addScaledVector(dir,1.1),.035);state.wallDistance=near?near.t*1.1:1.1;
  const retract=clamp((.95-state.wallDistance)/.8,0,1);view.position.z=-.25-portrait*.12+retract*.6;view.position.y=-.09-portrait*.04-retract*.07;
  gun.position.z=(actor.recoil||0)*.05;gun.rotation.x=(actor.recoil||0)*.025;gun.rotation.z=(actor.recoil||0)*.012;
  view.position.x=state.aim?-muzzle.position.x*view.scale.x:.05-portrait*.065;if(state.aim)view.position.y=-muzzle.position.y*view.scale.y-retract*.2;colored.material.color.setHex(WEAPONS[id].color);barrel.scale.z=id===3?1.8:id===0?.55:1;scope.visible=id===3;
  view.visible=actor.alive&&!state.scope;const uniform=actor.faction==='CT'?0x354c62:0x736148;rightArm.material.color.setHex(uniform);leftArm.material.color.setHex(uniform);g.camera.updateMatrixWorld(true);
 }
 function reset(){state.yaw=0;state.pitch=0;state.aim=false;state.scope=false;state.renderedYaw=0;state.renderedPitch=0;player.firstPersonHidden=true;player.avatarOpacity=0;}
 function dispose(){for(const visual of weaponVisuals.values())visual.dispose();for(const resource of owned)resource.dispose();view.removeFromParent();}
 reset();return {state,look,direction,update,reset,view,muzzle,dispose};
}
