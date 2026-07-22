import { BALANCE, CONSTANTS } from '../data/constants.js';
import type {
    ExpeditionInventoryCheckpoint,
    ExpeditionQuestCheckpoint,
    ExpeditionSnapshot,
    ExpeditionSummary,
    Player,
} from '../types/player.js';
import { getActiveExpeditionFocusQuestIds, getPreparedExpeditionFocusQuestIds } from './expeditionMissionFocus.js';
import { queueMilestoneStoryBeat } from './milestoneStory.js';

const numberOr = (value: unknown, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

const nonNegative = (value: unknown, fallback = 0) => Math.max(0, numberOr(value, fallback));

const inventoryCheckpoint = (item: any): ExpeditionInventoryCheckpoint => {
    const name = typeof item?.name === 'string' && item.name.trim() ? item.name : '이름 없는 아이템';
    const fallbackKey = [name, item?.type || '', item?.prefixName || '', item?.enhance || 0].join('|');
    return {
        key: item?.id ? `id:${item.id}` : `item:${fallbackKey}`,
        name,
    };
};

const getQuestDefinition = (quest: any, questCatalog: any[]) => (
    quest?.isBounty ? quest : questCatalog.find((entry: any) => entry.id === quest?.id)
);

const questCheckpoints = (player: Player, questCatalog: any[]): ExpeditionQuestCheckpoint[] => (
    Array.isArray(player.quests) ? player.quests : []
).flatMap((quest: any) => {
    const definition = getQuestDefinition(quest, questCatalog);
    if (!definition) return [];
    return [{
        id: quest.id,
        title: String(definition.title || '이름 없는 임무'),
        progress: nonNegative(quest.progress),
        goal: Math.max(1, nonNegative(definition.goal, 1)),
    }];
});

const nextExpRequirement = (requirement: number) => Math.min(
    Math.floor(requirement * BALANCE.EXP_SCALE_RATE),
    BALANCE.EXP_LEVEL_HARD_CAP,
);

export const calculateExpeditionExpGain = (snapshot: ExpeditionSnapshot, player: Player) => {
    const endLevel = nonNegative(player.level, snapshot.startLevel);
    const endExp = nonNegative(player.exp);
    if (endLevel < snapshot.startLevel) return 0;
    if (endLevel === snapshot.startLevel) return Math.max(0, endExp - snapshot.startExp);

    let gained = Math.max(0, snapshot.startNextExp - snapshot.startExp);
    let requirement = snapshot.startNextExp;
    for (let level = snapshot.startLevel + 1; level < endLevel; level += 1) {
        requirement = nextExpRequirement(requirement);
        gained += requirement;
    }
    return Math.max(0, gained + endExp);
};

const itemDelta = (before: ExpeditionInventoryCheckpoint[], currentInventory: any[]) => {
    const remaining = new Map<string, number>();
    before.forEach((item) => remaining.set(item.key, (remaining.get(item.key) || 0) + 1));

    const newItems: string[] = [];
    currentInventory.map(inventoryCheckpoint).forEach((item) => {
        const count = remaining.get(item.key) || 0;
        if (count > 0) {
            remaining.set(item.key, count - 1);
        } else {
            newItems.push(item.name);
        }
    });

    return {
        newItems,
        lostItemCount: [...remaining.values()].reduce((sum, count) => sum + count, 0),
    };
};

const completedQuestTitles = (snapshot: ExpeditionSnapshot, player: Player, questCatalog: any[]) => {
    const current = new Map((Array.isArray(player.quests) ? player.quests : []).map((quest: any) => [String(quest.id), quest]));
    const claimed = new Set((Array.isArray(player.stats?.claimedQuestIds) ? player.stats.claimedQuestIds : []).map(String));

    return snapshot.quests.flatMap((checkpoint) => {
        if (checkpoint.progress >= checkpoint.goal) return [];
        const activeQuest: any = current.get(String(checkpoint.id));
        const definition = activeQuest ? getQuestDefinition(activeQuest, questCatalog) : null;
        const goal = Math.max(1, nonNegative(definition?.goal, checkpoint.goal));
        const isComplete = claimed.has(String(checkpoint.id)) || nonNegative(activeQuest?.progress) >= goal;
        return isComplete ? [checkpoint.title] : [];
    });
};

export const normalizeActiveExpedition = (value: unknown): ExpeditionSnapshot | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as Record<string, any>;
    if (typeof candidate.id !== 'string' || !candidate.id) return null;
    if (typeof candidate.origin !== 'string' || typeof candidate.destination !== 'string') return null;
    if (!Number.isFinite(Number(candidate.startedAt))) return null;

    const normalized = {
        id: candidate.id,
        startedAt: nonNegative(candidate.startedAt),
        origin: candidate.origin,
        destination: candidate.destination,
        startLevel: Math.max(1, nonNegative(candidate.startLevel, 1)),
        startExp: nonNegative(candidate.startExp),
        startNextExp: Math.max(1, nonNegative(candidate.startNextExp, CONSTANTS.START_NEXT_EXP)),
        startGold: nonNegative(candidate.startGold),
        startHp: nonNegative(candidate.startHp),
        maxHpAtStart: Math.max(1, nonNegative(candidate.maxHpAtStart, 1)),
        lowestHp: nonNegative(candidate.lowestHp, candidate.startHp),
        kills: nonNegative(candidate.kills),
        bossKills: nonNegative(candidate.bossKills),
        explores: nonNegative(candidate.explores),
        inventory: (Array.isArray(candidate.inventory) ? candidate.inventory : []).flatMap((item: any) => (
            typeof item?.key === 'string' && typeof item?.name === 'string'
                ? [{ key: item.key, name: item.name }]
                : []
        )),
        quests: (Array.isArray(candidate.quests) ? candidate.quests : []).flatMap((quest: any) => (
            (typeof quest?.id === 'string' || typeof quest?.id === 'number')
                ? [{
                    id: quest.id,
                    title: typeof quest.title === 'string' ? quest.title : '이름 없는 임무',
                    progress: nonNegative(quest.progress),
                    goal: Math.max(1, nonNegative(quest.goal, 1)),
                }]
                : []
        )),
    };
    return {
        ...normalized,
        focusQuestIds: getActiveExpeditionFocusQuestIds({
            activeExpedition: { ...normalized, focusQuestIds: candidate.focusQuestIds },
        }) || [],
    };
};

