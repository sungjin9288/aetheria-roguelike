# Occupation eleven — candidate checkpoint

2026-09-09, approved remaining69 design group2/7. Candidate-only; no runtime adoption.

## Scope and originals

강의 요괴, 고문관, 그림자 사냥꾼, 뇌운의 사냥꾼, 바람 추적자, 보물사냥꾼, 뼈 수집가, 사막도적, 저주받은 어부, 탐욕의 상인, 흡혼 해골.

Twelve individual built-in image calls, eleven selected masters and one rejected fisher. `generation-records.json` contains exact prompts, original paths and rejected record. Initial prompts remain in `prompts.json`; the final fisher prompt is in generation records. All12 source images remain byte-identical to their generated originals. No CLI/API fallback or dependency installation.

## Owner correction and final artifact authority

Owner viewed all11 initial full originals, color sheets1–4 and grayscale. Initial cursed-fisher had an overly thin dark rod and coat at dark32. Preserved `rejected/cursed-fisher-thin.png`, `exports-initial/`, `review-initial-*`; original `exports/` and `review-*.png` also remain unchanged. A new fisher with broad sage-gray coat planes, short thick rod and coarse net was generated. Owner viewed its full original and `review-final-1.png`/`review-final-grayscale.png`; small-screen body and tools now remain readable.

**Final selected artifacts: `masters/`, `exports-reviewed/receipt.json`, `exports-reviewed/*.png`, `review-final-*.png`.** Do not adopt the initial fisher from `exports/`.

- Final fisher master SHA256: `a9f54f0b1229bf9e2d56fe2b47210b2e461bae0d2c88cc9d6722d7389f01fde4`.
- Final fisher export SHA256: `725215c560dbf3147059cbbfd1c37c48ec16cd877ce070aa71b926e0f0b38fdd`.
- Other10 exports are byte-identical to initial exports. Final sheets2–4 contain the same candidate bytes as the owner-viewed initial sheets.
- Stormcloud-hunter original top solid-alpha margin is3px; full hood remains inside frame, export restores8px minimum margin. It was not clipped or silently cropped to hide a missing head.

## Verification

1. Missing preparer RED3 with `node --import tsx --test tests/remaining-occupation-eleven.test.js`.
2. Source-pinned preparer implemented with existing export contract: validate all originals before output, reject drift/opaque/empty/existing output, threshold128, nearest resize,160×160 RGBA,8px margin.
3. `node --import tsx --test tests/remaining-occupation-eleven.test.js tests/remaining-stone-six.test.js`: GREEN6 before and after fisher correction. Includes two-export byte equality and source preservation.
4. Final `prepare.py .../exports-reviewed` and `review-final.py` exit0. Initial outputs were not overwritten.
5. All12 originals, other10 exports, runtime69, manifest/registry/diagnostic3 snapshots, protected candidate6/Toss38 unchanged PASS.
6. `npx eslint tests/remaining-occupation-eleven.test.js`, `git diff --check` PASS.

The metadata update helper initially failed because this JavaScript tool runtime has no `structuredClone`; it failed before metadata edits. It was corrected to JSON-copy parsed records. No source evidence assertion was relaxed.

Independent Sol/xhigh final review C0/I0. Corrected fisher hat/coat/rod/net remain distinguishable at dark/light32 and grayscale. All11 original/master/PIN/receipt and final export RGBA/binary alpha/margin contracts agree; other10 exports and final sheets2–4 are unchanged. Owner separately asserted11 final hashes/alpha/margins/unclipped source bounds. Pillow emitted an existing getdata deprecation warning; no failed assertion. No actual runtime browser/full/native gate rerun, because production is unchanged; those follow stable69 adoption. Latest complete native is retained26, unsigned and uninstalled. Remaining52 ungenerated; whole Goal active, device/lifecycle/S6 open. No install/sign/commit/push/publish.
