import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DB } from '../src/data/db.ts';
import { buildContentReachabilityReport } from '../src/systems/contentReachability.ts';
import { getMapAccess } from '../src/utils/mapAccess.ts';
import {
    MAP_ROUTE_ORIGIN_LEVEL,
    MAP_ROUTE_START_LOCATION,
    getMapRouteGate,
    mapGateLevel,
    mapRouteGateLevels,
    nonWalkingEntryOf,
    reachableMapsFrom,
    walkableMapsAt,
} from '../src/utils/mapRouteGate.ts';

/**
 * Wave 13 E2 — 맵의 "실제 진입 레벨"(경로 게이트) 단일 authority.
 *
 * 선언 레벨(`map.level`)은 그 지역 자신의 잠금이고 이동 권한은 계속 그것만으로 판정된다.
 * 경로 게이트는 시작의 마을에서 실제로 걸어 들어갈 수 있게 되는 최소 레벨이고,
 * 둘이 갈라지는 지역에서 카드의 숫자는 진입 레벨이 아니다(실측 52곳 중 16곳 — Wave 27 N3 전에는
 * 시즌 재투입이 북부 권역을 Lv20부터 걷게 해 10곳으로 셌다).
 * 이 파일은 그 계산이 증빙 리포트와 UI에서 **같은 함수** 하나로 나온다는 것을 고정한다.
 * 그 함수가 실제 이동 규칙(`getMapAccess`, 시즌 없음)과 같은 답을 낸다는 동치 계약은
 * `route-gate-move-rule-contract.test.js`가 지역 전수로 고정한다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

/**
 * 합성 그래프: 골짜기는 선언 5지만 유일한 진입로가 레벨 10 지역(숲)을 지나고,
 * 숨은 심연은 `'infinite'`이라 자기 잠금이 아예 없는데도 같은 길에 묶여 있다
 * (프로덕션의 '혼돈의 심연'과 같은 모양).
 */
const GRAPH = Object.freeze({
    마을: { level: 1, type: 'safe', exits: ['숲'] },
    숲: { level: 10, exits: ['마을', '골짜기'] },
    골짜기: { level: 5, exits: ['숲', '숨은 심연'] },
    '숨은 심연': { level: 'infinite', exits: ['골짜기'] },
});

const divergencesFrom = (maps) => Object.keys(maps)
    .map((name) => ({ name, gate: getMapRouteGate(maps, name) }))
    .filter(({ gate }) => gate?.diverges)
    .map(({ name, gate }) => ({
        map: name,
        declaredLevel: Array.isArray(gate.declaredLevel) ? Number(gate.declaredLevel[0]) : gate.declaredLevel,
        routeGateLevel: gate.routeGateLevel,
    }))
    .sort((left, right) => (left.map < right.map ? -1 : left.map > right.map ? 1 : 0));

// ── 선언 레벨 읽기 (`getMapAccess`와 같은 규칙) ──────────────────────────────

test('mapGateLevel: 숫자·범위·무잠금·결손을 getMapAccess와 같은 규칙으로 읽는다', () => {
    assert.equal(mapGateLevel({ level: 28 }), 28);
    assert.equal(mapGateLevel({ level: [20, 35] }), 20, '범위는 첫 값이 입장선');
    assert.equal(mapGateLevel({ level: 'infinite' }), MAP_ROUTE_ORIGIN_LEVEL,
        "'infinite'은 잠금이 아니라 잠금 없음 — level < Number('infinite')은 NaN 비교라 항상 false다");
    assert.equal(mapGateLevel({}), MAP_ROUTE_ORIGIN_LEVEL);
    assert.equal(mapGateLevel(undefined), MAP_ROUTE_ORIGIN_LEVEL);
});

// ── 실제 이동 규칙으로 걷기 (Wave 27 N3: 레벨 상한 보행은 walkableMapsAt이 소유한다) ──────────

test('walkableMapsAt: 레벨 아래에서는 더 높은 지역 너머가 통째로 막힌다', () => {
    assert.deepEqual(walkableMapsAt('마을', GRAPH, 9), ['마을'],
        '숲(10)이 막히면 그 뒤의 골짜기(5)도 못 걷는다');
    assert.deepEqual(walkableMapsAt('마을', GRAPH, 10), ['골짜기', '마을', '숨은 심연', '숲']);
});

