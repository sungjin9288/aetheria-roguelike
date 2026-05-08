import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 319: 2 unused type imports cleanup
 *   (cycle 222-318 silent dead config 시리즈 89번째 — cleanup lens 연속).
 *
 * 발견 (unused type imports):
 * - src/utils/runProfileUtils.ts:1-2 `import type { Monster }` + `import type { Player }`
 *   → barrel re-export 파일에서 사용 0건. `export *`만 필요.
 * - src/types/player.ts:8 `import type { ... ConsumableItem }`
 *   → ConsumableItem 사용 0건 (Item과 EquipSlots만 사용).
 *
 * 패턴 (cycle 222-318 silent dead config 시리즈 89번째):
 * - cycle 318: getPoolKeyByLocation private downgrade.
 * - cycle 319: 2 unused type imports cleanup — import 라인 표면 축소.
 *
 * 수정:
 * - runProfileUtils.ts: `import type { Monster, Player }` 2 라인 제거.
 * - player.ts: import에서 ConsumableItem 제거.
 *
 * 회귀 가드:
 * - runProfileUtils.ts barrel re-export `export * from './runProfile.js'` 보존.
 * - player.ts Player interface inv?: Item[] / equip?: EquipSlots 사용 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 319: runProfileUtils.ts unused Monster / Player import 제거', async () => {
    const source = await readSrc('src/utils/runProfileUtils.ts');
    assert.ok(!/import type \{ Monster \}/.test(source),
        'Monster import 제거됨');
    assert.ok(!/import type \{ Player \}/.test(source),
        'Player import 제거됨');
});

test('cycle 319: runProfileUtils.ts barrel re-export 보존', async () => {
    const source = await readSrc('src/utils/runProfileUtils.ts');
    assert.ok(/export \* from ['"]\.\/runProfile/.test(source),
        'export * from runProfile 보존');
});

test('cycle 319: player.ts ConsumableItem import 제거', async () => {
    const source = await readSrc('src/types/player.ts');
    assert.ok(!/import type \{[^}]*ConsumableItem[^}]*\}/.test(source),
        'ConsumableItem import 제거됨');
    assert.ok(/import type \{ EquipSlots, Item \}/.test(source),
        'EquipSlots / Item import 유지');
});

test('cycle 319: Player interface 필드 보존 (회귀 가드)', async () => {
    const source = await readSrc('src/types/player.ts');
    assert.ok(/inv\?:\s*Item\[\]/.test(source), 'Player.inv?: Item[] 보존');
    assert.ok(/equip\?:\s*EquipSlots/.test(source), 'Player.equip?: EquipSlots 보존');
});

test('cycle 318 회귀 가드: getPoolKeyByLocation private 유지', async () => {
    const source = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/export const getPoolKeyByLocation\b/.test(source),
        'cycle 318 getPoolKeyByLocation private 유지');
});
