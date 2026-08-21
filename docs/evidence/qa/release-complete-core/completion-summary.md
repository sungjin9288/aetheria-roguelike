# Release-complete core completion summary

Date: 2026-08-20 KST

Status: content pacing, bounded encounters, relic balance, equipment economy,
equipment combat-power sidegrades, consumable authority and event reward transactions
are locally verified and grouped into the cohesive HEAD that contains this summary.
Fresh-human acceptance, push and external release gates remain HOLD.

Historical implementation commits are `ea28b09` (deterministic audits), `f10f66a`
(pacing and settlement), `ca9e1d0` (mobile surface evidence), followed by ledger
close-out `3a2407a`. Observation candidate `release-core-3a2407a0c961` remains bound
to that exact committed tree, but the later cohesive relic, equipment, consumable and
event-reward candidate supersedes it. Its empty `0/5` observation record is historical
only and cannot be reused for the current candidate.

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
12. `gold_mult` now selects the strongest finite non-negative active-run snapshot in
    `CombatEngine.handleVictory`. `gold_magnet` remains `0.3` and `merchant_seal`
    remains `0.6`; both inventory orders settle `floor(101 × 1.6) = 161`, malformed
    inputs and reward overflow fail before settlement, and migration/reload preserve
    legacy relic descriptions and values byte-for-byte.
13. `drop_rate` now reuses that same shared strongest-value authority in
    `CombatEngine.processLoot`. `lucky_coin` remains `0.5` and `fortune_relic` remains
    `1.0`; enriched, legacy and high-level bonus paths are inventory-order independent,
    preserve valid RNG order and prestige guarantees, and fail before mutation on
    malformed values or unsafe chance arithmetic.
14. `dot_mult` now selects the strongest finite non-negative active-run snapshot in
    skill status-damage settlement. `curse_crystal` remains `1.5` and `death_mark`
    remains `3.0`; both inventory orders settle the same damage, while the no-relic
    multiplier `1.0` and legacy burn log remain unchanged. Malformed matching values
    fail before RNG or combat mutation.
15. `hp_drain_atk` now resolves attack bonus, HP cost and player-facing source label as
    one paired authority. `blood_oath_ring` remains `+35% / 3%`, `abyssal_contract`
    remains `+60% / 5%`, both inventory orders select the complete abyssal pair, and
    `hell_reaper` replaces only the selected cost with `2%`. HP stays at or above one;
    malformed matching snapshots fail before turn or reducer mutation.
16. Four equipment strict-dominance defects are closed without increasing their primary
    ATK/DEF. Ranger coat gains `3%` evasion, poison whip gains `9%` crit, nebula staff
    gains `20` MP and storm staff gains `10` MP. The combat report has no dominance
    pair or replan cohort, while the existing price correction and signature authorities
    remain unchanged.
17. Idle and combat consumables now settle from current reducer state and exact item
    identity. Effectless, stale, replayed and rapid duplicate inputs are no-ops; a valid
    combat item consumes one instance and advances one turn without quickslot drift.
18. Event rewards use explicit transactions instead of presentation promises. Three
    fallback wagers settle exact costs and net rewards once, failed chains cannot unlock
    downstream steps, costs cannot make gold negative, relic/item promises are canonical
    and capacity-aware, and the 100-row reward audit has zero errors.

## Verification on current cohesive candidate bytes

- Equipment combat/economy/progression focused integration: `44/44` — pass.
- `npm run equipment:combat-power:verify`: evidence SHA-256
  `cdfab6b20b994fd25f9a1b133213abeac813d0362a11ee1e42a6aa602be3fcdc`;
  defect/pair/replan `0/0/0`, `requiresReplan=false` — pass.
- `npm run equipment:economy:verify`: evidence SHA-256
  `80a209eed4b024cc76d6b382ed5b5355b62e4480e6a19bdd4c7d3fae5cbdc61c`;
  report digest `33558b95856f4a357940d165256b4587d2a66a9176ff2fa4b68f4649276a9f93` — pass.
- Current `npm run verify:full`: type-check, warning-free lint, unit `4156/4156`,
  build guard, desktop/mobile smoke and E2E `55/55 + 54/54` — pass.
- Current `npm run mobile:doctor` and `npm run cap:sync`: pass; tracked Android/iOS
  drift is zero. Distribution signing inputs remain external blockers.
- Focused combat/consumable/fallback browser journeys at 390x844: `7/7` — pass.
- Focused event reward and settlement suite: `80/80` — pass.
- `npm run event-reward:verify`: 100 rows, 0 errors, report SHA-256
  `f253158f35d6f37f4d8781350f0f6b218b4024cfcf1b5df24228014140cf86f6`;
  evidence SHA-256 `c1d4c9a80f6ac11dd74663986408c8bd6ab2eaa34de557e75428469959ba1cc0` — pass.

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
- `node --import tsx --test tests/relic-gold-multiplier-coherence.test.js`: focused
  production RED→GREEN, migration, replay, malformed input, audit and tamper coverage
  `9/9` — pass. `npm run relic:gold-multiplier:verify`: report SHA-256
  `16a7bcc710465bca277877e695145eb06c5a8b58af90b0a69894632c9809efa9` — pass.
