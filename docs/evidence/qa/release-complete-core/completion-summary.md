# Release-complete core completion summary

Date: 2026-08-31 KST

Status: content pacing, eight-family bounded encounters, relic balance, equipment economy,
equipment combat-power sidegrades, consumable authority and event reward transactions
are locally verified. The current encounter-depth slice has no observation-candidate
identity; the next candidate-specific archive/evidence seal follows its explicitly
approved cohesive source checkpoint.
Fresh-human acceptance, push and external release gates remain HOLD.

## Class Journey encounter discovery checkpoint (2026-08-31)

- An accepted bounded-encounter receipt is now projected once at safe return into
  canonical discovery copy. The same ordered array reaches the expedition summary and
  the snapshotted job's Class Journey record; same-choice occurrences dedupe while
  different choices remain distinct. Rejected, malformed, foreign, defeated,
  abandoned and replayed paths add no permanent discovery or sequence.
- The nested Class Journey ledger migrates additively from v1 to v2. Defeat, manual
  reset and ascension preserve the new record, while the top-level save version,
  gameplay EXP, loot, pity, event frequency, enemy HP and progression profiles remain
  unchanged.
- The existing debrief/job surface renders one optional canonical Korean discovery
  line. A real 390x844 Chromium journey used production choice settlement and normal
  movement to return home, reopen the debrief and prove one record with no horizontal
  overflow. Raw encounter IDs and receipt keys are absent from `render_game_to_text`;
  receipt replay assertions use a narrow read-only test API.
- Focused discovery/migration/reset integration passes `131/131`; bounded encounter and
  debrief mobile E2E passes `10/10`; type-check, lint, content, pacing and event-reward
  verifiers pass. Progression evidence SHA-256 is
  `7b61327b17bbcf55d741ab8a17b162551928c2e64985a544bfa1493e5d17d379`;
  report hash `ff04ac3d...68c2`, v1 baseline `d39dce20...a17c`, 64/1,000 seed
  policy, `actualPlayClaim:false`, `activationReady:false` and `hardErrors:[]` remain
  unchanged. Only the six changed/new `src/**` manifest rows advanced.
- Current-byte repository verification is GREEN. `npm run verify` and the final clean
  `npm run verify:full` passed type-check, warning-free lint, unit `4241/4241`, build
  guard, desktop/mobile smoke and E2E `59/59 + 55/55`. Art verification passed
  `18/229/22/25`; `mobile:doctor` and `cap:sync` passed with tracked Android/iOS drift
  0. Independent Sol ultra review passed with Critical/Important/Minor `0/0/0` and
  accepted the two fixture-only path additions as a bounded re-plan with no production
  boundary expansion. The user approved one exact 20-path cohesive local implementation
  commit. Human observation, physical-device acceptance, candidate seal, signing, push
  and publication remain separate and have not been performed.
- The first repository-wide unit run correctly exposed one stale v1 exact-object
  expectation in the production storage/New Game+ regression. A bounded Sol re-plan
  added `tests/endgame-settlement.test.js`; its v1-save to v2-preservation path now
  passes `15/15`. The next full browser gate reached E2E `113/114` and exposed the same
  stale raw-v1 comparison in `tests/e2e/true-ending-new-game-plus.spec.ts`; its three
  viewport paths now pass `3/3`, expanding the implementation boundary to exactly 20
  paths. The final clean repository gate is GREEN; the sorted path-list SHA-256 is
  `741bbc569fa66ba61aabb15dc864616ea806ab5508ac54a6886f71e638d65add`.
- Deterministic progression/content/pacing/event evidence verifies at
  `7b61327b...d379`, `a6626375...b4f0e8`, `0818fb7a...424e` and
  `0680a3f1...8084`. Protected candidate/Toss aggregates remain
  `f14235c7...1b9` and `05cc9de7...bbbd`.

## Build-reactive early-region encounter checkpoint (2026-08-31)

- Expanded the verified `고요한 숲` and `서쪽 평원` pack from six to eight encounters
  without changing exploration occurrence frequency. `뿌리 아래 공명 결계` responds
  to canonical `arcane|fortress` build tags and `바람길의 전투 흔적` responds to
  `crusher|dual`; each also requires a real warrior, mage or rogue lineage.
