import { BALANCE } from './constants.js';

export type StructuredFallbackCost =
    | { type: 'hp-recovery-consumable'; amount: 1 }
    | { type: 'gold'; amount: number };

/**
 * 트랜잭션 이벤트의 outcome 한 칸 — 모양이 닫혀 있다(Wave 27 N1).
 *
 * 이 원장(`event`)이 트랜잭션 이벤트 모양의 유일한 소유자다: 생산자
 * (`aiEventUtils.pickFallbackEvent`)는 이 값을 그대로 복사해 내보내고, 검증기
 * (`fallbackEventHandlers`)는 열린 이벤트가 이 값과 구조 동치인지 본다. 필드를 닫아 두어야
 * 생산자가 캐스트 없이 이벤트 패키지(`NormalizedOutcome`의 수치 6필드)로 옮길 수 있다.
 * `aiEventPools`의 열린 `Record<string, unknown>` 슬롯에 들어가야 하므로 interface가 아니라
 * type 별칭이다(암묵 인덱스 시그니처).
 */
export type StructuredFallbackOutcome = {
    readonly choiceIndex: number;
    readonly log: string;
    readonly gold: number;
    readonly exp: number;
    readonly hp: number;
    readonly mp: number;
};

/**
 * 2026-10 Wave 62 C18 (소유자 결정 "전부 설명대로"): 내기는 운이다 — 이 칸이 있는 거래는 비용(판돈)을 치른 뒤
 * `winChance` 확률로만 `grossGold`를 돌려받는다. 확정 지급이던 동안 두 내기는 언제나 순증가 500 · 720이었고
 * 미리보기가 그 결과를 미리 말했다. 판정 난수는 훅이 payload `roll`로 넘긴다(리듀서는 난수를 부르지 않는다).
 */
export interface StructuredFallbackChance {
    /** 이길 확률(0 ~ 1) — 정본이다. 미리보기의 승률 문구도 이 값에서 만든다. */
    readonly winChance: number;
    /** 졌을 때의 결과 문구 — 판돈은 돌아오지 않는다(지급 0, 누적 골드 불변). */
    readonly lossLog: string;
}

export interface StructuredFallbackTransaction {
    id: string;
    choiceIndex: number;
    cost: StructuredFallbackCost;
    /** 지급액 — 내기(`chance`)면 이겼을 때의 지급액이다. */
    grossGold: number;
    /** 누적 골드에 더하는 순증가 — 내기면 이겼을 때의 값이고, 지면 0이다. */
    netGold: number;
    preview: string;
    chance?: StructuredFallbackChance;
    event: {
        desc: string;
        choices: readonly string[];
        /** 내기의 비용 선택지 칸은 **이겼을 때**의 결과다(진 결과는 `chance.lossLog`). */
        outcomes: readonly StructuredFallbackOutcome[];
    };
}

const outcome = (value: Partial<StructuredFallbackOutcome>): StructuredFallbackOutcome => Object.freeze({
    choiceIndex: 0,
    log: '',
    gold: 0,
    exp: 0,
    hp: 0,
    mp: 0,
    ...value,
});

const event = (
    desc: string,
    choices: string[],
    outcomes: Array<Partial<StructuredFallbackOutcome>>,
) => Object.freeze({
    desc,
    choices: Object.freeze(choices),
    outcomes: Object.freeze(outcomes.map(outcome)),
});

const defineTransaction = (
    value: Omit<StructuredFallbackTransaction, 'event'> & {
        event: StructuredFallbackTransaction['event'];
    },
) => Object.freeze({ ...value });

/** 내기 미리보기 — 판돈 · 이겼을 때 지급액 · 승률을 말하고 결과는 말하지 않는다. 숫자는 거래 데이터에서 온다. */
const wagerPreview = (stake: number, payout: number, winChance: number) => (
    `판돈 골드 ${stake} · 이기면 골드 ${payout} · 승률 ${Math.round(winChance * 100)}% · 결과는 굴린 뒤에 드러남`
);

