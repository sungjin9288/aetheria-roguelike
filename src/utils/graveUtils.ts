import type { Player } from '../types/index.js';
const createGraveItem = (item: any) => ({
    ...item,
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
});

const sortGravesByLatest = (a: any, b: any) => (b?.timestamp || 0) - (a?.timestamp || 0);

export const buildGraveData = (player: Player, random: any = Math.random, now: any = Date.now) => {
    let droppedItems: any[] = [];
    const tradableItems = Array.isArray(player?.inv)
        ? player.inv.filter((item: any) => !item?.id?.startsWith('starter_'))
        : [];

    if (tradableItems.length > 0) {
        const shuffled = [...tradableItems].sort(() => random() - 0.5);
        const dropCount = Math.min(shuffled.length, random() < 0.5 ? 1 : 2);
        droppedItems = shuffled.slice(0, dropCount);
    }

    return {
        loc: player?.loc || '',
        gold: Math.floor((player?.gold || 0) / 2),
        item: droppedItems[0] || null,
        items: droppedItems,
        timestamp: now()
    };
};

export const normalizeGraves = (grave: any) => {
    if (!grave) return [];

    const graves = Array.isArray(grave) ? grave : [grave];
    return graves
        .filter((entry: any) => entry && typeof entry === 'object' && entry.loc)
        .sort(sortGravesByLatest);
};

export const appendGrave = (grave: any, nextGrave: any) => {
    const merged = [...normalizeGraves(grave), ...normalizeGraves(nextGrave)];
    return merged.length > 0 ? merged.sort(sortGravesByLatest) : null;
};

export const getGravesAtLoc = (grave: any, loc: any) => (
    normalizeGraves(grave).filter((entry: any) => entry.loc === loc)
);

export const removeGravesAtLoc = (grave: any, loc: any) => {
    const remaining = normalizeGraves(grave).filter((entry: any) => entry.loc !== loc);
    return remaining.length > 0 ? remaining : null;
};

export const getGraveItems = (grave: any) => (
    Array.isArray(grave?.items)
        ? grave.items
        : grave?.item
            ? [grave.item]
            : []
);

export const calcInvasionChance = (playerAtk: any, guardPower: any) => {
    const atk = Math.max(1, playerAtk);
    const guard = Math.max(1, guardPower);
    return Math.min(0.9, atk / (atk + guard));
};

export const resolveInvasion = (targetGrave: any, playerAtk: any) => {
    const chance = calcInvasionChance(playerAtk, targetGrave.guardPower || 10);
    const success = Math.random() < chance;
    const items = targetGrave.items || [];
    const reward = success && items.length > 0
        ? { ...items[Math.floor(Math.random() * items.length)], id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}` }
        : null;
    return { success, reward, chance };
};

export const resolveGraveRecovery = (player: Player, grave: any) => {
    const graves = normalizeGraves(grave);
    const recoveredItems = graves
        .flatMap((entry: any) => getGraveItems(entry))
        .map((item: any) => createGraveItem(item));
    const goldGain = graves.reduce((total: any, entry: any) => total + Math.max(0, entry?.gold || 0), 0);
    const updatedPlayer: Record<string, any> = {
        ...player,
        gold: (player?.gold || 0) + goldGain,
        inv: [...(player?.inv || []), ...recoveredItems],
        stats: {
            ...(player?.stats || {}),
            total_gold: (player?.stats?.total_gold || 0) + goldGain,
        }
    };
    const summary = [`유해 회수: ${goldGain}G 획득`];

    if (recoveredItems.length > 0) {
        summary.push(`${recoveredItems.map((item: any) => item.name).join(', ')} 획득`);
    }

    if (graves.length > 1) {
        summary.push(`${graves.length}구의 유해 정리`);
    }

    return {
        updatedPlayer,
        recoveredItems,
        logMsg: summary.join(', ')
    };
};
