# Aetheria Relic Effect Coherence — Slice 2A Plan

Date: 2026-08-12 KST

Status: complete; current-byte implementation, evidence, real surface, and repository gates verified

Planning owner: GPT A, GPT-5.6 Sol xhigh

## Outcome

`free_skill` 유물의 player-facing 설명, rarity progression, runtime aggregation을 하나의 명확한 규칙으로 맞춘다. 이번 candidate에서 바뀌는 gameplay 값은 `주문 메아리`의 무료 기술 확률 `0.15 → 0.08` 하나다.

- `주문 메아리` (`uncommon`): MP 무소모 확률 8%
- `시공의 반지` (`epic`): MP 무소모 확률 15%
- 두 유물을 함께 보유해도 합산하지 않고 더 강한 15%만 적용
- 보유 배열 순서가 달라도 결과가 같음
- `시공의 반지` 설명은 실제 runtime인 MP 무소모 15%로 정정

희귀도, relic weights, synergy, skill damage, cooldown, MP cost, 다른 유물 값은 변경하지 않는다.

## Why This Comes Before More Tuning

현재 두 유물은 같은 `effect: free_skill`, 같은 `val: 0.15`를 쓰지만 rarity가 `uncommon`과 `epic`으로 다르다. 더 중요한 문제는 `시공의 반지` 설명이 “재사용 대기가 늘지 않음”이라고 쓰여 있는 반면 production `CombatEngine.actions`는 두 유물을 모두 “MP를 소모하지 않음”으로 처리한다는 점이다.

runtime은 `find()`로 첫 번째 `free_skill` 유물만 읽는다. 두 유물을 함께 얻으면 성능이 catalog 배열 또는 save 배열 순서에 의존한다. 값을 8%와 15%로 나누기 전에 이 order dependence를 없애야 한다.

이번 결정은 다음 원칙을 고정한다.

> 같은 numeric effect의 강화형 유물은 합산하지 않는다. 가장 강한 canonical value 하나만 적용한다.

이 원칙을 모든 duplicate effect에 한 번에 적용하지 않는다. `dot_mult`, `event_chance`, `gold_mult`, `drop_rate`, `hp_drain_atk`는 각각 cost와 stacking 의미가 다르므로 이후 family별 candidate로 검증한다.

## Scope

### Writable paths

- `src/data/relics.ts`
- `src/systems/CombatEngine.actions.ts`
- `src/systems/relicFreeSkillAudit.ts`
- `scripts/verify-relic-free-skill.mjs`
- `tests/relic-free-skill-coherence.test.js`
- `tests/e2e/relic-free-skill.spec.ts`
- `src/hooks/useGameTestApi.ts`
- `docs/evidence/qa/release-complete-core/relic-free-skill.json`
- `package.json`

### Read-only authorities

- `src/data/classes.ts`
- `src/data/relics.ts`
- `src/systems/CombatEngine.actions.ts`
- `src/utils/statsCalculator.ts`
- `src/utils/gameUtils.ts`
- `src/systems/relicBalanceAudit.ts`
- `docs/evidence/qa/release-complete-core/relic-balance.json`
- `tests/relics.test.js`
- `tests/synergies-cycle.test.js`
- `tests/premium-cycle.test.js`

### Excluded

- cooldown behavior and cooldown relics
- skill damage and skill definitions
- global event chance, scout, campfire, event rewards
- equipment, consumables, EXP, loot, maps, monsters, quests
- Toss, native generated output, `build/`
- existing combat UI follow-up and release evidence
- stage, commit, push, release

## Production Contract

Add one narrow pure selector near the combat owner:

```ts
export function getStrongestNumericRelicValue(
  relics: readonly Relic[],
  effect: string,
): number;
```

The selector must:

- accept only finite, non-negative numeric `val`
- return `0` when the effect is absent
- choose the maximum matching value
- be independent of array order
- never add duplicate values
- fail closed on malformed matching values instead of silently using `0`

`CombatEngine.actions` computes base free-skill chance from this selector and then adds the existing `arcane_singularity` synergy chance. Existing first-free cooldown relic behavior remains higher priority and unchanged.

Do not export private rarity weights or move combat ownership into the audit system.

## Deterministic Evidence

Create `RelicFreeSkillReport`:

```ts
interface RelicFreeSkillReport {
  schemaVersion: 1;
  predecessor: {
    spellEchoChance: 0.15;
    timeRingChance: 0.15;
  };
  candidate: {
    spellEchoChance: 0.08;
    timeRingChance: 0.15;
    bothOrdersChance: [0.15, 0.15];
  };
  synergy: {
    addedChance: 0.35;
    spellEchoCombined: 0.43;
    timeRingCombined: 0.5;
  };
  jobMatrix: Array<{
    job: string;
    representativeSkill: string;
    mpCost: number;
    expectedMpSavedPerUse: {
      predecessorUncommon: number;
      candidateUncommon: number;
      epic: number;
    };
  }>;
  errors: string[];
}
```

