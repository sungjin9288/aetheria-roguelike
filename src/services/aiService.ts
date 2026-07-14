import { auth } from '../firebase';
import { CONSTANTS } from '../data/constants';
import { TokenQuotaManager } from '../systems/TokenQuotaManager';
import { LatencyTracker } from '../systems/LatencyTracker';
import { buildEventPackage, getRecentEventSet, pickFallbackEvent, summarizeHistory } from '../utils/aiEventUtils';
import { isSmokeRuntime } from '../utils/runtimeMode';

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
const callProxy = async (body: any, trackLabel: any, timeoutMs: any) => {
    try {
        const token = await auth?.currentUser?.getIdToken?.();
        const headers: Record<string, any> = {
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
    } catch (e: any) {
        console.warn(`[AI_SERVICE] ${trackLabel} proxy call failed:`, e.message);
        return null;
    }
};

// --- AI SERVICE (v3.7) ---
export const AI_SERVICE = {
    getFallback: (type: any, data: any) => {
        const templates: Record<string, any> = {
            encounter: `${data.loc}의 어둠 속에서 ${data.name}의 기척이 나타났습니다.`,
            victory:   `${data.name}에게 마지막 일격을 가해 승리했습니다.`,
            death:     `${data.player?.name || '당신'}의 의식이 서서히 흐려집니다.`,
            levelUp:   `새로운 힘이 깨어나 레벨 ${data.level}에 도달했습니다.`,
            rest:      `${data.loc}에서 편안히 쉬며 생명을 회복했습니다.`,
            // Stage 1 확장 타입
            bossPhase2:    `${data.bossName || '보스'}의 진정한 힘이 드러나며 공간이 뒤틀립니다.`,
            questComplete: `${data.questTitle || '새로운'} 임무를 마쳤습니다. 에테리아의 기록에 새로운 이야기가 새겨집니다.`,
            ruinRecap:     `${data.name || '모험가'}의 여정은 레벨 ${data.level || 1}에서 멈췄습니다. 남겨진 힘은 다음 도전으로 이어집니다.`,
        };
        return templates[type] || '운명의 수레바퀴가 돌기 시작합니다.';
    },

    // cycle 606: history / uid / context 3 defaults 제거 — 1 production caller
    //   (exploreActions:71 AI_SERVICE.generateEvent(player.loc, player.history,
    //   uid, {...context})) 4 args 명시 전달이라 3 defaults 모두 도달 불가.
    //   cycle 539 callProxy paired completion (동일 모듈).
    generateEvent: async (loc: any, history: any[], uid: any, context: any) => {
        if (isSmokeRuntime()) {
            return pickFallbackEvent(loc, history, context);
        }

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

    generateStory: async (type: any, data: any, uid: any) => {
        if (isSmokeRuntime()) {
            return AI_SERVICE.getFallback(type, data);
        }

        if (!TokenQuotaManager.canMakeAICall()) {
            return AI_SERVICE.getFallback(type, data);
        }

        const compactHistory = summarizeHistory(data?.history);

        // Stage 1: 지원 타입 확장 맵핑 (bossPhase2, questComplete, ruinRecap)
        const contextMap: Record<string, any> = {
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
