import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MAPS} from '../src/maps.js';
import {mapShapes} from '../src/map-geometry.js';
import {CHARACTER,LOW_CHARACTER} from '../src/dimensions.js';
import {NAV_PACKS} from '../src/navigation/classic-nav.js';
import {loadNavigation,prepareNavigation,cancelNavigation,navigationStatus} from '../src/navigation/navigation-loader.js';
let checks=0;const check=(name,pass)=>{assert.ok(pass,name);checks++;};
for(const map of MAPS){
 const pack=NAV_PACKS[map.id],data=loadNavigation(map.id);check(map.id+' profiles intact',!!data.soldier.mesh.nodes.length&&!!data.hostage.mesh.nodes.length);
 const hash=createHash('sha256').update(JSON.stringify({shapes:mapShapes(map,{dynamic:false}),ladders:map.ladders,lowZones:map.lowZones,character:CHARACTER,low:LOW_CHARACTER,options:Object.values(data).map(p=>p.options)})).digest('hex');check(map.id+' exact geometry fingerprint',hash===pack.geometryHash);
 check(map.id+' originalJSON bytes exact',Buffer.byteLength(JSON.stringify(data))===pack.jsonBytes);check(map.id+' packed length exact',Buffer.from(pack.data,'base64').length===pack.bytes);check(map.id+' embedded navigation >70% smaller',pack.data.length<pack.jsonBytes*.3);
 const promise=prepareNavigation(map.id,{useWorker:false});check('loading state reported synchronously',navigationStatus().state==='loading');await promise;check('selected map only ready',navigationStatus().decodedMap===map.id&&navigationStatus().state==='ready');check('fallback preserves same nav',JSON.stringify(loadNavigation(map.id))===JSON.stringify(data));
}
const request=prepareNavigation(MAPS[0].id,{useWorker:false}).catch(error=>error);cancelNavigation();const error=await request;check('cancel discards late decode',error.name==='AbortError'&&navigationStatus().state==='idle'&&!navigationStatus().decodedMap);
const first=prepareNavigation(MAPS[0].id,{useWorker:false}).catch(error=>error),second=prepareNavigation(MAPS[1].id,{useWorker:false});await second;check('newer map wins race',(await first).name==='AbortError'&&navigationStatus().decodedMap===MAPS[1].id);cancelNavigation();
check('unknown map rejected',await prepareNavigation('missing-map').then(()=>false,e=>e.message.includes('Missing')));
console.log(`PASS ${checks} compressed navigation / geometry / fallback / cancellation checks`);
