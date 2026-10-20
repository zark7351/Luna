# 开发交接

本文件只记录**当前状态**，保持精简（建议不超过约 10 KB）。每次工作后更新「当前状态」「已知问题」「最近一次工作」「下一步」，不要逐轮追加流水；需要追溯时看 git log 或 [docs/HANDOFF-ARCHIVE.md](docs/HANDOFF-ARCHIVE.md)（2026-10-09 之前的逐轮记录，含已过期内容）。

## 当前状态（2026-10-20）

- 版本 1.0.0。main 是已发布的 1.0.0（feature/liveliness 已于 2026-10-20 合并进 main）。**分支 `feature-claude`** 在把角色换成 Q 版虎纹猫耳露娜（见「最近一次工作」），尚未打包。功能见 README.md；需求方向见 ROADMAP.md。
- 已实现：Q 版待机动画（feature-claude）＋按姿势切换的播放器；点身体部位只播反应动画；收藏夹（文本/链接卡片/文件引用/媒体）；截图（Ctrl+Alt+A）；FFmpeg 原像素区域录屏（NVENC，失败回退 x264）；提醒；日期/系统占用/天气读取（暂无显示入口）；生气两阶段互动；左右贴边收起；纯净模式（只显示头上小花，点花开转盘）；关闭到托盘；中英文；空闲自动休息；UI 音效；右键功能转盘；陪伴互动。换装已移除。
- 便携版 `LunaPet-Windows/` 和安装包 `LunaPet-Release/LunaPet-1.0.0-Setup.exe`（都在仓库同级，未签名）已于 2026-10-12 基于 main 提交 `faab101` 重新构建，包含整理后的代码、独立 `desktop-smoke.js` 及当前全部功能。安装包 SHA256：04882f82ba5c76a02183bd1f00a344eff1c5a422181beb5b91dd7b32a3b89a32，SHA256SUMS.txt 已更新。真实安装目录未升级；包内交接为构建快照，最终验证看仓库本文件。
- 打字聊天、AI、旧 API Key 均已移除，不要恢复（见 AGENTS.md）。

## 代码结构速览

- `main.js`：主进程（约 1180 行），包括窗口、托盘、IPC 注册、纯净模式、生气状态机。
- `desktop-smoke.js`：`--smoke-test` 完整集成检查（约 1350 行，大量以模板字符串形式注入渲染进程执行的代码）。由 `main.js` 在 smoke 模式下按需 require，并传入一个上下文对象：稳定的对象和函数直接传值，运行中会变化的状态（`state`、`libraryWin`、`angerPhase`、`trayMenu`、`captureShortcut`、`systemStats`、两个假时钟）用 getter/setter 读写，脚本里写作 `live.xxx`。它会随便携版一起打包，安装版 smoke 也要用到。
- 主进程模块：`core.js`（状态默认值/校验/迁移、窗口尺寸常量）、`collection.js`、`reminders.js`/`reminder-alerts.js`、`screenshot.js`、`recording.js`/`native-recording.js`（FFmpeg）、`edge-dock.js`、`idle.js`、`weather.js`、`system-stats.js`、`link-preview.js`、`media.js`（luna-media 协议）、`file-actions.js`、`app-branding.js`、`sound-events.js`/`effect-events.js`、`i18n.js`＋`translations.js`。
- `life.js`：陪伴互动的决策逻辑（问候、欢迎回来、休息/深夜提醒、自言自语、眨眼节奏、拖动反应、每日计数），注入时钟和随机数，可单元测试；`renderer.js` 负责定时器（每 30 秒 `tick`）、安静条件 `lifeCanSpeak` 和说话 `lifeSay`；主进程只通过 `life-memory` IPC 保存校验过的 `state.life`。smoke 模式下 `publicState().lifePaused` 为 true，真实引擎不说话，避免干扰气泡断言；专项检查在 `life-smoke.js`，用假时钟单独创建实例。
- 渲染进程：`index.html`＋`renderer.js`（宠物主界面）、`character.js`/`character-assets.js`（Q 版姿势图集与播放）、`anger-interaction.js`、`body-shortcuts.js`、`pet-feedback.js`/`shortcut-bubbles.js`（气泡）、`library.*`（收藏夹）、`recording*`/`reminder*`/`screenshot*`（各自窗口与 preload）。
- 根目录其他 `*-smoke.js` 是被 `desktop-smoke.js` 调用的专项检查；`tests/*.test.js` 是单元测试，`tests/*-smoke.cjs` 是安装包/联网/录屏分辨率等独立检查。
- `design/`：素材生成提示词、原图与导出脚本（只做保留 alpha 的导出，不重绘）。

