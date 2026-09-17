# Magic3 source and export checkpoint — 2026-09-08

Status: exact3 local checkpoint complete — focused/browser/evidence/full/native and independent review passed. Authored89/254 is coverage, not a whole-catalog visual approval. No device install. Source/export descriptions below record the earlier preparation phase.

## Final local verification

Full32344 exited0:4396/4396 unit tests,59+58=117 E2E, desktop/mobile smoke, type-check/lint/build passed. Desktop browser.close timeout remains a nonfatal cleanup warning, not an omitted test. Production build/cap sync/mobile doctor5069 exit0, Android debug28054 exit0, iOS unsigned73480 exit0. Package comparison verified328paths per package byte-identical to production, tracked native drift0; exact artifact paths and SHA are in `native-checkpoint.json`. Independent reviewer v12_review finalized v14 Critical0/Important0/Minor0 and independently reran focused12/ESLint. All v14 processes are terminal.

iPhone connection recovered on the read-only device check, but current lockState reports passcodeRequired=true. No app install/launch was attempted and no crash cause was inferred. Existing archive remains unchanged; physical Android excluded. Whole S3/S5/S6 scope remains open. Separate v15 source preparation is not part of these runtime/native results.

## Current integration checkpoint

Adoption regression failed RED for the missing3 names, then the existing generator built a separate candidate (87602 exit0). All254 preimage PNG hashes were verified; other251 candidate PNGs/records and catalogSha are unchanged. Canonical manifest byte-matches the generated candidate, and only the three selected canonical PNGs were copied. Focused source/catalog12 tests, ESLint and diff PASS (25256 exit0). No classifier, gameplay numeric or save changes.

Actual390×844 combat screenshots `output/playwright/v14-stable-{magic-orb,magic-puppet,page-spirit}-390x844.png` were inspected by owner. Each decodes canonical160px, displays46px, waits for ancestor opacity≥.99 and enabled attack controls; no horizontal overflow. Browser28605 exit0, console log contains only4 React DevTools INFO entries. These are fixed level2/enemyHP134 QA fixtures at real map keys, not natural spawn/progression evidence. Owned browser/dev closed; dev14001 exit130 from intentional Ctrl-C.

Evidence36232 exit0: art/content/progression write+read-only verify/event/equipment power+economy PASS. Diagnostic report, seed policy and v1 baseline unchanged; only monsterArtManifest source SHA changes to47c738f468e8f0707a1c876fe46df10e162ebab9f9bebad5dbbb4db3217629a5. Protected candidate6/Toss38 aggregate hashes match the preexisting pins. Full32344 is running in `/tmp/aetheria-v14-full.log`; poll that handle before restarting. Latest native remains v13, no install or commit.

## Scope and preservation

Correct the three definite named-body mismatches from `docs/evidence/art/monster-magic-general-review-20260907.md`: 마법 구체, 마법 인형, 책의 정령. Built-in image generation produced one source per creature; no paid CLI/API fallback was used. Prompts are in `prompts.md`; exact source SHA, RGBA dimensions and alpha bounds are in `source-metadata.json`. Sources are copied under `masters/`, and the generated originals remain in the Codex generated-images directory. Previous three canonical PNGs, manifest and corrections registry are preserved under `previous/`.

Generated originals (same thread generated-images directory):

- magic-orb: exec-ac669e52-7399-4bc7-83f6-d51e3a07d6ce.png
- magic-puppet: exec-96d4d977-684b-43a3-bfe2-1f4897fabf65.png
- page-spirit: exec-e6632c29-13d4-4748-ad70-68253dd75e1c.png

## Visual review

Owner inspected full generated images and `output/playwright/v14-candidates.png`, then `output/playwright/v14-exports-1.png` at96/46/32px on dark and light backgrounds. Orb has a round shell rather than a fairy/crystal cluster; puppet has a porcelain mask, wood body and ball joints; page spirit has rolled parchment rather than leaves and differs from the authored open spellbook. All silhouettes are complete at alpha128. Low-alpha fringe extends beyond the solid body; the established binary-alpha export removes it on a copy, without modifying any master.

The puppet and page spirit retain narrow limbs/folds. At32px their fine joints and ink marks are weak; do not claim all details are readable. The subsequent actual46px combat review confirmed distinct overall forms and contrast, as recorded in the current integration checkpoint above.

## Verification

`tests/magic-monster-source.test.js`: two tests failed RED for the missing preparer, then passed GREEN after implementing `v14/prepare.py`. The tests cover source preservation, reviewed source SHA, deterministic output bytes,160px canvas, aspect ratio, binary alpha,8px margin/baseline, existing-output refusal and source-drift rejection before output creation. Export SHA values are in `exports/receipt.json`. Combined test/export/ESLint/diff command79641 exited0. Canonical manifest and corrections registry still byte-match preserved preimages (`cmp` exit0).

## Integration sequence and remaining gates

1. Completed: exact3 adoption regression RED→GREEN and existing catalog-generator integration; other251 records/PNG bytes and gameplay/save/classifier preserved.
2. Completed: actual390×844 stable combat review for all three using canonical files; fixed QA is not natural progression.
3. Completed: evidence refresh with unchanged report/v1 and protected aggregates, full verification, final independent review and local native packaging. Device installation remains unverified.

Latest verified local native artifacts are v14 (`native-checkpoint.json`). No new install, archive change, commit, push or publication. All commands in this checkpoint are terminal.
