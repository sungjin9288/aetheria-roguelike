import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';

/**
 * H2 (Wave 3 감사): settleNonVictory 추출 계약.
 *
 * RESOLVE_COMBAT_ACTION과 USE_COMBAT_ITEM의 "승리가 아닌" 정산은 한 헬퍼가 소유한다.
 * 추출 전후로 결과 state가 같아야 하므로 이 테스트는 (1) 헬퍼가 쓰는 필드의 값을 전부
 * 명시적으로 고정하고, (2) 그 밖의 모든 state 필드는 입력과 참조 동일(===)임을 확인한다.
 * 참조 동일성 검사가 있어 헬퍼가 새 필드를 건드리거나 덮어쓰면 즉시 실패한다.
 */

const potion = { id: 'settle-potion', name: '전투 회복 물약', type: 'hp', val: 10 };

/** settleNonVictory가 실제로 계산하는 필드 — 나머지는 전부 그대로 통과해야 한다. */
const SETTLED_FIELDS = [
    'player', 'enemy', 'gameState', 'grave', 'runSummary', 'logs',
    'quickSlots', 'visualEffect', 'combatTurn', 'combatReceipt', 'syncStatus',
];

const makeState = (playerOverrides = {}, enemyOverrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '리베이아',
        level: 4,
        loc: '고요한 숲',
        hp: 500,
        maxHp: 500,
        inv: [potion],
        ...playerOverrides,
    },
    gameState: 'combat',
    enemy: {
        name: '훈련용 정령',
        baseName: '훈련용 정령',
        level: 1,
        hp: 100000,
        maxHp: 100000,
        atk: 1,
        def: 0,
        exp: 1,
        gold: 1,
        pattern: { guardChance: 0, heavyChance: 0 },
        ...enemyOverrides,
    },
    quickSlots: [potion, null, null],
});

const actionMap = makeCombatActionMap(INITIAL_STATE.player);

/** 정산 대상이 아닌 필드는 전부 입력 state의 값을 그대로 유지해야 한다. */
const assertUntouchedFields = (before, after) => {
    assert.deepEqual(
        Object.keys(after).sort(),
        Object.keys(before).sort(),
        '정산이 state 키를 추가하거나 제거하지 않는다',
    );
    Object.keys(before).forEach((key) => {
        if (SETTLED_FIELDS.includes(key)) return;
        assert.equal(after[key], before[key], `${key}는 비승리 정산이 건드리지 않는다`);
    });
};

test('H2: 전투 행동 사망 정산의 모든 필드', () => {
    const state = makeState({ hp: 1 }, { atk: 9999 });
    const next = actionMap.RESOLVE_COMBAT_ACTION(state, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'attack', expectedTurn: 0, seed: 1, now: 1_700_000_000_000 },
    });

    assert.equal(next.gameState, 'dead');
    assert.equal(next.enemy, null);
    assert.equal(next.combatTurn, 1);
    assert.equal(next.visualEffect, null);
    assert.equal(next.syncStatus, 'syncing');
    assert.equal(next.player.killStreak, 0, '사망 시 연속 처치는 끊긴다');
    assert.equal(state.grave, null, '시작 state에는 유해가 없다');
    assert.equal(next.grave.length, 1, '사망은 유해를 남긴다');
    assert.ok(next.runSummary, '사망은 런 요약을 남긴다');
    assert.equal(next.runSummary.loc, '고요한 숲');
    assert.ok(next.logs.length > state.logs.length, '전투 로그가 이어붙는다');
    next.logs.slice(state.logs.length).forEach((entry) => {
        assert.match(entry.id, /^combat-item-1700000000000-1-\d+$/, '로그 id 규칙은 종전 그대로');
        assert.equal(typeof entry.type, 'string');
        assert.equal(typeof entry.text, 'string');
    });
    assert.deepEqual(next.quickSlots, [null, null, null], '없는 아이템 퀵슬롯은 정리된다');
    assert.deepEqual(next.combatReceipt, {
        key: '1:1700000000000:1',
        kind: 'defeat',
        stories: [
            { type: 'death', data: { loc: '고요한 숲' } },
            { type: 'ruinRecap', data: { name: '리베이아', level: 4 } },
        ],
    });
    assertUntouchedFields(state, next);
});

