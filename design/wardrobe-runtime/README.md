# 正式新装扮素材（2026-10-07）

用户批准接入银色短发、粉色双马尾、秘书制服、护士制服。最终款式参考 `../wardrobe-preview/`：两张秘书 v2、银色护士 v3、粉色护士 v3-soft；此前被拒绝的粉色护士原领口版本没有使用或重试。

本目录 `luna-*.png` 是内置 image_gen 生成的单帧透明原图，实际尺寸 887×1774。`prompts.json` 保存完整提示词集合与工具模式；发型/服装交叉搭配分别独立生成。`draft-bob-*-v1.png` 保留第一次交叉搭配的原始输出，最终版本已用图像工具去除肩部残留的长卷发。原有四张角色图没有替换。

`../prepare-wardrobe.cjs` 使用 Electron nativeImage 等比导出 512×1024 PNG 到 `../../assets/`，保留生成的透明通道，不去背景、不裁切人物。`export.json` 记录原尺寸、最终尺寸、透明比例和用于水平居中的身体中心。工具使用独立临时用户目录。发型/服装物品卡片使用 `assets/wardrobe-items-v2.png` 的 2×2 透明图集，保留旧图集。

正式渲染配置在 `character-assets.js`：四款发型 × 四款服装共 16 种，12 张新整身图复用原表情包，分别校准眼嘴坐标和局部尺寸；闭眼、开心、单眼眨眼、微笑、脸红不移动身体或头发。Node 测试检查所有搭配对应的 PNG 尺寸与配置；Electron smoke 检查全部选择、保存、显示、alpha 与局部表情像素，并输出临时全身/脸部截图。

这些文件属于项目设计源码，便携版直接使用 `assets/`，无需访问 Codex 生成目录或联网。

用户随后要求服装卡片只显示衣服。已使用内置 image_gen 编辑 `assets/wardrobe-items-v2.png`，移除秘书/护士卡片内的鞋子、帽子、袜子并居中显示衣服；角色穿着素材不变。旧图集保存为 `wardrobe-items-with-accessories.png`，准确编辑提示词见 `clothes-only-prompt.txt`。
