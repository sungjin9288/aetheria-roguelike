import { MSG } from '../data/messages.js';
import {
    SIGNATURE_COLLECTION_GROUPS,
    canRerollAscensionRuleOffer,
    getActiveAscensionRule,
    getActiveAscensionTwists,
    getAscensionRuleOfferSecond,
    isStackedAscensionRuleDeckOpen,
    getAscensionRulePaidRerolls,
    getAscensionRuleRerollLadderKeep,
    getAscensionRuleRerolls,
    getAscensionRuleCycle,
    getAscensionRuleOffer,
    resolveAscensionRuleOfferChoice,
    getAscensionRuleTwistLabel,
    getConqueredRuleOrdinals,
    getPlayerAscensionRule,
    isOptionalAscensionRule,
    getSignatureSetMemberNames,
    getSignatureSetName,
} from '../systems/ascensionRule.js';
import { ALL_ASCENSION_RULES, ASCENSION_RULES, type AscensionRuleDef } from '../data/ascensionRules.js';
import type { Player } from '../types/index.js';
import { getDiscoveredSignatureNames } from './signatureDiscovery.js';
import { BALANCE } from '../data/constants.js';
import { carryEssenceLadderOnAscension } from '../systems/essenceLedger.js';

/**
 * 회차 규칙 · 수집 완주 화면 뷰모델 (2026-10 Wave 89) — 계승 · 인트로 · 진 엔딩의 도전 규칙 선택과 도감의 수집 요약이 읽는다.
 * 문구는 `MSG`, 판정은 `systems/ascensionRule.ts`.
 */

export interface AscensionRulePreview {
    /** 2026-10 Wave 94: 규칙 id — 계승 화면의 카드 선택이 이 값을 계승 요청에 싣는다. */
    id: string;
    /** 2026-10 Wave 94: 카드에 짧게 보일 비틀기 이름. */
    twist: string;
    /** 강제되는 도전 조건 id(선택 화면에서 잠긴 칸) — 겹친 규칙은 둘이다(Wave 105). */
    lockedIds: string[];
    name: string;
    detail: string;
    /** 2026-10 Wave 91: 거절할 수 있는 규칙(무거운 셋)인가. */
    optional: boolean;
    /** 2026-10 Wave 92: 받아들임 · 거절의 측정 차이(선택형 규칙만, 데이터 `outlook`) — 강제 규칙은 null. */
    outlook: AscensionRuleOutlookLines | null;
}

export interface AscensionRuleOutlookLines {
    accepted: string;
    declined: string;
    source: string;
}

// 소수 한 자리 반올림 — `toFixed`만 쓰면 5.85가 이진 표현 때문에 5.8로 내려간다.
const formatOutlookNumber = (value: number): string => (Math.round(value * 10) / 10).toFixed(1);

/**
 * 선택형 규칙의 받아들임 · 거절 미리보기 줄 — 강제 규칙이나 측정값이 없는 규칙은 null(숫자를 지어내지 않는다).
 * 2026-10 Wave 93: 이 단계의 순환에 맞는 측정을 고르고, 그 순환의 측정이 없으면 마지막으로 잰 순환 값을 보이며 출처 줄이 밝힌다.
 */
const getAscensionRuleOutlookLines = (rule: AscensionRuleDef, cycle: number, optional: boolean): AscensionRuleOutlookLines | null => {
    const measured = optional ? rule.outlook : undefined;
    if (!measured || measured.length === 0 || cycle < 1) return null;
    const measuredCycle = Math.min(cycle, measured.length);
    const outlook = measured[measuredCycle - 1];
    return {
        accepted: MSG.ASCENSION_RULE_OUTLOOK_ACCEPTED(formatOutlookNumber(outlook.acceptedDeaths), formatOutlookNumber(outlook.acceptedSignatures)),
        declined: MSG.ASCENSION_RULE_OUTLOOK_DECLINED(formatOutlookNumber(outlook.declinedDeaths), formatOutlookNumber(outlook.declinedSignatures)),
        source: MSG.ASCENSION_RULE_OUTLOOK_SOURCE(outlook.measuredRank),
    };
};

/** 이 규칙이 이 계승 단계에서 시작하는 회차의 미리보기(카드 한 장) — 겹친 규칙이면 그 카드의 두 번째 비틀기까지(Wave 105). */
export const buildAscensionRulePreview = (rule: AscensionRuleDef, rank: number, second: string | null = null): AscensionRulePreview => {
    // 2026-10 Wave 106: 무거운 두 번째 비틀기가 붙은 겹친 카드도 거절할 수 있다(그 카드들의 측정을 보인다).
    const optional = isOptionalAscensionRule(rule, second);
    return {
        id: rule.id,
        twist: getAscensionRuleTwistLabel(rule, second),
        lockedIds: second ? [rule.modifier, second] : [rule.modifier],
        name: rule.name,
        detail: MSG.ASCENSION_RULE_DETAIL(getAscensionRuleTwistLabel(rule, second), getSignatureSetName(rule.signatureSet), rule.conquestTitle.name),
        optional,
        outlook: getAscensionRuleOutlookLines(rule, getAscensionRuleCycle(rank), optional),
    };
};

/** 지금 단계의 회차 규칙 미리보기(새 게임 · 사망 재시작 화면) — 규칙이 없으면 null. */
export const getAscensionRulePreview = (meta: Player['meta'] | null | undefined): AscensionRulePreview | null => {
    const rule = getActiveAscensionRule(meta);
    return rule ? buildAscensionRulePreview(rule, Math.floor(Number(meta?.prestigeRank) || 0), getActiveAscensionTwists(meta)[1] ?? null) : null;
};

