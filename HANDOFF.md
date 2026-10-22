# 开发交接

只记录当前状态；历史看 git log 或 [历史归档](docs/HANDOFF-ARCHIVE.md)。需求以最新用户要求和实际代码为准。

## 当前状态（2026-10-22）

- 版本 1.0.0，当前开发分支 `feature-claude`；本次交接对应该分支最新提交，提交号以 `git log -1` 为准。默认形象已从 Q 版站姿改为用户确认的 **2D 单手托腮克劳德**，不再使用 3D 手办方向。原图与风格参考保存在 `design/luna-2d/`；旧素材只作历史保留。
- 应用使用 `assets/luna-2d/idle.webp`：384×292/帧，12 列，192 帧，24 FPS，8 秒顺序循环，约 5.4 MB。眨眼、耳朵轻抖、缓慢摆尾；手、嘴和托腮姿势固定。默认显示 256×194⅔ DIP，保留透明边缘和原比例，耳朵与尾巴完整，窗口默认 280×640；放大时窗口宽度随人物增大。
- 用户要求删除连续戳触发生气及消失的功能：已移除点击计数、两阶段升级、生气/返回台词、隐藏计时器、前后端操作锁、相关 IPC 与提醒暂停；删除 `anger-interaction.js`、旧专项检查和测试。点击始终只给普通反应；头部开心、胸部害羞、手臂单眼眨眼，没有姿势素材时用待机加小跳。只判定可见的三个部位，托腮手优先，尾巴、透明处和未显示的下半身不触发。
- 软件名称已改为 **Claude／克劳德**（小克）：窗口、帮助、系统托盘、EXE 资源和安装配置统一；默认角色名迁移为克劳德，自定义名字保留。原数据继续使用旧 `LunaPet` 用户目录，内部桥接/素材路径暂保留兼容名称，不会丢失收藏和提醒。程序图标用新 2D 托腮头像；托盘用同款十四瓣花饰。图标由现有素材确定性导出，无新增生成或运行时联网。
- 鼠标悬停人物非透明像素，滚轮上放大、下缩小，范围 60%–180%，每档 10%，`petScale` 本地持久保存。主进程校验输入，窗口宽度、气泡高度与贴边恢复适配；面板和按钮不放大。
- 任务栏预览关闭或 Alt+F4 隐藏主窗口及大收藏夹并收起任务栏按钮，进程与花饰托盘继续运行；双击托盘恢复，只有明确退出才终止应用。
- 收藏夹、截图/录屏、提醒、左右贴边、纯净模式、中英文、空闲休息、音效、右键功能转盘与陪伴互动保留。日期/天气/占用读取暂无点击入口。换装、打字聊天、AI 和旧 API Key 均已移除，不要恢复。
- 便携版输出在仓库同级 `Claude-Windows/`；本轮构建与验证结果见下节。安装包和真实安装目录本轮未升级，不代表包含新形象或本轮删减。

## 本轮验证与分发

- `npm test`：115/115 通过，覆盖缩放上下限/非法值/存储、旧默认名迁移与自定义名保留、托盘花饰与多尺寸 ICO、连续点击反馈、部位判定、图集布局和八秒播放时序，以及现有接口、存储、窗口生命周期等测试。
- `npm run format` 与 `npm run format:check`：通过（通过缓存的 Prettier 3.9.9 执行）。
- 源码完整 `--smoke-test`：本轮通过，退出码 0；新增原生滚轮、透明处不缩放、60%/180% 限制、气泡随高度、放大后贴边收起/展开、控件不缩放、原生关闭到后台和恢复检查；现有收藏、截图/录屏、提醒、多语言、纯净模式、生命周期检查全部通过。此前旧检查的小花/剪贴板偶发问题仍见下节。
- `tests/app-branding-smoke.cjs`：Windows 原生 ICO 解码和托盘花饰 bitmap/PNG 透明度、颜色检查通过。
- `node build-portable.cjs`：成功，新输出 `Claude-Windows/Claude.exe`，已启动供用户体验。打包版 `--smoke-test --appearance-test` 通过，退出码 0；本轮安装配置已改名但安装包未重建，旧 `LunaPet-Windows` 目录不会自动删除。EXE 资源、ICO 与新名称已核对，关键运行文件和图标的哈希与源码一致。
- 透明动画源文件在 `design/luna-2d/idle/`，包含透明基础图、闭眼参考、局部网格/贴片脚本、导出脚本、WebP、GIF/MP4 预览、采样图和 `verification.json`。已检查 alpha、外边框透明、首尾一致及全帧手/嘴固定。完整 PNG 帧和 APNG 母版被忽略，可按该目录 README 重建。

