import { auth } from '../firebase';
import { CONSTANTS } from '../data/constants';
import { TokenQuotaManager } from '../systems/TokenQuotaManager';
import { LatencyTracker } from '../systems/LatencyTracker';

// --- AI SERVICE (v3.5) ---
export const AI_SERVICE = {
    getFallback: (type, data) => {
        const templates = {
            encounter: `⚠️[${data.loc}]의 어둠 속에서[${data.name}]이(가) 나타났습니다!`,
            victory: `🎉[${data.name}]에게 결정타를 날렸습니다! 승리!`,
            death: `💀[${data.player?.name || '당신'}]의 의식이 흐려집니다...`,
            levelUp: `✨ 새로운 힘이 깨어납니다! 레벨 ${data.level} 달성!`,
            rest: `💤[${data.loc}]에서 편안한 휴식을 취했습니다.체력이 회복됩니다.`
        };
        return templates[type] || "운명의 수레바퀴가 돌기 시작합니다.";
    },

    generateEvent: async (loc, history = [], uid = 'anonymous') => {
        // v3.5: Check quota before making AI call
        if (!TokenQuotaManager.canMakeAICall()) {
            console.warn(TokenQuotaManager.getExhaustedMessage());
            return { exhausted: true, message: TokenQuotaManager.getExhaustedMessage() };
        }

        // v3.4: Use proxy for secure API key handling
        if (CONSTANTS.USE_AI_PROXY) {
            try {
                // v4.0: Cross-Cloud Security (Auth Token)
                const token = await auth.currentUser?.getIdToken();
                const headers = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };

                // v3.5: Track latency
                const result = await LatencyTracker.trackCall(async () => {
                    const response = await fetch(CONSTANTS.AI_PROXY_URL, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ type: 'event', data: { location: loc, history, uid } })
                    });
                    if (response.ok) {
                        return await response.json();
                    }
                    return null;
                }, 'ai-event');

                if (result?.success) {
                    TokenQuotaManager.recordCall(); // Record successful call
                    return result.data;
                }
            } catch (e) {
                console.warn('AI proxy unavailable:', e.message);
            }
        }
        // Fallback: No direct API call (API key removed from client)
        return null;
    },

    generateStory: async (type, data, uid = 'anonymous') => {
        // v3.5: Check quota
        if (!TokenQuotaManager.canMakeAICall()) {
            return AI_SERVICE.getFallback(type, data);
        }

        // v3.4: Use proxy for secure API key handling
        if (CONSTANTS.USE_AI_PROXY) {
            try {
                // v4.0: Cross-Cloud Security (Auth Token)
                const token = await auth.currentUser?.getIdToken();
                const headers = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };

                // v3.5: Track latency
                const result = await LatencyTracker.trackCall(async () => {
                    const response = await fetch(CONSTANTS.AI_PROXY_URL, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ type: 'story', data: { storyType: type, ...data, uid } })
                    });
                    if (response.ok) {
                        return await response.json();
                    }
                    return null;
                }, 'ai-story');

                if (result?.success && result.data?.narrative) {
                    TokenQuotaManager.recordCall(); // Record successful call
                    return result.data.narrative;
                }
            } catch (e) {
                console.warn('AI proxy unavailable for story:', e.message);
            }
        }
        // Fallback: Use local templates
        return AI_SERVICE.getFallback(type, data);
    }
};
