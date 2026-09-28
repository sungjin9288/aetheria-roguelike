import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { MSG } from '../src/data/messages.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { createAscensionActions } from '../src/hooks/gameActions/ascensionActions.ts';
import ControlPanel from '../src/components/ControlPanel.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * 2026-09 Wave 28 (D6, 소유자 결정 "계승 모달 반복 억제").
 *
 * 마왕을 쓰러뜨릴 때마다 계승 화면이 떴다 — 자연 플레이 16런에서 런당 70~112회, 본편 85를 진행하는 동안에도.
 * 계약: ① 계승 화면에서 미루면(DEFER_ASCENSION) 이번 런 동안 마왕 처치는 계승 화면을 다시 열지 않고 로그만
 * 남긴다(처치 정산 자체는 같다) ② 조작판의 [계승하기](REOPEN_ASCENSION)로 언제든 다시 열고 실제로 계승할 수 있다
 * ③ 미룸은 런 범위다 — 승천·사망으로 새 런이 되면 첫 마왕 처치에서 다시 묻는다 ④ 진엔딩 화면의 취소는 미룸이 아니다.
 * 모든 전이는 실제 리듀서로 확인한다(마왕 처치는 RESOLVE_COMBAT_ACTION 실경로).
 */

const apply = (state, type, payload) => gameReducer(state, { type, payload });

const basePlayer = (overrides = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '계승 검증',
    level: 60,
    atk: 100000,
    loc: '마왕성',
    quests: [],
    stats: { ...structuredClone(INITIAL_STATE.player.stats), claimedQuestIds: [80, 81, 82, 84, 83, 85, 86, 87] },
    meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 0 },
    ...overrides,
});

const idle = (playerOverrides) => ({ ...structuredClone(INITIAL_STATE), gameState: GS.IDLE, logs: [], player: basePlayer(playerOverrides) });

let seed = 11;
/** 실제 전투 전이로 마왕을 쓰러뜨린다(적 HP 1). 매번 다른 seed라 처치 영수증이 새로 찍힌다. */
const slayDemonKing = (state) => {
    seed += 1;
    const combat = {
        ...state,
        gameState: GS.COMBAT,
        combatTurn: 0,
        enemy: { name: '마왕', baseName: '마왕', isBoss: true, level: 70, hp: 1, maxHp: 1, atk: 1, def: 0, exp: 0, gold: 0, pattern: { guardChance: 0, heavyChance: 0 } },
    };
    return apply(combat, AT.RESOLVE_COMBAT_ACTION, { kind: 'attack', expectedTurn: 0, seed, now: 1000 + seed });
};

const cancelFrom = (state) => {
    let current = state;
    createAscensionActions({
        player: state.player,
        gameState: state.gameState,
        dispatch: (action) => { current = gameReducer(current, action); },
        addLog: (type, text) => { current = apply(current, AT.ADD_LOG, { id: `log-${current.logs.length}`, type, text }); },
    }).cancelAscension();
    return current;
};

const reopenFrom = (state) => {
    let current = state;
    createAscensionActions({
        player: state.player,
        gameState: state.gameState,
        dispatch: (action) => { current = gameReducer(current, action); },
        addLog: () => {},
    }).reopenAscension();
    return current;
};

const confirmFrom = (state) => {
    let current = state;
    createAscensionActions({
        player: state.player,
        gameState: state.gameState,
        dispatch: (action) => { current = gameReducer(current, action); },
        addLog: () => {},
    }).confirmAscension();
    return current;
};

test('[비공허] 미루지 않은 런에서 마왕 처치는 계승 화면을 연다', () => {
    const first = slayDemonKing(idle());
    assert.equal(first.gameState, GS.ASCENSION);
    assert.ok(first.logs.some((log) => log.text === MSG.DEMON_KING_SLAIN_ASCEND));
    const again = slayDemonKing({ ...first, gameState: GS.IDLE });
    assert.equal(again.gameState, GS.ASCENSION, '미루지 않으면 매번 묻는다(기존 동작)');
});

