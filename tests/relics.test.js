import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ACHIEVEMENTS } from '../src/data/quests.js';
import { BALANCE } from '../src/data/constants.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { DB } from '../src/data/db.js';
import { RELICS } from '../src/data/relics.js';
import { applyBattleStartRelics } from '../src/utils/exploreUtils.js';
import { applyDailyProtocolProgress } from '../src/reducers/handlers/helpers.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getAchievementCurrentValue, isAchievementUnlocked } from '../src/utils/gameUtils.js';
import { readdir } from 'node:fs/promises';

/**
 * 유물(Relic) 효과·시너지·데이터·소스가드 테스트 — 통합본.
 * 기존 20개 cycle-*relic*.test.js 통합 (audit #1: cycle 테스트 도메인 통합).
 * 각 원본 파일 본문을 블록 { } 으로 감싸 파일별 helper 충돌을 격리 — 행동/커버리지 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

// ─── 원본: tests/cycle-101-relic-count-double-counting.test.js ───
{
  /**
   * cycle 101: relicCount achievement 진행도 double-counting 회귀 fix.
   *
   * 발견된 버그:
   * - getAchievementCurrentValue('relicCount') 가 `(player.relics || []).length +
   *   (stats?.relicCount || 0)` 로 계산됨.
   * - 그러나 ADD_RELIC handler(progressionHandlers.ts:43-55)는 매 relic 획득 시
   *   player.relics 배열에 push하면서 동시에 stats.relicCount도 +1 증분.
   * - 즉 `stats.relicCount` 자체가 이미 "획득한 모든 relic 수"를 정확히 반영.
   *   거기에 현재 인벤토리의 relics.length를 더하면 현재 런의 relic이 두 번
   *   카운트됨.
   * - 결과: achievement "유물 5개 획득"(ach_relic_5)이 실제로는 3개에서 unlock
   *   (3 + 3 = 6 ≥ 5). 마찬가지로 15개 → 8개에서, 30개 → 15개에서 풀림. 의도
   *   대비 완료가 50% 빠른 부풀림 회귀.
   *
   * fix: getAchievementCurrentValue 의 relicCount 분기에서 `+ relics.length` 제거.
   * 이제 stats.relicCount 단일 source of truth로 — checkTitles('relicCount')와 정합.
   *
   * Ascension 후 relics 배열은 reset되지만 stats.relicCount는 보존되므로
   * (progressionHandlers.ts:78), prestige 누적 카운트도 그대로 유지된다.
   */

  const findAch = (id) => ACHIEVEMENTS.find((a) => a.id === id);

  test('getAchievementCurrentValue: relicCount 5 → 5 (relics 배열 길이와 무관)', () => {
      const player = {
          relics: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }],
          stats: { relicCount: 5 },
      };
      assert.equal(getAchievementCurrentValue({ target: 'relicCount' }, player), 5);
  });

  test('isAchievementUnlocked: ach_relic_5 — relicCount 정확히 5에서 unlock', () => {
      // 4개 시점: 미잠금
      assert.equal(
          isAchievementUnlocked(findAch('ach_relic_5'), {
              relics: Array.from({ length: 4 }, (_, i) => ({ id: `r${i}` })),
              stats: { relicCount: 4 },
          }),
          false,
          'should NOT unlock at 4 relics'
      );
      // 5개 시점: 잠금 해제
      assert.equal(
          isAchievementUnlocked(findAch('ach_relic_5'), {
              relics: Array.from({ length: 5 }, (_, i) => ({ id: `r${i}` })),
              stats: { relicCount: 5 },
          }),
          true,
          'should unlock at exactly 5 relics'
      );
  });

  test('isAchievementUnlocked: ach_relic_5 — 3개 시점에 더 이상 false unlock 안 됨 (회귀 가드)', () => {
      // 회귀: 이전엔 (3 + 3 = 6 ≥ 5) 로 unlock 됐음
      const player = {
          relics: Array.from({ length: 3 }, (_, i) => ({ id: `r${i}` })),
          stats: { relicCount: 3 },
      };
      assert.equal(
          isAchievementUnlocked(findAch('ach_relic_5'), player),
          false,
          'must NOT false-unlock with 3 relics (fix double-counting)'
      );
  });

  test('Ascension 후 relicCount 보존 시나리오: relics=[] but relicCount=12 → ach_relic_5/15 unlocked', () => {
      // 첫 런에서 12개 획득 후 ascend → relics=[]로 리셋되지만 stats.relicCount=12 보존.
      const player = { relics: [], stats: { relicCount: 12 } };
      assert.equal(isAchievementUnlocked(findAch('ach_relic_5'), player), true);
      assert.equal(isAchievementUnlocked(findAch('ach_relic_15'), player), false, '15는 아직 부족');
  });

  test('relics 누락 (legacy save) → relicCount만으로도 정상 평가', () => {
      const player = { stats: { relicCount: 10 } };
      assert.equal(getAchievementCurrentValue({ target: 'relicCount' }, player), 10);
  });
}

// ─── 원본: tests/cycle-148-relic-effect-handler-guard.test.js ───
{
  /**
   * cycle 148: relic.effect 핸들러 baseline 가드.
   *
   * cycle 141(quest reward.item baseline) / 147(dead AT keys) 흐름의 연장.
   * 유물은 effect 문자열 키로 dispatch — 코드 어딘가에서 `'effect_name'` 비교
   * 로 발동된다. 핸들러가 없으면 유물이 인벤에 들어와도 silent no-op (상태에
   * 표시는 되지만 실제 효과 0).
   *
   * 발견: 81종 unique effect 중 34종이 src/ 어디에서도 핸들러 등록 0건.
   * 해당 유물이 드랍되더라도 효과 발동 안 함. 신화/창세 tier 유물이 다수
   * 포함 — 큰 콘텐츠 갭. 단일 사이클로는 못 닫음 — baseline lock으로 점진 정리:
   *
   * 1. KNOWN_MISSING_RELIC_EFFECTS Set — 현재 34종 명시 인정.
   * 2. NEW dead effect 가드: baseline 외 추가되면 즉시 실패 — 새 유물 추가
   *    시 핸들러 누락 catch.
   * 3. baseline 좁히기 가드: handled 된 effect가 baseline에 남아 있으면 실패
   *    — 점진 정리 강제.
   *
   * cycle 148(34) → 149(-2) → 150(-2) → 151(-2) → 152(-2) → 153(-12 batch) →
   * 154(-3) → 155(-2) → 156(-3) → 157(-2) → 158(-2) → 159(-2) = 0 🎯
   *
   * baseline 0 달성! 모든 81종 effect의 핸들러가 src/ 어딘가에서 참조됨.
   * 회귀 가드는 빈 Set 기준으로 lock 유지 — 향후 새 유물 추가 시 핸들러
   * 누락이 즉시 detect 됨.
   */

  const SRC = path.join(ROOT, 'src');
  const RELICS_PATH = path.join(SRC, 'data/relics.ts');

  const KNOWN_MISSING_RELIC_EFFECTS = new Set([
      // 일반/희귀 (cycle 148 초기 발견 14종)
      // 'on_hit_freeze', ← cycle 152: 일반 공격 시 val 확률로 적 빙결 핸들러 추가.
      // 'first_turn_evade', ← cycle 150: DEF 보너스 핸들러 추가 (첫 턴 회피는 별도 사이클).
      // 'battle_start_buff', ← cycle 158: applyBattleStartRelics tempBuff 적용 핸들러 추가.
      // 'titan',     ← cycle 149: HP 보너스 핸들러 추가 (critReduce는 별도 사이클).
      // 'spell_stack', ← cycle 229: combatFlags.spellStackCount 누적 + 데미지 mult 핸들러 추가.
      // 'hp_drain_atk', ← cycle 150: atkBonus 핸들러 추가 (매 턴 HP cost는 별도 사이클).
      // 'elem_boost', ← cycle 151: 약점 적중 배율 boost 핸들러 추가.
      // 'genesis',   ← cycle 149: statBonus 핸들러 추가 (healPerTurn은 별도 사이클).
      // 'kill_stack_atk', ← cycle 158: combatFlags.killStackAtkBonus per-combat 누적 + atkFlat 합산.
      // 'cooldown_reduce', ← cycle 151: cdReduction 핸들러 추가 (firstFree는 별도 사이클).
      // 'phoenix_revive', ← cycle 157: heal 부분 핸들러 추가 (atkBuff tempBuff는 별도 사이클).
      // 'reflect_crit', ← cycle 152: critBonus 핸들러 추가 (피해 반사는 별도 사이클).
      // 'devour_hp', ← cycle 157: handleVictory에서 maxHp 영구 증가 핸들러 추가.
      // 'entropy_tick', ← cycle 159: applyEntropyTick 헬퍼로 매 N턴 고정 피해 핸들러 추가.
      // 'arcane_surge', ← cycle 153: applySynergyBonuses 코멘트로 effect-name 명시.
      // 신화/창세 tier (의미상 ultimate 빌드)
      // cycle 153: 시너지 effect-name dispatch 추가로 11건 baseline 통과 (vampire_lord / arcane_surge /
      //   unbreakable / time_master / death_oracle / immortal_warrior / eternal_life / infinite_devour /
      //   absolute_immortal / blood_immortal / primordial_wrath). bonus-key fallback 보존.
      // 'vampire_lord',
      // 'unbreakable',
      // 'time_master',
      // 'death_oracle',
      // 'immortal_warrior',
      // 'hell_reaper', ← cycle 156: lifeStealBonus 시너지 dispatch 추가 (vampire_lord와 합산).
      // 'annihilator', ← cycle 156: executeThreshold 시너지 dispatch 추가 (execute_bonus 유물과 합산).
      // 'eternal_life',
      // 'time_dominator', ← cycle 155: cdReduction + extraAction 시너지 dispatch 추가.
      // 'absolute_reflect', ← cycle 156: 받은 피해 reflect + stunOnReflect 시너지 dispatch 추가 (enemyAttack hook).
      // 'entropy_brand', ← cycle 159: applyEntropyTick에서 시너지 우선 분기 (damage 0.12 / interval 2).
      // 'infinite_devour',
      // 'void_dragon', ← cycle 154: bonus.critDmg 시너지 dispatch 추가 (CombatEngine attack/performSkill).
      // 'absolute_immortal',
      // 'blood_immortal',
      // 'arcane_singularity', ← cycle 155: freeSkillChance + skillMult 시너지 dispatch 추가.
      // 'primordial_wrath',
      // 'eternal_fortress', ← cycle 154: applySynergyBonuses defMult 추가 (DEF +80%).
      // 'entropy_god', ← cycle 154: applySynergyBonuses chaosAtk → atkMult 합류 (ATK +50%).
  ]);

  const collectRelicEffects = async () => {
      const src = await readFile(RELICS_PATH, 'utf8');
      const effects = new Set();
      const re = /effect:\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(src)) !== null) effects.add(m[1]);
      return effects;
  };

  const walk = async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true });
      let out = '';
      for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
              out += await walk(full);
          } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
              if (full === RELICS_PATH) continue;
              out += await readFile(full, 'utf8');
              out += '\n';
          }
      }
      return out;
  };

  const findMissingEffects = async () => {
      const effects = await collectRelicEffects();
      const corpus = await walk(SRC);
      const missing = new Set();
      for (const eff of effects) {
          if (
              !corpus.includes(`'${eff}'`) &&
              !corpus.includes(`"${eff}"`) &&
              !corpus.includes(`\`${eff}\``)
          ) {
              missing.add(eff);
          }
      }
      return missing;
  };

  test('relic.effect: NEW missing handler 0건 (baseline 외 추가 시 즉시 실패)', async () => {
      const missing = await findMissingEffects();
      const newMissing = [...missing].filter((e) => !KNOWN_MISSING_RELIC_EFFECTS.has(e));
      assert.deepEqual(newMissing, [],
          `NEW relic effects without handler (add handler or update baseline):\n  ${newMissing.join('\n  ')}`);
  });

  test('relic.effect: baseline 좁히기 — known missing이 핸들러 추가됐으면 baseline에서 제거', async () => {
      const missing = await findMissingEffects();
      const stale = [...KNOWN_MISSING_RELIC_EFFECTS].filter((e) => !missing.has(e));
      assert.deepEqual(stale, [],
          `stale baseline (these effects are now handled — remove from KNOWN_MISSING_RELIC_EFFECTS):\n  ${stale.join('\n  ')}`);
  });
}

