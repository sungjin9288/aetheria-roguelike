# Aetheria Combat Loot Capacity Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make production combat loot respect `maxInv` while keeping inventory, Codex, signature pity, logs, digest and build hints on one admitted-item truth.

**Architecture:** Keep `processLoot()` as the only random drop authority, add item-level log provenance without changing its existing aggregate outputs, and pass its candidates through one pure stable signature-first capacity function. `handleVictoryOutcome()` performs admission once and feeds only admitted candidates to every downstream consumer; the existing reducer receipt continues to own replay safety.

**Tech Stack:** React 19, TypeScript, Node.js test runner, deterministic reducer transactions, Vite, Capacitor.

**Spec:** `docs/superpowers/specs/2026-08-24-aetheria-combat-loot-capacity-settlement-design.md`

## Global Constraints

- Base checkpoint is `0e2ccd8`; revalidate HEAD and dirty fingerprint immediately before Goal start.
- `processLoot()` chance math, RNG call order, item IDs, item order, `items` and `logs` aggregate behavior remain unchanged.
- Admission is deterministic and random-free: signature candidates first, normal candidates second, stable order inside each group.
- Only admitted candidates reach inventory, Codex, season XP, signature pity reset, acquisition logs, digest and build hints.
- A blocked boss signature is not acquired and does not reset pity; boss miss increments pity exactly once.
- Existing over-cap inventories are preserved and receive no new rolled combat loot.
- No pending receipt, save schema, migration, UI component, dependency, telemetry event or balance numeric change.
- Milestone fixed items, endgame key items and quest reward delivery are outside this plan.
- `src/reducers/handlers/combatHandlers.ts` is read-only. A RED proving a victory path bypasses `settleVictory()` is a material plan gap and returns to Sol xhigh.
- Preserve `docs/evidence/qa/release-complete-core/candidates/` and `docs/evidence/toss/releases/`; never use a broad `git add`.
- Refresh only `docs/evidence/qa/release-complete-core/relic-drop-rate.json` and `docs/evidence/qa/release-complete-core/relic-event-chance.json` after the final Task 1 source/test bytes are fixed. Both semantic `report` values and `reportHash` values must remain unchanged while only their declared source provenance advances.
- The Luna worker may not commit, push, merge, sign, publish, refresh historical candidate/Toss evidence or assign a candidate identity.

## Goal Execution Contract

Use one isolated native Goal with GPT A as owner/verifier and GPT B `gpt-5.6-luna/max` as the only implementation writer.

Exact writable paths:

```text
src/systems/CombatEngine.loot.ts
src/systems/combatLootCapacity.ts
src/hooks/combatActions/combatVictory.ts
src/data/messages.ts
tests/combat-loot-capacity-authority.test.js
tests/combat-engine-loot.test.js
tests/loot-cycle.test.js
tests/combat-action-transaction-authority.test.js
tests/combat-item-transaction-authority.test.js
docs/evidence/qa/release-complete-core/relic-drop-rate.json
docs/evidence/qa/release-complete-core/relic-event-chance.json
docs/evidence/qa/release-complete-core/requirement-matrix.md
docs/evidence/qa/release-complete-core/completion-summary.md
tasks/todo.md
progress.md
```

The owner may amend the spec and this plan only to record a Sol xhigh-approved command or scope
correction. Other read-only authorities include `src/reducers/handlers/combatHandlers.ts`,
`src/systems/combatActionTurn.ts`, `src/systems/combatItemTurn.ts`, `src/data/dropTables.ts`,
`src/data/signatureItems.ts`, `src/data/constants.ts`, `src/utils/signaturePity.ts` and `package.json`.

Stop with `replan` before mutation outside the exact writable paths or when implementation would need UI markup, a new player/save field, a dependency, a balance number, a reducer routing change, string parsing for log provenance, or a mirrored simulator-only capacity rule.

---

### Task 1: Bind per-item loot provenance without changing drop behavior

