# Game completion requirement audit — 2026-09-10

Status: **LOCAL IMPLEMENTATION VERIFIED; whole Goal INCONCLUSIVE pending device/lifecycle**. Independent source/test/document re-review is complete at Critical0/Important0; no further functional/art C/I was identified. Perf post-fix full55522 and refreshed native packaging now pass. Fixtures do not establish natural play; unsigned packages do not establish installed-device behavior.

## Latest completed gate

Device read-only update: `xcrun devicectl list devices --timeout 10` exit0 shows target iPhone available/paired. Exact `device info apps --device FCB8EE83-2B35-5FAD-AA58-AA87EF2D2E3B --bundle-id com.aetheria.roguelike.freshqa --timeout 10`, session68889 exit0, establishes installed Aetheria version1.1.0/build2. Prior connection-reset evidence remains historical, not current connectivity. This lookup does not prove today's package identity, foreground/PID, or save/lifecycle success. No app launch/stop/install/save action; device-test window response still needed before interactive testing.

- Full55522 exit0:4508/4508 unit,118/118 E2E, desktop/mobile smoke, type/lint/build. `/tmp/aetheria-perf-full.log`. Existing3lint warnings and smoke browser.close timeout warning preserved; not a zero-warning claim.
- Diagnostic writer82928 then readonly69154 exit0, result/v1 unchanged,330sources onlymain.tsx hash changed. Desktop/mobile perf10/10 required finite and within unchanged limits; focused3 RED→GREEN, independent C0/I0.
- Cap8193, Android19521, unsigned iOS9641 exit0; mobile doctor exit0. Android release signing absent is an excluded release-signing prerequisite, not debug build failure.
- `output/perf-fix-native-20260910.json`:841images+43JS=884 selected paths source/dist/APK/iOS byte-equal, native tracked0. APK228609598bytes/SHA `c84508f16ff6fa61d6e9ebf32a0f6b41e8cff72a516835cfbf3feeb6c13dc24b`; iOS `/tmp/aetheria-perf-ios.1LT4n3/Build/Products/Release-iphoneos/App.app`. No install/sign/commit/push/publish.
- Earlier art/content/equipment/event/pacing gates remain the unchanged-input V27 evidence; subsequent main.tsx instrumentation does not change their production numerics/art. Full includes their regression contracts. Current actual iPhone build/PID/foreground and visible→hidden→visible/save-resume remain unverified.

| Requirement | Inspected evidence and boundary |
| --- | --- |
| Signature sets/1H/2H | `tests/signature-set-reachability.test.js` enumerates18 classes with reducer inventory actions, rejects2H+offhand, requires every advertised tier witness and compares UI progress. Current full log records PASS. Not every set is usable by every class. |
| Story/endgame | `tests/true-ending-flow.test.js` uses canonical quest metadata and blocks ASCEND until pending rewards are claimed. These and mobile ending E2E pass in the current full log. Quality23 direct evidence is controlled combat, not natural endgame difficulty. |
| Regional loot/growth | Current normal-loot/library/map-access tests cover actual level tiers, exclusions, capacity/replay, exact8 Tier4 library pool, real spawns and directed Lv62 access. Current full suite includes them. Long-term retention remains outside this proof. |
| Character18/map52/equipment229 | Prior art/direct-equipment evidence is indexed by `game-completion-implementation-closeout-20260909.md`, whose blanket conclusion was superseded by quality23. Follow successor evidence, not the old blanket conclusion. Current counts and package matching alone are not visual acceptance. |
| Monster254 | V27 adoption review and actual89 UI receipt supersede retained89 pending state. Corrected69 plus retained20 reviewed;234 authored/20 retained overall. Scoped owner/Sol static, implementation and UI C0/I0. Not natural play-all proof. |
| Save/offline/quota/capacity/reset | S5 links direct offline-reset/capacity and service-boundary quota evidence. `App.tsx` binds background to `flushLocalSave`; lifecycle tests synthesize visibility. Wiring/contracts pass; real background saving remains unverified. |
| Regression/native | `/tmp/aetheria-v27-full.log`: unit4505, E2E118, smoke/type/lint/build PASS; terminal receipt recorded in V27 adoption review. `output/v27-native-20260910.json`:841images+43JS match source/dist/APK/iOS; native tracked0. Not installed/signed. |
| Actual iPhone/termination | NOT VERIFIED. Prior device-info connection reset and browser hidden-transition failures remain recorded. No device interaction this audit. Neither lock nor crash is established as historical cause. |

