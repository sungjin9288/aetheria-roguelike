# Aetheria Relic Rarity and Audit Implementation Plan

**Execution status (2026-08-12):** Slice 1 implementation and canonical touched-surface verification are complete. Relic `67` / effect `61` / synergy `20` audit evidence is GREEN at report SHA-256 `226808f23a3f8882b14d0ad9184819be1b30747f06b575119b64decc13dd020d`; focused tests are `30/30` and 390×844 Playwright is `1/1`. The first Goal was replanned because inherited signature-art provenance failures made its unrelated all-green full-gate contract impossible without widening scope. A corrected Goal Run stopped at recovery-command-free `outcome-unknown`; verified bytes were locally synced, but Goal pass, stage, commit, push, and release are not claimed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `불사의 의지`의 전투 효과는 그대로 유지하면서 rarity를 `uncommon`에서 `epic`으로 승격하고, 67개 전체 유물의 catalog, runtime owner, synergy, offer probability를 재현 가능한 증빙으로 고정한다.

**Architecture:** 기존 `src/data/relics.ts`를 유물 catalog와 private rarity-weight authority로 유지한다. 새 pure audit system은 production source를 읽어 안정적인 report projection을 만들며, strict CLI는 canonical JSON과 SHA-256을 검증한다. 테스트 전용 API는 실제 RelicChoice UI를 열기만 하며 production reducer나 combat rule을 우회하지 않는다.

**Tech Stack:** TypeScript, React 19, Node.js ESM, Node test runner with tsx, Playwright, Vite, existing Aetheria reducer and save migration architecture.

**Execution Route:** The approved Luna `max` route was attempted first, but the live Orca Codex catalog rejected that model/effort pair before creating an editor. Execution therefore uses the approved fallback `gpt-5.6-sol` at `high`, with the same scope and acceptance criteria.

## Global Constraints

- 이번 slice의 gameplay 변경은 `불사의 의지.rarity: uncommon -> epic` 하나뿐이다.
- `id`, `name`, `desc`, `effect`, `val`, combat reset, death-save transaction, `절대 불사` synergy는 바꾸지 않는다.
- 저장된 active run의 full relic snapshot은 다시 hydrate하지 않는다. 기존 run에서 uncommon으로 저장된 유물은 그 run 동안 그대로 유지한다.
- `RELIC_WEIGHTS`와 `RARITY_ORDER`는 private authority로 유지한다. 기존 private-export guard를 약화하지 않는다.
- EXP, loot, equipment, consumable, event frequency, event reward, map, monster, quest 값은 변경하지 않는다.
- 작업자는 아래 Worker Writable Paths만 수정한다. canonical checkout의 기존 dirty path와 Toss/native/build 경로는 건드리지 않는다.
- commit, push, release, publication은 별도 승인 전 수행하지 않는다.
- 모든 구현은 `RED -> GREEN -> focused integration -> full gate -> real surface` 순서로 닫는다.

## Worker Writable Paths

- `src/data/relics.ts`
- `src/systems/relicBalanceAudit.ts`
- `scripts/verify-relic-balance.mjs`
- `tests/relic-balance-audit.test.js`
- `tests/e2e/relic-balance.spec.ts`
- `src/hooks/useGameTestApi.ts`
- `docs/evidence/qa/release-complete-core/relic-balance.json`
- `package.json`

## Read-Only Authorities

- `docs/superpowers/specs/2026-08-12-aetheria-item-event-balance-design.md`
- `src/systems/CombatEngine.relics.ts`
- `src/systems/CombatEngine.actions.ts`
- `src/systems/CombatEngine.enemyAI.ts`
- `src/systems/CombatEngine.loot.ts`
- `src/systems/CombatEngine.outcome.ts`
- `src/systems/CombatEngine.ts`
- `src/utils/gameUtils.ts`
- `src/utils/statsCalculator.ts`
- `src/utils/exploreUtils.ts`
- `src/hooks/gameActions/exploreActions.ts`
- `src/utils/dataMigration.ts`
- `tests/premium-cycle.test.js`
- `tasks/todo.md`

---

## Task 1: Freeze the catalog-wide relic audit contract

**Files:**