**Files:**
- Modify: `tests/combat-engine-loot.test.js`
- Modify: `src/systems/CombatEngine.loot.ts`
- Refresh deterministically after final source/test bytes: `docs/evidence/qa/release-complete-core/relic-drop-rate.json`
- Refresh deterministically after final source bytes: `docs/evidence/qa/release-complete-core/relic-event-chance.json`

**Interfaces:**
- Consumes: current `processLoot(enemy, player, signaturePityMult, rng, now)`.
- Produces:

```ts
export type LootLog = { type: string; text: string };
export type LootCandidate = { item: Item; logs: LootLog[] };
export type LootResult = {
    candidates: LootCandidate[];
    items: Item[];
    logs: LootLog[];
};
```

- Compatibility invariant: `result.items === result.candidates.map(({ item }) => item)` by deep value and `result.logs === result.candidates.flatMap(({ logs }) => logs)` by deep value.

- [ ] **Step 1: Add the failing provenance tests**

Add controlled cases for enriched, legacy, high-level bonus and prestige drops. Each case records the existing result first, then asserts the new candidate contract:

```js
const result = processLoot(enemy, player, 1, controlledRandom(rolls), () => 1_700_000_000_000);

assert.deepEqual(result.items, result.candidates.map(({ item }) => item));
assert.deepEqual(result.logs, result.candidates.flatMap(({ logs }) => logs));
assert.equal(result.candidates.length, result.items.length);
assert.ok(result.candidates.every(({ item, logs }) => item && Array.isArray(logs)));
```

For a prefixed or prestige item, assert that `candidate.logs` contains that item's acquisition-specific messages and no other candidate's item name. Run the same fixture twice with fresh controlled RNG counters and assert equal results and equal call counts.

- [ ] **Step 2: Run RED and record the expected failure**

Run:

```bash
node --import tsx --test tests/combat-engine-loot.test.js
```

Expected RED: `result.candidates` is missing or not iterable. A failure caused by drop setup, import or syntax is not an accepted RED.

- [ ] **Step 3: Add a single candidate append authority**

In `CombatEngine.loot.ts`, import `Item` and define the exported types. Replace parallel direct pushes with one local helper:

```ts
const candidates: LootCandidate[] = [];

const appendCandidate = (item: Item, candidateLogs: LootLog[]) => {
    candidates.push({ item, logs: candidateLogs });
};
```

For each existing successful drop branch, build exactly the messages currently pushed for that item, then call `appendCandidate(item, candidateLogs)`. Do not add or remove an RNG call. Return derived aggregates:

```ts
const items = candidates.map(({ item }) => item);
const logs = candidates.flatMap((candidate) => candidate.logs);
return { candidates, items, logs };
```

All early returns must return the same three keys with empty arrays when there are no candidates.

- [ ] **Step 4: Run focused GREEN before evidence refresh**

Run:

```bash
node --import tsx --test tests/combat-engine-loot.test.js
```

Expected GREEN: all provenance tests pass, controlled RNG counts remain equal and existing `items`/`logs` assertions remain unchanged.

- [ ] **Step 5: Refresh deterministic relic drop-rate provenance and run compatibility**

Only after the final Task 1 source and test bytes are fixed, run:

```bash
node scripts/verify-relic-drop-rate.mjs --write docs/evidence/qa/release-complete-core/relic-drop-rate.json
npm run relic:drop-rate:verify
node scripts/verify-relic-event-chance.mjs --write docs/evidence/qa/release-complete-core/relic-event-chance.json
npm run relic:event-chance:verify
node --import tsx --test tests/relic-event-chance-coherence.test.js
node --import tsx --test tests/combat-engine-loot.test.js tests/loot-cycle.test.js tests/relic-drop-rate-coherence.test.js tests/prestige-unlocks.test.js
```

Expected GREEN: both verifiers and all tests pass. Compare each regenerated evidence file to its preimage: `report` and `reportHash` are identical. In `relic-drop-rate.json`, only the final Task 1 source provenance hashes change. In `relic-event-chance.json`, only `authorityHashes.combatLoot` advances to the final `CombatEngine.loot.ts` SHA-256 while every other authority hash remains unchanged. Candidate/Toss evidence remains untouched.

