import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 316: addItemToInventory export → private downgrade
 *   (cycle 222-315 silent dead config 시리즈 86번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/utils/inventoryUtils.ts: addItemToInventory — addItemByName 내부 1회 사용 (line 30),
 *   외부 consumer 0건 (test 0건).
 *
 * 패턴 (cycle 222-315 silent dead config 시리즈 86번째):
 * - cycle 315: moveActions / ascensionActions 미사용 _shared 파라미터 제거.
 * - cycle 316: addItemToInventory private downgrade — export 표면 1개 축소.
 *
 * 수정 (src/utils/inventoryUtils.ts):
 * - addItemToInventory export 제거 (private const 유지).
 * - addItemByName 내부 호출 동일.
 *
 * 회귀 가드:
 * - addItemByName active export 유지 (24+ 호출 사이트).
 * - addItemByName 동작 동일 (내부에서 addItemToInventory 호출).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 316: addItemToInventory export 제거 (private)', async () => {
    const source = await readSrc('src/utils/inventoryUtils.ts');
    assert.ok(!/export const addItemToInventory\b/.test(source),
        'addItemToInventory export 제거됨');
    assert.ok(/const addItemToInventory\b/.test(source),
        'addItemToInventory const 정의 유지 (private)');
});

test('cycle 316: addItemByName active export 유지', async () => {
    const source = await readSrc('src/utils/inventoryUtils.ts');
    assert.ok(/export const addItemByName\b/.test(source),
        'addItemByName export 유지');
});

test('cycle 316: addItemByName 동작 보존 (회귀 가드)', async () => {
    const { addItemByName } = await import('../src/utils/inventoryUtils.js');
    // 미존재 아이템 → player 그대로.
    const player = { inv: [], name: 'test' };
    const result = addItemByName(player, '___not_a_real_item___');
    assert.equal(result, player, '미존재 아이템 → player 그대로 반환');
});

test('cycle 315 회귀 가드: moveActions / ascensionActions 1-arg 시그니처 유지', async () => {
    const moveSrc = await readSrc('src/hooks/gameActions/moveActions.ts');
    const asSrc = await readSrc('src/hooks/gameActions/ascensionActions.ts');
    assert.ok(/createMoveActions\s*=\s*\(deps:\s*any\)\s*=>/.test(moveSrc),
        'cycle 315 createMoveActions 1-arg 유지');
    assert.ok(/createAscensionActions\s*=\s*\(deps:\s*any\)\s*=>/.test(asSrc),
        'cycle 315 createAscensionActions 1-arg 유지');
});
