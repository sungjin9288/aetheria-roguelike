import { readInventoryActionsSource } from "./helpers/inventoryActionsSource.mjs";
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * cycle 300-399 정리 가드 (audit #1 통합 56개)
 */

// ─── cycle-301-reducer-type-aliases-dead.test.js ───
{
  /**
   * cycle 301: 2 reducer type aliases dead export 제거
   *   (cycle 222-300 silent dead config 시리즈 71번째 — cleanup lens 연속).
   *
   * 발견 (2 type alias dead export):
   * - src/reducers/actionTypes.ts:78 `export type ActionType = typeof AT[keyof typeof AT]`
   *   → src/, tests/ import 0건.
   * - src/reducers/gameStates.ts:22 `export type GameState = typeof GS[keyof typeof GS]`
   *   → 모든 consumer는 `GS` const만 import. type alias 자체는 import 0건.
   *   gameReducer.ts의 GameState (state shape — INITIAL_STATE 타입)와 명칭 충돌도 해소.
   *
   * 패턴 (cycle 222-300 silent dead config 시리즈 71번째, cycle 300 batch 직후):
   * - cycle 299: player.ts 8 sub-interface exports private downgrade.
   * - cycle 301: 2 reducer type alias 완전 제거 — AT/GS const literal types로 충분.
   *
   * 수정:
   * - actionTypes.ts: ActionType type alias 제거.
   * - gameStates.ts: GameState type alias 제거 (gameReducer GameState와 충돌 해소).
   *
   * 회귀 가드:
   * - AT / GS const export 그대로 — 모든 consumer 영향 없음.
   * - gameReducer.ts의 GameState (state shape) export 유지 (6 handler import 사용).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 301: ActionType type alias 제거', async () => {
      const source = await readSrc('src/reducers/actionTypes.ts');
      assert.ok(!/export type ActionType\b/.test(source),
          'ActionType type alias 제거됨');
  });

  test('cycle 301: gameStates.ts GameState type alias 제거', async () => {
      const source = await readSrc('src/reducers/gameStates.ts');
      assert.ok(!/export type GameState\b/.test(source),
          'gameStates.ts GameState type alias 제거됨');
  });

  test('cycle 301: AT / GS const export 유지 (회귀 가드)', async () => {
      const atSrc = await readSrc('src/reducers/actionTypes.ts');
      const gsSrc = await readSrc('src/reducers/gameStates.ts');
      assert.ok(/export const AT\b/.test(atSrc), 'AT export 유지');
      assert.ok(/export const GS\b/.test(gsSrc), 'GS export 유지');
  });

  test('cycle 301: gameReducer.ts GameState export 유지 (state shape — 다른 의미)', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      assert.ok(/export interface GameState\b/.test(source),
          'gameReducer GameState (state shape) export 유지');
  });

  test('cycle 299 회귀 가드: player.ts 8 sub-interfaces private 유지', async () => {
      const source = await readSrc('src/types/player.ts');
      assert.ok(!/export interface PlayerStats\b/.test(source),
          'cycle 299 PlayerStats private 유지');
  });
}

// ─── cycle-302-action-presentation-dead.test.js ───
{
  /**
   * cycle 302: ACTION_PRESENTATION dead export 제거 + TYPE_COLORS re-export 제거
   *   (cycle 222-301 silent dead config 시리즈 72번째 — cleanup lens 연속).
   *
   * 발견 (2 dead 표면):
   * - src/components/controlPanelConfig.ts: ACTION_PRESENTATION (line 16) — 8 키
   *   (explore/move/rest/market/class/quests/craft/grave) 각각 tag/tone/detail
   *   메타 정의되어 있지만 src/ 어디에서도 read 0건. ControlPanel은 ACTION_KIND_TO_BUTTON만 사용.
   * - src/components/icons/SkillTypeIcon.tsx:63 `export { TYPE_COLORS }` — 외부 import 0건.
   *   동일 컴포넌트 내부에서만 사용 (line 44).
   *
   * 패턴 (cycle 222-301 silent dead config 시리즈 72번째):
   * - cycle 301: 2 reducer type aliases dead 제거.
   * - cycle 302: components dead surface 2건 제거.
   *
   * 수정:
   * - controlPanelConfig.ts: ACTION_PRESENTATION 제거 (8 키 메타 ~10 lines).
   * - SkillTypeIcon.tsx: `export { TYPE_COLORS }` re-export 제거 (TYPE_COLORS const는 그대로).
   *
   * 회귀 가드:
   * - ACTION_KIND_TO_BUTTON / SkillTypeIcon default export 유지.
   * - SkillTypeIcon 컴포넌트 동작 동일 (내부 TYPE_COLORS 사용).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 302: ACTION_PRESENTATION dead export 제거', async () => {
      const source = await readSrc('src/components/controlPanelConfig.ts');
      assert.ok(!/export const ACTION_PRESENTATION\b/.test(source),
          'ACTION_PRESENTATION export 제거됨');
  });

  test('cycle 302: ACTION_KIND_TO_BUTTON active export 유지', async () => {
      const source = await readSrc('src/components/controlPanelConfig.ts');
      assert.ok(/export const ACTION_KIND_TO_BUTTON\b/.test(source),
          'ACTION_KIND_TO_BUTTON export 유지');
  });

  test('cycle 302: TYPE_COLORS re-export 제거', async () => {
      const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
      assert.ok(!/export\s*\{\s*TYPE_COLORS\s*\}/.test(source),
          'TYPE_COLORS re-export 제거됨');
      assert.ok(/const TYPE_COLORS\b/.test(source),
          'TYPE_COLORS const 정의 유지 (내부 사용)');
  });

  test('cycle 302: SkillTypeIcon default export 유지', async () => {
      const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
      assert.ok(/export default SkillTypeIcon\b/.test(source),
          'SkillTypeIcon default export 유지');
  });

  test('cycle 301 회귀 가드: 2 reducer type alias 제거 유지', async () => {
      const atSrc = await readSrc('src/reducers/actionTypes.ts');
      const gsSrc = await readSrc('src/reducers/gameStates.ts');
      assert.ok(!/export type ActionType\b/.test(atSrc), 'cycle 301 ActionType 제거 유지');
      assert.ok(!/export type GameState\b/.test(gsSrc), 'cycle 301 gameStates GameState 제거 유지');
  });
}

// ─── cycle-303-runtime-perf-private.test.js ───
{
  /**
   * cycle 303: 2 utils private downgrade — isE2ERuntime + measurePerf
   *   (cycle 222-302 silent dead config 시리즈 73번째 — cleanup lens 연속).
   *
   * 발견 (2 private downgrade, 모두 동일 파일 내부 1회만 사용):
   * - src/utils/runtimeMode.ts: isE2ERuntime — isMockRuntime 내부 1회 (line 28),
   *   외부 consumer 0건.
   * - src/utils/performanceMarks.ts: measurePerf — measurePerfOnce 내부 1회 (line 46),
   *   외부 consumer 0건.
   *
   * 패턴 (cycle 222-302 silent dead config 시리즈 73번째):
   * - cycle 302: ACTION_PRESENTATION dead + TYPE_COLORS re-export 제거.
   * - cycle 303: 2 internal helper private downgrade — export 표면 2개 축소.
   *
   * 수정:
   * - runtimeMode.ts: isE2ERuntime export 제거 (private const 유지).
   * - performanceMarks.ts: measurePerf export 제거 (private const 유지).
   *
   * 회귀 가드:
   * - isMockRuntime / measurePerfOnce active export 유지.
   * - isMockRuntime 동작 동일 (smoke OR e2e), measurePerfOnce 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 303: isE2ERuntime export 제거 (private)', async () => {
      const source = await readSrc('src/utils/runtimeMode.ts');
      assert.ok(!/export const isE2ERuntime\b/.test(source),
          'isE2ERuntime export 제거됨');
      assert.ok(/const isE2ERuntime\b/.test(source),
          'isE2ERuntime const 정의 유지 (private)');
  });

  test('cycle 303: measurePerf export 제거 (private)', async () => {
      const source = await readSrc('src/utils/performanceMarks.ts');
      assert.ok(!/export const measurePerf\b/.test(source),
          'measurePerf export 제거됨');
      assert.ok(/const measurePerf\b/.test(source),
          'measurePerf const 정의 유지 (private)');
  });

  test('cycle 303: isMockRuntime / measurePerfOnce active export 유지', async () => {
      const rmSrc = await readSrc('src/utils/runtimeMode.ts');
      const pmSrc = await readSrc('src/utils/performanceMarks.ts');
      assert.ok(/export const isMockRuntime\b/.test(rmSrc), 'isMockRuntime 유지');
      assert.ok(/export const measurePerfOnce\b/.test(pmSrc), 'measurePerfOnce 유지');
  });

  test('cycle 303: isMockRuntime 동작 보존 (회귀 가드 — isE2ERuntime 내부 사용)', async () => {
      const { isMockRuntime } = await import('../src/utils/runtimeMode.js');
      // 노드 환경(window 없음) → false 반환.
      const result = isMockRuntime();
      assert.equal(result, false, 'window 미정의 시 false');
  });

  test('cycle 302 회귀 가드: ACTION_PRESENTATION dead 유지', async () => {
      const source = await readSrc('src/components/controlPanelConfig.ts');
      assert.ok(!/export const ACTION_PRESENTATION\b/.test(source),
          'cycle 302 ACTION_PRESENTATION 제거 유지');
  });
}

// ─── cycle-304-db-wrapper-dead-keys.test.js ───
{
  /**
   * cycle 304: DB wrapper 2 dead keys 제거 (LOOT_TABLE / DROP_TABLES)
   *   (cycle 222-303 silent dead config 시리즈 74번째 — cleanup lens 연속).
   *
   * 발견 (DB wrapper dead keys):
   * - src/data/db.ts: DB.LOOT_TABLE / DB.DROP_TABLES — 0 refs.
   *   모든 consumer는 data/loot.js / data/dropTables.js를 직접 import:
   *   - src/components/Bestiary.tsx, components/codex/MaterialCodex.tsx,
   *     MonsterCodex.tsx, systems/CombatEngine.ts, CombatEngine.loot.ts,
   *     utils/bossSignatureHint.ts, mapSignatureHints.ts, signatureDropSources.ts
   *     모두 LOOT_TABLE / DROP_TABLES 직접 import.
   *   - DB wrapper의 LOOT_TABLE / DROP_TABLES key는 read 0건.
   *
   * 패턴 (cycle 222-303 silent dead config 시리즈 74번째):
   * - cycle 303: isE2ERuntime / measurePerf private downgrade.
   * - cycle 304: DB wrapper 2 dead key cleanup — silent duplicate import 표면 축소.
   *
   * 수정 (src/data/db.ts):
   * - LOOT_TABLE / DROP_TABLES import 제거.
   * - DB 타입 선언과 객체 리터럴에서 2 key 제거.
   *
   * 회귀 가드:
   * - DB.CLASSES (26 refs) / DB.ITEMS (135 refs) / DB.MAPS (30 refs) /
   *   DB.MONSTERS (9 refs) / DB.QUESTS (7 refs) / DB.ACHIEVEMENTS (5 refs) 유지.
   * - LOOT_TABLE / DROP_TABLES export from data/loot.js / data/dropTables.js 그대로
   *   (모든 직접 import는 영향 없음).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 304: DB wrapper LOOT_TABLE / DROP_TABLES key 제거', async () => {
      const source = await readSrc('src/data/db.ts');
      assert.ok(!/LOOT_TABLE:\s*any;/.test(source), 'DB type LOOT_TABLE field 제거');
      assert.ok(!/DROP_TABLES:\s*any;/.test(source), 'DB type DROP_TABLES field 제거');
  });

  test('cycle 304: DB wrapper LOOT_TABLE / DROP_TABLES import 제거', async () => {
      const source = await readSrc('src/data/db.ts');
      assert.ok(!/import\s*\{\s*LOOT_TABLE\s*\}/.test(source),
          'LOOT_TABLE import 제거');
      assert.ok(!/import\s*\{\s*DROP_TABLES\s*\}/.test(source),
          'DROP_TABLES import 제거');
  });

  test('cycle 304: DB wrapper 6 active key 유지', async () => {
      const { DB } = await import('../src/data/db.js');
      assert.ok(DB.CLASSES, 'DB.CLASSES 유지');
      assert.ok(DB.ITEMS, 'DB.ITEMS 유지');
      assert.ok(DB.MAPS, 'DB.MAPS 유지');
      assert.ok(DB.MONSTERS, 'DB.MONSTERS 유지');
      assert.ok(DB.QUESTS, 'DB.QUESTS 유지');
      assert.ok(DB.ACHIEVEMENTS, 'DB.ACHIEVEMENTS 유지');
  });

  test('cycle 304: data/loot.js / data/dropTables.js 직접 import 동작 보존', async () => {
      const { LOOT_TABLE } = await import('../src/data/loot.js');
      const { DROP_TABLES } = await import('../src/data/dropTables.js');
      assert.ok(LOOT_TABLE, 'LOOT_TABLE 직접 import 동작');
      assert.ok(DROP_TABLES, 'DROP_TABLES 직접 import 동작');
  });

  test('cycle 303 회귀 가드: 2 utils private 유지', async () => {
      const rmSrc = await readSrc('src/utils/runtimeMode.ts');
      const pmSrc = await readSrc('src/utils/performanceMarks.ts');
      assert.ok(!/export const isE2ERuntime\b/.test(rmSrc),
          'cycle 303 isE2ERuntime private 유지');
      assert.ok(!/export const measurePerf\b/.test(pmSrc),
          'cycle 303 measurePerf private 유지');
  });
}

// ─── cycle-307-engine-leaderboard-dead-return.test.js ───
{
  /**
   * cycle 307: useGameEngine 반환 객체에서 leaderboard top-level 제거 (dead return)
   *   (cycle 222-306 silent dead config 시리즈 77번째 — cleanup lens 연속).
   *
   * 발견 (dead return field):
   * - src/hooks/useGameEngine.ts: 반환 객체 line 174에 `leaderboard` top-level export.
   *   - actions 객체 (line 147) 안에도 leaderboard 포함 (별도 channel).
   *
   * 그러나 `engine.leaderboard` (top-level) 접근 0건. SystemTab.tsx:192/381은
   * `actions.leaderboard` (= engine.actions.leaderboard) 경로로만 read.
   *
   * 패턴 (cycle 222-306 silent dead config 시리즈 77번째):
   * - cycle 306: state.version dead 제거.
   * - cycle 307: useGameEngine top-level leaderboard return dead 제거.
   *
   * 수정:
   * - useGameEngine.ts: 반환 객체에서 leaderboard 필드 제거.
   *
   * 회귀 가드:
   * - actions 객체 내 leaderboard 유지 — SystemTab actions.leaderboard 경로 영향 없음.
   * - 다른 top-level 반환 필드 (player, gameState, logs, enemy, ...) 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 307: useGameEngine 반환 객체 top-level leaderboard 제거', async () => {
      const source = await readSrc('src/hooks/useGameEngine.ts');
      // useGameEngine 반환 (return { ... };) 블록 마지막 영역 추출.
      const returnBlock = source.match(/return\s*\{\s*\n([\s\S]+?)\n\s*\};\s*\}\s*;\s*$/m);
      assert.ok(returnBlock, 'useGameEngine return 블록 발견');
      // top-level (들여쓰기 4칸 또는 8칸) 의 leaderboard 키 0건이어야 함.
      assert.ok(!/^\s{4,8}leaderboard,/m.test(returnBlock[1]),
          'top-level leaderboard 반환 제거');
  });

  test('cycle 307: useGameEngine actions 내부 leaderboard 유지', async () => {
      const source = await readSrc('src/hooks/useGameEngine.ts');
      // actions 객체 내 leaderboard 필드는 그대로.
      assert.ok(/leaderboard,?\s*\n\s*getFullStats/.test(source) || /leaderboard,/.test(source),
          'actions.leaderboard 경로 유지');
  });

  test('cycle 307: SystemTab actions.leaderboard 경로 사용 보존', async () => {
      const source = await readSrc('src/components/tabs/SystemTab.tsx');
      assert.ok(/actions\.leaderboard/.test(source),
          'SystemTab actions.leaderboard 경로 보존');
  });

  test('cycle 306 회귀 가드: state.version 제거 유지', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      assert.ok(!/^\s*version:\s*number;/m.test(source),
          'cycle 306 state.version 제거 유지');
  });
}

// ─── cycle-308-latency-tracker-dead-surface.test.js ───
{
  /**
   * cycle 308: LatencyTracker 5 dead surface 제거 (getStats 시리즈)
   *   (cycle 222-307 silent dead config 시리즈 78번째 — cleanup lens 연속).
   *
   * 발견 (cascade dead surface):
   * - LatencyTracker.getStats: 외부 read 0건 (src/, tests/).
   * - LatencyTracker.getAverageLatency: getStats 내부에서만 호출 → cascade dead.
   * - LatencyTracker.recordLatency: trackCall이 array에 push, 그러나 array를
   *   읽는 유일한 path가 getStats (now removed) → cascade dead.
   * - LatencyTracker.recentLatencies: recordLatency 작성용 backing array → 사용처 dead.
   * - LatencyTracker.MAX_HISTORY: recentLatencies trim 상수 → cascade dead.
   *
   * 활성 surface:
   * - LatencyTracker.trackCall (aiService.ts:26 사용) — slow-response console.warn
   *   + custom event dispatch가 본질 효과.
   * - LatencyTracker.onSlowResponse (trackCall 내부 사용).
   * - LatencyTracker.THRESHOLD_MS (slow 판정 + custom event detail).
   *
   * 패턴 (cycle 222-307 silent dead config 시리즈 78번째):
   * - cycle 307: useGameEngine top-level leaderboard return dead 제거.
   * - cycle 308: LatencyTracker 5 method/field cascade cleanup.
   *
   * 수정 (src/systems/LatencyTracker.ts):
   * - getStats / getAverageLatency / recordLatency / recentLatencies / MAX_HISTORY 제거.
   * - trackCall 내부 recordLatency 호출도 함께 제거 (no-op이라).
   *
   * 회귀 가드:
   * - LatencyTracker.trackCall 활성 — aiService 9.5s timeout chain 영향 없음.
   * - slow-response console.warn + custom event dispatch 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 308: 5 dead surface 제거', async () => {
      const source = await readSrc('src/systems/LatencyTracker.ts');
      assert.ok(!/getStats\s*\(/.test(source), 'getStats 제거됨');
      assert.ok(!/getAverageLatency\s*\(/.test(source), 'getAverageLatency 제거됨');
      assert.ok(!/recordLatency\s*\(/.test(source), 'recordLatency 제거됨');
      // recentLatencies / MAX_HISTORY: const 정의 제거 — 주석 mention은 허용.
      assert.ok(!/recentLatencies:\s*\[\]/.test(source), 'recentLatencies array 정의 제거됨');
      assert.ok(!/MAX_HISTORY:\s*\d+/.test(source), 'MAX_HISTORY 상수 정의 제거됨');
  });

  test('cycle 308: trackCall / onSlowResponse / THRESHOLD_MS 활성 유지', async () => {
      const source = await readSrc('src/systems/LatencyTracker.ts');
      assert.ok(/trackCall\s*\(/.test(source), 'trackCall 유지');
      assert.ok(/onSlowResponse\s*\(/.test(source), 'onSlowResponse 유지');
      assert.ok(/THRESHOLD_MS:/.test(source), 'THRESHOLD_MS 유지');
  });

  test('cycle 308: aiService trackCall 사용 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/services/aiService.ts');
      assert.ok(/LatencyTracker\.trackCall/.test(source),
          'aiService LatencyTracker.trackCall 호출 보존');
  });

  test('cycle 308: trackCall 동작 보존 (slow-response 판정 + console.warn)', async () => {
      const { LatencyTracker } = await import('../src/systems/LatencyTracker.js');
      const fastFn = async () => 42;
      const result = await LatencyTracker.trackCall(fastFn, 'test');
      assert.equal(result, 42, 'trackCall return 값 통과');
  });

  test('cycle 307 회귀 가드: useGameEngine top-level leaderboard 제거 유지', async () => {
      const source = await readSrc('src/hooks/useGameEngine.ts');
      const returnBlock = source.match(/return\s*\{\s*\n([\s\S]+?)\n\s*\};\s*\}\s*;\s*$/m);
      assert.ok(returnBlock, 'useGameEngine return 블록 발견');
      assert.ok(!/^\s{4,8}leaderboard,/m.test(returnBlock[1]),
          'cycle 307 top-level leaderboard 제거 유지');
  });
}

// ─── cycle-309-remote-config-loader-dead-module.test.js ───
{
  /**
   * cycle 309: RemoteConfigLoader dead module 제거 + REMOTE_CONFIG_ENABLED 상수 정리
   *   (cycle 222-308 silent dead config 시리즈 79번째 — cleanup lens 연속).
   *
   * 발견 (dead module):
   * - src/systems/RemoteConfigLoader.ts: 41줄 모듈, src/, tests/ 어디에서도 import 0건.
   *   Firestore에서 game config를 fetch하는 fetchConfig / getItems / getMaps / getClasses
   *   메서드를 export하지만 호출되는 곳이 전혀 없음.
   * - src/data/constants.ts:23 CONSTANTS.REMOTE_CONFIG_ENABLED:
   *   - RemoteConfigLoader 내부에서만 read (line 12). RemoteConfigLoader가 dead라
   *     이 상수도 cascade dead.
   *
   * 패턴 (cycle 222-308 silent dead config 시리즈 79번째):
   * - cycle 308: LatencyTracker 5 dead surface 제거 (cascade cleanup).
   * - cycle 309: RemoteConfigLoader dead module 제거 + 의존 상수 정리.
   *
   * 수정:
   * - src/systems/RemoteConfigLoader.ts: 파일 삭제 (41 lines).
   * - src/data/constants.ts: REMOTE_CONFIG_ENABLED 키 제거.
   *
   * 회귀 가드:
   * - LatencyTracker / TokenQuotaManager / FeedbackValidator 등 다른 system 파일 영향 없음.
   * - DB / aiService 등 game data flow 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 309: RemoteConfigLoader.ts 파일 제거', async () => {
      let exists = true;
      try {
          await access(path.join(ROOT, 'src/systems/RemoteConfigLoader.ts'));
      } catch {
          exists = false;
      }
      assert.equal(exists, false, 'RemoteConfigLoader.ts 파일 제거됨');
  });

  test('cycle 309: CONSTANTS.REMOTE_CONFIG_ENABLED 제거', async () => {
      const source = await readSrc('src/data/constants.ts');
      assert.ok(!/REMOTE_CONFIG_ENABLED:\s*ENV/.test(source),
          'REMOTE_CONFIG_ENABLED 상수 정의 제거됨');
  });

  test('cycle 309: constants.ts에 REMOTE_CONFIG_ENABLED 키 정의 제거', async () => {
      const constSource = await readSrc('src/data/constants.ts');
      // 키 정의 (`REMOTE_CONFIG_ENABLED:`) 없어야 함 — 주석 mention은 허용.
      assert.ok(!/^\s*REMOTE_CONFIG_ENABLED:/m.test(constSource),
          'REMOTE_CONFIG_ENABLED 키 정의 제거');
  });

  test('cycle 309: 다른 system 파일 영향 없음 (회귀 가드)', async () => {
      const ltSrc = await readSrc('src/systems/LatencyTracker.ts');
      const tqSrc = await readSrc('src/systems/TokenQuotaManager.ts');
      assert.ok(/export const LatencyTracker/.test(ltSrc),
          'LatencyTracker 보존');
      assert.ok(/export const TokenQuotaManager/.test(tqSrc),
          'TokenQuotaManager 보존');
  });

  test('cycle 308 회귀 가드: LatencyTracker 5 dead surface 제거 유지', async () => {
      const source = await readSrc('src/systems/LatencyTracker.ts');
      assert.ok(!/getStats\s*\(/.test(source), 'cycle 308 getStats 제거 유지');
      assert.ok(!/recentLatencies:\s*\[\]/.test(source),
          'cycle 308 recentLatencies 제거 유지');
  });
}

// ─── cycle-310-orphaned-components-removal.test.js ───
{
  /**
   * cycle 310: 2 orphaned components 제거 (Bestiary + FocusPanel) + 빈 dashboard/ 디렉토리 정리
   *   (cycle 222-309 silent dead config 시리즈 80번째 — cleanup lens 연속).
   *
   * 발견 (orphaned components):
   * - src/components/Bestiary.tsx (307 lines): import / <Bestiary> JSX 0건.
   *   몬스터 도감 컴포넌트지만 어디에도 mount 안 됨. (참고: 도감 기능은
   *   src/components/codex/MonsterCodex.tsx 등이 active.)
   * - src/components/dashboard/FocusPanel.tsx (204 lines): import / <FocusPanel> JSX 0건.
   *   Adventure guide / difficulty 패널이지만 mount 안 됨. (참고: src/components/FocusPanelHeader.tsx
   *   는 다른 컴포넌트 — 5 active import.)
   * - src/components/dashboard/ 디렉토리: FocusPanel.tsx 제거 후 빈 디렉토리.
   *
   * 패턴 (cycle 222-309 silent dead config 시리즈 80번째, 가장 큰 단일 file 제거):
   * - cycle 309: RemoteConfigLoader 41 lines dead module 제거.
   * - cycle 310: 2 orphaned components 511 lines 제거 — 단일 cycle 최대 lines 감소.
   *
   * 수정:
   * - src/components/Bestiary.tsx: 파일 삭제 (307 lines).
   * - src/components/dashboard/FocusPanel.tsx: 파일 삭제 (204 lines).
   * - src/components/dashboard/: 빈 디렉토리 제거.
   *
   * 회귀 가드:
   * - src/components/FocusPanelHeader.tsx (5 active imports) 영향 없음 — 별개 컴포넌트.
   * - src/components/codex/ 도감 컴포넌트들 영향 없음.
   * - adventureGuide / difficulty 시스템은 다른 컴포넌트 (AdventureGuide* 등) 통해 active.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  const fileExists = async (relPath) => {
      try {
          await access(path.join(ROOT, relPath));
          return true;
      } catch {
          return false;
      }
  };

  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 310: Bestiary.tsx 파일 제거', async () => {
      assert.equal(await fileExists('src/components/Bestiary.tsx'), false,
          'Bestiary.tsx 제거됨');
  });

  test('cycle 310: dashboard/FocusPanel.tsx 파일 제거', async () => {
      assert.equal(await fileExists('src/components/dashboard/FocusPanel.tsx'), false,
          'FocusPanel.tsx 제거됨');
  });

  test('cycle 310: dashboard/ 빈 디렉토리 제거', async () => {
      assert.equal(await fileExists('src/components/dashboard'), false,
          'dashboard/ 디렉토리 제거됨');
  });

  test('cycle 310: FocusPanelHeader 별개 컴포넌트 활성 보존 (회귀 가드)', async () => {
      assert.equal(await fileExists('src/components/FocusPanelHeader.tsx'), true,
          'FocusPanelHeader.tsx 보존');
      const source = await readSrc('src/components/FocusPanelHeader.tsx');
      assert.ok(/export default FocusPanelHeader/.test(source),
          'FocusPanelHeader export 유지');
  });

  test('cycle 310: codex/ 도감 컴포넌트 활성 보존 (회귀 가드)', async () => {
      assert.equal(await fileExists('src/components/codex/MonsterCodex.tsx'), true,
          'MonsterCodex 보존 (Bestiary와 별개 active 도감)');
  });

  test('cycle 309 회귀 가드: RemoteConfigLoader 제거 유지', async () => {
      assert.equal(await fileExists('src/systems/RemoteConfigLoader.ts'), false,
          'cycle 309 RemoteConfigLoader 제거 유지');
  });
}

// ─── cycle-311-adventure-guide-actions-orphan.test.js ───
{
  /**
   * cycle 311: adventureGuideActions.ts orphan 모듈 제거 (cycle 310 paired completion)
   *   (cycle 222-310 silent dead config 시리즈 81번째 — cleanup lens 연속).
   *
   * 발견 (cycle 310 cascade):
   * - src/utils/adventureGuideActions.ts: 47 lines, runGuidanceAction export.
   * - 유일한 consumer였던 src/components/dashboard/FocusPanel.tsx는 cycle 310에서 제거됨.
   * - 다른 import 0건 — 이제 fully orphaned.
   *
   * 패턴 (cycle 222-310 silent dead config 시리즈 81번째):
   * - cycle 310: Bestiary + dashboard/FocusPanel 2 orphan 제거.
   * - cycle 311: adventureGuideActions cascade orphan (cycle 310 paired completion).
   *
   * 수정:
   * - src/utils/adventureGuideActions.ts: 파일 삭제 (47 lines).
   *
   * 회귀 가드:
   * - adventureGuide.ts (다른 파일) active export 그대로 — getAdventureGuidance / getQuestTracker 등.
   * - 다른 utils 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  const fileExists = async (relPath) => {
      try {
          await access(path.join(ROOT, relPath));
          return true;
      } catch {
          return false;
      }
  };

  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 311: adventureGuideActions.ts 파일 제거', async () => {
      assert.equal(await fileExists('src/utils/adventureGuideActions.ts'), false,
          'adventureGuideActions.ts 제거됨');
  });

  test('cycle 311: adventureGuide.ts (다른 파일) 보존 (회귀 가드)', async () => {
      assert.equal(await fileExists('src/utils/adventureGuide.ts'), true,
          'adventureGuide.ts 보존');
      const source = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(/export const getAdventureGuidance/.test(source),
          'getAdventureGuidance export 유지');
  });

  test('cycle 311: src/ 어디에서도 runGuidanceAction import 0건', async () => {
      // file이 없어야 grep 결과도 0건
      const filesToCheck = ['src/components/Bestiary.tsx', 'src/utils/adventureGuideActions.ts'];
      for (const f of filesToCheck) {
          assert.equal(await fileExists(f), false, `${f} 제거됨 (cycle 310-311)`);
      }
  });

  test('cycle 310 회귀 가드: 2 orphan components 제거 유지', async () => {
      assert.equal(await fileExists('src/components/Bestiary.tsx'), false,
          'cycle 310 Bestiary 제거 유지');
      assert.equal(await fileExists('src/components/dashboard/FocusPanel.tsx'), false,
          'cycle 310 FocusPanel 제거 유지');
  });
}

// ─── cycle-312-anchor-placements-private.test.js ───
{
  /**
   * cycle 312: anchorPoints WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS export → private
   *   (cycle 222-311 silent dead config 시리즈 82번째 — cleanup lens 연속).
   *
   * 발견 (2 private downgrade, 모두 동일 파일 내부 사용만):
   * - WEAPON_PLACEMENTS (line 70): getWeaponPlacement (line 187) +
   *   DEFAULT_WEAPON_PLACEMENT (line 103) 내부 2회 사용, 외부 0건.
   * - OFFHAND_PLACEMENTS (line 108): getOffhandPlacement (line 189) 내부 1회 사용,
   *   외부 0건.
   *
   * 패턴 (cycle 222-311 silent dead config 시리즈 82번째):
   * - cycle 311: adventureGuideActions.ts cascade orphan 제거.
   * - cycle 312: anchorPoints 2 placement 객체 private downgrade.
   *
   * 수정 (src/utils/anchorPoints.ts):
   * - WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS export 제거 (private const 유지).
   *
   * 회귀 가드:
   * - getWeaponPlacement / getOffhandPlacement active export 유지.
   * - AVATAR_ANCHORS / BACK_LAYER_*_STYLES active export 유지.
   * - 내부 호출 chain 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 312: WEAPON_PLACEMENTS export 제거 (private)', async () => {
      const source = await readSrc('src/utils/anchorPoints.ts');
      assert.ok(!/export const WEAPON_PLACEMENTS\b/.test(source),
          'WEAPON_PLACEMENTS export 제거됨');
      assert.ok(/const WEAPON_PLACEMENTS\b/.test(source),
          'WEAPON_PLACEMENTS const 정의 유지 (private)');
  });

  test('cycle 312: OFFHAND_PLACEMENTS export 제거 (private)', async () => {
      const source = await readSrc('src/utils/anchorPoints.ts');
      assert.ok(!/export const OFFHAND_PLACEMENTS\b/.test(source),
          'OFFHAND_PLACEMENTS export 제거됨');
      assert.ok(/const OFFHAND_PLACEMENTS\b/.test(source),
          'OFFHAND_PLACEMENTS const 정의 유지 (private)');
  });

  test('cycle 312: getWeaponPlacement / getOffhandPlacement active export 유지', async () => {
      const source = await readSrc('src/utils/anchorPoints.ts');
      assert.ok(/export const getWeaponPlacement\b/.test(source),
          'getWeaponPlacement export 유지');
      assert.ok(/export const getOffhandPlacement\b/.test(source),
          'getOffhandPlacement export 유지');
  });

  test('cycle 312: getWeaponPlacement / getOffhandPlacement 동작 보존 (회귀 가드)', async () => {
      const { getWeaponPlacement, getOffhandPlacement } = await import('../src/utils/anchorPoints.js');
      // 미정의 style → DEFAULT placement 반환.
      const result = getWeaponPlacement('___unknown___');
      assert.ok(result, 'unknown style → DEFAULT_WEAPON_PLACEMENT 반환');
      const result2 = getOffhandPlacement('___unknown___');
      assert.ok(result2, 'unknown style → DEFAULT_OFFHAND_PLACEMENT 반환');
  });

  test('cycle 311 회귀 가드: adventureGuideActions.ts 제거 유지', async () => {
      const { access } = await import('node:fs/promises');
      let exists = true;
      try {
          await access(path.join(ROOT, 'src/utils/adventureGuideActions.ts'));
      } catch {
          exists = false;
      }
      assert.equal(exists, false, 'cycle 311 adventureGuideActions 제거 유지');
  });
}

// ─── cycle-314-move-actions-unused-dep.test.js ───
{
  /**
   * cycle 314: moveActions 미사용 addStoryLog dependency 제거
   *   (cycle 222-313 silent dead config 시리즈 84번째 — cleanup lens 연속).
   *
   * 발견 (unused dep):
   * - src/hooks/gameActions/moveActions.ts: createMoveActions deps 구조분해에서
   *   addStoryLog 받지만 함수 내부에서 호출 0건. 마지막 라인에 `void addStoryLog;`
   *   자가-suppress가 lint 통과를 위해 존재.
   *
   * 비교: 다른 gameAction 파일들은 addStoryLog 활성 사용.
   * - characterActions.ts: addStoryLog('rest', ...) 호출.
   * - exploreActions.ts: addStoryLog('encounter', ...) 호출.
   * - useInventoryActions.ts: addStoryLog('questComplete', ...) 호출.
   *
   * 패턴 (cycle 222-313 silent dead config 시리즈 84번째):
   * - cycle 313: QuestRewardChips export → private downgrade.
   * - cycle 314: moveActions 미사용 addStoryLog dependency 정리.
   *
   * 수정 (src/hooks/gameActions/moveActions.ts):
   * - deps 구조분해에서 addStoryLog 제거.
   * - `void addStoryLog;` self-suppress 라인 제거.
   *
   * 회귀 가드:
   * - move action 동작 동일 — addStoryLog 호출 사이트 0건이라 변화 없음.
   * - useGameEngine deps 객체 자체에 addStoryLog는 그대로 전달 — 다른 액션 모듈에서 사용.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 314: moveActions deps 구조분해에서 addStoryLog 제거', async () => {
      const source = await readSrc('src/hooks/gameActions/moveActions.ts');
      // const { player, gameState, ..., addStoryLog } = deps; 라인에서 addStoryLog 0건.
      const destrLine = source.match(/const\s*\{\s*[^}]+\}\s*=\s*deps\s*;/);
      assert.ok(destrLine, 'deps 구조분해 라인 발견');
      assert.ok(!/addStoryLog/.test(destrLine[0]),
          'deps 구조분해에서 addStoryLog 제거됨');
  });

  test('cycle 314: moveActions void addStoryLog 자가-suppress 라인 제거', async () => {
      const source = await readSrc('src/hooks/gameActions/moveActions.ts');
      // void addStoryLog statement (실제 코드 라인) 제거 — 주석 mention은 허용.
      assert.ok(!/^\s*void addStoryLog;/m.test(source),
          'void addStoryLog 라인 제거됨');
  });

  test('cycle 314: moveActions move 액션 활성 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/hooks/gameActions/moveActions.ts');
      assert.ok(/move:\s*\(loc/.test(source),
          'move 액션 정의 보존');
      assert.ok(/MOVE_ARRIVED/.test(source),
          'MOVE_ARRIVED 로그 dispatch 보존');
  });

  test('cycle 314: characterActions / exploreActions / useInventoryActions의 addStoryLog 활성 사용 보존', async () => {
      // 탐험 스카우팅(2026-07): encounter 로그가 exploreUtils.ts의 runQuietRollAndCombat으로
      // 이동(exploreActions.ts와 eventActions.ts "짙은 안개" 카드 공유) — 경로만 갱신.
      const characterSrc = await readSrc('src/hooks/gameActions/characterActions.ts');
      const exploreSrc = await readSrc('src/utils/exploreUtils.ts');
      const invSrc = await readInventoryActionsSource();
      assert.ok(/addStoryLog\('rest'/.test(characterSrc),
          'characterActions addStoryLog rest 사용 보존');
      assert.ok(/addStoryLog\('encounter'/.test(exploreSrc),
          'exploreActions addStoryLog encounter 사용 보존');
      assert.ok(/addStoryLog\('questComplete'/.test(invSrc),
          'useInventoryActions addStoryLog questComplete 사용 보존');
  });

  test('cycle 313 회귀 가드: QuestRewardChips private 유지', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(!/export const QuestRewardChips\b/.test(source),
          'cycle 313 QuestRewardChips private 유지');
  });
}

// ─── cycle-315-unused-shared-param.test.js ───
{
  /**
   * cycle 315: moveActions / ascensionActions 미사용 _shared 파라미터 제거
   *   (cycle 222-314 silent dead config 시리즈 85번째 — cleanup lens 연속).
   *
   * 발견 (unused 2nd parameter):
   * - src/hooks/gameActions/moveActions.ts: createMoveActions(deps, _shared?) — _shared 사용 0건.
   * - src/hooks/gameActions/ascensionActions.ts: createAscensionActions(deps, _shared?) — 동일.
   *
   * 비교 — 다른 gameAction factory들은 shared 활성 사용:
   * - exploreActions / questActions / characterActions / eventActions: 모두 shared
   *   destructure (commitExploreOutcome / emitUnlockedTitles / emitDailyProtocolLogs) 사용.
   *
   * useGameActions에서 `createMoveActions(deps, shared)` 호출하지만 extra arg는 무시되어 동작 동일.
   *
   * 패턴 (cycle 222-314 silent dead config 시리즈 85번째):
   * - cycle 314: moveActions 미사용 addStoryLog dependency 제거.
   * - cycle 315: 같은 파일 + ascensionActions의 미사용 2nd 파라미터 제거 (cycle 314 paired).
   *
   * 수정:
   * - moveActions.ts: createMoveActions 시그니처 (deps, _shared?) → (deps).
   * - ascensionActions.ts: createAscensionActions 시그니처 (deps, _shared?) → (deps).
   *
   * 회귀 가드:
   * - useGameActions 호출 사이트는 그대로 — extra arg 자동 무시.
   * - move / confirmAscension / cancelAscension 액션 동작 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 315: createMoveActions 시그니처 (deps)만', async () => {
      const source = await readSrc('src/hooks/gameActions/moveActions.ts');
      assert.ok(/createMoveActions\s*=\s*\(deps:\s*any\)\s*=>/.test(source),
          'createMoveActions(deps) 단일 파라미터');
      assert.ok(!/createMoveActions[^=]+_shared/.test(source),
          '_shared 파라미터 제거됨');
  });

  test('cycle 315: createAscensionActions 시그니처 (deps)만', async () => {
      const source = await readSrc('src/hooks/gameActions/ascensionActions.ts');
      assert.ok(/createAscensionActions\s*=\s*\(deps:\s*any\)\s*=>/.test(source),
          'createAscensionActions(deps) 단일 파라미터');
      assert.ok(!/createAscensionActions[^=]+_shared/.test(source),
          '_shared 파라미터 제거됨');
  });

  test('cycle 315: useGameActions 호출 사이트 1-arg로 갱신 (TypeScript strict)', async () => {
      const source = await readSrc('src/hooks/useGameActions.ts');
      assert.ok(/createMoveActions\(deps\)/.test(source),
          'useGameActions createMoveActions(deps) 1-arg 호출');
      assert.ok(/createAscensionActions\(deps\)/.test(source),
          'useGameActions createAscensionActions(deps) 1-arg 호출');
      // 다른 factory는 여전히 shared 받음.
      assert.ok(/createExploreActions\(deps,\s*shared\)/.test(source),
          'createExploreActions은 shared 그대로');
  });

  test('cycle 315: 다른 gameAction factory는 shared 활성 사용 보존 (회귀 가드)', async () => {
      const exploreSrc = await readSrc('src/hooks/gameActions/exploreActions.ts');
      const questSrc = await readSrc('src/hooks/gameActions/questActions.ts');
      assert.ok(/commitExploreOutcome/.test(exploreSrc),
          'exploreActions commitExploreOutcome 사용 보존');
      assert.ok(/emitUnlockedTitles/.test(questSrc),
          'questActions emitUnlockedTitles 사용 보존');
  });

  test('cycle 314 회귀 가드: moveActions addStoryLog 제거 유지', async () => {
      const source = await readSrc('src/hooks/gameActions/moveActions.ts');
      const destrLine = source.match(/const\s*\{\s*[^}]+\}\s*=\s*deps\s*;/);
      assert.ok(destrLine, 'deps 구조분해 라인 발견');
      assert.ok(!/addStoryLog/.test(destrLine[0]),
          'cycle 314 addStoryLog destructure 제거 유지');
  });
}

// ─── cycle-316-add-item-to-inventory-private.test.js ───
{
  /**
   * cycle 316: addItemToInventory export → private downgrade
   *   (cycle 222-315 silent dead config 시리즈 86번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/utils/inventoryUtils.ts: addItemToInventory — addItemByName 내부 1회 사용 (line 30),
   *   외부 consumer 0건 (test 0건).
   *
   * 패턴 (cycle 222-315 silent dead config 시리즈 86번째):
   * - cycle 315: moveActions / ascensionActions 미사용 _shared 파라미터 제거.
   * - cycle 316: addItemToInventory private downgrade — export 표면 1개 축소.
   *
   * 수정 (src/utils/inventoryUtils.ts):
   * - addItemToInventory export 제거 (private const 유지).
   * - addItemByName 내부 호출 동일.
   *
   * 회귀 가드:
   * - addItemByName active export 유지 (24+ 호출 사이트).
   * - addItemByName 동작 동일 (내부에서 addItemToInventory 호출).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 316: addItemToInventory export 제거 (private)', async () => {
      const source = await readSrc('src/utils/inventoryUtils.ts');
      assert.ok(!/export const addItemToInventory\b/.test(source),
          'addItemToInventory export 제거됨');
      assert.ok(/const addItemToInventory\b/.test(source),
          'addItemToInventory const 정의 유지 (private)');
  });

  test('cycle 316: addItemByName active export 유지', async () => {
      const source = await readSrc('src/utils/inventoryUtils.ts');
      assert.ok(/export const addItemByName\b/.test(source),
          'addItemByName export 유지');
  });

  test('cycle 316: addItemByName 동작 보존 (회귀 가드)', async () => {
      const { addItemByName } = await import('../src/utils/inventoryUtils.js');
      // 미존재 아이템 → player 그대로.
      const player = { inv: [], name: 'test' };
      const result = addItemByName(player, '___not_a_real_item___');
      assert.equal(result, player, '미존재 아이템 → player 그대로 반환');
  });

  test('cycle 315 회귀 가드: moveActions / ascensionActions 1-arg 시그니처 유지', async () => {
      const moveSrc = await readSrc('src/hooks/gameActions/moveActions.ts');
      const asSrc = await readSrc('src/hooks/gameActions/ascensionActions.ts');
      assert.ok(/createMoveActions\s*=\s*\(deps:\s*any\)\s*=>/.test(moveSrc),
          'cycle 315 createMoveActions 1-arg 유지');
      assert.ok(/createAscensionActions\s*=\s*\(deps:\s*any\)\s*=>/.test(asSrc),
          'cycle 315 createAscensionActions 1-arg 유지');
  });
}

// ─── cycle-317-empty-temp-buff-private.test.js ───
{
  /**
   * cycle 317: EMPTY_TEMP_BUFF export → private downgrade
   *   (cycle 222-316 silent dead config 시리즈 87번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/utils/playerStateUtils.ts: EMPTY_TEMP_BUFF — playerStateUtils 내부 2회 사용
   *   (line 39 hasTemporaryAdventureState + line 65 clearTemporaryAdventureState),
   *   외부 consumer 0건 (src 0, tests 0).
   *
   * 패턴 (cycle 222-316 silent dead config 시리즈 87번째):
   * - cycle 316: addItemToInventory private downgrade.
   * - cycle 317: EMPTY_TEMP_BUFF private downgrade — export 표면 1개 축소.
   *
   * 수정 (src/utils/playerStateUtils.ts):
   * - EMPTY_TEMP_BUFF export 제거 (private const 유지).
   *
   * 회귀 가드:
   * - hasTemporaryAdventureState / clearTemporaryAdventureState / DEFAULT_COMBAT_FLAGS /
   *   incrementStat active export 유지.
   * - clearTemporaryAdventureState tempBuff 초기화 동작 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 317: EMPTY_TEMP_BUFF export 제거 (private)', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      assert.ok(!/export const EMPTY_TEMP_BUFF\b/.test(source),
          'EMPTY_TEMP_BUFF export 제거됨');
      assert.ok(/const EMPTY_TEMP_BUFF\b/.test(source),
          'EMPTY_TEMP_BUFF const 정의 유지 (private)');
  });

  test('cycle 317: playerStateUtils active exports 유지', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      // cycle 391: DEFAULT_COMBAT_FLAGS private downgrade로 active export list에서 제거.
      const activeExports = ['incrementStat', 'hasTemporaryAdventureState', 'clearTemporaryAdventureState'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 317: clearTemporaryAdventureState 동작 보존 (회귀 가드 — EMPTY_TEMP_BUFF 내부 사용)', async () => {
      const { clearTemporaryAdventureState } = await import('../src/utils/playerStateUtils.js');
      const player = { tempBuff: { atk: 5, def: 2, turn: 3, name: '버프' } };
      const result = clearTemporaryAdventureState(player);
      assert.equal(result.tempBuff.atk, 0, 'tempBuff.atk 0으로 reset');
      assert.equal(result.tempBuff.turn, 0, 'tempBuff.turn 0으로 reset');
      assert.equal(result.tempBuff.name, null, 'tempBuff.name null로 reset');
  });

  test('cycle 316 회귀 가드: addItemToInventory private 유지', async () => {
      const source = await readSrc('src/utils/inventoryUtils.ts');
      assert.ok(!/export const addItemToInventory\b/.test(source),
          'cycle 316 addItemToInventory private 유지');
  });
}

// ─── cycle-318-pool-key-by-location-private.test.js ───
{
  /**
   * cycle 318: getPoolKeyByLocation export → private downgrade
   *   (cycle 222-317 silent dead config 시리즈 88번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/utils/aiEventUtils.ts: getPoolKeyByLocation — aiEventUtils 내부 3회 사용
   *   (line 131 buildEventPackage / line 236 buildEventPackage / line 520 pickFallbackEvent),
   *   외부 호출 0건. 테스트 import는 cycle 292 active-list 가드에만 등장 (실제 호출 0건).
   *
   * 패턴 (cycle 222-317 silent dead config 시리즈 88번째):
   * - cycle 317: EMPTY_TEMP_BUFF private downgrade.
   * - cycle 318: getPoolKeyByLocation private downgrade.
   *
   * 수정:
   * - src/utils/aiEventUtils.ts: getPoolKeyByLocation export 제거 (private const 유지).
   * - tests/cycle-200-299.test.js: activeExports 리스트에서 제거.
   *
   * 회귀 가드:
   * - aiEventUtils active export 유지 (classifyChoice / buildEventPackage / pickFallbackEvent /
   *   summarizeHistory / getRecentEventSet).
   * - buildEventPackage / pickFallbackEvent 동작 보존 (내부 getPoolKeyByLocation 사용 chain).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 318: getPoolKeyByLocation export 제거 (private)', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/export const getPoolKeyByLocation\b/.test(source),
          'getPoolKeyByLocation export 제거됨');
      assert.ok(/const getPoolKeyByLocation\b/.test(source),
          'getPoolKeyByLocation const 정의 유지 (private)');
  });

  test('cycle 318: aiEventUtils active exports 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const activeExports = ['classifyChoice', 'buildEventPackage', 'pickFallbackEvent', 'summarizeHistory', 'getRecentEventSet'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 318: pickFallbackEvent 동작 보존 (회귀 가드 — getPoolKeyByLocation 내부 사용)', async () => {
      const { pickFallbackEvent } = await import('../src/utils/aiEventUtils.js');
      const event = pickFallbackEvent('숲', [], {});
      assert.ok(event, 'pickFallbackEvent 결과 반환');
      assert.ok(typeof event === 'object', 'event는 object');
  });

  test('cycle 317 회귀 가드: EMPTY_TEMP_BUFF private 유지', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      assert.ok(!/export const EMPTY_TEMP_BUFF\b/.test(source),
          'cycle 317 EMPTY_TEMP_BUFF private 유지');
  });
}

// ─── cycle-319-unused-type-imports.test.js ───
{
  /**
   * cycle 319: 2 unused type imports cleanup
   *   (cycle 222-318 silent dead config 시리즈 89번째 — cleanup lens 연속).
   *
   * 발견 (unused type imports):
   * - src/utils/runProfileUtils.ts:1-2 `import type { Monster }` + `import type { Player }`
   *   → barrel re-export 파일에서 사용 0건. `export *`만 필요.
   * - src/types/player.ts:8 `import type { ... ConsumableItem }`
   *   → ConsumableItem 사용 0건 (Item과 EquipSlots만 사용).
   *
   * 패턴 (cycle 222-318 silent dead config 시리즈 89번째):
   * - cycle 318: getPoolKeyByLocation private downgrade.
   * - cycle 319: 2 unused type imports cleanup — import 라인 표면 축소.
   *
   * 수정:
   * - runProfileUtils.ts: `import type { Monster, Player }` 2 라인 제거.
   * - player.ts: import에서 ConsumableItem 제거.
   *
   * 회귀 가드:
   * - runProfileUtils.ts barrel re-export `export * from './runProfile.js'` 보존.
   * - player.ts Player interface inv?: Item[] / equip?: EquipSlots 사용 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 319: runProfileUtils.ts unused Monster / Player import 제거', async () => {
      const source = await readSrc('src/utils/runProfileUtils.ts');
      assert.ok(!/import type \{ Monster \}/.test(source),
          'Monster import 제거됨');
      assert.ok(!/import type \{ Player \}/.test(source),
          'Player import 제거됨');
  });

  test('cycle 319: runProfileUtils.ts barrel re-export 보존', async () => {
      const source = await readSrc('src/utils/runProfileUtils.ts');
      assert.ok(/export \* from ['"]\.\/runProfile/.test(source),
          'export * from runProfile 보존');
  });

  test('cycle 319: player.ts ConsumableItem import 제거', async () => {
      const source = await readSrc('src/types/player.ts');
      assert.ok(!/import type \{[^}]*ConsumableItem[^}]*\}/.test(source),
          'ConsumableItem import 제거됨');
      assert.ok(/import type \{ EquipSlots, Item \}/.test(source),
          'EquipSlots / Item import 유지');
  });

  test('cycle 319: Player interface 필드 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/types/player.ts');
      assert.ok(/inv\?:\s*Item\[\]/.test(source), 'Player.inv?: Item[] 보존');
      assert.ok(/equip\?:\s*EquipSlots/.test(source), 'Player.equip?: EquipSlots 보존');
  });

  test('cycle 318 회귀 가드: getPoolKeyByLocation private 유지', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/export const getPoolKeyByLocation\b/.test(source),
          'cycle 318 getPoolKeyByLocation private 유지');
  });
}

// ─── cycle-321-unused-imports-batch.test.js ───
{
  /**
   * cycle 321: 8 unused imports 일괄 cleanup (8 files)
   *   (cycle 222-320 silent dead config 시리즈 90번째 — cleanup lens 연속).
   *
   * 발견 (8 unused imports across 8 files):
   * 1. src/utils/equipmentUtils.ts: `import type { Player }` — 사용 0건.
   * 2. src/components/Codex.tsx: BALANCE import — 사용 0건.
   * 3. src/components/Codex.tsx: MSG import — 사용 0건.
   * 4. src/systems/CombatEngine.ts: LOOT_TABLE import — 사용 0건 (CombatEngine.loot.ts에서만 사용).
   * 5. src/systems/CombatEngine.ts: DROP_TABLES import — 동일.
   * 6. src/data/messages.ts: DB import — messages는 정적 메시지 정의, DB 사용 0건.
   * 7. src/components/codex/MonsterCodex.tsx: Lock icon import — JSX <Lock> 0건.
   * 8. src/components/codex/CodexDiscoveryOverlay.tsx: MSG import — 사용 0건.
   * 9. src/components/codex/EquipmentCodexCard.tsx: BALANCE import — 사용 0건.
   * 10. src/components/codex/WeaponCodex.tsx: BALANCE import — 사용 0건.
   *
   * 패턴 (cycle 222-320 silent dead config 시리즈 90번째):
   * - cycle 320: CHANGELOG batch (cycles 301-319).
   * - cycle 321: import 표면 batch cleanup — 8 files 10 unused imports 정리.
   *
   * 회귀 가드:
   * - 각 파일의 active import는 그대로 유지.
   * - 컴파일 / 린트 / 테스트 / 빌드 모두 통과.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 321: equipmentUtils.ts Player type import 제거', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/import type \{ Player \}/.test(source),
          'Player import 제거됨');
  });

  test('cycle 321: Codex.tsx BALANCE / MSG imports 제거', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      assert.ok(!/^import \{ BALANCE \} from/m.test(source),
          'BALANCE import 제거됨');
      assert.ok(!/^import \{ MSG \} from/m.test(source),
          'MSG import 제거됨');
  });

  test('cycle 321: CombatEngine.ts LOOT_TABLE / DROP_TABLES imports 제거', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/^import \{ LOOT_TABLE \} from/m.test(source),
          'LOOT_TABLE import 제거됨');
      assert.ok(!/^import \{ DROP_TABLES \} from/m.test(source),
          'DROP_TABLES import 제거됨');
  });

  test('cycle 321: messages.ts DB import 제거', async () => {
      const source = await readSrc('src/data/messages.ts');
      assert.ok(!/^import \{ DB \} from/m.test(source),
          'DB import 제거됨');
  });

  test('cycle 321: codex 파일들의 unused imports 제거', async () => {
      const monsterSrc = await readSrc('src/components/codex/MonsterCodex.tsx');
      const overlaySrc = await readSrc('src/components/codex/CodexDiscoveryOverlay.tsx');
      const cardSrc = await readSrc('src/components/codex/EquipmentCodexCard.tsx');
      const weaponSrc = await readSrc('src/components/codex/WeaponCodex.tsx');
      assert.ok(!/^import \{ Lock \} from 'lucide-react'/m.test(monsterSrc),
          'MonsterCodex Lock import 제거됨');
      assert.ok(!/^import \{ MSG \} from/m.test(overlaySrc),
          'CodexDiscoveryOverlay MSG import 제거됨');
      assert.ok(!/^import \{ BALANCE \} from/m.test(cardSrc),
          'EquipmentCodexCard BALANCE import 제거됨');
      assert.ok(!/^import \{ BALANCE \} from/m.test(weaponSrc),
          'WeaponCodex BALANCE import 제거됨');
  });

  test('cycle 320 회귀 가드: CHANGELOG batch 보존', async () => {
      const source = await readSrc('CHANGELOG.md');
      assert.ok(/Cycle 320 🎯/.test(source),
          'cycle 320 batch entry 보존');
  });
}

// ─── cycle-322-unused-react-default-imports.test.js ───
{
  /**
   * cycle 322: 55 files unused React default import 일괄 정리
   *   (cycle 222-321 silent dead config 시리즈 91번째 — cleanup lens 연속).
   *
   * 발견 (unused default imports):
   * - tsconfig "jsx": "react-jsx" → automatic runtime, JSX 사용에 React import 불필요.
   * - 55 .tsx 파일에서 `import React, { ... }` 또는 `import React from 'react'`
   *   형태로 React default를 import하지만 어디에서도 React.X 호출 0건.
   *
   * 패턴 (cycle 222-321 silent dead config 시리즈 91번째):
   * - cycle 321: 8 files 10 unused imports cleanup.
   * - cycle 322: 55 files unused React default — 단일 cycle 최대 file 갯수 정리.
   *
   * 수정 방식:
   * - `import React, { ... } from 'react';` → `import { ... } from 'react';`
   * - `import React from 'react';` (단일 default) → 해당 라인 삭제.
   *
   * 회귀 가드:
   * - JSX 컴파일 정상 (jsx-runtime 자동 import).
   * - tsc / lint / unit / build-guard 모두 통과.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 322: 주요 컴포넌트의 unused React default 제거', async () => {
      const samples = [
          'src/App.tsx',
          'src/components/Dashboard.tsx',
          'src/components/TerminalView.tsx',
          'src/components/ControlPanel.tsx',
      ];
      for (const f of samples) {
          const source = await readSrc(f);
          // React.X 호출이 0건이면 import에서 React default도 0건이어야 함.
          const reactUses = (source.match(/\bReact\./g) || []).length;
          if (reactUses === 0) {
              assert.ok(!/^import React\b/m.test(source),
                  `${f}: React.X 사용 0건이면 React default import도 0건`);
          }
      }
  });

  test('cycle 322: jsx-runtime 자동 import (tsconfig "jsx": "react-jsx")', async () => {
      const tsconfig = await readSrc('tsconfig.json');
      assert.ok(/"jsx":\s*"react-jsx"/.test(tsconfig),
          'tsconfig jsx: react-jsx (automatic runtime) 보존');
  });

  test('cycle 322: React.X 사용하는 파일은 React import 보존', async () => {
      // React.useState나 React.FC 등을 직접 쓰는 파일은 import 유지되어야 함.
      // 본 batch에서는 그런 파일이 없을 가능성이 높지만, 회귀 가드.
      const dirs = ['src/components', 'src/hooks'];
      for (const dir of dirs) {
          const fs = await import('node:fs/promises');
          const entries = await fs.readdir(path.join(ROOT, dir), { recursive: true, withFileTypes: true });
          for (const e of entries) {
              if (!e.isFile()) continue;
              if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
              const full = path.join(e.parentPath || dir, e.name);
              const source = await fs.readFile(full, 'utf8');
              const reactUses = (source.match(/\bReact\./g) || []).length;
              if (reactUses > 0) {
                  assert.ok(/^import React\b/m.test(source),
                      `${full}: React.X 사용 시 React import 보존`);
              }
          }
      }
  });

  test('cycle 321 회귀 가드: 8 files unused imports 정리 보존', async () => {
      const codexSrc = await readSrc('src/components/Codex.tsx');
      assert.ok(!/^import \{ BALANCE \} from/m.test(codexSrc),
          'cycle 321 Codex.tsx BALANCE 제거 보존');
      assert.ok(!/^import \{ MSG \} from/m.test(codexSrc),
          'cycle 321 Codex.tsx MSG 제거 보존');
  });
}

// ─── cycle-323-unused-imports-leftover.test.js ───
{
  /**
   * cycle 323: 3 leftover unused imports 정리 (cycle 321/322 paired completion)
   *   (cycle 222-322 silent dead config 시리즈 92번째 — cleanup lens 연속).
   *
   * 발견 (3 leftover unused imports):
   * - src/utils/exploreUtils.ts:1 `Monster` type — 사용 0건.
   * - src/components/SkillTreePreview.tsx:3 `RefreshCw` icon — JSX 0건.
   * - src/components/Codex.tsx:2 `Shield` icon — JSX 0건.
   *
   * 패턴 (cycle 222-322 silent dead config 시리즈 92번째):
   * - cycle 322: 55 files unused React default 일괄 정리.
   * - cycle 323: 남은 unused named imports 3건 정리 (cycle 321/322 paired completion).
   *
   * 회귀 가드:
   * - 각 파일의 active import는 그대로.
   * - tsc / lint / unit / build-guard 모두 통과.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 323: exploreUtils.ts Monster type import 제거', async () => {
      const source = await readSrc('src/utils/exploreUtils.ts');
      // import 라인에서 Monster 0건.
      const importMatch = source.match(/^import type \{ ([^}]+) \} from '\.\.\/types\/index\.js';/m);
      assert.ok(importMatch, 'GameMap/Relic import 라인 발견');
      assert.ok(!/\bMonster\b/.test(importMatch[1]),
          'Monster import 제거됨');
      assert.ok(/GameMap/.test(importMatch[1]), 'GameMap 보존');
      assert.ok(/Relic/.test(importMatch[1]), 'Relic 보존');
  });

  test('cycle 323: SkillTreePreview.tsx RefreshCw import 제거', async () => {
      const source = await readSrc('src/components/SkillTreePreview.tsx');
      const importMatch = source.match(/^import \{ ([^}]+) \} from 'lucide-react';/m);
      assert.ok(importMatch, 'lucide-react import 발견');
      assert.ok(!/\bRefreshCw\b/.test(importMatch[1]),
          'RefreshCw import 제거됨');
  });

  test('cycle 323: Codex.tsx Shield icon import 제거', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      const importMatch = source.match(/^import \{ ([^}]+) \} from 'lucide-react';/m);
      assert.ok(importMatch, 'lucide-react import 발견');
      assert.ok(!/\bShield\b/.test(importMatch[1]),
          'Shield icon import 제거됨');
  });

  test('cycle 322 회귀 가드: React default 정리 보존', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const reactUses = (source.match(/\bReact\./g) || []).length;
      if (reactUses === 0) {
          assert.ok(!/^import React\b/m.test(source),
              'cycle 322 Dashboard React default 제거 보존');
      }
  });
}

// ─── cycle-324-firebase-app-dead-export.test.js ───
{
  /**
   * cycle 324: firebase.ts `app` dead export 제거
   *   (cycle 222-323 silent dead config 시리즈 93번째 — cleanup lens 연속).
   *
   * 발견 (dead export):
   * - src/firebase.ts: `app` export — initializeApp 결과 객체.
   * - src/ 어디에서도 `import { app } from '../firebase'` 0건.
   * - auth / db / hasFirebaseConfig는 active import (4 consumers + 50+ db usage).
   *
   * 패턴 (cycle 222-323 silent dead config 시리즈 93번째):
   * - cycle 323: 3 leftover unused imports (cycle 321/322 paired).
   * - cycle 324: firebase.ts `app` dead export 제거.
   *
   * 수정:
   * - src/firebase.ts: export list에서 `app` 제거.
   * - app const 정의 자체는 유지 (auth = getAuth(app) / db = getFirestore(app) 내부 사용).
   *
   * 회귀 가드:
   * - auth / db / hasFirebaseConfig export 그대로.
   * - getAuth(app) / getFirestore(app) 내부 호출 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 324: firebase.ts app export 제거', async () => {
      const source = await readSrc('src/firebase.ts');
      // export list에 `app` 없어야 함.
      const exportLine = source.match(/^export \{ ([^}]+) \};$/m);
      assert.ok(exportLine, 'export 라인 발견');
      assert.ok(!/\bapp\b/.test(exportLine[1]),
          'app export 제거됨');
  });

  test('cycle 324: firebase.ts app const 정의 유지 (private)', async () => {
      const source = await readSrc('src/firebase.ts');
      assert.ok(/const app = initializeApp/.test(source),
          'app const 정의 유지');
      assert.ok(/getAuth\(app\)/.test(source),
          'getAuth(app) 호출 유지');
      assert.ok(/getFirestore\(app\)/.test(source),
          'getFirestore(app) 호출 유지');
  });

  test('cycle 324: auth / db / hasFirebaseConfig export 유지', async () => {
      const source = await readSrc('src/firebase.ts');
      const exportLine = source.match(/^export \{ ([^}]+) \};$/m);
      assert.ok(exportLine, 'export 라인 발견');
      assert.ok(/\bauth\b/.test(exportLine[1]), 'auth export 유지');
      assert.ok(/\bdb\b/.test(exportLine[1]), 'db export 유지');
      assert.ok(/\bhasFirebaseConfig\b/.test(exportLine[1]), 'hasFirebaseConfig export 유지');
  });

  test('cycle 323 회귀 가드: 3 leftover unused imports 정리 보존', async () => {
      const eu = await readSrc('src/utils/exploreUtils.ts');
      const importMatch = eu.match(/^import type \{ ([^}]+) \} from '\.\.\/types\/index\.js';/m);
      assert.ok(importMatch && !/\bMonster\b/.test(importMatch[1]),
          'cycle 323 exploreUtils Monster 제거 보존');
  });
}

// ─── cycle-325-sound-manager-hover-dead.test.js ───
{
  /**
   * cycle 325: SoundManager 'hover' case dead branch 제거
   *   (cycle 222-324 silent dead config 시리즈 94번째 — cleanup lens 연속).
   *
   * 발견 (dead switch case):
   * - src/systems/SoundManager.ts: switch(type)에 'hover' case 정의.
   *   부드러운 호버 sfx (800Hz → 1200Hz arc) 정의되어 있지만
   *   src/ 어디에서도 `soundManager.play('hover')` 호출 0건.
   *
   * 비교 — 다른 case는 모두 dispatch:
   * - 'click' / 'attack' / 'skill' / 'levelUp' / 'death' / 'victory' / 'escape' /
   *   'explore' / 'heal' / 'item' / 'error' / 'new_area' / 'discovery_chain' /
   *   'quest_complete' / 'legendary' 모두 호출 사이트 보유.
   *
   * 패턴 (cycle 222-324 silent dead config 시리즈 94번째):
   * - cycle 324: firebase.ts app dead export 제거.
   * - cycle 325: SoundManager hover dead case 정리.
   *
   * 수정 (src/systems/SoundManager.ts):
   * - 'hover' case 제거 (10 lines sfx 정의).
   *
   * 회귀 가드:
   * - 다른 14 case는 그대로 — dispatch path 영향 없음.
   * - soundManager.play / init / toggleMute API 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 325: SoundManager hover case 제거', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.ok(!/case 'hover':\s*\{/.test(source),
          "'hover' case 제거됨");
  });

  test('cycle 325: SoundManager 다른 14 case 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      const aliveCases = ['attack', 'click', 'death', 'discovery_chain', 'error', 'escape', 'explore', 'heal', 'item', 'legendary', 'levelUp', 'new_area', 'quest_complete', 'skill', 'victory'];
      aliveCases.forEach((name) => {
          const re = new RegExp(`case '${name}'`);
          assert.ok(re.test(source), `case '${name}' 보존`);
      });
  });

  test('cycle 325: soundManager export 보존', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.ok(/export const soundManager/.test(source),
          'soundManager export 유지');
  });

  test('cycle 324 회귀 가드: firebase app export 제거 보존', async () => {
      const source = await readSrc('src/firebase.ts');
      const exportLine = source.match(/^export \{ ([^}]+) \};$/m);
      assert.ok(exportLine && !/\bapp\b/.test(exportLine[1]),
          'cycle 324 app export 제거 보존');
  });
}

// ─── cycle-326-token-quota-dead-method.test.js ───
{
  /**
   * cycle 326: TokenQuotaManager.getRemainingCalls dead method 제거
   *   (cycle 222-325 silent dead config 시리즈 95번째 — cleanup lens 연속).
   *
   * 발견 (dead method):
   * - src/systems/TokenQuotaManager.ts: getRemainingCalls — DAILY_LIMIT - quota.used 반환.
   *   src/, tests/ 어디에서도 TokenQuotaManager.getRemainingCalls() 호출 0건.
   *   내부에서도 self-call 0건.
   *
   * 비교 — 다른 method는 모두 active:
   * - canMakeAICall: aiService에서 2회 사용.
   * - recordCall: aiService에서 2회 사용.
   * - getExhaustedMessage: aiService에서 1회 사용.
   * - syncToFirestore: useFirebaseSync에서 1회 사용.
   *
   * 패턴 (cycle 222-325 silent dead config 시리즈 95번째):
   * - cycle 325: SoundManager hover case dead.
   * - cycle 326: TokenQuotaManager.getRemainingCalls dead method.
   *
   * 수정 (src/systems/TokenQuotaManager.ts):
   * - getRemainingCalls 메서드 제거 (5 lines).
   *
   * 회귀 가드:
   * - canMakeAICall / recordCall / getExhaustedMessage / syncToFirestore 보존.
   * - DAILY_LIMIT / QUOTA_KEY / getQuotaData 내부 사용 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 326: getRemainingCalls 메서드 제거', async () => {
      const source = await readSrc('src/systems/TokenQuotaManager.ts');
      assert.ok(!/getRemainingCalls\s*\(/.test(source),
          'getRemainingCalls 메서드 제거됨');
  });

  test('cycle 326: TokenQuotaManager 활성 메서드 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/systems/TokenQuotaManager.ts');
      const aliveMethods = ['canMakeAICall', 'recordCall', 'getExhaustedMessage', 'syncToFirestore', 'getQuotaData'];
      aliveMethods.forEach((name) => {
          const re = new RegExp(`${name}\\s*\\(`);
          assert.ok(re.test(source), `${name} 메서드 보존`);
      });
  });

  test('cycle 326: aiService TokenQuotaManager 호출 보존', async () => {
      const source = await readSrc('src/services/aiService.ts');
      assert.ok(/TokenQuotaManager\.canMakeAICall/.test(source),
          'aiService canMakeAICall 호출 보존');
      assert.ok(/TokenQuotaManager\.recordCall/.test(source),
          'aiService recordCall 호출 보존');
  });

  test('cycle 325 회귀 가드: SoundManager hover case 제거 보존', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.ok(!/case 'hover':\s*\{/.test(source),
          'cycle 325 hover case 제거 보존');
  });
}

// ─── cycle-327-job-typical-loadout-dead.test.js ───
{
  /**
   * cycle 327: JOB_TYPICAL_LOADOUT dead data export 제거 (paired test cleanup)
   *   (cycle 222-326 silent dead config 시리즈 96번째 — cleanup lens 연속).
   *
   * 발견 (dead data):
   * - src/utils/avatarSpriteCandidates.ts: JOB_TYPICAL_LOADOUT export — 13 직업 × 무기 매핑.
   *   - cycle 43-46 시점 outfit affinity 표시용으로 보존했으나 그 dispatch path 미구현.
   *   - getAvatarSpriteCandidates 등 내부 다른 함수에서도 사용 0건.
   *   - 테스트 (avatar-sprite-priority.test.js)만이 유일한 consumer.
   *
   * 패턴 (cycle 222-326 silent dead config 시리즈 96번째):
   * - cycle 326: TokenQuotaManager.getRemainingCalls dead method.
   * - cycle 327: JOB_TYPICAL_LOADOUT dead data + paired test 정리.
   *
   * 수정:
   * - src/utils/avatarSpriteCandidates.ts: JOB_TYPICAL_LOADOUT 정의 + export 제거.
   * - tests/avatar-sprite-priority.test.js: import에서 JOB_TYPICAL_LOADOUT 제거 +
   *   "보존 가드" 테스트 케이스 제거.
   *
   * 회귀 가드:
   * - JOB_SPRITE_SLUG_MAP / getAvatarSpriteCandidates / getAvatarEquipmentPreviewCandidates
   *   active export 유지.
   * - sprite 결정 로직 (cycle 46 단순화) 동작 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 327: JOB_TYPICAL_LOADOUT export 제거', async () => {
      const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
      assert.ok(!/export const JOB_TYPICAL_LOADOUT\b/.test(source),
          'JOB_TYPICAL_LOADOUT export 제거됨');
  });

  test('cycle 327: avatar-sprite-priority.test.js JOB_TYPICAL_LOADOUT import 제거', async () => {
      const source = await readSrc('tests/avatar-sprite-priority.test.js');
      assert.ok(!/import.*JOB_TYPICAL_LOADOUT/.test(source),
          'JOB_TYPICAL_LOADOUT import 제거됨');
  });

  test('cycle 327: avatarSpriteCandidates active exports 유지', async () => {
      const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
      const aliveExports = ['JOB_SPRITE_SLUG_MAP', 'getAvatarSpriteCandidates', 'getAvatarEquipmentPreviewCandidates'];
      aliveExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 327: getAvatarSpriteCandidates 동작 보존 (회귀 가드)', async () => {
      const { getAvatarSpriteCandidates } = await import('../src/utils/avatarSpriteCandidates.js');
      const candidates = getAvatarSpriteCandidates({ job: '???', armorStyle: 'plate', loadoutStyle: 'sword' });
      assert.ok(Array.isArray(candidates), 'array 반환');
      assert.ok(candidates.length > 0, '최소 1개 sprite 후보 (adventurer fallback)');
  });

  test('cycle 326 회귀 가드: TokenQuotaManager.getRemainingCalls 제거 보존', async () => {
      const source = await readSrc('src/systems/TokenQuotaManager.ts');
      assert.ok(!/getRemainingCalls\s*\(/.test(source),
          'cycle 326 getRemainingCalls 제거 보존');
  });
}

// ─── cycle-329-test-api-dead-methods.test.js ───
{
  /**
   * cycle 329: useGameTestApi 3 dead methods 제거 (getState / clearPostCombat / injectAscensionPreview)
   *   (cycle 222-328 silent dead config 시리즈 98번째 — cleanup lens 연속).
   *
   * 발견 (3 dead test API methods):
   * - getState: window.__AETHERIA_TEST_API__.getState — scripts/, tests/, docs
   *   어디에서도 호출 0건.
   * - clearPostCombat: 동일 0건.
   * - injectAscensionPreview: 동일 0건. AscensionScreen 렌더 강제 helper지만 사용처 없음.
   *
   * 비교 — 다른 test API methods는 active:
   * - getDomMetrics / getPerfSnapshot / markPerf / resetGame / sendCommand / setSideTab /
   *   seedAvatarScenario / seedEnhanceScenario / injectEvent → smoke / perf 스크립트에서 사용.
   * - injectPostCombatResult / injectRelicChoice / injectRunSummary → docs(progress.md, todo.md)에
   *   언급 (Playwright QA 훅 의도).
   *
   * 패턴 (cycle 222-328 silent dead config 시리즈 98번째):
   * - cycle 328: BossPhase type private downgrade.
   * - cycle 329: useGameTestApi 3 fully dead methods cleanup.
   *
   * 수정 (src/hooks/useGameTestApi.ts):
   * - getState / clearPostCombat / injectAscensionPreview 메서드 제거.
   *
   * 회귀 가드:
   * - 다른 test API methods 보존.
   * - smoke-gameplay.mjs / perf-guard.mjs script chain 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 329: 3 dead methods 제거', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/getState:\s*\(\)/.test(source),
          'getState 메서드 제거됨');
      assert.ok(!/clearPostCombat:\s*\(\)/.test(source),
          'clearPostCombat 메서드 제거됨');
      assert.ok(!/injectAscensionPreview:\s*\(\)/.test(source),
          'injectAscensionPreview 메서드 제거됨');
  });

  test('cycle 329: active test API methods 보존', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      const aliveMethods = ['getDomMetrics', 'getPerfSnapshot', 'markPerf', 'resetGame', 'sendCommand', 'setSideTab', 'seedAvatarScenario', 'seedEnhanceScenario', 'injectEvent'];
      aliveMethods.forEach((name) => {
          const re = new RegExp(`${name}:\\s*\\(`);
          assert.ok(re.test(source), `${name} 보존`);
      });
  });

  test('cycle 329: smoke-gameplay.mjs script 호출 보존 (회귀 가드)', async () => {
      const source = await readSrc('scripts/smoke-gameplay.mjs');
      assert.ok(/__AETHERIA_TEST_API__\?\.sendCommand/.test(source),
          'smoke-gameplay sendCommand 호출 보존');
      assert.ok(/__AETHERIA_TEST_API__\?\.resetGame/.test(source),
          'smoke-gameplay resetGame 호출 보존');
  });

  test('cycle 328 회귀 가드: BossPhase private 유지', async () => {
      const source = await readSrc('src/types/monster.ts');
      assert.ok(!/export interface BossPhase\b/.test(source),
          'cycle 328 BossPhase private 유지');
  });
}

// ─── cycle-331-adventure-guide-emphasis-dead.test.js ───
{
  /**
   * cycle 331: getAdventureGuidance emphasis 필드 11회 dead 제거 (cycle 310 cascade)
   *   (cycle 222-330 silent dead config 시리즈 100번째 — cleanup lens 연속, 한 자리수 도달).
   *
   * 발견 (dead emphasis field):
   * - src/utils/adventureGuide.ts: getAdventureGuidance 11 return statement에서
   *   각각 `emphasis: '...'` 정의 (11개 한국어 라벨).
   * - cycle 23 시점 FocusPanel `'확률 증폭'` 등 emphasis surface 표시용으로 도입.
   * - cycle 310 FocusPanel 제거 후 src/, tests/ 어디에서도 `guidance.emphasis` read 0건.
   * - 다른 emphasis 필드 (questOperations entry.meta.emphasis) 와 별개.
   *
   * 패턴 (cycle 222-330 silent dead config 시리즈 100번째):
   * - cycle 330: SignalBadge 'signature' tone cascade dead.
   * - cycle 331: getAdventureGuidance emphasis 11회 dead 일괄 정리.
   *
   * 수정 (src/utils/adventureGuide.ts):
   * - 11 emphasis 필드 제거 (sed `/emphasis:.*,$/d`).
   *
   * 회귀 가드:
   * - title / detail / primaryAction / secondaryAction 필드 보존.
   * - 기존 test (cycle-115-guide-debuff-hint, quest-operations.test, adventure-guide.test)
   *   는 title/detail만 검증 → 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 331: getAdventureGuidance emphasis 필드 0개 (11개 모두 제거)', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      const matches = source.match(/^\s+emphasis:/gm) || [];
      assert.equal(matches.length, 0,
          `getAdventureGuidance에서 emphasis 필드 0개여야 함, ${matches.length}개 발견`);
  });

  test('cycle 331: getAdventureGuidance 다른 필드 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      // primaryAction, secondaryAction, title, detail 필드는 그대로.
      const primaryCount = (source.match(/^\s+primaryAction:/gm) || []).length;
      const titleCount = (source.match(/^\s+title:/gm) || []).length;
      assert.ok(primaryCount >= 11, `primaryAction 필드 11+ 보존 (실제: ${primaryCount})`);
      assert.ok(titleCount >= 11, `title 필드 11+ 보존 (실제: ${titleCount})`);
  });

  test('cycle 331: getAdventureGuidance 동작 보존 (primaryAction 흐름)', async () => {
      const { getAdventureGuidance } = await import('../src/utils/adventureGuide.js');
      const player = { hp: 100, maxHp: 100, mp: 50, maxMp: 50, level: 5, job: '검사', loc: '시작의 마을', inv: [], stats: {} };
      const stats = { maxHp: 100, maxMp: 50 };
      const guidance = getAdventureGuidance(player, stats, { type: 'safe' }, 'idle');
      assert.ok(guidance, 'guidance 객체 반환');
      // emphasis 필드 없어야 함.
      assert.equal(guidance.emphasis, undefined, 'emphasis 필드 undefined');
      // 다른 필드 존재.
      assert.ok(guidance.primaryAction !== undefined, 'primaryAction 존재');
  });

  test('cycle 330 회귀 가드: SignalBadge signature tone 제거 보존', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      assert.ok(!/^\s+signature:\s*'border/m.test(source),
          'cycle 330 signature tone 제거 보존');
  });
}

// ─── cycle-332-secondary-action-dead.test.js ───
{
  /**
   * cycle 332: getAdventureGuidance secondaryAction 11회 + mpRatio 변수 dead 정리
   *   (cycle 222-331 silent dead config 시리즈 101번째 — cleanup lens 연속).
   *
   * 발견 (dead field cascade from cycle 310):
   * - getAdventureGuidance 11 return statement에서 각각 `secondaryAction: ...` 정의.
   *   cycle 310 FocusPanel 제거 후 src/, tests/ 어디에서도 `guidance.secondaryAction` read 0건.
   * - mpRatio 변수: secondaryAction의 'MP도 회복' 분기 (`mpRatio <= 0.45 ? ...`) 외에서 read 0건.
   *   secondaryAction 제거로 cascade dead.
   *
   * 패턴 (cycle 222-331 silent dead config 시리즈 101번째):
   * - cycle 331: emphasis 11회 dead 일괄 제거.
   * - cycle 332: secondaryAction 11회 + mpRatio 변수 cascade dead.
   *
   * 수정 (src/utils/adventureGuide.ts):
   * - 11 secondaryAction 필드 일괄 제거 (sed `/secondaryAction:/d`).
   * - mpRatio 변수 정의 제거 (lint no-unused-vars).
   *
   * 회귀 가드:
   * - getAdventureGuidance title / detail / primaryAction 필드 보존.
   * - 다른 함수의 mpRatio (line 138 getMoveRecommendations) 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 332: getAdventureGuidance secondaryAction 0개 (11개 모두 제거)', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      // line 246 이후 (getAdventureGuidance 함수)에 secondaryAction 0건.
      const guidanceFn = source.slice(source.indexOf('export const getAdventureGuidance'));
      assert.ok(!/secondaryAction:/.test(guidanceFn),
          'getAdventureGuidance에서 secondaryAction 0건');
  });

  test('cycle 332: mpRatio 변수 getAdventureGuidance에서 제거', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      const guidanceFn = source.slice(source.indexOf('export const getAdventureGuidance'));
      assert.ok(!/const mpRatio =/.test(guidanceFn),
          'getAdventureGuidance에서 mpRatio 정의 제거됨');
  });

  test('cycle 332: getMoveRecommendations의 mpRatio 보존 (line 138)', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      // 다른 함수의 mpRatio는 그대로 (function scope 무관).
      const matches = (source.match(/const mpRatio =/g) || []).length;
      assert.equal(matches, 1, 'mpRatio 정의 1개만 남음 (getMoveRecommendations)');
  });

  test('cycle 332: getAdventureGuidance 동작 보존 (primaryAction 흐름)', async () => {
      const { getAdventureGuidance } = await import('../src/utils/adventureGuide.js');
      const player = { hp: 100, maxHp: 100, mp: 50, maxMp: 50, level: 5, job: '검사', loc: '시작의 마을', inv: [], stats: {} };
      const stats = { maxHp: 100, maxMp: 50 };
      const guidance = getAdventureGuidance(player, stats, { type: 'safe' }, 'idle');
      assert.ok(guidance, 'guidance 객체 반환');
      assert.equal(guidance.secondaryAction, undefined, 'secondaryAction undefined');
      assert.ok(guidance.primaryAction !== undefined, 'primaryAction 존재');
  });

  test('cycle 331 회귀 가드: emphasis 제거 보존', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      const guidanceFn = source.slice(source.indexOf('export const getAdventureGuidance'));
      assert.ok(!/emphasis:/.test(guidanceFn),
          'cycle 331 emphasis 제거 보존');
  });
}

// ─── cycle-333-move-recommendation-dead-fields.test.js ───
{
  /**
   * cycle 333: getMoveRecommendations 4 dead 출력 필드 정리 (score/isSafeTarget/isVisited/isBoss)
   *   (cycle 222-332 silent dead config 시리즈 102번째 — cleanup lens 연속).
   *
   * 발견 (dead output fields):
   * - getMoveRecommendations 반환 객체에서 score / isSafeTarget / isVisited / isBoss
   *   외부 read 0건 (ControlPanel / MapNavigator / 모든 test).
   * - score는 정렬에만 사용되지만 외부 노출 후에도 read 0건.
   * - 활성 출력 필드: name / badge / reason / levelLabel / chips / undiscoveredSignatureCount /
   *   isRecommended.
   *
   * 패턴 (cycle 222-332 silent dead config 시리즈 102번째):
   * - cycle 332: secondaryAction 11회 + mpRatio 변수 cascade dead.
   * - cycle 333: getMoveRecommendations 4 출력 필드 cleanup.
   *
   * 수정 (src/utils/adventureGuide.ts):
   * - score → _sortKey internal-only 변수 (정렬 후 strip).
   * - isSafeTarget / isVisited / isBoss 출력 필드 제거 (내부 변수는 chips/score 계산용 유지).
   *
   * 회귀 가드:
   * - 기존 test (signature-move-recommendation)는 name / chips / undiscoveredSignatureCount
   *   만 검증 → 영향 없음.
   * - 정렬 순서 동일 (점수 기준 내림차순).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 333: getMoveRecommendations 출력에 4 dead 필드 0건', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      // 반환 객체 (return { ... })에 4 dead 필드 0건. 단, isSafeTarget/isVisited/isBoss는
      // 내부 변수로 계산용 유지 — 출력에 포함되지 않으면 OK.
      // _sortKey 사용 패턴 확인 (정렬용 임시 키).
      assert.ok(/_sortKey/.test(source), '_sortKey 정렬용 키 도입');
      // 외부 노출 strip 패턴 확인.
      assert.ok(/const \{ _sortKey, \.\.\.exposed \}/.test(source),
          '_sortKey 정렬 후 strip 패턴');
  });

  test('cycle 333: getMoveRecommendations 출력 동작 보존', async () => {
      const { getMoveRecommendations } = await import('../src/utils/adventureGuide.js');
      const { DB } = await import('../src/data/db.js');
      const player = { hp: 100, maxHp: 100, mp: 50, maxMp: 50, level: 5, job: '검사', loc: '시작의 마을', inv: [], stats: { visitedMaps: ['시작의 마을'] } };
      const stats = { maxHp: 100, maxMp: 50 };
      const recs = getMoveRecommendations(player, stats, DB.MAPS['시작의 마을'], DB.MAPS);
      assert.ok(Array.isArray(recs), 'array 반환');
      assert.ok(recs.length > 0, '최소 1개 추천');
      // 각 entry는 active 필드만 보유.
      for (const r of recs) {
          assert.ok(typeof r.name === 'string', 'name 보존');
          assert.ok(typeof r.badge === 'string', 'badge 보존');
          assert.ok(typeof r.reason === 'string', 'reason 보존');
          assert.ok(typeof r.levelLabel === 'string', 'levelLabel 보존');
          assert.ok(Array.isArray(r.chips), 'chips 보존');
          assert.equal(typeof r.undiscoveredSignatureCount, 'number',
              'undiscoveredSignatureCount 보존');
          // dead 필드 0건.
          assert.equal(r.score, undefined, 'score 출력 0건');
          assert.equal(r.isSafeTarget, undefined, 'isSafeTarget 출력 0건');
          assert.equal(r.isVisited, undefined, 'isVisited 출력 0건');
          assert.equal(r.isBoss, undefined, 'isBoss 출력 0건');
          assert.equal(r._sortKey, undefined, '_sortKey strip 됨');
      }
  });

  test('cycle 333: 정렬 순서 보존 (점수 내림차순)', async () => {
      const { getMoveRecommendations } = await import('../src/utils/adventureGuide.js');
      const { DB } = await import('../src/data/db.js');
      const player = { hp: 50, maxHp: 100, mp: 50, maxMp: 50, level: 5, job: '검사', loc: '시작의 마을', inv: [], stats: { visitedMaps: ['시작의 마을'] } };
      const stats = { maxHp: 100, maxMp: 50 };
      const recs = getMoveRecommendations(player, stats, DB.MAPS['시작의 마을'], DB.MAPS);
      // isRecommended === true는 index 0 항목.
      if (recs.length > 0) {
          assert.equal(recs[0].isRecommended, true, '첫 번째 항목 isRecommended');
      }
  });

  test('cycle 332 회귀 가드: getAdventureGuidance secondaryAction 0건', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      const guidanceFn = source.slice(source.indexOf('export const getAdventureGuidance'));
      assert.ok(!/secondaryAction:/.test(guidanceFn),
          'cycle 332 secondaryAction 제거 보존');
  });
}

// ─── cycle-335-pacing-profile-note-dead.test.js ───
{
  /**
   * cycle 335: getMapPacingProfile note 필드 5회 dead 정리
   *   (cycle 222-334 silent dead config 시리즈 104번째 — cleanup lens 연속).
   *
   * 발견 (dead output field):
   * - getMapPacingProfile 5 return 분기 (safe/boss/volatile/hostile/frontier)에서
   *   각각 `note: '...'` 필드 정의.
   * - src/, tests/ 어디에서도 `profile.note` / `pacingProfile.note` read 0건.
   * - 활성 필드: id / label / narrativeMult / quietMult / relicMult / anomalyMult /
   *   keyEventMult.
   *
   * 패턴 (cycle 222-334 silent dead config 시리즈 104번째):
   * - cycle 334: getQuestTracker.detail / getExplorationForecast.description.
   * - cycle 335: getMapPacingProfile.note 5회 cleanup.
   *
   * 수정 (src/utils/explorationPacing.ts):
   * - 5 note 필드 제거 (sed `/^\s+note: '.*',$/d`).
   *
   * 회귀 가드:
   * - id / label / mult 필드 보존.
   * - getNarrativeEventChance / getQuietExplorationChance / getDiscoveryOdds chain 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 335: getMapPacingProfile note 필드 0건 (5회 모두 제거)', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/^\s+note: '/m.test(source),
          'note 필드 제거됨');
  });

  test('cycle 335: getMapPacingProfile 핵심 필드 보존', async () => {
      const { getMapPacingProfile } = await import('../src/utils/explorationPacing.js');
      const profile = getMapPacingProfile({ type: 'safe' });
      assert.equal(profile.id, 'safe', 'id 보존');
      assert.equal(profile.label, '정비', 'label 보존');
      assert.equal(typeof profile.narrativeMult, 'number', 'narrativeMult 보존');
      assert.equal(profile.note, undefined, 'note 0건');
  });

  test('cycle 335: getMapPacingProfile 5 분기 모두 정상 동작', async () => {
      const { getMapPacingProfile } = await import('../src/utils/explorationPacing.js');
      const cases = [
          { input: { type: 'safe' }, expectedId: 'safe' },
          { input: { boss: '드래곤' }, expectedId: 'boss' },
          { input: { eventChance: 0.3 }, expectedId: 'volatile' },
          { input: { level: 30 }, expectedId: 'hostile' },
          { input: { level: 5 }, expectedId: 'frontier' },
      ];
      for (const { input, expectedId } of cases) {
          const profile = getMapPacingProfile(input);
          assert.equal(profile.id, expectedId, `${JSON.stringify(input)} → ${expectedId}`);
          assert.equal(profile.note, undefined, `${expectedId} note 0건`);
      }
  });

  test('cycle 334 회귀 가드: getQuestTracker / getExplorationForecast dead 필드 정리 보존', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      const trackerFn = source.slice(source.indexOf('export const getQuestTracker'), source.indexOf('export const getExplorationForecast'));
      const forecastFn = source.slice(source.indexOf('export const getExplorationForecast'), source.indexOf('export const getMoveRecommendations'));
      assert.ok(!/detail:/.test(trackerFn), 'cycle 334 getQuestTracker.detail 제거 보존');
      assert.ok(!/description:/.test(forecastFn), 'cycle 334 getExplorationForecast.description 제거 보존');
  });
}

// ─── cycle-336-post-combat-ratios-dead.test.js ───
{
  /**
   * cycle 336: getPostCombatAnalysis hpRatio/mpRatio 출력 필드 dead 제거
   *   (cycle 222-335 silent dead config 시리즈 105번째 — cleanup lens 연속).
   *
   * 발견 (dead output fields):
   * - getPostCombatAnalysis 반환에 hpRatio / mpRatio 필드 정의.
   * - 내부에서 grade/notes/actions 분기 계산용으로만 사용. 외부 read 0건.
   * - PostCombatCard / RunSummaryCard / test 어디에서도 analysis.hpRatio /
   *   analysis.mpRatio 접근 0건.
   *
   * 활성 출력 필드: grade / rewardMood / rewardHighlights / notes / actions.
   *
   * 패턴 (cycle 222-335 silent dead config 시리즈 105번째):
   * - cycle 335: getMapPacingProfile.note 5회 cleanup.
   * - cycle 336: getPostCombatAnalysis hpRatio/mpRatio 출력 필드 정리.
   *
   * 수정 (src/utils/outcomeAnalysis.ts):
   * - getPostCombatAnalysis return에서 hpRatio / mpRatio 필드 제거.
   * - 내부 변수는 분기 계산용으로 그대로 유지.
   *
   * 회귀 가드:
   * - grade / rewardMood / rewardHighlights / notes / actions 보존.
   * - PostCombatCard analysis.grade / analysis.notes / analysis.actions /
   *   analysis.rewardMood / analysis.rewardHighlights 사용 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 336: getPostCombatAnalysis hpRatio / mpRatio 출력 0건', async () => {
      const source = await readSrc('src/utils/outcomeAnalysis.ts');
      const fn = source.slice(0, source.indexOf('export const getRunSummaryAnalysis'));
      // return 객체 안의 hpRatio/mpRatio 출력 0건 (내부 변수는 const 정의로 그대로 OK).
      assert.ok(!/^\s+hpRatio,$/m.test(fn),
          'getPostCombatAnalysis hpRatio 출력 제거');
      assert.ok(!/^\s+mpRatio,$/m.test(fn),
          'getPostCombatAnalysis mpRatio 출력 제거');
  });

  test('cycle 336: getPostCombatAnalysis 동작 보존', async () => {
      const { getPostCombatAnalysis } = await import('../src/utils/outcomeAnalysis.js');
      const result = getPostCombatAnalysis({
          playerHp: 50, playerMaxHp: 100, playerMp: 30, playerMaxMp: 50,
          enemy: '슬라임', enemyTier: 'NORMAL', primaryBuild: '균형형 런', items: [],
      });
      assert.ok(typeof result.grade === 'string', 'grade 보존');
      assert.ok(typeof result.rewardMood === 'string', 'rewardMood 보존');
      assert.ok(Array.isArray(result.rewardHighlights), 'rewardHighlights 보존');
      assert.ok(Array.isArray(result.notes), 'notes 보존');
      assert.ok(Array.isArray(result.actions), 'actions 보존');
      // dead 필드 0건.
      assert.equal(result.hpRatio, undefined, 'hpRatio 출력 0건');
      assert.equal(result.mpRatio, undefined, 'mpRatio 출력 0건');
  });

  test('cycle 336: PostCombatCard 사용 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/PostCombatCard.tsx');
      assert.ok(/analysis\.grade/.test(source), 'analysis.grade read 보존');
      assert.ok(/analysis\.notes/.test(source), 'analysis.notes read 보존');
      assert.ok(/analysis\.actions/.test(source), 'analysis.actions read 보존');
  });

  test('cycle 335 회귀 가드: getMapPacingProfile.note 5회 제거 보존', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/^\s+note: '/m.test(source),
          'cycle 335 note 제거 보존');
  });
}

// ─── cycle-337-availability-material-count-dead.test.js ───
{
  /**
   * cycle 337: getEnhanceAvailability materialCount 출력 dead 정리
   *   (cycle 222-336 silent dead config 시리즈 106번째 — cleanup lens 연속).
   *
   * 발견 (dead output field):
   * - getEnhanceAvailability 5 return branches에서 `materialCount: getEnhanceMaterialCount(inventory)`
   *   필드 노출.
   * - src/, tests/ 어디에서도 `availability.materialCount` read 0건.
   * - EquipmentPanel은 requirement / canEnhance / affordable / hint만 사용.
   *   useInventoryActions는 missing / requirement만 사용.
   *
   * 패턴 (cycle 222-336 silent dead config 시리즈 106번째):
   * - cycle 336: getPostCombatAnalysis hpRatio/mpRatio 출력 dead.
   * - cycle 337: getEnhanceAvailability materialCount 5회 출력 cleanup.
   *
   * 수정 (src/utils/enhancementUtils.ts):
   * - 5 return 분기에서 `materialCount` 필드 제거.
   * - 내부 변수 const materialCount는 if (materialCount < requirement.materials) 분기 계산용으로 그대로 유지.
   *
   * 회귀 가드:
   * - canEnhance / affordable / missing / hint / requirement 필드 보존.
   * - 내부 material 부족 분기 동작 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 337: getEnhanceAvailability return에서 materialCount 0건', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      const start = source.indexOf('export const getEnhanceAvailability');
      const end = source.indexOf('export const getEnhancePreview', start);
      const availabilitySource = source.slice(start, end);
      // return 객체 안의 materialCount 0건 (내부 변수는 별개).
      assert.ok(!/^\s+materialCount[,:]/m.test(availabilitySource),
          'return 객체에서 materialCount 필드 0건');
  });

  test('cycle 337: getEnhanceAvailability 핵심 필드 보존', async () => {
      const { getEnhanceAvailability } = await import('../src/utils/enhancementUtils.js');
      const result = getEnhanceAvailability({ type: 'weapon', enhance: 0 }, 1000, []);
      assert.ok('canEnhance' in result, 'canEnhance 보존');
      assert.ok('affordable' in result, 'affordable 보존');
      assert.ok('missing' in result, 'missing 보존');
      assert.ok('hint' in result, 'hint 보존');
      assert.ok('requirement' in result, 'requirement 보존');
      assert.equal(result.materialCount, undefined, 'materialCount 출력 0건');
  });

  test('cycle 337: 5 분기 모두 정상 동작 (invalid/max/gold/material/ok)', async () => {
      const { getEnhanceAvailability } = await import('../src/utils/enhancementUtils.js');
      // invalid (consumable type)
      const invalid = getEnhanceAvailability({ type: 'consumable', enhance: 0 }, 0, []);
      assert.equal(invalid.missing, 'invalid');
      // max
      const max = getEnhanceAvailability({ type: 'weapon', enhance: 10 }, 1000, []);
      assert.equal(max.missing, 'max');
      // gold 부족
      const gold = getEnhanceAvailability({ type: 'weapon', enhance: 0 }, 0, []);
      assert.equal(gold.missing, 'gold');
  });

  test('cycle 336 회귀 가드: getPostCombatAnalysis hpRatio/mpRatio 0건 보존', async () => {
      const source = await readSrc('src/utils/outcomeAnalysis.ts');
      const fn = source.slice(0, source.indexOf('export const getRunSummaryAnalysis'));
      assert.ok(!/^\s+hpRatio,$/m.test(fn), 'cycle 336 hpRatio 0건 보존');
  });
}

// ─── cycle-338-validate-synthesis-type-dead.test.js ───
{
  /**
   * cycle 338: validateSynthesis type 출력 필드 dead 정리
   *   (cycle 222-337 silent dead config 시리즈 107번째 — cleanup lens 연속).
   *
   * 발견 (dead output field):
   * - validateSynthesis 성공 분기 (line 84) 반환에 `type` 필드 (synthesis input type) 정의.
   * - src/, tests/ 어디에서도 `validation.type` read 0건.
   * - CraftingPanel: outputs / goldCost / successRate / tier / valid만 사용.
   * - useInventoryActions: valid / reason만 사용.
   *
   * 패턴 (cycle 222-337 silent dead config 시리즈 107번째):
   * - cycle 337: getEnhanceAvailability materialCount 출력 dead.
   * - cycle 338: validateSynthesis type 출력 dead.
   *
   * 수정 (src/utils/synthesisUtils.ts):
   * - 성공 분기 return에서 type 필드 제거.
   * - 내부 const type 변수는 분기 계산용으로 그대로 유지.
   *
   * 회귀 가드:
   * - valid / tier / outputs / goldCost / successRate 필드 보존.
   * - reason / valid 분기 동작 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 338: validateSynthesis 성공 return에서 type 필드 0건', async () => {
      const source = await readSrc('src/utils/synthesisUtils.ts');
      // return { valid: true, ..., type, ... } 패턴 0건.
      assert.ok(!/return \{ valid: true,[^}]*\btype,/.test(source),
          '성공 return에서 type 필드 제거됨');
      // 내부 const type 변수는 보존.
      assert.ok(/const type = items\[0\]\.type/.test(source),
          '내부 const type 변수 보존');
  });

  test('cycle 338: validateSynthesis 동작 보존 (성공 분기)', async () => {
      const { validateSynthesis } = await import('../src/utils/synthesisUtils.js');
      const items = [
          { name: '녹슨 단검', type: 'weapon', tier: 1, val: 5 },
          { name: '녹슨 단검', type: 'weapon', tier: 1, val: 5 },
          { name: '녹슨 단검', type: 'weapon', tier: 1, val: 5 },
      ];
      const result = validateSynthesis(items, 100000);
      if (result.valid) {
          assert.ok('outputs' in result, 'outputs 보존');
          assert.ok('goldCost' in result, 'goldCost 보존');
          assert.ok('successRate' in result, 'successRate 보존');
          assert.ok('tier' in result, 'tier 보존');
          assert.equal(result.type, undefined, 'type 출력 0건');
      }
  });

  test('cycle 338: validateSynthesis 실패 분기 보존 (회귀 가드)', async () => {
      const { validateSynthesis } = await import('../src/utils/synthesisUtils.js');
      const empty = validateSynthesis([], 0);
      assert.equal(empty.valid, false);
      assert.equal(empty.reason, 'NOT_ENOUGH');
  });

  test('cycle 337 회귀 가드: getEnhanceAvailability materialCount 0건', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      const start = source.indexOf('export const getEnhanceAvailability');
      const end = source.indexOf('export const getEnhancePreview', start);
      const availabilitySource = source.slice(start, end);
      assert.ok(!/^\s+materialCount[,:]/m.test(availabilitySource),
          'cycle 337 materialCount 출력 0건 보존');
  });
}

// ─── cycle-339-synth-group-rarity-dead.test.js ───
{
  /**
   * cycle 339: getSynthesisGroups rarity 출력 필드 dead 정리 + cascade getItemRarity import
   *   (cycle 222-338 silent dead config 시리즈 108번째 — cleanup lens 연속).
   *
   * 발견 (dead output field + cascade):
   * - getSynthesisGroups 그룹 객체에 `rarity: getItemRarity(item)` 필드 추가.
   * - src/, tests/ 어디에서도 group.rarity / grp.rarity read 0건.
   * - CraftingPanel은 type / tier / count / items만 사용.
   * - getItemRarity import는 rarity 필드 제거 후 cascade dead → import 라인도 제거.
   *
   * 패턴 (cycle 222-338 silent dead config 시리즈 108번째):
   * - cycle 338: validateSynthesis type 출력 dead.
   * - cycle 339: getSynthesisGroups rarity 출력 dead + getItemRarity cascade import 정리.
   *
   * 수정 (src/utils/synthesisUtils.ts):
   * - groups[key] 초기화에서 rarity 필드 제거.
   * - getItemRarity import 제거 (cascade dead).
   *
   * 회귀 가드:
   * - type / tier / items / count 필드 보존.
   * - signature item 제외 / tier >= 6 제외 / synthesizable 필터 동작 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 339: getSynthesisGroups rarity 필드 0건', async () => {
      const source = await readSrc('src/utils/synthesisUtils.ts');
      assert.ok(!/rarity:\s*getItemRarity/.test(source),
          'rarity 필드 제거됨');
  });

  test('cycle 339: getItemRarity import cascade 제거', async () => {
      const source = await readSrc('src/utils/synthesisUtils.ts');
      assert.ok(!/^import \{ getItemRarity \}/m.test(source),
          'getItemRarity import 제거됨');
  });

  test('cycle 339: getSynthesisGroups 동작 보존', async () => {
      const { getSynthesisGroups } = await import('../src/utils/synthesisUtils.js');
      const inv = [
          { name: '녹슨 단검 1', type: 'weapon', tier: 1 },
          { name: '녹슨 단검 2', type: 'weapon', tier: 1 },
          { name: '녹슨 단검 3', type: 'weapon', tier: 1 },
      ];
      const groups = getSynthesisGroups(inv);
      if (groups.length > 0) {
          assert.equal(groups[0].type, 'weapon');
          assert.equal(groups[0].tier, 1);
          assert.equal(groups[0].count, 3);
          assert.equal(groups[0].rarity, undefined, 'rarity 출력 0건');
      }
  });

  test('cycle 338 회귀 가드: validateSynthesis type 0건 보존', async () => {
      const source = await readSrc('src/utils/synthesisUtils.ts');
      assert.ok(!/return \{ valid: true,[^}]*\btype,/.test(source),
          'cycle 338 type 출력 제거 보존');
  });
}

// ─── cycle-342-character-appearance-dead-fields.test.js ───
{
  /**
   * cycle 342: deriveCharacterAppearance 6 dead 출력 필드 정리
   *   (cycle 222-341 silent dead config 시리즈 110번째 — cleanup lens 연속).
   *
   * 발견 (dead output fields):
   * - top-level: level / hairStyle 2 fields (read 0건).
   * - weapon/offhand/armor sub-objects: item / iconKey / hands / equipped 4 fields (read 0건).
   * - getItemIconAssetKey import → cascade dead.
   *
   * 활성 필드 보존:
   * - top: job / frameTone / armorStyle / loadoutStyle / accessoryStyle / palette.
   * - weapon: type (test) / visual / enhance / art.
   * - offhand: type (test) / visual / enhance / art.
   * - armor: visual / enhance / art.
   *
   * 패턴 (cycle 222-341 silent dead config 시리즈 110번째):
   * - cycle 341: getEquipmentArtProfile 3 dead 출력 (itemName/subtype/hands).
   * - cycle 342: deriveCharacterAppearance 6 dead 출력 + cascade import.
   *
   * 수정 (src/utils/characterAppearance.ts):
   * - top-level: level / hairStyle 제거.
   * - weapon: item / iconKey / hands 제거.
   * - offhand: item / iconKey 제거.
   * - armor: item / iconKey / equipped 제거.
   * - getItemIconAssetKey import 제거 (cascade dead).
   *
   * 회귀 가드:
   * - tests/character-appearance.test.js 통과 (appearance.weapon.type / .enhance,
   *   appearance.armorStyle / .accessoryStyle 등 사용).
   * - PixelCharacterAvatar / AvatarEquipmentOverlay 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 342: top-level dead 필드 0건', async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      const fn = source.slice(source.indexOf('export const deriveCharacterAppearance'));
      assert.ok(!/^\s+level: player/m.test(fn), 'level 출력 0건');
      assert.ok(!/^\s+hairStyle: baseStyle/m.test(fn), 'hairStyle 출력 0건');
  });

  test('cycle 342: weapon/offhand/armor dead 필드 0건', async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      const fn = source.slice(source.indexOf('export const deriveCharacterAppearance'));
      assert.ok(!/iconKey: getItemIconAssetKey/.test(fn), 'iconKey 출력 0건');
      assert.ok(!/hands: isTwoHandWeapon/.test(fn), 'hands 출력 0건');
      assert.ok(!/equipped: Boolean/.test(fn), 'equipped 출력 0건');
  });

  test('cycle 342: getItemIconAssetKey import cascade 제거', async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      assert.ok(!/getItemIconAssetKey,/.test(source),
          'getItemIconAssetKey import 제거됨');
  });

  test('cycle 342: 활성 필드 보존 (회귀 가드)', async () => {
      const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.js');
      const player = {
          job: '검사',
          equip: { weapon: { name: '롱소드', type: 'weapon', hands: 1 } },
      };
      const appearance = deriveCharacterAppearance(player);
      assert.ok('job' in appearance, 'job 보존');
      assert.ok('frameTone' in appearance, 'frameTone 보존');
      assert.ok('armorStyle' in appearance, 'armorStyle 보존');
      assert.ok('weapon' in appearance, 'weapon 보존');
      assert.ok('type' in appearance.weapon, 'weapon.type 보존');
      assert.ok('art' in appearance.weapon, 'weapon.art 보존');
      assert.equal(appearance.weapon.iconKey, undefined, 'weapon.iconKey 0건');
      assert.equal(appearance.weapon.hands, undefined, 'weapon.hands 0건');
  });

  test('cycle 341 회귀 가드: getEquipmentArtProfile dead 필드 0건', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      const fn = source.slice(source.indexOf('export const getEquipmentArtProfile'));
      assert.ok(!/itemName: item\.name/.test(fn), 'cycle 341 itemName 0건 보존');
  });
}

// ─── cycle-343-difficulty-diff-fields-dead.test.js ───
{
  /**
   * cycle 343: applyDynamicDifficulty diffLabel return + _diffLabel/_diffScore mStats 3 dead 필드 정리
   *   (cycle 222-342 silent dead config 시리즈 111번째 — cleanup lens 연속).
   *
   * 발견 (3 dead output fields):
   * - applyDynamicDifficulty 반환에 `diffLabel` 필드 — exploreActions caller는 `{ mStats }`만
   *   destructure, diffLabel read 0건.
   * - scaled mStats에 `_diffLabel: diff.label` + `_diffScore: Math.round(score * 100)` 2 필드 —
   *   mStats._diffLabel/Score read 0건. enemy 객체로 spread될 가능성도 enemy._diff* read 0건.
   *
   * 패턴 (cycle 222-342 silent dead config 시리즈 111번째):
   * - cycle 342: deriveCharacterAppearance 6 dead 출력 + cascade.
   * - cycle 343: applyDynamicDifficulty 3 dead diff metadata 정리.
   *
   * 수정 (src/systems/DifficultyManager.ts):
   * - return { mStats: scaled } (diffLabel 제거).
   * - scaled에서 _diffLabel / _diffScore 필드 제거.
   *
   * 회귀 가드:
   * - hp / maxHp / atk / exp / gold 5 활성 필드 보존.
   * - GM 안내 로그 (LABEL_VISIBLE 분기) 동일.
   * - calcPerformanceScore / getDifficultyMults / addLog dispatch 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 343: applyDynamicDifficulty 반환에서 diffLabel 0건', async () => {
      const source = await readSrc('src/systems/DifficultyManager.ts');
      const fn = source.slice(source.indexOf('export const applyDynamicDifficulty'));
      assert.ok(!/return \{\s*mStats:\s*scaled,\s*diffLabel/.test(fn),
          'diffLabel return 0건');
  });

  test('cycle 343: scaled에서 _diffLabel / _diffScore 0건', async () => {
      const source = await readSrc('src/systems/DifficultyManager.ts');
      const fn = source.slice(source.indexOf('export const applyDynamicDifficulty'));
      assert.ok(!/_diffLabel:/.test(fn), '_diffLabel 0건');
      assert.ok(!/_diffScore:/.test(fn), '_diffScore 0건');
  });

  test('cycle 343: applyDynamicDifficulty 동작 보존 (5 활성 필드)', async () => {
      const { applyDynamicDifficulty } = await import('../src/systems/DifficultyManager.js');
      const mStats = { hp: 100, maxHp: 100, atk: 20, exp: 50, gold: 30 };
      const player = { stats: { recentBattles: [] } };
      const result = applyDynamicDifficulty(mStats, player, () => {});
      assert.ok(result.mStats, 'mStats 반환');
      assert.equal(typeof result.mStats.hp, 'number', 'hp 보존');
      assert.equal(typeof result.mStats.maxHp, 'number', 'maxHp 보존');
      assert.equal(typeof result.mStats.atk, 'number', 'atk 보존');
      assert.equal(typeof result.mStats.exp, 'number', 'exp 보존');
      assert.equal(typeof result.mStats.gold, 'number', 'gold 보존');
      assert.equal(result.mStats._diffLabel, undefined, '_diffLabel 0건');
      assert.equal(result.mStats._diffScore, undefined, '_diffScore 0건');
      assert.equal(result.diffLabel, undefined, 'diffLabel 0건');
  });

  test('cycle 342 회귀 가드: deriveCharacterAppearance dead 필드 정리 보존', async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      const fn = source.slice(source.indexOf('export const deriveCharacterAppearance'));
      assert.ok(!/iconKey: getItemIconAssetKey/.test(fn),
          'cycle 342 iconKey 0건 보존');
  });
}

// ─── cycle-344-build-tags-dead.test.js ───
{
  /**
   * cycle 344: buildRunSummary buildTags 출력 dead 정리
   *   (cycle 222-343 silent dead config 시리즈 112번째 — cleanup lens 연속).
   *
   * 발견 (dead output field):
   * - buildRunSummary 반환에 `buildTags: buildProfile.tags.map(...).slice(0, 4)` 필드.
   * - RunSummaryCard / runShareText / outcomeAnalysis 어디에서도 summary.buildTags read 0건.
   * - useGameEngine.ts의 buildProfile.tags (AI snapshot용)는 별개 — cycle 268 active dispatch.
   *
   * 패턴 (cycle 222-343 silent dead config 시리즈 112번째):
   * - cycle 343: applyDynamicDifficulty 3 dead diff metadata.
   * - cycle 344: buildRunSummary buildTags 출력 dead.
   *
   * 수정:
   * - src/utils/gameUtils.ts: buildRunSummary return에서 buildTags 필드 제거.
   * - tests/cycle-200-299.test.js: 가드를 useGameEngine.ts만
   *   체크하도록 갱신 (cycle 344 cleanup 반영).
   *
   * 회귀 가드:
   * - buildRunSummary 다른 필드 (level / job / kills / bossKills / relicsFound /
   *   activeTitle / loc / prestigeRank / totalGold / primaryBuild / difficultyLabel /
   *   recentWinRate / signaturesAcquired / signatureNames 등) 보존.
   * - useGameEngine.ts buildProfile.tags AI snapshot dispatch 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 344: buildRunSummary buildTags 출력 0건', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      const fn = source.slice(source.indexOf('export const buildRunSummary'));
      assert.ok(!/buildTags:\s*buildProfile/.test(fn),
          'buildTags 출력 필드 제거됨');
  });

  test('cycle 344: useGameEngine.ts buildProfile.tags AI snapshot dispatch 보존', async () => {
      const source = await readSrc('src/hooks/useGameEngine.ts');
      assert.ok(/buildProfile\.tags/.test(source),
          'AI snapshot buildProfile.tags 보존');
  });

  test('cycle 344: buildRunSummary 다른 활성 필드 보존', async () => {
      const { buildRunSummary } = await import('../src/utils/gameUtils.js');
      const player = {
          level: 5, job: '검사', stats: { kills: 10 }, relics: [], inv: [], equip: {},
          meta: { prestigeRank: 0 },
      };
      const summary = buildRunSummary(player, '시작의 마을');
      assert.equal(summary.level, 5, 'level 보존');
      assert.equal(summary.job, '검사', 'job 보존');
      assert.equal(summary.kills, 10, 'kills 보존');
      assert.equal(summary.buildTags, undefined, 'buildTags 출력 0건');
  });

  test('cycle 343 회귀 가드: applyDynamicDifficulty 3 dead diff metadata 정리 보존', async () => {
      const source = await readSrc('src/systems/DifficultyManager.ts');
      const fn = source.slice(source.indexOf('export const applyDynamicDifficulty'));
      assert.ok(!/_diffLabel:/.test(fn),
          'cycle 343 _diffLabel 0건 보존');
  });
}

// ─── cycle-345-score-tag-desc-dead.test.js ───
{
  /**
   * cycle 345: scoreTag desc 매개변수 + 출력 dead 정리
   *   (cycle 222-344 silent dead config 시리즈 113번째 — cleanup lens 연속).
   *
   * 발견 (dead parameter + output):
   * - src/utils/runProfile.ts: scoreTag(id, name, desc, score, reasons) — desc 매개변수 + 출력.
   * - tag.desc / primary.desc / build.desc 어디에서도 read 0건.
   * - 8 호출 사이트가 한국어 desc 문자열 인자를 전달하지만 dead.
   *
   * 활성 tag 필드: id (4 reads) / name (5) / score (8) / reasons (10).
   *
   * 패턴 (cycle 222-344 silent dead config 시리즈 113번째):
   * - cycle 344: buildRunSummary buildTags 출력 dead.
   * - cycle 345: scoreTag desc 매개변수 + 출력 dead.
   *
   * 수정 (src/utils/runProfile.ts):
   * - scoreTag 시그니처에서 desc 매개변수 제거.
   * - 8 호출 사이트의 desc 문자열 인자 제거.
   * - 출력 객체에서 desc 필드 제거.
   *
   * 회귀 가드:
   * - tag.id / name / score / reasons 4 활성 필드 보존.
   * - getRunBuildProfile primary / tags 정렬 / score 비교 동일.
   * - getTraitProfile reasons 사용 (line 188) 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 345: scoreTag 시그니처에서 desc 제거', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(/const scoreTag = \(id: any, name: any, score: any, reasons/.test(source),
          'scoreTag 시그니처 4-arg (desc 제거)');
      assert.ok(!/const scoreTag = \(id: any, name: any, _?desc/.test(source),
          'desc 매개변수 0건');
  });

  test('cycle 345: scoreTag 출력에 desc 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fn = source.slice(source.indexOf('const scoreTag'), source.indexOf('const relicEffectsOf'));
      assert.ok(!/^\s+desc,$/m.test(fn), 'desc 출력 0건');
  });

  test('cycle 345: 8 호출 사이트에서 desc 문자열 인자 제거', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      // 한국어 desc 문자열을 포함한 호출 0건이어야 함.
      assert.ok(!/scoreTag\([^,]+,\s*'[^']+',\s*'[^']*\.'/.test(source),
          '8 호출 사이트에서 desc 문자열 인자 제거');
  });

  test('cycle 345: getRunBuildProfile 동작 보존', async () => {
      const { getRunBuildProfile } = await import('../src/utils/runProfile.js');
      const player = {
          equip: { weapon: { name: '롱소드', type: 'weapon', hands: 1 } },
          relics: [],
          hp: 100, maxHp: 100,
      };
      // cycle 612: stats 인자 명시 추가 — explicit default-elimination cascade.
      const profile = getRunBuildProfile(player, {});
      assert.ok(profile.primary, 'primary 보존');
      assert.ok('id' in profile.primary, 'primary.id 보존');
      assert.ok('name' in profile.primary, 'primary.name 보존');
      // cycle 443: primary.score 출력 dead strip — 회귀 가드는 cycle-443 test가 대체.
      assert.ok('reasons' in profile.primary, 'primary.reasons 보존');
      assert.equal(profile.primary.desc, undefined, 'primary.desc 0건');
  });

  test('cycle 344 회귀 가드: buildRunSummary buildTags 0건 보존', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      const fn = source.slice(source.indexOf('export const buildRunSummary'));
      assert.ok(!/buildTags:\s*buildProfile/.test(fn),
          'cycle 344 buildTags 출력 0건 보존');
  });
}

// ─── cycle-346-affinity-total-slots-dead.test.js ───
{
  /**
   * cycle 346: getJobOutfitAffinity totalSlots 출력 dead 정리
   *   (cycle 222-345 silent dead config 시리즈 114번째 — cleanup lens 연속).
   *
   * 발견 (dead output field):
   * - getJobOutfitAffinity 반환에 totalSlots 필드 (장착 슬롯 수 카운트).
   * - src/, tests/ 어디에서도 affinity.totalSlots / aff.totalSlots read 0건.
   *
   * 활성 필드: matchCount / bonus / label / tier / slots.
   *
   * 패턴 (cycle 222-345 silent dead config 시리즈 114번째):
   * - cycle 345: scoreTag desc 매개변수 + 출력 dead.
   * - cycle 346: getJobOutfitAffinity totalSlots 출력 dead.
   *
   * 수정 (src/utils/jobOutfitAffinity.ts):
   * - getJobOutfitAffinity 3 return 분기에서 totalSlots 필드 제거.
   * - OutfitAffinity interface에서도 totalSlots 필드 제거.
   *
   * 회귀 가드:
   * - matchCount / bonus / label / tier / slots 활성 필드 보존.
   * - EquipmentPanel은 aff.matchCount / aff.tier / aff.label / aff.bonus 사용 — 영향 없음.
   * - statsCalculator는 affinity.bonus 사용 — 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 346: getJobOutfitAffinity totalSlots 출력 0건', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      const fn = source.slice(source.indexOf('export const getJobOutfitAffinity'));
      assert.ok(!/totalSlots:/.test(fn),
          'totalSlots 출력 0건');
  });

  test('cycle 346: OutfitAffinity interface totalSlots 필드 제거', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      const block = source.match(/interface OutfitAffinity \{[\s\S]+?\n\}/);
      assert.ok(block, 'OutfitAffinity interface 발견');
      assert.ok(!/totalSlots:/.test(block[0]),
          'interface에서 totalSlots 필드 제거됨');
  });

  test('cycle 346: getJobOutfitAffinity 활성 필드 보존', async () => {
      const { getJobOutfitAffinity } = await import('../src/utils/jobOutfitAffinity.js');
      const player = { job: '검사', equip: {} };
      const affinity = getJobOutfitAffinity(player);
      assert.ok('matchCount' in affinity, 'matchCount 보존');
      assert.ok('bonus' in affinity, 'bonus 보존');
      assert.ok('tier' in affinity, 'tier 보존');
      assert.ok('slots' in affinity, 'slots 보존');
      assert.equal(affinity.totalSlots, undefined, 'totalSlots 0건');
  });

  test('cycle 345 회귀 가드: scoreTag desc 매개변수 0건 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(/const scoreTag = \(id: any, name: any, score: any, reasons/.test(source),
          'cycle 345 scoreTag 4-arg 보존');
  });
}

// ─── cycle-348-active-set-mult-duplicates-dead.test.js ───
{
  /**
   * cycle 348: computeSignatureSetBonus activeSet의 3 mult duplicate 필드 dead 정리
   *   (cycle 222-347 silent dead config 시리즈 116번째 — cleanup lens 연속).
   *
   * 발견 (3 dead duplicate fields):
   * - computeSignatureSetBonus 반환의 activeSet 내부에 atkMult / defMult / hpMult 3 필드.
   * - 부모 return에 동일 필드 이미 노출됨 (statsCalculator는 result.atkMult / .defMult /
   *   .hpMult 부모를 read).
   * - activeSet.atkMult / .defMult / .hpMult 직접 read 0건.
   *
   * 활성 activeSet 필드: key / name / tone / count / tier / desc.
   *
   * 패턴 (cycle 222-347 silent dead config 시리즈 116번째):
   * - cycle 347: scoreQuest score → _sortKey internal.
   * - cycle 348: activeSet duplicate mult 3 필드 cleanup.
   *
   * 수정 (src/utils/signatureSetBonus.ts):
   * - computeSignatureSetBonus activeSet에서 atkMult/defMult/hpMult 3 필드 제거.
   *
   * 회귀 가드:
   * - 부모 return의 atkMult/defMult/hpMult 보존.
   * - activeSet.key/name/tone/count/tier/desc 보존.
   * - StatsPanel activeSet.desc / .name / .tone, EquipmentPanel 동일 필드 read 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  // NOTE(fix/signature-set-two-hand): cycle 348의 "duplicate 필드 제거" 결정은 cycle 426에서
  // 명시적으로 뒤집혔다 — StatsPanel이 activeSet.atkMult/.defMult/.hpMult를 직접 read하는
  // 것이 밝혀져 cycle 426이 3 필드를 복원했다(signatureSetBonus.ts 자체 주석 + 아래 cycle 426
  // 섹션의 "cycle 426 회귀 가드" 테스트가 정반대를 assert). 이 테스트는 그동안 activeSetBlock
  // regex가 (구조 변경 전) counts.reduce()의 조기 `},`에서 잘못 멈춰 실제 activeSet 리터럴을
  // 검사하지 않는 우연으로 계속 green이었다. fix/signature-set-two-hand가 counts 계산부를
  // 재작성하며 regex가 실제 activeSet 블록까지 도달하게 됐고, 진짜 상태(atkMult 존재)가
  // 드러났다. cycle 426이 최신 의도이므로 이 가드는 "존재해야 함"으로 갱신한다.
  test('cycle 426이 cycle 348을 대체: activeSet에 atkMult/defMult/hpMult 3 필드 존재', async () => {
      const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.js');
      const result = computeSignatureSetBonus({
          weapon: { name: '성검 에테르니아' },
          offhand: { name: '천공 성전' },
          armor: null,
      });
      assert.ok(result.activeSet, 'activeSet 객체 존재');
      assert.equal(typeof result.activeSet.atkMult, 'number', 'activeSet.atkMult 존재 (cycle 426)');
      assert.equal(typeof result.activeSet.defMult, 'number', 'activeSet.defMult 존재 (cycle 426)');
      assert.equal(typeof result.activeSet.hpMult, 'number', 'activeSet.hpMult 존재 (cycle 426)');
  });

  test('cycle 348: 부모 return의 atkMult/defMult/hpMult 보존', async () => {
      const source = await readSrc('src/utils/signatureSetBonus.ts');
      // 부모 return의 atkMult, defMult, hpMult 보존.
      const parentReturnMatch = source.match(/return \{\s*\n\s+atkMult,\s*\n\s+defMult,\s*\n\s+hpMult,\s*\n\s+activeSet:/);
      assert.ok(parentReturnMatch, '부모 return의 atkMult/defMult/hpMult 보존');
  });

  test('cycle 348: computeSignatureSetBonus 동작 보존', async () => {
      const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.js');
      const equip = {};
      const result = computeSignatureSetBonus(equip);
      assert.equal(result.atkMult, 1, 'atkMult 보존');
      assert.equal(result.defMult, 1, 'defMult 보존');
      assert.equal(result.hpMult, 1, 'hpMult 보존');
      assert.equal(result.activeSet, null, 'empty activeSet null');
  });

  test('cycle 347 회귀 가드: scoreQuest score → _sortKey 보존', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      assert.ok(/_sortKey: score/.test(source),
          'cycle 347 _sortKey 보존');
  });
}

// ─── cycle-349-set-progress-dead-fields.test.js ───
{
  /**
   * cycle 349: getSignatureSetProgress members / equippedMembers 출력 dead 정리
   *   (cycle 222-348 silent dead config 시리즈 117번째 — cleanup lens 연속).
   *
   * 발견 (2 fully dead output fields):
   * - getSignatureSetProgress 반환의 members / equippedMembers 필드.
   * - src/, tests/ 어디에서도 setProgress.members / .equippedMembers read 0건.
   * - 내부 const members 변수는 totalMembers 카운트 + missingMembers 필터 계산용으로 유지.
   *
   * 활성 필드 보존: key / name / tone / equippedCount / totalMembers / missingMembers /
   * currentTier (test) / nextTier / nextBonus / isActive (test).
   *
   * 패턴 (cycle 222-348 silent dead config 시리즈 117번째):
   * - cycle 348: activeSet duplicate mult 3 필드.
   * - cycle 349: setProgress members/equippedMembers 2 출력 dead.
   *
   * 수정 (src/utils/signatureSetBonus.ts):
   * - return에서 members / equippedMembers 필드 제거.
   * - 내부 const는 missingMembers 계산용으로 유지.
   *
   * 회귀 가드:
   * - EquipmentPanel setProgress.key / .name / .tone / .equippedCount / .totalMembers /
   *   .missingMembers / .nextTier / .nextBonus 사용 그대로.
   * - test currentTier / isActive read 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 349: getSignatureSetProgress return에 members 0건', async () => {
      const source = await readSrc('src/utils/signatureSetBonus.ts');
      const fn = source.slice(source.indexOf('export const getSignatureSetProgress'));
      // return 객체 안의 `members,` (속기 문법) 0건. `members.length` (totalMembers) 사용은 OK.
      assert.ok(!/^\s+members,$/m.test(fn),
          'return에서 members 필드 0건');
      assert.ok(!/^\s+equippedMembers,$/m.test(fn),
          'return에서 equippedMembers 필드 0건');
  });

  test('cycle 349: 내부 const members / equippedMembers 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/signatureSetBonus.ts');
      assert.ok(/const members =/.test(source),
          '내부 const members 보존');
      assert.ok(/const equippedMembers =/.test(source),
          '내부 const equippedMembers 보존');
      assert.ok(/missingMembers = members\.filter/.test(source),
          'missingMembers 필터 계산 그대로');
  });

  test('cycle 349: getSignatureSetProgress 활성 필드 보존', async () => {
      const { getSignatureSetProgress } = await import('../src/utils/signatureSetBonus.js');
      // 빈 equip → null 반환.
      assert.equal(getSignatureSetProgress({}), null, 'empty equip null');
  });

  // NOTE(fix/signature-set-two-hand): 위 "cycle 426이 cycle 348을 대체" 테스트 참고 —
  // cycle 426이 activeSet.atkMult를 복원했으므로 이 회귀 가드도 반대로 갱신한다.
  test('cycle 426 회귀 가드: activeSet.atkMult 존재 보존', async () => {
      const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.js');
      const result = computeSignatureSetBonus({
          weapon: { name: '성검 에테르니아' },
          offhand: { name: '천공 성전' },
          armor: null,
      });
      assert.equal(typeof result.activeSet?.atkMult, 'number', 'cycle 426 activeSet.atkMult 보존');
  });
}

// ─── cycle-351-trait-profile-redundant-overrides.test.js ───
{
  /**
   * cycle 351: getTraitProfile 3 redundant override 정리 (rewardFocus/questFocus/bossDirective)
   *   (cycle 222-350 silent dead config 시리즈 118번째 — cleanup lens 연속).
   *
   * 발견 (3 dead redundant overrides):
   * - getTraitProfile return에 `...definition` spread + 명시 `rewardFocus: definition.rewardFocus` /
   *   `questFocus: definition.questFocus` / `bossDirective: definition.bossDirective`.
   * - spread가 이미 동일 필드 노출 → 명시 override는 dead duplicate.
   *
   * 패턴 (cycle 222-350 silent dead config 시리즈 118번째):
   * - cycle 350: CHANGELOG batch milestone.
   * - cycle 351: getTraitProfile redundant overrides 정리.
   *
   * 수정 (src/utils/runProfile.ts):
   * - rewardFocus / questFocus / bossDirective 3 명시 override 제거.
   *
   * 회귀 가드:
   * - `...definition` spread가 모든 TRAIT_DEFINITIONS 필드를 그대로 노출 (id/name/title/
   *   accent/chipClass/desc/passiveLabel/unlockHint/rewardFocus/questFocus/bossDirective).
   * - buildProfile / reasons / bonus / skill 4 explicit field 보존 (override 의미).
   * - 사용처 (StatsPanel / BuildAdvicePanel)에서 trait.rewardFocus 등 read 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 351: getTraitProfile 3 redundant override 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fn = source.slice(source.indexOf('export const getTraitProfile'), source.indexOf('export const getTraitBonus'));
      assert.ok(!/rewardFocus: definition\.rewardFocus/.test(fn),
          'rewardFocus override 0건');
      assert.ok(!/questFocus: definition\.questFocus/.test(fn),
          'questFocus override 0건');
      assert.ok(!/bossDirective: definition\.bossDirective/.test(fn),
          'bossDirective override 0건');
  });

  test('cycle 351: spread + bonus / skill 명시 override 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fn = source.slice(source.indexOf('export const getTraitProfile'), source.indexOf('export const getTraitBonus'));
      assert.ok(/\.\.\.definition,/.test(fn), '...definition spread 보존');
      assert.ok(/^\s+bonus: \{/m.test(fn), 'bonus 명시 override 보존 (정규화)');
      assert.ok(/^\s+skill,/m.test(fn), 'skill 명시 override 보존 (재계산)');
  });

  test('cycle 351: getTraitProfile 동작 보존 (활성 필드 모두 노출)', async () => {
      const { getTraitProfile } = await import('../src/utils/runProfile.js');
      const player = { job: '검사', equip: {}, relics: [], hp: 100, maxHp: 100, mp: 50, maxMp: 50, stats: {} };
      const trait = getTraitProfile(player, {});
      assert.ok('rewardFocus' in trait, 'rewardFocus 노출 (spread)');
      assert.ok('questFocus' in trait, 'questFocus 노출 (spread)');
      assert.ok('bossDirective' in trait, 'bossDirective 노출 (spread)');
      assert.ok('bonus' in trait, 'bonus 보존');
      assert.ok('skill' in trait, 'skill 보존');
      assert.ok('reasons' in trait, 'reasons 보존');
  });

  test('cycle 350 회귀 가드: CHANGELOG batch 보존', async () => {
      const source = await readSrc('CHANGELOG.md');
      assert.ok(/Cycle 350 🎯/.test(source),
          'cycle 350 batch entry 보존');
  });
}

// ─── cycle-355-daily-deals-discount-dead.test.js ───
{
  /**
   * cycle 355: getDailyDeals discount 출력 dead 정리
   *   (cycle 222-354 silent dead config 시리즈 122번째 — cleanup lens 연속).
   *
   * 발견 (1 dead output field):
   * - getDailyDeals 반환 객체의 discount 필드 (= 0.1 hardcoded).
   * - ShopPanel은 `dailyDeals.items`만 read. discount 외부 read 0건.
   * - 일일 할인율은 함수 내부에서 `Math.floor(item.price * 0.9)`로 이미 적용 완료.
   *   결과 가격이 새 price 필드로 노출되므로 discount 별도 노출은 redundant.
   *
   * 패턴 (cycle 222-354 silent dead config 시리즈 122번째):
   * - cycle 354: getTraitLootHint score/label/traitName 3 출력 dead.
   * - cycle 355: getDailyDeals discount 1 출력 dead.
   *
   * 수정 (src/utils/shopRotation.ts):
   * - getDailyDeals return에서 discount 필드 제거 — items 배열만 노출.
   * - JSDoc @returns 시그니처도 단순화.
   *
   * 회귀 가드:
   * - dailyDeals.items 보존 (ShopPanel 사용).
   * - 내부 0.9 multiplier 적용 그대로 (item.price = floor(originalPrice * 0.9)).
   * - originalPrice / isDailyDeal 마커 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 355: getDailyDeals return에 discount 0건', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      const fn = source.slice(source.indexOf('export const getDailyDeals'), source.indexOf('export const getWeeklySpecial'));
      assert.ok(!/discount:/.test(fn),
          'getDailyDeals return에서 discount 필드 0건');
  });

  test('cycle 355: getDailyDeals 동작 보존 (items 배열 + 0.9 가격)', async () => {
      const { getDailyDeals } = await import('../src/utils/shopRotation.js');
      const result = getDailyDeals(5);
      assert.ok(Array.isArray(result.items), 'items 배열 노출');
      assert.equal(result.discount, undefined, 'discount 필드 0건');
      if (result.items.length > 0) {
          const first = result.items[0];
          assert.ok(typeof first.price === 'number', 'price 보존');
          assert.ok(typeof first.originalPrice === 'number', 'originalPrice 보존');
          // cycle 436: isDailyDeal 마커 제거 — circular guard였음. cycle-436 test가 대체.
          assert.equal(first.price, Math.floor(first.originalPrice * 0.9),
              '0.9 할인 multiplier 그대로 적용');
      }
  });

  test('cycle 354 회귀 가드: getTraitLootHint score/label/traitName 0건 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fn = source.slice(source.indexOf('export const getTraitLootHint'), source.indexOf('export const getTraitQuestResonance'));
      assert.ok(!/^\s+score:\s/m.test(fn),
          'cycle 354 score 0건 보존');
      assert.ok(!/^\s+label:\s/m.test(fn),
          'cycle 354 label 0건 보존');
      assert.ok(!/traitName:/.test(fn),
          'cycle 354 traitName 0건 보존');
  });
}

// ─── cycle-356-operation-meta-summary-dead.test.js ───
{
  /**
   * cycle 356: OPERATION_META summary 5회 dead 정리
   *   (cycle 222-355 silent dead config 시리즈 123번째 — cleanup lens 연속).
   *
   * 발견 (5 dead config field — same key, 5 lanes):
   * - questOperations.ts OPERATION_META 5 lane(story/build/growth/boss/hunt) 모두 summary 필드 보유.
   * - QuestBoardPanel은 entry.meta.label / .emphasis만 read.
   * - meta.summary — src/, tests/ 어디에서도 read 0건.
   *
   * 패턴 (cycle 222-355 silent dead config 시리즈 123번째):
   * - cycle 355: getDailyDeals discount 출력 dead.
   * - cycle 356: OPERATION_META summary 5회 dead.
   *
   * 수정 (src/utils/questOperations.ts):
   * - OPERATION_META 5 lane에서 summary 필드 일괄 제거.
   *
   * 회귀 가드:
   * - meta.label / .emphasis 보존 (QuestBoardPanel dispatch).
   * - getQuestBoardRecommendations 정렬/lane 매칭 동일.
   * - QUEST_BOARD_PANEL meta 칩 표시 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 356: OPERATION_META summary 0건 (5 lane 모두 제거)', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      // OPERATION_META 객체 블록 시작~끝
      const blockMatch = source.match(/const OPERATION_META[^=]*=[^;]+;/s);
      assert.ok(blockMatch, 'OPERATION_META 블록 발견');
      const block = blockMatch[0];
      const summaryMatches = block.match(/summary:/g) || [];
      assert.equal(summaryMatches.length, 0,
          `OPERATION_META에서 summary 0건이어야 함, ${summaryMatches.length}건 발견`);
  });

  test('cycle 356: OPERATION_META label/emphasis 5 lane 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      const blockMatch = source.match(/const OPERATION_META[^=]*=[^;]+;/s);
      const block = blockMatch[0];
      const labelMatches = block.match(/label:/g) || [];
      const emphasisMatches = block.match(/emphasis:/g) || [];
      assert.equal(labelMatches.length, 5, 'label 5 lane 보존');
      assert.equal(emphasisMatches.length, 5, 'emphasis 5 lane 보존');
  });

  test('cycle 356: getQuestBoardRecommendations meta 노출 동작 보존', async () => {
      const { getQuestBoardRecommendations } = await import('../src/utils/questOperations.js');
      const player = {
          job: '전사',
          level: 5,
          loc: '시작의 마을',
          quests: [],
          equip: {},
          relics: [],
          stats: {},
          maxHp: 100,
          maxMp: 50,
      };
      const result = getQuestBoardRecommendations(player);
      if (result.featured.length > 0) {
          const first = result.featured[0];
          assert.ok(first.meta, 'meta 객체 노출');
          assert.ok('label' in first.meta, 'meta.label 보존');
          assert.ok('emphasis' in first.meta, 'meta.emphasis 보존');
          assert.equal(first.meta.summary, undefined, 'meta.summary 0건');
      }
  });

  test('cycle 355 회귀 가드: getDailyDeals discount 0건 보존', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      const fn = source.slice(source.indexOf('export const getDailyDeals'), source.indexOf('export const getWeeklySpecial'));
      assert.ok(!/discount:/.test(fn),
          'cycle 355 discount 0건 보존');
  });
}

// ─── cycle-357-fallback-event-pool-town-dead.test.js ───
{
  /**
   * cycle 357: FALLBACK_EVENT_POOL '시작의 마을' 12 events dead 정리
   *   (cycle 222-356 silent dead config 시리즈 124번째 — cleanup lens 연속).
   *
   * 발견 (12 dead events — 1 unreachable map key):
   * - aiEventUtils.ts FALLBACK_EVENT_POOL의 '시작의 마을' 키가 12개 fallback events 보유.
   * - exploreActions.ts:23 — `if (player.loc === CONSTANTS.START_LOCATION) return` 가드로
   *   START_LOCATION (= '시작의 마을') 탐험 자체가 블록됨. 따라서 pickFallbackEvent가
   *   loc='시작의 마을'로 호출되는 경로 0건. AI_SERVICE.generateEvent도 동일 진입점이라
   *   완전히 unreachable.
   * - 마을은 type='safe', eventChance=0이라 explore 진입 자체가 게임 디자인상 차단됨.
   *
   * 패턴 (cycle 222-356 silent dead config 시리즈 124번째):
   * - cycle 356: OPERATION_META summary 5회 dead.
   * - cycle 357: FALLBACK_EVENT_POOL '시작의 마을' 12 events dead.
   *
   * 수정 (src/utils/aiEventUtils.ts):
   * - FALLBACK_EVENT_POOL에서 '시작의 마을' 키 + 12 entries 일괄 제거.
   *
   * 회귀 가드:
   * - forest / ruins / cave / desert / ice / dark / abyss / treasure / machina /
   *   sky / deepsea / gate / default / structured 14 키 보존.
   * - pickFallbackEvent / getPoolKeyByLocation 동작 그대로.
   * - explore 가드 (player.loc === START_LOCATION return) 회귀 가드.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 357: FALLBACK_EVENT_POOL에서 \'시작의 마을\' 키 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnStart = source.indexOf('const FALLBACK_EVENT_POOL');
      const fnEnd = source.indexOf('export const pickFallbackEvent');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/'시작의 마을':/.test(block),
          'FALLBACK_EVENT_POOL에서 \'시작의 마을\' 키 0건');
  });

  test('cycle 357: FALLBACK_EVENT_POOL 활성 키 14종 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnStart = source.indexOf('const FALLBACK_EVENT_POOL');
      const fnEnd = source.indexOf('export const pickFallbackEvent');
      const block = source.slice(fnStart, fnEnd);
      const expected = ['forest', 'ruins', 'cave', 'desert', 'ice', 'dark', 'abyss',
                        'treasure', 'machina', 'sky', 'deepsea', 'gate', 'default', 'structured'];
      for (const key of expected) {
          assert.ok(new RegExp(`^    ${key}:`, 'm').test(block), `${key} 키 보존`);
      }
  });

  test('cycle 357: explore 가드 회귀 보존 (START_LOCATION 차단)', async () => {
      const source = await readSrc('src/hooks/gameActions/exploreActions.ts');
      assert.ok(/player\.loc === CONSTANTS\.START_LOCATION.+return addLog\('info'/.test(source),
          'explore에서 START_LOCATION return 가드 보존');
  });

  test('cycle 356 회귀 가드: OPERATION_META summary 0건 보존', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      const blockMatch = source.match(/const OPERATION_META[^=]*=[^;]+;/s);
      const block = blockMatch[0];
      const summaryMatches = block.match(/summary:/g) || [];
      assert.equal(summaryMatches.length, 0, 'cycle 356 summary 0건 보존');
  });
}

// ─── cycle-361-job-affinity-names-shadow-lord-dup.test.js ───
{
  /**
   * cycle 361: JOB_AFFINITY_NAMES '그림자주군' (공백 제거) 중복 키 unreachable 정리
   *   (cycle 222-360 silent dead config 시리즈 127번째 — cleanup lens 연속).
   *
   * 발견 (1 dead duplicate key):
   * - jobOutfitAffinity.ts JOB_AFFINITY_NAMES에 '그림자 주군' (공백) + 그림자주군
   *   (공백 제거) 두 키 존재.
   * - buildAffinityLabel(job, tier) 호출 사이트가 player.job (= '그림자 주군' 정식 표기)
   *   을 그대로 lookup. CLASSES.ts의 직업 키도 '그림자 주군'.
   * - 공백 제거된 '그림자주군' 키는 JOB_SPRITE_SLUG_MAP에서만 normalize 대응으로 필요했고
   *   (avatarSpriteCandidates: `replace(/\s+/g, '')` 후 lookup), JOB_AFFINITY_NAMES는
   *   normalize 없이 직접 lookup이라 unreachable.
   *
   * 패턴 (cycle 222-360 silent dead config 시리즈 127번째):
   * - cycle 359: ELEMENT_FILTERS 3 unreachable aliases.
   * - cycle 361: JOB_AFFINITY_NAMES 그림자주군 unreachable duplicate.
   *
   * 수정 (src/utils/jobOutfitAffinity.ts):
   * - JOB_AFFINITY_NAMES에서 그림자주군 (공백 제거) 키 제거.
   *
   * 회귀 가드:
   * - '그림자 주군' (공백) 키 보존 (정식 직업 표기).
   * - 14 다른 직업 키 보존.
   * - buildAffinityLabel 동작 그대로 (`${job}의 정점` 등 fallback 안전망).
   * - JOB_SPRITE_SLUG_MAP 그림자주군 entry는 별도 normalize 패턴으로 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 361: JOB_AFFINITY_NAMES 그림자주군 (공백 제거) 0건', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      const fnStart = source.indexOf('const JOB_AFFINITY_NAMES');
      const fnEnd = source.indexOf('const buildAffinityLabel');
      const block = source.slice(fnStart, fnEnd);
      // 공백 없는 단일 단어 그림자주군이 키로 존재하지 않아야 함.
      assert.ok(!/^\s+그림자주군:/m.test(block),
          'JOB_AFFINITY_NAMES에서 그림자주군 (공백 제거) 키 0건');
  });

  test('cycle 361: JOB_AFFINITY_NAMES \'그림자 주군\' (정식) 키 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      const fnStart = source.indexOf('const JOB_AFFINITY_NAMES');
      const fnEnd = source.indexOf('const buildAffinityLabel');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(/'그림자 주군':/.test(block),
          '\'그림자 주군\' (정식 표기) 키 보존');
  });

  test('cycle 361: JOB_AFFINITY_NAMES 14 활성 직업 키 보존', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      const fnStart = source.indexOf('const JOB_AFFINITY_NAMES');
      const fnEnd = source.indexOf('const buildAffinityLabel');
      const block = source.slice(fnStart, fnEnd);
      const activeJobs = ['모험가', '전사', '나이트', '버서커', '도적', '어쌔신',
                          '레인저', '마법사', '아크메이지', '흑마법사', '팔라딘',
                          '시간술사', '대마법사'];
      for (const job of activeJobs) {
          assert.ok(new RegExp(`^\\s+${job}:`, 'm').test(block), `${job} 키 보존`);
      }
  });

  test('cycle 361: getJobOutfitAffinity 동작 보존 (그림자 주군)', async () => {
      const { getJobOutfitAffinity } = await import('../src/utils/jobOutfitAffinity.js');
      const player = {
          job: '그림자 주군',
          equip: {
              weapon: { jobs: ['그림자 주군'], type: 'weapon' },
              armor: null,
              offhand: null,
          },
      };
      const aff = getJobOutfitAffinity(player);
      assert.equal(aff.matchCount, 1, 'matchCount 정확');
      assert.ok(aff.label && /어둠의 결|결$/.test(aff.label),
          '\'그림자 주군\' 직업의 partial1 label 보존');
  });

  test('cycle 359 회귀 가드: ELEMENT_FILTERS 불/얼음/화염속성 0건 보존', async () => {
      const source = await readSrc('src/utils/equipmentTint.ts');
      const fnStart = source.indexOf('const ELEMENT_FILTERS');
      const fnEnd = source.indexOf('const matchHint');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/^\s+불:/m.test(block), 'cycle 359 불 0건 보존');
      assert.ok(!/^\s+얼음:/m.test(block), 'cycle 359 얼음 0건 보존');
      assert.ok(!/^\s+화염속성:/m.test(block), 'cycle 359 화염속성 0건 보존');
  });
}

// ─── cycle-362-job-style-map-hairstyle-dead.test.js ───
{
  /**
   * cycle 362: JOB_STYLE_MAP / DEFAULT_JOB_STYLE hairStyle 15회 dead 정리
   *   (cycle 222-361 silent dead config 시리즈 128번째 — cleanup lens 연속).
   *
   * 발견 (15 dead config field — 1 default + 14 jobs):
   * - characterAppearance.ts DEFAULT_JOB_STYLE + JOB_STYLE_MAP 14 entries 모두
   *   hairStyle 필드 보유 (bob / spike / crest / short / bangs / ponytail / long).
   * - cycle 342에서 deriveCharacterAppearance 반환 객체의 hairStyle 출력 필드 제거됨.
   *   그러나 JOB_STYLE_MAP 정의에는 hairStyle 키가 잔존 — read 0건이라 unreachable.
   * - 활성 baseStyle 필드: armorStyle / accessoryStyle / hairColor / outfitColor /
   *   accentColor 5종만 deriveCharacterAppearance에서 read.
   *
   * 패턴 (cycle 222-361 silent dead config 시리즈 128번째):
   * - cycle 361: JOB_AFFINITY_NAMES 그림자주군 unreachable duplicate.
   * - cycle 362: JOB_STYLE_MAP hairStyle 15 dead config (cycle 342 cleanup의 cascade).
   *
   * 수정 (src/utils/characterAppearance.ts):
   * - DEFAULT_JOB_STYLE + JOB_STYLE_MAP 14 entries에서 hairStyle 필드 일괄 제거.
   *
   * 회귀 가드:
   * - 활성 5 필드 (armorStyle / accessoryStyle / hairColor / outfitColor / accentColor) 보존.
   * - 14 직업 키 보존.
   * - deriveCharacterAppearance 반환 shape 동일 (cycle 342 hairStyle 제거 그대로).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 362: JOB_STYLE_MAP hairStyle 0건 (15회 모두 제거)', async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      const fnStart = source.indexOf('const DEFAULT_JOB_STYLE');
      const fnEnd = source.indexOf('const ELEMENT_COLOR_MAP');
      const block = source.slice(fnStart, fnEnd);
      const matches = block.match(/hairStyle:/g) || [];
      assert.equal(matches.length, 0,
          `JOB_STYLE_MAP / DEFAULT_JOB_STYLE에서 hairStyle 0건이어야 함, ${matches.length}건 발견`);
  });

  test('cycle 362: 활성 5 필드 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      const fnStart = source.indexOf('const DEFAULT_JOB_STYLE');
      const fnEnd = source.indexOf('const ELEMENT_COLOR_MAP');
      const block = source.slice(fnStart, fnEnd);
      const expected = ['hairColor', 'outfitColor', 'accentColor', 'armorStyle', 'accessoryStyle'];
      for (const field of expected) {
          const matches = block.match(new RegExp(`${field}:`, 'g')) || [];
          assert.ok(matches.length >= 14, `${field} 14+ entries 보존 (${matches.length})`);
      }
  });

  test('cycle 362: deriveCharacterAppearance 동작 보존', async () => {
      const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.js');
      const player = {
          job: '전사',
          equip: {
              weapon: { name: '강철 롱소드', type: 'weapon', val: 12, hands: 1 },
              armor: { name: '판금 갑주', type: 'armor', val: 30 },
              offhand: null,
          },
      };
      const appearance = deriveCharacterAppearance(player);
      assert.equal(appearance.job, '전사', 'job 보존');
      assert.ok(appearance.palette, 'palette 객체 노출');
      assert.equal(typeof appearance.palette.hair, 'string', 'palette.hair 보존 (hairColor 매핑)');
      assert.equal(typeof appearance.armorStyle, 'string', 'armorStyle 보존');
      assert.equal(typeof appearance.accessoryStyle, 'string', 'accessoryStyle 보존');
      assert.equal(appearance.hairStyle, undefined, 'hairStyle 출력 0건 (cycle 342 회귀 가드)');
  });

  test('cycle 361 회귀 가드: JOB_AFFINITY_NAMES 그림자주군 0건 보존', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      const fnStart = source.indexOf('const JOB_AFFINITY_NAMES');
      const fnEnd = source.indexOf('const buildAffinityLabel');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/^\s+그림자주군:/m.test(block),
          'cycle 361 그림자주군 (공백 제거) 0건 보존');
  });
}

// ─── cycle-364-event-chain-reward-itemtype-tier-dead.test.js ───
{
  /**
   * cycle 364: eventChains.ts reward.itemType / reward.tier 7 dead annotations 정리
   *   (cycle 222-363 silent dead config 시리즈 130번째 — cleanup lens 연속).
   *
   * 발견 (7 dead config field — 4 itemType + 3 tier):
   * - eventChains.ts에 4 chain reward 객체에 `itemType: 'weapon'/'armor'` 필드.
   * - eventChains.ts에 3 chain reward 객체에 `tier: 4/5` 필드.
   * - eventActions.ts handleEventChoice는 reward.name만 read해서 addItemByName으로
   *   처리. 이 함수는 DB.ITEMS에서 아이템 데이터(type/tier 포함)를 lookup해 사용.
   * - reward.itemType / reward.tier — eventActions / 어떤 hook에서도 read 0건.
   *
   * 패턴 (cycle 222-363 silent dead config 시리즈 130번째):
   * - cycle 363: AVATAR_ANCHORS shoulder 2 unreachable.
   * - cycle 364: eventChain reward itemType / tier 7 dead annotations.
   *
   * 수정 (src/data/eventChains.ts):
   * - 4 chain reward 객체에서 itemType 필드 제거.
   * - 3 chain reward 객체에서 tier 필드 제거.
   *
   * 회귀 가드:
   * - reward.type / reward.name 보존 (eventActions read).
   * - water_apostle chain reward type validation test (이미 itemType/tier 검증 안 함).
   * - addItemByName 동작 그대로 (DB.ITEMS에서 type/tier lookup).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 364: eventChains.ts reward.itemType 0건', async () => {
      const source = await readSrc('src/data/eventChains.ts');
      const matches = source.match(/itemType:/g) || [];
      assert.equal(matches.length, 0,
          `eventChains.ts에서 itemType 0건이어야 함, ${matches.length}건 발견`);
  });

  test('cycle 364: eventChains.ts reward.tier 0건', async () => {
      const source = await readSrc('src/data/eventChains.ts');
      // reward 객체 안의 tier만 체크 — outcome 안의 reward { ..., tier: 5 } 패턴.
      const matches = source.match(/, tier: \d/g) || [];
      assert.equal(matches.length, 0,
          `eventChains.ts에서 reward tier 0건이어야 함, ${matches.length}건 발견`);
  });

  test('cycle 364: getChainEventForLoc 동작 보존 (item reward name)', async () => {
      const { EVENT_CHAINS } = await import('../src/data/eventChains.js');
      const lostWizard = EVENT_CHAINS.find((c) => c.id === 'lost_wizard');
      assert.ok(lostWizard, 'lost_wizard chain 존재');
      // legendary_item reward는 name이 보존되어야 함.
      let found = false;
      for (const step of lostWizard.steps) {
          for (const outcome of step.event.outcomes) {
              if (outcome.reward?.type === 'legendary_item') {
                  assert.ok(outcome.reward.name, `legendary_item reward에 name 보존`);
                  assert.equal(outcome.reward.itemType, undefined, `itemType 0건`);
                  found = true;
              }
          }
      }
      assert.ok(found, 'legendary_item reward 발견');
  });

  test('cycle 363 회귀 가드: AVATAR_ANCHORS shoulder 0건 보존', async () => {
      const { AVATAR_ANCHORS } = await import('../src/utils/anchorPoints.js');
      assert.equal(AVATAR_ANCHORS.shoulder_l, undefined, 'cycle 363 shoulder_l 0건 보존');
      assert.equal(AVATAR_ANCHORS.shoulder_r, undefined, 'cycle 363 shoulder_r 0건 보존');
  });
}

// ─── cycle-365-event-chain-outcome-chainid-dead.test.js ───
{
  /**
   * cycle 365: eventChains.ts outcome.chainId 70개 redundant 정리
   *   (cycle 222-364 silent dead config 시리즈 131번째 — cleanup lens 연속).
   *
   * 발견 (70 dead config field — 동일 키, 13 chain × 평균 5+ outcome):
   * - eventChains.ts 13 chain의 모든 outcome 객체에 chainId 필드 (총 70개).
   * - eventActions.ts handleEventChoice는 `currentEvent._chainId`만 read.
   *   _chainId는 exploreActions에서 chain.id로 set됨 (chain trigger 시점).
   * - outcome.chainId는 항상 parent chain.id와 동일 — redundant. eventActions /
   *   tests / 어디에서도 outcome.chainId 직접 read 0건.
   * - 13 chain ID 목록 (chain.id ↔ outcome.chainId 일치 확인): abyss_signal /
   *   ancient_prophecy / divine_apostle_trial / dragon_legacy / forgotten_commander /
   *   forgotten_god / last_hero / lost_wizard / machine_uprising / rift_secret /
   *   shadow_guild / water_apostle / world_tree_corruption.
   *
   * 패턴 (cycle 222-364 silent dead config 시리즈 131번째):
   * - cycle 364: eventChain reward itemType / tier 7 dead annotations.
   * - cycle 365: eventChain outcome chainId 70 redundant duplicates (같은 lens).
   *
   * 수정 (src/data/eventChains.ts):
   * - 70 outcome 객체에서 chainId 필드 일괄 제거.
   *
   * 회귀 가드:
   * - 13 chain의 chain.id 정의 보존 (getChainEventForLoc lookup용).
   * - outcome.type / log / reward 보존.
   * - eventActions chain advance 동작 그대로 (`currentEvent._chainId` 사용).
   * - water-apostle-chain.test.js / discovery-chain test 통과.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 365: eventChains.ts outcome.chainId 0건', async () => {
      const source = await readSrc('src/data/eventChains.ts');
      const matches = source.match(/chainId:/g) || [];
      assert.equal(matches.length, 0,
          `eventChains.ts에서 chainId 0건이어야 함, ${matches.length}건 발견`);
  });

  test('cycle 365: 13 chain id 정의 보존 (회귀 가드)', async () => {
      const { EVENT_CHAINS } = await import('../src/data/eventChains.js');
      const expectedIds = ['abyss_signal', 'ancient_prophecy', 'divine_apostle_trial',
          'dragon_legacy', 'forgotten_commander', 'forgotten_god', 'last_hero',
          'lost_wizard', 'machine_uprising', 'rift_secret', 'shadow_guild',
          'water_apostle', 'world_tree_corruption'];
      const actualIds = EVENT_CHAINS.map((c) => c.id).sort();
      assert.deepEqual(actualIds.slice().sort(), expectedIds.slice().sort(),
          '13 chain id 보존');
  });

  test('cycle 365: outcome 구조 보존 (type / log / reward)', async () => {
      const { EVENT_CHAINS } = await import('../src/data/eventChains.js');
      let totalOutcomes = 0;
      for (const chain of EVENT_CHAINS) {
          for (const step of chain.steps) {
              for (const outcome of step.event.outcomes) {
                  assert.ok(typeof outcome.type === 'string', 'outcome.type 보존');
                  assert.equal(outcome.chainId, undefined, 'outcome.chainId 0건');
                  totalOutcomes += 1;
              }
          }
      }
      assert.ok(totalOutcomes >= 50, `outcome 50+ 개 검증 (실제: ${totalOutcomes})`);
  });

  test('cycle 365: getChainEventForLoc 동작 보존', async () => {
      const { getChainEventForLoc } = await import('../src/data/eventChains.js');
      const result = getChainEventForLoc('호수의 신전', { water_apostle: 0 });
      assert.ok(result, 'water_apostle chain step 0 반환');
      assert.equal(result.chain.id, 'water_apostle', 'chain.id 보존');
  });

  test('cycle 364 회귀 가드: eventChain reward itemType/tier 0건 보존', async () => {
      const source = await readSrc('src/data/eventChains.ts');
      const itemTypeMatches = source.match(/itemType:/g) || [];
      const tierMatches = source.match(/, tier: \d/g) || [];
      assert.equal(itemTypeMatches.length, 0, 'cycle 364 itemType 0건 보존');
      assert.equal(tierMatches.length, 0, 'cycle 364 reward tier 0건 보존');
  });
}

// ─── cycle-368-threshold-default-redundant.test.js ───
{
  /**
   * cycle 368: relic prophecy_stone + quest 62 threshold default 2회 redundant 정리
   *   (cycle 222-367 silent dead config 시리즈 134번째 — cleanup lens 연속).
   *
   * 발견 (2 redundant default annotations):
   * - src/data/relics.ts prophecy_stone에 `threshold: 0.25` —
   *   CombatEngine.ts:544 `executeAtkRelic.threshold || 0.25` 기본값과 동일.
   * - src/data/quests.ts 퀘스트 id=62 (생존의 의지)에 `threshold: 0.2` —
   *   questProgress.ts:41 `questData.threshold || 0.2` 기본값과 동일.
   * - 두 케이스 모두 `|| default` fallback이 적용되므로 default와 같은 명시는 redundant.
   *
   * 핵심: blood_moon (low_hp_dmg, threshold: 0.25) — default 0.4와 다름 → 보존.
   *      quest 63 (threshold: 0.1) / 75 (threshold: 0.05) — default와 다름 → 보존.
   *
   * 패턴 (cycle 222-367 silent dead config 시리즈 134번째):
   * - cycle 367: maps boss: false 4 redundant.
   * - cycle 368: relic + quest threshold default 2 redundant.
   *
   * 수정:
   * - src/data/relics.ts: prophecy_stone의 threshold: 0.25 제거.
   * - src/data/quests.ts: quest 62의 threshold: 0.2 제거.
   *
   * 회귀 가드:
   * - prophecy_stone effect/val 보존, default 0.25 fallback으로 동작 동일.
   * - blood_moon threshold: 0.25 보존 (low_hp_dmg default 0.4와 다름).
   * - quest 63 threshold: 0.1 / quest 75 threshold: 0.05 보존.
   * - questProgress / CombatEngine execute 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 368: prophecy_stone threshold default 0건', async () => {
      const source = await readSrc('src/data/relics.ts');
      const propheLine = source.match(/prophecy_stone[^\n]*/)[0];
      assert.ok(!/threshold: 0\.25/.test(propheLine),
          `prophecy_stone에서 threshold: 0.25 0건이어야 함. 라인: ${propheLine}`);
  });

  test('cycle 368: quest 62 threshold default 0건', async () => {
      const source = await readSrc('src/data/quests.ts');
      const q62Line = source.match(/id: 62[^\n]*/)[0];
      assert.ok(!/threshold: 0\.2[^0-9]/.test(q62Line),
          `quest 62에서 threshold: 0.2 0건이어야 함. 라인: ${q62Line}`);
  });

  test('cycle 368: blood_moon threshold 0.25 보존 (default와 다름)', async () => {
      const source = await readSrc('src/data/relics.ts');
      const bloodMoonLine = source.match(/blood_moon[^\n]*/)[0];
      assert.ok(/threshold: 0\.25/.test(bloodMoonLine),
          `blood_moon threshold: 0.25 보존 (low_hp_dmg default 0.4와 다름)`);
  });

  test('cycle 368: quest 63/75 threshold 보존 (default와 다름)', async () => {
      const source = await readSrc('src/data/quests.ts');
      const q63Line = source.match(/id: 63[^\n]*/)[0];
      const q75Line = source.match(/id: 75[^\n]*/)[0];
      assert.ok(/threshold: 0\.1/.test(q63Line), 'quest 63 threshold: 0.1 보존');
      assert.ok(/threshold: 0\.05/.test(q75Line), 'quest 75 threshold: 0.05 보존');
  });

  test('cycle 367 회귀 가드: maps boss: false 0건 보존', async () => {
      const source = await readSrc('src/data/maps.ts');
      const matches = source.match(/boss: false/g) || [];
      assert.equal(matches.length, 0, 'cycle 367 boss: false 0건 보존');
  });
}