- [ ] **Step 6: Review Task 1 before continuing**

Inspect the two code/test files and the deterministic evidence refresh. Reject any string-based item/log matching, changes to chance math, new random calls, item reordering, changed semantic report bytes or unrelated cleanup. Record the RED command, expected failure and GREEN count in the Goal report. Do not commit.

---

### Task 2: Implement the pure stable capacity admission boundary

**Files:**
- Create: `tests/combat-loot-capacity-authority.test.js`
- Create: `src/systems/combatLootCapacity.ts`

**Interfaces:**
- Consumes: `Player`, `LootCandidate`, `BALANCE.INV_MAX_SIZE`, `isSignatureItem()`.
- Produces:

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

- [ ] **Step 1: Write RED tests for capacity and ordering**

Use `성검 에테르니아` as the canonical signature and `하급 체력 물약`, `중급 체력 물약` as normal candidates. Create one-log candidates with unique text. Cover:

```js
const result = admitCombatLoot(
    { ...player, maxInv: 3, inv: [{ id: 'occupied' }, { id: 'occupied-2' }] },
    [normalA, signature, normalB],
);

assert.equal(result.capacity, 3);
assert.equal(result.occupied, 2);
assert.equal(result.available, 1);
assert.deepEqual(result.admitted.map(({ item }) => item.name), ['성검 에테르니아']);
assert.deepEqual(result.blocked.map(({ item }) => item.name), ['하급 체력 물약', '중급 체력 물약']);
```

Also assert:

- empty candidates return empty admitted/blocked arrays;
- expanded `maxInv:25` is honored;
- `maxInv` undefined, `NaN`, zero, negative or non-integer falls back to `BALANCE.INV_MAX_SIZE`;
- full and already-overflowed inventory admit zero candidates without deleting existing items;
- multiple signatures preserve their original order, followed by normals in original order;
- input player, inventory, candidates, items and logs are deep-equal to preimages after the call;
- outputs are new arrays and contain original candidate identities.

- [ ] **Step 2: Run RED and verify the missing module is the only cause**

Run:

```bash
node --import tsx --test tests/combat-loot-capacity-authority.test.js
```

Expected RED: `ERR_MODULE_NOT_FOUND` for `src/systems/combatLootCapacity.ts` or missing `admitCombatLoot`. Fix fixture/import errors until this is the precise failure.

- [ ] **Step 3: Implement the smallest pure function**

Resolve capacity without coercing malformed values:

```ts
const positiveSafeInteger = (value: unknown): value is number => (
    Number.isSafeInteger(value) && Number(value) > 0
);

const capacity = positiveSafeInteger(player.maxInv)
    ? player.maxInv
    : positiveSafeInteger(BALANCE.INV_MAX_SIZE)
        ? BALANCE.INV_MAX_SIZE
        : null;

if (capacity === null) throw new Error('INVALID_INVENTORY_CAPACITY');
```

Compute `occupied`, clamp `available` at zero, use two `filter()` calls for a stable signature/normal partition, concatenate them once, then slice into admitted and blocked arrays. Do not sort, clone candidates, mutate inputs or accept RNG.

- [ ] **Step 4: Run GREEN and type-check the interface**

Run:

```bash
node --import tsx --test tests/combat-loot-capacity-authority.test.js
npx tsc --noEmit
```

Expected GREEN: all admission cases pass and TypeScript reports no error.

- [ ] **Step 5: Review Task 2 before continuing**

Confirm the function imports production signature and capacity authorities, has no `Math.random`, `Date`, sort comparator, item cloning or player mutation. Record focused counts. Do not commit.

---

### Task 3: Settle only admitted candidates through victory consumers

**Files:**
- Modify: `tests/combat-loot-capacity-authority.test.js`
- Modify: `tests/loot-cycle.test.js`
- Modify: `src/hooks/combatActions/combatVictory.ts`
- Modify: `src/data/messages.ts`

**Interfaces:**
- Consumes: Task 1 `LootResult.candidates`, Task 2 `admitCombatLoot()`.
- Produces: admitted-only inventory/Codex/pity/log/digest/hint settlement and `MSG.COMBAT_LOOT_CAPACITY_BLOCKED(count)`.

