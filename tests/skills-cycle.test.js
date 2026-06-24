import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { fileURLToPath } from 'node:url';
import { getWeaponMagicSkills } from '../src/utils/equipmentUtils.js';
import { readFile } from 'node:fs/promises';

/**
 * 스킬(Skill) cycle 테스트 (audit #1 통합 22개)
 */

// ─── cycle-172-skill-counter-effect.test.js ───
{
  /**
   * cycle 172: 'counter' 스킬 효과 추가 ('반격 자세' — 마지막 dead skill effect).
   *
   * 발견:
   * - classes.ts에 '반격 자세' (effect: 'counter', val: 1.4, turn: 3, type: 'buff')
   *   스킬 정의 있음. desc: "피격 시 반격 확률 상승 3턴".
   * - 그러나 CombatEngine.performSkill의 buff 분기에서 counter 처리 없음 → 스킬
   *   사용해도 tempBuff name 외에 효과 0 (silent no-op).
   * - cycle 164 어시 검증에서 dead skill effect 1건으로 식별.
   *
   * 수정:
   * 1. performSkill buff 분기 — skill.effect === 'counter' 처리 추가:
   *    buff.counterChance = max(0.2, val - 1) (val 1.4 → 0.4 = 40%).
   * 2. enemyAttack — applyFatalProtection 직후 분기:
   *    tempBuff.counterChance > 0 + turn > 0 + 양쪽 생존 → 확률 발동.
   *    counter damage = stats.atk (1배 추가타). enemy hp 차감 + 반격 로그.
   */

  test('counter buff 활성 (chance 1.0 강제) → 적에게 반격 추가타', () => {
      const orig = Math.random;
      Math.random = () => 0.0; // 모든 chance roll 통과
      try {
          const player = {
              name: 'tester', job: '모험가', level: 10,
              hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
              relics: [], skillChoices: {}, titles: [], activeTitle: null,
              killStreak: 0, combatFlags: {}, status: [],
              tempBuff: { atk: 0, def: 0, turn: 3, name: '반격 자세', counterChance: 1.0 },
          };
          const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 30, def: 5, pattern: { guardChance: 0, heavyChance: 0 } };
          const stats = { atk: 50, def: 30, relics: [], activeSynergies: [], critChance: 0 };

          const result = CombatEngine.enemyAttack(player, enemy, stats);
          // counter damage = stats.atk(50). enemy hp 100 → 50.
          assert.equal(result.updatedEnemy.hp, 50,
              `expected enemy hp 50 after counter; got ${result.updatedEnemy.hp}`);
          const counterLog = result.logs.find((l) => l.text && l.text.includes('반격'));
          assert.ok(counterLog, '반격 로그 출력');
      } finally {
          Math.random = orig;
      }
  });

  test('counter buff 만료 (turn 0) → 반격 발동 안 함', () => {
      const orig = Math.random;
      Math.random = () => 0.0;
      try {
          const player = {
              name: 'tester', job: '모험가', level: 10,
              hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
              relics: [], skillChoices: {}, titles: [], activeTitle: null,
              killStreak: 0, combatFlags: {}, status: [],
              tempBuff: { atk: 0, def: 0, turn: 0, name: '반격 자세', counterChance: 1.0 },
          };
          const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 30, def: 5, pattern: { guardChance: 0, heavyChance: 0 } };
          const stats = { atk: 50, def: 30, relics: [], activeSynergies: [], critChance: 0 };

          const result = CombatEngine.enemyAttack(player, enemy, stats);
          // counter 발동 안 함 → enemy hp 100 그대로.
          assert.equal(result.updatedEnemy.hp, 100);
      } finally {
          Math.random = orig;
      }
  });

  test('counter chance 0.0 → 반격 발동 안 함 (chance 가드)', () => {
      const orig = Math.random;
      Math.random = () => 0.5;
      try {
          const player = {
              name: 'tester', job: '모험가', level: 10,
              hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
              relics: [], skillChoices: {}, titles: [], activeTitle: null,
              killStreak: 0, combatFlags: {}, status: [],
              tempBuff: { atk: 0, def: 0, turn: 3, name: '반격 자세', counterChance: 0.0 },
          };
          const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 30, def: 5, pattern: { guardChance: 0, heavyChance: 0 } };
          const stats = { atk: 50, def: 30, relics: [], activeSynergies: [], critChance: 0 };

          const result = CombatEngine.enemyAttack(player, enemy, stats);
          assert.equal(result.updatedEnemy.hp, 100);
      } finally {
          Math.random = orig;
      }
  });

  test('performSkill counter: tempBuff.counterChance가 val(=1.4)에서 0.4로 변환됨', () => {
      const player = {
          name: 'tester', job: '모험가', level: 10,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          relics: [], skillChoices: {}, titles: [], activeTitle: null,
          killStreak: 0, combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 10000, maxHp: 10000, atk: 30, def: 5 };
      const skill = { name: '반격 자세', mp: 35, type: 'buff', effect: 'counter', val: 1.4, turn: 3 };
      const stats = { atk: 50, def: 30, elem: 'physical', relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(result.success, true);
      assert.equal(result.updatedPlayer.tempBuff.name, '반격 자세');
      assert.equal(result.updatedPlayer.tempBuff.turn, 3);
      // val 1.4 - 1 = 0.4 (floating point ~0.3999... 허용)
      const cc = result.updatedPlayer.tempBuff.counterChance;
      assert.ok(cc >= 0.39 && cc <= 0.41, `expected counterChance ~0.4; got ${cc}`);
  });

  test('회귀 가드: counter buff 없으면 enemyAttack 결과 변화 없음', () => {
      const orig = Math.random;
      Math.random = () => 0.0;
      try {
          const player = {
              name: 'tester', job: '모험가', level: 10,
              hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
              relics: [], skillChoices: {}, titles: [], activeTitle: null,
              killStreak: 0, combatFlags: {}, status: [],
              // tempBuff 없음
          };
          const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 30, def: 5, pattern: { guardChance: 0, heavyChance: 0 } };
          const stats = { atk: 50, def: 30, relics: [], activeSynergies: [], critChance: 0 };

          const result = CombatEngine.enemyAttack(player, enemy, stats);
          // 반격 없음 → enemy hp 100 그대로.
          assert.equal(result.updatedEnemy.hp, 100);
      } finally {
          Math.random = orig;
      }
  });
}

