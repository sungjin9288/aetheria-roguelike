import { BALANCE } from '../data/constants';
import { DB } from '../data/db';
import type {
    ExpeditionSummary,
    Player,
    ReturnSupplyRewardLedger,
} from '../types/player';

export const RETURN_SUPPLY_REWARD_NAME = '하급 체력 물약';

const canonicalReward = DB.ITEMS.consumables.find((item: any) => (
    item.name === RETURN_SUPPLY_REWARD_NAME
));

export const isMeaningfulSafeReturn = (
    summary: ExpeditionSummary | null | undefined,
): summary is ExpeditionSummary => Boolean(
    summary
    && typeof summary.id === 'string'
    && summary.id.trim()
    && summary.returnReason === 'safe_return'
    && ((Number(summary.battles) || 0) > 0 || (Number(summary.explores) || 0) > 0),
);

export const normalizeReturnSupplyRewardLedger = (value: unknown): ReturnSupplyRewardLedger => {
    const candidate = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Partial<ReturnSupplyRewardLedger>
        : {};
    const rawReceipts = candidate.receipts && typeof candidate.receipts === 'object'
        && !Array.isArray(candidate.receipts)
        ? candidate.receipts
        : {};
    const receipts = Object.fromEntries(Object.entries(rawReceipts).flatMap(([rawId, rawReceipt]) => {
        const expeditionId = rawId.trim();
        const status = (rawReceipt as any)?.status;
        if (!expeditionId || !['pending', 'delivered'].includes(status)) return [];
        return [[expeditionId, { status }]];
    }));
    return { version: 1, receipts };
};

export const recordReturnSupplyReward = (player: Player, expeditionId: string): Player => {
    const summary = player.lastExpeditionSummary;
    const id = typeof expeditionId === 'string' ? expeditionId.trim() : '';
    if (!isMeaningfulSafeReturn(summary) || summary.id !== id) return player;
    const ledger = normalizeReturnSupplyRewardLedger(player.returnSupplyRewards);
    if (ledger.receipts[id]) return player;
    return {
        ...player,
        returnSupplyRewards: {
            version: 1,
            receipts: { ...ledger.receipts, [id]: { status: 'pending' } },
        },
    };
};

export const getReturnSupplyRewardStatus = (
    player: Player,
    expeditionId: string,
): 'available' | 'pending' | 'delivered' => {
    const receipt = normalizeReturnSupplyRewardLedger(player.returnSupplyRewards).receipts[expeditionId];
    return receipt?.status || 'available';
};

export const deliverPendingReturnSupplyRewards = (player: Player): {
    player: Player;
    deliveredExpeditionIds: string[];
} => {
    const ledger = normalizeReturnSupplyRewardLedger(player.returnSupplyRewards);
    const pendingIds = Object.entries(ledger.receipts)
        .filter(([, receipt]) => receipt.status === 'pending')
        .map(([expeditionId]) => expeditionId)
        .sort();
    if (pendingIds.length === 0 || !canonicalReward) {
        return { player, deliveredExpeditionIds: [] };
    }

    const inventory = [...(Array.isArray(player.inv) ? player.inv : [])];
    const receipts = { ...ledger.receipts };
    const deliveredExpeditionIds: string[] = [];
    const capacity = player.maxInv || BALANCE.INV_MAX_SIZE;

    for (const expeditionId of pendingIds) {
        const itemId = `return-supply:${expeditionId}`;
        const alreadyPresent = inventory.some((item: any) => item.id === itemId);
        if (!alreadyPresent && inventory.length >= capacity) continue;
        if (!alreadyPresent) inventory.push({ ...canonicalReward, id: itemId });
        receipts[expeditionId] = { status: 'delivered' };
        deliveredExpeditionIds.push(expeditionId);
    }

    if (deliveredExpeditionIds.length === 0) {
        return { player, deliveredExpeditionIds };
    }
    return {
        player: {
            ...player,
            inv: inventory,
            returnSupplyRewards: { version: 1, receipts },
        },
        deliveredExpeditionIds,
    };
};