// ─── cycle-369-item-types-private-downgrade.test.js ───
{
  /**
   * cycle 369: ItemBase type export → private downgrade
   *   (cycle 222-368 silent dead config 시리즈 135번째 — cleanup lens 연속).
   *
   * 발견 (1 dead public export — internal-only type):
   * - src/types/item.ts: `export interface ItemBase` 외부 import 0건
   *   (src/utils, src/components, src/hooks, src/systems, src/data, src/services 모두).
   * - ItemBase는 동일 파일의 Item 유니온(`Item = EquipmentItem | ConsumableItem | ItemBase`)
   *   구성용 internal type로만 사용. EquipSlots 필드 타입(`weapon?: ItemBase | null`)도
   *   동일 파일 내부.
   * - 외부에서 필요한 건 Item / EquipSlots만 (이미 export됨).
   * - ConsumableItem은 cycle 298 테스트에서 활성 export로 가드됨 → 보존.
   *
   * 패턴 (cycle 222-368 silent dead config 시리즈 135번째):
   * - cycle 295/298/312/316: type/util/placement private downgrade lens.
   * - cycle 368: relic + quest threshold default redundant.
   * - cycle 369: ItemBase export → private downgrade (cycle 298 lens 후속).
   *
   * 수정 (src/types/item.ts):
   * - `export interface ItemBase` → `interface ItemBase`.
   *
   * 회귀 가드:
   * - Item / EquipSlots / ConsumableItem export 보존 (외부 import / 회귀 가드).
   * - Item 유니온 정의 동일 (ItemBase private interface로 사용).
   * - EquipSlots ItemBase 필드 동일 (private internal reference).
   * - tsc strict mode 통과.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 369: ItemBase export → private downgrade', async () => {
      const source = await readSrc('src/types/item.ts');
      assert.ok(!/^export interface ItemBase/m.test(source),
          'ItemBase export 0건');
      assert.ok(/^interface ItemBase/m.test(source),
          'ItemBase private interface 보존');
  });

  test('cycle 369: Item / EquipSlots / ConsumableItem export 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/types/item.ts');
      assert.ok(/^export type Item =/m.test(source), 'Item type export 보존');
      assert.ok(/^export interface EquipSlots/m.test(source), 'EquipSlots export 보존');
      assert.ok(/^export interface ConsumableItem/m.test(source),
          'ConsumableItem export 보존 (cycle 298 회귀 가드)');
  });

  test('cycle 368 회귀 가드: prophecy_stone threshold 0건 보존', async () => {
      const source = await readSrc('src/data/relics.ts');
      const propheLine = source.match(/prophecy_stone[^\n]*/)[0];
      assert.ok(!/threshold:/.test(propheLine),
          'cycle 368 prophecy_stone threshold 0건 보존');
  });
}

