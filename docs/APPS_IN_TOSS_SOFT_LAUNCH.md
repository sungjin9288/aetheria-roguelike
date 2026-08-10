# Aetheria Apps in Toss Soft Launch

## Release boundary

This repository may build and test an Apps in Toss artifact locally, but it must not reserve an
`appName`, upload an artifact, request review, enable ads, or release without a separate explicit
approval. Business verification, settlement, GRAC rating evidence, ad group IDs, production Sentry
DSN, and store credentials remain external inputs and must never be committed.

## SDK decision (2026-08-10)

The original plan named SDK 2.x. A direct compatibility rehearsal with the latest 2.x package
(`@apps-in-toss/web-framework@2.10.8`) built successfully, including `webViewProps.type: 'game'`, but
its production dependency audit reported 42 known vulnerabilities, including critical and high
severity findings. Because advisory data is time-sensitive, the exact severity distribution is not
pinned as a release claim. The same
repository with SDK `3.0.3` has zero production audit findings after in-range transitive patches.

For that reason the local foundation uses SDK `3.0.3`, `apps-in-toss.config.ts`, and
`webBundleDir: 'dist-toss'`. This is not a release decision. Before the first 3.x upload, all of the
following must be explicitly approved and evidenced:

- confirm that publishing 3.x is acceptable even though a released 3.x app cannot roll back to 2.x;
- allow the current Apps in Toss `*.tossmini.com` origins in every production CORS authority used by
  Firebase, Cloudflare, or a future save API;
- confirm game classification and navigation-bar behavior in the current console and on both iOS
  and Android Sandbox, because the removed 2.x `webViewProps.type: 'game'` field has no 3.x config
  equivalent;
- confirm that `aetheria` is available before reserving it; do not register an alternative name
  without another decision.

## Local build contract

```bash
npm run build:toss:web
npm run toss:verify
npm run toss:build
```

- `build:toss:web` stages only the repository allowlist into `.toss/public`, builds `dist-toss`, and
  verifies the final uncompressed tree.
- The working budget is 80 MiB, leaving margin under the platform 100 MB limit.
- `index.html` is mandatory; service workers and static files outside the allowlist fail the build.
- `.toss/`, `dist-toss/`, and `*.ait` are local artifacts and are ignored by Git.
- A local `.ait` build is evidence of packaging only. It is not Sandbox, QR, console, or release
  evidence.

The current local production candidate contains 572 files and 74,055,642 uncompressed bytes. Its
local `.ait` is 72,812,252 bytes with SHA-256
`344d8bd952812e455c8607f625d778bca47dc4d23ef533926863040730b6e260`. The verifier reports zero
missing, forbidden, unexpected, source-map, service-worker, or test-harness-marker entries. No part
of this local packaging evidence implies an upload or deployment.

## Local save contract

Toss and Sandbox use the SDK `Storage` bridge with a browser mirror. Web and Capacitor keep browser
storage and the existing Firebase recovery path. The save envelope is additive and records a schema
version, monotonic revision, save time, serialized payload, and SHA-256 checksum.

- A write is staged and verified byte-for-byte before the primary receipt is accepted.
- Toss and browser copies use an integral generation journal, including durable removal tombstones,
  so a late SDK write cannot revive an older run after reset.
- A bridge operation receives a 250 ms foreground budget. A slow or unavailable bridge falls back to
  the browser copy; late successful writes repair the exact deferred journal receipt once.
- Cloud bootstrap compares schema version and revision before timestamps. Importing revision 8 seeds
  the local revision epoch, so the next local save is revision 9 rather than revision 1.
- Overlapping cloud callbacks dispatch the payload returned by the local authority import, never the
  lower-revision incoming payload that happened to arrive last.
- A valid Firebase snapshot still boots the game when its local mirror cannot be written. Cloud
  upload remains blocked until local authority advances beyond the accepted remote revision.

This contract does not claim recovery after app deletion or device change until the production
Firebase authority, CORS policy, and Sandbox behavior are evidenced together.

## Lifecycle and local first-five contract

