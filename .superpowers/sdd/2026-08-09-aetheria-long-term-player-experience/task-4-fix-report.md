# Task 4 fix report — equipment pipeline integrity review closure

Date: 2026-08-09

Base: `27adc7884043802816d826129da116d3b2367726`

Target: `main` → `origin/main`

Status at report snapshot: all three Important findings from `task-4-review.md` are implemented and locally verified. This report is part of the cohesive fix commit; the final commit hash and push result are emitted by Git after the snapshot.

## Outcome

1. **Authoritative catalog projection** — prompt batches now carry the current art `catalogSha256` and a canonical hash over all 233 exact seven-field equipment rows. The processor requires `--catalog`, validates the pinned complete-row hash, rejects unsupported or mismatched cohorts, compares every selected `name/type/tier/elem/familyKey/runtimePath/cohort` field, and derives the only accepted runtime path from `manifest.art.assetRoot + manifest.entries[name] + ".png"`.
2. **Fail-closed provenance and publication** — the ledger is parsed and structurally validated before publication. `batchId + sourceSheetSha256 + ordered identityNames` forms the stable replay key; exact byte replay is a no-op even when the source filename changes, while conflicting reuse of a `batchId` fails before writes. All six normalized PNGs and the next ledger are staged and verified before ordered publication; an `os.replace` failure restores every already-published destination byte. The executable legacy generator applies the equivalent all-output-plus-manifest staging and rollback boundary.
3. **Strict source-sheet contract** — input must be true RGBA at exactly `600x400`, yielding a fixed `3x2` grid of `200x200` cells. Every cell must contain transparent and fully opaque pixels, a non-degenerate icon, and transparent boundary padding. Opaque RGB, fully opaque RGBA, wrong dimensions, empty cells, one-pixel cells, and boundary-touching content fail before output or provenance creation.

## RED → GREEN evidence

- Initial adversarial run: `node --import tsx --test tests/equipment-art-pipeline.test.js` — expected RED, `5/39` pass and `34/39` fail. Decisive gaps were undefined batch `catalogSha256`, unsupported processor `--catalog`, absent strict image/ledger/replay checks, and missing staged rollback functions.
- Stable-key filename mutation: a same-byte replay from a renamed source reproduced one additional focused RED (`0/1`) before replay comparison was corrected to use the stable key rather than the informational filename.
- Final focused pipeline: `40/40` GREEN.
- Pipeline plus item visuals: `59/59` GREEN.
- Full `npm run verify`: type-check, lint, unit `3544/3544`, and production/test-harness build guard GREEN.
- `git diff --check`: GREEN.

## Reproducibility checks

- The caller-selected catalog dump contains 233 rows, 233 unique names, and 233 unique runtime paths. Cohort totals remain `armor 83`, `offhand-headgear 22`, `signature-mythic 25`, `weapon-core 44`, and `weapon-ranged-magic 59`.
- The legacy explicit dry run validates all 233 rows and creates neither its requested output directory nor manifest.
- Monkeypatched `os.replace` failures prove byte-identical rollback for both the six-output processor transaction and the executable legacy generator output/manifest transaction.

## Files

- Updated: `scripts/generate_equipment_art_prompts.mjs`, `scripts/process_equipment_art_batch.py`, `scripts/generate_equipment_item_art.py`, `src/data/equipmentArtManifest.json`, and `tests/equipment-art-pipeline.test.js`.
- Synchronized evidence: `tasks/todo.md`, `progress.md`, `docs/evidence/art/README.md`, and this fix report.
- Excluded: every runtime equipment PNG, character asset, generated source sheet, generated provenance ledger, and pre-existing ignored `build/` artifact.

## Scope and remaining gates

This closes Task 4 pipeline integrity only. It does not repaint or approve equipment art, change `styleVersion: 1`, create an approved full `art:verify` report, or complete Tasks 5–8. No UI smoke, E2E, Capacitor sync, native build, archive, or device artifact was produced because the reviewed range is tooling/contracts-only. Physical Android acceptance, Apple Distribution identity, and Android release signing inputs remain separate release blockers.
