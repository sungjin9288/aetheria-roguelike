import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 301: 2 reducer type aliases dead export 제거
 *   (cycle 222-300 silent dead config 시리즈 71번째 — cleanup lens 연속).
 *
 * 발견 (2 type alias dead export):
 * - src/reducers/actionTypes.ts:78 `export type ActionType = typeof AT[keyof typeof AT]`
 *   → src/, tests/ import 0건.
 * - src/reducers/gameStates.ts:22 `export type GameState = typeof GS[keyof typeof GS]`
 *   → 모든 consumer는 `GS` const만 import. type alias 자체는 import 0건.
 *   gameReducer.ts의 GameState (state shape — INITIAL_STATE 타입)와 명칭 충돌도 해소.
 *
 * 패턴 (cycle 222-300 silent dead config 시리즈 71번째, cycle 300 batch 직후):
 * - cycle 299: player.ts 8 sub-interface exports private downgrade.
 * - cycle 301: 2 reducer type alias 완전 제거 — AT/GS const literal types로 충분.
 *
 * 수정:
 * - actionTypes.ts: ActionType type alias 제거.
 * - gameStates.ts: GameState type alias 제거 (gameReducer GameState와 충돌 해소).
 *
 * 회귀 가드:
 * - AT / GS const export 그대로 — 모든 consumer 영향 없음.
 * - gameReducer.ts의 GameState (state shape) export 유지 (6 handler import 사용).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 301: ActionType type alias 제거', async () => {
    const source = await readSrc('src/reducers/actionTypes.ts');
    assert.ok(!/export type ActionType\b/.test(source),
        'ActionType type alias 제거됨');
});

test('cycle 301: gameStates.ts GameState type alias 제거', async () => {
    const source = await readSrc('src/reducers/gameStates.ts');
    assert.ok(!/export type GameState\b/.test(source),
        'gameStates.ts GameState type alias 제거됨');
});

test('cycle 301: AT / GS const export 유지 (회귀 가드)', async () => {
    const atSrc = await readSrc('src/reducers/actionTypes.ts');
    const gsSrc = await readSrc('src/reducers/gameStates.ts');
    assert.ok(/export const AT\b/.test(atSrc), 'AT export 유지');
    assert.ok(/export const GS\b/.test(gsSrc), 'GS export 유지');
});

test('cycle 301: gameReducer.ts GameState export 유지 (state shape — 다른 의미)', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(/export interface GameState\b/.test(source),
        'gameReducer GameState (state shape) export 유지');
});

test('cycle 299 회귀 가드: player.ts 8 sub-interfaces private 유지', async () => {
    const source = await readSrc('src/types/player.ts');
    assert.ok(!/export interface PlayerStats\b/.test(source),
        'cycle 299 PlayerStats private 유지');
});
