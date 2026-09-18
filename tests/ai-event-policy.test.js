import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Wave 11 C3 — AI 이벤트/스토리 폴백 판정 결정표.
 *
 * `services/aiService.ts`는 fetch/AbortController/타이머/firebase를 들고 있어 판정만
 * 따로 칠 수 없었다(9개 테스트가 서비스 *주변*만 친다). 판정을 `platform/aiEventPolicy.ts`
 * 순수 전이로 옮겼으므로, 여기서는 **입력 조합 → 기대 결정**을 한 표로 열거한다.
 * 어떤 셀이 깨졌는지 즉시 보이는 것이 이 파일의 목적이다.
 *
 * 네트워크·타이머·localStorage 없음 — 쿼터는 입력(`readQuota()`)으로만 들어온다.
 */

import {
    decideAiEventRequest,
    getEventFallbackAnnotation,
    resolveAiEventPackage,
    resolveAiEventResponse,
    resolveAiStoryResponse,
} from '../src/platform/aiEventPolicy.ts';
import { MSG } from '../src/data/messages.ts';
import { TokenQuotaManager } from '../src/systems/TokenQuotaManager.ts';

/** 프록시 트랙 — 서비스(aiService.ts AI_PROXY_TRACKS)가 넘기는 실제 값과 같은 모양. */
const EVENT_TRACK = ['ai-event', 9500];
const STORY_TRACK = ['ai-story', 9500];

const EXHAUSTED_MESSAGE = TokenQuotaManager.getExhaustedMessage();

/** 쿼터 관측을 세는 스텁 — "mock 런타임에서는 쿼터를 읽지 않는다"를 검증하기 위해 호출 수를 센다. */
const quotaProbe = (exhausted) => {
    const probe = { reads: 0 };
    probe.readQuota = () => {
        probe.reads += 1;
        return { exhausted, exhaustedMessage: EXHAUSTED_MESSAGE };
    };
    return probe;
};

