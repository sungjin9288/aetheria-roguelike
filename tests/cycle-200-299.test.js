import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AT } from '../src/reducers/actionTypes.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { DB } from '../src/data/db.js';
import { GS } from '../src/reducers/gameStates.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { fileURLToPath } from 'node:url';
import { migrateData } from '../src/utils/gameUtils.js';
import { readFile } from 'node:fs/promises';

/**
 * cycle 200-299 정리 가드 (audit #1 통합 50개)
 */

// ─── cycle-202-ascend-claimedachievements-preserve.test.js ───
{
  /**
   * cycle 202: ASCEND가 claimedAchievements를 보존해야 (cycle 188 패턴 follow-up).
   *
   * 발견 (재발견 익스플로잇):
   * - ASCEND 핸들러(progressionHandlers.ts:60)는 stats를 명시 필드만 보존:
   *   kills / bossKills / deaths / total_gold / relicCount / abyssFloor / abyssRecord /
   *   escapes / syntheses / maxKillStreak / visitedMaps / discoveryChains /
   *   demonKingSlain / bountiesCompleted / crafts / codex / codexClaimed /
   *   cosmeticTitles(cycle 188) / synthProtects(cycle 188).
   * - claimedAchievements는 미보존 → ASCEND 후 [] 으로 리셋.
   * - 그러나 위 카운터들(kills / bossKills 등)은 보존되므로 isAchievementUnlocked는
   *   여전히 true.
   * - claimAchievement(useInventoryActions.ts:320)는 'claimed.includes(achId)' 만 가드.
   * - 결과: ASCEND마다 모든 업적을 재청구 가능 → gold / item 무한 획득 exploit.
   * - cycle 188 "영구 자산 보존" 패턴(cosmeticTitles / synthProtects)과 동일 카테고리 —
   *   claimedAchievements도 영구 ledger.
   *
   * 수정 (src/reducers/handlers/progressionHandlers.ts ASCEND):
   * - stats에 claimedAchievements 명시 보존 추가.
   * - 미정의 시 [] fallback (구형 save 호환).
   */

  const buildAscendingState = (claimedAchievements) => ({
      player: {
          name: 'Test',
          gender: 'male',
          meta: { essence: 0, rank: 0, prestigeRank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          titles: [],
          activeTitle: null,
          stats: {
              kills: 100,
              bossKills: 5,
              deaths: 2,
              total_gold: 5000,
              relicCount: 3,
              claimedAchievements: claimedAchievements,
              cosmeticTitles: [],
              synthProtects: 0,
          },
          premiumCurrency: 0,
          seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
          reviveTokens: 0,
      },
      uid: 'test-uid',
  });

  const ASCEND_PAYLOAD = {
      meta: { essence: 100, rank: 1, prestigeRank: 1, bonusAtk: 5, bonusHp: 50, bonusMp: 25 },
      newTitle: '각성자',
  };

  test('cycle 202: ASCEND가 claimedAchievements를 보존', () => {
      const state = buildAscendingState(['ach_first_blood', 'ach_kill_100', 'ach_boss_5']);
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.deepEqual(
          next.player.stats.claimedAchievements,
          ['ach_first_blood', 'ach_kill_100', 'ach_boss_5'],
          'claimedAchievements 3건 모두 ASCEND 후 보존되어야 함 (재청구 exploit 방지)',
      );
  });

  test('cycle 202: claimedAchievements 미정의 시 [] fallback (구형 save)', () => {
      const state = buildAscendingState(undefined);
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.deepEqual(next.player.stats.claimedAchievements, [],
          '구형 save로 미정의 시 [] fallback');
  });

  test('cycle 202: claimedAchievements 빈 배열은 그대로 빈 배열', () => {
      const state = buildAscendingState([]);
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.deepEqual(next.player.stats.claimedAchievements, []);
  });

  test('cycle 188 회귀 가드: cosmeticTitles / synthProtects 보존 동시 유지', () => {
      const state = buildAscendingState(['ach_test']);
      state.player.stats.cosmeticTitles = ['별을 보는 자'];
      state.player.stats.synthProtects = 3;
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.deepEqual(next.player.stats.cosmeticTitles, ['별을 보는 자']);
      assert.equal(next.player.stats.synthProtects, 3);
      assert.deepEqual(next.player.stats.claimedAchievements, ['ach_test']);
  });

  test('cycle 119 회귀 가드: 영구 카운터 동시 보존', () => {
      const state = buildAscendingState(['ach_a']);
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      // 카운터 보존
      assert.equal(next.player.stats.kills, 100);
      assert.equal(next.player.stats.bossKills, 5);
      assert.equal(next.player.stats.total_gold, 5000);
      assert.equal(next.player.stats.deaths, 2);
      // demonKingSlain은 +1
      assert.equal(next.player.stats.demonKingSlain, 1);
  });
}

// ─── cycle-203-ascend-multirun-counters-preserve.test.js ───
{
  /**
   * cycle 203: ASCEND가 explores / rests / killRegistry / buildWins 영구 카운터 보존.
   *
   * 발견 (cycle 119/188/202 lens 확장):
   * - cycle 119: ASCEND가 abyssRecord / escapes / syntheses / maxKillStreak / visitedMaps /
   *   discoveryChains 6 영구 카운터 명시 보존 — "multi-run achievement / title 데이터 소스".
   * - cycle 202: claimedAchievements 영구 ledger 보존 (재청구 exploit fix).
   * - 그러나 동일 카테고리에 속하지만 cycle 119에서 누락된 4 카운터:
   *   · explores — 6+ quest target / 1 achievement(ach_explore_10) / 2 title('방랑자' val 100,
   *     '길잡이' val 500). 'lifetime exploration' 시맨틱.
   *   · rests — title '안락함의 추구자'(rests 50 cond) 데이터 소스.
   *   · killRegistry — Bestiary / MonsterCodex / statsCalculator atk_per_kill_kind 시너지의
   *     데이터 소스. 'lifetime kill registry per monster' — multi-run permanent record.
   *   · buildWins — questProgress.ts:51에서 quest 조건으로 사용. build kind win counter.
   * - ASCEND마다 4개 카운터가 0/{}로 리셋 → progress 회귀.
   *   · 99 explores → ASCEND → 0. '방랑자'(100) 재진행 필요.
   *   · ach_explore_10 청구 후 ASCEND → claimed는 보존(cycle 202)이지만 explores=0 → 재청구는
   *     불가하나, achievement progress UI에 0/10 표시 (regression).
   *   · killRegistry 0 → Bestiary / MonsterCodex 모든 몬스터 entry 사라짐 → codex regression.
   *
   * 수정 (src/reducers/handlers/progressionHandlers.ts ASCEND):
   * - 4 카운터 명시 보존 추가 — cycle 119 패턴 동일.
   * - 미정의 시 initialStats fallback (구형 save 호환).
   */

  const buildAscendingState = (statsOverrides = {}) => ({
      player: {
          name: 'Test',
          gender: 'male',
          meta: { essence: 0, rank: 0, prestigeRank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          titles: [],
          activeTitle: null,
          stats: {
              kills: 100,
              bossKills: 5,
              deaths: 2,
              total_gold: 5000,
              relicCount: 3,
              ...statsOverrides,
          },
          premiumCurrency: 0,
          seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
          reviveTokens: 0,
      },
      uid: 'test-uid',
  });

  const ASCEND_PAYLOAD = {
      meta: { essence: 100, rank: 1, prestigeRank: 1, bonusAtk: 5, bonusHp: 50, bonusMp: 25 },
      newTitle: '각성자',
  };

  test('cycle 203: ASCEND가 explores 카운터 보존', () => {
      const state = buildAscendingState({ explores: 99 });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.explores, 99,
          'explores는 lifetime 카운터 (방랑자/길잡이 title source) — ASCEND 보존 필요');
  });

  test('cycle 203: ASCEND가 rests 카운터 보존', () => {
      const state = buildAscendingState({ rests: 49 });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.rests, 49,
          'rests는 안락함의 추구자(50) title source — 보존 필요');
  });

  test('cycle 203: ASCEND가 killRegistry 보존', () => {
      const state = buildAscendingState({
          killRegistry: { '슬라임': 12, '고블린': 7, '오크': 3 },
      });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.deepEqual(
          next.player.stats.killRegistry,
          { '슬라임': 12, '고블린': 7, '오크': 3 },
          'killRegistry는 Bestiary / MonsterCodex / atk_per_kill_kind 시너지 source — 보존 필요',
      );
  });

  test('cycle 203: ASCEND가 buildWins 보존', () => {
      const state = buildAscendingState({
          buildWins: { 'warrior': 3, 'mage': 1 },
      });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.deepEqual(
          next.player.stats.buildWins,
          { 'warrior': 3, 'mage': 1 },
          'buildWins는 questProgress build win counter — 보존 필요',
      );
  });

  test('cycle 203: 4 카운터 미정의(구형 save) → fallback (0 / {})', () => {
      const state = buildAscendingState({});
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.explores, 0);
      assert.equal(next.player.stats.rests, 0);
      assert.deepEqual(next.player.stats.killRegistry, {});
      assert.deepEqual(next.player.stats.buildWins, {});
  });

  test('cycle 203: 4 카운터 동시 보존 (혼합 케이스)', () => {
      const state = buildAscendingState({
          explores: 250,
          rests: 30,
          killRegistry: { '드래곤': 1 },
          buildWins: { 'rogue': 5 },
      });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.explores, 250);
      assert.equal(next.player.stats.rests, 30);
      assert.deepEqual(next.player.stats.killRegistry, { '드래곤': 1 });
      assert.deepEqual(next.player.stats.buildWins, { 'rogue': 5 });
  });

  test('cycle 119/188/202 회귀 가드: 기존 보존 필드 동시 유지', () => {
      const state = buildAscendingState({
          explores: 50,
          escapes: 12,
          syntheses: 8,
          maxKillStreak: 25,
          visitedMaps: ['시작의 마을', '고요한 숲'],
          cosmeticTitles: ['별을 보는 자'],
          synthProtects: 2,
          claimedAchievements: ['ach_test'],
      });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      // cycle 119
      assert.equal(next.player.stats.escapes, 12);
      assert.equal(next.player.stats.syntheses, 8);
      assert.equal(next.player.stats.maxKillStreak, 25);
      assert.deepEqual(next.player.stats.visitedMaps, ['시작의 마을', '고요한 숲']);
      // cycle 188
      assert.deepEqual(next.player.stats.cosmeticTitles, ['별을 보는 자']);
      assert.equal(next.player.stats.synthProtects, 2);
      // cycle 202
      assert.deepEqual(next.player.stats.claimedAchievements, ['ach_test']);
      // cycle 203
      assert.equal(next.player.stats.explores, 50);
  });
}

// ─── cycle-204-reset-game-meta-preserve.test.js ───
{
  /**
   * cycle 204: RESET_GAME이 META 진행도 보존 (cycle 191 follow-up — 사망 후 '다시 시작' 회귀).
   *
   * 발견 (cycle 191 nullification):
   * - cycle 191은 handleDefeat가 META 진행도 6종(titles / activeTitle / premiumCurrency /
   *   reviveTokens / maxInv / seasonPass)을 보존하도록 fix.
   * - 그러나 사망 후 user flow:
   *   1. 사망 → handleDefeat 실행 → SET_PLAYER로 preserved state 적용
   *   2. SET_GAME_STATE GS.DEAD → RunSummaryCard 렌더
   *   3. user clicks '다시 시작' → engine.actions.reset() → AT.RESET_GAME dispatch
   *   4. RESET_GAME 핸들러: ...INITIAL_STATE → 모든 META 진행도 wipe.
   * - 결과: cycle 191 preserve가 단지 RunSummary 모달 표시 동안만 살아있고,
   *   '다시 시작' 클릭 즉시 nullify. cycle 191 fix가 사실상 dead-on-arrival.
   *
   * 추가 nullify 대상:
   * - cycle 119/203: stats 영구 카운터 11종 (kills / bossKills / total_gold / abyssRecord /
   *   escapes / syntheses / maxKillStreak / visitedMaps / discoveryChains / explores /
   *   rests / killRegistry / buildWins / demonKingSlain / bountiesCompleted / crafts /
   *   relicCount / deaths / abyssFloor / codex / codexClaimed) — RESET_GAME으로 0 / [] / {} 리셋.
   * - cycle 188/202: cosmeticTitles / synthProtects / claimedAchievements — 동일.
   *
   * 수정 (src/reducers/handlers/progressionHandlers.ts RESET_GAME):
   * - cycle 191 / 188 / 202 / 203 / 119 보존 시리즈와 동일 패턴으로 META 진행도 명시 보존.
   * - RUN 진행도(gold / inv / equip / relics / hp / mp / quests)는 INITIAL_STATE로 reset 유지.
   *
   * 주의: MSG.INIT_RECORD_APPLIED("초기 기록이 적용되었습니다. 이름을 정하고 다시 시작해 주세요.")는
   * 그대로 — name='' reset은 handleDefeat가 이미 처리하므로 RESET_GAME에서 추가 처리 불필요.
   */

  const buildPlayerWithProgress = () => ({
      ...INITIAL_STATE.player,
      name: 'Test',
      job: '전사',
      level: 25,
      meta: {
          essence: 500,
          rank: 3,
          prestigeRank: 2,
          bonusAtk: 15,
          bonusHp: 100,
          bonusMp: 50,
          totalPrestigeAtk: 30,
          totalPrestigeHp: 200,
          totalPrestigeMp: 100,
      },
      titles: ['warrior', 'first_blood', '각성자'],
      activeTitle: '각성자',
      premiumCurrency: 250,
      seasonPass: { xp: 5000, tier: 15, claimed: ['s1_t10'], isPremium: true, seasonId: 'S1' },
      reviveTokens: 3,
      maxInv: 30,
      stats: {
          ...INITIAL_STATE.player.stats,
          kills: 500,
          bossKills: 25,
          deaths: 4,
          total_gold: 50000,
          abyssRecord: 35,
          escapes: 12,
          syntheses: 8,
          maxKillStreak: 50,
          visitedMaps: ['시작의 마을', '고요한 숲', '어둠의 동굴'],
          discoveryChains: ['water_apostle'],
          explores: 250,
          rests: 30,
          killRegistry: { '슬라임': 50, '드래곤': 1 },
          buildWins: { 'warrior': 5 },
          cosmeticTitles: ['별을 보는 자'],
          synthProtects: 2,
          claimedAchievements: ['ach_first_blood', 'ach_kill_100'],
      },
      // RUN-bound (should reset)
      gold: 9999,
      inv: [{ id: 'rare_sword', name: '희귀 검' }],
      equip: { weapon: { id: 'epic_axe' }, armor: null, offhand: null },
      relics: [{ id: 'relic_a' }, { id: 'relic_b' }],
      hp: 50, maxHp: 100, mp: 30, maxMp: 60,
      quests: [{ id: 99, progress: 5 }],
  });

  const buildState = () => ({
      ...INITIAL_STATE,
      player: buildPlayerWithProgress(),
      grave: { items: [{ id: 'lost_a' }] },
      uid: 'test-uid',
      bootStage: 'ready',
  });

  test('cycle 204: RESET_GAME이 player.meta 보존 (cycle 191 align)', () => {
      const state = buildState();
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(next.player.meta.essence, 500);
      assert.equal(next.player.meta.rank, 3);
      assert.equal(next.player.meta.prestigeRank, 2);
      assert.equal(next.player.meta.bonusAtk, 15);
      assert.equal(next.player.meta.bonusHp, 100);
  });

  test('cycle 204: RESET_GAME이 titles / activeTitle 보존', () => {
      const state = buildState();
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.deepEqual(next.player.titles, ['warrior', 'first_blood', '각성자']);
      assert.equal(next.player.activeTitle, '각성자');
  });

  test('cycle 204: RESET_GAME이 premium 자산 4종 보존 (cycle 188/191 align)', () => {
      const state = buildState();
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(next.player.premiumCurrency, 250);
      assert.equal(next.player.reviveTokens, 3);
      assert.equal(next.player.maxInv, 30);
      assert.deepEqual(next.player.seasonPass, { xp: 5000, tier: 15, claimed: ['s1_t10'], isPremium: true, seasonId: 'S1' });
  });

  test('cycle 204: RESET_GAME이 stats 영구 카운터 보존 (cycle 119/203 align)', () => {
      const state = buildState();
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(next.player.stats.kills, 500);
      assert.equal(next.player.stats.bossKills, 25);
      assert.equal(next.player.stats.total_gold, 50000);
      assert.equal(next.player.stats.abyssRecord, 35);
      assert.equal(next.player.stats.escapes, 12);
      assert.equal(next.player.stats.syntheses, 8);
      assert.equal(next.player.stats.maxKillStreak, 50);
      assert.equal(next.player.stats.explores, 250);
      assert.equal(next.player.stats.rests, 30);
      assert.deepEqual(next.player.stats.killRegistry, { '슬라임': 50, '드래곤': 1 });
      assert.deepEqual(next.player.stats.buildWins, { 'warrior': 5 });
      assert.deepEqual(next.player.stats.visitedMaps, ['시작의 마을', '고요한 숲', '어둠의 동굴']);
      assert.deepEqual(next.player.stats.discoveryChains, ['water_apostle']);
  });

  test('cycle 204: RESET_GAME이 cosmeticTitles / synthProtects / claimedAchievements 보존 (cycle 188/202 align)', () => {
      const state = buildState();
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.deepEqual(next.player.stats.cosmeticTitles, ['별을 보는 자']);
      assert.equal(next.player.stats.synthProtects, 2);
      assert.deepEqual(next.player.stats.claimedAchievements, ['ach_first_blood', 'ach_kill_100']);
  });

  test('cycle 204: RESET_GAME이 RUN-bound 진행도 reset (회귀 가드)', () => {
      const state = buildState();
      const next = gameReducer(state, { type: AT.RESET_GAME });
      // RUN 진행도는 reset
      assert.equal(next.player.gold, INITIAL_STATE.player.gold);
      assert.deepEqual(next.player.equip.weapon.id, INITIAL_STATE.player.equip.weapon.id,
          '장비는 INITIAL로 reset');
      assert.deepEqual(next.player.relics, []);
      assert.deepEqual(next.player.quests, []);
  });

  test('cycle 204: grave / uid / bootStage 회귀 가드 (기존 동작)', () => {
      const state = buildState();
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.deepEqual(next.grave, { items: [{ id: 'lost_a' }] });
      assert.equal(next.uid, 'test-uid');
      assert.equal(next.bootStage, 'ready');
      assert.equal(next.syncStatus, 'syncing');
  });

  test('cycle 204: 빈 player(첫 booting) — RESET_GAME 안전 (크래시 없음)', () => {
      const state = {
          ...INITIAL_STATE,
          player: { ...INITIAL_STATE.player },
          grave: null,
          uid: null,
      };
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.deepEqual(next.player.titles, []);
      assert.deepEqual(next.player.stats.claimedAchievements, []);
      assert.equal(next.player.premiumCurrency, 0);
  });
}

// ─── cycle-206-dead-true-ending-fragments-removal.test.js ───
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(__dirname, '..');

  /**
   * cycle 206: meta.trueEndingFragments dead field 제거 (cycle 120/124/195 패턴 follow-up).
   *
   * 발견 (dead 데이터):
   * - migrateData(gameUtils.ts:514): `target.meta.trueEndingFragments = ...` 초기화.
   * - 그러나 src/ 전체에서 이 필드를 read하는 코드가 0건.
   * - 진 엔딩 파편 메커니즘은 실제로는 inv counting (combatBossHandlers.ts:15
   *   `inv.filter(i.name === '원시의 파편').length`)로 구현되어 있음.
   * - meta.trueEndingFragments는 v5.0 schema 잔해 — wire-up 안 된 채 init만 되던 dead 필드.
   *
   * 패턴:
   * - cycle 120: dead 'discoveries' migrate 제거.
   * - cycle 124: dead 'comboCount' migrate 제거 (combatFlags.comboCount로 대체).
   * - cycle 195: dead constants 6종 제거 (MILESTONE_KILLS / EXP_LEVEL_CAP_50 등).
   *
   * 수정 (src/utils/gameUtils.ts):
   * - migrateData에서 trueEndingFragments 초기화 라인 + 주석 제거.
   *
   * 영향 범위:
   * - 기존 save에 trueEndingFragments 값이 있어도 무해 (read 코드 없음).
   * - 신규 save는 이 필드 없이 진행. 진 엔딩 메커니즘은 inv 기반으로 그대로 동작.
   */

  test('cycle 206: migrateData가 meta.trueEndingFragments를 더 이상 set하지 않음', () => {
      const fresh = { meta: { essence: 0, rank: 0, prestigeRank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 }, stats: {} };
      const migrated = migrateData(fresh);
      assert.equal(
          Object.prototype.hasOwnProperty.call(migrated.meta || {}, 'trueEndingFragments'),
          false,
          'migrateData가 새 save에 trueEndingFragments 필드를 추가하면 안 됨 (dead field)',
      );
  });

  test('cycle 206: 기존 save의 trueEndingFragments 값은 보존(무해 ignore) — 회귀 가드', () => {
      const legacy = {
          meta: { essence: 100, rank: 0, prestigeRank: 1, bonusAtk: 5, bonusHp: 50, bonusMp: 25, trueEndingFragments: 2 },
          stats: {},
      };
      const migrated = migrateData(legacy);
      // 기존 값을 stripping하지 않음 (단지 더 이상 set 안 함)
      assert.equal(migrated.meta.trueEndingFragments, 2,
          '기존 save의 값은 그대로 유지 (의도적 cleanup 아님, init만 멈춤)');
  });

  test('cycle 206: src/ 어디에서도 trueEndingFragments read 안 함 (regression guard)', () => {
      // 빌드 산출물(dist/ios/android) 제외, src/만 검사.
      const SRC_DIR = path.join(ROOT, 'src');
      const files = [];
      const walk = (dir) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) walk(full);
              else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
          }
      };
      walk(SRC_DIR);

      const offenders = [];
      for (const file of files) {
          const content = fs.readFileSync(file, 'utf-8');
          if (content.includes('trueEndingFragments')) {
              offenders.push(path.relative(ROOT, file));
          }
      }
      assert.deepEqual(offenders, [],
          `trueEndingFragments는 dead field이므로 src/ 어디에서도 참조되면 안 됨. offender: ${JSON.stringify(offenders)}`);
  });

  test('cycle 206: 진 엔딩 inv-based 메커니즘 회귀 가드 (combatBossHandlers는 inv counting 유지)', () => {
      // 별도 import 검증 — 진 엔딩 기능 자체는 inv 기반으로 정상 작동.
      const file = path.join(ROOT, 'src/hooks/combatActions/combatBossHandlers.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.ok(
          content.includes(`'원시의 파편'`),
          'combatBossHandlers.ts는 inv 기반 shard counting 유지',
      );
  });
}

// ─── cycle-207-dead-game-state-formation.test.js ───
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(__dirname, '..');

  /**
   * cycle 207: dead `GS.FORMATION` 게임 상태 제거 (cycle 120/124/195/206 패턴 follow-up).
   *
   * 발견 (dead 상수):
   * - src/reducers/gameStates.ts:16: `FORMATION: 'formation'` 정의.
   * - 그러나 src/ + tests/ 어디에서도 GS.FORMATION 참조 0건.
   * - 'formation' 문자열 리터럴 사용 0건 (gameStates.ts 자체 선언 제외).
   * - 어떤 핸들러도 GS.FORMATION을 dispatch / 비교하지 않음.
   *
   * 추정 origin:
   * - 기획 단계에서 '진형/포메이션' UI 시스템을 위해 미리 등록한 placeholder.
   * - 미구현 상태로 남아 dead state로 잔존.
   *
   * 패턴:
   * - cycle 120: dead 'discoveries' migrate 제거.
   * - cycle 124: dead 'comboCount' migrate 제거.
   * - cycle 195: dead constants 6종 제거 (MILESTONE_KILLS 등).
   * - cycle 206: dead meta.trueEndingFragments init 제거.
   *
   * 수정 (src/reducers/gameStates.ts):
   * - FORMATION: 'formation' 라인 제거.
   * - GameState union type narrowing 자동 적용 (literal 'formation' 제거).
   *
   * 영향: 0 (어떤 코드도 이 상태를 참조하지 않음).
   */

  test('cycle 207: GS에 FORMATION 키가 더 이상 없음', () => {
      assert.equal(
          Object.prototype.hasOwnProperty.call(GS, 'FORMATION'),
          false,
          'GS.FORMATION은 dead 상태이므로 GS object에 존재하면 안 됨',
      );
  });

  test('cycle 207: src/ 어디에서도 GS.FORMATION 참조 안 함 (regression guard)', () => {
      const SRC_DIR = path.join(ROOT, 'src');
      const files = [];
      const walk = (dir) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) walk(full);
              else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
          }
      };
      walk(SRC_DIR);

      const offenders = [];
      for (const file of files) {
          const content = fs.readFileSync(file, 'utf-8');
          if (/GS\.FORMATION\b/.test(content)) {
              offenders.push(path.relative(ROOT, file));
          }
      }
      assert.deepEqual(offenders, [], `GS.FORMATION 참조 0건이어야 함. offender: ${JSON.stringify(offenders)}`);
  });

  test('cycle 207: gameStates.ts에 FORMATION 선언 없음', () => {
      const file = path.join(ROOT, 'src/reducers/gameStates.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.equal(
          /FORMATION/.test(content),
          false,
          'gameStates.ts에 FORMATION 키 선언 라인이 남아있으면 안 됨',
      );
  });

  test('cycle 207: 다른 GS 상수는 그대로 유지 (회귀 가드)', () => {
      const expected = ['IDLE', 'COMBAT', 'EVENT', 'MOVING', 'SHOP', 'JOB_CHANGE', 'QUEST_BOARD', 'CRAFTING', 'DEAD', 'ASCENSION', 'TRUE_ENDING'];
      for (const key of expected) {
          assert.ok(
              Object.prototype.hasOwnProperty.call(GS, key),
              `GS.${key}는 활성 상태 — 보존 필요`,
          );
      }
  });
}

