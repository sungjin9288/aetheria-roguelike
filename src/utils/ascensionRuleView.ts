import { MSG } from '../data/messages.js';
import {
    getAscensionRule,
    getAscensionRuleTwistLabel,
    getConqueredRuleOrdinals,
    getSignatureSetMemberNames,
    getSignatureSetName,
} from '../systems/ascensionRule.js';
import { ASCENSION_RULES } from '../data/ascensionRules.js';
import signatureSetsData from '../data/signatureSets.json' with { type: 'json' };
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
}

/** 이 계승 단계에서 시작하는 회차의 규칙 미리보기 — 규칙이 없으면 null. */
export const getAscensionRulePreview = (rank: number | null | undefined): AscensionRulePreview | null => {
    const rule = getAscensionRule(rank);
    if (!rule) return null;
    return {
        lockedId: rule.modifier,
        name: rule.name,
        detail: MSG.ASCENSION_RULE_DETAIL(getAscensionRuleTwistLabel(rule), getSignatureSetName(rule.signatureSet), rule.conquestTitle.name),
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

/** 도감의 수집 완주 요약 — 세트별 발견 수 · 회차 규칙 정복 수 · 이번 회차의 표적 세트. */
export const getCollectionSummary = (player: Player): CollectionSummary => {
    const discovered = new Set(getDiscoveredSignatureNames(player));
    const rule = getAscensionRule(player.meta?.prestigeRank);
    const sets = Object.keys(signatureSetsData.sets).map((key) => {
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
