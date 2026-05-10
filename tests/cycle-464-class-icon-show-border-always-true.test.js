import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 464: ClassIcon `showBorder` prop unreachable false 가지 정리
 *   (cycle 222-463 silent dead config 시리즈 219번째 — unreachable code path
 *   cleanup lens, cycle 463 paired completion).
 *
 * 발견 (1 prop unreachable + 1 ternary 가지 dead):
 * - src/components/icons/ClassIcon.tsx (line 44):
 *     const ClassIcon = ({ ..., showBorder = false }: any) => {...
 *         style={{
 *             width: size, height: size,
 *             ...(showBorder ? { border, borderRadius, background } : {}),
 *         }}
 *     }
 * - 호출 사이트 분석 (전체 src/):
 *     · 4 callsite 모두 `showBorder` shorthand 전달 (= true).
 *     · false 전달 / 미전달 callsite 0건.
 * - 결과: showBorder는 항상 true → ternary는 항상 truthy 가지. false 가지는
 *   dead. 기본값 = false도 unreachable.
 *
 * 패턴 (cycle 222-463 시리즈 219번째):
 * - cycle 463: ClassIcon cssClass prop unreachable.
 * - cycle 464: 같은 컴포넌트 showBorder prop 항상 true → false 가지 unreachable.
 *   paired completion으로 ClassIcon 잔존 dead config 일괄 정리.
 *
 * 수정 (src/components/icons/ClassIcon.tsx):
 * - destructure에서 showBorder = false 제거.
 * - body의 `...(showBorder ? {...} : {})` ternary 제거 → 정적 spread.
 * - 4 callsite의 showBorder 명시 attr 제거 (항상 true이라 redundant).
 *
 * 회귀 가드:
 * - 4 callsite 시각 출력 그대로 (border / borderRadius / background 항상 적용).
 * - className(jobName 별칭) / size / tier 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 464: ClassIcon destructure에서 showBorder 0건', async () => {
    const source = await readSrc('src/components/icons/ClassIcon.tsx');
    const fnIdx = source.indexOf('const ClassIcon =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bshowBorder\b/.test(sig), 'destructure에 showBorder 0건');
});

test('cycle 464: showBorder 참조 / ternary 가지 0건', async () => {
    const source = await readSrc('src/components/icons/ClassIcon.tsx');
    assert.ok(!/\bshowBorder\b/.test(source), 'showBorder 참조 0건');
    // 정적 border / borderRadius / background 보존
    assert.ok(/border:\s*`1\.5px solid/.test(source), 'border 정적 적용 보존');
    assert.ok(/borderRadius:\s*8/.test(source), 'borderRadius 정적 적용 보존');
});

test('cycle 464: 정합성 가드 — 4 callsite showBorder 명시 0건', async () => {
    const callerFiles = [
        'src/components/SkillTreePreview.tsx',
        'src/components/ClassTree.tsx',
        'src/components/ClassCard.tsx',
        'src/components/tabs/JobChangePanel.tsx',
    ];
    for (const file of callerFiles) {
        const source = await readSrc(file);
        const idx = source.indexOf('<ClassIcon');
        const tagEnd = source.indexOf('/>', idx);
        const jsx = source.slice(idx, tagEnd);
        assert.ok(!/\bshowBorder\b/.test(jsx), `${file} callsite showBorder 명시 0건`);
    }
});

test('cycle 464: className(jobName 별칭) / size / tier 보존', async () => {
    const source = await readSrc('src/components/icons/ClassIcon.tsx');
    const fnIdx = source.indexOf('const ClassIcon =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/className:\s*jobName/.test(sig), 'className 별칭 보존');
    // cycle 568: size = 28 / tier = 0 defaults cascade 제거 (4 callsite 모두 명시).
    assert.ok(/\bsize\b/.test(sig), 'size 파라미터 보존 (default cycle 568 제거)');
    assert.ok(/\btier\b/.test(sig), 'tier 파라미터 보존 (default cycle 568 제거)');
});