- Build eligibility is transient and fail-closed. It derives only from
  `calculateFullStats(player).buildProfile.tags[].id`, filters through the four-tag
  allowlist and never falls back to the class profile identity. Build tags are absent
  from save data, event payloads, render-state output and ProductEventSink data.
- Existing deterministic selection, reducer-owned cost/reward settlement and replay
  receipts remain authoritative. EXP, loot, pity, enemy HP, exploration profile,
  save schema, production UI and native source are unchanged.
- TDD RED covered the eight-family pack, invalid build tags, OR-within/AND-across
  eligibility, class-fallback rejection, real equipment/relic derivation, browser
  fixture and evidence drift. Focused integration passed `51/51`; the 390x844
  build-reactive browser flow passed `1/1` with readable choices, atomic settlement,
  no horizontal overflow and no rendered `buildTags`.
- Event-reward evidence now covers bounded `8/16` and total `108` rows with zero
  errors; report SHA-256 is
  `0680a3f17affcd6e9301ab039f5810bb178eae598cd4ad78dcfd7e81547a8084`.
  Progression diagnostic report, report object, v1 baseline and seed-policy hashes are
  unchanged; only the deterministic source envelope advanced.
- `npm run verify` and `npm run verify:full` passed type-check, warning-free lint,
  unit `4222/4222`, build guard, desktop/mobile smoke and E2E `58/58 + 55/55`.
  Content, pacing, art (`18/229/22/25`), event-reward and progression-diagnostic
  verifiers passed. `mobile:doctor` and `cap:sync` passed with tracked Android/iOS
  drift 0. Protected candidate/Toss aggregates remain
  `f14235c7...50691`/`05cc9de7...bbbd`.
- This checkpoint is uncommitted. Human observation, physical-device acceptance,
  candidate seal, distribution signing, push and publication remain separate gates.

## Combat Loot Capacity Settlement checkpoint (2026-08-24)

- `processLoot()` remains the only random-drop authority. Item-level candidate/log provenance is additive, and RNG consumption, item IDs/order and legacy `items`/`logs` aggregates remain unchanged. Stable signature-first admission uses a positive safe-integer `maxInv`, falls back to `BALANCE.INV_MAX_SIZE` for malformed legacy values, preserves existing over-cap inventory and admits no new combat loot when space is exhausted.
- One admitted-item truth now feeds inventory, Codex and Codex XP, pity, acquisition logs, combat digest, upgrade hint and trait hint. Blocked candidates emit only `가방이 가득해 전리품 {count}개를 챙기지 못했습니다.`; blocked names and success/prefix logs never reach downstream consumers. An admitted signature resets pity, a blocked boss signature is a boss miss (`+1`), normal-monster pity is unchanged, and direct attack/skill/attack-DOT/item-DOT victory paths converge through the existing settlement owner. Replay and stale actions remain exact no-ops.
- The initial Task 3 RED was `8 pass / 3 fail`, with inventory overflow `4 != 3` and boss/full-normal inventory `3 != 2`. Task 1 focused/compatibility were `34/34` and `83/83`; Task 2 was `7/7` with intermediate full unit `4185/4185`; Task 3 final was `13/13` with six-file compatibility `79/79`; Task 4 characterization/convergence were `34/34` and `49/49`, and Task 3 compatibility remained `83/83` after Task 4. Typecheck, lint and diff-check passed. Sol reviews of Tasks 1–4 are approved with final open Critical/Important/Minor `0/0/0`.
- Current Goal implementation paths are `src/systems/CombatEngine.loot.ts`, `src/systems/combatLootCapacity.ts`, `src/hooks/combatActions/combatVictory.ts`, `src/data/messages.ts`, `tests/combat-engine-loot.test.js`, `tests/combat-loot-capacity-authority.test.js`, and `tests/loot-cycle.test.js`; evidence paths are `docs/evidence/qa/release-complete-core/relic-drop-rate.json` and `docs/evidence/qa/release-complete-core/relic-event-chance.json`; Task 5 synchronized exactly `docs/evidence/qa/release-complete-core/requirement-matrix.md`, `docs/evidence/qa/release-complete-core/completion-summary.md`, `tasks/todo.md` and `progress.md`. `docs/evidence/qa/release-complete-core/candidates/` and `docs/evidence/toss/releases/` remain preserved and excluded. Relic-drop `reportHash` `2ddf...9e60` and relic-event `reportHash` `424909de...4597` are unchanged; only declared source provenance advanced.
- Task 6 is complete on the current unstaged bytes. The stale `loot-cycle` guards recorded RED `24/26` and GREEN `26/26`; final focused production is `97/97`. `npm run verify` and `npm run verify:full` both passed unit `4195/4195`, build guard, desktop/mobile smoke and E2E `57/57 + 54/54`. Relic-drop/event hashes remain `2ddf...9e60`/`424909de...4597`, event reward remains `104` rows at `b3d69916...41ec`, and the ephemeral 1000-seed loot-axis audit is `report-only`/`activationReady:false` with hash `ab96cc4a...a9ad`, `18000/18000` job snapshots and zero truncation. Art verification passed `18/229/22/25` at catalog `c15c4e6...3ad0`; `mobile:doctor` and `cap:sync` passed with tracked Android/iOS drift 0. `playtest-artifacts/mobile/05-combat-2.png` was directly inspected and no tracked screenshot was refreshed. Protected candidate/Toss aggregates remain `f14235c7...1b9`/`05cc9de7...bbbd`. Historical counts elsewhere remain historical. `candidate seal: not assigned`; `human observation: not refreshed`; `push/signing/publication: not performed`; distribution/release signing inputs remain unavailable; `Progression Simulator v2: blocked until this prerequisite is committed and post-commit verified`.
- The final complete focused gate is `123/123`; `97/97` is the production/replay subset before adding the corrected static-guard file to the same command.

