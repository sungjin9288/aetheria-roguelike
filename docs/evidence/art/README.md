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
