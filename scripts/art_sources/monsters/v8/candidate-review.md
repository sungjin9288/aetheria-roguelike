# Cave/snow corrections — local runtime and native gates verified

## Canonical adoption and actual portrait review

The exact9 corrections are now installed in the local authored registry and canonical runtime PNGs. Adoption test first failed on missing9 registry entries (`/tmp/aetheria-v8-adoption-red.log`); classification test exposed snowfield giant's old construct category (`/tmp/aetheria-v8-classification-red.log`). Only that exact name now maps to warrior art; no gameplay monster stats changed. Generated final manifest matches the adopted file. Other245 metadata records and PNG hashes remain identical to `previous/manifest.json`; canonical coverage254 remains, authored corrections38→47 is not full254 visual approval.

Owner inspected all9 actual390×844 canonical combat screenshots `output/playwright/v8-canonical-<slug>-390x844.png`: expected image decoded160px and displayed46×46, name matches, overflowfalse, no opaque box. Console0errors/0warnings. Log `/tmp/aetheria-v8-canonical-review.log`. These use controlled QA enemies derived from seedCombatFocusScenario, fixed level2/HP134 and corresponding map labels, not naturally encountered enemies or combat balance proof. No user save/cloud mutation.

Evidence distinction: initial route-based captures still displayed old images despite correct path/decode. They are preserved under `output/playwright/v8-initial-sw-bypass-failure/` and excluded from PASS. The127.0.0.1 QA origin was service-worker controlled; a CDP-bypass attempt still failed the added “candidate response supplied” assertion. The exact routing failure is not established as an app defect. Candidate preflight therefore used explicit prepared-image DOM URLs (`v8-combat-*.png`), followed by a separate fresh localhost origin after canonical adoption, without DOM image replacement (`v8-canonical-*.png`). Both sets were owner-viewed; only the latter prove canonical UI display. Browser/dev are closed; no app workaround was introduced.

Post-adoption focused13/13 PASS (`/tmp/aetheria-v8-adoption-green.log`). Art write/verify, content and event-reward108rows/0errors PASS. Diagnostic write+verify41281 exit0: report hash `ff04ac3dc0cb2dd57ac08fb863a6aabf1ca64bd2be50d0b2c4e3d1c6183f68c2` and v1 baseline unchanged; only sources entry `src/data/monsterArtManifest.json` changed to `12be56b18a1eac86c7d3178ca205c991b966083374265bd81e182bda58dfecf6`. Prior diagnostic preserved under previous. Candidate6 and Toss38 aggregates unchanged.

Full verification completed: `/tmp/aetheria-v8-full.log` records4383 unit tests/0fail, desktop/mobile smoke,59+58 E2E PASS and final `Local playtest smoke completed`. Handle54204 is no longer available; its last terminal tool output was truncated, so this completion claim uses the complete log, not an invented process exit receipt. The desktop browser.close timeout remains a nonfatal cleanup warning. Do not relaunch this completed run.

Production `npm run build:guard`, `npm run cap:sync`, `npm run mobile:doctor`, `npm run android:debug` and `AETHERIA_IOS_DERIVED_DATA_PATH=/tmp/aetheria-v8-ios.ywPrk0 npm run ios:build:device` each returned exit0. Logs: `/tmp/aetheria-v8-{production,cap,doctor,android,ios}.log`. Read-only `python3 output/verify-v8-native.py /tmp/aetheria-v8-ios.ywPrk0` verified328 paths per package:327 canonical PNGs agree public/dist/APK/iOS, production main JS agrees dist/APK/iOS. Exact artifact paths/SHA are in `native-checkpoint.json`. Native tracked drift0; candidate6/Toss38 protected aggregate hashes unchanged; index empty and diff check PASS.

iPhone remains paired with developer mode enabled but tunnel unavailable in `/tmp/aetheria-v8-device-status.json`. No installation or archive change. Android release signing inputs and local iOS distribution identity remain separate release blockers, not unsigned/debug build failures. Earlier preparation-only notes below are historical; `exports/receipt.json` deliberately retains runtimeAdopted:false from export preparation. Whole-game Goal remains active; next are19 confirmed fire/machine portrait defects from the33-portrait read-only audits. No commit/publication.

## Prepared exports checkpoint

`prepare.py` now pins the selected9 original masters and creates separate160×160 exports with margin8/baseline151 and binary alpha. Existing source RGB is preserved during extraction; only alpha changes. Compact elf clears corner-connected dark-neutral pixels (maxRGB16/spread8), retaining plum outline `(600,311)`, white eye `(570,590)`, hand `(480,810)` and dark garment `(790,736)`. Mineral uses only the four reviewed bright-neutral seeds below; retained neutral region `(740,298)` is explicitly protected from global deletion.

TDD: all3 new tests first failed because the source-pinned preparer was missing (`/tmp/aetheria-v8-source-red.log`), then passed (`/tmp/aetheria-v8-source-green.log`). Actual image masks, unchanged source/RGB, deterministic9 exports across two runs, output bounds/binary alpha, no-overwrite and source drift before output creation are exercised. Related extraction/preflight tests11/11 PASS (`/tmp/aetheria-v8-source-focused.log`); focused ESLint and diff check PASS. A later readability-only conditional refactor retains the same tests.

