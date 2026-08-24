# Release-complete core requirement matrix

Status vocabulary is deliberately narrow:

- `implemented`: owning production code and focused tests are green.
- `browser verified`: the production transition was exercised through the rendered browser surface.
- `native packaged`: current web assets were packaged successfully; this is not physical-device proof.
- `physical observed`: a human observed the exact candidate on a physical device.
- `external blocker`: the named evidence cannot be produced inside the repository.

The current branch is `codex/release-complete-core`. Historical observation candidates
`release-core-3a2407a0c961` and `release-core-1eb890a1dda4` remain bound to their exact
source checkpoints; the latter stays `0/5` with summary SHA `9239c156...a71`. The
current six-family encounter-depth slice is verified on its cohesive source checkpoint,
but has no observation-candidate identity before the separate archive/evidence seal. No
previous human session is counted for the next candidate. All prior Toss
candidate and deployment evidence is superseded and remains audit-only. The latest
repository-owned gate below was executed on 2026-08-24 KST.

The next gate is ordered: candidate-specific archive and evidence seal of the reconciled
current HEAD, then five fresh human observations. Candidate-specific
`observation-summary.json` and `region-selection.json` do not yet exist; the root
`region-selection.json` remains absent by policy.

| Requirement | Current state | Direct evidence | Remaining gate |
| --- | --- | --- | --- |
| Fresh creation and first action | browser verified; candidate seal pending | `tests/e2e/release-complete-core.spec.ts`, full smoke | reconciled-HEAD candidate-specific seal, then fresh human observation |
| First move, explore, combat and safe return | browser verified | production UI journey E2E, full smoke | fresh human candidate observation |
| Equipment decision and level-5 job change | browser verified | `tests/e2e/release-complete-core.spec.ts` | fresh human candidate observation |
| Skill branch and Class Journey | browser verified | production UI journey E2E and class-journey contracts | fresh human candidate observation |
| Death preserves permanent progress | implemented | `tests/permanent-progress.test.js`, `tests/permanent-progress-copy.test.js` | physical-device observation |
| Manual reset preserves permanent progress | implemented/browser verified | permanent-state tests and reset UI contracts | physical-device observation |
| Ascension preserves permanent progress | browser verified | permanent-state tests, release-complete E2E | physical-device observation |
| Save migration and reload preserve permanent state | implemented/browser verified | migration/storage suites, endgame reload E2E | physical iOS/Android observation |
| Demon King shard settlement is atomic and idempotent | implemented/browser verified | `tests/endgame-settlement.test.js`, exact-name regression, endgame E2E | physical-device observation |
| Third shard immediately unlocks the true boss | browser verified | endgame settlement and real combat E2E | physical-device observation |
| True boss and True Ending | browser verified/native packaged | three-viewport endgame E2E, current Android/iOS debug packages | physical-device observation |
| New Game+ is one-shot and reload-safe | browser verified/native packaged | endgame E2E including double-click and reload | physical-device observation |
| Own grave recovery | browser verified | capability/own-grave tests and grave E2E | physical-device observation |
| Public grave invasion is absent | browser verified | `tests/game-capabilities.test.js`, grave E2E | server-authoritative design before any re-enable |
| Background, foreground and forced reload | implemented/browser verified | lifecycle/storage tests and endgame reload E2E | physical iOS/Android observation |
| Nearest reversible surface consumes back | implemented/browser verified | back registry tests and endgame platform-back E2E | Toss Sandbox remains HOLD |
| 375×667 geometry | browser verified | reduced-motion True Ending E2E | physical-device observation |
| 390×844 geometry | browser verified | journey/True Ending/grave E2E; tracked screenshots below | physical-device observation |
| 430×932 geometry | browser verified | skip/CTA True Ending E2E | physical-device observation |
| Bounded encounter region selection | implemented for the approved early slice | `고요한 숲`, `서쪽 평원`; schema-v2 selector/runbook and `tests/encounter-region-selection.test.js` | five final-candidate complete human observations before tuning acceptance |
| Bounded encounter schema, eligibility and receipt settlement | implemented/browser verified | canonical catalog binding, eligibility, effective-HP settlement, receipt replay tests | candidate-bound human observation |
| Six bounded encounter families | implemented/browser verified | existing four plus independent Codex-signature and previous-boss families; rendered choice/settlement/replay E2E at 375/390/430 widths and two new 390×844 captures | candidate-bound human observation |
| Combat Loot Capacity Settlement | implemented and full-gate verified | Task 1–4 focused receipts below; stale static guard RED `24/26` then GREEN `26/26`; final complete focused gate `123/123`; `verify` and `verify:full` unit `4195/4195`, desktop/mobile smoke, E2E `57/57 + 54/54`; art `18/229/22/25`; `mobile:doctor`, `cap:sync`, tracked native drift 0; report-only 1000-seed loot comparison `ab96cc4a...a9ad` | separate cohesive commit approval and post-commit verification before candidate-specific archive/evidence seal |
| Progression Simulator v2 capacity prerequisite | blocked | production `admitCombatLoot()` is the sole admitted/blocked settlement authority; simulator-side `capacityBlockedDrops` remains disabled | commit and post-commit verification of this prerequisite |
| Content reachability | verified | report SHA `a6626375...b4f0e8`; checkpoints `1/5/5/6/13/18/18`, job snapshots `18` | use live funnel before further expansion |
| Exploration rhythm | verified | report SHA `7d903b82...72bfe2`; predecessor p10/p50/p90 `1/2/6`, candidate `2/4/9` | five human sessions before tuning acceptance |
| Relic rarity and effect coherence | implemented/browser verified | Base audit `c5c425d0...719a8`; free-skill `ddf2e9a1...dffd`; event-chance `424909de...4597`; gold `16a7bcc7...efa9`; drop `2ddf68f9...9e60`; dot `b123dee8...a204`; HP-drain `7560ce01...05793`; focused drop `42/42`, dot `10/10`, HP-drain `14/14`; 390×844 gold reducer/UI proof | human candidate observation |
| Equipment identity, economy and combat sidegrades | implemented/browser verified | 229/229 identities; 20 price-only corrections; four bounded sidegrades; current v3 combat evidence `786c4898...e6bb` with defect/pair/replan `0/0/0`; economy evidence `80a209ee...c61c`; focused `44/44`; 390×844 shop transaction E2E | human candidate observation |
| Consumable and event reward authority | implemented/browser verified | current-state consumable transaction; structured fallback 3; chain/relic/item reward authority; bounded `6/12`, total 104-row report `b3d69916...41ec`, evidence `657d7999...51b`; focused encounter/event `61/61` | human candidate observation |
| Repository gate | verified on current cohesive source bytes (2026-08-24) | `npm run verify:full`: type-check/lint/unit `4174/4174`/build guard, desktop/mobile smoke, E2E `57/57 + 54/54`; content `a6626375...b4f0e8`, pacing `7d903b82...72bfe2`, art `18/229/22/25`, event `b3d69916...41ec`; `mobile:doctor`, `cap:sync`, Android debug and unsigned iOS device build pass; tracked native bytes unchanged | post-commit focused verification, then candidate-specific archive/evidence seal and five fresh human observations |
| Native package regression | native packaged | Android debug APK and unsigned iOS device app | fresh-QA iOS profile/account, Android device, signing and physical-device observation |
| Apps in Toss resume | `HOLD` | source changes invalidate prior candidate | separate approval after every required row is bound |