const makeInput = ({ requestKind, mockRuntime, proxyEnabled, quotaExhausted }) => {
    const probe = quotaProbe(quotaExhausted);
    return {
        probe,
        input: {
            requestKind,
            mockRuntime,
            proxyEnabled,
            readQuota: probe.readQuota,
            track: requestKind === 'event' ? EVENT_TRACK : STORY_TRACK,
        },
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. 요청 결정표 — (requestKind × mockRuntime × quotaExhausted × proxyEnabled) 16셀
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 각 행: 입력 4축 → 기대 결정.
 * 분기 순서(mock → 쿼터 → 프록시 플래그)가 곧 폴백 이유다 — 특히 "쿼터 소진 + 프록시
 * 비활성"은 `quota`가 이긴다(이벤트 카드에 쿼터 안내를 실어야 하므로).
 */
const REQUEST_DECISION_TABLE = [
    // requestKind, mockRuntime, quotaExhausted, proxyEnabled, expected
    ['event', false, false, true,  { kind: 'call', requestKind: 'event', trackLabel: 'ai-event', timeoutMs: 9500 }],
    ['event', false, false, false, { kind: 'fallback', reason: 'proxy-disabled' }],
    ['event', false, true,  true,  { kind: 'fallback', reason: 'quota', message: EXHAUSTED_MESSAGE }],
    ['event', false, true,  false, { kind: 'fallback', reason: 'quota', message: EXHAUSTED_MESSAGE }],
    ['event', true,  false, true,  { kind: 'fallback', reason: 'mock-runtime' }],
    ['event', true,  false, false, { kind: 'fallback', reason: 'mock-runtime' }],
    ['event', true,  true,  true,  { kind: 'fallback', reason: 'mock-runtime' }],
    ['event', true,  true,  false, { kind: 'fallback', reason: 'mock-runtime' }],
    ['story', false, false, true,  { kind: 'call', requestKind: 'story', trackLabel: 'ai-story', timeoutMs: 9500 }],
    ['story', false, false, false, { kind: 'fallback', reason: 'proxy-disabled' }],
    ['story', false, true,  true,  { kind: 'fallback', reason: 'quota', message: EXHAUSTED_MESSAGE }],
    ['story', false, true,  false, { kind: 'fallback', reason: 'quota', message: EXHAUSTED_MESSAGE }],
    ['story', true,  false, true,  { kind: 'fallback', reason: 'mock-runtime' }],
    ['story', true,  false, false, { kind: 'fallback', reason: 'mock-runtime' }],
    ['story', true,  true,  true,  { kind: 'fallback', reason: 'mock-runtime' }],
    ['story', true,  true,  false, { kind: 'fallback', reason: 'mock-runtime' }],
];

test(`decideAiEventRequest: 요청 결정표 ${REQUEST_DECISION_TABLE.length}셀 (kind × mock × quota × proxy)`, () => {
    for (const [requestKind, mockRuntime, quotaExhausted, proxyEnabled, expected] of REQUEST_DECISION_TABLE) {
        const { input } = makeInput({ requestKind, mockRuntime, proxyEnabled, quotaExhausted });
        const label = `${requestKind} mock=${mockRuntime} quota_exhausted=${quotaExhausted} proxy=${proxyEnabled}`;
        assert.deepEqual(decideAiEventRequest(input), expected, label);
    }
});

test('decideAiEventRequest: mock 런타임에서는 쿼터를 읽지 않는다 (localStorage 없는 smoke/e2e 경로 보존)', () => {
    for (const requestKind of ['event', 'story']) {
        const mocked = makeInput({ requestKind, mockRuntime: true, proxyEnabled: true, quotaExhausted: false });
        decideAiEventRequest(mocked.input);
        assert.equal(mocked.probe.reads, 0, `${requestKind}: mock 런타임은 쿼터 관측 0회`);

        const online = makeInput({ requestKind, mockRuntime: false, proxyEnabled: false, quotaExhausted: false });
        decideAiEventRequest(online.input);
        assert.equal(online.probe.reads, 1, `${requestKind}: 프록시가 꺼져 있어도 쿼터는 1회 읽는다`);
    }
});

test('decideAiEventRequest: call 결정은 트랙(라벨/타임아웃)을 그대로 실어 돌려준다 — 9.5s 계약', () => {
    const { input } = makeInput({ requestKind: 'event', mockRuntime: false, proxyEnabled: true, quotaExhausted: false });
    const decision = decideAiEventRequest(input);
    assert.equal(decision.kind, 'call');
    assert.equal(decision.trackLabel, 'ai-event');
    assert.equal(decision.timeoutMs, 9500, 'CLAUDE.md §6 AI 이벤트 생성 9.5s 타임아웃');

    const story = makeInput({ requestKind: 'story', mockRuntime: false, proxyEnabled: true, quotaExhausted: false });
    assert.deepEqual(decideAiEventRequest(story.input), {
        kind: 'call', requestKind: 'story', trackLabel: 'ai-story', timeoutMs: 9500,
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 표면화되는 fallbackReason — 'quota' 하나뿐
// ─────────────────────────────────────────────────────────────────────────────

/** 각 폴백 이유가 이벤트 패키지에 표시를 남기는가. 남기는 것은 'quota' 하나다. */
const ANNOTATION_TABLE = [
    [{ kind: 'fallback', reason: 'mock-runtime' }, null],
    [{ kind: 'fallback', reason: 'proxy-disabled' }, null],
    [{ kind: 'fallback', reason: 'proxy-unavailable' }, null],
    [{ kind: 'fallback', reason: 'proxy-rejected' }, null],
    [{ kind: 'fallback', reason: 'malformed-response' }, null],
    [{ kind: 'fallback', reason: 'recent-duplicate' }, null],
    [{ kind: 'call', requestKind: 'event', trackLabel: 'ai-event', timeoutMs: 9500 }, null],
    [
        { kind: 'fallback', reason: 'quota', message: EXHAUSTED_MESSAGE },
        { fallbackReason: 'quota', fallbackMessage: EXHAUSTED_MESSAGE },
    ],
];

test(`getEventFallbackAnnotation: 표면화되는 fallbackReason은 'quota' 하나 (${ANNOTATION_TABLE.length}셀)`, () => {
    for (const [decision, expected] of ANNOTATION_TABLE) {
        const label = decision.kind === 'call' ? 'call' : decision.reason;
        assert.deepEqual(getEventFallbackAnnotation(decision), expected, label);
    }
});

test("getEventFallbackAnnotation: 쿼터 안내 문구는 MSG 소유 — 정책은 입력받은 문자열을 그대로 싣는다", () => {
    assert.equal(EXHAUSTED_MESSAGE, MSG.AI_QUOTA_EXHAUSTED, 'TokenQuotaManager.getExhaustedMessage()는 MSG 문구다');

    const annotation = getEventFallbackAnnotation({ kind: 'fallback', reason: 'quota', message: MSG.AI_QUOTA_EXHAUSTED });
    assert.equal(annotation.fallbackMessage, MSG.AI_QUOTA_EXHAUSTED);

    // message가 없는 quota 결정은 표시를 만들지 않는다(빈 문자열은 그대로 실린다 — 기존 동작).
    assert.equal(getEventFallbackAnnotation({ kind: 'fallback', reason: 'quota' }), null);
    assert.deepEqual(getEventFallbackAnnotation({ kind: 'fallback', reason: 'quota', message: '' }), {
        fallbackReason: 'quota', fallbackMessage: '',
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 이벤트 응답 해석표 — 성공/거절/불통(타임아웃·네트워크·!ok) + 쿼터 소모 시점
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `callProxy`의 반환값(raw) → 해석.
 * fetch 예외 · AbortError(9.5s 타임아웃) · `!response.ok`는 모두 `null`로 접혀 오므로
 * 이 경계에서는 구분되지 않는다 — 세 줄이 같은 결정으로 모이는 것이 계약이다.
 */
const EVENT_RESPONSE_TABLE = [
    ['타임아웃(AbortError) → callProxy null', null, { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false }],
    ['네트워크 예외 → callProxy null', null, { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false }],
    ['!response.ok → callProxy null', null, { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false }],
    ['undefined 응답', undefined, { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false }],
    ['객체가 아닌 응답(문자열)', 'nope', { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false }],
    ['객체가 아닌 응답(숫자)', 42, { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false }],
    ['success 누락', {}, { kind: 'fallback', reason: 'proxy-rejected', recordCall: false }],
    ['success:false', { success: false }, { kind: 'fallback', reason: 'proxy-rejected', recordCall: false }],
    ['success:false + data 있음', { success: false, data: { desc: 'x' } }, { kind: 'fallback', reason: 'proxy-rejected', recordCall: false }],
    ['success:true + data', { success: true, data: { desc: '유적이 빛난다' } }, { kind: 'payload', data: { desc: '유적이 빛난다' }, recordCall: true }],
    ['success:true + data 누락', { success: true }, { kind: 'payload', data: undefined, recordCall: true }],
];

test(`resolveAiEventResponse: 응답 해석표 ${EVENT_RESPONSE_TABLE.length}행`, () => {
    for (const [label, raw, expected] of EVENT_RESPONSE_TABLE) {
        assert.deepEqual(resolveAiEventResponse(raw), expected, label);
    }
});

test('resolveAiEventResponse: success 응답은 패키지가 떨어져도 쿼터 1회를 소모한다 (기존 동작 보존)', () => {
    const accepted = resolveAiEventResponse({ success: true, data: { desc: 'ok' } });
    assert.equal(accepted.recordCall, true);

    // 소모 여부는 응답 단계에서 확정된다 — 아래 패키지 검증 결과와 무관하다.
    for (const verdictInput of [{ built: false, recentDuplicate: false }, { built: true, recentDuplicate: true }]) {
        assert.equal(resolveAiEventPackage(verdictInput).kind, 'fallback');
    }
    assert.equal(accepted.recordCall, true, 'success 응답의 recordCall은 검증 결과에 영향받지 않는다');
});

/** 정규화된 패키지 채택 판정 — malformed(=buildEventPackage null) / 최근 중복 / 채택. */
const EVENT_PACKAGE_TABLE = [
    [{ built: false, recentDuplicate: false }, { kind: 'fallback', reason: 'malformed-response' }],
    [{ built: false, recentDuplicate: true }, { kind: 'fallback', reason: 'malformed-response' }],
    [{ built: true, recentDuplicate: true }, { kind: 'fallback', reason: 'recent-duplicate' }],
    [{ built: true, recentDuplicate: false }, { kind: 'accept' }],
];

test(`resolveAiEventPackage: 패키지 채택표 ${EVENT_PACKAGE_TABLE.length}셀 (built × recentDuplicate)`, () => {
    for (const [input, expected] of EVENT_PACKAGE_TABLE) {
        assert.deepEqual(resolveAiEventPackage(input), expected,
            `built=${input.built} duplicate=${input.recentDuplicate}`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. 스토리 응답 해석표 — 이벤트와 쿼터 소모 시점이 비대칭
// ─────────────────────────────────────────────────────────────────────────────

const STORY_RESPONSE_TABLE = [
    ['타임아웃/네트워크/!ok → null', null, { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false }],
    ['undefined 응답', undefined, { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false }],
    ['객체가 아닌 응답', '내러티브', { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false }],
    ['success 누락', { data: { narrative: '용사가 이겼다' } }, { kind: 'fallback', reason: 'proxy-rejected', recordCall: false }],
    ['success:false', { success: false, data: { narrative: '용사가 이겼다' } }, { kind: 'fallback', reason: 'proxy-rejected', recordCall: false }],
    ['success:true + data 누락', { success: true }, { kind: 'fallback', reason: 'malformed-response', recordCall: false }],
    ['success:true + narrative 누락', { success: true, data: {} }, { kind: 'fallback', reason: 'malformed-response', recordCall: false }],
    ['success:true + narrative가 문자열 아님(객체)', { success: true, data: { narrative: { text: 'x' } } }, { kind: 'fallback', reason: 'malformed-response', recordCall: false }],
    ['success:true + narrative가 문자열 아님(숫자)', { success: true, data: { narrative: 7 } }, { kind: 'fallback', reason: 'malformed-response', recordCall: false }],
    ['success:true + data가 문자열', { success: true, data: '용사가 이겼다' }, { kind: 'fallback', reason: 'malformed-response', recordCall: false }],
    ['success:true + narrative 문자열', { success: true, data: { narrative: '용사가 결정타를 날렸다!' } }, { kind: 'narrative', narrative: '용사가 결정타를 날렸다!', recordCall: true }],
    ['success:true + 빈 narrative 문자열', { success: true, data: { narrative: '' } }, { kind: 'narrative', narrative: '', recordCall: true }],
];

test(`resolveAiStoryResponse: 응답 해석표 ${STORY_RESPONSE_TABLE.length}행`, () => {
    for (const [label, raw, expected] of STORY_RESPONSE_TABLE) {
        assert.deepEqual(resolveAiStoryResponse(raw), expected, label);
    }
});

test('쿼터 소모 시점 비대칭: 이벤트는 success에서, 스토리는 narrative 확인 뒤에 기록한다 (발견, 동작 보존)', () => {
    const raw = { success: true, data: {} };
    assert.equal(resolveAiEventResponse(raw).recordCall, true, '이벤트: success만으로 소모');
    assert.equal(resolveAiStoryResponse(raw).recordCall, false, '스토리: narrative가 없으면 소모하지 않음');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. 이유 집합이 닫혀 있는가 — 표가 모든 reason을 덮는지
// ─────────────────────────────────────────────────────────────────────────────

test('폴백 이유 7종이 모두 표에 나타난다 (새 이유를 추가하면 이 테스트가 먼저 깨진다)', () => {
    const seen = new Set();
    for (const [, , , , expected] of REQUEST_DECISION_TABLE) {
        if (expected.kind === 'fallback') seen.add(expected.reason);
    }
    for (const [, , expected] of EVENT_RESPONSE_TABLE) {
        if (expected.kind === 'fallback') seen.add(expected.reason);
    }
    for (const [, expected] of EVENT_PACKAGE_TABLE) {
        if (expected.kind === 'fallback') seen.add(expected.reason);
    }
    for (const [, , expected] of STORY_RESPONSE_TABLE) {
        if (expected.kind === 'fallback') seen.add(expected.reason);
    }

    assert.deepEqual([...seen].sort(), [
        'malformed-response',
        'mock-runtime',
        'proxy-disabled',
        'proxy-rejected',
        'proxy-unavailable',
        'quota',
        'recent-duplicate',
    ]);
});

test('정책은 IO를 하지 않는다 — fetch/타이머/localStorage가 전부 터져도 판정은 돌아간다', () => {
    const explode = () => { throw new Error('policy must not do IO'); };
    const saved = {
        fetch: globalThis.fetch,
        localStorage: globalThis.localStorage,
        setTimeout: globalThis.setTimeout,
    };
    globalThis.fetch = explode;
    globalThis.localStorage = { getItem: explode, setItem: explode };
    globalThis.setTimeout = explode;
    try {
        const { input } = makeInput({ requestKind: 'event', mockRuntime: false, proxyEnabled: true, quotaExhausted: false });
        assert.equal(decideAiEventRequest(input).kind, 'call');
        assert.equal(resolveAiEventResponse({ success: true, data: {} }).kind, 'payload');
        assert.equal(resolveAiEventPackage({ built: true, recentDuplicate: false }).kind, 'accept');
        assert.equal(resolveAiStoryResponse({ success: true, data: { narrative: 'ok' } }).kind, 'narrative');
        assert.equal(getEventFallbackAnnotation({ kind: 'fallback', reason: 'proxy-disabled' }), null);
    } finally {
        globalThis.fetch = saved.fetch;
        globalThis.setTimeout = saved.setTimeout;
        if (saved.localStorage === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = saved.localStorage;
    }
});

test('결정은 결정적이다 — 같은 입력이면 같은 결정(정책은 상태를 갖지 않는다)', () => {
    for (const [requestKind, mockRuntime, quotaExhausted, proxyEnabled, expected] of REQUEST_DECISION_TABLE) {
        const first = makeInput({ requestKind, mockRuntime, proxyEnabled, quotaExhausted });
        const second = makeInput({ requestKind, mockRuntime, proxyEnabled, quotaExhausted });
        assert.deepEqual(decideAiEventRequest(first.input), expected);
        assert.deepEqual(decideAiEventRequest(second.input), decideAiEventRequest(first.input));
    }
});
