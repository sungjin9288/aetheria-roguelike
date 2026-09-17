import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { INITIAL_STATE } from '../../src/reducers/gameReducer';
import type { Player } from '../../src/types';

/**
 * Wave 4 Track P4 — 정적 가드(readFileSync 소스 grep) 테스트를 실제 렌더 검증으로
 * 옮길 때 쓰는 공용 헬퍼.
 *
 * `renderStatic`은 브라우저/JSDOM 없이 서버사이드 렌더 문자열만 얻는다 —
 * `tests/expedition-hud.test.js` / `tests/local-error-report-store.test.js`가 이미
 * 쓰는 패턴(react-dom/server의 renderToStaticMarkup)을 그대로 따른다. 이벤트 핸들러나
 * useEffect는 실행되지 않으므로, 렌더 결과(HTML 문자열)에 대한 assertion에만 쓴다.
 * 엘리먼트 생성은 호출부에서 `createElement(Component, props)`로 하면 된다.
 */
export const renderStatic = (element: ReactElement): string => renderToStaticMarkup(element);

/**
 * `INITIAL_STATE.player`(gameReducer.ts, 실제 게임이 쓰는 기본값)를 베이스로 한
 * Player 픽스처. `src/types/player.ts`의 필드가 바뀌면 이 함수가 반환하는 값도
 * 함께 바뀌므로, signature 테스트의 픽스처가 실제 Player 셰이프와 갈라지지 않는다.
 *
 * 최상위 키 단위로 override한다(기존 tests/*.test.js의 makePlayer 관례와 동일) —
 * 예: makePlayerFixture({ stats: { ...override } })는 stats 전체를 교체한다.
 * INITIAL_STATE.player는 구조적으로 깊은 참조를 공유하므로 매 호출마다
 * structuredClone으로 복제해 테스트 간 오염을 막는다.
 */
export const makePlayerFixture = (overrides: Partial<Player> = {}): Player => ({
    ...structuredClone(INITIAL_STATE.player),
    ...overrides,
});
