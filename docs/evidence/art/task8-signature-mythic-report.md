# Task 8 Signature and Mythic Art Closure — 2026-08-10

Task 8 replaces every generic signature recolor with identity-specific item art and gives the same 25 registered items a dedicated wearable overlay. The live equipment catalog now closes at 229 item icons, 22 family exemplars, and 25 signature overlays under top-level `styleVersion: 2`.

## Published contract

- The signature registry and live catalog have exact two-way coverage for 25 identities.
- Eleven family-pure batches publish 22 tracked RGBA `600x400` source sheets: one item sheet and one overlay sheet per batch.
- Item cells rebuild deterministically to transparent `160x160` PNGs with an 8px margin. Overlay cells rebuild to transparent `72x72` PNGs with a 4px margin.
- The finalized generation review contains 22 accepted source candidates and 16 rejected candidates. Every candidate keeps a safe unique raw filename, a unique SHA-256, and a reason when rejected.
- Manifest routes, registry sprite keys, catalog rows, `artNote`, batch prompts, source bytes, reconstructed runtime bytes, and provenance records are checked as one contract before sync or verification can write.
- Export hashes are unique across all 229 item icons, 22 family exemplars, and 25 overlays. Item and overlay publication shares one rollback boundary, and an approved batch can be revised only through the explicit replacement path.

The finalized generation review pin is `6661866d57f350682def6642968d71ee9bcda807c85b1d52af524579399ef116`. The manifest SHA-256 is `2d164df96876c65153d813acb2c649ade959df77471d095c1c5fb0f44828890e`; provenance is `36f3ca22d2fa9bc73437a209e426659da467cb750e7566e9594ef0592b83d01d`.

## Player-facing visual review

The named 25-card sheet was approved at item `160/32` and overlay `72/32`: all identities remain readable, complete, unclipped, and free of visible chroma residue. The anonymous first pass by a no-context `gpt-5.6-sol` reviewer at `xhigh` reasoning identified 23 of 25 names and promises; only `신전 도시의 지팡이` and `천벌의 지팡이` were swapped.

The staff pair was revised without changing `세계수의 지팡이`. `신전 도시의 지팡이` now uses a solid priest-temple medallion with a central cross-ray and architectural spokes. `천벌의 지팡이` uses a dominant Latin cross with a separate thin halo and lightning prongs. A fresh no-context `gpt-5.6-sol` `xhigh` review on 2026-08-10 scored exact identity `2/2` and gameplay role `2/2`; both silhouettes remained distinct at item `160/32` and overlay `72/32`. The reviewer noted that the two 32px overlays share a gold-white tone, but their silhouettes still passed without ambiguity.

Review artifacts:

- `equipment-signature-mythic-contact-sheet.png` — named 25-card sheet, SHA-256 `2367047e45010b383dc77ecb2e0899b0be74bc53a13d41b61ee8aba186df566c`
- `equipment-signature-mythic-contact-sheet-anonymous.png` — anonymous 25-card sheet, SHA-256 `b88f8826dec8501ac28cc0c4e21e2d792ce3d4adec736535a41ae824dc2d7e36`
- `equipment-signature-mythic-contact-sheet-answer-key.json` — row-major answer key, SHA-256 `7e909dfa746bf332c8a98e3cc7277a9590130d4128d31c0cb2c906e75efe3092`
- `equipment-signature-mythic-staff-blind-comparison.png` — corrected two-card anonymous sheet, SHA-256 `07eebdc19515cf234290662aca0602be1f33400524dec2527b4729d76e822556`

## Verification evidence

- Signature cohort verifier: GREEN, 25 item exports + 25 overlay exports, with every error list empty.
- Full art verifier: GREEN across `characters`, `equipment`, `families`, and `signature-overlays`; counts `18 / 229 / 22 / 25`, exports `294`, every error list empty.
- Focused Task 8 and coupled art suite: GREEN `178/178` across paired pipeline, signature contract, art contract, shared equipment pipeline, item visuals, and signature integrity.
- `npm run verify`: GREEN — type-check, lint, unit `3706/3706`, and build guard.
- `npm run verify:full`: GREEN on the frozen art snapshot — type-check, lint, unit `3705/3705`, build guard, desktop/mobile smoke, and Playwright shards `48/48 + 45/45`. The later CLI-registry regression is non-UI and passed the final `npm run verify` at `3706/3706`.
- The first full E2E attempt hit two transient Playwright click timeouts in `expedition-debrief.spec.ts` after smoke teardown reported a browser-close timeout. The unchanged snapshot passed that exact spec `3/3`, then passed the complete `verify:full` rerun. No application or test assertion was weakened.
- `npm run mobile:doctor` and `npm run cap:sync`: GREEN. Native web assets were synchronized; App Store distribution remains blocked by the missing local Apple Distribution identity, and Android release signing remains blocked by missing keystore inputs.
- `art-contract-report.json`: approved full-scope report, SHA-256 `60bc0e5e8261a3ca991a5bc23a9385ea1a5146ee504eec20fc11e7de34b73837`.
- Independent review reproduced the complete art surface and found one CLI authority defect: `--signature-registry` was parsed but not forwarded. The fix was established RED with a missing-registry false GREEN, then verified GREEN with nonzero status and byte-preserved report output; an explicit valid registry still verifies 25 item and 25 overlay exports.

Independent review is APPROVED. Commit and push remain the final delivery boundary; no Task 8 files were staged, committed, or pushed during the implementation and review passes.
