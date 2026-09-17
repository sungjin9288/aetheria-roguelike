# Character art full gate — sleep interruption

## Original run

`npm run verify:full`, handle89516, exited1. Log: `/tmp/aetheria-character-eight-full.log`. Typecheck/lint/build,4380/4380 unit, desktop/mobile smoke and first E2E shard59/59 passed. The second shard passed55/58; three30-second tests timed out while the computer was sleeping. A desktop browser-close timeout also remains a nonfatal shutdown warning.

| Failed test | Test duration | macOS power evidence, KST |
| --- | --- | --- |
| shop.spec.ts:21, beforeEach | 5.2min | 18:22:57 Clamshell Sleep,313sec;18:28:10 DarkWake |
| system-settings-design.spec.ts:73, beforeEach/status-chip click | 13.2min | 18:28:55 Maintenance Sleep,791sec;18:42:06 DarkWake |
| true-ending-new-game-plus.spec.ts:228, geometry evaluate | 1.6min | 18:42:51 Maintenance Sleep,96sec;18:44:27 lid/UserActivity Wake |

The sleep durations match the three abnormal test durations. Other tests ran in a few seconds. A read-only process check found no remaining character-aperture test or Playwright test process after the full run ended. No application or test source was changed to address these timeouts. We did not increase timeout, add retries or disable assertions.

Original screenshots/error-context files are copied under `output/playwright/character-full-sleep-failure/`; the original full log is retained. System evidence was read with `pmset -g log`, filtered to the six sleep/wake events above, not a change to power settings.

## Narrow verification after wake

```sh
npx playwright test tests/e2e/shop.spec.ts:21 tests/e2e/system-settings-design.spec.ts:73 tests/e2e/true-ending-new-game-plus.spec.ts:228 --output output/playwright/character-sleep-focused
```

Handle41564 exit0:3/3 passed in16.4sec (individual4.1/6.1/1.9sec), with unchanged source/configuration. Log `/tmp/aetheria-character-sleep-focused.log`. This verifies those three paths after wake; it does not retroactively change the original full command to PASS.

## Current gate

Fresh full run80148 exited0: `npm run verify:full`, log `/tmp/aetheria-character-eight-full-awake.log`. Typecheck/lint/build,4380/4380 unit, desktop/mobile smoke and both E2E shards59/59 +58/58 passed. The desktop browser-close timeout remains a nonfatal shutdown warning. This new terminal result is the completion receipt; the original sleep-interrupted failure is preserved above, not relabeled.

Production `npm run build:guard`, `npm run cap:sync` and `npm run mobile:doctor` subsequently exited0 (logs `/tmp/aetheria-character-production.log`, `/tmp/aetheria-character-cap.log`, `/tmp/aetheria-character-doctor.log`). Doctor reports missing Android release signing inputs and no iOS distribution identity; debug/unsigned packaging is a separate local check, not release signing or installation.

Separate read-only device probe `/tmp/aetheria-character-device-0907.json`: iPhone paired/developerMode enabled but tunnel disconnected; iPad unavailable. No install, launch, signing or device-state change. Current iPhone app version/process survival remain unverified, not an established app regression.
