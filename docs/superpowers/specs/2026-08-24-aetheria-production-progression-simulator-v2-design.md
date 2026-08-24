# Aetheria Production Progression Simulator v2 Design

Date: 2026-08-24 KST
Status: approved direction, implementation pending written-spec review
Base checkpoint: `244062f`

## 1. Outcome

`Progression Simulator v2`는 Aetheria의 production progression, combat, loot, pity,
exploration pacing authority를 사용해 장기 플레이의 병목을 재현 가능한 진단 보고서로
만든다. 이 보고서는 숫자를 자동으로 조정하지 않는다. 먼저 현재 상태를 측정하고, 실제
funnel과 같은 문제를 가리킬 때만 다음 Goal에서 EXP, loot/pity, event frequency, enemy
HP/reward 중 한 축을 조정한다.

이 Goal은 게임 밸런스를 바꾸는 작업이 아니라 다음 balance decision을 안전하게 만들기
위한 production-path diagnostic foundation이다.

## 2. Current Evidence and Gap

현재 `src/systems/progressionSimulator.ts`는 다음 기반을 이미 갖고 있다.

- checkpoint level `2, 5, 10, 20, 45, 60, 75`
- 18개 canonical job reachability
- `spawnEnemy`, `startExpedition`, `scaleProgressionExpReward`,
  `getPacedCombatExp`, `CombatEngine.applyExpGain`, `processLoot`, `canEquip` 사용
- deterministic domain-separated RNG
- `ProgressionProfile` single-axis transition validation
- comparison report의 un-geared auto-attack combat matrix
- current baseline과 candidate의 EXP, loot, event proxy comparison

하지만 v1의 level progression loop는 전투를 수행하지 않고 enemy reward를 즉시 정산한다.
18-job combat matrix도 progression loop와 분리된 한 번의 무장비 encounter다. 따라서 현재
보고서가 명시한 대로 다음 값은 실제 progression metric으로 사용할 수 없다.

- actual play time
- player action turns across progression
- death rate
- expedition count
- retention

예를 들어 Lv75까지의 `modeledActions`에 고정 90초를 곱한 값은 policy arithmetic일 뿐
실제 플레이 시간이 아니다. v2는 이 한계를 숨기지 않고 reward progression, combat
diagnostic, loot/pity diagnostic, exploration proxy를 서로 다른 cohort로 분리한다.

## 3. Scope

### In scope

- 기존 reward progression checkpoint를 schema-v2 report 안에 보존
- 18개 job의 production reducer combat diagnostic
- job unlock level과 같은 tier 안에서의 turns, victory, defeat, escape, truncation 비교
- attack-only control과 skill-first diagnostic policy 비교
- item/equipment drop streak, equipable tier discovery, signature boss pity 분포
- narrative/combat/nothing 및 discovery outcome의 deterministic exploration proxy
- 64-seed focused diagnostic와 1,000-seed reward/event comparison의 분리
- commit-independent source SHA-256 manifest를 포함하는 exact-byte evidence
- malformed input, non-finite metric, source drift, report tamper에 대한 fail-closed verifier

### Out of scope

- EXP, loot, pity, event, enemy HP 또는 reward numeric 변경
- 새 `ProgressionProfile` 활성화
- save schema, migration, runtime player field 변경
- 새 region, monster, item, job, event, currency, menu, UI
- 실제 사용자 행동을 흉내 내는 AI policy
- retention, D1/D7 또는 actual play-time claim
- Apps in Toss, 광고, IAP, signing, publication
- physical-device acceptance
- 새 dependency

## 4. Approaches Considered

### A. v1 reward loop에 combat을 직접 끼워 넣기

한 함수에서 level 1부터 75까지 실제 combat을 반복한다. 구조는 단순해 보이지만 18 jobs,
64~1,000 seeds, 최대 200 turns를 곱하면 실행 비용이 급격히 커진다. death 이후 귀환과
재출발 policy도 production에서 자동으로 정해지지 않으므로 임의의 player behavior를
만들게 된다. 채택하지 않는다.

### B. 분리된 production-path diagnostic cohorts

기존 reward progression은 빠른 checkpoint model로 유지한다. Combat, loot/pity,
exploration은 각각 production owner를 호출하는 bounded cohort로 측정하고, 보고서에서
서로 다른 classification과 limitations를 가진다. 동일 seed policy와 evidence envelope로
결합하되 실제 플레이처럼 주장하지 않는다. 이 방식을 채택한다.

### C. Playwright로 Lv75 전체 UI replay

