# Elemental six — local implementation and verification complete

User approved `2026-09-09-aetheria-elemental-six-identity.md`. Before writes, owner verified all six runtime SHA pins plus manifest, monsters.ts, maps.ts and diagnostic pins. The new v25 directory did not exist. `previous/` preserves these runtime PNGs, manifest, corrections registry and diagnostic; other248 and gameplay remain unchanged at this checkpoint.

## Sources and candidates

`generation-records.json` records nine built-in calls, exact prompts and original locations. Six selected masters are workspace-local. The first fire-drake had a blunt/cropped-looking wing tip near the frame and was rejected. Its targeted edit produced an opaque RGB checkerboard and was also rejected. A third source failed Sol dark32 readability (I1); a fourth, broader/brighter gliding source resolved I1. All three rejected sources remain in `rejected/`; initial exports and sheets remain in `exports-initial/` and `review-initial-{1,2}.png`. No paid API fallback, background-removal heuristic or discarded source deletion.

## Export and review

- Preparer RED: both initial tests failed with missing v25 preparer, before implementation.
- GREEN: three tests pass, including deterministic two-output bytes, source preservation, source drift, existing-output rejection, opaque/empty rejection and 160×160 binary alpha with8px margins.
- Adoption RED: both initial integration tests fail because runtime/registry still use retained prototypes. No adoption yet.
- Owner viewed `review-1.png` and `review-2.png` at160/46/32 on dark/light. Pair silhouettes are distinct. Dark32 fire-drake readability is under independent Sol/xhigh review; no acceptance claimed yet.
- Protected candidate6 SHA `7dcbf4b4257c12a53bd7b6eefd6960add664cec9b60ddfe5bd5d676f2b1615d6` and Toss38 SHA `d163a994bb201ab89d32c17fed9e96945c70fa5843406980238d9e414f5ee588` unchanged.

## Adopted local implementation

Sol/xhigh visual re-review C0/I0: final fire-drake dark32 head/pouch/wings are readable; unchanged other5 verified byte-identical. Selected export SHA `11406456fc551baa2eedcfe5b06ef7328f75be73c00e00dc9ce52e5e6755a481`. Exact6 copied to runtime and authored paths; manifest changes only6 source/hash pairs, registry adds6, other248 preserved. Large/reordered patch attempts were rejected with no mutation; final ascending minimal field patch succeeded.

Focused16/16 PASS (`/tmp/aetheria-elemental25-focused.log`): preparer3, adoption3 and historical5pairs. Historical5 failures before correction are preserved in `/tmp/aetheria-elemental25-historical-red.log`; those tests now resolve these exact6 to v25 preimages and retain every SHA assertion. No broader bypass.

Canonical writer50466 exit0, evidence SHA `ced614ce1b41a32fb4bc2583baf6996953c7fa0ed5db75192a5bf4d3d8ed3fb0`. Report/v1Baseline identical;330 source paths unchanged, only `src/data/monsterArtManifest.json` source SHA advances. Initial comparison helper used nonexistent `sourceManifest`; corrected to actual `sources` and assertions passed, without changing evidence. Readonly verify→full handle66138 in progress. Art/content/mobile doctor85136 exit0; distribution signing inputs remain outside unsigned/debug scope.

## Direct browser verification

Stable captures `output/playwright/v25-stable-<slug>-390x844.png` for all6 viewed by owner. Runtime PNG160 decodes, renders46×46, overflowfalse and console/page errors[]; attack clicks reduce each enemy HP (`ui-receipt.json`). QA uses production EXP/class-vitals/spawn and real map species, not natural encounter/balance evidence. Seasonal level-array fixture initially left ice knight player at1; corrected QA helper to map range lower bound20. Initial screenshots caught action-shell fade and are preserved/excluded; stable rerun50885 exit0 waits attack ancestor opacity. Saved UI helper/output in `output/elemental25-ui-*`, logs `/tmp/aetheria-elemental25-ui{,-final}.log`.

Web-game client19550 exit0, owner viewed `output/playwright/elemental25-client/shot-0.png`; generic item-investment screen smoke only, not the six combat proof. Module-type warning retained, no runtime error claim from warning. Current owned dev92801 and CLI `elemental25` remain open during verification.

Independent implementation audit Sol/xhigh C0/I0 confirms six-only fields/registry, other248, original/master/export/runtime chain, source pins and historical assertions. First full66138 exited1:4474/4475 unit PASS, sole failure was common `monster-catalog-art.test.js` expected corrected-name list still149. Added only approved6 to that explicit list; assertions unchanged. Final focused29745 exit0:26/26 PASS. This test is not in330 diagnostic source inputs, so no gratuitous evidence refresh. Full rerun log `/tmp/aetheria-elemental25-full-final.log` now active. Owned UI close33988 exit0 and dev92801 explicitly stopped; no personal browser/save touched.

Full rerun40074 exited0:4475/4475 unit,118 E2E(59+59), desktop/mobile smoke, typecheck/lint/build PASS. Existing lint3 ref warnings and desktop browser.close timeout after smoke assertions are retained, not counted as app failures or silently removed. Sol final one-line catalog delta re-audit also C0/I0. Browser/dev owned handles are closed.

## Final local checkpoint

Cap69173, Android59430 and unsigned iOS96909 exited0. Logs `/tmp/aetheria-elemental25-{cap,android,ios}.log`. Native verifier exited0: `python3 output/verify-library-loot-native.py /tmp/aetheria-elemental25-ios.jZdTdp`; receipt `output/elemental25-native-20260909.json`. Selected841 images (including all254 monster portraits) and43 production JS chunks, total884 paths, are byte-identical in source/dist/APK/iOS as applicable. This is selected-path equality, not a claim of checking every packaged file.

- APK: `android/app/build/outputs/apk/debug/app-debug.apk`,227040016bytes, SHA `2c32c4a36cce7cdadce132687f016f280496e06a3c1a12e0c69579d153d3c430`.
- Unsigned, uninstalled iOS: `/tmp/aetheria-elemental25-ios.jZdTdp/Build/Products/Release-iphoneos/App.app`.
- Final native tracked drift0, indexempty, HEAD38a3584, `git diff --check` PASS. Protected candidate6/Toss38 remain identical to the hashes above;330 canonical diagnostic source hashes still match after packaging.
- All scoped writer/full/native/UI handles are terminal; owned CLI/dev closed. No original/master/rejected source or previous iOS artifact was removed.

The approved6 correction is locally complete:155 authored/99 retained is a coverage partition, not acceptance of the remaining99. Four contextual candidates and remaining95 final acceptance, coordinated real-device/lifecycle and S6 remain separate. No installation/signing/commit/push/publication; whole game Goal is not complete.