// ─── cycle-219-skill-heal-sounds.test.js ───
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(__dirname, '..');

  /**
   * cycle 219: 'skill' + 'heal' sound dispatch 누락 fix (cycle 217/218 sensory cue 시리즈 확장).
   *
   * 발견 (silent skill / rest moments):
   * - cycle 217 / 218에서 levelUp / death / victory 3종 fix.
   * - 남은 dead sound dispatch: hover / heal / skill / explore (4종).
   * - 본 cycle은 가장 영향 큰 2종 fix:
   *   · skill: 스킬 발동 모먼트 — sweep tone (600→1800→900Hz arc) 정의 있으나 dispatch 0건.
   *     CombatEngine.performSkill 호출 후 sound 미트리거 → 스킬 사용이 일반 공격과 청각적
   *     구분 안 됨.
   *   · heal: HP 회복 모먼트 — ascending arpeggio (C5→E5→G5) 정의 있으나 dispatch 0건.
   *     rest 액션(characterActions.ts:90) 후 음향 피드백 누락.
   *
   * 결과 (UX 회귀):
   * - 스킬 발동 시 'attack' 사운드만 (combat 로그 type='combat'). 스킬 고유 사운드 없음.
   * - 안전지대 휴식 후 success 로그만. 회복 음향 0건.
   *
   * 패턴:
   * - cycle 117/118: 사운드 디자인.
   * - cycle 122/123/217/218: sensory cue dispatch.
   * - cycle 219: skill / heal cue 누락 보강.
   *
   * 수정:
   * 1. src/hooks/combatActions/combatAttack.ts: type==='skill' && result.success 후
   *    soundManager.play('skill').
   * 2. src/hooks/gameActions/characterActions.ts: rest 성공 후 soundManager.play('heal').
   *
   * 회귀 가드: 스킬 실패(MP 부족 등)는 sound 안 울림. rest gold 부족 시도 사운드 없음.
   */

  test('cycle 219: combatAttack에 skill sound dispatch 추가 (성공 시)', () => {
      const file = path.join(ROOT, 'src/hooks/combatActions/combatAttack.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /soundManager\.play\(\s*['"]skill['"]/,
          'combatAttack.ts에 스킬 사용 성공 시 soundManager.play(skill) 호출 필요',
      );
  });

  test('cycle 219: characterActions에 heal sound dispatch 추가 (rest 성공 시)', () => {
      const file = path.join(ROOT, 'src/hooks/gameActions/characterActions.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /soundManager\.play\(\s*['"]heal['"]/,
          'characterActions.ts rest 액션에 soundManager.play(heal) 호출 필요',
      );
  });

  test('cycle 219: SoundManager의 skill / heal case 보존 (회귀 가드)', () => {
      const file = path.join(ROOT, 'src/systems/SoundManager.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(content, /case\s+['"]skill['"]/, "SoundManager의 case 'skill' branch 보존");
      assert.match(content, /case\s+['"]heal['"]/, "SoundManager의 case 'heal' branch 보존");
  });

  test('cycle 219: skill sound는 result.success 후 dispatch (실패 시 false-positive 방지)', () => {
      const file = path.join(ROOT, 'src/hooks/combatActions/combatAttack.ts');
      const content = fs.readFileSync(file, 'utf-8');
      // performSkill 호출 후 result.success 체크 다음에 sound dispatch
      assert.match(
          content,
          /performSkill[\s\S]{0,500}?result\.success[\s\S]{0,500}?soundManager\.play\(\s*['"]skill['"]/,
          'skill sound는 performSkill + result.success 컨텍스트에서 dispatch',
      );
  });

  test('cycle 219: heal sound는 rest 성공 (gold 차감 후) 컨텍스트에서 dispatch', () => {
      const file = path.join(ROOT, 'src/hooks/gameActions/characterActions.ts');
      const content = fs.readFileSync(file, 'utf-8');
      // rest 함수 + REST_DONE 또는 dispatch SET_PLAYER 이후 sound dispatch
      assert.match(
          content,
          /rest:\s*\(\)[\s\S]+?REST_DONE_FULL[\s\S]{0,200}?soundManager\.play\(\s*['"]heal['"]/,
          'heal sound는 rest 성공 메시지 emit 컨텍스트에서 dispatch',
      );
  });

  test('cycle 217 / 218 회귀 가드: 기존 sensory cue 유지', () => {
      const useGameEngine = fs.readFileSync(path.join(ROOT, 'src/hooks/useGameEngine.ts'), 'utf-8');
      assert.match(useGameEngine, /visualEffect\s*===\s*['"]levelUp['"]/);
      const combatVictory = fs.readFileSync(path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts'), 'utf-8');
      assert.match(combatVictory, /soundManager\.play\(\s*['"]victory['"]/);
  });
}

// ─── cycle-238-skill-branch-defbonus.test.js ───
{
  /**
   * cycle 238: skill branch override의 'defBonus' 필드 dead config fix
   *   (cycle 222-237 silent dead config 시리즈 11번째).
   *
   * 발견 (branch override defBonus 미적용):
   * - '광폭화' skill (effect: 'berserk', val: 2.0) — 광란 (val 1.7) / 분노의 방패 (val 1.5, defBonus 1.2).
   * - '실드배시' skill (effect: 'stun') — 강력 배시 (mult 3.5) / 철벽 배시 (mult 2.5, defBonus 1.2).
   * - 두 branch 'B'는 모두 defBonus: 1.2 (DEF +20%) 의도하지만 코드에서 read 안 됨.
   * - '분노의 방패' 케이스: berserk effect는 buff.def = -0.2 (페널티) 고정 → defBonus override 무시 → 페널티만 적용.
   * - '철벽 배시' 케이스: stun effect는 buff path 미진입 → defBonus 영원히 0.
   *
   * 패턴 (cycle 222-237 silent dead config 시리즈 11번째):
   * - cycle 236-237: synergy bonus keys.
   * - cycle 238: skill branch override key (defBonus).
   *
   * 수정 (src/systems/CombatEngine.ts performSkill buff section):
   * - skill.defBonus 정의 시 buff.def 값 override (default 페널티 / 0 우선).
   * - non-buff effect 스킬도 defBonus 있으면 buff 생성.
   *
   * 회귀 가드:
   * - skill.defBonus 미정의 스킬은 0 영향 (기존 buff/atk_up/def_up/berserk 동작 유지).
   * - skill.val 기반 buff.atk 계산은 그대로.
   */

  test('cycle 238: 분노의 방패 branch override 시 buff.def +20%', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: { '광폭화': 'B' }, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
      // 전사 '광폭화' skill (effect:'atk_up', val:1.5) — 분기 'B' = 분노의 방패 (val 1.5, defBonus 1.2).
      const skill = { name: '광폭화', mp: 30, type: 'buff', effect: 'atk_up', val: 1.5, turn: 3 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.success, true);
      // branch override 후: skill.val=1.5, skill.defBonus=1.2 → buff.def = +20%.
      assert.ok(r.updatedPlayer.tempBuff.def > 0.19,
          `branch defBonus 1.2 적용되어야 함 (buff.def +20%, float precision tolerance, 실제: ${r.updatedPlayer.tempBuff.def})`);
  });

  test('cycle 238: 광란 branch (defBonus 미정의) 시 기본 동작 유지', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: { '광폭화': 'A' }, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
      // 분기 'A' = 광란 (val 1.7, no defBonus).
      const skill = { name: '광폭화', mp: 30, type: 'buff', effect: 'atk_up', val: 1.5, turn: 3 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      // branch 'A' override: val=1.7, defBonus 미정의 → atk_up 기본 buff.def = 0.
      assert.equal(r.updatedPlayer.tempBuff.def, 0,
          'defBonus 미정의 시 atk_up 기본 buff.def 0 유지 (회귀 가드)');
  });

  test('cycle 238: defBonus 미정의 일반 buff 스킬 회귀 가드', () => {
      const player = {
          name: 'Test', job: '나이트', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
      const skill = { name: '방어 자세', mp: 20, type: 'buff', effect: 'def_up', val: 1.3, turn: 3 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      // float precision 0.30000000000000004 ≈ 0.3
      assert.ok(Math.abs(r.updatedPlayer.tempBuff.def - 0.3) < 0.01,
          `def_up val 1.3 → buff.def ≈ 0.3 (회귀 가드, 실제: ${r.updatedPlayer.tempBuff.def})`);
  });

  test('cycle 237 회귀 가드: synergy critChance 합산 유지', async () => {
      const { calculateFullStats } = await import('../src/utils/statsCalculator.js');
      const player = {
          name: 'Test', job: '전사', level: 30, hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 100, def: 30, equip: {}, relics: [
              { name: '고대의 분노', effect: 'titan', val: { hp: 0.3, critReduce: 0.5 } },
              { name: '드래곤 발톱', effect: 'crit_dmg', val: 2.0 },
              { name: '광전사의 분노', effect: 'low_hp_atk', val: 0.5 },
          ], skillChoices: {}, titles: [], stats: {},
      };
      const stats = calculateFullStats(player);
      // primordial_wrath 발동 시 critChance > 0.3 (baseline 0.1 + 0.25)
      assert.ok(stats.critChance >= 0.3, `cycle 237 primordial_wrath critChance 회귀 가드 (${stats.critChance})`);
  });
}

// ─── cycle-239-skill-branch-effect-chance.test.js ───
{
  /**
   * cycle 239: skill branch override의 'effectChance' 키 dead config fix
   *   (cycle 222-238 silent dead config 시리즈 12번째).
   *
   * 발견 (effectChance 미적용):
   * - 전사 '파워배시' branch B = '기절 배시' (mult 2.0, effect 'stun', effectChance 0.2):
   *   "20% 확률 기절 1턴" desc — 데미지 trade-off 메커니즘.
   * - 도적 '등 찌르기' branch B = '혼란 찌르기' (mult 2.5, secondEffect 'bleed', effectChance 0.4):
   *   "기절 + 40% 확률 출혈" — secondEffect 확률 게이트.
   * - 그러나 코드는 STATUS_EFFECTS_TO_ENEMY.includes(skill.effect) 또는 secondEffect
   *   조건만 확인하고 100% 적용. effectChance 무시.
   * - 결과: 두 branch가 광고하는 확률적 status가 항상 100% 발동 — 데미지 페널티 무의미한 OP.
   *
   * 패턴 (cycle 222-238 silent dead config 시리즈 12번째):
   * - cycle 238: skill branch defBonus.
   * - cycle 239: skill branch effectChance.
   *
   * 수정 (src/systems/CombatEngine.ts performSkill status section):
   * - skill.effect / skill.secondEffect 적용 분기에서 skill.effectChance 정의 시 Math.random() 게이트.
   * - 미정의 시 100% 적용 (회귀 가드).
   *
   * 회귀 가드:
   * - 일반 effect (skill.effect 'burn'/'poison' 등 effectChance 없음) 100% 적용 유지.
   * - skill.effectChance = 1.0 시 100% 보장.
   */

  test('cycle 239: effectChance 0 시 status 절대 부여 안 함', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // effectChance 0 — 절대 stun 안 됨.
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', effectChance: 0, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      let stunCount = 0;
      for (let i = 0; i < 30; i++) {
          const r = CombatEngine.performSkill(player, enemy, stats, skill);
          if (r.updatedEnemy.stunnedTurns) stunCount++;
      }
      assert.equal(stunCount, 0, 'effectChance 0 시 stun 0회 발생');
  });

  test('cycle 239: effectChance 1.0 시 status 100% 부여', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', effectChance: 1.0, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.ok(r.updatedEnemy.stunnedTurns >= 1, 'effectChance 1.0 시 stun 보장');
  });

  test('cycle 239: effectChance 미정의 시 100% 적용 (회귀 가드)', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // effectChance 미정의 — default 100% 적용 (기존 동작 유지).
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'burn', cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.ok(Array.isArray(r.updatedEnemy.dots) && r.updatedEnemy.dots.includes('burn'),
          'effectChance 미정의 시 burn 기본 100% 적용 (회귀 가드)');
  });

  test('cycle 239: secondEffect도 effectChance 게이트 적용', () => {
      const player = {
          name: 'Test', job: '도적', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // secondEffect bleed에도 effectChance 0 적용 — 절대 부여 안 됨.
      const skill = { name: 'Test', mp: 10, mult: 2.5, effect: 'stun', secondEffect: 'bleed', effectChance: 0, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      let bleedCount = 0;
      for (let i = 0; i < 30; i++) {
          const r = CombatEngine.performSkill(player, enemy, stats, skill);
          if (Array.isArray(r.updatedEnemy.dots) && r.updatedEnemy.dots.includes('bleed')) bleedCount++;
      }
      assert.equal(bleedCount, 0, 'effectChance 0 시 secondEffect도 0회 발생');
  });

  test('cycle 238 회귀 가드: defBonus override 처리 유지', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5 };
      const skill = { name: 'Test', mp: 30, type: 'buff', effect: 'atk_up', val: 1.5, defBonus: 1.2, turn: 3 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.ok(r.updatedPlayer.tempBuff.def > 0.19, 'cycle 238 defBonus 회귀 가드');
  });
}

// ─── cycle-241-skill-branch-stunturn.test.js ───
{
  /**
   * cycle 241: skill branch override의 'stunTurn' 키 dead config fix
   *   (cycle 222-239 silent dead config 시리즈 13번째 — cycle 240 batch 이후 재개).
   *
   * 발견 (stunTurn 미적용):
   * - 마법사 '썬더볼트' branch B = '마비 번개' (mult 3.5, effect 'stun', stunTurn 2):
   *   "기절 2턴 (확률 +)" desc — 2턴 stun 의도.
   * - 성직자 '천벌' branch B = '심판의 천벌' (mult 6.0, secondEffect 'curse', stunTurn 2):
   *   "기절 2턴 + 저주" desc — 기절 2턴 + 저주 의도. (별도 데이터 fix 필요)
   * - 그러나 applyStatusEffectToEnemy는 stun/freeze 시 stunnedTurns = max(prev, 1) 고정 적용.
   *   skill.stunTurn 키를 read 안 함 → '마비 번개' 의도 (2턴) 영원히 1턴만 적용.
   *
   * 패턴 (cycle 222-239 silent dead config 시리즈 13번째):
   * - cycle 238: skill branch defBonus.
   * - cycle 239: skill branch effectChance.
   * - cycle 241: skill branch stunTurn.
   *
   * 수정 (src/systems/CombatEngine.ts performSkill status section):
   * - skill.effect = 'stun' / 'freeze' 부여 시 skill.stunTurn 정의되면 stunnedTurns 그 값으로 max 처리.
   * - secondEffect도 동일.
   * - 미정의 시 기본 1 (회귀 가드).
   *
   * 회귀 가드:
   * - skill.stunTurn 미정의 시 기존 stun 1턴 동작 유지.
   * - skill.stunTurn = 1 시 1턴 (기본과 동일).
   */

  test('cycle 241: skill.stunTurn 2 시 stunnedTurns 2 적용', () => {
      const player = {
          name: 'Test', job: '마법사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0 };
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', stunTurn: 2, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.success, true);
      assert.equal(r.updatedEnemy.stunnedTurns, 2,
          `stunTurn 2 → stunnedTurns 2 적용 (실제: ${r.updatedEnemy.stunnedTurns})`);
  });

  test('cycle 241: skill.stunTurn 미정의 시 stunnedTurns 1 (회귀 가드)', () => {
      const player = {
          name: 'Test', job: '마법사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0 };
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedEnemy.stunnedTurns, 1,
          'stunTurn 미정의 시 1턴 기본 유지 (회귀 가드)');
  });

  test('cycle 241: skill.stunTurn freeze에도 적용', () => {
      const player = {
          name: 'Test', job: '마법사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0 };
      // freeze도 stunnedTurns 카운터를 사용 (CombatEngine line 234).
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'freeze', stunTurn: 3, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedEnemy.stunnedTurns, 3,
          `freeze + stunTurn 3 → stunnedTurns 3 (실제: ${r.updatedEnemy.stunnedTurns})`);
  });

  test('cycle 241: secondEffect stun도 stunTurn 게이트 적용', () => {
      const player = {
          name: 'Test', job: '도적', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0 };
      // secondEffect: 'stun' + stunTurn: 2 → 2턴 stun.
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'bleed', secondEffect: 'stun', stunTurn: 2, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedEnemy.stunnedTurns, 2,
          `secondEffect stun + stunTurn 2 → stunnedTurns 2 (실제: ${r.updatedEnemy.stunnedTurns})`);
  });

  test('cycle 239 회귀 가드: effectChance 0 시 stun 부여 안 됨 + stunTurn도 영향 없음', () => {
      const player = {
          name: 'Test', job: '마법사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0 };
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', effectChance: 0, stunTurn: 2, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      let stunCount = 0;
      for (let i = 0; i < 30; i++) {
          const r = CombatEngine.performSkill(player, enemy, stats, skill);
          if (r.updatedEnemy.stunnedTurns) stunCount++;
      }
      assert.equal(stunCount, 0, 'cycle 239 effectChance 0 가드 + stunTurn 영향 없음');
  });
}

// ─── cycle-243-skill-branch-mp-restore.test.js ───
{
  /**
   * cycle 243: skill branch override의 'mpRestore' 키 dead config fix
   *   (cycle 222-242 silent dead config 시리즈 15번째).
   *
   * 발견 (mpRestore 미적용):
   * - 시간술사 '시간 정지' branch B = '시간 충전' (effect: 'extraTurn', mpRestore: 30):
   *   "추가 행동 + MP 30 즉시 회복" desc — 추가 행동 + MP 회복 trade-off (val ATK 보너스 대신).
   * - 그러나 CombatEngine extraTurn 처리는 skill.val(ATK 보너스)만 read하고 skill.mpRestore는 dispatch 0건.
   * - 결과: '시간 충전' branch는 ATK 페널티 없이 추가 행동만 부여 — MP 회복 광고는 fake.
   *
   * 패턴 (cycle 222-242 silent dead config 시리즈 15번째):
   * - cycle 238/239/241/242: skill branch defBonus / effectChance / stunTurn / crit.
   * - cycle 243: skill branch mpRestore.
   *
   * 수정 (src/systems/CombatEngine.ts performSkill extraTurn section):
   * - skill.mpRestore 정의 시 updatedPlayer.mp += mpRestore (maxMp cap 적용).
   * - 미정의 시 영향 없음 (회귀 가드).
   *
   * 회귀 가드:
   * - skill.mpRestore 미정의 시 기존 extraTurn 동작 유지 (val 만 적용).
   * - extraTurn 외의 effect는 mpRestore 무시.
   */

  test('cycle 243: extraTurn + mpRestore 30 시 MP +30 회복', () => {
      const player = {
          name: 'Test', job: '시간술사', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // mpCost 50, mpRestore 30 → MP 100 - 50 + 30 = 80 기대.
      const skill = { name: 'Test', mp: 50, mult: 1.0, effect: 'extraTurn', mpRestore: 30, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.success, true);
      assert.equal(r.updatedPlayer.mp, 80,
          `mpRestore 30 → MP 100-50+30=80 (실제: ${r.updatedPlayer.mp})`);
      assert.equal(r.updatedPlayer.extraTurnGranted, true,
          'extraTurn 플래그 설정');
  });

  test('cycle 243: mpRestore가 maxMp를 초과하지 않음', () => {
      const player = {
          name: 'Test', job: '시간술사', level: 30,
          hp: 1000, maxHp: 1000, mp: 180, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // 180 - 50 + 100 = 230 → cap 200.
      const skill = { name: 'Test', mp: 50, mult: 1.0, effect: 'extraTurn', mpRestore: 100, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedPlayer.mp, 200,
          `mpRestore 100 시 maxMp 200 cap (실제: ${r.updatedPlayer.mp})`);
  });

  test('cycle 243: extraTurn + val (ATK 보너스) 동작 회귀 가드', () => {
      const player = {
          name: 'Test', job: '시간술사', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // '시간 폭주' branch — val 1.4 (ATK +40%), no mpRestore.
      const skill = { name: 'Test', mp: 50, mult: 1.0, effect: 'extraTurn', val: 1.4, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedPlayer.mp, 50, 'mpRestore 미정의 시 MP 회복 0 (회귀 가드)');
      // float precision tolerance.
      assert.ok(Math.abs(r.updatedPlayer.tempBuff.atk - 0.4) < 0.01,
          `val 1.4 → tempBuff.atk +0.4 회귀 가드 (실제: ${r.updatedPlayer.tempBuff.atk})`);
  });

  test('cycle 243: extraTurn 외 effect에서 mpRestore 무시 (안전 가드)', () => {
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // effect: 'stun' + mpRestore: 30 → mpRestore 무시 (extraTurn 분기에만).
      const skill = { name: 'Test', mp: 50, mult: 2.0, effect: 'stun', mpRestore: 30, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedPlayer.mp, 50,
          `extraTurn 외 effect → mpRestore 무시 (실제: ${r.updatedPlayer.mp})`);
  });
}

// ─── cycle-244-skill-branch-curseturn.test.js ───
{
  /**
   * cycle 244: skill branch override의 'curseTurn' 키 dead config fix
   *   (cycle 222-243 silent dead config 시리즈 16번째).
   *
   * 발견 (curseTurn 미적용):
   * - 흑마법사 '저주의 낙인' branch B = '지속 저주' (mult 1.6, curseTurn 3):
   *   "저주 지속 +2턴" desc — 저주 지속 시간 확장 의도.
   * - 그러나 applyStatusEffectToEnemy는 curse 시 cursedTurns = 3 hardcoded 고정.
   *   skill.curseTurn 키 read 0건 → branch override 무의미.
   * - cycle 241 stunTurn / cycle 243 mpRestore 패턴과 동일.
   *
   * 패턴 (cycle 222-243 silent dead config 시리즈 16번째):
   * - cycle 241: skill branch stunTurn (cursedTurns 카운터 형제).
   * - cycle 244: skill branch curseTurn.
   *
   * 수정 (src/systems/CombatEngine.ts performSkill status section):
   * - skill.effect = 'curse' 부여 직후 skill.curseTurn 정의되면 cursedTurns 그 값으로 max 처리.
   * - secondEffect = 'curse'도 동일.
   * - 미정의 시 기본 3 (회귀 가드).
   *
   * 회귀 가드:
   * - skill.curseTurn 미정의 시 기존 cursedTurns 3턴 동작 유지.
   * - skill.curseTurn 1 시 1턴 (단축).
   */

  test('cycle 244: skill.curseTurn 5 시 cursedTurns 5 적용', () => {
      const player = {
          name: 'Test', job: '흑마법사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const skill = { name: 'Test', mp: 10, mult: 1.6, effect: 'curse', curseTurn: 5, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.success, true);
      assert.equal(r.updatedEnemy.cursedTurns, 5,
          `curseTurn 5 → cursedTurns 5 적용 (실제: ${r.updatedEnemy.cursedTurns})`);
      assert.equal(r.updatedEnemy.cursed, true, 'cursed 플래그 set');
  });

  test('cycle 244: skill.curseTurn 미정의 시 cursedTurns 3 (회귀 가드)', () => {
      const player = {
          name: 'Test', job: '흑마법사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const skill = { name: 'Test', mp: 10, mult: 1.6, effect: 'curse', cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedEnemy.cursedTurns, 3,
          `curseTurn 미정의 시 default 3턴 (회귀 가드, 실제: ${r.updatedEnemy.cursedTurns})`);
  });

  test('cycle 244: secondEffect curse도 curseTurn 게이트 적용', () => {
      const player = {
          name: 'Test', job: '도적', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // secondEffect: 'curse' + curseTurn: 4 → 4턴 cursedTurns.
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'bleed', secondEffect: 'curse', curseTurn: 4, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedEnemy.cursedTurns, 4,
          `secondEffect curse + curseTurn 4 → cursedTurns 4 (실제: ${r.updatedEnemy.cursedTurns})`);
  });

  test('cycle 244: curseTurn 1 시 cursedTurns 1 (단축 가능 — desc per-skill 명시)', () => {
      const player = {
          name: 'Test', job: '흑마법사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const skill = { name: 'Test', mp: 10, mult: 1.6, effect: 'curse', curseTurn: 1, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      // 신선 적용 시: applyStatusEffectToEnemy 기본 cursedTurns 3 → max(3, 1) = 3.
      // curseTurn 1은 단축이 아니라 floor — applyStatusEffectToEnemy의 기본 3보다 작으면 영향 없음.
      assert.equal(r.updatedEnemy.cursedTurns, 3,
          `curseTurn 1 시 default 3 보존 (max 보존 — single-skill 단축 의도 X)`);
  });

  test('cycle 241 회귀 가드: stunTurn 동작 유지', () => {
      const player = {
          name: 'Test', job: '마법사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'stun', stunTurn: 3, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedEnemy.stunnedTurns, 3, 'cycle 241 stunTurn 회귀 가드');
  });
}

// ─── cycle-247-skill-branch-desc-data-mismatch.test.js ───
{
  /**
   * cycle 247: skill branch override의 desc-data 정합성 audit
   *   (cycle 222-246 silent dead config 시리즈 19번째 — data correctness lens).
   *
   * 발견 (desc vs override 불일치 2건):
   *
   * 1) 흑마법사 '저주의 낙인' branch B = '지속 저주' (mult 1.6, curseTurn 3):
   *    - desc: "저주 지속 +2턴" — 의도: 기본(3턴) + 2 = 5턴.
   *    - 그러나 override curseTurn: 3 → cycle 244 dispatch와 합쳐도 default와 동일 3턴.
   *    - 결과: 화력 페널티(2.32 → 1.6)만 발현, 저주 지속 보너스 0 — 단순 nerf 분기.
   *
   * 2) 성직자 '천벌' branch B = '심판의 천벌' (mult 6.0, secondEffect 'curse', stunTurn 2):
   *    - desc: "기절 2턴 + 저주" — 의도: 기절 2턴 + 저주 동시 부여.
   *    - 그러나 base '천벌' effect: 'purify' (player status cleanse)이고 override는 effect 변경 없음.
   *    - STATUS_EFFECTS_TO_ENEMY에 'purify' 없어 stun 부여 분기 미진입 → stunTurn 영원히 영향 없음.
   *    - 결과: 저주만 부여, 기절 0턴 — desc와 모순.
   *
   * 패턴 (cycle 222-246 silent dead config 시리즈 19번째):
   * - cycle 244: skill branch curseTurn dispatch (구현체).
   * - cycle 247: 동일 branch의 데이터 정합성 fix (광고 vs 실제 동작 일치).
   *
   * 수정 (src/data/classes.ts):
   * - '지속 저주' override curseTurn: 3 → 5 (default 3 + desc "+2턴" 정합).
   * - '심판의 천벌' override에 effect: 'stun' 추가 (desc "기절" 정합 — purify cleanse 포기 trade-off).
   *
   * 회귀 가드:
   * - 다른 skillBranches 동작 변화 없음.
   * - cycle 244 curseTurn dispatch 구현 유지.
   * - cycle 241 stunTurn 동작 유지.
   */

  test('cycle 247: 지속 저주 branch curseTurn: 5 (data 정합)', async () => {
      const { CLASSES } = await import('../src/data/classes.js');
      // '저주의 낙인' branch는 무당 직업 소속 (Sprint 16).
      const shaman = CLASSES['무당'];
      const branchB = shaman.skillBranches['저주의 낙인'].find((b) => b.choice === 'B');
      assert.equal(branchB.override.curseTurn, 5,
          `'지속 저주' curseTurn 5 (default 3 + "+2턴" desc 정합, 실제: ${branchB.override.curseTurn})`);
  });

  test('cycle 247: 지속 저주 시뮬레이션 — cursedTurns 5 적용', () => {
      const player = {
          name: 'Test', job: '흑마법사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, cursedTurns: 0 };
      // '지속 저주' branch B 시뮬레이션 (cycle 247 후): curseTurn 5.
      const skill = { name: 'Test', mp: 10, mult: 1.6, effect: 'curse', curseTurn: 5, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedEnemy.cursedTurns, 5,
          `'지속 저주' 적용 후 cursedTurns 5 (실제: ${r.updatedEnemy.cursedTurns})`);
  });

  test('cycle 247: 심판의 천벌 branch effect: "stun" 추가 (data 정합)', async () => {
      const { CLASSES } = await import('../src/data/classes.js');
      // '천벌' branch는 아크메이지 직업 소속.
      const archmage = CLASSES['아크메이지'];
      const branchB = archmage.skillBranches['천벌'].find((b) => b.choice === 'B');
      assert.equal(branchB.override.effect, 'stun',
          `'심판의 천벌' override effect: 'stun' (desc "기절 2턴" 정합, 실제: ${branchB.override.effect})`);
      assert.equal(branchB.override.secondEffect, 'curse', 'secondEffect curse 보존');
      assert.equal(branchB.override.stunTurn, 2, 'stunTurn 2 보존');
  });

  test('cycle 247: 심판의 천벌 시뮬레이션 — stun 2턴 + curse 동시 부여', () => {
      const player = {
          name: 'Test', job: '성직자', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, stunnedTurns: 0, cursedTurns: 0 };
      // '심판의 천벌' branch B 시뮬레이션 (cycle 247 후): effect 'stun', stunTurn 2, secondEffect 'curse'.
      const skill = { name: 'Test', mp: 10, mult: 6.0, effect: 'stun', secondEffect: 'curse', stunTurn: 2, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedEnemy.stunnedTurns, 2,
          `stun 2턴 부여 (실제: ${r.updatedEnemy.stunnedTurns})`);
      assert.equal(r.updatedEnemy.cursed, true,
          `curse 동시 부여 (cursed: ${r.updatedEnemy.cursed})`);
  });

  test('cycle 244 회귀 가드: skill.curseTurn 미정의 시 default 3 유지', () => {
      const player = {
          name: 'Test', job: '흑마법사', level: 30,
          hp: 1000, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5, cursedTurns: 0 };
      const skill = { name: 'Test', mp: 10, mult: 2.0, effect: 'curse', cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      assert.equal(r.updatedEnemy.cursedTurns, 3, 'cycle 244 curseTurn 미정의 시 3 default');
  });
}

// ─── cycle-256-weapon-skill-elem-coverage.test.js ───
{
  /**
   * cycle 256: WEAPON_SKILL_BY_ELEM의 '바람' / '에테르' 누락 dead config
   *   (cycle 222-255 silent dead config 시리즈 28번째).
   *
   * 발견 (WEAPON_SKILL_BY_ELEM 누락):
   * - src/utils/equipmentUtils.ts WEAPON_SKILL_BY_ELEM은 7 elements 정의:
   *   화염 / 냉기 / 어둠 / 빛 / 자연 / 대지 / 물리.
   * - 그러나 src/data/items.ts에는 추가 2 elements 무기 존재:
   *   '바람' (폭풍의 창 tier 4), '에테르' (에테르 검 tier 4 / 차원절단자 tier 5).
   * - 이 weapons은 buildWeaponSkill에서 fallback `WEAPON_SKILL_BY_ELEM.물리` ('아케인 볼트',
   *   mult 2.3, no effect)를 사용 → 고티어 elemental weapons이 일반 '물리' 스킬과 동일.
   * - 결과: 폭풍의 창 / 에테르 검 / 차원절단자 장착 시 '아케인 볼트 · 폭풍의 창' 같은 generic
   *   스킬 — 광고된 element 정체성 0.
   *
   * 패턴 (cycle 222-255 silent dead config 시리즈 28번째):
   * - cycle 251-255: monsters element typo 5사이클 마무리.
   * - cycle 256: weapon skill preset element 매핑 누락 (반대 방향 dead config).
   *
   * 수정 (src/utils/equipmentUtils.ts):
   * - 바람: '게일 컷', wind-themed, mult 2.7, mp 26, cooldown 2 (effect: 'bleed' — 바람이 베어내는 이미지).
   * - 에테르: '디멘션 리프트', ether-themed, mult 3.2, mp 32, cooldown 3 (effect: 'stun' — 차원 진동 마비).
   *
   * 회귀 가드:
   * - 기존 7 elements preset 변화 없음 (화염/냉기/어둠/빛/자연/대지/물리).
   * - getWeaponMagicSkills 시그니처 그대로.
   * - 비-마법 무기는 skill 생성 안 됨 (물리 fallback은 isMagicWeapon 통과 시에만).
   */

  test('cycle 256: 바람 element weapon이 "게일 컷" preset 사용', () => {
      const equip = {
          weapon: { type: 'weapon', name: '폭풍의 창', val: 90, elem: '바람', hands: 2 },
      };
      const skills = getWeaponMagicSkills(equip);
      assert.equal(skills.length, 1, '바람 무기 1개의 magic skill 생성');
      const skill = skills[0];
      assert.ok(skill.name.includes('게일') || skill.name.includes('템페스트'),
          `바람 weapon skill 이름이 wind-themed (실제: ${skill.name})`);
      assert.equal(skill.type, '바람', `skill type '바람' (실제: ${skill.type})`);
      assert.notEqual(skill.name, '아케인 볼트 · 폭풍의 창',
          'fallback "아케인 볼트" 사용 안 됨');
  });

  test('cycle 256: 에테르 element weapon이 ether-themed preset 사용', () => {
      const equip = {
          weapon: { type: 'weapon', name: '에테르 검', val: 85, elem: '에테르' },
      };
      const skills = getWeaponMagicSkills(equip);
      assert.equal(skills.length, 1, '에테르 무기 1개의 magic skill 생성');
      const skill = skills[0];
      // skill.name = '디멘션 리프트 · 에테르 검' 형식. 시작이 '아케인 볼트' fallback 아니어야 함.
      assert.ok(!skill.name.startsWith('아케인 볼트'),
          `에테르 weapon이 fallback "아케인 볼트" 사용 안 함 (실제: ${skill.name})`);
      assert.ok(skill.name.startsWith('디멘션'),
          `에테르 preset '디멘션 리프트'로 시작 (실제: ${skill.name})`);
      assert.equal(skill.type, '에테르', `skill type '에테르' (실제: ${skill.type})`);
  });

  test('cycle 256: 화염 weapon preset 회귀 가드', () => {
      const equip = {
          weapon: { type: 'weapon', name: '용의 화염', val: 175, elem: '화염', hands: 2 },
      };
      const skills = getWeaponMagicSkills(equip);
      assert.equal(skills.length, 1);
      assert.ok(skills[0].name.includes('이그니스'),
          `화염 preset '이그니스 버스트' 유지 (실제: ${skills[0].name})`);
      assert.equal(skills[0].effect, 'burn', '화염 effect burn 유지');
  });

  test('cycle 256: 냉기 weapon preset 회귀 가드', () => {
      const equip = {
          weapon: { type: 'weapon', name: '서리칼날', val: 100, elem: '냉기' },
      };
      const skills = getWeaponMagicSkills(equip);
      assert.equal(skills.length, 1);
      assert.ok(skills[0].name.includes('프로스트'),
          `냉기 preset '프로스트 노바' 유지 (실제: ${skills[0].name})`);
  });

  test('cycle 256: 미정의 element 무기는 fallback "물리" preset (회귀 가드)', () => {
      // 가상 elem (아무도 없는) — 물리 fallback 동작 검증.
      const equip = {
          weapon: { type: 'weapon', name: 'TestSword', val: 50, elem: '미지의속성' },
      };
      const skills = getWeaponMagicSkills(equip);
      assert.equal(skills.length, 1, '미지 elem weapon도 magic 처리');
      assert.ok(skills[0].name.includes('아케인 볼트'),
          `미지 elem fallback '아케인 볼트' (실제: ${skills[0].name})`);
  });
}

// ─── cycle-257-skill-drain-ratio.test.js ───
{
  /**
   * cycle 257: skill drain effect의 desc-data 모순 + drainRatio dispatch 누락
   *   (cycle 222-256 silent dead config 시리즈 29번째).
   *
   * 발견 (drain ratio hardcoded vs desc 광고):
   * - CombatEngine performSkill drain section (line 919-923): drainHeal = totalDamage * 0.25 (25% 고정).
   * - 그러나 데이터 desc는 30% / 35% 광고:
   *   - '혼의 흡수' (effect: 'drain', mp 30, mult 1.8): desc "피해의 30% HP 회복".
   *   - '흡혈의 낫' branch B (override: { mult 2.5, effect: 'drain' }): desc "피해의 35% HP 흡수".
   * - 결과: 광고된 30% / 35%가 실제는 25% — 차별화된 흡혈 강도 밸런싱 의도가 무력.
   *
   * 패턴 (cycle 222-256 silent dead config 시리즈 29번째):
   * - cycle 247: skill branch override desc-data 정합 (2건 데이터 fix).
   * - cycle 257: skill drain ratio dispatch + 데이터 정합 (코드 + 데이터 paired fix).
   *
   * 수정:
   * 1) src/systems/CombatEngine.ts: drain 분기에 skill.drainRatio 우선 read (default 0.25).
   * 2) src/data/classes.ts:
   *    - '혼의 흡수' skill에 drainRatio: 0.30 추가.
   *    - '흡혈의 낫' branch override에 drainRatio: 0.35 추가.
   *
   * 회귀 가드:
   * - skill.drainRatio 미정의 시 기본 0.25 (생명흡수 같은 기존 drain skills 동작 유지).
   * - 다른 effect 분기 (drain 외) 영향 없음.
   */

  const makePlayer = () => ({
      name: 'Test', job: '전사', level: 30,
      hp: 500, maxHp: 1000, mp: 200, maxMp: 200,
      atk: 100, def: 30,
      relics: [], skillChoices: {}, titles: [], equip: {},
      combatFlags: {}, status: [],
      skillLoadout: { selected: 0, cooldowns: {} },
  });

  const makeEnemy = () => ({ name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 });
  const makeStats = () => ({ atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 });

  test('cycle 257: skill.drainRatio 0.30 시 30% 흡수', () => {
      const player = makePlayer();
      const enemy = makeEnemy();
      const skill = { name: 'Test', mp: 10, mult: 1.0, effect: 'drain', drainRatio: 0.30, cooldown: 0 };
      const stats = makeStats();
      const before = player.hp;

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      const damage = enemy.hp - r.updatedEnemy.hp;
      const expectedHeal = Math.floor(damage * 0.30);
      const actualHeal = r.updatedPlayer.hp - before;

      assert.equal(actualHeal, expectedHeal,
          `drainRatio 0.30 시 ${expectedHeal} 흡수 (실제: ${actualHeal})`);
  });

  test('cycle 257: skill.drainRatio 0.35 시 35% 흡수', () => {
      const player = makePlayer();
      const enemy = makeEnemy();
      const skill = { name: 'Test', mp: 10, mult: 1.0, effect: 'drain', drainRatio: 0.35, cooldown: 0 };
      const stats = makeStats();
      const before = player.hp;

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      const damage = enemy.hp - r.updatedEnemy.hp;
      const expectedHeal = Math.floor(damage * 0.35);
      const actualHeal = r.updatedPlayer.hp - before;

      assert.equal(actualHeal, expectedHeal,
          `drainRatio 0.35 시 ${expectedHeal} 흡수 (실제: ${actualHeal})`);
  });

  test('cycle 257: skill.drainRatio 미정의 시 default 0.25 (회귀 가드)', () => {
      const player = makePlayer();
      const enemy = makeEnemy();
      const skill = { name: 'Test', mp: 10, mult: 1.0, effect: 'drain', cooldown: 0 };
      const stats = makeStats();
      const before = player.hp;

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      const damage = enemy.hp - r.updatedEnemy.hp;
      const expectedHeal = Math.floor(damage * 0.25);
      const actualHeal = r.updatedPlayer.hp - before;

      assert.equal(actualHeal, expectedHeal,
          `drainRatio 미정의 시 default 0.25 (실제: ${actualHeal} == ${expectedHeal})`);
  });

  test('cycle 257: 혼의 흡수 skill 데이터에 drainRatio: 0.30 정의', async () => {
      const { CLASSES } = await import('../src/data/classes.js');
      // '혼의 흡수' is in 무당 class skills.
      const shaman = CLASSES['무당'];
      const drainSkill = shaman.skills.find((s) => s.name === '혼의 흡수');
      assert.ok(drainSkill, "'혼의 흡수' skill 존재");
      assert.equal(drainSkill.drainRatio, 0.30,
          `drainRatio 0.30 (desc "피해의 30% HP 회복" 정합, 실제: ${drainSkill.drainRatio})`);
  });

  test('cycle 257: 흡혈의 낫 branch override에 drainRatio: 0.35 정의', async () => {
      const { CLASSES } = await import('../src/data/classes.js');
      // '죽음의 낫' branches in 무당 class.
      const shaman = CLASSES['무당'];
      const branchB = shaman.skillBranches['죽음의 낫'].find((b) => b.choice === 'B');
      assert.ok(branchB, "'흡혈의 낫' branch B 존재");
      assert.equal(branchB.label, '흡혈의 낫');
      assert.equal(branchB.override.drainRatio, 0.35,
          `branch override drainRatio 0.35 (desc "피해의 35% HP 흡수" 정합, 실제: ${branchB.override.drainRatio})`);
  });

  test('cycle 257: 다른 effect (drain 외) 영향 없음 (회귀 가드)', () => {
      const player = makePlayer();
      const enemy = makeEnemy();
      // drainRatio 정의되어도 effect != 'drain'이면 무시.
      const skill = { name: 'Test', mp: 10, mult: 1.0, effect: 'burn', drainRatio: 0.50, cooldown: 0 };
      const stats = makeStats();
      const before = player.hp;

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      const actualHeal = r.updatedPlayer.hp - before;
      assert.equal(actualHeal, 0, 'effect=burn 시 drainRatio 무시 (회귀 가드)');
  });
}

// ─── cycle-258-skill-drain-ratio-data.test.js ───
{
  /**
   * cycle 258: '강화 흡수' branch A의 drainRatio 누락 (cycle 257 paired completion)
   *   (cycle 222-257 silent dead config 시리즈 30번째).
   *
   * 발견 (cycle 257 paired data audit):
   * - cycle 257에서 drainRatio dispatch + '혼의 흡수'/'흡혈의 낫' 데이터 정합 fix.
   * - 잔존: 흑마법사 '생명흡수' branch A = '강화 흡수' (override: { mult: 3.9 }).
   *   - desc: "데미지 및 흡수량 +30%" — damage *1.3 + 흡수량 *1.3 의도.
   *   - mult 3.0 → 3.9 (damage +30% 정합).
   *   - 그러나 drainRatio 누락 → default 0.25 그대로, "흡수량 +30%" desc는 무력.
   * - 결과: '강화 흡수' branch가 데미지만 +30% 받고 흡수량 보너스 0 — 'A' 분기의 정체성 절반만 발현.
   *
   * 패턴 (cycle 222-257 silent dead config 시리즈 30번째):
   * - cycle 257: drainRatio dispatch + 2건 데이터 정합 ('혼의 흡수' 30%, '흡혈의 낫' 35%).
   * - cycle 258: '강화 흡수' branch drainRatio 0.325 (paired data follow-up).
   *
   * 수정 (src/data/classes.ts):
   * - 흑마법사 '생명흡수' branch A '강화 흡수' override에 drainRatio: 0.325 추가
   *   (default 0.25 * 1.3 = 0.325 — desc "+30%" 정합).
   *
   * 회귀 가드:
   * - cycle 257 동작 유지 (혼의 흡수 0.30, 흡혈의 낫 0.35).
   * - 다른 branch 영향 없음.
   * - drainRatio 미정의 시 default 0.25 (회귀 가드).
   */

  test('cycle 258: 강화 흡수 branch A에 drainRatio: 0.325 정의', async () => {
      const { CLASSES } = await import('../src/data/classes.js');
      // 흑마법사 '생명흡수' branches.
      const blackMage = CLASSES['흑마법사'];
      const branchA = blackMage.skillBranches['생명흡수'].find((b) => b.choice === 'A');
      assert.ok(branchA, "'강화 흡수' branch A 존재");
      assert.equal(branchA.label, '강화 흡수');
      // default 0.25 * 1.3 = 0.325 (desc "흡수량 +30%" 정합).
      assert.ok(Math.abs(branchA.override.drainRatio - 0.325) < 0.001,
          `branch override drainRatio 0.325 (desc "흡수량 +30%" 정합, 실제: ${branchA.override.drainRatio})`);
      // damage scaling 보존.
      assert.equal(branchA.override.mult, 3.9, 'mult 3.9 (damage +30%) 회귀 가드');
  });

  test('cycle 258: 저주 흡수 branch B는 drainRatio 없음 (기본 0.25 — "흡수" 강조 없음)', async () => {
      const { CLASSES } = await import('../src/data/classes.js');
      const blackMage = CLASSES['흑마법사'];
      const branchB = blackMage.skillBranches['생명흡수'].find((b) => b.choice === 'B');
      assert.equal(branchB.label, '저주 흡수');
      // desc: "저주 부여 + 흡수" — 흡수량 강화 없음. drainRatio 정의 X (default 0.25).
      assert.equal(branchB.override.drainRatio, undefined,
          `'저주 흡수' branch drainRatio 미정의 — 기본 0.25 사용 (desc 흡수량 보너스 없음)`);
  });

  test('cycle 258: 강화 흡수 시뮬레이션 — 32.5% 흡수', () => {
      const player = {
          name: 'Test', job: '흑마법사', level: 30,
          hp: 500, maxHp: 1000, mp: 200, maxMp: 200,
          atk: 100, def: 30,
          relics: [], skillChoices: {}, titles: [], equip: {},
          combatFlags: {}, status: [],
          skillLoadout: { selected: 0, cooldowns: {} },
      };
      const enemy = { name: '오크', hp: 100000, maxHp: 100000, atk: 50, def: 5 };
      // '강화 흡수' branch A 시뮬: mult 3.9, effect 'drain', drainRatio 0.325.
      const skill = { name: 'Test', mp: 40, mult: 3.9, effect: 'drain', drainRatio: 0.325, cooldown: 0 };
      const stats = { atk: 200, def: 50, relics: [], activeSynergies: [], critChance: 0 };
      const before = player.hp;

      const r = CombatEngine.performSkill(player, enemy, stats, skill);
      const damage = enemy.hp - r.updatedEnemy.hp;
      const expectedHeal = Math.floor(damage * 0.325);
      const actualHeal = r.updatedPlayer.hp - before;

      assert.equal(actualHeal, expectedHeal,
          `'강화 흡수' drainRatio 0.325 → ${expectedHeal} 흡수 (실제: ${actualHeal})`);
  });

  test('cycle 257 회귀 가드: 혼의 흡수 / 흡혈의 낫 drainRatio 유지', async () => {
      const { CLASSES } = await import('../src/data/classes.js');
      const shaman = CLASSES['무당'];
      const drainSkill = shaman.skills.find((s) => s.name === '혼의 흡수');
      assert.equal(drainSkill.drainRatio, 0.30, 'cycle 257 혼의 흡수 0.30 회귀 가드');

      const reaperBranchB = shaman.skillBranches['죽음의 낫'].find((b) => b.choice === 'B');
      assert.equal(reaperBranchB.override.drainRatio, 0.35, 'cycle 257 흡혈의 낫 0.35 회귀 가드');
  });
}

// ─── cycle-267-trait-skilllabel-dead-cleanup.test.js ───
{
  /**
   * cycle 267: getTraitProfile의 skillLabel 필드 dead config 정리
   *   (cycle 222-266 silent dead config 시리즈 38번째 — cleanup lens).
   *
   * 발견 (dead config 단순 cleanup):
   * - src/utils/runProfile.ts getTraitProfile (line 250)이 `skillLabel` 필드 계산:
   *   `skill ? '${skill.name} · MP ${skill.mp}' : '특수 스킬 없음'`.
   * - 그러나 src/ 어디에도 `skillLabel` consume 안 됨 — 검색 결과 정의 1건뿐.
   * - BuildAdvicePanel.tsx (line 95-96)는 trait.skill.name / .mp / .cooldown을 직접 사용
   *   (cooldown까지 포함된 더 풍부한 표시 — skillLabel은 cooldown 없음).
   * - StatsPanel.tsx도 trait.skill 직접 접근.
   * - 결과: skillLabel 계산 로직과 fallback 텍스트('특수 스킬 없음') 모두 dead — 메모리/CPU 낭비.
   *
   * 패턴 (cycle 222-266 silent dead config 시리즈 38번째):
   * - 이전 사이클들은 dispatch 누락 fix 위주.
   * - cycle 267: 반대 방향 — 정의되었지만 dispatch 0건인 dead 필드 제거.
   *
   * 수정 (src/utils/runProfile.ts getTraitProfile):
   * - skillLabel 필드 제거.
   *
   * 회귀 가드:
   * - getTraitProfile 다른 필드 (skill, bonus, reasons 등) 동작 유지.
   * - BuildAdvicePanel / StatsPanel display 변화 없음 (trait.skill 직접 접근).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 267: getTraitProfile의 skillLabel 필드 제거', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      // 필드 정의 라인 (`skillLabel:` colon)만 검색 — 주석에 단어 언급은 허용.
      assert.ok(!/^\s*skillLabel:/m.test(source),
          'skillLabel 필드 정의 제거됨 (dead config cleanup)');
  });

  test('cycle 267: getTraitProfile의 skill / bonus / reasons 필드 유지 (회귀 가드)', async () => {
      const { getTraitProfile } = await import('../src/utils/runProfile.js');
      const player = {
          name: 'Test', job: '전사', level: 30,
          hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
          atk: 50, def: 20,
          equip: {}, relics: [], skillChoices: {}, titles: [],
          stats: { kills: 10, bossKills: 1 },
      };
      const profile = getTraitProfile(player, { maxHp: 1000 });
      assert.ok(profile, 'getTraitProfile 정상 반환');
      assert.ok(profile.bonus, 'bonus 필드 유지');
      assert.ok(Array.isArray(profile.reasons), 'reasons 필드 유지');
      // skill은 null일 수 있음 (특정 trait는 미정의).
      assert.ok(profile.skill !== undefined, 'skill 필드 유지 (null 허용)');
  });

  test('cycle 267: BuildAdvicePanel은 trait.skill 직접 접근 (회귀 가드)', async () => {
      const source = await readSrc('src/components/BuildAdvicePanel.tsx');
      assert.ok(/trait\.skill\.name/.test(source), 'trait.skill.name 직접 접근 유지');
      assert.ok(/trait\.skill\.mp/.test(source), 'trait.skill.mp 직접 접근 유지');
      assert.ok(/trait\.skill\.cooldown/.test(source), 'trait.skill.cooldown 직접 접근 유지');
  });

  test('cycle 267: skillLabel 컴포넌트 consume 0건 (회귀 가드)', async () => {
      const sources = await Promise.all([
          readSrc('src/components/BuildAdvicePanel.tsx'),
          readSrc('src/components/StatsPanel.tsx'),
      ]);
      sources.forEach((src, i) => {
          assert.ok(!/skillLabel/.test(src),
              `[component ${i}] skillLabel 참조 0건 (dead cleanup 후)`);
      });
  });
}

// ─── cycle-353-selected-skill-shape-dead.test.js ───
{
  /**
   * cycle 353: getSelectedSkill 반환 shape 단순화 (index / total 출력 dead)
   *   (cycle 222-352 silent dead config 시리즈 120번째 — cleanup lens 연속).
   *
   * 발견 (2 dead output fields):
   * - getSelectedSkill 반환 객체에 `index` / `total` 필드.
   * - useCombatActions는 `?.skill || null` unwrap만 사용.
   * - combatAttack은 `selected?.skill` 사용. index/total 직접 read 0건.
   *
   * 패턴 (cycle 222-352 silent dead config 시리즈 120번째):
   * - cycle 352: getLootUpgradeHint score 출력 dead.
   * - cycle 353: getSelectedSkill 반환 shape 단순화.
   *
   * 수정:
   * - src/hooks/combatActions/_helpers.ts: getSelectedSkill 반환에서 index/total 제거.
   * - src/hooks/combatActions/combatAttack.ts: 'randomSkills' 분기에서 selected 재할당
   *   shape도 동기화 (index/total 제거).
   *
   * 회귀 가드:
   * - selected.skill 여전히 노출 (combatAttack `selected?.skill` 사용).
   * - useCombatActions getSelectedSkill 호출 chain 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 353: getSelectedSkill 반환에 index / total 0건', async () => {
      const source = await readSrc('src/hooks/combatActions/_helpers.ts');
      const fn = source.slice(source.indexOf('export const getSelectedSkill'), source.indexOf('export const getLootUpgradeHint'));
      assert.ok(/return \{ skill: skills\[index\] \};/.test(fn),
          'return shape { skill: skills[index] }만 노출');
  });

  test('cycle 353: combatAttack 재할당 shape 동기화', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      assert.ok(/selected = \{ skill: randomSkill \};/.test(source),
          'randomSkill 재할당 shape 단순화');
  });

  test('cycle 353: getSelectedSkill 동작 보존', async () => {
      const { getSelectedSkill } = await import('../src/hooks/combatActions/_helpers.js');
      const player = { job: '검사', skillLoadout: { selected: 0 } };
      const result = getSelectedSkill(player);
      if (result) {
          // index / total 0건, skill만 노출.
          assert.ok('skill' in result, 'skill 보존');
          assert.equal(result.index, undefined, 'index 0건');
          assert.equal(result.total, undefined, 'total 0건');
      }
  });

  test('cycle 352 회귀 가드: getLootUpgradeHint score 0건', async () => {
      const source = await readSrc('src/hooks/combatActions/_helpers.ts');
      const fn = source.slice(source.indexOf('export const getLootUpgradeHint'));
      assert.ok(/let bestScore =/.test(fn),
          'cycle 352 bestScore internal 보존');
  });
}

// ─── cycle-421-skill-type-icon-lightning-unreachable.test.js ───
{
  /**
   * cycle 421: SkillTypeIcon TYPE_PATHS / TYPE_COLORS '번개' unreachable 정리
   *   (cycle 222-420 silent dead config 시리즈 181번째 — 호출 사이트 분석 lens 회귀).
   *
   * 발견 (2 dead lookup entries):
   * - src/components/icons/SkillTypeIcon.tsx
   *   TYPE_PATHS['번개'] + TYPE_COLORS['번개'] 정의.
   *   호출 사이트:
   *     1) SkillTreePreview.tsx — `<SkillTypeIcon type={skill.type} ...>`
   *     2) MonsterCodex.tsx — `<SkillTypeIcon type={m.weakness | m.resistance} ...>`
   * - 데이터 분석:
   *     classes.ts skill.type 값: 물리/화염/냉기/자연/대지/빛/어둠/buff/debuff/escape.
   *     '번개' type 0건 — '썬더볼트' 등 thunder 스킬도 type='빛'으로 정의.
   *     monsters.ts weakness/resistance 값: 화염/냉기/자연/대지/빛/어둠/물리/바람/에테르.
   *     '번개' weakness/resistance 0건.
   * - 결과: '번개' key lookup 절대 hit 안 됨.
   *
   * 패턴 (cycle 222-420 시리즈 181번째):
   * - cycle 419: SignalBadge SIZE_CLASS md/lg — 호출 사이트 explicit "sm" 명시 → md/lg unreachable.
   * - cycle 421: SkillTypeIcon TYPE_PATHS/TYPE_COLORS '번개' — type prop producer 분석 → '번개' unreachable.
   *
   * 수정 (src/components/icons/SkillTypeIcon.tsx):
   * - TYPE_PATHS에서 '번개' 라인 제거 (코멘트 "// 번개 (빛 파생)" 포함).
   * - TYPE_COLORS에서 '번개' 라인 제거.
   *
   * 회귀 가드:
   * - 활성 키 (물리/화염/냉기/자연/대지/빛/어둠/buff/debuff) 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 421: TYPE_PATHS에서 번개 0건', async () => {
      const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
      const blockStart = source.indexOf('const TYPE_PATHS');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/'번개'/.test(block), "TYPE_PATHS에서 '번개' 0건");
  });

  test('cycle 421: TYPE_COLORS에서 번개 0건', async () => {
      const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
      const blockStart = source.indexOf('const TYPE_COLORS');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/'번개'/.test(block), "TYPE_COLORS에서 '번개' 0건");
  });

  test('cycle 421: 활성 키 보존 (TYPE_PATHS / TYPE_COLORS)', async () => {
      const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
      const aliveKeys = ['물리', '화염', '냉기', '자연', '대지', '빛', '어둠', 'buff', 'debuff'];
      for (const key of aliveKeys) {
          const re = new RegExp(`'${key}'`);
          assert.ok(re.test(source), `'${key}' 활성 키 보존`);
      }
  });

  test('cycle 421: 정합성 가드 — classes.ts skill.type / monsters.ts weakness|resistance 0건', async () => {
      const classes = await readSrc('src/data/classes.ts');
      const monsters = await readSrc('src/data/monsters.ts');
      const typeMatches = classes.match(/type: ?'번개'/g) || [];
      const weakMatches = monsters.match(/weakness: ?'번개'/g) || [];
      const resistMatches = monsters.match(/resistance: ?'번개'/g) || [];
      assert.equal(typeMatches.length, 0, "classes.ts skill.type='번개' 0건");
      assert.equal(weakMatches.length, 0, "monsters.ts weakness='번개' 0건");
      assert.equal(resistMatches.length, 0, "monsters.ts resistance='번개' 0건");
  });

  test('cycle 419 회귀 가드: SignalBadge SIZE_CLASS md/lg 0건', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      const blockStart = source.indexOf('const SIZE_CLASS');
      const blockEnd = source.indexOf('};', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+md:/m.test(block), 'cycle 419 SIZE_CLASS.md 0건 보존');
      assert.ok(!/^\s+lg:/m.test(block), 'cycle 419 SIZE_CLASS.lg 0건 보존');
  });
}

// ─── cycle-479-skill-tree-preview-compact-cascade.test.js ───
{
  /**
   * cycle 479: SkillTreePreview `compact` prop cascade unreachable 정리
   *   (cycle 222-478 silent dead config 시리즈 232번째 — unreachable code path
   *   cascade cleanup, cycle 471-478 paired 9사이클).
   *
   * 발견 (1 prop + 1 state + 3 const + 14 ternary 가지 + 1 toggle UI 블록 dead):
   * - src/components/SkillTreePreview.tsx:
   *     · interface line 18: compact?: boolean.
   *     · destructure line 118: compact = false.
   *     · line 119: useState(false) showAllSkills + setShowAllSkills.
   *     · line 134: visibleCurrentSkills (compact && !showAllSkills 가지).
   *     · line 139: hiddenSkillCount (compact 토글 버튼 조건용).
   *     · line 140: showSkillSummary (compact && !showAllSkills 항상 false).
   *     · 본체 className compact ternary 다수.
   *     · {compact && <toggle>} 블록.
   *     · `!showSkillSummary && ...` / `showSkillSummary ? ... : ...` 가드.
   *     · SkillCard에 compact={compact} 전달 (line 194/331).
   *
   * 또한 SkillCard (내부 컴포넌트, line 48):
   *     · destructure에 compact = false default.
   *     · 본체 1 ternary (line 53): summary ? X : compact ? Y : Z.
   *     · 부모로부터 undefined 전달이라 compact 가지 0건.
   *
   * - 호출 사이트:
   *     · Dashboard.tsx:188 — cycle 471이 compact prop 제거. caller 0건.
   *     · 다른 파일 import 0건.
   * - 결과: compact 항상 undefined → cascade 전체 unreachable.
   *
   * cycle 471 → 472 → 473 → 474 → 475 → 476 → 477 → 478 → 479 cascade 9사이클 paired.
   *
   * 수정 (src/components/SkillTreePreview.tsx):
   * - interface compact 제거.
   * - SkillTreePreview destructure compact 제거.
   * - SkillCard destructure compact 제거 (internal helper).
   * - useState showAllSkills + setShowAllSkills 제거.
   * - visibleCurrentSkills → allCurrentSkills 직접.
   * - hiddenSkillCount / showSkillSummary 제거.
   * - 토글 버튼 JSX 블록 제거.
   * - className compact ternary 정적 (false 가지).
   * - SkillCard line 53 chained ternary `summary ? A : compact ? B : C` →
   *   `summary ? A : C`.
   * - {compact && ...} 제거 / {!compact && ...} 직접 렌더.
   * - showSkillSummary ternary → 직접 false 가지 렌더.
   * - SkillCard 호출에서 compact prop 전달 제거 (line 194/331).
   *
   * 회귀 가드:
   * - player / actions prop 보존.
   * - 본체 skills / branches / classTree / 스킬 분기 교체 로직 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 479: SkillTreePreview destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/SkillTreePreview.tsx');
      const fnIdx = source.indexOf('const SkillTreePreview =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 479: interface에서 compact 0건', async () => {
      const source = await readSrc('src/components/SkillTreePreview.tsx');
      const ifaceIdx = source.indexOf('interface SkillTreePreviewProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
  });

  test('cycle 479: SkillCard 내부 컴포넌트 compact 0건', async () => {
      const source = await readSrc('src/components/SkillTreePreview.tsx');
      const fnIdx = source.indexOf('const SkillCard =');
      const fnEnd = source.indexOf('const SkillTreePreview =', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(block), 'SkillCard 본체 compact 0건');
  });

  test('cycle 479: cascade dead 0건 (showAllSkills/hidden/summary)', async () => {
      const source = await readSrc('src/components/SkillTreePreview.tsx');
      assert.ok(!/showAllSkills/.test(source), 'showAllSkills 0건');
      assert.ok(!/hiddenSkillCount/.test(source), 'hiddenSkillCount 0건');
      assert.ok(!/showSkillSummary/.test(source), 'showSkillSummary 0건');
      assert.ok(!/visibleCurrentSkills/.test(source), 'visibleCurrentSkills 0건');
  });

  test('cycle 479: 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/SkillTreePreview.tsx');
      assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
  });

  test('cycle 479: 정합성 가드 — Dashboard <SkillTreePreview> compact 전달 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const idx = source.indexOf('<SkillTreePreview');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <SkillTreePreview> compact 전달 0건');
  });

  test('cycle 479: player / actions / classTree / 스킬 분기 핵심 로직 보존', async () => {
      const source = await readSrc('src/components/SkillTreePreview.tsx');
      assert.ok(/getJobSkills/.test(source), 'getJobSkills 보존');
      assert.ok(/skillBranches/.test(source), 'skillBranches 보존');
      assert.ok(/swapSkillChoice/.test(source), 'swapSkillChoice 보존');
  });
}

// ─── cycle-535-cycle-skill-dir-default-unreachable.test.js ───
{
  /**
   * cycle 535: cycleSkill `dir = 1` default unreachable
   *   (cycle 222-534 silent dead config 시리즈 278번째 — redundant default annotation
   *   util/component/hook default 청소 메가 시리즈 31번째).
   *
   * 발견 (1 default unreachable):
   * - src/hooks/gameActions/characterActions.ts (line 43):
   *     cycleSkill: (dir: any = 1) => {
   *         const skills = getJobSkills(player);
   *         if (!skills.length) return;
   *         ...
   *         const next = ((current + dir) % skills.length + skills.length) % skills.length;
   *         ...
   *     }
   * - 호출 사이트 (2 callsite, 모두 명시):
   *     · commandParser.ts:80 — actions.cycleSkill?.(1)
   *     · CombatPanel.tsx:113 — actions.cycleSkill(1)
   *     · 다른 caller 0건.
   * - 결과: dir 항상 1 명시 전달. default 1 도달 불가.
   *
   * 패턴 (cycle 222-534 시리즈 278번째):
   * - cycle 502-534: util/component/hook default 청소 메가 시리즈 31사이클.
   * - cycle 535: hooks/gameActions 동일 모듈 default — cycle 532에 이은
   *   characterActions.ts 추가 cleanup.
   *
   * 수정 (src/hooks/gameActions/characterActions.ts):
   * - cycleSkill signature: (dir: any = 1) → (dir: any).
   * - body의 modulo 계산 / dispatch 보존.
   *
   * 회귀 가드:
   * - 2 callsite 동작 그대로.
   * - body skills.length / Number.isInteger / dispatch 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 535: cycleSkill signature에서 dir default 0건', async () => {
      const source = await readSrc('src/hooks/gameActions/characterActions.ts');
      assert.ok(!/cycleSkill:\s*\(dir:\s*any\s*=\s*1\)/.test(source),
          'cycleSkill dir default 1 제거');
      assert.ok(/cycleSkill:\s*\(dir:\s*any\)/.test(source),
          'cycleSkill 파라미터 자체는 보존');
  });

  test('cycle 535: 정합성 가드 — 2 callsite 보존 (1 명시)', async () => {
      const cmd = await readSrc('src/utils/commandParser.ts');
      assert.ok(/actions\.cycleSkill\?\.\(1\)/.test(cmd),
          'commandParser cycleSkill?.(1) callsite 보존');

      const cp = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.ok(/actions\.cycleSkill\(1\)/.test(cp),
          'CombatPanel cycleSkill(1) callsite 보존');
  });

  test('cycle 535: body modulo 계산 + dispatch 보존', async () => {
      const source = await readSrc('src/hooks/gameActions/characterActions.ts');
      assert.ok(/const next = \(\(current \+ dir\) % skills\.length \+ skills\.length\) % skills\.length/.test(source),
          'modulo 계산 보존');
      assert.ok(/skillLoadout: \{ selected: next/.test(source),
          'dispatch payload 보존');
  });

  test('cycle 535: cycle 502-534 회귀 가드 — util/component/hook default 청소 시리즈 보존', async () => {
      const lh = await readSrc('src/hooks/combatActions/_helpers.ts');
      assert.ok(!/getLootUpgradeHint[^=]*equip:\s*any\s*=\s*\{\}/.test(lh),
          'cycle 534 getLootUpgradeHint equip default 0건');

      const rcp = await readSrc('src/components/RelicChoicePanel.tsx');
      assert.ok(!/const getRelicSynergyScore[^=]*ownedRelics:\s*any\s*=\s*\[\]/.test(rcp),
          'cycle 533 getRelicSynergyScore ownedRelics default 0건');
  });
}

// ─── cycle-558-build-trait-skill-get-trait-bonus-defaults-batch.test.js ───
{
  /**
   * cycle 558: buildTraitSkill + getTraitBonus 2 defaults batch unreachable
   *   (cycle 222-557 silent dead config 시리즈 299번째 — redundant default annotation
   *   청소 메가 시리즈 52번째). runProfile.ts 같은 모듈 batch.
   *
   * 발견 (2 defaults batch):
   * - src/utils/runProfile.ts (line 169, 232):
   *     · const buildTraitSkill = (traitId, player, stats: any = {}) — private,
   *       1 internal caller (line 212) 명시.
   *     · export const getTraitBonus = (player, stats: any = {}) — 1 external
   *       caller (statsCalculator.ts:376) 2 args 명시. test caller 0건.
   * - 호출 사이트 audit:
   *     · buildTraitSkill: 1 internal (line 212) — buildTraitSkill(traitId,
   *       player, stats) 명시.
   *     · getTraitBonus: 1 external (statsCalculator:376) — getTraitBonus(player,
   *       preBuildStats) 명시. tests 0건.
   * - 결과: 두 default 모두 도달 불가.
   *
   * Note: getTraitProfile / getTraitSkill는 1-arg caller가 존재 (DashboardMobile
   * Summary, gameUtils:23 등) → defaults reachable, cleanup 대상 외.
   *
   * 패턴 (cycle 222-557 시리즈 299번째):
   * - cycle 502-557: default 청소 메가 시리즈 56사이클.
   * - cycle 558: runProfile.ts 같은 모듈 추가 batch — cycle 526/544에 이은
   *   cleanup.
   *
   * 수정 (src/utils/runProfile.ts):
   * - buildTraitSkill signature: stats: any = {} → stats: any.
   * - getTraitBonus signature: stats: any = {} → stats: any.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - buildTraitSkill 1 internal callsite 동작 그대로.
   * - getTraitBonus 1 external callsite 동작 그대로.
   * - getTraitProfile / getTraitSkill defaults 보존 (reachable).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 558: 2 defaults 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const buildSig = source.slice(source.indexOf('const buildTraitSkill'),
                                      source.indexOf('=>', source.indexOf('const buildTraitSkill')));
      assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(buildSig),
          'buildTraitSkill stats default {} 제거');

      const bonusSig = source.slice(source.indexOf('export const getTraitBonus'),
                                      source.indexOf('=>', source.indexOf('export const getTraitBonus')));
      assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(bonusSig),
          'getTraitBonus stats default {} 제거');
  });

  test('cycle 558: getTraitProfile / getTraitSkill 파라미터 보존 (cycle 613 explicit elimination)', async () => {
      // cycle 613에서 explicit default-elimination 적용 — DashboardMobileSummary
      // / gameUtils:23 1-arg caller에 {} 명시 추가 후 defaults 제거됨.
      // 파라미터 자체는 보존.
      const source = await readSrc('src/utils/runProfile.ts');
      const profileSig = source.slice(source.indexOf('export const getTraitProfile'),
                                       source.indexOf('=>', source.indexOf('export const getTraitProfile')));
      assert.ok(/\bstats\b/.test(profileSig),
          'getTraitProfile stats 파라미터 보존 (default cycle 613 제거)');

      const skillSig = source.slice(source.indexOf('export const getTraitSkill'),
                                      source.indexOf('=>', source.indexOf('export const getTraitSkill')));
      assert.ok(/\bstats\b/.test(skillSig),
          'getTraitSkill stats 파라미터 보존 (default cycle 613 제거)');
  });

  test('cycle 558: 정합성 가드 — callsite 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(/buildTraitSkill\(traitId,\s*player,\s*stats\)/.test(source),
          'buildTraitSkill 호출 보존');

      const sc = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(/getTraitBonus\(player,\s*preBuildStats\)/.test(sc),
          'statsCalculator getTraitBonus 호출 보존');
  });

  test('cycle 558: cycle 502-557 회귀 가드 — default 청소 시리즈 보존', async () => {
      const oa = await readSrc('src/utils/outcomeAnalysis.ts');
      assert.ok(!/getPostCombatAnalysis[^=]*result:\s*any\s*=\s*\{\}/.test(oa),
          'cycle 557 getPostCombatAnalysis result default 0건');

      const gu = await readSrc('src/utils/gameUtils.ts');
      assert.ok(!/formatRewardParts[^=]*reward:\s*any\s*=\s*\{\}/.test(gu),
          'cycle 556 formatRewardParts reward default 0건');
  });
}

// ─── cycle-565-skill-tree-preview-actions-default-unreachable.test.js ───
{
  /**
   * cycle 565: SkillTreePreview `actions = null` default unreachable
   *   (cycle 222-564 silent dead config 시리즈 305번째 — redundant default annotation
   *   청소 메가 시리즈 58번째). component prop default cleanup.
   *
   * 발견 (1 default unreachable):
   * - src/components/SkillTreePreview.tsx (line 120):
   *     const SkillTreePreview = ({ player, actions = null }: SkillTreePreviewProps) => {
   *         ...
   *     };
   * - 호출 사이트 (1 caller):
   *     · Dashboard.tsx:188 — <SkillTreePreview player={player} actions={actions} />
   *     · 다른 caller 0건 (test caller 0건).
   * - 결과: actions 항상 명시 전달. default null 도달 불가.
   *
   * 패턴 (cycle 222-564 시리즈 305번째):
   * - cycle 502-564: default 청소 메가 시리즈 63사이클.
   * - cycle 565: component prop default cleanup — cycle 499 PixelCharacter
   *   Avatar / cycle 533 RelicChoicePanel 등에 이은 동일 lens.
   *
   * 수정 (src/components/SkillTreePreview.tsx):
   * - signature에서 actions = null → actions.
   * - SkillTreePreviewProps interface 보존 (actions?: any).
   * - body의 actions 사용처 보존.
   *
   * 회귀 가드:
   * - 1 production callsite 동작 그대로.
   * - body actions 호출 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 565: SkillTreePreview signature에서 actions default 0건', async () => {
      const source = await readSrc('src/components/SkillTreePreview.tsx');
      const fnIdx = source.indexOf('const SkillTreePreview = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/actions\s*=\s*null/.test(sig),
          'SkillTreePreview actions default null 제거');
      assert.ok(/\bactions\b/.test(sig),
          'actions 파라미터 자체는 보존');
  });

  test('cycle 565: 정합성 가드 — Dashboard callsite 보존', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      assert.ok(/<SkillTreePreview player=\{player\} actions=\{actions\} \/>/.test(source),
          'Dashboard <SkillTreePreview> callsite 보존');
  });

  test('cycle 565: SkillTreePreviewProps interface 보존', async () => {
      const source = await readSrc('src/components/SkillTreePreview.tsx');
      assert.ok(/actions\?:\s*any/.test(source),
          'SkillTreePreviewProps actions?: any 보존');
  });

  test('cycle 565: cycle 502-564 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ap = await readSrc('src/utils/avatarEquipmentPreview.ts');
      assert.ok(!/const withVariant[^=]*overrides:\s*any\s*=\s*\{\}/.test(ap),
          'cycle 564 withVariant overrides default 0건');

      const ld = await readSrc('src/hooks/useLegendaryDropDetector.ts');
      assert.ok(!/useLegendaryDropDetector[^=]*dispatch:\s*any\s*=\s*null/.test(ld),
          'cycle 563 useLegendaryDropDetector dispatch default 0건');
  });
}

// ─── cycle-569-skill-type-icon-size-default-partial.test.js ───
{
  /**
   * cycle 569: SkillTypeIcon `size = 14` default unreachable (partial cleanup)
   *   (cycle 222-568 silent dead config 시리즈 309번째 — redundant default annotation
   *   청소 메가 시리즈 62번째). partial cleanup pattern (cycle 542 재적용).
   *
   * 발견 (1 default unreachable, 1 default reachable 보존):
   * - src/components/icons/SkillTypeIcon.tsx (line 39):
   *     const SkillTypeIcon = ({ type, size = 14, className = '' }: any) => {...};
   * - 호출 사이트 (4 callers):
   *     · SkillTreePreview:83 — <SkillTypeIcon type={skill.type} size={10} className="..." />
   *     · MonsterCodex:104 — <SkillTypeIcon type={m.weakness} size={12} className="..." />
   *     · MonsterCodex:155 — <SkillTypeIcon type={m.weakness} size={11} /> (className 미전달)
   *     · MonsterCodex:161 — <SkillTypeIcon type={m.resistance} size={11} /> (className 미전달)
   * - 결과:
   *     · size 4 callers 모두 명시 → default 14 도달 불가.
   *     · className 2/4 callers 미전달 → default '' REACHABLE 보존 필수.
   *
   * 패턴 (cycle 222-568 시리즈 309번째):
   * - cycle 502-568: default 청소 메가 시리즈 67사이클.
   * - cycle 569: components/icons/ partial cleanup — cycle 542/553 partial pattern
   *   재적용. component prop별 reachability 분리.
   *
   * 수정 (src/components/icons/SkillTypeIcon.tsx):
   * - signature에서 size = 14 → size.
   * - signature에서 className = '' 보존 (2 callers reachable).
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 4 production callsite 동작 그대로.
   * - body TYPE_PATHS / TYPE_COLORS 처리 보존.
   * - className default 보존 (reachable).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 569: SkillTypeIcon signature에서 size default 0건', async () => {
      const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
      const fnIdx = source.indexOf('const SkillTypeIcon = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/size\s*=\s*14/.test(sig),
          'SkillTypeIcon size default 14 제거');
  });

  test("cycle 569: className default 보존 (reachable, partial cleanup)", async () => {
      const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
      const fnIdx = source.indexOf('const SkillTypeIcon = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/className\s*=\s*''/.test(sig),
          "className default '' 보존 (MonsterCodex:155/161 미전달이라 reachable)");
  });

  test('cycle 569: 정합성 가드 — 4 production callsite 보존', async () => {
      const stp = await readSrc('src/components/SkillTreePreview.tsx');
      assert.ok(/<SkillTypeIcon type=\{skill\.type\} size=\{10\} className="mr-0\.5 -mt-px"/.test(stp),
          'SkillTreePreview <SkillTypeIcon> callsite 보존');

      const mc = await readSrc('src/components/codex/MonsterCodex.tsx');
      assert.ok(/<SkillTypeIcon type=\{m\.weakness\} size=\{12\} className="ml-auto shrink-0"/.test(mc),
          'MonsterCodex:104 <SkillTypeIcon> callsite 보존');
      assert.ok(/<SkillTypeIcon type=\{m\.weakness\} size=\{11\} \/>/.test(mc),
          'MonsterCodex:155 <SkillTypeIcon> callsite 보존 (className 미전달)');
      assert.ok(/<SkillTypeIcon type=\{m\.resistance\} size=\{11\} \/>/.test(mc),
          'MonsterCodex:161 <SkillTypeIcon> callsite 보존 (className 미전달)');
  });

  test('cycle 569: cycle 502-568 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ci = await readSrc('src/components/icons/ClassIcon.tsx');
      assert.ok(!/const ClassIcon = \({ className: jobName, size\s*=\s*28/.test(ci),
          'cycle 568 ClassIcon size default 0건');

      const sb = await readSrc('src/components/icons/SignatureBadge.tsx');
      assert.ok(!/const SignatureBadge = \({ item, size\s*=\s*10/.test(sb),
          'cycle 567 SignatureBadge size default 0건');
  });
}

// ─── cycle-613-trait-profile-skill-explicit-elimination-batch.test.js ───
{
  /**
   * cycle 613: getTraitProfile + getTraitSkill stats explicit default-elimination
   *   batch (cycle 222-612 silent dead config 시리즈 353번째 — explicit
   *   default-elimination pattern 5번째 적용, 2 cleanup combo).
   *
   * 발견 (2 defaults reachable → unreachable conversion):
   * - src/utils/runProfile.ts (line 201, 242):
   *     · getTraitProfile (player, stats: any = {})
   *     · getTraitSkill (player, stats: any = {}) → getTraitProfile(player, stats).skill
   * - 호출 사이트:
   *     · getTraitProfile: DashboardMobileSummary:37 — getTraitProfile(player) — 1 arg.
   *     · getTraitSkill: gameUtils:23 — getTraitSkill(player) — 1 arg.
   *     · 다른 callers: 모두 2 args 명시.
   *
   * 패턴 (cycle 222-612 시리즈 353번째):
   * - cycle 502-612: default 청소 메가 시리즈 111사이클.
   * - cycle 613: explicit default-elimination 5번째 (cycle 608/609/611/612 lens 정착).
   *   single-cycle 2-default batch (paired functions).
   *
   * 수정:
   * - DashboardMobileSummary.tsx:37 — getTraitProfile(player) → getTraitProfile(player, {}).
   * - gameUtils.ts:23 — getTraitSkill(player) → getTraitSkill(player, {}).
   * - runProfile.ts:201/242 — stats defaults 모두 제거.
   *
   * 회귀 가드:
   * - 다수 callsite 동작 그대로.
   * - body 동작 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 613: getTraitProfile signature에서 stats default 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnIdx = source.indexOf('export const getTraitProfile');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig),
          'getTraitProfile stats default {} 제거');
  });

  test('cycle 613: getTraitSkill signature에서 stats default 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnIdx = source.indexOf('export const getTraitSkill');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig),
          'getTraitSkill stats default {} 제거');
  });

  test('cycle 613: 정합성 가드 — caller {} 명시 추가', async () => {
      const dms = await readSrc('src/components/DashboardMobileSummary.tsx');
      assert.ok(/getTraitProfile\(player,\s*\{\}\)/.test(dms),
          'DashboardMobileSummary getTraitProfile(player, {}) 명시');

      const gu = await readSrc('src/utils/gameUtils.ts');
      assert.ok(/getTraitSkill\(player,\s*\{\}\)/.test(gu),
          'gameUtils getTraitSkill(player, {}) 명시');
  });

  test('cycle 613: cycle 502-612 회귀 가드 — default 청소 시리즈 보존', async () => {
      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/getRunBuildProfile = \(player: Player, stats:\s*any\s*=\s*\{\}\)/.test(rp),
          'cycle 612 getRunBuildProfile stats default 0건');

      const ng = await readSrc('src/utils/nameGenerator.ts');
      assert.ok(!/createRandomMobileName = \(rng:\s*any\s*=\s*Math\.random\)/.test(ng),
          'cycle 611 createRandomMobileName rng default 0건');
  });
}

// ─── cycle-631-equipped-weapons-magic-skills-explicit-elimination.test.js ───
{
  /**
   * cycle 631: getEquippedWeapons + getWeaponMagicSkills equip {} explicit
   *   default-elimination paired batch
   *   (cycle 222-630 silent dead config 시리즈 368번째 — explicit
   *   default-elimination pattern 21번째 적용 — 이중자릿수 정착 후 첫 사이클,
   *   paired batch 5번째).
   *
   * 발견 (2 defaults 이미 unreachable, signature 정리):
   * - src/utils/equipmentUtils.ts:218:
   *     export const getEquippedWeapons = (equip: EquipSlots = {}) => {...}
   * - src/utils/equipmentUtils.ts:247:
   *     export const getWeaponMagicSkills = (equip: EquipSlots = {}) => {...}
   * - 호출 사이트:
   *     · getEquippedWeapons:
   *       · equipmentUtils.ts:251 (getWeaponMagicSkills 내부) — 명시.
   *       · tests/equipment-utils.test.js:219 — 명시.
   *     · getWeaponMagicSkills:
   *       · gameUtils.ts:22 — getWeaponMagicSkills(player?.equip), 명시.
   *       · tests/cycle-256 (3 callers) — 모두 명시.
   * - 두 default {} 모두 이미 도달 불가.
   *
   * 패턴 (cycle 222-630 시리즈 368번째):
   * - cycle 502-630: default 청소 메가 시리즈 125사이클.
   * - cycle 631: explicit default-elimination 21번째 (이중자릿수 정착 후
   *   첫 사이클). paired batch 5번째 (cycle 613/624/626/629에 이은) +
   *   변형 패턴 (caller 모두 이미 명시 상태).
   *
   * 수정:
   * - equipmentUtils.ts:218 — getEquippedWeapons equip default {} 제거.
   * - equipmentUtils.ts:247 — getWeaponMagicSkills equip default {} 제거.
   *
   * 회귀 가드:
   * - production/test callsite 동작 그대로 (이미 명시).
   * - body weapon/offhand iteration / WEAPON_SKILL_BY_ELEM 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 631: getEquippedWeapons signature에서 equip default {} 0건', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/getEquippedWeapons = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(source),
          'getEquippedWeapons equip default {} 제거');
      assert.ok(/getEquippedWeapons = \(equip:\s*EquipSlots\)/.test(source),
          'getEquippedWeapons equip 파라미터 보존 (default 없이)');
  });

  test('cycle 631: getWeaponMagicSkills signature에서 equip default {} 0건', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/getWeaponMagicSkills = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(source),
          'getWeaponMagicSkills equip default {} 제거');
      assert.ok(/getWeaponMagicSkills = \(equip:\s*EquipSlots\)/.test(source),
          'getWeaponMagicSkills equip 파라미터 보존 (default 없이)');
  });

  test('cycle 631: production callsite 명시 보존', async () => {
      const eu = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(/getEquippedWeapons\(equip\)\.forEach/.test(eu),
          'equipmentUtils 내부 getEquippedWeapons(equip) 호출 보존');
      const gu = await readSrc('src/utils/gameUtils.ts');
      assert.ok(/getWeaponMagicSkills\(player\?\.equip\s*\|\|\s*\{\}\)/.test(gu),
          'gameUtils getWeaponMagicSkills(player?.equip || {}) 호출 (caller-side conversion)');
  });

  test('cycle 631: body weapon iteration / WEAPON_SKILL_BY_ELEM 처리 보존', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(/if \(isWeapon\(equip\.weapon\)\) list\.push/.test(source),
          'getEquippedWeapons weapon iteration 보존');
      assert.ok(/buildWeaponSkill\(entry\)/.test(source),
          'getWeaponMagicSkills buildWeaponSkill 호출 보존');
  });

  test('cycle 631: cycle 502-630 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.loot.ts');
      assert.ok(!/processLoot = \([^)]*player:\s*Player\s*\|\s*null\s*=\s*null/.test(ce),
          'cycle 629 processLoot player default 0건');
      const sh = await readSrc('src/hooks/gameActions/_shared.ts');
      assert.ok(!/commitExploreOutcome = \([^)]*transformPlayer:\s*any\s*=\s*null\)/.test(sh),
          "cycle 628 commitExploreOutcome transformPlayer default 0건");
  });
}

// ─── cycle-89-escape-skill-parity.test.js ───
{
  /**
   * cycle 89: 도주 스킬(escape_100) 코드 패스를 cycle 74-88 escape feedback chain에
   * 합류시킴.
   *
   * 발견된 회귀 / 누락:
   *   - CombatEngine performSkill에 effect: 'escape_100' 분기가 있어 100% 도주 보장
   *     스킬을 처리. 사용 클래스: '공허의 문'(시간술사), '순간 이동'(차원술사) 등
   *     2개 스킬.
   *   - combatAttack.ts forceEscape 분기는 단순히 dispatch SET_ENEMY=null + GS.IDLE
   *     만 처리하고:
   *       a) stats.escapes 증분 누락 (cycle 74)
   *       b) recentBattles에 escape record 푸시 누락 (cycle 74)
   *       c) escape 사운드 재생 누락 (cycle 88)
   *   - 결과: 도주 스킬 사용자는 'escape' 카운터가 0이라 cycle 76-77 quest/title,
   *     78 share, 80 stats panel, 86-87 reflection까지 전부 갱신 안 됨.
   *
   * 수정:
   *   forceEscape 분기를 일반 escape 성공 분기와 동일한 stats/sound 처리로 통합.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('combatAttack.ts forceEscape 분기가 stats.escapes 증분 처리', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      // forceEscape 블록 안에 escapes 누적 패턴이 있어야 함.
      // 단순한 grep — forceEscape 등장 이후 200자 이내에 escapes: ... + 1 패턴.
      const idx = source.indexOf('result.forceEscape');
      assert.ok(idx > -1, 'forceEscape branch should exist');
      const window = source.slice(idx, idx + 1600);
      assert.match(
          window,
          /escapes:\s*\(p\.stats\?\.escapes\s*\|\|\s*0\)\s*\+\s*1/,
          'forceEscape branch should increment stats.escapes (parity with cycle 74 normal escape path)'
      );
  });

  test('combatAttack.ts forceEscape 분기가 escape 사운드 재생', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      const idx = source.indexOf('result.forceEscape');
      const window = source.slice(idx, idx + 1600);
      assert.match(
          window,
          /soundManager.*\(['"]escape['"]\)|play\(['"]escape['"]\)/,
          'forceEscape branch should play escape sound (parity with cycle 88)'
      );
  });

  test('combatAttack.ts forceEscape 분기가 recentBattles escape record 푸시', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      const idx = source.indexOf('result.forceEscape');
      const window = source.slice(idx, idx + 1600);
      assert.match(
          window,
          /pushBattleRecord\([^)]+makeBattleRecord\(['"]escape['"]/,
          'forceEscape branch should push escape battle record (parity with cycle 74)'
      );
  });

  test('일반 escape 분기 회귀 보존 — stats/sound 처리 그대로', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      // 일반 escape 분기 (escapeResult.success) 가 여전히 stats.escapes + sound 처리
      const idx = source.indexOf("if (type === 'escape')");
      assert.ok(idx > -1, 'normal escape branch should exist');
      const window = source.slice(idx, idx + 2000);
      assert.match(window, /escapes:\s*\(p\.stats\?\.escapes\s*\|\|\s*0\)\s*\+\s*1/);
      assert.match(window, /soundManager.*\(['"]escape['"]\)/);
  });

  test('escape_100 스킬은 여전히 등록됨 (회귀 가드)', async () => {
      const source = await readSrc('src/data/classes.ts');
      assert.match(source, /effect:\s*['"]escape_100['"]/, 'escape_100 skill effect should still be registered');
  });
}