## 代码结构与继续开发

- `main.js`：窗口、托盘、IPC、纯净模式和模块装配；`desktop-smoke.js` 按需载入，使用 `live` getter/setter 访问运行中状态。
- `character.js`/`character-assets.js`：透明图集播放器与姿势表，缺失姿势回退待机，休息时减速，减少动态效果时停第一帧。`body-shortcuts.js`：画面部位多边形和无状态普通反应；`pet-size.js`：共享缩放限制，`edge-dock.js` 接受动态窗口宽度。
- `renderer.js`、`pet-feedback.js`、`shortcut-bubbles.js`：界面、反馈和信息读取；`life.js`：本地陪伴决策，时钟和随机数可注入，smoke 暂停真实主动发言以免干扰断言。
- `collection.js`/`library.*`：收藏与预览；`screenshot*`、`recording*`/`native-recording.js`、`reminder*`：独立工具窗口；`core.js`：状态迁移和校验；其他模块见 README。
- 只使用本次授权的功能范围；ROADMAP 的候选项不代表已经授权开发。新增姿势遵循 [素材规范](CHARACTER-ASSETS.md)，不自行更换人物形象。
- 换机接续先检查本地改动，执行 `git fetch origin` → `git switch feature-claude` → `git pull --ff-only`。新电脑使用 Node.js 22.12+，再执行 `npm ci` → `node node_modules/electron/install.js` → `npm start`；详见 CROSS-COMPUTER.md。原图、动画源代码与运行图集均随 Git 同步，便携包需本机重新构建；不要依赖本机用户名、绝对路径或聊天历史。
- 单元测试 `npm test`；完整桌面检查 `node_modules/electron/dist/electron.exe . --smoke-test`。专项可加 `--appearance-test`（滚轮/边缘/后台专项）、`--character-test`、`--pure-mode-test`、`--edge-dock-test`、`--recording-live-test`、`--stats-live-test`，旧生气专项参数已移除。启动 Electron 子进程时清除继承的 `ELECTRON_RUN_AS_NODE`。
- 异步窗口回调和 IPC 保留存活检查。维持 contextIsolation、sandbox 和受限 preload；动态文字不用 HTML 注入。新界面文字加入本地 `translations.js`。

## 构建与发布

- `node build-portable.cjs` → 仓库同级 `Claude-Windows/`；`node build-installer.cjs` → `Claude-Release/`。打包前关闭本项目正在运行的便携版，避免文件锁，不要结束其他项目进程。
- 便携构建显式列举运行时文件，新增文件需更新清单；assets 整体复制。构建会清除旧包中已退休的生气脚本。
- `prepare-build-tools.cjs` 固定并校验 rcedit、Inno Setup 和 FFmpeg。FFmpeg 使用 8.0.1；较新版本的 NVENC 要求可能超过当前显卡驱动。GPL 分发说明见 FFMPEG-NOTICE.md，公开分发仍需提供相应源码。
- 不提交依赖、便携包、个人 state.json 或凭据；推送前查看清单和差异，不强推，不覆盖其他电脑工作。

## 已知问题与未验证项

- 完整 smoke 中纯净模式小花转盘布局/焦点断言曾偶发失败；旧检查还曾遇到系统剪贴板被占用、视频全屏等待不结束、末尾贴边移动超时。用户手动使用未反馈这些问题。本轮不扩大范围修改这些流程；最终完整检查结果记录在上节。
- 多显示器/混合 DPI、长时间/高负载录屏、真实外部应用拖放、与 Bandicam 同场景画质对比仍未人工全面验收。模拟供应商接口不能代表真实联网成功。
- 只含文字/网址、无真实文件列表的剪贴板来源无法收藏视频。150% DPI 有像素量化误差，布局断言需允许 1 DIP 或物理像素。
- 没有代码签名、自动更新和 LICENSE 文件。退出时偶见 Chromium GPU 日志，以检查退出码为准。

## 明确的下一步

1. 根据用户使用 Claude／克劳德缩放与后台行为的反馈调整；台词和其他交互本轮未改写，用户后续会明确重做要求。已删除的生气/消失功能保持移除。
2. 若继续处理完整 smoke 的既有问题，先记录纯净模式小花转盘的焦点、布局和窗口高度再定位；不要把专项通过当作完整通过。
3. 其他姿势、日期/天气/占用动画及结构整理等候选方向，等待用户明确选择后再做。