test('walkableMapsAt: 시즌 지역은 시즌 없이 들어갈 수도, 거쳐 갈 수도 없다 (getMapAccess의 season 거부)', () => {
    // 프로덕션의 서리 폭풍 유적 → 얼음 성채와 같은 모양: 시즌 지역만이 성채로 향한다.
    const seasonalBridge = {
        마을: { level: 1, exits: ['숲'] },
        숲: { level: 1, exits: ['마을'] },
        '시즌 유적': { level: [5, 9], seasonOnly: true, exits: ['숲', '성채'] },
        성채: { level: 5, exits: ['숲'] },
    };
    assert.deepEqual(walkableMapsAt('마을', seasonalBridge, 99), ['마을', '숲']);
    assert.equal(getMapAccess(seasonalBridge, '숲', '시즌 유적', 99).reason, 'season');
    const gates = mapRouteGateLevels('마을', seasonalBridge);
    assert.equal(gates.has('시즌 유적'), false, '시즌 지역은 걷는 게이트가 없다');
    assert.equal(gates.has('성채'), false, '시즌 지역 너머만으로 이어진 지역도 걷는 게이트가 없다');
    // 위상(어떤 입구로든 한 번은)으로는 둘 다 닿는다 — 이것은 게이트가 아니다.
    assert.deepEqual(reachableMapsFrom('마을', seasonalBridge), ['마을', '성채', '숲', '시즌 유적']);
});

test('walkableMapsAt: 문자열 아닌 출구·없는 지역 출구는 걷지 않는다', () => {
    const maps = { 마을: { level: 1, exits: ['숲', 7, '유령 지역', 'toString'] }, 숲: { level: 1, exits: [] } };
    assert.deepEqual(walkableMapsAt('마을', maps, 99), ['마을', '숲']);
    assert.deepEqual(walkableMapsAt('없는 마을', maps, 99), []);
});

test('nonWalkingEntryOf: 걸어서 못 들어가는 지역의 입구 종류', () => {
    assert.equal(nonWalkingEntryOf('서리 폭풍 유적', DB.MAPS['서리 폭풍 유적']), 'season');
    assert.equal(nonWalkingEntryOf('봄의 정원', DB.MAPS['봄의 정원']), 'season');
    assert.equal(nonWalkingEntryOf('고대 보물고', DB.MAPS['고대 보물고']), 'vault-key');
    assert.equal(nonWalkingEntryOf('얼음 성채', DB.MAPS['얼음 성채']), null);
});

test('reachableMapsFrom: 레벨 게이트 없이 위상만 센다', () => {
    assert.deepEqual(reachableMapsFrom('마을', GRAPH), ['골짜기', '마을', '숨은 심연', '숲']);
});

test('reachableMapsFrom: 없는 시작점/없는 출구는 빈 결과이고 멈춘다', () => {
    assert.deepEqual(reachableMapsFrom('없는 마을', GRAPH), []);
    assert.deepEqual(reachableMapsFrom('마을', { 마을: { level: 1, exits: ['유령 지역'] } }), ['마을']);
});

test('reachableMapsFrom: seasonOnly 재투입 루프에서도 종료한다 (visited 표시)', () => {
    const seasonal = {
        마을: { level: 1, exits: ['숲'] },
        숲: { level: 1, exits: ['마을'] },
        '봄의 정원': { level: 1, seasonOnly: true, exits: ['숲', '마을'] },
    };
    assert.deepEqual(reachableMapsFrom('마을', seasonal), ['마을', '봄의 정원', '숲']);
});

// ── 경로 게이트 표 ──────────────────────────────────────────────────────────

test('mapRouteGateLevels: 각 지역이 실제로 열리는 최소 레벨을 준다', () => {
    const gates = mapRouteGateLevels('마을', GRAPH);
    assert.equal(gates.get('마을'), 1);
    assert.equal(gates.get('숲'), 10);
    assert.equal(gates.get('골짜기'), 10, '선언 5 — 유일한 길이 레벨 10 지역을 지난다');
    assert.equal(gates.get('숨은 심연'), 10, "선언 'infinite'(잠금 없음) — 진입선은 순전히 경로가 만든다");
    assert.equal(gates.size, Object.keys(GRAPH).length);
});

test('mapRouteGateLevels: 도달 불가 지역은 표에 아예 없다', () => {
    const gates = mapRouteGateLevels('마을', { ...GRAPH, 외딴섬: { level: 1, exits: [] } });
    assert.equal(gates.has('외딴섬'), false);
});

// ── UI가 읽는 표면 ──────────────────────────────────────────────────────────

