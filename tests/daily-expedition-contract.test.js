import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import MapNavigator from '../src/components/MapNavigator.tsx';
import { BALANCE } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import { createSeededRandom } from '../src/systems/combatItemTurn.ts';
import {
    getDailyExpeditionBand,
    getDailyExpeditionBandFloor,
    getDailyExpeditionBonusPct,
    getDailyExpeditionCandidates,
    getDailyExpeditionPool,
    getDailyExpeditionRegion,
    getDailyExpeditionRewardMult,
} from '../src/utils/dailyExpedition.ts';
import { getExitBadges } from '../src/utils/mapBadges.ts';
import { getMapRouteGate } from '../src/utils/mapRouteGate.ts';
import { getMapRequiredLevel } from '../src/utils/mapTopology.ts';
import { getProtocolDayKey } from '../src/utils/protocolCycle.ts';
import { spawnEnemy } from '../src/utils/exploreUtils.ts';
import { makePlayerFixture, renderStatic, sliceElementByTestId } from './helpers/render.ts';

/**
 * 오늘의 원정지(2026-11 E6, 소유자 결정 "날짜로 자동 선정") — 고르기 · 보상 · 화면의 계약.
 *  - 고르기: 날짜 키 × 레벨 구간의 해시. 아직 못 들어가는 지역은 고르지 않고, 구간 안 · 같은 날은 바뀌지 않으며, 게임 난수를 쓰지 않는다.
 *  - 보상: 그 지역의 처치 골드 · 경험 × `DAILY_EXPEDITION_REWARD_MULT`(엔진 한 곳), 다른 지역 · 다른 날은 그대로.
 *  - 화면: 지도의 배지 · 선택 카드 한 줄. 길 잃은 여행에서는 가려진다.
 */

const DAY = 24 * 60 * 60 * 1000;
// 지역 시각 정오 — 시간대와 상관없이 날짜 키가 하루에 하나다.
const noonOf = (year, month, day) => new Date(year, month - 1, day, 12, 0, 0).getTime();
const BASE = noonOf(2026, 11, 24);
const DAYS = Array.from({ length: 400 }, (_, index) => BASE + index * DAY);
const MAX_LEVEL = 120;

const withThrowingRandom = (fn) => {
    const real = Math.random;
    Math.random = () => { throw new Error('오늘의 원정지가 Math.random을 읽었다'); };
    try { return fn(); } finally { Math.random = real; }
};

test('E6 풀: 사냥 지역만 — 안전지대 · 계절 · 혼돈의 심연 · 걸어서 못 가는 지역 · 몬스터 없는 지역은 후보가 아니다', () => {
    const pool = getDailyExpeditionPool();
    assert.ok(pool.length >= 30, `후보 ${pool.length}곳`);
    for (const { name, gate } of pool) {
        const map = DB.MAPS[name];
        assert.notEqual(map.type, 'safe', name);
        assert.ok(!map.seasonOnly, name);
        assert.notEqual(map.level, 'infinite', name);
        assert.ok((map.monsters || []).length > 0, name);
        assert.equal(gate, getMapRouteGate(DB.MAPS, name).routeGateLevel, name);
    }
    const names = new Set(pool.map((entry) => entry.name));
    for (const excluded of ['시작의 마을', '혼돈의 심연', '고대 보물고', '봄의 정원', '서리 폭풍 유적', '황금 왕국']) {
        assert.ok(!names.has(excluded), excluded);
    }
});

