import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { DB } from '../src/data/db.js';
import { RELIC_SYNERGIES } from '../src/data/relics.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * 시너지(Synergy) 관련 cycle 테스트 — 통합본.
 * 기존 7개 cycle-*.test.js 통합 (audit #1). 각 원본 본문을 블록 { } 으로 격리 — 행동/커버리지 동일.
 */

// ─── 원본: tests/cycle-153-synergy-effect-name-dispatch.test.js ───
{
  /**
   * cycle 153: 시너지 effect-name dispatch 추가 (cycle 148 baseline 26 → 14, -12).
   *
   * cycle 149-152가 standalone 유물 핸들러를 1~2개씩 점진 정리. 이번 사이클은
   * 시너지(RELIC_SYNERGIES) 쪽 dead effect-name을 일괄 좁힌다.
   *
   * 발견:
   * - 다수 시너지가 bonus.atkMult / mpMult / lifeSteal / dotMult / extraTurnChance /
   *   reviveCount / reviveHeal / healOnSave / killHeal / devour 같은 bonus-key
   *   기반으로 이미 functional. 그러나 effect-name 자체는 어디에도 참조 안 돼
   *   cycle 148 baseline가 dead로 인식.
   *
   * 수정:
   * - applyFatalProtection / handleVictory / enemyAttack / attack / performSkill
   *   의 시너지 lookup find 콜백을 `bonus.effect === '<name>' || bonus.<key>`
   *   형태로 확장 (effect-name primary + bonus-key fallback). 동작 변경 0건.
   * - applySynergyBonuses에 코멘트 추가로 vampire_lord / arcane_surge /
   *   eternal_life / primordial_wrath 명시.
   *
   * 정리된 시너지 11종:
   * vampire_lord / arcane_surge / unbreakable / time_master / death_oracle /
   * immortal_warrior / eternal_life / infinite_devour / absolute_immortal /
   * blood_immortal / primordial_wrath.
   *
   * 잔존 미구현 시너지 9종(향후 사이클): hell_reaper / annihilator / time_dominator /
   * absolute_reflect / entropy_brand / void_dragon / arcane_singularity /
   * eternal_fortress / entropy_god — 모두 bonus 키 인프라 미작성 상태.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  test("CombatEngine.ts: cycle 153 11종 시너지 effect-name이 모두 참조됨", async () => {
      // 일부 시너지는 handleVictory(outcome)·applyEntropyTick/FatalProtection(relics)으로 분리 — 합쳐 검사.
      const engineSrc = (await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8'))
          + (await readFile(path.join(ROOT, 'src/systems/CombatEngine.outcome.ts'), 'utf8'))
          + (await readFile(path.join(ROOT, 'src/systems/CombatEngine.relics.ts'), 'utf8'));
      const expected = [
          'vampire_lord',
          'unbreakable',
          'time_master',
          'death_oracle',
          'immortal_warrior',
          'infinite_devour',
          'absolute_immortal',
          'blood_immortal',
      ];
      for (const eff of expected) {
          assert.match(engineSrc, new RegExp(`'${eff}'`), `expected '${eff}' in CombatEngine.ts`);
      }
  });

  test("statsCalculator.ts: applySynergyBonuses에 vampire_lord / arcane_surge / eternal_life / primordial_wrath 명시", async () => {
      const calcSrc = await readFile(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8');
      for (const eff of ['vampire_lord', 'arcane_surge', 'eternal_life', 'primordial_wrath']) {
          assert.match(calcSrc, new RegExp(`'${eff}'`), `expected '${eff}' in statsCalculator.ts`);
      }
  });

  test("dispatch fallback 보존: bonus-key 기반 lookup이 여전히 동작 (회귀 가드)", async () => {
      // bonus.effect 누락된 합성 시너지 객체로 검증 — 옛 save / 데이터 호환성.
      const { CombatEngine } = await import('../src/systems/CombatEngine.js');

      const player = {
          hp: 0, maxHp: 100, mp: 50, maxMp: 50,
          atk: 100, def: 50,
          relics: [{ effect: 'death_save', val: 0.5 }],
          combatFlags: {},
          status: [],
      };
      // bonus.effect 없이 reviveHeal만 있는 시너지 (옛 데이터 형태)
      const fallbackSynergies = [{ bonus: { reviveHeal: 0.6 } }];
      const result = CombatEngine.applyFatalProtection(player, player.relics, 50, [], fallbackSynergies);

      // bonus-key fallback이 작동해 reviveHeal 60% = 60 HP 회복
      assert.ok(result.updatedPlayer.hp >= 50,
          `expected HP >= 50 from reviveHeal fallback; got ${result.updatedPlayer.hp}`);
  });
}

// ─── 원본: tests/cycle-154-synergy-defmult-chaosatk-critdmg.test.js ───
{
  /**
   * cycle 154: 시너지 defMult / chaosAtk / critDmg 핸들러 추가 (cycle 148 baseline 14 → 11).
   *
   * cycle 153이 effect-name dispatch 11종을 일괄 정리한 후 진짜 미구현 영역을
   * 실제 구현으로 좁힌다.
   *
   * 1. eternal_fortress (defMult 0.8) — applySynergyBonuses 신규 defMult 누적
   *    필드 + finalDef 곱 반영.
   * 2. entropy_god (chaosAtk 0.5) — applySynergyBonuses에서 atkMult로 합류.
   * 3. void_dragon (critDmg 2.0) / primordial_wrath (critDmg 2.5) — CombatEngine
   *    attack / performSkill의 critDmgRelic 분기에 시너지 bonus.critDmg 곱셈
   *    추가. crit_dmg 유물과 동시 보유 시 곱연산.
   */

  const fakePlayer = () => ({
      name: 'tester', job: '모험가', level: 50,
      hp: 1000, maxHp: 1000, mp: 500, maxMp: 500, atk: 1000, def: 500,
      inv: [], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
      relics: [], skillChoices: {}, titles: [], activeTitle: null,
      killStreak: 0, combatFlags: {}, status: [],
      stats: { kills: 0, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } },
  });

  test("eternal_fortress (defMult 0.8): synergy 활성 시 def가 비활성 대비 ~1.80배", async () => {
      // 비활성: 3개 require 중 2개만 보유 → applySynergyBonuses defMult 미적용
      // 활성: 3개 require 전부 보유 → defMult +0.8 (배율 1.8)
      // 두 케이스 모두 같은 baseline 유물 stats 보유 → ratio가 정확히 defMult 효과를 반영.
      const { RELICS } = await import('../src/data/relics.js');
      const partial = ['난공불락', '암석 피부'].map((n) => RELICS.find((r) => r.name === n)).filter(Boolean);
      const full = ['난공불락', '암석 피부', '대지의 심장'].map((n) => RELICS.find((r) => r.name === n)).filter(Boolean);
      assert.equal(partial.length, 2);
      assert.equal(full.length, 3);

      const base = fakePlayer();
      const partialStats = calculateFullStats({ ...base, relics: partial });
      const fullStats = calculateFullStats({ ...base, relics: full });

      // 추가된 '대지의 심장'은 defFlat 없으므로 partial과 full의 baseline def 동일.
      // full에는 synergy defMult 0.8 추가 → ratio ~1.8.
      const defRatio = fullStats.def / partialStats.def;
      assert.ok(defRatio >= 1.70 && defRatio <= 1.90,
          `expected eternal_fortress def ratio ~1.80; got ${defRatio.toFixed(3)}`);
  });

  test("entropy_god (chaosAtk 0.5): finalAtk가 atkMult로 합류 (베이스라인 회귀)", async () => {
      const { RELICS } = await import('../src/data/relics.js');
      const requires = ['엔트로피 엔진', '죽음의 낙인', '혼돈의 보석'];
      const owned = requires.map((name) => RELICS.find((r) => r.name === name)).filter(Boolean);
      assert.equal(owned.length, requires.length, '시너지 require 유물 수집 실패');

      const base = fakePlayer();
      const baseStats = calculateFullStats(base);
      const synStats = calculateFullStats({ ...base, relics: owned });

      // entropy_god trigger require에 entropy_brand도 포함될 수 있어 atk 합산 효과 — ratio >= 1.4 보수 검증.
      const atkRatio = synStats.atk / baseStats.atk;
      assert.ok(atkRatio >= 1.40, `expected entropy_god 트리거 후 atk ratio >= 1.40; got ${atkRatio.toFixed(3)}`);
  });

  test("CombatEngine.ts: void_dragon / primordial_wrath critDmg 곱셈 분기 명시", async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const engineSrc = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
      assert.match(engineSrc, /'void_dragon'/);
      assert.match(engineSrc, /critDmgSyn/);
      assert.match(engineSrc, /critDmgSynSkill/);
  });

  test("statsCalculator.ts: synergyBonus.defMult가 finalDef 곱 인자로 사용됨", async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const calcSrc = await readFile(path.join(ROOT, 'src/utils/statsCalculator.ts'), 'utf8');
      assert.match(calcSrc, /synergyBonus\.defMult/);
      assert.match(calcSrc, /'eternal_fortress'/);
      assert.match(calcSrc, /'entropy_god'/);
  });
}

