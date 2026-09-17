# Earth Verdict sword adoption — 2026-09-07

## Scope and source history

The production weapon is a two-handed greatsword. Its old item/overlay art depicted a hammer. The previously approved greatsword masters are now integrated into the paired source sheets and runtime PNGs. No combat values, equip rules, save schema or portrait composition changed.

Original masters, hammer exports and original sheets remain under `scripts/art_sources/equipment/v3/earth-verdict/masters/` and `previous/`. Before integration, the manifest and named/anonymous contact sheets plus answer key were also preserved there. The generationReview in the signature provenance remains the historical whole-sheet generation record; it is **not** a claim that the revised composite came from that old raw image. This correction's source chain is `prompts.md` → pinned masters → `prepare.py` → `prepared/receipt.json` → revised top-left cells → production paired exporter. Five neighboring cells per sheet are pixel-identical, and all other 48 signature runtime exports retain their prior hashes.

Only the top-left Earth Verdict cells change. The six members sharing each sheet receive its new source hash, but the other five item/overlay export hashes remain unchanged. Original registry/batch/provenance bytes remain in `previous/`; current registry and batch describe the greatsword.

## Verification

- Existing signature tests reproduced stale registry/answer-key failures; the new runtime regression separately failed because the item still used the old hammer.
- `node --import tsx --test tests/equipment-signature-art.test.js tests/earth-verdict-source.test.js tests/art-asset-contract.test.js tests/monster-catalog-art.test.js`: **40/40 PASS**, `/tmp/aetheria-earth-focused.log`.
- `process_signature_art_batch.py --replace-existing`: production export succeeded for the six-identity paired batch. Repeating the exact invocation returns **replay no-op**.
- `sync-signature-art-manifest.mjs`: all 25 item/overlay records validated and synchronized. Named/anonymous contact and answer-key regeneration is byte-identical on a second run.
- `npm run art:verify -- --write-report docs/evidence/art/art-contract-report.json`: PASS, `/tmp/aetheria-earth-art.log`. This is structural coverage, not visual approval of all game art.
- Initial `npm run verify:full`: 4371/4372 unit PASS, only progression evidence byte mismatch. After its deterministic refresh, all **4372/4372 unit**, typecheck, lint and build guard PASS. Desktop smoke PASS; mobile smoke timed out waiting for `render_game_to_text`, after browser-close timeouts. Full gate is not yet PASS. Logs: `/tmp/aetheria-earth-full.log`, `/tmp/aetheria-earth-full-green.log`.
- Diagnostic refresh changed **only** the `src/data/equipmentArtManifest.json` source record. Report, report hash, seed policy and v1 baseline are identical to `/tmp/aetheria-earth-diagnostic-before.json`. `progression:diagnostic:verify` PASS, `/tmp/aetheria-earth-diagnostic-verify.log`.
- `mobile:doctor` and `cap:sync` PASS; tracked Android/iOS drift 0. Distribution identity/release keystore remain unavailable. This is a web-asset sync, not an installed or signed native release.

## Actual visual review

Owner inspected `output/playwright/earth-verdict-adopted.png` at item160/32 and overlay72/32. The pointed blade, guard and long grip read as a sword.

An isolated Playwright browser loaded production `ITEMS` into the existing device-QA snapshot, then restored it as a level60 knight. This is a controlled fixture, not natural acquisition. The initial dev server lacked `VITE_ENABLE_TEST_API=1`; the API wait timed out. Restarting the task-owned server with the flag enabled the isolated harness. A pre-reload snapshot write was overwritten by lifecycle saving; installing that fixture before page initialization then restored the intended gear. No production test API was added or relaxed.

Owner inspected `output/playwright/earth-verdict-390x844.png`: the real equipment slot decodes `/assets/equipment-exact/signature-weapon-earth-verdict.png` at natural160px, displayed38.625px. Name, sword icon and two-handed offhand occupancy agree; horizontal overflow is false. The character portrait is job-fixed and still displays its own illustrated equipment; it is not a live equipped-weapon composite. Browser console contains development messages, no recorded app error. The task-owned browser and dev server were closed.

## Preserved release evidence

Sorted repo-relative path + NUL + raw bytes aggregates remain:

- historical candidates: 6 files, `ac1956ad67087ddeae0cd1af85e57eee7a6bf94d3afb81b00a823f2ceb5ea0dd`
- Toss releases: 38 files, `0f870e56774c46dcbd477ceda6e9c6c1f312a4a7dec3f84ad10b3342934d5b5c`

No commit, push, install, signing or publication. Other pending monster, character-alpha and map-cell corrections remain separate unfinished work.

## Browser recheck

After other verification processes completed, `bash scripts/local-playtest.sh` passed desktop and mobile smoke with exit0 (`/tmp/aetheria-earth-browser-recheck.log`). Desktop browser close still reported a nonfatal timeout after assertions; mobile completed. The first mobile boot timeout is preserved above rather than erased or classified as a proven environment-only issue. Full `npm run test:e2e` then passed separately: **59/59 + 58/58 = 117/117**, exit0 (`/tmp/aetheria-earth-e2e.log`). All constituent web checks passed on these code/assets, but the original `verify:full` invocation itself remains a failed run, not retroactively PASS.

Both exact sword PNGs are byte-identical in Android and iOS synchronized web assets (four `cmp` checks PASS). No new APK, app build, archive or iPhone installation was produced. The latest reviewed screenshot remains the local fixture capture below.

The directly reviewed mobile screenshot SHA-256 is `8acac0fe7869de43d3d67444230aaa4852874d3c8f0838c8c0a7dd575bf127a9`.
