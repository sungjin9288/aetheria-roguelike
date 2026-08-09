# Task 5 independent-review fix — evidence-bound manifest and cohort verification

Date: 2026-08-10

## Finding

The first review approved the actual 44 illustrations but failed the evidence consumers:

- manifest sync accepted a forged `identityNames` order, wrong export cell, and duplicate `batchId`;
- cohort verification returned `ok:true` when an artwork row used a fabricated batch, nonexistent source path, and false source/export hashes.

This could let later manual or scripted evidence drift look approved even though the currently tracked Task 5 data itself was correct.

## Root cause

`sync-equipment-art-manifest.mjs` checked export names, paths, and file hashes but did not import the processor's complete ledger invariants. `verify-art-assets.mjs` checked cohort `styleVersion` and runtime pixels but did not bind manifest artwork metadata back to tracked source/provenance evidence.

## Fix

- Added `scripts/equipmentArtEvidence.mjs` as the plain-Node evidence validator shared by manifest sync and cohort verification.
- It validates catalog-row SHA, exact record/export schema, ordered names and cells, recomputed replay key, unique batch/name/path coverage, source/runtime bytes, family export uniqueness, and exact manifest artwork metadata.
- Manifest sync performs no output write until that validation returns all 44 derived artwork rows.
- Cohort reports include `invalidArtwork` and fail when the manifest, provenance, tracked source, or runtime hash drifts.
- A second review probe changed only the player-facing `manifest.entries` route to another valid equipment PNG. New sync/verifier mutations failed `0/2`; the validator now derives `art.assetRoot + entries[name]` and requires exact equality with the catalog/provenance runtime path.

## Regression record

- Original review mutations: RED `0/5` → GREEN `5/5`.
- False-positive import regression: strengthened plain-Node sync tests RED `0/4` on `ERR_MODULE_NOT_FOUND` → GREEN `4/4` with real provenance errors.
- Valid production-path sync: `44/44` metadata parity.
- Actual cohort verifier: GREEN with `invalidArtwork: []`.
- Combined evidence and routing mutations: `7/7` GREEN.
- Focused suite: `126/126`; full `npm run verify`: unit `3595/3595`, type-check, lint, build guard GREEN.

Independent focused re-review reproduced all six fail-closed mutations, valid sync parity, and the actual cohort pass, then returned APPROVE.
