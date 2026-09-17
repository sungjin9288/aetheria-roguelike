import test from 'node:test';
import assert from 'node:assert/strict';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { BALANCE } from '../src/data/constants.js';
import { createEventActions } from '../src/hooks/gameActions/eventActions.js';

/**
 * 2026-09 Wave 3 I1 — 이벤트 outcome 확장 어휘(relic/status/elite/buff)의 소비 계약.
 *
 * 검증 축:
 *   ① 적용 순서: 수치 보상 → 상태이상/버프 → 유물 선택지 → 정예 전투(맨 마지막)
 *   ② 공정성: 이벤트는 절대 플레이어를 죽이지 않는다 (생명 ≥ 1 클램프 유지)
 *   ③ 화이트리스트: 정규화를 통과하지 않은 상태이상 id는 dispatch까지 가지 않는다
 *
 * 전부 실행 기반(팩토리를 실제로 호출하고 dispatch 로그를 읽는다) — 소스 문자열 가드 아님.
 */

const makeHarness = (outcome, playerOverrides = {}) => {
    const dispatches = [];
    const logs = [];
    const player = {
        name: '시험자',
        job: '모험가',
        level: 10,
        hp: 200,
        mp: 80,
        maxHp: 200,
        maxMp: 80,
        gold: 100,
        loc: '고요한 숲',
        inv: [],
        relics: [],
        quests: [],
        history: [],
        status: [],
        stats: {},
        meta: {},
        ...playerOverrides,
    };
    const deps = {
        player,
        currentEvent: {
            desc: '시험용 조우',
            choices: ['조사한다', '지나친다'],
            outcomes: [{ choiceIndex: 0, log: '시험 결과', ...outcome }],
        },
        dispatch: (action) => dispatches.push(action),
        addLog: (type, text) => logs.push({ type, text }),
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: player.maxHp, maxMp: player.maxMp, atk: 30, def: 10 }),
        rng: () => 0.5,
    };
    const shared = { emitUnlockedTitles: () => {}, commitExploreOutcome: () => {} };
    createEventActions(deps, shared).handleEventChoice(0);

    const setPlayer = dispatches.filter((d) => d.type === AT.SET_PLAYER);
    const resolvedPlayer = setPlayer.reduce(
        (acc, action) => (typeof action.payload === 'function' ? action.payload(acc) : action.payload),
        player,
    );
    return { dispatches, logs, resolvedPlayer };
};

const typesOf = (dispatches) => dispatches.map((d) => d.type);

test('status outcome: 기상 이변과 동일하게 player.status에 id 문자열로 누적된다', () => {
    const { resolvedPlayer, logs } = makeHarness({ status: { id: 'poison', turns: 2 } });

    assert.deepEqual(resolvedPlayer.status, ['poison']);
    // H1 연동: 이벤트가 준 지속 턴이 전투 틱(tickPlayerStatusDurations)이 읽는 statusTurns에 기록된다.
    assert.equal(resolvedPlayer.statusTurns?.poison, 2);
    assert.ok(logs.some((log) => log.text.includes('중독')), '중독 라벨 로그가 남아야 함');
});

test('status outcome: 화이트리스트 밖 id는 dispatch까지 도달하지 않는다', () => {
    // 정규화를 우회해 직접 주입해도(모델 → 저장 → 재생 경로 방어) 소비 단계에서 막힌다.
    const { resolvedPlayer } = makeHarness({ status: { id: 'instant_death', turns: 2 } });
    assert.deepEqual(resolvedPlayer.status, []);
});

test('buff outcome: 배율 스키마는 tempBuff(atk/def/turn)로 환산된다', () => {
    const { resolvedPlayer, logs } = makeHarness({ buff: { atkMult: 1.2, defMult: 1.1, turns: 4 } });

    assert.equal(Math.round(resolvedPlayer.tempBuff.atk * 100), 20);
    assert.equal(Math.round(resolvedPlayer.tempBuff.def * 100), 10);
    assert.equal(resolvedPlayer.tempBuff.turn, 4);
    assert.ok(logs.some((log) => log.text.includes('공격력 +20%')));
});

