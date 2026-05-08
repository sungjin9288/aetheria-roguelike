import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 369: ItemBase type export → private downgrade
 *   (cycle 222-368 silent dead config 시리즈 135번째 — cleanup lens 연속).
 *
 * 발견 (1 dead public export — internal-only type):
 * - src/types/item.ts: `export interface ItemBase` 외부 import 0건
 *   (src/utils, src/components, src/hooks, src/systems, src/data, src/services 모두).
 * - ItemBase는 동일 파일의 Item 유니온(`Item = EquipmentItem | ConsumableItem | ItemBase`)
 *   구성용 internal type로만 사용. EquipSlots 필드 타입(`weapon?: ItemBase | null`)도
 *   동일 파일 내부.
 * - 외부에서 필요한 건 Item / EquipSlots만 (이미 export됨).
 * - ConsumableItem은 cycle 298 테스트에서 활성 export로 가드됨 → 보존.
 *
 * 패턴 (cycle 222-368 silent dead config 시리즈 135번째):
 * - cycle 295/298/312/316: type/util/placement private downgrade lens.
 * - cycle 368: relic + quest threshold default redundant.
 * - cycle 369: ItemBase export → private downgrade (cycle 298 lens 후속).
 *
 * 수정 (src/types/item.ts):
 * - `export interface ItemBase` → `interface ItemBase`.
 *
 * 회귀 가드:
 * - Item / EquipSlots / ConsumableItem export 보존 (외부 import / 회귀 가드).
 * - Item 유니온 정의 동일 (ItemBase private interface로 사용).
 * - EquipSlots ItemBase 필드 동일 (private internal reference).
 * - tsc strict mode 통과.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 369: ItemBase export → private downgrade', async () => {
    const source = await readSrc('src/types/item.ts');
    assert.ok(!/^export interface ItemBase/m.test(source),
        'ItemBase export 0건');
    assert.ok(/^interface ItemBase/m.test(source),
        'ItemBase private interface 보존');
});

test('cycle 369: Item / EquipSlots / ConsumableItem export 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/types/item.ts');
    assert.ok(/^export type Item =/m.test(source), 'Item type export 보존');
    assert.ok(/^export interface EquipSlots/m.test(source), 'EquipSlots export 보존');
    assert.ok(/^export interface ConsumableItem/m.test(source),
        'ConsumableItem export 보존 (cycle 298 회귀 가드)');
});

test('cycle 368 회귀 가드: prophecy_stone threshold 0건 보존', async () => {
    const source = await readSrc('src/data/relics.ts');
    const propheLine = source.match(/prophecy_stone[^\n]*/)[0];
    assert.ok(!/threshold:/.test(propheLine),
        'cycle 368 prophecy_stone threshold 0건 보존');
});
