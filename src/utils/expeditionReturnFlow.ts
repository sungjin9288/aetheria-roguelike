import { BALANCE } from '../data/constants.js';
import { DB } from '../data/db.js';
import type { ExpeditionSummary, Player } from '../types/player.js';
import { getEquipmentDecision } from './equipmentUtils.js';
import { getExpeditionQuestEntries } from './expeditionMissionFocus.js';
import { getMirrorEffects } from '../systems/mirrorUpgrades.js';

export type ExpeditionReturnActionKind =
    | 'claim_quest'
    | 'rest'
    | 'open_equipment'
    | 'open_inventory'
    | 'open_shop'
    | 'open_crafting'
    | 'open_quest_board';

export interface ExpeditionReturnAction {
    kind: ExpeditionReturnActionKind;
    label: string;
    detail: string;
    questId?: string | number;
    itemName?: string;
}

const countItems = (items: any[]) => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
        if (item?.name) counts.set(item.name, (counts.get(item.name) || 0) + 1);
    });
    return counts;
};

const canCraft = (player: Player) => {
    const counts = countItems(player.inv || []);
    return (DB.ITEMS.recipes || []).some((recipe: any) => (
        (player.gold || 0) >= (recipe.gold || 0)
        && (recipe.inputs || []).every((input: any) => (
            (counts.get(input.name) || 0) >= (input.qty || 0)
        ))
    ));
};

const getNewEquipmentUpgrade = (player: Player, summary: ExpeditionSummary) => {
    const newItemNames = new Set(summary.newItems);
    return (player.inv || [])
        .filter((item: any) => newItemNames.has(item?.name))
        .map((item: any) => ({ item, decision: getEquipmentDecision(player, item) }))
        .filter(({ decision }) => decision?.equipable && decision.score > 0)
        .sort((left, right) => (right.decision?.score || 0) - (left.decision?.score || 0))[0] || null;
};

export const getRestCost = (player: Player) => Math.floor(
    BALANCE.REST_COST
    * (1 + (player.level || 1) / 20)
    * getMirrorEffects(player.meta).restCostMult,
);

export const getExpeditionReturnAction = (
    player: Player,
    summary: ExpeditionSummary,
    stats: { maxHp?: number; maxMp?: number } = {},
): ExpeditionReturnAction => {
    const questEntries = getExpeditionQuestEntries(player);
    const claimable = questEntries.find((entry) => entry.isComplete);
    if (claimable) {
        return {
            kind: 'claim_quest',
            label: '임무 보상 받기',
            detail: `${claimable.quest.title}의 보상이 기다리고 있습니다.`,
            questId: claimable.id,
        };
    }

    const maxHp = Math.max(1, stats.maxHp || player.maxHp || summary.maxHpAtReturn || 1);
    const maxMp = Math.max(1, stats.maxMp || player.maxMp || 1);
    const needsRecovery = (player.hp || 0) / maxHp < 0.85
        || (player.mp || 0) / maxMp < 0.6
        || (player.status || []).length > 0;

    if (needsRecovery) {
        const restCost = getRestCost(player);
        if ((player.gold || 0) >= restCost) {
            return {
                kind: 'rest',
                label: '휴식하고 회복',
                detail: `골드 ${restCost.toLocaleString('ko-KR')}로 생명과 기력을 모두 회복합니다.`,
            };
        }

        const recoveryItem = (player.inv || []).find((item: any) => ['hp', 'mp', 'cure'].includes(item?.type));
        if (recoveryItem) {
            return {
                kind: 'open_inventory',
                label: '회복 아이템 확인',
                detail: `${recoveryItem.name}을 사용해 다음 출발을 준비하세요.`,
            };
        }

        const affordableSupply = (DB.ITEMS.consumables || []).find((item: any) => (
            ['hp', 'mp', 'cure'].includes(item?.type) && (item.price || 0) <= (player.gold || 0)
        ));
        if (affordableSupply) {
            return {
                kind: 'open_shop',
                label: '회복 물품 마련',
                detail: `${affordableSupply.name}을 마련해 다음 원정의 위험을 낮추세요.`,
            };
        }
    }

    const equipmentUpgrade = getNewEquipmentUpgrade(player, summary);
    if (equipmentUpgrade?.decision) {
        return {
            kind: 'open_equipment',
            label: '추천 장비 확인',
            detail: `${equipmentUpgrade.item.name} · ${equipmentUpgrade.decision.primaryDelta.text}`,
            itemName: equipmentUpgrade.item.name,
        };
    }

    const inventoryCap = player.maxInv || BALANCE.INV_MAX_SIZE;
    if ((player.inv || []).length >= inventoryCap - 2) {
        return {
            kind: 'open_inventory',
            label: '가방 정리하기',
            detail: `가방이 ${(player.inv || []).length}/${inventoryCap}칸입니다. 다음 전리품을 위한 자리를 만드세요.`,
        };
    }

    if (canCraft(player)) {
        return {
            kind: 'open_crafting',
            label: '제작 가능한 장비 보기',
            detail: '이번 원정에서 모은 재료로 지금 만들 수 있는 제작법이 있습니다.',
        };
    }

    return {
        kind: 'open_quest_board',
        label: questEntries.length > 0 ? '다음 임무 정리' : '다음 임무 고르기',
        detail: questEntries.length > 0
            ? '진행 중인 임무를 살피고 다음 원정의 목표를 정하세요.'
            : '마을 게시판에서 다음 원정의 목표를 고르세요.',
    };
};
