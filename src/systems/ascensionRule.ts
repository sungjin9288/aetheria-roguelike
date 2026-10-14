import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { ALL_ASCENSION_RULES, ASCENSION_RULES, ASCENSION_TWIST_WEIGHTS, STACKED_ASCENSION_RULES, UNBOUND_SIGNATURE_GROUP, type AscensionRuleDef } from '../data/ascensionRules.js';
import signatureRegistryData from '../data/signatureRegistry.json' with { type: 'json' };
import signatureSetsData from '../data/signatureSets.json' with { type: 'json' };
import type { Player } from '../types/index.js';
import { createSeededRandom, deriveSeed } from '../utils/seededRandom.js';

/**
 * 회차 규칙 판정 (2026-10 Wave 89) — rank 0(첫 회차)에는 규칙이 없다. 데이터는 `data/ascensionRules.ts`.
 *
 * 2026-10 Wave 94 (소유자 결정 "로그라이크 느낌 — 회차 규칙 카드 뽑기"): 계승할 때 아직 정복하지 않은 규칙에서 카드
 * `BALANCE.ASCENSION_RULE_OFFER_COUNT`장을 뽑아 하나를 고른다. 고른 규칙은 `meta.ascensionRule`(영구)에 남아 같은 단계의 사망 재시작이
 * 같은 규칙을 읽는다. 패는 마왕 처치 영수증 · 다음 단계의 해시로 정해진다 — 화면과 리듀서가 같은 패를 보고 리로드로 다시 뽑을 수 없다.
 * `meta.ascensionRule`이 없거나 단계가 다르면(이전 세이브) 고정 순서(`getAscensionRule`)로 읽는다.
 *
 * 2026-10 Wave 95 (소유자 결정 "무료 한 번 + 영구 능력치"): 패를 다시 뽑을 수 있다 — 처음 `ASCENSION_RULE_REROLL_FREE`번은 무료이고
 * 되돌릴 수 없으며(리듀서가 횟수를 저장한다), 그 뒤 `ASCENSION_RULE_REROLL_PAID_MAX`번까지는 한 번마다 다음 여정으로 넘어가는 정수
 * 사다리 단계의 `ASCENSION_RULE_REROLL_LADDER_COST`를 내려놓는다(계승할 때 `getAscensionOutcome`이 적용).
 */
type RuleConquestStats = { ruleConquestRanks?: number[]; ruleConquestRuleIds?: string[] } | null | undefined;
type AscensionRuleMeta = Pick<NonNullable<Player['meta']>, 'prestigeRank' | 'ascensionRule'> | null | undefined;

// 각인 → 묶음 키. 세트에 속하지 않은 각인은 `UNBOUND_SIGNATURE_GROUP.key`(Wave 90 — 여섯째 규칙의 표적).
const SIGNATURE_SET_OF: Record<string, string> = Object.fromEntries(
    Object.entries(signatureRegistryData.entries).map(([name, entry]) => [
        name, (entry as { setGroup?: string }).setGroup || UNBOUND_SIGNATURE_GROUP.key,
    ]),
);

/** 고정 순서의 회차 규칙(rank 1 ~ 규칙 수가 차례, 그 뒤 다시 돈다) — Wave 94부터는 이전 세이브의 기본값이다. rank 0은 없다. */
export const getAscensionRule = (rank: number | null | undefined): AscensionRuleDef | null => {
    const r = Math.floor(Number(rank) || 0);
    if (r < 1 || ASCENSION_RULES.length === 0) return null;
    return ASCENSION_RULES[(r - 1) % ASCENSION_RULES.length];
};

/** 이 계승 단계가 규칙 표의 몇 번째 순환인지(1부터, rank 1 ~ 6 = 1, 7 ~ 12 = 2). rank 0은 0 — 2026-10 Wave 93. */
export const getAscensionRuleCycle = (rank: number | null | undefined): number => {
    const r = Math.floor(Number(rank) || 0);
    if (r < 1 || ASCENSION_RULES.length === 0) return 0;
    return Math.floor((r - 1) / ASCENSION_RULES.length) + 1;
};

/** id로 찾은 회차 규칙(기본 · 겹친 규칙 모두 — Wave 105). */
export const getAscensionRuleById = (ruleId: unknown): AscensionRuleDef | null => (
    typeof ruleId === 'string' ? ALL_ASCENSION_RULES.find((rule) => rule.id === ruleId) ?? null : null
);

