# Task 4 report — reproducible equipment art pipeline

Date: 2026-08-09

Base: `3bd0767a9632b953562a31783e2a2d49adb23299`

Target: `main` → `origin/main`

Status at report snapshot: pipeline implementation and required Task 4 verification gates are complete. This report is included in the one cohesive Task 4 commit; its final hash and push result are emitted after this snapshot.

## Outcome

- Added a deterministic, Unicode-code-point-sorted live equipment dump with exactly 233 rows and the contract fields `name`, `type`, `tier`, `elem`, `familyKey`, `runtimePath`, and `cohort`.
- Replaced the legacy generator's fixed temporary catalog dependency with explicit `--catalog`, `--source-dir`, `--output-dir`, and `--manifest` arguments. Missing paths fail with the resolved exact path, and `--dry-run` creates neither requested output nor manifest.
- Added strict six-identity 2x3 source batches with fixed row-major cells and Art Bible family, Tier, and element language.
- Added declaration-first source-sheet processing: validation finishes before export writes, transparent cells normalize to `160x160` current runtime paths, and stable source/export SHA-256 records append to a caller-selected provenance ledger.
- Preserved all Task 2 equipment manifest metadata while replacing generated entries; the manifest now declares the reproducible catalog/batch/provenance pipeline contract.

## RED → GREEN evidence

1. Initial catalog/generator RED: `tests/equipment-art-pipeline.test.js` failed `0/2` because `scripts/dump-equipment-catalog.mjs` did not exist and the legacy generator attempted `/tmp/equipment-catalog.json`.
2. Catalog GREEN: the new dump test passed with a sorted live 233-row runtime catalog and no production temporary-path dependency.
3. Explicit-generator RED → GREEN: the legacy invocation failed without explicit inputs, then three generator tests passed: genuine dry-run no-write, exact missing catalog path, and additive pipeline metadata preservation.
4. Prompt/processor RED: the four focused cases failed while both modules were absent.
5. Prompt/processor GREEN: all four passed after fixed cells, cohort validation, declaration mismatch rejection before writes, transparent `160x160` normalization, export hashes, and stable provenance were implemented.

## Catalog and cohort result

| Cohort | Rows |
| --- | ---: |
| `armor` | 83 |
| `offhand-headgear` | 22 |
| `signature-mythic` | 25 |
| `weapon-core` | 44 |
| `weapon-ranged-magic` | 59 |
| **Total** | **233** |

The registry signature override runs before family mapping. Swords, daggers, and heavy weapons map to `weapon-core`; bows, staffs, lances, and whips map to `weapon-ranged-magic`; shields/books/headgear map to `offhand-headgear`; armor maps to `armor`.

## Dry-run and no-write proof

- `node --import tsx scripts/dump-equipment-catalog.mjs --output output/equipment-catalog.json` produced the ignored 233-row catalog.
- `python3 scripts/generate_equipment_item_art.py --catalog output/equipment-catalog.json --source-dir public/assets/equipment-family/items --output-dir output/equipment-dry-run --manifest output/equipment-manifest.json --dry-run` validated all 233 rows.
- Both `output/equipment-dry-run` and `output/equipment-manifest.json` were absent before and remained absent after the dry run.
- Processor tests separately prove both matching and mismatched source declarations leave runtime output/provenance absent under `--dry-run`.

## Files

- Added: `scripts/dump-equipment-catalog.mjs`, `scripts/generate_equipment_art_prompts.mjs`, `scripts/process_equipment_art_batch.py`, and `tests/equipment-art-pipeline.test.js`.
- Updated: `scripts/generate_equipment_item_art.py`, `src/data/equipmentArtManifest.json`, `docs/evidence/art/README.md`, `tasks/todo.md`, `progress.md`, and this SDD ledger/report.
- Excluded: every runtime equipment PNG, character asset, generated source sheet, generated provenance ledger, and `build/` artifact.

## Test and validation record

- `node --import tsx --test tests/equipment-art-pipeline.test.js tests/item-visuals.test.js` — GREEN (`27/27`).
- `npm run type-check` — GREEN.
- `npm run lint` — GREEN.
- `npm run verify` — GREEN: unit `3512/3512` and build guard.
- `git diff --check` — GREEN before staging.

## Commit, push, and status

- Commit scope: one cohesive Task 4 test/pipeline commit; the pre-existing ignored `build/` directory is excluded.
- Push target: `origin/main`.
- Final commit hash, remote update, and post-push tracked-worktree status are emitted by Git after this report snapshot so this committed report does not assert a self-referential hash.

## Scope and residual risk

- This task establishes reproducible tooling only. It does not repaint or approve any equipment visual, change `styleVersion: 1`, write `docs/evidence/art/equipment-provenance.json`, or close full `npm run art:verify`.
- Task 5 and later visual execution must use declared source identities and preserve the no-write dry-run and provenance contracts before any runtime art is accepted.
- No native package, archive, smoke capture, or device artifact was created; the latest native artifact remains unchanged. The separate release blockers remain physical Android acceptance, Apple Distribution identity, and Android release signing inputs.
