import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import MapNavigator from '../src/components/MapNavigator.tsx';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { getMapAccess } from '../src/utils/mapAccess.ts';
import { getExitBadges } from '../src/utils/mapBadges.js';
import { getMapRouteGate } from '../src/utils/mapRouteGate.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

// 2026-10 Wave 61: getExitBadges(map, player, mapName) — 보스 배지는 지역의 `boss` 필드가 아니라 이 플레이어에게 보스가
//   실제로 나올 수 있는가(canBossAppearInMap)를 따르고, 처치 기록 · 게이지는 player.stats에서 읽는다. 지역 전수 대조는
//   tests/map-badge-title-text-contract.test.js가 spawnEnemy 오라클로 한다.
const withStats = (stats = {}) => ({ stats });

test('getExitBadges returns a boss badge when the map has an undefeated named boss', () => {
    const map = { boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, withStats({ areaBossDefeated: {} }));
    assert.ok(badges.some((b) => b.id === 'boss'));
});

test('getExitBadges hides the boss badge once that boss has been defeated', () => {
    const map = { boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, withStats({ areaBossDefeated: { '고대 호수의 수호신': true } }));
    assert.ok(!badges.some((b) => b.id === 'boss'));
});

test('getExitBadges: boolean boss flag alone is not a boss — the badge follows bosses that can actually appear', () => {
    assert.ok(!getExitBadges({ boss: true, eventChance: 0.1 }, withStats()).some((b) => b.id === 'boss'),
        '조우 풀 · 숨은 보스가 없으면 boss: true만으로는 보스가 나오지 않는다');
    const withPoolBoss = { boss: true, eventChance: 0.1, monsters: ['레드 드래곤'], bossMonsters: ['레드 드래곤'] };
    assert.ok(getExitBadges(withPoolBoss, withStats()).some((b) => b.id === 'boss'), '조우 풀의 보스는 보스다');
});

test('getExitBadges returns no boss badge when map has no boss', () => {
    const map = { eventChance: 0.1 };
    const badges = getExitBadges(map, withStats());
    assert.ok(!badges.some((b) => b.id === 'boss'));
});

test('getExitBadges returns high-event badge when the real narrative chance meets the threshold', () => {
    const highChanceMap = { eventChance: 0.3 };
    const badges = getExitBadges(highChanceMap, withStats());
    assert.ok(badges.some((b) => b.id === 'highEvent'));

    const lowChanceMap = { eventChance: 0.15 };
    const lowBadges = getExitBadges(lowChanceMap, withStats());
    assert.ok(!lowBadges.some((b) => b.id === 'highEvent'));
});

test('getExitBadges returns a shop badge when the map has shopBonus', () => {
    const map = { shopBonus: 1.5 };
    const badges = getExitBadges(map, withStats());
    assert.ok(badges.some((b) => b.id === 'shop'));
});

test('getExitBadges returns no shop badge when shopBonus is absent', () => {
    const map = { eventChance: 0.1 };
    const badges = getExitBadges(map, withStats());
    assert.ok(!badges.some((b) => b.id === 'shop'));
});

test('getExitBadges returns a grave badge when the map has graveDropBonus', () => {
    const map = { graveDropBonus: 2.0 };
    const badges = getExitBadges(map, withStats());
    assert.ok(badges.some((b) => b.id === 'grave'));
});

test('getExitBadges combines multiple applicable badges', () => {
    const map = { boss: '심연의 크라켄', eventChance: 0.35, shopBonus: 1.2, graveDropBonus: 1.5 };
    const badges = getExitBadges(map, withStats());
    const ids = badges.map((b) => b.id);
    assert.ok(ids.includes('boss'));
    assert.ok(ids.includes('highEvent'));
    assert.ok(ids.includes('shop'));
    assert.ok(ids.includes('grave'));
});

test('getExitBadges returns empty array for a plain map with none of the tracked fields', () => {
    const map = { level: 5, type: 'dungeon' };
    const badges = getExitBadges(map, withStats());
    assert.deepEqual(badges, []);
});

test('getExitBadges handles null/undefined map gracefully', () => {
    assert.deepEqual(getExitBadges(null, withStats()), []);
    assert.deepEqual(getExitBadges(undefined, withStats()), []);
});

test('getExitBadges each badge has an id and a label string', () => {
    const map = { boss: '고대 호수의 수호신', eventChance: 0.5, shopBonus: 1, graveDropBonus: 1 };
    const badges = getExitBadges(map, withStats());
    assert.equal(badges.length, 4);
    for (const badge of badges) {
        assert.equal(typeof badge.id, 'string');
        assert.equal(typeof badge.label, 'string');
        assert.ok(badge.label.length > 0);
    }
});

// ── bossGauge (2026-07 원정 보스 접근 게이지) — player.stats.bossGauge ────────

