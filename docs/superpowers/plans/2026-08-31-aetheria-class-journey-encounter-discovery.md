# Aetheria Class Journey Encounter Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The approved execution route is one `gpt-5.6-sol/ultra` writer; do not dispatch subagents or overlap writable paths.

**Goal:** Convert reducer-accepted bounded encounter choices into durable, job-specific Class Journey discoveries only when the owning expedition returns safely, then expose the latest discovery in the existing return and job-journey surfaces.

**Architecture:** The existing bounded encounter receipt remains settlement authority. A new pure projector validates and resolves receipts against the canonical encounter catalog; `finishExpedition()` invokes it once inside the current safe-return transaction and passes the same normalized discoveries to the expedition summary and Class Journey ledger. The nested Class Journey ledger migrates additively from v1 to v2, while the top-level save version, encounter frequency, balance values, reducer actions and navigation remain unchanged.

**Tech Stack:** React 19, TypeScript, reducer-owned gameplay state, Node test runner with `tsx`, Playwright mobile Chromium, Vite, Capacitor, deterministic JSON evidence.

**Spec:** `docs/superpowers/specs/2026-08-31-aetheria-class-journey-encounter-discovery-design.md`

## Global Constraints

- The exact authority chain is `accepted bounded choice -> existing reducer receipt -> safe expedition return -> job-specific permanent discovery`.
- `applyBoundedEncounterChoice()` remains the only authority for accepted choices; do not add a reducer action, effect, dispatch, log parser or second settlement path.
- `finishExpedition()` remains the only persistence boundary. Defeat, reset, abandoned or unfinished expeditions, malformed receipts, rejected choices and replay add no discovery.
- The snapshotted expedition job owns the discovery. Class Journey `sequence` increments once per newly recorded safe return, never per discovery.
- Discovery identity is `(encounterId, encounterVersion, choiceId)`. A repeated identity deduplicates per job; a different canonical choice remains distinct; two jobs may each own the same identity.
- `ClassJourneyLedger.version` advances from `1` to `2`; the top-level save version and `ExpeditionSnapshot` shape do not change.
- IDs must match `^[a-z0-9][a-z0-9._:-]{0,127}$`; encounter version must be a positive safe integer; Korean family and choice copy must be non-empty after trimming.
- Historical display copy is normalized from the save without consulting the live catalog. New safe-return copy is projected from the canonical catalog, never from persisted receipt copy.
- Do not change EXP, loot, pity, event frequency, enemy HP, economy, progression profiles, existing encounter definitions, RNG consumption, analytics, native capabilities or dependencies.
- Do not add a menu, modal, icon, animation or navigation item. Add only the optional `사건의 흔적` line to the existing `ClassJourneySummary`.
- Raw encounter IDs, choice IDs, receipt keys and build tags must not enter rendered player text or `render_game_to_text`.
- Keep protected untracked evidence directories byte-identical and outside staging: `docs/evidence/qa/release-complete-core/candidates/` and `docs/evidence/toss/releases/`.
- Stop for Sol ultra re-planning if implementation needs a path outside the exact 18-path implementation boundary below, except a generated deterministic evidence file whose existing verifier proves it changed.
- Do not make task-by-task commits. Each task ends at a review checkpoint; after all gates and independent review, request separate approval for one cohesive implementation checkpoint commit.

## Locked File Map

The planned implementation checkpoint is exactly these 18 paths:

1. `src/types/player.ts` — additive discovery and ledger/summary types.
2. `src/utils/boundedEncounterDiscovery.ts` — receipt-to-discovery pure projection.
3. `src/utils/classJourney.ts` — v2 migration, normalization and append authority.
4. `src/utils/expeditionLedger.ts` — safe-return projection and atomic dual write.
5. `src/components/ClassJourneySummary.tsx` — existing-card discovery line and recommendation.
6. `src/hooks/useGameTestApi.ts` — v2 fixture compatibility only; no alternate settlement path.
7. `tests/bounded-encounter-discovery.test.js` — pure projector contract.
8. `tests/class-journey.test.js` — v2 ledger migration, dedupe, merge and replay.
9. `tests/expedition-ledger.test.js` — production safe-return integration.
10. `tests/permanent-progress.test.js` — defeat/reset/ascension preservation.
11. `tests/data-migration.test.js` — save and summary corruption recovery.
12. `tests/e2e/expedition-debrief.spec.ts` — real 390x844 reducer and movement journey.
13. `tests/e2e/content-pacing-encounters.spec.ts` — preserve exact receipt assertions outside `render_game_to_text`.
14. `docs/evidence/qa/release-complete-core/progression-diagnostic-v2.json` — generated source-manifest refresh only.
15. `docs/evidence/qa/release-complete-core/completion-summary.md` — verified checkpoint summary.
16. `docs/evidence/qa/release-complete-core/requirement-matrix.md` — requirement-to-test/evidence mapping.
17. `tasks/todo.md` — active checkpoint and approval boundary.
18. `progress.md` — implementation and verification handoff.

`event-reward-coherence.json`, content evidence and pacing evidence are verify-only because this slice does not change their report inputs or semantics. If any of those verifiers requires a tracked rewrite, stop and classify the drift before expanding the path set.

---

### Task 1: Add the discovery data contract and pure receipt projector

**Files:**
- Modify: `src/types/player.ts:166-245`
- Create: `src/utils/boundedEncounterDiscovery.ts`
- Create: `tests/bounded-encounter-discovery.test.js`