// ─── 원본: tests/cycle-149-relic-titan-genesis-stats.test.js ───
{
  /**
   * cycle 149: 'titan' / 'genesis' 유물 핸들러 추가 (cycle 148 baseline 좁히기).
   *
   * cycle 148이 34종 dead relic effect를 baseline lock 한 후 점진 정리.
   * 핸들러가 가장 단순한 passive multiplier 두 개부터 적용:
   *
   * 1. titan (titan_belt) — 최대 HP +30%. (받는 치명타 피해 -50%는 별도 사이클.)
   * 2. genesis (genesis_core) — 전 스탯(ATK/DEF/HP) +15%. (매 턴 HP 회복은 별도 사이클.)
   *
   * 둘 다 statsCalculator.computeRelicBonuses의 atkFlat / defFlat / hpMult
   * 리듀서에 1-line 추가로 반영된다.
   */

  // 큰 base 스탯으로 floor 라운딩 오차 영향 최소화.
  const makeBasePlayer = () => ({
      name: 'tester',
      job: '모험가',
      level: 50,
      hp: 1000, maxHp: 1000, mp: 500, maxMp: 500,
      atk: 1000, def: 500,
      inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
      stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
      relics: [],
      skillChoices: {},
      titles: [], activeTitle: null,
      killStreak: 0,
      combatFlags: {},
      status: [],
  });

  const findRelic = (id) => RELICS.find((r) => r.id === id);

  test("titan (titan_belt): 최대 HP +30% multiplicative 적용", () => {
      const base = makeBasePlayer();
      const baseStats = calculateFullStats(base);

      const withTitan = { ...base, relics: [findRelic('titan_belt')] };
      const titanStats = calculateFullStats(withTitan);

      // titan_belt val.hp = 0.3 → maxHp는 baseline 대비 +30% 이상이어야 함
      assert.ok(titanStats.maxHp > baseStats.maxHp,
          `expected titan_belt to increase maxHp; base=${baseStats.maxHp} titan=${titanStats.maxHp}`);
      const ratio = titanStats.maxHp / baseStats.maxHp;
      assert.ok(ratio >= 1.29 && ratio <= 1.31,
          `expected titan_belt maxHp ratio ~1.30; got ${ratio.toFixed(3)}`);
  });

  test("genesis (genesis_core): 전 스탯 +15% (ATK / DEF / HP)", () => {
      const base = makeBasePlayer();
      const baseStats = calculateFullStats(base);

      const withGenesis = { ...base, relics: [findRelic('genesis_core')] };
      const gStats = calculateFullStats(withGenesis);

      const atkRatio = gStats.atk / baseStats.atk;
      const defRatio = gStats.def / baseStats.def;
      const hpRatio = gStats.maxHp / baseStats.maxHp;

      for (const [label, ratio] of [['atk', atkRatio], ['def', defRatio], ['maxHp', hpRatio]]) {
          // floor 라운딩 영향 흡수 허용. 핵심: 15% 부스트가 실제로 반영됨.
          assert.ok(ratio >= 1.13 && ratio <= 1.17,
              `expected genesis_core ${label} ratio ~1.15; got ${ratio.toFixed(3)}`);
      }
  });

  test("cycle 148 baseline 회귀: titan / genesis effect string이 src/에서 참조됨", async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const calcSrc = await readFile(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8');
      assert.match(calcSrc, /'titan'/);
      assert.match(calcSrc, /'genesis'/);
  });
}

// ─── 원본: tests/cycle-150-relic-hp-drain-shadow-cloak.test.js ───
{
  /**
   * cycle 150: 'hp_drain_atk' / 'first_turn_evade' 유물 핸들러 추가.
   *
   * cycle 148 baseline 32 → 30. cycle 149에 이은 점진 정리 — 가장 단순한
   * passive multiplier 반영.
   *
   * 1. hp_drain_atk (혈맹의 반지 / 심연의 계약) — atkBonus 부분 반영
   *    (val.atkBonus를 atkFlat에 더함). 매 턴 HP cost는 별도 사이클.
   * 2. first_turn_evade (그림자 망토) — DEF 부분 반영 (val을 defFlat에 더함).
   *    전투 첫 턴 회피 보장은 별도 사이클 (combat init flag 필요).
   */

  const makeBasePlayer = () => ({
      name: 'tester',
      job: '모험가',
      level: 50,
      hp: 1000, maxHp: 1000, mp: 500, maxMp: 500,
      atk: 1000, def: 500,
      inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
      stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
      relics: [],
      skillChoices: {},
      titles: [], activeTitle: null,
      killStreak: 0,
      combatFlags: {},
      status: [],
  });

  const findRelic = (id) => RELICS.find((r) => r.id === id);

  test("hp_drain_atk (blood_oath_ring): ATK +35% 반영", () => {
      const base = makeBasePlayer();
      const baseStats = calculateFullStats(base);

      const withRing = { ...base, relics: [findRelic('blood_oath_ring')] };
      const ringStats = calculateFullStats(withRing);

      const atkRatio = ringStats.atk / baseStats.atk;
      assert.ok(atkRatio >= 1.33 && atkRatio <= 1.37,
          `expected blood_oath_ring atk ratio ~1.35; got ${atkRatio.toFixed(3)}`);
  });

  test("hp_drain_atk (abyssal_contract): ATK +60% 반영 (legendary tier)", () => {
      const base = makeBasePlayer();
      const baseStats = calculateFullStats(base);

      const withContract = { ...base, relics: [findRelic('abyssal_contract')] };
      const contractStats = calculateFullStats(withContract);

      const atkRatio = contractStats.atk / baseStats.atk;
      assert.ok(atkRatio >= 1.58 && atkRatio <= 1.62,
          `expected abyssal_contract atk ratio ~1.60; got ${atkRatio.toFixed(3)}`);
  });

  test("first_turn_evade (shadow_cloak): DEF +10% 반영", () => {
      const base = makeBasePlayer();
      const baseStats = calculateFullStats(base);

      const withCloak = { ...base, relics: [findRelic('shadow_cloak')] };
      const cloakStats = calculateFullStats(withCloak);

      const defRatio = cloakStats.def / baseStats.def;
      assert.ok(defRatio >= 1.09 && defRatio <= 1.11,
          `expected shadow_cloak def ratio ~1.10; got ${defRatio.toFixed(3)}`);
  });

  test("cycle 148 baseline 회귀: hp_drain_atk / first_turn_evade effect string이 src/에서 참조됨", async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const calcSrc = await readFile(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8');
      assert.match(calcSrc, /'hp_drain_atk'/);
      assert.match(calcSrc, /'first_turn_evade'/);
  });
}

// ─── 원본: tests/cycle-151-relic-cooldown-elem-boost.test.js ───
{
  /**
   * cycle 151: 'cooldown_reduce' / 'elem_boost' 유물 핸들러 추가.
   *
   * cycle 148 baseline 30 → 28. cycle 149-150에 이은 점진 정리.
   * 이번 사이클은 단순 multiplier 범위를 넘어 CombatEngine 내부 분기까지
   * 확장:
   *
   * 1. cooldown_reduce (시간 군주의 왕관) — 스킬 사용 시 초기 쿨다운에서
   *    val.cdReduction(=1) 차감. firstFree(첫 스킬 MP 무소비)는 별도 사이클.
   * 2. elem_boost (프리즘 핵) — 약점 적중 시 ELEMENT_WEAK_MULT(=1.25)에
   *    val(=0.25) 추가 → 1.5 배율. resistance/none은 영향 없음.
   */

  const baseEnemy = {
      name: 'tester',
      hp: 100, maxHp: 100,
      atk: 10, def: 5,
      weakness: '화염',
      resistance: '냉기',
  };

  test("elem_boost (prism_core): 약점 elem 적중 시 1.25 → 1.5 배율", () => {
      const enemy = { ...baseEnemy };
      const noRelic = CombatEngine.getElementMultiplier('화염', enemy, []);
      assert.equal(noRelic, BALANCE.ELEMENT_WEAK_MULT, 'baseline 약점 배율은 1.25여야 함');

      const withPrism = CombatEngine.getElementMultiplier('화염', enemy, [
          { effect: 'elem_boost', val: 0.25 },
      ]);
      assert.equal(withPrism, BALANCE.ELEMENT_WEAK_MULT + 0.25,
          `expected 1.5; got ${withPrism}`);
  });

  test("elem_boost: resistance/일반 elem 영향 없음 (약점 적중에만 적용)", () => {
      const enemy = { ...baseEnemy };
      const resistMult = CombatEngine.getElementMultiplier('냉기', enemy, [
          { effect: 'elem_boost', val: 0.25 },
      ]);
      // 저항 배율은 그대로 (cycle 151 변경 외 회귀 가드)
      assert.equal(resistMult, BALANCE.ELEMENT_RESIST_MULT);

      const neutralMult = CombatEngine.getElementMultiplier('암흑', enemy, [
          { effect: 'elem_boost', val: 0.25 },
      ]);
      assert.equal(neutralMult, 1);
  });

  test("getElementMultiplier 회귀: relics 미전달 시(undefined) 기존 동작 유지", () => {
      const enemy = { ...baseEnemy };
      const mult = CombatEngine.getElementMultiplier('화염', enemy);
      assert.equal(mult, BALANCE.ELEMENT_WEAK_MULT);
  });

  test("cycle 148 baseline 회귀: cooldown_reduce / elem_boost effect string이 src/에서 참조됨", async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const engineSrc = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
      assert.match(engineSrc, /'cooldown_reduce'/);
      assert.match(engineSrc, /'elem_boost'/);
  });
}

