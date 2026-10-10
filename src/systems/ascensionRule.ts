import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { ASCENSION_RULES, type AscensionRuleDef } from '../data/ascensionRules.js';
import signatureRegistryData from '../data/signatureRegistry.json' with { type: 'json' };
import signatureSetsData from '../data/signatureSets.json' with { type: 'json' };
import type { Player } from '../types/index.js';

/**
 * 회차 규칙 판정 (2026-10 Wave 89) — 규칙은 계승 단계(rank)에서 도출된다. 저장하지 않으므로 사망 재시작 · 계승 · 복원이 모두
 * 같은 규칙을 읽는다. rank 0(첫 회차)에는 규칙이 없다. 데이터는 `data/ascensionRules.ts`.
 */

const SIGNATURE_SET_OF: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(signatureRegistryData.entries).map(([name, entry]) => [name, (entry as { setGroup?: string }).setGroup]),
);

/** 이 계승 단계의 회차 규칙(rank 1 ~ 5가 차례, 6부터 다시 돈다). rank 0은 없다. */
export const getAscensionRule = (rank: number | null | undefined): AscensionRuleDef | null => {
    const r = Math.floor(Number(rank) || 0);
    if (r < 1 || ASCENSION_RULES.length === 0) return null;
    return ASCENSION_RULES[(r - 1) % ASCENSION_RULES.length];
};

/** 플레이어의 지금 회차 규칙. */
export const getPlayerAscensionRule = (player: Pick<Player, 'meta'> | null | undefined): AscensionRuleDef | null => (
    getAscensionRule(player?.meta?.prestigeRank)
);

/** 이 각인이 지금 회차의 표적 세트이면 드롭률 배율(`BALANCE.ASCENSION_RULE_SIGNATURE_MULT`), 아니면 1. 난수를 쓰지 않는다. */
export const getRuleSignatureDropMult = (player: Pick<Player, 'meta'> | null | undefined, itemName: string | undefined): number => {
    const rule = getPlayerAscensionRule(player);
    if (!rule || !itemName) return 1;
    return SIGNATURE_SET_OF[itemName] === rule.signatureSet ? BALANCE.ASCENSION_RULE_SIGNATURE_MULT : 1;
};

/** 이 세트의 각인 이름(레지스트리 순서). */
export const getSignatureSetMemberNames = (setKey: string): string[] => (
    Object.entries(SIGNATURE_SET_OF).filter(([, set]) => set === setKey).map(([name]) => name)
);

const SIGNATURE_SET_NAMES: Record<string, string> = Object.fromEntries(
    Object.entries(signatureSetsData.sets).map(([key, set]) => [key, set.name]),
);

/** 세트 표시 이름(`signatureSets.json`). */
export const getSignatureSetName = (setKey: string): string => SIGNATURE_SET_NAMES[setKey] || setKey;

/** 이 계승 단계가 몇 번째 규칙인지(1 ~ 규칙 수). rank 0은 0. */
export const getAscensionRuleOrdinal = (rank: number | null | undefined): number => {
    const rule = getAscensionRule(rank);
    return rule ? ASCENSION_RULES.indexOf(rule) + 1 : 0;
};

/** 정복한 계승 단계 목록에서 정복한 규칙 번호(1 ~ 규칙 수)의 집합. */
export const getConqueredRuleOrdinals = (conqueredRanks: unknown): Set<number> => new Set(
    (Array.isArray(conqueredRanks) ? conqueredRanks : [])
        .map((rank) => getAscensionRuleOrdinal(Number(rank)))
        .filter((ordinal) => ordinal > 0),
);

/** 규칙의 비틀기 표시 이름(도전 조건 라벨). */
export const getAscensionRuleTwistLabel = (rule: AscensionRuleDef): string => (
    BALANCE.CHALLENGE_MODIFIERS.find((modifier) => modifier.id === rule.modifier)?.label || rule.modifier
);

/** 회차 시작 로그 — 규칙이 없으면 null. */
export const getAscensionRuleStartLog = (rank: number | null | undefined): string | null => {
    const rule = getAscensionRule(rank);
    return rule ? MSG.ASCENSION_RULE_START(rule.name, getAscensionRuleTwistLabel(rule), getSignatureSetName(rule.signatureSet)) : null;
};
