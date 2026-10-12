import { getAscensionRuleById, getAscensionRuleOffer } from '../../src/systems/ascensionRule.js';
import type { AscensionRuleDef } from '../../src/data/ascensionRules.js';

/**
 * 2026-10 Wave 94: 계승 패(서로 다른 비틀기 3장)에서 피하고 싶은 비틀기가 아닌 카드 하나를 고른다 — 회차 규칙과 무관한 것을 검사하는
 * 테스트가 패의 무작위에 흔들리지 않게 한다. 피할 비틀기가 둘 이하면 언제나 남는다.
 */
export const pickOfferedRuleId = (
    player: Parameters<typeof getAscensionRuleOffer>[0],
    nextRank: number,
    avoidModifiers: readonly string[] = [],
): string => {
    const card = getAscensionRuleOffer(player, nextRank).find((rule) => !avoidModifiers.includes(rule.modifier));
    if (!card) throw new Error(`no offered rule outside ${avoidModifiers.join(', ')}`);
    return card.id;
};

export const ruleOf = (id: string | undefined): AscensionRuleDef => {
    const rule = getAscensionRuleById(id);
    if (!rule) throw new Error(`unknown rule ${id}`);
    return rule;
};
