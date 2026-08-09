# Task 5 focused re-review — evidence-gate fixes

- Date: 2026-08-10
- Baseline: current Task 5 working tree over `5eb9daa2bd85c3082d9f70d208d416b4feea4a36`
- Scope: fixes for the two Important findings in `task-5-review.md`, plus the player-facing runtime-routing defect found during this re-review
- Verdict: **APPROVE**

No Important-or-higher defect remains in the reviewed Task 5 evidence paths.

## Findings closure

### 1. Malformed provenance accepted by manifest sync — CLOSED

`scripts/equipmentArtEvidence.mjs` now supplies one shared fail-closed contract to the plain-Node sync and the cohort verifier:

- local Unicode code-point ordering avoids the transient TypeScript import failure in the plain `node scripts/sync-equipment-art-manifest.mjs` entrypoint (`:23-32`);
- catalog schema, strict order, unique name/runtime path, recomputed row hash, manifest binding, and cohort binding are checked before any source or output access (`:60-100`);
- each selected player-facing `manifest.entries[name]` path is reconstructed from the declared asset root and must equal the authoritative catalog runtime path (`:89-99`);
- batch/export schemas, unique batch IDs, catalog hashes, cohort, ordered identities, fixed cells, replay key, source bytes, runtime bytes, and cross-batch identity/path uniqueness are validated (`:113-189`);
- sync invokes this validator before its atomic output write (`scripts/sync-equipment-art-manifest.mjs:43-66`).

The three original production-CLI mutations now fail as intended:

- `identityNames` drift: status 1, `Equipment provenance replay key is invalid`;
- cell drift: status 1, `Equipment provenance export order is invalid`;
- duplicate `batchId`: status 1, `Equipment provenance batch id is invalid`.

Each probe used an already-existing sentinel output file. All three files remained byte-identical, proving the rejection occurred before publication rather than succeeding through an unrelated crash.

The valid plain-Node sync path returned status 0 with `synced 44 weapon-core artwork records`; all 44 generated artwork records matched the current manifest exactly.

### 2. Fabricated artwork metadata accepted by cohort verifier — CLOSED

The cohort verifier now loads the selected tracked provenance/source root, runs the shared validator with `requireManifestArtwork: true`, and records any mismatch in `invalidArtwork` (`scripts/verify-art-assets.mjs:282-305`). `invalidArtwork` participates in report sorting and `ok` calculation (`:334-345`).

The original combined fabrication of `batchId`, missing `sourcePath`, `sourceSha256`, and `exportSha256` now returns status 1, `ok:false`, and:

```text
equipment:강철 롱소드:artwork metadata mismatch
```

An already-existing `--write-report` sentinel remained byte-identical.

### 3. Player-facing manifest runtime routing drift — CLOSED

During the first re-review pass, changing only `manifest.entries['강철 롱소드']` from its sword export to the unrelated but valid `여행자 튜닉` armor export still allowed sync and verifier success. That was Important because the player would see a different image than the provenance proved.

The added manifest-entry binding at `scripts/equipmentArtEvidence.mjs:89-99` closes both paths:

- plain-Node sync: status 1, `강철 롱소드:manifest runtime path mismatch`, existing output byte-identical;
- cohort verifier: status 1, `ok:false`, matching `invalidArtwork`, existing report byte-identical.

## Positive-path evidence

- Actual cohort verifier: status 0, `ok:true`, `exports:44`, `invalidArtwork:[]`.
- Valid plain-Node manifest sync: status 0, 44 selected artwork records, exact metadata parity with the tracked manifest.
- Current contact sheet remains SHA-256 `c3a4d388dadee8b33a98cbd8321cede2910de0c5277b3a7d19e005ff5a881497`.
- Current weapon-core provenance remains SHA-256 `6231e09fb0978aa6a2eeac786f3e55c1e3092274c4f1bf54b6a76592de86e0a2`.
- The original review's 44/44 coverage, partial-sheet transparency, 160x160 RGBA bounds, unique family hashes, source/export hash binding, and 32px/160px visual acceptance remain unchanged.

## Verification record

1. Independent production-CLI mutation and no-write matrix
   - PASS: three malformed-provenance sync cases, one manifest-routing sync case, one fabricated-artwork verifier case, and one verifier-routing case all rejected with byte-identical pre-existing outputs/reports.

2. Independent production valid paths
   - PASS: plain-Node sync `44/44` parity; actual cohort verifier `ok:true`, 44 exports, no invalid artwork.

3. `node --import tsx --test tests/item-visuals.test.js tests/equipment-art-pipeline.test.js tests/equipment-provenance-integrity.test.js tests/art-asset-contract.test.js`
   - PASS: `126/126`.

4. `npm run verify`
   - PASS: TypeScript type-check, ESLint, unit `3595/3595`, and production/test-harness build guard.

5. `git diff --check`
   - PASS.

Browser smoke, E2E, Capacitor sync, and native build gates were not repeated because the reviewed fix changes offline evidence validation only and the full build guard passed. No native, smoke, or runtime-art artifact was created by this review.

## Workspace preservation

This re-review did not modify implementation, tests, assets, documentation, task ledger, or the pre-existing untracked `build/` tree. Temporary mutation fixtures were removed. This report is the only intentional review artifact. `tasks/todo.md` was not updated by the reviewer.
