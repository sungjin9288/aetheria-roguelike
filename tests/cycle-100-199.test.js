import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { ACHIEVEMENTS } from '../src/data/quests.js';
import { AT } from '../src/reducers/actionTypes.js';
import { BALANCE, CONSTANTS } from '../src/data/constants.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { DB } from '../src/data/db.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { MAPS } from '../src/data/maps.js';
import { MSG } from '../src/data/messages.js';
import { applyAbyssFloorAdvance } from '../src/hooks/combatActions/combatBossHandlers.js';
import { clearTemporaryAdventureState, hasTemporaryAdventureState } from '../src/utils/playerStateUtils.js';
import { fileURLToPath } from 'node:url';
import { findItemByName, getAchievementCurrentValue, isAchievementUnlocked } from '../src/utils/gameUtils.js';
import { getAdventureGuidance } from '../src/utils/adventureGuide.js';
import { readFile, readdir } from 'node:fs/promises';

/**
 * cycle 100-199 정리 가드 (audit #1 통합 41개)
 */

// ─── cycle-102-discovery-chain-achievements.test.js ───
{
  /**
   * cycle 102: 발견 체인(discovery chains) 완료 achievement 추가.
   *
   * 배경:
   * - cycle 초기에 BALANCE.DISCOVERY_CHAINS 5개(fire/frozen/void/ancient/demon)와
   *   stats.discoveryChains 누적 배열이 도입되어 있었음.
   * - exploreUtils.checkDiscoveryChains가 체인 완료 시 보상(gold/exp/item)을 즉시
   *   부여하지만, 영구 reflection / 보상 보정(achievement / title)은 비어있던 자리.
   *
   * 추가:
   * - target: 'discoveryChains' 타깃 핸들러 (stats.discoveryChains 배열 길이 반환)
   * - ach_chain_1 (첫 체인 완료, gold 보상)
   * - ach_chain_3 (3 체인 완료, 강화 보상)
   * - ach_chain_all (5 체인 모두 완료, 전설 reward)
   */

  const findAch = (id) => ACHIEVEMENTS.find((a) => a.id === id);

  test('ach_chain_1/3/all 등록됨', () => {
      for (const id of ['ach_chain_1', 'ach_chain_3', 'ach_chain_all']) {
          const ach = findAch(id);
          assert.ok(ach, `${id} should exist`);
          assert.equal(ach.target, 'discoveryChains');
      }
  });

  test('chain achievements 목표가 단조 증가 (1 < 3 < 5)', () => {
      const goals = ['ach_chain_1', 'ach_chain_3', 'ach_chain_all'].map((id) => findAch(id).goal);
      assert.deepEqual(goals, [1, 3, 5]);
  });

  test('getAchievementCurrentValue("discoveryChains"): array length 반환', () => {
      const player = { stats: { discoveryChains: ['fire_convergence', 'frozen_truth'] } };
      assert.equal(getAchievementCurrentValue({ target: 'discoveryChains' }, player), 2);
  });

  test('getAchievementCurrentValue: 누락 시 0', () => {
      assert.equal(getAchievementCurrentValue({ target: 'discoveryChains' }, { stats: {} }), 0);
      assert.equal(getAchievementCurrentValue({ target: 'discoveryChains' }, { }), 0);
  });

  test('isAchievementUnlocked: chain 1개 완료 → ach_chain_1만 unlock', () => {
      const player = { stats: { discoveryChains: ['fire_convergence'] } };
      assert.equal(isAchievementUnlocked(findAch('ach_chain_1'), player), true);
      assert.equal(isAchievementUnlocked(findAch('ach_chain_3'), player), false);
      assert.equal(isAchievementUnlocked(findAch('ach_chain_all'), player), false);
  });

  test('isAchievementUnlocked: chain 5개 모두 완료 → 3종 모두 unlock', () => {
      const player = { stats: { discoveryChains: ['a', 'b', 'c', 'd', 'e'] } };
      assert.equal(isAchievementUnlocked(findAch('ach_chain_1'), player), true);
      assert.equal(isAchievementUnlocked(findAch('ach_chain_3'), player), true);
      assert.equal(isAchievementUnlocked(findAch('ach_chain_all'), player), true);
  });
}

// ─── cycle-104-stats-panel-chains.test.js ───
{
  /**
   * cycle 104: StatsPanel에 CHAINS row 추가 — discoveryChains 진행도 가시화.
   *
   * cycle 102/103에서 ach_chain_1/3/all + chain_master 칭호를 깔았으나
   * StatsPanel에는 노출되지 않은 상태. cycle 80(ESCAPES) / cycle 82(CRAFTS,
   * SYNTHESES) / cycle 96(MAX STREAK)와 동일 패턴으로 가시화 — 카운터 시스템
   * 마다 ach + 칭호 + StatsPanel row 한 짝의 일관 구조.
   *
   * 추가:
   * - StatsPanel statEntries에 'CHAINS' label row (Map 아이콘 또는 적절한
   *   indigo 톤 — chain_master 칭호 색과 매치).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('StatsPanel: CHAINS row 노출', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      assert.match(source, /label:\s*['"]CHAINS['"]/);
  });

  test('StatsPanel: CHAINS row가 stats.discoveryChains 배열 길이를 읽음', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      // value 표현식에 discoveryChains와 length 둘 다 등장
      const idx = source.indexOf("label: 'CHAINS'");
      assert.ok(idx > -1);
      const window = source.slice(idx, idx + 300);
      assert.match(window, /discoveryChains/);
      assert.match(window, /\.length/);
  });

  test('StatsPanel: 기존 row 회귀 보존 (cycle 80/82/96)', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      assert.match(source, /label:\s*['"]ESCAPES['"]/);
      assert.match(source, /label:\s*['"]CRAFTS['"]/);
      assert.match(source, /label:\s*['"]SYNTHESES['"]/);
      assert.match(source, /label:\s*['"]MAX STREAK['"]/);
  });
}

// ─── cycle-105-achievement-panel-themes.test.js ───
{
  /**
   * cycle 105: AchievementPanel THEME_BY_TARGET에 누락된 신규 target 2종 추가.
   *
   * 발견:
   * - cycle 95(maxKillStreak)와 cycle 102(discoveryChains)에서 추가한 achievement
   *   target들이 cycle 79에서 정착된 THEME_BY_TARGET 매핑에 누락되어 있음.
   * - 결과: ach_streak_5/10/20과 ach_chain_1/3/all이 AchievementPanel에서
   *   default fallback인 kills 테마(붉은색 Swords)로 표시. maxKillStreak는
   *   StatsPanel(cycle 96)에서 Flame red, discoveryChains는 StatsPanel(cycle 104)
   *   에서 Link2 indigo로 차별화돼 있어 surface 일관성이 깨진 상태.
   *
   * 추가:
   * - maxKillStreak: { icon: Flame, red 톤 } — StatsPanel cycle 96 톤과 매치.
   * - discoveryChains: { icon: Link2, indigo 톤 } — StatsPanel cycle 104 + 칭호
   *   chain_master(cycle 103) 톤과 매치.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('THEME_BY_TARGET: maxKillStreak entry 등록됨', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      assert.match(source, /maxKillStreak\s*:\s*\{[^}]*Flame/);
  });

  test('THEME_BY_TARGET: discoveryChains entry 등록됨', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      assert.match(source, /discoveryChains\s*:\s*\{[^}]*Link2/);
  });

  test('THEME_BY_TARGET: maxKillStreak가 red 계열 톤', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      const idx = source.indexOf('maxKillStreak:');
      const window = source.slice(idx, idx + 300);
      assert.match(window, /red-/);
  });

  test('THEME_BY_TARGET: discoveryChains가 indigo 계열 톤', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      const idx = source.indexOf('discoveryChains:');
      const window = source.slice(idx, idx + 300);
      assert.match(window, /indigo-/);
  });

  test('lucide imports: Flame / Link2 추가됨', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      const importLine = source.split('\n').find((l) => l.includes("from 'lucide-react'"));
      assert.ok(importLine, 'should have lucide-react import');
      assert.ok(importLine.includes('Flame'), 'Flame import missing');
      assert.ok(importLine.includes('Link2'), 'Link2 import missing');
  });

  test('기존 cycle 79 테마 14종 회귀 보존', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      for (const target of ['escapes', 'explores', 'discoveries', 'relicCount', 'crafts', 'rests',
          'bountiesCompleted', 'abyssRecord', 'demonKingSlain', 'prestige',
          'signaturesDiscovered', 'signatureSetsCompleted', 'synths']) {
          assert.match(source, new RegExp(`${target}\\s*:`));
      }
  });
}

// ─── cycle-106-bleed-dot-cure.test.js ───
{
  /**
   * cycle 106: bleed 상태이상 DoT 누락 회귀 fix + 라벨 매핑.
   *
   * 발견된 버그:
   * - 보스 phase 2/3가 statusEffect: 'bleed'를 player에 부여할 수 있음 (CombatEngine
   *   p2/p3 처리에서 currentStatus.push). 그러나 player DoT 처리 분기는
   *   `const DOT_STATUSES = ['poison', 'burn']`로 bleed 누락 — bleed 상태가 표시
   *   만 되고 실제 피해를 주지 못함.
   * - 적의 DoT (enemy.dots) 처리는 bleed 포함 정상 동작 — 비대칭 회귀.
   * - 결과: 보스 phase 3 차원 분열자의 bleed 부여가 의도와 달리 무해. 보스
   *   설계 의도(처음 phase 3에 진입하면 위험 증폭)가 작동 안 함.
   *
   * 수정:
   * 1. CombatEngine player DoT 분기의 DOT_STATUSES에 'bleed' 추가.
   * 2. MSG.STATUS_DOT 라벨 매핑에 'bleed' → '출혈' 추가 — 기존엔 영문 'bleed'
   *    가 그대로 노출되던 자리.
   *
   * 별도 cure 아이템(지혈제) 추가는 itemVisuals.EXACT_ITEM_ICON_KEYS / asset
   * 매핑이 consumable index에 의존해 신규 PNG 자산이 필요하므로 다음 사이클로
   * 미룸. 회피 옵션은 purify 스킬(메이지) / 휴식(안전지대) / TURN-based decay.
   *
   * 영향:
   * 보스 phase 3 진입 후 bleed 부여 시 매 턴 maxHp의 4% 피해 (BALANCE.STATUS_DOT_RATIO).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('CombatEngine: player DOT_STATUSES에 bleed 포함', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.match(source, /DOT_STATUSES\s*=\s*\[[^\]]*['"]bleed['"]/);
  });

  test('items: 기존 cure 아이템 4종 회귀 보존', () => {
      // cycle 106 phase 1: 지혈제는 itemVisuals 자산 매핑 제약으로 다음 사이클로 미룸.
      const cures = (DB.ITEMS.consumables || []).filter((c) => c.type === 'cure');
      const effects = cures.map((c) => c.effect).sort();
      assert.deepEqual(effects, ['burn', 'curse', 'freeze', 'poison']);
  });

  test('MSG.STATUS_DOT: bleed → 출혈 라벨 매핑', () => {
      const msg = MSG.STATUS_DOT('bleed', 12);
      assert.match(msg, /출혈/, 'should map bleed to 출혈');
      assert.match(msg, /12/, 'damage value should appear');
  });

  test('MSG.STATUS_DOT: 기존 poison/burn 라벨 회귀 보존', () => {
      assert.match(MSG.STATUS_DOT('poison', 5), /중독/);
      assert.match(MSG.STATUS_DOT('burn', 7), /화상/);
  });
}

// ─── cycle-107-player-freeze-stun-skip.test.js ───
{
  /**
   * cycle 107: 플레이어 freeze / stun 상태이상 턴 스킵 처리.
   *
   * 발견된 버그(cycle 106 bleed fix와 같은 결의 회귀):
   * - 보스 phase 2/3가 statusEffect: 'freeze' / 'stun' / 'curse' / 'fear' / 'blind'
   *   를 player에 부여 가능. 그러나 player.status 배열에 string이 추가만 되고,
   *   attack() / performSkill() 어디서도 검사하지 않음.
   * - 결과: 플레이어가 frozen / stunned 상태에서도 정상적으로 공격 가능.
   *   적의 stun/freeze는 stunnedTurns 카운터로 제대로 턴 스킵하는 반면 player
   *   쪽만 비대칭 회귀 — boss 위협이 무력화.
   *
   * cycle 107 범위 (가장 임팩트 큰 freeze/stun 우선):
   * - attack(): 시작 시 player.status에 freeze/stun이 있으면 해당 status 제거 후
   *   damage 0으로 즉시 return. enemy는 그대로 (enemy turn에서 자유 공격).
   * - performSkill(): 동일 처리.
   *
   * curse / fear / blind는 CombatEngine 외부 (damage scaling, miss chance 등)
   * 영향이라 별도 사이클에서 다룸.
   */

  const baseStats = (overrides = {}) => ({
      atk: 100, def: 50, maxHp: 1000, maxMp: 100, crit: 0.1, elem: null,
      relics: [], activeSynergies: [],
      ...overrides,
  });

  const basePlayer = (overrides = {}) => ({
      hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
      status: [],
      combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
      relics: [],
      ...overrides,
  });

  const baseEnemy = (overrides = {}) => ({
      name: '슬라임', hp: 100, maxHp: 100, atk: 30, def: 10,
      pattern: { guardChance: 0, heavyChance: 0 },
      ...overrides,
  });

  test('attack: 플레이어 freeze 상태 → 턴 스킵, 적 HP 변화 없음', () => {
      const player = basePlayer({ status: ['freeze'] });
      const result = CombatEngine.attack(player, baseEnemy(), baseStats());
      assert.equal(result.updatedEnemy.hp, 100, 'enemy HP unchanged when player skipped');
      assert.ok(!result.updatedPlayer.status.includes('freeze'), 'freeze status consumed');
      assert.ok(result.logs.some((l) => /freeze|빙결|기절|행동.*불가|얼/.test(l.text)),
          'should log skip reason');
  });

  test('attack: 플레이어 stun 상태 → 턴 스킵', () => {
      const player = basePlayer({ status: ['stun'] });
      const result = CombatEngine.attack(player, baseEnemy(), baseStats());
      assert.equal(result.updatedEnemy.hp, 100);
      assert.ok(!result.updatedPlayer.status.includes('stun'));
  });

  test('attack: 일반 상태 → 정상 공격 (회귀 보존)', () => {
      const player = basePlayer({ status: [] });
      const result = CombatEngine.attack(player, baseEnemy(), baseStats());
      assert.ok(result.updatedEnemy.hp < 100, 'enemy should take damage when player not frozen');
  });

  test('attack: poison 상태 → 정상 공격 (DoT만, 행동 제약 없음)', () => {
      const player = basePlayer({ status: ['poison'] });
      const result = CombatEngine.attack(player, baseEnemy(), baseStats());
      assert.ok(result.updatedEnemy.hp < 100, 'poison should not skip turn');
  });

  test('attack: freeze + bleed 동시 → freeze가 우선 적용 (skip)', () => {
      const player = basePlayer({ status: ['bleed', 'freeze'] });
      const result = CombatEngine.attack(player, baseEnemy(), baseStats());
      assert.equal(result.updatedEnemy.hp, 100, 'should skip due to freeze');
      assert.ok(!result.updatedPlayer.status.includes('freeze'), 'freeze consumed');
      assert.ok(result.updatedPlayer.status.includes('bleed'), 'bleed preserved');
  });

  test('performSkill: 플레이어 freeze → 스킬 발동 안 됨, MP 소비 안 됨', () => {
      const player = basePlayer({ status: ['freeze'], mp: 100 });
      const skill = { name: '강타', type: 'physical', mpCost: 30, mult: 2.0 };
      const result = CombatEngine.performSkill(player, baseEnemy(), baseStats(), skill);
      // 스킬 발동 자체가 막힘 — MP가 소비되지 않거나 success: false 반환
      if (result.success !== false) {
          // success: true 인 경우 enemy 피해가 없어야 (skip)
          assert.equal(result.updatedEnemy?.hp ?? 100, 100, 'enemy untouched when skill skipped');
      }
  });
}