- [ ] **Step 1: Add controlled reducer RED cases**

Temporarily install a guaranteed `DROP_TABLES` entry for a unique training enemy and restore the original entry in `afterEach`. Put a normal item before `성검 에테르니아` in the table, set inventory to `maxInv - 1`, and resolve one deterministic attack victory through `makeCombatActionMap(INITIAL_STATE.player).RESOLVE_COMBAT_ACTION`.

Assert:

```js
assert.equal(won.player.inv.length, won.player.maxInv);
assert.ok(won.player.inv.some(({ name }) => name === '성검 에테르니아'));
assert.ok(!won.player.inv.some(({ name }) => name === blockedNormalName));
assert.ok(won.logs.some(({ text }) => text === MSG.COMBAT_LOOT_CAPACITY_BLOCKED(1)));
assert.ok(!won.logs.some(({ text }) => text.includes(blockedNormalName)));
```

Use existing Codex helpers/state shape to assert the signature is registered and the blocked normal is not. Assert digest and upgrade/trait hint text cannot mention the blocked name.

Add a full-inventory boss case with guaranteed signature and `signaturePity:4`:

```js
assert.equal(won.player.inv.length, won.player.maxInv);
assert.equal(won.player.stats.signaturePity, 5);
assert.ok(!won.player.inv.some(({ name }) => name === '성검 에테르니아'));
assert.ok(!won.logs.some(({ text }) => text.includes('성검 에테르니아')));
```

Add a one-slot boss case proving admitted signature resets pity to `0`, and a normal-monster blocked signature fixture proving pity remains unchanged.

- [ ] **Step 2: Run RED and record the overflow/false-pity evidence**

Run:

```bash
node --import tsx --test tests/combat-loot-capacity-authority.test.js
```

Expected RED: inventory exceeds capacity, the normal item is admitted before signature, blocked logs leak, or blocked signature resets pity. At least one behavioral assertion must fail on the pre-fix source.

- [ ] **Step 3: Wire one admission result into every consumer**

Immediately after `processLoot()`:

```ts
const lootAdmission = admitCombatLoot(updatedPlayer, lootResult.candidates);
const admittedCandidates = lootAdmission.admitted;
const blockedCandidates = lootAdmission.blocked;
const admittedItems = admittedCandidates.map(({ item }) => item);
const admittedLogs = admittedCandidates.flatMap(({ logs }) => logs);
```

Replace every `lootResult.items` downstream read in `handleVictoryOutcome()` with `admittedItems`. Forward only `admittedLogs`. Register only `admittedItems` to Codex. Compute `signatureDropped` only from `admittedItems`. Pass only admitted names/items to digest, upgrade hint and trait hint.

Synchronize the two existing static callsite guards in `tests/loot-cycle.test.js` so they require
`admittedItems` for `getLootUpgradeHint()` and `getTraitLootHint()`; keep their helper-signature and
body guards unchanged.

Add the message authority:

```ts
COMBAT_LOOT_CAPACITY_BLOCKED: (count: number) =>
    `가방이 가득해 전리품 ${count}개를 챙기지 못했습니다.`,
```

Emit it once after admitted acquisition logs and before combat digest when `blockedCandidates.length > 0`. Do not include blocked names.

- [ ] **Step 4: Run focused GREEN**

Run:

```bash
node --import tsx --test tests/loot-cycle.test.js tests/combat-loot-capacity-authority.test.js tests/combat-engine-loot.test.js tests/signature-pity.test.js tests/signature-codex-pity-status.test.js tests/expedition-ledger.test.js tests/milestone-story.test.js
npx tsc --noEmit
npm run lint
```

Expected GREEN: admitted-only cases, existing loot/pity/Codex/milestone behavior, type-check and lint pass.

- [ ] **Step 5: Review Task 3 before continuing**

Search `combatVictory.ts` for downstream `lootResult.items` and `lootResult.logs`; after the admission declaration there must be zero consumer reads. Confirm the aggregate result remains available for other callers and blocked item names never enter logs. Do not commit.

