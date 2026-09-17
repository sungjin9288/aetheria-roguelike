# Character alpha review — follow-up required

## Current adoption — 2026-09-07

All8 targeted character aperture corrections are now in canonical source/runtime paths. Original8 masters, previous18 runtime files and old provenance/contact sheets remain preserved under `character_alpha_v1/`. Owner individually reviewed all six remaining originals, then the red removal-mask sheet and96/64px light/dark comparison. Robes/crystal light/holy-symbol centers/shield/spirit faces are retained. Focused24/24, art and source/runtime provenance18 checks PASS; other10 runtime PNGs and provenance records unchanged. Details and exact candidate hashes: `scripts/art_sources/character_alpha_v1/README.md` and `prepared-eight/receipt.json`.

Actual390×844 portrait8 review is complete with correct canonical image/job labels and overflow0. Fixture restores default equipment, so no empty-slot/build/progression claim. Full89516 failed on3timeouts matching host sleep; unchanged targeted3 passed after wake. Fresh full80148 exited0:4380unit/117E2E and desktop/mobile smoke PASS, with nonfatal browser-close warning preserved. Production/cap/doctor and Android debug/iOS unsigned builds PASS; both packages match328selected paths with native tracked drift0. See `scripts/art_sources/character_alpha_v1/native-checkpoint.json` and `docs/evidence/qa/character-art-full-sleep-20260907.md`. This supersedes earlier “not adopted” preparation notes without retroactive completion claims. Whole-game art/device completion is not established.

## Current preparation — 2026-09-07

Ranger/hunt-lord corrected source copies and normalized candidates now exist in `scripts/art_sources/character_alpha_v1/prepared/`; they are not runtime-adopted. The pinned source-specific extractor passed actual mask/preservation and deterministic/exclusive-output TDD, focused character22/22, ESLint and diff checks. Full-size and96/64px dark/light comparison removes the prominent bow-interior white sail while preserving strings/costume/ambiguous quiver whites. Thin pre-existing edge fringes are not fully removed. Detailed commands, hashes and limitations: `character_alpha_v1/README.md` and `prepared/receipt.json`.

The remaining six staff/halo characters still need reviewed masks. Canonical character masters, runtime PNGs and manifest are unchanged; full gate and actual portrait/native checks follow combined adoption, not this preparation. The earlier findings and candidate-coordinate notes below remain historical evidence.

Independent Sol read-only audit covered all18 production-resolved PNGs and sources; owner inspected the96/64px dark/light sheet and the processor/test contract. Critical0, Important issues affect8 characters;10 accepted for inspected identity/crop/readability. This is not overall gameplay or complete equipment-overlay approval.

## Findings

- Priority A: ranger and hunt-lord have opaque white/checkerboard patches filling the open bow interior, reading as a white sail on dark avatar frames. Fix source transparency while preserving bow, string and costume identity.
- Priority B: mage, archmage, grand-mage, cleric, paladin and shaman retain enclosed faux-checker residue in staff loops, magic circles, halo or gaps between props and body. Preserve intentional white clothing/light; do not delete all pale pixels.
- Accepted in this audit: adventurer, warrior, knight, dragon-knight, berserker, warlock, chronomancer, rogue, assassin and shadow-lord. Chronomancer sword matches permitted equipment and is not an identity error.

`scripts/process_character_art.py:126` removes only edge-connected background; `tests/character-appearance.test.js:115` deliberately preserves enclosed whites. That is a safe generic rule but cannot certify these specific source apertures. Do not weaken it with global white deletion. Use source-specific reviewed correction/regeneration, preserve originals/provenance, and add tests for the approved interior-alpha contract.

Evidence sheet: `output/playwright/completion-20260907/character-audit-96-64.png`, SHA c5c6b131efbce2bff7917fd93b2328a774136ec1c4c763131b8e8e23d9c4401b. Runtime paths are `/assets/avatars/canonical/<key>.png`; sources are `scripts/art_sources/characters/<key>.png`. No source/runtime edits in this audit. Original-resolution owner inspection and exact per-source preimage pins remain required before correction.

This work follows the current contextual-five boss source slice; it is not silently included in a boss-only adoption.

