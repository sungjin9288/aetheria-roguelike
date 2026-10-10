import test from 'node:test';
import assert from 'node:assert/strict';

import { CONSTANTS } from '../src/data/constants.js';
import { MSG } from '../src/data/messages.js';
import { FIRST_VISIT_REWARDS } from '../src/data/firstVisitRewards.js';
import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { pickPermanentPlayerState } from '../src/utils/permanentProgress.js';
import { getFirstVisitClaimedMaps } from '../src/utils/firstVisitRewards.js';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { createMoveActions } from '../src/hooks/gameActions/moveActions.js';

/**
 * 2026-10 Wave 62 (원장 §61.4 C11, 소유자 결정 "첫 방문은 여정마다") — 첫 방문 보상은 여정(새 게임 · 사망 재시작 · 계승)마다
 * 지역당 한 번이다. 방문 기록(`stats.visitedMaps` — 발견 지역 수 · 업적 · 임무)의 뜻은 그대로다.
 *
 * 이전: 사망 재시작은 방문 기록을 시작 마을로 되돌려 51곳을 다시 다 줬고(그건 그대로 — 새 여정이다), 계승은 방문 기록을 넘겨
 * 한 곳도 주지 않았다.
 */

const NOW = 1_700_000_000_000;
const FOREST = '고요한 숲';
const REWARD = FIRST_VISIT_REWARDS[FOREST];

const basePlayer = (extra = {}) => ({
    ...structuredClone(INITIAL_STATE.player),
    name: '순례자', job: '전사', loc: CONSTANTS.START_LOCATION, level: 60, exp: 0, nextExp: 9_999_999,
    hp: 900, maxHp: 900, mp: 100, maxMp: 100, gold: 0, quests: [],
    ...extra,
});

const harness = (player, gameState = GS.IDLE) => {
    let state = { ...structuredClone(INITIAL_STATE), gameState, player, bootStage: 'ready', logs: [] };
    return { get state() { return state; }, dispatch(action) { state = gameReducer(state, action); } };
};

/** 실제 이동 액션으로 간다 — 로그와 이번 이동의 골드 변화를 돌려준다. */
const move = (h, loc) => {
    const logs = [];
    const before = h.state.player.gold || 0;
    createMoveActions({ player: h.state.player, gameState: GS.IDLE, grave: [], isAiThinking: false, liveConfig: {},
        dispatch: h.dispatch, addLog: (type, text) => logs.push(text) }).move(loc);
    assert.equal(h.state.player.loc, loc, `${loc}로 이동했다`);
    return { logs, gold: (h.state.player.gold || 0) - before };
};

/** 고요한 숲을 다녀온다 — 받은 첫 방문 보상 골드. */
const roundTrip = (h) => {
    const out = move(h, FOREST);
    move(h, CONSTANTS.START_LOCATION);
    return out;
};

const startJourney = (h, player) => createCharacterActions({
    player, gameState: GS.IDLE, dispatch: h.dispatch, addLog: () => {}, addStoryLog: () => {},
    getFullStats: (p = h.state.player) => calculateFullStats(p),
}, { emitUnlockedTitles: () => {} }).start('순례자', 'male', '모험가', []);

test('같은 여정에서는 지역당 한 번 — 두 번째 방문은 보상이 없다', () => {
    const h = harness(basePlayer({ firstVisitRewardMaps: [] }));
    const first = roundTrip(h);
    assert.equal(first.gold, REWARD.gold);
    assert.ok(first.logs.includes(REWARD.msg));
    const second = roundTrip(h);
    assert.equal(second.gold, 0);
    assert.ok(!second.logs.includes(REWARD.msg));
    assert.deepEqual(getFirstVisitClaimedMaps(h.state.player), [FOREST]);
});