## 开发与验证

- 新电脑：`npm ci` → `node node_modules/electron/install.js` → `npm start`（详见 CROSS-COMPUTER.md）。
- 单元测试：`npm test`（当前 116 项）。没装 Node.js 时可用 Electron 自带的 Node：`ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe --test tests/*.test.js`（bash 写法）。注意这个环境变量会传给子进程：跑 `tests/installer-smoke.cjs` 这类会启动 LunaPet.exe 的脚本时，要先在脚本进程里删除它，例如 `electron.exe -e "delete process.env.ELECTRON_RUN_AS_NODE; require('./tests/installer-smoke.cjs')"`，否则 LunaPet.exe 也会以 Node 模式启动，报 `bad option: --smoke-test`。
- 桌面集成检查：`node_modules/electron/dist/electron.exe . --smoke-test`，约 2 分钟，退出码 0 为通过，结果写入被忽略的 smoke-result.json。可加专项参数：`--capture-debug`、`--pure-mode-test`、`--edge-dock-test`、`--anger-sequence-test`、`--recording-live-test`（真实桌面录制）、`--stats-live-test`（真实 CPU/内存/GPU）。`--anger-preview` 让本次启动第一次必定触发生气，便于人工预览。
- 安装包检查：`node tests/installer-smoke.cjs`（隔离安装→安装版 smoke→重复安装→卸载），`--package-only` 只做文件一致性。
- 代码格式：Prettier 3.9.9（`.prettierrc.json`）。提交前执行 `npm run format`，或用 `npm run format:check` 检查。Markdown、assets、installer、package-lock 不参与格式化。
- 当前终端没有 npm 命令，node_modules 尚未安装 Prettier；本轮未运行 npm ci 或格式检查。Prettier 的锁文件条目此前手工写入（integrity 已对照 npm registry 校验），需要在有 npm 的环境中执行 npm ci 确认。

## 构建与发布

- 便携版 `node build-portable.cjs` → 仓库同级 `LunaPet-Windows/`；安装包 `node build-installer.cjs` → 仓库同级 `LunaPet-Release/`，并更新 SHA256SUMS.txt。打包前先从托盘退出正在运行的便携版，避免文件锁。
- 便携版文件清单是 `build-portable.cjs` 里写死的数组，新增运行时文件必须加进去。
- `prepare-build-tools.cjs` 下载固定版本的 rcedit、Inno Setup、FFmpeg 到被忽略的 `.build-tools/` 并校验 SHA256。FFmpeg 固定 8.0.1：更新版本需要 NVENC 13.1（驱动 610+），开发机的 581 驱动不兼容。某些电脑 PowerShell Archive 模块加载失败，此时用 .NET ZIP 解压到同一缓存目录。
- FFmpeg 是 GPL 构建（含 x264），条款见 FFMPEG-NOTICE.md。公开分发前需要提供对应源码；目前只做本地分发。

## 已知问题与未验证项

- 未人工验收：多显示器/混合 DPI 下拖动、贴边和录屏选框；长时间录制和高负载 4K；与 Bandicam 同场景画质对比；资源管理器、浏览器、微信、飞书的真实拖放和粘贴来源。
- 只给文字或网址、没有真实文件列表的剪贴板来源（如部分微信、飞书、网页）无法收藏视频。
- 150% DPI 下 Chromium 按物理像素量化，窗口尺寸和边框断言要允许 1 DIP 或 1 个物理像素的误差。
- 完整 smoke 末尾的贴边恢复偶尔出现 `native edge test move timed out`；本轮完整检查未复现。可以单独用 `--edge-dock-test` 诊断。
- 退出时出现 Chromium `GPU state invalid` 日志不影响结果，以退出码为准。
- 检查脚本的稳定性（2026-10-18）：模拟输入拿不到 Windows 前台焦点，转盘会因窗口失焦按设计收起，所以 wheel-smoke 里的 openNatively/clickSector 会重试右键，没有系统焦点时也放宽了焦点断言；收藏夹检查结束时会等列表刷新完再继续，避免后面的视频全屏请求拿到已被替换的元素。最后一轮验证：源码完整 smoke 2 次加三个专项检查全部通过，打包版完整 smoke 2 次通过；第 3 次卡在原有的“收藏夹视频进入全屏”步骤（awaited requestFullscreen 没有超时，约 16 分钟无进展，已手动结束）。原因未查明，可能与当时用户在用电脑有关；下次可以给这一步加超时和日志后再复现。
- 没有代码签名、自动更新和 LICENSE 文件。

