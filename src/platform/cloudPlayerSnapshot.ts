import type { Player } from '../types/index.js';

export const buildCloudPlayerSnapshot = (player: Player, lastSeenAt: number) => ({
    ...player,
    // Firestore rejects undefined; explicit null also clears old values under merge:true.
    deferredEventChainSteps: player.deferredEventChainSteps ?? null,
    adventureRelicBonuses: player.adventureRelicBonuses ?? null,
    stats: { ...player.stats, lastSeenAt },
});
