# Aetheria Content Pacing and Encounter Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that every canonical gameplay catalog has a production route, reduce exploration decision density without changing EXP or loot, and add four replay-safe early-region encounters through the existing event UI.

**Architecture:** Add one read-only reachability report, one deterministic optional-decision rhythm simulator, and a small spacing predicate around the existing exploration state. Register one immutable event-axis profile, then replace accepted general narrative slots with existing bounded encounter data and settle choices through a reducer-owned receipt transaction. Preserve mandatory story and boss decisions, current fallback generation, active-expedition profile snapshots, and every Apps in Toss approval boundary.

**Tech Stack:** React 19, TypeScript, Vite, Node test runner, seeded domain RNG, existing game reducer, Playwright, Capacitor

## Global Constraints

- Apps in Toss review, upload, publication, advertising, and IAP remain HOLD.
- Change only the event axis: `expMultiplier=1`, `lootMultiplier=1`, `eventMultiplier=0.8`.
- Change `BALANCE.SCOUT_CHANCE` from `0.25` to `0.15`; keep `BALANCE.CAMPFIRE_CHANCE=0.08`.
- Optional decision surfaces are campfire, scout, general narrative, and bounded encounter.
- Mandatory story chain and boss challenge ignore optional spacing.
- An optional decision requires at least one preceding non-narrative explore outcome.
- Bounded encounters replace accepted general narrative slots and add no occurrence roll.
- Author exactly four families: two for `고요한 숲`, two for `서쪽 평원`, with one unconditional family in each region.
- Add no region, monster, boss, item, currency, top-level menu, runtime AI provider, or dependency.
- Preserve existing save migration and active-expedition profile locking.
- Use direct names, short pure functions, and natural control flow. Do not introduce a generic content engine or configurable rules framework.
- Keep validation, receipts, evidence, and task history explicit.
- GPT B may edit only the writable paths in the Goal Manifest. GPT A owns ledger synchronization, commit, push, and final verification.
- Never stage `build/`, generated native drift, raw observation exports, secrets, or `docs/evidence/toss/releases/`.

---

## File Responsibility Map

### New files

- `src/systems/contentReachability.ts`: canonical map, monster, quest, job, equipment, and signature route report.
- `scripts/verify-content-reachability.mjs`: deterministic report envelope writer/verifier.
- `tests/content-reachability.test.js`: exact counts, mutation failures, determinism, and no-write verification.
- `docs/evidence/qa/release-complete-core/content-reachability.json`: tracked canonical report envelope.
- `src/systems/explorationRhythmSimulator.ts`: seeded optional-decision gap model using production pacing functions.
- `scripts/compare-exploration-rhythm.mjs`: fixed-seed baseline/candidate report envelope.
- `tests/exploration-rhythm.test.js`: spacing, direction, invariant, and CLI contract.
- `docs/evidence/qa/release-complete-core/exploration-rhythm.json`: tracked 64-seed comparison envelope.
- `src/utils/boundedEncounterEvent.ts`: converts canonical encounters into the existing event surface shape.
- `src/reducers/handlers/boundedEncounterHandlers.ts`: current-state receipt validation and atomic settlement.
- `tests/bounded-encounter-integration.test.js`: explore selection, reducer replay, failure, and fallback integration.
- `tests/e2e/content-pacing-encounters.spec.ts`: three-viewport player-facing encounter flow.

### Modified files

- `package.json`: content/rhythm verification scripts and unit-test discovery only.
- `src/data/constants.ts`: scout chance only.
- `src/data/progressionProfiles.ts`: immutable candidate and registry entry.
- `src/reducers/gameReducer.ts`: candidate default reference and bounded action map.
- `src/utils/explorationPacing.ts`: optional-decision predicate.
- `src/hooks/gameActions/exploreActions.ts`: spacing gates and bounded selection after accepted narrative roll.
- `src/hooks/gameActions/eventActions.ts`: dispatch bounded settlement action without applying rewards in the hook.
- `src/reducers/actionTypes.ts`: typed bounded settlement payload and action constant.
- `src/types/encounter.ts`: event and settlement payload types.
- `src/data/boundedEncounters.ts`: enable and author the four canonical families.
- `src/utils/boundedEncounterSelector.ts`: unconditional-family validation, player context, replay-aware selection.
- `src/utils/signatureDiscovery.ts`: canonical discovered-signature name list.
- `src/utils/eventPresentation.ts`: bounded panel title and exact trade-off preview.
- `src/components/EventPanel.tsx`: no structural rewrite; consume existing preview contract.
- `src/hooks/useGameTestApi.ts`: production-derived bounded event fixture only.
- `tests/bounded-encounters.test.js`: production pack and context coverage.
- `tests/event-choice-presentation.test.js`: bounded copy and preview coverage.
- `tests/progression-profile.test.js`: candidate default, snapshot, and rollback coverage.
- `tests/progression-comparison.test.js`: exact candidate identity flags and 0.8 event direction.
- `scripts/compare-progression.mjs`: explicit candidate ID/version flags.

### GPT A-only close-out paths

GPT B must not edit these paths because the main worktree already contains observation work:

- `tasks/todo.md`
- `progress.md`
- `docs/evidence/qa/release-complete-core/completion-summary.md`
- `docs/evidence/qa/release-complete-core/observation-summary.json`
- `docs/evidence/qa/release-complete-core/requirement-matrix.md`

GPT A updates them only after importing and verifying the execution result.

---

## Task 1: Build the Canonical Content Reachability Report

**Commit group:** 1 of 3 — content reachability and baseline measurement

**Files:**

