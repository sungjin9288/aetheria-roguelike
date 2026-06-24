import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * 묘비(Grave) cycle 테스트 (audit #1 통합 4개)
 */

// ─── cycle-305-public-graves-dead-state.test.js ───
{
  /**
   * cycle 305: publicGraves dead state 제거 (gameReducer + multiplayerHandlers)
   *   (cycle 222-304 silent dead config 시리즈 75번째 — cleanup lens 연속).
   *
   * 발견 (dead state field):
   * - src/reducers/gameReducer.ts:
   *   - GameState interface에 publicGraves: any[] 선언.
   *   - INITIAL_STATE에 publicGraves: [] 초기화.
   * - src/reducers/handlers/multiplayerHandlers.ts:
   *   - INVADE_GRAVE 핸들러가 state.publicGraves.filter(...)로 read.
   *
   * 그러나:
   * - SET_PUBLIC_GRAVES / ADD_PUBLIC_GRAVE 등 publicGraves에 데이터 추가하는 dispatch 0건.
   * - UI에서 state.publicGraves render / read 0건.
   * - 항상 [] 상태이므로 filter도 항상 no-op.
   *
   * 패턴 (cycle 222-304 silent dead config 시리즈 75번째):
   * - cycle 304: DB wrapper 2 dead key 제거.
   * - cycle 305: publicGraves dead state 제거 — GameState 표면 1개 축소.
   *
   * 수정:
   * - gameReducer.ts: GameState interface publicGraves 필드 제거 + INITIAL_STATE [] 초기화 제거.
   * - multiplayerHandlers.ts: INVADE_GRAVE 핸들러 publicGraves filter 제거 (no-op).
   *   targetUid 인자도 현재 dispatch 미사용이라 함께 제거.
   *
   * 회귀 가드:
   * - INVADE_GRAVE 핸들러 다른 dispatch (inv 추가, dailyInvadeCount, lastInvadeDate) 그대로.
   * - GameState 다른 필드 (player / logs / enemy 등) 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 305: GameState interface publicGraves 필드 제거', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      assert.ok(!/publicGraves:\s*any\[\];/.test(source),
          'publicGraves 타입 필드 제거됨');
  });

  test('cycle 305: INITIAL_STATE publicGraves 초기화 제거', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      assert.ok(!/publicGraves:\s*\[\],/.test(source),
          'publicGraves: [] 초기화 제거됨');
  });

  test('cycle 305: INVADE_GRAVE 핸들러 publicGraves filter 제거', async () => {
      const source = await readSrc('src/reducers/handlers/multiplayerHandlers.ts');
      assert.ok(!/publicGraves:\s*state\.publicGraves\.filter/.test(source),
          'publicGraves filter 제거됨');
  });

  test('cycle 305: INVADE_GRAVE 핸들러 active dispatch 보존', async () => {
      const source = await readSrc('src/reducers/handlers/multiplayerHandlers.ts');
      assert.ok(/dailyInvadeCount/.test(source), 'dailyInvadeCount dispatch 유지');
      assert.ok(/lastInvadeDate/.test(source), 'lastInvadeDate dispatch 유지');
      assert.ok(/syncStatus:\s*'syncing'/.test(source), 'syncStatus syncing 유지');
  });

  test('cycle 304 회귀 가드: DB wrapper 2 dead key 유지 제거', async () => {
      const source = await readSrc('src/data/db.ts');
      assert.ok(!/LOOT_TABLE:\s*any;/.test(source),
          'cycle 304 DB.LOOT_TABLE 제거 유지');
  });
}

// ─── cycle-451-grave-panel-default-compact-redundant.test.js ───
{
  /**
   * cycle 451: GravePanel default `compact = false` redundant 정리
   *   (cycle 222-450 silent dead config 시리즈 208번째 — redundant default annotation
   *   lens 회귀, cycle 364-368/428-434/437/441 패턴).
   *
   * 발견 (1 redundant default value):
   * - src/components/GravePanel.tsx:
   *     `({ player, actions, compact = false }: GravePanelProps) => { ... }`
   * - 호출 사이트 분석 (1곳, compact 명시 전달):
   *     Dashboard.tsx:233: `<GravePanel player={player} actions={actions}
   *                         compact={desktopArchiveCompact} />`
   *   → 호출자 명시 → default false 도달 불가.
   *
   * 패턴 (cycle 222-450 시리즈 208번째):
   * - cycle 364-368/428-434/437/441: redundant default annotation 시리즈.
   * - cycle 451: GravePanel default compact — 동일 lens 회귀 (Dashboard 7 panel
   *   children 중 첫 cleanup, 후속 6 panel batch 가능).
   *
   * 수정 (src/components/GravePanel.tsx):
   * - destructure에서 `compact = false` → `compact`.
   *
   * 회귀 가드:
   * - 1 호출자 명시 compact 전달 → 동작 그대로.
   * - compact 기반 UI 조건 분기 (text size / spacing 등) 모두 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 451: GravePanel destructure에서 default compact 제거 (cycle 476 cascade 보존)', async () => {
      // cycle 476이 GravePanel compact prop 자체를 cascade로 제거. compact
      // 파라미터 보존 → cascade 제거 보존 가드로 업데이트.
      const source = await readSrc('src/components/GravePanel.tsx');
      const fnIdx = source.indexOf('const GravePanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/compact = false/.test(block), 'default compact 제거됨');
      assert.ok(!/\bcompact\b/.test(block), 'cycle 476 cascade로 compact prop 자체 제거됨');
  });

  test('cycle 451: 호출 사이트 정합성 가드 (Dashboard GravePanel 호출 존재)', async () => {
      // cycle 471이 Dashboard의 desktop 컴팩트 플래그 + 10 callsite의 compact prop
      // 전달을 일괄 제거. compact 명시 전달 assertion → 호출 존재 가드로 약화.
      const source = await readSrc('src/components/Dashboard.tsx');
      const callMatch = source.match(/<GravePanel[^/]*\/>/);
      assert.ok(callMatch, 'GravePanel 호출 발견');
  });

  test('cycle 449 회귀 가드: PHYSICAL_ELEMENTS 0건', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(!/PHYSICAL_ELEMENTS/.test(source),
          'cycle 449 PHYSICAL_ELEMENTS 0건 보존');
  });
}

// ─── cycle-476-grave-panel-compact-cascade.test.js ───
{
  /**
   * cycle 476: GravePanel `compact` prop cascade unreachable 정리
   *   (cycle 222-475 silent dead config 시리즈 229번째 — unreachable code path
   *   cascade cleanup, cycle 471-475 paired 6사이클).
   *
   * 발견 (1 prop + 20 ternary 가지 unreachable):
   * - src/components/GravePanel.tsx:
   *     · interface line 15: compact?: boolean.
   *     · destructure line 20: ({ player, actions, compact }).
   *     · 본체 20곳 ternary: text size / icon size / spacing 등.
   * - 호출 사이트:
   *     · Dashboard.tsx:230 — cycle 471이 compact prop 제거. caller 0건.
   *     · 다른 파일 import 0건.
   * - 결과: compact 항상 undefined → 모든 ternary false 가지 선택 (full size 그대로).
   *
   * 수정 (src/components/GravePanel.tsx):
   * - interface compact 제거.
   * - destructure compact 제거.
   * - 20 ternary 모두 false 가지로 inline.
   *
   * 회귀 가드:
   * - player / actions prop 보존.
   * - 본체 grave fetch / invade 로직 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 476: GravePanel destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/GravePanel.tsx');
      const fnIdx = source.indexOf('const GravePanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 476: interface에서 compact 0건', async () => {
      const source = await readSrc('src/components/GravePanel.tsx');
      const ifaceIdx = source.indexOf('interface GravePanelProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
  });

  test('cycle 476: 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/GravePanel.tsx');
      assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
  });

  test('cycle 476: 정합성 가드 — Dashboard <GravePanel> compact 전달 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const idx = source.indexOf('<GravePanel');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <GravePanel> compact 전달 0건');
  });

  test('cycle 476: player / actions / fetchGraves / invade 핵심 로직 보존', async () => {
      const source = await readSrc('src/components/GravePanel.tsx');
      assert.ok(/fetchGraves/.test(source), 'fetchGraves 보존');
      assert.ok(/DAILY_INVADE_LIMIT/.test(source), 'DAILY_INVADE_LIMIT 로직 보존');
      const fnIdx = source.indexOf('const GravePanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
      assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
  });
}

// ─── cycle-609-build-grave-data-explicit-defaults-elimination.test.js ───
{
  /**
   * cycle 609: buildGraveData random/now explicit default-elimination
   *   (cycle 222-608 silent dead config 시리즈 345번째 — explicit default-elimination
   *   pattern 2번째 적용 후, cycle 608 신규 lens 회귀).
   *
   * 발견 (2 defaults reachable → unreachable conversion):
   * - src/utils/graveUtils.ts (line 19):
   *     export const buildGraveData = (player: Player, random: any = Math.random,
   *         now: any = Date.now) => {...};
   * - 호출 사이트:
   *     · src/systems/CombatEngine.ts:1640 — buildGraveData(player) — 1 arg only.
   *       random/now defaults 활성.
   *     · tests/cycle-246/grave-recovery — 6 callers 모두 3 args (deterministic
   *       fakes for test) 명시.
   * - 기존 상태: production caller가 random/now 미전달 → defaults Math.random/
   *   Date.now 활성. defaults reachable이었음.
   *
   * 패턴 (cycle 222-608 시리즈 345번째):
   * - cycle 502-608: default 청소 메가 시리즈 107사이클.
   * - cycle 609: explicit default-elimination 2번째 (cycle 608 신규 lens 회귀).
   *   production caller에 명시 args 추가하여 defaults unreachable로 conversion.
   *
   * 수정:
   * - CombatEngine.ts:1640: buildGraveData(player) → buildGraveData(player,
   *   Math.random, Date.now). production caller에 명시 args 추가.
   * - graveUtils.ts:19: random/now defaults 제거.
   *
   * 회귀 가드:
   * - 1 production + 6 test callsite 동작 그대로 (모두 3 args 명시 후).
   * - body의 random()/now() 호출 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 609: buildGraveData signature에서 random/now defaults 0건', async () => {
      const source = await readSrc('src/utils/graveUtils.ts');
      const fnIdx = source.indexOf('export const buildGraveData');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/random:\s*any\s*=\s*Math\.random/.test(sig),
          'buildGraveData random default Math.random 제거');
      assert.ok(!/now:\s*any\s*=\s*Date\.now/.test(sig),
          'buildGraveData now default Date.now 제거');
  });

  test('cycle 609: 정합성 가드 — production callsite Math.random/Date.now 명시 추가', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/buildGraveData\(player,\s*Math\.random,\s*Date\.now\)/.test(source),
          'CombatEngine buildGraveData(player, Math.random, Date.now) 명시');
  });

  test('cycle 609: test callsite 보존 (deterministic fakes)', async () => {
      const test1 = await readSrc('tests/drop-cycle.test.js');
      assert.ok(/buildGraveData\(player,\s*\(\) => 0\.5,\s*\(\) => 1000\)/.test(test1),
          'cycle-246 test callsite 보존');

      const test2 = await readSrc('tests/grave-recovery.test.js');
      assert.ok(/buildGraveData\(player,\s*\(\) => 0\.9,\s*\(\) => 12345\)/.test(test2),
          'grave-recovery test callsite 보존');
  });

  test('cycle 609: cycle 502-608 회귀 가드 — default 청소 시리즈 보존', async () => {
      const intro = await readSrc('src/components/IntroScreen.tsx');
      assert.ok(!/dismissKeyboard:\s*any\s*=\s*false/.test(intro),
          'cycle 608 applyName dismissKeyboard default 0건');

      const mp = await readSrc('src/utils/mapProgress.ts');
      assert.ok(!/uniqueList = \(values:\s*any\s*=\s*\[\]\)/.test(mp),
          'cycle 607 uniqueList values default 0건');
  });
}