- `npx playwright test tests/e2e/relic-gold-multiplier.spec.ts --project=chromium-mobile --workers=1`:
  390×844 production reducer/UI two-order and rapid-double-tap proof `1/1` — pass.
- `npm run relic:drop-rate:verify`: three production loot paths, malformed cases,
  migration, replay and prestige invariant; report SHA-256
  `2ddf68f9dbcc2b942d4ae5429bf89dc92af5abaaaa92a702774ecde058899e60` — pass.
- `node --import tsx --test tests/relic-drop-rate-coherence.test.js tests/combat-engine-loot.test.js`:
  controlled production RED→GREEN and current coherence `42/42` — pass.
- `npm run relic:dot-multiplier:verify`: strongest-order, no-relic legacy, malformed,
  migration and replay vectors; report SHA-256
  `b123dee8e47f7b405584470bc03087f6e81fbbb98aecfd0ee1bb10068068a204` — pass.
- `node --import tsx --test tests/relic-dot-multiplier-coherence.test.js`: production
  RED→GREEN, false-GREEN no-relic regression and current coherence `10/10` — pass.
- `npm run relic:hp-drain-atk:verify`: paired source/order/synergy, malformed input,
  migration and reducer replay vectors; report SHA-256
  `7560ce01d64893c90909793047a53e1aaa0631597b5b2b3f7bb8464c75e05793` — pass.
- `node --import tsx --test tests/relic-hp-drain-atk-coherence.test.js`: production
  RED→GREEN and current coherence `14/14` — pass.
- Base relic audit was refreshed to report SHA-256
  `c5c425d0a6554373dddd1c3bdce621b26225f84246101ead6d4cb57bfde719a8`;
  all seven relic verifiers pass.
- `npm run verify`: type-check, warning-free lint, unit `4076/4076` and build guard — pass.
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

- Android debug APK: `214644297` bytes, SHA-256
  `de5e6cf760d3f6f7ceae835acf3a788a2531f8250b5ffc80fecc200d64fa59f4`.
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
- Gold multiplier 390×844 capture: SHA-256
  `335061d7391fbd6935df914bf102f71cc4ee4ab55143240721f528548055af7e`.
- Drop-rate evidence JSON: SHA-256
  `b800cb308005cc239bf3038c0e198a8cb463f624e0f2b3a87a8cf219bf8b721a`.
- HP-drain evidence JSON: SHA-256
  `5b28e1eb312ec039265679d843109bcabd4b53977188809d0477dd0d026044df`.

## Explicit blockers and next gate

- The earlier `1/5` browser observation belongs to superseded commit `f9d463a`.
  `observation-summary.json` remains bound to later historical candidate `3a2407a` at
  `0/5`; neither record counts for the current cohesive candidate.
- Schema v2 now requires five complete candidate-bound human journeys, unique attachment
  hashes, accepted actions, save/background restore, mobile back results, bidirectional
  issue links and zero P0/blocking P1 before it can write a selection.
- The approved two-region/four-family content exists locally, but push and tuning
  acceptance remain blocked until five fresh, candidate-bound journeys pass with P0 0
  and blocking P1 0.
- No physical-device observation was performed for this candidate. Apple
  Distribution identity, Android release keystore, matching install profiles, signed
  distribution and Store submission are separate external gates.
- Every prior Toss artifact/deployment is superseded by these source changes. Toss
  upload, Sandbox, review, public release and ad activation remain HOLD and require a
  separately approved candidate.
- Formal Native Goal `goal_7a57d7db-6953-4310-94b1-518c4524e035` was closed through
  the supported dispatch-less reconciliation path as `failed / goal-owner-closeout`.
  The external completed worker was not adopted, `dispatchId` stayed null, and the
  repository lease is now `released`. This historical closeout proves orchestration
  ownership; the cohesive HEAD containing this summary is the immutable candidate.
- Native Goal `goal_1373325f-d8cd-4aee-9293-5fbf732a5248` passed worker and canonical
  verification and synced exactly the seven bounded `drop_rate` paths. Shared package,
  cross-surface evidence and ledger updates are included in this same cohesive candidate.
- Native Goal `goal_3177965d-7b22-4e8a-b634-b6a88d36f1e2` passed worker and canonical
  verification and synced exactly the six bounded `dot_mult` paths.
- Native Goal `goal_00c22e97-136a-473d-9b59-ce352d69b216` passed worker and canonical
  verification and synced exactly the eight bounded `hp_drain_atk` paths. Package,
  base-audit evidence and ledger updates remain Goal-owner changes in this bundle.

The repository-owned consumable/event closure and final web/mobile/native regression
gates are complete. The cohesive HEAD containing this summary excludes build, native
generated output and Toss evidence and is the immutable candidate for five fresh human
journeys. Push, signing and release remain separate approval boundaries.

## Cohesive commit boundary

- Commit `3a2407a` includes the content/pacing test seam, screenshots and synchronized
  release-complete ledgers on top of the three implementation commits.
- Exclude `build/`, native generated outputs, credentials, and the historical untracked
  `docs/evidence/toss/releases/` tree. That Toss tree is superseded audit-only material,
  not evidence for this candidate.
- `observation-summary.json` remains historical evidence for `3a2407a`; do not repoint
  it with automated sessions. A new binding must use the cohesive HEAD that contains
  this summary and five fresh human observations.