- Create: `src/systems/contentReachability.ts`
- Create: `scripts/verify-content-reachability.mjs`
- Create: `tests/content-reachability.test.js`
- Create: `docs/evidence/qa/release-complete-core/content-reachability.json`
- Modify: `package.json`

**Interfaces:**

- Consumes: `DB.MAPS`, `DB.MONSTERS`, `DB.QUESTS`, `DB.CLASSES`, `DB.ITEMS`, `getShopCatalog`, `DROP_TABLES`, `LOOT_TABLE`, `getAllSignatureDropSourceIndex`, `simulateProgression`.
- Produces:

```ts
export type AcquisitionRouteKind =
    | 'shop'
    | 'drop_table'
    | 'legacy_loot'
    | 'quest_reward'
    | 'high_level_bonus';

export interface ContentReachabilityReport {
    schemaVersion: 1;
    catalog: {
        maps: 52;
        monsters: 254;
        quests: 143;
        jobs: 18;
        equipment: 229;
        signatures: 25;
    };
    maps: {
        start: string;
        reachable: string[];
        unreachable: string[];
        invalidExits: string[];
    };
    monsters: {
        reachable: string[];
        missingRoutes: string[];
        routes: Array<{ name: string; regions: string[] }>;
    };
    quests: {
        reachable: Array<string | number>;
        invalidPrerequisites: Array<string | number>;
        prerequisiteCycles: Array<Array<string | number>>;
        unreachableTargets: Array<string | number>;
        invalidRewards: Array<string | number>;
    };
    jobs: {
        reachable: string[];
        unreachable: string[];
        terminalLineages: string[][];
        checkpointLevels: number[];
    };
    equipment: {
        routes: Array<{
            name: string;
            tier: number;
            kinds: AcquisitionRouteKind[];
            sources: string[];
        }>;
        missingRoutes: string[];
        prematureEquipCount: number;
    };
    signatures: {
        routes: Array<{ name: string; monsters: string[] }>;
        missingDropRoutes: string[];
    };
    errors: string[];
}

export const buildContentReachabilityReport = (): Readonly<ContentReachabilityReport>;
```

- CLI output:

```ts
interface ContentReachabilityEnvelope {
    hashAlgorithm: 'sha256';
    reportHash: string;
    report: ContentReachabilityReport;
}
```

- [ ] **Step 1: Write the count, route, and deterministic-envelope RED tests**

The first test must assert all exact catalog counts and empty error arrays:

```js
const report = buildContentReachabilityReport();

assert.deepEqual(report.catalog, {
    maps: 52,
    monsters: 254,
    quests: 143,
    jobs: 18,
    equipment: 229,
    signatures: 25,
});
assert.equal(report.maps.reachable.length, 52);
assert.deepEqual(report.maps.unreachable, []);
assert.equal(report.monsters.reachable.length, 254);
assert.deepEqual(report.monsters.missingRoutes, []);
assert.deepEqual(report.quests.invalidPrerequisites, []);
assert.deepEqual(report.quests.prerequisiteCycles, []);
assert.deepEqual(report.quests.unreachableTargets, []);
assert.deepEqual(report.quests.invalidRewards, []);
assert.equal(report.jobs.reachable.length, 18);
assert.equal(report.jobs.terminalLineages.length, 8);
assert.equal(report.equipment.routes.length, 229);
assert.deepEqual(report.equipment.missingRoutes, []);
assert.equal(report.equipment.prematureEquipCount, 0);
assert.equal(report.signatures.routes.length, 25);
assert.deepEqual(report.signatures.missingDropRoutes, []);
assert.deepEqual(report.errors, []);
```

Add mutation tests that temporarily introduce and restore each defect:

- a map exit named `없는 지역`
- a canonical monster removed from every map/boss route
- a quest prerequisite pointing to `없는 퀘스트`
- a two-quest prerequisite cycle
- a quest monster target removed from its region
- an equipment item hidden from every safe-map shop and every drop/reward route
- one signature removed from its drop source index fixture
- malformed class or equipment gate that makes `simulateProgression` fail

- [ ] **Step 2: Run the RED test**

Run:

```bash
node --import tsx --test tests/content-reachability.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/systems/contentReachability.ts`.

- [ ] **Step 3: Implement stable map, monster, and quest graph traversal**

Use sorted adjacency and a first-in/first-out queue:

```ts
const reachableFrom = (start: string, exitsByMap: Map<string, string[]>) => {
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || seen.has(current)) continue;
        seen.add(current);
        for (const next of exitsByMap.get(current) || []) {
            if (!seen.has(next)) queue.push(next);
        }
    }
    return [...seen].sort((left, right) => left.localeCompare(right));
};
```

Build monster routes from `map.monsters`, `map.bossMonsters`, and `map.boss`. Keep hidden production bosses explicit in a named immutable list matching `spawnEnemy`; do not silently treat every catalog monster as reachable.

Build quest prerequisite ownership by exact quest ID. Detect cycles with `visiting` and `visited` sets, and return the canonical cycle path rather than throwing on the first record.

- [ ] **Step 4: Implement equipment and signature route classification**

For every safe map, collect `getShopCatalog(location)`. Scan `DROP_TABLES`, `LOOT_TABLE`, and quest `reward.item`. Add `high_level_bonus` only to tier 4–6 equipment because the production bonus pool selects those tiers.

For signatures, require at least one source from `getAllSignatureDropSourceIndex()` even if the item also appears in a shop catalog.

Use `simulateProgression({ seed: 20_260_810 })` for job reachability, terminal lineage coverage, checkpoints, and premature-equipment authority rather than reimplementing class transition rules.

- [ ] **Step 5: Implement the exact writer/verifier CLI**

Supported forms:

```bash
node --import tsx scripts/verify-content-reachability.mjs --write docs/evidence/qa/release-complete-core/content-reachability.json
node --import tsx scripts/verify-content-reachability.mjs --verify docs/evidence/qa/release-complete-core/content-reachability.json
```

Rules:

- accept exactly one of `--write` or `--verify`
- require a repository-relative `.json` path under `docs/evidence/qa/release-complete-core/`
- reject absolute paths, backslashes, `.` and `..` segments
- write canonical `JSON.stringify(envelope, null, 2) + '\n'`
- `--verify` compares bytes and exits 1 on stale or malformed evidence
- write nothing if `report.errors` is nonempty
- print only the compact envelope to stdout on success

- [ ] **Step 6: Generate and verify the tracked report**

Run:

```bash
node --import tsx scripts/verify-content-reachability.mjs \
  --write docs/evidence/qa/release-complete-core/content-reachability.json
node --import tsx scripts/verify-content-reachability.mjs \
  --verify docs/evidence/qa/release-complete-core/content-reachability.json
```

Add to `package.json`:

```json
"content:verify": "node --import tsx scripts/verify-content-reachability.mjs --verify docs/evidence/qa/release-complete-core/content-reachability.json"
```

- [ ] **Step 7: Run focused integration**

```bash
node --import tsx --test tests/content-reachability.test.js tests/quests-cycle.test.js tests/signature-drop-sources.test.js tests/progression-simulator.test.js
npm run content:verify
npx tsc --noEmit
npx eslint src/systems/contentReachability.ts scripts/verify-content-reachability.mjs tests/content-reachability.test.js --quiet
git diff --check
```

Expected: all pass, report errors empty, and no unrelated path modified.

---

## Task 2: Establish the Optional-Decision Rhythm Baseline

**Commit group:** 1 of 3 — content reachability and baseline measurement

**Files:**

- Create: `src/systems/explorationRhythmSimulator.ts`
- Create: `scripts/compare-exploration-rhythm.mjs`
- Create: `tests/exploration-rhythm.test.js`
- Create: `docs/evidence/qa/release-complete-core/exploration-rhythm.json`
- Modify: `package.json`

**Interfaces:**

```ts
export interface ExplorationRhythmPolicy {
    id: 'baseline' | 'exploration-rhythm';
    version: 1 | 2;
    campfireChance: number;
    scoutChance: number;
    eventMultiplier: number;
    minimumOrdinaryGap: 0 | 1;
}

export const BASELINE_EXPLORATION_RHYTHM: Readonly<ExplorationRhythmPolicy>;
export const CANDIDATE_EXPLORATION_RHYTHM: Readonly<ExplorationRhythmPolicy>;

export interface ExplorationRhythmAggregate {
    campfire: number;
    scout: number;
    generalNarrative: number;
    boundedEncounter: {
        classification: 'subset-of-general-narrative';
        countAuthority: 'production-integration';
    };
    combat: number;
    discovery: number;
    nothing: number;
    optionalDecisionCount: number;
    optionalBackToBackCount: number;
    optionalGap: { p10: number; p50: number; p90: number };
    mandatoryStory: { classification: 'correctness-only' };
    bossChallenge: { classification: 'correctness-only' };
}

export interface ExplorationRhythmComparison {
    schemaVersion: 1;
    classification: 'rank0-no-mirror-proxy';
    actualPlayClaim: false;
    seeds: number[];
    opportunitiesPerSeed: 4096;
    predecessor: ExplorationRhythmAggregate;
    candidate: ExplorationRhythmAggregate;
    gates: {
        noOptionalBackToBack: boolean;
        candidateMedianGapInRange: boolean;
        eventDirectionMatched: boolean;
        expLootInvariant: true;
    };
    blockers: string[];
}

export const compareExplorationRhythm = (
    seeds: readonly number[],
): Readonly<ExplorationRhythmComparison>;
```

`ExplorationRhythmAggregate` records campfire, scout, general narrative, combat, discovery, and nothing plus optional gap p10/p50/p90 and back-to-back count. Bounded encounter count is marked as a subset of accepted general narrative until production integration exists. Mandatory story and boss are listed as `correctness-only` because their frequency depends on story progress and boss gauge; Tasks 4 and 7 prove their production priority.

- [ ] **Step 1: Write RED tests for the approved policies and gates**

```js
assert.deepEqual(BASELINE_EXPLORATION_RHYTHM, {
    id: 'baseline',
    version: 1,
    campfireChance: 0.08,
    scoutChance: 0.25,
    eventMultiplier: 1,
    minimumOrdinaryGap: 0,
});
assert.deepEqual(CANDIDATE_EXPLORATION_RHYTHM, {
    id: 'exploration-rhythm',
    version: 2,
    campfireChance: 0.08,
    scoutChance: 0.15,
    eventMultiplier: 0.8,
    minimumOrdinaryGap: 1,
});

const report = compareExplorationRhythm([11, 23, 37, 53]);
assert.equal(report.gates.noOptionalBackToBack, true);
assert.equal(report.gates.candidateMedianGapInRange, true);
assert.equal(report.candidate.optionalGap.p50 >= 4, true);
assert.equal(report.candidate.optionalGap.p50 <= 5, true);
assert.equal(report.candidate.optionalBackToBackCount, 0);
assert.equal(report.candidate.generalNarrative < report.predecessor.generalNarrative, true);
assert.equal(report.candidate.scout < report.predecessor.scout, true);
assert.equal(report.gates.expLootInvariant, true);
```

Add invalid-seed, duplicate uint32 seed, malformed policy, NaN chance, and candidate direction mutation tests.

- [ ] **Step 2: Run the RED test**

```bash
node --import tsx --test tests/exploration-rhythm.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/systems/explorationRhythmSimulator.ts`.