Prepared files and hashes: `exports/receipt.json`, still `runtimeAdopted:false`. Owner viewed the prepared dark-elf/mineral160px PNGs and all9 prepared96/46/32px dark/light sheets `output/playwright/v8-exports-{1,2,3}.png`. The opaque black and checkerboard backgrounds are gone in these reviewed exports; compact elf face/ears/weapon are substantially more readable than the original thin version. Creature/material/swarm distinctions survive reduction, not every tiny detail. No actual390×844 combat or runtime adoption yet. Earlier source-stage transparency warnings below remain historical, not claims about the prepared exports.

Focused integration: `node --import tsx --test tests/monster-catalog-art.test.js tests/cave-snow-monster-source.test.js`13/13 PASS, handle66500 exit0, `/tmp/aetheria-v8-art-focused.log`. Includes existing canonical catalog/generator and full-art verification paths. No production registry/runtime changes were needed for this preparation gate. All execution handles are terminal.

2026-09-07. All9 prior runtime SHA values were rechecked against `docs/evidence/art/monster-cave-snow-review-20260907.md` before copying. Previous PNGs, registry and full manifest are preserved in `previous/`. Built-in image_gen produced9 individual masters plus one targeted dark-elf revision; exact prompts and output identities are in `prompts.md`. No CLI/API fallback, source deletion, runtime or gameplay mutation.

## Candidate identities

| Master | SHA-256 |
| --- | --- |
| bat-swarm.png | 9989ed75c2c252720566991f2ab97ed0c950b80cb2aaf4033b1a41498b344697 |
| cave-troll.png | 15e76ef66986b384e5e835ba0950a5146b9b675908481842e5e45f36eb5967a4 |
| crystal-golem.png | cbdfe527e85a57382ebf4429465ded0b05875815c04fdef59727a8de0f42e014 |
| crystal-spirit.png | 7193ae759fe60a3feb632cab6a7043f03ca49e3b8abb2a40fe6818919aac0c1c |
| dark-elf.png | f4698bc629738e8267a92142f532ee32ad81bcd95cc8a4ea8010cc1c05ce2b43 |
| dark-elf-compact.png | ae3ce5e5936b5589c46e196471c6bdaa2f6469be91b192e7630fe4508b2aa661 |
| ice-spirit.png | 0dce251e2d066ea1605212a9396f220c3eaae5f488e420c916a54013d98c107a |
| mineral-centipede.png | c6fd3a2d400fe0865d4820507c24d97ac755d62cbb239da1f6c0dc02b9899af8 |
| snowfield-giant.png | f4e73ce38a948a5a16e554bcd44af7abf30de3eb09edef2fe1cc27f615466ea0 |
| yeti.png | 76a3be86ff659d690da8e74fb0ebb5f06aeaf4ef5079286cfe3af50f90ef856c |

## Direct image review

Owner viewed all10 full images and four Pillow-only96/46/32px dark/light sheets `output/playwright/v8-candidates-{1,2,3,4}.png`. This is not actual browser or production-renderer proof.

- Crystal spirit/golem/ice spirit are respectively violet floating faceted body, broad heavy biped and curved icy/snow spirit. Materials and silhouettes are distinct; tiny facet detail is not claimed at32px.
- Cave troll is a hunched green biped, snowfield giant is a dressed living blue humanoid, yeti is an upright white-furred ape. No previous boar/stone-mech identity remains in these candidates.
- Bat swarm contains5 separately visible heads/bodies in the full source and reads as a flock at32px. Tiny eyes/faces are not readable at32px.
- Initial dark elf is semantically elven but too thin/dark at32px; not selected for adoption. Compact revision improves broad face/ears/weapon but has **no alpha channel and an opaque black background**, confirmed by sips. Its initial small-size sheet includes that full opaque canvas, so final crop/size approval remains pending.
- Mineral centipede has the required many-segmented body, paired legs and mineral plates, but an opaque painted checkerboard. It must not be adopted unchanged.

## Reviewed extraction preview, not an export

Using the existing v7 seed-connected bright-neutral extractor on a copy of mineral-centipede, owner inspected `output/playwright/v8-centipede-mask.png`: only exterior and three large enclosed leg/antenna gaps marked red. Seeds `(0,0),(982,466),(426,784),(311,919)`, threshold minRGB225/spread12. Body plates, purple ore crystals and rust legs remain. The resulting review-only image is `output/playwright/v8-centipede-cleaned-preview.png`, visible in sheet4. Smaller neutral regions include possible mineral highlights; do not globally erase them or infer all remaining gaps are resolved. No source was overwritten.

## Next gate

1. Completed: TDD source-pinned preparation and both actual-image mask regressions; deterministic9 exports and original-preservation/no-overwrite/drift checks.
2. Completed: final exports on dark/light at96/46/32px. Next: actual390×844 combat review using the prepared assets; then exact9 corrections/runtime records with unrelated245 records/PNGs unchanged.
3. Refresh only affected deterministic source evidence, focused/full/art gates, production/native package proof, ledger. Candidate/Toss historical aggregates remain protected. No commit/install/publish approval is implied.

All generation calls are terminal. Focused source/art tests are separate from the last completed full/native checkpoint character_alpha_v1 (4380unit/117E2E,328package paths); the new3 tests are not part of that older full count. No new native build. None of these new monster candidates are installed or bundled yet.
