import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { DB } from '../src/data/db.js';
import { MAPS } from '../src/data/maps.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { GS } from '../src/reducers/gameStates.js';
import { calculateFullStats } from '../src/utils/statsCalculator.js';
import { getCycleSummary, getCycleSummaryLines } from '../src/utils/cycleSummary.js';
import {
    getEliteTitleGuide,
    getEliteTitleGuideLines,
    getMissingEliteTitleMaps,
    getNextCycleEliteRouteLine,
    getNextCycleEliteTitleRoute,
    isEliteTitleTargetNow,
} from '../src/utils/eliteTitleGuide.js';
import { ELITE_TITLE_MAPS, getEliteTitleId } from '../src/utils/eliteTitles.js';
import { spawnEnemy } from '../src/utils/exploreUtils.js';
import { getExitBadges } from '../src/utils/mapBadges.js';
import { getMapRouteGate, MAP_ROUTE_START_LOCATION, nonWalkingEntryOf, walkableMapsAt } from '../src/utils/mapRouteGate.js';
import { findMapPath } from '../src/utils/mapTopology.js';
import { createSeededRandom } from '../src/utils/seededRandom.js';
import SystemTab from '../src/components/tabs/SystemTab.tsx';
import { renderStatic } from './helpers/render.ts';

/**
 * Wave 101 (원장 §105.4 b — 소유자 결정 "b로 진행"): 정예 칭호(Wave 72, 47곳)는 자연 플레이에서 진행 경로 위의 19곳 근처에서 멈췄다.
 * 안내는 아직 칭호가 없는 지역을 "갈 곳"으로 바꾼다 — 지도 배지(지금 걸어 들어갈 수 있는 곳만) · 칭호 목록 안내 줄(가까운 순) ·
 * 계승 화면 요약(다음 회차에 들를 곳, 진입 레벨 순). 진입 레벨은 실제 이동 규칙의 경로 게이트, 거리는 지도 안내의 `findMapPath`다.
 */

const SPECIAL = ['고대 보물고', '봄의 정원', '서리 폭풍 유적'];
const playerAt = (level, loc = MAP_ROUTE_START_LOCATION, titles = []) => ({
    ...structuredClone(INITIAL_STATE.player), name: '수집가', job: '전사', level, loc, titles,
});

test('Wave 101: 정예 칭호 47곳 모두 실제 스폰에서 정예가 나온다 — 나올 수 없는 칭호를 안내하지 않는다', () => {
    for (const map of ELITE_TITLE_MAPS) {
        const gate = getMapRouteGate(MAPS, map)?.routeGateLevel ?? 60;
        const player = playerAt(gate, map);
        const rng = createSeededRandom(map.length * 7919);
        let elite = false;
        for (let i = 0; i < 400 && !elite; i += 1) {
            elite = Boolean(spawnEnemy(DB.MAPS[map], player, [], { addLog: () => {} }, { rng }).mStats?.isElite);
        }
        assert.ok(elite, `${map}: 진입 레벨 ${gate}에서 정예가 400번 안에 나온다`);
    }
});

test('Wave 101: 분류는 실제 이동 규칙과 같다 — 지금 갈 수 있는 곳 · 레벨이 모자란 곳 · 계절 · 열쇠 지역', () => {
    for (const level of [1, 6, 15, 28, 40, 60]) {
        const guide = getEliteTitleGuide(playerAt(level));
        const walkable = new Set(walkableMapsAt(MAP_ROUTE_START_LOCATION, MAPS, level));
        assert.equal(guide.reachable.length + guide.upcoming.length + guide.special.length, ELITE_TITLE_MAPS.length);
        for (const entry of guide.reachable) assert.ok(walkable.has(entry.map), `Lv${level} ${entry.map}은 걸어서 들어간다`);
        for (const entry of guide.upcoming) assert.ok(!walkable.has(entry.map) && entry.gateLevel > level, `Lv${level} ${entry.map}은 아직`);
        assert.deepEqual(guide.special.map((entry) => entry.map).sort(), [...SPECIAL].sort());
        for (const entry of guide.special) assert.equal(entry.entry, nonWalkingEntryOf(entry.map, MAPS[entry.map]));
        for (let i = 1; i < guide.upcoming.length; i += 1) assert.ok(guide.upcoming[i - 1].gateLevel <= guide.upcoming[i].gateLevel, '진입 레벨 순');
    }
});

test('Wave 101: 지금 갈 수 있는 곳은 가까운 순이고 거리는 지도 안내의 경로다', () => {
    const loc = '수정 동굴';
    const guide = getEliteTitleGuide(playerAt(30, loc));
    assert.ok(guide.reachable.length > 3);
    for (const entry of guide.reachable) assert.equal(entry.steps, findMapPath(MAPS, loc, entry.map).length - 1, entry.map);
    for (let i = 1; i < guide.reachable.length; i += 1) assert.ok(guide.reachable[i - 1].steps <= guide.reachable[i].steps, '가까운 순');
    assert.equal(guide.reachable[0].steps, 0, '지금 있는 지역이 맨 앞');
});

