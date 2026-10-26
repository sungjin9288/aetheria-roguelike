import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import Dashboard from '../src/components/Dashboard.tsx';
import GravePanel from '../src/components/GravePanel.tsx';
import SmartInventory from '../src/components/SmartInventory.tsx';
import SkillTreePreview from '../src/components/SkillTreePreview.tsx';
import MapNavigator from '../src/components/MapNavigator.tsx';
import StatsPanel from '../src/components/StatsPanel.tsx';
import EquipmentPanel from '../src/components/EquipmentPanel.tsx';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 기록 탭 A(기록 셸 · 장비 · 가방 · 기술 · 상태 · 지도 · 묘비) — 2026-10 에테르 유리 계약.
 *
 * 1. 셸은 두 배치다: 시트(모바일 — 닫기 단추가 있다)와 열(데스크톱 — 닫을 것이 없다).
 * 2. 금빛 주 단추는 화면마다 하나 이하다 — 묘비는 지금 서 있는 곳의 회수, 지도는 이동, 기술은 첫 성장 결정.
 * 3. 상태 칩은 SignalChip(토큰 색)이고 장식 글리프(✦ · ⚔ · ◈)를 쓰지 않는다.
 */

const countPrimary = (html) => (html.match(/data-variant="primary"/g) || []).length;

const dashboardProps = (overrides = {}) => ({
    player: makePlayerFixture(),
    uid: 'test-uid',
    grave: null,
    sideTab: 'equipment',
    setSideTab: () => {},
    actions: {},
    stats: null,
    quickSlots: [],
    runtime: null,
    onReturnToLog: () => {},
    ...overrides,
});

test('기록 셸: 시트 배치는 닫기 단추를, 열 배치는 닫기 · 더 보기 단추를 그리지 않는다', () => {
    const sheet = renderStatic(createElement(Dashboard, dashboardProps()));
    assert.match(sheet, /data-layout="sheet"/);
    assert.ok(sheet.includes('data-testid="mobile-console-return-log"'), '시트에는 기록 닫기 단추가 있다');

    const column = renderStatic(createElement(Dashboard, dashboardProps({ layout: 'column' })));
    assert.match(column, /data-layout="column"/);
    assert.ok(!column.includes('data-testid="mobile-console-return-log"'), '열 배치에는 닫을 것이 없다');
    assert.ok(!column.includes('data-testid="archive-tab-rail-more"'), '열 배치는 탭이 모두 보여 더 보기가 없다');
});

test('소유자 결정 2026-10-26 D6: 데스크톱 기록 열의 탭은 내용 왼쪽의 세로 목록이고, 휴대폰 시트는 가로 레일 그대로다', () => {
    const tabIdsIn = (html) => [...html.matchAll(/data-testid="archive-tab-([a-z]+)"/g)].map((match) => match[1])
        .filter((id) => !['rail', 'rail-frame', 'rail-progress', 'rail-more'].includes(id));
    const navTag = (html) => html.match(/<nav[^>]*data-testid="archive-tab-rail"[^>]*>/)[0];

    const column = renderStatic(createElement(Dashboard, dashboardProps({ layout: 'column' })));
    const columnNav = navTag(column);
    assert.match(columnNav, /data-orientation="vertical"/);
    assert.match(columnNav, /flex-col/);
    assert.doesNotMatch(columnNav, /grid-cols-4/, '4열 타일 격자가 아니다');
    assert.ok(columnNav.includes(`aria-label="${MSG.ARCHIVE_TAB_LIST_ARIA}"`));
    const body = column.indexOf('data-testid="archive-column-body"');
    assert.ok(body >= 0 && body < column.indexOf('data-testid="archive-tab-rail"'), '목록은 열 본문 안이다');
    assert.ok(column.indexOf('data-testid="archive-tab-rail"') < column.indexOf('data-testid="mobile-archive-console-content"'), '목록이 내용 앞(왼쪽)이다');
    assert.ok(!column.includes('data-testid="archive-tab-rail-frame"'), '가로 레일 틀은 없다');
    assert.equal(tabIdsIn(column).length, 11, '탭 열한 개가 모두 있다');

    const sheet = renderStatic(createElement(Dashboard, dashboardProps()));
    assert.match(navTag(sheet), /data-orientation="horizontal"/);
    assert.ok(sheet.includes('data-testid="archive-tab-rail-frame"'));
    assert.deepEqual(tabIdsIn(sheet), tabIdsIn(column), '탭 순서는 같다');
});

