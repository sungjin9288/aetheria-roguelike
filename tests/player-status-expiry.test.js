import test from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { makeCombatActionMap } from '../src/reducers/handlers/combatHandlers.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';

/**
 * H1 (Wave 3 감사): 플레이어 상태이상 만료.
 *
 * 적 상태이상은 tickEnemyStatus가 `*Turns`를 감소시켜 만료했지만 플레이어 status에는
 * 대응 경로가 없어 한 번 부여되면 전투 끝까지 maxHp 4%/턴이 누적됐다.
 * BALANCE.PLAYER_STATUS_DURATION_TURNS 턴 뒤 해제되며, 해제 판정은 전투 전이를 소유한
 * reducer(CombatEngine.tickCombatState) 안에서만 일어난다.
 */

const antidote = {
    id: 'combat-antidote',
    name: '해독제',
    type: 'cure',
    effect: 'poison',
};

const makeState = (playerOverrides = {}, stateOverrides = {}) => ({
    ...structuredClone(INITIAL_STATE),
    player: {
        ...structuredClone(INITIAL_STATE.player),
        name: '리베이아',
        hp: 5000,
        maxHp: 5000,
        inv: [antidote],
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
        pattern: { guardChance: 1, heavyChance: 0 },
    },
    quickSlots: [antidote, null, null],
    ...stateOverrides,
});

const actionMap = makeCombatActionMap(INITIAL_STATE.player);

const attackOnce = (state, turn) => actionMap.RESOLVE_COMBAT_ACTION(state, {
    type: AT.RESOLVE_COMBAT_ACTION,
    payload: {
        kind: 'attack',
        expectedTurn: turn,
        seed: 20260916 + turn,
        now: 1_700_000_000_000 + turn,
    },
});

test('H1: 플레이어 상태이상은 PLAYER_STATUS_DURATION_TURNS 플레이어 턴 뒤 해제된다', () => {
    const duration = BALANCE.PLAYER_STATUS_DURATION_TURNS;
    assert.ok(duration >= 1, '지속 턴은 1 이상이어야 한다');

    let state = makeState({ status: ['poison'] });

    for (let turn = 0; turn < duration - 1; turn += 1) {
        state = attackOnce(state, turn);
        assert.deepEqual(state.player.status, ['poison'],
            `${turn + 1}번째 턴에는 아직 중독이 유지되어야 한다`);
        assert.equal(state.player.statusTurns.poison, duration - (turn + 1),
            '남은 턴이 매 턴 1씩 줄어야 한다');
    }

    state = attackOnce(state, duration - 1);
    assert.deepEqual(state.player.status, [], '지속 턴이 끝나면 상태이상이 해제된다');
    assert.equal(state.player.statusTurns.poison, undefined, '해제된 상태의 남은 턴도 사라진다');
    assert.ok(
        state.logs.some((log) => log.text === MSG.PLAYER_STATUS_EXPIRED('poison')),
        '해제 시 플레이어 언어로 안내 로그가 남는다',
    );
});

test('H1: 상태이상이 유지되는 동안 DoT 피해는 그대로 들어간다', () => {
    const before = makeState({ status: ['poison'] });
    const after = attackOnce(before, 0);
    const dot = Math.max(1, Math.floor(before.player.maxHp * BALANCE.STATUS_DOT_RATIO));

    assert.ok(
        after.logs.some((log) => log.text === MSG.STATUS_DOT('poison', dot)),
        'DoT 로그는 만료 도입 이후에도 동일하게 남는다',
    );
    assert.ok(after.player.hp <= before.player.hp - dot, 'DoT 피해가 실제로 적용된다');
});

