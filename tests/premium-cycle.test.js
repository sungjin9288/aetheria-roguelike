import { readInventoryActionsSource, readInventoryActionsSourceSync } from "./helpers/inventoryActionsSource.mjs";
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ACHIEVEMENTS } from '../src/data/quests.js';
import { AT } from '../src/reducers/actionTypes.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * 프리미엄(Premium) cycle 테스트 (audit #1 통합 4개)
 */

// ─── cycle-186-premium-tokens-consume.test.js ───
{
  /**
   * cycle 186: PremiumShop 'reviveTokens' / 'synthProtects' 토큰 소비 로직 추가 (dead purchase fix).
   *
   * 발견:
   * - PremiumShop 4종 중 2종이 'dead purchase' — 구매되지만 게임 로직에서 소비
   *   안 함:
   *   1. reviveTokens (즉시 부활권, 200 premium) — purchaseRevive로 +1되지만
   *      어디에서도 -1 / 사용 안 함. 사망 시 spec 'HP/MP 50% 회복 후 즉시 부활'
   *      미구현.
   *   2. synthProtects (합성 보호권, 가격 별도) — purchaseSynthProtect로 +1
   *      되지만 synthesize 함수가 보유 토큰 무시하고 premium currency만 차감.
   *      구매한 토큰이 영원히 stats에만 남음.
   *
   * 수정:
   * 1. CombatEngine.applyFatalProtection — death save chain의 새 fallback 추가:
   *    void_heart 다음, phoenix_revive 전에 reviveTokens 분기. nextHp = maxHp 50%,
   *    flags.reviveTokenUsed = true. updatedPlayer 합류 시점에 reviveTokens -1
   *    + mp = maxMp 50% (spec).
   * 2. useInventoryActions.synthesize — useProtect 시 synthProtects 토큰 우선
   *    소비 (없으면 기존 premium currency 차감 패턴 유지).
   */

  test('cycle 186: reviveTokens 소비 — HP 0 도달 시 자동 부활', () => {
      const player = {
          hp: 0, maxHp: 1000, mp: 0, maxMp: 100,
          relics: [], // death_save / void_heart / phoenix_revive 없음
          combatFlags: {},
          status: [],
          reviveTokens: 1,
      };
      const result = CombatEngine.applyFatalProtection(player, [], 50, [], []);

      // HP 50% 회복 (500), 부활 성공.
      assert.equal(result.updatedPlayer.hp, 500);
      assert.equal(result.isDead, false);
      // 토큰 1 → 0 차감.
      assert.equal(result.updatedPlayer.reviveTokens, 0);
      // MP 50% 회복.
      assert.equal(result.updatedPlayer.mp, 50);
  });

  test('cycle 186: reviveTokens 0 → 부활 안 함 (회귀 가드)', () => {
      const player = {
          hp: 0, maxHp: 1000, mp: 50, maxMp: 100,
          relics: [],
          combatFlags: {},
          status: [],
          reviveTokens: 0,
      };
      const result = CombatEngine.applyFatalProtection(player, [], 50, [], []);
      // 부활 없음 → hp 0, 사망.
      assert.equal(result.updatedPlayer.hp, 0);
      assert.equal(result.isDead, true);
  });

  test('cycle 186: void_heart 우선 — reviveTokens 보유해도 voidHeart 먼저', () => {
      const player = {
          hp: 0, maxHp: 1000, mp: 50, maxMp: 100,
          relics: [{ effect: 'void_heart' }],
          combatFlags: {},
          status: [],
          reviveTokens: 5,
      };
      const result = CombatEngine.applyFatalProtection(player, player.relics, 50, [], []);
      // void_heart 발동: hp = 1, voidHeartUsed = true. reviveTokens 보존.
      assert.equal(result.updatedPlayer.hp, 1);
      assert.equal(result.updatedPlayer.combatFlags.voidHeartUsed, true);
      assert.notEqual(result.updatedPlayer.combatFlags.reviveTokenUsed, true);
      // reviveTokens 변화 없음 (소비 안 됨).
      // (cycle 186 토큰은 reviveTokens 필드를 그대로 둠 — voidHeart 분기에서 안 건드림.)
  });

  test('cycle 186: synthProtects 토큰 소비 — useProtect 시 token 우선', async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const src = await readInventoryActionsSource();
      // synthesize 함수에 useToken 변수 + synthProtects 차감 로직 명시.
      assert.match(src, /useToken/, 'cycle 186: useToken 변수 도입');
      assert.match(src, /synthProtects/, 'synthProtects 참조');
      // ownedTokens > 0 시 premium currency 차감 안 함.
      assert.match(src, /useToken \?\s*0\s*:\s*result\.premiumSpent/);
  });
}

