# Aetheria Relic Drop-rate Coherence Plan

Date: 2026-08-17 KST

## Objective

`drop_rate`는 같은 numeric effect를 가진 active-run relic snapshot 중 finite, non-negative 최댓값 하나만 사용한다. `lucky_coin`의 `0.5`와 `fortune_relic`의 `1.0`, 설명, rarity는 변경하지 않으며 기존 save snapshot도 migration에서 다시 쓰지 않는다.

## Scope and policy

- Production owner는 `CombatEngine.loot.ts`이며 `CombatEngine.actions.ts`의 `getStrongestNumericRelicValue`를 그대로 import한다.
- multiplier는 `1 + strongest value`이고, duplicate를 더하지 않으며 inventory order에 의존하지 않는다.
- Matching value가 missing/string/NaN/Infinity/negative이면 selector가 throw한다. Finite value가 chance product를 overflow하면 loot owner가 RNG, prestige item/log, inventory, pity settlement 전에 throw한다.
- Enriched `DROP_TABLES`, legacy `LOOT_TABLE`, high-level bonus는 같은 multiplier와 기존 RNG draw sequence를 사용한다. Guaranteed prestige drop의 valid-path behavior는 변경하지 않는다.

## RED → GREEN record

Pre-fix production `processLoot` was run with a temporary controlled `DROP_TABLES['__drop_rate_controlled_enriched__'] = [{ item: '슬라임 젤리', rate: 0.4 }]`, `roll = 0.7`, and the two catalog relic orders. The weak-first order produced zero items while the strong-first order produced one; the production assertion failed as `0 !== 1` before the shared-selector import was restored.

After the implementation, the same controlled test is GREEN: both orders produce one item at the same threshold. The focused evidence report additionally fixes real enriched (`슬라임`), legacy (`물의 정령`), and table-less high-level-bonus vectors, malformed fail-closed cases, catalog bytes, legacy snapshots, RNG call counts, source hashes, and the exact seven-path receipt.

## Verification

1. Run the two focused test files with `node --import tsx --test`.
2. Regenerate and verify `docs/evidence/qa/release-complete-core/relic-drop-rate.json` through the strict CLI.
3. Run TypeScript, quiet lint, and `git diff --check`.
4. Goal owner performs shared package, cross-surface evidence, ledger, and full-gate verification after sync.
