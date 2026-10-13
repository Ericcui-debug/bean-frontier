# 4.0 素材与底座来源

直接复用[Tiny Strike固定提交04db555](https://github.com/guyz/tinystrike/tree/04db555c4fc9f43fef3325c37930ad97a0c27aa3)的单人对局、武器、AI、五张地图、建筑装饰、PBR纹理生成、天空和后期系统。Three.js固定为0.166.1；上游代码隔离在`src/upstream/tinystrike/`。适配入口、豆豆模型和触控集中处理。

原项目ISC声明在`licenses/Tiny-Strike-ISC.txt`，其图形系统MIT声明在`licenses/Tiny-Strike-GFX-MIT.txt`。保留原作者声明及上游素材说明。七种枪械由原程序化生成器制作，刀、三种投掷物的原GLB保存在`assets-tinystrike/models/viewmodels/`并由Vite嵌入；校验值见`licenses/asset-manifest.json`。不加载原人类角色或第一人称人类手臂。

豆豆外形、战术服装和第一人称豆豆手臂由本项目生成，统一读取`src/dimensions.js`的80%尺寸。音频由上游WebAudio本地合成，无外部音频下载。中文Noto Sans SC字体已按本版文字子集嵌入，SIL OFL声明随包提供。

所有必要资源随自包含HTML交付。旧3.2.1素材与源码在回退归档中保留，不用于4.0运行时。