type AscensionTwistId = AscensionRuleDef['modifier'];
const TWIST_IDS = BALANCE.CHALLENGE_MODIFIERS.map((modifier) => modifier.id) as AscensionTwistId[];
const isTwistId = (value: unknown): value is AscensionTwistId => typeof value === 'string' && (TWIST_IDS as string[]).includes(value);

/**
 * 2026-10 Wave 105 (소유자 결정 "카드마다 무작위 두 번째 비틀기"): 겹친 규칙 카드의 두 번째 비틀기 — 기본 비틀기를 뺀 다섯 가지에서
 * 처치 영수증 · 다음 단계 · 다시 뽑기 횟수 · 규칙 id의 해시로 하나를 뽑는다(화면과 리듀서가 같은 값). 기본 규칙이면 null.
 * 게임 난수를 쓰지 않는다.
 */
export const getStackedSecondModifier = (
    rule: AscensionRuleDef | null | undefined,
    receiptKey: string,
    nextRank: number,
    rerolls: number,
): AscensionTwistId | null => {
    if (!rule?.stackedOf) return null;
    const pool = TWIST_IDS.filter((id) => id !== rule.modifier);
    if (pool.length === 0) return null;
    const rng = createSeededRandom(deriveSeed(0, 'ascension-rule-second', receiptKey, nextRank, rerolls, rule.id));
    return pool[Math.floor(rng() * pool.length)] ?? null;
};

/**
 * 지금 회차의 비틀기(도전 조건 id) — 규칙의 비틀기, 겹친 규칙이면 고른 카드의 두 번째 비틀기(`meta.ascensionRule.secondModifier`)까지.
 * 규칙이 없으면 빈 목록. 두 번째 비틀기 기록이 없거나 기본 비틀기와 같으면(변조 · 이전 세이브) 하나만.
 */
export const getActiveAscensionTwists = (meta: AscensionRuleMeta): AscensionTwistId[] => {
    const rule = getActiveAscensionRule(meta);
    if (!rule) return [];
    const rank = Math.floor(Number(meta?.prestigeRank) || 0);
    const record = meta?.ascensionRule;
    const second = rule.stackedOf && record?.rank === rank && record.ruleId === rule.id ? record.secondModifier : undefined;
    return isTwistId(second) && second !== rule.modifier ? [rule.modifier, second] : [rule.modifier];
};

/** 지금 단계에서 고른 회차 규칙 — 고른 기록이 없으면(이전 세이브 · 다른 단계의 기록) 고정 순서. rank 0은 없다. */
export const getActiveAscensionRule = (meta: AscensionRuleMeta): AscensionRuleDef | null => {
    const rank = Math.floor(Number(meta?.prestigeRank) || 0);
    if (rank < 1) return null;
    const picked = meta?.ascensionRule?.rank === rank ? getAscensionRuleById(meta.ascensionRule.ruleId) : null;
    return picked ?? getAscensionRule(rank);
};

/**
 * 정복 기록(규칙 id, 정복마다 한 줄 — 같은 규칙을 다시 정복하면 다시 남는다). 기록이 없으면(이전 세이브) 정복한 단계를 고정 순서로
 * 읽는다 — 정복 쪽이 처음 쓸 때 이 값으로 채운다.
 */
export const getRuleConquestLedger = (stats: RuleConquestStats): string[] => {
    if (Array.isArray(stats?.ruleConquestRuleIds)) {
        return stats.ruleConquestRuleIds.filter((id) => Boolean(getAscensionRuleById(id)));
    }
    return (Array.isArray(stats?.ruleConquestRanks) ? stats.ruleConquestRanks : [])
        .map((rank) => getAscensionRule(Number(rank))?.id)
        .filter((id): id is string => Boolean(id));
};

/** 한 번이라도 정복한 규칙 id(칭호 복구 · 도감 정복 수). */
export const getConqueredRuleIds = (stats: RuleConquestStats): Set<string> => new Set(getRuleConquestLedger(stats));

type RuleOfferPlayer = { meta?: Player['meta']; stats?: Player['stats'] } | null | undefined;

