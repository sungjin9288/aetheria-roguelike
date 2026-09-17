# Later ice-region visual audit — 2026-09-08

Owner opened both `output/playwright/ice-late-audit-{1,2}.png` sheets:8 canonical non-boss portraits from frost-storm-ruins, glacial-abyss and ice-citadel, at160/32px on dark/light. Generator `output/audit-ice-late-monsters.py` verified each SHA against the current manifest; mapping in `/tmp/aetheria-ice-late-audit.json`. No runtime change.

## Important — missing or contradictory defining material/element (6)

- 서리 골렘: brown bare stone guardian, no frost material; needs readable frost-encrusted construct surfaces rather than warm corner markers.
- 서리 마법사: bright fire-lord caster with flames and red staff. Needs cold spellcaster clothing and integrated frost implement, no flame body.
- 서리 정령: leafy green tree sprite, no frost anatomy. Needs frost/mist/ice spirit body distinct from foliage.
- 아이스 골렘: brown bare stone guardian, no ice body. Needs clearly icy faceted construct; distinguish from frost-coated stone golem.
- 얼음 거인: same squat brown rock guardian. Needs tall/broad giant silhouette with an explicit ice material/armor cue; not the same small stone guardian reused unchanged.
- 프로스트 위치: fire-lord caster with flames/red staff. Needs an identifiable frost witch with cold robe/hood and casting implement; distinguish from generic frost mage.

## Contextual (1)

얼음 기사 is an armed spectral knight, so martial anatomy is plausible, but pale brown armor and warm markers give weak cold identity. Keep visual decision pending; do not infer numeric changes.

## Previously authored anchor (1)

스노우 울프 retains its corrected complete white four-legged wolf body. This pass did not discover a new obvious semantic contradiction.

These6 are separate subsequent corrections, not included in v15. Exact current source paths/keys are in the mapping and canonical manifest. Alpha/hash coverage alone cannot prove ice semantics; no drop, EXP, event or enemy-stat changes follow from this audit.