const woundedMerchant = defineTransaction({
    id: 'fallback:wounded-merchant:v1',
    choiceIndex: 0,
    cost: Object.freeze({ type: 'hp-recovery-consumable' as const, amount: 1 as const }),
    grossGold: 200,
    netGold: 200,
    preview: '보유한 회복 물약 중 가장 값싼 것 1개 소모 · 골드 200 획득',
    event: event(
        '부상당한 행상인이 쓰러져 있습니다. "제발... 체력 회복 물약 하나만..."',
        ['체력 회복 물약을 건넨다', '그냥 지나친다'],
        [
            { choiceIndex: 0, gold: 200, log: '행상인이 감사하며 숨겨두었던 금화를 건네준다. (+200G)' },
            { choiceIndex: 1, log: '차갑게 외면하며 발걸음을 옮긴다.' },
        ],
    ),
});

// 두 내기의 승률은 반반이다 — "두 배로 돌려드리죠"는 판돈과 같은 금액을 걸고 이기면 두 배를 받는 맞내기이고,
//   반반이면 기대 순증가가 0이다(판돈 500 → ½ × +500 + ½ × −500). 운의 이벤트가 골드를 기대값으로 찍어 내지도
//   빨아들이지도 않는다 — 확정 +500 · +720이던 공짜 골드만 사라지고 남는 것은 변동이다.
const WAGER_WIN_CHANCE = 0.5;
const SUSPICIOUS_MERCHANT_STAKE = 500;
const DESTINY_DICE_STAKE = BALANCE.STRUCTURED_EVENT_GOLD_CAP;

const suspiciousMerchantWager = defineTransaction({
    id: 'fallback:suspicious-merchant-wager:v1',
    choiceIndex: 0,
    cost: Object.freeze({ type: 'gold' as const, amount: SUSPICIOUS_MERCHANT_STAKE }),
    grossGold: SUSPICIOUS_MERCHANT_STAKE * 2,
    netGold: SUSPICIOUS_MERCHANT_STAKE,
    preview: wagerPreview(SUSPICIOUS_MERCHANT_STAKE, SUSPICIOUS_MERCHANT_STAKE * 2, WAGER_WIN_CHANCE),
    chance: Object.freeze({
        winChance: WAGER_WIN_CHANCE,
        lossLog: `상인이 씩 웃으며 판돈을 챙겨 사라진다. (-${SUSPICIOUS_MERCHANT_STAKE}G)`,
    }),
    event: event(
        '수상한 상인이 "골드 500을 걸면 두 배로 돌려드리죠"라고 속삭입니다.',
        ['내기 수락 (500G)', '거절한다'],
        [
            { choiceIndex: 0, gold: SUSPICIOUS_MERCHANT_STAKE, log: '운이 좋았다! 1000G를 손에 쥐었다. (+500G)' },
            { choiceIndex: 1, log: '상인이 실망한 듯 사라진다.' },
        ],
    ),
});

const destinyDiceWager = defineTransaction({
    id: 'fallback:destiny-dice-wager:v1',
    choiceIndex: 0,
    cost: Object.freeze({ type: 'gold' as const, amount: DESTINY_DICE_STAKE }),
    grossGold: DESTINY_DICE_STAKE * 2,
    netGold: DESTINY_DICE_STAKE,
    preview: wagerPreview(DESTINY_DICE_STAKE, DESTINY_DICE_STAKE * 2, WAGER_WIN_CHANCE),
    chance: Object.freeze({
        winChance: WAGER_WIN_CHANCE,
        lossLog: `주사위가 등을 돌렸다. 광대가 판돈을 거둬 간다. (-${DESTINY_DICE_STAKE}G)`,
    }),
    event: event(
        '가면을 쓴 광대가 "운명의 주사위 한 번, 720 골드를 걸어보시겠소?"라고 묻습니다.',
        ['주사위를 굴린다 (720G)', '거절한다'],
        [
            { choiceIndex: 0, gold: DESTINY_DICE_STAKE, log: '운이 따랐다! 두 배의 골드가 돌아왔다. (+720G)' },
            { choiceIndex: 1, log: '광대가 씩 웃으며 사라진다.' },
        ],
    ),
});

export const STRUCTURED_FALLBACK_TRANSACTIONS = Object.freeze([
    woundedMerchant,
    suspiciousMerchantWager,
    destinyDiceWager,
]);

const byId = new Map(STRUCTURED_FALLBACK_TRANSACTIONS.map((entry) => [entry.id, entry]));

export const getStructuredFallbackTransaction = (id: unknown) => (
    typeof id === 'string' ? byId.get(id) || null : null
);