실제 surface를 가장 많이 통과하지만 실행 시간이 과도하고 balance distribution을 분석할
seed 수를 확보할 수 없다. UI timing과 browser flake가 balance signal을 오염시킨다. 최종
candidate의 첫 세션 E2E에는 사용하되 simulator foundation으로는 사용하지 않는다.

## 5. Architecture

### 5.1 Orchestrator

`src/systems/progressionSimulator.ts`는 public API와 기존 schema-v1 compatibility를
소유한다. v2 구현은 이 파일에 새로운 combat/loot loop를 계속 쌓지 않는다. 다음 focused
module의 결과를 조합하고 canonical ordering, validation, deep freeze를 담당한다.

```ts
export interface ProgressionDiagnosticOptions {
    seeds: number[];
    maxCombatTurns?: number;
}

export const buildProgressionDiagnostic = (
    options: ProgressionDiagnosticOptions,
): ProgressionDiagnosticReport;
```

기존 `simulateProgression()`과 `simulateProgressionComparison()`의 public behavior와
schema-v1 hashes는 변경하지 않는다. v2 diagnostic은 별도 API와 evidence다.

### 5.2 Production journey diagnostic runner

새 `src/systems/progressionDiagnostic.ts`는 pure deterministic runner다. UI dispatch,
network, Firebase, wall-clock, global `Math.random`을 사용하지 않는다.

Consumes:

- `DB.CLASSES`, `DB.MAPS`, `DB.ITEMS`
- `buildClassVitals`, `calculateFullStats`
- `spawnEnemy`
- `makeCombatActionMap(INITIAL_STATE.player).RESOLVE_COMBAT_ACTION`
- `canEquip`
- `getSignaturePityMultiplier`
- reducer victory settlement가 호출하는 production loot/pity authority
- `getDiscoveryOdds`, `getNarrativeEventChance`, `getQuietExplorationChance`,
  `advanceExploreState`
- `createDomainRandom`, `deriveSeed`

Produces:

```ts
export type ProgressionDiagnosticCohorts = {
    combat: CombatDiagnostic;
    loot: LootDiagnostic;
    exploration: ExplorationDiagnostic;
};

export const runProgressionDiagnosticCohorts = (
    seeds: readonly number[],
    policy?: ProgressionDiagnosticPolicy,
): ProgressionDiagnosticCohorts;
```

### 5.3 CLI and evidence verifier

Create:

- `scripts/diagnose-progression.mjs`
- `scripts/verify-progression-diagnostic.mjs`
- `docs/evidence/qa/release-complete-core/progression-diagnostic-v2.json`

Package commands:

```json
{
  "progression:diagnose": "node --import tsx scripts/diagnose-progression.mjs",
  "progression:diagnostic:verify": "node --import tsx scripts/verify-progression-diagnostic.mjs --verify docs/evidence/qa/release-complete-core/progression-diagnostic-v2.json"
}
```

`--write`만 evidence를 갱신한다. `--verify`는 target bytes를 변경하지 않는다. CLI는
unknown flag, duplicate flag, unsafe output path, invalid seed count, non-uint32 seed,
non-finite limit을 모두 write 전에 거부한다.

## 6. Deterministic Policy

```ts
export const PROGRESSION_DIAGNOSTIC_POLICY = Object.freeze({
    id: 'production-progression-diagnostic',
    version: 2,
    classification: 'diagnostic-production-path',
    actualPlayClaim: false,
    focusedSeedStart: 20_260_824,
    focusedSeedCount: 64,
    comparisonSeedCount: 1_000,
    maxCombatTurns: 200,
    explorationOpportunitiesPerSeed: 4_096,
});
```

모든 random domain은 최소 다음 identity를 포함한다.

```text
policy.id / policy.version / cohort / seed / job / checkpoint / encounter / turn
```

Job, map, item, metric row는 locale-dependent sorting을 사용하지 않고 code-point order를
사용한다. 시간 identity가 필요하면 기존 fixed epoch와 monotonic sequence를 사용한다.
`Date.now()`와 global random은 verifier가 source contract로 거부한다.

64 seeds는 reducer combat과 loot/pity처럼 상대적으로 비싼 focused diagnostic에 사용한다.
기존 1,000-seed comparison은 reward progression과 event direction invariant에만 유지한다.
Full combat을 1,000 seeds로 확장하지 않는다.

## 7. Combat Diagnostic

### 7.1 Cohort identity

