# Art Contract Checkpoint — 2026-08-09

This directory records reproducible art-contract evidence. Task 3 completes the canonical 18-character surface only; it does **not** certify the 233-equipment visual goal as complete.

## Task 3 character checkpoint

- `character-provenance.json` binds the approved shared prompt and all 18 role prompts to SHA-256 values, then binds each tracked source master and normalized runtime export to its own SHA-256.
- `character-contact-sheet.png` and `character-contact-sheet-anonymous.png` are deterministic 6x3 lineage-order sheets produced by `scripts/process_character_art.py`.
- All 18 tracked masters are RGBA with real transparent pixels. All runtime exports are unique `768x768` PNGs, use no more than `600x630` opaque bounds, remain inside the declared margin, and place the feet on `y=708`.
- Known jobs resolve to their first-and-only manifest candidate. The Adventurer fallback remains only for unknown/corrupt job data.
- The Job Change decision surface reuses `PixelCharacterAvatar`; the focused 390x844 Playwright flow verifies Warrior-to-Mage portrait replacement and viewport containment.
- `node --import tsx --test tests/character-appearance.test.js tests/avatar-sprite-priority.test.js tests/art-asset-contract.test.js` — GREEN (`42/42`).
- `npm run art:verify -- --scope characters` — GREEN: 18 exports, no missing/extra/duplicate/PNG/alpha/bounds/style errors.

`character-review-2026-08.md` preserves the original provisional self-review and now records the immutable independent blind result: exact identity `18/18` and combat-promise match `17/18`, both PASS. Row 16 preserves the `그림자 주군` promise miss and correction from clone-led multi-hit control to darkness-stacking guaranteed execution.

## Catalog identity

- Catalog SHA-256: `79c20f4fd65c8ac323c80f4da13aceabb0d558755828ba8d02bcf3557bc610e6`
- Classes: `18`
- Equipment: `233` (`weapon 119`, `armor 93`, `shield 21`)
- Defined illustration families: `22`; used by the current catalog: `18`
- Elements: `냉기`, `대지`, `바람`, `빛`, `어둠`, `에테르`, `자연`, `화염`

## Task 4 equipment pipeline readiness

- `scripts/dump-equipment-catalog.mjs` emits the live, Unicode-code-point-sorted 233-row catalog with the exact row fields `name`, `type`, `tier`, `elem`, `familyKey`, `runtimePath`, and `cohort`. The current deterministic cohort totals are `armor 83`, `offhand-headgear 22`, `signature-mythic 25`, `weapon-core 44`, and `weapon-ranged-magic 59`.
- `scripts/generate_equipment_item_art.py` now accepts only explicit `--catalog`, `--source-dir`, `--output-dir`, and `--manifest` inputs. Its `--dry-run` validates those inputs without creating either output target, and a normal legacy generation preserves every top-level manifest metadata field while replacing only generated entries.
- `scripts/generate_equipment_art_prompts.mjs` creates one declared, cohort-consistent six-identity source request at a time. It binds the batch to the authoritative catalog SHA-256 and complete seven-field row SHA-256, fixes the 2x3 row-major order to `top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`, and includes family, Tier, and element language from the Art Bible.
- `scripts/process_equipment_art_batch.py` requires the dumped catalog and verifies its pinned full-row hash, all batch row fields, cohort, and manifest-derived runtime paths before any write. It accepts only true RGBA `600x400` sheets with six isolated non-degenerate cells, normalizes each export to transparent `160x160`, prevalidates a stable replay ledger, and publishes all six PNGs plus the next ledger through a staged rollback boundary. Exact replay is a no-op; conflicting `batchId` reuse fails before publication.
- `scripts/generate_equipment_item_art.py` retains its explicit no-write dry run and now stages/verifies the entire legacy output set plus manifest before rollback-safe publication.

Typical readiness flow (all output paths are caller-chosen):

```sh
node --import tsx scripts/dump-equipment-catalog.mjs --output output/equipment-catalog.json
node --import tsx scripts/generate_equipment_art_prompts.mjs --catalog output/equipment-catalog.json --batch-id equipment-v2-001 --names 'name-1,name-2,name-3,name-4,name-5,name-6' --output output/equipment-v2-001.json
python3 scripts/process_equipment_art_batch.py --batch output/equipment-v2-001.json --catalog output/equipment-catalog.json --source-sheet /chosen/source-sheet.png --source-declaration /chosen/source-declaration.json --public-root /chosen/public-root --equipment-manifest src/data/equipmentArtManifest.json --provenance /chosen/equipment-provenance.json --dry-run
```

This is pipeline readiness only: no Task 4 source sheet, runtime equipment PNG, `equipment-provenance.json`, style-version closure, or full equipment visual approval has been claimed or written by this checkpoint.

- Adversarial focused RED before the integrity fix — `5/39` pass and `34/39` fail on the missing safeguards.
- `node --import tsx --test tests/equipment-art-pipeline.test.js tests/item-visuals.test.js` — GREEN (`59/59`).
- Live dump — `233` rows, `233` unique names, and `233` unique runtime paths; legacy dry-run validates all rows without either requested output target.
- `npm run type-check`, `npm run lint`, and `npm run verify` — GREEN (`npm run verify`: unit `3544/3544` and build guard); `git diff --check` — GREEN.

