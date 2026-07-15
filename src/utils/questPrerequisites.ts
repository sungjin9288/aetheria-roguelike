export const getUnmetQuestPrerequisite = (
    quest: any,
    claimedQuestIds: any,
    questCatalog: any,
) => {
    const prerequisiteId = quest?.prerequisiteQuestId;
    if (prerequisiteId === undefined || prerequisiteId === null) return null;

    const claimedIds = Array.isArray(claimedQuestIds) ? claimedQuestIds : [];
    if (claimedIds.includes(prerequisiteId)) return null;

    return questCatalog.find((entry: any) => entry.id === prerequisiteId) || {
        id: prerequisiteId,
        title: `임무 ${prerequisiteId}`,
    };
};
