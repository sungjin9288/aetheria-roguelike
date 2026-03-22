const createGraveItem = (item) => ({
    ...item,
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
});

const sortGravesByLatest = (a, b) => (b?.timestamp || 0) - (a?.timestamp || 0);

export const buildGraveData = (player, random = Math.random, now = Date.now) => {
    let droppedItems = [];
    const tradableItems = Array.isArray(player?.inv)
        ? player.inv.filter((item) => !item?.id?.startsWith('starter_'))
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

export const normalizeGraves = (grave) => {
    if (!grave) return [];

    const graves = Array.isArray(grave) ? grave : [grave];
    return graves
        .filter((entry) => entry && typeof entry === 'object' && entry.loc)
        .sort(sortGravesByLatest);
};

export const appendGrave = (grave, nextGrave) => {
    const merged = [...normalizeGraves(grave), ...normalizeGraves(nextGrave)];
    return merged.length > 0 ? merged.sort(sortGravesByLatest) : null;
};

export const getGravesAtLoc = (grave, loc) => (
    normalizeGraves(grave).filter((entry) => entry.loc === loc)
);

export const removeGravesAtLoc = (grave, loc) => {
    const remaining = normalizeGraves(grave).filter((entry) => entry.loc !== loc);
    return remaining.length > 0 ? remaining : null;
};

export const getGraveItems = (grave) => (
    Array.isArray(grave?.items)
        ? grave.items
        : grave?.item
            ? [grave.item]
            : []
);

export const resolveGraveRecovery = (player, grave) => {
    const graves = normalizeGraves(grave);
    const recoveredItems = graves
        .flatMap((entry) => getGraveItems(entry))
        .map((item) => createGraveItem(item));
    const goldGain = graves.reduce((total, entry) => total + Math.max(0, entry?.gold || 0), 0);
    const updatedPlayer = {
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
        summary.push(`${recoveredItems.map((item) => item.name).join(', ')} 획득`);
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