모든 18 jobs를 exact coverage한다. 각 job은 canonical unlock level에서 해당 level에 맞는
highest reachable map cohort를 사용한다. 같은 seed와 job은 같은 encounter를 사용한다.

두 action policies를 분리한다.

1. `attack-only`: 기존 auto-attack proxy를 보존하는 control
2. `skill-first`: canonical selected skill을 먼저 요청하고 reducer가 `rejected`를 반환하면
   같은 state에서 attack을 다음 입력으로 사용한다

`rejected` skill input은 player turn으로 세지 않고 별도 `rejectedSkillInputs`에 기록한다.
Accepted reducer transition만 `acceptedTurns`를 증가시킨다.

### 7.2 Loadout boundary

Acquisition을 가장하지 않기 위해 random inventory를 생성하지 않는다.

- `base` cohort: job base vitals, empty equipment/relic/status
- `eligible-loadout` cohort: 해당 job과 unlock level에서 `canEquip`을 통과하는 item만 사용;
  slot별 highest reachable tier, 동일 tier에서는 code-point-first identity를 선택

`eligible-loadout`은 acquisition claim이 아니라 canonical capability upper-bound다. Report는
loadout identity와 이 limitation을 명시한다. 두 cohort의 결과를 섞어 하나의 평균으로 만들지
않는다.

### 7.3 Metrics

각 job/action/loadout cohort는 다음 값을 가진다.

```ts
type CombatJobDiagnostic = {
    job: string;
    tier: number;
    level: number;
    loadoutPolicy: 'base' | 'eligible-loadout';
    actionPolicy: 'attack-only' | 'skill-first';
    encounters: number;
    victories: number;
    defeats: number;
    escapes: number;
    truncated: number;
    acceptedTurns: Distribution;
    rejectedSkillInputs: number;
    remainingHpRatio: Distribution;
};
```

`truncated > 0`, non-finite metric, outcome total mismatch, reducer exact no-op on an accepted
turn은 hard error다.

Job fairness는 같은 class tier, loadout policy, action policy 안에서만 비교한다. Universal
combat score나 ATK/DEF 합산 점수를 새로 만들지 않는다. v2는 p10/p50/p90와 cohort ratio를
보고하지만 자동 balance-fail threshold는 설정하지 않는다. 첫 report를 Sol xhigh가
검토한 뒤 실제 defect cohort만 별도 Goal로 연다.

## 8. Loot and Pity Diagnostic

“무보상”은 모든 kill이 주는 EXP/gold를 포함하면 항상 false가 되므로 다음 세 streak로
정확히 분리한다.

- `killsWithoutAnyItem`
- `killsWithoutEquipment`
- `bossKillsWithoutSignature`

Loot diagnostic은 reducer victory settlement 후의 player inventory, codex와
`stats.signaturePity`를 읽는다. `processLoot` 결과를 test-side에서 다시 계산하지 않는다.

Metrics:

```ts
type LootDiagnostic = {
    kills: number;
    itemDrops: number;
    equipmentDrops: number;
    equipableDrops: number;
    firstItemKill: Distribution | null;
    firstEquipmentKill: Distribution | null;
    firstEquipableTierKill: Record<string, Distribution | null>;
    longestNoItemStreak: Distribution;
    longestNoEquipmentStreak: Distribution;
    bossAttempts: number;
    signatureDrops: number;
    firstSignatureBossAttempt: Distribution | null;
    longestNoSignatureBossStreak: Distribution;
    pityActivationCount: number;
    pityResetCount: number;
    maxObservedPity: number;
};
```

Signature metric은 canonical boss encounter cohort로 한정하고 일반 monster drop과 섞지
않는다. Pity multiplier, boss miss increment, signature reset은 production state transition과
일치해야 한다. Full inventory를 자동 확장하지 않는다. Inventory capacity 때문에 reward가
막히는 경우는 `capacityBlockedDrops`로 분리한다.

## 9. Exploration Diagnostic

Production의 mandatory story, boss challenge, player return choice와 AI-generated event를
모두 재현하지 않는다. v2가 소유하는 것은 production pacing functions를 사용한 optional
exploration proxy다.

각 seed에서 deterministic map route와 current explore state를 사용해 다음을 측정한다.

```ts
type ExplorationDiagnostic = {
    classification: 'optional-exploration-proxy';
    actualPlayClaim: false;
    opportunities: number;
    outcomes: {
        narrative: number;
        combat: number;
        nothing: number;
        keyEvent: number;
        anomaly: number;
        relic: number;
    };
    narrativeGap: Distribution;
    nothingStreak: Distribution;
    relicGap: Distribution;
    pityActivations: {
        narrative: number;
        discovery: number;
        relic: number;
    };
};
```

