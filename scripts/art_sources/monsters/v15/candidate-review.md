# Undead/dungeon7 source preparation — 2026-09-08

Status: exact7 local checkpoint complete, including native package verification. Authored96/254 is coverage, not whole-catalog approval. Earlier running/source/export notes below are historical.

## Native closeout

Production build/cap sync/mobile doctor8162, Android debug56725 and isolated iOS unsigned48825 all exited0. `python3 output/verify-v8-native.py /tmp/aetheria-v15-ios.rVxjWj` exited0 and proved all328 selected paths byte-identical across public/dist/APK/iOS. Exact artifact hashes and locations are in `native-checkpoint.json`. Native tracked drift0; protected candidate6/Toss38 hashes remain ac1956ad…ea0dd and 0f870e56…d5b5c. All v15 commands are terminal. No iPhone install, existing archive change, commit or publication.

Distribution readiness is separate: mobile doctor reports no local Apple Distribution identity/profile and no Android release signing inputs. The latest physical iPhone observation remains v14 passcodeRequired=true, not a crash diagnosis. Whole-game S3/S5/S6 remain open.

## Full and independent review checkpoint

Full1389 exited0: unit4399/4399, E2E59+58=117, desktop/mobile smoke, type-check/lint/build guard PASS (`/tmp/aetheria-v15-full.log`). Sol/xhigh independent bounded review closed Critical0/Important0/Minor0 after independently passing source/catalog13 and scoped ESLint, inspecting source extraction/partition/evidence and all seven stable combat captures. Historical next-adoption wording was clarified. Production/cap/doctor8162 exited0; native builds follow. No installation or publication.

## Current integration checkpoint

Adoption test failed RED for missing7 names (`/tmp/aetheria-v15-adoption-red.log`, exit1), generator90016 exit0 built a separate candidate. All254 old runtime SHA verified and other247 candidate records/PNG bytes unchanged; catalogSha unchanged. First multi-hunk manifest patch rejected because input names were out of file order; `cmp` confirmed no mutation. Ordered patch succeeded, canonical manifest byte-matched generator, and only7 canonical PNGs were copied. Focused source/catalog13/13+ESLint/diff6361exit0. Registry89→96 add-only. No classifier, gameplay numeric or save changes.

Owner opened all7 actual stable390×844 screenshots at `output/playwright/v15-stable-{lich,vampire,skeleton-mage,ghost-legion,poison-centipede,corroded-soldier,sewer-crocodile}-390x844.png`. Canonical160px files decode and display46px, ancestry opacity≥.99 and attack enabled, no overflow. Browser16071exit0; console only8React DevTools INFO entries, no errors/warnings. These are level2/enemyHP134 fixed QA snapshots at actual map keys, not natural spawn/progression. No DOM substitution; crocodile retains its low horizontal aspect ratio. Owned browser closed, dev70344 intentional Ctrl-C exit130.

Evidence99858exit0 (`/tmp/aetheria-v15-evidence.log`): art/content/progression write+verify/event/equipment power/economy PASS. Report/reportHash/seedPolicy/v1 unchanged, only monster manifest source SHA→b0a1203e82803bb4ba117e96c6eae51291b27ba80457acbc1a18e8dcd9bf7ba4. Protected candidate6/Toss38 aggregate pins unchanged. Full1389 running `/tmp/aetheria-v15-full.log`; poll same handle, do not restart on timeout. Independent review and native follow; latest verified native is v14, no install/commit.

## Latest export checkpoint

Vampire contrast revision was generated with broad crimson/burgundy cape planes and slate clothing highlights. Source `masters/vampire-readable.png` SHA da6891cc8b3c34d6406f7802b38e39e152bcceaa420eb562a1ddb36e24120fcd is1254×1254 RGB with baked checkerboard. Original `vampire.png` remains unchanged. `prepare.py` removes only neutral bright pixels connected to reviewed seed(0,0) on a copy, preserving all RGB bytes and enclosed face/shirt pixels; no global color erasure. Cleaned alpha bounds(215,21,1042,1231). Other six sources use their own true alpha. All source hashes are pinned before any output.