- [ ] **Step 3: Implement the seeded rank-0/no-mirror proxy**

Cycle through sorted non-safe maps. For each opportunity, create one domain RNG and consume it in production priority order: campfire, scout, narrative, quiet, discovery, pre-combat relic, combat. Use `getNarrativeEventChance`, `getDiscoveryOdds`, and `advanceExploreState`; do not duplicate their formulas. The proxy uses a rank-0 player with no mirror upgrades, tracks discovered relic slots up to the production rank-0 cap, and has no key item.

```ts
const optionalAllowed = policy.minimumOrdinaryGap === 0
    || currentState.sinceNarrativeEvent >= policy.minimumOrdinaryGap;

let outcome:
    | 'campfire'
    | 'scout'
    | 'general_narrative'
    | 'combat'
    | 'discovery'
    | 'nothing' = 'combat';
if (optionalAllowed && map.type === 'dungeon' && rng() < policy.campfireChance) {
    outcome = 'campfire';
} else if (optionalAllowed && rng() < policy.scoutChance) {
    outcome = 'scout';
} else if (optionalAllowed && rng() < narrativeChance) {
    outcome = 'general_narrative';
} else if (rng() < discoveryOdds.quietChance) {
    outcome = rng() < discoveryOdds.anomalyChance
        || relicSlotsAvailable && rng() < discoveryOdds.relicChance
        ? 'discovery'
        : 'nothing';
} else if (relicSlotsAvailable && rng() < BALANCE.RELIC_FIND_CHANCE * 0.5) {
    outcome = 'discovery';
}

currentState = advanceExploreState(
    { exploreState: currentState },
    outcome === 'campfire' || outcome === 'scout' || outcome === 'general_narrative'
        ? 'narrative_event'
        : outcome === 'discovery'
            ? 'relic_found'
            : outcome,
);
```

The report must state that discovery combines anomaly, relic, and key-event presentation and that actual combat outcome, player choice, and time remain outside this proxy. Existing progression/combat reports and real-surface tests remain those authorities.

- [ ] **Step 4: Implement deterministic quantiles and the CLI**

The CLI accepts only:

```bash
node --import tsx scripts/compare-exploration-rhythm.mjs \
  --seed-start 20260810 \
  --seed-count 64 \
  --write docs/evidence/qa/release-complete-core/exploration-rhythm.json
```

Also support `--verify` with the same safe path contract as Task 1. Seed count is 2–1000 and the final seed must remain within uint32.

- [ ] **Step 5: Generate and verify the 64-seed report**

Add:

```json
"pacing:verify": "node --import tsx scripts/compare-exploration-rhythm.mjs --seed-start 20260810 --seed-count 64 --verify docs/evidence/qa/release-complete-core/exploration-rhythm.json"
```

Run writer then `npm run pacing:verify`. The tracked report must have all four gates true and no blocker.

- [ ] **Step 6: Commit group 1**

Before staging:

```bash
git diff --check
git status --short
```

Stage only Task 1–2 paths. Commit subject:

```text
test: 콘텐츠 도달성과 탐험 리듬 기준 고정 and deterministic gameplay audit 추가
```

The body must describe what, why, implementation, impact, and exact focused checks in Korean with English technical terms. Do not push.

---

## Task 3: Gate Optional Decisions and Register the Event Profile

**Commit group:** 2 of 3 — exploration rhythm and event profile

**Files:**

- Modify: `src/utils/explorationPacing.ts:1-212`
- Modify: `src/hooks/gameActions/exploreActions.ts:1-182`
- Modify: `src/data/constants.ts:330,344`
- Modify: `src/data/progressionProfiles.ts`
- Modify: `src/reducers/gameReducer.ts:70-145`
- Modify: `tests/explore-scouting.test.js`
- Modify: `tests/progression-profile.test.js`
- Modify: `tests/exploration-rhythm.test.js`

**Interfaces:**

```ts
export const canOfferOptionalExploreDecision = (stats: unknown): boolean;

export const EXPLORATION_RHYTHM_PROFILE: Readonly<ProgressionProfile>;
```

- [ ] **Step 1: Write RED spacing and mandatory-priority tests**

Add direct predicate tests:

```js
assert.equal(canOfferOptionalExploreDecision({ exploreState: { sinceNarrativeEvent: 0 } }), false);
assert.equal(canOfferOptionalExploreDecision({ exploreState: { sinceNarrativeEvent: 1 } }), true);
assert.equal(canOfferOptionalExploreDecision({}), false);
```

Add action-level tests with injected RNG:

- fresh/zero-gap state does not call campfire, scout, or narrative rolls and reaches ordinary flow
- one ordinary outcome enables the next optional roll
- a mandatory chain appears with zero gap
- a full boss gauge appears with zero gap
- candidate scout rate is the literal `0.15`
- campfire remains `0.08`

Count injected RNG draws so skipped optional rolls cannot consume hidden random values.

- [ ] **Step 2: Run RED tests**

```bash
node --import tsx --test tests/exploration-rhythm.test.js tests/explore-scouting.test.js tests/progression-profile.test.js
```

Expected failures: missing predicate, old scout chance, baseline default profile, and optional rolls occurring at gap zero.

- [ ] **Step 3: Add the pure spacing predicate**

Export a single direct rule from `explorationPacing.ts`:

```ts
export const canOfferOptionalExploreDecision = (stats: any) => (
    getExploreState(stats).sinceNarrativeEvent >= 1
);
```

Do not add another counter, timestamp, cooldown record, or migration field.

- [ ] **Step 4: Apply the rule in production priority order**

In `createExploreActions.explore`:

