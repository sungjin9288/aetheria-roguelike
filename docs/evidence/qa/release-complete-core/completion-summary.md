# Release-complete core completion summary

Date: 2026-08-13 KST

Status: content pacing, bounded encounters, relic balance Slices 1/2A/2B and
equipment economy Slice 3A are locally verified; immutable candidate creation,
fresh-human acceptance, commit/push and external release gates remain HOLD

Historical implementation commits are `ea28b09` (deterministic audits), `f10f66a`
(pacing and settlement), `ca9e1d0` (mobile surface evidence), followed by ledger
close-out `3a2407a`. Observation candidate `release-core-3a2407a0c961` remains bound
to that exact committed tree, but the later uncommitted relic and combat-follow-up
bytes supersede it. It is not the current candidate and its empty `0/5` observation
record is historical only.

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
10. Relic balance now keeps `불사의 의지` at epic rarity, makes `free_skill`
    strongest-only and order-independent, and makes `event_chance` additive and
    order-independent. New common `고대 지도` is `15%`, uncommon `방랑자의 부적`
    remains `30%`, and legacy active-run values remain snapshot-authoritative.
11. Equipment economy now resolves all 229 canonical base identities without
    flattening prefixed/enhanced instances, migrates legacy saves additively, and
    changes only the approved 20 T4/T5 prices. The deterministic report is
    `b59654c6...513e`; the final 390×844 shop proof is `5858518f...1bb`.

## Verification on current uncommitted implementation bytes

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
- `npm run relic:event-chance:verify`: 64 seeds, report SHA-256
  `424909de42bc199747279d17e645b9360996912c2b669f637a7ccce9e4574597`;
  map-only general narrative `14710→12129`, stacked `16337→13881` — pass.
- Relic/coherence focused integration: `257/257`; 390×844 real reducer/UI
  Playwright: `1/1` — pass.
- Equipment economy focused integration: `112/112`; strict evidence verifier,
  malformed-identity mutations and 390×844 legacy-save purchase E2E `1/1` — pass.
- `npm run verify`: type-check, warning-free lint, unit `4030/4030`, build guard — pass.
- `npm run verify:full`: the same repository gate, desktop/mobile smoke and E2E
  `53/53 + 53/53` — pass. The desktop post-assertion `browser.close timeout` remains a
  best-effort shutdown log; all smoke assertions passed.
- `npm run art:verify`: surfaces `characters`, `equipment`, `families`,
  `signature-overlays`; counts `18/229/22/25`; all missing/extra/duplicate/PNG/alpha/
  bounds/style/artwork arrays empty.
- `npm run mobile:doctor`: pass; local Apple Distribution identity and Android release
  signing inputs are absent.
- `npm run cap:sync`: pass; tracked `android/ios` drift is zero.
- `npm run android:debug`: `BUILD SUCCESSFUL` on the synced canonical web assets.
- `npm run ios:build:device`: unsigned arm64 device build `BUILD SUCCEEDED`.
- `git diff --check`: pass.

## Local package evidence

- Android debug APK: `214645615` bytes, SHA-256
  `7906a00b37d1ccf5633cd0dc1326496d50a5553724ba818fbb41671beea14fc8`.
- Unsigned iOS executable: `102376` bytes, SHA-256
  `6372d559d57e897c21f87244863be80a792e7db279c8d9e1deef6ec53306292f`.
- Current bounded-encounter browser captures:
  `375x667 ef35a0f3...8a1de9`, `390x844 f4dd4663...7e8dc6`,
  `430x932 e765e669...3a41f`. These bind the final local E2E run, not a claim of
  byte-stable browser rasterization.
- Relic event-chance 390×844 capture: SHA-256
  `1de1ac8a00abf8b4cd1be5efcf7318787663f1c39c8584f19dbd3dfd4bb7f6d0`.
- Equipment economy 390×844 capture: SHA-256
  `5858518fa5c9ba7ff619371b4ca97e9b79d25f0ae28c4f175bd9de9f7c4d31bb`.

## Explicit blockers and next gate

- The earlier `1/5` browser observation belongs to superseded commit `f9d463a`.
  `observation-summary.json` remains bound to later historical candidate `3a2407a` at
  `0/5`; neither record counts for the current uncommitted balance bytes.
- Schema v2 now requires five complete candidate-bound human journeys, unique attachment
  hashes, accepted actions, save/background restore, mobile back results, bidirectional
  issue links and zero P0/blocking P1 before it can write a selection.
- The approved two-region/four-family content exists locally, but push and tuning
  acceptance remain blocked until five fresh, candidate-bound journeys pass with P0 0
  and blocking P1 0.
- No physical-device observation was performed for these uncommitted bytes. Apple
  Distribution identity, Android release keystore, matching install profiles, signed
  distribution and Store submission are separate external gates.
- Every prior Toss artifact/deployment is superseded by these source changes. Toss
  upload, Sandbox, review, public release and ad activation remain HOLD and require a
  separately approved candidate.
- Formal Native Goal `goal_7a57d7db-6953-4310-94b1-518c4524e035` was closed through
  the supported dispatch-less reconciliation path as `failed / goal-owner-closeout`.
  The external completed worker was not adopted, `dispatchId` stayed null, and the
  repository lease is now `released`. This closeout proves orchestration ownership;
  it does not turn the uncommitted repository bytes into an immutable candidate.

The exact next action is a separately authorized cohesive commit that excludes build,
native generated output and Toss evidence, followed by a new immutable candidate bind.
Only then can five fresh human journeys begin; only after all five pass may the result
be used as a tuning baseline.

## Cohesive commit boundary

- Commit `3a2407a` includes the content/pacing test seam, screenshots and synchronized
  release-complete ledgers on top of the three implementation commits.
- Exclude `build/`, native generated outputs, credentials, and the historical untracked
  `docs/evidence/toss/releases/` tree. That Toss tree is superseded audit-only material,
  not evidence for this candidate.
- `observation-summary.json` remains historical evidence for `3a2407a`; do not repoint
  it to uncommitted or automated bytes. A new candidate binding belongs after an
  authorized cohesive commit.
