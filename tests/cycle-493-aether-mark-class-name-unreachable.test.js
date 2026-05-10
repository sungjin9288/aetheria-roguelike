import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 493: AetherMark `className` prop unreachable 정리
 *   (cycle 222-492 silent dead config 시리즈 244번째 — unreachable code path
 *   cleanup lens, cycle 463/465/466 icons/ paired 패턴 회귀).
 *
 * 발견 (1 prop unreachable):
 * - src/components/AetherMark.tsx (line 23):
 *     const AetherMark = ({ size, className = '' }: any) => {...
 *         className={`relative ${scale.shell} shrink-0 ${className}`.trim()}
 *     }
 * - 호출 사이트 분석:
 *     · IntroScreen.tsx:71 — <AetherMark size="md" /> (className 0건).
 *     · BootScreen.tsx:19 — <AetherMark size="lg" /> (className 0건).
 *     · 2 callsite 모두 className 전달 0건. 다른 import 0건.
 * - 결과: className 항상 ''. body의 ${className} 보간은 .trim()으로 빈 문자열만
 *   제거되는 unreachable.
 *
 * 패턴 (cycle 222-492 시리즈 244번째):
 * - cycle 463: ClassIcon cssClass prop unreachable.
 * - cycle 465: MonsterIcon className prop unreachable.
 * - cycle 466: SignatureBadge className prop unreachable.
 * - cycle 493: AetherMark className prop unreachable — 동일 lens.
 *
 * 수정 (src/components/AetherMark.tsx):
 * - destructure에서 className = '' 제거.
 * - body className 템플릿에서 ${className} 보간 제거 → 정적 'relative ${scale.shell}
 *   shrink-0' 문자열 (.trim() 제거).
 *
 * 회귀 가드:
 * - size prop 보존.
 * - 2 callsite 동작 변동 0.
 * - cycle 418 (SIZE_MAP.sm) / cycle 432 (default size) cleanup 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 493: AetherMark destructure에서 className 0건', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    const fnIdx = source.indexOf('const AetherMark =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bclassName\b/.test(sig), 'destructure에 className 0건');
});

test('cycle 493: body ${className} 보간 0건', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
});

test('cycle 493: 정합성 가드 — 2 callsite className 전달 0건', async () => {
    const intro = await readSrc('src/components/IntroScreen.tsx');
    const introCall = intro.match(/<AetherMark[^/]*\/>/);
    assert.ok(introCall, 'IntroScreen <AetherMark> 호출 발견');
    assert.ok(!/className/.test(introCall[0]), 'IntroScreen callsite className 0건');

    const boot = await readSrc('src/components/app/BootScreen.tsx');
    const bootCall = boot.match(/<AetherMark[^/]*\/>/);
    assert.ok(bootCall, 'BootScreen <AetherMark> 호출 발견');
    assert.ok(!/className/.test(bootCall[0]), 'BootScreen callsite className 0건');
});

test('cycle 493: size prop 보존', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    const fnIdx = source.indexOf('const AetherMark =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bsize\b/.test(sig), 'size prop 보존');
});

test('cycle 493: cycle 418/432 회귀 가드 — SIZE_MAP md/lg + 본체 동작 보존', async () => {
    const source = await readSrc('src/components/AetherMark.tsx');
    assert.ok(/SIZE_MAP/.test(source), 'SIZE_MAP 보존');
    assert.ok(/SIZE_MAP\[size\]/.test(source), 'SIZE_MAP[size] lookup 보존');
    assert.ok(/SIZE_MAP\.md/.test(source), 'SIZE_MAP.md fallback 보존');
});
