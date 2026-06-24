import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * 상점(Shop) cycle 테스트 (audit #1 통합 7개)
 */

// ─── cycle-127-premium-shop-testids.test.js ───
{
  /**
   * cycle 127: PremiumShop testid 노출 — cycle 125-126 testid sweep 연장.
   *
   * PremiumShop은 에테르 크리스탈 상점 — 인벤 확장 / 합성 보호권 / 즉시 부활권 +
   * 코스메틱 칭호 구매 UI. 결제 액션 흐름이라 e2e 자동화 가치가 높지만 testid 0건.
   *
   * 추가 (cycle 18+ 명명 패턴 일관):
   * - data-testid="premium-shop" — 패널 루트.
   * - data-testid={`premium-buy-${item.id}`} — 유틸리티 구매 버튼.
   * - data-testid={`premium-title-buy-${title.id}`} — 코스메틱 칭호 구매 버튼.
   * - data-testid="premium-shop-close" — 닫기 버튼 (X icon).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('PremiumShop: premium-shop root testid 노출', async () => {
      const source = await readSrc('src/components/PremiumShop.tsx');
      assert.match(source, /data-testid\s*=\s*["']premium-shop["']/);
  });

  test('PremiumShop: premium-buy-{item.id} testid 노출', async () => {
      const source = await readSrc('src/components/PremiumShop.tsx');
      assert.match(source, /data-testid\s*=\s*\{`premium-buy-\$\{[^}]+\}`\}/);
  });

  test('PremiumShop: premium-title-buy-{title.id} testid 노출', async () => {
      const source = await readSrc('src/components/PremiumShop.tsx');
      assert.match(source, /data-testid\s*=\s*\{`premium-title-buy-\$\{[^}]+\}`\}/);
  });

  test('PremiumShop: premium-shop-close testid 노출', async () => {
      const source = await readSrc('src/components/PremiumShop.tsx');
      assert.match(source, /data-testid\s*=\s*["']premium-shop-close["']/);
  });
}

// ─── cycle-392-action-kind-open-shop-dead.test.js ───
{
  /**
   * cycle 392: ACTION_KIND_TO_BUTTON `open_shop` 매핑 dead 정리
   *   (cycle 222-391 silent dead config 시리즈 155번째 — cleanup lens 연속).
   *
   * 발견 (1 dead lookup entry):
   * - src/components/controlPanelConfig.ts ACTION_KIND_TO_BUTTON에 `open_shop: 'market'` 매핑.
   * - 유일한 producer는 adventureGuide.getAdventureGuidance — primaryAction.kind 후보:
   *   `claim_quest / open_class / rest / open_inventory / open_move / open_quest_board / explore`.
   * - `open_shop`은 src/, tests/ 어디에서도 producer 0건 — 룩업 절대 hit 안 됨.
   * - `recommendedButton = ACTION_KIND_TO_BUTTON[kind] || null` 패턴이라 unmatched는 fallback.
   *
   * 패턴 (cycle 222-391 silent dead config 시리즈 155번째):
   * - cycle 359: ELEMENT_FILTERS 3 unreachable aliases.
   * - cycle 361: JOB_AFFINITY_NAMES `'그림자주군'` unreachable duplicate key.
   * - cycle 392: ACTION_KIND_TO_BUTTON `open_shop` unreachable lookup entry
   *   (unreachable lens 회귀 — producer 0건이라 절대 lookup 안 됨).
   *
   * 수정 (src/components/controlPanelConfig.ts):
   * - `open_shop: 'market',` 라인 제거.
   *
   * 회귀 가드:
   * - 나머지 6 매핑 보존 (explore/open_move/rest/open_class/open_quest_board/claim_quest).
   * - ControlPanel recommendedButton lookup 동작 그대로 (fallback chain 그대로).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 392: ACTION_KIND_TO_BUTTON에서 open_shop 매핑 0건', async () => {
      const source = await readSrc('src/components/controlPanelConfig.ts');
      assert.ok(!/open_shop:/.test(source),
          'ACTION_KIND_TO_BUTTON에서 open_shop 매핑 제거됨');
  });

  test('cycle 392: open_shop kind producer 0건 (회귀 가드 — 정합성 검증)', async () => {
      const adventureGuide = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(!/kind:\s*'open_shop'/.test(adventureGuide),
          'adventureGuide에서 open_shop kind producer 0건 (이전 상태 유지)');
  });

  test('cycle 392: 나머지 매핑 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/controlPanelConfig.ts');
      const preservedKeys = ['explore', 'open_move', 'rest', 'open_class', 'open_quest_board', 'claim_quest'];
      preservedKeys.forEach((key) => {
          const re = new RegExp(`${key}:`);
          assert.ok(re.test(source), `${key} 매핑 보존`);
      });
  });

  test('cycle 392: ACTION_KIND_TO_BUTTON 동작 보존 (lookup 검증)', async () => {
      const { ACTION_KIND_TO_BUTTON } = await import('../src/components/controlPanelConfig.js');
      assert.equal(ACTION_KIND_TO_BUTTON.explore, 'explore', 'explore 매핑');
      assert.equal(ACTION_KIND_TO_BUTTON.rest, 'rest', 'rest 매핑');
      assert.equal(ACTION_KIND_TO_BUTTON.open_move, 'move', 'open_move 매핑');
      assert.equal(ACTION_KIND_TO_BUTTON.claim_quest, 'quests', 'claim_quest 매핑');
      assert.equal(ACTION_KIND_TO_BUTTON.open_shop, undefined, 'open_shop 제거됨');
  });

  test('cycle 391 회귀 가드: DEFAULT_COMBAT_FLAGS private 유지', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      assert.ok(!/export const DEFAULT_COMBAT_FLAGS\b/.test(source),
          'cycle 391 DEFAULT_COMBAT_FLAGS private 유지');
  });
}

// ─── cycle-393-premium-shop-category-repeatable-dead.test.js ───
{
  /**
   * cycle 393: PREMIUM_SHOP entry category/repeatable 출력 dead 정리
   *   (cycle 222-392 silent dead config 시리즈 156번째 — cleanup lens 연속).
   *
   * 발견 (10 dead 필드):
   * - src/data/premiumShop.ts PREMIUM_SHOP 정의:
   *   · invExpand / synthProtect / revive 3 entry — `category: 'utility'` / `repeatable: true`.
   *   · cosmeticTitles 4 entry — `category: 'cosmetic'`.
   * - 유일 consumer (src/components/PremiumShop.tsx)는 entry spread 후 id/name/desc/cost/onBuy/detail
   *   만 read. utilItem.category / .repeatable 분기 0건, title.category 분기 0건.
   * - src/, tests/ 어디에서도 .category / .repeatable read 0건.
   *
   * 패턴 (cycle 222-392 silent dead config 시리즈 156번째):
   * - cycle 354/355/356: 함수 출력 dead 필드 정리.
   * - cycle 367/368: 데이터 redundant default annotation 정리.
   * - cycle 393: PREMIUM_SHOP entry 출력 dead 일괄 정리 (function-output-dead lens 변형 —
   *   data-config-dead, 연속 7 entry × 2 fields + 4 entry × 1 field).
   *
   * 수정 (src/data/premiumShop.ts):
   * - invExpand / synthProtect / revive 3 entry에서 `category` + `repeatable` 6 lines 제거.
   * - cosmeticTitles 4 entry에서 `category` 4 fields 제거.
   *
   * 회귀 가드:
   * - PREMIUM_SHOP / 4 entry 객체 보존.
   * - id / name / desc / cost / cosmeticTitles 배열 보존.
   * - PremiumShop 컴포넌트 spread 동작 그대로 (사용 필드 모두 보존).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 393: PREMIUM_SHOP entry에서 category 0건', async () => {
      const source = await readSrc('src/data/premiumShop.ts');
      assert.ok(!/category:\s*'utility'/.test(source),
          'utility category 0건');
      assert.ok(!/category:\s*'cosmetic'/.test(source),
          'cosmetic category 0건');
  });

  test('cycle 393: PREMIUM_SHOP entry에서 repeatable 0건', async () => {
      const source = await readSrc('src/data/premiumShop.ts');
      assert.ok(!/repeatable:\s*true/.test(source),
          'repeatable 0건');
  });

  test('cycle 393: PREMIUM_SHOP 동작 보존 (사용 필드)', async () => {
      const { PREMIUM_SHOP } = await import('../src/data/premiumShop.js');
      assert.equal(PREMIUM_SHOP.invExpand.id, 'inv_expand', 'invExpand.id 유지');
      assert.equal(PREMIUM_SHOP.invExpand.name, '인벤토리 확장', 'invExpand.name 유지');
      assert.ok(typeof PREMIUM_SHOP.invExpand.cost === 'number', 'invExpand.cost 유지');
      assert.equal(PREMIUM_SHOP.synthProtect.id, 'synth_protect', 'synthProtect.id 유지');
      assert.equal(PREMIUM_SHOP.revive.id, 'revive', 'revive.id 유지');
      assert.equal(PREMIUM_SHOP.invExpand.category, undefined, 'invExpand.category 제거');
      assert.equal(PREMIUM_SHOP.invExpand.repeatable, undefined, 'invExpand.repeatable 제거');
  });

  test('cycle 393: cosmeticTitles 동작 보존', async () => {
      const { PREMIUM_SHOP } = await import('../src/data/premiumShop.js');
      assert.ok(Array.isArray(PREMIUM_SHOP.cosmeticTitles), 'cosmeticTitles 배열 유지');
      assert.equal(PREMIUM_SHOP.cosmeticTitles.length, 4, '4 cosmetic titles 유지');
      for (const title of PREMIUM_SHOP.cosmeticTitles) {
          assert.ok(typeof title.id === 'string', 'title.id 유지');
          assert.ok(typeof title.name === 'string', 'title.name 유지');
          assert.ok(typeof title.cost === 'number', 'title.cost 유지');
          assert.equal(title.category, undefined, 'title.category 제거');
      }
  });

  test('cycle 392 회귀 가드: ACTION_KIND_TO_BUTTON open_shop 0건', async () => {
      const source = await readSrc('src/components/controlPanelConfig.ts');
      assert.ok(!/open_shop:/.test(source),
          'cycle 392 open_shop 매핑 0건 보존');
  });
}

// ─── cycle-488-shop-panel-mobile-focused-cascade.test.js ───
{
  /**
   * cycle 488: ShopPanel `mobileFocused` cascade unreachable 정리
   *   (cycle 222-487 silent dead config 시리즈 240번째 — unreachable code path
   *   cascade cleanup, cycle 486-487 paired completion, ShopPanel 차례).
   *
   * 발견 (1 prop + 1 ternary 가지 unreachable + 1 dead helper):
   * - src/components/ShopPanel.tsx:
   *     · interface mobileFocused?: boolean.
   *     · destructure mobileFocused = false.
   *     · const getOverlayPanelClass helper (mobileFocused 비-truthy 가지 전용).
   *     · line 168: `mobileFocused ? <mobile-class> : <overlay-class>` —
   *       overlay-class branch unreachable.
   * - 호출 사이트:
   *     · ControlPanel.tsx:196 — mobileFocused={mobileFocused} 전달.
   *     · ControlPanel은 cycle 486 분석에서 mobileFocused 항상 truthy → forward도 truthy.
   *     · 다른 파일 import 0건.
   * - 결과: mobileFocused 항상 true → ternary 첫 가지만 진입 → getOverlayPanelClass
   *   dead.
   *
   * 패턴 (cycle 222-487 시리즈 240번째):
   * - cycle 486: ControlPanel mobileFocused cascade.
   * - cycle 487: QuestBoardPanel paired.
   * - cycle 488: ShopPanel paired (subchild cascade 3번째).
   *
   * 수정 (src/components/ShopPanel.tsx):
   * - interface mobileFocused?: boolean 제거.
   * - destructure mobileFocused = false 제거.
   * - getOverlayPanelClass helper 제거 (cascade dead).
   * - line 168 ternary → mobile-class 가지만 inline.
   *
   * 호출 사이트 (ControlPanel.tsx:196):
   * - mobileFocused 전달 자체 제거.
   *
   * 회귀 가드:
   * - player / actions / shopItems / setGameState / stats / onOpenArchiveConsole prop 보존.
   * - 본체 shop 로직 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 488: ShopPanel destructure에서 mobileFocused 0건', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      const fnIdx = source.indexOf('const ShopPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/mobileFocused/.test(sig), 'destructure에 mobileFocused 0건');
  });

  test('cycle 488: interface에서 mobileFocused 0건', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      const ifaceIdx = source.indexOf('interface ShopPanelProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/mobileFocused/.test(block), 'interface에 mobileFocused 0건');
  });

  test('cycle 488: getOverlayPanelClass / mobileFocused 본체 참조 0건', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/getOverlayPanelClass/.test(source), 'getOverlayPanelClass 0건');
      assert.ok(!/mobileFocused/.test(source), '본체 mobileFocused 참조 0건');
  });

  test('cycle 488: 정합성 가드 — ControlPanel <ShopPanel> mobileFocused 전달 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const idx = source.indexOf('<ShopPanel');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/mobileFocused/.test(jsx), 'ControlPanel <ShopPanel> mobileFocused 전달 0건');
  });

  test('cycle 488: 핵심 props 보존', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      const fnIdx = source.indexOf('const ShopPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
      assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
      assert.ok(/shopItems/.test(sig), 'shopItems prop 보존');
      assert.ok(/setGameState/.test(sig), 'setGameState prop 보존');
      assert.ok(/onOpenArchiveConsole/.test(sig), 'onOpenArchiveConsole prop 보존');
  });
}

// ─── cycle-524-shop-rotation-defaults-batch-unreachable.test.js ───
{
  /**
   * cycle 524: shopRotation 3 defaults batch unreachable
   *   (cycle 222-523 silent dead config 시리즈 268번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 21번째).
   *
   * 발견 (3 defaults batch, shopRotation.ts 같은 모듈):
   * - src/utils/shopRotation.ts:
   *     · line 11: const dateHash = (dateStr, salt: any = 0) => {...}
   *     · line 61: export const getDailyDeals = (playerLevel: any = 1) => {...}
   *     · line 92: export const getWeeklySpecial = (playerLevel: any = 1) => {...}
   * - 호출 사이트:
   *     · dateHash:2 callsite (line 63: dateHash(today, 42), line 94:
   *       dateHash(weekKey, 777)) — 모두 salt 명시.
   *     · getDailyDeals:1 callsite (ShopPanel.tsx:161 getDailyDeals(player.level
   *       || 1)) — playerLevel 명시 + || 1 number 보장.
   *     · getWeeklySpecial:1 callsite (ShopPanel.tsx:162 getWeeklySpecial
   *       (player.level || 1)) — 동일.
   * - 결과: 3 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-523 시리즈 268번째):
   * - cycle 502-523: util default 청소 메가 시리즈 20사이클.
   * - cycle 524: shopRotation 3 defaults — 동일 lens. cycle 504/507/521에 이은
   *   single-cycle 3-default batch.
   *
   * 수정 (src/utils/shopRotation.ts):
   * - dateHash signature: salt: any = 0 → salt: any.
   * - getDailyDeals signature: playerLevel: any = 1 → playerLevel: any.
   * - getWeeklySpecial signature: playerLevel: any = 1 → playerLevel: any.
   * - body의 hash 계산 / playerLevel 비교 분기 모두 보존.
   *
   * 회귀 가드:
   * - 4 callsite (2 internal dateHash + 2 ShopPanel) 동작 그대로.
   * - body Math.abs / playerLevel < N ternary 분기 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 524: dateHash signature에서 salt default 0건', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      const fnIdx = source.indexOf('const dateHash');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/salt:\s*any\s*=\s*0/.test(sig), 'dateHash salt default 0 제거');
      assert.ok(/\bsalt\b/.test(sig), 'salt 파라미터 자체는 보존');
  });

  test('cycle 524: getDailyDeals + getWeeklySpecial signature에서 playerLevel default 0건', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      const dailyIdx = source.indexOf('export const getDailyDeals');
      const dailyEnd = source.indexOf('=>', dailyIdx);
      const dailySig = source.slice(dailyIdx, dailyEnd);
      assert.ok(!/playerLevel:\s*any\s*=\s*1/.test(dailySig),
          'getDailyDeals playerLevel default 1 제거');

      const weeklyIdx = source.indexOf('export const getWeeklySpecial');
      const weeklyEnd = source.indexOf('=>', weeklyIdx);
      const weeklySig = source.slice(weeklyIdx, weeklyEnd);
      assert.ok(!/playerLevel:\s*any\s*=\s*1/.test(weeklySig),
          'getWeeklySpecial playerLevel default 1 제거');
  });

  test('cycle 524: 정합성 가드 — 4 callsite 보존', async () => {
      const shop = await readSrc('src/utils/shopRotation.ts');
      assert.ok(/dateHash\(today,\s*42\)/.test(shop), 'dateHash(today, 42) 보존');
      assert.ok(/dateHash\(weekKey,\s*777\)/.test(shop), 'dateHash(weekKey, 777) 보존');

      const panel = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(/getDailyDeals\(player\.level \|\| 1\)/.test(panel),
          'getDailyDeals(player.level || 1) callsite 보존');
      assert.ok(/getWeeklySpecial\(player\.level \|\| 1\)/.test(panel),
          'getWeeklySpecial(player.level || 1) callsite 보존');
  });

  test('cycle 524: body 분기 보존', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      assert.ok(/playerLevel < 10 \? 2 : playerLevel < 20 \? 3/.test(source),
          'getDailyDeals tier ternary 보존');
      assert.ok(/playerLevel < 15 \? 3 : playerLevel < 30 \? 4/.test(source),
          'getWeeklySpecial tier ternary 보존');
      assert.ok(/return Math\.abs\(hash\)/.test(source), 'dateHash Math.abs(hash) 보존');
  });

  test('cycle 524: cycle 502-523 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const qo = await readSrc('src/utils/questOperations.ts');
      assert.ok(!/getQuestLevelGap[^=]*playerLevel:\s*any\s*=\s*1/.test(qo),
          'cycle 523 getQuestLevelGap playerLevel default 0건');

      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/const toInt[^=]*fallback:\s*any\s*=\s*0/.test(aiu),
          'cycle 522 toInt fallback default 0건');
  });
}

// ─── cycle-531-shop-panel-helpers-defaults-batch.test.js ───
{
  /**
   * cycle 531: ShopPanel 3 helpers defaults batch unreachable
   *   (cycle 222-530 silent dead config 시리즈 274번째 — redundant default annotation
   *   util/component default 청소 메가 시리즈 27번째). component-level 확장 2번째
   *   (cycle 529에 이은).
   *
   * 발견 (3 defaults batch, ShopPanel.tsx 같은 모듈 private helpers):
   * - src/components/ShopPanel.tsx:
   *     · line 38: const formatPercent = (value: any = 0) => ...
   *     · line 46: const getComparisonMeta = (item, equip: any = {}) => {...}
   *     · line 87: const getCompactText = (value: any = '') => value.replaceAll(...)
   * - 호출 사이트 (모듈 내부 private):
   *     · formatPercent:1 callsite (line 60 formatPercent(critDelta)) — value
   *       명시 (Math.round 결과).
   *     · getComparisonMeta:2 callsite (line 295/370 getComparisonMeta(item,
   *       player.equip)) — equip 명시.
   *     · getCompactText:3 callsite (line 90/94/372) — value 명시 (string ||
   *       fallback으로 string 보장).
   *     · 다른 파일 import 0건 (private 모듈 helpers).
   * - 결과: 3 default 모두 도달 불가.
   *
   * Note: signedDelta는 4 callsite 모두 1 arg만 전달이라 suffix default ''가
   * REACHABLE → cycle 531 cleanup 대상 외(부분적 unreachable이라 관성 보존).
   *
   * 패턴 (cycle 222-530 시리즈 274번째):
   * - cycle 502-530: util default 청소 메가 시리즈 28사이클.
   * - cycle 531: components/ private helper 2번째 (cycle 529 softenColor에 이은).
   *
   * 수정 (src/components/ShopPanel.tsx):
   * - formatPercent signature: value: any = 0 → value: any.
   * - getComparisonMeta signature: equip: any = {} → equip: any.
   * - getCompactText signature: value: any = '' → value: any.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 6 internal callsite 동작 그대로.
   * - body template literal / replaceAll / getEquipmentProfile 호출 보존.
   * - signedDelta suffix default '' 보존 (cleanup 대상 외).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 531: formatPercent signature에서 value default 0건', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      const fnIdx = source.indexOf('const formatPercent');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/value:\s*any\s*=\s*0/.test(sig),
          'formatPercent value default 0 제거');
  });

  test('cycle 531: getComparisonMeta signature에서 equip default 0건', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      const fnIdx = source.indexOf('const getComparisonMeta');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/equip:\s*any\s*=\s*\{\}/.test(sig),
          'getComparisonMeta equip default {} 제거');
  });

  test('cycle 531: getCompactText signature에서 value default 0건', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      const fnIdx = source.indexOf('const getCompactText');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/value:\s*any\s*=\s*''/.test(sig),
          "getCompactText value default '' 제거");
  });

  test('cycle 531: 정합성 가드 — 6 internal callsite 보존', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(/formatPercent\(critDelta\)/.test(source),
          'formatPercent(critDelta) callsite 보존');
      const cmpCalls = (source.match(/getComparisonMeta\(item,\s*player\.equip\)/g) || []).length;
      assert.equal(cmpCalls, 2, `getComparisonMeta 2 callsite 보존: ${cmpCalls}건`);
      const cctCalls = (source.match(/getCompactText\(/g) || []).length;
      assert.ok(cctCalls >= 3, `getCompactText callsite 3건 이상 보존: ${cctCalls}건`);
  });

  test('cycle 531: signedDelta suffix 파라미터 보존 (cycle 621 explicit elimination)', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(/const signedDelta = \(value: any, suffix: any\)/.test(source),
          'signedDelta suffix 파라미터 보존 (cycle 621에서 default 제거됨)');
  });

  test('cycle 531: cycle 502-529 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const av = await readSrc('src/components/PixelCharacterAvatar.tsx');
      assert.ok(!/const softenColor[^=]*alpha:\s*any\s*=\s*0\.24/.test(av),
          'cycle 529 softenColor alpha default 0건');

      const eu = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/const pickBestOneHandPair[^=]*weapons:\s*any\[\]\s*=\s*\[\]/.test(eu),
          'cycle 528 pickBestOneHandPair weapons default 0건');
  });
}

// ─── cycle-573-shop-panel-defaults-batch.test.js ───
{
  /**
   * cycle 573: ShopPanel `stats = null` + `onOpenArchiveConsole = null` defaults
   *   batch unreachable (cycle 222-572 silent dead config 시리즈 312번째 —
   *   redundant default annotation 청소 메가 시리즈 65번째).
   *
   * 발견 (2 defaults batch):
   * - src/components/ShopPanel.tsx (line 113):
   *     const ShopPanel = ({ player, actions, shopItems, setGameState,
   *         stats = null, onOpenArchiveConsole = null }: ShopPanelProps) => {...};
   * - 호출 사이트 (1 caller):
   *     · ControlPanel.tsx:147 — <ShopPanel player actions shopItems setGameState
   *       stats onOpenArchiveConsole /> — 6 props 모두 명시 전달.
   *     · 다른 caller 0건.
   * - 결과: stats / onOpenArchiveConsole 항상 명시 전달. 두 default 모두 도달
   *   불가.
   *
   * 패턴 (cycle 222-572 시리즈 312번째):
   * - cycle 502-572: default 청소 메가 시리즈 71사이클.
   * - cycle 573: components/ entry-level cleanup — cycle 572 Dashboard에 이은
   *   대형 컴포넌트 default cleanup.
   *
   * 수정 (src/components/ShopPanel.tsx):
   * - signature에서 stats = null → stats.
   * - signature에서 onOpenArchiveConsole = null → onOpenArchiveConsole.
   * - body의 stats / onOpenArchiveConsole 사용처 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (ControlPanel) 동작 그대로.
   * - body 동작 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 573: ShopPanel signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      const fnIdx = source.indexOf('const ShopPanel = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/stats\s*=\s*null/.test(sig),
          'ShopPanel stats default null 제거');
      assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(sig),
          'ShopPanel onOpenArchiveConsole default null 제거');
  });

  test('cycle 573: 정합성 가드 — ControlPanel callsite 보존', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(/<ShopPanel player=\{player\} actions=\{actions\} shopItems=\{shopItems\} setGameState=\{setGameState\} stats=\{stats\} onOpenArchiveConsole=\{onOpenArchiveConsole\}/.test(source),
          'ControlPanel <ShopPanel> 6-prop callsite 보존');
  });

  test('cycle 573: cycle 502-572 회귀 가드 — default 청소 시리즈 보존', async () => {
      const dash = await readSrc('src/components/Dashboard.tsx');
      assert.ok(!/mobileSection\s*=\s*'full'/.test(dash),
          'cycle 572 Dashboard mobileSection default 0건');

      const mi = await readSrc('src/components/icons/MonsterIcon.tsx');
      assert.ok(!/const MonsterIcon = \({ name, discovered\s*=\s*false/.test(mi),
          'cycle 571 MonsterIcon discovered default 0건');
  });
}