## Bounded encounter context-depth checkpoint (2026-08-24)

- Preserved the existing four families and general narrative occurrence authority while
  adding `각인의 메아리` for real Codex signature discovery and `메마른 수로의 잔향`
  for the Class Journey record of `고대 호수의 수호신`. Each selected region now owns
  exactly three families and production uses all four approved context axes: lineage,
  effective HP, discovered signature and previous boss.
- Existing deterministic selection and reducer-owned receipt settlement remain the only
  authority. Replay, stale/forged/tampered payloads, insufficient resources, lethal HP
  costs and full inventory fail without mutation. No save schema or dependency changed.
- TDD RED was `17 tests / 5 expected failures`; focused GREEN is `61/61`. Event-reward
  evidence is bounded `6/12`, total `104 rows`, errors `0`, report SHA-256
  `b3d69916e81a99416ecfb9e953a36b8fd4829f76d256ee278a406f13d9af41ec`, file SHA-256
  `657d799974d9582da3870c766659a593a74efe12360426fe1efca505ce0b651b`.
- Ordinary Chromium mobile passed `5/5`; explicit evidence refresh passed only the two
  new tests `2/2`. Original-resolution visual inspection passed for signature
  `4665b12f...b4e` and previous-boss `f74fb2a3...0117` captures at 390×844.
- The same 1,000-seed progression comparison retained report SHA-256
  `059eaeac9cc97c388caf83e83a13f9438bb5b03ee6f7afc264796bbf58c424ff`,
  proving event occurrence, EXP and loot profile invariants.
- `npm run verify:full` passed unit `4174/4174`, build guard, desktop/mobile smoke and
  E2E `57/57 + 54/54`. Content, pacing, art and event verifiers passed. `mobile:doctor`,
  `cap:sync`, Android debug and unsigned iOS device build passed with zero tracked native
  drift. APK is `214644299` bytes/SHA `672518c6...f283`; the iOS executable is
  `102376` bytes/SHA `6372d559...6292f`.
- Historical `release-core-1eb890a1dda4` remains `0/5` with summary SHA
  `9239c156...a71`; Toss evidence aggregate remains `05cc9de7...bbbd`. This section
  belongs to the approved cohesive source checkpoint; no push, signing or publication
  action was performed.

## E2E release-evidence output isolation checkpoint (2026-08-24)

This current checkpoint slice covers the four release-evidence Playwright specs and
their shared typed helper. Ordinary, focused and
full runs write through `testInfo.outputPath(filename)`, while only the exact
`AETHERIA_REFRESH_RELEASE_EVIDENCE=1` opt-in uses the tracked release-evidence
directory. Existing filenames and `fullPage` settings are unchanged. The
explicit `qa:evidence:refresh` script is present but was not executed. The implementation
checkpoint is committed in `0fde5f52e8b13b011857dec38449a906fe672bf4`, and its post-commit
proof is complete. This docs-only reconciliation assigns no candidate identity; the root
historical summary is not repointed.

