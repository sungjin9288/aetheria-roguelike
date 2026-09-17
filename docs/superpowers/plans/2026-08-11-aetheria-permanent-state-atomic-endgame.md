# Aetheria Permanent State and Atomic Endgame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:test-driven-development` for every behavior change and `superpowers:executing-plans` or `superpowers:subagent-driven-development` task by task.

**Goal:** death, manual reset, ascension, save/reload를 통과해도 permanent player state가 한 authority로 보존되게 만들고, 원시의 파편 누적부터 마왕·진보스·True Ending까지를 기존 atomic combat reducer transaction 안에서 deterministic·idempotent하게 완결한다.

**Architecture:** 새 외부 endgame action을 만들지 않는다. `RESOLVE_COMBAT_ACTION`과 `USE_COMBAT_ITEM`이 이미 소유한 `settleVictory` transaction을 유지하고 그 마지막 단계에서 pure endgame resolver를 실행한다. Permanent state는 `pickPermanentPlayerState`가 단일 allowlist authority가 되고 death, `RESET_GAME`, `ASCEND`가 같은 patch를 사용한다. Legacy inventory shard는 migration에서 canonical `player.meta.endgame` ledger로 한 번만 이동한다.

**Tech Stack:** React 19, TypeScript 6, reducer-owned game state, Node test runner with tsx, GameStorage snapshot migration, Playwright integration

## Global Constraints

- Apps in Toss upload, Sandbox, review, public release and ad activation remain HOLD.
- EXP, loot, event probability and combat numbers are unchanged.
- Existing combat receipt and expected-turn authority stays intact.
- `build/`, `android/`, `ios/`, credentials and the historical Toss release directory are not edited or staged.
- No commit, push or publication occurs without separate explicit approval.
- Every task closes `RED → GREEN → focused integration`; the full repository gate runs after the complete slice.

## State Contract

Add to `src/types/player.ts`:

~~~ts
export interface EndgameProgress {
    version: 1;
    primalShards: number;
    legacyInventoryMigrated: boolean;
    lastEndgameReceiptKey: string | null;
    trueEndingSeen: boolean;
}
~~~

Add `endgame?: EndgameProgress` to `PlayerMeta`. `primalShards` is an integer in `0..BALANCE.PRIMAL_SHARD_REQUIRED`. A bounded latest endgame receipt covers Demon King and true-boss settlement while complementing the existing combat receipt without creating unbounded save growth.

Create `src/utils/permanentProgress.ts`:

~~~ts
export const pickPermanentPlayerState = (
    player: Player,
    initialPlayer: Player,
): PermanentPlayerPatch => { /* exact normalized allowlist */ };
~~~

The patch clones arrays/maps and never preserves run inventory/equipment, active expedition, current event, combat flags, area boss flags, quests, relics, HP/MP or location. Callers apply transition-specific name, gender, updated ascension meta, death count, Demon King count and starter loadout afterward.

---

### Task A1: Lock the Permanent-State Matrix with RED Tests

**Files:**
- Create: `tests/permanent-progress.test.js`
- Characterize: `tests/run-progress.test.js`
- Characterize: `tests/premium-cycle.test.js`
- Characterize: `tests/readability-mode-persistence.test.js`
- Characterize: `tests/class-journey.test.js`

- [ ] Build one canonical fixture with non-default meta/mirror, titles, premium assets, weekly/daily ledgers, permanent stats, class journey, settings, expedition sequence and return-supply receipts.
- [ ] Add run-only sentinels for inventory, equipment, quests, relics, active expedition, combat flags and area-boss flags.
- [ ] Run `CombatEngine.handleDefeat`, reducer `RESET_GAME`, and reducer `ASCEND` against the same fixture.
- [ ] Assert byte-equivalent preservation of every permanent field and exact reset of every run-only field.
- [ ] Mutate returned arrays/maps and assert the source player is unchanged.
- [ ] Verify RED:

~~~bash
node --import tsx --test tests/permanent-progress.test.js
~~~

Expected: failures for missing class journey/settings and absent shared picker.

---