test('buff outcome: 기존 캠프파이어 스키마(atk/def/turn/name)는 그대로 유지된다', () => {
    const { resolvedPlayer } = makeHarness({ buff: { atk: 0.18, def: 0, turn: 6, name: '모닥불 단련' } });

    assert.equal(resolvedPlayer.tempBuff.atk, 0.18);
    assert.equal(resolvedPlayer.tempBuff.turn, 6);
    assert.equal(resolvedPlayer.tempBuff.name, '모닥불 단련');
});

test('relic outcome: 보유하지 않은 유물 후보로 SET_PENDING_RELICS가 열린다', () => {
    const { dispatches } = makeHarness({ relic: { count: 2 } });

    const pending = dispatches.find((d) => d.type === AT.SET_PENDING_RELICS);
    assert.ok(pending, 'SET_PENDING_RELICS dispatch 존재');
    assert.equal(pending.payload.length, 2);
    assert.equal(new Set(pending.payload.map((r) => r.id)).size, 2, '후보는 서로 달라야 함');
});

test('relic outcome: 유물 보유 한도에 도달하면 선택지를 열지 않는다', () => {
    const owned = [
        { id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }, { id: 'r5' },
    ];
    const { dispatches } = makeHarness({ relic: { count: 1 } }, { relics: owned });

    assert.equal(dispatches.find((d) => d.type === AT.SET_PENDING_RELICS), undefined);
});

test('elite outcome: 정예 조우가 전투 상태로 이어진다 (정찰 카드와 동일 산출)', () => {
    const { dispatches, logs } = makeHarness({ elite: true });

    const enemy = dispatches.find((d) => d.type === AT.SET_ENEMY);
    assert.ok(enemy, 'SET_ENEMY dispatch 존재');
    assert.equal(enemy.payload.isElite, true);
    assert.ok(enemy.payload.name.startsWith('정예'), `정예 접두 이름: ${enemy.payload.name}`);

    const states = dispatches.filter((d) => d.type === AT.SET_GAME_STATE).map((d) => d.payload);
    assert.deepEqual(states, [GS.COMBAT], '이벤트 종료 상태는 IDLE이 아니라 COMBAT');
    assert.ok(logs.some((log) => log.text.includes('정예')));
});

test('적용 순서: 수치 보상 → 상태이상/버프 → 유물 선택지 → 정예 전투', () => {
    const { dispatches, resolvedPlayer } = makeHarness({
        gold: 120,
        status: { id: 'bleed', turns: 2 },
        buff: { atkMult: 1.1, turns: 3 },
        relic: { count: 1 },
        elite: true,
    });

    const order = typesOf(dispatches);
    const pendingAt = order.indexOf(AT.SET_PENDING_RELICS);
    const enemyAt = order.indexOf(AT.SET_ENEMY);
    const combatAt = order.indexOf(AT.SET_GAME_STATE);

    assert.ok(pendingAt >= 0 && enemyAt >= 0, '유물/정예 dispatch 모두 존재');
    assert.ok(pendingAt < enemyAt, '유물 선택지가 전투보다 먼저 큐잉되어야 함');
    assert.ok(enemyAt < combatAt, '적 세팅 후 전투 상태 전이');

    // 수치/상태/버프는 전투 전에 이미 플레이어에 반영되어 있다.
    assert.equal(resolvedPlayer.gold, 220);
    assert.deepEqual(resolvedPlayer.status, ['bleed']);
    assert.equal(resolvedPlayer.tempBuff.turn, 3);
});

test('공정성: 생명 손실이 아무리 커도 이벤트는 플레이어를 죽이지 않는다', () => {
    const { resolvedPlayer } = makeHarness(
        { hp: -9999, status: { id: 'curse', turns: BALANCE.EVENT_STATUS_MAX_TURNS } },
        { hp: 12 },
    );

    assert.equal(resolvedPlayer.hp, 1, '이벤트 직접 피해는 생명 1에서 멈춘다');
});