**Interfaces:**
- Consumes: `BOUNDED_ENCOUNTERS`, `BoundedEncounter`, and `buildBoundedEncounterReceiptKey(expeditionId, encounterId, occurrenceSequence)`.
- Produces:

```ts
export interface ClassJourneyEncounterDiscovery {
    encounterId: string;
    encounterVersion: number;
    choiceId: string;
    family: string;
    choiceLabel: string;
}

export const projectBoundedEncounterDiscoveries = (
    eventChainProgress: unknown,
    expeditionId: string,
    encounters?: readonly BoundedEncounter[],
): ClassJourneyEncounterDiscovery[];
```

- Adds `encounterDiscoveries: ClassJourneyEncounterDiscovery[]` to `ClassJourneyRecord` and `ExpeditionSummary` only.
- Changes `ClassJourneyLedger.version` from literal `1` to literal `2`.

- [ ] **Step 1: Write the projector RED contract**

Create `tests/bounded-encounter-discovery.test.js` with a small injected catalog and explicit valid receipts:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import { projectBoundedEncounterDiscoveries } from '../src/utils/boundedEncounterDiscovery.js';

const encounters = [
    {
        id: 'forest-roots',
        version: 1,
        region: '고요한 숲',
        family: '뿌리 아래 공명 결계',
        eligibility: {},
        situation: '결계가 깨어난다.',
        choices: [
            { id: 'continue-flow', label: '결계의 흐름을 이어 둔다', tradeoff: '기력', outcome: { result: '유지했다.' } },
            { id: 'break-seal', label: '결계를 끊어낸다', tradeoff: '생명', outcome: { result: '끊어냈다.' } },
        ],
    },
];

test('projects canonical encounter copy from exact expedition receipts', () => {
    const progress = {
        boundedEncounterReceipts: {
            'expedition-7:forest-roots:2': {
                encounterId: 'forest-roots',
                choiceId: 'continue-flow',
                family: '위조된 이름',
            },
        },
    };

    assert.deepEqual(projectBoundedEncounterDiscoveries(progress, 'expedition-7', encounters), [{
        encounterId: 'forest-roots',
        encounterVersion: 1,
        choiceId: 'continue-flow',
        family: '뿌리 아래 공명 결계',
        choiceLabel: '결계의 흐름을 이어 둔다',
    }]);
});
```

Add focused cases that prove all of the following with exact assertions:

```js
test('ignores malformed, foreign, unknown, and key-mismatched receipts independently', () => {
    const projected = projectBoundedEncounterDiscoveries({
        boundedEncounterReceipts: {
            'expedition-7:forest-roots:1': { encounterId: 'forest-roots', choiceId: 'continue-flow' },
            'expedition-8:forest-roots:2': { encounterId: 'forest-roots', choiceId: 'break-seal' },
            'expedition-7:unknown:3': { encounterId: 'unknown', choiceId: 'missing' },
            'expedition-7:forest-roots:4': { encounterId: 'forest-roots', choiceId: 'missing' },
            'expedition-7:forest-roots:5': { encounterId: 'forest-roots' },
            'expedition-7:forest-roots:not-a-number': { encounterId: 'forest-roots', choiceId: 'break-seal' },
            'forged-key': { encounterId: 'forest-roots', choiceId: 'break-seal' },
        },
    }, 'expedition-7', encounters);
    assert.deepEqual(projected.map(({ choiceId }) => choiceId), ['continue-flow']);
});

test('orders by occurrence and deduplicates only an identical choice', () => {
    const projected = projectBoundedEncounterDiscoveries({
        boundedEncounterReceipts: {
            'expedition-7:forest-roots:3': { encounterId: 'forest-roots', choiceId: 'continue-flow' },
            'expedition-7:forest-roots:2': { encounterId: 'forest-roots', choiceId: 'break-seal' },
            'expedition-7:forest-roots:1': { encounterId: 'forest-roots', choiceId: 'continue-flow' },
        },
    }, 'expedition-7', encounters);
    assert.deepEqual(projected.map(({ choiceId }) => choiceId), ['continue-flow', 'break-seal']);
});

test('returns empty for non-plain ledgers and invalid expedition ids', () => {
    assert.deepEqual(projectBoundedEncounterDiscoveries(null, 'expedition-7', encounters), []);
    assert.deepEqual(projectBoundedEncounterDiscoveries({ boundedEncounterReceipts: [] }, 'expedition-7', encounters), []);
    assert.deepEqual(projectBoundedEncounterDiscoveries({ boundedEncounterReceipts: {} }, 'INVALID ID', encounters), []);
});

test('does not mutate input or consume random values', () => {
    const progress = {
        boundedEncounterReceipts: {
            'expedition-7:forest-roots:1': { encounterId: 'forest-roots', choiceId: 'continue-flow' },
        },
    };
    const before = structuredClone(progress);
    const originalRandom = Math.random;
    Math.random = () => { throw new Error('projector consumed RNG'); };
    try {
        projectBoundedEncounterDiscoveries(progress, 'expedition-7', encounters);
    } finally {
        Math.random = originalRandom;
    }
    assert.deepEqual(progress, before);
});
```

For the code-point tie-break, add an injected `forest-alpha` encounter and two exact-key receipts with occurrence `4`, insert `forest-roots` first, and assert the projected encounter IDs are exactly `['forest-alpha', 'forest-roots']`.

- [ ] **Step 2: Run the isolated RED test**

Run:

```bash
node --import tsx --test tests/bounded-encounter-discovery.test.js
```

Expected: FAIL because `src/utils/boundedEncounterDiscovery.ts` does not exist and the player types have no discovery contract.

- [ ] **Step 3: Add the additive player types**

In `src/types/player.ts`, add the interface before `ClassJourneyRecord`, add the two arrays, and change only the nested ledger literal:

```ts
export interface ClassJourneyEncounterDiscovery {
    encounterId: string;
    encounterVersion: number;
    choiceId: string;
    family: string;
    choiceLabel: string;
}

