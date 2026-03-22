const RECENT_HISTORY_LIMIT = 6;
const RECENT_EVENT_LIMIT = 8;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toInt = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback);
export const normalizeText = (value, fallback = '') => String(value || fallback).replace(/\s+/g, ' ').trim();

const normalizeChoiceText = (choice, idx) => {
    const raw = typeof choice === 'string' ? choice : choice?.text || choice?.label || `선택지 ${idx + 1}`;
    return normalizeText(raw.replace(/^\d+\s*[.)-]?\s*/, ''), `선택지 ${idx + 1}`);
};

const dedupeChoices = (choices = []) => {
    const seen = new Set();
    return choices.filter((choice) => {
        const key = normalizeText(choice).toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

export const summarizeHistory = (history = [], limit = RECENT_HISTORY_LIMIT) => (
    Array.isArray(history)
        ? history.slice(-limit).map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const event = normalizeText(entry.event || entry.desc || entry.text);
            const choice = normalizeText(entry.choice);
            const outcome = normalizeText(entry.outcome || entry.result);
            return [event, choice && `선택:${choice}`, outcome && `결과:${outcome}`].filter(Boolean).join(' / ');
        }).filter(Boolean)
        : []
);

export const getRecentEventSet = (history = [], limit = RECENT_EVENT_LIMIT) => (
    new Set(
        (Array.isArray(history) ? history : [])
            .slice(-limit)
            .map((entry) => normalizeText(entry?.event || entry?.desc || entry?.text))
            .filter(Boolean)
    )
);

const hashString = (value = '') => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

export const getPoolKeyByLocation = (loc) => {
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

    return keyByKeyword?.key || 'default';
};

const FALLBACK_CHOICE_SETS = {
    default: ['조사한다', '경계한다', '지나친다'],
    forest: ['살펴본다', '경계한다', '돌아선다'],
    ruins: ['해독한다', '조심히 접근한다', '지나친다'],
    cave: ['조사한다', '경계한다', '후퇴한다'],
    desert: ['추적한다', '우회한다', '무시한다'],
    ice: ['분석한다', '조심히 접근한다', '철수한다'],
    dark: ['조사한다', '봉인한다', '후퇴한다'],
    abyss: ['기록한다', '전투 준비', '철수한다'],
    treasure: ['해제한다', '확인한다', '포기한다'],
    machina: ['해독한다', '차단한다', '우회한다'],
    sky: ['채집한다', '분석한다', '기다린다'],
    deepsea: ['조사한다', '은폐한다', '철수한다'],
    gate: ['동조한다', '봉인한다', '후퇴한다'],
};

const ITEM_REWARD_BY_POOL = {
    default: ['하급 체력 물약', '하급 마나 물약'],
    forest: ['하급 체력 물약', '해독제'],
    ruins: ['중급 체력 물약', '저주해제 주문서'],
    cave: ['하급 체력 물약', '하급 마나 물약'],
    desert: ['중급 체력 물약', '하급 마나 물약'],
    ice: ['해빙제', '중급 체력 물약'],
    dark: ['저주해제 주문서', '중급 마나 물약'],
    abyss: ['영웅의 물약', '엘릭서'],
    treasure: ['엘릭서', '중급 체력 물약'],
    machina: ['하급 마나 물약', '중급 마나 물약'],
    sky: ['중급 마나 물약', '수호의 물약'],
    deepsea: ['중급 마나 물약', '해독제'],
    gate: ['영웅의 물약', '상급 마나 물약'],
};

const SAFE_KEYWORDS = ['관찰', '해독', '조심', '우회', '분석', '기록', '표식', '표시', '점검', '봉인', '확인', '읽', '해제', '가림막', '거리 유지', '은폐', '경계'];
const RETREAT_KEYWORDS = ['돌아', '되돌아', '후퇴', '철수', '포기', '무시', '지나친', '대기', '기다린다', '눈을 감는다', '도망'];
const RISKY_KEYWORDS = ['만진다', '달린다', '강제로', '뛰어내', '기습', '정면 돌파', '직접 진입', '접촉', '전투 준비', '파괴', '돌파', '재가동', '강제 해제', '연다', '추적', '공명 강화'];

export const classifyChoice = (choiceText = '') => {
    const choice = normalizeText(choiceText);
    if (RETREAT_KEYWORDS.some((keyword) => choice.includes(keyword))) return 'retreat';
    if (RISKY_KEYWORDS.some((keyword) => choice.includes(keyword))) return 'risky';
    if (SAFE_KEYWORDS.some((keyword) => choice.includes(keyword))) return 'safe';
    return 'balanced';
};

const pickRewardItem = (poolKey, seed, level) => {
    const pool = ITEM_REWARD_BY_POOL[poolKey] || ITEM_REWARD_BY_POOL.default;
    if (!pool || pool.length === 0) return null;
    const threshold = level >= 25 ? 3 : level >= 10 ? 4 : 5;
    if ((seed % threshold) !== 0) return null;
    return pool[seed % pool.length];
};

const buildProceduralOutcome = ({ desc, choice, choiceIndex, context = {} }) => {
    const seed = hashString(`${context.location || ''}|${desc}|${choice}|${choiceIndex}`);
    const style = classifyChoice(choice);
    const level = Math.max(1, toInt(context?.playerSnapshot?.level || context?.mapSnapshot?.level || 1, 1));
    const maxHp = Math.max(80, toInt(context?.playerSnapshot?.maxHp || 120, 120));
    const maxMp = Math.max(50, toInt(context?.playerSnapshot?.maxMp || 60, 60));
    const poolKey = getPoolKeyByLocation(context.location);
    const baseReward = 10 + (level * 8);

    if (style === 'retreat') {
        const hpRecovery = Math.max(6, Math.floor(maxHp * 0.05));
        const mpRecovery = Math.max(8, Math.floor(maxMp * 0.08));
        const recoverHp = seed % 2 === 0;
        return {
            choiceIndex,
            gold: 0,
            exp: Math.max(6, Math.floor(baseReward * 0.35)),
            hp: recoverHp ? hpRecovery : 0,
            mp: recoverHp ? 0 : mpRecovery,
            log: recoverHp
                ? '위험을 피하며 호흡을 가다듬었습니다. 작은 상처가 아물었습니다.'
                : '충돌을 피하고 전열을 정비했습니다. 정신력이 안정됩니다.'
        };
    }

    if (style === 'safe') {
        const item = pickRewardItem(poolKey, seed, level);
        return {
            choiceIndex,
            gold: Math.max(12, Math.floor(baseReward * 0.7)),
            exp: Math.max(10, Math.floor(baseReward * 0.9)),
            hp: 0,
            mp: Math.max(6, Math.floor(maxMp * 0.05)),
            ...(item ? { item } : {}),
            log: item
                ? `신중한 대응이 통했습니다. 단서를 따라 [${item}]까지 확보했습니다.`
                : '신중한 대응이 통했습니다. 큰 위험 없이 성과를 챙겼습니다.'
        };
    }

    if (style === 'risky') {
        const backlash = Math.max(8, Math.floor(maxHp * (seed % 2 === 0 ? 0.08 : 0.12)));
        const jackpot = seed % 3 !== 0;
        const item = jackpot ? pickRewardItem(poolKey, seed + 7, level + 5) : null;
        return {
            choiceIndex,
            gold: jackpot ? Math.max(20, Math.floor(baseReward * 1.45)) : Math.max(0, Math.floor(baseReward * 0.35)),
            exp: jackpot ? Math.max(18, Math.floor(baseReward * 1.2)) : Math.max(10, Math.floor(baseReward * 0.55)),
            hp: jackpot ? 0 : -backlash,
            mp: jackpot ? 0 : Math.max(0, Math.floor(maxMp * 0.04)),
            ...(jackpot && item ? { item } : {}),
            log: jackpot
                ? `대담한 선택이 적중했습니다. 위험을 감수한 만큼 큰 성과를 얻었습니다${item ? ` [${item}]도 손에 넣었습니다.` : '.'}`
                : '무리한 판단이 화를 불렀습니다. 대가를 치렀지만 약간의 실마리는 남겼습니다.'
        };
    }

    const balancedGain = seed % 2 === 0;
    return {
        choiceIndex,
        gold: balancedGain ? Math.max(14, Math.floor(baseReward * 0.85)) : Math.max(8, Math.floor(baseReward * 0.45)),
        exp: balancedGain ? Math.max(14, Math.floor(baseReward)) : Math.max(10, Math.floor(baseReward * 0.65)),
        hp: balancedGain ? 0 : -Math.max(6, Math.floor(maxHp * 0.05)),
        mp: balancedGain ? Math.max(5, Math.floor(maxMp * 0.05)) : 0,
        log: balancedGain
            ? '균형 잡힌 판단으로 안정적인 성과를 거두었습니다.'
            : '성과는 있었지만 완벽하진 않았습니다. 약간의 대가를 치렀습니다.'
    };
};

const normalizeOutcomes = (rawOutcomes = [], choices = [], context = {}) => {
    const normalized = new Map();

    if (Array.isArray(rawOutcomes)) {
        rawOutcomes.forEach((outcome, idx) => {
            if (!outcome || typeof outcome !== 'object') return;
            const choiceIndex = clamp(toInt(outcome.choiceIndex, idx), 0, Math.max(0, choices.length - 1));
            if (!choices[choiceIndex] || normalized.has(choiceIndex)) return;

            normalized.set(choiceIndex, {
                choiceIndex,
                log: normalizeText(outcome.log || outcome.result || outcome.text, '선택의 결과가 반영되었습니다.'),
                gold: toInt(outcome.gold, 0),
                exp: toInt(outcome.exp, 0),
                hp: toInt(outcome.hp, 0),
                mp: toInt(outcome.mp, 0),
                ...(normalizeText(outcome.item) ? { item: normalizeText(outcome.item) } : {}),
            });
        });
    }

    choices.forEach((choice, idx) => {
        if (normalized.has(idx)) return;
        normalized.set(idx, buildProceduralOutcome({
            desc: context.desc || '',
            choice,
            choiceIndex: idx,
            context
        }));
    });

    return [...normalized.values()].sort((a, b) => a.choiceIndex - b.choiceIndex);
};

export const buildEventPackage = (payload, context = {}) => {
    const raw = payload?.data || payload;
    if (!raw || typeof raw !== 'object') return null;

    const desc = normalizeText(raw.desc || raw.text || raw.event || raw.message);
    if (!desc) return null;

    const poolKey = getPoolKeyByLocation(context.location);
    const fallbackChoices = FALLBACK_CHOICE_SETS[poolKey] || FALLBACK_CHOICE_SETS.default;
    const rawChoices = Array.isArray(raw.choices)
        ? raw.choices.map((choice, idx) => normalizeChoiceText(choice, idx))
        : [];
    const choices = dedupeChoices([...rawChoices, ...fallbackChoices]).slice(0, 3);

    if (choices.length < 2) return null;

    return {
        ...raw,
        source: raw.source || context.source || 'ai',
        desc,
        choices,
        outcomes: normalizeOutcomes(raw.outcomes, choices, { ...context, desc })
    };
};

const FALLBACK_EVENT_POOL = {
    '시작의 마을': [
        { desc: '마을 광장에서 게시판을 발견했습니다.', choices: ['확인하다', '무시한다', '다음에 보다'] },
        { desc: '낯선 상인이 수상쩍은 물건을 팔고 있습니다.', choices: ['구경하다', '의심한다', '지나친다'] },
        { desc: '마을 어른이 당신에게 심부름을 부탁합니다.', choices: ['돕는다', '거절한다'] },
        { desc: '우물 근처에서 아이가 울고 있습니다.', choices: ['달래준다', '어른을 찾는다', '지나친다'] },
        { desc: '여관 벽에 현상 수배 전단이 붙어 있습니다.', choices: ['읽어본다', '뜯어낸다', '무시한다'] },
        { desc: '마을 외곽 울타리에 수상한 기호가 새겨져 있습니다.', choices: ['해독한다', '지워버린다', '기록만 남긴다'] },
    ],
    forest: [
        { desc: '나무 사이로 신비로운 빛이 흘러나옵니다.', choices: ['따라간다', '멀리서 관찰한다', '돌아선다'] },
        { desc: '오래된 석상이 덩굴에 감겨 있습니다.', choices: ['살펴본다', '정화한다', '지나친다'] },
        { desc: '반짝이는 무언가가 풀숲에 있습니다.', choices: ['줍는다', '막대기로 쑤셔본다', '무시한다'] },
        { desc: '커다란 버섯군락이 고리 모양으로 자라 있습니다.', choices: ['안으로 들어간다', '주변을 분석한다', '우회한다'] },
        { desc: '낯선 문양이 새겨진 나무가 있습니다. 수액이 금빛으로 빛납니다.', choices: ['수액을 채취한다', '문양을 기록한다', '지나친다'] },
        { desc: '숲 속 빈터에서 불씨가 꺼진 모닥불을 발견했습니다.', choices: ['흔적을 조사한다', '불씨를 살린다', '경계한다'] },
    ],
    ruins: [
        { desc: '벽면에서 고대 문자가 빛나기 시작합니다.', choices: ['해독한다', '손으로 만진다', '무시한다'] },
        { desc: '바닥에 함정 흔적이 보입니다.', choices: ['조심히 넘는다', '돌아서 우회한다', '무시하고 달린다'] },
        { desc: '던전 깊숙한 곳에서 낡은 상자를 발견했습니다.', choices: ['연다', '두드려본다', '지나친다'] },
        { desc: '천장에서 물방울이 규칙적으로 떨어집니다. 바닥 문양이 드러납니다.', choices: ['문양을 해독한다', '조심히 밟는다', '우회 경로 탐색'] },
        { desc: '돌기둥에 낡은 방패가 기대어 있습니다.', choices: ['장비로 취한다', '각인을 분석한다', '건드리지 않는다'] },
        { desc: '무너진 제단 위에 봉인된 두루마리가 놓여 있습니다.', choices: ['봉인을 해제한다', '두루마리만 가져간다', '그대로 둔다'] },
    ],
    cave: [
        { desc: '동굴 벽에 크고 날카로운 발톱 자국이 있습니다.', choices: ['추적한다', '경계한다', '되돌아간다'] },
        { desc: '암벽 틈새에서 뜨거운 기류가 뿜어져 나옵니다.', choices: ['조사한다', '피한다', '봉인한다'] },
        { desc: '발밑이 흔들리며 협곡 아래에서 금속성 소리가 울립니다.', choices: ['뛰어내린다', '밧줄 설치', '후퇴한다'] },
        { desc: '동굴 천장에 수백 개의 보석 같은 눈이 빛납니다.', choices: ['소리 없이 접근한다', '불빛으로 유인한다', '돌아선다'] },
        { desc: '지하 수맥 근처에서 희귀한 광물 결정이 보입니다.', choices: ['채굴한다', '분석만 한다', '지나친다'] },
        { desc: '협곡 절벽에 오래된 로프가 매달려 있습니다.', choices: ['타고 내려간다', '로프 상태 점검', '다른 길을 찾는다'] },
    ],
    desert: [
        { desc: '모래 폭풍이 갑자기 몰아칩니다.', choices: ['바위 뒤로 숨는다', '정면 돌파', '경로를 바꾼다'] },
        { desc: '반쯤 파묻힌 고대 석판을 발견했습니다.', choices: ['읽어본다', '파낸다', '표시만 남긴다'] },
        { desc: '오아시스 근처에서 수상한 발자국을 발견했습니다.', choices: ['추적한다', '매복한다', '무시한다'] },
        { desc: '모래 아래에서 손잡이 하나가 솟아 있습니다.', choices: ['잡아당긴다', '주변을 먼저 살핀다', '그대로 둔다'] },
        { desc: '일렬로 늘어선 거대 석상들이 모두 동쪽을 가리키고 있습니다.', choices: ['동쪽으로 향한다', '석상 각인을 기록한다', '다른 방향으로 간다'] },
        { desc: '뜨거운 모래 위에서 상인의 낡은 배낭을 발견했습니다.', choices: ['열어본다', '지형 단서 탐색', '그냥 지나친다'] },
    ],
    ice: [
        { desc: '얼어붙은 벽면 뒤에서 맥동하는 빛이 보입니다.', choices: ['깨고 들어간다', '우회한다', '표식만 남긴다'] },
        { desc: '빙하 균열 아래에서 오래된 갑옷 파편을 발견했습니다.', choices: ['회수한다', '분석한다', '두고 간다'] },
        { desc: '눈보라 속에서 구조 요청 신호가 들립니다.', choices: ['신호를 따라간다', '경계하며 접근', '철수한다'] },
        { desc: '얼음 속에 완벽하게 보존된 고대 전사가 봉인되어 있습니다.', choices: ['해빙시킨다', '유물만 확인한다', '건드리지 않는다'] },
        { desc: '설원 한가운데 불꽃이 꺼지지 않는 횃불이 타오릅니다.', choices: ['가까이 다가간다', '멀리서 관찰한다', '다른 길로 간다'] },
        { desc: '얼어붙은 호수 표면에 무언가가 아래에서 두드립니다.', choices: ['조심히 살펴본다', '얼음을 깬다', '재빨리 피한다'] },
    ],
    dark: [
        { desc: '검은 제단에서 속삭임이 새어 나옵니다.', choices: ['의식을 방해한다', '경청한다', '파괴한다'] },
        { desc: '성벽의 초상화가 당신을 응시합니다.', choices: ['가림막을 씌운다', '조사한다', '무시한다'] },
        { desc: '붉은 달빛이 비치는 회랑에서 핏자국이 이어집니다.', choices: ['추적한다', '함정 탐지', '후퇴'] },
        { desc: '마왕성 한켠에서 갑옷도 없이 기절한 기사를 발견했습니다.', choices: ['치료한다', '심문한다', '내버려둔다'] },
        { desc: '어둠 속 거울이 당신의 모습 대신 다른 무언가를 비춥니다.', choices: ['거울을 깬다', '오래 들여다본다', '뒤돌아선다'] },
        { desc: '해골 더미 속에서 아직 빛을 잃지 않은 수정 구슬이 있습니다.', choices: ['가져간다', '정화 주문을 건다', '손대지 않는다'] },
    ],
    abyss: [
        { desc: '심연의 바닥에서 낮은 공명이 울립니다.', choices: ['공명점 탐색', '즉시 전투 준비', '기록 후 철수'] },
        { desc: '공허 틈에서 잠시 미래의 잔상이 보였습니다.', choices: ['잔상을 따른다', '현재에 집중', '눈을 감는다'] },
        { desc: '어둠 속에서 이름을 부르는 목소리가 들립니다.', choices: ['응답한다', '무시한다', '봉인 주문'] },
        { desc: '공간이 접혀 짧은 거리가 두 방향으로 갈라집니다.', choices: ['왼쪽 공간으로 진입', '오른쪽 공간으로 진입', '현재 위치 유지'] },
        { desc: '무중력 구역에 둥둥 떠 있는 고대 유물 파편들이 보입니다.', choices: ['모아서 분석한다', '하나만 가져간다', '건드리지 않는다'] },
        { desc: '심연의 안개 속에서 익숙한 실루엣이 걸어옵니다.', choices: ['대기한다', '소리친다', '전투 태세를 갖춘다'] },
    ],
    treasure: [
        { desc: '금박 상자 주변에 미세한 함정선이 보입니다.', choices: ['해제한다', '강제로 연다', '포기한다'] },
        { desc: '보물 더미 아래에서 낡은 지도가 튀어나왔습니다.', choices: ['지도 확보', '즉시 탈출', '위조 여부 확인'] },
        { desc: '벽면 홈에 열쇠 모양의 흔적이 남아 있습니다.', choices: ['장치 작동', '메모만 남김', '파괴 시도'] },
        { desc: '상자 안에 편지와 반지가 같이 들어 있습니다.', choices: ['편지를 읽는다', '반지를 낀다', '두 가지 모두 챙긴다'] },
        { desc: '보석이 박힌 문이 잠겨 있고 수수께끼 문구가 새겨져 있습니다.', choices: ['수수께끼를 푼다', '문을 부순다', '우회 경로를 찾는다'] },
        { desc: '보물고 한켠에 오래된 제단이 있습니다. 헌물을 바라는 듯합니다.', choices: ['골드를 바친다', '소지품을 바친다', '무시한다'] },
    ],
    machina: [
        { desc: '멈춘 자동인형의 코어가 다시 점등됩니다.', choices: ['코어를 뽑는다', '재가동시킨다', '전력 차단'] },
        { desc: '톱니 장치가 어긋난 문이 반쯤 열려 있습니다.', choices: ['조정한다', '강제 개방', '다른 길 탐색'] },
        { desc: '기계 음성으로 정체 불명의 경고 방송이 울립니다.', choices: ['해독한다', '주파수 차단', '무시한다'] },
        { desc: '폐기된 드론의 메모리 칩이 아직 살아 있습니다.', choices: ['데이터를 추출한다', '전원을 살린다', '분해한다'] },
        { desc: '제어 패널에 미완성 명령어 입력 화면이 켜져 있습니다.', choices: ['명령어를 완성한다', '시스템을 종료한다', '방치한다'] },
        { desc: '기계 폐도 깊은 곳에서 혼자 가동 중인 수리 봇을 발견했습니다.', choices: ['접근해 관찰한다', '업무 지시를 내린다', '전원을 끊는다'] },
    ],
    sky: [
        { desc: '공중 정원 난간 밖에서 빛나는 파편이 떠다닙니다.', choices: ['채집한다', '거리 유지', '마력 분석'] },
        { desc: '성운의 흐름이 길을 재배치하고 있습니다.', choices: ['새 길 진입', '기존 길 고수', '표식 남김'] },
        { desc: '천공 수호조가 원형 비행 패턴을 반복합니다.', choices: ['패턴을 이용해 잠입', '기습', '우회'] },
        { desc: '구름 위 발판에 작은 제단이 홀로 떠 있습니다.', choices: ['제단에 예를 올린다', '구조를 조사한다', '스쳐 지나간다'] },
        { desc: '하늘 결정체가 천천히 당신의 손 위로 내려앉습니다.', choices: ['흡수한다', '조심스럽게 채취한다', '떨쳐낸다'] },
        { desc: '바람이 멈춘 공중 구역에서 아무 소리도 들리지 않습니다.', choices: ['조용히 탐색한다', '소리를 내서 반응 확인', '빠르게 통과한다'] },
    ],
    deepsea: [
        { desc: '심해 회랑 벽면에서 맥박 같은 진동이 느껴집니다.', choices: ['원인 조사', '장비 점검', '철수'] },
        { desc: '해류가 거꾸로 흐르며 문양을 그립니다.', choices: ['문양 기록', '직접 진입', '기다린다'] },
        { desc: '물안개 너머로 거대한 그림자가 스쳐 지나갑니다.', choices: ['추적', '은폐', '신호탄 발사'] },
        { desc: '산호 군락 사이에서 빛을 발하는 고대 석판이 보입니다.', choices: ['회수한다', '현장에서 해독한다', '사진만 남긴다'] },
        { desc: '수중 동굴 입구에 오래된 닻이 사슬로 묶여 있습니다.', choices: ['사슬을 푼다', '닻 각인을 기록한다', '다른 경로를 탐색한다'] },
        { desc: '유리처럼 투명한 생물이 당신을 감싸듯 맴돌기 시작합니다.', choices: ['가만히 있는다', '쫓아낸다', '뒤따라간다'] },
    ],
    gate: [
        { desc: '관문 중앙의 룬이 순차적으로 점등됩니다.', choices: ['동조한다', '즉시 봉인', '강제 해제'] },
        { desc: '차원 틈에서 무기와 공명하는 소리가 납니다.', choices: ['공명 강화', '소리 차단', '퇴각'] },
        { desc: '문턱 너머에서 또 다른 당신의 실루엣이 보입니다.', choices: ['접촉 시도', '전투 준비', '기록 후 후퇴'] },
        { desc: '에테르 에너지가 소용돌이치며 단편적인 언어를 내뱉습니다.', choices: ['언어를 해독한다', '에너지를 흡수한다', '거리를 둔다'] },
        { desc: '관문 바닥에 희생의 흔적과 함께 강화 문양이 새겨져 있습니다.', choices: ['문양에 에너지를 주입한다', '문양을 기록한다', '즉시 봉인한다'] },
        { desc: '에테르 관문 너머에서 아직 도달하지 않은 지형이 흐릿하게 비칩니다.', choices: ['투시를 지속한다', '정보를 빠르게 메모한다', '시선을 차단한다'] },
    ],
    default: [
        { desc: '오래된 석상이 덩굴에 감겨 있습니다.', choices: ['살펴본다', '지나친다'] },
        { desc: '버려진 야영지 흔적을 발견했습니다.', choices: ['뒤져본다', '휴식한다'] },
        { desc: '반짝이는 무언가가 풀숲에 있습니다.', choices: ['줍는다', '무시한다'] },
        { desc: '낡은 표지판 하나가 길가에 쓰러져 있습니다.', choices: ['읽어본다', '세워놓는다', '지나친다'] },
        { desc: '멀리서 이상한 소리가 들려옵니다.', choices: ['확인한다', '경계한다', '도망간다'] },
        { desc: '길 한쪽에 금이 간 항아리가 있습니다. 안에서 빛이 새어 나옵니다.', choices: ['열어본다', '깨뜨린다', '그냥 지나친다'] },
        { desc: '낯선 여행자가 지름길을 알려주겠다고 합니다.', choices: ['따라간다', '경계하며 거절한다', '지켜본다'] },
    ],
};

export const pickFallbackEvent = (loc, history = [], context = {}) => {
    const explicit = FALLBACK_EVENT_POOL[loc];
    const poolKey = explicit ? loc : getPoolKeyByLocation(loc);
    const pool = explicit || FALLBACK_EVENT_POOL[poolKey] || FALLBACK_EVENT_POOL.default;
    const recentEvents = getRecentEventSet(history);
    const lastEvent = normalizeText((Array.isArray(history) ? history[history.length - 1] : null)?.event);
    const filteredPool = pool.filter((event) => !recentEvents.has(normalizeText(event?.desc)));
    const withoutImmediateRepeat = (filteredPool.length > 0 ? filteredPool : pool)
        .filter((event) => normalizeText(event?.desc) !== lastEvent);
    const candidates = withoutImmediateRepeat.length > 0
        ? withoutImmediateRepeat
        : (filteredPool.length > 0 ? filteredPool : pool);
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    return buildEventPackage(
        { ...picked, source: 'fallback' },
        { ...context, location: loc, source: 'fallback' }
    );
};