## Combat Loot Capacity Settlement checkpoint (2026-08-24)

- `processLoot()` remains the only roll authority: candidate-level item/log provenance is additive, while RNG consumption, item IDs/order and legacy `items`/`logs` aggregates remain unchanged. Stable signature-first admission uses a positive safe-integer `maxInv`, falls back to `BALANCE.INV_MAX_SIZE` for malformed legacy values, preserves existing over-cap inventory, and admits no new combat loot when no space remains.
- Only admitted candidates reach inventory, Codex and Codex XP, pity, acquisition logs, digest, upgrade hint and trait hint. Blocked candidates produce only `가방이 가득해 전리품 {count}개를 챙기지 못했습니다.`; blocked names and success/prefix logs do not leak. Admitted signatures reset pity, blocked boss signatures count as a boss miss (`+1`), and normal-monster pity is unchanged. Direct attack, skill, attack-DOT and item-DOT victory converge through the existing settlement owner; replay and stale actions remain exact no-ops.
- Initial Task 3 RED was `8 pass / 3 fail`, reproducing inventory overflow `4 != 3` and boss/full-normal inventory `3 != 2`. Task 1 focused/compatibility were `34/34` and `83/83`; Task 2 was `7/7` with intermediate full unit `4185/4185`; Task 3 final was `13/13` with six-file compatibility `79/79`; Task 4 characterization/convergence were `34/34` and `49/49`, with Task 3 compatibility still `83/83` after Task 4. Sol reviews for Tasks 1–4 are approved with final open Critical/Important/Minor `0/0/0`.
- Current Goal implementation paths are `src/systems/CombatEngine.loot.ts`, `src/systems/combatLootCapacity.ts`, `src/hooks/combatActions/combatVictory.ts`, `src/data/messages.ts`, `tests/combat-engine-loot.test.js`, `tests/combat-loot-capacity-authority.test.js`, and `tests/loot-cycle.test.js`; evidence paths are `docs/evidence/qa/release-complete-core/relic-drop-rate.json` and `docs/evidence/qa/release-complete-core/relic-event-chance.json`; Task 5 synchronized exactly `docs/evidence/qa/release-complete-core/requirement-matrix.md`, `docs/evidence/qa/release-complete-core/completion-summary.md`, `tasks/todo.md` and `progress.md`. The historical `docs/evidence/qa/release-complete-core/candidates/` and `docs/evidence/toss/releases/` directories are preserved and excluded; screenshots, candidate/Toss JSON and other historical evidence were not refreshed. Relic-drop `reportHash` `2ddf...9e60` and relic-event `reportHash` `424909de...4597` are unchanged; only declared source provenance advanced.
- Task 6 is complete on the current unstaged bytes: focused production `97/97`; stale `loot-cycle` static guards RED `24/26` then GREEN `26/26`; `npm run verify` and `npm run verify:full` both passed unit `4195/4195`, build guard, desktop/mobile smoke and E2E `57/57 + 54/54`. Relic-drop/event hashes remain `2ddf...9e60`/`424909de...4597`; event reward is `104` rows with hash `b3d69916...41ec`. The ephemeral 1000-seed loot-axis audit report is `ab96cc4a...a9ad`, `report-only`, `activationReady:false`, with `18000/18000` job snapshots, zero truncation and only the declared production-funnel/full-combat-model blockers. Art verification passed `18/229/22/25` with catalog `c15c4e6...3ad0`; `mobile:doctor` and `cap:sync` passed with tracked Android/iOS drift 0. The latest inspected real surface is `playtest-artifacts/mobile/05-combat-2.png`; no tracked screenshot was refreshed. Protected candidate/Toss aggregates remain `f14235c7...1b9` and `05cc9de7...bbbd`. `candidate seal: not assigned`; `human observation: not refreshed`; `push/signing/publication: not performed`; iOS distribution and Android release signing inputs remain unavailable. `Progression Simulator v2: blocked until this prerequisite is committed and post-commit verified`.
- The final complete focused gate, including the corrected `loot-cycle` guards, is `123/123`; the earlier `97/97` count is the production/replay subset.

