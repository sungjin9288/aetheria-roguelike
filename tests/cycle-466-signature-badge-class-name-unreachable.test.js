import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 466: SignatureBadge `className` prop unreachable 정리
 *   (cycle 222-465 silent dead config 시리즈 221번째 — unreachable code path
 *   cleanup lens, cycle 463/464/465 패턴 회귀, icons/ 디렉토리 paired).
 *
 * 발견 (1 prop unreachable):
 * - src/components/icons/SignatureBadge.tsx (line 32):
 *     const SignatureBadge = ({ item, size = 10, className = '' }: any) => {...
 *         className={`pointer-events-none absolute ${className}`.trim()}
 *     }
 * - 호출 사이트 분석 (전체 src/):
 *     · ItemIcon.tsx:129 — item / size만 전달, className 0건.
 *     · 다른 caller 0건 (export default 1건, ItemIcon만 import).
 * - 결과: className은 항상 ''. body의 ${className} 보간은 .trim()으로 빈
 *   문자열이 제거되는 unreachable.
 *
 * 패턴 (cycle 222-465 시리즈 221번째):
 * - cycle 463: ClassIcon cssClass prop unreachable.
 * - cycle 464: ClassIcon showBorder prop unreachable.
 * - cycle 465: MonsterIcon className prop unreachable.
 * - cycle 466: SignatureBadge className prop unreachable — icons/ 디렉토리
 *   paired 회귀 (4 사이클 연속).
 *
 * 수정 (src/components/icons/SignatureBadge.tsx):
 * - destructure에서 className = '' 제거.
 * - body className 템플릿에서 ${className}.trim() 제거 → 정적 'pointer-events-none
 *   absolute' 문자열.
 *
 * 회귀 가드:
 * - item / size prop 보존.
 * - 1 callsite 동작 변동 0.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 466: SignatureBadge destructure에서 className 0건', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const fnIdx = source.indexOf('const SignatureBadge =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bclassName\b/.test(sig), 'destructure에 className 0건');
});

test('cycle 466: ${className} 보간 0건', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
});

test('cycle 466: 정합성 가드 — ItemIcon callsite className 전달 0건', async () => {
    const source = await readSrc('src/components/icons/ItemIcon.tsx');
    const idx = source.indexOf('<SignatureBadge');
    assert.ok(idx >= 0, '<SignatureBadge> 호출 존재');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bclassName\b/.test(jsx), 'callsite className 전달 0건');
});

test('cycle 466: item / size prop 보존', async () => {
    const source = await readSrc('src/components/icons/SignatureBadge.tsx');
    const fnIdx = source.indexOf('const SignatureBadge =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bitem\b/.test(sig), 'item 보존');
    assert.ok(/size\s*=\s*10/.test(sig), 'size 기본값 보존');
});
