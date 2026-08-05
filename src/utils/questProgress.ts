import { QUESTS } from '../data/quests.js';
import type { Player } from "../types/index.js";
import { getCumulativeQuestProgress } from './cumulativeQuestProgress.js';

const findQuestDefinition = (quest: any, questCatalog: any = QUESTS) => (
    quest?.isBounty ? quest : questCatalog.find((entry: any) => entry.id === quest.id)
);

export const createQuestProgressState = (quest: any, player: Player) => {
    const cumulativeProgress = getCumulativeQuestProgress(quest, player);
    const progressState: Record<string, any> = {
        id: quest.id,
        progress: cumulativeProgress === null
            ? (quest.target === 'Level' ? player.level : 0)
            : cumulativeProgress,
    };

    if (quest.type === 'explore_count' && quest.target === 'explores' && quest.location) {
        progressState.startExploreCount = player.stats?.exploresByLocation?.[quest.location] || 0;
    }

    return progressState;
};

// cycle 508: enemyName / questCatalog default 제거 — 1 callsite (CombatEngine
//   :1571) 항상 3 args 전달이라 default 도달 불가. util default 청소 메가
//   시리즈 7번째 (cycle 502-507).
export const syncQuestProgress = (player: Player, enemyName: any, questCatalog: any) => {
    if (!player?.quests?.length) {
        return { updatedQuests: player?.quests || [], completedCount: 0 };
    }

    const normalizedEnemyName = enemyName || '';

    // cycle 94: 진행도 latch — 한 번 올라간 progress는 내려가지 않음.
    // 기존엔 모든 카운터 분기가 Math.min(goal, current)만 했는데,
    // survive_low_hp가 stats.recentBattles(50개 윈도우)를 읽어 윈도우가 회전하면
    // 진행도가 회귀해 청구 못 하던 회귀 위험이 있었음. 모든 stat-based 분기에
    // Math.max(quest.progress, computed)을 씌워 단조성 보장.
    // 단조 카운터(explores/crafts/bounties/escapes/discoveries/signatures 등)에는
    // 무해(증가하는 값에 대해 max(prev, current) === current).
    const latch = (prev: any, current: any, goal: any) => Math.max(prev || 0, Math.min(goal, current));

    const updatedQuests = player.quests.map((quest: any) => {
        const questData = findQuestDefinition(quest, questCatalog);
        if (!questData) return quest;

        if (questData.type === 'explore_count' && questData.target === 'explores' && questData.location) {
            const locationCount = player.stats?.exploresByLocation?.[questData.location] || 0;
            const previousProgress = quest.progress || 0;
            const startExploreCount = Number.isFinite(quest.startExploreCount)
                ? quest.startExploreCount
                : locationCount - previousProgress;
            const current = Math.max(0, locationCount - startExploreCount);
            return {
                ...quest,
                startExploreCount,
                progress: latch(previousProgress, current, questData.goal),
            };
        }

        const cumulativeProgress = getCumulativeQuestProgress(questData, player);
        if (cumulativeProgress !== null) {
            return { ...quest, progress: latch(quest.progress, cumulativeProgress, questData.goal) };
        }

        if (questData.target === 'Level') {
            return { ...quest, progress: Math.max(quest.progress || 0, player.level || 0) };
        }

        const exactMatch = questData.target === normalizedEnemyName;
        const prefixedMatch = normalizedEnemyName.includes(questData.target);
        const isTargetLocation = !questData.location || player.loc === questData.location;
        if (isTargetLocation && (exactMatch || prefixedMatch)) {
            return { ...quest, progress: Math.min(questData.goal, quest.progress + 1) };
        }

        return quest;
    });

    const completedCount = updatedQuests.filter((quest: any) => {
        const questData = findQuestDefinition(quest, questCatalog);
        return questData
            && quest.progress >= questData.goal
            && (player.quests || []).find((activeQuest: any) => activeQuest.id === quest.id)?.progress < questData.goal;
    }).length;

    return { updatedQuests, completedCount };
};