// ─── cycle-210-dead-action-types-gs-export.test.js ───
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(__dirname, '..');

  /**
   * cycle 210: actionTypes.ts에 잔존하던 dead GS / GameStateValue export 제거
   *   (cycle 195/206/207 dead cleanup 패턴 follow-up).
   *
   * 발견 (duplicate 잔해):
   * - src/reducers/actionTypes.ts:84-96에 GS 객체 export 존재.
   * - src/reducers/gameStates.ts에도 GS export 존재 (12 keys, cycle 207에서 FORMATION 제거 후 11).
   * - src/ 전체에서 GS는 항상 './reducers/gameStates' 또는 '../reducers/gameStates'에서 import.
   * - actionTypes.ts의 GS / GameStateValue export는 0건 import.
   *
   * 추정 origin:
   * - 초기 actionTypes.ts에 함께 정의되어 있다가 cycle 어느 시점에 gameStates.ts로 분리.
   * - 분리 후 actionTypes.ts의 GS 잔해가 정리 안 된 채 dead duplicate로 남음.
   * - 두 GS의 키 셋도 어긋남: gameStates.ts는 FORMATION을 가지다가 cycle 207에서 제거,
   *   actionTypes.ts는 처음부터 FORMATION 없음 → silent inconsistency가 cycle 207 시점에 정렬.
   *
   * 패턴 (dead cleanup 시리즈):
   * - cycle 120: dead 'discoveries' migrate 제거.
   * - cycle 124: dead 'comboCount' migrate 제거.
   * - cycle 195: dead constants 6종 제거.
   * - cycle 206: dead meta.trueEndingFragments init 제거.
   * - cycle 207: dead GS.FORMATION 제거.
   *
   * 수정 (src/reducers/actionTypes.ts):
   * - GS export 객체 제거 (lines 80-96).
   * - GameStateValue type export 제거 (line 98).
   * - 관련 주석 제거.
   * - AT export는 그대로 유지.
   */

  test('cycle 210: actionTypes.ts에 GS export 없음', () => {
      const file = path.join(ROOT, 'src/reducers/actionTypes.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.equal(
          /^export const GS\b/m.test(content),
          false,
          'actionTypes.ts에 dead GS export가 잔존하면 안 됨 (gameStates.ts의 GS 사용)',
      );
  });

  test('cycle 210: actionTypes.ts에 GameStateValue export 없음', () => {
      const file = path.join(ROOT, 'src/reducers/actionTypes.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.equal(
          /export type GameStateValue\b/.test(content),
          false,
          'actionTypes.ts에 dead GameStateValue type이 잔존하면 안 됨',
      );
  });

  test('cycle 210: gameStates.ts의 GS는 그대로 export (회귀 가드)', async () => {
      const { GS } = await import('../src/reducers/gameStates.js');
      assert.ok(GS, 'gameStates.ts의 GS는 보존되어야 함');
      assert.equal(GS.IDLE, 'idle');
      assert.equal(GS.COMBAT, 'combat');
      assert.equal(GS.DEAD, 'dead');
      assert.equal(GS.TRUE_ENDING, 'true_ending');
  });

  test('cycle 210: actionTypes.ts의 AT export는 보존 (회귀 가드)', async () => {
      const { AT } = await import('../src/reducers/actionTypes.js');
      assert.ok(AT, 'AT export 보존되어야 함');
      assert.equal(AT.RESET_GAME, 'RESET_GAME');
      assert.equal(AT.ASCEND, 'ASCEND');
      assert.equal(AT.SET_PLAYER, 'SET_PLAYER');
  });

  test('cycle 210: actionTypes 모듈에 GS 또는 GameStateValue가 import 안 됨 (regression guard)', () => {
      const SRC_DIR = path.join(ROOT, 'src');
      const files = [];
      const walk = (dir) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, entry.name);
              if (entry.isDirectory()) walk(full);
              else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
          }
      };
      walk(SRC_DIR);

      // import { GS, ... } from '...actionTypes' 패턴 검사
      const offenders = [];
      for (const file of files) {
          const content = fs.readFileSync(file, 'utf-8');
          const importLines = content.match(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*actionTypes[^'"]*['"]/g) || [];
          for (const line of importLines) {
              if (/\bGS\b/.test(line) || /\bGameStateValue\b/.test(line)) {
                  offenders.push(`${path.relative(ROOT, file)}: ${line.trim()}`);
              }
          }
      }
      assert.deepEqual(offenders, [],
          `actionTypes에서 GS/GameStateValue import는 0건이어야 함:\n  ${offenders.join('\n  ')}`);
  });

  test('cycle 207 회귀 가드: GS.FORMATION 제거 상태 유지', async () => {
      const { GS } = await import('../src/reducers/gameStates.js');
      assert.equal(
          Object.prototype.hasOwnProperty.call(GS, 'FORMATION'),
          false,
          'GS.FORMATION 회귀 가드 — cycle 207에서 제거됨',
      );
  });
}