1. keep story chain first and ungated
2. compute `optionalDecisionAllowed`
3. roll campfire only when allowed
4. keep boss challenge next and ungated
5. roll scout only when allowed
6. pass `optionalDecisionAllowed` to `runExplorePostDecisionRoll`
7. inside the post-decision function, roll general narrative only when allowed
8. if not allowed, enter `runQuietRollAndCombat` without consuming the narrative roll

The code should read as the ordered game rule; remove stale comments that claim campfire/scout always raise decision density, but do not rewrite unrelated comments.

- [ ] **Step 5: Register and activate the immutable event profile**

In `progressionProfiles.ts`:

```ts
export const EXPLORATION_RHYTHM_PROFILE: Readonly<ProgressionProfile> = Object.freeze({
    id: 'exploration-rhythm',
    version: 2,
    expMultiplier: 1,
    lootMultiplier: 1,
    eventMultiplier: 0.8,
});
```

Add `'exploration-rhythm@2'` to the frozen registry. Change only `INITIAL_STATE.liveConfig.progressionProfile` to `{ id: 'exploration-rhythm', version: 2 }`; leave legacy `liveConfig.eventMultiplier` at `1` because it controls combat EXP and is not this profile field.

Add tests proving:

- candidate transition from baseline is exactly `{ok:true, changedAxis:'event'}`
- default new expedition snapshots the candidate when started through `moveActions`
- active baseline expedition ignores the pointer flip
- active candidate expedition survives HP tracking and finish/reload
- changing the pointer back to baseline affects only the next expedition
- missing/unknown candidate reference resolves to baseline

- [ ] **Step 6: Re-run focused integration**

```bash
node --import tsx --test \
  tests/exploration-rhythm.test.js \
  tests/explore-scouting.test.js \
  tests/progression-profile.test.js \
  tests/progression-comparison.test.js \
  tests/progression-simulator.test.js \
  tests/ai-event-utils.test.js \
  tests/explore-action-seed.test.js
npx tsc --noEmit
npx eslint src/utils/explorationPacing.ts src/hooks/gameActions/exploreActions.ts src/data/progressionProfiles.ts tests/exploration-rhythm.test.js --quiet
git diff --check
```

Expected: all green; no EXP/loot assertion changes.

---

## Task 4: Bind the Registered Candidate to Statistical Evidence

**Commit group:** 2 of 3 — exploration rhythm and event profile

**Files:**

- Modify: `scripts/compare-progression.mjs`
- Modify: `tests/progression-comparison.test.js`
- Modify: `docs/evidence/qa/release-complete-core/exploration-rhythm.json`

**Interfaces:**

`compare-progression.mjs` gains required explicit candidate identity flags for evidence runs:

```text
--candidate-id exploration-rhythm
--candidate-version 2
```

- [ ] **Step 1: Add RED CLI identity tests**

The exact command:

```bash
node --import tsx scripts/compare-progression.mjs \
  --axis event \
  --multiplier 0.8 \
  --candidate-id exploration-rhythm \
  --candidate-version 2 \
  --seed-start 20260810 \
  --seed-count 2
```

must emit `candidateProfile` byte-equal to `EXPLORATION_RHYTHM_PROFILE`. Reject missing ID/version, unsafe ID, version other than predecessor+1, zero-axis, and multi-axis candidates before seed simulation.

- [ ] **Step 2: Implement strict flags without changing existing axis math**

Use the same safe ID expression as profile normalization and `parseInteger` for version. Do not add arbitrary JSON profile input.

- [ ] **Step 3: Run 64-seed and 1000-seed reports**

Focused evidence:

```bash
npm run progression:compare -- \
  --axis event \
  --multiplier 0.8 \
  --candidate-id exploration-rhythm \
  --candidate-version 2 \
  --seed-start 20260810 \
  --seed-count 64
```

Full statistical gate:

```bash
npm run progression:compare -- \
  --axis event \
  --multiplier 0.8 \
  --candidate-id exploration-rhythm \
  --candidate-version 2 \
  --seed-start 20260810 \
  --seed-count 1000
```

Both must report:

- `gates.profileTransition=true`
- `gates.hardCorrectness=true`
- `gates.targetMetricDirection.matched=true`
- `correctness.combatMatrixTruncatedCount=0`
- `activationReady=false`
- blockers limited to production funnel and full combat model

Record both hashes in the tracked rhythm evidence while keeping actual play time explicitly unavailable.

- [ ] **Step 4: Commit group 2**

Stage only Task 3–4 paths and their coupled evidence. Commit subject:

```text
feat: 탐험 선택 간격과 이벤트 빈도 조정 and expedition profile locking 적용
```

Do not push.

---

## Task 5: Author and Validate the Four Early-Region Encounters

**Commit group:** 3 of 3 — encounter content, runtime integration, and evidence

**Files:**

- Modify: `src/types/encounter.ts`
- Modify: `src/data/boundedEncounters.ts`
- Modify: `src/utils/boundedEncounterSelector.ts`
- Modify: `src/utils/signatureDiscovery.ts`
- Modify: `tests/bounded-encounters.test.js`

**Interfaces:**

```ts
export const getDiscoveredSignatureNames = (player: Player): string[];

export const buildBoundedEncounterContext = (
    player: Player,
    region: string,
): BoundedEncounterContext;

export const selectBoundedEncounter = (
    encounters: readonly BoundedEncounter[],
    context: BoundedEncounterContext,
    receipt: { expeditionId: string; occurrenceSequence: number },
    rng: () => number,
): BoundedEncounter | null;
```

- [ ] **Step 1: Replace the disabled-pack test with RED production-pack tests**

Assert:

