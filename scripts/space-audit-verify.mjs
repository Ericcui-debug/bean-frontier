import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {batchStaticChunks} from '../src/static-batching.js';
import {createActorBatcher} from '../src/actor-batching.js';

// Independent rendering regressions: shared resources, inherited transforms,
// dynamic collision objects, and actor visibility must survive batching.
const checks=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,detail});assert.ok(pass,name);console.log('PASS '+name);};
const scene=new THREE.Scene(),root=new THREE.Group(),parent=new THREE.Group();
root.position.set(13,2,-9);parent.position.set(4,3,2);root.add(parent);scene.add(root);
const geometry=new THREE.BoxGeometry(1,1,1),texture=new THREE.Texture();
let sourceDisposed=0;geometry.addEventListener('dispose',()=>sourceDisposed++);
const surface=(repeat)=>{const m=new THREE.MeshStandardMaterial({map:texture});m.userData.repeat=new THREE.Vector3(...repeat);m.onBeforeCompile=()=>{};return m;};
const first=new THREE.Mesh(geometry,surface([2,3,4]));first.scale.set(2,4,6);parent.add(first);
const second=new THREE.Mesh(geometry,surface([4,6,8]));second.position.set(6,0,0);second.scale.set(4,8,12);parent.add(second);
const door=new THREE.Group(),doorMesh=new THREE.Mesh(geometry,surface([1,1,1]));door.add(doorMesh);root.add(door);
scene.updateMatrixWorld(true);
const inverse=root.matrixWorld.clone().invert();
const expected=new THREE.Box3().makeEmpty();
// Build the expected bounds explicitly; the shared geometry's local bounds
// must not be mutated by an earlier object's nonuniform transform.
expected.makeEmpty();for(const mesh of [first,second])expected.union(new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position')).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)));
const staticBatch=batchStaticChunks(root,{dynamicGroups:[door],chunkSize:16});
const actual=new THREE.Box3().makeEmpty();for(const mesh of staticBatch.meshes)actual.union(mesh.geometry.boundingBox);
check('static batching retains inherited transforms and nonuniform scale',actual.min.distanceTo(expected.min)<1e-6&&actual.max.distanceTo(expected.max)<1e-6,{actual:{min:actual.min.toArray(),max:actual.max.toArray()},expected:{min:expected.min.toArray(),max:expected.max.toArray()}});
check('dynamic door stays independently rendered and is excluded from static batch',door.parent===root&&doorMesh.parent===door&&staticBatch.metrics.sourceMeshes===2);
const uvMax=Math.max(...staticBatch.geometries.flatMap(g=>Array.from(g.getAttribute('uv').array)));
check('per-object texture repetition is baked before materials merge',uvMax===8&&staticBatch.materials.length===1,{uvMax,materials:staticBatch.materials.length});
let releasedGeometry=0,releasedMaterial=0;for(const g of staticBatch.geometries)g.addEventListener('dispose',()=>releasedGeometry++);for(const m of staticBatch.materials)m.addEventListener('dispose',()=>releasedMaterial++);
staticBatch.dispose();
check('map release frees every merged resource while preserving shared source buffers',releasedGeometry===staticBatch.geometries.length&&releasedMaterial===staticBatch.materials.length&&sourceDisposed===0&&staticBatch.meshes.every(m=>m.parent===null));

const actorScene=new THREE.Scene(),batcher=createActorBatcher(actorScene),actorGeometry=new THREE.BoxGeometry(1,1,1);
function actor(color,x){const group=new THREE.Group(),body=new THREE.Group(),material=new THREE.MeshStandardMaterial({color}),part=new THREE.Mesh(actorGeometry,material);body.add(part);group.add(body);group.position.set(x,2,3);actorScene.add(group);return {group,body,part,alive:true,grounded:true,radius:.424,x,y:2,z:3};}
const pink=actor(0xf455a6,1),blue=actor(0x67cbd8,4);batcher.register(pink);batcher.register(blue);batcher.update();
const mesh=actorScene.children.find(o=>o.isInstancedMesh);
const colorMatches=(offset,color)=>color.toArray().every((v,i)=>Math.abs(v-mesh.instanceColor.array[offset+i])<1e-6);
check('team colors share one batch and remain separate instance colors',batcher.metrics().partBatches===1&&mesh.count===2&&colorMatches(0,pink.part.material.color)&&colorMatches(3,blue.part.material.color));
const matrix=new THREE.Matrix4();mesh.getMatrixAt(1,matrix);check('instanced actor retains exact body world transform',matrix.elements.every((v,i)=>Math.abs(v-blue.part.matrixWorld.elements[i])<1e-6));
blue.group.visible=false;batcher.update();check('hidden actor parent removes all instanced parts',mesh.count===1);
blue.group.visible=true;pink.alive=false;batcher.update();check('dead actor removes instanced parts independently of group visibility',mesh.count===1);
pink.alive=true;batcher.unregister(blue);batcher.update();check('unregister restores original visibility and removes actor registration',blue.part.visible&&!blue.part.userData.actorBatchHidden&&batcher.metrics().actors===1&&mesh.count===1);
batcher.setContactShadows(true);pink.grounded=false;batcher.update();check('airborne actor does not retain a ground contact shadow',batcher.metrics().contactShadows===0);
pink.grounded=true;batcher.update();check('grounded living actor gets exactly one contact shadow',batcher.metrics().contactShadows===1);
let actorGeometryDisposed=0;actorGeometry.addEventListener('dispose',()=>actorGeometryDisposed++);batcher.dispose();
check('batcher disposal unregisters all actors without destroying shared geometry',pink.part.visible&&batcher.metrics().actors===0&&actorGeometryDisposed===0&&!actorScene.children.some(o=>o.isInstancedMesh));
fs.mkdirSync('output/space-independent-audit',{recursive:true});fs.writeFileSync('output/space-independent-audit/rendering-report.json',JSON.stringify({checks},null,2));
console.log(`PASS ${checks.length} independent render ownership/visibility regressions`);

if(process.argv.includes('--browser')){
 const {chromium}=await import('playwright');
 const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
 const base=process.argv.slice(2).find(v=>!v.startsWith('--'))||'http://localhost:5180/';
 const folder='output/space-independent-audit'+(base.startsWith('file:')?'-offline':base.startsWith('https:')?'-live':'');
 fs.mkdirSync(folder,{recursive:true});
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 await context.addInitScript(()=>localStorage.setItem('bean-frontier-onboarding',JSON.stringify({version:1})));
 const page=await context.newPage(),browserChecks=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const verify=(name,pass,detail)=>{browserChecks.push({name,pass:!!pass,detail});assert.ok(pass,name+' '+JSON.stringify(detail??''));console.log('PASS '+name);};
 const read=()=>page.evaluate(()=>JSON.parse(render_game_to_text()));
 const advance=async ms=>{await page.evaluate(ms=>advanceTime(ms),ms);await page.waitForTimeout(80);await page.evaluate(()=>advanceTime(0));};
 try{
  for(const id of ['assault','dust2']){
   const url=new URL(base);url.search='test&lazy';await page.goto(url.href);await page.waitForFunction(()=>window.__gameTest);
   await page.locator('[data-map="'+id+'"]').click();await page.locator('#start-btn').click();await page.waitForFunction(()=>JSON.parse(render_game_to_text()).mode==='playing',null,{timeout:90000});
   await page.evaluate(()=>{__gameTest.game.ai.update=()=>{};__gameTest.game.player.money=8000;});
   await page.locator('[data-buy="2"]').click();await page.locator('[data-buy="armor"]').click();await advance(15010);
   const spawn=await page.evaluate(()=>{const {world,game}=__gameTest;return world.spawns.attack.flatMap(a=>world.spawns.defend.map(b=>!!world.blocked({x:a.x,y:a.y+game.player.eye,z:a.z},{x:b.x,y:b.y+game.player.eye,z:b.z})));});
   verify(id+' preserves physical spawn visibility blocking for every pair',spawn.every(Boolean),spawn);
   let s=await read();verify(id+' actual buy updates inventory, HUD and first-person weapon',s.player.equipment[1]?.id===2&&s.player.slot===1&&await page.evaluate(()=>__gameTest.game.camera.view.userData.weaponId===2)&&await page.locator('#ammo-count').textContent()==='30',s.player);
   for(let round=0;round<4;round++){await page.evaluate(round=>__gameTest.game.finishRound(round%2,'independent audit'),round);await advance(4010);s=await read();verify(id+' survivor rifle/armor/selected slot retained at round '+s.round,s.player.equipment[1]?.id===2&&s.player.slot===1&&s.player.armor===100&&await page.evaluate(()=>__gameTest.game.camera.view.userData.weaponId===2),s.player);if(round<3)await advance(15010);}
   verify(id+' halftime keeps fixed team equipment and funds',s.round===5&&s.attackTeam===1&&s.player.team===0&&s.player.money===8000,s.player);
   await page.evaluate(()=>__gameTest.setBuy(false));await advance(0);await page.screenshot({path:`${folder}/${id}-retained-rifle.png`});
   await advance(15010);await page.evaluate(()=>__gameTest.game.down(__gameTest.game.player));await advance(20);
   const death=await page.evaluate(()=>{const {game,g}=__gameTest,viewed=game.actors.find(a=>a.id===game.state.spectateId);return {primary:game.player.equipment[1],armor:game.player.armor,viewed:viewed?.id,hidden:viewed?.firstPersonHidden,bodyVisible:viewed?.body.visible,actorMetrics:g.actorBatches.metrics()};});
   verify(id+' death removes gear and spectated teammate full body',!death.primary&&!death.armor&&death.viewed!=null&&death.hidden&&!death.bodyVisible,death);
   await page.evaluate(()=>__gameTest.game.finishRound(1,'independent audit'));await advance(4010);s=await read();verify(id+' dead player returns next round with default equipment',s.player.alive&&s.player.hp===100&&s.player.slot===0&&!s.player.equipment[1]&&!s.player.armor,s.player);
   const markers=await page.evaluate(()=>[...document.querySelectorAll('#map [data-marker]')].map(n=>n.dataset.marker));verify(id+' minimap exposes only own team and objectives',markers.every(v=>v==='player'||v.startsWith('ally-')||v.startsWith('hostage-')||v==='bomb'||v==='bomb-drop'),markers);
   await page.evaluate(()=>{const {game}=__gameTest;game.state.phase='active';game.state.phaseEndsAt=game.state.time+180;__gameTest.setBuy(false);for(const a of game.actors.slice(1)){a.x=1000+a.id;a.z=1000;a.group.position.set(a.x,a.y,a.z);}});
   if(id==='assault'){
    const ladder=await page.evaluate(()=>__gameTest.world.ladders.find(l=>!l.duct));
    await page.evaluate(l=>{const {game}=__gameTest;Object.assign(game.player,{...l.bottom,vx:0,vy:0,vz:0,grounded:true,ladderId:null,ladderCooldown:0});game.camera.state.yaw=0;},ladder);
    await page.keyboard.down('KeyW');await advance(600);await page.keyboard.up('KeyW');const raised=(await read()).player;verify('real W climbs the remeasured roof ladder',raised.y>ladder.y0+1&&raised.ladderId===ladder.id,{raised,ladder});await advance(200);verify('released input holds ladder height',Math.abs((await read()).player.y-raised.y)<.01);await page.screenshot({path:`${folder}/assault-ladder.png`});
    await page.keyboard.down('KeyW');await advance(Math.ceil((ladder.y1-raised.y)/2.8*1000)+5);await page.keyboard.up('KeyW');const top=(await read()).player;verify('roof ladder exits onto the authored roof level',!top.ladderId&&Math.abs(top.y-ladder.exit.y)<.4,{top,exit:ladder.exit});await page.screenshot({path:`${folder}/assault-roof.png`});
    const duct=await page.evaluate(()=>{const {world}=__gameTest;for(const q of world.lowZones)for(let x=q.x0+.5;x<q.x1-.4;x+=.25)for(let z=q.z0+.5;z<q.z1-.4;z+=.25){const y=world.groundAt(x,z,q.y0+.5),p={x,y,z};if(y!=null&&world.stanceAt(p)==='crouch'&&world.canWalk(p,p))return p;}return null;});
    verify('real collision has an accessible authored duct sample',!!duct,duct);await page.evaluate(p=>{Object.assign(__gameTest.game.player,{...p,vx:0,vy:0,vz:0,grounded:true,ladderId:null,ladderCooldown:.5});__gameTest.game.camera.state.pitch=0;},duct);await advance(50);s=await read();verify('duct stance lowers body and first-person eye together',s.player.stance==='crouch'&&Math.abs(s.camera.position.y-s.player.y-.72)<.02,s);await page.screenshot({path:`${folder}/assault-duct.png`});
   }
   for(const pitch of [-1.45,1.45]){await page.evaluate(pitch=>{__gameTest.game.camera.state.pitch=pitch;},pitch);await advance(20);s=await read();verify(id+' extreme pitch keeps camera at safe stance eye height '+pitch,Math.abs(s.camera.position.y-s.player.y-(s.player.stance==='crouch'?.72:1.296))<.02&&Math.abs(s.camera.renderedPitch-pitch)<.002,s.camera);await page.screenshot({path:`${folder}/${id}-pitch-${pitch>0?'up':'down'}.png`});}
  }
  verify('independent browser inspection has no runtime or console errors',errors.length===0,errors);
 }finally{fs.writeFileSync(`${folder}/browser-report.json`,JSON.stringify({base,checks:browserChecks,errors,limitations:['Physical iPhone/Safari touch feel, GPU FPS, and heat were not tested.']},null,2));await context.close();await browser.close();}
 console.log(`PASS ${browserChecks.length} independent browser regressions`);
}
