# Kingdom and temple visual audit — 2026-09-08

Owner opened all three `output/playwright/kingdom-temple-audit-{1,2,3}.png` sheets: 11 canonical non-boss portraits from ancient-temple-city, golden-kingdom and fallen-outpost, at 160/32px on dark/light backgrounds. The generator verified PNG hashes against the manifest; exact mapping is `/tmp/aetheria-kingdom-temple-audit.json`. No runtime changes.

## Important — defining body, role or source lore conflict (5)

- 시간 파편체 (`monster-ead93e2bc219`): intact leafy tree sprite with detached diamonds. Fragmentation must belong to the body, not only corner markers.
- 신성한 제관 (`monster-9d7c9e12039d`): flaming fire-lord body with an added halo. A sacred officiant needs readable ceremonial clothing and an integrated ritual implement; the halo alone does not establish the role.
- 왕국 기사 (`monster-8426add1da12`): spectral hovering knight. The golden-kingdom map describes a thriving city of descendants, trade and adventurer guilds, not an undead kingdom. Use a living armored knight unless source lore explicitly establishes an undead exception.
- 용병 전사 (`monster-e387fcc22327`): bare skeletal soldier; the same living-city context requires a recognizable living mercenary, with practical equipment distinct from the royal knight.
- 황금 왕국 수호자 (`monster-a4d68b34cf9e`): bare skeleton with gold tint, without a justified undead identity. Establish a clearly armored kingdom guardian, not an unapproved new species in gameplay data.

## Contextual — role plausible but weak identity (4)

사기꾼 마법사 has a staff and robe but flames dominate its trickster identity. 신전 경비병 reads as a knife-wielding bandit rather than a ceremonial guard. 탐욕의 상인 has a backpack, but paired blades dominate and no trade cue is readable. 전초기지 파수꾼 is a skeletal armed guard; the fallen-outpost context does not by itself prove that undead anatomy is incorrect. These remain design-review candidates, not confirmed numeric or gameplay defects.

## No new obvious semantic conflict (2)

망령 기사단장 is an armed spectral knight; 영겁의 수호신상 is a stone construct. Neither verdict certifies whole-catalog quality. Repeated floating weapon/diamond decorations remain separate style debt.

These five corrections are a later batch, outside v15. Original files, gameplay values and saves remain unchanged.