## Owner original-resolution inspection — six remaining sources

On 2026-09-07 the owner opened all six source PNGs individually. The source images visibly contain a pale checker pattern; the following apertures are background candidates, not permission to remove every pale pixel. Exact masks and pixel tests still require implementation and approval. No image bytes changed.

| Source | Background aperture to inspect | Intentional pale artwork to preserve | Source SHA-256 |
| --- | --- | --- | --- |
| mage | Diamond-shaped opening between the staff's three crystal branches; narrow staff/body gap | Cream sleeves and crystal highlights | `40960d0e9b9fb3803db60906326509d81357df2260d4d90b3f7b77909c5f01a9` |
| archmage | Staff ring around the central blue crystal; spaces enclosed by orbit trails | Cream tunic/sleeves, blue crystal reflections and orbit strokes | `380c3eaab7be17e5417f45be1d9a9675be858518e6e357749096a2a2efc66fde` |
| grand-mage | Concentric staff ring sectors and orbit interiors | Prism crystal's white center, cream robe and luminous orbit strokes | `af8614afe2550fbcbd51697e2a1934e7720d422cbf72aae7ccd8dc03ff1a005e` |
| cleric | Staff ring around blue gem and halo sectors behind shoulder | White cloak/sleeves/front panel and star glow | `735134f201e1667e1dc7e07f1fee1a54b45af6f1f0c8dc338e70228f3f861368` |
| paladin | Halo sectors between head and shield | White shield face, armor plates and halo's central light | `5b271f68b480d744b70bb9df2e89524aae296f99080208ec4762208b6a65f63f` |
| shaman | Bell frame and cord loops; staff/body gap | Paper talismans, two spirits' cream faces, bell reflections | `26d6a4f8e4e9d353dde6aa809a67f6e97df0d34794ef384a3b4ed0916a87bf87` |

This closes the six-source owner inspection prerequisite, not alpha correction, export approval, or complete avatar composition coverage.

## Bow aperture preparation — 2026-09-07, no adoption

Owner reopened ranger and hunt-lord originals and inspected enlarged candidate regions in `output/playwright/character-bow-aperture-candidates.png`. Python/Pillow original-preservation approval is active. This pass only reads source pixels and creates a diagnostic crop sheet; no character source/runtime bytes changed.

- Ranger source SHA: `6adaecfe4a7e16a48d4afe802b786050d10ca853a9c8d3b80ca134addd842a8f`. Confirmed background candidates: `(837,412)`, `(834,736)`, `(809,880)` in the bow/body gaps. Neutral components contain44076/6895/974 pixels at alpha>=128, minRGB>=225 and channel spread<=12. Two smaller components at `(400,566)` and `(369,574)` intersect visually ambiguous arrow/quiver detail; **do not include them in a correction mask without separate semantic review**.
- Hunt-lord source SHA: `8afa1b80e71972f81fc2445054f40ff947fc7d584e24d7f76e27be45b31f1e9b`. Background candidates `(949,444)`, `(886,696)`, `(976,675)`, `(786,1017)`, `(890,846)` lie between bow/body/ornament boundaries. Component sizes35479/4712/2015/348/298. Pale horn, fur and bow highlights remain intentional artwork.

Next implementation must pin these originals, test actual connected masks and preserved bow strings/highlights, create separate corrected copies, and review normalized portraits before adopting them. These coordinates are not yet a validated exporter or runtime transparency fix. The generic edge-connected-white preservation regression must remain intact.
## Current-byte 독립 사후 감사 — 2026-09-08

Sol/xhigh가 originals/prepared source/runtime/canonical 및 receipt를 대조하여 mismatch0, previous18 대비 exact8 변경/다른10 불변을 확인했다. 마스크·비교표와 교정8종 실제390 캡처를 모두 검수했고 활·지팡이·halo의 큰 불투명 잔여물 제거와 의상/수정/방패/성스러운 중심/정령 얼굴 보존을 확인했다. 이전 alpha 결함에 대해 C0/I0. 얇은 기존 밝은 가장자리와 ranger의 모호한 화살통 흰 부분은 의도적으로 보존한 비차단 한계다. 전체S3나 기기 설치 완료를 뜻하지 않는다.
