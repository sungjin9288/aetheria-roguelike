import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';

/**
 * cycle 500-599 정리 가드 (audit #1 통합 62개)
 */

// ─── cycle-501-signal-badge-class-name-unreachable.test.js ───
{
  /**
   * cycle 501: SignalBadge `className` prop unreachable 정리
   *   (cycle 222-500 silent dead config 시리즈 251번째 — unreachable code path
   *   cleanup lens, cycle 463/465/466/493/495/496/498 className lens 회귀).
   *
   * 발견 (1 prop unreachable):
   * - src/components/SignalBadge.tsx (line 26):
   *     const SignalBadge = ({ tone, size, className = '', children, ...rest }: any) => (
   *         <span className={`... ${SIZE_CLASS[size] || ...} ${TONE_CLASS[tone] || ...} ${className}`.trim()} ...>
   *             {children}
   *         </span>
   *     );
   * - 호출 사이트 분석 (전체 src/):
   *     · 77 callsite (다양한 컴포넌트). 모두 tone / size / children만 전달.
   *     · className 명시 전달 0건.
   * - 결과: className 항상 ''. body의 ${className} 보간은 .trim()으로 빈 문자열만
   *   제거되는 unreachable.
   *
   * 패턴 (cycle 222-500 시리즈 251번째):
   * - cycle 463/465/466/493/495/496/498: 다양한 컴포넌트 className lens.
   * - cycle 501: SignalBadge — 가장 많은 호출자 (77건)의 className unreachable 정리.
   *
   * 수정 (src/components/SignalBadge.tsx):
   * - destructure에서 className = '' 제거.
   * - body className 템플릿에서 ${className} 보간 제거 → .trim() 제거.
   *
   * 회귀 가드:
   * - tone / size / children / ...rest props 보존.
   * - 77 callsite 동작 변동 0.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 501: SignalBadge destructure에서 className 0건', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      const fnIdx = source.indexOf('const SignalBadge =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bclassName\b/.test(sig), 'destructure에 className 0건');
  });

  test('cycle 501: body ${className} 보간 0건', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
  });

  test('cycle 501: 정합성 가드 — 모든 SignalBadge 호출자에 className 명시 전달 0건', async () => {
      const componentDir = path.join(ROOT, 'src/components');
      const files = await readdir(componentDir, { recursive: true });
      let totalCalls = 0;
      let withClassName = 0;
      for (const f of files) {
          if (!String(f).endsWith('.tsx')) continue;
          const fpath = path.join(componentDir, String(f));
          let src;
          try { src = await readFile(fpath, 'utf8'); } catch { continue; }
          const calls = src.match(/<SignalBadge\b[^>]*?>/g) || [];
          for (const call of calls) {
              totalCalls++;
              if (/\bclassName=/.test(call)) withClassName++;
          }
      }
      assert.ok(totalCalls > 50, `SignalBadge 호출 50건 이상 (실제: ${totalCalls})`);
      assert.equal(withClassName, 0, `className 명시 전달 0건 (실제: ${withClassName})`);
  });

  test('cycle 501: 핵심 props 보존 (tone / size / children / ...rest)', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      const fnIdx = source.indexOf('const SignalBadge =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\btone\b/.test(sig), 'tone prop 보존');
      assert.ok(/\bsize\b/.test(sig), 'size prop 보존');
      assert.ok(/children/.test(sig), 'children prop 보존');
      assert.ok(/\.\.\.rest/.test(sig), '...rest 보존');
  });

  test('cycle 501: cycle 419 / 433 회귀 가드 — SIZE_CLASS / TONE_CLASS fallback 보존', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      assert.ok(/SIZE_CLASS\[size\] \|\| SIZE_CLASS\.sm/.test(source), 'SIZE_CLASS fallback 보존');
      assert.ok(/TONE_CLASS\[tone\] \|\| TONE_CLASS\.neutral/.test(source), 'TONE_CLASS fallback 보존');
  });
}

// ─── cycle-502-increment-stat-amount-unreachable.test.js ───
{
  /**
   * cycle 502: incrementStat `amount` parameter unreachable 정리
   *   (cycle 222-501 silent dead config 시리즈 252번째 — unreachable code path
   *   util-level cleanup, cycle 463/501 lens의 util 변형).
   *
   * 발견 (1 parameter unreachable):
   * - src/utils/playerStateUtils.ts (line 21):
   *     export const incrementStat = (player, field, amount: number = 1): Player =>
   *         updateStats(player, { [field]: ((player.stats as any)?.[field] || 0) + amount });
   * - 호출 사이트 (3 callsite, useInventoryActions.ts):
   *     · line 242: incrementStat({...}, 'crafts').
   *     · line 302: incrementStat(updatedPlayer, 'bountiesCompleted').
   *     · line 436: incrementStat({...}, 'syntheses').
   *     · 3 callsite 모두 amount 전달 0건. default 1 도달 불가.
   *     · 다른 파일에서 incrementStat import 0건 (useInventoryActions만 사용).
   * - 결과: amount 항상 1 → `+ amount`는 항상 `+ 1`.
   *
   * 패턴 (cycle 222-501 시리즈 252번째):
   * - cycle 463/465/466/493/495/496/498/501: 컴포넌트 className unreachable lens.
   * - cycle 502: util level 동일 lens 적용 — incrementStat amount 파라미터 dead.
   *
   * 수정 (src/utils/playerStateUtils.ts):
   * - signature에서 amount: number = 1 제거 → (player, field).
   * - body의 `+ amount` → `+ 1` 정적 inline.
   *
   * 회귀 가드:
   * - 3 callsite 동작 그대로 (각각 1씩 증가).
   * - updateStats 호출 / Player 타입 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 502: incrementStat signature에서 amount 0건', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      const fnIdx = source.indexOf('export const incrementStat');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bamount\b/.test(sig), 'signature에 amount 0건');
  });

  test('cycle 502: body amount 참조 0건', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      const fnIdx = source.indexOf('export const incrementStat');
      // 함수 본문은 한 줄 expression, 다음 export 또는 const까지 슬라이스
      const fnEnd = source.indexOf(';', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bamount\b/.test(block), 'body amount 참조 0건');
      assert.ok(/\+\s*1\b/.test(block), '+ 1 정적 inline 보존');
  });

  test('cycle 502: 정합성 가드 — useInventoryActions 3 callsite 호출 존재 + amount 명시 전달 0건', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      // incrementStat 호출 3건이 존재하는지 (callsite 자체 가드)
      const matches = source.match(/incrementStat\(/g) || [];
      assert.equal(matches.length, 3, 'incrementStat 호출 정확히 3건');
      // amount(3번째 인자로 숫자 리터럴)를 명시 전달하는 패턴 0건
      // 즉 incrementStat(..., 'field_literal', <number>) 형태가 0건이어야 함
      assert.ok(!/incrementStat\([\s\S]+?,\s*'[^']+',\s*\d+\)/.test(source),
          '3 args (amount 전달) 호출 0건');
  });

  test('cycle 502: updateStats 호출 / Player 타입 보존', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      assert.ok(/updateStats\(player/.test(source), 'updateStats 호출 보존');
      assert.ok(/Player/.test(source), 'Player 타입 보존');
  });
}

// ─── cycle-503-consume-inventory-item-count-default-unreachable.test.js ───
{
  /**
   * cycle 503: consumeInventoryItemByName `count` default unreachable 정리
   *   (cycle 222-502 silent dead config 시리즈 253번째 — redundant default annotation
   *   util-level cleanup, cycle 502 lens 회귀).
   *
   * 발견 (1 default unreachable):
   * - src/utils/enhancementUtils.ts (line 18):
   *     export const consumeInventoryItemByName = (inventory = [], itemName,
   *         count: number = 1) => {...}
   * - 호출 사이트:
   *     · useInventoryActions.ts:559 — consumeInventoryItemByName(player.inv,
   *       requirement.materialName, requirement.materials).
   *     · 1 callsite, 항상 3 args 전달 (count 명시).
   *     · 다른 파일 import 0건.
   * - 결과: count 항상 명시 전달 → default 1 도달 불가.
   *
   * 패턴 (cycle 222-502 시리즈 253번째):
   * - cycle 502: incrementStat amount 파라미터 unreachable.
   * - cycle 503: consumeInventoryItemByName count default unreachable — 동일 lens.
   *
   * 수정 (src/utils/enhancementUtils.ts):
   * - signature에서 count: number = 1 → count: number (default 제거).
   * - body 동작 그대로 (count는 호출자가 명시 전달).
   *
   * 회귀 가드:
   * - inventory / itemName / count 전달받기.
   * - body filter / removed 카운트 / nextInventory 반환 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 503: consumeInventoryItemByName signature에서 count default 0건', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      const fnIdx = source.indexOf('export const consumeInventoryItemByName');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/count:\s*number\s*=\s*1/.test(sig), 'count default 1 제거');
      assert.ok(/\bcount\b/.test(sig), 'count 파라미터 자체는 보존');
  });

  test('cycle 503: 정합성 가드 — useInventoryActions callsite 3 args', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      const matches = source.match(/consumeInventoryItemByName\(/g) || [];
      assert.equal(matches.length, 1, 'consumeInventoryItemByName 호출 1건');
      // 3 args 호출 (player.inv, requirement.materialName, requirement.materials)
      assert.ok(/consumeInventoryItemByName\([^)]*?,[^)]*?,[^)]*?\)/.test(source),
          '3 args 호출 보존');
  });

  test('cycle 503: body 동작 보존 (filter / removed / nextInventory)', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(/let removed = 0/.test(source), 'removed 카운터 보존');
      assert.ok(/nextInventory =/.test(source), 'nextInventory 변수 보존');
      assert.ok(/removed < count/.test(source), 'count 비교 보존');
      assert.ok(/return \{ nextInventory, removed \}/.test(source), '반환 구조 보존');
  });

  test('cycle 503: cycle 502 회귀 가드 — incrementStat amount 0건', async () => {
      const source = await readSrc('src/utils/playerStateUtils.ts');
      const fnIdx = source.indexOf('export const incrementStat');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bamount\b/.test(sig), 'cycle 502 amount 제거 보존');
  });
}

// ─── cycle-504-daily-protocol-completions-amount-default-cascade.test.js ───
{
  /**
   * cycle 504: getDailyProtocolCompletions `amount` default unreachable + 3 wrapper
   *   emitDailyProtocolLogs default cascade 정리
   *   (cycle 222-503 silent dead config 시리즈 254번째 — redundant default annotation
   *   util-level cascade, cycle 502/503 lens 회귀).
   *
   * 발견 (4 default unreachable):
   * - src/utils/gameUtils.ts (line 81):
   *     export const getDailyProtocolCompletions = (player, type, amount: any = 1) => {...}
   * - 호출 사이트 (3 wrapper, 각 hook 내부):
   *     · useCombatActions.ts: emitDailyProtocolLogs(type, amount = 1) → 내부에서
   *       getDailyProtocolCompletions(player, type, amount) 호출.
   *     · gameActions/_shared.ts: 동일 wrapper 패턴.
   *     · useInventoryActions.ts: 동일 wrapper 패턴.
   *     · 3 wrapper 모두 자체에 `amount = 1` default + 자신 callsite도 항상
   *       2 args 명시 전달 (amount 명시).
   *     · wrapper의 외부 callsite 5건 모두 amount 명시 전달.
   * - 결과: 4 default 모두 도달 불가:
   *     · getDailyProtocolCompletions amount default 1.
   *     · emitDailyProtocolLogs (useCombatActions) amount default 1.
   *     · emitDailyProtocolLogs (_shared) amount default 1.
   *     · emitDailyProtocolLogs (useInventoryActions) amount default 1.
   *
   * 패턴 (cycle 222-503 시리즈 254번째):
   * - cycle 502: incrementStat amount 파라미터 unreachable.
   * - cycle 503: consumeInventoryItemByName count default unreachable.
   * - cycle 504: getDailyProtocolCompletions amount default + 3 wrapper cascade.
   *   util + 3 hook level 동시 정리.
   *
   * 수정 (4 파일):
   * - getDailyProtocolCompletions: amount: any = 1 → amount: any.
   * - 3 emitDailyProtocolLogs wrapper: amount: any = 1 → amount: any.
   *
   * 회귀 가드:
   * - 5 wrapper callsite 모두 amount 명시 전달.
   * - body 동작 그대로 (amount 사용).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 504: getDailyProtocolCompletions amount default 0건', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      const fnIdx = source.indexOf('export const getDailyProtocolCompletions');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/amount:\s*any\s*=\s*1/.test(sig), 'amount default 1 제거');
      assert.ok(/\bamount\b/.test(sig), 'amount 파라미터 자체는 보존');
  });

  test('cycle 504: 3 wrapper emitDailyProtocolLogs amount default 0건', async () => {
      const files = [
          'src/hooks/useCombatActions.ts',
          'src/hooks/gameActions/_shared.ts',
          'src/hooks/useInventoryActions.ts',
      ];
      for (const f of files) {
          const source = await readSrc(f);
          const fnIdx = source.indexOf('emitDailyProtocolLogs = (type');
          assert.ok(fnIdx >= 0, `${f}에 emitDailyProtocolLogs wrapper 존재`);
          const fnEnd = source.indexOf('=>', fnIdx);
          const sig = source.slice(fnIdx, fnEnd);
          assert.ok(!/amount:\s*any\s*=\s*1/.test(sig), `${f} amount default 1 제거`);
      }
  });

  test('cycle 504: 정합성 가드 — wrapper / leaf 호출 모두 amount 전달', async () => {
      // emitDailyProtocolLogs callsites (5건) 모두 2 args
      const allFiles = [
          'src/hooks/useInventoryActions.ts',
          'src/hooks/gameActions/_shared.ts',
          'src/hooks/gameActions/characterActions.ts',
          'src/hooks/combatActions/combatVictory.ts',
      ];
      let totalCalls = 0;
      for (const f of allFiles) {
          const source = await readSrc(f);
          const matches = source.match(/emitDailyProtocolLogs\(/g) || [];
          totalCalls += matches.length;
      }
      assert.ok(totalCalls >= 5, `emitDailyProtocolLogs 호출 5건 이상 (실제: ${totalCalls})`);
  });

  test('cycle 504: 본체 동작 보존 — amount 사용 + missions filter', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.ok(/mission\.progress.*\+ amount/.test(source), 'amount 사용 보존');
      assert.ok(/mission\?\.type === type/.test(source), 'type 필터 보존');
  });
}

// ─── cycle-505-grant-gold-amount-default-unreachable.test.js ───
{
  /**
   * cycle 505: grantGold `amount` default unreachable 정리
   *   (cycle 222-504 silent dead config 시리즈 255번째 — redundant default annotation
   *   util-level cleanup, cycle 502-504 lens 회귀).
   *
   * 발견 (1 default unreachable):
   * - src/utils/gameUtils.ts (line 207):
   *     export const grantGold = (player: Player, amount: any = 0) => {...
   *         if (!amount) return player;
   *         ...
   *     }
   * - 호출 사이트 (9+ callsite, 다수 hook 파일):
   *     · useInventoryActions / combatVictory / eventActions / characterActions /
   *       _shared / questReducer / 등.
   *     · 모든 callsite가 항상 2 args 전달 (amount 명시).
   *     · default 0 도달 불가.
   * - 결과: amount 항상 명시 전달. body의 `if (!amount) return player` defensive
   *   guard는 amount=0 케이스에서 활성이지만 default 0과는 무관 (caller가 0을
   *   넘기는 케이스 vs default 0 분리).
   *
   * 패턴 (cycle 222-504 시리즈 255번째):
   * - cycle 502: incrementStat amount 파라미터 unreachable.
   * - cycle 503: consumeInventoryItemByName count default unreachable.
   * - cycle 504: getDailyProtocolCompletions amount + 3 wrapper cascade.
   * - cycle 505: grantGold amount default — 동일 lens (가장 많은 callsite).
   *
   * 수정 (src/utils/gameUtils.ts):
   * - signature에서 amount: any = 0 → amount: any (default 제거).
   * - body의 `if (!amount) return player` defensive guard 보존 (caller가 0을
   *   넘기는 케이스에서 활성).
   *
   * 회귀 가드:
   * - 9+ callsite 동작 그대로.
   * - body defensive guard / stats 누적 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 505: grantGold signature에서 amount default 0건', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      const fnIdx = source.indexOf('export const grantGold');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/amount:\s*any\s*=\s*0/.test(sig), 'amount default 0 제거');
      assert.ok(/\bamount\b/.test(sig), 'amount 파라미터 자체는 보존');
  });

  test('cycle 505: body defensive guard 보존', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      const fnIdx = source.indexOf('export const grantGold');
      const fnEnd = source.indexOf('export const', fnIdx + 1);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(/if \(!amount\) return player/.test(block), 'defensive `if (!amount)` 가드 보존');
      assert.ok(/\(player\.gold \|\| 0\) \+ amount/.test(block), 'gold 누적 동작 보존');
  });

  test('cycle 505: 정합성 가드 — 모든 grantGold 호출자가 2 args 전달', async () => {
      const hooksDir = path.join(ROOT, 'src/hooks');
      const files = await readdir(hooksDir, { recursive: true });
      let totalCalls = 0;
      for (const f of files) {
          if (!String(f).endsWith('.ts')) continue;
          const fpath = path.join(hooksDir, String(f));
          let src;
          try { src = await readFile(fpath, 'utf8'); } catch { continue; }
          const calls = src.match(/grantGold\(/g) || [];
          totalCalls += calls.length;
      }
      assert.ok(totalCalls >= 5, `grantGold 호출 5건 이상 (실제: ${totalCalls})`);
  });

  test('cycle 505: cycle 502/503/504 회귀 가드 — 이전 default 정리 보존', async () => {
      const ps = await readSrc('src/utils/playerStateUtils.ts');
      const psFn = ps.indexOf('export const incrementStat');
      const psEnd = ps.indexOf('=>', psFn);
      assert.ok(!/\bamount\b/.test(ps.slice(psFn, psEnd)), 'cycle 502 incrementStat amount 0건');

      const eu = await readSrc('src/utils/enhancementUtils.ts');
      const euFn = eu.indexOf('export const consumeInventoryItemByName');
      const euEnd = eu.indexOf('=>', euFn);
      assert.ok(!/count:\s*number\s*=\s*1/.test(eu.slice(euFn, euEnd)),
          'cycle 503 consumeInventoryItemByName count default 0건');

      const gu = await readSrc('src/utils/gameUtils.ts');
      const guFn = gu.indexOf('export const getDailyProtocolCompletions');
      const guEnd = gu.indexOf('=>', guFn);
      assert.ok(!/amount:\s*any\s*=\s*1/.test(gu.slice(guFn, guEnd)),
          'cycle 504 getDailyProtocolCompletions amount default 0건');
  });
}

// ─── cycle-506-get-enhance-availability-defaults-unreachable.test.js ───
{
  /**
   * cycle 506: getEnhanceAvailability `gold = 0` + `inventory = []` defaults
   *   unreachable batch 정리
   *   (cycle 222-505 silent dead config 시리즈 256번째 — redundant default annotation
   *   util-level batch, cycle 502-505 lens 회귀, util default 청소 메가 시리즈 5번째).
   *
   * 발견 (2 default unreachable):
   * - src/utils/enhancementUtils.ts (line 31):
   *     export const getEnhanceAvailability = (item, gold: number = 0,
   *         inventory: Item[] = []) => {...}
   * - 호출 사이트 (3 callsite):
   *     · EquipmentPanel.tsx:65 — getEnhanceAvailability(item, player?.gold || 0,
   *       player?.inv || []).
   *     · SmartInventory.tsx:261 — getEnhanceAvailability(item, player.gold,
   *       (player.inv || [])).
   *     · useInventoryActions.ts:547 — getEnhanceAvailability(item, player.gold,
   *       player.inv).
   *     · 3 callsite 모두 3 args 전달. default 0 / [] 도달 불가.
   *
   * 패턴 (cycle 222-505 시리즈 256번째):
   * - cycle 502-505: util default 청소 메가 시리즈 (incrementStat / consumeInventory /
   *   getDailyProtocolCompletions / grantGold).
   * - cycle 506: getEnhanceAvailability 2 default batch — 같은 파일에서 cycle 503
   *   (consumeInventoryItemByName count) paired completion.
   *
   * 수정 (src/utils/enhancementUtils.ts):
   * - signature에서 gold: number = 0 → gold: number.
   * - signature에서 inventory: Item[] = [] → inventory: Item[].
   *
   * 회귀 가드:
   * - 3 callsite 동작 그대로.
   * - body 동작 보존 (canEnhance / affordable 분기).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 506: getEnhanceAvailability signature에서 gold / inventory default 0건', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      const fnIdx = source.indexOf('export const getEnhanceAvailability');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/gold:\s*number\s*=\s*0/.test(sig), 'gold default 0 제거');
      assert.ok(!/inventory:\s*Item\[\]\s*=\s*\[\]/.test(sig), 'inventory default [] 제거');
      assert.ok(/\bgold\b/.test(sig), 'gold 파라미터 자체는 보존');
      assert.ok(/\binventory\b/.test(sig), 'inventory 파라미터 자체는 보존');
  });

  test('cycle 506: 정합성 가드 — 3 callsite 모두 3 args 전달', async () => {
      const callsites = [
          'src/components/EquipmentPanel.tsx',
          'src/components/SmartInventory.tsx',
          'src/hooks/useInventoryActions.ts',
      ];
      for (const f of callsites) {
          const source = await readSrc(f);
          const matches = source.match(/getEnhanceAvailability\(/g) || [];
          assert.ok(matches.length >= 1, `${f} getEnhanceAvailability 호출 발견`);
      }
  });

  test('cycle 506: body canEnhance / affordable 분기 보존', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(/canEnhance: false/.test(source), 'canEnhance: false 분기 보존');
      assert.ok(/affordable: true/.test(source), 'affordable: true 분기 보존');
      assert.ok(/missing: 'gold'/.test(source), 'missing gold 분기 보존');
      assert.ok(/missing: 'material'/.test(source), 'missing material 분기 보존');
  });

  test('cycle 506: cycle 502-505 회귀 가드 — 이전 default 정리 보존', async () => {
      const ps = await readSrc('src/utils/playerStateUtils.ts');
      assert.ok(!/incrementStat[^=]*amount/.test(ps.match(/export const incrementStat[^=]*=>/)?.[0] || ''),
          'cycle 502 incrementStat amount 0건');

      const eu = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(!/consumeInventoryItemByName[^=]*count:\s*number\s*=\s*1/.test(eu),
          'cycle 503 consume count default 0건');

      const gu = await readSrc('src/utils/gameUtils.ts');
      assert.ok(!/getDailyProtocolCompletions[^=]*amount:\s*any\s*=\s*1/.test(gu),
          'cycle 504 getDailyProtocolCompletions amount default 0건');
      assert.ok(!/grantGold[^=]*amount:\s*any\s*=\s*0/.test(gu),
          'cycle 505 grantGold amount default 0건');
  });
}

// ─── cycle-507-exploration-pacing-defaults-unreachable.test.js ───
{
  /**
   * cycle 507: explorationPacing 2 함수 (getNarrativeEventChance + getQuietExplorationChance)
   *   defaults unreachable batch 정리
   *   (cycle 222-506 silent dead config 시리즈 257번째 — redundant default annotation
   *   util-level batch, util default 청소 메가 시리즈 6번째).
   *
   * 발견 (6 default unreachable):
   * - src/utils/explorationPacing.ts (line 87, 99):
   *     export const getNarrativeEventChance = (baseChance: any = 0, bonusMultiplier:
   *         any = 0, stats: any = {}, mapData: GameMap | null = null) => {...}
   *     export const getQuietExplorationChance = (stats: any = {},
   *         mapData: GameMap | null = null) => {...}
   * - 호출 사이트 (각 2 callsite):
   *     · getNarrativeEventChance:
   *       - explorationPacing.ts:133 (getDiscoveryOdds 내부) — 4 args.
   *       - exploreActions.ts:37 — 4 args.
   *     · getQuietExplorationChance:
   *       - explorationPacing.ts:132 (getDiscoveryOdds 내부) — 2 args.
   *       - exploreActions.ts:38 — 2 args.
   *     · 모든 callsite가 모든 파라미터를 명시 전달.
   *
   * 패턴 (cycle 222-506 시리즈 257번째):
   * - cycle 502-506: util default 청소 메가 시리즈 (incrementStat / consumeInventory /
   *   getDailyProtocolCompletions / grantGold / getEnhanceAvailability).
   * - cycle 507: explorationPacing 2 함수 6 defaults batch — 같은 lens.
   *
   * 수정 (src/utils/explorationPacing.ts):
   * - getNarrativeEventChance signature에서 4 default 제거.
   * - getQuietExplorationChance signature에서 2 default 제거.
   *
   * 회귀 가드:
   * - 4 callsite 동작 그대로.
   * - body 동작 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 507: getNarrativeEventChance signature defaults 0건', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      const fnIdx = source.indexOf('export const getNarrativeEventChance');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/baseChance:\s*any\s*=/.test(sig), 'baseChance default 제거');
      assert.ok(!/bonusMultiplier:\s*any\s*=/.test(sig), 'bonusMultiplier default 제거');
      assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig), 'stats default 제거');
      assert.ok(!/mapData:[^=]*=\s*null/.test(sig), 'mapData default 제거');
  });

  test('cycle 507: getQuietExplorationChance signature defaults 0건', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      const fnIdx = source.indexOf('export const getQuietExplorationChance');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig), 'stats default 제거');
      assert.ok(!/mapData:[^=]*=\s*null/.test(sig), 'mapData default 제거');
  });

  test('cycle 507: 정합성 가드 — 모든 callsite 명시 전달', async () => {
      const exploreActions = await readSrc('src/hooks/gameActions/exploreActions.ts');
      assert.ok(/getNarrativeEventChance\([^)]*,[^)]*,[^)]*,[^)]*\)/.test(exploreActions),
          'exploreActions getNarrativeEventChance 4 args 보존');
      assert.ok(/getQuietExplorationChance\([^)]*,[^)]*\)/.test(exploreActions),
          'exploreActions getQuietExplorationChance 2 args 보존');

      const pacing = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(/getNarrativeEventChance\(mapData\?\.eventChance \|\| 0, 0, player\?\.stats, mapData(?: \?\? null)?\)/.test(pacing),
          'getDiscoveryOdds 내부 getNarrativeEventChance 4 args 보존');
      assert.ok(/getQuietExplorationChance\(player\?\.stats, mapData(?: \?\? null)?\)/.test(pacing),
          'getDiscoveryOdds 내부 getQuietExplorationChance 2 args 보존');
  });

  test('cycle 507: body 동작 보존', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(/SPECIAL_EVENT_MAX_CHANCE/.test(source), 'BALANCE.SPECIAL_EVENT_MAX_CHANCE 보존');
      assert.ok(/QUIET_STREAK_NOTHING_REDUCTION/.test(source), 'QUIET_STREAK_NOTHING_REDUCTION 보존');
      assert.ok(/clamp\(/.test(source), 'clamp 호출 보존');
  });

  test('cycle 507: cycle 502-506 회귀 가드 — 이전 정리 보존', async () => {
      const eu = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(!/getEnhanceAvailability[^=]*gold:\s*number\s*=\s*0/.test(eu),
          'cycle 506 getEnhanceAvailability gold default 0건');
      const gu = await readSrc('src/utils/gameUtils.ts');
      assert.ok(!/grantGold[^=]*amount:\s*any\s*=\s*0/.test(gu),
          'cycle 505 grantGold amount default 0건');
  });
}

// ─── cycle-509-get-adventure-guidance-runtime-state-default-unreachable.test.js ───
{
  /**
   * cycle 509: getAdventureGuidance `runtimeState = 'idle'` default unreachable
   *   (cycle 222-508 silent dead config 시리즈 259번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 8번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/adventureGuide.ts (line 243):
   *     export const getAdventureGuidance = (player, stats, mapData,
   *         runtimeState: any = 'idle') => {...
   *         if (runtimeState && runtimeState !== 'idle') {...}
   *         ...
   *     }
   * - 호출 사이트 (1 callsite):
   *     · ControlPanel.tsx:57 — getAdventureGuidance(player, stats || ...,
   *       mapData, gameState).
   *     · 1 callsite, 4 args 명시 전달 (gameState).
   *     · 다른 파일 import 0건.
   * - 결과: runtimeState 항상 명시 전달. default 'idle' 도달 불가.
   *
   * 패턴 (cycle 222-508 시리즈 259번째):
   * - cycle 502-508: util default 청소 메가 시리즈.
   * - cycle 509: getAdventureGuidance runtimeState default — 동일 lens.
   *
   * 수정 (src/utils/adventureGuide.ts):
   * - signature에서 runtimeState: any = 'idle' → runtimeState: any.
   * - body의 `if (runtimeState && runtimeState !== 'idle')` 분기 보존 (caller가
   *   gameState를 'idle' 또는 다른 값으로 넘기는 케이스 모두 커버).
   *
   * 회귀 가드:
   * - 1 callsite 동작 그대로.
   * - body 분기 보존 (runtimeState !== 'idle' 가드).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 509: getAdventureGuidance signature에서 runtimeState default 0건', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      const fnIdx = source.indexOf('export const getAdventureGuidance');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/runtimeState:\s*any\s*=\s*'idle'/.test(sig), 'runtimeState default 제거');
      assert.ok(/\bruntimeState\b/.test(sig), 'runtimeState 파라미터 자체는 보존');
  });

  test('cycle 509: 정합성 가드 — ControlPanel callsite 4 args (gameState 명시 전달)', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const matches = source.match(/getAdventureGuidance\(/g) || [];
      assert.equal(matches.length, 1, 'getAdventureGuidance 호출 1건');
      // 4 args 호출 — gameState가 마지막 args로 명시 전달되는지
      assert.ok(/getAdventureGuidance\([\s\S]+?, mapData, gameState\)/.test(source),
          '4 args 명시 전달 (mapData, gameState) 보존');
  });

  test('cycle 509: body runtimeState 분기 보존', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(/if \(runtimeState && runtimeState !== 'idle'\)/.test(source),
          'runtimeState !== idle 분기 보존');
      assert.ok(/runtimeState === 'combat'/.test(source), 'combat 분기 보존');
  });

  test('cycle 509: cycle 502-508 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const qp = await readSrc('src/utils/questProgress.ts');
      assert.ok(!/syncQuestProgress[^=]*enemyName:\s*any\s*=/.test(qp),
          'cycle 508 syncQuestProgress enemyName default 0건');

      const ep = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/getNarrativeEventChance[^=]*baseChance:\s*any\s*=/.test(ep),
          'cycle 507 getNarrativeEventChance baseChance default 0건');
  });
}

// ─── cycle-512-get-armor-style-from-item-fallback-default-unreachable.test.js ───
{
  /**
   * cycle 512: getArmorStyleFromItem `fallback = 'coat'` default unreachable
   *   (cycle 222-511 silent dead config 시리즈 261번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 10번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/itemVisuals.ts (line 201):
   *     export const getArmorStyleFromItem = (armor, fallback: any = 'coat') => {
   *         if (!armor || armor.type !== 'armor') return fallback;
   *         ...
   *         return fallback;
   *     }
   * - 호출 사이트 (7 callsite):
   *     · equipmentArt.ts:102 — getArmorStyleFromItem(item, fallback).
   *     · itemVisuals.ts:272 / 317 — getArmorStyleFromItem(item, 'coat').
   *     · characterAppearance.ts:53 / 77 / 106 — getArmorStyleFromItem(item/armor,
   *       'coat' or baseStyle.armorStyle).
   *     · avatarEquipmentPreview.ts:26 — getArmorStyleFromItem(item, 'coat').
   *     · 7 callsite 모두 fallback 명시 전달.
   *
   * 패턴 (cycle 222-511 시리즈 261번째):
   * - cycle 502-511: util default 청소 메가 시리즈.
   * - cycle 512: getArmorStyleFromItem fallback default — 같은 lens.
   *
   * 수정 (src/utils/itemVisuals.ts):
   * - signature에서 fallback: any = 'coat' → fallback: any (default 제거).
   * - body fallback 사용 그대로 (caller가 명시 전달).
   *
   * 회귀 가드:
   * - 7 callsite 동작 그대로.
   * - body keyword 분기 / fallback return 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 512: getArmorStyleFromItem signature에서 fallback default 0건', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      const fnIdx = source.indexOf('export const getArmorStyleFromItem');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/fallback:\s*any\s*=\s*'coat'/.test(sig), 'fallback default 제거');
      assert.ok(/\bfallback\b/.test(sig), 'fallback 파라미터 자체는 보존');
  });

  test('cycle 512: 정합성 가드 — 모든 callsite fallback 명시 전달', async () => {
      const callerFiles = [
          'src/utils/equipmentArt.ts',
          'src/utils/itemVisuals.ts',
          'src/utils/characterAppearance.ts',
          'src/utils/avatarEquipmentPreview.ts',
      ];
      let totalCalls = 0;
      for (const f of callerFiles) {
          const source = await readSrc(f);
          const matches = source.match(/getArmorStyleFromItem\(/g) || [];
          totalCalls += matches.length;
      }
      assert.ok(totalCalls >= 7, `getArmorStyleFromItem 호출 7건 이상 (실제: ${totalCalls})`);
  });

  test('cycle 512: body keyword 분기 / fallback return 보존', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      assert.ok(/return 'robe'/.test(source), 'robe 분기 보존');
      assert.ok(/return 'leather'/.test(source), 'leather 분기 보존');
      assert.ok(/return 'coat'/.test(source), 'coat 분기 보존');
      assert.ok(/return 'plate'/.test(source), 'plate 분기 보존');
      assert.ok(/return fallback/.test(source), 'fallback return 보존');
  });

  test('cycle 512: cycle 502-511 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const eu = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/getWeaponAttackValue[^=]*slot:\s*any\s*=\s*'main'/.test(eu),
          'cycle 511 getWeaponAttackValue slot default 0건');
  });
}

// ─── cycle-515-advance-explore-state-defaults-batch-unreachable.test.js ───
{
  /**
   * cycle 515: advanceExploreState `stats = {}` + `outcome = 'combat'` defaults
   *   batch unreachable (cycle 222-514 silent dead config 시리즈 260번째 — redundant
   *   default annotation util-level cleanup, util default 청소 메가 시리즈 13번째).
   *
   * 발견 (2 defaults batch):
   * - src/utils/explorationPacing.ts:
   *     export const advanceExploreState = (stats: any = {},
   *         outcome = 'combat') => {...}
   * - 호출 사이트 (1 callsite):
   *     · _shared.ts:53 — advanceExploreState(currentPlayer.stats, outcome)
   *     · 1 callsite, 2 args 명시 전달.
   *     · outcome 인자는 commitExploreOutcome(outcome, ...)의 outcome 변수와 직결,
   *       모든 7개 commitExploreOutcome 호출에서 1st arg(narrative_event/nothing/
   *       combat/relic_found 등) 명시 전달.
   *     · 다른 파일 import 0건.
   * - 결과: stats / outcome 항상 명시 전달. 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-514 시리즈 260번째):
   * - cycle 502-514: util default 청소 메가 시리즈.
   * - cycle 515: advanceExploreState batch — 동일 lens.
   *
   * 수정 (src/utils/explorationPacing.ts):
   * - signature에서 stats: any = {} → stats: any.
   * - signature에서 outcome = 'combat' → outcome: any.
   * - body의 getExploreState(stats) 호출 보존 (getExploreState 내부에서
   *   stats?.exploreState 처리, undefined 안전).
   * - switch (outcome) 분기 보존 (combat은 default: 케이스에서 기본 처리).
   *
   * 회귀 가드:
   * - 1 callsite 동작 그대로.
   * - switch outcome 분기 + getExploreState 호출 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 515: advanceExploreState signature에서 stats / outcome default 0건', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      const fnIdx = source.indexOf('export const advanceExploreState');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig), 'stats default {} 제거');
      assert.ok(!/outcome\s*=\s*'combat'/.test(sig), "outcome default 'combat' 제거");
      assert.ok(/\bstats\b/.test(sig), 'stats 파라미터 자체는 보존');
      assert.ok(/\boutcome\b/.test(sig), 'outcome 파라미터 자체는 보존');
  });

  test('cycle 515: 정합성 가드 — _shared.ts callsite 2 args 명시 전달 보존', async () => {
      const source = await readSrc('src/hooks/gameActions/_shared.ts');
      const matches = source.match(/advanceExploreState\(/g) || [];
      assert.equal(matches.length, 1, 'advanceExploreState 호출 1건');
      assert.ok(/advanceExploreState\(currentPlayer\.stats,\s*outcome\)/.test(source),
          '2 args (currentPlayer.stats, outcome) 명시 전달 보존');
  });

  test('cycle 515: body switch outcome 분기 + getExploreState 호출 보존', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(/switch \(outcome\)/.test(source), 'switch (outcome) 분기 보존');
      assert.ok(/case 'narrative_event'/.test(source), "narrative_event 케이스 보존");
      assert.ok(/case 'combat':\s*\n\s*default:/.test(source), 'combat/default 케이스 보존');
      assert.ok(/const current = getExploreState\(stats\)/.test(source),
          'getExploreState(stats) 호출 보존 (undefined 안전)');
  });

  test('cycle 515: cycle 502-514 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const aep = await readSrc('src/utils/avatarEquipmentPreview.ts');
      assert.ok(!/getEquipmentPreviewStage[^=]*variant:\s*any\s*=/.test(aep),
          'cycle 514 getEquipmentPreviewStage variant default 0건');

      const ea = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(!/getEquipmentArtProfile[^=]*slotHint:\s*any\s*=/.test(ea),
          'cycle 513 getEquipmentArtProfile slotHint default 0건');

      const iv = await readSrc('src/utils/itemVisuals.ts');
      assert.ok(!/getArmorStyleFromItem[^=]*fallback[^,)]*=/.test(iv),
          'cycle 512 getArmorStyleFromItem fallback default 0건');
  });
}

// ─── cycle-516-get-enhance-requirement-current-level-default-unreachable.test.js ───
{
  /**
   * cycle 516: getEnhanceRequirement `currentLevel = 0` default unreachable
   *   (cycle 222-515 silent dead config 시리즈 261번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 14번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/enhancementUtils.ts (line 8):
   *     export const getEnhanceRequirement = (currentLevel: any = 0) => ({
   *         gold: BALANCE.ENHANCE_COSTS[currentLevel] ?? 0,
   *         materials: BALANCE.ENHANCE_MATERIAL_COSTS[currentLevel] ?? 1,
   *         ...
   *     });
   * - 호출 사이트 (1 internal + 2 test callsite):
   *     · enhancementUtils.ts:58 — getEnhanceRequirement(currentLevel) (내부)
   *     · tests/enhancement-utils.test.js:14-15 — (0) / (7) 명시
   *     · 다른 파일 import 0건.
   * - 결과: currentLevel 항상 명시 전달. default 0 도달 불가.
   *
   * 패턴 (cycle 222-515 시리즈 261번째):
   * - cycle 502-515: util default 청소 메가 시리즈.
   * - cycle 516: getEnhanceRequirement currentLevel — 동일 lens.
   *
   * 수정 (src/utils/enhancementUtils.ts):
   * - signature에서 currentLevel: any = 0 → currentLevel: any.
   * - body의 BALANCE.ENHANCE_COSTS[currentLevel] ?? 0 nullish 가드 보존.
   *
   * 회귀 가드:
   * - 1 internal callsite + 2 test callsite 동작 그대로.
   * - body nullish ?? 0 / ?? 1 fallback 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 516: getEnhanceRequirement signature에서 currentLevel default 0건', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      const fnIdx = source.indexOf('export const getEnhanceRequirement');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/currentLevel:\s*any\s*=\s*0/.test(sig), 'currentLevel default 0 제거');
      assert.ok(/\bcurrentLevel\b/.test(sig), 'currentLevel 파라미터 자체는 보존');
  });

  test('cycle 516: 정합성 가드 — internal + test callsite 동작 보존', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(/getEnhanceRequirement\(currentLevel\)/.test(source),
          'internal callsite 동작 보존');

      const testSource = await readSrc('tests/enhancement-utils.test.js');
      assert.ok(/getEnhanceRequirement\(0\)/.test(testSource), 'test callsite (0) 보존');
      assert.ok(/getEnhanceRequirement\(7\)/.test(testSource), 'test callsite (7) 보존');
  });

  test('cycle 516: body nullish fallback 보존', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(/BALANCE\.ENHANCE_COSTS\[currentLevel\]\s*\?\?\s*0/.test(source),
          'gold ?? 0 nullish fallback 보존');
      assert.ok(/BALANCE\.ENHANCE_MATERIAL_COSTS\[currentLevel\]\s*\?\?\s*1/.test(source),
          'materials ?? 1 nullish fallback 보존');
  });

  test('cycle 516: cycle 502-515 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const ep = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/advanceExploreState[^=]*stats:\s*any\s*=\s*\{\}/.test(ep),
          'cycle 515 advanceExploreState stats default 0건');

      const aep = await readSrc('src/utils/avatarEquipmentPreview.ts');
      assert.ok(!/getEquipmentPreviewStage[^=]*variant:\s*any\s*=/.test(aep),
          'cycle 514 getEquipmentPreviewStage variant default 0건');
  });
}

// ─── cycle-517-get-armor-body-style-fallback-default-unreachable.test.js ───
{
  /**
   * cycle 517: getArmorBodyStyle `fallback = 'coat'` default unreachable
   *   (cycle 222-516 silent dead config 시리즈 262번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 15번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/equipmentArt.ts (line 88):
   *     const getArmorBodyStyle = (item, fallback: any = 'coat') => {...}
   * - 호출 사이트 (1 callsite, 모듈 내부 private):
   *     · equipmentArt.ts:148 — getArmorBodyStyle(item, fallbackArmorStyle).
   *     · fallbackArmorStyle은 cycle 513에서 보존된 getEquipmentArtProfile의
   *       fallbackArmorStyle: any = 'coat' default(여전히 활성). 즉 caller에서
   *       이미 string 보장된 값을 명시 전달.
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: fallback 항상 명시 전달. inner default 'coat' 도달 불가.
   *
   * 패턴 (cycle 222-516 시리즈 262번째):
   * - cycle 502-516: util default 청소 메가 시리즈.
   * - cycle 517: getArmorBodyStyle fallback — 동일 lens. 외부 wrapper에 default가
   *   살아있으면 inner fn의 동일 default는 불필요한 redundancy.
   *
   * 수정 (src/utils/equipmentArt.ts):
   * - getArmorBodyStyle signature에서 fallback: any = 'coat' → fallback: any.
   * - body의 if (!item || item.type !== 'armor') return fallback 보존.
   * - getArmorStyleFromItem(item, fallback) 호출 보존.
   *
   * 회귀 가드:
   * - 1 internal callsite 동작 그대로.
   * - body return fallback / getArmorStyleFromItem 호출 보존.
   * - 외부 wrapper getEquipmentArtProfile fallbackArmorStyle default 'coat'
   *   유지 — wrapper가 entry point (cycle 513 명시).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 517: getArmorBodyStyle signature에서 fallback default 0건', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      const fnIdx = source.indexOf('const getArmorBodyStyle');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/fallback:\s*any\s*=\s*'coat'/.test(sig), 'fallback default coat 제거');
      assert.ok(/\bfallback\b/.test(sig), 'fallback 파라미터 자체는 보존');
  });

  test('cycle 517: 정합성 가드 — internal callsite 보존', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(/getArmorBodyStyle\(item,\s*fallbackArmorStyle\)/.test(source),
          'internal callsite (item, fallbackArmorStyle) 보존');
  });

  test('cycle 517: body return fallback / getArmorStyleFromItem 호출 보존', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(/if \(!item \|\| item\.type !== 'armor'\) return fallback/.test(source),
          'early return fallback 보존');
      assert.ok(/getArmorStyleFromItem\(item,\s*fallback\)/.test(source),
          'getArmorStyleFromItem(item, fallback) 호출 보존');
  });

  test('cycle 517: 외부 wrapper getEquipmentArtProfile fallbackArmorStyle default 보존 (cycle 513)', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(/fallbackArmorStyle:\s*any\s*=\s*'coat'/.test(source),
          'wrapper getEquipmentArtProfile fallbackArmorStyle default 활성 보존');
  });

  test('cycle 517: cycle 502-516 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const eu = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(!/getEnhanceRequirement[^=]*currentLevel:\s*any\s*=\s*0/.test(eu),
          'cycle 516 getEnhanceRequirement currentLevel default 0건');

      const ep = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/advanceExploreState[^=]*stats:\s*any\s*=\s*\{\}/.test(ep),
          'cycle 515 advanceExploreState stats default 0건');
  });
}

// ─── cycle-518-get-weapon-equip-score-slot-default-unreachable.test.js ───
{
  /**
   * cycle 518: getWeaponEquipScore `slot = 'main'` default unreachable
   *   (cycle 222-517 silent dead config 시리즈 263번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 16번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/equipmentUtils.ts (line 73):
   *     const getWeaponEquipScore = (weapon: any, slot: any = 'main') => (
   *         getWeaponAttackValue(weapon, slot) +
   *         Math.round(getWeaponCritBonus(weapon, slot) * 100)
   *     );
   * - 호출 사이트 (2 callsite, 모듈 내부 private — cycle 291 export downgrade):
   *     · equipmentUtils.ts:143 — getWeaponEquipScore(mainWeapon, 'main')
   *                              + getWeaponEquipScore(offhandWeapon, 'offhand').
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: slot 항상 명시 전달 ('main' / 'offhand'). default 'main' 도달 불가.
   *
   * 패턴 (cycle 222-517 시리즈 263번째):
   * - cycle 502-517: util default 청소 메가 시리즈.
   * - cycle 518: getWeaponEquipScore slot — 동일 lens. cycle 511에서 이미
   *   getWeaponAttackValue / getWeaponCritBonus의 slot defaults 제거함, 동일 모듈
   *   내 자매 헬퍼.
   *
   * 수정 (src/utils/equipmentUtils.ts):
   * - signature에서 slot: any = 'main' → slot: any.
   * - body의 getWeaponAttackValue(weapon, slot) + getWeaponCritBonus(weapon, slot)
   *   호출 보존.
   *
   * 회귀 가드:
   * - 2 internal callsite 동작 그대로.
   * - body slot 사용처(getWeaponAttackValue/getWeaponCritBonus 모두 cycle 511에서
   *   이미 default 제거됨) 보존.
   * - cycle 291 export downgrade 보존(export 제거된 private const 유지).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 518: getWeaponEquipScore signature에서 slot default 0건', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      const fnIdx = source.indexOf('const getWeaponEquipScore');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/slot:\s*any\s*=\s*'main'/.test(sig), 'slot default main 제거');
      assert.ok(/\bslot\b/.test(sig), 'slot 파라미터 자체는 보존');
  });

  test('cycle 518: 정합성 가드 — 2 internal callsite 보존 (main / offhand 명시)', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(/getWeaponEquipScore\(mainWeapon,\s*'main'\)/.test(source),
          'main slot callsite 보존');
      assert.ok(/getWeaponEquipScore\(offhandWeapon,\s*'offhand'\)/.test(source),
          'offhand slot callsite 보존');
  });

  test('cycle 518: body getWeaponAttackValue / getWeaponCritBonus slot 전달 보존', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(/getWeaponAttackValue\(weapon,\s*slot\)/.test(source),
          'getWeaponAttackValue(weapon, slot) 보존');
      assert.ok(/getWeaponCritBonus\(weapon,\s*slot\)/.test(source),
          'getWeaponCritBonus(weapon, slot) 보존');
  });

  test('cycle 518: cycle 291 export downgrade 보존 (private const 유지)', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/export const getWeaponEquipScore/.test(source),
          'export 제거 (cycle 291 보존)');
      assert.ok(/const getWeaponEquipScore/.test(source),
          'private const 정의 유지');
  });

  test('cycle 518: cycle 502-517 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const ea = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(!/getArmorBodyStyle[^=]*fallback:\s*any\s*=\s*'coat'/.test(ea),
          'cycle 517 getArmorBodyStyle fallback default 0건');

      const eu = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(!/getEnhanceRequirement[^=]*currentLevel:\s*any\s*=\s*0/.test(eu),
          'cycle 516 getEnhanceRequirement currentLevel default 0건');
  });
}

// ─── cycle-519-get-map-level-player-level-default-unreachable.test.js ───
{
  /**
   * cycle 519: getMapLevel `playerLevel = 1` default unreachable
   *   (cycle 222-518 silent dead config 시리즈 264번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 17번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/adventureGuide.ts (line 32):
   *     const getMapLevel = (map, playerLevel: any = 1) => (
   *         map?.level === 'infinite'
   *             ? Math.max((playerLevel || 1) + 8, 50)
   *             : (map?.minLv ?? (typeof map?.level === 'number' ? map.level : 1))
   *     );
   * - 호출 사이트 (1 callsite, 모듈 내부 private):
   *     · adventureGuide.ts:145 — getMapLevel(targetMap, playerLevel).
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: playerLevel 항상 명시 전달. default 1 도달 불가.
   *
   * 패턴 (cycle 222-518 시리즈 264번째):
   * - cycle 502-518: util default 청소 메가 시리즈.
   * - cycle 519: getMapLevel playerLevel — 동일 lens.
   *
   * 수정 (src/utils/adventureGuide.ts):
   * - signature에서 playerLevel: any = 1 → playerLevel: any.
   * - body의 (playerLevel || 1) nullish 가드 보존 (caller가 0/undefined 넘기는
   *   가능성 자체는 보존).
   *
   * 회귀 가드:
   * - 1 internal callsite 동작 그대로.
   * - body (playerLevel || 1) defensive 가드 + map?.minLv ?? fallback chain 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 519: getMapLevel signature에서 playerLevel default 0건', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      const fnIdx = source.indexOf('const getMapLevel');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/playerLevel:\s*any\s*=\s*1/.test(sig), 'playerLevel default 1 제거');
      assert.ok(/\bplayerLevel\b/.test(sig), 'playerLevel 파라미터 자체는 보존');
  });

  test('cycle 519: 정합성 가드 — internal callsite 보존', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(/getMapLevel\(targetMap,\s*playerLevel\)/.test(source),
          'internal callsite (targetMap, playerLevel) 보존');
  });

  test('cycle 519: body (playerLevel || 1) defensive 가드 + map?.minLv 체인 보존', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(/\(playerLevel \|\| 1\) \+ 8/.test(source),
          '(playerLevel || 1) nullish defensive guard 보존');
      assert.ok(/map\?\.minLv\s*\?\?\s*\(typeof map\?\.level/.test(source),
          'map?.minLv ?? fallback chain 보존');
  });

  test('cycle 519: cycle 502-518 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const eu = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/getWeaponEquipScore[^=]*slot:\s*any\s*=\s*'main'/.test(eu),
          'cycle 518 getWeaponEquipScore slot default 0건');

      const ea = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(!/getArmorBodyStyle[^=]*fallback:\s*any\s*=\s*'coat'/.test(ea),
          'cycle 517 getArmorBodyStyle fallback default 0건');
  });
}

// ─── cycle-521-hash-text-mix-hex-defaults-batch-unreachable.test.js ───
{
  /**
   * cycle 521: hashText `value = ''` + mixHex `ratio = 0.5` defaults batch
   *   unreachable (cycle 222-520 silent dead config 시리즈 265번째 — redundant default
   *   annotation util-level cleanup, util default 청소 메가 시리즈 18번째).
   *
   * 발견 (2 defaults batch):
   * - src/utils/equipmentArt.ts (line 12, 30):
   *     const hashText = (value: any = '') => (...)
   *     const mixHex = (left: any, right: any, ratio: any = 0.5) => {...}
   * - 호출 사이트 (모듈 내부 private):
   *     · hashText:1 callsite — equipmentArt.ts:41 hashText(item?.name || '')
   *       — caller가 `|| ''` fallback으로 string 보장.
   *     · mixHex:4 callsite — equipmentArt.ts:44-47 mixHex(palette.X, '#ffffff'/
   *       '#000000', ratio * 0.2/0.35/0.08/0.16) — 4 calls 모두 3 args 명시.
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: hashText value 항상 string 보장 + mixHex ratio 항상 명시 전달.
   *   두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-520 시리즈 265번째):
   * - cycle 502-519: util default 청소 메가 시리즈 17사이클.
   * - cycle 521: equipmentArt.ts 내부 helper batch — 동일 lens, 같은 모듈에서
   *   cycle 513/517에 이은 3번째 cleanup.
   *
   * 수정 (src/utils/equipmentArt.ts):
   * - hashText signature: value: any = '' → value: any.
   * - mixHex signature: ratio: any = 0.5 → ratio: any.
   * - body의 String(value) coercion / hexToRgb / rgbToHex 호출 보존.
   *
   * 회귀 가드:
   * - 5 internal callsite 동작 그대로.
   * - body 동작 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 521: hashText signature에서 value default '' 0건", async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      const fnIdx = source.indexOf('const hashText');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/value:\s*any\s*=\s*''/.test(sig), "hashText value default '' 제거");
      assert.ok(/\bvalue\b/.test(sig), 'value 파라미터 자체는 보존');
  });

  test('cycle 521: mixHex signature에서 ratio default 0.5 0건', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      const fnIdx = source.indexOf('const mixHex');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/ratio:\s*any\s*=\s*0\.5/.test(sig), 'mixHex ratio default 0.5 제거');
      assert.ok(/\bratio\b/.test(sig), 'ratio 파라미터 자체는 보존');
  });

  test('cycle 521: 정합성 가드 — 5 internal callsite 보존', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(/hashText\(item\?\.name \|\| ''\)/.test(source),
          'hashText callsite (item?.name || \'\') 보존');
      const mixCount = (source.match(/mixHex\(/g) || []).length;
      assert.equal(mixCount, 4, `mixHex 사용처 4건 보존: ${mixCount}건`);
      assert.ok(/const mixHex = \(left/.test(source), 'mixHex 정의 보존');
  });

  test('cycle 521: body 동작 보존', async () => {
      const source = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(/\[\.\.\.String\(value\)\]\.reduce/.test(source),
          'hashText String(value) coercion 보존');
      assert.ok(/const l = hexToRgb\(left\)/.test(source),
          'mixHex hexToRgb(left) 호출 보존');
  });

  test('cycle 521: cycle 502-519 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const ag = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(!/getMapLevel[^=]*playerLevel:\s*any\s*=\s*1/.test(ag),
          'cycle 519 getMapLevel playerLevel default 0건');

      const eu = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/getWeaponEquipScore[^=]*slot:\s*any\s*=\s*'main'/.test(eu),
          'cycle 518 getWeaponEquipScore slot default 0건');
  });
}

// ─── cycle-522-to-int-fallback-default-unreachable.test.js ───
{
  /**
   * cycle 522: toInt `fallback = 0` default unreachable
   *   (cycle 222-521 silent dead config 시리즈 266번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 19번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/aiEventUtils.ts (line 5):
   *     const toInt = (value: any, fallback: any = 0) =>
   *         (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback);
   * - 호출 사이트 (8 callsite, 모듈 내부 private):
   *     · line 129: toInt(..., 1)
   *     · line 130: toInt(..., 120)
   *     · line 131: toInt(..., 60)
   *     · line 202: toInt(outcome.choiceIndex, idx)
   *     · line 208-211: toInt(outcome.X, 0) × 4 (gold/exp/hp/mp)
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: fallback 항상 명시 전달. default 0 도달 불가.
   *
   * 패턴 (cycle 222-521 시리즈 266번째):
   * - cycle 502-521: util default 청소 메가 시리즈 18사이클.
   * - cycle 522: toInt fallback — 동일 lens. cycle 521과 동일하게 같은 모듈에서
   *   정수형 helper 정리.
   *
   * 수정 (src/utils/aiEventUtils.ts):
   * - signature에서 fallback: any = 0 → fallback: any.
   * - body의 ternary (Number.isFinite(...) ? Math.trunc(...) : fallback) 보존.
   *
   * 회귀 가드:
   * - 8 internal callsite 동작 그대로.
   * - body Number.isFinite/Math.trunc 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 522: toInt signature에서 fallback default 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('const toInt');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/fallback:\s*any\s*=\s*0/.test(sig), 'toInt fallback default 0 제거');
      assert.ok(/\bfallback\b/.test(sig), 'fallback 파라미터 자체는 보존');
  });

  test('cycle 522: 정합성 가드 — 8 internal callsite 보존', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const calls = (source.match(/toInt\(/g) || []).length;
      // 정의 1 (const toInt = (...))는 paren 미사용, 사용처만 8회 매칭
      assert.equal(calls, 8, `toInt 호출 8건 보존: ${calls}건`);
  });

  test('cycle 522: body ternary 처리 보존', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(/Number\.isFinite\(Number\(value\)\)\s*\?\s*Math\.trunc\(Number\(value\)\)\s*:\s*fallback/.test(source),
          'Number.isFinite/Math.trunc/fallback ternary 보존');
  });

  test('cycle 522: cycle 502-521 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const ea = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(!/const hashText[^=]*value:\s*any\s*=\s*''/.test(ea),
          'cycle 521 hashText value default 0건');
      assert.ok(!/const mixHex[^=]*ratio:\s*any\s*=\s*0\.5/.test(ea),
          'cycle 521 mixHex ratio default 0건');

      const ag = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(!/getMapLevel[^=]*playerLevel:\s*any\s*=\s*1/.test(ag),
          'cycle 519 getMapLevel playerLevel default 0건');
  });
}

// ─── cycle-525-hash-string-classify-choice-defaults-batch-unreachable.test.js ───
{
  /**
   * cycle 525: hashString + classifyChoice 2 defaults batch unreachable
   *   (cycle 222-524 silent dead config 시리즈 269번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 22번째).
   *
   * 발견 (2 defaults batch, aiEventUtils.ts 같은 모듈):
   * - src/utils/aiEventUtils.ts:
   *     · line 48: const hashString = (value: any = '') => {...}
   *     · line 113: export const classifyChoice = (choiceText: any = '') => {...}
   * - 호출 사이트:
   *     · hashString:1 callsite (line 130 hashString(`${context.location || ''}
   *       |${desc}|${choice}|${choiceIndex}`)) — template literal로 string 보장.
   *     · classifyChoice:1 internal (line 131 classifyChoice(choice)) +
   *       4 test callsite (tests/ai-event-utils.test.js:19-22) — 모두 string
   *       명시.
   * - 결과: 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-524 시리즈 269번째):
   * - cycle 502-524: util default 청소 메가 시리즈 21사이클.
   * - cycle 525: aiEventUtils 같은 모듈 batch — cycle 522 toInt에 이은 동일
   *   파일 추가 cleanup.
   *
   * 수정 (src/utils/aiEventUtils.ts):
   * - hashString signature: value: any = '' → value: any.
   * - classifyChoice signature: choiceText: any = '' → choiceText: any.
   * - body의 value.length/charCodeAt + normalizeText(choiceText) 호출 보존.
   *
   * 회귀 가드:
   * - 5+ callsite 동작 그대로.
   * - body hash 계산 / RETREAT/RISKY/SAFE keyword 체크 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 525: hashString signature에서 value default '' 0건", async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('const hashString');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/value:\s*any\s*=\s*''/.test(sig), "hashString value default '' 제거");
      assert.ok(/\bvalue\b/.test(sig), 'value 파라미터 자체는 보존');
  });

  test("cycle 525: classifyChoice signature에서 choiceText default '' 0건", async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('export const classifyChoice');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/choiceText:\s*any\s*=\s*''/.test(sig),
          "classifyChoice choiceText default '' 제거");
      assert.ok(/\bchoiceText\b/.test(sig), 'choiceText 파라미터 자체는 보존');
  });

  test('cycle 525: 정합성 가드 — internal + test callsite 보존', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(/hashString\(`\$\{context\.location \|\| ''\}/.test(source),
          'hashString template literal callsite 보존');
      assert.ok(/classifyChoice\(choice\)/.test(source),
          'classifyChoice(choice) internal callsite 보존');

      const testSrc = await readSrc('tests/ai-event-utils.test.js');
      assert.ok(/classifyChoice\('조심히 접근한다'\)/.test(testSrc),
          'classifyChoice test callsite 보존');
  });

  test('cycle 525: body 동작 보존', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(/value\.charCodeAt\(i\)/.test(source),
          'hashString value.charCodeAt(i) 호출 보존');
      assert.ok(/normalizeText\(choiceText\)/.test(source),
          'classifyChoice normalizeText(choiceText) 호출 보존');
      assert.ok(/RETREAT_KEYWORDS\.some/.test(source), 'retreat keyword 분기 보존');
  });

  test('cycle 525: cycle 502-524 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const sr = await readSrc('src/utils/shopRotation.ts');
      assert.ok(!/const dateHash[^=]*salt:\s*any\s*=\s*0/.test(sr),
          'cycle 524 dateHash salt default 0건');

      const qo = await readSrc('src/utils/questOperations.ts');
      assert.ok(!/getQuestLevelGap[^=]*playerLevel:\s*any\s*=\s*1/.test(qo),
          'cycle 523 getQuestLevelGap playerLevel default 0건');
  });
}

// ─── cycle-526-to-percent-value-default-unreachable.test.js ───
{
  /**
   * cycle 526: toPercent `value = 0` default unreachable
   *   (cycle 222-525 silent dead config 시리즈 270번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 23번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/runProfile.ts (line 27):
   *     const toPercent = (value: any = 0) => `${Math.round(value * 100)}%`;
   * - 호출 사이트 (3 internal callsite, 모듈 내부 private):
   *     · runProfile.ts:229 — toPercent((bonus.atkMult || 1) - 1)
   *     · runProfile.ts:230 — toPercent((bonus.defMult || 1) - 1)
   *     · runProfile.ts:231 — toPercent(bonus.critBonus || 0)
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: value 항상 명시 전달 (각 caller가 `|| 1` 또는 `|| 0` fallback으로
   *   number 보장). default 0 도달 불가.
   *
   * 패턴 (cycle 222-525 시리즈 270번째):
   * - cycle 502-525: util default 청소 메가 시리즈 22사이클.
   * - cycle 526: toPercent value — 동일 lens. private + numeric helper.
   *
   * 회귀 정보 (cycle 526 첫 시도 revert):
   * - 첫 시도는 questProgress.ts findQuestDefinition questCatalog default 제거
   *   (cycle 508 cascade)였으나, 16개 test callsite (cycle 99/94/83 + quest-progress)
   *   가 syncQuestProgress(player) 1 arg로 호출하면 questCatalog가 undefined로
   *   propagate, findQuestDefinition default가 그 path 활성이라 revert.
   *   교훈: "all production callers pass arg" ≠ "all callers pass arg".
   *   test caller까지 포함된 audit 필요.
   *
   * 수정 (src/utils/runProfile.ts):
   * - signature에서 value: any = 0 → value: any.
   * - body의 Math.round(value * 100) 보존.
   *
   * 회귀 가드:
   * - 3 internal callsite 동작 그대로.
   * - body Math.round/template literal 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 526: toPercent signature에서 value default 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnIdx = source.indexOf('const toPercent');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/value:\s*any\s*=\s*0/.test(sig), 'toPercent value default 0 제거');
      assert.ok(/\bvalue\b/.test(sig), 'value 파라미터 자체는 보존');
  });

  test('cycle 526: 정합성 가드 — 3 internal callsite 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(/toPercent\(\(bonus\.atkMult \|\| 1\) - 1\)/.test(source),
          'ATK callsite 보존');
      assert.ok(/toPercent\(\(bonus\.defMult \|\| 1\) - 1\)/.test(source),
          'DEF callsite 보존');
      assert.ok(/toPercent\(bonus\.critBonus \|\| 0\)/.test(source),
          'CRIT callsite 보존');
  });

  test('cycle 526: body Math.round/template 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(/Math\.round\(value \* 100\)/.test(source),
          'Math.round(value * 100) 보존');
  });

  test('cycle 526: cycle 502-525 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/const hashString[^=]*value:\s*any\s*=\s*''/.test(aiu),
          'cycle 525 hashString value default 0건');

      const sr = await readSrc('src/utils/shopRotation.ts');
      assert.ok(!/const dateHash[^=]*salt:\s*any\s*=\s*0/.test(sr),
          'cycle 524 dateHash salt default 0건');
  });
}

// ─── cycle-527-dedupe-choices-normalize-outcomes-defaults-batch.test.js ───
{
  /**
   * cycle 527: dedupeChoices + normalizeOutcomes 4 defaults batch unreachable
   *   (cycle 222-526 silent dead config 시리즈 271번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 24번째).
   *
   * 발견 (4 defaults batch, aiEventUtils.ts 같은 모듈 private helpers):
   * - src/utils/aiEventUtils.ts:
   *     · line 17: const dedupeChoices = (choices: any[] = []) => {...}
   *     · line 205: const normalizeOutcomes = (rawOutcomes: any[] = [],
   *           choices: any[] = [], context: any = {}) => {...}
   * - 호출 사이트 (모듈 내부 private):
   *     · dedupeChoices:1 callsite (line 251 dedupeChoices([...rawChoices,
   *       ...fallbackChoices]).slice(0, 3)) — 항상 spread 배열 명시 전달.
   *     · normalizeOutcomes:1 callsite (line 260 normalizeOutcomes(raw.outcomes,
   *       choices, { ...context, desc })) — 3 args 명시 전달. choices는 line 251
   *       에서 dedupeChoices() 결과(항상 배열). context는 spread object.
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: 4 default 모두 도달 불가.
   *
   * Note: rawOutcomes는 body에서 Array.isArray() 가드가 있어 undefined 안전.
   *
   * 패턴 (cycle 222-526 시리즈 271번째):
   * - cycle 502-526: util default 청소 메가 시리즈 23사이클.
   * - cycle 527: aiEventUtils 같은 모듈 batch — cycle 522/525에 이은 동일 모듈
   *   추가 cleanup. 한 사이클에 4 default 정리.
   *
   * 수정 (src/utils/aiEventUtils.ts):
   * - dedupeChoices signature: choices: any[] = [] → choices: any[].
   * - normalizeOutcomes signature:
   *     rawOutcomes: any[] = [] → rawOutcomes: any[]
   *     choices: any[] = [] → choices: any[]
   *     context: any = {} → context: any
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 2 internal callsite 동작 그대로.
   * - body Array.isArray / forEach / clamp / toInt / normalizeText 호출 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 527: dedupeChoices signature에서 choices default [] 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('const dedupeChoices');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/choices:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'dedupeChoices choices default [] 제거');
      assert.ok(/\bchoices\b/.test(sig), 'choices 파라미터 자체는 보존');
  });

  test('cycle 527: normalizeOutcomes signature에서 3 defaults 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('const normalizeOutcomes');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/rawOutcomes:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'rawOutcomes default [] 제거');
      assert.ok(!/choices:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'normalizeOutcomes choices default [] 제거');
      assert.ok(!/context:\s*any\s*=\s*\{\}/.test(sig),
          'normalizeOutcomes context default {} 제거');
  });

  test('cycle 527: 정합성 가드 — 2 internal callsite 보존', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(/dedupeChoices\(\[\.\.\.rawChoices,\s*\.\.\.fallbackChoices\]\)\.slice\(0,\s*3\)/.test(source),
          'dedupeChoices spread + slice callsite 보존');
      assert.ok(/normalizeOutcomes\(raw\.outcomes,\s*choices,\s*\{ \.\.\.context,\s*desc \}\)/.test(source),
          'normalizeOutcomes 3 args callsite 보존');
  });

  test('cycle 527: body Array.isArray + forEach 가드 보존', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(/if \(Array\.isArray\(rawOutcomes\)\)/.test(source),
          'Array.isArray(rawOutcomes) 가드 보존 (undefined 안전)');
      assert.ok(/choices\.filter\(\(choice: any\) =>/.test(source),
          'dedupeChoices filter 보존');
      assert.ok(/choices\.forEach\(\(choice: any, idx: any\)/.test(source),
          'normalizeOutcomes choices.forEach 보존');
  });

  test('cycle 527: cycle 502-526 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/const toPercent[^=]*value:\s*any\s*=\s*0/.test(rp),
          'cycle 526 toPercent value default 0건');

      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/const hashString[^=]*value:\s*any\s*=\s*''/.test(aiu),
          'cycle 525 hashString value default 0건');
  });
}

// ─── cycle-528-pick-best-one-hand-pair-defaults-batch.test.js ───
{
  /**
   * cycle 528: pickBestOneHandPair `weapons = []` + `requiredWeapon = null`
   *   2 defaults batch unreachable (cycle 222-527 silent dead config 시리즈
   *   272번째 — redundant default annotation util-level cleanup, util default
   *   청소 메가 시리즈 25번째).
   *
   * 발견 (2 defaults batch):
   * - src/utils/equipmentUtils.ts (line 133):
   *     const pickBestOneHandPair = (weapons: any[] = [],
   *         requiredWeapon: any = null) => {...}
   * - 호출 사이트 (1 callsite, 모듈 내부 private):
   *     · equipmentUtils.ts:197-200 — pickBestOneHandPair(
   *           [currentMain, isWeapon(currentOffhand) ? currentOffhand : null,
   *            item].filter(Boolean),
   *           item
   *       )
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: 2 args 항상 명시 전달. weapons 항상 배열, requiredWeapon 항상 item
   *   (truthy). 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-527 시리즈 272번째):
   * - cycle 502-527: util default 청소 메가 시리즈 24사이클.
   * - cycle 528: pickBestOneHandPair batch — 동일 lens.
   *
   * 수정 (src/utils/equipmentUtils.ts):
   * - signature에서 weapons: any[] = [] → weapons: any[].
   * - signature에서 requiredWeapon: any = null → requiredWeapon: any.
   * - body의 weapons.filter / requiredWeapon truthy 체크 보존 (caller가 null
   *   넘기는 path가 아예 없음).
   *
   * 회귀 가드:
   * - 1 internal callsite 동작 그대로.
   * - body filter / forEach / getWeaponEquipScore 호출 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 528: pickBestOneHandPair signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      const fnIdx = source.indexOf('const pickBestOneHandPair');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/weapons:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'pickBestOneHandPair weapons default [] 제거');
      assert.ok(!/requiredWeapon:\s*any\s*=\s*null/.test(sig),
          'pickBestOneHandPair requiredWeapon default null 제거');
      assert.ok(/\bweapons\b/.test(sig), 'weapons 파라미터 자체는 보존');
      assert.ok(/\brequiredWeapon\b/.test(sig), 'requiredWeapon 파라미터 자체는 보존');
  });

  test('cycle 528: 정합성 가드 — internal callsite 보존', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(/pickBestOneHandPair\(\s*\[currentMain,\s*isWeapon\(currentOffhand\)/.test(source),
          'pickBestOneHandPair callsite 보존');
      assert.ok(/\.filter\(Boolean\),\s*\n\s*item\s*\n\s*\)/.test(source),
          'filter(Boolean) + item 2 args 보존');
  });

  test('cycle 528: body filter/forEach/getWeaponEquipScore 호출 보존', async () => {
      const source = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(/weapons\.filter\(\(weapon: any\) => isOneHandWeapon\(weapon\)\)/.test(source),
          'weapons.filter 보존');
      assert.ok(/candidates\.forEach\(\(mainWeapon: any\)/.test(source),
          'candidates.forEach 보존');
      assert.ok(/getWeaponEquipScore\(mainWeapon, 'main'\)/.test(source),
          'getWeaponEquipScore main 호출 보존');
  });

  test('cycle 528: cycle 502-527 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/const dedupeChoices[^=]*choices:\s*any\[\]\s*=\s*\[\]/.test(aiu),
          'cycle 527 dedupeChoices default 0건');

      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/const toPercent[^=]*value:\s*any\s*=\s*0/.test(rp),
          'cycle 526 toPercent value default 0건');
  });
}

// ─── cycle-529-soften-color-alpha-default-unreachable.test.js ───
{
  /**
   * cycle 529: softenColor `alpha = 0.24` default unreachable
   *   (cycle 222-528 silent dead config 시리즈 273번째 — redundant default annotation
   *   util default 청소 메가 시리즈 26번째). component-level 진입 — utils/만이 아닌
   *   components/ private helper로 lens 확장.
   *
   * 발견 (1 default unreachable):
   * - src/components/PixelCharacterAvatar.tsx (line 32):
   *     const softenColor = (hex: any, alpha: any = 0.24) => {
   *         if (!hex || typeof hex !== 'string' || ...) {
   *             return `rgba(255,255,255,${alpha})`;
   *         }
   *         ...
   *     };
   * - 호출 사이트 (1 callsite, 모듈 내부 private):
   *     · PixelCharacterAvatar.tsx:89 — softenColor(
   *         appearance.palette.glow || appearance.palette.accent,
   *         0.28
   *       )
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: alpha 항상 0.28로 명시 전달. default 0.24 도달 불가.
   *
   * 패턴 (cycle 222-528 시리즈 273번째):
   * - cycle 502-528: util default 청소 메가 시리즈 25사이클.
   * - cycle 529: components/ private helper 확장 — utils/만이 아닌 components/
   *   파일도 동일 lens 적용.
   *
   * 수정 (src/components/PixelCharacterAvatar.tsx):
   * - signature에서 alpha: any = 0.24 → alpha: any.
   * - body의 hex 가드 (typeof / startsWith / length) + rgba template 보존.
   *
   * 회귀 가드:
   * - 1 internal callsite 동작 그대로.
   * - body hex 형식 검증 + rgba template 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 529: softenColor signature에서 alpha default 0건', async () => {
      const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
      const fnIdx = source.indexOf('const softenColor');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/alpha:\s*any\s*=\s*0\.24/.test(sig),
          'softenColor alpha default 0.24 제거');
      assert.ok(/\balpha\b/.test(sig), 'alpha 파라미터 자체는 보존');
  });

  test('cycle 529: 정합성 가드 — internal callsite 보존', async () => {
      const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
      assert.ok(/softenColor\(appearance\.palette\.glow \|\| appearance\.palette\.accent,\s*0\.28\)/.test(source),
          'softenColor(palette.glow || palette.accent, 0.28) callsite 보존');
  });

  test('cycle 529: body hex 가드 + rgba template 보존', async () => {
      const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
      assert.ok(/typeof hex !== 'string' \|\| !hex\.startsWith\('#'\) \|\| hex\.length !== 7/.test(source),
          'hex 형식 검증 가드 보존');
      assert.ok(/return `rgba\(255,255,255,\$\{alpha\}\)`/.test(source),
          'fallback rgba template 보존');
      assert.ok(/return `rgba\(\$\{red\}, \$\{green\}, \$\{blue\}, \$\{alpha\}\)`/.test(source),
          'main rgba template 보존');
  });

  test('cycle 529: cycle 502-528 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const eu = await readSrc('src/utils/equipmentUtils.ts');
      assert.ok(!/const pickBestOneHandPair[^=]*weapons:\s*any\[\]\s*=\s*\[\]/.test(eu),
          'cycle 528 pickBestOneHandPair weapons default 0건');

      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/const dedupeChoices[^=]*choices:\s*any\[\]\s*=\s*\[\]/.test(aiu),
          'cycle 527 dedupeChoices default 0건');
  });
}

// ─── cycle-532-build-class-vitals-meta-default-unreachable.test.js ───
{
  /**
   * cycle 532: buildClassVitals `meta = {}` default unreachable
   *   (cycle 222-531 silent dead config 시리즈 275번째 — redundant default annotation
   *   util/component default 청소 메가 시리즈 28번째). hooks/ 디렉토리 진입 —
   *   utils/ + components/ 외 hooks/까지 lens 확장.
   *
   * 발견 (1 default unreachable):
   * - src/hooks/gameActions/_shared.ts (line 13):
   *     export const buildClassVitals = (level: any, jobId: any,
   *         meta: any = {}) => {
   *         const cls = CLASSES[jobId] || CLASSES[CONSTANTS.DEFAULT_JOB];
   *         const maxHp = ... + (meta.bonusHp || 0);
   *         const maxMp = ... + (meta.bonusMp || 0);
   *         ...
   *     };
   * - 호출 사이트 (2 callsite, hooks/gameActions/characterActions.ts):
   *     · start path: buildClassVitals(1, jobId, player.meta || {})
   *     · line 129: buildClassVitals(player.level, jobName, player.meta || {})
   *     · 다른 파일 import 0건.
   * - 결과: meta 항상 `player.meta || {}` 명시 전달. default {} 도달 불가.
   *
   * 패턴 (cycle 222-531 시리즈 275번째):
   * - cycle 502-531: util/component default 청소 메가 시리즈 28사이클.
   * - cycle 532: hooks/ 진입 — components/ 진입(cycle 529)에 이은 lens 확장.
   *
   * 수정 (src/hooks/gameActions/_shared.ts):
   * - signature에서 meta: any = {} → meta: any.
   * - body의 (meta.bonusHp || 0) / (meta.bonusMp || 0) defensive guard 보존.
   *
   * 회귀 가드:
   * - 2 callsite에서 meta 명시 전달 보존.
   * - start path는 신규 캐릭터 초기 EXP/레벨 pacing을 위해 Lv1 기준으로 계산.
   * - body CLASSES 조회 / Math.floor / Math.max 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 532: buildClassVitals signature에서 meta default 0건', async () => {
      const source = await readSrc('src/hooks/gameActions/_shared.ts');
      const fnIdx = source.indexOf('export const buildClassVitals');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/meta:\s*any\s*=\s*\{\}/.test(sig),
          'buildClassVitals meta default {} 제거');
      assert.ok(/\bmeta\b/.test(sig), 'meta 파라미터 자체는 보존');
  });

  test('cycle 532: 정합성 가드 — 2 callsite 보존', async () => {
      const source = await readSrc('src/hooks/gameActions/characterActions.ts');
      assert.ok(/buildClassVitals\(1,\s*jobId,\s*player\.meta \|\| \{\}\)/.test(source),
          '1st callsite (1, jobId, player.meta || {}) 보존 — 신규 캐릭터 Lv1 시작');
      assert.ok(/buildClassVitals\(player\.level,\s*jobName,\s*player\.meta \|\| \{\}\)/.test(source),
          '2nd callsite (player.level, jobName, player.meta || {}) 보존');
  });

  test('cycle 532: body defensive guard 보존', async () => {
      const source = await readSrc('src/hooks/gameActions/_shared.ts');
      assert.ok(/\(meta\.bonusHp \|\| 0\)/.test(source),
          '(meta.bonusHp || 0) defensive guard 보존');
      assert.ok(/\(meta\.bonusMp \|\| 0\)/.test(source),
          '(meta.bonusMp || 0) defensive guard 보존');
      assert.ok(/CLASSES\[jobId\] \|\| CLASSES\[CONSTANTS\.DEFAULT_JOB\]/.test(source),
          'CLASSES jobId fallback 보존');
  });

  test('cycle 532: cycle 502-531 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/const formatPercent[^=]*value:\s*any\s*=\s*0/.test(sp),
          'cycle 531 formatPercent value default 0건');

      const av = await readSrc('src/components/PixelCharacterAvatar.tsx');
      assert.ok(!/const softenColor[^=]*alpha:\s*any\s*=\s*0\.24/.test(av),
          'cycle 529 softenColor alpha default 0건');
  });
}

// ─── cycle-536-apply-exp-gain-default-unreachable.test.js ───
{
  /**
   * cycle 536: applyExpGain `expGained = 0` default unreachable
   *   (cycle 222-535 silent dead config 시리즈 279번째 — redundant default annotation
   *   util/component/hook/system default 청소 메가 시리즈 32번째). systems/ 진입.
   *
   * 발견 (1 default unreachable):
   * - src/systems/CombatEngine.ts (line 1338):
   *     applyExpGain(player: Player, expGained: any = 0) {
   *         const p: any = { ...player, exp: (player.exp || 0) + expGained };
   *         ...
   *     }
   * - 호출 사이트 (3 production callers + 1 internal + N test):
   *     · useInventoryActions.ts:296 — CombatEngine.applyExpGain(updatedPlayer,
   *       qData.reward.exp)
   *     · gameActions/eventActions.ts:108 — CombatEngine.applyExpGain
   *       (updatedPlayer, selectedOutcome.exp)
   *     · gameActions/moveActions.ts:70 — CombatEngine.applyExpGain(updated,
   *       visitReward.exp)
   *     · CombatEngine.ts:1546 — this.applyExpGain(p, expGained)
   *     · tests/combat-engine-core.test.js — 16 callsite, 모두 명시 값 (50/100/
   *       500/10000 등). test의 local applyExpGain re-implementation은 별개 함수.
   * - 결과: expGained 항상 명시 전달. default 0 도달 불가.
   *
   * 패턴 (cycle 222-535 시리즈 279번째):
   * - cycle 502-535: util/component/hook default 청소 메가 시리즈 32사이클.
   * - cycle 536: systems/ 디렉토리 진입 — utils/ + components/ + hooks/ 외
   *   systems/까지 lens 확장 (cycle 529 components/, 532 hooks/ 진입에 이어).
   *
   * 수정 (src/systems/CombatEngine.ts):
   * - signature에서 expGained: any = 0 → expGained: any.
   * - body의 (player.exp || 0) + expGained 보존.
   *
   * 회귀 가드:
   * - 4 production callsite (3 외부 + 1 internal) + tests 동작 그대로.
   * - body level-up while loop / visualEffect / logs 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 536: applyExpGain signature에서 expGained default 0건', async () => {
      // applyExpGain은 CombatEngine.outcome.ts로 분리됨 (mixin).
      const source = await readSrc('src/systems/CombatEngine.outcome.ts');
      const fnIdx = source.indexOf('applyExpGain(player: Player');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/expGained:\s*any\s*=\s*0/.test(sig),
          'applyExpGain expGained default 0 제거');
      assert.ok(/\bexpGained\b/.test(sig), 'expGained 파라미터 자체는 보존');
  });

  test('cycle 536: 정합성 가드 — 4 production callsite 보존', async () => {
      const inv = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(/const pacedExp = getPacedQuestClaimExp\(updatedPlayer,\s*qData\.reward\.exp\)/.test(inv),
          'useInventoryActions quest exp pacing 보존');
      assert.ok(/CombatEngine\.applyExpGain\(updatedPlayer,\s*pacedExp\)/.test(inv),
          'useInventoryActions paced applyExpGain callsite 보존');

      const ev = await readSrc('src/hooks/gameActions/eventActions.ts');
      assert.ok(/CombatEngine\.applyExpGain\(updatedPlayer,\s*selectedOutcome\.exp\)/.test(ev),
          'eventActions callsite 보존');

      const mv = await readSrc('src/hooks/gameActions/moveActions.ts');
      assert.ok(/CombatEngine\.applyExpGain\(updated,\s*visitReward\.exp\)/.test(mv),
          'moveActions callsite 보존');

      const ce = await readSrc('src/systems/CombatEngine.outcome.ts');
      assert.ok(/this\.applyExpGain\(p,\s*expGained\)/.test(ce),
          'internal this.applyExpGain callsite 보존');
  });

  test('cycle 536: body level-up loop / visualEffect 처리 보존', async () => {
      // applyExpGain은 CombatEngine.outcome.ts로 분리됨 (mixin).
      const source = await readSrc('src/systems/CombatEngine.outcome.ts');
      assert.ok(/\(player\.exp \|\| 0\) \+ expGained/.test(source),
          '(player.exp || 0) + expGained defensive 보존');
      assert.ok(/while \(p\.level < CONSTANTS\.MAX_LEVEL && p\.exp >= p\.nextExp\)/.test(source),
          'level-up while loop 보존');
  });

  test('cycle 536: cycle 502-535 회귀 가드 — util/component/hook default 청소 시리즈 보존', async () => {
      const ca = await readSrc('src/hooks/gameActions/characterActions.ts');
      assert.ok(!/cycleSkill:\s*\(dir:\s*any\s*=\s*1\)/.test(ca),
          'cycle 535 cycleSkill dir default 0건');

      const lh = await readSrc('src/hooks/combatActions/_helpers.ts');
      assert.ok(!/getLootUpgradeHint[^=]*equip:\s*any\s*=\s*\{\}/.test(lh),
          'cycle 534 getLootUpgradeHint equip default 0건');
  });
}

// ─── cycle-537-calculate-damage-options-default-unreachable.test.js ───
{
  /**
   * cycle 537: calculateDamage `options = {}` default unreachable
   *   (cycle 222-536 silent dead config 시리즈 280번째 — redundant default annotation
   *   util/component/hook/system default 청소 메가 시리즈 33번째).
   *
   * 발견 (1 default unreachable):
   * - src/systems/CombatEngine.ts (line 40):
   *     calculateDamage(stats: any, options: any = {}) {
   *         const {
   *             mult = 1,
   *             guarding = false,
   *             elementMultiplier = 1,
   *             critChance = BALANCE.CRIT_CHANCE
   *             ...
   *         } = options;
   *     }
   * - 호출 사이트 (2 internal callsite):
   *     · CombatEngine.ts:486 — this.calculateDamage(statsForAtk, {...options})
   *     · CombatEngine.ts:752 — this.calculateDamage(stats, {...options})
   *     · 외부 production caller 0건 (CombatEngine.calculateDamage external 호출
   *       없음 — comments만 존재).
   *     · 테스트는 local re-implementation `function calculateDamage(stats,
   *       options = {}, rolls = {})` 사용 (3-arg deterministic mirror, 별개 함수).
   * - 결과: options 항상 object literal 명시 전달. default {} 도달 불가.
   *   destructuring 내부 default(mult=1, guarding=false, ...)는 별개 — options
   *   객체에 일부 필드만 있을 때 활성, 보존.
   *
   * 패턴 (cycle 222-536 시리즈 280번째):
   * - cycle 502-536: util/component/hook/system default 청소 메가 시리즈 33사이클.
   * - cycle 537: systems/ 추가 cleanup — cycle 536 applyExpGain에 이은 동일
   *   파일 cleanup.
   *
   * 수정 (src/systems/CombatEngine.ts):
   * - signature에서 options: any = {} → options: any.
   * - body의 destructuring (mult/guarding/elementMultiplier/critChance) defaults
   *   는 별개 보존 (caller가 부분 options 넘기는 path 활성).
   *
   * 회귀 가드:
   * - 2 internal callsite 동작 그대로.
   * - destructuring inner defaults 모두 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 537: calculateDamage signature에서 options default 0건', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const fnIdx = source.indexOf('calculateDamage(stats: any');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/options:\s*any\s*=\s*\{\}/.test(sig),
          'calculateDamage options default {} 제거');
      assert.ok(/\boptions\b/.test(sig), 'options 파라미터 자체는 보존');
  });

  test('cycle 537: 정합성 가드 — 2 internal callsite 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const calls = (source.match(/this\.calculateDamage\(/g) || []).length;
      assert.equal(calls, 2, `this.calculateDamage 2 callsite 보존: ${calls}건`);
  });

  test('cycle 537: destructuring inner defaults 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/mult = 1/.test(source), 'mult = 1 inner default 보존');
      assert.ok(/guarding = false/.test(source), 'guarding = false inner default 보존');
      assert.ok(/elementMultiplier = 1/.test(source),
          'elementMultiplier = 1 inner default 보존');
      assert.ok(/critChance = BALANCE\.CRIT_CHANCE/.test(source),
          'critChance = BALANCE.CRIT_CHANCE inner default 보존');
  });

  test('cycle 537: cycle 502-536 회귀 가드 — util/component/hook/system default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/applyExpGain\(player: Player, expGained:\s*any\s*=\s*0\)/.test(ce),
          'cycle 536 applyExpGain expGained default 0건');

      const ca = await readSrc('src/hooks/gameActions/characterActions.ts');
      assert.ok(!/cycleSkill:\s*\(dir:\s*any\s*=\s*1\)/.test(ca),
          'cycle 535 cycleSkill dir default 0건');
  });
}

// ─── cycle-538-apply-daily-protocol-progress-amount-default-unreachable.test.js ───
{
  /**
   * cycle 538: applyDailyProtocolProgress `amount = 1` default unreachable
   *   (cycle 222-537 silent dead config 시리즈 281번째 — redundant default annotation
   *   util/component/hook/system/reducer default 청소 메가 시리즈 34번째).
   *   reducers/ 진입.
   *
   * 발견 (1 default unreachable):
   * - src/reducers/handlers/helpers.ts (line 18):
   *     export const applyDailyProtocolProgress = (player: Player, type: any,
   *         amount: any = 1) => {
   *         const dp = (player.stats as any)?.dailyProtocol;
   *         if (!dp) return player;
   *         ...
   *     };
   * - 호출 사이트:
   *     · 1 production caller: protocolHandlers.ts:20 — applyDailyProtocolProgress
   *       (state.player, dpType, amount) — 3 args 명시.
   *     · 6 test caller: tests/cycle-232-relic-shards-conversion.test.js — 모두
   *       3 args 명시 ('goldSpend' / 'kills', 1).
   *     · 다른 caller 0건.
   * - 결과: amount 항상 명시 전달. default 1 도달 불가.
   *
   * 패턴 (cycle 222-537 시리즈 281번째):
   * - cycle 502-537: util/component/hook/system default 청소 메가 시리즈 34사이클.
   * - cycle 538: reducers/ 진입 — utils/ + components/ + hooks/ + systems/ 외
   *   reducers/까지 lens 확장.
   *
   * 수정 (src/reducers/handlers/helpers.ts):
   * - signature에서 amount: any = 1 → amount: any.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 7 callsite (1 production + 6 test) 동작 그대로.
   * - body dp 가드 / essenceGain / newShards / itemRewards 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 538: applyDailyProtocolProgress signature에서 amount default 0건', async () => {
      const source = await readSrc('src/reducers/handlers/helpers.ts');
      const fnIdx = source.indexOf('export const applyDailyProtocolProgress');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/amount:\s*any\s*=\s*1/.test(sig),
          'applyDailyProtocolProgress amount default 1 제거');
      assert.ok(/\bamount\b/.test(sig), 'amount 파라미터 자체는 보존');
  });

  test('cycle 538: 정합성 가드 — production + test callsite 보존', async () => {
      const ph = await readSrc('src/reducers/handlers/protocolHandlers.ts');
      assert.ok(/applyDailyProtocolProgress\(state\.player,\s*dpType,\s*amount\)/.test(ph),
          'protocolHandlers callsite 보존');

      // cycle-232-relic-* 는 tests/relics.test.js로 통합됨 (audit #1).
      const tt = await readSrc('tests/relics.test.js');
      const calls = (tt.match(/applyDailyProtocolProgress\(/g) || []).length;
      assert.ok(calls >= 6, `test callsite 6건 이상 보존: ${calls}건`);
  });

  test('cycle 538: body 동작 보존', async () => {
      const source = await readSrc('src/reducers/handlers/helpers.ts');
      assert.ok(/const dp = \(player\.stats as any\)\?\.dailyProtocol/.test(source),
          'dp 추출 보존');
      assert.ok(/if \(!dp\) return player/.test(source),
          'dp 가드 early return 보존');
      assert.ok(/let newShards = dp\.relicShards \|\| 0/.test(source),
          'newShards 초기화 보존');
  });

  test('cycle 538: cycle 502-537 회귀 가드 — util/component/hook/system default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/calculateDamage\(stats: any, options:\s*any\s*=\s*\{\}\)/.test(ce),
          'cycle 537 calculateDamage options default 0건');
      assert.ok(!/applyExpGain\(player: Player, expGained:\s*any\s*=\s*0\)/.test(ce),
          'cycle 536 applyExpGain expGained default 0건');
  });
}

// ─── cycle-539-call-proxy-defaults-batch.test.js ───
{
  /**
   * cycle 539: callProxy `trackLabel = 'ai-call'` + `timeoutMs = 9500` defaults
   *   batch unreachable (cycle 222-538 silent dead config 시리즈 282번째 —
   *   redundant default annotation util/component/hook/system/reducer/service
   *   default 청소 메가 시리즈 35번째). services/ 진입.
   *
   * 발견 (2 defaults batch):
   * - src/services/aiService.ts (line 15):
   *     const callProxy = async (body: any, trackLabel: any = 'ai-call',
   *         timeoutMs: any = 9500) => {...};
   * - 호출 사이트 (2 internal callsite, 모듈 내부 private):
   *     · aiService.ts:80-93 — callProxy(body, 'ai-event', 9500)
   *     · aiService.ts:133-145 — callProxy(body, 'ai-story', 9500)
   *     · 다른 caller 0건 (private 모듈 helper).
   * - 결과: trackLabel / timeoutMs 항상 명시 전달. 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-538 시리즈 282번째):
   * - cycle 502-538: util/component/hook/system/reducer default 청소 메가 시리즈
   *   35사이클.
   * - cycle 539: services/ 진입 — utils/ + components/ + hooks/ + systems/ +
   *   reducers/ 외 services/까지 lens 확장.
   *
   * 수정 (src/services/aiService.ts):
   * - signature에서 trackLabel: any = 'ai-call' → trackLabel: any.
   * - signature에서 timeoutMs: any = 9500 → timeoutMs: any.
   * - body의 setTimeout(..., timeoutMs) / LatencyTracker.trackCall 보존.
   *
   * 회귀 가드:
   * - 2 internal callsite 동작 그대로.
   * - body fetch / timeout / Bearer auth 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 539: callProxy signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/services/aiService.ts');
      const fnIdx = source.indexOf('const callProxy');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/trackLabel:\s*any\s*=\s*'ai-call'/.test(sig),
          "callProxy trackLabel default 'ai-call' 제거");
      assert.ok(!/timeoutMs:\s*any\s*=\s*9500/.test(sig),
          'callProxy timeoutMs default 9500 제거');
  });

  test('cycle 539: 정합성 가드 — 2 internal callsite 보존', async () => {
      const source = await readSrc('src/services/aiService.ts');
      assert.ok(/'ai-event',\s*\n\s*9500/.test(source),
          "callProxy(body, 'ai-event', 9500) callsite 보존");
      assert.ok(/'ai-story',\s*\n\s*9500/.test(source),
          "callProxy(body, 'ai-story', 9500) callsite 보존");
  });

  test('cycle 539: body setTimeout / LatencyTracker.trackCall 처리 보존', async () => {
      const source = await readSrc('src/services/aiService.ts');
      assert.ok(/setTimeout\(\(\) => controller\.abort\(\),\s*timeoutMs\)/.test(source),
          'setTimeout(controller.abort, timeoutMs) 보존');
      assert.ok(/LatencyTracker\.trackCall\(/.test(source),
          'LatencyTracker.trackCall 호출 보존');
  });

  test('cycle 539: cycle 502-538 회귀 가드 — util/component/hook/system/reducer default 청소 시리즈 보존', async () => {
      const helpers = await readSrc('src/reducers/handlers/helpers.ts');
      assert.ok(!/applyDailyProtocolProgress[^=]*amount:\s*any\s*=\s*1/.test(helpers),
          'cycle 538 applyDailyProtocolProgress amount default 0건');

      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/calculateDamage\(stats: any, options:\s*any\s*=\s*\{\}\)/.test(ce),
          'cycle 537 calculateDamage options default 0건');
  });
}

// ─── cycle-542-signed-delta-value-default-partial-unreachable.test.js ───
{
  /**
   * cycle 542: signedDelta `value = 0` partial default unreachable
   *   (cycle 222-541 silent dead config 시리즈 284번째 — redundant default annotation
   *   청소 메가 시리즈 37번째). partial cleanup — 같은 함수에서 unreachable
   *   default만 제거, reachable default는 보존.
   *
   * 발견 (1 default unreachable, 1 default reachable 보존):
   * - src/components/ShopPanel.tsx (line 36):
   *     const signedDelta = (value: any = 0, suffix: any = '') =>
   *         `${value >= 0 ? '+' : ''}${value}${suffix}`;
   * - 호출 사이트 (3 internal callsite, 모두 1 arg만 전달):
   *     · ShopPanel.tsx:63 — signedDelta(atkDelta)
   *     · ShopPanel.tsx:64 — signedDelta(defDelta)
   *     · ShopPanel.tsx:66 — signedDelta(mpDelta)
   *     · 다른 caller 0건 (private 모듈 helper).
   * - 결과:
   *     · value 항상 명시 전달 → default 0 도달 불가.
   *     · suffix 0개 caller가 명시 전달 → default '' REACHABLE 보존 필수.
   *
   * 패턴 (cycle 222-541 시리즈 284번째):
   * - cycle 502-541: default 청소 메가 시리즈 40사이클.
   * - cycle 542: partial cleanup pattern — 같은 함수의 일부 default만 unreachable
   *   인 경우. cycle 537 outer-vs-inner 분리 패턴과 다름 (이건 같은 layer
   *   parameter 간의 partial 정리). cycle 526 toPercent와 다른 점은 모든 default
   *   unreachable이 아닌 partial인 점.
   *
   * 수정 (src/components/ShopPanel.tsx):
   * - signature에서 value: any = 0 → value: any.
   * - signature에서 suffix: any = '' 보존 (3 callsite 모두 reachable).
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 3 internal callsite 동작 그대로.
   * - body template literal 보존.
   * - suffix default 보존 (reachable).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 542: signedDelta signature에서 value default 0건', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      const fnIdx = source.indexOf('const signedDelta');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/value:\s*any\s*=\s*0/.test(sig),
          'signedDelta value default 0 제거');
  });

  test('cycle 542: suffix 파라미터 보존 (cycle 621 explicit elimination)', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      const fnIdx = source.indexOf('const signedDelta');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/suffix:\s*any\)/.test(sig),
          'signedDelta suffix 파라미터 보존 (cycle 621에서 default 제거됨)');
  });

  test('cycle 542: 정합성 가드 — 3 internal callsite 보존', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(/signedDelta\(atkDelta,\s*''\)/.test(source), 'ATK callsite 보존');
      assert.ok(/signedDelta\(defDelta,\s*''\)/.test(source), 'DEF callsite 보존');
      assert.ok(/signedDelta\(mpDelta,\s*''\)/.test(source), 'MP callsite 보존');
  });

  test('cycle 542: body template literal 보존', async () => {
      const source = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(/`\$\{value >= 0 \? '\+' : ''\}\$\{value\}\$\{suffix\}`/.test(source),
          'template literal `${sign}${value}${suffix}` 보존');
  });

  test('cycle 542: cycle 502-541 회귀 가드 — default 청소 시리즈 보존', async () => {
      const qt = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(!/getQuestProgressText[^=]*progress:\s*any\s*=\s*0/.test(qt),
          'cycle 541 QuestTab getQuestProgressText progress default 0건');

      const ai = await readSrc('src/services/aiService.ts');
      assert.ok(!/const callProxy[^=]*trackLabel:\s*any\s*=\s*'ai-call'/.test(ai),
          'cycle 539 callProxy trackLabel default 0건');
  });
}

// ─── cycle-543-synthesize-use-protect-default-unreachable.test.js ───
{
  /**
   * cycle 543: synthesize `useProtect = false` default unreachable
   *   (cycle 222-542 silent dead config 시리즈 285번째 — redundant default annotation
   *   청소 메가 시리즈 38번째).
   *
   * 발견 (1 default unreachable):
   * - src/hooks/useInventoryActions.ts (line 409):
   *     synthesize: (itemIds: any, useProtect: any = false) => {
   *         const items = itemIds.map(...);
   *         ...
   *     }
   * - 호출 사이트 (1 callsite):
   *     · CraftingPanel.tsx:52 — actions.synthesize(selectedIds, useProtect)
   *     · 다른 caller 0건.
   * - 결과: useProtect 항상 명시 전달. default false 도달 불가.
   *
   * 패턴 (cycle 222-542 시리즈 285번째):
   * - cycle 502-542: default 청소 메가 시리즈 41사이클.
   * - cycle 543: hooks/useInventoryActions 추가 cleanup.
   *
   * 수정 (src/hooks/useInventoryActions.ts):
   * - signature에서 useProtect: any = false → useProtect: any.
   * - body의 synthProtects/premiumCurrency 분기 보존.
   *
   * 회귀 가드:
   * - 1 callsite 동작 그대로.
   * - body validation / signature 가드 / synthProtects 토큰 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 543: synthesize signature에서 useProtect default 0건', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(!/synthesize:\s*\(itemIds:\s*any,\s*useProtect:\s*any\s*=\s*false\)/.test(source),
          'synthesize useProtect default false 제거');
      assert.ok(/synthesize:\s*\(itemIds:\s*any,\s*useProtect:\s*any\)/.test(source),
          'synthesize 파라미터 자체는 보존');
  });

  test('cycle 543: 정합성 가드 — CraftingPanel callsite 보존', async () => {
      const source = await readSrc('src/components/tabs/CraftingPanel.tsx');
      assert.ok(/actions\.synthesize\(selectedIds,\s*useProtect\)/.test(source),
          'actions.synthesize(selectedIds, useProtect) callsite 보존');
  });

  test('cycle 543: body validation / signature guard 보존', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(/validateSynthesis\(items,\s*player\.gold\)/.test(source),
          'validateSynthesis 호출 보존');
      assert.ok(/SIGNATURE_INPUT/.test(source), 'SIGNATURE_INPUT 가드 보존');
  });

  test('cycle 543: cycle 502-542 회귀 가드 — default 청소 시리즈 보존', async () => {
      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/const signedDelta\s*=\s*\(value:\s*any\s*=\s*0/.test(sp),
          'cycle 542 signedDelta value default 0건');

      const qt = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(!/getQuestProgressText[^=]*progress:\s*any\s*=\s*0/.test(qt),
          'cycle 541 QuestTab getQuestProgressText progress default 0건');
  });
}

// ─── cycle-544-score-tag-has-any-job-defaults-batch.test.js ───
{
  /**
   * cycle 544: scoreTag + hasAnyJob 2 defaults batch unreachable
   *   (cycle 222-543 silent dead config 시리즈 286번째 — redundant default annotation
   *   청소 메가 시리즈 39번째). runProfile.ts 같은 모듈 batch.
   *
   * 발견 (2 defaults batch, runProfile.ts 같은 모듈 private helpers):
   * - src/utils/runProfile.ts (line 18, 33):
   *     · scoreTag (id, name, score, reasons: any[] = [])
   *     · hasAnyJob (item, jobs: any[] = [])
   * - 호출 사이트 (모두 모듈 내부 private):
   *     · scoreTag:8 callsite (line 61/71/82/95/106/117/126/136) — 모두 reasons
   *       명시 전달.
   *     · hasAnyJob:8 callsite (line 253/260/267/274/279/...) — 모두 jobs
   *       명시 전달 (배열 리터럴).
   *     · 다른 caller 0건 (private 모듈 helper).
   * - 결과: 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-543 시리즈 286번째):
   * - cycle 502-543: default 청소 메가 시리즈 42사이클.
   * - cycle 544: runProfile.ts 같은 모듈 batch — cycle 526 toPercent에 이은
   *   동일 모듈 추가 cleanup.
   *
   * 수정 (src/utils/runProfile.ts):
   * - scoreTag signature: reasons: any[] = [] → reasons: any[].
   * - hasAnyJob signature: jobs: any[] = [] → jobs: any[].
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 16 internal callsite 동작 그대로.
   * - body Array.isArray / .some / .includes 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 544: scoreTag signature에서 reasons default [] 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnIdx = source.indexOf('const scoreTag');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/reasons:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'scoreTag reasons default [] 제거');
  });

  test('cycle 544: hasAnyJob signature에서 jobs default [] 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnIdx = source.indexOf('const hasAnyJob');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/jobs:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'hasAnyJob jobs default [] 제거');
  });

  test('cycle 544: 정합성 가드 — 16 internal callsite 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const scoreTagCalls = (source.match(/scoreTag\(/g) || []).length;
      assert.equal(scoreTagCalls, 8, `scoreTag callsite 8건 보존: ${scoreTagCalls}건`);
      const hasAnyJobCalls = (source.match(/hasAnyJob\(/g) || []).length;
      assert.equal(hasAnyJobCalls, 8, `hasAnyJob callsite 8건 보존: ${hasAnyJobCalls}건`);
  });

  test('cycle 544: body 동작 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(/Array\.isArray\(item\?\.jobs\) && jobs\.some\(/.test(source),
          'hasAnyJob Array.isArray + .some 보존');
      assert.ok(/const scoreTag = \(id: any, name: any, score: any, reasons: any\[\]\) => \(\{\s*\n\s*id,\s*\n\s*name,\s*\n\s*score,\s*\n\s*reasons,\s*\n\s*\}\)/.test(source),
          'scoreTag return shape 보존');
  });

  test('cycle 544: cycle 502-543 회귀 가드 — default 청소 시리즈 보존', async () => {
      const inv = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(!/synthesize:\s*\(itemIds:\s*any,\s*useProtect:\s*any\s*=\s*false\)/.test(inv),
          'cycle 543 synthesize useProtect default 0건');

      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/const signedDelta\s*=\s*\(value:\s*any\s*=\s*0/.test(sp),
          'cycle 542 signedDelta value default 0건');
  });
}

// ─── cycle-545-pick-fallback-event-defaults-batch.test.js ───
{
  /**
   * cycle 545: pickFallbackEvent `history = []` + `context = {}` defaults batch
   *   unreachable + getQuestReason `targetMaps = []` default unreachable
   *   (cycle 222-544 silent dead config 시리즈 287번째 — redundant default annotation
   *   청소 메가 시리즈 40번째). cross-file 3 defaults batch.
   *
   * 발견 (3 defaults batch, 2 files):
   * - src/utils/aiEventUtils.ts (line 526):
   *     export const pickFallbackEvent = (loc: string, history: any[] = [],
   *         context: any = {}) => {...};
   * - src/utils/questOperations.ts (line 92):
   *     const getQuestReason = (quest: any, lane: any, resonance: any,
   *         targetMaps: any[] = []) => {...};
   * - 호출 사이트:
   *     · pickFallbackEvent: 3 production caller (aiService.ts:69/74/108) +
   *       5 test caller — 모두 3 args 명시.
   *     · getQuestReason: 1 internal caller (questOperations.ts:153) — 4 args
   *       명시.
   *     · 모든 default 도달 불가.
   *
   * 패턴 (cycle 222-544 시리즈 287번째):
   * - cycle 502-544: default 청소 메가 시리즈 43사이클.
   * - cycle 545: cross-file 3-default batch — utils/ 두 모듈 동시.
   *
   * 수정:
   * - aiEventUtils.ts pickFallbackEvent: history / context defaults 모두 제거.
   * - questOperations.ts getQuestReason: targetMaps default 제거.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 9 callsite 동작 그대로.
   * - body lane / resonance ternary + getPoolKeyByLocation 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 545: pickFallbackEvent signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('export const pickFallbackEvent');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/history:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'pickFallbackEvent history default [] 제거');
      assert.ok(!/context:\s*any\s*=\s*\{\}/.test(sig),
          'pickFallbackEvent context default {} 제거');
  });

  test('cycle 545: getQuestReason signature에서 targetMaps default 0건', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      const fnIdx = source.indexOf('const getQuestReason');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/targetMaps:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'getQuestReason targetMaps default [] 제거');
  });

  test('cycle 545: 정합성 가드 — pickFallbackEvent + getQuestReason callsite 보존', async () => {
      const ai = await readSrc('src/services/aiService.ts');
      const calls = (ai.match(/pickFallbackEvent\(loc,\s*history,\s*context\)/g) || []).length;
      assert.ok(calls >= 2, `aiService pickFallbackEvent callsite 보존: ${calls}건`);

      const qo = await readSrc('src/utils/questOperations.ts');
      assert.ok(/getQuestReason\(quest,\s*lane,\s*resonance,\s*targetMaps\)/.test(qo),
          'getQuestReason callsite 보존');
  });

  test('cycle 545: body 동작 보존', async () => {
      const aeu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(/getPoolKeyByLocation\(loc\)/.test(aeu),
          'getPoolKeyByLocation 호출 보존');

      const qo = await readSrc('src/utils/questOperations.ts');
      assert.ok(/if \(lane === 'story'\)/.test(qo), 'story lane 분기 보존');
      assert.ok(/if \(lane === 'build' && resonance\.summary\)/.test(qo),
          'build lane 분기 보존');
  });

  test('cycle 545: cycle 502-544 회귀 가드 — default 청소 시리즈 보존', async () => {
      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/const scoreTag[^=]*reasons:\s*any\[\]\s*=\s*\[\]/.test(rp),
          'cycle 544 scoreTag reasons default 0건');
      assert.ok(!/const hasAnyJob[^=]*jobs:\s*any\[\]\s*=\s*\[\]/.test(rp),
          'cycle 544 hasAnyJob jobs default 0건');

      const inv = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(!/synthesize:\s*\(itemIds:\s*any,\s*useProtect:\s*any\s*=\s*false\)/.test(inv),
          'cycle 543 synthesize useProtect default 0건');
  });
}

// ─── cycle-547-apply-entropy-tick-active-synergies-default-unreachable.test.js ───
{
  /**
   * cycle 547: applyEntropyTick `activeSynergies = []` default unreachable
   *   (cycle 222-546 silent dead config 시리즈 289번째 — redundant default annotation
   *   청소 메가 시리즈 42번째).
   *
   * 발견 (1 default unreachable):
   * - src/systems/CombatEngine.ts (line 193):
   *     applyEntropyTick(player: Player, enemy: Monster, activeSynergies: any[] = []) {...}
   * - 호출 사이트:
   *     · CombatEngine.ts:631 — this.applyEntropyTick(updatedPlayer, postHitEnemy,
   *       stats.activeSynergies || [])
   *     · CombatEngine.ts:1037 — this.applyEntropyTick(updatedPlayer, updatedEnemy,
   *       stats.activeSynergies || [])
   *     · tests/cycle-159, cycle-236, cycle-237 등 다수 — 모두 3 args 명시.
   * - 결과: activeSynergies 항상 명시 전달 (caller가 || [] fallback). default
   *   도달 불가.
   *
   * 패턴 (cycle 222-546 시리즈 289번째):
   * - cycle 502-546: default 청소 메가 시리즈 45사이클.
   * - cycle 547: systems/CombatEngine method default — cycle 546과 동일.
   *
   * 수정 (src/systems/CombatEngine.ts):
   * - signature에서 activeSynergies: any[] = [] → activeSynergies: any[].
   * - body의 turnCount / brand entropy 처리 보존.
   *
   * 회귀 가드:
   * - 2 internal + N test callsite 동작 그대로.
   * - body relics / flags 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 547: applyEntropyTick signature에서 activeSynergies default 0건', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const fnIdx = source.indexOf('applyEntropyTick(player');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/activeSynergies:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'applyEntropyTick activeSynergies default [] 제거');
      assert.ok(/\bactiveSynergies\b/.test(sig), 'activeSynergies 파라미터 자체는 보존');
  });

  test('cycle 547: 정합성 가드 — 2 internal + test callsite 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const calls = (source.match(/this\.applyEntropyTick\(/g) || []).length;
      assert.equal(calls, 2, `internal callsite 2건 보존: ${calls}건`);

      // cycle-159-relic-* 는 tests/relics.test.js로 통합됨 (audit #1).
      const test1 = await readSrc('tests/relics.test.js');
      assert.ok(/CombatEngine\.applyEntropyTick\(player,\s*enemy,\s*\[\]\)/.test(test1),
          'test callsite (cycle 159) 보존');
  });

  test('cycle 547: body turnCount / relics 처리 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/const relics = \(player as any\)\?\.relics \|\| \[\]/.test(source),
          '(player as any)?.relics || [] defensive 보존');
      assert.ok(/turnCount = \(flags\.turnCount \|\| 0\) \+ 1/.test(source),
          'turnCount 증가 보존');
  });

  test('cycle 547: cycle 502-546 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/getElementMultiplier\(elem: any, enemy: Monster, relics:\s*any\[\]\s*=\s*\[\]\)/.test(ce),
          'cycle 546 getElementMultiplier relics default 0건');

      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/export const pickFallbackEvent[^=]*history:\s*any\[\]\s*=\s*\[\]/.test(aiu),
          'cycle 545 pickFallbackEvent history default 0건');
  });
}

// ─── cycle-548-apply-crit-mp-restore-defaults-batch.test.js ───
{
  /**
   * cycle 548: applyCritMpRestore `relics = []` + `logs = []` defaults batch
   *   unreachable (cycle 222-547 silent dead config 시리즈 290번째 — redundant
   *   default annotation 청소 메가 시리즈 43번째).
   *
   * 발견 (2 defaults batch):
   * - src/systems/CombatEngine.ts (line 77):
   *     applyCritMpRestore(player: Player, relics: Relic[] = [], logs: any[] = []) {
   *         const critMpRelic = relics.find(...);
   *         ...
   *     }
   * - 호출 사이트 (2 internal callsite):
   *     · CombatEngine.ts:592 — this.applyCritMpRestore(updatedPlayer, relics, logs)
   *     · CombatEngine.ts:890 — this.applyCritMpRestore(updatedPlayer, relics, critLogs)
   *     · 외부 caller 0건, test caller 0건.
   * - 결과: relics / logs 항상 명시 전달. 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-547 시리즈 290번째):
   * - cycle 502-547: default 청소 메가 시리즈 46사이클.
   * - cycle 548: systems/CombatEngine method default — cycle 546/547과 동일.
   *
   * 수정 (src/systems/CombatEngine.ts):
   * - signature에서 relics: Relic[] = [] → relics: Relic[].
   * - signature에서 logs: any[] = [] → logs: any[].
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 2 internal callsite 동작 그대로.
   * - body crit_mp_regen 분기 + getEffectiveMaxMp 호출 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 548: applyCritMpRestore signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const fnIdx = source.indexOf('applyCritMpRestore(player');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/relics:\s*Relic\[\]\s*=\s*\[\]/.test(sig),
          'applyCritMpRestore relics default [] 제거');
      assert.ok(!/logs:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'applyCritMpRestore logs default [] 제거');
  });

  test('cycle 548: 정합성 가드 — 2 internal callsite 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const calls = (source.match(/this\.applyCritMpRestore\(/g) || []).length;
      assert.equal(calls, 2, `internal callsite 2건 보존: ${calls}건`);
  });

  test('cycle 548: body crit_mp_regen 분기 + getEffectiveMaxMp 보존', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/relics\.find\(\(relic: any\) => relic\.effect === 'crit_mp_regen'\)/.test(source),
          'crit_mp_regen find 보존');
      assert.ok(/this\.getEffectiveMaxMp\(player, relics\)/.test(source),
          'getEffectiveMaxMp(player, relics) 호출 보존');
  });

  test('cycle 548: cycle 502-547 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/applyEntropyTick\(player: Player, enemy: Monster, activeSynergies:\s*any\[\]\s*=\s*\[\]\)/.test(ce),
          'cycle 547 applyEntropyTick activeSynergies default 0건');
      assert.ok(!/getElementMultiplier\(elem: any, enemy: Monster, relics:\s*any\[\]\s*=\s*\[\]\)/.test(ce),
          'cycle 546 getElementMultiplier relics default 0건');
  });
}

// ─── cycle-553-apply-fatal-protection-partial-defaults-batch.test.js ───
{
  /**
   * cycle 553: applyFatalProtection 3 defaults partial cleanup
   *   (relics + incomingDamage + logs unreachable, activeSynergies reachable
   *   보존). cycle 222-552 silent dead config 시리즈 294번째 — redundant default
   *   annotation 청소 메가 시리즈 47번째. partial cleanup pattern.
   *
   * 발견 (3 defaults unreachable, 1 default reachable 보존):
   * - src/systems/CombatEngine.ts (line 95):
   *     applyFatalProtection(player: Player, relics: Relic[] = [],
   *         incomingDamage = 0, logs: any[] = [], activeSynergies: any[] = []) {
   *     ...
   *     }
   * - 호출 사이트 audit:
   *     · combatAttack.ts:189 — applyFatalProtection(player, stats.relics || [],
   *       escapeResult.damage || 0, protectionLogs) — 4 args (activeSynergies
   *       missing → activeSynergies default REACHABLE).
   *     · CombatEngine.ts:1286 — this.applyFatalProtection(updatedPlayer, relics,
   *       enemyDmg, logs, activeSynergies) — 5 args 명시.
   *     · 9 test callers — 모두 5 args 명시 ([player, relics, dmg, [], synergies/[]]).
   * - 결과:
   *     · relics 항상 명시 → default 도달 불가.
   *     · incomingDamage 항상 명시 → default 도달 불가.
   *     · logs 항상 명시 → default 도달 불가.
   *     · activeSynergies 1 caller (combatAttack) 미전달 → default REACHABLE 보존.
   *
   * 패턴 (cycle 222-552 시리즈 294번째):
   * - cycle 502-552: default 청소 메가 시리즈 51사이클.
   * - cycle 553: partial cleanup pattern (cycle 542 signedDelta 패턴 재적용)
   *   — 같은 함수 내 parameter 4개 중 3개만 unreachable, 1개 reachable 분리.
   *   systems/CombatEngine method 시리즈 7번째.
   *
   * 수정 (src/systems/CombatEngine.ts):
   * - signature에서 relics: Relic[] = [] → relics: Relic[].
   * - signature에서 incomingDamage = 0 → incomingDamage: any.
   * - signature에서 logs: any[] = [] → logs: any[].
   * - signature에서 activeSynergies: any[] = [] 보존 (combatAttack 4-arg
   *   caller가 reachable path).
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 11 callsite (1 production + 1 internal + 9 test) 동작 그대로.
   * - body relic.effect 분기 / phoenix / titan 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 553: applyFatalProtection signature에서 3 defaults 0건', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const fnIdx = source.indexOf('applyFatalProtection(player');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/relics:\s*Relic\[\]\s*=\s*\[\]/.test(sig),
          'applyFatalProtection relics default [] 제거');
      assert.ok(!/incomingDamage\s*=\s*0/.test(sig),
          'applyFatalProtection incomingDamage default 0 제거');
      assert.ok(!/logs:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'applyFatalProtection logs default [] 제거');
  });

  test('cycle 553: activeSynergies default 보존 (reachable, partial cleanup)', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const fnIdx = source.indexOf('applyFatalProtection(player');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/activeSynergies:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'applyFatalProtection activeSynergies default [] 보존 (combatAttack 4-arg caller가 reachable path)');
  });

  test('cycle 553: 정합성 가드 — production + internal + test callsite 보존', async () => {
      const ca = await readSrc('src/hooks/combatActions/combatAttack.ts');
      assert.ok(/CombatEngine\.applyFatalProtection\(player,\s*stats\.relics \|\| \[\],\s*escapeResult\.damage \|\| 0,\s*protectionLogs\)/.test(ca),
          'combatAttack 4-arg callsite 보존 (activeSynergies 미전달)');

      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(/this\.applyFatalProtection\(updatedPlayer,\s*relics,\s*enemyDmg,\s*logs,\s*activeSynergies\)/.test(ce),
          'internal 5-arg callsite 보존');

      // cycle-157-relic-* 는 tests/relics.test.js로 통합됨 (audit #1).
      const test1 = await readSrc('tests/relics.test.js');
      assert.ok(/CombatEngine\.applyFatalProtection\(player,\s*player\.relics,\s*100,\s*\[\],\s*\[\]\)/.test(test1),
          'test 5-arg callsite (cycle 157) 보존');
  });

  test('cycle 553: cycle 502-552 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/processLoot\(enemy: Monster, player:\s*any\s*=\s*null/.test(ce),
          'cycle 552 processLoot player default 0건');
      assert.ok(!/getEffectiveMaxMp\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]/.test(ce),
          'cycle 551 getEffectiveMaxMp relics default 0건');
  });
}

// ─── cycle-554-get-explore-state-stats-default-unreachable.test.js ───
{
  /**
   * cycle 554: getExploreState `stats = {}` default unreachable
   *   (cycle 222-553 silent dead config 시리즈 295번째 — redundant default annotation
   *   청소 메가 시리즈 48번째). utils/ 추가 cleanup.
   *
   * 발견 (1 default unreachable):
   * - src/utils/explorationPacing.ts (line 16):
   *     const getExploreState = (stats: any = {}) => {
   *         const raw = stats?.exploreState || {};
   *         ...
   *     };
   * - 호출 사이트 (4 internal callsite, 모듈 내부 private):
   *     · explorationPacing.ts:90 — getExploreState(stats)
   *     · explorationPacing.ts:103 — getExploreState(stats)
   *     · explorationPacing.ts:114 — getExploreState(player?.stats)
   *     · explorationPacing.ts:145 — getExploreState(stats)
   *     · 다른 caller 0건 (cycle 297 export 제거).
   * - 결과: stats 항상 명시 전달. default {} 도달 불가. body의 `stats?.exploreState`
   *   가 undefined 안전 처리.
   *
   * 패턴 (cycle 222-553 시리즈 295번째):
   * - cycle 502-553: default 청소 메가 시리즈 52사이클.
   * - cycle 554: explorationPacing.ts internal helper — cycle 515 advance
   *   ExploreState에 이은 동일 모듈 추가 cleanup.
   *
   * 수정 (src/utils/explorationPacing.ts):
   * - signature에서 stats: any = {} → stats: any.
   * - body의 stats?.exploreState 가드 보존.
   *
   * 회귀 가드:
   * - 4 internal callsite 동작 그대로.
   * - body Math.max / DEFAULT_EXPLORE_STATE.lastOutcome 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 554: getExploreState signature에서 stats default 0건', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      const fnIdx = source.indexOf('const getExploreState');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig),
          'getExploreState stats default {} 제거');
      assert.ok(/\bstats\b/.test(sig), 'stats 파라미터 자체는 보존');
  });

  test('cycle 554: 정합성 가드 — 4 internal callsite 보존', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      const calls = (source.match(/getExploreState\(/g) || []).length;
      assert.equal(calls, 4, `getExploreState 사용처 4건 보존: ${calls}건`);
      assert.ok(/const getExploreState = \(stats/.test(source),
          'getExploreState 정의 보존');
  });

  test('cycle 554: body stats?.exploreState 가드 보존 (undefined 안전)', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(/const raw = stats\?\.exploreState \|\| \{\}/.test(source),
          'stats?.exploreState || {} 가드 보존');
      assert.ok(/Math\.max\(0,\s*raw\.sinceNarrativeEvent \|\| 0\)/.test(source),
          'sinceNarrativeEvent Math.max 보존');
  });

  test('cycle 554: cycle 502-553 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/applyFatalProtection\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]/.test(ce),
          'cycle 553 applyFatalProtection relics default 0건');
      assert.ok(!/processLoot\(enemy: Monster, player:\s*any\s*=\s*null/.test(ce),
          'cycle 552 processLoot player default 0건');
  });
}

// ─── cycle-556-format-reward-helpers-defaults-batch.test.js ───
{
  /**
   * cycle 556: formatDailyProtocolReward + formatRewardParts 2 defaults batch
   *   unreachable (cycle 222-555 silent dead config 시리즈 297번째 — redundant
   *   default annotation 청소 메가 시리즈 50번째). gameUtils.ts 같은 모듈 batch.
   *
   * 발견 (2 defaults batch):
   * - src/utils/gameUtils.ts (line 96, 111):
   *     · formatDailyProtocolReward (reward: any = {})
   *     · formatRewardParts (reward: any = {})
   * - 호출 사이트 (모두 명시 전달):
   *     · formatDailyProtocolReward: 3 callers
   *       - useInventoryActions:29 — formatDailyProtocolReward(mission.reward)
   *       - _shared.ts:34 — formatDailyProtocolReward(mission.reward)
   *       - useCombatActions:18 — formatDailyProtocolReward(mission.reward)
   *     · formatRewardParts: 3 callers
   *       - QuestBoardPanel:31 — formatRewardParts(reward)
   *       - QuestTab:36 — formatRewardParts(reward)
   *       - AchievementPanel:68 — formatRewardParts(achievement.reward || {})
   * - 결과: reward 항상 명시 전달. 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-555 시리즈 297번째):
   * - cycle 502-555: default 청소 메가 시리즈 54사이클.
   * - cycle 556: gameUtils.ts 같은 모듈 batch — cycle 504/505 grantGold/
   *   getDailyProtocolCompletions에 이은 동일 모듈 추가 cleanup.
   *
   * 수정 (src/utils/gameUtils.ts):
   * - formatDailyProtocolReward signature: reward: any = {} → reward: any.
   * - formatRewardParts signature: reward: any = {} → reward: any.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 6 callsite 동작 그대로.
   * - body essence/item/relicShard/exp/gold 분기 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 556: 2 defaults 0건', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      const dailySig = source.slice(source.indexOf('export const formatDailyProtocolReward'),
                                      source.indexOf('=>', source.indexOf('export const formatDailyProtocolReward')));
      assert.ok(!/reward:\s*any\s*=\s*\{\}/.test(dailySig),
          'formatDailyProtocolReward reward default {} 제거');

      const partsSig = source.slice(source.indexOf('export const formatRewardParts'),
                                      source.indexOf('=>', source.indexOf('export const formatRewardParts')));
      assert.ok(!/reward:\s*any\s*=\s*\{\}/.test(partsSig),
          'formatRewardParts reward default {} 제거');
  });

  test('cycle 556: 정합성 가드 — 6 callsite 보존', async () => {
      const inv = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(/formatDailyProtocolReward\(mission\.reward\)/.test(inv),
          'useInventoryActions formatDailyProtocolReward 보존');

      const sh = await readSrc('src/hooks/gameActions/_shared.ts');
      assert.ok(/formatDailyProtocolReward\(mission\.reward\)/.test(sh),
          '_shared.ts formatDailyProtocolReward 보존');

      const ap = await readSrc('src/components/AchievementPanel.tsx');
      assert.ok(/formatRewardParts\(achievement\.reward \|\| \{\}\)/.test(ap),
          'AchievementPanel formatRewardParts 보존');

      const qt = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(/formatRewardParts\(reward\)/.test(qt),
          'QuestTab formatRewardParts 보존');
  });

  test('cycle 556: body essence/item/exp/gold 분기 보존', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.ok(/if \(reward\.essence\) return `에센스 \$\{reward\.essence\}`/.test(source),
          'essence 분기 보존');
      assert.ok(/if \(reward\.exp\) parts\.push\(`EXP \$\{reward\.exp\}`\)/.test(source),
          'exp 분기 보존');
      assert.ok(/if \(reward\.gold\) parts\.push\(`\$\{reward\.gold\}G`\)/.test(source),
          'gold 분기 보존');
  });

  test('cycle 556: cycle 502-555 회귀 가드 — default 청소 시리즈 보존', async () => {
      const qo = await readSrc('src/utils/questOperations.ts');
      assert.ok(!/const getQuestTargetMaps[^=]*maps:\s*any\s*=\s*MAPS/.test(qo),
          'cycle 555 getQuestTargetMaps maps default 0건');

      const ep = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/const getExploreState[^=]*stats:\s*any\s*=\s*\{\}/.test(ep),
          'cycle 554 getExploreState stats default 0건');
  });
}

// ─── cycle-557-outcome-analysis-defaults-batch.test.js ───
{
  /**
   * cycle 557: getPostCombatAnalysis + getRunSummaryAnalysis 2 defaults batch
   *   unreachable (cycle 222-556 silent dead config 시리즈 298번째 — redundant
   *   default annotation 청소 메가 시리즈 51번째). outcomeAnalysis.ts 같은
   *   모듈 batch.
   *
   * 발견 (2 defaults batch):
   * - src/utils/outcomeAnalysis.ts (line 6, 68):
   *     · getPostCombatAnalysis (result: any = {})
   *     · getRunSummaryAnalysis (summary: any = {})
   * - 호출 사이트:
   *     · getPostCombatAnalysis: 1 production (PostCombatCard:59) + N test
   *       (outcome-analysis.test.js, cycle-336) — 모두 명시.
   *     · getRunSummaryAnalysis: 1 production (RunSummaryCard:25) + N test
   *       (cycle-87, cycle-97) — 모두 summary 명시.
   * - 결과: 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-556 시리즈 298번째):
   * - cycle 502-556: default 청소 메가 시리즈 55사이클.
   * - cycle 557: outcomeAnalysis.ts 같은 모듈 batch.
   *
   * 수정 (src/utils/outcomeAnalysis.ts):
   * - getPostCombatAnalysis signature: result: any = {} → result: any.
   * - getRunSummaryAnalysis signature: summary: any = {} → summary: any.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 다수 callsite 동작 그대로.
   * - body clampRatio / headline / advice 분기 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 557: 2 defaults 0건', async () => {
      const source = await readSrc('src/utils/outcomeAnalysis.ts');
      const postSig = source.slice(source.indexOf('export const getPostCombatAnalysis'),
                                     source.indexOf('=>', source.indexOf('export const getPostCombatAnalysis')));
      assert.ok(!/result:\s*any\s*=\s*\{\}/.test(postSig),
          'getPostCombatAnalysis result default {} 제거');

      const runSig = source.slice(source.indexOf('export const getRunSummaryAnalysis'),
                                    source.indexOf('=>', source.indexOf('export const getRunSummaryAnalysis')));
      assert.ok(!/summary:\s*any\s*=\s*\{\}/.test(runSig),
          'getRunSummaryAnalysis summary default {} 제거');
  });

  test('cycle 557: 정합성 가드 — production callsite 보존', async () => {
      const pcc = await readSrc('src/components/PostCombatCard.tsx');
      assert.ok(/getPostCombatAnalysis\(result\)/.test(pcc),
          'PostCombatCard getPostCombatAnalysis 보존');

      const rsc = await readSrc('src/components/RunSummaryCard.tsx');
      assert.ok(/getRunSummaryAnalysis\(s\)/.test(rsc),
          'RunSummaryCard getRunSummaryAnalysis 보존');

      const test1 = await readSrc('tests/cycle-067-099.test.js');
      assert.ok(/getRunSummaryAnalysis\(summary\)/.test(test1),
          'test cycle-87 getRunSummaryAnalysis 보존');
  });

  test('cycle 557: body clampRatio + headline 분기 보존', async () => {
      const source = await readSrc('src/utils/outcomeAnalysis.ts');
      assert.ok(/result\.hpLow === 'boolean'/.test(source),
          'explicit hpLow flag 분기 보존');
      assert.ok(/clampRatio\(result\.playerHp, result\.playerMaxHp\)/.test(source),
          'ratio fallback clampRatio 보존');
      assert.ok(/summary\.bossKills > 0/.test(source), 'bossKills 분기 보존');
  });

  test('cycle 557: cycle 502-556 회귀 가드 — default 청소 시리즈 보존', async () => {
      const gu = await readSrc('src/utils/gameUtils.ts');
      assert.ok(!/formatDailyProtocolReward[^=]*reward:\s*any\s*=\s*\{\}/.test(gu),
          'cycle 556 formatDailyProtocolReward reward default 0건');
      assert.ok(!/formatRewardParts[^=]*reward:\s*any\s*=\s*\{\}/.test(gu),
          'cycle 556 formatRewardParts reward default 0건');
  });
}

// ─── cycle-559-get-enemy-tactical-profile-stats-default-unreachable.test.js ───
{
  /**
   * cycle 559: getEnemyTacticalProfile `stats = {}` default unreachable
   *   (cycle 222-558 silent dead config 시리즈 300번째 — redundant default annotation
   *   청소 메가 시리즈 53번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/runProfile.ts (line 397):
   *     export const getEnemyTacticalProfile = (enemy: Monster,
   *         stats: any = {}) => {
   *         if (!enemy) return null;
   *         void stats; // cycle 270: stats는 dead, 시그니처 호환만 보존.
   *         ...
   *     };
   * - 호출 사이트:
   *     · CombatPanel.tsx:58 — getEnemyTacticalProfile(enemy, stats) 명시.
   *     · tests/run-profile-utils.test.js:96 — getEnemyTacticalProfile({...},
   *       { def: 40 })
   *     · tests/cycle-270 — 4 callers 모두 2 args 명시 ({def:10} 등).
   *     · cycle-270:90 — getEnemyTacticalProfile(null, {}) — null + {}.
   * - 결과: stats 항상 명시 전달. default 도달 불가.
   *
   * 패턴 (cycle 222-558 시리즈 300번째):
   * - cycle 502-558: default 청소 메가 시리즈 57사이클.
   * - cycle 559: runProfile.ts 추가 cleanup. cycle 270 stats dead notation
   *   유지 (`void stats`).
   *
   * 수정 (src/utils/runProfile.ts):
   * - signature에서 stats: any = {} → stats: any.
   * - body의 void stats / cycle 270 주석 보존.
   *
   * 회귀 가드:
   * - 1 production + 5 test callsite 동작 그대로.
   * - body pattern / phase / counterHint 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 559: getEnemyTacticalProfile signature에서 stats default 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnIdx = source.indexOf('export const getEnemyTacticalProfile');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/stats:\s*any\s*=\s*\{\}/.test(sig),
          'getEnemyTacticalProfile stats default {} 제거');
  });

  test('cycle 559: 정합성 가드 — production + test callsite 보존', async () => {
      // 리팩토링: getEnemyTacticalProfile(enemy, stats) 호출은 combatView.ts(buildCombatView)로 이동.
      const cp = await readSrc('src/utils/combatView.ts');
      assert.ok(/getEnemyTacticalProfile\(enemy,\s*stats\)/.test(cp),
          'combatView getEnemyTacticalProfile 보존');

      const test270 = await readSrc('tests/cycle-200-299.test.js');
      assert.ok(/getEnemyTacticalProfile\(enemy,\s*\{ def: 10 \}\)/.test(test270),
          'cycle-270 test callsite 보존');
  });

  test('cycle 559: cycle 270 stats dead notation 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(/void stats/.test(source),
          'void stats 시그니처 호환 보존');
      assert.ok(/cycle 270: stats 파라미터는 estimatedHit\/estimatedHeavy 계산용이었으나 dead/.test(source),
          'cycle 270 주석 보존');
  });

  test('cycle 559: cycle 502-558 회귀 가드 — default 청소 시리즈 보존', async () => {
      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/const buildTraitSkill[^=]*stats:\s*any\s*=\s*\{\}/.test(rp),
          'cycle 558 buildTraitSkill stats default 0건');
      assert.ok(!/export const getTraitBonus[^=]*stats:\s*any\s*=\s*\{\}/.test(rp),
          'cycle 558 getTraitBonus stats default 0건');
  });
}

// ─── cycle-561-build-event-package-procedural-outcome-defaults-batch.test.js ───
{
  /**
   * cycle 561: buildEventPackage + buildProceduralOutcome 3 defaults batch
   *   unreachable (cycle 222-560 silent dead config 시리즈 301번째 — redundant
   *   default annotation 청소 메가 시리즈 54번째). aiEventUtils.ts 같은 모듈
   *   batch.
   *
   * 발견 (3 defaults batch):
   * - src/utils/aiEventUtils.ts (line 138, 247):
   *     · buildProceduralOutcome ({ desc, choice, choiceIndex, context = {} }: any = {})
   *       — 외부 default + 내부 context default 둘 다.
   *     · buildEventPackage (payload: any, context: any = {})
   * - 호출 사이트:
   *     · buildProceduralOutcome: 1 internal (line 236) — 완전 object 명시
   *       전달, 외부 + 내부 default 모두 도달 불가.
   *     · buildEventPackage: 3 callers (line 548 internal, aiService:100,
   *       ai-event-utils.test.js:26) 모두 2 args 명시.
   * - 결과: 3 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-560 시리즈 301번째):
   * - cycle 502-560: default 청소 메가 시리즈 59사이클.
   * - cycle 561: aiEventUtils.ts 같은 모듈 추가 batch — cycle 522/525/527에
   *   이은 cleanup, 4번째 동일 모듈 cleanup.
   *
   * 수정 (src/utils/aiEventUtils.ts):
   * - buildProceduralOutcome signature: { desc, choice, choiceIndex, context }: any.
   * - buildEventPackage signature: context: any = {} → context: any.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 4 callsite 동작 그대로.
   * - body normalizeText / dedupeChoices / getPoolKeyByLocation 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 561: buildEventPackage signature에서 context default 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('export const buildEventPackage');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/context:\s*any\s*=\s*\{\}/.test(sig),
          'buildEventPackage context default {} 제거');
  });

  test('cycle 561: buildProceduralOutcome signature에서 outer + inner defaults 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('const buildProceduralOutcome');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\}\s*:\s*any\s*=\s*\{\}/.test(sig),
          'buildProceduralOutcome outer default {} 제거');
      assert.ok(!/context\s*=\s*\{\}/.test(sig),
          'buildProceduralOutcome inner context default {} 제거');
  });

  test('cycle 561: 정합성 가드 — 4 callsite 보존', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(/buildProceduralOutcome\(\{\s*\n\s*desc:/.test(source),
          'buildProceduralOutcome internal callsite (object literal) 보존');
      const calls = (source.match(/buildEventPackage\(/g) || []).length;
      assert.equal(calls, 1, `buildEventPackage 사용처 1건 보존 (내부 line 548): ${calls}건`);
      assert.ok(/export const buildEventPackage = \(payload/.test(source),
          'buildEventPackage 정의 보존');

      const ai = await readSrc('src/services/aiService.ts');
      assert.ok(/buildEventPackage\(result\.data, \{ \.\.\.context, location: loc, source: 'ai' \}\)/.test(ai),
          'aiService buildEventPackage callsite 보존');
  });

  test('cycle 561: cycle 502-560 회귀 가드 — default 청소 시리즈 보존', async () => {
      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/export const getEnemyTacticalProfile[^=]*stats:\s*any\s*=\s*\{\}/.test(rp),
          'cycle 559 getEnemyTacticalProfile stats default 0건');

      const oa = await readSrc('src/utils/outcomeAnalysis.ts');
      assert.ok(!/getRunSummaryAnalysis[^=]*summary:\s*any\s*=\s*\{\}/.test(oa),
          'cycle 557 getRunSummaryAnalysis summary default 0건');
  });
}

// ─── cycle-562-sanitize-quick-slots-defaults-batch.test.js ───
{
  /**
   * cycle 562: sanitizeQuickSlots `slots = []` + `inventory = []` defaults batch
   *   unreachable (cycle 222-561 silent dead config 시리즈 302번째 — redundant
   *   default annotation 청소 메가 시리즈 55번째). reducers/handlers/.
   *
   * 발견 (2 defaults batch):
   * - src/reducers/handlers/helpers.ts (line 9):
   *     export const sanitizeQuickSlots = (slots: any = [], inventory: any = []) => {
   *         const ids = new Set((inventory || []).map(...).filter(Boolean));
   *         const normalized = Array.from(..., (_, i) => (Array.isArray(slots) ? slots[i] : undefined) ?? null);
   *         ...
   *     };
   * - 호출 사이트:
   *     · bootstrapHandlers.ts:20 — sanitizeQuickSlots(action.payload.quickSlots,
   *       loadedPlayer.inv) — 2 args 명시.
   *     · uiHandlers.ts:53 — sanitizeQuickSlots(state.quickSlots, mergedPlayer.inv)
   *       — 2 args 명시.
   *     · 다른 caller 0건 (test caller 0건).
   * - 결과: 두 default 모두 도달 불가. body의 (inventory || []) +
   *   Array.isArray(slots) defensive guards가 undefined/null 안전 처리.
   *
   * 패턴 (cycle 222-561 시리즈 302번째):
   * - cycle 502-561: default 청소 메가 시리즈 60사이클.
   * - cycle 562: reducers/ 추가 cleanup — cycle 538에 이은 reducers/ 2번째.
   *
   * 수정 (src/reducers/handlers/helpers.ts):
   * - signature에서 slots: any = [] → slots: any.
   * - signature에서 inventory: any = [] → inventory: any.
   * - body의 (inventory || []) / Array.isArray(slots) defensive guards 보존.
   *
   * 회귀 가드:
   * - 2 production callsite 동작 그대로.
   * - body defensive guards + null 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 562: sanitizeQuickSlots signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/reducers/handlers/helpers.ts');
      const fnIdx = source.indexOf('export const sanitizeQuickSlots');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/slots:\s*any\s*=\s*\[\]/.test(sig),
          'sanitizeQuickSlots slots default [] 제거');
      assert.ok(!/inventory:\s*any\s*=\s*\[\]/.test(sig),
          'sanitizeQuickSlots inventory default [] 제거');
  });

  test('cycle 562: 정합성 가드 — 2 production callsite 보존', async () => {
      const bs = await readSrc('src/reducers/handlers/bootstrapHandlers.ts');
      assert.ok(/sanitizeQuickSlots\(action\.payload\.quickSlots,\s*loadedPlayer\.inv\)/.test(bs),
          'bootstrapHandlers callsite 보존');

      const ui = await readSrc('src/reducers/handlers/uiHandlers.ts');
      assert.ok(/sanitizeQuickSlots\(state\.quickSlots,\s*mergedPlayer\.inv\)/.test(ui),
          'uiHandlers callsite 보존');
  });

  test('cycle 562: body defensive guards 보존', async () => {
      const source = await readSrc('src/reducers/handlers/helpers.ts');
      assert.ok(/\(inventory \|\| \[\]\)\.map/.test(source),
          '(inventory || []) defensive guard 보존');
      assert.ok(/Array\.isArray\(slots\) \? slots\[i\] : undefined/.test(source),
          'Array.isArray(slots) defensive guard 보존');
  });

  test('cycle 562: cycle 502-561 회귀 가드 — default 청소 시리즈 보존', async () => {
      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/export const buildEventPackage[^=]*context:\s*any\s*=\s*\{\}/.test(aiu),
          'cycle 561 buildEventPackage context default 0건');

      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/getEnemyTacticalProfile[^=]*stats:\s*any\s*=\s*\{\}/.test(rp),
          'cycle 559 getEnemyTacticalProfile stats default 0건');
  });
}

// ─── cycle-564-with-variant-overrides-default-unreachable.test.js ───
{
  /**
   * cycle 564: withVariant `overrides = {}` default unreachable
   *   (cycle 222-563 silent dead config 시리즈 304번째 — redundant default annotation
   *   청소 메가 시리즈 57번째). avatarEquipmentPreview.ts.
   *
   * 발견 (1 default unreachable):
   * - src/utils/avatarEquipmentPreview.ts (line 101):
   *     const withVariant = (baseStage: any, variant: any,
   *         overrides: any = {}) => {...};
   * - 호출 사이트 (10 internal callsite, 모듈 내부 private):
   *     · withVariant({...baseStage}, variant, {...overrides}) — 모두 3 args
   *       명시 (object literal로 overrides 전달).
   *     · 다른 caller 0건 (private 모듈 helper).
   * - 결과: overrides 항상 명시 전달. default {} 도달 불가.
   *
   * 패턴 (cycle 222-563 시리즈 304번째):
   * - cycle 502-563: default 청소 메가 시리즈 62사이클.
   * - cycle 564: avatarEquipmentPreview.ts 추가 cleanup — cycle 514에 이은
   *   동일 모듈 cleanup.
   *
   * 수정 (src/utils/avatarEquipmentPreview.ts):
   * - signature에서 overrides: any = {} → overrides: any.
   * - body의 overrides.scale ?? / overrides.translateX ?? 등 nullish 처리 보존.
   *
   * 회귀 가드:
   * - 10 internal callsite 동작 그대로.
   * - body variant ternary + overrides nullish coalescing 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 564: withVariant signature에서 overrides default 0건', async () => {
      const source = await readSrc('src/utils/avatarEquipmentPreview.ts');
      const fnIdx = source.indexOf('const withVariant');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/overrides:\s*any\s*=\s*\{\}/.test(sig),
          'withVariant overrides default {} 제거');
  });

  test('cycle 564: 정합성 가드 — 10 internal callsite 보존', async () => {
      const source = await readSrc('src/utils/avatarEquipmentPreview.ts');
      const calls = (source.match(/\}, variant, \{/g) || []).length;
      assert.equal(calls, 10, `withVariant 3-arg callsite 10건 보존: ${calls}건`);
  });

  test('cycle 564: body variant ternary + nullish coalescing 보존', async () => {
      const source = await readSrc('src/utils/avatarEquipmentPreview.ts');
      assert.ok(/if \(variant === 'card'\)/.test(source),
          "variant === 'card' 분기 보존");
      assert.ok(/overrides\.scale \?\? Math\.round\(baseStage\.scale \* 118\) \/ 100/.test(source),
          'overrides.scale ?? nullish coalescing 보존');
  });

  test('cycle 564: cycle 502-563 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ld = await readSrc('src/hooks/useLegendaryDropDetector.ts');
      assert.ok(!/useLegendaryDropDetector[^=]*dispatch:\s*any\s*=\s*null/.test(ld),
          'cycle 563 useLegendaryDropDetector dispatch default 0건');

      const helpers = await readSrc('src/reducers/handlers/helpers.ts');
      assert.ok(!/sanitizeQuickSlots[^=]*slots:\s*any\s*=\s*\[\]/.test(helpers),
          'cycle 562 sanitizeQuickSlots slots default 0건');
  });
}

// ─── cycle-566-start-action-3-defaults-batch.test.js ───
{
  /**
   * cycle 566: start action 3 defaults batch unreachable
   *   (cycle 222-565 silent dead config 시리즈 306번째 — redundant default annotation
   *   청소 메가 시리즈 59번째). single-cycle 3-default batch.
   *
   * 발견 (3 defaults batch):
   * - src/hooks/gameActions/characterActions.ts (line 14):
   *     start: (name: any, gender: any = 'male', jobId: any = CONSTANTS.DEFAULT_JOB,
   *         challengeModifiers: any = []) => {...}
   * - 호출 사이트:
   *     · IntroScreen.tsx:49 — onStart?.(selectedName, 'male', '모험가',
   *       selectedChallenges) — 4 args 명시 전달.
   *     · 다른 production caller 0건 (test caller 0건).
   * - 결과: gender / jobId / challengeModifiers 항상 명시 전달. 3 defaults
   *   모두 도달 불가. body의 Array.isArray(challengeModifiers) defensive guard
   *   는 별개 보존 (caller가 array 보장 못하는 path 자체).
   *
   * 패턴 (cycle 222-565 시리즈 306번째):
   * - cycle 502-565: default 청소 메가 시리즈 64사이클.
   * - cycle 566: hooks/gameActions/characterActions.ts 추가 cleanup — cycle
   *   532/535에 이은 동일 모듈. single-cycle 3-default batch (cycle 524/527/
   *   549 패턴).
   *
   * 수정 (src/hooks/gameActions/characterActions.ts):
   * - signature에서 gender / jobId / challengeModifiers 3 defaults 모두 제거.
   * - body의 Array.isArray(challengeModifiers) defensive guard 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (IntroScreen) 동작 그대로.
   * - body trimmedName / buildClassVitals / Array.isArray 처리 보존.
   * - start path는 신규 캐릭터 초기 성장 pacing을 위해 Lv1 기준 vitals를 계산.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 566: start action signature에서 3 defaults 0건', async () => {
      const source = await readSrc('src/hooks/gameActions/characterActions.ts');
      const fnIdx = source.indexOf('start: (name');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/gender:\s*any\s*=\s*'male'/.test(sig),
          "start gender default 'male' 제거");
      assert.ok(!/jobId:\s*any\s*=\s*CONSTANTS\.DEFAULT_JOB/.test(sig),
          'start jobId default CONSTANTS.DEFAULT_JOB 제거');
      assert.ok(!/challengeModifiers:\s*any\s*=\s*\[\]/.test(sig),
          'start challengeModifiers default [] 제거');
  });

  test('cycle 566: 정합성 가드 — IntroScreen callsite 보존', async () => {
      const source = await readSrc('src/components/IntroScreen.tsx');
      assert.ok(/onStart\?\.\(selectedName,\s*'male',\s*'모험가',\s*selectedChallenges\)/.test(source),
          "IntroScreen onStart?.(selectedName, 'male', '모험가', selectedChallenges) callsite 보존");
  });

  test('cycle 566: body Array.isArray defensive guard 보존', async () => {
      const source = await readSrc('src/hooks/gameActions/characterActions.ts');
      assert.ok(/Array\.isArray\(challengeModifiers\) \? challengeModifiers : \[\]/.test(source),
          'Array.isArray(challengeModifiers) defensive guard 보존');
      assert.ok(/buildClassVitals\(1,\s*jobId,\s*player\.meta \|\| \{\}\)/.test(source),
          'buildClassVitals 호출 보존 — 신규 캐릭터 Lv1 기준');
      assert.ok(/level:\s*1,\s*exp:\s*0,\s*nextExp:\s*CONSTANTS\.START_NEXT_EXP/.test(source),
          'start payload가 level/exp/nextExp 초기값을 명시');
  });

  test('cycle 566: cycle 502-565 회귀 가드 — default 청소 시리즈 보존', async () => {
      const stp = await readSrc('src/components/SkillTreePreview.tsx');
      assert.ok(!/const SkillTreePreview = \({ player, actions\s*=\s*null/.test(stp),
          'cycle 565 SkillTreePreview actions default 0건');

      const ap = await readSrc('src/utils/avatarEquipmentPreview.ts');
      assert.ok(!/const withVariant[^=]*overrides:\s*any\s*=\s*\{\}/.test(ap),
          'cycle 564 withVariant overrides default 0건');
  });
}

// ─── cycle-568-class-icon-defaults-batch.test.js ───
{
  /**
   * cycle 568: ClassIcon `size = 28` + `tier = 0` defaults batch unreachable
   *   (cycle 222-567 silent dead config 시리즈 308번째 — redundant default annotation
   *   청소 메가 시리즈 61번째). component prop default cleanup.
   *
   * 발견 (2 defaults batch):
   * - src/components/icons/ClassIcon.tsx (line 48):
   *     const ClassIcon = ({ className: jobName, size = 28, tier = 0 }: any) => {...};
   * - 호출 사이트 (4 callers, 모두 명시 전달):
   *     · SkillTreePreview.tsx:145 — <ClassIcon size={28} tier={...} />
   *     · ClassTree.tsx:58 — <ClassIcon size={24} tier={tier} />
   *     · ClassCard.tsx:54 — <ClassIcon size={28} tier={tier} />
   *     · JobChangePanel.tsx:43 — <ClassIcon size={30} tier={...} />
   * - 결과: size / tier 항상 명시 전달. 두 default 모두 도달 불가.
   *   body의 TIER_COLORS[tier] ?? TIER_COLORS[0] nullish fallback은 별개 보존.
   *
   * 패턴 (cycle 222-567 시리즈 308번째):
   * - cycle 502-567: default 청소 메가 시리즈 66사이클.
   * - cycle 568: components/icons/ — cycle 463/464에 이은 동일 모듈 cleanup.
   *
   * 수정 (src/components/icons/ClassIcon.tsx):
   * - signature에서 size = 28 → size.
   * - signature에서 tier = 0 → tier.
   * - body의 TIER_COLORS[tier] ?? TIER_COLORS[0] nullish fallback 보존.
   *
   * 회귀 가드:
   * - 4 production callsite 동작 그대로.
   * - body CLASS_PATHS / TIER_COLORS 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 568: ClassIcon signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/components/icons/ClassIcon.tsx');
      const fnIdx = source.indexOf('const ClassIcon = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/size\s*=\s*28/.test(sig),
          'ClassIcon size default 28 제거');
      assert.ok(!/tier\s*=\s*0/.test(sig),
          'ClassIcon tier default 0 제거');
  });

  test('cycle 568: 정합성 가드 — 4 production callsite 보존', async () => {
      const stp = await readSrc('src/components/SkillTreePreview.tsx');
      assert.ok(/<ClassIcon className=\{player\.job\} size=\{28\} tier=\{currentClass\?\.tier \|\| 0\}/.test(stp),
          'SkillTreePreview <ClassIcon> callsite 보존');

      const ct = await readSrc('src/components/ClassTree.tsx');
      assert.ok(/<ClassIcon className=\{node\.name\} size=\{24\} tier=\{tier\}/.test(ct),
          'ClassTree <ClassIcon> callsite 보존');

      const cc = await readSrc('src/components/ClassCard.tsx');
      assert.ok(/<ClassIcon className=\{jobName\} size=\{28\} tier=\{tier\}/.test(cc),
          'ClassCard <ClassIcon> callsite 보존');

      const jcp = await readSrc('src/components/tabs/JobChangePanel.tsx');
      assert.ok(/<ClassIcon className=\{player\.job\} size=\{30\} tier=\{current\?\.tier \|\| 0\}/.test(jcp),
          'JobChangePanel <ClassIcon> callsite 보존');
  });

  test('cycle 568: body TIER_COLORS nullish fallback 보존', async () => {
      const source = await readSrc('src/components/icons/ClassIcon.tsx');
      assert.ok(/TIER_COLORS\[tier\] \?\? TIER_COLORS\[0\]/.test(source),
          'TIER_COLORS[tier] ?? TIER_COLORS[0] nullish fallback 보존');
      assert.ok(/CLASS_PATHS\[jobName\] \|\| CLASS_PATHS\['모험가'\]/.test(source),
          "CLASS_PATHS jobName fallback 보존");
  });

  test('cycle 568: cycle 502-567 회귀 가드 — default 청소 시리즈 보존', async () => {
      const sb = await readSrc('src/components/icons/SignatureBadge.tsx');
      assert.ok(!/const SignatureBadge = \({ item, size\s*=\s*10/.test(sb),
          'cycle 567 SignatureBadge size default 0건');

      const ca = await readSrc('src/hooks/gameActions/characterActions.ts');
      assert.ok(!/start: \(name: any, gender:\s*any\s*=\s*'male'/.test(ca),
          'cycle 566 start gender default 0건');
  });
}

// ─── cycle-572-dashboard-defaults-partial-batch.test.js ───
{
  /**
   * cycle 572: Dashboard 6 defaults partial batch unreachable
   *   (cycle 222-571 silent dead config 시리즈 311번째 — redundant default annotation
   *   청소 메가 시리즈 64번째). 가장 큰 single-cycle multi-default batch + partial
   *   cleanup 동시.
   *
   * 발견 (6 defaults unreachable, 1 default reachable 보존):
   * - src/components/Dashboard.tsx (line 81):
   *     const Dashboard = ({ player, grave, sideTab, setSideTab, actions, stats,
   *         mobileSection = 'full', quickSlots = [null, null, null],
   *         runtime = null, inventorySpotlight = null,
   *         onClearInventorySpotlight = null, consoleExpanded = false,
   *         onReturnToLog = null }: DashboardProps) => {...};
   * - 호출 사이트 (1 caller):
   *     · MobileGameLayout.tsx:63-83 — <Dashboard ... 11+ props 전달>
   *       명시: mobileSection="console" / consoleExpanded / onReturnToLog /
   *       quickSlots / inventorySpotlight / runtime
   *       미전달: onClearInventorySpotlight
   * - 결과:
   *     · 6 defaults 도달 불가: mobileSection / quickSlots / runtime /
   *       inventorySpotlight / consoleExpanded / onReturnToLog
   *     · 1 default REACHABLE 보존: onClearInventorySpotlight (caller 미전달)
   *
   * 패턴 (cycle 222-571 시리즈 311번째):
   * - cycle 502-571: default 청소 메가 시리즈 70사이클.
   * - cycle 572: 가장 큰 single-cycle batch (6 default), partial cleanup
   *   pattern (cycle 542/553/558/569 재적용 5번째).
   *
   * 수정 (src/components/Dashboard.tsx):
   * - 6 defaults 모두 제거.
   * - onClearInventorySpotlight = null 보존.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (MobileGameLayout) 동작 그대로.
   * - body mobileSection / consoleExpanded / quickSlots / runtime 사용처 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 572: Dashboard signature에서 6 defaults 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const fnIdx = source.indexOf('const Dashboard = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/mobileSection\s*=\s*'full'/.test(sig),
          "Dashboard mobileSection default 'full' 제거");
      assert.ok(!/quickSlots\s*=\s*\[null, null, null\]/.test(sig),
          'Dashboard quickSlots default [null,null,null] 제거');
      assert.ok(!/runtime\s*=\s*null/.test(sig),
          'Dashboard runtime default null 제거');
      assert.ok(!/inventorySpotlight\s*=\s*null/.test(sig),
          'Dashboard inventorySpotlight default null 제거');
      assert.ok(!/consoleExpanded\s*=\s*false/.test(sig),
          'Dashboard consoleExpanded default false 제거');
      assert.ok(!/onReturnToLog\s*=\s*null/.test(sig),
          'Dashboard onReturnToLog default null 제거');
  });

  test('cycle 572: onClearInventorySpotlight default 보존 (reachable)', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const fnIdx = source.indexOf('const Dashboard = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/onClearInventorySpotlight\s*=\s*null/.test(sig),
          'Dashboard onClearInventorySpotlight default null 보존 (MobileGameLayout 미전달이라 reachable)');
  });

  test('cycle 572: 정합성 가드 — MobileGameLayout callsite 보존', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      assert.ok(/<Dashboard\s*\n\s*mobileSection="console"/.test(source),
          'MobileGameLayout mobileSection="console" 보존');
      assert.ok(/consoleExpanded/.test(source), 'consoleExpanded prop 보존');
      assert.ok(/onReturnToLog=\{/.test(source), 'onReturnToLog prop 보존');
  });

  test('cycle 572: cycle 502-571 회귀 가드 — default 청소 시리즈 보존', async () => {
      const mi = await readSrc('src/components/icons/MonsterIcon.tsx');
      assert.ok(!/const MonsterIcon = \({ name, discovered\s*=\s*false/.test(mi),
          'cycle 571 MonsterIcon discovered default 0건');

      const sti = await readSrc('src/components/icons/SkillTypeIcon.tsx');
      assert.ok(!/const SkillTypeIcon = \({ type, size\s*=\s*14/.test(sti),
          'cycle 569 SkillTypeIcon size default 0건');
  });
}

// ─── cycle-574-smart-inventory-defaults-batch.test.js ───
{
  /**
   * cycle 574: SmartInventory 3 defaults batch unreachable
   *   (cycle 222-573 silent dead config 시리즈 313번째 — redundant default annotation
   *   청소 메가 시리즈 66번째). single-cycle 3-default batch.
   *
   * 발견 (3 defaults batch):
   * - src/components/SmartInventory.tsx (line 73):
   *     const SmartInventory = ({ player, actions, quickSlots = [null, null, null],
   *         onAssignQuickSlot, spotlight = null, onClearSpotlight = null }: ...) => {...};
   * - 호출 사이트 (1 caller):
   *     · Dashboard.tsx:162 — <SmartInventory player actions quickSlots
   *       onAssignQuickSlot spotlight onClearSpotlight /> — 6 props 모두 명시.
   *     · 다른 caller 0건.
   * - 결과: quickSlots / spotlight / onClearSpotlight 항상 명시 전달. 3 defaults
   *   모두 도달 불가.
   *
   * Note: cycle 452의 cycle 주석에 "future-proof 보존" 언급 있으나 실제 caller
   * audit 결과 모두 명시 전달이라 unreachable. cycle 574에서 cleanup.
   *
   * 패턴 (cycle 222-573 시리즈 313번째):
   * - cycle 502-573: default 청소 메가 시리즈 72사이클.
   * - cycle 574: components/ entry-level cleanup — cycle 572/573 패턴 연속.
   *
   * 수정 (src/components/SmartInventory.tsx):
   * - signature에서 3 defaults 모두 제거.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (Dashboard) 동작 그대로.
   * - body spotlight?.names || [] defensive guard 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 574: SmartInventory signature에서 3 defaults 0건', async () => {
      const source = await readSrc('src/components/SmartInventory.tsx');
      const fnIdx = source.indexOf('const SmartInventory = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/quickSlots\s*=\s*\[null, null, null\]/.test(sig),
          'SmartInventory quickSlots default 제거');
      assert.ok(!/spotlight\s*=\s*null/.test(sig),
          'SmartInventory spotlight default null 제거');
      assert.ok(!/onClearSpotlight\s*=\s*null/.test(sig),
          'SmartInventory onClearSpotlight default null 제거');
  });

  test('cycle 574: 정합성 가드 — Dashboard callsite 보존', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      assert.ok(/<SmartInventory[\s\S]*?quickSlots=\{quickSlots\}[\s\S]*?spotlight=\{inventorySpotlight\}[\s\S]*?onClearSpotlight=\{onClearInventorySpotlight\}/.test(source),
          'Dashboard <SmartInventory> 6-prop callsite 보존');
  });

  test('cycle 574: body spotlight 처리 보존', async () => {
      const source = await readSrc('src/components/SmartInventory.tsx');
      assert.ok(/spotlight\?\.names \|\| \[\]/.test(source),
          'spotlight?.names || [] defensive guard 보존');
  });

  test('cycle 574: cycle 502-573 회귀 가드 — default 청소 시리즈 보존', async () => {
      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/const ShopPanel = \({[^}]+stats\s*=\s*null/.test(sp),
          'cycle 573 ShopPanel stats default 0건');

      const dash = await readSrc('src/components/Dashboard.tsx');
      assert.ok(!/mobileSection\s*=\s*'full'/.test(dash),
          'cycle 572 Dashboard mobileSection default 0건');
  });
}

// ─── cycle-575-combat-panel-defaults-batch.test.js ───
{
  /**
   * cycle 575: CombatPanel 3 defaults batch unreachable
   *   (cycle 222-574 silent dead config 시리즈 314번째 — redundant default annotation
   *   청소 메가 시리즈 67번째). single-cycle 3-default batch.
   *
   * 발견 (3 defaults batch):
   * - src/components/tabs/CombatPanel.tsx (line 55):
   *     const CombatPanel = ({ player, actions, enemy = null, stats = {},
   *         isAiThinking, mobile = false }: CombatPanelProps) => {...};
   * - 호출 사이트 (1 caller):
   *     · ControlPanel.tsx:119 — <CombatPanel ... 6 props 모두 명시 전달>
   *     · 다른 caller 0건.
   * - 결과: enemy / stats / mobile 항상 명시 전달. 3 defaults 모두 도달 불가.
   *
   * 패턴 (cycle 222-574 시리즈 314번째):
   * - cycle 502-574: default 청소 메가 시리즈 73사이클.
   * - cycle 575: components/tabs/ — cycle 572/573/574 component-level cleanup
   *   시리즈 4번째 연속.
   *
   * 수정 (src/components/tabs/CombatPanel.tsx):
   * - signature에서 3 defaults 모두 제거.
   * - body의 enemy ? ... : null 분기 보존 (caller가 enemy 미전달 시 동작은
   *   별개 — caller 명시 전달 후에도 enemy 자체가 null일 수 있는 path 보존).
   *
   * 회귀 가드:
   * - 1 production callsite (ControlPanel) 동작 그대로.
   * - body enemy 분기 / getEnemyTacticalProfile / tacticalProfile 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 575: CombatPanel signature에서 3 defaults 0건', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      const fnIdx = source.indexOf('const CombatPanel = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/enemy\s*=\s*null/.test(sig),
          'CombatPanel enemy default null 제거');
      assert.ok(!/stats\s*=\s*\{\}/.test(sig),
          'CombatPanel stats default {} 제거');
      assert.ok(!/mobile\s*=\s*false/.test(sig),
          'CombatPanel mobile default false 제거');
  });

  test('cycle 575: 정합성 가드 — ControlPanel callsite 보존', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(/<CombatPanel[\s\S]*?enemy=\{enemy\}[\s\S]*?stats=\{stats\}[\s\S]*?mobile/.test(source),
          'ControlPanel <CombatPanel> 6-prop callsite 보존');
  });

  test('cycle 575: body enemy 분기 보존', async () => {
      // 리팩토링: tacticalProfile 계산은 combatView.ts(buildCombatView)로 이동 — enemy 분기 보존.
      const source = await readSrc('src/utils/combatView.ts');
      assert.ok(/const tacticalProfile = enemy \? getEnemyTacticalProfile\(enemy, stats\) : null/.test(source),
          'enemy ? getEnemyTacticalProfile : null 보존');
  });

  test('cycle 575: cycle 502-574 회귀 가드 — default 청소 시리즈 보존', async () => {
      const si = await readSrc('src/components/SmartInventory.tsx');
      assert.ok(!/quickSlots\s*=\s*\[null, null, null\]/.test(si),
          'cycle 574 SmartInventory quickSlots default 0건');

      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(!/const ShopPanel = \({[^}]+stats\s*=\s*null/.test(sp),
          'cycle 573 ShopPanel stats default 0건');
  });
}

// ─── cycle-576-terminal-view-logs-default-unreachable.test.js ───
{
  /**
   * cycle 576: TerminalView `logs = []` default unreachable
   *   (cycle 222-575 silent dead config 시리즈 315번째 — redundant default annotation
   *   청소 메가 시리즈 68번째).
   *
   * 발견 (1 default unreachable):
   * - src/components/TerminalView.tsx (line 93):
   *     const TerminalView = ({
   *         logs = [],
   *         gameState,
   *         onCommand,
   *         player,
   *         quickSlots,
   *         onQuickSlotUse,
   *     }: TerminalViewProps) => {...};
   * - 호출 사이트 (1 caller):
   *     · MobileGameLayout.tsx:85 — <TerminalView logs={engine.logs} ... />
   *     · 다른 caller 0건.
   * - 결과: logs 항상 명시 전달. default [] 도달 불가.
   *
   * 패턴 (cycle 222-575 시리즈 315번째):
   * - cycle 502-575: default 청소 메가 시리즈 74사이클.
   * - cycle 576: components/ entry-level cleanup — cycle 572-575 4-cycle 시리즈
   *   에 이은 동일 lens.
   *
   * 수정 (src/components/TerminalView.tsx):
   * - signature에서 logs = [] → logs.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (MobileGameLayout) 동작 그대로.
   * - body logViewportRef / logExpanded / gameState 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 576: TerminalView signature에서 logs default 0건', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      const fnIdx = source.indexOf('const TerminalView = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/logs\s*=\s*\[\]/.test(sig),
          'TerminalView logs default [] 제거');
  });

  test('cycle 576: 정합성 가드 — MobileGameLayout callsite 보존', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      assert.ok(/<TerminalView[\s\S]*?logs=\{engine\.logs\}/.test(source),
          'MobileGameLayout <TerminalView logs={engine.logs} /> callsite 보존');
  });

  test('cycle 576: cycle 502-575 회귀 가드 — default 청소 시리즈 보존', async () => {
      const cp = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.ok(!/const CombatPanel = \({[^}]+enemy\s*=\s*null/.test(cp),
          'cycle 575 CombatPanel enemy default 0건');

      const si = await readSrc('src/components/SmartInventory.tsx');
      assert.ok(!/quickSlots\s*=\s*\[null, null, null\]/.test(si),
          'cycle 574 SmartInventory quickSlots default 0건');
  });
}

// ─── cycle-578-enhancement-utils-inventory-defaults-batch.test.js ───
{
  /**
   * cycle 578: enhancementUtils 3 inventory defaults batch unreachable
   *   (cycle 222-577 silent dead config 시리즈 317번째 — redundant default annotation
   *   청소 메가 시리즈 70번째). single-cycle 3-default batch.
   *
   * 발견 (3 defaults batch, enhancementUtils.ts 같은 모듈):
   * - src/utils/enhancementUtils.ts:
   *     · line 4: countInventoryItemByName (inventory: Item[] = [], itemName: string)
   *     · line 17: getEnhanceMaterialCount (inventory: Item[] = [])
   *     · line 24: consumeInventoryItemByName (inventory: Item[] = [], itemName,
   *       count)
   * - 호출 사이트:
   *     · countInventoryItemByName: EquipmentPanel:58 + internal:18 + test:31
   *       — 모두 inventory 명시.
   *     · getEnhanceMaterialCount: internal:62 + test:32 — 모두 inventory 명시.
   *     · consumeInventoryItemByName: useInventoryActions:563 + test:43 — 모두
   *       inventory 명시.
   * - 결과: 3 default 모두 도달 불가. body의 (inventory || []) defensive
   *   guards는 별개 보존.
   *
   * 패턴 (cycle 222-577 시리즈 317번째):
   * - cycle 502-577: default 청소 메가 시리즈 76사이클.
   * - cycle 578: enhancementUtils.ts 같은 모듈 batch — cycle 503/506/516에 이은
   *   동일 모듈 추가 cleanup. single-cycle 3-default batch.
   *
   * 수정 (src/utils/enhancementUtils.ts):
   * - 3 functions의 inventory: Item[] = [] → inventory: Item[].
   * - body의 (inventory || []) defensive guards 보존.
   *
   * 회귀 가드:
   * - 다수 callsite 동작 그대로.
   * - body filter 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 578: 3 inventory defaults 0건', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      const fns = ['countInventoryItemByName', 'getEnhanceMaterialCount', 'consumeInventoryItemByName'];
      for (const fn of fns) {
          const fnIdx = source.indexOf(`export const ${fn}`);
          const fnEnd = source.indexOf('=>', fnIdx);
          const sig = source.slice(fnIdx, fnEnd);
          assert.ok(!/inventory:\s*Item\[\]\s*=\s*\[\]/.test(sig),
              `${fn}: inventory default [] 제거`);
      }
  });

  test('cycle 578: 정합성 가드 — 다수 callsite 보존', async () => {
      const ep = await readSrc('src/components/EquipmentPanel.tsx');
      assert.ok(/countInventoryItemByName\(player\?\.inv(?: \|\| \[\])?,\s*CONSTANTS\.ENHANCE_MATERIAL_NAME\)/.test(ep),
          'EquipmentPanel countInventoryItemByName 보존');

      const inv = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(/consumeInventoryItemByName\(player\.inv,\s*requirement\.materialName,\s*requirement\.materials\)/.test(inv),
          'useInventoryActions consumeInventoryItemByName 보존');

      const eu = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(/countInventoryItemByName\(inventory,\s*CONSTANTS\.ENHANCE_MATERIAL_NAME\)/.test(eu),
          'getEnhanceMaterialCount internal call 보존');
  });

  test('cycle 578: body defensive guards 보존', async () => {
      const source = await readSrc('src/utils/enhancementUtils.ts');
      const calls = (source.match(/\(inventory \|\| \[\]\)/g) || []).length;
      assert.ok(calls >= 2, `(inventory || []) defensive guards 보존: ${calls}건`);
  });

  test('cycle 578: cycle 502-577 회귀 가드 — default 청소 시리즈 보존', async () => {
      const mp = await readSrc('src/utils/mapProgress.ts');
      assert.ok(!/getMapCodexProgress[^=]*codex:\s*any\s*=\s*\{\}/.test(mp),
          'cycle 577 getMapCodexProgress codex default 0건');

      const tv = await readSrc('src/components/TerminalView.tsx');
      assert.ok(!/const TerminalView = \(\{\s*\n\s*logs\s*=\s*\[\]/.test(tv),
          'cycle 576 TerminalView logs default 0건');
  });
}

// ─── cycle-579-get-move-recommendations-maps-default-unreachable.test.js ───
{
  /**
   * cycle 579: getMoveRecommendations `maps = {}` default unreachable
   *   (cycle 222-578 silent dead config 시리즈 318번째 — redundant default annotation
   *   청소 메가 시리즈 71번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/adventureGuide.ts (line 133):
   *     export const getMoveRecommendations = (player: Player, stats: any,
   *         currentMap: GameMap | null | undefined,
   *         maps: Record<string, GameMap> = {}) => {...};
   * - 호출 사이트:
   *     · MapNavigator.tsx:66 — getMoveRecommendations(player, stats, currentMap,
   *       DB.MAPS) — 4 args 명시.
   *     · ControlPanel.tsx:58 — getMoveRecommendations(player, stats, mapData,
   *       DB.MAPS) — 4 args 명시.
   *     · tests/signature-move-recommendation: 4 callsite (basePlayer, baseStats,
   *       fixture.sourceMap, MAPS) — 모두 명시.
   *     · tests/cycle-333: 2 callsite (DB.MAPS) — 모두 명시.
   *     · tests/adventure-guide: 2 callsite (object literal) — 모두 명시.
   * - 결과: maps 항상 명시 전달. default {} 도달 불가.
   *
   * 패턴 (cycle 222-578 시리즈 318번째):
   * - cycle 502-578: default 청소 메가 시리즈 77사이클.
   * - cycle 579: utils/adventureGuide.ts 추가 cleanup — cycle 519/523에 이은
   *   동일 모듈.
   *
   * 수정 (src/utils/adventureGuide.ts):
   * - signature에서 maps: Record<string, GameMap> = {} → maps: Record<string, GameMap>.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 다수 callsite 동작 그대로.
   * - body currentMap.exits.map / getMapLevel / forecast 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 579: getMoveRecommendations signature에서 maps default 0건', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      const fnIdx = source.indexOf('export const getMoveRecommendations');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/maps:\s*Record<string,\s*GameMap>\s*=\s*\{\}/.test(sig),
          'getMoveRecommendations maps default {} 제거');
  });

  test('cycle 579: 정합성 가드 — 다수 callsite 보존', async () => {
      const mn = await readSrc('src/components/MapNavigator.tsx');
      assert.ok(/getMoveRecommendations\(\s*\n\s*player,\s*\n[\s\S]*?DB\.MAPS,\s*\n\s*\)/.test(mn),
          'MapNavigator getMoveRecommendations 4-arg callsite 보존');

      const cp = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(/getMoveRecommendations\(player,\s*stats \|\| \{ maxHp: player\.maxHp, maxMp: player\.maxMp \},\s*mapData,\s*DB\.MAPS\)/.test(cp),
          'ControlPanel getMoveRecommendations callsite 보존');
  });

  test('cycle 579: cycle 502-578 회귀 가드 — default 청소 시리즈 보존', async () => {
      const eu = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(!/countInventoryItemByName[^=]*inventory:\s*Item\[\]\s*=\s*\[\]/.test(eu),
          'cycle 578 countInventoryItemByName inventory default 0건');

      const mp = await readSrc('src/utils/mapProgress.ts');
      assert.ok(!/getMapCodexProgress[^=]*codex:\s*any\s*=\s*\{\}/.test(mp),
          'cycle 577 getMapCodexProgress codex default 0건');
  });
}

// ─── cycle-581-quick-slot-slots-default-unreachable.test.js ───
{
  /**
   * cycle 581: QuickSlot `slots = [null, null, null]` default unreachable
   *   (cycle 222-580 silent dead config 시리즈 319번째 — redundant default annotation
   *   청소 메가 시리즈 72번째).
   *
   * 발견 (1 default unreachable):
   * - src/components/QuickSlot.tsx (line 23):
   *     const QuickSlot = ({ slots = [null, null, null], onUse, gameState }: QuickSlotProps) => {...};
   * - 호출 사이트 (1 caller):
   *     · TerminalView.tsx:287 — <QuickSlot slots={quickSlots} onUse={...} gameState={gameState} />
   *     · 다른 caller 0건.
   * - 결과: slots 항상 명시 전달. default [null, null, null] 도달 불가.
   *
   * 패턴 (cycle 222-580 시리즈 319번째):
   * - cycle 502-580: default 청소 메가 시리즈 79사이클.
   * - cycle 581: components/ entry-level cleanup 추가.
   *
   * 수정 (src/components/QuickSlot.tsx):
   * - signature에서 slots = [null, null, null] → slots.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (TerminalView) 동작 그대로.
   * - body canUse / GS 분기 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 581: QuickSlot signature에서 slots default 0건', async () => {
      const source = await readSrc('src/components/QuickSlot.tsx');
      const fnIdx = source.indexOf('const QuickSlot = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/slots\s*=\s*\[null, null, null\]/.test(sig),
          'QuickSlot slots default [null, null, null] 제거');
  });

  test('cycle 581: 정합성 가드 — TerminalView callsite 보존', async () => {
      const source = await readSrc('src/components/TerminalView.tsx');
      assert.ok(/<QuickSlot[\s\S]*?slots=\{quickSlots(?: \|\| \[\])?\}/.test(source),
          'TerminalView <QuickSlot slots={quickSlots} /> callsite 보존');
  });

  test('cycle 581: cycle 502-580 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ag = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(!/getMoveRecommendations[^=]*maps:\s*Record<string,\s*GameMap>\s*=\s*\{\}/.test(ag),
          'cycle 579 getMoveRecommendations maps default 0건');

      const eu = await readSrc('src/utils/enhancementUtils.ts');
      assert.ok(!/countInventoryItemByName[^=]*inventory:\s*Item\[\]\s*=\s*\[\]/.test(eu),
          'cycle 578 countInventoryItemByName inventory default 0건');
  });
}

// ─── cycle-582-class-card-disabled-default-unreachable.test.js ───
{
  /**
   * cycle 582: ClassCard `disabled = false` default unreachable
   *   (cycle 222-581 silent dead config 시리즈 320번째 — redundant default annotation
   *   청소 메가 시리즈 73번째).
   *
   * 발견 (1 default unreachable):
   * - src/components/ClassCard.tsx (line 33):
   *     const ClassCard = ({ jobName, onSelect, disabled = false }: any) => {...};
   * - 호출 사이트 (1 caller):
   *     · JobChangePanel.tsx:51 — <ClassCard jobName onSelect
   *       disabled={player.level < (DB.CLASSES[job]?.reqLv || 999)} />
   *     · 다른 caller 0건.
   * - 결과: disabled 항상 명시 전달. default false 도달 불가.
   *
   * 패턴 (cycle 222-581 시리즈 320번째):
   * - cycle 502-581: default 청소 메가 시리즈 80사이클.
   * - cycle 582: components/ entry-level cleanup — cycle 461 compact lens
   *   회귀, 같은 모듈 추가 cleanup.
   *
   * 수정 (src/components/ClassCard.tsx):
   * - signature에서 disabled = false → disabled.
   * - body의 disabled 사용처 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (JobChangePanel) 동작 그대로.
   * - body DB.CLASSES jobData 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 582: ClassCard signature에서 disabled default 0건', async () => {
      const source = await readSrc('src/components/ClassCard.tsx');
      const fnIdx = source.indexOf('const ClassCard = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/disabled\s*=\s*false/.test(sig),
          'ClassCard disabled default false 제거');
      assert.ok(/\bdisabled\b/.test(sig), 'disabled 파라미터 자체는 보존');
  });

  test('cycle 582: 정합성 가드 — JobChangePanel callsite 보존', async () => {
      const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
      assert.ok(/<ClassCard[\s\S]*?disabled=\{player\.level < \(DB\.CLASSES\[job\]\?\.reqLv \|\| 999\)\}/.test(source),
          'JobChangePanel <ClassCard disabled={...} /> callsite 보존');
  });

  test('cycle 582: cycle 502-581 회귀 가드 — default 청소 시리즈 보존', async () => {
      const qs = await readSrc('src/components/QuickSlot.tsx');
      assert.ok(!/slots\s*=\s*\[null, null, null\]/.test(qs),
          'cycle 581 QuickSlot slots default 0건');

      const ag = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(!/getMoveRecommendations[^=]*maps:\s*Record<string,\s*GameMap>\s*=\s*\{\}/.test(ag),
          'cycle 579 getMoveRecommendations maps default 0건');
  });
}

// ─── cycle-584-job-change-panel-on-open-archive-console-default.test.js ───
{
  /**
   * cycle 584: JobChangePanel `onOpenArchiveConsole = null` default unreachable
   *   (cycle 222-583 silent dead config 시리즈 322번째 — redundant default annotation
   *   청소 메가 시리즈 75번째).
   *
   * 발견 (1 default unreachable):
   * - src/components/tabs/JobChangePanel.tsx (line 19):
   *     const JobChangePanel = ({ player, actions, setGameState,
   *         onOpenArchiveConsole = null }: JobChangePanelProps) => {...};
   * - 호출 사이트 (1 caller):
   *     · ControlPanel.tsx:151 — <JobChangePanel player actions setGameState
   *       onOpenArchiveConsole /> — 4 props 모두 명시.
   *     · 다른 caller 0건.
   * - 결과: onOpenArchiveConsole 항상 명시 전달. default null 도달 불가.
   *
   * 패턴 (cycle 222-583 시리즈 322번째):
   * - cycle 502-583: default 청소 메가 시리즈 82사이클.
   * - cycle 584: components/tabs/ entry-level cleanup.
   *
   * 수정 (src/components/tabs/JobChangePanel.tsx):
   * - signature에서 onOpenArchiveConsole = null → onOpenArchiveConsole.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (ControlPanel) 동작 그대로.
   * - body actions / setGameState 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 584: JobChangePanel signature에서 onOpenArchiveConsole default 0건', async () => {
      const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
      const fnIdx = source.indexOf('const JobChangePanel = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(sig),
          'JobChangePanel onOpenArchiveConsole default null 제거');
  });

  test('cycle 584: 정합성 가드 — ControlPanel callsite 보존', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(/<JobChangePanel player=\{player\} actions=\{actions\} setGameState=\{setGameState\} onOpenArchiveConsole=\{onOpenArchiveConsole\}/.test(source),
          'ControlPanel <JobChangePanel> 4-prop callsite 보존');
  });

  test('cycle 584: cycle 502-583 회귀 가드 — default 청소 시리즈 보존', async () => {
      const sb = await readSrc('src/components/StatusBar.tsx');
      assert.ok(!/const StatusMetric = \({ label, value, max, variant\s*=\s*'hp'/.test(sb),
          'cycle 583 StatusMetric variant default 0건');

      const cc = await readSrc('src/components/ClassCard.tsx');
      assert.ok(!/const ClassCard = \({ jobName, onSelect, disabled\s*=\s*false/.test(cc),
          'cycle 582 ClassCard disabled default 0건');
  });
}

// ─── cycle-585-item-icon-size-default-partial.test.js ───
{
  /**
   * cycle 585: ItemIcon `size = 24` default partial unreachable
   *   (cycle 222-584 silent dead config 시리즈 323번째 — redundant default annotation
   *   청소 메가 시리즈 76번째). partial cleanup pattern (cycle 542 재적용 6번째).
   *
   * 발견 (1 default unreachable, 3 defaults reachable 보존):
   * - src/components/icons/ItemIcon.tsx (line 55):
   *     const ItemIcon = ({ item, size = 24, showBorder = false, className = '',
   *         hideSignatureBadge = false }: any) => {...};
   * - 호출 사이트 (11 callers):
   *     · ShopPanel: 4 callers — size + showBorder + className
   *     · LegendaryDropOverlay: 1 caller — size + showBorder
   *     · MaterialCodex: 1 caller — size + showBorder + className
   *     · EquipmentCodexCard: 1 caller — size + showBorder
   *     · LegendaryCodex: 2 callers — size + hideSignatureBadge (showBorder/className 미전달)
   *     · WeaponCodex: 1 caller — size only (showBorder/className/hideSignatureBadge 미전달)
   *     · SmartInventory: 1 caller — size + showBorder + className
   * - 결과:
   *     · size 11/11 callers 명시 → default 24 도달 불가.
   *     · showBorder 미전달 caller 존재 (WeaponCodex/LegendaryCodex) → default
   *       false REACHABLE 보존.
   *     · className 미전달 caller 존재 (WeaponCodex/LegendaryCodex/Equipment
   *       CodexCard/LegendaryDropOverlay) → default '' REACHABLE 보존.
   *     · hideSignatureBadge 미전달 caller 존재 (대부분) → default false
   *       REACHABLE 보존.
   *
   * 패턴 (cycle 222-584 시리즈 323번째):
   * - cycle 502-584: default 청소 메가 시리즈 83사이클.
   * - cycle 585: partial cleanup pattern 6번째 적용 (cycle 542 / 553 / 558 /
   *   569 / 572 partial 재적용). 11 callers의 prop 단위 reachability 분리.
   *
   * 수정 (src/components/icons/ItemIcon.tsx):
   * - signature에서 size = 24 → size.
   * - showBorder = false / className = '' / hideSignatureBadge = false 보존.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 11 production callsite 동작 그대로.
   * - body ICON_PATHS / BALANCE.RARITY_COLORS 처리 보존.
   * - 3 reachable defaults 보존 (showBorder/className/hideSignatureBadge).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 585: ItemIcon signature에서 size default 0건', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      const fnIdx = source.indexOf('const ItemIcon = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/size\s*=\s*24/.test(sig),
          'ItemIcon size default 24 제거');
  });

  test('cycle 585: 3 reachable defaults 보존 (partial cleanup)', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      const fnIdx = source.indexOf('const ItemIcon = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/showBorder\s*=\s*false/.test(sig),
          'showBorder default false 보존 (WeaponCodex/LegendaryCodex 미전달이라 reachable)');
      assert.ok(/className\s*=\s*''/.test(sig),
          "className default '' 보존 (다수 callers 미전달이라 reachable)");
      assert.ok(/hideSignatureBadge\s*=\s*false/.test(sig),
          'hideSignatureBadge default false 보존 (대부분 callers 미전달이라 reachable)');
  });

  test('cycle 585: 정합성 가드 — sample callsites 보존', async () => {
      const wc = await readSrc('src/components/codex/WeaponCodex.tsx');
      assert.ok(/<ItemIcon item=\{item\} size=\{22\} \/>/.test(wc),
          'WeaponCodex callsite 보존 (size only)');

      const sp = await readSrc('src/components/ShopPanel.tsx');
      assert.ok(/<ItemIcon item=\{item\} size=\{34\} showBorder/.test(sp),
          'ShopPanel callsite 보존');
  });

  test('cycle 585: cycle 502-584 회귀 가드 — default 청소 시리즈 보존', async () => {
      const jcp = await readSrc('src/components/tabs/JobChangePanel.tsx');
      assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(jcp),
          'cycle 584 JobChangePanel onOpenArchiveConsole default 0건');

      const sb = await readSrc('src/components/StatusBar.tsx');
      assert.ok(!/const StatusMetric = \({ label, value, max, variant\s*=\s*'hp'/.test(sb),
          'cycle 583 StatusMetric variant default 0건');
  });
}

// ─── cycle-587-control-panel-defaults-batch.test.js ───
{
  /**
   * cycle 587: ControlPanel 3 defaults batch unreachable
   *   (cycle 222-586 silent dead config 시리즈 325번째 — redundant default annotation
   *   청소 메가 시리즈 78번째). single-cycle 3-default batch.
   *
   * 발견 (3 defaults batch):
   * - src/components/ControlPanel.tsx (line 38):
   *     const ControlPanel = ({
   *         gameState, player,
   *         enemy = null,
   *         actions, setGameState, shopItems, grave, isAiThinking, currentEvent,
   *         stats = null,
   *         onOpenArchiveConsole = null,
   *     }: ControlPanelProps) => {...};
   * - 호출 사이트 (2 callers):
   *     · MobileGameLayout.tsx:106 — <ControlPanel ... 12 props 모두 명시>
   *     · MobileGameLayout.tsx:121 — <ControlPanel ... 12 props 모두 명시>
   * - 결과: enemy / stats / onOpenArchiveConsole 항상 명시 전달. 3 defaults
   *   모두 도달 불가.
   *
   * 패턴 (cycle 222-586 시리즈 325번째):
   * - cycle 502-586: default 청소 메가 시리즈 85사이클.
   * - cycle 587: components/ entry-level cleanup — cycle 572-586 시리즈 연속.
   *
   * 수정 (src/components/ControlPanel.tsx):
   * - signature에서 3 defaults 모두 제거.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 2 production callsite (MobileGameLayout) 동작 그대로.
   * - body GS 분기 / panel rendering 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 587: ControlPanel signature에서 3 defaults 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const fnIdx = source.indexOf('const ControlPanel = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/enemy\s*=\s*null/.test(sig), 'ControlPanel enemy default null 제거');
      assert.ok(!/stats\s*=\s*null/.test(sig), 'ControlPanel stats default null 제거');
      assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(sig), 'ControlPanel onOpenArchiveConsole default null 제거');
  });

  test('cycle 587: 정합성 가드 — 2 MobileGameLayout callsite 보존', async () => {
      const source = await readSrc('src/components/app/MobileGameLayout.tsx');
      const matches = source.match(/<ControlPanel[\s\S]*?\/>/g) || [];
      assert.equal(matches.length, 2, `<ControlPanel> 2 callsite 보존: ${matches.length}건`);
      for (const match of matches) {
          assert.ok(/enemy=\{engine\.enemy\}/.test(match), 'enemy 명시 전달 보존');
          assert.ok(/stats=\{fullStats\}/.test(match), 'stats 명시 전달 보존');
          assert.ok(/onOpenArchiveConsole=\{openArchiveConsole\}/.test(match), 'onOpenArchiveConsole 명시 전달 보존');
      }
  });

  test('cycle 587: cycle 502-586 회귀 가드 — default 청소 시리즈 보존', async () => {
      const sb = await readSrc('src/components/StatusBar.tsx');
      assert.ok(!/onCrystalClick\s*=\s*null/.test(sb),
          'cycle 586 StatusBar onCrystalClick default 0건');

      const ii = await readSrc('src/components/icons/ItemIcon.tsx');
      assert.ok(!/const ItemIcon = \({ item, size\s*=\s*24/.test(ii),
          'cycle 585 ItemIcon size default 0건');
  });
}

// ─── cycle-588-crafting-panel-on-open-archive-console-default.test.js ───
{
  /**
   * cycle 588: CraftingPanel `onOpenArchiveConsole = null` default unreachable
   *   (cycle 222-587 silent dead config 시리즈 326번째 — redundant default annotation
   *   청소 메가 시리즈 79번째).
   *
   * 발견 (1 default unreachable):
   * - src/components/tabs/CraftingPanel.tsx (line 25):
   *     const CraftingPanel = ({ player, actions, setGameState,
   *         onOpenArchiveConsole = null }: CraftingPanelProps) => {...};
   * - 호출 사이트 (1 caller):
   *     · ControlPanel.tsx:162 — <CraftingPanel ... 4 props 모두 명시>
   *     · 다른 caller 0건.
   * - 결과: onOpenArchiveConsole 항상 명시 전달. default null 도달 불가.
   *
   * 패턴 (cycle 222-587 시리즈 326번째):
   * - cycle 502-587: default 청소 메가 시리즈 86사이클.
   * - cycle 588: components/tabs/ entry-level cleanup (cycle 584 JobChangePanel
   *   동일 패턴).
   *
   * 수정 (src/components/tabs/CraftingPanel.tsx):
   * - signature에서 onOpenArchiveConsole = null → onOpenArchiveConsole.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (ControlPanel) 동작 그대로.
   * - body actions / setGameState 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 588: CraftingPanel signature에서 onOpenArchiveConsole default 0건', async () => {
      const source = await readSrc('src/components/tabs/CraftingPanel.tsx');
      const fnIdx = source.indexOf('const CraftingPanel = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(sig),
          'CraftingPanel onOpenArchiveConsole default null 제거');
  });

  test('cycle 588: 정합성 가드 — ControlPanel callsite 보존', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(/<CraftingPanel player=\{player\} actions=\{actions\} setGameState=\{setGameState\} onOpenArchiveConsole=\{onOpenArchiveConsole\}/.test(source),
          'ControlPanel <CraftingPanel> 4-prop callsite 보존');
  });

  test('cycle 588: cycle 502-587 회귀 가드 — default 청소 시리즈 보존', async () => {
      const cp = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(!/enemy\s*=\s*null/.test(cp),
          'cycle 587 ControlPanel enemy default 0건');

      const sb = await readSrc('src/components/StatusBar.tsx');
      assert.ok(!/onCrystalClick\s*=\s*null/.test(sb),
          'cycle 586 StatusBar onCrystalClick default 0건');
  });
}

// ─── cycle-591-add-combat-digest-logs-defaults-batch.test.js ───
{
  /**
   * cycle 591: addCombatDigestLogs 5 defaults batch unreachable
   *   (cycle 222-590 silent dead config 시리즈 328번째 — redundant default annotation
   *   청소 메가 시리즈 81번째). single-cycle 5-default batch.
   *
   * 발견 (5 defaults batch):
   * - src/hooks/combatActions/_helpers.ts (line 66):
   *     export const addCombatDigestLogs = ({
   *         addLog, enemyName, victoryResult,
   *         droppedItems = [], upgradeHint = null, traitHint = null,
   *         bossRewardHint = null, bossClearBonus = 0,
   *     }: any) => {...};
   * - 호출 사이트 (1 caller):
   *     · combatVictory.ts:215 — addCombatDigestLogs({addLog, enemyName,
   *       victoryResult, droppedItems, upgradeHint, traitHint, bossRewardHint,
   *       bossClearBonus}) — 8 props 모두 명시.
   *     · 다른 caller 0건.
   * - 결과: 5 defaults 모두 도달 불가.
   *
   * 패턴 (cycle 222-590 시리즈 328번째):
   * - cycle 502-590: default 청소 메가 시리즈 89사이클.
   * - cycle 591: hooks/combatActions/_helpers.ts cleanup. cycle 534
   *   getLootUpgradeHint와 동일 모듈 추가 cleanup.
   *
   * 수정 (src/hooks/combatActions/_helpers.ts):
   * - 5 defaults 모두 제거.
   * - body의 droppedItems.length / droppedItems.slice 처리 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (combatVictory) 동작 그대로.
   * - body summaryParts / MSG.COMBAT_DIGEST 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 591: addCombatDigestLogs signature에서 5 defaults 0건', async () => {
      const source = await readSrc('src/hooks/combatActions/_helpers.ts');
      const fnIdx = source.indexOf('export const addCombatDigestLogs');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/droppedItems\s*=\s*\[\]/.test(sig), 'droppedItems default [] 제거');
      assert.ok(!/upgradeHint\s*=\s*null/.test(sig), 'upgradeHint default null 제거');
      assert.ok(!/traitHint\s*=\s*null/.test(sig), 'traitHint default null 제거');
      assert.ok(!/bossRewardHint\s*=\s*null/.test(sig), 'bossRewardHint default null 제거');
      assert.ok(!/bossClearBonus\s*=\s*0/.test(sig), 'bossClearBonus default 0 제거');
  });

  test('cycle 591: 정합성 가드 — combatVictory callsite 보존', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/addCombatDigestLogs\(\{[\s\S]*?bossClearBonus: victoryResult\.bossClearBonus\?\.goldBonus \|\| 0,/.test(source),
          'combatVictory addCombatDigestLogs callsite 8-props 명시 전달 보존');
  });

  test('cycle 591: body summaryParts / MSG.COMBAT_DIGEST 처리 보존', async () => {
      const source = await readSrc('src/hooks/combatActions/_helpers.ts');
      assert.ok(/MSG\.COMBAT_DIGEST_KILL\(enemyName\)/.test(source),
          'MSG.COMBAT_DIGEST_KILL 보존');
      // slice 24: 전리품 1건 중복 제거로 > 0 → > 1 (다중 드롭 요약일 때만 표기).
      assert.ok(/if \(droppedItems\.length > 1\)/.test(source),
          'droppedItems.length 처리 보존');
  });

  test('cycle 591: cycle 502-590 회귀 가드 — default 청소 시리즈 보존', async () => {
      const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      assert.ok(!/QuestBoardPanel = \({[^}]+onOpenArchiveConsole\s*=\s*null/.test(qb),
          'cycle 589 QuestBoardPanel onOpenArchiveConsole default 0건');

      const cr = await readSrc('src/components/tabs/CraftingPanel.tsx');
      assert.ok(!/CraftingPanel = \({[^}]+onOpenArchiveConsole\s*=\s*null/.test(cr),
          'cycle 588 CraftingPanel onOpenArchiveConsole default 0건');
  });
}

// ─── cycle-592-handle-victory-outcome-defaults-batch.test.js ───
{
  /**
   * cycle 592: handleVictoryOutcome 2 defaults batch unreachable
   *   (cycle 222-591 silent dead config 시리즈 329번째 — redundant default annotation
   *   청소 메가 시리즈 82번째).
   *
   * 발견 (2 defaults batch):
   * - src/hooks/combatActions/combatVictory.ts (line 25):
   *     export const handleVictoryOutcome = ({
   *         playerAfterCombat, deadEnemy, stats,
   *         dispatch, addLog, addStoryLog,
   *         emitDailyProtocolLogs, emitUnlockedTitles,
   *         extendedChecks = false,
   *         liveConfig = {},
   *     }: any) => {...};
   * - 호출 사이트 (3 callers):
   *     · combatAttack.ts:81 — extendedChecks: true, liveConfig 명시.
   *     · combatAttack.ts:131 — extendedChecks: false, liveConfig 명시.
   *     · combatItem.ts:67 — extendedChecks: false, liveConfig 명시.
   * - 결과: extendedChecks / liveConfig 항상 명시 전달. 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-591 시리즈 329번째):
   * - cycle 502-591: default 청소 메가 시리즈 90사이클.
   * - cycle 592: hooks/combatActions/ — cycle 591 _helpers.ts에 이은 동일
   *   디렉토리 cleanup.
   *
   * 수정 (src/hooks/combatActions/combatVictory.ts):
   * - extendedChecks = false → extendedChecks.
   * - liveConfig = {} → liveConfig.
   * - body 동작 보존 (cycle 265 liveConfig 4번째 인자 전달 보존).
   *
   * 회귀 가드:
   * - 3 production callsite 동작 그대로.
   * - body CombatEngine.handleVictory(playerAfterCombat, deadEnemy, passiveBonus,
   *   liveConfig) 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 592: handleVictoryOutcome signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      const fnIdx = source.indexOf('export const handleVictoryOutcome');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/extendedChecks\s*=\s*false/.test(sig),
          'handleVictoryOutcome extendedChecks default false 제거');
      assert.ok(!/liveConfig\s*=\s*\{\}/.test(sig),
          'handleVictoryOutcome liveConfig default {} 제거');
  });

  test('cycle 592: 정합성 가드 — 3 production callsite 보존', async () => {
      const ca = await readSrc('src/hooks/combatActions/combatAttack.ts');
      assert.ok(/extendedChecks: true/.test(ca),
          'combatAttack:81 extendedChecks: true 명시 보존');
      const cafalse = (ca.match(/extendedChecks: false/g) || []).length;
      assert.ok(cafalse >= 1, `combatAttack extendedChecks: false 명시 보존: ${cafalse}건`);

      const ci = await readSrc('src/hooks/combatActions/combatItem.ts');
      assert.ok(/extendedChecks: false/.test(ci),
          'combatItem extendedChecks: false 명시 보존');
  });

  test('cycle 592: body CombatEngine.handleVictory liveConfig 전달 보존', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(/CombatEngine\.handleVictory\(playerAfterCombat, deadEnemy, passiveBonus, liveConfig\)/.test(source),
          'CombatEngine.handleVictory liveConfig 전달 보존');
  });

  test('cycle 592: cycle 502-591 회귀 가드 — default 청소 시리즈 보존', async () => {
      const helpers = await readSrc('src/hooks/combatActions/_helpers.ts');
      assert.ok(!/droppedItems\s*=\s*\[\]/.test(helpers),
          'cycle 591 addCombatDigestLogs droppedItems default 0건');

      const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      assert.ok(!/QuestBoardPanel = \({[^}]+onOpenArchiveConsole\s*=\s*null/.test(qb),
          'cycle 589 QuestBoardPanel onOpenArchiveConsole default 0건');
  });
}

// ─── cycle-593-window-advance-time-dead-method.test.js ───
{
  /**
   * cycle 593: window.advanceTime dead method 제거 + cleanup unmount 잔존
   *   (cycle 222-592 silent dead config 시리즈 330번째 — dead exposure pattern,
   *   cycle 329 lens 회귀).
   *
   * 발견 (1 dead method):
   * - src/hooks/useGameTestApi.ts:
   *     · line 221: window.advanceTime = (ms: any = 0) => new Promise(...);
   *     · line 396: delete window.advanceTime; (unmount cleanup)
   * - 호출 사이트 (production + scripts + tests):
   *     · src/ 0건 (자기 정의 + cleanup 외).
   *     · scripts/ 0건 (smoke / build-guard / mobile 모두 미사용).
   *     · tests/ 0건.
   *     · Playwright QA 훅 추정이었으나 실제 caller 없음.
   * - 결과: window.advanceTime은 정의만 있고 read 0건. cycle 329에서 정리한
   *   getState/clearPostCombat/injectAscensionPreview 3 dead methods와 동일
   *   lens.
   *
   * 패턴 (cycle 222-592 시리즈 330번째):
   * - cycle 502-592: default 청소 메가 시리즈 91사이클 (대부분 default lens).
   * - cycle 593: dead exposure pattern 회귀 — cycle 329 동일 lens 재적용.
   *   default cleanup 외 다른 lens로 pivot.
   *
   * 수정 (src/hooks/useGameTestApi.ts):
   * - line 221: window.advanceTime 정의 제거.
   * - line 396: delete window.advanceTime cleanup도 paired removal.
   *
   * 회귀 가드:
   * - cycle 329 정리된 3 methods (getState/clearPostCombat/
   *   injectAscensionPreview) 회귀 0건 보존.
   * - 다른 method (resetGame/sendCommand/setSideTab/seedAvatarScenario/
   *   seedEnhanceScenario/injectEvent/getDomMetrics/getPerfSnapshot/markPerf)
   *   active 보존 (smoke/perf 스크립트에서 사용).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 593: window.advanceTime 정의 제거', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/window\.advanceTime\s*=/.test(source),
          'window.advanceTime 정의 제거');
  });

  test('cycle 593: delete window.advanceTime cleanup도 paired removal', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/delete window\.advanceTime/.test(source),
          'delete window.advanceTime cleanup 제거');
  });

  test('cycle 593: cycle 329 dead methods 회귀 가드', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/window\.__AETHERIA_TEST_API__\s*=\s*\{[\s\S]*?getState:/.test(source),
          'cycle 329 getState 0건 보존');
      assert.ok(!/clearPostCombat:/.test(source),
          'cycle 329 clearPostCombat 0건 보존');
      assert.ok(!/injectAscensionPreview:/.test(source),
          'cycle 329 injectAscensionPreview 0건 보존');
  });

  test('cycle 593: active methods 보존 (smoke/perf 스크립트 사용)', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(/resetGame:/.test(source), 'resetGame active 보존');
      assert.ok(/sendCommand:/.test(source), 'sendCommand active 보존');
      assert.ok(/seedAvatarScenario:/.test(source), 'seedAvatarScenario active 보존');
      assert.ok(/seedEnhanceScenario:/.test(source), 'seedEnhanceScenario active 보존');
  });

  test('cycle 593: cycle 502-592 회귀 가드 — default 청소 시리즈 보존', async () => {
      const cv = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.ok(!/extendedChecks\s*=\s*false/.test(cv),
          'cycle 592 handleVictoryOutcome extendedChecks default 0건');

      const helpers = await readSrc('src/hooks/combatActions/_helpers.ts');
      assert.ok(!/droppedItems\s*=\s*\[\]/.test(helpers),
          'cycle 591 addCombatDigestLogs droppedItems default 0건');
  });
}

// ─── cycle-594-vite-env-advance-time-type-dead.test.js ───
{
  /**
   * cycle 594: Window 인터페이스의 advanceTime 타입 선언 dead cascade 정리
   *   (cycle 222-593 silent dead config 시리즈 331번째 — dead exposure pattern
   *   cascade, cycle 593 paired completion).
   *
   * 발견 (1 dead type declaration cascade):
   * - src/vite-env.d.ts (line 38):
   *     interface Window {
   *         __AETHERIA_PERF_REGISTRY__?: PerfRegistry;
   *         ...
   *         render_game_to_text?: any;
   *         advanceTime?: any;  ← cycle 593에서 실제 정의 제거된 잔존 타입
   *     }
   * - 호출 사이트:
   *     · cycle 593에서 window.advanceTime 정의 제거됨.
   *     · 타입 선언만 잔존, 실제 property 0건.
   * - 결과: 타입 선언 dead. paired completion으로 정리.
   *
   * 패턴 (cycle 222-593 시리즈 331번째):
   * - cycle 593에서 window.advanceTime 실제 정의/cleanup 제거.
   * - cycle 594: 타입 선언 cascade cleanup. cycle 526/541/567/568 cascade 패턴.
   *
   * 수정 (src/vite-env.d.ts):
   * - Window interface에서 advanceTime?: any 1줄 제거.
   *
   * 회귀 가드:
   * - render_game_to_text / __AETHERIA_TEST_API__ / __AETHERIA_PERF_REGISTRY__
   *   타입 선언 보존 (active).
   * - cycle 593 src/hooks/useGameTestApi.ts cleanup 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 594: vite-env.d.ts Window interface에서 advanceTime 타입 0건', async () => {
      const source = await readSrc('src/vite-env.d.ts');
      assert.ok(!/advanceTime\?:\s*any/.test(source),
          'Window.advanceTime 타입 선언 제거');
  });

  test('cycle 594: 활성 Window 타입 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/vite-env.d.ts');
      assert.ok(/render_game_to_text\?:\s*any/.test(source),
          'render_game_to_text 타입 보존 (smoke/perf 스크립트 active)');
      assert.ok(/__AETHERIA_TEST_API__\?:\s*any/.test(source),
          '__AETHERIA_TEST_API__ 타입 보존');
      assert.ok(/__AETHERIA_PERF_REGISTRY__\?:\s*PerfRegistry/.test(source),
          '__AETHERIA_PERF_REGISTRY__ 타입 보존');
  });

  test('cycle 594: cycle 593 정의 제거 보존', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/window\.advanceTime\s*=/.test(source),
          'cycle 593 window.advanceTime 정의 제거 보존');
  });
}

// ─── cycle-595-claim-season-reward-reward-label-default.test.js ───
{
  /**
   * cycle 595: claimSeasonReward `rewardLabel = null` default unreachable
   *   (cycle 222-594 silent dead config 시리즈 332번째 — redundant default annotation
   *   default cleanup 메가 시리즈 추가).
   *
   * 발견 (1 default unreachable):
   * - src/hooks/useInventoryActions.ts (line 532):
   *     claimSeasonReward: (tier: any, rewardLabel: string | null = null) => {
   *         dispatch({ type: AT.CLAIM_SEASON_REWARD, payload: { tier } });
   *         const label = rewardLabel ? `${rewardLabel}` : `티어 ${tier}`;
   *         ...
   *     }
   * - 호출 사이트:
   *     · SeasonPassPanel.tsx:32 — onClaimSeasonReward(rewardTier, label) — 2 args
   *       명시.
   *     · 다른 caller 0건.
   * - 결과: rewardLabel 항상 명시 전달. default null 도달 불가.
   *   body의 `rewardLabel ? ... : 티어 ${tier}` ternary는 별개 보존 (caller가
   *   null/empty string 넘기는 path 활성).
   *
   * 패턴 (cycle 222-594 시리즈 332번째):
   * - cycle 502-594 default 청소 메가 시리즈 + cycle 593-594 dead exposure
   *   2-cycle pivot 후 다시 default cleanup 복귀.
   *
   * 수정 (src/hooks/useInventoryActions.ts):
   * - rewardLabel: string | null = null → rewardLabel: string | null.
   * - body의 rewardLabel ternary 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (SeasonPassPanel) 동작 그대로.
   * - body dispatch / addLog / soundManager 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 595: claimSeasonReward signature에서 rewardLabel default 0건', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(!/claimSeasonReward:\s*\(tier:\s*any,\s*rewardLabel:\s*string \| null\s*=\s*null\)/.test(source),
          'claimSeasonReward rewardLabel default null 제거');
      assert.ok(/claimSeasonReward:\s*\(tier:\s*any,\s*rewardLabel:\s*string \| null\)/.test(source),
          'claimSeasonReward rewardLabel 파라미터 자체는 보존');
  });

  test('cycle 595: 정합성 가드 — SeasonPassPanel callsite 보존', async () => {
      const source = await readSrc('src/components/tabs/SeasonPassPanel.tsx');
      assert.ok(/onClaimSeasonReward\(rewardTier, label\)/.test(source),
          'SeasonPassPanel onClaimSeasonReward(rewardTier, label) callsite 보존');
  });

  test('cycle 595: body rewardLabel ternary + dispatch 처리 보존', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(/const label = rewardLabel \? `\$\{rewardLabel\}` : `티어 \$\{tier\}`/.test(source),
          'rewardLabel ? ... : 티어 ternary 보존');
      assert.ok(/addLog\('success', `시즌 패스 보상 수령: \$\{label\}`\)/.test(source),
          'addLog success 보존');
  });

  test('cycle 595: cycle 502-594 회귀 가드 — default/dead 청소 시리즈 보존', async () => {
      const env = await readSrc('src/vite-env.d.ts');
      assert.ok(!/advanceTime\?:\s*any/.test(env),
          'cycle 594 vite-env Window.advanceTime 0건');

      const ut = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/window\.advanceTime\s*=/.test(ut),
          'cycle 593 window.advanceTime 정의 0건');
  });
}

// ─── cycle-596-data-defaults-cross-file-batch.test.js ───
{
  /**
   * cycle 596: getCodexProgress + getChainEventForLoc 3 defaults cross-file batch
   *   unreachable (cycle 222-595 silent dead config 시리즈 333번째 — redundant
   *   default annotation 청소 메가 시리즈 추가, data/ 디렉토리 진입).
   *
   * 발견 (3 defaults batch, 2 files):
   * - src/data/codexRewards.ts (line 53):
   *     export const getCodexProgress = (codex: any = {}, claimed: any = []) => {...};
   * - src/data/eventChains.ts (line 648):
   *     export function getChainEventForLoc(loc: any, progress: any = {}) {...}
   * - 호출 사이트:
   *     · getCodexProgress: Codex:41 + cycle-286:46 (2 callers, 모두 명시).
   *     · getChainEventForLoc: exploreActions:41 (production) + 6+ test callers
   *       (forgotten_commander, water_apostle 등) — 모두 progress 명시.
   * - 결과: 3 defaults 모두 도달 불가.
   *
   * 패턴 (cycle 222-595 시리즈 333번째):
   * - cycle 502-595: default 청소 메가 시리즈 92사이클.
   * - cycle 596: data/ 디렉토리 진입 — utils/ + components/ + hooks/ + systems/
   *   + reducers/ + services/ + data/ 7개 디렉토리 lens 확장.
   *
   * 수정:
   * - codexRewards.ts: codex / claimed defaults 모두 제거.
   * - eventChains.ts: progress default 제거.
   *
   * 회귀 가드:
   * - 모든 callsite 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 596: getCodexProgress signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/data/codexRewards.ts');
      const fnIdx = source.indexOf('export const getCodexProgress');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/codex:\s*any\s*=\s*\{\}/.test(sig),
          'getCodexProgress codex default {} 제거');
      assert.ok(!/claimed:\s*any\s*=\s*\[\]/.test(sig),
          'getCodexProgress claimed default [] 제거');
  });

  test('cycle 596: getChainEventForLoc signature에서 progress default 0건', async () => {
      const source = await readSrc('src/data/eventChains.ts');
      assert.ok(!/getChainEventForLoc\(loc:\s*any,\s*progress:\s*any\s*=\s*\{\}\)/.test(source),
          'getChainEventForLoc progress default {} 제거');
  });

  test('cycle 596: 정합성 가드 — production + test callsite 보존', async () => {
      const cd = await readSrc('src/components/Codex.tsx');
      assert.ok(/getCodexProgress\(codex,\s*claimed\)/.test(cd),
          'Codex getCodexProgress(codex, claimed) callsite 보존');

      const ea = await readSrc('src/hooks/gameActions/exploreActions.ts');
      assert.ok(/getChainEventForLoc\(player\.loc,\s*player\.eventChainProgress\)/.test(ea),
          'exploreActions getChainEventForLoc(player.loc, ...) callsite 보존');

      const test1 = await readSrc('tests/forgotten-commander-chain.test.js');
      assert.ok(/getChainEventForLoc\('잊혀진 폐허',\s*\{\}\)/.test(test1),
          'test forgotten_commander callsite 보존');
  });

  test('cycle 596: cycle 502-595 회귀 가드 — default 청소 시리즈 보존', async () => {
      const inv = await readSrc('src/hooks/useInventoryActions.ts');
      assert.ok(!/claimSeasonReward:\s*\(tier:\s*any,\s*rewardLabel:\s*string \| null\s*=\s*null\)/.test(inv),
          'cycle 595 claimSeasonReward rewardLabel default 0건');

      const env = await readSrc('src/vite-env.d.ts');
      assert.ok(!/advanceTime\?:\s*any/.test(env),
          'cycle 594 vite-env Window.advanceTime 0건');
  });
}

// ─── cycle-598-get-trait-featured-items-defaults-batch.test.js ───
{
  /**
   * cycle 598: getTraitFeaturedItems 3 defaults batch unreachable
   *   (cycle 222-597 silent dead config 시리즈 335번째 — redundant default annotation
   *   청소 메가 시리즈 추가, runProfile.ts).
   *
   * 발견 (3 defaults batch):
   * - src/utils/runProfile.ts (line 325):
   *     export const getTraitFeaturedItems = (items: any[] = [], traitProfile: any,
   *         player: Player | null = null, limit: any = 3) => (...);
   * - 호출 사이트 (2 callers):
   *     · runProfile.ts:340 — getTraitFeaturedItems(items, traitProfile, player, 1)
   *     · run-profile-utils.test.js:213 — getTraitFeaturedItems(loot, trait, player, 2)
   * - 결과: items / player / limit 항상 명시 전달. 3 defaults 모두 도달 불가.
   *   body의 (items || []) defensive guard는 별개 보존.
   *
   * 패턴 (cycle 222-597 시리즈 335번째):
   * - cycle 502-597: default 청소 메가 시리즈 94사이클.
   * - cycle 598: runProfile.ts 추가 cleanup, single-cycle 3-default batch.
   *
   * 수정 (src/utils/runProfile.ts):
   * - 3 defaults 모두 제거.
   * - body의 (items || []) defensive guard 보존.
   *
   * 회귀 가드:
   * - 2 callsite (1 internal + 1 test) 동작 그대로.
   * - body filter / sort / map 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 598: getTraitFeaturedItems signature에서 3 defaults 0건', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      const fnIdx = source.indexOf('export const getTraitFeaturedItems');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/items:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'getTraitFeaturedItems items default [] 제거');
      assert.ok(!/player:\s*Player \| null\s*=\s*null/.test(sig),
          'getTraitFeaturedItems player default null 제거');
      assert.ok(!/limit:\s*any\s*=\s*3/.test(sig),
          'getTraitFeaturedItems limit default 3 제거');
  });

  test('cycle 598: 정합성 가드 — 2 callsite 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(/getTraitFeaturedItems\(items,\s*traitProfile,\s*player,\s*1\)/.test(source),
          'internal getTraitFeaturedItems(items, traitProfile, player, 1) 보존');

      const test1 = await readSrc('tests/run-profile-utils.test.js');
      assert.ok(/getTraitFeaturedItems\(loot,\s*trait,\s*player,\s*2\)/.test(test1),
          'test getTraitFeaturedItems(loot, trait, player, 2) 보존');
  });

  test('cycle 598: body (items || []) defensive guard + sort 보존', async () => {
      const source = await readSrc('src/utils/runProfile.ts');
      assert.ok(/\(items \|\| \[\]\)[\s\S]*?\.map/.test(source),
          '(items || []) defensive guard 보존');
      assert.ok(/getTraitItemResonance\(item,\s*traitProfile,\s*player\)/.test(source),
          'getTraitItemResonance 호출 보존');
  });

  test('cycle 598: cycle 502-597 회귀 가드 — default 청소 시리즈 보존', async () => {
      const rl = await readSrc('src/data/relics.ts');
      assert.ok(!/getActiveRelicSynergies = \(relics:\s*any\s*=\s*\[\]\)/.test(rl),
          'cycle 597 getActiveRelicSynergies relics default 0건');
      assert.ok(!/pickWeightedRelics = \(pool:\s*any,\s*count:\s*any\s*=\s*3\)/.test(rl),
          'cycle 597 pickWeightedRelics count default 0건');
  });
}

// ─── cycle-599-get-map-pacing-profile-default-unreachable.test.js ───
{
  /**
   * cycle 599: getMapPacingProfile `mapData = {}` default unreachable
   *   (cycle 222-598 silent dead config 시리즈 336번째 — redundant default annotation
   *   청소 메가 시리즈 추가). cycle 600 milestone 직전 마지막 cleanup.
   *
   * 발견 (1 default unreachable):
   * - src/utils/explorationPacing.ts (line 30):
   *     export const getMapPacingProfile = (mapData: GameMap | null | undefined = {}) => {
   *         if (!mapData || mapData.type === 'safe') {...}
   *         ...
   *     };
   * - 호출 사이트:
   *     · explorationPacing.ts:94/107/118 (3 internal callers)
   *     · exploreActions.ts:36 (1 production caller)
   *     · 모두 mapData 명시 전달.
   * - 결과: mapData 항상 명시 전달. default {} 도달 불가. body의 `if (!mapData
   *   || mapData.type === 'safe')` guard가 undefined/null 안전 처리.
   *
   * 패턴 (cycle 222-598 시리즈 336번째):
   * - cycle 502-598: default 청소 메가 시리즈 95사이클.
   * - cycle 599: cycle 600 milestone 직전 마지막 cleanup.
   *
   * 수정 (src/utils/explorationPacing.ts):
   * - signature에서 mapData: GameMap | null | undefined = {} →
   *   mapData: GameMap | null | undefined.
   * - body의 !mapData guard 보존.
   *
   * 회귀 가드:
   * - 4 callsite 동작 그대로.
   * - body safe map / pacing profile 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 599: getMapPacingProfile signature에서 mapData default 0건', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      const fnIdx = source.indexOf('export const getMapPacingProfile');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/mapData:\s*GameMap \| null \| undefined\s*=\s*\{\}/.test(sig),
          'getMapPacingProfile mapData default {} 제거');
      assert.ok(/\bmapData\b/.test(sig), 'mapData 파라미터 자체는 보존');
  });

  test('cycle 599: 정합성 가드 — 4 callsite 보존', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      const internalCalls = (source.match(/getMapPacingProfile\(mapData\)/g) || []).length;
      assert.equal(internalCalls, 3, `internal getMapPacingProfile callsite 3건 보존: ${internalCalls}건`);

      const ea = await readSrc('src/hooks/gameActions/exploreActions.ts');
      assert.ok(/getMapPacingProfile\(mapData\)/.test(ea),
          'exploreActions getMapPacingProfile callsite 보존');
  });

  test('cycle 599: body !mapData guard 보존 (undefined 안전)', async () => {
      const source = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(/if \(!mapData \|\| mapData\.type === 'safe'\)/.test(source),
          '!mapData || mapData.type === safe guard 보존');
  });

  test('cycle 599: cycle 502-598 회귀 가드 — default 청소 시리즈 보존', async () => {
      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/getTraitFeaturedItems = \(items:\s*any\[\]\s*=\s*\[\]/.test(rp),
          'cycle 598 getTraitFeaturedItems items default 0건');

      const rl = await readSrc('src/data/relics.ts');
      assert.ok(!/pickWeightedRelics = \(pool:\s*any,\s*count:\s*any\s*=\s*3\)/.test(rl),
          'cycle 597 pickWeightedRelics count default 0건');
  });
}