## 开发注意事项

- 新界面文字加入 `translations.js` 并通过 `lunaI18n` 渲染；名字、昵称、收藏和提醒正文等用户数据不翻译。
- 新姿势按 CHARACTER-ASSETS.md 出素材，用 `design/chibi/build-atlas.py` 打包成 WebP 图集，再在 `character-assets.js` 的 `poses` 登记；没有素材的姿势自动回退待机。
- 所有异步窗口回调和 IPC 都检查 `liveWindow()` 或 `isDestroyed()`；生气锁定期间 IPC 只放行白名单。
- smoke 测试启动方式会影响输出管道。需要读取输出时，让子进程保持 stdout 并等待退出。

## 最近一次工作（2026-10-20，分支 feature-claude）

### Q 版露娜原型

- 用户想用新形象（橙色长卷发、虎纹猫耳和尾巴、黑白几何连衣裙的 Q 版）重做桌宠：保留实用功能，砍掉换装；界面配色跟着改；默认站着，按情况切换坐下工作、睡觉、开心卖萌等姿势；不监听键盘，工作姿势只播动画。素材由用户用 Muse 生成透明序列帧。
- 素材：待机帧用 v3（`pet-idle-frames-v3.zip`，120 张 912×960 RGBA，去掉了呼出的白雾）。前 2 帧鞋子偏低会跳，丢掉；首尾帧相差大，改为往返循环。`design/chibi/build-atlas.py --skip 2 --crop 0,16,768,960` 缩到 270×332，每行 12 帧打包为 `assets/chibi/idle.webp`（118 帧）。
- 代码：`character-assets.js` 改为姿势表（`poses`、`poseFor` 回退待机、`frameAt` 往返/循环/单次）；`character.js` 用 requestAnimationFrame 按 16fps 在画布上播放，反应切姿势、没有姿势时小跳一下，休息时减速一半，减少动态效果时停在第一帧；点击命中读当前画面的透明度，部位按 Q 版帧坐标判定（`body-shortcuts.js` 的 `regionAt`，尾巴不触发），点击只播反应动画。人物框 180×221 DIP，窗口仍为 280×640，气泡下移到头顶上方。
- 换装：删除换装面板、按钮、转盘项、`appearance` IPC、`hair/outfit` 设置（旧状态里的值迁移时丢弃）、快捷功能「换装」（脚默认改为提醒）、旧角色素材和 `design/` 里的旧角色脚本与原图。
- 配色：把界面里紫色系颜色按色相映射到橘色（主色约 #e7733a）、奶白和深棕；托盘圆圈改橘色；用新形象头部重新导出 `luna-avatar.png` 和 `luna.ico`。
- 检查：单元测试 116/116（重写角色素材测试、部位坐标测试）；`character-smoke.js` 改为检查待机在动、透明、躯干居中、反应姿势和气泡位置；body-shortcut/desktop/pure-mode/edge/anger 检查去掉换装并更新颜色和数量断言。在 Linux Xvfb 下 `--anger-sequence-test`、`--pure-mode-test`、`--edge-dock-test` 通过；完整 `--smoke-test` 在 Linux 上卡在“本地文件拖入”和“视频全屏”这两步，原代码在 Linux 上同样卡住，属于环境差异。**完整 smoke 需要在 Windows 上跑一遍。**

### 更早（feature/liveliness，已合并）

- 收藏夹整理（全部页签、置顶、重复合并、保存副本、清理与便签）、右键功能转盘、陪伴互动 `life.js`。细节见 git log。

## 下一步

1. 在 Windows 上跑完整 `--smoke-test` 并打包分支便携版给用户看效果，根据反馈调整人物大小、气泡位置和配色。
2. 用户按 CHARACTER-ASSETS.md 用 Muse 出其余姿势（工作、睡觉、开心、害羞、生气），接入后把“工作”接到截图/录屏、CPU 高和待机时偶尔触发。
3. `main.js` 继续拆分、根目录 `*-smoke.js` 移到 `tests/`，优先级低。
