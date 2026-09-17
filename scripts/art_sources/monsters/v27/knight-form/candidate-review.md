# Knight-form eleven — candidate checkpoint

2026-09-10, approved remaining69 design group4/7. Candidate-only; no runtime adoption.

## Scope and originals

데스나이트, 망령 기사, 망령 기사단장, 유령 기사, 익사한 기사, 저주받은 기사, 타락 기사, 타락한 용사, 파멸의 기사, 지옥의 문지기, 허무의 기사.

Fourteen individual built-in image calls, eleven selected masters and three rejected outputs. `prompts.json` preserves initial prompts; `generation-records.json` contains final prompts, original paths, rejected records and the edit reference. All fourteen generated files are preserved byte-identically in `masters/` or `rejected/`. No CLI/API fallback, dependency installation or background-removal workaround.

## Corrections and final authority

Owner viewed all initial originals and all five initial review sheets. Two Important visual concerns were corrected:

- Initial death-knight relied too heavily on narrow highlights at dark32. An edit widened the plate planes but returned RGB with a baked checkerboard; this was rejected, not converted or silently accepted. A fresh transparent original retains solid black-steel identity with wider medium-gray chest/limb planes.
- Initial fallen-champion's damaged blade still read as a largely complete sword. A fresh transparent original has a broad short lower blade with a plainly broken end, a human face and a torn sideways cape.

`rejected/` preserves both initial masters and the opaque death-knight edit. Initial `exports/` and `review-*.png` remain unchanged. **Final authority: `masters/`, `exports-reviewed/*.png`, `exports-reviewed/receipt.json`, and `review-final-*.png`. Do not adopt initial exports.** Other nine exports are byte-identical to the initial candidates. Final sheets3–4 are byte-identical to initial sheets3–4.

Owner viewed the final death-knight and champion originals, final color sheets1–2 and final grayscale. Other nine originals and all initial sheets had already been viewed. Empty helmets, split wraith tails, single ghost tail, seaweed cape, asymmetric curse shoulder, angled shield, down-cut sword, paired gate shields and the void torso gap distinguish the approved roles. Final owner review has no remaining Critical/Important finding.

## Verification

1. `node --import tsx --test tests/remaining-knight-eleven.test.js`: RED3 with missing preparer.
2. Added source-pinned preparer using the existing threshold128/nearest160/binaryalpha/8px export contract; source drift, existing output, opaque and empty images fail before writes.
3. `node --import tsx --test tests/remaining-knight-eleven.test.js tests/remaining-guard-twelve.test.js tests/remaining-occupation-eleven.test.js tests/remaining-stone-six.test.js`: GREEN12 before and after the two final replacements. Includes byte-identical repeated exports and master preservation.
4. Initial export and final `prepare.py .../exports-reviewed` both exit0; initial `review.py` and final `review-final.py` exit0. No existing export/review was overwritten.
5. Independently checked all14 original copies, selected11 source/export hashes, other9 unchanged exports and final sheets3–4 equality. Actual final exports are RGBA160, binary alpha with minimum8px margin and bottom bound152. Threshold128 source bounds are unclipped for all11; void torso sample has actual alpha0.
6. Runtime69, manifest/registry/diagnostic snapshots3 and protected candidate6/Toss38 records remain byte-identical to V27 preflight.
7. `npx eslint tests/remaining-knight-eleven.test.js`, `git diff --check` PASS; native tracked drift0 and staging index empty.

Independent Sol/xhigh final verdict C0/I0. All five final sheets were independently inspected at160/46/32 dark/light and grayscale. Corrected death-knight retains readable gray body planes and its diagonal two-handed sword at dark32; champion's short broad fractured blade is distinct from a complete pointed sword. Wraith roles and remaining six role silhouettes agree with the approved contracts. Selected11/rejected3 hashes, actual alpha/margins/unclipped sources, other9 unchanged exports and final sheets3–4 equality independently PASS. The reviewer inspected test safety contracts but did not independently rerun the owner's focused12 tests.

Cumulative40/69 candidates accepted; remaining29 ungenerated. Next is approved caster-role7, without another design approval. Runtime is unchanged, so full/browser/native validation is deferred to stable69 adoption as specified in the approved plan. Latest local native remains retained26, unsigned and uninstalled. Whole Goal, device/lifecycle and S6 are not complete. No install/sign/commit/push/publish.