/**
 * 내기 거래의 승패 — 내기가 아닌 거래는 언제나 지급한다. `roll`은 [0, 1)의 난수이고 `roll < winChance`면 이긴다.
 * 리듀서(`fallbackEventHandlers`)와 계약 테스트가 같은 판정을 읽는다.
 */
export const didFallbackTransactionPay = (
    transaction: Pick<StructuredFallbackTransaction, 'chance'>,
    roll: number | undefined,
): boolean => (
    !transaction.chance || (typeof roll === 'number' && roll < transaction.chance.winChance)
);

export const getStructuredFallbackPoolEvent = (id: string) => {
    const transaction = getStructuredFallbackTransaction(id);
    if (!transaction) throw new Error(`Unknown structured fallback transaction: ${id}`);
    return Object.freeze({
        ...transaction.event,
        fallbackTransactionId: transaction.id,
    });
};

// ── 결과를 숨기는 폴백 이벤트 (2026-10 Wave 62 C18) ─────────────────────────────

/** 숨김 이벤트의 결과 칸 — 트랜잭션 칸에 지급 아이템(선택)을 더한 모양. */
export type StructuredFallbackHiddenOutcome = StructuredFallbackOutcome & { readonly item?: string };

/**
 * 결과를 미리보기로 드러내지 않는 폴백 이벤트.
 *
 * 2026-10 Wave 62 C18 (소유자 결정 "전부 설명대로 · 미리보기에서 결과를 숨긴다"): 카드 트릭은 "세 장 중 한 장"이라
 * 말하면서 정해진 두 자리가 300골드를 줬고, 크리스탈 퍼즐은 "틀린 크리스탈"이 늘 오른쪽이었다. 미리보기는 선택지마다
 * 결과를 따로 읽어 어느 것이 이기는지 보여 줬다("1 + 2 + … + 10" 퍼즐도 정답 칸에만 "보상 가능").
 *
 * - `shuffle`: 판마다 결과 칸이 선택지 자리에 섞여 놓인다(`getShuffledSlotLayout` — 난수 하나로 n!개 배치 중 하나).
 *   고른 선택지 자리의 칸이 결과다. 한 판에서 이기는 자리는 칸 구성 그대로(카드는 정확히 한 장)이고, 어느 선택지든
 *   이길 확률은 (이기는 칸 수) / (칸 수)다 — 확률은 칸 구성이 선언한다.
 * - `fixed`: 칸 i가 선택지 i의 결과다(답을 계산할 수 있는 퍼즐). 미리보기만 숨긴다.
 *
 * 숨김 이벤트는 일반 패키징(`buildEventPackage`)을 거쳐 `source: 'fallback'`으로 열린다 — 출처는 호출자 권한이라
 * AI 응답이 같은 desc를 실어도 여기 걸리지 않는다. 판정은 열린 이벤트의 desc · 선택지가 원장과 같을 때만 이 원장이
 * 소유한다(`findStructuredFallbackHiddenEvent`): 훅의 결과 판정과 미리보기가 같은 함수를 읽는다.
 */
export interface StructuredFallbackHiddenEvent {
    id: string;
    layout: 'shuffle' | 'fixed';
    /** 모든 선택지가 같은 미리보기를 쓴다 — 무엇이 걸렸는지는 말하되 어느 선택지인지는 말하지 않는다. */
    preview: string;
    tone: 'unknown' | 'danger';
    event: {
        desc: string;
        choices: readonly string[];
        /** 결과 칸 — 칸 i의 `choiceIndex`는 i다(`shuffle`이면 열리는 이벤트에 실리는 배치일 뿐, 판정은 섞은 배치를 쓴다). */
        outcomes: readonly StructuredFallbackHiddenOutcome[];
    };
}

const hiddenOutcome = (
    value: Partial<StructuredFallbackOutcome> & { item?: string },
): StructuredFallbackHiddenOutcome => Object.freeze({
    choiceIndex: 0,
    log: '',
    gold: 0,
    exp: 0,
    hp: 0,
    mp: 0,
    ...value,
});

const defineHiddenEvent = (value: {
    id: string;
    layout: StructuredFallbackHiddenEvent['layout'];
    preview: string;
    tone: StructuredFallbackHiddenEvent['tone'];
    desc: string;
    choices: string[];
    slots: Array<Partial<StructuredFallbackOutcome> & { item?: string }>;
}): StructuredFallbackHiddenEvent => Object.freeze({
    id: value.id,
    layout: value.layout,
    preview: value.preview,
    tone: value.tone,
    event: Object.freeze({
        desc: value.desc,
        choices: Object.freeze([...value.choices]),
        outcomes: Object.freeze(value.slots.map((slot, choiceIndex) => hiddenOutcome({ ...slot, choiceIndex }))),
    }),
});

