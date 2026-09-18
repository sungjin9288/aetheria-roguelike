import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Wave 11 C3 + Wave 12 D3 — AI 이벤트/스토리 폴백 판정 결정표.
 *
 * `services/aiService.ts`는 fetch/AbortController/타이머/firebase를 들고 있어 판정만
 * 따로 칠 수 없었다(9개 테스트가 서비스 *주변*만 친다). 판정을 `platform/aiEventPolicy.ts`
 * 순수 전이로 옮겼으므로, 여기서는 **입력 조합 → 기대 결정**을 한 표로 열거한다.
 * 어떤 셀이 깨졌는지 즉시 보이는 것이 이 파일의 목적이다.
 *
 * W12-D3가 더한 축은 **쿼터 회계**다. 쿼터는 "디스패치(프록시로 나간 요청)"를 세는
 * 비용 미터이므로 `recordCall`은 요청 결정에만 있고(§16 D3), 응답 해석은 이미 쓴 1건이
 * 어떻게 끝났는지(`outcome`)만 돌려준다. 표의 각 행은 그 두 값을 함께 고정한다.
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

// 이 파일은 localStorage를 스텁하지 않는다 — 소진 안내는 원장을 읽을 수 없으면 기본 문구로
// 접히므로(TokenQuotaManager.getCallLedger → null), 여기서는 항상 MSG.AI_QUOTA_EXHAUSTED다.
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
 *
 * W12-D3: 각 셀이 `recordCall`을 함께 고정한다. 쿼터 1건이 빠져나가는 지점은 이 표의
 * `kind: 'call'` 행뿐이고, 폴백 3종은 요청을 보내지 않으므로 전부 `recordCall: false`다.
 */
const REQUEST_DECISION_TABLE = [
    // requestKind, mockRuntime, quotaExhausted, proxyEnabled, expected
    ['event', false, false, true,  { kind: 'call', requestKind: 'event', trackLabel: 'ai-event', timeoutMs: 9500, recordCall: true }],
    ['event', false, false, false, { kind: 'fallback', reason: 'proxy-disabled', recordCall: false }],
    ['event', false, true,  true,  { kind: 'fallback', reason: 'quota', message: EXHAUSTED_MESSAGE, recordCall: false }],
    ['event', false, true,  false, { kind: 'fallback', reason: 'quota', message: EXHAUSTED_MESSAGE, recordCall: false }],
    ['event', true,  false, true,  { kind: 'fallback', reason: 'mock-runtime', recordCall: false }],
    ['event', true,  false, false, { kind: 'fallback', reason: 'mock-runtime', recordCall: false }],
    ['event', true,  true,  true,  { kind: 'fallback', reason: 'mock-runtime', recordCall: false }],
    ['event', true,  true,  false, { kind: 'fallback', reason: 'mock-runtime', recordCall: false }],
    ['story', false, false, true,  { kind: 'call', requestKind: 'story', trackLabel: 'ai-story', timeoutMs: 9500, recordCall: true }],
    ['story', false, false, false, { kind: 'fallback', reason: 'proxy-disabled', recordCall: false }],
    ['story', false, true,  true,  { kind: 'fallback', reason: 'quota', message: EXHAUSTED_MESSAGE, recordCall: false }],
    ['story', false, true,  false, { kind: 'fallback', reason: 'quota', message: EXHAUSTED_MESSAGE, recordCall: false }],
    ['story', true,  false, true,  { kind: 'fallback', reason: 'mock-runtime', recordCall: false }],
    ['story', true,  false, false, { kind: 'fallback', reason: 'mock-runtime', recordCall: false }],
    ['story', true,  true,  true,  { kind: 'fallback', reason: 'mock-runtime', recordCall: false }],
    ['story', true,  true,  false, { kind: 'fallback', reason: 'mock-runtime', recordCall: false }],
];

test(`decideAiEventRequest: 요청 결정표 ${REQUEST_DECISION_TABLE.length}셀 (kind × mock × quota × proxy)`, () => {
    for (const [requestKind, mockRuntime, quotaExhausted, proxyEnabled, expected] of REQUEST_DECISION_TABLE) {
        const { input } = makeInput({ requestKind, mockRuntime, proxyEnabled, quotaExhausted });
        const label = `${requestKind} mock=${mockRuntime} quota_exhausted=${quotaExhausted} proxy=${proxyEnabled}`;
        assert.deepEqual(decideAiEventRequest(input), expected, label);
    }
});