export const normalizeExpeditionSummary = (value: unknown): ExpeditionSummary | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = value as Record<string, any>;
    if (typeof candidate.id !== 'string' || !candidate.id) return null;
    if (typeof candidate.destination !== 'string' || typeof candidate.returnLocation !== 'string') return null;
    if (!Number.isFinite(Number(candidate.startedAt)) || !Number.isFinite(Number(candidate.endedAt))) return null;

    return {
        id: candidate.id,
        startedAt: nonNegative(candidate.startedAt),
        endedAt: nonNegative(candidate.endedAt),
        origin: typeof candidate.origin === 'string' ? candidate.origin : '',
        destination: candidate.destination,
        lastLocation: typeof candidate.lastLocation === 'string' ? candidate.lastLocation : candidate.destination,
        returnLocation: candidate.returnLocation,
        returnReason: 'safe_return',
        durationMs: nonNegative(candidate.durationMs),
        startLevel: Math.max(1, nonNegative(candidate.startLevel, 1)),
        endLevel: Math.max(1, nonNegative(candidate.endLevel, 1)),
        expGained: nonNegative(candidate.expGained),
        goldDelta: numberOr(candidate.goldDelta),
        battles: nonNegative(candidate.battles),
        bossBattles: nonNegative(candidate.bossBattles),
        explores: nonNegative(candidate.explores),
        newItems: (Array.isArray(candidate.newItems) ? candidate.newItems : []).filter((name: any) => typeof name === 'string'),
        lostItemCount: nonNegative(candidate.lostItemCount),
        completedQuests: (Array.isArray(candidate.completedQuests) ? candidate.completedQuests : []).filter((title: any) => typeof title === 'string'),
        lowestHp: nonNegative(candidate.lowestHp),
        lowestHpPercent: Math.min(100, nonNegative(candidate.lowestHpPercent)),
        returnHp: nonNegative(candidate.returnHp),
        maxHpAtReturn: Math.max(1, nonNegative(candidate.maxHpAtReturn, 1)),
        reviewedAt: candidate.reviewedAt !== null
            && candidate.reviewedAt !== undefined
            && Number.isFinite(Number(candidate.reviewedAt))
            ? Number(candidate.reviewedAt)
            : null,
    };
};

