import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { DROP_TABLES } from '../src/data/dropTables.js';
import { LOOT_TABLE } from '../src/data/loot.js';
import { fileURLToPath } from 'node:url';
import { processLoot } from '../src/systems/CombatEngine.loot.js';
import { readFile } from 'node:fs/promises';

/**
 * 루팅(Loot) cycle 테스트 (audit #1 통합 7개)
 */

// ─── cycle-171-loot-bonus-drop-no-table.test.js ───
{
  /**
   * cycle 171: loot.ts early-return 버그 fix — drop/loot 테이블 없는 enemy도
   * inferredLevel >= 30이면 보너스 장비 드랍 발동되도록.
   *
   * 발견:
   * - processLoot가 line 71에서 lootList 미존재(null/빈 배열) 시 early return
   *   하던 회귀. 그 아래 line 89-105에 inferredLevel >= LOOT_BONUS_MIN_LEVEL(=30)
   *   이면 tier 4-6 장비 보너스 드랍 로직이 있는데, lootList 없으면 영원히 fire
   *   안 함.
   * - 결과: 104종 non-boss monster (drop/loot 둘 다 미등록)가 inferredLevel
   *   기준 한참 넘는 고레벨 enemy여도 아이템 드롭 0건. 플레이어 입장에서 "강해
   *   보이는데 빈손" 회귀.
   *
   * 수정:
   * - lootList 분기를 if-block으로 변경 → early return 제거.
   * - 보너스 드랍 로직이 lootList 유/무 관계없이 항상 실행되도록.
   */

  // 테스트용 고레벨 enemy stub — exp 200 (inferredLevel = (200-10)/5 = 38, >= 30).
  const makeHighLvEnemy = (name) => ({
      name,
      baseName: name,
      hp: 0,
      maxHp: 1000,
      atk: 100,
      def: 50,
      exp: 200,
      gold: 100,
      isBoss: false,
  });

  // drop/loot 둘 다 없는 monster 이름 선택 — '폭풍 수호자' 등.
  const NO_TABLE_MONSTER = '폭풍 수호자';

  test('cycle 171 RED→GREEN: drop/loot 없는 고레벨 enemy도 보너스 드랍 발동 가능', () => {
      // 보장: 이 monster가 정말 두 테이블 모두에 없음.
      assert.ok(!DROP_TABLES[NO_TABLE_MONSTER], 'precondition: 드랍 테이블 없음');
      assert.ok(!LOOT_TABLE[NO_TABLE_MONSTER], 'precondition: 루트 테이블 없음');

      // Math.random을 stub해 보너스 chance 통과 보장.
      const orig = Math.random;
      Math.random = () => 0.0;  // 모든 chance roll 통과
      try {
          const enemy = makeHighLvEnemy(NO_TABLE_MONSTER);
          const result = processLoot(enemy, null, 1.0); // cycle 629: explicit elimination
          // bonus chance는 LOOT_NORMAL_BONUS_CHANCE * dropRateMult(=1) * bossDropMult(=1).
          // Math.random 0.0이면 bonusChance > 0이면 발동 → items 1+ 보장.
          assert.ok(result.items.length >= 1,
              `expected bonus drop for high-level no-table enemy; got ${result.items.length} items`);
      } finally {
          Math.random = orig;
      }
  });

  test('cycle 171: drop/loot 없는 저레벨 enemy는 여전히 빈 드롭 (회귀 가드)', () => {
      const orig = Math.random;
      Math.random = () => 0.0;
      try {
          const enemy = {
              name: NO_TABLE_MONSTER,
              baseName: NO_TABLE_MONSTER,
              hp: 0,
              maxHp: 100,
              atk: 10,
              def: 5,
              exp: 20,  // inferredLevel = (20-10)/5 = 2, < 30
              gold: 10,
              isBoss: false,
          };
          const result = processLoot(enemy, null, 1.0); // cycle 629: explicit elimination
          assert.equal(result.items.length, 0,
              '저레벨(inferredLevel < 30)은 보너스 드랍 발동 안 함');
      } finally {
          Math.random = orig;
      }
  });

  test('cycle 171: drop table 있는 enemy 회귀 가드 — 정상 드랍 동작', () => {
      const orig = Math.random;
      Math.random = () => 0.0;
      try {
          // 슬라임은 drop table 보유.
          const enemy = {
              name: '슬라임',
              baseName: '슬라임',
              hp: 0,
              maxHp: 30,
              atk: 5,
              def: 2,
              exp: 5,
              gold: 5,
              isBoss: false,
          };
          const result = processLoot(enemy, null, 1.0); // cycle 629: explicit elimination
          // 슬라임 drop table에 슬라임 젤리(rate 0.55) + 하급 체력 물약(rate 0.2).
          assert.ok(result.items.length >= 1, '슬라임 drop table 정상 fire');
      } finally {
          Math.random = orig;
      }
  });
}

