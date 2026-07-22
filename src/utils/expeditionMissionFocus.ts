import { MAPS } from '../data/maps.js';
import { QUESTS } from '../data/quests.js';
import type { Player } from '../types/player.js';

export const MAX_EXPEDITION_FOCUS_QUESTS = 3;

const toArray = (value: unknown) => (Array.isArray(value) ? value : []);
const sameQuestId = (left: string | number, right: string | number) => String(left) === String(right);
const isStoryQuest = (quest: any) => String(quest?.title || '').includes('[스토리]');

export const getExpeditionQuestTargetMaps = (quest: any, maps: Record<string, any> = MAPS) => {
    if (quest?.location && maps[quest.location]) return [quest.location];
    if (!quest?.target || quest.target === 'Level') return [];

    return Object.entries(maps)
        .filter(([, map]: any) => [
            ...toArray(map?.monsters),
            ...toArray(map?.bossMonsters),
            ...(map?.boss ? [map.boss] : []),
        ].includes(quest.target))
        .map(([name]) => name);
};

export const getExpeditionQuestEntries = (
    player: Player,
    questCatalog: any[] = QUESTS,
    maps: Record<string, any> = MAPS,
) => toArray(player.quests).flatMap((questState: any, index: number) => {
    const quest = questState?.isBounty
        ? questState
        : questCatalog.find((entry: any) => sameQuestId(entry.id, questState?.id));
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

const rankEntries = (entries: any[], destination?: string | null) => [...entries].sort((left, right) => {
    const compare = (selector: (entry: any) => number) => selector(right) - selector(left);
    return compare((entry) => Number(entry.isComplete))
        || compare((entry) => Number(isStoryQuest(entry.quest)))
        || compare((entry) => Number(Boolean(destination && entry.targetMaps.includes(destination))))
        || compare((entry) => entry.progress / Math.max(1, entry.goal))
        || left.index - right.index;
});

const validUniqueIds = (value: unknown, entries: any[]) => {
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
    questCatalog: any[] = QUESTS,
    maps: Record<string, any> = MAPS,
) => rankEntries(getExpeditionQuestEntries(player, questCatalog, maps), destination)
    .slice(0, MAX_EXPEDITION_FOCUS_QUESTS)
    .map((entry) => entry.id);

export const getPreparedExpeditionFocusQuestIds = (
    player: Player,
    destination?: string | null,
    questCatalog: any[] = QUESTS,
    maps: Record<string, any> = MAPS,
) => {
    const entries = getExpeditionQuestEntries(player, questCatalog, maps);
    const selected = validUniqueIds(player.expeditionFocusQuestIds, entries);
    return selected.length > 0
        ? selected
        : rankEntries(entries, destination).slice(0, MAX_EXPEDITION_FOCUS_QUESTS).map((entry) => entry.id);
};

export const getActiveExpeditionFocusQuestIds = (player: Pick<Player, 'activeExpedition'> | { activeExpedition?: any }) => {
    const active = player.activeExpedition;
    if (!active) return null;
    const checkpoints = toArray(active.quests);
    const validIds = checkpoints.map((quest: any) => quest.id);
    const selected = validUniqueIds(active.focusQuestIds, checkpoints.map((quest: any, index: number) => ({
        id: quest.id,
        index,
    })));
    if (Array.isArray(active.focusQuestIds) && selected.length > 0) return selected;

    return [...checkpoints]
        .map((quest: any, index: number) => ({ ...quest, index }))
        .sort((left: any, right: any) => (
            Number((right.progress || 0) >= (right.goal || 1)) - Number((left.progress || 0) >= (left.goal || 1))
            || Number(isStoryQuest(right)) - Number(isStoryQuest(left))
            || ((right.progress || 0) / Math.max(1, right.goal || 1)) - ((left.progress || 0) / Math.max(1, left.goal || 1))
            || left.index - right.index
        ))
        .slice(0, MAX_EXPEDITION_FOCUS_QUESTS)
        .map((quest: any) => validIds.find((id) => sameQuestId(id, quest.id)))
        .filter((id): id is string | number => id !== undefined);
};

export const getFocusedExpeditionQuestEntries = (
    player: Player,
    questCatalog: any[] = QUESTS,
    maps: Record<string, any> = MAPS,
) => {
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

export const replaceExpeditionFocusQuestIds = (player: Player, requestedIds: unknown): Player => {
    if (!Array.isArray(requestedIds) || requestedIds.length === 0 || requestedIds.length > MAX_EXPEDITION_FOCUS_QUESTS) {
        return player;
    }
    if (player.activeExpedition) return player;

    const entries = getExpeditionQuestEntries(player);
    const normalized = validUniqueIds(requestedIds, entries);
    if (normalized.length !== requestedIds.length) return player;
    return { ...player, expeditionFocusQuestIds: normalized };
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
