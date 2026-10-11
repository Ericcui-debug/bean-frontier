import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const expected=JSON.parse(fs.readFileSync(process.argv[2]||'site/artifact-manifest.json','utf8'));
const html=fs.readFileSync('Bean-Frontier.html');
assert.equal(html.length,expected.bytes,'Built artifact byte count differs from tested package');assert.equal(createHash('sha256').update(html).digest('hex'),expected.sha256,'Built artifact differs from tested package');assert.ok(html.equals(fs.readFileSync('site/index.html')),'Online and offline single files differ');
console.log('PASS exact tested/online/offline artifact:',expected.sha256);