```js
assert.equal(BOUNDED_ENCOUNTER_PACK_ENABLED, true);
assert.equal(BOUNDED_ENCOUNTERS.length, 4);
assert.deepEqual(
    [...new Set(BOUNDED_ENCOUNTERS.map((entry) => entry.region))],
    ['고요한 숲', '서쪽 평원'],
);
assert.deepEqual(validateBoundedEncounterPack(
    BOUNDED_ENCOUNTERS,
    ['고요한 숲', '서쪽 평원'],
), { ok: true, errors: [] });
```

Add a validator mutation where both regional families have nonempty eligibility; require `REGION_UNCONDITIONAL_ENCOUNTER_MISSING:<region>`.

- [ ] **Step 2: Author the exact content table**

Use these IDs and material state changes:

| Encounter ID | Region / family | Eligibility | Choice A | Choice B |
|---|---|---|---|---|
| `forest-old-pillars` | 고요한 숲 / `돌기둥의 속삭임` | none | `read-runes`: MP 10, `돌기둥의 가호` DEF 0.2 for 3 turns | `lift-stone`: HP 8, gold +60 |
| `forest-mutated-trail` | 고요한 숲 / `변이된 숲길` | HP band `strained` | `clear-thorns`: HP 10, `강화 재료` 1 | `soothe-spirit`: MP 12, HP +18 |
| `plain-supply-cart` | 서쪽 평원 / `버려진 보급 수레` | none | `repair-cart`: gold 40, `하급 체력 물약` 1 | `search-cart`: HP 8, gold +80 |
| `plain-bandit-banner` | 서쪽 평원 / `도적단의 낡은 깃발` | lineage includes warrior or rogue paths | `read-formation`: MP 8, `매복의 통찰` ATK 0.18 for 3 turns | `follow-cache-map`: HP 8, `강화 재료` 1 |

Copy must follow `상황 → 선택 → 예상 trade-off → 결과` and use the map lore without exposing IDs, percentages, or English system terms to the player.

The lineage allowlist is:

```ts
[
    '전사', '나이트', '버서커', '팔라딘', '드래곤 나이트',
    '도적', '어쌔신', '레인저', '그림자 주군', '사냥의 군주',
]
```

- [ ] **Step 3: Add player-derived context**

Build job lineage by BFS from `모험가` through `DB.CLASSES[job].next`, returning the path to the current job. Return `[]` for malformed or unknown jobs.

`getDiscoveredSignatureNames` returns registry names whose canonical codex bucket is true. Do not use current inventory as discovery authority.

Boss history is the first-order unique union of `player.classJourney.byJob[*].bossNames`. Receipt keys come only from `eventChainProgress.boundedEncounterReceipts` when it is a plain object.

- [ ] **Step 4: Make selection receipt-aware**

Filter with `isBoundedEncounterEligible(encounter, context, receipt)` before the RNG draw. If no encounter is eligible, return null without consuming RNG. Keep sorted encounter IDs for deterministic selection.

- [ ] **Step 5: Run focused content tests**

```bash
node --import tsx --test tests/bounded-encounters.test.js tests/signature-integrity.test.js tests/class-journey.test.js
npx tsc --noEmit
npx eslint src/data/boundedEncounters.ts src/utils/boundedEncounterSelector.ts src/utils/signatureDiscovery.ts tests/bounded-encounters.test.js --quiet
git diff --check
```

---

## Task 6: Integrate Selection and Atomic Reducer Settlement

**Commit group:** 3 of 3 — encounter content, runtime integration, and evidence

**Files:**

- Create: `src/utils/boundedEncounterEvent.ts`
- Create: `src/reducers/handlers/boundedEncounterHandlers.ts`
- Create: `tests/bounded-encounter-integration.test.js`
- Modify: `src/reducers/actionTypes.ts`
- Modify: `src/reducers/gameReducer.ts`
- Modify: `src/hooks/gameActions/exploreActions.ts`
- Modify: `src/hooks/gameActions/eventActions.ts`
- Modify: `src/types/encounter.ts`

**Interfaces:**

Define `ResolveBoundedEncounterChoicePayload` in `src/reducers/actionTypes.ts`, beside the existing combat and ascension payloads. Define `BoundedEncounterEvent` in `src/types/encounter.ts`.

```ts
export interface ResolveBoundedEncounterChoicePayload {
    encounterId: string;
    choiceId: string;
    expeditionId: string;
    occurrenceSequence: number;
}

export interface BoundedEncounterEvent {
    isBoundedEncounter: true;
    boundedEncounterId: string;
    boundedOccurrenceSequence: number;
    title: string;
    desc: string;
    choices: string[];
    outcomes: Array<{
        choiceIndex: number;
        choiceId: string;
        tradeoff: string;
    }>;
}

export const buildBoundedEncounterEvent = (
    encounter: BoundedEncounter,
    occurrenceSequence: number,
): BoundedEncounterEvent;
```

Add `AT.RESOLVE_BOUNDED_ENCOUNTER_CHOICE` and a `boundedEncounterActionMap` entry.

- [ ] **Step 1: Write RED integration tests**

Cover these exact paths:

1. accepted general narrative roll in `고요한 숲` selects a bounded encounter and does not call `AI_SERVICE.generateEvent`
2. disabled/empty/ineligible pack falls through without an extra RNG draw
3. chain and boss priority remain above bounded selection
4. current event plus matching payload applies one reward and receipt
5. duplicate reducer action returns the same state object
6. stale expedition ID, stale occurrence sequence, mismatched event ID, and forged choice return the same state object
7. full inventory and insufficient resource keep the event visible and change no player resource
8. successful settlement closes the event, returns to idle, caps logs, and sets sync status to syncing

- [ ] **Step 2: Build the event shape without duplicating outcome logic**

