// Controlled visual fixtures; keyboard and touch gameplay are verified separately.
import fs from 'node:fs';
import {chromium} from 'playwright';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');
const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],samples=[];
const out='output/bomb-multimap-visual';fs.mkdirSync(out,{recursive:true});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.setDefaultTimeout(10000);
const url=process.argv[2]||'http://localhost:5180/?test';
const fixtures={town:[{name:'shop',x:-17,y:0,z:10,yaw:.8,pitch:.04},{name:'balcony',x:-10,y:2.98,z:6,yaw:1.35,pitch:-.15},{name:'interior',x:-10,y:0,z:6,yaw:-1.57,pitch:0}],factory:[{name:'hall',x:-19,y:0,z:-1,yaw:0,pitch:0},{name:'catwalk',x:0,y:2.4,z:-7,yaw:-1.3,pitch:-.2},{name:'underpass',x:0,y:0,z:-7,yaw:Math.PI,pitch:.08}],harbor:[{name:'containers',x:-20,y:0,z:12,yaw:.95,pitch:.02},{name:'pier',x:-23,y:1.8,z:-18,yaw:2.2,pitch:-.1},{name:'underpier',x:-23,y:0,z:-18,yaw:Math.PI,pitch:0}]};
try{
 await page.goto(url);await page.waitForFunction(()=>window.__gameTest);
 for(const [id,views] of Object.entries(fixtures)){
  for(const view of views){await page.evaluate(({id,view})=>{const {game,g}=__gameTest;game.reset();game.setMap(id);game.start();game.ai.update=()=>{};advanceTime(15010);game.combat.equip(game.player,2);game.combat.select(game.player,1);Object.assign(game.player,{x:view.x,y:view.y,z:view.z,vx:0,vz:0,vy:0,grounded:true});game.camera.state.yaw=view.yaw;game.camera.state.pitch=view.pitch;game.camera.update(0,game.player);__gameTest.render();}, {id,view});await page.waitForTimeout(90);await page.evaluate(()=>{advanceTime(0);__gameTest.render();});await page.screenshot({path:out+`/${id}-${view.name}.png`});samples.push(await page.evaluate(()=>({state:JSON.parse(render_game_to_text()),drawCalls:__gameTest.g.renderer.info.render.calls,memory:{...__gameTest.g.renderer.info.memory}})));}
 }
 // Repeated loads render every map so WebGL disposal can be observed after warmup.
 const memory=[];for(let cycle=0;cycle<4;cycle++)for(const id of Object.keys(fixtures)){memory.push(await page.evaluate(({cycle,id})=>{const {game,g}=__gameTest;game.reset();game.setMap(id);__gameTest.render();return {cycle,id,...g.renderer.info.memory,roots:g.scene.children.filter(o=>o.name.startsWith('map:')).length,labels:g.labels.length};},{cycle,id}));}
 if(errors.length)throw new Error(JSON.stringify(errors));fs.writeFileSync(out+'/report.json',JSON.stringify({errors,samples,memory},null,2));console.log('Visual fixtures captured',samples.length,'resource samples',memory);
}finally{await context.close();await browser.close();}