- TDD RED: `node --import tsx --test tests/e2e-evidence-output.test.js` failed
  with the expected missing-helper `ERR_MODULE_NOT_FOUND` before the helper was
  created.
- TDD GREEN: the same contract test passes `4/4`, covering default routing,
  exact opt-in routing, non-exact environment values, and unsafe filename
  rejection.
- Focused ordinary Playwright: the four requested specs on
  `chromium-mobile --workers=1` pass `6/6` and produce six PNGs under
  `test-results/` (three content-pacing viewports plus equipment economy,
  relic event chance and relic gold multiplier).
- The six tracked release PNGs remain byte-identical: content-pacing
  `375x667 e525be7a94f646a37c1fcd54c32b024fc2e2ac11848c5f1b1cf50f199031b2f9`,
  `390x844 e8b268274c35be041b33e9b0bf967aa7ff57bbbd7787097cc6f48c4c4db0cbc7`,
  `430x932 eac835d263e832c9c6be7dce9a78168bb06f95d1d5559c09f9c87e9f23663943`;
  equipment-economy
  `3b73b798b246224c2e6cee07d3b07c425750a775d8e86e2bc9e3ee7ad0c0279c`;
  relic-event-chance
  `a9073a1eb9fdc9652f18e812bf1f119c46dfe308384918c165f32f6273592e31`;
  relic-gold-multiplier
  `5fa54793454a5e5333bf64ee82fd90b3ea7841b0252d113f479d17e9cca39b0e`.
- `npm run verify:full` passes type-check, lint, unit `4168/4168`, build guard,
  desktop/mobile smoke, E2E shard 1 `55/55` and shard 2 `54/54`, with final
  marker `VERIFY_FULL_TRACKED_SCREENSHOTS_UNCHANGED`.
- `npm run art:verify` passes for 18 character, 229 equipment, 22 families and
  25 signature overlays; catalog SHA-256 is
  `c15c4e6fc7ad99e37c616cc4303821fe3ce58238d2f5d98d667c5b0cb83c3ad0`.
- `npm run mobile:doctor` passes toolchain diagnostics. Local iOS distribution
  signing and Android release signing remain environmental release blockers.
- `npm run cap:sync` passes with tracked `android/ios` source bytes identical
  before and after. `npm run android:debug` passes with
  `android/app/build/outputs/apk/debug/app-debug.apk` at `214644300` bytes,
  SHA-256 `de3ac741d33a7cd3e5ca29002cf54e9240d48b471caa2aeae65cfe16db897436`.
- `npm run ios:build:device` passes with `CODE_SIGNING_ALLOWED=NO`; executable
  `/tmp/aetheria-ios-device-build/Build/Products/Release-iphoneos/App.app/App`
  is `102376` bytes, SHA-256
  `6372d559d57e897c21f87244863be80a792e7db279c8d9e1deef6ec53306292f`.
- `git diff --check` passes. User-owned untracked Toss evidence remains intact
  with aggregate SHA-256
  `05cc9de783f13df18b8ca50f46a4b32af54e914a635e99cf9e53b354c6a0bbbd`.

This section originated as a pre-commit evidence capture. The implementation checkpoint
is committed in `0fde5f52e8b13b011857dec38449a906fe672bf4`, and its post-commit proof is
complete. This docs-only reconciliation assigns no candidate identity. The next evidence
binding uses `docs/evidence/qa/release-complete-core/candidates/${candidate_id}/` for the
reconciled current HEAD and keeps the root historical summary unchanged. Push, signing,
publish and evidence refresh remain unperformed.

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
6. The approved early-region slice is active in `고요한 숲` and `서쪽 평원`: six
   bounded encounters use lineage, effective HP, signature and previous-boss context,
   then settle costs and rewards through an atomic receipt transaction.
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
    and capacity-aware, and the current 104-row reward audit has zero errors.

## Verification on current checkpoint bytes

- Equipment combat/economy/progression focused integration: `44/44` — pass.
- `npm run equipment:combat-power:verify`: evidence SHA-256
  `786c48988ce7d56060bc21bb1de1ac483a597c79150cd363adeaa0e6320ed6bb`;
  defect/pair/replan `0/0/0`, `requiresReplan=false` — pass.
