import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 305: publicGraves dead state 제거 (gameReducer + multiplayerHandlers)
 *   (cycle 222-304 silent dead config 시리즈 75번째 — cleanup lens 연속).
 *
 * 발견 (dead state field):
 * - src/reducers/gameReducer.ts:
 *   - GameState interface에 publicGraves: any[] 선언.
 *   - INITIAL_STATE에 publicGraves: [] 초기화.
 * - src/reducers/handlers/multiplayerHandlers.ts:
 *   - INVADE_GRAVE 핸들러가 state.publicGraves.filter(...)로 read.
 *
 * 그러나:
 * - SET_PUBLIC_GRAVES / ADD_PUBLIC_GRAVE 등 publicGraves에 데이터 추가하는 dispatch 0건.
 * - UI에서 state.publicGraves render / read 0건.
 * - 항상 [] 상태이므로 filter도 항상 no-op.
 *
 * 패턴 (cycle 222-304 silent dead config 시리즈 75번째):
 * - cycle 304: DB wrapper 2 dead key 제거.
 * - cycle 305: publicGraves dead state 제거 — GameState 표면 1개 축소.
 *
 * 수정:
 * - gameReducer.ts: GameState interface publicGraves 필드 제거 + INITIAL_STATE [] 초기화 제거.
 * - multiplayerHandlers.ts: INVADE_GRAVE 핸들러 publicGraves filter 제거 (no-op).
 *   targetUid 인자도 현재 dispatch 미사용이라 함께 제거.
 *
 * 회귀 가드:
 * - INVADE_GRAVE 핸들러 다른 dispatch (inv 추가, dailyInvadeCount, lastInvadeDate) 그대로.
 * - GameState 다른 필드 (player / logs / enemy 등) 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 305: GameState interface publicGraves 필드 제거', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(!/publicGraves:\s*any\[\];/.test(source),
        'publicGraves 타입 필드 제거됨');
});

test('cycle 305: INITIAL_STATE publicGraves 초기화 제거', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.ok(!/publicGraves:\s*\[\],/.test(source),
        'publicGraves: [] 초기화 제거됨');
});

test('cycle 305: INVADE_GRAVE 핸들러 publicGraves filter 제거', async () => {
    const source = await readSrc('src/reducers/handlers/multiplayerHandlers.ts');
    assert.ok(!/publicGraves:\s*state\.publicGraves\.filter/.test(source),
        'publicGraves filter 제거됨');
});

test('cycle 305: INVADE_GRAVE 핸들러 active dispatch 보존', async () => {
    const source = await readSrc('src/reducers/handlers/multiplayerHandlers.ts');
    assert.ok(/dailyInvadeCount/.test(source), 'dailyInvadeCount dispatch 유지');
    assert.ok(/lastInvadeDate/.test(source), 'lastInvadeDate dispatch 유지');
    assert.ok(/syncStatus:\s*'syncing'/.test(source), 'syncStatus syncing 유지');
});

test('cycle 304 회귀 가드: DB wrapper 2 dead key 유지 제거', async () => {
    const source = await readSrc('src/data/db.ts');
    assert.ok(!/LOOT_TABLE:\s*any;/.test(source),
        'cycle 304 DB.LOOT_TABLE 제거 유지');
});