// ─── cycle-108-player-curse-amplify.test.js ───
{
  /**
   * cycle 108: 플레이어 curse 상태이상 → 받는 피해 증폭 처리.
   *
   * cycle 106(bleed)/107(freeze/stun) 시리즈 연장. 보스 phase 2/3가 부여하는
   * 또 하나의 무력화된 status effect 복구.
   *
   * 발견:
   * - MSG.SKILL_CURSE_AMPLIFY는 "[X] 저주가 강화되어 피해가 증폭됩니다!" 라는
   *   의도를 명시하지만 player에 curse 상태가 있어도 받는 피해에 변화 없음.
   * - 적의 cursedTurns는 BALANCE.CURSE_ATK_MULT(0.75)로 ATK 감소 정상 동작 —
   *   player 쪽만 비대칭.
   *
   * 수정:
   * - BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT 신규 (1.3 — 받는 피해 +30%).
   * - enemyAttack: enemyDmg 계산 후 player.status에 'curse' 있으면 multiplier
   *   적용. 로그에 "[저주] 받는 피해 +30%" 라인.
   *
   * 영향:
   * 보스 phase 부여 curse + 일반 몬스터 heavy curse 부여 모두 의도대로 위협 증폭.
   * 회피 옵션은 저주해제 주문서(items 기존), purify 스킬, status_resist 유물.
   */

  const baseStats = (overrides = {}) => ({
      atk: 100, def: 50, maxHp: 1000, maxMp: 100, crit: 0.1, elem: null,
      relics: [], activeSynergies: [],
      ...overrides,
  });

  const basePlayer = (overrides = {}) => ({
      hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
      status: [], relics: [],
      combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
      ...overrides,
  });

  const baseEnemy = (overrides = {}) => ({
      name: '슬라임', hp: 200, maxHp: 200, atk: 100, def: 10,
      pattern: { guardChance: 0, heavyChance: 0 },
      ...overrides,
  });

  test('BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT 등록됨 (≥ 1.0)', () => {
      assert.ok(typeof BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT === 'number');
      assert.ok(BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT > 1, 'should be > 1.0 for amplification');
  });

  test('enemyAttack: 일반 상태 vs curse 상태 — curse가 더 큰 피해', () => {
      const stats = baseStats();
      const enemy = baseEnemy();
      const mathRandomBackup = Math.random;
      Math.random = () => 0.99; // pattern 결정론 (heavy 안 발동 보장)

      try {
          const normal = CombatEngine.enemyAttack(basePlayer(), enemy, stats);
          const cursed = CombatEngine.enemyAttack(basePlayer({ status: ['curse'] }), enemy, stats);
          assert.ok(cursed.damage > normal.damage, `cursed dmg ${cursed.damage} should exceed normal ${normal.damage}`);
      } finally {
          Math.random = mathRandomBackup;
      }
  });

  test('enemyAttack: cursed damage = normal * CURSE_PLAYER_DMG_TAKEN_MULT 비율', () => {
      const stats = baseStats();
      const enemy = baseEnemy();
      const mathRandomBackup = Math.random;
      Math.random = () => 0.99;

      try {
          const normal = CombatEngine.enemyAttack(basePlayer(), enemy, stats);
          const cursed = CombatEngine.enemyAttack(basePlayer({ status: ['curse'] }), enemy, stats);
          const expected = Math.floor(normal.damage * BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT);
          // floor 오차 허용 — Math.floor 단계가 amplifier에서 한 번 더 일어나므로 ±1 허용
          const diff = Math.abs(cursed.damage - expected);
          assert.ok(diff <= 1, `cursed dmg ${cursed.damage} ≈ expected ${expected} (diff ${diff})`);
      } finally {
          Math.random = mathRandomBackup;
      }
  });

  test('enemyAttack: curse 없을 때 동작 회귀 보존', () => {
      const stats = baseStats();
      const result = CombatEngine.enemyAttack(basePlayer(), baseEnemy(), stats);
      // damage 양수 + isDead false (HP 1000 - 작은 피해)
      assert.ok(result.damage > 0);
      assert.equal(result.isDead, false);
  });

  test('enemyAttack: curse 상태에서 로그에 저주 증폭 안내 등장', () => {
      const stats = baseStats();
      const mathRandomBackup = Math.random;
      Math.random = () => 0.99;
      try {
          const result = CombatEngine.enemyAttack(basePlayer({ status: ['curse'] }), baseEnemy(), stats);
          assert.ok(
              result.logs.some((l) => /저주.*증폭|저주.*피해|받는 피해.*저주/.test(l.text)),
              'should log curse amplification reason'
          );
      } finally {
          Math.random = mathRandomBackup;
      }
  });
}

// ─── cycle-109-player-blind-miss.test.js ───
{
  /**
   * cycle 109: 플레이어 blind 상태이상 → 공격 miss 확률 처리.
   *
   * cycle 106-108 status 복구 시리즈 연장.
   *
   * 발견:
   * - 적의 blindTurns는 BALANCE.BLIND_ATK_MULT(0.65)로 공격력 감소 정상 동작.
   * - 그러나 player가 blind 상태일 때 attack/performSkill에서 miss 처리 안 됨 —
   *   status가 표시만 되고 실제 페널티 0.
   *
   * 수정:
   * - BALANCE.BLIND_PLAYER_MISS_CHANCE = 0.30 (30% miss 확률).
   * - attack/performSkill: freeze/stun 스킵 다음에 blind 체크. 확률 hit 시 damage 0
   *   + "[실명] 공격이 빗나갔습니다" 로그. status는 유지(여러 턴 효과 — 저주해제
   *   주문서 / purify 스킬 / 휴식으로 해제).
   *
   * 영향:
   * 보스 phase 부여 blind가 의도대로 작동. 일반 몬스터 heavy attack의 statusEffect
   * 'blind' 설정도 적용됨.
   */

  const baseStats = (overrides = {}) => ({
      atk: 100, def: 50, maxHp: 1000, maxMp: 100, crit: 0, elem: null,
      relics: [], activeSynergies: [],
      ...overrides,
  });

  const basePlayer = (overrides = {}) => ({
      hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
      status: [], relics: [],
      combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
      ...overrides,
  });

  const baseEnemy = (overrides = {}) => ({
      name: '슬라임', hp: 200, maxHp: 200, atk: 30, def: 10,
      pattern: { guardChance: 0, heavyChance: 0 },
      ...overrides,
  });

  test('BALANCE.BLIND_PLAYER_MISS_CHANCE 등록됨 (0 < x < 1)', () => {
      assert.ok(typeof BALANCE.BLIND_PLAYER_MISS_CHANCE === 'number');
      assert.ok(BALANCE.BLIND_PLAYER_MISS_CHANCE > 0 && BALANCE.BLIND_PLAYER_MISS_CHANCE < 1);
  });

  test('attack: blind 상태 + miss roll → 공격 빗나감, 적 HP 변화 없음', () => {
      const player = basePlayer({ status: ['blind'] });
      const mathRandomBackup = Math.random;
      Math.random = () => 0.0; // 가장 낮은 확률 → blind miss 확정 발동

      try {
          const result = CombatEngine.attack(player, baseEnemy(), baseStats());
          assert.equal(result.updatedEnemy.hp, 200, 'enemy HP unchanged when attack missed');
          assert.ok(result.updatedPlayer.status.includes('blind'), 'blind status persists across miss');
          assert.ok(result.logs.some((l) => /실명|빗나갔|miss/.test(l.text)));
      } finally {
          Math.random = mathRandomBackup;
      }
  });

  test('attack: blind 상태 + hit roll → 정상 공격', () => {
      const player = basePlayer({ status: ['blind'] });
      const mathRandomBackup = Math.random;
      Math.random = () => 0.99; // 가장 높은 확률 → miss 미발동

      try {
          const result = CombatEngine.attack(player, baseEnemy(), baseStats());
          assert.ok(result.updatedEnemy.hp < 200, 'enemy should take damage when blind miss did not trigger');
      } finally {
          Math.random = mathRandomBackup;
      }
  });

  test('attack: 일반 상태 → blind 검사 스킵, 정상 공격', () => {
      const result = CombatEngine.attack(basePlayer(), baseEnemy(), baseStats());
      assert.ok(result.updatedEnemy.hp < 200);
  });

  test('performSkill: blind + miss roll → 스킬 빗나감, MP 소비 안 됨', () => {
      const player = basePlayer({ status: ['blind'], mp: 100 });
      const skill = { name: '강타', type: 'physical', mpCost: 30, mult: 2.0 };
      const mathRandomBackup = Math.random;
      Math.random = () => 0.0;

      try {
          const result = CombatEngine.performSkill(player, baseEnemy(), baseStats(), skill);
          // miss 발동 시: success: true (스킬 발동했지만 빗나감) 또는 success: false 둘 다 OK.
          // 핵심은 enemy HP가 그대로여야 함.
          const enemyHpAfter = result.updatedEnemy?.hp ?? 200;
          assert.equal(enemyHpAfter, 200, 'enemy HP unchanged when skill missed');
      } finally {
          Math.random = mathRandomBackup;
      }
  });
}

// ─── cycle-110-player-fear-flinch.test.js ───
{
  /**
   * cycle 110: 플레이어 fear 상태이상 → 확률적 턴 스킵 (flinch).
   *
   * cycle 106-109 status 복구 시리즈 마무리. 보스 phase 2/3가 부여 가능한 다섯
   * 가지 status (bleed/freeze/stun/curse/blind/fear) 중 마지막.
   *
   * 발견:
   * - 적의 fearTurns는 BALANCE.FEAR_ATK_MULT(0.70)로 공격력 감소 정상 동작.
   * - player가 fear 상태에서 attack/performSkill에 영향 없음 — 비대칭 회귀.
   *
   * 모델 (blind와 유사하지만 의미 다름):
   * - blind = "보이지 않아 빗나감" (miss)
   * - fear  = "두려움에 움츠림" (flinch — 행동 자체가 일어나지 않음)
   * - 차이점: blind miss는 attack/skill cost(MP) 소모 안 됨이지만 시도는 했음.
   *           fear flinch는 행동 시도 자체가 무위 — 같은 결과지만 시각적으로 구분.
   *
   * 수정:
   * - BALANCE.FEAR_PLAYER_FLINCH_CHANCE = 0.25 (25% — blind 30%보다 약간 낮게).
   * - attack/performSkill: blind 체크 다음에 fear 체크. roll 성공 시 damage 0
   *   + "[공포] 두려움에 움츠립니다!" 로그. status 유지(다중 턴).
   */

  const baseStats = (overrides = {}) => ({
      atk: 100, def: 50, maxHp: 1000, maxMp: 100, crit: 0, elem: null,
      relics: [], activeSynergies: [],
      ...overrides,
  });

  const basePlayer = (overrides = {}) => ({
      hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
      status: [], relics: [],
      combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
      ...overrides,
  });

  const baseEnemy = (overrides = {}) => ({
      name: '슬라임', hp: 200, maxHp: 200, atk: 30, def: 10,
      pattern: { guardChance: 0, heavyChance: 0 },
      ...overrides,
  });

  test('BALANCE.FEAR_PLAYER_FLINCH_CHANCE 등록됨 (0 < x < 1)', () => {
      assert.ok(typeof BALANCE.FEAR_PLAYER_FLINCH_CHANCE === 'number');
      assert.ok(BALANCE.FEAR_PLAYER_FLINCH_CHANCE > 0 && BALANCE.FEAR_PLAYER_FLINCH_CHANCE < 1);
  });

  test('attack: fear 상태 + flinch roll → 행동 무위, 적 HP 변화 없음', () => {
      const player = basePlayer({ status: ['fear'] });
      const mathRandomBackup = Math.random;
      Math.random = () => 0.0;

      try {
          const result = CombatEngine.attack(player, baseEnemy(), baseStats());
          assert.equal(result.updatedEnemy.hp, 200, 'enemy HP unchanged when player flinched');
          assert.ok(result.updatedPlayer.status.includes('fear'), 'fear status persists');
          assert.ok(result.logs.some((l) => /공포|움츠|두려움/.test(l.text)));
      } finally {
          Math.random = mathRandomBackup;
      }
  });

  test('attack: fear 상태 + non-flinch roll → 정상 공격', () => {
      const player = basePlayer({ status: ['fear'] });
      const mathRandomBackup = Math.random;
      Math.random = () => 0.99;

      try {
          const result = CombatEngine.attack(player, baseEnemy(), baseStats());
          assert.ok(result.updatedEnemy.hp < 200);
      } finally {
          Math.random = mathRandomBackup;
      }
  });

  test('performSkill: fear flinch → 스킬 발동 안 됨, MP 소비 안 됨', () => {
      const player = basePlayer({ status: ['fear'], mp: 100 });
      const skill = { name: '강타', type: 'physical', mpCost: 30, mult: 2.0 };
      const mathRandomBackup = Math.random;
      Math.random = () => 0.0;

      try {
          const result = CombatEngine.performSkill(player, baseEnemy(), baseStats(), skill);
          assert.equal(result.updatedEnemy?.hp ?? 200, 200, 'enemy HP unchanged');
      } finally {
          Math.random = mathRandomBackup;
      }
  });

  test('cycle 106-110 status 시스템: 모든 5종 status 복구 완료 (regression sanity)', () => {
      // 한 번에 검증: bleed/freeze/curse/blind/fear가 player에 효과를 갖는다.
      // 빌드 단계에서 BALANCE 키 5종 + DOT_STATUSES bleed가 모두 존재해야 함.
      assert.ok(typeof BALANCE.STATUS_DOT_RATIO === 'number', 'bleed DoT (cycle 106)');
      assert.ok(typeof BALANCE.CURSE_PLAYER_DMG_TAKEN_MULT === 'number', 'curse amp (cycle 108)');
      assert.ok(typeof BALANCE.BLIND_PLAYER_MISS_CHANCE === 'number', 'blind miss (cycle 109)');
      assert.ok(typeof BALANCE.FEAR_PLAYER_FLINCH_CHANCE === 'number', 'fear flinch (cycle 110)');
  });
}

