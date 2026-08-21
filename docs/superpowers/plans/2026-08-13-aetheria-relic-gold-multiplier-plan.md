# Aetheria `gold_mult` coherence implementation record

Date: 2026-08-13 KST

## Objective

Replace the production `gold_mult` first-match resolution in
`CombatEngine.handleVictory` with strongest-only resolution, without changing either
catalog value, any other relic family, EXP, loot, equipment, consumables, event
frequency, event rewards, or catalog bytes.

## Source snapshot and bounded scope

- Starting HEAD: `a664123fa60a24ce8037b108066ac3df071dfa1d`.
- Starting worktree: clean; source snapshot fingerprint supplied by the dispatcher was
  `git-status-v2:e622c0a7b5b2d689386a5fa3f12d1cd2cb7273cf791a649410f2d9382d14deaf`.
- Production owner: `src/systems/CombatEngine.outcome.ts`.
- Changes are limited to the dispatched relic-gold paths, their focused tests, QA-only
  test API, evidence, task ledger, and completion records. No catalog file is edited.

## Decision

- Matching `gold_mult` values must be numbers that are finite and non-negative.
- The reward applies only the strongest matching value; `[0.3, 0.6]` and `[0.6, 0.3]`
  both resolve to `0.6`.
- Invalid matching values and reward arithmetic overflow throw
  `INVALID_RELIC_EFFECT_VALUE` before `p.gold`, stats, logs, or reducer settlement are
  committed.
- Existing saved relic objects remain snapshot-authoritative; migration and reload do
  not rewrite their descriptions or numeric values.

## Ordered execution and acceptance evidence

1. RED: a direct production `handleVictory` characterization failed as expected:
   `[gold_magnet, merchant_seal]` returned `131`, not expected `161` for enemy gold
   `101`.
2. GREEN: a shared strongest numeric selector now drives only `gold_mult`; the result
   is `floor(101 * 1.6) = 161` in both orders.
3. Focused contracts cover catalog bytes, migration/reload, malformed values, overflow,
   deterministic rounding, reducer replay exact no-op, and strict evidence tampering.
4. `relic-gold-multiplier.json` binds policy, order, reward, catalog, malformed cases,
   and source authority hashes. The strict verifier rejects changed policy, order,
   reward, catalog, malformed-case, and hash fields.
5. The QA-only 390×844 Playwright path runs each inventory order through the actual UI
   attack action and production reducer. Double tap produces one kill and `161` gold;
   both orders produce the same result.

## Acceptance criteria

- `gold_magnet` remains `0.3` and `merchant_seal` remains `0.6`, with unchanged copy.
- No relic catalog source bytes changed; `git diff -- src/data/relics.ts` is empty.
- Gold receives no partial settlement when matching input or reward arithmetic is
  invalid.
- The implementation stays uncommitted; commit, push, signing, publishing, and
  physical-device acceptance remain out of scope.

## Recovery

Revert only the bounded gold-multiplier changed paths to restore first-match behavior.
The evidence verifier will then fail because the authority hash and reward report no
longer match, preventing stale proof from being reused.
