# Relic `dot_mult` coherence plan

## Objective

`CombatEngine.performSkill`의 상태 이상 보너스가 보유 순서가 아니라 가장 큰 유효
`dot_mult` 값으로 결정되게 고정한다. Catalog의 `death_mark` 3.0과
`curse_crystal` 1.5 및 기존 active-run snapshot은 바꾸지 않는다.

## Constraints and decisions

- 변경은 task contract의 여섯 경로로 제한한다. Catalog, migration, reducer source는
  현행 production contract가 이미 요구를 만족하므로 읽기/증명 대상이다.
- `getStrongestNumericRelicValue`를 유일한 numeric selector로 재사용한다. 새 selector나
  parallel policy는 만들지 않는다.
- invalid matching `dot_mult`는 helper가 던지는 `INVALID_RELIC_EFFECT_VALUE`로
  fail closed한다. 검증은 MP/cooldown/HP/enemy/status/log/RNG/reducer settlement 전의
  no-mutation을 확인한다.
- valid skill의 existing RNG draw 순서와 status application은 유지한다. Helper 호출은
  non-random validation/read only이며 valid output의 차이는 duplicate order 독립성뿐이다.

## RED → GREEN sequence

1. Production `CombatEngine.performSkill` with a status skill, fixed RNG, and DEF mitigation:
   `death_mark → curse_crystal` yields 9 while `curse_crystal → death_mark` currently yields
   7. Assert both must yield the 3.0 / 9 result and run it RED before editing production code.
2. Resolve `dotMult` once through the existing strongest helper before mutable skill settlement,
   remove the `find()` value selection, and retain the existing status-bonus log condition.
3. Expand the focused production test to bind no-relic, each single relic, both orders,
   non-status, critical, mitigation/floor, malformed values, active-save migration preservation,
   and exact reducer replay identity.
4. Add a canonical report builder and strict evidence CLI. The verifier will bind catalog bytes,
   policy, both production orders, malformed/replay/migration vectors, and SHA-256 source hashes;
   it rejects stale/tampered evidence and unsafe paths.

## Recorded production RED

Before the resolver substitution, run
`node --import tsx --test tests/relic-dot-multiplier-coherence.test.js` with the production
`CombatEngine.performSkill` vector. The `curse_crystal → death_mark` assertion failed as
`93 !== 91`: its 1.5 first match produced 7 mitigated damage, while the 3.0 policy requires
9. The same focused test passed after the substitution; this is characterization evidence, not
a mirrored damage formula.

Owner review then found the missing no-relic half of that contract. With `atk=10`, `enemy.def=0`,
`burn`, `mult=1`, and RNG `[0, 0.99, 0]`, the incomplete patch produced `enemyHp=91` and omitted
`[burn] 추가 피해 +1`; the pre-existing production baseline is `enemyHp=90` with that log. The
final selector therefore uses `1.0` only when no matching relic exists, while a matching relic
uses the shared strongest numeric value (including valid zero).

## Acceptance and verification

- Both catalog entries retain their exact stored descriptions and values; migrated snapshots are
  deep-equal after a second migration/reload.
- The reducer `RESOLVE_COMBAT_ACTION` accepts one receipt and returns the same state object for
  an exact replay, without duplicate damage/log/MP/status changes.
- Run the focused test, strict verifier, TypeScript, quiet lint, and `git diff --check`.
- Full canonical gates and task-board updates remain Goal-owner post-sync work because this
  worker contract grants neither those writable paths nor the canonical checkout lease.

## Rollback

Revert only the six task-contract paths. The production change is one selector substitution;
catalog values, save migration, and reducer implementation require no rollback.
