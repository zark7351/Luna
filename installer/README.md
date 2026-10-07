# 露娜 1.0 Windows 安装包

在 Windows 仓库根目录运行 `node build-installer.cjs`。先关闭本项目正在运行的便携程序。安装包位于仓库同级 `LunaPet-Release/LunaPet-1.0.0-Setup.exe`；便携版位于 `LunaPet-Windows/LunaPet.exe`。

安装程序支持当前用户安装、自选路径、桌面与开始菜单快捷方式、Windows 卸载入口。内部应用名称和用户数据目录保持 `luna-desktop-pet`，升级或卸载均不删除收藏、设置、提醒、自定义保存目录或引用的原文件。安装目录默认是当前用户 `AppData/Local/Programs/LunaPet`。当前未配置数字签名，发布签名另行处理。

安装更新前，请从系统托盘退出露娜。安装程序不使用 Restart Manager 自动关闭进程；部分游戏的防护进程可能持有文件句柄，自动判断文件占用会误列这些应用。

## 可复现构建

- 应用图标源图/提示词：`design/app-icon/`；技术导出：`design/export-app-icon.cjs`，生成 `assets/luna.ico` 和 `assets/luna-avatar.png`。
- EXE 资源工具：[Electron rcedit 2.0.0](https://github.com/electron/rcedit/releases/tag/v2.0.0)，许可见其上游仓库 LICENSE。
- 安装编译器：[Inno Setup 6.7.3](https://github.com/jrsoftware/issrc/releases/tag/is-6_7_3)，许可见上游 [LICENSE.TXT](https://github.com/jrsoftware/issrc/blob/is-6_7_3/LICENSE.TXT)。编译器以便携模式安装到 `.build-tools/inno-6.7.3`，不注册系统关联。
- 中文翻译 `ChineseSimplified.isl` 来自上述固定版本 [官方源码](https://github.com/jrsoftware/issrc/blob/is-6_7_3/Files/Languages/Unofficial/ChineseSimplified.isl)，保留文件内翻译者署名。
- 下载 URL 与 SHA256 固定在 `prepare-build-tools.cjs`；缓存不入 Git，校验不符停止构建。构建工具只在开发时下载，安装程序不联网。

## 隔离验证

原生图标验证：`node_modules/electron/dist/electron.exe tests/app-branding-smoke.cjs`，隔离数据，检查 Windows ICO 解码与托盘图标 PNG 的透明度/颜色。

完整验证入口为 `node tests/installer-smoke.cjs`：安装 → 安装版桌面 smoke → 重复安装 → 卸载，校验独立测试数据和自定义保存文件的哈希保持。临时目录内保存安装日志与 verification.json；不读取真实用户数据。

测试安装时传入 `/LUNATEST=1 /VERYSILENT /SUPPRESSMSGBOXES /SP- /NORESTART /NOICONS /TASKS= /NOCLOSEAPPLICATIONS /DIR=<独立临时目录>`。

该开关使用独立测试 AppId，不写真实卸载注册项、不创建桌面/开始菜单快捷方式、不自动启动露娜，也不读取真实安装位置；仍执行实际文件安装和卸载，可在同一临时目录重复安装。运行安装后的 `LunaPet.exe --smoke-test --capture-debug`，桌面 smoke 使用自己的独立临时用户目录。卸载运行临时目录中的 `unins000.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART`。

测试模式用于开发验证；用户正常安装无需额外参数。
