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
        { key: 'cave', words: ['동굴', '협곡', '미궁'] },
        { key: 'desert', words: ['사막', '피라미드'] },
        { key: 'ice', words: ['얼음', '빙하', '설원'] },
        { key: 'dark', words: ['암흑', '마왕', '영혼의 강', '저주'] },
        { key: 'abyss', words: ['심연'] },
        { key: 'treasure', words: ['보물고', '황금 왕국'] },
        { key: 'machina', words: ['기계', '금지된 도서관'] },
        { key: 'sky', words: ['천공', '공중 신전'] },
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
        { desc: '대장장이가 망치를 내려놓으며 당신을 유심히 바라봅니다. "그 장비, 내가 손봐줄 수 있소."', choices: ['부탁한다', '정중히 거절한다', '장비를 보여준다'] },
        { desc: '마을 약초상 앞에 희귀 식물이 진열되어 있습니다. 상인은 자리를 비운 상태입니다.', choices: ['기다린다', '쪽지를 남긴다', '하나 집어든다'] },
        { desc: '여관 뒤편 골목에서 두 사람이 낮은 목소리로 대화를 나눕니다. "그 유물은 절대 남에게 팔지 말아야 해..."', choices: ['몰래 엿듣는다', '모른 척 지나간다', '말을 건다'] },
        { desc: '마을 입구의 석상 발치에 누군가 최근 꽃을 바친 흔적이 있습니다.', choices: ['석상에 경의를 표한다', '꽃을 조사한다', '지나친다'] },
        { desc: '술에 취한 노병이 지나가다 당신의 팔을 잡습니다. "나는 마왕성에서 살아 돌아왔다오. 진짜 무서운 건 따로 있지."', choices: ['이야기를 듣는다', '부드럽게 떼어낸다', '자리를 피한다'] },
        { desc: '마을 시장 한켠에서 수련 도중인 젊은 마법사가 주문을 잘못 시전해 혼란에 빠졌습니다.', choices: ['도와준다', '구경한다', '위험하니 피한다'] },
    ],
    forest: [
        { desc: '나무 사이로 신비로운 빛이 흘러나옵니다.', choices: ['따라간다', '멀리서 관찰한다', '돌아선다'] },
        { desc: '오래된 석상이 덩굴에 감겨 있습니다.', choices: ['살펴본다', '정화한다', '지나친다'] },
        { desc: '반짝이는 무언가가 풀숲에 있습니다.', choices: ['줍는다', '막대기로 쑤셔본다', '무시한다'] },
        { desc: '커다란 버섯군락이 고리 모양으로 자라 있습니다.', choices: ['안으로 들어간다', '주변을 분석한다', '우회한다'] },
        { desc: '낯선 문양이 새겨진 나무가 있습니다. 수액이 금빛으로 빛납니다.', choices: ['수액을 채취한다', '문양을 기록한다', '지나친다'] },
        { desc: '숲 속 빈터에서 불씨가 꺼진 모닥불을 발견했습니다.', choices: ['흔적을 조사한다', '불씨를 살린다', '경계한다'] },
        { desc: '거대한 고목 뿌리 사이에 반투명한 결계가 쳐져 있습니다. 안쪽에서 무언가 빛납니다.', choices: ['결계를 통과한다', '결계 주변을 살핀다', '그냥 지나친다'] },
        { desc: '숲 깊숙한 곳에서 기계음과 자연음이 뒤섞인 이상한 소리가 납니다.', choices: ['소리를 추적한다', '나무 위로 올라가 살핀다', '돌아선다'] },
        { desc: '쓰러진 고목 위에서 이끼로 덮인 갑옷 한 쪽이 발견되었습니다. 내부에 잔열이 남아 있습니다.', choices: ['갑옷을 살펴본다', '주변 흔적을 탐색한다', '건드리지 않는다'] },
        { desc: '동물들이 일제히 동쪽으로 도망칩니다. 서쪽에서 짙은 연기 냄새가 납니다.', choices: ['서쪽으로 향한다', '동물들을 따라간다', '나무 위에서 관망한다'] },
        { desc: '숲의 정령으로 보이는 작은 존재가 당신의 발 앞에 씨앗 하나를 떨어뜨리고 사라집니다.', choices: ['씨앗을 간직한다', '씨앗을 심는다', '두고 간다'] },
        { desc: '낡은 사냥꾼의 덫이 길 한가운데 숨겨져 있습니다. 이미 작동 직전입니다.', choices: ['덫을 해제한다', '표시만 남긴다', '조심히 우회한다'] },
    ],
    ruins: [
        { desc: '벽면에서 고대 문자가 빛나기 시작합니다.', choices: ['해독한다', '손으로 만진다', '무시한다'] },
        { desc: '바닥에 함정 흔적이 보입니다.', choices: ['조심히 넘는다', '돌아서 우회한다', '무시하고 달린다'] },
        { desc: '던전 깊숙한 곳에서 낡은 상자를 발견했습니다.', choices: ['연다', '두드려본다', '지나친다'] },
        { desc: '천장에서 물방울이 규칙적으로 떨어집니다. 바닥 문양이 드러납니다.', choices: ['문양을 해독한다', '조심히 밟는다', '우회 경로 탐색'] },
        { desc: '돌기둥에 낡은 방패가 기대어 있습니다.', choices: ['장비로 취한다', '각인을 분석한다', '건드리지 않는다'] },
        { desc: '무너진 제단 위에 봉인된 두루마리가 놓여 있습니다.', choices: ['봉인을 해제한다', '두루마리만 가져간다', '그대로 둔다'] },
        { desc: '유적 회랑 끝에 여전히 타오르는 횃불이 있습니다. 누군가 최근에 여기 있었던 것 같습니다.', choices: ['발자국을 추적한다', '불을 끄고 어둠 속에서 대기한다', '횃불을 가져간다'] },
        { desc: '반파된 석상의 손이 특정 방향을 가리키고 있습니다. 손가락 끝은 새로 깎인 흔적이 있습니다.', choices: ['가리키는 방향으로 간다', '석상 받침대를 조사한다', '무시한다'] },
        { desc: '유적 벽면에 전투 장면을 묘사한 부조가 있습니다. 그림 속 마지막 장면은 미완성입니다.', choices: ['미완성 부분에 손을 댄다', '전체 내용을 기록한다', '지나친다'] },
        { desc: '두 개의 통로가 갈리는 지점에 골격 유해가 앉아 있습니다. 오른손에 쪽지를 쥐고 있습니다.', choices: ['쪽지를 읽는다', '골격 소지품을 확인한다', '조심스럽게 우회한다'] },
        { desc: '기계식 장치가 내장된 고대 문이 버튼 입력을 기다리는 듯합니다. 버튼은 세 개입니다.', choices: ['왼쪽 버튼을 누른다', '가운데 버튼을 누른다', '오른쪽 버튼을 누른다'] },
        { desc: '유적 지하에서 올라오는 바람에서 이상한 약초 향이 납니다. 지하로 내려가는 계단이 보입니다.', choices: ['계단을 내려간다', '향의 출처를 추적한다', '지상에 머문다'] },
    ],
    cave: [
        { desc: '동굴 벽에 크고 날카로운 발톱 자국이 있습니다.', choices: ['추적한다', '경계한다', '되돌아간다'] },
        { desc: '암벽 틈새에서 뜨거운 기류가 뿜어져 나옵니다.', choices: ['조사한다', '피한다', '봉인한다'] },
        { desc: '발밑이 흔들리며 협곡 아래에서 금속성 소리가 울립니다.', choices: ['뛰어내린다', '밧줄 설치', '후퇴한다'] },
        { desc: '동굴 천장에 수백 개의 보석 같은 눈이 빛납니다.', choices: ['소리 없이 접근한다', '불빛으로 유인한다', '돌아선다'] },
        { desc: '지하 수맥 근처에서 희귀한 광물 결정이 보입니다.', choices: ['채굴한다', '분석만 한다', '지나친다'] },
        { desc: '협곡 절벽에 오래된 로프가 매달려 있습니다.', choices: ['타고 내려간다', '로프 상태 점검', '다른 길을 찾는다'] },
        { desc: '동굴 깊숙이에서 붉은 용암이 서서히 흘러내리고 있습니다. 열기가 뜨겁습니다.', choices: ['가까이 다가간다', '열기를 이용해 불을 밝힌다', '멀리 우회한다'] },
        { desc: '박쥐 떼가 갑자기 당신을 향해 돌진합니다. 어딘가 놀란 것 같습니다.', choices: ['납작 엎드린다', '횃불로 쫓아낸다', '재빨리 달린다'] },
        { desc: '낡은 광부의 등잔이 아직도 켜져 있습니다. 근처에 도구 가방이 있습니다.', choices: ['가방을 뒤진다', '등잔 기름을 채운다', '그대로 두고 간다'] },
        { desc: '동굴 한쪽 벽에 누군가 손톱으로 날짜를 새긴 흔적이 빼곡합니다. 가장 마지막 날짜는 얼마 전입니다.', choices: ['세어본다', '주변을 수색한다', '서둘러 지나간다'] },
        { desc: '지하 호수 수면에 거꾸로 비친 달빛이 보입니다. 이곳은 지하인데.', choices: ['물속을 들여다본다', '수면에 돌을 던진다', '눈을 감고 집중한다'] },
        { desc: '좁은 통로 너머에서 부드러운 바람이 불어옵니다. 출구가 있는 것 같습니다.', choices: ['통로를 기어간다', '통로를 넓힌다', '다른 길을 탐색한다'] },
    ],
    desert: [
        { desc: '모래 폭풍이 갑자기 몰아칩니다.', choices: ['바위 뒤로 숨는다', '정면 돌파', '경로를 바꾼다'] },
        { desc: '반쯤 파묻힌 고대 석판을 발견했습니다.', choices: ['읽어본다', '파낸다', '표시만 남긴다'] },
        { desc: '오아시스 근처에서 수상한 발자국을 발견했습니다.', choices: ['추적한다', '매복한다', '무시한다'] },
        { desc: '모래 아래에서 손잡이 하나가 솟아 있습니다.', choices: ['잡아당긴다', '주변을 먼저 살핀다', '그대로 둔다'] },
        { desc: '일렬로 늘어선 거대 석상들이 모두 동쪽을 가리키고 있습니다.', choices: ['동쪽으로 향한다', '석상 각인을 기록한다', '다른 방향으로 간다'] },
        { desc: '뜨거운 모래 위에서 상인의 낡은 배낭을 발견했습니다.', choices: ['열어본다', '지형 단서 탐색', '그냥 지나친다'] },
        { desc: '사막 한가운데 기묘하게도 그림자가 없는 인물이 서 있습니다. 당신을 향해 손짓합니다.', choices: ['다가간다', '뒤로 물러선다', '소리쳐 부른다'] },
        { desc: '모래 더미 아래에서 옛 왕조의 문장이 새겨진 투구가 노출되어 있습니다.', choices: ['발굴한다', '문장을 기록한다', '모래로 다시 덮는다'] },
        { desc: '황혼 무렵 지평선에서 불길이 피어오릅니다. 캐러밴이 공격받고 있는 것 같습니다.', choices: ['구하러 달려간다', '망원경으로 관찰한다', '안전한 방향으로 우회한다'] },
        { desc: '모래시계 모양의 천연 암석 사이에 봉인된 항아리가 끼워져 있습니다.', choices: ['항아리를 꺼낸다', '봉인 문양을 해독한다', '암석 뒤를 조사한다'] },
        { desc: '밤하늘을 올려다보니 별자리가 지금껏 본 적 없는 형태를 그리고 있습니다.', choices: ['별자리를 기록한다', '별이 가리키는 방향으로 간다', '눈을 감고 위험을 감지한다'] },
        { desc: '낮은 언덕 너머에 낡은 망루가 보입니다. 꼭대기에서 깃발이 힘없이 나부낍니다.', choices: ['망루에 오른다', '망루를 멀리서 관찰한다', '지나쳐 간다'] },
    ],
    ice: [
        { desc: '얼어붙은 벽면 뒤에서 맥동하는 빛이 보입니다.', choices: ['깨고 들어간다', '우회한다', '표식만 남긴다'] },
        { desc: '빙하 균열 아래에서 오래된 갑옷 파편을 발견했습니다.', choices: ['회수한다', '분석한다', '두고 간다'] },
        { desc: '눈보라 속에서 구조 요청 신호가 들립니다.', choices: ['신호를 따라간다', '경계하며 접근', '철수한다'] },
        { desc: '얼음 속에 완벽하게 보존된 고대 전사가 봉인되어 있습니다.', choices: ['해빙시킨다', '유물만 확인한다', '건드리지 않는다'] },
        { desc: '설원 한가운데 불꽃이 꺼지지 않는 횃불이 타오릅니다.', choices: ['가까이 다가간다', '멀리서 관찰한다', '다른 길로 간다'] },
        { desc: '얼어붙은 호수 표면에 무언가가 아래에서 두드립니다.', choices: ['조심히 살펴본다', '얼음을 깬다', '재빨리 피한다'] },
        { desc: '빙결 협곡에서 늑대 한 마리가 발이 얼어 꼼짝 못하고 있습니다.', choices: ['얼음을 녹여 구한다', '식량으로 취한다', '그냥 지나친다'] },
        { desc: '얼음으로 뒤덮인 비석에 인명부가 새겨져 있습니다. 당신의 이름도 있습니다.', choices: ['이름을 지운다', '비석을 부순다', '눈을 감고 기도한다'] },
        { desc: '설원 한쪽에서 수증기가 솟아오릅니다. 온천이 있는 것 같습니다.', choices: ['온천에서 휴식한다', '열원의 원인을 조사한다', '계속 이동한다'] },
        { desc: '눈밭에서 완전히 얼어붙은 마법 지팡이를 발견했습니다. 내부에서 빛이 깜빡입니다.', choices: ['해빙 주문을 건다', '천천히 녹인다', '충격으로 꺼낸다'] },
        { desc: '절벽 아래 눈더미에 최근 추락한 듯한 흔적이 있습니다. 뭔가 묻혀 있습니다.', choices: ['눈을 파헤친다', '추락 경위를 분석한다', '위험을 피해 지나간다'] },
        { desc: '차가운 안개 속에서 어린아이의 노랫소리가 들려옵니다.', choices: ['소리를 따라간다', '귀를 막고 계속 전진한다', '노래로 응답한다'] },
    ],
    dark: [
        { desc: '검은 제단에서 속삭임이 새어 나옵니다.', choices: ['의식을 방해한다', '경청한다', '파괴한다'] },
        { desc: '성벽의 초상화가 당신을 응시합니다.', choices: ['가림막을 씌운다', '조사한다', '무시한다'] },
        { desc: '붉은 달빛이 비치는 회랑에서 핏자국이 이어집니다.', choices: ['추적한다', '함정 탐지', '후퇴'] },
        { desc: '마왕성 한켠에서 갑옷도 없이 기절한 기사를 발견했습니다.', choices: ['치료한다', '심문한다', '내버려둔다'] },
        { desc: '어둠 속 거울이 당신의 모습 대신 다른 무언가를 비춥니다.', choices: ['거울을 깬다', '오래 들여다본다', '뒤돌아선다'] },
        { desc: '해골 더미 속에서 아직 빛을 잃지 않은 수정 구슬이 있습니다.', choices: ['가져간다', '정화 주문을 건다', '손대지 않는다'] },
        { desc: '마왕성 지하 감옥에서 누군가 문을 두드리고 있습니다. "제발... 열어주세요."', choices: ['문을 연다', '대화를 나눈다', '자물쇠를 확인한다'] },
        { desc: '타오르는 검은 촛불이 일렬로 놓인 복도를 발견했습니다. 어떤 의식의 흔적 같습니다.', choices: ['촛불을 모두 끈다', '의식 기록을 찾는다', '서둘러 지나간다'] },
        { desc: '어두운 방에서 낡은 음악 상자가 혼자 돌아가고 있습니다. 멜로디가 어딘가 낯섭니다.', choices: ['상자를 멈춘다', '멜로디를 듣는다', '상자를 가져간다'] },
        { desc: '저주받은 무기들이 벽에 전시되어 있습니다. 하나가 당신을 향해 진동하고 있습니다.', choices: ['진동하는 무기를 집는다', '모두 무너뜨린다', '조심히 빠져나간다'] },
        { desc: '암흑 성의 지붕 위에 올라서자 멀리 희미한 불빛이 보입니다. 생존자가 있는 것 같습니다.', choices: ['신호를 보낸다', '조용히 접근한다', '위험을 무릅쓰고 달려간다'] },
        { desc: '마왕의 옛 서재에서 금지된 마법서가 펼쳐진 채 놓여 있습니다. 글자들이 움직입니다.', choices: ['책을 읽는다', '책을 닫는다', '불로 태운다'] },
    ],
    abyss: [
        { desc: '심연의 바닥에서 낮은 공명이 울립니다.', choices: ['공명점 탐색', '즉시 전투 준비', '기록 후 철수'] },
        { desc: '공허 틈에서 잠시 미래의 잔상이 보였습니다.', choices: ['잔상을 따른다', '현재에 집중', '눈을 감는다'] },
        { desc: '어둠 속에서 이름을 부르는 목소리가 들립니다.', choices: ['응답한다', '무시한다', '봉인 주문'] },
        { desc: '공간이 접혀 짧은 거리가 두 방향으로 갈라집니다.', choices: ['왼쪽 공간으로 진입', '오른쪽 공간으로 진입', '현재 위치 유지'] },
        { desc: '무중력 구역에 둥둥 떠 있는 고대 유물 파편들이 보입니다.', choices: ['모아서 분석한다', '하나만 가져간다', '건드리지 않는다'] },
        { desc: '심연의 안개 속에서 익숙한 실루엣이 걸어옵니다.', choices: ['대기한다', '소리친다', '전투 태세를 갖춘다'] },
        { desc: '심연 벽면에 수천 개의 눈동자가 새겨져 있습니다. 당신이 다가가자 모두 눈을 뜹니다.', choices: ['눈을 마주친다', '눈을 감고 걷는다', '뒤로 물러선다'] },
        { desc: '시간이 느려지는 구역을 만났습니다. 당신의 발걸음도 천천히 가라앉습니다.', choices: ['서둘러 빠져나간다', '느린 시간 속에서 주변을 관찰한다', '가만히 서서 기다린다'] },
        { desc: '심연 깊숙한 곳에서 빛을 발하는 계단이 위로 이어집니다. 이상합니다, 아래로 내려오고 있었는데.', choices: ['계단을 오른다', '계단 주변을 조사한다', '무시하고 계속 내려간다'] },
        { desc: '공허 공간에 편지 한 장이 바람도 없이 떠다닙니다. 필체가 당신의 것과 똑같습니다.', choices: ['편지를 읽는다', '편지를 태운다', '편지를 접어 보관한다'] },
        { desc: '심연의 가장 조용한 구역에서 갑자기 아이의 웃음소리가 들립니다.', choices: ['소리가 나는 곳으로 간다', '귀를 막고 전진한다', '소리 방향 반대로 이동한다'] },
        { desc: '당신의 그림자가 멋대로 움직이기 시작합니다. 그림자는 무언가를 가리킵니다.', choices: ['그림자가 가리키는 곳으로 간다', '그림자를 밟아 멈춘다', '빛을 비춰 없앤다'] },
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

    // ── 구조화 보상 이벤트 (NPC 조우 · 도박 · 퍼즐) ─────────────────────────
    structured: [
        // NPC: 부상당한 행상인
        {
            desc: '부상당한 행상인이 쓰러져 있습니다. "제발... 물약 하나만..."',
            choices: ['물약을 건넨다', '그냥 지나친다'],
            outcomes: [
                { choiceIndex: 0, gold: 200, log: '행상인이 감사하며 숨겨두었던 금화를 건네준다. (+200G)' },
                { choiceIndex: 1, log: '차갑게 외면하며 발걸음을 옮긴다.' },
            ],
        },
        // 도박: 수상한 상인의 내기
        {
            desc: '수상한 상인이 "골드 500을 걸면 두 배로 돌려드리죠"라고 속삭입니다.',
            choices: ['내기 수락 (500G)', '거절한다'],
            outcomes: [
                { choiceIndex: 0, gold: 500, log: '운이 좋았다! 1000G를 손에 쥐었다. (+500G)' },
                { choiceIndex: 1, log: '상인이 실망한 듯 사라진다.' },
            ],
        },
        // 퍼즐: 고대 석판 수수께끼
        {
            desc: '"하나는 둘이 되고, 둘은 하나가 된다." 석판에 새겨진 문구 앞에 세 개의 보석 홈이 있습니다.',
            choices: ['보석을 끼워 맞춘다', '석판을 부순다', '무시하고 지나친다'],
            outcomes: [
                { choiceIndex: 0, exp: 50, log: '퍼즐을 풀었다! 석판에서 빛이 솟아오르며 지식이 스며든다. (+50 EXP)' },
                { choiceIndex: 1, hp: -30, log: '석판이 폭발하며 파편이 날아온다. (-30 HP)' },
                { choiceIndex: 2, log: '수수께끼를 그냥 지나친다.' },
            ],
        },
        // NPC: 마법사의 체력 회복 제안
        {
            desc: '길가에 앉아 있던 방랑 마법사가 "마력 소모가 많군요. 도움을 드리죠"라고 말합니다.',
            choices: ['치료를 받는다', '거절한다'],
            outcomes: [
                { choiceIndex: 0, hp: 50, mp: 30, log: '마법사가 온기 어린 빛으로 상처를 낫게 해주었다. (+50HP +30MP)' },
                { choiceIndex: 1, log: '정중히 거절하고 길을 계속한다.' },
            ],
        },
        // 도박: 운명의 주사위
        {
            desc: '가면을 쓴 광대가 "운명의 주사위 한 번, 만 골드를 걸어보시겠소?"라고 묻습니다.',
            choices: ['주사위를 굴린다 (1000G)', '거절한다'],
            outcomes: [
                { choiceIndex: 0, gold: 1000, log: '운이 따랐다! 두 배의 골드가 돌아왔다. (+1000G)' },
                { choiceIndex: 1, log: '광대가 씩 웃으며 사라진다.' },
            ],
        },
        // NPC: 상처 입은 전사 구호
        {
            desc: '쓰러진 전사가 숨을 고르며 "제 배낭을... 지켜주시오"라고 말합니다.',
            choices: ['배낭을 지키며 경계한다', '배낭을 열어본다', '모른 척한다'],
            outcomes: [
                { choiceIndex: 0, gold: 500, item: '중급 체력 물약', log: '전사가 회복 후 감사의 표시로 보상을 건넨다. (+500G +물약)' },
                { choiceIndex: 1, hp: -20, log: '배낭에 장치된 함정이 폭발한다. (-20HP)' },
                { choiceIndex: 2, log: '전사의 신음 소리를 뒤로 하고 길을 간다.' },
            ],
        },
        // 퍼즐: 마력 공명 시험
        {
            desc: '"세 개의 크리스탈 중 하나에 마력을 주입하시오." 틀린 크리스탈을 건드리면 폭발할 것 같습니다.',
            choices: ['왼쪽 크리스탈', '가운데 크리스탈', '오른쪽 크리스탈'],
            outcomes: [
                { choiceIndex: 0, mp: 50, log: '정답! 크리스탈이 공명하며 마나가 충전된다. (+50MP)' },
                { choiceIndex: 1, exp: 80, log: '정답! 크리스탈이 황금빛으로 빛나며 경험이 쌓인다. (+80EXP)' },
                { choiceIndex: 2, hp: -25, log: '크리스탈이 폭발한다! (-25HP)' },
            ],
        },
        // NPC: 도전하는 신참 전사
        {
            desc: '"용감한 모험가여! 나와 겨루어 보자!" 어린 전사가 자신만만하게 검을 내밉니다.',
            choices: ['훈련 대결에 응한다', '가르침을 베풀며 훈련시킨다', '거절한다'],
            outcomes: [
                { choiceIndex: 0, exp: 60, gold: 200, log: '짧은 수련 대련 끝에 신참 전사가 승복한다. (+60EXP +200G)' },
                { choiceIndex: 1, exp: 100, log: '가르침의 시간을 통해 자신도 성장함을 느꼈다. (+100EXP)' },
                { choiceIndex: 2, log: '손을 흔들며 길을 계속한다.' },
            ],
        },
        // 도박: 3장 카드 트릭
        {
            desc: '"세 장 중 한 장에 골드가 있소. 선택하시오." 노름꾼이 카드를 뒤섞습니다.',
            choices: ['첫 번째 카드', '두 번째 카드', '세 번째 카드'],
            outcomes: [
                { choiceIndex: 0, gold: 300, log: '맞췄다! (+300G)' },
                { choiceIndex: 1, gold: 300, log: '맞췄다! (+300G)' },
                { choiceIndex: 2, log: '빈 카드다. 노름꾼이 쓴웃음을 짓는다.' },
            ],
        },
        // 퍼즐: 잠긴 보물 상자의 암호
        {
            desc: '"1 + 2 + 3 + ... + 10 = ?" 오래된 보물 상자 자물쇠에 숫자 입력 장치가 있습니다.',
            choices: ['45', '50', '55'],
            outcomes: [
                { choiceIndex: 0, log: '땡! 45는 아니다. 자물쇠가 더 꽉 잠긴다.' },
                { choiceIndex: 1, log: '땡! 50도 아니다. 자물쇠에서 경고음이 울린다.' },
                { choiceIndex: 2, gold: 800, item: '중급 체력 물약', log: '정답 55! 자물쇠가 열리며 보물이 쏟아진다. (+800G +물약)' },
            ],
        },
    ],
};

export const pickFallbackEvent = (loc, history = [], context = {}) => {
    const explicit = FALLBACK_EVENT_POOL[loc];
    const poolKey = explicit ? loc : getPoolKeyByLocation(loc);
    const basePool = explicit || FALLBACK_EVENT_POOL[poolKey] || FALLBACK_EVENT_POOL.default;
    // 30% 확률로 구조화 이벤트 풀과 혼합
    const pool = Math.random() < 0.3
        ? [...basePool, ...FALLBACK_EVENT_POOL.structured]
        : basePool;
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
