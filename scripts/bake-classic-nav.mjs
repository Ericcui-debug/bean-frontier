import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deflateSync} from 'fflate';
import {generateSoloNavMesh} from 'navcat/blocks';
import {addOffMeshConnection,OffMeshConnectionDirection} from 'navcat';
import {MAPS} from '../src/maps.js';
import {mapShapes,triangleSoup} from '../src/map-geometry.js';
import {CHARACTER,LOW_CHARACTER} from '../src/dimensions.js';
const output={};
for(const map of MAPS){output[map.id]={};const soup=triangleSoup(mapShapes(map,{dynamic:false}));for(const profile of ['soldier','hostage']){const height=profile==='soldier'?.88:1.552,cellSize=.25,cellHeight=.08,options={cellSize,cellHeight,walkableRadiusWorld:.45,walkableRadiusVoxels:2,walkableClimbWorld:.32,walkableClimbVoxels:4,walkableHeightWorld:height,walkableHeightVoxels:Math.ceil(height/cellHeight),walkableSlopeAngleDegrees:55,borderSize:0,minRegionArea:4,mergeRegionArea:15,maxSimplificationError:.8,maxEdgeLength:8,maxVerticesPerPoly:6,detailSampleDistance:1.5,detailSampleMaxError:.08};const result=generateSoloNavMesh(soup,options),nav=result.navMesh;const links=[];if(profile==='soldier')for(const l of map.ladders){const id=addOffMeshConnection(nav,{start:[l.bottom.x,l.bottom.y,l.bottom.z],end:[l.exit.x,l.exit.y,l.exit.z],radius:1.7,direction:OffMeshConnectionDirection.BIDIRECTIONAL,flags:1,area:2});links.push({id,ladderId:l.id});}output[map.id][profile]={mesh:nav,links,source:'navcat@0.4.1',options};console.log(map.id,profile,Object.keys(nav.nodes).length,'nodes',links.length,'offmesh');}}
await mkdir(new URL('../src/navigation/',import.meta.url),{recursive:true});
const packs=Object.fromEntries(Object.entries(output).map(([id,data])=>{
 // Navigation coordinates are stored at micrometre precision. Remove binary
 // float tails before compression; collision/render geometry remains exact.
 const json=JSON.stringify(data,(_key,value)=>typeof value==='number'&&!Number.isInteger(value)?Math.round(value*1e6)/1e6:value),compressed=deflateSync(Buffer.from(json),{level:9}),map=MAPS.find(m=>m.id===id);
 const geometryHash=createHash('sha256').update(JSON.stringify({shapes:mapShapes(map,{dynamic:false}),ladders:map.ladders,lowZones:map.lowZones,character:CHARACTER,low:LOW_CHARACTER,options:Object.values(data).map(p=>p.options)})).digest('hex');
 return [id,{version:1,codec:'deflate',coordinatePrecision:1e-6,geometryHash,bytes:compressed.length,jsonBytes:Buffer.byteLength(json),data:Buffer.from(compressed).toString('base64')}];
}));
const source='// Deterministic baked navigation. Embedded compressed packs; decode only the selected map.\nexport const NAV_PACKS='+JSON.stringify(packs)+';\nexport {loadNavigation} from "./navigation-loader.js";\n';
const target=new URL('../src/navigation/classic-nav.js',import.meta.url);
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==source)throw new Error('Baked navigation differs from current geometry. Run npm run bake:maps and commit the result.');console.log('Navigation geometry fingerprints and compressed data match.');}
else await writeFile(target,source);
