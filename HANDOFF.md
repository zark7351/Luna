# 开发交接

本文件只记录**当前状态**，保持精简（建议不超过约 10 KB）。每次工作后更新「当前状态」「已知问题」「最近一次工作」「下一步」，不要逐轮追加流水；需要追溯时看 git log 或 [docs/HANDOFF-ARCHIVE.md](docs/HANDOFF-ARCHIVE.md)（2026-10-09 之前的逐轮记录，含已过期内容）。

## 当前状态（2026-10-11）

- 版本 1.0.0，分支 main。功能见 README.md；需求方向见 ROADMAP.md。
- 已实现：16 套装扮（4 发型 × 4 服装）＋共用局部表情；五个身体部位＋禁区各可配置九种快捷功能；收藏夹（文本/链接卡片/文件引用/媒体）；截图（Ctrl+Alt+A）；FFmpeg 原像素区域录屏（NVENC，失败回退 x264）；提醒；日期/系统占用/天气气泡；生气两阶段互动；左右贴边收起；纯净模式；关闭到托盘；中英文；空闲自动休息；UI 音效。
- 安装包 `LunaPet-Release/LunaPet-1.0.0-Setup.exe`（仓库同级，未签名）**不包含**提交 5c0b865 的「功能条最右侧隐藏到托盘按钮」，该改动只在便携版中。需要时重新执行 `node build-installer.cjs`。
- 打字聊天、AI、旧 API Key 均已移除，不要恢复（见 AGENTS.md）。

## 代码结构速览

- `main.js`：主进程（约 1180 行），包括窗口、托盘、IPC 注册、纯净模式、生气状态机。
- `desktop-smoke.js`：`--smoke-test` 完整集成检查（约 1350 行，大量以模板字符串形式注入渲染进程执行的代码）。由 `main.js` 在 smoke 模式下按需 require，并传入一个上下文对象：稳定的对象和函数直接传值，运行中会变化的状态（`state`、`libraryWin`、`angerPhase`、`trayMenu`、`captureShortcut`、`systemStats`、两个假时钟）用 getter/setter 读写，脚本里写作 `live.xxx`。它会随便携版一起打包，安装版 smoke 也要用到。
- 主进程模块：`core.js`（状态默认值/校验/迁移、窗口尺寸常量）、`collection.js`、`reminders.js`/`reminder-alerts.js`、`screenshot.js`、`recording.js`/`native-recording.js`（FFmpeg）、`edge-dock.js`、`idle.js`、`weather.js`、`system-stats.js`、`link-preview.js`、`media.js`（luna-media 协议）、`file-actions.js`、`app-branding.js`、`sound-events.js`/`effect-events.js`、`i18n.js`＋`translations.js`。
- 渲染进程：`index.html`＋`renderer.js`（宠物主界面）、`character.js`/`character-assets.js`（装扮与局部表情）、`anger-interaction.js`、`body-shortcuts.js`、`pet-feedback.js`/`shortcut-bubbles.js`（气泡）、`library.*`（收藏夹）、`recording*`/`reminder*`/`screenshot*`（各自窗口与 preload）。
- 根目录其他 `*-smoke.js` 是被 `desktop-smoke.js` 调用的专项检查；`tests/*.test.js` 是单元测试，`tests/*-smoke.cjs` 是安装包/联网/录屏分辨率等独立检查。
- `design/`：素材生成提示词、原图与导出脚本（只做保留 alpha 的导出，不重绘）。

## 开发与验证

- 新电脑：`npm ci` → `node node_modules/electron/install.js` → `npm start`（详见 CROSS-COMPUTER.md）。
- 单元测试：`npm test`（当前 100 项）。没装 Node.js 时可用 Electron 自带的 Node：`ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe --test tests/*.test.js`（bash 写法）。
- 桌面集成检查：`node_modules/electron/dist/electron.exe . --smoke-test`，约 2 分钟，退出码 0 为通过，结果写入被忽略的 smoke-result.json。可加专项参数：`--capture-debug`、`--pure-mode-test`、`--edge-dock-test`、`--anger-sequence-test`、`--recording-live-test`（真实桌面录制）、`--stats-live-test`（真实 CPU/内存/GPU）。`--anger-preview` 让本次启动第一次必定触发生气，便于人工预览。
- 安装包检查：`node tests/installer-smoke.cjs`（隔离安装→安装版 smoke→重复安装→卸载），`--package-only` 只做文件一致性。
- 代码格式：Prettier 3.9.9（`.prettierrc.json`）。提交前执行 `npm run format`，或用 `npm run format:check` 检查。Markdown、assets、installer、package-lock 不参与格式化。

## 构建与发布

