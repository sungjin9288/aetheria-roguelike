# Release-complete core completion summary

Date: 2026-08-11 KST

Status: content pacing and bounded encounters are locally verified and packaged;
fresh-human acceptance, push and external release gates remain HOLD

Implementation commits: `ea28b09` (deterministic audits), `f10f66a` (pacing and
settlement), `ca9e1d0` (mobile surface evidence). A new observation candidate is not
bound until this ledger close-out is committed and its exact source/artifact digest is
recorded.

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
6. The approved early-region slice is active in `고요한 숲` and `서쪽 평원`: four
   bounded encounters settle costs and rewards through an atomic receipt transaction.
7. A real-surface browser journey covers fresh play through skill branch, and a second
   route covers the final shard through New Game+ and reload.
8. Final review hardened the production boundary so both explore and combat seed
   controls fail the build guard, and only the exact catalog Demon King name can settle
   the permanent shard/ascension transaction.
9. Optional decision spacing requires one ordinary exploration outcome between choice
   screens. Scout chance is `0.15` and the immutable `exploration-rhythm@2` profile
   changes only the event axis to `0.8`.

## Verification on candidate bytes

- Focused Plan A-C integration: `1276/1276`.
- Final-review affected regressions: runtime boundary `6/6`; endgame and combat
  outcome dependencies `197/197` — pass.
- Content/pacing independent review: focused `61/61`, Important `0` — approved.
- `npm run content:verify`: SHA-256
  `a662637574c9cdd51d4be1aa02e7c9176beff9ad66c618647ac4344b34b4f0e8`;
  job reachability checkpoints `1/5/5/6/13/18/18`, job snapshots `18` — pass.
- `npm run pacing:verify`: SHA-256
  `7d903b8219911946378703421f4c6cf6f90c9e524d2a6abdb2066eab4072bfe2`;
  predecessor gap p10/p50/p90 `1/2/6`, candidate `2/4/9` — pass.
- `npm run verify`: type-check, lint, unit `3973/3973`, build guard — pass.
- `npm run verify:full`: the same repository gate, desktop/mobile smoke and E2E
  `52/52 + 50/50` — pass. The desktop post-assertion `browser.close timeout` remains a
  best-effort shutdown log; all smoke assertions passed.
- `npm run art:verify`: surfaces `characters`, `equipment`, `families`,
  `signature-overlays`; counts `18/229/22/25`; all missing/extra/duplicate/PNG/alpha/
  bounds/style/artwork arrays empty.
- `npm run mobile:doctor`: pass; local Apple Distribution identity and Android release
  signing inputs are absent.
- `npm run cap:sync`: pass; tracked `android/ios` drift is zero.
- `npm run android:debug`: initial shared Gradle-cache metadata failure recovered through
  the repository clean-cache retry; final `BUILD SUCCESSFUL`.
- `npm run ios:build:device`: unsigned arm64 device build `BUILD SUCCEEDED`.
- `git diff --check`: pass.

## Local package evidence

- Android debug APK: `214646216` bytes, SHA-256
  `5b36d5fbf1153a60eef5dda291b2c5b1f1490c3e50364b5f81ea6f8f8f8e2f3a`.
- Unsigned iOS executable: `102376` bytes, SHA-256
  `6372d559d57e897c21f87244863be80a792e7db279c8d9e1deef6ec53306292f`.
- Current bounded-encounter browser captures:
  `375x667 e834a4c0...8f28957`, `390x844 00aa403d...0abad0`,
  `430x932 0a15d8fd...172ddc`. These bind the final local E2E run, not a claim of
  byte-stable browser rasterization.

## Explicit blockers and next gate

- The earlier `1/5` browser observation belongs to superseded commit `f9d463a` and is
  historical only. `observation-summary.json` is reset to an unbound `0/5`; no human
  observation is counted for the new content bytes.
- Schema v2 now requires five complete candidate-bound human journeys, unique attachment
  hashes, accepted actions, save/background restore, mobile back results, bidirectional
  issue links and zero P0/blocking P1 before it can write a selection.
- The approved two-region/four-family content exists locally, but push and tuning
  acceptance remain blocked until five fresh, candidate-bound journeys pass with P0 0
  and blocking P1 0.
- The iPhone is paired and USB-available, but a current fresh-QA install cannot be
  produced until the Xcode account/profile blocker above is resolved. No Android device
  is attached. Physical iOS/Android observation, Apple Distribution identity, Android
  release keystore, signed distribution and Store submission are separate gates.
- Every prior Toss artifact/deployment is superseded by these source changes. Toss
  upload, Sandbox, review, public release and ad activation remain HOLD and require a
  separately approved candidate.

The exact next action is to commit this ledger close-out, bind that immutable source and
current artifacts as the observation candidate, then collect five fresh human journeys.
Only after all five pass may this task be pushed or used as a tuning baseline.

## Cohesive commit boundary

- Include the content/pacing production, deterministic reports, tests, screenshots and
  synchronized release-complete ledgers represented by the current working tree.
- Exclude `build/`, native generated outputs, credentials, and the historical untracked
  `docs/evidence/toss/releases/` tree. That Toss tree is superseded audit-only material,
  not evidence for this candidate.
- Create the commit through explicit-path staging only after `git diff --cached --check`
  and a forbidden-path scan. Do not use broad `git add .`.
