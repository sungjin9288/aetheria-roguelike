import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import ControlPanel from '../src/components/ControlPanel.tsx';
import MapNavigator from '../src/components/MapNavigator.tsx';
import RouteTopology from '../src/components/RouteTopology.tsx';
import { GS } from '../src/reducers/gameStates.ts';
import { getMapUndiscoveredSignatures } from '../src/utils/mapSignatureHints.ts';
import { MAPS } from '../src/data/maps.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * Wave 5 W3-B — signature-move-recommendation-render.test.js 원본 계약(소스 텍스트 grep):
 *
 *   1. ControlPanel.tsx / MapNavigator.tsx가 각각 `<RouteTopology routes={...}>`를
 *      렌더하고, 그 routes가 `moveRecommendations.map(...)`로 만든 엔트리다.
 *   2. RouteTopology는 `route.undiscoveredSignatureCount > 0`일 때만
 *      `data-testid="move-recommendation-signature-{index}"` +
 *      `data-signature-count`를 렌더하고, "미발견 전설 각인" 한국어 라벨 +
 *      gold 팔레트(#f6e7a2)를 쓴다.
 *   3. route 엔트리는 `...route` spread로 원본 recommendation 메타데이터
 *      (undiscoveredSignatureCount 포함)를 보존한다.
 *
 * 아래는 같은 계약을 실제 렌더 결과(markup)로 검증한다 — "어떤 JSX 문자열을
 * 썼는지"가 아니라 "화면에 실제로 무엇이 나오는지"를 확인한다.
 * `getMoveRecommendations`/`getMapUndiscoveredSignatures` 자체의 순수 로직 계약은
 * tests/signature-move-recommendation.test.js가 이미 커버하므로, 여기서는
 * "그 데이터가 실제로 RouteTopology까지 배선되어 화면에 뜨는가"만 검증한다.
 */

// 실전 데이터에서 signature 드롭이 걸린 exit를 찾는다 — fixture 의존도 최소화
// (tests/signature-move-recommendation.test.js의 findExitWithSignatures와 동일 패턴).
const findExitWithSignatures = () => {
    for (const [mapName, map] of Object.entries(MAPS)) {
        const exits = Array.isArray(map?.exits) ? map.exits : [];
        for (const exitName of exits) {
            const undiscovered = getMapUndiscoveredSignatures(exitName, { stats: { codex: {} } });
            if (undiscovered.length > 0) {
                return { sourceName: mapName, exitName, expectedCount: undiscovered.length };
            }
        }
    }
    return null;
};

const fixture = findExitWithSignatures();
assert.ok(fixture, '전제: 실전 맵 데이터에 signature 드롭을 가진 exit가 최소 1개 있어야 한다');

test('RouteTopology: undiscoveredSignatureCount > 0인 route만 signature 배지를 렌더한다', () => {
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

    assert.ok(html.includes('data-testid="move-recommendation-signature-0"'), '카운트 > 0인 첫 route에는 배지가 있다');
    assert.ok(html.includes('data-signature-count="2"'), '실제 카운트 숫자가 그대로 노출된다');
    assert.ok(html.includes('미발견 전설 각인 2종'), '한국어 aria-label');
    assert.ok(html.includes('#f6e7a2'), 'gold 팔레트');
    assert.ok(!html.includes('move-recommendation-signature-1'), '카운트 0인 두번째 route에는 배지가 없다');
});

test('RouteTopology: blindMap일 때는 signature 배지가 있어도 숨긴다', () => {
    const routes = [{ name: '알파', undiscoveredSignatureCount: 3 }];
    const html = renderStatic(createElement(RouteTopology, {
        currentName: '시작점',
        routes,
        blindMap: true,
        testId: 'rt',
        currentTestId: 'rt-current',
        connectorTestId: 'rt-connector',
    }));
    assert.ok(!html.includes('move-recommendation-signature'), 'blindMap에서는 위치 정보 자체가 가려지므로 signature 배지도 숨긴다');
});

test('ControlPanel: 이동 화면(GS.MOVING)에서 실제 미발견 signature 경로가 화면에 뜬다', () => {
    const player = makePlayerFixture({ loc: fixture.sourceName });
    const stats = { maxHp: 150, maxMp: 50 };

    const html = renderStatic(createElement(ControlPanel, {
        player,
        stats,
        actions: { move: () => {} },
        gameState: GS.MOVING,
    }));

    assert.ok(html.includes('data-testid="control-route-topology"'), 'ControlPanel이 RouteTopology를 실제로 렌더한다');
    const idx = html.indexOf('move-recommendation-signature');
    assert.ok(idx > -1, `${fixture.sourceName} → ${fixture.exitName} 경로에 signature 배지가 뜬다`);
    const exitIdx = html.indexOf(fixture.exitName);
    assert.ok(exitIdx > -1 && exitIdx < idx, '배지가 실제 signature exit의 경로 카드 안(exit 이름보다 뒤)에 렌더된다');
    assert.ok(html.includes(`data-signature-count="${fixture.expectedCount}"`), '실제 undiscoveredSignatureCount 숫자가 그대로 화면에 나온다');
});

test('MapNavigator: 지도 화면에서도 같은 미발견 signature 경로가 화면에 뜬다', () => {
    const player = makePlayerFixture({ loc: fixture.sourceName });
    const stats = { maxHp: 150, maxMp: 50 };

    const html = renderStatic(createElement(MapNavigator, {
        player,
        grave: [],
        stats,
        actions: {},
    }));

    const idx = html.indexOf('move-recommendation-signature');
    assert.ok(idx > -1, `MapNavigator도 ${fixture.sourceName} → ${fixture.exitName} signature를 배지로 노출한다`);
    assert.ok(html.includes(`data-signature-count="${fixture.expectedCount}"`), '실제 undiscoveredSignatureCount 숫자가 그대로 화면에 나온다');
});
