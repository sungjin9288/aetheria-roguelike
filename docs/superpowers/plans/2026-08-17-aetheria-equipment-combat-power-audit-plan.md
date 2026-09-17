# Aetheria Equipment Combat-Power Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in the isolated Goal worktree. The Goal coordinator is the only dispatcher; do not create additional agents.

**Goal:** Audit all 229 canonical equipment identities through production stat authority, classify every slot/tier outlier without changing any catalog stat, and emit tamper-evident evidence that decides whether a narrower balance re-plan is required.

**Architecture:** Reuse `CANONICAL_EQUIPMENT`, `validateCanonicalEquipmentCatalog`, class definitions, tier level gates, `buildClassVitals`, and `calculateFullStats`. A pure report builder projects each item into eligible canonical jobs at its tier checkpoint, records raw and effective stat deltas, evaluates dimension-preserving cohort corridors, and classifies only detected outliers. A strict Node CLI owns SHA-256 evidence writing and byte verification; production item data remains read-only.

**Tech Stack:** TypeScript, Node.js `node:test`, `tsx`, Node `crypto`, existing React/Vite game data and audit patterns.

## Global Constraints

- Exact catalog coverage is weapon `117`, armor `91`, shield/focus `21`, total `229`.
- This slice changes no equipment `val`, `tier`, `hands`, HP/MP bonus, crit, evasion, element, jobs, price, signature identity, description, shop route, art route, or runtime behavior.
- Compare within exact `slot + tier` cohorts. Preserve ATK/DEF, hands, HP/MP, crit/evasion, element, job breadth and signature identity as separate dimensions; do not collapse them into an arbitrary universal scalar.
- Cohort medians and IQR corridors are descriptive only. A hard domination decision must compare literal production deltas for every job declared by the candidate item; a potential dominator's extra jobs must never dilute or hide that comparison.
- Signature identity remains an explicit classification dimension. A signature candidate can justify an intentional trade-off, but a stronger signature dominator does not by itself excuse a non-signature candidate that is strictly worse for every shared usable job at the same slot and tier.
- Use production `buildClassVitals` and `calculateFullStats` for effective deltas. Do not duplicate their formulas in the audit or tests.
- Existing active-run equipment snapshots and save migration behavior are outside the write scope and must remain byte-stable.
- Every outlier is exactly one of `intentional`, `specialized-sidegrade`, `price-only-defect`, or `combat-power-defect`. Non-outliers are `in-corridor`.
- A reported `combat-power-defect` does not authorize a stat edit. It sets `requiresReplan: true` and identifies one exact slot+tier cohort for a later Sol xhigh plan.
- No package/ledger update, commit, push, native build, signing, Apps in Toss, publication, `build/`, `android/`, `ios/`, or `docs/evidence/toss/releases/` mutation is allowed in this Goal.

---

### Task 1: Lock catalog, schema and production-projection RED contracts

**Files:**
- Create: `tests/equipment-combat-power-audit.test.js`
- Create: `src/systems/equipmentCombatPowerAudit.ts`

**Interfaces:**
- Consumes: `CANONICAL_EQUIPMENT`, `validateCanonicalEquipmentCatalog`, `CLASSES`, `CONSTANTS.TIER_REQ_LEVEL`, `buildClassVitals`, `calculateFullStats`.
- Produces: `buildEquipmentCombatPowerReport(options?: EquipmentCombatPowerAuditOptions): EquipmentCombatPowerReport`.

- [ ] **Step 1: Write the missing-module RED**

  Import `buildEquipmentCombatPowerReport` from the new system and assert literal catalog totals `229/117/91/21`, exact tier cohorts, deterministic deep equality, one row per canonical identity, and a non-empty eligible-job projection for every row.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `node --import tsx --test tests/equipment-combat-power-audit.test.js`

  Expected: `ERR_MODULE_NOT_FOUND` for `equipmentCombatPowerAudit`.

- [ ] **Step 3: Add malformed-catalog RED vectors before implementation**

  Mutate one row at a time with `val: NaN`, `tier: 0`, weapon `hands: 3`, armor `hands: 1`, `jobs: '전사'`, `jobs: ['없는직업']`, non-finite HP/MP/crit/evasion values, an unknown element, a duplicate identity and a removed identity. Each report must return a stable error and `ok: false`; it must never silently omit the row or coerce the value.

