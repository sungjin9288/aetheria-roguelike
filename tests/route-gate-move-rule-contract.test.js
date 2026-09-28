/**
 * route-gate-move-rule-contract.test.js — Wave 27 N3: "언제 실제로 거기 갈 수 있는가"의 authority는
 * **실제 이동 규칙**과 같은 답을 내야 한다.
 *
 * 경로 게이트(`utils/mapRouteGate.ts`)는 UI(MapNavigator의 "실제 진입 레벨")와 증빙 리포트
 * (`content-reachability.json`)가 함께 읽는 값이다. 그런데 그 보행은 시즌 한정 지역을 "출구 하나만
 * 닿으면 들어갈 수 있다"로 재투입하고 있었고, 실제 이동 규칙 `getMapAccess`(moveActions가 부르는 바로
 * 그 함수)는 시즌이 없으면 시즌 지역을 `'season'`으로 거부한다 — `liveConfig.seasonEvent`의 기본값은
 * `null`이다. 서리 폭풍 유적(시즌)이 얼음 성채로 이어지므로 authority는 북부 권역을 Lv20부터 걸었고,
 * 실제 플레이어는 암흑 성(35) → 저주받은 묘지 → 얼음 성채로만 들어간다.
 *
 * 이 파일은 두 계약을 고정한다:
 *   (1) **모든** 지역에서 authority 게이트 == `getMapAccess`로 직접 걸은 최소 레벨(기본 설정: 시즌 없음)
 *   (2) 선행 임무가 있는 임무의 리포트 게이트 ≥ 선행 임무의 게이트, ≥ 그 위치의 경로 게이트
 * 대조군 보행은 authority를 import하지 않는다 — 실제 이동 규칙만으로 따로 걷는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CONSTANTS } from '../src/data/constants.ts';
import { DB } from '../src/data/db.ts';
import { buildContentReachabilityReport } from '../src/systems/contentReachability.ts';
import { getMapAccess } from '../src/utils/mapAccess.ts';
import {
    MAP_ROUTE_START_LOCATION,
    getMapRouteGate,
    mapRouteGateLevels,
} from '../src/utils/mapRouteGate.ts';

/** moveActions와 같은 판정(`getMapAccess`, 시즌 없음)으로 시작의 마을에서 걷는다. */
const walkWithMoveRule = (maps, level) => {
    const seen = new Set([MAP_ROUTE_START_LOCATION]);
    const queue = [MAP_ROUTE_START_LOCATION];
    while (queue.length > 0) {
        const current = queue.shift();
        for (const next of maps[current]?.exits || []) {
            if (seen.has(next)) continue;
            if (getMapAccess(maps, current, next, level, false).reason !== null) continue;
            seen.add(next);
            queue.push(next);
        }
    }
    return seen;
};

/** 지역마다 실제 이동 규칙으로 처음 걸어 들어가는 레벨 — 끝내 못 걸으면 null. */
const moveRuleGates = (maps) => {
    const gates = new Map();
    for (let level = 1; level <= CONSTANTS.MAX_LEVEL; level += 1) {
        for (const name of walkWithMoveRule(maps, level)) {
            if (!gates.has(name)) gates.set(name, level);
        }
    }
    return gates;
};

const REAL = moveRuleGates(DB.MAPS);

// ── (1) 지역 게이트 동치 ────────────────────────────────────────────────────

test('모든 지역에서 authority 경로 게이트 == 실제 이동 규칙(getMapAccess, 시즌 없음)의 최소 진입 레벨', () => {
    const disagreements = Object.keys(DB.MAPS)
        .map((map) => ({
            map,
            authority: getMapRouteGate(DB.MAPS, map)?.routeGateLevel ?? null,
            moveRule: REAL.get(map) ?? null,
        }))
        .filter((row) => row.authority !== row.moveRule);
    assert.deepEqual(disagreements, []);
});

test('리포트가 읽는 게이트 표(mapRouteGateLevels)도 같은 답이다 — 걸을 수 없는 지역은 표에 없다', () => {
    const table = mapRouteGateLevels(MAP_ROUTE_START_LOCATION, DB.MAPS);
    assert.deepEqual(
        Object.keys(DB.MAPS)
            .filter((map) => (table.get(map) ?? null) !== (REAL.get(map) ?? null))
            .map((map) => [map, table.get(map) ?? null, REAL.get(map) ?? null]),
        [],
    );
});