- Create: `tests/relic-balance-audit.test.js`
- Create: `src/systems/relicBalanceAudit.ts`
- Read: `src/data/relics.ts`
- Read: the ten runtime owner files in Read-Only Authorities

**Required public interface:**

```ts
export type RelicBalanceCategory =
  | 'baseline-stat'
  | 'conditional-combat'
  | 'resource-economy'
  | 'failure-rule'
  | 'combat-scaling'
  | 'run-scaling'
  | 'exploration-pacing'
  | 'abyss-only';

export const RELIC_RUNTIME_OWNER_PATHS: readonly string[];

export interface RelicBalanceReport {
  schemaVersion: 1;
  catalog: {
    relicCount: number;
    uniqueIdCount: number;
    uniqueNameCount: number;
    effectCount: number;
    synergyCount: number;
    rarityCounts: Record<string, number>;
  };
  effects: Array<{
    effect: string;
    category: RelicBalanceCategory;
    relicIds: string[];
    runtimeOwners: string[];
  }>;
  synergies: Array<{
    label: string;
    requiredRelicNames: string[];
  }>;
  errors: string[];
}

export function buildRelicBalanceReport(input: {
  relics: readonly Relic[];
  synergies: readonly RelicSynergy[];
  runtimeSources: Readonly<Record<string, string>>;
}): RelicBalanceReport;

export function canonicalizeRelicBalanceReport(
  report: RelicBalanceReport,
): RelicBalanceReport;
```

**Effect policy must cover exactly these 61 production strings:**

```text
baseline-stat: glass_cannon, ancient_power, stone_skin, fortress, mp_mult,
skill_mult, armor_pen, omega, crit_dmg, battle_start_atk, dual_crit,
triple_up, titan, elem_boost, reflect_crit, genesis

conditional-combat: on_kill_heal, low_hp_atk, execute_bonus, double_strike,
skill_lifesteal, crit_mp_regen, crit_block, reflect, battle_start_heal,
free_skill, mp_regen_turn, cursed_power, dot_mult, chaos_buff, cd_minus,
execute_atk, low_hp_dmg, echo_atk, status_resist, mp_restore_battle, regen,
on_hit_freeze, first_turn_evade, battle_start_buff, hp_drain_atk,
cooldown_reduce

resource-economy: gold_mult, exp_mult, drop_rate, kill_bonus
failure-rule: death_save, void_heart, phoenix_revive
combat-scaling: combo_stack, spell_stack, kill_stack_atk, entropy_tick
run-scaling: kill_stack, devour_hp
exploration-pacing: event_chance, boss_hunter, chaos_relic
abyss-only: abyss_atk_scale, abyss_crit_scale, abyss_floor_power
```

**Fail-closed errors:**

```text
RELIC_COUNT_MISMATCH
RELIC_ID_DUPLICATE:<id>
RELIC_NAME_DUPLICATE:<name>
RELIC_ID_INVALID:<id>
RELIC_RARITY_INVALID:<id>
RELIC_EFFECT_INVALID:<id>
RELIC_EFFECT_POLICY_MISSING:<effect>
RELIC_RUNTIME_OWNER_MISSING:<effect>
SYNERGY_REFERENCE_INVALID:<label>:<name>
```

**Steps:**

- [ ] Add a RED test asserting production totals `67 relics`, `61 effects`, `20 synergies` and post-change rarity counts `7/10/17/17/16` for common through legendary.
- [ ] Add RED mutations for duplicate id, duplicate name, invalid rarity, blank effect, unmapped effect, missing runtime literal, and unknown synergy reference.
- [ ] Add a RED test that every effect appears in exactly one category and every runtime owner path is repository-relative and allowlisted.
- [ ] Implement a pure audit projection with no filesystem access, clock, randomness, console output, or process state.
- [ ] Scan only exact quoted effect literals from the fixed runtime source map. Do not accept broad substring matches or arbitrary repository search results.
- [ ] Sort relic ids, effect rows, runtime owners, synergies, and errors deterministically.
- [ ] Keep report construction total: malformed input produces stable errors instead of throwing unless the outer input shape itself is unusable.

**Focused RED command:**

```bash
node --import tsx --test tests/relic-balance-audit.test.js
```

Expected before implementation: module-not-found or explicit audit assertion failures.

**Focused GREEN command:**

