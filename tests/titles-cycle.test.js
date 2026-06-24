import { readInventoryActionsSource } from "./helpers/inventoryActionsSource.mjs";
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { PREMIUM_SHOP } from '../src/data/premiumShop.js';
import { PRESTIGE_TITLES, TITLES } from '../src/data/titles.js';
import { SEASON_REWARDS } from '../src/data/seasonPass.js';
import { checkTitles, getTitleColor, getTitleDefinition, getTitleLabel } from '../src/utils/gameUtils.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * 칭호(Title) 관련 cycle 테스트 — 통합본.
 * 기존 10개 cycle-*.test.js 통합 (audit #1). 각 원본 본문을 블록 { } 으로 격리 — 행동/커버리지 동일.
 */

// ─── 원본: tests/cycle-103-chain-master-title.test.js ───
{
  /**
   * cycle 103: 발견 체인 마스터(chain_master) 칭호 추가.
   *
   * cycle 102에서 ach_chain_1/3/all achievement를 깔았으나 칭호는 없었음.
   * cycle 95(berserker), 85(alchemist) 패턴 그대로 — achievement chain의 최고
   * 임계값에 짝을 이루는 칭호 추가.
   *
   * 추가:
   * - title 'chain_master' / name '세계의 길잡이' / cond discoveryChains >= 5 /
   *   indigo-300 톤 (모든 5종 chain의 보상 색감 평균 — fire/frost/void/ancient/demon
   *   각각 red/blue/purple/yellow/black의 중성)
   * - checkTitles에 cond.type === 'discoveryChains' 핸들러
   * - TITLE_PASSIVES.chain_master = ATK +1 · DEF +1 · MP +15 (탐험 + 전투 균형 패시브)
   */

  const findTitle = (id) => TITLES.find((t) => t.id === id);

  test('chain_master 칭호 등록됨 (discoveryChains 5)', () => {
      const title = findTitle('chain_master');
      assert.ok(title, 'chain_master title should exist');
      assert.equal(title.name, '세계의 길잡이');
      assert.equal(title.cond.type, 'discoveryChains');
      assert.equal(title.cond.val, 5);
  });

  test('checkTitles: discoveryChains 5개 완료 → chain_master 활성', () => {
      const player = { titles: [], stats: { discoveryChains: ['a', 'b', 'c', 'd', 'e'] } };
      const unlocked = checkTitles(player);
      assert.ok(unlocked.includes('chain_master'));
  });

  test('checkTitles: discoveryChains 4개 → chain_master 비활성', () => {
      const player = { titles: [], stats: { discoveryChains: ['a', 'b', 'c', 'd'] } };
      const unlocked = checkTitles(player);
      assert.ok(!unlocked.includes('chain_master'));
  });

  test('checkTitles: discoveryChains 누락 → 0 취급, chain_master 비활성', () => {
      const player = { titles: [], stats: {} };
      const unlocked = checkTitles(player);
      assert.ok(!unlocked.includes('chain_master'));
  });

  test('checkTitles: 이미 보유한 chain_master는 재해금 안 됨', () => {
      const player = { titles: ['chain_master'], stats: { discoveryChains: ['a', 'b', 'c', 'd', 'e'] } };
      const unlocked = checkTitles(player);
      assert.ok(!unlocked.includes('chain_master'));
  });
}

// ─── 원본: tests/cycle-175-season-pass-title-registration.test.js ───
{
  /**
   * cycle 175: 시즌 패스 보상 칭호 정합 가드 + 정식 등록.
   *
   * 발견:
   * - SEASON_REWARDS의 tier 10/20/30 premium track에 '시즌 선구자' / '시즌 정복자' /
   *   '시즌 마스터' 칭호 보상 정의.
   * - rewardHandlers.ts CLAIM_SEASON_REWARD가 player.titles에 Korean 문자열을 push.
   * - 그러나 TITLES 배열에는 미등록 → getTitleDefinition(token) undefined → 색상/
   *   라벨 fallback. 잠복 inconsistency.
   *
   * 수정:
   * 1. TITLES에 3 시즌 칭호 추가 (id = Korean name, prestige titles 패턴과 동일):
   *    - '시즌 선구자' (text-emerald-300)
   *    - '시즌 정복자' (text-amber-300)
   *    - '시즌 마스터' (text-rose-300)
   * 2. SEASON_REWARDS의 모든 title 보상이 TITLES에 등록됐는지 회귀 가드.
   */

  test('SEASON_REWARDS title 보상 → TITLES 정합성 (모두 등록)', () => {
      const titleIds = new Set(TITLES.map((t) => t.id));
      const titleNames = new Set(TITLES.map((t) => t.name));
      const missing = [];
      for (const r of SEASON_REWARDS) {
          for (const slot of ['free', 'premium']) {
              const reward = r[slot];
              if (reward?.title && !titleIds.has(reward.title) && !titleNames.has(reward.title)) {
                  missing.push(`tier ${r.tier} ${slot}: '${reward.title}'`);
              }
          }
      }
      assert.deepEqual(missing, [],
          `SEASON_REWARDS title 미등록 (TITLES에 추가 필요):\n  ${missing.join('\n  ')}`);
  });

  test('cycle 175: 3 시즌 칭호 모두 TITLES 등록됨', () => {
      const ids = new Set(TITLES.map((t) => t.id));
      assert.ok(ids.has('시즌 선구자'));
      assert.ok(ids.has('시즌 정복자'));
      assert.ok(ids.has('시즌 마스터'));
  });

  test('cycle 175: getTitleDefinition이 시즌 칭호 토큰으로 정의 반환', () => {
      const def = getTitleDefinition('시즌 선구자');
      assert.ok(def, 'season title definition should be found');
      assert.equal(def.name, '시즌 선구자');
      assert.equal(def.color, 'text-emerald-300');
  });

  test('cycle 175: getTitleColor / getTitleLabel이 시즌 칭호 정상 처리', () => {
      assert.equal(getTitleColor('시즌 정복자'), 'text-amber-300');
      assert.equal(getTitleLabel('시즌 마스터'), '시즌 마스터');
  });

  test('cycle 174 회귀 가드: TITLES id 유일성 (시즌 칭호 추가 후에도 0 dup)', () => {
      const counts = new Map();
      for (const t of TITLES) counts.set(t.id, (counts.get(t.id) || 0) + 1);
      const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
      assert.deepEqual(dupes, []);
  });
}

// ─── 원본: tests/cycle-185-cosmetic-title-registration.test.js ───
{
  /**
   * cycle 185: PremiumShop cosmeticTitles 정식 TITLES 등록 + 구매 시 player.titles 추가.
   *
   * 발견:
   * - PremiumShop에 4 cosmeticTitles 정의: 별을 보는 자 / 공허를 걷는 자 /
   *   에테르의 아이 / 세계의 끝 (각 100~200 premium currency).
   * - 그러나 purchaseCosmeticTitle이 player.stats.cosmeticTitles에만 저장하고
   *   player.titles에는 추가 안 함 → SystemTab title 디스플레이에서 invisible.
   * - 결과: 플레이어가 100~200 프리미엄 재화를 소비해도 title을 활성화/표시
   *   할 수 없는 "구매했지만 못 쓰는" UX 회귀.
   *
   * 수정:
   * 1. titles.ts에 4 cosmetic title 정식 등록 (cycle 175 시즌 칭호와 동일 패턴 —
   *    Korean name을 id로 사용, cond.type = 'cosmetic').
   * 2. useInventoryActions.purchaseCosmeticTitle 수정 — 구매 시 player.titles에도
   *    titleName push (이미 있으면 dedup). stats.cosmeticTitles는 보존(owned 체크용).
   *
   * cycle 175 (시즌 칭호) 패턴 시리즈에 합류 — premium/season 등 specific cond.type
   * 칭호 모두 정식 TITLES 등록.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  const COSMETIC_NAMES = ['별을 보는 자', '공허를 걷는 자', '에테르의 아이', '세계의 끝'];

  test('cycle 185: 4 cosmetic title 모두 TITLES에 정식 등록됨', () => {
      const ids = new Set(TITLES.map((t) => t.id));
      for (const name of COSMETIC_NAMES) {
          assert.ok(ids.has(name), `cosmetic title '${name}' missing from TITLES`);
      }
  });

  test('cycle 185: getTitleDefinition으로 cosmetic title 정의 lookup 가능', () => {
      const def = getTitleDefinition('별을 보는 자');
      assert.ok(def);
      assert.equal(def.name, '별을 보는 자');
      assert.equal(def.cond?.type, 'cosmetic');
      assert.match(def.color, /text-/);
  });

  test('cycle 185: PREMIUM_SHOP cosmeticTitles 모두 TITLES에 등록됨 (정합성 가드)', () => {
      const titleNames = new Set(TITLES.map((t) => t.id));
      const missing = [];
      for (const ct of PREMIUM_SHOP.cosmeticTitles || []) {
          if (!titleNames.has(ct.name)) missing.push(`${ct.id} (${ct.name})`);
      }
      assert.deepEqual(missing, [],
          `PREMIUM_SHOP cosmetic title not in TITLES:\n  ${missing.join('\n  ')}`);
  });

  test('cycle 185: purchaseCosmeticTitle이 player.titles에 push (회귀 가드)', async () => {
      const src = await readInventoryActionsSource();
      // 함수 내부에 'titles:' assignment가 있어야 함 — purchaseCosmeticTitle 분기.
      const idx = src.indexOf('purchaseCosmeticTitle');
      assert.ok(idx > -1);
      const fnSlice = src.slice(idx, idx + 2000);
      assert.match(fnSlice, /titles:\s*nextTitles/, 'cycle 185: titles 배열 갱신 명시');
  });

  test('cycle 174 회귀 가드: TITLES id 유일성 (cosmetic 추가 후에도 0 dup)', () => {
      const counts = new Map();
      for (const t of TITLES) counts.set(t.id, (counts.get(t.id) || 0) + 1);
      const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
      assert.deepEqual(dupes, []);
  });
}

// ─── 원본: tests/cycle-197-prestige-titles-registration.test.js ───
{
  /**
   * cycle 197: PRESTIGE_TITLES 10종 정식 TITLES 등록 + visual lookup 가드.
   *
   * 발견 (visual UX 회귀):
   * - PRESTIGE_TITLES (Korean rank 1-10 칭호 토큰)이 ASCEND 시 player.titles에 push됨.
   * - 그러나 getTitleDefinition은 'TITLES.find(t => t.id === token)' — Korean 토큰 vs
   *   English id ('transcendent'/'eternal'/'void_lord') 미매치 → null 반환.
   * - 결과: getTitleColor / getTitleLabel이 모두 fallback. 모든 prestige 칭호가
   *   default 'text-cyber-purple'으로 표시되던 visual inconsistency.
   * - 10종 모두 영향 (각성자~에테르의 신).
   *
   * 수정 (src/data/titles.ts):
   * - 10 PRESTIGE_TITLES 토큰을 Korean id로 TITLES에 정식 등록 — cycle 175/185/192
   *   컨벤션 동일.
   * - cond.type='prestigeRank' + cond.val=rank — 의도 명시.
   * - 색상 차별화: cyan→purple→indigo→violet→fuchsia→pink→rose→yellow→amber→emerald
   *   (rank 1-10 progression).
   * - 기존 'transcendent'/'eternal'/'void_lord'는 다른 cond.type(prestige/abyssFloor)으로
   *   유지(checkTitles auto-grant). 본 cycle은 PRESTIGE_TITLES 토큰 자체에 정식 entry.
   */

  test('cycle 197: 10 PRESTIGE_TITLES 모두 TITLES에 Korean id로 등록됨', () => {
      const ids = new Set(TITLES.map((t) => t.id));
      const missing = [];
      for (const t of PRESTIGE_TITLES) {
          if (!ids.has(t)) missing.push(t);
      }
      assert.deepEqual(missing, []);
  });

  test('cycle 197: getTitleDefinition으로 모든 PRESTIGE_TITLES 토큰 lookup 성공', () => {
      const broken = [];
      for (const token of PRESTIGE_TITLES) {
          const def = getTitleDefinition(token);
          if (!def) broken.push(`${token}: null`);
      }
      assert.deepEqual(broken, []);
  });

  test('cycle 197: getTitleColor가 default fallback 안 함 (모두 distinct)', () => {
      const fallbacks = [];
      for (const token of PRESTIGE_TITLES) {
          const color = getTitleColor(token);
          if (color === 'text-cyber-purple') fallbacks.push(token);
      }
      assert.deepEqual(fallbacks, []);
  });

  test('cycle 197: getTitleLabel이 raw token이 아닌 정식 name 반환', () => {
      for (const token of PRESTIGE_TITLES) {
          const label = getTitleLabel(token);
          assert.equal(label, token, `label should equal name='${token}' for id='${token}'`);
      }
  });

  test('cycle 174 회귀 가드: TITLES id 유일성 (10 prestige 추가 후에도 0 dup)', () => {
      const counts = new Map();
      for (const t of TITLES) counts.set(t.id, (counts.get(t.id) || 0) + 1);
      const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
      assert.deepEqual(dupes, []);
  });
}

// ─── 원본: tests/cycle-199-checktitles-prestige-rank-handler.test.js ───
{
  /**
   * cycle 199: checkTitles에 'prestigeRank' cond.type 핸들러 추가 (cycle 197 follow-up).
   *
   * 발견 (cycle 197 follow-up):
   * - cycle 197에서 PRESTIGE_TITLES 10종을 정식 TITLES 등록. cond.type='prestigeRank',
   *   cond.val=rank.
   * - ASCEND는 직접 newTitle payload로 PRESTIGE_TITLES[rank-1] 추가 — 정상 케이스.
   * - 그러나 checkTitles는 'prestigeRank' 분기 미구현 → 복구 케이스(저장 손실 /
   *   migration / engine bug 등)에서 prestige 칭호 자동 복원 불가.
   *
   * 수정 (src/utils/gameUtils.ts checkTitles):
   * - 'prestigeRank' cond.type 분기 추가 — player.meta.prestigeRank >= val 시 true.
   * - cycle 197 등록 정합성 + 안전 lock.
   */

  const buildPlayer = (overrides = {}) => ({
      level: 50,
      titles: [],
      meta: { prestigeRank: 0 },
      stats: { kills: 0 },
      ...overrides,
  });

  test('cycle 199: prestigeRank 1 도달 시 각성자 칭호 자동 인식', () => {
      const player = buildPlayer({ meta: { prestigeRank: 1 } });
      const newTitles = checkTitles(player);
      // PRESTIGE_TITLES[0] = '각성자', cond.val=1.
      assert.ok(newTitles.includes('각성자'),
          `expected '각성자' in newTitles; got ${JSON.stringify(newTitles)}`);
  });

  test('cycle 199: prestigeRank 10 도달 시 모든 prestige 칭호 자동 인식', () => {
      const player = buildPlayer({ meta: { prestigeRank: 10 } });
      const newTitles = checkTitles(player);
      // PRESTIGE_TITLES 10종 모두 cond.val <= 10이므로 전부 충족.
      for (const t of PRESTIGE_TITLES) {
          assert.ok(newTitles.includes(t),
              `expected '${t}' in newTitles for rank 10`);
      }
  });

  test('cycle 199: prestigeRank 0 (기본) → prestige 칭호 0건', () => {
      const player = buildPlayer({ meta: { prestigeRank: 0 } });
      const newTitles = checkTitles(player);
      for (const t of PRESTIGE_TITLES) {
          assert.ok(!newTitles.includes(t),
              `'${t}'은 rank 0에 자동 grant 안 돼야 함`);
      }
  });

  test('cycle 199: 이미 보유한 prestige 칭호는 newTitles에서 제외 (회귀 가드)', () => {
      const player = buildPlayer({
          meta: { prestigeRank: 5 },
          titles: ['각성자', '초월자'],
      });
      const newTitles = checkTitles(player);
      // 이미 보유한 두 개는 결과에서 제외.
      assert.ok(!newTitles.includes('각성자'));
      assert.ok(!newTitles.includes('초월자'));
      // 나머지 rank 3-5 (cycle 197 cond.val 3,4,5)는 포함.
      assert.ok(newTitles.includes('심연의 탐험가'));
      assert.ok(newTitles.includes('에테르 기사'));
      assert.ok(newTitles.includes('허공의 지배자'));
  });

  test('cycle 119 회귀 가드: 기존 prestige cond.type 영향 없음', () => {
      // 기존 'prestige' cond.type을 가진 칭호는 그대로 동작 (transcendent / eternal 등).
      const player = buildPlayer({ meta: { prestigeRank: 5 } });
      const newTitles = checkTitles(player);
      // transcendent (cond { type: 'prestige', val: 5 })는 여전히 인식.
      assert.ok(newTitles.includes('transcendent'));
  });
}

// ─── 원본: tests/cycle-201-checktitles-seasontier-handler.test.js ───
{
  /**
   * cycle 201: checkTitles에 'seasonTier' cond.type 핸들러 추가 (cycle 175 follow-up).
   *
   * 발견 (cycle 199 lens 동일 패턴 재발견):
   * - cycle 175에서 시즌 패스 보상 칭호 3종(시즌 선구자/정복자/마스터)을 정식 TITLES 등록.
   *   cond.type='seasonTier', cond.val=10/20/30.
   * - CLAIM_SEASON_REWARD(rewardHandlers.ts)가 직접 player.titles에 push — 정상 케이스 OK.
   * - 그러나 checkTitles는 'seasonTier' 분기 미구현 → 복구 케이스(저장 손실 / migration /
   *   engine bug 등)에서 시즌 칭호 자동 복원 불가. cycle 199 'prestigeRank' 회귀와 동일.
   *
   * 수정 (src/utils/gameUtils.ts checkTitles):
   * - 'seasonTier' cond.type 분기 추가 — player.seasonPass.tier >= val 시 true.
   * - cycle 175 등록 정합성 + 안전 lock.
   */

  const buildPlayer = (overrides = {}) => ({
      level: 50,
      titles: [],
      meta: { prestigeRank: 0 },
      stats: { kills: 0 },
      seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
      ...overrides,
  });

  test('cycle 201: seasonTier 10 도달 시 시즌 선구자 자동 인식', () => {
      const player = buildPlayer({
          seasonPass: { xp: 0, tier: 10, claimed: [], isPremium: false, seasonId: 'S1' },
      });
      const newTitles = checkTitles(player);
      assert.ok(newTitles.includes('시즌 선구자'),
          `expected '시즌 선구자' in newTitles; got ${JSON.stringify(newTitles)}`);
  });

  test('cycle 201: seasonTier 30 도달 시 3종 모두 자동 인식', () => {
      const player = buildPlayer({
          seasonPass: { xp: 0, tier: 30, claimed: [], isPremium: false, seasonId: 'S1' },
      });
      const newTitles = checkTitles(player);
      assert.ok(newTitles.includes('시즌 선구자'));
      assert.ok(newTitles.includes('시즌 정복자'));
      assert.ok(newTitles.includes('시즌 마스터'));
  });

  test('cycle 201: seasonTier 0 (기본) → 시즌 칭호 0건', () => {
      const player = buildPlayer();
      const newTitles = checkTitles(player);
      assert.ok(!newTitles.includes('시즌 선구자'));
      assert.ok(!newTitles.includes('시즌 정복자'));
      assert.ok(!newTitles.includes('시즌 마스터'));
  });

  test('cycle 201: seasonTier 25 → 10/20만 인식, 30 미인식 (boundary)', () => {
      const player = buildPlayer({
          seasonPass: { xp: 0, tier: 25, claimed: [], isPremium: false, seasonId: 'S1' },
      });
      const newTitles = checkTitles(player);
      assert.ok(newTitles.includes('시즌 선구자'));
      assert.ok(newTitles.includes('시즌 정복자'));
      assert.ok(!newTitles.includes('시즌 마스터'));
  });

  test('cycle 201: 이미 보유한 시즌 칭호는 newTitles에서 제외 (회귀 가드)', () => {
      const player = buildPlayer({
          seasonPass: { xp: 0, tier: 30, claimed: [], isPremium: false, seasonId: 'S1' },
          titles: ['시즌 선구자'],
      });
      const newTitles = checkTitles(player);
      assert.ok(!newTitles.includes('시즌 선구자'));
      assert.ok(newTitles.includes('시즌 정복자'));
      assert.ok(newTitles.includes('시즌 마스터'));
  });

  test('cycle 201: seasonPass 미정의 (구형 save) → 시즌 칭호 0건 + 크래시 없음', () => {
      const player = buildPlayer();
      delete player.seasonPass;
      const newTitles = checkTitles(player);
      assert.ok(!newTitles.includes('시즌 선구자'));
      assert.ok(!newTitles.includes('시즌 정복자'));
      assert.ok(!newTitles.includes('시즌 마스터'));
  });
}

// ─── 원본: tests/cycle-248-title-passive-coverage.test.js ───
{
  /**
   * cycle 248: TITLES 정의 vs TITLE_PASSIVES 누락 dead config fix
   *   (cycle 222-247 silent dead config 시리즈 20번째).
   *
   * 발견 (TITLE_PASSIVES 누락 3종):
   * - 'void_conqueror' (허무의 정복자, 100 floor 도달): TITLES 정의 + 미패시브.
   * - 'abyss_legend'   (심연의 전설,   200 floor 도달): TITLES 정의 + 미패시브.
   * - 'void_sovereign' (공허의 군림자,  300 floor 도달): TITLES 정의 + 미패시브.
   * - 도전이 가장 어려운 abyss endgame 칭호 3종이 활성화해도 0 stat 보너스 — 광고 vs 보상 모순.
   * - getTitlePassive returns null → statsCalculator의 titlePassive.atk/def/hp/mp/crit 모두 0 적용.
   *
   * 패턴 (cycle 222-247 silent dead config 시리즈 20번째):
   * - cycle 247: skill branch desc-data 정합 fix (광고 vs 동작).
   * - cycle 248: TITLES vs TITLE_PASSIVES 정합 (정의 vs 보너스).
   *
   * 수정 (src/data/titles.ts):
   * - TITLE_PASSIVES에 void_conqueror / abyss_legend / void_sovereign 추가.
   * - 난이도 scaling: floor 100/200/300 ⇒ 점진 강화.
   *   - void_conqueror: ATK +3 · CRIT +2% · HP +20 (mid-high)
   *   - abyss_legend:   ATK +5 · CRIT +3% · HP +30 · DEF +2 (high)
   *   - void_sovereign: ATK +7 · CRIT +4% · HP +40 · DEF +3 · MP +20 (very high)
   *
   * 회귀 가드:
   * - 기존 TITLE_PASSIVES 32개 항목 변화 없음.
   * - TITLES 정의 변화 없음 (cond 그대로).
   */

  test('cycle 248: void_conqueror 패시브 정의 (ATK/CRIT/HP)', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      const passive = TITLE_PASSIVES['void_conqueror'];
      assert.ok(passive, 'void_conqueror 패시브 존재');
      assert.equal(passive.atk, 3, `ATK +3 (실제: ${passive.atk})`);
      assert.equal(passive.crit, 0.02, `CRIT +2% (실제: ${passive.crit})`);
      assert.equal(passive.hp, 20, `HP +20 (실제: ${passive.hp})`);
      assert.ok(passive.label, 'label 존재');
  });

  test('cycle 248: abyss_legend 패시브 정의 (mid-high → high scaling)', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      const passive = TITLE_PASSIVES['abyss_legend'];
      assert.ok(passive, 'abyss_legend 패시브 존재');
      assert.equal(passive.atk, 5, `ATK +5 (실제: ${passive.atk})`);
      assert.equal(passive.crit, 0.03, `CRIT +3% (실제: ${passive.crit})`);
      assert.equal(passive.hp, 30, `HP +30 (실제: ${passive.hp})`);
      assert.equal(passive.def, 2, `DEF +2 (실제: ${passive.def})`);
  });

  test('cycle 248: void_sovereign 패시브 정의 (endgame top-tier)', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      const passive = TITLE_PASSIVES['void_sovereign'];
      assert.ok(passive, 'void_sovereign 패시브 존재');
      assert.equal(passive.atk, 7, `ATK +7 (실제: ${passive.atk})`);
      assert.equal(passive.crit, 0.04, `CRIT +4% (실제: ${passive.crit})`);
      assert.equal(passive.hp, 40, `HP +40 (실제: ${passive.hp})`);
      assert.equal(passive.def, 3, `DEF +3 (실제: ${passive.def})`);
      assert.equal(passive.mp, 20, `MP +20 (실제: ${passive.mp})`);
  });

  test('cycle 248: getTitlePassive 통합 — void_conqueror 활성 시 stats 합산', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const player = {
          name: 'Test', job: '전사', level: 50,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          equip: {}, relics: [], skillChoices: {}, titles: ['void_conqueror'],
          stats: {}, activeTitle: 'void_conqueror',
      };
      const stats = calculateFullStats(player);
      // base atk 50 + titlePassive.atk 3 = 53. relicBonus.atkFlat 0이라 수정 적용 후 53.
      assert.ok(stats.atk >= 53, `void_conqueror 활성 시 atk +3 (base 50 + 3 = 53, 실제: ${stats.atk})`);
      assert.ok(stats.maxHp >= 1020, `HP +20 적용 (base 1000 + 20, 실제: ${stats.maxHp})`);
  });

  test('cycle 248: TITLES 정의 변화 없음 (회귀 가드)', async () => {
      const { TITLES } = await import('../src/data/titles.js');
      const ids = TITLES.map((t) => t.id);
      assert.ok(ids.includes('void_conqueror'), 'void_conqueror TITLE 존재');
      assert.ok(ids.includes('abyss_legend'), 'abyss_legend TITLE 존재');
      assert.ok(ids.includes('void_sovereign'), 'void_sovereign TITLE 존재');
  });

  test('cycle 248: 기존 TITLE_PASSIVES 동작 유지 (회귀 가드)', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      // 대표 5종 sample 회귀 가드.
      assert.deepEqual(TITLE_PASSIVES['first_blood'], { atk: 1, label: 'ATK +1' });
      assert.equal(TITLE_PASSIVES['eternal'].hp, 50, 'eternal HP +50 유지');
      assert.equal(TITLE_PASSIVES['legend_chronicler'].atk, 4, 'legend_chronicler 동작 유지');
      assert.equal(TITLE_PASSIVES['cautious_explorer'].def, 1, 'cautious_explorer 동작 유지');
      assert.equal(TITLE_PASSIVES['에테르의 신'].hp, 60, '에테르의 신 (한국어 prestige) 유지');
  });
}