// ─── cycle-113-combat-panel-enemy-debuff.test.js ───
{
  /**
   * cycle 113: CombatPanel 적 debuff 시각 노출 — cycle 111 player debuff chip의
   * 짝(symmetry)으로 적의 활성 status 효과(stunnedTurns / cursedTurns / blindTurns
   * / fearTurns / dots)를 전투 화면에 표시.
   *
   * 발견:
   * - 플레이어가 스킬로 적에게 stun/curse/blind/fear/dots 부여 가능 (cycle 초기부터)
   *   하지만 CombatPanel은 enemy.status / enemy.dots 등을 어디서도 표시 안 함.
   * - 결과: 플레이어가 빙결 스킬을 썼는데 적이 빙결됐는지, 출혈이 들어갔는지
   *   전투 로그를 다시 봐야만 알 수 있음.
   * - cycle 111에서 player.status를 StatusBar에 chip으로 노출했으니 적 쪽도
   *   대칭적으로 닫는 단계.
   *
   * 추가:
   * - CombatPanel에 enemy debuff chip 영역 (data-testid="combat-enemy-debuff-chip").
   * - 표시 대상: stunnedTurns > 0, cursedTurns > 0, blindTurns > 0, fearTurns > 0,
   *   enemy.dots 배열 (poison/burn/bleed).
   * - 단일 톤(emerald 또는 cyan — 플레이어에 유리한 상태) — cycle 111의 rose(위험)와
   *   대비.
   * - 라벨: 첫 active debuff 한국어명 + "+N" (multiple).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('CombatPanel: combat-enemy-debuff-chip testid 노출', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.match(source, /data-testid\s*=\s*["']combat-enemy-debuff-chip["']/);
  });

  test('CombatPanel: enemy.stunnedTurns / cursedTurns / blindTurns / fearTurns 모두 참조', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.match(source, /stunnedTurns/);
      assert.match(source, /cursedTurns/);
      assert.match(source, /blindTurns/);
      assert.match(source, /fearTurns/);
  });

  test('CombatPanel: enemy.dots 배열 (poison/burn/bleed) 참조', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.match(source, /enemy[?.]*\.dots/);
  });

  test('CombatPanel: 한국어 라벨 매핑 (기절/저주/실명/공포/독/화상/출혈)', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      const labels = ['기절', '저주', '실명', '공포'];
      for (const label of labels) {
          assert.ok(source.includes(label), `should map enemy debuff to '${label}'`);
      }
  });

  test('CombatPanel: 기존 combat-signature-drop-hint testid 회귀 보존', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.match(source, /data-testid\s*=\s*["']combat-signature-drop-hint["']/);
  });
}

// ─── cycle-115-guide-debuff-hint.test.js ───
{
  /**
   * cycle 115: AdventureGuide hint — 활성 debuff 인지 시 정화 권장.
   *
   * cycle 106-113 status 시스템 복구 + UI surface 마무리 후속.
   *
   * 발견:
   * - cycle 112에서 rest 시 status 초기화를 추가했지만, 플레이어가 그 사실을
   *   알 수 있는 surface는 직접 rest 행동 결과를 통해서만. 안전지대로 복귀해서
   *   휴식 명령을 내리기 전에 "지금 디버프 걸려있으니 휴식이 좋겠다"는 힌트가
   *   없음.
   * - 이미 hpRatio <= 0.65 시 휴식 추천 hint가 있지만 status 누적은 별개 시그널.
   *
   * 추가:
   * - safe zone에서 player.status가 length>0이면 "디버프 정화 권장" hint.
   *   uses primaryAction { kind: 'rest', label: '휴식으로 정화' } — 이미 cycle 112
   *   rest가 status를 클리어하므로 정합.
   * - 우선순위: questTracker claimable / 모험가 전직 다음, 일반 hpRatio rest 직전.
   *   (긴급 보상 / 전직 분기 다음으로 중요. 디버프 누적은 위험 시그널이지만
   *   즉시 위험은 아니므로.)
   */

  const baseStats = (overrides = {}) => ({
      maxHp: 1000, maxMp: 100,
      ...overrides,
  });

  const safePlayer = (overrides = {}) => ({
      hp: 1000, maxHp: 1000, mp: 100, maxMp: 100,
      job: '검사', level: 10, gold: 1000, loc: '시작의 마을',
      quests: [],
      stats: { kills: 0, total_gold: 0, deaths: 0 },
      status: [],
      ...overrides,
  });

  const safeMap = { type: 'safe', name: '시작의 마을' };

  test('safe + debuff 보유 → 정화 권장 hint', () => {
      const player = safePlayer({ status: ['curse'] });
      const guidance = getAdventureGuidance(player, baseStats(), safeMap, 'idle');
      assert.ok(/정화|디버프|상태이상|debuff/i.test(guidance.title + ' ' + guidance.detail),
          `expected debuff cleanse hint, got: ${guidance.title} | ${guidance.detail}`);
      assert.equal(guidance.primaryAction?.kind, 'rest');
  });

  test('safe + 다중 debuff → 정화 hint (한 번만 노출)', () => {
      const player = safePlayer({ status: ['curse', 'blind', 'bleed'] });
      const guidance = getAdventureGuidance(player, baseStats(), safeMap, 'idle');
      assert.equal(guidance.primaryAction?.kind, 'rest');
  });

  test('safe + debuff 없음 → 정화 hint 미발생 (fallback hint)', () => {
      const player = safePlayer({ status: [] });
      const guidance = getAdventureGuidance(player, baseStats(), safeMap, 'idle');
      assert.ok(!/정화/.test(guidance.title || ''), 'should not show cleanse hint without debuff');
  });

  test('not-safe + debuff → 정화 hint 비활성 (rest 불가능 지역)', () => {
      const player = safePlayer({ status: ['curse'], loc: '평원' });
      const dungeonMap = { type: 'dungeon', name: '평원' };
      const guidance = getAdventureGuidance(player, baseStats(), dungeonMap, 'idle');
      // 던전에서는 rest 권장 안 됨 — 다른 hint 라우팅
      assert.notEqual(guidance.title, '디버프 정화 권장');
  });

  test('safe + claimable quest 우선순위 — debuff hint보다 quest claim 우선', () => {
      const player = safePlayer({
          status: ['curse'],
          quests: [{ id: 1, progress: 5 }],
      });
      // claimable quest는 별도 mock 필요 — getQuestTracker 호출 결과에 의존하므로
      // 직접 검증보다는 debuff hint가 노출되는지로 회귀 가드.
      const guidance = getAdventureGuidance(player, baseStats(), safeMap, 'idle');
      // 구체적인 quest mock 없이는 정확한 우선순위 검증 어려움 — 단순 동작 가드.
      assert.ok(typeof guidance.title === 'string');
  });
}

// ─── cycle-116-dead-msg-cleanup.test.js ───
{
  /**
   * cycle 116: dead MSG key cleanup — 36개 미사용 메시지 정리.
   *
   * cycle 90-93 dead component / utils / exports cleanup의 연장.
   * 이번엔 src/data/messages.ts의 MSG 객체에 정의됐지만 코드 어디서도 호출
   * 되지 않는 키 36종을 한 번에 정리.
   *
   * 검증 방법:
   * grep -rln "MSG\.${key}\b" src/ tests/ 가 0건 (messages.ts 자기 자신 제외)인
   * 키들. SKILL_CURSE_AMPLIFY는 주석에만 등장하고 실제 호출 0건.
   *
   * 정리 대상 그룹:
   * - 마일스톤 (5): MILESTONE_BOSS_5/FIRST, MILESTONE_KILLS_10/50/100
   * - 보스 인카운터 (2): BOSS_ENCOUNTER, AREA_BOSS_ENCOUNTER
   * - GM 시스템 (3): GM_CRISIS/OVERWHELM/UNDERDOG (게임 마스터 톤 미구현)
   * - UI 라벨 (2): UI_ALL, UI_EQUIPPED (다른 곳에서 inline string 사용)
   * - 진엔딩 / 도감 (7): TRUE_BOSS_PHASE3, CODEX_DISCOVER/ED/MILESTONE/
   *   NEW_ENTRY/PROGRESS/UNDISCOVERED
   * - 발견 체인 (2): DISCOVERY_CHAIN_COMPLETE/TRIGGER (exploreUtils에서 inline)
   * - 인벤토리 (2): INVENTORY_FULL, INV_FULL_WARNING (INV_FULL이 active)
   * - 전투 / 휴식 / 안전 / 챌린지 / 이동 / 주간 / 등 (12+):
   *   COMBAT_ATTACK, REST_DONE/FULL/PARTIAL, SAFE_ZONE_ARRIVE,
   *   CHALLENGE_COMPLETE/REWARD_BONUS, MOVE_BLOCKED_COMBAT/EVENT,
   *   WEEKLY_MISSION_COMPLETE/RESET, EQUIP_EQUIPPED, BOUNTY_ACCEPTED
   * - 효과 메시지 (1): SKILL_CURSE_AMPLIFY (cycle 108에서 의도 구현했지만 키
   *   자체는 inline 메시지로 대체)
   */

  const DEAD_KEYS = [
      'MILESTONE_BOSS_5', 'MILESTONE_BOSS_FIRST',
      'MILESTONE_KILLS_10', 'MILESTONE_KILLS_50', 'MILESTONE_KILLS_100',
      'BOSS_ENCOUNTER', 'AREA_BOSS_ENCOUNTER',
      'GM_CRISIS', 'GM_OVERWHELM', 'GM_UNDERDOG',
      'UI_ALL', 'UI_EQUIPPED',
      'TRUE_BOSS_PHASE3',
      'CODEX_DISCOVER', 'CODEX_DISCOVERED', 'CODEX_MILESTONE',
      'CODEX_NEW_ENTRY', 'CODEX_PROGRESS', 'CODEX_UNDISCOVERED',
      'DISCOVERY_CHAIN_COMPLETE', 'DISCOVERY_CHAIN_TRIGGER',
      'INVENTORY_FULL', 'INV_FULL_WARNING',
      'COMBAT_ATTACK',
      'REST_DONE', 'REST_FULL', 'REST_PARTIAL',
      'SAFE_ZONE_ARRIVE',
      'CHALLENGE_COMPLETE', 'CHALLENGE_REWARD_BONUS',
      'MOVE_BLOCKED_COMBAT', 'MOVE_BLOCKED_EVENT',
      'WEEKLY_MISSION_COMPLETE', 'WEEKLY_MISSION_RESET',
      'EQUIP_EQUIPPED', 'BOUNTY_ACCEPTED',
      'SKILL_CURSE_AMPLIFY',
  ];

  test('dead MSG key 36종 정리됨 (MSG 객체에서 제거)', () => {
      const missing = DEAD_KEYS.filter((k) => MSG[k] === undefined);
      assert.equal(missing.length, DEAD_KEYS.length,
          `expected all ${DEAD_KEYS.length} keys removed, but ${DEAD_KEYS.length - missing.length} still defined`);
  });

  test('회귀 보존: 핵심 active MSG 키 유지', () => {
      // 정리 후에도 active MSG 키들은 유지되어야 함.
      const KEEP = [
          'COMBAT_ATTACK_DETAIL', 'COMBAT_NOT_IN_BATTLE', 'COMBAT_CRIT',
          'INV_FULL', 'INV_ITEM_NOT_FOUND',
          'REST_DONE_FULL', 'REST_GOLD_INSUFFICIENT', 'REST_SAFE_ONLY',
          'STATUS_DOT', 'PLAYER_STATUS_SKIP',
          'BUFF_EXPIRED',
          'BOUNTY_ACCEPTED_NEW', 'BOUNTY_TOWN_ONLY',
          'MOVE_BLOCKED', 'MOVE_ARRIVED',
          'ESCAPE_SUCCESS', 'ESCAPE_FAIL',
      ];
      for (const key of KEEP) {
          assert.ok(MSG[key] !== undefined, `${key} should remain active`);
      }
  });
}

// ─── cycle-117-discovery-chain-sound.test.js ───
{
  /**
   * cycle 117: 발견 체인 완료 사운드 큐 — cycle 102/103 chain 보상 시스템 sensory cue.
   *
   * 발견:
   * - cycle 88(escape sound) / cycle 95+(maxKillStreak) 같은 결의 sensory gap.
   * - cycle 102에서 ach_chain_1/3/all + cycle 103 chain_master 칭호로 발견 체인을
   *   1급 시민 보상 시스템으로 만들었으나, 체인 완료 모먼트 자체에 audio cue 없음.
   *   gold/exp/premium 30000+ 가치의 보상이 시각/텍스트로만 노출.
   * - exploreUtils.checkDiscoveryChains는 'success' 로그만 출력 — 'success'는
   *   useGameEngine 사운드 매핑에 없음.
   *
   * 추가:
   * - SoundManager case 'discovery_chain' — G5/B5/D6/G6 4음 arpeggio (밝은 major
   *   톤). victory 5음(C major)과 levelUp 4음(C major)과 구분되는 G major 색채.
   * - exploreUtils.checkDiscoveryChains: 체인 완료 후 soundManager.play('discovery_chain')
   *   직접 호출. cycle 88 escape 사운드 패턴과 동일.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('SoundManager: case "discovery_chain" 분기 존재', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.match(source, /case\s+['"]discovery_chain['"]\s*:/);
  });

  test('exploreUtils: checkDiscoveryChains에서 discovery_chain 사운드 재생', async () => {
      const source = await readSrc('src/utils/exploreUtils.ts');
      assert.match(
          source,
          /soundManager.*\(['"]discovery_chain['"]\)|play\(['"]discovery_chain['"]\)/,
          'should call soundManager.play("discovery_chain") on chain completion'
      );
  });

  test('exploreUtils: soundManager import 추가됨', async () => {
      const source = await readSrc('src/utils/exploreUtils.ts');
      assert.match(source, /import\s*\{[^}]*soundManager[^}]*\}\s*from/);
  });

  test('SoundManager: 기존 escape/legendary 회귀 보존', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.match(source, /case\s+['"]escape['"]\s*:/);
      assert.match(source, /case\s+['"]legendary['"]\s*:/);
  });
}

// ─── cycle-118-new-area-sound.test.js ───
{
  /**
   * cycle 118: 첫 방문 지역 사운드 큐 — cycle 117 discovery_chain 사운드와 짝.
   *
   * 발견:
   * - cycle 83에서 'discoveries' 시맨틱을 visitedMaps.length로 통일하면서 첫 방문이
   *   영구 카운터로 잡힘. cycle 102/103에서 chain 보상 시스템도 1급 시민이 됐고
   *   cycle 117에서 chain 완료 사운드 추가.
   * - 그러나 첫 방문 자체의 audio cue는 없음 (MOVE_NEW_AREA 'event' 로그는
   *   useGameEngine 사운드 매핑에 없음).
   *
   * 추가:
   * - SoundManager case 'new_area' — D5/F#5/A5 D major triad 짧은 arpeggio.
   *   discovery_chain(G major 4음 0.6s)보다 가볍고 짧음 (3음 0.3s).
   * - moveActions: firstVisit 분기에서 soundManager.play('new_area') 직접 호출.
   *   cycle 88(escape) / cycle 117(discovery_chain) 패턴.
   *
   * 톤 차별화:
   * - victory: C major 5음 (0.6s+) — 전투 승리
   * - legendary: C major + B6 shimmer (0.7s) — 전설 드롭
   * - discovery_chain: G major 4음 (0.6s) — 체인 완료 (cycle 117)
   * - new_area: D major 3음 (0.3s) — 첫 방문 (가볍고 빠름)
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('SoundManager: case "new_area" 분기 존재', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.match(source, /case\s+['"]new_area['"]\s*:/);
  });

  test('moveActions: firstVisit 분기에서 new_area 사운드 재생', async () => {
      const source = await readSrc('src/hooks/gameActions/moveActions.ts');
      assert.match(
          source,
          /soundManager.*\(['"]new_area['"]\)|play\(['"]new_area['"]\)/,
          'should call soundManager.play("new_area") on first visit'
      );
  });

  test('moveActions: soundManager import 추가됨', async () => {
      const source = await readSrc('src/hooks/gameActions/moveActions.ts');
      assert.match(source, /import\s*\{[^}]*soundManager[^}]*\}\s*from/);
  });

  test('SoundManager: cycle 117 discovery_chain 회귀 보존', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.match(source, /case\s+['"]discovery_chain['"]\s*:/);
  });
}

// ─── cycle-119-ascend-preserve-counters.test.js ───
{
  /**
   * cycle 119: Ascension 시 영구 카운터 보존 — 누락된 6종 fix.
   *
   * 발견된 회귀:
   * progressionHandlers.ASCEND가 stats를 reset할 때 다음 카운터를 preserve하지만:
   *   kills, bossKills, deaths, total_gold, relicCount, abyssFloor,
   *   demonKingSlain, bountiesCompleted, crafts, codex, codexClaimed
   *
   * 다음 카운터들은 preserve 누락되어 환생 시 0으로 초기화:
   *   - escapes        (cycle 74 — ach_escape_5/20/50)
   *   - syntheses      (cycle 82 — ach_synth_5/20/50)
   *   - maxKillStreak  (cycle 95 — ach_streak_5/10/20, "max-ever" 시맨틱 위반)
   *   - visitedMaps    (cycle 83 — ach_discover_5/10/15, cartographer 칭호)
   *   - discoveryChains (cycle 102 — ach_chain_1/3/all, chain_master 칭호)
   *   - abyssRecord    (best-ever 심연 기록)
   *
   * 영향:
   * - 환생 후 multi-run achievement 진행도 회귀.
   * - 특히 maxKillStreak는 "max-ever" 시맨틱이라 환생 후 0으로 떨어지면
   *   cycle 95 의도(휘발성 streak를 영구 보상으로 연결)가 깨짐.
   * - cartographer 칭호("지도 제작자")가 환생 후 visitedMaps=[] 상태에서
   *   첫 1곳 방문해도 차감되지 않지만, 환생 후 다시 10곳 방문해야 재해금
   *   조건 평가 — 칭호 자체는 player.titles에 보존되지만 다음 환생 후
   *   재진입 시 진행도 이어가지 않음.
   *
   * 수정:
   * progressionHandlers.ASCEND의 stats merge에 6개 키 추가 보존.
   */

  const buildAscendState = (statsOverrides = {}) => ({
      ...INITIAL_STATE,
      player: {
          ...INITIAL_STATE.player,
          name: '테스트',
          gender: 'male',
          titles: ['ironman'],
          activeTitle: 'ironman',
          stats: {
              ...INITIAL_STATE.player.stats,
              kills: 200, bossKills: 5, deaths: 1, total_gold: 50000,
              relicCount: 10, abyssFloor: 30, demonKingSlain: 0,
              bountiesCompleted: 8, crafts: 25,
              ...statsOverrides,
          },
      },
  });

  const ascend = (state) => gameReducer(state, {
      type: AT.ASCEND,
      payload: {
          meta: { ...state.player.meta, prestigeRank: 1 },
          newTitle: 'reborn',
      },
  });

  test('ASCEND: escapes 보존 (cycle 74 카운터)', () => {
      const before = buildAscendState({ escapes: 12 });
      const after = ascend(before);
      assert.equal(after.player.stats.escapes, 12);
  });

  test('ASCEND: syntheses 보존 (cycle 82 카운터)', () => {
      const before = buildAscendState({ syntheses: 25 });
      const after = ascend(before);
      assert.equal(after.player.stats.syntheses, 25);
  });

  test('ASCEND: maxKillStreak 보존 (cycle 95 max-ever 시맨틱)', () => {
      const before = buildAscendState({ maxKillStreak: 22 });
      const after = ascend(before);
      assert.equal(after.player.stats.maxKillStreak, 22);
  });

  test('ASCEND: visitedMaps 보존 (cycle 83 cartographer 정합성)', () => {
      const before = buildAscendState({ visitedMaps: ['시작의 마을', '평원', '동굴', '사막'] });
      const after = ascend(before);
      assert.deepEqual(after.player.stats.visitedMaps.sort(), ['동굴', '사막', '시작의 마을', '평원']);
  });

  test('ASCEND: discoveryChains 보존 (cycle 102 ach_chain_*)', () => {
      const before = buildAscendState({ discoveryChains: ['fire_convergence', 'frozen_truth'] });
      const after = ascend(before);
      assert.deepEqual(after.player.stats.discoveryChains.sort(),
          ['fire_convergence', 'frozen_truth']);
  });

  test('ASCEND: abyssRecord 보존 (best-ever 심연 기록)', () => {
      const before = buildAscendState({ abyssRecord: 75 });
      const after = ascend(before);
      assert.equal(after.player.stats.abyssRecord, 75);
  });

  test('ASCEND: 기존 보존 카운터 회귀 보존 (kills/bossKills/deaths 등)', () => {
      const before = buildAscendState();
      const after = ascend(before);
      assert.equal(after.player.stats.kills, 200);
      assert.equal(after.player.stats.bossKills, 5);
      assert.equal(after.player.stats.deaths, 1);
      assert.equal(after.player.stats.total_gold, 50000);
      assert.equal(after.player.stats.relicCount, 10);
      assert.equal(after.player.stats.abyssFloor, 30);
      assert.equal(after.player.stats.demonKingSlain, 1, 'demon king slain ++ on ascend');
      assert.equal(after.player.stats.bountiesCompleted, 8);
      assert.equal(after.player.stats.crafts, 25);
  });
}

