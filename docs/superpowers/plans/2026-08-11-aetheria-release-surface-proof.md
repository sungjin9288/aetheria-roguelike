# Aetheria Unsafe Surface Containment and True Ending Proof Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:test-driven-development`, then `aetheria-openspace-ui`, `aetheria-roguelike-mobile-qa`, `develop-web-game`, and `playwright` as the task reaches real UI verification.

**Goal:** server authority가 없는 public grave invasion을 production player surface에서 제거하고, True Ending과 New Game+를 animation·small viewport·back/reload 때문에 막히지 않는 실제 모바일 완료 흐름으로 만든다.

**Architecture:** own-grave recovery is the only default production grave capability. Public grave code is guarded by an injected immutable capability whose production value is false and cannot be enabled by an arbitrary environment string. True Ending uses deterministic presentation data, an always-visible skip, reduced-motion immediate reveal, a scroll-owning safe-area shell and an explicit platform-back handler.

**Tech Stack:** React 19, TypeScript, Framer Motion, platform back registry, Playwright, browser/mobile QA

## Constraints

- Do not implement a fake client receipt or claim public grave correctness.
- Do not delete or weaken own-grave recovery.
- Do not add a currency, menu, modal or endgame reward.
- Do not change ascension numbers.
- No commit, push, artifact publication or Toss action without separate approval.

---

### Task B1: Define and Enforce the Production Capability Boundary

**Files:**
- Create: `src/platform/gameCapabilities.ts`
- Modify: `src/components/GravePanel.tsx`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/hooks/useFirebaseSync.ts` if the remote grave upload is still production-reachable
- Create: `tests/game-capabilities.test.js`
- Modify: `tests/e2e/grave-recovery-design.spec.ts`
- Modify: `tests/signature-grave-highlight.test.js`

**Interface:**

~~~ts
export interface GameCapabilities {
    publicGraveInvasion: boolean;
}

export const PRODUCTION_GAME_CAPABILITIES: Readonly<GameCapabilities> =
    Object.freeze({ publicGraveInvasion: false });
~~~

- [ ] Write RED tests asserting the production constant is frozen/default false.
- [ ] Assert `grave-view-public` is absent and no public Firestore request or `actions.invadeGrave` call occurs.
- [ ] Assert own-grave cards, grouping, map route and local recovery stay visible/actionable.
- [ ] Add a required or defaulted `capabilities` prop to `GravePanel`; `Dashboard` passes the production constant.
- [ ] Guard public tab render, fetch effect/handler, invade handler and public grave upload with the same capability.
- [ ] Do not expose a query parameter or generic environment variable to enable it.
- [ ] Test-only rendering may inject true only to retain bounded characterization of dormant code.
- [ ] Replace the old E2E that clicked the unsafe tab with absence + zero-request assertions.
- [ ] Run:

~~~bash
node --import tsx --test +  tests/game-capabilities.test.js +  tests/grave-cycle.test.js +  tests/signature-grave-highlight.test.js
npx playwright test tests/e2e/grave-recovery-design.spec.ts
~~~

Expected RED before implementation: public tab is visible and clickable. Expected GREEN: own recovery works and public request/action count is zero.

---

### Task B2: Lock True Ending Behavior with RED Tests

**Files:**
- Create: `tests/true-ending-flow.test.js`
- Modify: `src/components/TrueEndingScreen.tsx`

- [ ] Render with fake timers and assert skip is visible on the first frame.
- [ ] One skip reveals all five lines, stats and CTA; duplicate skip is a no-op.
- [ ] Mock `useReducedMotion()` true and expect the complete ending immediately with no pending artificial timer.
- [ ] Render twice and compare star/style output; module-level `Math.random` must disappear.
- [ ] Assert CTA callback is accepted once even under rapid double click.
- [ ] Verify RED:

~~~bash
node --import tsx --test tests/true-ending-flow.test.js
~~~

Expected: missing skip/reduced-motion/deterministic field contracts fail.

---

### Task B3: Implement Accessible, Back-Safe True Ending

**Files:**
- Modify: `src/components/TrueEndingScreen.tsx`
- Modify: `src/components/app/GameRoot.tsx` only if an explicit prop is required
- Use: `src/platform/platformBackRegistry.tsx`
- Extend: `tests/true-ending-flow.test.js`
- Extend: `tests/toss-lifecycle-bridge.test.js`

**Behavior contract:**

~~~ts
export type TrueEndingRevealState = 'narrative' | 'complete';

export const resolveTrueEndingBackAction = (
    state: TrueEndingRevealState,
): 'reveal_all' | 'consume';
~~~

- [ ] Create an idempotent `revealAll()` that clears timers and reveals lines/stats/CTA.
- [ ] Use `revealAll` for skip, reduced motion and platform back while incomplete.
- [ ] Register a high-priority back handler; after completion it consumes back and never exits the app or starts New Game+.
- [ ] Keep timed narrative for normal-motion users, but keep skip visible from frame one.
- [ ] Replace random star construction with a fixed literal or deterministic index-based generator.
- [ ] Make the owner `h-[100dvh] overflow-y-auto overflow-x-hidden` with safe-area padding, a bounded column, `min-w-0` and `break-words`.
- [ ] Raise essential copy above 10px; skip and CTA have `min-h-[44px]`.
- [ ] Run:

~~~bash
node --import tsx --test tests/true-ending-flow.test.js tests/toss-lifecycle-bridge.test.js
~~~

---

### Task B4: Make Reset and Ascension Copy Truthful

**Files:**
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/AscensionScreen.tsx`
- Create: `tests/permanent-progress-copy.test.js`
- Modify: `src/data/eventChains.ts` or owning message source only if shard probability copy is currently hard-coded there

