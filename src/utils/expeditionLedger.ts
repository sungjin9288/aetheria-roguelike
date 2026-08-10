import { BALANCE, CONSTANTS } from '../data/constants.js';
import { CLASSES } from '../data/classes.js';
import {
    BASELINE_PROGRESSION_PROFILE,
    normalizeProgressionProfile,
    getActiveProgressionProfile,
    resolveProgressionProfile,
} from '../data/progressionProfiles.js';
import type {
    ExpeditionInventoryCheckpoint,
    ExpeditionQuestCheckpoint,
    ExpeditionSnapshot,
    ExpeditionSummary,
    Player,
} from '../types/player.js';
import type { ProgressionProfile, ProgressionProfileRef } from '../types/progression.js';
import { getActiveExpeditionFocusQuestIds, getPreparedExpeditionFocusQuestIds } from './expeditionMissionFocus.js';
import { recordClassJourneyExpedition } from './classJourney.js';
import { queueMilestoneStoryBeat } from './milestoneStory.js';
import { isSignatureName } from './signatureDiscovery.js';

const numberOr = (value: unknown, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

const nonNegative = (value: unknown, fallback = 0) => Math.max(0, numberOr(value, fallback));

const EQUIPMENT_SLOTS = ['weapon', 'armor', 'offhand'] as const;

const uniqueNames = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.flatMap((entry) => (
        typeof entry === 'string' && entry.trim() ? [entry.trim()] : []
    )))];
};

const equippedItems = (player: Player) => EQUIPMENT_SLOTS.flatMap((slot) => {
    const item = player.equip?.[slot];
    return item ? [item] : [];
});

const skillChoicesForJob = (value: unknown, job: string | undefined) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !job) return {};
    const branchSkills = CLASSES[job]?.skillBranches || {};
    return Object.fromEntries(Object.entries(value).flatMap(([skillName, choice]) => {
        const selectedChoice = typeof choice === 'string' ? choice.trim() : '';
        const choices = branchSkills[skillName];
        return Array.isArray(choices) && choices.some((branch: any) => branch.choice === selectedChoice)
            ? [[skillName, selectedChoice]]
            : [];
    }));
};

const equipmentNames = (player: Player) => equippedItems(player).flatMap((item) => (
    typeof item.name === 'string' && item.name.trim() ? [item.name.trim()] : []
));

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

const canonicalSignatureName = (item: any) => {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (isSignatureName(name)) return name;

    const prefix = typeof item?.prefixName === 'string' ? item.prefixName.trim() : '';
    if (item?.prefixed !== true || !prefix || !name.startsWith(`${prefix} `)) return null;
    const baseName = name.slice(prefix.length + 1).trim();
    return isSignatureName(baseName) ? baseName : null;
};

const ownedSignatureNames = (player: Player) => {
    const items = [
        ...(Array.isArray(player.inv) ? player.inv : []),
        ...equippedItems(player),
    ];
    return [...new Set(items.flatMap((item) => {
        const name = canonicalSignatureName(item);
        return name ? [name] : [];
    }))];
};

const signatureDelta = (snapshot: ExpeditionSnapshot, player: Player) => {
    const ownedBefore = new Set(snapshot.signatureItems || []);
    return ownedSignatureNames(player).filter((name) => !ownedBefore.has(name));
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

    const job = typeof candidate.job === 'string' && candidate.job.trim() ? candidate.job.trim() : undefined;
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
        job,
        skillChoices: skillChoicesForJob(candidate.skillChoices, job),
        equipmentNames: uniqueNames(candidate.equipmentNames),
        bossNames: uniqueNames(candidate.bossNames),
        signatureItems: uniqueNames(candidate.signatureItems).filter(isSignatureName),
        progressionProfile: normalizeProgressionProfile(candidate.progressionProfile)
            || { ...BASELINE_PROGRESSION_PROFILE },
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

    const job = typeof candidate.job === 'string' && candidate.job.trim() ? candidate.job.trim() : undefined;
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
        job,
        skillChoices: skillChoicesForJob(candidate.skillChoices, job),
        equipmentNames: uniqueNames(candidate.equipmentNames),
        bossNames: uniqueNames(candidate.bossNames),
        signatureItems: uniqueNames(candidate.signatureItems).filter(isSignatureName),
        progressionProfile: normalizeProgressionProfile(candidate.progressionProfile)
            || { ...BASELINE_PROGRESSION_PROFILE },
    };
};

