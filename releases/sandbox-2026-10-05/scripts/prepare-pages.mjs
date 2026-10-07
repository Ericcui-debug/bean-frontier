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
fs.writeFileSync(path.join(release,'.gitignore'),'.DS_Store\n');
fs.writeFileSync(path.join(release,'README.md'),`# 豆豆火力岛 · BEAN FRONTIER

第三人称玩具枪战沙盒游戏。自由探索糖果小镇、积木工厂和高地营地，收集三种武器，对战本地 AI，清理三个据点并完成射靶、寻宝、限时清敌挑战。倒下后安全重生，本局武器与目标保留。全部目标完成后可以继续自由探索。

## 在线游玩

[打开游戏](https://ericcui-debug.github.io/bean-frontier/)

支持电脑和手机浏览器。手机点击开始时默认请求横屏全屏；浏览器不支持时回退到普通显示，并提示手动横屏。

## 操作

- 电脑：WASD 移动，点击场景后鼠标转镜头，左键射击，右键精瞄，空格跳跃，Shift 冲刺，R 换弹，1–3 切枪，E 互动，Esc 暂停，F 全屏。
- 手机：左摇杆移动，向前推至外圈冲刺；右侧空白区滑动转镜头，右开火键支持按住射击并拖动瞄准，另有左开火键；点击精瞄切换，独立按钮跳跃、换弹、互动，点击武器栏切枪。暂停设置可调普通镜头及开镜灵敏度。
- 小地图保留地形、自己、任务与补给，不显示敌人位置。敌人血条仅在受击且无遮挡时短暂出现。射手会利用掩体和绕侧推进，失去视线后只搜索最后见到的位置。
- 金色装备台解锁泡泡散射枪和糖果炮，绿色补给恢复生命与弹药；橙色箱子可打碎，粉色爆破桶会连锁爆炸，掩体可遮挡射击与爆炸。
- 每次重新开始都重置岛屿，仅音频开关和镜头灵敏度保存在浏览器本地。没有联网、分屏或建造功能。

## 离线与发布

下载 site/index.html 后用浏览器打开即可离线游玩。全部模型、字体、音乐和音效随包交付，无需下载资源。

本仓库保存经过验证的静态游戏。推送到 main 后，GitHub Actions 自动发布 site/ 到 GitHub Pages。

角色与地图均为原创程序模型；第三方字体与 Three.js 许可见 site/licenses/。
`);
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