test('getExitBadges: 게이지 기록이 없으면 게이지 배지 미표시', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, withStats());
    assert.ok(badges.some((b) => b.id === 'boss'));
    assert.ok(!badges.some((b) => b.id === 'bossGauge'), '게이지 없으면 게이지 배지 미표시');
});

test('getExitBadges: bossGauge 값이 0보다 크면 진행도 배지 표시', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, withStats({ bossGauge: { '신성한 호수': 0.42 } }));
    const gaugeBadge = badges.find((b) => b.id === 'bossGauge');
    assert.ok(gaugeBadge, '게이지 진행도 배지 존재');
    assert.ok(gaugeBadge.label.includes('42'), '진행도 %가 라벨에 포함');
});

test('getExitBadges: bossGauge 값이 0이면 진행도 배지 미표시', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, withStats({ bossGauge: { '신성한 호수': 0 } }));
    assert.ok(!badges.some((b) => b.id === 'bossGauge'));
});

test('getExitBadges: 보스가 이미 격파됐으면 게이지 값이 있어도 게이지 배지 미표시 (boss 배지와 함께 숨김)', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, withStats({
        areaBossDefeated: { '고대 호수의 수호신': true },
        bossGauge: { '신성한 호수': 0.8 },
    }));
    assert.ok(!badges.some((b) => b.id === 'boss'));
    assert.ok(!badges.some((b) => b.id === 'bossGauge'));
});

test('getExitBadges: 다른 지역의 게이지 값은 영향 없음 (지역 이름 키로 조회)', () => {
    const map = { boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, withStats({ bossGauge: { '다른 지역': 0.9 } }), '신성한 호수');
    assert.ok(!badges.some((b) => b.id === 'bossGauge'));
    const own = getExitBadges(map, withStats({ bossGauge: { '신성한 호수': 0.9 } }), '신성한 호수');
    assert.ok(own.some((b) => b.id === 'bossGauge'), '대조군: 같은 이름이면 게이지 배지');
});

// ── 실제 진입 레벨 표시 (2026-09 Wave 13 E2) ────────────────────────────────
// 지도 행/카드가 보여주던 레벨은 그 지역 자신의 잠금이고, 52곳 중 16곳은 실제
// 진입선이 더 위에 있다(Wave 27 N3: 실제 이동 규칙으로 걸으면 북부 권역 8곳이 Lv35라 10 → 16). 값은 `utils/mapRouteGate.ts`(증빙 리포트와 같은 authority),
// 문구는 MSG — 여기서는 실제로 렌더해서 그 값이 화면에 나오는지 본다.

const renderMap = (overrides = {}) => renderStatic(createElement(MapNavigator, {
    player: makePlayerFixture({ level: 20, ...overrides }),
    grave: undefined,
    stats: null,
}));

const mapRows = (html) => [...html.matchAll(/<button[^>]*data-testid="map-row"[^]*?<\/button>/g)].map((match) => match[0]);
const rowFor = (html, name) => mapRows(html).find((row) => row.includes(`>${name}<`));

test('지도 목록: 선언 레벨과 실제 진입 레벨이 다른 16곳에만 진입 레벨 배지가 붙는다', () => {
    const html = renderMap();
    const rowsWithGate = mapRows(html).filter((row) => row.includes('map-row-route-gate'));
    assert.equal(rowsWithGate.length, 16, '실측 divergence 16건 = 배지 16건');
    // Wave 27 N3: 시즌 지역 너머의 얼음 성채는 선언 20이 아니라 걷는 길이 열리는 35를 말한다.
    assert.ok(rowFor(html, '얼음 성채').includes(MSG.MAP_ROUTE_GATE_LEVEL(35)));
    // 걷는 길이 없는 시즌 지역·보물고에는 쓸 수 없는 진입 레벨을 붙이지 않는다.
    for (const name of ['봄의 정원', '서리 폭풍 유적', '고대 보물고']) {
        assert.ok(!rowFor(html, name).includes('map-row-route-gate'), name);
    }

    const temple = rowFor(html, '공중 신전');
    assert.ok(temple.includes('레벨 48'), '지역 자신의 잠금(48)은 그대로 보인다 — 권한이 읽는 값이다');
    assert.ok(temple.includes(MSG.MAP_ROUTE_GATE_LEVEL(52)), '실제 진입선 52를 함께 말한다');
});

test('지도 목록: 선언과 경로가 같은 지역에는 진입 레벨 배지가 없다', () => {
    const html = renderMap();
    const start = rowFor(html, '시작의 마을');
    assert.ok(start, '시작의 마을 행 존재');
    assert.ok(!start.includes('map-row-route-gate'));
    assert.equal(getMapRouteGate({ '시작의 마을': { level: 1, exits: [] } }, '시작의 마을').diverges, false);
});

test('지도 목록: 혼돈의 심연은 숫자 없는 라벨 옆에 실제 진입 레벨 48을 보인다', () => {
    const abyss = rowFor(renderMap(), '혼돈의 심연');
    assert.ok(abyss.includes('심연'), "레벨 잠금이 없어 '심연' 라벨을 그대로 쓴다");
    assert.ok(abyss.includes(MSG.MAP_ROUTE_GATE_LEVEL(48)));
});