```bash
node --import tsx --test tests/relic-balance-audit.test.js
```

Expected after implementation: all audit and mutation cases pass.

---

## Task 2: Add exact weighted offer probability and promote Undying

**Files:**

- Modify: `src/data/relics.ts`
- Modify: `tests/relic-balance-audit.test.js`
- Read: `tests/premium-cycle.test.js`

**Required public interface:**

```ts
export function getBaseRelicOfferProbability(
  pool: readonly Relic[],
  relicId: string,
  count: number,
  options?: { rarityCap?: Relic['rarity'] },
): number;
```

**Behavior:**

- Calculate the exact probability that a weighted sample without replacement contains the target relic.
- Use the existing private rarity weights and the same cap semantics as production choice generation.
- Aggregate recursion states by remaining rarity counts so the result is exact and bounded; do not use Monte Carlo.
- Unknown or cap-filtered target returns `0`.
- Reject duplicate ids, invalid rarities, invalid count, and malformed pools with `INVALID_RELIC_OFFER_POOL`.
- Do not export `RELIC_WEIGHTS`, `RARITY_ORDER`, or internal memoization helpers.

**Steps:**

- [ ] Add RED characterization for current `불사의 의지` three-choice probability `0.088781751469444` while uncommon.
- [ ] Add RED expectation for post-change probability `0.012485766915007135` while epic.
- [ ] Add RED expectation that the starting `rare` cap makes its probability exactly `0`.
- [ ] Add RED expectation that five independent three-choice opportunities change from approximately `0.3717795886746684` to `0.06088923421699066`.
- [ ] Add malformed-pool and private-export regressions.
- [ ] Implement the exact helper using the existing private weight authority.
- [ ] Change only `RELICS` entry `id: 'undying'` from `rarity: 'uncommon'` to `rarity: 'epic'`.
- [ ] Assert `id`, Korean name, description, `effect: 'death_save'`, and `val: 1` are byte-for-byte unchanged.

**Focused command:**

```bash
node --import tsx --test tests/relic-balance-audit.test.js tests/premium-cycle.test.js
```

---

## Task 3: Lock active-run compatibility and fatal-protection behavior

**Files:**

- Modify: `tests/relic-balance-audit.test.js`
- Read: `src/utils/dataMigration.ts`
- Read: `src/systems/CombatEngine.relics.ts`
- Read: `src/data/relics.ts`

**Compatibility contract:**

- Existing save objects hold complete relic snapshots. Migration must preserve a saved uncommon `불사의 의지` inside an active run.
- New offers use the canonical epic catalog row.
- Death-save remains once per combat, prevents HP from dropping below 1, and resets only at the existing combat-start authority.
- `절대 불사` still requires exactly `불사조의 깃털 + 불사의 의지` and retains the same outcome.

**Steps:**

- [ ] Build a literal legacy player fixture containing saved `undying` with `rarity: 'uncommon'`.
- [ ] Pass it through the production migration path and assert the active relic snapshot remains uncommon with all effect fields unchanged.
- [ ] Add a combat characterization proving lethal damage produces HP 1 once, a second lethal hit in the same combat is not protected, and a fresh combat resets the protection.
- [ ] Add a synergy characterization proving the same two relic names activate `절대 불사`; a missing or renamed member does not.
- [ ] Assert no save schema version or migration rewrite was added for the rarity-only catalog change.

**Focused command:**

```bash
node --import tsx --test tests/relic-balance-audit.test.js tests/combat-authority.test.js tests/data-migration.test.js
```

If the repository uses a narrower existing combat test filename, select the exact owning test discovered by `rg -n "death_save|불사의 의지|절대 불사" tests` and record the command in the worker handoff.

---

## Task 4: Add strict evidence generation and verification

**Files:**

- Create: `scripts/verify-relic-balance.mjs`
- Create: `docs/evidence/qa/release-complete-core/relic-balance.json`
- Modify: `package.json`
- Modify: `tests/relic-balance-audit.test.js`

**CLI grammar:**

```bash
node --import tsx scripts/verify-relic-balance.mjs --write docs/evidence/qa/release-complete-core/relic-balance.json
node --import tsx scripts/verify-relic-balance.mjs --verify docs/evidence/qa/release-complete-core/relic-balance.json
```

