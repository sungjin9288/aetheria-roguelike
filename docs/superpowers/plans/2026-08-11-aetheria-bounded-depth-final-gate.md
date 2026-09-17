# Aetheria Bounded Encounter Depth and Final Completion Gate Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `aetheria-openspace-content` and `develop-web-game` for content work, then `aetheria-openspace-playtest`, `aetheria-roguelike-mobile-qa`, `release-evidence`, `verify-gate`, and `task-ledger-sync`.

**Goal:** core persistence/endgame/mobile closure가 통과한 뒤 실제 fresh-session evidence가 가리키는 상위 두 지역에만 deterministic encounter depth를 추가하고, fresh→midgame→endgame→New Game+ 전체 journey를 browser/mobile/native evidence로 닫는다.

**Architecture:** 새로운 event probability를 추가하지 않는다. 기존 narrative-event 선택 지점에서 eligibility resolver가 선택된 지역의 bounded encounter family를 우선 제안하고, 선택되지 않으면 current fallback path를 byte-equivalently 유지한다. Encounter content is data; eligibility/cost/application is pure code with a stable receipt.

**Tech Stack:** existing event engine, event presentation, seeded RNG, Node tests, Playwright, Capacitor, repository evidence ledger

## Entry Gate

Do not begin encounter authoring until Plans A/B focused gates and endgame E2E are green. Region selection additionally requires at least five valid fresh-session observations. If fewer than two regions have accepted actions, collect more observations; do not guess.

## Region Selection Algorithm

1. Count accepted `move`, `explore`, and `combat_start` actions by non-safe region.
2. Reject synthetic/test-only rows and mixed candidate/release IDs.
3. Sort by count descending, then Unicode region name ascending.
4. Select exactly the first two regions.
5. Bind candidate SHA, observation digest, counts and selected names in tracked evidence; raw observations stay ignored/untracked.

---

### Task C1: Create the Journey Requirement and Observation Evidence

**Files:**
- Create: `docs/evidence/qa/release-complete-core/requirement-matrix.md`
- Create: `docs/evidence/qa/release-complete-core/observation-summary.json`
- Create: `docs/evidence/qa/release-complete-core/region-selection.json`
- Modify: `tasks/todo.md`
- Modify: `progress.md`

- [ ] Define rows for fresh creation/first action/first return/job change, death/reset/ascend, shard progression, true boss, True Ending, New Game+, own grave, public grave absence, save/reload, back/lifecycle and three viewport geometry.
- [ ] Record opaque observation IDs and attachment hashes only; never commit nickname, user key, inventory dump, serial or free-form logs.
- [ ] Store candidate SHA, summary SHA, per-region counts, tie-break order and the two selected regions.
- [ ] Mark Toss as HOLD and distinguish Plan A/B local completion from full release-complete evidence.

---

### Task C2: Implement a Deterministic Region Selection Tool

**Files:**
- Create: `scripts/select-bounded-encounter-regions.mjs`
- Create: `tests/encounter-region-selection.test.js`
- Create after evidence is sufficient: `src/data/boundedEncounterSelection.json`

**Interface:**

~~~ts
export interface ObservedRegionAction {
    observationId: string;
    region: string;
    kind: 'move' | 'explore' | 'combat_start';
    accepted: boolean;
}

export const selectEncounterRegions = (
    actions: readonly ObservedRegionAction[],
    count: 2,
): string[];
~~~

- [ ] Write RED tests for count-descending/Unicode tie-break, rejected actions, duplicate observation rows, safe-region exclusion, mixed candidate IDs and fewer-than-two-region failure.
- [ ] Implement a pure selector and thin CLI with explicit input/output paths.
- [ ] Require `INSUFFICIENT_OBSERVED_REGIONS` nonzero exit instead of selecting guessed regions.
- [ ] Write `boundedEncounterSelection.json` only after the evidence gate passes; include `schemaVersion`, two region names, observation digest and `enabled:true`.
- [ ] Run:

~~~bash
node --import tsx --test tests/encounter-region-selection.test.js
node scripts/select-bounded-encounter-regions.mjs +  --input docs/evidence/qa/release-complete-core/observation-summary.json +  --output docs/evidence/qa/release-complete-core/region-selection.json
~~~

Expected before enough observations: nonzero exit, no fabricated output.

---

### Task C3: Lock the Encounter Schema and Pure Eligibility

**Files:**
- Create: `src/types/encounter.ts`
- Create: `src/data/boundedEncounters.ts`
- Create: `src/utils/boundedEncounterSelector.ts`
- Create: `tests/bounded-encounters.test.js`

**Schema:**

~~~ts
export interface BoundedEncounterChoice {
    id: string;
    label: string;
    tradeoff: string;
    outcome: BoundedEncounterOutcome;
}

export interface BoundedEncounter {
    id: string;
    version: 1;
    region: string;
    family: string;
    situation: string;
    eligibility: {
        lineage?: string[];
        hpBand?: 'critical' | 'strained' | 'healthy';
        requiresSignature?: boolean;
        previousBoss?: string;
    };
    choices: BoundedEncounterChoice[];
}
~~~

- [ ] Require exactly two families per selected region, at least two distinct choices, unique IDs and nonempty situation/tradeoff/result copy.
- [ ] Validate every region/job/boss/signature/item reference against the canonical catalog.
- [ ] Cover lineage, HP band, discovered signature, previous boss, wrong region and replayed receipt.
- [ ] Same seed must produce the same eligible encounter and outcome.
- [ ] Unknown/malformed data is ineligible, never partially applied.
- [ ] Reuse only HP/MP, gold, canonical item, existing buff and event-chain state.
- [ ] Reject non-finite/negative costs, HP below 1 and inventory overflow.
- [ ] Run RED then GREEN:

~~~bash
node --import tsx --test tests/bounded-encounters.test.js
~~~

---

### Task C4: Author Four Families from Existing Lore

**Files:**
- Modify: `src/data/boundedEncounters.ts`
- Modify only for shared canonical copy: `src/data/messages.ts`
- Extend: `tests/bounded-encounters.test.js`

- [ ] Read only the selected region entries in `src/data/maps.ts`, associated monsters and quests.
- [ ] Author two families per region without adding a region, boss, item, currency or runtime AI.
- [ ] Every family reads `situation → choice → expected trade-off → result`.
- [ ] At least one variation uses lineage/HP and one uses signature/previous boss.
- [ ] Ensure choices change state materially, not only copy.
- [ ] Lock canonical references, outcome uniqueness, costs and inventory behavior with tests.

---

### Task C5: Integrate Without Changing Event Frequency

**Files:**
- Modify: `src/hooks/gameActions/exploreActions.ts`
- Modify: `src/hooks/gameActions/eventActions.ts`
- Modify: `src/utils/eventPresentation.ts`
- Modify: `src/components/EventPanel.tsx` only for bounded presentation
- Extend the owning explore/event tests
- Extend: `tests/bounded-encounters.test.js`

- [ ] Characterize current event kind, RNG draw count and state result for fixed seeds before integration.
- [ ] Call `selectBoundedEncounter` only after the existing narrative-event roll is accepted.
- [ ] If none is eligible, invoke the existing fallback with the same next RNG state.
- [ ] Do not add another occurrence roll or alter map `eventChance`.
- [ ] Use existing event history/choice settlement authority. If a receipt is needed, key it by expedition ID + encounter ID + occurrence sequence and store it in existing event history/chain state.
- [ ] Replay must be exact no-op for reward and class journey/discovery.
- [ ] `EventPanel` shows situation, choice label and expected trade-off before click; result uses the existing surface.
- [ ] Run fixed-seed frequency characterization; total narrative-event occurrence count must be identical before/after.
- [ ] Run:

~~~bash
node --import tsx --test +  tests/bounded-encounters.test.js +  tests/explore-utils.test.js +  tests/ai-event-utils.test.js
~~~