const CARD_TRICK_GOLD = 300;
const CRYSTAL_MP = 50;
const CRYSTAL_EXP = 80;
const CRYSTAL_HP_LOSS = 25;

// 카드 트릭: 골드 칸 1 · 빈 칸 2 — 어느 카드를 골라도 1/3, 한 판에 이기는 카드는 정확히 한 장.
const threeCardTrick = defineHiddenEvent({
    id: 'fallback:three-card-trick:v1',
    layout: 'shuffle',
    preview: `골드 ${CARD_TRICK_GOLD}은 세 장 중 한 장 · 뒤집기 전에는 알 수 없음`,
    tone: 'unknown',
    desc: '"세 장 중 한 장에 골드가 있소. 선택하시오." 노름꾼이 카드를 뒤섞습니다.',
    choices: ['첫 번째 카드', '두 번째 카드', '세 번째 카드'],
    slots: [
        { gold: CARD_TRICK_GOLD, log: `맞췄다! (+${CARD_TRICK_GOLD}G)` },
        { log: '빈 카드다. 노름꾼이 씩 웃으며 카드를 거둬 간다.' },
        { log: '빈 카드다. 노름꾼이 씩 웃으며 카드를 거둬 간다.' },
    ],
});

// 크리스탈 퍼즐: 공명 칸 2(기력 · 경험) · 폭발 칸 1 — 어느 크리스탈이든 폭발 1/3, 기력 1/3, 경험 1/3.
const resonanceCrystals = defineHiddenEvent({
    id: 'fallback:resonance-crystals:v1',
    layout: 'shuffle',
    // 생명을 잃을 수 있는 선택지는 '생명 손실 위험'을 말한다(일반 미리보기와 같은 말, E13) — 숨김 이벤트는 모든 선택지가 그렇다.
    preview: `셋 중 하나는 폭발 · 생명 손실 위험 · 나머지는 기력 +${CRYSTAL_MP} 또는 경험 +${CRYSTAL_EXP}`,
    tone: 'danger',
    desc: '"세 개의 크리스탈 중 하나에 마력을 주입하시오." 틀린 크리스탈을 건드리면 폭발할 것 같습니다.',
    choices: ['왼쪽 크리스탈', '가운데 크리스탈', '오른쪽 크리스탈'],
    slots: [
        { mp: CRYSTAL_MP, log: `정답! 크리스탈이 공명하며 마나가 충전된다. (+${CRYSTAL_MP}MP)` },
        { exp: CRYSTAL_EXP, log: `정답! 크리스탈이 황금빛으로 빛나며 경험이 쌓인다. (+${CRYSTAL_EXP}EXP)` },
        { hp: -CRYSTAL_HP_LOSS, log: `크리스탈이 폭발한다! (-${CRYSTAL_HP_LOSS}HP)` },
    ],
});

// 보물 상자 암호: 답(55)은 계산할 수 있다 — 운이 아니므로 자리는 고정이고, 미리보기만 정답 칸을 가리키지 않는다.
// 관대함 하향 (2026-07 밸런스 감사): 풀 내 두 번째 상위 이상치(800G) — BALANCE.STRUCTURED_EVENT_PUZZLE_GOLD_CAP(600)으로 -25% 하향.
const treasureChestCipher = defineHiddenEvent({
    id: 'fallback:treasure-chest-cipher:v1',
    layout: 'fixed',
    preview: `정답이면 골드 ${BALANCE.STRUCTURED_EVENT_PUZZLE_GOLD_CAP} · 중급 체력 물약 · 틀리면 아무것도 없음`,
    tone: 'unknown',
    desc: '"1 + 2 + 3 + ... + 10 = ?" 오래된 보물 상자 자물쇠에 숫자 입력 장치가 있습니다.',
    choices: ['45', '50', '55'],
    slots: [
        { log: '땡! 45는 아니다. 자물쇠가 더 꽉 잠긴다.' },
        { log: '땡! 50도 아니다. 자물쇠에서 경고음이 울린다.' },
        {
            gold: BALANCE.STRUCTURED_EVENT_PUZZLE_GOLD_CAP,
            item: '중급 체력 물약',
            log: `정답 55! 자물쇠가 열리며 보물이 쏟아진다. (+${BALANCE.STRUCTURED_EVENT_PUZZLE_GOLD_CAP}G +물약)`,
        },
    ],
});

