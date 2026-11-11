import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Reflector} from 'three/addons/objects/Reflector.js';
export const HARBOR_GRADE=`float hgL=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));gl_FragColor.rgb*=mix(vec3(.94,1.005,1.035),vec3(1.035,1.01,.97),smoothstep(.08,.8,hgL));`;
export class HarborVisual {
 constructor(game){this.game=game;this.profile='harbor-after-rain';this.root=null;this.reflector=null;this.fixedExposure=null;this._materials=new WeakSet();this._scratch=new THREE.Vector2();this.reflectionsRequested=!(game.debug&&new URLSearchParams(location.search).get('reflection')==='0');
  if(game.touchDevice)THREE.ShaderChunk.colorspace_fragment+='\n'+HARBOR_GRADE;
  const css=document.createElement('style');css.textContent='#hud-crosshair{filter:drop-shadow(0 1px 1px #07131d) drop-shadow(0 0 1px #07131d)}#hud .hud-panel{border-color:rgba(217,234,240,.32)}';document.head.append(css);
 }
 load(world){this.unload();this.fixedExposure=world.sky?.autoExposure||1.05;this.root=new THREE.Group();this.root.name='harbor-visual-only';this.root.userData.noCollision=true;
  // Shared world-space mask: below the customs roof is dry. Only the real
  // ground slab gets the wet shader; platforms and warehouse walls stay dry.
  const ground=world.mats.ground;if(ground&&!this._materials.has(ground)){this._materials.add(ground);const before=ground.onBeforeCompile;ground.onBeforeCompile=(shader,renderer)=>{before(shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('float roughnessFactor = roughness * owORM.g;',`float hp=texture2D(owMacroTex,vOwWPos.xz*.041).r;float outdoor=1.0-(1.0-step(3.35,abs(vOwWPos.x)))*step(-14.2,vOwWPos.z)*(1.0-step(16.2,vOwWPos.z));float wet=outdoor*smoothstep(.32,.71,hp)*smoothstep(.75,.94,normalize(vOwWNrm).y);float puddle=outdoor*smoothstep(.75,.87,hp);float roughnessFactor=mix(roughness*owORM.g,.34,wet);roughnessFactor=mix(roughnessFactor,.13,puddle);roughnessFactor=mix(max(.82,roughnessFactor),roughnessFactor,outdoor);diffuseColor.rgb*=mix(1.0,.84,wet);`);};const key=ground.customProgramCacheKey.bind(ground);ground.customProgramCacheKey=()=>key()+'|harbor-wet-1';ground.needsUpdate=true;}
  // Real metre-scale industrial silhouettes are wholly beyond the arena.
  const parts=[],box=(x,y,z,w,h,d)=>{const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);parts.push(g);};
  for(const x of [-62,62]){box(x,12,12,1.2,24,1.2);box(x+9,23,12,20,.8,1.1);box(x+12,17,12,.10,12,.1);box(x-3,23,12,5,2,2.8);for(let k=0;k<5;k++)box(x,3+k*4.2,12,5,.22,1.2);}
  const craneGeo=mergeGeometries(parts);parts.forEach(g=>g.dispose());const craneMat=new THREE.MeshStandardMaterial({color:0x837156,roughness:.72,metalness:.35});const cranes=new THREE.Mesh(craneGeo,craneMat);this.root.add(cranes);
  const ship=new THREE.Mesh(new THREE.BoxGeometry(19,4,49),new THREE.MeshStandardMaterial({color:0x273e48,roughness:.74,metalness:.25}));ship.position.set(68,-.2,-18);this.root.add(ship);const cabin=new THREE.Mesh(new THREE.BoxGeometry(11,7,10),craneMat);cabin.position.set(68,5,-32);this.root.add(cabin);
  if(!this.game.touchDevice&&this.game.post&&this.reflectionsRequested){const geo=new THREE.CircleGeometry(1,40);geo.rotateX(-Math.PI/2);geo.scale(2.4,1,1.2);this.reflector=new Reflector(geo,{textureWidth:512,textureHeight:512,color:0x687e88,clipBias:.015});this.reflector.position.set(-40,.018,15);const onRender=this.reflector.onBeforeRender.bind(this.reflector);let last=-Infinity;this.reflector.onBeforeRender=(...args)=>{const now=this.game.simulationTime||0;if(now-last<1/15)return;last=now;const rig=this.game.viewmodel.rig,visible=rig.visible;rig.visible=false;try{onRender(...args);}finally{rig.visible=visible;}};this.root.add(this.reflector);}
  world.environment.add(this.root);this.game.post&&(this.game.post.bloomStrength=.085);
 }
 beforeFrame(){if(this.fixedExposure===null||!this.game.world._loaded)return;const exposure=this.fixedExposure*Math.pow(2,this.game.settings.brightnessEv||0);this.game.renderer.toneMappingExposure=exposure;if(this.game.world.sky)this.game.world.sky.shared.uOutputExposure.value=exposure;}
 unload(){if(!this.root)return;this.root.removeFromParent();this.root.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.reflector?.getRenderTarget().dispose();this.reflector=null;this.root=null;this.fixedExposure=null;}
 snapshot(){return{preset:this.profile,loaded:!!this.root,fixedExposure:this.fixedExposure,effects:{proceduralWetness:true,grade:true,hdr:!!this.game.post,planarReflection:!!this.reflector,motionBlur:false,rain:false},reflectionSize:this.reflector?[512,512]:[0,0],materials:this.game.materials.resourceStats()};}
}
