import { QUESTS } from '../data/quests.js';
import type { Player } from "../types/index.js";
import { countLowHpWins } from '../systems/DifficultyManager.js';
import { countDiscoveredSignatures } from './gameUtils.js';

const findQuestDefinition = (quest: any, questCatalog: any = QUESTS) => (
    quest?.isBounty ? quest : questCatalog.find((entry: any) => entry.id === quest.id)
);

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

        if (questData.type === 'explore_count' && questData.target === 'explores') {
            if (questData.location) {
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
            const current = player.stats?.explores || 0;
            return { ...quest, progress: latch(quest.progress, current, questData.goal) };
        }

        if (questData.type === 'craft' && questData.target === 'crafts') {
            const current = player.stats?.crafts || 0;
            return { ...quest, progress: latch(quest.progress, current, questData.goal) };
        }

        if (questData.type === 'survive_low_hp' && questData.target === 'lowHpWins') {
            const current = countLowHpWins(player.stats, questData.threshold || 0.2);
            return { ...quest, progress: latch(quest.progress, current, questData.goal) };
        }

        if (questData.type === 'bounty_count' && questData.target === 'bountiesCompleted') {
            const current = player.stats?.bountiesCompleted || 0;
            return { ...quest, progress: latch(quest.progress, current, questData.goal) };
        }

        if (questData.type === 'build_victory') {
            const current = player.stats?.buildWins?.[questData.target] || 0;
            return { ...quest, progress: latch(quest.progress, current, questData.goal) };
        }

        // cycle 83: 'discoveries' 타깃 시맨틱 통일 — visitedMaps.length(맵 발견 수)로
        // 통일. 기존엔 _shared.ts가 누적시키던 stats.discoveries(이벤트 발견 카운터)를
        // 잘못 읽어 quest 201("15곳 발견")이 이벤트 15회만으로 풀리던 회귀 수정.
        // achievement getAchievementCurrentValue('discoveries')가 이미 visitedMaps.length를
        // 읽고 있던 정합성 기준선에 맞춤.
        if (questData.type === 'discovery_count' && questData.target === 'discoveries') {
            const current = (player.stats?.visitedMaps || []).length;
            return { ...quest, progress: latch(quest.progress, current, questData.goal) };
        }

        // cycle 76: 도주 카운터 기반 퀘스트 — cycle 74에서 stats.escapes 도입.
        if (questData.type === 'escape_count' && questData.target === 'escapes') {
            const current = (player.stats as any)?.escapes || 0;
            return { ...quest, progress: latch(quest.progress, current, questData.goal) };
        }

        // cycle 75: codex 합집합 근사 → SIGNATURE_REGISTRY 교집합 정확 카운트로 교체.
        // 기존 근사는 일반 weapon/armor/shield까지 포함되어 진행도가 부풀려졌음.
        if (questData.type === 'signature_collect' && questData.target === 'signaturesDiscovered') {
            return { ...quest, progress: latch(quest.progress, countDiscoveredSignatures(player), questData.goal) };
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
