# Aetheria Combat Loot Capacity Settlement Design

Date: 2026-08-24 KST
Status: implementation verified on unstaged bytes; cohesive commit pending approval
Base checkpoint: `c129c2a41f1cb8287cc44cba487d4e719b16f20c`

## 1. Outcome

`processLoot()`가 만든 전투 전리품이 플레이어의 실제 가방 용량을 넘지 않도록 한다.
전리품 추첨 자체는 그대로 유지하되, 남은 공간 안에서 실제로 받은 아이템과 받지 못한
아이템을 한 번 분리한다. 이후 inventory, Codex, signature pity, combat digest와 build
hint는 모두 같은 `admitted` 집합만 사용한다.

이 변경은 `Progression Simulator v2`가 `capacityBlockedDrops`를 production behavior로
측정하기 위한 선행 조건이다. Simulator 안에서 별도의 가방 규칙을 만들지 않는다.

## 2. Current Defect

상점 구매, 장비 해제, 귀환 보급, 발견 보상은 `player.maxInv`와
`BALANCE.INV_MAX_SIZE`를 사용해 가방 용량을 지킨다. 그러나 전투 승리 경로의
`handleVictoryOutcome()`은 `processLoot()`가 반환한 모든 아이템을 다음과 같이 바로
추가한다.

```ts
inv: [...updatedPlayer.inv, ...lootResult.items]
```

이 때문에 전투 승리는 용량을 초과할 수 있다. 더 큰 문제는 rolled item과 실제 획득
item이 구분되지 않아 다음 결과도 함께 잘못될 수 있다는 점이다.

- 가방에 들어오지 못한 아이템이 Codex에 등록됨
- 받지 못한 signature가 pity를 reset함
- combat digest와 upgrade/trait hint가 받지 못한 아이템을 추천함
- 성공·prefix 로그가 실제 획득처럼 표시됨

`makeCombatActionMap().RESOLVE_COMBAT_ACTION`의 direct attack, skill, damage-over-time,
combat item 승리는 이미 `settleVictory() → handleVictoryOutcome()`으로 합쳐진다. 새로운
분기 settlement를 만들지 않고 이 공통 owner를 고친다.

## 3. Approaches Considered

### A. Stable signature-first capacity admission

전리품 roll 뒤 남은 공간을 계산한다. Signature candidate를 먼저, 일반 candidate를 뒤에
두되 각 그룹 안에서는 기존 roll 순서를 보존한다. 남은 공간만큼 `admitted`, 나머지는
`blocked`로 분리한다. 실제 지급과 모든 후속 소비자는 `admitted`만 본다.

이 방식을 채택한다. Rare reward를 가능한 한 보호하면서 save schema와 새 UI를 만들지
않고 기존 transaction 안에서 닫을 수 있다.

### B. Pending loot receipt

막힌 전리품을 save에 보관하고 공간이 생겼을 때 지급한다. 보상 손실은 없지만 새로운
player field, migration, restore, delivery UI와 중복 지급 방지가 필요하다. 리워드 광고의
pending receipt보다 다중 아이템·Codex·pity 결합이 복잡해진다. 이번 prerequisite에는
과도하므로 채택하지 않는다.

### C. Combat-only overflow 유지

전투 loot만 용량을 넘기고 상점과 다른 reward만 제한한다. 가방 확장의 의미와
`capacityBlockedDrops` 진단을 무너뜨린다. 채택하지 않는다.

## 4. Scope

### In scope

- production loot result에 item별 log provenance를 additive하게 제공
- 남은 `maxInv` 용량 기준의 stable signature-first admission
- admitted/blocked candidate의 단일 settlement result
- admitted item만 inventory, Codex, pity, digest와 hint에 반영
- blocked count를 알리는 한 번의 명확한 로그
- direct attack, skill, DOT와 combat-item victory의 동일 동작
- replay, stale action과 duplicate callback의 exact no-op 보존
- malformed legacy capacity의 기존 fallback 규칙 보존
- Progression Simulator v2 prerequisite 문서 동기화

