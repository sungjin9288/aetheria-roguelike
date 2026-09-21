import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { MSG } from '../src/data/messages.js';
import { createExploreActions } from '../src/hooks/gameActions/exploreActions.js';
import { AI_SERVICE } from '../src/services/aiService.js';
import { TokenQuotaManager } from '../src/systems/TokenQuotaManager.ts';
import ControlPanel from '../src/components/ControlPanel.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09 Wave 19 K1 — **AI 이벤트 "준비 중"은 EVENT가 아니라 자기 모드다.**
//
// 수정 전 실측(주입 아님 — 프로덕션 코드로 도달한다):
//   `exploreActions`는 `SET_GAME_STATE event` → `SET_AI_THINKING true` → 최대 9.5초
//   `await AI_SERVICE.generateEvent` 순서였고, 그 `try`에 **`catch`가 없었다**.
//   `generateEvent`가 reject하면(그 경로는 `TokenQuotaManager.getQuotaData`의 무방비
//   `JSON.parse(localStorage.getItem(...))`에 실재한다 — 파손된 값/차단된 저장소)
//   dispatch 열이 `SET_GAME_STATE=event | SET_AI_THINKING=true | SET_AI_THINKING=false`로
//   끝나고 `explore()` 자체가 reject했다. 남는 상태는 `{event, currentEvent: null}`이고
//   `EventPanel`은 `return null`, `TerminalView`는 `FOCUS_PANEL_STATES`라 마운트되지
//   않는다 = **리로드로도 못 푸는 라이브 벽돌**(Wave 18의 폴드는 `LOAD_DATA`에만 있다).
//
// 이 파일이 고정하는 것 넷:
//   ① `explore()` AI 경로의 dispatch 열 — `BEGIN_AI_EVENT` → `RESOLVE_AI_EVENT`이고
//      그 열에 `SET_GAME_STATE=event`는 **없다**. reject에서도 `explore()`는 resolve한다.
//   ② 정산 권한은 리듀서다 — `RESOLVE_AI_EVENT`는 `EVENT_PENDING`에서만 적용되고
//      그 밖에서는 **같은 참조**를 돌려준다(dismiss/리로드 뒤 도착한 응답이 무해해진다).
//      `bootstrapHandlers`의 `restorableMode`는 `event_pending`을 언제나 접는다.
//   ③ `TokenQuotaManager`는 읽기/쓰기 모두 fail-closed — 못 세면 안 보낸다(§6 D3).
//   ④ 준비 중 화면은 `EVENT_PENDING` 모드가 고르고(플래그가 아니다) 탐험/이동 버튼을
//      내리지 않는다 — 예전 조건(`EVENT && isAiThinking`)은 미지의 상태에서 idle 버튼
//      트리로 낙하했다.
// ─────────────────────────────────────────────────────────────────────────────

const clone = (value) => structuredClone(value);

/** AI 경로까지 흘러가는 탐험 픽스처 — 체인·캠프파이어·보스·스카우트·bounded를 전부 비껴간다. */
const aiPathPlayer = () => ({
    ...clone(INITIAL_STATE.player),
    loc: '고요한 숲',
    hp: 80,
    mp: 20,
    stats: {
        ...clone(INITIAL_STATE.player.stats),
        explores: 1,
        exploreState: { ...clone(INITIAL_STATE.player.stats.exploreState), sinceNarrativeEvent: 1 },
    },
    // 체인 트리거는 AI 이벤트보다 우선한다 — 이 지역의 체인 스텝을 이미 지난 상태로 둔다.
    eventChainProgress: { lost_wizard: 99 },
    // 원정이 없어야 bounded encounter 선택(같은 롤의 앞단)이 비활성이다.
    activeExpedition: undefined,
});

