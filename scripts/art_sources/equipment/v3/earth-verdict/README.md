# Earth Verdict correction candidates

**Current status — 2026-09-07:** paired-source/runtime adoption is implemented. See `docs/evidence/art/earth-verdict-adoption-20260907.md` for current verification and limits. The paragraphs below preserve the earlier candidate/preparation history; their "not adopted" statements describe those earlier stages. `prepared/receipt.json` intentionally remains the original preparation receipt, not a rewritten adoption receipt.

Two built-in imagegen calls produced `masters/item.png` and `masters/overlay.png`. Exact prompts and generated filenames are in prompts.md. Both originals were visually inspected: pointed broad granite/gold blade, long two-handed grip, no hammer head. Both pass inspect_art_pixels.py with true alpha, transparent pixels and an8px source margin. This is source-candidate approval only, not32px/72px/runtime acceptance.

The earlier hammer exports, full paired sheets, registry, batch and provenance are preserved under previous/. Runtime PNGs and production gameplay remain unchanged. The registry artNote and generated sword-01 batch now describe a2Hgreatsword following a real prompt regression RED→GREEN. This is partial implementation: integration currently25/27 with stale answer-key/full-art-evidence failures. Do not claim runtime adoption or refresh acceptance evidence before replacing and reviewing the images.

Root cause extends beyond image selection: src/data/signatureRegistry.json declares `2H warhammer · 네모 대형 헤드 + 대지 룬 + 중앙 코어`, while production items.ts and itemVisuals.ts require a2Hgreatsword. The relevant v2 batch carries this artNote into prompts and reproducibility validation. Adoption must correct the art contract and paired source/provenance, not merely replace two PNGs.

Source display review: owner viewed both original masters at160/72/32px on dark/light backgrounds in `output/playwright/completion-20260907/earth-verdict-source-review.png`. Both read as swords, with blade/guard/grip distinguishable. This is CSS scaling, not normalized runtime PNG or actual-avatar proof.

## Approved deterministic preparation — 2026-09-07

The user explicitly approved Python/Pillow processing with original preservation. `prepare.py` reads hash-pinned originals and creates only a new output directory; existing output directories are refused. Run from the repository root:

```bash
python3 scripts/art_sources/equipment/v3/earth-verdict/prepare.py /tmp/earth-verdict-new-output
node --test tests/earth-verdict-source.test.js
```

`prepared/` contains separate 600×400 item/overlay sheets, a 160px item and a 72px overlay. Only the top-left sheet cell changes; the other five cells are pixel-identical to the preserved sheets. A copy of each master is alpha-thresholded at 128 to remove faint fringe and make near-opaque pixels opaque, then normalized using the production nearest-neighbor exporter. Masters and prior sheets remain byte-identical. `receipt.json` records their hashes and deterministic output hashes.

The regression was RED with the missing preparation script, then exposed near-opaque master alpha failing the production cell contract. After explicit copied-alpha normalization it passed, including two-run byte equality and overwrite refusal. Owner viewed the actual 160px and 72px exports: blade, guard and long grip remain identifiable.

This is prepared-output verification, not runtime adoption. Next: integrate the paired sheets with production provenance/manifest/answer-key updates, review 32px and actual UI, then focused/full/native gates. Existing runtime assets and acceptance evidence are unchanged; the previously reported four full-unit failures remain unresolved until integration.

Focused verification: `node --test tests/earth-verdict-source.test.js tests/monster-source-preflight.test.js` passed 6/6; focused ESLint and `git diff --check` passed. `inspect_art_pixels.py` confirms true transparency and margins: item bounds `(10,8)–(149,151)` within 8px, overlay `(5,4)–(66,67)` within 4px. No native build or smoke artifact changed in this preparation step.
