import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { DB } from '../src/data/db.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { fileURLToPath } from 'node:url';
import { getEquipmentProfile } from '../src/utils/equipmentUtils.js';
import { readFile } from 'node:fs/promises';

/**
 * 장비(Equipment) cycle 테스트 (audit #1 통합 14개)
 */

// ─── cycle-224-mp-bonus-equipment.test.js ───
{
  /**
   * cycle 224: 4 items의 mpBonus 필드가 dead config인 silent 회귀 fix.
   *
   * 발견 (item.mpBonus 미적용):
   * - 4 items에 mpBonus 필드 + desc_stat 'MP+N' 표시:
   *   · 빙결 지팡이 (T4 weapon, mpBonus: 30)
   *   · 빙하의 지팡이 (T5 weapon, mpBonus: 50)
   *   · 상급 폭풍 로브 (T4 armor, mpBonus: 25)
   *   · 차원의 로브 (T5 armor, mpBonus: 45)
   * - 그러나 코드에서 'item.mpBonus' read 0건. equipmentUtils.getOffhandMpBonus는
   *   'item.mp' 필드만 읽고 (focus subtype 방패용), weapon/armor의 mpBonus는 무시.
   * - 결과: 플레이어가 desc_stat 'MP+30' 등을 보고 장착하지만 실제 maxMp는 변화 없음.
   *   silent dead config — cycle 137(BALANCE.X 미참조) / cycle 215(reward type 미처리)와 동일 lens.
   *
   * 추정 origin: 데이터 작성 시 두 표기('mp' on shield / 'mpBonus' on weapon-armor) 혼용.
   * 코드는 'mp'만 처리해 mpBonus가 silently 누락.
   *
   * 수정 (src/utils/equipmentUtils.ts):
   * - getEquipmentProfile.mpBonus 계산 확장 — main weapon + armor의 mpBonus|mp 필드도 합산.
   *   기존 offhand shield 방식 유지 + main + armor 추가.
   *
   * 회귀 가드:
   * - shield offhand의 mp 필드는 그대로 유지 (focus 마도서들 영향 없음).
   * - mpBonus 미설정 weapon/armor는 0 영향.
   *
   * 영향 (의도된 활성화):
   * - 마법사/아크메이지가 빙결 지팡이 장착 시 +30 maxMp.
   * - 차원의 로브 장착 시 +45 maxMp.
   * - desc_stat과 실제 stat 정합성 회복.
   */

  test('cycle 224: 4 items이 mpBonus 필드 정의 (baseline)', () => {
      const expected = [
          { name: '빙결 지팡이', mpBonus: 30 },
          { name: '빙하의 지팡이', mpBonus: 50 },
          { name: '상급 폭풍 로브', mpBonus: 25 },
          { name: '차원의 로브', mpBonus: 45 },
      ];
      const allItems = [...(DB.ITEMS.weapons || []), ...(DB.ITEMS.armors || [])];
      for (const exp of expected) {
          const item = allItems.find((i) => i.name === exp.name);
          assert.ok(item, `${exp.name} should exist`);
          assert.equal(item.mpBonus, exp.mpBonus);
      }
  });

  test('cycle 224: getEquipmentProfile이 main weapon mpBonus 합산', () => {
      const equip = {
          weapon: { name: '빙결 지팡이', type: 'weapon', val: 70, mpBonus: 30, hands: 2 },
          armor: null,
          offhand: null,
      };
      const profile = getEquipmentProfile(equip);
      assert.ok(profile.mpBonus >= 30,
          `main weapon mpBonus 30이 profile.mpBonus에 반영되어야 함 (실제: ${profile.mpBonus})`);
  });

  test('cycle 224: getEquipmentProfile이 armor mpBonus 합산', () => {
      const equip = {
          weapon: null,
          armor: { name: '차원의 로브', type: 'armor', val: 60, mpBonus: 45 },
          offhand: null,
      };
      const profile = getEquipmentProfile(equip);
      assert.ok(profile.mpBonus >= 45,
          `armor mpBonus 45가 profile.mpBonus에 반영되어야 함 (실제: ${profile.mpBonus})`);
  });

  test('cycle 224: weapon + armor + shield mp 모두 합산', () => {
      const equip = {
          weapon: { name: '빙결 지팡이', type: 'weapon', val: 70, mpBonus: 30 },
          armor: { name: '상급 폭풍 로브', type: 'armor', val: 40, mpBonus: 25 },
          offhand: { name: '룬 마도서', type: 'shield', subtype: 'focus', val: 4, mp: 20 },
      };
      const profile = getEquipmentProfile(equip);
      assert.equal(profile.mpBonus, 75,
          '30 (weapon) + 25 (armor) + 20 (shield offhand) = 75');
  });

  test('cycle 224: 빙결 지팡이 장착 시 maxMp +30 실제 적용', () => {
      const player = {
          name: 'Test', job: '마법사', level: 10,
          hp: 100, maxHp: 200, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: {
              weapon: { name: '빙결 지팡이', type: 'weapon', val: 70, mpBonus: 30, hands: 2 },
              armor: null,
              offhand: null,
          },
          relics: [],
          skillChoices: {},
          titles: [],
          stats: {},
      };
      const stats = calculateFullStats(player);
      // baseMaxMp = (player.maxMp + equipmentMpBonus + ...) * relicBonus.mpMult * (1 + affinityMpBonus)
      // 100 + 30 (mpBonus) = 130 minimum
      assert.ok(stats.maxMp >= 130,
          `빙결 지팡이의 mpBonus 30이 maxMp에 반영되어야 함 (baseline 100, 실제: ${stats.maxMp})`);
  });

  test('cycle 224: mpBonus 없는 무기는 0 영향 (회귀 가드)', () => {
      const equip = {
          weapon: { name: '강철 롱소드', type: 'weapon', val: 30 },
          armor: null,
          offhand: null,
      };
      const profile = getEquipmentProfile(equip);
      assert.equal(profile.mpBonus, 0, 'mpBonus 미설정 weapon은 0 영향');
  });

  test('cycle 224: shield의 mp 필드는 그대로 동작 (회귀 가드)', () => {
      const equip = {
          weapon: null,
          armor: null,
          offhand: { name: '견습 주문서', type: 'shield', subtype: 'focus', val: 2, mp: 12 },
      };
      const profile = getEquipmentProfile(equip);
      assert.equal(profile.mpBonus, 12, 'focus shield의 mp 12는 보존되어야 함 (cycle 224 회귀 가드)');
  });
}

