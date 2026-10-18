# 开发交接

本文件只记录**当前状态**，保持精简（建议不超过约 10 KB）。每次工作后更新「当前状态」「已知问题」「最近一次工作」「下一步」，不要逐轮追加流水；需要追溯时看 git log 或 [docs/HANDOFF-ARCHIVE.md](docs/HANDOFF-ARCHIVE.md)（2026-10-09 之前的逐轮记录，含已过期内容）。

## 当前状态（2026-10-18）

- 版本 1.0.0。main 是已发布的 1.0.0；**分支 `feature/liveliness`** 在开发「陪伴互动」（见下文「最近一次工作」），尚未合并、尚未打包。功能见 README.md；需求方向见 ROADMAP.md。
- 已实现：16 套装扮（4 发型 × 4 服装）＋共用局部表情；五个身体部位＋禁区各可配置九种快捷功能；收藏夹（文本/链接卡片/文件引用/媒体）；截图（Ctrl+Alt+A）；FFmpeg 原像素区域录屏（NVENC，失败回退 x264）；提醒；日期/系统占用/天气气泡；生气两阶段互动；左右贴边收起；纯净模式；关闭到托盘；中英文；空闲自动休息；UI 音效。
- 便携版 `LunaPet-Windows/` 和安装包 `LunaPet-Release/LunaPet-1.0.0-Setup.exe`（都在仓库同级，未签名）已于 2026-10-12 基于 main 提交 `faab101` 重新构建，包含整理后的代码、独立 `desktop-smoke.js` 及当前全部功能。安装包 SHA256：04882f82ba5c76a02183bd1f00a344eff1c5a422181beb5b91dd7b32a3b89a32，SHA256SUMS.txt 已更新。真实安装目录未升级；包内交接为构建快照，最终验证看仓库本文件。
- 打字聊天、AI、旧 API Key 均已移除，不要恢复（见 AGENTS.md）。

## 代码结构速览

- `main.js`：主进程（约 1180 行），包括窗口、托盘、IPC 注册、纯净模式、生气状态机。
- `desktop-smoke.js`：`--smoke-test` 完整集成检查（约 1350 行，大量以模板字符串形式注入渲染进程执行的代码）。由 `main.js` 在 smoke 模式下按需 require，并传入一个上下文对象：稳定的对象和函数直接传值，运行中会变化的状态（`state`、`libraryWin`、`angerPhase`、`trayMenu`、`captureShortcut`、`systemStats`、两个假时钟）用 getter/setter 读写，脚本里写作 `live.xxx`。它会随便携版一起打包，安装版 smoke 也要用到。
- 主进程模块：`core.js`（状态默认值/校验/迁移、窗口尺寸常量）、`collection.js`、`reminders.js`/`reminder-alerts.js`、`screenshot.js`、`recording.js`/`native-recording.js`（FFmpeg）、`edge-dock.js`、`idle.js`、`weather.js`、`system-stats.js`、`link-preview.js`、`media.js`（luna-media 协议）、`file-actions.js`、`app-branding.js`、`sound-events.js`/`effect-events.js`、`i18n.js`＋`translations.js`。
- `life.js`：陪伴互动的决策逻辑（问候、欢迎回来、休息/深夜提醒、自言自语、眨眼节奏、拖动反应、每日计数），注入时钟和随机数，可单元测试；`renderer.js` 负责定时器（每 30 秒 `tick`）、安静条件 `lifeCanSpeak` 和说话 `lifeSay`；主进程只通过 `life-memory` IPC 保存校验过的 `state.life`。smoke 模式下 `publicState().lifePaused` 为 true，真实引擎不说话，避免干扰气泡断言；专项检查在 `life-smoke.js`，用假时钟单独创建实例。
- 渲染进程：`index.html`＋`renderer.js`（宠物主界面）、`character.js`/`character-assets.js`（装扮与局部表情）、`anger-interaction.js`、`body-shortcuts.js`、`pet-feedback.js`/`shortcut-bubbles.js`（气泡）、`library.*`（收藏夹）、`recording*`/`reminder*`/`screenshot*`（各自窗口与 preload）。
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
- 没有代码签名、自动更新和 LICENSE 文件。