Three tests RED for missing preparer→GREEN: eight originals unchanged, seven byte-deterministic160px RGBA exports, binary alpha/margins/aspect ratio, reviewed face/shirt alpha255, background alpha0/RGB unchanged, source drift and destination overwrite rejected. Source/export/ESLint/diff7600exit0; focused source+catalog13/13 and ESLint/diff13912exit0. Exact source selection and export SHA: `exports/receipt.json`.

Owner inspected both `output/playwright/v15-exports-{1,2}.png` sheets at96/46/32px on dark/light backgrounds. Revised vampire cape/torso has improved dark contrast; pale face stays intact. Lich and skeleton mage retain distinct purple/teal robes; ghost legion retains three heads; centipede remains segmented, machine metal-bodied, crocodile low/long. Fine teeth, fingers, legs and corrosion details are not independently readable at32px. No horizontal-body stretching or runtime UI changes were made.

Completed integration sequence: exact7 adoption TDD, unchanged other247 manifest/PNG proof, stable390×844 combat and evidence checks. Full verification is running; independent review and native verification remain. Earlier source-hold notes below are historical and resolved by this export checkpoint.

Scope: the exact Important4+3 in `docs/evidence/art/monster-undead-general-review-20260908.md` and `monster-dungeon-general-review-20260908.md`. Built-in image generation only, one initial candidate per name. Prompt set in `prompts.md`; source SHA/mode/dimensions/alpha128 bounds in `source-metadata.json`; masters and previous7PNG/manifest/registry preserved. Generated originals remain intact in Codex generated-images.

## Owner source review

All seven full images were inspected as generated, followed by `output/playwright/v15-candidates.png` at96/46/32px on dark/light backgrounds. All are1254px square RGBA with actual transparency. Alpha128 silhouettes remain inside source bounds; centipede and crocodile margins are narrow but not clipped. Export will normalize padding on copies, not trim anatomy.

- Lich: skull, broad plum robe and bone staff, no sword/shield. Caster role clear; purple fine robe folds become weak at32px but outline/head/staff survive.
- Vampire: fleshed face/hands and wine cape replace bare skeleton. **Hold for dark-background contrast improvement**: at32px the black body and dark cape lose too much separation. Revise broad cape/shoulder light planes without changing species or adding crown; preserve this initial source.
- Skeleton mage: ivory skull/hands, teal hood and simple wood staff distinct from lich. Fine toes/bones reduce at32px but role remains readable.
- Ghost legion: three distinct hoods/faces and tails; complete group rather than one knight plus rings. Verify three-head separation again after160px export.
- Poison centipede: long segmented many-legged body, no spiders; narrow source tail margin reviewed. Legs/antennae simplify at32px; repeat after export.
- Corroded soldier: articulated riveted metal with rust, no rocky body or floating gear symbol; corrosion visible as broad warm patches.
- Sewer crocodile: long flattened jaw, low four-legged armored reptile and curved non-flaming tail. Horizontal silhouette occupies less height by design; do not stretch it to fill a square.

## Original filenames

All under the same thread generated-images directory:

- lich: exec-7028ef61-83c1-4792-82a1-ffe3d84e26d2.png
- vampire initial: exec-711c7c8b-70dc-4a8f-8e0e-113956cfa586.png
- skeleton-mage: exec-5deb4895-2777-4fd3-a1bb-619fcf6b55e7.png
- ghost-legion: exec-91d2863a-0234-4cdd-b7f3-8e5cd81bdd39.png
- poison-centipede: exec-0cb86142-988c-40c7-99a4-62bb3c8c1ec9.png
- corroded-soldier: exec-70433a3d-b362-4cc8-bd26-a57ed0c596c9.png
- sewer-crocodile: exec-cd2562c8-2b25-413f-a198-92ea88a069c5.png

Remaining outside this completed slice: whole-catalog visual audit/corrections, broader direct-play coverage and final device gate. No balance, save, device install, commit or publication changes.
