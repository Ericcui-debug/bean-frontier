const NS='http://www.w3.org/2000/svg';
export function createMinimap(container){
 const svg=document.createElementNS(NS,'svg'),base=document.createElementNS(NS,'g'),markers=document.createElementNS(NS,'g');svg.append(base,markers);container.replaceChildren(svg);
 const nodes=new Map();let key='',pixelWidth=155,pixelHeight=142;
 const measure=()=>{const r=container.getBoundingClientRect();if(r.width>0&&r.height>0){pixelWidth=r.width-2;pixelHeight=r.height-2;}};measure();const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null;observer?.observe(container);
 function marker(id,type,attributes){let node=nodes.get(id);if(!node||node.tagName!==type){node?.remove();node=document.createElementNS(NS,type);node.dataset.marker=id;nodes.set(id,node);markers.append(node);}node.style.display='';for(const [name,value] of Object.entries(attributes))node.setAttribute(name,value);return node;}
 function update(world,game){
  const b=world.bounds,w=b.x1-b.x0,h=b.z1-b.z0,p=game.player.alive?game.player:(game.actors.find(a=>a.id===game.state.spectateId)||game.player),rescue=world.mode==='rescue';
  const next=`${world.id}:${world.loaded}:${Math.floor(p.y/1.6)}:${world.navigationRevision??0}:${pixelWidth}:${pixelHeight}`;
  if(next!==key){key=next;const fontSize=Math.max(11,11/Math.min(pixelWidth/(w+2),pixelHeight/(h+2)));svg.setAttribute('viewBox',`${b.x0-1} ${b.z0-1} ${w+2} ${h+2}`);let html=`<rect x="${b.x0}" y="${b.z0}" width="${w}" height="${h}" fill="${rescue?'#9aab9f':'#dcc8a0'}"/>`;
   for(const s of world.solids)if(s.active&&!['floor','trim','roof','deck','rail','grille','door'].includes(s.type)&&s.y0<p.y+1.6&&s.y1>p.y+.25)html+=`<rect x="${s.x0}" y="${s.z0}" width="${s.x1-s.x0}" height="${s.z1-s.z0}" fill="#596b65"/>`;
   for(const site of rescue?[]:world.sites??[])html+=`<circle cx="${site.x}" cy="${site.z}" r="5" fill="${site.id==='A'?'#e5a064':'#82b4bb'}"/><text x="${site.x}" y="${site.z+4.5}" text-anchor="middle" fill="#26383d" style="font-size:${fontSize}px" font-weight="900">${site.id}</text>`;
   for(const zone of world.rescueZones??[])html+=`<circle cx="${zone.x}" cy="${zone.z}" r="${zone.radius??3}" fill="#dbdf9b"/><path d="M${zone.x-2} ${zone.z}h4 M${zone.x} ${zone.z-2}v4" stroke="#26383d" stroke-width="1.2"/>`;
   if(rescue)for(const home of world.hostageSpawns??[])html+=`<circle cx="${home.x}" cy="${home.z}" r=".8" fill="#e7eaa2"/>`;
   base.innerHTML=html;
  }
  for(const node of nodes.values())node.style.display='none';
  for(const a of game.actors)if(a.alive&&a.team===game.player.team&&a!==p)marker('ally-'+a.id,'circle',{cx:a.x,cy:a.z,r:1,fill:'#397ab2',stroke:'#fff','stroke-width':.3});
  if(rescue&&game.player.team===game.state.ctTeam)for(const hostage of game.state.hostages??[])if(hostage.state==='following'&&game.actors.some(a=>a.id===hostage.leaderId&&a.team===p.team))marker('hostage-'+hostage.id,'circle',{cx:hostage.x,cy:hostage.z,r:.7,fill:'#e7eaa2'});
  marker('player','path',{d:'M0-2.2L1.5 1.4 0 .7-1.5 1.4Z',transform:`translate(${p.x} ${p.z}) rotate(${game.camera.state.yaw*180/Math.PI})`,fill:'#fff',stroke:'#26383d','stroke-width':.4});
  const bomb=game.state.bomb;if(bomb?.planted)marker('bomb','circle',{cx:bomb.x,cy:bomb.z,r:1.4,fill:'#ef9860'});else if(bomb&&bomb.carrierId==null&&bomb.x!=null)marker('bomb-drop','rect',{x:bomb.x-.6,y:bomb.z-.6,width:1.2,height:1.2,fill:'#ef9860'});
 }
 return {update,reset(){key='';},dispose(){observer?.disconnect();nodes.clear();svg.remove();}};
}
