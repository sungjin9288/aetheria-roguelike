/**
 * aiEventPolicy — AI 이벤트/스토리 요청의 **판정**만 소유하는 순수 전이 (Wave 11 C3).
 *
 * `services/aiService.ts`는 그동안 "무엇을 관찰했는가"(mock 런타임 · 일일 쿼터 · 프록시
 * 플래그 · 응답 모양)와 "그래서 프록시를 부르는가, 어떤 폴백으로 접는가"를 한 덩어리로
 * 들고 있었다. firebase/fetch/타이머를 import하는 모듈이라 그 판정만 떼어 테스트할 수
 * 없었고(9개 테스트가 서비스 *주변*만 친다), `fallbackReason` 선택이 표로 열거되지 않았다.
 * 이 파일은 그 판정을 React·firebase·fetch·타이머 없이 옮겨 온 것이다.
 *
 * - **입력(`AiRequestInput`)**: 서비스가 관찰한 값 — 요청 종류, mock 런타임 여부,
 *   프록시 사용 플래그, 프록시 트랙(라벨/타임아웃), 그리고 **쿼터 읽기**.
 * - **출력(`AiEventDecision`)**: 호출(`call`) 또는 폴백(`fallback` + `reason`).
 * - **응답 해석**: `resolveAiEventResponse` / `resolveAiEventPackage` /
 *   `resolveAiStoryResponse` — 외부 산출물(`unknown`)을 이 경계에서만 좁힌다.
 *
 * 쿼터는 **상태가 아니라 입력**이다(§15 C3). `TokenQuotaManager`(localStorage IO)가
 * 단일 진실 원천으로 남고, 이 파일은 그 값을 읽기만 한다 — 여기에 사용량을 들이면
 * 진실 원천이 둘이 된다. 쿼터 읽기를 값이 아니라 `readQuota()`로 받는 이유는 현재
 * 동작 보존이다: mock 런타임(smoke/e2e/device-QA)에서는 **쿼터를 읽지 않는다**
 * (그 경로에는 localStorage가 없을 수 있다). 지연 호출일 뿐 정책은 여전히
 * 입력→출력 결정적이다.
 *
 * 한국어 문구는 이 파일에 없다 — 쿼터 소진 안내는 `TokenQuotaManager.getExhaustedMessage()`
 * (=`MSG.AI_QUOTA_EXHAUSTED`)가 소유하고 입력으로 들어온다.
 */

/** 프록시 진입점 2종 — `generateEvent`(이벤트 카드) / `generateStory`(내러티브 1줄). */
export type AiRequestKind = 'event' | 'story';

/**
 * 프록시 트랙 = [LatencyTracker 라벨, AbortController 타임아웃(ms)].
 * 둘 다 IO 설정이라 값은 서비스(fetch/타이머 소유자)가 갖고, 정책은 `call` 결정에
 * 그대로 실어 돌려준다 — 결정 이후 서비스가 표를 다시 뒤지지 않게 하기 위함이다.
 */
export type AiProxyTrack = readonly [trackLabel: string, timeoutMs: number];

/** 쿼터 관측 1회분 — `TokenQuotaManager.canMakeAICall()` / `.getExhaustedMessage()`. */
export interface AiQuotaState {
    /** `!TokenQuotaManager.canMakeAICall()` — 오늘 한도(BALANCE.DAILY_AI_LIMIT)를 다 썼는가. */
    readonly exhausted: boolean;
    /** `TokenQuotaManager.getExhaustedMessage()` — 쿼터 폴백에만 실린다. */
    readonly exhaustedMessage: string;
}

/**
 * 폴백을 고른 이유 — 현재 코드의 분기와 1:1이다.
 *
 * | reason | 출처(리팩토링 전 aiService.ts) |
 * |---|---|
 * | `mock-runtime`       | `if (isMockRuntime())` (event 147 / story 193) |
 * | `quota`              | `if (!TokenQuotaManager.canMakeAICall())` (event 151 / story 197) |
 * | `proxy-disabled`     | `if (CONSTANTS.USE_AI_PROXY)`가 거짓 (event 164 / story 218) |
 * | `proxy-unavailable`  | `callProxy`가 `null` 반환 — fetch 예외/AbortError(9.5s 타임아웃)/`!response.ok` |
 * | `proxy-rejected`     | 응답은 왔지만 `result.success`가 거짓 (event 179 / story 236) |
 * | `malformed-response` | event: `buildEventPackage`가 `null`; story: `data.narrative`가 문자열이 아님 |
 * | `recent-duplicate`   | `recentEvents.has(normalized.desc)` (event 182) |
 *
 * **표면화되는 값은 `'quota'` 하나뿐**이다 — `EventPackage.fallbackReason`(aiEventUtils)은
 * `'quota'` 리터럴이고, 나머지는 서비스 내부 분류로만 쓴다(`getEventFallbackAnnotation`).
 */