### Task A2: Implement the Single Permanent-State Authority

**Files:**
- Create: `src/utils/permanentProgress.ts`
- Modify: `src/reducers/handlers/progressionHandlers.ts`
- Modify: `src/systems/CombatEngine.ts`
- Modify: `tests/permanent-progress.test.js`

- [ ] Move the permanent top-level/stat selections duplicated across reset/ascend/defeat into `pickPermanentPlayerState`.
- [ ] Normalize numeric counters, preserve nullable protocol fields, clone ledgers, and let each caller regenerate `currentRun`.
- [ ] Refactor `RESET_GAME` to start from `INITIAL_STATE`, apply the permanent patch, and then restore fresh-run values.
- [ ] Refactor `ASCEND` to apply the same patch, then override name/gender, newly calculated meta, prestige title and fresh current-run values. Preserve `demonKingSlain`; its increment moves to accepted Demon King settlement so cancel/confirm/replay cannot alter the kill count.
- [ ] Refactor defeat to apply the patch before first-death bonuses, `deaths + 1`, blank-name/starter-inventory policy and existing grave/story behavior.
- [ ] Keep `areaBossDefeated` and `mirrorReviveUsed` run-bound.
- [ ] Run GREEN:

~~~bash
node --import tsx --test \
  tests/permanent-progress.test.js \
  tests/run-progress.test.js \
  tests/premium-cycle.test.js \
  tests/boss-cycle.test.js \
  tests/codex-cycle.test.js \
  tests/signature-cycle.test.js \
  tests/milestone-story.test.js
~~~

Expected: all pass with no permanent asset loss or run-state leakage.

---

### Task A3: Add and Migrate the Canonical Endgame Ledger

**Files:**
- Modify: `src/types/player.ts`
- Modify: `src/reducers/gameReducer.ts`
- Modify: `src/utils/dataMigration.ts`
- Extend: `tests/data-migration.test.js`
- Extend: `tests/permanent-progress.test.js`

- [ ] Add RED vectors for a missing ledger, malformed version/count/receipt, and legacy inventory containing 0/1/2/3/10 primal shards.
- [ ] Assert migration removes only legacy shard items, preserves remaining inventory order/identity, clamps shard count, and is deep-equal on replay.
- [ ] Assert a modern save marked `legacyInventoryMigrated=true` does not import a later malformed legacy item.
- [ ] Seed `INITIAL_STATE.player.meta.endgame` as version 1, shard 0, migration complete, receipt null, true-ending false.
- [ ] Implement `normalizeEndgameProgress` and one-time legacy import.
- [ ] Run:

~~~bash
node --import tsx --test tests/data-migration.test.js tests/permanent-progress.test.js
~~~

Expected: migrate twice equals migrate once; no double import.

---

### Task A4: Replace Hook Multi-Dispatch with a Pure Endgame Resolver

**Files:**
- Create: `src/systems/endgameSettlement.ts`
- Modify: `src/reducers/handlers/combatHandlers.ts`
- Modify: `src/hooks/combatActions/combatVictory.ts`
- Modify: `src/hooks/combatActions/combatBossHandlers.ts`
- Modify: `src/data/messages.ts` only if canonical ledger copy requires it
- Create: `tests/endgame-settlement.test.js`

**Interface:**

~~~ts
export interface EndgameSettlementResult {
    player: Player;
    enemy: Monster | null;
    gameState: string;
    logs: Array<{ type: string; text: string }>;
    outcome: 'none' | 'ascension' | 'true_boss' | 'true_ending' | 'replay' | 'blocked';
}

export const resolveEndgameVictory = (input: {
    player: Player;
    deadEnemy: Monster;
    receiptKey: string;
    rng: () => number;
    now: number;
    monsterCatalog?: typeof DB.MONSTERS;
}): EndgameSettlementResult => { /* pure */ };
~~~