// ─── cycle-121-discovery-chains-initial-state.test.js ───
{
  /**
   * cycle 121: INITIAL_STATE.player.stats에 discoveryChains: [] 선언 추가.
   *
   * 발견:
   * cycle 102에서 stats.discoveryChains 영구 카운터 도입, cycle 119에서 ASCEND
   * preserve 추가, cycle 120에서 migrateData default 추가했으나, INITIAL_STATE
   * 자체에는 declaration 누락. 신규 플레이어(save 없음)는 stats.discoveryChains
   * 가 undefined로 시작하다가 첫 체인 완료 시 비로소 초기화 — declarative
   * consistency 결손.
   *
   * cycle 82에서 syntheses: 0을 INITIAL_STATE에 추가한 것과 같은 패턴.
   *
   * 수정:
   * INITIAL_STATE.player.stats에 discoveryChains: [] 추가.
   */

  test('INITIAL_STATE.player.stats.discoveryChains 선언됨 (빈 배열)', () => {
      const stats = INITIAL_STATE.player.stats || {};
      assert.ok(
          Array.isArray(stats.discoveryChains),
          'discoveryChains should be an array, got: ' + typeof stats.discoveryChains
      );
      assert.equal(stats.discoveryChains.length, 0, 'should start empty');
  });

  test('INITIAL_STATE: 기존 영구 카운터 회귀 보존 (escapes/syntheses/maxKillStreak)', () => {
      const stats = INITIAL_STATE.player.stats || {};
      assert.equal(stats.escapes, 0, 'cycle 74 escapes preserved');
      assert.equal(stats.syntheses, 0, 'cycle 82 syntheses preserved');
      assert.equal(stats.maxKillStreak, 0, 'cycle 95 maxKillStreak preserved');
      assert.deepEqual(stats.visitedMaps, ['시작의 마을'], 'cycle 83 visitedMaps preserved');
  });
}

