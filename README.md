# 露娜 · Windows 桌面宠物

露娜是一款纯本地运行的轻量 2D 桌面宠物，角色为原创成年二次元女性。当前支持呼吸、眨眼、点击表情、休息、拖动、托盘和预设文字互动。未来计划围绕养成、逐步解锁和换装扩展成小型桌面游戏。

## 使用

打开仓库同级的 `LunaPet-Windows` 文件夹，双击 `LunaPet.exe`。请保留整个文件夹；便携程序不需要安装 Node.js。这个开发版没有数字签名。

- 点击角色触发表情；按住拖动；「休息」可闭眼或唤醒。
- 「聊天」打开本地互动面板。输入文字只会得到预设台词，不连接 AI 服务，也不会发出模型请求。
- 齿轮设置角色名字、她对你的称呼和窗口置顶；「⌄」隐藏到托盘。
- 旧版本保存的聊天记录会保留，历史 AI 回复标为「旧版 AI 回复」。旧服务地址、模型设置和 API Key 会从本机状态中移除。

聊天最多保留 100 条，保存在 Windows 当前用户的应用数据目录 `luna-desktop-pet/state.json`。本版没有自由聊天、语音、自动行走、换装或养成数值。

## 开发与打包

在 Windows 上使用 Node.js 22.12+ 和 npm：

```powershell
npm ci
node node_modules/electron/install.js
npm start
```

运行测试：`npm test`。桌面集成检查：`node_modules/electron/dist/electron.exe . --smoke-test`，使用独立临时用户目录。构建便携版：`node build-portable.cjs`，输出到仓库同级的 `LunaPet-Windows`。打包前关闭正在运行的该便携版，避免文件锁。PowerShell 执行策略拦截 `.ps1` 时，直接使用 Node.js 构建入口。

长期开发请阅读 [跨电脑开发指南](CROSS-COMPUTER.md)、[交接记录](HANDOFF.md)、[路线图](ROADMAP.md) 和 [开发规则](AGENTS.md)。源码使用 Electron、普通 JavaScript、HTML 和 CSS。角色素材 `assets/character.png` 为透明三帧精灵图，生成说明见 [ASSET-PROMPT.txt](ASSET-PROMPT.txt)。
