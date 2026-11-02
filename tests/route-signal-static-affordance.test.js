import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';

import MapSignalStrip from '../src/components/control/MapSignalStrip.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 2026-11 출시 전 점검: 추천 경로 줄은 누를 수 없는 정보인데 떠 있는 카드 그림자와 hover 밝아짐으로 단추처럼 보였다
 * (손가락으로 눌러도 아무 일이 없었다). 길을 바꾸는 단추는 도크의 '이동' · '지도'다(UX-03 — 같은 동작의 단추 둘을 두지 않는다).
 * 부재 불변식: 줄은 누를 수 있는 요소가 아니고, 단추처럼 보이게 하는 hover · 높이 그림자를 갖지 않는다.
 */
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const ruleBody = (selector) => {
    const start = css.indexOf(`${selector} {`);
    assert.ok(start >= 0, `${selector} 규칙이 있다`);
    return css.slice(start, css.indexOf('}', start));
};

test('추천 경로 줄은 누를 수 있는 요소가 아니다', () => {
    const html = renderStatic(createElement(MapSignalStrip, { player: makePlayerFixture(), routes: [] }));
    assert.match(html, /data-testid="control-map-signal"/);
    assert.doesNotMatch(html, /<button|role="button"|tabindex=/i);
});

test('추천 경로 줄은 단추처럼 보이지 않는다 — hover 밝아짐 · 높이 그림자가 없다', () => {
    assert.doesNotMatch(css, /\.ae-route-signal:hover/);
    assert.doesNotMatch(ruleBody('.ae-route-signal'), /box-shadow|--aether-e\d/);
});