test('Wave 101: 지도 배지는 칭호가 없고 지금 걸어 들어갈 수 있는 지역에만 붙고, 정예를 만나면(실제 SET_ENEMY) 사라진다', () => {
    const level = 12;
    const player = playerAt(level);
    for (const map of ELITE_TITLE_MAPS) {
        const has = getExitBadges(MAPS[map], player, map).some((badge) => badge.id === 'eliteTitle');
        assert.equal(has, isEliteTitleTargetNow(player, map), map);
    }
    const tagged = ELITE_TITLE_MAPS.filter((map) => isEliteTitleTargetNow(player, map));
    assert.deepEqual(new Set(tagged), new Set(getEliteTitleGuide(player).reachable.map((entry) => entry.map)));
    assert.ok(tagged.length < ELITE_TITLE_MAPS.length / 2, 'Lv12에서 47곳 전부에 붙지 않는다');
    assert.equal(getExitBadges(MAPS['마왕성'], player, '마왕성').some((badge) => badge.id === 'eliteTitle'), false, '아직 못 들어가는 곳');

    const target = tagged[0];
    let state = { ...structuredClone(INITIAL_STATE), gameState: GS.IDLE, bootStage: 'ready', player: { ...player, loc: target } };
    state = gameReducer(state, { type: AT.SET_ENEMY, payload: { name: '정예 표적', baseName: '표적', isElite: true, hp: 1, maxHp: 1, atk: 1, def: 0, exp: 1, gold: 1 } });
    assert.ok(state.player.titles.includes(getEliteTitleId(target)));
    assert.equal(getExitBadges(MAPS[target], state.player, target).some((badge) => badge.id === 'eliteTitle'), false);
    assert.ok(!getMissingEliteTitleMaps(state.player.titles).includes(target));
});

test('Wave 101: 칭호 목록 안내 줄 — 가까운 곳 · 레벨 · 계절 · 열쇠 · 다 모으면 완료', () => {
    const player = playerAt(5, '시작의 마을', ['veteran']);
    const guide = getEliteTitleGuide(player);
    const lines = getEliteTitleGuideLines(player);
    const near = guide.reachable.map((entry) => (entry.steps > 0 ? MSG.ELITE_GUIDE_STEP(entry.map, entry.steps) : entry.map));
    const nearList = near.length > 3 ? MSG.ELITE_GUIDE_MORE(near.slice(0, 3).join(' · '), near.length - 3) : near.join(' · ');
    assert.equal(lines[0], MSG.ELITE_GUIDE_NEAR(guide.reachable.length, nearList));
    assert.ok(lines.some((line) => line.startsWith(MSG.ELITE_GUIDE_NEXT('').trim())));
    assert.ok(lines.some((line) => line.startsWith(MSG.ELITE_GUIDE_SPECIAL('').trim())));
    assert.equal(lines.at(-1), MSG.ELITE_GUIDE_HINT);
    assert.deepEqual(getEliteTitleGuideLines(playerAt(5, '시작의 마을', ELITE_TITLE_MAPS.map(getEliteTitleId))), [MSG.ELITE_GUIDE_DONE]);

    const html = renderStatic(createElement(SystemTab, {
        player,
        stats: calculateFullStats(player),
        actions: { leaderboard: [], isAdmin: () => false },
        runtime: { viewport: 'mobile', gameState: 'idle', syncStatus: 'synced', isAiThinking: false },
    }));
    assert.ok(html.includes('data-testid="system-elite-titles"'), '정예 칭호가 하나도 없어도 묶음이 보인다');
    assert.ok(html.includes('data-testid="system-elite-titles-guide"'));
    for (const line of lines) assert.ok(html.includes(line), line);
});

test('Wave 101: 계승 화면 요약은 다음 회차에 들를 곳을 진입 레벨 순으로 보이고, 걸어서 갈 곳이 남지 않으면 줄이 없다', () => {
    const route = getNextCycleEliteTitleRoute([]);
    for (let i = 1; i < route.length; i += 1) assert.ok(route[i - 1].gateLevel <= route[i].gateLevel);
    assert.equal(route.length, ELITE_TITLE_MAPS.length - SPECIAL.length, '계절 · 열쇠 지역은 다음 회차 경로에 넣지 않는다');
    const shown = route.slice(0, 3).map((entry) => MSG.ELITE_GUIDE_LEVEL(entry.map, entry.gateLevel)).join(' · ');
    assert.equal(getNextCycleEliteRouteLine([]), MSG.CYCLE_SUMMARY_ELITE_ROUTE(MSG.ELITE_GUIDE_MORE(shown, route.length - 3)));

    const walkingOwned = ELITE_TITLE_MAPS.filter((map) => !SPECIAL.includes(map)).map(getEliteTitleId);
    assert.equal(getNextCycleEliteRouteLine(walkingOwned), null);
    const veteran = { ...playerAt(50, '마왕성', walkingOwned), meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 2 } };
    assert.ok(!getCycleSummaryLines(getCycleSummary(veteran)).some((line) => line.id === 'elite-route'));
    const fresh = { ...playerAt(50, '마왕성'), meta: { ...structuredClone(INITIAL_STATE.player.meta), prestigeRank: 2 } };
    assert.equal(getCycleSummaryLines(getCycleSummary(fresh)).find((line) => line.id === 'elite-route').text, getNextCycleEliteRouteLine([]));
});