/** `AI_SERVICE.generateEvent`를 스텁으로 바꿔 `explore()` 1회를 돌리고 dispatch 열을 돌려준다. */
const runExplore = async (generateEvent) => {
    const dispatches = [];
    const logs = [];
    const original = AI_SERVICE.generateEvent;
    AI_SERVICE.generateEvent = generateEvent;
    try {
        const actions = createExploreActions({
            player: aiPathPlayer(),
            gameState: GS.IDLE,
            uid: 'test-user',
            dispatch: (action) => dispatches.push(action),
            addLog: (type, text) => logs.push({ type, text }),
            addStoryLog: () => {},
            getFullStats: () => ({ maxHp: 100, maxMp: 50 }),
            // 0.99/0.99는 캠프파이어·스카우트를 비껴가고, 0은 내러티브 이벤트 롤을 통과시킨다.
            rng: (() => {
                const rolls = [0.99, 0.99, 0, 0];
                return () => rolls.shift() ?? 0.99;
            })(),
        }, { commitExploreOutcome: () => {} });
        await actions.explore();
    } finally {
        AI_SERVICE.generateEvent = original;
    }
    return { dispatches, logs, types: dispatches.map((action) => action.type) };
};

// ── ① explore()의 AI 경로 dispatch 열 ────────────────────────────────────────

test('AI 이벤트가 오면 BEGIN_AI_EVENT → RESOLVE_AI_EVENT{event}로 끝난다', async () => {
    const event = { desc: '갈림길에 선 나그네', choices: ['왼쪽', '오른쪽'], outcomes: [] };
    const { dispatches, logs, types } = await runExplore(async () => event);

    assert.deepEqual(types, [AT.BEGIN_AI_EVENT, AT.RESOLVE_AI_EVENT, AT.SET_AI_THINKING]);
    assert.equal(dispatches[1].payload.event.desc, event.desc);
    assert.deepEqual(logs, [{ type: 'event', text: event.desc }]);
});

test('AI가 아무것도 돌려주지 않으면 RESOLVE_AI_EVENT{event: null}로 조용히 닫힌다', async () => {
    const { dispatches, logs, types } = await runExplore(async () => null);

    assert.deepEqual(types, [AT.BEGIN_AI_EVENT, AT.RESOLVE_AI_EVENT, AT.SET_AI_THINKING]);
    assert.deepEqual(dispatches[1].payload, { event: null });
    assert.deepEqual(logs, [{ type: 'info', text: MSG.EXPLORE_NOTHING }]);
});

test('generateEvent가 reject해도 explore()는 resolve하고 준비 중을 닫는다 — 라이브 벽돌의 자리', async () => {
    const { dispatches, logs, types } = await runExplore(async () => {
        throw new Error('quota storage corrupted');
    });

    assert.deepEqual(types, [AT.BEGIN_AI_EVENT, AT.RESOLVE_AI_EVENT, AT.SET_AI_THINKING]);
    assert.deepEqual(dispatches[1].payload, { event: null });
    assert.deepEqual(
        logs.filter((log) => log.type === 'error'),
        [{ type: 'error', text: MSG.AI_EVENT_FAILED }],
        'error 로그 1건 — 플레이어는 탐험이 왜 조용히 끝났는지 알아야 한다',
    );
});

test('AI 경로의 어떤 결과에서도 gameState를 직접 event로 세우지 않는다', async () => {
    const cases = [
        async () => ({ desc: '갈림길', choices: ['가', '나'], outcomes: [] }),
        async () => null,
        async () => { throw new Error('boom'); },
    ];
    for (const generateEvent of cases) {
        const { dispatches } = await runExplore(generateEvent);
        const leaks = dispatches.filter((action) => (
            action.type === AT.SET_GAME_STATE && action.payload === GS.EVENT
        ));
        assert.deepEqual(
            leaks, [],
            'AI 경로의 상태 전이는 BEGIN/RESOLVE 두 전이가 소유한다 — 직접 EVENT를 세우면 9.5초짜리 창이 돌아온다',
        );
    }
});

// ── ② 정산 권한은 리듀서 ─────────────────────────────────────────────────────

const EVENT = { desc: '늦게 도착한 이야기', choices: ['가', '나'], outcomes: [] };
const stateWith = (overrides) => ({ ...clone(INITIAL_STATE), ...overrides });

test('BEGIN_AI_EVENT는 준비 중 모드를 세우고 남은 카드를 비운다', () => {
    const next = gameReducer(
        stateWith({ gameState: GS.IDLE, currentEvent: EVENT }),
        { type: AT.BEGIN_AI_EVENT },
    );
    assert.equal(next.gameState, GS.EVENT_PENDING);
    assert.equal(next.currentEvent, null);
    assert.equal(next.isAiThinking, true);
});

