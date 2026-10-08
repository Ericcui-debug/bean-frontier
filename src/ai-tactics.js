// Roles use friendly state, public objectives and map routes only.
export function createTeamTactics(actors,state,world,hostages){
 let signature='',next=0;
 function reset(){signature='';next=0;for(const a of actors){a.teamDuty=null;a.supportId=null;a.hostageAssignment=null;}}
 function update(time){
  const key=actors.filter(a=>a.alive).map(a=>a.id).join(',')+':'+state.phase+':'+state.bomb?.carrierId+':'+hostages.list.map(h=>h.leaderId).join(',');
  if(key===signature&&time<next)return;signature=key;next=time+.65;
  for(const team of [0,1]){
   const living=actors.filter(a=>a.alive&&a.team===team),bots=living.filter(a=>!a.isPlayer),attack=team===state.attackTeam;
   const escorts=world.mode==='rescue'&&team===state.ctTeam?living.filter(a=>hostages.list.some(h=>h.state==='following'&&h.leaderId===a.id)):[];
   const carrier=living.find(a=>a.id===state.bomb?.carrierId),objective=carrier||bots.find(a=>escorts.includes(a))||bots[0];
   const waiting=world.mode==='rescue'&&team===state.ctTeam?hostages.list.filter(h=>h.state==='waiting'):[];
   for(const [i,a] of bots.entries()){
    a.supportId=null;a.hostageAssignment=null;a.formationIndex=i;
    if(world.mode==='rescue'&&team===state.ctTeam&&escorts.length&&a!==objective&&!escorts.includes(a)&&i%2===1){a.teamDuty='escort-cover';a.supportId=escorts[0].id;}
    else if(a===objective||escorts.includes(a))a.teamDuty='objective';
    else if(attack)a.teamDuty=i%3===1?'flank':i%3===2?'cover':'push';
    else a.teamDuty=state.phase==='planted'?(i===0?'objective':i%2?'retake-flank':'retake-cover'):(i%3===2?'reserve':'hold');
    a.routeVariant=a.teamDuty==='flank'||a.teamDuty==='retake-flank'?1:0;
    if(waiting.length)a.hostageAssignment=waiting[i%waiting.length].id;
   }
  }
 }
 return {reset,update};
}