test('getMapRouteGate: 선언과 경로가 갈라지는 지역을 diverges로 표시한다', () => {
    const valley = getMapRouteGate(GRAPH, '골짜기', '마을');
    assert.deepEqual(valley, {
        declaredLevel: 5,
        declaredGateLevel: 5,
        routeGateLevel: 10,
        declaredIsLocked: true,
        diverges: true,
    });
});

test('getMapRouteGate: 잠금 없는 지역은 declaredIsLocked=false이고 진입선은 경로가 만든다', () => {
    const abyss = getMapRouteGate(GRAPH, '숨은 심연', '마을');
    assert.equal(abyss.declaredLevel, 'infinite');
    assert.equal(abyss.declaredIsLocked, false);
    assert.equal(abyss.routeGateLevel, 10);
    assert.equal(abyss.diverges, true);
});

test('getMapRouteGate: 선언과 경로가 같으면 diverges=false (33곳의 정상 경우)', () => {
    const forest = getMapRouteGate(GRAPH, '숲', '마을');
    assert.equal(forest.declaredGateLevel, 10);
    assert.equal(forest.routeGateLevel, 10);
    assert.equal(forest.diverges, false);
});

test('getMapRouteGate: 목록에 없는 지역은 null', () => {
    assert.equal(getMapRouteGate(GRAPH, '없는 지역', '마을'), null);
});

test('getMapRouteGate: 도달 불가 지역은 routeGateLevel이 null이고 diverges를 주장하지 않는다', () => {
    const gate = getMapRouteGate({ ...GRAPH, 외딴섬: { level: 3, exits: [] } }, '외딴섬', '마을');
    assert.equal(gate.routeGateLevel, null);
    assert.equal(gate.diverges, false, '모르는 것을 거짓말로 바꾸지 않는다');
});

test('getMapRouteGate: 순수 — 같은 입력에 같은 결과이고 MAPS를 건드리지 않는다', () => {
    const before = JSON.stringify(GRAPH);
    const first = getMapRouteGate(GRAPH, '골짜기', '마을');
    const second = getMapRouteGate(GRAPH, '골짜기', '마을');
    assert.deepEqual(first, second);
    assert.equal(JSON.stringify(GRAPH), before);
});

test('getMapRouteGate: 시작점 기본값은 시작의 마을이다', () => {
    assert.equal(MAP_ROUTE_START_LOCATION, '시작의 마을');
    assert.deepEqual(
        getMapRouteGate(DB.MAPS, '공중 신전'),
        getMapRouteGate(DB.MAPS, '공중 신전', MAP_ROUTE_START_LOCATION),
    );
});

// ── 프로덕션 데이터: 리포트와 UI가 같은 authority를 읽는다 ──────────────────

// 2026-09 Wave 27 N3: 10 → 16행. 보행이 실제 이동 규칙(시즌 없음)이 되자 북부 권역 8곳이 전부 Lv35다 —
//   걷는 길은 암흑 성(35) → 저주받은 묘지 → 얼음 성채 하나뿐이다(잊혀진 폐허 → 얼음 성채 출구는 없고,
//   얼음 성채로 향하는 다른 출구는 시즌 지역 서리 폭풍 유적뿐). 새로 갈라진 6곳(사막 오아시스 23 ·
//   얼음 성채 20 · 북부 설원 22 · 북부 요새 32 · 폐기된 연구소 32 · 저주받은 묘지 34)이 더해지고,
//   이미 갈라져 있던 둘의 값이 움직인다(기계 폐도 32 → 35 · 피라미드 23 → 35).
test('프로덕션 MAPS 52곳 중 선언과 경로가 갈라지는 곳은 16곳이고 값이 실측과 같다', () => {
    assert.deepEqual(divergencesFrom(DB.MAPS), [
        { map: '공중 신전', declaredLevel: 48, routeGateLevel: 52 },
        { map: '금지된 도서관', declaredLevel: 55, routeGateLevel: 62 },
        { map: '기계 폐도', declaredLevel: 28, routeGateLevel: 35 },
        { map: '북부 설원', declaredLevel: 22, routeGateLevel: 35 },
        { map: '북부 요새', declaredLevel: 32, routeGateLevel: 35 },
        { map: '사막 오아시스', declaredLevel: 23, routeGateLevel: 35 },
        { map: '세계수 숲', declaredLevel: 38, routeGateLevel: 40 },
        { map: '얼음 성채', declaredLevel: 20, routeGateLevel: 35 },
        { map: '에테르 폐허', declaredLevel: 65, routeGateLevel: 68 },
        { map: '저주받은 묘지', declaredLevel: 34, routeGateLevel: 35 },
        { map: '차원의 균열 전초기지', declaredLevel: 62, routeGateLevel: 68 },
        { map: '폐기된 연구소', declaredLevel: 32, routeGateLevel: 35 },
        { map: '폭풍의 고원', declaredLevel: 38, routeGateLevel: 40 },
        { map: '피라미드', declaredLevel: 20, routeGateLevel: 35 },
        { map: '혼돈의 심연', declaredLevel: 'infinite', routeGateLevel: 48 },
        { map: '황금 왕국', declaredLevel: 58, routeGateLevel: 62 },
    ]);
});