- [ ] **Step 4: Implement the smallest typed catalog projection**

  Add exact option injection for tests while defaulting to production authorities. Validate the full supplied catalog before projection. For each row, build an eligible canonical player at `CONSTANTS.TIER_REQ_LEVEL[row.tier]`, apply the item to its real slot, and record literal per-job deltas from `calculateFullStats(itemPlayer) - calculateFullStats(baselinePlayer)` for `atk`, `def`, `maxHp`, `maxMp`, `crit` and `evasion`.

- [ ] **Step 5: Verify GREEN and mutation sensitivity**

  Run the focused test. Temporarily replace one production delta with zero and confirm the literal projection assertion fails, then restore it.

### Task 2: Classify cohort outliers without flattening combat dimensions

**Files:**
- Modify: `src/systems/equipmentCombatPowerAudit.ts`
- Modify: `tests/equipment-combat-power-audit.test.js`

**Interfaces:**
- Produces per-row `dimensions`, `eligibleJobDeltas`, `cohortPosition`, `classification`, `classificationReasons`.
- Produces top-level `classificationCounts`, `outliers`, `combatPowerDefects`, `requiresReplan`, `replanCohorts`.

- [ ] **Step 1: Write corridor and classification RED tests**

  Assert every detected outlier has exactly one allowed classification and at least one stable reason. Assert non-outliers are `in-corridor`. Inject controlled same-cohort rows to prove: a unique secondary-stat/element benefit becomes `specialized-sidegrade`; a signature identity or deliberate job-breadth/hand trade-off becomes `intentional`; an isolated price discontinuity with comparable dimensions becomes `price-only-defect`; and strict multidimensional domination without a unique benefit becomes `combat-power-defect` with the exact cohort in `replanCohorts`. Add a broader-dominator regression where the dominator's aggregate median is lower because of extra jobs but its literal delta is greater-or-equal for every candidate job; the candidate must still be a defect.

- [ ] **Step 2: Define dimension-preserving cohort positions**

  For each slot+tier cohort, summarize each numeric dimension independently with count/min/median/max and a deterministic interquartile corridor. Record hands, element, eligible job set and signature identity as categorical dimensions. Never add unlike dimensions together.

- [ ] **Step 3: Implement deterministic classification priority**

  Apply one priority order: hard multidimensional domination with no candidate-side playable benefit → `combat-power-defect`; isolated current-price discontinuity with in-corridor combat dimensions → `price-only-defect`; out-of-corridor combat dimension paired with a unique secondary/element/hand/job trade-off → `specialized-sidegrade`; declared signature or broad-access identity whose raw trade-off is explicit → `intentional`; otherwise remain `in-corridor`. Hard domination requires the same slot role and tier, candidate jobs to be a subset of dominator jobs, dominator price no greater than candidate price, no greater hand occupancy, the same element, and literal `atk/def/maxHp/maxMp/crit/evasion` production deltas greater-or-equal for every candidate job with at least one strict improvement. Raw `val` and cohort medians must not participate in this decision. Normalize only floating crit/evasion noise with one fixed tolerance. Stable-sort all dominators, pairs and reasons by canonical identity.

- [ ] **Step 4: Bind the live catalog result without changing data**

  Add literal tests for current classification totals, every live `combat-power-defect` identity/cohort and every per-job domination pair discovered by the pure report. The Sol xhigh remediation probe expects `레인저 외투 ← 강화가죽갑옷`, `독아 채찍 ← 독사의 송곳니`, `성운 지팡이 ← 신전 도시의 지팡이`, and `폭풍 스태프 ← 고대 마탑 스태프` across `armor:T2`, `weapon:T3`, and `weapon:T5`; the exact rerun must confirm these four and stop for re-plan if it finds any additional or missing pair. If the live list is non-empty, the evidence must set `requiresReplan: true`; do not edit the catalog in this Goal.

- [ ] **Step 5: Run focused GREEN**

  Run: `node --import tsx --test tests/equipment-combat-power-audit.test.js`

### Task 3: Add strict deterministic evidence and verifier

