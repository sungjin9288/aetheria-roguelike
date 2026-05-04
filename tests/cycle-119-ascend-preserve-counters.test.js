import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';

/**
 * cycle 119: Ascension 시 영구 카운터 보존 — 누락된 6종 fix.
 *
 * 발견된 회귀:
 * progressionHandlers.ASCEND가 stats를 reset할 때 다음 카운터를 preserve하지만:
 *   kills, bossKills, deaths, total_gold, relicCount, abyssFloor,
 *   demonKingSlain, bountiesCompleted, crafts, codex, codexClaimed
 *
 * 다음 카운터들은 preserve 누락되어 환생 시 0으로 초기화:
 *   - escapes        (cycle 74 — ach_escape_5/20/50)
 *   - syntheses      (cycle 82 — ach_synth_5/20/50)
 *   - maxKillStreak  (cycle 95 — ach_streak_5/10/20, "max-ever" 시맨틱 위반)
 *   - visitedMaps    (cycle 83 — ach_discover_5/10/15, cartographer 칭호)
 *   - discoveryChains (cycle 102 — ach_chain_1/3/all, chain_master 칭호)
 *   - abyssRecord    (best-ever 심연 기록)
 *
 * 영향:
 * - 환생 후 multi-run achievement 진행도 회귀.
 * - 특히 maxKillStreak는 "max-ever" 시맨틱이라 환생 후 0으로 떨어지면
 *   cycle 95 의도(휘발성 streak를 영구 보상으로 연결)가 깨짐.
 * - cartographer 칭호("지도 제작자")가 환생 후 visitedMaps=[] 상태에서
 *   첫 1곳 방문해도 차감되지 않지만, 환생 후 다시 10곳 방문해야 재해금
 *   조건 평가 — 칭호 자체는 player.titles에 보존되지만 다음 환생 후
 *   재진입 시 진행도 이어가지 않음.
 *
 * 수정:
 * progressionHandlers.ASCEND의 stats merge에 6개 키 추가 보존.
 */

const buildAscendState = (statsOverrides = {}) => ({
    ...INITIAL_STATE,
    player: {
        ...INITIAL_STATE.player,
        name: '테스트',
        gender: 'male',
        titles: ['ironman'],
        activeTitle: 'ironman',
        stats: {
            ...INITIAL_STATE.player.stats,
            kills: 200, bossKills: 5, deaths: 1, total_gold: 50000,
            relicCount: 10, abyssFloor: 30, demonKingSlain: 0,
            bountiesCompleted: 8, crafts: 25,
            ...statsOverrides,
        },
    },
});

const ascend = (state) => gameReducer(state, {
    type: AT.ASCEND,
    payload: {
        meta: { ...state.player.meta, prestigeRank: 1 },
        newTitle: 'reborn',
    },
});

test('ASCEND: escapes 보존 (cycle 74 카운터)', () => {
    const before = buildAscendState({ escapes: 12 });
    const after = ascend(before);
    assert.equal(after.player.stats.escapes, 12);
});

test('ASCEND: syntheses 보존 (cycle 82 카운터)', () => {
    const before = buildAscendState({ syntheses: 25 });
    const after = ascend(before);
    assert.equal(after.player.stats.syntheses, 25);
});

test('ASCEND: maxKillStreak 보존 (cycle 95 max-ever 시맨틱)', () => {
    const before = buildAscendState({ maxKillStreak: 22 });
    const after = ascend(before);
    assert.equal(after.player.stats.maxKillStreak, 22);
});

test('ASCEND: visitedMaps 보존 (cycle 83 cartographer 정합성)', () => {
    const before = buildAscendState({ visitedMaps: ['시작의 마을', '평원', '동굴', '사막'] });
    const after = ascend(before);
    assert.deepEqual(after.player.stats.visitedMaps.sort(), ['동굴', '사막', '시작의 마을', '평원']);
});

test('ASCEND: discoveryChains 보존 (cycle 102 ach_chain_*)', () => {
    const before = buildAscendState({ discoveryChains: ['fire_convergence', 'frozen_truth'] });
    const after = ascend(before);
    assert.deepEqual(after.player.stats.discoveryChains.sort(),
        ['fire_convergence', 'frozen_truth']);
});

test('ASCEND: abyssRecord 보존 (best-ever 심연 기록)', () => {
    const before = buildAscendState({ abyssRecord: 75 });
    const after = ascend(before);
    assert.equal(after.player.stats.abyssRecord, 75);
});

test('ASCEND: 기존 보존 카운터 회귀 보존 (kills/bossKills/deaths 등)', () => {
    const before = buildAscendState();
    const after = ascend(before);
    assert.equal(after.player.stats.kills, 200);
    assert.equal(after.player.stats.bossKills, 5);
    assert.equal(after.player.stats.deaths, 1);
    assert.equal(after.player.stats.total_gold, 50000);
    assert.equal(after.player.stats.relicCount, 10);
    assert.equal(after.player.stats.abyssFloor, 30);
    assert.equal(after.player.stats.demonKingSlain, 1, 'demon king slain ++ on ascend');
    assert.equal(after.player.stats.bountiesCompleted, 8);
    assert.equal(after.player.stats.crafts, 25);
});
