# Caster-role seven — candidate checkpoint

2026-09-10, approved remaining69 design group5/7. Candidate-only; no runtime adoption.

## Scope and originals

고대 마법사, 공허 마법사, 분노한 마구스, 사기꾼 마법사, 종말의 마법사, 종말의 전령, 화염 사제.

Eight individual built-in image calls, seven selected masters and one rejected trickster. Initial prompts remain in `prompts.json`; `generation-records.json` contains final prompts, exact original paths and the rejected record. All8 generated originals are preserved byte-identically in `masters/` or `rejected/`. No CLI/API fallback, dependency installation or background-removal workaround.

## Owner review and final authority

Owner viewed all7 initial full originals and all4 initial sheets (three color160/46/32 dark/light, one grayscale). Initial trickster's elongated dark legs faded into the dark32 background. Preserved `rejected/trickster-mage-thin-dark.png` and all initial exports/reviews, then generated a compact trickster with broad medium-gray trousers/light-brown boots while retaining the card fan, short coat and sideways stance. Initial source top5px/bottom4px bounds were narrow but unclipped; the replacement also improves framing.

**Final authority: `masters/`, `exports-reviewed/*.png`, `exports-reviewed/receipt.json`, and `review-final-*.png`. Do not adopt initial `exports/`.** Other6 exports remain byte-identical to initial exports; final sheets1/3 are byte-identical to the owner-viewed initial sheets1/3. Owner viewed corrected trickster original, final sheet2 and final grayscale. Its lower body remains readable at dark32. Scroll, empty sleeves, forward casting hand, cards, closed book, horn and fire bowl retain distinct large forms. No remaining owner Critical/Important finding.

## Verification

1. Missing preparer TDD RED3: `node --import tsx --test tests/remaining-caster-seven.test.js`.
2. Added source-pinned preparer using existing threshold128/nearest160/binaryalpha/8px export contract; all sources are validated before output and drift/overwrite/opaque/empty candidates are rejected.
3. `node --import tsx --test tests/remaining-caster-seven.test.js tests/remaining-knight-eleven.test.js tests/remaining-guard-twelve.test.js tests/remaining-occupation-eleven.test.js tests/remaining-stone-six.test.js`: GREEN15 before and after correction, including byte-identical repeated exports and source preservation.
4. Initial and final `prepare.py` exports exit0; initial `review.py` and final `review-final.py` exit0. Existing outputs were not overwritten.
5. Independently verified original8/selected7/rejected1 bytes, final source/export hashes7, other6 unchanged exports and final sheets1/3 equality. All7 final exports are RGBA160, binary alpha, minimum8px margins and bottom bound152; all7 source threshold bounds are unclipped.
6. Runtime69, manifest/registry/diagnostic snapshots3 and protected candidate6/Toss38 records are unchanged from V27 preflight.
7. `npx eslint tests/remaining-caster-seven.test.js`, `git diff --check` PASS; Android/iOS tracked drift0 and staging index empty.

Independent Sol/xhigh final C0/I0. All4 final sheets inspected; dark32 book rectangle/bright edge separates from robe, corrected trickster retains a continuous body and readable lower half. All7 role props, original/master/PIN/receipt/export hashes, actual alpha/margins/unclipped sources, rejected1 preservation and other6 unchanged exports agree. Reviewer inspected test contracts but did not independently rerun owner's focused15 tests. This is static candidate evidence, not actual gameplay.

All five current groups also pass a combined exact47 unique approved-name and selected source/export hash check. Cumulative47/69 candidates accepted, remaining22 ungenerated. Next is approved dimensional-form16, without another design approval. No production, full, actual browser or native validation repeated; stable69 adoption precedes those integrated gates. Latest native remains retained26, unsigned and uninstalled. Whole Goal, device/lifecycle and S6 are still open. No install/sign/commit/push/publish.
