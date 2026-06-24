import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * cycle 600-699 정리 가드 (audit #1 통합 22개)
 */

// ─── cycle-601-perform-synthesis-defaults-batch.test.js ───
{
  /**
   * cycle 601: performSynthesis 2 defaults batch unreachable
   *   (cycle 222-600 silent dead config 시리즈 337번째 — redundant default annotation
   *   청소 메가 시리즈 추가, 600사이클 milestone 후 첫 cycle).
   *
   * 발견 (2 defaults batch):
   * - src/utils/synthesisUtils.ts (line 96):
   *     export const performSynthesis = (items: any, selectedOutput: any = null,
   *         useProtect: any = false) => {...};
   * - 호출 사이트 (1 caller):
   *     · useInventoryActions.ts:430 — performSynthesis(items, null, useProtect)
   *       — 3 args 명시.
   *     · 다른 caller 0건.
   * - 결과: selectedOutput / useProtect 항상 명시 전달. 두 default 모두 도달
   *   불가.
   *
   * 패턴 (cycle 222-600 시리즈 337번째):
   * - cycle 502-600: default 청소 메가 시리즈 99사이클 (cycle 600 milestone 포함).
   * - cycle 601: 600사이클 milestone 후 첫 cycle. utils/synthesisUtils.ts cleanup.
   *
   * 수정 (src/utils/synthesisUtils.ts):
   * - selectedOutput = null → selectedOutput.
   * - useProtect = false → useProtect.
   * - body의 useProtect 분기 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (useInventoryActions) 동작 그대로.
   * - body synthesis cost / success rate 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 601: performSynthesis signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/utils/synthesisUtils.ts');
      const fnIdx = source.indexOf('export const performSynthesis');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/selectedOutput:\s*any\s*=\s*null/.test(sig),
          'performSynthesis selectedOutput default null 제거');
      assert.ok(!/useProtect:\s*any\s*=\s*false/.test(sig),
          'performSynthesis useProtect default false 제거');
  });

  test('cycle 601: 정합성 가드 — useInventoryActions callsite 보존', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(/performSynthesis\(items,\s*null,\s*useProtect\)/.test(source),
          'useInventoryActions performSynthesis(items, null, useProtect) callsite 보존');
  });

  test('cycle 601: cycle 502-600 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ep = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/getMapPacingProfile\s*=\s*\(mapData:\s*GameMap \| null \| undefined\s*=\s*\{\}\)/.test(ep),
          'cycle 599 getMapPacingProfile mapData default 0건');

      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/getTraitFeaturedItems = \(items:\s*any\[\]\s*=\s*\[\]/.test(rp),
          'cycle 598 getTraitFeaturedItems items default 0건');
  });
}

// ─── cycle-603-summarize-history-recent-event-set-defaults-batch.test.js ───
{
  /**
   * cycle 603: summarizeHistory + getRecentEventSet 2 history defaults batch
   *   unreachable (cycle 222-602 silent dead config 시리즈 339번째 — redundant
   *   default annotation 청소 메가 시리즈 추가). aiEventUtils.ts paired cleanup.
   *
   * 발견 (2 history defaults batch):
   * - src/utils/aiEventUtils.ts:
   *     · line 30: summarizeHistory (history: any[] = [], limit = RECENT_HISTORY_LIMIT)
   *     · line 42: getRecentEventSet (history: any[] = [], limit = RECENT_EVENT_LIMIT)
   * - 호출 사이트:
   *     · summarizeHistory: aiService:80/120 + ai-event-utils.test (3 callers).
   *     · getRecentEventSet: aiService:81 + aiEventUtils:545 (2 callers).
   *     · 모두 history 명시 전달.
   * - 결과: history 항상 명시 전달. 두 default `[]` 모두 도달 불가. body의
   *   Array.isArray(history) guard가 undefined/null 안전 처리.
   *
   * Note: limit defaults (RECENT_HISTORY_LIMIT, RECENT_EVENT_LIMIT)는 모든 caller
   *   에서 미전달이라 reachable 보존. partial cleanup pattern (cycle 542 재적용
   *   8번째).
   *
   * 패턴 (cycle 222-602 시리즈 339번째):
   * - cycle 502-602: default 청소 메가 시리즈 101사이클.
   * - cycle 603: aiEventUtils.ts paired cleanup (cycle 522/525/527/561 동일
   *   모듈에 이은 5번째 cleanup).
   *
   * 수정 (src/utils/aiEventUtils.ts):
   * - summarizeHistory history default [] 제거.
   * - getRecentEventSet history default [] 제거.
   * - limit defaults 모두 보존 (reachable).
   * - body의 Array.isArray guard 보존.
   *
   * 회귀 가드:
   * - 5 callsite 동작 그대로.
   * - body Array.isArray ternary 보존 (undefined 안전).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 603: summarizeHistory signature에서 history default 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('export const summarizeHistory');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/history:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'summarizeHistory history default [] 제거');
  });

  test('cycle 603: getRecentEventSet signature에서 history default 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('export const getRecentEventSet');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/history:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'getRecentEventSet history default [] 제거');
  });

  test('cycle 603: limit defaults 보존 (reachable, partial cleanup)', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const sumIdx = source.indexOf('export const summarizeHistory');
      const sumEnd = source.indexOf('=>', sumIdx);
      const sumSig = source.slice(sumIdx, sumEnd);
      assert.ok(/limit\s*=\s*RECENT_HISTORY_LIMIT/.test(sumSig),
          'summarizeHistory limit default RECENT_HISTORY_LIMIT 보존');

      const setIdx = source.indexOf('export const getRecentEventSet');
      const setEnd = source.indexOf('=>', setIdx);
      const setSig = source.slice(setIdx, setEnd);
      assert.ok(/limit\s*=\s*RECENT_EVENT_LIMIT/.test(setSig),
          'getRecentEventSet limit default RECENT_EVENT_LIMIT 보존');
  });

  test('cycle 603: body Array.isArray guard 보존 (undefined 안전)', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(/Array\.isArray\(history\)/.test(source),
          'Array.isArray(history) guard 보존');
  });

  test('cycle 603: cycle 502-602 회귀 가드 — default 청소 시리즈 보존', async () => {
      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/getTraitLootHint = \(items: any\[\]\s*=\s*\[\]/.test(rp),
          'cycle 602 getTraitLootHint items default 0건');

      const su = await readSrc('src/utils/synthesisUtils.ts');
      assert.ok(!/performSynthesis = \(items: any, selectedOutput:\s*any\s*=\s*null/.test(su),
          'cycle 601 performSynthesis selectedOutput default 0건');
  });
}

// ─── cycle-605-seed-enhance-scenario-defaults-batch.test.js ───
{
  /**
   * cycle 605: seedEnhanceScenario 4 defaults batch unreachable
   *   (cycle 222-604 silent dead config 시리즈 341번째 — redundant default annotation
   *   청소 메가 시리즈 추가, single-cycle 4-default batch).
   *
   * 발견 (4 defaults batch):
   * - src/hooks/useGameTestApi.ts (line 287):
   *     seedEnhanceScenario: ({ gold = 500, materialCount = 0, weaponEnhance = 0 }: any = {}) => {...}
   * - 호출 사이트:
   *     · scripts/smoke-gameplay.mjs:275 — seedEnhanceScenario?.({gold:100,
   *       materialCount:0, weaponEnhance:0})
   *     · scripts/smoke-gameplay.mjs:279 — seedEnhanceScenario?.({gold:500,
   *       materialCount:0, weaponEnhance:0})
   *     · scripts/smoke-gameplay.mjs:283 — seedEnhanceScenario?.({gold:500,
   *       materialCount:1, weaponEnhance:0})
   *     · 다른 caller 0건 (src/, tests/ 모두).
   * - 결과: 3 callers 모두 완전 object 명시 (3 inner fields 모두 전달)이라 outer
   *   `: any = {}` + inner 3 defaults 모두 도달 불가.
   *
   * 패턴 (cycle 222-604 시리즈 341번째):
   * - cycle 502-604: default 청소 메가 시리즈 103사이클.
   * - cycle 605: useGameTestApi.ts cleanup. cycle 561 buildProceduralOutcome
   *   동일 패턴 (outer + inner destructure defaults 동시 정리).
   *
   * 수정 (src/hooks/useGameTestApi.ts):
   * - signature: ({ gold = 500, materialCount = 0, weaponEnhance = 0 }: any = {})
   *              → ({ gold, materialCount, weaponEnhance }: any).
   * - body의 materialCount / weaponEnhance / gold 사용처 보존.
   *
   * 회귀 가드:
   * - 3 production callsite (smoke-gameplay) 동작 그대로.
   * - body preservedInventory / seededMaterials 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 605: seedEnhanceScenario signature에서 4 defaults 0건', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      const fnIdx = source.indexOf('seedEnhanceScenario:');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/gold\s*=\s*500/.test(sig),
          'seedEnhanceScenario gold default 500 제거');
      assert.ok(!/materialCount\s*=\s*0/.test(sig),
          'seedEnhanceScenario materialCount default 0 제거');
      assert.ok(!/weaponEnhance\s*=\s*0/.test(sig),
          'seedEnhanceScenario weaponEnhance default 0 제거');
      assert.ok(!/\}:\s*any\s*=\s*\{\}/.test(sig),
          'seedEnhanceScenario outer default {} 제거');
  });

  test('cycle 605: 정합성 가드 — scripts/smoke-gameplay 3 callsite 보존', async () => {
      const source = await readSrc('scripts/smoke-gameplay.mjs');
      const calls = source.match(/seedEnhanceScenario\?\.\(\{[^}]+\}\)/g) || [];
      assert.equal(calls.length, 3, `smoke-gameplay seedEnhanceScenario 3 callsite 보존: ${calls.length}건`);
  });

  test('cycle 605: body preservedInventory / seededMaterials 처리 보존', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(/const preservedInventory = \(er\.player\.inv \|\| \[\]\)\.filter/.test(source),
          'preservedInventory filter 보존');
      assert.ok(/Array\.from\(\{ length: materialCount \}/.test(source),
          'seededMaterials Array.from(materialCount) 보존');
  });

  test('cycle 605: cycle 502-604 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ut = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/seedAvatarScenario:\s*\(preset:\s*any\s*=\s*'paladin-plate'\)/.test(ut),
          "cycle 604 seedAvatarScenario preset default 0건");

      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/summarizeHistory = \(history: any\[\]\s*=\s*\[\]/.test(aiu),
          'cycle 603 summarizeHistory history default 0건');
  });
}

// ─── cycle-606-generate-event-defaults-batch.test.js ───
{
  /**
   * cycle 606: generateEvent 3 defaults batch unreachable
   *   (cycle 222-605 silent dead config 시리즈 342번째 — redundant default annotation
   *   청소 메가 시리즈 추가, services/aiService.ts).
   *
   * 발견 (3 defaults batch):
   * - src/services/aiService.ts (line 67):
   *     generateEvent: async (loc: any, history: any[] = [], uid = 'anonymous',
   *         context: any = {}) => {...}
   * - 호출 사이트 (1 caller):
   *     · exploreActions.ts:71 — AI_SERVICE.generateEvent(player.loc, player.history,
   *       uid, {...context}) — 4 args 명시.
   *     · 다른 caller 0건.
   * - 결과: history / uid / context 항상 명시 전달. 3 defaults 모두 도달 불가.
   *
   * 패턴 (cycle 222-605 시리즈 342번째):
   * - cycle 502-605: default 청소 메가 시리즈 104사이클.
   * - cycle 606: services/aiService.ts cleanup. cycle 539 callProxy paired
   *   completion (동일 모듈 추가 cleanup).
   *
   * 수정 (src/services/aiService.ts):
   * - history default [] 제거.
   * - uid default 'anonymous' 제거.
   * - context default {} 제거.
   * - body의 isSmokeRuntime / pickFallbackEvent 호출 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (exploreActions) 동작 그대로.
   * - body TokenQuotaManager / pickFallbackEvent 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 606: generateEvent signature에서 3 defaults 0건', async () => {
      const source = await readSrc('src/services/aiService.ts');
      const fnIdx = source.indexOf('generateEvent: async');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/history:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'generateEvent history default [] 제거');
      assert.ok(!/uid\s*=\s*'anonymous'/.test(sig),
          "generateEvent uid default 'anonymous' 제거");
      assert.ok(!/context:\s*any\s*=\s*\{\}/.test(sig),
          'generateEvent context default {} 제거');
  });

  test('cycle 606: 정합성 가드 — exploreActions callsite 보존', async () => {
      const source = await readSrc('src/hooks/gameActions/exploreActions.ts');
      assert.ok(/AI_SERVICE\.generateEvent\(player\.loc,\s*player\.history,\s*uid,/.test(source),
          'exploreActions AI_SERVICE.generateEvent 4-arg callsite 보존');
  });

  test('cycle 606: body isSmokeRuntime / pickFallbackEvent 보존', async () => {
      const source = await readSrc('src/services/aiService.ts');
      assert.ok(/if \(isSmokeRuntime\(\)\)/.test(source), 'isSmokeRuntime 가드 보존');
      assert.ok(/return pickFallbackEvent\(loc,\s*history,\s*context\)/.test(source),
          'pickFallbackEvent(loc, history, context) 호출 보존');
  });

  test('cycle 606: cycle 502-605 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ut = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/seedEnhanceScenario:\s*\(\{ gold\s*=\s*500/.test(ut),
          'cycle 605 seedEnhanceScenario gold default 0건');

      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/summarizeHistory = \(history: any\[\]\s*=\s*\[\]/.test(aiu),
          'cycle 603 summarizeHistory history default 0건');
  });
}

// ─── cycle-607-unique-list-values-default-unreachable.test.js ───
{
  /**
   * cycle 607: uniqueList `values = []` default unreachable
   *   (cycle 222-606 silent dead config 시리즈 343번째 — redundant default annotation
   *   청소 메가 시리즈 추가, mapProgress.ts).
   *
   * 발견 (1 default unreachable):
   * - src/utils/mapProgress.ts (line 3):
   *     const uniqueList = (values: any = []) => [...new Set(values.filter(Boolean))];
   * - 호출 사이트 (1 caller):
   *     · mapProgress.ts:5 — uniqueList([...(map?.monsters || []), ...(map?.bossMonsters
   *       || []), typeof map?.boss === 'string' ? map.boss : null]) — spread array 명시.
   *     · 다른 caller 0건 (private 모듈 helper).
   * - 결과: values 항상 spread array 명시 전달. default [] 도달 불가.
   *
   * 패턴 (cycle 222-606 시리즈 343번째):
   * - cycle 502-606: default 청소 메가 시리즈 105사이클.
   * - cycle 607: utils/mapProgress.ts 추가 cleanup. cycle 577과 동일 모듈 paired.
   *
   * 수정 (src/utils/mapProgress.ts):
   * - signature에서 values: any = [] → values: any.
   * - body의 values.filter(Boolean) 처리 보존.
   *
   * 회귀 가드:
   * - 1 internal callsite 동작 그대로.
   * - body new Set / filter 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 607: uniqueList signature에서 values default 0건', async () => {
      const source = await readSrc('src/utils/mapProgress.ts');
      assert.ok(!/const uniqueList = \(values:\s*any\s*=\s*\[\]\)/.test(source),
          'uniqueList values default [] 제거');
      assert.ok(/const uniqueList = \(values:\s*any\)/.test(source),
          'uniqueList values 파라미터 자체는 보존');
  });

  test('cycle 607: 정합성 가드 — internal callsite 보존', async () => {
      const source = await readSrc('src/utils/mapProgress.ts');
      assert.ok(/uniqueList\(\[\s*\n\s*\.\.\.\(map\?\.monsters \|\| \[\]\)/.test(source),
          'getMapEncounterRoster uniqueList(spread array) callsite 보존');
  });

  test('cycle 607: body new Set / filter 처리 보존', async () => {
      const source = await readSrc('src/utils/mapProgress.ts');
      assert.ok(/\[\.\.\.new Set\(values\.filter\(Boolean\)\)\]/.test(source),
          '[...new Set(values.filter(Boolean))] 보존');
  });

  test('cycle 607: cycle 502-606 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ai = await readSrc('src/services/aiService.ts');
      assert.ok(!/generateEvent: async \(loc: any, history: any\[\]\s*=\s*\[\]/.test(ai),
          'cycle 606 generateEvent history default 0건');

      const ut = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/seedEnhanceScenario:\s*\(\{ gold\s*=\s*500/.test(ut),
          'cycle 605 seedEnhanceScenario gold default 0건');
  });
}

// ─── cycle-608-apply-name-dismiss-keyboard-explicit-cleanup.test.js ───
{
  /**
   * cycle 608: applyName `dismissKeyboard = false` default cleanup with explicit
   *   caller batch (cycle 222-607 silent dead config 시리즈 344번째 — explicit
   *   default-elimination pattern).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/components/IntroScreen.tsx (line 31):
   *     const applyName = (nextName: any, dismissKeyboard: any = false) => {...};
   * - 호출 사이트:
   *     · IntroScreen:109 — onChange={(e) => applyName(e.target.value)} — 1 arg.
   *     · IntroScreen:118 — onClick={() => applyName(createRandomMobileName(),
   *       true)} — 2 args.
   * - 기존 상태: line 109 caller가 dismissKeyboard 미전달 → default false 활성.
   *   default reachable이었음.
   *
   * 패턴 (cycle 222-607 시리즈 344번째):
   * - cycle 502-607: default 청소 메가 시리즈 106사이클.
   * - cycle 608: explicit default-elimination — caller 명시 false 추가하여 default
   *   unreachable 전환. partial cleanup이 아닌 active conversion. 신규 lens.
   *
   * 수정 (src/components/IntroScreen.tsx):
   * - line 109: applyName(e.target.value) → applyName(e.target.value, false).
   * - line 31: dismissKeyboard: any = false → dismissKeyboard: any.
   * - body의 dismissKeyboard ? input.blur() : null 분기 보존.
   *
   * 회귀 가드:
   * - 2 callsite 동작 그대로 (false / true 명시).
   * - body input.blur() 분기 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 608: applyName signature에서 dismissKeyboard default 0건', async () => {
      const source = await readSrc('src/components/IntroScreen.tsx');
      const fnIdx = source.indexOf('const applyName');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/dismissKeyboard:\s*any\s*=\s*false/.test(sig),
          'applyName dismissKeyboard default false 제거');
  });

  test('cycle 608: 정합성 가드 — 2 callsite 명시 (false/true)', async () => {
      const source = await readSrc('src/components/IntroScreen.tsx');
      assert.ok(/applyName\(e\.target\.value,\s*false\)/.test(source),
          'onChange callsite false 명시 추가');
      // cycle 611: createRandomMobileName 인자 추가 cascade — applyName(create
      //   RandomMobileName(Math.random), true) 형태로 변경됨. true 보존 가드만 유지.
      assert.ok(/applyName\(createRandomMobileName\([^)]*\),\s*true\)/.test(source),
          'onClick reroll callsite true 명시 보존');
  });

  test('cycle 608: cycle 502-607 회귀 가드 — default 청소 시리즈 보존', async () => {
      const mp = await readSrc('src/utils/mapProgress.ts');
      assert.ok(!/uniqueList = \(values:\s*any\s*=\s*\[\]\)/.test(mp),
          'cycle 607 uniqueList values default 0건');

      const ai = await readSrc('src/services/aiService.ts');
      assert.ok(!/generateEvent: async \(loc: any, history: any\[\]\s*=\s*\[\]/.test(ai),
          'cycle 606 generateEvent history default 0건');
  });
}

// ─── cycle-611-create-random-mobile-name-explicit-elimination.test.js ───
{
  /**
   * cycle 611: createRandomMobileName rng explicit default-elimination
   *   (cycle 222-610 silent dead config 시리즈 351번째 — explicit default-elimination
   *   pattern 3번째 적용, cycle 608/609에 이은).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/utils/nameGenerator.ts (line 55):
   *     export const createRandomMobileName = (rng: any = Math.random) => {...};
   * - 호출 사이트:
   *     · IntroScreen:17 — useState(() => createRandomMobileName()) — 0 args.
   *     · IntroScreen:121 — applyName(createRandomMobileName(), true) — 0 args.
   *     · tests/name-generator: 4 callers 모두 deterministic rng 명시.
   * - 기존 상태: 2 production caller가 rng 미전달 → default Math.random 활성.
   *
   * 패턴 (cycle 222-610 시리즈 351번째):
   * - cycle 502-610: default 청소 메가 시리즈 109사이클.
   * - cycle 611: explicit default-elimination 3번째 (cycle 608/609 신규 lens
   *   3번째 적용).
   *
   * 수정:
   * - IntroScreen.tsx:17/121 — createRandomMobileName() → createRandomMobileName(Math.random).
   * - nameGenerator.ts:55 — rng default Math.random 제거.
   *
   * 회귀 가드:
   * - 2 production + 4 test callsite 동작 그대로.
   * - body의 rng() / pick / generateFromParts 호출 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 611: createRandomMobileName signature에서 rng default 0건', async () => {
      const source = await readSrc('src/utils/nameGenerator.ts');
      assert.ok(!/createRandomMobileName = \(rng:\s*any\s*=\s*Math\.random\)/.test(source),
          'createRandomMobileName rng default Math.random 제거');
  });

  test('cycle 611: 정합성 가드 — IntroScreen 2 callsite Math.random 명시 추가', async () => {
      const source = await readSrc('src/components/IntroScreen.tsx');
      assert.ok(/createRandomMobileName\(Math\.random\)/.test(source),
          'IntroScreen createRandomMobileName(Math.random) 명시');
      const calls = (source.match(/createRandomMobileName\(Math\.random\)/g) || []).length;
      assert.equal(calls, 2, `IntroScreen 2 callsite Math.random 명시: ${calls}건`);
  });

  test('cycle 611: test callsite 보존 (deterministic rng)', async () => {
      const source = await readSrc('tests/name-generator.test.js');
      assert.ok(/createRandomMobileName\(\(\) => 0\)/.test(source),
          'name-generator test callsite (() => 0) 보존');
  });

  test('cycle 611: cycle 502-610 회귀 가드 — default 청소 시리즈 보존', async () => {
      const gu = await readSrc('src/utils/graveUtils.ts');
      assert.ok(!/buildGraveData = \(player: Player, random:\s*any\s*=\s*Math\.random/.test(gu),
          'cycle 609 buildGraveData random default 0건');

      const intro = await readSrc('src/components/IntroScreen.tsx');
      assert.ok(!/dismissKeyboard:\s*any\s*=\s*false/.test(intro),
          'cycle 608 applyName dismissKeyboard default 0건');
  });
}

// ─── cycle-612-get-run-build-profile-explicit-elimination.test.js ───
{
  /**
   * cycle 612: getRunBuildProfile stats explicit default-elimination
   *   (cycle 222-611 silent dead config 시리즈 352번째 — explicit default-elimination
   *   pattern 4번째 적용).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/utils/runProfile.ts (line 47):
   *     export const getRunBuildProfile = (player: Player, stats: any = {}) => {...};
   * - 호출 사이트:
   *     · BuildAdvicePanel:56 — getRunBuildProfile(player || {}) — 1 arg.
   *     · cycle-345 test:65 — getRunBuildProfile(player) — 1 arg.
   *     · 5 다른 callers (statsCalculator/gameUtils/useGameEngine/exploreActions/
   *       combatVictory): 2 args 명시.
   * - 기존 상태: 2 caller (BuildAdvicePanel + cycle-345)가 stats 미전달 →
   *   default {} 활성.
   *
   * 패턴 (cycle 222-611 시리즈 352번째):
   * - cycle 502-611: default 청소 메가 시리즈 110사이클.
   * - cycle 612: explicit default-elimination 4번째 (cycle 608/609/611에 이은).
   *
   * 수정:
   * - BuildAdvicePanel.tsx:56 — getRunBuildProfile(player || {}) → getRunBuildProfile(player || {}, {}).
   * - cycle-345 test:65 — getRunBuildProfile(player) → getRunBuildProfile(player, {}).
   * - runProfile.ts:47 — stats default {} 제거.
   *
   * 회귀 가드:
   * - 7 callsite 동작 그대로.
   * - body 동작 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 612: getRunBuildProfile signature에서 stats default 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnIdx = source.indexOf('export const getRunBuildProfile');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig),
          'getRunBuildProfile stats default {} 제거');
  });

  test('cycle 612: 정합성 가드 — caller 명시 {} 추가 (BuildAdvicePanel + cycle-345)', async () => {
      const bap = await readSrc('src/components/BuildAdvicePanel.tsx');
      assert.ok(/getRunBuildProfile\(player \|\| \{\},\s*\{\}\)/.test(bap),
          'BuildAdvicePanel getRunBuildProfile(player || {}, {}) 명시');

      const test1 = await readSrc('tests/cycle-300-399.test.js');
      assert.ok(/getRunBuildProfile\(player,\s*\{\}\)/.test(test1),
          'cycle-345 test getRunBuildProfile(player, {}) 명시');
  });

  test('cycle 612: cycle 502-611 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ng = await readSrc('src/utils/nameGenerator.ts');
      assert.ok(!/createRandomMobileName = \(rng:\s*any\s*=\s*Math\.random\)/.test(ng),
          'cycle 611 createRandomMobileName rng default 0건');

      const gu = await readSrc('src/utils/graveUtils.ts');
      assert.ok(!/buildGraveData = \(player: Player, random:\s*any\s*=\s*Math\.random/.test(gu),
          'cycle 609 buildGraveData random default 0건');
  });
}

// ─── cycle-615-sanitize-value-explicit-elimination.test.js ───
{
  /**
   * cycle 615: sanitizeValue depth explicit default-elimination
   *   (cycle 222-614 silent dead config 시리즈 355번째 — explicit default-elimination
   *   pattern 7번째 적용).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/hooks/useGameTestApi.ts (line 133):
   *     const sanitizeValue = (value: any, depth: any = 0): any => {...};
   * - 호출 사이트:
   *     · sanitizeValue:138 — sanitizeValue(entry, depth + 1) — 2 args.
   *     · sanitizeValue:152 — sanitizeValue(value[key], depth + 1) — 2 args.
   *     · render_game_to_text:164 — sanitizeValue({...}) — 1 arg only (top-level).
   * - 기존 상태: line 164 (top-level) caller가 depth 미전달 → default 0 활성.
   *
   * 패턴 (cycle 222-614 시리즈 355번째):
   * - cycle 502-614: default 청소 메가 시리즈 113사이클.
   * - cycle 615: explicit default-elimination 7번째 (cycle 608-614 lens 정착).
   *
   * 수정:
   * - useGameTestApi.ts:164 — sanitizeValue({...}) → sanitizeValue({...}, 0).
   * - useGameTestApi.ts:133 — depth default 0 제거.
   *
   * 회귀 가드:
   * - 3 internal callsite 동작 그대로.
   * - body recursion (depth + 1) 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 615: sanitizeValue signature에서 depth default 0건', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      const fnIdx = source.indexOf('const sanitizeValue');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/depth:\s*any\s*=\s*0/.test(sig),
          'sanitizeValue depth default 0 제거');
  });

  test('cycle 615: 정합성 가드 — top-level caller 0 명시 추가', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      // top-level call sanitizeValue({...}, 0) 명시 (cycle 615 추가)
      assert.ok(/JSON\.stringify\(sanitizeValue\(\{[\s\S]+?\},\s*0\)\)/.test(source),
          'render_game_to_text sanitizeValue(...,0) 명시 전달');
  });

  test('cycle 615: body recursion (depth + 1) 보존', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(/sanitizeValue\(entry,\s*depth \+ 1\)/.test(source),
          'recursion sanitizeValue(entry, depth + 1) 보존');
      assert.ok(/sanitizeValue\(value\[key\],\s*depth \+ 1\)/.test(source),
          'recursion sanitizeValue(value[key], depth + 1) 보존');
  });

  test('cycle 615: cycle 502-614 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ld = await readSrc('src/hooks/useLegendaryDropDetector.ts');
      assert.ok(!/getSignatureItemNames = \(inv:\s*any\s*=\s*\[\]\)/.test(ld),
          'cycle 614 getSignatureItemNames inv default 0건');

      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/getTraitProfile = \(player: Player, stats:\s*any\s*=\s*\{\}\)/.test(rp),
          'cycle 613 getTraitProfile stats default 0건');
  });
}

// ─── cycle-616-safe-text-explicit-elimination.test.js ───
{
  /**
   * cycle 616: safeText fallback explicit default-elimination
   *   (cycle 222-615 silent dead config 시리즈 356번째 — explicit default-elimination
   *   pattern 8번째 적용).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/hooks/useGameTestApi.ts (line 113):
   *     const safeText = (value: any, fallback: any = '') => {...};
   * - 호출 사이트:
   *     · safeText:131 — safeText(item, fallback) — 2 args (recursion).
   *     · safeText:147 — safeText(value, tag) — 2 args.
   *     · safeText:200/207/214 — safeText(e.currentEvent.desc/...) — 1 arg only.
   * - 기존 상태: 3 callers가 fallback 미전달 → default '' 활성.
   *
   * 패턴 (cycle 222-615 시리즈 356번째):
   * - cycle 502-615: default 청소 메가 시리즈 114사이클.
   * - cycle 616: explicit default-elimination 8번째 (cycle 608-615 lens 정착).
   *
   * 수정:
   * - useGameTestApi.ts:200 — safeText(e.currentEvent.desc) → safeText(..., '').
   * - useGameTestApi.ts:207 — safeText(e.postCombatResult.enemy) → safeText(..., '').
   * - useGameTestApi.ts:214 — safeText(is.title) → safeText(is.title, '').
   * - useGameTestApi.ts:113 — fallback default '' 제거.
   *
   * 회귀 가드:
   * - 5 internal callsite 동작 그대로.
   * - body 동작 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 616: safeText signature에서 fallback default 0건', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      const fnIdx = source.indexOf('const safeText');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/fallback:\s*any\s*=\s*''/.test(sig),
          "safeText fallback default '' 제거");
  });

  test('cycle 616: 정합성 가드 — 3 callsite \'\' 명시 추가', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(/safeText\(e\.currentEvent\.desc,\s*''\)/.test(source),
          "currentEvent.desc safeText '' 명시");
      assert.ok(/safeText\(e\.postCombatResult\.enemy,\s*''\)/.test(source),
          "postCombatResult.enemy safeText '' 명시");
      assert.ok(/safeText\(is\.title,\s*''\)/.test(source),
          "is.title safeText '' 명시");
  });

  test('cycle 616: cycle 502-615 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ut = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/sanitizeValue = \(value: any, depth:\s*any\s*=\s*0\)/.test(ut),
          'cycle 615 sanitizeValue depth default 0건');

      const ld = await readSrc('src/hooks/useLegendaryDropDetector.ts');
      assert.ok(!/getSignatureItemNames = \(inv:\s*any\s*=\s*\[\]\)/.test(ld),
          'cycle 614 getSignatureItemNames inv default 0건');
  });
}

// ─── cycle-617-safe-list-explicit-elimination.test.js ───
{
  /**
   * cycle 617: safeList fallback explicit default-elimination
   *   (cycle 222-616 silent dead config 시리즈 357번째 — explicit default-elimination
   *   pattern 9번째 적용).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/hooks/useGameTestApi.ts (line 130):
   *     const safeList = (items: any, fallback: any = '[item]') => (
   *         Array.isArray(items) ? items.map((item: any) => safeText(item, fallback)) : []
   *     );
   * - 호출 사이트:
   *     · safeList:204 — safeList(e.currentEvent.choices, '[choice]') — 2 args.
   *     · safeList:213 — safeList(e.postCombatResult.items) — 1 arg only.
   *     · safeList:217 — safeList(is.names) — 1 arg only.
   * - 기존 상태: 2 callers (213/217)가 fallback 미전달 → default '[item]' 활성.
   *
   * 패턴 (cycle 222-616 시리즈 357번째):
   * - cycle 502-616: default 청소 메가 시리즈 115사이클.
   * - cycle 617: explicit default-elimination 9번째 (cycle 608-616 lens 정착).
   *   useGameTestApi.ts 같은 모듈에서 cycle 615/616에 이은 3 cycle 연속.
   *
   * 수정:
   * - useGameTestApi.ts:213 — safeList(e.postCombatResult.items, '[item]') 명시.
   * - useGameTestApi.ts:217 — safeList(is.names, '[item]') 명시.
   * - useGameTestApi.ts:130 — fallback default '[item]' 제거.
   *
   * 회귀 가드:
   * - 3 internal callsite 동작 그대로.
   * - body Array.isArray + map(safeText) 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 617: safeList signature에서 fallback default 0건', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      const fnIdx = source.indexOf('const safeList');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/fallback:\s*any\s*=\s*'\[item\]'/.test(sig),
          "safeList fallback default '[item]' 제거");
  });

  test("cycle 617: 정합성 가드 — 2 callsite '[item]' 명시 추가", async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(/safeList\(e\.postCombatResult\.items,\s*'\[item\]'\)/.test(source),
          "postCombatResult.items safeList '[item]' 명시");
      assert.ok(/safeList\(is\.names,\s*'\[item\]'\)/.test(source),
          "is.names safeList '[item]' 명시");
  });

  test("cycle 617: '[choice]' caller (currentEvent.choices) 보존", async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(/safeList\(e\.currentEvent\.choices,\s*'\[choice\]'\)/.test(source),
          "currentEvent.choices safeList('...', '[choice]') 보존");
  });

  test('cycle 617: cycle 502-616 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ut = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/safeText = \(value: any, fallback:\s*any\s*=\s*''\)/.test(ut),
          "cycle 616 safeText fallback default '' 0건");
      assert.ok(!/sanitizeValue = \(value: any, depth:\s*any\s*=\s*0\)/.test(ut),
          'cycle 615 sanitizeValue depth default 0건');
  });
}

// ─── cycle-618-get-iso-week-number-explicit-elimination.test.js ───
{
  /**
   * cycle 618: getISOWeekNumber date explicit default-elimination
   *   (cycle 222-617 silent dead config 시리즈 358번째 — explicit default-elimination
   *   pattern 10번째 적용).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/utils/exploreUtils.ts (line 20):
   *     const getISOWeekNumber = (date = new Date()) => {...};
   * - 호출 사이트:
   *     · resetWeeklyProtocolIfNeeded:31 — getISOWeekNumber() — 0 args.
   * - 기존 상태: caller가 date 미전달 → default `new Date()` 활성.
   *
   * 패턴 (cycle 222-617 시리즈 358번째):
   * - cycle 502-617: default 청소 메가 시리즈 116사이클.
   * - cycle 618: explicit default-elimination 10번째 (cycle 608-617 lens 정착).
   *   double-digit milestone (10번째 적용).
   *
   * 수정:
   * - exploreUtils.ts:31 — getISOWeekNumber() → getISOWeekNumber(new Date()).
   * - exploreUtils.ts:20 — date default new Date() 제거.
   *
   * 회귀 가드:
   * - 1 internal callsite 동작 그대로.
   * - body Date.UTC / setUTCDate / Math.ceil 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 618: getISOWeekNumber signature에서 date default 0건', async () => {
      const source = await readSrc('src/utils/exploreUtils.ts');
      assert.ok(!/getISOWeekNumber = \(date = new Date\(\)\)/.test(source),
          'getISOWeekNumber date default new Date() 제거');
      assert.ok(/getISOWeekNumber = \(date(?::\s*Date)?\)/.test(source),
          'getISOWeekNumber date 파라미터 보존');
  });

  test('cycle 618: 정합성 가드 — caller new Date() 명시 추가', async () => {
      const source = await readSrc('src/utils/exploreUtils.ts');
      assert.ok(/getISOWeekNumber\(new Date\(\)\)/.test(source),
          'resetWeeklyProtocolIfNeeded getISOWeekNumber(new Date()) 명시');
  });

  test('cycle 618: cycle 502-617 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ut = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/safeList = \(items: any, fallback:\s*any\s*=\s*'\[item\]'\)/.test(ut),
          "cycle 617 safeList fallback default '[item]' 0건");

      assert.ok(!/safeText = \(value: any, fallback:\s*any\s*=\s*''\)/.test(ut),
          "cycle 616 safeText fallback default '' 0건");
  });
}

// ─── cycle-619-get-tone-key-slot-explicit-elimination.test.js ───
{
  /**
   * cycle 619: getToneKey slot default 'weapon' explicit elimination
   *   (cycle 222-618 silent dead config 시리즈 358번째 — explicit
   *   default-elimination pattern 11번째 적용, 이중자릿수 진입 후 첫 사이클).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/utils/equipmentArt.ts (line 58):
   *     const getToneKey = (item: Item | null | undefined, slot: any = 'weapon') => {...}
   * - 호출 사이트 6개 모두 명시 인자 전달:
   *     · line 156: getToneKey(item, 'armor')
   *     · line 172: getToneKey(item, 'offhand')
   *     · line 185: getToneKey(item, 'weapon')
   *     · line 200: getToneKey(item, slotHint || item.type)
   *     · line 201: getToneKey(item, slotHint || item.type)
   *     · line 202: getToneKey(item, slotHint || item.type)
   * - default 'weapon' 도달 불가 (이미 unreachable).
   *
   * 패턴 (cycle 222-618 시리즈 358번째):
   * - cycle 502-618: default 청소 메가 시리즈 116사이클.
   * - cycle 619: explicit default-elimination 11번째 (cycle 618 10th 이중자릿수
   *   진입 후 첫 적용). 6 callsite 모두 명시인 상태에서 signature 정리.
   *
   * 수정:
   * - equipmentArt.ts:58 — slot default 'weapon' 제거.
   *
   * 회귀 가드:
   * - 6 internal callsite 동작 그대로 (이미 명시).
   * - body branch 처리 보존 (armor/offhand/weapon 분기).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 619: getToneKey signature에서 slot default 'weapon' 0건", async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(!/const getToneKey = \(item:[^)]+slot:\s*any\s*=\s*'weapon'\)/.test(source),
          "getToneKey slot default 'weapon' 제거");
      assert.ok(/const getToneKey = \(item:[^)]+slot:\s*any\)/.test(source),
          'getToneKey slot 파라미터 보존 (default 없이)');
  });

  test('cycle 619: 6 callsite slot 명시 보존', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(/getToneKey\(item,\s*'armor'\)/.test(source), "armor caller 보존");
      assert.ok(/getToneKey\(item,\s*'offhand'\)/.test(source), "offhand caller 보존");
      assert.ok(/getToneKey\(item,\s*'weapon'\)/.test(source), "weapon caller 보존");
      const slotHintCount = (source.match(/getToneKey\(item,\s*slotHint\s*\|\|\s*item\.type\)/g) || []).length;
      assert.equal(slotHintCount, 3, 'slotHint || item.type caller 3건 보존');
  });

  test('cycle 619: cycle 502-618 회귀 가드 — default 청소 시리즈 보존', async () => {
      const eu = await readSrc('src/utils/exploreUtils.ts');
      assert.ok(!/getISOWeekNumber = \(date\s*=\s*new Date\(\)\)/.test(eu),
          'cycle 618 getISOWeekNumber date default 0건');
      const ut = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/safeList = \(items: any, fallback:\s*any\s*=\s*'\[item\]'\)/.test(ut),
          "cycle 617 safeList fallback default 0건");
  });
}

// ─── cycle-621-signed-delta-suffix-explicit-elimination.test.js ───
{
  /**
   * cycle 621: signedDelta suffix '' explicit default-elimination
   *   (cycle 222-620 silent dead config 시리즈 359번째 — explicit
   *   default-elimination pattern 12번째 적용).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/components/ShopPanel.tsx (line 41):
   *     const signedDelta = (value: any, suffix: any = '') => ...
   * - 호출 사이트 3개 모두 1 arg 전달 → suffix default '' 활성:
   *     · ShopPanel.tsx:68 — signedDelta(atkDelta)
   *     · ShopPanel.tsx:69 — signedDelta(defDelta)
   *     · ShopPanel.tsx:71 — signedDelta(mpDelta)
   *
   * 패턴 (cycle 222-620 시리즈 359번째):
   * - cycle 542: signedDelta value default 0 제거 (partial). suffix는 reachable
   *   보존이었음.
   * - cycle 621: explicit default-elimination 12번째. cycle 542 partial이
   *   reachable 처리한 suffix를 caller-side conversion으로 unreachable 변환.
   *
   * 수정:
   * - ShopPanel.tsx:68/69/71 — signedDelta(atkDelta, '') / (defDelta, '') /
   *   (mpDelta, '') 명시.
   * - ShopPanel.tsx:41 — suffix default '' 제거.
   *
   * 회귀 가드:
   * - 3 internal callsite 동작 그대로.
   * - body `${value >= 0 ? '+' : ''}${value}${suffix}` 처리 보존.
   * - cycle 542 value default 0 제거 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 621: signedDelta signature에서 suffix default '' 0건", async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/const signedDelta = \([^)]*suffix:\s*any\s*=\s*''\)/.test(source),
          "signedDelta suffix default '' 제거");
      assert.ok(/const signedDelta = \(value: any, suffix: any\)/.test(source),
          'signedDelta suffix 파라미터 보존 (default 없이)');
  });

  test("cycle 621: 3 callsite suffix '' 명시 추가", async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(/signedDelta\(atkDelta,\s*''\)/.test(source),
          "atkDelta caller suffix '' 명시");
      assert.ok(/signedDelta\(defDelta,\s*''\)/.test(source),
          "defDelta caller suffix '' 명시");
      assert.ok(/signedDelta\(mpDelta,\s*''\)/.test(source),
          "mpDelta caller suffix '' 명시");
  });

  test('cycle 621: cycle 502-620 회귀 가드 — default 청소 시리즈 보존', async () => {
      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/const signedDelta\s*=\s*\(value:\s*any\s*=\s*0/.test(sp),
          'cycle 542 signedDelta value default 0건 보존');
      const ea = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(!/const getToneKey = \(item:[^)]+slot:\s*any\s*=\s*'weapon'\)/.test(ea),
          "cycle 619 getToneKey slot default 'weapon' 0건");
  });
}

// ─── cycle-622-track-call-call-type-explicit-elimination.test.js ───
{
  /**
   * cycle 622: LatencyTracker.trackCall callType 'ai' explicit default-elimination
   *   (cycle 222-621 silent dead config 시리즈 360번째 — explicit
   *   default-elimination pattern 13번째 적용, cycle 619 변형 패턴 2번째).
   *
   * 발견 (default 이미 unreachable, signature 정리):
   * - src/systems/LatencyTracker.ts:11:
   *     async trackCall(asyncFn: any, callType: any = 'ai') {...}
   * - 호출 사이트 모두 명시 인자 전달:
   *     · aiService.ts:41 — LatencyTracker.trackCall(async () => {...}, trackLabel) (cycle 539 callProxy 변경 후).
   *     · cycle 308 fixture: trackCall(fastFn, 'test').
   * - default 'ai' 이미 도달 불가.
   *
   * 패턴 (cycle 222-621 시리즈 360번째):
   * - cycle 502-621: default 청소 메가 시리즈 117사이클.
   * - cycle 622: explicit default-elimination 13번째 (cycle 619 변형 패턴
   *   2번째 — caller 모두 이미 명시 상태에서 signature default 정리).
   *
   * 수정:
   * - LatencyTracker.ts:11 — callType default 'ai' 제거.
   *
   * 회귀 가드:
   * - aiService callsite trackLabel 인자 보존 (cycle 539).
   * - body slow-response console.warn + onSlowResponse 처리 보존.
   * - cycle 308 trackCall fixture (callType 'test') 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 622: trackCall signature에서 callType default 'ai' 0건", async () => {
      const source = await readSrc('src/systems/LatencyTracker.ts');
      assert.ok(!/async trackCall\([^)]*callType:\s*any\s*=\s*'ai'\)/.test(source),
          "trackCall callType default 'ai' 제거");
      assert.ok(/async trackCall\(asyncFn: any, callType: any\)/.test(source),
          'trackCall callType 파라미터 보존 (default 없이)');
  });

  test("cycle 622: aiService callsite trackLabel 인자 보존 (cycle 539)", async () => {
      const source = await readSrc('src/services/aiService.ts');
      // multi-line trackCall: ends with `}, trackLabel);` after body closes
      assert.ok(/LatencyTracker\.trackCall\(async \(\) => \{[\s\S]*?\},\s*trackLabel\)/.test(source),
          "aiService trackCall callsite trackLabel 명시 보존");
  });

  test('cycle 622: trackCall body slow-response 처리 보존', async () => {
      const source = await readSrc('src/systems/LatencyTracker.ts');
      assert.ok(/console\.warn\(`⚠️ Slow \$\{callType\} response/.test(source),
          'slow-response console.warn 보존');
      assert.ok(/this\.onSlowResponse\(callType,\s*latency\)/.test(source),
          'onSlowResponse(callType, latency) 보존');
  });

  test('cycle 622: cycle 502-621 회귀 가드 — default 청소 시리즈 보존', async () => {
      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/const signedDelta = \([^)]*suffix:\s*any\s*=\s*''\)/.test(sp),
          "cycle 621 signedDelta suffix default 0건");
      const ea = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(!/const getToneKey = \(item:[^)]+slot:\s*any\s*=\s*'weapon'\)/.test(ea),
          "cycle 619 getToneKey slot default 0건");
  });
}

// ─── cycle-623-count-low-hp-wins-threshold-explicit-elimination.test.js ───
{
  /**
   * cycle 623: countLowHpWins threshold 0.2 explicit default-elimination
   *   (cycle 222-622 silent dead config 시리즈 361번째 — explicit
   *   default-elimination pattern 14번째 적용, cycle 619 변형 패턴 3번째).
   *
   * 발견 (default 이미 unreachable, signature 정리):
   * - src/systems/DifficultyManager.ts:149:
   *     export const countLowHpWins = (stats: any, threshold: any = 0.2) => {...}
   * - 호출 사이트 모두 명시 인자 전달:
   *     · questProgress.ts:44 — countLowHpWins(player.stats, questData.threshold || 0.2).
   *     · runProfile.ts:161 — countLowHpWins(player?.stats, 0.2).
   *     · runProfile.ts:212 — countLowHpWins(behaviorStats, 0.2).
   * - default 0.2 이미 도달 불가.
   *
   * 패턴 (cycle 222-622 시리즈 361번째):
   * - cycle 502-622: default 청소 메가 시리즈 118사이클.
   * - cycle 623: explicit default-elimination 14번째 (cycle 619/622에 이은
   *   변형 패턴 3번째 — caller 모두 이미 명시 상태).
   *
   * 수정:
   * - DifficultyManager.ts:149 — threshold default 0.2 제거.
   *
   * 회귀 가드:
   * - 3 internal callsite 동작 그대로 (이미 명시).
   * - body recentBattles filter + lowHpWins fallback 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 623: countLowHpWins signature에서 threshold default 0.2 0건', async () => {
      const source = await readSrc('src/systems/DifficultyManager.ts');
      assert.ok(!/countLowHpWins = \(stats:\s*any,\s*threshold:\s*any\s*=\s*0\.2\)/.test(source),
          'countLowHpWins threshold default 0.2 제거');
      assert.ok(/countLowHpWins = \(stats:\s*any,\s*threshold:\s*any\)/.test(source),
          'countLowHpWins threshold 파라미터 보존 (default 없이)');
  });

  test('cycle 623: 3 callsite threshold 명시 보존', async () => {
      const qp = await readSrc('src/utils/questProgress.ts');
      assert.ok(/countLowHpWins\(player\.stats,\s*questData\.threshold\s*\|\|\s*0\.2\)/.test(qp),
          "questProgress callsite 'questData.threshold || 0.2' 보존");

      const rp = await readSrc('src/utils/runProfile.ts');
      const matches = (rp.match(/countLowHpWins\([^,]+,\s*0\.2\)/g) || []).length;
      assert.equal(matches, 2, 'runProfile callsite 0.2 명시 2건 보존');
  });

  test('cycle 623: countLowHpWins body recentBattles filter 보존', async () => {
      const source = await readSrc('src/systems/DifficultyManager.ts');
      assert.ok(/battle\.hpRatio\s*<=\s*threshold/.test(source),
          'recentBattles filter threshold 비교 보존');
      assert.ok(/return stats\?\.lowHpWins \|\| 0/.test(source),
          'fallback lowHpWins 처리 보존');
  });

  test('cycle 623: cycle 502-622 회귀 가드 — default 청소 시리즈 보존', async () => {
      const lt = await readSrc('src/systems/LatencyTracker.ts');
      assert.ok(!/async trackCall\([^)]*callType:\s*any\s*=\s*'ai'\)/.test(lt),
          "cycle 622 trackCall callType default 0건");
      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/const signedDelta = \([^)]*suffix:\s*any\s*=\s*''\)/.test(sp),
          "cycle 621 signedDelta suffix default 0건");
  });
}

// ─── cycle-624-handle-victory-defaults-explicit-elimination.test.js ───
{
  /**
   * cycle 624: CombatEngine.handleVictory passiveBonus/liveConfig {} explicit
   *   default-elimination paired batch
   *   (cycle 222-623 silent dead config 시리즈 362번째 — explicit
   *   default-elimination pattern 15번째 적용, 변형 패턴 4번째 + paired batch
   *   2번째 (cycle 613 paired에 이은)).
   *
   * 발견 (2 defaults 이미 unreachable, signature 정리):
   * - src/systems/CombatEngine.ts:1424:
   *     handleVictory(player: Player, enemy: Monster, passiveBonus: any = {}, liveConfig: any = {})
   * - 호출 사이트 모두 명시 인자 전달:
   *     · combatActions/combatVictory.ts:37 — handleVictory(playerAfterCombat,
   *       deadEnemy, passiveBonus, liveConfig). 4 args 모두 명시.
   *     · cycle 265 fixture: handleVictory(player, enemy, {}, {}) / (player,
   *       enemy, {}, liveConfig) 모두 4 args 명시.
   * - default {} {} 이미 도달 불가.
   *
   * 패턴 (cycle 222-623 시리즈 362번째):
   * - cycle 502-623: default 청소 메가 시리즈 119사이클.
   * - cycle 624: explicit default-elimination 15번째.
   *   변형 패턴 4번째 + paired batch 2번째 (1 cycle에 2 default 동시 정리,
   *   cycle 613 getTraitProfile/getTraitSkill paired에 이은 2번째).
   *
   * 수정:
   * - CombatEngine.ts:1424 — passiveBonus/liveConfig default {} {} 제거.
   *
   * 회귀 가드:
   * - 1 production callsite 동작 그대로 (이미 명시).
   * - cycle 265 fixture (4 args 명시) 동작 그대로.
   * - body liveConfig.eventMultiplier / passiveBonus.goldMult 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 624: handleVictory signature에서 passiveBonus/liveConfig defaults 0건', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/handleVictory\([^)]*passiveBonus:\s*any\s*=\s*\{\}/.test(source),
          'handleVictory passiveBonus default {} 제거');
      assert.ok(!/handleVictory\([^)]*liveConfig:\s*any\s*=\s*\{\}/.test(source),
          'handleVictory liveConfig default {} 제거');
      assert.ok(/handleVictory\(player: Player, enemy: Monster, passiveBonus: any, liveConfig: any\)/.test(source),
          'handleVictory 시그니처 4-arg 보존 (default 없이)');
  });

  test('cycle 624: production callsite 4 args 명시 보존', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/CombatEngine\.handleVictory\(playerAfterCombat,\s*deadEnemy,\s*passiveBonus,\s*liveConfig\)/.test(source),
          'combatVictory.ts handleVictory 4 args 명시 보존');
  });

  test('cycle 624: handleVictory body liveConfig/passiveBonus 처리 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/liveConfig\?\.eventMultiplier/.test(source),
          'liveConfig.eventMultiplier 처리 보존');
      // passiveBonus 사용 (cycle 265 ad/passive bonus 분리)
      assert.ok(/passiveBonus/.test(source),
          'passiveBonus 처리 보존');
  });

  test('cycle 624: cycle 502-623 회귀 가드 — default 청소 시리즈 보존', async () => {
      const dm = await readSrc('src/systems/DifficultyManager.ts');
      assert.ok(!/countLowHpWins = \(stats:\s*any,\s*threshold:\s*any\s*=\s*0\.2\)/.test(dm),
          'cycle 623 countLowHpWins threshold default 0건');
      const lt = await readSrc('src/systems/LatencyTracker.ts');
      assert.ok(!/async trackCall\([^)]*callType:\s*any\s*=\s*'ai'\)/.test(lt),
          "cycle 622 trackCall callType default 0건");
  });
}

// ─── cycle-625-generate-story-uid-explicit-elimination.test.js ───
{
  /**
   * cycle 625: generateStory uid 'anonymous' explicit default-elimination
   *   (cycle 222-624 silent dead config 시리즈 363번째 — explicit
   *   default-elimination pattern 16번째 적용, 변형 패턴 5번째).
   *
   * 발견 (default 이미 unreachable, signature 정리):
   * - src/services/aiService.ts:115:
   *     generateStory: async (type: any, data: any, uid: any = 'anonymous') => {...}
   * - 호출 사이트 모두 명시 인자 전달:
   *     · useGameEngine.ts:106 — AI_SERVICE.generateStory(type, {...}, uid).
   * - default 'anonymous' 이미 도달 불가.
   *
   * 패턴 (cycle 222-624 시리즈 363번째):
   * - cycle 502-624: default 청소 메가 시리즈 120사이클.
   * - cycle 625: explicit default-elimination 16번째 (cycle 619/622/623/624
   *   변형 패턴 5번째 — caller 모두 이미 명시 상태).
   *
   * 수정:
   * - aiService.ts:115 — uid default 'anonymous' 제거.
   *
   * 회귀 가드:
   * - 1 production callsite 동작 그대로 (이미 명시).
   * - body callProxy(... uid) 처리 보존 (line 149).
   * - cycle 606 generateEvent 3 defaults 0건 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 625: generateStory signature에서 uid default 'anonymous' 0건", async () => {
      const source = await readSrc('src/services/aiService.ts');
      assert.ok(!/generateStory:\s*async\s*\([^)]*uid:\s*any\s*=\s*'anonymous'\)/.test(source),
          "generateStory uid default 'anonymous' 제거");
      assert.ok(/generateStory:\s*async\s*\(type:\s*any,\s*data:\s*any,\s*uid:\s*any\)/.test(source),
          'generateStory uid 파라미터 보존 (default 없이)');
  });

  test('cycle 625: useGameEngine generateStory callsite uid 명시 보존', async () => {
      const source = await readSrc('src/hooks/useGameEngine.ts');
      assert.ok(/AI_SERVICE\.generateStory\(type,\s*\{[\s\S]*?\},\s*uid\)/.test(source),
          'useGameEngine generateStory callsite uid 명시 보존');
  });

  test('cycle 625: generateStory body callProxy uid 처리 보존', async () => {
      const source = await readSrc('src/services/aiService.ts');
      // line 149 callProxy(... uid)
      assert.ok(/uid/.test(source.slice(source.indexOf('generateStory'))),
          'generateStory body uid 사용 보존');
  });

  test('cycle 625: cycle 502-624 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/handleVictory\([^)]*passiveBonus:\s*any\s*=\s*\{\}/.test(ce),
          'cycle 624 handleVictory passiveBonus default 0건');
      const dm = await readSrc('src/systems/DifficultyManager.ts');
      assert.ok(!/countLowHpWins = \(stats:\s*any,\s*threshold:\s*any\s*=\s*0\.2\)/.test(dm),
          'cycle 623 countLowHpWins threshold default 0건');
  });
}

// ─── cycle-626-render-action-button-defaults-explicit-elimination.test.js ───
{
  /**
   * cycle 626: renderActionButton extraClass '' / outer {} explicit
   *   default-elimination paired batch
   *   (cycle 222-625 silent dead config 시리즈 364번째 — explicit
   *   default-elimination pattern 17번째 적용, paired batch 3번째 (cycle
   *   613/624 paired에 이은)).
   *
   * 발견 (2 defaults reachable → unreachable conversion):
   * - src/components/ControlPanel.tsx:76:
   *     const renderActionButton = (button: any, extraClass: any = '', { hideLabel = false }: any = {}) => {...}
   * - 호출 사이트 3개 모두 1 arg 전달 → 두 outer defaults 활성:
   *     · ControlPanel.tsx:284 — renderActionButton(button) (coreButtons map).
   *     · ControlPanel.tsx:285 — renderActionButton(button) (safeZoneButtons map).
   *     · ControlPanel.tsx:286 — renderActionButton(button) (auxiliaryButtons map).
   * - 3 callsite 모두 1 arg 전달이라 extraClass '' / outer {} default 활성.
   * - inner destructure default `hideLabel = false`는 별개 (caller가 {} 명시
   *   해도 그대로 기본값 적용). 보존.
   *
   * 패턴 (cycle 222-625 시리즈 364번째):
   * - cycle 502-625: default 청소 메가 시리즈 121사이클.
   * - cycle 626: explicit default-elimination 17번째.
   *   paired batch 3번째 (cycle 613 getTraitProfile/getTraitSkill, cycle 624
   *   handleVictory passiveBonus/liveConfig에 이은). 1 cycle에 2 outer default
   *   동시 정리 + inner destructure default 보존.
   *
   * 수정:
   * - ControlPanel.tsx:284/285/286 — 3 callsite 모두 (button, '', {}) 명시.
   * - ControlPanel.tsx:76 — extraClass '' / outer {} defaults 제거 (inner
   *   `hideLabel = false`는 보존).
   *
   * 회귀 가드:
   * - 3 internal callsite 동작 그대로.
   * - body className `${extraClass}` / `hideLabel ?` 처리 보존.
   * - inner destructure default 보존 (caller {} 시 hideLabel false 적용).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 626: renderActionButton signature outer defaults 0건", async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(!/const renderActionButton = \([^)]*extraClass:\s*any\s*=\s*''/.test(source),
          "renderActionButton extraClass default '' 제거");
      assert.ok(!/const renderActionButton = \([^)]*\}:\s*any\s*=\s*\{\}/.test(source),
          'renderActionButton 3rd 파라미터 outer default {} 제거');
  });

  test('cycle 626: renderActionButton signature 파라미터 보존 (default 없이)', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(/const renderActionButton = \(button: any, extraClass: any, \{ hideLabel = false \}: any\)/.test(source),
          'renderActionButton 3-arg 시그니처 보존 (outer defaults 없이, inner hideLabel = false 보존)');
  });

  test("cycle 626: 3 callsite 명시 추가 (button, '', {})", async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const matches = (source.match(/renderActionButton\(button,\s*'',\s*\{\}\)/g) || []).length;
      assert.equal(matches, 3, '3 callsite 모두 명시 (button, \'\', {})');
  });

  test('cycle 626: body extraClass / hideLabel 처리 보존', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(/\$\{extraClass\}/.test(source),
          'className `${extraClass}` 보존');
      assert.ok(/hideLabel \?/.test(source),
          'hideLabel ? 분기 보존');
  });

  test('cycle 626: cycle 502-625 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ai = await readSrc('src/services/aiService.ts');
      assert.ok(!/generateStory:\s*async\s*\([^)]*uid:\s*any\s*=\s*'anonymous'\)/.test(ai),
          "cycle 625 generateStory uid default 0건");
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/handleVictory\([^)]*passiveBonus:\s*any\s*=\s*\{\}/.test(ce),
          'cycle 624 handleVictory passiveBonus default 0건');
  });
}

// ─── cycle-627-combat-attack-detail-tags-explicit-elimination.test.js ───
{
  /**
   * cycle 627: COMBAT_ATTACK_DETAIL tags [] explicit default-elimination
   *   (cycle 222-626 silent dead config 시리즈 365번째 — explicit
   *   default-elimination pattern 18번째 적용, 변형 패턴 6번째).
   *
   * 발견 (default 이미 unreachable, signature 정리):
   * - src/data/messages.ts:10:
   *     COMBAT_ATTACK_DETAIL: (name: any, dmg: any, cur: any, max: any, tags: any = []) =>
   *         `${name}에게 ${dmg} 피해! (${cur}/${max})${tags.length ? ` [${tags.join(', ')}]` : ''}`
   * - 호출 사이트 모두 명시 인자 전달:
   *     · CombatEngine.ts:629 — MSG.COMBAT_ATTACK_DETAIL(enemy.name, finalDamage,
   *       Math.max(0, newEnemyHp), enemy.maxHp, tags). 5 args 모두 명시.
   * - default [] 이미 도달 불가.
   *
   * 패턴 (cycle 222-626 시리즈 365번째):
   * - cycle 502-626: default 청소 메가 시리즈 122사이클.
   * - cycle 627: explicit default-elimination 18번째 (변형 패턴 6번째 —
   *   caller 모두 이미 명시 상태).
   *
   * 수정:
   * - messages.ts:10 — tags default [] 제거.
   *
   * 회귀 가드:
   * - 1 production callsite 동작 그대로 (이미 명시).
   * - body `${tags.length ? ` [${tags.join(', ')}]` : ''}` 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 627: COMBAT_ATTACK_DETAIL signature에서 tags default [] 0건', async () => {
      const source = await readSrc('src/data/messages.ts');
      assert.ok(!/COMBAT_ATTACK_DETAIL:[^=]*tags:\s*any\s*=\s*\[\]/.test(source),
          'COMBAT_ATTACK_DETAIL tags default [] 제거');
      assert.ok(/COMBAT_ATTACK_DETAIL:[^=]+tags:\s*any\)\s*=>/.test(source),
          'COMBAT_ATTACK_DETAIL tags 파라미터 보존 (default 없이)');
  });

  test('cycle 627: CombatEngine callsite 5 args 명시 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/MSG\.COMBAT_ATTACK_DETAIL\(enemy\.name,\s*finalDamage,\s*Math\.max\(0,\s*newEnemyHp\),\s*enemy\.maxHp,\s*tags\)/.test(source),
          'CombatEngine COMBAT_ATTACK_DETAIL 5 args 명시 보존');
  });

  test('cycle 627: COMBAT_ATTACK_DETAIL body tags.length / join 처리 보존', async () => {
      const source = await readSrc('src/data/messages.ts');
      assert.ok(/tags\.length\s*\?\s*` \[\$\{tags\.join\(', '\)\}\]`\s*:\s*''/.test(source),
          'tags.length ? [...] join 처리 보존');
  });

  test('cycle 627: cycle 502-626 회귀 가드 — default 청소 시리즈 보존', async () => {
      const cp = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(!/const renderActionButton = \([^)]*extraClass:\s*any\s*=\s*''/.test(cp),
          "cycle 626 renderActionButton extraClass default 0건");
      const ai = await readSrc('src/services/aiService.ts');
      assert.ok(!/generateStory:\s*async\s*\([^)]*uid:\s*any\s*=\s*'anonymous'\)/.test(ai),
          "cycle 625 generateStory uid default 0건");
  });
}

// ─── cycle-628-commit-explore-outcome-explicit-elimination.test.js ───
{
  /**
   * cycle 628: commitExploreOutcome transformPlayer null explicit
   *   default-elimination
   *   (cycle 222-627 silent dead config 시리즈 366번째 — explicit
   *   default-elimination pattern 19번째 적용, 7-caller batch).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/hooks/gameActions/_shared.ts:38:
   *     const commitExploreOutcome = (outcome: any, transformPlayer: any = null) => {...}
   * - 호출 사이트 8개 (exploreActions.ts):
   *     · 7 1-arg callers — default null 활성:
   *       43/80/84/93/106/109/117.
   *     · 1 2-arg caller — 168: applyBattleStartRelics callback 명시.
   * - 7 callers에 명시 null 추가하여 default 도달 불가로 변환.
   *
   * 패턴 (cycle 222-627 시리즈 366번째):
   * - cycle 502-627: default 청소 메가 시리즈 123사이클.
   * - cycle 628: explicit default-elimination 19번째.
   *   7-caller conversion으로 가장 큰 단일 batch 변환 (cycle 608+ 기존 1-3
   *   caller 변환에 비해 7 callers 동시 처리).
   *
   * 수정:
   * - exploreActions.ts:43/80/84/93/106/109/117 — 7 callsite null 명시 추가.
   * - _shared.ts:38 — transformPlayer default null 제거.
   *
   * 회귀 가드:
   * - 8 internal callsite 동작 그대로.
   * - body `if (typeof transformPlayer === 'function') { ... }` 처리 보존
   *   (null이든 함수든 동일 처리).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 628: commitExploreOutcome signature에서 transformPlayer default null 0건', async () => {
      const source = await readSrc('src/hooks/gameActions/_shared.ts');
      assert.ok(!/commitExploreOutcome = \([^)]*transformPlayer:\s*any\s*=\s*null\)/.test(source),
          'commitExploreOutcome transformPlayer default null 제거');
      assert.ok(/commitExploreOutcome = \(outcome:\s*any,\s*transformPlayer:\s*any\)/.test(source),
          'commitExploreOutcome transformPlayer 파라미터 보존 (default 없이)');
  });

  test('cycle 628: 7 callsite null 명시 추가', async () => {
      const source = await readSrc('src/hooks/gameActions/exploreActions.ts');
      assert.ok(/commitExploreOutcome\('narrative_event',\s*null\)/.test(source),
          "narrative_event callsite null 명시 (line 43)");
      const nothingMatches = (source.match(/commitExploreOutcome\('nothing',\s*null\)/g) || []).length;
      assert.ok(nothingMatches >= 3, `'nothing' callsite null 명시 3건 이상 (got ${nothingMatches})`);
      assert.ok(/commitExploreOutcome\(quietResult,\s*null\)/.test(source),
          'quietResult callsite null 명시 (line 106)');
      assert.ok(/commitExploreOutcome\('relic_found',\s*null\)/.test(source),
          "'relic_found' callsite null 명시 (line 117)");
  });

  test('cycle 628: combat 2-arg callsite 보존 (line 168)', async () => {
      const source = await readSrc('src/hooks/gameActions/exploreActions.ts');
      assert.ok(/commitExploreOutcome\('combat',\s*\(nextPlayer:\s*any\)\s*=>/.test(source),
          "combat 2-arg callsite (applyBattleStartRelics callback) 보존");
  });

  test('cycle 628: body transformPlayer function 처리 보존', async () => {
      const source = await readSrc('src/hooks/gameActions/_shared.ts');
      assert.ok(/if \(typeof transformPlayer === 'function'\)/.test(source),
          "transformPlayer function 분기 보존");
  });

  test('cycle 628: cycle 502-627 회귀 가드 — default 청소 시리즈 보존', async () => {
      const m = await readSrc('src/data/messages.ts');
      assert.ok(!/COMBAT_ATTACK_DETAIL:[^=]*tags:\s*any\s*=\s*\[\]/.test(m),
          'cycle 627 COMBAT_ATTACK_DETAIL tags default 0건');
      const cp = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(!/const renderActionButton = \([^)]*extraClass:\s*any\s*=\s*''/.test(cp),
          "cycle 626 renderActionButton extraClass default 0건");
  });
}

// ─── cycle-632-trait-item-resonance-player-explicit-elimination.test.js ───
{
  /**
   * cycle 632: getTraitItemResonance player null explicit default-elimination
   *   (cycle 222-631 silent dead config 시리즈 369번째 — explicit
   *   default-elimination pattern 22번째 적용, 변형 패턴 7번째).
   *
   * 발견 (default 이미 unreachable, signature 정리):
   * - src/utils/runProfile.ts:261:
   *     export const getTraitItemResonance = (item, traitProfile, player: Player | null = null) => {...}
   * - 호출 사이트 모두 명시 인자 전달:
   *     · runProfile.ts:340 (getProfileItemResonance 내부) — getTraitItemResonance(item, traitProfile, player).
   *     · ShopPanel.tsx:148 — getTraitItemResonance(item, traitProfile, { job: currentJob }).
   *     · SmartInventory.tsx:262 — getTraitItemResonance(item, traitProfile, player).
   * - default null 이미 도달 불가.
   *
   * 패턴 (cycle 222-631 시리즈 369번째):
   * - cycle 502-631: default 청소 메가 시리즈 126사이클.
   * - cycle 632: explicit default-elimination 22번째 (변형 패턴 7번째).
   *
   * 수정:
   * - runProfile.ts:261 — player default null 제거.
   *
   * 회귀 가드:
   * - 3 internal callsite 동작 그대로 (이미 명시).
   * - body switch (traitId) score / label / summary 계산 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 632: getTraitItemResonance signature에서 player default null 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/getTraitItemResonance = \([^)]*player:\s*Player\s*\|\s*null\s*=\s*null\)/.test(source),
          'getTraitItemResonance player default null 제거');
      assert.ok(/getTraitItemResonance = \(item:[^)]+,\s*traitProfile:\s*any,\s*player:\s*Player\s*\|\s*null\)/.test(source),
          'getTraitItemResonance player 파라미터 보존 (default 없이)');
  });

  test('cycle 632: 3 callsite 명시 보존', async () => {
      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(/getTraitItemResonance\(item,\s*traitProfile,\s*player\)/.test(rp),
          'runProfile internal callsite 명시 보존');
      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(/getTraitItemResonance\(item,\s*traitProfile,\s*\{\s*job:\s*currentJob\s*\}\)/.test(sp),
          'ShopPanel callsite 명시 보존');
      const si = await readSrc('src/components/SmartInventory.tsx');
      assert.ok(/getTraitItemResonance\(item,\s*traitProfile,\s*player\)/.test(si),
          'SmartInventory callsite 명시 보존');
  });

  test('cycle 632: body switch 처리 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fn = source.slice(source.indexOf('export const getTraitItemResonance'));
      assert.ok(/switch \(traitId\)/.test(fn),
          'switch (traitId) 분기 보존');
      assert.ok(/score:/.test(fn),
          'score 계산 보존');
  });

  test('cycle 632: cycle 502-631 회귀 가드 — default 청소 시리즈 보존', async () => {
      const eu = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/getEquippedWeapons = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(eu),
          'cycle 631 getEquippedWeapons equip default 0건');
      assert.ok(!/getWeaponMagicSkills = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(eu),
          'cycle 631 getWeaponMagicSkills equip default 0건');
  });
}
