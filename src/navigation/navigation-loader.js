import {inflateSync,strFromU8} from 'fflate';
import {NAV_PACKS} from './classic-nav.js';

const prepared=new Map();
let sequence=0,worker=null,pending=null;
const status={state:'idle',mapId:null,decodedMap:null,decodeMs:0,compressedBytes:0,worker:false,error:null};
const bytes=pack=>Uint8Array.from(atob(pack.data),c=>c.charCodeAt(0));
function decode(pack){return JSON.parse(strFromU8(inflateSync(bytes(pack))));}
export function navigationStatus(){return {...status};}
export function cancelNavigation(){sequence++;worker?.terminate();worker=null;pending?.reject(new DOMException('Loading cancelled','AbortError'));pending=null;prepared.clear();Object.assign(status,{state:'idle',mapId:null,decodedMap:null,decodeMs:0,compressedBytes:0,worker:false,error:null});}
export function releaseNavigation(id){prepared.delete(id);if(status.decodedMap===id)status.decodedMap=null;}
// Synchronous compatibility for offline geometry/physics fixtures. Browser
// launch pre-decodes in a worker, so gameplay never invokes this slow path.
export function loadNavigation(id){const pack=NAV_PACKS[id];if(!pack)throw new Error(`Missing baked navigation: ${id}`);const cached=prepared.get(id);if(cached){prepared.delete(id);return cached;}return decode(pack);}
export async function prepareNavigation(id,{useWorker=true}={}){
 if(!NAV_PACKS[id])throw new Error(`Missing baked navigation: ${id}`);
 cancelNavigation();const ticket=sequence,pack=NAV_PACKS[id],began=performance.now();
 Object.assign(status,{state:'loading',mapId:id,decodedMap:null,decodeMs:0,compressedBytes:pack.bytes,worker:false,error:null});
 try{
  let data;
  if(useWorker&&typeof Worker!=='undefined'){
   try{
    const {default:Factory}=await import('./nav-worker.js?worker&inline');
    if(ticket!==sequence)throw new DOMException('Loading cancelled','AbortError');
    worker=new Factory();status.worker=true;
    data=await new Promise((resolve,reject)=>{const active=worker;pending={reject};active.onmessage=e=>e.data.error?reject(new Error(e.data.error)):resolve(e.data.navigation);active.onerror=e=>{e.preventDefault?.();reject(new Error(e.message||'Navigation worker failed'));};const compressed=bytes(pack);active.postMessage({compressed},[compressed.buffer]);});
   }catch(error){
    if(ticket!==sequence||error.name==='AbortError')throw error;
    worker?.terminate();worker=null;pending=null;status.worker=false;
    // Give the loading panel a frame before the compatibility decode.
    await new Promise(resolve=>setTimeout(resolve,0));data=decode(pack);
   }
  }else{await new Promise(resolve=>setTimeout(resolve,0));data=decode(pack);}
  if(ticket!==sequence)throw new DOMException('Loading cancelled','AbortError');
  prepared.set(id,data);Object.assign(status,{state:'ready',decodedMap:id,decodeMs:Math.round((performance.now()-began)*100)/100});
  return {...status};
 }catch(error){if(ticket===sequence)Object.assign(status,{state:'error',error:error.message});throw error;}
 finally{if(ticket===sequence){worker?.terminate();worker=null;pending=null;}}
}