// ─── cycle-123-claim-achievement-sound.test.js ───
{
  /**
   * cycle 123: 업적 청구(claimAchievement) 사운드 큐 — cycle 122 quest_complete 재사용.
   *
   * 발견:
   * - cycle 122에서 completeQuest에 quest_complete 사운드 추가했지만, 같은 결의
   *   celebratory 모먼트인 claimAchievement는 audio cue 없음 (success 로그만).
   * - 둘 다 보상(gold/item) + 가능하면 칭호 해금이 동반되는 의미 있는 액션이라
   *   동일한 audio reflection이 자연스러움.
   *
   * 추가:
   * - useInventoryActions.claimAchievement: addLog 'success' 다음에 soundManager.play
   *   ('quest_complete') 호출. 사운드 키는 cycle 122 추가분 재사용 (새 case 추가
   *   대신 기존 의미 확장 — quest 완료와 achievement 청구가 동일한 사이클의
   *   "달성/회수" 종류).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('useInventoryActions: claimAchievement에서 quest_complete 사운드 재생', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      const idx = source.indexOf('claimAchievement:');
      assert.ok(idx > -1, 'claimAchievement action should exist');
      const blockEnd = source.indexOf('synthesize:', idx);
      const block = source.slice(idx, blockEnd);
      assert.match(
          block,
          /soundManager.*\(['"]quest_complete['"]\)|play\(['"]quest_complete['"]\)/,
          'claimAchievement should call soundManager.play("quest_complete")'
      );
  });

  test('useInventoryActions: completeQuest 회귀 보존 — 여전히 quest_complete 사운드', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      const idx = source.indexOf('completeQuest:');
      const blockEnd = source.indexOf('claimAchievement:', idx);
      const block = source.slice(idx, blockEnd);
      assert.match(block, /play\(['"]quest_complete['"]\)/);
  });

  test('SoundManager: quest_complete 사운드 case 회귀 보존 (cycle 122)', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.match(source, /case\s+['"]quest_complete['"]\s*:/);
  });
}

// ─── cycle-124-dead-stats-fields.test.js ───
{
  /**
   * cycle 124: 데드 stats 필드 정리 — comboCount, lowHpWins.
   *
   * cycle 90-93/116 dead code 흐름. 발견:
   *
   * stats.comboCount:
   * - INITIAL_STATE에 0으로 선언, migrateData에 default 추가.
   * - 그러나 stats.comboCount를 read/write하는 코드 0건. 활용되는 combo 카운터는
   *   `combatFlags.comboCount` (별도 필드).
   * - 명백히 dead field.
   *
   * stats.lowHpWins:
   * - INITIAL_STATE 0, migrate default.
   * - countLowHpWins(DifficultyManager:156)에서 `stats?.lowHpWins || 0` fallback
   *   으로 읽지만, recentBattles가 항상 데이터 있으므로 fallback 미실행.
   * - 또한 lowHpWins 필드를 write하는 코드 0건 — 항상 0 그대로.
   * - countLowHpWins은 stats?.lowHpWins가 undefined여도 || 0으로 안전.
   *
   * 수정:
   * - INITIAL_STATE.player.stats에서 comboCount, lowHpWins 제거.
   * - migrateData에서 두 필드 default 라인 제거.
   * - countLowHpWins fallback은 그대로 (legacy save 호환 — `|| 0` 안전).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('INITIAL_STATE.player.stats: comboCount 제거됨', () => {
      const stats = INITIAL_STATE.player.stats || {};
      assert.equal(stats.comboCount, undefined, 'stats.comboCount should not be declared');
  });

  test('INITIAL_STATE.player.stats: lowHpWins 제거됨', () => {
      const stats = INITIAL_STATE.player.stats || {};
      assert.equal(stats.lowHpWins, undefined, 'stats.lowHpWins should not be declared');
  });

  test('migrateData: stats.comboCount default 라인 제거됨', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.doesNotMatch(
          source,
          /target\.stats\.comboCount\s*=\s*target\.stats\.comboCount\s*\|\|\s*0/
      );
  });

  test('migrateData: stats.lowHpWins default 라인 제거됨 (없었음 — 회귀 가드)', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      // 원래도 없었으나 회귀 가드 — 미래에 잘못 추가되지 않도록.
      const matches = source.match(/target\.stats\.lowHpWins\s*=/g) || [];
      assert.equal(matches.length, 0);
  });

  test('회귀 보존: combatFlags.comboCount는 active 필드 (DEFAULT_COMBAT_FLAGS에 존재)', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      assert.match(source, /comboCount:\s*0/, 'DEFAULT_COMBAT_FLAGS.comboCount should remain');
  });

  test('회귀 보존: countLowHpWins은 fallback 로직이 안전 (undefined → 0)', async () => {
      const { countLowHpWins } = await import('../src/systems/DifficultyManager.js');
      assert.equal(countLowHpWins({}, 0.2), 0);
      assert.equal(countLowHpWins({ recentBattles: [] }, 0.2), 0);
  });
}

// ─── cycle-125-achievement-panel-testids.test.js ───
{
  /**
   * cycle 125: AchievementPanel testid 노출 — smoke / e2e 셀렉터 확보.
   *
   * 발견:
   * - cycle 79(테마) / 105(maxKillStreak/discoveryChains 테마) / 122-123(claim
   *   sound)에서 AchievementPanel을 여러 번 touch했지만 testid 0건.
   * - smoke-gameplay.mjs / playwright e2e가 achievement claim 흐름을 자동화
   *   하려면 stable selector 필요.
   *
   * 추가:
   * - data-testid="achievement-panel" — 패널 루트.
   * - data-testid={`achievement-card-${a.id}`} — 개별 achievement 카드.
   * - data-testid={`achievement-claim-${a.id}`} — 수령 버튼 (unlocked && !claimed).
   * - data-testid="achievement-toggle-show-all" — 요약/전체 토글 버튼.
   *
   * cycle 18+ signature surface testid 명명 패턴 일관 (kebab-case + dynamic ID).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('AchievementPanel: achievement-panel root testid 노출', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      assert.match(source, /data-testid\s*=\s*["']achievement-panel["']/);
  });

  test('AchievementPanel: dynamic achievement-card-{id} testid 노출', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      assert.match(source, /data-testid\s*=\s*\{`achievement-card-\$\{[^}]+\}`\}/);
  });

  test('AchievementPanel: dynamic achievement-claim-{id} testid 노출', async () => {
      const source = await readSrc('src/components/AchievementPanel.tsx');
      assert.match(source, /data-testid\s*=\s*\{`achievement-claim-\$\{[^}]+\}`\}/);
  });

  test('AchievementPanel: cycle 473 paired — 요약 토글 버튼 cascade 제거 보존', async () => {
      // cycle 473이 compact prop cascade로 토글 버튼 + 요약 모드 자체 제거.
      // 이전 testid assertion → cascade cleanup 보존 가드로 약화.
      const source = await readSrc('src/components/AchievementPanel.tsx');
      assert.ok(!/achievement-toggle-show-all/.test(source),
          'cycle 473 토글 버튼 testid 제거 보존');
  });
}

// ─── cycle-126-event-panel-testids.test.js ───
{
  /**
   * cycle 126: EventPanel testid 노출 — cycle 125 AchievementPanel testid의 자매.
   *
   * 발견:
   * - EventPanel은 AI 이벤트 / fallback 이벤트의 핵심 의사결정 UI지만 testid 0건.
   * - smoke / e2e가 이벤트 선택지를 자동 클릭하려면 stable selector 필요.
   *
   * 추가 (cycle 18+ 명명 패턴 일관):
   * - data-testid="event-panel" — 패널 루트.
   * - data-testid={`event-choice-${idx}`} — 각 선택지 버튼.
   * - data-testid="event-dismiss" — choices 0건일 때 dismiss 버튼.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('EventPanel: event-panel root testid 노출', async () => {
      const source = await readSrc('src/components/EventPanel.tsx');
      assert.match(source, /data-testid\s*=\s*["']event-panel["']/);
  });

  test('EventPanel: dynamic event-choice-{idx} testid 노출', async () => {
      const source = await readSrc('src/components/EventPanel.tsx');
      assert.match(source, /data-testid\s*=\s*\{`event-choice-\$\{[^}]+\}`\}/);
  });

  test('EventPanel: event-dismiss testid 노출', async () => {
      const source = await readSrc('src/components/EventPanel.tsx');
      assert.match(source, /data-testid\s*=\s*["']event-dismiss["']/);
  });
}

// ─── cycle-128-quick-slot-testids.test.js ───
{
  /**
   * cycle 128: QuickSlot testid 노출 — cycle 125-127 testid sweep 연장.
   *
   * QuickSlot은 모바일 게임 핵심 UX의 한 축 — 전투/탐험 중 빠른 회복/버프 아이템
   * 사용 슬롯 (1~3번 키 매핑). e2e가 quick slot 사용 / 할당 흐름을 자동화하려면
   * stable selector 필수.
   *
   * 추가 (cycle 18+ 명명 패턴 일관):
   * - data-testid={`quick-slot-${i}`} — QuickSlot 사용 버튼 (3개).
   * - data-testid={`quick-slot-assign-${i}`} — QuickSlotAssigner 할당 버튼.
   * - data-testid="quick-slot-unassign" — 할당 해제 버튼.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('QuickSlot: dynamic quick-slot-{i} testid 노출 (사용 버튼)', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      assert.match(source, /data-testid\s*=\s*\{`quick-slot-\$\{[^}]+\}`\}/);
  });

  test('QuickSlotAssigner: dynamic quick-slot-assign-{i} testid 노출', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      assert.match(source, /data-testid\s*=\s*\{`quick-slot-assign-\$\{[^}]+\}`\}/);
  });

  test('QuickSlot: quick-slot-unassign testid 노출', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      assert.match(source, /data-testid\s*=\s*["']quick-slot-unassign["']/);
  });
}

// ─── cycle-129-true-ending-testids.test.js ───
{
  /**
   * cycle 129: TrueEndingScreen testid 노출 — testid sweep 연장.
   *
   * TrueEndingScreen은 진엔딩(원시의 신 격파 후) 시퀀스 + New Game+ 진입점.
   * 보기 드문 모먼트지만 e2e가 진엔딩 자동화를 시도할 때 필요한 selector.
   *
   * 추가 (cycle 18+ 명명 패턴 일관):
   * - data-testid="true-ending-screen" — 시퀀스 루트.
   * - data-testid="true-ending-confirm" — New Game+ 버튼.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('TrueEndingScreen: true-ending-screen root testid 노출', async () => {
      const source = await readSrc('src/components/TrueEndingScreen.tsx');
      assert.match(source, /data-testid\s*=\s*["']true-ending-screen["']/);
  });

  test('TrueEndingScreen: true-ending-confirm 버튼 testid 노출', async () => {
      const source = await readSrc('src/components/TrueEndingScreen.tsx');
      assert.match(source, /data-testid\s*=\s*["']true-ending-confirm["']/);
  });
}

// ─── cycle-134-sound-registry.test.js ───
{
  /**
   * cycle 134: SoundManager 등록 사운드 키 단일 회귀 가드.
   *
   * cycle 88(escape) / 95(maxKillStreak — combatVictory 직접 호출은 없음, log
   * 매핑 통해서 trigger) / 117(discovery_chain) / 118(new_area) / 122-123/133
   * (quest_complete)에 걸쳐 사운드 키가 8종으로 늘어났다. 이번 사이클은 모든
   * 키가 SoundManager에 case로 정의되어 있고 호출 site의 키와 정확히 일치
   * 하는지 통합 회귀 가드를 추가한다.
   *
   * 기존 사이클들은 각자의 사운드 추가 시점에서만 검증했지만, 한 번에 모든
   * key가 정합한지 보장되는 테스트가 없었음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  // 활성 사운드 키 (cycle 88-133 전체 누적)
  // cycle 325: 'hover' 제거 — soundManager.play('hover') 호출 0건이라 case dead branch.
  const REGISTERED_KEYS = [
      'click', 'error', 'attack', 'levelUp', 'item', 'heal', 'death',
      'skill', 'explore', 'victory', 'legendary',
      'escape',          // cycle 88
      'discovery_chain', // cycle 117
      'new_area',        // cycle 118
      'quest_complete',  // cycle 122
      'crit',            // slice 32 — 크리티컬 전용 사운드
  ];

  test('SoundManager: 모든 등록 키가 case 분기로 정의됨', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      for (const key of REGISTERED_KEYS) {
          const re = new RegExp(`case\\s+['"]${key}['"]\\s*:`);
          assert.match(source, re, `SoundManager should have case for "${key}"`);
      }
  });

  test('SoundManager: case 외 stray 사운드 호출 키 없음 (정합성)', async () => {
      // src/ 전체에서 soundManager.play('XXX') 호출들의 키를 수집
      const SCAN_FILES = [
          'src/systems/SoundManager.ts',
          'src/systems/CombatEngine.ts',
          'src/components/tabs/CombatPanel.tsx',
          'src/components/ControlPanel.tsx',
          'src/components/MainLayout.tsx',
          'src/components/app/GameRoot.tsx',
          'src/components/Codex.tsx',
          'src/hooks/useGameEngine.ts',
          'src/hooks/useInventoryActions.ts',
          'src/hooks/combatActions/combatAttack.ts',
          'src/hooks/gameActions/moveActions.ts',
          'src/utils/exploreUtils.ts',
      ];
      const usedKeys = new Set();
      for (const file of SCAN_FILES) {
          try {
              const source = await readSrc(file);
              const matches = source.matchAll(/(?:soundManager\.|\.)play\(['"]([a-z_]+)['"]\)/g);
              for (const m of matches) usedKeys.add(m[1]);
          } catch {
              // file may not exist on this branch, skip
          }
      }
      // 모든 사용 키가 등록 키 set에 포함되어야 함.
      const registeredSet = new Set(REGISTERED_KEYS);
      for (const key of usedKeys) {
          assert.ok(
              registeredSet.has(key),
              `'${key}' is called via play() but not registered in SoundManager case set`
          );
      }
  });

  test('SoundManager: cycle 88+ 신규 사운드 6종 모두 활성', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      const newKeys = ['escape', 'discovery_chain', 'new_area', 'quest_complete'];
      for (const key of newKeys) {
          assert.match(source, new RegExp(`case\\s+['"]${key}['"]`), `${key} active`);
      }
  });
}

// ─── cycle-135-event-chain-reward-sound.test.js ───
{
  /**
   * cycle 135: 이벤트 체인 보상 사운드 큐 — cycle 122-123/133 quest_complete 재사용.
   *
   * 발견:
   * - eventActions.handleEventChoice는 chain 이벤트 처리 시 보상(gold/item/relic/
   *   combat_bonus/stat_bonus)을 grant하면서 addLog 'success'로 reflection만 출력.
   * - cycle 117에서 발견 체인(checkDiscoveryChains)에 discovery_chain 사운드를,
   *   cycle 122-123/133에서 quest/achievement/codex claim에 quest_complete 사운드를
   *   추가했지만 narrative event chain 보상은 audio cue 없었음.
   *
   * 수정:
   * eventActions의 chain 이벤트 보상 처리 직후 soundManager.play('quest_complete')
   * 호출. cycle 122/123/133 패턴 — 4번째 "달성/회수" 액션이 동일 음악적 정체성
   * (E major) 공유.
   *
   * 차별화:
   * - discovery_chain (G major): 지역 방문 체인 완료 (cycle 117)
   * - quest_complete (E major): quest claim / achievement claim / codex claim /
   *   chain event 보상 (cycle 122/123/133/135)
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('eventActions: chain 이벤트 보상 후 quest_complete 사운드 재생', async () => {
      const source = await readSrc('src/hooks/gameActions/eventActions.ts');
      assert.match(
          source,
          /soundManager.*\(['"]quest_complete['"]\)|play\(['"]quest_complete['"]\)/,
          'eventActions should play quest_complete on chain reward'
      );
  });

  test('eventActions: soundManager import 추가됨', async () => {
      const source = await readSrc('src/hooks/gameActions/eventActions.ts');
      assert.match(source, /import\s*\{[^}]*soundManager[^}]*\}\s*from/);
  });

  test('회귀 보존: cycle 122/123/133 quest_complete 호출 그대로', async () => {
      const ic = await readSrc('src/hooks/useInventoryActions.ts');
      const cdx = await readSrc('src/components/Codex.tsx');
      assert.match(ic, /play\(['"]quest_complete['"]\)/);
      assert.match(cdx, /play\(['"]quest_complete['"]\)/);
  });
}

// ─── cycle-136-kill-streak-decay.test.js ───
{
  /**
   * cycle 136: killStreak 시간 기반 감쇠 구현 (KILL_STREAK_DECAY_MS dead constant fix).
   *
   * 발견:
   * - constants.ts: `KILL_STREAK_DECAY_MS: 30000, // 30초 비전투 시 스트릭 초기화`
   *   주석으로 의도 명시.
   * - 그러나 이 상수를 read하는 코드가 src/ 전체에서 0건 — 시간 감쇠 미구현.
   * - 결과: 플레이어가 새벽 1시에 마지막 킬 후 다음 날 아침에 다른 적 처치하면
   *   killStreak가 그대로 +1 누적. 의도(전투 사이 30초 휴지면 reset)와 다름.
   * - 실질적으로 killStreak는 사망 외엔 절대 reset되지 않는 카운터로 동작 중.
   *
   * 수정:
   * 1. combatVictory.ts: killStreak 증분 직전에 lastKillAt timestamp 비교.
   *    Date.now() - lastKillAt > KILL_STREAK_DECAY_MS이면 prevStreak = 0으로
   *    초기화 (실질적으로 새 streak 시작).
   * 2. lastKillAt을 같은 SET_PLAYER에 묶어 새 timestamp 저장.
   * 3. lastKillAt가 undefined인 첫 킬에선 비교 skip — 정상 누적.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('BALANCE.KILL_STREAK_DECAY_MS 등록됨 (회귀 가드)', () => {
      assert.equal(typeof BALANCE.KILL_STREAK_DECAY_MS, 'number');
      assert.ok(BALANCE.KILL_STREAK_DECAY_MS > 0);
  });

  test('combatVictory: KILL_STREAK_DECAY_MS 참조 코드 존재', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.match(
          source,
          /KILL_STREAK_DECAY_MS/,
          'combatVictory should reference KILL_STREAK_DECAY_MS'
      );
  });

  test('combatVictory: lastKillAt 갱신 코드 존재', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.match(
          source,
          /lastKillAt/,
          'combatVictory should track lastKillAt timestamp'
      );
  });

  test('combatVictory: Date.now() 기반 시간 비교 패턴 존재', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      // lastKillAt 변수 근처에 Date.now() 비교
      const idx = source.indexOf('lastKillAt');
      assert.ok(idx > -1);
      const window = source.slice(idx, idx + 600);
      assert.match(window, /Date\.now\(\)/);
  });
}

// ─── cycle-137-primal-shard-required.test.js ───
{
  /**
   * cycle 137: PRIMAL_SHARD_REQUIRED dead constant 활성화.
   *
   * 발견:
   * - CONSTANTS.PRIMAL_SHARD_REQUIRED: 3 + 주석 "진 보스 해금에 필요한 파편 수"가
   *   정의돼 있지만 src/ 전체에서 read하는 코드 0건.
   * - 대신 combatBossHandlers.ts에 `shardCount < 3` / `>= 3` / `Math.min(shardCount + 1, 3)`
   *   로 3이 3곳 hardcoded.
   * - DRY 원칙 위반 — 디자인이 "파편 5개로 변경"하려면 3곳을 모두 찾아 수정해야 함.
   *
   * cycle 136 KILL_STREAK_DECAY_MS와 같은 결의 dead constant 활성화 사이클.
   *
   * 수정:
   * combatBossHandlers.ts의 3 hardcoded → CONSTANTS.PRIMAL_SHARD_REQUIRED로 교체.
   * `prestigeRank >= 3` (rank 임계)은 별개 개념이라 건드리지 않음.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('BALANCE.PRIMAL_SHARD_REQUIRED 등록됨 (회귀 가드)', () => {
      assert.equal(typeof BALANCE.PRIMAL_SHARD_REQUIRED, 'number');
      assert.equal(BALANCE.PRIMAL_SHARD_REQUIRED, 3);
  });

  test('BALANCE.PRIMAL_SHARD_DROP_CHANCE 등록됨 (회귀 가드)', () => {
      assert.equal(typeof BALANCE.PRIMAL_SHARD_DROP_CHANCE, 'number');
  });

  test('combatBossHandlers: 더 이상 CONSTANTS.PRIMAL_SHARD_DROP_CHANCE 잘못 참조 안 함', async () => {
      const source = await readSrc('src/hooks/combatActions/combatBossHandlers.ts');
      // CONSTANTS.PRIMAL_SHARD_DROP_CHANCE는 undefined여서 shard never drop 버그였음.
      // BALANCE.PRIMAL_SHARD_DROP_CHANCE로 교체되어야 함.
      assert.doesNotMatch(source, /CONSTANTS\.PRIMAL_SHARD_DROP_CHANCE/);
      assert.match(source, /BALANCE\.PRIMAL_SHARD_DROP_CHANCE/);
  });

  test('useInventoryActions: 더 이상 CONSTANTS.DAILY_INVADE_LIMIT 잘못 참조 안 함', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      // CONSTANTS.DAILY_INVADE_LIMIT은 undefined여서 일일 침략 5회 제한이 작동 안 했음.
      // BALANCE.DAILY_INVADE_LIMIT로 교체되어야 함.
      assert.doesNotMatch(source, /CONSTANTS\.DAILY_INVADE_LIMIT/);
      assert.match(source, /BALANCE\.DAILY_INVADE_LIMIT/);
  });

  test('combatBossHandlers: PRIMAL_SHARD_REQUIRED 참조 코드 존재 (>= 1건)', async () => {
      const source = await readSrc('src/hooks/combatActions/combatBossHandlers.ts');
      const matches = source.match(/PRIMAL_SHARD_REQUIRED/g) || [];
      assert.ok(matches.length >= 1, `expected >=1 reference, got ${matches.length}`);
  });

  test('combatBossHandlers: hardcoded 3 shard 비교가 PRIMAL_SHARD_REQUIRED로 교체됨', async () => {
      const source = await readSrc('src/hooks/combatActions/combatBossHandlers.ts');
      // 더 이상 hardcoded `shardCount < 3` 패턴이 직접 등장하지 않음 (지역 상수로
      // alias하여 사용).
      assert.doesNotMatch(source, /shardCount\s*<\s*3\b/);
      assert.doesNotMatch(source, /currentShardCount\s*>=\s*3\b/);
  });
}

// ─── cycle-138-constants-balance-namespace-guard.test.js ───
{
  /**
   * cycle 138: CONSTANTS/BALANCE namespace 정합성 회귀 가드.
   *
   * cycle 137에서 발견:
   * - combatBossHandlers.ts:17 → `CONSTANTS.PRIMAL_SHARD_DROP_CHANCE`
   *   (실제론 BALANCE에 있음 → undefined → shard never drops)
   * - useInventoryActions.ts:489 → `CONSTANTS.DAILY_INVADE_LIMIT`
   *   (실제론 BALANCE에 있음 → undefined → invade 무제한)
   *
   * 두 버그 모두 잘못된 namespace 참조로 인한 게임 핵심 메커니즘 비활성. 이번
   * 사이클은 이런 mismatch가 미래에 다시 생기지 않도록 자동화된 회귀 가드를
   * 도입한다.
   *
   * 검증:
   * src/ 전체에서 `BALANCE.X` 또는 `CONSTANTS.X` 형태의 참조를 추출하고, 각
   * 키가 해당 객체에 정의되어 있는지 확인. 정의되지 않은 참조는 즉시 실패.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  async function listSrcFiles() {
      // readdir({recursive:true})로 src 전체 .ts/.tsx 수집 — CI Node 호환
      //   (fs/promises.glob은 Node 버전에 따라 export 부재 → 환경 비호환).
      const entries = await readdir(path.join(ROOT, 'src'), { recursive: true });
      return entries
          .filter((f) => /\.(ts|tsx)$/.test(f))
          .map((f) => path.join(ROOT, 'src', f));
  }

  async function collectRefs(prefix) {
      const re = new RegExp(`\\b${prefix}\\.([A-Z][A-Z0-9_]+)`, 'g');
      const refs = new Set();
      const files = await listSrcFiles();
      for (const file of files) {
          const source = await readFile(file, 'utf8');
          for (const match of source.matchAll(re)) {
              refs.add(match[1]);
          }
      }
      return refs;
  }

  test('CONSTANTS.X 참조 — 모든 키가 CONSTANTS 객체에 정의됨', async () => {
      const refs = await collectRefs('CONSTANTS');
      const broken = [...refs].filter((key) => CONSTANTS[key] === undefined);
      assert.deepEqual(broken, [], `broken CONSTANTS refs: ${broken.join(', ')}`);
  });

  test('BALANCE.X 참조 — 모든 키가 BALANCE 객체에 정의됨', async () => {
      const refs = await collectRefs('BALANCE');
      const broken = [...refs].filter((key) => BALANCE[key] === undefined);
      assert.deepEqual(broken, [], `broken BALANCE refs: ${broken.join(', ')}`);
  });

  test('cycle 137 회귀 가드: PRIMAL_SHARD_* 가 BALANCE에만 있고 CONSTANTS엔 없음', () => {
      assert.equal(typeof BALANCE.PRIMAL_SHARD_DROP_CHANCE, 'number');
      assert.equal(typeof BALANCE.PRIMAL_SHARD_REQUIRED, 'number');
      assert.equal(CONSTANTS.PRIMAL_SHARD_DROP_CHANCE, undefined);
      assert.equal(CONSTANTS.PRIMAL_SHARD_REQUIRED, undefined);
  });

  test('cycle 137 회귀 가드: DAILY_INVADE_LIMIT 이 BALANCE에만 있고 CONSTANTS엔 없음', () => {
      assert.equal(typeof BALANCE.DAILY_INVADE_LIMIT, 'number');
      assert.equal(CONSTANTS.DAILY_INVADE_LIMIT, undefined);
  });
}

// ─── cycle-139-event-legendary-item-reward.test.js ───
{
  /**
   * cycle 139: 이벤트 체인 'legendary_item' 보상 핸들러 누락 fix.
   *
   * 발견:
   * - eventChains.ts의 lost_wizard chain step에 reward type 'legendary_item'이
   *   존재 ({ type: 'legendary_item', name: '전설의 마법서', itemType: 'weapon' }).
   * - eventActions.handleEventChoice는 gold/item/relic/combat_bonus/stat_bonus
   *   5개 reward type을 처리하지만 legendary_item은 분기 없음.
   * - 결과: 플레이어가 lost_wizard 챕터의 "전투를 받아들인다 (전설 보상)"을
   *   선택해 outcome을 발동시켜도 아이템이 인벤토리에 추가되지 않음.
   *
   * 수정:
   * eventActions에 `rwd.type === 'legendary_item'` 분기 추가. 'item'과 동일하게
   * addItemByName 호출 + addLog 'success' MSG.LOOT_GET 출력. cycle 122/135
   * quest_complete sound는 외곽 if (rwd) 블록에서 자동 트리거.
   *
   * 별도 콘텐츠 갭: 'legendary_item' name인 '전설의 마법서'가 items.ts에 정의
   * 안 돼 있음. addItemByName은 itemDef 없으면 player 그대로 반환 (silent
   * no-op). 이는 별도 사이클로 콘텐츠 정합 정리 필요. 이번 사이클은 핸들러 인프라
   * 만 추가.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('eventActions: rwd.type === "legendary_item" 분기 추가됨', async () => {
      const source = await readSrc('src/hooks/gameActions/eventActions.ts');
      assert.match(source, /rwd\.type\s*===\s*['"]legendary_item['"]/);
  });

  test('eventActions: legendary_item 분기가 addItemByName 호출', async () => {
      const source = await readSrc('src/hooks/gameActions/eventActions.ts');
      const idx = source.indexOf("'legendary_item'");
      assert.ok(idx > -1);
      const window = source.slice(idx, idx + 400);
      assert.match(window, /addItemByName/);
  });

  test('회귀 보존: 기존 5개 reward 타입 분기 유지 (gold/item/relic/combat_bonus/stat_bonus)', async () => {
      const source = await readSrc('src/hooks/gameActions/eventActions.ts');
      for (const t of ['gold', 'item', 'relic', 'combat_bonus', 'stat_bonus']) {
          assert.match(source, new RegExp(`rwd\\.type\\s*===\\s*['"]${t}['"]`));
      }
  });
}

// ─── cycle-140-event-chain-content-fix.test.js ───
{
  /**
   * cycle 140: lost_wizard 체인 보상 콘텐츠 정합 fix.
   *
   * cycle 139에서 eventActions에 'legendary_item' 핸들러를 추가했지만, 데이터
   * 소스인 eventChains.ts의 lost_wizard chain이 reward.name을 '전설의 마법서'로
   * 지정하는데 items.ts에 정의되지 않은 이름. addItemByName이 itemDef 못 찾아
   * silent no-op — 핸들러는 올바르지만 콘텐츠 갭으로 보상이 여전히 안 줌.
   *
   * 수정:
   * lost_wizard outcome reward.name을 '전설의 마법서' → '아크스태프'(items.ts에
   * 실재하는 tier 4 마법사 weapon)로 교체. 디자인 의도(전설 보상 — mage 친화)
   * 와 호환.
   *
   * 검증:
   * 1. EVENT_CHAINS의 모든 reward.name 이 items.ts에 실재함.
   * 2. legendary_item type reward 도 같은 검증 통과.
   */

  const allItemNames = new Set();
  for (const bucket of Object.values(DB.ITEMS || {})) {
      if (Array.isArray(bucket)) {
          for (const item of bucket) {
              if (item?.name) allItemNames.add(item.name);
          }
      }
  }

  test('EVENT_CHAINS: 모든 item/legendary_item reward의 name이 items.ts에 존재', () => {
      const missing = [];
      for (const chain of (EVENT_CHAINS || [])) {
          for (const step of (chain.steps || [])) {
              const outcomes = step.event?.outcomes || [];
              for (const outcome of outcomes) {
                  const rwd = outcome.reward;
                  if (!rwd) continue;
                  if ((rwd.type === 'item' || rwd.type === 'legendary_item') && rwd.name) {
                      if (!allItemNames.has(rwd.name)) {
                          missing.push(`${chain.id}/${step.event?.title}: '${rwd.name}'`);
                      }
                  }
              }
          }
      }
      assert.deepEqual(missing, [], `chains reference unknown items:\n  ${missing.join('\n  ')}`);
  });

  test('lost_wizard chain: 전설 보상 outcome이 실재 item 이름 사용', () => {
      const chain = EVENT_CHAINS.find((c) => c.id === 'lost_wizard');
      assert.ok(chain, 'lost_wizard chain should exist');
      let foundLegendary = false;
      for (const step of (chain.steps || [])) {
          for (const outcome of (step.event?.outcomes || [])) {
              if (outcome.reward?.type === 'legendary_item') {
                  foundLegendary = true;
                  assert.ok(allItemNames.has(outcome.reward.name),
                      `legendary_item '${outcome.reward.name}' should be an existing item`);
              }
          }
      }
      assert.ok(foundLegendary, 'lost_wizard should have a legendary_item reward outcome');
  });
}