- 便携版 `node build-portable.cjs` → 仓库同级 `LunaPet-Windows/`；安装包 `node build-installer.cjs` → 仓库同级 `LunaPet-Release/`，并更新 SHA256SUMS.txt。打包前先从托盘退出正在运行的便携版，避免文件锁。
- 便携版文件清单是 `build-portable.cjs` 里写死的数组，新增运行时文件必须加进去。
- `prepare-build-tools.cjs` 下载固定版本的 rcedit、Inno Setup、FFmpeg 到被忽略的 `.build-tools/` 并校验 SHA256。FFmpeg 固定 8.0.1：更新版本需要 NVENC 13.1（驱动 610+），开发机的 581 驱动不兼容。某些电脑 PowerShell Archive 模块加载失败，此时用 .NET ZIP 解压到同一缓存目录。
- FFmpeg 是 GPL 构建（含 x264），条款见 FFMPEG-NOTICE.md。公开分发前需要提供对应源码；目前只做本地分发。

## 已知问题与未验证项

- 未人工验收：多显示器/混合 DPI 下拖动、贴边和录屏选框；长时间录制和高负载 4K；与 Bandicam 同场景画质对比；资源管理器、浏览器、微信、飞书的真实拖放和粘贴来源。
- 只给文字或网址、没有真实文件列表的剪贴板来源（如部分微信、飞书、网页）无法收藏视频。
- 150% DPI 下 Chromium 按物理像素量化，窗口尺寸和边框断言要允许 1 DIP 或 1 个物理像素的误差。
- 完整 smoke 末尾的贴边恢复偶尔出现 `native edge test move timed out`。可以单独用 `--edge-dock-test` 诊断。
- 退出时出现 Chromium `GPU state invalid` 日志不影响结果，以退出码为准。
- 没有代码签名、自动更新和 LICENSE 文件。

## 开发注意事项

- 新界面文字加入 `translations.js` 并通过 `lunaI18n` 渲染；名字、昵称、收藏和提醒正文等用户数据不翻译。
- 改外观时保持头发和身体像素固定，只换局部眼、嘴、脸红；新装扮复用表情包，并逐套校准锚点（`design/face-alignment-preview.*` 可以放大对照）。
- 所有异步窗口回调和 IPC 都检查 `liveWindow()` 或 `isDestroyed()`；生气锁定期间 IPC 只放行白名单。
- smoke 测试启动方式会影响输出管道。需要读取输出时，让子进程保持 stdout 并等待退出。

## 最近一次工作（2026-10-11）

### 拆分 smoke 脚本

- `main.js` 里约 1310 行的 `--smoke-test` 代码块原样移到 `desktop-smoke.js`。用 AST 分析找出它依赖的外部变量，通过上下文对象传入；只是把运行中会变化的 8 个变量加上了 `live.` 前缀。`build-portable.cjs` 文件清单加入新文件，`main.js` 去掉不再使用的 `ClipboardItem` 导入。
- 校验：去掉 `live.` 前缀和空白后，新文件与原代码块逐字符一致。单元测试 100/100；完整 `--smoke-test` 退出 0，结果 JSON 与拆分前完全相同；`--pure-mode-test`、`--edge-dock-test`、`--anger-sequence-test` 均退出 0。首次生成时脚本把对象简写 `{ libraryWin }` 重复替换成了错误名称，被完整 smoke 的语言检查发现，修正后重新生成。未重新打包便携版或安装包，打包后的 smoke 尚未验证。

### 格式化与交接精简（已提交 94bef16）

- 引入 Prettier 3.9.9 作为开发依赖，新增 `.prettierrc.json`、`.prettierignore`、`npm run format` / `format:check`，全仓库 JS/CJS/HTML/CSS 一次性格式化。纯格式变化，逻辑未改；`main.js` 从约 700 行超长单行变为 2439 行可读代码。
- `.gitattributes` 增加 `*.cjs text eol=lf`。
- 旧 HANDOFF（151 KB）原样移到 `docs/HANDOFF-ARCHIVE.md`，本文件改写为当前状态摘要。
- 验证：格式化前后单元测试均为 100/100 通过；格式化前后 `--smoke-test` 均退出 0，结果 JSON 逐项一致。本机没有安装 Node.js，以上命令用 Electron 自带的 Node 24.21 运行。Prettier 的 package-lock 条目是手工写入的（版本、resolved、integrity 来自 npm registry，已校验 tarball 的 sha512）。下次有 npm 的电脑执行一次 `npm ci` 确认无差异。未重新打包便携版或安装包。

## 下一步（需用户确认）

1. 把主进程 `main.js` 按窗口/托盘/IPC/生气状态拆分。
2. 把根目录的 `*-smoke.js` 移到 `tests/`（需同步 `main.js` 的 require 路径和 `build-portable.cjs` 的文件清单）。
3. ROADMAP.md 的「当前方向」同样是按日期堆叠的流水，可以整理成「当前产品定义＋待办候选」。
4. 产品方向候选（未授权）：待机姿势与时段行为、根据用户活动提醒休息、好感度与换装解锁。
