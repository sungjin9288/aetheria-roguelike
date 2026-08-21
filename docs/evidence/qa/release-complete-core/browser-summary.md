# Release-complete core browser summary

Date: 2026-08-11 KST

Branch: `codex/release-complete-core`

Baseline commit: `8db86a2354730588c0243d33f7a81f3e76dbb60c`

## Result

The repository-owned player journey is browser verified through production actions:

`fresh start → move → story event → seeded production explore → combat → safe return → equipment decision → job change → skill branch`

The endgame path is browser verified through production combat and reducer settlement:

`Demon King final shard → true boss → True Ending → New Game+ → save/reload`

The seed controls are available only in the existing test-harness runtime. The
production bundle guard rejects them if they leak into a production build. Fixtures do
not pre-complete the transition being asserted.

## Browser verification

- Release-complete journey E2E: `2/2`.
- Combined release-complete, True Ending, own-grave and ascension E2E: `11/11`.
- Full gate E2E: shard 1 `51/51`, shard 2 `48/48`.
- Desktop smoke: pass.
- Mobile smoke: pass.
- Fresh-QA performance guard: desktop intro/start/first-action/market
  `398.3/100.6/25.4/42.6 ms`; mobile `414.6/129.7/6.8/67.8 ms` — all pass.
- 375×667: reduced-motion True Ending and reachable CTA pass.
- 390×844: fresh journey, debrief, own grave, True Ending, safe-area, overflow and
  minimum 44px controls pass.
- 430×932: first-frame skip and reachable New Game+ CTA pass.
- Desktop smoke emitted the existing best-effort `browser.close timeout` shutdown log
  after assertions passed; mobile smoke and all E2E shards subsequently passed.

## Selected visual evidence

- [True Ending/New Game+ 390×844](screenshots/true-ending-new-game-plus-390x844.png) —
  SHA-256 `0aec6b148d9ce09f11ed0ac3f1cebed9feb0eebc1035c755789f79971e6aabeb`.
- [Own-grave recovery 390×844](screenshots/grave-recovery-390x844.png) —
  SHA-256 `f7c0aeba9789c044c87e664ddfd6b43bb8932d1c8b60981eec5c91552bbe4084`.

## Boundary

This is automated browser evidence. It does not count as a fresh human observation,
physical-device acceptance, signed release, Toss Sandbox run, review, publication or ad
activation. No bounded encounter region or content pack is activated from this evidence.
