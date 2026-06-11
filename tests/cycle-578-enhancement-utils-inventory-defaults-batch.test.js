import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 578: enhancementUtils 3 inventory defaults batch unreachable
 *   (cycle 222-577 silent dead config 시리즈 317번째 — redundant default annotation
 *   청소 메가 시리즈 70번째). single-cycle 3-default batch.
 *
 * 발견 (3 defaults batch, enhancementUtils.ts 같은 모듈):
 * - src/utils/enhancementUtils.ts:
 *     · line 4: countInventoryItemByName (inventory: Item[] = [], itemName: string)
 *     · line 17: getEnhanceMaterialCount (inventory: Item[] = [])
 *     · line 24: consumeInventoryItemByName (inventory: Item[] = [], itemName,
 *       count)
 * - 호출 사이트:
 *     · countInventoryItemByName: EquipmentPanel:58 + internal:18 + test:31
 *       — 모두 inventory 명시.
 *     · getEnhanceMaterialCount: internal:62 + test:32 — 모두 inventory 명시.
 *     · consumeInventoryItemByName: useInventoryActions:563 + test:43 — 모두
 *       inventory 명시.
 * - 결과: 3 default 모두 도달 불가. body의 (inventory || []) defensive
 *   guards는 별개 보존.
 *
 * 패턴 (cycle 222-577 시리즈 317번째):
 * - cycle 502-577: default 청소 메가 시리즈 76사이클.
 * - cycle 578: enhancementUtils.ts 같은 모듈 batch — cycle 503/506/516에 이은
 *   동일 모듈 추가 cleanup. single-cycle 3-default batch.
 *
 * 수정 (src/utils/enhancementUtils.ts):
 * - 3 functions의 inventory: Item[] = [] → inventory: Item[].
 * - body의 (inventory || []) defensive guards 보존.
 *
 * 회귀 가드:
 * - 다수 callsite 동작 그대로.
 * - body filter 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 578: 3 inventory defaults 0건', async () => {
    const source = await readSrc('src/utils/enhancementUtils.ts');
    const fns = ['countInventoryItemByName', 'getEnhanceMaterialCount', 'consumeInventoryItemByName'];
    for (const fn of fns) {
        const fnIdx = source.indexOf(`export const ${fn}`);
        const fnEnd = source.indexOf('=>', fnIdx);
        const sig = source.slice(fnIdx, fnEnd);
        assert.ok(!/inventory:\s*Item\[\]\s*=\s*\[\]/.test(sig),
            `${fn}: inventory default [] 제거`);
    }
});

test('cycle 578: 정합성 가드 — 다수 callsite 보존', async () => {
    const ep = await readSrc('src/components/EquipmentPanel.tsx');
    assert.ok(/countInventoryItemByName\(player\?\.inv(?: \|\| \[\])?,\s*CONSTANTS\.ENHANCE_MATERIAL_NAME\)/.test(ep),
        'EquipmentPanel countInventoryItemByName 보존');

    const inv = await readSrc('src/hooks/useInventoryActions.ts');
    assert.ok(/consumeInventoryItemByName\(player\.inv,\s*requirement\.materialName,\s*requirement\.materials\)/.test(inv),
        'useInventoryActions consumeInventoryItemByName 보존');

    const eu = await readSrc('src/utils/enhancementUtils.ts');
    assert.ok(/countInventoryItemByName\(inventory,\s*CONSTANTS\.ENHANCE_MATERIAL_NAME\)/.test(eu),
        'getEnhanceMaterialCount internal call 보존');
});

test('cycle 578: body defensive guards 보존', async () => {
    const source = await readSrc('src/utils/enhancementUtils.ts');
    const calls = (source.match(/\(inventory \|\| \[\]\)/g) || []).length;
    assert.ok(calls >= 2, `(inventory || []) defensive guards 보존: ${calls}건`);
});

test('cycle 578: cycle 502-577 회귀 가드 — default 청소 시리즈 보존', async () => {
    const mp = await readSrc('src/utils/mapProgress.ts');
    assert.ok(!/getMapCodexProgress[^=]*codex:\s*any\s*=\s*\{\}/.test(mp),
        'cycle 577 getMapCodexProgress codex default 0건');

    const tv = await readSrc('src/components/TerminalView.tsx');
    assert.ok(!/const TerminalView = \(\{\s*\n\s*logs\s*=\s*\[\]/.test(tv),
        'cycle 576 TerminalView logs default 0건');
});