- `npm run equipment:economy:verify`: evidence SHA-256
  `80a209eed4b024cc76d6b382ed5b5355b62e4480e6a19bdd4c7d3fae5cbdc61c`;
  report digest `33558b95856f4a357940d165256b4587d2a66a9176ff2fa4b68f4649276a9f93` — pass.
- Latest `npm run verify:full`: type-check, warning-free lint, unit `4174/4174`,
  build guard, desktop/mobile smoke and E2E `57/57 + 54/54` — pass.
- Current `npm run mobile:doctor` and `npm run cap:sync`: pass; tracked Android/iOS
  drift is zero. Distribution signing inputs remain external blockers.
- Focused combat/consumable/fallback browser journeys at 390x844: `7/7` — pass.
- Focused event reward and settlement suite: `80/80` — pass.
- `npm run event-reward:verify`: 104 rows, 0 errors, report SHA-256
  `b3d69916e81a99416ecfb9e953a36b8fd4829f76d256ee278a406f13d9af41ec`;
  evidence SHA-256 `657d799974d9582da3870c766659a593a74efe12360426fe1efca505ce0b651b` — pass.

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

- Android debug APK: `214644299` bytes, SHA-256
  `672518c64d2fcc303c8629052068133b59e57c412d9b2ac0550a883de2c0f283`.
- Unsigned iOS executable: `102376` bytes, SHA-256
  `6372d559d57e897c21f87244863be80a792e7db279c8d9e1deef6ec53306292f`.
- Current bounded-encounter browser captures:
  `375x667 e525be7a...31b2f9`, `390x844 e8b26827...b0cbc7`,
  `430x932 eac835d2...663943`. These bind the final local E2E run, not a claim of
  byte-stable browser rasterization.
- New context-depth 390×844 captures: signature `4665b12f...b4e`, previous boss
  `f74fb2a3...0117`.
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
  The root `observation-summary.json` remains bound to later historical candidate
  `3a2407a` at `0/5`; neither record counts for the next candidate. Candidate-specific
  evidence is absent until the reconciled-HEAD candidate-specific seal.
- Schema v2 now requires five complete candidate-bound human journeys, unique attachment
  hashes, accepted actions, save/background restore, mobile back results, bidirectional
  issue links and zero P0/blocking P1 before it can write a selection.
- The approved two-region/six-family content exists locally, but push and tuning
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
  ownership; it does not assign the next candidate identity.
- Native Goal `goal_1373325f-d8cd-4aee-9293-5fbf732a5248` passed worker and canonical
  verification and synced exactly the seven bounded `drop_rate` paths. Shared package,
  cross-surface evidence and ledger updates are included in this same cohesive candidate.
- Native Goal `goal_3177965d-7b22-4e8a-b634-b6a88d36f1e2` passed worker and canonical
  verification and synced exactly the six bounded `dot_mult` paths.
- Native Goal `goal_00c22e97-136a-473d-9b59-ce352d69b216` passed worker and canonical
  verification and synced exactly the eight bounded `hp_drain_atk` paths. Package,
  base-audit evidence and ledger updates remain Goal-owner changes in this bundle.

The repository-owned consumable/event closure and final web/mobile/native regression
gates are complete for predecessor checkpoint `0fde5f52e8b13b011857dec38449a906fe672bf4`,
and its post-commit full/native proof is complete. This docs-only reconciliation assigns
no candidate identity. The next gate is the candidate-specific archive and evidence seal
of the reconciled current HEAD, then five fresh human journeys. Push, signing and release
remain separate approval boundaries.

## Cohesive commit boundary

- Commit `3a2407a` includes the content/pacing test seam, screenshots and synchronized
  release-complete ledgers on top of the three implementation commits.
- Exclude `build/`, native generated outputs, credentials, and the historical untracked
  `docs/evidence/toss/releases/` tree. That Toss tree is superseded audit-only material,
  not evidence for this candidate.
- The root `observation-summary.json` remains historical evidence for `3a2407a`; do not
  repoint it with automated sessions. A new binding must use
  `candidates/${candidate_id}/observation-summary.json` and
  `candidates/${candidate_id}/region-selection.json` after the source candidate
  commit and archive seal. An empty `0/5` summary remains Goal-owned untracked audit
  evidence and is not committed.