test('decideAiEventRequest: 쿼터 소모는 디스패치와 동치다 — recordCall === (kind === "call")', () => {
    for (const [requestKind, mockRuntime, quotaExhausted, proxyEnabled] of REQUEST_DECISION_TABLE) {
        const { input } = makeInput({ requestKind, mockRuntime, proxyEnabled, quotaExhausted });
        const decision = decideAiEventRequest(input);
        const label = `${requestKind} mock=${mockRuntime} quota_exhausted=${quotaExhausted} proxy=${proxyEnabled}`;
        assert.equal(decision.recordCall, decision.kind === 'call', label);
    }
});

test('decideAiEventRequest: 이벤트와 스토리의 소모 규칙이 같다 (W11 발견 6의 비대칭 마감)', () => {
    // 같은 관측 3축(mock/quota/proxy)에 대해 두 요청 종류가 같은 소모 결정을 내린다.
    for (const mockRuntime of [true, false]) {
        for (const quotaExhausted of [true, false]) {
            for (const proxyEnabled of [true, false]) {
                const axes = { mockRuntime, quotaExhausted, proxyEnabled };
                const event = decideAiEventRequest(makeInput({ requestKind: 'event', ...axes }).input);
                const story = decideAiEventRequest(makeInput({ requestKind: 'story', ...axes }).input);
                const label = `mock=${mockRuntime} quota=${quotaExhausted} proxy=${proxyEnabled}`;
                assert.equal(event.recordCall, story.recordCall, `${label}: 소모 결정 동일`);
                assert.equal(event.kind, story.kind, `${label}: 호출/폴백 결정 동일`);
            }
        }
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
        kind: 'call', requestKind: 'story', trackLabel: 'ai-story', timeoutMs: 9500, recordCall: true,
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. 표면화되는 fallbackReason — 'quota' 하나뿐
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 각 폴백 이유가 이벤트 패키지에 표시를 남기는가. 남기는 것은 'quota' 하나다.
 *
 * W12-D3 판단: 나머지 6종은 표면화하지 않는다. 셋(`mock-runtime`/`proxy-disabled`/`quota`)만이
 * 디스패치 전 결정이고 그중 `proxy-disabled`는 기본 빌드에서 **항상** 참이라
 * (CONSTANTS.USE_AI_PROXY 기본값 false — ai-service-proxy-default.test.js) 표시를 달면
 * 모든 이벤트에 붙는다. 나머지 4종은 플레이어가 취할 행동이 없는 기계 실패이고,
 * `recent-duplicate`는 폴백 쪽이 더 나은 이벤트라 안내가 오히려 거짓이 된다.
 */
const ANNOTATION_TABLE = [
    [{ kind: 'fallback', reason: 'mock-runtime', recordCall: false }, null],
    [{ kind: 'fallback', reason: 'proxy-disabled', recordCall: false }, null],
    [{ kind: 'fallback', reason: 'proxy-unavailable', recordCall: false }, null],
    [{ kind: 'fallback', reason: 'proxy-rejected', recordCall: false }, null],
    [{ kind: 'fallback', reason: 'malformed-response', recordCall: false }, null],
    [{ kind: 'fallback', reason: 'recent-duplicate', recordCall: false }, null],
    [{ kind: 'call', requestKind: 'event', trackLabel: 'ai-event', timeoutMs: 9500, recordCall: true }, null],
    [
        { kind: 'fallback', reason: 'quota', message: EXHAUSTED_MESSAGE, recordCall: false },
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
    // 원장을 읽을 수 없는 환경(localStorage 없음)에서는 기본 MSG 문구로 접힌다 — 안내 문구
    //   계산이 AI 경로를 막아서는 안 되기 때문(TokenQuotaManager.getCallLedger → null).
    assert.equal(EXHAUSTED_MESSAGE, MSG.AI_QUOTA_EXHAUSTED, 'TokenQuotaManager.getExhaustedMessage()는 MSG 문구다');

    const annotation = getEventFallbackAnnotation({ kind: 'fallback', reason: 'quota', message: MSG.AI_QUOTA_EXHAUSTED });
    assert.equal(annotation.fallbackMessage, MSG.AI_QUOTA_EXHAUSTED);

    // 정산 내역이 실린 문구(W12-D3)도 정책 입장에서는 그냥 문자열이다 — 정책은 MSG를 모른다.
    const withLedger = MSG.AI_QUOTA_EXHAUSTED_LEDGER(12, 50);
    assert.deepEqual(getEventFallbackAnnotation({ kind: 'fallback', reason: 'quota', message: withLedger }), {
        fallbackReason: 'quota', fallbackMessage: withLedger,
    });

    // message가 없는 quota 결정은 표시를 만들지 않는다(빈 문자열은 그대로 실린다 — 기존 동작).
    assert.equal(getEventFallbackAnnotation({ kind: 'fallback', reason: 'quota' }), null);
    assert.deepEqual(getEventFallbackAnnotation({ kind: 'fallback', reason: 'quota', message: '' }), {
        fallbackReason: 'quota', fallbackMessage: '',
    });
});

test('MSG.AI_QUOTA_EXHAUSTED_LEDGER: 소진 안내가 디스패치/채택 두 수를 모두 말한다', () => {
    const text = MSG.AI_QUOTA_EXHAUSTED_LEDGER(12, 50);
    assert.match(text, /50/, '디스패치 수');
    assert.match(text, /12/, '채택 수');
    assert.notEqual(text, MSG.AI_QUOTA_EXHAUSTED, '정산이 있으면 기본 문구와 달라야 한다');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. 이벤트 응답 해석표 — 성공/거절/불통(타임아웃·네트워크·!ok) + 디스패치 1건의 정산
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `callProxy`의 반환값(raw) → 해석.
 * fetch 예외 · AbortError(9.5s 타임아웃) · `!response.ok`는 모두 `null`로 접혀 오므로
 * 이 경계에서는 구분되지 않는다 — 세 줄이 같은 결정으로 모이는 것이 계약이다.
 *
 * W12-D3: `recordCall` 칸이 사라지고 `outcome` 칸이 들어왔다. 여기 도달했다는 것은
 * 요청이 이미 나갔다는 뜻이고(쿼터 1건은 소모됨), 표가 고정하는 것은 그 1건이 어떻게
 * 끝났는지다. payload 행의 `outcome: null`은 "아직 미정"으로, 다음 표가 결정한다.
 */
const EVENT_RESPONSE_TABLE = [
    ['타임아웃(AbortError) → callProxy null', null, { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' }],
    ['네트워크 예외 → callProxy null', null, { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' }],
    ['!response.ok → callProxy null', null, { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' }],
    ['undefined 응답', undefined, { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' }],
    ['객체가 아닌 응답(문자열)', 'nope', { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' }],
    ['객체가 아닌 응답(숫자)', 42, { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' }],
    ['success 누락', {}, { kind: 'fallback', reason: 'proxy-rejected', outcome: 'proxy-rejected' }],
    ['success:false', { success: false }, { kind: 'fallback', reason: 'proxy-rejected', outcome: 'proxy-rejected' }],
    ['success:false + data 있음', { success: false, data: { desc: 'x' } }, { kind: 'fallback', reason: 'proxy-rejected', outcome: 'proxy-rejected' }],
    ['success:true + data', { success: true, data: { desc: '유적이 빛난다' } }, { kind: 'payload', data: { desc: '유적이 빛난다' }, outcome: null }],
    ['success:true + data 누락', { success: true }, { kind: 'payload', data: undefined, outcome: null }],
];

test(`resolveAiEventResponse: 응답 해석표 ${EVENT_RESPONSE_TABLE.length}행`, () => {
    for (const [label, raw, expected] of EVENT_RESPONSE_TABLE) {
        assert.deepEqual(resolveAiEventResponse(raw), expected, label);
    }
});

test('응답 해석은 쿼터를 소모하지 않는다 — recordCall 필드가 아예 없다 (부재 불변식)', () => {
    for (const [label, raw] of EVENT_RESPONSE_TABLE) {
        assert.equal('recordCall' in resolveAiEventResponse(raw), false, `event ${label}`);
    }
    for (const [label, raw] of STORY_RESPONSE_TABLE) {
        assert.equal('recordCall' in resolveAiStoryResponse(raw), false, `story ${label}`);
    }
    for (const [input] of EVENT_PACKAGE_TABLE) {
        assert.equal('recordCall' in resolveAiEventPackage(input), false,
            `package built=${input.built} duplicate=${input.recentDuplicate}`);
    }
});

/** 정규화된 패키지 채택 판정 — malformed(=buildEventPackage null) / 최근 중복 / 채택. */
const EVENT_PACKAGE_TABLE = [
    [{ built: false, recentDuplicate: false }, { kind: 'fallback', reason: 'malformed-response', outcome: 'malformed-response' }],
    [{ built: false, recentDuplicate: true }, { kind: 'fallback', reason: 'malformed-response', outcome: 'malformed-response' }],
    [{ built: true, recentDuplicate: true }, { kind: 'fallback', reason: 'recent-duplicate', outcome: 'recent-duplicate' }],
    [{ built: true, recentDuplicate: false }, { kind: 'accept', outcome: 'adopted' }],
];

test(`resolveAiEventPackage: 패키지 채택표 ${EVENT_PACKAGE_TABLE.length}셀 (built × recentDuplicate)`, () => {
    for (const [input, expected] of EVENT_PACKAGE_TABLE) {
        assert.deepEqual(resolveAiEventPackage(input), expected,
            `built=${input.built} duplicate=${input.recentDuplicate}`);
    }
});

test('이벤트: 패키지가 떨어져도 그 호출은 이미 나간 1건이다 — 정산은 미채택으로 남는다', () => {
    const response = resolveAiEventResponse({ success: true, data: { desc: 'ok' } });
    assert.equal(response.outcome, null, 'payload 단계에서는 정산이 확정되지 않는다');

    // 같은 payload라도 이후 검증 결과에 따라 정산이 갈린다 — 소모 여부가 아니라 결과가 갈리는 것.
    assert.equal(resolveAiEventPackage({ built: false, recentDuplicate: false }).outcome, 'malformed-response');
    assert.equal(resolveAiEventPackage({ built: true, recentDuplicate: true }).outcome, 'recent-duplicate');
    assert.equal(resolveAiEventPackage({ built: true, recentDuplicate: false }).outcome, 'adopted');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. 스토리 응답 해석표 — 이벤트와 **같은** 정산 규칙 (W12-D3에서 비대칭 마감)
// ─────────────────────────────────────────────────────────────────────────────

const STORY_RESPONSE_TABLE = [
    ['타임아웃/네트워크/!ok → null', null, { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' }],
    ['undefined 응답', undefined, { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' }],
    ['객체가 아닌 응답', '내러티브', { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' }],
    ['success 누락', { data: { narrative: '용사가 이겼다' } }, { kind: 'fallback', reason: 'proxy-rejected', outcome: 'proxy-rejected' }],
    ['success:false', { success: false, data: { narrative: '용사가 이겼다' } }, { kind: 'fallback', reason: 'proxy-rejected', outcome: 'proxy-rejected' }],
    ['success:true + data 누락', { success: true }, { kind: 'fallback', reason: 'malformed-response', outcome: 'malformed-response' }],
    ['success:true + narrative 누락', { success: true, data: {} }, { kind: 'fallback', reason: 'malformed-response', outcome: 'malformed-response' }],
    ['success:true + narrative가 문자열 아님(객체)', { success: true, data: { narrative: { text: 'x' } } }, { kind: 'fallback', reason: 'malformed-response', outcome: 'malformed-response' }],
    ['success:true + narrative가 문자열 아님(숫자)', { success: true, data: { narrative: 7 } }, { kind: 'fallback', reason: 'malformed-response', outcome: 'malformed-response' }],
    ['success:true + data가 문자열', { success: true, data: '용사가 이겼다' }, { kind: 'fallback', reason: 'malformed-response', outcome: 'malformed-response' }],
    ['success:true + narrative 문자열', { success: true, data: { narrative: '용사가 결정타를 날렸다!' } }, { kind: 'narrative', narrative: '용사가 결정타를 날렸다!', outcome: 'adopted' }],
    ['success:true + 빈 narrative 문자열', { success: true, data: { narrative: '' } }, { kind: 'narrative', narrative: '', outcome: 'adopted' }],
];

test(`resolveAiStoryResponse: 응답 해석표 ${STORY_RESPONSE_TABLE.length}행`, () => {
    for (const [label, raw, expected] of STORY_RESPONSE_TABLE) {
        assert.deepEqual(resolveAiStoryResponse(raw), expected, label);
    }
});

/**
 * W11 발견 6이 기록한 비대칭의 정확한 마감 지점.
 * 예전: `{success:true, data:{}}`에서 이벤트는 `recordCall:true`, 스토리는 `false`였다.
 * 지금: 둘 다 쿼터를 건드리지 않고, 두 경로 모두 **디스패치 시점에 이미 1건을 썼다**.
 * 남은 차이는 "그 1건을 어떻게 정산하느냐"뿐이고 그것도 같은 어휘(`outcome`)로 말한다.
 */
const SHARED_ENVELOPE_TABLE = [
    // raw, event outcome(패키지 단계 포함 후), story outcome
    [null, 'proxy-unavailable', 'proxy-unavailable'],
    [{ success: false }, 'proxy-rejected', 'proxy-rejected'],
    // success:true + 빈 data — 이벤트는 buildEventPackage가 null을 내고, 스토리는 narrative가 없다.
    //   둘 다 'malformed-response'로 정산된다(예전에는 이 칸에서 소모 여부가 갈렸다).
    [{ success: true, data: {} }, 'malformed-response', 'malformed-response'],
];

test(`쿼터 정산 대칭표 ${SHARED_ENVELOPE_TABLE.length}행 — 같은 봉투면 두 경로가 같은 정산을 남긴다`, () => {
    for (const [raw, expectedEventOutcome, expectedStoryOutcome] of SHARED_ENVELOPE_TABLE) {
        const eventResponse = resolveAiEventResponse(raw);
        // 이벤트는 payload일 때만 패키지 단계가 정산을 정한다. 빈 data는 buildEventPackage가
        //   패키지를 만들지 못하므로 built=false로 들어온다.
        const eventOutcome = eventResponse.kind === 'payload'
            ? resolveAiEventPackage({ built: false, recentDuplicate: false }).outcome
            : eventResponse.outcome;
        assert.equal(eventOutcome, expectedEventOutcome, `event ${JSON.stringify(raw)}`);
        assert.equal(resolveAiStoryResponse(raw).outcome, expectedStoryOutcome, `story ${JSON.stringify(raw)}`);
        assert.equal(eventOutcome, resolveAiStoryResponse(raw).outcome, `대칭 ${JSON.stringify(raw)}`);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. 어휘가 닫혀 있는가 — 폴백 이유 7종 / 정산 결과 5종
// ─────────────────────────────────────────────────────────────────────────────

/** 디스패치 **전**에만 나오는 이유 — 이 셋은 어떤 정산 결과로도 나타날 수 없다. */
const PRE_DISPATCH_REASONS = ['mock-runtime', 'proxy-disabled', 'quota'];
/** 디스패치된 호출 1건이 가질 수 있는 정산 결과의 닫힌 집합. */
const CALL_OUTCOMES = ['adopted', 'malformed-response', 'proxy-rejected', 'proxy-unavailable', 'recent-duplicate'];

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

test(`정산 결과는 ${CALL_OUTCOMES.length}종으로 닫혀 있다 — 디스패치 전 이유 3종은 정산이 될 수 없다`, () => {
    const seen = new Set();
    for (const [, , expected] of EVENT_RESPONSE_TABLE) {
        if (expected.outcome !== null) seen.add(expected.outcome);
    }
    for (const [, expected] of EVENT_PACKAGE_TABLE) seen.add(expected.outcome);
    for (const [, , expected] of STORY_RESPONSE_TABLE) seen.add(expected.outcome);

    assert.deepEqual([...seen].sort(), CALL_OUTCOMES);
    for (const reason of PRE_DISPATCH_REASONS) {
        assert.equal(seen.has(reason), false, `${reason}은 디스패치 전 결정이라 정산 결과가 될 수 없다`);
    }
});

test('디스패치된 호출은 반드시 정확히 하나의 정산을 남긴다 (회계 누락 0)', () => {
    // 이벤트: 응답 해석이 정산을 주거나(fallback), payload면 패키지 단계가 반드시 준다.
    for (const [label, raw] of EVENT_RESPONSE_TABLE) {
        const response = resolveAiEventResponse(raw);
        const settled = response.kind === 'payload'
            ? [
                resolveAiEventPackage({ built: false, recentDuplicate: false }).outcome,
                resolveAiEventPackage({ built: true, recentDuplicate: true }).outcome,
                resolveAiEventPackage({ built: true, recentDuplicate: false }).outcome,
            ]
            : [response.outcome];
        for (const outcome of settled) {
            assert.ok(CALL_OUTCOMES.includes(outcome), `event ${label} → ${outcome}`);
        }
    }
    // 스토리: 응답 해석 한 단계가 항상 정산을 확정한다(null 없음).
    for (const [label, raw] of STORY_RESPONSE_TABLE) {
        const outcome = resolveAiStoryResponse(raw).outcome;
        assert.ok(CALL_OUTCOMES.includes(outcome), `story ${label} → ${outcome}`);
    }
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