`buildBoundedEncounterEvent` copies only display fields and canonical IDs. It never applies costs or rewards.

- [ ] **Step 3: Select only after the general narrative roll succeeds**

Inside `runExplorePostDecisionRoll`, after `rng() < effectiveEventChance` succeeds and before `SET_AI_THINKING`:

```ts
const occurrenceSequence = Math.max(1, Number(player.stats?.explores || 0) + 1);
const expeditionId = player.activeExpedition?.id;
const receipt = typeof expeditionId === 'string'
    ? { expeditionId, occurrenceSequence }
    : null;
const context = receipt ? buildBoundedEncounterContext(player, player.loc) : null;
const encounter = receipt && context && BOUNDED_ENCOUNTER_PACK_ENABLED
    ? selectBoundedEncounter(BOUNDED_ENCOUNTERS, context, receipt, rng)
    : null;

if (encounter) {
    commitExploreOutcome('narrative_event', null, mapData);
    dispatch({ type: AT.SET_GAME_STATE, payload: GS.EVENT });
    dispatch({ type: AT.SET_EVENT, payload: buildBoundedEncounterEvent(encounter, occurrenceSequence) });
    addLog('event', encounter.situation);
    return;
}
```

If no encounter is eligible, continue into the current AI/fallback path. Because `selectBoundedEncounter` consumes no RNG for an empty eligible set, fallback behavior remains stable.

- [ ] **Step 4: Dispatch settlement from the hook**

At the top of `handleEventChoice`, before scout and boss handling:

```ts
if (currentEvent.isBoundedEncounter) {
    const outcome = toArray(currentEvent.outcomes)[idx];
    if (!outcome) return;
    dispatch({
        type: AT.RESOLVE_BOUNDED_ENCOUNTER_CHOICE,
        payload: {
            encounterId: currentEvent.boundedEncounterId,
            choiceId: outcome.choiceId,
            expeditionId: player.activeExpedition?.id,
            occurrenceSequence: currentEvent.boundedOccurrenceSequence,
        },
    });
    return;
}
```

Do not grant an item, change HP/MP/gold, close the event, or write history in the hook.

- [ ] **Step 5: Settle against current reducer state**

The handler must:

- require current bounded event fields to match the payload
- require `state.player.activeExpedition.id` to match
- require `state.player.stats.explores === occurrenceSequence` after explore commit
- look up the encounter and choice from `BOUNDED_ENCOUNTERS`
- call `applyBoundedEncounterChoice`
- return exact state for forged/stale/replayed payloads
- keep the event open for canonical `inventory_full` or `insufficient_resources`
- close the event only for `applied=true`
- add the canonical result log and cap with `BALANCE.LOG_MAX_SIZE`

- [ ] **Step 6: Run focused integration**

```bash
node --import tsx --test \
  tests/bounded-encounters.test.js \
  tests/bounded-encounter-integration.test.js \
  tests/explore-scouting.test.js \
  tests/ai-event-utils.test.js \
  tests/event-choice-presentation.test.js
npx tsc --noEmit
npx eslint src/utils/boundedEncounterEvent.ts src/reducers/handlers/boundedEncounterHandlers.ts src/hooks/gameActions/exploreActions.ts src/hooks/gameActions/eventActions.ts tests/bounded-encounter-integration.test.js --quiet
git diff --check
```

---

## Task 7: Present the Trade-off and Prove the Real Surface

**Commit group:** 3 of 3 — encounter content, runtime integration, and evidence

**Files:**

- Modify: `src/utils/eventPresentation.ts`
- Modify: `src/components/EventPanel.tsx`
- Modify: `src/hooks/useGameTestApi.ts`
- Modify: `tests/event-choice-presentation.test.js`
- Create: `tests/e2e/content-pacing-encounters.spec.ts`
- Add captures: `docs/evidence/qa/release-complete-core/screenshots/content-pacing-*.png`

**Interfaces:**

`getEventPanelCopy` returns `{title: event.title, kind:'지역 사건'}` for bounded events. `getEventChoicePreview` returns the canonical `tradeoff` from the selected bounded outcome.

- [ ] **Step 1: Write RED presentation tests**

```js
const event = buildBoundedEncounterEvent(BOUNDED_ENCOUNTERS[0], 7);
assert.deepEqual(getEventPanelCopy(event), {
    title: '돌기둥의 속삭임',
    kind: '지역 사건',
});
assert.deepEqual(getEventChoicePreview(event, 0), {
    text: '기력 10을 들여 다음 전투의 방어를 단단히 합니다.',
    tone: 'story',
});
```

Use `danger` tone for HP costs, `reward` for item/gold without HP cost, and `story` for MP/buff choices. Do not expose raw field names or numeric multipliers.

- [ ] **Step 2: Implement the bounded branches in existing presentation helpers**

No EventPanel layout branch is needed. The existing panel already renders situation, choice, expected result, 72px buttons, and location identity. Change EventPanel only if the typed outcome access requires it.

- [ ] **Step 3: Add a production-derived test fixture**

Add `seedBoundedEncounterScenario(region, encounterId)` to the test API. It must:

- clone `INITIAL_STATE.player`
- create a real active expedition with `startExpedition`
- increment explores to a matching occurrence sequence
- build current event with `buildBoundedEncounterEvent`
- not pre-apply a choice, reward, or receipt

- [ ] **Step 4: Add three-viewport E2E**

For `375x667`, `390x844`, and `430x932`:

1. seed `forest-old-pillars`
2. assert situation, two choices, and trade-offs are visible
3. assert document and event panel `scrollWidth <= clientWidth`
4. assert both buttons have height at least 44px and can scroll into view
5. select the HP/gold choice
6. assert one result log, changed HP/gold, closed event, and receipt
7. replay the same test API action and assert no second reward
8. use system back on an open event and assert the event closes before app close