/**
 * 덱 — 정복 횟수가 가장 적은 규칙들(이번 순환에서 아직 정복하지 않은 규칙, 규칙 표 순서). 여섯을 모두 정복하면 다시 찬다.
 * 2026-10 Wave 105 (소유자 결정 "2순환부터 겹친 카드만"): 기본 여섯을 모두 한 번 정복하면 덱은 겹친 여섯 규칙이다(그 안에서 같은 규칙).
 */
const getAscensionRuleDeck = (stats: RuleConquestStats): AscensionRuleDef[] => {
    const counts = new Map<string, number>();
    for (const id of getRuleConquestLedger(stats)) counts.set(id, (counts.get(id) || 0) + 1);
    const table = ASCENSION_RULES.every((rule) => (counts.get(rule.id) || 0) >= 1) ? STACKED_ASCENSION_RULES : ASCENSION_RULES;
    const fewest = Math.min(...table.map((rule) => counts.get(rule.id) || 0));
    return table.filter((rule) => (counts.get(rule.id) || 0) === fewest);
};

/** 겹친 규칙 덱이 열렸는가(기본 여섯을 모두 한 번 정복) — 도감 정복 수의 분모가 읽는다. */
export const isStackedAscensionRuleDeckOpen = (stats: RuleConquestStats): boolean => {
    const conquered = getConqueredRuleIds(stats);
    return ASCENSION_RULES.every((rule) => conquered.has(rule.id));
};

/**
 * 이 마왕 처치 · 다음 단계의 패를 다시 뽑은 횟수(2026-10 Wave 95) — 기록이 다른 처치 영수증 · 다른 단계의 것이면 0.
 * 리듀서(`REROLL_ASCENSION_RULE_OFFER`)만 늘린다.
 */
export const getAscensionRuleRerolls = (meta: Player['meta'] | null | undefined, nextRank: number): number => {
    const record = meta?.ascensionRuleOffer;
    const receiptKey = meta?.endgame?.lastEndgameReceiptKey;
    if (!record || !receiptKey || record.receiptKey !== receiptKey || record.rank !== nextRank) return 0;
    const rerolls = Math.floor(Number(record.rerolls) || 0);
    return Math.min(Math.max(0, rerolls), BALANCE.ASCENSION_RULE_REROLL_FREE + BALANCE.ASCENSION_RULE_REROLL_PAID_MAX);
};

/** 다시 뽑기 중 대가를 치른 횟수(무료 횟수 뒤) — 계승이 그만큼 넘어가는 사다리를 내려놓는다. */
export const getAscensionRulePaidRerolls = (meta: Player['meta'] | null | undefined, nextRank: number): number => (
    Math.max(0, getAscensionRuleRerolls(meta, nextRank) - BALANCE.ASCENSION_RULE_REROLL_FREE)
);

/** 유료 다시 뽑기를 `paid`번 했을 때 다음 여정으로 넘어가는 사다리 비율(1 = 전부, 0 = 없음). */
export const getAscensionRuleRerollLadderKeep = (paid: number): number => (
    Math.max(0, 1 - Math.max(0, Math.floor(Number(paid) || 0)) * BALANCE.ASCENSION_RULE_REROLL_LADDER_COST)
);

/**
 * 계승할 때 보이는 회차 규칙 카드 — 덱이다: 정복 횟수가 가장 적은 규칙들(이번 순환에서 아직 정복하지 않은 규칙)에서만 무작위로
 * 최대 `BALANCE.ASCENSION_RULE_OFFER_COUNT`장을 뽑는다. 남은 규칙이 그보다 적으면 패도 그만큼이다(하나면 그 규칙뿐) — 정복한
 * 규칙으로 칸을 채우지 않는다. 채우던 첫 구현에서는 고르지 않는 플레이어가 언제나 정복한 가벼운 카드를 받아 무거운 규칙을 영원히
 * 피했다(원장 §99). 여섯을 모두 정복하면 덱이 다시 찬다. 씨앗은 마왕 처치 영수증 · 다음 단계라 같은 처치에서는 같은 패다.
 * 다음 단계가 0 이하면 빈 패.
 *
 * 2026-10 Wave 95: 다시 뽑은 패(k번째)는 씨앗에 k를 더해 덱 전체에서 다시 무작위로 뽑는다 — 직전 패와 똑같은 패만 나오지 않는다
 * (그러면 마지막 칸을 직전 패에 없던 카드 하나로 바꾼다). 아직 보지 못한 카드를 먼저 채우지 말 것 — 그렇게 하던 구현에서는 무료 한 번이
 * "나머지 절반 보기"가 되어 원하는 카드가 늘 나왔고(유료 다시 뽑기 720회 중 0번), 순서를 마음대로 정해 사망이 30% 줄었다(원장 §100).
 * 다시 뽑지 않은 패(k = 0)는 Wave 94와 같다.
 */
