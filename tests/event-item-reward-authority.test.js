import test from 'node:test';
import assert from 'node:assert/strict';

import { createEventActions } from '../src/hooks/gameActions/eventActions.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';

test('a persisted event with an unknown item cannot settle or close', () => {
    const player = structuredClone(INITIAL_STATE.player);
    const currentEvent = {
        source: 'ai',
        desc: '낯선 상자가 열립니다.',
        choices: ['상자를 연다', '그대로 둔다'],
        outcomes: [{
            choiceIndex: 0,
            item: '존재하지 않는 전설검',
            log: '존재하지 않는 전설검을 얻었습니다.',
        }],
    };
    const dispatches = [];
    const logs = [];

    createEventActions({
        player,
        currentEvent,
        dispatch: (action) => dispatches.push(action),
        addLog: (type, text) => logs.push({ type, text }),
        getFullStats: () => ({ maxHp: player.maxHp, maxMp: player.maxMp }),
        rng: () => 0.5,
    }, { emitUnlockedTitles: () => {} }).handleEventChoice(0);

    assert.deepEqual(dispatches, []);
    assert.deepEqual(logs, [{
        type: 'error',
        text: '이 선택의 보상 정보를 확인할 수 없습니다. 다른 선택을 골라주세요.',
    }]);
});
