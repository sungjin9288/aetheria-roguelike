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
 * ## 쿼터 미터의 의미 (Wave 12 D3)
 *
 * 쿼터가 세는 것은 **디스패치**다 — "프록시로 실제로 나간 요청 수". 채택된 결과 수가
 * 아니다. 강제하는 불변식은 하루 `dispatched ≤ BALANCE.DAILY_AI_LIMIT` 하나이고,
 * 그래서 `recordCall`은 응답 해석이 아니라 **요청 결정(`AiCallDecision`)이 들고 있다**.
 *
 * 그 근거는 두 가지다.
 * 1. **게이트가 세는 것과 미터가 세는 것이 같아야 한다.** `canMakeAICall()`이 막는 것은
 *    디스패치이지 채택이 아니다. 미터가 디스패치의 부분집합(=채택된 것)만 세면 게이트는
 *    절대 조이지 않는다 — 모델 응답이 절반 깨지면 50 예산으로 100번 나가고, 전부 깨지면
 *    무한히 나간다.
 * 2. **서버에는 일일 한도가 없다.** `functions/api/ai-proxy.js`의 `checkRateLimit`
 *    (:52-65)은 `uid:IP` 키에 60초 창 40건(:9-10)이고 isolate별 인메모리(:4-8)다.
 *    즉 하루 비용의 유일한 상한은 이 클라이언트 미터뿐이므로, 미터는 **과소 집계하면
 *    안 된다**. 반대로 과다 집계(프록시가 죽은 날 폴백만 받으면서 한도를 태우는 경우)의
 *    피해는 하루치로 닫히고, 그날의 폴백 이벤트는 그대로 플레이 가능하다.
 *
 * Wave 11이 기록한 비대칭(이벤트는 success 응답만으로 소모, 스토리는 narrative 확인 뒤
 * 소모)은 그래서 "이벤트를 스토리에 맞추는" 방향이 아니라 **둘 다 디스패치 시점으로**
 * 맞추는 것으로 닫혔다. 소모 지점이 응답 해석 2곳이 아니라 요청 결정 1곳이므로,
 * 두 경로가 다시 어긋날 자리 자체가 없다.
 *
 * 디스패치된 호출이 어떻게 끝났는지는 `AiCallOutcome`(채택 1종 + 미채택 4종)으로 나오고,
 * `TokenQuotaManager.recordOutcome()`이 같은 레코드에 적는다 — "나갔지만 채택되지 않은
 * 호출이 몇 건인가"가 그제서야 숫자가 된다.
 *
 * 한국어 문구는 이 파일에 없다 — 쿼터 소진 안내는 `TokenQuotaManager.getExhaustedMessage()`
 * (=`MSG.AI_QUOTA_EXHAUSTED` / `MSG.AI_QUOTA_EXHAUSTED_LEDGER`)가 소유하고 입력으로 들어온다.
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
 *
 * W12-D3에서 나머지 6종의 표면화를 검토했고 **하지 않기로 했다**. 근거는 실측이다.
 * - `proxy-disabled`는 기본 빌드에서 **항상** 참이다(`CONSTANTS.USE_AI_PROXY` 기본값 false —
 *   `tests/ai-service-proxy-default.test.js`). 표시를 달면 100%의 이벤트에 붙으므로 정보가
 *   아니라 잡음이다. AI 경로는 옵트인 빌드 플래그이지 런타임 사건이 아니다.
 * - `mock-runtime`은 QA 하네스, `proxy-unavailable`/`proxy-rejected`/`malformed-response`는
 *   플레이어가 취할 행동이 없는 기계 실패다. "AI 응답이 잘못된 형식이었습니다"는 사과일 뿐
 *   게임 정보가 아니다.
 * - `recent-duplicate`는 안내가 **거짓**이 된다 — 그 경우 폴백 쪽이 의도대로 더 나은(안 겹치는)
 *   이벤트다. 반복 방지가 제대로 동작한 것을 실패처럼 알릴 이유가 없다.
 * - 표면 자체(`source: 'ai' | 'fallback'`)는 렌더되지 않는다. 즉 플레이어는 지금도 AI 이벤트와
 *   큐레이션 폴백을 구분할 수 없고, 앞으로도 구분할 필요가 없다 — 구분해서 **행동이 달라지는**
 *   경우는 한도 소진 하나뿐이고 그건 이미 `'quota'`로 나간다.
 *
 * 대신 그 하나뿐인 표면을 **더 정확하게** 만들었다: 한도 안내 문구가 "오늘 몇 번 보냈고 몇 번이
 * 이야기로 돌아왔는가"를 싣는다(`TokenQuotaManager.getExhaustedMessage`). 표면의 개수를 늘리는
 * 대신 이미 있는 표면의 정직함을 올리는 쪽이다.
 */
