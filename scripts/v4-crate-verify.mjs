import{test}from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{buildProp}from'../src/upstream/tinystrike/gfx/kit/props.js';import{Rng}from'../src/upstream/tinystrike/gfx/kit/rng.js';
// Bounds captured from the shipped pre-fix generator, including loose boards.
const cases=JSON.parse(fs.readFileSync(new URL('./v4-crate-baseline.json',import.meta.url)));
test('180 crate variants preserve pre-fix collision bounds, ground anchors and RNG stream',()=>{for(const v of cases){const r=new Rng(v.seed),p=buildProp(v.id,r);assert.deepEqual(p.box.min.toArray(),v.min);assert.deepEqual(p.box.max.toArray(),v.max);assert.equal(p.radius,v.radius);assert.equal(r.float(),v.next);p.geo.dispose();}});
