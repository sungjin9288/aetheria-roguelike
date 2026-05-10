import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 601: performSynthesis 2 defaults batch unreachable
 *   (cycle 222-600 silent dead config 시리즈 337번째 — redundant default annotation
 *   청소 메가 시리즈 추가, 600사이클 milestone 후 첫 cycle).
 *
 * 발견 (2 defaults batch):
 * - src/utils/synthesisUtils.ts (line 96):
 *     export const performSynthesis = (items: any, selectedOutput: any = null,
 *         useProtect: any = false) => {...};
 * - 호출 사이트 (1 caller):
 *     · useInventoryActions.ts:430 — performSynthesis(items, null, useProtect)
 *       — 3 args 명시.
 *     · 다른 caller 0건.
 * - 결과: selectedOutput / useProtect 항상 명시 전달. 두 default 모두 도달
 *   불가.
 *
 * 패턴 (cycle 222-600 시리즈 337번째):
 * - cycle 502-600: default 청소 메가 시리즈 99사이클 (cycle 600 milestone 포함).
 * - cycle 601: 600사이클 milestone 후 첫 cycle. utils/synthesisUtils.ts cleanup.
 *
 * 수정 (src/utils/synthesisUtils.ts):
 * - selectedOutput = null → selectedOutput.
 * - useProtect = false → useProtect.
 * - body의 useProtect 분기 보존.
 *
 * 회귀 가드:
 * - 1 production callsite (useInventoryActions) 동작 그대로.
 * - body synthesis cost / success rate 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 601: performSynthesis signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/utils/synthesisUtils.ts');
    const fnIdx = source.indexOf('export const performSynthesis');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/selectedOutput:\s*any\s*=\s*null/.test(sig),
        'performSynthesis selectedOutput default null 제거');
    assert.ok(!/useProtect:\s*any\s*=\s*false/.test(sig),
        'performSynthesis useProtect default false 제거');
});

test('cycle 601: 정합성 가드 — useInventoryActions callsite 보존', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(/performSynthesis\(items,\s*null,\s*useProtect\)/.test(source),
        'useInventoryActions performSynthesis(items, null, useProtect) callsite 보존');
});

test('cycle 601: cycle 502-600 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ep = await readSrc('src/utils/explorationPacing.ts');
    assert.ok(!/getMapPacingProfile\s*=\s*\(mapData:\s*GameMap \| null \| undefined\s*=\s*\{\}\)/.test(ep),
        'cycle 599 getMapPacingProfile mapData default 0건');

    const rp = await readSrc('src/utils/runProfile.ts');
    assert.ok(!/getTraitFeaturedItems = \(items:\s*any\[\]\s*=\s*\[\]/.test(rp),
        'cycle 598 getTraitFeaturedItems items default 0건');
});
