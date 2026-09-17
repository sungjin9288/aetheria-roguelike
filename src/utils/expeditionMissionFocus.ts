import { MAPS } from '../data/maps.js';
import { QUESTS } from '../data/quests.js';
import type { ExpeditionQuestCheckpoint, Player, QuestProgressState } from '../types/player.js';
import type { GameMap } from '../types/map.js';
import type { Quest, QuestType } from '../types/quest.js';

export const MAX_EXPEDITION_FOCUS_QUESTS = 3;

const toArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const sameQuestId = (left: string | number | undefined, right: string | number | undefined) => (
    String(left) === String(right)
);

/**
 * 퀘스트 정의의 focus 계산에 필요한 부분집합 — 카탈로그 `Quest`와 현상수배
 * `QuestProgressState`(isBounty: true) 양쪽 모두 구조적으로 호환된다.
 */
export interface ExpeditionQuestDefinition {
    title?: string;
    target?: string;
    goal?: number;
    location?: string;
    type?: QuestType;
    buildLabel?: string;
}

const isStoryQuest = (quest: ExpeditionQuestDefinition | undefined) => String(quest?.title || '').includes('[스토리]');

export const getExpeditionQuestTargetMaps = (
    quest: ExpeditionQuestDefinition | undefined,
    maps: Record<string, GameMap> = MAPS,
): string[] => {
    if (quest?.location && maps[quest.location]) return [quest.location];
    if (!quest?.target || quest.target === 'level') return [];
    const target = quest.target;

    return Object.entries(maps)
        .filter(([, map]) => [
            ...toArray<string>(map?.monsters),
            ...toArray<string>(map?.bossMonsters),
            ...(map?.boss ? [map.boss] : []),
        ].includes(target))
        .map(([name]) => name);
};

/** `getExpeditionQuestEntries`가 만드는 진행 중 임무 1건 — focus 편성/추적 UI 공용. */
export interface ExpeditionQuestEntry {
    id: string | number;
    quest: ExpeditionQuestDefinition;
    progress: number;
    goal: number;
    index: number;
    isBounty: boolean;
    isComplete: boolean;
    targetMaps: string[];
}

export const getExpeditionQuestEntries = (
    player: Player,
    questCatalog: Quest[] = QUESTS,
    maps: Record<string, GameMap> = MAPS,
): ExpeditionQuestEntry[] => toArray<QuestProgressState>(player.quests).flatMap((questState, index): ExpeditionQuestEntry[] => {
    const quest: ExpeditionQuestDefinition | undefined = questState?.isBounty
        ? questState
        : questCatalog.find((entry) => sameQuestId(entry.id, questState?.id));
    if (!quest) return [];

    const progress = Math.max(0, Number(questState.progress) || 0);
    const goal = Math.max(1, Number(quest.goal) || 1);
    return [{
        id: questState.id,
        quest,
        progress,
        goal,
        index,
        isBounty: Boolean(questState?.isBounty),
        isComplete: progress >= goal,
        targetMaps: getExpeditionQuestTargetMaps(quest, maps),
    }];
});

const rankEntries = (entries: ExpeditionQuestEntry[], destination?: string | null) => [...entries].sort((left, right) => {
    const compare = (selector: (entry: ExpeditionQuestEntry) => number) => selector(right) - selector(left);
    return compare((entry) => Number(entry.isComplete))
        || compare((entry) => Number(isStoryQuest(entry.quest)))
        || compare((entry) => Number(Boolean(destination && entry.targetMaps.includes(destination))))
        || compare((entry) => entry.progress / Math.max(1, entry.goal))
        || left.index - right.index;
});

const validUniqueIds = (value: unknown, entries: Array<{ id: string | number }>) => {
    if (!Array.isArray(value)) return [];
    const validIds = entries.map((entry) => entry.id);
    return value.reduce<Array<string | number>>((ids, candidate) => {
        const matchingId = validIds.find((id) => sameQuestId(id, candidate));
        if (matchingId === undefined || ids.some((id) => sameQuestId(id, matchingId))) return ids;
        return [...ids, matchingId];
    }, []).slice(0, MAX_EXPEDITION_FOCUS_QUESTS);
};