## Remaining proof

Perf post-fix verification update: independent Sol/xhigh source/test re-review C0/I0. Writer82928 exit0, envelope `a80986bcd5c7ac94bbe338750b2a9b8c9d70d3fbd5170af637d759cbd6b2615d`; before/after nonSources digest equal (report/v1 included), sources330 and only main.tsx hash changed, removed0. Readonly69154 and full55522 started only after writer terminal; their completion/native follow-up remain pending. Logs `/tmp/aetheria-perf-diagnostic-verify.log`, `/tmp/aetheria-perf-full.log`. No second writer or source edits while gates run.

### Newly reproduced local Important finding: performance guard false PASS

Implementation update: `tests/perf-guard.test.js` RED missing module→GREEN3. `scripts/perf-metrics.mjs` rejects missing/non-finite/negative required metrics without threshold changes. main.tsx creates app-mounted before render; guard waits real paint and boot/intro measures before reading. Focused eslint/diffcheck PASS. Separate QA build47722exit0; desktop47016/mobile67512exit0 with all required metrics finite, FCP352/396ms. Logs `/tmp/aetheria-perf-fixed-{desktop,mobile}.log`; artifacts `playtest-artifacts/perf-fixed-{desktop,mobile}/perf-summary.json`. Preview81350 stoppedexit130. Production source changed, so V27 full/native is now a preceding checkpoint; diagnostic refresh/full/native and independent re-review remain. Master/art README/progress stale current sections corrected. Original finding below remains historical evidence.

`verify:full` does not enable the optional `AETHERIA_RUN_PERF` branch. Owner ran the existing guard separately. Production preview attempt31216 exited1 (`new run` timeout): production build intentionally lacks the test API required by this harness. It is not an app-start failure. Original log `/tmp/aetheria-v27-perf-desktop.log` preserved.

QA-only build36151 exit0 at `/tmp/aetheria-v27-perf.n5Cqi8` preserves production dist/native. Desktop guard38206 exit0, but `/tmp/aetheria-v27-perf-desktop-qa.log` reports `firstContentfulPaintMs`, `bootReadyMeasureMs`, `introVisibleMeasureMs` null. Its threshold filter ignores null metrics, so this is **not a valid performance PASS**. Source inspection finds `aetheria:app-mounted` referenced in App/Intro measurements but no producer under src. Missing boot/intro start mark is confirmed; paint capture timing remains to investigate rather than assume.

Next local implementation: TDD reject missing/non-finite required performance values; establish the correct app-start mark before consuming measurements; wait for real paint/required measurements within bounded time. Preserve thresholds and failed logs. Then repeat desktop/mobile perf and appropriate source/full/evidence gates. Do not label the whole local implementation complete until corrected. Owned preview4233 and54441 stopped with exit130; no device/user-save interaction.

1. Independent source/test/document review C0/I0 and current full/native completed as above. Long-term retention and natural play of every content entry are not substituted for the plan's scoped completion requirements.
2. Arrange a device-test window. Identify installed bundle/build and visible game state. V27 unsigned output is not assumed installed; obtain separate authority if signing/install is needed and preserve save.
3. Observe actual visible→hidden→visible, successful save and resumed interaction. Record exact PID separately; process survival alone does not prove restored state or historical crash cause.
4. Keep Goal open. Physical Android excluded; no commit/push/install/sign/publish.

Initial documentation-only audit used `git diff --check` without repeating builds. That scope has since changed: the perf correction modifies main.tsx and refreshes its diagnostic source pin. Full55522/read-only69154 are now required and running; refreshed native packaging must follow. The earlier V27 full/native checkpoint does not certify this newer source. Gameplay numerics/art/save remain unchanged.