Outcome priority는 spec에 한 번만 정의하고 implementation과 test에 복사하지 않는다.
Production helper에서 얻은 odds와 `advanceExploreState`가 source of truth다. 보고서는
mandatory story/boss/AI/retention을 `unavailableMetrics`에 남긴다.

현재 event frequency를 추가로 낮추는 판단은 다음 조건을 모두 만족할 때만 별도 Goal로
연다.

1. v2 optional proxy가 excessive narrative density 또는 짧은 gap을 보임
2. 실제 first-session funnel 또는 fresh observation도 같은 문제를 보임
3. EXP와 loot axis를 동시에 바꾸지 않음

## 10. Expedition and Time Honesty

Production에는 “몇 전투 뒤 자동 귀환” 규칙이 없다. Player가 HP, inventory, mission,
목표에 따라 귀환을 결정한다. 따라서 임의로 5전투를 한 expedition으로 묶지 않는다.

v2는 다음을 보고한다.

- `diagnosticEncounterRuns`: simulator가 실제로 수행한 bounded combat 수
- `rewardActionsToCheckpoint`: 기존 reward model action 수
- `actualExpeditionCount: unavailable`
- `actualPlayTime: unavailable`

실제 expedition count와 play time은 candidate-bound product events에서만 판단한다.
향후 player return policy를 별도 승인하면 새 schema version에서 modeled expedition을
추가할 수 있지만 이번 Goal에는 포함하지 않는다.

## 11. Report and Evidence Contract

Top-level report:

```ts
type ProgressionDiagnosticReport = {
    schemaVersion: 2;
    classification: 'diagnostic-production-path';
    actualPlayClaim: false;
    policy: ProgressionDiagnosticPolicy;
    rngPolicy: { id: 'mulberry32-domain-streams'; version: 1 };
    seeds: number[];
    authorities: Record<string, string>;
    rewardProgression: {
        classification: 'modeled-reward-settlement';
        checkpoints: unknown[];
        limitations: string[];
    };
    combat: CombatDiagnostic;
    loot: LootDiagnostic;
    exploration: ExplorationDiagnostic;
    unavailableMetrics: string[];
    hardErrors: string[];
    reviewCohorts: string[];
};
```

Evidence envelope:

```ts
type ProgressionDiagnosticEvidence = {
    evidenceSchemaVersion: 1;
    generatedBy: 'progression-diagnostic-v2';
    hashAlgorithm: 'sha256';
    reportHash: string;
    sourceSnapshot: {
        hashAlgorithm: 'sha256';
        files: Array<{ path: string; sha256: string }>;
    };
    report: ProgressionDiagnosticReport;
};
```

`sourceSnapshot.files`는 verifier, diagnostic test와 직접 사용하는 production authority
files를 path순으로 포함한다. Evidence 파일 자체, Git HEAD/tree/blob, timestamp, absolute
path는 포함하지 않는다. Duplicate path, unsorted row, source drift, reportHash mismatch,
unexpected field는 fail closed한다.

## 12. File Boundary

Likely production and tooling paths:

- Modify: `src/systems/progressionSimulator.ts`
- Create: `src/systems/progressionDiagnostic.ts`
- Create: `scripts/diagnose-progression.mjs`
- Create: `scripts/verify-progression-diagnostic.mjs`
- Create: `tests/progression-diagnostic.test.js`
- Modify: `tests/progression-simulator.test.js` only for v1 compatibility assertions
- Modify: `package.json`
- Create: `docs/evidence/qa/release-complete-core/progression-diagnostic-v2.json`
- Modify: `docs/evidence/qa/release-complete-core/requirement-matrix.md`
- Modify: `docs/evidence/qa/release-complete-core/completion-summary.md`
- Modify: `tasks/todo.md`
- Modify: `progress.md`

Read-only production authorities unless a minimal shared export is proven necessary by RED:

- `src/reducers/handlers/combatHandlers.ts`
- `src/systems/combatActionTurn.ts`
- `src/hooks/combatActions/combatVictory.ts`
- `src/systems/CombatEngine.loot.ts`
- `src/utils/explorationPacing.ts`
- `src/utils/signaturePity.ts`
- `src/data/items.ts`
- `src/data/classes.ts`
- `src/data/maps.ts`
- `src/data/monsters.ts`

