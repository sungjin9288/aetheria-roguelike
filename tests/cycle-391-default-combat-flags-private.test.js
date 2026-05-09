import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 391: DEFAULT_COMBAT_FLAGS export → private downgrade
 *   (cycle 222-390 silent dead config 시리즈 154번째 — cleanup lens 연속).
 *
 * 발견 (private downgrade 후보):
 * - src/utils/playerStateUtils.ts: DEFAULT_COMBAT_FLAGS — playerStateUtils 내부
 *   2회 사용 (line 41 hasTemporaryAdventureState + line 69 clearTemporaryAdventureState),
 *   외부 consumer 0건 (src 0, tests 0).
 * - src/systems/CombatEngine.ts:22의 DEFAULT_COMBAT_FLAGS는 별개 property (객체 멤버),
 *   playerStateUtils 의 export와 무관.
 * - cycle 317 test가 active export로 잘못 가드 — 외부 consumer 0건이 변하지 않은 상태.
 *
 * 패턴 (cycle 222-390 silent dead config 시리즈 154번째):
 * - cycle 295/298/312/316/317/369: export → private downgrade lens.
 * - cycle 390: 20번째 milestone batch.
 * - cycle 391: DEFAULT_COMBAT_FLAGS private downgrade — 동일 lens 회귀.
 *
 * 수정:
 * 1) src/utils/playerStateUtils.ts: `export const DEFAULT_COMBAT_FLAGS` → `const DEFAULT_COMBAT_FLAGS`.
 * 2) tests/cycle-317-empty-temp-buff-private.test.js: activeExports에서 DEFAULT_COMBAT_FLAGS 제거.
 *
 * 회귀 가드:
 * - hasTemporaryAdventureState / clearTemporaryAdventureState / incrementStat active export 유지.
 * - clearTemporaryAdventureState combatFlags 초기화 동작 보존 (DEFAULT_COMBAT_FLAGS 내부 사용).
 * - CombatEngine.DEFAULT_COMBAT_FLAGS (별개 property) 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 391: DEFAULT_COMBAT_FLAGS export 제거 (private)', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    assert.ok(!/export const DEFAULT_COMBAT_FLAGS\b/.test(source),
        'DEFAULT_COMBAT_FLAGS export 제거됨');
    assert.ok(/const DEFAULT_COMBAT_FLAGS\b/.test(source),
        'DEFAULT_COMBAT_FLAGS const 정의 유지 (private)');
});

test('cycle 391: playerStateUtils 활성 export 유지', async () => {
    const source = await readSrc('src/utils/playerStateUtils.ts');
    const activeExports = ['incrementStat', 'hasTemporaryAdventureState', 'clearTemporaryAdventureState'];
    activeExports.forEach((name) => {
        const re = new RegExp(`export const ${name}\\b`);
        assert.ok(re.test(source), `${name} export 유지`);
    });
});

test('cycle 391: clearTemporaryAdventureState combatFlags 초기화 동작 보존', async () => {
    const { clearTemporaryAdventureState } = await import('../src/utils/playerStateUtils.js');
    const player = {
        tempBuff: { atk: 5, def: 2, turn: 3, name: '버프' },
        combatFlags: { comboCount: 4, deathSaveUsed: true, voidHeartUsed: true, voidHeartArmed: true },
        status: ['poison'],
    };
    const result = clearTemporaryAdventureState(player);
    assert.equal(result.combatFlags.comboCount, 0, 'comboCount reset');
    assert.equal(result.combatFlags.deathSaveUsed, false, 'deathSaveUsed reset');
    assert.equal(result.combatFlags.voidHeartUsed, true, 'voidHeartUsed 보존 (run-wide)');
    assert.equal(result.combatFlags.voidHeartArmed, true, 'voidHeartArmed 보존 (run-wide)');
    assert.deepEqual(result.status, [], 'status reset');
});

test('cycle 390 회귀 가드: cycle 389 computeKillStreakBonus.tierIdx 0건 보존', async () => {
    const source = await readSrc('src/utils/statsCalculator.ts');
    const fnStart = source.indexOf('const computeKillStreakBonus');
    const fnEnd = source.indexOf('export const calculateFullStats');
    const block = source.slice(fnStart, fnEnd);
    assert.ok(!/return\s*\{[^}]*tierIdx[^}]*\}/.test(block),
        'cycle 389 tierIdx 출력 0건 보존');
});
