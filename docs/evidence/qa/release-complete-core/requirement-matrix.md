# Release-complete core requirement matrix

Status vocabulary is deliberately narrow:

- `implemented`: owning production code and focused tests are green.
- `browser verified`: the production transition was exercised through the rendered browser surface.
- `native packaged`: current web assets were packaged successfully; this is not physical-device proof.
- `physical observed`: a human observed the exact candidate on a physical device.
- `external blocker`: the named evidence cannot be produced inside the repository.

The current branch is `codex/release-complete-core`, based on Git commit
`8db86a2354730588c0243d33f7a81f3e76dbb60c`. The working tree is intentionally
uncommitted, so there is no final candidate/source-tree binding yet. All prior Toss
candidate and deployment evidence is superseded for this source and remains audit-only.
The last repository-owned gate was executed on 2026-08-11 KST.

| Requirement | Current state | Direct evidence | Remaining gate |
| --- | --- | --- | --- |
| Fresh creation and first action | browser verified; final candidate pending | `tests/e2e/release-complete-core.spec.ts`, full smoke | fresh human candidate observation |
| First move, explore, combat and safe return | browser verified; final candidate pending | production UI journey E2E, full smoke | fresh human candidate observation |
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
| Bounded encounter region selection | fail-closed tooling implemented | schema-v2 selector/runbook and `tests/encounter-region-selection.test.js` | five final-candidate complete human observations, P0 0/blocking P1 0 |
| Bounded encounter schema, eligibility and receipt settlement | implemented but disabled | `tests/bounded-encounters.test.js`; production flag false and data empty | evidence-selected regions and content authoring |
| Four bounded encounter families | blocked by evidence gate | none; intentionally not guessed | exactly two evidence-selected regions |
| Repository gate | verified | focused `1276/1276`; final-review affected regressions `6/6 + 197/197`; observation/encounter `22/22`; unit `3946/3946`; E2E `51/51 + 48/48`; desktop/mobile perf pass; art errors 0 | final-candidate binding |
| Native package regression | native packaged | Android debug APK and unsigned iOS device app | fresh-QA iOS profile/account, Android device, signing and physical-device observation |
| Apps in Toss resume | `HOLD` | source changes invalidate prior candidate | separate approval after every required row is bound |

## Current artifacts

- Android debug APK: `214642610` bytes, SHA-256
  `4c20b80200f88cafcae560c254c8903766a358bf81dc37f72fb8093c2555d46f`.
- Unsigned iOS arm64 executable: `102376` bytes, SHA-256
  `6372d559d57e897c21f87244863be80a792e7db279c8d9e1deef6ec53306292f`.
- Unsigned iOS `.app` aggregate: `1804` files, `218762955` bytes, SHA-256
  `e337d06c0402f2f5912ed2e80952269ee9fc9b82f6b1b6a13b14259b64f55196`.
- True Ending/New Game+ 390×844 screenshot: SHA-256
  `0aec6b148d9ce09f11ed0ac3f1cebed9feb0eebc1035c755789f79971e6aabeb`.
- Own-grave recovery 390×844 screenshot: SHA-256
  `f7c0aeba9789c044c87e664ddfd6b43bb8932d1c8b60981eec5c91552bbe4084`.
- These artifacts are local package/browser evidence, not signed release or physical-device evidence.
- The paired iPhone is USB-available, but the current fresh-QA archive attempt exited
  `65` before archive creation because Xcode has no configured account or matching
  `com.aetheria.roguelike.freshqa` profile. No Android device is attached.

## Privacy and evidence rules

- Commit only opaque observation IDs and attachment SHA-256 values.
- Never commit nickname, Toss/Firebase user key, device serial, inventory dump or free-form logs.
- Automated or test-harness sessions may validate tooling but never satisfy the five human-observation gate.
- The tracked summary accepts no raw issue prose. It records opaque IDs, bounded enums
  and attachment SHA-256 values only; see `OBSERVATION_RUNBOOK.md`.
- A source or artifact change invalidates prior region counts and physical observations.
- `implemented`, `browser verified`, `native packaged`, `physical observed`, and
  `Toss resume eligible` are independent claims.
- `region-selection.json` is intentionally absent. The selector currently exits `1`
  with `INVALID_OBSERVATION_SUMMARY` and performs no write because the final
  candidate and five fresh human observations do not exist.