export const getAscensionRuleOffer = (player: RuleOfferPlayer, nextRank: number): AscensionRuleDef[] => {
    if (!(nextRank >= 1)) return [];
    const deck = getAscensionRuleDeck(player?.stats);
    const receiptKey = player?.meta?.endgame?.lastEndgameReceiptKey ?? 'none';
    const shuffle = (rules: AscensionRuleDef[], rng: () => number): AscensionRuleDef[] => {
        const cards = [...rules];
        for (let i = cards.length - 1; i > 0; i -= 1) {
            const j = Math.floor(rng() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        return cards;
    };
    let hand = shuffle(deck, createSeededRandom(deriveSeed(0, 'ascension-rule-offer', receiptKey, nextRank))).slice(0, BALANCE.ASCENSION_RULE_OFFER_COUNT);
    const rerolls = getAscensionRuleRerolls(player?.meta, nextRank);
    for (let k = 1; k <= rerolls; k += 1) {
        const rng = createSeededRandom(deriveSeed(0, 'ascension-rule-offer', receiptKey, nextRank, 'reroll', k));
        const previous = new Set(hand.map((rule) => rule.id));
        const next = shuffle(deck, rng).slice(0, BALANCE.ASCENSION_RULE_OFFER_COUNT);
        // 직전 패와 같은 패면 마지막 칸을 직전 패에 없던 카드 하나로 바꾼다(덱이 패보다 크면 언제나 있다).
        if (next.every((rule) => previous.has(rule.id))) {
            const outside = shuffle(deck.filter((rule) => !previous.has(rule.id)), rng);
            if (outside.length > 0) next[next.length - 1] = outside[0];
        }
        hand = next;
    }
    return hand;
};

/** 2026-10 Wave 105: 지금 패의 이 카드에 붙는 두 번째 비틀기(겹친 규칙만) — 계승 리듀서가 같은 값을 저장한다. */
export const getAscensionRuleOfferSecond = (player: RuleOfferPlayer, nextRank: number, rule: AscensionRuleDef | null | undefined): AscensionTwistId | null => (
    getStackedSecondModifier(rule, player?.meta?.endgame?.lastEndgameReceiptKey ?? 'none', nextRank, getAscensionRuleRerolls(player?.meta, nextRank))
);

/** 지금 패를 다시 뽑을 수 있는가 — 덱이 패보다 커야 하고(아니면 같은 카드뿐이다) 횟수가 남아야 한다. */
export const canRerollAscensionRuleOffer = (player: RuleOfferPlayer, nextRank: number): boolean => (
    nextRank >= 1
    && Boolean(player?.meta?.endgame?.lastEndgameReceiptKey)
    && getAscensionRuleDeck(player?.stats).length > BALANCE.ASCENSION_RULE_OFFER_COUNT
    && getAscensionRuleRerolls(player?.meta, nextRank) < BALANCE.ASCENSION_RULE_REROLL_FREE + BALANCE.ASCENSION_RULE_REROLL_PAID_MAX
);

/**
 * 2026-10 Wave 106: 무거운 비틀기 — 거절할 수 있는 기본 규칙(Wave 91 선택형 셋)의 비틀기. 측정 무게(`ASCENSION_TWIST_WEIGHTS`)로도
 * 위쪽 셋이다(계약이 대조한다).
 */
const HEAVY_TWISTS: ReadonlySet<string> = new Set(ASCENSION_RULES.filter((rule) => rule.optional === true).map((rule) => rule.modifier));
export const isHeavyAscensionTwist = (id: unknown): boolean => typeof id === 'string' && HEAVY_TWISTS.has(id);

/**
 * 거절할 수 있는 규칙 카드인가 — 선택형 규칙(Wave 91 무거운 셋), 또는 무거운 두 번째 비틀기가 붙은 겹친 규칙 카드
 * (2026-10 Wave 106, 소유자 결정 §110.6 (b): "무거운 비틀기는 거절할 수 있다"를 겹친 카드에도 똑같이 적용한다 — 바탕이 가벼운
 * 겹친 카드에 무거운 두 번째가 붙은 회차가 거절할 수 없는 사망 루프였다, 원장 §110.3).
 */
export const isOptionalAscensionRule = (rule: AscensionRuleDef | null | undefined, second: string | null = null): boolean => (
    rule?.optional === true || (Boolean(rule?.stackedOf) && isHeavyAscensionTwist(second))
);

/** 지금 회차의 규칙 카드가 거절할 수 있는 카드인가(규칙 + 고른 카드의 두 번째 비틀기). */
export const isActiveAscensionRuleOptional = (meta: AscensionRuleMeta): boolean => (
    isOptionalAscensionRule(getActiveAscensionRule(meta), getActiveAscensionTwists(meta)[1] ?? null)
);

/** 2026-10 Wave 106: 규칙 카드의 측정 무게 — 비틀기 무게의 합(`ASCENSION_TWIST_WEIGHTS`). */
export const getAscensionRuleCardWeight = (rule: AscensionRuleDef, second: string | null): number => (
    ASCENSION_TWIST_WEIGHTS[rule.modifier] + (isTwistId(second) ? ASCENSION_TWIST_WEIGHTS[second] : 0)
);

/**
 * 계승 요청의 규칙 선택을 패 안의 규칙으로 — 패에 없는 id(또는 없음)는 패에서 가장 가벼운 카드다. 아무것도 고르지 않은 플레이어가
 * 무거운 카드를 떠안지 않게 한다.
 * - 기본 카드(1순환): 규칙 표 순서(= 놓인 회차에서 잰 무게 순, Wave 90).
 * - 겹친 카드: 두 비틀기의 측정 무게 합이 가장 작은 카드(2026-10 Wave 106, 소유자 결정 §110.6 (c)), 같으면 규칙 번호 순.
 *   바탕 순서만 보던 Wave 105에서는 가벼운 바탕에 무거운 두 번째가 붙은 카드를 고르지 않는 플레이어가 떠안았다(원장 §110.5).
 * `secondOf`는 카드의 두 번째 비틀기다(리듀서 · 화면이 같은 패의 값을 넘긴다 — `resolveAscensionRuleOfferChoice`).
 */
export const resolveAscensionRuleChoice = (
    offer: readonly AscensionRuleDef[],
    ruleId: unknown,
    secondOf: (rule: AscensionRuleDef) => string | null = () => null,
): AscensionRuleDef | null => {
    if (offer.length === 0) return null;
    const chosen = offer.find((rule) => rule.id === ruleId);
    if (chosen) return chosen;
    const order = (rule: AscensionRuleDef) => ALL_ASCENSION_RULES.indexOf(rule);
    if (!offer.some((rule) => rule.stackedOf)) return [...offer].sort((a, b) => order(a) - order(b))[0];
    return [...offer].sort((a, b) => (
        getAscensionRuleCardWeight(a, secondOf(a)) - getAscensionRuleCardWeight(b, secondOf(b)) || order(a) - order(b)
    ))[0];
};

/** 2026-10 Wave 106: 이 계승의 패에서 고른(또는 기본) 카드 — 계승 리듀서와 화면이 같은 패 · 같은 두 번째 비틀기로 고른다. */
export const resolveAscensionRuleOfferChoice = (player: RuleOfferPlayer, nextRank: number, ruleId: unknown): AscensionRuleDef | null => (
    resolveAscensionRuleChoice(getAscensionRuleOffer(player, nextRank), ruleId, (rule) => getAscensionRuleOfferSecond(player, nextRank, rule))
);

/** 이번 회차에 실제로 적용된 규칙 — 선택형 규칙을 거절했으면 없다(표적 배율 · 정복 보상 · 수집 요약이 이것을 읽는다). */
export const getPlayerAscensionRule = (
    player: Pick<Player, 'meta' | 'ascensionRuleDeclined'> | null | undefined,
): AscensionRuleDef | null => {
    const rule = getActiveAscensionRule(player?.meta);
    if (rule && isActiveAscensionRuleOptional(player?.meta) && player?.ascensionRuleDeclined === true) return null;
    return rule;
};

/** 시작 · 계승 요청의 거절 의사를 저장할 값으로 — 거절할 수 있는 카드일 때만 참이 된다(Wave 106: 무거운 두 번째 비틀기 포함). */
export const resolveAscensionRuleDeclined = (meta: AscensionRuleMeta, declineRule: unknown): boolean => (
    declineRule === true && isActiveAscensionRuleOptional(meta)
);

/** 이 각인이 지금 회차의 표적 세트이면 드롭률 배율(`BALANCE.ASCENSION_RULE_SIGNATURE_MULT`), 아니면 1. 난수를 쓰지 않는다. */
export const getRuleSignatureDropMult = (player: Pick<Player, 'meta' | 'ascensionRuleDeclined'> | null | undefined, itemName: string | undefined): number => {
    const rule = getPlayerAscensionRule(player);
    if (!rule || !itemName) return 1;
    return SIGNATURE_SET_OF[itemName] === rule.signatureSet ? BALANCE.ASCENSION_RULE_SIGNATURE_MULT : 1;
};

/** 이 묶음(세트 또는 세트 밖 묶음)의 각인 이름(레지스트리 순서). */
export const getSignatureSetMemberNames = (setKey: string): string[] => (
    Object.entries(SIGNATURE_SET_OF).filter(([, set]) => set === setKey).map(([name]) => name)
);

const SIGNATURE_SET_NAMES: Record<string, string> = {
    ...Object.fromEntries(Object.entries(signatureSetsData.sets).map(([key, set]) => [key, set.name])),
    [UNBOUND_SIGNATURE_GROUP.key]: UNBOUND_SIGNATURE_GROUP.name,
};

/** 수집 단위 묶음 키 — 다섯 세트(`signatureSets.json` 순서) + 세트 밖 묶음. 표적 · 도감 수집 요약이 같은 목록을 읽는다. */
export const SIGNATURE_COLLECTION_GROUPS: readonly string[] = Object.freeze([
    ...Object.keys(signatureSetsData.sets),
    UNBOUND_SIGNATURE_GROUP.key,
]);

/** 세트 표시 이름(`signatureSets.json`). */
export const getSignatureSetName = (setKey: string): string => SIGNATURE_SET_NAMES[setKey] || setKey;

/**
 * 정복한 규칙 번호의 집합 — 칭호 복구(`checkTitles` 'ruleConquest')와 도감 정복 수가 읽는다. 번호는 `ALL_ASCENSION_RULES` 순서다
 * (기본 1 ~ 6, 겹친 7 ~ 12 — Wave 105).
 */
export const getConqueredRuleOrdinals = (stats: RuleConquestStats): Set<number> => new Set(
    [...getConqueredRuleIds(stats)].map((id) => ALL_ASCENSION_RULES.findIndex((rule) => rule.id === id) + 1).filter((ordinal) => ordinal > 0),
);

/** 비틀기 표시 이름(도전 조건 라벨). */
const getTwistLabel = (id: string): string => BALANCE.CHALLENGE_MODIFIERS.find((modifier) => modifier.id === id)?.label || id;

/** 규칙의 비틀기 표시 이름 — 두 번째 비틀기가 있으면 두 이름을 함께(Wave 105). */
export const getAscensionRuleTwistLabel = (rule: AscensionRuleDef, second?: string | null): string => (
    second ? MSG.ASCENSION_RULE_TWIST_PAIR(getTwistLabel(rule.modifier), getTwistLabel(second)) : getTwistLabel(rule.modifier)
);

/** 회차 시작 로그 — 규칙이 없으면 null, 선택형 규칙을 거절했으면 거절 로그. */
export const getAscensionRuleStartLog = (meta: AscensionRuleMeta, declined = false): string | null => {
    const rule = getActiveAscensionRule(meta);
    if (!rule) return null;
    if (declined && isActiveAscensionRuleOptional(meta)) return MSG.ASCENSION_RULE_DECLINED_START(rule.name);
    const twists = getActiveAscensionTwists(meta);
    return MSG.ASCENSION_RULE_START(rule.name, getAscensionRuleTwistLabel(rule, twists[1]), getSignatureSetName(rule.signatureSet));
};