test('H1: 해독제는 남은 턴과 무관하게 즉시 해제한다', () => {
    const state = makeState({ status: ['poison'], statusTurns: { poison: 3 } });
    const cured = actionMap.USE_COMBAT_ITEM(state, {
        type: AT.USE_COMBAT_ITEM,
        payload: {
            itemId: antidote.id,
            expectedTurn: 0,
            seed: 4242,
            now: 1_700_000_000_500,
        },
    });

    assert.deepEqual(cured.player.status, [], '해독제는 지속 턴이 남아 있어도 상태이상을 지운다');
    assert.equal(cured.player.statusTurns.poison, undefined, '해제된 상태의 남은 턴도 함께 정리된다');
    assert.ok(
        cured.logs.some((log) => log.text === MSG.ITEM_USE_CURE(antidote.name)),
        '해독 로그는 종전 그대로다',
    );
    assert.ok(
        !cured.logs.some((log) => log.text === MSG.PLAYER_STATUS_EXPIRED('poison')),
        '즉시 해제는 만료 안내와 겹치지 않는다',
    );
});

test('H1: 남은 턴 기록이 없는 구세이브 상태이상도 기본 지속 턴으로 만료된다', () => {
    const duration = BALANCE.PLAYER_STATUS_DURATION_TURNS;
    // 구세이브: status만 있고 statusTurns 필드 자체가 없다.
    let player = { ...structuredClone(INITIAL_STATE.player), hp: 5000, maxHp: 5000, status: ['poison'] };
    assert.equal(player.statusTurns, undefined, '구세이브에는 남은 턴 기록이 없다');

    const first = CombatEngine.tickCombatState(player);
    assert.equal(first.updatedPlayer.statusTurns.poison, duration - 1,
        '첫 틱에서 기본 지속 턴을 받고 1 감소한다');

    player = first.updatedPlayer;
    for (let tick = 1; tick < duration; tick += 1) {
        player = CombatEngine.tickCombatState(player).updatedPlayer;
    }
    assert.deepEqual(player.status, [], '구세이브 항목도 기본 지속 턴 뒤 해제된다');
});

test('H1: status 배열에 없는 잔여 턴 기록은 다음 틱에서 정리된다', () => {
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        hp: 5000,
        maxHp: 5000,
        status: ['poison'],
        statusTurns: { poison: 3, burn: 2 },
    };
    const ticked = CombatEngine.tickCombatState(player).updatedPlayer;

    assert.equal(ticked.statusTurns.poison, 2);
    assert.equal(ticked.statusTurns.burn, undefined,
        'status에 없는 키는 잔여 턴으로 남지 않는다(정화/휴식 경로 호환)');
});

test('H1: 적 상태이상 모델은 그대로다 (턴 감소는 적 개체 필드 소유)', () => {
    const cursed = CombatEngine.applyStatusEffectToEnemy(
        { name: '훈련용 정령', hp: 100, maxHp: 100 },
        'curse',
    );
    assert.equal(cursed.cursedTurns, 3, '적 저주 지속 턴은 종전 그대로');
    assert.equal(cursed.cursed, true);

    const enemy = {
        name: '훈련용 정령',
        hp: 100,
        maxHp: 100,
        blindTurns: 2,
        atkMult: BALANCE.BLIND_ATK_MULT,
        dots: ['poison'],
    };
    const firstTick = CombatEngine.tickEnemyStatus(enemy, [], 1, 1);
    assert.equal(firstTick.updatedEnemy.blindTurns, 1, '적 실명은 tickEnemyStatus가 감소시킨다');
    assert.deepEqual(firstTick.updatedEnemy.dots, ['poison'], '적 DoT 목록은 변경하지 않는다');
    assert.equal(firstTick.updatedEnemy.statusTurns, undefined,
        '플레이어 전용 statusTurns를 적에 붙이지 않는다');

    const secondTick = CombatEngine.tickEnemyStatus(firstTick.updatedEnemy, [], 1, 1);
    assert.equal(secondTick.updatedEnemy.blindTurns, undefined, '0이 되면 필드와 배율이 함께 제거된다');
    assert.equal(secondTick.updatedEnemy.atkMult, undefined);
});
