# Quota service browser check — 2026-09-08

Existing `isMockRuntime()` returns before the quota branch in `AI_SERVICE`. Ordinary device-QA gameplay therefore cannot prove exhausted-quota behavior. A separate blank same-origin browser page imported the actual Vite service modules without mounting the application or enabling a mock URL.

`output/s5-quota-browser.mjs` exited0; `/tmp/aetheria-s5-quota-browser.log`. Production `TokenQuotaManager.recordCall()` exhausted the fresh browser's local quota. Actual `generateEvent` returned reason `quota`, exhaustion message and3 fallback choices; `generateStory` returned the expected rest fallback. Quota storage was unchanged by both calls. `isMockRuntime:false` was asserted.

Browser routing blocked every external-origin and /api request before transmission. Attempt count was0. No auth action, Firestore write, paid request, user save or production source mutation occurred. This is an actual browser **service-boundary** observation, not a gameplay UI screenshot, daily rollover test or cross-device quota proof.

Focused Node service/Firestore tests10569 exited0,18/18 PASS (`/tmp/aetheria-s5-quota-focused.log`). They exercise mocked Firestore operations and do not claim a live server write.