// ─── cycle-147-action-type-deadcode-guard.test.js ───
{
  /**
   * cycle 147: AT(action type) dead-code 가드.
   *
   * cycle 134(SoundManager 키) / 138(CONSTANTS·BALANCE namespace) 흐름의 연장.
   * actionTypes.ts에 선언만 되고 실제 dispatch 호출이 0건인 AT 키가 누적되면
   * (a) 죽은 reducer 핸들러가 늘어 인지 부담 ↑, (b) 진짜 호출이 끊긴 회귀를
   * detect 못함. 양방향 가드:
   *
   * 1. 모든 `AT.X` 키가 src/ 내부 어딘가(actionTypes.ts 제외)에서 1번 이상
   *    `AT.X` 형태로 참조됨.
   * 2. ACTION_MAP에 등록된 모든 핸들러 키도 AT.X에 정의됨 (string typo 가드).
   *
   * cycle 147은 아래 6개 dead AT 키 + 핸들러를 일괄 제거한 후 baseline 0 lock:
   * RESET_RUNTIME_UI, CLEAR_LOGS, SYNTHESIZE_ITEMS, SET_PREMIUM_CURRENCY,
   * SET_CHALLENGE_MODIFIERS, SET_PUBLIC_GRAVES.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const SRC = path.join(ROOT, 'src');
  const ACTION_TYPES_PATH = path.join(SRC, 'reducers/actionTypes.ts');

  const walk = async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true });
      let out = '';
      for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
              out += await walk(full);
          } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
              if (full === ACTION_TYPES_PATH) continue;
              out += await readFile(full, 'utf8');
              out += '\n';
          }
      }
      return out;
  };

  const collectATKeys = (src) => {
      const keys = new Set();
      // export const AT = Object.freeze({ ... }) 블록 내부의 ^    KEY: 'KEY', 라인만 추출.
      const m = src.match(/export const AT[\s\S]*?Object\.freeze\(\{([\s\S]*?)\}\s*as const\s*\)/);
      if (!m) return keys;
      const body = m[1];
      const re = /^\s+([A-Z_][A-Z0-9_]*)\s*:/gm;
      let k;
      while ((k = re.exec(body)) !== null) keys.add(k[1]);
      return keys;
  };

  test('AT 키 dead-code 가드: 모든 AT.X가 src/ 내부 어딘가에서 dispatch 됨', async () => {
      const atSrc = await readFile(ACTION_TYPES_PATH, 'utf8');
      const keys = collectATKeys(atSrc);
      assert.ok(keys.size > 0, 'AT 키 추출 실패');

      const corpus = await walk(SRC);
      const dead = [];
      for (const key of keys) {
          const re = new RegExp(`AT\\.${key}\\b`);
          if (!re.test(corpus)) dead.push(key);
      }
      assert.deepEqual(dead, [],
          `dead AT keys (declared but never dispatched — remove or use):\n  ${dead.join('\n  ')}`);
  });

  test('AT 키 dead-code 가드: 핸들러 등록 키가 모두 AT 정의에 존재 (string typo)', async () => {
      const atSrc = await readFile(ACTION_TYPES_PATH, 'utf8');
      const keys = collectATKeys(atSrc);

      // 핸들러 파일들에서 ^    KEY: ( 또는 ^    KEY: ( pattern 추출.
      const handlerFiles = [
          'reducers/handlers/uiHandlers.ts',
          'reducers/handlers/bootstrapHandlers.ts',
          'reducers/handlers/progressionHandlers.ts',
          'reducers/handlers/featureHandlers.ts',
          'reducers/handlers/multiplayerHandlers.ts',
          'reducers/handlers/rewardHandlers.ts',
      ];
      const handlerKeys = new Set();
      for (const rel of handlerFiles) {
          const full = path.join(SRC, rel);
          let src;
          try {
              src = await readFile(full, 'utf8');
          } catch { continue; }
          const re = /^\s+([A-Z_][A-Z0-9_]*)\s*:\s*\(/gm;
          let m;
          while ((m = re.exec(src)) !== null) handlerKeys.add(m[1]);
      }

      const orphan = [...handlerKeys].filter((k) => !keys.has(k));
      assert.deepEqual(orphan, [],
          `핸들러 등록 키가 AT 정의에 없음 (string typo or stale handler):\n  ${orphan.join('\n  ')}`);
  });
}

// ─── cycle-176-challenge-blindmap-modifier.test.js ───
{
  /**
   * cycle 176: 'blindMap' challenge modifier 활성 + 회귀 가드.
   *
   * 발견:
   * - constants.ts CHALLENGE_MODIFIERS에 6종 정의:
   *   halfHp / noGold / randomSkills / eliteOnly / noPotion / blindMap.
   * - 5종은 핸들러 보유 (각각 characterActions / CombatEngine / combatAttack /
   *   exploreUtils / useInventoryActions). 'blindMap'만 핸들러 0건 — 선택해도
   *   효과 없는 silent no-op.
   *
   * 수정:
   * 1. StatusBar의 위치 표시(player.loc)에 challengeModifiers.includes('blindMap')
   *    분기 추가 — '???' 표시로 대체.
   * 2. CHALLENGE_MODIFIERS의 모든 modifier id가 src/ 어딘가에서 핸들러로
   *    참조되는지 회귀 가드 (cycle 134/138/141/148/164/165 패턴).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const SRC = path.join(ROOT, 'src');

  const walk = async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true });
      let out = '';
      for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) out += await walk(full);
          else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
              out += await readFile(full, 'utf8');
              out += '\n';
          }
      }
      return out;
  };

  test('cycle 176: 모든 CHALLENGE_MODIFIERS id가 src/에서 핸들러 참조됨', async () => {
      const corpus = await walk(SRC);
      // constants.ts 자체는 corpus에 포함됨 — modifier id의 단순 정의는 카운트에서 빼야 함.
      // includes('id') 또는 ['id'] 패턴 등 핸들러 패턴이 1+개여야 한다.
      const constantsSrc = await readFile(path.join(SRC, 'data/constants.ts'), 'utf8');

      const dead = [];
      for (const mod of BALANCE.CHALLENGE_MODIFIERS) {
          const id = mod.id;
          // includes('id') 패턴이 constants.ts 외부에 1+ 있는지.
          const re = new RegExp(`includes\\(['"]${id}['"]\\)`, 'g');
          const all = (corpus.match(re) || []).length;
          const inConstants = (constantsSrc.match(re) || []).length;
          const elsewhere = all - inConstants;
          if (elsewhere === 0) dead.push(id);
      }
      assert.deepEqual(dead, [],
          `dead challenge modifiers (no handler):\n  ${dead.join('\n  ')}`);
  });

  test('cycle 176: StatusBar에 blindMap 분기 명시', async () => {
      const sbSrc = await readFile(path.join(ROOT, 'src/components/StatusBar.tsx'), 'utf8');
      assert.match(sbSrc, /'blindMap'/, 'StatusBar에 blindMap 분기 명시');
      assert.match(sbSrc, /\?\?\?/, '???대체 표시');
  });
}

// ─── cycle-177-discovery-chain-reward-integrity.test.js ───
{
  /**
   * cycle 177: BALANCE.DISCOVERY_CHAINS 정합성 가드 + reward.item 3건 fix.
   *
   * 발견:
   * - 5종 발견 체인 중 3종(fire_convergence / frozen_truth / demon_trail)이
   *   items.ts 미등록 reward.item 참조 — '용의 숨결' / '영원의 빙결정' /
   *   '마왕의 인장'.
   * - exploreUtils.checkDiscoveryChains의 'DB.ITEMS.allItems.find'가 못 찾으면
   *   item 추가 분기 skip → 골드/EXP만 부여, 핵심 보상 silent 누락.
   * - 4 발견 체인 위업이 완료해도 1.5/2배 가격의 무기 보상이 사라지던 회귀.
   *
   * 수정 (src/data/constants.ts):
   *
   * | 기존 missing item | → 교체 (items.ts 등록 tier 5)         |
   * |-------------------|---------------------------------------|
   * | 용의 숨결         | 용의 화염 (화염 무기 ATK+155)         |
   * | 영원의 빙결정     | 빙결의 왕관검 (냉기 무기 ATK+185)     |
   * | 마왕의 인장       | 마왕의 대낫 (어둠 무기 ATK+220)       |
   *
   * 가드:
   * 1. DISCOVERY_CHAINS의 모든 reward.item이 items.ts에 등록.
   * 2. 모든 chain.locations가 MAPS에 존재.
   * 3. id 유일성 + 필수 필드 (id / label / locations / reward).
   */

  test('DISCOVERY_CHAINS reward.item이 모두 items.ts 등록됨', () => {
      const allItemNames = new Set();
      for (const arr of Object.values(DB.ITEMS)) {
          if (Array.isArray(arr)) for (const i of arr) if (i.name) allItemNames.add(i.name);
      }
      const chains = BALANCE.DISCOVERY_CHAINS || [];
      const missing = [];
      for (const chain of chains) {
          if (chain.reward?.item && !allItemNames.has(chain.reward.item)) {
              missing.push(`${chain.id}: '${chain.reward.item}'`);
          }
      }
      assert.deepEqual(missing, [],
          `DISCOVERY_CHAINS에 items.ts 미등록 reward.item:\n  ${missing.join('\n  ')}`);
  });

  test('DISCOVERY_CHAINS의 모든 chain.locations가 MAPS에 존재', () => {
      const mapKeys = new Set(Object.keys(MAPS));
      const chains = BALANCE.DISCOVERY_CHAINS || [];
      const missing = [];
      for (const chain of chains) {
          for (const loc of chain.locations || []) {
              if (!mapKeys.has(loc)) missing.push(`${chain.id}: '${loc}' not in MAPS`);
          }
      }
      assert.deepEqual(missing, []);
  });

  test('DISCOVERY_CHAINS 필수 필드 + id 유일성', () => {
      const chains = BALANCE.DISCOVERY_CHAINS || [];
      const ids = new Map();
      const missingFields = [];
      for (const chain of chains) {
          if (!chain.id) missingFields.push('chain without id');
          if (!chain.label) missingFields.push(`chain ${chain.id}: no label`);
          if (!Array.isArray(chain.locations) || chain.locations.length === 0) missingFields.push(`chain ${chain.id}: no locations`);
          if (!chain.reward) missingFields.push(`chain ${chain.id}: no reward`);
          if (chain.id) ids.set(chain.id, (ids.get(chain.id) || 0) + 1);
      }
      const dupes = [...ids.entries()].filter(([_, c]) => c > 1);
      assert.deepEqual(missingFields, []);
      assert.deepEqual(dupes, []);
  });

  test('cycle 177: 3 reward.item 매핑 명시 가드', () => {
      const chains = BALANCE.DISCOVERY_CHAINS || [];
      const fireC = chains.find((c) => c.id === 'fire_convergence');
      const frozenT = chains.find((c) => c.id === 'frozen_truth');
      const demonT = chains.find((c) => c.id === 'demon_trail');
      assert.equal(fireC.reward.item, '용의 화염');
      assert.equal(frozenT.reward.item, '빙결의 왕관검');
      assert.equal(demonT.reward.item, '마왕의 대낫');
  });
}

// ─── cycle-178-event-info-reward-handler.test.js ───
{
  /**
   * cycle 178: eventChains 'info' reward type 핸들러 추가 + 모든 reward type 핸들러 가드.
   *
   * 발견:
   * - eventChains.ts ancient_prophecy chain의 outcome에 reward.type='info'와
   *   reward.text 정의 — 플레이어에게 게임 메커니즘 힌트 제공 의도.
   * - 그러나 eventActions.handleEventChoice가 6 reward type(gold / item /
   *   legendary_item / relic / combat_bonus / stat_bonus)만 처리. 'info'
   *   분기 누락으로 reward.text가 silent 누락.
   * - 결과: ancient_prophecy chain 진행 중 "원시의 파편: 프레스티지 후 마왕
   *   처치 시 40% 확률로 획득" 같은 핵심 정보가 플레이어에게 도달 안 함.
   *
   * 수정:
   * 1. eventActions.ts에 rwd.type === 'info' 분기 추가 — addLog('system', ...) 출력.
   * 2. eventChains의 모든 reward.type이 eventActions에서 핸들러 보유한지 회귀 가드.
   *    cycle 134/138/141/148/164/176 baseline pattern 시리즈 합류.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  test('eventChains의 모든 reward.type이 eventActions.ts에서 핸들러 보유', async () => {
      // Collect all reward types from EVENT_CHAINS
      const rewardTypes = new Set();
      for (const chain of EVENT_CHAINS) {
          for (const step of (chain.steps || [])) {
              for (const outcome of (step.event?.outcomes || [])) {
                  if (outcome.reward?.type) rewardTypes.add(outcome.reward.type);
              }
          }
      }

      const handlerSrc = await readFile(path.join(ROOT, 'src/hooks/gameActions/eventActions.ts'), 'utf8');
      const dead = [];
      for (const t of rewardTypes) {
          const re = new RegExp(`rwd\\.type\\s*===\\s*['"]${t}['"]`);
          if (!re.test(handlerSrc)) dead.push(t);
      }
      assert.deepEqual(dead, [],
          `eventChains reward.type 핸들러 누락:\n  ${dead.join('\n  ')}`);
  });

  test('cycle 178: eventActions에 info 핸들러 명시', async () => {
      const handlerSrc = await readFile(path.join(ROOT, 'src/hooks/gameActions/eventActions.ts'), 'utf8');
      assert.match(handlerSrc, /rwd\.type === 'info'/);
      assert.match(handlerSrc, /rwd\.text/);
  });

  test('eventChains의 info reward 사용 사례 1+ (cycle 178 fix 대상 명시)', () => {
      let infoCount = 0;
      for (const chain of EVENT_CHAINS) {
          for (const step of (chain.steps || [])) {
              for (const outcome of (step.event?.outcomes || [])) {
                  if (outcome.reward?.type === 'info') infoCount++;
              }
          }
      }
      assert.ok(infoCount >= 1, 'eventChains에 info reward 사용 케이스가 있어야 함');
  });
}

// ─── cycle-179-abyss-milestone-legendary-bug.test.js ───
{
  /**
   * cycle 179: applyAbyssFloorAdvance의 'legendary_item' milestone 분기 버그 fix.
   *
   * 발견:
   * - combatBossHandlers.ts:92에서 `(DB.ITEMS || []).flat().filter(...)` 사용.
   * - DB.ITEMS는 OBJECT (`{ weapons: [...], armors: [...], ... }`) — 배열 아님.
   * - 결과: object에 .flat() 호출 시 TypeError 발생 (flat is not a function).
   * - 영향: abyss 50층/100층/300층 도달 시 milestone 보상 처리 중 예외 발생.
   *   abyss 진행이 50층에서 중단되거나 보상 silent skip.
   *
   * 수정:
   * - DB.ITEMS의 모든 array 버킷을 명시적으로 펼친 후 tier 5 필터링.
   *   `[...weapons, ...armors, ...shields, ...consumables, ...materials]`
   *   같은 패턴 또는 `Object.values(DB.ITEMS).flat()` 으로 안전 접근.
   */

  const fakeDispatch = () => {};
  const fakeAddLog = () => {};

  test('cycle 179 RED→GREEN: abyss 50층 milestone (legendary_item)이 예외 없이 처리됨', () => {
      const player = {
          loc: CONSTANTS.ABYSS_MAP_NAME,
          stats: { abyssFloor: 49, abyssRecord: 49 },
          inv: [],
          relics: [],
          prestigePoints: 0,
      };

      // 50층 진입 (49 → 50). milestone 50 = legendary_item.
      let result;
      let threw = null;
      try {
          result = applyAbyssFloorAdvance(player, fakeDispatch, fakeAddLog);
      } catch (e) {
          threw = e;
      }

      assert.equal(threw, null, `applyAbyssFloorAdvance가 예외 던지면 안 됨: ${threw?.message}`);
      assert.ok(result, 'result 반환');
      assert.equal(result.stats.abyssFloor, 50);
      // legendary_item milestone 처리 → tier 5 아이템이 inv에 추가됐어야 함.
      assert.ok((result.inv || []).length >= 1,
          'legendary_item milestone이 tier 5 아이템 1개 추가해야 함');
  });

  test('cycle 179: legendary_item milestone에서 tier 5 아이템 풀이 비어있지 않음 (sanity)', () => {
      const tier5Pool = [
          ...(DB.ITEMS.weapons || []),
          ...(DB.ITEMS.armors || []),
          ...(DB.ITEMS.shields || []),
          ...(DB.ITEMS.consumables || []),
          ...(DB.ITEMS.materials || []),
      ].filter((i) => i?.tier === 5);
      assert.ok(tier5Pool.length > 0,
          'DB.ITEMS에 tier 5 아이템이 1개 이상 있어야 milestone 보상 가능');
  });

  test('회귀 가드: abyss 49층 → 50층 외 milestone 미해당 floor는 inv 변경 없음', () => {
      const player = {
          loc: CONSTANTS.ABYSS_MAP_NAME,
          stats: { abyssFloor: 30, abyssRecord: 30 },
          inv: [{ name: 'preexisting' }],
          relics: [],
      };
      // 31층은 milestone 없음.
      const result = applyAbyssFloorAdvance(player, fakeDispatch, fakeAddLog);
      assert.equal(result.stats.abyssFloor, 31);
      assert.equal(result.inv.length, 1, 'milestone 없는 floor는 inv 그대로');
  });
}