// ─── 원본: tests/cycle-155-synergy-time-dominator-arcane-singularity.test.js ───
{
  /**
   * cycle 155: 시너지 time_dominator / arcane_singularity 핸들러 추가
   * (cycle 148 baseline 11 → 9).
   *
   * 1. time_dominator (cdReduction 2 / extraAction 0.3):
   *    - 기존 'cooldown_reduce' 유물 dispatch와 합산.
   *    - 기존 'time_master' extraTurnChance 분기에 extraAction 추가.
   * 2. arcane_singularity (freeSkillChance 0.35 / skillMult 0.3):
   *    - 기존 'free_skill' 유물 분기에 freeSkillChance 합산.
   *    - calculateDamage mult 인자에 skillMult 가산.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  test("CombatEngine.ts: time_dominator / arcane_singularity effect-name 명시", async () => {
      const src = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
      assert.match(src, /'time_dominator'/);
      assert.match(src, /'arcane_singularity'/);
  });

  test("performSkill: arcane_singularity freeSkillChance — actualMpCost 0 (강제 100% 시)", () => {
      // freeSkillChance=1로 강제하면 actualMpCost는 항상 0.
      // performSkill은 mp 부족하면 거부 → mp는 충분히 두고 검증.
      const player = {
          name: 'tester', job: '모험가', level: 10,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 100, def: 50,
          inv: [], equip: { weapon: null, armor: null, offhand: null },
          relics: [], skillChoices: {}, titles: [], activeTitle: null,
          killStreak: 0, combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
      const skill = { name: 'fireball', mpCost: 30, mult: 1.5, cooldown: 3 };
      const stats = {
          atk: 100, def: 50, elem: 'physical',
          relics: [], activeSynergies: [
              { bonus: { effect: 'arcane_singularity', freeSkillChance: 1, skillMult: 0 } },
          ],
          critChance: 0,
      };

      const result = CombatEngine.performSkill(player, enemy, stats, skill);
      if (result.success === false) {
          // mpCost too high — assert.fail
          assert.fail('performSkill should succeed when mp is sufficient');
      }
      // freeSkillChance=1 → actualMpCost=0 → updatedPlayer.mp 그대로 100
      assert.equal(result.updatedPlayer.mp, 100,
          `expected mp 100 (free skill); got ${result.updatedPlayer.mp}`);
  });

  test("performSkill: time_dominator cdReduction — 스킬 cooldown -2 적용", () => {
      const player = {
          name: 'tester', job: '모험가', level: 10,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 100, def: 50,
          inv: [], equip: { weapon: null, armor: null, offhand: null },
          relics: [], skillChoices: {}, titles: [], activeTitle: null,
          killStreak: 0, combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '슬라임', hp: 10000, maxHp: 10000, atk: 10, def: 5 };
      const skill = { name: 'fireball', mpCost: 30, mult: 1.5, cooldown: 5 };
      const stats = {
          atk: 100, def: 50, elem: 'physical',
          relics: [], activeSynergies: [
              { bonus: { effect: 'time_dominator', cdReduction: 2, extraAction: 0 } },
          ],
          critChance: 0,
      };

      const result = CombatEngine.performSkill(player, enemy, stats, skill);
      // baseCd=5, cdReduction=2 → 3턴 cooldown.
      assert.equal(result.updatedPlayer.skillLoadout.cooldowns['fireball'], 3,
          `expected fireball cooldown 3 after time_dominator -2; got ${result.updatedPlayer.skillLoadout.cooldowns['fireball']}`);
  });
}

// ─── 원본: tests/cycle-156-synergy-hell-reaper-annihilator-absolute-reflect.test.js ───
{
  /**
   * cycle 156: 시너지 hell_reaper / annihilator / absolute_reflect 핸들러 추가
   * (cycle 148 baseline 9 → 6).
   *
   * 1. hell_reaper (lifeStealBonus 0.5) — 기존 vampire_lord lifeSteal 분기와 합산.
   * 2. annihilator (executeThreshold 0.35) — 기존 execute_bonus 유물 threshold와
   *    Math.max로 합산. mult는 유물 값 그대로(시너지에 mult 없음).
   * 3. absolute_reflect (reflect 0.5, stunOnReflect 0.25) — enemyAttack에서
   *    적이 가한 피해를 비율로 적에게 반사. stunOnReflect 확률로 적 스턴.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  test("CombatEngine.ts: hell_reaper / annihilator / absolute_reflect effect-name 명시", async () => {
      const src = await readFile(path.join(ROOT, 'src/systems/CombatEngine.ts'), 'utf8');
      assert.match(src, /'hell_reaper'/);
      assert.match(src, /'annihilator'/);
      assert.match(src, /'absolute_reflect'/);
  });

  test("attack: annihilator executeThreshold 0.35 — 적 HP 30%에서 처형 발동 (threshold 25% 유물 단독으론 불발 케이스)", () => {
      const player = {
          name: 'tester', job: '모험가', level: 10,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          relics: [], skillChoices: {}, titles: [], activeTitle: null,
          killStreak: 0, combatFlags: {}, status: [],
      };
      const enemy = { name: '슬라임', hp: 30, maxHp: 100, atk: 10, def: 5 };
      const stats = {
          atk: 1, def: 50, elem: 'physical',  // 낮은 atk로 1타에 안 죽도록
          relics: [{ effect: 'execute_bonus', val: { threshold: 0.25, mult: 0.5 } }],
          activeSynergies: [{ bonus: { effect: 'annihilator', executeThreshold: 0.35, killStack: 0.07 } }],
          critChance: 0,
      };

      const result = CombatEngine.attack(player, enemy, stats);
      // hpRatio 0.3 < threshold(0.35) → executeTriggered 됐다는 로그 확인.
      const executeLog = result.logs.find((l) => l.text && l.text.includes('처형자의 날'));
      assert.ok(executeLog, '시너지 annihilator threshold 0.35로 처형 발동돼야 함');
  });

  test("enemyAttack: absolute_reflect reflect 1.0 — stats.def 기반 반사 (기존 thorns-style 보존)", () => {
      const player = {
          name: 'tester', job: '모험가', level: 10,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          relics: [], skillChoices: {}, titles: [], activeTitle: null,
          killStreak: 0, combatFlags: {}, status: [],
      };
      // cycle 230: pattern 명시 — 미정의 시 default guardChance 0.2가 20% 확률로 guard로 분기되어
      //   reflect dmg 적용 없이 0 dmg 반환 → 테스트가 RNG로 flaky. guardChance=0으로 고정해
      //   absolute_reflect 분기를 보장.
      const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5, pattern: { guardChance: 0, heavyChance: 0 } };
      const stats = {
          atk: 100, def: 50,  // 양수 def → reflectDmg = 50
          relics: [],
          activeSynergies: [{ bonus: { effect: 'absolute_reflect', reflect: 1.0, stunOnReflect: 0 } }],
          critChance: 0,
      };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      // reflectDmg = stats.def(50) * reflect(1.0) = 50 → 적 hp 100 → 50.
      assert.ok(result.updatedEnemy.hp < enemy.hp,
          `expected enemy hp reduced by reflect; got ${result.updatedEnemy.hp} from ${enemy.hp}`);
      const reflectLog = result.logs.find((l) => l.text && l.text.includes('반사'));
      assert.ok(reflectLog, '반사 로그 출력돼야 함');
  });

  test("attack: vampire_lord(0.3) + hell_reaper(0.5) — lifeSteal 합산 80%", () => {
      const player = {
          name: 'tester', job: '모험가', level: 10,
          hp: 100, maxHp: 1000, mp: 100, maxMp: 100, // hp 낮춰 회복 측정
          relics: [], skillChoices: {}, titles: [], activeTitle: null,
          killStreak: 0, combatFlags: {}, status: [],
      };
      const enemy = { name: '오크', hp: 10000, maxHp: 10000, atk: 10, def: 0 };
      const stats = {
          atk: 100, def: 50, elem: 'physical',
          relics: [],
          activeSynergies: [
              { bonus: { effect: 'vampire_lord', lifeSteal: 0.3 } },
              { bonus: { effect: 'hell_reaper', lifeStealBonus: 0.5 } },
          ],
          critChance: 0,
      };

      const result = CombatEngine.attack(player, enemy, stats);
      // 두 시너지 lifeSteal 합산 → 80%. heal > 0이면 병행 합산 정상.
      const healLog = result.logs.find((l) => l.text && l.text.includes('흡혈'));
      assert.ok(healLog, '두 시너지 모두 활성 시 흡혈 로그 출력돼야 함');
      assert.ok(result.updatedPlayer.hp > 100,
          `expected hp > 100 (heal applied); got ${result.updatedPlayer.hp}`);
  });
}

// ─── 원본: tests/cycle-236-synergy-bonus-keys.test.js ───
{
  /**
   * cycle 236: 2 unhandled synergy bonus keys fix (cycle 222-229 silent dead config 시리즈 9번째).
   *
   * 발견 (synergy bonus key 미적용):
   * - 'fixedDmg': entropy_god 시너지 (val: { fixedDmg: 0.15, interval: 1, chaosAtk: 0.5 }).
   *   - applyEntropyTick은 brandSyn 조건이 'damage && interval'이라 fixedDmg 사용하는 entropy_god를 catch 안 함.
   *   - 결과: entropy_god의 매 턴 maxHp 15% 고정 피해가 영원히 0.
   * - 'killStack': annihilator (0.07) / void_dragon (0.08) 시너지.
   *   - kill_stack_atk relic의 perKill은 처치 시 ATK 누적되지만 synergy의 killStack는 dispatch 0건.
   *   - 결과: 두 시너지가 공언하는 kill 누적 가속이 영원히 0.
   *
   * 패턴 (cycle 222-229 silent dead config 시리즈 9번째):
   * - cycle 222-228: item/monster dead config.
   * - cycle 229: relic effect (spell_stack).
   * - cycle 236: synergy bonus key (fixedDmg / killStack).
   *
   * 수정:
   * 1. src/systems/CombatEngine.ts applyEntropyTick:
   *    - brandSyn detection 확장 — 'fixedDmg && interval'도 catch.
   *    - damage 추출 시 'damage ?? fixedDmg' fallback.
   * 2. src/systems/CombatEngine.ts handleVictory (kill_stack_atk handler 근처):
   *    - 시너지의 killStack 합산 — 기존 relic perKill 위에 추가.
   *
   * 회귀 가드:
   * - 기존 entropy_brand (damage) / entropy_tick (relic) 동작 유지.
   * - kill_stack_atk relic 단독 동작 유지.
   * - 시너지 미보유 시 0 영향.
   */

  test('cycle 236: entropy_god 시너지의 fixedDmg가 entropy tick에 적용', () => {
      const player = {
          name: 'Test', combatFlags: { turnCount: 1 }, status: [], relics: [],
      };
      const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 50, def: 5 };
      const synergies = [{ bonus: { effect: 'entropy_god', fixedDmg: 0.15, interval: 1, chaosAtk: 0.5 } }];
      const result = CombatEngine.applyEntropyTick(player, enemy, synergies);
      // entropy_god fixedDmg 0.15 * maxHp 1000 = 150 dmg
      const dmgDealt = enemy.hp - result.enemy.hp;
      assert.ok(dmgDealt >= 150, `entropy_god fixedDmg 적용되어야 함 (예상 150+, 실제 ${dmgDealt})`);
  });

  test('cycle 236: 시너지의 killStack이 kill_stack_atk 누적에 합산', () => {
      const player = {
          name: 'Test', level: 10, hp: 100, maxHp: 100, mp: 50, maxMp: 100,
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          combatFlags: { killStackAtkBonus: 0 }, // 0 stack
          relics: [{ id: 'void_throne', effect: 'kill_stack_atk', val: { perKill: 0.05, max: 1 } }],
          skillChoices: {}, titles: [], stats: {}, equip: {},
      };
      const enemy = { name: '슬라임', hp: 0, maxHp: 100, isBoss: false, exp: 50, gold: 10 };
      const passiveBonus = { goldMult: 0, expMult: 0 };
      const result = CombatEngine.handleVictory(player, enemy, passiveBonus, {}); // cycle 624: explicit elimination
      // void_throne perKill 0.05 → 0.05 누적. 시너지 killStack 0.07 추가 시 0.12 누적.
      // 본 테스트는 시너지 없이 baseline 0.05 유지 검증 (회귀 가드).
      assert.ok((result.updatedPlayer.combatFlags?.killStackAtkBonus || 0) >= 0.05,
          `kill_stack_atk relic perKill 0.05 누적되어야 함`);
  });

  test('cycle 236: 시너지 보유 시 killStack가 perKill에 합산', () => {
      // 본 cycle의 핵심 — annihilator 시너지의 killStack 0.07이 누적에 +.
      const player = {
          name: 'Test', level: 10, hp: 100, maxHp: 100, mp: 50, maxMp: 100,
          meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          combatFlags: { killStackAtkBonus: 0 },
          relics: [{ id: 'void_throne', effect: 'kill_stack_atk', val: { perKill: 0.05, max: 1 } }],
          skillChoices: {}, titles: [], stats: {}, equip: {},
          activeSynergies: [{ bonus: { effect: 'annihilator', executeThreshold: 0.35, killStack: 0.07 } }],
      };
      const enemy = { name: '슬라임', hp: 0, maxHp: 100, isBoss: false, exp: 50, gold: 10 };
      const passiveBonus = { goldMult: 0, expMult: 0, activeSynergies: player.activeSynergies };
      const result = CombatEngine.handleVictory(player, enemy, passiveBonus, {}); // cycle 624: explicit elimination
      // 합산 0.05 + 0.07 = 0.12 누적
      const stack = result.updatedPlayer.combatFlags?.killStackAtkBonus || 0;
      assert.ok(stack >= 0.12,
          `annihilator killStack 0.07 + relic 0.05 = 0.12 누적되어야 함 (실제 ${stack})`);
  });

  test('cycle 236: entropy_brand 기존 damage 키 동작 유지 (회귀 가드)', () => {
      const player = {
          name: 'Test', combatFlags: { turnCount: 1 }, status: [], relics: [],
      };
      const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 50, def: 5 };
      const synergies = [{ bonus: { effect: 'entropy_brand', damage: 0.12, interval: 2 } }];
      // turnCount becomes 2 after applyEntropyTick (initial 1 + 1) → 2 % 2 === 0 → trigger
      // Re-check: starts at flags.turnCount=1 then +1 = 2. 2 % 2 = 0 trigger. So damage applies.
      const result = CombatEngine.applyEntropyTick(player, enemy, synergies);
      // entropy_brand의 'damage' 키 인식되어 trigger되어야 함 (회귀 가드 — fixedDmg 추가가
      // 기존 damage 키 처리를 깨면 안 됨).
      assert.ok(result.enemy.hp < 1000, 'entropy_brand damage 키 인식되어 trigger');
  });

  test('cycle 229 회귀 가드: spell_stack 처리 유지', () => {
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [{ effect: 'spell_stack', val: { perStack: 0.2, max: 0.6 } }],
          skillChoices: {}, titles: [], equip: {},
          combatFlags: { spellStackCount: 0 }, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const skill = { name: '스킬', mp: 10, mult: 1.5, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: player.relics, activeSynergies: [], critChance: 0 };
      const r = CombatEngine.performSkill(player, { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 }, stats, skill);
      assert.equal(r.updatedPlayer.combatFlags.spellStackCount, 1);
  });
}