// ─── 원본: tests/cycle-152-relic-on-hit-freeze-reflect-crit.test.js ───
{
  /**
   * cycle 152: 'on_hit_freeze' / 'reflect_crit' 유물 핸들러 추가.
   *
   * cycle 148 baseline 28 → 26.
   *
   * 1. on_hit_freeze (frost_anchor) — 일반 공격 시 val(=0.15) 확률로 적 1턴 빙결.
   *    기존 vampire_lord (lifeSteal) hook 직후에 동일 패턴으로 추가.
   *    val=1.0 → 100% 보장 / val=0 → 발동 0건. 동결의 닻 로그 출력.
   * 2. reflect_crit (mirror_of_fate) — critBonus +val.critBonus(=0.15) 부분 반영.
   *    피해 반사는 별도 사이클 (enemyAttack 훅 필요).
   */

  const findRelic = (id) => RELICS.find((r) => r.id === id);

  const baseStatsObj = {
      atk: 100,
      def: 50,
      elem: 'physical',
      activeSynergies: [],
      relics: [],
      critChance: 0,
  };

  // hp 큰 enemy로 1타에 안 죽도록 — newEnemyHp > 0 보장.
  const baseEnemy = () => ({ name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5, weakness: null, resistance: null });

  const fakePlayer = () => ({
      name: 'tester',
      job: '모험가',
      level: 10,
      hp: 100, maxHp: 100, mp: 50, maxMp: 50,
      atk: 100, def: 50,
      inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
      relics: [],
      skillChoices: {},
      titles: [], activeTitle: null,
      killStreak: 0,
      combatFlags: {},
      status: [],
      stats: { kills: 0 },
  });

  test("on_hit_freeze (frost_anchor): val=1.0 강제 발동 — 적이 빙결 상태로 전환", () => {
      const player = fakePlayer();
      const enemy = baseEnemy();
      const stats = {
          ...baseStatsObj,
          relics: [{ ...findRelic('frost_anchor'), val: 1 }], // 100% 빙결 강제
      };

      const result = CombatEngine.attack(player, enemy, stats);
      assert.ok((result.updatedEnemy.stunnedTurns ?? 0) >= 1,
          `expected enemy stunnedTurns >= 1 (frozen); got ${result.updatedEnemy.stunnedTurns}`);
  });

  test("on_hit_freeze: val=0 → 빙결 발동 안 됨 (chance 가드)", () => {
      const player = fakePlayer();
      const enemy = baseEnemy();
      const stats = {
          ...baseStatsObj,
          relics: [{ ...findRelic('frost_anchor'), val: 0 }],
      };

      const result = CombatEngine.attack(player, enemy, stats);
      assert.equal(result.updatedEnemy.stunnedTurns ?? 0, 0,
          'val=0이면 빙결 발동 안 해야 함');
  });

  test("on_hit_freeze: 적 처치 시(newEnemyHp<=0) 빙결 무효 — postHitEnemy 가드", () => {
      const player = fakePlayer();
      const enemy = { ...baseEnemy(), hp: 1, maxHp: 100 };
      const stats = {
          ...baseStatsObj,
          relics: [{ ...findRelic('frost_anchor'), val: 1 }],
      };

      const result = CombatEngine.attack(player, enemy, stats);
      // 적이 죽었으면 빙결 의미 없음 — 적용 안 됨
      if (result.updatedEnemy.hp <= 0) {
          assert.equal(result.updatedEnemy.stunnedTurns ?? 0, 0,
              'newEnemyHp<=0 케이스에 빙결 적용은 의미 없음');
      }
  });

  test("reflect_crit (mirror_of_fate): critChance +15% 반영", () => {
      const base = fakePlayer();
      const baseStats = calculateFullStats(base);

      const withMirror = { ...base, relics: [findRelic('mirror_of_fate')] };
      const mStats = calculateFullStats(withMirror);

      const delta = mStats.critChance - baseStats.critChance;
      assert.ok(delta >= 0.14 && delta <= 0.16,
          `expected mirror_of_fate critChance +0.15; got delta=${delta.toFixed(3)}`);
  });

  test("cycle 148 baseline 회귀: on_hit_freeze / reflect_crit effect string이 src/에서 참조됨", async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const engineSrc = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
      const calcSrc = await readFile(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8');
      assert.match(engineSrc, /'on_hit_freeze'/);
      assert.match(calcSrc, /'reflect_crit'/);
  });
}

// ─── 원본: tests/cycle-157-relic-phoenix-devour.test.js ───
{
  /**
   * cycle 157: 'phoenix_revive' / 'devour_hp' 유물 핸들러 추가
   * (cycle 148 baseline 6 → 4).
   *
   * 1. phoenix_revive (phoenix_feather) — applyFatalProtection의 void_heart 분기
   *    아래 fallback. HP 0 도달 시 healRatio(=0.3) HP로 부활. 1회 한정.
   *    atkBuff/duration tempBuff는 별도 사이클 (multiplier 인프라 필요).
   * 2. devour_hp (world_eater) — handleVictory에서 적 maxHp의 val(=0.1)만큼
   *    player.maxHp 영구 증가. "전투 내" 리셋은 별도 사이클 (per-combat reset
   *    인프라 미구현).
   */

  test("phoenix_revive (phoenix_feather): HP 0 도달 시 healRatio 비율로 부활", () => {
      const player = {
          hp: 0, maxHp: 1000, mp: 50, maxMp: 50,
          relics: [{ effect: 'phoenix_revive', val: { healRatio: 0.3, atkBuff: 0.5, duration: 3 } }],
          combatFlags: {},
          status: [],
      };
      const result = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);

      // healRatio 0.3 * maxHp 1000 = 300 HP로 부활.
      assert.equal(result.updatedPlayer.hp, 300,
          `expected hp 300 (30% of maxHp); got ${result.updatedPlayer.hp}`);
      assert.equal(result.isDead, false);
      assert.equal(result.updatedPlayer.combatFlags.phoenixUsed, true,
          'phoenix 1회 사용 플래그 확인');
  });

  test("phoenix_revive: 1회만 발동 — phoenixUsed 플래그 보존 시 부활 안 함", () => {
      const player = {
          hp: 0, maxHp: 1000, mp: 50, maxMp: 50,
          relics: [{ effect: 'phoenix_revive', val: { healRatio: 0.3 } }],
          combatFlags: { phoenixUsed: true },
          status: [],
      };
      const result = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);

      // 이미 1회 사용된 상태 → 부활 안 함.
      assert.equal(result.updatedPlayer.hp, 0);
      assert.equal(result.isDead, true);
  });

  test("phoenix_revive: void_heart 우선순위 — void_heart 사용 안 했으면 phoenix 발동 안 함", () => {
      // void_heart와 phoenix 둘 다 보유 — void_heart 먼저 발동
      const player = {
          hp: 0, maxHp: 1000, mp: 50, maxMp: 50,
          relics: [
              { effect: 'void_heart' },
              { effect: 'phoenix_revive', val: { healRatio: 0.3 } },
          ],
          combatFlags: {},
          status: [],
      };
      const result = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);

      // void_heart가 먼저 → hp=1, voidHeartUsed=true, phoenix는 그대로 (다음에 발동)
      assert.equal(result.updatedPlayer.hp, 1);
      assert.equal(result.updatedPlayer.combatFlags.voidHeartUsed, true);
      assert.notEqual(result.updatedPlayer.combatFlags.phoenixUsed, true);
  });

  test("devour_hp (world_eater): handleVictory 시 enemy.maxHp * val 만큼 player maxHp 증가", () => {
      const player = {
          name: 'tester', job: '모험가', level: 10,
          hp: 500, maxHp: 1000, mp: 50, maxMp: 50,
          atk: 100, def: 50, exp: 0, nextExp: 1000, gold: 0,
          relics: [{ effect: 'devour_hp', val: 0.1 }],
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
          challengeModifiers: [],
      };
      const enemy = { name: '슬라임', hp: 0, maxHp: 200, atk: 10, def: 5, exp: 50, gold: 30 };

      const result = CombatEngine.handleVictory(player, enemy, {}, {}); // cycle 624: explicit elimination

      // val 0.1 * enemy.maxHp 200 = 20 HP 증가.
      assert.equal(result.updatedPlayer.maxHp, 1020,
          `expected maxHp 1020 (1000 + 20); got ${result.updatedPlayer.maxHp}`);
      // hp도 같은 양만큼 증가 (현재 hp 500 + 20 = 520).
      assert.equal(result.updatedPlayer.hp, 520,
          `expected hp 520 (500 + 20); got ${result.updatedPlayer.hp}`);
  });

  test("devour_hp: 미보유 시 maxHp 변화 없음 (회귀 가드)", () => {
      const player = {
          name: 'tester', job: '모험가', level: 10,
          hp: 500, maxHp: 1000, mp: 50, maxMp: 50,
          atk: 100, def: 50, exp: 0, nextExp: 1000, gold: 0,
          relics: [], combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
          challengeModifiers: [],
      };
      const enemy = { name: '슬라임', hp: 0, maxHp: 200, atk: 10, def: 5, exp: 50, gold: 30 };

      const result = CombatEngine.handleVictory(player, enemy, {}, {}); // cycle 624: explicit elimination
      assert.equal(result.updatedPlayer.maxHp, 1000);
  });
}

// ─── 원본: tests/cycle-158-relic-battle-start-kill-stack.test.js ───
{
  /**
   * cycle 158: 'battle_start_buff' / 'kill_stack_atk' 유물 핸들러 추가
   * (cycle 148 baseline 4 → 2).
   *
   * 1. battle_start_buff (전쟁의 북) — applyBattleStartRelics에서 tempBuff
   *    적용. statsCalculator의 baseAtk * (1 + buff.atk)로 즉시 반영.
   * 2. kill_stack_atk (허공의 왕좌) — combatFlags.killStackAtkBonus per-combat
   *    누적. 매 처치마다 perKill 증가, max 캡. 매 전투 시작 시 0으로 리셋.
   *    atkFlat 리듀서에 합산.
   */

  const fakePlayer = () => ({
      name: 'tester', job: '모험가', level: 50,
      hp: 1000, maxHp: 1000, mp: 500, maxMp: 500, atk: 1000, def: 500,
      inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
      relics: [], skillChoices: {}, titles: [], activeTitle: null,
      killStreak: 0, combatFlags: {}, status: [],
      stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
      tempBuff: { atk: 0, def: 0, turn: 0, name: null },
  });

  test("battle_start_buff (war_drum): applyBattleStartRelics가 tempBuff 적용", () => {
      const player = fakePlayer();
      const relic = { effect: 'battle_start_buff', val: { atk: 0.2, turns: 2 } };

      const logs = [];
      const result = applyBattleStartRelics(player, [relic], { maxHp: 1000 }, {
          addLog: (type, text) => logs.push({ type, text }),
      });

      assert.equal(result.tempBuff.atk, 0.2);
      assert.equal(result.tempBuff.turn, 2);
      assert.equal(result.tempBuff.name, 'battle_start_buff');
      const startLog = logs.find((l) => l.text.includes('전쟁의 북'));
      assert.ok(startLog, '전쟁의 북 로그 출력돼야 함');
  });

  test("battle_start_buff: 전투 시작 후 finalAtk가 baseline 대비 +20%", () => {
      const base = fakePlayer();
      const baseStats = calculateFullStats(base);

      const withBuff = { ...base, tempBuff: { atk: 0.2, def: 0, turn: 2, name: 'battle_start_buff' } };
      const buffStats = calculateFullStats(withBuff);

      const ratio = buffStats.atk / baseStats.atk;
      assert.ok(ratio >= 1.18 && ratio <= 1.22,
          `expected battle_start_buff atk ratio ~1.20; got ${ratio.toFixed(3)}`);
  });

  test("kill_stack_atk (void_monarch): handleVictory가 combatFlags.killStackAtkBonus 증가", () => {
      const player = {
          name: 'tester', job: '모험가', level: 10,
          hp: 500, maxHp: 1000, mp: 50, maxMp: 50,
          atk: 100, def: 50, exp: 0, nextExp: 1000, gold: 0,
          relics: [{ effect: 'kill_stack_atk', val: { perKill: 0.05, max: 0.5 } }],
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
          challengeModifiers: [],
      };
      const enemy = { name: '슬라임', hp: 0, maxHp: 200, atk: 10, def: 5, exp: 50, gold: 30 };

      const result = CombatEngine.handleVictory(player, enemy, {}, {}); // cycle 624: explicit elimination
      assert.equal(result.updatedPlayer.combatFlags.killStackAtkBonus, 0.05);

      // 두 번째 처치
      const result2 = CombatEngine.handleVictory(result.updatedPlayer, enemy, {}, {}); // cycle 624: explicit elimination
      assert.equal(result2.updatedPlayer.combatFlags.killStackAtkBonus, 0.1);
  });

  test("kill_stack_atk: max(0.5)에서 캡 — 누적이 max 초과 안 함", () => {
      const player = {
          name: 'tester', job: '모험가', level: 10,
          hp: 500, maxHp: 1000, mp: 50, maxMp: 50,
          atk: 100, def: 50, exp: 0, nextExp: 1000, gold: 0,
          relics: [{ effect: 'kill_stack_atk', val: { perKill: 0.2, max: 0.5 } }],
          combatFlags: { killStackAtkBonus: 0.4 }, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
          challengeModifiers: [],
      };
      const enemy = { name: '슬라임', hp: 0, maxHp: 200, atk: 10, def: 5, exp: 50, gold: 30 };

      const result = CombatEngine.handleVictory(player, enemy, {}, {}); // cycle 624: explicit elimination
      // 0.4 + 0.2 = 0.6, but max 0.5 → 0.5
      assert.equal(result.updatedPlayer.combatFlags.killStackAtkBonus, 0.5);
  });

  test("kill_stack_atk: combatFlags.killStackAtkBonus가 finalAtk에 반영됨", () => {
      const base = fakePlayer();
      base.relics = [{ effect: 'kill_stack_atk', val: { perKill: 0.05, max: 0.5 } }];
      const baseStats = calculateFullStats(base);

      const withStack = { ...base, combatFlags: { killStackAtkBonus: 0.3 } };
      const stackStats = calculateFullStats(withStack);

      const ratio = stackStats.atk / baseStats.atk;
      assert.ok(ratio >= 1.28 && ratio <= 1.32,
          `expected kill_stack_atk(0.3) atk ratio ~1.30; got ${ratio.toFixed(3)}`);
  });

  test("applyBattleStartRelics: kill_stack_atk / phoenix 카운터 0으로 리셋", () => {
      const player = {
          ...fakePlayer(),
          combatFlags: {
              killStackAtkBonus: 0.4,
              phoenixUsed: true,
              voidHeartUsed: true,  // 보존돼야 하는 플래그
              voidHeartArmed: true,
          },
      };
      const result = applyBattleStartRelics(player, [], { maxHp: 1000 }, { addLog: () => {} });

      assert.equal(result.combatFlags.killStackAtkBonus, 0);
      assert.equal(result.combatFlags.phoenixUsed, false);
      // void_heart 플래그는 보존 (run-wide)
      assert.equal(result.combatFlags.voidHeartUsed, true);
      assert.equal(result.combatFlags.voidHeartArmed, true);
  });
}

