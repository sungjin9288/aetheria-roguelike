# Aetheria Relic Effect Coherence — Slice 2B Plan

Date: 2026-08-12 KST

Status: implementation and repository verification complete; Native Goal blocked on coordinator prepared-state recovery

Planning owner: GPT A, GPT-5.6 Sol xhigh

## Outcome

`event_chance` 유물의 rarity progression, player-facing copy, runtime aggregation을 하나의 규칙으로 맞춘다.

- `고대 지도` (`common`): 일반 내러티브 이벤트 증가 `60% → 15%`
- `방랑자의 부적` (`uncommon`): `30%` 유지
- 두 유물은 additive policy로 `45%`를 적용
- 보유 배열 순서와 무관하며 malformed matching value는 fail closed
- 기존 active-run에 저장된 `고대 지도 60%` snapshot은 rewrite하지 않음
- global event profile, scout, campfire, spacing, pity, mandatory story, boss challenge, reward, EXP, loot는 변경하지 않음

## Decision

`event_chance`는 strongest-only가 아니라 additive family로 유지한다. `15% + 30% = 45%`이므로 common과 uncommon이 rarity 순서대로 강해지고, 한 유물을 보유한 뒤 다른 유물을 얻는 선택도 의미를 가진다. Overall event chance는 기존 `getNarrativeEventChance`의 `SPECIAL_EVENT_MAX_CHANCE`와 pity contract를 그대로 따른다.

Legacy snapshot도 같은 additive policy를 사용한다. 따라서 진행 중인 run에 저장된 `60% + 30%`는 `90%` bonus로 유지되고, catalog에서 새로 얻는 조합만 `45%`가 된다. Migration은 catalog value나 description을 저장 객체에 덮어쓰지 않는다.

## Scope

### Writable paths

- `src/data/relics.ts`
- `src/utils/relicEffectValues.ts`
- `src/hooks/gameActions/exploreActions.ts`
- `src/systems/explorationRhythmSimulator.ts`
- `src/systems/relicEventChanceAudit.ts`
- `scripts/verify-relic-event-chance.mjs`
- `tests/relic-event-chance-coherence.test.js`
- `tests/e2e/relic-event-chance.spec.ts`
- `src/hooks/useGameTestApi.ts`
- `docs/evidence/qa/release-complete-core/relic-event-chance.json`
- `package.json`
- this plan and `tasks/todo.md`

### Read-only authorities

- `src/utils/explorationPacing.ts`
- `src/data/constants.ts`
- `src/data/progressionProfiles.ts`
- `src/data/db.ts`
- `src/utils/gameUtils.ts`
- `docs/evidence/qa/release-complete-core/exploration-rhythm.json`
- `docs/evidence/qa/release-complete-core/relic-balance.json`

### Excluded

- `free_skill` and every other relic family
- scout, campfire, optional-decision spacing, pity, map chance, global profile
- event content, outcome, reward, EXP, loot, equipment, consumables
- Toss, native source, generated `build/`
- stage, commit, push, release

## Production Contract

Add a narrow pure selector:

```ts
export function getAdditiveNumericRelicValue(
  relics: readonly Relic[],
  effect: string,
): number;
```

It returns the sum of finite non-negative numeric values for exact matches, returns `0` when absent, is order independent, and throws stable `INVALID_RELIC_EFFECT_VALUE` for any malformed matching snapshot. Non-matching malformed values do not affect the requested family.

`exploreActions` uses this selector for `event_chance` and passes the result to the unchanged `getNarrativeEventChance` authority. It must not read catalog identities or rewrite player relics.

## Deterministic Evidence

Create a report with:

- predecessor catalog: map `0.60`, charm `0.30`, both orders `0.90`
- candidate catalog: map `0.15`, charm `0.30`, both orders `0.45`
- legacy snapshot: map `0.60`, charm `0.30`, both `0.90`
- exact production chance samples across canonical non-safe maps at `sinceNarrativeEvent=1`
- controlled fixed-seed rhythm counts for none, map-only, charm-only, and both cohorts
- invariants proving profile `exploration-rhythm@2`, scout/campfire/minimum gap, EXP `1`, loot `1`, reward authority, mandatory story, and boss challenge remain unchanged
- sorted errors and strict full-byte SHA-256 envelope