export const resolvePlayerProgressionProfile = (
    player: Player,
    currentReference: ProgressionProfileRef,
): Readonly<ProgressionProfile> => (
    (player.activeExpedition ? getActiveProgressionProfile(player) : null)
    || resolveProgressionProfile(currentReference)
);

export const startExpedition = (
    player: Player,
    destination: string,
    now: number,
    questCatalog: any[],
    progressionProfile: ProgressionProfile = { ...BASELINE_PROGRESSION_PROFILE },
) => {
    if (normalizeActiveExpedition(player.activeExpedition)) return player;
    const hp = nonNegative(player.hp);
    const expeditionSequence = Number.isSafeInteger(player.expeditionSequence)
        && (player.expeditionSequence as number) >= 0
        ? (player.expeditionSequence as number) + 1
        : 1;
    const job = typeof player.job === 'string' && player.job.trim() ? player.job.trim() : undefined;
    const snapshot: ExpeditionSnapshot = {
        id: `expedition-${Math.max(0, Math.floor(now))}-${expeditionSequence}`,
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
        job,
        skillChoices: skillChoicesForJob(player.skillChoices, job),
        equipmentNames: equipmentNames(player),
        bossNames: [],
        signatureItems: ownedSignatureNames(player),
        progressionProfile: normalizeProgressionProfile(progressionProfile)
            || { ...BASELINE_PROGRESSION_PROFILE },
    };
    return { ...player, expeditionSequence, activeExpedition: snapshot };
};

export const finishExpedition = (player: Player, returnLocation: string, now: number, questCatalog: any[]) => {
    const snapshot = normalizeActiveExpedition(player.activeExpedition);
    if (!snapshot) return { player: { ...player, activeExpedition: null }, summary: null };

    const endedAt = Math.max(snapshot.startedAt, Math.floor(now));
    const { newItems, lostItemCount } = itemDelta(snapshot.inventory, Array.isArray(player.inv) ? player.inv : []);
    const signatureItems = signatureDelta(snapshot, player);
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
        job: snapshot.job,
        skillChoices: snapshot.skillChoices,
        equipmentNames: equipmentNames(player),
        bossNames: snapshot.bossNames || [],
        signatureItems,
        progressionProfile: { ...snapshot.progressionProfile },
    };

    const playerWithJourney = snapshot.job
        ? recordClassJourneyExpedition(player, {
            job: snapshot.job,
            expeditionId: snapshot.id,
            skillBranches: Object.entries(snapshot.skillChoices || {}).map(([skillName, choice]) => `${skillName}:${choice}`),
            signatureItems,
            bossNames: snapshot.bossNames,
            regions: [snapshot.destination, player.loc || snapshot.destination],
            endedAt,
        })
        : player;
    const returnedPlayer = queueMilestoneStoryBeat({
        ...playerWithJourney,
        activeExpedition: null,
        lastExpeditionSummary: summary,
    }, 'first_safe_return');

    return {
        player: returnedPlayer,
        summary,
    };
};

export const appendExpeditionBoss = (player: Player, bossName: string): Player => {
    const name = typeof bossName === 'string' ? bossName.trim() : '';
    const snapshot = normalizeActiveExpedition(player.activeExpedition);
    if (!snapshot || !name || snapshot.bossNames?.includes(name)) return player;
    return {
        ...player,
        activeExpedition: {
            ...snapshot,
            bossNames: [...(snapshot.bossNames || []), name],
        },
    };
};

export const trackExpeditionVitals = (player: Player): Player => {
    const snapshot = normalizeActiveExpedition(player.activeExpedition);
    if (!snapshot || !Number.isFinite(Number(player.hp))) return player;
    const lowestHp = Math.min(snapshot.lowestHp, Math.max(0, Number(player.hp)));
    if (lowestHp === snapshot.lowestHp) return player;
    return { ...player, activeExpedition: { ...snapshot, lowestHp } };
};
