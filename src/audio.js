// Original 8-bar arcade loop, synthesized locally. No downloads or autoplay dependency.
const MELODY=[
  76,79,81,79,76,72,74,76, 79,76,74,72,74,76,79,null,
  76,81,84,83,81,76,79,81, 84,81,79,76,74,76,81,null,
  77,81,84,81,77,74,76,77, 81,79,77,76,77,81,79,null,
  79,83,86,83,79,77,76,74, 79,77,76,74,72,null,74,79
];
const ROOTS=[48,48,45,45,41,41,43,43];
const CHORDS=[[60,64,67],[60,64,67],[57,60,64],[57,60,64],[53,57,60],[53,57,60],[55,59,62],[55,59,62]];
export const STEP=60/124/2;
const frequency=midi=>440*2**((midi-69)/12);
function voice(ctx,out,freq,t,duration,level,type='triangle',endFrequency=null){
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);
  if(endFrequency)osc.frequency.exponentialRampToValueAtTime(endFrequency,t+duration);
  gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(level,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain).connect(out);osc.start(t);osc.stop(t+duration+.015);
  osc.onended=()=>{osc.disconnect();gain.disconnect();};
}
export function scheduleMusicStep(ctx,out,step,t){
  const n=step%64,bar=Math.floor(n/8),beat=n%8;
  if(MELODY[n]!=null){voice(ctx,out,frequency(MELODY[n]),t,STEP*.85,.085,'triangle');voice(ctx,out,frequency(MELODY[n])*2,t,STEP*.5,.011,'sine');}
  if(beat%2===0)voice(ctx,out,frequency(ROOTS[bar]+(beat===4?7:0)),t,STEP*1.6,.12,'sine');
  if(beat===0||beat===4){voice(ctx,out,130,t,.13,.11,'sine',42);for(const note of CHORDS[bar])voice(ctx,out,frequency(note),t,.28,.022,'triangle');}
  if(beat===2||beat===6){voice(ctx,out,180,t,.095,.048,'triangle',65);voice(ctx,out,2700,t,.055,.012,'square');}
  if(beat%2===1)voice(ctx,out,6200,t,.024,.008,'square');
}
export class GameAudio {
  constructor(){this.musicEnabled=true;this.effectsEnabled=true;this.playing=false;this.stepsScheduled=0;this.step=0;this.timer=null;this.phase='buy';this.voices=new Set();this.buffers=new Map();this.listenerPosition={x:0,y:0,z:0};this.maxEffects=24;}
  async unlock(){
    try{
      if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;this.ctx=new Audio();
        this.master=this.ctx.createGain();this.master.gain.value=.65;
        this.musicGain=this.ctx.createGain();this.effectsGain=this.ctx.createGain();this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=1024;
        this.musicGain.connect(this.master);this.effectsGain.connect(this.master);this.master.connect(this.analyser).connect(this.ctx.destination);
        this.nextNote=this.ctx.currentTime+.04;
      }
      await this.ctx.resume();this.syncGains();return true;
    }catch{return false;}
  }
  syncGains(){if(!this.ctx)return;const t=this.ctx.currentTime;for(const [gain,value] of [[this.musicGain,(this.musicEnabled&&this.playing) ? .55*(this.phase==='buy'?1:.2) : 0],[this.effectsGain,this.effectsEnabled?1:0]]){gain.gain.cancelScheduledValues(t);gain.gain.setTargetAtTime(value,t,.025);}}
  setPlaying(playing){
    this.playing=playing;if(!playing)this.clearEffects();this.syncGains();if(this.timer){clearInterval(this.timer);this.timer=null;}
    if(playing&&this.ctx){this.nextNote=this.ctx.currentTime+.05;this.tick();this.timer=setInterval(()=>this.tick(),30);}
  }
  tick(){if(!this.ctx||!this.playing||!this.musicEnabled||this.ctx.state!=='running')return;if(this.nextNote<this.ctx.currentTime)this.nextNote=this.ctx.currentTime+.03;
    while(this.nextNote<this.ctx.currentTime+.12){scheduleMusicStep(this.ctx,this.musicGain,this.step++,this.nextNote);this.stepsScheduled++;this.nextNote+=STEP;}
  }
  setMusic(on){this.musicEnabled=on;this.syncGains();if(on&&this.ctx){this.nextNote=this.ctx.currentTime+.03;this.tick();}}
  setEffects(on){this.effectsEnabled=on;this.syncGains();}
  setPhase(phase){if(this.phase!==phase){this.phase=phase;this.syncGains();}}
  setListener(camera){if(!this.ctx||!camera)return;camera.getWorldPosition?.(camera.userData.audioPosition??=(camera.position.clone()));const position=camera.userData.audioPosition??camera.position;this.listenerPosition={x:position.x,y:position.y,z:position.z};const l=this.ctx.listener,t=this.ctx.currentTime;const direction=camera.getWorldDirection(camera.userData.audioDirection??=camera.position.clone()),up=camera.up.clone().applyQuaternion(camera.quaternion);if(l.positionX){for(const [key,v] of Object.entries({positionX:position.x,positionY:position.y,positionZ:position.z,forwardX:direction.x,forwardY:direction.y,forwardZ:direction.z,upX:up.x,upY:up.y,upZ:up.z}))l[key].setValueAtTime(v,t);}else{l.setPosition(position.x,position.y,position.z);l.setOrientation(direction.x,direction.y,direction.z,up.x,up.y,up.z);}}
  clearEffects(){for(const v of this.voices){try{v.source.stop();}catch{}v.cleanup();}this.voices.clear();}
  reset(){this.step=0;this.clearEffects();if(this.ctx)this.nextNote=this.ctx.currentTime+.05;}
  reserve(priority){if(this.voices.size<this.maxEffects)return true;let least=null;for(const voice of this.voices)if(!least||voice.priority<least.priority)least=voice;if(least&&least.priority<=priority){try{least.source.stop();}catch{}least.cleanup();return true;}return false;}
  buffer(type,weapon=0,material='stone'){const key=`${type}:${weapon}:${material}`;if(this.buffers.has(key))return this.buffers.get(key);const rate=this.ctx.sampleRate,durations={gun:weapon===3?.32:.16,step:.12,land:.18,reload:.4,ladder:.16,door:.48,impact:.12,objective:.55,explosion:.75},duration=durations[type]??.12,b=this.ctx.createBuffer(1,Math.ceil(rate*duration),rate),data=b.getChannelData(0);let seed=173+weapon*311;for(const c of key)seed=(seed*33+c.charCodeAt(0))>>>0;let smooth=0;for(let i=0;i<data.length;i++){const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/2147483648-1;smooth=smooth*.78+noise*.22;let value=0;if(type==='explosion'){value=(smooth*.9+Math.sin(t*6.283*48*Math.exp(-t*2))*.6)*Math.exp(-t*5);}
else if(type==='gun'){const base=[165,210,135,85][weapon]??150;value=(noise*.45+Math.sin(t*base*6.283*Math.exp(-t*5))*.65)*Math.exp(-t*(weapon===3?15:34));}else if(type==='step'||type==='land'){value=(smooth*.65+Math.sin(t*(type==='land'?76:105)*6.283)*.4)*Math.exp(-t*28);}else if(type==='reload'){const pulse=Math.exp(-Math.max(0,t-.005)*95)*(t>=.005)+Math.exp(-Math.max(0,t-.16)*110)*(t>=.16)+Math.exp(-Math.max(0,t-.31)*90)*(t>=.31);value=(noise*.7+Math.sin(t*6300)*.3)*pulse*.45;}else if(type==='objective'){value=Math.sin(t*6.283*(t<.2?660:880))*Math.sin(Math.PI*t/duration)*.6;}else if(type==='door'){value=(smooth*.65+Math.sin(t*190)*.15)*Math.sin(Math.PI*t/duration);}else{const metal=/metal|steel/.test(material)||type==='ladder',wood=/wood|crate/.test(material),sand=material==='sand';value=((sand?smooth:noise)*.65+Math.sin(t*(metal?2800:wood?450:900)*6.283)*.35)*Math.exp(-t*(metal?25:sand?55:40))*(sand?.55:1);}data[i]=Math.max(-1,Math.min(1,value));}this.buffers.set(key,b);return b;}
  effect(event,{occluded=false}={}){if(!this.effectsEnabled||!this.ctx||this.ctx.state!=='running')return false;const p=this.listenerPosition,distance=Math.hypot(event.x-p.x,event.y-p.y,event.z-p.z),radius=event.radius??30;if(distance>radius+8)return false;const priority=(event.priority??(event.type==='objective'||event.type==='explosion'?100:event.type==='gun'?50:20))+35/(1+distance);if(!this.reserve(priority))return false;const ctx=this.ctx,source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),pan=ctx.createPanner();source.buffer=this.buffer(event.type,event.weapon,event.material);pan.panningModel='HRTF';pan.distanceModel='inverse';pan.refDistance=2;pan.maxDistance=radius;pan.rolloffFactor=1.15;pan.positionX.value=event.x;pan.positionY.value=event.y;pan.positionZ.value=event.z;filter.type='lowpass';filter.frequency.value=occluded?850:18000;const volume={gun:.25,step:.12,land:.18,reload:.13,ladder:.12,door:.17,impact:.13,objective:.26,explosion:.45}[event.type]??.12;gain.gain.value=volume*(occluded?.45:1);source.connect(filter).connect(pan).connect(gain).connect(this.effectsGain);const v={source,priority,pan,filter,event:{type:event.type,x:event.x,y:event.y,z:event.z},cleanup:()=>{this.voices.delete(v);source.disconnect();filter.disconnect();pan.disconnect();gain.disconnect();}};this.voices.add(v);source.onended=v.cleanup;source.start();return true;}
  tone(freq=500,duration=.1,type='sine',volume=.045){if(!this.effectsEnabled||!this.ctx||this.ctx.state!=='running'||!this.reserve(100))return;const ctx=this.ctx,source=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime;source.type=type;source.frequency.value=freq;gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(gain).connect(this.effectsGain);const v={source,priority:100,cleanup:()=>{this.voices.delete(v);source.disconnect();gain.disconnect();}};this.voices.add(v);source.onended=v.cleanup;source.start(t);source.stop(t+duration+.015);}
  update(){for(const v of this.voices)if(v.ended)v.cleanup();}
  status(){return {musicEnabled:this.musicEnabled,effectsEnabled:this.effectsEnabled,playing:this.playing,context:this.ctx?.state||'locked',stepsScheduled:this.stepsScheduled,loopStep:this.step%64,phase:this.phase,musicLevel:this.phase==='buy'?1:.2,activeEffects:this.voices.size,maxEffects:this.maxEffects,cachedEffects:this.buffers.size};}
}