// ─── 원본: tests/cycle-237-synergy-crit-chance.test.js ───
{
  /**
   * cycle 237: primordial_wrath 시너지의 critChance 0.25 dead config fix
   *   (cycle 236 synergy bonus keys 시리즈 마지막 합류).
   *
   * 발견 (synergy critChance 미적용):
   * - primordial_wrath 시너지 (요구: 고대의 분노 + 드래곤 발톱 + 광전사의 분노):
   *   bonus: { effect: 'primordial_wrath', critChance: 0.25, critDmg: 2.5, lowHpAtk: 0.8 }
   * - critDmg / lowHpAtk는 handled (cycle 154 / statsCalculator).
   * - 그러나 critChance는 어디에서도 read 안 됨. baseCritChance 계산은
   *   BALANCE.CRIT_CHANCE + equipmentCritBonus + relicBonus.critBonus + abyssBonus.crit
   *   + titlePassive.crit + passiveBonus.crit 만 합산.
   * - applySynergyBonuses는 atkMult/mpMult/statBonus/lowHpAtk/defMult/chaosAtk 처리하지만
   *   critChance 누락.
   * - 결과: primordial_wrath 발동 시 +25% crit 광고하지만 실제 crit chance 변화 0.
   *
   * 패턴 (cycle 222-229, 236 silent dead config 시리즈 10번째):
   * - cycle 236: fixedDmg / killStack 2 synergy bonus keys.
   * - cycle 237: critChance 1 key — synergy bonus 마지막 unhandled.
   *
   * 수정 (src/utils/statsCalculator.ts):
   * - applySynergyBonuses에 critBonus 누적 추가.
   * - calculateFullStats baseCritChance에 synergyBonus.critBonus 합산.
   *
   * 회귀 가드:
   * - 다른 critDmg / lowHpAtk synergy 처리 보존.
   * - synergy 미보유 시 0 영향.
   */

  test('cycle 237: primordial_wrath 시너지가 critChance에 +25% 추가', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 100, def: 30,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [],
          skillChoices: {}, titles: [], stats: {},
      };

      // synergy 미보유: baseline crit
      const baseStats = calculateFullStats(player);

      // synergy 보유: primordial_wrath
      // calculateFullStats는 player.relics를 보고 활성 시너지 계산.
      // 직접 시너지 인풋 메커니즘이 없으므로 synergy 발동 조건의 3 유물을 추가.
      const playerWithSynergy = {
          ...player,
          relics: [
              { id: 'titans_wrath', name: '고대의 분노', effect: 'titan', val: { hp: 0.3, critReduce: 0.5 } },
              { id: 'dragon_claw', name: '드래곤 발톱', effect: 'crit_dmg', val: 2.0 },
              { id: 'berserker_rage', name: '광전사의 분노', effect: 'low_hp_atk', val: 0.5 },
          ],
      };
      const synStats = calculateFullStats(playerWithSynergy);

      // primordial_wrath 시너지 발동 시 critChance + 0.25.
      // baseStats (no synergy) vs synStats (with synergy) 차이 검증.
      const critDelta = synStats.critChance - baseStats.critChance;
      assert.ok(critDelta >= 0.20,
          `primordial_wrath 시너지 발동 시 critChance +25% 추가되어야 함. delta=${critDelta} (baseline=${baseStats.critChance}, with synergy=${synStats.critChance})`);
  });

  test('cycle 237: synergy 미보유 시 critChance baseline 보존 (회귀 가드)', () => {
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 100, maxHp: 100, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [],
          skillChoices: {}, titles: [], stats: {},
      };
      const stats = calculateFullStats(player);
      // BALANCE.CRIT_CHANCE = 0.1, 최대 0.75 cap.
      assert.ok(stats.critChance >= 0.1 && stats.critChance <= 0.75,
          `synergy 미보유 baseline (${stats.critChance})`);
  });

  test('cycle 236 회귀 가드: synergy fixedDmg / killStack 처리 유지', async () => {
      const { CombatEngine } = await import('../src/systems/CombatEngine.js');
      // entropy_god fixedDmg 회귀 가드.
      const player = { name: 'Test', combatFlags: { turnCount: 1 }, status: [], relics: [] };
      const enemy = { name: '오크', hp: 1000, maxHp: 1000, atk: 50, def: 5 };
      const result = CombatEngine.applyEntropyTick(player, enemy, [
          { bonus: { effect: 'entropy_god', fixedDmg: 0.15, interval: 1 } },
      ]);
      assert.ok(result.enemy.hp < 1000, 'cycle 236 entropy_god fixedDmg 회귀 가드');
  });
}