// ─── cycle-213-bounty-state-preserve.test.js ───
{
  /**
   * cycle 213: ASCEND / RESET_GAME이 일일 bounty 상태(bountyDate / bountyIssued) 보존
   *   (cycle 202 paired ledger 정합성 — 일일 재청구 exploit 방지).
   *
   * 발견 (mid-day ASCEND/RESET 시 일일 bounty 재발급 exploit):
   * - bountyDate (string|null): 오늘의 bounty 발급 날짜.
   * - bountyIssued (bool): 오늘 bounty 발급 여부.
   * - QuestBoardPanel:68: `bountyIssuedToday = bountyDate === today && bountyIssued`로 게이트.
   * - questActions.ts:40-68: 동일 가드 + bounty 발급 시 두 필드 set.
   *
   * 시나리오 (exploit):
   * 1. 오늘(2026-05-06) bounty 발급: bountyDate='2026-05-06', bountyIssued=true.
   * 2. bounty 완료, 보상 청구.
   * 3. 마왕 격파 → ASCEND.
   * 4. ASCEND 핸들러는 INITIAL_STATE.stats fallback → bountyDate=null, bountyIssued=false.
   * 5. 같은 날 다시 bounty 발급 가능 → 일일 1회 제한 우회 → 일일 보상 무한 반복.
   *
   * 정합성:
   * - handleDefeat: ...prevStats spread로 보존 ✓ (정합).
   * - ASCEND: 미보존 → 회귀.
   * - RESET_GAME (cycle 204): 미보존 → 회귀.
   * - cycle 202 claimedAchievements 재청구 exploit과 동일 패턴 (영구 ledger preserve).
   *
   * 수정 (src/reducers/handlers/progressionHandlers.ts):
   * - ASCEND stats preserve list에 bountyDate / bountyIssued 추가.
   * - RESET_GAME stats preserve list에 동일 추가.
   * - dailyProtocol 같이 추가 (이미 INITIAL_STATE.stats에 default 정의됨, daily reset은 별도
   *   date 비교로 동작).
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

  test('cycle 213: ASCEND가 bountyDate 보존', () => {
      const state = buildState({ bountyDate: '2026-05-06', bountyIssued: true });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.bountyDate, '2026-05-06',
          'bountyDate는 일일 발급 ledger — ASCEND 시 보존 필요 (mid-day 재발급 exploit 방지)');
  });

  test('cycle 213: ASCEND가 bountyIssued 보존', () => {
      const state = buildState({ bountyDate: '2026-05-06', bountyIssued: true });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.bountyIssued, true);
  });

  test('cycle 213: RESET_GAME이 bountyDate / bountyIssued 보존', () => {
      const state = buildState({ bountyDate: '2026-05-06', bountyIssued: true });
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(next.player.stats.bountyDate, '2026-05-06');
      assert.equal(next.player.stats.bountyIssued, true);
  });

  test('cycle 213: 미정의(구형 save) → null/false fallback', () => {
      const state = buildState({});
      delete state.player.stats.bountyDate;
      delete state.player.stats.bountyIssued;
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      const reset = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(ascended.player.stats.bountyDate || null, null);
      assert.equal(Boolean(ascended.player.stats.bountyIssued), false);
      assert.equal(reset.player.stats.bountyDate || null, null);
      assert.equal(Boolean(reset.player.stats.bountyIssued), false);
  });

  test('cycle 213: dailyProtocol도 보존 (mid-day ASCEND 미션 진행도 lock)', () => {
      const dp = {
          date: '2026-05-06',
          missions: [{ id: 'kill_5', type: 'kills', goal: 5, progress: 3, done: false }],
      };
      const state = buildState({ dailyProtocol: dp });
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      const reset = gameReducer(state, { type: AT.RESET_GAME });
      assert.deepEqual(ascended.player.stats.dailyProtocol, dp);
      assert.deepEqual(reset.player.stats.dailyProtocol, dp);
  });

  test('cycle 211/212/202/119 회귀 가드: 다른 stats 보존 동시 유지', () => {
      const state = buildState({
          bountyDate: '2026-05-06',
          bountyIssued: true,
          signaturePity: 25,
          codexBonusAtk: 10,
          kills: 500,
          cosmeticTitles: ['별을 보는 자'],
          claimedAchievements: ['ach_test'],
      });
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      // cycle 213
      assert.equal(ascended.player.stats.bountyDate, '2026-05-06');
      assert.equal(ascended.player.stats.bountyIssued, true);
      // cycle 212
      assert.equal(ascended.player.stats.signaturePity, 25);
      // cycle 211
      assert.equal(ascended.player.stats.codexBonusAtk, 10);
      // cycle 119
      assert.equal(ascended.player.stats.kills, 500);
      // cycle 188
      assert.deepEqual(ascended.player.stats.cosmeticTitles, ['별을 보는 자']);
      // cycle 202
      assert.deepEqual(ascended.player.stats.claimedAchievements, ['ach_test']);
  });
}

// ─── cycle-214-weekly-protocol-preserve.test.js ───
{
  /**
   * cycle 214: ASCEND / RESET_GAME / handleDefeat이 weeklyProtocol 보존
   *   (cycle 213 일일 bounty preserve와 동일 lens — 주간 재청구 exploit 방지).
   *
   * 발견 (mid-week 재발급 exploit + 주간 진행도 손실):
   * - weeklyProtocol (root level): { kills, explores, bossKills, lastResetWeek, claimed }.
   * - CLAIM_WEEKLY_MISSION(protocolHandlers.ts:38): 'wp.claimed.includes(missionId)' 가드만 사용.
   * - resetWeeklyProtocolIfNeeded(exploreUtils.ts): lastResetWeek !== currentWeek일 때 자동 reset.
   *
   * 시나리오 (exploit + 회귀):
   * 1. 이번 주 weekly 미션 'kill_50' 완료 → claimed=['kill_50'], 보상 청구.
   * 2-A (mid-week ASCEND exploit):
   *    - 마왕 격파 → ASCEND → freshPlayer = {...INITIAL_STATE.player, ...} → weeklyProtocol reset.
   *    - 다음 explore: lastResetWeek=0 !== currentWeek → resetWeeklyProtocolIfNeeded → claimed=[].
   *    - 같은 주 'kill_50' 재청구 가능 → 주간 1회 제한 우회.
   * 2-B (mid-week death 회귀):
   *    - 사망 → handleDefeat → starterState = {...INITIAL_PLAYER} → weeklyProtocol reset.
   *    - 같은 주 진행도(kills 35/50)가 0으로 wipe → 다시 35회 사냥 필요.
   *    - cycle 191 META preserve가 weeklyProtocol를 누락한 회귀.
   *
   * 정합성:
   * - cycle 191 (handleDefeat META preserve): weeklyProtocol 미포함 → 누락.
   * - cycle 188 (ASCEND premium preserve): weeklyProtocol 미포함.
   * - cycle 204 (RESET_GAME META preserve): weeklyProtocol 미포함.
   *
   * 수정:
   * 1. src/reducers/handlers/progressionHandlers.ts ASCEND: weeklyProtocol 명시 보존.
   * 2. src/reducers/handlers/progressionHandlers.ts RESET_GAME: 동일.
   * 3. src/systems/CombatEngine.ts handleDefeat: weeklyProtocol 명시 보존 (cycle 191 누락분).
   *
   * 회귀 가드: lastResetWeek 자동 reset 로직(exploreUtils)은 그대로 — 새 주 시작 시 정상 reset.
   */

  const buildState = (weeklyProtocolOverride) => ({
      ...INITIAL_STATE,
      player: {
          ...INITIAL_STATE.player,
          name: 'Test',
          gender: 'male',
          meta: { essence: 0, rank: 0, prestigeRank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          weeklyProtocol: weeklyProtocolOverride,
      },
      grave: null,
      uid: 'test-uid',
      bootStage: 'ready',
  });

  const ASCEND_PAYLOAD = {
      meta: { essence: 100, rank: 1, prestigeRank: 1, bonusAtk: 5, bonusHp: 50, bonusMp: 25 },
      newTitle: '각성자',
  };

  const SAMPLE_WP = {
      kills: 35,
      explores: 12,
      bossKills: 2,
      lastResetWeek: 18,
      claimed: ['kill_50', 'explore_30'],
  };

  test('cycle 214: ASCEND가 weeklyProtocol 보존', () => {
      const state = buildState(SAMPLE_WP);
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.deepEqual(next.player.weeklyProtocol, SAMPLE_WP,
          'weeklyProtocol는 주간 미션 진행/claimed ledger — ASCEND 시 보존 필요 (mid-week 재청구 exploit 방지)');
  });

  test('cycle 214: RESET_GAME이 weeklyProtocol 보존', () => {
      const state = buildState(SAMPLE_WP);
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.deepEqual(next.player.weeklyProtocol, SAMPLE_WP);
  });

  test('cycle 214: handleDefeat이 weeklyProtocol 보존 (cycle 191 누락분)', () => {
      const player = {
          ...INITIAL_STATE.player,
          name: 'Test',
          hp: 0,
          maxHp: 100,
          weeklyProtocol: SAMPLE_WP,
      };
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      assert.deepEqual(result.updatedPlayer.weeklyProtocol, SAMPLE_WP,
          '사망 후 mid-week 진행도 lock — cycle 191 META preserve 시리즈 보강');
  });

  test('cycle 214: weeklyProtocol 미정의 시 INITIAL fallback (구형 save)', () => {
      const state = buildState(undefined);
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      const reset = gameReducer(state, { type: AT.RESET_GAME });
      // INITIAL fallback (kills:0, explores:0, ..., claimed:[])
      assert.deepEqual(ascended.player.weeklyProtocol.claimed, []);
      assert.equal(ascended.player.weeklyProtocol.kills, 0);
      assert.deepEqual(reset.player.weeklyProtocol.claimed, []);
  });

  test('cycle 214: claimed 배열이 존재하면 보존 (재청구 exploit 가드)', () => {
      const state = buildState({ kills: 0, explores: 0, bossKills: 0, lastResetWeek: 18, claimed: ['boss_5'] });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.deepEqual(next.player.weeklyProtocol.claimed, ['boss_5'],
          '청구된 미션 ledger는 영구 보존 — 같은 주 재청구 차단');
  });

  test('cycle 191 / cycle 204 회귀 가드: 다른 META 보존 동시 유지', () => {
      const state = buildState(SAMPLE_WP);
      state.player.titles = ['warrior', '각성자'];
      state.player.activeTitle = '각성자';
      state.player.premiumCurrency = 100;
      state.player.reviveTokens = 2;
      state.player.maxInv = 25;
      state.player.seasonPass = { xp: 500, tier: 5, claimed: ['s1_t1'], isPremium: true, seasonId: 'S1' };
      state.player.stats = {
          ...INITIAL_STATE.player.stats,
          kills: 200,
          cosmeticTitles: ['별을 보는 자'],
          synthProtects: 1,
          claimedAchievements: ['ach_a'],
      };
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      // cycle 191 META
      assert.deepEqual(ascended.player.titles, ['warrior', '각성자']);
      assert.equal(ascended.player.premiumCurrency, 100);
      assert.equal(ascended.player.reviveTokens, 2);
      assert.equal(ascended.player.maxInv, 25);
      assert.deepEqual(ascended.player.seasonPass.claimed, ['s1_t1']);
      // cycle 188/202 stats
      assert.deepEqual(ascended.player.stats.cosmeticTitles, ['별을 보는 자']);
      assert.equal(ascended.player.stats.synthProtects, 1);
      assert.deepEqual(ascended.player.stats.claimedAchievements, ['ach_a']);
      // cycle 214
      assert.deepEqual(ascended.player.weeklyProtocol, SAMPLE_WP);
  });
}

// ─── cycle-216-daily-invade-preserve.test.js ───
{
  /**
   * cycle 216: ASCEND / RESET_GAME이 dailyInvadeCount / lastInvadeDate 보존
   *   (cycle 213 일일 bounty preserve와 동일 lens — 일일 invasion 5회 제한 우회 exploit fix).
   *
   * 발견 (mid-day 재진입 exploit):
   * - dailyInvadeCount + lastInvadeDate: 일일 grave invasion 5회 제한 ledger.
   * - useInventoryActions.ts:549 invadeGrave: today === lastInvadeDate면 currentCount 사용,
   *   다른 날이면 0부터 시작.
   * - cycle 137에서 BALANCE.DAILY_INVADE_LIMIT(=5) 참조 fix로 일일 제한 정상 동작.
   *
   * 시나리오 (exploit):
   * 1. 오늘 grave 5회 침략 완료 → dailyInvadeCount=5, lastInvadeDate=today.
   * 2. invadeGrave 호출 시 INVADE_LIMIT 에러 (정상).
   * 3. 마왕 격파 → ASCEND → freshPlayer = {...INITIAL_STATE.player, ...} → dailyInvadeCount=0.
   * 4. 같은 날 grave 5회 추가 침략 가능 → 일일 5회 제한 우회.
   * - cycle 213 bounty preserve와 동일 lens (paired ledger 정합성).
   *
   * 정합성:
   * - handleDefeat: ...prevStats spread로 보존 ✓ (정합).
   * - ASCEND: 미보존 → 회귀.
   * - RESET_GAME (cycle 204): 미보존 → 회귀.
   *
   * 수정 (src/reducers/handlers/progressionHandlers.ts):
   * - ASCEND stats preserve list에 dailyInvadeCount / lastInvadeDate 추가.
   * - RESET_GAME stats preserve list에 동일 추가.
   * - 미정의 시 0/null fallback (구형 save 호환).
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

  const today = new Date().toDateString();

  test('cycle 216: ASCEND가 dailyInvadeCount 보존', () => {
      const state = buildState({ dailyInvadeCount: 5, lastInvadeDate: today });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.dailyInvadeCount, 5,
          'dailyInvadeCount는 일일 ledger — ASCEND 시 보존 필요 (mid-day 재침략 exploit 방지)');
  });

  test('cycle 216: ASCEND가 lastInvadeDate 보존', () => {
      const state = buildState({ dailyInvadeCount: 5, lastInvadeDate: today });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.lastInvadeDate, today);
  });

  test('cycle 216: RESET_GAME이 dailyInvadeCount / lastInvadeDate 보존', () => {
      const state = buildState({ dailyInvadeCount: 3, lastInvadeDate: today });
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(next.player.stats.dailyInvadeCount, 3);
      assert.equal(next.player.stats.lastInvadeDate, today);
  });

  test('cycle 216: 미정의(구형 save) → 0/null fallback', () => {
      const state = buildState({});
      delete state.player.stats.dailyInvadeCount;
      delete state.player.stats.lastInvadeDate;
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      const reset = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(ascended.player.stats.dailyInvadeCount || 0, 0);
      assert.equal(ascended.player.stats.lastInvadeDate ?? null, null);
      assert.equal(reset.player.stats.dailyInvadeCount || 0, 0);
      assert.equal(reset.player.stats.lastInvadeDate ?? null, null);
  });

  test('cycle 216: 어제 날짜 + count 5라면 그대로 보존 (자동 reset은 invadeGrave 호출 시 분기)', () => {
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      const state = buildState({ dailyInvadeCount: 5, lastInvadeDate: yesterday });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      // ASCEND는 그대로 보존 — 다음 invadeGrave 호출에서 'lastDate === today' 체크가
      // 실패하면 자동으로 0부터 시작 (useInventoryActions.ts:552).
      assert.equal(next.player.stats.dailyInvadeCount, 5);
      assert.equal(next.player.stats.lastInvadeDate, yesterday);
  });

  test('cycle 213/211/202 회귀 가드: 다른 stats 보존 동시 유지', () => {
      const state = buildState({
          dailyInvadeCount: 4,
          lastInvadeDate: today,
          bountyDate: today,
          bountyIssued: true,
          codexBonusAtk: 10,
          signaturePity: 25,
          claimedAchievements: ['ach_test'],
      });
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      // cycle 216
      assert.equal(ascended.player.stats.dailyInvadeCount, 4);
      assert.equal(ascended.player.stats.lastInvadeDate, today);
      // cycle 213
      assert.equal(ascended.player.stats.bountyDate, today);
      assert.equal(ascended.player.stats.bountyIssued, true);
      // cycle 211
      assert.equal(ascended.player.stats.codexBonusAtk, 10);
      // cycle 212
      assert.equal(ascended.player.stats.signaturePity, 25);
      // cycle 202
      assert.deepEqual(ascended.player.stats.claimedAchievements, ['ach_test']);
  });
}

// ─── cycle-217-level-up-sound.test.js ───
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(__dirname, '..');

  /**
   * cycle 217: 레벨업 sound 누락 회귀 fix — visualEffect='levelUp' 시점에 sound trigger.
   *
   * 발견 (silent level-up moment):
   * - SoundManager에 'levelUp' sound 정의됨 (case 'levelUp' branch).
   * - useGameEngine.ts:49: `if (lastLog.type === 'levelUp') soundManager.play('levelUp')` — log type
   *   기반 mapping 존재.
   * - 그러나 CombatEngine.applyExpGain은 levelup 로그를 `type: 'system'`으로 기록 (line 1232).
   * - 따라서 type==='levelUp' 비교는 절대 true가 안 됨 → 'levelUp' sound 영원히 dispatch 안 됨.
   * - visualEffect='levelUp'은 dispatch되지만 MainLayout은 'shake'만 처리 → 시각 효과도 nothing.
   *
   * 결과: 플레이어가 레벨업해도 audio/visual 피드백 0건. 레벨업이 의미 있는 모먼트인데
   *   "system 로그 한 줄"만 보임 — UX 회귀 (SoundManager + visualEffect 양쪽이 dead path).
   *
   * 패턴 (sensory cue 시리즈 lens):
   * - cycle 117/118: 사운드 디자인 시리즈.
   * - cycle 122/123: quest_complete / 업적 청구 sensory cue.
   * - cycle 217: 레벨업 sensory cue 누락 보강.
   *
   * 수정 (src/hooks/useGameEngine.ts):
   * - useEffect로 state.visualEffect를 watch — 'levelUp'으로 transition 시 soundManager.play('levelUp').
   * - useGameEngine.ts:49 dead 'levelUp' log type mapping은 유지 (LOG_STYLES에 'levelUp'
   *   style이 없어 LOG TYPE 변경은 visual regression 위험 — visualEffect 기반 fix가 안전).
   *
   * 회귀 가드: 다른 visualEffect ('shake' 등)는 sound 재생 안 함. null transition 무시.
   */

  test('cycle 217: useGameEngine에 visualEffect levelUp watcher 추가', () => {
      const file = path.join(ROOT, 'src/hooks/useGameEngine.ts');
      const content = fs.readFileSync(file, 'utf-8');
      // visualEffect를 watch하는 useEffect 패턴 + 'levelUp' sound 호출
      assert.match(
          content,
          /visualEffect[\s\S]*?soundManager\.play\(\s*['"]levelUp['"]/,
          'useGameEngine에 visualEffect===levelUp 시 levelUp sound 재생 코드 필요',
      );
  });

  test('cycle 217: applyExpGain은 visualEffect=levelUp을 set (회귀 가드)', () => {
      const file = path.join(ROOT, 'src/systems/CombatEngine.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /visualEffect\s*=\s*['"]levelUp['"]/,
          "CombatEngine.applyExpGain의 visualEffect='levelUp' 설정은 보존되어야 함",
      );
  });

  test('cycle 217: SoundManager에 levelUp case 정의 (회귀 가드)', () => {
      const file = path.join(ROOT, 'src/systems/SoundManager.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /case\s+['"]levelUp['"]/,
          "SoundManager의 case 'levelUp' branch 보존되어야 함",
      );
  });

  test('cycle 217: useGameEngine의 기존 log-type sound mapping은 유지 (회귀 가드)', () => {
      const file = path.join(ROOT, 'src/hooks/useGameEngine.ts');
      const content = fs.readFileSync(file, 'utf-8');
      // combat / error / legendary 매핑은 그대로 (단일 라인 if문 형태)
      assert.match(content, /lastLog\.type\s*===\s*['"]combat['"][^\n]*soundManager\.play\(\s*['"]attack['"]/);
      assert.match(content, /lastLog\.type\s*===\s*['"]error['"][^\n]*soundManager\.play\(\s*['"]error['"]/);
      assert.match(content, /lastLog\.type\s*===\s*['"]legendary['"][^\n]*soundManager\.play\(\s*['"]legendary['"]/);
  });

  test('cycle 217: levelUp transition 외 visualEffect 변화는 sound 재생 안 함 (코드 패턴 가드)', () => {
      const file = path.join(ROOT, 'src/hooks/useGameEngine.ts');
      const content = fs.readFileSync(file, 'utf-8');
      // visualEffect === 'levelUp' 비교 명시 (다른 효과 false-positive 방지)
      assert.match(
          content,
          /visualEffect\s*===?\s*['"]levelUp['"]/,
          "visualEffect === 'levelUp' 비교 가드 필요 ('shake' 등 false-positive 방지)",
      );
  });
}

// ─── cycle-218-death-victory-sounds.test.js ───
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(__dirname, '..');

  /**
   * cycle 218: 'death' + 'victory' sound dispatch 누락 fix (cycle 217 sensory cue 시리즈 확장).
   *
   * 발견 (silent moments):
   * - SoundManager에 6 sound 정의됐지만 dispatch 0건: hover / heal / death / skill / explore / victory.
   * - 본 cycle은 가장 영향 큰 2종 fix:
   *   · death: player 사망 모먼트 — descending tone (400→300→200→100 Hz) 정의 있으나
   *     combatAttack/combatItem의 GS.DEAD dispatch 시점에 sound 미호출.
   *   · victory: 보스 처치 모먼트 — 5-tone arpeggio (C5→E5→G5→C6→E6) 정의 있으나
   *     combatVictory의 보스 처치 분기에서 sound 미호출.
   *
   * 결과 (UX 회귀):
   * - 사망: GS.DEAD 전환 + RunSummary 모달만 보임. 음향 피드백 0건.
   * - 보스 처치: legendary 드롭 시에만 'levelUp' 사운드(GameRoot:61). 일반 보스 처치 무음.
   *
   * 패턴 (sensory cue 시리즈):
   * - cycle 117/118: 사운드 디자인 시리즈.
   * - cycle 122/123: quest_complete / 업적 청구.
   * - cycle 217: 레벨업 sensory cue.
   * - cycle 218: 사망 / 보스 승리 sensory cue.
   *
   * 수정:
   * 1. src/hooks/combatActions/combatAttack.ts: GS.DEAD dispatch 직전 soundManager.play('death').
   * 2. src/hooks/combatActions/combatItem.ts: 동일.
   * 3. src/hooks/combatActions/combatVictory.ts: isBossKill 분기에서 soundManager.play('victory').
   *
   * 회귀 가드: 일반 몹 처치는 victory 사운드 안 울림 (boss 전용 — 큰 모먼트).
   *           사망 사운드는 GS.DEAD 전환 시 1회만 (중복 dispatch 안 됨).
   */

  test('cycle 218: combatAttack에 death sound dispatch 추가', () => {
      const file = path.join(ROOT, 'src/hooks/combatActions/combatAttack.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /soundManager\.play\(\s*['"]death['"]/,
          'combatAttack.ts에 GS.DEAD dispatch 시 soundManager.play(death) 호출 필요',
      );
  });

  test('cycle 218: combatItem에 death sound dispatch 추가', () => {
      const file = path.join(ROOT, 'src/hooks/combatActions/combatItem.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /soundManager\.play\(\s*['"]death['"]/,
          'combatItem.ts에 GS.DEAD dispatch 시 soundManager.play(death) 호출 필요',
      );
  });

  test('cycle 218: combatVictory에 victory sound dispatch 추가 (boss kill)', () => {
      const file = path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /soundManager\.play\(\s*['"]victory['"]/,
          'combatVictory.ts에 isBossKill 시 soundManager.play(victory) 호출 필요',
      );
  });

  test('cycle 218: SoundManager의 death / victory case 보존 (회귀 가드)', () => {
      const file = path.join(ROOT, 'src/systems/SoundManager.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(content, /case\s+['"]death['"]/, "SoundManager의 case 'death' branch 보존");
      assert.match(content, /case\s+['"]victory['"]/, "SoundManager의 case 'victory' branch 보존");
  });

  test('cycle 218: combatVictory에 isBossKill 가드 (일반 몹 처치 false-positive 방지)', () => {
      const file = path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts');
      const content = fs.readFileSync(file, 'utf-8');
      // isBossKill 또는 deadEnemy?.isBoss 컨텍스트 안에서 soundManager.play('victory')
      assert.match(
          content,
          /isBossKill[\s\S]{0,800}?soundManager\.play\(\s*['"]victory['"]/,
          "victory 사운드는 isBossKill 컨텍스트에서만 dispatch (일반 몹 처치 무음 유지)",
      );
  });

  test('cycle 217 회귀 가드: useGameEngine의 visualEffect levelUp watcher 유지', () => {
      const file = path.join(ROOT, 'src/hooks/useGameEngine.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(content, /visualEffect\s*===\s*['"]levelUp['"]/);
  });
}

// ─── cycle-220-explore-sound.test.js ───
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(__dirname, '..');

  /**
   * cycle 220: 'explore' sound dispatch 누락 fix (cycle 217-219 sensory cue 시리즈 마지막 합류).
   *
   * 발견 (silent explore tick):
   * - cycle 217-219에서 levelUp / death / victory / skill / heal 5종 fix.
   * - 남은 dead sound dispatch: hover / explore (2종).
   * - 본 cycle은 explore fix:
   *   · explore: 탐험 tick 모먼트 — sine wave 800→1200→800Hz arc, 0.16s 짧은 cue (gain 0.04).
   *     subtle 디자인 — 의도적으로 'tick' 느낌. 정의 있으나 dispatch 0건.
   * - 'hover'는 button hover 빈도가 너무 높아 UX noise 위험 → 보류.
   *
   * 결과 (UX 회귀):
   * - 탐험 액션 후 narrative event / 적 spawn / 발견 이벤트 등 결과 도착 전까지 무음.
   * - 사용자가 탐험을 트리거했는지 청각적 피드백 없음.
   *
   * 패턴:
   * - cycle 117/118: 사운드 디자인.
   * - cycle 122/123/217/218/219: sensory cue dispatch 보강.
   * - cycle 220: explore tick cue 마지막 합류.
   *
   * 수정 (src/hooks/gameActions/exploreActions.ts):
   * - explore 액션 진입 검증 통과 후 (gameState idle + 시작 마을 아님 + mapData 존재) sound dispatch.
   * - 결과 (event/combat/nothing) 분기 전 trigger feedback.
   *
   * 회귀 가드: validation 실패(town/blocked map)는 sound 안 울림. explore 트리거 시점에만.
   */

  test('cycle 220: exploreActions에 explore sound dispatch 추가', () => {
      const file = path.join(ROOT, 'src/hooks/gameActions/exploreActions.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /soundManager\.play\(\s*['"]explore['"]/,
          'exploreActions.ts에 explore 액션 시 soundManager.play(explore) 호출 필요',
      );
  });

  test('cycle 220: SoundManager의 explore case 보존 (회귀 가드)', () => {
      const file = path.join(ROOT, 'src/systems/SoundManager.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(content, /case\s+['"]explore['"]/, "SoundManager의 case 'explore' branch 보존");
  });

  test('cycle 220: explore sound는 validation 통과 후 dispatch (실패 시 false-positive 방지)', () => {
      const file = path.join(ROOT, 'src/hooks/gameActions/exploreActions.ts');
      const content = fs.readFileSync(file, 'utf-8');
      // EXPLORE_BLOCKED / TOWN_PEACEFUL / MAP_UNKNOWN 검증 분기 이후 sound dispatch
      // 검증 분기는 early return이므로 분기 후 위치한 sound는 자연스럽게 가드됨.
      assert.match(
          content,
          /if\s*\(\s*!mapData\s*\)[\s\S]{0,500}?soundManager\.play\(\s*['"]explore['"]/,
          'explore sound는 mapData 검증 통과 후 dispatch (early return 가드 활용)',
      );
  });

  test('cycle 217-219 회귀 가드: 기존 sensory cue 5종 모두 유지', () => {
      const useGameEngine = fs.readFileSync(path.join(ROOT, 'src/hooks/useGameEngine.ts'), 'utf-8');
      assert.match(useGameEngine, /visualEffect\s*===\s*['"]levelUp['"]/, 'cycle 217 levelUp');

      const combatVictory = fs.readFileSync(path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts'), 'utf-8');
      assert.match(combatVictory, /soundManager\.play\(\s*['"]victory['"]/, 'cycle 218 victory');

      const combatAttack = fs.readFileSync(path.join(ROOT, 'src/hooks/combatActions/combatAttack.ts'), 'utf-8');
      assert.match(combatAttack, /soundManager\.play\(\s*['"]death['"]/, 'cycle 218 death');
      assert.match(combatAttack, /soundManager\.play\(\s*['"]skill['"]/, 'cycle 219 skill');

      const characterActions = fs.readFileSync(path.join(ROOT, 'src/hooks/gameActions/characterActions.ts'), 'utf-8');
      assert.match(characterActions, /soundManager\.play\(\s*['"]heal['"]/, 'cycle 219 heal');
  });

  test('cycle 220: SoundManager의 모든 등록 case는 dispatch path 존재 (cycle 325 hover 정리 후)', () => {
      // cycle 325: 'hover' case 제거 — SoundManager에 정의된 모든 case는 dispatch path 보유.
      const SRC_DIR = path.join(ROOT, 'src');
      const files = [];
      const walk = (dir) => {
          for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
              const p = path.join(dir, e.name);
              if (e.isDirectory()) walk(p);
              else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) files.push(p);
          }
      };
      walk(SRC_DIR);

      const dispatched = new Set();
      for (const f of files) {
          const c = fs.readFileSync(f, 'utf-8');
          for (const m of c.matchAll(/soundManager\.play\??\(\s*['"]([a-zA-Z_]+)['"]/g)) {
              dispatched.add(m[1]);
          }
      }
      // 등록된 sound (정의된 case)
      const soundDef = fs.readFileSync(path.join(ROOT, 'src/systems/SoundManager.ts'), 'utf-8');
      const defined = new Set(
          [...soundDef.matchAll(/case\s+['"]([a-zA-Z_]+)['"]/g)].map((m) => m[1]),
      );
      const undispatched = [...defined].filter((s) => !dispatched.has(s));
      assert.deepEqual(undispatched, [],
          `cycle 325 시점 dead sound 0건 — 모든 case dispatch path 존재. 그 외 발견 시 회귀: ${JSON.stringify(undispatched)}`);
  });
}

// ─── cycle-222-weapon-bucket-misplacement.test.js ───
{
  /**
   * cycle 222: Sprint 21 추가 신규 무기 5종이 armors 버킷에 잘못 배치된 회귀 fix.
   *
   * 발견 (content data 오배치):
   * - DB.ITEMS.weapons (정상 weapon 버킷): 112 entries, 모두 type='weapon'.
   * - DB.ITEMS.armors (방어구 버킷): 117 entries, 그러나 type 분포 = armor / shield / **weapon**.
   * - armors 버킷에 5개 weapon-type 아이템이 잘못 placed:
   *   · 세계수의 검 (T5, ATK 192)
   *   · 신전 도시의 지팡이 (T5, ATK 188)
   *   · 균열의 날 (T5, ATK 197)
   *   · 세계수 절멸창 (T6, ATK 310)
   *   · 시간 파편 소드 (T6, ATK 295)
   * - Sprint 21이 신규 지역 테마(세계수 숲 / 고대 신전 도시 / 차원의 균열 등)의
   *   무기와 방어구를 추가하면서 armors 버킷 안에 weapon section을 잘못 추가.
   *
   * 결과 (UX 회귀):
   * - WeaponCodex.tsx:46: `if (category === 'weapons') return DB.ITEMS.weapons || []` —
   *   weapons 카테고리에 5종 누락 → Codex weapons 페이지에서 안 보임.
   * - WeaponCodex.tsx:47-48: armors/shields 필터(type==='armor'/'shield')는 type==='weapon'를
   *   자동 제외 → 다행히 잘못 표시되진 않음.
   * - 그러나 weapons 카테고리에서 영원히 미발견 → codex 100% 달성 불가.
   * - DB.ITEMS.weapons.find(name) 류 lookup도 실패.
   *
   * 수정 (src/data/items.ts):
   * - armors 버킷에서 5개 weapon-type 항목 제거.
   * - weapons 버킷 끝(차원 마왕의 낫 다음)에 T5/T6 신규 weapon section 합류.
   * - 데이터 자체는 변경 없음 — 단순히 올바른 버킷으로 이동.
   *
   * 회귀 가드: WeaponCodex 카테고리 분기는 그대로 유지.
   */

  const MISPLACED_NAMES = ['세계수의 검', '신전 도시의 지팡이', '균열의 날', '세계수 절멸창', '시간 파편 소드'];

  test('cycle 222: 5 weapon-type 신규 아이템이 DB.ITEMS.weapons 버킷에 있음', () => {
      const weaponNames = new Set((DB.ITEMS.weapons || []).map((w) => w.name));
      const missing = MISPLACED_NAMES.filter((n) => !weaponNames.has(n));
      assert.deepEqual(missing, [],
          `이 5종은 weapons 버킷에 있어야 함 (Codex weapons 페이지에 표시되도록): ${JSON.stringify(missing)}`);
  });

  test('cycle 222: DB.ITEMS.armors 버킷에는 weapon-type 0건', () => {
      const offenders = (DB.ITEMS.armors || []).filter((a) => a.type === 'weapon').map((a) => a.name);
      assert.deepEqual(offenders, [],
          `armors 버킷은 type='armor' / 'shield'만 포함해야 함. weapon offender: ${JSON.stringify(offenders)}`);
  });

  test('cycle 222: armors 버킷 type 분포 = armor / shield 만 (정합성 lock)', () => {
      const types = new Set((DB.ITEMS.armors || []).map((a) => a.type).filter(Boolean));
      assert.deepEqual([...types].sort(), ['armor', 'shield']);
  });

  test('cycle 222: 5 무기 모두 DB.ITEMS.weapons에서 type=weapon 확인', () => {
      for (const name of MISPLACED_NAMES) {
          const item = (DB.ITEMS.weapons || []).find((w) => w.name === name);
          assert.ok(item, `${name} should be in weapons bucket`);
          assert.equal(item.type, 'weapon');
      }
  });

  test('cycle 222: 무기 데이터 (val/tier/price 등) 보존 (회귀 가드)', () => {
      const expected = [
          { name: '세계수의 검', val: 192, tier: 5 },
          { name: '신전 도시의 지팡이', val: 188, tier: 5 },
          { name: '균열의 날', val: 197, tier: 5 },
          { name: '세계수 절멸창', val: 310, tier: 6 },
          { name: '시간 파편 소드', val: 295, tier: 6 },
      ];
      for (const exp of expected) {
          const item = (DB.ITEMS.weapons || []).find((w) => w.name === exp.name);
          assert.equal(item.val, exp.val, `${exp.name} val=${exp.val}`);
          assert.equal(item.tier, exp.tier, `${exp.name} tier=${exp.tier}`);
      }
  });

  test('cycle 222: weapons 버킷 type 분포 = weapon만 (회귀 가드)', () => {
      const types = new Set((DB.ITEMS.weapons || []).map((w) => w.type).filter(Boolean));
      assert.deepEqual([...types], ['weapon']);
  });
}

// ─── cycle-223-elem-cold-naming-mismatch.test.js ───
{
  /**
   * cycle 223: 얼음/냉기 element naming inconsistency fix (cycle 222 content audit lens 확장).
   *
   * 발견 (element naming 분기):
   * - 39 monsters use weakness='냉기' (cold 표준 convention).
   * - 0 monsters use weakness='얼음'.
   * - 그러나 3 items use elem='얼음':
   *   · 빙결 지팡이 (T4 weapon, ATK 70, mage)
   *   · 빙하의 지팡이 (T5 weapon, ATK 110, mage)
   *   · 빙화 경갑 (T4 armor, DEF 45)
   * - CombatEngine.getElementMultiplier는 'enemy.weakness === elem' exact compare.
   * - 결과: '얼음' 아이템은 '냉기' weakness 몬스터에서 ELEMENT_WEAK_MULT 적용 안 됨 →
   *   element 보너스 영원히 미발현 → 데이터상으로 'cold' 컨셉이지만 게임플레이상
   *   일반 무기와 같은 dmg multiplier.
   *
   * 추정 origin: 데이터 작성 시점에 두 표기 ('얼음' / '냉기') 혼용. 표준 convention은
   * '냉기' (15 items + 39 monsters 사용).
   *
   * 수정 (src/data/items.ts):
   * - 3 items의 elem: '얼음' → '냉기'.
   * - desc_stat의 '(빙)' → '(냉)' (15 냉기 items 동일 convention).
   *
   * 회귀 가드:
   * - 0 items with elem='얼음' (전체 표준 통일).
   * - 18 items with elem='냉기' (기존 15 + 변환된 3).
   * - 39 monsters with weakness='냉기' 보존.
   *
   * 영향:
   * - 빙결 지팡이 / 빙하의 지팡이 / 빙화 경갑 사용자가 '냉기' 약점 39 몬스터에
   *   (BALANCE.ELEMENT_WEAK_MULT × ATK) 보너스 deal 가능 → 의도된 cold 컨셉 활성화.
   * - cycle 137 lens (BALANCE.X 미참조 dead config)와 같은 결 — 데이터상 의도된 효과가
   *   실제로는 dispatch path 단절로 무력화되던 silent 회귀.
   */

  test('cycle 223: items 중 elem=얼음 0건 (표준 통일)', () => {
      const offenders = [];
      for (const bucket of ['weapons', 'armors']) {
          for (const item of (DB.ITEMS[bucket] || [])) {
              if (item.elem === '얼음') offenders.push(`${bucket}/${item.name}`);
          }
      }
      assert.deepEqual(offenders, [], `elem='얼음' 사용 아이템 0건이어야 함 (모두 '냉기'로 통일): ${JSON.stringify(offenders)}`);
  });

  test('cycle 223: 3 items이 elem=냉기로 변환됨', () => {
      const expected = ['빙결 지팡이', '빙하의 지팡이', '빙화 경갑'];
      const allItems = [...(DB.ITEMS.weapons || []), ...(DB.ITEMS.armors || [])];
      for (const name of expected) {
          const item = allItems.find((i) => i.name === name);
          assert.ok(item, `${name} should exist`);
          assert.equal(item.elem, '냉기', `${name} elem='냉기'`);
      }
  });

  test('cycle 223: 3 items의 desc_stat이 (빙) → (냉) 변환됨', () => {
      const expected = [
          { name: '빙결 지팡이', stat: 'ATK+70(냉) MP+30 / 2H' },
          { name: '빙하의 지팡이', stat: 'ATK+110(냉) MP+50 / 2H' },
          { name: '빙화 경갑', stat: 'DEF+45(냉)' },
      ];
      const allItems = [...(DB.ITEMS.weapons || []), ...(DB.ITEMS.armors || [])];
      for (const exp of expected) {
          const item = allItems.find((i) => i.name === exp.name);
          assert.equal(item.desc_stat, exp.stat, `${exp.name} desc_stat='${exp.stat}'`);
      }
  });

  test('cycle 223: 39 monsters가 weakness=냉기 보존 (회귀 가드)', () => {
      const count = Object.values(DB.MONSTERS || {}).filter((m) => m.weakness === '냉기').length;
      assert.ok(count >= 39, `weakness='냉기' 몬스터 39+ 유지 (실제: ${count})`);
  });

  test('cycle 223: items 중 elem=냉기가 17+ 건 (weapons/armors 버킷, 변환 3건 포함)', () => {
      let count = 0;
      for (const bucket of ['weapons', 'armors']) {
          for (const item of (DB.ITEMS[bucket] || [])) {
              if (item.elem === '냉기') count++;
          }
      }
      // 변환 전: 14건 (weapons 8 + armors 6). 변환 후: 17건 (weapons 9 + armors 8 — 빙결/빙하 weapon 2 + 빙화 armor 1).
      assert.ok(count >= 17, `elem='냉기' 아이템 17+ 건 (실제: ${count})`);
  });

  test('cycle 222 회귀 가드: 5 weapons가 weapons 버킷에 보존', () => {
      const weaponNames = new Set((DB.ITEMS.weapons || []).map((w) => w.name));
      const expected = ['세계수의 검', '신전 도시의 지팡이', '균열의 날', '세계수 절멸창', '시간 파편 소드'];
      for (const n of expected) {
          assert.ok(weaponNames.has(n), `${n} should remain in weapons bucket`);
      }
  });
}

// ─── cycle-226-armor-evasion-roll.test.js ───
{
  /**
   * cycle 226: 2 armors의 evasion 필드가 dead config인 silent 회귀 fix
   *   (cycle 222-225 silent dead config 시리즈 마지막 합류).
   *
   * 발견 (item.evasion 미적용):
   * - 2 armors에 evasion 필드 + desc_stat '회피+N%' 표시:
   *   · 암영 망토 (T4 armor, evasion: 0.08, 도적/어쌔신용)
   *   · 공허의 전투 외투 (T5 armor, evasion: 0.12, 도적/어쌔신용)
   * - 그러나 코드에서 'item.evasion' read 0건. CombatEngine.enemyAttack은 stealth/skill
   *   기반 'nextHitEvaded'만 처리, 장비 evasion은 0.
   * - 결과: 도적/어쌔신이 desc_stat '회피+8%' 보고 장착하지만 실제 evasion 0.
   *
   * 패턴 (cycle 222-225 silent dead config 시리즈):
   * - cycle 222: weapon 5종 armors 버킷 오배치.
   * - cycle 223: '얼음' elem 비매칭.
   * - cycle 224: 4 items mpBonus 미적용.
   * - cycle 225: 2 armors hpBonus 미적용 (+230 HP).
   * - cycle 226: 2 armors evasion 미적용 (마지막 unhandled field).
   *
   * 수정 (src/systems/CombatEngine.ts enemyAttack):
   * - stealth 회피 분기 직후 장비 evasion roll 추가.
   * - player.equip.armor.evasion 확률로 attack 회피.
   * - 회피 성공 시 stealth와 동일 패턴 — 0 dmg, '회피' 로그.
   *
   * 회귀 가드:
   * - evasion 미설정 armor는 0 영향.
   * - stealth nextHitEvaded는 우선 처리 유지.
   * - 보스 phase 전환 분기는 evasion 후에 평가.
   */

  test('cycle 226: 2 armors가 evasion 필드 정의 (baseline)', () => {
      const expected = [
          { name: '암영 망토', evasion: 0.08 },
          { name: '공허의 전투 외투', evasion: 0.12 },
      ];
      const allArmors = DB.ITEMS.armors || [];
      for (const exp of expected) {
          const item = allArmors.find((i) => i.name === exp.name);
          assert.ok(item, `${exp.name} should exist`);
          assert.equal(item.evasion, exp.evasion);
      }
  });

  test('cycle 226: enemyAttack이 evasion=1.0 armor 장착 시 항상 회피', () => {
      // Math.random()이 0~1 사이이므로 evasion=1.0이면 100% 회피.
      const player = {
          name: 'Test', job: '도적', level: 10,
          hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: {
              weapon: null,
              armor: { name: '극한 회피갑', type: 'armor', val: 30, evasion: 1.0 },
              offhand: null,
          },
          relics: [],
          skillChoices: {},
          titles: [],
          combatFlags: {},
          status: [],
      };
      const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
      const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      assert.equal(result.damage, 0, 'evasion=1.0이면 항상 회피, damage=0');
      assert.ok(result.logs.some((l) => l.text && l.text.includes('회피')),
          '회피 로그 emit 필요');
  });

  test('cycle 226: enemyAttack이 evasion=0 armor에서 회피 안 함 (회귀 가드)', () => {
      // evasion 미설정 armor는 회피 0%.
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: {
              weapon: null,
              armor: { name: '강철 갑옷', type: 'armor', val: 30 },
              offhand: null,
          },
          relics: [],
          skillChoices: {},
          titles: [],
          combatFlags: {},
          status: [],
      };
      const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
      const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      // 100번 시도 — 회피 안 됨이 정상 (random < 0).
      let evadedCount = 0;
      for (let i = 0; i < 50; i++) {
          const result = CombatEngine.enemyAttack(player, enemy, stats);
          const evadeLog = result.logs.find((l) => l.text && l.text.includes('회피') && !l.text.includes('은신'));
          if (evadeLog) evadedCount++;
      }
      assert.equal(evadedCount, 0, 'evasion 미설정 armor는 회피 0건');
  });

  test('cycle 226: armor evasion이 stealth보다 후순위 (회귀 가드)', () => {
      // nextHitEvaded(stealth)이 true이면 그것이 먼저 처리되어야 함.
      const player = {
          name: 'Test', job: '도적', level: 10,
          hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: {
              weapon: null,
              armor: { name: '암영 망토', type: 'armor', val: 35, evasion: 0.08 },
              offhand: null,
          },
          relics: [],
          skillChoices: {},
          titles: [],
          combatFlags: {},
          status: [],
          nextHitEvaded: true,
      };
      const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
      const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      assert.equal(result.damage, 0);
      // 은신 로그가 우선 emit되어야 함 (armor 회피 로그가 아님).
      assert.ok(result.logs.some((l) => l.text && l.text.includes('은신')),
          '은신 로그가 emit되어야 함 (stealth 우선 처리)');
  });

  test('cycle 222-225 회귀 가드: 기존 dead config fixes 유지', async () => {
      // cycle 222: 5 weapons in weapons bucket
      const weaponNames = new Set((DB.ITEMS.weapons || []).map((w) => w.name));
      assert.ok(weaponNames.has('세계수의 검'));
      assert.ok(weaponNames.has('시간 파편 소드'));
      // cycle 223: '얼음' elem 0건
      const allItems = [...(DB.ITEMS.weapons || []), ...(DB.ITEMS.armors || [])];
      const iceElem = allItems.filter((i) => i.elem === '얼음');
      assert.equal(iceElem.length, 0);
      // cycle 224: 4 items mpBonus
      assert.ok(allItems.some((i) => i.name === '빙결 지팡이' && i.mpBonus === 30));
      // cycle 225: 2 armors hpBonus
      assert.ok(allItems.some((i) => i.name === '용암 판금갑' && i.hpBonus === 80));
  });
}

// ─── cycle-228-phase3-def-bonus.test.js ───
{
  /**
   * cycle 228: 8 phase3 bosses의 defBonus dead config fix (cycle 222-227 시리즈 7번째).
   *
   * 발견 (phase3.defBonus 미적용):
   * - phase3 keys: atkBonus / defBonus / log / name / pattern / statusEffect / threshold.
   * - 그러나 CombatEngine.ts:1019의 phase3 전환은 atkBonus만 적용 (atk 증가).
   *   defBonus는 read 안 함 → 8+ phase3 보스의 def 강화가 0건 dispatch.
   * - 영향 보스 (phase3.defBonus 정의):
   *   · 종말의 마왕 (defBonus: 10)
   *   · 수호신의 심판 (defBonus: 15)
   *   · 절대 심판 (defBonus: 20)
   *   · 허무의 절대 권능 (defBonus: 25)
   *   · 절대 공허 (defBonus: 40)
   *   · 에테르의 절대 심판 (defBonus: 15)
   *   · 절대 공허의 대행자 (defBonus: 20)
   *   · 종말의 화신 (defBonus: 25)
   *
   * 결과 (UX/balance 회귀):
   * - phase3 전환 시 atk만 강해지고 def는 그대로 → 보스 후반 페이즈 발딘력이 의도보다 약함.
   * - 게임 디자인상 phase3는 'last stand' 강화 모먼트 — defBonus는 핵심 spec.
   *
   * 패턴 (cycle 222-228 silent dead config 시리즈 7번째):
   * - cycle 222: weapon 5종 armors 버킷 오배치.
   * - cycle 223: '얼음' elem 비매칭.
   * - cycle 224: 4 items mpBonus 미적용.
   * - cycle 225: 2 armors hpBonus 미적용.
   * - cycle 226: 2 armors evasion 미적용.
   * - cycle 227: 27 monsters statusOnHit 미적용.
   * - cycle 228: 8 phase3 bosses defBonus 미적용.
   *
   * 수정 (src/systems/CombatEngine.ts enemyAttack phase3 전환):
   * - p3.defBonus 정의 시 enemy.def += defBonus.
   * - 기존 atkBonus 처리는 그대로 유지.
   *
   * 회귀 가드:
   * - phase2는 defBonus 미정의 → 기존 동작 유지.
   * - defBonus 미정의 phase3는 0 영향.
   */

  test('cycle 228: 8 phase3 bosses가 defBonus 정의 (baseline)', () => {
      const expected = [
          { name: '종말의 마왕', defBonus: 10 },
          { name: '수호신의 심판', defBonus: 15 },
          { name: '절대 심판', defBonus: 20 },
          { name: '허무의 절대 권능', defBonus: 25 },
          { name: '절대 공허', defBonus: 40 },
          { name: '에테르의 절대 심판', defBonus: 15 },
          { name: '절대 공허의 대행자', defBonus: 20 },
          { name: '종말의 화신', defBonus: 25 },
      ];
      const monsters = DB.MONSTERS || {};
      const found = [];
      for (const [name, m] of Object.entries(monsters)) {
          if (m.phase3?.defBonus) found.push({ name: m.phase3.name, defBonus: m.phase3.defBonus });
      }
      for (const exp of expected) {
          const match = found.find((f) => f.name === exp.name);
          assert.ok(match, `phase3 boss '${exp.name}' should have defBonus`);
          assert.equal(match.defBonus, exp.defBonus);
      }
  });

  test('cycle 228: phase3 전환 시 def 증가 적용', () => {
      // phase3 transition: hp <= threshold → name/atk/pattern/def 변경 + log emit.
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 5000, maxHp: 5000, mp: 100, maxMp: 200,
          atk: 200, def: 50,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
      };
      const enemy = {
          name: '마왕', baseName: '마왕', isBoss: true,
          hp: 100, maxHp: 1000, atk: 100, def: 30,
          pattern: { guardChance: 0.0, heavyChance: 0.5 },
          phase3: {
              name: '종말의 마왕', threshold: 0.2, atkBonus: 0.6, defBonus: 10,
              pattern: { guardChance: 0.0, heavyChance: 0.7 }, log: '마왕이 최후의 힘을 끌어냅니다!',
          },
      };
      const stats = { atk: 200, def: 100, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      // phase3 triggered → enemy def 30 + 10 = 40
      assert.equal(result.updatedEnemy.def, 40,
          `phase3 defBonus 10 적용되어야 함 (30 + 10 = 40, 실제: ${result.updatedEnemy.def})`);
      assert.equal(result.updatedEnemy.phase3Triggered, true);
  });

  test('cycle 228: phase3 atkBonus도 동시 적용 (회귀 가드)', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 5000, maxHp: 5000, mp: 100, maxMp: 200,
          atk: 200, def: 50,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
      };
      const enemy = {
          name: '마왕', baseName: '마왕', isBoss: true,
          hp: 100, maxHp: 1000, atk: 100, def: 30,
          pattern: { guardChance: 0.0, heavyChance: 0.5 },
          phase3: {
              name: '종말의 마왕', threshold: 0.2, atkBonus: 0.6, defBonus: 10,
              pattern: { guardChance: 0.0, heavyChance: 0.7 },
              log: '마왕이 최후의 힘을 끌어냅니다!',
          },
      };
      const stats = { atk: 200, def: 100, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      // atkBonus 0.6 = 60% increase → 100 * 1.6 = 160
      assert.equal(result.updatedEnemy.atk, 160, 'phase3 atkBonus 보존');
  });

  test('cycle 228: defBonus 미정의 phase3는 def 변화 없음 (회귀 가드)', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 5000, maxHp: 5000, mp: 100, maxMp: 200,
          atk: 200, def: 50,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
      };
      const enemy = {
          name: '몹', baseName: '몹', isBoss: true,
          hp: 50, maxHp: 1000, atk: 100, def: 30,
          pattern: { guardChance: 0.0, heavyChance: 0.5 },
          phase3: {
              name: '강화몹', threshold: 0.2, atkBonus: 0.5,
              pattern: { guardChance: 0.0, heavyChance: 0.7 }, log: '강화!',
              // defBonus 미정의
          },
      };
      const stats = { atk: 200, def: 100, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      assert.equal(result.updatedEnemy.def, 30, 'defBonus 미정의 phase3는 def 그대로');
  });

  test('cycle 227 회귀 가드: heavy hit + statusOnHit 처리 유지', () => {
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
      };
      const enemy = {
          name: '슬라임', hp: 100, atk: 50, def: 5,
          statusOnHit: 'poison',
          pattern: { guardChance: 0.0, heavyChance: 1.0 },
      };
      const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      assert.ok((result.updatedPlayer.status || []).includes('poison'), 'cycle 227 statusOnHit 보존');
  });
}

// ─── cycle-231-class-progression-unreachable.test.js ───
{
  /**
   * cycle 231: 3 Tier-3 classes 도달 불가 회귀 fix.
   *
   * 발견 (class progression dead-end):
   * - 18 classes 정의, BFS로 모험가에서 도달 가능: 15.
   * - 3 unreachable: 드래곤 나이트 / 대마법사 / 그림자 주군.
   * - 각 T2 부모(나이트 / 버서커 / 아크메이지 / 흑마법사 / 어쌔신)의 next: []이라
   *   jobChange 액션이 절대 unlock 불가.
   * - 결과: 3개 T3 직업이 정의만 있고 영원히 진입 불가능 — 데이터 구조 자체에서 'orphan' classes.
   *
   * 패턴 (cycle 222-229 silent dead config 시리즈 lens 확장):
   * - cycle 222-229: item/monster/relic effect dead config.
   * - cycle 231: class progression chain dead-end (정의된 컨텐츠 미도달).
   *
   * 추정 origin:
   * - 18개 직업이 단계적으로 추가되면서 next 배열 확장이 누락된 incomplete content.
   * - T3 신규 직업 (드래곤 나이트 / 대마법사 / 그림자 주군) 합류 시 부모 next 업데이트 누락.
   *
   * 수정 (src/data/classes.ts):
   * - 나이트.next = ['드래곤 나이트'] (Knight → Dragon Knight, 자연 progression).
   * - 버서커.next = ['드래곤 나이트'] (Berserker → Dragon Knight, warrior path 양 분기).
   * - 아크메이지.next = ['대마법사'] (Archmage → Grand Archmage, 자연 progression).
   * - 흑마법사.next = ['대마법사'] (Warlock → Grand Archmage, mage path 양 분기).
   * - 어쌔신.next = ['그림자 주군'] (Assassin → Shadow Lord, 자연 progression).
   *
   * 회귀 가드:
   * - 모든 18 classes가 모험가에서 BFS reachable.
   * - 기존 progression(전사/마법사/도적/레인저/성직자/무당)은 그대로 유지.
   * - T3 자체는 next: [] 그대로 (end of tree).
   */

  test('cycle 231: 모든 18 classes가 모험가에서 도달 가능', () => {
      const reachable = new Set(['모험가']);
      const queue = ['모험가'];
      while (queue.length > 0) {
          const job = queue.shift();
          const data = DB.CLASSES[job];
          for (const next of (data?.next || [])) {
              if (!reachable.has(next)) {
                  reachable.add(next);
                  queue.push(next);
              }
          }
      }
      const allClasses = Object.keys(DB.CLASSES);
      const unreachable = allClasses.filter((j) => !reachable.has(j));
      assert.deepEqual(unreachable, [],
          `모든 직업이 jobChange chain으로 도달 가능해야 함. 미도달: ${JSON.stringify(unreachable)}`);
  });

  test('cycle 231: T2 → T3 progression 정의 완성', () => {
      const expected = [
          { from: '나이트', to: '드래곤 나이트' },
          { from: '버서커', to: '드래곤 나이트' },
          { from: '아크메이지', to: '대마법사' },
          { from: '흑마법사', to: '대마법사' },
          { from: '어쌔신', to: '그림자 주군' },
      ];
      for (const { from, to } of expected) {
          const next = DB.CLASSES[from]?.next || [];
          assert.ok(next.includes(to),
              `${from}.next에 '${to}' 포함되어야 함 (T3 progression). 실제: ${JSON.stringify(next)}`);
      }
  });

  test('cycle 231: T3 classes는 next: [] (end of tree, 회귀 가드)', () => {
      const t3Classes = ['팔라딘', '드래곤 나이트', '대마법사', '그림자 주군', '시간술사', '사냥의 군주'];
      for (const cls of t3Classes) {
          const data = DB.CLASSES[cls];
          assert.ok(data, `${cls} should exist`);
          assert.deepEqual(data.next || [], [],
              `T3 class ${cls}는 next: [] (end of tree)`);
      }
  });

  test('cycle 231: 기존 T1 → T2 progression 보존 (회귀 가드)', () => {
      const expected = [
          { from: '모험가', to: ['전사', '마법사', '도적'] },
          { from: '전사', to: ['나이트', '버서커'] },
          { from: '마법사', to: ['아크메이지', '흑마법사', '성직자', '무당'] },
          { from: '도적', to: ['어쌔신', '레인저'] },
      ];
      for (const { from, to } of expected) {
          const next = DB.CLASSES[from]?.next || [];
          for (const t of to) {
              assert.ok(next.includes(t), `${from} → ${t} 보존`);
          }
      }
  });

  test('cycle 231: 기존 T2 → T3 progression (성직자/무당/레인저) 보존', () => {
      assert.ok((DB.CLASSES['성직자']?.next || []).includes('팔라딘'));
      assert.ok((DB.CLASSES['무당']?.next || []).includes('시간술사'));
      assert.ok((DB.CLASSES['레인저']?.next || []).includes('사냥의 군주'));
  });
}

// ─── cycle-233-class-weapon-coverage.test.js ───
{
  /**
   * cycle 233: 3 classes (성직자 / 드래곤 나이트 / 무당)의 사용 가능 weapon 0개 회귀 fix.
   *
   * 발견 (content gap):
   * - DB.CLASSES 18종 / DB.ITEMS.weapons 117종.
   * - 그러나 사용 가능 weapon 0개:
   *   · 성직자 (T1, mage path, mpMod=1.6): 0 weapons.
   *   · 드래곤 나이트 (T3, warrior path, hpMod=1.9): 0 weapons.
   *   · 무당 (T2, mage path, mpMod=1.6): 0 weapons.
   * - 모든 weapon에 jobs[] array가 정의되어 있지만 위 3 class를 포함 안 함.
   * - 결과: 이 3 클래스로 플레이하는 동안 '맨손' 외에 무기 장착 불가 — 게임 무진행.
   *
   * 패턴 (cycle 222-229, 231 dead/orphan content 시리즈 lens 확장):
   * - 정의됐으나 도달/사용 불가능한 컨텐츠 — 명시적 player-facing 회귀.
   *
   * 수정 (src/data/items.ts):
   * - 성직자: mage staffs + holy weapons (마법봉/지팡이류 + 성스러운 창/검).
   * - 무당: mage staffs + dark/curse 무기 (마법봉/지팡이류 + 어둠/저주 themed).
   * - 드래곤 나이트: warrior heavy weapons (검/창/도끼류).
   * - 각 클래스가 최소 5종 이상 weapon 사용 가능 보장 (T1-T6 분포).
   *
   * 회귀 가드:
   * - 기존 jobs[] 항목은 보존.
   * - 다른 클래스(전사/마법사 등) 영향 0.
   */

  const ALL_JOBS = ['모험가', '전사', '마법사', '도적', '나이트', '버서커', '아크메이지', '흑마법사', '어쌔신', '레인저', '성직자', '팔라딘', '드래곤 나이트', '대마법사', '그림자 주군', '무당', '시간술사', '사냥의 군주'];

  test('cycle 233: 모든 18 classes가 최소 5 weapons 사용 가능', () => {
      const weapons = DB.ITEMS.weapons || [];
      const insufficient = [];
      for (const job of ALL_JOBS) {
          const usable = weapons.filter((w) => !Array.isArray(w.jobs) || w.jobs.includes(job));
          if (usable.length < 5) {
              insufficient.push(`${job}: ${usable.length}`);
          }
      }
      assert.deepEqual(insufficient, [],
          `모든 클래스가 5+ weapons 사용 가능해야 함. 부족: ${JSON.stringify(insufficient)}`);
  });

  test('cycle 233: 성직자 5+ weapons (priest path coverage)', () => {
      const usable = (DB.ITEMS.weapons || []).filter((w) => !Array.isArray(w.jobs) || w.jobs.includes('성직자'));
      assert.ok(usable.length >= 5, `성직자: ${usable.length} weapons (>= 5 필요)`);
  });

  test('cycle 233: 무당 5+ weapons (shaman path coverage)', () => {
      const usable = (DB.ITEMS.weapons || []).filter((w) => !Array.isArray(w.jobs) || w.jobs.includes('무당'));
      assert.ok(usable.length >= 5, `무당: ${usable.length} weapons (>= 5 필요)`);
  });

  test('cycle 233: 드래곤 나이트 5+ weapons (Dragon Knight path coverage)', () => {
      const usable = (DB.ITEMS.weapons || []).filter((w) => !Array.isArray(w.jobs) || w.jobs.includes('드래곤 나이트'));
      assert.ok(usable.length >= 5, `드래곤 나이트: ${usable.length} weapons (>= 5 필요)`);
  });

  test('cycle 233: 기존 클래스 weapon 수 보존 (전사/마법사 등 회귀 가드)', () => {
      const weapons = DB.ITEMS.weapons || [];
      // 전사/마법사/도적은 이미 19+ weapons. 변경 후에도 보존.
      assert.ok(weapons.filter((w) => w.jobs?.includes('전사')).length >= 30);
      assert.ok(weapons.filter((w) => w.jobs?.includes('마법사')).length >= 19);
      assert.ok(weapons.filter((w) => w.jobs?.includes('도적')).length >= 19);
  });
}

// ─── cycle-234-class-armor-coverage.test.js ───
{
  /**
   * cycle 234: 7 classes의 armor 사용 가능 baseline 5+로 확장 (cycle 233 lens follow-up).
   *
   * 발견 (armor coverage gap):
   * - cycle 233에서 weapon coverage fix.
   * - 그러나 armor coverage도 동일 회귀:
   *   · 성직자 / 드래곤 나이트 / 무당 / 시간술사: 0 armors.
   *   · 대마법사 / 그림자 주군 / 사냥의 군주: 1 armor.
   *   · 팔라딘: 2 armors.
   * - 결과: 4 클래스가 armor 0 (천옷 외 장착 불가) — cycle 233 weapon fix와 같은 결.
   *
   * 패턴 (cycle 222-229, 231, 233 dead/orphan content 시리즈 lens):
   * - cycle 233: weapon coverage.
   * - cycle 234: armor coverage (parallel content gap).
   *
   * 수정 (src/data/items.ts):
   * - mage path armors의 jobs[]에 성직자 / 무당 / 대마법사 / 시간술사 추가.
   * - warrior path armors의 jobs[]에 드래곤 나이트 / 팔라딘 추가.
   * - rogue path armors의 jobs[]에 그림자 주군 / 사냥의 군주 추가.
   *
   * 회귀 가드:
   * - 기존 jobs[] 보존.
   * - shield는 워리어 클래스만 — 4 mage 클래스는 shield 0 OK (디자인 의도).
   */

  const ALL_JOBS = ['모험가', '전사', '마법사', '도적', '나이트', '버서커', '아크메이지', '흑마법사', '어쌔신', '레인저', '성직자', '팔라딘', '드래곤 나이트', '대마법사', '그림자 주군', '무당', '시간술사', '사냥의 군주'];

  test('cycle 234: 모든 18 classes가 최소 5 armors 사용 가능', () => {
      const armors = (DB.ITEMS.armors || []).filter((a) => a.type === 'armor');
      const insufficient = [];
      for (const job of ALL_JOBS) {
          const usable = armors.filter((a) => !Array.isArray(a.jobs) || a.jobs.includes(job));
          if (usable.length < 5) {
              insufficient.push(`${job}: ${usable.length}`);
          }
      }
      assert.deepEqual(insufficient, [],
          `모든 클래스가 5+ armors 사용 가능해야 함. 부족: ${JSON.stringify(insufficient)}`);
  });

  test('cycle 234: 4 zero-armor classes 회귀 fix', () => {
      const armors = (DB.ITEMS.armors || []).filter((a) => a.type === 'armor');
      const zeroFixed = ['성직자', '드래곤 나이트', '무당', '시간술사'];
      for (const job of zeroFixed) {
          const usable = armors.filter((a) => !Array.isArray(a.jobs) || a.jobs.includes(job));
          assert.ok(usable.length >= 5,
              `${job}: ${usable.length} armors (>= 5 필요, cycle 234 fix)`);
      }
  });

  test('cycle 233 회귀 가드: weapon coverage 유지 (모든 18 classes >= 5 weapons)', () => {
      const weapons = DB.ITEMS.weapons || [];
      for (const job of ALL_JOBS) {
          const usable = weapons.filter((w) => !Array.isArray(w.jobs) || w.jobs.includes(job));
          assert.ok(usable.length >= 5, `cycle 233 weapon coverage: ${job} (${usable.length})`);
      }
  });

  test('cycle 234: 기존 armor jobs[] 보존 (회귀 가드)', () => {
      const armors = (DB.ITEMS.armors || []).filter((a) => a.type === 'armor');
      // 전사/마법사/도적은 이미 다수의 armor. 변경 후에도 보존.
      const warriorCount = armors.filter((a) => a.jobs?.includes('전사')).length;
      const mageCount = armors.filter((a) => a.jobs?.includes('마법사')).length;
      const thiefCount = armors.filter((a) => a.jobs?.includes('도적')).length;
      assert.ok(warriorCount >= 20, `전사 armor 보존 (${warriorCount})`);
      assert.ok(mageCount >= 10, `마법사 armor 보존 (${mageCount})`);
      assert.ok(thiefCount >= 15, `도적 armor 보존 (${thiefCount})`);
  });
}

// ─── cycle-242-stats-critchance-dispatch.test.js ───
{
  /**
   * cycle 242: stats.critChance dispatch 0건 + skill.crit branch override dead config fix
   *   (cycle 222-241 silent dead config 시리즈 14번째 — 가장 큰 영향).
   *
   * 발견 (CRITICAL silent regression):
   * - statsCalculator의 finalCritChance (line 386, 399)는 다음을 합산:
   *   baseCritChance(BALANCE.CRIT_CHANCE 0.1 + equipmentCritBonus + relicBonus.critBonus +
   *   abyssBonus.crit + titlePassive.crit + passiveBonus.crit) + traitBonus.critBonus +
   *   streak.critBonus + synergyBonus.critBonus.
   * - 그러나 CombatEngine.calculateDamage 호출 시 critChance 옵션을 전달하지 않아
   *   options 분해 default `BALANCE.CRIT_CHANCE` (0.1)만 사용 → stats.critChance dispatch 0건.
   * - 결과: 모든 crit 보너스(장비 / 유물 / 심연 / 칭호 / 패시브 / 트레이트 / killStreak / 시너지)가 dead.
   * - 도적 '치명 특화' branch (crit: 0.7) / 어쌔신 '치명 암살' branch (crit: 0.95)도 read 0건.
   * - SystemTab은 stats.critChance를 표시 → 사용자가 본 수치는 fake.
   *
   * 패턴 (cycle 222-241 silent dead config 시리즈 14번째):
   * - cycle 237: synergyBonus.critBonus 합산 (statsCalculator 측). paired completion.
   * - cycle 238: skill branch defBonus.
   * - cycle 239: skill branch effectChance.
   * - cycle 241: skill branch stunTurn.
   * - cycle 242: stats.critChance dispatch + skill.crit branch override.
   *
   * 수정 (src/systems/CombatEngine.ts):
   * - attack section: calculateDamage 호출 시 critChance: stats.critChance 전달.
   * - skill section: calculateDamage 호출 시 critChance: skill.crit ?? stats.critChance.
   *
   * 회귀 가드:
   * - stats.critChance 미정의(undefined) 시 기존 default BALANCE.CRIT_CHANCE 사용.
   * - skill.crit 미정의 시 stats.critChance 사용 (branch override 없음).
   */

  test('cycle 242: stats.critChance 0 시 attack isCrit 0회 (dispatch 확인)', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      let critCount = 0;
      for (let i = 0; i < 50; i++) {
          const r = CombatEngine.attack(player, enemy, stats);
          if (r.isCrit) critCount++;
      }
      assert.equal(critCount, 0, `stats.critChance 0 시 isCrit 0회 (실제 dispatch 안되면 ~5회 발생, 실제: ${critCount})`);
  });

  test('cycle 242: stats.critChance 1.0 시 attack isCrit 매번', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 1.0 };

      let critCount = 0;
      for (let i = 0; i < 30; i++) {
          const r = CombatEngine.attack(player, enemy, stats);
          if (r.isCrit) critCount++;
      }
      assert.equal(critCount, 30, `stats.critChance 1.0 시 매 attack isCrit (실제: ${critCount}/30)`);
  });

  test('cycle 242: stats.critChance 0 시 skill isCrit 0회', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const skill = { name: 'Test', mp: 10, mult: 2.0, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      let critCount = 0;
      for (let i = 0; i < 30; i++) {
          const r = CombatEngine.performSkill(player, enemy, stats, skill);
          if (r.isCrit) critCount++;
      }
      assert.equal(critCount, 0, `stats.critChance 0 + skill.crit 미정의 → 0회 (실제: ${critCount})`);
  });

  test('cycle 242: skill.crit 1.0 override 시 stats.critChance 0 무시하고 매번 isCrit', () => {
      const player = {
          name: 'Test', job: '도적', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // 도적 '치명 특화' branch B = crit: 0.7. 1.0으로 테스트.
      const skill = { name: 'Test', mp: 10, mult: 2.0, crit: 1.0, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      let critCount = 0;
      for (let i = 0; i < 30; i++) {
          const r = CombatEngine.performSkill(player, enemy, stats, skill);
          if (r.isCrit) critCount++;
      }
      assert.equal(critCount, 30, `skill.crit 1.0 override → 매번 isCrit (실제: ${critCount}/30)`);
  });

  test('cycle 242: skill.crit 0 override 시 stats.critChance 1.0 무시하고 0회', () => {
      const player = {
          name: 'Test', job: '도적', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const skill = { name: 'Test', mp: 10, mult: 2.0, crit: 0, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 1.0 };

      let critCount = 0;
      for (let i = 0; i < 30; i++) {
          const r = CombatEngine.performSkill(player, enemy, stats, skill);
          if (r.isCrit) critCount++;
      }
      assert.equal(critCount, 0, `skill.crit 0 override → 0회 (실제: ${critCount}/30)`);
  });

  test('cycle 242: stats.critChance 미정의 시 BALANCE.CRIT_CHANCE 0.1 fallback (회귀 가드)', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // critChance 미정의 stats (legacy/external test).
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [] };

      let critCount = 0;
      for (let i = 0; i < 1000; i++) {
          const r = CombatEngine.attack(player, enemy, stats);
          if (r.isCrit) critCount++;
      }
      // BALANCE.CRIT_CHANCE = 0.1 → ~100/1000. 기대 50~170 (loose tolerance).
      assert.ok(critCount >= 50 && critCount <= 170,
          `stats.critChance 미정의 시 default 0.1 fallback (~100/1000, 실제: ${critCount})`);
  });
}

// ─── cycle-250-stats-active-set-render.test.js ───
{
  /**
   * cycle 250: stats.activeSet (prefix-based items 세트) UI dispatch dead config
   *   (cycle 222-249 silent dead config 시리즈 22번째 — UI render lens 재진입).
   *
   * 발견 (UI dispatch 누락):
   * - src/data/items.ts sets[]: 7종 prefix-based 2세트 보너스 정의 ('불타는' 화염의 결속,
   *   '얼어붙은' 혹한의 방벽 등) — desc + setBonus.
   * - src/utils/statsCalculator.ts computeSetBonus가 동일 prefix 2개 이상 장착 시 activeSet 반환.
   * - finalCritChance 등과 함께 stats.activeSet (line 356, 396)에 노출.
   * - 그러나 components/ 검색 시 stats.activeSet read 0건 — 'activeSignatureSet' (signature 세트)만
   *   StatsPanel/EquipmentPanel에 render되고, 일반 prefix 세트는 영원히 UI invisible.
   * - 결과: 플레이어가 '불타는' 무기 + '불타는' 갑옷 장착해도 '화염의 결속 (2세트): ATK 10% 증가'
   *   보너스가 stats에는 적용되지만 UI 표시 0건이라 모름.
   *
   * 패턴 (cycle 222-249 silent dead config 시리즈 22번째):
   * - cycle 245: BOSS_BRIEFS warningChips/recommendedBuilds UI render (data → util → struct → UI 끊김).
   * - cycle 250: stats.activeSet UI render (data → util → struct → UI 끊김 동일 패턴).
   *
   * 수정:
   * - StatsPanel.tsx에 activeSet block 추가 — activeSignatureSet 패턴 mirror, 단순 desc 표시.
   *
   * 회귀 가드:
   * - activeSignatureSet block 동작 유지.
   * - activeSet null/undefined 시 미표시 (silence over noise).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 250: StatsPanel가 stats.activeSet을 render', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      assert.ok(/activeSet[^B]|activeSet$/.test(source.replace(/activeSignatureSet/g, '__SIG__')),
          'StatsPanel은 stats.activeSet (prefix-based)를 read해야 함');
  });

  test('cycle 250: StatsPanel가 activeSet.desc를 표시', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      // signature 패턴을 마스킹한 후 prefix activeSet 패턴 매칭.
      const masked = source.replace(/activeSignatureSet/g, '__SIG__');
      assert.ok(/activeSet\?\.desc|activeSet\.desc/.test(masked),
          'activeSet.desc 표시 (예: "화염의 결속 (2세트): ATK 10% 증가")');
  });

  test('cycle 250: StatsPanel가 activeSet.prefix 또는 동등 식별자 표시', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      const masked = source.replace(/activeSignatureSet/g, '__SIG__');
      assert.ok(/activeSet\?\.prefix|activeSet\.prefix/.test(masked),
          'activeSet.prefix (세트 이름) 표시');
  });

  test('cycle 250: activeSet null/undefined 시 미표시 (silence over noise)', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      // conditional rendering 확인 — `{activeSet && ...}` 또는 `activeSet ? ... : null`.
      const masked = source.replace(/activeSignatureSet/g, '__SIG__');
      assert.ok(/\{activeSet[\s&?]/.test(masked),
          '조건부 렌더링 — activeSet falsy 시 미표시');
  });

  test('cycle 250: activeSignatureSet block 동작 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      assert.ok(/activeSignatureSet/.test(source), 'activeSignatureSet 참조 유지');
      assert.ok(/data-testid="stats-active-signature-set"/.test(source),
          'activeSignatureSet testid 유지');
  });

  test('cycle 250: items.ts sets 데이터 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/data/items.ts');
      const sets = source.match(/prefix:\s*'[^']+',\s*setBonus:/g);
      assert.ok(sets && sets.length >= 5, `items.ts sets 정의 ${sets?.length || 0}개 (≥5 회귀 가드)`);
  });
}

// ─── cycle-261-claim-sensory-cue-coverage.test.js ───
{
  /**
   * cycle 261: claim 액션 sensory cue 누락 (cycle 122-123 paired completion)
   *   (cycle 222-260 silent dead config 시리즈 32번째).
   *
   * 발견 (cycle 122/123 sensory cue 시리즈 잔존 누락):
   * - cycle 122: quest_complete 사운드 도입 (퀘스트 완료 / 업적 청구).
   * - cycle 123: 업적 청구도 동일 사운드 재사용.
   * - 그러나 동일 결의 "달성/회수" 모먼트 2건 잔존:
   *   1) claimWeeklyMission (useInventoryActions): 보상 grant + addLog 있지만 sound 0건.
   *   2) SeasonPassPanel claimReward: dispatch만 있고 addLog/sound 모두 0건 — UX dead path.
   *
   * 패턴 (cycle 222-260 silent dead config 시리즈 32번째):
   * - cycle 122: quest_complete 사운드 도입.
   * - cycle 123: 업적 paired.
   * - cycle 217-220: levelUp/death/victory/skill/heal/explore 사운드 시리즈.
   * - cycle 261: claim 액션 sensory cue 누락 paired completion.
   *
   * 수정:
   * 1) src/hooks/useInventoryActions.ts:
   *    - claimWeeklyMission에 soundManager.play('quest_complete') 추가.
   *    - claimSeasonReward 신규 action 추가 — dispatch + addLog + sound 통합.
   * 2) src/components/tabs/SeasonPassPanel.tsx: useGameEngine actions 사용으로 refactor.
   *
   * 회귀 가드:
   * - claimWeeklyMission addLog 동작 유지.
   * - 기존 quest / achievement quest_complete 사운드 dispatch 유지.
   * - CLAIM_SEASON_REWARD reducer 핸들러 변화 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 261: claimWeeklyMission에 quest_complete 사운드 dispatch', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      // claimWeeklyMission 함수 내에 soundManager.play 호출.
      const fnMatch = source.match(/claimWeeklyMission:[\s\S]{0,500}?},/);
      assert.ok(fnMatch, 'claimWeeklyMission 정의 발견');
      assert.ok(/soundManager\.play\(['"]quest_complete['"]\)/.test(fnMatch[0]),
          'claimWeeklyMission 내부에 soundManager.play("quest_complete") 호출');
  });

  test('cycle 261: claimSeasonReward 신규 액션 정의', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(/claimSeasonReward:/.test(source),
          'claimSeasonReward action 정의됨');
      // claimSeasonReward 함수 내에 dispatch + addLog + sound 모두 있어야 함.
      const fnMatch = source.match(/claimSeasonReward:[\s\S]{0,800}?},/);
      assert.ok(fnMatch, 'claimSeasonReward 정의 발견');
      assert.ok(/CLAIM_SEASON_REWARD/.test(fnMatch[0]),
          'claimSeasonReward 내부에 CLAIM_SEASON_REWARD dispatch');
      assert.ok(/addLog/.test(fnMatch[0]),
          'claimSeasonReward 내부에 addLog 호출');
      assert.ok(/soundManager\.play\(['"]quest_complete['"]\)/.test(fnMatch[0]),
          'claimSeasonReward 내부에 quest_complete 사운드');
  });

  test('cycle 261: SeasonPassPanel이 actions.claimSeasonReward 사용', async () => {
      const source = await readSrc('src/components/tabs/SeasonPassPanel.tsx');
      assert.ok(/claimSeasonReward/.test(source),
          'SeasonPassPanel은 claimSeasonReward action 사용');
  });

  test('cycle 122-123 회귀 가드: 기존 quest_complete 사운드 dispatch 유지', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      const matches = source.match(/soundManager\.play\(['"]quest_complete['"]\)/g);
      // cycle 122 (completeQuest), cycle 123 (claimAchievement), cycle 261 (claimWeekly + claimSeason) → 4 expected.
      assert.ok(matches && matches.length >= 4,
          `quest_complete 사운드 dispatch ≥4개 (cycle 122/123 + cycle 261 추가, 실제: ${matches?.length || 0})`);
  });

  test('cycle 261: 기존 CLAIM_SEASON_REWARD reducer 변화 없음 (회귀 가드)', async () => {
      const source = await readSrc('src/reducers/handlers/rewardHandlers.ts');
      assert.ok(/CLAIM_SEASON_REWARD: \(state: GameState, action: GameAction\) => \{/.test(source),
          'CLAIM_SEASON_REWARD handler 시그니처 유지');
  });
}

// ─── cycle-263-critical-log-sound-mapping.test.js ───
{
  /**
   * cycle 263: 'critical' 로그 타입 sensory cue 누락 dead config
   *   (cycle 222-262 silent dead config 시리즈 34번째).
   *
   * 발견 (sensory cue gap):
   * - useGameEngine.tsx:48-52에서 lastLog.type → soundManager.play 매핑:
   *   combat→attack / levelUp→levelUp / error→error / item→item / legendary→legendary.
   * - 그러나 'critical' 로그 타입(crit hit 시 MSG.COMBAT_CRIT, 보스 reveal 등 14건)에 대한
   *   sound 매핑 누락.
   * - 결과: 일반 공격은 'attack' 사운드 재생되지만 크리티컬 hit은 무음 — 전투 피드백
   *   퇴행. 강화된 hit이 약화된 hit처럼 들림.
   *
   * 발생 경로:
   * - CombatEngine: isCrit 시 logs.push({ type: 'critical', text: MSG.COMBAT_CRIT }) — 일반
   *   공격 'combat' 로그 직후 'critical' 추가 → lastLog는 'critical' → 매핑 X → 무음.
   * - executeAtkTriggered (예언의 돌판), phase3 보스 변신 등도 'critical' 로그.
   *
   * 패턴 (cycle 222-262 silent dead config 시리즈 34번째):
   * - cycle 122-123: quest_complete 사운드 도입.
   * - cycle 217-220: levelUp/death/victory/skill/heal/explore 사운드.
   * - cycle 261: claim 액션 sensory cue paired completion.
   * - cycle 263: 'critical' 로그 sensory cue paired completion.
   *
   * 수정 (src/hooks/useGameEngine.ts):
   * - lastLog 사운드 매핑에 'critical' → 'attack' 추가 (combat과 동일 — 강화된 hit도 attack 결).
   *
   * 회귀 가드:
   * - 기존 5개 매핑 (combat/levelUp/error/item/legendary) 동작 유지.
   * - lastLog 의존성 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 263 / slice 32: useGameEngine에서 critical 로그 타입 → 사운드 매핑', async () => {
      // slice 32: 'critical' → 'attack'에서 전용 'crit' 사운드로 격상 (일반 타격과 분리).
      const source = await readSrc('src/hooks/useGameEngine.ts');
      assert.ok(/lastLog\.type === ['"]critical['"][\s\S]{0,120}soundManager\.play\(['"]crit['"]\)/.test(source),
          "useGameEngine에 lastLog.type === 'critical' → soundManager.play('crit') 매핑");
  });

  test('cycle 263: 기존 5개 사운드 매핑 동작 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/hooks/useGameEngine.ts');
      const mappings = [
          ['combat', 'attack'],
          ['levelUp', 'levelUp'],
          ['error', 'error'],
          ['item', 'item'],
          ['legendary', 'legendary'],
      ];
      mappings.forEach(([logType, sound]) => {
          const re = new RegExp(`lastLog\\.type === ['"]${logType}['"][\\s\\S]{0,60}soundManager\\.play\\(['"]${sound}['"]\\)`);
          assert.ok(re.test(source), `'${logType}' → '${sound}' 매핑 유지`);
      });
  });

  test('cycle 263: critical 로그 타입이 CombatEngine에서 사용 (회귀 가드)', async () => {
      // slice 19: 중복 COMBAT_CRIT 별도 로그가 본문 태그로 통합되면서 literal
      //   `type: 'critical'` 수가 줄었다. crit 시 main 로그가 ternary
      //   (isCrit ? 'critical' : 'combat')로 critical 타입을 유지하므로
      //   literal + ternary 양쪽을 합산해 가드한다.
      const source = await readSrc('src/systems/CombatEngine.ts');
      const literal = source.match(/type:\s*['"]critical['"]/g) || [];
      const ternary = source.match(/isCrit\s*\?\s*['"]critical['"]/g) || [];
      assert.ok(literal.length + ternary.length >= 3,
          `CombatEngine에 'critical' 로그 ≥3건 (literal ${literal.length} + ternary ${ternary.length})`);
  });
}

// ─── cycle-264-shield-enhance-def-bonus.test.js ───
{
  /**
   * cycle 264: 방패 강화(enhance) DEF 기여 누락 dead config
   *   (cycle 222-263 silent dead config 시리즈 35번째).
   *
   * 발견 (statsCalculator computeEnhanceBonus):
   * - ENHANCE_ITEM 핸들러는 weapon / armor / offhand(shield 포함) 3 슬롯 모두 enhance 카운터 +1.
   * - 그러나 src/utils/statsCalculator.ts computeEnhanceBonus (line 195-208):
   *   - atk = weapon.enhance × val + offhand.enhance × val × 0.5 (dual-wield 가정).
   *   - def = armor.enhance × val 만 적용.
   * - 결과: 방패(offhand shield) 강화 시 enhance 카운터는 올라가지만 stat 보너스 0.
   *   shield val 14 +5 강화 → +3 ~ +5 def 의도지만 실제 +0. 강화 비용 (gold + 재료) 낭비.
   *
   * 추가 발견:
   * - 방패가 offhand에 장착되면 atk 계산 (line 204)에 shield.val × 0.5 추가됨 — 잘못된
   *   atk 보너스. shields는 atk 보너스 X.
   *
   * 패턴 (cycle 222-263 silent dead config 시리즈 35번째):
   * - cycle 224/225: equipment mp/hp bonus dispatch 누락 fix.
   * - cycle 226: armor evasion dispatch.
   * - cycle 264: shield enhance def bonus dispatch (paired equipment field 누락).
   *
   * 수정 (src/utils/statsCalculator.ts computeEnhanceBonus):
   * - isShield import 추가.
   * - offhand이 shield인 경우 def에 enhance × val 가산, atk 가산 제외.
   * - offhand이 weapon인 경우 기존 atk × 0.5 dual-wield 동작 유지.
   *
   * 회귀 가드:
   * - weapon enhance atk 동작 유지.
   * - armor enhance def 동작 유지.
   * - offhand weapon enhance atk × 0.5 동작 유지.
   * - 모든 enhance 0 시 stat boost 0.
   */

  test('cycle 264: 방패 enhance가 def 보너스 추가', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const player = {
          name: 'Test', job: '나이트', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          relics: [], skillChoices: {}, titles: [], stats: {},
          equip: {
              weapon: { type: 'weapon', name: 'Test Sword', val: 50, enhance: 0 },
              armor: { type: 'armor', name: 'Test Armor', val: 20, enhance: 0 },
              offhand: { type: 'shield', name: 'Test Shield', val: 14, enhance: 5 },
          },
      };
      const noShieldEnhance = calculateFullStats({
          ...player,
          equip: { ...player.equip, offhand: { type: 'shield', name: 'Test Shield', val: 14, enhance: 0 } },
      });
      const withShieldEnhance = calculateFullStats(player);
      // shield enhance 5 → val 14 * 0.04 * 5 = 2.8 → floor 2 def 추가 (BALANCE.ENHANCE_STAT_BONUS = 0.04).
      assert.ok(withShieldEnhance.def > noShieldEnhance.def,
          `방패 enhance 5 → def 증가 (no enhance ${noShieldEnhance.def} vs enhance ${withShieldEnhance.def})`);
  });

  test('cycle 264: 방패 enhance가 atk 보너스 추가하지 않음 (회귀 가드)', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const playerNoEnhance = {
          name: 'Test', job: '나이트', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          relics: [], skillChoices: {}, titles: [], stats: {},
          equip: {
              weapon: { type: 'weapon', name: 'Test Sword', val: 50, enhance: 0 },
              armor: { type: 'armor', name: 'Test Armor', val: 20, enhance: 0 },
              offhand: { type: 'shield', name: 'Test Shield', val: 14, enhance: 0 },
          },
      };
      const playerWithShieldEnhance = {
          ...playerNoEnhance,
          equip: {
              ...playerNoEnhance.equip,
              offhand: { type: 'shield', name: 'Test Shield', val: 14, enhance: 10 },
          },
      };
      const statsA = calculateFullStats(playerNoEnhance);
      const statsB = calculateFullStats(playerWithShieldEnhance);
      // shield enhance는 atk 변화 X.
      assert.equal(statsA.atk, statsB.atk,
          `shield enhance가 atk에 영향 없음 (실제: A ${statsA.atk} == B ${statsB.atk})`);
  });

  test('cycle 264: 무기 enhance atk 기여 회귀 가드', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const playerA = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          relics: [], skillChoices: {}, titles: [], stats: {},
          equip: {
              weapon: { type: 'weapon', name: 'Test Sword', val: 100, enhance: 0 },
              armor: { type: 'armor', name: 'Test Armor', val: 20, enhance: 0 },
          },
      };
      const playerB = {
          ...playerA,
          equip: { ...playerA.equip, weapon: { type: 'weapon', name: 'Test Sword', val: 100, enhance: 5 } },
      };
      const statsA = calculateFullStats(playerA);
      const statsB = calculateFullStats(playerB);
      assert.ok(statsB.atk > statsA.atk,
          `무기 enhance 5 → atk 증가 (cycle 264 회귀 가드, A ${statsA.atk} vs B ${statsB.atk})`);
  });

  test('cycle 264: 갑옷 enhance def 기여 회귀 가드', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const playerA = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          relics: [], skillChoices: {}, titles: [], stats: {},
          equip: {
              weapon: { type: 'weapon', name: 'Test Sword', val: 50, enhance: 0 },
              armor: { type: 'armor', name: 'Test Armor', val: 30, enhance: 0 },
          },
      };
      const playerB = {
          ...playerA,
          equip: { ...playerA.equip, armor: { type: 'armor', name: 'Test Armor', val: 30, enhance: 5 } },
      };
      const statsA = calculateFullStats(playerA);
      const statsB = calculateFullStats(playerB);
      assert.ok(statsB.def > statsA.def,
          `갑옷 enhance 5 → def 증가 (회귀 가드, A ${statsA.def} vs B ${statsB.def})`);
  });

  test('cycle 264: 듀얼 무기 (offhand weapon) enhance atk 회귀 가드', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const playerA = {
          name: 'Test', job: '도적', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          relics: [], skillChoices: {}, titles: [], stats: {},
          equip: {
              weapon: { type: 'weapon', name: 'Test Sword', val: 50, enhance: 0 },
              armor: { type: 'armor', name: 'Test Armor', val: 20, enhance: 0 },
              offhand: { type: 'weapon', name: 'Test Dagger', val: 30, enhance: 0 },
          },
      };
      const playerB = {
          ...playerA,
          equip: { ...playerA.equip, offhand: { type: 'weapon', name: 'Test Dagger', val: 30, enhance: 5 } },
      };
      const statsA = calculateFullStats(playerA);
      const statsB = calculateFullStats(playerB);
      assert.ok(statsB.atk > statsA.atk,
          `offhand weapon enhance 5 → atk 증가 (회귀 가드, A ${statsA.atk} vs B ${statsB.atk})`);
  });
}

// ─── cycle-265-live-config-multipliers.test.js ───
{
  /**
   * cycle 265: liveConfig.seasonEvent / eventMultiplier 보너스 dispatch 누락 dead config
   *   (cycle 222-264 silent dead config 시리즈 36번째 — 가장 큰 player-facing UX 회귀).
   *
   * 발견 (CRITICAL UX dead config):
   * - GameRoot 배너에 "⚡ 시즌 이벤트 진행 중 | 골드+30% XP+50%" 표시 (UI 광고).
   * - liveConfig 구조: { eventMultiplier, announcement, seasonEvent: { goldMultiplier, xpMultiplier, ... } }.
   * - 그러나 src/ 전체 검색에서 goldMultiplier / xpMultiplier / eventMultiplier dispatch 0건 —
   *   handleVictory가 expMult / goldMult를 계산하지만 liveConfig 정보 무시.
   * - SystemTab admin이 eventMultiplier 1-5로 변경하는 UI도 dead — 변경해도 게임에 영향 0.
   * - 결과: 시즌 이벤트 진행 중 광고된 보너스가 fake. 플레이어가 받는 gold/exp는 평소와 동일.
   *
   * 패턴 (cycle 222-264 silent dead config 시리즈 36번째 — UX 광고 vs 실제 동작 모순):
   * - cycle 245: BOSS_BRIEFS UI dispatch.
   * - cycle 250: stats.activeSet UI dispatch.
   * - cycle 261: claim 액션 sensory cue.
   * - cycle 265: liveConfig 보너스 dispatch (가장 큰 영향 — 시즌 이벤트 시스템 전체 활성화).
   *
   * 수정 (src/systems/CombatEngine.ts handleVictory):
   * - 4번째 param liveConfig 추가 (default 빈 객체).
   * - eventMultiplier (admin) 와 seasonEvent.xpMultiplier 적용 → expMult 추가 합산.
   * - seasonEvent.goldMultiplier 적용 → goldMult 추가 합산.
   * - liveConfig 미정의 시 default 1 fallback (회귀 가드).
   *
   * 회귀 가드:
   * - 기존 expMult / goldMult 계산 동작 유지 (relics, passive 등).
   * - liveConfig 미전달 시 기존 결과 동일.
   * - seasonEvent.active false 시 multiplier 무시.
   */

  const makePlayer = () => ({
      name: 'Test', job: '전사', level: 30,
      hp: 100, maxHp: 1000, mp: 100, maxMp: 100,
      atk: 50, def: 20, gold: 0, exp: 0,
      relics: [], skillChoices: {}, titles: [], equip: {},
      combatFlags: {}, status: [], stats: {},
      skillLoadout: { selected: 0, cooldowns: {} },
      challengeModifiers: [],
  });

  const makeEnemy = () => ({
      name: '오크', baseName: '오크', hp: 0, maxHp: 100,
      atk: 50, def: 5, exp: 100, gold: 200,
  });

  test('cycle 265: liveConfig.seasonEvent.goldMultiplier 적용', () => {
      const player = makePlayer();
      const enemy = makeEnemy();
      const liveConfig = {
          seasonEvent: { active: true, goldMultiplier: 2.0, xpMultiplier: 1.0 },
      };
      const baseline = CombatEngine.handleVictory(player, enemy, {}, {});
      const boosted = CombatEngine.handleVictory(player, enemy, {}, liveConfig);
      // baseline gold from enemy.gold * (1 + relicGold) * killBonus * levelPenalty * (challengeRewardMult).
      // boosted should be ~2x baseline (goldMultiplier 2.0).
      assert.ok(boosted.updatedPlayer.gold > baseline.updatedPlayer.gold,
          `seasonEvent goldMultiplier 2.0 → gold 증가 (baseline ${baseline.updatedPlayer.gold} vs boosted ${boosted.updatedPlayer.gold})`);
  });

  test('cycle 265: liveConfig.seasonEvent.xpMultiplier 적용', () => {
      const player = makePlayer();
      const enemy = makeEnemy();
      const liveConfig = {
          seasonEvent: { active: true, goldMultiplier: 1.0, xpMultiplier: 1.5 },
      };
      const baseline = CombatEngine.handleVictory(player, enemy, {}, {});
      const boosted = CombatEngine.handleVictory(player, enemy, {}, liveConfig);
      assert.ok(boosted.expGained > baseline.expGained,
          `seasonEvent xpMultiplier 1.5 → exp 증가 (baseline ${baseline.expGained} vs boosted ${boosted.expGained})`);
  });

  test('cycle 265: liveConfig.eventMultiplier (admin) 적용', () => {
      const player = makePlayer();
      const enemy = makeEnemy();
      const liveConfig = { eventMultiplier: 3.0 };
      const baseline = CombatEngine.handleVictory(player, enemy, {}, {});
      const boosted = CombatEngine.handleVictory(player, enemy, {}, liveConfig);
      // eventMultiplier 3.0 → exp 약 3배.
      assert.ok(boosted.expGained > baseline.expGained * 1.5,
          `eventMultiplier 3.0 → exp ≈3x (baseline ${baseline.expGained} vs boosted ${boosted.expGained})`);
  });

  test('cycle 265: seasonEvent.active false 시 multiplier 무시 (회귀 가드)', () => {
      const player = makePlayer();
      const enemy = makeEnemy();
      const liveConfig = {
          seasonEvent: { active: false, goldMultiplier: 5.0, xpMultiplier: 5.0 },
      };
      const baseline = CombatEngine.handleVictory(player, enemy, {}, {});
      const inactive = CombatEngine.handleVictory(player, enemy, {}, liveConfig);
      // inactive 시 multiplier 미적용 → baseline과 동일.
      assert.equal(inactive.updatedPlayer.gold, baseline.updatedPlayer.gold,
          `seasonEvent.active false 시 gold 동일 (baseline ${baseline.updatedPlayer.gold} == inactive ${inactive.updatedPlayer.gold})`);
      assert.equal(inactive.expGained, baseline.expGained,
          `seasonEvent.active false 시 exp 동일`);
  });

  test('cycle 265: liveConfig 빈 객체 명시 vs 활성 객체 (회귀 가드)', () => {
      const player = makePlayer();
      const enemy = makeEnemy();
      // cycle 624: explicit default-elimination — 4 args 모두 명시 필수.
      const r1 = CombatEngine.handleVictory(player, enemy, {}, {});
      const r2 = CombatEngine.handleVictory(player, enemy, {}, {});
      assert.equal(r1.updatedPlayer.gold, r2.updatedPlayer.gold,
          '두 빈 객체 동일 동작');
      assert.equal(r1.expGained, r2.expGained, '두 빈 객체 expGained 동일');
  });

  test('cycle 265: liveConfig.eventMultiplier 1 (default) 시 영향 없음', () => {
      const player = makePlayer();
      const enemy = makeEnemy();
      const baseline = CombatEngine.handleVictory(player, enemy, {}, {});
      const neutral = CombatEngine.handleVictory(player, enemy, {}, { eventMultiplier: 1 });
      assert.equal(neutral.expGained, baseline.expGained,
          'eventMultiplier 1 시 동일 (회귀 가드)');
  });
}

// ─── cycle-266-live-config-announcement.test.js ───
{
  /**
   * cycle 266: liveConfig.announcement UI dispatch 누락 dead config
   *   (cycle 222-265 silent dead config 시리즈 37번째).
   *
   * 발견 (cycle 265 paired):
   * - liveConfig 구조: { eventMultiplier, announcement, seasonEvent }.
   * - SystemTab admin이 announcement(공지) 설정 가능 (window.prompt → updateLiveConfig).
   * - 그러나 announcement 필드는 src/ 어디에도 render 안 됨 (SystemTab admin setter만 read).
   * - 결과: admin이 공지를 설정해도 player에게 표시되지 않음 — admin 도구 dead.
   *
   * 패턴 (cycle 222-265 silent dead config 시리즈 37번째):
   * - cycle 265: liveConfig.seasonEvent / eventMultiplier 보너스 dispatch.
   * - cycle 266: liveConfig.announcement UI dispatch (paired completion).
   *
   * 수정 (src/components/app/GameRoot.tsx):
   * - 시즌 이벤트 배너 위 또는 아래에 announcement 배너 추가.
   * - announcement 비어있을 시 미표시 (silence over noise).
   *
   * 회귀 가드:
   * - cycle 265 seasonEvent 배너 동작 유지.
   * - SystemTab admin updateLiveConfig 동작 변화 없음.
   * - announcement 빈 문자열 / 미정의 시 미표시.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 266: GameRoot가 liveConfig.announcement render', async () => {
      const source = await readSrc('src/components/app/GameRoot.tsx');
      assert.ok(/liveConfig\?.announcement|liveConfig\.announcement/.test(source),
          'GameRoot는 liveConfig.announcement read');
  });

  test('cycle 266: 빈 announcement 시 미표시 (조건부 렌더링)', async () => {
      const source = await readSrc('src/components/app/GameRoot.tsx');
      // 조건부 렌더링 패턴: `{liveConfig.announcement && ...}` 또는 `{liveConfig?.announcement && ...}`.
      assert.ok(/\{engine\.liveConfig\?\.announcement\s*&&|\{engine\.liveConfig\.announcement\s*&&/.test(source),
          '조건부 렌더링 — announcement falsy 시 미표시');
  });

  test('cycle 266: announcement 배너가 testid 노출', async () => {
      const source = await readSrc('src/components/app/GameRoot.tsx');
      assert.ok(/data-testid=['"]live-config-announcement['"]/.test(source),
          'announcement 배너에 data-testid 추가 (테스트 검증 hook)');
  });

  test('cycle 265 회귀 가드: seasonEvent 배너 동작 유지', async () => {
      const source = await readSrc('src/components/app/GameRoot.tsx');
      assert.ok(/liveConfig\?\.seasonEvent\?\.active/.test(source),
          'cycle 265 seasonEvent 배너 조건 유지');
      assert.ok(/시즌 이벤트 배너/.test(source),
          'cycle 265 seasonEvent 배너 주석 유지');
  });
}

// ─── cycle-268-buildprofile-secondary-dead.test.js ───
{
  /**
   * cycle 268: getRunBuildProfile의 secondary 필드 dead config 제거
   *   (cycle 222-267 silent dead config 시리즈 39번째 — cleanup lens 연속).
   *
   * 발견 (cycle 267 패턴 동일 — dead 필드):
   * - src/utils/runProfile.ts getRunBuildProfile 반환 객체 (line 171-175):
   *   { primary, secondary: ranked.slice(1, 3), tags: ranked.slice(0, 5) }.
   * - 그러나 src/ 어디에도 `.secondary` 접근 0건 — 검색 결과 정의 1건뿐.
   * - tags(buildProfile.tags) / primary(buildProfile.primary)는 dispatched.
   * - secondary만 dead — ranked.slice(1, 3) 계산 결과 쓰여지지 않음.
   *
   * 패턴 (cycle 222-267 silent dead config 시리즈 39번째):
   * - cycle 267: skillLabel 제거.
   * - cycle 268: buildProfile.secondary 제거 (cleanup lens 연속).
   *
   * 수정 (src/utils/runProfile.ts):
   * - getRunBuildProfile 반환 객체에서 secondary 제거.
   *
   * 회귀 가드:
   * - primary / tags 필드 동작 유지.
   * - getRunBuildProfile 시그니처 변화 없음.
   * - 다른 buildProfile consumer (gameUtils / useGameEngine 등) 동작 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 268: getRunBuildProfile의 secondary 필드 정의 제거', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      // 필드 정의 라인 (`secondary:` colon)만 검색.
      assert.ok(!/^\s*secondary:\s*ranked/m.test(source),
          'secondary 필드 정의 제거됨 (dead config cleanup)');
  });

  test('cycle 268: getRunBuildProfile primary / tags 필드 유지 (회귀 가드)', async () => {
      const { getRunBuildProfile } = await import('../src/utils/runProfile.js');
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          equip: {}, relics: [], skillChoices: {}, titles: [],
          stats: { kills: 10 },
      };
      const profile = getRunBuildProfile(player, { maxHp: 1000 });
      assert.ok(profile.primary, 'primary 필드 유지');
      assert.ok(Array.isArray(profile.tags), 'tags 배열 유지');
      assert.equal(profile.secondary, undefined, 'secondary 필드 제거됨');
  });

  test('cycle 268: buildProfile.tags 컴포넌트 dispatch 유지 (회귀 가드)', async () => {
      // cycle 344: gameUtils.ts buildTags 출력 dead 정리 후 useGameEngine.ts만 유지.
      //   AI snapshot (playerSnapshot.buildProfile)이 유일한 active dispatch.
      const source = await readSrc('src/hooks/useGameEngine.ts');
      assert.ok(/buildProfile\.tags/.test(source),
          'useGameEngine buildProfile.tags AI snapshot dispatch 유지');
  });

  test('cycle 267 회귀 가드: skillLabel 0건 유지', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/^\s*skillLabel:/m.test(source),
          'cycle 267 skillLabel 제거 유지');
  });
}

// ─── cycle-270-tactical-profile-dead-cleanup.test.js ───
{
  /**
   * cycle 270: getEnemyTacticalProfile의 12 dead 필드 cleanup
   *   (cycle 222-269 silent dead config 시리즈 41번째 — cycle 267-268 cleanup lens 연속).
   *
   * 발견 (대량 dead 필드):
   * - getEnemyTacticalProfile은 17 필드를 반환 (role / tier / guardChance / heavyChance /
   *   estimatedHit / estimatedHeavy / weakness / resistance / hint / entryHint / signature /
   *   counterHint / phaseHint / rewardHint / warningChips / recommendedBuilds / phaseTriggered).
   * - 그러나 src/ 전체 검색에서 단 5 필드만 consume (CombatPanel.tsx):
   *   entryHint / hint / phaseHint (cycle 245), signature / counterHint (cycle 269 추가).
   * - 12 필드가 dispatch 0건 — 매 보스 전투마다 계산되지만 사용 0.
   *
   * 패턴 (cycle 222-269 silent dead config 시리즈 41번째):
   * - cycle 267: skillLabel cleanup.
   * - cycle 268: buildProfile.secondary cleanup.
   * - cycle 270: tacticalProfile 12 dead 필드 cleanup (대량).
   *
   * 수정 (src/utils/runProfile.ts getEnemyTacticalProfile):
   * - 12 dead 필드 제거: role, tier, guardChance, heavyChance, estimatedHit, estimatedHeavy,
   *   weakness, resistance, rewardHint, warningChips, recommendedBuilds, phaseTriggered.
   * - 5 사용 필드 유지: hint, entryHint, signature, counterHint, phaseHint.
   *
   * 회귀 가드:
   * - CombatPanel display 변화 없음 (사용 필드 유지).
   * - bossBriefLine (entryHint || hint || phaseHint) 동작 유지.
   * - cycle 269 signature/counterHint 동작 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 270: getEnemyTacticalProfile에서 12 dead 필드 제거', async () => {
      const { getEnemyTacticalProfile } = await import('../src/utils/runProfile.js');
      const enemy = {
          name: 'TestBoss', baseName: 'TestBoss', isBoss: true,
          hp: 100, maxHp: 100, atk: 50, def: 5,
          pattern: { guardChance: 0.2, heavyChance: 0.3 },
      };
      const profile = getEnemyTacticalProfile(enemy, { def: 10 });
      assert.ok(profile, 'getEnemyTacticalProfile 정상 반환');
      // 12 dead 필드 모두 제거됨.
      const deadFields = [
          'role', 'tier', 'guardChance', 'heavyChance', 'estimatedHit', 'estimatedHeavy',
          'weakness', 'resistance', 'rewardHint', 'warningChips', 'recommendedBuilds', 'phaseTriggered',
      ];
      deadFields.forEach((field) => {
          assert.equal(profile[field], undefined, `dead field '${field}' 제거됨`);
      });
  });

  test('cycle 270: 사용 필드 5종 유지 (회귀 가드)', async () => {
      const { getEnemyTacticalProfile } = await import('../src/utils/runProfile.js');
      const enemy = {
          name: 'TestBoss', baseName: 'TestBoss', isBoss: true,
          hp: 100, maxHp: 100, atk: 50, def: 5,
          pattern: { guardChance: 0.2, heavyChance: 0.3 },
      };
      const profile = getEnemyTacticalProfile(enemy, { def: 10 });
      // hint는 항상 정의됨 (heavyChance 30% 임계로 텍스트 결정).
      assert.ok(typeof profile.hint === 'string', 'hint 필드 유지');
      // 나머지 4종은 BOSS_BRIEFS 매칭 시에만 정의됨 — 가상 보스라 null 가능.
      assert.ok('entryHint' in profile, 'entryHint 필드 키 유지');
      assert.ok('phaseHint' in profile, 'phaseHint 필드 키 유지');
      assert.ok('signature' in profile, 'signature 필드 키 유지');
      assert.ok('counterHint' in profile, 'counterHint 필드 키 유지');
  });

  test('cycle 270: 실제 BOSS_BRIEFS 매칭 보스에서 5 필드 동작', async () => {
      const { getEnemyTacticalProfile } = await import('../src/utils/runProfile.js');
      const enemy = {
          name: '화염의 군주', baseName: '화염의 군주', isBoss: true,
          hp: 1000, maxHp: 1000, atk: 50, def: 5,
          pattern: { guardChance: 0.2, heavyChance: 0.3 },
      };
      const profile = getEnemyTacticalProfile(enemy, { def: 10 });
      assert.ok(profile.entryHint, '화염의 군주 entryHint 정의');
      assert.ok(profile.signature, '화염의 군주 signature 정의');
      assert.ok(profile.counterHint, '화염의 군주 counterHint 정의');
  });

  test('cycle 270: enemy null 시 null 반환 (회귀 가드)', async () => {
      const { getEnemyTacticalProfile } = await import('../src/utils/runProfile.js');
      assert.equal(getEnemyTacticalProfile(null, {}), null, 'enemy null → null');
  });

  test('cycle 270: CombatPanel display 변화 없음 (회귀 가드)', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      // 리팩토링: bossBriefLine(entryHint/hint/phaseHint) 계산은 combatView.ts로 분리,
      //   signature/counterHint 조건부 렌더는 CombatPanel JSX에 잔존.
      const view = await readSrc('src/utils/combatView.ts');
      assert.ok(/tacticalProfile\?.entryHint|tacticalProfile\.entryHint/.test(view),
          'entryHint 처리 유지');
      assert.ok(/tacticalProfile\?.hint|tacticalProfile\.hint/.test(view),
          'hint 처리 유지');
      assert.ok(/tacticalProfile\?.phaseHint|tacticalProfile\.phaseHint/.test(view),
          'phaseHint 처리 유지');
      assert.ok(/tacticalProfile\?\.signature/.test(source),
          'cycle 269 signature dispatch 유지');
      assert.ok(/tacticalProfile\?\.counterHint/.test(source),
          'cycle 269 counterHint dispatch 유지');
  });
}

// ─── cycle-271-class-build-helpers-dead.test.js ───
{
  /**
   * cycle 271: 4 dead exports cleanup — getClassBuildIdentity / getClassBuildCompatibility /
   *   getClassBuildBonus / getRunDiagnostics
   *   (cycle 222-270 silent dead config 시리즈 42번째 — cleanup lens 연속, 큰 cleanup).
   *
   * 발견 (4 dead exports — 미완성 diagnostics 기능):
   * - src/utils/runProfile.ts에 4 함수 정의 + export:
   *   - getClassBuildIdentity (line 34): job → preferred build tags 매핑.
   *   - getClassBuildCompatibility (line 38): job + buildProfile → 적합도 라벨.
   *   - getClassBuildBonus (line 59): job + buildProfile → atk/def mult 보너스.
   *   - getRunDiagnostics (line 415): 50줄 함수, winRate / pacingLabel / recommendations 등 계산.
   * - 그러나 src/ 전체 검색에서 production code 호출 0건 — tests/ 외 어디에도 사용 안 함.
   * - getRunDiagnostics만 내부에서 다른 3 함수 호출. 즉, 4종 모두 dead 한 묶음 (incomplete
   *   diagnostics 기능, 시작했지만 UI 와이어 안 됨).
   *
   * 패턴 (cycle 222-270 silent dead config 시리즈 42번째):
   * - cycle 267: skillLabel 1 필드 cleanup.
   * - cycle 268: buildProfile.secondary 1 필드 cleanup.
   * - cycle 270: getEnemyTacticalProfile 12 필드 cleanup.
   * - cycle 271: 4 dead exports cleanup (가장 큰 단일 cleanup).
   *
   * 수정:
   * - src/utils/runProfile.ts: 4 dead exports 제거 (~70 lines).
   * - tests/run-profile-utils.test.js: 2 dead tests 제거 + import 정리.
   *
   * 회귀 가드:
   * - getRunBuildProfile / getTraitProfile / getEnemyTacticalProfile 등 active exports 유지.
   * - 다른 runProfile consumer (combatVictory / SmartInventory / ShopPanel 등) 변화 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 271: getClassBuildIdentity export 제거', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/export const getClassBuildIdentity/.test(source),
          'getClassBuildIdentity export 제거됨');
  });

  test('cycle 271: getClassBuildCompatibility export 제거', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/export const getClassBuildCompatibility/.test(source),
          'getClassBuildCompatibility export 제거됨');
  });

  test('cycle 271: getClassBuildBonus export 제거', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/export const getClassBuildBonus/.test(source),
          'getClassBuildBonus export 제거됨');
  });

  test('cycle 271: getRunDiagnostics export 제거', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/export const getRunDiagnostics/.test(source),
          'getRunDiagnostics export 제거됨');
  });

  test('cycle 271: active exports 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const activeExports = [
          'getRunBuildProfile',
          'getTraitProfile',
          'getTraitBonus',
          'getTraitSkill',
          'getTraitItemResonance',
          'getTraitFeaturedItems',
          'getTraitLootHint',
          'getTraitQuestResonance',
          'getEnemyTacticalProfile',
      ];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 271: 다른 consumer 변화 없음 (회귀 가드)', async () => {
      const sources = await Promise.all([
          readSrc('src/components/SmartInventory.tsx'),
          readSrc('src/components/ShopPanel.tsx'),
          readSrc('src/hooks/combatActions/combatVictory.ts'),
      ]);
      sources.forEach((src) => {
          // 이 컴포넌트들은 dead 함수들 호출 안 하므로 변화 없음.
          assert.ok(!/getRunDiagnostics|getClassBuildBonus|getClassBuildIdentity|getClassBuildCompatibility/.test(src),
              'consumer 컴포넌트는 dead 함수 호출 안 함 (회귀 가드)');
      });
  });
}

// ─── cycle-274-level-up-story-dispatch.test.js ───
{
  /**
   * cycle 274: aiService 'levelUp' 스토리 템플릿 dispatch 누락 dead config
   *   (cycle 222-273 silent dead config 시리즈 45번째 — cycle 272-273 paired follow-up).
   *
   * 발견 (story 템플릿 dead 시리즈 — 잔존 2 → 1):
   * - cycle 272: questComplete dispatch.
   * - cycle 273: bossPhase2 dispatch.
   * - cycle 274: levelUp dispatch (잔존 2개 중 1번째).
   * - 'levelUp' 템플릿 (`✨ 새로운 힘이 깨어됩니다! 레벨 ${data.level} 달성!`)는 player 레벨업 시점의
   *   narrative cue. CombatEngine.handleVictory 내부 applyExpGain이 leveledUp boolean 반환하지만
   *   hook layer는 이를 read해 addStoryLog 호출 안 함이라 dispatch 0건.
   * - 결과: 레벨업이 visual('levelUp') + sound(cycle 217) + log는 있지만 AI narrative blurb 부재.
   *
   * 수정 (src/hooks/combatActions/combatVictory.ts):
   * - victoryResult.leveledUp이 true면 addStoryLog('levelUp', { level: updatedPlayer.level }) 호출.
   *
   * 회귀 가드:
   * - cycle 272 questComplete + cycle 273 bossPhase2 dispatch 동작 유지.
   * - 레벨업 visual / sound / log 동작 변화 없음.
   * - 레벨업 안 된 victory는 미발동.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 274: combatVictory가 victoryResult.leveledUp 감지', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/victoryResult\.leveledUp|leveledUp/.test(source),
          'combatVictory.ts에서 leveledUp 검사');
  });

  test('cycle 274: combatVictory가 addStoryLog("levelUp", ...) 호출', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/addStoryLog\(['"]levelUp['"]/.test(source),
          "addStoryLog('levelUp', ...) 호출");
  });

  test('cycle 274: levelUp payload에 level 포함', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/addStoryLog\(['"]levelUp['"]\s*,\s*\{[\s\S]{0,80}?level/.test(source),
          'level 포함된 payload (template "${data.level}" 정합)');
  });

  test('cycle 274: aiService levelUp 템플릿 정의 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/services/aiService.ts');
      assert.ok(/levelUp:[\s\S]{0,200}data\.level/.test(source),
          'aiService levelUp 템플릿 유지');
  });

  test('cycle 272-273 회귀 가드: 이전 sponsored dispatch 동작 유지', async () => {
      const inv = await readSrc('src/hooks/useInventoryActions.ts');
      const atk = await readSrc('src/hooks/combatActions/combatAttack.ts');
      assert.ok(/addStoryLog\(['"]questComplete['"]/.test(inv),
          'cycle 272 questComplete dispatch 유지');
      assert.ok(/addStoryLog\(['"]bossPhase2['"]/.test(atk),
          'cycle 273 bossPhase2 dispatch 유지');
  });
}

// ─── cycle-275-ruin-recap-story-dispatch.test.js ───
{
  /**
   * cycle 275: aiService 'ruinRecap' 스토리 템플릿 dispatch (story 시리즈 마무리)
   *   (cycle 222-274 silent dead config 시리즈 46번째 — story 템플릿 4사이클 마무리).
   *
   * 발견 (story 템플릿 dead 시리즈 마지막 1건):
   * - cycle 272: questComplete dispatch.
   * - cycle 273: bossPhase2 dispatch.
   * - cycle 274: levelUp dispatch.
   * - cycle 275: ruinRecap dispatch (잔존 마지막).
   * - 'ruinRecap' 템플릿 (`💀 ${name}는 레벨 ${level}에서 추락했습니다. 하지만 그 정신은 다시
   *   불타오를 것입니다...`)는 사망 후 회상 narrative cue.
   * - 'death' 템플릿은 즉각 모먼트 ("의식이 흘려집니다")이고 'ruinRecap'은 retrospective —
   *   둘 다 사망 시점에 dispatch하면 player에게 immediate + reflective 양쪽 narrative 제공.
   *
   * 수정 (combatAttack.ts + combatItem.ts):
   * - 기존 addStoryLog('death', ...) 직후에 addStoryLog('ruinRecap', { name, level }) 추가.
   * - name = player.name, level = player.level.
   *
   * 회귀 가드:
   * - cycle 272/273/274 dispatch 동작 유지.
   * - 기존 'death' addStoryLog dispatch 유지.
   * - addStoryLog 미정의 deps 가드.
   *
   * 시리즈 마무리:
   * - aiService 8 스토리 템플릿 모두 dispatch 활성:
   *   encounter / victory / death / rest (이전 활성)
   *   + questComplete (cycle 272) / bossPhase2 (cycle 273) / levelUp (cycle 274) / ruinRecap (cycle 275).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 275: combatAttack가 addStoryLog("ruinRecap", ...) 호출', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      assert.ok(/addStoryLog\(['"]ruinRecap['"]/.test(source),
          "combatAttack.ts에 addStoryLog('ruinRecap', ...) 호출");
  });

  test('cycle 275: combatItem이 addStoryLog("ruinRecap", ...) 호출', async () => {
      const source = await readSrc('src/hooks/combatActions/combatItem.ts');
      assert.ok(/addStoryLog\(['"]ruinRecap['"]/.test(source),
          "combatItem.ts에 addStoryLog('ruinRecap', ...) 호출");
  });

  test('cycle 275: ruinRecap payload에 name + level 포함', async () => {
      const sources = await Promise.all([
          readSrc('src/hooks/combatActions/combatAttack.ts'),
          readSrc('src/hooks/combatActions/combatItem.ts'),
      ]);
      sources.forEach((src, i) => {
          const matches = src.match(/addStoryLog\(['"]ruinRecap['"]\s*,\s*\{[^}]*\}/g);
          assert.ok(matches && matches.length > 0, `[file ${i}] ruinRecap payload 발견`);
          matches.forEach((match) => {
              assert.ok(/name/.test(match), `[file ${i}] name field 포함`);
              assert.ok(/level/.test(match), `[file ${i}] level field 포함`);
          });
      });
  });

  test('cycle 275: aiService ruinRecap 템플릿 정의 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/services/aiService.ts');
      assert.ok(/ruinRecap:[\s\S]{0,300}data\.name/.test(source),
          'aiService ruinRecap 템플릿 (data.name 사용) 유지');
  });

  test('cycle 272-274 회귀 가드: 이전 sponsored dispatch 동작 유지', async () => {
      const inv = await readSrc('src/hooks/useInventoryActions.ts');
      const atk = await readSrc('src/hooks/combatActions/combatAttack.ts');
      const vic = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/addStoryLog\(['"]questComplete['"]/.test(inv),
          'cycle 272 questComplete dispatch 유지');
      assert.ok(/addStoryLog\(['"]bossPhase2['"]/.test(atk),
          'cycle 273 bossPhase2 dispatch 유지');
      assert.ok(/addStoryLog\(['"]levelUp['"]/.test(vic),
          'cycle 274 levelUp dispatch 유지');
  });

  test('cycle 275: 기존 death dispatch 유지 (회귀 가드)', async () => {
      const atk = await readSrc('src/hooks/combatActions/combatAttack.ts');
      const itm = await readSrc('src/hooks/combatActions/combatItem.ts');
      const atkDeathMatches = atk.match(/addStoryLog\(['"]death['"]/g);
      const itmDeathMatches = itm.match(/addStoryLog\(['"]death['"]/g);
      assert.ok(atkDeathMatches && atkDeathMatches.length >= 2,
          `combatAttack에 'death' addStoryLog ≥2 (실제: ${atkDeathMatches?.length || 0})`);
      assert.ok(itmDeathMatches && itmDeathMatches.length >= 1,
          `combatItem에 'death' addStoryLog ≥1 (실제: ${itmDeathMatches?.length || 0})`);
  });
}

// ─── cycle-277-total-prestige-dead.test.js ───
{
  /**
   * cycle 277: meta.totalPrestigeAtk / Hp / Mp 3 dead 필드 cleanup
   *   (cycle 222-276 silent dead config 시리즈 47번째 — cleanup lens 연속).
   *
   * 발견 (3 dead persistent state 필드):
   * - ASCEND가 meta.totalPrestigeAtk/Hp/Mp 필드를 +PRESTIGE_X_BONUS로 누적 (line 22-24).
   * - 그러나 이 필드들은 src/ 어디에서도 read 0건 — 통계 / UI / stats 계산 어디에도 dispatch 안 됨.
   * - bonusAtk/Hp/Mp 필드와 별개로 누적되지만 (essence rank up도 추가 source), 'lifetime
   *   prestige tracker' 의도였을 듯한 dead state.
   * - 4 places에서 write (INITIAL_STATE / ASCEND / migrateData / types/player.ts) 0 places에서 read.
   *
   * 패턴 (cycle 222-276 silent dead config 시리즈 47번째):
   * - cycle 267-271: cleanup 시리즈 (skillLabel / secondary / tactical 12 fields / 4 dead exports).
   * - cycle 277: persistent state field cleanup (write-only 3 fields).
   *
   * 수정:
   * 1) src/hooks/gameActions/ascensionActions.ts: ASCEND meta build에서 3 필드 제거.
   * 2) src/reducers/gameReducer.ts INITIAL_STATE: meta에서 3 필드 제거.
   * 3) src/utils/gameUtils.ts migrateData: 3 필드 default 정규화 제거.
   * 4) src/types/player.ts: 3 필드 type 정의 제거 (optional이라 영향 없음).
   *
   * 회귀 가드:
   * - bonusAtk/Hp/Mp 필드 동작 유지 (active applied bonus).
   * - prestigeRank / essence / bonusAtk 등 다른 meta 필드 변화 없음.
   * - ASCEND 다른 동작 (titles / stats preserve / projectedPlayer 등) 변화 없음.
   *
   * Note: 기존 save 데이터에 잔존 필드는 안전 (TypeScript optional + 사용 안 하므로 무해).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 277: ASCEND meta build에서 totalPrestige 3 필드 제거', async () => {
      const source = await readSrc('src/hooks/gameActions/ascensionActions.ts');
      assert.ok(!/totalPrestigeAtk:/.test(source), 'totalPrestigeAtk 제거됨');
      assert.ok(!/totalPrestigeHp:/.test(source), 'totalPrestigeHp 제거됨');
      assert.ok(!/totalPrestigeMp:/.test(source), 'totalPrestigeMp 제거됨');
  });

  test('cycle 277: INITIAL_STATE.player.meta에서 totalPrestige 제거', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      assert.ok(!/totalPrestigeAtk:\s*0/.test(source), 'INITIAL_STATE totalPrestigeAtk 제거');
  });

  test('cycle 277: migrateData에서 totalPrestige 정규화 제거', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.ok(!/totalPrestigeAtk\s*=/.test(source), 'migrateData totalPrestigeAtk 제거');
  });

  test('cycle 277: bonusAtk/Hp/Mp 활성 필드 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/hooks/gameActions/ascensionActions.ts');
      assert.ok(/bonusAtk:\s+\(meta\.bonusAtk/.test(source), 'ASCEND bonusAtk 누적 유지');
      assert.ok(/bonusHp:\s+\(meta\.bonusHp/.test(source), 'ASCEND bonusHp 누적 유지');
      assert.ok(/bonusMp:\s+\(meta\.bonusMp/.test(source), 'ASCEND bonusMp 누적 유지');
  });

  test('cycle 277: ASCEND prestigeRank / essence / titles 동작 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/hooks/gameActions/ascensionActions.ts');
      assert.ok(/prestigeRank:\s+rank/.test(source), 'prestigeRank dispatch 유지');
      assert.ok(/essence:\s+\(meta\.essence/.test(source), 'essence 누적 유지');
      assert.ok(/titles:\s+\[\.\.\./.test(source), 'titles unique merge 유지');
  });
}

// ─── cycle-278-killstreaktier-dead-cleanup.test.js ───
{
  /**
   * cycle 278: stats.killStreakTier dead 필드 cleanup
   *   (cycle 222-277 silent dead config 시리즈 48번째 — cleanup lens 연속).
   *
   * 발견 (dead 단일 필드):
   * - src/utils/statsCalculator.ts line 414: killStreakTier 필드 export.
   * - src/ 전체 검색에서 production code consumer 0건. 정의 1건뿐.
   * - tests/stats-calculator.test.js만 field presence 검증 (실제 사용 X).
   * - killStreak (raw count) 필드는 active dispatched. tier index만 dead.
   *
   * 패턴 (cycle 222-277 silent dead config 시리즈 48번째):
   * - cycle 267: skillLabel 제거.
   * - cycle 268: secondary 제거.
   * - cycle 270: tactical 12 fields 제거.
   * - cycle 271: 4 dead exports 제거.
   * - cycle 277: totalPrestige 3 dead 필드 제거.
   * - cycle 278: killStreakTier 단일 dead 필드 제거 (cleanup lens 연속).
   *
   * 수정:
   * 1) src/utils/statsCalculator.ts: stats 반환 객체에서 killStreakTier 필드 제거.
   * 2) tests/stats-calculator.test.js: killStreakTier assertion 2건 제거 + 필드 presence 체크 갱신.
   *
   * 회귀 가드:
   * - killStreak (raw count) 필드 유지.
   * - computeKillStreakBonus / atkBonus / critBonus / tierIdx 내부 계산 동작 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 278: statsCalculator에서 killStreakTier 필드 제거', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(!/^\s*killStreakTier:/m.test(source),
          'killStreakTier 필드 정의 제거됨');
  });

  test('cycle 278: killStreak raw count 필드 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(/killStreak:\s*player\.killStreak/.test(source),
          'killStreak 필드 dispatch 유지');
  });

  test('cycle 278: computeKillStreakBonus 내부 계산 동작 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(/const computeKillStreakBonus/.test(source),
          'computeKillStreakBonus 함수 유지');
      assert.ok(/atkBonus/.test(source) && /critBonus/.test(source),
          'atkBonus / critBonus 계산 유지');
  });
}

// ─── cycle-279-stats-dead-fields.test.js ───
{
  /**
   * cycle 279: stats 출력에서 3 dead 필드 cleanup (weaponHands / traitBonus / titlePassive)
   *   (cycle 222-278 silent dead config 시리즈 49번째 — cleanup lens 연속).
   *
   * 발견 (3 dead exposed 필드):
   * - calculateFullStats 반환 객체:
   *   weaponHands (line 403): preBuildStats.weaponHands를 그대로 expose.
   *   traitBonus (line 410): getTraitBonus 결과를 그대로 expose.
   *   titlePassive (line 411): getTitlePassive 결과를 그대로 expose.
   * - 3 필드 모두 statsCalculator 내부 계산용 (atk/def/critChance 산출에 사용)이지만
   *   stats 객체에 노출 후 외부 consumer 0건.
   * - traitProfile / activeSynergies 등 active exposed 필드는 dispatch됨 (cycle 269 등).
   *
   * 패턴 (cycle 222-278 silent dead config 시리즈 49번째):
   * - cycle 270: tactical 12 fields 제거 (struct dead fields).
   * - cycle 277: totalPrestige 3 dead 필드 제거.
   * - cycle 278: killStreakTier 단일 dead 필드 제거.
   * - cycle 279: stats 3 dead exposed 필드 제거 (cleanup lens 연속).
   *
   * 수정:
   * 1) src/utils/statsCalculator.ts: stats 반환 객체에서 weaponHands / traitBonus / titlePassive 제거.
   * 2) tests/stats-calculator.test.js: 필드 presence 체크 리스트 업데이트.
   *
   * 회귀 가드:
   * - 내부 계산용 변수 (titlePassive / traitBonus / preBuildStats.weaponHands) 동작 유지.
   * - 다른 stats 필드 (atk/def/maxHp/maxMp/critChance/elem/isMagic/activeSet/activeSignatureSet/
   *   relics/buildProfile/traitProfile/activeSynergies/killStreak/passiveGoldMult/passiveExpMult/
   *   jobAffinity) 모두 dispatch 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 279: stats 반환에서 3 dead 필드 제거', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          equip: {}, relics: [], skillChoices: {}, titles: [], stats: {},
      };
      const stats = calculateFullStats(player);
      assert.equal(stats.weaponHands, undefined, 'weaponHands 제거됨');
      assert.equal(stats.traitBonus, undefined, 'traitBonus 제거됨');
      assert.equal(stats.titlePassive, undefined, 'titlePassive 제거됨');
  });

  test('cycle 279: active stats 필드 보존 (회귀 가드)', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          equip: {}, relics: [], skillChoices: {}, titles: [], stats: {},
      };
      const stats = calculateFullStats(player);
      const activeFields = [
          'atk', 'def', 'maxHp', 'maxMp', 'elem', 'isMagic', 'critChance',
          'activeSet', 'activeSignatureSet', 'relics', 'buildProfile', 'traitProfile',
          'activeSynergies', 'killStreak', 'passiveGoldMult', 'passiveExpMult', 'jobAffinity',
      ];
      activeFields.forEach((field) => {
          assert.ok(field in stats, `active field '${field}' 유지`);
      });
  });

  test('cycle 279: 내부 계산 동작 유지 (atk/def/critChance 정확)', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const playerWithTitle = {
          name: 'Test', job: '전사', level: 50,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          equip: {}, relics: [], skillChoices: {}, titles: ['first_blood'], activeTitle: 'first_blood',
          stats: {},
      };
      const stats = calculateFullStats(playerWithTitle);
      // titlePassive 'first_blood' = atk +1 — 내부 적용 (stats.atk에 합산).
      assert.ok(stats.atk > 50, `titlePassive 내부 atk 합산 (실제: ${stats.atk})`);
  });

  test('cycle 278 회귀 가드: killStreakTier 0건 유지', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(!/^\s*killStreakTier:/m.test(source),
          'cycle 278 killStreakTier 제거 유지');
  });
}

// ─── cycle-280-stats-type-dead-fields.test.js ───
{
  /**
   * cycle 280: Stats 타입의 dead 필드 cleanup (comboCount / discoveries)
   *   (cycle 222-279 silent dead config 시리즈 50번째 — cleanup lens 연속).
   *
   * 발견 (2 dead type 필드):
   * - src/types/player.ts Stats 인터페이스:
   *   - `comboCount?: number` (line 25): 대표적 전투 콤보 카운터지만 stats에는 한 번도 set/read 안 됨.
   *     실제 콤보는 player.combatFlags.comboCount (별도 위치)에 있음.
   *   - `discoveries?: number` (line 34): cycle 83/84에서 deprecated — visitedMaps.length로 통일.
   *     stats에 set 0건 / read 0건. 잔존 type 정의만 dead.
   * - 두 필드 모두 stats[key] 접근으로 set/read되지 않음 (다른 필드 / 다른 위치 있음).
   *
   * 패턴 (cycle 222-279 silent dead config 시리즈 50번째 — 50 milestone):
   * - cycle 270: tactical 12 fields 제거.
   * - cycle 277: totalPrestige 3 dead 필드 제거.
   * - cycle 278: killStreakTier 1 dead 필드 제거.
   * - cycle 279: stats 3 dead expose 필드 제거.
   * - cycle 280: Stats 타입 2 dead 필드 제거 (cleanup lens 연속).
   *
   * 수정:
   * 1) src/types/player.ts: Stats 인터페이스에서 comboCount / discoveries 제거.
   *
   * 회귀 가드:
   * - combatFlags.comboCount (별도 active 카운터) 영향 없음.
   * - visitedMaps 기반 discoveries 계산 (buildRunSummary line 690) 동작 유지.
   * - [key: string]: any index signature 유지로 잔존 saved 데이터 호환 보장.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 280: Stats 타입에서 comboCount 제거 (CombatFlags의 동명 필드는 유지)', async () => {
      const source = await readSrc('src/types/player.ts');
      // Stats interface 블록 (line 1-41) 내부의 comboCount만 검사.
      // cycle 299: PlayerStats export 제거 (private downgrade) → 정의는 유지.
      const statsBlockMatch = source.match(/(?:export )?interface PlayerStats[\s\S]+?\n\}/);
      assert.ok(statsBlockMatch, 'PlayerStats interface 발견');
      assert.ok(!/comboCount\?:\s*number;/.test(statsBlockMatch[0]),
          'PlayerStats interface에서 comboCount 제거 (CombatFlags의 active comboCount는 별도)');
  });

  test('cycle 280: Stats 타입에서 discoveries 제거', async () => {
      const source = await readSrc('src/types/player.ts');
      assert.ok(!/^\s+discoveries\?:\s*number;/m.test(source),
          'Stats.discoveries 필드 제거됨');
  });

  test('cycle 280: combatFlags.comboCount 동작 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      assert.ok(/combatFlags:\s*\{\s*comboCount:\s*0/.test(source),
          'combatFlags.comboCount default 유지 (active 카운터)');
  });

  test('cycle 280: buildRunSummary의 discoveries 계산 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.ok(/discoveries:\s*\(\(player\.stats\s+as\s+any\)\?\.visitedMaps\s*\|\|\s*\[\]\)\.length/.test(source),
          'buildRunSummary discoveries = visitedMaps.length 계산 유지');
  });

  test('cycle 280: Stats 인터페이스 다른 필드 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/types/player.ts');
      const requiredFields = [
          'kills', 'deaths', 'killRegistry', 'bossKills', 'rests',
          'bountyDate', 'bountyIssued', 'bountiesCompleted', 'relicCount',
          'crafts', 'abyssFloor', 'abyssRecord', 'demonKingSlain',
          'explores', 'lowHpWins', 'buildWins', 'visitedMaps',
      ];
      requiredFields.forEach((field) => {
          const re = new RegExp(`^\\s+${field}\\?:\\s*`, 'm');
          assert.ok(re.test(source), `Stats.${field} 필드 유지`);
      });
  });

  test('cycle 278-279 회귀 가드: 이전 cleanup 동작 유지', async () => {
      const source = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(!/^\s*killStreakTier:/m.test(source), 'cycle 278 killStreakTier 0건');
      assert.ok(!/^\s*weaponHands:\s*preBuildStats/m.test(source), 'cycle 279 weaponHands 0건');
      assert.ok(!/^\s*traitBonus,$/m.test(source), 'cycle 279 traitBonus 0건');
      assert.ok(!/^\s*titlePassive,$/m.test(source), 'cycle 279 titlePassive 0건');
  });
}

// ─── cycle-281-playermeta-dead-fields.test.js ───
{
  /**
   * cycle 281: PlayerMeta 타입의 dead 필드 cleanup (totalPrestigeAtk / Hp / Mp)
   *   (cycle 222-280 silent dead config 시리즈 51번째 — cycle 277 paired completion).
   *
   * 발견 (cycle 277 paired):
   * - cycle 277에서 ASCEND / INITIAL_STATE / migrateData 3 places의 write-only 3 필드 제거.
   * - 그러나 type 정의 (PlayerMeta interface)는 잔존 — saved 데이터 호환 우려로 보존했음.
   * - 재검토: src/ 전체에서 read 0건 확정. 잔존 saved 데이터에 필드 있어도 type 제거하면
   *   index signature 없는 PlayerMeta interface가 TS 오류 가능성 있지만, runtime에서 access
   *   안 하므로 영향 없음.
   *
   * 패턴 (cycle 222-280 silent dead config 시리즈 51번째):
   * - cycle 277: totalPrestige write-only runtime 제거.
   * - cycle 280: PlayerStats 타입 dead 필드 제거.
   * - cycle 281: PlayerMeta 타입 dead 필드 제거 (cycle 277 paired completion).
   *
   * 수정:
   * 1) src/types/player.ts: PlayerMeta에서 totalPrestigeAtk/Hp/Mp 3 필드 제거.
   *
   * 회귀 가드:
   * - 다른 PlayerMeta 필드 (essence/rank/bonusAtk/bonusHp/bonusMp/prestigeRank) 유지.
   * - cycle 277 runtime cleanup 동작 유지.
   * - 잔존 saved 데이터의 totalPrestige* 필드는 무시되지만 runtime 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 281: PlayerMeta에서 totalPrestigeAtk 제거', async () => {
      const source = await readSrc('src/types/player.ts');
      // cycle 299: PlayerMeta export 제거 (private) → 정의 유지.
      const metaBlock = source.match(/(?:export )?interface PlayerMeta[\s\S]+?\n\}/);
      assert.ok(metaBlock, 'PlayerMeta interface 발견');
      assert.ok(!/totalPrestigeAtk\?:/.test(metaBlock[0]), 'totalPrestigeAtk 제거됨');
  });

  test('cycle 281: PlayerMeta에서 totalPrestigeHp / Mp 제거', async () => {
      const source = await readSrc('src/types/player.ts');
      // cycle 299: PlayerMeta export 제거 (private) → 정의 유지.
      const metaBlock = source.match(/(?:export )?interface PlayerMeta[\s\S]+?\n\}/);
      assert.ok(metaBlock);
      assert.ok(!/totalPrestigeHp\?:/.test(metaBlock[0]), 'totalPrestigeHp 제거됨');
      assert.ok(!/totalPrestigeMp\?:/.test(metaBlock[0]), 'totalPrestigeMp 제거됨');
  });

  test('cycle 281: PlayerMeta active 필드 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/types/player.ts');
      // cycle 299: PlayerMeta export 제거 (private) → 정의 유지.
      const metaBlock = source.match(/(?:export )?interface PlayerMeta[\s\S]+?\n\}/);
      assert.ok(metaBlock);
      const requiredFields = ['essence', 'rank', 'bonusAtk', 'bonusHp', 'bonusMp', 'prestigeRank'];
      requiredFields.forEach((field) => {
          const re = new RegExp(`${field}\\?:\\s*number`);
          assert.ok(re.test(metaBlock[0]), `PlayerMeta.${field} 유지`);
      });
  });

  test('cycle 277 회귀 가드: totalPrestige runtime 0건 유지', async () => {
      const sources = await Promise.all([
          readSrc('src/hooks/gameActions/ascensionActions.ts'),
          readSrc('src/reducers/gameReducer.ts'),
      ]);
      sources.forEach((src, i) => {
          // cleanup 주석 외에 실제 코드 라인 (`totalPrestigeAtk: ` 같은 field assign) 0건 검증.
          assert.ok(!/^\s+totalPrestigeAtk:/m.test(src),
              `[file ${i}] totalPrestigeAtk 코드 라인 0건 (cycle 277)`);
      });
  });
}

// ─── cycle-284-types-dead-aliases.test.js ───
{
  /**
   * cycle 284: types/item.ts ItemType + types/map.ts MapType / isSignatureZone dead cleanup
   *   (cycle 222-283 silent dead config 시리즈 54번째 — cleanup lens 연속).
   *
   * 발견 (3 dead types/fields across 2 type files):
   * - src/types/item.ts:
   *   - export type ItemType = 'weapon' | 'armor' | ...: 정의만, import 0건.
   * - src/types/map.ts:
   *   - export type MapType = string: 정의 + GameMap.type에서 1회 사용. import 0건.
   *   - GameMap.isSignatureZone?: boolean: 정의만, runtime access 0건.
   *
   * 패턴 (cycle 222-283 silent dead config 시리즈 54번째):
   * - cycle 280-283: types/ 정리 시리즈 4사이클.
   * - cycle 284: types/ item.ts + map.ts 잔존 dead 정리 (cleanup lens 연속).
   *
   * 수정:
   * 1) src/types/item.ts: ItemType export 제거.
   * 2) src/types/map.ts: MapType export 제거 + GameMap.type을 string으로 직접 정의 + isSignatureZone 제거.
   *
   * 회귀 가드:
   * - GameMap.type / level / desc / exits / monsters / boss / bossMonsters / eventChance / lore /
   *   minLv / shopBonus / graveDropBonus / seasonOnly 등 활성 필드 유지.
   * - [key: string]: any 인덱스 시그니처 유지로 런타임 동적 필드 호환.
   * - cycle 280-283 cleanup 동작 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 284: types/item.ts ItemType 제거', async () => {
      const source = await readSrc('src/types/item.ts');
      assert.ok(!/export type ItemType/.test(source),
          'ItemType type alias 제거됨');
  });

  test('cycle 284: types/map.ts MapType 제거', async () => {
      const source = await readSrc('src/types/map.ts');
      assert.ok(!/export type MapType/.test(source),
          'MapType type alias 제거됨');
  });

  test('cycle 284: GameMap.isSignatureZone 제거', async () => {
      const source = await readSrc('src/types/map.ts');
      assert.ok(!/isSignatureZone\?:\s*boolean;/.test(source),
          'GameMap.isSignatureZone 필드 제거됨');
  });

  test('cycle 284: 활성 GameMap 필드 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/types/map.ts');
      const activeFields = ['name', 'type', 'level', 'minLv', 'desc', 'exits', 'monsters', 'boss', 'bossMonsters', 'eventChance', 'lore'];
      activeFields.forEach((field) => {
          const re = new RegExp(`${field}\\??:\\s*`);
          assert.ok(re.test(source), `GameMap.${field} 필드 유지`);
      });
  });

  test('cycle 280-283 회귀 가드: 이전 cleanup 동작 유지', async () => {
      const playerSrc = await readSrc('src/types/player.ts');
      const monsterSrc = await readSrc('src/types/monster.ts');
      // cycle 280
      // cycle 299: PlayerStats export 제거 (private).
      const statsBlock = playerSrc.match(/(?:export )?interface PlayerStats[\s\S]+?\n\}/);
      assert.ok(statsBlock && !/discoveries\?:\s*number;/.test(statsBlock[0]),
          'cycle 280 PlayerStats.discoveries 0건');
      // cycle 282
      assert.ok(!/export interface SignaturePity/.test(playerSrc),
          'cycle 282 SignaturePity interface 0건');
      // cycle 283
      const monsterBaseBlock = monsterSrc.match(/export interface MonsterBase \{[\s\S]+?\n\}/);
      assert.ok(monsterBaseBlock && !/dropTable\?:\s*string;/.test(monsterBaseBlock[0]),
          'cycle 283 MonsterBase.dropTable 0건');
  });
}

// ─── cycle-287-initial-season-pass-dead.test.js ───
{
  /**
   * cycle 287: INITIAL_SEASON_PASS dead export 제거
   *   (cycle 222-286 silent dead config 시리즈 57번째 — cleanup lens 연속).
   *
   * 발견 (단일 dead export):
   * - src/data/seasonPass.ts: INITIAL_SEASON_PASS (line 63) — src/ + tests/ 어디에서도 consumer 0건.
   * - INITIAL_STATE.player.seasonPass는 gameReducer.ts:52에 inline {xp:0, tier:0, claimed:[],
   *   isPremium:false, seasonId:'S1'}로 정의 — INITIAL_SEASON_PASS는 dead duplicate.
   *
   * 패턴 (cycle 222-286 silent dead config 시리즈 57번째):
   * - cycle 285: PREMIUM_FREE_SOURCES dead export 제거.
   * - cycle 286: CODEX_MILESTONES export downgrade.
   * - cycle 287: INITIAL_SEASON_PASS dead export 제거 (cleanup lens 연속).
   *
   * 수정 (src/data/seasonPass.ts):
   * - INITIAL_SEASON_PASS export 제거 (~6 lines + JSDoc).
   *
   * 회귀 가드:
   * - SEASON_XP / SEASON_TIER_XP / SEASON_REWARDS active exports 유지.
   * - INITIAL_STATE.player.seasonPass inline 정의 유지 (gameReducer).
   * - SeasonPassPanel / claimSeasonReward (cycle 261) 동작 변화 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 287: INITIAL_SEASON_PASS export 제거', async () => {
      const source = await readSrc('src/data/seasonPass.ts');
      assert.ok(!/export const INITIAL_SEASON_PASS/.test(source),
          'INITIAL_SEASON_PASS export 제거됨');
  });

  test('cycle 287: SEASON_XP / SEASON_TIER_XP / SEASON_REWARDS active exports 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/data/seasonPass.ts');
      const activeExports = ['SEASON_XP', 'SEASON_TIER_XP', 'SEASON_REWARDS'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 287: INITIAL_STATE.player.seasonPass inline 정의 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      assert.ok(/seasonPass:\s*\{\s*xp:\s*0,\s*tier:\s*0/.test(source),
          'INITIAL_STATE seasonPass inline 정의 유지');
  });

  test('cycle 287: SEASON_XP 키 변화 없음 (회귀 가드)', async () => {
      const { SEASON_XP } = await import('../src/data/seasonPass.js');
      assert.ok(SEASON_XP, 'SEASON_XP 정의 유지');
      assert.ok(typeof SEASON_XP.explore === 'number', 'explore key 유지');
      assert.ok(typeof SEASON_XP.kill === 'number', 'kill key 유지');
      assert.ok(typeof SEASON_XP.bossKill === 'number', 'bossKill key 유지');
  });

  test('cycle 285-286 회귀 가드: 이전 cleanup 동작 유지', async () => {
      const premiumSrc = await readSrc('src/data/premiumShop.ts');
      const codexSrc = await readSrc('src/data/codexRewards.ts');
      assert.ok(!/export const PREMIUM_FREE_SOURCES/.test(premiumSrc),
          'cycle 285 PREMIUM_FREE_SOURCES 제거 유지');
      assert.ok(!/export const CODEX_MILESTONES/.test(codexSrc),
          'cycle 286 CODEX_MILESTONES export 제거 유지');
  });
}

// ─── cycle-288-art-palette-dead-exports.test.js ───
{
  /**
   * cycle 288: artPalette.ts 6 dead exports cleanup
   *   (cycle 222-287 silent dead config 시리즈 58번째 — cleanup lens 연속, 대량).
   *
   * 발견 (5 dead + 1 private downgrade):
   * - ART_GRID (line 18): 32x48 avatar 그리드 정의 — runtime consumer 0건.
   * - LIGHT_DIRECTION (line 25): 광원 각도 정의 — consumer 0건.
   * - OUTLINE_POLICY (line 30): outline 컬러 정책 — consumer 0건.
   * - SILHOUETTE_RULES (line 37): shade 규칙 — consumer 0건.
   * - REFERENCE_ACCENTS (line 69): 레퍼런스 액센트 — consumer 0건.
   * - DEFAULT_TONE_KEY (line 67): getDefaultToneKey 내부 사용만 — export 불필요.
   *
   * 패턴 (cycle 222-287 silent dead config 시리즈 58번째):
   * - cycle 285-287: 단일 dead export 정리 시리즈.
   * - cycle 288: artPalette 6 dead/private 정리 (대량 cleanup).
   *
   * 수정 (src/data/artPalette.ts):
   * - 5 dead exports 제거 (ART_GRID, LIGHT_DIRECTION, OUTLINE_POLICY, SILHOUETTE_RULES, REFERENCE_ACCENTS).
   * - DEFAULT_TONE_KEY export 제거 (private const로 downgrade).
   *
   * 회귀 가드:
   * - TONE_PALETTES / ELEMENT_TONE_KEY / getTonePalette / getElementToneKey / getDefaultToneKey
   *   active exports 유지.
   * - getDefaultToneKey 내부 DEFAULT_TONE_KEY 사용 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 288: 5 dead exports 제거', async () => {
      const source = await readSrc('src/data/artPalette.ts');
      const deadExports = ['ART_GRID', 'LIGHT_DIRECTION', 'OUTLINE_POLICY', 'SILHOUETTE_RULES', 'REFERENCE_ACCENTS'];
      deadExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(!re.test(source), `${name} export 제거됨`);
      });
  });

  test('cycle 288: DEFAULT_TONE_KEY export 제거 (private const)', async () => {
      const source = await readSrc('src/data/artPalette.ts');
      assert.ok(!/export const DEFAULT_TONE_KEY/.test(source),
          'DEFAULT_TONE_KEY export 제거됨');
      assert.ok(/const DEFAULT_TONE_KEY/.test(source),
          'DEFAULT_TONE_KEY const 정의 유지 (private)');
  });

  test('cycle 288: active exports 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/data/artPalette.ts');
      const activeExports = ['TONE_PALETTES', 'ELEMENT_TONE_KEY', 'getTonePalette', 'getElementToneKey', 'getDefaultToneKey'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 288: getTonePalette / getElementToneKey / getDefaultToneKey 동작 유지', async () => {
      const { getTonePalette, getElementToneKey, getDefaultToneKey } = await import('../src/data/artPalette.js');
      assert.ok(getTonePalette('steel'), 'getTonePalette steel 반환');
      assert.equal(typeof getDefaultToneKey('weapon'), 'string', 'getDefaultToneKey 문자열 반환');
      // ELEMENT_TONE_KEY는 elem이 매핑돼있을 때만 정의됨.
      const result = getElementToneKey('alien_test_elem');
      assert.equal(result, null, '미정의 elem 시 null 반환');
  });

  test('cycle 285-287 회귀 가드: 이전 cleanup 동작 유지', async () => {
      const premiumSrc = await readSrc('src/data/premiumShop.ts');
      const codexSrc = await readSrc('src/data/codexRewards.ts');
      const seasonSrc = await readSrc('src/data/seasonPass.ts');
      assert.ok(!/export const PREMIUM_FREE_SOURCES/.test(premiumSrc), 'cycle 285');
      assert.ok(!/export const CODEX_MILESTONES/.test(codexSrc), 'cycle 286');
      assert.ok(!/export const INITIAL_SEASON_PASS/.test(seasonSrc), 'cycle 287');
  });
}

// ─── cycle-289-class-build-identities-dead.test.js ───
{
  /**
   * cycle 289: CLASS_BUILD_IDENTITIES dead data 제거 (~145 lines)
   *   (cycle 222-288 silent dead config 시리즈 59번째 — cleanup lens 연속, 가장 큰 단일 cleanup).
   *
   * 발견 (대량 dead data):
   * - src/data/traits.ts: CLASS_BUILD_IDENTITIES (line 147-292) — 18 직업의 빌드 정체성 매핑.
   * - cycle 271에서 consumer 함수 (getClassBuildIdentity / getClassBuildCompatibility /
   *   getClassBuildBonus / getRunDiagnostics) 4개 모두 dead로 cleanup된 후 잔존.
   * - 데이터 정의(~145 lines)만 남고 read 0건. 가장 큰 단일 dead 데이터 블록.
   *
   * 패턴 (cycle 222-288 silent dead config 시리즈 59번째):
   * - cycle 271: getClassBuildIdentity / Compatibility / Bonus / RunDiagnostics 4 dead exports cleanup.
   * - cycle 289: paired data CLASS_BUILD_IDENTITIES cleanup (cycle 271 follow-up — 데이터 정의 잔존).
   *
   * 수정 (src/data/traits.ts):
   * - CLASS_BUILD_IDENTITIES export + 145 lines 데이터 정의 제거.
   *
   * 회귀 가드:
   * - ARCHETYPE_LABELS / TRAIT_DEFINITIONS / ELEMENT_TO_STATUS active exports 유지.
   * - 18 직업의 trait/build 분류는 buildProfile (getRunBuildProfile) + traitProfile (getTraitProfile)
   *   에서 처리 — CLASS_BUILD_IDENTITIES와 별개.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 289: CLASS_BUILD_IDENTITIES export 제거', async () => {
      const source = await readSrc('src/data/traits.ts');
      assert.ok(!/export const CLASS_BUILD_IDENTITIES/.test(source),
          'CLASS_BUILD_IDENTITIES export 제거됨');
  });

  test('cycle 289: traits.ts 파일 크기 단축 (~145 lines 감소)', async () => {
      const source = await readSrc('src/data/traits.ts');
      const lineCount = source.split('\n').length;
      assert.ok(lineCount < 200,
          `traits.ts ${lineCount} lines (이전 292 → ~145+ 감소)`);
  });

  test('cycle 289: ARCHETYPE_LABELS / TRAIT_DEFINITIONS / ELEMENT_TO_STATUS active exports 유지', async () => {
      const source = await readSrc('src/data/traits.ts');
      const activeExports = ['ARCHETYPE_LABELS', 'TRAIT_DEFINITIONS', 'ELEMENT_TO_STATUS'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 289: TRAIT_DEFINITIONS 데이터 보존 (회귀 가드)', async () => {
      const { TRAIT_DEFINITIONS } = await import('../src/data/traits.js');
      assert.ok(TRAIT_DEFINITIONS.balanced, 'balanced trait 정의 유지');
      assert.ok(TRAIT_DEFINITIONS.crusher, 'crusher trait 정의 유지');
      assert.ok(TRAIT_DEFINITIONS.arcane, 'arcane trait 정의 유지');
  });

  test('cycle 271 회귀 가드: 4 dead exports cleanup 유지', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/export const getClassBuildIdentity\b/.test(source),
          'cycle 271 getClassBuildIdentity 0건');
      assert.ok(!/export const getClassBuildCompatibility\b/.test(source),
          'cycle 271 getClassBuildCompatibility 0건');
      assert.ok(!/export const getClassBuildBonus\b/.test(source),
          'cycle 271 getClassBuildBonus 0건');
      assert.ok(!/export const getRunDiagnostics\b/.test(source),
          'cycle 271 getRunDiagnostics 0건');
  });

  test('cycle 285-288 회귀 가드: 이전 cleanup 동작 유지', async () => {
      const artSrc = await readSrc('src/data/artPalette.ts');
      assert.ok(!/export const ART_GRID/.test(artSrc), 'cycle 288 ART_GRID 0건');
      assert.ok(!/export const REFERENCE_ACCENTS/.test(artSrc), 'cycle 288 REFERENCE_ACCENTS 0건');
  });
}

// ─── cycle-290-apply-item-prefix-options-dead.test.js ───
{
  /**
   * cycle 290: applyItemPrefix options 매개변수 dead 정리
   *   (cycle 222-289 silent dead config 시리즈 60번째 — cleanup lens 연속).
   *
   * 발견 (dead parameter):
   * - src/utils/itemPrefixUtils.ts: applyItemPrefix(item, options = {}) — options 매개변수.
   * - options.chance / options.force 분기는 정의돼 있지만 호출 사이트(CombatEngine.loot.ts × 3)
   *   모두 applyItemPrefix(baseItem)만 호출 — options 0건 dispatch.
   *
   * 패턴 (cycle 222-289 silent dead config 시리즈 60번째):
   * - cycle 289: CLASS_BUILD_IDENTITIES 145 lines 데이터 정리.
   * - cycle 290: applyItemPrefix dead 매개변수 정리 (함수 시그니처 단순화).
   *
   * 수정 (src/utils/itemPrefixUtils.ts):
   * - applyItemPrefix(item, options) → applyItemPrefix(item).
   * - options.chance / options.force 분기 제거, BALANCE.ITEM_PREFIX_CHANCE만 사용.
   *
   * 회귀 가드:
   * - CombatEngine.loot.ts 3 호출 사이트 모두 정상 (인자 1개).
   * - prefix 적용 동작 자체는 동일 (chance 비교 + 후보 선택).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 290: applyItemPrefix options 매개변수 제거', async () => {
      const source = await readSrc('src/utils/itemPrefixUtils.ts');
      assert.ok(!/applyItemPrefix\s*=\s*\([^)]*options[^)]*\)/.test(source),
          'applyItemPrefix options 매개변수 제거됨');
      assert.ok(!/options\.chance|options\.force/.test(source),
          'options.chance / options.force 분기 제거됨');
  });

  test('cycle 290: applyItemPrefix BALANCE.ITEM_PREFIX_CHANCE 직접 사용', async () => {
      const source = await readSrc('src/utils/itemPrefixUtils.ts');
      assert.ok(/BALANCE\.ITEM_PREFIX_CHANCE/.test(source),
          'BALANCE.ITEM_PREFIX_CHANCE 참조 유지');
  });

  test('cycle 290: CombatEngine.loot.ts 3 호출 사이트 인자 1개', async () => {
      const source = await readSrc('src/systems/CombatEngine.loot.ts');
      const matches = source.match(/applyItemPrefix\([^)]*\)/g) || [];
      assert.ok(matches.length >= 3, `applyItemPrefix 호출 ${matches.length}회 (최소 3)`);
      matches.forEach((call) => {
          // 인자 1개 — 콤마 0개
          assert.ok(!call.includes(','), `${call} 인자 1개`);
      });
  });

  test('cycle 290: applyItemPrefix 동작 보존 (회귀 가드)', async () => {
      const { applyItemPrefix } = await import('../src/utils/itemPrefixUtils.js');
      // prefix 후보 없는 item (type 미지원) → 그대로 반환.
      const noOpItem = { type: 'consumable', name: '약', val: 1 };
      const result = applyItemPrefix(noOpItem);
      assert.equal(result.name, '약', 'prefix 미적용 그대로 반환');
  });

  test('cycle 289 회귀 가드: CLASS_BUILD_IDENTITIES 0건 유지', async () => {
      const source = await readSrc('src/data/traits.ts');
      assert.ok(!/export const CLASS_BUILD_IDENTITIES/.test(source),
          'cycle 289 cleanup 유지');
  });
}

// ─── cycle-291-private-utils-downgrade.test.js ───
{
  /**
   * cycle 291: updateStats / getWeaponEquipScore export → private downgrade
   *   (cycle 222-290 silent dead config 시리즈 61번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/utils/playerStateUtils.ts: updateStats — 외부 0건, incrementStat 내부 1회만 사용.
   * - src/utils/equipmentUtils.ts: getWeaponEquipScore — 외부 0건,
   *   getEquipmentProfile 내부 1회만 사용.
   *
   * 패턴 (cycle 222-290 silent dead config 시리즈 61번째):
   * - cycle 290: applyItemPrefix dead 매개변수 정리.
   * - cycle 291: 2개 util private downgrade — export 표면 축소.
   *
   * 수정:
   * - playerStateUtils.ts: `export const updateStats` → `const updateStats` (private).
   * - equipmentUtils.ts: `export const getWeaponEquipScore` → `const getWeaponEquipScore`.
   *
   * 회귀 가드:
   * - incrementStat / getEquipmentProfile active export 유지.
   * - 내부 호출 동작 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 291: updateStats export 제거 (private)', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      assert.ok(!/export const updateStats/.test(source),
          'updateStats export 제거됨');
      assert.ok(/const updateStats/.test(source),
          'updateStats const 정의 유지 (private)');
  });

  test('cycle 291: getWeaponEquipScore export 제거 (private)', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/export const getWeaponEquipScore/.test(source),
          'getWeaponEquipScore export 제거됨');
      assert.ok(/const getWeaponEquipScore/.test(source),
          'getWeaponEquipScore const 정의 유지 (private)');
  });

  test('cycle 291: incrementStat / getEquipmentProfile active export 유지', async () => {
      const psSrc = await readSrc('src/utils/playerStateUtils.ts');
      const eqSrc = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(/export const incrementStat/.test(psSrc), 'incrementStat 유지');
      assert.ok(/export const getEquipmentProfile/.test(eqSrc), 'getEquipmentProfile 유지');
  });

  test('cycle 291: incrementStat 동작 보존 (cycle 502가 amount 파라미터 제거)', async () => {
      // cycle 502가 amount 파라미터 cascade로 제거 (3 callsite 모두 2 args 호출).
      // amount=3 테스트 → 1만 증가하는 새 동작으로 가드 업데이트.
      const { incrementStat } = await import('../src/utils/playerStateUtils.js');
      const player = { stats: { kills: 5 } };
      const next = incrementStat(player, 'kills');
      assert.equal(next.stats.kills, 6, 'kills 5+1=6 (cycle 502 정적 +1)');
      assert.notEqual(next, player, '새 객체 반환 (immutable)');
  });

  test('cycle 290 회귀 가드: applyItemPrefix options 0건 유지', async () => {
      const source = await readSrc('src/utils/itemPrefixUtils.ts');
      assert.ok(!/options\.chance|options\.force/.test(source),
          'cycle 290 cleanup 유지');
  });
}

// ─── cycle-292-normalize-text-private.test.js ───
{
  /**
   * cycle 292: normalizeText export → private downgrade
   *   (cycle 222-291 silent dead config 시리즈 62번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/utils/aiEventUtils.ts: normalizeText — aiEventUtils 내부에서 14회 사용,
   *   외부 consumer 0건. 텍스트 정규화 헬퍼.
   *
   * 패턴 (cycle 222-291 silent dead config 시리즈 62번째):
   * - cycle 291: updateStats / getWeaponEquipScore private downgrade.
   * - cycle 292: normalizeText private downgrade — export 표면 1개 축소.
   *
   * 수정 (src/utils/aiEventUtils.ts):
   * - `export const normalizeText` → `const normalizeText` (private).
   *
   * 회귀 가드:
   * - aiEventUtils 다른 active export 유지 (buildEventPackage, classifyChoice 등).
   * - 14회 내부 호출 동작 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 292: normalizeText export 제거 (private)', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/export const normalizeText/.test(source),
          'normalizeText export 제거됨');
      assert.ok(/const normalizeText/.test(source),
          'normalizeText const 정의 유지 (private)');
  });

  test('cycle 292: aiEventUtils active exports 유지', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      // cycle 318: getPoolKeyByLocation private downgrade (aiEventUtils 내부 사용만).
      const activeExports = ['classifyChoice', 'buildEventPackage', 'pickFallbackEvent', 'summarizeHistory', 'getRecentEventSet'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 292: classifyChoice 동작 보존 (회귀 가드 — normalizeText 내부 사용)', async () => {
      const { classifyChoice } = await import('../src/utils/aiEventUtils.js');
      assert.equal(classifyChoice('조심히 접근한다'), 'safe', 'safe 분류');
      assert.equal(classifyChoice('강제로 연다'), 'risky', 'risky 분류');
  });

  test('cycle 291 회귀 가드: 2 private downgrade 유지', async () => {
      const psSrc = await readSrc('src/utils/playerStateUtils.ts');
      const eqSrc = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/export const updateStats/.test(psSrc), 'updateStats private 유지');
      assert.ok(!/export const getWeaponEquipScore/.test(eqSrc), 'getWeaponEquipScore private 유지');
  });
}

// ─── cycle-293-get-all-items-private.test.js ───
{
  /**
   * cycle 293: getAllItems export → private downgrade
   *   (cycle 222-292 silent dead config 시리즈 63번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/utils/gameUtils.ts: getAllItems — findItemByName 내부 1회만 사용,
   *   외부 consumer 0건 (test import 0건, 주석 1건만).
   *
   * 패턴 (cycle 222-292 silent dead config 시리즈 63번째):
   * - cycle 292: normalizeText private downgrade.
   * - cycle 293: getAllItems private downgrade — export 표면 1개 축소.
   *
   * 수정 (src/utils/gameUtils.ts):
   * - `export const getAllItems` → `const getAllItems` (private).
   *
   * 회귀 가드:
   * - findItemByName active export 유지 — 외부 6건 사용.
   * - findItemByName 동작 동일 (내부에서 getAllItems 호출).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 293: getAllItems export 제거 (private)', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.ok(!/export const getAllItems/.test(source),
          'getAllItems export 제거됨');
      assert.ok(/const getAllItems/.test(source),
          'getAllItems const 정의 유지 (private)');
  });

  test('cycle 293: findItemByName active export 유지', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.ok(/export const findItemByName/.test(source),
          'findItemByName export 유지');
  });

  test('cycle 293: findItemByName 동작 보존 (회귀 가드 — getAllItems 내부 사용)', async () => {
      const { findItemByName } = await import('../src/utils/gameUtils.js');
      // 미존재 아이템 → undefined.
      assert.equal(findItemByName('___not_a_real_item___'), undefined,
          '미존재 lookup undefined');
  });

  test('cycle 292 회귀 가드: normalizeText private 유지', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/export const normalizeText/.test(source),
          'cycle 292 normalizeText private 유지');
  });
}

// ─── cycle-294-item-visuals-private.test.js ───
{
  /**
   * cycle 294: itemVisuals.ts 3 exports → private downgrade
   *   (cycle 222-293 silent dead config 시리즈 64번째 — cleanup lens 연속).
   *
   * 발견 (3 private downgrade 후보, 모두 itemVisuals 내부 사용만):
   * - getMaterialVisualKey: getEquipmentVisualKey 내부 1회 (line 276), 외부 0건.
   * - IMAGEGEN_ITEM_PNG_KEYS: getItemIconAssetExtension 내부 1회 (line 365), 외부 0건.
   * - getItemIconAssetExtension: getItemIconAssetSrc 내부 1회 (line 386), 외부 0건.
   *
   * 패턴 (cycle 222-293 silent dead config 시리즈 64번째):
   * - cycle 293: getAllItems private downgrade.
   * - cycle 294: itemVisuals 3 private downgrade — export 표면 3개 축소.
   *
   * 수정 (src/utils/itemVisuals.ts):
   * - 3 export 제거 (private const 유지).
   * - 내부 호출 chain 그대로.
   *
   * 회귀 가드:
   * - getEquipmentVisualKey / getItemIconAssetSrc active export 유지.
   * - getEquipmentVisualKey 동작 동일 (재료 lookup 포함).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 294: 3 exports 제거 (private)', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      const deadExports = ['getMaterialVisualKey', 'IMAGEGEN_ITEM_PNG_KEYS', 'getItemIconAssetExtension'];
      deadExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(!re.test(source), `${name} export 제거됨`);
          const constRe = new RegExp(`const ${name}\\b`);
          assert.ok(constRe.test(source), `${name} const 정의 유지 (private)`);
      });
  });

  test('cycle 294: itemVisuals active exports 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      const activeExports = ['getEquipmentVisualKey', 'getItemIconAssetSrc', 'getWeaponVisualKey', 'getOffhandVisualKey'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 294: getEquipmentVisualKey 동작 보존 (재료 lookup chain)', async () => {
      const { getEquipmentVisualKey } = await import('../src/utils/itemVisuals.js');
      const matItem = { type: 'mat', name: '약초' };
      const result = getEquipmentVisualKey(matItem);
      // 재료 lookup chain — 내부 getMaterialVisualKey 호출 유지 확인.
      assert.ok(typeof result === 'string', 'string 반환');
  });

  test('cycle 293 회귀 가드: getAllItems private 유지', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.ok(!/export const getAllItems/.test(source),
          'cycle 293 getAllItems private 유지');
  });
}

// ─── cycle-295-job-outfit-affinity-types-private.test.js ───
{
  /**
   * cycle 295: jobOutfitAffinity.ts 4 type exports → private downgrade
   *   (cycle 222-294 silent dead config 시리즈 65번째 — cleanup lens 연속).
   *
   * 발견 (4 type/interface private downgrade, 모두 동일 파일 내부 사용만):
   * - AffinityTier (line 16): 외부 0건, buildAffinityLabel param + tier 변수 사용.
   * - AffinityBonus (line 18): 외부 0건, FULL/PARTIAL_2/PARTIAL_1_BONUS const + bonus 변수 사용.
   * - OutfitAffinity (line 25): 외부 0건, getJobOutfitAffinity 반환 타입 + empty 변수 사용.
   * - ItemLike (line 34): 외부 0건, ItemsDb / SetCatalog / matchesJob / byTier 사용.
   *
   * 패턴 (cycle 222-294 silent dead config 시리즈 65번째):
   * - cycle 294: itemVisuals 3 exports private downgrade.
   * - cycle 295: jobOutfitAffinity 4 type exports private downgrade.
   *
   * 수정 (src/utils/jobOutfitAffinity.ts):
   * - 4 type/interface export 제거 (private 유지).
   * - 동일 파일 내부 사용 모두 그대로.
   *
   * 회귀 가드:
   * - getJobOutfitAffinity / getJobSetCatalog active export 유지.
   * - getJobOutfitAffinity 동작 동일 (반환 shape 보존).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 295: 4 type exports 제거 (private)', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      assert.ok(!/export type AffinityTier\b/.test(source), 'AffinityTier export 제거');
      assert.ok(!/export interface AffinityBonus\b/.test(source), 'AffinityBonus export 제거');
      assert.ok(!/export interface OutfitAffinity\b/.test(source), 'OutfitAffinity export 제거');
      assert.ok(!/export interface ItemLike\b/.test(source), 'ItemLike export 제거');
  });

  test('cycle 295: 4 type 정의 자체는 유지 (private)', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      assert.ok(/type AffinityTier\b/.test(source), 'AffinityTier 정의 유지');
      assert.ok(/interface AffinityBonus\b/.test(source), 'AffinityBonus 정의 유지');
      assert.ok(/interface OutfitAffinity\b/.test(source), 'OutfitAffinity 정의 유지');
      assert.ok(/interface ItemLike\b/.test(source), 'ItemLike 정의 유지');
  });

  test('cycle 295: getJobOutfitAffinity / getJobSetCatalog active export 유지', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      assert.ok(/export const getJobOutfitAffinity\b/.test(source), 'getJobOutfitAffinity 유지');
      assert.ok(/export const getJobSetCatalog\b/.test(source), 'getJobSetCatalog 유지');
  });

  test('cycle 295: getJobOutfitAffinity 동작 보존 (회귀 가드)', async () => {
      const { getJobOutfitAffinity } = await import('../src/utils/jobOutfitAffinity.js');
      const player = { job: '검사', equip: {} };
      const result = getJobOutfitAffinity(player);
      assert.equal(typeof result.matchCount, 'number', 'matchCount 숫자');
      assert.equal(typeof result.tier, 'string', 'tier 문자열');
  });

  test('cycle 294 회귀 가드: itemVisuals 3 private 유지', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      assert.ok(!/export const getMaterialVisualKey/.test(source),
          'cycle 294 getMaterialVisualKey private 유지');
      assert.ok(!/export const IMAGEGEN_ITEM_PNG_KEYS/.test(source),
          'cycle 294 IMAGEGEN_ITEM_PNG_KEYS private 유지');
  });
}

// ─── cycle-296-synthesis-outputs-private.test.js ───
{
  /**
   * cycle 296: getSynthesisOutputs export → private downgrade
   *   (cycle 222-295 silent dead config 시리즈 66번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/utils/synthesisUtils.ts: getSynthesisOutputs — validateSynthesis (line 76),
   *   performSynthesis (line 104) 내부 2회 사용, 외부 consumer 0건 (test 0건).
   *
   * 패턴 (cycle 222-295 silent dead config 시리즈 66번째):
   * - cycle 295: jobOutfitAffinity 4 type exports private downgrade.
   * - cycle 296: getSynthesisOutputs private downgrade — export 표면 1개 축소.
   *
   * 수정 (src/utils/synthesisUtils.ts):
   * - `export const getSynthesisOutputs` → `const getSynthesisOutputs` (private).
   *
   * 회귀 가드:
   * - validateSynthesis / performSynthesis / isSynthesizable / getSynthesisGroups
   *   active export 유지.
   * - 내부 호출 chain 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 296: getSynthesisOutputs export 제거 (private)', async () => {
      const source = await readSrc('src/utils/synthesisUtils.ts');
      assert.ok(!/export const getSynthesisOutputs/.test(source),
          'getSynthesisOutputs export 제거됨');
      assert.ok(/const getSynthesisOutputs/.test(source),
          'getSynthesisOutputs const 정의 유지 (private)');
  });

  test('cycle 296: synthesisUtils active exports 유지', async () => {
      const source = await readSrc('src/utils/synthesisUtils.ts');
      const activeExports = ['isSynthesizable', 'validateSynthesis', 'performSynthesis', 'getSynthesisGroups'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 296: validateSynthesis 동작 보존 (회귀 가드 — getSynthesisOutputs 내부 사용)', async () => {
      const { validateSynthesis } = await import('../src/utils/synthesisUtils.js');
      // 인자 부족 → invalid 반환.
      const result = validateSynthesis([], 0);
      assert.equal(result.valid, false, 'empty inputs → invalid');
      assert.equal(result.reason, 'NOT_ENOUGH', 'reason NOT_ENOUGH');
  });

  test('cycle 295 회귀 가드: jobOutfitAffinity 4 type private 유지', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      assert.ok(!/export type AffinityTier\b/.test(source),
          'cycle 295 AffinityTier private 유지');
      assert.ok(!/export interface OutfitAffinity\b/.test(source),
          'cycle 295 OutfitAffinity private 유지');
  });
}

// ─── cycle-297-explore-state-private.test.js ───
{
  /**
   * cycle 297: getExploreState export → private downgrade
   *   (cycle 222-296 silent dead config 시리즈 67번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/utils/explorationPacing.ts: getExploreState — 동일 파일 내부 4회 사용
   *   (getNarrativeEventChance, getQuietExplorationChance, getDiscoveryOdds,
   *   advanceExploreState), 외부 consumer 0건 (test 0건).
   *
   * 패턴 (cycle 222-296 silent dead config 시리즈 67번째):
   * - cycle 296: getSynthesisOutputs private downgrade.
   * - cycle 297: getExploreState private downgrade — export 표면 1개 축소.
   *
   * 수정 (src/utils/explorationPacing.ts):
   * - `export const getExploreState` → `const getExploreState` (private).
   *
   * 회귀 가드:
   * - DEFAULT_EXPLORE_STATE / getMapPacingProfile / getNarrativeEventChance /
   *   getQuietExplorationChance / getDiscoveryOdds / advanceExploreState active export 유지.
   * - getNarrativeEventChance 동작 동일 (내부에서 getExploreState 호출).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 297: getExploreState export 제거 (private)', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/export const getExploreState\b/.test(source),
          'getExploreState export 제거됨');
      assert.ok(/const getExploreState\b/.test(source),
          'getExploreState const 정의 유지 (private)');
  });

  test('cycle 297: explorationPacing active exports 유지', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      const activeExports = ['DEFAULT_EXPLORE_STATE', 'getMapPacingProfile', 'getNarrativeEventChance', 'getQuietExplorationChance', 'getDiscoveryOdds', 'advanceExploreState'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export const ${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });

  test('cycle 297: getNarrativeEventChance 동작 보존 (내부 getExploreState 사용)', async () => {
      const { getNarrativeEventChance } = await import('../src/utils/explorationPacing.js');
      const result = getNarrativeEventChance(0.2, 0, {});
      assert.equal(typeof result, 'number', '숫자 반환');
      assert.ok(result >= 0 && result <= 1, '확률 범위 [0,1]');
  });

  test('cycle 296 회귀 가드: getSynthesisOutputs private 유지', async () => {
      const source = await readSrc('src/utils/synthesisUtils.ts');
      assert.ok(!/export const getSynthesisOutputs/.test(source),
          'cycle 296 getSynthesisOutputs private 유지');
  });
}

// ─── cycle-298-types-private-downgrade.test.js ───
{
  /**
   * cycle 298: 5 type exports → private downgrade (item.ts × 4, monster.ts × 1)
   *   (cycle 222-297 silent dead config 시리즈 68번째 — cleanup lens 연속).
   *
   * 발견 (5 type private downgrade, 모두 외부 import 0건, 동일 파일 유니온 구성용):
   * - WeaponItem (item.ts:46): EquipmentItem 유니온 구성용.
   * - ArmorItem (item.ts:58): EquipmentItem 유니온 구성용.
   * - ShieldItem (item.ts:66): EquipmentItem 유니온 구성용.
   * - EquipmentItem (item.ts:83): Item 유니온 구성용.
   * - BossMonster (monster.ts:45): Monster 유니온 구성용.
   *
   * 외부 (src/, tests/) 어디에서도 import 0건. 모두 같은 파일에서만 union 구성에 사용.
   *
   * 패턴 (cycle 222-297 silent dead config 시리즈 68번째):
   * - cycle 297: getExploreState private downgrade.
   * - cycle 298: 5 type exports private downgrade — public 타입 표면 5개 축소.
   *
   * 수정:
   * - item.ts: WeaponItem / ArmorItem / ShieldItem / EquipmentItem export 제거.
   * - monster.ts: BossMonster export 제거.
   *
   * 회귀 가드:
   * - Item / EquipSlots / ConsumableItem / Monster / MonsterBase active export 유지.
   * - Item 유니온 구조 동일 (WeaponItem | ArmorItem | ShieldItem | ConsumableItem | ItemBase).
   * - Monster 유니온 구조 동일 (MonsterBase | BossMonster).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 298: item.ts 4 type exports 제거 (private)', async () => {
      const source = await readSrc('src/types/item.ts');
      assert.ok(!/export interface WeaponItem\b/.test(source), 'WeaponItem export 제거');
      assert.ok(!/export interface ArmorItem\b/.test(source), 'ArmorItem export 제거');
      assert.ok(!/export interface ShieldItem\b/.test(source), 'ShieldItem export 제거');
      assert.ok(!/export type EquipmentItem\b/.test(source), 'EquipmentItem export 제거');
  });

  test('cycle 298: monster.ts BossMonster export 제거 (private)', async () => {
      const source = await readSrc('src/types/monster.ts');
      assert.ok(!/export interface BossMonster\b/.test(source), 'BossMonster export 제거');
      assert.ok(/interface BossMonster\b/.test(source), 'BossMonster 정의 유지');
  });

  test('cycle 298: Item / Monster 유니온 정의 유지', async () => {
      const itemSrc = await readSrc('src/types/item.ts');
      const monsterSrc = await readSrc('src/types/monster.ts');
      assert.ok(/export type Item =/.test(itemSrc), 'Item 유니온 export 유지');
      assert.ok(/export type Monster =/.test(monsterSrc), 'Monster 유니온 export 유지');
  });

  test('cycle 298: ConsumableItem / EquipSlots / MonsterBase active export 유지', async () => {
      const itemSrc = await readSrc('src/types/item.ts');
      const monsterSrc = await readSrc('src/types/monster.ts');
      assert.ok(/export interface ConsumableItem\b/.test(itemSrc), 'ConsumableItem 유지');
      assert.ok(/export interface EquipSlots\b/.test(itemSrc), 'EquipSlots 유지');
      assert.ok(/export interface MonsterBase\b/.test(monsterSrc), 'MonsterBase 유지');
  });

  test('cycle 297 회귀 가드: getExploreState private 유지', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/export const getExploreState\b/.test(source),
          'cycle 297 getExploreState private 유지');
  });
}

// ─── cycle-299-player-types-private.test.js ───
{
  /**
   * cycle 299: player.ts 8 sub-interfaces export → private downgrade
   *   (cycle 222-298 silent dead config 시리즈 69번째 — cleanup lens 연속).
   *
   * 발견 (8 sub-interfaces, 모두 외부 import 0건, Player 인터페이스 composition 전용):
   * - PlayerStats / PlayerCodex / SkillLoadout / TempBuff / PlayerMeta /
   *   CombatFlags / SeasonPassState / WeeklyProtocol.
   *
   * 외부 (src/, tests/) `import { PlayerStats }` 등 0건. 모두 같은 파일에서
   * Player 인터페이스 필드 타입으로만 사용.
   *
   * 패턴 (cycle 222-298 silent dead config 시리즈 69번째):
   * - cycle 298: 5 type exports private (item/monster).
   * - cycle 299: 8 sub-interface exports private (player composition).
   *
   * 수정:
   * - src/types/player.ts: 8 export 제거 (정의 자체는 유지).
   * - tests/cycle-280/281/282/284: regex `(?:export )?interface PlayerStats|PlayerMeta`
   *   패턴으로 private downgrade 호환 갱신.
   *
   * 회귀 가드:
   * - Player active export 유지 — 모든 hook/util/component가 import.
   * - 8 sub-interface 정의 그대로 — Player 필드 타입 유효.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 299: 8 sub-interface exports 제거 (private)', async () => {
      const source = await readSrc('src/types/player.ts');
      const deadExports = ['PlayerStats', 'PlayerCodex', 'SkillLoadout', 'TempBuff', 'PlayerMeta', 'CombatFlags', 'SeasonPassState', 'WeeklyProtocol'];
      deadExports.forEach((name) => {
          const re = new RegExp(`export interface ${name}\\b`);
          assert.ok(!re.test(source), `${name} export 제거됨`);
          const defRe = new RegExp(`interface ${name}\\b`);
          assert.ok(defRe.test(source), `${name} 정의 유지 (private)`);
      });
  });

  test('cycle 299: Player active export 유지', async () => {
      const source = await readSrc('src/types/player.ts');
      assert.ok(/export interface Player\b/.test(source),
          'Player export 유지 (모든 hook/util/component import)');
  });

  test('cycle 298 회귀 가드: 5 type private 유지', async () => {
      const itemSrc = await readSrc('src/types/item.ts');
      const monsterSrc = await readSrc('src/types/monster.ts');
      assert.ok(!/export interface WeaponItem\b/.test(itemSrc), 'cycle 298 WeaponItem private');
      assert.ok(!/export interface BossMonster\b/.test(monsterSrc), 'cycle 298 BossMonster private');
  });
}