test('RESOLVE_AI_EVENT는 준비 중에서만 적용된다', () => {
    const opened = gameReducer(
        stateWith({ gameState: GS.EVENT_PENDING, isAiThinking: true }),
        { type: AT.RESOLVE_AI_EVENT, payload: { event: EVENT } },
    );
    assert.equal(opened.gameState, GS.EVENT);
    assert.equal(opened.currentEvent.desc, EVENT.desc);
    assert.equal(opened.isAiThinking, false);

    const closed = gameReducer(
        stateWith({ gameState: GS.EVENT_PENDING, isAiThinking: true }),
        { type: AT.RESOLVE_AI_EVENT, payload: { event: null } },
    );
    assert.equal(closed.gameState, GS.IDLE);
    assert.equal(closed.currentEvent, null);
    assert.equal(closed.isAiThinking, false);
});

test('준비 중이 아닌 상태에 도착한 응답은 버려진다 — 같은 참조를 돌려준다', () => {
    // dismiss 뒤(idle): 예전 구조라면 SET_EVENT가 idle 위에 고아 카드를 얹었다.
    const idle = stateWith({ gameState: GS.IDLE, currentEvent: null });
    assert.equal(
        gameReducer(idle, { type: AT.RESOLVE_AI_EVENT, payload: { event: EVENT } }), idle,
        'idle에 도착한 응답은 상태를 바꾸지 않는다(동일 참조 = no-op)',
    );

    // 이미 다른 카드가 열려 있는 event: 늦은 응답이 그 카드를 덮어쓰면 안 된다.
    const openCard = { desc: '이미 열린 카드', choices: ['가'], outcomes: [] };
    const event = stateWith({ gameState: GS.EVENT, currentEvent: openCard });
    assert.equal(
        gameReducer(event, { type: AT.RESOLVE_AI_EVENT, payload: { event: EVENT } }), event,
        'event에 도착한 응답은 열려 있는 카드를 덮지 않는다',
    );
});

// ── ③ 쿼터 미터는 fail-closed ────────────────────────────────────────────────

const withLocalStorage = async (localStorage, fn) => {
    const hadOwn = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');
    const original = globalThis.localStorage;
    globalThis.localStorage = localStorage;
    try {
        return await fn();
    } finally {
        if (hadOwn) globalThis.localStorage = original;
        else delete globalThis.localStorage;
    }
};

const workingStore = () => {
    const store = new Map();
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
};

const EVENT_CONTEXT = {
    playerSnapshot: { level: 5, maxHp: 200, maxMp: 100 },
    mapSnapshot: { level: 3 },
};

test('파손된 쿼터 레코드에서 canMakeAICall은 false이고 generateEvent는 resolve한다', async () => {
    const storage = workingStore();
    storage.setItem(TokenQuotaManager.QUOTA_KEY, '{corrupt');
    await withLocalStorage(storage, async () => {
        assert.equal(TokenQuotaManager.canMakeAICall(), false, '못 세면 보내지 않는다');
        assert.equal(TokenQuotaManager.getCallLedger(), null, '읽기 실패는 원장도 없다는 뜻이다');
        await assert.doesNotReject(
            () => AI_SERVICE.generateEvent('고요한 숲', [], 'uid', EVENT_CONTEXT),
            'JSON.parse 예외가 호출자의 await로 올라오면 안 된다',
        );
    });
});

test('저장소 접근 자체가 던져도 canMakeAICall은 false이고 generateEvent는 resolve한다', async () => {
    const throwing = {
        getItem: () => { throw new Error('SecurityError: cookies blocked'); },
        setItem: () => { throw new Error('SecurityError: cookies blocked'); },
        removeItem: () => {},
        clear: () => {},
    };
    await withLocalStorage(throwing, async () => {
        assert.equal(TokenQuotaManager.canMakeAICall(), false);
        assert.equal(TokenQuotaManager.getQuotaData().used, 0, '실패는 빈 하루 레코드로 접힌다');
        await assert.doesNotReject(() => AI_SERVICE.generateEvent('고요한 숲', [], 'uid', EVENT_CONTEXT));
    });
});

