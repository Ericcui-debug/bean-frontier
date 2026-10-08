import assert from 'node:assert/strict';
import * as THREE from 'three';
import {insideView,turnToward,aligned,hearEvents,PERCEPTION} from '../src/ai-perception.js';
import {createSoundEvents} from '../src/sound-events.js';
import {createAimAssist} from '../src/aim-assist.js';
import {CHARACTER} from '../src/dimensions.js';
import {setup,perceptionFixture} from './bomb-fixture.mjs';
const checks=[];const check=(v,label)=>{assert.ok(v,label);checks.push(label);};
for(const fps of [15,30,60]){
 const a={x:0,y:0,z:0,yaw:0,pitch:0};
 check(insideView(a,{x:0,z:-10}),'front visible '+fps);
 check(!insideView(a,{x:0,z:10}),'rear silent invisible '+fps);
 check(!insideView(a,{x:10,z:0}),'side outside cone '+fps);
 let old=0;for(let t=0;t<.5-1e-8;t+=1/fps){const dt=Math.min(1/fps,.5-t);turnToward(a,{x:0,y:CHARACTER.sight,z:10},dt);check(Math.abs(a.yaw-old)<=PERCEPTION.turnRate*dt+1e-8,'bounded turning '+fps+'/'+t);old=a.yaw;}
 check(Math.abs(Math.abs(a.yaw)-Math.PI/2)<1e-8,'same turn at half second '+fps);
 check(!aligned(a,{x:0,y:CHARACTER.sight,z:10}),'no shooting until aligned '+fps);
}
{
 let time=10,played=0;const audio={effectsEnabled:false,effect(){played++;return false;}},bus=createSoundEvents({getTime:()=>time,audio}),a={id:1,team:0,x:0,y:0,z:0},world={blocked:()=>true};
 const source={type:'gun',actorId:5,team:1,x:5,y:0,z:0,radius:42};const event=bus.publish(source);source.x=900;
 check(event.x===5&&Object.isFrozen(event),'sound event copies and freezes position');
 hearEvents(a,bus.recent(),time,world);check(a.lastHeard?.uncertainty===2.4,'occluded sound yields approximate location');check(!('actorId' in a.lastHeard)&&!('id' in a.lastHeard),'hearing has no hidden actor tracking identifier');const copy={...a.lastHeard};
 time+=.5;hearEvents(a,bus.recent(a.heardCursor),time,world);check(a.lastHeard.x===copy.x&&a.lastHeard.z===copy.z,'moving source cannot refresh old hearing');
 check(played===1&&a.lastHeard,'muted sound still available to AI');time=12.1;hearEvents(a,bus.recent(a.heardCursor),time,world);check(a.lastHeard===null,'sound memory expires');
 bus.publish({...source,x:0,team:0});hearEvents(a,bus.recent(a.heardCursor),time,world);check(a.lastHeard===null,'own team does not become hostile sound');bus.reset();check(bus.count===0,'round clears sound events');
}
{
 const camera=new THREE.PerspectiveCamera(72,2,.08,150);camera.position.set(0,CHARACTER.aimHeight,0);camera.lookAt(0,CHARACTER.aimHeight,-10);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const player={team:0},enemy={x:0,y:0,z:-10,team:1,alive:true};let blocked=false;
 const assist=createAimAssist({camera,world:{blocked:()=>blocked},actors:[enemy],player,getViewport:()=>({width:844,height:390})});
 assist.update(.01,true);check(assist.value<1&&assist.value>.7,'assist eases in without jumping');assist.update(1,true);check(assist.value>=.7-1e-6&&assist.value<.701,'assist limited to70%');
 blocked=true;assist.update(.04,true);check(assist.value>.7&&assist.value<1,'occlusion eases assist out');assist.update(1,true);check(assist.value>.999,'occluded target loses slowdown');
 blocked=false;enemy.z=-40;assist.update(1,true);check(assist.value>.999,'far target no assist');enemy.z=-10;enemy.team=0;assist.update(1,true);check(assist.value>.999,'friendly target no assist');assist.reset();check(assist.value===1,'pause clears assist');
}
for(const map of ['assault','dust2']){
 const {game,world}=setup(false,map);game.start();game.state.phase='active';game.state.time=16;game.actors.forEach(a=>a.alive=false);
 const a=game.actors[1],enemy=game.actors[5],p=perceptionFixture(world),yaw=Math.atan2(p.visible.x-p.from.x,-(p.visible.z-p.from.z));Object.assign(a,{...p.from,alive:true,yaw:yaw+Math.PI});Object.assign(enemy,{...p.visible,alive:true,isPlayer:true});
 game.ai.reset();game.ai.decide(a,16);check(a.visibleTargetId===null&&a.lastSeen===null,map+' rear silent actor not discovered');
 a.yaw=yaw;game.ai.decide(a,16);check(a.visibleTargetId===enemy.id,map+' front LOS acquired');check(a.reactionUntil-16>=.45&&a.reactionUntil-16<=.65,map+' human reaction window');
 const last={...a.lastSeen};Object.assign(enemy,p.hidden);game.ai.decide(a,16.1);check(a.visibleTargetId===null&&a.lastSeen.x===last.x,map+' obstruction retains copied observation');game.ai.decide(a,19.2);check(a.lastSeen===null,map+' visual memory expires');
 game.ai.reset();game.soundEvents.publish({type:'gun',team:enemy.team,actorId:enemy.id,...p.visible,radius:100});game.ai.decide(a,19.2); // event.at16, intentionally expired
 check(a.lastHeard===null,map+' stale audio never reacquires hidden actor');
}
const passResults=[];
for(const fps of [15,30,60]){
 const {game:g,world}=setup(false,'assault');g.start();g.update(15);g.actors.forEach(a=>a.alive=false);
 const a=g.actors[2],friend=g.actors[1],enemy=g.actors[5];Object.assign(a,{x:16,y:7.42,z:3,alive:true,stance:'crouch',height:.88,eye:.72,goal:{x:16,y:7.42,z:-4},aiMode:'push',decisionAt:Infinity,path:[],pathTarget:null,repathAt:0,yaw:0});Object.assign(friend,{x:16,y:7.42,z:1.9,alive:true,isPlayer:true,stance:'crouch',height:.88,eye:.72});Object.assign(enemy,{x:1000,y:0,z:1000,alive:true,isPlayer:true});
 for(let i=0;i<fps*8;i++){g.update(1/fps);assert.ok(a.x>=14.6+a.radius-.001&&a.x<=17.4-a.radius+.001,'yield stays inside duct');}
 check(a.z< -3.5,'stationary friend passed in narrow duct '+fps);check(a.goal.x===16&&a.goal.z===-4&&!a.passRoute,'sidepass preserves original goal and clears temporary route '+fps);
 passResults.push([a.x,a.y,a.z].map(v=>Math.round(v*1000)));
 g.ai.reset();check(!a.passRoute&&a.friendBlocked===0,'round reset clears passing memory '+fps);
}
check(JSON.stringify(passResults[0])===JSON.stringify(passResults[1])&&JSON.stringify(passResults[1])===JSON.stringify(passResults[2]),'duct sidepass consistent15/30/60');
console.log('PASS '+checks.length+' perception / hearing / turn / assist / narrow passage checks');