Capture only after assertions pass:

- `content-pacing-375x667.png`
- `content-pacing-390x844.png`
- `content-pacing-430x932.png`

- [ ] **Step 5: Run the real-surface gate**

```bash
node --import tsx --test tests/event-choice-presentation.test.js tests/bounded-encounter-integration.test.js
npx playwright test tests/e2e/content-pacing-encounters.spec.ts
git diff --check
```

Open all three captures at original size before accepting them.

---

## Task 8: Run Full Gates, Hand Back to GPT A, and Commit Group 3

**Commit group:** 3 of 3 — encounter content, runtime integration, and evidence

**Files:** all Task 5–7 writable paths only.

- [ ] **Step 1: Run repository gates in order**

```bash
npm run content:verify
npm run pacing:verify
npm run verify
npm run verify:full
npm run art:verify
npm run mobile:doctor
npm run cap:sync
npm run android:debug
npm run ios:build:device
git diff --check
git status --short -- android ios
```

Do not hide signing, keystore, simulator, or device blockers. Report exact command, exit, test count, and artifact identity.

- [ ] **Step 2: Run the 1000-seed final statistical check**

Run Task 4's 1000-seed command again on the final bytes and compare its hash to the pre-encounter report. Encounter integration must not change progression reward aggregates or general narrative occurrence counts.

- [ ] **Step 3: Run a deslop pass after behavior is locked**

Inspect only changed code for mechanical wrappers, repeated validation, stale comments, indirect names, and unexplained coercion. Preserve every behavior test. Run focused tests again after any cleanup.

- [ ] **Step 4: Return a verification handoff without commit or push**

The Orca handoff must include:

- exact source HEAD and isolated worktree path
- files changed
- focused and full command results
- reachability/rhythm/progression report hashes
- screenshot paths and hashes
- native artifact results or exact environment blockers
- remaining acceptance criteria
- statement that commit/push/publish count is zero

- [ ] **Step 5: GPT A performs independent review**

GPT A checks:

- actual diff and writable-path compliance
- all three report files against live generators
- event frequency and optional spacing authority
- active-expedition profile locking and rollback
- encounter eligibility, current-state reducer authority, replay, and inventory failure
- UI copy, viewport screenshots, back/lifecycle behavior
- no Apps in Toss, ad, IAP, public grave, dependency, or secret changes

Every Important finding returns to the same bounded Orca Goal for correction. A material architecture gap returns to a Sol xhigh replan instead of improvisation.

- [ ] **Step 6: GPT A synchronizes the dirty ledger paths**

Preserve the existing observation edits, mark the previous 1/5 observation historical for the old candidate, and bind the new source/report hashes. Do not claim five new observations.

- [ ] **Step 7: Commit group 3**

After Important 0 and all applicable gates:

```text
feat: 초반 지역 선택 사건 확장 and replay-safe encounter journey 완성
```

Stage Task 5–7 code/tests/evidence plus GPT A's reconciled ledger files. Confirm staged names exclude `build/`, `android/`, `ios/`, and `docs/evidence/toss/releases/`.

- [ ] **Step 8: Collect final-candidate human observations**

Collect five fresh sessions bound to the final commit and artifact. The old candidate's one session is not counted. Require P0 0 and blocking P1 0.

- [ ] **Step 9: Push once after observation acceptance**

Push `codex/release-complete-core` once. Do not upload a Toss artifact, request review, activate ads, merge, or publish.

---

## Recovery and Rollback

### Source rollback

- Revert commit group 3 to disable bounded content while keeping reachability and rhythm fixes.
- Revert the active progression pointer to `{id:'baseline', version:1}` for new expeditions.
- Do not delete the `exploration-rhythm@2` registry entry, active-expedition snapshots, reports, or receipts.
- Do not restore scout 25% alone while leaving the candidate profile active; rollback uses the complete commit group.

### Interrupted Orca execution

- Keep the isolated worktree and Goal ID.
- Resume only after GPT A checks the source snapshot and writable paths.
- Do not start another executor on overlapping files.
- A failed check is corrected within the same Goal up to three bounded attempts; a new architecture decision returns `replan`.

### External blockers

- Missing Android keystore, Apple Distribution identity, physical device, or Toss console receipt remains an external blocker.
- Browser or unsigned native proof cannot satisfy physical-device or store acceptance.
- The native Goal remains incomplete until the five final-candidate observations are accepted; local code may still be implementation-complete.

---

## Final Acceptance Matrix

| Requirement | Direct evidence |
|---|---|
| 52 maps reachable | content reachability report + map-exit mutation |
| 254 monsters routed | monster route report + removed-route mutation |
| 143 quests valid | prerequisite/target/reward report + cycle mutation |
| 18 jobs and 8 lineages | production progression simulation |
| 229 equipment routes | safe shop/drop/reward route report |
| 25 signature drop routes | signature source index and mutation |
| No optional back-to-back | 64/1000 seed rhythm report + action tests |
| Optional median gap 4–5 | rhythm report p50 gate |
| Event-only profile | transition validator and exact CLI candidate identity |
| Active expedition unchanged | snapshot, HP tracking, finish, reload tests |
| Four encounter families | production data validator |
| No extra occurrence roll | accepted narrative integration test and RNG count |
| Atomic/replay-safe reward | current-state reducer tests |
| Mobile-readable choices | three viewport E2E and inspected captures |
| Full app regression-free | verify, verify:full, art, mobile, cap, native gates |
| Release acceptance | five final-candidate observations, P0 0, blocking P1 0 |
| Toss boundary preserved | no upload/review/public/ad action and evidence audit |