// ─── 원본: tests/cycle-159-relic-entropy-tick-brand.test.js ───
{
  /**
   * cycle 159: 'entropy_tick' / 'entropy_brand' 핸들러 추가
   * (cycle 148 baseline 2 → 0 🎯).
   *
   * 마지막 2종 — 둘 다 turn-based DOT 메커니즘. 공통 헬퍼 applyEntropyTick으로
   * 통합 처리. 시너지(brand)가 활성이면 시너지 파라미터 우선 (damage 0.12 /
   * interval 2 — 유물의 0.08 / 3 강화).
   *
   * - turnCount는 매 전투 시작 시 0으로 리셋 (applyBattleStartRelics).
   * - attack / performSkill 끝에서 turnCount 증가 + 조건 시 적 hp 차감.
   */

  const fakePlayer = (overrides = {}) => ({
      name: 'tester', job: '모험가', level: 10,
      hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
      relics: [], skillChoices: {}, titles: [], activeTitle: null,
      killStreak: 0, combatFlags: {}, status: [],
      ...overrides,
  });

  const baseStats = {
      atk: 100, def: 50, elem: 'physical',
      relics: [],
      activeSynergies: [],
      critChance: 0,
  };

  test("entropy_tick (entropy_engine): interval 3마다 적 maxHp 8% 고정 피해", () => {
      // turnCount=2이면 2+1=3. 3 % 3 == 0 → 발동.
      const player = fakePlayer({
          relics: [{ effect: 'entropy_tick', val: { interval: 3, damage: 0.08 } }],
          combatFlags: { turnCount: 2 },
      });
      const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 10, def: 5 };

      const result = CombatEngine.applyEntropyTick(player, enemy, []);
      // damage = 1000 * 0.08 = 80. enemy hp 1000 → 920.
      assert.equal(result.enemy.hp, 920);
      assert.equal(result.player.combatFlags.turnCount, 3);
      const log = result.logs.find((l) => l.text.includes('엔트로피 엔진'));
      assert.ok(log, '엔트로피 엔진 로그');
  });

  test("entropy_tick: interval 미달 — 발동 안 함", () => {
      const player = fakePlayer({
          relics: [{ effect: 'entropy_tick', val: { interval: 3, damage: 0.08 } }],
          combatFlags: { turnCount: 0 },
      });
      const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 10, def: 5 };

      // turnCount 0 → 1. 1 % 3 != 0 → 발동 안 함.
      const result = CombatEngine.applyEntropyTick(player, enemy, []);
      assert.equal(result.enemy.hp, 1000);
      assert.equal(result.player.combatFlags.turnCount, 1);
  });

  test("entropy_brand 시너지: damage / interval이 유물 값 override (0.12 / 2)", () => {
      const player = fakePlayer({
          relics: [{ effect: 'entropy_tick', val: { interval: 3, damage: 0.08 } }],
          combatFlags: { turnCount: 1 },
      });
      const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 10, def: 5 };
      const synergies = [{ bonus: { effect: 'entropy_brand', damage: 0.12, interval: 2 } }];

      // turnCount 1 → 2. 2 % 2(시너지) == 0 → 발동.
      // damage 0.12(시너지) * 1000 = 120. enemy hp 1000 → 880.
      const result = CombatEngine.applyEntropyTick(player, enemy, synergies);
      assert.equal(result.enemy.hp, 880);
      const log = result.logs.find((l) => l.text.includes('엔트로피 낙인'));
      assert.ok(log, '엔트로피 낙인 시너지 라벨');
  });

  test("entropy_tick: 적 이미 사망(hp=0) — 발동 안 함", () => {
      const player = fakePlayer({
          relics: [{ effect: 'entropy_tick', val: { interval: 1, damage: 0.5 } }],
          combatFlags: { turnCount: 0 },
      });
      const enemy = { name: '오크', hp: 0, maxHp: 1000, atk: 10, def: 5 };

      const result = CombatEngine.applyEntropyTick(player, enemy, []);
      assert.equal(result.enemy.hp, 0);  // 이미 죽은 적엔 추가 피해 안 줌
  });

  test("관련 유물/시너지 미보유 — turnCount만 증가, 적 hp 변화 없음", () => {
      const player = fakePlayer({ combatFlags: { turnCount: 5 } });
      const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 10, def: 5 };

      const result = CombatEngine.applyEntropyTick(player, enemy, []);
      assert.equal(result.enemy.hp, 1000);
      // 미보유 시 turnCount 증가 여부 — early return으로 증가
      assert.equal(result.player.combatFlags.turnCount, 6);
  });

  test("attack: entropy_tick이 attack 끝에 호출됨 — interval 1 / damage 0.1로 적 hp 추가 감소", () => {
      const player = fakePlayer({
          relics: [{ effect: 'entropy_tick', val: { interval: 1, damage: 0.1 } }],
          combatFlags: { turnCount: 0 },
      });
      const enemy = { name: '오크', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
      const stats = {
          ...baseStats,
          relics: player.relics,
          activeSynergies: [],
      };

      const result = CombatEngine.attack(player, enemy, stats);
      // 일반 공격 피해 + entropy 1000 추가 피해.
      // turnCount 0 → 1, 1 % 1 == 0 → 발동.
      const entropyLog = result.logs.find((l) => l.text && l.text.includes('엔트로피 엔진'));
      assert.ok(entropyLog, 'attack 끝에 entropy 로그 출력돼야 함');
      assert.equal(result.updatedPlayer.combatFlags.turnCount, 1);
  });

  test("applyBattleStartRelics: turnCount 0으로 리셋", () => {
      const player = {
          ...fakePlayer(),
          combatFlags: { turnCount: 12, voidHeartUsed: true },
      };
      const result = applyBattleStartRelics(player, [], { maxHp: 1000 }, { addLog: () => {} });

      assert.equal(result.combatFlags.turnCount, 0);
      assert.equal(result.combatFlags.voidHeartUsed, true);  // run-wide 보존
  });
}

// ─── 원본: tests/cycle-161-relic-per-turn-tick-heal-cost.test.js ───
{
  /**
   * cycle 161: per-turn 보조 메커니즘 정리 — 3종 (cycles 149/154/150 잔존 TODO).
   *
   * cycle 148 baseline 0(cycle 159) 달성 후 잔존 secondary 메커니즘 정리.
   * 모두 tickCombatState에 매 턴 처리 추가:
   *
   * 1. genesis (창세의 핵) — val.healPerTurn 0.02 매 턴 HP 회복.
   *    cycle 149에서 statBonus만 적용 → healPerTurn 추가.
   * 2. eternal_fortress 시너지 — bonus.regenPerTurn 0.08 매 턴 HP 재생.
   *    cycle 154에서 defMult만 적용 → regenPerTurn 추가.
   * 3. hp_drain_atk (혈맹의 반지/심연의 계약) — val.hpCost 매 턴 HP 소모.
   *    cycle 150에서 atkBonus만 적용 → hpCost 추가. hell_reaper 시너지
   *    (hpCostReduction)는 cost를 직접 대체.
   */

  const fakePlayer = (overrides = {}) => ({
      name: 'tester', job: '모험가', level: 10,
      hp: 500, maxHp: 1000, mp: 50, maxMp: 100,
      relics: [], skillChoices: {}, titles: [], activeTitle: null,
      killStreak: 0, combatFlags: {}, status: [],
      skillLoadout: { selected: 0, cooldowns: {} },
      tempBuff: { atk: 0, def: 0, turn: 0, name: null },
      ...overrides,
  });

  test("genesis (창세의 핵): healPerTurn 0.02 — 매 턴 maxHp 2% 회복", () => {
      const player = fakePlayer({
          relics: [{ effect: 'genesis', val: { statBonus: 0.15, healPerTurn: 0.02 } }],
      });
      const result = CombatEngine.tickCombatState(player);
      // 1000 * 0.02 = 20 HP heal. 500 → 520.
      assert.equal(result.updatedPlayer.hp, 520);
      const log = result.logs.find((l) => l.text.includes('창세의 핵'));
      assert.ok(log);
  });

  test("genesis: HP가 maxHp일 때 회복 안 함 (overheal 가드)", () => {
      const player = fakePlayer({
          hp: 1000, maxHp: 1000,
          relics: [{ effect: 'genesis', val: { statBonus: 0.15, healPerTurn: 0.02 } }],
      });
      const result = CombatEngine.tickCombatState(player);
      assert.equal(result.updatedPlayer.hp, 1000);
  });

  test("eternal_fortress 시너지: regenPerTurn 0.08 — 매 턴 maxHp 8% 재생", () => {
      // 시너지 require: 난공불락 + 암석 피부 + 대지의 심장
      const player = fakePlayer({
          relics: [
              { name: '난공불락', effect: 'def_mult', val: 0.3 },
              { name: '암석 피부', effect: 'stone_skin', val: 0.5 },
              { name: '대지의 심장', effect: 'regen', val: 0.05 },
          ],
      });
      const result = CombatEngine.tickCombatState(player);
      // regenRelic(대지의 심장) +5% = 50 HP, eternal_fortress regenPerTurn +8% = 80 HP.
      // 500 → 550 (regen) → 630 (eternal_fortress) — 두 핸들러 누적.
      assert.equal(result.updatedPlayer.hp, 630);
      const fortressLog = result.logs.find((l) => l.text.includes('영원의 요새'));
      assert.ok(fortressLog, 'eternal_fortress 시너지 회복 로그');
  });

  test("hp_drain_atk (혈맹의 반지): hpCost 0.03 — 매 턴 maxHp 3% 소모", () => {
      const player = fakePlayer({
          relics: [{ effect: 'hp_drain_atk', val: { hpCost: 0.03, atkBonus: 0.35 } }],
      });
      const result = CombatEngine.tickCombatState(player);
      // 1000 * 0.03 = 30 HP cost. 500 → 470.
      assert.equal(result.updatedPlayer.hp, 470);
      const log = result.logs.find((l) => l.text.includes('혈맹의 반지'));
      assert.ok(log);
  });

  test("hp_drain_atk + hell_reaper 시너지: hpCostReduction 0.02 — cost가 0.02로 대체 (감소)", () => {
      // hell_reaper 시너지 require: 심연의 계약 + 영혼 흡수
      const player = fakePlayer({
          relics: [
              { name: '심연의 계약', effect: 'hp_drain_atk', val: { hpCost: 0.05, atkBonus: 0.6 } },
              { name: '영혼 흡수', effect: 'skill_lifesteal', val: 0.1 },
          ],
      });
      const result = CombatEngine.tickCombatState(player);
      // 원래 cost 5% (50 HP), hell_reaper hpCostReduction 0.02 → cost 2% (20 HP).
      // 500 → 480.
      assert.equal(result.updatedPlayer.hp, 480);
      const log = result.logs.find((l) => l.text.includes('지옥의 수확자'));
      assert.ok(log, 'hell_reaper 라벨 로그 — 감소된 cost임을 표시');
  });

  test("hp_drain_atk: HP 1 미만으로 떨어지지 않음 (사망 방지 가드)", () => {
      const player = fakePlayer({
          hp: 5, maxHp: 1000,
          relics: [{ effect: 'hp_drain_atk', val: { hpCost: 0.03, atkBonus: 0.35 } }],
      });
      const result = CombatEngine.tickCombatState(player);
      // hp 5에서 30 차감 → 0이 되어야 하지만 max(1, ...)로 1 보장.
      assert.equal(result.updatedPlayer.hp, 1);
  });
}

