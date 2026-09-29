import { getInventoryCapacity } from '../utils/inventoryCapacity.js';
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

export const admitCombatLoot = (
    player: Player,
    candidates: readonly LootCandidate[],
): CombatLootAdmission => {
    // 2026-09 Wave 33: 상한은 getInventoryCapacity(영구 크기 + 이번 런 가방 칸)가 소유한다.
    const capacity = getInventoryCapacity(player);

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