---

### Task 4: Lock reducer convergence, stale input and replay idempotency

**Files:**
- Modify: `tests/combat-loot-capacity-authority.test.js`
- Modify only if the existing assertion belongs there: `tests/combat-action-transaction-authority.test.js`
- Modify only if the existing assertion belongs there: `tests/combat-item-transaction-authority.test.js`

**Interfaces:**
- Consumes: existing `makeCombatActionMap()` victory receipt and expected-turn checks.
- Produces: regression proof that all supported victory origins reach the same capacity settlement without new reducer routing.

- [ ] **Step 1: Add exact transaction regressions**

For direct attack/skill victory, full-inventory boss victory, DOT victory and combat-item victory, assert inventory never exceeds capacity and each action produces exactly one victory receipt. Replay the identical action:

```js
const replayed = actionMap.RESOLVE_COMBAT_ACTION(won, action);
assert.equal(replayed, won);
```

For combat items use `USE_COMBAT_ITEM`; the consumed item may free one slot, so assert the admitted count matches the resulting free space. For stale expected turn, assert the original state object, inventory, pity, Codex, logs and RNG-observable state remain identical.

Do not duplicate cases already present in the transaction authority files. Extend the nearest existing case only when it makes the convergence assertion clearer; otherwise keep all new assertions in the new capacity test.

- [ ] **Step 2: Run RED or characterization GREEN correctly**

Run:

```bash
node --import tsx --test tests/combat-loot-capacity-authority.test.js tests/combat-action-transaction-authority.test.js tests/combat-item-transaction-authority.test.js
```

Expected result: new capacity assertions that were not covered in Task 3 must fail before their minimal fix; pre-existing replay/stale characterization assertions may already pass and must be labeled as characterization, not claimed as RED.

- [ ] **Step 3: Make only the minimal settlement correction if a new RED remains**

Fix only `combatVictory.ts` or the capacity helper. Do not edit `combatHandlers.ts`. If any route bypasses `settleVictory()`, stop and return `replan` with the failing test and exact call path.

- [ ] **Step 4: Run convergence GREEN**

Run:

```bash
node --import tsx --test tests/combat-loot-capacity-authority.test.js tests/combat-action-transaction-authority.test.js tests/combat-item-transaction-authority.test.js tests/endgame-settlement.test.js
```

Expected GREEN: all supported victory origins respect capacity and replay/stale actions remain exact no-op.

- [ ] **Step 5: Review Task 4 before continuing**

Confirm `git diff -- src/reducers/handlers/combatHandlers.ts` is empty and no new receipt, dispatch, async callback or victory branch exists. Record whether the two existing transaction test files changed; untouched conditional paths must remain absent from the final writable diff. Do not commit.

---

### Task 5: Synchronize evidence and repository ledger

**Files:**
- Modify: `docs/evidence/qa/release-complete-core/requirement-matrix.md`
- Modify: `docs/evidence/qa/release-complete-core/completion-summary.md`
- Modify: `tasks/todo.md`
- Modify: `progress.md`

**Interfaces:**
- Consumes: exact focused test receipts and current implementation diff.
- Produces: one cold-resumable checkpoint that does not claim candidate seal, physical QA, signing or publication.

- [ ] **Step 1: Capture the exact implementation evidence**

Record:

- pre-fix reproduction: previous inventory length, cap and post-victory overflow;
- Task 1–4 RED reason and GREEN counts;
- controlled partial/full/signature/pity/replay scenario results;
- `processLoot()` RNG and aggregate compatibility result;
- exact modified paths;
- historical evidence directories preserved and excluded.

- [ ] **Step 2: Update coupled docs without inventing release status**

Add one current checkpoint entry to `tasks/todo.md` in the repository's existing style. Update the requirement matrix and completion summary with the same source truth. Update `progress.md` with the task sequence and remaining gates. State explicitly:

```text
candidate seal: not assigned
human observation: not refreshed
push/signing/publication: not performed
Progression Simulator v2: blocked until this prerequisite is committed and post-commit verified
```