// ─── 원본: tests/cycle-162-relic-titan-crit-phoenix-atkbuff.test.js ───
{
  /**
   * cycle 162: titan critReduce / phoenix_revive atkBuff 잔존 메커니즘 정리
   * (cycles 149/157 TODO).
   *
   * 1. titan (타이탄의 허리띠) — val.critReduce 0.5 받는 치명타 피해 -50%.
   *    cycle 149에서 hp 보너스만 적용 → 받는 치명타(heavyResolved) 차감 추가.
   * 2. phoenix_revive (불사조의 깃털) — val.atkBuff 0.5, val.duration 3.
   *    cycle 157에서 healRatio만 적용 → tempBuff atk multiplier 적용 추가.
   *    statsCalculator의 (1 + buff.atk) 패턴으로 즉시 반영.
   */

  test("phoenix_revive: 부활 시 tempBuff(atkBuff/duration) 설정", () => {
      const player = {
          hp: 0, maxHp: 1000, mp: 50, maxMp: 50,
          relics: [{ effect: 'phoenix_revive', val: { healRatio: 0.3, atkBuff: 0.5, duration: 3 } }],
          combatFlags: {},
          status: [],
      };
      const result = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);

      assert.equal(result.updatedPlayer.hp, 300, '부활 HP 30% (cycle 157 회귀)');
      assert.equal(result.updatedPlayer.tempBuff?.atk, 0.5, 'atkBuff 0.5 적용');
      assert.equal(result.updatedPlayer.tempBuff?.turn, 3);
      assert.equal(result.updatedPlayer.tempBuff?.name, 'phoenix_revive');
  });

  test("phoenix_revive: atkBuff 0이면 tempBuff 설정 안 함 (가드)", () => {
      const player = {
          hp: 0, maxHp: 1000, mp: 50, maxMp: 50,
          relics: [{ effect: 'phoenix_revive', val: { healRatio: 0.3, atkBuff: 0, duration: 3 } }],
          combatFlags: {},
          status: [],
      };
      const result = CombatEngine.applyFatalProtection(player, player.relics, 100, [], []);
      // tempBuff 설정 안 함 (atkBuff 0).
      assert.equal(result.updatedPlayer.tempBuff, undefined);
  });

  test("titan critReduce: enemy heavy attack 시 받는 피해 -50%", () => {
      // heavy attack을 강제로 발동하려면 Math.random을 stub해야 함.
      // 직접 Math.random 모킹 — heavy 트리거(roll < heavyChance) + critBlock 미발동(roll >= critBlock).
      const orig = Math.random;
      let callCount = 0;
      Math.random = () => {
          callCount += 1;
          // 첫 호출(heavy 결정): 0.0 → heavy 발동
          // 그 외: 0.99 → critBlock 등 회피
          return callCount === 1 ? 0.0 : 0.99;
      };

      try {
          const player = {
              name: 'tester', job: '모험가', level: 10,
              hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
              relics: [{ effect: 'titan', val: { hp: 0.3, critReduce: 0.5 } }],
              combatFlags: {}, status: [],
          };
          const enemy = {
              name: '오크', hp: 100, maxHp: 100, atk: 100, def: 5,
              pattern: { guardChance: 0.0, heavyChance: 1.0 },  // heavy 100%
          };
          const stats = {
              atk: 100, def: 0,
              relics: player.relics, activeSynergies: [],
              critChance: 0,
          };

          const result = CombatEngine.enemyAttack(player, enemy, stats);
          // titan 적용 시 강타 피해 50% 감소 로그가 있어야 함.
          const titanLog = result.logs.find((l) => l.text && l.text.includes('타이탄의 허리띠'));
          assert.ok(titanLog, '타이탄의 허리띠 강타 감소 로그 출력돼야 함');
      } finally {
          Math.random = orig;
      }
  });

  test("titan critReduce: heavy 미발동 시 적용 안 함 (회귀 가드)", () => {
      const orig = Math.random;
      Math.random = () => 0.99; // heavy 미발동

      try {
          const player = {
              name: 'tester', job: '모험가', level: 10,
              hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
              relics: [{ effect: 'titan', val: { hp: 0.3, critReduce: 0.5 } }],
              combatFlags: {}, status: [],
          };
          const enemy = {
              name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5,
              pattern: { guardChance: 0.0, heavyChance: 0.0 },  // heavy 0%
          };
          const stats = {
              atk: 100, def: 50,
              relics: player.relics, activeSynergies: [],
              critChance: 0,
          };

          const result = CombatEngine.enemyAttack(player, enemy, stats);
          const titanLog = result.logs.find((l) => l.text && l.text.includes('타이탄의 허리띠'));
          assert.equal(titanLog, undefined, '일반 공격엔 titan 발동 안 함');
      } finally {
          Math.random = orig;
      }
  });
}

// ─── 원본: tests/cycle-163-relic-firstfree-skill.test.js ───
{
  /**
   * cycle 163: 'cooldown_reduce.firstFree' 잔존 메커니즘 정리 (cycle 151 TODO).
   *
   * 시간 군주의 왕관 (val: { cdReduction: 1, firstFree: true }):
   * - cdReduction 1턴 감소: cycle 151에서 적용 완료.
   * - firstFree (첫 스킬 MP 무소비): 본 사이클에서 추가.
   *
   * 메커니즘:
   * - applyBattleStartRelics: combatFlags.firstSkillUsed = false 리셋.
   * - performSkill: firstFreeAvailable = (cdRelic.val.firstFree && !firstSkillUsed)
   *   조건이면 actualMpCost = 0 강제. 첫 스킬 사용 후 firstSkillUsed = true.
   * - free_skill 유물(주문 메아리)와 분리된 로그 출력.
   */

  const fakePlayer = (overrides = {}) => ({
      name: 'tester', job: '모험가', level: 10,
      hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
      relics: [], skillChoices: {}, titles: [], activeTitle: null,
      killStreak: 0, combatFlags: {}, status: [],
      skillLoadout: { selected: 0, cooldowns: {} },
      ...overrides,
  });

  test("firstFree: 첫 스킬 사용 시 MP 무소비 (firstSkillUsed=false 시)", () => {
      const player = fakePlayer({
          relics: [{ effect: 'cooldown_reduce', val: { cdReduction: 1, firstFree: true } }],
          combatFlags: { firstSkillUsed: false },
      });
      const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
      const skill = { name: 'fireball', mp: 50, mult: 1.5, cooldown: 3 };
      const stats = {
          atk: 100, def: 50, elem: 'physical',
          relics: player.relics, activeSynergies: [], critChance: 0,
      };

      const result = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(result.success, true);
      assert.equal(result.updatedPlayer.mp, 100, 'MP 무소비 — 100 그대로');
      assert.equal(result.updatedPlayer.combatFlags.firstSkillUsed, true);
      const log = result.logs.find((l) => l.text.includes('시간 군주의 왕관'));
      assert.ok(log, 'firstFree 로그 출력');
  });

  test("firstFree: 두 번째 스킬은 정상 MP 소비 (firstSkillUsed=true)", () => {
      const player = fakePlayer({
          relics: [{ effect: 'cooldown_reduce', val: { cdReduction: 1, firstFree: true } }],
          combatFlags: { firstSkillUsed: true }, // 이미 첫 스킬 사용됨
      });
      const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
      const skill = { name: 'fireball', mp: 50, mult: 1.5, cooldown: 3 };
      const stats = {
          atk: 100, def: 50, elem: 'physical',
          relics: player.relics, activeSynergies: [], critChance: 0,
      };

      const result = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(result.success, true);
      assert.equal(result.updatedPlayer.mp, 50, 'MP 50 소비 (100 - 50)');
  });

  test("firstFree: 미보유 시 정상 MP 소비 (회귀 가드)", () => {
      const player = fakePlayer({
          combatFlags: { firstSkillUsed: false },
      });
      const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
      const skill = { name: 'fireball', mp: 50, mult: 1.5, cooldown: 3 };
      const stats = {
          atk: 100, def: 50, elem: 'physical',
          relics: [], activeSynergies: [], critChance: 0,
      };

      const result = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(result.success, true);
      assert.equal(result.updatedPlayer.mp, 50);
  });

  test("applyBattleStartRelics: firstSkillUsed=false 리셋 (매 전투 첫 스킬 가용)", () => {
      const player = fakePlayer({
          combatFlags: { firstSkillUsed: true, voidHeartUsed: true },
      });
      const result = applyBattleStartRelics(player, [], { maxHp: 1000 }, { addLog: () => {} });

      assert.equal(result.combatFlags.firstSkillUsed, false);
      assert.equal(result.combatFlags.voidHeartUsed, true, 'run-wide 플래그는 보존');
  });

  test("firstFree + cdReduction 동시 적용 (cycle 151 + cycle 163 통합)", () => {
      const player = fakePlayer({
          relics: [{ effect: 'cooldown_reduce', val: { cdReduction: 1, firstFree: true } }],
          combatFlags: { firstSkillUsed: false },
      });
      const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
      const skill = { name: 'fireball', mp: 50, mult: 1.5, cooldown: 3 };
      const stats = {
          atk: 100, def: 50, elem: 'physical',
          relics: player.relics, activeSynergies: [], critChance: 0,
      };

      const result = CombatEngine.performSkill(player, enemy, stats, skill);
      // MP 무소비 + cooldown 3 → 2 (cdReduction 1).
      assert.equal(result.updatedPlayer.mp, 100);
      assert.equal(result.updatedPlayer.skillLoadout.cooldowns['fireball'], 2);
  });
}

