# 素材来源与授权

## Tiny Strike 原创武器与程序纹理

固定来源版本：[guyz/tinystrike @ 04db555c4fc9f43fef3325c37930ad97a0c27aa3](https://github.com/guyz/tinystrike/tree/04db555c4fc9f43fef3325c37930ad97a0c27aa3)。项目原创武器 GLB 与 `src/world/textures.js` 采用 ISC 授权；完整许可保存在 `licenses/TinyStrike-ISC.txt`，上游素材声明保存在 `licenses/TinyStrike-ASSETS-upstream.md`。

直接复用 Glock、MP5、AK47、AWP 四个原创 GLB，不包含 Quaternius 衍生人物或手臂，也未引入上游重型 GPU 材质、天空或后期管线。原始文件保存在 `src/assets/tinystrike/`；`src/assets/tinystrike-inline.js` 是同一字节的 Base64 嵌入版本，供离线单文件使用。角色及第一人称豆豆手臂仍由本项目生成。

纹理模块保持上游原始字节；本项目通过 `src/visual/surfaces.js` 直接调用墙面、地面、木箱与金属生成函数，并使用 Three.js 标准材质及轻量 UV 重复参数。

| 本地素材 | 原始字节 | SHA-256 |
| --- | ---: | --- |
| `src/assets/tinystrike/glock.glb` | 78684 | `062b5f7a6abb4befd3370fc03fc3a4f559799a8bcad1c843b5775acb9f9cfc34` |
| `src/assets/tinystrike/mp5.glb` | 78596 | `ed1aa2c4b3fe973dbd1e29bc208762564f7c3ddf17751d75d4c09fab0109ac92` |
| `src/assets/tinystrike/ak47.glb` | 77928 | `10cb53dc7af80ecc6737d257026e14c808868f88db206c049e172b5048280886` |
| `src/assets/tinystrike/awp.glb` | 139200 | `969843cecb93d114b162b7847aaf8fa688b1a561b24e4ce89f99ee5fd5088fed` |
| `src/visual/tinystrike-textures.js` | 19019 | `1de758464c29f93f4c2ebdbfa541ed5b54d2aec430af9c1db41b302e640ccc1c` |

可机读来源和校验值见 `licenses/asset-manifest.json`。构建包中的武器数据无需网络请求。

## 本项目角色与音效

豆豆形体、表情、动作、战术背心、阵营徽记、持枪适配和本地合成音效由本项目生成。没有打包商业游戏的地图二进制、原贴图或音效；经典布局由新代码重绘。

## Three.js

Three.js 及其 GLTFLoader 使用 MIT 许可，既有许可随 `licenses/` 交付。

## 3.1 本地原创补充

新增木门板纹理、墙面装饰、队伍服装、袖口／手套及枪声、脚步、换弹、落地、梯子、门、材质命中、目标提示与爆炸音效均为本项目代码生成。音频在浏览器本地缓存，不引用 CS 原音效，不增加外部下载或第三方素材。原 Tiny Strike 木箱纹理与四种枪械 GLB 的来源和许可保持不变。