export interface ClassJourneyRecord {
    expeditionIds: string[];
    skillBranches: string[];
    signatureItems: string[];
    bossNames: string[];
    regions: string[];
    encounterDiscoveries: ClassJourneyEncounterDiscovery[];
    representativeExpeditionId: string | null;
    lastPlayedAt: number | null;
}

export interface ClassJourneyLedger {
    version: 2;
    sequence: number;
    byJob: Record<string, ClassJourneyRecord>;
}
```

Add the same required array to `ExpeditionSummary`; do not add it to `ExpeditionSnapshot`.

- [ ] **Step 4: Implement the pure projector**

Create `src/utils/boundedEncounterDiscovery.ts`. Use a local plain-object guard, the exact ID regex, a `Set` keyed by the identity tuple, and code-point comparison rather than locale ordering:

```ts
import { BOUNDED_ENCOUNTERS } from '../data/boundedEncounters.js';
import type { BoundedEncounter } from '../types/encounter.js';
import type { ClassJourneyEncounterDiscovery } from '../types/player.js';
import { buildBoundedEncounterReceiptKey } from './boundedEncounterSelector.js';

const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const codePointCompare = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);
const isPlainObject = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
        && Object.getPrototypeOf(value) === Object.prototype
);

export const projectBoundedEncounterDiscoveries = (
    eventChainProgress: unknown,
    expeditionId: string,
    encounters: readonly BoundedEncounter[] = BOUNDED_ENCOUNTERS,
): ClassJourneyEncounterDiscovery[] => {
    if (!SAFE_ID.test(expeditionId) || !isPlainObject(eventChainProgress)) return [];
    const ledger = eventChainProgress.boundedEncounterReceipts;
    if (!isPlainObject(ledger)) return [];

    const candidates = Object.entries(ledger).flatMap(([receiptKey, receipt]) => {
        if (!isPlainObject(receipt)
            || typeof receipt.encounterId !== 'string'
            || typeof receipt.choiceId !== 'string') return [];
        const lastSeparator = receiptKey.lastIndexOf(':');
        const occurrenceSequence = Number(receiptKey.slice(lastSeparator + 1));
        if (lastSeparator < 0
            || !Number.isSafeInteger(occurrenceSequence)
            || occurrenceSequence < 1) return [];
        try {
            if (receiptKey !== buildBoundedEncounterReceiptKey(
                expeditionId,
                receipt.encounterId,
                occurrenceSequence,
            )) return [];
        } catch {
            return [];
        }
        const encounter = encounters.find(({ id }) => id === receipt.encounterId);
        const choice = Array.isArray(encounter?.choices)
            ? encounter.choices.find(({ id }) => id === receipt.choiceId)
            : undefined;
        const family = typeof encounter?.family === 'string' ? encounter.family.trim() : '';
        const choiceLabel = typeof choice?.label === 'string' ? choice.label.trim() : '';
        if (!encounter || !choice
            || !SAFE_ID.test(encounter.id)
            || !SAFE_ID.test(choice.id)
            || !Number.isSafeInteger(encounter.version)
            || encounter.version < 1
            || !family
            || !choiceLabel) return [];
        return [{
            occurrenceSequence,
            discovery: {
                encounterId: encounter.id,
                encounterVersion: encounter.version,
                choiceId: choice.id,
                family,
                choiceLabel,
            },
        }];
    }).sort((left, right) => (
        left.occurrenceSequence - right.occurrenceSequence
        || codePointCompare(left.discovery.encounterId, right.discovery.encounterId)
        || codePointCompare(left.discovery.choiceId, right.discovery.choiceId)
    ));

    const seen = new Set<string>();
    return candidates.flatMap(({ discovery }) => {
        const identity = `${discovery.encounterId}\u0000${discovery.encounterVersion}\u0000${discovery.choiceId}`;
        if (seen.has(identity)) return [];
        seen.add(identity);
        return [discovery];
    });
};
```

Do not split receipt keys with an unconstrained `split(':')`; parse the final numeric segment and then prove the entire key by rebuilding it with the receipt's canonical IDs.

- [ ] **Step 5: Run projector GREEN and type-check**

Run:

```bash
node --import tsx --test tests/bounded-encounter-discovery.test.js
npx tsc --noEmit
```

Expected: projector tests PASS. TypeScript may still report existing v1 fixtures and missing required arrays in later planned paths; capture only those expected Task 2-4 migration failures. Any unrelated error is a stop condition.

- [ ] **Step 6: Review checkpoint**

Inspect only the three Task 1 paths. Confirm no call to `Math.random`, `applyBoundedEncounterChoice`, state mutation, storage or logging; confirm malformed entries are ignored individually and deterministic ordering is explicit. Do not commit.

---

### Task 2: Make Class Journey v2 the migration and replay authority

**Files:**
- Modify: `src/utils/classJourney.ts:1-175`
- Modify: `tests/class-journey.test.js`
- Modify: `tests/data-migration.test.js`
- Modify: `tests/permanent-progress.test.js`

**Interfaces:**
- Consumes: `ClassJourneyEncounterDiscovery` from Task 1.
- Produces:

```ts
export const normalizeClassJourneyEncounterDiscoveries = (
    value: unknown,
): ClassJourneyEncounterDiscovery[];
```

- Extends the private `ClassJourneyExpeditionInput` with `encounterDiscoveries?: ClassJourneyEncounterDiscovery[]`.
- Guarantees `normalizeClassJourneyLedger()` always returns version `2`.

- [ ] **Step 1: Write RED tests for discovery normalization**

In `tests/class-journey.test.js`, import the new normalizer and add exact cases:

```js
test('normalizes valid encounter discoveries and preserves first-discovery order', () => {
    assert.deepEqual(normalizeClassJourneyEncounterDiscoveries([
        { encounterId: 'forest-roots', encounterVersion: 1, choiceId: 'continue-flow', family: ' 뿌리 아래 공명 결계 ', choiceLabel: ' 흐름을 잇는다 ' },
        { encounterId: 'forest-roots', encounterVersion: 1, choiceId: 'continue-flow', family: '중복', choiceLabel: '중복' },
        { encounterId: 'forest-roots', encounterVersion: 1, choiceId: 'break-seal', family: '뿌리 아래 공명 결계', choiceLabel: '끊어낸다' },
    ]), [
        { encounterId: 'forest-roots', encounterVersion: 1, choiceId: 'continue-flow', family: '뿌리 아래 공명 결계', choiceLabel: '흐름을 잇는다' },
        { encounterId: 'forest-roots', encounterVersion: 1, choiceId: 'break-seal', family: '뿌리 아래 공명 결계', choiceLabel: '끊어낸다' },
    ]);
});
```

Add a table-driven invalid test for uppercase/space/overlong IDs, zero/fractional/unsafe versions, empty copy, arrays, inherited objects and nonobjects. Assert each invalid entry is dropped, not coerced.

- [ ] **Step 2: Write RED tests for v1 migration, merge and replay**

Update all existing expected ledgers to version `2` and add `encounterDiscoveries: []`. Add tests that prove:

```js
test('migrates v1 records to v2 with an empty discovery list', () => {
    const normalized = normalizeClassJourneyLedger({
        version: 1,
        sequence: 1,
        byJob: { 전사: { expeditionIds: ['expedition-1'], regions: ['고요한 숲'] } },
    });
    assert.equal(normalized.version, 2);
    assert.deepEqual(normalized.byJob.전사.encounterDiscoveries, []);
});

