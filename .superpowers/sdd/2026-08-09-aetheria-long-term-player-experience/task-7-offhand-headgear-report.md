# Task 7A report — canonical catalog and offhand/headgear art

## Outcome

- Corrected the player-equipment authority to the literal `ITEMS.weapons + ITEMS.armors` buckets. The live catalog contains `229` unique names and runtime paths: `weapon 117`, `armor 91`, and `shield 21`; cohort counts are armor `82`, offhand/headgear `21`, signature/mythic `25`, weapon core `54`, and ranged/magic `47`.
- Removed the four modifier templates `날카로운`, `묵직한`, `단단한`, and `수호의` from catalog, artwork, runtime, manifest, and provenance identity surfaces. No replacement player items were invented.
- Fixed morphology at the source: `신전 제관 예복` is an armor robe rather than a circlet; `암살자 장갑` is an exact pair of leather gloves; `드래곤 임페리얼`, 화염/냉기 방어복, and `심해의 수호복` are plate; `천공 성전` is a holy scripture tome; non-element plate uses steel material language. Prompt generation now requires one cohort and one family, and the processor rejects a mixed-family batch before any write.
- Rebuilt core sword sheets 01 and 02 from honest five-identity sources with a transparent trailing cell. The current core ledger contains `54` identities across sword `24`, dagger `19`, and heavy `11`, with `11` accepted and `12` rejected raw candidates retained in generation review.
- Published exactly `21` offhand/headgear identities from seven family-pure true-RGBA `600x400` sheets: book `5`, shield `6+6+1`, hood `1`, straw hat `1`, and wizard hat `1`. The offhand generation review retains seven accepted candidates and three rejected boundary-touch candidates with exact hashes and reasons.

## Evidence

- Catalog pin: `c15c4e6fc7ad99e37c616cc4303821fe3ce58238d2f5d98d667c5b0cb83c3ad0`; catalog-row pin: `23f584c89b5a82d2ba110e695d3a566defdbff036400a61122f750ca8a86c5ed`.
- `docs/evidence/art/equipment-offhand-headgear-provenance.json` binds batch order, accepted/rejected raw hashes, tracked source hashes, runtime export hashes, replay keys, and the independent generation-review pin.
- `docs/evidence/art/equipment-offhand-headgear-contact-sheet.png` shows all 21 identities at native `160px` and `32px` inset. Original-size inspection found no clipping, chroma residue, false cell content, or ambiguous shield/book/headgear ordering.
- Core, ranged/magic, and character provenance pins were cascaded to the corrected catalog before offhand publication. The regenerated core contact sheet was also inspected at original size.

## Verification

- `npm run art:verify -- --cohort weapon-core` — GREEN `54/54`.
- `npm run art:verify -- --cohort weapon-ranged-magic` — GREEN `47/47`.
- `npm run art:verify -- --scope characters` — GREEN `18/18`.
- `npm run art:verify -- --cohort offhand-headgear` — GREEN `21/21`.
- Focused art contract, pipeline, runtime, and item-visual suite — GREEN `120/120`.
- Provenance-integrity regression — GREEN `35/35`.
- `npm run verify` — GREEN: type-check, lint, unit `3618/3618`, build guard.
- `git diff --check` — GREEN.

## Held boundary

- Task 7B owns armor `82`: boots `1`, cloak `12`, coat `7`, leather `10`, plate `32`, and robe `20`.
- The Art Bible still needs all 22 defined family exemplars. Four families unused by the live catalog — `headgear-cap`, `headgear-circlet`, `headgear-helm`, and `headgear-mask` — require exemplar art without adding fake player items.
- Task 8 still owns signature/mythic `25`, top-level equipment `styleVersion: 2`, full-surface `npm run art:verify`, and the approved `art-contract-report.json`.
- Task 7A is intentionally uncommitted and unpushed pending independent review. Pre-existing untracked `build/` was not targeted or staged.