/** 2026-10 Wave 94: 계승 화면의 회차 규칙 카드(패 순서) — 리듀서가 같은 패로 고른 id를 검증한다. */
export const getAscensionRuleOfferPreviews = (
    player: { meta?: Player['meta']; stats?: Player['stats'] } | null | undefined,
    nextRank: number,
): AscensionRulePreview[] => getAscensionRuleOffer(player, nextRank).map((rule) => (
    buildAscensionRulePreview(rule, nextRank, getAscensionRuleOfferSecond(player, nextRank, rule))
));

/** 계승 화면의 패와 처음 골라 둔 카드(리듀서의 기본값과 같은 — 패에서 가장 가벼운 카드). */
export const getAscensionRuleOfferView = (
    player: { meta?: Player['meta']; stats?: Player['stats'] } | null | undefined,
    nextRank: number,
): { cards: AscensionRulePreview[]; defaultId: string | null } => {
    const offer = getAscensionRuleOffer(player, nextRank);
    return {
        cards: offer.map((rule) => buildAscensionRulePreview(rule, nextRank, getAscensionRuleOfferSecond(player, nextRank, rule))),
        defaultId: resolveAscensionRuleOfferChoice(player, nextRank, undefined)?.id ?? null,
    };
};

export interface AscensionRuleRerollView {
    /** 지금 다시 뽑은 횟수 — 리듀서에 그대로 보낸다(연타 · 늦은 요청 거부). */
    rerolls: number;
    /** 지금 다시 뽑을 수 있는가(남은 횟수 · 덱이 패보다 큰가). */
    available: boolean;
    /** 다음 다시 뽑기가 무료인가. */
    free: boolean;
    /** 버튼 문구(무료 / 넘어가는 사다리 지금 → 다음) · 횟수 문구. 다 썼으면 버튼 문구가 소진 문구다. */
    label: string;
    countLabel: string;
}

/**
 * 2026-10 Wave 95: 계승 화면의 회차 규칙 패 다시 뽑기 — 다시 뽑을 수 없고(덱 ≤ 패) 다시 뽑은 적도 없으면 null(버튼을 그리지 않는다).
 * 유료 다시 뽑기의 문구는 계승이 실제로 적용할 사다리 이월(`carryEssenceLadderOnAscension`)을 지금 · 한 번 더 뽑은 뒤로 계산한다.
 */
export const getAscensionRuleRerollView = (
    player: { meta?: Player['meta']; stats?: Player['stats'] } | null | undefined,
    nextRank: number,
): AscensionRuleRerollView | null => {
    const rerolls = getAscensionRuleRerolls(player?.meta, nextRank);
    const available = canRerollAscensionRuleOffer(player, nextRank);
    if (!available && rerolls === 0) return null;
    const max = BALANCE.ASCENSION_RULE_REROLL_FREE + BALANCE.ASCENSION_RULE_REROLL_PAID_MAX;
    const free = rerolls < BALANCE.ASCENSION_RULE_REROLL_FREE;
    const paid = getAscensionRulePaidRerolls(player?.meta, nextRank);
    const keptNow = carryEssenceLadderOnAscension(player?.meta, getAscensionRuleRerollLadderKeep(paid)).rankKept;
    const keptNext = carryEssenceLadderOnAscension(player?.meta, getAscensionRuleRerollLadderKeep(paid + 1)).rankKept;
    let label: string = MSG.ASCENSION_RULE_REROLL_SPENT;
    if (available) label = free ? MSG.ASCENSION_RULE_REROLL_FREE : MSG.ASCENSION_RULE_REROLL_PAID(keptNow, keptNext);
    return { rerolls, available, free, label, countLabel: MSG.ASCENSION_RULE_REROLL_COUNT(rerolls, max) };
};

export interface CollectionSetRow {
    key: string;
    label: string;
    owned: number;
    total: number;
    complete: boolean;
    featured: boolean;
}

export interface CollectionSummary {
    sets: CollectionSetRow[];
    conquestLabel: string;
    conquered: number;
    conquestTotal: number;
    featuredLabel: string | null;
}

/** 도감의 수집 완주 요약 — 세트별(세트 밖 묶음 포함) 발견 수 · 회차 규칙 정복 수 · 이번 회차의 표적 묶음. */
export const getCollectionSummary = (player: Player): CollectionSummary => {
    const discovered = new Set(getDiscoveredSignatureNames(player));
    // 2026-10 Wave 91: 거절한 선택형 규칙은 이번 회차의 표적이 아니다.
    const rule = getPlayerAscensionRule(player);
    const sets = SIGNATURE_COLLECTION_GROUPS.map((key) => {
        const members = getSignatureSetMemberNames(key);
        const owned = members.filter((name) => discovered.has(name)).length;
        return {
            key,
            label: MSG.COLLECTION_SET_ROW(getSignatureSetName(key), owned, members.length),
            owned,
            total: members.length,
            complete: members.length > 0 && owned === members.length,
            featured: rule?.signatureSet === key,
        };
    });
    const conquered = getConqueredRuleOrdinals(player.stats).size;
    // 2026-10 Wave 105: 겹친 규칙은 덱이 열린 뒤에야 분모에 든다 — 그 전에는 있다는 것도 말하지 않는다(발견형 원칙, Wave 102 · 103).
    const conquestTotal = isStackedAscensionRuleDeckOpen(player.stats) ? ALL_ASCENSION_RULES.length : ASCENSION_RULES.length;
    return {
        sets,
        conquestLabel: MSG.COLLECTION_CONQUEST_ROW(conquered, conquestTotal),
        conquered,
        conquestTotal,
        featuredLabel: rule ? MSG.COLLECTION_FEATURED(rule.name, getSignatureSetName(rule.signatureSet)) : null,
    };
};