export const getDefaultExpeditionFocusQuestIds = (
    player: Player,
    destination?: string | null,
    questCatalog: Quest[] = QUESTS,
    maps: Record<string, GameMap> = MAPS,
) => rankEntries(getExpeditionQuestEntries(player, questCatalog, maps), destination)
    .slice(0, MAX_EXPEDITION_FOCUS_QUESTS)
    .map((entry) => entry.id);

export const getPreparedExpeditionFocusQuestIds = (
    player: Player,
    destination?: string | null,
    questCatalog: Quest[] = QUESTS,
    maps: Record<string, GameMap> = MAPS,
) => {
    const entries = getExpeditionQuestEntries(player, questCatalog, maps);
    const selected = validUniqueIds(player.expeditionFocusQuestIds, entries);
    return selected.length > 0
        ? selected
        : rankEntries(entries, destination).slice(0, MAX_EXPEDITION_FOCUS_QUESTS).map((entry) => entry.id);
};

/** `getActiveExpeditionFocusQuestIds`가 읽는 최소 형태 — `Player`와 `normalizeActiveExpedition`이
 *  조립하는 임시 객체(`expeditionLedger.ts`) 양쪽에서 온다. */
interface ActiveExpeditionFocusSource {
    quests?: unknown;
    focusQuestIds?: unknown;
}

export const getActiveExpeditionFocusQuestIds = (
    player: { activeExpedition?: ActiveExpeditionFocusSource | null },
) => {
    const active = player.activeExpedition;
    if (!active) return null;
    const checkpoints = toArray<ExpeditionQuestCheckpoint>(active.quests);
    const validIds = checkpoints.map((quest) => quest.id);
    const selected = validUniqueIds(active.focusQuestIds, checkpoints.map((quest, index) => ({
        id: quest.id,
        index,
    })));
    if (Array.isArray(active.focusQuestIds) && selected.length > 0) return selected;

    return [...checkpoints]
        .map((quest, index) => ({ ...quest, index }))
        .sort((left, right) => (
            Number((right.progress || 0) >= (right.goal || 1)) - Number((left.progress || 0) >= (left.goal || 1))
            || Number(isStoryQuest(right)) - Number(isStoryQuest(left))
            || ((right.progress || 0) / Math.max(1, right.goal || 1)) - ((left.progress || 0) / Math.max(1, left.goal || 1))
            || left.index - right.index
        ))
        .slice(0, MAX_EXPEDITION_FOCUS_QUESTS)
        .map((quest) => validIds.find((id) => sameQuestId(id, quest.id)))
        .filter((id): id is string | number => id !== undefined);
};

export const getFocusedExpeditionQuestEntries = (
    player: Player,
    questCatalog: Quest[] = QUESTS,
    maps: Record<string, GameMap> = MAPS,
): ExpeditionQuestEntry[] => {
    const entries = getExpeditionQuestEntries(player, questCatalog, maps);
    const selectedIds = getActiveExpeditionFocusQuestIds(player)
        ?? getPreparedExpeditionFocusQuestIds(player, null, questCatalog, maps);
    return selectedIds.flatMap((id) => {
        const entry = entries.find((candidate) => sameQuestId(candidate.id, id));
        return entry ? [entry] : [];
    });
};

export const getExpeditionFocusRouteTargets = (player: Player) => {
    const targets = getFocusedExpeditionQuestEntries(player).flatMap((entry) => entry.targetMaps);
    return [...new Set(targets)];
};

export const appendExpeditionFocusQuest = (player: Player, questId: string | number): Player => {
    const selected = getPreparedExpeditionFocusQuestIds(player);
    if (selected.some((id) => sameQuestId(id, questId)) || selected.length >= MAX_EXPEDITION_FOCUS_QUESTS) {
        return { ...player, expeditionFocusQuestIds: selected };
    }
    return { ...player, expeditionFocusQuestIds: [...selected, questId] };
};

export const removeExpeditionFocusQuest = (player: Player, questId: string | number): Player => {
    if (!Array.isArray(player.expeditionFocusQuestIds)) return player;
    return {
        ...player,
        expeditionFocusQuestIds: player.expeditionFocusQuestIds.filter((id) => !sameQuestId(id, questId)),
    };
};