export const startExpedition = (player: Player, destination: string, now: number, questCatalog: any[]) => {
    if (normalizeActiveExpedition(player.activeExpedition)) return player;
    const hp = nonNegative(player.hp);
    const snapshot: ExpeditionSnapshot = {
        id: `expedition-${Math.max(0, Math.floor(now))}`,
        startedAt: Math.max(0, Math.floor(now)),
        origin: player.loc || '',
        destination,
        startLevel: Math.max(1, nonNegative(player.level, 1)),
        startExp: nonNegative(player.exp),
        startNextExp: Math.max(1, nonNegative(player.nextExp, CONSTANTS.START_NEXT_EXP)),
        startGold: nonNegative(player.gold),
        startHp: hp,
        maxHpAtStart: Math.max(1, nonNegative(player.maxHp, 1)),
        lowestHp: hp,
        kills: nonNegative(player.stats?.kills),
        bossKills: nonNegative(player.stats?.bossKills),
        explores: nonNegative(player.stats?.explores),
        inventory: (Array.isArray(player.inv) ? player.inv : []).map(inventoryCheckpoint),
        quests: questCheckpoints(player, questCatalog),
        focusQuestIds: getPreparedExpeditionFocusQuestIds(player, destination, questCatalog),
    };
    return { ...player, activeExpedition: snapshot };
};

export const finishExpedition = (player: Player, returnLocation: string, now: number, questCatalog: any[]) => {
    const snapshot = normalizeActiveExpedition(player.activeExpedition);
    if (!snapshot) return { player: { ...player, activeExpedition: null }, summary: null };

    const endedAt = Math.max(snapshot.startedAt, Math.floor(now));
    const { newItems, lostItemCount } = itemDelta(snapshot.inventory, Array.isArray(player.inv) ? player.inv : []);
    const lowestHp = Math.min(snapshot.lowestHp, nonNegative(player.hp, snapshot.lowestHp));
    const summary: ExpeditionSummary = {
        id: snapshot.id,
        startedAt: snapshot.startedAt,
        endedAt,
        origin: snapshot.origin,
        destination: snapshot.destination,
        lastLocation: player.loc || snapshot.destination,
        returnLocation,
        returnReason: 'safe_return',
        durationMs: endedAt - snapshot.startedAt,
        startLevel: snapshot.startLevel,
        endLevel: Math.max(1, nonNegative(player.level, snapshot.startLevel)),
        expGained: calculateExpeditionExpGain(snapshot, player),
        goldDelta: numberOr(player.gold) - snapshot.startGold,
        battles: Math.max(0, nonNegative(player.stats?.kills) - snapshot.kills),
        bossBattles: Math.max(0, nonNegative(player.stats?.bossKills) - snapshot.bossKills),
        explores: Math.max(0, nonNegative(player.stats?.explores) - snapshot.explores),
        newItems,
        lostItemCount,
        completedQuests: completedQuestTitles(snapshot, player, questCatalog),
        lowestHp,
        lowestHpPercent: Math.max(0, Math.min(100, Math.round((lowestHp / snapshot.maxHpAtStart) * 100))),
        returnHp: nonNegative(player.hp),
        maxHpAtReturn: Math.max(1, nonNegative(player.maxHp, snapshot.maxHpAtStart)),
        reviewedAt: null,
    };

    const returnedPlayer = queueMilestoneStoryBeat({
        ...player,
        activeExpedition: null,
        lastExpeditionSummary: summary,
    }, 'first_safe_return');

    return {
        player: returnedPlayer,
        summary,
    };
};

export const trackExpeditionVitals = (player: Player): Player => {
    const snapshot = normalizeActiveExpedition(player.activeExpedition);
    if (!snapshot || !Number.isFinite(Number(player.hp))) return player;
    const lowestHp = Math.min(snapshot.lowestHp, Math.max(0, Number(player.hp)));
    if (lowestHp === snapshot.lowestHp) return player;
    return { ...player, activeExpedition: { ...snapshot, lowestHp } };
};