test('records discoveries once and expedition sequence once', () => {
    const discovery = {
        encounterId: 'forest-roots', encounterVersion: 1, choiceId: 'continue-flow',
        family: '뿌리 아래 공명 결계', choiceLabel: '흐름을 잇는다',
    };
    const recorded = recordClassJourneyExpedition({ job: '전사' }, {
        job: '전사', expeditionId: 'expedition-1', encounterDiscoveries: [discovery, discovery],
    });
    assert.equal(recorded.classJourney.sequence, 1);
    assert.deepEqual(recorded.classJourney.byJob.전사.encounterDiscoveries, [discovery]);

    const replayed = recordClassJourneyExpedition(recorded, {
        job: '전사', expeditionId: 'expedition-1', encounterDiscoveries: [{
            ...discovery, choiceId: 'break-seal', choiceLabel: '끊어낸다',
        }],
    });
    assert.equal(replayed, recorded);
    assert.equal(replayed.classJourney, recorded.classJourney);
});

test('keeps the same discovery independently under different jobs', () => {
    const discovery = {
        encounterId: 'forest-roots', encounterVersion: 1, choiceId: 'continue-flow',
        family: '뿌리 아래 공명 결계', choiceLabel: '흐름을 잇는다',
    };
    const warrior = recordClassJourneyExpedition({}, {
        job: '전사', expeditionId: 'expedition-1', encounterDiscoveries: [discovery],
    });
    const mage = recordClassJourneyExpedition(warrior, {
        job: '마법사', expeditionId: 'expedition-2', encounterDiscoveries: [discovery],
    });
    assert.deepEqual(warrior.classJourney.byJob.전사.encounterDiscoveries, [discovery]);
    assert.deepEqual(mage.classJourney.byJob.마법사.encounterDiscoveries, [discovery]);
});
```

Extend the existing duplicate-job merge fixture with discovery arrays `[A, B]` and `[B, C]`. Assert the merged identity order is exactly `[A, B, C]` and that the saved `family` and `choiceLabel` for `B` come from its first occurrence.

In `tests/data-migration.test.js`, extend the existing legacy-save fixture with a valid and malformed summary discovery. The expected ledger must be version `2`, while the normalized summary retains only the valid record. In `tests/permanent-progress.test.js`, make `buildClassJourney()` version `2` with one discovery and keep the existing deep-clone assertions for defeat, manual reset and ascension.

- [ ] **Step 3: Run the focused RED set**

Run:

```bash
node --import tsx --test \
  tests/class-journey.test.js \
  tests/data-migration.test.js \
  tests/permanent-progress.test.js
```

Expected: FAIL on version `1`, missing `encounterDiscoveries`, or the missing exported normalizer.

- [ ] **Step 4: Implement one shared normalizer**

In `src/utils/classJourney.ts`, add the exact validation and first-identity preservation:

```ts
const SAFE_DISCOVERY_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const discoveryIdentity = ({ encounterId, encounterVersion, choiceId }: ClassJourneyEncounterDiscovery) => (
    `${encounterId}\u0000${encounterVersion}\u0000${choiceId}`
);

