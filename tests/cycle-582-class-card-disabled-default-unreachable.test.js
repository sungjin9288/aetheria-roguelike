import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