export type AiFallbackReason =
    | 'mock-runtime'
    | 'quota'
    | 'proxy-disabled'
    | 'proxy-unavailable'
    | 'proxy-rejected'
    | 'malformed-response'
    | 'recent-duplicate';

/**
 * 디스패치 **이전**에 결정되는 폴백 3종 — 프록시로 나간 요청이 없으므로 쿼터를 쓰지 않고,
 * `AiCallOutcome`이 될 수도 없다(`decideAiEventRequest`만 만든다).
 */
export type AiPreDispatchReason = Extract<AiFallbackReason, 'mock-runtime' | 'quota' | 'proxy-disabled'>;

/**
 * 디스패치된 호출이 **채택되지 못한** 이유 4종. 전부 요청이 나간 뒤에만 관측되므로
 * 쿼터 1건은 이미 쓰인 상태다 — 이 값이 "나갔지만 이야기가 되지 못한 호출"을 센다.
 */
export type AiUnadoptedReason = Extract<AiFallbackReason,
    'proxy-unavailable' | 'proxy-rejected' | 'malformed-response' | 'recent-duplicate'>;

/**
 * 디스패치된 호출 1건의 정산 결과 — 채택 1종 + 미채택 4종의 닫힌 집합.
 * `TokenQuotaManager.recordOutcome()`이 쿼터와 **같은 레코드**에 적는다(진실 원천 1곳).
 */
export type AiCallOutcome = 'adopted' | AiUnadoptedReason;

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
    /**
     * **쿼터 1건을 소모한다.** 미터가 세는 것은 디스패치이므로 소모 시점은 응답이 아니라
     * 이 결정이다 — 이벤트/스토리 두 경로가 같은 필드를 읽으므로 어긋날 자리가 없다.
     */
    readonly recordCall: true;
}

/** 프록시를 부르지 않고 큐레이션 폴백으로 접는다. */
export interface AiFallbackDecision {
    readonly kind: 'fallback';
    readonly reason: AiPreDispatchReason;
    /** `reason === 'quota'`일 때만 채워진다(쿼터 소진 안내 문구). */
    readonly message?: string;
    /** 나간 요청이 없으므로 쿼터를 쓰지 않는다. */
    readonly recordCall: false;
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
    if (input.mockRuntime) return { kind: 'fallback', reason: 'mock-runtime', recordCall: false };

    const quota = input.readQuota();
    if (quota.exhausted) {
        return { kind: 'fallback', reason: 'quota', message: quota.exhaustedMessage, recordCall: false };
    }

    if (!input.proxyEnabled) return { kind: 'fallback', reason: 'proxy-disabled', recordCall: false };