test('기록 셸: 탭마다 선택 표시는 data-active 하나이고 지금 탭만 참이다', () => {
    const html = renderStatic(createElement(Dashboard, dashboardProps({ sideTab: 'inventory' })));
    const activeTabs = html.match(/data-testid="archive-tab-[a-z]+"[^>]*data-active="true"/g) || [];
    assert.equal(activeTabs.length, 1);
    assert.match(activeTabs[0], /archive-tab-inventory/);
});

test('묘비: 금빛 주 단추는 지금 서 있는 곳의 회수 하나뿐이다', () => {
    const player = makePlayerFixture({ loc: '시작의 마을' });
    const grave = [
        { loc: '시작의 마을', gold: 120, items: [], timestamp: 1, level: 5 },
        { loc: '고요한 숲', gold: 40, items: [], timestamp: 2, level: 6 },
    ];
    const html = renderStatic(createElement(GravePanel, { player, grave, actions: {} }));
    assert.equal(countPrimary(html), 1);
    assert.match(html, /data-variant="primary"[^>]*data-testid="grave-recover-here"|data-testid="grave-recover-here"[^>]*data-variant="primary"/);

    const away = renderStatic(createElement(GravePanel, {
        player,
        grave: [{ loc: '고요한 숲', gold: 40, items: [], timestamp: 2, level: 6 }],
        actions: {},
    }));
    assert.equal(countPrimary(away), 0, '다른 지역의 유해는 지도로 가는 보조 행동');
});

test('가방: 상태 칩은 SignalChip이고 장식 글리프를 쓰지 않는다', () => {
    const weapon = { id: 'w-1', name: '낡은 검', type: 'weapon', val: 12, tier: 1, jobs: ['모험가'] };
    const potion = { id: 'p-1', name: '하급 체력 물약', type: 'hp', val: 30, tier: 1 };
    const signature = { ...DB.ITEMS.weapons.find((item) => item.name === '성검 에테르니아'), id: 'sig-1' };
    const player = makePlayerFixture({ inv: [weapon, potion, signature] });
    const html = renderStatic(createElement(SmartInventory, { player, actions: { useItem: () => {}, enhanceItem: () => {}, autoSell: () => {} } }));
    assert.ok(html.includes('data-signal-tone='), '판단 칩은 SignalChip');
    assert.ok(html.includes('data-testid="inventory-signature-chip-sig-1"'), '전설 각인 칩이 그려진다');
    for (const glyph of ['✦', '⚔', '◈']) assert.ok(!html.includes(glyph), `장식 글리프 ${glyph} 없음`);
    assert.ok(/aria-pressed="true"[^>]*>전체<|>전체</.test(html), '분류 단추가 그려진다');
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1, '분류는 하나만 눌려 있다');
    assert.ok(countPrimary(html) <= 1);
});

test('기술: 대기 중인 성장이 여럿이어도 금빛 확정 단추는 첫 결정 하나다', () => {
    const entry = Object.entries(DB.CLASSES).find(([, cls]) => Object.keys(cls.skillBranches || {}).length >= 2);
    assert.ok(entry, '성장 분기가 둘 이상인 직업이 있다');
    const [job] = entry;
    const player = makePlayerFixture({ job, level: 60, skillChoices: {} });
    const html = renderStatic(createElement(SkillTreePreview, { player, actions: { chooseSkillBranch: () => {} } }));
    const confirms = html.match(/data-testid="skill-growth-confirm-[^"]+"/g) || [];
    assert.ok(confirms.length >= 2, `확정 단추 ${confirms.length}개`);
    assert.equal(countPrimary(html), 1);
});

test('지도 · 상태 · 장비: 금빛 주 단추는 화면마다 하나 이하이고 지도는 이동이 그 하나다', () => {
    const player = makePlayerFixture();
    const map = renderStatic(createElement(MapNavigator, { player, grave: null, stats: null, actions: { move: () => {} } }));
    assert.equal(countPrimary(map), 1);
    assert.match(map, /data-testid="map-move-selected"/);

    const stats = renderStatic(createElement(StatsPanel, { player, stats: null }));
    assert.equal(countPrimary(stats), 0);
    for (const glyph of ['✦', '⚔', '◈']) assert.ok(!stats.includes(glyph));

    const equipment = renderStatic(createElement(EquipmentPanel, { player, stats: null, actions: {} }));
    assert.ok(countPrimary(equipment) <= 1);
});
