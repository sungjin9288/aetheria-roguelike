# Release-complete core requirement matrix

Status vocabulary is deliberately narrow:

- `implemented`: owning production code and focused tests are green.
- `browser verified`: the production transition was exercised through the rendered browser surface.
- `native packaged`: current web assets were packaged successfully; this is not physical-device proof.
- `physical observed`: a human observed the exact candidate on a physical device.
- `external blocker`: the named evidence cannot be produced inside the repository.

The current branch is `codex/release-complete-core`. The content implementation is
represented by commits `ea28b09`, `f10f66a`, and `ca9e1d0`. The observation candidate
is deliberately unbound until the ledger close-out commit exists, so no previous
human session is counted for these bytes. All prior Toss candidate and deployment
evidence is superseded and remains audit-only. The last repository-owned gate was
executed on 2026-08-11 KST.

| Requirement | Current state | Direct evidence | Remaining gate |
| --- | --- | --- | --- |
| Fresh creation and first action | browser verified | `tests/e2e/release-complete-core.spec.ts`, full smoke | bind the ledger-closeout candidate and run fresh human observation |
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
| Four bounded encounter families | implemented/browser verified | four catalog entries, rendered choice/settlement/replay E2E at 375/390/430 widths | candidate-bound human observation |
| Content reachability | verified | report SHA `a6626375...b4f0e8`; checkpoints `1/5/5/6/13/18/18`, job snapshots `18` | use live funnel before further expansion |
| Exploration rhythm | verified | report SHA `7d903b82...72bfe2`; predecessor p10/p50/p90 `1/2/6`, candidate `2/4/9` | five human sessions before tuning acceptance |
| Repository gate | verified on implementation bytes | focused content/pacing `61/61`; unit `3973/3973`; E2E `52/52 + 50/50`; desktop/mobile smoke; art errors 0; independent Important 0 | five human observations |
| Native package regression | native packaged | Android debug APK and unsigned iOS device app | fresh-QA iOS profile/account, Android device, signing and physical-device observation |
| Apps in Toss resume | `HOLD` | source changes invalidate prior candidate | separate approval after every required row is bound |

## Current artifacts

- Android debug APK: `214646216` bytes, SHA-256
  `5b36d5fbf1153a60eef5dda291b2c5b1f1490c3e50364b5f81ea6f8f8f8e2f3a`.
- Unsigned iOS arm64 executable: `102376` bytes, SHA-256
  `6372d559d57e897c21f87244863be80a792e7db279c8d9e1deef6ec53306292f`.
- Content-pacing screenshots: `375x667 e834a4c0...8f28957`,
  `390x844 00aa403d...0abad0`, `430x932 0a15d8fd...172ddc`.
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
- `region-selection.json` is intentionally absent. The current summary is unbound and
  contains `0/5` observations. The previous `1/5` record belongs to superseded commit
  `f9d463a` and is historical only. Five fresh observations are required before push or
  tuning acceptance; no selector output is written before that gate.
