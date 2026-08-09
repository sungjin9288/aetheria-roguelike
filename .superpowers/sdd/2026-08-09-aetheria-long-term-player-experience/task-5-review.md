# Task 5 independent review — weapon-core art

- Date: 2026-08-10
- Baseline: `5eb9daa2bd85c3082d9f70d208d416b4feea4a36` plus the current uncommitted Task 5 working tree
- Scope: 44 `weapon-sword`, `weapon-dagger`, and `weapon-heavy` illustrations; tracked source batches; runtime exports; manifest/provenance; contact sheet; Task 5 production CLIs
- Verdict: **FAIL — NOT APPROVED**

The current 44 illustrations and their present hashes are internally consistent and visually acceptable. Approval is blocked because two production gates accept deliberately corrupted provenance metadata and can still publish or report success.

## Important findings

### 1. Manifest sync accepts a structurally invalid provenance ledger and publishes v2 artwork metadata

`scripts/sync-equipment-art-manifest.mjs:52-60` checks only the top-level version, cohort, and two top-level catalog bindings. Within each batch, `:67-95` checks the cohort, catalog identity SHA, source bytes, export name/runtime path, and export bytes, but does not enforce the version-1 provenance contract that the processor already requires.

The sync path does not reject:

- duplicate `batchId` values;
- a batch `catalogRowsSha256` mismatch;
- an `identityNames` list that disagrees with the ordered exports;
- a wrong or duplicated fixed cell;
- a missing or non-derived replay key;
- cross-batch identity declarations expressed through `identityNames` rather than exports;
- unexpected/missing batch or export fields.

Independent production-CLI mutation probe:

1. Copied the real accepted provenance to a temporary path.
2. Changed the first ordered identity to `위조된 정체성`, changed its export cell to `bottom-right`, and reused the first `batchId` for the second batch.
3. Ran the real sync CLI with the current 233-row catalog, source sheets, runtime exports, and a temporary output path.

Result:

```text
status 0
synced 44 weapon-core artwork records
```

The output manifest was written. This means `styleVersion: 2` metadata can be produced from a ledger that no longer proves ordered identity-to-cell history or unique batch history. The stricter processor cannot compensate once another entrypoint independently accepts the same malformed evidence.

Required closure:

- Validate an exact top-level, batch, and export schema before reading sources or writing output.
- Recompute and verify the catalog row hash and replay key.
- Require unique batch IDs, identity names, and runtime paths across every batch.
- Bind ordered `identityNames` to fixed ordered export cells/names and active catalog rows.
- Add production-CLI mutation tests for every field above and assert nonzero exit plus no output creation or byte change.

### 2. Cohort verifier reports success when manifest artwork provenance and hashes are fabricated

In cohort mode, `scripts/verify-art-assets.mjs:278-284` reads only `artwork[name].styleVersion`. It then selects the legacy runtime path from `entries` at `:286-295` and validates those PNG bytes. It never compares the recomputed runtime hash to `artwork.exportSha256`, never reads or hashes `artwork.sourcePath`, and never binds `batchId` or source/export hashes to the accepted provenance ledger.

Independent production-CLI mutation probe:

1. Copied the real equipment manifest to a temporary path.
2. For `강철 롱소드`, replaced `batchId` with `fabricated-batch`, pointed `sourcePath` at a missing file, and replaced the source/export SHA-256 values with unrelated 64-hex values.
3. Ran the real cohort verifier against that manifest.

Result:

```text
status 0
report.ok = true
report.exports = 44
```

This makes the canonical Task 5 command, `npm run art:verify -- --cohort weapon-core`, a false-positive gate for the provenance/hash contract. The focused unit test at `tests/item-visuals.test.js:282-320` catches the current checked-in data, but the production verifier itself does not fail closed.

Required closure:

- Make cohort verification validate the complete artwork metadata for every selected item: exact family, batch, source path, source hash, export hash, and style version.
- Bind that metadata to the selected cohort provenance ledger and its ordered exports.
- Compare source and runtime bytes to both provenance and manifest hashes.
- Add CLI mutation tests for missing/wrong source path, source hash, export hash, batch ID, family, duplicate identity/path, and malformed ledger; every case must exit nonzero.

## Current artifact audit

No Important visual or asset defect was found in the current accepted files themselves.

- Authoritative coverage: `44/44`, declared once across eight unique batches.
- Family coverage: dagger `18`, heavy `11`, sword `15`.
- Source sheets: all eight are true RGBA `600x400`; every used cell contains transparent and opaque pixels with cell padding.
- Partial batches: `weapon-core-sword-03` has exactly three used top-row cells and alpha maxima `[255,255,255,0,0,0]`; `weapon-core-heavy-02` has exactly five used cells and `[255,255,255,255,255,0]`.
- Replay integrity: all eight real batches returned status 0 as exact `replay no-op`; counts were `6,6,3,6,6,6,6,5`.
- Runtime contract: all 44 exports are true RGBA `160x160`, contain real transparency and opacity, and have at least the declared 8px margin. All 44 hashes are unique; no duplicate appeared inside any family.
- Hash binding: current source/export bytes match the provenance ledger and manifest artwork records.
- Contact sheet: RGBA `1380x1760`, SHA-256 `c3a4d388dadee8b33a98cbd8321cede2910de0c5277b3a7d19e005ff5a881497`; rebuilding it from the current catalog, provenance, and runtime exports produced byte-identical output.
- Visual inspection: the tracked contact sheet and all eight source sheets were inspected at native resolution, including the embedded 32px previews. No clipping, illegible silhouette, family-wide style break, or Important semantic mismatch was found. Exceptional catalog identities such as `독아 채찍`, `암살의 표창`, and `농부의 포크` remain visually faithful to their names while retaining the shared pixel-art lighting and outline language.

## Verification record

1. `npm run art:verify -- --cohort weapon-core`
   - PASS for the unmodified current tree: `ok:true`, 44 exports, no missing/extra/duplicate/PNG/alpha/bounds/style errors.
   - This pass is not sufficient for approval because mutation probe 2 proves the command ignores artwork provenance fields.

2. `node --import tsx --test tests/item-visuals.test.js tests/equipment-art-pipeline.test.js tests/equipment-provenance-integrity.test.js tests/art-asset-contract.test.js`
   - PASS: `119/119`.

3. Eight production processor replay invocations using the real batch/source/catalog/manifest/provenance inputs
   - PASS: eight status-0 exact no-ops; no files changed.

4. Read-only Pillow/hash audit plus deterministic contact-sheet rebuild in a temporary directory
   - PASS for current assets: 44 exact identities, 44 unique runtime hashes, min margin 8, correct partial-cell transparency, no binding issue, byte-identical contact sheet.

5. Sync malformed-ledger mutation probe
   - **FAIL:** status 0 and output written despite ordered identity, cell, and batch-ID corruption.

6. Verifier fabricated-artwork mutation probe
   - **FAIL:** status 0 with `ok:true` despite fabricated batch/source/export evidence.

7. `git diff --check`
   - PASS.

Full `npm run verify` was not repeated by this reviewer after the decisive production-path failures. Browser smoke, E2E, Capacitor sync, and native builds are not needed to reproduce or close these two evidence-gate defects.

## Workspace preservation

This review did not edit Task 5 production code, tests, assets, documentation, task ledger, or the pre-existing untracked `build/` tree. Temporary mutation fixtures were removed. This report is the only intentional review artifact. `tasks/todo.md` was changed concurrently outside this review and is not evidence of independent approval.