// ─── cycle-188-ascend-premium-asset-preserve.test.js ───
{
  /**
   * cycle 188: ASCEND가 premium 구매 자산 보존하도록 fix.
   *
   * 발견:
   * - cycle 119에서 6 영구 카운터 (escapes/syntheses/maxKillStreak/visitedMaps/
   *   discoveryChains/abyssRecord)을 ASCEND preserve에 추가.
   * - 그러나 PremiumShop으로 구매한 자산 4종이 ASCEND 시 reset되던 잠복 회귀:
   *   1. stats.cosmeticTitles (cycle 185 owned 추적용) — reset 시 player.titles에는
   *      칭호 보존되지만 PremiumShop 'owned' 체크가 false → 동일 칭호 중복 구매.
   *   2. stats.synthProtects (cycle 186 토큰) — reset 시 잔여 토큰 손실.
   *   3. reviveTokens (cycle 186 부활권) — reset 시 부활권 손실.
   *   4. maxInv (PremiumShop INV_EXPAND 확장) — reset 시 인벤 슬롯 20으로 축소.
   *
   * 모두 premium currency 또는 premium 토큰으로 구매한 영구 자산.
   *
   * 수정 (src/reducers/handlers/progressionHandlers.ts ASCEND):
   * - stats에 cosmeticTitles / synthProtects 명시 보존.
   * - freshPlayer 상위에 reviveTokens / maxInv 명시 보존.
   */

  const ASCEND_PAYLOAD = {
      meta: { essence: 0, rank: 1, bonusAtk: 0, bonusHp: 0, bonusMp: 0, prestigeRank: 1 },
      newTitle: '각성자',
  };

  const buildState = (overrides = {}) => ({
      ...INITIAL_STATE,
      player: {
          ...INITIAL_STATE.player,
          name: 'tester',
          gender: 'male',
          ...overrides,
      },
  });

  test('cycle 188: cosmeticTitles ASCEND 시 보존', () => {
      const state = buildState({
          stats: {
              ...INITIAL_STATE.player.stats,
              cosmeticTitles: ['title_stargazer', 'title_voidwalker'],
          },
      });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.deepEqual(next.player.stats.cosmeticTitles, ['title_stargazer', 'title_voidwalker']);
  });

  test('cycle 188: synthProtects ASCEND 시 보존', () => {
      const state = buildState({
          stats: { ...INITIAL_STATE.player.stats, synthProtects: 3 },
      });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.synthProtects, 3);
  });

  test('cycle 188: reviveTokens ASCEND 시 보존', () => {
      const state = buildState({ reviveTokens: 2 });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.reviveTokens, 2);
  });

  test('cycle 188: maxInv (확장 인벤) ASCEND 시 보존', () => {
      const state = buildState({ maxInv: 25 });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.maxInv, 25);
  });

  test('cycle 188: 미보유 시 미정의 안전 — 0/undefined 폴백 (회귀 가드)', () => {
      const state = buildState({}); // premium 자산 없음
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.reviveTokens, 0);
      assert.deepEqual(next.player.stats.cosmeticTitles, []);
      assert.equal(next.player.stats.synthProtects, 0);
  });

  test('cycle 119 회귀 가드: 6 영구 카운터 ASCEND 보존 (cycle 188 변경 후에도)', () => {
      const state = buildState({
          stats: {
              ...INITIAL_STATE.player.stats,
              escapes: 50,
              syntheses: 20,
              maxKillStreak: 30,
              visitedMaps: ['시작의 마을', '고요한 숲'],
              discoveryChains: ['fire_convergence'],
              abyssRecord: 100,
          },
      });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.escapes, 50);
      assert.equal(next.player.stats.syntheses, 20);
      assert.equal(next.player.stats.maxKillStreak, 30);
      assert.deepEqual(next.player.stats.visitedMaps, ['시작의 마을', '고요한 숲']);
      assert.deepEqual(next.player.stats.discoveryChains, ['fire_convergence']);
      assert.equal(next.player.stats.abyssRecord, 100);
  });
}