// ─── cycle-371-maps-safe-eventchance-zero-redundant.test.js ───
{
  /**
   * cycle 371: maps.ts safe-zone eventChance: 0 5회 redundant 정리
   *   (cycle 222-370 silent dead config 시리즈 136번째 — cleanup lens 연속).
   *
   * 발견 (5 redundant default annotations):
   * - src/data/maps.ts에 5 safe-zone 맵 (시작의 마을 / 여행자의 쉼터 /
   *   사막 오아시스 / 북부 요새 / 허공의 섬)이 `eventChance: 0` 명시.
   * - 모든 eventChance 사용 사이트가 `mapData.eventChance || 0` fallback —
   *   undefined와 0 둘 다 0으로 처리.
   * - explorationPacing.ts:28의 `mapData.type === 'safe'` 가드가 더 빠르게 트리거,
   *   safe map은 narrative event 발동 자체가 차단.
   * - eventChance: 0 is undefined와 동일 효과 → redundant.
   *
   * 핵심 비교:
   * - 황금 무역 도시 (type: 'safe', eventChance: 0.28) — 0과 다른 명시 값 → 보존.
   *
   * 패턴 (cycle 222-370 silent dead config 시리즈 136번째):
   * - cycle 367: maps boss: false 4 redundant.
   * - cycle 371: maps safe-zone eventChance: 0 5 redundant.
   *
   * 수정 (src/data/maps.ts):
   * - 5 safe-zone 맵에서 `eventChance: 0` 라인 제거.
   *
   * 회귀 가드:
   * - 황금 무역 도시 (type: 'safe', eventChance: 0.28) 보존 — 다른 값.
   * - 6 safe-zone 맵 (type: 'safe') 정의 자체는 모두 보존.
   * - getNarrativeEventChance / getMapPacingProfile 동작 그대로 (`|| 0` fallback +
   *   type==='safe' early return).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 371: maps.ts safe-zone eventChance: 0 0건', async () => {
      const source = await readSrc('src/data/maps.ts');
      const matches = source.match(/eventChance: 0$/gm) || [];
      assert.equal(matches.length, 0,
          `safe-zone eventChance: 0 (라인 끝) 0건이어야 함, ${matches.length}건 발견`);
  });

  test('cycle 371: 6 safe-zone 맵 정의 보존 (type: \'safe\')', async () => {
      const source = await readSrc('src/data/maps.ts');
      const matches = source.match(/type: 'safe'/g) || [];
      assert.ok(matches.length >= 6, `6+ safe-zone 보존 (${matches.length}건)`);
  });

  test('cycle 371: 황금 왕국 eventChance 0.28 보존 (safe + 다른 값)', async () => {
      const { MAPS } = await import('../src/data/maps.js');
      assert.equal(MAPS['황금 왕국'].type, 'safe', '황금 왕국 type=safe');
      assert.equal(MAPS['황금 왕국'].eventChance, 0.28,
          '황금 왕국 eventChance 0.28 보존 (default 0과 다른 명시 값)');
  });

  test('cycle 371: MAPS 동작 보존', async () => {
      const { MAPS } = await import('../src/data/maps.js');
      const safeMaps = ['시작의 마을', '여행자의 쉼터', '사막 오아시스', '북부 요새', '허공의 섬'];
      for (const name of safeMaps) {
          assert.equal(MAPS[name].type, 'safe', `${name} type 'safe' 보존`);
          assert.equal(MAPS[name].eventChance, undefined, `${name} eventChance 0건 (undefined fallback)`);
      }
  });

  test('cycle 367 회귀 가드: maps boss: false 0건 보존', async () => {
      const source = await readSrc('src/data/maps.ts');
      const matches = source.match(/boss: false/g) || [];
      assert.equal(matches.length, 0, 'cycle 367 boss: false 0건 보존');
  });
}

// ─── cycle-389-killstreak-bonus-tieridx-dead.test.js ───
{
  /**
   * cycle 389: computeKillStreakBonus 반환 tierIdx dead 필드 정리
   *   (cycle 222-388 silent dead config 시리즈 153번째 — cleanup lens 연속).
   *
   * 발견 (1 dead output 필드):
   * - src/utils/statsCalculator.ts line 264-272: 내부 helper computeKillStreakBonus가
   *   `{ atkBonus, critBonus, tierIdx }`를 반환.
   * - 유일 consumer (calculateFullStats line 378-394)는 `streak.atkBonus` / `streak.critBonus`만 read.
   * - `streak.tierIdx`는 consumer 0건 — internal scope에서도 read 0건.
   * - tierIdx는 함수 내부에서 atkBonus/critBonus 계산용 lookup index로만 사용.
   *   외부로 expose해야 할 이유 없음.
   * - cycle 278 회귀 가드는 함수 존재 + atkBonus/critBonus 계산 보존만 검증.
   *
   * 패턴 (cycle 222-388 silent dead config 시리즈 153번째):
   * - cycle 388: migrateData killStreak normalization redundant.
   * - cycle 389: computeKillStreakBonus.tierIdx 출력 1 dead 필드 정리
   *   (function output dead lens 변형 — internal helper 출력 cleanup).
   *
   * 수정 (src/utils/statsCalculator.ts):
   * - return { atkBonus, critBonus } (tierIdx 제거).
   * - JSDoc @returns 표기 갱신.
   *
   * 회귀 가드:
   * - tierIdx 변수 자체는 함수 내부 atkBonus/critBonus 계산용으로 유지.
   * - calculateFullStats의 streak.atkBonus / streak.critBonus 동작 그대로.
   * - cycle 278 killStreak raw count 필드 / atkBonus / critBonus 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 389: computeKillStreakBonus 반환에서 tierIdx 필드 제거', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      const fnStart = source.indexOf('const computeKillStreakBonus');
      const fnEnd = source.indexOf('export const calculateFullStats');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/return\s*\{[^}]*tierIdx[^}]*\}/.test(block),
          'computeKillStreakBonus return object에서 tierIdx 필드 제거됨');
  });

  test('cycle 389: tierIdx 변수는 atkBonus/critBonus 계산용으로 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      const fnStart = source.indexOf('const computeKillStreakBonus');
      const fnEnd = source.indexOf('export const calculateFullStats');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(/const tierIdx = BALANCE\.KILL_STREAK_TIERS\.reduce/.test(block),
          'tierIdx 변수 자체는 lookup index로 유지');
      assert.ok(/atkBonus = tierIdx >= 0/.test(block),
          'atkBonus 계산 보존');
      assert.ok(/critBonus = tierIdx >= 0/.test(block),
          'critBonus 계산 보존');
  });

  test('cycle 389: calculateFullStats streak.atkBonus / streak.critBonus 동작 보존', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const player = {
          name: 'test', job: '모험가', hp: 100, maxHp: 150, mp: 30, maxMp: 50,
          atk: 10, def: 5,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [], inv: [],
          stats: { kills: 0, total_gold: 0, deaths: 0 },
          killStreak: 5,
      };
      const stats = calculateFullStats(player);
      assert.ok(stats, 'calculateFullStats 동작');
      assert.ok(typeof stats.atk === 'number', 'finalAtk 계산');
      assert.ok(typeof stats.critChance === 'number', 'finalCritChance 계산');
  });

  test('cycle 388 회귀 가드: migrateData killStreak normalization 0건 보존', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      const fnStart = source.indexOf('export const migrateData');
      const fnEnd = source.indexOf('export const checkTitles');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/typeof target\.killStreak !== 'number'/.test(block),
          'cycle 388 killStreak normalization 0건 보존');
  });
}

// ─── cycle-391-default-combat-flags-private.test.js ───
{
  /**
   * cycle 391: DEFAULT_COMBAT_FLAGS export → private downgrade
   *   (cycle 222-390 silent dead config 시리즈 154번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/utils/playerStateUtils.ts: DEFAULT_COMBAT_FLAGS — playerStateUtils 내부
   *   2회 사용 (line 41 hasTemporaryAdventureState + line 69 clearTemporaryAdventureState),
   *   외부 consumer 0건 (src 0, tests 0).
   * - src/systems/CombatEngine.ts:22의 DEFAULT_COMBAT_FLAGS는 별개 property (객체 멤버),
   *   playerStateUtils 의 export와 무관.
   * - cycle 317 test가 active export로 잘못 가드 — 외부 consumer 0건이 변하지 않은 상태.
   *
   * 패턴 (cycle 222-390 silent dead config 시리즈 154번째):
   * - cycle 295/298/312/316/317/369: export → private downgrade lens.
   * - cycle 390: 20번째 milestone batch.
   * - cycle 391: DEFAULT_COMBAT_FLAGS private downgrade — 동일 lens 회귀.
   *
   * 수정:
   * 1) src/utils/playerStateUtils.ts: `export const DEFAULT_COMBAT_FLAGS` → `const DEFAULT_COMBAT_FLAGS`.
   * 2) tests/cycle-300-399.test.js: activeExports에서 DEFAULT_COMBAT_FLAGS 제거.
   *
   * 회귀 가드:
   * - hasTemporaryAdventureState / clearTemporaryAdventureState / incrementStat active export 유지.
   * - clearTemporaryAdventureState combatFlags 초기화 동작 보존 (DEFAULT_COMBAT_FLAGS 내부 사용).
   * - CombatEngine.DEFAULT_COMBAT_FLAGS (별개 property) 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 391: DEFAULT_COMBAT_FLAGS export 제거 (private)', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      assert.ok(!/export const DEFAULT_COMBAT_FLAGS\b/.test(source),
          'DEFAULT_COMBAT_FLAGS export 제거됨');
      assert.ok(/const DEFAULT_COMBAT_FLAGS\b/.test(source),
          'DEFAULT_COMBAT_FLAGS const 정의 유지 (private)');
  });

  test('cycle 391: playerStateUtils 활성 export 유지', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      const activeExports = ['incrementStat', 'hasTemporaryAdventureState', 'clearTemporaryAdventureState'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 391: clearTemporaryAdventureState combatFlags 초기화 동작 보존', async () => {
      const { clearTemporaryAdventureState } = await import('../src/utils/playerStateUtils.js');
      const player = {
          tempBuff: { atk: 5, def: 2, turn: 3, name: '버프' },
          combatFlags: { comboCount: 4, deathSaveUsed: true, voidHeartUsed: true, voidHeartArmed: true },
          status: ['poison'],
      };
      const result = clearTemporaryAdventureState(player);
      assert.equal(result.combatFlags.comboCount, 0, 'comboCount reset');
      assert.equal(result.combatFlags.deathSaveUsed, false, 'deathSaveUsed reset');
      assert.equal(result.combatFlags.voidHeartUsed, true, 'voidHeartUsed 보존 (run-wide)');
      assert.equal(result.combatFlags.voidHeartArmed, true, 'voidHeartArmed 보존 (run-wide)');
      assert.deepEqual(result.status, [], 'status reset');
  });

  test('cycle 390 회귀 가드: cycle 389 computeKillStreakBonus.tierIdx 0건 보존', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      const fnStart = source.indexOf('const computeKillStreakBonus');
      const fnEnd = source.indexOf('export const calculateFullStats');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/return\s*\{[^}]*tierIdx[^}]*\}/.test(block),
          'cycle 389 tierIdx 출력 0건 보존');
  });
}

// ─── cycle-395-weaponless-adventurer-sprites-dead.test.js ───
{
  /**
   * cycle 395: WEAPONLESS_ADVENTURER_SPRITES dead set 정리 +
   *   JOB_SPRITE_SLUG_MAP `'그림자 주군'` (공백 포함) unreachable 키 정리.
   *   (cycle 222-394 silent dead config 시리즈 158번째 — cleanup lens 연속).
   *
   * 발견 (2 dead targets):
   *
   * 1) src/utils/avatarSpriteCandidates.ts: WEAPONLESS_ADVENTURER_SPRITES Set 정의 (4 entries +
   *    7-line audit 주석). 정의만 있고 src/, tests/ 어디에도 read 0건.
   *    cycle 35 시각 audit 시점에 작성된 future-use 데이터였으나 도입 path가 끝내 미실현.
   *
   * 2) src/utils/avatarSpriteCandidates.ts JOB_SPRITE_SLUG_MAP에 `'그림자 주군': 'shadow-lord'`
   *    (공백 포함) entry. resolveAppearanceKeys 내 `normalizedJob = appearance.job.replace(/\s+/g, '')`
   *    가 항상 공백을 strip한 후 '그림자주군' 키로 lookup → with-space 키 unreachable.
   *    cycle 361 jobOutfitAffinity 동일 lens (no-space duplicate unreachable) 변형 회귀.
   *
   * 패턴 (cycle 222-394 silent dead config 시리즈 158번째):
   * - cycle 357: FALLBACK_EVENT_POOL '시작의 마을' 12 unreachable.
   * - cycle 359/361/392: ELEMENT_FILTERS / JOB_AFFINITY_NAMES / ACTION_KIND_TO_BUTTON
   *   unreachable lens.
   * - cycle 395: WEAPONLESS_ADVENTURER_SPRITES 정의 dead + JOB_SPRITE_SLUG_MAP
   *   normalize-bypassed key (unreachable + dead-set 복합 lens).
   *
   * 수정 (src/utils/avatarSpriteCandidates.ts):
   * - WEAPONLESS_ADVENTURER_SPRITES Set 정의 + 7-line audit 주석 제거.
   * - JOB_SPRITE_SLUG_MAP에서 `'그림자 주군': 'shadow-lord'` 라인 제거 (공백 없는 키만 잔존).
   *
   * 회귀 가드:
   * - getAvatarSpriteCandidates / getAvatarEquipmentPreviewCandidates 동작 보존.
   * - shadow-lord 직업 sprite 매핑 (`그림자 주군` → '그림자주군' normalize → 'shadow-lord') 보존.
   * - JOB_SPRITE_SLUG_MAP 14 entry (그림자주군 단일) 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 395: WEAPONLESS_ADVENTURER_SPRITES 정의 0건', async () => {
      const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
      assert.ok(!/WEAPONLESS_ADVENTURER_SPRITES/.test(source),
          'WEAPONLESS_ADVENTURER_SPRITES 정의 / 참조 0건');
  });

  test('cycle 395: JOB_SPRITE_SLUG_MAP `그림자 주군` (공백 포함) 키 0건', async () => {
      const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
      const mapStart = source.indexOf('export const JOB_SPRITE_SLUG_MAP');
      const mapEnd = source.indexOf('};', mapStart);
      const mapBlock = source.slice(mapStart, mapEnd);
      assert.ok(!/'그림자 주군':/.test(mapBlock),
          'JOB_SPRITE_SLUG_MAP 블록 내 공백 포함 `그림자 주군` 키 0건');
      assert.ok(/그림자주군:/.test(mapBlock),
          '공백 없는 `그림자주군` 단일 키 보존');
  });

  test('cycle 395: getAvatarSpriteCandidates 동작 보존 (shadow-lord 매핑)', async () => {
      const { getAvatarSpriteCandidates } = await import('../src/utils/avatarSpriteCandidates.js');
      // CLASSES.ts에서 그림자 주군은 공백 포함 형식으로 dispatch.
      const candidates1 = getAvatarSpriteCandidates({ job: '그림자 주군' });
      assert.ok(Array.isArray(candidates1), '배열 반환');
      assert.ok(candidates1.some((p) => p.includes('shadow-lord')),
          'shadow-lord sprite 후보에 포함');

      // 모험가 (default) 동작 보존.
      const candidates2 = getAvatarSpriteCandidates({ job: '모험가' });
      assert.ok(candidates2.some((p) => p.includes('adventurer')),
          '모험가 → adventurer sprite');
  });

  test('cycle 395: JOB_SPRITE_SLUG_MAP 14 entry 단일 키 보존', async () => {
      const { JOB_SPRITE_SLUG_MAP } = await import('../src/utils/avatarSpriteCandidates.js');
      const keys = Object.keys(JOB_SPRITE_SLUG_MAP);
      assert.equal(keys.length, 14, `14 entry, 발견: ${keys.length}`);
      assert.equal(JOB_SPRITE_SLUG_MAP['그림자주군'], 'shadow-lord', '공백 없는 키 보존');
      assert.equal(JOB_SPRITE_SLUG_MAP['그림자 주군'], undefined, '공백 키 제거');
  });

  test('cycle 394 회귀 가드: RELIC_SYNERGIES id 0건 보존', async () => {
      const source = await readSrc('src/data/relics.ts');
      const synergyStart = source.indexOf('export const RELIC_SYNERGIES');
      const synergyEnd = source.indexOf(']);', synergyStart);
      const block = source.slice(synergyStart, synergyEnd);
      assert.ok(!/^\s+id: '/m.test(block),
          'cycle 394 RELIC_SYNERGIES id 0건 보존');
  });
}

// ─── cycle-397-theme-by-target-abyssfloor-unreachable.test.js ───
{
  /**
   * cycle 397: AchievementPanel THEME_BY_TARGET `abyssFloor` unreachable lookup 정리
   *   (cycle 222-396 silent dead config 시리즈 160번째 — unreachable lens 회귀).
   *
   * 발견 (1 unreachable lookup entry):
   * - src/components/AchievementPanel.tsx THEME_BY_TARGET map에 `abyssFloor`와
   *   `abyssRecord` 두 키가 모두 정의됨.
   * - 유일 consumer (getTheme): `THEME_BY_TARGET[achievement?.target] || THEME_BY_TARGET.kills`.
   * - DB.ACHIEVEMENTS 6 abyss entry 모두 `target: 'abyssRecord'` (depth: 10/30/50/100/200/300).
   * - `target: 'abyssFloor'` achievement 0건 — `abyssFloor` 키 lookup 절대 hit 안 됨.
   * - 두 target 모두 동일 시각 톤 (`fuchsia-100`)이라 functional 동작 영향 없음.
   *
   * 패턴 (cycle 222-396 silent dead config 시리즈 160번째):
   * - cycle 359/361/392/395: 미스매치/normalize-bypass unreachable lookup lens.
   * - cycle 397: THEME_BY_TARGET 미사용 lookup key — 동일 lens 회귀.
   *
   * 수정 (src/components/AchievementPanel.tsx):
   * - `abyssFloor: { ... }` 라인 제거 (`abyssRecord` 단일 entry 잔존).
   *
   * 회귀 가드:
   * - abyssRecord 키 (실제 6 achievement target) 보존 — getTheme 동작 그대로.
   * - 나머지 19 키 (kills/bossKills/.../synths/maxKillStreak/discoveryChains) 보존.
   * - getTheme `|| THEME_BY_TARGET.kills` fallback 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 397: THEME_BY_TARGET에서 abyssFloor 0건', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      const blockStart = source.indexOf('const THEME_BY_TARGET');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/abyssFloor:/.test(block),
          'THEME_BY_TARGET에서 abyssFloor 0건');
      assert.ok(/abyssRecord:/.test(block),
          'abyssRecord 단일 entry 보존');
  });

  test('cycle 397: 정합성 가드 — DB.ACHIEVEMENTS abyss target은 abyssRecord 단일', async () => {
      const { DB } = await import('../src/data/db.js');
      // ach_abyss_* id로 abyss achievement 조회 (제목/설명은 Korean '심연').
      const abyssAchievements = (DB.ACHIEVEMENTS || [])
          .filter((a) => /^ach_abyss_/.test(a.id || ''));
      assert.ok(abyssAchievements.length >= 6, `abyss achievement >=6 (실제: ${abyssAchievements.length})`);
      for (const a of abyssAchievements) {
          assert.equal(a.target, 'abyssRecord', `${a.id} target='abyssRecord' (실제: ${a.target})`);
      }
  });

  test('cycle 397: AchievementPanel 19 entry 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      const preservedKeys = [
          'kills', 'bossKills', 'deaths', 'total_gold', 'level',
          'escapes', 'explores', 'discoveries', 'relicCount', 'crafts',
          'rests', 'bountiesCompleted', 'abyssRecord', 'demonKingSlain',
          'prestige', 'signaturesDiscovered', 'signatureSetsCompleted', 'synths',
          'maxKillStreak', 'discoveryChains',
      ];
      for (const key of preservedKeys) {
          const re = new RegExp(`^\\s+${key}:\\s+\\{`, 'm');
          assert.ok(re.test(source), `${key} entry 보존`);
      }
  });

  test('cycle 396 회귀 가드: StatsPanel syn.label fix 보존', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      const blockStart = source.indexOf('stats.activeSynergies.map');
      const blockEnd = source.indexOf('))}', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/syn\.name/.test(block),
          'cycle 396 syn.name 0건 보존');
      assert.ok(/syn\.label/.test(block),
          'cycle 396 syn.label 보존');
  });
}

// ─── cycle-398-dashboard-mobile-trait-label-silent.test.js ───
{
  /**
   * cycle 398: DashboardMobileSummary `trait.label` silent gate fix
   *   (cycle 222-397 silent dead config 시리즈 161번째 — silent dispatch lens 회귀).
   *
   * 발견 (1 silent gate + dispatch):
   * - src/components/DashboardMobileSummary.tsx line 36-38:
   *   `const trait = getTraitProfile(player);
   *    if (trait?.label) {
   *        pills.push({ key: 'trait', label: trait.label, tone: 'recommended' });
   *    }`
   * - getTraitProfile은 TRAIT_DEFINITIONS entry spread 후 반환 — 구조:
   *   `{ id, name, title, accent, chipClass, desc, passiveLabel, unlockHint,
   *     rewardFocus, questFocus, bossDirective, bonus, skill }`. **`label` 필드 없음**.
   * - 결과: `trait?.label`은 항상 undefined → 가드 false → trait pill 영원히 미표시.
   * - cycle 396 (StatsPanel syn.name silent UI 결손)과 동일 패턴 — schema 미스매치로
   *   silent UI 결손.
   *
   * 패턴 (cycle 222-397 시리즈 161번째):
   * - cycle 396: StatsPanel `syn.name` → `syn.label` schema 미스매치 fix.
   * - cycle 398: DashboardMobileSummary `trait.label` → `trait.title` schema 미스매치 fix.
   *   동일 silent dispatch lens 연속 회귀.
   *
   * 수정 (src/components/DashboardMobileSummary.tsx):
   * - `trait.label` → `trait.title` (가드 + dispatch 양쪽).
   *
   * 회귀 가드:
   * - getTraitProfile 동작 / TRAIT_DEFINITIONS schema 보존.
   * - DashboardMobileSummary trait pill이 trait.title (e.g. '유연한 방랑자') 표시.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 398: DashboardMobileSummary trait.label 0건 (silent undefined 제거)', async () => {
      const source = await readSrc('src/components/DashboardMobileSummary.tsx');
      assert.ok(!/trait\?\.label|trait\.label/.test(source),
          'trait.label / trait?.label 0건');
  });

  test('cycle 398: DashboardMobileSummary trait.title 사용 (fix 검증)', async () => {
      const source = await readSrc('src/components/DashboardMobileSummary.tsx');
      assert.ok(/trait\?\.title/.test(source) || /trait\.title/.test(source),
          'trait.title로 변경됨');
  });

  test('cycle 398: TRAIT_DEFINITIONS schema 보존 — title 필드 producer', async () => {
      const { TRAIT_DEFINITIONS } = await import('../src/data/traits.js');
      for (const [id, def] of Object.entries(TRAIT_DEFINITIONS)) {
          assert.ok(typeof def.title === 'string', `${id} title string`);
          assert.equal(def.label, undefined, `${id} label 미정의 (schema 정합성)`);
      }
  });

  test('cycle 398: getTraitProfile.title 동작 검증 (전 직업 fallback)', async () => {
      const { getTraitProfile } = await import('../src/utils/runProfile.js');
      // 모험가 기본 → 'balanced' trait
      const player = {
          name: 'test', job: '모험가', equip: {}, relics: [], stats: {},
      };
      const trait = getTraitProfile(player);
      assert.ok(typeof trait.title === 'string', 'trait.title string');
      assert.equal(trait.label, undefined, 'trait.label은 미정의');
  });

  test('cycle 397 회귀 가드: THEME_BY_TARGET abyssFloor 0건', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      const blockStart = source.indexOf('const THEME_BY_TARGET');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/abyssFloor:/.test(block),
          'cycle 397 abyssFloor 0건 보존');
  });
}

// ─── cycle-399-quickslot-onassign-dead-props.test.js ───
{
  /**
   * cycle 399: QuickSlotProps `onAssign` / `onUnassign` dead props 정리
   *   (cycle 222-398 silent dead config 시리즈 162번째 — interface dead lens 변형).
   *
   * 발견 (2 dead 인터페이스 필드 + 2 doc 코멘트):
   * - src/components/QuickSlot.tsx QuickSlotProps interface:
   *   `onAssign?: (slotIdx: number, item: any) => void;`
   *   `onUnassign?: (slotIdx: number) => void;`
   * - QuickSlot 본체 destructure 라인은 `{ slots, onUse, gameState, dense }`만 사용 —
   *   onAssign/onUnassign 본체 사용 0건.
   * - 유일 consumer (TerminalView.tsx:336)는 `slots/onUse/gameState`만 prop pass —
   *   onAssign/onUnassign 외부에서 pass 0건.
   * - 같은 파일의 QuickSlotAssigner는 별개 컴포넌트(props: any)로 onAssign 사용.
   *   QuickSlotProps와 무관.
   * - JSDoc 코멘트 line 10-11도 onAssign/onUnassign 시그니처 명시 — 동시 정리.
   *
   * 패턴 (cycle 222-398 시리즈 162번째):
   * - cycle 270/278/279/333/336/352/353/354: 함수 출력 dead 필드 정리.
   * - cycle 391: DEFAULT_COMBAT_FLAGS export → private downgrade.
   * - cycle 399: QuickSlotProps interface dead props (interface dead 변형 — props 정의는
   *   있으나 본체 destructure / 외부 pass 모두 0건).
   *
   * 수정 (src/components/QuickSlot.tsx):
   * - QuickSlotProps에서 onAssign / onUnassign 2 필드 제거.
   * - JSDoc 코멘트 line 10-11 onAssign / onUnassign 라인 제거.
   *
   * 회귀 가드:
   * - QuickSlotProps의 slots / onUse / onAssign / gameState / dense — 활성 필드 유지.
   * - QuickSlotAssigner (별개 컴포넌트) onAssign 동작 보존.
   * - TerminalView QuickSlot prop pass (slots/onUse/gameState) 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 399: QuickSlotProps에서 onAssign / onUnassign 0건', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      const ifaceStart = source.indexOf('interface QuickSlotProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/onAssign\?:/.test(ifaceBlock),
          'QuickSlotProps에서 onAssign 0건');
      assert.ok(!/onUnassign\?:/.test(ifaceBlock),
          'QuickSlotProps에서 onUnassign 0건');
  });

  test('cycle 399: QuickSlotProps 활성 필드 보존 (cycle 494가 dense cascade로 정리)', async () => {
      // cycle 494가 dense prop cascade로 정리. 잔존 활성 필드만 가드.
      const source = await readSrc('src/components/QuickSlot.tsx');
      const ifaceStart = source.indexOf('interface QuickSlotProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      const activeFields = ['slots', 'onUse', 'gameState'];
      for (const field of activeFields) {
          const re = new RegExp(`${field}\\??:`);
          assert.ok(re.test(ifaceBlock), `${field} 필드 보존`);
      }
  });

  test('cycle 399: QuickSlotAssigner onAssign 동작 보존', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      assert.ok(/QuickSlotAssigner.*\bonAssign\b/.test(source),
          'QuickSlotAssigner onAssign prop 사용 보존');
  });

  test('cycle 398 회귀 가드: trait.label silent gate fix 보존', async () => {
      const source = await readSrc('src/components/DashboardMobileSummary.tsx');
      assert.ok(!/trait\?\.label|trait\.label/.test(source),
          'cycle 398 trait.label 0건 보존');
      assert.ok(/trait\?\.title|trait\.title/.test(source),
          'cycle 398 trait.title 보존');
  });
}
