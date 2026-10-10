import { DB } from '../data/db.js';
import { MSG } from '../data/messages.js';
import signatureRegistryData from '../data/signatureRegistry.json' with { type: 'json' };
import { getAscensionRule, getSignatureSetMemberNames } from '../systems/ascensionRule.js';
import type { Item, Player } from '../types/index.js';
import { withCanonicalEquipmentBaseIdentity } from './equipmentBaseIdentity.js';
import { registerLootToCodex } from './gameUtils.js';
import { getDiscoveredSignatureNames } from './signatureDiscovery.js';

/**
 * 회차 규칙 정복 (2026-10 Wave 89, 소유자 결정 "반복하면서 칭호 · 세트를 다 모으는 콜렉터의 재미를 완수할 수 있게").
 *
 * 규칙이 있는 계승 단계(rank ≥ 1)에서 마왕을 처음 쓰러뜨리면 그 단계의 정복 보상을 한 번 받는다:
 * - 정복 칭호(규칙마다 하나) — `player.titles`에 바로 더한다(`checkTitles` 'ruleConquest'가 기록으로 복구한다).
 * - 전설 각인 하나 — 표적 세트에서 아직 발견하지 못한 첫 각인, 세트를 다 모았으면 다른 세트의 아직 없는 첫 각인(레지스트리 순서).
 *   다 모았으면 각인 없이 로그만 남긴다. 도감에 등록하고, 보장 보상이라 가방 상한을 넘어 들어간다.
 *
 * 정복 기록 `stats.ruleConquestRanks`(계정 단위)가 단계마다 한 번을 지킨다 — 같은 단계에서 사망 재시작 뒤 다시 잡거나 계승을 미룬 채
 * 다시 잡아도 두 번 받지 않는다. 난수를 쓰지 않는다(아이템 id는 처치 영수증에서 만든다).
 */

const REGISTRY_ORDER = Object.keys(signatureRegistryData.entries);

const findEquipmentTemplate = (name: string): Item | undefined => (
    [...(DB.ITEMS.weapons || []), ...(DB.ITEMS.armors || [])].find((item) => item.name === name)
);

/** 정복의 전리품 — 표적 세트의 아직 없는 첫 각인, 없으면 다른 세트의 아직 없는 첫 각인. 다 모았으면 null. */
export const pickRuleConquestSignature = (player: Player, setKey: string): string | null => {
    const discovered = new Set(getDiscoveredSignatureNames(player));
    const missing = (name: string) => !discovered.has(name) && Boolean(findEquipmentTemplate(name));
    return getSignatureSetMemberNames(setKey).find(missing) || REGISTRY_ORDER.find(missing) || null;
};

export const hasConqueredRank = (player: Player, rank: number): boolean => (
    Array.isArray(player.stats?.ruleConquestRanks) && player.stats.ruleConquestRanks.includes(rank)
);

export const applyRuleConquest = (
    player: Player,
    receiptKey: string,
): { player: Player; logs: Array<{ type: string; text: string }>; signature: string | null; titleId: string | null } => {
    const rank = Math.floor(Number(player.meta?.prestigeRank) || 0);
    const rule = getAscensionRule(rank);
    if (!rule || hasConqueredRank(player, rank)) return { player, logs: [], signature: null, titleId: null };

    const logs: Array<{ type: string; text: string }> = [{ type: 'critical', text: MSG.ASCENSION_RULE_CONQUERED(rule.name) }];
    const titleId = rule.conquestTitle.id;
    const hadTitle = (player.titles || []).includes(titleId);
    let next: Player = {
        ...player,
        titles: hadTitle ? player.titles : [...(player.titles || []), titleId],
        stats: {
            ...(player.stats || {}),
            ruleConquestRanks: [...(player.stats?.ruleConquestRanks || []), rank],
        },
    };
    if (!hadTitle) logs.push({ type: 'system', text: MSG.TITLE_UNLOCKED(rule.conquestTitle.name) });

    const signature = pickRuleConquestSignature(next, rule.signatureSet);
    const template = signature ? findEquipmentTemplate(signature) : undefined;
    if (signature && template) {
        const item = withCanonicalEquipmentBaseIdentity({ ...template, id: `rule-conquest:${receiptKey}` });
        next = registerLootToCodex({ ...next, inv: [...(next.inv || []), item] }, [item]);
        logs.push({ type: 'success', text: MSG.ASCENSION_RULE_CONQUEST_SIGNATURE(signature) });
    } else {
        logs.push({ type: 'info', text: MSG.ASCENSION_RULE_CONQUEST_COMPLETE });
    }
    return { player: next, logs, signature: template ? signature : null, titleId };
};
