import fs from 'node:fs';
import {MAPS} from '../src/maps.js';
import {mapShapes} from '../src/map-geometry.js';
const EPS=1e-6,inside=(p,s)=>s.shape!=='ramp'&&['x','y','z'].every(k=>p[k]>s[k+'0']+EPS&&p[k]<s[k+'1']-EPS);
const all=[];
for(const map of MAPS){
 const shapes=mapShapes(map).map((s,index)=>({...s,index})),faces=[];
 for(const s of shapes){for(const axis of ['x','y','z'])for(const sign of [-1,1]){
  if(s.shape==='ramp'&&(axis!=='y'||sign!==-1))continue;
  const [u,v]=['x','y','z'].filter(k=>k!==axis);faces.push({solid:s,axis,sign,plane:s[axis+(sign>0?'1':'0')],u,v,u0:s[u+'0'],u1:s[u+'1'],v0:s[v+'0'],v1:s[v+'1']});
 }}
 const pairs=[];
 for(let i=0;i<faces.length;i++)for(let j=i+1;j<faces.length;j++){
  const a=faces[i],b=faces[j];if(a.solid===b.solid||a.axis!==b.axis||a.sign!==b.sign||Math.abs(a.plane-b.plane)>EPS)continue;
  const u0=Math.max(a.u0,b.u0),u1=Math.min(a.u1,b.u1),v0=Math.max(a.v0,b.v0),v1=Math.min(a.v1,b.v1),area=(u1-u0)*(v1-v0);if(u1-u0<.01||v1-v0<.01||area<.005)continue;
  const p={[a.axis]:a.plane+a.sign*.002,[a.u]:(u0+u1)/2,[a.v]:(v0+v1)/2};
  const covered=shapes.some(s=>s!==a.solid&&s!==b.solid&&inside(p,s));
  const describe=s=>({index:s.index,type:s.type,material:s.material??'base',bounds:{x0:s.x0,x1:s.x1,y0:s.y0,y1:s.y1,z0:s.z0,z1:s.z1}});
  pairs.push({a:describe(a.solid),b:describe(b.solid),axis:a.axis,sign:a.sign,plane:a.plane,area,overlap:{[a.u+'0']:u0,[a.u+'1']:u1,[a.v+'0']:v0,[a.v+'1']:v1},sample:p,exposedAtSample:!covered});
 }
 const exposed=pairs.filter(p=>p.exposedAtSample).sort((a,b)=>b.area-a.area),result={map:map.id,pairs:pairs.length,exposedPairs:exposed.length,exposed,potential:pairs.filter(p=>!p.exposedAtSample)};all.push(result);console.log(JSON.stringify({map:map.id,total:pairs.length,exposed:exposed.length,largest:exposed.slice(0,15)},null,2));
}
fs.mkdirSync('output/surface-audit',{recursive:true});fs.writeFileSync('output/surface-audit/coplanar.json',JSON.stringify(all,null,2));
if(process.argv.includes('--weapons')){
 const [{loadVisualAssets},{setup},{poseBean},THREE]=await Promise.all([import('../src/weapon-models.js'),import('./bomb-fixture.mjs'),import('../src/character.js'),import('three')]);await loadVisualAssets();const examples=[];
 for(const id of ['assault','dust2']){const {game,world}=setup(true,id),a=game.actors[1];game.combat.equip(a,3);let found=null;
  for(const s of world.solids){if(s.type!=='wall'||s.shape==='ramp')continue;for(const sign of [-1,1]){const x=(sign<0?s.x0:s.x1)+sign*(a.radius+.03),z=(s.z0+s.z1)/2,y=world.groundAt(x,z,.38);if(y==null||!world.canWalk({x,y,z},{x,y,z})||s.y1<y+1.5||s.y0>y+.5)continue;
   Object.assign(a,{x,y,z,yaw:sign<0?Math.PI/2:-Math.PI/2,gunPitch:0});poseBean(a,0,true);a.group.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(a.gun),wall=new THREE.Box3(new THREE.Vector3(s.x0,s.y0,s.z0),new THREE.Vector3(s.x1,s.y1,s.z1));if(!box.intersectsBox(wall))continue;const muzzle=new THREE.Vector3();a.muzzle.getWorldPosition(muzzle);found={map:id,actor:{x,y,z,radius:a.radius},weaponBounds:{min:box.min.toArray(),max:box.max.toArray()},wall:{type:s.type,x0:s.x0,x1:s.x1,y0:s.y0,y1:s.y1,z0:s.z0,z1:s.z1},muzzle:muzzle.toArray(),muzzleRayBlocked:!!world.blocked({x:a.x,y:a.y+a.eye,z:a.z},muzzle,.025)};break;
  }if(found)break;}examples.push(found);
 }
 fs.writeFileSync('output/surface-audit/weapon-wall.json',JSON.stringify(examples,null,2));console.log('World AWP wall examples:',JSON.stringify(examples));
}
