# 露娜 · Windows 桌面伙伴

第一版轻量 2D 桌面宠物。银紫发动漫角色，支持呼吸、眨眼、点击开心、休息、拖动、聊天面板和托盘。

长期开发请先读 [跨电脑开发指南](CROSS-COMPUTER.md)、[开发交接](HANDOFF.md) 和 [路线图](ROADMAP.md)。Codex 项目规则保存在 [AGENTS.md](AGENTS.md)。Git 仓库包含源码和素材，便携程序需要在本机生成。

## 使用便携版

打开相邻的 `LunaPet-Windows` 文件夹，双击 `LunaPet.exe`。完整文件夹必须保留在一起；不需要安装 Node.js。这个开发版没有数字签名。

- 点击角色：表情互动；按住拖动：移动窗口。
- 「聊天」：展开或收起面板；「休息」：闭眼休息，再点击唤醒。
- 「⌄」：隐藏到系统托盘，双击托盘圆点恢复；右键托盘选择退出。
- 聊天面板右上角齿轮：修改名字、称呼、偏好、置顶和 AI 配置。
- Enter 发送，Shift + Enter 换行。动画遵循系统减少动态效果设置。

## 接入 AI

默认是**离线预设台词**，不是大模型。动作无需联网。启用 AI 前，在设置里填写支持 Chat Completions 的服务地址（通常包含 `/v1`）、模型 ID 和自己的 API Key，再勾选「启用 AI 对话」。地址也可以是完整 `/chat/completions` 端点。仅填写设置不会自动发送测试请求。

支持通过兼容接口连接本机模型，地址可用 `http://127.0.0.1:端口/v1`；模型服务需要单独安装并运行。应用不附带模型。在线服务费用按所选服务商规则计算。

从 0.1.1 起，AI 请求使用 Electron 网络栈，跟随 Windows 系统代理/PAC 配置。无需在程序内填写代理端口。若提示系统代理连接失败，请检查代理软件是否运行；程序不会自动更改 Windows 网络设置。HTTP 401 表示需要检查认证，HTTP 429 表示服务限流或额度问题。

API Key 使用 Electron safeStorage / Windows 系统能力加密后保存在本机。不要把密钥发到聊天里。更换服务地址会清除原密钥，避免把它带到另一家服务。AI 开启后，仅在发送消息时，将当前消息、最近 20 条 AI 聊天消息及设置中的称呼和偏好发送到所填服务。离线预设消息不进入 AI 上下文。

聊天最多保留 100 条消息，明文保存在 Windows 用户应用数据目录的 `luna-desktop-pet/state.json`。偏好是用户在设置里主动填写的内容，目前没有自动长期记忆或自动概括功能。「清空聊天」删除本地聊天，偏好需在设置中另行清空。

## 当前范围

已实现轻量表情帧切换与整体呼吸动画，并非 Live2D 骨骼动画。不同表情帧存在轻微手绘位置差异。本版没有语音、自动行走、开机自启或电脑操作能力。真实 AI 服务仍需用户配置后验证；接口逻辑通过模拟响应测试，系统代理传输通过无密钥网络探测验证。

## 源码开发

构建便携版：在仓库目录执行 `node build-portable.cjs`，输出在同级 `LunaPet-Windows`。如果 PowerShell 禁止执行 `.ps1`，直接使用这个 Node.js 入口即可，不需要修改系统执行策略。`npm.cmd run build` 也可使用。

需要 Node.js 22.12+ 和 npm。执行 `npm install`，然后 `node node_modules/electron/install.js` 下载运行时，再执行 `npm start`。运行单元测试：`npm test`。应用集成检查：`node_modules/electron/dist/electron.exe . --smoke-test`。该检查使用临时用户数据目录，不会读写个人聊天。

主要文件：main.js（窗口、托盘、加密与保存），core.js（接口与校验），preload.js（隔离桥接），renderer.js / style.css / index.html（交互与显示）。

network.js 负责主进程系统代理传输。使用 `node_modules/electron/dist/electron.exe tests/network-smoke.cjs` 检查真实 Electron 传输、本地模拟回复和重定向拒绝；不会使用个人密钥或外部模型。

## 素材与文档

角色素材 `assets/character.png` 由内置 image_gen 工具生成，保留原透明 alpha。最终生成提示词见 `ASSET-PROMPT.txt`。

- Electron 窗口：https://www.electronjs.org/docs/latest/api/browser-window
- Electron 加密存储：https://www.electronjs.org/docs/latest/api/safe-storage
- OpenAI Docs / Chat Completions：https://developers.openai.com/api/reference/resources/chat
