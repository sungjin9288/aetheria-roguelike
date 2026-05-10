import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 463: ClassIcon `cssClass` prop unreachable 정리
 *   (cycle 222-462 silent dead config 시리즈 218번째 — unreachable code path
 *   cleanup lens, cycle 458/459/461 패턴 회귀).
 *
 * 발견 (1 prop unreachable):
 * - src/components/icons/ClassIcon.tsx (line 44):
 *     const ClassIcon = ({ className: jobName, size = 28, tier = 0,
 *                         showBorder = false, cssClass = '' }: any) => {...
 *         className={`inline-flex ... ${cssClass}`}
 *     }
 * - 호출 사이트 분석 (전체 src/):
 *     · SkillTreePreview.tsx:147 — className/size/tier/showBorder 전달, cssClass 0건.
 *     · ClassTree.tsx:58 — 동일.
 *     · ClassCard.tsx:54 — 동일.
 *     · JobChangePanel.tsx:43 — 동일.
 *     · 4 callsite 모두 cssClass 전달 0건.
 * - 결과: cssClass는 항상 ''. body의 ${cssClass} interpolation은 빈 문자열만 추가.
 *
 * 패턴 (cycle 222-462 시리즈 218번째):
 * - cycle 458: StatusMetric inline prop unreachable.
 * - cycle 459: EnemyStatus compact prop unreachable.
 * - cycle 461: ClassCard compact prop unreachable.
 * - cycle 463: ClassIcon cssClass prop unreachable — 동일 lens 회귀.
 *
 * 수정 (src/components/icons/ClassIcon.tsx):
 * - destructure에서 cssClass = '' 제거.
 * - body className 템플릿에서 ${cssClass} 보간 제거.
 *
 * 회귀 가드:
 * - className (jobName 별칭) / size / tier / showBorder 보존.
 * - 4 callsite 동작 변동 0 (cssClass 전달 0건이라 보간 결과 변동 없음).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 463: ClassIcon destructure에서 cssClass 0건', async () => {
    const source = await readSrc('src/components/icons/ClassIcon.tsx');
    const fnIdx = source.indexOf('const ClassIcon =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcssClass\b/.test(sig), 'destructure에 cssClass 0건');
});

test('cycle 463: body 템플릿에서 ${cssClass} 보간 0건', async () => {
    const source = await readSrc('src/components/icons/ClassIcon.tsx');
    assert.ok(!/\$\{cssClass\}/.test(source), '${cssClass} 보간 0건');
    assert.ok(!/\bcssClass\b/.test(source), 'body cssClass 참조 0건');
});

test('cycle 463: 정합성 가드 — 4 callsite cssClass 전달 0건', async () => {
    const callerFiles = [
        'src/components/SkillTreePreview.tsx',
        'src/components/ClassTree.tsx',
        'src/components/ClassCard.tsx',
        'src/components/tabs/JobChangePanel.tsx',
    ];
    for (const file of callerFiles) {
        const source = await readSrc(file);
        const idx = source.indexOf('<ClassIcon');
        assert.ok(idx >= 0, `${file}에 <ClassIcon> 호출 존재`);
        // <ClassIcon ... showBorder /> 또는 multi-line — `>` 또는 `/>`까지 잘라본다
        const tagEnd = source.indexOf('/>', idx);
        const jsx = source.slice(idx, tagEnd);
        assert.ok(!/\bcssClass\b/.test(jsx), `${file} callsite cssClass 전달 0건`);
    }
});

test('cycle 463: className(jobName 별칭) / size / tier / showBorder 보존', async () => {
    const source = await readSrc('src/components/icons/ClassIcon.tsx');
    const fnIdx = source.indexOf('const ClassIcon =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/className:\s*jobName/.test(sig), 'className 별칭 보존');
    assert.ok(/size\s*=\s*28/.test(sig), 'size 기본값 보존');
    assert.ok(/tier\s*=\s*0/.test(sig), 'tier 기본값 보존');
    assert.ok(/showBorder\s*=\s*false/.test(sig), 'showBorder 기본값 보존');
});