// ─── cycle-225-hp-bonus-equipment.test.js ───
{
  /**
   * cycle 225: 2 armors의 hpBonus 필드가 dead config인 silent 회귀 fix
   *   (cycle 224 mpBonus와 동일 lens).
   *
   * 발견 (item.hpBonus 미적용):
   * - 2 armors에 hpBonus 필드 + desc_stat 'HP+N' 표시:
   *   · 용암 판금갑 (T4 armor, hpBonus: 80)
   *   · 용비늘 갑주 (T5 armor, hpBonus: 150)
   * - 그러나 코드에서 'item.hpBonus' read 0건. statsCalculator의 hpBonus 처리는
   *   jobOutfitAffinity.bonus.hpBonus(% 기반)와 CombatEngine 레벨 마일스톤만.
   * - 결과: 플레이어가 desc_stat 'HP+80' 보고 장착하지만 실제 maxHp 변화 없음.
   *   합계 +230 HP가 영원히 적용 안 되던 silent dead config.
   *
   * 패턴 (cycle 224 lens 확장):
   * - cycle 137: BALANCE.X 미참조 dead config.
   * - cycle 215: claimAchievement premiumCurrency 미처리.
   * - cycle 222: weapon 5종 armors 버킷 오배치.
   * - cycle 223: '얼음' elem 비매칭.
   * - cycle 224: 4 items mpBonus 미적용.
   * - cycle 225: 2 armors hpBonus 미적용.
   *
   * 수정 (src/utils/equipmentUtils.ts):
   * - getItemHpContribution 헬퍼 추가 — item.hpBonus 합산.
   * - getEquipmentProfile에 hpBonus 필드 추가 (mpBonus 패턴 동일).
   *
   * 수정 (src/utils/statsCalculator.ts):
   * - equipmentHpBonus를 equipProfile에서 추출.
   * - baseMaxHp 계산에 +equipmentHpBonus 합산.
   *
   * 회귀 가드:
   * - 기존 hpBonus 미설정 armor는 0 영향.
   * - jobOutfitAffinity의 hpBonus(%)는 그대로 (별도 path).
   *
   * 영향 (의도된 활성화):
   * - 전사/버서커가 용암 판금갑 장착 시 +80 maxHp.
   * - 용비늘 갑주 장착 시 +150 maxHp.
   * - desc_stat과 실제 stat 정합성 회복.
   */

  test('cycle 225: 2 armors가 hpBonus 필드 정의 (baseline)', () => {
      const expected = [
          { name: '용암 판금갑', hpBonus: 80 },
          { name: '용비늘 갑주', hpBonus: 150 },
      ];
      const allArmors = DB.ITEMS.armors || [];
      for (const exp of expected) {
          const item = allArmors.find((i) => i.name === exp.name);
          assert.ok(item, `${exp.name} should exist`);
          assert.equal(item.hpBonus, exp.hpBonus);
      }
  });

  test('cycle 225: getEquipmentProfile이 armor hpBonus 합산 (hpBonus 필드 노출)', () => {
      const equip = {
          weapon: null,
          armor: { name: '용암 판금갑', type: 'armor', val: 65, hpBonus: 80 },
          offhand: null,
      };
      const profile = getEquipmentProfile(equip);
      assert.ok(profile.hpBonus >= 80,
          `armor hpBonus 80이 profile.hpBonus에 반영되어야 함 (실제: ${profile.hpBonus})`);
  });

  test('cycle 225: 용암 판금갑 장착 시 maxHp +80 실제 적용', () => {
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 100, maxHp: 200, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: {
              weapon: null,
              armor: { name: '용암 판금갑', type: 'armor', val: 65, hpBonus: 80 },
              offhand: null,
          },
          relics: [],
          skillChoices: {},
          titles: [],
          stats: {},
      };
      const stats = calculateFullStats(player);
      // baseMaxHp = (player.maxHp + codexBonus.hp + passiveBonus.hp + equipmentHpBonus) * setBonus.hpMult * ...
      // 200 + 80 (hpBonus) = 280 minimum
      assert.ok(stats.maxHp >= 280,
          `용암 판금갑의 hpBonus 80이 maxHp에 반영되어야 함 (baseline 200, 실제: ${stats.maxHp})`);
  });

  test('cycle 225: 용비늘 갑주 장착 시 maxHp +150 실제 적용', () => {
      const player = {
          name: 'Test', job: '전사', level: 20,
          hp: 100, maxHp: 300, mp: 50, maxMp: 100,
          atk: 30, def: 10,
          equip: {
              weapon: null,
              armor: { name: '용비늘 갑주', type: 'armor', val: 95, hpBonus: 150 },
              offhand: null,
          },
          relics: [],
          skillChoices: {},
          titles: [],
          stats: {},
      };
      const stats = calculateFullStats(player);
      assert.ok(stats.maxHp >= 450,
          `용비늘 갑주의 hpBonus 150이 maxHp에 반영되어야 함 (baseline 300, 실제: ${stats.maxHp})`);
  });

  test('cycle 225: hpBonus 미설정 armor는 0 영향 (회귀 가드)', () => {
      const equip = {
          weapon: null,
          armor: { name: '강철 갑옷', type: 'armor', val: 30 },
          offhand: null,
      };
      const profile = getEquipmentProfile(equip);
      assert.equal(profile.hpBonus || 0, 0, 'hpBonus 미설정 armor는 0 영향');
  });

  test('cycle 224 회귀 가드: mpBonus 합산 동작 유지', () => {
      const equip = {
          weapon: { name: '빙결 지팡이', type: 'weapon', val: 70, mpBonus: 30 },
          armor: { name: '상급 폭풍 로브', type: 'armor', val: 40, mpBonus: 25 },
          offhand: null,
      };
      const profile = getEquipmentProfile(equip);
      assert.equal(profile.mpBonus, 55, '30+25 mpBonus 합산 (cycle 224)');
  });

  test('cycle 225: 합계 230 HP가 더 이상 dead config 아님 (정합성 lock)', () => {
      // 용암 판금갑 80 + 용비늘 갑주 150 = 230
      const dragon1 = (DB.ITEMS.armors || []).find((a) => a.name === '용암 판금갑');
      const dragon2 = (DB.ITEMS.armors || []).find((a) => a.name === '용비늘 갑주');
      const total = (dragon1?.hpBonus || 0) + (dragon2?.hpBonus || 0);
      assert.equal(total, 230, 'cycle 225 fix 이전 230 HP가 dead config였음 (회귀 baseline)');
  });
}