test('E6 고르기: 모든 레벨 × 400일 — 언제나 하나이고, 아직 못 들어가는 지역은 고르지 않으며, 그 레벨에 맞는 창 안이다', () => {
    const pool = getDailyExpeditionPool();
    const gateOf = new Map(pool.map((entry) => [entry.name, entry.gate]));
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
        const floor = getDailyExpeditionBandFloor(getDailyExpeditionBand(level));
        assert.ok(floor <= level && level < floor + BALANCE.DAILY_EXPEDITION_BAND_LEVELS, `레벨 ${level}의 구간`);
        const candidateCount = getDailyExpeditionCandidates(getDailyExpeditionBand(level)).length;
        for (const at of DAYS) {
            const name = getDailyExpeditionRegion(level, at);
            if (candidateCount < BALANCE.DAILY_EXPEDITION_MIN_CANDIDATES) {
                assert.equal(name, null, `레벨 ${level}: 후보 ${candidateCount}곳이면 원정지가 없다`);
                continue;
            }
            assert.ok(name && gateOf.has(name), `레벨 ${level} · ${name}`);
            const gate = gateOf.get(name);
            // 걸어서 들어갈 수 있다(경로 게이트 ≤ 레벨) — 그 지역 자신의 잠금(이동 판정)도 레벨 이하다.
            assert.ok(gate <= level, `레벨 ${level}에 경로 게이트 ${gate}의 ${name}`);
            assert.ok(getMapRequiredLevel(DB.MAPS[name], level) <= level, `레벨 ${level}에 ${name} 잠금`);
            // 그 레벨에 맞는 곳 — 구간 첫 레벨이 들어갈 수 있는 가장 높은 경로 게이트에서 창 안.
            const best = Math.max(...pool.filter((entry) => entry.gate <= floor).map((entry) => entry.gate));
            assert.ok(gate >= best - BALANCE.DAILY_EXPEDITION_GATE_WINDOW, `레벨 ${level}: ${name} ${gate} (최고 ${best})`);
            assert.ok(getDailyExpeditionCandidates(getDailyExpeditionBand(level)).some((entry) => entry.name === name));
        }
    }
});

test('E6 안정: 같은 날 · 같은 구간은 시각 · 레벨과 상관없이 같은 지역이고, 같은 입력은 같은 결과다', () => {
    for (const at of DAYS.slice(0, 60)) {
        const dayStart = new Date(at); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(at); dayEnd.setHours(23, 59, 59, 999);
        assert.equal(getProtocolDayKey(dayStart), getProtocolDayKey(dayEnd));
        for (let band = 0; band * BALANCE.DAILY_EXPEDITION_BAND_LEVELS < MAX_LEVEL; band += 1) {
            const floor = getDailyExpeditionBandFloor(band);
            const expected = getDailyExpeditionRegion(floor, dayStart);
            for (let level = floor; level < floor + BALANCE.DAILY_EXPEDITION_BAND_LEVELS; level += 1) {
                assert.equal(getDailyExpeditionRegion(level, dayStart), expected);
                assert.equal(getDailyExpeditionRegion(level, dayEnd), expected);
                assert.equal(getDailyExpeditionRegion(level, new Date(at)), expected);
            }
        }
    }
});

test('E6 난수: 고르기 · 배율은 Math.random을 읽지 않는다', () => {
    withThrowingRandom(() => {
        for (const at of DAYS.slice(0, 30)) {
            for (let level = 6; level <= MAX_LEVEL; level += 7) {
                const name = getDailyExpeditionRegion(level, at);
                assert.equal(getDailyExpeditionRewardMult({ level, loc: name }, at), BALANCE.DAILY_EXPEDITION_REWARD_MULT);
            }
        }
    });
});

test('E6 다양성: 후보가 둘 이상인 구간은 날마다 지역이 바뀐다(60일에 둘 이상)', () => {
    let bandsWithChoice = 0;
    for (let band = 0; band * BALANCE.DAILY_EXPEDITION_BAND_LEVELS < MAX_LEVEL; band += 1) {
        const candidates = getDailyExpeditionCandidates(band);
        if (candidates.length < 2) continue;
        bandsWithChoice += 1;
        const seen = new Set(DAYS.slice(0, 60).map((at) => getDailyExpeditionRegion(getDailyExpeditionBandFloor(band), at)));
        assert.ok(seen.size >= 2, `구간 ${band}: ${[...seen].join(', ')}`);
    }
    assert.ok(bandsWithChoice >= 15, `후보가 둘 이상인 구간 ${bandsWithChoice}개`);
});