- The platform back registry closes the highest-priority reversible surface before requesting app
  close. Premium/mirror panels, enhancement confirmation, milestone story, expedition debrief,
  return briefing, post-combat, and mobile archive paths are covered by the same LIFO contract.
- Toss `homeEvent`, browser `visibilitychange`, and foreground events are normalized through one
  lifecycle bridge. Repeated background signals represent one logical transition.
- The rehearsal builds into isolated `dist-toss-rehearsal`; it never overwrites production
  `dist-toss`. Production verification rejects device-QA and test-API markers.
- The rehearsal owns a dynamically selected preview port, verifies the running child and current
  index fingerprint, and fails if the child exits or the served bytes differ from the fresh build.
- The browser acceptance surface is exactly 390×844 CSS pixels with simulated safe-area insets
  47/34. It asserts no horizontal overflow, in-bounds modal/CTA geometry, and a minimum 44px action
  target.
- Background persistence is exercised by an actual lifecycle event after a production gameplay
  action, followed by reload and restore. Legacy and current production save keys are seeded as
  sentinels and must remain byte-identical throughout the isolated QA run.

Independent local review reproduced the complete first-five flow through safe return, lifecycle
save/reload restore, 390×844 geometry, port/fingerprint failures, and production marker rejection.
The focused foundation/storage suite passed 58/58. After the Phase B observability slice, the
current full repository gate passes 3,801/3,801 unit tests with type-check, warning-free lint, and
build guard green.

## Phase A exit gate

The repository-owned Phase A candidate is locally ready. Phase A remains externally open until the
same candidate passes iOS and Android Sandbox fresh-run observation:

- first visible screen within 10 seconds and first actionable choice within 10 seconds;
- P0 zero, blocking P1 zero;
- save, forced restart, background/foreground, and back-event recovery 100%;
- no service-worker registration in Toss or Sandbox;
- the curated bundle stays below 80 MiB and the generated `.ait` remains below the platform limit.

## Phase B privacy-safe observability contract

The Phase B base client emits only the approved vocabulary: `boot`, `character_created`, `first_action`,
`mission_open`, `move`, `explore`, `combat_start`, `combat_end`, `safe_expedition_return`, `save`,
`restore`, `feedback_submission`, and `fatal_error_boundary`. Every event has the exact fields
`name`, `releaseId`, `runtime`, `os`, `sessionId`, `job`, `levelBand`, `elapsedBucket`, and `outcome`.
Unknown fields, free text, nickname, inventory, location, enemy identity, raw user keys, and combat
logs are rejected before transport. The default transport and error reporter are no-ops, so this
repository does not claim a production collector or Sentry connection.

- Toss and Sandbox release identity comes from the SDK deployment ID. Missing or local release
  identity disables emission instead of inventing production evidence.
- Accepted reducer receipts are the event authority. StrictMode and action replay reuse the same
  receipt and cannot duplicate the funnel.
- Save and restore paths emit only coarse success/failure outcomes; Firebase timeout and offline
  fallback preserve the restored payload instead of dispatching a wrapper object.
- Transport, event validation, and clock rollback failures are fail-open for gameplay.
- Error reports contain controlled codes and only filename, line, and column for scripts already
  loaded by the current page. Raw messages, query strings, component stacks, caller-controlled
  function names, and multiline fake frames are excluded.
- The server-side funnel requires a pseudonymous cohort authority, distinct sessions for D1/D7,
  accepted outcomes, and a unique `(receivedAt, serverSequence)` tuple per cohort. Missing or
  duplicate order authority fails closed rather than publishing an undercounted funnel.

The local observability/storage regression suite passes 61/61, the full repository gate passes
3,801/3,801, and independent review found no remaining Important issue. Production collection is
still an external gate: a server must derive a
cohort ID from authenticated identity, assign receive time and monotonic sequence, and retain the
client allowlist. The Apps in Toss Analytics helper is not used because it adds an implicit
anonymous identifier outside this payload contract.

Sentry is also intentionally unconnected. A future integration must keep native tracking disabled,
bind the DSN and release ID outside source control, upload source maps separately for that exact
release, and retain a receipt. The installed SDK 3 CLI does not currently expose the documented
source-map upload command, so CLI compatibility must be resolved before enabling the provider.

