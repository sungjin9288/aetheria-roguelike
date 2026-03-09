import { auth } from '../firebase';
import { CONSTANTS } from '../data/constants';
import { TokenQuotaManager } from '../systems/TokenQuotaManager';
import { LatencyTracker } from '../systems/LatencyTracker';
import { buildEventPackage, getRecentEventSet, pickFallbackEvent, summarizeHistory } from '../utils/aiEventUtils';

/**
 * AI_SERVICE 내부 공용 프록시 호출 헬퍼 (DRY 적용)
 * @param {object} body - 요청 바디
 * @param {string} trackLabel - LatencyTracker 라벨
 * @param {number} timeoutMs - 타임아웃 (ms)
 * @returns {Promise<object|null>}
 */
const callProxy = async (body, trackLabel = 'ai-call', timeoutMs = 9500) => {
    try {
        const token = await auth?.currentUser?.getIdToken?.();
        const headers = {
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
    } catch (e) {
        console.warn(`[AI_SERVICE] ${trackLabel} proxy call failed:`, e.message);
        return null;
    }
};

// --- AI SERVICE (v3.7) ---
export const AI_SERVICE = {
    getFallback: (type, data) => {
        const templates = {
            encounter: `⚠️ [${data.loc}]의 어둠 속에서 [${data.name}]이(가) 나타났습니다!`,
            victory: `🎉 [${data.name}]에게 결정타를 날렸습니다! 승리!`,
            death: `💀 [${data.player?.name || '당신'}]의 의식이 흐려집니다...`,
            levelUp: `✨ 새로운 힘이 깨어납니다! 레벨 ${data.level} 달성!`,
            rest: `💤 [${data.loc}]에서 편안한 휴식을 취했습니다. 체력이 회복됩니다.`
        };
        return templates[type] || '운명의 수레바퀴가 돌기 시작합니다.';
    },

    generateEvent: async (loc, history = [], uid = 'anonymous', context = {}) => {
        if (!TokenQuotaManager.canMakeAICall()) {
            return {
                ...pickFallbackEvent(loc, history, context),
                fallbackReason: 'quota',
                fallbackMessage: TokenQuotaManager.getExhaustedMessage()
            };
        }

        const recentHistory = summarizeHistory(history);
        const recentEvents = getRecentEventSet(history);

        if (CONSTANTS.USE_AI_PROXY) {
            const result = await callProxy(
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
            );
            if (result?.success) {
                TokenQuotaManager.recordCall();
                const normalized = buildEventPackage(result.data, { ...context, location: loc, source: 'ai' });
                if (normalized && !recentEvents.has(normalized.desc)) {
                    return normalized;
                }
            }
        }

        // Fallback: 오프라인 이벤트 풀 사용
        return pickFallbackEvent(loc, history, context);
    },

    generateStory: async (type, data, uid = 'anonymous') => {
        if (!TokenQuotaManager.canMakeAICall()) {
            return AI_SERVICE.getFallback(type, data);
        }

        const compactHistory = summarizeHistory(data?.history);

        if (CONSTANTS.USE_AI_PROXY) {
            const result = await callProxy(
                {
                    type: 'story',
                    data: {
                        storyType: type,
                        ...data,
                        history: compactHistory,
                        uid
                    }
                },
                'ai-story',
                9500
            );
            if (result?.success && result.data?.narrative) {
                TokenQuotaManager.recordCall();
                return result.data.narrative;
            }
        }

        return AI_SERVICE.getFallback(type, data);
    },
};