**Files:**
- Create: `scripts/verify-equipment-combat-power.mjs`
- Create: `docs/evidence/qa/release-complete-core/equipment-combat-power.json`
- Modify: `tests/equipment-combat-power-audit.test.js`

**Interfaces:**
- CLI: `node scripts/verify-equipment-combat-power.mjs --write docs/evidence/qa/release-complete-core/equipment-combat-power.json`.
- CLI: `node scripts/verify-equipment-combat-power.mjs --verify docs/evidence/qa/release-complete-core/equipment-combat-power.json`.

- [ ] **Step 1: Write CLI grammar and no-write RED tests**

  Reject missing mode/path, unknown or duplicate flags, simultaneous `--write` and `--verify`, absolute/dot/traversal/backslash/symlink paths, wrong fixed evidence path, and extra positional arguments before any write. Verify mode must preserve exact bytes on success and failure.

- [ ] **Step 2: Implement strict evidence envelope**

  Use Node `crypto` SHA-256 over stable canonical JSON. Bind schema version, policy version, full canonical catalog projection, class/tier authority hashes, signature registry and signature-set authority hashes, production stat-owner source hashes, report hash, classification totals, every outlier, every domination pair and per-job comparison, `requiresReplan`, and exact source-file hashes. Write atomically only in `--write`; compare exact regenerated bytes in `--verify`.

- [ ] **Step 3: Add tamper RED tests**

  Mutate catalog hash, one row dimension, one eligible-job delta, one classification/reason, classification totals, report hash, source hash and trailing bytes. Every mutation must return non-zero and preserve the target bytes.

- [ ] **Step 4: Generate and verify canonical evidence**

  Run the write command once, then the verify command. Record full report SHA-256 and evidence-file SHA-256 in the worker handoff.

### Task 4: Bounded integration and owner handoff

**Files:**
- Read-only verification of all files outside the five writable paths.

**Interfaces:**
- Produces worker evidence with exact changed paths, RED/GREEN outputs, source snapshot, report hash and re-plan decision.

- [ ] **Step 1: Run all bounded gates**

  ```bash
  node --import tsx --test tests/equipment-combat-power-audit.test.js tests/equipment-economy-audit.test.js tests/item-visuals.test.js
  node scripts/verify-equipment-combat-power.mjs --verify docs/evidence/qa/release-complete-core/equipment-combat-power.json
  npm run equipment:economy:verify
  npx tsc --noEmit
  npm run lint -- --quiet
  npm run verify
  git diff --check
  ```

- [ ] **Step 2: Audit the exact scope**

  Confirm only the four worker-writable audit paths differ from the isolated baseline and the owner-authored plan is byte-preserved. Confirm `src/data/items.ts`, save/migration code, package/ledgers, `build/`, native trees and Toss evidence are unchanged.

- [ ] **Step 3: Hand off one decision**

  If `combatPowerDefects` is empty, report audit closure and let the Goal owner proceed to consumables. If non-empty, report the exact identities and single affected slot+tier cohort; the Goal owner must open a new Sol xhigh re-plan before any numeric edit.

## Acceptance and rollback

- The Goal is acceptable when deterministic audit/evidence is GREEN even if it truthfully identifies a defect; audit completion and balance acceptance are separate claims.
- Any unexpected production-data mutation, cross-cohort numeric proposal, arbitrary composite score, median-based domination shortcut, unresolved malformed value, missing classification or evidence mismatch fails the Goal.
- Rollback is removal of the four worker outputs plus this owner-authored plan. Because the slice changes no runtime/catalog bytes, no save or gameplay rollback is needed.
- Commit and push remain separately authorized. The Goal worker must not create either.

## Self-review

- Spec coverage: exact 229 coverage, production effective stats, hands, HP/MP, crit/evasion, element, job breadth, signature, four outlier classes, no stat changes, evidence, TDD and re-plan boundary are each assigned above.
- Placeholder scan: the plan contains no `TBD`, deferred implementation, unspecified edge handling or mirrored formula.
- Type consistency: all later tasks consume `buildEquipmentCombatPowerReport`, `EquipmentCombatPowerReport`, `classification`, `combatPowerDefects`, `requiresReplan` and `replanCohorts` exactly as defined in Tasks 1–2.