test('사망 재시작은 새 여정 — 같은 지역의 보상을 다시 한 번 받는다', () => {
    const h = harness(basePlayer({ firstVisitRewardMaps: [] }));
    assert.equal(roundTrip(h).gold, REWARD.gold);
    const dead = CombatEngine.handleDefeat(h.state.player, structuredClone(INITIAL_STATE.player), () => 0.5, () => NOW).updatedPlayer;
    assert.equal(dead.firstVisitRewardMaps, undefined, '런 범위 필드는 영구 상태로 넘어가지 않는다');
    const restarted = harness({ ...dead, level: 60, nextExp: 9_999_999 });
    startJourney(restarted, restarted.state.player);
    assert.deepEqual(restarted.state.player.firstVisitRewardMaps, []);
    assert.equal(roundTrip(restarted).gold, REWARD.gold, '새 여정의 첫 방문');
    assert.equal(roundTrip(restarted).gold, 0, '그 여정의 두 번째 방문');
});

test('계승도 새 여정 — 방문 기록은 넘어가지만 첫 방문 보상은 다시 한 번 받는다', () => {
    const veteran = basePlayer({
        level: 50, quests: [], firstVisitRewardMaps: [FOREST],
        stats: { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: [CONSTANTS.START_LOCATION, FOREST] },
        // 2026-10 Wave 89: 계승 단계마다 회차 규칙이 도전 조건 하나를 강제한다 — 1단계(길 잃은 여행)는 지역 이름을 가리고
        //   2단계(빈손의 시작)는 골드를 줄이므로, 첫 방문 규칙만 보려고 규칙이 '뒤섞인 기술'인 3단계로 계승한다.
        meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 2, endgame: { lastEndgameReceiptKey: 'rk' } },
    });
    const ascended = gameReducer(
        { ...structuredClone(INITIAL_STATE), gameState: GS.ASCENSION, player: veteran, bootStage: 'ready' },
        { type: AT.ASCEND, payload: { expectedPrestigeRank: 2, sourceReceiptKey: 'rk', seed: 3, challengeModifiers: [] } },
    );
    assert.equal(ascended.player.meta.prestigeRank, 3, '계승했다');
    assert.deepEqual(ascended.player.challengeModifiers, ['randomSkills'], '3단계 회차 규칙의 비틀기');
    assert.ok(ascended.player.stats.visitedMaps.includes(FOREST), '방문 기록(발견 지역)은 그대로 넘어간다');
    assert.deepEqual(ascended.player.firstVisitRewardMaps, []);

    const h = harness({ ...ascended.player, level: 60, nextExp: 9_999_999 });
    const first = roundTrip(h);
    assert.equal(first.gold, REWARD.gold, '계승 뒤 첫 방문 보상');
    assert.ok(first.logs.includes(REWARD.msg));
    assert.ok(!first.logs.includes(MSG.MOVE_NEW_AREA(FOREST)), '방문 기록상 처음은 아니다(발견 문구 없음)');
    assert.equal(roundTrip(h).gold, 0, '계승 뒤 두 번째 방문');
});

test('예전 세이브(목록 없음): 방문 기록에 있는 지역은 다시 주지 않고, 새 지역은 한 번 준다', () => {
    const legacy = basePlayer({
        stats: { ...structuredClone(INITIAL_STATE.player.stats), visitedMaps: [CONSTANTS.START_LOCATION, FOREST] },
    });
    assert.equal(legacy.firstVisitRewardMaps, undefined);
    const h = harness(legacy);
    assert.equal(roundTrip(h).gold, 0, '이번 여정에 이미 받은 지역');
    const west = FIRST_VISIT_REWARDS['서쪽 평원'];
    assert.equal(move(h, '서쪽 평원').gold, west.gold, '새 지역은 받는다 — 방문 기록 갱신이 판정을 가리지 않는다');
    move(h, CONSTANTS.START_LOCATION);
    assert.equal(move(h, '서쪽 평원').gold, 0, '그리고 한 번뿐이다');
});

test('첫 방문 받은 목록은 런 범위 — 영구 상태 선별에 실리지 않는다', () => {
    const permanent = pickPermanentPlayerState(basePlayer({ firstVisitRewardMaps: [FOREST] }), structuredClone(INITIAL_STATE.player));
    assert.equal('firstVisitRewardMaps' in permanent, false);
});