export const normalizeClassJourneyEncounterDiscoveries = (
    value: unknown,
): ClassJourneyEncounterDiscovery[] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)
            || Object.getPrototypeOf(entry) !== Object.prototype) return [];
        const candidate = entry as Record<string, unknown>;
        const encounterId = typeof candidate.encounterId === 'string' ? candidate.encounterId : '';
        const choiceId = typeof candidate.choiceId === 'string' ? candidate.choiceId : '';
        const encounterVersion = candidate.encounterVersion;
        const family = typeof candidate.family === 'string' ? candidate.family.trim() : '';
        const choiceLabel = typeof candidate.choiceLabel === 'string'
            ? candidate.choiceLabel.trim()
            : '';
        if (!SAFE_DISCOVERY_ID.test(encounterId)
            || !SAFE_DISCOVERY_ID.test(choiceId)
            || typeof encounterVersion !== 'number'
            || !Number.isSafeInteger(encounterVersion)
            || encounterVersion < 1
            || !family
            || !choiceLabel) return [];
        const discovery = { encounterId, encounterVersion, choiceId, family, choiceLabel };
        const identity = discoveryIdentity(discovery);
        if (seen.has(identity)) return [];
        seen.add(identity);
        return [discovery];
    });
};
```

Use the same normalizer in:

```ts
const emptyClassJourneyRecord = (): ClassJourneyRecord => ({
    expeditionIds: [],
    skillBranches: [],
    signatureItems: [],
    bossNames: [],
    regions: [],
    encounterDiscoveries: [],
    representativeExpeditionId: null,
    lastPlayedAt: null,
});
```

and in `normalizeRecord`, duplicate job merging, and `recordClassJourneyExpedition`. Add a small append helper that keys by `discoveryIdentity`; do not reuse display copy as identity.

- [ ] **Step 5: Preserve replay ordering and object identity**

Keep both existing expedition replay guards before construction of `nextRecord`. Only new expeditions normalize and append `input.encounterDiscoveries`:

```ts
if (current.expeditionIds.includes(expeditionId)) return player;
if (Object.values(ledger.byJob).some((record) => record.expeditionIds.includes(expeditionId))) return player;
```

Return `version: 2` and increment `sequence` exactly once in the existing ledger transaction.

- [ ] **Step 6: Run Task 2 GREEN and preservation tests**

Run:

```bash
node --import tsx --test \
  tests/class-journey.test.js \
  tests/data-migration.test.js \
  tests/permanent-progress.test.js
npx tsc --noEmit
```

Expected: all Task 2 tests PASS; remaining type errors, if any, must be limited to Task 3/4 summary fixtures.

- [ ] **Step 7: Review checkpoint**

Verify the normalizer does not consult `BOUNDED_ENCOUNTERS`, existing expedition/job protections are unchanged, first-discovery order is stable, and all reset paths preserve normalized v2 content. Do not commit.

---

### Task 3: Integrate projection into the existing safe-return transaction

**Files:**
- Modify: `src/utils/expeditionLedger.ts:218-380`
- Modify: `tests/expedition-ledger.test.js`
- Modify: `tests/data-migration.test.js`

**Interfaces:**
- Consumes: `projectBoundedEncounterDiscoveries(player.eventChainProgress, snapshot.id)` and `normalizeClassJourneyEncounterDiscoveries(candidate.encounterDiscoveries)`.
- Produces: one identical normalized discovery array written to `summary.encounterDiscoveries` and the snapshotted job's Class Journey record.

- [ ] **Step 1: Write the safe-return RED integration test**

In `tests/expedition-ledger.test.js`, construct a player through `startExpedition()`, apply one real bounded choice through `applyBoundedEncounterChoice()`, then call `finishExpedition()`:

```js
const started = startExpedition(player, '고요한 숲', 1_000, DB.QUESTS);
const encounter = BOUNDED_ENCOUNTERS.find(({ id }) => id === 'forest-root-resonance');
const settled = applyBoundedEncounterChoice(started, encounter, 'anchor-root-ward', {
    expeditionId: started.activeExpedition.id,
    occurrenceSequence: 1,
});
assert.equal(settled.applied, true);

const returned = finishExpedition(settled.player, '시작의 마을', 2_000, DB.QUESTS);
assert.deepEqual(returned.summary.encounterDiscoveries, [{
    encounterId: encounter.id,
    encounterVersion: encounter.version,
    choiceId: 'anchor-root-ward',
    family: encounter.family,
    choiceLabel: '결계의 흐름을 이어 둔다',
}]);
assert.deepEqual(
    returned.player.classJourney.byJob[started.activeExpedition.job].encounterDiscoveries,
    returned.summary.encounterDiscoveries,
);
```

The canonical choice ID is `anchor-root-ward`; the assertion also fixes its current Korean label to `결계의 흐름을 이어 둔다` so a content rename becomes an explicit review event.

- [ ] **Step 2: Add transaction and exclusion RED cases**

Add exact tests for:

- two receipt occurrences of the same identity -> one summary and permanent record;
- two canonical choices from the same encounter -> two ordered discoveries;
- a receipt from another expedition -> excluded;
- mixed malformed and valid receipts -> valid one still records;
- no snapshotted job -> summary retains valid discoveries, Class Journey unchanged;
- replaying `finishExpedition()` after `activeExpedition` cleared -> `summary: null`, same Class Journey sequence and discoveries;
- an unfinished/defeated player never calls `finishExpedition()` and therefore owns no discovery;
- existing branch, signature, boss, region, EXP, gold and summary calculations remain byte-for-byte equal apart from the additive array.

- [ ] **Step 3: Run the integration RED set**

Run:

```bash
node --import tsx --test \
  tests/bounded-encounter-discovery.test.js \
  tests/class-journey.test.js \
  tests/expedition-ledger.test.js \
  tests/data-migration.test.js