## 开发注意事项

- 新界面文字加入 `translations.js` 并通过 `lunaI18n` 渲染；名字、昵称、收藏和提醒正文等用户数据不翻译。
- 改外观时保持头发和身体像素固定，只换局部眼、嘴、脸红；新装扮复用表情包，并逐套校准锚点（`design/face-alignment-preview.*` 可以放大对照）。
- 所有异步窗口回调和 IPC 都检查 `liveWindow()` 或 `isDestroyed()`；生气锁定期间 IPC 只放行白名单。
- smoke 测试启动方式会影响输出管道。需要读取输出时，让子进程保持 stdout 并等待退出。

## 最近一次工作（2026-10-18，分支 feature/liveliness）

用户授权按 Claude 提出的方案增加「活人感」，第一版只靠行为、不加新素材：

- 新增 `life.js`：每日按时段问候（附周一/周五/周末或认识第 7/30/100… 天纪念日）、首次见面自我介绍；欢迎回来按离开时长分档，小憩台词有变化；连续忙碌 90 分钟提醒休息（之后每小时，每天最多 3 次，真正离开过就重新计时）；23:30 后劝睡（间隔 90 分钟，每晚最多 2 次）；每 25–50 分钟偶尔自言自语，优先提起今天截图 ≥3、收藏 ≥3、完成提醒 ≥1 的次数。主动发言间隔 ≥4 分钟、每天 ≤8 句；一天从 05:00 开始算。用户设置了昵称时，问候和关心会带上称呼。
- 眨眼：犯困时段（13–15 点、23 点后、6 点前）或连续忙碌 2 小时后变慢、偶尔长闭眼；平时 15% 概率连眨两下。拖动开始 30% 概率说话（5 分钟冷却），1.2 秒内左右反转 4 次视为甩动，喊头晕（1 分钟冷却）。新增 `sleepy` 反应（闭眼）。
- 安静条件：有气泡/提醒/面板/拖动/拖放、生气保护、纯净模式、贴边收起、窗口不可见（托盘）时都不主动说话；问候被挡住时会顺延，不会丢。
- 设置新增「陪伴互动」开关（`settings.companion`，默认开），关闭后恢复原来固定的「你先忙，我小憩一下。」「你回来啦。」和原眨眼。`state.life` 保存认识日期、上次问候日期、当天计数和已说过的台词（≤40 条），迁移时校验。所有台词已加英文翻译。
- 验证（Electron 自带的 Node）：单元测试 116/116（新增 16 项覆盖问候、纪念日、顺延、离开时长、跨天、休息提醒及重新计时、深夜上限、每日上限、计数跨天清零、关闭状态、拖动/甩动冷却、眨眼节奏）；完整 `--smoke-test` 退出 0，含新增 `companion` 检查（真实气泡显示假时钟问候、忙时不说话、life-memory 往返和过滤、设置开关保存与 state.json 持久化）；`--pure-mode-test`、`--edge-dock-test`、`--anger-sequence-test` 退出 0。
- 打包：用分支提交 b32f8ac 构建了便携版 LunaPet-Windows/（覆盖了原 1.0.0 便携版，安装包未更新）；打包后的 --smoke-test 退出 0，含 companion 检查；已启动给用户体验。
- 未验证：真实使用中的发言频率和语气是否合适；甩动检测在真实拖动窗口时的灵敏度（只做了逻辑测试）。

## 下一步

1. 用户正在体验分支便携版。根据反馈调整频率、台词和甩动灵敏度，再合并到 main。
2. 第二步候选（需用户确认）：补局部表情贴片（困倦半睁眼、打哈欠、惊讶、晕乎乎、看左右），Claude 写规格、GPT 生图、Claude 接入；全屏时自动安静；生日和节日。
3. `main.js` 继续拆分、根目录 `*-smoke.js` 移到 `tests/`，优先级低。
