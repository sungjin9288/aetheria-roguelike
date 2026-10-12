import { BALANCE } from '../data/constants.js';
import { MSG } from '../data/messages.js';
import { ASCENSION_RULES, UNBOUND_SIGNATURE_GROUP, type AscensionRuleDef } from '../data/ascensionRules.js';
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

/** id로 찾은 회차 규칙. */
export const getAscensionRuleById = (ruleId: unknown): AscensionRuleDef | null => (
    typeof ruleId === 'string' ? ASCENSION_RULES.find((rule) => rule.id === ruleId) ?? null : null
);

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

/**
 * 계승할 때 보이는 회차 규칙 카드 — 덱이다: 정복 횟수가 가장 적은 규칙들(이번 순환에서 아직 정복하지 않은 규칙)에서만 무작위로
 * 최대 `BALANCE.ASCENSION_RULE_OFFER_COUNT`장을 뽑는다. 남은 규칙이 그보다 적으면 패도 그만큼이다(하나면 그 규칙뿐) — 정복한
 * 규칙으로 칸을 채우지 않는다. 채우던 첫 구현에서는 고르지 않는 플레이어가 언제나 정복한 가벼운 카드를 받아 무거운 규칙을 영원히
 * 피했다(원장 §99). 여섯을 모두 정복하면 덱이 다시 찬다. 씨앗은 마왕 처치 영수증 · 다음 단계라 같은 처치에서는 같은 패다.
 * 다음 단계가 0 이하면 빈 패.
 */
export const getAscensionRuleOffer = (
    player: { meta?: Player['meta']; stats?: Player['stats'] } | null | undefined,
    nextRank: number,
): AscensionRuleDef[] => {
    if (!(nextRank >= 1)) return [];
    const counts = new Map<string, number>();
    for (const id of getRuleConquestLedger(player?.stats)) counts.set(id, (counts.get(id) || 0) + 1);
    const fewest = Math.min(...ASCENSION_RULES.map((rule) => counts.get(rule.id) || 0));
    const rng = createSeededRandom(deriveSeed(0, 'ascension-rule-offer', player?.meta?.endgame?.lastEndgameReceiptKey ?? 'none', nextRank));
    const shuffle = (rules: AscensionRuleDef[]): AscensionRuleDef[] => {
        const deck = [...rules];
        for (let i = deck.length - 1; i > 0; i -= 1) {
            const j = Math.floor(rng() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    };
    return shuffle(ASCENSION_RULES.filter((rule) => (counts.get(rule.id) || 0) === fewest)).slice(0, BALANCE.ASCENSION_RULE_OFFER_COUNT);
};

/**
 * 계승 요청의 규칙 선택을 패 안의 규칙으로 — 패에 없는 id(또는 없음)는 패에서 가장 가벼운 카드(규칙 표 순서 = 측정한 무게 순,
 * Wave 90)다. 아무것도 고르지 않은 플레이어가 무거운 카드를 떠안지 않게 한다.
 */
export const resolveAscensionRuleChoice = (offer: readonly AscensionRuleDef[], ruleId: unknown): AscensionRuleDef | null => {
    if (offer.length === 0) return null;
    const chosen = offer.find((rule) => rule.id === ruleId);
    if (chosen) return chosen;
    return [...offer].sort((a, b) => ASCENSION_RULES.indexOf(a) - ASCENSION_RULES.indexOf(b))[0];
};

/** 거절할 수 있는 규칙인가(Wave 91 — 무거운 비틀기 셋). */
export const isOptionalAscensionRule = (rule: AscensionRuleDef | null | undefined): boolean => rule?.optional === true;

/** 이번 회차에 실제로 적용된 규칙 — 선택형 규칙을 거절했으면 없다(표적 배율 · 정복 보상 · 수집 요약이 이것을 읽는다). */
export const getPlayerAscensionRule = (
    player: Pick<Player, 'meta' | 'ascensionRuleDeclined'> | null | undefined,
): AscensionRuleDef | null => {
    const rule = getActiveAscensionRule(player?.meta);
    if (rule && isOptionalAscensionRule(rule) && player?.ascensionRuleDeclined === true) return null;
    return rule;
};

/** 시작 · 계승 요청의 거절 의사를 저장할 값으로 — 선택형 규칙일 때만 참이 된다. */
export const resolveAscensionRuleDeclined = (meta: AscensionRuleMeta, declineRule: unknown): boolean => (
    declineRule === true && isOptionalAscensionRule(getActiveAscensionRule(meta))
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

/** 정복한 규칙 번호(1 ~ 규칙 수, 규칙 표 순서)의 집합 — 칭호 복구(`checkTitles` 'ruleConquest')와 도감 정복 수가 읽는다. */
export const getConqueredRuleOrdinals = (stats: RuleConquestStats): Set<number> => new Set(
    [...getConqueredRuleIds(stats)].map((id) => ASCENSION_RULES.findIndex((rule) => rule.id === id) + 1).filter((ordinal) => ordinal > 0),
);

/** 규칙의 비틀기 표시 이름(도전 조건 라벨). */
export const getAscensionRuleTwistLabel = (rule: AscensionRuleDef): string => (
    BALANCE.CHALLENGE_MODIFIERS.find((modifier) => modifier.id === rule.modifier)?.label || rule.modifier
);

/** 회차 시작 로그 — 규칙이 없으면 null, 선택형 규칙을 거절했으면 거절 로그. */
export const getAscensionRuleStartLog = (meta: AscensionRuleMeta, declined = false): string | null => {
    const rule = getActiveAscensionRule(meta);
    if (!rule) return null;
    if (declined && isOptionalAscensionRule(rule)) return MSG.ASCENSION_RULE_DECLINED_START(rule.name);
    return MSG.ASCENSION_RULE_START(rule.name, getAscensionRuleTwistLabel(rule), getSignatureSetName(rule.signatureSet));
};
