# Chaos / rift / demon castle / dragon nest audit — 2026-09-08

Read-only owner audit of15 non-boss portraits. All three `output/playwright/chaos-rift-audit-{1,2,3}.png` sheets were opened at160/32px on dark/light backgrounds. `output/audit-chaos-rift-monsters.py` verified runtime SHA against the manifest; exact names/keys/source paths are in `/tmp/aetheria-chaos-rift-audit.json`. No runtime or numeric changes.

## Important — missing defining body or combat role (5)

- 공허 포격수 (`monster-70eca38ea027`): sword/shield ghost knight with eye/rings, no bombardment equipment or firing anatomy. Needs an integrated ranged cannon/artillery implement, not a flat cannon icon added to a melee knight.
- 공허의 짐승 (`monster-95f3dd312dfa`): small floating smiling flame with extra eye emblem, no beast anatomy. Needs a readable predatory animal/creature body distinct from a generic floating elemental.
- 드래곤 나이트 (`monster-b4eab5883617`): ordinary quadruped red dragon, no knight equipment, mounted rider or martial role. Needs a clearly draconic knight (armored draconic humanoid is the smallest single-sprite direction) rather than implying every dragon is a knight.
- 차원 보병 (`monster-cc41c70e8174`): leaf/tree spirit with an eye emblem, no foot-soldier stance or equipment. Needs a readable martial infantry body/loadout; dimensional affinity does not replace the soldier role.
- 타락한 천사 (`monster-33283819c4b1`): crowned fire-lord caster, no recognizable angelic body or fallen-angel motif. Needs a readable winged fallen angel silhouette with tarnished sacred clothing; not horns/crown pasted on a fire caster.

## Contextual — insufficient exact form contract (6)

균열 감시자 is a hooded kobold guard; 마왕의 사도 a crowned caster; 에테르 돌격대 a floating flame spirit; 차원 사령관 a spectral knight; 혼돈의 추종자 and 혼돈의 화신 flame spirits. Role-specific signals and shared eye/ring embellishments are weak, but no unique species/anatomy is established by these names alone. Keep them pending for design judgment instead of inventing numeric or species requirements.

## No obvious body/role contradiction in this pass (4)

심연의 수호자 and 지옥의 문지기 have armed guard bodies; 타락한 용사는 an armed spectral warrior; 화염 와이번 has a winged fire-draconic form. This does not certify fine anatomy, independently authored uniqueness, or final visual polish. No unsupported exact wing/leg taxonomy is imposed by this audit.

Next correction batch can pair these5 with 공허의 파편/심연의 눈 from the aether/void audit (total7), after v15 local verification. Require separate name/body prompts, original preservation, actual small-size review and TDD integration. This audit alone does not approve replacements or full-catalog completion.
