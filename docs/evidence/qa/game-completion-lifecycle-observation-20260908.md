# Background observation — not yet verified

## 2026-09-09 — mirroring connected; coordinated device access needed

CUA `getApp('com.apple.ScreenContinuity')` and `getAXStateAndScreenshot()` now showed a connected iPhone display rather than the earlier authentication prompt. An attempted Home shortcut returned `The user changed '/System/Applications/iPhone Mirroring.app'`; a fresh observation showed another application still in use. No further interaction was attempted to avoid competing with the user. Unrelated screen content was not copied into repository artifacts.

The previous authentication blocker is no longer the observed state. Next: arrange an uninterrupted device-test window, open the existing Aetheria installation, identify its build, and observe background/foreground and saved-state restoration. No game launch, lifecycle success, latest-build installation, or crash diagnosis is established by this check. The latest local unsigned build remains the Kingdom checkpoint, not a confirmed device installation.

## Actual device surface discovered — authentication required

2026-09-08 continuation: CUA inventory exposed the running `com.apple.ScreenContinuity` application. Its actual accessibility tree showed `연결이 일시 정지됨` and `재개`. Clicking that existing resume button once led to a locked iPhone Mirroring screen requesting the Mac login password. Both accessibility text and the returned screenshot confirmed the authentication boundary. No password was entered or obtained, no game was launched, and no software was installed.

This provides an available route for direct device-screen observation after user authentication, not a successful device connection or lifecycle result. The next action is user authentication in iPhone Mirroring, then inspecting the existing installed app and testing foreground/background interaction if available. The installed build must be identified separately; observing an older installation cannot certify the latest v21 unsigned build. The three earlier Playwright attempts below remain failed preconditions and were not repeated.

`output/s5-lifecycle-direct.mjs` attempted a headed390×844 browser with actual tab activation, observing native `document.visibilityState` and wrapping Storage.setItem only to record successful isolated QA writes. No synthetic visibility event or visibility property replacement was used.

Three executions terminated with the same missing precondition: after the alternate page was brought forward, the game document still reported `visible` rather than `hidden`.

-68932: standard headed Playwright; `/tmp/aetheria-s5-lifecycle-direct.log`.
-94361: removed background-throttling/occlusion default switches; `/tmp/aetheria-s5-lifecycle-default-flags.log`.
-17311: additionally disabled CDP focus emulation; `/tmp/aetheria-s5-lifecycle-real-focus.log`.

Local Playwright source `node_modules/playwright-core/lib/server/chromium/crPage.js` enables focus emulation by default, but disabling it did not establish the expected visibility transition. It is a investigated hypothesis, **not a proven root cause**. Actual tab/window activation semantics in this environment remain unproven. These failures do not demonstrate a game lifecycle defect or a completed background save test.

No further configuration retries were performed. Next evidence must come from a browser/device surface that demonstrably transitions visible→hidden→visible, followed by the corresponding save and resumed interaction. The game source and installed iPhone were not changed. Separate lifecycle bridge tests can validate callback contracts only; they do not replace this missing real-surface proof.

`node --import tsx --test tests/toss-lifecycle-bridge.test.js` exited0,8/8 PASS; `/tmp/aetheria-s5-lifecycle-focused.log`. This is synthetic bridge-contract evidence, not real background observation. Owned dev server96672 was stopped after inspection; no live probe remains.
