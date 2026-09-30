# 露娜 · Windows 桌面宠物

露娜是一款纯本地运行的轻量 2D 桌面宠物，角色为原创成年二次元女性。当前支持呼吸、眨眼、点击表情、气泡反馈、拖放收藏、休息、拖动和托盘。未来计划加入待办提醒、选项互动、养成和换装。

## 使用

打开仓库同级的 `LunaPet-Windows` 文件夹，双击 `LunaPet.exe`。请保留整个文件夹；便携程序不需要安装 Node.js。这个开发版没有数字签名。

- 点击角色触发表情和简短气泡；按住拖动；「休息」可闭眼或唤醒。
- 将本机图片、视频或其他文件拖到角色上，可复制进露娜的收藏目录；拖入文字或链接则保存文字或网址。网页图片/视频如果只提供网址，会保存链接，不会自动下载。
- 角色下方「收藏」打开独立收藏夹，可搜索、打开、复制和删除。收藏夹还有「添加文件」及「收藏剪贴板」入口；单次最多 10 个文件、每个文件最多 1 GB。
- 角色下方「设置」可修改名字、称呼和窗口置顶；「⌄」隐藏到托盘。
- 旧版本保存的聊天记录、AI 服务设置和 API Key 会在首次启动新版时从应用状态中移除。请先自行备份任何想留的旧记录。

设置和宠物位置保存在 Windows 当前用户的应用数据目录 `luna-desktop-pet/state.json`；收藏索引及文件副本保存在同一应用数据目录下的 `collection.json` 和 `collection-files`。删除文件收藏时只删除露娜的副本，不删除原文件。收藏只在本机，换电脑或重装系统前需自行备份该应用数据目录。本版没有打字聊天、自由对话、待办提醒、语音、换装或养成数值。

## 开发与打包

在 Windows 上使用 Node.js 22.12+ 和 npm：

```powershell
npm ci
node node_modules/electron/install.js
npm start
```

运行测试：`npm test`。桌面集成检查：`node_modules/electron/dist/electron.exe . --smoke-test`，使用独立临时用户目录。构建便携版：`node build-portable.cjs`，输出到仓库同级的 `LunaPet-Windows`。打包前关闭正在运行的该便携版，避免文件锁。PowerShell 执行策略拦截 `.ps1` 时，直接使用 Node.js 构建入口。集成检查可验证模拟拖放，资源管理器和浏览器的真实拖放仍需人工验收。

长期开发请阅读 [跨电脑开发指南](CROSS-COMPUTER.md)、[交接记录](HANDOFF.md)、[路线图](ROADMAP.md) 和 [开发规则](AGENTS.md)。源码使用 Electron、普通 JavaScript、HTML 和 CSS。角色素材 `assets/character.png` 为透明三帧精灵图，生成说明见 [ASSET-PROMPT.txt](ASSET-PROMPT.txt)。