```

Expected: new expedition assertions FAIL because `finishExpedition()` and summary migration do not yet carry discoveries.

- [ ] **Step 4: Normalize stale summaries with the shared authority**

Import `normalizeClassJourneyEncounterDiscoveries` into `src/utils/expeditionLedger.ts` and add:

```ts
encounterDiscoveries: normalizeClassJourneyEncounterDiscoveries(candidate.encounterDiscoveries),
```

to `normalizeExpeditionSummary()`. Do not duplicate its validation rules locally.

- [ ] **Step 5: Project once and pass the same array to both writes**

Import `projectBoundedEncounterDiscoveries` and place this immediately after snapshot validation and before the summary object:

```ts
const encounterDiscoveries = projectBoundedEncounterDiscoveries(
    player.eventChainProgress,
    snapshot.id,
);
```

Then add the same value to both existing constructions:

```ts
const summary: ExpeditionSummary = {
    encounterDiscoveries,
    progressionProfile: { ...snapshot.progressionProfile },
};

recordClassJourneyExpedition(player, {
    encounterDiscoveries,
    endedAt,
});
```

The two snippets above show the exact insertion points in the already-existing object literals; retain every surrounding field byte-for-byte.

Do not remove or rewrite receipts. Do not add dispatches or change `moveActions.ts`.

- [ ] **Step 6: Run Task 3 GREEN and focused integration**

Run:

```bash
node --import tsx --test \
  tests/bounded-encounter-discovery.test.js \
  tests/class-journey.test.js \
  tests/expedition-ledger.test.js \
  tests/permanent-progress.test.js \
  tests/data-migration.test.js
npx tsc --noEmit
```

Expected: all focused unit tests and type-check PASS.

- [ ] **Step 7: Review checkpoint**

Trace one accepted receipt from reducer state to one `finishExpedition()` call. Confirm projection happens once, both output locations share its content, no Class Journey write occurs without a snapshotted job, and `moveActions.ts` remains untouched. Do not commit.

---

### Task 4: Render the optional discovery in the existing Class Journey surface

**Files:**
- Modify: `src/components/ClassJourneySummary.tsx`
- Modify: `src/hooks/useGameTestApi.ts`
- Modify: `tests/e2e/expedition-debrief.spec.ts`
- Modify: `tests/e2e/content-pacing-encounters.spec.ts`

**Interfaces:**
- Consumes: `record.encounterDiscoveries` and `latestSummary.encounterDiscoveries` from Tasks 2-3.
- Produces: optional `<p data-testid="class-journey-encounter">사건의 흔적 · {family} · {choiceLabel}</p>` and one real mobile E2E journey.

- [ ] **Step 1: Update static test fixtures to v2**

Change `classJourneyScenario()` in `src/hooks/useGameTestApi.ts` to version `2`, add one canonical discovery to its Warrior record, and add the same discovery to `seedExpeditionDebriefScenario()`'s representative summary. This function remains display-fixture setup only.

Remove `boundedEncounterReceiptKeys` from the `render_game_to_text` player projection and remove `boundedEncounterId` plus `boundedOccurrenceSequence` from its `currentEvent` projection. Player-readable event description and choice copy remain available. Preserve the existing receipt and replay assertions through a narrower read-only mock-runtime API:

```ts
getBoundedEncounterReceiptKeys: () => Object.keys(
    engineRef.current.player.eventChainProgress?.boundedEncounterReceipts || {},
),
```

In `tests/e2e/content-pacing-encounters.spec.ts`, import `Page`, add this helper, and replace only the six direct `settled.player.boundedEncounterReceiptKeys` and `replayed.player.boundedEncounterReceiptKeys` reads:

```ts
const getBoundedEncounterReceiptKeys = (page: Page) => page.evaluate(() => (
    window.__AETHERIA_TEST_API__?.getBoundedEncounterReceiptKeys?.() || []
));
```

Keep every exact expected receipt key and replay comparison unchanged. After the move, `render_game_to_text` contains no bounded encounter ID, occurrence sequence or receipt key.

Do not add a test-only return or settlement method. The real E2E uses the already existing `seedBoundedEncounterScenario()` and production movement action.

- [ ] **Step 2: Write the UI selection RED assertions**

Extend the existing first debrief test to assert the fixture line:

```ts
await expect(page.getByTestId('class-journey-encounter')).toHaveText(
    '사건의 흔적 · 뿌리 아래 공명 결계 · 결계의 흐름을 이어 둔다',
);
```

Add unit-surface coverage through the real journey below rather than introducing a component-test dependency.

- [ ] **Step 3: Add the real 390x844 RED journey**

In `tests/e2e/expedition-debrief.spec.ts`, add a second `test.describe('Class Journey encounter discovery', ...)` after the current preseeded-debrief suite. Its test performs its own fresh `startE2ERun(page)` so the existing suite-level `seedExpeditionDebriefScenario()` hook cannot contaminate the journey. Use the actual existing controls:

```ts
test('지역 사건 선택을 안전 귀환 뒤 직업 여정에 한 번 기록한다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startE2ERun(page);

    expect(await page.evaluate(() => (
        window.__AETHERIA_TEST_API__?.seedBoundedEncounterScenario?.(
            '고요한 숲',
            'forest-root-resonance',
        )
    ))).toBe(true);

    const before = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    await page.getByTestId('event-choice-list').getByRole('button').nth(0).click();
    await page.getByTestId('control-move').click();
    await page.getByTestId('control-route-option-시작의 마을').click();

    const discovery = page.getByTestId('class-journey-encounter');
    await expect(discovery).toHaveText(
        '사건의 흔적 · 뿌리 아래 공명 결계 · 결계의 흐름을 이어 둔다',
    );
    await expect(discovery).toHaveCount(1);

    const returned = await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'));
    expect(returned.player.classJourneySequence).toBe(
        (before.player.classJourneySequence || 0) + 1,
    );

    await page.evaluate(({ expeditionId }) => {
        window.__AETHERIA_TEST_API__?.resolveBoundedEncounterChoice?.(
            'forest-root-resonance',
            'anchor-root-ward',
            expeditionId,
            1,
        );
    }, { expeditionId: before.player.activeExpeditionId });
    expect(await page.evaluate(() => JSON.parse(window.render_game_to_text?.() || '{}'))).toEqual(returned);

    await expect(page.getByTestId('expedition-debrief-primary-action')).toBeVisible();
    await page.getByTestId('expedition-debrief-close-icon').click();
    await page.getByTestId('control-last-expedition').click();
    await expect(page.getByTestId('class-journey-encounter')).toHaveCount(1);

    const widths = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
    }));
    expect(widths.document).toBeLessThanOrEqual(widths.viewport);
});
```

- [ ] **Step 4: Run the mobile E2E to prove RED**

Run:

```bash
npx playwright test tests/e2e/expedition-debrief.spec.ts --project=chromium-mobile --workers=1
```

Expected: FAIL only on the missing discovery line/recommendation. If movement or selector IDs differ from the inspected current code, update the test to the actual production controls; do not add a bypass helper.

- [ ] **Step 5: Implement representative-summary selection and copy**

In `ClassJourneySummary.tsx`, use the existing `last()` helper and authority rule:

```ts
const encounterDiscovery = isRepresentativeSummary
    ? last(latestSummary.encounterDiscoveries) || last(record.encounterDiscoveries)
    : last(record.encounterDiscoveries);