test('E6 배율: 오늘의 원정지에서만 BALANCE 배율, 다른 지역 · 위치 없음은 1', () => {
    const level = 36;
    const featured = getDailyExpeditionRegion(level, BASE);
    assert.equal(getDailyExpeditionRewardMult({ level, loc: featured }, BASE), BALANCE.DAILY_EXPEDITION_REWARD_MULT);
    const other = getDailyExpeditionCandidates(getDailyExpeditionBand(level)).find((entry) => entry.name !== featured).name;
    assert.equal(getDailyExpeditionRewardMult({ level, loc: other }, BASE), 1);
    assert.equal(getDailyExpeditionRewardMult({ level, loc: '' }, BASE), 1);
    assert.equal(getDailyExpeditionRewardMult(null, BASE), 1);
    assert.ok(BALANCE.DAILY_EXPEDITION_REWARD_MULT > 1 && BALANCE.DAILY_EXPEDITION_REWARD_MULT <= 1.5, '작은 배율');
});

test('E6 엔진: handleVictory가 처치 골드 · 경험에 그 배율을 곱한다(없으면 그대로)', () => {
    const player = makePlayerFixture({ level: 20, gold: 0, exp: 0, nextExp: 1_000_000, loc: '몰락한 전초기지' });
    const enemy = { name: '훈련 인형', baseName: '훈련 인형', level: 20, hp: 0, maxHp: 100, atk: 1, def: 0, exp: 500, gold: 1000 };
    const base = CombatEngine.handleVictory(player, enemy, {}, {});
    const boosted = CombatEngine.handleVictory(player, enemy, { dailyExpeditionMult: BALANCE.DAILY_EXPEDITION_REWARD_MULT }, {});
    assert.equal(base.goldGained, 1000);
    assert.equal(boosted.goldGained, Math.floor(1000 * BALANCE.DAILY_EXPEDITION_REWARD_MULT));
    assert.ok(boosted.expGained > base.expGained, `${base.expGained} → ${boosted.expGained}`);
    assert.equal(CombatEngine.handleVictory(player, enemy, { dailyExpeditionMult: 1 }, {}).goldGained, base.goldGained);
});

/** 실제 전투 전이(RESOLVE_COMBAT_ACTION)로 처치했을 때의 골드 증가 — 날짜(now)만 바꾼다. */
const settleKillGold = (loc, now) => {
    const player = {
        ...structuredClone(INITIAL_STATE.player),
        name: '리베이아', job: '전사', level: 36, hp: 9000, maxHp: 9000, mp: 200, maxMp: 200,
        atk: 400, def: 100, gold: 0, exp: 0, nextExp: 10_000_000, loc,
    };
    const enemy = {
        ...spawnEnemy(DB.MAPS[loc], player, [], { addLog: () => {} }, { rng: createSeededRandom(7) }).mStats,
        hp: 1,
    };
    let state = structuredClone(INITIAL_STATE);
    state = gameReducer(state, { type: AT.SET_PLAYER, payload: player });
    state = gameReducer(state, { type: AT.SET_ENEMY, payload: enemy });
    state = gameReducer(state, { type: AT.SET_GAME_STATE, payload: GS.COMBAT });
    const next = withThrowingRandom(() => gameReducer(state, {
        type: AT.RESOLVE_COMBAT_ACTION,
        payload: { kind: 'attack', expectedTurn: state.combatTurn ?? 0, seed: 4242, now },
    }));
    assert.notEqual(next.gameState, GS.COMBAT, '한 번에 처치');
    return next.player.stats.total_gold - (player.stats?.total_gold || 0);
};

test('E6 전이: 같은 지역 · 같은 적 · 같은 씨앗에서 그 지역이 오늘의 원정지인 날만 처치 골드가 배율만큼 많다', () => {
    const level = 36;
    const featured = getDailyExpeditionRegion(level, BASE);
    const otherDay = DAYS.find((at) => getDailyExpeditionRegion(level, at) !== featured);
    assert.ok(otherDay, '다른 지역이 뽑힌 날');
    const plain = settleKillGold(featured, otherDay);
    const boosted = settleKillGold(featured, BASE);
    assert.ok(plain > 0);
    const expected = Math.floor(plain * BALANCE.DAILY_EXPEDITION_REWARD_MULT);
    assert.ok(Math.abs(boosted - expected) <= 1, `${plain} → ${boosted} (기대 ${expected})`);
});

