import { auth } from '../firebase';
import { CONSTANTS } from '../data/constants';
import { TokenQuotaManager } from '../systems/TokenQuotaManager';
import { LatencyTracker } from '../systems/LatencyTracker';
import {
    buildEventPackage,
    getRecentEventSet,
    pickFallbackEvent,
    summarizeHistory,
    type EventContext,
    type EventPackage,
} from '../utils/aiEventUtils';
import { isMockRuntime } from '../utils/runtimeMode';
import {
    decideAiEventRequest,
    getEventFallbackAnnotation,
    resolveAiEventPackage,
    resolveAiEventResponse,
    resolveAiStoryResponse,
    type AiCallDecision,
    type AiProxyTrack,
    type AiQuotaState,
    type AiRequestKind,
} from '../platform/aiEventPolicy';

/** `pickFallbackEvent`/`summarizeHistory`가 받는 history 배열 원소 — 비export(HistoryEntryLike)라 파라미터에서 도출한다. */
type AiHistoryEntry = NonNullable<Parameters<typeof pickFallbackEvent>[1]>[number];

/**
 * `generateEvent`가 실제로 받는 컨텍스트 — 생산자(exploreActions.ts)는 `EventContext`
 * (aiEventUtils.ts)가 선언한 `playerSnapshot`(level/hp/maxHp/maxMp)보다 넓은 실측 스냅샷
 * (성과 점수·난이도 라벨 등)을 얹어 보낸다. 여기서는 그 실측 형태를 받고, 내부에서
 * `pickFallbackEvent`/`buildEventPackage`(EventContext 요구)로 넘길 때만 캐스팅한다.
 */
interface AiEventContext {
    location?: string;
    source?: string;
    desc?: string;
    playerSnapshot?: Record<string, unknown>;
    mapSnapshot?: Record<string, unknown>;
}

// W11-C3: 폴백 판정(호출할까 · 어떤 fallbackReason으로 접을까 · 응답을 채택할까)은
//   `platform/aiEventPolicy.ts`가 소유한다. 이 파일에 남은 것은 IO뿐이다 —
//   fetch / AbortController / 타이머 / firebase 토큰 / localStorage 쿼터 읽기·기록 /
//   폴백 풀 선택(pickFallbackEvent)과 패키지 정규화(buildEventPackage) 호출.
//   프록시 응답 봉투(`success`/`data`)를 좁히는 일도 정책 쪽 resolver가 한다.
//
// W12-D3: 쿼터 소모 지점이 응답 해석 2곳에서 **디스패치 1곳**으로 올라왔다(`dispatchProxyCall`).
//   이벤트/스토리가 같은 헬퍼를 지나므로 "이벤트는 success에서, 스토리는 narrative 확인 뒤"
//   같은 비대칭이 다시 생길 자리가 없다. 응답 해석은 이제 소모 여부가 아니라 **이미 쓴 1건이
//   어떻게 끝났는지**(`outcome`)만 돌려주고, 그 값을 `TokenQuotaManager.recordOutcome`이 적는다.

/**
 * 프록시 트랙 = [LatencyTracker 라벨, AbortController 타임아웃(ms)].
 * LatencyTracker 라벨과 abort 타임아웃은 둘 다 이 파일이 실행하는 IO의 설정값이므로
 * 여기(서비스)가 소유하고, 정책에는 입력으로 넘겨 `call` 결정에 그대로 실려 돌아온다
 * — 결정 이후 다시 이 표를 뒤지지 않는다(진실 원천 1곳).
 * 9500ms는 CLAUDE.md §6 "AI 이벤트 생성"의 9.5s 계약이다.
 */
const AI_PROXY_TRACKS: Record<AiRequestKind, AiProxyTrack> = {
    event: [
        'ai-event',
        9500,
    ],
    story: [
        'ai-story',
        9500,
    ],
};

/**
 * 쿼터 관측 1회 — localStorage IO다. 정책은 이 값을 **입력**으로만 받고 사용량을
 * 들고 있지 않는다(`TokenQuotaManager`가 단일 진실 원천).
 */
const readQuota = (): AiQuotaState => ({
    exhausted: !TokenQuotaManager.canMakeAICall(),
    exhaustedMessage: TokenQuotaManager.getExhaustedMessage(),
});

/**
 * 요청 1건의 관측을 모아 정책에 넘긴다. `readQuota`를 값이 아니라 함수로 넘기는 이유는
 * mock 런타임(smoke/e2e/device-QA)에서 쿼터를 읽지 않는 기존 동작을 보존하기 위함이다.
 */
const decideRequest = (requestKind: AiRequestKind) => decideAiEventRequest({
    requestKind,
    mockRuntime: isMockRuntime(),
    proxyEnabled: CONSTANTS.USE_AI_PROXY,
    readQuota,
    track: AI_PROXY_TRACKS[requestKind],
});

