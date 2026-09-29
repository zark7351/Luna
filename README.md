# 露娜 · Windows 桌面宠物

露娜是一款纯本地运行的轻量 2D 桌面宠物，角色为原创成年二次元女性。当前支持呼吸、眨眼、点击表情、气泡反馈、休息、拖动和托盘。未来计划围绕选项互动、养成、逐步解锁和换装扩展成小型桌面游戏。

## 使用

打开仓库同级的 `LunaPet-Windows` 文件夹，双击 `LunaPet.exe`。请保留整个文件夹；便携程序不需要安装 Node.js。这个开发版没有数字签名。

- 点击角色触发表情和简短气泡；按住拖动；「休息」可闭眼或唤醒。
- 角色下方「设置」可修改名字、称呼和窗口置顶；「⌄」隐藏到托盘。
- 旧版本保存的聊天记录、AI 服务设置和 API Key 会在首次启动新版时从应用状态中移除。请先自行备份任何想留的旧记录。

设置和宠物位置保存在 Windows 当前用户的应用数据目录 `luna-desktop-pet/state.json`。本版没有打字聊天、自由对话、语音、自动行走、换装或养成数值。

## 开发与打包

在 Windows 上使用 Node.js 22.12+ 和 npm：

```powershell
npm ci
node node_modules/electron/install.js
npm start
```

运行测试：`npm test`。桌面集成检查：`node_modules/electron/dist/electron.exe . --smoke-test`，使用独立临时用户目录。构建便携版：`node build-portable.cjs`，输出到仓库同级的 `LunaPet-Windows`。打包前关闭正在运行的该便携版，避免文件锁。PowerShell 执行策略拦截 `.ps1` 时，直接使用 Node.js 构建入口。

长期开发请阅读 [跨电脑开发指南](CROSS-COMPUTER.md)、[交接记录](HANDOFF.md)、[路线图](ROADMAP.md) 和 [开发规则](AGENTS.md)。源码使用 Electron、普通 JavaScript、HTML 和 CSS。角色素材 `assets/character.png` 为透明三帧精灵图，生成说明见 [ASSET-PROMPT.txt](ASSET-PROMPT.txt)。
