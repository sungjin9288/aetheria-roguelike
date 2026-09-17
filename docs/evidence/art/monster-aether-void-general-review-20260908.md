# Aether ruins / void corridor visual audit — 2026-09-08

Owner read-only audit of14 non-boss canonical portraits. `output/audit-aether-void-monsters.py` verified all runtime SHA against the current manifest and produced3 complete160/32px dark/light sheets: `output/playwright/aether-void-audit-{1,2,3}.png`. Owner opened all3. Exact numbered mapping: `/tmp/aetheria-aether-void-audit.json`. No runtime, save or numeric change.

## Important — body/motif represented only by an unrelated prototype (2)

- 공허의 파편 (`monster-6d8a68e4891e`): one intact sword/shield ghost knight plus a flat eye emblem and rings. No fragment body. Needs an actual broken/fragmented void form, with separated readable material pieces rather than an intact knight with symbols.
- 심연의 눈 (`monster-63449f49b704`): green leafy tree spirit with antlers and a flat eye pasted over its face. The eye should be the actual integrated monster body/anatomy, not an icon masking a plant sprite. Needs a readable sinister eye entity without leaf/tree anatomy.

## Contextual — insufficient anatomy contract (7)

공허 마법사 has a robed fiery caster body; 에테르 방랑자 and 허무 집행관 are fiery spirits; 에테르 잔류체 and 에테르 흡수체 are tree spirits; 차원 방랑자 and 차원의 포식자 are ghost knights. Names do not uniquely prescribe a species for these roles, but ether/void/absorption/predation cues are mostly supplied by identical eye/ring overlays. They need design judgment, not automatic numeric or species changes. These seven are not approved for final polish by this triage.

## No obvious role/body contradiction in this pass (5)

공허 감시병, 공허의 감시자, 붕괴된 수호자, 붕괴한 수호자 and 허무의 기사 use skeletal/spectral armed bodies compatible with guard/knight roles. This does not establish distinct design quality.

Cross-cutting style debt: flat eyes obscure native faces and produce duplicate-face cues on some spirits, while rings and corner markers repeat regardless of anatomy. This should remain explicit in the final visual audit; a valid hash or readable role does not approve those embellishments. The two definite corrections remain separate from v15's currently running verification. No new source art was generated for this cohort.
