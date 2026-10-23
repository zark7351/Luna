# 克劳德睡眠动画

`sleep-approved.png` 是用户从本次两张调整图中选择的第二张：头更低、脸颊直接贴在画面左侧的胳膊袖面上，作为确认的睡姿原图。已制作局部轻呼吸并接入睡眠状态；清醒时仍用原默认姿势。`sleep-preview-v1.png` 仅保留为前版参考。

- 造型：双臂交叠枕睡，头下沉并向画面左侧倾，脸颊直接靠胳膊，不以手掌托头，闭眼安静休息；保留橙色长卷发、虎耳虎尾、黑白花饰及几何服装，2D 平涂与柔和明暗。
- 参考：`../../default-pose.png` 是身份、脸型、比例与服装主参考；`../../style-reference.png` 是画风辅参考。
- 使用内置 image_gen 生成，要求透明背景，保留工具输出原始 PNG/alpha，不做二次抠图或重编码。确认稿以 `sleep-preview-v1.png` 为编辑输入，完整实际提示词是 `prompt-v2.txt`；前版提示词是 `prompt-v1.txt`。
- 文件检查：确认稿和前版均为 1448×1086 RGBA、alpha 0–255、四角全透明。前版 SHA256 为 `5c377767c241898c2633c8970a59a97a6e8747fb72ef1b4d71f58fb53b7d2182`。
- 确认稿 SHA256：`fff02ff4a7707947a7c4c319a1d960a366e5d93865ce7cd9cd0a41c0c7176311`。

## 动画与接入

- `sleep.js` / `index.html`：从确认原图确定性渲染，6 秒、24 FPS、144 帧。后背/头发轻呼吸，偶尔耳尖微抖；脸、脸颊贴臂接触点、两侧前臂与手保持固定，不整体升降或缩放。
- 映射为 `(x+52)/1552`、`(y+80)/1182`，与默认待机同一比例、下方支撑线；透明留白不裁掉。原始 PNG 与 alpha 不变。
- 运行图集 `assets/luna-2d/sleep.webp`，384×292/帧、12 列、4608×3504，约 3.45 MiB；通过现有图集播放器播放。减少动态效果时固定第一帧；可选素材失败回退半速待机。
- `idle.js` 按本机时间每天 22:00–次日 07:00、12:30–14:00 到点入睡；点击唤醒后，时段内闲置 5 分钟再睡。普通键鼠不唤醒，结束时段自动醒来。到点提醒/拖入收藏保留唤醒；待处理提醒优先。
- 睡姿不沿用清醒姿势的耳尾变形或身体命中地图；当前帧 alpha 内点击只唤醒，透明处穿透。

## 重建与验证

在仓库根目录运行（启动 Electron 时应清除继承的 `ELECTRON_RUN_AS_NODE`）：

```powershell
node_modules/electron/dist/electron.exe design/luna-2d/poses/sleep/export.cjs
python design/chibi/build-atlas.py design/luna-2d/poses/sleep/frames assets/luna-2d/sleep.webp --crop 0,0,768,584 --width 384 --columns 12 --quality 90
python design/luna-2d/poses/sleep/verify.py
```

导出使用独立临时资料、隐藏窗口，无联网或用户数据访问。`frames/` 为可重建中间文件，不提交。导出校验 t=0 与 t=6 PNG 完全相同；`verify.py` 检查 144 帧透明边缘、固定脸颊/胳膊像素与实际呼吸/耳抖，报告见 `verification.json`。应用专项 `electron . --smoke-test --sleep-test` 使用独立用户目录和注入时钟，覆盖时段边界、点击与缩放命中、跨午夜、闲置再睡、提醒优先、减少动态效果、缺图回退与迟到加载，不修改 Windows 时间。
