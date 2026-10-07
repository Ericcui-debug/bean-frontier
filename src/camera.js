import {THREE} from './gfx.js';
import {clamp} from './physics.js';
import {WEAPONS} from './combat.js';
export function createCamera(g,world,player){
 const state={yaw:0,pitch:0,aim:false,scope:false,distance:0,avatarOpacity:0,wallDistance:1};
 g.scene.add(g.camera);g.camera.near=.045;
 const view=new THREE.Group();view.name='First-person bean arms';g.camera.add(view);view.scale.setScalar(.65);const meshes=[],owned=[];
 function box(x,y,z,w,h,d,color,parent=view){const geo=new THREE.BoxGeometry(w,h,d),mat=new THREE.MeshStandardMaterial({color,roughness:.5,depthTest:false,depthWrite:false});const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=false;mesh.receiveShadow=false;mesh.renderOrder=20;parent.add(mesh);meshes.push(mesh);owned.push(geo,mat);return mesh;}
 function arm(from,to){const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),axis=end.clone().sub(start),geo=new THREE.CapsuleGeometry(.09,Math.max(.1,axis.length()-.18),6,12),mat=new THREE.MeshStandardMaterial({color:player.color,roughness:.65,depthTest:false,depthWrite:false});const mesh=new THREE.Mesh(geo,mat);mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());mesh.renderOrder=20;view.add(mesh);meshes.push(mesh);owned.push(geo,mat);return mesh;}
 const rightArm=arm([.5,-.62,-.17],[.22,-.30,-.43]),leftArm=arm([-.3,-.6,-.24],[.17,-.22,-.67]),gun=new THREE.Group();view.add(gun);
 box(.19,-.2,-.53,.115,.13,.46,0xfff4da,gun);const colored=box(.19,-.15,-.62,.13,.07,.35,0xf455a6,gun);box(.19,-.29,-.41,.09,.19,.08,0x284c50,gun);const barrel=box(.19,-.19,-.85,.055,.055,.23,0xffd56e,gun);const scope=box(.19,-.07,-.63,.075,.08,.19,0x284c50,gun);scope.visible=false;
 const muzzle=new THREE.Object3D();muzzle.position.set(.19,-.19,-.98);gun.add(muzzle);g.camera.userData.muzzle=muzzle;
 let previousActor=null;
 function look(dx,dy){state.yaw+=dx;state.pitch=clamp(state.pitch+dy,-1.45,1.45);}
 function direction(){return new THREE.Vector3(Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),-Math.cos(state.yaw)*Math.cos(state.pitch));}
 function update(dt,actor=player){
  if(typeof actor==='boolean'){const lobby=actor;if(lobby){view.visible=false;g.camera.fov=60;g.camera.position.set(0,30,36);g.camera.lookAt(0,0,0);g.camera.updateProjectionMatrix();return;}actor=player;}
  if(previousActor&&previousActor!==actor&&previousActor!==player){previousActor.firstPersonHidden=false;previousActor.body.visible=previousActor.alive;}
  if(actor!==player){if(actor.aimTarget){const dx=actor.aimTarget.x-actor.x,dy=actor.aimTarget.y-(actor.y+1.62),dz=actor.aimTarget.z-actor.z;state.yaw=Math.atan2(dx,-dz);state.pitch=clamp(Math.atan2(dy,Math.hypot(dx,dz)),-1.45,1.45);}else{state.yaw=actor.yaw||0;state.pitch=actor.gunPitch||0;}}
  previousActor=actor;player.firstPersonHidden=true;player.body.visible=false;actor.firstPersonHidden=true;actor.body.visible=false;
  g.camera.position.set(actor.x,actor.y+1.62,actor.z);const dir=direction();g.camera.lookAt(g.camera.position.clone().add(dir));
  const item=actor.equipment?.[actor.slot||0],id=item?.id??0;state.scope=!!state.aim&&id===3;actor.aiming=!!state.aim;actor.gunPitch=state.pitch;
  const fov=state.scope?24:state.aim?52:72;g.camera.fov+=(fov-g.camera.fov)*(1-Math.exp(-Math.max(dt,1/120)*16));g.camera.updateProjectionMatrix();
  view.scale.setScalar(.65*clamp(g.camera.aspect/.9,.52,1));
  const near=world.blocked(g.camera.position,g.camera.position.clone().addScaledVector(dir,1.1),.035);state.wallDistance=near?near.t*1.1:1.1;
  const retract=clamp((.95-state.wallDistance)/.8,0,1);view.position.z=-.25+retract*.6;view.position.y=-.09-retract*.07;
  gun.position.z=(actor.recoil||0)*.05;gun.rotation.x=-(actor.recoil||0)*.035;gun.rotation.z=(actor.recoil||0)*.012;
  const centered=state.aim?.19:0;view.position.x=.05-centered*.65;colored.material.color.setHex(WEAPONS[id].color);barrel.scale.z=id===3?1.8:id===0?.55:1;scope.visible=id===3;
  view.visible=actor.alive&&!state.scope;rightArm.material.color.setHex(actor.color);leftArm.material.color.setHex(actor.color);g.camera.updateMatrixWorld(true);
 }
 function reset(){state.yaw=0;state.pitch=0;state.aim=false;state.scope=false;player.firstPersonHidden=true;player.avatarOpacity=0;}
 function dispose(){for(const resource of owned)resource.dispose();view.removeFromParent();}
 reset();return {state,look,direction,update,reset,view,muzzle,dispose};
}
