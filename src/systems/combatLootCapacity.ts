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
    // 2026-10 Wave 58: 보장 보상은 상한과 무관하게 들어가고(가방은 상한을 넘을 수 있다 — 보상 경로와 같은 규칙),
    //   남은 칸을 먼저 쓴다. 나머지는 이전처럼 서명 우선이다.
    const guaranteed = candidates.filter((candidate) => candidate.guaranteed);
    const rest = candidates.filter((candidate) => !candidate.guaranteed);
    const signatures = rest.filter(({ item }) => isSignatureItem(item));
    const normals = rest.filter(({ item }) => !isSignatureItem(item));
    const ordered = signatures.concat(normals);
    const restSlots = Math.max(0, available - guaranteed.length);

    return {
        capacity,
        occupied,
        available,
        admitted: guaranteed.concat(ordered.slice(0, restSlots)),
        blocked: ordered.slice(restSlots),
    };
};
