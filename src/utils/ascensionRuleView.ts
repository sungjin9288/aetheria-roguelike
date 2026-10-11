import { MSG } from '../data/messages.js';
import {
    SIGNATURE_COLLECTION_GROUPS,
    getAscensionRule,
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

/** 선택형 규칙의 받아들임 · 거절 미리보기 줄 — 강제 규칙이나 측정값이 없는 규칙은 null(숫자를 지어내지 않는다). */
const getAscensionRuleOutlookLines = (rule: AscensionRuleDef): AscensionRuleOutlookLines | null => {
    const outlook = isOptionalAscensionRule(rule) ? rule.outlook : undefined;
    if (!outlook) return null;
    return {
        accepted: MSG.ASCENSION_RULE_OUTLOOK_ACCEPTED(formatOutlookNumber(outlook.acceptedDeaths), formatOutlookNumber(outlook.acceptedSignatures)),
        declined: MSG.ASCENSION_RULE_OUTLOOK_DECLINED(formatOutlookNumber(outlook.declinedDeaths), formatOutlookNumber(outlook.declinedSignatures)),
        source: MSG.ASCENSION_RULE_OUTLOOK_SOURCE,
    };
};

/** 이 계승 단계에서 시작하는 회차의 규칙 미리보기 — 규칙이 없으면 null. */
export const getAscensionRulePreview = (rank: number | null | undefined): AscensionRulePreview | null => {
    const rule = getAscensionRule(rank);
    if (!rule) return null;
    return {
        lockedId: rule.modifier,
        name: rule.name,
        detail: MSG.ASCENSION_RULE_DETAIL(getAscensionRuleTwistLabel(rule), getSignatureSetName(rule.signatureSet), rule.conquestTitle.name),
        optional: isOptionalAscensionRule(rule),
        outlook: getAscensionRuleOutlookLines(rule),
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
    const conquered = getConqueredRuleOrdinals(player.stats?.ruleConquestRanks).size;
    return {
        sets,
        conquestLabel: MSG.COLLECTION_CONQUEST_ROW(conquered, ASCENSION_RULES.length),
        conquered,
        conquestTotal: ASCENSION_RULES.length,
        featuredLabel: rule ? MSG.COLLECTION_FEATURED(rule.name, getSignatureSetName(rule.signatureSet)) : null,
    };
};