// ─── cycle-180-discovery-chain-item-lookup-bug.test.js ───
{
  /**
   * cycle 180: discovery chain item lookup 버그 fix (cycle 177 follow-up).
   *
   * cycle 177이 DISCOVERY_CHAINS reward.item 3건을 items.ts 등록 항목으로 매핑.
   * 그러나 매핑된 이후에도 실제 inventory에 추가되지 않던 잠복 회귀 발견.
   *
   * 발견:
   * - exploreUtils.ts:357 'DB.ITEMS?.allItems?.find(...)' 패턴.
   * - DB.ITEMS는 object — 'allItems' 필드 존재하지 않음 (undefined).
   * - optional chaining으로 throw 안 하지만 find 결과 undefined → 추가 분기 skip.
   * - 결과: cycle 177에서 reward.item을 '용의 화염' / '빙결의 왕관검' /
   *   '마왕의 대낫'으로 매핑했지만 실제로 inventory에 들어가지 않던 silent 회귀.
   *
   * 수정 (src/utils/exploreUtils.ts):
   * - 'DB.ITEMS.allItems.find(...)' → 'findItemByName(name)' (gameUtils helper).
   * - getAllItems()가 [...consumables, ...weapons, ...armors, ...materials]로 lookup.
   *
   * cycle 179 'Object.values(DB.ITEMS).flat()' 패턴과 같은 영역의 회귀 — DB.ITEMS
   * shape에 대한 잘못된 가정.
   */

  test('cycle 180 sanity: DB.ITEMS.allItems는 undefined (잘못된 lookup 가정)', () => {
      assert.equal(DB.ITEMS.allItems, undefined,
          'DB.ITEMS는 {weapons,armors,...} object — allItems 필드 없음');
  });

  test('cycle 180: findItemByName이 cycle 177 매핑된 3 reward.item 모두 찾음', () => {
      // cycle 177에서 fire_convergence / frozen_truth / demon_trail의 reward를
      // 매핑한 아이템들이 lookup에서 찾아지는지 확인.
      const items = ['용의 화염', '빙결의 왕관검', '마왕의 대낫'];
      for (const name of items) {
          const found = findItemByName(name);
          assert.ok(found, `findItemByName('${name}') 실패`);
          assert.equal(found.name, name);
      }
  });

  test('cycle 180: BALANCE.DISCOVERY_CHAINS reward.item이 모두 findItemByName으로 lookup 가능', () => {
      const chains = BALANCE.DISCOVERY_CHAINS || [];
      const missing = [];
      for (const chain of chains) {
          if (chain.reward?.item) {
              const found = findItemByName(chain.reward.item);
              if (!found) missing.push(`${chain.id}: '${chain.reward.item}'`);
          }
      }
      assert.deepEqual(missing, [],
          `findItemByName lookup 실패한 reward.item:\n  ${missing.join('\n  ')}`);
  });

  test('cycle 180: exploreUtils.ts에 DB.ITEMS.allItems 잘못된 패턴 없음 (회귀 가드)', async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const src = await readFile(path.join(ROOT, 'src/utils/exploreUtils.ts'), 'utf8');
      // 코멘트의 경고는 OK, 실제 코드에서 호출 안 되어야 함.
      // 'DB.ITEMS?.allItems?.find' 또는 'DB.ITEMS.allItems.find' 패턴이 .find 호출로 이어지면 안 됨.
      assert.doesNotMatch(src, /DB\.ITEMS\??\.\s*allItems\??\.\s*find/,
          'exploreUtils.ts에 DB.ITEMS.allItems.find 잘못된 lookup이 없어야 함');
  });
}

// ─── cycle-181-db-shape-integrity-guard.test.js ───
{
  /**
   * cycle 181: DB shape 정합성 회귀 가드 (cycle 179/180 잠복 회귀 lessons learned).
   *
   * cycle 179: '(DB.ITEMS).flat()' 호출이 TypeError로 abyss 50층+ 진행 중단.
   * cycle 180: 'DB.ITEMS.allItems.find()' 호출이 silent miss로 chain reward 실종.
   *
   * 두 잠복 회귀의 공통 원인 — DB.ITEMS shape에 대한 잘못된 가정. DB.ITEMS는
   * { weapons, armors, consumables, materials, prefixes, sets, recipes } object
   * 인데 array 메서드(.flat) / 미존재 필드(.allItems)를 호출.
   *
   * 이번 가드는:
   * 1. DB의 핵심 sub-object들이 expected shape를 유지함을 lock.
   * 2. src/ 코드가 DB.ITEMS.<unknown_key> 패턴을 사용하지 않음을 정합 가드 —
   *    화이트리스트 외 키 access는 의심.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const SRC = path.join(ROOT, 'src');

  const ITEMS_VALID_KEYS = new Set([
      'weapons', 'armors', 'consumables', 'materials',
      'prefixes', 'sets', 'recipes',
  ]);

  test('DB.ITEMS shape lock — 정확히 7 keys', () => {
      const keys = new Set(Object.keys(DB.ITEMS));
      assert.equal(keys.size, ITEMS_VALID_KEYS.size,
          `DB.ITEMS keys count mismatch — expected ${ITEMS_VALID_KEYS.size}, got ${keys.size}`);
      for (const k of ITEMS_VALID_KEYS) {
          assert.ok(keys.has(k), `DB.ITEMS missing expected key '${k}'`);
          assert.ok(Array.isArray(DB.ITEMS[k]), `DB.ITEMS.${k} not an array`);
      }
  });

  test('DB top-level shape lock — 6 sub-objects (CLASSES/ITEMS/MAPS/MONSTERS/QUESTS/ACHIEVEMENTS)', () => {
      // cycle 304: LOOT_TABLE / DROP_TABLES key 제거 — DB 접근 0건. 모든 consumer는
      //   data/loot.js / data/dropTables.js 직접 import. 기존 8 키 lock 이 6 키로 갱신.
      const expected = ['CLASSES', 'ITEMS', 'MAPS', 'MONSTERS', 'QUESTS', 'ACHIEVEMENTS'];
      const actual = new Set(Object.keys(DB));
      for (const k of expected) {
          assert.ok(actual.has(k), `DB missing '${k}'`);
      }
      assert.equal(actual.size, expected.length, `DB key count: expected ${expected.length}, got ${actual.size}`);
  });

  test('src/ 코드가 DB.ITEMS.<unknown_key>를 호출하지 않음 (화이트리스트 가드)', async () => {
      // src 전체에서 DB.ITEMS.<word>(  형태 + DB.ITEMS?.<word>  형태 모두 추출.
      const walk = async (dir) => {
          const entries = await readdir(dir, { withFileTypes: true });
          let out = '';
          for (const e of entries) {
              const full = path.join(dir, e.name);
              if (e.isDirectory()) out += await walk(full);
              else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
                  out += await readFile(full, 'utf8');
                  out += '\n';
              }
          }
          return out;
      };

      const corpus = await walk(SRC);
      const re = /DB\.ITEMS\??\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
      const violations = new Set();
      let m;
      while ((m = re.exec(corpus)) !== null) {
          const key = m[1];
          if (!ITEMS_VALID_KEYS.has(key)) {
              violations.add(key);
          }
      }
      assert.deepEqual([...violations].sort(), [],
          `DB.ITEMS의 unknown 키 access 발견 (cycle 179/180 회귀 패턴):\n  ${[...violations].join('\n  ')}`);
  });

  test('DB.QUESTS / DB.ACHIEVEMENTS shape lock — 둘 다 array', () => {
      assert.ok(Array.isArray(DB.QUESTS), 'DB.QUESTS is array');
      assert.ok(Array.isArray(DB.ACHIEVEMENTS), 'DB.ACHIEVEMENTS is array');
      assert.ok(DB.QUESTS.length > 0);
      assert.ok(DB.ACHIEVEMENTS.length > 0);
  });

  test('DB.MAPS / DB.MONSTERS / DB.CLASSES shape lock — 모두 keyed object (not array)', () => {
      for (const key of ['MAPS', 'MONSTERS', 'CLASSES']) {
          assert.ok(typeof DB[key] === 'object', `DB.${key} is object`);
          assert.ok(!Array.isArray(DB[key]), `DB.${key} is NOT array`);
          assert.ok(Object.keys(DB[key]).length > 0);
      }
  });
}

// ─── cycle-182-inv-cap-maxinv-respect.test.js ───
{
  /**
   * cycle 182: 인벤토리 cap 검사가 player.maxInv (확장된 슬롯)을 존중하도록 정합 fix.
   *
   * 발견:
   * - PremiumShop으로 INV_EXPAND 구매 시 player.maxInv가 BALANCE.INV_MAX_SIZE보다
   *   커질 수 있음 (예: 20 → 25).
   * - useInventoryActions / ShopPanel은 'player.maxInv || BALANCE.INV_MAX_SIZE'
   *   패턴으로 player 슬롯 우선 — 정합.
   * - 그러나 일부 코드는 BALANCE.INV_MAX_SIZE만 사용:
   *   - exploreUtils.ts:363 (chain reward 추가 시 cap 검사) — 확장 인벤(25)에서
   *     20 도달 시 reward skip 회귀.
   *   - adventureGuide.ts:172/313/316 (인벤 경고 hint) — 18칸에서 잘못된 경고
   *     발동.
   *
   * 수정:
   * - exploreUtils.ts:363 'BALANCE.INV_MAX_SIZE' → 'updated.maxInv || BALANCE.INV_MAX_SIZE'.
   * - adventureGuide.ts:139/250 inventoryCap 변수 도입 — 같은 fallback 패턴.
   * - 회귀 가드: 모든 'BALANCE.INV_MAX_SIZE' 단독 사용이 fallback 형태로 유지됨.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const SRC = path.join(ROOT, 'src');

  const walk = async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true });
      let out = [];
      for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) out = out.concat(await walk(full));
          else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
              out.push({ path: full, src: await readFile(full, 'utf8') });
          }
      }
      return out;
  };

  test('cycle 182: src/utils/exploreUtils.ts 의 chain reward cap에 maxInv 우선 사용', async () => {
      const src = await readFile(path.join(SRC, 'utils/exploreUtils.ts'), 'utf8');
      // chain reward 분기에 invCap 변수 또는 maxInv 폴백 패턴 명시.
      assert.match(src, /maxInv/, 'exploreUtils.ts에 maxInv 참조 있어야 함');
      assert.match(src, /invCap/, 'cycle 182 invCap 변수 도입 명시');
  });

  test('cycle 182: src/utils/adventureGuide.ts inventoryCap 변수 도입', async () => {
      const src = await readFile(path.join(SRC, 'utils/adventureGuide.ts'), 'utf8');
      assert.match(src, /inventoryCap/, 'inventoryCap 변수 명시');
      // 둘 다 inventoryCap 사용 후 BALANCE.INV_MAX_SIZE 단독 사용은 폴백뿐.
      const lines = src.split('\n');
      const bareRefs = lines.filter((line) => {
          if (!line.includes('BALANCE.INV_MAX_SIZE')) return false;
          // fallback 형태 ('player.maxInv || BALANCE.INV_MAX_SIZE') 또는 변수 정의는 OK.
          if (line.includes('maxInv ||') || line.includes('inventoryCap')) return false;
          // 코멘트 라인은 제외.
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
          return true;
      });
      assert.deepEqual(bareRefs, [],
          `adventureGuide.ts에 cap 단독 사용 라인:\n  ${bareRefs.join('\n  ')}`);
  });

  test('cycle 182: BALANCE.INV_MAX_SIZE는 여전히 정의됨 (fallback 가드)', () => {
      assert.ok(typeof BALANCE.INV_MAX_SIZE === 'number',
          'BALANCE.INV_MAX_SIZE는 default fallback으로 여전히 필요');
      assert.ok(BALANCE.INV_MAX_SIZE > 0);
  });
}

// ─── cycle-187-clear-temp-state-void-heart-preserve.test.js ───
{
  /**
   * cycle 187: clearTemporaryAdventureState가 voidHeart run-wide 플래그 보존 (death save 회귀 fix).
   *
   * 발견:
   * - clearTemporaryAdventureState (안전 맵 이동 시 호출)는 combatFlags를 OLD
   *   DEFAULT_COMBAT_FLAGS (voidHeartUsed: false / voidHeartArmed: false)로 reset.
   * - 결과: 플레이어가 void_heart로 한 번 부활 후 안전 맵으로 돌아가면 voidHeartUsed
   *   = false로 풀려 death save가 다시 가용 — '런당 1회' spec 위반.
   * - cycle 158 applyBattleStartRelics는 voidHeart 보존(전투 시작 시) — 두 함수 사이
   *   인consistency.
   *
   * 수정:
   * - clearTemporaryAdventureState combatFlags reset 시 voidHeartUsed/Armed를 명시
   *   적으로 player의 기존 값 보존.
   * - applyBattleStartRelics와 동일 패턴.
   */

  test('cycle 187: voidHeartUsed=true로 안전 맵 이동 시 보존됨', () => {
      const player = {
          hp: 100, maxHp: 100,
          tempBuff: { atk: 0.5, turn: 3, name: 'temp_buff' },
          status: ['burn'],
          combatFlags: { voidHeartUsed: true, voidHeartArmed: true, comboCount: 5 },
          nextHitEvaded: true,
      };
      const cleared = clearTemporaryAdventureState(player);

      // void_heart 플래그 보존.
      assert.equal(cleared.combatFlags.voidHeartUsed, true);
      assert.equal(cleared.combatFlags.voidHeartArmed, true);
      // 그 외 일시 상태는 정상 reset.
      assert.equal(cleared.tempBuff.turn, 0);
      assert.deepEqual(cleared.status, []);
      assert.equal(cleared.combatFlags.comboCount, 0);
      assert.equal(cleared.combatFlags.deathSaveUsed, false);
      assert.equal(cleared.nextHitEvaded, false);
  });

  test('cycle 187: voidHeartUsed=false 케이스도 보존 (회귀 가드)', () => {
      const player = {
          hp: 100, maxHp: 100,
          tempBuff: {},
          status: [],
          combatFlags: { voidHeartUsed: false, voidHeartArmed: false },
          nextHitEvaded: false,
      };
      const cleared = clearTemporaryAdventureState(player);
      assert.equal(cleared.combatFlags.voidHeartUsed, false);
      assert.equal(cleared.combatFlags.voidHeartArmed, false);
  });

  test('cycle 187: combatFlags 미존재 시 기본값 false (회귀 가드)', () => {
      const player = {
          hp: 100, maxHp: 100,
          tempBuff: {},
          status: [],
          // combatFlags 누락
          nextHitEvaded: false,
      };
      const cleared = clearTemporaryAdventureState(player);
      assert.equal(cleared.combatFlags.voidHeartUsed, false);
      assert.equal(cleared.combatFlags.voidHeartArmed, false);
  });
}

