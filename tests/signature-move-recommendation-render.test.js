import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import ControlPanel from '../src/components/ControlPanel.tsx';
import MapNavigator from '../src/components/MapNavigator.tsx';
import RouteTopology from '../src/components/RouteTopology.tsx';
import { GS } from '../src/reducers/gameStates.ts';
import { getMapSignatureDrops } from '../src/utils/mapSignatureHints.ts';
import { MAPS } from '../src/data/maps.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 2026-10 Wave 103 (소유자 결정 §107.6 "전설 각인 획득처는 얻은 뒤에만 공개"): 이동 화면 · 지도는 "이 경로에 미발견 전설
 * 각인이 N종" 배지를 그리지 않는다. 이전 계약(Wave 5 W3-B — 배지 · data-signature-count)은 의도적으로 뒤집었다.
 * 같은 경로 카드가 실제 화면(ControlPanel 이동 · MapNavigator)에서 배지 없이 그려지는지를 렌더 결과로 확인한다.
 */

const findExitWithSignatures = () => {
    for (const [mapName, map] of Object.entries(MAPS)) {
        const exits = Array.isArray(map?.exits) ? map.exits : [];
        for (const exitName of exits) {
            if (getMapSignatureDrops(exitName).length > 0) return { sourceName: mapName, exitName };
        }
    }
    return null;
};

const fixture = findExitWithSignatures();
assert.ok(fixture, '전제: 실전 맵 데이터에 signature 드롭을 가진 exit가 최소 1개 있어야 한다');

test('RouteTopology: 경로에 각인 수 필드가 와도 signature 배지를 그리지 않는다', () => {
    const routes = [
        { name: '알파', undiscoveredSignatureCount: 2 },
        { name: '베타', undiscoveredSignatureCount: 0 },
    ];
    const html = renderStatic(createElement(RouteTopology, {
        currentName: '시작점',
        routes,
        testId: 'rt',
        currentTestId: 'rt-current',
        connectorTestId: 'rt-connector',
        routeTestId: (route) => `rt-option-${route.name}`,
    }));
    assert.ok(html.includes('rt-option-알파'), '경로 카드는 그대로 렌더된다');
    assert.ok(!html.includes('move-recommendation-signature'));
    assert.ok(!html.includes('data-signature-count'));
    assert.ok(!html.includes('미발견 전설'));
});

test('ControlPanel: 이동 화면(GS.MOVING)의 각인 지역 경로에 미발견 수가 뜨지 않는다', () => {
    const player = makePlayerFixture({ loc: fixture.sourceName });
    const html = renderStatic(createElement(ControlPanel, {
        player,
        stats: { maxHp: 150, maxMp: 50 },
        actions: { move: () => {} },
        gameState: GS.MOVING,
    }));
    assert.ok(html.includes('data-testid="control-route-topology"'), 'ControlPanel이 RouteTopology를 실제로 렌더한다');
    assert.ok(html.includes(fixture.exitName), `${fixture.exitName} 경로 카드가 있다`);
    assert.ok(!html.includes('move-recommendation-signature'));
    assert.ok(!html.includes('미발견 전설'));
});

test('MapNavigator: 지도 화면도 미발견 각인 수 · 이름을 그리지 않는다', () => {
    const player = makePlayerFixture({ loc: fixture.sourceName });
    const html = renderStatic(createElement(MapNavigator, {
        player,
        grave: [],
        stats: { maxHp: 150, maxMp: 50 },
        actions: {},
    }));
    assert.ok(!html.includes('move-recommendation-signature'));
    for (const drop of getMapSignatureDrops(fixture.exitName)) {
        assert.ok(!html.includes(drop.name), `미발견 각인 이름(${drop.name})이 지도에 없다`);
    }
});