export type AiFallbackReason =
    | 'mock-runtime'
    | 'quota'
    | 'proxy-disabled'
    | 'proxy-unavailable'
    | 'proxy-rejected'
    | 'malformed-response'
    | 'recent-duplicate';

/** 요청 1건을 판정하는 데 필요한 관측의 닫힌 집합. */
export interface AiRequestInput {
    readonly requestKind: AiRequestKind;
    /** `isMockRuntime()` — smoke/e2e/device-QA 하네스. 쿼터보다 먼저 본다. */
    readonly mockRuntime: boolean;
    /** `CONSTANTS.USE_AI_PROXY`. 쿼터보다 **나중에** 본다(순서가 곧 폴백 이유다). */
    readonly proxyEnabled: boolean;
    /** 쿼터 관측 — mock 런타임에서는 호출되지 않는다. */
    readonly readQuota: () => AiQuotaState;
    /** 이 요청이 쓸 프록시 트랙. `call` 결정에 그대로 실린다. */
    readonly track: AiProxyTrack;
}

/** 프록시를 부른다. */
export interface AiCallDecision {
    readonly kind: 'call';
    readonly requestKind: AiRequestKind;
    /** LatencyTracker 라벨 (`'ai-event'` / `'ai-story'`). */
    readonly trackLabel: string;
    /** AbortController 타임아웃(ms) — §6 계약상 9500. */
    readonly timeoutMs: number;
}

/** 프록시를 부르지 않고 큐레이션 폴백으로 접는다. */
export interface AiFallbackDecision {
    readonly kind: 'fallback';
    readonly reason: AiFallbackReason;
    /** `reason === 'quota'`일 때만 채워진다(쿼터 소진 안내 문구). */
    readonly message?: string;
}

export type AiEventDecision = AiCallDecision | AiFallbackDecision;

/**
 * 요청 판정. 분기 순서는 리팩토링 전 코드 그대로다:
 * mock 런타임 → 쿼터 → 프록시 플래그 → 호출.
 *
 * 순서가 관측 가능한 지점: **쿼터 소진 + 프록시 비활성**이면 `'quota'`가 이긴다
 * (그래야 이벤트 카드에 쿼터 안내가 실린다).
 */
export const decideAiEventRequest = (input: AiRequestInput): AiEventDecision => {
    if (input.mockRuntime) return { kind: 'fallback', reason: 'mock-runtime' };

    const quota = input.readQuota();
    if (quota.exhausted) return { kind: 'fallback', reason: 'quota', message: quota.exhaustedMessage };

    if (!input.proxyEnabled) return { kind: 'fallback', reason: 'proxy-disabled' };

    const [trackLabel, timeoutMs] = input.track;
    return { kind: 'call', requestKind: input.requestKind, trackLabel, timeoutMs };
};

/** 폴백 이벤트 패키지에 덧붙일 필드 — 표면화되는 폴백 이유는 이것 하나뿐이다. */
export interface AiEventFallbackAnnotation {
    readonly fallbackReason: 'quota';
    readonly fallbackMessage: string;
}

/**
 * 이 결정이 이벤트 패키지에 표시를 남기는가. `'quota'` 폴백만 남긴다
 * (`exploreActions`가 `fallbackReason === 'quota' && fallbackMessage`로 안내 로그를 띄운다).
 */
export const getEventFallbackAnnotation = (decision: AiEventDecision): AiEventFallbackAnnotation | null => (
    decision.kind === 'fallback' && decision.reason === 'quota' && typeof decision.message === 'string'
        ? { fallbackReason: 'quota', fallbackMessage: decision.message }
        : null
);