test('걸어서 못 들어가는 지역은 셋이고, 전부 이동이 아닌 다른 입구를 가진다', () => {
    const unwalkable = Object.keys(DB.MAPS).filter((map) => !REAL.has(map)).sort();
    // 시즌 지역 둘은 시즌 이벤트 중에만(getMapAccess 'season'), 고대 보물고는 잊혀진 열쇠 이벤트로만
    // 들어간다(어느 지역도 보물고로 출구가 없다).
    assert.deepEqual(unwalkable, ['고대 보물고', '봄의 정원', '서리 폭풍 유적']);
    for (const map of unwalkable) {
        const gate = getMapRouteGate(DB.MAPS, map);
        assert.equal(gate.routeGateLevel, null, `${map}: UI가 쓸 수 없는 진입 레벨을 보이면 안 된다`);
        assert.equal(gate.diverges, false);
    }
});

test('북부 권역 8곳의 실제 진입은 Lv35다 — 암흑 성(35) → 저주받은 묘지 → 얼음 성채가 유일한 걷는 길', () => {
    const northern = ['사막 오아시스', '피라미드', '얼음 성채', '북부 설원', '북부 요새', '기계 폐도', '폐기된 연구소', '저주받은 묘지'];
    for (const map of northern) {
        assert.equal(getMapRouteGate(DB.MAPS, map).routeGateLevel, 35, map);
        assert.equal(walkWithMoveRule(DB.MAPS, 34).has(map), false, `${map}: Lv34에서는 걷는 길이 없다`);
        assert.equal(walkWithMoveRule(DB.MAPS, 35).has(map), true, `${map}: Lv35에 처음 닿는다`);
    }
    // 이유: 서리 폭풍 유적(시즌)만이 얼음 성채로 향하고, 잊혀진 폐허 → 얼음 성채 출구는 없다(단방향).
    assert.equal(DB.MAPS['잊혀진 폐허'].exits.includes('얼음 성채'), false);
    assert.equal(DB.MAPS['얼음 성채'].exits.includes('잊혀진 폐허'), true);
    assert.equal(getMapAccess(DB.MAPS, '수정 동굴', '서리 폭풍 유적', 99, false).reason, 'season');
});

// ── (2) 임무 게이트: 선행 사슬과 위치의 경로 게이트 ─────────────────────────

const questGateOf = (cost) => {
    const gates = new Map();
    for (const bucket of cost.gates.quests) {
        for (const member of bucket.members) gates.set(String(member), bucket.gateLevel);
    }
    return gates;
};

test('선행 임무가 있는 임무의 리포트 게이트 ≥ 선행 임무의 게이트, ≥ 위치의 경로 게이트', () => {
    const { cost } = buildContentReachabilityReport();
    const gates = questGateOf(cost);
    const violations = [];
    for (const quest of DB.QUESTS) {
        if (quest.prerequisiteQuestId === undefined || quest.prerequisiteQuestId === null) continue;
        const gate = gates.get(String(quest.id)) ?? null;
        const prerequisiteGate = gates.get(String(quest.prerequisiteQuestId)) ?? null;
        const locationGate = quest.location ? REAL.get(quest.location) ?? null : null;
        if (gate === null || prerequisiteGate === null || gate < prerequisiteGate
            || (quest.location && (locationGate === null || gate < locationGate))) {
            violations.push({ quest: quest.id, gate, prerequisiteGate, locationGate });
        }
    }
    assert.deepEqual(violations, []);
});

test('위치가 있는 모든 임무: 리포트 게이트 ≥ 위치의 경로 게이트, 걸을 수 없는 위치는 값을 매기지 않는다', () => {
    const { cost } = buildContentReachabilityReport();
    const gates = questGateOf(cost);
    const violations = DB.QUESTS
        .filter((quest) => quest.location)
        .flatMap((quest) => {
            const gate = gates.get(String(quest.id)) ?? null;
            const locationGate = REAL.get(quest.location) ?? null;
            if (locationGate === null) return gate === null ? [] : [{ quest: quest.id, gate, locationGate }];
            return gate !== null && gate >= locationGate ? [] : [{ quest: quest.id, gate, locationGate }];
        });
    assert.deepEqual(violations, []);
});

// Wave 28(D6): 86이 에테르 관문(68)에서 마왕성(48)으로 옮겨 가고 87 minLv가 48이 되어, 사슬의 끝이 승천 지점과 같다.
//   Wave 27 N3 때는 [86, 68], [87, 68]이었다 — 선행 86이 87을 끌어올렸다.
test('스토리 사슬 80→87의 게이트: 84는 위치(기계 폐도 35)가 올리고, 85~87은 마왕성(48)에서 닫힌다', () => {
    const { cost } = buildContentReachabilityReport();
    const gates = questGateOf(cost);
    assert.deepEqual(
        [80, 81, 82, 84, 83, 85, 86, 87].map((id) => [id, gates.get(String(id))]),
        [[80, 1], [81, 5], [82, 15], [84, 35], [83, 35], [85, 48], [86, 48], [87, 48]],
    );
});
