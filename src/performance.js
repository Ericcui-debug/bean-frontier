// Bounded measurements of this browser run, never a claim about phone hardware.
export function createPerformanceMonitor(){
 const samples=[];let started=0,last=0,renders=0,total=0;const capacity=300;
 function record(now,drawMs){if(!started)started=now;if(last){samples.push({frame:now-last,draw:drawMs});if(samples.length>capacity)samples.shift();}last=now;renders++;total+=drawMs;}
 function reset(){samples.length=0;started=last=renders=total=0;}
 function snapshot(renderer,quality,audio){
  const times=samples.map(s=>s.frame).sort((a,b)=>a-b),draws=samples.map(s=>s.draw).sort((a,b)=>a-b),q=(list,p)=>Math.round((list[Math.min(list.length-1,Math.floor(list.length*p))]||0)*100)/100;
  return {scope:'current browser; physical iPhone unverified',samples:samples.length,frameMs:{p50:q(times,.5),p95:q(times,.95)},renderMs:{p50:q(draws,.5),p95:q(draws,.95)},fps:times.length?Math.round(1000/(times.reduce((a,b)=>a+b,0)/times.length)*10)/10:0,renderQuality:quality,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,activeAudioSources:audio?.status?.().activeEffects??0};
 }
 return {record,reset,snapshot};
}