test('H2: 도주 성공 정산의 모든 필드', () => {
    const state = makeState();
    const next = actionMap.RESOLVE_COMBAT_ACTION(state, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'escape', expectedTurn: 0, seed: 1, now: 1_700_000_000_000 },
    });

    assert.equal(next.combatReceipt.kind, 'escape', '시드 1은 도주 성공 분기');
    assert.equal(next.gameState, 'idle', '도주는 전투를 벗어난다');
    assert.equal(next.enemy, null);
    assert.equal(next.combatTurn, 1);
    assert.equal(next.visualEffect, null);
    assert.equal(next.syncStatus, 'syncing');
    assert.equal(next.grave, state.grave, '도주는 유해를 남기지 않는다');
    assert.equal(next.runSummary, state.runSummary, '도주는 런 요약을 만들지 않는다');
    assert.equal(next.player.stats.escapes, (state.player.stats?.escapes || 0) + 1);
    assert.deepEqual(next.quickSlots, state.quickSlots, '도주는 인벤을 건드리지 않는다');
    assert.ok(next.logs.length > state.logs.length);
    assert.deepEqual(next.combatReceipt, {
        key: '1:1700000000000:1',
        kind: 'escape',
        stories: [],
    });
    assertUntouchedFields(state, next);
});

test('H2: 도주 실패는 전투를 계속하고 적을 유지한다', () => {
    const state = makeState();
    const next = actionMap.RESOLVE_COMBAT_ACTION(state, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'escape', expectedTurn: 0, seed: 7, now: 1_700_000_000_007 },
    });

    assert.equal(next.combatReceipt.kind, 'continue', '시드 7은 도주 실패 분기');
    assert.equal(next.gameState, 'combat');
    assert.equal(next.enemy.name, '훈련용 정령');
    assert.equal(next.grave, state.grave);
    assert.equal(next.runSummary, state.runSummary);
    assert.deepEqual(next.combatReceipt.stories, []);
    assertUntouchedFields(state, next);
});

test('H2: 소모품 턴 사망 정산은 턴 시작 시점 player로 이야기를 남긴다', () => {
    const state = makeState({ hp: 1 }, { atk: 9999 });
    const next = actionMap.USE_COMBAT_ITEM(state, {
        type: AT.USE_COMBAT_ITEM,
        payload: { itemId: potion.id, expectedTurn: 0, seed: 1, now: 1_700_000_000_000 },
    });

    assert.equal(next.gameState, 'dead');
    assert.equal(next.enemy, null);
    assert.equal(next.combatTurn, 1);
    assert.equal(next.grave.length, 1);
    assert.ok(next.runSummary);
    assert.deepEqual(next.quickSlots, [null, null, null]);
    assert.deepEqual(next.combatReceipt, {
        key: '1:1700000000000:1',
        kind: 'defeat',
        stories: [
            { type: 'death', data: { loc: '고요한 숲' } },
            { type: 'ruinRecap', data: { name: '리베이아', level: 4 } },
        ],
    });
    assertUntouchedFields(state, next);
});

test('H2: 소모품 턴은 도주 분기를 만들지 않는다', () => {
    const state = makeState();
    const next = actionMap.USE_COMBAT_ITEM(state, {
        type: AT.USE_COMBAT_ITEM,
        payload: { itemId: potion.id, expectedTurn: 0, seed: 1, now: 1_700_000_000_000 },
    });

    assert.equal(next.combatReceipt.kind, 'continue');
    assert.equal(next.gameState, 'combat');
    assert.deepEqual(next.combatReceipt.stories, []);
    assert.equal(next.grave, state.grave);
    assertUntouchedFields(state, next);
});
