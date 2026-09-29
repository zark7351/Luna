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
./build-portable.ps1
```

输出位于仓库同级的 LunaPet-Windows。开发者通过 Git 传源码，运行时和便携 exe 重新生成。角色素材与 package-lock.json 已纳入源码。

## 哪些不随 Git 同步

API Key、宠物个人聊天与偏好、node_modules、便携 exe、Codex 本地聊天记录和电脑级工具配置。API Key 在每台电脑的宠物设置中重新填写，不上传到仓库。项目交接只保存开发背景和测试结论。
