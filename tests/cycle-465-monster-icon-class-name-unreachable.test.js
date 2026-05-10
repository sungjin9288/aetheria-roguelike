import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 465: MonsterIcon `className` prop unreachable 정리
 *   (cycle 222-464 silent dead config 시리즈 220번째 — unreachable code path
 *   cleanup lens, cycle 463/464 패턴 회귀, 같은 디렉토리 paired).
 *
 * 발견 (1 prop unreachable):
 * - src/components/icons/MonsterIcon.tsx (line 51):
 *     const MonsterIcon = ({ name, discovered = false, isBoss = false,
 *                            size = 32, className = '' }: any) => {...
 *         className={`inline-flex ... ${className}`}
 *     }
 * - 호출 사이트 분석 (전체 src/):
 *     · MonsterCodex.tsx:98 — name/discovered/isBoss/size 전달, className 0건.
 *     · MonsterCodex.tsx:121 — 동일.
 *     · 2 callsite 모두 className 전달 0건.
 * - 결과: className은 항상 ''. body의 ${className} 보간은 빈 문자열만 추가.
 *
 * 패턴 (cycle 222-464 시리즈 220번째):
 * - cycle 463: ClassIcon cssClass prop unreachable.
 * - cycle 464: ClassIcon showBorder prop unreachable false 가지.
 * - cycle 465: MonsterIcon className prop unreachable — 같은 icons/ 디렉토리
 *   paired 회귀.
 *
 * 수정 (src/components/icons/MonsterIcon.tsx):
 * - destructure에서 className = '' 제거.
 * - body className 템플릿에서 ${className} 보간 제거.
 * - JSDoc @param에서 className 제거.
 *
 * 회귀 가드:
 * - name / discovered / isBoss / size prop 보존.
 * - 2 callsite 동작 변동 0.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 465: MonsterIcon destructure에서 className 0건', async () => {
    const source = await readSrc('src/components/icons/MonsterIcon.tsx');
    const fnIdx = source.indexOf('const MonsterIcon =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bclassName\b/.test(sig), 'destructure에 className 0건');
});

test('cycle 465: ${className} 보간 0건', async () => {
    const source = await readSrc('src/components/icons/MonsterIcon.tsx');
    assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
});

test('cycle 465: 정합성 가드 — 2 callsite className 전달 0건', async () => {
    const source = await readSrc('src/components/codex/MonsterCodex.tsx');
    const matches = source.match(/<MonsterIcon[^/]*\/>/g) || [];
    assert.equal(matches.length, 2, 'MonsterIcon 호출 2건');
    matches.forEach((m, i) => {
        assert.ok(!/\bclassName\b/.test(m), `callsite ${i}에 className 전달 0건`);
    });
});

test('cycle 465: name / discovered / isBoss / size prop 보존', async () => {
    const source = await readSrc('src/components/icons/MonsterIcon.tsx');
    const fnIdx = source.indexOf('const MonsterIcon =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bname\b/.test(sig), 'name 보존');
    assert.ok(/discovered\s*=\s*false/.test(sig), 'discovered 기본값 보존');
    assert.ok(/isBoss\s*=\s*false/.test(sig), 'isBoss 기본값 보존');
    assert.ok(/size\s*=\s*32/.test(sig), 'size 기본값 보존');
});
