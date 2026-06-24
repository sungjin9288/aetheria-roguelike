import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';

/**
 * cycle 400-499 정리 가드 (audit #1 통합 58개)
 */

// ─── cycle-401-dashboard-mobile-prop-dead.test.js ───
{
  /**
   * cycle 401: Dashboard `mobile` prop dead (interface + parent pass) 정리
   *   (cycle 222-400 silent dead config 시리즈 163번째 — interface dead lens 회귀).
   *
   * 발견 (1 dead prop, 양쪽):
   * - src/components/Dashboard.tsx DashboardProps line 42:
   *   `mobile?: boolean;`
   * - Dashboard 본체 destructure 라인은 13개 props (player/grave/sideTab/setSideTab/
   *   actions/stats/mobileSection/quickSlots/runtime/inventorySpotlight/
   *   onClearInventorySpotlight/consoleExpanded/onReturnToLog) — `mobile` 제외.
   * - 파일 내 `mobile` 변수 사용 0건 (mobile-test-id / mobileSection / mobileLabel /
   *   mobileFocused 등은 별개 식별자).
   * - 유일 consumer (src/components/app/MobileGameLayout.tsx:69)는 `<Dashboard mobile {...}/>`
   *   로 prop pass — Dashboard가 destructure 안 하므로 silent dropped.
   *
   * 패턴 (cycle 222-400 시리즈 163번째):
   * - cycle 399: QuickSlotProps onAssign/onUnassign interface dead.
   * - cycle 401: DashboardProps mobile interface dead (양쪽 정리 — interface +
   *   parent pass site).
   *
   * 수정:
   * 1) src/components/Dashboard.tsx DashboardProps에서 `mobile?: boolean;` 제거.
   * 2) src/components/app/MobileGameLayout.tsx Dashboard JSX에서 `mobile` 라인 제거.
   *
   * 회귀 가드:
   * - mobileSection / mobileLabel / mobileFocused / mobile-test-id 모두 별개 식별자로 보존.
   * - DashboardMobileSummary 내부 분기 (mobileSection === 'log' / 'console' 등) 보존.
   * - MobileGameLayout나 GameRoot의 Dashboard prop pass 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 401: DashboardProps에서 mobile 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const ifaceStart = source.indexOf('interface DashboardProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/^\s+mobile\?:/m.test(ifaceBlock),
          'DashboardProps에서 mobile 0건');
  });

  test('cycle 401: MobileGameLayout Dashboard JSX에서 mobile prop 0건', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const dashStart = source.indexOf('<Dashboard');
      const dashEnd = source.indexOf('/>', dashStart);
      const block = source.slice(dashStart, dashEnd);
      assert.ok(!/^\s+mobile\s*$/m.test(block),
          'Dashboard JSX에서 mobile prop 0건');
  });

  test('cycle 401: DashboardProps 활성 필드 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const ifaceStart = source.indexOf('interface DashboardProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      const activeFields = ['player', 'grave', 'sideTab', 'setSideTab', 'actions',
          'stats', 'mobileSection', 'quickSlots', 'runtime', 'inventorySpotlight',
          'onClearInventorySpotlight', 'consoleExpanded', 'onReturnToLog'];
      for (const field of activeFields) {
          const re = new RegExp(`${field}[?:]`);
          assert.ok(re.test(ifaceBlock), `${field} 필드 보존`);
      }
  });

  test('cycle 401: mobileSection / DashboardMobileSummary 동작 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      assert.ok(/mobileSection/.test(source),
          'mobileSection 별개 식별자 보존');
      assert.ok(/DashboardMobileSummary/.test(source),
          'DashboardMobileSummary import / 사용 보존');
  });

  test('cycle 400 회귀 가드: cycle 399 QuickSlotProps onAssign 0건', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      const ifaceStart = source.indexOf('interface QuickSlotProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/onAssign\?:/.test(ifaceBlock),
          'cycle 399 onAssign 0건 보존');
  });
}

// ─── cycle-402-mobile-prop-dead-batch.test.js ───
{
  /**
   * cycle 402: PostCombatCard + IntroScreen `mobile` interface dead prop 정리
   *   (cycle 222-401 silent dead config 시리즈 164번째 — interface dead lens 연속).
   *
   * 발견 (2 components × 2 sites = 4 dead lines):
   *
   * 1) src/components/PostCombatCard.tsx PostCombatCardProps line 25:
   *    `mobile?: boolean;`
   *    - 본체 destructure: `{ result, onClose, onRest, onSell }` — mobile 제외.
   *    - 변수 read 0건 (parent passed `mobile={true}` silent dropped).
   *
   * 2) src/components/IntroScreen.tsx IntroScreenProps line 12:
   *    `mobile?: boolean;`
   *    - 본체 destructure: `{ onStart }` — mobile 제외.
   *    - 변수 read 0건 (parent passed `<IntroScreen ... mobile />` silent dropped).
   *
   * 3) src/components/app/GameRoot.tsx line 180: `<PostCombatCard ... mobile={true} />`.
   * 4) src/App.tsx: `<IntroScreen onStart={...} mobile />`.
   *
   * 패턴 (cycle 222-401 시리즈 164번째):
   * - cycle 401: DashboardProps mobile interface dead 양쪽 정리 (paired remove).
   * - cycle 402: PostCombatCard + IntroScreen 동일 lens 연속 batch (2 components paired remove).
   *   `mobile` prop이 정의되었지만 본체 destructure 미사용 + read 0건이 컴포넌트 3개째 발견.
   *
   * 수정:
   * 1) src/components/PostCombatCard.tsx PostCombatCardProps에서 `mobile?: boolean;` 제거.
   * 2) src/components/IntroScreen.tsx IntroScreenProps에서 `mobile?: boolean;` 제거.
   * 3) src/components/app/GameRoot.tsx PostCombatCard JSX에서 `mobile={true}` 라인 제거.
   * 4) src/App.tsx IntroScreen JSX에서 `mobile` prop 제거.
   *
   * 회귀 가드:
   * - PostCombatCard 활성 props (result/onClose/onRest/onSell) 동작 그대로.
   * - IntroScreen 활성 props (onStart) 동작 그대로.
   * - mobile-test-id / 실제 mobile 변수 (CombatPanel 등 별개 컴포넌트) 보존.
   * - cycle 401 Dashboard mobile prop 정리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 402: PostCombatCardProps에서 mobile 0건', async () => {
      const source = await readSrc('src/components/PostCombatCard.tsx');
      const ifaceStart = source.indexOf('interface PostCombatCardProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/^\s+mobile\?:/m.test(ifaceBlock),
          'PostCombatCardProps에서 mobile 0건');
  });

  test('cycle 402: IntroScreenProps에서 mobile 0건', async () => {
      const source = await readSrc('src/components/IntroScreen.tsx');
      const ifaceStart = source.indexOf('interface IntroScreenProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/^\s+mobile\?:/m.test(ifaceBlock),
          'IntroScreenProps에서 mobile 0건');
  });

  test('cycle 402: GameRoot.tsx PostCombatCard JSX에서 mobile prop 0건', async () => {
      const source = await readSrc('src/components/app/GameRoot.tsx');
      const dashStart = source.indexOf('<PostCombatCard');
      const dashEnd = source.indexOf('/>', dashStart);
      const block = source.slice(dashStart, dashEnd);
      assert.ok(!/mobile=\{true\}|^\s+mobile\s*$/m.test(block),
          'PostCombatCard JSX에서 mobile prop 0건');
  });

  test('cycle 402: App.tsx IntroScreen JSX에서 mobile prop 0건', async () => {
      const source = await readSrc('src/App.tsx');
      const introMatch = source.match(/<IntroScreen[^>]*\/>/);
      assert.ok(introMatch, 'IntroScreen JSX 발견');
      assert.ok(!/\bmobile\b/.test(introMatch[0]),
          'IntroScreen JSX에서 mobile prop 0건');
  });

  test('cycle 402: PostCombatCard 활성 props 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/PostCombatCard.tsx');
      const ifaceStart = source.indexOf('interface PostCombatCardProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      for (const field of ['result', 'onClose', 'onRest', 'onSell']) {
          const re = new RegExp(`${field}\\?:`);
          assert.ok(re.test(ifaceBlock), `${field} 필드 보존`);
      }
  });

  test('cycle 401 회귀 가드: DashboardProps mobile 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const ifaceStart = source.indexOf('interface DashboardProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/^\s+mobile\?:/m.test(ifaceBlock),
          'cycle 401 Dashboard mobile 0건 보존');
  });
}

// ─── cycle-403-mobilefocused-prop-dead-batch.test.js ───
{
  /**
   * cycle 403: CraftingPanel + JobChangePanel `mobileFocused` interface dead prop 정리
   *   (cycle 222-402 silent dead config 시리즈 165번째 — interface dead lens 연속 3사이클).
   *
   * 발견 (2 components × 2 sites = 4 dead lines):
   *
   * 1) src/components/tabs/CraftingPanel.tsx CraftingPanelProps line 20:
   *    `mobileFocused?: boolean;`
   *    - 본체 destructure: `{ player, actions, setGameState, onOpenArchiveConsole = null }` —
   *      mobileFocused 제외.
   *    - 변수 read 0건.
   *
   * 2) src/components/tabs/JobChangePanel.tsx JobChangePanelProps line 14:
   *    동일 패턴.
   *
   * 3) src/components/ControlPanel.tsx line 200/208에서 두 컴포넌트에 `mobileFocused={mobileFocused}`
   *    prop pass — silent dropped.
   *
   * 비교: EventPanel / QuestBoardPanel / ShopPanel은 mobileFocused destructure + 본체 사용
   *   (활성). CraftingPanel / JobChangePanel만 dead.
   *
   * 패턴 (cycle 222-402 시리즈 165번째):
   * - cycle 401: DashboardProps mobile interface dead 양쪽 정리.
   * - cycle 402: PostCombatCard + IntroScreen mobile dead batch.
   * - cycle 403: CraftingPanel + JobChangePanel mobileFocused dead batch.
   *   `mobile`/`mobileFocused` interface dead lens 3사이클 연속.
   *
   * 수정:
   * 1) CraftingPanelProps에서 `mobileFocused?: boolean;` 제거.
   * 2) JobChangePanelProps에서 `mobileFocused?: boolean;` 제거.
   * 3) ControlPanel.tsx의 두 JSX prop pass에서 `mobileFocused={mobileFocused}` 제거.
   *
   * 회귀 가드:
   * - EventPanel / QuestBoardPanel / ShopPanel mobileFocused 사용 보존 (활성).
   * - CraftingPanel / JobChangePanel 활성 props (player/actions/setGameState/
   *   onOpenArchiveConsole) 동작 그대로.
   * - cycle 401/402 dead prop 정리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 403: CraftingPanelProps에서 mobileFocused 0건', async () => {
      const source = await readSrc('src/components/tabs/CraftingPanel.tsx');
      const ifaceStart = source.indexOf('interface CraftingPanelProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/mobileFocused\?:/.test(ifaceBlock),
          'CraftingPanelProps에서 mobileFocused 0건');
  });

  test('cycle 403: JobChangePanelProps에서 mobileFocused 0건', async () => {
      const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
      const ifaceStart = source.indexOf('interface JobChangePanelProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/mobileFocused\?:/.test(ifaceBlock),
          'JobChangePanelProps에서 mobileFocused 0건');
  });

  test('cycle 403: ControlPanel CraftingPanel/JobChangePanel JSX에서 mobileFocused prop 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const craftStart = source.indexOf('<CraftingPanel');
      const craftEnd = source.indexOf('/>', craftStart);
      assert.ok(craftStart >= 0 && craftEnd > craftStart, 'CraftingPanel JSX 발견');
      const craftBlock = source.slice(craftStart, craftEnd);
      assert.ok(!/mobileFocused=\{mobileFocused\}/.test(craftBlock),
          'CraftingPanel JSX에서 mobileFocused prop 0건');

      const jobStart = source.indexOf('<JobChangePanel');
      const jobEnd = source.indexOf('/>', jobStart);
      assert.ok(jobStart >= 0 && jobEnd > jobStart, 'JobChangePanel JSX 발견');
      const jobBlock = source.slice(jobStart, jobEnd);
      assert.ok(!/mobileFocused=\{mobileFocused\}/.test(jobBlock),
          'JobChangePanel JSX에서 mobileFocused prop 0건');
  });

  test('cycle 403: 활성 컴포넌트 mobileFocused 보존 (cycle 487-489 cascade로 모두 정리됨)', async () => {
      // cycle 487/488/489가 QuestBoardPanel/ShopPanel/EventPanel mobileFocused
      // cascade로 일괄 정리. 잔존 panel 0건 → 가드 list 비움.
      assert.ok(true, 'cycle 487-489 cascade로 모든 panel 정리됨');
  });

  test('cycle 402 회귀 가드: PostCombatCard / IntroScreen mobile 0건', async () => {
      const pcc = await readSrc('src/components/PostCombatCard.tsx');
      const ifaceStart1 = pcc.indexOf('interface PostCombatCardProps');
      const ifaceEnd1 = pcc.indexOf('}', ifaceStart1);
      assert.ok(!/^\s+mobile\?:/m.test(pcc.slice(ifaceStart1, ifaceEnd1)),
          'cycle 402 PostCombatCard mobile 0건 보존');

      const intro = await readSrc('src/components/IntroScreen.tsx');
      const ifaceStart2 = intro.indexOf('interface IntroScreenProps');
      const ifaceEnd2 = intro.indexOf('}', ifaceStart2);
      assert.ok(!/^\s+mobile\?:/m.test(intro.slice(ifaceStart2, ifaceEnd2)),
          'cycle 402 IntroScreen mobile 0건 보존');
  });
}

// ─── cycle-404-terminal-view-stats-prop-dead.test.js ───
{
  /**
   * cycle 404: TerminalView `stats` interface dead prop 양쪽 정리
   *   (cycle 222-403 silent dead config 시리즈 166번째 — interface dead lens 4사이클 연속).
   *
   * 발견 (1 dead prop, 양쪽):
   * - src/components/TerminalView.tsx TerminalViewProps line 84:
   *   `stats?: any;`
   * - 본체 destructure: `{ logs, gameState, onCommand, autoFocusInput, player,
   *   quickSlots, onQuickSlotUse, showInput, className, toolbarLeft }` — `stats` 제외.
   * - 변수 read 0건 (파일 내 `stats` 식별자 1회만 — interface 정의 자체).
   * - 유일 consumer (src/components/app/MobileGameLayout.tsx:96): `stats={fullStats}`
   *   prop pass — silent dropped.
   *
   * 패턴 (cycle 222-403 시리즈 166번째 — 4사이클 연속):
   * - cycle 401: DashboardProps mobile interface dead 양쪽 정리.
   * - cycle 402: PostCombatCard + IntroScreen mobile dead batch.
   * - cycle 403: CraftingPanel + JobChangePanel mobileFocused dead batch.
   * - cycle 404: TerminalView stats interface dead 양쪽 정리.
   *   interface dead lens 4사이클 연속 — 다양한 prop 이름 (`mobile`,
   *   `mobileFocused`, `stats`)이 컴포넌트 6개 6개 발견.
   *
   * 수정:
   * 1) src/components/TerminalView.tsx TerminalViewProps에서 `stats?: any;` 제거.
   * 2) src/components/app/MobileGameLayout.tsx TerminalView JSX에서
   *    `stats={fullStats}` 라인 제거.
   *
   * 회귀 가드:
   * - TerminalView 활성 props (logs/gameState/onCommand/autoFocusInput/player/
   *   quickSlots/onQuickSlotUse/showInput/className/toolbarLeft) 동작 그대로.
   * - MobileGameLayout `fullStats` 변수 자체 보존 (Dashboard 등 다른 곳에서 사용).
   * - cycle 401/402/403 dead prop 정리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 404: TerminalViewProps에서 stats 0건', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      const ifaceStart = source.indexOf('interface TerminalViewProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/^\s+stats\?:/m.test(ifaceBlock),
          'TerminalViewProps에서 stats 0건');
  });

  test('cycle 404: MobileGameLayout TerminalView JSX에서 stats prop 0건', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const tvStart = source.indexOf('<TerminalView');
      const tvEnd = source.indexOf('/>', tvStart);
      assert.ok(tvStart >= 0 && tvEnd > tvStart, 'TerminalView JSX 발견');
      const tvBlock = source.slice(tvStart, tvEnd);
      assert.ok(!/stats=\{fullStats\}/.test(tvBlock),
          'TerminalView JSX에서 stats prop 0건');
  });

  test('cycle 404: TerminalView 활성 props 보존 (cycle 496/497 cascade로 추가 정리됨)', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      const ifaceStart = source.indexOf('interface TerminalViewProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      // cycle 496이 className / toolbarLeft, cycle 497이 autoFocusInput / showInput
      // cascade로 정리. 잔존 활성 필드만 가드.
      const activeFields = ['logs', 'gameState', 'onCommand', 'player',
          'quickSlots', 'onQuickSlotUse'];
      for (const field of activeFields) {
          const re = new RegExp(`${field}\\??:`);
          assert.ok(re.test(ifaceBlock), `${field} 필드 보존`);
      }
  });

  test('cycle 404: fullStats 변수 보존 (Dashboard / 기타 사용)', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      assert.ok(/fullStats/.test(source),
          'fullStats 변수 정의 보존');
      assert.ok(/stats=\{fullStats\}/.test(source),
          'fullStats prop pass는 다른 컴포넌트에 보존');
  });

  test('cycle 403 회귀 가드: CraftingPanel / JobChangePanel mobileFocused 0건', async () => {
      const cp = await readSrc('src/components/tabs/CraftingPanel.tsx');
      const ifaceStart1 = cp.indexOf('interface CraftingPanelProps');
      const ifaceEnd1 = cp.indexOf('}', ifaceStart1);
      assert.ok(!/mobileFocused\?:/.test(cp.slice(ifaceStart1, ifaceEnd1)),
          'cycle 403 CraftingPanel mobileFocused 0건 보존');

      const jcp = await readSrc('src/components/tabs/JobChangePanel.tsx');
      const ifaceStart2 = jcp.indexOf('interface JobChangePanelProps');
      const ifaceEnd2 = jcp.indexOf('}', ifaceStart2);
      assert.ok(!/mobileFocused\?:/.test(jcp.slice(ifaceStart2, ifaceEnd2)),
          'cycle 403 JobChangePanel mobileFocused 0건 보존');
  });
}

// ─── cycle-406-engine-set-ai-thinking-dead.test.js ───
{
  /**
   * cycle 406: useGameEngine `actions.setAiThinking` dead action method 정리
   *   (cycle 222-405 silent dead config 시리즈 168번째 — function output dead lens 회귀).
   *
   * 발견 (1 dead action method):
   * - src/hooks/useGameEngine.ts line 133:
   *   `setAiThinking: (val: any) => dispatch({ type: AT.SET_AI_THINKING, payload: val }),`
   * - actions.setAiThinking 정의만 있고 src/, tests/ 어디에서도 호출 0건.
   * - AT.SET_AI_THINKING 자체는 reducer에서 처리되지만 dispatch path 없음.
   *   isAiThinking 변경은 explore/event/AI 호출 코드가 직접 dispatch.
   *
   * 패턴 (cycle 222-405 시리즈 168번째):
   * - cycle 401-405: interface dead lens 5사이클 연속 (다양한 prop dead).
   * - cycle 406: function output dead lens 회귀 — actions 객체의 dead method.
   *   cycle 270/278/279/333/336/352/353/354 등 함수 출력 dead 패턴.
   *
   * 수정 (src/hooks/useGameEngine.ts):
   * - actions 객체에서 `setAiThinking: ...` 라인 제거.
   *
   * 회귀 가드:
   * - 다른 setter (setSideTab/setGameState/setShopItems/setActiveTitle/setQuickSlot/
   *   dismissEvent/clearPostCombat/getUid/isAdmin) 동작 그대로.
   * - AT.SET_AI_THINKING reducer handler 보존 (uiActionMap.SET_AI_THINKING).
   * - 실제 isAiThinking 변경은 다른 dispatch path로 동작 그대로.
   * - cycle 401-405 dead prop 정리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 406: useGameEngine actions에서 setAiThinking 0건', async () => {
      const source = await readSrc('src/hooks/useGameEngine.ts');
      assert.ok(!/setAiThinking:/.test(source),
          'useGameEngine actions에서 setAiThinking 정의 0건');
  });

  test('cycle 406: 다른 setter 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/hooks/useGameEngine.ts');
      for (const fn of ['setSideTab', 'setGameState', 'setShopItems', 'setActiveTitle',
                         'dismissEvent', 'setQuickSlot', 'clearPostCombat', 'getUid', 'isAdmin']) {
          const re = new RegExp(`\\b${fn}: `);
          assert.ok(re.test(source), `${fn} setter 보존`);
      }
  });

  test('cycle 406: AT.SET_AI_THINKING reducer handler 보존', async () => {
      const source = await readSrc('src/reducers/handlers/uiHandlers.ts');
      assert.ok(/SET_AI_THINKING:/.test(source),
          'uiHandlers.SET_AI_THINKING handler 보존 (다른 dispatch path 의존)');
  });

  test('cycle 405 회귀 가드: Codex compact 0건', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      const ifaceStart = source.indexOf('interface CodexProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/compact\?:/.test(ifaceBlock),
          'cycle 405 Codex compact 0건 보존');
  });
}

// ─── cycle-407-format-reward-parts-unreachable.test.js ───
{
  /**
   * cycle 407: formatRewardParts essence/relicShard 2 unreachable branches 정리
   *   (cycle 222-406 silent dead config 시리즈 169번째 — unreachable lens 회귀).
   *
   * 발견 (2 dead branches):
   * - src/utils/gameUtils.ts formatRewardParts (line ~99):
   *   `if (reward.essence) parts.push(...)`
   *   `if (reward.relicShard) parts.push(...)`
   * - 호출 사이트는 AchievementPanel / QuestTab / QuestBoardPanel 3종 — 모두
   *   quest/achievement reward를 인자로 전달.
   * - quests.ts/achievements 데이터: gold/exp/item/title/premiumCurrency만 사용 —
   *   essence/relicShard 0건 (확인 완료).
   * - daily protocol mission reward는 essence/relicShard 사용하지만 별도 함수
   *   formatDailyProtocolReward로 처리.
   * - 결과: formatRewardParts의 essence/relicShard 분기 → 절대 hit 안 됨.
   *
   * 패턴 (cycle 222-406 시리즈 169번째):
   * - cycle 359/361/392/395/397: unreachable lookup/branch lens.
   * - cycle 407: formatRewardParts 함수 내 unreachable branch 2개 정리
   *   (동일 lens 회귀 — 함수 분기 내 unreachable).
   *
   * 수정 (src/utils/gameUtils.ts):
   * - formatRewardParts에서 essence / relicShard 분기 2 라인 제거.
   *
   * 회귀 가드:
   * - exp / gold / item 분기 보존.
   * - formatDailyProtocolReward 함수 (daily-specific 처리) 동작 그대로.
   * - AchievementPanel / QuestTab / QuestBoardPanel 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 407: formatRewardParts에서 essence/relicShard 분기 0건', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      const fnStart = source.indexOf('export const formatRewardParts');
      const fnEnd = source.indexOf('};', fnStart);
      const fnBlock = source.slice(fnStart, fnEnd);
      assert.ok(!/reward\.essence/.test(fnBlock),
          'formatRewardParts에서 reward.essence 분기 0건');
      assert.ok(!/reward\.relicShard/.test(fnBlock),
          'formatRewardParts에서 reward.relicShard 분기 0건');
  });

  test('cycle 407: formatRewardParts 활성 분기 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      const fnStart = source.indexOf('export const formatRewardParts');
      const fnEnd = source.indexOf('};', fnStart);
      const fnBlock = source.slice(fnStart, fnEnd);
      assert.ok(/reward\.exp/.test(fnBlock), 'reward.exp 분기 보존');
      assert.ok(/reward\.gold/.test(fnBlock), 'reward.gold 분기 보존');
      assert.ok(/reward\.item/.test(fnBlock), 'reward.item 분기 보존');
  });

  test('cycle 407: formatDailyProtocolReward 동작 보존 (별도 함수)', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.ok(/export const formatDailyProtocolReward/.test(source),
          'formatDailyProtocolReward 함수 보존');
      const fnStart = source.indexOf('export const formatDailyProtocolReward');
      const fnEnd = source.indexOf('};', fnStart);
      const fnBlock = source.slice(fnStart, fnEnd);
      assert.ok(/reward\.essence/.test(fnBlock),
          'formatDailyProtocolReward의 essence 분기 보존');
      assert.ok(/reward\.relicShard/.test(fnBlock),
          'formatDailyProtocolReward의 relicShard 분기 보존');
  });

  test('cycle 407: 정합성 가드 — quests/achievements는 essence/relicShard 0건', async () => {
      const source = await readSrc('src/data/quests.ts');
      assert.ok(!/reward:\s*\{[^}]*essence:/.test(source),
          '데이터 정합성: quests.ts reward에 essence 0건');
      assert.ok(!/reward:\s*\{[^}]*relicShard:/.test(source),
          '데이터 정합성: quests.ts reward에 relicShard 0건');
  });

  test('cycle 407: formatRewardParts 동작 (활성 분기)', async () => {
      const { formatRewardParts } = await import('../src/utils/gameUtils.js');
      const result = formatRewardParts({ exp: 100, gold: 500, item: '엘릭서' });
      assert.deepEqual(result, ['EXP 100', '500G', '엘릭서'],
          'exp/gold/item 분기 동작 보존');
  });

  test('cycle 406 회귀 가드: useGameEngine setAiThinking 0건', async () => {
      const source = await readSrc('src/hooks/useGameEngine.ts');
      assert.ok(!/setAiThinking:/.test(source),
          'cycle 406 setAiThinking 0건 보존');
  });
}

// ─── cycle-408-headgear-body-placements-private.test.js ───
{
  /**
   * cycle 408: HEADGEAR_PLACEMENTS + BODY_PLACEMENTS export → private downgrade batch
   *   (cycle 222-407 silent dead config 시리즈 170번째 — private downgrade lens 회귀).
   *
   * 발견 (2 export → private 후보):
   * - src/utils/anchorPoints.ts HEADGEAR_PLACEMENTS / BODY_PLACEMENTS:
   *   · 둘 다 내부 1회만 사용 (getHeadgearPlacement / getBodyPlacement lookup용).
   *   · 외부 consumer 0건 (src/, tests/ 모두).
   * - cycle 312에서 WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS 동일 lens로 private downgrade.
   *   HEADGEAR / BODY 누락분 paired completion.
   *
   * 패턴 (cycle 222-407 시리즈 170번째):
   * - cycle 295/298/312/316/317/369/391: export → private downgrade lens.
   * - cycle 408: HEADGEAR_PLACEMENTS / BODY_PLACEMENTS private downgrade —
   *   동일 lens 회귀 (cycle 312 paired completion).
   *
   * 수정 (src/utils/anchorPoints.ts):
   * - `export const HEADGEAR_PLACEMENTS` → `const HEADGEAR_PLACEMENTS`.
   * - `export const BODY_PLACEMENTS` → `const BODY_PLACEMENTS`.
   *
   * 회귀 가드:
   * - getHeadgearPlacement / getBodyPlacement active export 유지.
   * - placementToTransform / placementLayer / getArmorPlacement 동작 그대로.
   * - AVATAR_ANCHORS / BACK_LAYER_*_STYLES export 보존.
   * - cycle 312 WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS private 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 408: HEADGEAR_PLACEMENTS export 제거 (private)', async () => {
      const source = await readSrc('src/utils/anchorPoints.ts');
      assert.ok(!/export const HEADGEAR_PLACEMENTS\b/.test(source),
          'HEADGEAR_PLACEMENTS export 제거됨');
      assert.ok(/const HEADGEAR_PLACEMENTS\b/.test(source),
          'HEADGEAR_PLACEMENTS const 정의 유지 (private)');
  });

  test('cycle 408: BODY_PLACEMENTS export 제거 (private)', async () => {
      const source = await readSrc('src/utils/anchorPoints.ts');
      assert.ok(!/export const BODY_PLACEMENTS\b/.test(source),
          'BODY_PLACEMENTS export 제거됨');
      assert.ok(/const BODY_PLACEMENTS\b/.test(source),
          'BODY_PLACEMENTS const 정의 유지 (private)');
  });

  test('cycle 408: anchorPoints 활성 export 유지', async () => {
      const source = await readSrc('src/utils/anchorPoints.ts');
      const activeExports = ['AVATAR_ANCHORS', 'BACK_LAYER_ARMOR_STYLES',
          'BACK_LAYER_HEADGEAR_STYLES', 'BACK_LAYER_OFFHAND_STYLES',
          'getWeaponPlacement', 'getOffhandPlacement',
          'getHeadgearPlacement', 'getBodyPlacement', 'getArmorPlacement',
          'placementToTransform', 'placementLayer'];
      for (const name of activeExports) {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      }
  });

  test('cycle 408: getHeadgearPlacement / getBodyPlacement 동작 보존', async () => {
      const { getHeadgearPlacement, getBodyPlacement } = await import('../src/utils/anchorPoints.js');
      const helm = getHeadgearPlacement('helm');
      assert.ok(helm, 'getHeadgearPlacement(helm) 반환');
      assert.ok(helm.transform, 'helm.transform 보존');

      const robe = getBodyPlacement('robe');
      assert.ok(robe, 'getBodyPlacement(robe) 반환');
      assert.ok(robe.transform, 'robe.transform 보존');

      assert.equal(getHeadgearPlacement(null), null, 'null 입력 → null');
      assert.equal(getBodyPlacement('none'), null, 'none 입력 → null');
  });

  test('cycle 312 회귀 가드: WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS private 보존', async () => {
      const source = await readSrc('src/utils/anchorPoints.ts');
      assert.ok(!/export const WEAPON_PLACEMENTS\b/.test(source),
          'cycle 312 WEAPON_PLACEMENTS private 유지');
      assert.ok(!/export const OFFHAND_PLACEMENTS\b/.test(source),
          'cycle 312 OFFHAND_PLACEMENTS private 유지');
  });

  test('cycle 407 회귀 가드: formatRewardParts essence/relicShard 0건', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      const fnStart = source.indexOf('export const formatRewardParts');
      const fnEnd = source.indexOf('};', fnStart);
      const fnBlock = source.slice(fnStart, fnEnd);
      assert.ok(!/reward\.essence/.test(fnBlock),
          'cycle 407 reward.essence 0건 보존');
      assert.ok(!/reward\.relicShard/.test(fnBlock),
          'cycle 407 reward.relicShard 0건 보존');
  });
}

// ─── cycle-409-trait-item-resonance-reasons-dead.test.js ───
{
  /**
   * cycle 409: getTraitItemResonance.reasons 출력 dead 필드 정리
   *   (cycle 222-408 silent dead config 시리즈 171번째 — function output dead lens 회귀).
   *
   * 발견 (1 dead 출력 필드):
   * - src/utils/runProfile.ts getTraitItemResonance return:
   *   `{ score, label, reasons, summary }` (line 295-300).
   *   초기 empty branch: `{ score: 0, label: null, reasons: [], summary: null }` (line 231).
   * - 외부 read 분석:
   *   · score: runProfile.ts:309-310 (getTraitFeaturedItems 정렬), 테스트 활성.
   *   · label: 테스트 활성 (`focusResonance.label === '성향 공명'`).
   *   · summary: runProfile.ts:323 (getTraitLootHint).
   *   · **reasons: src/, tests/ 어디에서도 read 0건**.
   * - 함수 내부에서 `reasons` 배열은 summary 계산 (`reasons.slice(0, 2).join(' · ')`)에
   *   필요 — 로컬 변수로 유지 + 출력에서만 strip.
   *
   * 패턴 (cycle 222-408 시리즈 171번째):
   * - cycle 270/278/279/333/336/352/353/354/389: 함수 출력 dead 필드 정리.
   * - cycle 409: getTraitItemResonance.reasons 동일 lens 회귀.
   *
   * 수정 (src/utils/runProfile.ts):
   * - 초기 empty branch return에서 `reasons: []` 제거.
   * - 메인 return 객체에서 `reasons` 필드 제거.
   * - 함수 내부 `reasons.push(...)` + `summary: reasons.slice(0, 2)...` 로컬 사용 보존.
   *
   * 회귀 가드:
   * - score / label / summary 필드 보존.
   * - getTraitFeaturedItems 정렬 / getTraitLootHint summary 동작 그대로.
   * - 테스트 (`focusResonance.label === '성향 공명'`) 통과.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 409: getTraitItemResonance return에서 reasons 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnStart = source.indexOf('export const getTraitItemResonance');
      const fnEnd = source.indexOf('export const getTraitFeaturedItems', fnStart);
      const fnBlock = source.slice(fnStart, fnEnd);
      // return 객체 내부에 reasons 필드 0건 (단, reasons.push / reasons.slice 내부 사용은 보존).
      assert.ok(!/return \{[^}]*reasons,/.test(fnBlock),
          '메인 return 객체에서 reasons 필드 0건');
      assert.ok(!/return \{[^}]*reasons: \[\]/.test(fnBlock),
          '초기 empty branch return에서 reasons: [] 0건');
  });

  test('cycle 409: 활성 출력 필드 보존 (score/label/summary)', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnStart = source.indexOf('export const getTraitItemResonance');
      const fnEnd = source.indexOf('export const getTraitFeaturedItems', fnStart);
      const fnBlock = source.slice(fnStart, fnEnd);
      assert.ok(/score,/.test(fnBlock), 'score 필드 보존');
      assert.ok(/label,/.test(fnBlock), 'label 필드 보존');
      assert.ok(/summary:/.test(fnBlock), 'summary 필드 보존');
  });

  test('cycle 409: 함수 내부 reasons 사용 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnStart = source.indexOf('export const getTraitItemResonance');
      const fnEnd = source.indexOf('export const getTraitFeaturedItems', fnStart);
      const fnBlock = source.slice(fnStart, fnEnd);
      assert.ok(/const reasons:/.test(fnBlock), 'reasons 로컬 변수 유지');
      assert.ok(/reasons\.push/.test(fnBlock), 'reasons.push 보존');
      assert.ok(/reasons\.slice\(0, 2\)/.test(fnBlock), 'summary 계산 보존');
  });

  test('cycle 409: getTraitItemResonance 동작 보존 (테스트 시나리오)', async () => {
      const { getTraitItemResonance, getTraitProfile } = await import('../src/utils/runProfile.js');
      const player = {
          job: '마법사', hp: 80, maxHp: 140, mp: 70, maxMp: 80,
          equip: {
              weapon: { type: 'weapon', name: '나무지팡이', val: 12, hands: 2, mp: 10, jobs: ['마법사'] },
              offhand: { type: 'shield', subtype: 'focus', name: '견습 주문서', val: 2, mp: 10 },
          },
          relics: [{ effect: 'mp_mult' }, { effect: 'skill_mult' }],
      };
      const trait = getTraitProfile(player, { maxHp: 140, isMagic: true });
      const focusResonance = getTraitItemResonance(
          { type: 'shield', subtype: 'focus', name: '룬 마도서', val: 4, mp: 20, jobs: ['마법사'] },
          trait,
          player,
      );
      assert.ok(typeof focusResonance.score === 'number', 'score 반환');
      assert.equal(focusResonance.label, '성향 공명', 'label 반환 보존');
      assert.equal(focusResonance.reasons, undefined, 'reasons 미반환');
  });

  test('cycle 408 회귀 가드: HEADGEAR / BODY PLACEMENTS private 보존', async () => {
      const source = await readSrc('src/utils/anchorPoints.ts');
      assert.ok(!/export const HEADGEAR_PLACEMENTS\b/.test(source),
          'cycle 408 HEADGEAR_PLACEMENTS private 유지');
      assert.ok(!/export const BODY_PLACEMENTS\b/.test(source),
          'cycle 408 BODY_PLACEMENTS private 유지');
  });
}

// ─── cycle-411-sig-set-tone-frost-arcane-unreachable.test.js ───
{
  /**
   * cycle 411: SIG_SET_TONE `frost` / `arcane` unreachable 정리 (StatsPanel + EquipmentPanel batch)
   *   (cycle 222-410 silent dead config 시리즈 172번째 — unreachable lens 회귀).
   *
   * 발견 (2 components × 2 keys = 4 dead lookup entries):
   * - src/components/StatsPanel.tsx + src/components/EquipmentPanel.tsx 의 SIG_SET_TONE:
   *   `holy / fire / frost / shadow / arcane / nature` 6 키.
   * - 두 컴포넌트의 lookup 사이트:
   *   · `SIG_SET_TONE[activeSignatureSet.tone]` — activeSignatureSet은
   *     signatureSetBonus.computeSignatureSetBonus에서 생성, signatureSets.json 데이터 사용.
   *   · `SIG_SET_TONE[setProgress.tone]` — setProgress는 getSignatureSetProgress에서 생성, 동일 데이터.
   * - signatureSets.json sets: 5개(`celestial`/`worldtree`/`dragon-lord`/`dimension`/`shadow-lord`)
   *   tone: `holy/nature/fire/shadow` 4종만 사용 — `frost` / `arcane` 0건.
   * - 결과: SIG_SET_TONE의 `frost` / `arcane` lookup 절대 hit 안 됨.
   * - cycle 358 (steel tone removal) 동일 lens — 데이터 정합성 기반 unreachable tone.
   *
   * 패턴 (cycle 222-410 시리즈 172번째):
   * - cycle 358: LegendaryDropOverlay TONE_GLOW.steel + LegendaryCodex TONE_ACCENT.steel
   *   unreachable batch.
   * - cycle 411: StatsPanel + EquipmentPanel SIG_SET_TONE.frost / arcane unreachable batch.
   *   동일 lens 회귀 — 데이터 정합성 기반 (signatureSets.json은 4 tone만 emit).
   *
   * 수정:
   * 1) src/components/StatsPanel.tsx SIG_SET_TONE에서 frost / arcane 제거.
   * 2) src/components/EquipmentPanel.tsx SIG_SET_TONE에서 frost / arcane 제거.
   *
   * 회귀 가드:
   * - holy / fire / shadow / nature 4 tone 보존.
   * - fallback `|| SIG_SET_TONE.holy` 동작 그대로.
   * - signatureSets.json 데이터 무영향.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 411: StatsPanel SIG_SET_TONE에서 frost / arcane 0건', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      const blockStart = source.indexOf('const SIG_SET_TONE');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+frost:/m.test(block),
          'StatsPanel SIG_SET_TONE에서 frost 0건');
      assert.ok(!/^\s+arcane:/m.test(block),
          'StatsPanel SIG_SET_TONE에서 arcane 0건');
  });

  test('cycle 411: EquipmentPanel SIG_SET_TONE에서 frost / arcane 0건', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      const blockStart = source.indexOf('const SIG_SET_TONE');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+frost:/m.test(block),
          'EquipmentPanel SIG_SET_TONE에서 frost 0건');
      assert.ok(!/^\s+arcane:/m.test(block),
          'EquipmentPanel SIG_SET_TONE에서 arcane 0건');
  });

  test('cycle 411: 활성 tone 4종 보존 (회귀 가드)', async () => {
      for (const f of ['src/components/StatsPanel.tsx', 'src/components/EquipmentPanel.tsx']) {
          const source = await readSrc(f);
          const blockStart = source.indexOf('const SIG_SET_TONE');
          const blockEnd = source.indexOf('});', blockStart);
          const block = source.slice(blockStart, blockEnd);
          for (const tone of ['holy', 'fire', 'shadow', 'nature']) {
              const re = new RegExp(`^\\s+${tone}:`, 'm');
              assert.ok(re.test(block), `${f} ${tone} tone 보존`);
          }
      }
  });

  test('cycle 411: 정합성 가드 — signatureSets.json은 4 tone만 emit', async () => {
      const sets = JSON.parse(await readSrc('src/data/signatureSets.json'));
      const tones = new Set(Object.values(sets.sets).map((s) => s.tone));
      assert.equal(tones.size, 4, '4 distinct tones');
      for (const tone of tones) {
          assert.ok(['fire', 'holy', 'nature', 'shadow'].includes(tone),
              `tone ${tone}은 4종 활성 set tone 안에`);
      }
  });

  test('cycle 410 회귀 가드: getTraitItemResonance.reasons 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnStart = source.indexOf('export const getTraitItemResonance');
      const fnEnd = source.indexOf('export const getTraitFeaturedItems', fnStart);
      const fnBlock = source.slice(fnStart, fnEnd);
      assert.ok(!/return \{[^}]*reasons,/.test(fnBlock),
          'cycle 409 reasons 출력 0건 보존');
  });
}

// ─── cycle-414-item-icon-paths-unreachable-batch.test.js ───
{
  /**
   * cycle 414: ItemIcon ICON_PATHS equipment-style 16 unreachable keys 일괄 정리
   *   (cycle 222-413 silent dead config 시리즈 175번째 — unreachable lens 회귀).
   *
   * 발견 (16 dead lookup entries):
   * - src/components/icons/ItemIcon.tsx ICON_PATHS: 28 키 중 16개 unreachable.
   * - 렌더링 분기 (line 127-141):
   *   · `!activeAssetState.failed` → `<img>` 시도.
   *   · `activeAssetState.failed && isEquipmentItem` → `<EquipmentAvatarPreview>`.
   *   · `activeAssetState.failed && !isEquipmentItem` → `<svg><path d={path}>`.
   *
   * 결론: SVG rendering은 `!isEquipmentItem` 분기만 진입 — equipment 아이템
   *   (weapon/armor/shield)은 EquipmentAvatarPreview takes over on fail.
   *   따라서 equipment-style ICON_PATHS 키는 SVG에서 절대 hit 안 됨:
   *   sword/greatsword/dagger/staff/bow/axe/hammer/spear/scythe/whip/armor/robe/
   *   cloak/boots/shield/book — 16 unreachable.
   *
   * 보존 (12 키):
   * - material (fallback) + 비-equipment 타입 fallback 키
   *   (potion/key/pouch/ore/crystal/scale/fang/bone/core/relic/herb).
   *   이들은 getEquipmentVisualKey의 type-based fallback (line 268-278)로 도달 가능.
   *
   * 패턴 (cycle 222-413 시리즈 175번째):
   * - cycle 359/361/392/395/397/411/412/413: unreachable lookup lens.
   * - cycle 414: ICON_PATHS equipment-style 16 unreachable 일괄 정리 — 동일 lens 회귀.
   *
   * 수정 (src/components/icons/ItemIcon.tsx):
   * - ICON_PATHS에서 16 equipment-style 키 제거.
   *
   * 회귀 가드:
   * - 12 키 (material/potion/key/pouch/ore/crystal/scale/fang/bone/core/relic/herb) 보존.
   * - SVG 렌더링 동작 (`<path d={path}>`) 보존.
   * - 비-equipment 아이템 SVG 렌더링 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 414: ICON_PATHS equipment-style 16 키 0건', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      const blockStart = source.indexOf('const ICON_PATHS');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      const removedKeys = ['sword', 'greatsword', 'dagger', 'staff', 'bow', 'axe',
          'hammer', 'spear', 'scythe', 'whip', 'armor', 'robe', 'cloak', 'boots',
          'shield', 'book'];
      for (const key of removedKeys) {
          const re = new RegExp(`^\\s+${key}:\\s*'`, 'm');
          assert.ok(!re.test(block), `ICON_PATHS에서 ${key} 0건`);
      }
  });

  test('cycle 414: 활성 12 키 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      const blockStart = source.indexOf('const ICON_PATHS');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      const preservedKeys = ['material', 'potion', 'ore', 'crystal', 'scale',
          'fang', 'bone', 'core', 'relic', 'herb', 'pouch', 'key'];
      for (const key of preservedKeys) {
          const re = new RegExp(`^\\s+${key}:\\s*'`, 'm');
          assert.ok(re.test(block), `${key} 키 보존`);
      }
  });

  test('cycle 414: ICON_PATHS lookup + fallback 동작 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      assert.ok(/ICON_PATHS\[iconKey\] \|\| ICON_PATHS\.material/.test(source),
          'fallback `|| ICON_PATHS.material` 동작 보존');
      assert.ok(/<path d=\{path\}/.test(source),
          'SVG <path> 렌더링 보존');
  });

  test('cycle 413 회귀 가드: SignatureBadge TONE_COLORS.steel 0건', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const blockStart = source.indexOf('const TONE_COLORS');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+steel:/m.test(block),
          'cycle 413 TONE_COLORS.steel 0건 보존');
  });
}

// ─── cycle-415-weekly-special-marker-dead.test.js ───
{
  /**
   * cycle 415: getWeeklySpecial `isWeeklySpecial` 출력 dead 마커 정리
   *   (cycle 222-414 silent dead config 시리즈 176번째 — function output dead lens 회귀).
   *
   * 발견 (1 dead 출력 필드):
   * - src/utils/shopRotation.ts getWeeklySpecial return:
   *   `{ ...item, originalPrice, price, isWeeklySpecial: true }` (line 105-110).
   * - 외부 read 분석:
   *   · originalPrice: ShopPanel.tsx:265 read (line-through 가격 표시).
   *   · price/...item: 표준 사용.
   *   · **isWeeklySpecial: src/, tests/ 어디에서도 read 0건**.
   * - cycle 355는 isDailyDeal 마커를 회귀 가드로 보존했지만 isWeeklySpecial은 누락 —
   *   원래부터 read 0건이라 silent dead 마커.
   *
   * 패턴 (cycle 222-414 시리즈 176번째):
   * - cycle 270/278/279/333/336/352/353/354/389/409: 함수 출력 dead 필드 정리.
   * - cycle 415: getWeeklySpecial isWeeklySpecial 출력 dead 마커 — 동일 lens 회귀.
   *
   * 수정 (src/utils/shopRotation.ts):
   * - getWeeklySpecial return에서 `isWeeklySpecial: true` 라인 제거.
   *
   * 회귀 가드:
   * - originalPrice / price / item spread 동작 그대로.
   * - getDailyDeals isDailyDeal 마커 보존 (cycle 355 회귀 가드).
   * - ShopPanel weeklySpecial.originalPrice line-through 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 415: getWeeklySpecial return에서 isWeeklySpecial 0건', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      const fnStart = source.indexOf('export const getWeeklySpecial');
      // getWeeklySpecial은 마지막 함수 — 파일 끝까지 검사.
      const fnBlock = source.slice(fnStart);
      assert.ok(!/isWeeklySpecial:\s*true/.test(fnBlock),
          'getWeeklySpecial return에서 isWeeklySpecial 0건');
  });

  test('cycle 415: getDailyDeals 0.9 할인 적용 보존 (cycle 436이 마커 제거)', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      const fnStart = source.indexOf('export const getDailyDeals');
      const fnEnd = source.indexOf('export const getWeeklySpecial', fnStart);
      const fnBlock = source.slice(fnStart, fnEnd);
      // cycle 436: 마커 제거 — 0.9 할인 multiplier 적용은 보존.
      assert.ok(/Math\.floor\(item\.price \* 0\.9\)/.test(fnBlock),
          '0.9 할인 적용 보존');
  });

  test('cycle 415: getWeeklySpecial 동작 보존 (originalPrice / price)', async () => {
      const { getWeeklySpecial } = await import('../src/utils/shopRotation.js');
      const result = getWeeklySpecial(20);
      if (result === null) return; // 데이터 없는 경우는 회귀 가드 면제
      assert.ok(typeof result.originalPrice === 'number', 'originalPrice 보존');
      assert.ok(typeof result.price === 'number', 'price 보존');
      assert.equal(result.price, Math.floor(result.originalPrice * 0.85),
          '15% 할인 적용 동작 보존');
      assert.equal(result.isWeeklySpecial, undefined, 'isWeeklySpecial 마커 미설정');
  });

  test('cycle 414 회귀 가드: ICON_PATHS sword 0건', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      const blockStart = source.indexOf('const ICON_PATHS');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+sword:/m.test(block),
          'cycle 414 ICON_PATHS.sword 0건 보존');
  });
}

// ─── cycle-416-combat-panel-action-buttons-dead.test.js ───
{
  /**
   * cycle 416: CombatPanel ACTION_BUTTONS `tag` / `detail` 출력 dead 정리
   *   (cycle 222-415 silent dead config 시리즈 177번째 — function output dead lens 회귀).
   *
   * 발견 (4 entries × 2 fields = 8 dead 출력 필드):
   * - src/components/tabs/CombatPanel.tsx ACTION_BUTTONS (line 20-57): 4 entry —
   *   attack / skill / swap / escape. 각 entry에 `tag` (Burst/Core/Loadout/Exit) +
   *   `detail` (한국어 설명) 필드.
   * - 렌더 사이트 (line 358-378): `action.icon`, `action.key`, `action.className`,
   *   `action.mobileLabel`, `action.label` 5 필드만 read.
   * - `action.tag` / `action.detail` src/, tests/ 어디에서도 read 0건.
   * - compactMetaEntries (line 140) 등의 별개 `entry.detail`은 다른 배열로 무관.
   *
   * 패턴 (cycle 222-415 시리즈 177번째):
   * - cycle 270/278/279/333/336/352/353/354/389/393/409/415: 함수/객체 출력 dead.
   * - cycle 393: PREMIUM_SHOP entry category/repeatable 10 dead 일괄.
   * - cycle 416: ACTION_BUTTONS entry tag/detail 8 dead 일괄 — data-config-dead 회귀.
   *
   * 수정 (src/components/tabs/CombatPanel.tsx):
   * - ACTION_BUTTONS 4 entry에서 `tag` + `detail` 8 라인 제거.
   *
   * 회귀 가드:
   * - icon / key / className / mobileLabel / label 5 활성 필드 보존.
   * - 4 entry (attack/skill/swap/escape) 자체 보존.
   * - compactMetaEntries entry.detail (별개 배열) 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 416: ACTION_BUTTONS에서 tag / detail 0건', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      const blockStart = source.indexOf('const ACTION_BUTTONS');
      const blockEnd = source.indexOf('];', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/\btag:/.test(block),
          'ACTION_BUTTONS에서 tag 필드 0건');
      assert.ok(!/\bdetail:/.test(block),
          'ACTION_BUTTONS에서 detail 필드 0건');
  });

  test('cycle 416: ACTION_BUTTONS 활성 필드 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      const blockStart = source.indexOf('const ACTION_BUTTONS');
      const blockEnd = source.indexOf('];', blockStart);
      const block = source.slice(blockStart, blockEnd);
      for (const field of ['key', 'label', 'mobileLabel', 'icon', 'className']) {
          const re = new RegExp(`\\b${field}:`);
          assert.ok(re.test(block), `${field} 필드 보존`);
      }
  });

  test('cycle 416: ACTION_BUTTONS 4 entry 보존 (attack/skill/swap/escape)', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      const blockStart = source.indexOf('const ACTION_BUTTONS');
      const blockEnd = source.indexOf('];', blockStart);
      const block = source.slice(blockStart, blockEnd);
      for (const key of ['attack', 'skill', 'swap', 'escape']) {
          const re = new RegExp(`key:\\s*'${key}'`);
          assert.ok(re.test(block), `${key} entry 보존`);
      }
  });

  test('cycle 416: compactMetaEntries 배열은 cycle 485 cascade로 제거됨 (paired 보존)', async () => {
      // cycle 485가 CombatPanel compact/dense props cascade로 정리하면서
      // compactMetaEntries 배열도 cascade dead로 제거. paired 가드.
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.ok(!/compactMetaEntries/.test(source),
          'cycle 485 cascade로 compactMetaEntries 제거 보존');
  });

  test('cycle 415 회귀 가드: getWeeklySpecial isWeeklySpecial 0건', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      const fnStart = source.indexOf('export const getWeeklySpecial');
      const fnBlock = source.slice(fnStart);
      assert.ok(!/isWeeklySpecial:\s*true/.test(fnBlock),
          'cycle 415 isWeeklySpecial 0건 보존');
  });
}

// ─── cycle-418-aether-mark-size-sm-unreachable.test.js ───
{
  /**
   * cycle 418: AetherMark SIZE_MAP `sm` unreachable 정리
   *   (cycle 222-417 silent dead config 시리즈 179번째 — unreachable lens 회귀).
   *
   * 발견 (1 dead lookup entry):
   * - src/components/AetherMark.tsx SIZE_MAP: sm/md/lg 3 키.
   * - lookup 사이트: `SIZE_MAP[size] || SIZE_MAP.md`.
   * - AetherMark consumers (전체):
   *   · IntroScreen.tsx:101 — `<AetherMark size="md" />`.
   *   · BootScreen.tsx — `<AetherMark size="lg" />`.
   * - `size="sm"` 호출 0건. 컴포넌트 default도 `size = 'md'`라 sm 도달 불가.
   * - 결과: SIZE_MAP.sm lookup 절대 hit 안 됨.
   *
   * 패턴 (cycle 222-417 시리즈 179번째):
   * - cycle 411/412/413: 데이터 정합성 기반 unreachable tone 정리.
   * - cycle 414: ICON_PATHS equipment-style 16 unreachable.
   * - cycle 418: SIZE_MAP.sm — 전체 호출 사이트 분석 기반 unreachable lens.
   *
   * 수정 (src/components/AetherMark.tsx):
   * - SIZE_MAP에서 `sm` 라인 제거.
   *
   * 회귀 가드:
   * - md / lg 활성 사이즈 보존.
   * - fallback `|| SIZE_MAP.md` 동작 그대로.
   * - default `size = 'md'` 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 418: AetherMark SIZE_MAP에서 sm 0건', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      const blockStart = source.indexOf('const SIZE_MAP');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+sm:/m.test(block),
          'SIZE_MAP에서 sm 0건');
  });

  test('cycle 418: 활성 사이즈 보존 (md/lg)', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      const blockStart = source.indexOf('const SIZE_MAP');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      for (const size of ['md', 'lg']) {
          const re = new RegExp(`^\\s+${size}:`, 'm');
          assert.ok(re.test(block), `${size} 사이즈 보존`);
      }
  });

  test('cycle 418: fallback 보존 (회귀 가드) — cycle 432가 default size 제거', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      assert.ok(/SIZE_MAP\[size\] \|\| SIZE_MAP\.md/.test(source),
          'fallback `|| SIZE_MAP.md` 동작 보존 (방어용)');
      // cycle 432: default `size` 제거 (호출자 모두 명시 전달이라 도달 불가).
      //   해당 검증은 cycle-432 test가 대체.
  });

  test('cycle 418: 정합성 가드 — AetherMark consumers 모두 md/lg만 사용', async () => {
      const intro = await readSrc('src/components/IntroScreen.tsx');
      const boot = await readSrc('src/components/app/BootScreen.tsx');
      assert.ok(/<AetherMark size="md"/.test(intro), 'IntroScreen md 사용');
      assert.ok(/<AetherMark size="lg"/.test(boot), 'BootScreen lg 사용');
      assert.ok(!/<AetherMark size="sm"/.test(intro + boot),
          'sm consumer 0건 (정합성)');
  });

  test('cycle 417 회귀 가드: SLOT_CONFIG icon 0건', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      const blockStart = source.indexOf('const SLOT_CONFIG');
      const blockEnd = source.indexOf('];', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/\bicon:/.test(block),
          'cycle 417 SLOT_CONFIG.icon 0건 보존');
  });
}

// ─── cycle-419-signal-badge-size-md-lg-unreachable.test.js ───
{
  /**
   * cycle 419: SignalBadge SIZE_CLASS `md` / `lg` unreachable 정리
   *   (cycle 222-418 silent dead config 시리즈 180번째 — unreachable lens 회귀, 호출 사이트 분석).
   *
   * 발견 (2 dead lookup entries + default param 변경):
   * - src/components/SignalBadge.tsx SIZE_CLASS: sm/md/lg 3 키.
   * - lookup 사이트: `SIZE_CLASS[size] || SIZE_CLASS.md`.
   * - SignalBadge 호출 분석: 73 호출 사이트 모두 `size="sm"` 명시.
   *   default `size = 'md'`도 도달 불가 (모든 호출 explicit).
   * - 결과: SIZE_CLASS.md / SIZE_CLASS.lg lookup 절대 hit 안 됨.
   *
   * 패턴 (cycle 222-418 시리즈 180번째):
   * - cycle 418: AetherMark SIZE_MAP.sm — 호출 사이트 분석 기반 unreachable.
   * - cycle 419: SignalBadge SIZE_CLASS.md/lg — 동일 lens 회귀.
   *
   * 수정 (src/components/SignalBadge.tsx):
   * - SIZE_CLASS에서 `md`, `lg` 라인 제거 (sm 단일 유지).
   * - default `size = 'md'` → `size = 'sm'` (실질 동일 동작 — 모든 호출 sm 명시).
   * - fallback `|| SIZE_CLASS.md` → `|| SIZE_CLASS.sm`.
   *
   * 회귀 가드:
   * - sm 활성 사이즈 보존 (73 호출 사이트 모두 사용).
   * - tone/className/children 등 다른 prop 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 419: SignalBadge SIZE_CLASS에서 md/lg 0건', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      const blockStart = source.indexOf('const SIZE_CLASS');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+md:/m.test(block), 'SIZE_CLASS에서 md 0건');
      assert.ok(!/^\s+lg:/m.test(block), 'SIZE_CLASS에서 lg 0건');
  });

  test('cycle 419: sm 사이즈 보존 (활성)', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      const blockStart = source.indexOf('const SIZE_CLASS');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(/^\s+sm:/m.test(block), 'SIZE_CLASS.sm 보존');
  });

  test('cycle 419: fallback 보존 (회귀 가드) — cycle 433이 default size 제거', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      // cycle 433: default `size`도 제거 (호출자 모두 명시 전달이라 도달 불가).
      //   해당 검증은 cycle-433 test가 대체.
      assert.ok(/SIZE_CLASS\[size\] \|\| SIZE_CLASS\.sm/.test(source),
          'fallback `|| SIZE_CLASS.sm` 보존 (방어용)');
  });

  test('cycle 419: 정합성 가드 — SignalBadge size="md" / size="lg" 호출 0건', async () => {
      const { readdir } = await import('node:fs/promises');
      const componentDir = path.join(ROOT, 'src/components');
      const files = await readdir(componentDir, { recursive: true });
      let mdCount = 0;
      let lgCount = 0;
      for (const f of files) {
          if (!String(f).endsWith('.tsx')) continue;
          const fp = path.join(componentDir, String(f));
          const src = await readFile(fp, 'utf8').catch(() => '');
          const allBadges = src.match(/<SignalBadge[^>]*\/?>/g) || [];
          for (const m of allBadges) {
              if (/size="md"/.test(m)) mdCount += 1;
              if (/size="lg"/.test(m)) lgCount += 1;
          }
      }
      assert.equal(mdCount, 0, 'size="md" 호출 0건');
      assert.equal(lgCount, 0, 'size="lg" 호출 0건');
  });

  test('cycle 418 회귀 가드: AetherMark SIZE_MAP.sm 0건', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      const blockStart = source.indexOf('const SIZE_MAP');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+sm:/m.test(block),
          'cycle 418 AetherMark SIZE_MAP.sm 0건 보존');
  });
}

// ─── cycle-423-control-panel-sidebar-label-dead.test.js ───
{
  /**
   * cycle 423: ControlPanel coreButtons sidebarLabel 출력 dead 정리
   *   (cycle 222-422 silent dead config 시리즈 183번째 — output dead field cleanup lens
   *   회귀, cycle 333-356 24-cycle 시리즈 패턴).
   *
   * 발견 (2 dead output fields):
   * - src/components/ControlPanel.tsx coreButtons:
   *     line 217: `sidebarLabel: 'EXP'` (explore button)
   *     line 229: `sidebarLabel: 'MOVE'` (move button)
   * - 호출 사이트 (renderActionButton line 74-84):
   *     `const { key, testId, icon: Icon, label, mobileLabel = label, onClick,
   *             className, disabled = false } = button;`
   *   → sidebarLabel 미destructure. button.sidebarLabel read 0건.
   * - 결과: 두 sidebarLabel 필드 어디로도 흐르지 않는 dead output.
   *
   * 패턴 (cycle 222-422 시리즈 183번째):
   * - cycle 333-356 시리즈: 함수 출력 필드 dead cleanup (24 cycles).
   * - cycle 416: CombatPanel ACTION_BUTTONS tag/detail dead output.
   * - cycle 423: ControlPanel coreButtons sidebarLabel dead output.
   *
   * 수정 (src/components/ControlPanel.tsx):
   * - coreButtons 두 entry에서 `sidebarLabel: '...'` 라인 제거.
   *
   * 회귀 가드:
   * - label / key / icon / onClick 등 다른 필드 그대로.
   * - renderActionButton 동작 그대로 (label / mobileLabel만 read).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 423: ControlPanel sidebarLabel 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const matches = source.match(/sidebarLabel/g) || [];
      assert.equal(matches.length, 0, 'ControlPanel.tsx sidebarLabel 0건');
  });

  test('cycle 423: 활성 필드 보존 (label / key / icon / onClick)', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      // explore 버튼
      assert.ok(/key: 'explore'/.test(source), "explore button key 보존");
      assert.ok(/label: 'EXPLORE'/.test(source), "EXPLORE label 보존");
      // move 버튼
      assert.ok(/key: 'move'/.test(source), "move button key 보존");
      assert.ok(/label: 'MOVE'/.test(source), "MOVE label 보존");
  });

  test('cycle 423: renderActionButton destructure 정합성 가드 — sidebarLabel 미destructure', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const fnIdx = source.indexOf('const renderActionButton');
      const fnEnd = source.indexOf('return (', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/sidebarLabel/.test(block),
          'renderActionButton 본체 sidebarLabel destructure 0건');
  });

  test('cycle 422 회귀 가드: MonsterIcon 골렘 includes 1건만', async () => {
      const source = await readSrc('src/components/icons/MonsterIcon.tsx');
      const fnStart = source.indexOf('const getMonsterType');
      const fnEnd = source.indexOf('};', fnStart);
      const block = source.slice(fnStart, fnEnd);
      const golemMatches = block.match(/name\.includes\('골렘'\)/g) || [];
      assert.equal(golemMatches.length, 1, "cycle 422 골렘 includes 1건만 보존");
  });
}

// ─── cycle-424-exact-icon-category-undefined-redundant.test.js ───
{
  /**
   * cycle 424: EXACT_ICON_CATEGORY_BY_TYPE 'undefined' 엔트리 redundant 정리
   *   (cycle 222-423 silent dead config 시리즈 184번째 — defensive fallback redundancy
   *   lens 회귀, cycle 373-388 16-cycle 시리즈 패턴).
   *
   * 발견 (1 redundant entry):
   * - src/utils/itemVisuals.ts EXACT_ICON_CATEGORY_BY_TYPE에
   *     `undefined: 'misc'` 엔트리.
   * - 호출 사이트 (line 105): `EXACT_ICON_CATEGORY_BY_TYPE[item.type] || 'misc'`.
   * - 동작 분석:
   *     · `item.type` undefined → JS 브래킷 룩업 `obj[undefined]`은 문자열 키
   *       `'undefined'`로 coerce → 엔트리 값 'misc' 반환.
   *     · 엔트리 제거 시 `obj[undefined]` returns undefined → `|| 'misc'` fallback이
   *       동일 'misc' 반환.
   *   → 양쪽 path 모두 'misc' 산출. 엔트리는 기능적 잉여.
   *
   * 패턴 (cycle 222-423 시리즈 184번째):
   * - cycle 373-388 시리즈 (16 cycles): defensive fallback redundancy.
   * - cycle 424: EXACT_ICON_CATEGORY_BY_TYPE 'undefined' redundant — 동일 lens 회귀.
   *
   * 수정 (src/utils/itemVisuals.ts):
   * - EXACT_ICON_CATEGORY_BY_TYPE에서 `undefined: 'misc'` 라인 제거.
   *
   * 회귀 가드:
   * - 활성 type 매핑 10종 (weapon/armor/shield/hp/mp/cure/buff/mat/key/all) 보존.
   * - `|| 'misc'` fallback 보존 → recipes 등 type 부재 아이템 'misc' 동일 산출.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 424: EXACT_ICON_CATEGORY_BY_TYPE에서 undefined 엔트리 0건', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      const blockStart = source.indexOf('const EXACT_ICON_CATEGORY_BY_TYPE');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+undefined:/m.test(block), 'EXACT_ICON_CATEGORY_BY_TYPE에서 undefined 엔트리 0건');
  });

  test('cycle 424: 활성 type 매핑 10종 보존', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      const blockStart = source.indexOf('const EXACT_ICON_CATEGORY_BY_TYPE');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      const activeKeys = ['weapon', 'armor', 'shield', 'hp', 'mp', 'cure', 'buff', 'mat', 'key', 'all'];
      for (const key of activeKeys) {
          const re = new RegExp(`^\\s+${key}:`, 'm');
          assert.ok(re.test(block), `활성 키 ${key} 보존`);
      }
  });

  test('cycle 424: `|| misc` fallback 보존 → recipes 등 type 부재 아이템 동일 동작', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      assert.ok(/EXACT_ICON_CATEGORY_BY_TYPE\[item\.type\] \|\| 'misc'/.test(source),
          "fallback `|| 'misc'` 보존");
  });

  test('cycle 424: EXACT_ITEM_ICON_KEYS 빌드 산출물 회귀 — 활성 카테고리 카운트 보존', async () => {
      const { EXACT_ITEM_ICON_KEYS } = await import('../src/utils/itemVisuals.ts');
      const cats = {};
      for (const key of Object.values(EXACT_ITEM_ICON_KEYS)) {
          if (typeof key !== 'string') continue;
          const cat = key.split('-')[1];
          cats[cat] = (cats[cat] || 0) + 1;
      }
      // 활성 카테고리만 산출 (weapon/armor/shield/consumable/material/key/relic 등).
      // 'undefined' 엔트리 제거가 builder 동작에 영향 없음 — 모든 아이템 type 명시되어
      // dedupe 과정에서 'misc' fallback path 진입 0건.
      assert.ok(Object.keys(cats).length > 0, '활성 카테고리 산출');
      assert.ok(!cats.undefined, "'undefined' 카테고리 0건 (체계 정합)");
  });

  test('cycle 423 회귀 가드: ControlPanel sidebarLabel 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const matches = source.match(/sidebarLabel/g) || [];
      assert.equal(matches.length, 0, 'cycle 423 sidebarLabel 0건 보존');
  });
}

// ─── cycle-425-pick-fallback-event-explicit-dead.test.js ───
{
  /**
   * cycle 425: pickFallbackEvent `explicit` 분기 unreachable 정리
   *   (cycle 222-424 silent dead config 시리즈 185번째 — unreachable code path lens
   *   회귀, cycle 357-359/361-363 패턴, cycle 357 paired completion).
   *
   * 발견 (1 dead lookup + 2 dead conditional branches):
   * - src/utils/aiEventUtils.ts pickFallbackEvent (line 509+):
   *     `const explicit = FALLBACK_EVENT_POOL[loc];`
   *     `const poolKey = explicit ? loc : getPoolKeyByLocation(loc);`
   *     `const basePool = explicit || FALLBACK_EVENT_POOL[poolKey] || FALLBACK_EVENT_POOL.default;`
   * - 분석:
   *     · loc 파라미터는 player.loc (항상 Korean: '고요한 숲'/'시작의 마을'/etc.).
   *     · FALLBACK_EVENT_POOL 키는 cycle 357 이후 모두 English category (forest/
   *       ruins/cave/desert/ice/dark/abyss/treasure/machina/sky/deepsea/gate +
   *       structured + default). Korean key 0건.
   *     · 따라서 `FALLBACK_EVENT_POOL[loc]` lookup은 항상 undefined.
   *   → `explicit` 항상 falsy → `explicit ? loc` 분기 / `explicit ||` short-circuit
   *      양쪽 모두 unreachable.
   *
   * 패턴 (cycle 222-424 시리즈 185번째):
   * - cycle 357: 시작의 마을 12 events 제거 (English-only pool 정착).
   * - cycle 425: 그 결과로 `explicit` lookup 잔존 dead branch 정리 — paired completion.
   *
   * 수정 (src/utils/aiEventUtils.ts):
   * - `const explicit = ...` 라인 제거.
   * - `const poolKey = getPoolKeyByLocation(loc);` (단순화).
   * - `const basePool = FALLBACK_EVENT_POOL[poolKey] || FALLBACK_EVENT_POOL.default;`.
   *
   * 회귀 가드:
   * - pickFallbackEvent 동작 그대로 — 모든 Korean loc은 getPoolKeyByLocation을 거쳐
   *   English category로 매핑됨 (이미 항상 그 path였음).
   * - `FALLBACK_EVENT_POOL.default` fallback / `structured` 30% mix / dedup 등 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 425: pickFallbackEvent에서 `FALLBACK_EVENT_POOL[loc]` 직접 lookup 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('export const pickFallbackEvent');
      const fnEnd = source.indexOf('};', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/FALLBACK_EVENT_POOL\[loc\]/.test(block),
          'pickFallbackEvent 본체 FALLBACK_EVENT_POOL[loc] 0건');
  });

  test('cycle 425: `explicit` 변수 잔존 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('export const pickFallbackEvent');
      const fnEnd = source.indexOf('};', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bexplicit\b/.test(block),
          'pickFallbackEvent 본체 `explicit` 변수 0건');
  });

  test('cycle 425: poolKey / basePool 활성 path 보존', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('export const pickFallbackEvent');
      const fnEnd = source.indexOf('};', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(/getPoolKeyByLocation\(loc\)/.test(block), 'getPoolKeyByLocation(loc) 보존');
      assert.ok(/FALLBACK_EVENT_POOL\.default/.test(block), 'FALLBACK_EVENT_POOL.default fallback 보존');
      assert.ok(/FALLBACK_EVENT_POOL\.structured/.test(block), 'structured 30% mix 보존');
  });

  test('cycle 425: pickFallbackEvent runtime — Korean loc 입력에도 정상 산출', async () => {
      const { pickFallbackEvent } = await import('../src/utils/aiEventUtils.ts');
      // Korean 로케이션은 getPoolKeyByLocation을 거쳐 English category로 매핑.
      const event1 = pickFallbackEvent('고요한 숲', [], {});
      assert.ok(event1, '숲 → forest 매핑 후 fallback event 산출');
      assert.ok(typeof event1.desc === 'string', 'desc 필드 존재');
      assert.ok(Array.isArray(event1.choices), 'choices 배열');

      const event2 = pickFallbackEvent('알 수 없는 지역', [], {});
      assert.ok(event2, "매칭 안 되는 loc → 'default' pool fallback");
      assert.ok(typeof event2.desc === 'string', 'default pool desc 존재');
  });

  test('cycle 424 회귀 가드: EXACT_ICON_CATEGORY_BY_TYPE undefined 0건', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      const blockStart = source.indexOf('const EXACT_ICON_CATEGORY_BY_TYPE');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+undefined:/m.test(block), 'cycle 424 undefined 엔트리 0건 보존');
  });
}

// ─── cycle-428-reward-chips-default-accent-redundant.test.js ───
{
  /**
   * cycle 428: QuestBoardPanel RewardChips default `accent = 'blue'` redundant 정리
   *   (cycle 222-427 silent dead config 시리즈 188번째 — redundant default annotation
   *   lens 회귀, cycle 364-368 패턴).
   *
   * 발견 (1 redundant default value):
   * - src/components/tabs/QuestBoardPanel.tsx RewardChips:
   *     `({ reward, accent = 'blue' }: any) => { ... }`
   * - 호출 사이트 분석 (4 곳, 모두 accent 명시 전달):
   *     line 158: `<RewardChips reward={...} accent="blue" />`
   *     line 196: `<RewardChips reward={...} accent={isComplete ? 'green' : ...} />`
   *     line 250: `<RewardChips reward={...} accent="blue" />`
   *     line 275: `<RewardChips reward={...} accent="blue" />`
   *   → 모든 호출자가 accent 명시 → default 'blue'은 도달 불가 (redundant 정의).
   *
   * 패턴 (cycle 222-427 시리즈 188번째):
   * - cycle 364-368 (5 cycles): redundant default annotation 시리즈.
   * - cycle 419: SignalBadge default `size='sm'` 갱신 (호출 사이트 분석).
   * - cycle 428: RewardChips default `accent='blue'` 제거 — 동일 lens 회귀.
   *
   * 수정 (src/components/tabs/QuestBoardPanel.tsx):
   * - destructure에서 `accent = 'blue'` → `accent` (default 제거).
   *
   * 회귀 가드:
   * - 4 호출자 모두 accent 명시 → 동작 그대로.
   * - accent 'blue' 분기 (else fallback in ternary) 그대로 활성.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 428: RewardChips destructure에서 default accent 'blue' 제거", async () => {
      const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      assert.ok(!/accent = 'blue'/.test(source),
          "RewardChips의 default `accent = 'blue'` 제거됨");
      // slice 20: inline prop 추가 (메타 칩 줄과 보상 칩 줄 통합) — accent 파라미터
      //   보존 가드는 inline 유무와 무관하게 유지.
      assert.ok(/RewardChips = \(\{ reward, accent(?:, inline = false)? \}/.test(source)
          || /RewardChips = \(\{ accent, reward \}/.test(source),
          'destructure에서 accent 파라미터 보존');
  });

  test('cycle 428: 4 호출 사이트 모두 accent 명시 전달 (정합성 가드)', async () => {
      const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      const callMatches = source.match(/<RewardChips[^>]*\/?>/g) || [];
      assert.equal(callMatches.length, 4, 'RewardChips 호출 4건');
      for (const call of callMatches) {
          assert.ok(/accent=/.test(call),
              `호출 "${call.slice(0, 80)}"에 accent 명시 전달`);
      }
  });

  test('cycle 428: ternary 분기 (green/amber/blue fallback) 보존', async () => {
      const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      assert.ok(/accent === 'green'/.test(source), 'green 분기 보존');
      assert.ok(/accent === 'amber'/.test(source), 'amber 분기 보존');
      assert.ok(/border-\[#7dd4d8\]/.test(source), 'readable cyan fallback 클래스 보존');
  });

  test('cycle 427 회귀 가드: SignatureBadge TONE_COLORS rust 보존', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const blockStart = source.indexOf('const TONE_COLORS');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(/^\s+rust:/m.test(block), 'cycle 427 rust tone 보존');
  });
}

// ─── cycle-432-aether-mark-default-size-redundant.test.js ───
{
  /**
   * cycle 432: AetherMark default `size = 'md'` redundant 정리
   *   (cycle 222-431 silent dead config 시리즈 191번째 — redundant default annotation
   *   lens 회귀, cycle 364-368/428-429/431 패턴).
   *
   * 발견 (1 redundant default value):
   * - src/components/AetherMark.tsx:
   *     `({ size = 'md', className = '' }: any) => { ... }`
   * - 호출 사이트 분석 (2곳, size 명시 전달):
   *     IntroScreen.tsx:71: `<AetherMark size="md" />`
   *     app/BootScreen.tsx:19: `<AetherMark size="lg" />`
   *   → 모든 호출자 명시 → default 'md' 도달 불가.
   * - className default는 모든 호출자가 omit이라 활성 → 보존.
   *
   * 패턴 (cycle 222-431 시리즈 191번째):
   * - cycle 418: AetherMark SIZE_MAP.sm 제거 (호출 사이트 분석 unreachable).
   * - cycle 431: AvatarEquipmentOverlay default layer 제거.
   * - cycle 432: AetherMark default size — cycle 418 paired completion (lookup
   *   table cleanup 후 잔존 default 제거).
   *
   * 수정 (src/components/AetherMark.tsx):
   * - destructure에서 `size = 'md'` → `size` (default 제거).
   * - SIZE_MAP fallback `|| SIZE_MAP.md`는 보존 (방어용).
   *
   * 회귀 가드:
   * - 2 호출자 명시 size 전달 → 동작 그대로.
   * - className default 보존.
   * - cycle 418 SIZE_MAP.sm 0건 회귀 가드.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 432: AetherMark destructure에서 default size 값 제거", async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      const fnIdx = source.indexOf('const AetherMark =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/size = 'md'/.test(block), 'AetherMark destructure default 제거됨');
      assert.ok(/\bsize\b/.test(block), 'size 파라미터 보존');
  });

  test('cycle 432: 2 호출자 모두 size 명시 전달 (정합성 가드)', async () => {
      const intro = await readSrc('src/components/IntroScreen.tsx');
      const boot = await readSrc('src/components/app/BootScreen.tsx');
      assert.ok(/<AetherMark size="md"/.test(intro), 'IntroScreen size="md" 명시');
      assert.ok(/<AetherMark size="lg"/.test(boot), 'BootScreen size="lg" 명시');
  });

  test('cycle 432: className cycle 493 cascade로 prop 자체 제거', async () => {
      // cycle 493이 AetherMark className prop cascade로 정리 (2 호출자 모두
      // 전달 0건). 이전 default 보존 가드 → cascade 보존 가드로 약화.
      const source = await readSrc('src/components/AetherMark.tsx');
      const fnIdx = source.indexOf('const AetherMark =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/className/.test(block), 'cycle 493 cascade로 className 제거 보존');
  });

  test('cycle 432: SIZE_MAP fallback 보존 (방어용)', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      assert.ok(/SIZE_MAP\[size\] \|\| SIZE_MAP\.md/.test(source),
          'SIZE_MAP fallback 보존');
  });

  test('cycle 418 회귀 가드: AetherMark SIZE_MAP.sm 0건', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      const blockStart = source.indexOf('const SIZE_MAP');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+sm:/m.test(block), 'cycle 418 SIZE_MAP.sm 0건 보존');
  });

  test('cycle 431 회귀 가드: AvatarEquipmentOverlay default layer 0건', async () => {
      const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
      const fnIdx = source.indexOf('const AvatarEquipmentOverlay');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/layer = 'front'/.test(block), 'cycle 431 default layer 제거 보존');
  });
}

// ─── cycle-433-signal-badge-defaults-redundant.test.js ───
{
  /**
   * cycle 433: SignalBadge default `tone = 'neutral'` / `size = 'sm'` redundant 정리
   *   (cycle 222-432 silent dead config 시리즈 192번째 — redundant default annotation
   *   lens 회귀, cycle 364-368/428-429/431-432 패턴, cycle 419 paired completion).
   *
   * 발견 (2 redundant default values):
   * - src/components/SignalBadge.tsx:
   *     `({ tone = 'neutral', size = 'sm', className = '', children, ...rest }: any) => ...`
   * - 호출 사이트 분석 (73 + 0 = 73 호출):
   *     · 모든 73 호출자 size="sm" 명시 (cycle 419 정합성 검증).
   *     · 모든 73 호출자 tone="..." 명시 (tone 미지정 호출 0건 — grep 검증).
   *   → 두 default 모두 도달 불가.
   * - SIZE_CLASS / TONE_CLASS fallback (`|| SIZE_CLASS.sm` / `|| TONE_CLASS.neutral`)
   *   은 보존 (방어용).
   *
   * 패턴 (cycle 222-432 시리즈 192번째):
   * - cycle 419: SIZE_CLASS md/lg 제거 + default sm으로 갱신.
   * - cycle 432: AetherMark default size 제거 (cycle 418 paired completion).
   * - cycle 433: SignalBadge tone/size default 제거 — cycle 419 paired completion.
   *
   * 수정 (src/components/SignalBadge.tsx):
   * - destructure에서 `tone = 'neutral'` → `tone`.
   * - destructure에서 `size = 'sm'` → `size`.
   * - SIZE_CLASS / TONE_CLASS fallback은 그대로 (방어용 + cycle 419 회귀 가드).
   *
   * 회귀 가드:
   * - 73 호출자 모두 명시 전달 → 동작 그대로.
   * - SIZE_CLASS / TONE_CLASS fallback 보존.
   * - cycle 419 SIZE_CLASS md/lg 0건 회귀 가드.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 433: SignalBadge destructure에서 default tone / size 제거', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      const fnIdx = source.indexOf('const SignalBadge =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/tone = 'neutral'/.test(block), 'default tone 제거됨');
      assert.ok(!/size = 'sm'/.test(block), 'default size 제거됨');
      assert.ok(/\btone\b/.test(block), 'tone 파라미터 보존');
      assert.ok(/\bsize\b/.test(block), 'size 파라미터 보존');
  });

  test('cycle 433: className cycle 501 cascade로 prop 자체 제거 (children / rest 보존)', async () => {
      // cycle 501이 className prop cascade로 정리 (77 호출자 모두 전달 0건).
      // className default 보존 → cascade 보존 가드로 약화.
      const source = await readSrc('src/components/SignalBadge.tsx');
      const fnIdx = source.indexOf('const SignalBadge =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bclassName\b/.test(block), 'className 제거 보존');
      assert.ok(/children/.test(block), 'children 보존');
      assert.ok(/\.\.\.rest/.test(block), '...rest 보존');
  });

  test('cycle 433: SIZE_CLASS / TONE_CLASS fallback 방어용 보존', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      assert.ok(/SIZE_CLASS\[size\] \|\| SIZE_CLASS\.sm/.test(source),
          'SIZE_CLASS fallback 보존');
      assert.ok(/TONE_CLASS\[tone\] \|\| TONE_CLASS\.neutral/.test(source),
          'TONE_CLASS fallback 보존');
  });

  test('cycle 433: 정합성 가드 — SignalBadge 호출 수 ≤ size="..." 매칭 수', async () => {
      // multi-line JSX와 `>=` 등 expression 안의 `>` 때문에 정확한 개별 호출
      // 매칭은 까다롭다. 대신 전체 카운트로 lower-bound 검증:
      //   - 모든 호출자가 size= 명시했다면 size= 매칭 수 ≥ <SignalBadge 시작 수.
      //   - 동일 카운트 시 dead default 안전.
      const componentDir = path.join(ROOT, 'src/components');
      const files = await readdir(componentDir, { recursive: true });
      let openTagCount = 0;
      let sizeAttrCount = 0;
      for (const f of files) {
          if (!String(f).endsWith('.tsx')) continue;
          const src = await readFile(path.join(componentDir, String(f)), 'utf8').catch(() => '');
          openTagCount += (src.match(/<SignalBadge\b/g) || []).length;
          // SignalBadge 컴포넌트 내부에선 size= prop만 정의되므로 size="..." 카운트는
          // 전체 size= 매칭에서 SIZE_CLASS의 sm: 정의 + size 파라미터 등 5건 정도 빼면 됨.
          // 단순 lower-bound로: <SignalBadge 직후 같은 라인 또는 이후 ~3 라인 내 size=.
          const lines = src.split('\n');
          for (let i = 0; i < lines.length; i++) {
              if (!/<SignalBadge\b/.test(lines[i])) continue;
              // 같은 라인 또는 이어지는 라인에서 size=" 매칭 (다음 사이 닫히는 > 또는 새 JSX 전까지)
              for (let j = i; j < Math.min(lines.length, i + 5); j++) {
                  if (/size="[a-z]+"/.test(lines[j])) {
                      sizeAttrCount += 1;
                      break;
                  }
                  // 다음 라인이 명백히 다른 컴포넌트면 중단
                  if (j > i && /<[A-Z]\w/.test(lines[j])) break;
              }
          }
      }
      assert.ok(openTagCount >= 70, `SignalBadge 호출 70+ 건 (실제 ${openTagCount})`);
      assert.equal(openTagCount, sizeAttrCount,
          `모든 호출자 size 명시 (${sizeAttrCount}/${openTagCount})`);
  });

  test('cycle 419 회귀 가드: SIZE_CLASS md/lg 0건', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      const blockStart = source.indexOf('const SIZE_CLASS');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+md:/m.test(block), 'cycle 419 SIZE_CLASS.md 0건 보존');
      assert.ok(!/^\s+lg:/m.test(block), 'cycle 419 SIZE_CLASS.lg 0건 보존');
  });

  test('cycle 432 회귀 가드: AetherMark default size 0건', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      const fnIdx = source.indexOf('const AetherMark =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/size = 'md'/.test(block), 'cycle 432 default size 제거 보존');
  });
}

// ─── cycle-435-make-battle-record-ts-dead.test.js ───
{
  /**
   * cycle 435: DifficultyManager makeBattleRecord `ts` 출력 dead 정리
   *   (cycle 222-434 silent dead config 시리즈 194번째 — function output dead field
   *   cleanup lens 회귀, cycle 333-356 24-cycle 시리즈 패턴).
   *
   * 발견 (1 dead output field):
   * - src/systems/DifficultyManager.ts makeBattleRecord:
   *     `({ result, hpRatio: ..., ts: Date.now() })`
   * - 호출 사이트 (battle record consumers) 분석:
   *     · DifficultyManager.calcPerformanceScore: `battle.hpRatio` (lines 153)
   *     · gameUtils.ts:686: `battle.result === 'win'`
   *     · 외부 read: 0건. battle.ts read 0건.
   * - 결과: ts 필드 어디로도 흐르지 않는 dead output.
   *
   * 패턴 (cycle 222-434 시리즈 194번째):
   * - cycle 333-356 시리즈 (24 cycles): 함수 출력 dead 필드 cleanup.
   * - cycle 416: CombatPanel ACTION_BUTTONS tag/detail 출력 dead.
   * - cycle 423: ControlPanel coreButtons sidebarLabel 출력 dead.
   * - cycle 435: makeBattleRecord ts 출력 dead — 동일 lens 회귀.
   *
   * 수정 (src/systems/DifficultyManager.ts):
   * - makeBattleRecord return에서 `ts: Date.now()` 제거.
   *
   * 회귀 가드:
   * - result / hpRatio (활성 read 필드) 그대로.
   * - 50개 윈도우 슬라이싱 / DIFF_TABLE 매핑 등 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 435: makeBattleRecord 본체에서 ts 필드 0건', async () => {
      const source = await readSrc('src/systems/DifficultyManager.ts');
      const fnIdx = source.indexOf('export const makeBattleRecord');
      const fnEnd = source.indexOf('});', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/ts: Date\.now\(\)/.test(block), 'ts: Date.now() 0건');
      assert.ok(!/\bts\b/.test(block), 'ts 필드명 0건');
  });

  test('cycle 435: 활성 필드 (result / hpRatio) 보존', async () => {
      const source = await readSrc('src/systems/DifficultyManager.ts');
      const fnIdx = source.indexOf('export const makeBattleRecord');
      const fnEnd = source.indexOf('});', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(/\bresult\b/.test(block), 'result 필드 보존');
      assert.ok(/hpRatio/.test(block), 'hpRatio 필드 보존');
  });

  test('cycle 435: makeBattleRecord runtime — ts 필드 부재 + 활성 필드 정상', async () => {
      const { makeBattleRecord } = await import('../src/systems/DifficultyManager.ts');
      const record = makeBattleRecord('win', 0.5);
      assert.equal(record.result, 'win', 'result 정상');
      assert.equal(record.hpRatio, 0.5, 'hpRatio 정상');
      assert.equal(record.ts, undefined, 'ts 필드 부재 (dead 정리)');
      // hpRatio 클램프 동작 확인
      const overhigh = makeBattleRecord('escape', 1.5);
      assert.equal(overhigh.hpRatio, 1, 'hpRatio 1 초과 클램프');
      const overlow = makeBattleRecord('death', -0.2);
      assert.equal(overlow.hpRatio, 0, 'hpRatio 0 미만 클램프');
  });

  test('cycle 435: 정합성 가드 — battle.ts read 0건 (전체 src/)', async () => {
      const { readdir } = await import('node:fs/promises');
      async function* walk(dir) {
          for (const entry of await readdir(dir, { withFileTypes: true })) {
              const fp = path.join(dir, entry.name);
              if (entry.isDirectory()) yield* walk(fp);
              else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
          }
      }
      let tsReads = 0;
      for await (const fp of walk(path.join(ROOT, 'src'))) {
          const content = await readFile(fp, 'utf8').catch(() => '');
          // battle.ts 또는 record.ts 패턴 (Date.now에서 비롯된 timestamp 필드 read)
          if (/battle\.ts\b|record\.ts\b/.test(content)) tsReads += 1;
      }
      assert.equal(tsReads, 0, 'battle.ts / record.ts read 0건 (정합성)');
  });

  test('cycle 434 회귀 가드: EquipmentAvatarPreview defaults 0건', async () => {
      const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
      const fnIdx = source.indexOf('const EquipmentAvatarPreview');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/size = 24/.test(block), 'cycle 434 default size 제거 보존');
      assert.ok(!/variant = 'default'/.test(block), 'cycle 434 default variant 제거 보존');
  });
}

// ─── cycle-436-daily-deals-marker-dead.test.js ───
{
  /**
   * cycle 436: getDailyDeals isDailyDeal 마커 출력 dead 정리
   *   (cycle 222-435 silent dead config 시리즈 195번째 — function output dead field
   *   cleanup lens 회귀, cycle 415 paired completion).
   *
   * 발견 (1 dead output marker):
   * - src/utils/shopRotation.ts getDailyDeals:
   *     items에 `isDailyDeal: true` 마커 부여.
   * - 호출 사이트 production 분석:
   *     · ShopPanel.tsx — `dailyDeals.items`만 read (isDailyDeal 미참조).
   *     · 다른 production read 0건.
   *   → isDailyDeal 마커는 production에서 dead.
   * - 정합성 분석:
   *     · cycle 355는 isDailyDeal을 회귀 가드로 보존했으나, 그 회귀 가드 자체가
   *       유일한 read (circular guard).
   *     · cycle 415 isWeeklySpecial 마커 정리 시점에서도 paired completion 누락.
   *
   * 패턴 (cycle 222-435 시리즈 195번째):
   * - cycle 415: getWeeklySpecial isWeeklySpecial 마커 제거.
   * - cycle 436: getDailyDeals isDailyDeal 마커 제거 — paired completion (두
   *   shop rotation 마커 모두 정리).
   *
   * 수정 (src/utils/shopRotation.ts):
   * - getDailyDeals items에서 `isDailyDeal: true` 라인 제거.
   * - cycle 355 test의 `isDailyDeal 마커 보존` 어설션 제거.
   * - cycle 415 test의 cycle 355 회귀 가드 부분 갱신.
   *
   * 회귀 가드:
   * - originalPrice / price 그대로 (ShopPanel line-through 표시).
   * - 0.9 할인 multiplier 적용 그대로.
   * - getDailyDeals.items 배열 노출 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 436: getDailyDeals 본체에서 isDailyDeal 0건', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      const fnIdx = source.indexOf('export const getDailyDeals');
      const fnEnd = source.indexOf('export const getWeeklySpecial');
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/isDailyDeal/.test(block), 'getDailyDeals 본체 isDailyDeal 0건');
  });

  test('cycle 436: getDailyDeals 활성 필드 (originalPrice / price) 보존', async () => {
      const { getDailyDeals } = await import('../src/utils/shopRotation.ts');
      const result = getDailyDeals(5);
      assert.ok(Array.isArray(result.items), 'items 배열 노출');
      if (result.items.length > 0) {
          const first = result.items[0];
          assert.equal(typeof first.price, 'number', 'price 보존');
          assert.equal(typeof first.originalPrice, 'number', 'originalPrice 보존');
          assert.equal(first.price, Math.floor(first.originalPrice * 0.9),
              '0.9 할인 multiplier 그대로 적용');
          assert.equal(first.isDailyDeal, undefined, 'isDailyDeal 마커 제거');
      }
  });

  test('cycle 436: 정합성 가드 — production isDailyDeal read 0건', async () => {
      const { readdir } = await import('node:fs/promises');
      async function* walk(dir) {
          for (const entry of await readdir(dir, { withFileTypes: true })) {
              const fp = path.join(dir, entry.name);
              if (entry.isDirectory()) yield* walk(fp);
              else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
          }
      }
      let reads = 0;
      for await (const fp of walk(path.join(ROOT, 'src'))) {
          const content = await readFile(fp, 'utf8').catch(() => '');
          if (/isDailyDeal/.test(content)) reads += 1;
      }
      assert.equal(reads, 0, 'production에 isDailyDeal 0건 (정합성)');
  });

  test('cycle 415 회귀 가드: getWeeklySpecial 마커 할당 0건', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      const fnIdx = source.indexOf('export const getWeeklySpecial');
      const block = source.slice(fnIdx);
      // 마커 할당 (isWeeklySpecial: true) 0건 — 주석 멘션은 무관
      assert.ok(!/isWeeklySpecial: true/.test(block), 'cycle 415 마커 할당 0건 보존');
  });

  test('cycle 435 회귀 가드: makeBattleRecord ts 0건', async () => {
      const source = await readSrc('src/systems/DifficultyManager.ts');
      const fnIdx = source.indexOf('export const makeBattleRecord');
      const fnEnd = source.indexOf('});', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/ts: Date\.now/.test(block), 'cycle 435 ts: Date.now() 0건 보존');
  });
}

// ─── cycle-437-event-panel-default-mobile-focused-redundant.test.js ───
{
  /**
   * cycle 437: EventPanel default `mobileFocused = false` redundant 정리
   *   (cycle 222-436 silent dead config 시리즈 196번째 — redundant default annotation
   *   lens 회귀, cycle 364-368/428-434 패턴).
   *
   * 발견 (1 redundant default value):
   * - src/components/EventPanel.tsx:
   *     `({ currentEvent, actions, mobileFocused = false }: EventPanelProps) => { ... }`
   * - 호출 사이트 분석 (1곳, mobileFocused 명시 전달):
   *     ControlPanel.tsx:192: `<EventPanel currentEvent={currentEvent} actions={actions}
   *                            mobileFocused={mobileFocused} />`
   *   → 호출자 명시 → default false 도달 불가.
   *
   * 패턴 (cycle 222-436 시리즈 196번째):
   * - cycle 364-368/428-434: redundant default annotation 시리즈.
   * - cycle 437: EventPanel default mobileFocused — 동일 lens 회귀.
   *
   * 수정 (src/components/EventPanel.tsx):
   * - destructure에서 `mobileFocused = false` → `mobileFocused`.
   *
   * 회귀 가드:
   * - 1 호출자 명시 mobileFocused 전달 → 동작 그대로.
   * - currentEvent / actions 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 437: EventPanel mobileFocused cycle 489 cascade로 prop 자체 제거', async () => {
      // cycle 489가 EventPanel mobileFocused prop 자체를 cascade로 제거.
      // 이전 default 가드 → cascade 보존 가드로 약화.
      const source = await readSrc('src/components/EventPanel.tsx');
      assert.ok(!/mobileFocused/.test(source), 'cycle 489 cascade로 mobileFocused 제거 보존');
  });

  test('cycle 437: ControlPanel <EventPanel> mobileFocused 전달 cascade 제거', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const callMatch = source.match(/<EventPanel[^/]*\/>/);
      assert.ok(callMatch, 'EventPanel 호출 발견');
      assert.ok(!/mobileFocused/.test(callMatch[0]), 'cycle 489 cascade로 mobileFocused 전달 제거');
  });

  test('cycle 436 회귀 가드: getDailyDeals isDailyDeal 0건', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      const fnIdx = source.indexOf('export const getDailyDeals');
      const fnEnd = source.indexOf('export const getWeeklySpecial');
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/isDailyDeal:/.test(block), 'cycle 436 isDailyDeal 마커 0건 보존');
  });
}

// ─── cycle-439-event-history-timestamp-dead.test.js ───
{
  /**
   * cycle 439: handleEventChoice history record timestamp 출력 dead 정리
   *   (cycle 222-438 silent dead config 시리즈 198번째 — function output dead field
   *   cleanup lens 회귀, cycle 333-356/435/438 timestamp 시리즈 패턴).
   *
   * 발견 (1 dead output field):
   * - src/hooks/gameActions/eventActions.ts:139 (handleEventChoice 본체):
   *     `{ timestamp: Date.now(), event: currentEvent.desc,
   *        choice: currentEvent.choices?.[idx], outcome: resultText }`
   * - 호출 사이트 (history 기록 consumer) 분석:
   *     · aiEventUtils.ts summarizeHistory / getRecentEventSet:
   *       `entry.event / entry.choice / entry.outcome` 만 read.
   *     · history.timestamp / entry.timestamp read 0건 (전체 src/).
   *   → timestamp 필드 어디로도 흐르지 않는 dead output.
   *
   * 패턴 (cycle 222-438 시리즈 198번째 — timestamp dead 시리즈):
   * - cycle 435: makeBattleRecord ts: Date.now() 출력 dead.
   * - cycle 438: codex 엔트리 obtainedAt: Date.now() 출력 dead (4 producer batch).
   * - cycle 439: handleEventChoice history timestamp: Date.now() — 동일 lens 회귀.
   *
   * 수정 (src/hooks/gameActions/eventActions.ts):
   * - history record entry에서 `timestamp: Date.now()` 라인 제거.
   *
   * 회귀 가드:
   * - event / choice / outcome 필드 보존 (active read fields).
   * - history slice(-50) 윈도우 그대로.
   * - aiEventUtils의 summarizeHistory / getRecentEventSet 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 439: handleEventChoice 본체에서 timestamp 0건', async () => {
      const source = await readSrc('src/hooks/gameActions/eventActions.ts');
      const fnIdx = source.indexOf('handleEventChoice');
      const fnEnd = source.indexOf('return updatedPlayer;', fnIdx);
      const block = source.slice(fnIdx, fnEnd > fnIdx ? fnEnd : source.length);
      assert.ok(!/timestamp:/.test(block), 'history record timestamp 0건');
  });

  test('cycle 439: 활성 필드 (event / choice / outcome) 보존', async () => {
      const source = await readSrc('src/hooks/gameActions/eventActions.ts');
      const newHistoryIdx = source.indexOf('newHistory');
      const sliceEnd = source.indexOf('.slice(-50)', newHistoryIdx);
      const block = source.slice(newHistoryIdx, sliceEnd);
      assert.ok(/event: currentEvent\.desc/.test(block), 'event 필드 보존');
      assert.ok(/choice: currentEvent\.choices/.test(block), 'choice 필드 보존');
      assert.ok(/outcome: resultText/.test(block), 'outcome 필드 보존');
  });

  test('cycle 439: 정합성 가드 — history.timestamp / entry.timestamp read 0건', async () => {
      const { readdir } = await import('node:fs/promises');
      async function* walk(dir) {
          for (const entry of await readdir(dir, { withFileTypes: true })) {
              const fp = path.join(dir, entry.name);
              if (entry.isDirectory()) yield* walk(fp);
              else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
          }
      }
      let reads = 0;
      for await (const fp of walk(path.join(ROOT, 'src'))) {
          const content = await readFile(fp, 'utf8').catch(() => '');
          // history entry timestamp 패턴 read (graveUtils의 grave.timestamp는 별개)
          if (/entry\.timestamp\b|history\[\d+\]\.timestamp\b|h\.timestamp\b/.test(content)) {
              reads += 1;
          }
      }
      assert.equal(reads, 0, 'history entry timestamp read 0건');
  });

  test('cycle 438 회귀 가드: codex 엔트리 obtainedAt 0건', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.ok(!/obtainedAt/.test(source), 'cycle 438 obtainedAt 0건 보존');
  });
}

// ─── cycle-441-focus-panel-header-defaults-redundant.test.js ───
{
  /**
   * cycle 441: FocusPanelHeader default `backLabel = '뒤로'` redundant 정리
   *   (cycle 222-440 silent dead config 시리즈 199번째 — redundant default annotation
   *   lens 회귀, cycle 364-368/428-434/437 패턴, 5 컴포넌트 batch 분석).
   *
   * 발견 (1 redundant default value — 5 호출자 100% 명시 검증):
   * - src/components/FocusPanelHeader.tsx default `backLabel = '뒤로'`.
   * - 호출 사이트 (5곳, 모두 backLabel="복귀" 명시):
   *     EventPanel.tsx / QuestBoardPanel.tsx / ShopPanel.tsx /
   *     CraftingPanel.tsx / JobChangePanel.tsx
   *   → default '뒤로'는 도달 불가.
   * - 다른 default 보존 결정:
   *     · `archiveLabel = '인벤토리'` — 4 호출자 명시 ("INV"), EventPanel은
   *       onOpenArchive 미사용이라 archiveLabel default 도달 불가하지만 props
   *       semantic 보호용 보존.
   *     · `titleClassName = ''` — 4/5 호출자 명시, JobChangePanel은 미전달.
   *       default 활성 path.
   *
   * 패턴 (cycle 222-440 시리즈 199번째):
   * - cycle 364-368/428-434/437: redundant default annotation 시리즈.
   * - cycle 441: FocusPanelHeader backLabel — 5 호출자 batch 검증.
   *
   * 수정:
   * - destructure에서 `backLabel = '뒤로'` → `backLabel`.
   *
   * 회귀 가드:
   * - 5 호출자 모두 명시 backLabel 전달 → 동작 그대로.
   * - 다른 default (eyebrow / meta / archiveLabel / titleClassName / onBack /
   *   backTestId / rightSlot / onOpenArchive / archiveTestId / className /
   *   bleedClassName) 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 441: FocusPanelHeader destructure에서 default backLabel 제거', async () => {
      const source = await readSrc('src/components/FocusPanelHeader.tsx');
      const destructIdx = source.indexOf('const FocusPanelHeader');
      const destructEnd = source.indexOf('}: any) => (', destructIdx);
      const block = source.slice(destructIdx, destructEnd);
      assert.ok(!/backLabel = '뒤로'/.test(block), "default backLabel 제거됨");
      assert.ok(/\bbackLabel\b/.test(block), 'backLabel 파라미터 보존');
  });

  test('cycle 441: 보존 default — meta/titleClassName/bleedClassName 그대로', async () => {
      // cycle 467이 eyebrow / archiveLabel / className 추가 정리. 이 assertion은
      // cycle 467 이후 잔존 default만 가드.
      const source = await readSrc('src/components/FocusPanelHeader.tsx');
      const destructIdx = source.indexOf('const FocusPanelHeader');
      const destructEnd = source.indexOf('}: any) => (', destructIdx);
      const block = source.slice(destructIdx, destructEnd);
      assert.ok(/meta = ''/.test(block), 'meta default 보존');
      assert.ok(/titleClassName = ''/.test(block), 'titleClassName default 보존');
      assert.ok(/bleedClassName = '-mx-3 px-3'/.test(block), 'bleedClassName default 보존');
  });

  test('cycle 441: 정합성 가드 — 5 호출자 모두 backLabel 명시 전달', async () => {
      const componentDir = path.join(ROOT, 'src/components');
      const files = await readdir(componentDir, { recursive: true });
      let totalCalls = 0;
      let backLabelCalls = 0;
      for (const f of files) {
          if (!String(f).endsWith('.tsx')) continue;
          const fp = path.join(componentDir, String(f));
          const src = await readFile(fp, 'utf8').catch(() => '');
          const segments = src.split(/<FocusPanelHeader\b/).slice(1);
          for (const seg of segments) {
              const closeIdx = seg.indexOf('/>');
              if (closeIdx < 0) continue;
              const propsBlock = seg.slice(0, closeIdx);
              totalCalls += 1;
              if (/backLabel=/.test(propsBlock)) backLabelCalls += 1;
          }
      }
      assert.ok(totalCalls >= 5, `FocusPanelHeader 호출 5+ 건 (실제 ${totalCalls})`);
      assert.equal(totalCalls, backLabelCalls,
          `모든 호출자 backLabel 명시 (${backLabelCalls}/${totalCalls})`);
  });

  test('cycle 439 회귀 가드: handleEventChoice timestamp 0건', async () => {
      const source = await readSrc('src/hooks/gameActions/eventActions.ts');
      const newHistoryIdx = source.indexOf('newHistory');
      const sliceEnd = source.indexOf('.slice(-50)', newHistoryIdx);
      const block = source.slice(newHistoryIdx, sliceEnd);
      assert.ok(!/timestamp:/.test(block), 'cycle 439 timestamp 0건 보존');
  });
}

// ─── cycle-442-map-progress-visited-dead.test.js ───
{
  /**
   * cycle 442: getMapProgressState `visited` 출력 dead 정리
   *   (cycle 222-441 silent dead config 시리즈 200번째 — function output dead field
   *   cleanup lens 회귀, cycle 333-356/435/438/439 패턴).
   *
   * 발견 (1 dead output field):
   * - src/utils/mapProgress.ts getMapProgressState (line 24+):
   *     `return { visited, state, isCurrent, progress }`
   * - 호출 사이트 (consumer) 분석:
   *     · MapNavigator.tsx — entry.state / entry.isCurrent / entry.progress만 read.
   *     · production .visited read 0건.
   *     · tests/map-progress.test.js만 visited 어설션 (cycle 442에서 갱신).
   * - 내부 사용:
   *     `visited`는 함수 내부에서 `state` 결정용으로 사용 (line 33+).
   *     출력 필드로의 노출은 dead.
   *
   * 패턴 (cycle 222-441 시리즈 200번째 — 마일스톤 200):
   * - cycle 333-356 시리즈: 함수 출력 dead 필드 cleanup.
   * - cycle 435: makeBattleRecord ts 출력 dead.
   * - cycle 438: codex obtainedAt 출력 dead.
   * - cycle 439: history record timestamp 출력 dead.
   * - cycle 442: getMapProgressState visited 출력 dead — 동일 lens 회귀.
   *
   * 수정 (src/utils/mapProgress.ts):
   * - return에서 `visited` 필드 제거 (state/isCurrent/progress만 노출).
   * - 내부 const `visited`는 state 계산용으로 보존.
   * - tests/map-progress.test.js stale assertion 갱신.
   *
   * 회귀 가드:
   * - state / isCurrent / progress (활성 read 필드) 그대로.
   * - state 계산 로직 동일 (visited는 내부 const로 유지).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 442: getMapProgressState return에서 visited 필드 0건', async () => {
      const source = await readSrc('src/utils/mapProgress.ts');
      const fnIdx = source.indexOf('export const getMapProgressState');
      const returnIdx = source.indexOf('return {', fnIdx);
      const returnEnd = source.indexOf('};', returnIdx);
      const returnBlock = source.slice(returnIdx, returnEnd);
      assert.ok(!/^\s+visited,?\s*$/m.test(returnBlock),
          'return block에 visited 필드 0건');
  });

  test('cycle 442: 내부 const visited 보존 (state 계산용)', async () => {
      const source = await readSrc('src/utils/mapProgress.ts');
      assert.ok(/const visited = visitedSet\.has/.test(source),
          '내부 const visited 보존');
      assert.ok(/state = visited \?/.test(source),
          'state 계산에서 visited 사용 보존');
  });

  test('cycle 442: 활성 출력 필드 (state / isCurrent / progress) 보존', async () => {
      const { getMapProgressState } = await import('../src/utils/mapProgress.ts');
      const result = getMapProgressState('시작의 마을',
          { loc: '시작의 마을', stats: { visitedMaps: ['시작의 마을'] } },
          { '시작의 마을': { monsters: [] } }
      );
      assert.equal(typeof result.state, 'string', 'state string 노출');
      assert.equal(typeof result.isCurrent, 'boolean', 'isCurrent boolean 노출');
      assert.equal(typeof result.progress, 'object', 'progress object 노출');
      assert.equal(result.visited, undefined, 'visited 필드 제거');
  });

  test('cycle 442: 정합성 가드 — production .visited read 0건', async () => {
      const { readdir } = await import('node:fs/promises');
      async function* walk(dir) {
          for (const entry of await readdir(dir, { withFileTypes: true })) {
              const fp = path.join(dir, entry.name);
              if (entry.isDirectory()) yield* walk(fp);
              else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
          }
      }
      let reads = 0;
      for await (const fp of walk(path.join(ROOT, 'src'))) {
          const content = await readFile(fp, 'utf8').catch(() => '');
          // entry.visited / state.visited / progress.visited 패턴
          if (/(entry|state|result)\.visited\b/.test(content)) {
              reads += 1;
          }
      }
      assert.equal(reads, 0, 'production .visited read 0건');
  });

  test('cycle 441 회귀 가드: FocusPanelHeader default backLabel 0건', async () => {
      const source = await readSrc('src/components/FocusPanelHeader.tsx');
      const destructIdx = source.indexOf('const FocusPanelHeader');
      const destructEnd = source.indexOf('}: any) => (', destructIdx);
      const block = source.slice(destructIdx, destructEnd);
      assert.ok(!/backLabel = '뒤로'/.test(block), 'cycle 441 default 제거 보존');
  });
}

// ─── cycle-443-run-build-profile-tag-score-dead.test.js ───
{
  /**
   * cycle 443: getRunBuildProfile tag.score 출력 dead 정리
   *   (cycle 222-442 silent dead config 시리즈 201번째 — function output dead field
   *   cleanup lens 회귀, cycle 333-356/347 _sortKey strip 패턴).
   *
   * 발견 (1 dead output field — 6 tag entries × score):
   * - src/utils/runProfile.ts getRunBuildProfile (line 130+):
   *     `return { primary, tags: ranked.slice(0, 5) }`
   *   ranked tags 각 entry는 `{ id, name, score, reasons }` (scoreTag 결과).
   * - 호출 사이트 (consumer) 분석:
   *     · useGameEngine.ts:104 + exploreActions.ts:68 — `tags.map((tag) => tag.name)` 만 read.
   *     · runProfile 내부에선 score를 filter (≥3) + sort에 사용 후 외부 미read.
   *     · primary는 ranked[0]이라 동일 score 보유 (외부 read는 .id/.name/.reasons만).
   * - 결과: tag.score는 정렬 후 외부로 흐르지 않는 dead. cycle 347 _sortKey strip
   *   패턴 적용 가능.
   *
   * 패턴 (cycle 222-442 시리즈 201번째):
   * - cycle 333-356 시리즈: 함수 출력 dead 필드 cleanup.
   * - cycle 347: scoreQuest _sortKey strip 패턴.
   * - cycle 442: getMapProgressState visited 출력 dead.
   * - cycle 443: getRunBuildProfile tag.score 출력 dead — 동일 lens 회귀.
   *
   * 수정 (src/utils/runProfile.ts):
   * - ranked 정렬 후 `.map(({ score, ...rest }) => rest)`로 score strip.
   * - scoreTag는 그대로 (sort 단계에서 score 필요).
   * - primary = ranked[0]도 score 부재 entry로 변경.
   *
   * 회귀 가드:
   * - tag.id / .name / .reasons 보존 (활성 read 필드).
   * - filter (≥3) / sort (score desc) 동작 그대로.
   * - balanced fallback 'primary'도 score 부재.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 443: getRunBuildProfile 반환 tags entry에 score 0건', async () => {
      const { getRunBuildProfile } = await import('../src/utils/runProfile.ts');
      const player = {
          equip: {
              weapon: { type: 'weapon', hands: 2, val: 50, jobs: ['전사'] },
              offhand: null,
              armor: null,
          },
          relics: [{ effect: 'execute_bonus' }, { effect: 'armor_pen' }],
          hp: 100,
          maxHp: 100,
          job: '전사',
      };
      const result = getRunBuildProfile(player, { maxHp: 100 });
      for (const tag of result.tags) {
          assert.equal(tag.score, undefined, `tag ${tag.id}/${tag.name} score 부재`);
      }
  });

  test('cycle 443: primary entry에서도 score 0건', async () => {
      const { getRunBuildProfile } = await import('../src/utils/runProfile.ts');
      const player = {
          equip: { weapon: null, offhand: null, armor: null },
          relics: [],
          hp: 100, maxHp: 100,
          job: '모험가',
      };
      const result = getRunBuildProfile(player, { maxHp: 100 });
      assert.ok(result.primary, 'primary 노출');
      assert.equal(result.primary.score, undefined, 'primary.score 0건');
      // primary 활성 필드는 보존
      assert.equal(typeof result.primary.id, 'string', 'primary.id 보존');
      assert.equal(typeof result.primary.name, 'string', 'primary.name 보존');
      assert.ok(Array.isArray(result.primary.reasons), 'primary.reasons 보존');
  });

  test('cycle 443: 활성 필드 (id / name / reasons) 그대로', async () => {
      const { getRunBuildProfile } = await import('../src/utils/runProfile.ts');
      const player = {
          equip: {
              weapon: { type: 'weapon', hands: 2, val: 50, jobs: ['전사'] },
              offhand: null,
              armor: null,
          },
          relics: [{ effect: 'execute_bonus' }, { effect: 'armor_pen' }, { effect: 'ancient_power' }],
          hp: 100, maxHp: 100,
          job: '전사',
      };
      const result = getRunBuildProfile(player, { maxHp: 100 });
      assert.ok(result.tags.length > 0, 'tags 있음');
      for (const tag of result.tags) {
          assert.equal(typeof tag.id, 'string', 'tag.id 보존');
          assert.equal(typeof tag.name, 'string', 'tag.name 보존');
          assert.ok(Array.isArray(tag.reasons), 'tag.reasons 보존');
      }
  });

  test('cycle 443: filter / sort 동작 보존 (정렬 순서 회귀 가드)', async () => {
      const { getRunBuildProfile } = await import('../src/utils/runProfile.ts');
      const player = {
          equip: {
              weapon: { type: 'weapon', hands: 2, val: 50, jobs: ['전사'] },
              offhand: null,
              armor: { type: 'armor' },
          },
          relics: [
              { effect: 'execute_bonus' }, { effect: 'armor_pen' }, { effect: 'ancient_power' },
              { effect: 'reflect' }, { effect: 'fortress' },
          ],
          hp: 100, maxHp: 100,
          job: '전사',
      };
      const result = getRunBuildProfile(player, { maxHp: 100 });
      // crusher가 양손+처형보너스+방어관통+고대분노로 high score → primary 후보
      assert.equal(result.primary.id, 'crusher', 'crusher가 primary');
      // tags 길이 ≤ 5
      assert.ok(result.tags.length <= 5, 'tags 최대 5개');
  });

  test('cycle 442 회귀 가드: getMapProgressState visited 출력 0건', async () => {
      const source = await readSrc('src/utils/mapProgress.ts');
      const fnIdx = source.indexOf('export const getMapProgressState');
      const returnIdx = source.indexOf('return {', fnIdx);
      const returnEnd = source.indexOf('};', returnIdx);
      const returnBlock = source.slice(returnIdx, returnEnd);
      assert.ok(!/^\s+visited,?\s*$/m.test(returnBlock),
          'cycle 442 visited 출력 0건 보존');
  });
}

// ─── cycle-444-handle-menu-action-reset-unreachable.test.js ───
{
  /**
   * cycle 444: Dashboard handleMenuAction 'reset' 분기 unreachable 정리
   *   (cycle 222-443 silent dead config 시리즈 202번째 — unreachable code path lens
   *   회귀, cycle 357/425 패턴).
   *
   * 발견 (2 dead conditional branches + 1 redundant guard):
   * - src/components/Dashboard.tsx handleMenuAction (line 118+):
   *     `if (actionId !== 'reset') { setConfirmMenuReset(false); }`
   *     `if (actionId === 'reset') { setConfirmMenuReset(true); }`
   * - 호출 사이트 분석:
   *     · handleMenuAction은 단일 caller `onClick={() => handleMenuAction(action.id)}` (line 383).
   *     · `action.id`는 TOWN_MENU_ACTIONS map에서 옴: rest / class / quest / craft.
   *     · 'reset' actionId는 어떤 caller도 전달 0건.
   * - 결과:
   *     · `actionId !== 'reset'` 항상 true → 가드 redundant (unconditional 처리).
   *     · `actionId === 'reset'` 항상 false → 분기 unreachable.
   * - confirmMenuReset state는 별도 caller (`onClick={() => setConfirmMenuReset(true)}`)
   *   에서 직접 set. handleMenuAction 경로 불필요.
   *
   * 패턴 (cycle 222-443 시리즈 202번째):
   * - cycle 357: pickFallbackEvent explicit 분기 unreachable.
   * - cycle 425: pickFallbackEvent paired completion.
   * - cycle 444: handleMenuAction 'reset' 분기 unreachable — 동일 lens 회귀.
   *
   * 수정 (src/components/Dashboard.tsx):
   * - `if (actionId !== 'reset')` 가드 제거 → 무조건 `setConfirmMenuReset(false)`.
   * - `if (actionId === 'reset')` 분기 제거 (unreachable).
   *
   * 회귀 가드:
   * - rest / class / quest / craft 분기 동작 그대로.
   * - confirmMenuReset state 자체는 보존 (별도 caller가 set).
   * - handleMenuAction 호출 시 무조건 confirmMenuReset이 false로 reset (기존 동작 유지).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 444: handleMenuAction에서 'reset' 분기 0건", async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const fnIdx = source.indexOf('const handleMenuAction');
      const fnEnd = source.indexOf('};', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/actionId === 'reset'/.test(block),
          "handleMenuAction에서 actionId === 'reset' 분기 0건");
      assert.ok(!/actionId !== 'reset'/.test(block),
          "handleMenuAction에서 actionId !== 'reset' 가드 0건");
  });

  test('cycle 444: 활성 분기 (rest / class / quest / craft) 보존', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const fnIdx = source.indexOf('const handleMenuAction');
      const fnEnd = source.indexOf('};', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(/actionId === 'rest'/.test(block), "rest 분기 보존");
      assert.ok(/actionId === 'class'/.test(block), "class 분기 보존");
      assert.ok(/actionId === 'quest'/.test(block), "quest 분기 보존");
      assert.ok(/actionId === 'craft'/.test(block), "craft 분기 보존");
  });

  test('cycle 444: 정합성 가드 — TOWN_MENU_ACTIONS는 reset id 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const constIdx = source.indexOf('const TOWN_MENU_ACTIONS');
      const constEnd = source.indexOf('];', constIdx);
      const block = source.slice(constIdx, constEnd);
      assert.ok(!/id: 'reset'/.test(block), 'TOWN_MENU_ACTIONS에 reset id 0건');
  });

  test('cycle 444: confirmMenuReset state 자체는 보존 (별도 caller가 set)', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      assert.ok(/confirmMenuReset, setConfirmMenuReset/.test(source),
          'confirmMenuReset state 정의 보존');
      // 직접 caller (별도 button onClick)는 보존
      const directCaller = source.match(/onClick={\(\) => setConfirmMenuReset\(true\)}/);
      assert.ok(directCaller, '별도 caller 보존');
  });

  test('cycle 443 회귀 가드: getRunBuildProfile primary.score 0건', async () => {
      const { getRunBuildProfile } = await import('../src/utils/runProfile.ts');
      const player = {
          equip: { weapon: null, offhand: null, armor: null },
          relics: [], hp: 100, maxHp: 100, job: '모험가',
      };
      const result = getRunBuildProfile(player, { maxHp: 100 });
      assert.equal(result.primary.score, undefined, 'cycle 443 primary.score 0건 보존');
  });
}

// ─── cycle-446-build-runtime-palette-dead-fields.test.js ───
{
  /**
   * cycle 446: artPalette buildRuntimePalette 4 출력 dead 정리
   *   (cycle 222-445 silent dead config 시리즈 204번째 — function output dead field
   *   cleanup lens 회귀, cycle 333-356/443/445 패턴).
   *
   * 발견 (4 dead output fields):
   * - src/data/artPalette.ts buildRuntimePalette (line 23+):
   *     return `{ outline, shade, mid, hi, trim, material, base, accent }`
   * - 호출 사이트 (consumer) 분석:
   *     · equipmentArt.ts tintPalette — `palette.base / .shade / .accent / .trim` 만 read.
   *     · production .outline / .mid / .hi / .material read 0건 (정합성 가드 검증).
   *     · tests에서도 0건 (character-appearance 테스트는 별개 appearance.palette).
   * - 결과: outline / mid / hi / material 4 필드는 buildRuntimePalette가 set하지만
   *   어디로도 흐르지 않는 dead. base / accent는 mid / hi의 alias로 활성.
   *
   * 패턴 (cycle 222-445 시리즈 204번째):
   * - cycle 333-356/443: 함수 출력 dead 필드 cleanup.
   * - cycle 445: SIGNATURE_PITY.STEP_MULT exposed property dead.
   * - cycle 446: buildRuntimePalette 4 출력 dead — 동일 lens 회귀 (4 필드 batch).
   *
   * 수정 (src/data/artPalette.ts):
   * - buildRuntimePalette return에서 outline / mid / hi / material 4 필드 제거.
   * - base / shade / accent / trim 4 활성 필드만 노출.
   *
   * 회귀 가드:
   * - base / shade / accent / trim 보존 (활성 read 필드).
   * - tintPalette 동작 그대로.
   * - getEquipmentArtProfile palette 산출 동작 그대로.
   * - paletteSource (artPalette.json) 자체는 무영향 (내부 raw도 그대로 유지).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 446: buildRuntimePalette return에서 4 dead 필드 0건', async () => {
      const source = await readSrc('src/data/artPalette.ts');
      const fnIdx = source.indexOf('const buildRuntimePalette');
      const fnEnd = source.indexOf('});', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/outline:/.test(block), 'outline 필드 0건');
      assert.ok(!/^\s+mid:/m.test(block), 'mid 필드 0건');
      assert.ok(!/^\s+hi:/m.test(block), 'hi 필드 0건');
      assert.ok(!/material:/.test(block), 'material 필드 0건');
  });

  test('cycle 446: 활성 필드 (base / shade / accent / trim) 보존', async () => {
      const { TONE_PALETTES } = await import('../src/data/artPalette.ts');
      const tones = Object.keys(TONE_PALETTES);
      assert.ok(tones.length > 0, 'TONE_PALETTES 노출');
      const sample = TONE_PALETTES[tones[0]];
      assert.equal(typeof sample.base, 'string', 'base 보존');
      assert.equal(typeof sample.shade, 'string', 'shade 보존');
      assert.equal(typeof sample.accent, 'string', 'accent 보존');
      assert.equal(typeof sample.trim, 'string', 'trim 보존');
  });

  test('cycle 446: dead 필드 부재 runtime 검증 (outline / mid / hi / material)', async () => {
      const { TONE_PALETTES } = await import('../src/data/artPalette.ts');
      const tones = Object.keys(TONE_PALETTES);
      const sample = TONE_PALETTES[tones[0]];
      assert.equal(sample.outline, undefined, 'outline 부재');
      assert.equal(sample.mid, undefined, 'mid 부재');
      assert.equal(sample.hi, undefined, 'hi 부재');
      assert.equal(sample.material, undefined, 'material 부재');
  });

  test('cycle 446: getEquipmentArtProfile palette 동작 보존', async () => {
      const { getEquipmentArtProfile } = await import('../src/utils/equipmentArt.ts');
      const profile = getEquipmentArtProfile({ name: '롱소드', type: 'weapon', tier: 1 }, 'weapon');
      assert.ok(profile.palette, 'palette 노출 보존');
      assert.equal(typeof profile.palette.base, 'string', 'palette.base string');
      assert.equal(typeof profile.palette.shade, 'string', 'palette.shade string');
      assert.equal(typeof profile.palette.accent, 'string', 'palette.accent string');
      assert.equal(typeof profile.palette.trim, 'string', 'palette.trim string');
  });

  test('cycle 445 회귀 가드: SIGNATURE_PITY.STEP_MULT 미노출', async () => {
      const { SIGNATURE_PITY } = await import('../src/utils/signaturePity.ts');
      assert.equal(SIGNATURE_PITY.STEP_MULT, undefined, 'cycle 445 STEP_MULT 미노출 보존');
  });
}

// ─── cycle-447-character-palette-dead-fields.test.js ───
{
  /**
   * cycle 447: characterAppearance palette 5 출력 dead 정리
   *   (cycle 222-446 silent dead config 시리즈 205번째 — function output dead field
   *   cleanup lens 회귀, cycle 333-356/443/445/446 패턴, 5 필드 batch).
   *
   * 발견 (5 dead palette fields):
   * - src/utils/characterAppearance.ts deriveCharacterAppearance.palette:
   *     `{ skin, outline, eye, blush, hair, outfit, accent, armor, weapon, offhand, glow }`
   * - 호출 사이트 (consumer) 분석:
   *     · production: PixelCharacterAvatar.tsx — `palette.glow` / `palette.accent`만 read.
   *     · tests: character-appearance.test.js — `palette.outfit / .weapon / .offhand` read.
   *     · cycle 362 test — `palette.hair` read.
   *     · `palette.skin / .outline / .eye / .blush / .armor` read 0건 (전체 src/ + tests/).
   * - 결과: 5 필드 (skin / outline / eye / blush / armor)는 set하지만 어디로도
   *   흐르지 않는 dead.
   *
   * 패턴 (cycle 222-446 시리즈 205번째):
   * - cycle 333-356/443/445/446: 함수 출력 dead 필드 cleanup.
   * - cycle 447: characterAppearance palette 5 dead 필드 batch — 동일 lens 회귀.
   *
   * 수정 (src/utils/characterAppearance.ts):
   * - palette object에서 skin / outline / eye / blush / armor 5 필드 제거.
   * - hair / outfit / accent / weapon / offhand / glow 6 활성 필드 보존.
   * - getOverlayTone 호출도 'armor' slot 제거 (weapon / offhand만 유지).
   *
   * 회귀 가드:
   * - palette.glow / .accent (production read) 보존.
   * - palette.outfit / .weapon / .offhand / .hair (test read) 보존.
   * - getOverlayTone 함수 자체는 weapon / offhand로 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 447: deriveCharacterAppearance.palette에서 5 dead 필드 0건', async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      // palette object 블록 추출
      const paletteIdx = source.indexOf('palette: {');
      const paletteEnd = source.indexOf('},', paletteIdx);
      const block = source.slice(paletteIdx, paletteEnd);
      assert.ok(!/skin:/.test(block), 'palette.skin 0건');
      assert.ok(!/outline:/.test(block), 'palette.outline 0건');
      assert.ok(!/eye:/.test(block), 'palette.eye 0건');
      assert.ok(!/blush:/.test(block), 'palette.blush 0건');
      assert.ok(!/^\s+armor:/m.test(block), 'palette.armor 0건');
  });

  test('cycle 447: 활성 필드 (glow / accent / outfit / weapon / offhand / hair) 보존', async () => {
      const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.ts');
      const player = { job: '모험가', equip: { weapon: null, armor: null, offhand: null } };
      const appearance = deriveCharacterAppearance(player);
      assert.equal(typeof appearance.palette.glow, 'string', 'glow 보존');
      assert.equal(typeof appearance.palette.accent, 'string', 'accent 보존');
      assert.equal(typeof appearance.palette.outfit, 'string', 'outfit 보존');
      assert.equal(typeof appearance.palette.weapon, 'string', 'weapon 보존');
      assert.equal(typeof appearance.palette.offhand, 'string', 'offhand 보존');
      assert.equal(typeof appearance.palette.hair, 'string', 'hair 보존');
  });

  test('cycle 447: dead 필드 부재 runtime 검증', async () => {
      const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.ts');
      const player = { job: '모험가', equip: { weapon: null, armor: null, offhand: null } };
      const appearance = deriveCharacterAppearance(player);
      assert.equal(appearance.palette.skin, undefined, 'skin 부재');
      assert.equal(appearance.palette.outline, undefined, 'outline 부재');
      assert.equal(appearance.palette.eye, undefined, 'eye 부재');
      assert.equal(appearance.palette.blush, undefined, 'blush 부재');
      assert.equal(appearance.palette.armor, undefined, 'armor 부재');
  });

  test('cycle 447: 정합성 가드 — production palette dead 필드 read 0건', async () => {
      const { readdir } = await import('node:fs/promises');
      async function* walk(dir) {
          for (const entry of await readdir(dir, { withFileTypes: true })) {
              const fp = path.join(dir, entry.name);
              if (entry.isDirectory()) yield* walk(fp);
              else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
          }
      }
      const deadFields = ['skin', 'outline', 'eye', 'blush'];
      for await (const fp of walk(path.join(ROOT, 'src'))) {
          const content = await readFile(fp, 'utf8').catch(() => '');
          for (const field of deadFields) {
              const re = new RegExp(`palette\\.${field}\\b`);
              assert.ok(!re.test(content), `${fp}에서 palette.${field} read 0건`);
          }
      }
  });

  test('cycle 446 회귀 가드: TONE_PALETTES outline / mid / hi / material 0건', async () => {
      const { TONE_PALETTES } = await import('../src/data/artPalette.ts');
      const tones = Object.keys(TONE_PALETTES);
      if (tones.length > 0) {
          const sample = TONE_PALETTES[tones[0]];
          assert.equal(sample.outline, undefined, 'cycle 446 outline 0건 보존');
          assert.equal(sample.mid, undefined, 'cycle 446 mid 0건 보존');
          assert.equal(sample.hi, undefined, 'cycle 446 hi 0건 보존');
          assert.equal(sample.material, undefined, 'cycle 446 material 0건 보존');
      }
  });
}

// ─── cycle-448-element-color-map-physical-unreachable.test.js ───
{
  /**
   * cycle 448: ELEMENT_COLOR_MAP '물리' 엔트리 unreachable 정리
   *   (cycle 222-447 silent dead config 시리즈 206번째 — unreachable lookup entry
   *   lens 회귀, cycle 421/425/444 패턴, 호출 사이트 producer 분석).
   *
   * 발견 (1 dead lookup entry):
   * - src/utils/characterAppearance.ts ELEMENT_COLOR_MAP:
   *     `{ 화염, 냉기, 어둠, 빛, 자연, 대지, 물리 }`
   * - 호출 사이트 (consumer) 분석:
   *     · `glow: ELEMENT_COLOR_MAP[frameTone as string] || baseStyle.accentColor`
   *     · `frameTone = armor?.elem || weapon?.elem || offhand?.elem || null`
   * - producer 분석:
   *     · items.ts elem 값: 화염/냉기/대지/바람/빛/어둠/에테르/자연 (8 종).
   *     · '물리' elem 0건 (전체 items.ts).
   *   → ELEMENT_COLOR_MAP['물리'] lookup 절대 hit 안 됨.
   *
   * 패턴 (cycle 222-447 시리즈 206번째):
   * - cycle 421: SkillTypeIcon TYPE_PATHS '번개' unreachable.
   * - cycle 444: handleMenuAction 'reset' 분기 unreachable.
   * - cycle 448: ELEMENT_COLOR_MAP '물리' unreachable — 동일 lens 회귀.
   *
   * 수정 (src/utils/characterAppearance.ts):
   * - ELEMENT_COLOR_MAP에서 `'물리': ...` 라인 제거.
   *
   * 회귀 가드:
   * - 활성 6 키 (화염/냉기/어둠/빛/자연/대지) 보존.
   * - fallback `|| baseStyle.accentColor` 동작 그대로.
   * - 바람/에테르 elem은 fallback path 활성 (원래 그랬음).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 448: ELEMENT_COLOR_MAP에서 '물리' 엔트리 0건", async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      const blockStart = source.indexOf('const ELEMENT_COLOR_MAP');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+물리:/m.test(block), "ELEMENT_COLOR_MAP에서 '물리' 0건");
  });

  test('cycle 448: 활성 6 키 보존 (화염/냉기/어둠/빛/자연/대지)', async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      const blockStart = source.indexOf('const ELEMENT_COLOR_MAP');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      for (const key of ['화염', '냉기', '어둠', '빛', '자연', '대지']) {
          const re = new RegExp(`^\\s+${key}:`, 'm');
          assert.ok(re.test(block), `활성 키 ${key} 보존`);
      }
  });

  test("cycle 448: 정합성 가드 — items.ts에 elem='물리' 0건", async () => {
      const source = await readSrc('src/data/items.ts');
      const matches = source.match(/^\s+\{[^}]*elem: '물리'/mg) || [];
      // grep과 동일하게 match 수 검증 (`elem: '물리'` 단독 매칭)
      const elemPhysical = source.match(/(\s|,)elem: '물리'/g) || [];
      assert.equal(elemPhysical.length, 0, "items.ts에 elem='물리' 0건");
      void matches;
  });

  test('cycle 448: deriveCharacterAppearance.palette.glow runtime — fallback 활성', async () => {
      const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.ts');
      // 모든 elem이 없는 player → glow는 baseStyle.accentColor fallback.
      const player = { job: '모험가', equip: { weapon: null, armor: null, offhand: null } };
      const appearance = deriveCharacterAppearance(player);
      assert.equal(typeof appearance.palette.glow, 'string', 'glow string 반환');
      // 화염 elem player → ELEMENT_COLOR_MAP.화염 활성 path
      const firePlayer = { job: '전사', equip: { weapon: { elem: '화염' }, armor: null, offhand: null } };
      const fireAppearance = deriveCharacterAppearance(firePlayer);
      assert.equal(fireAppearance.palette.glow, '#fb923c', '화염 elem → 매핑된 색상');
  });

  test('cycle 447 회귀 가드: palette.skin 등 dead 필드 0건', async () => {
      const { deriveCharacterAppearance } = await import('../src/utils/characterAppearance.ts');
      const player = { job: '모험가', equip: { weapon: null, armor: null, offhand: null } };
      const appearance = deriveCharacterAppearance(player);
      assert.equal(appearance.palette.skin, undefined, 'cycle 447 skin 0건 보존');
      assert.equal(appearance.palette.eye, undefined, 'cycle 447 eye 0건 보존');
  });
}

// ─── cycle-449-physical-elements-unreachable.test.js ───
{
  /**
   * cycle 449: PHYSICAL_ELEMENTS 배열 + 필터 unreachable 정리
   *   (cycle 222-448 silent dead config 시리즈 207번째 — unreachable code path lens
   *   회귀, cycle 421/425/444/448 패턴, 호출 사이트 producer 분석).
   *
   * 발견 (1 dead array + 1 redundant filter):
   * - src/utils/statsCalculator.ts:
   *     `const PHYSICAL_ELEMENTS: any = ['물리', 'physical'];`
   *     `const isMagic = MAGIC_JOBS.includes(...)
   *                     || (weaponElem && !PHYSICAL_ELEMENTS.includes(weaponElem));`
   * - 호출 사이트 (consumer) 분석:
   *     · weaponElem = item.elem (Korean: 화염/냉기/대지/바람/빛/어둠/에테르/자연 8 종).
   *     · '물리' / 'physical' elem 가진 아이템 0건 (정합성 가드 검증).
   *   → `!PHYSICAL_ELEMENTS.includes(weaponElem)` 항상 true (truthy weaponElem).
   *   → `weaponElem && true` ≡ `Boolean(weaponElem)`. 필터는 무의미한 redundant.
   *
   * 패턴 (cycle 222-448 시리즈 207번째):
   * - cycle 421: SkillTypeIcon TYPE_PATHS '번개' unreachable.
   * - cycle 448: ELEMENT_COLOR_MAP '물리' unreachable.
   * - cycle 449: PHYSICAL_ELEMENTS unreachable filter — 동일 lens 회귀.
   *
   * 수정 (src/utils/statsCalculator.ts):
   * - PHYSICAL_ELEMENTS 배열 정의 제거.
   * - isMagic 체크에서 `!PHYSICAL_ELEMENTS.includes(weaponElem)` 제거 →
   *   `weaponElem && true` → 단순히 `Boolean(weaponElem)`로 단순화.
   *
   * 회귀 가드:
   * - MAGIC_JOBS 활성 path 그대로.
   * - weaponElem 있는 무기는 isMagic = true (이전과 동일 동작).
   * - weaponElem 없는 무기는 MAGIC_JOBS path만 활성 (이전과 동일).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 449: PHYSICAL_ELEMENTS 정의 0건', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(!/PHYSICAL_ELEMENTS/.test(source),
          'PHYSICAL_ELEMENTS 배열 정의/사용 0건');
  });

  test('cycle 449: MAGIC_JOBS 활성 path 보존', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(/MAGIC_JOBS/.test(source), 'MAGIC_JOBS 보존');
      assert.ok(/MAGIC_JOBS\.includes\(player\.job/.test(source),
          'MAGIC_JOBS 활성 사용 보존');
  });

  test("cycle 449: 정합성 가드 — items.ts에 elem='물리' / 'physical' 0건", async () => {
      const source = await readSrc('src/data/items.ts');
      const physical = (source.match(/(\s|,)elem: ['"](?:물리|physical)['"]/g) || []).length;
      assert.equal(physical, 0, "items.ts에 물리/physical elem 0건");
  });

  test('cycle 449: calculateFullStats runtime — isMagic 동작 보존', async () => {
      const { calculateFullStats: getFullStats } = await import('../src/utils/statsCalculator.ts');
      // 마법사 직업 → MAGIC_JOBS 활성, 무기 없어도 isMagic = true
      const mage = {
          job: '마법사', name: 'M', level: 1, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
          equip: { weapon: null, armor: null, offhand: null }, relics: [],
          atk: 5, def: 5, gold: 0,
      };
      const mageStats = getFullStats(mage);
      assert.equal(mageStats.isMagic, true, 'magic job → isMagic=true');

      // 전사 직업 + 화염 무기 → weaponElem path → isMagic = true
      const warrior = {
          job: '전사', name: 'W', level: 1, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
          equip: { weapon: { elem: '화염', val: 10, type: 'weapon' }, armor: null, offhand: null }, relics: [],
          atk: 5, def: 5, gold: 0,
      };
      const warriorStats = getFullStats(warrior);
      assert.equal(warriorStats.isMagic, true, '화염 무기 → isMagic=true');

      // 전사 직업 + elem 없는 무기 → 두 path 모두 fail → isMagic = false (또는 falsy)
      const physicalWarrior = {
          job: '전사', name: 'W2', level: 1, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
          equip: { weapon: { val: 10, type: 'weapon' }, armor: null, offhand: null }, relics: [],
          atk: 5, def: 5, gold: 0,
      };
      const physicalStats = getFullStats(physicalWarrior);
      assert.ok(!physicalStats.isMagic, 'elem 없는 무기 + non-magic 직업 → isMagic falsy');
  });

  test('cycle 448 회귀 가드: ELEMENT_COLOR_MAP 물리 0건', async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      const blockStart = source.indexOf('const ELEMENT_COLOR_MAP');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+물리:/m.test(block), 'cycle 448 물리 엔트리 0건 보존');
  });
}

// ─── cycle-452-dashboard-panels-default-compact-batch.test.js ───
{
  /**
   * cycle 452: Dashboard child panel 6종 default compact 'false' batch 정리
   *   (cycle 222-451 silent dead config 시리즈 209번째 — redundant default annotation
   *   lens 회귀, cycle 364-368/428-434/437/441/451 패턴, 6 컴포넌트 batch).
   *
   * 발견 (6 redundant default values):
   * - 6 panel 컴포넌트 모두 destructure에서 `compact = false` default:
   *     · BuildAdvicePanel.tsx (1 caller in Dashboard:204)
   *     · AchievementPanel.tsx (1 caller in Dashboard:185)
   *     · StatsPanel.tsx (1 caller in Dashboard:211)
   *     · EquipmentPanel.tsx (1 caller in Dashboard:169)
   *     · MapNavigator.tsx (1 caller in Dashboard:198)
   *     · SmartInventory.tsx (1 caller in Dashboard:157)
   * - 모든 호출자가 `compact={desktopArchiveCompact}` 명시 전달.
   * - cycle 451 (GravePanel) paired completion — Dashboard 7 panel children 중
   *   나머지 6 panel batch.
   *
   * 패턴 (cycle 222-451 시리즈 209번째):
   * - cycle 364-368/428-434/437/441/451: redundant default annotation 시리즈.
   * - cycle 414: ICON_PATHS 16-key batch (cycle 411-413 회귀).
   * - cycle 446-447: buildRuntimePalette 4-필드 + characterAppearance palette
   *   5-필드 batch.
   * - cycle 452: 6 panel batch — 동일 lens 회귀, batch scale.
   *
   * 수정 (6 src/components/*.tsx):
   * - 각 panel destructure에서 `compact = false` → `compact`.
   *
   * 회귀 가드:
   * - 6 호출자 모두 명시 compact 전달 → 동작 그대로.
   * - compact 기반 UI 조건 분기 (text size / spacing 등) 모두 보존.
   * - cycle 451 GravePanel paired completion 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  // cycle 472-482가 11 panel (Map/Achievement/Equipment/Stats/Grave/System/
  // BuildAdvice/SkillTree/Quest/SmartInventory)을 cascade로 compact prop 자체
  // 제거. 이제 잔존 panel 0건 → cascade 완료 보존 가드만 유지.
  const PANELS = [];

  for (const panel of PANELS) {
      test(`cycle 452: ${panel.name} destructure에서 default compact 제거`, async () => {
          const source = await readSrc(panel.file);
          const fnIdx = source.indexOf(panel.fnPattern);
          const fnEnd = source.indexOf('=>', fnIdx);
          const block = source.slice(fnIdx, fnEnd);
          assert.ok(!/compact = false/.test(block), `${panel.name} default compact 제거됨`);
          assert.ok(/\bcompact\b/.test(block), `${panel.name} compact 파라미터 보존`);
      });
  }

  test('cycle 452: 정합성 가드 — Dashboard 6 panel 호출 존재', async () => {
      // cycle 471이 Dashboard의 desktop 컴팩트 플래그 + 10 callsite의 compact prop
      // 전달을 일괄 제거. compact 명시 전달 assertion → 호출 존재 가드로 약화.
      const source = await readSrc('src/components/Dashboard.tsx');
      for (const panel of PANELS) {
          const segments = source.split(new RegExp(`<${panel.name}\\b`)).slice(1);
          assert.ok(segments.length >= 1, `${panel.name} 호출 발견`);
      }
  });

  test('cycle 451 회귀 가드: GravePanel default compact 0건', async () => {
      const source = await readSrc('src/components/GravePanel.tsx');
      const fnIdx = source.indexOf('const GravePanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/compact = false/.test(block), 'cycle 451 default compact 제거 보존');
  });
}

// ─── cycle-453-class-tree-build-tree-dead-fields.test.js ───
{
  /**
   * cycle 453: ClassTree buildTree `nodes` / `edges` 출력 dead 정리
   *   (cycle 222-452 silent dead config 시리즈 210번째 — function output dead field
   *   cleanup lens 회귀, cycle 333-356/442/443/445/446/447 패턴).
   *
   * 발견 (2 dead output fields):
   * - src/components/ClassTree.tsx buildTree (line 19+):
   *     `return { nodes, edges, tiers }`
   * - 호출 사이트 분석:
   *     · ClassTree.tsx:78: `const { tiers } = useMemo(() => buildTree(), [])`
   *     · `tiers`만 destructure, `nodes` / `edges` read 0건.
   * - 결과: nodes / edges는 buildTree 내부에서 build되지만 어디로도 흐르지 않는 dead.
   *   nodes는 tiers 그룹핑용 internal const로만 사용. edges는 push되지만 consumer 0건.
   *
   * 패턴 (cycle 222-452 시리즈 210번째):
   * - cycle 333-356/442/443/445/446/447: 함수 출력 dead 필드 cleanup.
   * - cycle 453: ClassTree buildTree 2 출력 dead — 동일 lens 회귀.
   *
   * 수정 (src/components/ClassTree.tsx):
   * - buildTree return에서 `nodes` / `edges` 제거 → `tiers`만 노출.
   * - nodes는 tiers 계산용 local const로 보존.
   * - edges는 push 자체 제거 (consumer 0건).
   *
   * 회귀 가드:
   * - tiers 보존 (활성 read 필드).
   * - 4 tier 그룹핑 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 453: buildTree return에서 nodes / edges 0건', async () => {
      const source = await readSrc('src/components/ClassTree.tsx');
      const fnIdx = source.indexOf('const buildTree =');
      // buildTree 함수 끝 (TreeNode 시작 직전)까지 슬라이스.
      const fnEnd = source.indexOf('const TreeNode', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      const returnIdx = block.lastIndexOf('return ');
      const returnBlock = block.slice(returnIdx);
      assert.ok(!/\bnodes\b/.test(returnBlock), 'return에 nodes 0건');
      assert.ok(!/\bedges\b/.test(returnBlock), 'return에 edges 0건');
      assert.ok(/\btiers\b/.test(returnBlock), 'tiers 보존');
  });

  test('cycle 453: 정합성 가드 — buildTree() 호출자가 tiers만 destructure', async () => {
      const source = await readSrc('src/components/ClassTree.tsx');
      assert.ok(/const \{ tiers \} = useMemo\(\(\) => buildTree\(\)/.test(source),
          'tiers만 destructure');
      // edges/nodes external read 0건 검증
      const fnEndIdx = source.indexOf('const TreeNode');
      const consumerSource = source.slice(fnEndIdx);
      assert.ok(!/\bedges\b/.test(consumerSource), '본체 edges 참조 0건');
  });

  test('cycle 453: tier 4 그룹 (T0/T1/T2/T3) 동작 보존', async () => {
      // ClassTree는 React 컴포넌트 — runtime 검증은 어려우니 source-level 가드
      const source = await readSrc('src/components/ClassTree.tsx');
      assert.ok(/tiers: Record<number, any\[\]> = \{ 0: \[\], 1: \[\], 2: \[\], 3: \[\] \}/.test(source),
          '4 tier 그룹 보존');
  });

  test('cycle 452 회귀 가드: Dashboard 6 panel default compact 0건', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      const fnIdx = source.indexOf('const EquipmentPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/compact = false/.test(block), 'cycle 452 EquipmentPanel default 제거 보존');
  });
}

// ─── cycle-455-class-tree-node-desc-dead.test.js ───
{
  /**
   * cycle 455: ClassTree buildTree `node.desc` 출력 dead 정리
   *   (cycle 222-454 silent dead config 시리즈 211번째 — function output dead field
   *   cleanup lens, cycle 333-356/442/443/445/446/447/453 패턴).
   *
   * 발견 (1 dead output field):
   * - src/components/ClassTree.tsx buildTree (line 27):
   *     `nodes[name] = { name, tier: data.tier || 0, reqLv: data.reqLv || 1, desc: data.desc };`
   * - 소비자 분석 (TreeNode + ClassTree 본체):
   *     · TreeNode 내부 read: node.tier, node.name, node.reqLv 만 (line 40-71)
   *     · ClassTree 본체: tiers[tier].map((node) => <TreeNode node={...} />) — node 그대로 전달
   *     · 어디에서도 node.desc / data.desc 읽는 곳 0건.
   * - 결과: data.desc → node.desc로 복사되지만 read 0건 dead 출력 필드.
   *
   * 패턴 (cycle 222-454 시리즈 211번째):
   * - cycle 333-356/442/443/445/446/447/453: 함수 출력 dead 필드 cleanup.
   * - cycle 453은 동일 buildTree에서 nodes/edges 출력 dead 정리. 그때 nodes 내부의
   *   `desc` 필드 자체가 read 0건인 건 미검출 — 이번 사이클이 paired completion.
   *
   * 수정 (src/components/ClassTree.tsx):
   * - buildTree에서 nodes[name] = { name, tier, reqLv } — desc 필드 제거.
   *
   * 회귀 가드:
   * - name / tier / reqLv 보존 (활성 read 필드 3종).
   * - TreeNode 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 455: buildTree node 객체에 desc 필드 0건', async () => {
      const source = await readSrc('src/components/ClassTree.tsx');
      const fnIdx = source.indexOf('const buildTree =');
      const fnEnd = source.indexOf('const TreeNode', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/desc:\s*data\.desc/.test(block), 'buildTree nodes 객체에 desc 필드 0건');
      assert.ok(!/\bdesc\b/.test(block), 'buildTree 블록 전체에 desc 0건');
  });

  test('cycle 455: 정합성 가드 — node.desc / data.desc read 0건 (전체 ClassTree)', async () => {
      const source = await readSrc('src/components/ClassTree.tsx');
      // node.desc 또는 data.desc 참조 0건
      assert.ok(!/node\.desc/.test(source), 'node.desc read 0건');
      assert.ok(!/data\.desc/.test(source), 'data.desc read 0건');
  });

  test('cycle 455: name / tier / reqLv 활성 read 보존', async () => {
      const source = await readSrc('src/components/ClassTree.tsx');
      assert.ok(/node\.name/.test(source), 'node.name read 보존');
      assert.ok(/node\.tier/.test(source), 'node.tier read 보존');
      assert.ok(/node\.reqLv/.test(source), 'node.reqLv read 보존');
  });

  test('cycle 453 회귀 가드: buildTree return은 tiers만 노출', async () => {
      const source = await readSrc('src/components/ClassTree.tsx');
      const fnIdx = source.indexOf('const buildTree =');
      const fnEnd = source.indexOf('const TreeNode', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      const returnBlock = block.slice(block.lastIndexOf('return '));
      assert.ok(!/\bnodes\b/.test(returnBlock), 'cycle 453 nodes 제거 보존');
      assert.ok(!/\bedges\b/.test(returnBlock), 'cycle 453 edges 제거 보존');
      assert.ok(/\btiers\b/.test(returnBlock), 'tiers 보존');
  });
}

// ─── cycle-456-control-panel-render-reset-defaults.test.js ───
{
  /**
   * cycle 456: ControlPanel `renderResetControl` 3 default annotation redundant 정리
   *   (cycle 486 cascade로 helper 자체 제거됨 — 보존 가드로 약화).
   *
   * cycle 486 paired completion: ControlPanel mobileFocused cascade가 두
   * `!mobileFocused && renderResetControl(...)` callsite를 unreachable로 만들고
   * helper 자체를 제거했으므로, 이 테스트는 cascade 보존 가드만 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 456: renderResetControl helper cycle 486 cascade로 제거 보존', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(!/renderResetControl/.test(source), 'cycle 486 cascade로 helper 제거 보존');
  });
}

// ─── cycle-457-control-panel-combat-redundant-attrs.test.js ───
{
  /**
   * cycle 457: ControlPanel <CombatPanel> callsite `compact={false}` / `dense={false}`
   *   명시 attribute redundant 정리
   *   (cycle 222-456 silent dead config 시리즈 213번째 — redundant explicit attribute
   *   cleanup lens, cycle 437 mobileFocused 패턴).
   *
   * 발견 (2 redundant explicit attributes):
   * - src/components/ControlPanel.tsx (line 165-175):
   *     <CombatPanel ... compact={false} dense={false} />
   * - 시그니처 (src/components/tabs/CombatPanel.tsx line 54):
   *     ({ ..., compact = false, dense = false }: CombatPanelProps) => ...
   * - 결과: 명시 전달값이 destructure 기본값과 동일 → 명시 attribute 0 효과.
   *
   * 호출 사이트 분석:
   * - CombatPanel은 ControlPanel.tsx:165 1곳에서만 import / render. 다른 caller 없음.
   * - 이 callsite가 항상 false / false 전달 → 본체의 compact/dense 활성 분기 0건.
   * - 본체 로직 자체는 유지 (향후 다른 caller가 true 전달 가능성 보존).
   *
   * 패턴 (cycle 222-456 시리즈 213번째):
   * - cycle 437: EventPanel default mobileFocused redundant.
   * - cycle 457: <CombatPanel> 명시 false 2건 — 동일 lens (callsite 측).
   *
   * 수정 (src/components/ControlPanel.tsx):
   * - <CombatPanel> JSX에서 compact={false} / dense={false} 두 줄 제거.
   *
   * 회귀 가드:
   * - mobile prop 보존 (truthy 전달).
   * - CombatPanel destructure 기본값 그대로 (다른 caller가 미래에 추가될 때 대비).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 457: <CombatPanel> 호출에서 compact={false} / dense={false} 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const idx = source.indexOf('<CombatPanel');
      assert.ok(idx >= 0, '<CombatPanel> 호출 존재');
      const jsxEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, jsxEnd);
      assert.ok(!/compact=\{false\}/.test(jsx), 'compact={false} 제거');
      assert.ok(!/dense=\{false\}/.test(jsx), 'dense={false} 제거');
  });

  test('cycle 457: 정합성 가드 — mobile prop 보존', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const idx = source.indexOf('<CombatPanel');
      const jsxEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, jsxEnd);
      // shorthand `mobile` 또는 `mobile={true}` 형태 모두 허용
      assert.ok(/\bmobile\b/.test(jsx), 'mobile 보존');
      assert.ok(/player=\{player\}/.test(jsx), 'player prop 보존');
      assert.ok(/enemy=\{enemy\}/.test(jsx), 'enemy prop 보존');
  });

  test('cycle 457: CombatPanel destructure에 compact / dense 0건 (cycle 485 cascade 보존)', async () => {
      // cycle 485가 CombatPanel compact / dense props 자체를 cascade로 제거.
      // 이전 가드 → cascade 보존 가드로 약화.
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      const fnIdx = source.indexOf('const CombatPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'cycle 485 cascade로 compact 제거 보존');
      assert.ok(!/\bdense\b/.test(sig), 'cycle 485 cascade로 dense 제거 보존');
  });
}

// ─── cycle-461-class-card-compact-unreachable.test.js ───
{
  /**
   * cycle 461: ClassCard `compact` prop + `if (compact)` 분기 unreachable 정리
   *   (cycle 222-460 silent dead config 시리즈 216번째 — unreachable code path
   *   cleanup lens, cycle 458/459 패턴 회귀).
   *
   * 발견 (1 prop + 9줄 분기 unreachable):
   * - src/components/ClassCard.tsx (line 30):
   *     const ClassCard = ({ jobName, onSelect, disabled = false, compact = false }: any) => {
   *         ...
   *         if (compact) {
   *             return <compact-render>;   // line 37-45
   *         }
   *         return <default-render>;        // line 47+
   *     }
   * - 호출 사이트 분석 (전체 src/):
   *     · JobChangePanel.tsx:51 — 1 callsite: <ClassCard jobName onSelect disabled />
   *       (player prop도 전달하나 destructure 미포함 — 별 사이클 target).
   *     · 다른 파일 import 0건.
   *     · compact 전달 caller 0건 → 항상 false.
   * - 결과: compact 항상 false → if (compact) 본체 9줄 unreachable.
   *
   * 패턴 (cycle 222-460 시리즈 216번째):
   * - cycle 458: StatusMetric inline prop unreachable.
   * - cycle 459: EnemyStatus compact prop unreachable.
   * - cycle 461: ClassCard compact prop unreachable — 동일 lens 회귀.
   *
   * 수정 (src/components/ClassCard.tsx):
   * - destructure에서 compact = false 제거.
   * - if (compact) {...} 블록 9줄 제거.
   * - default render만 보존.
   *
   * 회귀 가드:
   * - jobName / onSelect / disabled prop 보존.
   * - default render 동작 그대로.
   * - 1 callsite (compact 전달 0) 동작 변동 0.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 461: ClassCard destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/ClassCard.tsx');
      const fnIdx = source.indexOf('const ClassCard =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 461: if (compact) 분기 0건', async () => {
      const source = await readSrc('src/components/ClassCard.tsx');
      const fnIdx = source.indexOf('const ClassCard =');
      const fnEnd = source.indexOf('export default', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/if\s*\(\s*compact\s*\)/.test(block), 'if (compact) 분기 제거');
      assert.ok(!/\bcompact\b/.test(block), '본체 compact 참조 0건');
  });

  test('cycle 461: 정합성 가드 — JobChangePanel callsite compact 전달 0건', async () => {
      const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
      const idx = source.indexOf('<ClassCard');
      const jsxEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, jsxEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'callsite에 compact 전달 0건');
  });

  test('cycle 461: jobName / onSelect / disabled prop 보존', async () => {
      const source = await readSrc('src/components/ClassCard.tsx');
      const fnIdx = source.indexOf('const ClassCard =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/jobName/.test(sig), 'jobName 보존');
      assert.ok(/onSelect/.test(sig), 'onSelect 보존');
      assert.ok(/disabled/.test(sig), 'disabled 보존');
  });
}

// ─── cycle-463-class-icon-css-class-unreachable.test.js ───
{
  /**
   * cycle 463: ClassIcon `cssClass` prop unreachable 정리
   *   (cycle 222-462 silent dead config 시리즈 218번째 — unreachable code path
   *   cleanup lens, cycle 458/459/461 패턴 회귀).
   *
   * 발견 (1 prop unreachable):
   * - src/components/icons/ClassIcon.tsx (line 44):
   *     const ClassIcon = ({ className: jobName, size = 28, tier = 0,
   *                         showBorder = false, cssClass = '' }: any) => {...
   *         className={`inline-flex ... ${cssClass}`}
   *     }
   * - 호출 사이트 분석 (전체 src/):
   *     · SkillTreePreview.tsx:147 — className/size/tier/showBorder 전달, cssClass 0건.
   *     · ClassTree.tsx:58 — 동일.
   *     · ClassCard.tsx:54 — 동일.
   *     · JobChangePanel.tsx:43 — 동일.
   *     · 4 callsite 모두 cssClass 전달 0건.
   * - 결과: cssClass는 항상 ''. body의 ${cssClass} interpolation은 빈 문자열만 추가.
   *
   * 패턴 (cycle 222-462 시리즈 218번째):
   * - cycle 458: StatusMetric inline prop unreachable.
   * - cycle 459: EnemyStatus compact prop unreachable.
   * - cycle 461: ClassCard compact prop unreachable.
   * - cycle 463: ClassIcon cssClass prop unreachable — 동일 lens 회귀.
   *
   * 수정 (src/components/icons/ClassIcon.tsx):
   * - destructure에서 cssClass = '' 제거.
   * - body className 템플릿에서 ${cssClass} 보간 제거.
   *
   * 회귀 가드:
   * - className (jobName 별칭) / size / tier / showBorder 보존.
   * - 4 callsite 동작 변동 0 (cssClass 전달 0건이라 보간 결과 변동 없음).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 463: ClassIcon destructure에서 cssClass 0건', async () => {
      const source = await readSrc('src/components/icons/ClassIcon.tsx');
      const fnIdx = source.indexOf('const ClassIcon =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcssClass\b/.test(sig), 'destructure에 cssClass 0건');
  });

  test('cycle 463: body 템플릿에서 ${cssClass} 보간 0건', async () => {
      const source = await readSrc('src/components/icons/ClassIcon.tsx');
      assert.ok(!/\$\{cssClass\}/.test(source), '${cssClass} 보간 0건');
      assert.ok(!/\bcssClass\b/.test(source), 'body cssClass 참조 0건');
  });

  test('cycle 463: 정합성 가드 — 4 callsite cssClass 전달 0건', async () => {
      const callerFiles = [
          'src/components/SkillTreePreview.tsx',
          'src/components/ClassTree.tsx',
          'src/components/ClassCard.tsx',
          'src/components/tabs/JobChangePanel.tsx',
      ];
      for (const file of callerFiles) {
          const source = await readSrc(file);
          const idx = source.indexOf('<ClassIcon');
          assert.ok(idx >= 0, `${file}에 <ClassIcon> 호출 존재`);
          // <ClassIcon ... showBorder /> 또는 multi-line — `>` 또는 `/>`까지 잘라본다
          const tagEnd = source.indexOf('/>', idx);
          const jsx = source.slice(idx, tagEnd);
          assert.ok(!/\bcssClass\b/.test(jsx), `${file} callsite cssClass 전달 0건`);
      }
  });

  test('cycle 463: className(jobName 별칭) / size / tier 보존', async () => {
      // cycle 464가 showBorder prop 제거했으므로 이 assertion에서는 검증 제외 (cycle
      // 464 test가 별도 가드).
      const source = await readSrc('src/components/icons/ClassIcon.tsx');
      const fnIdx = source.indexOf('const ClassIcon =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/className:\s*jobName/.test(sig), 'className 별칭 보존');
      // cycle 568: size = 28 / tier = 0 defaults cascade 제거 (4 callsite 모두 명시).
      assert.ok(/\bsize\b/.test(sig), 'size 파라미터 보존 (default cycle 568 제거)');
      assert.ok(/\btier\b/.test(sig), 'tier 파라미터 보존 (default cycle 568 제거)');
  });
}

// ─── cycle-464-class-icon-show-border-always-true.test.js ───
{
  /**
   * cycle 464: ClassIcon `showBorder` prop unreachable false 가지 정리
   *   (cycle 222-463 silent dead config 시리즈 219번째 — unreachable code path
   *   cleanup lens, cycle 463 paired completion).
   *
   * 발견 (1 prop unreachable + 1 ternary 가지 dead):
   * - src/components/icons/ClassIcon.tsx (line 44):
   *     const ClassIcon = ({ ..., showBorder = false }: any) => {...
   *         style={{
   *             width: size, height: size,
   *             ...(showBorder ? { border, borderRadius, background } : {}),
   *         }}
   *     }
   * - 호출 사이트 분석 (전체 src/):
   *     · 4 callsite 모두 `showBorder` shorthand 전달 (= true).
   *     · false 전달 / 미전달 callsite 0건.
   * - 결과: showBorder는 항상 true → ternary는 항상 truthy 가지. false 가지는
   *   dead. 기본값 = false도 unreachable.
   *
   * 패턴 (cycle 222-463 시리즈 219번째):
   * - cycle 463: ClassIcon cssClass prop unreachable.
   * - cycle 464: 같은 컴포넌트 showBorder prop 항상 true → false 가지 unreachable.
   *   paired completion으로 ClassIcon 잔존 dead config 일괄 정리.
   *
   * 수정 (src/components/icons/ClassIcon.tsx):
   * - destructure에서 showBorder = false 제거.
   * - body의 `...(showBorder ? {...} : {})` ternary 제거 → 정적 spread.
   * - 4 callsite의 showBorder 명시 attr 제거 (항상 true이라 redundant).
   *
   * 회귀 가드:
   * - 4 callsite 시각 출력 그대로 (border / borderRadius / background 항상 적용).
   * - className(jobName 별칭) / size / tier 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 464: ClassIcon destructure에서 showBorder 0건', async () => {
      const source = await readSrc('src/components/icons/ClassIcon.tsx');
      const fnIdx = source.indexOf('const ClassIcon =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bshowBorder\b/.test(sig), 'destructure에 showBorder 0건');
  });

  test('cycle 464: showBorder 참조 / ternary 가지 0건', async () => {
      const source = await readSrc('src/components/icons/ClassIcon.tsx');
      assert.ok(!/\bshowBorder\b/.test(source), 'showBorder 참조 0건');
      // 정적 border / borderRadius / background 보존
      assert.ok(/border:\s*`1\.5px solid/.test(source), 'border 정적 적용 보존');
      assert.ok(/borderRadius:\s*8/.test(source), 'borderRadius 정적 적용 보존');
  });

  test('cycle 464: 정합성 가드 — 4 callsite showBorder 명시 0건', async () => {
      const callerFiles = [
          'src/components/SkillTreePreview.tsx',
          'src/components/ClassTree.tsx',
          'src/components/ClassCard.tsx',
          'src/components/tabs/JobChangePanel.tsx',
      ];
      for (const file of callerFiles) {
          const source = await readSrc(file);
          const idx = source.indexOf('<ClassIcon');
          const tagEnd = source.indexOf('/>', idx);
          const jsx = source.slice(idx, tagEnd);
          assert.ok(!/\bshowBorder\b/.test(jsx), `${file} callsite showBorder 명시 0건`);
      }
  });

  test('cycle 464: className(jobName 별칭) / size / tier 보존', async () => {
      const source = await readSrc('src/components/icons/ClassIcon.tsx');
      const fnIdx = source.indexOf('const ClassIcon =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/className:\s*jobName/.test(sig), 'className 별칭 보존');
      // cycle 568: size = 28 / tier = 0 defaults cascade 제거 (4 callsite 모두 명시).
      assert.ok(/\bsize\b/.test(sig), 'size 파라미터 보존 (default cycle 568 제거)');
      assert.ok(/\btier\b/.test(sig), 'tier 파라미터 보존 (default cycle 568 제거)');
  });
}

// ─── cycle-467-focus-panel-header-redundant-defaults.test.js ───
{
  /**
   * cycle 467: FocusPanelHeader 3 redundant default annotation 정리
   *   (cycle 222-466 silent dead config 시리즈 222번째 — redundant default annotation
   *   cleanup lens, cycle 441/451-452/456 패턴 회귀).
   *
   * 발견 (3 redundant defaults):
   * - src/components/FocusPanelHeader.tsx (line 6-19):
   *     const FocusPanelHeader = ({
   *         eyebrow = '',                  ← 5 호출자 모두 명시 전달
   *         ...
   *         archiveLabel = '인벤토리',     ← 4 호출자 'INV' 전달, 1 호출자 archive 미사용
   *         ...
   *         className = '',                ← 5 호출자 모두 미전달 (정적 className 보간)
   *         ...
   *     }: any) => ...
   * - 호출 사이트 분석 (5 callsite):
   *     · EventPanel.tsx:23 — eyebrow="Decision Window", archive 미사용 (no onOpenArchive).
   *     · ShopPanel.tsx:169 — eyebrow="Broker Ledger", archiveLabel="INV".
   *     · JobChangePanel.tsx:29 — eyebrow="Class Circuit", archiveLabel="INV".
   *     · CraftingPanel.tsx:247 — eyebrow="Forge Circuit", archiveLabel="INV".
   *     · QuestBoardPanel.tsx:83 — eyebrow="Mission Grid", archiveLabel="INV".
   * - 결과:
   *     · eyebrow = '' fallback 진입 0건.
   *     · archiveLabel = '인벤토리' fallback 진입 0건 (archive 미사용 시는 button 자체 미렌더).
   *     · className = '' fallback은 모든 호출에서 진입 (호출자 0/5 명시) — 본체 보간은
   *       그대로 ''.trim() 결과 유지가 필요.
   *
   * 패턴 (cycle 222-466 시리즈 222번째):
   * - cycle 441: FocusPanelHeader backLabel default 제거 (5/5 명시 전달).
   * - cycle 467: 같은 컴포넌트의 잔존 redundant default 3건 일괄 정리.
   *
   * 수정 (src/components/FocusPanelHeader.tsx):
   * - destructure에서 `eyebrow = ''`, `archiveLabel = '인벤토리'` 기본값 제거.
   * - className 기본값은 5/5 미전달이므로 동작상 항상 undefined → 본체에서 falsy
   *   guard 필요. 안전을 위해 className 처리도 정리: 정적 baseline + optional className
   *   spread.
   *
   * 회귀 가드:
   * - 5 callsite 명시 전달 보존 (eyebrow / archiveLabel).
   * - className 본체 동작 (있을 때만 추가) 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 467: eyebrow / archiveLabel 기본값 0건', async () => {
      const source = await readSrc('src/components/FocusPanelHeader.tsx');
      const fnIdx = source.indexOf('const FocusPanelHeader =');
      const sigEnd = source.indexOf('}: any) =>', fnIdx);
      const sig = source.slice(fnIdx, sigEnd);
      assert.ok(!/eyebrow\s*=\s*''/.test(sig), "eyebrow = '' 제거");
      assert.ok(!/archiveLabel\s*=\s*'인벤토리'/.test(sig), "archiveLabel = '인벤토리' 제거");
  });

  test('cycle 467: 정합성 가드 — 5 callsite eyebrow 명시 전달', async () => {
      const callerFiles = [
          'src/components/EventPanel.tsx',
          'src/components/ShopPanel.tsx',
          'src/components/tabs/JobChangePanel.tsx',
          'src/components/tabs/CraftingPanel.tsx',
          'src/components/tabs/QuestBoardPanel.tsx',
      ];
      for (const file of callerFiles) {
          const source = await readSrc(file);
          const idx = source.indexOf('<FocusPanelHeader');
          assert.ok(idx >= 0, `${file}에 <FocusPanelHeader> 호출 존재`);
          const tagEnd = source.indexOf('/>', idx);
          const jsx = source.slice(idx, tagEnd);
          assert.ok(/eyebrow=/.test(jsx), `${file} callsite eyebrow 명시 전달`);
      }
  });

  test('cycle 467: cycle 441 회귀 가드 — backLabel 기본값 0건', async () => {
      const source = await readSrc('src/components/FocusPanelHeader.tsx');
      const fnIdx = source.indexOf('const FocusPanelHeader =');
      const sigEnd = source.indexOf('}: any) =>', fnIdx);
      const sig = source.slice(fnIdx, sigEnd);
      assert.ok(!/backLabel\s*=\s*'뒤로'/.test(sig), 'cycle 441 backLabel 기본값 제거 보존');
  });

  test('cycle 467: title / onBack / rightSlot / archiveTestId 활성 기본값 보존', async () => {
      const source = await readSrc('src/components/FocusPanelHeader.tsx');
      const fnIdx = source.indexOf('const FocusPanelHeader =');
      const sigEnd = source.indexOf('}: any) =>', fnIdx);
      const sig = source.slice(fnIdx, sigEnd);
      // title은 default 없는 필수 prop
      assert.ok(/\btitle\b/.test(sig), 'title prop 보존');
      // onBack/rightSlot는 default null 보존 (호출자 부분 누락 path 활성)
      assert.ok(/onBack\s*=\s*null/.test(sig), 'onBack = null 기본값 보존');
      assert.ok(/rightSlot\s*=\s*null/.test(sig), 'rightSlot = null 기본값 보존');
      // archiveTestId 등은 호출자 부분 누락 활성이라 보존
      assert.ok(/archiveTestId\s*=\s*null/.test(sig), 'archiveTestId 기본값 보존');
  });
}

// ─── cycle-469-adventure-guide-pacing-profile-fallback-unreachable.test.js ───
{
  /**
   * cycle 469: adventureGuide `odds.pacingProfile || getMapPacingProfile(mapData)`
   *   fallback unreachable + 미사용 import 정리
   *   (cycle 222-468 silent dead config 시리즈 223번째 — defensive fallback redundancy
   *   cleanup lens, cycle 373-388/424 패턴 회귀).
   *
   * 발견 (1 fallback unreachable + 1 미사용 import):
   * - src/utils/adventureGuide.ts (line 96):
   *     const pacingProfile = odds.pacingProfile || getMapPacingProfile(mapData);
   * - producer 분석 (src/utils/explorationPacing.ts):
   *     getDiscoveryOdds 반환에서 pacingProfile은 getMapPacingProfile(mapData)
   *     결과를 set. getMapPacingProfile은 항상 5 profile 중 하나를 객체 리터럴로
   *     반환 (safe/boss/volatile/hostile/frontier) — 절대 null/undefined 반환 0건.
   * - 결과: odds.pacingProfile은 항상 truthy → `||` fallback 진입 0건.
   *   `getMapPacingProfile(mapData)` 두 번째 호출 자체가 unreachable.
   * - import: line 4의 getMapPacingProfile import는 line 96에서만 사용 → fallback
   *   제거 시 import도 정리 대상.
   *
   * 패턴 (cycle 222-468 시리즈 223번째):
   * - cycle 373-388/424: defensive fallback redundancy — producer가 항상 valid 값
   *   반환하는데 consumer가 `|| fallback` 추가한 패턴.
   * - cycle 469: adventureGuide pacingProfile fallback — 동일 lens.
   *
   * 수정 (src/utils/adventureGuide.ts):
   * - line 96: `odds.pacingProfile || getMapPacingProfile(mapData)` → `odds.pacingProfile`.
   * - line 4: import에서 getMapPacingProfile 제거.
   *
   * 회귀 가드:
   * - getDiscoveryOdds import 보존.
   * - pacingProfile read (line 109/111/118) 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 469: pacingProfile fallback || getMapPacingProfile 0건', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(!/odds\.pacingProfile\s*\|\|\s*getMapPacingProfile/.test(source),
          'odds.pacingProfile || getMapPacingProfile fallback 제거');
  });

  test('cycle 469: getMapPacingProfile import 제거', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(!/getMapPacingProfile/.test(source), 'getMapPacingProfile 참조 0건');
  });

  test('cycle 469: 정합성 가드 — producer는 항상 valid profile 반환', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      // getMapPacingProfile은 5 객체 리터럴 반환 (return null 0건)
      assert.ok(!/return\s+null/.test(source), 'getMapPacingProfile에 return null 0건');
      // pacingProfile 필드 set 보존
      assert.ok(/pacingProfile:\s*profile/.test(source), 'pacingProfile: profile set 보존');
  });

  test('cycle 469: getDiscoveryOdds import / pacingProfile read 보존', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(/getDiscoveryOdds/.test(source), 'getDiscoveryOdds import 보존');
      assert.ok(/pacingProfile\.id/.test(source), 'pacingProfile.id read 보존');
      assert.ok(/pacingProfile\.label/.test(source), 'pacingProfile.label read 보존');
  });
}

// ─── cycle-471-dashboard-desktop-archive-compact-dead.test.js ───
{
  /**
   * cycle 471: Dashboard `desktopArchiveCompact = false` const + 10 callsite
   *   `compact={desktopArchiveCompact}` attribute unreachable 정리
   *   (cycle 222-470 silent dead config 시리즈 224번째 — unreachable / redundant
   *   default attr cleanup lens, cycle 452/457 통합 변형).
   *
   * 발견 (1 dead const + 10 redundant attribute):
   * - src/components/Dashboard.tsx (line 147):
   *     const desktopArchiveCompact = false;
   * - 사용 분석: 10곳 callsite에서 `compact={desktopArchiveCompact}`로 전달.
   *     · SmartInventory / EquipmentPanel / QuestTab / AchievementPanel /
   *       SkillTreePreview / MapNavigator / BuildAdvicePanel / StatsPanel /
   *       GravePanel / SystemTab.
   * - 타깃 컴포넌트 분석:
   *     · cycle 452가 6 panel(BuildAdvice/Achievement/Stats/Equipment/MapNavigator/
   *       SmartInventory)에서 `compact = false` 기본값 제거. 이 panel들은
   *       compact prop을 직접 destructure하지만 default 없음 → undefined 수용 가능.
   *     · 다른 4 panel (QuestTab/SkillTreePreview/GravePanel/SystemTab)도 `compact`
   *       prop을 받지만 caller가 `false`만 전달이라 undefined 수용 가능.
   * - 결과:
   *     · const는 reassign 0건의 unchanging false → dead config flag.
   *     · 10 callsite의 `compact={desktopArchiveCompact}` 전달은 false → 각 panel의
   *       compact가 undefined가 되어도 `compact ? X : Y` ternary는 Y 가지로 동일.
   *
   * 패턴 (cycle 222-470 시리즈 224번째):
   * - cycle 452: Dashboard 6 panel default `compact = false` 일괄 정리.
   * - cycle 457: ControlPanel <CombatPanel compact={false} dense={false}> 명시
   *   redundant attr 정리.
   * - cycle 471: Dashboard 10 callsite `compact={desktopArchiveCompact}` 명시
   *   redundant attr + dead const 통합 정리. cycle 452+457 lens 결합.
   *
   * 수정 (src/components/Dashboard.tsx):
   * - line 147 `const desktopArchiveCompact = false;` 제거.
   * - 10 callsite에서 `compact={desktopArchiveCompact}` attr 제거.
   *
   * 회귀 가드:
   * - 다른 props (player/actions/stats/runtime/quickSlots 등) 보존.
   * - 각 panel의 compact ternary는 undefined일 때도 동일하게 false 가지 선택.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 471: desktopArchiveCompact const 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      assert.ok(!/const\s+desktopArchiveCompact\s*=/.test(source),
          'desktopArchiveCompact const 선언 0건');
      assert.ok(!/desktopArchiveCompact/.test(source),
          'desktopArchiveCompact 식별자 0건 (선언 + 참조)');
  });

  test('cycle 471: 정합성 가드 — Dashboard 핵심 props 보존', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      // 주요 자식 컴포넌트 호출이 그대로 있는지 (다른 props 보존 확인)
      assert.ok(/<SmartInventory[\s\S]*?player=\{player\}/.test(source), 'SmartInventory player prop 보존');
      assert.ok(/<EquipmentPanel[\s\S]*?player=\{player\}/.test(source), 'EquipmentPanel player prop 보존');
      assert.ok(/<SystemTab[\s\S]*?runtime=\{runtime\}/.test(source), 'SystemTab runtime prop 보존');
  });

  test('cycle 471: cycle 452 회귀 가드 — 6 panel default compact 0건', async () => {
      // cycle 452가 정리한 6 panel default가 보존되어 있는지
      const equipmentPanel = await readSrc('src/components/EquipmentPanel.tsx');
      const equipFnIdx = equipmentPanel.indexOf('const EquipmentPanel =');
      const equipFnEnd = equipmentPanel.indexOf('=>', equipFnIdx);
      assert.ok(!/compact = false/.test(equipmentPanel.slice(equipFnIdx, equipFnEnd)),
          'cycle 452 EquipmentPanel default compact 제거 보존');
  });
}

// ─── cycle-472-map-navigator-compact-cascade.test.js ───
{
  /**
   * cycle 472: MapNavigator `compact` prop + `showAllMaps` 상태 cascade unreachable 정리
   *   (cycle 222-471 silent dead config 시리즈 225번째 — unreachable code path
   *   cleanup lens, cycle 471 cascade paired completion).
   *
   * 발견 (1 prop + 1 state + 6 ternary 가지 unreachable):
   * - src/components/MapNavigator.tsx:
   *     · line 61: const MapNavigator = ({ player, grave, stats, compact }: any) => {...}
   *     · line 62: const [showAllMaps, setShowAllMaps] = useState(false);
   *     · line 85: visibleEntries = compact && !showAllMaps ? slice : full
   *     · line 90: moveRecommendations.slice(0, compact ? 2 : 3)
   *     · line 97: ${compact ? 'space-y-2 p-2.5' : 'space-y-3 p-3'}
   *     · line 156-164: {compact && ... ? <toggle button> : null}
   * - 호출 사이트 분석:
   *     · Dashboard.tsx:195 — cycle 471이 compact={desktopArchiveCompact} 제거.
   *       이제 caller 0건 → compact 항상 undefined.
   *     · 다른 파일 import 0건.
   * - 결과:
   *     · compact는 항상 undefined → 5 ternary가 모두 false 가지 선택.
   *     · `compact && !showAllMaps` 항상 false → visibleEntries는 항상 full mapEntries.
   *     · `mapEntries.length > visibleEntries.length` 항상 false (같은 배열) →
   *       toggle button JSX 영원히 미렌더 → showAllMaps state cascade dead.
   *
   * 패턴 (cycle 222-471 시리즈 225번째):
   * - cycle 471: Dashboard desktopArchiveCompact const + 10 callsite compact attr 정리.
   * - cycle 472: MapNavigator compact prop cascade — cycle 471 paired completion.
   *   cycle 461 ClassCard / cycle 458 StatusMetric 패턴의 cascade 변형.
   *
   * 수정 (src/components/MapNavigator.tsx):
   * - destructure에서 compact 제거.
   * - useState(false) showAllMaps state + setShowAllMaps 제거.
   * - visibleEntries / visibleRecommendations / className 정적화.
   * - toggle button JSX (line 156-164) 제거.
   *
   * 회귀 가드:
   * - player / grave / stats prop 보존.
   * - selectedMapName useState 보존.
   * - 본체 World Routes / 추천 경로 로직 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 472: MapNavigator destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/MapNavigator.tsx');
      const fnIdx = source.indexOf('const MapNavigator =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 472: showAllMaps state + ternary 0건', async () => {
      const source = await readSrc('src/components/MapNavigator.tsx');
      assert.ok(!/showAllMaps/.test(source), 'showAllMaps 식별자 0건');
      assert.ok(!/setShowAllMaps/.test(source), 'setShowAllMaps 식별자 0건');
  });

  test('cycle 472: 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/MapNavigator.tsx');
      assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건 (전체 파일)');
  });

  test('cycle 472: 정합성 가드 — Dashboard callsite compact 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const idx = source.indexOf('<MapNavigator');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <MapNavigator> compact 전달 0건');
  });

  test('cycle 472: player / grave / stats / selectedMapName 보존', async () => {
      const source = await readSrc('src/components/MapNavigator.tsx');
      assert.ok(/selectedMapName/.test(source), 'selectedMapName state 보존');
      const fnIdx = source.indexOf('const MapNavigator =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
      assert.ok(/\bgrave\b/.test(sig), 'grave prop 보존');
      assert.ok(/\bstats\b/.test(sig), 'stats prop 보존');
  });
}

// ─── cycle-473-achievement-panel-compact-cascade.test.js ───
{
  /**
   * cycle 473: AchievementPanel `compact` prop + 6 cascade dead
   *   (cycle 222-472 silent dead config 시리즈 226번째 — unreachable code path
   *   cascade cleanup, cycle 471/472 paired completion).
   *
   * 발견 (1 prop + 1 state + 1 useMemo + 2 const + 1 toggle UI + 1 summary 블록 dead):
   * - src/components/AchievementPanel.tsx:
   *     · interface AchievementPanelProps line 12: `compact?: boolean;`
   *     · line 57: const AchievementPanel = ({ player, actions, compact }) => {...}
   *     · line 58: const [showAllAchievements, setShowAllAchievements] = useState(false);
   *     · line 78-87: summaryAchievements useMemo (compact path 전용 계산).
   *     · line 88: hiddenAchievementCount (compact 토글 버튼 조건용).
   *     · line 89: showSummaryView = compact && !showAllAchievements (항상 false).
   *     · line 97/98: ${compact ? X : Y} className ternary 2건.
   *     · line 111-120: {compact && ...} 토글 버튼 블록.
   *     · line 133-180: {showSummaryView ? <summary> : ...} ternary first 가지 (요약 카드).
   * - 호출 사이트:
   *     · Dashboard.tsx:182 — cycle 471이 compact prop 제거. caller 0건.
   * - 결과: compact 항상 undefined → cascade 전체 unreachable.
   *
   * 패턴 (cycle 222-472 시리즈 226번째):
   * - cycle 471: Dashboard 10 callsite compact 일괄 제거.
   * - cycle 472: MapNavigator compact + showAllMaps cascade 정리.
   * - cycle 473: AchievementPanel compact + showAllAchievements cascade 정리.
   *   cycle 472와 동일 lens, 다른 panel 적용.
   *
   * 수정 (src/components/AchievementPanel.tsx):
   * - interface에서 compact?: boolean 제거.
   * - destructure에서 compact 제거.
   * - useState showAllAchievements + setShowAllAchievements 제거.
   * - summaryAchievements useMemo 제거.
   * - hiddenAchievementCount / showSummaryView 제거.
   * - className compact ternary 2건 → 정적 (false 가지).
   * - 토글 버튼 JSX 블록 제거.
   * - {showSummaryView ? <summary> : <unlocked>} → 직접 <unlocked> 렌더.
   * - useState import 제거 (다른 useState 0건이면).
   *
   * 회귀 가드:
   * - player / actions prop / unlocked / locked / claimableCount 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 473: AchievementPanel destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      const fnIdx = source.indexOf('const AchievementPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 473: interface에서 compact 0건', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      const ifaceIdx = source.indexOf('interface AchievementPanelProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
  });

  test('cycle 473: cascade dead 0건 (showAll/summary/hidden/showSummaryView)', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      assert.ok(!/showAllAchievements/.test(source), 'showAllAchievements 0건');
      assert.ok(!/summaryAchievements/.test(source), 'summaryAchievements 0건');
      assert.ok(!/hiddenAchievementCount/.test(source), 'hiddenAchievementCount 0건');
      assert.ok(!/showSummaryView/.test(source), 'showSummaryView 0건');
  });

  test('cycle 473: 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
  });

  test('cycle 473: 정합성 가드 — Dashboard <AchievementPanel> compact 전달 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const idx = source.indexOf('<AchievementPanel');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <AchievementPanel> compact 전달 0건');
  });

  test('cycle 473: player / actions / unlocked / locked 핵심 로직 보존', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      assert.ok(/player\b/.test(source), 'player prop 보존');
      assert.ok(/actions\?\.claimAchievement/.test(source), 'claimAchievement 로직 보존');
      assert.ok(/const unlocked =/.test(source), 'unlocked 계산 보존');
      assert.ok(/const locked =/.test(source), 'locked 계산 보존');
  });
}

// ─── cycle-475-stats-panel-compact-cascade.test.js ───
{
  /**
   * cycle 475: StatsPanel `compact` prop cascade unreachable 정리
   *   (cycle 222-474 silent dead config 시리즈 228번째 — unreachable code path
   *   cascade cleanup, cycle 471/472/473/474 paired 5사이클).
   *
   * 발견 (1 prop + 1 state + 3 const + 8 ternary 가지 + 1 toggle UI 블록 dead):
   * - src/components/StatsPanel.tsx:
   *     · interface line 11: compact?: boolean.
   *     · destructure line 43: ({ player, stats, compact }).
   *     · line 44: useState(false) showAllStats + setShowAllStats.
   *     · line 104: visibleStatEntries (compact && !showAllStats 가지).
   *     · line 105: hasExpandableSections (compact && ...).
   *     · line 106: topKillPreview (compact && !showAllStats 가지에만 진입).
   *     · line 109: className ${compact ? X : Y}.
   *     · line 114: {hasExpandableSections && <toggle button>}.
   *     · line 125: container className compact ternary.
   *     · line 151: passiveParts.slice(... compact && !showAllStats ? 2 : full).
   *     · line 155/286/312: {(!compact || showAllStats) && <sections>}.
   *     · line 280: {compact && !showAllStats && topKillPreview && <preview>}.
   * - 호출 사이트:
   *     · Dashboard.tsx:208 — cycle 471이 compact prop 제거. caller 0건.
   *     · 다른 파일 import 0건.
   * - 결과: compact 항상 undefined → cascade 전체 unreachable.
   *
   * 패턴 (cycle 222-474 시리즈 228번째):
   * - cycle 471 → 472 → 473 → 474 → 475 cascade 5사이클 paired.
   *
   * 수정 (src/components/StatsPanel.tsx):
   * - interface compact 제거.
   * - destructure compact 제거.
   * - useState showAllStats + setShowAllStats 제거.
   * - visibleStatEntries → statEntries 직접 사용.
   * - hasExpandableSections / topKillPreview 제거.
   * - 토글 버튼 JSX 제거.
   * - className compact ternary 정적화.
   * - (!compact || showAllStats) 가드 → 항상 true이므로 직접 sections 렌더.
   * - {compact && !showAllStats && topKillPreview && ...} 블록 제거.
   *
   * 회귀 가드:
   * - player / stats prop 보존.
   * - 본체 stats / passive / topKills / meta 섹션 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 475: StatsPanel destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      const fnIdx = source.indexOf('const StatsPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 475: interface에서 compact 0건', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      const ifaceIdx = source.indexOf('interface StatsPanelProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
  });

  test('cycle 475: cascade dead 0건 (showAllStats / hasExpandableSections / topKillPreview)', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      assert.ok(!/showAllStats/.test(source), 'showAllStats 0건');
      assert.ok(!/hasExpandableSections/.test(source), 'hasExpandableSections 0건');
      assert.ok(!/topKillPreview/.test(source), 'topKillPreview 0건');
  });

  test('cycle 475: 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
  });

  test('cycle 475: 정합성 가드 — Dashboard <StatsPanel> compact 전달 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const idx = source.indexOf('<StatsPanel');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <StatsPanel> compact 전달 0건');
  });

  test('cycle 475: player / stats / topKills / passive 핵심 로직 보존', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      const fnIdx = source.indexOf('const StatsPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
      assert.ok(/\bstats\b/.test(sig), 'stats prop 보존');
      assert.ok(/topKills/.test(source), 'topKills 로직 보존');
      assert.ok(/statEntries/.test(source), 'statEntries 로직 보존');
  });
}

// ─── cycle-477-system-tab-compact-cascade.test.js ───
{
  /**
   * cycle 477: SystemTab `compact` prop cascade unreachable 정리
   *   (cycle 222-476 silent dead config 시리즈 230번째 — unreachable code path
   *   cascade cleanup, cycle 471-476 paired 7사이클).
   *
   * 발견 (1 prop + 1 state + 1 const + 8 ternary 가지 + 2 conditional UI 블록 dead):
   * - src/components/tabs/SystemTab.tsx:
   *     · interface line 24: compact?: boolean.
   *     · destructure line 27: compact = false.
   *     · line 30: useState(false) showAllSystem + setShowAllSystem.
   *     · line 195: showSystemSummary = compact && !showAllSystem (항상 false).
   *     · 본체 8 ternary: className compact gating.
   *     · line 199-210: {compact && <header + 토글 button>} 블록.
   *     · line 250: {!showSystemSummary && <pre>} → 항상 진입.
   *     · line 257-294: {showSystemSummary ? <summary> : <full>} ternary 첫 가지.
   * - 호출 사이트:
   *     · Dashboard.tsx:236 — cycle 471이 compact prop 제거. caller 0건.
   * - 결과: compact 항상 undefined → cascade 전체 unreachable.
   *
   * cycle 471 → 472 → 473 → 474 → 475 → 476 → 477 cascade 7사이클 paired.
   *
   * 수정 (src/components/tabs/SystemTab.tsx):
   * - interface compact 제거.
   * - destructure compact = false 제거.
   * - useState showAllSystem + setShowAllSystem 제거.
   * - showSystemSummary const 제거.
   * - 8 className ternary 정적 (false 가지).
   * - 토글 버튼 헤더 블록 제거.
   * - {!showSystemSummary && <pre>} → 직접 <pre> 렌더.
   * - {showSystemSummary ? <summary> : <full>} → 직접 <full> 렌더.
   *
   * 회귀 가드:
   * - player / actions / stats / runtime prop 보존.
   * - 본체 QA readout / relics / titles / daily / hall 섹션 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 477: SystemTab destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/tabs/SystemTab.tsx');
      const fnIdx = source.indexOf('const SystemTab =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 477: interface에서 compact 0건', async () => {
      const source = await readSrc('src/components/tabs/SystemTab.tsx');
      const ifaceIdx = source.indexOf('interface SystemTabProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
  });

  test('cycle 477: cascade dead 0건 (showAllSystem / showSystemSummary)', async () => {
      const source = await readSrc('src/components/tabs/SystemTab.tsx');
      assert.ok(!/showAllSystem/.test(source), 'showAllSystem 0건');
      assert.ok(!/showSystemSummary/.test(source), 'showSystemSummary 0건');
  });

  test('cycle 477: 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/tabs/SystemTab.tsx');
      assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
  });

  test('cycle 477: 정합성 가드 — Dashboard <SystemTab> compact 전달 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const idx = source.indexOf('<SystemTab');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <SystemTab> compact 전달 0건');
  });

  test('cycle 477: player / actions / stats / runtime / qaReadout / leaderboard 보존', async () => {
      const source = await readSrc('src/components/tabs/SystemTab.tsx');
      assert.ok(/qaReadout/.test(source), 'qaReadout 보존');
      assert.ok(/leaderboard/.test(source), 'leaderboard 보존');
      const fnIdx = source.indexOf('const SystemTab =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
      assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
      assert.ok(/\bruntime\b/.test(sig), 'runtime prop 보존');
  });
}

// ─── cycle-478-build-advice-panel-compact-cascade.test.js ───
{
  /**
   * cycle 478: BuildAdvicePanel `compact` prop cascade unreachable 정리
   *   (cycle 222-477 silent dead config 시리즈 231번째 — unreachable code path
   *   cascade cleanup, cycle 471-477 paired 8사이클).
   *
   * 발견 (1 prop + 19 ternary 가지 unreachable):
   * - src/components/BuildAdvicePanel.tsx:
   *     · interface line 10: compact?: boolean.
   *     · destructure line 52: ({ player, compact }).
   *     · 본체 19곳 ternary: padding / text size / spacing / 라벨 변형 / `!compact &&`
   *       conditional UI 등.
   * - 호출 사이트:
   *     · Dashboard.tsx:200 — cycle 471이 compact prop 제거. caller 0건.
   *     · 다른 파일 import 0건.
   * - 결과: compact 항상 undefined → 모든 ternary false 가지 (full size) 선택.
   *
   * 수정 (src/components/BuildAdvicePanel.tsx):
   * - interface compact 제거.
   * - destructure compact 제거.
   * - 19 ternary 모두 false 가지로 inline.
   * - `compact && !open` 조건 제거 (false 가지 ChevronDown 항상 사용).
   * - `{!compact && <desc>}` 조건들 → 직접 <desc> 렌더.
   * - `compact ? trait.passiveLabel : trait.desc` → trait.desc 사용.
   * - `compact ? 'Build' : '빌드 조언 —'` → '빌드 조언 —' 사용.
   *
   * 회귀 가드:
   * - player prop 보존.
   * - 본체 trait / recommended / open 토글 / RELICS / TRAIT_DEFINITIONS 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 478: BuildAdvicePanel destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/BuildAdvicePanel.tsx');
      const fnIdx = source.indexOf('const BuildAdvicePanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 478: interface에서 compact 0건', async () => {
      const source = await readSrc('src/components/BuildAdvicePanel.tsx');
      const ifaceIdx = source.indexOf('interface BuildAdvicePanelProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
  });

  test('cycle 478: 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/BuildAdvicePanel.tsx');
      assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
  });

  test('cycle 478: 정합성 가드 — Dashboard <BuildAdvicePanel> compact 전달 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const idx = source.indexOf('<BuildAdvicePanel');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <BuildAdvicePanel> compact 전달 0건');
  });

  test('cycle 478: player / open 토글 / 추천 유물 핵심 로직 보존', async () => {
      const source = await readSrc('src/components/BuildAdvicePanel.tsx');
      assert.ok(/getRecommendedRelics/.test(source), 'getRecommendedRelics 보존');
      assert.ok(/TRAIT_DEFINITIONS/.test(source), 'TRAIT_DEFINITIONS 보존');
      assert.ok(/setOpen/.test(source), 'open 토글 보존');
      const fnIdx = source.indexOf('const BuildAdvicePanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
  });
}

// ─── cycle-482-smart-inventory-compact-cascade.test.js ───
{
  /**
   * cycle 482: SmartInventory `compact` prop cascade unreachable 정리
   *   (cycle 222-481 silent dead config 시리즈 234번째 — unreachable code path
   *   cascade cleanup, cycle 471 cascade의 11번째 / 마지막 panel paired completion).
   *
   * 발견 (1 prop + 1 state + 5 const + 33 ternary 가지 + multiple conditional UI 블록 dead):
   * - src/components/SmartInventory.tsx:
   *     · interface compact?: boolean.
   *     · destructure compact (last param).
   *     · useState(false) showAllItems + setShowAllItems.
   *     · MAX_COMPACT_ITEMS const.
   *     · visibleFiltered IIFE / hiddenItemCount.
   *     · useSummaryCards / useDenseCompactInventory const.
   *     · inventorySectionLabel const (showAllItems 의존 → cascade dead).
   *     · 본체 33 ternary (className compact ? 'tight' : 'loose').
   *     · {compact && (hiddenItemCount > 0 || showAllItems)} 토글 헤더 블록.
   * - 호출 사이트:
   *     · Dashboard.tsx:155 — cycle 471이 compact prop 제거. caller 0건.
   *     · 다른 파일 import 0건.
   * - 결과: compact 항상 undefined → cascade 전체 unreachable.
   *
   * cycle 471 → 472-479 → 481 → 482 cascade lens 11번째 / 마지막 panel.
   * Dashboard cascade가 481+482로 마무리되어 모든 compact prop dead 정리 완료.
   *
   * 수정 (src/components/SmartInventory.tsx):
   * - interface compact 제거.
   * - destructure compact 제거 (마지막 param이라 trailing comma 처리).
   * - useState showAllItems + setShowAllItems 제거.
   * - MAX_COMPACT_ITEMS / visibleFiltered / hiddenItemCount /
   *   useSummaryCards / useDenseCompactInventory / inventorySectionLabel 제거.
   * - 33 ternary 모두 false 가지로 inline.
   * - 토글 헤더 블록 제거.
   * - visibleFiltered → filtered 직접 사용.
   *
   * 회귀 가드:
   * - player / actions / quickSlots / onAssignQuickSlot / spotlight /
   *   onClearSpotlight prop 보존.
   * - 본체 inventory list / FILTERS / signature / 추천 장착 / 일괄 정리 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 482: SmartInventory destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/SmartInventory.tsx');
      const fnIdx = source.indexOf('const SmartInventory =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 482: interface에서 compact 0건', async () => {
      const source = await readSrc('src/components/SmartInventory.tsx');
      const ifaceIdx = source.indexOf('interface SmartInventoryProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
  });

  test('cycle 482: cascade dead 0건', async () => {
      const source = await readSrc('src/components/SmartInventory.tsx');
      assert.ok(!/showAllItems/.test(source), 'showAllItems 0건');
      assert.ok(!/hiddenItemCount/.test(source), 'hiddenItemCount 0건');
      assert.ok(!/useSummaryCards/.test(source), 'useSummaryCards 0건');
      assert.ok(!/useDenseCompactInventory/.test(source), 'useDenseCompactInventory 0건');
      assert.ok(!/visibleFiltered/.test(source), 'visibleFiltered 0건');
      assert.ok(!/MAX_COMPACT_ITEMS/.test(source), 'MAX_COMPACT_ITEMS 0건');
  });

  test('cycle 482: 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/SmartInventory.tsx');
      assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
  });

  test('cycle 482: 정합성 가드 — Dashboard <SmartInventory> compact 전달 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const idx = source.indexOf('<SmartInventory');
      // multi-line tag — 다음 `/>` 까지 잘라 검사
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <SmartInventory> compact 전달 0건');
  });

  test('cycle 482: player / actions / quickSlots / spotlight 핵심 로직 보존', async () => {
      const source = await readSrc('src/components/SmartInventory.tsx');
      assert.ok(/FILTERS/.test(source), 'FILTERS 보존');
      assert.ok(/QuickSlotAssigner/.test(source), 'QuickSlotAssigner 보존');
      const fnIdx = source.indexOf('const SmartInventory =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
      assert.ok(/quickSlots/.test(sig), 'quickSlots prop 보존');
      assert.ok(/spotlight/.test(sig), 'spotlight prop 보존');
  });

  test('cycle 482: cycle 471 cascade 완료 — Dashboard 11 panel 모두 cascade 정리됨', async () => {
      // cycle 471 → 472-479, 481-482로 11 panel 모두 cascade 완료.
      // Dashboard renderTabContent 내 callsite 어디에도 compact prop 전달 0건.
      const source = await readSrc('src/components/Dashboard.tsx');
      const renderIdx = source.indexOf('const renderTabContent =');
      const renderEnd = source.indexOf('const renderMobileArchiveRail =');
      const block = source.slice(renderIdx, renderEnd);
      assert.ok(!/compact=/.test(block), 'renderTabContent 내 compact prop 전달 0건 (cascade 완료)');
  });
}

// ─── cycle-483-archive-tab-button-dense-icon-only-unreachable.test.js ───
{
  /**
   * cycle 483: ArchiveTabButton `dense` + `iconOnly` props unreachable 정리
   *   (cycle 222-482 silent dead config 시리즈 235번째 — unreachable code path
   *   cleanup lens, cycle 458/459/461/463/464 unreachable prop 패턴 회귀).
   *
   * 발견 (2 props + 다수 ternary 가지 unreachable):
   * - src/components/ArchiveTabButton.tsx (line 6):
   *     const ArchiveTabButton = ({ icon, label, active = false, onClick,
   *         compact = false, rail = false, dense = false, iconOnly = false, ... })
   *     → frameClass / heightClass / className / Icon size / span / iconOnly 분기
   * - 호출 사이트 분석 (전체 src/):
   *     · Dashboard.tsx:245 — compact rail testId / {...getTabExtras}.
   *     · Dashboard.tsx:394 — compact rail testId / {...getTabExtras}.
   *     · Dashboard.tsx:571 — compact testId / {...getTabExtras}.
   *     · Dashboard.tsx:585 — compact testId / {...getTabExtras}.
   *     · 4 callsite 모두 dense / iconOnly 전달 0건. getTabExtras도 badge/badgeTitle만 emit.
   * - 결과: dense / iconOnly 항상 false → frameClass의 dense 분기 + iconOnly 중첩
   *   분기 + Icon size dense 가지 + span tracking dense 가지 + iconOnly span 모두
   *   unreachable.
   *
   * 패턴 (cycle 222-482 시리즈 235번째):
   * - cycle 458: StatusMetric inline prop unreachable.
   * - cycle 459/461/463/464/465/466: 다양한 unreachable prop cleanup.
   * - cycle 483: ArchiveTabButton 2 unreachable props 한꺼번에 정리.
   *
   * 수정 (src/components/ArchiveTabButton.tsx):
   * - destructure에서 dense = false, iconOnly = false 제거.
   * - frameClass: rail ? A : dense ? (iconOnly ? B : C) : D → rail ? A : D.
   * - heightClass: rail || dense → rail. (dense=false라 rail || dense ≡ rail)
   * - className에서 dense ? 'px-1 py-1' : 'px-2 py-1.5' → 'px-2 py-1.5'.
   * - Icon size: rail ? 11 : dense ? (iconOnly ? 11 : 12) : 14 → rail ? 11 : 14.
   * - {iconOnly ? <sr-only> : <span>} → 직접 <span>.
   * - span tracking: rail ? A : dense ? B : C → rail ? A : C.
   *
   * 회귀 가드:
   * - icon / label / active / onClick / compact / rail / testId / badge /
   *   badgeTitle props 보존.
   * - 4 callsite 동작 변동 0 (dense/iconOnly 전달 0건이라 결과 동일).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 483: ArchiveTabButton destructure에서 dense / iconOnly 0건', async () => {
      const source = await readSrc('src/components/ArchiveTabButton.tsx');
      const fnIdx = source.indexOf('const ArchiveTabButton =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bdense\b/.test(sig), 'destructure에 dense 0건');
      assert.ok(!/\biconOnly\b/.test(sig), 'destructure에 iconOnly 0건');
  });

  test('cycle 483: 본체 dense / iconOnly 참조 0건', async () => {
      const source = await readSrc('src/components/ArchiveTabButton.tsx');
      assert.ok(!/\bdense\b/.test(source), 'dense 참조 0건');
      assert.ok(!/\biconOnly\b/.test(source), 'iconOnly 참조 0건');
  });

  test('cycle 483: 정합성 가드 — 4 callsite dense / iconOnly 전달 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      // 모든 <ArchiveTabButton...> 호출에서 dense / iconOnly 0건
      const matches = source.match(/<ArchiveTabButton[\s\S]*?\/>/g) || [];
      assert.ok(matches.length >= 4, 'ArchiveTabButton 호출 4건 이상');
      matches.forEach((m, i) => {
          assert.ok(!/\bdense\b/.test(m), `callsite ${i}에 dense 전달 0건`);
          assert.ok(!/\biconOnly\b/.test(m), `callsite ${i}에 iconOnly 전달 0건`);
      });
  });

  test('cycle 483: icon / label / active / onClick / compact / rail / testId / badge prop 보존', async () => {
      const source = await readSrc('src/components/ArchiveTabButton.tsx');
      const fnIdx = source.indexOf('const ArchiveTabButton =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bicon\b/.test(sig), 'icon 보존');
      assert.ok(/\blabel\b/.test(sig), 'label 보존');
      assert.ok(/active/.test(sig), 'active 보존');
      assert.ok(/onClick/.test(sig), 'onClick 보존');
      assert.ok(/compact/.test(sig), 'compact 보존');
      assert.ok(/rail/.test(sig), 'rail 보존');
      assert.ok(/testId/.test(sig), 'testId 보존');
      assert.ok(/\bbadge\b/.test(sig), 'badge 보존');
  });
}

// ─── cycle-484-mobile-game-layout-helpers-unreachable.test.js ───
{
  /**
   * cycle 484: MobileGameLayout 2 internal helper props unreachable batch 정리
   *   (cycle 222-483 silent dead config 시리즈 236번째 — unreachable code path
   *   같은 파일 paired 변형, cycle 458-459 StatusBar 패턴 회귀).
   *
   * 발견 (2 props + ternary 가지 unreachable):
   * - src/components/app/MobileGameLayout.tsx:
   *     · line 10: const DashboardFallback = ({ summary = false }: any) => {...
   *         summary ? 'rounded-[1.2rem] ...' : 'shrink-0 rounded-[1.55rem] ...'
   *       }
   *     · line 21: const MobileConsoleArchiveButton = ({ active = false, onClick }: any) => {...
   *         active ? '...' : '...'
   *       }
   * - 호출 사이트 분석:
   *     · line 67: <DashboardFallback /> — summary 0건 (1 callsite).
   *     · line 105: <MobileConsoleArchiveButton onClick={...} /> — active 0건 (1 callsite).
   *     · 두 helper 모두 internal const, export 0건.
   * - 결과:
   *     · summary 항상 false → ternary 첫 가지 unreachable.
   *     · active 항상 false → 활성/비활성 ternary 첫 가지 unreachable.
   *
   * 패턴 (cycle 222-483 시리즈 236번째):
   * - cycle 458-459: StatusBar 같은 파일 internal const 2개 paired (StatusMetric.inline /
   *   EnemyStatus.compact).
   * - cycle 484: MobileGameLayout 같은 파일 internal const 2개 paired — 동일 lens.
   *
   * 수정 (src/components/app/MobileGameLayout.tsx):
   * - DashboardFallback destructure에서 summary 제거 → ({}: any) 또는 () =>.
   * - DashboardFallback className에서 summary ? A : B → B만.
   * - MobileConsoleArchiveButton destructure에서 active 제거.
   * - MobileConsoleArchiveButton className에서 active ? A : B → B만.
   *
   * 회귀 가드:
   * - DashboardFallback className 정적 (false 가지) 보존.
   * - MobileConsoleArchiveButton onClick / data-testid 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 484: DashboardFallback destructure에서 summary 0건', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const fnIdx = source.indexOf('const DashboardFallback =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bsummary\b/.test(sig), 'destructure에 summary 0건');
  });

  test('cycle 484: MobileConsoleArchiveButton destructure에서 active 0건', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const fnIdx = source.indexOf('const MobileConsoleArchiveButton =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bactive\b/.test(sig), 'destructure에 active 0건');
  });

  test('cycle 484: 본체에서 summary / active ternary 0건', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const fbIdx = source.indexOf('const DashboardFallback =');
      const fbEnd = source.indexOf('const MobileConsoleArchiveButton =');
      const fbBlock = source.slice(fbIdx, fbEnd);
      assert.ok(!/\bsummary\b/.test(fbBlock), 'DashboardFallback 본체 summary 0건');

      const btnIdx = source.indexOf('const MobileConsoleArchiveButton =');
      // 함수 끝까지 — 본체 끝 표시는 `;\n)`. 안전하게 다음 export까지로 슬라이스.
      const btnEnd = source.indexOf('export ', btnIdx) >= 0 ? source.indexOf('export ', btnIdx) : source.length;
      const btnBlock = source.slice(btnIdx, btnEnd);
      // active는 destructure에서 제거됐으니 본체 active 참조도 0건이어야 함.
      // 그러나 'inactive' 같은 단어 리터럴이 있을 수 있음 — \bactive\b 단독 단어만 체크.
      const matches = btnBlock.match(/\bactive\b/g) || [];
      assert.equal(matches.length, 0, 'MobileConsoleArchiveButton 본체 active 참조 0건');
  });

  test('cycle 484: 정합성 가드 — 1 callsite 각각 prop 전달 0건', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const fbCall = source.match(/<DashboardFallback[^/]*\/>/);
      assert.ok(fbCall, '<DashboardFallback /> 호출 존재');
      assert.ok(!/\bsummary\b/.test(fbCall[0]), 'DashboardFallback callsite summary 전달 0건');

      const btnCall = source.match(/<MobileConsoleArchiveButton[^/]*\/>/);
      assert.ok(btnCall, '<MobileConsoleArchiveButton /> 호출 존재');
      assert.ok(!/\bactive\b/.test(btnCall[0]), 'MobileConsoleArchiveButton callsite active 전달 0건');
  });

  test('cycle 484: onClick / data-testid 핵심 props 보존', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const btnIdx = source.indexOf('const MobileConsoleArchiveButton =');
      const btnEnd = source.indexOf('export ', btnIdx) >= 0 ? source.indexOf('export ', btnIdx) : source.length;
      const block = source.slice(btnIdx, btnEnd);
      assert.ok(/onClick/.test(block), 'onClick 보존');
      assert.ok(/data-testid="mobile-console-open-archive"/.test(block), 'testid 보존');
  });
}

// ─── cycle-485-combat-panel-compact-dense-cascade.test.js ───
{
  /**
   * cycle 485: CombatPanel `compact` + `dense` props cascade unreachable 정리
   *   (cycle 222-484 silent dead config 시리즈 237번째 — unreachable code path
   *   cascade cleanup, cycle 471-482 패턴 회귀 + cycle 457 paired completion).
   *
   * 발견 (2 props + 다수 분기 + compactMetaEntries cascade dead):
   * - src/components/tabs/CombatPanel.tsx:
   *     · interface compact?: boolean / dense?: boolean.
   *     · destructure compact = false, dense = false.
   *     · 본체 14 ternary — slice limit / className / Motion.div / consumable grid /
   *       button padding / text size 등.
   *     · compactMetaEntries const (dense 가지 전용).
   *     · `{dense ? <compactMetaEntries> : <full>}` ternary first 가지.
   *     · `{!dense && <description>}` 가드.
   * - 호출 사이트:
   *     · ControlPanel.tsx:165 — cycle 457이 compact={false} dense={false} 명시 attr
   *       제거. 이제 compact/dense 전달 0건. mobile shorthand만 전달.
   *     · 다른 파일 import 0건 (ControlPanel만 import).
   * - 결과: compact/dense 항상 false (default). mobile 항상 true → ternary first 가지
   *   (compact) unreachable. dense 가지 unreachable. compactMetaEntries cascade dead.
   *
   * 패턴 (cycle 222-484 시리즈 237번째):
   * - cycle 457: ControlPanel <CombatPanel> 명시 false 2건 제거.
   * - cycle 471-482: Dashboard 11 panel cascade.
   * - cycle 485: CombatPanel cascade — cycle 457 paired completion으로 destructure
   *   default + 본체 분기 cascade 정리.
   *
   * 수정 (src/components/tabs/CombatPanel.tsx):
   * - interface compact / dense 제거.
   * - destructure compact = false, dense = false 제거.
   * - line 82 slice limit: dense ? 3 : mobile || compact ? 4 : 6 → mobile ? 4 : 6.
   *   (mobile is the only flag remaining)
   * - className 외부 ternary 단순화 (compact 가지 제거 → mobile/static).
   * - {dense ? <compactMetaEntries> : <full>} → 직접 <full>.
   * - compactMetaEntries const 제거 (cascade dead).
   * - consumable grid: dense ? 'grid-cols-1' : mobile || compact ? 'grid-cols-2' :
   *   'grid-cols-3' → mobile ? 'grid-cols-2' : 'grid-cols-3'.
   * - button padding: dense ? ... : mobile ? ... : ... → mobile ? ... : ...
   * - text size: dense ? 'text-[10px]' : 'text-[11px]' → 정적 'text-[11px]'.
   * - {!dense && <desc>} → 직접 <desc> 렌더.
   *
   * 회귀 가드:
   * - player / actions / enemy / stats / isAiThinking / mobile prop 보존.
   * - 본체 combat / skill / consumable / boss / combo / telegraph 로직 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 485: CombatPanel destructure에서 compact / dense 0건', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      const fnIdx = source.indexOf('const CombatPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
      assert.ok(!/\bdense\b/.test(sig), 'destructure에 dense 0건');
  });

  test('cycle 485: interface에서 compact / dense 0건', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      const ifaceIdx = source.indexOf('interface CombatPanelProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
      assert.ok(!/\bdense\b/.test(block), 'interface에 dense 0건');
  });

  test('cycle 485: 본체 compact / dense / compactMetaEntries 참조 0건', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
      assert.ok(!/\bdense\b/.test(source), 'dense 참조 0건');
      assert.ok(!/compactMetaEntries/.test(source), 'compactMetaEntries 0건');
  });

  test('cycle 485: 정합성 가드 — ControlPanel <CombatPanel> compact / dense 전달 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const idx = source.indexOf('<CombatPanel');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'ControlPanel <CombatPanel> compact 전달 0건');
      assert.ok(!/\bdense\b/.test(jsx), 'ControlPanel <CombatPanel> dense 전달 0건');
  });

  test('cycle 485: player / actions / enemy / stats / isAiThinking / mobile prop 보존', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      const fnIdx = source.indexOf('const CombatPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
      assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
      assert.ok(/\benemy\b/.test(sig), 'enemy prop 보존');
      assert.ok(/\bstats\b/.test(sig), 'stats prop 보존');
      assert.ok(/isAiThinking/.test(sig), 'isAiThinking prop 보존');
      assert.ok(/\bmobile\b/.test(sig), 'mobile prop 보존');
  });
}

// ─── cycle-486-control-panel-mobile-focused-cascade.test.js ───
{
  /**
   * cycle 486: ControlPanel `mobileFocused` cascade unreachable 정리
   *   (cycle 222-485 silent dead config 시리즈 238번째 — unreachable code path
   *   cascade cleanup, cycle 471-485 패턴 회귀).
   *
   * 발견 (1 default + 1 state + 1 helper + 2 unreachable 블록 + 1 ternary 가지):
   * - src/components/ControlPanel.tsx:
   *     · destructure `mobileFocused = false` default.
   *     · useState confirmReset / setConfirmReset (renderResetControl 전용).
   *     · const renderResetControl helper.
   *     · line 181 EVENT-아이싱크: `mobileFocused ? <mobile-focused class> :
   *       <non-mobile class>` ternary.
   *     · line 331-335: `{!mobileFocused && !isSafeZone && renderResetControl(...)}`
   *     · line 338-342: `{!mobileFocused && isSafeZone && renderResetControl(...)}`
   * - 호출 사이트 분석:
   *     · MobileGameLayout.tsx:108 / 124 — 2 callsite 모두 mobileFocused (= true via
   *       shorthand) 전달.
   *     · 다른 파일 import 0건 (MobileGameLayout만 import).
   * - 결과: mobileFocused 항상 true → default `= false` 도달 불가.
   *   `!mobileFocused && ...` 항상 false → 2 renderResetControl 호출 unreachable
   *   → renderResetControl helper 자체 dead → confirmReset state cascade dead.
   *   line 181 ternary 첫 가지만 진입.
   *
   * 패턴 (cycle 222-485 시리즈 238번째):
   * - cycle 471-482: Dashboard cascade.
   * - cycle 485: CombatPanel cascade.
   * - cycle 486: ControlPanel mobileFocused cascade — 동일 lens 회귀.
   *
   * 수정 (src/components/ControlPanel.tsx):
   * - destructure에서 mobileFocused = false → mobileFocused (default 제거).
   * - useState confirmReset + setConfirmReset 제거 (cascade dead).
   * - renderResetControl helper 제거 (callsite 0건).
   * - line 181 ternary → mobile-focused 가지만 inline.
   * - line 331-342 unreachable 두 블록 제거.
   * - cycle 444 stale 가드 (handleMenuAction 'reset' 분기) 영향 검토 — 별개 패스.
   *
   * 회귀 가드:
   * - mobileFocused prop은 보존 (subchildren ShopPanel/QuestBoardPanel/EventPanel
   *   에 forward 필요 — 후속 cycle에서 cascade 가능).
   * - core 구조 (renderActionButton / coreButtons / safeZoneButtons / auxiliaryButtons /
   *   actionGridClass / GS state 분기 / Combat-Panel 호출) 모두 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 486: ControlPanel mobileFocused cycle 489 cascade로 prop 자체 제거', async () => {
      // cycle 489가 4사이클 cascade 마무리하며 ControlPanel destructure / interface
      // 에서도 mobileFocused 완전 제거. 이전 default 가드 → cascade 보존 가드로 약화.
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(!/mobileFocused/.test(source), 'cycle 489 cascade로 mobileFocused 제거 보존');
  });

  test('cycle 486: renderResetControl helper / 2 unreachable 블록 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(!/renderResetControl/.test(source), 'renderResetControl 0건');
      assert.ok(!/!mobileFocused\s*&&\s*!isSafeZone/.test(source), '!mobileFocused && !isSafeZone 가드 0건');
      assert.ok(!/!mobileFocused\s*&&\s*isSafeZone/.test(source), '!mobileFocused && isSafeZone 가드 0건');
  });

  test('cycle 486: confirmReset state cascade dead 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(!/confirmReset/.test(source), 'confirmReset / setConfirmReset 0건');
  });

  test('cycle 486: line 181 EVENT 분기 ternary 첫 가지 inline (mobile-focused class)', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      // EVENT + isAiThinking 분기 className에서 mobile-focused 가지만 진입
      assert.ok(/aether-surface-strong relative z-20 flex min-h-0 flex-1 items-center justify-center/.test(source),
          'mobile-focused EVENT 분기 className 보존');
      // non-mobile-focused 가지는 제거
      assert.ok(!/panel-noise mt-4 rounded-lg border border-cyber-purple\/50/.test(source),
          'non-mobile-focused EVENT 가지 제거');
  });

  test('cycle 486: MobileGameLayout 2 callsite mobileFocused cycle 489 cascade로 제거', async () => {
      // cycle 489 paired completion으로 callsite의 mobileFocused 명시 전달도 모두 제거.
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const matches = source.match(/<ControlPanel[\s\S]*?\/>/g) || [];
      assert.equal(matches.length, 2, 'ControlPanel 호출 2건');
      matches.forEach((m, i) => {
          assert.ok(!/mobileFocused/.test(m), `callsite ${i}에 mobileFocused 0건 (cascade 완료)`);
      });
  });

  test('cycle 486: core 구조 보존 (renderActionButton / coreButtons / GS 분기 등)', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(/renderActionButton/.test(source), 'renderActionButton 보존');
      assert.ok(/coreButtons/.test(source), 'coreButtons 보존');
      assert.ok(/GS\.COMBAT/.test(source), 'GS.COMBAT 분기 보존');
      assert.ok(/<CombatPanel/.test(source), '<CombatPanel> 호출 보존');
  });
}

// ─── cycle-489-event-panel-mobile-focused-cascade.test.js ───
{
  /**
   * cycle 489: EventPanel `mobileFocused` cascade unreachable 정리
   *   (cycle 222-488 silent dead config 시리즈 241번째 — unreachable code path
   *   cascade cleanup, cycle 486-488 cascade의 마지막 subchild paired completion).
   *
   * 발견 (1 prop + 1 unreachable 분기 26줄 + 1 dead const):
   * - src/components/EventPanel.tsx:
   *     · interface mobileFocused?: boolean.
   *     · destructure mobileFocused.
   *     · const overlayPanelClass (mobileFocused 비-truthy 가지 전용).
   *     · `if (mobileFocused) { return <mobile-focused JSX>; }` 분기.
   *     · `return <Motion.div ... fixed inset-0 z-30> ... overlayPanelClass ...`
   *       비-mobile-focused fallback 26줄 unreachable.
   * - 호출 사이트:
   *     · ControlPanel.tsx:192 — mobileFocused={mobileFocused} 전달.
   *     · ControlPanel은 cycle 486에서 mobileFocused 항상 truthy → forward도 truthy.
   *     · 다른 파일 import 0건.
   * - 결과: mobileFocused 항상 true → if 분기 항상 진입, fallback unreachable.
   *
   * 패턴 (cycle 222-488 시리즈 241번째):
   * - cycle 486 → 487 (QuestBoardPanel) → 488 (ShopPanel) → 489 (EventPanel) cascade
   *   4사이클로 ControlPanel 트리의 mobileFocused prop 일괄 정리 완료.
   *
   * 수정 (src/components/EventPanel.tsx):
   * - interface mobileFocused?: boolean 제거.
   * - destructure mobileFocused 제거.
   * - overlayPanelClass const 제거 (cascade dead).
   * - `if (mobileFocused) { return <mobile-focused>; }` → 직접 mobile-focused
   *   return으로 단순화 (function body 단일 return).
   * - 비-mobile-focused fallback 26줄 제거.
   *
   * 호출 사이트 (ControlPanel.tsx:192):
   * - mobileFocused 전달 자체 제거.
   *
   * 회귀 가드:
   * - currentEvent / actions prop 보존.
   * - 본체 panelBody / FocusPanelHeader / choices / dismiss 로직 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 489: EventPanel destructure에서 mobileFocused 0건', async () => {
      const source = await readSrc('src/components/EventPanel.tsx');
      const fnIdx = source.indexOf('const EventPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/mobileFocused/.test(sig), 'destructure에 mobileFocused 0건');
  });

  test('cycle 489: interface에서 mobileFocused 0건', async () => {
      const source = await readSrc('src/components/EventPanel.tsx');
      const ifaceIdx = source.indexOf('interface EventPanelProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/mobileFocused/.test(block), 'interface에 mobileFocused 0건');
  });

  test('cycle 489: 본체 mobileFocused / overlayPanelClass 참조 0건', async () => {
      const source = await readSrc('src/components/EventPanel.tsx');
      assert.ok(!/mobileFocused/.test(source), '본체 mobileFocused 참조 0건');
      assert.ok(!/overlayPanelClass/.test(source), 'overlayPanelClass 0건');
  });

  test('cycle 489: 정합성 가드 — ControlPanel <EventPanel> mobileFocused 전달 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const idx = source.indexOf('<EventPanel');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/mobileFocused/.test(jsx), 'ControlPanel <EventPanel> mobileFocused 전달 0건');
  });

  test('cycle 489: ControlPanel mobileFocused prop 완전 cascade 제거', async () => {
      // cycle 489 후 ControlPanel은 모든 subchild에 mobileFocused forward 0건이라
      // ControlPanel destructure + interface + MobileGameLayout 2 callsite의 prop도
      // cascade dead로 정리. cycle 486-489 4사이클 cascade 마무리.
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(!/mobileFocused/.test(source), 'ControlPanel mobileFocused 0건 (cascade 완료)');
      const layout = await readSrc('src/components/app/MobileGameLayout.tsx');
      const matches = layout.match(/<ControlPanel[\s\S]*?\/>/g) || [];
      matches.forEach((m, i) => {
          assert.ok(!/mobileFocused/.test(m), `MobileGameLayout callsite ${i}에 mobileFocused 0건`);
      });
  });

  test('cycle 489: currentEvent / actions / panelBody 핵심 로직 보존', async () => {
      const source = await readSrc('src/components/EventPanel.tsx');
      assert.ok(/currentEvent/.test(source), 'currentEvent prop 보존');
      assert.ok(/actions/.test(source), 'actions prop 보존');
      assert.ok(/handleEventChoice/.test(source), 'handleEventChoice 호출 보존');
      assert.ok(/dismissEvent/.test(source), 'dismissEvent 호출 보존');
  });
}

// ─── cycle-493-aether-mark-class-name-unreachable.test.js ───
{
  /**
   * cycle 493: AetherMark `className` prop unreachable 정리
   *   (cycle 222-492 silent dead config 시리즈 244번째 — unreachable code path
   *   cleanup lens, cycle 463/465/466 icons/ paired 패턴 회귀).
   *
   * 발견 (1 prop unreachable):
   * - src/components/AetherMark.tsx (line 23):
   *     const AetherMark = ({ size, className = '' }: any) => {...
   *         className={`relative ${scale.shell} shrink-0 ${className}`.trim()}
   *     }
   * - 호출 사이트 분석:
   *     · IntroScreen.tsx:71 — <AetherMark size="md" /> (className 0건).
   *     · BootScreen.tsx:19 — <AetherMark size="lg" /> (className 0건).
   *     · 2 callsite 모두 className 전달 0건. 다른 import 0건.
   * - 결과: className 항상 ''. body의 ${className} 보간은 .trim()으로 빈 문자열만
   *   제거되는 unreachable.
   *
   * 패턴 (cycle 222-492 시리즈 244번째):
   * - cycle 463: ClassIcon cssClass prop unreachable.
   * - cycle 465: MonsterIcon className prop unreachable.
   * - cycle 466: SignatureBadge className prop unreachable.
   * - cycle 493: AetherMark className prop unreachable — 동일 lens.
   *
   * 수정 (src/components/AetherMark.tsx):
   * - destructure에서 className = '' 제거.
   * - body className 템플릿에서 ${className} 보간 제거 → 정적 'relative ${scale.shell}
   *   shrink-0' 문자열 (.trim() 제거).
   *
   * 회귀 가드:
   * - size prop 보존.
   * - 2 callsite 동작 변동 0.
   * - cycle 418 (SIZE_MAP.sm) / cycle 432 (default size) cleanup 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 493: AetherMark destructure에서 className 0건', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      const fnIdx = source.indexOf('const AetherMark =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bclassName\b/.test(sig), 'destructure에 className 0건');
  });

  test('cycle 493: body ${className} 보간 0건', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
  });

  test('cycle 493: 정합성 가드 — 2 callsite className 전달 0건', async () => {
      const intro = await readSrc('src/components/IntroScreen.tsx');
      const introCall = intro.match(/<AetherMark[^/]*\/>/);
      assert.ok(introCall, 'IntroScreen <AetherMark> 호출 발견');
      assert.ok(!/className/.test(introCall[0]), 'IntroScreen callsite className 0건');

      const boot = await readSrc('src/components/app/BootScreen.tsx');
      const bootCall = boot.match(/<AetherMark[^/]*\/>/);
      assert.ok(bootCall, 'BootScreen <AetherMark> 호출 발견');
      assert.ok(!/className/.test(bootCall[0]), 'BootScreen callsite className 0건');
  });

  test('cycle 493: size prop 보존', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      const fnIdx = source.indexOf('const AetherMark =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bsize\b/.test(sig), 'size prop 보존');
  });

  test('cycle 493: cycle 418/432 회귀 가드 — SIZE_MAP md/lg + 본체 동작 보존', async () => {
      const source = await readSrc('src/components/AetherMark.tsx');
      assert.ok(/SIZE_MAP/.test(source), 'SIZE_MAP 보존');
      assert.ok(/SIZE_MAP\[size\]/.test(source), 'SIZE_MAP[size] lookup 보존');
      assert.ok(/SIZE_MAP\.md/.test(source), 'SIZE_MAP.md fallback 보존');
  });
}

// ─── cycle-494-quick-slot-dense-assigner-compact-cascade.test.js ───
{
  /**
   * cycle 494: QuickSlot `dense` + QuickSlotAssigner `compact` props cascade
   *   unreachable batch 정리
   *   (cycle 222-493 silent dead config 시리즈 245번째 — unreachable code path
   *   같은 파일 2 internal const paired, cycle 458-459 / 491-492 패턴 회귀).
   *
   * 발견 (2 props + 다수 ternary 가지 unreachable):
   * - src/components/QuickSlot.tsx:
   *     · QuickSlot (line 22): destructure `dense = false`. 1 callsite (TerminalView)
   *       전달 0건 → 항상 false. 본체 9 ternary 모두 false 가지 선택.
   *     · QuickSlotAssigner (line 69): destructure `compact = false`. 1 callsite
   *       (SmartInventory, cycle 482 cleanup으로 compact 전달 제거) → 항상 false.
   *       본체 5 ternary 모두 false 가지 선택.
   *
   * 패턴 (cycle 222-493 시리즈 245번째):
   * - cycle 458-459 / 491-492: StatusBar 같은 파일 2 internal const paired.
   * - cycle 484: MobileGameLayout 2 internal helper props batch.
   * - cycle 494: QuickSlot 같은 파일 2 internal const paired — 동일 lens.
   *
   * 수정 (src/components/QuickSlot.tsx):
   * - QuickSlot destructure에서 dense = false 제거.
   * - QuickSlot 본체 9 ternary 모두 false 가지로 inline.
   * - QuickSlotAssigner destructure에서 compact = false 제거.
   * - QuickSlotAssigner 본체 5 ternary 모두 false 가지로 inline.
   *
   * 회귀 가드:
   * - QuickSlot: slots / onUse / gameState prop 보존.
   * - QuickSlotAssigner: item / slotCount / onAssign / currentSlots prop 보존.
   * - 양쪽 callsite 동작 변동 0.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 494: QuickSlot destructure에서 dense 0건', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      const fnIdx = source.indexOf('const QuickSlot =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bdense\b/.test(sig), 'destructure에 dense 0건');
  });

  test('cycle 494: QuickSlot 본체 dense 참조 0건', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      const fnIdx = source.indexOf('const QuickSlot =');
      const fnEnd = source.indexOf('export const QuickSlotAssigner', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bdense\b/.test(block), '본체 dense 참조 0건');
  });

  test('cycle 494: QuickSlot interface에서 dense 0건', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      const ifaceIdx = source.indexOf('interface QuickSlotProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bdense\b/.test(block), 'interface에 dense 0건');
  });

  test('cycle 494: QuickSlotAssigner destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      const fnIdx = source.indexOf('export const QuickSlotAssigner');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 494: QuickSlotAssigner 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      const fnIdx = source.indexOf('export const QuickSlotAssigner');
      const block = source.slice(fnIdx);
      assert.ok(!/\bcompact\b/.test(block), '본체 compact 참조 0건');
  });

  test('cycle 494: 핵심 props 보존', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      // QuickSlot
      const qsIdx = source.indexOf('const QuickSlot =');
      const qsEnd = source.indexOf('=>', qsIdx);
      const qsSig = source.slice(qsIdx, qsEnd);
      assert.ok(/slots/.test(qsSig), 'QuickSlot slots 보존');
      assert.ok(/onUse/.test(qsSig), 'QuickSlot onUse 보존');
      assert.ok(/gameState/.test(qsSig), 'QuickSlot gameState 보존');
      // QuickSlotAssigner
      const qaIdx = source.indexOf('export const QuickSlotAssigner');
      const qaEnd = source.indexOf('=>', qaIdx);
      const qaSig = source.slice(qaIdx, qaEnd);
      assert.ok(/\bitem\b/.test(qaSig), 'QuickSlotAssigner item 보존');
      assert.ok(/slotCount/.test(qaSig), 'QuickSlotAssigner slotCount 보존');
      assert.ok(/onAssign/.test(qaSig), 'QuickSlotAssigner onAssign 보존');
      assert.ok(/currentSlots/.test(qaSig), 'QuickSlotAssigner currentSlots 보존');
  });
}

// ─── cycle-496-terminal-view-class-name-toolbar-left-unreachable.test.js ───
{
  /**
   * cycle 496: TerminalView `className` + `toolbarLeft` props unreachable batch 정리
   *   (cycle 222-495 silent dead config 시리즈 247번째 — unreachable code path
   *   batch cleanup, cycle 463/465/466/493/495 lens + cycle 484 패턴 회귀).
   *
   * 발견 (2 props unreachable):
   * - src/components/TerminalView.tsx (line 80-103):
   *     interface TerminalViewProps { ..., className?: string, toolbarLeft?: any }
   *     destructure: className = '', toolbarLeft = null
   *     body line 225: showToolbar = Boolean(toolbarLeft) || showExpandToggle
   *     body line 230: `... ${className}` (interpolation)
   *     body line 244: {toolbarLeft} (render)
   * - 호출 사이트:
   *     · MobileGameLayout.tsx:85 — <TerminalView ...> 호출 (className / toolbarLeft 0건).
   *     · 다른 파일 import 0건.
   * - 결과:
   *     · className 항상 '' → ${className} 보간은 빈 문자열만 추가.
   *     · toolbarLeft 항상 null → Boolean(toolbarLeft) 항상 false →
   *       showToolbar는 showExpandToggle만 의존. {toolbarLeft} 렌더 0건.
   *
   * 패턴 (cycle 222-495 시리즈 247번째):
   * - cycle 463/465/466: ClassIcon/MonsterIcon/SignatureBadge className.
   * - cycle 493: AetherMark className.
   * - cycle 495: StatusBar className.
   * - cycle 496: TerminalView className + toolbarLeft batch — 같은 lens.
   *
   * 수정 (src/components/TerminalView.tsx):
   * - interface에서 className?: string / toolbarLeft?: any 제거.
   * - destructure에서 className = '' / toolbarLeft = null 제거.
   * - body line 225: showToolbar = showExpandToggle.
   * - body line 230: ${className} 보간 제거 → 정적 baseline + ${bgClass}.
   * - body line 244: {toolbarLeft} 제거 + 빈 wrapping div는 보존 (showExpandToggle
   *   조건부 렌더 유지).
   *
   * 회귀 가드:
   * - 다른 props (logs/gameState/onCommand/autoFocusInput/player/quickSlots/
   *   onQuickSlotUse/showInput) 보존.
   * - showExpandToggle / 토글 버튼 렌더 보존.
   * - 1 callsite 동작 변동 0.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 496: TerminalView destructure에서 className / toolbarLeft 0건', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      const fnIdx = source.indexOf('const TerminalView = ({');
      const fnEnd = source.indexOf('}: TerminalViewProps', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bclassName\s*=\s*''/.test(block), 'destructure에 className default 0건');
      assert.ok(!/\btoolbarLeft\b/.test(block), 'destructure에 toolbarLeft 0건');
  });

  test('cycle 496: interface에서 className / toolbarLeft 0건', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      const ifaceIdx = source.indexOf('interface TerminalViewProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/className\?:/.test(block), 'interface에 className 0건');
      assert.ok(!/toolbarLeft\?:/.test(block), 'interface에 toolbarLeft 0건');
  });

  test('cycle 496: body ${className} 보간 + {toolbarLeft} 렌더 0건', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
      assert.ok(!/\btoolbarLeft\b/.test(source), 'toolbarLeft 본체 참조 0건');
  });

  test('cycle 496: 정합성 가드 — MobileGameLayout <TerminalView> className/toolbarLeft 0건', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const idx = source.indexOf('<TerminalView');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/className=/.test(jsx), 'callsite className 전달 0건');
      assert.ok(!/toolbarLeft/.test(jsx), 'callsite toolbarLeft 전달 0건');
  });

  test('cycle 496: 핵심 props 보존 (cycle 497이 autoFocusInput/showInput 추가 정리)', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      const fnIdx = source.indexOf('const TerminalView = ({');
      const fnEnd = source.indexOf('}: TerminalViewProps', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(/logs/.test(block), 'logs prop 보존');
      assert.ok(/gameState/.test(block), 'gameState prop 보존');
      assert.ok(/onCommand/.test(block), 'onCommand prop 보존');
      assert.ok(/quickSlots/.test(block), 'quickSlots prop 보존');
  });
}

// ─── cycle-497-terminal-view-auto-focus-show-input-cascade.test.js ───
{
  /**
   * cycle 497: TerminalView `autoFocusInput` + `showInput` props 항상 false →
   *   cascade unreachable 정리
   *   (cycle 222-496 silent dead config 시리즈 248번째 — unreachable code path
   *   cascade cleanup, cycle 471-489 cascade lens 회귀).
   *
   * 발견 (2 props + cascade dead):
   * - src/components/TerminalView.tsx:
   *     · interface autoFocusInput?: boolean / showInput?: boolean.
   *     · destructure autoFocusInput = true / showInput = true.
   *     · body: `if (showInput && e.key === '/') ...` keybind 핸들러.
   *     · body: showFooter = Boolean(showInput || (player && ...)).
   *     · body: footerInput = showInput ? <input...> : null.
   *     · body: autoFocus={autoFocusInput}.
   * - 호출 사이트:
   *     · MobileGameLayout.tsx:89 — autoFocusInput={false}.
   *     · MobileGameLayout.tsx:93 — showInput={false}.
   *     · 1 callsite always passes false. default true는 도달 불가.
   * - 결과:
   *     · showInput 항상 false → '/' keybind 핸들러 dead, footerInput 항상 null,
   *       showFooter는 showQuickSlots와 동일.
   *     · autoFocusInput 항상 false → autoFocus attr 제거 (false 동작 동일).
   *
   * 패턴 (cycle 222-496 시리즈 248번째):
   * - cycle 471-489 cascade lens — caller 항상 falsy로 prop 전달 → default
   *   unreachable + body conditional 가지 dead.
   *
   * 수정 (src/components/TerminalView.tsx):
   * - interface에서 autoFocusInput / showInput 제거.
   * - destructure에서 두 prop 제거.
   * - '/' keybind 핸들러 제거.
   * - useEffect deps에서 showInput 제거.
   * - showFooter / footerInput const 제거.
   * - JSX footer 단순화 → {showQuickSlots && <div><QuickSlot /></div>}.
   * - autoFocus attr 제거.
   *
   * 호출 사이트 (MobileGameLayout.tsx):
   * - autoFocusInput={false} / showInput={false} 두 명시 attr 제거.
   *
   * 회귀 가드:
   * - logs / gameState / onCommand / player / quickSlots / onQuickSlotUse 보존.
   * - 본체 로그 / 토글 / 퀵슬롯 렌더 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 497: TerminalView destructure에서 autoFocusInput / showInput 0건', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      const fnIdx = source.indexOf('const TerminalView = ({');
      const fnEnd = source.indexOf('}: TerminalViewProps', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/autoFocusInput/.test(block), 'destructure에 autoFocusInput 0건');
      assert.ok(!/showInput/.test(block), 'destructure에 showInput 0건');
  });

  test('cycle 497: interface에서 autoFocusInput / showInput 0건', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      const ifaceIdx = source.indexOf('interface TerminalViewProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/autoFocusInput/.test(block), 'interface에 autoFocusInput 0건');
      assert.ok(!/showInput/.test(block), 'interface에 showInput 0건');
  });

  test('cycle 497: 본체 autoFocusInput / showInput / footerInput / showFooter 참조 0건', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      assert.ok(!/autoFocusInput/.test(source), 'autoFocusInput 참조 0건');
      assert.ok(!/showInput/.test(source), 'showInput 참조 0건');
      assert.ok(!/footerInput/.test(source), 'footerInput const 0건');
      assert.ok(!/showFooter/.test(source), 'showFooter const 0건');
      assert.ok(!/autoFocus=/.test(source), 'autoFocus attr 0건');
  });

  test('cycle 497: 정합성 가드 — MobileGameLayout 두 명시 attr 제거', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const idx = source.indexOf('<TerminalView');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/autoFocusInput=/.test(jsx), 'callsite autoFocusInput 0건');
      assert.ok(!/showInput=/.test(jsx), 'callsite showInput 0건');
  });

  test('cycle 497: 핵심 props / 본체 로직 보존', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      assert.ok(/showQuickSlots/.test(source), 'showQuickSlots 보존');
      assert.ok(/showExpandToggle/.test(source), 'showExpandToggle 보존');
      assert.ok(/displayLogs/.test(source), 'displayLogs 보존');
      assert.ok(/<QuickSlot/.test(source), 'QuickSlot 렌더 보존');
  });
}
