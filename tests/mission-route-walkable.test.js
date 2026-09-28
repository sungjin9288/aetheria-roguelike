import test from 'node:test';
import assert from 'node:assert/strict';

import { MAPS } from '../src/data/maps.ts';
import { findMapPath, getNextMapTowardTarget } from '../src/utils/mapTopology.ts';
import { getMapAccess, getReachableMaps } from '../src/utils/mapAccess.ts';

/**
 * 임무 경로 안내는 걸을 수 있는 길을 가리켜야 한다 (Wave 27, 자연 플레이 감사 부수 발견).
 *
 * `findMapPath`는 출구만 보는 BFS였다 — 같은 길이의 두 길 중 출구 순서가 먼저인 쪽을 골랐다.
 * 스토리 84(기계 폐도)를 든 채 암흑 성에 서면 안내가 지하 미궁(Lv44)을 가리켰다. 걸을 수 있는
 * 길은 저주받은 묘지(Lv34) 쪽이다. 지도(MapNavigator)·조작판(ControlPanel)·모험 가이드
 * (adventureGuide) 셋이 이 함수로 "다음 이동"을 표시한다.
 *
 * 오라클은 안내 함수가 아니라 실제 이동 규칙이다: `getReachableMaps`(moveActions와 같은
 * `getMapAccess`, 시즌 없음 = 기본 설정)로 목적지에 처음 걸어서 닿는 레벨 L*를 구하고,
 * 안내 경로의 모든 걸음이 그 레벨에서 `getMapAccess` 통과인지 본다.
 */

const MAP_NAMES = Object.keys(MAPS);
const LEVEL_CEILING = 120;

const firstWalkableLevel = (start, target) => {
    for (let level = 1; level <= LEVEL_CEILING; level += 1) {
        if (getReachableMaps(MAPS, start, level).has(target)) return level;
    }
    return null;
};

const firstBlockedStep = (route, level) => {
    for (let index = 1; index < route.length; index += 1) {
        const access = getMapAccess(MAPS, route[index - 1], route[index], level);
        if (access.reason !== null) return { from: route[index - 1], to: route[index], reason: access.reason, requiredLevel: access.requiredLevel };
    }
    return null;
};

test('실제 데이터 전수 — 안내 경로는 목적지에 처음 걸어서 닿는 레벨에서 전부 걸을 수 있다', () => {
    const violations = [];
    let checked = 0;
    for (const start of MAP_NAMES) {
        for (const target of MAP_NAMES) {
            if (start === target) continue;
            const level = firstWalkableLevel(start, target);
            if (level === null) continue;
            checked += 1;
            const route = findMapPath(MAPS, start, target);
            const blocked = route.length ? firstBlockedStep(route, level) : { reason: 'no-route' };
            if (blocked) violations.push(`${start}→${target} @Lv${level}: ${route.join('>')} 막힘 ${JSON.stringify(blocked)}`);
        }
    }
    assert.ok(checked > 1_500, `걸어서 닿는 쌍이 충분해야 함 (실측 ${checked})`);
    assert.deepEqual(violations, [], `걸을 수 없는 길을 안내한 쌍 ${violations.length}개: ${violations.slice(0, 6).join(' | ')}`);
});

test('스토리 84 재현 — 암흑 성에서 기계 폐도로 가는 다음 걸음은 저주받은 묘지다', () => {
    assert.equal(getNextMapTowardTarget(MAPS, '암흑 성', '기계 폐도'), '저주받은 묘지');
    const route = findMapPath(MAPS, '암흑 성', '기계 폐도');
    assert.equal(firstBlockedStep(route, 35), null, `Lv35에 걸을 수 있어야 함: ${route.join('>')}`);
});

test('계절 전용 지역은 목적지가 아닌 한 경유지로 안내하지 않는다 — 병목이 더 낮아 보여도', () => {
    // 실제 데이터에는 계절 지역으로 들어가는 출구가 하나도 없다(봄의 정원·서리 폭풍 유적은 시즌 중
    // 어디서나 진입) — 그래서 실제 지도로 쓴 이 행은 구조적으로 공허했다(결함 주입 (b)가 못 잡았다).
    // 계절 경유지가 병목을 낮추는 합성 지도로 판별한다.
    const seasonalDetour = {
        A: { level: 1, exits: ['S', 'H'] },
        S: { level: 1, seasonOnly: true, exits: ['T'] },
        H: { level: 30, exits: ['T'] },
        T: { level: 1, exits: [] },
    };
    assert.deepEqual(findMapPath(seasonalDetour, 'A', 'T'), ['A', 'H', 'T'], '계절 경유지(S)는 시즌 없는 기본 설정에서 걸을 수 없다');
    assert.deepEqual(findMapPath(seasonalDetour, 'A', 'S'), ['A', 'S'], '목적지가 계절 지역이면 그대로 안내한다');
    const inbound = MAP_NAMES.filter((name) => MAPS[name].seasonOnly)
        .flatMap((season) => MAP_NAMES.filter((name) => (MAPS[name].exits || []).includes(season)).map((name) => `${name}→${season}`));
    assert.deepEqual(inbound, [], '실제 데이터에 계절 지역으로 들어가는 출구가 생기면 위 합성 행 대신 실제 데이터 행을 다시 세울 것');
});

test('안내 경로는 여전히 최단이다 — 같은 병목 레벨이면 걸음 수를 늘리지 않는다 (비공허 가드)', () => {
    // 병목(경유지 최고 진입 레벨)이 같은 길 중 최단을 고르는지: 레벨 제약이 없는 합성 지도에서 기존 최단 결과와 같다.
    const maps = {
        A: { level: 1, exits: ['B', 'X'] },
        B: { level: 1, exits: ['C'] },
        X: { level: 1, exits: ['Y'] },
        Y: { level: 1, exits: ['C'] },
        C: { level: 1, exits: [] },
    };
    assert.deepEqual(findMapPath(maps, 'A', 'C'), ['A', 'B', 'C']);
    // 병목이 낮은 길이 한 걸음 더 길면 그 길을 고른다.
    const tiered = {
        A: { level: 1, exits: ['High', 'L1'] },
        High: { level: 40, exits: ['T'] },
        L1: { level: 5, exits: ['L2'] },
        L2: { level: 5, exits: ['T'] },
        T: { level: 10, exits: [] },
    };
    assert.deepEqual(findMapPath(tiered, 'A', 'T'), ['A', 'L1', 'L2', 'T']);
    // 걸을 수 없는 계절 경유지밖에 없으면 그 길이라도 보여 준다(시즌 중에는 실제로 걷는다).
    const seasonalOnlyRoute = {
        A: { level: 1, exits: ['S'] },
        S: { level: 1, seasonOnly: true, exits: ['T'] },
        T: { level: 1, exits: [] },
    };
    assert.deepEqual(findMapPath(seasonalOnlyRoute, 'A', 'T'), ['A', 'S', 'T']);
});
