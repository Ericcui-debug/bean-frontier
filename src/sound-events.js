// Hearing is simulation data, independent of audio permission, volume or mute.
export function createSoundEvents({getTime=()=>0,audio,world}={}){
 let sequence=0;const events=[];
 const radius={gun:42,step:13,land:18,reload:9,ladder:12,door:23,impact:17,objective:60,explosion:90};
 function publish(data){const event=Object.freeze({...data,id:++sequence,at:Number.isFinite(data.at)?data.at:getTime(),x:Number(data.x)||0,y:Number(data.y)||0,z:Number(data.z)||0,radius:data.radius??radius[data.type]??14});events.push(event);while(events.length>128||events[0]?.at<event.at-3)events.shift();const obstruction=audio?.listenerPosition&&world?.blocked?.(audio.listenerPosition,event);audio?.effect?.(event,{occluded:!!obstruction&&(obstruction.t==null||obstruction.t<.98)});return event;}
 return {publish,recent(since=0,team){const now=getTime();return events.filter(e=>e.id>since&&e.at>=now-3&&(team==null||e.team===team)).map(e=>({...e}));},reset(){events.length=0;},get count(){return events.length;},get sequence(){return sequence;}};
}
