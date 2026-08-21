# `hp_drain_atk` paired-resolution plan

## Planning record

- Planning source: accepted GPT B / Sol xhigh task contract.
- Scope: the eight paths listed in the dispatch contract only. The relic catalog is read-only for this slice.
- Decision: choose one valid `hp_drain_atk` snapshot with the greatest `atkBonus`; its `hpCost` and displayed relic name travel with that same snapshot. Equal attack bonuses use a stable snapshot key, so inventory order cannot choose a different cost or label.

## Characterization / RED

The production characterization on `a664123fa60a24ce8037b108066ac3df071dfa1d` produced a base attack of `1198`, both-relic attack of `2335`, and `addedAttackBonus: 0.95` (`0.35 + 0.60`). The same `[혈맹의 반지, 심연의 계약]` turn charged the first match (`0.03`, `-30 HP`) and narrated `[혈맹의 반지] HP 대가 -30`; this is a split trade-off pair and an incorrect label for the selected abyssal effect.

The RED vectors to preserve as historical evidence are:

1. Both orders formerly summed `0.95` attack bonus while HP cost remained first-match (`0.03` or `0.05`).
2. The abyssal-first normal settlement was still narrated as `혈맹의 반지`.
3. A malformed matching snapshot must throw before cooldown, DOT, regeneration, HP, logs, enemy, RNG, or reducer state changes.

## Implementation

1. Add `src/utils/hpDrainAtkRelic.ts` as the only selector. It validates every matching `val` object and finite non-negative `atkBonus` / `hpCost` before selecting the strongest pair.
2. Make `calculateFullStats` consume the selected attack bonus and make `tickCombatState` consume the selected cost/label before any turn mutation.
3. Preserve `hell_reaper`: a selected `abyssal_contract` keeps `0.60` attack, substitutes the catalog synergy's `0.02` cost, and alone uses `지옥의 수확자`.
4. Add a deterministic audit, strict verifier, focused production-path tests, and byte-for-byte evidence. The evidence binds catalog, resolver, both runtime owners, test, verifier, plan, source snapshot, and exact changed-path receipt.

## Acceptance and verification

- No relic / each single relic keep their legacy numeric behavior; both inventory orders use abyssal `0.60` and paired `0.05`.
- Normal logs identify `혈맹의 반지` or `심연의 계약` accurately; `hell_reaper` identifies only itself.
- Active-run relic snapshots survive migration/reload; replayed reducer receipts remain object-identity no-ops; HP is bounded at one.
- Run: `node --import tsx --test tests/relic-hp-drain-atk-coherence.test.js`, the strict evidence verifier, `npx tsc --noEmit`, `npm run lint -- --quiet`, and `git diff --check`.

## Risks and rollback

- Risk: historic saved snapshots may be malformed. The resolver intentionally fails closed before turn mutation rather than silently guessing a cost.
- Risk: a future equal-attack relic could have a different price. Stable selection keeps its cost and label attached to the selected snapshot.
- Rollback: revert only this slice's eight paths together; do not alter catalog bytes or migration behavior.