Use the actual owning event-presentation test filename discovered by `rg --files tests`; do not create duplicate coverage solely to satisfy a command.

---

### Task C6: Prove the Full Player Journey on Real Surfaces

**Files:**
- Create: `tests/e2e/release-complete-core.spec.ts`
- Modify: `src/hooks/useGameTestApi.ts` only for bounded fresh-object checkpoint builders
- Create: `docs/evidence/qa/release-complete-core/browser-summary.md`
- Add selected captures under: `docs/evidence/qa/release-complete-core/screenshots/`

- [ ] Fresh route: create → first move → explore → combat → safe return → equipment decision → level-5 job change through real UI.
- [ ] Midgame route: production-derived checkpoint → skill branch → selected encounter → regional boss → Demon King → ascension cancel and confirm.
- [ ] Endgame route: rank 3 + shard 2 → Demon King → true boss → True Ending → New Game+ → reload.
- [ ] No fixture may pre-complete the transition under assertion.
- [ ] Run `375x667`, `390x844`, `430x932`; assert document/local overflow, modal bounds, touch targets, safe area and nearest-surface back.
- [ ] Verify background/foreground and forced reload restore the last accepted state.
- [ ] Verify offline mode keeps core gameplay working and never exposes public grave or Toss-only features.
- [ ] Capture screenshots only after assertions pass; record full hashes.

---

### Task C7: Run Repository, Mobile and Native Gates

Run in order:

~~~bash
npm run verify
npm run verify:full
npm run art:verify
npm run mobile:doctor
npm run cap:sync
npm run android:debug
npm run ios:build:device
git diff --check
git status --short -- android ios
~~~

- [ ] Record exact result, test count and artifact identity for every command.
- [ ] Keep signing, keystore, simulator or physical-device failures as external blockers.
- [ ] Do not convert browser or unsigned-build evidence into native acceptance.
- [ ] Run independent Sol xhigh `review-angles` on permanent state, migration/receipts, encounter replay/economy, mobile UX, evidence binding and Toss boundaries.
- [ ] Fix every Important finding and rerun the affected + full gates.
- [ ] Observe at least five candidate-bound fresh human sessions; iOS and Android are represented when devices are available; P0=0 and blocking P1=0.

---

### Task C8: Synchronize Evidence and the Execution Ledger

**Files:**
- Modify: `tasks/todo.md`
- Modify: `progress.md`
- Modify: `docs/evidence/qa/release-complete-core/requirement-matrix.md`
- Modify: `docs/evidence/qa/release-complete-core/browser-summary.md`
- Create: `docs/evidence/qa/release-complete-core/completion-summary.md`

- [ ] Bind full Git SHA, source-tree state, focused/full counts, screenshot hashes, native artifact hashes, environment blockers and reviewer verdict.
- [ ] Separate `implemented`, `browser verified`, `native packaged`, `physical device observed`, and `Toss resume eligible`.
- [ ] Mark the old Toss candidate/deployment as superseded by source changes without deleting its evidence.
- [ ] Keep progression profiles `activationReady:false`; no EXP/loot/event profile is activated in this plan.
- [ ] Audit the Toss resume gate only after all required rows have direct evidence.

## Final Acceptance Gate

- Natural fresh-to-New-Game+ route is reachable through production actions.
- Death/reset/ascend/reload permanent matrix is green.
- Public grave is absent and own grave works.
- Four bounded encounter families use only evidence-selected existing regions/lore.
- Global event frequency remains unchanged.
- All focused/full/art/mobile/native gates are green or have exact external blockers.
- Five fresh human observations have P0 0 and blocking P1 0.
- Independent Sol xhigh review has Important 0.
- Toss stays HOLD until a separately approved new candidate is built and bound.

## Rollback

- Disable/revert encounter data and selector integration as one slice; permanent/endgame fixes remain.
- If event frequency changes, disable the entire pack rather than tuning weights in place.
- Never roll back by selecting the superseded Toss artifact or deleting migrated save fields.
- Encounter rollback cannot re-enable public grave or remove True Ending accessibility behavior.