### Out of scope

- drop chance, item table, signature chance 또는 pity multiplier 숫자 변경
- inventory 기본 크기 또는 premium 확장량 변경
- pending reward, mailbox, ground loot, item replacement UI
- save schema, migration 또는 runtime player field 추가
- 새 modal, menu, currency, dependency, telemetry event
- loot candidate를 다시 roll하거나 blocked item을 다른 보상으로 환산
- milestone 고정 item, endgame key item과 quest reward의 별도 delivery policy 변경
- Apps in Toss, 광고, IAP, signing, publication

## 5. Production Ownership

### 5.1 Candidate provenance

`src/systems/CombatEngine.loot.ts`가 item과 그 item 때문에 생긴 로그를 함께 소유한다.
기존 `items`와 `logs`는 compatibility를 위해 유지하되 새 `candidates`에서 파생한다.

```ts
export type LootLog = {
    type: string;
    text: string;
};

export type LootCandidate = {
    item: Item;
    logs: LootLog[];
};

export type LootResult = {
    candidates: LootCandidate[];
    items: Item[];
    logs: LootLog[];
};
```

`processLoot()` 내부의 각 성공 경로는 candidate 하나를 만든다. `items`는 candidate item
순서, `logs`는 candidate log 순서의 flatten 결과다. 기존 direct consumer의 결과와 RNG
호출 수는 byte-for-byte 의미가 같아야 한다.

문자열에서 item name을 찾아 log를 역추적하지 않는다. Blocked item의 `LOOT_GET`,
`LOOT_PREFIX`, prestige rare-drop log가 새 consumer로 흘러가지 않게 하려면 provenance가
필요하다.

### 5.2 Capacity admission

새 `src/systems/combatLootCapacity.ts`는 순수 함수 하나를 소유한다.

```ts
export type CombatLootAdmission = {
    capacity: number;
    occupied: number;
    available: number;
    admitted: LootCandidate[];
    blocked: LootCandidate[];
};

export const admitCombatLoot = (
    player: Player,
    candidates: readonly LootCandidate[],
): CombatLootAdmission;
```

Capacity는 다음 순서로 결정한다.

1. `player.maxInv`가 positive safe integer면 그 값을 사용
2. 아니면 positive safe integer인 `BALANCE.INV_MAX_SIZE` 사용
3. 둘 다 유효하지 않으면 `INVALID_INVENTORY_CAPACITY`를 mutation 전에 throw

`occupied`는 현재 inventory length이며 기존 save가 이미 capacity를 넘겼어도 item을
삭제하지 않는다. `available = max(0, capacity - occupied)`다.

Candidate는 두 stable group으로 나눈다.

1. `isSignatureItem(candidate.item) === true`
2. 나머지 candidate

두 그룹 안에서는 원래 index를 유지한다. Signature group 뒤에 normal group을 이어 붙인
순서에서 `available`개를 admitted로, 나머지를 blocked로 둔다. Candidate를 clone,
reroll, mutate하지 않는다. Input candidate가 없으면 새 empty admitted/blocked 배열을 가진
result를 돌려준다.

### 5.3 Victory settlement

`handleVictoryOutcome()`은 `processLoot()` 직후 admission을 한 번 계산한다. 이후 다음 값은
모두 같은 `admittedCandidates`에서 만든다.

- inventory에 추가할 items
- `registerLootToCodex()` 입력
- signature 획득 여부
- item acquisition과 prefix/prestige logs
- combat digest의 dropped item names
- upgrade hint와 trait hint

`blockedCandidates`의 개별 성공 로그는 출력하지 않는다. 하나 이상 막히면 새 message
authority를 통해 다음 summary만 한 번 기록한다.

```text
가방이 가득해 전리품 {count}개를 챙기지 못했습니다.
```

Blocked item의 상세 이름이나 prefix는 표시하지 않는다. Player가 받지 못한 build를
획득한 것처럼 인식하지 않게 하기 위함이다.

## 6. Signature Pity Semantics

