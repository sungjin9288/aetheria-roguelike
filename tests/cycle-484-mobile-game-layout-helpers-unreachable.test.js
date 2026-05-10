import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 484: MobileGameLayout 2 internal helper props unreachable batch 정리
 *   (cycle 222-483 silent dead config 시리즈 236번째 — unreachable code path
 *   같은 파일 paired 변형, cycle 458-459 StatusBar 패턴 회귀).
 *
 * 발견 (2 props + ternary 가지 unreachable):
 * - src/components/app/MobileGameLayout.tsx:
 *     · line 10: const DashboardFallback = ({ summary = false }: any) => {...
 *         summary ? 'rounded-[1.2rem] ...' : 'shrink-0 rounded-[1.55rem] ...'
 *       }
 *     · line 21: const MobileConsoleArchiveButton = ({ active = false, onClick }: any) => {...
 *         active ? '...' : '...'
 *       }
 * - 호출 사이트 분석:
 *     · line 67: <DashboardFallback /> — summary 0건 (1 callsite).
 *     · line 105: <MobileConsoleArchiveButton onClick={...} /> — active 0건 (1 callsite).
 *     · 두 helper 모두 internal const, export 0건.
 * - 결과:
 *     · summary 항상 false → ternary 첫 가지 unreachable.
 *     · active 항상 false → 활성/비활성 ternary 첫 가지 unreachable.
 *
 * 패턴 (cycle 222-483 시리즈 236번째):
 * - cycle 458-459: StatusBar 같은 파일 internal const 2개 paired (StatusMetric.inline /
 *   EnemyStatus.compact).
 * - cycle 484: MobileGameLayout 같은 파일 internal const 2개 paired — 동일 lens.
 *
 * 수정 (src/components/app/MobileGameLayout.tsx):
 * - DashboardFallback destructure에서 summary 제거 → ({}: any) 또는 () =>.
 * - DashboardFallback className에서 summary ? A : B → B만.
 * - MobileConsoleArchiveButton destructure에서 active 제거.
 * - MobileConsoleArchiveButton className에서 active ? A : B → B만.
 *
 * 회귀 가드:
 * - DashboardFallback className 정적 (false 가지) 보존.
 * - MobileConsoleArchiveButton onClick / data-testid 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 484: DashboardFallback destructure에서 summary 0건', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const fnIdx = source.indexOf('const DashboardFallback =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bsummary\b/.test(sig), 'destructure에 summary 0건');
});

test('cycle 484: MobileConsoleArchiveButton destructure에서 active 0건', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const fnIdx = source.indexOf('const MobileConsoleArchiveButton =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bactive\b/.test(sig), 'destructure에 active 0건');
});

test('cycle 484: 본체에서 summary / active ternary 0건', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const fbIdx = source.indexOf('const DashboardFallback =');
    const fbEnd = source.indexOf('const MobileConsoleArchiveButton =');
    const fbBlock = source.slice(fbIdx, fbEnd);
    assert.ok(!/\bsummary\b/.test(fbBlock), 'DashboardFallback 본체 summary 0건');

    const btnIdx = source.indexOf('const MobileConsoleArchiveButton =');
    // 함수 끝까지 — 본체 끝 표시는 `;\n)`. 안전하게 다음 export까지로 슬라이스.
    const btnEnd = source.indexOf('export ', btnIdx) >= 0 ? source.indexOf('export ', btnIdx) : source.length;
    const btnBlock = source.slice(btnIdx, btnEnd);
    // active는 destructure에서 제거됐으니 본체 active 참조도 0건이어야 함.
    // 그러나 'inactive' 같은 단어 리터럴이 있을 수 있음 — \bactive\b 단독 단어만 체크.
    const matches = btnBlock.match(/\bactive\b/g) || [];
    assert.equal(matches.length, 0, 'MobileConsoleArchiveButton 본체 active 참조 0건');
});

test('cycle 484: 정합성 가드 — 1 callsite 각각 prop 전달 0건', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const fbCall = source.match(/<DashboardFallback[^/]*\/>/);
    assert.ok(fbCall, '<DashboardFallback /> 호출 존재');
    assert.ok(!/\bsummary\b/.test(fbCall[0]), 'DashboardFallback callsite summary 전달 0건');

    const btnCall = source.match(/<MobileConsoleArchiveButton[^/]*\/>/);
    assert.ok(btnCall, '<MobileConsoleArchiveButton /> 호출 존재');
    assert.ok(!/\bactive\b/.test(btnCall[0]), 'MobileConsoleArchiveButton callsite active 전달 0건');
});

test('cycle 484: onClick / data-testid 핵심 props 보존', async () => {
    const source = await readSrc('src/components/app/MobileGameLayout.tsx');
    const btnIdx = source.indexOf('const MobileConsoleArchiveButton =');
    const btnEnd = source.indexOf('export ', btnIdx) >= 0 ? source.indexOf('export ', btnIdx) : source.length;
    const block = source.slice(btnIdx, btnEnd);
    assert.ok(/onClick/.test(block), 'onClick 보존');
    assert.ok(/data-testid="mobile-console-open-archive"/.test(block), 'testid 보존');
});