If implementation requires changing a reducer, combat, loot, pity or exploration interface rather
than importing its current public owner, that is a material plan gap. Stop the affected edit path
and return to Sol xhigh re-plan.

## 13. TDD Slices

### Slice 1: schema and honesty RED

Tests require schema version 2, exact classifications, all checkpoint levels, 18 jobs,
`actualPlayClaim:false`, explicit unavailable actual time/expedition/retention, deterministic row
ordering and deep-frozen output. RED must fail because v2 API does not exist.

### Slice 2: combat reducer RED

Tests mutate production enemy HP/ATK and selected skill availability to prove the report changes
through `RESOLVE_COMBAT_ACTION`, not a mirrored damage formula. Cover attack-only, skill-first,
rejected skill fallback, victory, defeat, extra turn, DOT victory, truncation and non-finite state.

### Slice 3: loot/pity RED

Controlled production drop tables prove item/equipment streaks, job/level equipability, signature
miss increment, pity activation, signature reset, inventory capacity and deterministic replay.
Each mutation must fail before implementation.

### Slice 4: exploration RED

Controlled odds and fixed RNG prove outcome counts, narrative gap, nothing streak, relic gap and
pity activation. Changing `advanceExploreState` or a production chance owner must change or reject
the report. Mandatory/AI metrics remain unavailable.

### Slice 5: evidence and CLI RED

Tests cover exact-byte write/verify, source manifest, unrelated HEAD independence, report/source
tamper, path traversal, duplicate/unknown flag, invalid seed count and no-write failure behavior.

### Slice 6: GREEN integration

Run 64 focused seeds, generate one canonical evidence file, verify deterministic second run and
record review cohorts without changing gameplay values.

## 14. Acceptance Criteria

- Existing `simulateProgression` schema-v1 report and baseline hash remain unchanged.
- Existing comparison report remains deterministic and valid.
- v2 report covers exact 18 jobs and checkpoints `2/5/10/20/45/60/75`.
- Combat cohorts use production reducer transitions; test-side damage/reward formula count is zero.
- Every combat cohort has finite metrics, matching outcome totals and `truncated=0`.
- Loot streaks distinguish any item, equipment and signature.
- Signature pity increment/reset is observed through production player state.
- Exploration report is explicitly proxy-only and does not claim mandatory story, boss, AI,
  retention, actual expedition or actual time.
- 64-seed evidence is byte-deterministic.
- Source snapshot is sorted, unique, SHA-256 bound and Git-commit independent.
- `hardErrors` is empty before evidence can be written.
- No numeric gameplay, save schema, dependency, UI, region, content or profile activation change.
- Historical observation and Toss evidence bytes remain unchanged.

## 15. Verification

Focused:

```bash
node --import tsx --test tests/progression-diagnostic.test.js tests/progression-simulator.test.js tests/progression-comparison.test.js
npm run progression:diagnostic:verify
npm run content:verify
npm run pacing:verify
npx tsc --noEmit
npm run lint
git diff --check
```

Full repository and mobile regression:

```bash
npm run verify
npm run verify:full
npm run art:verify
npm run event-reward:verify
npm run mobile:doctor
npm run cap:sync
git status --short -- android ios
```

The diagnostic Goal does not require a new browser screenshot because it adds no player-facing
surface. Android debug and unsigned iOS device builds are run only at the final repository candidate
gate or if implementation unexpectedly touches packaging inputs.

## 16. Decision Boundary After v2

The v2 report ends in one of three states.

1. `no-hard-defect`: no numeric change; retain current profile.
2. `review-cohort`: Sol xhigh reviews the exact job/tier/loot/event cohort and decides whether live
   funnel evidence is needed before tuning.
3. `hard-defect`: malformed/non-finite/truncated/authority mismatch; fix correctness before any
   balance work.

When simulation and actual funnel identify the same pacing problem, open a new Goal for exactly one
axis in this order:

1. EXP multiplier
2. item drop and pity
3. event multiplier or one optional-event lever
4. enemy HP/reward relation only when the first three cannot explain the bottleneck

The active expedition remains bound to the profile captured at start, and the previous profile must
remain immediately rollback-capable.

## 17. Commit and Release Boundary

The simulator implementation, tests, evidence and coupled docs form one cohesive diagnostic
checkpoint. Commit requires explicit approval after implementation and verification. Push, merge,
candidate seal, human observation, signing and publication remain separate approvals. Existing
`docs/evidence/qa/release-complete-core/candidates/` and `docs/evidence/toss/releases/` stay
untracked historical evidence and are never staged by a broad add command.
