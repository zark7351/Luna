# Claudie B 站视频

当前版 v3 是约 36 秒的开发者口播：以“我用 Claude 的形象开发了一个桌宠软件”开场，简短展示互动、收藏、截图录屏、提醒和精简模式，片尾请观众关注等发布。只有普通话旁白，无背景音乐。旧氛围样片和详细教程不再作为当前方向。

在仓库根目录运行 `node design/promo/build.cjs`。需要项目 Electron、FFmpeg 构建工具和 Windows 的 Microsoft Huihui Desktop 中文语音。旁白本地合成，未使用在线服务或录制真人语音。修改 `short-script.json` 可调整分句与镜头顺序。

输出到仓库同级 `Claudie-Promo/`：`Claudie-功能速览-v3.mp4`、旁白 WAV、SRT，及 `voice-v3/` 检查帧和验证记录。导出脚本核对画面尺寸、帧数、语音轨长度并完整解码检查。

互动镜头使用应用自身的角色渲染与局部动作，鼠标及拖放是剪辑示意；功能镜头复用 `capture-ui.cjs` 从独立演示资料采集的真实界面截图。若本机没有缓存，默认先采集。没有读取个人桌面、收藏或剪贴板，未修改应用运行代码，未发布。

旧 v2 可用 `node design/promo/build-functional.cjs` 重建；旧 v1 源文件保留用于回看。视频工具不加入应用包。