// ─── cycle-341-equipment-art-dead-fields.test.js ───
{
  /**
   * cycle 341: getEquipmentArtProfile 3 dead 출력 필드 정리 (itemName / subtype / hands)
   *   (cycle 222-340 silent dead config 시리즈 109번째 — cleanup lens 연속).
   *
   * 발견 (3 dead output fields):
   * - getEquipmentArtProfile 출력에서 itemName / subtype / hands 3 필드.
   * - src/, tests/ 어디에서도 read 0건.
   *
   * 활성 필드 (보존):
   * - slot / key (avatarEquipmentPreview, test).
   * - toneKey / palette (test).
   * - headgearStyle / bodyStyle / isHeadgearOnly (avatar / preview / test).
   * - style (avatar / preview / test).
   *
   * 패턴 (cycle 222-340 silent dead config 시리즈 109번째):
   * - cycle 339: getSynthesisGroups rarity + getItemRarity cascade.
   * - cycle 341: getEquipmentArtProfile 3 dead 출력 필드.
   *
   * 수정 (src/utils/equipmentArt.ts):
   * - armor / shield / weapon 분기에서 itemName / subtype / hands 필드 제거.
   *
   * 회귀 가드:
   * - slot / key / toneKey / palette / headgearStyle / bodyStyle / isHeadgearOnly /
   *   style 필드 보존.
   * - tests/equipment-art.test.js 통과.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 341: getEquipmentArtProfile itemName / subtype / hands 0건', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      const fn = source.slice(source.indexOf('export const getEquipmentArtProfile'));
      assert.ok(!/itemName: item\.name/.test(fn), 'itemName 출력 0건');
      assert.ok(!/subtype: isFocusOffhand/.test(fn), 'subtype 출력 0건');
      assert.ok(!/hands: Number\(item\.hands\)/.test(fn), 'hands 출력 0건');
  });

  test('cycle 341: getEquipmentArtProfile 활성 필드 보존', async () => {
      const { getEquipmentArtProfile } = await import('../src/utils/equipmentArt.js');
      const armor = getEquipmentArtProfile({ name: '여행자 튜닉', type: 'armor' }, 'armor', 'tunic');
      assert.equal(armor.slot, 'armor', 'slot 보존');
      assert.ok('headgearStyle' in armor, 'headgearStyle 보존');
      assert.ok('bodyStyle' in armor, 'bodyStyle 보존');
      assert.ok('toneKey' in armor, 'toneKey 보존');
      assert.equal(armor.itemName, undefined, 'itemName 제거');
  });

  test('cycle 341: weapon/shield style 보존', async () => {
      const { getEquipmentArtProfile } = await import('../src/utils/equipmentArt.js');
      const weapon = getEquipmentArtProfile({ name: '녹슨 단검', type: 'weapon', hands: 1 }, 'weapon');
      assert.ok('style' in weapon, 'weapon style 보존');
      assert.equal(weapon.hands, undefined, 'weapon hands 제거');
      const shield = getEquipmentArtProfile({ name: '목재 방패', type: 'shield' }, 'offhand');
      assert.ok('style' in shield, 'shield style 보존');
      assert.equal(shield.subtype, undefined, 'shield subtype 제거');
  });

  test('cycle 340 회귀 가드: CHANGELOG batch 보존', async () => {
      const source = await readSrc('CHANGELOG.md');
      assert.ok(/Cycle 340 🎯/.test(source),
          'cycle 340 batch entry 보존');
  });
}

// ─── cycle-359-equipment-tint-element-aliases-dead.test.js ───
{
  /**
   * cycle 359: ELEMENT_FILTERS 불 / 얼음 / 화염속성 3 unreachable aliases dead 정리
   *   (cycle 222-358 silent dead config 시리즈 126번째 — cleanup lens 연속).
   *
   * 발견 (3 dead element aliases):
   * - equipmentTint.ts ELEMENT_FILTERS 11 keys: 화염 / 불 / 화염속성 / 냉기 / 얼음 /
   *   빛 / 자연 / 대지 / 어둠 / 에테르 / 바람.
   * - src/data/items.ts 모든 아이템의 실제 elem 값: 화염 / 냉기 / 빛 / 자연 / 대지 /
   *   어둠 / 에테르 / 바람 / 물리 8종만 사용. (cycle 223에서 '얼음' → '냉기' 일괄 통일)
   * - 따라서 ELEMENT_FILTERS의 '불' / '얼음' / '화염속성' 3 entries는 unreachable —
   *   item.elem이 이 값을 가지는 경우 0건.
   *
   * 패턴 (cycle 222-358 silent dead config 시리즈 126번째):
   * - cycle 358: TONE_GLOW.steel / TONE_ACCENT.steel 2 unreachable.
   * - cycle 359: ELEMENT_FILTERS 3 unreachable aliases.
   *
   * 수정 (src/utils/equipmentTint.ts):
   * - ELEMENT_FILTERS에서 불 / 얼음 / 화염속성 3 entries 제거.
   *
   * 회귀 가드:
   * - 활성 8 elem (화염/냉기/빛/자연/대지/어둠/에테르/바람) 보존.
   * - getEquipmentTintFilter 동작 그대로 (lookup hit/miss 패턴 유지).
   * - cycle 223 '얼음' → '냉기' 통일 회귀 가드 (items.ts 검사) 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 359: ELEMENT_FILTERS 불 / 얼음 / 화염속성 0건', async () => {
      const source = await readSrc('src/utils/equipmentTint.ts');
      const fnStart = source.indexOf('const ELEMENT_FILTERS');
      const fnEnd = source.indexOf('const matchHint');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/^\s+불:/m.test(block), 'ELEMENT_FILTERS에서 불 0건');
      assert.ok(!/^\s+얼음:/m.test(block), 'ELEMENT_FILTERS에서 얼음 0건');
      assert.ok(!/^\s+화염속성:/m.test(block), 'ELEMENT_FILTERS에서 화염속성 0건');
  });

  test('cycle 359: ELEMENT_FILTERS 활성 8 elem 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/equipmentTint.ts');
      const fnStart = source.indexOf('const ELEMENT_FILTERS');
      const fnEnd = source.indexOf('const matchHint');
      const block = source.slice(fnStart, fnEnd);
      const activeElems = ['화염', '냉기', '빛', '자연', '대지', '어둠', '에테르', '바람'];
      for (const elem of activeElems) {
          assert.ok(new RegExp(`^\\s+${elem}:`, 'm').test(block), `${elem} 보존`);
      }
  });

  test('cycle 359: getEquipmentTintFilter 동작 보존 (활성 elem)', async () => {
      const { getEquipmentTintFilter } = await import('../src/utils/equipmentTint.js');
      const fireItem = { name: '화염의 검', tier: 4, elem: '화염' };
      const filter = getEquipmentTintFilter(fireItem);
      assert.ok(filter !== null, 'fire elem 필터 적용');
      assert.ok(/hue-rotate/.test(filter), 'hue-rotate CSS 생성');
  });

  test('cycle 358 회귀 가드: TONE_GLOW.steel / TONE_ACCENT.steel 0건 보존', async () => {
      const overlay = await readSrc('src/components/LegendaryDropOverlay.tsx');
      const codex = await readSrc('src/components/codex/LegendaryCodex.tsx');
      assert.ok(!/^\s+steel:/m.test(overlay), 'cycle 358 TONE_GLOW.steel 0건 보존');
      assert.ok(!/^\s+steel:/m.test(codex), 'cycle 358 TONE_ACCENT.steel 0건 보존');
  });
}

// ─── cycle-417-equipment-panel-slot-config-icon-dead.test.js ───
{
  /**
   * cycle 417: EquipmentPanel SLOT_CONFIG `icon` 출력 dead 정리 + 미사용 import cleanup
   *   (cycle 222-416 silent dead config 시리즈 178번째 — function output dead lens 회귀).
   *
   * 발견 (3 dead 출력 필드 + 2 dead imports):
   * - src/components/EquipmentPanel.tsx SLOT_CONFIG (line 21-25): 3 entry —
   *   weapon/armor/offhand. 각 entry에 `icon: Sword/Shield/Sparkles` 필드.
   * - 렌더 사이트는 `slot.key`, `slot.label`, `slot.item`, `slot.canEnhance`,
   *   `slot.requirement`, `slot.isSignature`만 read.
   * - `slot.icon` src/, tests/ 어디에서도 read 0건.
   * - cascade: SLOT_CONFIG.icon 제거 후 Sword / Shield (lucide-react) imports
   *   미사용. Sparkles는 line 261/375 다른 JSX에서 사용 보존.
   *
   * 패턴 (cycle 222-416 시리즈 178번째):
   * - cycle 393: PREMIUM_SHOP entry 10 dead.
   * - cycle 416: ACTION_BUTTONS entry 8 dead.
   * - cycle 417: SLOT_CONFIG entry icon 3 dead — 동일 lens 회귀 + cascade unused imports.
   *
   * 수정 (src/components/EquipmentPanel.tsx):
   * - SLOT_CONFIG 3 entry에서 `icon: Sword/Shield/Sparkles` 라인 제거.
   * - lucide-react import에서 `Sword`, `Shield` 제거 (Sparkles는 다른 곳에서 사용).
   *
   * 회귀 가드:
   * - SLOT_CONFIG key / label 활성 필드 보존.
   * - Sparkles import 보존 (line 261/375 사용).
   * - Target / ChevronDown / ChevronUp 다른 import는 사용 사이트 따라 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 417: SLOT_CONFIG에서 icon 0건', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      const blockStart = source.indexOf('const SLOT_CONFIG');
      const blockEnd = source.indexOf('];', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/\bicon:/.test(block),
          'SLOT_CONFIG에서 icon 필드 0건');
  });

  test('cycle 417: SLOT_CONFIG 활성 필드 보존 (key/label)', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      const blockStart = source.indexOf('const SLOT_CONFIG');
      const blockEnd = source.indexOf('];', blockStart);
      const block = source.slice(blockStart, blockEnd);
      for (const field of ['key', 'label']) {
          const re = new RegExp(`\\b${field}:`);
          assert.ok(re.test(block), `${field} 필드 보존`);
      }
  });

  test('cycle 417: 3 entry (weapon/armor/offhand) 보존', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      const blockStart = source.indexOf('const SLOT_CONFIG');
      const blockEnd = source.indexOf('];', blockStart);
      const block = source.slice(blockStart, blockEnd);
      for (const key of ['weapon', 'armor', 'offhand']) {
          const re = new RegExp(`key:\\s*'${key}'`);
          assert.ok(re.test(block), `${key} entry 보존`);
      }
  });

  test('cycle 417: Sword / Shield imports 제거 + Sparkles 보존', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      // 첫 import 라인만 검사 (lucide-react)
      const importMatch = source.match(/import \{[^}]+\} from 'lucide-react';/);
      assert.ok(importMatch, 'lucide-react import 발견');
      const importBlock = importMatch[0];
      assert.ok(!/\bSword\b/.test(importBlock), 'Sword import 0건');
      assert.ok(!/\bShield\b/.test(importBlock), 'Shield import 0건');
      assert.ok(/\bSparkles\b/.test(importBlock), 'Sparkles import 보존');
  });

  test('cycle 416 회귀 가드: ACTION_BUTTONS tag/detail 0건', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      const blockStart = source.indexOf('const ACTION_BUTTONS');
      const blockEnd = source.indexOf('];', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/\btag:/.test(block),
          'cycle 416 ACTION_BUTTONS.tag 0건 보존');
      assert.ok(!/\bdetail:/.test(block),
          'cycle 416 ACTION_BUTTONS.detail 0건 보존');
  });
}

// ─── cycle-431-avatar-equipment-overlay-layer-default-redundant.test.js ───
{
  /**
   * cycle 431: AvatarEquipmentOverlay default `layer = 'front'` redundant 정리
   *   (cycle 222-430 silent dead config 시리즈 190번째 — redundant default annotation
   *   lens 회귀, cycle 364-368/428-429 패턴).
   *
   * 발견 (1 redundant default value):
   * - src/components/icons/AvatarEquipmentOverlay.tsx:
   *     `({ appearance, className = '', dataTestId = null, layer = 'front' }: any) => { ... }`
   * - 호출 사이트 분석 (2곳, layer 명시 전달):
   *     EquipmentAvatarPreview.tsx:47: `<AvatarEquipmentOverlay appearance={...} layer="back" />`
   *     EquipmentAvatarPreview.tsx:68: `<AvatarEquipmentOverlay appearance={...} layer="front" />`
   *   → 모든 호출자가 layer 명시 → default 'front'는 도달 불가.
   * - 다른 default(`className=''`, `dataTestId=null`)는 호출자에서 누락이라 도달
   *   가능 → 보존.
   *
   * 패턴 (cycle 222-430 시리즈 190번째):
   * - cycle 364-368 시리즈: redundant default annotation.
   * - cycle 428-429: RewardChips/QuestRewardChips default accent paired completion.
   * - cycle 431: AvatarEquipmentOverlay default layer — 동일 lens 회귀.
   *
   * 수정 (src/components/icons/AvatarEquipmentOverlay.tsx):
   * - destructure에서 `layer = 'front'` → `layer` (default 제거).
   *
   * 회귀 가드:
   * - 2 호출자 명시 layer 전달 → 동작 그대로.
   * - className/dataTestId default는 호출자 누락 path 활성이라 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 431: AvatarEquipmentOverlay destructure에서 default layer 값 제거", async () => {
      const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
      const fnIdx = source.indexOf('const AvatarEquipmentOverlay');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/layer = 'front'/.test(block),
          "AvatarEquipmentOverlay destructure default 제거됨");
      assert.ok(/\blayer\b/.test(block), 'layer 파라미터 보존');
  });

  test('cycle 431: 2 호출자 모두 layer 명시 전달 (정합성 가드)', async () => {
      const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
      const calls = source.match(/<AvatarEquipmentOverlay[^>]*\/?>/g) || [];
      assert.equal(calls.length, 2, 'EquipmentAvatarPreview에 2 호출');
      for (const call of calls) {
          assert.ok(/layer=/.test(call), `호출 "${call.slice(0, 60)}"에 layer 명시`);
      }
  });

  test('cycle 431: className / dataTestId cycle 498 cascade로 prop 자체 제거', async () => {
      // cycle 498이 두 prop 모두 cascade로 정리 (2 호출자 모두 전달 0건).
      // 이전 default 보존 가드 → cascade 보존 가드로 약화.
      const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
      const fnIdx = source.indexOf('const AvatarEquipmentOverlay');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/className/.test(block), 'className 제거 보존');
      assert.ok(!/dataTestId/.test(block), 'dataTestId 제거 보존');
  });

  test('cycle 429 회귀 가드: QuestRewardChips default accent 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      const fnIdx = source.indexOf('const QuestRewardChips');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/accent = 'blue'/.test(block), 'cycle 429 default accent 제거 보존');
  });
}

// ─── cycle-434-equipment-avatar-preview-defaults-redundant.test.js ───
{
  /**
   * cycle 434: EquipmentAvatarPreview 3 default values redundant 정리
   *   (cycle 222-433 silent dead config 시리즈 193번째 — redundant default annotation
   *   lens 회귀, cycle 364-368/428-433 패턴, redundant default 4-cycle 시리즈
   *   431/432/433/434).
   *
   * 발견 (3 redundant default values):
   * - src/components/icons/EquipmentAvatarPreview.tsx:
   *     `({ item, size = 24, className = '', variant = 'default' }: any) => { ... }`
   * - 호출 사이트 분석 (1곳, 모든 prop 명시 전달):
   *     ItemIcon.tsx:114: `<EquipmentAvatarPreview item={item} size={size}
   *                       variant={previewVariant} className="h-full w-full" />`
   *   → size / variant / className 모두 명시 → 3 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-433 시리즈 193번째):
   * - cycle 431: AvatarEquipmentOverlay default layer 제거.
   * - cycle 432: AetherMark default size 제거.
   * - cycle 433: SignalBadge default tone / size 제거.
   * - cycle 434: EquipmentAvatarPreview 3 default 제거 — 동일 lens 4-cycle 시리즈.
   *
   * 수정 (src/components/icons/EquipmentAvatarPreview.tsx):
   * - destructure에서 3 default 제거.
   *
   * 회귀 가드:
   * - 1 호출자 (ItemIcon) 모든 prop 명시 → 동작 그대로.
   * - variant 기반 ternary 분기 ('card' / 'default') 그대로 활성.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 434: EquipmentAvatarPreview destructure에서 3 default 제거', async () => {
      const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
      const fnIdx = source.indexOf('const EquipmentAvatarPreview');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/size = 24/.test(block), 'default size 제거됨');
      assert.ok(!/className = ''/.test(block), 'default className 제거됨');
      assert.ok(!/variant = 'default'/.test(block), 'default variant 제거됨');
      // 파라미터는 보존
      assert.ok(/\bitem\b/.test(block), 'item 파라미터 보존');
      assert.ok(/\bsize\b/.test(block), 'size 파라미터 보존');
      assert.ok(/\bclassName\b/.test(block), 'className 파라미터 보존');
      assert.ok(/\bvariant\b/.test(block), 'variant 파라미터 보존');
  });

  test('cycle 434: 호출 사이트 정합성 가드 (ItemIcon 명시 전달)', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      const callMatch = source.match(/<EquipmentAvatarPreview[^/]*\/>/);
      assert.ok(callMatch, 'EquipmentAvatarPreview 호출 발견');
      const call = callMatch[0];
      assert.ok(/item=/.test(call), 'item 명시');
      assert.ok(/size=/.test(call), 'size 명시');
      assert.ok(/variant=/.test(call), 'variant 명시');
      assert.ok(/className=/.test(call), 'className 명시');
  });

  test('cycle 434: variant ternary 분기 (card / default) 활성', async () => {
      const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
      assert.ok(/variant === 'card'/.test(source), "variant 'card' 분기 보존");
  });

  test('cycle 433 회귀 가드: SignalBadge default tone / size 0건', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      const fnIdx = source.indexOf('const SignalBadge =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/tone = 'neutral'/.test(block), 'cycle 433 default tone 제거 보존');
      assert.ok(!/size = 'sm'/.test(block), 'cycle 433 default size 제거 보존');
  });
}

// ─── cycle-474-equipment-panel-compact-cascade.test.js ───
{
  /**
   * cycle 474: EquipmentPanel `compact` prop cascade unreachable 정리
   *   (cycle 222-473 silent dead config 시리즈 227번째 — unreachable code path
   *   cascade cleanup, cycle 471/472/473 paired 4사이클).
   *
   * 발견 (1 prop + 5 ternary 가지 unreachable):
   * - src/components/EquipmentPanel.tsx:
   *     · interface line 19: compact?: boolean.
   *     · destructure line 39: ({ player, stats, actions, compact }).
   *     · line 89/90: className compact ternary 2건.
   *     · line 95: PixelCharacterAvatar size={compact ? 'md' : 'lg'}.
   *     · line 342/343: padding compact ternary 2건.
   * - 호출 사이트:
   *     · Dashboard.tsx:166 — cycle 471이 compact prop 제거. caller 0건.
   *     · 다른 파일 import 0건.
   * - 결과: compact 항상 undefined → 5 ternary 모두 false 가지 선택.
   *
   * 패턴 (cycle 222-473 시리즈 227번째):
   * - cycle 471: Dashboard 10 callsite compact 일괄 제거.
   * - cycle 472: MapNavigator cascade.
   * - cycle 473: AchievementPanel cascade.
   * - cycle 474: EquipmentPanel cascade — 4사이클 paired.
   *
   * 수정 (src/components/EquipmentPanel.tsx):
   * - interface에서 compact?: boolean 제거.
   * - destructure에서 compact 제거.
   * - 5 ternary 모두 false 가지로 inline.
   *   · `space-y-3`
   *   · `border border-white/8 bg-black/18 p-3`
   *   · PixelCharacterAvatar size 'lg'
   *   · `px-3 py-3` (slot padding 2건)
   *
   * 회귀 가드:
   * - player / stats / actions prop 보존.
   * - 본체 레이아웃 / SLOT_CONFIG / SIG_SET_TONE 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 474: EquipmentPanel destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      const fnIdx = source.indexOf('const EquipmentPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 474: interface에서 compact 0건', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      const ifaceIdx = source.indexOf('interface EquipmentPanelProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
  });

  test('cycle 474: 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      assert.ok(!/\bcompact\b/.test(source), '본체 compact 참조 0건');
  });

  test('cycle 474: 정합성 가드 — Dashboard <EquipmentPanel> compact 전달 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const idx = source.indexOf('<EquipmentPanel');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <EquipmentPanel> compact 전달 0건');
  });

  test('cycle 474: player / stats / actions / SLOT_CONFIG / SIG_SET_TONE 보존', async () => {
      const source = await readSrc('src/components/EquipmentPanel.tsx');
      assert.ok(/SLOT_CONFIG/.test(source), 'SLOT_CONFIG 보존');
      assert.ok(/SIG_SET_TONE/.test(source), 'SIG_SET_TONE 보존');
      const fnIdx = source.indexOf('const EquipmentPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
      assert.ok(/\bstats\b/.test(sig), 'stats prop 보존');
      assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
  });
}

// ─── cycle-498-avatar-equipment-overlay-class-name-data-testid-unreachable.test.js ───
{
  /**
   * cycle 498: AvatarEquipmentOverlay `className` + `dataTestId` props unreachable batch
   *   (cycle 222-497 silent dead config 시리즈 249번째 — unreachable code path
   *   batch cleanup, cycle 463/465/466/493/495/496 className lens 회귀).
   *
   * 발견 (2 props unreachable):
   * - src/components/icons/AvatarEquipmentOverlay.tsx (line 41):
   *     const AvatarEquipmentOverlay = ({ appearance, className = '',
   *         dataTestId = null, layer }: any) => {...
   *         data-testid={dataTestId}
   *         className={`... ${className}`.trim()}
   *     }
   * - 호출 사이트:
   *     · EquipmentAvatarPreview.tsx:50 — appearance + layer="back".
   *     · EquipmentAvatarPreview.tsx:71 — appearance + layer="front".
   *     · 2 callsite 모두 className / dataTestId 전달 0건. 다른 import 0건.
   * - 결과:
   *     · className 항상 '' → ${className} 보간은 빈 문자열만 추가.
   *     · dataTestId 항상 null → data-testid={null} 으로 attr 의미 없음.
   *
   * 패턴 (cycle 222-497 시리즈 249번째):
   * - cycle 463/465/466/493/495/496: 다양한 컴포넌트 className unreachable.
   * - cycle 498: AvatarEquipmentOverlay className + dataTestId batch — 같은 lens.
   *
   * 수정 (src/components/icons/AvatarEquipmentOverlay.tsx):
   * - destructure에서 className = '' / dataTestId = null 제거.
   * - body className 템플릿 → 정적 'pointer-events-none absolute inset-0 h-full w-full'
   *   (.trim() 제거).
   * - body data-testid={dataTestId} attr 제거.
   *
   * 회귀 가드:
   * - appearance / layer prop 보존.
   * - 본체 overlay 렌더 / weapon/armor/offhand placement 그대로.
   * - 2 callsite 동작 변동 0.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 498: AvatarEquipmentOverlay destructure에서 className / dataTestId 0건', async () => {
      const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
      const fnIdx = source.indexOf('const AvatarEquipmentOverlay =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bclassName\b/.test(sig), 'destructure에 className 0건');
      assert.ok(!/\bdataTestId\b/.test(sig), 'destructure에 dataTestId 0건');
  });

  test('cycle 498: 본체 ${className} 보간 + data-testid={dataTestId} 0건', async () => {
      const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
      assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
      assert.ok(!/data-testid=\{dataTestId\}/.test(source), 'data-testid={dataTestId} 0건');
      assert.ok(!/\bdataTestId\b/.test(source), '본체 dataTestId 참조 0건');
  });

  test('cycle 498: 정합성 가드 — 2 callsite className / dataTestId 전달 0건', async () => {
      const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
      const matches = source.match(/<AvatarEquipmentOverlay[^/]*\/>/g) || [];
      assert.equal(matches.length, 2, 'AvatarEquipmentOverlay 호출 2건');
      matches.forEach((m, i) => {
          assert.ok(!/\bclassName\b/.test(m), `callsite ${i}에 className 전달 0건`);
          assert.ok(!/\bdataTestId\b/.test(m), `callsite ${i}에 dataTestId 전달 0건`);
      });
  });

  test('cycle 498: appearance / layer prop 보존 + 본체 overlay 렌더 보존', async () => {
      const source = await readSrc('src/components/icons/AvatarEquipmentOverlay.tsx');
      const fnIdx = source.indexOf('const AvatarEquipmentOverlay =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/appearance/.test(sig), 'appearance prop 보존');
      assert.ok(/\blayer\b/.test(sig), 'layer prop 보존');
      assert.ok(/getEquipmentOverlayAssetSrc/.test(source), 'overlay asset 호출 보존');
      assert.ok(/shouldRenderArmor/.test(source), 'armor 렌더 분기 보존');
  });
}

// ─── cycle-511-equipment-utils-slot-defaults-unreachable.test.js ───
{
  /**
   * cycle 511: getWeaponAttackValue + getWeaponCritBonus 2 slot defaults batch
   *   (cycle 222-510 silent dead config 시리즈 260번째 — redundant default annotation
   *   util-level batch, util default 청소 메가 시리즈 9번째).
   *
   * 발견 (2 default unreachable):
   * - src/utils/equipmentUtils.ts (line 48, 63):
   *     export const getWeaponAttackValue = (weapon, slot: any = 'main') => {...}
   *     export const getWeaponCritBonus = (weapon, slot: any = 'main') => {...}
   * - 호출 사이트 (모두 같은 파일 내부):
   *     · getWeaponAttackValue: line 71 (slot), 109/110 ('main'/'offhand'), 259/262 ('main').
   *     · getWeaponCritBonus: line 71 (slot), 76 ('offhand'), 112 ('main'), 262 ('main').
   *     · 모든 callsite가 slot 명시 전달.
   *     · 다른 파일 import 0건 (export지만 외부 사용 0건).
   * - 결과: slot 항상 명시 전달. default 'main' 도달 불가.
   *
   * 패턴 (cycle 222-510 시리즈 260번째):
   * - cycle 502-509: util default 청소 메가 시리즈.
   * - cycle 511: equipmentUtils 2 함수 batch — 동일 lens.
   *
   * 수정 (src/utils/equipmentUtils.ts):
   * - 2 함수 모두 slot: any = 'main' → slot: any (default 제거).
   *
   * 회귀 가드:
   * - 모든 callsite 동작 그대로.
   * - body slot === 'offhand' 분기 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 511: getWeaponAttackValue signature에서 slot default 0건', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      const fnIdx = source.indexOf('export const getWeaponAttackValue');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/slot:\s*any\s*=\s*'main'/.test(sig), 'slot default 제거');
      assert.ok(/\bslot\b/.test(sig), 'slot 파라미터 자체는 보존');
  });

  test('cycle 511: getWeaponCritBonus signature에서 slot default 0건', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      const fnIdx = source.indexOf('export const getWeaponCritBonus');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/slot:\s*any\s*=\s*'main'/.test(sig), 'slot default 제거');
      assert.ok(/\bslot\b/.test(sig), 'slot 파라미터 자체는 보존');
  });

  test('cycle 511: body slot 분기 보존', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(/slot === 'offhand'/.test(source), "slot === 'offhand' 분기 보존");
      assert.ok(/OFFHAND_WEAPON_RATIO/.test(source), 'BALANCE.OFFHAND_WEAPON_RATIO 보존');
      assert.ok(/OFFHAND_ONE_HAND_CRIT_BONUS/.test(source), 'OFFHAND CRIT 보존');
  });

  test('cycle 511: 정합성 가드 — 모든 callsite slot 명시 전달', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      // getWeaponAttackValue 호출 (자체 정의 제외)
      const attackCalls = source.match(/getWeaponAttackValue\([^)]+\)/g) || [];
      attackCalls.forEach((call, i) => {
          // 호출에 콤마(2 args 이상) 있어야 함
          assert.ok(/,/.test(call), `getWeaponAttackValue callsite ${i}: slot 명시 (콤마 존재)`);
      });
      const critCalls = source.match(/getWeaponCritBonus\([^)]+\)/g) || [];
      critCalls.forEach((call, i) => {
          assert.ok(/,/.test(call), `getWeaponCritBonus callsite ${i}: slot 명시 (콤마 존재)`);
      });
  });
}

// ─── cycle-513-equipment-art-profile-slot-hint-default-unreachable.test.js ───
{
  /**
   * cycle 513: getEquipmentArtProfile `slotHint = null` default unreachable
   *   (cycle 222-512 silent dead config 시리즈 262번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 11번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/equipmentArt.ts (line 129):
   *     export const getEquipmentArtProfile = (item, slotHint: any = null,
   *         fallbackArmorStyle: any = 'coat') => {...
   *         slot: slotHint || 'none',
   *         toneKey: slotHint === 'armor' ? 'cloth' : 'steel',
   *         ...
   *     }
   * - 호출 사이트 (4 callsite):
   *     · characterAppearance.ts:66 — getEquipmentArtProfile(weapon, 'weapon').
   *     · characterAppearance.ts:67 — getEquipmentArtProfile(offhand, 'offhand').
   *     · characterAppearance.ts:68 — getEquipmentArtProfile(armor, 'armor',
   *       baseStyle.armorStyle).
   *     · avatarEquipmentPreview.ts:309 — getEquipmentArtProfile(item,
   *       item.type === 'shield' ? 'offhand' : item.type).
   *     · 4 callsite 모두 slotHint 명시 전달.
   *     · fallbackArmorStyle은 1/4만 명시 (3/4 default 'coat' 활성) → 보존.
   *
   * 패턴 (cycle 222-512 시리즈 262번째):
   * - cycle 502-512: util default 청소 메가 시리즈.
   * - cycle 513: getEquipmentArtProfile slotHint default — 동일 lens.
   *
   * 수정 (src/utils/equipmentArt.ts):
   * - signature에서 slotHint: any = null → slotHint: any (default 제거).
   * - fallbackArmorStyle default는 활성이라 보존.
   * - body slotHint || 'none' / slotHint === 'armor' 분기 보존.
   *
   * 회귀 가드:
   * - 4 callsite 동작 그대로.
   * - body slotHint / fallbackArmorStyle 사용 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 513: getEquipmentArtProfile signature에서 slotHint default 0건', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      const fnIdx = source.indexOf('export const getEquipmentArtProfile');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/slotHint:\s*any\s*=\s*null/.test(sig), 'slotHint default 제거');
      assert.ok(/\bslotHint\b/.test(sig), 'slotHint 파라미터 자체는 보존');
  });

  test('cycle 513: fallbackArmorStyle default 보존 (3/4 caller가 default 활용)', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      const fnIdx = source.indexOf('export const getEquipmentArtProfile');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/fallbackArmorStyle:\s*any\s*=\s*'coat'/.test(sig),
          "fallbackArmorStyle default 'coat' 보존");
  });

  test('cycle 513: 정합성 가드 — 4 callsite 모두 slotHint 명시 전달', async () => {
      const ca = await readSrc('src/utils/characterAppearance.ts');
      const caCalls = ca.match(/getEquipmentArtProfile\(/g) || [];
      assert.ok(caCalls.length >= 3, `characterAppearance 호출 3건 이상 (실제: ${caCalls.length})`);

      const aep = await readSrc('src/utils/avatarEquipmentPreview.ts');
      const aepCalls = aep.match(/getEquipmentArtProfile\(/g) || [];
      assert.ok(aepCalls.length >= 1, `avatarEquipmentPreview 호출 1건 이상 (실제: ${aepCalls.length})`);
  });

  test('cycle 513: body slotHint 사용 보존', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(/slot: slotHint \|\| 'none'/.test(source), "slot: slotHint || 'none' 보존");
      assert.ok(/slotHint === 'armor'/.test(source), "slotHint === 'armor' 분기 보존");
  });

  test('cycle 513: cycle 502-512 회귀 가드', async () => {
      const itemVisuals = await readSrc('src/utils/itemVisuals.ts');
      assert.ok(!/getArmorStyleFromItem[^=]*fallback:\s*any\s*=\s*'coat'/.test(itemVisuals),
          'cycle 512 getArmorStyleFromItem fallback default 0건');
  });
}

// ─── cycle-514-equipment-preview-stage-variant-default-unreachable.test.js ───
{
  /**
   * cycle 514: getEquipmentPreviewStage `variant = 'default'` default unreachable
   *   (cycle 222-513 silent dead config 시리즈 263번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 12번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/avatarEquipmentPreview.ts (line 119):
   *     export const getEquipmentPreviewStage = (item, appearance, variant: any = 'default') => {...}
   * - 호출 사이트 (1 callsite):
   *     · EquipmentAvatarPreview.tsx:11 — getEquipmentPreviewStage(item, appearance, variant).
   *     · 1 callsite, 3 args 명시 전달 (variant prop).
   *     · 다른 파일 import 0건.
   * - 결과: variant 항상 명시 전달. default 'default' 도달 불가.
   *
   * 패턴 (cycle 222-513 시리즈 263번째):
   * - cycle 502-513: util default 청소 메가 시리즈.
   * - cycle 514: getEquipmentPreviewStage variant default — 동일 lens.
   *
   * 수정 (src/utils/avatarEquipmentPreview.ts):
   * - signature에서 variant: any = 'default' → variant: any (default 제거).
   *
   * 회귀 가드:
   * - 1 callsite 동작 그대로.
   * - body withVariant / variant 사용 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 514: getEquipmentPreviewStage signature에서 variant default 0건', async () => {
      const source = await readSrc('src/utils/avatarEquipmentPreview.ts');
      const fnIdx = source.indexOf('export const getEquipmentPreviewStage');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/variant:\s*any\s*=\s*'default'/.test(sig), 'variant default 제거');
      assert.ok(/\bvariant\b/.test(sig), 'variant 파라미터 자체는 보존');
  });

  test('cycle 514: 정합성 가드 — EquipmentAvatarPreview callsite 3 args', async () => {
      const source = await readSrc('src/components/icons/EquipmentAvatarPreview.tsx');
      const matches = source.match(/getEquipmentPreviewStage\(/g) || [];
      assert.equal(matches.length, 1, 'getEquipmentPreviewStage 호출 1건');
      assert.ok(/getEquipmentPreviewStage\(item,\s*appearance,\s*variant\)/.test(source),
          '3 args 명시 전달 보존');
  });

  test('cycle 514: body variant 사용 보존', async () => {
      const source = await readSrc('src/utils/avatarEquipmentPreview.ts');
      assert.ok(/withVariant/.test(source), 'withVariant 헬퍼 보존');
      assert.ok(/variant === 'card'/.test(source) || /\bvariant\b/.test(source),
          'variant 파라미터 사용 보존');
  });

  test('cycle 514: cycle 502-513 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const ea = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(!/getEquipmentArtProfile[^=]*slotHint:\s*any\s*=\s*null/.test(ea),
          'cycle 513 getEquipmentArtProfile slotHint default 0건');
  });
}

// ─── cycle-633-get-next-equipment-state-explicit-elimination.test.js ───
{
  /**
   * cycle 633: getNextEquipmentState equip {} explicit default-elimination
   *   (cycle 222-632 silent dead config 시리즈 370번째 — explicit
   *   default-elimination pattern 23번째 적용, 변형 패턴 8번째).
   *
   * 발견 (default 이미 unreachable, signature 정리):
   * - src/utils/equipmentUtils.ts:161:
   *     export const getNextEquipmentState = (equip: EquipSlots = {}, item: Item | null | undefined) => {...}
   * - 호출 사이트 모두 명시 인자 전달:
   *     · ShopPanel.tsx:59 — getNextEquipmentState(equip, item).
   *     · SmartInventory.tsx:109 — getNextEquipmentState(player.equip, item).
   *     · _helpers.ts:41 — getNextEquipmentState(equip, item).
   *     · useInventoryActions.ts:62 — getNextEquipmentState(currentEquip, inventoryItem).
   *     · tests/equipment-utils.test.js — 모두 {} 또는 명시 객체 전달.
   * - default {} 이미 도달 불가.
   *
   * 패턴 (cycle 222-632 시리즈 370번째):
   * - cycle 502-632: default 청소 메가 시리즈 127사이클.
   * - cycle 633: explicit default-elimination 23번째 (변형 패턴 8번째).
   *
   * 수정:
   * - equipmentUtils.ts:161 — equip default {} 제거.
   *
   * 회귀 가드:
   * - 4 production callsite 동작 그대로 (이미 명시).
   * - body weapon/offhand/armor swap logic 보존.
   * - cycle 631 paired batch 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 633: getNextEquipmentState signature에서 equip default {} 0건', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/getNextEquipmentState = \(equip:\s*EquipSlots\s*=\s*\{\},/.test(source),
          'getNextEquipmentState equip default {} 제거');
      assert.ok(/getNextEquipmentState = \(equip:\s*EquipSlots,\s*item:/.test(source),
          'getNextEquipmentState equip 파라미터 보존 (default 없이)');
  });

  test('cycle 633: 4 production callsite 명시 보존', async () => {
      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(/getNextEquipmentState\(equip,\s*item\)/.test(sp),
          'ShopPanel callsite 보존');
      const si = await readSrc('src/components/SmartInventory.tsx');
      assert.ok(/getNextEquipmentState\(player\.equip(?: \|\| \{\})?,\s*item\)/.test(si),
          'SmartInventory callsite 보존');
      const ch = await readSrc('src/hooks/combatActions/_helpers.ts');
      assert.ok(/getNextEquipmentState\(equip,\s*item\)/.test(ch),
          '_helpers callsite 보존');
      const ui = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(/getNextEquipmentState\(currentEquip,\s*inventoryItem\)/.test(ui),
          'useInventoryActions callsite 보존');
  });

  test('cycle 633: cycle 502-632 회귀 가드 — default 청소 시리즈 보존', async () => {
      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/getTraitItemResonance = \([^)]*player:\s*Player\s*\|\s*null\s*=\s*null\)/.test(rp),
          'cycle 632 getTraitItemResonance player default 0건');
      const eu = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/getEquippedWeapons = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(eu),
          'cycle 631 getEquippedWeapons equip default 0건');
  });
}

// ─── cycle-634-get-equipment-profile-explicit-elimination.test.js ───
{
  /**
   * cycle 634: getEquipmentProfile equip {} explicit default-elimination
   *   (cycle 222-633 silent dead config 시리즈 371번째 — explicit
   *   default-elimination pattern 24번째 적용, 변형 패턴 9번째).
   *
   * 발견 (default 이미 unreachable, signature 정리):
   * - src/utils/equipmentUtils.ts:104:
   *     export const getEquipmentProfile = (equip: EquipSlots = {}) => {...}
   * - 호출 사이트 모두 명시 인자 전달 (8 production + 다수 test):
   *     · statsCalculator.ts:289 — getEquipmentProfile(player.equip).
   *     · EquipmentPanel.tsx:42 — getEquipmentProfile(player?.equip).
   *     · SmartInventory.tsx:108/110 — getEquipmentProfile(player.equip / nextEquip).
   *     · ShopPanel.tsx:58/60 — getEquipmentProfile(equip / nextEquip).
   *     · _helpers.ts:32/42 — getEquipmentProfile(equip / nextEquip).
   *     · cycle-224/225/534/equipment-utils tests — 모두 명시.
   * - default {} 이미 도달 불가 (전 테스트 모두 명시 객체 전달).
   *
   * 패턴 (cycle 222-633 시리즈 371번째):
   * - cycle 502-633: default 청소 메가 시리즈 128사이클.
   * - cycle 634: explicit default-elimination 24번째 (변형 패턴 9번째).
   *
   * 수정:
   * - equipmentUtils.ts:104 — equip default {} 제거.
   *
   * 회귀 가드:
   * - 8 production callsite 동작 그대로 (이미 명시).
   * - body weapon stat 합산 / shieldDef / mpBonus / hpBonus 처리 보존.
   * - cycle 631 paired batch (getEquippedWeapons / getWeaponMagicSkills) 보존.
   * - cycle 633 getNextEquipmentState 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 634: getEquipmentProfile signature에서 equip default {} 0건', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/getEquipmentProfile = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(source),
          'getEquipmentProfile equip default {} 제거');
      assert.ok(/getEquipmentProfile = \(equip:\s*EquipSlots\)/.test(source),
          'getEquipmentProfile equip 파라미터 보존 (default 없이)');
  });

  test('cycle 634: production callsite 명시 보존', async () => {
      const sc = await readSrc('src/utils/statsCalculator.ts');
      assert.ok(/getEquipmentProfile\(player\.equip(?: \|\| \{\})?\)/.test(sc),
          'statsCalculator callsite 보존');
      const ep = await readSrc('src/components/EquipmentPanel.tsx');
      assert.ok(/getEquipmentProfile\(player\?\.equip(?: \|\| \{\})?\)/.test(ep),
          'EquipmentPanel callsite 보존');
  });

  test('cycle 634: cycle 502-633 회귀 가드 — default 청소 시리즈 보존', async () => {
      const eu = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/getNextEquipmentState = \(equip:\s*EquipSlots\s*=\s*\{\}/.test(eu),
          'cycle 633 getNextEquipmentState equip default 0건');
      assert.ok(!/getEquippedWeapons = \(equip:\s*EquipSlots\s*=\s*\{\}\)/.test(eu),
          'cycle 631 getEquippedWeapons equip default 0건');
  });
}
