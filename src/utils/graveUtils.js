const createGraveItem = (item) => ({
    ...item,
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`
});

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

export const getGraveItems = (grave) => (
    Array.isArray(grave?.items)
        ? grave.items
        : grave?.item
            ? [grave.item]
            : []
);

export const resolveGraveRecovery = (player, grave) => {
    const recoveredItems = getGraveItems(grave).map((item) => createGraveItem(item));
    const goldGain = Math.max(0, grave?.gold || 0);
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

    return {
        updatedPlayer,
        recoveredItems,
        logMsg: summary.join(', ')
    };
};
