import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WEAPON_GLB_BASE64} from './assets/tinystrike-inline.js';
export const WEAPON_VISUALS=Object.freeze([
 Object.freeze({id:0,key:'glock',name:'Glock',scale:2.35}),
 Object.freeze({id:1,key:'mp5',name:'MP5',scale:1.24}),
 Object.freeze({id:2,key:'ak47',name:'AK47',scale:.86}),
 Object.freeze({id:3,key:'awp',name:'AWP',scale:.8})
]);
const templates=new Map();let ready=null;
function decodeBase64(value){const text=atob(value),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);return bytes.buffer;}
export function loadVisualAssets(){if(!ready){const loader=new GLTFLoader();ready=Promise.all(WEAPON_VISUALS.map(def=>new Promise((resolve,reject)=>loader.parse(decodeBase64(WEAPON_GLB_BASE64[def.key]),'',gltf=>{gltf.scene.name='TinyStrike '+def.name;gltf.scene.traverse(mesh=>{if(!mesh.isMesh)return;mesh.castShadow=false;mesh.receiveShadow=false;});templates.set(def.id,gltf.scene);resolve();},reject))));}return ready;}
export function visualAssetsReady(){return templates.size===4;}
// Geometry remains shared between all beans. Clone only instance materials
// so first-person depth settings cannot affect world-space guns.
export function createWeaponVisual(id=0,{firstPerson=false}={}){
 const def=WEAPON_VISUALS[id]??WEAPON_VISUALS[0],template=templates.get(def.id);if(!template)return null;
 const group=new THREE.Group(),model=template.clone(true),materials=[];group.name=def.name+' '+(firstPerson?'viewmodel':'world');group.userData.weaponId=def.id;
 model.scale.setScalar(def.scale);model.position.set(0,-.08,-.15);group.add(model);
 model.traverse(mesh=>{if(!mesh.isMesh)return;mesh.material=mesh.material.clone();mesh.material.roughness=Math.max(.4,mesh.material.roughness??.6);mesh.material.depthTest=!firstPerson;mesh.material.depthWrite=!firstPerson;mesh.renderOrder=firstPerson?20:0;mesh.castShadow=!firstPerson;mesh.receiveShadow=!firstPerson;materials.push(mesh.material);});
 const source=model.getObjectByName('Muzzle');if(!source)throw new Error(def.name+' lacks licensed muzzle anchor');
 const muzzle=new THREE.Object3D();muzzle.name='Actual '+def.name+' muzzle';model.updateMatrixWorld(true);const p=source.getWorldPosition(new THREE.Vector3());group.worldToLocal(p);muzzle.position.copy(p);group.add(muzzle);
 return {group,model,muzzle,id:def.id,materials,dispose(){for(const m of materials)m.dispose();group.removeFromParent();}};
}
