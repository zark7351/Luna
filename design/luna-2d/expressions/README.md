# 克劳德微笑表情

- `smile-preview-v1.png`：用户已确认的 image_gen 编辑预览，以 `../default-pose.png` 为参考，保持半睁眼、单手托腮、温柔慵懒且略带大小姐的气质。
- 已原样复制到 `assets/luna-2d/smile-source.png`；运行时仅提取嘴部并羽化叠加到透明待机，不将白底整图用于人物背景，也不替换原始待机图集。映射与时序见 `character-assets.js` 和 `CHARACTER-ASSETS.md`。
- 场景：收藏成功、完成提醒、欢迎回来、轻点脑袋、偶尔主动陪伴；约 2.6 秒后回到中立表情，提醒到点优先，不额外增加发言频率。