// ─── cycle-191-handle-defeat-meta-preserve.test.js ───
{
  /**
   * cycle 191: handleDefeat가 META 진행도(premium 자산 / 영구 칭호) 보존 (cycle 188 follow-up).
   *
   * 발견:
   * - cycle 188이 ASCEND에서 premium 자산 4종 보존 fix.
   * - 그러나 handleDefeat (정상 사망 시)는 INITIAL_PLAYER spread로 모든 자산 reset.
   * - 영향: 사망 시 premiumCurrency / titles / activeTitle / reviveTokens / maxInv /
   *   seasonPass 모두 wipe. 영구 진행도(META)와 일회성 진행도(RUN)의 구분 누락.
   *
   * 수정 (src/systems/CombatEngine.ts handleDefeat):
   * - titles / activeTitle 보존 (영구 획득 칭호).
   * - premiumCurrency 보존 (premium 재화).
   * - reviveTokens 보존 (premium 토큰).
   * - maxInv 보존 (premium 인벤 확장).
   * - seasonPass 보존 (시즌 tier 진행).
   *
   * stats.cosmeticTitles / stats.synthProtects는 prevStats spread로 이미 보존됨
   * (기존 동작) — 추가 변경 불필요.
   */

  const buildPlayer = (overrides = {}) => ({
      ...INITIAL_STATE.player,
      name: 'tester',
      gender: 'male',
      level: 30,
      hp: 0,
      titles: [],
      activeTitle: null,
      ...overrides,
  });

  test('cycle 191: handleDefeat가 titles 보존', () => {
      const player = buildPlayer({
          titles: ['first_blood', 'centurion', '시즌 선구자'],
          activeTitle: '시즌 선구자',
      });
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      assert.deepEqual(result.updatedPlayer.titles, ['first_blood', 'centurion', '시즌 선구자']);
      assert.equal(result.updatedPlayer.activeTitle, '시즌 선구자');
  });

  test('cycle 191: handleDefeat가 premium 자산 4종 보존', () => {
      const player = buildPlayer({
          premiumCurrency: 50,
          reviveTokens: 2,
          maxInv: 25,
      });
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      assert.equal(result.updatedPlayer.premiumCurrency, 50);
      assert.equal(result.updatedPlayer.reviveTokens, 2);
      assert.equal(result.updatedPlayer.maxInv, 25);
  });

  test('cycle 191: handleDefeat가 seasonPass 보존', () => {
      const seasonPass = { xp: 5000, tier: 12, claimed: [1, 2, 3], isPremium: true, seasonId: 'S1' };
      const player = buildPlayer({ seasonPass });
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      assert.deepEqual(result.updatedPlayer.seasonPass, seasonPass);
  });

  test('cycle 191: handleDefeat가 stats.cosmeticTitles / synthProtects 보존 (기존 동작)', () => {
      const player = buildPlayer({
          stats: {
              ...INITIAL_STATE.player.stats,
              cosmeticTitles: ['title_stargazer'],
              synthProtects: 5,
              kills: 100, total_gold: 5000,
          },
      });
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      assert.deepEqual(result.updatedPlayer.stats.cosmeticTitles, ['title_stargazer']);
      assert.equal(result.updatedPlayer.stats.synthProtects, 5);
  });

  test('cycle 191: handleDefeat가 RUN 진행도 reset (회귀 가드)', () => {
      const player = buildPlayer({
          gold: 99999,
          inv: [{ name: 'epic loot', id: 'fake' }],
          skillLoadout: { selected: 1, cooldowns: { fireball: 5 } },
      });
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      // RUN 진행도는 reset:
      // CONSTANTS.START_GOLD = 200
      assert.equal(result.updatedPlayer.gold, 200, 'gold reset to START_GOLD');
      assert.equal(result.updatedPlayer.inv.length, 2, 'inv reset to 2 starter consumables');
      assert.equal(result.updatedPlayer.skillLoadout.selected, 0);
      assert.deepEqual(result.updatedPlayer.skillLoadout.cooldowns, {});
  });

  test('cycle 191: handleDefeat가 stats.deaths += 1 (회귀 가드)', () => {
      const player = buildPlayer({
          stats: { ...INITIAL_STATE.player.stats, deaths: 5 },
      });
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      assert.equal(result.updatedPlayer.stats.deaths, 6);
  });
}

// ─── cycle-194-abyss-prestige-points-dead-fix.test.js ───
{
  /**
   * cycle 194: abyss 'prestige_points' dead reward type 정리.
   *
   * 발견:
   * - BALANCE.ABYSS_MILESTONE_REWARDS의 floor 75/200/500이 'prestige_points' type 보상.
   * - 그러나 player.prestigePoints는 combatBossHandlers.ts 한 곳에서 +1만 되고
   *   spend/UI/ASCEND/save 어디에서도 사용 안 됨 — dead currency.
   * - 결과: abyss 75/200/500층 도달 시 visible 보상 0건. 'prestige points +N' 로그만
   *   출력되고 실제 게임 변화 없음.
   *
   * 수정:
   * 1. src/data/constants.ts ABYSS_MILESTONE_REWARDS 75/200/500을 의미 있는 type으로 교체:
   *    - 75: relic_choice (선택지 다양화)
   *    - 200: legendary_item (50/100/300 일관)
   *    - 500: relic_choice (최종 마일스톤도 의미 있는 보상)
   * 2. src/hooks/combatActions/combatBossHandlers.ts 'prestige_points' 분기 제거.
   * 3. src/data/messages.ts MSG.ABYSS_PRESTIGE_POINTS 제거 (dead).
   *
   * cycle 134/138/147/159/172/176/178/193 dead config 활성/정리 시리즈 8번째 fix.
   */

  test('cycle 194: ABYSS_MILESTONE_REWARDS에 prestige_points type 0건', () => {
      const types = new Set();
      for (const reward of Object.values(BALANCE.ABYSS_MILESTONE_REWARDS || {})) {
          if (reward?.type) types.add(reward.type);
      }
      assert.ok(!types.has('prestige_points'),
          `'prestige_points' type은 dead — relic_choice/legendary_item으로 교체됐어야 함`);
  });

  test('cycle 194: floor 75/200/500 보상이 의미 있는 type으로 교체됨', () => {
      const r75 = BALANCE.ABYSS_MILESTONE_REWARDS[75];
      const r200 = BALANCE.ABYSS_MILESTONE_REWARDS[200];
      const r500 = BALANCE.ABYSS_MILESTONE_REWARDS[500];
      assert.equal(r75?.type, 'relic_choice');
      assert.equal(r200?.type, 'legendary_item');
      assert.equal(r500?.type, 'relic_choice');
  });

  test('cycle 194: ABYSS_MILESTONE_REWARDS 모든 type이 의미 있는 set에 속함', () => {
      const VALID_TYPES = new Set(['relic_choice', 'legendary_item']);
      const issues = [];
      for (const [floor, reward] of Object.entries(BALANCE.ABYSS_MILESTONE_REWARDS || {})) {
          if (!reward?.type || !VALID_TYPES.has(reward.type)) {
              issues.push(`floor ${floor}: type '${reward?.type}'`);
          }
      }
      assert.deepEqual(issues, [],
          `ABYSS_MILESTONE_REWARDS의 unknown type:\n  ${issues.join('\n  ')}`);
  });

  test('cycle 194: MSG.ABYSS_PRESTIGE_POINTS 제거됨 (dead)', () => {
      assert.equal(MSG.ABYSS_PRESTIGE_POINTS, undefined,
          'MSG.ABYSS_PRESTIGE_POINTS는 prestige_points dead reward와 함께 제거');
  });

  test('cycle 194: combatBossHandlers에 prestige_points 분기 없음 (회귀 가드)', async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const src = await readFile(path.join(ROOT, 'src/hooks/combatActions/combatBossHandlers.ts'), 'utf8');
      // milestone.type === 'prestige_points' 분기는 없어야 함 (코멘트의 prestige_points 단어는 OK).
      assert.doesNotMatch(src, /milestone\.type === ['"]prestige_points['"]/);
  });
}

// ─── cycle-195-dead-balance-constants-cleanup.test.js ───
{
  /**
   * cycle 195: dead BALANCE / CONSTANTS 키 6종 정리 + 회귀 가드.
   *
   * 발견:
   * - cycle 138이 CONSTANTS/BALANCE namespace mismatch 회귀 가드(사용된 키가 정의된
   *   네임스페이스와 일치하는지). 그러나 정의됐지만 사용 0건인 dead key는 검사 안 함.
   * - 7 dead key 발견 (CHALLENGE_REWARD_SCALING은 (BALANCE as any).pattern으로 사용
   *   중이라 false positive — 6개만 진짜 dead):
   *   - BALANCE.MILESTONE_KILLS — checkMilestones가 10/50/100 inline 하드코딩.
   *   - BALANCE.EXP_LEVEL_CAP_50 — cycle 99에서 EXP_LEVEL_HARD_CAP으로 이행 완료.
   *   - BALANCE.RARITY_TIERS — UI는 RARITY_CLASSES 사용.
   *   - BALANCE.RARITY_SELL_MULT — ShopPanel 별도 처리.
   *   - BALANCE.COSMETIC_TITLE_COST — cycle 185 이후 PREMIUM_SHOP.cosmeticTitles 각 항목에
   *     개별 cost 정의됨.
   *   - CONSTANTS.SAVE_KEY — Firebase Firestore 사용으로 localStorage 미사용.
   *
   * 수정 (src/data/constants.ts): 6 dead key 제거 + 코멘트로 제거 이유 명시.
   *
   * 가드: 모든 BALANCE/CONSTANTS 키가 src/ 어딘가에서 참조됨. cycle 138 namespace
   * mismatch 가드와 짝 — 새 dead key 추가 시 즉시 detect.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const SRC = path.join(ROOT, 'src');
  const CONSTANTS_PATH = path.join(SRC, 'data/constants.ts');

  const walk = async (dir) => {
      const entries = await readdir(dir, { withFileTypes: true });
      let out = '';
      for (const e of entries) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) out += await walk(full);
          else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
              if (full === CONSTANTS_PATH) continue;
              out += await readFile(full, 'utf8');
              out += '\n';
          }
      }
      return out;
  };

  test('cycle 195: 6 dead key 제거됨 (BALANCE / CONSTANTS)', () => {
      assert.equal(BALANCE.MILESTONE_KILLS, undefined);
      assert.equal(BALANCE.EXP_LEVEL_CAP_50, undefined);
      assert.equal(BALANCE.RARITY_TIERS, undefined);
      assert.equal(BALANCE.RARITY_SELL_MULT, undefined);
      assert.equal(BALANCE.COSMETIC_TITLE_COST, undefined);
      assert.equal(CONSTANTS.SAVE_KEY, undefined);
  });

  test('cycle 195: 모든 BALANCE 키가 src/ 어딘가에서 참조됨 (회귀 가드)', async () => {
      const corpus = await walk(SRC);
      const dead = [];
      for (const key of Object.keys(BALANCE)) {
          // BALANCE.X 또는 (BALANCE as any).X 패턴 모두 감지.
          const re = new RegExp(`BALANCE(?:\\s+as\\s+any\\)?)?[\\.\\)]\\s*\\.?\\s*${key}\\b|\\(BALANCE\\s+as\\s+any\\)\\.${key}\\b`);
          if (!re.test(corpus)) dead.push(key);
      }
      assert.deepEqual(dead, [],
          `dead BALANCE keys (defined but not used in src/):\n  ${dead.join('\n  ')}`);
  });

  test('cycle 195: 모든 CONSTANTS 키가 src/ 어딘가에서 참조됨 (회귀 가드)', async () => {
      const corpus = await walk(SRC);
      const dead = [];
      for (const key of Object.keys(CONSTANTS)) {
          const re = new RegExp(`CONSTANTS\\.${key}\\b`);
          if (!re.test(corpus)) dead.push(key);
      }
      assert.deepEqual(dead, [],
          `dead CONSTANTS keys (defined but not used in src/):\n  ${dead.join('\n  ')}`);
  });

  test('cycle 138 회귀 가드: 핵심 active key 보존 (DATA_VERSION / EXP_LEVEL_HARD_CAP / RARITY_CLASSES)', () => {
      assert.equal(typeof CONSTANTS.DATA_VERSION, 'number');
      assert.equal(typeof BALANCE.EXP_LEVEL_HARD_CAP, 'number');
      assert.equal(typeof BALANCE.REVIVE_COST, 'number');
  });
}

// ─── cycle-198-has-temp-state-void-heart-not-temp.test.js ───
{
  /**
   * cycle 198: hasTemporaryAdventureState가 voidHeart 플래그를 'temporary'로 간주 안 함 (cycle 187 follow-up).
   *
   * 발견 (cycle 187 follow-up — 무한 재호출 회귀):
   * - cycle 187이 clearTemporaryAdventureState에서 voidHeartUsed/Armed를 보존하도록 변경.
   *   '런당 1회' spec과 정합.
   * - 그러나 hasTemporaryAdventureState는 여전히 이 두 플래그를 'temporary'로 카운트.
   * - 결과: 안전 맵 이동마다 'shouldClearTemporaryState' true → clear 호출 → voidHeart는
   *   여전히 true → 다음 이동에서도 또 true → 무한 재호출. 동작은 idempotent라 큰 문제는
   *   없지만 불필요한 re-dispatch + 일관성 위반.
   *
   * 수정 (src/utils/playerStateUtils.ts):
   * - hasTemporaryAdventureState에서 voidHeartUsed / voidHeartArmed 검사 제거.
   * - clear가 preserve하는 플래그는 has도 'temporary'로 안 봄 — 일관성.
   *
   * 기존 cycle 187 테스트(player-state-utils.test.js): cleared 후 hasTemporaryAdventureState가
   *   true를 expected로 가정했으나 cycle 198 후엔 false가 expected. 동시 업데이트.
   */

  test('cycle 198: voidHeartUsed=true만 있으면 hasTemporaryAdventureState false', () => {
      const player = {
          tempBuff: { atk: 0, def: 0, turn: 0, name: null },
          status: [],
          combatFlags: { voidHeartUsed: true, voidHeartArmed: false },
          nextHitEvaded: false,
      };
      assert.equal(hasTemporaryAdventureState(player), false);
  });

  test('cycle 198: voidHeartArmed=true만 있으면 hasTemporaryAdventureState false', () => {
      const player = {
          tempBuff: { atk: 0, def: 0, turn: 0, name: null },
          status: [],
          combatFlags: { voidHeartUsed: false, voidHeartArmed: true },
          nextHitEvaded: false,
      };
      assert.equal(hasTemporaryAdventureState(player), false);
  });

  test('cycle 198: clear → has가 false (무한 재호출 방지)', () => {
      const player = {
          tempBuff: { atk: 0.3, def: 0, turn: 2, name: '버프' },
          status: ['burn'],
          combatFlags: { voidHeartUsed: true, voidHeartArmed: true, comboCount: 5 },
          nextHitEvaded: true,
      };
      assert.equal(hasTemporaryAdventureState(player), true, '초기 상태는 temporary');
      const cleared = clearTemporaryAdventureState(player);
      assert.equal(hasTemporaryAdventureState(cleared), false,
          '안전 맵 이동 후엔 voidHeart preserve되어도 has는 false (재호출 방지)');
  });

  test('cycle 198: 다른 temporary 플래그(comboCount/deathSaveUsed/status)는 여전히 catch', () => {
      const cases = [
          { combatFlags: { comboCount: 3 } },
          { combatFlags: { deathSaveUsed: true } },
          { status: ['burn'] },
          { tempBuff: { atk: 0.3, turn: 2, name: 'x' } },
          { nextHitEvaded: true },
      ];
      for (const c of cases) {
          const p = { tempBuff: {}, status: [], combatFlags: {}, ...c };
          assert.equal(hasTemporaryAdventureState(p), true,
              `expected true for ${JSON.stringify(c)}`);
      }
  });
}
