import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const release=path.join(project,'.pages-release');
fs.mkdirSync(path.join(release,'site/licenses'),{recursive:true});
fs.mkdirSync(path.join(release,'.github/workflows'),{recursive:true});
fs.cpSync(path.join(project,'site'),path.join(release,'site'),{recursive:true});
for(const name of fs.readdirSync(path.join(project,'licenses')))fs.copyFileSync(path.join(project,'licenses',name),path.join(release,'site/licenses',name));
fs.writeFileSync(path.join(release,'site/.nojekyll'),'');
fs.writeFileSync(path.join(release,'.gitignore'),'.DS_Store\nnode_modules/\ndist/\noutput/\n.pages-release/\nBean-Frontier.html\n');
// Ship reviewable source beside the static site, never dependency caches or QA output.
fs.rmSync(path.join(release,'src'),{recursive:true,force:true});
for(const name of ['src','releases','assets-tinystrike'])fs.cpSync(path.join(project,name),path.join(release,name),{recursive:true});
for(const name of ['index.html','package.json','package-lock.json','vite.config.js','ASSETS.md','MAPS.md','MAP-ROUTE-TIMING.md','VERIFICATION.md','OPTIMIZATION.md'])fs.copyFileSync(path.join(project,name),path.join(release,name));
fs.mkdirSync(path.join(release,'scripts'),{recursive:true});
fs.rmSync(path.join(release,'scripts'),{recursive:true,force:true});
fs.mkdirSync(path.join(release,'scripts'),{recursive:true});
for(const name of fs.readdirSync(path.join(project,'scripts')).filter(n=>n.startsWith('v4-')||['fonts.mjs','standalone.mjs','prepare-pages.mjs','web_game_playwright_client.js','check-artifact.mjs'].includes(n)))fs.copyFileSync(path.join(project,'scripts',name),path.join(release,'scripts',name));
fs.cpSync(path.join(project,'licenses'),path.join(release,'licenses'),{recursive:true});

fs.writeFileSync(path.join(release,'README.md'),fs.readFileSync(path.join(project,'README.md'),'utf8').replace('[离线版](Bean-Frontier.html)','[离线版](site/index.html)'));
fs.copyFileSync(path.join(project,'.github/workflows/pages.yml'),path.join(release,'.github/workflows/pages.yml'));
console.log('Prepared public release:',release);
