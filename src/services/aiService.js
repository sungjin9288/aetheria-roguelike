import { auth } from '../firebase';
import { CONSTANTS } from '../data/constants';
import { TokenQuotaManager } from '../systems/TokenQuotaManager';
import { LatencyTracker } from '../systems/LatencyTracker';

// --- AI SERVICE (v3.6) ---
export const AI_SERVICE = {
    getFallback: (type, data) => {
        const templates = {
            encounter: `⚠️[${data.loc}]의 어둠 속에서 [${data.name}]이(가) 나타났습니다!`,
            victory: `🎉[${data.name}]에게 결정타를 날렸습니다! 승리!`,
            death: `💀[${data.player?.name || '당신'}]의 의식이 흐려집니다...`,
            levelUp: `✨ 새로운 힘이 깨어납니다! 레벨 ${data.level} 달성!`,
            rest: `💤[${data.loc}]에서 편안한 휴식을 취했습니다. 체력이 회복됩니다.`
        };
        return templates[type] || "운명의 수레바퀴가 돌기 시작합니다.";
    },

    generateEvent: async (loc, history = [], uid = 'anonymous') => {
        if (!TokenQuotaManager.canMakeAICall()) {
            return { exhausted: true, message: TokenQuotaManager.getExhaustedMessage() };
        }

        if (CONSTANTS.USE_AI_PROXY) {
            try {
                const token = await auth.currentUser?.getIdToken();
                const headers = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s Timeout

                const result = await LatencyTracker.trackCall(async () => {
                    const response = await fetch(CONSTANTS.AI_PROXY_URL, {
                        method: 'POST',
                        headers,
                        mode: 'cors', // Hardening: CORS
                        signal: controller.signal, // Hardening: Timeout
                        body: JSON.stringify({ type: 'event', data: { location: loc, history, uid } })
                    });
                    clearTimeout(timeoutId);
                    if (response.ok) return await response.json();
                    return null;
                }, 'ai-event');

                if (result?.success) {
                    TokenQuotaManager.recordCall();
                    return result.data;
                }
            } catch (e) {
                console.warn('AI proxy unavailable:', e.message);
            }
        }
        // Offline Fallback Events
        const fallbacks = [
            { desc: "오래된 석상이 덩굴에 감겨 있습니다.", choices: ["살펴본다", "지나친다"] },
            { desc: "버려진 야영지 흔적을 발견했습니다.", choices: ["뒤져본다", "휴식한다"] },
            { desc: "반짝이는 무언가가 풀숲에 있습니다.", choices: ["줍는다", "무시한다"] }
        ];
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    },

    generateStory: async (type, data, uid = 'anonymous') => {
        if (!TokenQuotaManager.canMakeAICall()) {
            return AI_SERVICE.getFallback(type, data);
        }

        // Hardening: Env Check for Fallback Mode
        // If we were using direct API actions, checks would be here.
        // For Proxy, we check URL validity essentially.

        if (CONSTANTS.USE_AI_PROXY) {
            try {
                const token = await auth.currentUser?.getIdToken();
                const headers = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s Timeout for Story

                const result = await LatencyTracker.trackCall(async () => {
                    const response = await fetch(CONSTANTS.AI_PROXY_URL, {
                        method: 'POST',
                        headers,
                        mode: 'cors',
                        signal: controller.signal,
                        body: JSON.stringify({ type: 'story', data: { storyType: type, ...data, uid } })
                    });
                    clearTimeout(timeoutId);
                    if (response.ok) return await response.json();
                    return null;
                }, 'ai-story');

                if (result?.success && result.data?.narrative) {
                    TokenQuotaManager.recordCall();
                    return result.data.narrative;
                }
            } catch (e) {
                console.warn('AI proxy unavailable for story:', e.message);
            }
        }
        return AI_SERVICE.getFallback(type, data);
    }
};