Pity는 rolled signature가 아니라 실제 admitted signature를 기준으로 정산한다.

- admitted signature가 하나 이상이면 기존 pity가 0보다 클 때 `0`으로 reset
- boss kill이고 admitted signature가 없으면 pity를 정확히 `+1`
- rolled signature가 blocked돼도 boss miss로 보고 `+1`
- normal monster kill은 admitted/blocked와 관계없이 pity 불변

Signature-first admission은 공간이 한 칸이라도 있으면 signature를 일반 loot보다 먼저
보호한다. 가방이 이미 가득 찬 경우에는 새 item을 밀어내지 않고 pity 보호만 이어간다.

## 7. Logs, Codex and Hints

Log order는 admitted candidate order와 동일하다. 각 candidate의 내부 log order도
`processLoot()`가 만든 순서를 보존한다. Blocked summary는 admitted acquisition logs 뒤,
combat digest 전에 한 번 추가한다.

Codex는 admitted item만 등록한다. `countNewCodexEntries()`와 season XP도 admitted 결과만
반영한다. Blocked signature나 equipment는 Codex discovery, upgrade hint, trait hint,
post-combat item list에 나타나지 않는다.

이 contract는 player가 실제로 받은 것과 화면·성장 기록이 같은 사실을 말하게 한다.

## 8. Transaction and Replay Safety

Admission은 reducer settlement의 local draft 안에서 한 번 수행한다. 별도 dispatch,
async callback 또는 receipt를 추가하지 않는다.

기존 combat receipt와 expected-turn check를 그대로 사용한다.

- 같은 victory action replay는 exact state object no-op
- stale expected turn은 loot roll과 admission 전에 no-op
- DOT와 combat item victory도 같은 `settleVictory()`를 통과
- admission 도중 validation error가 나면 inventory, Codex, pity, logs와 receipt가 모두
  mutation되기 전에 fail closed

RNG 호출은 `processLoot()`만 소유한다. Admission은 random을 받지 않고 호출하지 않는다.

## 9. File Boundary

Expected implementation paths:

- Modify: `src/systems/CombatEngine.loot.ts`
- Create: `src/systems/combatLootCapacity.ts`
- Modify: `src/hooks/combatActions/combatVictory.ts`
- Modify: `src/data/messages.ts`
- Create: `tests/combat-loot-capacity-authority.test.js`
- Modify: `tests/combat-engine-loot.test.js`
- Modify: `tests/loot-cycle.test.js`
- Modify only when an existing convergence assertion needs extension:
  `tests/combat-action-transaction-authority.test.js`
- Modify only when an existing DOT/item assertion needs extension:
  `tests/combat-item-transaction-authority.test.js`
- Modify: `docs/evidence/qa/release-complete-core/requirement-matrix.md`
- Modify: `docs/evidence/qa/release-complete-core/completion-summary.md`
- Modify: `tasks/todo.md`
- Modify: `progress.md`

`src/reducers/handlers/combatHandlers.ts` is read-only unless a RED test proves that an existing
victory route bypasses `settleVictory()`. Such evidence is a material plan gap and returns to Sol
xhigh re-plan.

## 10. TDD Contract

### Slice 1: provenance RED

Test existing enriched, legacy, high-level bonus and prestige drop paths. Require every item to have
one candidate, candidate flattening to reproduce exact `items` and `logs`, identical RNG call count,
deterministic item IDs and unchanged direct `processLoot()` behavior.

### Slice 2: admission RED

Require empty, partial, full, custom expanded and already-overflowed inventories. Cover zero, one and
multiple candidates, stable signature-first ordering, stable order within groups, input immutability,
malformed capacity fallback and invalid global capacity fail-closed behavior.

### Slice 3: settlement RED

Force multiple deterministic drops into limited space. Prove admitted-only inventory, Codex, season
XP, acquisition logs, digest, upgrade hint and trait hint. Prove blocked summary count and absence of
blocked item names or prefix logs.

### Slice 4: pity and replay RED

