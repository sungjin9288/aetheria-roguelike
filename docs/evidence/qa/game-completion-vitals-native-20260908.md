# 원정 최저 체력 교정 — local native checkpoint

2026-09-08, HEAD `38a358454bfeb689cebf2a80c33478ac86371105`. Existing dirty work preserved; no commit, install, signing, archive change or publication.

## Verification

- Two new regressions RED (100 instead of77/78) → focused36 PASS. Independent Sol/xhigh C0/I0, independent focused28 PASS.
- `verify:full` session89080 exit0: unit4409/4409, E2E59+58=117, both smoke, type/lint/build guard. Desktop close guard reported browser.close timeout; wrapper completed normally. Log `/tmp/aetheria-expedition-vitals-full.log`.
- Initial verify88638 failed three source-bound evidence checks. Canonical progression/DOT evidence refresh changed only sources/sourceHashes, not reports. Original failure log retained; no assertion weakened.
- Art, content, equipment combat-power/economy verification PASS. Nonexistent `equipment:verify` command was corrected to the two existing package scripts.
- `env -u VITE_ENABLE_TEST_API npm run cap:sync` then mobile doctor9051 exit0. Android debug30755 and iOS unsigned31060 exit0. Logs `/tmp/aetheria-vitals-cap.log`, `/tmp/aetheria-vitals-android.log`, `/tmp/aetheria-vitals-ios.log`.
- `python3 output/verify-v8-native.py /tmp/aetheria-vitals-ios.02COuM`: 328 paths/package identical to production output (254 monsters,53 locations,18 characters,2 Earth Verdict images,main JS). Tracked Android/iOS drift0.

## Latest local artifacts

APK: `android/app/build/outputs/apk/debug/app-debug.apk`, 225984784 bytes, SHA-256 `a1ae7df4fc85f4b329e38f19ec6b0c274a2ecf3d05720524e6a4d210b403aaa1`.

iOS unsigned: `/tmp/aetheria-vitals-ios.02COuM/Build/Products/Release-iphoneos/App.app`.

Main JS: `assets/index-DMA63Uzn.js`, SHA-256 `db639528d6a3696d24f83bf38cbb8f0944ce42a9604232571e380c0b3c867beb`.

## Preserved authority and limits

Index empty, HEAD unchanged. Sorted path+NUL+raw-byte hashes:

- candidate6: `ac1956ad67087ddeae0cd1af85e57eee7a6bf94d3afb81b00a823f2ceb5ea0dd`
- Toss38: `0f870e56774c46dcbd477ceda6e9c6c1f312a4a7dec3f84ad10b3342934d5b5c`

Same fresh browser save demonstrated actual127 minimum→healing→return160 with debrief127/71%; see `game-completion-fresh-v19-20260908.md`. This is local QA play, not Toss or installed-device proof. Release signing prerequisites remain absent in doctor output; debug/unsigned success does not resolve those. Physical Android excluded. Whole-Goal S3/S5/S6, kingdom design approval and current-device foreground checks remain open.
