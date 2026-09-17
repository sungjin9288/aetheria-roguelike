# Machine, laboratory, vault and pyramid — semantic audit

Owner inspected16 non-boss/non-authored canonical images at original160px and32px in `output/playwright/machine-audit-{1,2,3}.png`; all16 file hashes match the manifest. Selection is machine-ruins/abandoned-laboratory/ancient-vault/pyramid. Names and production entries were checked in src/data/monsters.ts. This is source review only, not natural progression or final gameplay acceptance.

## Findings

| Decision | Name | Observed body/material and required direction |
| --- | --- | --- |
| Important | 강철 자동인형 | Molten cracked-rock golem plus detached status-like decorations. Needs readable steel automaton body/joints rather than lava rock. |
| Important | 과부하 포격기 | Plain stone guardian without a cannon/barrel. Needs artillery machinery silhouette and overload cue; appended bars are not a weapon. |
| Important | 미라 | Bare skeleton with sword/shield, no wrapping. Needs recognizable wrapped mummy body, not another skeleton soldier. |
| Important | 생체 병기 | Lava-rock golem with detached status decorations. Needs dominant organic/engineered biological body instead of ordinary mineral construct. |
| Important | 오염된 연구원 | Crowned fire lord in royal robes. Needs identifiable contaminated researcher role; exact species is not constrained, but fire royalty alone does not convey researcher. |
| Important | 오작동 로봇 | Same molten-rock body with appended bars. Needs machinery/joints and malfunction cue, not rock tint. |
| Important | 증기 골렘 | Cool stone blocks and cyan rune, no steam mechanism. Needs readable boiler/piston/steam construct material. |
| Important | 폐회로 마도병 | Molten rock golem with detached bars. Needs circuit/magic soldier role integrated into body/equipment, not generic rock golem. |
| Important | 폭주 자동인형 | Ordinary stone guardian with detached bars. Needs an articulated automaton identity and runaway cue. |
| Contextual | 변이 실험체 | Hooded reptilian traveler with spear; species could be experimental, but mutation/experiment cue is absent. No arbitrary required anatomy inferred. |
| Contextual | 부식된 골렘 | Cool gray/cyan stone construct; corrosion/material direction is weak. Do not demand metal from the word golem alone. |
| Contextual | 실험실 수호자 | Floating skeletal armored guardian. Guardian species is unspecified; laboratory-role connection needs review, not automatic rejection of undead anatomy. |
| Contextual | 전류 추적자 | Brown humanoid dual-blade scout with no current/electric cue. Tracker role fits but electrical identity is weak. |
| Contextual | 황금 골렘 | Brown-gold stone guardian. Gold direction is suggested by palette but metallic material/readability needs review. |
| No obvious name conflict in this pass | 보물사냥꾼 | Covered traveler/rogue with two blades. Exact tools/species are not mandated; needs style/differentiation review, not automatic body replacement. |
| No obvious name conflict in this pass | 사막도적 | Sandy hooded goblin with crossbow. Bandit need not be human; anatomy alone is not a defect. |

Important9/contextual5/no-obvious-name-conflict2. Repeated detached meter-like bars/disks and corner marks are shared prototype-decoration debt, not proof of mechanical anatomy. This pass does not approve all16 or the entire254 catalog.

## Reviewed bytes

| Name | Runtime path | SHA-256 |
| --- | --- | --- |
| 강철 자동인형 | /assets/monsters/catalog/monster-89fb5c7e37b7.png | 42b3978a5d452e804911de909597ba069aa5ef1fdb4b4550d637db4bedb780fb |
| 과부하 포격기 | /assets/monsters/catalog/monster-5a21f496f3dc.png | aee972bed10d0058708b88ba5365c5d48b7ff34c68a9951172854077e52254b3 |
| 미라 | /assets/monsters/catalog/monster-4236ae06d677.png | 66fbafdda502e0dda9a505c3a4c7818367abde1f392ed6442ce93c9836602b6d |
| 변이 실험체 | /assets/monsters/catalog/monster-9da39d1152ff.png | 4d144be0789b02beadcf0746001b792c9c10f049b7eeb1a0ef2a7d45096b28db |
| 보물사냥꾼 | /assets/monsters/catalog/monster-5d7ee3a7e436.png | b4358d2dd6a0229fb2e02c40c72d3ac36043ea4717afd9f11e46ac030f2048f4 |
| 부식된 골렘 | /assets/monsters/catalog/monster-3c859cb03bef.png | 7714bc01d8522fb8c0d231d6ae76aa4bc6be803aa1c35b3b113c4be896eda0e7 |
| 사막도적 | /assets/monsters/catalog/monster-e3d186c7c1ce.png | ab75ef0a29d96c65b27250d4802fb20ca82649f6841e765c22cb34b4c981d91d |
| 생체 병기 | /assets/monsters/catalog/monster-cf0ab0cbcb7b.png | 3c1586f38c6428ef635808ba3e5a5d8313164a6af3ed61daf1eddc62d78a8e91 |
| 실험실 수호자 | /assets/monsters/catalog/monster-258dc3a004e1.png | af1b6dafe66fa5100b44134e4c108adcebde6accfd57a98375fada5b410d3306 |
| 오염된 연구원 | /assets/monsters/catalog/monster-5731714ce0b3.png | 026d2bcf889686ce5bcebf5f1c610d355c2ec414d326630a09c14b6f55bedccf |
| 오작동 로봇 | /assets/monsters/catalog/monster-97f98262af85.png | 90ae1ed6c5ef312deb0461b6c823371f065f4ca121fdc62c28431ad92d9f8cec |
| 전류 추적자 | /assets/monsters/catalog/monster-60f43416e1e9.png | a84d012c26f3b0ee7b0c47036047a9afef65bbb738c2271d88b2ef63ab69dea1 |
| 증기 골렘 | /assets/monsters/catalog/monster-390a7a20c1c4.png | bdffc54966aa6c0e6bd2da84122fdd0af45572e90ab7bcfa4c579536370e3973 |
| 폐회로 마도병 | /assets/monsters/catalog/monster-e7fc6feb2ab9.png | a8c947569baf06875fa63d2a7ecec59b2ce7300982a045bb53a1b59669f811d4 |
| 폭주 자동인형 | /assets/monsters/catalog/monster-78428d074a53.png | d09a84aa2c1d9f4525f5b90c8d08ce89550407a81294a00a4adb7e7182fd24cb |
| 황금 골렘 | /assets/monsters/catalog/monster-5fb35c603abc.png | 735c7559f7e0b4895cb286a2cfc80a54ac511b3b526341caffcbb4046d6dbef7 |

## Follow-up

No runtime/art/gameplay changes in this audit. Keep these9 newly confirmed defects separate from the running v8 cave/snow full54204. Combined with the fire tranche,19 new Important corrections await original-preserving design, actual-size review, TDD adoption and real surface verification. Contextual cases remain separate decisions. Latest completed full/native artifact is still the prior character checkpoint until v8 terminal proof is recorded.