test('[D6] 계승 화면에서 미루면 이번 런의 다음 마왕 처치는 계승 화면을 열지 않는다 — 정산은 그대로', () => {
    const offered = slayDemonKing(idle());
    const deferred = cancelFrom(offered);
    assert.equal(deferred.gameState, GS.IDLE);
    assert.equal(deferred.player.ascensionOfferDeferred, true);
    assert.deepEqual(deferred.logs.slice(-2).map((log) => log.text), [MSG.ASCEND_CANCEL, MSG.ASCENSION_DEFERRED_NOTICE]);

    const slainAgain = slayDemonKing(deferred);
    assert.equal(slainAgain.gameState, GS.IDLE, '두 번째 처치는 계승 화면을 열지 않는다');
    assert.equal(slainAgain.player.stats.demonKingSlain, deferred.player.stats.demonKingSlain + 1, '처치 기록은 그대로 쌓인다');
    assert.notEqual(slainAgain.player.meta.endgame.lastEndgameReceiptKey, deferred.player.meta.endgame.lastEndgameReceiptKey, '영수증도 새로 찍힌다');
    const newLogs = slainAgain.logs.slice(deferred.logs.length);
    assert.ok(newLogs.some((log) => log.text === MSG.DEMON_KING_SLAIN_ASCEND_DEFERRED));
    assert.equal(newLogs.some((log) => log.text === MSG.DEMON_KING_SLAIN_ASCEND), false);
});

test('[D6] [계승하기]는 미룬 런의 idle에서만 계승 화면을 열고, 연 화면에서 실제로 계승된다', () => {
    const deferred = slayDemonKing(cancelFrom(slayDemonKing(idle())));
    assert.equal(deferred.gameState, GS.IDLE);

    const reopened = reopenFrom(deferred);
    assert.equal(reopened.gameState, GS.ASCENSION);

    const ascended = confirmFrom(reopened);
    assert.equal(ascended.player.meta.prestigeRank, deferred.player.meta.prestigeRank + 1, '최신 처치 영수증으로 계승이 수락된다');
    assert.equal(ascended.player.ascensionOfferDeferred, undefined, '미룸은 런 범위 — 새 런에는 없다');

    // 새 런의 첫 마왕 처치는 다시 묻는다.
    const nextRun = slayDemonKing({ ...ascended, gameState: GS.IDLE, player: { ...ascended.player, level: 60, atk: 100000, loc: '마왕성' } });
    assert.equal(nextRun.gameState, GS.ASCENSION);
});

test('[D6 게이트] 미룬 적이 없거나 idle이 아니면 [계승하기]는 아무것도 하지 않는다', () => {
    const fresh = idle();
    assert.strictEqual(apply(fresh, AT.REOPEN_ASCENSION), fresh, '미룬 적 없음');

    const deferred = cancelFrom(slayDemonKing(idle()));
    const inCombat = { ...deferred, gameState: GS.COMBAT };
    assert.strictEqual(apply(inCombat, AT.REOPEN_ASCENSION), inCombat, '전투 중');
    const inShop = { ...deferred, gameState: GS.SHOP };
    assert.strictEqual(apply(inShop, AT.REOPEN_ASCENSION), inShop, '상점');

    const forged = idle({ ascensionOfferDeferred: true });
    assert.strictEqual(apply(forged, AT.REOPEN_ASCENSION), forged, '처치 영수증이 없으면 열지 않는다');

    assert.strictEqual(apply(fresh, AT.DEFER_ASCENSION), fresh, '계승 화면 밖에서의 미루기는 무시');
});

test('[D6] 사망 뒤 새 런에는 미룸이 남지 않는다', () => {
    const deferred = cancelFrom(slayDemonKing(idle()));
    const restarted = apply({ ...deferred, gameState: GS.DEAD }, AT.RESET_GAME);
    assert.equal(restarted.player.ascensionOfferDeferred, undefined);
});

test('[D6] 진엔딩 화면의 취소는 미룸이 아니다 — 이전 동작 그대로', () => {
    const trueEnding = { ...idle(), gameState: GS.TRUE_ENDING };
    const cancelled = cancelFrom(trueEnding);
    assert.equal(cancelled.gameState, GS.IDLE);
    assert.equal(cancelled.player.ascensionOfferDeferred, undefined);
    assert.equal(cancelled.logs.at(-1)?.text, MSG.ASCEND_CANCEL);
});

test('[D6 표시] 조작판은 미룬 런의 idle에서만 [계승하기]를 그린다', () => {
    const NOOP_ACTIONS = new Proxy({}, { get: () => () => {} });
    const render = (player, gameState = GS.IDLE) => renderStatic(createElement(ControlPanel, {
        gameState, player, enemy: null, actions: NOOP_ACTIONS, setGameState: () => {},
        shopItems: [], grave: null, isAiThinking: false, currentEvent: null, stats: null,
        onOpenArchiveConsole: () => {},
    }));
    const deferredPlayer = cancelFrom(slayDemonKing(idle())).player;
    const shown = render(deferredPlayer);
    assert.ok(shown.includes('data-testid="control-reopen-ascension"'));
    assert.ok(shown.includes(MSG.ASCENSION_REOPEN_LABEL));
    assert.equal(render(basePlayer()).includes('control-reopen-ascension'), false, '미룬 적 없으면 없다');
});