The matrix must cover exactly 18 canonical jobs and one real usable skill for each job. Missing skills, non-finite MP cost, unknown job, duplicate job, or incomplete coverage is an error. It is an expectation report, not a claim about actual player behavior or retention.

The evidence envelope is deterministic JSON with SHA-256 over canonical report bytes. Verify mode compares the complete file bytes and rejects unsafe paths, duplicate flags, traversal, absolute paths, backslashes, symlink ancestors, unknown modes, stale files, and nonempty report errors.

## TDD Sequence

1. Characterize current behavior.
   - `spell_echo` and `time_ring` both yield 15%.
   - `time_ring` display copy disagrees with runtime.
   - `[spell_echo, time_ring]` and `[time_ring, spell_echo]` expose different selected objects under the current `find()` policy.

2. Add RED policy tests.
   - spell echo alone is 8% in the candidate.
   - time ring alone is 15%.
   - both orders are exactly 15%, not 23% and not 8%.
   - malformed matching values fail closed.
   - absent family returns 0.

3. Add threshold behavior tests through production skill execution.
   - RNG `0.079999` is free for spell echo; `0.080001` is not.
   - RNG `0.149999` is free for time ring; `0.150001` is not.
   - both ownership orders follow the time ring threshold.
   - actual MP cost, cooldown increment, damage, logs, and turn settlement remain otherwise unchanged.

4. Lock synergy behavior.
   - arcane singularity remains additive at +35 percentage points.
   - spell echo + synergy is 43%.
   - time ring + synergy is 50%.
   - no duplicate base stacking occurs before the synergy addition.

5. Lock save compatibility.
   - an active-run saved spell echo with `val: 0.15` remains 0.15 after migration.
   - an active-run saved time ring with the historical description remains unchanged.
   - new catalog offers use the candidate values and corrected copy.

6. Add the 18-job report and strict CLI mutations.

7. Add a 390×844 real RelicChoice test.
   - the uncommon card says 8% MP-free.
   - the epic card says 15% MP-free and does not mention cooldown.
   - both cards remain readable, contained, and at least 44 CSS px tappable.
   - selection grants through the real reducer exactly once.
   - production save keys remain byte-identical in the isolated test build after the debounce window.

## Acceptance Criteria

- Exactly one gameplay value changes: `spell_echo.val 0.15 → 0.08`.
- Exactly one copy correction changes: `time_ring.desc` matches MP-free runtime behavior.
- Both ownership orders resolve to 15%; duplicate values never stack.
- Existing first-free cooldown relic and arcane singularity behaviors remain intact.
- Legacy active-run snapshots are not rewritten.
- The report covers all 18 jobs with finite MP costs and zero errors.
- Focused tests, strict evidence verify, 390×844 Playwright, type-check, lint, content verify, pacing verify, mobile doctor, Capacitor sync, and diff-check pass.
- The current art verifier passes; no art source, manifest, provenance, or runtime asset is repaired or rewritten in this slice.
- No other balance, Toss, native source, build, stage, commit, push, or release effect occurs.

## Next Slice

Slice 2B addresses `event_chance` coherence:

- `고대 지도` common `+60% → +15%`
- `방랑자의 부적` uncommon remains `+30%`
- duplicate ownership becomes order-independent under a separately approved stacking policy
- controlled production rhythm comparison proves the relic modifier decreases general narrative events without changing global profile, rewards, EXP, or loot

Only after 2B is closed does the broader optional-event candidate adjust scout or other global frequency levers.

## Execution Record

- Native Codex Goal owns this bounded Slice 2A implementation.
- The replacement external manifest passed readiness, account, repository, writer, repository-local, and dirty-overlap preflight checks.
- Orca start returned `outcome-unknown`, but inspection found no created worker task, worktree, terminal lease, or writable execution surface. The same external start was not retried.
- GPT A completed the approved plan directly in the canonical checkout without broadening scope or allowing a second writer.
- RED failures were observed for the missing selector, the stale 15% uncommon value, missing audit/CLI/evidence, missing real-surface test seam, and incomplete job/catalog mutation coverage before the corresponding GREEN changes.
- Focused free-skill/relic regressions pass `125/125`; strict free-skill evidence verification passes with report SHA-256 `ddf2e9a1a65b11e795f2f48c69a88d3fbbcae3d25aa60c5818f57108ce72dffd`.
- Existing relic, content, pacing, and art verifiers pass; `npm run verify` and `npm run verify:full` pass. Desktop/mobile smoke and Playwright shards pass `52/52 + 52/52`, including the 390×844 real reducer path.
- `npm run mobile:doctor` and `npm run cap:sync` pass; Android/iOS tracked source drift is zero. Apple Distribution identity and Android release keystore remain environment-only release blockers.
- Index is empty. No stage, commit, push, release, Toss, signed archive, or physical-device action was performed.

## Goal Close-out

The Slice 2A objective is complete on the current canonical bytes. The external Orca start remains recorded as `outcome-unknown` with no materialized worker and is not counted as execution evidence; GPT A's Native Goal completion audit owns the verified result. Slice 2B requires a new bounded Goal because it changes a different relic family and event-frequency authority.