const renderMap = (player, now) => renderStatic(createElement(MapNavigator, {
    player, grave: [], stats: { maxHp: 150, maxMp: 50 }, actions: {}, now,
}));

test('E6 화면: 지도 행 · 선택 카드에 배지, 선택 카드에 한 줄 — 다른 지역에는 없다', () => {
    const level = 36;
    const featured = getDailyExpeditionRegion(level, BASE);
    const label = MSG.MAP_BADGE_DAILY_EXPEDITION(getDailyExpeditionBonusPct());
    const note = MSG.MAP_DAILY_EXPEDITION_NOTE(getDailyExpeditionBonusPct(), BALANCE.DAILY_EXPEDITION_BAND_LEVELS);
    assert.equal(label, '오늘의 원정지 +20%');

    const html = renderMap(makePlayerFixture({ level, loc: featured }), BASE);
    assert.equal(html.split(label).length - 1, 2, '전체 경로 행 하나 + 선택 카드 하나');
    const detail = sliceElementByTestId(html, 'map-selected-detail');
    assert.ok(detail.includes(label));
    assert.ok(detail.includes(note));
    assert.ok(detail.includes('data-signal-tone="spotlight"'));

    const other = getDailyExpeditionCandidates(getDailyExpeditionBand(level)).find((entry) => entry.name !== featured).name;
    const otherHtml = renderMap(makePlayerFixture({ level, loc: other }), BASE);
    assert.equal(otherHtml.split(label).length - 1, 1, '전체 경로 목록의 그 지역 행에만');
    assert.ok(!otherHtml.includes('data-testid="map-daily-expedition-note"'));

    // 첫 구간(Lv1 ~ 5)은 후보가 고요한 숲 하나라 원정지가 없다 — 상시 보너스가 되지 않는다.
    for (let level1 = 1; level1 <= BALANCE.DAILY_EXPEDITION_BAND_LEVELS; level1 += 1) {
        assert.equal(getDailyExpeditionRegion(level1, BASE), null);
        assert.equal(getDailyExpeditionRewardMult({ level: level1, loc: '고요한 숲' }, BASE), 1);
    }
    const lowHtml = renderMap(makePlayerFixture({ level: 1, loc: '시작의 마을' }), BASE);
    assert.ok(!lowHtml.includes(label));
    // Lv6부터는 언제나 하나다.
    assert.ok(getDailyExpeditionRegion(6, BASE));
});

test('E6 화면: 길 잃은 여행에서는 지도 정보와 함께 가려진다', () => {
    const level = 36;
    const featured = getDailyExpeditionRegion(level, BASE);
    const html = renderMap(makePlayerFixture({ level, loc: featured, challengeModifiers: ['blindMap'] }), BASE);
    assert.ok(!html.includes(MSG.MAP_BADGE_DAILY_EXPEDITION(getDailyExpeditionBonusPct())));
    assert.ok(!html.includes('data-testid="map-daily-expedition-note"'));
});

test('E6 배지 함수: 원정지를 넘기지 않으면 이전과 같은 배지다', () => {
    const featured = getDailyExpeditionRegion(36, BASE);
    const player = makePlayerFixture({ level: 36 });
    const without = getExitBadges(DB.MAPS[featured], player, featured);
    const withRegion = getExitBadges(DB.MAPS[featured], player, featured, featured);
    assert.ok(!without.some((badge) => badge.id === 'dailyExpedition'));
    assert.deepEqual(withRegion.slice(1), without);
    assert.equal(withRegion[0].id, 'dailyExpedition');
    assert.deepEqual(getExitBadges(DB.MAPS[featured], player, featured, '고요한 숲'), without);
});
