import type { Player } from '../types/index.js';

export const buildCloudPlayerSnapshot = (player: Player, lastSeenAt: number) => ({
    ...player,
    // Firestore rejects undefined, so cleared optional fields travel as explicit null.
    // The save write replaces the whole document (CH-01), so omitted keys never survive server-side.
    deferredEventChainSteps: player.deferredEventChainSteps ?? null,
    adventureRelicBonuses: player.adventureRelicBonuses ?? null,
    stats: { ...player.stats, lastSeenAt },
});
