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

test('getExitBadges returns a boss badge when the map has an undefeated named boss', () => {
    const map = { boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, {});
    assert.ok(badges.some((b) => b.id === 'boss'));
});

test('getExitBadges hides the boss badge once that boss has been defeated', () => {
    const map = { boss: '고대 호수의 수호신', eventChance: 0.1 };
    const areaBossDefeated = { '고대 호수의 수호신': true };
    const badges = getExitBadges(map, areaBossDefeated);
    assert.ok(!badges.some((b) => b.id === 'boss'));
});

test('getExitBadges shows a boss badge for boolean boss flag maps regardless of defeated map (no name to key on)', () => {
    const map = { boss: true, eventChance: 0.1 };
    const badges = getExitBadges(map, { 아무거나: true });
    assert.ok(badges.some((b) => b.id === 'boss'));
});

test('getExitBadges returns no boss badge when map has no boss', () => {
    const map = { eventChance: 0.1 };
    const badges = getExitBadges(map, {});
    assert.ok(!badges.some((b) => b.id === 'boss'));
});

test('getExitBadges returns high-event badge when eventChance meets or exceeds the threshold', () => {
    const highChanceMap = { eventChance: 0.3 };
    const badges = getExitBadges(highChanceMap, {});
    assert.ok(badges.some((b) => b.id === 'highEvent'));

    const lowChanceMap = { eventChance: 0.15 };
    const lowBadges = getExitBadges(lowChanceMap, {});
    assert.ok(!lowBadges.some((b) => b.id === 'highEvent'));
});

test('getExitBadges returns a shop badge when the map has shopBonus', () => {
    const map = { shopBonus: 1.5 };
    const badges = getExitBadges(map, {});
    assert.ok(badges.some((b) => b.id === 'shop'));
});

test('getExitBadges returns no shop badge when shopBonus is absent', () => {
    const map = { eventChance: 0.1 };
    const badges = getExitBadges(map, {});
    assert.ok(!badges.some((b) => b.id === 'shop'));
});

test('getExitBadges returns a grave badge when the map has graveDropBonus', () => {
    const map = { graveDropBonus: 2.0 };
    const badges = getExitBadges(map, {});
    assert.ok(badges.some((b) => b.id === 'grave'));
});

test('getExitBadges combines multiple applicable badges', () => {
    const map = { boss: '심연의 크라켄', eventChance: 0.35, shopBonus: 1.2, graveDropBonus: 1.5 };
    const badges = getExitBadges(map, {});
    const ids = badges.map((b) => b.id);
    assert.ok(ids.includes('boss'));
    assert.ok(ids.includes('highEvent'));
    assert.ok(ids.includes('shop'));
    assert.ok(ids.includes('grave'));
});

test('getExitBadges returns empty array for a plain map with none of the tracked fields', () => {
    const map = { level: 5, type: 'dungeon' };
    const badges = getExitBadges(map, {});
    assert.deepEqual(badges, []);
});

test('getExitBadges handles null/undefined map gracefully', () => {
    assert.deepEqual(getExitBadges(null, {}), []);
    assert.deepEqual(getExitBadges(undefined, {}), []);
});

test('getExitBadges each badge has an id and a label string', () => {
    const map = { boss: '보스', eventChance: 0.5, shopBonus: 1, graveDropBonus: 1 };
    const badges = getExitBadges(map, {});
    for (const badge of badges) {
        assert.equal(typeof badge.id, 'string');
        assert.equal(typeof badge.label, 'string');
        assert.ok(badge.label.length > 0);
    }
});

// ── bossGauge (2026-07 원정 보스 접근 게이지) — 3번째 인자, 하위 호환 ────────

test('getExitBadges: bossGauge 인자 생략 시 기존 2-인자 호출과 동일 (하위 호환)', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, {});
    assert.ok(badges.some((b) => b.id === 'boss'));
    assert.ok(!badges.some((b) => b.id === 'bossGauge'), 'bossGauge 인자 없으면 게이지 배지 미표시');
});

test('getExitBadges: bossGauge 값이 0보다 크면 진행도 배지 표시', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, {}, { '신성한 호수': 0.42 });
    const gaugeBadge = badges.find((b) => b.id === 'bossGauge');
    assert.ok(gaugeBadge, '게이지 진행도 배지 존재');
    assert.ok(gaugeBadge.label.includes('42'), '진행도 %가 라벨에 포함');
});

test('getExitBadges: bossGauge 값이 0이면 진행도 배지 미표시', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, {}, { '신성한 호수': 0 });
    assert.ok(!badges.some((b) => b.id === 'bossGauge'));
});

test('getExitBadges: 보스가 이미 격파됐으면 게이지 값이 있어도 게이지 배지 미표시 (boss 배지와 함께 숨김)', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, { '고대 호수의 수호신': true }, { '신성한 호수': 0.8 });
    assert.ok(!badges.some((b) => b.id === 'boss'));
    assert.ok(!badges.some((b) => b.id === 'bossGauge'));
});

test('getExitBadges: 다른 지역의 게이지 값은 영향 없음 (map.name 키로 조회)', () => {
    const map = { name: '신성한 호수', boss: '고대 호수의 수호신', eventChance: 0.1 };
    const badges = getExitBadges(map, {}, { '다른 지역': 0.9 });
    assert.ok(!badges.some((b) => b.id === 'bossGauge'));
});

// ── 실제 진입 레벨 표시 (2026-09 Wave 13 E2) ────────────────────────────────
// 지도 행/카드가 보여주던 레벨은 그 지역 자신의 잠금이고, 52곳 중 10곳은 실제
// 진입선이 더 위에 있다. 값은 `utils/mapRouteGate.ts`(증빙 리포트와 같은 authority),
// 문구는 MSG — 여기서는 실제로 렌더해서 그 값이 화면에 나오는지 본다.

const renderMap = (overrides = {}) => renderStatic(createElement(MapNavigator, {
    player: makePlayerFixture({ level: 20, ...overrides }),
    grave: undefined,
    stats: null,
}));

const mapRows = (html) => [...html.matchAll(/<button[^>]*data-testid="map-row"[^]*?<\/button>/g)].map((match) => match[0]);
const rowFor = (html, name) => mapRows(html).find((row) => row.includes(`>${name}<`));

test('지도 목록: 선언 레벨과 실제 진입 레벨이 다른 10곳에만 진입 레벨 배지가 붙는다', () => {
    const html = renderMap();
    const rowsWithGate = mapRows(html).filter((row) => row.includes('map-row-route-gate'));
    assert.equal(rowsWithGate.length, 10, '실측 divergence 10건 = 배지 10건');

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

test('도전 규칙(blindMap)에서는 선택 카드의 진입 레벨도 감춘다', () => {
    const html = renderMap({ loc: '얼음 성채', level: 30, challengeModifiers: ['blindMap'] });
    assert.ok(html.includes('정보 없음'));
    assert.ok(!html.includes('data-testid="map-route-gate-note"'));
});