// ─── 원본: tests/cycle-249-title-passive-coverage-2.test.js ───
{
  /**
   * cycle 249: TITLE_PASSIVES 누락 8건 추가 dead config (cycle 248 follow-up)
   *   (cycle 222-248 silent dead config 시리즈 21번째).
   *
   * 발견 (cycle 248 audit 후 추가 발견 8건):
   * - 시즌 패스 tier 보상 3종 (cond.type='seasonTier'):
   *   '시즌 선구자' (tier 10), '시즌 정복자' (tier 20), '시즌 마스터' (tier 30) — 모두 0 보너스.
   * - 퀘스트 보상 5종 (cond.type='questReward'):
   *   '에테르 탐험가' (152), '공허의 방랑자' (153), '종말의 정복자' (154),
   *   '지도 제작자' (201), '전설의 기록자' (202).
   * - cycle 209에서 Korean-id quest reward TITLES 등록 후 TITLE_PASSIVES 미반영이라 활성 시 0 stat.
   * - cosmetic 4종 ('별을 보는 자' 등)은 의도된 cosmetic-only이라 제외.
   *
   * 패턴 (cycle 222-248 silent dead config 시리즈 21번째):
   * - cycle 248: abyss endgame 3종 TITLE_PASSIVES 추가.
   * - cycle 249: season pass + quest reward 8종 TITLE_PASSIVES 추가 (paired completion).
   *
   * 수정 (src/data/titles.ts TITLE_PASSIVES):
   * - 시즌 선구자/정복자/마스터: tier 10/20/30 점진 강화.
   * - '지도 제작자': cartographer (영문 id 동등) 미러 — { hp: 25, mp: 15 }.
   * - '전설의 기록자': legend_chronicler 미러 — { atk: 4, crit: 0.02, hp: 20 }.
   * - 에테르/공허/종말 quest endings: 각 quest 톤에 맞는 보너스.
   *
   * 회귀 가드:
   * - cycle 248 추가 abyss 3종 그대로.
   * - 기존 32개 TITLE_PASSIVES 변화 없음.
   * - cosmetic 4종은 의도된 0 보너스 유지 (premium 구매 cosmetic).
   */

  const REQUIRED_PASSIVES = [
      '시즌 선구자',
      '시즌 정복자',
      '시즌 마스터',
      '에테르 탐험가',
      '공허의 방랑자',
      '종말의 정복자',
      '지도 제작자',
      '전설의 기록자',
  ];

  test('cycle 249: 8개 누락 TITLE_PASSIVES 모두 정의', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      REQUIRED_PASSIVES.forEach((key) => {
          assert.ok(TITLE_PASSIVES[key], `'${key}' TITLE_PASSIVES 정의되어야 함`);
          assert.ok(TITLE_PASSIVES[key].label, `'${key}' label 존재`);
      });
  });

  test('cycle 249: 시즌 패스 tier 점진 강화 (10 < 20 < 30)', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      const t10 = TITLE_PASSIVES['시즌 선구자'];
      const t20 = TITLE_PASSIVES['시즌 정복자'];
      const t30 = TITLE_PASSIVES['시즌 마스터'];
      // 가중 합산: atk + def + crit*100 + hp/10 + mp/10 — coarse strength metric.
      const score = (p) => (p.atk || 0) + (p.def || 0) + (p.crit || 0) * 100 + (p.hp || 0) / 10 + (p.mp || 0) / 10;
      assert.ok(score(t10) < score(t20), `시즌 선구자(${score(t10)}) < 시즌 정복자(${score(t20)})`);
      assert.ok(score(t20) < score(t30), `시즌 정복자(${score(t20)}) < 시즌 마스터(${score(t30)})`);
  });

  test('cycle 249: 지도 제작자 ↔ cartographer 영문-id 동등 보너스 (cycle 209 정합)', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      const koreanPassive = TITLE_PASSIVES['지도 제작자'];
      const englishPassive = TITLE_PASSIVES['cartographer'];
      assert.deepEqual(
          { atk: koreanPassive.atk || 0, def: koreanPassive.def || 0, hp: koreanPassive.hp || 0, mp: koreanPassive.mp || 0, crit: koreanPassive.crit || 0 },
          { atk: englishPassive.atk || 0, def: englishPassive.def || 0, hp: englishPassive.hp || 0, mp: englishPassive.mp || 0, crit: englishPassive.crit || 0 },
          '지도 제작자 (한글 id) === cartographer (영문 id) 보너스 미러'
      );
  });

  test('cycle 249: 전설의 기록자 ↔ legend_chronicler 영문-id 동등 보너스', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      const koreanPassive = TITLE_PASSIVES['전설의 기록자'];
      const englishPassive = TITLE_PASSIVES['legend_chronicler'];
      assert.deepEqual(
          { atk: koreanPassive.atk || 0, def: koreanPassive.def || 0, hp: koreanPassive.hp || 0, mp: koreanPassive.mp || 0, crit: koreanPassive.crit || 0 },
          { atk: englishPassive.atk || 0, def: englishPassive.def || 0, hp: englishPassive.hp || 0, mp: englishPassive.mp || 0, crit: englishPassive.crit || 0 },
          '전설의 기록자 (한글 id) === legend_chronicler (영문 id) 보너스 미러'
      );
  });

  test('cycle 249: 종말의 정복자 (questReward 154) endgame top-tier scale', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      const passive = TITLE_PASSIVES['종말의 정복자'];
      // cond=questReward 154 — 게임 종반 quest 보상. 최소 atk 3 / def 1.
      assert.ok((passive.atk || 0) >= 3, `종말의 정복자 atk ≥ 3 (실제: ${passive.atk})`);
      assert.ok((passive.def || 0) >= 1, `종말의 정복자 def ≥ 1 (실제: ${passive.def})`);
  });

  test('cycle 249: 통합 — 시즌 마스터 활성 시 stats 합산 검증', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const player = {
          name: 'Test', job: '전사', level: 50,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          equip: {}, relics: [], skillChoices: {}, titles: ['시즌 마스터'],
          stats: {}, activeTitle: '시즌 마스터',
      };
      const stats = calculateFullStats(player);
      // base atk + 시즌 마스터 atk 보너스 합산 — atk ≥ 53 (base 50 + 3).
      assert.ok(stats.atk >= 53, `시즌 마스터 활성 atk +3 (실제: ${stats.atk})`);
  });

  test('cycle 248 회귀 가드: abyss 3종 그대로 유지', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      assert.equal(TITLE_PASSIVES['void_conqueror'].atk, 3, 'cycle 248 void_conqueror 회귀 가드');
      assert.equal(TITLE_PASSIVES['abyss_legend'].atk, 5, 'cycle 248 abyss_legend 회귀 가드');
      assert.equal(TITLE_PASSIVES['void_sovereign'].atk, 7, 'cycle 248 void_sovereign 회귀 가드');
  });

  test('cycle 249: cosmetic 4종은 의도된 0 보너스 유지 (회귀 가드)', async () => {
      const { TITLE_PASSIVES } = await import('../src/data/titles.js');
      // premium-구매 cosmetic 칭호는 stat 보너스 X — 의도된 design.
      assert.equal(TITLE_PASSIVES['별을 보는 자'], undefined, 'cosmetic 의도 0 보너스');
      assert.equal(TITLE_PASSIVES['공허를 걷는 자'], undefined, 'cosmetic 의도 0 보너스');
      assert.equal(TITLE_PASSIVES['에테르의 아이'], undefined, 'cosmetic 의도 0 보너스');
      assert.equal(TITLE_PASSIVES['세계의 끝'], undefined, 'cosmetic 의도 0 보너스');
  });
}

