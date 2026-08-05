import type { Player } from '../types/player.js';

export const getCombatQuestProgress = (quest: any, player: Player): number | null => {
    if (quest?.type !== 'combat_count') return null;

    const count = quest.target === 'kills'
        ? player.stats?.kills
        : quest.target === 'bossKills'
            ? player.stats?.bossKills
            : null;

    if (count === null) return null;

    const goal = Math.max(0, Number(quest.goal) || 0);
    return Math.min(goal, Math.max(0, Number(count) || 0));
};