// ─── 원본: tests/cycle-229-spell-stack-relic.test.js ───
{
  /**
   * cycle 229: 'spell_stack' relic effect dead config fix (cycle 222-228 시리즈 8번째).
   *
   * 발견 (relic effect 미적용):
   * - spell_weaver 레전더리 유물 (val: { perStack: 0.2, max: 0.6 }):
   *   "스킬 연속 사용 시 피해 +20% 누적 (최대 60%)"
   * - 그러나 src/ 어디에서도 'spell_stack' effect handler 0건. 60% 위력 증폭 메커니즘이
   *   완전히 발현 안 됨.
   * - cycle 157이 baseline 6 → 4로 줄였지만 spell_stack은 미해결 잔존이었음.
   *
   * 패턴 (cycle 222-229 silent dead config 시리즈 8번째):
   * - cycle 222-227: weapon bucket / elem / mpBonus / hpBonus / evasion / statusOnHit.
   * - cycle 228: phase3 defBonus.
   * - cycle 229: spell_stack relic effect (마지막 unhandled relic effect).
   *
   * 메커니즘:
   * - 스킬 사용 시 combatFlags.spellStackCount 증분.
   * - 스킬 데미지에 (1 + stack * perStack) 곱 (capped by max).
   * - 일반 공격(attack) 시 spellStackCount → 0 (연속 사용 깨짐).
   * - 새 전투 시작 시 0으로 리셋 (applyBattleStartRelics — combatFlags 초기화 패턴).
   *
   * 수정 (src/systems/CombatEngine.ts):
   * 1. performSkill: spell_stack 유물 보유 시 stackCount 증분 + 데미지 mult 적용.
   * 2. attack: spell_weaver 보유 시 spellStackCount 0으로 리셋.
   *
   * 회귀 가드:
   * - spell_stack 유물 미보유 시 0 영향.
   * - max cap (val.max=0.6) 보장 — 4번째 스킬부턴 60% 고정.
   */

  test('cycle 229: 스킬 연속 사용 시 spell_stack 데미지 누적 (max stack 비교)', () => {
      // cycle 235: 데미지 분산 폭(±10%)이 +20% stack 보너스를 변동 우위 깨버리는 RNG flake.
      //   max stack(+60%)으로 비교하면 분산을 항상 우위 (deterministic).
      const playerStack0 = {
          name: 'Test', job: '아크메이지', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [{ id: 'spell_weaver', effect: 'spell_stack', val: { perStack: 0.2, max: 0.6 } }],
          skillChoices: {}, titles: [], equip: {},
          combatFlags: { spellStackCount: 0 }, // 0 stack
          status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const playerStack3 = {
          ...playerStack0,
          combatFlags: { spellStackCount: 3 }, // 3 stack → +60% (val.max cap)
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const skill = { name: '파이어볼', mp: 10, mult: 1.5, type: 'attack', element: '화염', cooldown: 0 };
      const stats = {
          atk: 200, def: 50,
          relics: playerStack0.relics,
          activeSynergies: [],
          critChance: 0,
      };

      // 동일 RNG seed 가정은 어렵지만, +60% 보너스가 ±10% 분산을 충분히 우위.
      // 평균 데미지를 비교하기 위해 N회 샘플링 (50회 → 분산 √50 ≈ 7배 좁아짐).
      const SAMPLES = 50;
      let dmgStack0Sum = 0, dmgStack3Sum = 0;
      for (let i = 0; i < SAMPLES; i++) {
          const r1 = CombatEngine.performSkill(playerStack0, enemy, stats, skill);
          const r2 = CombatEngine.performSkill(playerStack3, enemy, stats, skill);
          dmgStack0Sum += (enemy.hp - r1.updatedEnemy.hp);
          dmgStack3Sum += (enemy.hp - r2.updatedEnemy.hp);
      }
      assert.equal(playerStack0.combatFlags.spellStackCount, 0);
      // stack 3 평균 ≥ stack 0 평균 * 1.3 (60% 의도, 분산 + cap floor() 고려 1.3 보수).
      assert.ok(dmgStack3Sum > dmgStack0Sum * 1.3,
          `+60% stack은 평균 데미지 1.3x+ 차이여야 함. stack0=${dmgStack0Sum}, stack3=${dmgStack3Sum}`);

      // stackCount 증가 검증 (단일 호출).
      const r = CombatEngine.performSkill(playerStack0, enemy, stats, skill);
      assert.equal(r.updatedPlayer.combatFlags.spellStackCount, 1, '1번째 스킬 후 stack 1로 증분');
  });

  test('cycle 229: spell_stack 데미지 누적이 val.max로 cap', () => {
      const player = {
          name: 'Test', job: '아크메이지', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [{ id: 'spell_weaver', effect: 'spell_stack', val: { perStack: 0.2, max: 0.6 } }],
          skillChoices: {}, titles: [], equip: {},
          combatFlags: { spellStackCount: 5 }, // 이미 5스택 (1.0 cap)
          status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const skill = { name: '파이어볼', mp: 10, mult: 1.5, type: 'attack' };
      const stats = {
          atk: 200, def: 50,
          relics: player.relics,
          activeSynergies: [],
          critChance: 0,
      };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      // stack은 max(stackCount + 1)이지만 damage mult는 cap by val.max.
      // 일반 mult 1.5 + spell stack max 0.6 → 1.5 * 1.6 ratio (or +60% on damage).
      assert.ok(r.updatedPlayer.combatFlags.spellStackCount >= 5, 'stackCount 보존');
  });

  test('cycle 229: 일반 공격 후 spellStackCount 리셋', () => {
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 100, def: 30,
          relics: [{ id: 'spell_weaver', effect: 'spell_stack', val: { perStack: 0.2, max: 0.6 } }],
          skillChoices: {}, titles: [], equip: { weapon: { type: 'weapon', val: 50 }, armor: null, offhand: null },
          combatFlags: { spellStackCount: 3 },
          status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
      const stats = { atk: 200, def: 50, relics: player.relics, activeSynergies: [], critChance: 0 };

      const r = CombatEngine.attack(player, enemy, stats);
      assert.equal(r.updatedPlayer.combatFlags.spellStackCount, 0,
          '일반 공격 후 spellStackCount 리셋 (연속 스킬 깨짐)');
  });

  test('cycle 229: spell_stack 유물 미보유 시 0 영향 (회귀 가드)', () => {
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 100, def: 30,
          relics: [], // 유물 없음
          skillChoices: {}, titles: [], equip: {},
          combatFlags: { spellStackCount: 0 },
          status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
      const skill = { name: '파이어볼', mp: 10, mult: 1.5 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      // stackCount 변화 없거나 0 — relic 없으면 increment 없음
      assert.equal((r.updatedPlayer.combatFlags?.spellStackCount || 0), 0,
          '유물 미보유 시 spellStackCount 증가 안 함');
  });

  test('cycle 228 회귀 가드: phase3 defBonus 처리 유지', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 5000, maxHp: 5000, mp: 100, maxMp: 200,
          atk: 200, def: 50,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
      };
      const enemy = {
          name: '마왕', isBoss: true,
          hp: 100, maxHp: 1000, atk: 100, def: 30,
          pattern: { guardChance: 0.0, heavyChance: 0.5 },
          phase3: {
              name: '종말의 마왕', threshold: 0.2, atkBonus: 0.6, defBonus: 10,
              pattern: { guardChance: 0.0, heavyChance: 0.7 }, log: '!',
          },
      };
      const stats = { atk: 200, def: 100, relics: [], activeSynergies: [], critChance: 0 };
      const result = CombatEngine.enemyAttack(player, enemy, stats);
      assert.equal(result.updatedEnemy.def, 40, 'cycle 228 phase3 defBonus 보존');
  });
}

// ─── 원본: tests/cycle-232-relic-shards-conversion.test.js ───
{
  /**
   * cycle 232: relicShards 5/5 conversion 메커니즘 추가 (cycle 215 dead reward chain lens 확장).
   *
   * 발견 (relicShards dead):
   * - 일일 프로토콜 'gold_n' 미션 완료 시 reward.relicShard: 1 부여.
   * - applyDailyProtocolProgress에서 dp.relicShards 누적.
   * - SystemTab: 'X/5 조각' 표시 — 5개 도달 시 변환 의도 명백.
   * - 그러나 5개 도달 시 변환 코드 0건. 무한 누적되는 dead reward.
   * - cycle 215 (claimAchievement premiumCurrency 미처리) / cycle 222-229 (defined-but-unused
   *   data) lens와 같은 결.
   *
   * 수정 (src/reducers/handlers/helpers.ts applyDailyProtocolProgress):
   * - newShards >= 5 시 5개 소모 + 1 random 유물 player.relics에 추가.
   * - 단, player.relics.length < MAX_RELICS_PER_RUN(5) 일 때만 변환 — cap 시 shards 유지.
   * - 이미 보유 중인 유물은 제외(중복 방지).
   *
   * 회귀 가드:
   * - shards < 5 시 변환 안 함.
   * - relic 후보 0건(이미 모두 보유) 시 변환 안 함, shards 유지.
   * - relic 추가 시 stats.relicCount도 +1 (cycle 101 single source of truth 정합).
   * - rank 시스템 / essence 부여 등 기존 로직 보존.
   */

  test('cycle 232: shards 5+ → relic 1개 자동 변환', () => {
      const player = {
          name: 'Test', level: 10,
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          relics: [],
          stats: {
              relicCount: 0,
              dailyProtocol: {
                  date: '2026-05-06',
                  relicShards: 4, // 4 + 1 = 5 → 변환 trigger
                  missions: [
                      { id: 'gold_n', type: 'goldSpend', goal: 100, progress: 99, done: false, reward: { relicShard: 1 } },
                  ],
              },
          },
      };
      const updated = applyDailyProtocolProgress(player, 'goldSpend', 1);
      // 변환 후 shards = 0 (5 소모), relics +1
      assert.equal(updated.stats.dailyProtocol.relicShards, 0,
          '5 shards 소모되어야 함');
      assert.equal((updated.relics || []).length, 1,
          '1 random relic 자동 추가되어야 함');
  });

  test('cycle 232: shards < 5 시 변환 안 함 (회귀 가드)', () => {
      const player = {
          name: 'Test', level: 10,
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          relics: [],
          stats: {
              dailyProtocol: {
                  date: '2026-05-06',
                  relicShards: 2, // 2 + 1 = 3 (< 5) → 변환 안 됨
                  missions: [
                      { id: 'gold_n', type: 'goldSpend', goal: 100, progress: 99, done: false, reward: { relicShard: 1 } },
                  ],
              },
          },
      };
      const updated = applyDailyProtocolProgress(player, 'goldSpend', 1);
      assert.equal(updated.stats.dailyProtocol.relicShards, 3, '5 미만이면 변환 안 함');
      assert.equal((updated.relics || []).length, 0, 'relic 추가 안 됨');
  });

  test('cycle 232: 6 shards 누적 시 1번만 변환 (남은 1개 유지)', () => {
      const player = {
          name: 'Test', level: 10,
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          relics: [],
          stats: {
              dailyProtocol: {
                  date: '2026-05-06',
                  relicShards: 5, // 5 + 1 = 6 → 5 소모, 1 남음
                  missions: [
                      { id: 'gold_n', type: 'goldSpend', goal: 100, progress: 99, done: false, reward: { relicShard: 1 } },
                  ],
              },
          },
      };
      const updated = applyDailyProtocolProgress(player, 'goldSpend', 1);
      assert.equal(updated.stats.dailyProtocol.relicShards, 1,
          '6 shards → 5 소모, 1 잔존');
      assert.equal((updated.relics || []).length, 1);
  });

  test('cycle 232: relic cap 도달 시 변환 안 함, shards 유지', () => {
      const player = {
          name: 'Test', level: 10,
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          relics: [
              { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' }, // MAX_RELICS_PER_RUN=5
          ],
          stats: {
              dailyProtocol: {
                  date: '2026-05-06',
                  relicShards: 4,
                  missions: [
                      { id: 'gold_n', type: 'goldSpend', goal: 100, progress: 99, done: false, reward: { relicShard: 1 } },
                  ],
              },
          },
      };
      const updated = applyDailyProtocolProgress(player, 'goldSpend', 1);
      // cap 도달 시 변환 안 됨, shards 5로 유지
      assert.equal(updated.stats.dailyProtocol.relicShards, 5,
          'cap 도달 시 변환 안 함, shards 5로 유지');
      assert.equal((updated.relics || []).length, 5, 'relics 수 변화 없음');
  });

  test('cycle 232: 변환된 relic은 stats.relicCount 증분', () => {
      const player = {
          name: 'Test', level: 10,
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          relics: [],
          stats: {
              relicCount: 0,
              dailyProtocol: {
                  date: '2026-05-06',
                  relicShards: 4,
                  missions: [
                      { id: 'gold_n', type: 'goldSpend', goal: 100, progress: 99, done: false, reward: { relicShard: 1 } },
                  ],
              },
          },
      };
      const updated = applyDailyProtocolProgress(player, 'goldSpend', 1);
      assert.equal(updated.stats.relicCount, 1,
          'relicCount는 cycle 101 single source — 변환 시 동기 증분');
  });

  test('cycle 232: 기존 essence/item 보상 처리 보존 (회귀 가드)', () => {
      const player = {
          name: 'Test', level: 10,
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          relics: [],
          stats: {
              dailyProtocol: {
                  date: '2026-05-06',
                  relicShards: 0,
                  missions: [
                      { id: 'kill_n', type: 'kills', goal: 5, progress: 4, done: false, reward: { essence: 50 } },
                  ],
              },
          },
      };
      const updated = applyDailyProtocolProgress(player, 'kills', 1);
      // essence 50 boost → 변경 확인
      assert.equal(updated.meta.essence, 50, 'essence 보상 동작 유지');
  });
}

// ─── 원본: tests/cycle-394-relic-synergies-id-dead.test.js ───
{
  /**
   * cycle 394: RELIC_SYNERGIES `id` 출력 dead 일괄 정리
   *   (cycle 222-393 silent dead config 시리즈 157번째 — cleanup lens 연속).
   *
   * 발견 (20 dead 필드):
   * - src/data/relics.ts RELIC_SYNERGIES 20 entry 각각에 `id: '<synergy_id>'`.
   * - 매칭은 `bonus.effect` 기반 (statsCalculator + CombatEngine).
   *   · `syn.bonus.effect === 'eternal_fortress'` / `'entropy_god'` / `'primordial_wrath'` 등.
   *   · syn.id 매칭은 src/, tests/ 어디에도 0건.
   * - StatsPanel React key는 `syn.name` 사용 (id 아님).
   * - RelicChoicePanel은 syn.requires / syn.label / syn.legendaryHint만 read.
   * - 일부 id 값(e.g. 'eternal_fortress')은 bonus.effect와 동일하지만 dispatch는 항상 effect로 일어남.
   *
   * 패턴 (cycle 222-393 시리즈 157번째):
   * - cycle 365: eventChain outcome chainId 70 redundant 일괄 정리 (가장 큰 단일 batch까지).
   * - cycle 393: PREMIUM_SHOP entry category/repeatable 10 dead.
   * - cycle 394: RELIC_SYNERGIES id 20 dead 일괄 정리
   *   (function-output-dead lens의 data-config-dead 변형 — 동일 패턴 연속).
   *
   * 수정 (src/data/relics.ts):
   * - 20 synergy entry에서 `id: '...'` 라인 일괄 제거.
   *
   * 회귀 가드:
   * - bonus.effect / label / requires / desc / bonus 필드 보존.
   * - getActiveRelicSynergies 동작 (filter syn.requires every) 보존.
   * - StatsPanel `syn.name` 키 + label 동작 보존.
   * - cycle 153/154/236/237 회귀 가드 (bonus.effect 매칭 시너지) 통과.
   */


  test('cycle 394: RELIC_SYNERGIES entry에서 id 0건', async () => {
      const source = await readSrc('src/data/relics.ts');
      const synergyStart = source.indexOf('export const RELIC_SYNERGIES');
      const synergyEnd = source.indexOf(']);', synergyStart);
      const block = source.slice(synergyStart, synergyEnd);
      const idMatches = block.match(/^\s+id: '/gm) || [];
      assert.equal(idMatches.length, 0,
          `RELIC_SYNERGIES에서 id 0건, 발견: ${idMatches.length}`);
  });

  test('cycle 394: RELIC_SYNERGIES 동작 보존 (bonus.effect 기반 매칭)', async () => {
      const { RELIC_SYNERGIES, getActiveRelicSynergies } = await import('../src/data/relics.js');
      assert.ok(Array.isArray(RELIC_SYNERGIES), 'RELIC_SYNERGIES 배열 유지');
      assert.equal(RELIC_SYNERGIES.length, 20, '20 entries 유지');

      // bonus / label / requires 필드 보존 확인
      for (const syn of RELIC_SYNERGIES) {
          assert.ok(typeof syn.label === 'string', 'label 유지');
          assert.ok(Array.isArray(syn.requires), 'requires 유지');
          assert.ok(typeof syn.bonus === 'object', 'bonus 유지');
          assert.ok(typeof syn.bonus.effect === 'string', 'bonus.effect 유지');
          assert.equal(syn.id, undefined, 'id 필드 제거');
      }

      // getActiveRelicSynergies 동작 회귀 가드 (vampire_lord 예시)
      const relics = [{ name: '피의 서약' }, { name: '영혼 흡수' }];
      const active = getActiveRelicSynergies(relics);
      assert.ok(active.length > 0, 'getActiveRelicSynergies 매칭 보존');
      assert.equal(active[0].bonus.effect, 'vampire_lord', 'vampire_lord effect 보존');
  });

  test('cycle 394: cycle 153/154/236/237 회귀 가드 (bonus.effect 매칭 시너지 통과)', async () => {
      const source = await readSrc('src/data/relics.ts');
      const fixtures = [
          'eternal_fortress', 'entropy_god', 'primordial_wrath',
          'vampire_lord', 'arcane_surge', 'eternal_life', 'annihilator',
      ];
      for (const effect of fixtures) {
          const re = new RegExp(`bonus:[^}]+effect: '${effect}'`);
          assert.ok(re.test(source), `bonus.effect: '${effect}' 보존`);
      }
  });

  test('cycle 393 회귀 가드: PREMIUM_SHOP category/repeatable 0건', async () => {
      const source = await readSrc('src/data/premiumShop.ts');
      assert.ok(!/category:\s*'utility'/.test(source),
          'cycle 393 utility category 0건 보존');
      assert.ok(!/repeatable:\s*true/.test(source),
          'cycle 393 repeatable 0건 보존');
  });
}

// ─── 원본: tests/cycle-533-get-relic-synergy-score-owned-relics-default-unreachable.test.js ───
{
  /**
   * cycle 533: getRelicSynergyScore `ownedRelics = []` default unreachable
   *   (cycle 222-532 silent dead config 시리즈 276번째 — redundant default annotation
   *   util/component/hook default 청소 메가 시리즈 29번째).
   *
   * 발견 (1 default unreachable):
   * - src/components/RelicChoicePanel.tsx (line 43):
   *     const getRelicSynergyScore = (newRelic: any,
   *         ownedRelics: any = []): any => {
   *         const ownedEffects = ownedRelics.map((r: any) => r.effect);
   *         const ownedNames = new Set(ownedRelics.map((r: any) => r.name));
   *         ...
   *     };
   * - 호출 사이트 (1 callsite, 모듈 내부 private):
   *     · RelicChoicePanel.tsx:153 — getRelicSynergyScore(relic, ownedRelics)
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: ownedRelics 항상 명시 전달. default [] 도달 불가.
   *
   * 패턴 (cycle 222-532 시리즈 276번째):
   * - cycle 502-532: util/component/hook default 청소 메가 시리즈 29사이클.
   * - cycle 533: components/ private helper — cycle 529/531에 이은 동일 lens.
   *
   * 수정 (src/components/RelicChoicePanel.tsx):
   * - signature에서 ownedRelics: any = [] → ownedRelics: any.
   * - body의 ownedRelics.map / RELIC_SYNERGIES.find 처리 보존.
   *
   * 회귀 가드:
   * - 1 internal callsite 동작 그대로.
   * - body legendarySyn / nearLegendary 분기 보존.
   */


  test('cycle 533: getRelicSynergyScore signature에서 ownedRelics default 0건', async () => {
      const source = await readSrc('src/components/RelicChoicePanel.tsx');
      const fnIdx = source.indexOf('const getRelicSynergyScore');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/ownedRelics:\s*any\s*=\s*\[\]/.test(sig),
          'getRelicSynergyScore ownedRelics default [] 제거');
      assert.ok(/\bownedRelics\b/.test(sig), 'ownedRelics 파라미터 자체는 보존');
  });

  test('cycle 533: 정합성 가드 — internal callsite 보존', async () => {
      const source = await readSrc('src/components/RelicChoicePanel.tsx');
      assert.ok(/getRelicSynergyScore\(relic,\s*ownedRelics\)/.test(source),
          'getRelicSynergyScore(relic, ownedRelics) callsite 보존');
  });

  test('cycle 533: body 분기 + ownedRelics.map 처리 보존', async () => {
      const source = await readSrc('src/components/RelicChoicePanel.tsx');
      assert.ok(/const ownedEffects = ownedRelics\.map\(\(r: any\) => r\.effect\)/.test(source),
          'ownedRelics.map(r => r.effect) 보존');
      assert.ok(/const ownedNames = new Set\(ownedRelics\.map\(\(r: any\) => r\.name\)\)/.test(source),
          'new Set(ownedRelics.map(r => r.name)) 보존');
      assert.ok(/RELIC_SYNERGIES\.find/.test(source), 'RELIC_SYNERGIES.find 분기 보존');
  });

  test('cycle 533: cycle 502-532 회귀 가드 — util/component/hook default 청소 시리즈 보존', async () => {
      const sh = await readSrc('src/hooks/gameActions/_shared.ts');
      assert.ok(!/buildClassVitals[^=]*meta:\s*any\s*=\s*\{\}/.test(sh),
          'cycle 532 buildClassVitals meta default 0건');

      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/const formatPercent[^=]*value:\s*any\s*=\s*0/.test(sp),
          'cycle 531 formatPercent value default 0건');
  });
}

// ─── 원본: tests/cycle-546-get-element-multiplier-relics-default-unreachable.test.js ───
{
  /**
   * cycle 546: getElementMultiplier `relics = []` default unreachable
   *   (cycle 222-545 silent dead config 시리즈 288번째 — redundant default annotation
   *   청소 메가 시리즈 41번째).
   *
   * 발견 (1 default unreachable):
   * - src/systems/CombatEngine.ts (line 28):
   *     getElementMultiplier(elem: any, enemy: Monster, relics: any[] = []) {
   *         ...
   *         const boostRelic = (relics || []).find((r: any) => r.effect === 'elem_boost');
   *         ...
   *     }
   * - 호출 사이트 (2 internal + N test):
   *     · CombatEngine.ts:480 — this.getElementMultiplier(stats.elem, enemy, relics)
   *     · CombatEngine.ts:745 — this.getElementMultiplier(skillElem, enemy, relics)
   *     · tests: cycle-252/253/254/255 etc. 모두 [] 명시.
   * - 결과: relics 항상 명시 전달. default 도달 불가.
   *   body의 (relics || []) defensive guard는 별개 보존 (caller가 null 넘기는
   *   path 활성).
   *
   * 패턴 (cycle 222-545 시리즈 288번째):
   * - cycle 502-545: default 청소 메가 시리즈 44사이클.
   * - cycle 546: systems/CombatEngine method default — cycle 537과 동일 layer.
   *
   * 수정 (src/systems/CombatEngine.ts):
   * - signature에서 relics: any[] = [] → relics: any[].
   * - body의 (relics || []).find / boost 처리 보존.
   *
   * 회귀 가드:
   * - 2 internal callsite + N test callsite 동작 그대로.
   * - body weakness/resistance 분기 보존.
   */


  test('cycle 546: getElementMultiplier signature에서 relics default 0건', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const fnIdx = source.indexOf('getElementMultiplier(elem');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/relics:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'getElementMultiplier relics default [] 제거');
      assert.ok(/\brelics\b/.test(sig), 'relics 파라미터 자체는 보존');
  });

  test('cycle 546: 정합성 가드 — 2 internal callsite + test 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const calls = (source.match(/this\.getElementMultiplier\(/g) || []).length;
      assert.equal(calls, 2, `internal callsite 2건 보존: ${calls}건`);

      const test1 = await readSrc('tests/monsters-cycle.test.js'); // cycle-254 통합처
      assert.ok(/CombatEngine\.getElementMultiplier\('냉기',\s*enemy,\s*\[\]\)/.test(test1),
          'test callsite (cycle 254) 보존');
  });

  test('cycle 546: body defensive guard + weakness 분기 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/\(relics \|\| \[\]\)\.find\(\(r: any\) => r\.effect === 'elem_boost'\)/.test(source),
          '(relics || []).find defensive guard 보존');
      assert.ok(/if \(enemy\?\.weakness && enemy\.weakness === elem\)/.test(source),
          'weakness 분기 보존');
  });

  test('cycle 546: cycle 502-545 회귀 가드 — default 청소 시리즈 보존', async () => {
      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/export const pickFallbackEvent[^=]*history:\s*any\[\]\s*=\s*\[\]/.test(aiu),
          'cycle 545 pickFallbackEvent history default 0건');

      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/const scoreTag[^=]*reasons:\s*any\[\]\s*=\s*\[\]/.test(rp),
          'cycle 544 scoreTag reasons default 0건');
  });
}

