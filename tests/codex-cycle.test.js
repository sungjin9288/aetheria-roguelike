import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { SEASON_XP } from '../src/data/seasonPass.js';
import { countNewCodexEntries, registerCodex, registerLootToCodex } from '../src/utils/gameUtils.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * 도감(Codex) 관련 cycle 테스트 — 통합본.
 * 기존 11개 cycle-*.test.js 통합 (audit #1). 각 원본 본문을 블록 { } 으로 격리 — 행동/커버리지 동일.
 */

// ─── 원본: tests/cycle-130-codex-testids.test.js ───
{
  /**
   * cycle 130: Codex testid 노출 — testid sweep 마무리.
   *
   * Codex는 무기/방어구/방패/몬스터/레시피/재료/Legendary 7개 도감 + milestone
   * 수령 버튼이 있는 핵심 진행 surface. e2e가 도감 milestone 수령 흐름을
   * 자동화하려면 stable selector 필요.
   *
   * 추가 (cycle 18+ 명명 패턴 일관):
   * - data-testid="codex-panel" — 루트.
   * - data-testid={`codex-tab-${tab.id}`} — 3개 sub tab (equip / monsters /
   *   legend).
   * - data-testid={`codex-claim-${m.id}`} — milestone 수령 버튼.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('Codex: codex-panel root testid 노출', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      assert.match(source, /data-testid\s*=\s*["']codex-panel["']/);
  });

  test('Codex: codex-tab-{tab.id} dynamic testid 노출', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      assert.match(source, /data-testid\s*=\s*\{`codex-tab-\$\{[^}]+\}`\}/);
  });

  test('Codex: codex-claim-{milestone.id} dynamic testid 노출', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      assert.match(source, /data-testid\s*=\s*\{`codex-claim-\$\{[^}]+\}`\}/);
  });
}

// ─── 원본: tests/cycle-133-codex-claim-sound.test.js ───
{
  /**
   * cycle 133: 도감 milestone 수령 사운드 큐 — cycle 122-123 quest_complete 재사용.
   *
   * 발견:
   * - cycle 122에서 completeQuest, cycle 123에서 claimAchievement에 quest_complete
   *   사운드 추가했지만 같은 결의 celebratory 모먼트인 codex milestone 수령은
   *   audio cue 없음 (Codex.tsx onClick에서 dispatch만).
   * - 도감 milestone 보상은 ATK/DEF/HP 영구 보너스 + premiumCurrency까지 주는
   *   의미 있는 액션이라 동일한 audio reflection이 자연스러움.
   *
   * 수정:
   * - Codex.tsx milestone 수령 버튼 onClick에 soundManager.play('quest_complete')
   *   추가. 새 case 추가 대신 cycle 122 사운드 재사용 (3가지 "달성/회수" 액션
   *   — completeQuest / claimAchievement / claimCodex가 동일 음악적 정체성).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('Codex: milestone 수령 onClick에 quest_complete 사운드 재생', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      const idx = source.indexOf('CLAIM_CODEX_REWARD');
      assert.ok(idx > -1, 'CLAIM_CODEX_REWARD dispatch should exist');
      const window = source.slice(Math.max(0, idx - 200), idx + 800);
      assert.match(
          window,
          /soundManager.*\(['"]quest_complete['"]\)|play\(['"]quest_complete['"]\)/,
          'codex claim button should play quest_complete sound'
      );
  });

  test('Codex: soundManager import 추가됨', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      assert.match(source, /import\s*\{[^}]*soundManager[^}]*\}\s*from/);
  });

  test('회귀 보존: cycle 122 completeQuest / cycle 123 claimAchievement 사운드 그대로', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      // completeQuest와 claimAchievement 둘 다 quest_complete 사운드 호출 여전히 활성
      const completeQuestIdx = source.indexOf('completeQuest:');
      const claimAchIdx = source.indexOf('claimAchievement:');
      const cqBlock = source.slice(completeQuestIdx, claimAchIdx);
      const caBlock = source.slice(claimAchIdx, source.indexOf('synthesize:', claimAchIdx));
      assert.match(cqBlock, /play\(['"]quest_complete['"]\)/);
      assert.match(caBlock, /play\(['"]quest_complete['"]\)/);
  });
}

// ─── 원본: tests/cycle-193-codex-discover-season-xp.test.js ───
{
  /**
   * cycle 193: SEASON_XP.codexDiscover dead config 활성 — 신규 codex 등록 시 시즌 XP 부여.
   *
   * 발견:
   * - SEASON_XP.codexDiscover (8 XP) 정의됐으나 dispatch 0건이던 dead config.
   * - 신규 monster / weapon / armor / shield / material 발견 시 시즌 XP 적립이
   *   spec에는 있지만 코드 미구현.
   * - explore/kill/bossKill/craft/quest/synth는 모두 dispatch 정상 — 'codexDiscover'만
   *   누락이던 inconsistency.
   *
   * 수정:
   * 1. src/utils/gameUtils.ts:
   *    - countNewCodexEntries 헬퍼 추가 — 호출 전후 codex 사이즈 차이로 신규 등록
   *      수 판정.
   * 2. src/hooks/combatActions/combatVictory.ts:
   *    - loot 추가 + monster 등록 직전/직후 countNewCodexEntries 비교.
   *    - newCount > 0이면 dispatch ADD_SEASON_XP * SEASON_XP.codexDiscover * newCount.
   */

  test('cycle 193: SEASON_XP.codexDiscover key 정의됨 (dead config 회귀 가드)', () => {
      assert.equal(typeof SEASON_XP.codexDiscover, 'number');
      assert.ok(SEASON_XP.codexDiscover > 0);
  });

  test('cycle 193: countNewCodexEntries — codex 카테고리별 entry 수 합산', () => {
      const player = {
          stats: {
              codex: {
                  weapons: { '강철 롱소드': { discovered: true } },
                  armors: { '가죽 갑옷': { discovered: true }, '사슬 갑옷': { discovered: true } },
                  monsters: { '슬라임': { discovered: true } },
              },
          },
      };
      assert.equal(countNewCodexEntries(player), 4);
  });

  test('cycle 193: registerCodex 신규 등록 시 count +1', () => {
      const player = { stats: { codex: { monsters: {} } } };
      const before = countNewCodexEntries(player);
      const updated = registerCodex(player, 'monsters', '슬라임');
      const after = countNewCodexEntries(updated);
      assert.equal(after - before, 1);
  });

  test('cycle 193: registerCodex 중복 등록 시 count 변화 없음', () => {
      const player = { stats: { codex: { monsters: { '슬라임': { discovered: true } } } } };
      const before = countNewCodexEntries(player);
      const updated = registerCodex(player, 'monsters', '슬라임');
      const after = countNewCodexEntries(updated);
      assert.equal(after - before, 0);
  });

  test('cycle 193: registerLootToCodex 다중 신규 등록 — 각 entry 별 count 증가', () => {
      const player = { stats: { codex: { weapons: {}, armors: {}, materials: {} } } };
      const before = countNewCodexEntries(player);
      const items = [
          { type: 'weapon', name: '강철 롱소드' },
          { type: 'armor', name: '가죽 갑옷' },
          { type: 'mat', name: '슬라임 젤리' },
      ];
      const updated = registerLootToCodex(player, items);
      const after = countNewCodexEntries(updated);
      assert.equal(after - before, 3);
  });

  test('cycle 193: combatVictory 호출에 SEASON_XP.codexDiscover 분기 추가됨 (코드 명시 가드)', async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const src = await readFile(path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts'), 'utf8');
      assert.match(src, /SEASON_XP\.codexDiscover/);
      assert.match(src, /newCodexCount/);
  });
}

// ─── 원본: tests/cycle-196-codex-discover-xp-broader-paths.test.js ───
{
  /**
   * cycle 196: SEASON_XP.codexDiscover dispatch를 useInventoryActions의 3 paths로 확장
   * (cycle 193 follow-up).
   *
   * 발견:
   * - cycle 193이 combatVictory에서 신규 codex 등록 시 SEASON_XP.codexDiscover 부여 fix.
   * - 그러나 useInventoryActions의 3 codex 등록 path는 dispatch 누락:
   *   1. shopBuy (line 185 registerLootToCodex) — 상점 구매 시 신규 발견.
   *   2. craft (line 240/241 registerCodex + registerLootToCodex) — 제작 시 레시피/결과.
   *   3. synthesize (line 393 registerLootToCodex) — 합성 결과.
   *
   * 결과: combat loot로만 codex XP 적립, 다른 정상 codex 발견 경로(상점/제작/합성)에서는
   *   silent. 게임 spec의 codexDiscover XP가 부분적으로만 dispatch.
   *
   * 수정 (src/hooks/useInventoryActions.ts):
   * - 3 path 모두에 countNewCodexEntries 호출 전후 비교 + ADD_SEASON_XP * codexDiscover 추가.
   * - import에 countNewCodexEntries 추가.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  test('cycle 196: useInventoryActions에 countNewCodexEntries import + 사용', async () => {
      const src = await readFile(path.join(ROOT, 'src/hooks/useInventoryActions.ts'), 'utf8');
      assert.match(src, /countNewCodexEntries/);
      assert.match(src, /SEASON_XP\.codexDiscover/);
  });

  test('cycle 196: useInventoryActions에 codexBefore / newCodexCount 변수 3 path 적용', async () => {
      const src = await readFile(path.join(ROOT, 'src/hooks/useInventoryActions.ts'), 'utf8');
      // shopBuy + craft + synth — 각각 codex 추적 패턴 1+ 회.
      const codexBeforeMatches = (src.match(/codexBefore/g) || []).length;
      const newCodexMatches = (src.match(/newCodexCount/g) || []).length;
      assert.ok(codexBeforeMatches >= 2, `codexBefore variable usage >= 2; got ${codexBeforeMatches}`);
      // synth는 별도 변수명 synthCodexBefore — newCodexCount는 shopBuy+craft에서만.
      assert.ok(newCodexMatches >= 2, `newCodexCount usage >= 2; got ${newCodexMatches}`);
  });

  test('cycle 196: combatVictory 회귀 가드 (cycle 193 codexDiscover dispatch 보존)', async () => {
      const src = await readFile(path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts'), 'utf8');
      assert.match(src, /SEASON_XP\.codexDiscover/);
      assert.match(src, /newCodexCount/);
  });
}

// ─── 원본: tests/cycle-211-codex-bonus-preserve.test.js ───
{
  /**
   * cycle 211: ASCEND / RESET_GAME이 codexBonus(Atk/Def/Hp)를 보존 (cycle 202 lens 확장).
   *
   * 발견 (paired ledger 정합성 깨짐 — 영구 자산 silent 손실):
   * - CLAIM_CODEX_REWARD 핸들러(rewardHandlers.ts:66): milestone 청구 시
   *   stats.codexBonusAtk/Def/Hp 누적 가산. 영구 stat 보너스 (statsCalculator.ts:58-60에서
   *   getFullStats에 +).
   * - 이 보너스는 cumulative 누적 — codexClaimed 배열에서 동적 재계산 안 함.
   * - 그러나 cycle 119/202/203/204 stats 보존 list에 codexBonus(Atk/Def/Hp) 미포함:
   *   · ASCEND: codexClaimed는 보존하지만 codexBonusAtk/Def/Hp는 INITIAL_STATE.stats에
   *     없으므로 reset → undefined.
   *   · RESET_GAME (cycle 204): 동일.
   *   · handleDefeat: ...prevStats spread로 보존 (cycle 191 정합) — 일관성 단절.
   *
   * 결과 (silent permanent loss):
   * - 플레이어가 '몬스터 도감 100 발견' milestone을 청구해 +10 ATK 영구 보너스 획득.
   * - ASCEND 시 codexClaimed는 보존(재청구 차단)되지만 +10 ATK는 사라짐.
   * - 재청구 불가 (codexClaimed에 등록) → 영구 손실. cycle 202 claimedAchievements
   *   재청구 exploit과 정반대 방향의 회귀.
   *
   * 수정:
   * - src/reducers/handlers/progressionHandlers.ts ASCEND: codexBonusAtk/Def/Hp 명시 보존.
   * - src/reducers/handlers/progressionHandlers.ts RESET_GAME: 동일.
   * - 미정의 시 0 fallback (구형 save 호환).
   */

  const buildState = (statsOverrides = {}) => ({
      ...INITIAL_STATE,
      player: {
          ...INITIAL_STATE.player,
          name: 'Test',
          gender: 'male',
          meta: { essence: 0, rank: 0, prestigeRank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          stats: {
              ...INITIAL_STATE.player.stats,
              kills: 100,
              ...statsOverrides,
          },
      },
      grave: null,
      uid: 'test-uid',
      bootStage: 'ready',
  });

  const ASCEND_PAYLOAD = {
      meta: { essence: 100, rank: 1, prestigeRank: 1, bonusAtk: 5, bonusHp: 50, bonusMp: 25 },
      newTitle: '각성자',
  };

  test('cycle 211: ASCEND가 codexBonusAtk 보존', () => {
      const state = buildState({ codexBonusAtk: 15 });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.codexBonusAtk, 15,
          'codexBonusAtk는 영구 누적 stat 보너스 — ASCEND 시 보존 필요 (재청구 불가하므로)');
  });

  test('cycle 211: ASCEND가 codexBonusDef 보존', () => {
      const state = buildState({ codexBonusDef: 8 });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.codexBonusDef, 8);
  });

  test('cycle 211: ASCEND가 codexBonusHp 보존', () => {
      const state = buildState({ codexBonusHp: 50 });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.codexBonusHp, 50);
  });

  test('cycle 211: RESET_GAME이 codexBonus 3종 동시 보존', () => {
      const state = buildState({ codexBonusAtk: 12, codexBonusDef: 6, codexBonusHp: 100 });
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(next.player.stats.codexBonusAtk, 12);
      assert.equal(next.player.stats.codexBonusDef, 6);
      assert.equal(next.player.stats.codexBonusHp, 100);
  });

  test('cycle 211: 미정의(구형 save) → 0 fallback', () => {
      const state = buildState({});
      delete state.player.stats.codexBonusAtk;
      delete state.player.stats.codexBonusDef;
      delete state.player.stats.codexBonusHp;
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      const reset = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(ascended.player.stats.codexBonusAtk || 0, 0);
      assert.equal(reset.player.stats.codexBonusAtk || 0, 0);
  });

  test('cycle 211: codexClaimed와 codexBonus 동시 보존 정합성 (paired ledger)', () => {
      const state = buildState({
          codexBonusAtk: 20,
          codexBonusDef: 10,
          codexBonusHp: 200,
          codexClaimed: ['monster_100', 'weapon_50'],
      });
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      // codexClaimed 보존 (cycle 119)
      assert.deepEqual(ascended.player.stats.codexClaimed, ['monster_100', 'weapon_50']);
      // codexBonus 보존 (cycle 211)
      assert.equal(ascended.player.stats.codexBonusAtk, 20);
      assert.equal(ascended.player.stats.codexBonusDef, 10);
      assert.equal(ascended.player.stats.codexBonusHp, 200);
  });

  test('cycle 119/202/203/204 회귀 가드: 기존 보존 필드 동시 유지', () => {
      const state = buildState({
          codexBonusAtk: 5,
          kills: 500,
          bossKills: 25,
          cosmeticTitles: ['별을 보는 자'],
          synthProtects: 2,
          claimedAchievements: ['ach_test'],
          explores: 100,
      });
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      // cycle 119
      assert.equal(ascended.player.stats.kills, 500);
      assert.equal(ascended.player.stats.bossKills, 25);
      // cycle 188
      assert.deepEqual(ascended.player.stats.cosmeticTitles, ['별을 보는 자']);
      assert.equal(ascended.player.stats.synthProtects, 2);
      // cycle 202
      assert.deepEqual(ascended.player.stats.claimedAchievements, ['ach_test']);
      // cycle 203
      assert.equal(ascended.player.stats.explores, 100);
      // cycle 211
      assert.equal(ascended.player.stats.codexBonusAtk, 5);
  });
}