## Phase C optional return-supply rewarded ad contract

The only rewarded-ad placement is the active safe-return debrief. It is offered only when the
expedition recorded at least one battle or exploration, the debrief is actually open, the runtime
is Toss or Sandbox, the SDK bridge is supported, and a non-placeholder group ID is configured.
Closing or reviewing the debrief disposes the hidden session; it cannot emit a new offer for a
historical summary. The primary return action is never disabled by ad state.

- The fixed disclosure is `광고 시청 시 하급 체력 물약 1개`; the reducer ignores SDK-provided
  unit type and amount.
- `userEarnedReward` is the only grant authority. Dismiss, load/show error, unsupported runtime,
  duplicate callback, and every late callback after a terminal outcome grant nothing.
- Each expedition uses a persisted monotonic sequence in addition to time. Its receipt is recorded
  once as `pending` or `delivered`, and the potion ID is deterministic from the expedition ID.
- A full inventory persists `pending`; the next accepted action that opens capacity delivers once.
  Reset and ascension preserve the receipt ledger and expedition sequence.
- Listener cleanup is best-effort and idempotent. A throwing SDK disposer cannot escape into
  gameplay.
- The official `ait-ad-test-rewarded-id` is accepted only in Sandbox and rejected in Toss runtime.
  A production group ID remains an uncommitted external input and activation requires approval.
- Raw SDK earned state is an `ad_show` lifecycle event. `ad_reward` is emitted only after the
  reducer-backed receipt is observed as `pending` or `delivered`; rejected transactions emit
  `ad_failure` instead.

The local rewarded-ad and observability focused suite passes 33/33, including save-completed
restart recovery, forged payloads, replay, terminal event reordering, throwing cleanup, and hidden
debrief lifecycle. The current full repository gate passes 3,822/3,822 with type-check,
warning-free lint, and build guard green. Independent review found no remaining Important
repository-owned issue.

This is deliberately not an arbitrary-kill or cross-device exactly-once claim. The installed SDK
3.0.3 earned event exposes no durable transaction ID. A hard kill after `userEarnedReward` but
before the staged save completes can lose the client receipt, and simultaneous devices have no
server receipt transaction to merge. The current restart proof begins after `await storage.save`.
Actual ad rendering, rewarded group configuration, event ordering, audio/lifecycle behavior, and
iOS/Android delivery remain Toss Sandbox and QR release gates.

## Phase D/E release evidence and Soft Launch authority

Repository-owned release operations are fail-closed and perform no upload. The verifier binds the
canonical Git commit/tree, `aetheria.ait`, the complete `dist-toss` file map, bundle budget report,
console deployment receipt, observation attachments, issue discovery receipts, decodable console
PNG assets, and candidate/release-scoped external receipts. Untracked source/config bytes invalidate
the clean-candidate claim.

The ordered readiness surface is `sandbox → private-qr → review → public → ad-activation`.
Private QR observations may begin only after internal observations finish; review approval must be
issued after private QR finishes; review acceptance and public approval remain ordered; ad group and
ad activation are a distinct post-public gate. Passing `public` means the candidate is ready for the
separately approved action. It does not prove that an upload or publication happened.

Soft Launch reports require an independent authority file bound to the exact candidate, artifact,
release, deployment, cutoff, input digest, row count, and server sequence range. Crash-free sessions,
durable ad transactions, and open P0 count require their own scoped receipt files. Only an accepted
boot session can contribute to save/restore and funnel denominators. D1/D7 count a later accepted
boot in a distinct session and use matured half-open windows. The generator writes once under the
ignored `build/toss-soft-launch/` root and refuses symlink escapes or overwrite.

Current repository tests validate only this local evidence contract. Real internal/QR observations,
console assets, production collector/Sentry receipts, GRAC/business/settlement, review acceptance,
public release, and ad activation are still absent external evidence.

## Phase F progression profile foundation

