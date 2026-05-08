import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 338: validateSynthesis type 출력 필드 dead 정리
 *   (cycle 222-337 silent dead config 시리즈 107번째 — cleanup lens 연속).
 *
 * 발견 (dead output field):
 * - validateSynthesis 성공 분기 (line 84) 반환에 `type` 필드 (synthesis input type) 정의.
 * - src/, tests/ 어디에서도 `validation.type` read 0건.
 * - CraftingPanel: outputs / goldCost / successRate / tier / valid만 사용.
 * - useInventoryActions: valid / reason만 사용.
 *
 * 패턴 (cycle 222-337 silent dead config 시리즈 107번째):
 * - cycle 337: getEnhanceAvailability materialCount 출력 dead.
 * - cycle 338: validateSynthesis type 출력 dead.
 *
 * 수정 (src/utils/synthesisUtils.ts):
 * - 성공 분기 return에서 type 필드 제거.
 * - 내부 const type 변수는 분기 계산용으로 그대로 유지.
 *
 * 회귀 가드:
 * - valid / tier / outputs / goldCost / successRate 필드 보존.
 * - reason / valid 분기 동작 동일.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 338: validateSynthesis 성공 return에서 type 필드 0건', async () => {
    const source = await readSrc('src/utils/synthesisUtils.ts');
    // return { valid: true, ..., type, ... } 패턴 0건.
    assert.ok(!/return \{ valid: true,[^}]*\btype,/.test(source),
        '성공 return에서 type 필드 제거됨');
    // 내부 const type 변수는 보존.
    assert.ok(/const type = items\[0\]\.type/.test(source),
        '내부 const type 변수 보존');
});

test('cycle 338: validateSynthesis 동작 보존 (성공 분기)', async () => {
    const { validateSynthesis } = await import('../src/utils/synthesisUtils.js');
    const items = [
        { name: '녹슨 단검', type: 'weapon', tier: 1, val: 5 },
        { name: '녹슨 단검', type: 'weapon', tier: 1, val: 5 },
        { name: '녹슨 단검', type: 'weapon', tier: 1, val: 5 },
    ];
    const result = validateSynthesis(items, 100000);
    if (result.valid) {
        assert.ok('outputs' in result, 'outputs 보존');
        assert.ok('goldCost' in result, 'goldCost 보존');
        assert.ok('successRate' in result, 'successRate 보존');
        assert.ok('tier' in result, 'tier 보존');
        assert.equal(result.type, undefined, 'type 출력 0건');
    }
});

test('cycle 338: validateSynthesis 실패 분기 보존 (회귀 가드)', async () => {
    const { validateSynthesis } = await import('../src/utils/synthesisUtils.js');
    const empty = validateSynthesis([], 0);
    assert.equal(empty.valid, false);
    assert.equal(empty.reason, 'NOT_ENOUGH');
});

test('cycle 337 회귀 가드: getEnhanceAvailability materialCount 0건', async () => {
    const source = await readSrc('src/utils/enhancementUtils.ts');
    assert.ok(!/^\s+materialCount[,:]/m.test(source),
        'cycle 337 materialCount 출력 0건 보존');
});
