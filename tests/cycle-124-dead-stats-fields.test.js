import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { INITIAL_STATE } from '../src/reducers/gameReducer.js';

/**
 * cycle 124: 데드 stats 필드 정리 — comboCount, lowHpWins.
 *
 * cycle 90-93/116 dead code 흐름. 발견:
 *
 * stats.comboCount:
 * - INITIAL_STATE에 0으로 선언, migrateData에 default 추가.
 * - 그러나 stats.comboCount를 read/write하는 코드 0건. 활용되는 combo 카운터는
 *   `combatFlags.comboCount` (별도 필드).
 * - 명백히 dead field.
 *
 * stats.lowHpWins:
 * - INITIAL_STATE 0, migrate default.
 * - countLowHpWins(DifficultyManager:156)에서 `stats?.lowHpWins || 0` fallback
 *   으로 읽지만, recentBattles가 항상 데이터 있으므로 fallback 미실행.
 * - 또한 lowHpWins 필드를 write하는 코드 0건 — 항상 0 그대로.
 * - countLowHpWins은 stats?.lowHpWins가 undefined여도 || 0으로 안전.
 *
 * 수정:
 * - INITIAL_STATE.player.stats에서 comboCount, lowHpWins 제거.
 * - migrateData에서 두 필드 default 라인 제거.
 * - countLowHpWins fallback은 그대로 (legacy save 호환 — `|| 0` 안전).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('INITIAL_STATE.player.stats: comboCount 제거됨', () => {
    const stats = INITIAL_STATE.player.stats || {};
    assert.equal(stats.comboCount, undefined, 'stats.comboCount should not be declared');
});

test('INITIAL_STATE.player.stats: lowHpWins 제거됨', () => {
    const stats = INITIAL_STATE.player.stats || {};
    assert.equal(stats.lowHpWins, undefined, 'stats.lowHpWins should not be declared');
});

test('migrateData: stats.comboCount default 라인 제거됨', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.doesNotMatch(
        source,
        /target\.stats\.comboCount\s*=\s*target\.stats\.comboCount\s*\|\|\s*0/
    );
});

test('migrateData: stats.lowHpWins default 라인 제거됨 (없었음 — 회귀 가드)', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    // 원래도 없었으나 회귀 가드 — 미래에 잘못 추가되지 않도록.
    const matches = source.match(/target\.stats\.lowHpWins\s*=/g) || [];
    assert.equal(matches.length, 0);
});

test('회귀 보존: combatFlags.comboCount는 active 필드 (DEFAULT_COMBAT_FLAGS에 존재)', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    assert.match(source, /comboCount:\s*0/, 'DEFAULT_COMBAT_FLAGS.comboCount should remain');
});

test('회귀 보존: countLowHpWins은 fallback 로직이 안전 (undefined → 0)', async () => {
    const { countLowHpWins } = await import('../src/systems/DifficultyManager.js');
    assert.equal(countLowHpWins({}, 0.2), 0);
    assert.equal(countLowHpWins({ recentBattles: [] }, 0.2), 0);
});