// ─── 원본: tests/cycle-396-stats-panel-synergy-name-silent.test.js ───
{
  /**
   * cycle 396: StatsPanel `syn.name` silent undefined render 정리
   *   (cycle 222-395 silent dead config 시리즈 159번째 — silent dispatch lens 회귀).
   *
   * 발견 (1 silent undefined read):
   * - src/components/StatsPanel.tsx line 325-326: `<div key={syn.name} ...>{syn.name}</div>`.
   * - syn은 `stats.activeSynergies` (getActiveRelicSynergies 반환) — 즉 RELIC_SYNERGIES entry 그대로.
   * - RELIC_SYNERGIES entry 구조: `{ label, requires, bonus, desc }`. **`name` 필드 없음**.
   * - 결과: `syn.name`은 항상 undefined → React key 충돌 + UI에 시너지 이름 빈 칸 렌더.
   * - cycle 394 코멘트가 "syn.name 사용"이라고 잘못 추정한 부분 — 실제로는 silent UI 결손.
   *
   * 패턴 (cycle 222-395 시리즈 159번째):
   * - cycle 193 (SEASON_XP.codexDiscover dispatch 0건 fix) / cycle 218 (victory 사운드)
   *   silent dispatch lens 변형 — read 사이트는 있으나 producer 없어 결과 silent.
   * - cycle 396: StatsPanel render에서 정의된 필드(label) 대신 미정의(name)를 read.
   *
   * 수정 (src/components/StatsPanel.tsx):
   * - line 325 React key: `syn.name` → `syn.label`.
   * - line 326 표시 텍스트: `{syn.name}` → `{syn.label}`.
   *
   * 회귀 가드:
   * - getActiveRelicSynergies 동작 / RELIC_SYNERGIES schema (label) 보존.
   * - StatsPanel은 'cycle 394 RELIC_SYNERGIES id 0건'에 영향 없음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 396: StatsPanel syn.name 0건 (silent undefined 제거)', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      // synergy block 추출 — activeSynergies map 영역
      const blockStart = source.indexOf('stats.activeSynergies.map');
      const blockEnd = source.indexOf('</div>\n                    ))}', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/syn\.name/.test(block),
          'StatsPanel synergy 블록에서 syn.name 0건');
  });

  test('cycle 396: StatsPanel syn.label 사용 (fix 검증)', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      const blockStart = source.indexOf('stats.activeSynergies.map');
      const blockEnd = source.indexOf('</div>\n                    ))}', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(/syn\.label/.test(block),
          'syn.label로 변경됨');
      assert.ok(/syn\.desc/.test(block),
          'syn.desc 보존 (RELIC_SYNERGIES 필드)');
  });

  test('cycle 396: RELIC_SYNERGIES label 필드 producer 보존 (회귀 가드)', async () => {
      const { RELIC_SYNERGIES } = await import('../src/data/relics.js');
      for (const syn of RELIC_SYNERGIES) {
          assert.ok(typeof syn.label === 'string', `${syn.bonus?.effect || '?'} label string`);
          assert.equal(syn.name, undefined, 'name 필드는 RELIC_SYNERGIES에 미정의');
      }
  });

  test('cycle 395 회귀 가드: WEAPONLESS_ADVENTURER_SPRITES 0건 보존', async () => {
      const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
      assert.ok(!/WEAPONLESS_ADVENTURER_SPRITES/.test(source),
          'cycle 395 WEAPONLESS_ADVENTURER_SPRITES 0건 보존');
  });
}