// ─── 원본: tests/cycle-262-cosmetic-title-fallback.test.js ───
{
  /**
   * cycle 262: cosmetic title checkTitles fallback handler 누락 dead config
   *   (cycle 222-261 silent dead config 시리즈 33번째).
   *
   * 발견 (cycle 199 prestigeRank / 201 seasonTier / 260 questReward 시리즈 paired):
   * - src/utils/gameUtils.ts checkTitles는 cycle 199/201/260에서 prestigeRank / seasonTier /
   *   questReward fallback handler 추가 — 저장 손실 / 마이그레이션 등 복구 케이스 보호.
   * - 그러나 cond.type='cosmetic' 4종 ('별을 보는 자' / '공허를 걷는 자' / '에테르의 아이' /
   *   '세계의 끝')은 잔존 누락. purchaseCosmeticTitle이 직접 grant하지만 checkTitles에 fallback
   *   없어 player.titles 손실 시 영구 복구 불가.
   * - stats.cosmeticTitles에 영문 id (title_stargazer 등)가 영구 ledger로 저장되지만 checkTitles는
   *   이를 검증하지 않음 → premium 구매 cosmetic 자산 silent loss 가능.
   *
   * 패턴 (cycle 222-261 silent dead config 시리즈 33번째):
   * - cycle 199: prestigeRank fallback.
   * - cycle 201: seasonTier fallback.
   * - cycle 260: questReward fallback.
   * - cycle 262: cosmetic fallback (시리즈 paired completion 마무리).
   *
   * 매핑 인프라:
   * - PREMIUM_SHOP.cosmeticTitles[i].name === TITLES title.id (Korean 이름 동등).
   * - PREMIUM_SHOP.cosmeticTitles[i].id (영문) === stats.cosmeticTitles[i] (저장).
   * - title.id로 PREMIUM_SHOP에서 영문 id 조회 → stats.cosmeticTitles 매칭.
   *
   * 수정:
   * - src/utils/gameUtils.ts:
   *   - PREMIUM_SHOP import 추가.
   *   - checkTitles에 'cosmetic' fallback handler — 영문 id 매핑 후 stats.cosmeticTitles 매칭.
   *
   * 회귀 가드:
   * - cycle 199/201/260 fallback 동작 유지.
   * - stats.cosmeticTitles 빈 배열 시 미발동 (회귀 가드).
   * - cosmetic title은 stat 보너스 없음 (cycle 248-249 confirmed cosmetic-only).
   */

  test('cycle 262: 별을 보는 자 fallback — stats.cosmeticTitles 매칭', async () => {
      const { checkTitles } = await import('../src/utils/gameUtils.js');
      const player = {
          titles: [],
          level: 30,
          meta: {},
          stats: {
              kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
              relicCount: 0, abyssFloor: 0, abyssRecord: 0,
              escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
              visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
              killRegistry: {}, codex: {}, codexClaimed: [],
              // 'title_stargazer' (영문) 매핑 — '별을 보는 자' Korean title.id에 해당.
              cosmeticTitles: ['title_stargazer'],
              synthProtects: 0, claimedAchievements: [], buildWins: {},
              codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
              signaturePity: 0, bountyIssued: false, dailyProtocol: null,
              dailyInvadeCount: 0, lastInvadeDate: null,
              claimedQuestIds: [], bountiesCompleted: 0,
          },
      };
      const newTitles = checkTitles(player);
      assert.ok(newTitles.includes('별을 보는 자'),
          `'별을 보는 자' fallback unlock (실제: ${newTitles.join(',')})`);
  });

  test('cycle 262: 모든 4 cosmetic titles fallback 동작', async () => {
      const { checkTitles } = await import('../src/utils/gameUtils.js');
      const player = {
          titles: [],
          level: 30,
          meta: {},
          stats: {
              kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
              relicCount: 0, abyssFloor: 0, abyssRecord: 0,
              escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
              visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
              killRegistry: {}, codex: {}, codexClaimed: [],
              cosmeticTitles: ['title_stargazer', 'title_voidwalker', 'title_aetherborn', 'title_worldender'],
              synthProtects: 0, claimedAchievements: [], buildWins: {},
              codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
              signaturePity: 0, bountyIssued: false, dailyProtocol: null,
              dailyInvadeCount: 0, lastInvadeDate: null,
              claimedQuestIds: [], bountiesCompleted: 0,
          },
      };
      const newTitles = checkTitles(player);
      ['별을 보는 자', '공허를 걷는 자', '에테르의 아이', '세계의 끝'].forEach((expected) => {
          assert.ok(newTitles.includes(expected),
              `'${expected}' fallback (실제: ${newTitles.join(',')})`);
      });
  });

  test('cycle 262: stats.cosmeticTitles 비어있을 시 fallback 미발동 (회귀 가드)', async () => {
      const { checkTitles } = await import('../src/utils/gameUtils.js');
      const player = {
          titles: [],
          level: 30,
          meta: {},
          stats: {
              kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
              relicCount: 0, abyssFloor: 0, abyssRecord: 0,
              escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
              visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
              killRegistry: {}, codex: {}, codexClaimed: [],
              cosmeticTitles: [],
              synthProtects: 0, claimedAchievements: [], buildWins: {},
              codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
              signaturePity: 0, bountyIssued: false, dailyProtocol: null,
              dailyInvadeCount: 0, lastInvadeDate: null,
              claimedQuestIds: [], bountiesCompleted: 0,
          },
      };
      const newTitles = checkTitles(player);
      assert.ok(!newTitles.includes('별을 보는 자'),
          '비어있는 cosmeticTitles 시 fallback 미발동');
  });

  test('cycle 262: cycle 199/201/260 fallback 동작 유지 (시리즈 회귀 가드)', async () => {
      const { checkTitles } = await import('../src/utils/gameUtils.js');
      const player = {
          titles: [],
          level: 30,
          meta: { prestigeRank: 1 },
          stats: {
              kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
              relicCount: 0, abyssFloor: 0, abyssRecord: 0,
              escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
              visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
              killRegistry: {}, codex: {}, codexClaimed: [],
              cosmeticTitles: ['title_stargazer'],
              synthProtects: 0, claimedAchievements: [], buildWins: {},
              codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
              signaturePity: 0, bountyIssued: false, dailyProtocol: null,
              dailyInvadeCount: 0, lastInvadeDate: null,
              claimedQuestIds: [152], bountiesCompleted: 0,
          },
          seasonPass: { tier: 10 },
      };
      const newTitles = checkTitles(player);
      assert.ok(newTitles.includes('각성자'), 'cycle 199 prestigeRank 회귀 가드');
      assert.ok(newTitles.includes('시즌 선구자'), 'cycle 201 seasonTier 회귀 가드');
      assert.ok(newTitles.includes('에테르 탐험가'), 'cycle 260 questReward 회귀 가드');
      assert.ok(newTitles.includes('별을 보는 자'), 'cycle 262 cosmetic 신규 동작');
  });
}