test('읽기가 멀쩡하면 게이트는 평소대로 열린다 (fail-closed가 항상 닫혀 있는 게 아니다)', async () => {
    await withLocalStorage(workingStore(), () => {
        assert.equal(TokenQuotaManager.canMakeAICall(), true);
        TokenQuotaManager.recordCall();
        assert.equal(TokenQuotaManager.getQuotaData().used, 1);
    });
});

// 이 케이스는 모듈 스코프의 "마지막 쓰기 성공 여부"를 건드리므로 **파일의 마지막**에 둔다
// (끝에서 정상 쓰기로 되돌린다 — 되돌리지 않으면 뒤 테스트의 게이트가 전부 닫힌다).
test('쓰기가 실패하면 미터를 적을 수 없으므로 게이트가 닫힌다', async () => {
    const readOnly = {
        getItem: () => null,
        setItem: () => { throw new Error('QuotaExceededError'); },
        removeItem: () => {},
        clear: () => {},
    };
    await withLocalStorage(readOnly, () => {
        assert.doesNotThrow(() => TokenQuotaManager.recordCall(), '쓰기 실패도 던지지 않는다');
        assert.equal(TokenQuotaManager.canMakeAICall(), false, '적을 수 없으면 보내지 않는다');
    });
    // 복구: 정상 저장소에서 한 번 쓰면 다시 건강해진다.
    await withLocalStorage(workingStore(), () => {
        TokenQuotaManager.writeQuota(TokenQuotaManager.getQuotaData());
        assert.equal(TokenQuotaManager.canMakeAICall(), true);
    });
});

// ── ④ 준비 중 화면 ───────────────────────────────────────────────────────────

const NOOP_ACTIONS = new Proxy({}, { get: () => () => {} });

const renderControlPanel = (overrides) => renderStatic(createElement(ControlPanel, {
    gameState: GS.IDLE,
    player: makePlayerFixture({ loc: '고요한 숲' }),
    enemy: null,
    actions: NOOP_ACTIONS,
    setGameState: () => {},
    shopItems: [],
    grave: null,
    isAiThinking: false,
    currentEvent: null,
    stats: null,
    onOpenArchiveConsole: () => {},
    ...overrides,
}));

test('ControlPanel: event_pending은 준비 중 문구를 그리고 탐험/이동 버튼을 내리지 않는다', () => {
    const html = renderControlPanel({ gameState: GS.EVENT_PENDING });

    // 낙하 단언을 먼저 둔다 — 조건을 `EVENT && isAiThinking`으로 되돌리면 준비 중은
    //   미지의 상태가 되어 **idle 버튼 트리로 떨어진다**(실측: control-explore/move가
    //   그대로 렌더된다. "이동"을 누르면 MOVING 위로 AI 응답이 떨어진다).
    assert.ok(
        !html.includes('data-testid="control-explore"'),
        '준비 중에 탐험 버튼이 보이면 응답이 다른 상태 위에 떨어진다(미지의 상태 → idle 트리 낙하)',
    );
    assert.ok(!html.includes('data-testid="control-move"'), '준비 중에 이동 버튼도 없다');
    assert.ok(html.includes(MSG.AI_EVENT_PREPARING), '준비 중 문구는 MSG 소유다');
});

test('ControlPanel: 준비 중 판정은 isAiThinking이 아니라 모드다', () => {
    // 전투/퀘스트 내러티브(addStoryLog)도 isAiThinking을 세운다 — 그 창에 열린 카드는
    // 준비 중 패널에 가려지면 안 된다(실측: 최대 9.5초).
    const html = renderControlPanel({
        gameState: GS.EVENT,
        isAiThinking: true,
        currentEvent: { desc: '체인 이벤트가 열렸다', choices: ['가', '나'], outcomes: [] },
    });
    assert.ok(!html.includes(MSG.AI_EVENT_PREPARING), '내러티브 생성 중이어도 카드가 우선한다');
    assert.ok(html.includes('체인 이벤트가 열렸다'), 'EventPanel이 그려진다');
});

test('ControlPanel: event + 이벤트는 그대로 EventPanel이다', () => {
    const html = renderControlPanel({
        gameState: GS.EVENT,
        currentEvent: { desc: '갈림길에 선 나그네', choices: ['왼쪽', '오른쪽'], outcomes: [] },
    });
    assert.ok(html.includes('갈림길에 선 나그네'));
    assert.ok(!html.includes(MSG.AI_EVENT_PREPARING));
});
