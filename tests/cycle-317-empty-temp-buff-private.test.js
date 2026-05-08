import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 317: EMPTY_TEMP_BUFF export → private downgrade
 *   (cycle 222-316 silent dead config 시리즈 87번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/utils/playerStateUtils.ts: EMPTY_TEMP_BUFF — playerStateUtils 내부 2회 사용
 *   (line 39 hasTemporaryAdventureState + line 65 clearTemporaryAdventureState),
 *   외부 consumer 0건 (src 0, tests 0).
 *
 * 패턴 (cycle 222-316 silent dead config 시리즈 87번째):
 * - cycle 316: addItemToInventory private downgrade.
 * - cycle 317: EMPTY_TEMP_BUFF private downgrade — export 표면 1개 축소.
 *
 * 수정 (src/utils/playerStateUtils.ts):
 * - EMPTY_TEMP_BUFF export 제거 (private const 유지).
 *
 * 회귀 가드:
 * - hasTemporaryAdventureState / clearTemporaryAdventureState / DEFAULT_COMBAT_FLAGS /
 *   incrementStat active export 유지.
 * - clearTemporaryAdventureState tempBuff 초기화 동작 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 317: EMPTY_TEMP_BUFF export 제거 (private)', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    assert.ok(!/export const EMPTY_TEMP_BUFF\b/.test(source),
        'EMPTY_TEMP_BUFF export 제거됨');
    assert.ok(/const EMPTY_TEMP_BUFF\b/.test(source),
        'EMPTY_TEMP_BUFF const 정의 유지 (private)');
});

test('cycle 317: playerStateUtils active exports 유지', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    const activeExports = ['incrementStat', 'DEFAULT_COMBAT_FLAGS', 'hasTemporaryAdventureState', 'clearTemporaryAdventureState'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 317: clearTemporaryAdventureState 동작 보존 (회귀 가드 — EMPTY_TEMP_BUFF 내부 사용)', async () => {
    const { clearTemporaryAdventureState } = await import('../src/utils/playerStateUtils.js');
    const player = { tempBuff: { atk: 5, def: 2, turn: 3, name: '버프' } };
    const result = clearTemporaryAdventureState(player);
    assert.equal(result.tempBuff.atk, 0, 'tempBuff.atk 0으로 reset');
    assert.equal(result.tempBuff.turn, 0, 'tempBuff.turn 0으로 reset');
    assert.equal(result.tempBuff.name, null, 'tempBuff.name null로 reset');
});

test('cycle 316 회귀 가드: addItemToInventory private 유지', async () => {
    const source = await readSrc('src/utils/inventoryUtils.ts');
    assert.ok(!/export const addItemToInventory\b/.test(source),
        'cycle 316 addItemToInventory private 유지');
});