Only one of `--write` or `--verify` is accepted. Unknown flags, duplicates, missing values, both modes, absolute paths, backslashes, `.` segments, `..` segments, symlinks, and output outside the evidence root must fail nonzero.

**Evidence envelope:**

```json
{
  "hashAlgorithm": "sha256",
  "reportHash": "<64 lowercase hex>",
  "report": {}
}
```

**Steps:**

- [ ] Add RED CLI tests for valid write/verify, stale report, malformed flags, traversal, absolute path, symlink ancestor, duplicate option, and verify no-write sentinels.
- [ ] Read the ten fixed runtime owner files directly; do not recursively scan the repository.
- [ ] Reject any audit report with nonempty errors before write or successful verify.
- [ ] Canonicalize the report, compute SHA-256 over the canonical report JSON, and format the entire envelope deterministically.
- [ ] In verify mode compare the expected complete file bytes, not only the embedded hash.
- [ ] Add package script:

```json
"relic:verify": "node --import tsx scripts/verify-relic-balance.mjs --verify docs/evidence/qa/release-complete-core/relic-balance.json"
```

- [ ] Generate the tracked evidence once using `--write`, then immediately prove `--verify` passes.

**Focused commands:**

```bash
node --import tsx --test tests/relic-balance-audit.test.js
npm run relic:verify
git diff --check -- \
  src/data/relics.ts \
  src/systems/relicBalanceAudit.ts \
  scripts/verify-relic-balance.mjs \
  tests/relic-balance-audit.test.js \
  docs/evidence/qa/release-complete-core/relic-balance.json \
  package.json
```

---

## Task 5: Prove the player-facing rarity at 390 x 844

**Files:**

- Modify: `src/hooks/useGameTestApi.ts`
- Create: `tests/e2e/relic-balance.spec.ts`
- Read: the existing relic choice component and current E2E fixture conventions

**Test-only seam:**

```ts
injectUndyingRelicChoice(): void;
```

The helper must exist only when the existing test API build flag is enabled. It may seed the canonical relic choice state but must not grant the relic directly, edit rarity text, bypass the production selection callback, or write production save keys.

**Steps:**

- [ ] Add a RED Playwright test that opens the real relic choice surface at `390x844`.
- [ ] Assert the `불사의 의지` card renders the player-facing epic label `영웅` and does not render `고급` on that card.
- [ ] Assert document and local panel horizontal widths do not overflow.
- [ ] Assert the choice button is inside the viewport after scroll and its touch height is at least 44 CSS pixels.
- [ ] Select the card through the real UI and assert the choice closes and the player owns exactly one `undying` relic.
- [ ] Assert the test build does not touch `aetheria.game.snapshot.v1`, `aetheria.game.snapshot.v2.primary`, or `aetheria.game.snapshot.v2.staged` outside the isolated test namespace.
- [ ] Keep screenshots under Playwright test artifacts unless `release-evidence` explicitly requests a tracked capture later.

**Focused command:**

```bash
npx playwright test tests/e2e/relic-balance.spec.ts --reporter=line
```

---

## Task 6: Run integration and full verification without widening scope

**Files:**

- Verify only; no new production paths unless a real regression in this slice requires a Sol re-plan.

**Steps:**

- [ ] Confirm `git status --short` shows edits only in Worker Writable Paths inside the worker worktree.
- [ ] Run the focused relic suite and exact real-surface test again.
- [ ] Run the repository gates below in order.
- [ ] If a failure is unrelated or environmental, preserve its exact output and do not modify unrelated source to make the gate green.
- [ ] Confirm no `build/`, `android/`, `ios/`, Toss release evidence, canonical dirty ledger, or combat-focus paths entered the worker diff.

**Commands:**

```bash
node --import tsx --test tests/relic-balance-audit.test.js tests/premium-cycle.test.js
npm run relic:verify
npm run content:verify
npm run pacing:verify
npm run art:verify
npm run verify
npm run verify:full
npm run mobile:doctor
npm run cap:sync
git diff --check
```

**Expected gate interpretation:**

