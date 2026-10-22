# 2D 克劳德托腮待机动画

以用户确认的 `../default-pose.png` 为参考制作。保留 2D 橙发虎耳、单手托腮的慵懒姿势；用户已确认使用，已打包为 `assets/luna-2d/idle.webp` 接入应用默认待机；本目录保留源图、导出工具与预览。

## 交付

- `idle-transparent.webp`：768 × 584，8 秒、24 FPS、192 帧，透明循环动画，约 5.6 MiB。颜色 quality 90，alpha 保留。
- `idle-preview.gif`：512 × 390，奶白背景的循环预览。
- `idle-preview.mp4`：768 × 584，奶白背景 H.264 预览，无声音。
- `idle-transparent-master.apng`：768 × 584 无损透明母版，约 23 MiB，仅本地保存并忽略，可重建。
- `index.html` / `idle.js`：本地实时动画源文件，支持暂停和切换浅色、深色、格纹背景。
- `base-transparent.png`：内置 image_gen 根据白底原图制作的透明基础图；原始 `default-pose.png` 未改动。
- `blink-closed-source.png`：内置 image_gen 生成的闭眼关键帧；仅取两个眼睛区域，不切换整个人物。提示词见 `prompts.txt`。

## 动作

- 眨眼沿倾斜的眼睛方向收拢，开始时间为 1.65、5.10、5.55 秒，后两次为轻微连眨。
- 两只耳朵分别在约 2.25/2.42 秒和 6.00/5.85 秒短暂轻抖，耳根渐弱固定。
- 尾巴以 8 秒周期缓慢摆动，尾尖有轻微滞后，根部渐弱固定。
- 用透明原画的局部网格变形加眼睛贴片合成，没有生成视频或新增 3D 模型。托腮的手、嘴部与主要身体保持固定，不整体缩放或抬动角色。
- 输出另加透明留白，耳朵与尾巴活动时不碰边。闭眼参考按不动的嘴、鼻定位，取贴片时向左对齐 18 原图像素。

## 导出

在仓库根目录、准备好 Electron 与项目 FFmpeg 后运行：

```powershell
node_modules/electron/dist/electron.exe design/luna-2d/idle/export.cjs
node design/luna-2d/idle/encode.cjs
```

导出窗口隐藏，使用独立临时用户目录，不访问应用真实数据。编码脚本也支持第一个参数指定 FFmpeg 路径；默认使用项目固定的 8.0.1 构建工具。`frames/` 与 APNG 母版已忽略，不进入 Git。源文件使用相对路径，没有新的应用联网路径。

## 验证

- 隐藏 Electron 成功导出 192 张 RGBA 帧；t=0 与 t=8 的渲染 PNG 逐字节一致。
- 已查看 `contact-sheet.png` 的睁眼、闭眼、耳朵和尾巴采样。
- 全部帧的手部/嘴部采样区域固定；耳朵、尾巴和眨眼区域实际有变化。全部帧外边框 alpha 为 0，无裁边。
- WebP/APNG/GIF 均读取到 192 帧，总时长约 8 秒，透明动画 alpha 范围 0–255。数值见 `verification.json`；MP4 用 ffprobe 单独检查。
- 导出工具已通过 Node 语法与 Prettier 检查。应用接入已另行验证，最新结果以根目录 HANDOFF.md 为准。

下一步按应用内体验反馈调整幅度或节奏，其他姿势另行确定范围。