- [ ] Write RED seeded vectors for rank 0/1/3, shard 0/1/2/3, roll below/equal/above chance, duplicate receipt and missing/malformed true-boss data.
- [ ] Cover direct attack, skill, DoT and combat-item victory entry paths; endgame must not depend on `extendedChecks`.
- [ ] Assert the critical route: rank 3 + shard 2 + successful roll returns shard 0, canonical true boss and `GS.COMBAT` in the same reducer result.
- [ ] Implement post-roll count authority and validate true-boss multipliers before consuming shards.
- [ ] On malformed boss data, retain shards and return `blocked`; never create a partial enemy.
- [ ] Compute receipt key once as `${nextTurn}:${now}:${seed}` in `settleVictory`.
- [ ] Invoke the resolver after `handleVictoryOutcome` has produced the final draft player; apply player/enemy/gameState/logs to that same draft.
- [ ] Remove Demon King/true-boss multi-dispatch ownership from `combatVictory.ts`; retain non-endgame abyss helpers.
- [ ] Resolve true-boss victory in the same authority: one deterministic heart, `trueEndingSeen=true`, `GS.TRUE_ENDING`, accepted receipt.
- [ ] Verify:

~~~bash
node --import tsx --test \
  tests/endgame-settlement.test.js \
  tests/combat-action-transaction-authority.test.js \
  tests/boss-cycle.test.js \
  tests/loot-cycle.test.js \
  tests/expedition-ledger.test.js
~~~

Expected: all victory modes share one authority; replay and malformed-data vectors pass.

---

### Task A5: Make Ascension Idempotent Against Latest State

**Files:**
- Modify: `src/hooks/gameActions/ascensionActions.ts`
- Modify: `src/reducers/handlers/progressionHandlers.ts`
- Modify: `src/reducers/actionTypes.ts` only for a narrowed typed payload
- Extend: `tests/endgame-settlement.test.js`
- Extend: `tests/titles-cycle.test.js`

- [ ] Replace hook-calculated full meta payload with `expectedPrestigeRank` and accepted source receipt identity.
- [ ] Recalculate `getAscensionOutcome(state.player.meta)` in the reducer.
- [ ] Accept only matching latest state in `GS.ASCENSION` or `GS.TRUE_ENDING`.
- [ ] Assert rapid double confirm makes the second dispatch an exact object no-op.
- [ ] Move Demon King kill count to accepted victory settlement if current ASCEND ownership could double count.
- [ ] Preserve existing title, essence, mirror, season and premium assertions.

---

### Task A6: Prove Save/Reload and Transition Continuity

**Files:**
- Extend: `tests/endgame-settlement.test.js`
- Extend: `tests/local-game-snapshot.test.js`
- Extend: `tests/data-migration.test.js`

- [ ] Use the production GameStorage envelope to stage/reload a rank-3/two-shard checkpoint.
- [ ] Resolve Demon King victory, persist/reload, then branch through death, reset and ascend.
- [ ] Assert `save → reload → transition → save → reload` preserves endgame ledger, class journey and settings while run state resets.
- [ ] Save on True Ending, reload, execute New Game+ once, reload, and assert no second heart, shard refund, duplicate title, receipt or class-journey increment.
- [ ] Run the Plan A gate:

~~~bash
node --import tsx --test \
  tests/permanent-progress.test.js \
  tests/endgame-settlement.test.js \
  tests/data-migration.test.js \
  tests/local-game-snapshot.test.js
npx tsc --noEmit
npm run lint -- --quiet
git diff --check
~~~

## Plan A Acceptance Gate

- Death, reset and ascend share one permanent field authority.
- Class journey, settings, endgame ledger and existing permanent assets survive all transitions/reload.
- Rank 3 + shard 2 + successful drop reaches the true boss immediately.
- Direct/skill/DoT/combat-item victories cannot bypass endgame settlement.
- Duplicate receipt is an exact no-op; malformed boss data does not consume shards.
- No balance scalar or player-facing content changes.

## Rollback

- Revert Plan A source/tests as one unit; never leave migration without reducer readers.
- Because migration removes legacy inventory shards, any rollback build must continue reading `meta.endgame`.
- A failed permanent matrix requires reverting the picker refactor, not shipping field-by-field hotfixes.
- No superseded Toss artifact is reused after source changes.