## Task 5 weapon-core checkpoint

- The `weapon-core` cohort contains exactly `44` catalog identities: sword `15`, dagger `18`, and heavy weapon `11`. Eight accepted source sheets cover them once each in authoritative order: sword `6 + 6 + 3`, dagger `6 + 6 + 6`, and heavy `6 + 5`. Partial final sheets keep every unused trailing cell fully transparent.
- `scripts/prepare_equipment_source_sheet.py` converts accepted image-generation output into a strict true-RGBA `600x400` sheet without repainting the icons. It removes only edge-connected checkerboard or chroma-key background, resamples each cell independently, and rejects source artwork that crosses a declared cell boundary.
- `scripts/process_equipment_art_batch.py` now accepts one to six declared identities, rejects non-transparent unused cells, and checks identity/runtime-path uniqueness across the complete prior ledger before publication. A later batch therefore cannot silently overwrite an earlier cohort export.
- `scripts/sync-equipment-art-manifest.mjs` binds all `44` manifest artwork rows to the authoritative catalog, source-sheet SHA-256, and runtime export SHA-256. Every selected row has `styleVersion: 2`; the manifest's top-level style version remains `1` until all equipment cohorts are complete.
- `scripts/equipmentArtEvidence.mjs` is shared by manifest sync and cohort verification. It rejects provenance order/cell/replay drift, duplicate batches or identities, source/runtime hash drift, and any mismatch between the catalog runtime path, the player-facing manifest entry, provenance export, and artwork metadata before evidence can be treated as green.
- `equipment-weapon-core-provenance.json` records eight accepted and six rejected generated candidates, the rejection reason and raw hash, each tracked source hash, and all `44` ordered export hashes. The eight accepted source sheets and all `44` runtime exports have unique SHA-256 values.
- `equipment-weapon-core-contact-sheet.png` is the tracked family/Tier review surface. It presents each icon at native `160px` and a `32px` inset for readability inspection.
- `npm run art:verify -- --cohort weapon-core` — GREEN: `44` exports with no missing, extra, duplicate, PNG, alpha, bounds, or style-version error.
- `node --import tsx --test tests/art-asset-contract.test.js tests/equipment-art-pipeline.test.js tests/equipment-provenance-integrity.test.js tests/item-visuals.test.js` — GREEN (`126/126`).

This checkpoint certifies only `weapon-core`. Tasks 6–8 still own ranged/magic weapons, armor, offhand/headgear, and signature/mythic equipment. Full equipment `styleVersion: 2`, full-surface `npm run art:verify`, and `art-contract-report.json` therefore remain open.

## Contract verification

- The catalog and report use an explicit Unicode code-point comparator rather than ICU collation. The current live order preserves the SHA-256 above across Node environments.
- `node --import tsx --test tests/art-asset-contract.test.js` — RED first for the absent catalog module, then GREEN with catalog, manifest, PNG IHDR, alpha, transparent-pixel, bounds, foot-baseline, SHA-256, stable-report, full-scope evidence, global duplicate-path, CLI-value, generator-metadata, and fail-closed Pillow coverage.
- `npm run art:catalog` — GREEN; prints the deterministic identity above.
- `node --import tsx --test tests/art-asset-contract.test.js tests/item-visuals.test.js` — GREEN (`35/35`).
- `npm run type-check`, `npm run lint`, and `npm run verify` — GREEN (`npm run verify` unit suite: `3499/3499`).

## Intentional full-verifier RED diagnostic

`npm run art:verify` exited `1` with immutable `scope: "all"` and `verifiedSurfaces: ["characters", "equipment"]`. This is the expected Task 2 baseline while Tasks 3–8 have not supplied canonical character exports and style-version closure.

- `missing`, `extra`, `duplicates`, and `invalidAlpha`: `0`
- `invalidPng`: `18` missing canonical character runtime files — `그림자 주군`, `나이트`, `대마법사`, `도적`, `드래곤 나이트`, `레인저`, `마법사`, `모험가`, `무당`, `버서커`, `사냥의 군주`, `성직자`, `시간술사`, `아크메이지`, `어쌔신`, `전사`, `팔라딘`, `흑마법사`
- `invalidBounds`: `6` existing equipment exports exceed the declared 8px margin — `균열의 날`, `세계수의 검`, `에테르 세이버`, `에테르 전투복`, `영혼 절단자`, `차원 갑주`
- `invalidStyleVersion`: `1` — `equipment:expected styleVersion 2, got 1`
- Existing equipment exports with SHA-256 values: `233`

No `art-contract-report.json` was created or approved. The verifier refuses `--write-report` when `ok` is false **or** its immutable scope is not `all` with both verified surfaces; a tracked JSON report becomes evidence only after a fully green verification. The owning equipment generator now preserves the contract metadata while replacing only legacy entry values.