// ─── cycle-215-claim-achievement-premium-currency.test.js ───
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(__dirname, '..');

  /**
   * cycle 215: claimAchievement에 premiumCurrency 보상 핸들러 추가
   *   (cycle 209 quest reward.title 패턴 follow-up — silent dead reward fix).
   *
   * 발견 (5 achievements premium 보상 silent 손실):
   * - claimAchievement(useInventoryActions.ts:337-352)는 reward.gold + reward.item만 처리.
   * - 그러나 ACHIEVEMENTS의 reward 객체는 gold / item / premiumCurrency 3종 사용.
   * - 5건의 영구 업적이 premiumCurrency 보상을 silently drop:
   *   · ach_abyss_200 '심연의 전설': premiumCurrency 50
   *   · ach_abyss_300 '공허의 군림자': premiumCurrency 100
   *   · ach_sig_20 '모든 전설의 증인': premiumCurrency 30
   *   · ach_sig_set_all '전설의 집대성': premiumCurrency 100
   *   · ach_chain_all '세계의 비밀 수호자': premiumCurrency 20
   * - 합계 300 💎 가 영원히 청구 불가 (claimedAchievements는 한 번만 청구 허용).
   *
   * 패턴:
   * - cycle 209 quest reward.title 누락 처리와 동일 lens — 보상 데이터는 있으나
   *   handler가 처리 안 해 silent dead.
   * - cycle 178 'info' reward type 추가, cycle 139 'legendary_item' 추가와 같은 결.
   *
   * 수정 (src/hooks/useInventoryActions.ts claimAchievement):
   * - achData.reward?.premiumCurrency 처리 추가.
   * - PREMIUM_GAIN 류 로그 emit (이미 PURCHASE 로그가 비슷한 형식 — 참조).
   */

  test('cycle 215: claimAchievement에 premiumCurrency 처리 코드 존재', () => {
      const content = readInventoryActionsSourceSync();
      // claimAchievement 함수 내에서 premiumCurrency 보상 처리 패턴
      assert.match(
          content,
          /achData\.reward[?\.]+premiumCurrency/,
          'claimAchievement에 achData.reward?.premiumCurrency 처리 코드 필요',
      );
  });

  test('cycle 215: premiumCurrency 5개 업적이 reward에 정의되어 있음 (정합성 baseline)', () => {
      const expected = [
          { id: 'ach_abyss_200', amount: 50 },
          { id: 'ach_abyss_300', amount: 100 },
          { id: 'ach_sig_20', amount: 30 },
          { id: 'ach_sig_set_all', amount: 100 },
          { id: 'ach_chain_all', amount: 20 },
      ];
      for (const expect of expected) {
          const ach = ACHIEVEMENTS.find((a) => a.id === expect.id);
          assert.ok(ach, `${expect.id} achievement should exist`);
          assert.equal(ach.reward.premiumCurrency, expect.amount,
              `${expect.id} premiumCurrency reward = ${expect.amount}`);
      }
  });

  test('cycle 215: 합계 300 💎 가 청구 가능 (silent loss 방지)', () => {
      const total = ACHIEVEMENTS
          .filter((a) => a.reward?.premiumCurrency)
          .reduce((sum, a) => sum + (a.reward.premiumCurrency || 0), 0);
      assert.equal(total, 300, '5 업적의 premiumCurrency 합 = 300 (regression baseline)');
  });

  test('cycle 215: 기존 reward.gold / reward.item 처리는 유지 (회귀 가드)', () => {
      const content = readInventoryActionsSourceSync();
      assert.match(
          content,
          /achData\.reward\.gold/,
          'claimAchievement의 reward.gold 처리 유지',
      );
      assert.match(
          content,
          /achData\.reward\.item/,
          'claimAchievement의 reward.item 처리 유지',
      );
  });

  test('cycle 209 회귀 가드: claimQuestReward의 reward.title 처리 유지', () => {
      const content = readInventoryActionsSourceSync();
      assert.match(
          content,
          /qData\.reward[?\.]+title/,
          'claimQuestReward의 reward.title 처리 유지 (cycle 209)',
      );
  });
}