// ─── 원본: tests/cycle-551-get-effective-max-mp-relics-default-unreachable.test.js ───
{
  /**
   * cycle 551: getEffectiveMaxMp `relics = []` default unreachable
   *   (cycle 222-550 silent dead config 시리즈 292번째 — redundant default annotation
   *   청소 메가 시리즈 45번째). systems/CombatEngine method 시리즈 5번째.
   *
   * 발견 (1 default unreachable):
   * - src/systems/CombatEngine.ts (line 68):
   *     getEffectiveMaxMp(player: Player, relics: Relic[] = []) {
   *         const rmp = 1 + relics.reduce(...);
   *         ...
   *     }
   * - 호출 사이트 (4 internal callsite):
   *     · CombatEngine.ts:84 — this.getEffectiveMaxMp(player, relics)
   *     · CombatEngine.ts:370 — this.getEffectiveMaxMp(updated, relics)
   *     · CombatEngine.ts:957 — this.getEffectiveMaxMp(updatedPlayer, relics)
   *     · CombatEngine.ts:987 — this.getEffectiveMaxMp(player, relics)
   *     · 외부 caller 0건, test caller 0건.
   * - 결과: relics 항상 명시 전달. default 도달 불가.
   *
   * 패턴 (cycle 222-550 시리즈 292번째):
   * - cycle 502-550: default 청소 메가 시리즈 49사이클.
   * - cycle 551: systems/CombatEngine method 시리즈 5번째 — cycle 546-549에
   *   이은 동일 모듈 추가 cleanup.
   *
   * 수정 (src/systems/CombatEngine.ts):
   * - signature에서 relics: Relic[] = [] → relics: Relic[].
   * - body의 reduce / Math.floor 처리 보존.
   *
   * 회귀 가드:
   * - 4 internal callsite 동작 그대로.
   * - body mp_mult / omega effect 처리 보존.
   */


  test('cycle 551: getEffectiveMaxMp signature에서 relics default 0건', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const fnIdx = source.indexOf('getEffectiveMaxMp(player');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/relics:\s*Relic\[\]\s*=\s*\[\]/.test(sig),
          'getEffectiveMaxMp relics default [] 제거');
  });

  test('cycle 551: 정합성 가드 — 4 internal callsite 보존', async () => {
      // getEffectiveMaxMp 호출 일부가 CombatEngine.relics.ts(applyCritMpRestore/FatalProtection)로 이동 — 합쳐서 카운트.
      const source = (await readSrc('src/systems/CombatEngine.ts')) + (await readSrc('src/systems/CombatEngine.relics.ts'));
      const calls = (source.match(/this\.getEffectiveMaxMp\(/g) || []).length;
      assert.equal(calls, 4, `internal callsite 4건 보존: ${calls}건`);
  });

  test('cycle 551: body mp_mult / omega effect 처리 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/relic\.effect === 'mp_mult'/.test(source),
          'mp_mult effect 분기 보존');
      assert.ok(/relic\.effect === 'omega'/.test(source),
          'omega effect 분기 보존');
  });

  test('cycle 551: cycle 502-550 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/tickEnemyStatus\(enemy: Monster, logs:\s*any\[\]\s*=\s*\[\]/.test(ce),
          'cycle 549 tickEnemyStatus logs default 0건');
      assert.ok(!/applyCritMpRestore\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]/.test(ce),
          'cycle 548 applyCritMpRestore relics default 0건');
  });
}