- `relic:verify` must be exact GREEN with 67 relics, 61 effects, 20 synergies, post-change rarity counts, and no errors.
- `content:verify` and `pacing:verify` must remain byte-consistent because the slice does not alter EXP, loot, or event rhythm.
- `art:verify` must remain GREEN because no art routing or PNG bytes are changed.
- `verify` and `verify:full` must pass on worker bytes. A preview process is managed by `verify:full`.
- `mobile:doctor` and `cap:sync` must not introduce tracked native drift.
- Signing identity, release keystore, physical Toss Sandbox, QR, console, and provider checks remain external and are not claimed.

---

## Task 7: Independent GPT A review, ledger sync, and approval-gated delivery

**Files owned by GPT A after worker verification:**

- Review: all Worker Writable Paths
- Update only after verifying current bytes: `tasks/todo.md`
- Update only if required by current release evidence: `progress.md`
- Do not rewrite unrelated existing dirty content in either file.

**Review angles:**

- [ ] Gameplay: rarity changes only offer frequency and label; combat effect remains unchanged.
- [ ] Persistence: active-run uncommon snapshot remains valid and replay-safe.
- [ ] Probability: exact helper matches production private weights and cap semantics.
- [ ] Audit integrity: malformed catalog/runtime/synergy mutations fail closed.
- [ ] Privacy and safety: CLI paths are contained; test API is absent from production builds.
- [ ] Mobile surface: real card is readable and selectable at 390x844.
- [ ] Scope: no equipment, consumable, event frequency, event reward, map, monster, quest, Toss, native, or build changes.

**Delivery sequence:**

- [ ] GPT A inspects the actual worker diff and reruns decisive checks.
- [ ] GPT A synchronizes the task ledger with exact counts, commands, and external blockers.
- [ ] GPT A presents the cohesive diff and verification summary to the user.
- [ ] Only after a separate explicit approval, stage the exact reviewed paths.
- [ ] Only after successful explicit-path staging, create one cohesive commit with the professional bilingual message below.
- [ ] Push only after a separate explicit push approval.

**Approval-gated commit message:**

```text
feat: 불사의 의지 등급 정합성 확립 and deterministic relic balance audit 추가

- 변경 배경 / Background:
  전투마다 사망을 한 번 무효화하는 불사의 의지가 uncommon 접근 빈도를 가져 초반 로그라이크 긴장과 rarity 의미를 약화했으며, 후속 67개 유물 조정을 위한 catalog-wide evidence가 없었음.
- 주요 변경 사항 / Key changes:
  불사의 의지를 epic으로 승격하고 시작 유물에서 제외했으며, 67 relic/61 effect/20 synergy/runtime owner와 weighted offer probability를 검증하는 fail-closed report를 추가함.
- 구현 방식 / Implementation details:
  private rarity weight authority를 유지한 exact weighted probability 계산, pure audit projection, strict SHA-256 evidence CLI, active-run snapshot preservation, 390x844 real-surface regression을 적용함.
- 영향 범위 / Impact:
  새 relic offer의 등장 빈도와 rarity label만 변경하며 combat effect, existing active run, EXP, loot, event rhythm, equipment, consumables, save schema는 유지함.
- 테스트 및 검증 / Test & Validation:
  focused mutation/replay tests, relic evidence verify, verify/verify:full, content/pacing/art gates, mobile doctor, Capacitor sync, mobile Playwright를 수행함.
- 참고 사항 / Notes:
  후속 relic effect, equipment, consumable, event frequency/reward tuning은 각각 별도 one-axis release와 승인 경계로 진행함.
```

## Completion Criteria

- [ ] Canonical `undying` is epic while its five non-rarity gameplay fields remain unchanged.
- [ ] Existing active-run uncommon snapshot survives migration unchanged.
- [ ] Death-save and `절대 불사` behavior characterizations pass.
- [ ] Exact probability evidence proves the reduced offer rate and starting-cap exclusion.
- [ ] The 67/61/20 deterministic report has zero errors and strict SHA-256 verification.
- [ ] Malformed catalog, runtime-owner, synergy, pool, CLI, and stale-evidence mutations fail closed.
- [ ] The production relic choice surface shows `영웅` at 390x844 without overflow and grants once through the real UI.
- [ ] Focused, repository, content, pacing, art, mobile, and Capacitor gates have exact current-byte results.
- [ ] Worker diff contains only the eight approved writable paths.
- [ ] Commit and push remain unperformed until separately approved.
