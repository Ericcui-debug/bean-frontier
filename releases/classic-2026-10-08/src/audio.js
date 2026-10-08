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
  constructor(){this.musicEnabled=true;this.effectsEnabled=true;this.playing=false;this.stepsScheduled=0;this.step=0;this.timer=null;}
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
  syncGains(){if(!this.ctx)return;const t=this.ctx.currentTime;for(const [gain,value] of [[this.musicGain,(this.musicEnabled&&this.playing) ? .55 : 0],[this.effectsGain,this.effectsEnabled?1:0]]){gain.gain.cancelScheduledValues(t);gain.gain.setTargetAtTime(value,t,.025);}}
  setPlaying(playing){
    this.playing=playing;this.syncGains();if(this.timer){clearInterval(this.timer);this.timer=null;}
    if(playing&&this.ctx){this.nextNote=this.ctx.currentTime+.05;this.tick();this.timer=setInterval(()=>this.tick(),30);}
  }
  tick(){if(!this.ctx||!this.playing||!this.musicEnabled||this.ctx.state!=='running')return;if(this.nextNote<this.ctx.currentTime)this.nextNote=this.ctx.currentTime+.03;
    while(this.nextNote<this.ctx.currentTime+.12){scheduleMusicStep(this.ctx,this.musicGain,this.step++,this.nextNote);this.stepsScheduled++;this.nextNote+=STEP;}
  }
  setMusic(on){this.musicEnabled=on;this.syncGains();if(on&&this.ctx){this.nextNote=this.ctx.currentTime+.03;this.tick();}}
  setEffects(on){this.effectsEnabled=on;this.syncGains();}
  reset(){this.step=0;if(this.ctx)this.nextNote=this.ctx.currentTime+.05;}
  tone(freq=500,duration=.1,type='sine',volume=.045){if(!this.effectsEnabled||!this.ctx||this.ctx.state!=='running')return;voice(this.ctx,this.effectsGain,freq,this.ctx.currentTime,duration,volume,type);}
  status(){return {musicEnabled:this.musicEnabled,effectsEnabled:this.effectsEnabled,playing:this.playing,context:this.ctx?.state||'locked',stepsScheduled:this.stepsScheduled,loopStep:this.step%64};}
}
