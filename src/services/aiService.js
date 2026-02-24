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

    generateEvent: async (loc, history = [], uid = 'anonymous') => {
        if (!TokenQuotaManager.canMakeAICall()) {
            return { exhausted: true, message: TokenQuotaManager.getExhaustedMessage() };
        }

        if (CONSTANTS.USE_AI_PROXY) {
            const result = await callProxy(
                { type: 'event', data: { location: loc, history, uid } },
                'ai-event',
                9500
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
                9500
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
        const explicit = AI_SERVICE._fallbackEventPool[loc];
        if (explicit) {
            return explicit[Math.floor(Math.random() * explicit.length)];
        }

        const keyByKeyword = [
            { key: 'forest', words: ['숲'] },
            { key: 'ruins', words: ['폐허', '광산', '신전'] },
            { key: 'cave', words: ['동굴', '협곡'] },
            { key: 'desert', words: ['사막', '피라미드'] },
            { key: 'ice', words: ['얼음', '빙하', '설원'] },
            { key: 'dark', words: ['암흑', '마왕'] },
            { key: 'abyss', words: ['심연'] },
            { key: 'treasure', words: ['보물고'] },
            { key: 'machina', words: ['기계'] },
            { key: 'sky', words: ['천공'] },
            { key: 'deepsea', words: ['심해'] },
            { key: 'gate', words: ['에테르', '관문'] },
        ].find((entry) => entry.words.some((word) => String(loc || '').includes(word)));

        const poolKey = keyByKeyword?.key || 'default';
        const pool = AI_SERVICE._fallbackEventPool[poolKey] || AI_SERVICE._fallbackEventPool.default;
        return pool[Math.floor(Math.random() * pool.length)];
    },

    _fallbackEventPool: {
        '시작의 마을': [
            { desc: '마을 광장에서 게시판을 발견했습니다.', choices: ['확인하다', '무시한다', '다음에 보다'] },
            { desc: '낯선 상인이 수상쩍은 물건을 팔고 있습니다.', choices: ['구경하다', '의심한다', '지나친다'] },
            { desc: '마을 어른이 당신에게 심부름을 부탁합니다.', choices: ['돕는다', '거절한다'] },
        ],
        forest: [
            { desc: '나무 사이로 신비로운 빛이 흘러나옵니다.', choices: ['따라간다', '멀리서 관찰한다', '돌아선다'] },
            { desc: '오래된 석상이 덩굴에 감겨 있습니다.', choices: ['살펴본다', '정화한다', '지나친다'] },
            { desc: '반짝이는 무언가가 풀숲에 있습니다.', choices: ['줍는다', '막대기로 쑤셔본다', '무시한다'] },
        ],
        ruins: [
            { desc: '벽면에서 고대 문자가 빛나기 시작합니다.', choices: ['해독한다', '손으로 만진다', '무시한다'] },
            { desc: '바닥에 함정 흔적이 보입니다.', choices: ['조심히 넘는다', '돌아서 우회한다', '무시하고 달린다'] },
            { desc: '던전 깊숙한 곳에서 낡은 상자를 발견했습니다.', choices: ['연다', '두드려본다', '지나친다'] },
        ],
        cave: [
            { desc: '동굴 벽에 크고 날카로운 발톱 자국이 있습니다.', choices: ['추적한다', '경계한다', '되돌아간다'] },
            { desc: '암벽 틈새에서 뜨거운 기류가 뿜어져 나옵니다.', choices: ['조사한다', '피한다', '봉인한다'] },
            { desc: '발밑이 흔들리며 협곡 아래에서 금속성 소리가 울립니다.', choices: ['뛰어내린다', '밧줄 설치', '후퇴한다'] },
        ],
        desert: [
            { desc: '모래 폭풍이 갑자기 몰아칩니다.', choices: ['바위 뒤로 숨는다', '정면 돌파', '경로를 바꾼다'] },
            { desc: '반쯤 파묻힌 고대 석판을 발견했습니다.', choices: ['읽어본다', '파낸다', '표시만 남긴다'] },
            { desc: '오아시스 근처에서 수상한 발자국을 발견했습니다.', choices: ['추적한다', '매복한다', '무시한다'] },
        ],
        ice: [
            { desc: '얼어붙은 벽면 뒤에서 맥동하는 빛이 보입니다.', choices: ['깨고 들어간다', '우회한다', '표식만 남긴다'] },
            { desc: '빙하 균열 아래에서 오래된 갑옷 파편을 발견했습니다.', choices: ['회수한다', '분석한다', '두고 간다'] },
            { desc: '눈보라 속에서 구조 요청 신호가 들립니다.', choices: ['신호를 따라간다', '경계하며 접근', '철수한다'] },
        ],
        dark: [
            { desc: '검은 제단에서 속삭임이 새어 나옵니다.', choices: ['의식을 방해한다', '경청한다', '파괴한다'] },
            { desc: '성벽의 초상화가 당신을 응시합니다.', choices: ['가림막을 씌운다', '조사한다', '무시한다'] },
            { desc: '붉은 달빛이 비치는 회랑에서 핏자국이 이어집니다.', choices: ['추적한다', '함정 탐지', '후퇴'] },
        ],
        abyss: [
            { desc: '심연의 바닥에서 낮은 공명이 울립니다.', choices: ['공명점 탐색', '즉시 전투 준비', '기록 후 철수'] },
            { desc: '공허 틈에서 잠시 미래의 잔상이 보였습니다.', choices: ['잔상을 따른다', '현재에 집중', '눈을 감는다'] },
            { desc: '어둠 속에서 이름을 부르는 목소리가 들립니다.', choices: ['응답한다', '무시한다', '봉인 주문'] },
        ],
        treasure: [
            { desc: '금박 상자 주변에 미세한 함정선이 보입니다.', choices: ['해제한다', '강제로 연다', '포기한다'] },
            { desc: '보물 더미 아래에서 낡은 지도가 튀어나왔습니다.', choices: ['지도 확보', '즉시 탈출', '위조 여부 확인'] },
            { desc: '벽면 홈에 열쇠 모양의 흔적이 남아 있습니다.', choices: ['장치 작동', '메모만 남김', '파괴 시도'] },
        ],
        machina: [
            { desc: '멈춘 자동인형의 코어가 다시 점등됩니다.', choices: ['코어를 뽑는다', '재가동시킨다', '전력 차단'] },
            { desc: '톱니 장치가 어긋난 문이 반쯤 열려 있습니다.', choices: ['조정한다', '강제 개방', '다른 길 탐색'] },
            { desc: '기계 음성으로 정체 불명의 경고 방송이 울립니다.', choices: ['해독한다', '주파수 차단', '무시한다'] },
        ],
        sky: [
            { desc: '공중 정원 난간 밖에서 빛나는 파편이 떠다닙니다.', choices: ['채집한다', '거리 유지', '마력 분석'] },
            { desc: '성운의 흐름이 길을 재배치하고 있습니다.', choices: ['새 길 진입', '기존 길 고수', '표식 남김'] },
            { desc: '천공 수호조가 원형 비행 패턴을 반복합니다.', choices: ['패턴을 이용해 잠입', '기습', '우회'] },
        ],
        deepsea: [
            { desc: '심해 회랑 벽면에서 맥박 같은 진동이 느껴집니다.', choices: ['원인 조사', '장비 점검', '철수'] },
            { desc: '해류가 거꾸로 흐르며 문양을 그립니다.', choices: ['문양 기록', '직접 진입', '기다린다'] },
            { desc: '물안개 너머로 거대한 그림자가 스쳐 지나갑니다.', choices: ['추적', '은폐', '신호탄 발사'] },
        ],
        gate: [
            { desc: '관문 중앙의 룬이 순차적으로 점등됩니다.', choices: ['동조한다', '즉시 봉인', '강제 해제'] },
            { desc: '차원 틈에서 무기와 공명하는 소리가 납니다.', choices: ['공명 강화', '소리 차단', '퇴각'] },
            { desc: '문턱 너머에서 또 다른 당신의 실루엣이 보입니다.', choices: ['접촉 시도', '전투 준비', '기록 후 후퇴'] },
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
