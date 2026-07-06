import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * 상태이상(Status) cycle 테스트 (audit #1 통합 10개)
 */

// ─── cycle-111-status-bar-debuff-chip.test.js ───
{
  /**
   * cycle 111: StatusBar에 active debuff chip 추가 — cycle 106-110에서 활성화된
   * status 효과의 시각 노출.
   *
   * 발견:
   * - cycle 106-110에서 player.status 5종(bleed/freeze/stun/curse/blind/fear)
   *   효과를 정상 작동시켰으나, 플레이어가 현재 어떤 status에 걸렸는지 UI에
   *   영구 노출되는 surface가 없음.
   * - 전투 로그는 부여 시점에만 1번 출력되고 스크롤되어 사라짐.
   * - StatusBar에는 killStreak 칩(cycle?), signature 칩(cycle 22), affinity 칩이
   *   있지만 debuff 칩은 비어있던 자리.
   *
   * 추가:
   * - StatusBar에 player.status가 존재하고 길이 > 0이면 debuff chip 노출.
   * - data-testid="status-debuff-chip", data-debuff-count attribute로 selectable.
   * - 시각적 톤: 위험(red/rose) 계열 — 모든 5종 status가 player에 부정적이므로
   *   단일 위험 톤으로 통합.
   * - 라벨: 첫 번째 status 한국어명 (또는 "디버프 N개" 형식).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('StatusBar: status-debuff-chip testid 노출', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      assert.match(source, /data-testid\s*=\s*["']status-debuff-chip["']/);
  });

  test('StatusBar: data-debuff-count attribute 노출 (테스트용 selectable)', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      assert.match(source, /data-debuff-count/);
  });

  test('StatusBar: debuff chip이 player.status 길이 조건부 렌더', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      // player.status에 의존하는 조건부 렌더 패턴
      const idx = source.indexOf('status-debuff-chip');
      assert.ok(idx > -1, 'chip should exist');
      const window = source.slice(Math.max(0, idx - 800), idx);
      assert.match(window, /player\.status|player\?\.status/);
      assert.match(window, /\.length/);
  });

  test('StatusBar: 한국어 라벨 매핑 (bleed→출혈, curse→저주 등)', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      // 5종 상태 한국어 라벨 모두 등장
      const labels = ['출혈', '저주', '빙결', '실명', '공포'];
      for (const label of labels) {
          assert.ok(source.includes(label), `should map to '${label}'`);
      }
  });

  test('StatusBar: 기존 signature 칩 / killStreak 칩 회귀 보존', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      assert.match(source, /data-testid\s*=\s*["']status-signature-chip["']/);
      assert.match(source, /killStreak/);
  });
}

// ─── cycle-112-rest-clears-status.test.js ───
{
  /**
   * cycle 112: rest 시 player.status 정리 — cycle 106-110 status 복구 후속 UX.
   *
   * 발견:
   * - cycle 106-110에서 5종 status(bleed/freeze/stun/curse/blind/fear)가 player에
   *   영향을 주도록 복구. 그러나 rest 액션은 HP/MP만 회복하고 player.status는
   *   그대로 유지.
   * - 결과: 보스 phase 부여한 curse/blind 등이 안전지대 휴식 후에도 남아있어
   *   일반 탐험에서도 페널티 적용. 회피 옵션은 cure item 4종(해독제/치료약/
   *   해빙제/저주해제 주문서)뿐 — bleed/blind/fear/stun cure는 없는 상태라
   *   rest로도 못 푸는 영구 디버프 상황 가능.
   *
   * 수정:
   * - rest 액션에서 player.status = [] 로 초기화 (HP/MP 회복과 함께).
   * - 안전지대에서 며칠간 회복하는 휴식의 자연스러운 의미 — 모든 상태이상
   *   해소.
   *
   * 영향:
   * - cure item이 없어도 안전지대 복귀 + rest로 디버프 해소 가능.
   * - rest 비용은 그대로 (BALANCE.REST_COST 기반 레벨 비례) — UX 안전망 추가.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('characterActions.rest: status 배열 초기화 코드 존재', async () => {
      const source = await readSrc('src/hooks/gameActions/characterActions.ts');
      // rest 액션 안에서 status: [] 또는 status: [] 패턴
      const idx = source.indexOf('rest: () =>');
      assert.ok(idx > -1, 'rest action should exist');
      // rest 함수 끝(다음 액션 시작)까지 추출
      const restBlock = source.slice(idx, source.indexOf('swapSkillChoice', idx));
      assert.match(restBlock, /status:\s*\[\s*\]/, 'rest should reset status array');
  });

  test('characterActions.rest: HP/MP 회복 + rests 증분 회귀 보존', async () => {
      const source = await readSrc('src/hooks/gameActions/characterActions.ts');
      const idx = source.indexOf('rest: () =>');
      const restBlock = source.slice(idx, source.indexOf('swapSkillChoice', idx));
      assert.match(restBlock, /hp:\s*stats\.maxHp/);
      assert.match(restBlock, /mp:\s*stats\.maxMp/);
      assert.match(restBlock, /rests:.*\+\s*1/);
  });

  test('characterActions.rest: REST_SAFE_ONLY 가드 회귀 보존', async () => {
      const source = await readSrc('src/hooks/gameActions/characterActions.ts');
      const idx = source.indexOf('rest: () =>');
      const restBlock = source.slice(idx, source.indexOf('swapSkillChoice', idx));
      assert.match(restBlock, /REST_SAFE_ONLY/);
  });
}

// ─── cycle-458-status-metric-inline-unreachable.test.js ───
{
  /**
   * cycle 458: StatusBar `StatusMetric` `inline` prop + `if (inline)` 분기 unreachable 정리
   *   (cycle 222-457 silent dead config 시리즈 214번째 — unreachable code path
   *   cleanup lens, cycle 357-359/361-363/421/425/444/448/449 패턴).
   *
   * 발견 (1 prop + 1 분기 unreachable):
   * - src/components/StatusBar.tsx (line 25):
   *     const StatusMetric = ({ ..., inline = false }: any) => {
   *         ...
   *         if (inline) { return <inline-render>; }   // line 31-46
   *         return <default-render>;                   // line 48+
   *     }
   * - 호출 사이트 분석 (전체 src/ tsx):
   *     · StatusBar.tsx:243-245 — 3 callsite 모두 `compact` 만 전달, `inline` 0건.
   *     · 다른 파일 import 0건 (StatusMetric은 internal const).
   * - 결과: inline은 항상 false → if (inline) 본체 unreachable. 16줄 dead.
   *
   * 패턴 (cycle 222-457 시리즈 214번째):
   * - cycle 357-359/361-363/421/425/444/448/449: 내부 분기 / lookup이 production
   *   진입 0건이라 unreachable.
   * - cycle 458: StatusMetric inline 분기 — caller 0건 → 분기 자체 unreachable.
   *
   * 수정 (src/components/StatusBar.tsx):
   * - destructure에서 `inline = false` 제거.
   * - if (inline) { ... } 블록 (line 31-46) 제거.
   * - default render만 남김.
   *
   * 회귀 가드:
   * - compact / dense / variant 본체 분기 그대로.
   * - 3 callsite 동작 변동 0.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 458: StatusMetric destructure에서 inline 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const StatusMetric =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\binline\b/.test(sig), 'destructure에 inline 0건');
  });

  test('cycle 458: if (inline) 분기 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const StatusMetric =');
      const fnEnd = source.indexOf('const EnemyStatus =', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/if\s*\(\s*inline\s*\)/.test(block), 'if (inline) 분기 제거');
  });

  test('cycle 458: 정합성 가드 — 3 callsite inline 전달 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const callMatches = source.match(/<StatusMetric[^/]*\/>/g) || [];
      assert.equal(callMatches.length, 3, 'StatusMetric 호출 3건');
      callMatches.forEach((call, i) => {
          assert.ok(!/\binline\b/.test(call), `callsite ${i}에 inline 전달 0건`);
      });
  });

  test('cycle 458: variant 매핑 보존 (cycle 491이 compact/dense ternary cascade 정리)', async () => {
      // cycle 491이 StatusMetric의 compact / dense props cascade로 ternary 자체 제거.
      // 이전 ternary 보존 가드 → variant 매핑만 보존 가드로 약화.
      const source = await readSrc('src/components/StatusBar.tsx');
      assert.ok(/METER_THEME\[variant\]/.test(source), 'variant 매핑 보존');
  });
}

// ─── cycle-459-enemy-status-compact-unreachable.test.js ───
{
  /**
   * cycle 459: StatusBar `EnemyStatus` `compact` prop unreachable 정리
   *   (cycle 222-458 silent dead config 시리즈 215번째 — unreachable code path
   *   cleanup lens, cycle 357-359/421/425/444/448/449/458 패턴).
   *
   * 발견 (1 prop + 6 ternary 가지 unreachable):
   * - src/components/StatusBar.tsx (line 50):
   *     const EnemyStatus = ({ enemy, mobile = false, compact = false }: any) => {...}
   * - 호출 사이트 분석 (전체 src/):
   *     · StatusBar.tsx:234 — 1 callsite: <EnemyStatus enemy={enemy} mobile />
   *     · 전체 다른 caller 0건 (internal const, export 0건).
   *     · compact 전달 caller 0건 → 항상 false.
   * - 결과:
   *     · destructure default 0 override.
   *     · 본체 6 ternary (`compact ? X : Y`) 모두 Y 선택 (line 58/62/66/67/72/75).
   *     · line 58은 chained `mobile ? A : compact ? B : C` — mobile=true(call shorthand)로
   *       항상 A 선택, compact 가지 진입 0건.
   *
   * 패턴 (cycle 222-458 시리즈 215번째):
   * - cycle 458: StatusMetric inline prop unreachable.
   * - cycle 459: EnemyStatus compact prop unreachable — 동일 lens, 같은 파일 paired.
   *
   * 수정 (src/components/StatusBar.tsx):
   * - destructure에서 `compact = false` 제거.
   * - 본체 6 ternary `compact ? X : Y` → Y만 남김.
   * - line 58 chained `mobile ? A : compact ? B : C` → `mobile ? A : C`.
   *
   * 회귀 가드:
   * - mobile prop / 분기 그대로 (active read).
   * - 1 callsite 동작 변동 0 (mobile=true → first branch 그대로).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 459: EnemyStatus destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const EnemyStatus =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 459: EnemyStatus 본체 compact ternary 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const EnemyStatus =');
      const fnEnd = source.indexOf('interface StatusBarProps', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/compact\s*\?/.test(block), 'compact ternary 0건');
      assert.ok(!/\bcompact\b/.test(block), '본체 compact 참조 0건');
  });

  test('cycle 459: 정합성 가드 — 1 callsite compact 전달 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const callMatches = source.match(/<EnemyStatus[^/]*\/>/g) || [];
      assert.equal(callMatches.length, 1, 'EnemyStatus 호출 1건');
      assert.ok(!/\bcompact\b/.test(callMatches[0]), 'callsite에 compact 전달 0건');
  });

  test('cycle 459: mobile prop cycle 492 cascade로 prop 자체 제거', async () => {
      // cycle 492가 EnemyStatus mobile prop cascade로 정리. 이전 가드 → cascade
      // 보존 가드로 약화.
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const EnemyStatus =');
      const fnEnd = source.indexOf('interface StatusBarProps', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bmobile\b/.test(block), 'cycle 492 cascade로 mobile 제거 보존');
  });
}

// ─── cycle-491-status-metric-compact-dense-cascade.test.js ───
{
  /**
   * cycle 491: StatusMetric `compact` + `dense` props cascade unreachable 정리
   *   (cycle 222-490 silent dead config 시리즈 242번째 — unreachable code path
   *   cleanup lens, cycle 458-459 같은 파일 paired 변형 회귀).
   *
   * 발견 (2 props + chained ternary 가지 unreachable):
   * - src/components/StatusBar.tsx (line 27):
   *     const StatusMetric = ({ label, value, max, variant = 'hp',
   *         compact = false, dense = false }: any) => {
   *     body: `${dense ? X : compact ? Y : Z}` chained ternary 3건
   * - 호출 사이트 분석:
   *     · StatusBar.tsx:231-233 — 3 callsite 모두 `compact` shorthand (= true) 전달.
   *     · 0 callsite passes `dense`.
   *     · StatusMetric은 internal const, export 0건.
   * - 결과:
   *     · dense 항상 false → ternary first 가지 (X) 항상 unreachable.
   *     · compact 항상 true → ternary middle 가지 (Y) 항상 진입. last 가지 (Z) unreachable.
   *
   * 패턴 (cycle 222-490 시리즈 242번째):
   * - cycle 458 같은 파일에서 StatusMetric inline prop unreachable.
   * - cycle 459 EnemyStatus compact unreachable.
   * - cycle 491: 같은 컴포넌트의 잔존 cascade unreachable 추가 정리.
   *
   * 수정 (src/components/StatusBar.tsx):
   * - StatusMetric destructure에서 compact = false / dense = false 제거.
   * - body 3 chained ternary → compact 가지만 inline (Y).
   * - 3 callsite의 compact shorthand 제거 (prop 자체 제거되므로).
   *
   * 회귀 가드:
   * - label / value / max / variant prop 보존.
   * - 3 callsite 시각 출력은 cycle 74 readability pass 기준
   *   aether-status-metric / px-2 py-1 / text-[8px] / mt-1 h-[3px]로 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 491: StatusMetric destructure에서 compact / dense 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const StatusMetric =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
      assert.ok(!/\bdense\b/.test(sig), 'destructure에 dense 0건');
  });

  test('cycle 491: StatusMetric 본체 compact / dense 참조 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const StatusMetric =');
      const fnEnd = source.indexOf('const EnemyStatus =', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(block), '본체 compact 참조 0건');
      assert.ok(!/\bdense\b/.test(block), '본체 dense 참조 0건');
  });

  test('cycle 491: 정합성 가드 — 3 callsite compact 명시 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const matches = source.match(/<StatusMetric[^/]*\/>/g) || [];
      assert.equal(matches.length, 3, 'StatusMetric 호출 3건');
      matches.forEach((m, i) => {
          assert.ok(!/\bcompact\b/.test(m), `callsite ${i}에 compact 명시 0건`);
          assert.ok(!/\bdense\b/.test(m), `callsite ${i}에 dense 명시 0건`);
      });
  });

  test('cycle 491: compact 가지 className 정적 inline (aether-status-metric / px-2 py-1 / text-[8px] / mt-1 h-[3px])', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const StatusMetric =');
      const fnEnd = source.indexOf('const EnemyStatus =', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(/aether-status-metric/.test(block), 'readability metric surface 보존');
      assert.ok(/px-2 py-1/.test(block), 'compact 가지 padding 보존');
      assert.ok(/text-\[8px\]/.test(block), 'compact 가지 font size 보존');
      assert.ok(/mt-1 h-\[3px\]/.test(block), 'compact 가지 bar 크기 보존');
  });

  test('cycle 491: label / value / max / variant prop 보존', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const StatusMetric =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\blabel\b/.test(sig), 'label 보존');
      assert.ok(/\bvalue\b/.test(sig), 'value 보존');
      assert.ok(/\bmax\b/.test(sig), 'max 보존');
      assert.ok(/variant/.test(sig), 'variant 보존');
  });
}

// ─── cycle-492-enemy-status-mobile-cascade.test.js ───
{
  /**
   * cycle 492: EnemyStatus `mobile` prop 항상 truthy cascade unreachable 정리
   *   (cycle 222-491 silent dead config 시리즈 243번째 — unreachable code path
   *   cascade cleanup, cycle 491 paired 같은 파일 변형).
   *
   * 발견 (1 prop + 2 ternary 가지 unreachable):
   * - src/components/StatusBar.tsx (line 56):
   *     const EnemyStatus = ({ enemy, mobile = false }: any) => {...
   *         className={`... ${mobile ? 'px-2.75 py-2.5' : 'px-3 py-2.5'}`}
   *         {mobile ? 'Target Lock' : 'Combat Target'}
   * - 호출 사이트 분석:
   *     · StatusBar.tsx:240 — 1 callsite: <EnemyStatus enemy={enemy} mobile />
   *     · 다른 파일 import 0건 (internal const).
   *     · 0 callsite passes mobile=false. shorthand mobile=true만.
   * - 결과: mobile 항상 true → 2 ternary 첫 가지만 진입, 둘째 가지 (Combat Target /
   *   px-3 py-2.5) unreachable.
   *
   * 패턴 (cycle 222-491 시리즈 243번째):
   * - cycle 491: StatusMetric compact / dense cascade.
   * - cycle 492: EnemyStatus mobile cascade — 같은 파일 paired 후속.
   *
   * 수정 (src/components/StatusBar.tsx):
   * - EnemyStatus destructure에서 mobile = false 제거.
   * - className의 mobile 가지 → 'px-2.75 py-2.5' inline.
   * - "Target Lock" 텍스트 inline.
   * - 1 callsite의 mobile shorthand 제거.
   *
   * 회귀 가드:
   * - enemy prop 보존.
   * - 본체 enemy.name / enemy.isBoss / HP bar / SignalBadge / percentage 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 492: EnemyStatus destructure에서 mobile 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const EnemyStatus =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bmobile\b/.test(sig), 'destructure에 mobile 0건');
  });

  test('cycle 492: EnemyStatus 본체 mobile 참조 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const EnemyStatus =');
      const fnEnd = source.indexOf('interface StatusBarProps', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bmobile\b/.test(block), '본체 mobile 참조 0건');
  });

  test('cycle 492: 정합성 가드 — 1 callsite mobile 명시 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const matches = source.match(/<EnemyStatus[^/]*\/>/g) || [];
      assert.equal(matches.length, 1, 'EnemyStatus 호출 1건');
      assert.ok(!/\bmobile\b/.test(matches[0]), 'callsite mobile 명시 0건');
  });

  test('cycle 492: 본체 정적 inline (px-2.75 py-2.5 / Target Lock 텍스트)', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      assert.ok(/px-2\.75 py-2\.5/.test(source), 'mobile 가지 padding 보존');
      assert.ok(/Target Lock/.test(source), 'Target Lock 텍스트 보존');
      assert.ok(!/Combat Target/.test(source), 'Combat Target (비-mobile 가지) 제거');
  });

  test('cycle 492: enemy prop / 본체 핵심 로직 보존', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const EnemyStatus =');
      const fnEnd = source.indexOf('interface StatusBarProps', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(/enemy/.test(block), 'enemy prop 보존');
      assert.ok(/isBoss/.test(block), 'enemy.isBoss 분기 보존');
      assert.ok(/percentage/.test(block), 'percentage HP bar 보존');
  });
}

// ─── cycle-495-status-bar-class-name-unreachable.test.js ───
{
  /**
   * cycle 495: StatusBar `className` prop unreachable 정리
   *   (cycle 222-494 silent dead config 시리즈 246번째 — unreachable code path
   *   cleanup lens, cycle 463/465/466/493 같은 패턴 회귀).
   *
   * 발견 (1 prop unreachable):
   * - src/components/StatusBar.tsx (line 97-108):
   *     interface StatusBarProps { ..., className?: string, ... }
   *     destructure: className = ''
   *     body line 125: className={`... ${className}`.trim()}
   * - 호출 사이트 분석:
   *     · GameRoot.tsx:89 — <StatusBar /> 호출 (className 0건).
   *     · 다른 파일 import 0건.
   * - 결과: className 항상 ''. body의 ${className} 보간은 .trim()으로 빈 문자열만
   *   제거되는 unreachable.
   *
   * 패턴 (cycle 222-494 시리즈 246번째):
   * - cycle 463/465/466: ClassIcon/MonsterIcon/SignatureBadge className unreachable.
   * - cycle 493: AetherMark className unreachable.
   * - cycle 495: StatusBar className unreachable — 동일 lens 회귀.
   *
   * 수정 (src/components/StatusBar.tsx):
   * - interface에서 className?: string 제거.
   * - destructure에서 className = '' 제거.
   * - body className 템플릿에서 ${className} 보간 제거 → 정적 문자열 (.trim() 제거).
   *
   * 회귀 가드:
   * - player / stats / enemy / onCrystalClick / isMuted / onToggleMute /
   *   onOpenEquipment props 보존.
   * - 1 callsite 동작 변동 0.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 495: StatusBar destructure에서 className 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const StatusBar = ({');
      const fnEnd = source.indexOf('}: StatusBarProps', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bclassName\b/.test(block), 'destructure에 className 0건');
  });

  test('cycle 495: interface에서 className 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const ifaceIdx = source.indexOf('interface StatusBarProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bclassName\b/.test(block), 'interface에 className 0건');
  });

  test('cycle 495: body ${className} 보간 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      // body 'className' attribute 자체는 여러 div에 있으므로 ${className} interpolation만 검사
      assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
  });

  test('cycle 495: 정합성 가드 — GameRoot <StatusBar> className 전달 0건', async () => {
      const source = await readSrc('src/components/app/GameRoot.tsx');
      const idx = source.indexOf('<StatusBar');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/className=/.test(jsx), 'GameRoot <StatusBar> className 전달 0건');
  });

  test('cycle 495: 핵심 props 보존', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const StatusBar = ({');
      const fnEnd = source.indexOf('}: StatusBarProps', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(block), 'player prop 보존');
      assert.ok(/\bstats\b/.test(block), 'stats prop 보존');
      assert.ok(/\benemy\b/.test(block), 'enemy prop 보존');
      assert.ok(/onCrystalClick/.test(block), 'onCrystalClick prop 보존');
      assert.ok(/isMuted/.test(block), 'isMuted prop 보존');
      assert.ok(/onToggleMute/.test(block), 'onToggleMute prop 보존');
      assert.ok(/onOpenEquipment/.test(block), 'onOpenEquipment prop 보존');
  });
}

// ─── cycle-549-tick-enemy-status-3-defaults-batch.test.js ───
{
  /**
   * cycle 549: tickEnemyStatus 3 defaults batch unreachable
   *   (cycle 222-548 silent dead config 시리즈 291번째 — redundant default annotation
   *   청소 메가 시리즈 44번째). single-cycle 3-default batch.
   *
   * 발견 (3 defaults batch):
   * - src/systems/CombatEngine.ts (line 268):
   *     tickEnemyStatus(enemy: Monster, logs: any[] = [], curseAmpMult = 1,
   *         synergyDotMult = 1) {...}
   * - 호출 사이트 (1 internal callsite):
   *     · CombatEngine.ts:1076 — this.tickEnemyStatus(updatedEnemy, [],
   *       curseAmpMult, synergyDotMult)
   *     · 외부 caller 0건, test caller 0건.
   * - 결과: 4 args 모두 명시 전달. 3 defaults 모두 도달 불가.
   *
   * 패턴 (cycle 222-548 시리즈 291번째):
   * - cycle 502-548: default 청소 메가 시리즈 47사이클.
   * - cycle 549: tickEnemyStatus single-cycle 3-default batch — cycle 524/527
   *   에 이은 single-cycle multi-default 패턴.
   *
   * 수정 (src/systems/CombatEngine.ts):
   * - signature에서 logs: any[] = [] → logs: any[].
   * - signature에서 curseAmpMult = 1 → curseAmpMult: any.
   * - signature에서 synergyDotMult = 1 → synergyDotMult: any.
   * - body의 dot / status 처리 보존.
   *
   * 회귀 가드:
   * - 1 internal callsite 동작 그대로.
   * - body DoT 계산 + curseAmpMult / synergyDotMult 사용처 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 549: tickEnemyStatus signature에서 3 defaults 0건', async () => {
      // tickEnemyStatus는 CombatEngine.status.ts로 분리됨 (mixin).
      const source = await readSrc('src/systems/CombatEngine.status.ts');
      const fnIdx = source.indexOf('tickEnemyStatus(enemy');
      const fnEnd = source.indexOf(')', fnIdx) + 1;
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/logs:\s*any\[\]\s*=\s*\[\]/.test(sig),
          'tickEnemyStatus logs default [] 제거');
      assert.ok(!/curseAmpMult\s*=\s*1/.test(sig),
          'tickEnemyStatus curseAmpMult default 1 제거');
      assert.ok(!/synergyDotMult\s*=\s*1/.test(sig),
          'tickEnemyStatus synergyDotMult default 1 제거');
  });

  test('cycle 549: 정합성 가드 — 1 internal callsite 보존', async () => {
      // enemyAttack(호출부)은 CombatEngine.enemyAI.ts로 분리됨 (mixin).
      const source = await readSrc('src/systems/CombatEngine.enemyAI.ts');
      assert.ok(/this\.tickEnemyStatus\(updatedEnemy,\s*\[\],\s*curseAmpMult,\s*synergyDotMult\)/.test(source),
          'tickEnemyStatus(updatedEnemy, [], curseAmpMult, synergyDotMult) callsite 보존');
  });

  test('cycle 549: body DoT 계산 + dotMult 사용처 보존', async () => {
      // tickEnemyStatus 본문은 CombatEngine.status.ts로 분리됨 (mixin).
      const source = await readSrc('src/systems/CombatEngine.status.ts');
      assert.ok(/BALANCE\.STATUS_DOT_RATIO \* synergyDotMult/.test(source),
          'STATUS_DOT_RATIO * synergyDotMult 보존');
  });

  test('cycle 549: cycle 502-548 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/applyCritMpRestore\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]/.test(ce),
          'cycle 548 applyCritMpRestore relics default 0건');
      assert.ok(!/applyEntropyTick\(player: Player, enemy: Monster, activeSynergies:\s*any\[\]\s*=\s*\[\]\)/.test(ce),
          'cycle 547 applyEntropyTick activeSynergies default 0건');
  });
}

// ─── cycle-583-status-metric-variant-default-unreachable.test.js ───
{
  /**
   * cycle 583: StatusMetric `variant = 'hp'` default unreachable
   *   (cycle 222-582 silent dead config 시리즈 321번째 — redundant default annotation
   *   청소 메가 시리즈 74번째).
   *
   * 발견 (1 default unreachable):
   * - src/components/StatusBar.tsx (line 30):
   *     const StatusMetric = ({ label, value, max, variant = 'hp' }: any) => {...};
   * - 호출 사이트 (3 internal callers):
   *     · StatusBar.tsx:236 — <StatusMetric label="HP" ... variant="hp" />
   *     · StatusBar.tsx:237 — <StatusMetric label="NRG" ... variant="mp" />
   *     · StatusBar.tsx:238 — <StatusMetric label="EXP" ... variant="exp" />
   * - 결과: variant 항상 명시 전달. default 'hp' 도달 불가.
   *
   * 패턴 (cycle 222-582 시리즈 321번째):
   * - cycle 502-582: default 청소 메가 시리즈 81사이클.
   * - cycle 583: components/StatusBar.tsx — cycle 491-495 시리즈에 이은 동일
   *   모듈 추가 cleanup.
   *
   * 수정 (src/components/StatusBar.tsx):
   * - signature에서 variant = 'hp' → variant.
   * - body의 METER_THEME[variant] || METER_THEME.hp nullish fallback 보존.
   *
   * 회귀 가드:
   * - 3 internal callsite 동작 그대로.
   * - body METER_THEME hp fallback + Math.max/Math.min 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 583: StatusMetric signature에서 variant default 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const StatusMetric = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/variant\s*=\s*'hp'/.test(sig),
          "StatusMetric variant default 'hp' 제거");
  });

  test('cycle 583: 정합성 가드 — 3 internal callsite 보존', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      assert.ok(/<StatusMetric label="HP"[\s\S]*?variant="hp"/.test(source),
          'HP callsite 보존');
      assert.ok(/<StatusMetric label="NRG"[\s\S]*?variant="mp"/.test(source),
          'NRG callsite 보존');
      assert.ok(/<StatusMetric label="EXP"[\s\S]*?variant="exp"/.test(source),
          'EXP callsite 보존');
  });

  test('cycle 583: body METER_THEME nullish fallback 보존', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      assert.ok(/METER_THEME\[variant\] \|\| METER_THEME\.hp/.test(source),
          'METER_THEME[variant] || METER_THEME.hp nullish fallback 보존');
  });

  test('cycle 583: cycle 502-582 회귀 가드 — default 청소 시리즈 보존', async () => {
      const cc = await readSrc('src/components/ClassCard.tsx');
      assert.ok(!/const ClassCard = \({ jobName, onSelect, disabled\s*=\s*false/.test(cc),
          'cycle 582 ClassCard disabled default 0건');

      const qs = await readSrc('src/components/QuickSlot.tsx');
      assert.ok(!/slots\s*=\s*\[null, null, null\]/.test(qs),
          'cycle 581 QuickSlot slots default 0건');
  });
}

// ─── cycle-586-status-bar-defaults-batch.test.js ───
{
  /**
   * cycle 586: StatusBar 5 defaults batch unreachable
   *   (cycle 222-585 silent dead config 시리즈 324번째 — redundant default annotation
   *   청소 메가 시리즈 77번째). single-cycle 5-default batch (가장 큰 unreachable
   *   batch).
   *
   * 발견 (5 defaults batch):
   * - src/components/StatusBar.tsx (line 108):
   *     const StatusBar = ({
   *         player,
   *         stats,
   *         enemy = null,
   *         onCrystalClick = null,
   *         isMuted = false,
   *         onToggleMute = null,
   *         onOpenEquipment = null,
   *     }: StatusBarProps) => {...};
   * - 호출 사이트 (1 caller):
   *     · GameRoot.tsx:89 — <StatusBar player stats enemy onCrystalClick
   *       isMuted onToggleMute onOpenEquipment /> — 7 props 모두 명시 전달.
   *     · 다른 caller 0건.
   * - 결과: 5 defaults 모두 도달 불가.
   *
   * 패턴 (cycle 222-585 시리즈 324번째):
   * - cycle 502-585: default 청소 메가 시리즈 84사이클.
   * - cycle 586: 가장 큰 unreachable 5-default batch (cycle 572 6-default partial
   *   에 비해 partial 없는 순수 5-default).
   *
   * 수정 (src/components/StatusBar.tsx):
   * - signature에서 5 defaults 모두 제거.
   * - body의 enemy 등 사용처 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (GameRoot) 동작 그대로.
   * - body equippedSignatureCount / EnemyStatus / StatusMetric 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 586: StatusBar signature에서 5 defaults 0건', async () => {
      const source = await readSrc('src/components/StatusBar.tsx');
      const fnIdx = source.indexOf('const StatusBar = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/enemy\s*=\s*null/.test(sig), 'StatusBar enemy default null 제거');
      assert.ok(!/onCrystalClick\s*=\s*null/.test(sig), 'StatusBar onCrystalClick default null 제거');
      assert.ok(!/isMuted\s*=\s*false/.test(sig), 'StatusBar isMuted default false 제거');
      assert.ok(!/onToggleMute\s*=\s*null/.test(sig), 'StatusBar onToggleMute default null 제거');
      assert.ok(!/onOpenEquipment\s*=\s*null/.test(sig), 'StatusBar onOpenEquipment default null 제거');
  });

  test('cycle 586: 정합성 가드 — GameRoot callsite 보존', async () => {
      const source = await readSrc('src/components/app/GameRoot.tsx');
      assert.ok(/<StatusBar[\s\S]*?enemy=\{engine\.gameState === GS\.COMBAT \? engine\.enemy : null\}/.test(source),
          'GameRoot StatusBar enemy 명시 전달 보존');
      assert.ok(/isMuted=\{isMuted\}/.test(source), 'isMuted 명시 보존');
      assert.ok(/onToggleMute=\{handleToggleMute\}/.test(source), 'onToggleMute 명시 보존');
  });

  test('cycle 586: cycle 502-585 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ii = await readSrc('src/components/icons/ItemIcon.tsx');
      assert.ok(!/const ItemIcon = \({ item, size\s*=\s*24/.test(ii),
          'cycle 585 ItemIcon size default 0건');

      const jcp = await readSrc('src/components/tabs/JobChangePanel.tsx');
      assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(jcp),
          'cycle 584 JobChangePanel onOpenArchiveConsole default 0건');
  });
}
