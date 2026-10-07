# 换电脑继续开发

仓库保存的是源码和交接背景，不会恢复 Codex 对话的逐字记录。每次使用 Codex 打开这个仓库文件夹，并新建项目内任务。

## 在另一台 Windows 电脑首次准备

安装 Git 和 Node.js（22.12+，带 npm），登录 GitHub。克隆你创建的私有仓库，然后在仓库目录中执行：

```powershell
git clone https://github.com/zark7351/Luna.git
cd Luna
npm ci
node node_modules/electron/install.js
npm test
npm start
```

Electron 运行时下载依赖网络。如果下载失败，不要从其他来源取未经校验的 exe，应检查网络后重试安装命令。

对新对话说：

> 这是露娜 Windows 桌面宠物项目。请先读取 AGENTS.md、README.md、HANDOFF.md 和 ROADMAP.md，检查 Git 状态，总结当前实现与待办，再按我的本次要求继续。完成后更新交接文档。

## 每次换机前后

开始前（先确保没有未保存的本地修改）：

```powershell
git status
git pull --ff-only
```

完成后，让助手更新 HANDOFF.md，检查差异和测试结果，再提交并推送：

```powershell
git status
git diff
git add .
git commit -m "Describe this change"
git push
```

如果 pull 提示无法快进，不要强制覆盖。把错误交给助手，保留两台电脑的改动后处理。尽量一次只在一台电脑开发；需同时工作时使用不同分支。

## 打包

关闭本项目正在运行的便携程序，然后在 PowerShell 执行：

```powershell
node build-portable.cjs
```

输出位于仓库同级的 LunaPet-Windows。开发者通过 Git 传源码，运行时和便携 exe 重新生成。角色素材与 package-lock.json 已纳入源码。

露娜 1.0 安装包执行 `node build-installer.cjs`，输出到仓库同级 `LunaPet-Release`；使用时无需 Node.js。首次开发构建会下载固定版本并校验 SHA256 的官方 rcedit / Inno Setup 工具到 `.build-tools`，该缓存不随 Git 同步。安装规则与工具来源见 [安装包指南](installer/README.md)。安装版与便携版保持同一用户数据目录，卸载不删除个人数据。

该 Node.js 入口不受 PowerShell 的 `.ps1` 执行策略影响，无需管理员权限或调整策略。如果 npm.ps1 也被拦截，可使用 `npm.cmd ci`、`npm.cmd test` 和 `npm.cmd start`。

## 哪些不随 Git 同步

宠物个人设置与位置、node_modules、便携 exe、Codex 本地聊天记录和电脑级工具配置。项目交接只保存开发背景和测试结论。当前版本以本地运行为主，网页卡片预览按用户要求匿名联网；天气恢复为按点击查询，城市可搜索或手动点击 IP 定位，不保存公网 IP、不持续跟踪；天气缓存保存在用户数据目录。日期/时间、CPU/内存/GPU 信息通过配置的身体部位点击后显示气泡，来自本机，系统读数不保存、不上传；不需要 API Key，也不保存聊天记录。
