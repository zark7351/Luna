# 新装扮效果预览

用户同意改用更保守的浅 V 领，露出锁骨和少量上胸，不强调胸线。内置 imagegen 成功生成 luna-pink-twintails-nurse-v3-soft.png，保留粉色双马尾、原裙长和膝下白袜；已查看完整全身结果。此图是新的替代设计，此前被拒绝的原领口方案仍没有输出。当前仅为效果预览。

2026-10-07 用户明确要求粉色护士领口再试一次。按原参考 v2 与下方原护士 v3 提示词正常重试一次，内置 imagegen 再次在输入阶段拒绝（moderation_blocked / sexual）；没有新图，粉色护士仍使用 v2。

秘书装按用户要求也降低衬衫领口，露出少量上胸，新增 luna-silver-bob-secretary-v2.png 与 luna-pink-twintails-secretary-v2.png。两版均已生成并查看，保留马甲、包裙、黑丝袜与原全身构图；领结位置略有差异，正式素材制作时再统一。原版本保留，当前均未接入程序。

用户随后要求领口稍低、露出少量上胸。内置 imagegen 完成银色短发版 luna-silver-bob-nurse-v3.png，领口轻微开低，保留 v2 裙长与膝下白袜。粉色双马尾版请求被生成工具安全检查拒绝（sexual），没有 v3 输出，仍保留 v2；本次没有改程序。

用户随后要求护士裙再短一些。新增 luna-silver-bob-nurse-v2.png 与 luna-pink-twintails-nurse-v2.png，将裙摆提高至大腿中段附近，保留膝下白袜、发型、脸部、制服上身与全身构图。原预览留作对照，两张 v2 仍为效果图，未加入程序。

2026-10-07：用户要求银色短发、粉色双马尾，秘书制服、护士制服，先看效果图。使用内置 imagegen，参考 assets/character.png 最左正常表情帧生成四种搭配；当前仅为设计预览，未接入程序，不是透明运行素材。

- luna-silver-bob-secretary.png：银色短发 × 秘书制服。
- luna-pink-twintails-secretary.png：粉色双马尾 × 秘书制服。
- luna-silver-bob-nurse.png：银色短发 × 护士制服。
- luna-pink-twintails-nurse.png：粉色双马尾 × 护士制服。

四图均为全身、浅紫背景；已检查头发、鞋子不裁切，护士装白袜到膝下。独立生成的领结、口袋等细节略有差异，批准款式后制作正式搭配时需要统一。后续仍按 CHARACTER-ASSETS.md 的混合方案制作透明正常站姿与表情，不直接将这些预览缩成运行图。

## 提示词

粉色护士保守浅 V 领方案，引用粉色护士 v2，使用内置 imagegen：

```text
Fashion illustration edit, identity-preserve. Reference is Luna, the project's adult woman in her mid twenties, in her existing pink twin ponytail nurse outfit preview. The approved new alternative design is a conservative, small SHALLOW V collar exposing only collarbones and a small area of the upper sternum. The bottom of the V must stop HIGH on the upper chest, well above the bust, with the rest of the bodice remaining completely closed. Redraw only the collar seam and neckline into this softly curved, slightly more open shape, retaining neat blush pink piping and the elegant nurse dress. Do not alter the silhouette or fit of the torso. Preserve exact face, violet eyes, gentle expression, hair, hair ribbons, nurse cap, necklace if present, sleeves, buttons below the collar, belt, pockets, hands, existing skirt length, legs, below-knee white socks, shoes, unchanged full-body standing pose, pale lavender background, anime rendering and framing. This is a modest collar design study. No added accessories or text.
```

秘书装 v2 使用内置 imagegen，分别引用对应秘书原预览：

```text
Use case: identity-preserve / clothing fashion edit. Edit this full-body concept preview of Luna, an adult anime woman in her mid twenties. Adjust only her secretary outfit neckline: open the top two buttons of the white blouse and arrange its collar into an elegant slightly lower V, showing a small amount of upper chest with a subtle natural cleavage line, similar to a tasteful low-neck fashion blouse. Keep the blouse and charcoal waistcoat opaque and fully covering her breasts. Preserve the same bust size and all adult body proportions. Keep the muted lavender ribbon as a small accent at the base of the new neckline so that it doesn't cover the opened collar. Preserve her exact face, violet eyes, gentle smile, hairstyle and hair color, waistcoat tailoring, skirt length and shape, clasped hands, slim legs, black tights, black pumps, pose, pale lavender background, full-body framing and painting style. This is a localized collar/blouse alteration, no other redesign, no extra accessories or text.
```

护士领口 v3 分别引用对应 v2，银色版成功、粉色版未生成。提示词：

