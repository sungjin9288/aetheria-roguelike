# New Game+ reload readiness — 2026-09-08

## Failure and boundary

Update: corrected full8060 exited0, unit4407/E2E117/both smoke/type/lint/build PASS. Log `/tmp/aetheria-v19-full-readiness.log`. Independent Sol/xhigh review: Critical0/Important0, two documentation accuracy findings corrected below. Production/cap/doctor81343, Android2795/iOS63692 exited0 after full terminal confirmation; native-checkpoint.json in monsters/v19 records328 matching package paths, no installation.

v19 `verify:full` session53034 exited1: unit4407 passed, E2E116 passed/1 failed. At `tests/e2e/true-ending-new-game-plus.spec.ts:206`, the final reload read prestigeRank0 instead of4. Original log `/tmp/aetheria-v19-full.log` remains preserved. Its referenced test-results screenshot/error-context directory is no longer present after subsequent Playwright runs; those artifacts were not separately archived and are not claimed as retained evidence. The failure temporarily held native packaging at v18; the corrected full gate later released v19 packaging as recorded above.

## Investigation

- Unmodified focused scenario repeated five times: session23917 exit0, 5/5 passed (`/tmp/aetheria-v19-reload-repro.log`). This is non-reproduction, not proof of repair.
- `INITIAL_STATE` starts at bootStage `init`, gameState `idle`, prestigeRank0. `useFirebaseSync` dispatches restored `LOAD_DATA` from an effect; `bootstrapHandlers.LOAD_DATA` sets `bootStage:ready` together with the restored player. Thus `idle` alone does not identify completed restoration.
- Isolated Chromium observation, current preview bundle, 390×844: `output/v19-restore-observation.mjs`, session9070 exit0, `/tmp/aetheria-v19-restore-observation.log`. Used the existing isolated true-ending QA fixture, rank3, not a natural run or the original rank4 failing session. Across30 reloads,29 first API observations were `init/idle/rank0` while the persisted rank remained3. After ready, all30 restored rank3. No production save namespace or gameplay source was modified.

## Minimal correction and regression contract

The E2E now verifies persisted prestigeRank4 after explicit flush, waits for existing `render_game_to_text().bootStage === ready` after reload, then keeps all original idle/rank/heart/receipt/Class Journey/settings/sentinel assertions. A missing save, lost rank, missing restore completion or corrupted restored state still fails. No fixed sleep, retry configuration, expected-value relaxation or production save change.

Full original failure log is retained as RED evidence; the independent observation demonstrates the incorrect readiness predicate. Focused session57610 exited0: all3 scenarios repeated3 times,9/9 PASS (`/tmp/aetheria-v19-reload-green.log`). Full rerun8060 exited0 (`/tmp/aetheria-v19-full-readiness.log`). Direct ESLint on this E2E path was ignored by repository configuration; its exit0 is **not** file lint coverage. `git diff --check` passed.
