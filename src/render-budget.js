// Limit expensive HDR/MSAA pixels, not texture quality or collision accuracy.
// Retina CSS pixels already carry MSAA; blindly using DPR2 quadruples all passes.
export class RenderBudget {
 constructor(touch=false){this.touch=touch;this.ratio=1;this.min=1;this.max=1;this.ceiling=1;this.reset();}
 resize(width,height,dpr=1){
  const oldMax=this.max,wasAtMax=Math.abs(this.ratio-oldMax)<.001;
  this.max=this.touch?Math.min(1.5,Math.max(1,dpr)):Math.min(dpr||1,1.5,Math.sqrt(2_000_000/Math.max(1,width*height)));
  this.min=Math.min(this.touch?1:.9,this.max);this.ceiling=this.max;
  this.ratio=Math.max(this.min,Math.min(this.max,wasAtMax?this.max:this.ratio));this.reset();return this.ratio;
 }
 restore(){this.ratio=this.max;this.ceiling=this.max;this.reset();}
 reset(){this.warmup=1;this.seconds=0;this.count=0;this.late=0;this.goodWindows=0;}
 observe(seconds,hz=60){
  if(!Number.isFinite(seconds)||seconds<=0||seconds>.25){this.reset();return false;}
  if(this.warmup>0){this.warmup-=seconds;return false;}
  this.seconds+=seconds;this.count++;if(seconds>1/hz*1.25)this.late++;
  if(this.seconds<2)return false;
  const mean=this.seconds/this.count,slow=mean>1/hz*1.14||this.late/this.count>.18;
  let next=this.ratio;
  if(slow){this.ceiling=Math.max(this.min,Math.min(this.ceiling,this.ratio-.0625));next=Math.max(this.min,this.ratio-.125);this.goodWindows=0;}
  else if(mean<=1/hz*1.04&&this.late/this.count<.025){if(++this.goodWindows>=3){next=Math.min(this.ceiling,this.ratio+.0625);this.goodWindows=0;}}
  else this.goodWindows=0;
  this.seconds=0;this.count=0;this.late=0;
  if(Math.abs(next-this.ratio)<.001)return false;this.ratio=next;return true;
 }
}

// Consume refresh callbacks at a stable target rate without the near-deadline
// modulo bug that can produce irregular 60/30 cadence on 59.94/119.88 Hz screens.
export class RenderPacer {
 constructor(){this.reset();}
 reset(){this.pending=0;this.frameDt=0;this.sincePaint=0;}
 advance(seconds,hz=60){
  this.pending+=seconds;this.sincePaint+=seconds;const interval=1/hz,tolerance=.0005;
  if(this.pending+tolerance<interval)return false;
  this.frameDt=this.sincePaint;this.sincePaint=0;
  const consumed=Math.max(1,Math.floor((this.pending+tolerance)/interval));
  this.pending=Math.max(0,this.pending-consumed*interval);return true;
 }
}