Cover admitted signature reset, blocked signature boss increment, boss without signature increment,
normal monster invariance, direct/skill/DOT/combat-item victory convergence, same-action replay and
stale-turn exact no-op.

Every RED must fail for the missing behavior, not for import, fixture or syntax errors. Production
code starts only after the covering RED output is recorded.

## 11. Acceptance Criteria

- Admitted `processLoot()` items never increase inventory length beyond valid capacity.
- Existing over-cap legacy inventory is preserved but receives no new combat loot.
- Signature candidates are admitted before normal candidates when space is limited.
- Original order is preserved inside signature and normal groups.
- Only admitted items enter inventory, Codex, season XP, acquisition logs, digest and hints.
- Blocked items produce one count-only inventory-full summary and no success/prefix/prestige log.
- Boss pity resets only for an admitted signature; blocked signature increments pity as a miss.
- `processLoot()` chance, RNG consumption, rolled candidates and old aggregate outputs remain stable.
- Direct, skill, DOT and combat-item victory share the same settlement behavior.
- Replay and stale actions remain exact no-op.
- No save schema, migration, UI, dependency or balance number changes.
- Historical observation and Toss evidence bytes remain unchanged.

## 12. Verification

Focused:

```bash
node --import tsx --test tests/loot-cycle.test.js tests/combat-loot-capacity-authority.test.js tests/combat-engine-loot.test.js tests/combat-action-transaction-authority.test.js tests/combat-item-transaction-authority.test.js
npx tsc --noEmit
npm run lint
git diff --check
```

Cross-surface:

```bash
npm run relic:drop-rate:verify
npm run relic:event-chance:verify
npm run event-reward:verify
npm run progression:simulate -- --seed 20260824
npm run progression:compare -- \
  --axis loot \
  --multiplier 1.2 \
  --candidate-id combat-loot-capacity-audit \
  --candidate-version 2 \
  --seed-start 20260824 \
  --seed-count 1000
npm run verify
npm run verify:full
npm run art:verify
npm run mobile:doctor
npm run cap:sync
git status --short -- android ios
```

The comparison candidate is ephemeral and unregistered. Its report must remain
`classification: report-only` with `activationReady:false`; the only expected blockers are
`production_funnel_evidence_missing` and `full_combat_model_unavailable`. It does not activate or
persist a gameplay profile.

No new screenshot is required because the blocked state uses the existing combat log surface and no
layout is added. A focused 390×844 browser assertion is required only if the implementation changes
player-visible component markup rather than the existing message data.

## 13. Evidence and Ledger

The implementation checkpoint records:

- pre-fix full-inventory reproduction
- RED and GREEN focused commands
- admitted/blocked/pity/replay scenario counts
- `processLoot()` deterministic compatibility result
- full gate and native-sync result
- exact touched paths and historical evidence hashes

No new candidate identity or human observation count is assigned until implementation is committed,
post-commit verification passes and the separate candidate seal is approved.

## 14. Rollback and Recovery

The prerequisite is one cohesive gameplay correctness checkpoint. If implementation cannot preserve
loot RNG and aggregate compatibility, stop before evidence refresh and return to Sol xhigh re-plan.

Rollback restores the implementation paths and coupled docs together. It does not rewrite saves or
remove items from existing over-cap inventories. Commit, push, signing, publication, evidence refresh
and candidate seal remain separate approval boundaries.

## 15. Progression Simulator v2 Dependency

`Progression Simulator v2` must not implement `capacityBlockedDrops` until this prerequisite is
implemented, verified and committed. After that checkpoint:

1. refresh the v2 plan base HEAD and source manifest
2. use `admitCombatLoot()` only through production victory settlement
3. count blocked candidates from production state transition evidence
4. keep simulator-side inventory caps and mirrored loot formulas at zero

The v2 reward, combat, loot/pity and exploration diagnostic architecture otherwise remains unchanged.

Fixed milestone items and endgame key items are not part of `capacityBlockedDrops`. Their delivery
policy remains a separately visible follow-up risk and must not be silently folded into this metric.