    const [trackLabel, timeoutMs] = input.track;
    return { kind: 'call', requestKind: input.requestKind, trackLabel, timeoutMs, recordCall: true };
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
type AiTransportFallbackReason = Extract<AiUnadoptedReason, 'proxy-unavailable' | 'proxy-rejected'>;

export type AiEventResponse =
    /**
     * `success`가 참. 쿼터는 **이미 디스패치에서 소모됐다** — 여기서는 아무것도 기록하지
     * 않고, 이 호출이 이야기가 됐는지(`outcome`)는 다음 단계(`resolveAiEventPackage`)가
     * 정한다. 그래서 `outcome`이 `null`이다: "아직 미정"이지 "무(無)"가 아니다.
     */
    | { readonly kind: 'payload'; readonly data: unknown; readonly outcome: null }
    | {
        readonly kind: 'fallback';
        readonly reason: AiTransportFallbackReason;
        /** 여기서 정산이 끝난다 — 나갔지만 채택되지 못한 호출 1건. */
        readonly outcome: AiTransportFallbackReason;
    };

/**
 * 이벤트 응답 해석. `raw`는 `callProxy`의 반환값이다 —
 * fetch 예외 · AbortError(9.5s 타임아웃) · `!response.ok`는 모두 `null`로 접혀 들어오므로
 * 이 경계에서는 셋을 구분할 수 없다(= 전부 `'proxy-unavailable'`).
 *
 * W12-D3: 여기에는 `recordCall`이 없다. 쿼터 소모는 요청 결정(`AiCallDecision`)이 소유하고,
 * 응답 해석은 **이미 쓴 1건이 어떻게 끝났는지**만 분류한다.
 */
export const resolveAiEventResponse = (raw: unknown): AiEventResponse => {
    const envelope = asEnvelope(raw);
    if (!envelope) return { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' };
    if (!envelope.success) return { kind: 'fallback', reason: 'proxy-rejected', outcome: 'proxy-rejected' };
    return { kind: 'payload', data: envelope.data, outcome: null };
};

/** `buildEventPackage` 결과를 채택할지 — 정규화 자체는 `utils/aiEventUtils`가 소유한다. */
export interface AiEventPackageInput {
    /** `buildEventPackage(...)`가 패키지를 만들었는가(`null`이면 false). */
    readonly built: boolean;
    /** `recentEvents.has(normalized.desc)` — 최근에 이미 본 이벤트인가. */
    readonly recentDuplicate: boolean;
}

/** 패키지 단계에서만 나올 수 있는 미채택 이유 2종. */
type AiPackageFallbackReason = Extract<AiUnadoptedReason, 'malformed-response' | 'recent-duplicate'>;

export type AiEventPackageVerdict =
    | { readonly kind: 'accept'; readonly outcome: 'adopted' }
    | {
        readonly kind: 'fallback';
        readonly reason: AiPackageFallbackReason;
        readonly outcome: AiPackageFallbackReason;
    };

/**
 * payload 응답의 정산. 여기서 나오는 `outcome`이 그 디스패치 1건의 최종 결과다 —
 * `malformed-response`/`recent-duplicate`도 **이미 소모된** 호출이라는 뜻이고, 그것이
 * "나갔지만 이야기가 되지 못한 호출"로 집계된다.
 */
export const resolveAiEventPackage = (input: AiEventPackageInput): AiEventPackageVerdict => {
    if (!input.built) return { kind: 'fallback', reason: 'malformed-response', outcome: 'malformed-response' };
    if (input.recentDuplicate) return { kind: 'fallback', reason: 'recent-duplicate', outcome: 'recent-duplicate' };
    return { kind: 'accept', outcome: 'adopted' };
};

/** 스토리 경로에서 나올 수 있는 미채택 이유 3종(중복 필터는 스토리에 없다). */
type AiStoryFallbackReason = Extract<AiUnadoptedReason,
    'proxy-unavailable' | 'proxy-rejected' | 'malformed-response'>;

export type AiStoryResponse =
    /** `success`가 참이고 `data.narrative`가 문자열 — 이 디스패치는 채택으로 정산된다. */
    | { readonly kind: 'narrative'; readonly narrative: string; readonly outcome: 'adopted' }
    | {
        readonly kind: 'fallback';
        readonly reason: AiStoryFallbackReason;
        readonly outcome: AiStoryFallbackReason;
    };

/**
 * 스토리 응답 해석. **이벤트와 정산 방식이 같다**(W12-D3): 쿼터는 디스패치에서 이미
 * 소모됐고 여기서는 그 1건의 `outcome`만 고른다. Wave 11이 기록한 비대칭
 * (이벤트는 success만으로 소모 / 스토리는 narrative 확인 뒤 소모)은 소모 지점을
 * 응답 해석 2곳에서 요청 결정 1곳으로 올리면서 사라졌다 — 두 resolver는 이제
 * `recordCall`을 아예 들고 있지 않다.
 */
export const resolveAiStoryResponse = (raw: unknown): AiStoryResponse => {
    const envelope = asEnvelope(raw);
    if (!envelope) return { kind: 'fallback', reason: 'proxy-unavailable', outcome: 'proxy-unavailable' };
    if (!envelope.success) return { kind: 'fallback', reason: 'proxy-rejected', outcome: 'proxy-rejected' };

    const narrative = asRecord(envelope.data)?.narrative;
    if (typeof narrative !== 'string') {
        return { kind: 'fallback', reason: 'malformed-response', outcome: 'malformed-response' };
    }
    return { kind: 'narrative', narrative, outcome: 'adopted' };
};