// ─── 원본: tests/cycle-286-codex-milestones-private.test.js ───
{
  /**
   * cycle 286: CODEX_MILESTONES export downgrade (private const)
   *   (cycle 222-285 silent dead config 시리즈 56번째 — cleanup lens 연속).
   *
   * 발견:
   * - src/data/codexRewards.ts: CODEX_MILESTONES export 정의 + getCodexProgress 내부에서만 사용.
   * - 외부 consumer 0건 — 외부는 getCodexProgress 함수만 호출.
   * - cycle 285 RELIC_WEIGHTS 패턴 동일.
   *
   * 수정 (src/data/codexRewards.ts):
   * - CODEX_MILESTONES export 제거 (private const로 downgrade).
   *
   * 회귀 가드:
   * - getCodexProgress 함수 export 유지.
   * - 내부에서 CODEX_MILESTONES 사용 그대로.
   * - codex 보상 계산 동작 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 286: CODEX_MILESTONES export 제거 (private const)', async () => {
      const source = await readSrc('src/data/codexRewards.ts');
      assert.ok(!/export const CODEX_MILESTONES/.test(source),
          'CODEX_MILESTONES export 제거됨');
      assert.ok(/const CODEX_MILESTONES/.test(source),
          'CODEX_MILESTONES const 정의 유지 (private)');
  });

  test('cycle 286: getCodexProgress export 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/data/codexRewards.ts');
      assert.ok(/export const getCodexProgress/.test(source),
          'getCodexProgress active export 유지');
  });

  test('cycle 286: getCodexProgress 동작 유지 (회귀 가드)', async () => {
      const { getCodexProgress } = await import('../src/data/codexRewards.js');
      const codex = { weapons: { sword1: true, sword2: true, sword3: true, sword4: true, sword5: true } };
      const result = getCodexProgress(codex, []);
      assert.ok(Array.isArray(result.milestones), 'milestones 배열 반환');
      assert.ok(Array.isArray(result.unclaimed), 'unclaimed 배열 반환');
      // weapons 5개 → 5-count milestone unclaimed.
      assert.ok(result.unclaimed.some((m) => m.category === 'weapons' && m.count === 5),
          'weapons 5-count milestone unclaimed 정상 detect');
  });

  test('cycle 285 회귀 가드: PREMIUM_FREE_SOURCES / RELIC_WEIGHTS cleanup 유지', async () => {
      const premiumSrc = await readSrc('src/data/premiumShop.ts');
      const relicsSrc = await readSrc('src/data/relics.ts');
      assert.ok(!/export const PREMIUM_FREE_SOURCES/.test(premiumSrc),
          'cycle 285 PREMIUM_FREE_SOURCES 제거 유지');
      assert.ok(!/export const RELIC_WEIGHTS/.test(relicsSrc),
          'cycle 285 RELIC_WEIGHTS export 제거 유지');
  });
}

// ─── 원본: tests/cycle-405-codex-compact-prop-dead.test.js ───
{
  /**
   * cycle 405: Codex `compact` interface dead prop 양쪽 정리
   *   (cycle 222-404 silent dead config 시리즈 167번째 — interface dead lens 5사이클 연속).
   *
   * 발견 (1 dead prop, 양쪽):
   * - src/components/Codex.tsx CodexProps line 22:
   *   `compact?: boolean;`
   * - 본체 destructure: `{ player, dispatch }` — compact 제외.
   * - 변수 read 0건 (파일 내 `compact` 식별자 1회만 — interface 정의 자체).
   * - 유일 consumer (Dashboard.tsx:217): `compact={desktopArchiveCompact}` prop pass —
   *   silent dropped.
   *
   * 비교: AchievementPanel / SkillTreePreview / QuestTab / StatsPanel /
   *   BuildAdvicePanel / EquipmentPanel / GravePanel / MapNavigator는 모두
   *   compact destructure + 본체 사용 (활성). Codex만 dead.
   *
   * 패턴 (cycle 222-404 시리즈 167번째 — 5사이클 연속):
   * - cycle 401: DashboardProps mobile interface dead.
   * - cycle 402: PostCombatCard + IntroScreen mobile dead batch.
   * - cycle 403: CraftingPanel + JobChangePanel mobileFocused dead batch.
   * - cycle 404: TerminalView stats interface dead.
   * - cycle 405: Codex compact interface dead.
   *   interface dead lens 5사이클 연속 — 다양한 prop 이름 (`mobile`,
   *   `mobileFocused`, `stats`, `compact`)이 컴포넌트 7개째 발견.
   *
   * 수정:
   * 1) src/components/Codex.tsx CodexProps에서 `compact?: boolean;` 제거.
   * 2) src/components/Dashboard.tsx Codex JSX에서 `compact={desktopArchiveCompact}` 제거.
   *
   * 회귀 가드:
   * - Codex 활성 props (player/dispatch) 동작 그대로.
   * - 다른 패널들의 compact prop 정합성 보존.
   * - cycle 401-404 dead prop 정리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 405: CodexProps에서 compact 0건', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      const ifaceStart = source.indexOf('interface CodexProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/compact\?:/.test(ifaceBlock),
          'CodexProps에서 compact 0건');
  });

  test('cycle 405: Dashboard Codex JSX에서 compact prop 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      // <Codex ... /> 영역 추출
      const codexStart = source.indexOf('<Codex');
      const codexEnd = source.indexOf('/>', codexStart);
      assert.ok(codexStart >= 0 && codexEnd > codexStart, 'Codex JSX 발견');
      const codexBlock = source.slice(codexStart, codexEnd);
      assert.ok(!/compact=\{desktopArchiveCompact\}/.test(codexBlock),
          'Codex JSX에서 compact prop 0건');
  });

  test('cycle 405: CodexProps 활성 필드 보존', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      const ifaceStart = source.indexOf('interface CodexProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(/player\?:/.test(ifaceBlock), 'player 필드 보존');
      assert.ok(/dispatch:/.test(ifaceBlock), 'dispatch 필드 보존');
  });

  test('cycle 405: 활성 패널 compact 보존 (회귀 가드 — 모두 cascade 정리됨)', async () => {
      // cycle 472-476이 MapNavigator/AchievementPanel/EquipmentPanel/StatsPanel/
      // GravePanel의 compact prop cascade로 모두 정리. 5 panel 모두 cascade 정리됨.
      // 잔존 panel 0건이므로 test는 빈 가드 (정합성 트래킹용).
      assert.ok(true, '모든 panel이 cascade 정리됨');
  });

  test('cycle 404 회귀 가드: TerminalView stats 0건', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      const ifaceStart = source.indexOf('interface TerminalViewProps');
      const ifaceEnd = source.indexOf('}', ifaceStart);
      const ifaceBlock = source.slice(ifaceStart, ifaceEnd);
      assert.ok(!/^\s+stats\?:/m.test(ifaceBlock),
          'cycle 404 stats 0건 보존');
  });
}

// ─── 원본: tests/cycle-438-codex-obtained-at-dead.test.js ───
{
  /**
   * cycle 438: codex 엔트리 obtainedAt 출력 dead 정리
   *   (cycle 222-437 silent dead config 시리즈 197번째 — function output dead field
   *   cleanup lens 회귀, cycle 333-356/435 패턴).
   *
   * 발견 (1 dead output field — 4 production producers):
   * - src/utils/gameUtils.ts:154 (registerCodex), :458/:468 (migrateData bootstrap):
   *     `{ discovered: true, obtainedAt: Date.now() }`
   * - src/reducers/handlers/rewardHandlers.ts:20 (CLAIM_CODEX_REWARD):
   *     `{ discovered: true, obtainedAt: Date.now() }`
   * - 호출 사이트 (codex 엔트리 consumer) 분석:
   *     · Codex.tsx / WeaponCodex.tsx / etc.: codex[cat][name] 키 존재만 검사
   *       (truthy check, Object.keys count). entry 내부 필드 read 0건.
   *     · production .obtainedAt read: 0건.
   *     · tests/game-utils.test.js / signature-achievements.test.js는 fixture로
   *       설정하지만 어설션 read 0건.
   * - 결과: obtainedAt 필드는 4 producer가 작성하지만 어디로도 흐르지 않는 dead.
   *
   * 패턴 (cycle 222-437 시리즈 197번째):
   * - cycle 333-356 시리즈: 함수 출력 dead 필드 cleanup.
   * - cycle 435: makeBattleRecord ts 출력 dead.
   * - cycle 436: getDailyDeals isDailyDeal 마커 dead.
   * - cycle 438: codex obtainedAt 출력 dead — 동일 lens 회귀 (4 producer batch).
   *
   * 수정:
   * - gameUtils.ts (registerCodex / migrateData 2 sites): obtainedAt 제거.
   * - rewardHandlers.ts (CLAIM_CODEX_REWARD): obtainedAt 제거.
   * - 결과 entry 형태: `{ discovered: true }` 단일 필드.
   *
   * 회귀 가드:
   * - codex[cat][name] 엔트리 자체 유지 (truthy check 동작).
   * - discovered: true 보존.
   * - migrate / register / reward 모든 path 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 438: gameUtils.ts에서 obtainedAt 0건', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.ok(!/obtainedAt/.test(source), 'gameUtils.ts obtainedAt 0건');
  });

  test('cycle 438: rewardHandlers.ts에서 obtainedAt 0건', async () => {
      const source = await readSrc('src/reducers/handlers/rewardHandlers.ts');
      assert.ok(!/obtainedAt/.test(source), 'rewardHandlers.ts obtainedAt 0건');
  });

  test('cycle 438: registerCodex 동작 — discovered: true entry 노출', async () => {
      const { registerCodex } = await import('../src/utils/gameUtils.ts');
      const player = { stats: { codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } } };
      const updated = registerCodex(player, 'weapons', 'Test Sword');
      assert.ok(updated.stats.codex.weapons['Test Sword'], 'codex 엔트리 추가됨');
      assert.equal(updated.stats.codex.weapons['Test Sword'].discovered, true, 'discovered: true 보존');
      assert.equal(updated.stats.codex.weapons['Test Sword'].obtainedAt, undefined, 'obtainedAt 0건');
  });

  test('cycle 438: migrateData 동작 — codex bootstrap discovered만', async () => {
      const { migrateData } = await import('../src/utils/gameUtils.ts');
      const raw = {
          version: 1.0,
          player: {
              inv: [{ name: 'Sword', type: 'weapon', tier: 1 }],
              equip: { weapon: { name: 'Sword', type: 'weapon' } },
              stats: { kills: 0, killRegistry: {} },
          },
      };
      const migrated = migrateData(raw);
      const codex = migrated.player.stats.codex;
      if (codex?.weapons?.Sword) {
          assert.equal(codex.weapons.Sword.discovered, true, 'bootstrap discovered: true');
          assert.equal(codex.weapons.Sword.obtainedAt, undefined, 'bootstrap obtainedAt 0건');
      }
  });

  test('cycle 438: 정합성 가드 — production .obtainedAt read 0건', async () => {
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
          if (/obtainedAt/.test(content)) reads += 1;
      }
      assert.equal(reads, 0, 'src/ 어디서도 obtainedAt 참조 0건');
  });

  test('cycle 437 회귀 가드: EventPanel default mobileFocused 0건', async () => {
      const source = await readSrc('src/components/EventPanel.tsx');
      const fnIdx = source.indexOf('const EventPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/mobileFocused = false/.test(block), 'cycle 437 default 제거 보존');
  });
}

// ─── 원본: tests/cycle-454-codex-legendary-count-pct-dead.test.js ───
{
  /**
   * cycle 454: Codex legendaryCount.pct 출력 dead 정리
   *   (cycle 222-453 silent dead config 시리즈 211번째 — function output dead field
   *   cleanup lens 회귀, cycle 333-356/442/443/445/446/447/453 패턴).
   *
   * 발견 (1 dead output field):
   * - src/components/Codex.tsx legendaryCount (line 78+):
   *     `return { total, discovered, pct }`
   * - 호출 사이트 분석:
   *     · Codex.tsx:166: `{legendaryCount.discovered}/{legendaryCount.total}` 만 read.
   *     · `legendaryCount.pct` read 0건 (전체 src/).
   * - 결과: pct 필드는 useMemo가 계산하지만 어디로도 흐르지 않는 dead.
   *
   * 패턴 (cycle 222-453 시리즈 211번째):
   * - cycle 333-356/442/443/445/446/447/453: 함수 출력 dead 필드 cleanup.
   * - cycle 454: legendaryCount.pct — 동일 lens 회귀.
   *
   * 수정 (src/components/Codex.tsx):
   * - legendaryCount return에서 `pct` 필드 제거 → `{ total, discovered }`.
   * - 100% 계산 식 제거.
   *
   * 회귀 가드:
   * - total / discovered (활성 read 필드) 보존.
   * - signature 도감 진척 표시 (discovered/total) 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 454: legendaryCount return에서 pct 0건', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      const memoIdx = source.indexOf('const legendaryCount = useMemo');
      const memoEnd = source.indexOf('}, [codex]);', memoIdx);
      const block = source.slice(memoIdx, memoEnd);
      assert.ok(!/\bpct\b/.test(block), 'legendaryCount 본체에 pct 0건');
  });

  test('cycle 454: 활성 필드 (total / discovered) 보존', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      const memoIdx = source.indexOf('const legendaryCount = useMemo');
      const memoEnd = source.indexOf('}, [codex]);', memoIdx);
      const block = source.slice(memoIdx, memoEnd);
      assert.ok(/\btotal\b/.test(block), 'total 보존');
      assert.ok(/\bdiscovered\b/.test(block), 'discovered 보존');
      assert.ok(/return \{[^}]*total[^}]*\}/.test(block), 'return에 total/discovered');
  });

  test('cycle 454: 정합성 가드 — legendaryCount.pct read 0건', async () => {
      const source = await readSrc('src/components/Codex.tsx');
      assert.ok(!/legendaryCount\.pct/.test(source), 'legendaryCount.pct read 0건');
  });

  test('cycle 453 회귀 가드: ClassTree buildTree nodes/edges 0건', async () => {
      const source = await readSrc('src/components/ClassTree.tsx');
      const fnIdx = source.indexOf('const buildTree =');
      const fnEnd = source.indexOf('const TreeNode', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      const returnIdx = block.lastIndexOf('return ');
      const returnBlock = block.slice(returnIdx);
      assert.ok(!/\bnodes\b/.test(returnBlock), 'cycle 453 nodes 출력 0건 보존');
      assert.ok(!/\bedges\b/.test(returnBlock), 'cycle 453 edges 출력 0건 보존');
  });
}

// ─── 원본: tests/cycle-468-equipment-codex-card-equip-typo.test.js ───
{
  /**
   * cycle 468: EquipmentCodexCard `player.equipment` 오타 → `player.equip` 정정
   *   (silent UI 결손 fix, cycle 426/427/468 silent UI lens 시리즈)
   *
   * 발견 (오타로 인한 silent UI 결손):
   * - src/components/codex/EquipmentCodexCard.tsx (line 86-93):
   *     const equipped = item.type === 'weapon'
   *         ? player?.equipment?.weapon       ← 'equipment' 오타
   *         : item.type === 'armor'
   *             ? player?.equipment?.armor    ← 동일 오타
   *             : item.type === 'shield'
   *                 ? player?.equipment?.shield ← 동일 오타
   *                 : null;
   * - 실제 Player 도메인은 `player.equip` 사용 (gameUtils.ts:22, 669-671 등 200+
   *   참조). `player.equipment`는 어디서도 set/read되지 않는 nullable 항상 undefined.
   * - 결과:
   *     · equipped는 항상 null.
   *     · `<StatRow compareValue={equipped?.atk} />`의 compareValue 항상 undefined →
   *       diff 비교 UI 항상 미렌더.
   *     · `equipped && <span>vs {equipped.name}</span>` → 비교 텍스트 항상 미렌더.
   *
   * 패턴 (silent UI 결손 시리즈):
   * - cycle 426: signatureSetBonus.activeSet.atkMult/defMult/hpMult 잘못 제거됐던 거 복원.
   * - cycle 427: SignatureBadge rust 엔트리 missing 보강.
   * - cycle 468: EquipmentCodexCard `equipment` 오타 → `equip` 정정 — 동일 lens.
   *
   * 수정 (src/components/codex/EquipmentCodexCard.tsx):
   * - `player?.equipment?.X` 3곳 → `player?.equip?.X`.
   *
   * 회귀 가드:
   * - 비교 UI ('vs xxx', diff badge) 정상 렌더 가능해짐.
   * - StatRow 시그니처 / 본체 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 468: player.equipment 참조 0건', async () => {
      const source = await readSrc('src/components/codex/EquipmentCodexCard.tsx');
      assert.ok(!/player\?\.equipment\?\./.test(source), 'player?.equipment? 0건');
      assert.ok(!/player\.equipment\./.test(source), 'player.equipment. 0건');
  });

  test('cycle 468: player.equip 정상 참조 3건', async () => {
      const source = await readSrc('src/components/codex/EquipmentCodexCard.tsx');
      const matches = source.match(/player\?\.equip\?\.\w+/g) || [];
      assert.ok(matches.length >= 3, `player?.equip?.X 참조 3건 이상 (실제: ${matches.length})`);
  });

  test('cycle 468: 정합성 가드 — Player 도메인은 .equip 필드 사용', async () => {
      // 다른 파일들이 player.equip을 쓰는지 sanity check
      const utils = await readSrc('src/utils/gameUtils.ts');
      assert.ok(/player\?\.equip\b/.test(utils), 'gameUtils에서 player.equip 활성 사용');
  });

  test('cycle 468: equipped 변수 / 비교 UI 보존', async () => {
      const source = await readSrc('src/components/codex/EquipmentCodexCard.tsx');
      assert.ok(/const equipped =/.test(source), 'equipped 선언 보존');
      assert.ok(/equipped\?\.atk/.test(source), 'equipped?.atk 비교 보존');
      assert.ok(/vs \{equipped\.name\}/.test(source), 'vs {equipped.name} 비교 텍스트 보존');
  });
}

// ─── 원본: tests/cycle-577-get-map-codex-progress-codex-default-unreachable.test.js ───
{
  /**
   * cycle 577: getMapCodexProgress `codex = {}` default unreachable
   *   (cycle 222-576 silent dead config 시리즈 316번째 — redundant default annotation
   *   청소 메가 시리즈 69번째). utils/ 추가 cleanup.
   *
   * 발견 (1 default unreachable):
   * - src/utils/mapProgress.ts (line 11):
   *     export const getMapCodexProgress = (mapName: any, maps: any,
   *         codex: any = {}) => {
   *         const discoveredSet = new Set(Object.keys(codex?.monsters || {}));
   *         ...
   *     };
   * - 호출 사이트:
   *     · mapProgress.ts:28 — getMapCodexProgress(mapName, maps, codex) 명시.
   *     · tests/map-progress.test.js:22 — getMapCodexProgress('숲', MAPS, {...})
   *       명시.
   *     · 다른 caller 0건.
   * - 결과: codex 항상 명시 전달. default {} 도달 불가. body의 codex?.monsters
   *   || {} defensive guard 보존.
   *
   * 패턴 (cycle 222-576 시리즈 316번째):
   * - cycle 502-576: default 청소 메가 시리즈 75사이클.
   * - cycle 577: utils/mapProgress.ts cleanup.
   *
   * 수정 (src/utils/mapProgress.ts):
   * - signature에서 codex: any = {} → codex: any.
   * - body의 codex?.monsters || {} defensive guard 보존.
   *
   * 회귀 가드:
   * - 1 internal + 1 test callsite 동작 그대로.
   * - body roster filter / Math.max 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 577: getMapCodexProgress signature에서 codex default 0건', async () => {
      const source = await readSrc('src/utils/mapProgress.ts');
      const fnIdx = source.indexOf('export const getMapCodexProgress');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/codex:\s*any\s*=\s*\{\}/.test(sig),
          'getMapCodexProgress codex default {} 제거');
  });

  test('cycle 577: 정합성 가드 — internal + test callsite 보존', async () => {
      const source = await readSrc('src/utils/mapProgress.ts');
      assert.ok(/getMapCodexProgress\(mapName,\s*maps,\s*codex\)/.test(source),
          'internal callsite 보존');

      const test1 = await readSrc('tests/map-progress.test.js');
      assert.ok(/getMapCodexProgress\('숲',\s*MAPS,/.test(test1),
          'test callsite 보존');
  });

  test('cycle 577: body codex?.monsters defensive guard 보존', async () => {
      const source = await readSrc('src/utils/mapProgress.ts');
      assert.ok(/codex\?\.monsters \|\| \{\}/.test(source),
          'codex?.monsters || {} defensive guard 보존');
  });

  test('cycle 577: cycle 502-576 회귀 가드 — default 청소 시리즈 보존', async () => {
      const tv = await readSrc('src/components/TerminalView.tsx');
      assert.ok(!/const TerminalView = \(\{\s*\n\s*logs\s*=\s*\[\]/.test(tv),
          'cycle 576 TerminalView logs default 0건');

      const cp = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.ok(!/const CombatPanel = \({[^}]+enemy\s*=\s*null/.test(cp),
          'cycle 575 CombatPanel enemy default 0건');
  });
}