/**
 * 디스패치 1건 = 쿼터 1건. 두 경로(이벤트/스토리)가 반드시 이 헬퍼를 지나므로 소모 지점이
 * 하나다 — `recordCall`을 `await` **앞에서** 쓰는 것이 핵심이다. 응답을 본 뒤에 쓰면
 * 응답이 오지 않는 호출(타임아웃·네트워크 예외·!ok)이 공짜가 되고, 그러면 프록시가
 * 흔들리는 사용자가 로컬 카운터 0으로 백엔드를 계속 두드릴 수 있다(서버에는 일일 한도가
 * 없다 — functions/api/ai-proxy.js:52-65는 60초 40건 uid+IP 버킷일 뿐이다).
 */
const dispatchProxyCall = async (decision: AiCallDecision, body: unknown): Promise<unknown> => {
    if (decision.recordCall) TokenQuotaManager.recordCall();
    return callProxy(body, decision.trackLabel, decision.timeoutMs);
};

/**
 * AI_SERVICE 내부 공용 프록시 호출 헬퍼 (DRY 적용)
 * @param {object} body - 요청 바디
 * @param {string} trackLabel - LatencyTracker 라벨
 * @param {number} timeoutMs - 타임아웃 (ms)
 * @returns {Promise<object|null>}
 */
// cycle 539: trackLabel / timeoutMs defaults 제거 — 2 internal callsite (이벤트
//   'ai-event'/9500, story 'ai-story'/9500) 모두 명시 전달이라 두 default 모두
//   도달 불가. util/component/hook/system/reducer/service default 청소 메가
//   시리즈 35번째, services/ 진입.
// W11-C3: 두 값은 이제 AI_PROXY_TRACKS → 정책의 `call` 결정을 거쳐 들어온다.
//   실패(fetch 예외·AbortError·!response.ok)는 예전처럼 전부 null로 접히고,
//   그 null을 `resolveAiEventResponse`/`resolveAiStoryResponse`가 분류한다.
const callProxy = async (body: unknown, trackLabel: string, timeoutMs: number): Promise<unknown> => {
    try {
        const token = await auth?.currentUser?.getIdToken?.();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const result = await LatencyTracker.trackCall(async () => {
            const response = await fetch(CONSTANTS.AI_PROXY_URL, {
                method: 'POST',
                headers,
                mode: 'cors',
                signal: controller.signal,
                body: JSON.stringify(body)
            });
            clearTimeout(timeoutId);
            if (response.ok) return await response.json();
            return null;
        }, trackLabel);

        return result;
    } catch (e: unknown) {
        console.warn(`[AI_SERVICE] ${trackLabel} proxy call failed:`, e instanceof Error ? e.message : String(e));
        return null;
    }
};

interface NarrativeLocationLike {
    location?: unknown;
    loc?: unknown;
}

const getNarrativeLocation = (data: NarrativeLocationLike | undefined) => {
    const canonicalLocation = data?.location;
    if (typeof canonicalLocation === 'string' && canonicalLocation.trim()) return canonicalLocation;

    const legacyLocation = data?.loc;
    if (typeof legacyLocation === 'string' && legacyLocation.trim()) return legacyLocation;

    return '알 수 없음';
};

/**
 * `getFallback`/`generateStory`가 읽는 필드 — 5개 호출부(전투/레벨업/사망/보스/퀘스트)가 채우는 합집합.
 * `generateStory`는 이 값을 그대로 AI 프록시 body에도 펼쳐 넣으므로(playerSnapshot 등) 여기서
 * 읽지 않는 부가 컨텍스트 필드도 통과시켜야 한다 — 인덱스 시그니처로 열어 둔다.
 */
interface AiFallbackData extends NarrativeLocationLike {
    name?: string;
    level?: number | string;
    bossName?: string;
    questTitle?: string;
    player?: { name?: string };
    history?: AiHistoryEntry[];
    storyType?: string;
    context?: string;
    [key: string]: unknown;
}