## Current artifacts

- Android debug APK: `214644299` bytes, SHA-256
  `672518c64d2fcc303c8629052068133b59e57c412d9b2ac0550a883de2c0f283`.
- Unsigned iOS arm64 executable: `102376` bytes, SHA-256
  `6372d559d57e897c21f87244863be80a792e7db279c8d9e1deef6ec53306292f`.
- Content-pacing screenshots: `375x667 e525be7a...31b2f9`,
  `390x844 e8b26827...b0cbc7`, `430x932 eac835d2...663943`.
- Encounter-depth 390×844 screenshots: signature `4665b12f...b4e`, previous boss
  `f74fb2a3...0117`.
- Equipment-economy 390×844 screenshot: SHA-256
  `3b73b798b246224c2e6cee07d3b07c425750a775d8e86e2bc9e3ee7ad0c0279c`.
- Relic event-chance 390×844 screenshot: SHA-256
  `a9073a1eb9fdc9652f18e812bf1f119c46dfe308384918c165f32f6273592e31`.
- Relic gold-multiplier 390×844 screenshot: SHA-256
  `5fa54793454a5e5333bf64ee82fd90b3ea7841b0252d113f479d17e9cca39b0e`.
- Art catalog: 18 character, 229 equipment, 22 family and 25 signature-overlay
  surfaces; catalog SHA-256
  `c15c4e6fc7ad99e37c616cc4303821fe3ce58238d2f5d98d667c5b0cb83c3ad0`.
- Relic dot-multiplier evidence JSON: SHA-256
  `5664a5ec0a9d11adae9f720b14bdf4ff4942a63363e85f4cca4eea6ba2e55e67`.
- Relic HP-drain evidence JSON: SHA-256
  `5b28e1eb312ec039265679d843109bcabd4b53977188809d0477dd0d026044df`.
- True Ending/New Game+ 390×844 screenshot: SHA-256
  `0aec6b148d9ce09f11ed0ac3f1cebed9feb0eebc1035c755789f79971e6aabeb`.
- Own-grave recovery 390×844 screenshot: SHA-256
  `f7c0aeba9789c044c87e664ddfd6b43bb8932d1c8b60981eec5c91552bbe4084`.
- These artifacts are local package/browser evidence, not signed release or physical-device evidence.
- No physical-device observation was performed for the current candidate.
  Apple Distribution identity, Android release signing and matching install/profile
  inputs remain external gates.

## Privacy and evidence rules

- Commit only opaque observation IDs and attachment SHA-256 values.
- Never commit nickname, Toss/Firebase user key, device serial, inventory dump or free-form logs.
- Automated or test-harness sessions may validate tooling but never satisfy the five human-observation gate.
- The tracked summary accepts no raw issue prose. It records opaque IDs, bounded enums
  and attachment SHA-256 values only; see `OBSERVATION_RUNBOOK.md`.
- A source or artifact change invalidates prior region counts and physical observations.
- `implemented`, `browser verified`, `native packaged`, `physical observed`, and
  `Toss resume eligible` are independent claims.
- The root `region-selection.json` is intentionally absent. The root summary bound to
  `3a2407a` contains `0/5` observations and is historical after the relic changes;
  the earlier `1/5` record for `f9d463a` is also historical. A new candidate must use
  `candidates/${candidate_id}/observation-summary.json` and
  `candidates/${candidate_id}/region-selection.json`. The candidate-specific region
  selection is currently absent, and no selector output is written before five fresh
  observations pass. An empty `0/5` candidate summary remains untracked Goal-owned
  audit evidence and is never committed.
