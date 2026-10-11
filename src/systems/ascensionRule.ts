import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { ASCENSION_RULES, UNBOUND_SIGNATURE_GROUP, type AscensionRuleDef } from '../data/ascensionRules.js';
import signatureRegistryData from '../data/signatureRegistry.json' with { type: 'json' };
import signatureSetsData from '../data/signatureSets.json' with { type: 'json' };
import type { Player } from '../types/index.js';

/**
 * 회차 규칙 판정 (2026-10 Wave 89) — 규칙은 계승 단계(rank)에서 도출된다. 저장하지 않으므로 사망 재시작 · 계승 · 복원이 모두
 * 같은 규칙을 읽는다. rank 0(첫 회차)에는 규칙이 없다. 데이터는 `data/ascensionRules.ts`.
 */

// 각인 → 묶음 키. 세트에 속하지 않은 각인은 `UNBOUND_SIGNATURE_GROUP.key`(Wave 90 — 여섯째 규칙의 표적).
const SIGNATURE_SET_OF: Record<string, string> = Object.fromEntries(
    Object.entries(signatureRegistryData.entries).map(([name, entry]) => [
        name, (entry as { setGroup?: string }).setGroup || UNBOUND_SIGNATURE_GROUP.key,
    ]),
);

/** 이 계승 단계의 회차 규칙(rank 1 ~ 규칙 수가 차례, 그 뒤 다시 돈다). rank 0은 없다. */
export const getAscensionRule = (rank: number | null | undefined): AscensionRuleDef | null => {
    const r = Math.floor(Number(rank) || 0);
    if (r < 1 || ASCENSION_RULES.length === 0) return null;
    return ASCENSION_RULES[(r - 1) % ASCENSION_RULES.length];
};

/** 거절할 수 있는 규칙인가(Wave 91 — 무거운 비틀기 셋). */
export const isOptionalAscensionRule = (rule: AscensionRuleDef | null | undefined): boolean => rule?.optional === true;

/** 이번 회차에 실제로 적용된 규칙 — 선택형 규칙을 거절했으면 없다(표적 배율 · 정복 보상 · 수집 요약이 이것을 읽는다). */
export const getPlayerAscensionRule = (
    player: Pick<Player, 'meta' | 'ascensionRuleDeclined'> | null | undefined,
): AscensionRuleDef | null => {
    const rule = getAscensionRule(player?.meta?.prestigeRank);
    if (rule && isOptionalAscensionRule(rule) && player?.ascensionRuleDeclined === true) return null;
    return rule;
};

/** 시작 · 계승 요청의 거절 의사를 저장할 값으로 — 선택형 규칙일 때만 참이 된다. */
export const resolveAscensionRuleDeclined = (rank: number | null | undefined, declineRule: unknown): boolean => (
    declineRule === true && isOptionalAscensionRule(getAscensionRule(rank))
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

/** 회차 시작 로그 — 규칙이 없으면 null, 선택형 규칙을 거절했으면 거절 로그. */
export const getAscensionRuleStartLog = (rank: number | null | undefined, declined = false): string | null => {
    const rule = getAscensionRule(rank);
    if (!rule) return null;
    if (declined && isOptionalAscensionRule(rule)) return MSG.ASCENSION_RULE_DECLINED_START(rule.name);
    return MSG.ASCENSION_RULE_START(rule.name, getAscensionRuleTwistLabel(rule), getSignatureSetName(rule.signatureSet));
};
