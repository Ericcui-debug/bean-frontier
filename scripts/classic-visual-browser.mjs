import fs from 'node:fs';
import {chromium} from 'playwright';
const out='output/classic-visual/browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.connectOverCDP('http://127.0.0.1:9333');let context;const errors=[],states=[];
async function prepare(page,map){await page.goto('http://localhost:5180/?test');await page.waitForFunction(()=>window.__gameTest,{timeout:90000});await page.locator('#map-'+map).click();await page.locator('#start-btn').click();await page.locator('#buy-close').click();await page.evaluate(()=>{__gameTest.game.ai.update=()=>{};advanceTime(15100);});}
async function shot(page,name,map,position,id=2,pitch=0,yaw=0,low=false){await page.evaluate(({position,id,pitch,yaw,low})=>{const {game}=__gameTest;for(const a of game.actors){if(a===game.player)continue;a.group.visible=false;a.body.visible=false;a.x=100;a.z=100;a.group.position.set(100,0,100);}Object.assign(game.player,{...position,vx:0,vy:0,vz:0,grounded:true,stance:low?'low':'standing',crouched:low,height:low?.88:1.552,eye:low?.72:1.296});game.combat.equip(game.player,id);game.camera.state.aim=false;game.camera.state.yaw=yaw;game.camera.state.pitch=pitch;game.camera.update(0,game.player);advanceTime(50);__gameTest.render();},{position,id,pitch,yaw,low});await page.waitForTimeout(125);await page.evaluate(()=>advanceTime(0));await page.screenshot({path:out+'/'+name+'.png'});states.push({name,state:JSON.parse(await page.evaluate(()=>render_game_to_text()))});}
try{
context=await browser.newContext({viewport:{width:1280,height:720}});let page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await prepare(page,'assault');for(let id=0;id<4;id++)await shot(page,'assault-gun-'+id,'assault',{x:-4,y:0,z:27},id);
await shot(page,'assault-warehouse','assault',{x:0,y:0,z:9},2,0,0);
await shot(page,'assault-mezzanine','assault',{x:-17,y:3.2,z:0},1,-.2,Math.PI/2);
await shot(page,'assault-roof','assault',{x:10,y:6.82,z:16},2,-.1,0);
await shot(page,'assault-low','assault',{x:16,y:7.42,z:5},0,0,0,true);
await shot(page,'assault-low-up','assault',{x:16,y:7.42,z:5},2,1.45,0,true);
await page.locator('#pause').click();await page.locator('#home').click();await page.locator('#map-dust2').click();await page.locator('#start-btn').click();await page.locator('#buy-close').click();await page.evaluate(()=>{__gameTest.game.ai.update=()=>{};advanceTime(15100);});
await shot(page,'dust2-mid','dust2',{x:-7,y:0,z:6},2,0,0);
await shot(page,'dust2-A','dust2',{x:29,y:3.2,z:-22},3,0,Math.PI/2);
await shot(page,'dust2-tunnel','dust2',{x:-32,y:1.6,z:16},1,0,0);
await page.evaluate(()=>{__gameTest.game.combat.equip(__gameTest.game.player,3);__gameTest.input.state.aim=true;__gameTest.game.camera.state.aim=true;__gameTest.game.camera.update(1/2,__gameTest.game.player);__gameTest.render();});await page.screenshot({path:out+'/dust2-ads.png'});
await context.close();context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await prepare(page,'dust2');await shot(page,'mobile-rifle','dust2',{x:-7,y:0,z:6},2,0,0);await page.setViewportSize({width:390,height:844});await page.locator('#resume').click();await shot(page,'portrait-rifle','dust2',{x:-7,y:0,z:6},2,0,0);
fs.writeFileSync(out+'/states.json',JSON.stringify(states,null,2));fs.writeFileSync(out+'/errors.json',JSON.stringify(errors,null,2));console.log(JSON.stringify({screenshots:states.length+1,errors}));if(errors.length)process.exitCode=1;
}finally{await context?.close();await browser.close();}