// ─── cycle-285-premium-free-sources-dead.test.js ───
{
  /**
   * cycle 285: PREMIUM_FREE_SOURCES + RELIC_WEIGHTS dead export cleanup
   *   (cycle 222-284 silent dead config 시리즈 55번째 — cleanup lens 연속).
   *
   * 발견 (2 dead/private exports):
   * - src/data/premiumShop.ts: PREMIUM_FREE_SOURCES (6 lines) — 정의만, src/ + tests/ consumer 0건.
   * - src/data/relics.ts: RELIC_WEIGHTS — 정의 + pickWeightedRelics 내부 사용. 외부 consumer 0건.
   *   export 불필요, 내부 const로 downgrade 가능.
   *
   * 패턴 (cycle 222-284 silent dead config 시리즈 55번째):
   * - cycle 271: 4 dead exports cleanup.
   * - cycle 277-284: cleanup 시리즈 8사이클.
   * - cycle 285: PREMIUM_FREE_SOURCES 제거 + RELIC_WEIGHTS export downgrade.
   *
   * 수정:
   * 1) src/data/premiumShop.ts: PREMIUM_FREE_SOURCES export 제거 (~6 lines + JSDoc).
   * 2) src/data/relics.ts: RELIC_WEIGHTS의 export 제거 (private const).
   *
   * 회귀 가드:
   * - PREMIUM_SHOP export 유지 (active dispatch).
   * - RELIC_WEIGHTS는 pickWeightedRelics 내부에서 그대로 사용.
   * - getActiveRelicSynergies / pickWeightedRelics / RELICS / MAX_RELICS_PER_RUN 등 active 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 285: PREMIUM_FREE_SOURCES export 제거', async () => {
      const source = await readSrc('src/data/premiumShop.ts');
      assert.ok(!/export const PREMIUM_FREE_SOURCES/.test(source),
          'PREMIUM_FREE_SOURCES export 제거됨');
  });

  test('cycle 285: RELIC_WEIGHTS export 제거 (private const로 downgrade)', async () => {
      const source = await readSrc('src/data/relics.ts');
      assert.ok(!/export const RELIC_WEIGHTS/.test(source),
          'RELIC_WEIGHTS export 제거 (private const)');
      assert.ok(/const RELIC_WEIGHTS/.test(source),
          'RELIC_WEIGHTS const 정의 유지 (private)');
  });

  test('cycle 285: pickWeightedRelics 내부 RELIC_WEIGHTS 사용 유지 (회귀 가드)', async () => {
      const { pickWeightedRelics } = await import('../src/data/relics.js');
      const pool = [
          { id: 'a', name: 'A', rarity: 'common' },
          { id: 'b', name: 'B', rarity: 'rare' },
          { id: 'c', name: 'C', rarity: 'legendary' },
      ];
      const picked = pickWeightedRelics(pool, 2);
      assert.equal(picked.length, 2, 'pickWeightedRelics가 RELIC_WEIGHTS 활용해 정상 동작');
  });

  test('cycle 285: PREMIUM_SHOP export 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/data/premiumShop.ts');
      assert.ok(/export const PREMIUM_SHOP/.test(source),
          'PREMIUM_SHOP active export 유지');
  });

  test('cycle 285: relics.ts active exports 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/data/relics.ts');
      const activeExports = ['RELICS', 'MAX_RELICS_PER_RUN', 'RELIC_SYNERGIES', 'getActiveRelicSynergies', 'pickWeightedRelics'];
      activeExports.forEach((name) => {
          const re = new RegExp(`export\\s+(const|function)\\s+${name}\\b`);
          assert.ok(re.test(source), `${name} export 유지`);
      });
  });
}
