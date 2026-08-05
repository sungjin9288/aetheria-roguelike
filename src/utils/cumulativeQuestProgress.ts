import type { Player } from '../types/player.js';
import { countLowHpWins } from '../systems/DifficultyManager.js';
import { countDiscoveredSignatures } from './signatureDiscovery.js';

const capProgress = (quest: any, current: unknown) => {
    const goal = Math.max(0, Number(quest.goal) || 0);
    return Math.min(goal, Math.max(0, Number(current) || 0));
};

export const getCumulativeQuestProgress = (quest: any, player: Player): number | null => {
    const stats = player.stats || {};
    let current: unknown = null;

    if (quest?.type === 'combat_count' && quest.target === 'kills') current = stats.kills;
    if (quest?.type === 'combat_count' && quest.target === 'bossKills') current = stats.bossKills;
    if (quest?.type === 'craft' && quest.target === 'crafts') current = stats.crafts;
    if (quest?.type === 'explore_count' && quest.target === 'explores' && !quest.location) current = stats.explores;
    if (quest?.type === 'survive_low_hp' && quest.target === 'lowHpWins') {
        current = countLowHpWins(stats, quest.threshold || 0.2);
    }
    if (quest?.type === 'bounty_count' && quest.target === 'bountiesCompleted') current = stats.bountiesCompleted;
    if (quest?.type === 'build_victory') current = stats.buildWins?.[quest.target];
    if (quest?.type === 'discovery_count' && quest.target === 'discoveries') current = stats.visitedMaps?.length;
    if (quest?.type === 'escape_count' && quest.target === 'escapes') current = stats.escapes;
    if (quest?.type === 'signature_collect' && quest.target === 'signaturesDiscovered') {
        current = countDiscoveredSignatures(player);
    }

    return current === null ? null : capProgress(quest, current);
};
