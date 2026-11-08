# Claudy B 站视频

当前版 v4 按 [口播稿](narration-v4.md) 先展示收藏，再讲截图录屏、提醒和精简模式，点击互动一句带过。片尾引导关注并充电后私信获取软件、欢迎反馈。配音采用 Ava 多语种音色，每句连续合成，不再拆出英文单词拼接；“我还”读 hái，“UP 主”读“阿普主”。开场副标题为“一款多功能 Windows 桌宠”，旁白不介绍软件名，功能段用“克劳德”指代角色。无背景音乐；曼波音轨待取得。

v4 从仓库同级 `Claudy-Promo/voice-v4/` 读取 `line-0.mp3` 至 `line-9.mp3`（也可用对应的 WAV），顺序见 `narration-v4.json`。用 `node design/promo/build-short.cjs --v4` 合成视频、旁白 WAV 和字幕。可选的 `voice-v4.py` 在安装 `edge-tts` 的 Python 环境运行，仅在制片时把旁白稿发给 Edge TTS。要改用曼波，把分段音轨替换后重建即可，应用运行时不受影响。

旧 v3 仍可在仓库根目录运行 `node design/promo/build.cjs` 重建。它需要项目 Electron、FFmpeg 构建工具和 Windows 的 Microsoft Huihui Desktop 中文语音，脚本是 `short-script.json`。

输出到仓库同级 `Claudy-Promo/`：相应版本的 MP4、旁白 WAV、SRT、检查帧和验证记录。导出脚本核对画面尺寸、帧数、语音轨长度并完整解码检查。

互动镜头使用应用自身的角色渲染与局部动作，鼠标及拖放是剪辑示意；功能镜头复用 `capture-ui.cjs` 从独立演示资料采集的真实界面截图。若本机没有缓存，默认先采集。没有读取个人桌面、收藏或剪贴板，未修改应用运行代码，未发布。

旧 v2 可用 `node design/promo/build-functional.cjs` 重建；旧 v1 源文件保留用于回看。视频工具不加入应用包。

演示画面采集后统一保存为 CSS 像素尺寸，避免 Windows 显示缩放影响固定裁图坐标。更换电脑或缩放比例后重新运行 `capture-ui.cjs`，再合成成片；已有 manifest 会让构建跳过采集。
