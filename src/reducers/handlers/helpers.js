import { findItemByName, makeItem } from '../../utils/gameUtils';

/**
 * 퀵슬롯을 현재 인벤토리 기준으로 정리합니다.
 * 인벤에 없는 아이템 참조는 null로 교체합니다.
 */
export const sanitizeQuickSlots = (slots = [], inventory = []) => {
    const ids = new Set((inventory || []).map((item) => item?.id).filter(Boolean));
    const normalized = Array.from({ length: 3 }, (_, i) => (Array.isArray(slots) ? slots[i] : undefined) ?? null);
    return normalized.map((slot) => (slot?.id && ids.has(slot.id) ? slot : null));
};

/**
 * 데일리 프로토콜 미션 진행도를 업데이트하고, 완료 시 에센스/아이템 보상을 지급합니다.
 */
export const applyDailyProtocolProgress = (player, type, amount = 1) => {
    const dp = player.stats?.dailyProtocol;
    if (!dp) return player;

    let essenceGain = 0;
    let newShards = dp.relicShards || 0;
    const itemRewards = [];

    const updatedMissions = dp.missions.map((mission) => {
        if (mission.type !== type || mission.done) return mission;

        const progress = Math.min(mission.goal, (mission.progress || 0) + amount);
        const justDone = progress >= mission.goal && !mission.done;
        if (justDone) {
            if (mission.reward?.essence) essenceGain += mission.reward.essence;
            if (mission.reward?.item) itemRewards.push(mission.reward.item);
            if (mission.reward?.relicShard) newShards += mission.reward.relicShard;
        }

        return { ...mission, progress, done: progress >= mission.goal };
    });

    const nextPlayer = {
        ...player,
        stats: {
            ...player.stats,
            dailyProtocol: {
                ...dp,
                missions: updatedMissions,
                relicShards: newShards,
            }
        }
    };

    if (essenceGain > 0) {
        const nextMeta = {
            ...(nextPlayer.meta || {}),
            essence: (nextPlayer.meta?.essence || 0) + essenceGain,
            rank: nextPlayer.meta?.rank || 0,
            bonusAtk: nextPlayer.meta?.bonusAtk || 0,
            bonusHp: nextPlayer.meta?.bonusHp || 0,
            bonusMp: nextPlayer.meta?.bonusMp || 0,
        };
        const nextRank = Math.floor(nextMeta.essence / 150);
        if (nextRank > nextMeta.rank) {
            const gain = nextRank - nextMeta.rank;
            nextMeta.rank = nextRank;
            nextMeta.bonusAtk += gain;
            nextMeta.bonusHp += gain * 5;
            nextMeta.bonusMp += gain * 3;
        }
        nextPlayer.meta = nextMeta;
    }

    if (itemRewards.length > 0) {
        const rewardedItems = itemRewards
            .map((name) => findItemByName(name))
            .filter(Boolean)
            .map((item) => makeItem(item));
        if (rewardedItems.length > 0) {
            nextPlayer.inv = [...(nextPlayer.inv || []), ...rewardedItems];
        }
    }

    return nextPlayer;
};