test('선택 카드: 갈라지는 지역은 진입 레벨과 그 이유를 함께 말한다', () => {
    const html = renderMap({ loc: '공중 신전', level: 52 });
    assert.ok(html.includes('data-testid="map-route-gate-level"'));
    assert.ok(html.includes(MSG.MAP_ROUTE_GATE_LEVEL(52)));
    assert.ok(html.includes(MSG.MAP_ROUTE_GATE_NOTE(48, 52)), '선언 48과 진입 52를 한 문장에서 구분해 말한다');
});

test('선택 카드: 잠금이 없는 혼돈의 심연은 "잠금 없음" 문구를 쓴다', () => {
    const html = renderMap({ loc: '혼돈의 심연', level: 48 });
    assert.ok(html.includes(MSG.MAP_ROUTE_GATE_NOTE_UNGATED(48)));
    assert.ok(!html.includes(MSG.MAP_ROUTE_GATE_NOTE(1, 48)), "선언 레벨 1을 잠금인 것처럼 말하지 않는다");
});

test('선택 카드: 갈라지지 않는 지역에는 진입 레벨 줄이 아예 없다', () => {
    const html = renderMap({ loc: '시작의 마을', level: 1 });
    assert.ok(!html.includes('data-testid="map-route-gate-note"'));
    assert.ok(!html.includes('data-testid="map-route-gate-level"'));
});

test('표시만 고친다: 행의 레벨 칩은 선언 레벨 그대로이고 진입 레벨은 별도 배지다', () => {
    // 세계수 숲: 선언 38 / 실제 진입 40. 칩을 40으로 바꿔 쓰면 이동 권한(선언 38)과
    // 화면이 어긋난다 — 그래서 칩은 그대로 두고 배지 한 칸을 더 쓴다.
    const row = rowFor(renderMap(), '세계수 숲');
    const badge = MSG.MAP_ROUTE_GATE_LEVEL(40);
    assert.ok(row.includes('레벨 38'), '지역 자신의 잠금 = 권한이 읽는 값');
    assert.ok(row.includes(badge));
    assert.ok(!row.split(badge).join('').includes('레벨 40'), '배지 밖에서는 40을 요구 레벨처럼 쓰지 않는다');
});

test('표시만 고친다: 경로 게이트를 권한으로 승격하지 않는다 (getMapAccess 불변)', () => {
    // 세계수 숲은 선언 38이므로, 거기로 이어진 지역에 서 있는 레벨 38 플레이어는
    // 여전히 들어갈 수 있다 — 실제 진입선이 40인 것은 "그 지역까지 못 온다"는 뜻이다.
    const from = Object.keys(DB.MAPS).find((name) => DB.MAPS[name].exits?.includes('세계수 숲'));
    assert.ok(from, '세계수 숲으로 이어진 지역 존재');
    assert.equal(getMapAccess(DB.MAPS, from, '세계수 숲', 38).reason, null);
    assert.equal(getMapAccess(DB.MAPS, from, '세계수 숲', 37).reason, 'level');
});

// 2026-09 Wave 27 N3: 이 칸은 원래 `얼음 성채 · Lv30`에서 선택 카드(= 현재 위치)에 진입 레벨 줄이
//   없다고 단언했는데, 얼음 성채가 갈라지지 않던(20 = 20) 동안에는 감출 것이 없어 **공허참**이었다.
//   얼음 성채가 20 → 35로 갈라지자 현재 위치 카드에 줄이 떴다 — blindMap이 감추는 것은 **직접 출구**
//   카드('미확인 경로')이고 현재 위치가 아니다. 그래서 선택 카드가 갈라지는 직접 출구가 되도록
//   임무 경로로 고정하고(저주받은 묘지 → 얼음 성채, 임무 84의 기계 폐도 방향), 같은 픽스처의 blindMap 없는
//   렌더가 그 줄을 **실제로 그린다**는 대조군을 함께 둔다.
test('도전 규칙(blindMap)에서는 선택 카드의 진입 레벨도 감춘다', () => {
    const fixture = { loc: '저주받은 묘지', level: 35, quests: [{ id: 84, progress: 0, goal: 10 }] };
    const open = renderMap(fixture);
    assert.ok(open.includes('얼음 성채(으)로 이동'), '선택 카드가 갈라지는 직접 출구(얼음 성채)다');
    assert.ok(open.includes(MSG.MAP_ROUTE_GATE_NOTE(20, 35)), '대조군: blindMap이 없으면 진입 레벨 줄을 그린다');

    const html = renderMap({ ...fixture, challengeModifiers: ['blindMap'] });
    assert.ok(html.includes('정보 없음'));
    assert.ok(!html.includes('data-testid="map-route-gate-note"'));
    assert.ok(!html.includes('data-testid="map-route-gate-level"'));
});
