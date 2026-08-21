# Release-complete core requirement matrix

Status vocabulary is deliberately narrow:

- `implemented`: owning production code and focused tests are green.
- `browser verified`: the production transition was exercised through the rendered browser surface.
- `native packaged`: current web assets were packaged successfully; this is not physical-device proof.
- `physical observed`: a human observed the exact candidate on a physical device.
- `external blocker`: the named evidence cannot be produced inside the repository.

The current branch is `codex/release-complete-core`. Historical observation candidate
`release-core-3a2407a0c961` remains bound to commit `3a2407a`, but the cohesive HEAD
containing this matrix supersedes it as the current immutable candidate. No previous
human session is counted for this candidate. All prior Toss
candidate and deployment evidence is superseded and remains audit-only. The latest
repository-owned gate below was executed on 2026-08-20 KST.

| Requirement | Current state | Direct evidence | Remaining gate |
| --- | --- | --- | --- |
| Fresh creation and first action | browser verified; immutable candidate ready | `tests/e2e/release-complete-core.spec.ts`, full smoke | fresh human candidate observation |
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
| Relic rarity and effect coherence | implemented/browser verified | Base audit `c5c425d0...719a8`; free-skill `ddf2e9a1...dffd`; event-chance `424909de...4597`; gold `16a7bcc7...efa9`; drop `2ddf68f9...9e60`; dot `b123dee8...a204`; HP-drain `7560ce01...05793`; focused drop `42/42`, dot `10/10`, HP-drain `14/14`; 390×844 gold reducer/UI proof | human candidate observation |
| Equipment identity, economy and combat sidegrades | implemented/browser verified | 229/229 identities; 20 price-only corrections; four bounded sidegrades; combat evidence `cdfab6b2...fcdc` with defect/pair/replan `0/0/0`; economy evidence `80a209ee...c61c`; focused `44/44`; 390×844 shop transaction E2E | human candidate observation |
| Consumable and event reward authority | implemented/browser verified | current-state consumable transaction; structured fallback 3; chain/relic/item reward authority; 100-row report `f253158f...86f6`; focused event `80/80`; 390×844 combined browser `7/7` | human candidate observation |
| Repository gate | verified on current cohesive candidate bytes | type/lint/unit `4156/4156`/build guard; desktop/mobile smoke; E2E `55/55 + 54/54`; combat/economy/relic/content/pacing/art/event verifiers GREEN; `cap:sync`, Android debug and unsigned iOS build GREEN; tracked native drift 0 | five fresh human observations |
| Native package regression | native packaged | Android debug APK and unsigned iOS device app | fresh-QA iOS profile/account, Android device, signing and physical-device observation |
| Apps in Toss resume | `HOLD` | source changes invalidate prior candidate | separate approval after every required row is bound |

## Current artifacts

- Android debug APK: `214644297` bytes, SHA-256
  `de5e6cf760d3f6f7ceae835acf3a788a2531f8250b5ffc80fecc200d64fa59f4`.
- Unsigned iOS arm64 executable: `102376` bytes, SHA-256
  `6372d559d57e897c21f87244863be80a792e7db279c8d9e1deef6ec53306292f`.
- Content-pacing screenshots: `375x667 ef35a0f3...8a1de9`,
  `390x844 f4dd4663...7e8dc6`, `430x932 e765e669...3a41f`.
- Relic event-chance 390×844 screenshot: SHA-256
  `1de1ac8a00abf8b4cd1be5efcf7318787663f1c39c8584f19dbd3dfd4bb7f6d0`.
- Relic gold-multiplier 390×844 screenshot: SHA-256
  `335061d7391fbd6935df914bf102f71cc4ee4ab55143240721f528548055af7e`.
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
- `region-selection.json` is intentionally absent. The summary bound to `3a2407a`
  contains `0/5` observations and is historical after the relic changes. The earlier
  `1/5` record for `f9d463a` is also historical. A new immutable candidate must be
  created before five fresh observations can begin; no selector output is written
  before that gate.