// --- AI SERVICE (v3.7) ---
export const AI_SERVICE = {
    getFallback: (type: string, data: AiFallbackData) => {
        const location = getNarrativeLocation(data);
        const templates: Record<string, string> = {
            encounter: `${location}의 어둠 속에서 ${data.name}의 기척이 나타났습니다.`,
            victory:   `${data.name}에게 마지막 일격을 가해 승리했습니다.`,
            death:     `${data.player?.name || '당신'}의 의식이 서서히 흐려집니다.`,
            levelUp:   `새로운 힘이 깨어나 레벨 ${data.level}에 도달했습니다.`,
            rest:      `${location}에서 편안히 쉬며 생명을 회복했습니다.`,
            // Stage 1 확장 타입
            bossPhase2:    `${data.bossName || '보스'}의 진정한 힘이 드러나며 공간이 뒤틀립니다.`,
            questComplete: `${data.questTitle || '새로운'} 임무를 마쳤습니다. 에테리아의 기록에 새로운 이야기가 새겨집니다.`,
            ruinRecap:     `${data.name || '모험가'}의 여정은 레벨 ${data.level || 1}에서 멈췄습니다. 남겨진 힘은 다음 도전으로 이어집니다.`,
        };
        return templates[type] || '운명의 수레바퀴가 돌기 시작합니다.';
    },

    // cycle 606: history / uid / context 3 defaults 제거 — production caller가
    //   모두 명시 전달한다. optional rng는 deterministic action/test 경로에서만
    //   주입하며 미전달 production behavior는 Math.random을 보존한다.
    //   cycle 539 callProxy paired completion (동일 모듈).
    generateEvent: async (loc: string, history: AiHistoryEntry[], uid: string | null, context: AiEventContext, rng?: () => number): Promise<EventPackage | null> => {
        const pickEventFallback = () => {
            if (typeof rng === 'function') return pickFallbackEvent(loc, history, context as EventContext, rng);
            return pickFallbackEvent(loc, history, context as EventContext);
        };

        // W11-C3: mock 런타임 / 쿼터 소진 / 프록시 비활성 3분기는 정책이 판정한다.
        //   쿼터 소진만 폴백 이벤트에 표시(fallbackReason:'quota' + 안내 문구)를 남긴다.
        const decision = decideRequest('event');
        if (decision.kind === 'fallback') {
            const fallbackEvent = pickEventFallback();
            const annotation = getEventFallbackAnnotation(decision);
            if (!annotation) return fallbackEvent;
            if (!fallbackEvent) return null;
            return { ...fallbackEvent, ...annotation };
        }

        const recentHistory = summarizeHistory(history);
        const recentEvents = getRecentEventSet(history);

        // 쿼터는 여기서 소모된다(디스패치 = 비용). 아래 해석은 그 1건의 정산만 남긴다.
        const result = resolveAiEventResponse(await dispatchProxyCall(decision, {
            type: 'event',
            data: {
                location: loc,
                history: recentHistory,
                playerSnapshot: context.playerSnapshot || {},
                mapSnapshot: context.mapSnapshot || {},
                uid
            }
        }));

        if (result.kind === 'payload') {
            const normalized = buildEventPackage(result.data, { ...context, location: loc, source: 'ai' } as EventContext);
            const verdict = resolveAiEventPackage({
                built: normalized !== null,
                recentDuplicate: normalized !== null && recentEvents.has(normalized.desc),
            });
            TokenQuotaManager.recordOutcome(verdict.outcome);
            // `accept`는 정의상 normalized !== null이지만, 타입을 좁히려면 여기서 한 번 더 본다.
            if (verdict.kind === 'accept' && normalized) return normalized;
        } else {
            // 응답 자체가 오지 않았거나 거절됐다 — 나간 1건은 이야기가 되지 못한 것으로 정산.
            TokenQuotaManager.recordOutcome(result.outcome);
        }

        // Fallback: 오프라인 이벤트 풀 사용
        return pickEventFallback();
    },

    generateStory: async (type: string, data: AiFallbackData, uid: string | null) => {
        const decision = decideRequest('story');
        // story 경로는 폴백 이유를 표면화하지 않는다 — 3분기 모두 같은 내러티브 템플릿이다
        //   (쿼터 안내 문구는 이벤트 카드에만 실린다).
        if (decision.kind === 'fallback') return AI_SERVICE.getFallback(type, data);

        const compactHistory = summarizeHistory(data?.history);
        const location = getNarrativeLocation(data);

        // Stage 1: 지원 타입 확장 맵핑 (bossPhase2, questComplete, ruinRecap)
        const contextMap: Record<string, string> = {
            encounter:     `${location}에서 ${data.name} 몬스터와 조우`,
            victory:       `${data.name} 처치 후 승리`,
            death:         `${data.player?.name || '용사'}의 전사 — ${location}`,
            levelUp:       `레벨 ${data.level} 달성`,
            rest:          `${location}에서 휴식`,
            bossPhase2:    `보스 [${data.bossName}] Phase 2 전환 — ${location}`,
            questComplete: `퀘스트 [퀘스트: ${data.questTitle}] 완료 in ${location}`,
            ruinRecap:     `${data.name}의 사망 후회고 — 레벨 ${data.level}, ${location}에서 전사`,
        };
        // context 변수를 AI 프록시에 전달하여 문맥 품질 향상
        const resolvedContext = contextMap[data.storyType ?? ''] || contextMap[type] || (data.context || '모험');

        // narrative는 AI 백엔드가 주는 외부 값 — 문자열임을 확인해야 신뢰할 수 있다
        // (do not trust the shape). 그 확인은 resolveAiStoryResponse가 한다.
        // 이벤트 경로와 **같은** 헬퍼를 지난다 — 쿼터는 디스패치에서 소모되고, 아래에서는
        //   그 1건의 정산(`outcome`)만 적는다.
        const result = resolveAiStoryResponse(await dispatchProxyCall(decision, {
            type: 'story',
            data: {
                storyType: type,
                ...data,
                context: resolvedContext,
                history: compactHistory,
                uid
            }
        }));
        TokenQuotaManager.recordOutcome(result.outcome);
        if (result.kind === 'narrative') return result.narrative;

        return AI_SERVICE.getFallback(type, data);
    },
};
