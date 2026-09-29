# 露娜项目开发规则

## 接续工作

- 开始前阅读 README.md、HANDOFF.md、ROADMAP.md，并检查 Git 状态与当前分支。以实际代码和最新用户要求为准，文档可能滞后。
- 与用户用简体中文沟通。用户希望在多台 Windows 电脑上持续开发；不要依赖某台电脑的绝对路径、Codex 本地聊天历史或当前用户名。
- 每次完成有实质变化的工作后，更新 HANDOFF.md：做了什么、验证结果、未解决问题、明确的下一步。需求变化时更新 ROADMAP.md。
- HANDOFF.md 和 ROADMAP.md 是交接资料；其中的建议不等于用户已授权开发全部功能。先遵循本次用户明确任务。

## 产品约束

- 独立 Windows 桌面宠物，轻量 2D 动画，原创成年二次元女性角色；当前角色名露娜。
- 当前版本纯本地运行，无打字聊天或 AI；通过角色气泡显示简短反馈。旧聊天记录不迁移。
- 当前动画素材是透明三帧精灵图；保留原始 alpha。修改外观需遵循用户意图，不要随意替换角色。
- 代码使用 Electron、普通 JavaScript、HTML、CSS。不要仅为风格偏好引入新的框架。

## 开发与验证

- Node.js 22.12+、npm、Windows。新电脑执行 npm ci，然后 node node_modules/electron/install.js，再 npm start。
- 改动接口、存储、窗口生命周期时，执行 npm test；影响桌面行为时执行 Electron --smoke-test 集成检查。
- --smoke-test 使用独立临时用户目录。不要拿用户真实数据做测试。
- 所有异步窗口回调与 IPC 都应检查窗口生命周期，避免 Object has been destroyed 回归。
- 打包用 node build-portable.cjs，输出到仓库同级 LunaPet-Windows；该入口无需改变 PowerShell 执行策略。旧 ps1 仅作兼容包装。打包前关闭正在运行的该便携版，避免 Windows 文件锁。不要关闭不属于本项目的进程。
- 报告哪些检查实际通过，哪些未验证。模拟接口测试不能代表真实供应商连接成功。

## 数据与版本管理

- Git 跟踪源码、package-lock.json、角色素材和文档。不提交 node_modules、便携程序、个人 state.json 或环境凭据。
- 旧版聊天记录、加密密钥和 AI 服务设置在状态迁移时清除；不要重新引入联网路径或打字聊天，除非用户以后明确要求。
- 保持 contextIsolation、sandbox 和受限 preload 桥接；渲染动态文字时不要直接插入 HTML。
- 使用相对路径、应用路径 API；不要把原开发电脑的用户目录写进新代码。
- 推送前检查暂存清单与差异；不要强制推送或覆盖其他电脑的工作。远端有新提交时先拉取并处理冲突。
