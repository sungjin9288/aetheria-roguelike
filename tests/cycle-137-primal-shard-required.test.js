import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { CONSTANTS, BALANCE } from '../src/data/constants.js';

/**
 * cycle 137: PRIMAL_SHARD_REQUIRED dead constant 활성화.
 *
 * 발견:
 * - CONSTANTS.PRIMAL_SHARD_REQUIRED: 3 + 주석 "진 보스 해금에 필요한 파편 수"가
 *   정의돼 있지만 src/ 전체에서 read하는 코드 0건.
 * - 대신 combatBossHandlers.ts에 `shardCount < 3` / `>= 3` / `Math.min(shardCount + 1, 3)`
 *   로 3이 3곳 hardcoded.
 * - DRY 원칙 위반 — 디자인이 "파편 5개로 변경"하려면 3곳을 모두 찾아 수정해야 함.
 *
 * cycle 136 KILL_STREAK_DECAY_MS와 같은 결의 dead constant 활성화 사이클.
 *
 * 수정:
 * combatBossHandlers.ts의 3 hardcoded → CONSTANTS.PRIMAL_SHARD_REQUIRED로 교체.
 * `prestigeRank >= 3` (rank 임계)은 별개 개념이라 건드리지 않음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('BALANCE.PRIMAL_SHARD_REQUIRED 등록됨 (회귀 가드)', () => {
    assert.equal(typeof BALANCE.PRIMAL_SHARD_REQUIRED, 'number');
    assert.equal(BALANCE.PRIMAL_SHARD_REQUIRED, 3);
});

test('BALANCE.PRIMAL_SHARD_DROP_CHANCE 등록됨 (회귀 가드)', () => {
    assert.equal(typeof BALANCE.PRIMAL_SHARD_DROP_CHANCE, 'number');
});

test('combatBossHandlers: 더 이상 CONSTANTS.PRIMAL_SHARD_DROP_CHANCE 잘못 참조 안 함', async () => {
    const source = await readSrc('src/hooks/combatActions/combatBossHandlers.ts');
    // CONSTANTS.PRIMAL_SHARD_DROP_CHANCE는 undefined여서 shard never drop 버그였음.
    // BALANCE.PRIMAL_SHARD_DROP_CHANCE로 교체되어야 함.
    assert.doesNotMatch(source, /CONSTANTS\.PRIMAL_SHARD_DROP_CHANCE/);
    assert.match(source, /BALANCE\.PRIMAL_SHARD_DROP_CHANCE/);
});

test('useInventoryActions: 더 이상 CONSTANTS.DAILY_INVADE_LIMIT 잘못 참조 안 함', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    // CONSTANTS.DAILY_INVADE_LIMIT은 undefined여서 일일 침략 5회 제한이 작동 안 했음.
    // BALANCE.DAILY_INVADE_LIMIT로 교체되어야 함.
    assert.doesNotMatch(source, /CONSTANTS\.DAILY_INVADE_LIMIT/);
    assert.match(source, /BALANCE\.DAILY_INVADE_LIMIT/);
});

test('combatBossHandlers: PRIMAL_SHARD_REQUIRED 참조 코드 존재 (>= 1건)', async () => {
    const source = await readSrc('src/hooks/combatActions/combatBossHandlers.ts');
    const matches = source.match(/PRIMAL_SHARD_REQUIRED/g) || [];
    assert.ok(matches.length >= 1, `expected >=1 reference, got ${matches.length}`);
});

test('combatBossHandlers: hardcoded 3 shard 비교가 PRIMAL_SHARD_REQUIRED로 교체됨', async () => {
    const source = await readSrc('src/hooks/combatActions/combatBossHandlers.ts');
    // 더 이상 hardcoded `shardCount < 3` 패턴이 직접 등장하지 않음 (지역 상수로
    // alias하여 사용).
    assert.doesNotMatch(source, /shardCount\s*<\s*3\b/);
    assert.doesNotMatch(source, /currentShardCount\s*>=\s*3\b/);
});
