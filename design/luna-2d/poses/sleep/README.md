# 克劳德睡眠动画

`sleep-approved.png` 原样复制自用户确认的 `sleep-left-preview-v2.png`：保留歪头，头肩向画面左侧靠，双臂交叠枕睡，右侧头发收拢。已重新制作更可见的呼吸、耳尖微动和独立尾巴慢摆；清醒时仍用原默认姿势。动画预览为 `sleep-motion-preview.webp`，旧预览仅作对比。

- 造型：双臂交叠枕睡，头向画面左侧倾，一只手自然搭在前臂上，闭眼安静休息；保留橙色长卷发、虎耳虎尾、黑白花饰及几何服装，2D 平涂与柔和明暗。
- 参考：`../../default-pose.png` 是身份、脸型、比例与服装主参考；`../../style-reference.png` 是画风辅参考。
- 原图由内置 image_gen 参考此前睡姿生成，实际完整提示词为 `sleep-left-prompt-v2.txt`。用户确认后原样复制，保留 PNG/alpha；旧提示词只记录历史版本。
- 文件检查：1448×1086 RGBA、alpha 0–255、四角透明，与确认预览逐字节一致。
- 当前确认稿 SHA256：`40ed5dea73c505de2bbc2e1437cc95722efee3c7f68b09c90727c5db5f459577`。

## 动画与接入

- `sleep.js` / `index.html`：从确认原图确定性渲染，6 秒、24 FPS、144 帧。后背/发顶呼吸，偶尔耳尖微抖；尾巴单独遮罩分层慢摆，上方弯钩整体旋转、根部在与头发相接之前过渡到零，不牵动前景头发；遮罩沿外侧透明缝，使用最近邻采样，避免切进尾巴产生裂缝；脸、双手和前臂固定，不整体升降或缩放。
- 映射为 `(x+52)/1552`、`(y+80)/1182`，与默认待机同一比例、下方支撑线；透明留白不裁掉。原始 PNG 与 alpha 不变。
- 运行图集 `assets/luna-2d/sleep.webp`，384×292/帧、12 列、4608×3504；通过现有播放器播放。减少动态效果时固定第一帧；可选素材失败回退半速待机。
- `idle.js` 按本机时间每天 22:00–次日 07:00、12:30–14:00 到点入睡；点击唤醒后，时段内闲置 5 分钟再睡。普通键鼠不唤醒，结束时段自动醒来。到点提醒/拖入收藏保留唤醒；待处理提醒优先。
- 睡姿不沿用清醒姿势的耳尾变形或身体命中地图；当前帧 alpha 内点击只唤醒，透明处穿透。

## 重建与验证

在仓库根目录运行（启动 Electron 时应清除继承的 `ELECTRON_RUN_AS_NODE`）：

```powershell
node_modules/electron/dist/electron.exe design/luna-2d/poses/sleep/export.cjs
python design/chibi/build-atlas.py design/luna-2d/poses/sleep/frames assets/luna-2d/sleep.webp --crop 0,0,768,584 --width 384 --columns 12 --quality 90
python design/luna-2d/poses/sleep/verify.py --atlas
```

导出使用独立临时资料、隐藏窗口，无联网或用户数据访问。`frames/` 为可重建中间文件，不提交。导出校验 t=0 与 t=6 PNG 完全相同；`verify.py` 检查 144 帧透明边缘、固定脸颊/胳膊像素与实际呼吸/耳抖/尾巴运动，报告见 `verification.json`。应用专项 `electron . --smoke-test --sleep-test` 使用独立用户目录和注入时钟，除帧号外还检查画布真实像素变化；覆盖时段边界、点击与缩放命中、跨午夜、闲置再睡、提醒优先、减少动态效果、缺图回退与迟到加载，不修改 Windows 时间。

`--atlas` 同时检查源帧和实际图集：将尾巴上半部的 1518 个不透明内部采样点按当前帧角度旋转，验证每一帧无透明裂口；脸/手/前臂与透明边界检查保留。该回归曾在旧遮罩的导出帧失败，修正后通过。
