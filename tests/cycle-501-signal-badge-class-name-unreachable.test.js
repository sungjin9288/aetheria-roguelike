import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readdir } from 'node:fs/promises';

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
