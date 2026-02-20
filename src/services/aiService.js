import { auth } from '../firebase';
import { CONSTANTS } from '../data/constants';
import { TokenQuotaManager } from '../systems/TokenQuotaManager';
import { LatencyTracker } from '../systems/LatencyTracker';

const normalizeEventResponse = (payload) => {
    const raw = payload?.data || payload;
    if (!raw || typeof raw !== 'object') return null;

    const desc = raw.desc || raw.text || raw.event || raw.message;
    const choices = Array.isArray(raw.choices)
        ? raw.choices.map((choice, idx) => (typeof choice === 'string' ? choice : choice?.text || choice?.label || `선택지 ${idx + 1}`))
        : [];
    const outcomes = Array.isArray(raw.outcomes) ? raw.outcomes : [];

    if (!desc) return null;
    return { ...raw, desc, choices: choices.slice(0, 3), outcomes };
};

/**
 * AI_SERVICE 내부 공용 프록시 호출 헬퍼 (DRY 적용)
 * @param {object} body - 요청 바디
 * @param {string} trackLabel - LatencyTracker 라벨
 * @param {number} timeoutMs - 타임아웃 (ms)
 * @returns {Promise<object|null>}
 */
const callProxy = async (body, trackLabel = 'ai-call', timeoutMs = 12000) => {
    try {
        const token = await auth.currentUser?.getIdToken();
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

    generateEvent: async (loc, history = [], uid = 'anonymous') => {
        if (!TokenQuotaManager.canMakeAICall()) {
            return { exhausted: true, message: TokenQuotaManager.getExhaustedMessage() };
        }

        if (CONSTANTS.USE_AI_PROXY) {
            const result = await callProxy(
                { type: 'event', data: { location: loc, history, uid } },
                'ai-event',
                10000
            );
            if (result?.success) {
                TokenQuotaManager.recordCall();
                const normalized = normalizeEventResponse(result.data);
                return normalized || result.data;
            }
        }

        // Fallback: 오프라인 이벤트 풀 사용
        return AI_SERVICE._pickFallbackEvent(loc);
    },

    generateStory: async (type, data, uid = 'anonymous') => {
        if (!TokenQuotaManager.canMakeAICall()) {
            return AI_SERVICE.getFallback(type, data);
        }

        if (CONSTANTS.USE_AI_PROXY) {
            const result = await callProxy(
                { type: 'story', data: { storyType: type, ...data, uid } },
                'ai-story',
                15000
            );
            if (result?.success && result.data?.narrative) {
                TokenQuotaManager.recordCall();
                return result.data.narrative;
            }
        }

        return AI_SERVICE.getFallback(type, data);
    },

    /**
     * 맵 타입에 따른 오프라인 이벤트 풀 선택
     */
    _pickFallbackEvent: (loc) => {
        const pool = AI_SERVICE._fallbackEventPool[loc] || AI_SERVICE._fallbackEventPool['default'];
        return pool[Math.floor(Math.random() * pool.length)];
    },

    _fallbackEventPool: {
        '시작의 마을': [
            { desc: '마을 광장에서 게시판을 발견했습니다.', choices: ['확인하다', '무시한다', '다음에 보다'] },
            { desc: '낯선 상인이 수상쩍은 물건을 팔고 있습니다.', choices: ['구경하다', '의심한다', '지나친다'] },
            { desc: '마을 어른이 당신에게 심부름을 부탁합니다.', choices: ['돕는다', '거절한다'] },
        ],
        '고대 던전': [
            { desc: '벽면에서 고대 문자가 빛나기 시작합니다.', choices: ['해독한다', '손으로 만진다', '무시한다'] },
            { desc: '바닥에 함정 흔적이 보입니다.', choices: ['조심히 넘는다', '돌아서 우회한다', '무시하고 달린다'] },
            { desc: '던전 깊숙한 곳에서 낡은 상자를 발견했습니다.', choices: ['연다', '두드려본다', '지나친다'] },
            { desc: '동굴 벽에 크고 날카로운 발톱 자국이 있습니다.', choices: ['추적한다', '경계한다', '되돌아간다'] },
        ],
        '황야': [
            { desc: '저 멀리 모닥불 연기가 피어오릅니다.', choices: ['다가간다', '우회한다', '관찰한다'] },
            { desc: '버려진 야영지 흔적을 발견했습니다.', choices: ['뒤져본다', '휴식한다', '지나친다'] },
            { desc: '낡은 나무 표지판이 두 갈래 길을 가리킵니다.', choices: ['왼쪽으로', '오른쪽으로', '원래 길로'] },
            { desc: '하늘에서 이상한 물체가 떨어지는 것이 보입니다.', choices: ['달려간다', '숨는다', '관찰한다'] },
        ],
        '깊은 숲': [
            { desc: '나무 사이로 신비로운 빛이 흘러나옵니다.', choices: ['따라간다', '멀리서 관찰한다', '돌아선다'] },
            { desc: '오래된 석상이 덩굴에 감겨 있습니다.', choices: ['살펴본다', '정화한다', '지나친다'] },
            { desc: '반짝이는 무언가가 풀숲에 있습니다.', choices: ['줍는다', '막대기로 쑤셔본다', '무시한다'] },
            { desc: '숲속에서 다친 사슴 한 마리를 발견했습니다.', choices: ['치료한다', '그냥 지나간다', '자원을 챙긴다'] },
        ],
        'default': [
            { desc: '오래된 석상이 덩굴에 감겨 있습니다.', choices: ['살펴본다', '지나친다'] },
            { desc: '버려진 야영지 흔적을 발견했습니다.', choices: ['뒤져본다', '휴식한다'] },
            { desc: '반짝이는 무언가가 풀숲에 있습니다.', choices: ['줍는다', '무시한다'] },
            { desc: '낡은 표지판 하나가 길가에 쓰러져 있습니다.', choices: ['읽어본다', '세워놓는다', '지나친다'] },
            { desc: '멀리서 이상한 소리가 들려옵니다.', choices: ['확인한다', '경계한다', '도망간다'] },
        ],
    }
};