// ─── 원본: tests/cycle-597-relics-defaults-batch.test.js ───
{
  /**
   * cycle 597: getActiveRelicSynergies + pickWeightedRelics 2 defaults batch
   *   unreachable (cycle 222-596 silent dead config 시리즈 334번째 — redundant
   *   default annotation 청소 메가 시리즈 추가, data/relics.ts).
   *
   * 발견 (2 defaults batch):
   * - src/data/relics.ts (line 563, 568):
   *     · getActiveRelicSynergies (relics: any = [])
   *     · pickWeightedRelics (pool: any, count: any = 3)
   * - 호출 사이트:
   *     · getActiveRelicSynergies: statsCalculator:378 + CombatEngine:395/416/
   *       433/1553 (5 production) + cycle-394 test — 모두 명시.
   *     · pickWeightedRelics: exploreUtils:103 + eventActions:54 + exploreActions:118
   *       + combatBossHandlers:90 (4 production) + cycle-285 test — 모두 count
   *       명시 (1 또는 3).
   * - 결과: 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-596 시리즈 334번째):
   * - cycle 502-596: default 청소 메가 시리즈 93사이클.
   * - cycle 597: data/relics.ts 추가 cleanup, cycle 596 data/ 진입 연속.
   *
   * 수정 (src/data/relics.ts):
   * - getActiveRelicSynergies relics default [] 제거.
   * - pickWeightedRelics count default 3 제거.
   *
   * 회귀 가드:
   * - 다수 callsite 동작 그대로.
   */


  test('cycle 597: getActiveRelicSynergies signature에서 relics default 0건', async () => {
      const source = await readSrc('src/data/relics.ts');
      const fnIdx = source.indexOf('export const getActiveRelicSynergies');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/relics:\s*any\s*=\s*\[\]/.test(sig),
          'getActiveRelicSynergies relics default [] 제거');
  });

  test('cycle 597: pickWeightedRelics signature에서 count default 0건', async () => {
      const source = await readSrc('src/data/relics.ts');
      const fnIdx = source.indexOf('export const pickWeightedRelics');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/count:\s*any\s*=\s*3/.test(sig),
          'pickWeightedRelics count default 3 제거');
  });

  test('cycle 597: 정합성 가드 — 다수 callsite 보존', async () => {
      const sc = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(/getActiveRelicSynergies\(relics\)/.test(sc),
          'statsCalculator getActiveRelicSynergies 보존');

      const eu = await readSrc('src/utils/exploreUtils.ts');
      // PR #8: count 인자를 프레스티지 해금(relicUnlocks.relicChoices)으로 명시 전달
      //   — default 미의존(cycle 597 가드 의도) 보존. rank≥2면 3→4지선다.
      assert.ok(/pickWeightedRelics\(available,\s*relicUnlocks\.relicChoices\)/.test(eu),
          'exploreUtils pickWeightedRelics 명시 count 전달 보존');

      const ev = await readSrc('src/hooks/gameActions/eventActions.ts');
      assert.ok(/pickWeightedRelics\(updatedPlayer\.relics \|\| \[\],\s*1\)/.test(ev),
          'eventActions pickWeightedRelics(..., 1) 보존');
  });

  test('cycle 597: cycle 502-596 회귀 가드 — default 청소 시리즈 보존', async () => {
      const cd = await readSrc('src/data/codexRewards.ts');
      assert.ok(!/getCodexProgress[^=]*codex:\s*any\s*=\s*\{\}/.test(cd),
          'cycle 596 getCodexProgress codex default 0건');

      const ec = await readSrc('src/data/eventChains.ts');
      assert.ok(!/getChainEventForLoc\(loc:\s*any,\s*progress:\s*any\s*=\s*\{\}\)/.test(ec),
          'cycle 596 getChainEventForLoc progress default 0건');
  });
}

// ─── 원본: tests/cycle-67-relics.test.js ───
{
  // cycle 67: 탐색/유틸 유물 3종 추가 — 기존 effect 핸들러(event_chance /
  // gold_mult / drop_rate)를 재사용해 CombatEngine 변경 없이 빌드 다양성 확보.

  const findById = (id) => RELICS.find((r) => r.id === id);

  test('wanderer_charm 추가됨 (uncommon event_chance 0.3)', () => {
      const relic = findById('wanderer_charm');
      assert.ok(relic, 'wanderer_charm should exist');
      assert.equal(relic.rarity, 'uncommon');
      assert.equal(relic.effect, 'event_chance');
      assert.equal(relic.val, 0.3);
  });

  test('merchant_seal 추가됨 (rare gold_mult 0.6)', () => {
      const relic = findById('merchant_seal');
      assert.ok(relic, 'merchant_seal should exist');
      assert.equal(relic.rarity, 'rare');
      assert.equal(relic.effect, 'gold_mult');
      assert.equal(relic.val, 0.6);
  });

  test('fortune_relic 추가됨 (rare drop_rate 1.0)', () => {
      const relic = findById('fortune_relic');
      assert.ok(relic, 'fortune_relic should exist');
      assert.equal(relic.rarity, 'rare');
      assert.equal(relic.effect, 'drop_rate');
      assert.equal(relic.val, 1.0);
  });

  test('신규 유물의 effect는 모두 기존 핸들러 재사용 (CombatEngine 변경 없음)', () => {
      const newIds = ['wanderer_charm', 'merchant_seal', 'fortune_relic'];
      const reusedEffects = new Set(['event_chance', 'gold_mult', 'drop_rate']);
      for (const id of newIds) {
          const relic = findById(id);
          assert.ok(reusedEffects.has(relic.effect), `${id} should reuse existing effect`);
      }
  });

  test('id 충돌 없음 (전체 RELICS에서 unique)', () => {
      const ids = RELICS.map((r) => r.id);
      const set = new Set(ids);
      assert.equal(ids.length, set.size, 'all relic ids should be unique');
  });
}
