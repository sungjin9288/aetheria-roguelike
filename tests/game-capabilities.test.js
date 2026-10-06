import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PRODUCTION_GAME_CAPABILITIES } from '../src/platform/gameCapabilities.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { createInventoryActions } from '../src/hooks/useInventoryActions.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSource = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');

/**
 * 2026-10 Wave 70 (소유자 결정): 공개 목록 침공(`publicGraveInvasion`, 꺼져 있었다)은 탐험 이벤트 "다른 차원의 묘비"로 바뀌었다.
 * 이 계약은 그 전환을 고정한다 — 목록 침공 경로(액션 · 리듀서 · 화면)는 되돌아오지 않고, 네트워크(업로드 · 읽기)는 같은 플래그 하나를 본다.
 * 이벤트 자체의 행동은 tests/dimension-grave-event-contract.test.js가 실제 explore() · 리듀서로 확인한다.
 */
test('production capabilities turn the dimension grave event on and stay frozen', () => {
    assert.deepEqual(PRODUCTION_GAME_CAPABILITIES, { dimensionGraveEvent: true });
    assert.equal(Object.isFrozen(PRODUCTION_GAME_CAPABILITIES), true);
    assert.throws(() => {
        PRODUCTION_GAME_CAPABILITIES.dimensionGraveEvent = false;
    }, TypeError);
});

test('production inventory actions do not expose list grave invasion', () => {
    const actions = createInventoryActions({
        player: structuredClone(INITIAL_STATE.player),
        gameState: 'idle',
        dispatch: () => assert.fail('list grave action must not dispatch'),
        addLog: () => assert.fail('list grave action must not log'),
        addStoryLog: () => {},
        getFullStats: () => ({ atk: 10 }),
    });

    assert.equal('invadeGrave' in actions, false);
});

test('the list invasion action is gone — a forged INVADE_GRAVE dispatch is an exact no-op', () => {
    assert.equal('INVADE_GRAVE' in AT, false);
    const state = structuredClone(INITIAL_STATE);
    const next = gameReducer(state, {
        type: 'INVADE_GRAVE',
        payload: {
            uid: 'remote-grave',
            reward: { id: 'forged', name: '복제된 장비', type: 'weapon', tier: 6 },
        },
    });

    assert.equal(next, state);
});

test('every public grave network owner reads the same capability flag, and the panel owns no network', async () => {
    const [panel, dashboard, sync, pool] = await Promise.all([
        readSource('src/components/GravePanel.tsx'),
        readSource('src/components/Dashboard.tsx'),
        readSource('src/hooks/useFirebaseSync.ts'),
        readSource('src/hooks/useDimensionGravePool.ts'),
    ]);

    assert.match(sync, /PRODUCTION_GAME_CAPABILITIES\.dimensionGraveEvent/);
    assert.match(pool, /PRODUCTION_GAME_CAPABILITIES\.dimensionGraveEvent/);
    assert.doesNotMatch(panel, /firebase\/firestore|capabilities|publicGraveInvasion/);
    assert.doesNotMatch(dashboard, /capabilities=\{PRODUCTION_GAME_CAPABILITIES\}/);
});
