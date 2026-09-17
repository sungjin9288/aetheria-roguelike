import type { Player } from '../types/index.js';
import { calculateFullStats } from './statsCalculator.js';

export const activateDevourBonus = (player: Player): Player => {
    const devour = player.adventureRelicBonuses?.devour;
    if (devour?.phase !== 'ready') return player;
    return {
        ...player,
        maxHp: (player.maxHp || 0) + devour.amount,
        hp: (player.hp || 0) + devour.amount,
        adventureRelicBonuses: {
            ...player.adventureRelicBonuses,
            devour: { ...devour, phase: 'active' },
        },
    };
};

export const endDevourBonus = (player: Player): Player => {
    const bonuses = player.adventureRelicBonuses;
    if (bonuses?.devour?.phase !== 'active') return player;
    const next: Player = {
        ...player,
        // Only this implementation's recorded grant is removable, never legacy HP.
        maxHp: Math.max(1, (player.maxHp || 0) - bonuses.devour.amount),
        adventureRelicBonuses: bonuses.killStackAtk
            ? { killStackAtk: bonuses.killStackAtk }
            : undefined,
    };
    next.hp = Math.min(player.hp || 0, calculateFullStats(next)!.maxHp);
    return next;
};

export const clearAdventureRelicBonuses = (player: Player): Player => {
    if (!player.adventureRelicBonuses) return player;
    return { ...endDevourBonus(player), adventureRelicBonuses: undefined };
};