test('걷는 경로가 없는 3곳은 routeGateLevel이 null이고 갈라짐을 주장하지 않는다', () => {
    // 전에는 시즌 재투입이 봄의 정원 5 · 서리 폭풍 유적 20 · 고대 보물고 25를 "진입 레벨"로 매겼다 —
    // 시즌 없는 플레이어는 앞의 둘을 'season'으로 거부당하고, 보물고는 출구로 오는 길이 없다.
    for (const name of ['고대 보물고', '봄의 정원', '서리 폭풍 유적']) {
        const gate = getMapRouteGate(DB.MAPS, name);
        assert.equal(gate.routeGateLevel, null, name);
        assert.equal(gate.diverges, false, name);
    }
    assert.equal(Object.values(DB.MAPS).some((map) => map.exits?.includes('고대 보물고')), false);
});

test('UI가 읽는 값과 증빙 리포트의 cost.mapGateDivergence가 같은 함수에서 나온다', () => {
    const report = buildContentReachabilityReport(DB);
    assert.deepEqual(report.cost.mapGateDivergence, divergencesFrom(DB.MAPS));
});

test('증빙 JSON에 고정된 16행과도 일치한다 (리포트 재생성 없이 확인)', async () => {
    const evidence = JSON.parse(await readSrc('docs/evidence/qa/release-complete-core/content-reachability.json'));
    assert.deepEqual(evidence.report.cost.mapGateDivergence, divergencesFrom(DB.MAPS));
});

test('혼돈의 심연: 경로 진입선은 48이지만 잠금은 그대로 없다 (표시만 고쳤다)', () => {
    const gate = getMapRouteGate(DB.MAPS, '혼돈의 심연');
    assert.equal(gate.declaredLevel, 'infinite');
    assert.equal(gate.declaredIsLocked, false);
    assert.equal(gate.routeGateLevel, 48, '마왕성(48)을 지나야만 닿는다');

    // 권한은 이 wave가 건드리지 않는다 — 레벨 1이어도 level 사유로 막히지 않는다.
    const access = getMapAccess(DB.MAPS, '마왕성', '혼돈의 심연', 1);
    assert.notEqual(access.reason, 'level');
    assert.equal(access.reason, null);
});

test('진입선이 선언보다 높은 지역은 선언 레벨에서 실제로 못 걸어 들어간다', () => {
    for (const row of divergencesFrom(DB.MAPS)) {
        const declared = typeof row.declaredLevel === 'number' ? row.declaredLevel : MAP_ROUTE_ORIGIN_LEVEL;
        assert.ok(
            !walkableMapsAt(MAP_ROUTE_START_LOCATION, DB.MAPS, declared).includes(row.map),
            `${row.map}: 선언 레벨 ${declared}에서는 경로가 없다`,
        );
        assert.ok(
            !walkableMapsAt(MAP_ROUTE_START_LOCATION, DB.MAPS, row.routeGateLevel - 1).includes(row.map),
            `${row.map}: 레벨 ${row.routeGateLevel - 1}에서도 아직 경로가 없다`,
        );
        assert.ok(
            walkableMapsAt(MAP_ROUTE_START_LOCATION, DB.MAPS, row.routeGateLevel).includes(row.map),
            `${row.map}: 레벨 ${row.routeGateLevel}에서 처음 닿는다`,
        );
    }
});

// ── 부재 불변식 (§7: 삭제된 코드가 되돌아오지 않는다) ───────────────────────

test('contentReachability는 경로 게이트 보행을 다시 선언하지 않는다 (부재 불변식)', async () => {
    const source = await readSrc('src/systems/contentReachability.ts');
    assert.match(source, /from '\.\.\/utils\/mapRouteGate\.js'/, '보행은 추출된 모듈에서 읽는다');
    assert.doesNotMatch(source, /const\s+mapRouteGateLevels\s*=/);
    assert.doesNotMatch(source, /const\s+reachableFrom\s*=/);
    assert.doesNotMatch(source, /const\s+mapGateLevel\s*=/);
});
