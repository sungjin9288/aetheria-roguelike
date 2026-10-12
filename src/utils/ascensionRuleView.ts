import { MSG } from '../data/messages.js';
import {
    SIGNATURE_COLLECTION_GROUPS,
    getActiveAscensionRule,
    getAscensionRuleCycle,
    getAscensionRuleOffer,
    resolveAscensionRuleChoice,
    getAscensionRuleTwistLabel,
    getConqueredRuleOrdinals,
    getPlayerAscensionRule,
    isOptionalAscensionRule,
    getSignatureSetMemberNames,
    getSignatureSetName,
} from '../systems/ascensionRule.js';
import { ASCENSION_RULES, type AscensionRuleDef } from '../data/ascensionRules.js';
import type { Player } from '../types/index.js';
import { getDiscoveredSignatureNames } from './signatureDiscovery.js';

/**
 * 회차 규칙 · 수집 완주 화면 뷰모델 (2026-10 Wave 89) — 계승 · 인트로 · 진 엔딩의 도전 규칙 선택과 도감의 수집 요약이 읽는다.
 * 문구는 `MSG`, 판정은 `systems/ascensionRule.ts`.
 */

export interface AscensionRulePreview {
    /** 2026-10 Wave 94: 규칙 id — 계승 화면의 카드 선택이 이 값을 계승 요청에 싣는다. */
    id: string;
    /** 2026-10 Wave 94: 카드에 짧게 보일 비틀기 이름. */
    twist: string;
    /** 강제되는 도전 조건 id(선택 화면에서 잠긴 칸). */
    lockedId: string;
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
const getAscensionRuleOutlookLines = (rule: AscensionRuleDef, cycle: number): AscensionRuleOutlookLines | null => {
    const measured = isOptionalAscensionRule(rule) ? rule.outlook : undefined;
    if (!measured || measured.length === 0 || cycle < 1) return null;
    const measuredCycle = Math.min(cycle, measured.length);
    const outlook = measured[measuredCycle - 1];
    return {
        accepted: MSG.ASCENSION_RULE_OUTLOOK_ACCEPTED(formatOutlookNumber(outlook.acceptedDeaths), formatOutlookNumber(outlook.acceptedSignatures)),
        declined: MSG.ASCENSION_RULE_OUTLOOK_DECLINED(formatOutlookNumber(outlook.declinedDeaths), formatOutlookNumber(outlook.declinedSignatures)),
        source: MSG.ASCENSION_RULE_OUTLOOK_SOURCE(outlook.measuredRank),
    };
};

/** 이 규칙이 이 계승 단계에서 시작하는 회차의 미리보기(카드 한 장). */
export const buildAscensionRulePreview = (rule: AscensionRuleDef, rank: number): AscensionRulePreview => (
    {
        id: rule.id,
        twist: getAscensionRuleTwistLabel(rule),
        lockedId: rule.modifier,
        name: rule.name,
        detail: MSG.ASCENSION_RULE_DETAIL(getAscensionRuleTwistLabel(rule), getSignatureSetName(rule.signatureSet), rule.conquestTitle.name),
        optional: isOptionalAscensionRule(rule),
        outlook: getAscensionRuleOutlookLines(rule, getAscensionRuleCycle(rank)),
    }
);

/** 지금 단계의 회차 규칙 미리보기(새 게임 · 사망 재시작 화면) — 규칙이 없으면 null. */
export const getAscensionRulePreview = (meta: Player['meta'] | null | undefined): AscensionRulePreview | null => {
    const rule = getActiveAscensionRule(meta);
    return rule ? buildAscensionRulePreview(rule, Math.floor(Number(meta?.prestigeRank) || 0)) : null;
};

/** 2026-10 Wave 94: 계승 화면의 회차 규칙 카드(패 순서) — 리듀서가 같은 패로 고른 id를 검증한다. */
export const getAscensionRuleOfferPreviews = (
    player: { meta?: Player['meta']; stats?: Player['stats'] } | null | undefined,
    nextRank: number,
): AscensionRulePreview[] => getAscensionRuleOffer(player, nextRank).map((rule) => buildAscensionRulePreview(rule, nextRank));

/** 계승 화면의 패와 처음 골라 둔 카드(리듀서의 기본값과 같은 — 패에서 가장 가벼운 카드). */
export const getAscensionRuleOfferView = (
    player: { meta?: Player['meta']; stats?: Player['stats'] } | null | undefined,
    nextRank: number,
): { cards: AscensionRulePreview[]; defaultId: string | null } => {
    const offer = getAscensionRuleOffer(player, nextRank);
    return {
        cards: offer.map((rule) => buildAscensionRulePreview(rule, nextRank)),
        defaultId: resolveAscensionRuleChoice(offer, undefined)?.id ?? null,
    };
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
    return {
        sets,
        conquestLabel: MSG.COLLECTION_CONQUEST_ROW(conquered, ASCENSION_RULES.length),
        conquered,
        conquestTotal: ASCENSION_RULES.length,
        featuredLabel: rule ? MSG.COLLECTION_FEATURED(rule.name, getSignatureSetName(rule.signatureSet)) : null,
    };
};
