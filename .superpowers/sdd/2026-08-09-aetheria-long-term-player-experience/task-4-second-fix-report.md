# Task 4 second fix report — prior provenance integrity closure

Date: 2026-08-09

Base: `ff9b55d3d0c0680ea76bd1027fac79a8a88298bc`

Target: `main` → `origin/main`

Status at report snapshot: the single Important provenance defect from `task-4-rereview.md` is fixed and verified in an isolated clean worktree. This report does not mark equipment painting or Task 5 complete.

## Outcome

The batch processor now treats every existing version 1 provenance record as an active-catalog-bound contract before reading the source sheet or preparing any output. A prior record is accepted only when its exact record/export schemas, `catalogSha256`, `catalogRowsSha256`, supported `cohort`, non-empty `sourceSheet`, source hash, recomputed replay key, six unique ordered identities, fixed cells, names, active runtime paths, and export hashes are valid. Duplicate batch IDs and any stale, missing, extra, reordered, mismatched, traversing, or duplicate value fail closed before publication.

Canonical prior records remain accepted, a new batch appends normally, and exact replay remains a byte-identical one-record no-op.

## RED → GREEN evidence

- Dedicated TDD RED: `node --import tsx --test tests/equipment-provenance-integrity.test.js` produced `9/33` pass and `24/33` fail. The malformed prior-record cases exited successfully and published because the old reader only shape-checked a subset of fields.
- Dedicated GREEN: all `33/33` tests pass. The 30-case mutation matrix asserts exit 1 plus byte-identical existing outputs and ledger for every rejection; canonical append and exact replay both pass.
- Clean focused integration at detached `ba5cdbe`: provenance, equipment pipeline, and item visuals pass `92/92`.
- Clean `npm run verify`: type-check, lint, unit `3577/3577`, and build guard all pass.
- `git diff --check HEAD^ HEAD`: pass.

The clean gates ran in `/private/tmp/aetheria-task4-provenance-verify.b5qoCp`, created from the Task 4-only local commit with the repository `node_modules` symlinked. The worktree was removed after verification.

## Shared-worktree separation

The live shared worktree also contains Task 5 work in progress. Its combined focused run currently has two expected Task 5-only RED cases: the not-yet-present `scripts/prepare_equipment_source_sheet.py` and `docs/evidence/art/equipment-weapon-core-provenance.json`. Those cases are not Task 4 regressions and were excluded from the clean Task 4 gate by verifying from the `ff9b55d`-based isolated commit.

This fix owns only `scripts/process_equipment_art_batch.py`, `tests/equipment-provenance-integrity.test.js`, this report, and the Task 4 ledger note. It does not stage or commit the Task 5 prompt generator, shared pipeline/item tests, source art directory, runtime PNGs, generated provenance, or ignored `build/` content.

## Remaining scope

Task 4 pipeline integrity is closed against the re-review finding. Equipment art generation, visual acceptance, `styleVersion: 2`, approved full `art:verify` evidence, and Tasks 5–8 remain separate unfinished work. No smoke capture, Capacitor sync, native build, archive, or device artifact was created for this tooling-only correction.