export const STRUCTURED_FALLBACK_HIDDEN_EVENTS: readonly StructuredFallbackHiddenEvent[] = Object.freeze([
    threeCardTrick,
    resonanceCrystals,
    treasureChestCipher,
]);

const hiddenById = new Map(STRUCTURED_FALLBACK_HIDDEN_EVENTS.map((entry) => [entry.id, entry]));
const hiddenByDesc = new Map(STRUCTURED_FALLBACK_HIDDEN_EVENTS.map((entry) => [entry.event.desc, entry]));

/** 풀(`aiEventPools`)에 넣는 숨김 이벤트 — 원장의 desc · 선택지 · 칸을 그대로 쓴다. */
export const getStructuredFallbackHiddenPoolEvent = (id: string) => {
    const entry = hiddenById.get(id);
    if (!entry) throw new Error(`Unknown structured fallback hidden event: ${id}`);
    return Object.freeze({ ...entry.event });
};

/** 판정에 쓰는 이벤트의 최소 모양 — `GameEvent` · 미리보기 뷰가 모두 만족한다. */
interface HiddenEventView {
    source?: string;
    desc?: string;
    choices?: readonly unknown[];
}

/**
 * 열린 이벤트가 숨김 이벤트인가 — 출처가 폴백이고 desc와 선택지가 원장과 같을 때만 원장이 소유한다.
 * 결과 판정(`resolveStructuredFallbackHiddenOutcome`)과 미리보기(`eventPresentation`)가 이 함수 하나를 읽는다.
 */
export const findStructuredFallbackHiddenEvent = (
    event: HiddenEventView | null | undefined,
): StructuredFallbackHiddenEvent | null => {
    if (event?.source !== 'fallback' || typeof event.desc !== 'string') return null;
    const entry = hiddenByDesc.get(event.desc);
    if (!entry) return null;
    const choices = Array.isArray(event.choices) ? event.choices : [];
    const sameChoices = choices.length === entry.event.choices.length
        && choices.every((choice, index) => choice === entry.event.choices[index]);
    return sameChoices ? entry : null;
};

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));

/**
 * 난수 하나로 칸 배치 하나를 고른다 — `layout[선택지] = 칸`. n!개 배치가 [0, 1)을 같은 너비로 나눠 가지므로
 * (Lehmer 부호) 배치는 균등하고, 어느 선택지 자리에 어느 칸이 올 확률도 1/n이다.
 */
export const getShuffledSlotLayout = (slotCount: number, roll: number): number[] => {
    const count = Math.max(0, Math.floor(slotCount));
    const total = factorial(count);
    const safeRoll = Number.isFinite(roll) ? roll : 0;
    let code = Math.min(total - 1, Math.max(0, Math.floor(safeRoll * total)));
    const remaining = Array.from({ length: count }, (_, index) => index);
    const layout: number[] = [];
    for (let size = count; size >= 1; size -= 1) {
        const block = factorial(size - 1);
        const pick = Math.floor(code / block);
        code %= block;
        layout.push(remaining.splice(pick, 1)[0]);
    }
    return layout;
};

/**
 * 숨김 이벤트에서 고른 선택지의 결과. 숨김 이벤트가 아니면 null(호출자는 열린 이벤트의 결과를 쓴다).
 * `shuffle`이면 `rng()`를 한 번 굴려 이번 판의 배치를 고르고, `fixed`면 난수를 쓰지 않는다.
 */
export const resolveStructuredFallbackHiddenOutcome = (
    event: HiddenEventView | null | undefined,
    choiceIndex: number,
    rng: () => number,
): StructuredFallbackHiddenOutcome | null => {
    const entry = findStructuredFallbackHiddenEvent(event);
    const slotCount = entry?.event.outcomes.length ?? 0;
    if (!entry || !Number.isSafeInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= slotCount) return null;
    const slotIndex = entry.layout === 'shuffle'
        ? getShuffledSlotLayout(slotCount, rng())[choiceIndex]
        : choiceIndex;
    return { ...entry.event.outcomes[slotIndex], choiceIndex };
};
