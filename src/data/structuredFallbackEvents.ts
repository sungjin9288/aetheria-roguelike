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

export interface StructuredFallbackTransaction {
    id: string;
    choiceIndex: number;
    cost: StructuredFallbackCost;
    grossGold: number;
    netGold: number;
    preview: string;
    event: {
        desc: string;
        choices: readonly string[];
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

const suspiciousMerchantWager = defineTransaction({
    id: 'fallback:suspicious-merchant-wager:v1',
    choiceIndex: 0,
    cost: Object.freeze({ type: 'gold' as const, amount: 500 }),
    grossGold: 1000,
    netGold: 500,
    preview: '골드 500 소모 · 1000 획득 · 순증가 500',
    event: event(
        '수상한 상인이 "골드 500을 걸면 두 배로 돌려드리죠"라고 속삭입니다.',
        ['내기 수락 (500G)', '거절한다'],
        [
            { choiceIndex: 0, gold: 500, log: '운이 좋았다! 1000G를 손에 쥐었다. (+500G)' },
            { choiceIndex: 1, log: '상인이 실망한 듯 사라진다.' },
        ],
    ),
});

const destinyDiceWager = defineTransaction({
    id: 'fallback:destiny-dice-wager:v1',
    choiceIndex: 0,
    cost: Object.freeze({ type: 'gold' as const, amount: BALANCE.STRUCTURED_EVENT_GOLD_CAP }),
    grossGold: BALANCE.STRUCTURED_EVENT_GOLD_CAP * 2,
    netGold: BALANCE.STRUCTURED_EVENT_GOLD_CAP,
    preview: '골드 720 소모 · 1440 획득 · 순증가 720',
    event: event(
        '가면을 쓴 광대가 "운명의 주사위 한 번, 720 골드를 걸어보시겠소?"라고 묻습니다.',
        ['주사위를 굴린다 (720G)', '거절한다'],
        [
            { choiceIndex: 0, gold: BALANCE.STRUCTURED_EVENT_GOLD_CAP, log: '운이 따랐다! 두 배의 골드가 돌아왔다. (+720G)' },
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

export const getStructuredFallbackPoolEvent = (id: string) => {
    const transaction = getStructuredFallbackTransaction(id);
    if (!transaction) throw new Error(`Unknown structured fallback transaction: ${id}`);
    return Object.freeze({
        ...transaction.event,
        fallbackTransactionId: transaction.id,
    });
};
