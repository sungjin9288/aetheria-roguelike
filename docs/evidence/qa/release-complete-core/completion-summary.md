# Release-complete core completion summary

Date: 2026-08-11 KST

Status: repository-owned implementation verified; observation-dependent content and
external release gates remain HOLD

## Closed implementation slices

1. A single permanent-state authority preserves class journey, accessibility/detail
   settings, endgame ledger, expedition sequence and return-supply receipts across
   death, manual reset and ascension while resetting run-only state.
2. Legacy inventory shards migrate once into a bounded permanent endgame ledger.
   Demon King shard acquisition, final-shard unlock, true-boss spawn/consume and replay
   handling settle atomically in the combat reducer transaction.
3. The True Ending has immediate skip, reduced-motion completion, safe-area scrolling,
   deterministic presentation, back consumption and one-shot New Game+.
4. Own-grave recovery remains available. Public grave invasion is absent from
   production because it lacks a server-authoritative atomic claim.
5. Reset/ascension copy now distinguishes run loss from permanent preservation.
   Proven dead `inventorySpotlight` and `archivedHistory` runtime plumbing was removed.
6. A fail-closed bounded-encounter schema, selector and atomic receipt settlement exist,
   but the production pack is disabled and empty until evidence selects two regions.
7. A real-surface browser journey covers fresh play through skill branch, and a second
   route covers the final shard through New Game+ and reload.
8. Final review hardened the production boundary so both explore and combat seed
   controls fail the build guard, and only the exact catalog Demon King name can settle
   the permanent shard/ascension transaction.

## Verification on current working bytes

- Focused Plan A-C integration: `1276/1276`.
- Final-review affected regressions: runtime boundary `6/6`; endgame and combat
  outcome dependencies `197/197` — pass.
- Observation evidence schema v2 focused gate: region selector and bounded encounter
  contracts `22/22` — pass; the pending template exits `1` with no output.
- `npm run verify`: type-check, lint, unit `3946/3946`, build guard — pass.
- `npm run verify:full`: the same repository gate, desktop/mobile smoke and E2E
  `51/51 + 48/48` — pass.
- `AETHERIA_RUN_PERF=1 bash scripts/local-playtest.sh`: fresh QA build, desktop/mobile
  smoke and both performance guards — pass. Desktop intro/start/first-action/market
  measured `398.3/100.6/25.4/42.6 ms`; mobile measured
  `414.6/129.7/6.8/67.8 ms`.
- `npm run art:verify`: surfaces `characters`, `equipment`, `families`,
  `signature-overlays`; counts `18/229/22/25`; all missing/extra/duplicate/PNG/alpha/
  bounds/style/artwork arrays empty.
- `npm run mobile:doctor`: pass; local Apple Distribution identity and Android release
  signing inputs are absent.
- `npm run cap:sync`: pass; tracked `android/ios` drift is zero.
- `npm run android:debug`: initial shared Gradle-cache metadata failure recovered through
  the repository clean-cache retry; final `BUILD SUCCESSFUL`.
- `npm run ios:build:device`: unsigned arm64 device build `BUILD SUCCEEDED`.
- `npm run ios:archive:fresh-qa`: attempted only as a local device-QA archive and
  stopped before archive creation with Xcode exit `65` because this machine has no
  configured Apple account and no provisioning profile for
  `com.aetheria.roguelike.freshqa`. No stale archive is counted as current evidence.
- `git diff --check`: pass.
- Prospective explicit-path staging rehearsal after the schema-v2 scope change:
  `90` candidate paths, `0` forbidden `build/android/ios/historical Toss` paths and
  cached diff check pass; the real repository index remains empty.

## Local package evidence

- Android debug APK: `214642610` bytes, SHA-256
  `4c20b80200f88cafcae560c254c8903766a358bf81dc37f72fb8093c2555d46f`.
- Unsigned iOS executable: `102376` bytes, SHA-256
  `6372d559d57e897c21f87244863be80a792e7db279c8d9e1deef6ec53306292f`.
- Unsigned iOS `.app` aggregate: `1804` files, `218762955` bytes, SHA-256
  `e337d06c0402f2f5912ed2e80952269ee9fc9b82f6b1b6a13b14259b64f55196`.

## Explicit blockers and next gate

- The working tree is uncommitted and therefore is not a final candidate.
- Five candidate-bound, fresh, human observations do not exist. `observation-summary.json`
  remains intentionally empty and `region-selection.json` remains absent.
- Schema v2 now requires five complete candidate-bound human journeys, unique attachment
  hashes, accepted actions, save/background restore, mobile back results, bidirectional
  issue links and zero P0/blocking P1 before it can write a selection.
- Consequently no two regions are selected, no four encounter families are authored,
  and `BOUNDED_ENCOUNTER_PACK_ENABLED` remains false.
- The iPhone is paired and USB-available, but a current fresh-QA install cannot be
  produced until the Xcode account/profile blocker above is resolved. No Android device
  is attached. Physical iOS/Android observation, Apple Distribution identity, Android
  release keystore, signed distribution and Store submission are separate gates.
- Every prior Toss artifact/deployment is superseded by these source changes. Toss
  upload, Sandbox, review, public release and ad activation remain HOLD and require a
  separately approved candidate.

The exact next action is to approve a cohesive commit candidate, build candidate-bound
device packages, and collect at least five fresh human observations. Only then may the
deterministic selector choose two regions and unlock bounded encounter authoring.

## Prospective cohesive commit boundary

- Include the release-complete production, test, plan/spec, selector and
  `docs/evidence/qa/release-complete-core/` paths represented by the current working
  tree, together with `progress.md` and `tasks/todo.md`.
- Exclude `build/`, native generated outputs, credentials, and the historical untracked
  `docs/evidence/toss/releases/` tree. That Toss tree is superseded audit-only material,
  not evidence for this candidate.
- Before any commit, stage by explicit path, require `git diff --cached --check`, assert
  the staged path list contains no `build/`, `android/`, `ios/` or historical Toss
  release path, then review the staged diff. No broad `git add .` is permitted.
