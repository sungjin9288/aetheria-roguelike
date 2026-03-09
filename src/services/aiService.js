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
            victory:   `🎉 [${data.name}]에게 결정타를 날렸습니다! 승리!`,
            death:     `💠 [${data.player?.name || '당신'}]의 의식이 흘려집니다...`,
            levelUp:   `✨ 새로운 힘이 깨어됩니다! 레벨 ${data.level} 달성!`,
            rest:      `💤 [${data.loc}]에서 편안한 휴식을 취했습니다. 체력이 회복됩니다.`,
            // Stage 1 확장 타입
            bossPhase2:    `⚡ [${data.bossName || '보스'}]이(가) 진정한 힘을 해방합니다! 공간이 당스립니다!`,
            questComplete: `🎖️ [퀴스트: ${data.questTitle || ''}] 완료! 에테리아의 전설에 한 페이지가 추가됩니다.`,
            ruinRecap:     `💀 ${data.name || '용사'}는 레벨 ${data.level || 1}에서 추락했습니다. 하지만 그 정신은 다시 불타오를 것입니다...`,
        };
        return templates[type] || '운명의 수레바퀴가 돈기 시작합니다.';
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

        // Stage 1: 지원 타입 확장 맵핑 (bossPhase2, questComplete, ruinRecap)
        const contextMap = {
            encounter:     `${data.loc}에서 ${data.name} 몬스터와 조우`,
            victory:       `${data.name} 처치 후 승리`,
            death:         `${data.player?.name || '용사'}의 전사 — ${data.loc}`,
            levelUp:       `레벨 ${data.level} 달성`,
            rest:          `${data.loc}에서 휴식`,
            bossPhase2:    `보스 [${data.bossName}] Phase 2 전환 \u2014 ${data.loc}`,
            questComplete: `퀘스트 [퀘스트: ${data.questTitle}] 완료 in ${data.loc}`,
            ruinRecap:     `${data.name}의 사망 후회고 — 레벨 ${data.level}, ${data.loc}에서 전사`,
        };
        // context 변수를 AI 프록시에 전달하여 문맥 품질 향상
        const resolvedContext = contextMap[data.storyType] || contextMap[type] || (data.context || '모험');

        if (CONSTANTS.USE_AI_PROXY) {
            const result = await callProxy(
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
            );
            if (result?.success && result.data?.narrative) {
                TokenQuotaManager.recordCall();
                return result.data.narrative;
            }
        }

        return AI_SERVICE.getFallback(type, data);
    },
};