/** 프록시 응답 봉투 — 외부(AI 백엔드) 산출물이라 형태를 신뢰하지 않는다. */
interface AiProxyEnvelope {
    readonly success?: unknown;
    readonly data?: unknown;
}

const asEnvelope = (raw: unknown): AiProxyEnvelope | null => (
    raw !== null && typeof raw === 'object' ? (raw as AiProxyEnvelope) : null
);

const asRecord = (raw: unknown): Record<string, unknown> | null => (
    raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
);

/** 프록시가 응답을 주지 못했거나(=`null`) 성공이 아닌 두 경우. */
type AiTransportFallbackReason = Extract<AiFallbackReason, 'proxy-unavailable' | 'proxy-rejected'>;

export type AiEventResponse =
    /**
     * `success`가 참 — **쿼터 1회를 여기서 소모한다**(`recordCall`). 패키지가 이후
     * 검증에서 떨어져도 소모는 되돌리지 않는다(리팩토링 전 동작 보존, aiService.ts:179-185).
     */
    | { readonly kind: 'payload'; readonly data: unknown; readonly recordCall: true }
    | { readonly kind: 'fallback'; readonly reason: AiTransportFallbackReason; readonly recordCall: false };

/**
 * 이벤트 응답 해석. `raw`는 `callProxy`의 반환값이다 —
 * fetch 예외 · AbortError(9.5s 타임아웃) · `!response.ok`는 모두 `null`로 접혀 들어오므로
 * 이 경계에서는 셋을 구분할 수 없다(= 전부 `'proxy-unavailable'`).
 */
export const resolveAiEventResponse = (raw: unknown): AiEventResponse => {
    const envelope = asEnvelope(raw);
    if (!envelope) return { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false };
    if (!envelope.success) return { kind: 'fallback', reason: 'proxy-rejected', recordCall: false };
    return { kind: 'payload', data: envelope.data, recordCall: true };
};

/** `buildEventPackage` 결과를 채택할지 — 정규화 자체는 `utils/aiEventUtils`가 소유한다. */
export interface AiEventPackageInput {
    /** `buildEventPackage(...)`가 패키지를 만들었는가(`null`이면 false). */
    readonly built: boolean;
    /** `recentEvents.has(normalized.desc)` — 최근에 이미 본 이벤트인가. */
    readonly recentDuplicate: boolean;
}

export type AiEventPackageVerdict =
    | { readonly kind: 'accept' }
    | {
        readonly kind: 'fallback';
        readonly reason: Extract<AiFallbackReason, 'malformed-response' | 'recent-duplicate'>;
    };

export const resolveAiEventPackage = (input: AiEventPackageInput): AiEventPackageVerdict => {
    if (!input.built) return { kind: 'fallback', reason: 'malformed-response' };
    if (input.recentDuplicate) return { kind: 'fallback', reason: 'recent-duplicate' };
    return { kind: 'accept' };
};

export type AiStoryResponse =
    /** `success`가 참이고 `data.narrative`가 문자열 — 이때만 쿼터를 소모한다. */
    | { readonly kind: 'narrative'; readonly narrative: string; readonly recordCall: true }
    | {
        readonly kind: 'fallback';
        readonly reason: AiTransportFallbackReason | Extract<AiFallbackReason, 'malformed-response'>;
        readonly recordCall: false;
    };

/**
 * 스토리 응답 해석. 이벤트 경로와 **쿼터 소모 시점이 다르다**: 스토리는 내러티브가
 * 문자열로 확인된 뒤에만 `recordCall`한다(aiService.ts:236-238). 이 비대칭은 발견이지
 * 의도가 아니며, 이 리팩토링은 동작을 바꾸지 않고 표에 드러내기만 한다.
 */
export const resolveAiStoryResponse = (raw: unknown): AiStoryResponse => {
    const envelope = asEnvelope(raw);
    if (!envelope) return { kind: 'fallback', reason: 'proxy-unavailable', recordCall: false };
    if (!envelope.success) return { kind: 'fallback', reason: 'proxy-rejected', recordCall: false };

    const narrative = asRecord(envelope.data)?.narrative;
    if (typeof narrative !== 'string') return { kind: 'fallback', reason: 'malformed-response', recordCall: false };
    return { kind: 'narrative', narrative, recordCall: true };
};
