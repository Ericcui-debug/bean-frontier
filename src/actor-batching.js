import * as THREE from 'three';

// Colors become instance attributes. Everything else affecting shading stays
// in the bucket key, so independent faction/uniform edits remain independent.
export function actorMaterialKey(material){
 return [material.type,material.map?.uuid,material.normalMap?.uuid,material.roughnessMap?.uuid,material.metalnessMap?.uuid,material.aoMap?.uuid,material.roughness,material.metalness,material.side,material.alphaTest,material.depthTest,material.depthWrite,material.emissive?.getHex(),material.emissiveIntensity,material.vertexColors].join(':');
}
function visibleParents(mesh){for(let node=mesh.parent;node;node=node.parent)if(!node.visible)return false;return true;}
function contactMaterial(){
 let map=null;
 if(typeof document!=='undefined'){const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const context=canvas.getContext('2d');if(context){const gradient=context.createRadialGradient(32,32,3,32,32,31);gradient.addColorStop(0,'rgba(255,255,255,.8)');gradient.addColorStop(.45,'rgba(255,255,255,.55)');gradient.addColorStop(1,'rgba(255,255,255,0)');context.fillStyle=gradient;context.fillRect(0,0,64,64);map=new THREE.CanvasTexture(canvas);}}
 return new THREE.MeshBasicMaterial({color:0x172d34,map,transparent:true,opacity:.22,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
}
export function createActorBatcher(scene){
 const actors=new Set(),buckets=new Map(),matrix=new THREE.Matrix4(),color=new THREE.Color(),shadowMatrix=new THREE.Matrix4(),shadowRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),shadowScale=new THREE.Vector3(),position=new THREE.Vector3();
 let shadows=null,contactShadows=false;
 function bucketFor(source){
  const key=source.geometry.uuid+':'+actorMaterialKey(source.material)+':'+source.castShadow+':'+source.receiveShadow;
  if(!buckets.has(key)){const material=source.material.clone();material.color.setHex(0xffffff);material.transparent=false;material.opacity=1;buckets.set(key,{material,geometry:source.geometry,castShadow:source.castShadow,receiveShadow:source.receiveShadow,mesh:null,capacity:0,entries:[]});}
  return buckets.get(key);
 }
 function resize(bucket,size){
  if(bucket.capacity>=size)return;
  bucket.mesh?.removeFromParent();bucket.mesh?.dispose();bucket.capacity=2**Math.ceil(Math.log2(Math.max(16,size)));
  bucket.mesh=new THREE.InstancedMesh(bucket.geometry,bucket.material,bucket.capacity);bucket.mesh.name='bean-part-batch';bucket.mesh.castShadow=bucket.castShadow;bucket.mesh.receiveShadow=bucket.receiveShadow;bucket.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(bucket.mesh);
 }
 function register(actor){actors.add(actor);return actor;}
 function unregister(actor){actors.delete(actor);actor.body?.traverse(mesh=>{if(mesh.userData?.actorBatchHidden){mesh.visible=true;delete mesh.userData.actorBatchHidden;}});}
 function update(){
  for(const bucket of buckets.values())bucket.entries.length=0;
  for(const actor of actors){
   actor.group.updateMatrixWorld(true);
   actor.body.traverse(source=>{
    if(!source.isMesh||source.isSkinnedMesh||source.isInstancedMesh||Array.isArray(source.material)||source.material.transparent&&source.material.opacity<.999)return;
    // Deliberately hidden hats stay hidden. Weapon selection is on parent
    // groups, and is checked afresh without modifying the game hierarchy.
    if(!source.visible&&!source.userData.actorBatchHidden)return;
    source.userData.actorBatchHidden=true;source.visible=false;
    if(!actor.alive||!actor.body.visible||!visibleParents(source,actor.body))return;
    bucketFor(source).entries.push(source);
   });
  }
  for(const bucket of buckets.values()){
   const count=bucket.entries.length;if(!count){if(bucket.mesh)bucket.mesh.count=0;continue;}resize(bucket,count);bucket.mesh.count=count;
   bucket.entries.forEach((source,index)=>{matrix.copy(source.matrixWorld);bucket.mesh.setMatrixAt(index,matrix);color.copy(source.material.color);bucket.mesh.setColorAt(index,color);});
   bucket.mesh.instanceMatrix.needsUpdate=true;if(bucket.mesh.instanceColor)bucket.mesh.instanceColor.needsUpdate=true;bucket.mesh.computeBoundingSphere();
  }
  updateShadows();
 }
 function updateShadows(){
  if(!contactShadows){if(shadows)shadows.count=0;return;}
  const visible=[...actors].filter(actor=>actor.alive&&actor.body.visible&&actor.group.visible&&actor.grounded!==false);
  if(!shadows||shadows.instanceMatrix.count<Math.max(1,visible.length)){
   const old=shadows;old?.removeFromParent();old?.dispose();
   const geometry=old?.geometry??new THREE.CircleGeometry(1,20),material=old?.material??contactMaterial();
   shadows=new THREE.InstancedMesh(geometry,material,Math.max(16,visible.length));shadows.name='bean-contact-shadows';shadows.renderOrder=1;scene.add(shadows);
  }
  shadows.count=visible.length;visible.forEach((actor,index)=>{position.set(actor.x,actor.y+.012,actor.z);shadowScale.set(actor.radius*1.22,actor.radius*.96,1);shadowMatrix.compose(position,shadowRotation,shadowScale);shadows.setMatrixAt(index,shadowMatrix);});shadows.instanceMatrix.needsUpdate=true;shadows.computeBoundingSphere();
 }
 function setContactShadows(value){contactShadows=!!value;}
 function metrics(){return {actors:actors.size,partBatches:[...buckets.values()].filter(bucket=>bucket.mesh?.count>0).length,partInstances:[...buckets.values()].reduce((sum,bucket)=>sum+(bucket.mesh?.count||0),0),contactShadows:shadows?.count??0};}
 function dispose(){for(const actor of actors)unregister(actor);for(const bucket of buckets.values()){bucket.mesh?.removeFromParent();bucket.mesh?.dispose();bucket.material.dispose();}buckets.clear();if(shadows){shadows.removeFromParent();shadows.dispose();shadows.material.map?.dispose();shadows.material.dispose();shadows.geometry.dispose();shadows=null;}}
 return {register,unregister,update,setContactShadows,metrics,dispose};
}
