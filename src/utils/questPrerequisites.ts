import type { Quest } from '../types/quest';

export const getUnmetQuestPrerequisite = (
    quest: Quest | undefined,
    claimedQuestIds: Array<Quest['id']> | undefined,
    questCatalog: Quest[],
): Quest | { id: Quest['id']; title: string } | null => {
    const prerequisiteId = quest?.prerequisiteQuestId;
    if (prerequisiteId === undefined || prerequisiteId === null) return null;

    const claimedIds = Array.isArray(claimedQuestIds) ? claimedQuestIds : [];
    if (claimedIds.includes(prerequisiteId)) return null;

    return questCatalog.find((entry) => entry.id === prerequisiteId) || {
        id: prerequisiteId,
        title: `임무 ${prerequisiteId}`,
    };
};
