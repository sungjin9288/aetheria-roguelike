import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
