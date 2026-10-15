import test from 'node:test';import assert from 'node:assert/strict';import {RenderBudget,RenderPacer} from '../src/render-budget.js';
test('desktop HDR pixel budget caps Retina cost and leaves normal DPR1 intact',()=>{
 for(const [w,h,dpr]of [[1280,720,2],[1470,956,2],[1920,1080,2],[3840,2160,2]]){const b=new RenderBudget();const r=b.resize(w,h,dpr);assert.ok(w*h*r*r<=2_000_001);assert.ok(r<=1.5);assert.ok(r>0);}
 assert.equal(new RenderBudget().resize(1280,720,1),1);
});
test('mobile keeps native MSAA resolution range and large/small screen resize stays bounded',()=>{
 const b=new RenderBudget(true);assert.equal(b.resize(844,390,3),1.5);assert.equal(b.resize(390,844,1),1);assert.equal(b.resize(844,390,3),1.5);assert.ok(b.min>=1);
});
test('adaptive scale ignores startup and pause stalls, downshifts sustained misses and recovers with hysteresis',()=>{
 const b=new RenderBudget();const max=b.resize(1280,720,2);for(let n=0;n<100;n++)b.observe(.008,60);assert.equal(b.ratio,max);
 for(let n=0;n<200;n++)b.observe(1/30,60);assert.ok(b.ratio<max);assert.ok(b.ratio>=1);const low=b.ratio;
 b.observe(2,60);for(let n=0;n<200;n++)b.observe(1/60,60);assert.equal(b.ratio,low);
 for(let n=0;n<500;n++)b.observe(1/60,60);assert.ok(b.ratio>low);assert.ok(b.ratio<=b.max);
});
test('30FPS preference is measured against30 rather than60 and does not downgrade for its own cap',()=>{
 const b=new RenderBudget(true);b.resize(844,390,3);for(let n=0;n<600;n++)b.observe(1/30,30);assert.equal(b.ratio,1.5);
});
test('60FPS pacing handles59.94/60/90/119.88/120/144Hz without alternating surplus frames',()=>{
 for(const refresh of [59.94,60,90,119.88,120,144]){const p=new RenderPacer();let count=0;for(let i=0;i<Math.round(refresh*10);i++)if(p.advance(1/refresh,60))count++;assert.ok(Math.abs(count-600)<=2,`${refresh}Hz -> ${count}`);}
});
test('30FPS pacing, slow refresh and pause do not run a render catch-up burst',()=>{
 for(const refresh of [60,90,120,144]){const p=new RenderPacer();let n=0;for(let i=0;i<refresh*10;i++)if(p.advance(1/refresh,30))n++;assert.ok(Math.abs(n-300)<=1,`${refresh}: ${n}`);}
 const p=new RenderPacer();assert.equal(p.advance(1/15,60),true);assert.equal(p.advance(0,60),false);p.reset();assert.equal(p.advance(1/120,60),false);
});
