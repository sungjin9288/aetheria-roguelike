import { findItemByName, makeItem } from '../../utils/gameUtils';
import { RELICS, MAX_RELICS_PER_RUN } from '../../data/relics';
import type { Player } from '../../types/index.js';

/**
 * 퀵슬롯을 현재 인벤토리 기준으로 정리합니다.
 * 인벤에 없는 아이템 참조는 null로 교체합니다.
 */
export const sanitizeQuickSlots = (slots: any = [], inventory: any = []) => {
    const ids = new Set((inventory || []).map((item: any) => item?.id).filter(Boolean));
    const normalized = Array.from({ length: 3 }, (_: any, i: any) => (Array.isArray(slots) ? slots[i] : undefined) ?? null);
    return normalized.map((slot: any) => (slot?.id && ids.has(slot.id) ? slot : null));
};

/**
 * 데일리 프로토콜 미션 진행도를 업데이트하고, 완료 시 에센스/아이템 보상을 지급합니다.
 */
export const applyDailyProtocolProgress = (player: Player, type: any, amount: any = 1) => {
    const dp = (player.stats as any)?.dailyProtocol;
    if (!dp) return player;

    let essenceGain = 0;
    let newShards = dp.relicShards || 0;
    const itemRewards: any[] = [];

    const updatedMissions = dp.missions.map((mission: any) => {
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

    // cycle 232: relicShards 5/5 conversion 메커니즘 — UI에 'X/5 조각' 표시되지만 변환 코드 0건
    //   이던 dead reward chain. 5개 도달 시 1 random 유물 자동 변환 (cap 도달 시 보존).
    let convertedRelicAdded = null;
    let postConvertShards = newShards;
    if (newShards >= 5 && (player.relics || []).length < MAX_RELICS_PER_RUN) {
        const ownedIds = new Set((player.relics || []).map((r: any) => r?.id));
        const candidates = RELICS.filter((r: any) => !ownedIds.has(r.id));
        if (candidates.length > 0) {
            const pick = candidates[Math.floor(Math.random() * candidates.length)];
            convertedRelicAdded = pick;
            postConvertShards = newShards - 5;
        }
    }

    const nextPlayer: Record<string, any> = {
        ...player,
        stats: {
            ...player.stats,
            dailyProtocol: {
                ...dp,
                missions: updatedMissions,
                relicShards: postConvertShards,
            }
        }
    };

    if (convertedRelicAdded) {
        nextPlayer.relics = [...(nextPlayer.relics || []), convertedRelicAdded];
        nextPlayer.stats = {
            ...nextPlayer.stats,
            relicCount: ((nextPlayer.stats as any)?.relicCount || 0) + 1,
        };
    }

    if (essenceGain > 0) {
        const nextMeta: Record<string, any> = {
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
            .map((name: any) => findItemByName(name))
            .filter(Boolean)
            .map((item: any) => makeItem(item));
        if (rewardedItems.length > 0) {
            nextPlayer.inv = [...(nextPlayer.inv || []), ...rewardedItems];
        }
    }

    return nextPlayer;
};