// ─── 원본: tests/cycle-85-alchemist-title.test.js ───
{
  /**
   * cycle 85: 연금술사(alchemist) 칭호 — synths 카운터 기반 빈 자리 채움.
   *
   * 배경:
   * - cycle 30+에 ach_synth_5/20/50 achievement가 추가되었고,
   *   cycle 82에서 StatsPanel SYNTHESES 라인이 노출됐지만,
   *   합성 카운터 기반 칭호는 없던 상태 (crafts에는 'crafter' 칭호 존재).
   * - 합성은 cycle 30+에서 추가된 깊은 시스템(아이템 + 골드 + 보호 옵션 소비)
   *   이라 단순 craft보다 의도된 노력이 필요. 칭호로 보상하는 게 자연스러움.
   *
   * 추가:
   * - id 'alchemist' / name '연금술사' / cond synths >= 20 / amber-300
   * - checkTitles에 type === 'synths' 핸들러 (player.stats.syntheses 읽음;
   *   cycle 82에서 INITIAL_STATE에 declare된 필드)
   */

  test('alchemist 칭호 등록됨 (synths 20)', () => {
      const title = TITLES.find((t) => t.id === 'alchemist');
      assert.ok(title, 'alchemist title should exist');
      assert.equal(title.name, '연금술사');
      assert.equal(title.cond.type, 'synths');
      assert.equal(title.cond.val, 20);
  });

  test('checkTitles: syntheses >= 20 → alchemist 활성', () => {
      const player = { titles: [], stats: { syntheses: 20 } };
      const unlocked = checkTitles(player);
      assert.ok(unlocked.includes('alchemist'), 'alchemist should be unlocked at 20 syntheses');
  });

  test('checkTitles: syntheses < 20 → alchemist 비활성', () => {
      const player = { titles: [], stats: { syntheses: 19 } };
      const unlocked = checkTitles(player);
      assert.ok(!unlocked.includes('alchemist'), 'alchemist should be locked below threshold');
  });

  test('checkTitles: syntheses 누락 → 0 취급, alchemist 비활성', () => {
      const player = { titles: [], stats: {} };
      const unlocked = checkTitles(player);
      assert.ok(!unlocked.includes('alchemist'));
  });

  test('checkTitles: 이미 보유한 alchemist는 재해금 안 됨', () => {
      const player = { titles: ['alchemist'], stats: { syntheses: 100 } };
      const unlocked = checkTitles(player);
      assert.ok(!unlocked.includes('alchemist'), 'should not re-unlock owned title');
  });
}