Pacing changes use an immutable `ProgressionProfile` with `id`, `version`, and separate EXP, loot,
and narrative-event multipliers. An active expedition stores a full normalized snapshot, so a remote
pointer change or rollback cannot alter an expedition already in progress. Legacy snapshots migrate
to the immutable baseline. Candidate transitions require predecessor version +1, exactly one changed
axis, the declared axis, and an initial 0.8–1.2 safety rail.

- EXP scaling occurs at production reward settlement before existing pacing/caps; discovery-chain EXP
  now uses the same level-up authority instead of directly incrementing the field.
- Loot scaling applies only to chance-based enriched, legacy, and high-level bonus paths. Quantity,
  prefix chance, pity reset, and guaranteed prestige boss rewards remain unchanged.
- Event scaling applies to the narrative base chance before the existing cap. The dry-streak pity
  increment remains additive and unscaled; campfire, scout, relic, anomaly, key, quiet, and boss gauge
  rolls are unaffected.
- Exploration and event actions accept an explicit RNG source and forward it through spawn, relic,
  scout, quiet, and battle-start paths. Production defaults remain compatible, while simulation uses
  stable domain-derived Mulberry32 streams without patching global `Math.random`.
- Normal spawned enemies now retain their map level so the existing high-level gold penalty does not
  silently treat every normal enemy as level 1.

`npm run progression:simulate -- --seed 20260810` now produces a byte-deterministic report through
production `spawnEnemy`, EXP settlement, loot, equip eligibility, class vitals, and combat attack
authorities. The report includes all 18 canonical job snapshots, canonical class/equipment schema
guards, tier-gate violations, job-blocked equipment, and a separate seeded narrative-occurrence
probe. Non-baseline reports require a valid predecessor and declared one-axis transition. The frozen
baseline report SHA-256 is
`2e4c0726be5d78bb7af5e8b3f6377976d1bc397613512c83dc8e2681dd699c43` for 8,176 modeled reward
settlements; it remains explicitly report-only and is not a claim about observed play time or full
combat-turn behavior.

`npm run progression:compare -- --axis exp --multiplier 1.2 --seed-start 20260810 --seed-count 64`
compares a candidate against the registered baseline across 2–1,000 unique unsigned 32-bit seeds.
Seeds outside `0..0xffffffff`, canonical collisions, malformed candidates, zero-axis candidates, and
unsafe transitions fail before predecessor simulation begins. The comparison sorts the seed set,
revalidates the one-axis transition, reports p10/p50/p90 checkpoint
reward actions, equipment-drop attempts, narrative occurrences, and all 18 jobs' single-attack
damage proxy, then drives every job through production
`makeCombatActionMap.RESOLVE_COMBAT_ACTION` as an un-geared auto-attack matrix. Combat proxy turns,
victory/death outcomes, and truncation are reported separately and do not claim a player-selected
build or observed behavior. The full report is bound to a SHA-256 envelope. A failed hard-correctness
check is always surfaced as `hard_correctness_failed`; it cannot be hidden behind only the known
production-funnel or full-combat-model blockers.

The fixed 64-seed local foundation produced these deterministic report hashes and target-direction
checks:

- EXP `1.2`: `167cd799c1ea53da3129b7521597ec5993eccf7536d924c4b2f69702122ee117`,
  Lv75 modeled reward-action p50 `8177 → 6817`
- loot `1.2`: `1c59983d0454c535c67f722834e7db94bfdbc9eaf4531b5877a90f23d7b74c93`,
  equipment-drop attempts `67171 → 80165`
- event `1.2`: `860f89f248a88b68478452a91e259aaf0bc985122c06d16788671151bd67072f`,
  narrative occurrences `26153 → 27623`

Every comparison remains `classification: report-only` and `activationReady: false`. Actual play
time, build-aware player-selected combat turns, expedition count, retention, and the production funnel are
unavailable, so `production_funnel_evidence_missing` and `full_combat_model_unavailable` remain hard
blockers. No multiplier is activated until the production Soft Launch funnel and a fuller combat
model point to the same pacing problem. Phase G content selection likewise remains data-gated rather
than being fabricated from simulation proxies alone.
