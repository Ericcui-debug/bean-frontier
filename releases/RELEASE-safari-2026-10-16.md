# 豆豆火力岛：Safari长按防护

公开名称无版本号，内部构建4.0.3。

首屏明确禁止游戏文字选择、长按弹窗和拖拽；游戏事件防护不重复派发动作，不拦截实际表单或购买滚动。意外选区清空并暂停，触控中断先取消投掷再清空所有输入；必须点击继续。手机默认60FPS与已保存偏好不变，没有每帧选区/布局扫描。

本地纯逻辑106项、构建浏览器167项、离线86项全部通过，离线HTTP请求0；补充普通生产入口11项及桌面真实右键4项通过，浏览器错误0。云端桌面、手机、离线完整矩阵与Pages部署全部成功，原网址追加36项验证通过（正常入口11、多点触控25）；浏览器错误0。实体iPhone Safari的原生复制菜单仍待实机确认。

回退：Bean-Frontier-pre-safari-2026-10-16.html及Bean-Frontier-source-pre-safari-2026-10-16.tar.gz。

当前测试包：{"version": "4.0.3", "bytes": 2176845, "gzipBytes": 642804, "sha256": "0320c024a282291737642515a7cd390da96a5857aa85b7b6941a6795d60dc6ca"}

源码提交：`b7b25fef3caa06c82bb2da08862c6936e32a7f91`；最终源码包`Bean-Frontier-source-safari-2026-10-16.tar.gz`，SHA-256 `55a97717dc07f6e316fbb59e18d52615b36ca28ffb839a9bd1220c0f01ec2a05`。

## 发布完成

[CI与部署](https://github.com/Ericcui-debug/bean-frontier/actions/runs/38863826994)全部成功。[原网址](https://ericcui-debug.github.io/bean-frontier/)正常页面与本地测试HTML逐字节一致，SHA-256 `0320c024a282291737642515a7cd390da96a5857aa85b7b6941a6795d60dc6ca`。已打开公网站暂停恢复与手机操作截图。实体iPhone Safari原生长按复制菜单仍需实机复测，浏览器仿真不替代该结论。

完整机器记录：`output/safari-guard/release-verification.json`。