- [ ] **Step 3: Run documentation and scope checks**

Run:

```bash
rg -n "capacity|signature|pity|candidate seal|Progression Simulator v2" docs/evidence/qa/release-complete-core/requirement-matrix.md docs/evidence/qa/release-complete-core/completion-summary.md tasks/todo.md progress.md
git diff --check
git status --short
```

Expected: four documents agree, no whitespace error, and only actual implementation paths plus the two preserved historical directories appear.

- [ ] **Step 4: Review Task 5 before continuing**

Reject stale test counts, candidate identities, human observations or native artifact claims not produced by this Goal. Do not refresh screenshot, candidate or Toss evidence. Do not commit.

---

### Task 6: Run full gates and hand the exact diff to Sol xhigh

**Files:**
- Verify all changed paths; only the Sol xhigh-approved stale static-guard and owner contract-document corrections are expected here.

**Interfaces:**
- Consumes: Tasks 1–5 verified diff.
- Produces: Luna implementation report, Goal worker evidence and a read-only Sol xhigh review package.

- [ ] **Step 1: Run the complete focused gate**

```bash
node --import tsx --test tests/loot-cycle.test.js tests/combat-loot-capacity-authority.test.js tests/combat-engine-loot.test.js tests/combat-action-transaction-authority.test.js tests/combat-item-transaction-authority.test.js tests/signature-pity.test.js tests/signature-codex-pity-status.test.js tests/endgame-settlement.test.js
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
npx tsc --noEmit
npm run lint
git diff --check
```

Expected: every command exits zero. The comparison uses an ephemeral, unregistered audit candidate,
returns `classification: report-only` with `activationReady:false`, and reports only
`production_funnel_evidence_missing` and `full_combat_model_unavailable` as blockers. No gameplay
profile activates or persists.

- [ ] **Step 2: Run repository and mobile regression gates**

```bash
npm run verify
npm run verify:full
npm run art:verify
npm run mobile:doctor
npm run cap:sync
git status --short -- android ios
```

Expected: full web gates pass, art catalog is valid, mobile diagnostics and Capacitor sync pass, and tracked Android/iOS source drift is empty. Signing and physical-device blockers remain environmental, not app regressions.

- [ ] **Step 3: Produce the Luna worker report**

The report must contain:

```text
status: DONE or DONE_WITH_CONCERNS
base HEAD and source dirty fingerprint
files modified
RED receipts and expected failure reasons
focused/full commands with exact pass counts
historical evidence preservation result
remaining risks and conditional paths left untouched
commit/push/signing/publish: not performed
```

- [ ] **Step 4: Run independent Sol xhigh review**

GPT A reviews the actual worker diff, spec, plan, source preimages, tests and every acceptance criterion. Review angles are correctness, scope, pity/Codex/log consistency, RNG determinism, replay idempotency, evidence honesty and maintainability. Any material finding returns one bounded remediation contract to Luna; an architecture gap returns to Sol xhigh re-plan.

- [ ] **Step 5: Close the Goal without repository-history mutation**

Only after worker and canonical verification pass, sync the exact allowed diff to the canonical checkout and mark the native Goal passed. Do not stage or commit. Present the verified cohesive diff and ask separately for one grouped commit approval. Push, candidate seal, signing and publication stay outside this plan.

## Plan Self-Review Record

- Spec coverage: Sections 1–15 are mapped to Tasks 1–6; fixed milestone/endgame item delivery remains explicitly excluded.
- Placeholder scan: 모든 단계가 실제 코드·검증 명령·expected result를 포함하며 미완성 표시는 없다.
- Interface consistency: `LootCandidate`, `LootResult`, `CombatLootAdmission` and `admitCombatLoot()` names are identical in every task.
- Scope consistency: the executor has exactly 15 writable paths after the Sol xhigh evidence-provenance and stale-static-guard re-plans; `combatHandlers.ts` remains read-only. The owner amended only this plan and the spec command contract after Sol xhigh found the original comparison command was not executable.
- Delivery consistency: no worker commit, push, signing, publish, candidate seal or historical evidence refresh is authorized.
