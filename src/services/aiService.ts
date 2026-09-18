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

/**
 * 이 프록시가 돌려주는 응답은 외부(AI 백엔드) 산출물이다 — 형태를 신뢰하지 않고
 * `unknown`으로 받아 이 경계에서만 좁힌다. `data`는 `buildEventPackage`(payload: unknown)로
 * 그대로 흘러가므로 더 좁힐 필요가 없고, story 경로만 `narrative` 존재를 확인한다.
 */
interface AiProxyResult {
    success?: boolean;
    data?: unknown;
}

const asAiProxyResult = (value: unknown): AiProxyResult | null => (
    value !== null && typeof value === 'object' ? (value as AiProxyResult) : null
);

/**
 * AI_SERVICE 내부 공용 프록시 호출 헬퍼 (DRY 적용)
 * @param {object} body - 요청 바디
 * @param {string} trackLabel - LatencyTracker 라벨
 * @param {number} timeoutMs - 타임아웃 (ms)
 * @returns {Promise<object|null>}
 */
// cycle 539: trackLabel / timeoutMs defaults 제거 — 2 internal callsite (line
//   80 'ai-event'/9500, line 133 'ai-story'/9500) 모두 명시 전달이라 두
//   default 모두 도달 불가. util/component/hook/system/reducer/service default
//   청소 메가 시리즈 35번째, services/ 진입.
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
        if (isMockRuntime()) {
            return pickEventFallback();
        }

        if (!TokenQuotaManager.canMakeAICall()) {
            const exhaustedFallback = pickEventFallback();
            if (!exhaustedFallback) return null;
            return {
                ...exhaustedFallback,
                fallbackReason: 'quota',
                fallbackMessage: TokenQuotaManager.getExhaustedMessage()
            };
        }

        const recentHistory = summarizeHistory(history);
        const recentEvents = getRecentEventSet(history);

        if (CONSTANTS.USE_AI_PROXY) {
            const result = asAiProxyResult(await callProxy(
                {
                    type: 'event',
                    data: {
                        location: loc,
                        history: recentHistory,
                        playerSnapshot: context.playerSnapshot || {},
                        mapSnapshot: context.mapSnapshot || {},
                        uid
                    }
                },
                'ai-event',
                9500
            ));
            if (result?.success) {
                TokenQuotaManager.recordCall();
                const normalized = buildEventPackage(result.data, { ...context, location: loc, source: 'ai' } as EventContext);
                if (normalized && !recentEvents.has(normalized.desc)) {
                    return normalized;
                }
            }
        }

        // Fallback: 오프라인 이벤트 풀 사용
        return pickEventFallback();
    },

    generateStory: async (type: string, data: AiFallbackData, uid: string | null) => {
        if (isMockRuntime()) {
            return AI_SERVICE.getFallback(type, data);
        }

        if (!TokenQuotaManager.canMakeAICall()) {
            return AI_SERVICE.getFallback(type, data);
        }

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

        if (CONSTANTS.USE_AI_PROXY) {
            const result = asAiProxyResult(await callProxy(
                {
                    type: 'story',
                    data: {
                        storyType: type,
                        ...data,
                        context: resolvedContext,
                        history: compactHistory,
                        uid
                    }
                },
                'ai-story',
                9500
            ));
            // narrative는 AI 백엔드가 주는 외부 값 — 문자열임을 확인해야 신뢰할 수 있다
            // (do not trust the shape). 진짜인 응답은 항상 문자열이므로 동작은 그대로다.
            const narrative = (result?.data as { narrative?: unknown } | undefined)?.narrative;
            if (result?.success && typeof narrative === 'string') {
                TokenQuotaManager.recordCall();
                return narrative;
            }
        }

        return AI_SERVICE.getFallback(type, data);
    },
};
