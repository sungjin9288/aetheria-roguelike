import { BALANCE } from '../data/constants.js';
import { FALLBACK_EVENT_POOL } from '../data/aiEventPools.js';

const RECENT_HISTORY_LIMIT = 6;
const RECENT_EVENT_LIMIT = 8;

const clamp = (value: any, min: any, max: any) => Math.min(max, Math.max(min, value));
// cycle 522: fallback default 0 제거 — 8 internal callsite 모두 fallback 명시
//   (1/120/60/idx/0×4)이라 default 0 도달 불가. util default 청소 메가 시리즈
//   19번째 (cycle 502-521).
const toInt = (value: any, fallback: any) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback);
// cycle 292: export 제거 — aiEventUtils 내부 14회 사용만, 외부 consumer 0건.
const normalizeText = (value: any, fallback: any = '') => String(value || fallback).replace(/\s+/g, ' ').trim();

const normalizeChoiceText = (choice: any, idx: any) => {
    const raw = typeof choice === 'string' ? choice : choice?.text || choice?.label || `선택지 ${idx + 1}`;
    return normalizeText(raw.replace(/^\d+\s*[.)-]?\s*/, ''), `선택지 ${idx + 1}`);
};

// cycle 527: choices default [] 제거 — 1 internal callsite (line 251)
//   dedupeChoices([...rawChoices, ...fallbackChoices])가 spread 배열 명시
//   전달이라 default 도달 불가. util default 청소 메가 시리즈 24번째 batch.
const dedupeChoices = (choices: any[]) => {
    const seen = new Set();
    return choices.filter((choice: any) => {
        const key = normalizeText(choice).toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

// cycle 603: history default [] 제거 — 3 callers (aiService:80/120 + test)
//   모두 history 명시 전달이라 default 도달 불가. limit default 보존
//   (모두 미전달 reachable, partial cleanup 8번째). body의 Array.isArray
//   guard는 undefined 안전 처리.
export const summarizeHistory = (history: any[], limit = RECENT_HISTORY_LIMIT) => (
    Array.isArray(history)
        ? history.slice(-limit).map((entry: any) => {
            if (!entry || typeof entry !== 'object') return null;
            const event = normalizeText(entry.event || entry.desc || entry.text);
            const choice = normalizeText(entry.choice);
            const outcome = normalizeText(entry.outcome || entry.result);
            return [event, choice && `선택:${choice}`, outcome && `결과:${outcome}`].filter(Boolean).join(' / ');
        }).filter(Boolean)
        : []
);

// cycle 603: history default [] 제거 — 2 callers (aiService:81 + internal:545)
//   모두 history 명시 전달이라 default 도달 불가. limit default 보존
//   (reachable). body의 Array.isArray(history) guard는 undefined 안전 처리.
export const getRecentEventSet = (history: any[], limit = RECENT_EVENT_LIMIT) => (
    new Set(
        (Array.isArray(history) ? history : [])
            .slice(-limit)
            .map((entry: any) => normalizeText(entry?.event || entry?.desc || entry?.text))
            .filter(Boolean)
    )
);

// cycle 525: value default '' 제거 — 1 callsite (line 130) hashString이
//   template literal로 string 보장 후 명시 전달이라 default 도달 불가.
//   util default 청소 메가 시리즈 22번째 batch (cycle 502-524).
const hashString = (value: any) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

// cycle 318: export 제거 — aiEventUtils 내부 3회 사용만, 외부 호출 0건.
const getPoolKeyByLocation = (loc: string) => {
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
    ].find((entry: any) => entry.words.some((word: any) => String(loc || '').includes(word)));

    return keyByKeyword?.key || 'default';
};

const FALLBACK_CHOICE_SETS: Record<string, string[]> = {
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

const ITEM_REWARD_BY_POOL: Record<string, string[]> = {
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

// cycle 525: choiceText default '' 제거 — 1 internal callsite (line 131
//   classifyChoice(choice)) + 4 test callsite 모두 string 명시이라 default
//   도달 불가. body normalizeText(choiceText)가 자체 fallback 처리.
export const classifyChoice = (choiceText: any) => {
    const choice = normalizeText(choiceText);
    if (RETREAT_KEYWORDS.some((keyword: any) => choice.includes(keyword))) return 'retreat';
    if (RISKY_KEYWORDS.some((keyword: any) => choice.includes(keyword))) return 'risky';
    if (SAFE_KEYWORDS.some((keyword: any) => choice.includes(keyword))) return 'safe';
    return 'balanced';
};

const pickRewardItem = (poolKey: any, seed: any, level: any) => {
    const pool = ITEM_REWARD_BY_POOL[poolKey] || ITEM_REWARD_BY_POOL.default;
    if (!pool || pool.length === 0) return null;
    const threshold = level >= 25 ? 3 : level >= 10 ? 4 : 5;
    if ((seed % threshold) !== 0) return null;
    return pool[seed % pool.length];
};

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09 Wave 3 I2 — 절차적 outcome의 "위험" 선택에 특수 결과를 붙인다.
//   rng 파라미터를 새로 받지 않는다: buildProceduralOutcome은 원래부터
//   hashString(location|desc|choice|index) 기반 결정론이고(호출부는 rng를 넘기지
//   않는다), 같은 이벤트·같은 선택지는 몇 번을 다시 그려도 같은 결과여야 한다.
//   각 판정은 salt가 다른 파생 해시를 써서 서로 독립적으로 움직인다.
// ─────────────────────────────────────────────────────────────────────────────
const seedRoll = (salt: string, seed: number) => (hashString(`${salt}|${seed}`) % 10000) / 10000;

/** status 45% / elite 30% / relic 15% / buff 10% (BALANCE.EVENT_SPECIAL_WEIGHTS). */
const pickSpecialKind = (seed: number) => {
    const weights = BALANCE.EVENT_SPECIAL_WEIGHTS;
    const kinds = Object.keys(weights);
    const total = kinds.reduce((sum: number, kind: string) => sum + weights[kind], 0);
    let ticket = hashString(`kind|${seed}`) % total;
    for (const kind of kinds) {
        ticket -= weights[kind];
        if (ticket < 0) return kind;
    }
    return kinds[kinds.length - 1];
};

/** 생명이 바닥일 때 정예 조우로 밀어 넣지 않는다 — "부당한 죽음 금지" 규칙. */
const isLowHp = (context: any) => {
    const hp = Number(context?.playerSnapshot?.hp);
    const maxHp = Number(context?.playerSnapshot?.maxHp);
    if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return false;
    return (hp / maxHp) <= BALANCE.SCOUT_LOW_HP_RATIO;
};

const SPECIAL_LOG_SUFFIX: Record<string, string> = {
    status: ' 몸에 남은 흔적이 쉽게 가시지 않습니다.',
    elite: ' 소란을 듣고 정예가 모습을 드러냅니다.',
    relic: ' 잔해 속에서 낯선 유물의 기운이 새어 나옵니다.',
    buff: ' 손끝에 남은 열기가 다음 싸움까지 이어집니다.',
};

const buildSpecialPayload = (kind: string, seed: number) => {
    if (kind === 'elite') return { elite: true as const };
    if (kind === 'relic') return { relic: { count: 1 } };
    if (kind === 'buff') {
        return { buff: { atkMult: BALANCE.EVENT_SPECIAL_BUFF_MULT, turns: BALANCE.EVENT_SPECIAL_BUFF_TURNS } };
    }
    const ids = BALANCE.EVENT_STATUS_IDS;
    return { status: { id: ids[seed % ids.length], turns: BALANCE.EVENT_SPECIAL_STATUS_TURNS } };
};

/** "위험" 선택 — EVENT_RISKY_SPECIAL_CHANCE 확률로 특수 결과 1건만 얹는다. */
const buildRiskySpecial = (seed: number, context: any) => {
    if (seedRoll('special', seed) >= BALANCE.EVENT_RISKY_SPECIAL_CHANCE) return null;
    const rolled = pickSpecialKind(seed);
    const kind = rolled === 'elite' && isLowHp(context) ? 'status' : rolled;
    return { kind, payload: buildSpecialPayload(kind, seed), logSuffix: SPECIAL_LOG_SUFFIX[kind] };
};

/** "균형" 선택 — 소폭 버프만 아주 낮은 확률로. */
const buildBalancedSpecial = (seed: number) => {
    if (seedRoll('balanced', seed) >= BALANCE.EVENT_BALANCED_BUFF_CHANCE) return null;
    return { kind: 'buff', payload: buildSpecialPayload('buff', seed), logSuffix: SPECIAL_LOG_SUFFIX.buff };
};

// cycle 561: outer + inner context defaults 제거 — 1 internal callsite (line
//   236)가 완전 object 명시 전달이라 두 default 모두 도달 불가. 청소 메가
//   시리즈 54번째 batch (cycle 502-560).
const buildProceduralOutcome = ({ desc, choice, choiceIndex, context }: any) => {
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
        // I2: 생명 피해 크기는 그대로 두고, 대신 특수 결과 1건(상태이상/정예/유물/버프)을 얹는다.
        const special = buildRiskySpecial(seed, context);
        const baseLog = jackpot
            ? `대담한 선택이 적중했습니다. 위험을 감수한 만큼 큰 성과를 얻었습니다${item ? ` [${item}]도 손에 넣었습니다.` : '.'}`
            : '무리한 판단이 화를 불렀습니다. 대가를 치렀지만 약간의 실마리는 남겼습니다.';
        return {
            choiceIndex,
            gold: jackpot ? Math.max(20, Math.floor(baseReward * 1.45)) : Math.max(0, Math.floor(baseReward * 0.35)),
            exp: jackpot ? Math.max(18, Math.floor(baseReward * 1.2)) : Math.max(10, Math.floor(baseReward * 0.55)),
            hp: jackpot ? 0 : -backlash,
            mp: jackpot ? 0 : Math.max(0, Math.floor(maxMp * 0.04)),
            ...(jackpot && item ? { item } : {}),
            ...(special ? special.payload : {}),
            log: special ? `${baseLog}${special.logSuffix}` : baseLog
        };
    }

    const balancedGain = seed % 2 === 0;
    const balancedSpecial = buildBalancedSpecial(seed);
    const balancedLog = balancedGain
        ? '균형 잡힌 판단으로 안정적인 성과를 거두었습니다.'
        : '성과는 있었지만 완벽하진 않았습니다. 약간의 대가를 치렀습니다.';
    return {
        choiceIndex,
        gold: balancedGain ? Math.max(14, Math.floor(baseReward * 0.85)) : Math.max(8, Math.floor(baseReward * 0.45)),
        exp: balancedGain ? Math.max(14, Math.floor(baseReward)) : Math.max(10, Math.floor(baseReward * 0.65)),
        hp: balancedGain ? 0 : -Math.max(6, Math.floor(maxHp * 0.05)),
        mp: balancedGain ? Math.max(5, Math.floor(maxMp * 0.05)) : 0,
        ...(balancedSpecial ? balancedSpecial.payload : {}),
        log: balancedSpecial ? `${balancedLog}${balancedSpecial.logSuffix}` : balancedLog
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09 Wave 3 I1 — outcome 어휘 확장 (relic / status / elite / buff).
//   모델 출력도, 풀 저작 엔트리도 여기를 통과한 값만 consumer(eventActions)로 간다.
//   화이트리스트 밖의 id/kind는 조용히 드롭하고, 수치는 BALANCE 상한으로 자른다.
//   "이벤트가 직접 죽이지 않는다"는 공정성 규칙은 consumer의 HP 클램프(≥1)와
//   여기서 생명 감소 어휘를 새로 늘리지 않는 것으로 같이 지킨다.
// ─────────────────────────────────────────────────────────────────────────────

/** relic: { count: 1..EVENT_RELIC_MAX_COUNT } — 유물 "선택지"를 여는 수. */
const normalizeRelicOutcome = (raw: any) => {
    if (raw === true) return { count: 1 };
    if (!raw || typeof raw !== 'object') return null;
    return { count: clamp(toInt(raw.count, 1), 1, BALANCE.EVENT_RELIC_MAX_COUNT) };
};

/** status: { id: <BALANCE.EVENT_STATUS_IDS>, turns?: 1..EVENT_STATUS_MAX_TURNS }. */
const normalizeStatusOutcome = (raw: any) => {
    if (!raw) return null;
    const id = normalizeText(typeof raw === 'string' ? raw : (raw.id || raw.effect));
    if (!BALANCE.EVENT_STATUS_IDS.includes(id)) return null;
    const turns = clamp(
        toInt(typeof raw === 'string' ? BALANCE.EVENT_SPECIAL_STATUS_TURNS : raw.turns, BALANCE.EVENT_SPECIAL_STATUS_TURNS),
        1,
        BALANCE.EVENT_STATUS_MAX_TURNS,
    );
    return { id, turns };
};

/** elite: true — 즉시 정예 조우. 문자열/숫자 truthy는 받지 않는다(오탐 방지). */
const normalizeEliteOutcome = (raw: any) => (raw === true || raw === 'true' ? true : null);

/** 버프 배율 — 1 이하(디버프/무효)는 드롭, 상한은 EVENT_BUFF_MAX_MULT. */
const normalizeBuffMult = (raw: any) => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 1) return 0;
    return Math.min(BALANCE.EVENT_BUFF_MAX_MULT, Math.round(value * 100) / 100);
};

/** buff: { atkMult?, defMult?, turns } — consumer가 tempBuff로 환산한다. */
const normalizeBuffOutcome = (raw: any) => {
    if (!raw || typeof raw !== 'object') return null;
    const turns = clamp(toInt(raw.turns ?? raw.turn, 0), 0, BALANCE.EVENT_BUFF_MAX_TURNS);
    if (turns <= 0) return null;
    const atkMult = normalizeBuffMult(raw.atkMult);
    const defMult = normalizeBuffMult(raw.defMult);
    if (!atkMult && !defMult) return null;
    return {
        ...(atkMult ? { atkMult } : {}),
        ...(defMult ? { defMult } : {}),
        turns,
    };
};

/** 확장 어휘 4종을 한 번에 검증해 존재하는 것만 담아 돌려준다. */
export const normalizeOutcomeSpecials = (raw: any) => {
    if (!raw || typeof raw !== 'object') return {};
    const relic = normalizeRelicOutcome(raw.relic);
    const status = normalizeStatusOutcome(raw.status);
    const elite = normalizeEliteOutcome(raw.elite);
    const buff = normalizeBuffOutcome(raw.buff);
    return {
        ...(relic ? { relic } : {}),
        ...(status ? { status } : {}),
        ...(elite ? { elite } : {}),
        ...(buff ? { buff } : {}),
    };
};

// cycle 527: 3 defaults (rawOutcomes/choices/context) 제거 — 1 internal callsite
//   (line 260) normalizeOutcomes(raw.outcomes, choices, { ...context, desc })
//   3 args 명시. choices는 dedupeChoices() 결과(항상 배열), context는 spread
//   object. body의 Array.isArray(rawOutcomes) 가드는 raw.outcomes가 undefined
//   인 path 보존 (caller가 raw.outcomes를 그대로 전달).
const normalizeOutcomes = (rawOutcomes: any[], choices: any[], context: any) => {
    const normalized = new Map();

    if (Array.isArray(rawOutcomes)) {
        rawOutcomes.forEach((outcome: any, idx: any) => {
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
                ...normalizeOutcomeSpecials(outcome),
            });
        });
    }

    choices.forEach((choice: any, idx: any) => {
        if (normalized.has(idx)) return;
        normalized.set(idx, buildProceduralOutcome({
            desc: context.desc || '',
            choice,
            choiceIndex: idx,
            context
        }));
    });

    return [...normalized.values()].sort((a: any, b: any) => a.choiceIndex - b.choiceIndex);
};

// cycle 561: context default {} 제거 — 3 callers (internal:548, aiService
//   :100, ai-event-utils.test.js:26) 모두 2 args 명시 전달이라 default 도달
//   불가.
/** AI/풀 이벤트 패키지 — 라우팅 플래그(isScout 등)는 의도적으로 없다. */
export interface EventPackage {
    source: string;
    desc: string;
    choices: string[];
    outcomes: ReturnType<typeof normalizeOutcomes>;
    /** aiService가 일일 한도 초과 폴백일 때만 덧붙인다. */
    fallbackReason?: 'quota';
    fallbackMessage?: string;
}

export const buildEventPackage = (payload: any, context: any): EventPackage | null => {
    const raw = payload?.data || payload;
    if (!raw || typeof raw !== 'object') return null;

    const desc = normalizeText(raw.desc || raw.text || raw.event || raw.message);
    if (!desc) return null;

    const poolKey = getPoolKeyByLocation(context.location);
    const fallbackChoices = FALLBACK_CHOICE_SETS[poolKey] || FALLBACK_CHOICE_SETS.default;
    const rawChoices = Array.isArray(raw.choices)
        ? raw.choices.map((choice: any, idx: any) => normalizeChoiceText(choice, idx))
        : [];
    const choices = dedupeChoices([...rawChoices, ...fallbackChoices]).slice(0, 3);

    if (choices.length < 2) return null;

    // 신뢰 경계: 모델/풀 원본(raw)은 desc·choices·outcomes만 이벤트로 승격한다. `...raw`로
    //   최상위 필드를 그대로 넘기면 모델이 `isScout` / `isBossGaugeChallenge` / `_chainId` 같은
    //   라우팅 플래그를 실어 eventActions의 분기(정찰·보스 도전·체인 진행)를 탈취할 수 있다.
    //   그 플래그들은 exploreActions / bossGauge / scoutEvents가 직접 만드는 이벤트에만 존재한다.
    return {
        source: typeof raw.source === 'string' && raw.source ? raw.source : (context.source || 'ai'),
        desc,
        choices,
        outcomes: normalizeOutcomes(raw.outcomes, choices, { ...context, desc })
    };
};


// cycle 545: history / context defaults 제거 — 3 production caller (aiService
//   :69/74/108) + 5 test caller 모두 3 args 명시이라 두 default 모두 도달
//   불가. 청소 메가 시리즈 40번째 cross-file batch (cycle 502-544).
export const pickFallbackEvent = (loc: string, history: any[], context: any, rng: () => number = Math.random) => {
    // cycle 425: 직접 loc lookup 분기 제거 — cycle 357 이후 FALLBACK_EVENT_POOL은
    //   English category 키만 (forest/ruins/cave/...). loc 파라미터는 항상 Korean
    //   지명이라 직접 매칭 0건이었음. getPoolKeyByLocation이 유일 path.
    const poolKey = getPoolKeyByLocation(loc);
    const basePool = FALLBACK_EVENT_POOL[poolKey] || FALLBACK_EVENT_POOL.default;
    // 관대함 하향 (2026-07 밸런스 감사): 구조화 이벤트(고보상 NPC/도박/퍼즐) 혼합 확률
    //   30%(하드코딩) → BALANCE.STRUCTURED_EVENT_MIX(0.22)로 상수 승격 + 하향.
    const pool = rng() < BALANCE.STRUCTURED_EVENT_MIX
        ? [...basePool, ...FALLBACK_EVENT_POOL.structured]
        : basePool;
    const recentEvents = getRecentEventSet(history);
    const lastEvent = normalizeText((Array.isArray(history) ? history[history.length - 1] : null)?.event);
    const filteredPool = pool.filter((event: any) => !recentEvents.has(normalizeText(event?.desc)));
    const withoutImmediateRepeat = (filteredPool.length > 0 ? filteredPool : pool)
        .filter((event: any) => normalizeText(event?.desc) !== lastEvent);
    const candidates = withoutImmediateRepeat.length > 0
        ? withoutImmediateRepeat
        : (filteredPool.length > 0 ? filteredPool : pool);
    const picked = candidates[Math.floor(rng() * candidates.length)];
    return buildEventPackage(
        { ...picked, source: 'fallback' },
        { ...context, location: loc, source: 'fallback' }
    );
};