```

Render inside the existing body group:

```tsx
{encounterDiscovery && (
    <p
        data-testid="class-journey-encounter"
        className="aether-type-body break-words text-slate-300"
    >
        사건의 흔적 · {encounterDiscovery.family} · {encounterDiscovery.choiceLabel}
    </p>
)}
```

Insert `지역 사건의 선택` only after the existing branch/signature/boss/region priorities and only when `record.encounterDiscoveries.length === 0`; after a discovery, retain the existing broader recommendation.

- [ ] **Step 6: Run UI GREEN and static leakage checks**

Run:

```bash
npx playwright test \
  tests/e2e/content-pacing-encounters.spec.ts \
  tests/e2e/expedition-debrief.spec.ts \
  --project=chromium-mobile \
  --workers=1
npx tsc --noEmit
npm run lint
rg -n "forest-root-resonance|boundedEncounterReceipt|buildTags" src/components/ClassJourneySummary.tsx
rg -n "boundedEncounterReceiptKeys:|boundedEncounterId:|boundedOccurrenceSequence:" src/hooks/useGameTestApi.ts
```

Expected: Playwright, type-check and lint PASS; both `rg` commands return no raw ID, receipt, build-tag rendering or bounded encounter identity property in `render_game_to_text`.

- [ ] **Step 7: Review checkpoint**

Inspect the 390x844 trace or screenshot produced by the existing test path. Confirm no horizontal overflow, the optional line wraps, primary action remains reachable, no new navigation exists and legacy records omit the line. Do not commit or refresh a tracked screenshot because the spec explicitly requires no new screenshot artifact.

---

### Task 5: Refresh deterministic evidence and synchronize release history

**Files:**
- Modify: `docs/evidence/qa/release-complete-core/progression-diagnostic-v2.json`
- Modify: `docs/evidence/qa/release-complete-core/completion-summary.md`
- Modify: `docs/evidence/qa/release-complete-core/requirement-matrix.md`
- Modify: `tasks/todo.md`
- Modify: `progress.md`

**Interfaces:**
- Consumes: all verified production/test bytes from Tasks 1-4.
- Produces: deterministic source-manifest evidence and an exact checkpoint record with honest external gates.

- [ ] **Step 1: Capture semantic evidence invariants before refresh**

Record, using a read-only Node snippet or `jq`, the current Progression v2 values:

```text
reportHash
v1Baseline.reportHash
seedPolicy
report.schemaVersion
report.actualPlayClaim
report.activationReady
report.hardErrors
```

Also record the current protected directory aggregate hashes and the current `event-reward-coherence.json` SHA-256. These values become post-refresh assertions, not new gameplay baselines.

- [ ] **Step 2: Run verify-only semantic gates before any write**

Run:

```bash
npm run content:verify
npm run pacing:verify
npm run event-reward:verify
npm run progression:diagnostic:verify
```

Expected: content, pacing and event-reward PASS without tracked writes. Progression verification is expected to fail only with deterministic source-manifest/evidence byte mismatch caused by changed or new `src/**` files. Any reportHash, v1 baseline, seed policy or hard-error drift is a stop condition.

- [ ] **Step 3: Refresh only Progression v2 evidence**

Run the repository's canonical writer:

```bash
npm run progression:diagnostic:write
npm run progression:diagnostic:verify
```

Assert the evidence is stable across a second generate-to-temporary comparison or a second canonical write with unchanged SHA-256. Confirm only source manifest rows for the changed/new source files differ; the report, `reportHash`, v1 baseline and seed policy remain byte-equivalent.

- [ ] **Step 4: Update completion and requirement documents**

Add a concise checkpoint to both release documents covering:

```text
accepted receipt -> safe return -> v2 Class Journey discovery
same-choice dedupe / different-choice distinction
v1 additive migration and reset preservation
390x844 production movement proof
unchanged EXP/loot/pity/event/HP/profile/top-level save semantics
current verification counts and hashes only
human observation, device acceptance, signing, push and publication not performed
```

Update `tasks/todo.md` and `progress.md` only after the associated commands have actually passed. Do not claim candidate sealing or human observation.

- [ ] **Step 5: Verify the exact path boundary**

Run:

```bash
git status --short
git diff --name-only
git diff --check
```

Expected: exactly the 18 planned implementation paths are tracked changes, plus the two pre-existing protected untracked directories. If any additional path appears, stop before staging and classify it.

- [ ] **Step 6: Review checkpoint**

Confirm release prose matches current command output and no historical candidate/Toss file changed. Do not commit.

---

### Task 6: Run the full repository gate and independent Sol ultra review

**Files:**
- Verify only: all 17 implementation paths and repository-defined build inputs.

**Interfaces:**
- Consumes: completed Tasks 1-5.
- Produces: a commit-ready, still-unstaged checkpoint or a bounded remediation decision.

- [ ] **Step 1: Run the complete focused unit suite**

```bash
node --import tsx --test \
  tests/bounded-encounter-discovery.test.js \
  tests/class-journey.test.js \
  tests/expedition-ledger.test.js \
  tests/permanent-progress.test.js \
  tests/data-migration.test.js
```

Expected: all tests PASS with no skipped discovery cases.

- [ ] **Step 2: Run the real mobile surface**

```bash
npx playwright test \
  tests/e2e/content-pacing-encounters.spec.ts \
  tests/e2e/expedition-debrief.spec.ts \
  --project=chromium-mobile \
  --workers=1
```

Expected: all bounded-encounter and debrief tests PASS, including production movement safe return, receipt assertion preservation and replay no-op.

- [ ] **Step 3: Run static and domain gates**

```bash
npx tsc --noEmit
npm run lint
npm run content:verify
npm run pacing:verify
npm run event-reward:verify
npm run progression:diagnostic:verify
git diff --check
```

Expected: all PASS; no gameplay semantic evidence drift.

- [ ] **Step 4: Run repository-wide gates**

```bash
npm run verify
npm run verify:full
npm run art:verify
npm run mobile:doctor
npm run cap:sync
git status --short -- android ios
```

Expected: all repository gates PASS and Android/iOS tracked drift is zero. Android/iOS package builds are deferred because this slice changes no native packaging input; they remain final release-candidate gates.

- [ ] **Step 5: Recheck protected evidence aggregates**

Recompute the deterministic aggregate hashes for:

```text
docs/evidence/qa/release-complete-core/candidates/
docs/evidence/toss/releases/
```

Expected: exact equality with pre-task values. Do not stage either directory.

- [ ] **Step 6: Perform the independent Sol ultra review**

Review current bytes from four angles:

1. authority and replay — no discovery without exact accepted receipt and safe return;
2. migration and corruption — v1->v2 additive, malformed entries fail closed, permanent reset paths preserve;
3. player surface — correct representative selection, optional density, no identifier leakage, 390x844 reachability;
4. evidence and scope — numeric/report semantics unchanged, path boundary exact, protected artifacts preserved.

Acceptance: Critical `0`, Important `0`. Resolve Minor only when it is inside the 18-path boundary and behavior-preserving; otherwise record it honestly for a later slice.

- [ ] **Step 7: Prepare the approval packet without staging**

Report:

```text
HEAD and branch
exact 18-path set and sorted path-set SHA-256
unstaged diff fingerprint
focused/full gate counts
Progression evidence SHA-256 and unchanged semantic hashes
protected candidate/Toss aggregate hashes
Sol ultra findings by severity
latest task-ledger checkpoint
no commit/push/sign/publish statement
```

Request one separate approval for the cohesive implementation commit. Do not stage before approval.

---

## Cohesive Commit Boundary

Only after Task 6 is fully green and the user explicitly approves the exact checkpoint:

```text
feat: Class Journey 사건 발견 저장 추가 and safe-return discovery persistence 강화
```

The commit body must include `Background`, `Key changes`, `Implementation details`, `Impact`, `Test & Validation`, and `Notes`, using Korean for purpose/impact and English for technical contracts. Stage exactly the 18 approved paths. Exclude protected evidence directories, build outputs and all unrelated files. Push, candidate seal, signing and publication remain separate approvals.

## Completion Criteria

- Every valid accepted bounded encounter receipt for the active expedition can be projected deterministically without settlement replay, RNG or mutation.
- A safe return writes the same discovery set to the expedition summary and the snapshotted job's v2 Class Journey record.
- Defeat, abandonment, malformed/foreign receipts, rejected choices and replay add no discovery or sequence.
- Legacy Class Journey and expedition summaries migrate additively; permanent progress survives defeat, reset and ascension.
- Existing debrief/job surface renders one optional canonical Korean line with no raw identifiers, no overflow and reachable controls at 390x844; receipt assertions use the narrow test API rather than `render_game_to_text`.
- Focused tests, real mobile E2E, static/domain/full repository gates, mobile doctor and Capacitor sync pass.
- Progression v2 report semantics, event reward, content, pacing, gameplay numerics and top-level save version remain unchanged.
- Protected candidate/Toss evidence remains byte-identical.
- Sol ultra review reports Critical `0`, Important `0`.
- No commit, push, signing, candidate seal or publication occurs without its separate approval.
