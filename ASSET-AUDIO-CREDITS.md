# UI 音效素材与处理

## 当前版本：自然实物音效（2026-10-02）

用户要求清脆、优雅、写实的点击声，替换上一版正弦波电子提示音。17 个 UI WAV 均来自 Kenney 的自然音效/拟音素材，经过剪裁、去低频、柔化高频、淡入淡出和峰值控制，不合成音高或旋律。到点提醒原来的 `assets/reminder.wav` 保留；无角色声音。运行时只播放本地文件，无下载路径。

作者：Kenney / Kenney Vleugels（https://kenney.nl）。下列两套资源采用 CC0；允许修改和随程序分发，保留来源及原素材随包许可文件便于追溯。

- UI SFX Set / UI Audio：https://opengameart.org/content/51-ui-sound-effects-buttons-switches-and-clicks 。作者标注为 organic sounds，CC0。
  - 下载：https://opengameart.org/sites/default/files/UI_SFX_Set.zip
  - ZIP SHA-256：`66026b9e39859b85964dbb3ee7a2d1fc46a6a406bb3e97c8b0defee0e25fb369`
  - 选用的原始 WAV 和附带 readme 位于 `assets/sound-sources/kenney-ui`。
- RPG Audio：https://kenney.nl/assets/rpg-audio 。官方标注 foley、CC0。
  - 下载：https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip
  - ZIP SHA-256：`6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b`
  - 所选 OGG 通过 Electron/Chromium OfflineAudioContext 解码为 44.1kHz、单声道 PCM16 WAV（多声道取平均），作为离线处理输入保留在 `assets/sound-sources/kenney-rpg`；附带 License.txt 保留原文。

## 操作与原素材

| 操作 | 原素材 | 处理后时长 |
|---|---|---|
| 点击 | UI mouseclick1 | 80ms |
| 页签 | UI click4 | 80ms |
| 选择 | UI click2 | 90ms |
| 开关 | UI switch12 | 90ms |
| 打开 | UI click1 | 120ms |
| 关闭 | UI click5 | 90ms |
| 保存 | RPG metalLatch | 280ms |
| 收藏 | RPG metalClick | 320ms |
| 复制 | UI click3 | 100ms |
| 删除 | UI switch26 | 250ms |
| 刷新 | RPG bookFlip2 | 350ms |
| 失败 | UI switch28 | 220ms |
| 截图开始 | UI mouserelease1 | 100ms |
| 截图完成 | UI switch15 | 280ms |
| 截图取消 | UI rollover2 | 90ms |
| 提醒完成 | RPG handleCoins2 | 350ms |
| 稍后提醒 | UI switch11 | 320ms |

执行 `node build-sounds.cjs` 可从保留的 PCM 输入重复生成 `assets/sounds`，无需联网或音频工具依赖。默认峰值 0.08–0.17，再乘播放器音量 0.65；保留总声音开关及触发逻辑。截图完成采用机械开关的咔嗒质感，不宣称来自相机快门实录。

### 面板开关调整

打开/关闭已替换原书本开合为短轻扣（UI click1 / click5）。使用 0.8ms 起音和 14ms 收尾，收尾按录音实际结束位置计算，避免只在补齐的静音段淡出。其他 15 个 UI 输出文件保持字节不变。此前 bookOpen/bookClose 原始输入保留供追溯，当前不再使用。