```text
Use case: precise-object-edit / identity-preserve. Edit the attached preview of Luna, a clearly adult anime woman in her mid twenties. Make a small fashion-design change ONLY to the neckline of the nurse dress: lower and gently open the existing collar into a softly curved shallow V neckline, approximately 3-4 cm lower than the current neckline, revealing a little upper chest and a subtle natural cleavage line. Keep this tasteful and non-explicit, opaque fabric fully covering the breasts, no nipples and no sheer fabric. Preserve the existing pink collar piping and nurse uniform style; move the uppermost button just beneath the new neckline as necessary, without opening the entire button placket. Keep her exact existing face, violet eyes, smile, adult body size and bust size, hair color and hairstyle, cap, shoulders, sleeves, waist belt, pockets, clasped hands, mid-thigh skirt length, leg proportions, below-knee white socks, shoes, pose, pale lavender background, lighting, anime linework, full-body framing and image dimensions unchanged. Do not shorten the skirt further, enlarge her chest, or add accessories. Localized edit around collar/upper chest only.
```

护士裙 v2 使用内置 imagegen，分别引用原银色短发／粉色双马尾护士预览。编辑提示词：

```text
Use case: precise-object-edit / identity-preserve. Edit the supplied full-body outfit preview of Luna, an adult anime woman in her mid twenties. Make ONLY the nurse dress skirt noticeably shorter: raise its bottom hem to the mid-thigh, approximately halfway from her hip crease to her kneecap, about 10-12 cm shorter than the current hem. Retain a clean gently flared A-line mini skirt with soft fabric folds and an evenly tailored hem; the dress still fully covers her hips and underwear in this unchanged standing pose. Keep the exact same face, violet eyes, expression, hairstyle and hair color, nurse cap, torso, collar, sleeves, pink trim, waist belt, pocket design, hands, slim adult body proportions, knees, knee-high white socks ENDING BELOW THE KNEECAPS, shoes, pale lavender background, lighting, linework, full-body framing and canvas dimensions. Do not lengthen stockings, do not change the pose or camera, no additional skin exposure elsewhere, no extra accessories or text. The edit should be concentrated on the hem and newly visible mid-thigh area; everything else should remain identical.
```

四次生成的公共提示：

```text
Use case: identity-preserve. Asset type: preview concept illustration for Luna, an existing Windows anime desktop pet. Reference image is the existing Luna three-frame sprite sheet: use ONLY THE LEFTMOST OPEN-EYED FRAME as identity, face, body proportion, illustration style and neutral pose reference. Output one character ONLY, NOT a sprite sheet. Luna is an adult woman in her mid twenties, same violet eyes, gentle smile, same face and fair skin, elegant slender proportions, slim legs, hands gently clasped in front, standing front-facing with a slight natural three-quarter angle exactly like the reference. Faithfully match the soft polished Japanese anime painting, delicate clean linework, subtle fabric shading; do not redesign her face, do not make a child or chibi. Complete full body from top of hair to soles of shoes, ample 6% clear margin above and below, absolutely no cropped shoes or hair, portrait composition on plain very pale warm lavender studio background, no scenery, no UI, no text, no watermark. This is a static outfit preview, not runtime artwork. Change only hairstyle and outfit as specified, preserving character identity and body shape. No props, no extra people, no suggestive pose, no exaggerated bust or hips.
```

每次附加对应发型和服装段落：

```text
Silver bob:
Hair: true cool silver short hair, a neat chin-to-upper-neck length layered bob, soft inward-curving ends, airy wispy bangs framing the same eyes, a small purple hair pin. Hair must be genuinely short, not shoulder-length and not a long ponytail.

Pink twin ponytails:
Hair: pastel rose pink long twin ponytails, symmetric high side ties with small lavender ribbons, soft gently wavy tails reaching the waist, light natural bangs framing her same face. Clearly pink, not purple, silver or black.

Secretary uniform:
Outfit: an elegant flattering secretary office uniform, fitted white collared blouse fully buttoned, slim dark charcoal/navy waistcoat, a small muted lilac neck ribbon, matching fitted pencil skirt ending just above the knees with a modest hem, sheer black tights and refined low-heeled black closed-toe pumps. Polished delicate tailoring, feminine and cute but professionally modest. No blazer obscuring the waistcoat; no bag, glasses, desk or paperwork.

Nurse uniform:
Outfit: a charming classic nurse uniform redesigned in Luna's delicate anime style, tailored white short-sleeve nurse dress with soft blush-pink piping on collar, sleeve hems, belt and pockets, clean button front, a fitted waist and subtle A-line skirt ending just above the knees, small white nurse cap with a subtle pink decorative plus motif. White knee-length socks ending just BELOW the kneecaps (absolutely no over-knee stockings) and white closed-toe low-heeled shoes. Cute polished uniform with realistic fabric folds, modest collar, no medical tools or syringe.
```
