import { BALANCE } from '../data/constants.js';
import { isSignatureItem } from '../data/signatureItems.js';
import type { Player } from '../types/index.js';
import type { LootCandidate } from './CombatEngine.loot.js';

export type CombatLootAdmission = {
    capacity: number;
    occupied: number;
    available: number;
    admitted: LootCandidate[];
    blocked: LootCandidate[];
};

const positiveSafeInteger = (value: unknown): value is number => (
    Number.isSafeInteger(value) && Number(value) > 0
);

export const admitCombatLoot = (
    player: Player,
    candidates: readonly LootCandidate[],
): CombatLootAdmission => {
    const capacity = positiveSafeInteger(player.maxInv)
        ? player.maxInv
        : positiveSafeInteger(BALANCE.INV_MAX_SIZE)
            ? BALANCE.INV_MAX_SIZE
            : null;

    if (capacity === null) throw new Error('INVALID_INVENTORY_CAPACITY');

    const occupied = player.inv?.length ?? 0;
    const available = Math.max(0, capacity - occupied);
    const signatures = candidates.filter(({ item }) => isSignatureItem(item));
    const normals = candidates.filter(({ item }) => !isSignatureItem(item));
    const ordered = signatures.concat(normals);

    return {
        capacity,
        occupied,
        available,
        admitted: ordered.slice(0, available),
        blocked: ordered.slice(available),
    };
};