The controlled comparison changes only the relic bonus. It may claim direction for general narrative frequency, not real retention or elapsed play time.

Expected directions:

- none: predecessor equals candidate
- charm-only: predecessor equals candidate
- map-only: candidate general narrative count is lower
- both: candidate general narrative count is lower
- both candidate is stronger than charm-only candidate, and charm-only is stronger than map-only

## TDD Sequence

1. RED: current catalog exposes common `60%` above uncommon `30%`.
2. RED: malformed `event_chance` snapshots currently poison the reducer sum instead of failing closed.
3. RED: candidate map/charm ownership orders and legacy ownership orders have no explicit production contract.
4. GREEN: add the additive selector and route production exploration through it.
5. GREEN: change only the new catalog map value/copy to `15%`; keep charm `30%`.
6. RED/GREEN: add controlled rhythm report, catalog/legacy/profile/reward mutation tests, strict CLI and evidence.
7. RED/GREEN: add a 390×844 real RelicChoice surface proving 15%/30% copy, rarity hierarchy, 44px targets, no overflow, real reducer grant once, and isolated production-save keys.

## Acceptance Criteria

- Exactly one gameplay value changes: `ancient_map.val 0.60 → 0.15`.
- Exactly one matching copy changes: `고대 지도` says 15%.
- `wanderer_charm` remains uncommon 30%.
- Candidate both orders are exactly 45%; legacy both orders are exactly 90%.
- Production exploration uses the pure additive selector and malformed matching values fail closed.
- Existing active-run objects are not rewritten by migration.
- Controlled rhythm direction and invariants pass with deterministic 64-seed evidence.
- Strict evidence CLI, focused tests, existing relic/content/pacing/art verifiers, 390×844 Playwright, type-check, lint, `verify`, `verify:full`, mobile doctor, Capacitor sync, native tracked drift, and diff-check pass.
- No excluded balance, content, platform, Git-history, or release action occurs.

## Rollback

Before commit, rollback is the exact removal of Slice 2B files and restoration of the touched catalog/runtime callsite. After a later approved commit, rollback selects the predecessor commit; it must not rewrite active-run snapshot values.

## Execution Evidence

- Production policy: common map `0.15`, uncommon charm `0.30`, candidate both orders `0.45`, legacy both orders `0.90`.
- Focused integration: `257/257`.
- Event-chance evidence: report SHA-256 `424909de42bc199747279d17e645b9360996912c2b669f637a7ccce9e4574597`; full evidence file SHA-256 `2d927f857c19006f137b0a999cc830f548e537e7407d45b4a08be0649b9bdca8`.
- Existing evidence gates: relic balance `226808f2...20d`, free-skill `ddf2e9a1...72dffd`, content `a6626375...b4f0e8`, pacing `7d903b82...72bfe2`, art surfaces `18/229/22/25` with empty error arrays.
- 390×844 production reducer/UI test: `1/1`; final full-gate screenshot SHA-256 `600877e506593fabbbe57693b80021b97bef1f7c09a97111e4dd8222c5499e5d`.
- Full repository gate: type-check, warning-free lint, unit `4006/4006`, build guard, desktop/mobile smoke, E2E `54/54 + 51/51`.
- Mobile/native: `mobile:doctor`, `cap:sync`, Android debug `BUILD SUCCESSFUL`, unsigned iOS device `BUILD SUCCEEDED`, Android/iOS tracked drift 0.
- Environment boundary: Apple Distribution identity and Android release signing remain unavailable; no signed package or device observation is claimed.
- Orchestration boundary: the external Orca preflight passed, but dispatch returned `outcome-unknown` and created no durable Run, Task, Dispatch or worktree. Three consecutive recovery audits found only the unchanged `run-create:1` prepared record and no live Orca identity to reconcile. No blind retry or private-state mutation occurred. GPT A completed the bounded fallback as sole writer; the Native Goal is blocked until the coordinator gains a fail-closed prepared-state recovery path.
- Git/release boundary: no stage, commit, push, Toss console, upload, review, publication or ad action.

## Next Boundary

After Slice 2B, re-audit observed event frequency before changing any global lever. Scout/campfire/profile/map probabilities remain separate candidates and require a new Goal.
