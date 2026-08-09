# Task 5 report — unified sword, dagger and heavy-weapon art

Date: 2026-08-10

Base: `5eb9daa2bd85c3082d9f70d208d416b4feea4a36`

Target: `main` → `origin/main`

Status at report snapshot: all Task 5 implementation and verification gates are green, and the independent focused re-review is APPROVED. This snapshot does not pre-claim a final commit hash.

## Outcome

- Replaced all `44` live `weapon-core` illustrations: sword `15`, dagger `18`, and heavy weapon `11`.
- Accepted eight tracked true-RGBA `600x400` source sheets in authoritative order: sword `6 + 6 + 3`, dagger `6 + 6 + 6`, and heavy `6 + 5`. Partial sheets require every unused trailing cell to remain fully transparent.
- Published `44` unique RGBA `160x160` runtime exports with at least the declared 8px margin. Every export is bound to its catalog identity, source sheet, batch, and SHA-256 in the manifest and provenance ledger.
- Recorded eight accepted and six rejected image-generation candidates, including raw SHA-256 and concrete rejection reasons. Rejected candidates were never published.
- Added a deterministic family/Tier contact sheet with each icon shown at native `160px` and as a `32px` inset.

## Source preparation and publication

- `scripts/prepare_equipment_source_sheet.py` removes only edge-connected checkerboard or chroma-key backgrounds, preserves enclosed highlights and green detail, resamples cells independently, and rejects raw icon pixels on a declared cell boundary.
- `scripts/process_equipment_art_batch.py` accepts one to six declared identities, rejects content in unused cells, validates exact catalog rows and runtime paths, and forbids identity or path reuse across the complete prior ledger.
- `scripts/sync-equipment-art-manifest.mjs` derives the 44 artwork records only after exact provenance schema, order, cell, replay key, source hash, runtime hash, catalog coverage, batch uniqueness, and family export uniqueness all pass.
- `scripts/verify-art-assets.mjs --cohort weapon-core` reads the tracked source/provenance evidence and compares it with manifest artwork metadata instead of accepting `styleVersion: 2` alone.

## RED → GREEN evidence

1. The initial Task 5 contract failed because `equipment-weapon-core-provenance.json` and the source preparer did not exist.
2. Source preparation regressions were fixed through real checkerboard/chroma and boundary fixtures before any rejected sheet was published.
3. Partial-batch RED exposed duplicate padding identities and cross-batch overwrite risk. The prompt/processor contract moved to `1..6` identities, blank trailing cells, and global prior-ledger uniqueness before the final partial sheets were accepted.
4. The first independent review reproduced provenance order/cell/duplicate-batch acceptance and a cohort verifier that ignored fabricated artwork hashes. The focused mutation suite failed `0/5`, then passed `5/5` after shared evidence validation.
5. A valid-path smoke exposed a false-positive test caused by a TypeScript import in the plain Node sync CLI. The mutation suite was strengthened to require a provenance error, failed `0/4`, then passed `4/4` after the validator became plain-Node compatible. A valid sync now reports `synced 44 weapon-core artwork records` and matches the tracked manifest `44/44`.

## Visual review

- The tracked contact sheet was inspected at full resolution. All blades, handles, central ornaments, hammer/axe heads, and 32px insets remain inside their cards without clipping.
- Sword, dagger, and heavy silhouettes are readable as separate families; Tier and element changes are expressed through material, shape, and ornament rather than glow alone.
- The actual evidence audit confirms eight source sheets, 44 exact-once catalog identities, blank partial cells, and unique source/export hashes.

## Verification

- `npm run art:verify -- --cohort weapon-core` — GREEN: `44` exports; zero missing, extra, duplicate, PNG, alpha, bounds, style-version, or artwork-evidence errors.
- Focused art/pipeline/provenance/item suite — GREEN (`126/126`).
- Evidence mutation suite — GREEN (`5/5`); plain Node valid sync parity — GREEN (`44/44`).
- `npm run verify` — GREEN: type-check, lint, unit `3595/3595`, and build guard.
- `git diff --check` — GREEN.

## Scope and remaining work

- This report certifies `weapon-core` only. Tasks 6–8 still own ranged/magic weapons, armor, offhand/headgear, and signature/mythic equipment.
- The top-level equipment manifest remains `styleVersion: 1`; full-surface `npm run art:verify` and `art-contract-report.json` remain open until all 233 equipment identities are complete.
- No smoke, native build, archive, device, signing, or upload artifact was created. The pre-existing untracked `build/` directory remained untouched and must stay excluded from the Task 5 commit.
