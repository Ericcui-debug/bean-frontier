# 豆豆火力岛 · BEAN FRONTIER

一款独立的第三人称玩具枪战沙盒游戏。沿用 Bean Blitz 原创豆豆外形，以 Three.js + Vite 制作明亮糖果岛屿。单人对战本地 AI，支持电脑和手机浏览器。

## 打开游戏

- **电脑离线：** 双击 `Bean-Frontier.html`，用现代浏览器打开，无需网络。
- **开发预览：** `npm install` 后运行 `npm run dev`，打开 http://localhost:5180/ 。手机可连接同一局域网后访问终端显示的 Network 地址；也可在支持 HTML 文件的手机浏览器中打开离线文件。
- **构建：** `npm run build` 生成 `dist/` 以及自包含的 `Bean-Frontier.html`。全部模型、字体、音乐和音效在本地；无需下载资源。

## 玩法

从海岸出发，探索糖果小镇、积木工厂与高地营地。清理三个据点，金色旗帜旁开启彩弹打靶、糖果寻宝、限时清敌挑战。拿下全部六项目标后可以继续自由探索和重玩挑战。

开局装备彩弹连射枪，前方左侧装备台可找到泡泡散射枪；糖果炮在工厂的高台上，经黄色坡道上去。三种枪都有弹匣、备用弹药和换弹。小地图的◆是据点、★是挑战、＋是补给、▣是武器。

绿色补给台自动补充生命与所有已取得武器的弹药，每18秒恢复。橙色补给箱可打碎，补充生命与备用弹药；粉色爆破桶会连锁爆炸，伤害附近角色，掩体可以挡住爆炸。粉色跳台可弹射起跳，空中可以移动和射击。

射手会保持距离、利用掩体并绕侧推进，冲锋兵沿不同路线近身攻击。敌人失去视线后只搜索最后见到的位置，约三秒后脱战；敌人被击败后弹散消失。小地图不显示敌人位置，血条仅在受击且无遮挡时短暂出现。据点完成后恢复部分生命并解锁安全重生点。倒下或掉出地图会快速重生，恢复生命和基础弹药，本局取得的武器与目标保留。

**每次重新开始都重置岛屿。** 不保存战斗进度，仅音乐、音效开关与镜头灵敏度保存在浏览器本地。没有联网多人、分屏、建造或资源合成。

## 操作

| 动作 | 电脑 | 手机 |
|---|---|---|
| 移动 | WASD | 左摇杆 |
| 转镜头 | 点击场景后移动鼠标；不支持锁定时按住鼠标拖动 | 右侧空白区滑动 |
| 射击 | 按住左键 | 按住右开火并拖动瞄准；左开火供多指操作 |
| 精瞄 | 按住右键 | 点击精瞄切换 |
| 跳跃 | Space | 跳跃按钮 |
| 冲刺 | Shift | 摇杆向前推至外圈 |
| 换弹 | R | 换弹按钮 |
| 切枪 | 1–3 / 点击武器栏 | 点击武器栏 |
| 互动 | E | 互动按钮 |
| 暂停 | Esc / Ⅱ | Ⅱ |
| 全屏 | F / ⛶ | ⛶（浏览器支持时） |

手机采用经典双指操作：左拇指移动，右拇指按住开火键并拖动瞄准，另有左开火键供多指玩家使用。暂停设置可调普通镜头和开镜灵敏度，开镜默认是普通镜头的60%。手机支持多指同时移动、转镜头与射击，辅助瞄准仅作用于准星附近且无遮挡的敌人，由玩家主动开火。点击出发时默认请求横屏全屏；浏览器允许时自动切换，不支持时提示手动横屏，竖屏仍可操作。浏览器切后台、窗口失焦、触控取消或退出鼠标锁定时自动暂停并清空输入；回来点击继续。

## 开发与验证

模型从原项目复制并独立拆分，固定肩关节和原角色尺寸，持枪与跑跳均通过关节动画实现。地形、碰撞、镜头遮挡及子弹检测共享世界数据；120Hz 固定物理步长，弹丸连续检测。AI 使用包含坡度连接的导航网格。

所有自动化仅连接 `/Users/ericcui/.codex/bin/codex-chrome-start` 管理的专用浏览器，CDP `http://127.0.0.1:9333`，不使用日常 Chrome profile。

```sh
npm test
node scripts/mobile-verify.mjs
node scripts/mobile-dual-verify.mjs
node scripts/terrain-verify.mjs
node scripts/desktop-route.mjs
node scripts/mobile-battle-route.mjs
node scripts/upgrade-final-audit.mjs
node scripts/visual-verify.mjs
node scripts/ai-upgrade-verify.mjs
```

测试报告和截图存放在 `output/`。`window.render_game_to_text()` 返回当前可玩状态；`window.advanceTime(ms)` 提供确定性推进。仅 `?test` 入口暴露可修改状态的辅助接口。

手机自动降低像素比与阴影分辨率；30FPS 为目标，真实手机性能仍需实机确认。音乐为原项目的本地合成原创循环，字体为随包 Noto Sans SC，许可见 `licenses/`。

## GitHub Pages 公网发布

- [在线游玩](https://ericcui-debug.github.io/bean-frontier/)
- [发布仓库](https://github.com/Ericcui-debug/bean-frontier)
- 发布目录 `.pages-release/`，只包含已构建的游戏、许可和部署配置。

更新游戏并验证后发布：

```sh
npm run build
node scripts/offline-smoke.mjs
node scripts/prepare-pages.mjs
git -C .pages-release add site README.md .github/workflows/pages.yml
git -C .pages-release commit -m "Update game"
git -C .pages-release push
```

GitHub Actions 完成后运行 `node scripts/pages-smoke.mjs`，验证公网 HTML 与本地已测试版本字节一致，以及电脑、手机正常开局、音频、操作和重开。可运行 `node scripts/mobile-verify.mjs 'https://ericcui-debug.github.io/bean-frontier/?test'` 检查线上多指触控。
