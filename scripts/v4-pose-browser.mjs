import {pathToFileURL} from 'node:url';import path from 'node:path';
import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs';
const base=process.argv.includes('--offline')?pathToFileURL(path.resolve('Bean-Frontier.html')).href:process.env.GAME_URL||'http://127.0.0.1:5180/',out=process.env.OUTPUT_DIR||'output/pose-fix/browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333'),context=await browser.newContext({viewport:process.env.CI?{width:960,height:540}:{width:1100,height:650}}),page=await context.newPage();context.setDefaultTimeout(180000);const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));const ok=(value,name)=>{assert.ok(value,name);checks.push(name);};
try{
 await page.goto(base+'?test');await page.waitForFunction(()=>window.__game,null,{timeout:120000});await page.evaluate(()=>__game.test.manual(true));
 ok(await page.title()==='豆豆火力岛','public page title contains no build number');await page.locator('#hud-start').click();await page.waitForFunction(()=>__game.world._loaded&&!__game.loading,null,{timeout:120000});
 await page.keyboard.down('Control');await page.evaluate(()=>advanceTime(250));let state=await page.evaluate(()=>JSON.parse(render_game_to_text()));ok(state.player.crouching&&state.player.stanceBlend>.9&&state.player.height<1,'real keyboard crouch uses actual interpolated state');
 await page.keyboard.up('Control');await page.evaluate(()=>advanceTime(700));state=await page.evaluate(()=>JSON.parse(render_game_to_text()));ok(!state.player.crouching&&state.player.height>1.55,'real keyboard release restores standing');
 const value=await page.evaluate(()=>{const g=__game;g.test.setPose('player',.5);const s=JSON.parse(render_game_to_text());return{eye:s.player.eye,actual:g.player.eyeHeight,height:s.player.height,blend:s.player.stanceBlend};});ok(Math.abs(value.eye-value.actual)<.0001&&value.blend===.5&&Math.abs(value.height-1.216)<.001,'read-only output reports actual eye and transition height');
 const dimensions=await page.evaluate(()=>{const g=__game;return[0,.25,.5,.75,1].map(c=>{const a=g.bots.all[0];g.test.setPose(0,c,.35);const face=a.bean.face.localToWorld(new a.pos.constructor(.12,.04,-.083)),head=g.combat._rayCharacter(face.x,face.y,face.z+3,0,0,-1,10,...a.pos.toArray(),a.radius,a.height,a);return{scale:a.bean.body.scale.toArray(),head,part:g.combat._capPart,gunScale:a.heldWeapon.scale.toArray(),height:a.height};});});
 ok(dimensions.every(x=>x.scale.every(v=>v===.8)&&x.gunScale.every(v=>v===1)&&x.head>=0&&x.part==='head'),'rigid scale and visible eye headshots in all transition phases');
 await page.evaluate(()=>__game.test.showHitGeometry(true));ok(await page.evaluate(()=>__game._poseDebugMeshes.length>0),'hit geometry overlay exists only through test helpers');await page.evaluate(()=>__game.test.showHitGeometry(false));ok(await page.evaluate(()=>__game._poseDebugMeshes.length===0),'debug geometry is fully removable');
 // Fixed diagnostic views use actual game actor meshes and shared materials.
 // No test-only character geometry or material fallback substitutes the model.
 await page.evaluate(()=>{
  const g=__game,V=g.player.position.constructor,s=new g.scene.constructor();s.background=g.world._bounce.color.clone().setHex(0xdce6ef);
  const fill=g.world._bounce.clone();fill.color.setHex(0xffffff);fill.groundColor.setHex(0x8793a0);fill.intensity=2;s.add(fill);
  g.scene.traverse(o=>{if(o.isDirectionalLight){const light=o.clone();light.intensity=2.5;s.add(light);}});
  const foot=g.bots.all[0].bean.feet[0],geo=foot.geometry.clone();geo.scale(30,.01,30);const mat=foot.material.clone();mat.vertexColors=false;mat.color.setHex(0xaebdc7);const floor=new foot.constructor(geo,mat);floor.position.y=-.0017;s.add(floor);
  const camera=new g.camera.constructor(40,g.renderer.domElement.width/g.renderer.domElement.height,.035,100);g._posePreview={scene:s,camera,actors:g.bots.all.slice(0,2)};
  for(const [i,a]of g._posePreview.actors.entries()){a.pos.set(i===0?-.9:.9,0,0);a.yaw=Math.PI;a.moveSpeed=0;a.weaponId='m4a1';g.bots._applyGunLook(a);s.add(a.mesh);}
  document.body.append(g.renderer.domElement);g.renderer.domElement.style='position:fixed;inset:0;z-index:99998;width:100%;height:100%';for(const e of document.body.children)if(e!==g.renderer.domElement)e.style.display='none';
  g._posePreview.render=(view,c=.0,pitch=0,dead=false)=>{
   for(const[i,a]of g._posePreview.actors.entries()){a.alive=true;a.corpseSettled=false;a.bean.deathSupport=null;g.test.setPose(i,i===0?0:c,pitch);if(dead){a.deathTime=g.bots.time-.6;g.bots._animateDeath(a,0);}}
   if(view==='side')camera.position.set(4,1.7,2.5);else if(view==='corner')camera.position.set(2.2,1.8,4.7);else camera.position.set(0,1.85,4.8);
   camera.lookAt(new V(0,.72,0));g.renderer.render(s,camera);
  };
 });
 for(const[name,view,c,pitch,dead]of[['front','front',1,0,false],['transition','front',.5,0,false],['side','side',1,0,false],['corner','corner',1,0,false],['aim-up','corner',1,1.1,false],['aim-down','corner',1,-1.1,false],['death','corner',1,0,true]]){
  await page.evaluate(([view,c,pitch,dead])=>__game._posePreview.render(view,c,pitch,dead),[view,c,pitch,dead]);await page.screenshot({path:`${out}/${name}.png`});checks.push(`visual capture: ${name}`);
 }
 const minY=await page.evaluate(()=>{const a=__game._posePreview.actors[1],B=a.bean.shell.geometry.boundingBox.constructor;const box=new B();for(const part of [...a.bean.hitMeshes,...a.bean.limbs])box.expandByObject(part,true);return box.min.y;});ok(minY>=.002,'actual game corpse remains above supporting floor');
 ok(errors.length===0,'no browser exceptions');fs.writeFileSync(out+'/report.json',JSON.stringify({checks,errors,physicalIPhoneTested:false},null,2));console.log(JSON.stringify({ok:true,checks:checks.length,errors}));
}finally{await context.close();await browser.close();}
