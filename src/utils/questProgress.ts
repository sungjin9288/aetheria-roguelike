import { QUESTS } from '../data/quests.js';
import { countLowHpWins } from '../systems/DifficultyManager.js';

const findQuestDefinition = (quest, questCatalog = QUESTS) => (
    quest?.isBounty ? quest : questCatalog.find((entry) => entry.id === quest.id)
);

export const syncQuestProgress = (player, enemyName = '', questCatalog = QUESTS) => {
    if (!player?.quests?.length) {
        return { updatedQuests: player?.quests || [], completedCount: 0 };
    }

    const normalizedEnemyName = enemyName || '';

    const updatedQuests = player.quests.map((quest) => {
        const questData = findQuestDefinition(quest, questCatalog);
        if (!questData) return quest;

        if (questData.type === 'explore_count' && questData.target === 'explores') {
            const current = player.stats?.explores || 0;
            return { ...quest, progress: Math.min(questData.goal, current) };
        }

        if (questData.type === 'craft' && questData.target === 'crafts') {
            const current = player.stats?.crafts || 0;
            return { ...quest, progress: Math.min(questData.goal, current) };
        }

        if (questData.type === 'survive_low_hp' && questData.target === 'lowHpWins') {
            const current = countLowHpWins(player.stats, questData.threshold || 0.2);
            return { ...quest, progress: Math.min(questData.goal, current) };
        }

        if (questData.type === 'bounty_count' && questData.target === 'bountiesCompleted') {
            const current = player.stats?.bountiesCompleted || 0;
            return { ...quest, progress: Math.min(questData.goal, current) };
        }

        if (questData.type === 'build_victory') {
            const current = player.stats?.buildWins?.[questData.target] || 0;
            return { ...quest, progress: Math.min(questData.goal, current) };
        }

        if (questData.type === 'discovery_count' && questData.target === 'discoveries') {
            const current = player.stats?.discoveries || 0;
            return { ...quest, progress: Math.min(questData.goal, current) };
        }

        if (questData.target === 'Level') {
            return { ...quest, progress: player.level };
        }

        const exactMatch = questData.target === normalizedEnemyName;
        const prefixedMatch = normalizedEnemyName.includes(questData.target);
        if (exactMatch || prefixedMatch) {
            return { ...quest, progress: Math.min(questData.goal, quest.progress + 1) };
        }

        return quest;
    });

    const completedCount = updatedQuests.filter((quest) => {
        const questData = findQuestDefinition(quest, questCatalog);
        return questData
            && quest.progress >= questData.goal
            && player.quests.find((activeQuest) => activeQuest.id === quest.id)?.progress < questData.goal;
    }).length;

    return { updatedQuests, completedCount };
};
