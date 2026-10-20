# 虎耳 Q 版 · 待机动画

以用户确认的 `../standing-front-v4.png` 为基础，保留原脸型、五官、无耳机造型与 3D 手办质感。

## 交付文件

- `idle-transparent.webp`：768 × 808，6 秒、30 FPS、180 帧，无限循环，带透明通道。颜色采用 quality 90 压缩，透明通道保留，适合后续桌面宠物接入。
- `idle-preview.gif`：384 × 404，浅紫灰背景预览，无限循环。
- `idle-preview.mp4`：768 × 808，浅紫灰背景预览，H.264，无声音。
- `idle-transparent-master.apng`：同尺寸无损透明母版，体积约 107 MiB，仅留本地，已忽略，不进入 Git；可由导出脚本重新生成。
- `index.html`、`idle.js`：本地实时预览源文件，可切换背景、暂停播放。没有运行时联网路径。
- `animation.json`：尺寸、帧率、时长、动作及循环信息；`contact-sheet.png`：睁眼/闭眼与不同摆尾位置的检查图。

## 动作制作

- 呼吸周期 3 秒，只有肩胸局部轻微扩张、抬起，头部略有随动；双脚不动，不通过缩放整张图片模拟呼吸。
- 尾巴周期 3 秒，用局部网格变形做轻微摆动，根部渐弱固定。
- 每轮在 1.62 秒、4.32 秒开始眨眼，各约 0.26 秒。闭眼关键帧由内置 image_gen 根据 v4 生成，提示词见 `blink-prompt.txt`；仅提取两个眼睛区域，其他像素继续使用原图，开合时收拢眼睛区域。
- 这是透明原画的局部变形动画与表情合成；没有新增 3D 模型。当前只交付素材，未替换露娜的运行时角色或接入桌面程序。

## 重新导出

在仓库根目录运行，确保 Electron 与项目 FFmpeg 工具已准备好：

```powershell
node_modules/electron/dist/electron.exe design/tiger-chibi/idle/export.cjs
node design/tiger-chibi/idle/encode.cjs
```

导出窗口隐藏，使用独立临时用户目录。若终端不等待 GUI 进程，可用 Node 的 `child_process.spawn` 等待 Electron 完成。编码脚本也支持将 FFmpeg 路径作为第一个参数传入，默认使用项目固定的 8.0.1 构建工具；不写死电脑用户名或外部绝对路径。`frames/` 是 180 张中间 PNG，已忽略，可重建。

## 验证范围

已在隐藏 Electron 渲染窗口完成导出，检查了睁闭眼及摆尾采样图；180 帧均为 768 × 808 RGBA，脚底固定，t=0 与 t=6 的渲染图逐字节一致。透明 WebP、APNG、GIF 和 MP4 的帧数/时长及透明文件 alpha 均作读取检查，具体结果见 `verification.json`。

只增加美术素材与独立导出工具，未改应用接口、存储或窗口行为；未运行应用 `npm test` 或完整 `--smoke-test`，也未做真实桌面集成验收。新工具已做语法与 Prettier 检查。
