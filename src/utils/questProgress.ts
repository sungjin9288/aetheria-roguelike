import { QUESTS } from '../data/quests.js';
import type { Player, Quest, QuestProgressState } from "../types/index.js";
import { getCumulativeQuestProgress } from './cumulativeQuestProgress.js';

// isBounty가 참이면 quest(QuestProgressState) 자신을 정의로 되돌린다 — 현상수배는
// title/desc/target/goal/reward를 진행 상태와 함께 들고 있고, 그 필드들은 전부
// Quest의 동일 이름 옵셔널 필드와 타입이 일치한다(Quest 쪽 필드 전부 optional이라
// QuestProgressState가 구조적으로 Quest에 대입 가능 — as unknown 없이 캐스트).
const findQuestDefinition = (quest: QuestProgressState, questCatalog: Quest[] = QUESTS): Quest | undefined => (
    quest?.isBounty ? (quest as Quest) : questCatalog.find((entry) => entry.id === quest.id)
);

export const createQuestProgressState = (quest: Quest, player: Player): QuestProgressState => {
    const cumulativeProgress = getCumulativeQuestProgress(quest, player);
    const progressState: QuestProgressState = {
        // `?? ''` — Quest.id는 카탈로그 정의상 optional이지만 실제 호출부(questHandlers/
        //   characterActions)는 이미 `quest.id !== undefined` 확인 후에만 이 함수를 부른다.
        id: quest.id ?? '',
        // `?? 0` — Player.level은 타입상 optional이라 progress(number) 계약을 맞춘다.
        //   소비자가 모두 `progress || 0`으로 읽어 왔으므로 동작은 동일하다.
        progress: cumulativeProgress === null
            ? (quest.target === 'level' ? (player.level ?? 0) : 0)
            : cumulativeProgress,
    };

    if (quest.type === 'explore_count' && quest.target === 'explores' && quest.location) {
        progressState.startExploreCount = player.stats?.exploresByLocation?.[quest.location] || 0;
    }

    return progressState;
};

/**
 * Return active quests whose authoritative reward can be claimed now.
 *
 * Regular quest labels/rewards/goals come from the canonical QUESTS registry rather than the
 * serialized active-quest copy. Bounties are generated at runtime, so their
 * active entry remains the source of truth for the existing claim action.
 */
export const getClaimableQuestEntries = (player: Player) => {
    const claimedQuestIds = new Set(
        Array.isArray(player?.stats?.claimedQuestIds)
            ? player.stats.claimedQuestIds.map((id) => String(id))
            : [],
    );

    return (Array.isArray(player?.quests) ? player.quests : []).flatMap((questState) => {
        const isBounty = questState?.isBounty === true;
        const quest = isBounty
            ? questState
            : QUESTS.find((entry) => entry.id === questState?.id);
        if (!quest) return [];
        if (!isBounty && claimedQuestIds.has(String(quest.id))) return [];

        const progress = Number(questState?.progress);
        const goal = Number(quest?.goal);
        if (!Number.isFinite(progress) || !Number.isFinite(goal) || progress < goal) return [];

        return [{
            id: questState.id,
            quest,
            progress,
            isBounty,
        }];
    });
};

// cycle 508: enemyName / questCatalog default 제거 — 1 callsite (CombatEngine
//   :1571) 항상 3 args 전달이라 default 도달 불가. util default 청소 메가
//   시리즈 7번째 (cycle 502-507).
export const syncQuestProgress = (player: Player, enemyName: string | undefined, questCatalog: Quest[]) => {
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
    // goal은 Quest.goal(optional)이라 number | undefined — Number()는 순수 타입
    // 캐스트다: 기존에도 Math.min(undefined, x)는 ToNumber(undefined)=NaN 경로였다.
    const latch = (prev: number | undefined, current: number, goal: number | undefined) => Math.max(prev || 0, Math.min(Number(goal), current));

    const updatedQuests = player.quests.map((quest) => {
        const questData = findQuestDefinition(quest, questCatalog);
        if (!questData) return quest;

        if (questData.type === 'explore_count' && questData.target === 'explores' && questData.location) {
            const locationCount = player.stats?.exploresByLocation?.[questData.location] || 0;
            const previousProgress = quest.progress || 0;
            // Number.isFinite는 타입 서술(type predicate)이 아니라 quest.startExploreCount
            // (number | undefined)가 true 분기에서 자동으로 좁혀지지 않는다 — 이미 검사를
            // 통과했다는 사실만 as number로 명시.
            const startExploreCount = Number.isFinite(quest.startExploreCount)
                ? (quest.startExploreCount as number)
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

        if (questData.target === 'level') {
            return { ...quest, progress: Math.max(quest.progress || 0, player.level || 0) };
        }

        const exactMatch = questData.target === normalizedEnemyName;
        // String() — questData.target은 Quest.target(optional)이라 string | undefined.
        //   기존에도 String.prototype.includes(undefined)는 ToString(undefined)="undefined"
        //   경로였다(target 없는 정의는 이 몬스터 이름과 절대 일치하지 않는 문자열이 되어
        //   사실상 false로 동작) — target||''(항상 true가 되어 버림)로 바꾸면 안 된다.
        const prefixedMatch = normalizedEnemyName.includes(String(questData.target));
        const isTargetLocation = !questData.location || player.loc === questData.location;
        if (isTargetLocation && (exactMatch || prefixedMatch)) {
            return { ...quest, progress: Math.min(Number(questData.goal), quest.progress + 1) };
        }

        return quest;
    });

    const completedCount = updatedQuests.filter((quest) => {
        const questData = findQuestDefinition(quest, questCatalog);
        // 직전 진행도 — 엔트리를 못 찾으면(도달 불가) 종전 `undefined < goal === false`와
        //   동일하게 "이번에 완료된 것이 아님"으로 센다.
        const priorProgress = (player.quests || [])
            .find((activeQuest) => activeQuest.id === quest.id)?.progress;
        return questData
            && quest.progress >= Number(questData.goal)
            && priorProgress !== undefined
            && priorProgress < Number(questData.goal);
    }).length;

    return { updatedQuests, completedCount };
};