- [ ] Add RED assertions requiring explicit reset state: level, inventory, equipment, quest/current expedition.
- [ ] Require explicit preserved state: permanent growth, class journey, settings, codex/claim ledgers.
- [ ] Disallow “지금까지의 진행 상황을 지운다” because it contradicts actual preservation.
- [ ] Rename the manual action to `현재 여정 다시 시작`; keep ascension as `다음 여정으로 계승`.
- [ ] Derive shard chance copy from `BALANCE.PRIMAL_SHARD_DROP_CHANCE` instead of a drifting literal.
- [ ] Keep confirm/cancel actions at least 44px.
- [ ] Run:

~~~bash
node --import tsx --test tests/permanent-progress-copy.test.js
~~~

---

### Task B5: Add a Production-Transition Endgame E2E Scenario

**Files:**
- Modify: `src/hooks/useGameTestApi.ts`
- Create: `tests/e2e/true-ending-new-game-plus.spec.ts`
- Extend: `tests/e2e/grave-recovery-design.spec.ts`

- [ ] Add `seedTrueEndingJourneyScenario()` only under the existing test API flag.
- [ ] Build the fixture from `INITIAL_STATE`, canonical class vitals, DB equipment/monster and migrated `meta.endgame`.
- [ ] Seed only rank 3, shard 2, high-ATK player and 1-HP Demon King in real combat state.
- [ ] Do not pre-create the true boss, True Ending or ascended player.
- [ ] Click the actual attack action and assert true boss + shard zero.
- [ ] Change only true-boss HP to 1 through a bounded test helper, click the real attack action, and assert True Ending.
- [ ] Exercise skip, reduced motion, platform back, New Game+, reload and duplicate-click protection.
- [ ] Run every route at `375x667`, `390x844`, and `430x932`.
- [ ] Assert viewport dimensions, document/local horizontal overflow, safe-area bounds, button target size and CTA reachability.
- [ ] Reload on True Ending and after New Game+; assert shard count, endgame receipt, class journey, settings and prestige rank without duplicate heart/title/reward.
- [ ] Run:

~~~bash
npx playwright test +  tests/e2e/true-ending-new-game-plus.spec.ts +  tests/e2e/grave-recovery-design.spec.ts
~~~

---

### Task B6: Remove Only Proven Dead Plumbing

**Files:**
- Inspect and modify only confirmed owners of `inventorySpotlight` and `archivedHistory`
- Update their exact structural tests

- [ ] Run `rg` to prove `inventorySpotlight` is always null at every production owner.
- [ ] Remove its state/prop/test-API cascade only after behavior tests are green.
- [ ] Prove `archivedHistory` has no production writer before removing runtime plumbing.
- [ ] Preserve legacy save compatibility by ignoring the unknown field; do not destructively rewrite external saves.
- [ ] Run focused tests and `git diff --check` after each cascade.

---

### Task B7: Plan B Integration Gate

~~~bash
node --import tsx --test +  tests/game-capabilities.test.js +  tests/true-ending-flow.test.js +  tests/permanent-progress-copy.test.js +  tests/toss-lifecycle-bridge.test.js +  tests/local-game-snapshot.test.js
npx playwright test +  tests/e2e/true-ending-new-game-plus.spec.ts +  tests/e2e/grave-recovery-design.spec.ts
npx tsc --noEmit
npm run lint -- --quiet
git diff --check
~~~

## Plan B Acceptance Gate

- Production cannot render or call public grave invasion.
- Own-grave recovery remains functional.
- True Ending completes immediately with skip or reduced motion.
- Back never exits the app or starts New Game+.
- All three viewports pass overflow, safe-area, typography and touch checks.
- True Ending/New Game+ survive reload without duplicate state.

## Rollback

- Public grave remains default false even if the True Ending UI is reverted.
- Public grave may only be enabled after a separately approved server-transaction design.
- Plan B UI rollback never removes Plan A migration/endgame ledger.
- Screenshots are refreshed after any source change; stale evidence is not reused.