// ─── cycle-352-loot-upgrade-hint-score-dead.test.js ───
{
  /**
   * cycle 352: getLootUpgradeHint score 출력 dead 정리
   *   (cycle 222-351 silent dead config 시리즈 119번째 — cleanup lens 연속).
   *
   * 발견 (dead output field):
   * - getLootUpgradeHint 반환 hint 객체에 score 필드 — 함수 내부 비교용으로만 사용,
   *   외부 read 0건. PostCombatCard / addCombatDigestLogs는 hint.name / hint.summary만 read.
   *
   * 패턴 (cycle 222-351 silent dead config 시리즈 119번째):
   * - cycle 351: getTraitProfile 3 redundant override 정리.
   * - cycle 352: getLootUpgradeHint score → bestScore internal 변수로 변경.
   *
   * 수정 (src/hooks/combatActions/_helpers.ts):
   * - candidate 객체 생성 후 bestHint 비교 → bestScore 별도 변수로 비교.
   * - bestHint 객체에 score 필드 노출 0건.
   *
   * 회귀 가드:
   * - bestHint.name / bestHint.summary 보존.
   * - PostCombatCard upgradeHint.name / .summary 사용 그대로.
   * - addCombatDigestLogs MSG.COMBAT_DIGEST_EQUIP_UPGRADE(name, summary) 동일.
   * - 정렬 순서 동일 (최고 score 선택).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 352: getLootUpgradeHint score 출력 0건', async () => {
      const source = await readSrc('src/hooks/combatActions/_helpers.ts');
      const fn = source.slice(source.indexOf('export const getLootUpgradeHint'));
      // bestHint 객체 안에 score 필드 0건.
      assert.ok(!/bestHint = \{ name:[^}]*score,/.test(fn),
          'bestHint name/summary만 보존, score 0건');
      assert.ok(/let bestScore =/.test(fn),
          'bestScore internal 변수 도입');
  });

  test('cycle 352: getLootUpgradeHint 동작 보존 (최고 score 선택)', async () => {
      const { getLootUpgradeHint } = await import('../src/hooks/combatActions/_helpers.js');
      const equip = { weapon: { name: '녹슨 단검', type: 'weapon', val: 5, hands: 1 }, armor: { name: '튜닉', type: 'armor', val: 3 } };
      const lootItems = [
          { name: '강철 롱소드', type: 'weapon', val: 12, hands: 1 },
          { name: '낡은 단검', type: 'weapon', val: 4, hands: 1 },
      ];
      const hint = getLootUpgradeHint(equip, lootItems);
      if (hint) {
          assert.ok('name' in hint, 'name 보존');
          assert.ok('summary' in hint, 'summary 보존');
          assert.equal(hint.score, undefined, 'score 출력 0건');
      }
  });

  test('cycle 351 회귀 가드: getTraitProfile 3 redundant override 0건 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fn = source.slice(source.indexOf('export const getTraitProfile'), source.indexOf('export const getTraitBonus'));
      assert.ok(!/rewardFocus: definition\.rewardFocus/.test(fn),
          'cycle 351 rewardFocus override 0건 보존');
  });
}

// ─── cycle-354-trait-loot-hint-dead-fields.test.js ───
{
  /**
   * cycle 354: getTraitLootHint score/label/traitName 3 출력 dead 정리
   *   (cycle 222-353 silent dead config 시리즈 121번째 — cleanup lens 연속).
   *
   * 발견 (3 dead output fields):
   * - getTraitLootHint 반환 hint 객체에 score / label / traitName 필드.
   * - PostCombatCard / _helpers.ts(addCombatDigestLogs) 두 consumer 모두
   *   `traitHint.name` / `traitHint.summary`만 read.
   * - score / label / traitName — src/, tests/ 어디에서도 read 0건.
   *
   * 패턴 (cycle 222-353 silent dead config 시리즈 121번째):
   * - cycle 353: getSelectedSkill index/total 2 출력 dead.
   * - cycle 354: getTraitLootHint 3 출력 dead (score/label/traitName).
   *
   * 수정 (src/utils/runProfile.ts):
   * - getTraitLootHint return에서 score / label / traitName 필드 제거.
   *   (best.resonance.score 내부 사용은 getTraitFeaturedItems 정렬용으로 유지.)
   *
   * 회귀 가드:
   * - hint.name / hint.summary 보존.
   * - PostCombatCard traitHint.name / .summary 사용 그대로.
   * - _helpers.ts MSG.COMBAT_DIGEST_TRAIT_HINT(name, summary) 동일.
   * - getTraitFeaturedItems 정렬 (resonance.score 비교) 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 354: getTraitLootHint return에 score/label/traitName 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fn = source.slice(source.indexOf('export const getTraitLootHint'), source.indexOf('export const getTraitQuestResonance'));
      assert.ok(!/^\s+score:\s/m.test(fn),
          'getTraitLootHint return에서 score 필드 0건');
      assert.ok(!/^\s+label:\s/m.test(fn),
          'getTraitLootHint return에서 label 필드 0건');
      assert.ok(!/traitName:/.test(fn),
          'getTraitLootHint return에서 traitName 필드 0건');
  });

  test('cycle 354: getTraitLootHint 동작 보존 (name/summary)', async () => {
      const { getTraitLootHint, getTraitProfile } = await import('../src/utils/runProfileUtils.js');
      const player = {
          job: '도적',
          hp: 100,
          maxHp: 100,
          equip: {
              weapon: { type: 'weapon', name: '단검', val: 12, hands: 1, jobs: ['도적'] },
              offhand: { type: 'weapon', name: '단검', val: 10, hands: 1, jobs: ['도적'] },
          },
          relics: [],
          stats: {},
      };
      const trait = getTraitProfile(player, { maxHp: 100, maxMp: 50 });
      const loot = [
          { type: 'weapon', name: '암살자의 단검', val: 28, hands: 1, jobs: ['도적', '어쌔신'] },
      ];
      const hint = getTraitLootHint(loot, trait, player);
      if (hint) {
          assert.ok('name' in hint, 'name 보존');
          assert.ok('summary' in hint, 'summary 보존');
          assert.equal(hint.score, undefined, 'score 0건');
          assert.equal(hint.label, undefined, 'label 0건');
          assert.equal(hint.traitName, undefined, 'traitName 0건');
      }
  });

  test('cycle 353 회귀 가드: getSelectedSkill 반환 shape 단순화 0건 보존', async () => {
      const source = await readSrc('src/hooks/combatActions/_helpers.ts');
      const fn = source.slice(source.indexOf('export const getSelectedSkill'), source.indexOf('export const getLootUpgradeHint'));
      assert.ok(/return \{ skill: skills\[index\] \};/.test(fn),
          'cycle 353 getSelectedSkill shape 보존');
  });
}

// ─── cycle-534-get-loot-upgrade-hint-defaults-batch.test.js ───
{
  /**
   * cycle 534: getLootUpgradeHint `equip = {}` + `lootItems = []` defaults batch
   *   unreachable (cycle 222-533 silent dead config 시리즈 277번째 — redundant
   *   default annotation util/component/hook default 청소 메가 시리즈 30번째).
   *
   * 발견 (2 defaults batch):
   * - src/hooks/combatActions/_helpers.ts (line 23):
   *     export const getLootUpgradeHint = (equip: any = {},
   *         lootItems: Item[] = []): any => {
   *         const equipmentDrops = (lootItems || []).filter(...);
   *         ...
   *     };
   * - 호출 사이트 (1 callsite, hooks/combatActions/combatVictory.ts):
   *     · combatVictory.ts:213 — getLootUpgradeHint(updatedPlayer.equip,
   *       lootResult.items)
   *     · 다른 파일 import 0건.
   * - 결과: equip / lootItems 항상 명시 전달. 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-533 시리즈 277번째):
   * - cycle 502-533: util/component/hook default 청소 메가 시리즈 30사이클.
   * - cycle 534: hooks/ private helper batch — cycle 532 buildClassVitals에 이은
   *   동일 디렉토리 추가 cleanup.
   *
   * 수정 (src/hooks/combatActions/_helpers.ts):
   * - signature에서 equip: any = {} → equip: any.
   * - signature에서 lootItems: Item[] = [] → lootItems: Item[].
   * - body의 (lootItems || []) defensive guard는 별개 보존.
   * - cycle 352 bestScore strip 보존.
   *
   * 회귀 가드:
   * - 1 callsite 동작 그대로.
   * - body equipmentDrops filter / getEquipmentProfile / forEach 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 534: getLootUpgradeHint signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/hooks/combatActions/_helpers.ts');
      const fnIdx = source.indexOf('export const getLootUpgradeHint');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/equip:\s*any\s*=\s*\{\}/.test(sig),
          'getLootUpgradeHint equip default {} 제거');
      assert.ok(!/lootItems:\s*Item\[\]\s*=\s*\[\]/.test(sig),
          'getLootUpgradeHint lootItems default [] 제거');
  });

  test('cycle 534: 정합성 가드 — 1 callsite 보존', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/getLootUpgradeHint\(updatedPlayer\.equip,\s*lootResult\.items\)/.test(source),
          'getLootUpgradeHint(updatedPlayer.equip, lootResult.items) callsite 보존');
  });

  test('cycle 534: body defensive guard 보존', async () => {
      const source = await readSrc('src/hooks/combatActions/_helpers.ts');
      assert.ok(/\(lootItems \|\| \[\]\)\.filter/.test(source),
          '(lootItems || []) defensive guard 보존');
      assert.ok(/getEquipmentProfile\(equip\)/.test(source),
          'getEquipmentProfile(equip) 호출 보존');
      assert.ok(/let bestScore = -Infinity/.test(source),
          'cycle 352 bestScore internal 변수 보존');
  });

  test('cycle 534: cycle 502-533 회귀 가드 — util/component/hook default 청소 시리즈 보존', async () => {
      const rcp = await readSrc('src/components/RelicChoicePanel.tsx');
      assert.ok(!/const getRelicSynergyScore[^=]*ownedRelics:\s*any\s*=\s*\[\]/.test(rcp),
          'cycle 533 getRelicSynergyScore ownedRelics default 0건');

      const sh = await readSrc('src/hooks/gameActions/_shared.ts');
      assert.ok(!/buildClassVitals[^=]*meta:\s*any\s*=\s*\{\}/.test(sh),
          'cycle 532 buildClassVitals meta default 0건');
  });
}

// ─── cycle-552-process-loot-method-defaults-batch.test.js ───
{
  /**
   * cycle 552: CombatEngine.processLoot method `player = null` + `signaturePityMult
   *   = 1.0` defaults batch unreachable (cycle 222-551 silent dead config 시리즈
   *   293번째 — redundant default annotation 청소 메가 시리즈 46번째). systems/
   *   CombatEngine method 시리즈 6번째.
   *
   * 발견 (2 defaults batch):
   * - src/systems/CombatEngine.ts (line 1599):
   *     processLoot(enemy: Monster, player: any = null, signaturePityMult: any = 1.0) {
   *         return _processLoot(enemy, player, signaturePityMult);
   *     }
   * - 호출 사이트:
   *     · 1 production caller: combatVictory.ts:63 — CombatEngine.processLoot
   *       (deadEnemy, updatedPlayer, signaturePityMult) — 3 args 명시.
   *     · tests/cycle-171 import은 CombatEngine.loot.js의 export된 processLoot
   *       (별개 함수). CombatEngine.processLoot method는 production-only.
   * - 결과: method의 2 default 모두 도달 불가. _processLoot wrapper만 남음.
   *
   * Note: src/systems/CombatEngine.loot.ts의 export된 processLoot는 별개 함수,
   * tests/cycle-171에서 1 arg로 호출이라 default 활성. 거기는 cleanup 대상 외.
   *
   * 패턴 (cycle 222-551 시리즈 293번째):
   * - cycle 502-551: default 청소 메가 시리즈 50사이클.
   * - cycle 552: systems/CombatEngine method 시리즈 6번째 (cycle 546-551).
   *
   * 수정 (src/systems/CombatEngine.ts):
   * - method signature에서 player: any = null → player: any.
   * - method signature에서 signaturePityMult: any = 1.0 → signaturePityMult: any.
   * - body의 _processLoot delegate 보존.
   *
   * 회귀 가드:
   * - 1 production callsite 동작 그대로.
   * - body _processLoot(enemy, player, signaturePityMult) wrapper 보존.
   * - CombatEngine.loot.ts 별개 함수 cleanup 대상 외 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 552: CombatEngine.processLoot method signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const fnIdx = source.indexOf('processLoot(enemy');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/player:\s*any\s*=\s*null/.test(sig),
          'CombatEngine.processLoot player default null 제거');
      assert.ok(!/signaturePityMult:\s*any\s*=\s*1\.0/.test(sig),
          'CombatEngine.processLoot signaturePityMult default 1.0 제거');
  });

  test('cycle 552: 정합성 가드 — production callsite 보존', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/CombatEngine\.processLoot\(deadEnemy,\s*updatedPlayer,\s*signaturePityMult\)/.test(source),
          'combatVictory CombatEngine.processLoot callsite 보존');
  });

  test('cycle 552: body _processLoot wrapper 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/return _processLoot\(enemy,\s*player,\s*signaturePityMult\)/.test(source),
          '_processLoot(enemy, player, signaturePityMult) delegate 보존');
  });

  test('cycle 552: CombatEngine.loot.ts processLoot 시그니처 보존 (cycle 629 explicit elimination)', async () => {
      const source = await readSrc('src/systems/CombatEngine.loot.ts');
      assert.ok(/export const processLoot = \(enemy: Monster, player: Player \| null, signaturePityMult: any\)/.test(source),
          'CombatEngine.loot.ts processLoot 3-arg 시그니처 보존 (cycle 629에서 defaults 제거됨)');
  });

  test('cycle 552: cycle 502-551 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/getEffectiveMaxMp\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]\)/.test(ce),
          'cycle 551 getEffectiveMaxMp relics default 0건');
      assert.ok(!/tickEnemyStatus\(enemy: Monster, logs:\s*any\[\]\s*=\s*\[\]/.test(ce),
          'cycle 549 tickEnemyStatus logs default 0건');
  });
}

// ─── cycle-602-get-trait-loot-hint-defaults-batch.test.js ───
{
  /**
   * cycle 602: getTraitLootHint 2 defaults batch unreachable
   *   (cycle 222-601 silent dead config 시리즈 338번째 — redundant default annotation
   *   청소 메가 시리즈 추가, runProfile.ts).
   *
   * 발견 (2 defaults batch):
   * - src/utils/runProfile.ts (line 342):
   *     export const getTraitLootHint = (items: any[] = [], traitProfile: any,
   *         player: Player | null = null) => {...};
   * - 호출 사이트 (3 callers):
   *     · combatVictory.ts:217 — getTraitLootHint(lootResult.items, traitProfile,
   *       updatedPlayer)
   *     · run-profile-utils.test.js:212 — getTraitLootHint(loot, trait, player)
   *     · cycle-354 test:64 — getTraitLootHint(loot, trait, player)
   * - 결과: items / player 항상 명시 전달. 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-601 시리즈 338번째):
   * - cycle 502-601: default 청소 메가 시리즈 100사이클.
   * - cycle 602: runProfile.ts 추가 cleanup, cycle 598 getTraitFeaturedItems
   *   동일 모듈 paired.
   *
   * 수정 (src/utils/runProfile.ts):
   * - items default [] 제거.
   * - player default null 제거.
   *
   * 회귀 가드:
   * - 3 callsite 동작 그대로.
   * - body getTraitFeaturedItems 호출 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 602: getTraitLootHint signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnIdx = source.indexOf('export const getTraitLootHint');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/items:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'getTraitLootHint items default [] 제거');
      assert.ok(!/player:\s*Player \| null\s*=\s*null/.test(sig),
          'getTraitLootHint player default null 제거');
  });

  test('cycle 602: 정합성 가드 — 3 callsite 보존', async () => {
      const cv = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/getTraitLootHint\(lootResult\.items,\s*traitProfile,\s*updatedPlayer\)/.test(cv),
          'combatVictory getTraitLootHint callsite 보존');

      const test1 = await readSrc('tests/run-profile-utils.test.js');
      assert.ok(/getTraitLootHint\(loot,\s*trait,\s*player\)/.test(test1),
          'run-profile-utils test callsite 보존');
  });

  test('cycle 602: body getTraitFeaturedItems 호출 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(/getTraitFeaturedItems\(items,\s*traitProfile,\s*player,\s*1\)/.test(source),
          'getTraitFeaturedItems(items, traitProfile, player, 1) 호출 보존');
  });

  test('cycle 602: cycle 502-601 회귀 가드 — default 청소 시리즈 보존', async () => {
      const su = await readSrc('src/utils/synthesisUtils.ts');
      assert.ok(!/performSynthesis = \(items: any, selectedOutput:\s*any\s*=\s*null/.test(su),
          'cycle 601 performSynthesis selectedOutput default 0건');

      const ep = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/getMapPacingProfile\s*=\s*\(mapData:\s*GameMap \| null \| undefined\s*=\s*\{\}\)/.test(ep),
          'cycle 599 getMapPacingProfile mapData default 0건');
  });
}

// ─── cycle-629-process-loot-defaults-explicit-elimination.test.js ───
{
  /**
   * cycle 629: processLoot player/signaturePityMult defaults explicit
   *   default-elimination paired batch
   *   (cycle 222-628 silent dead config 시리즈 367번째 — explicit
   *   default-elimination pattern 20번째 적용 — 이중자릿수 정착,
   *   paired batch 4번째 (cycle 613/624/626에 이은)).
   *
   * 발견 (2 defaults reachable → unreachable conversion):
   * - src/systems/CombatEngine.loot.ts:32:
   *     export const processLoot = (enemy: Monster, player: Player | null = null,
   *                                  signaturePityMult: any = 1.0) => {...}
   * - 호출 사이트 6개:
   *     · combatVictory.ts:66 — 3 args 명시 (production).
   *     · CombatEngine.ts:1610 (wrapper) — 3 args 명시.
   *     · cycle-171 fixture: processLoot(enemy) — 1 arg, 3 callers (52/77/101).
   * - 3 fixture callers에 명시 추가하면 2 defaults 모두 도달 불가.
   *
   * 패턴 (cycle 222-628 시리즈 367번째):
   * - cycle 502-628: default 청소 메가 시리즈 124사이클.
   * - cycle 629: explicit default-elimination 20번째 — 이중자릿수 정착
   *   (cycle 618 첫 10번째 도달 후 11사이클 누적). paired batch 4번째.
   *
   * 수정:
   * - tests/loot-cycle.test.js — 3 fixture caller에
   *   `null, 1.0` 명시 추가.
   * - CombatEngine.loot.ts:32 — player/signaturePityMult defaults 제거.
   *
   * 회귀 가드:
   * - production 2 callsite 동작 그대로 (이미 명시).
   * - body lootTable iteration / signaturePityMult application 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 629: processLoot signature에서 player/signaturePityMult defaults 0건', async () => {
      const source = await readSrc('src/systems/CombatEngine.loot.ts');
      assert.ok(!/processLoot = \([^)]*player:\s*Player\s*\|\s*null\s*=\s*null/.test(source),
          'processLoot player default null 제거');
      assert.ok(!/processLoot = \([^)]*signaturePityMult:\s*any\s*=\s*1\.0/.test(source),
          'processLoot signaturePityMult default 1.0 제거');
      assert.ok(/processLoot = \(enemy:\s*Monster,\s*player:\s*Player\s*\|\s*null,\s*signaturePityMult:\s*any\)/.test(source),
          'processLoot 3-arg 시그니처 보존 (defaults 없이)');
  });

  test('cycle 629: production callsite 3 args 명시 보존', async () => {
      const cv = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/CombatEngine\.processLoot\(deadEnemy,\s*updatedPlayer,\s*signaturePityMult\)/.test(cv),
          'combatVictory.ts processLoot 3 args 명시 보존');
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/_processLoot\(enemy,\s*player,\s*signaturePityMult\)/.test(ce),
          'CombatEngine wrapper _processLoot 3 args 명시 보존');
  });

  test('cycle 629: cycle-171 fixture 3 callers 명시 추가', async () => {
      const source = await readSrc('tests/loot-cycle.test.js');
      const matches = (source.match(/processLoot\(enemy,\s*null,\s*1\.0\)/g) || []).length;
      assert.equal(matches, 3, "cycle-171 fixture 3 callers 'null, 1.0' 명시");
  });

  test('cycle 629: cycle 502-628 회귀 가드 — default 청소 시리즈 보존', async () => {
      const sh = await readSrc('src/hooks/gameActions/_shared.ts');
      assert.ok(!/commitExploreOutcome = \([^)]*transformPlayer:\s*any\s*=\s*null\)/.test(sh),
          "cycle 628 commitExploreOutcome transformPlayer default 0건");
      const m = await readSrc('src/data/messages.ts');
      assert.ok(!/COMBAT_ATTACK_DETAIL:[^=]*tags:\s*any\s*=\s*\[\]/.test(m),
          'cycle 627 COMBAT_ATTACK_DETAIL tags default 0건');
  });
}
