import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const release=path.join(project,'.pages-release');
fs.mkdirSync(path.join(release,'site/licenses'),{recursive:true});
fs.mkdirSync(path.join(release,'.github/workflows'),{recursive:true});
fs.copyFileSync(path.join(project,'Bean-Frontier.html'),path.join(release,'site/index.html'));
for(const name of fs.readdirSync(path.join(project,'licenses')))fs.copyFileSync(path.join(project,'licenses',name),path.join(release,'site/licenses',name));
fs.writeFileSync(path.join(release,'site/.nojekyll'),'');
fs.writeFileSync(path.join(release,'.gitignore'),'.DS_Store\nnode_modules/\ndist/\noutput/\n.pages-release/\nBean-Frontier.html\n');
// Ship reviewable source beside the static site, never dependency caches or QA output.
for(const name of ['src','releases'])fs.cpSync(path.join(project,name),path.join(release,name),{recursive:true});
for(const name of ['index.html','package.json','package-lock.json'])fs.copyFileSync(path.join(project,name),path.join(release,name));
fs.mkdirSync(path.join(release,'scripts'),{recursive:true});
for(const name of fs.readdirSync(path.join(project,'scripts')).filter(n=>n.startsWith('bomb-')||['fonts.mjs','standalone.mjs','offline-smoke.mjs','pages-smoke.mjs','prepare-pages.mjs','web_game_playwright_client.js'].includes(n)))fs.copyFileSync(path.join(project,'scripts',name),path.join(release,'scripts',name));
fs.cpSync(path.join(project,'licenses'),path.join(release,'licenses'),{recursive:true});

fs.writeFileSync(path.join(release,'README.md'),fs.readFileSync(path.join(project,'README.md'),'utf8').replace('[离线版](Bean-Frontier.html)','[离线版](site/index.html)'));
fs.writeFileSync(path.join(release,'.github/workflows/pages.yml'),`name: Deploy game to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: github-pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout release
        uses: actions/checkout@v6
      - name: Configure Pages
        uses: actions/configure-pages@v5
      - name: Upload website
        uses: actions/upload-pages-artifact@v4
        with:
          path: site
      - name: Publish website
        id: deployment
        uses: actions/deploy-pages@v4
`);
console.log('Prepared public release:',release);
