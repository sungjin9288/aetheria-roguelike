# Cave and snowfield general monsters — semantic audit

2026-09-07: owner directly inspected12 non-boss, non-authored runtime PNGs in dark-cave/crystal-cave/northern-snowfield, grouped3/3/3/3. All12 current PNG SHA-256 values matched the manifest. Production names, elements and map membership were cross-checked in src/data/monsters.ts and src/data/maps.ts. This is original-size evidence, not32px or gameplay acceptance.

## Findings

| Decision | Name | Observed body and required direction |
| --- | --- | --- |
| Important | 결정 정령 | Leafy tree child with wooden antlers. Replace dominant wood/leaf body with coherent faceted crystal-spirit form. |
| Important | 광물 지네 | Stag beetle, including oversized beetle mandibles and short body. Needs long many-segmented centipede body with mineral plates; recolor alone cannot fix species. |
| Important | 다크 엘프 | Crowned orange fire lord. Needs clearly elven humanoid rather than flame body, with dark-element visual treatment; exact weapon is a design choice. |
| Contextual | 동굴 박쥐 | Bat body recognizable, but flame-like orange tail and yellow effects conflict with cave/dark direction. Review at actual size before final decision. |
| Important | 동굴 트롤 | Armored quadruped boar. Needs a distinct bulky troll body; do not change the monster name or stats to preserve boar artwork. |
| Important | 박쥐 떼 | Exactly one fire-bat body. Needs a readable cluster of bats; detached effect shapes do not constitute multiple creatures. |
| Contextual | 서리 늑대 | Ordinary brown wolf, no clear frost cue. Species matches, but cold-region identity remains weak and needs actual-size review. |
| Important | 설원 거인 | Brown articulated stone guardian. Needs a snowfield giant silhouette and cold-region identity instead of an unmodified stone construct. Specific flesh/armor details are design choices, not source mandates. |
| Important | 설인 | Same armored boar silhouette as cave troll. Needs an upright furry snow-creature body, not a quadruped pig. |
| Important | 수정 골렘 | Rounded brown stone blocks, no readable crystal facets. Construct role matches but named material does not; introduce dominant faceted crystal body/plates. |
| Contextual | 수정 지킴이 | Hooded reptilian spear carrier; guardian role has no fixed species in production. Do not reject solely for reptilian anatomy, but crystal-guardian cue and style need further review. |
| Important | 얼음 정령 | Green leafy child with wooden antlers. Needs coherent ice/snow elemental body without dominant foliage. |

Important9 / contextual3. No findings in this batch are closed or runtime-fixed. In combination with the prior two general-monster audits, there are17 confirmed open body/material/count mismatches and5 contextual candidates; this is not a complete254-monster audit.

## Reviewed bytes

All files under public/assets/monsters/catalog/.

| Name | File | SHA-256 |
| --- | --- | --- |
| 결정 정령 | monster-a59df9668da4.png | b5d31ad8dc5e8375958507c0ffc7cdda3305e6f9f1ef69116c59da86880b2886 |
| 광물 지네 | monster-5d862ec7cd8b.png | 8208447595facde30b778ffaf607c81998de5df8a5210ec6242f9724d01f3a00 |
| 다크 엘프 | monster-63bddf1692bc.png | d46289ad2feb2489b1b98c11d68f1dc8e6614d03a1abc5a78a3e320927f6ff6d |
| 동굴 박쥐 | monster-fa568995b479.png | e90e7ce3ede4dccdbaf4c22d64ec0f261b4e7ae2026de4b716887bcb840cb862 |
| 동굴 트롤 | monster-55ed31434fe6.png | a2a2d4a30d3b7621b66c9b6dae4c3699bcf9019e4e532fe6c0a322e07a5d8f7c |
| 박쥐 떼 | monster-a0ce67504415.png | 76299de9578a64c352a42f7bcf1a7ed0807cf8f38fc2d96c65f5a1bb78c2d13c |
| 서리 늑대 | monster-f2603ddfa05f.png | 5dae0a3795561814a053cac3ab574aaa4dc17004afca045cb0d50363c03f1f12 |
| 설원 거인 | monster-160fddb37d43.png | c57410536a6af890e9b64386cd7793ffd20151cc89d71e634f125b633b20a4d8 |
| 설인 | monster-19d905cef932.png | a8f6b3afe9483cdfaf3ac7c805b70fbc351da2917c81a2cbea8227573e7db087 |
| 수정 골렘 | monster-00b1ff34598b.png | 8cff1f2b024c4bf58e4027f3dc42d33ea68ea5ba88c99b9592508bdfb211919b |
| 수정 지킴이 | monster-75fce693d5c1.png | 986b7a27cad80c3a44aba6c83eb33bda93fdb46df3d381cb39c8e5502b96b2f9 |
| 얼음 정령 | monster-c26eb4f9bae8.png | 9600327f8f0f20ff42d40318f095701e4b1cca351e7d4bae19b586d7eb7009d6 |

## Follow-up

Reuse species direction where sensible (centipede variants, bat variants) without substituting tint for required anatomy. Preserve original PNGs and prior approved assets. Prior source generation and pixel-method approval remain separate; no image edits or runtime/evidence adoption occurred in this batch. No native artifact touched. Docs-only git diff --check passes; full gates remain governed by the latest separately recorded unit/art failure, not by this audit.
