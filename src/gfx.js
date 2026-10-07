import * as THREE from 'three';
export {THREE};
export const C={pink:0xf455a6,mint:0xa9d9b2,teal:0x448d88,cream:0xfff4da,yellow:0xffd56e,orange:0xffa77b,blue:0x67cbd8,purple:0xaaa0df,dark:0x284c50,red:0xf07781};
export function createGraphics(canvas,mobile){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:!mobile,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.75));renderer.setSize(innerWidth,innerHeight);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x97dde1);scene.fog=new THREE.Fog(0x97dde1,100,235);
 scene.add(new THREE.HemisphereLight(0xfff9e7,0x729b92,2.2));
 const sun=new THREE.DirectionalLight(0xfff2d0,2.5);sun.position.set(-45,75,35);sun.castShadow=true;sun.shadow.mapSize.setScalar(mobile?512:2048);Object.assign(sun.shadow.camera,{left:-38,right:38,top:36,bottom:-36,near:1,far:150});sun.shadow.bias=-.0003;sun.shadow.normalBias=.065;scene.add(sun);
 const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.08,280);
 const materials=new Map(),labels=[],boxGeo=new THREE.BoxGeometry(1,1,1),ballGeo=new THREE.SphereGeometry(1,16,12);
 function mat(color,roughness=.65){const key=color+':'+roughness;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness}));return materials.get(key);}
 function mesh(geo,color,parent=scene){const m=new THREE.Mesh(geo,mat(color));m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function box(x,y,z,w,h,d,color,parent=scene){const m=mesh(boxGeo,color,parent);m.position.set(x,y,z);m.scale.set(w,h,d);return m;}
 function ball(x,y,z,sx,sy,sz,color,parent=scene){const m=mesh(ballGeo,color,parent);m.position.set(x,y,z);m.scale.set(sx,sy,sz);return m;}
 function cylinder(x,y,z,r,h,color,parent=scene){const m=mesh(new THREE.CylinderGeometry(r,r,h,16),color,parent);m.position.set(x,y,z);return m;}
 function label(text,x,y,z,{color='#fff7de',size=1.8,width=512}={}){const c=document.createElement('canvas');c.width=width*2;c.height=256;const ctx=c.getContext('2d');let fontSize=114;ctx.font=`900 ${fontSize}px "Noto Sans SC",sans-serif`;if(ctx.measureText(text).width>c.width-64){fontSize*=((c.width-64)/ctx.measureText(text).width);ctx.font=`900 ${fontSize}px "Noto Sans SC",sans-serif`;}const textWidth=ctx.measureText(text).width;ctx.fillStyle='rgba(30,67,68,.78)';ctx.beginPath();ctx.roundRect((c.width-textWidth)/2-23,50,textWidth+46,156,25);ctx.fill();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,130);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:true,depthWrite:false,toneMapped:false,alphaTest:.015}));m.scale.set(size*4,size,1);m.userData.labelScale=m.scale.clone();m.position.set(x,y,z);scene.add(m);labels.push(m);return m;}
 const labelDirection=new THREE.Vector3(),labelOffset=new THREE.Vector3();
 function updateLabels(){camera.getWorldDirection(labelDirection);const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));for(const m of labels){const base=m.userData.labelScale;labelOffset.copy(m.position).sub(camera.position);const depth=labelOffset.dot(labelDirection),distance=labelOffset.length();m.material.opacity=THREE.MathUtils.clamp((distance-4)/3,0,1);const apparentHeight=base.y/(2*tan*Math.max(.1,depth)),apparentWidth=base.x/(2*tan*camera.aspect*Math.max(.1,depth));const factor=Math.min(1,.075/apparentHeight,.30/apparentWidth);m.scale.copy(base).multiplyScalar(factor);}}
 let quality=mobile?.85:1;
 function setQuality(value){quality=THREE.MathUtils.clamp(value,.55,1);renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.75)*quality);}
 function resize(){const width=document.documentElement.clientWidth||innerWidth,height=visualViewport?.height||innerHeight;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}
 setQuality(quality);resize();
 return {renderer,scene,sun,camera,mat,mesh,box,ball,cylinder,label,labels,updateLabels,resize,setQuality,get quality(){return quality;}};
}
