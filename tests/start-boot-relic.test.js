import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { AT } from '../src/reducers/actionTypes.js';
import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';

/**
 * B-1 (B+ 2026-06): 시작 부트 — 캐릭터 생성 직후 첫 유물 3선택 제공.
 * 느린 초반을 "내 빌드 실험"으로 전환 (Hades 거울 / StS Neow).
 */

const makeDeps = () => {
    const dispatches = [];
    const logs = [];
    const deps = {
        player: { meta: {}, stats: {} },
        gameState: 'idle',
        dispatch: (a) => dispatches.push(a),
        addLog: (type, text) => logs.push({ type, text }),
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: 178, maxMp: 52 }),
    };
    return { deps, dispatches, logs };
};

const noopHooks = { emitUnlockedTitles: () => {}, emitDailyProtocolLogs: () => {} };

test('B-1: 캐릭터 생성 시 시작 부트 유물 3선택 dispatch', () => {
    const { deps, dispatches, logs } = makeDeps();
    const actions = createCharacterActions(deps, noopHooks);
    actions.start('히어로', 'male', '모험가', []);

    const pending = dispatches.find((d) => d.type === AT.SET_PENDING_RELICS);
    assert.ok(pending, 'SET_PENDING_RELICS dispatch 존재');
    assert.equal(pending.payload.length, BALANCE.START_BOOT_RELIC_CHOICES);
    assert.deepEqual(logs.slice(0, 2), [
        { type: 'system', text: MSG.START_JOURNEY('히어로') },
        { type: 'event', text: MSG.START_SKILL('강타') },
    ]);
    assert.ok(logs.some((l) => l.text === MSG.START_BOOT_RELIC), '시작 부트 안내 로그');
    assert.doesNotMatch(logs.map((log) => log.text).join(' '), /콜사인|초기 스킬|빌드/);
});

test('B-1: 빈 이름이면 시작 자체가 미발동 (부트도 없음)', () => {
    const { deps, dispatches } = makeDeps();
    const actions = createCharacterActions(deps, noopHooks);
    actions.start('   ', 'male', '모험가', []);
    assert.equal(dispatches.length, 0, '빈 이름 → early return, dispatch 0건');
});

test('새 여정 준비는 이전 reset 안내를 플레이 기록에 남기지 않는다', () => {
    const { deps, dispatches, logs } = makeDeps();
    const actions = createCharacterActions(deps, noopHooks);

    actions.reset();

    assert.deepEqual(dispatches, [{ type: AT.RESET_GAME }]);
    assert.deepEqual(logs, []);
});
