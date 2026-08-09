import { checkTitles, findItemByName, getTitleLabel, makeItem } from '../../utils/gameUtils';
import { RELICS, MAX_RELICS_PER_RUN } from '../../data/relics';
import { SEASON_TIER_XP } from '../../data/seasonPass';
import { MSG } from '../../data/messages';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { getMirrorEffects } from '../../systems/mirrorUpgrades';
import { getCurrentDailyProtocol } from '../../utils/protocolCycle';
import { SEASON_MAX_TIER, SEASON_MAX_XP } from '../../utils/seasonPassPresentation';
import type { Player } from '../../types/index.js';
import type { Relic } from '../../types/relic.js';

/**
 * 퀵슬롯을 현재 인벤토리 기준으로 정리합니다.
 * 인벤에 없는 아이템 참조는 null로 교체합니다.
 */
// cycle 562: slots / inventory defaults 제거 — 2 production caller (bootstrap
//   Handlers:20, uiHandlers:53) 모두 2 args 명시 전달이라 두 default 모두
//   도달 불가. body의 (inventory || []) + Array.isArray(slots) defensive
//   guards가 undefined/null 안전 처리. 청소 메가 시리즈 55번째.
export const sanitizeQuickSlots = (slots: any, inventory: any) => {
    const ids = new Set((inventory || []).map((item: any) => item?.id).filter(Boolean));
    const normalized = Array.from({ length: 3 }, (_: any, i: any) => (Array.isArray(slots) ? slots[i] : undefined) ?? null);
    return normalized.map((slot: any) => (slot?.id && ids.has(slot.id) ? slot : null));
};

export const addSeasonXp = (player: Player, amount: number): Player => {
    if (!Number.isFinite(amount) || amount <= 0) return player;
    const seasonPass = player.seasonPass || { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
    const currentXp = Math.max(0, Number(seasonPass.xp) || 0);
    const nextXp = Math.min(SEASON_MAX_XP, currentXp + amount);
    if (nextXp === currentXp) return player;

    return {
        ...player,
        seasonPass: {
            ...seasonPass,
            xp: nextXp,
            tier: Math.min(SEASON_MAX_TIER, Math.floor(nextXp / SEASON_TIER_XP)),
        },
    };
};

export const addNewTitles = (player: Player, logs: Array<{ type: string; text: string }>): Player => {
    const newTitles = checkTitles(player);
    if (newTitles.length === 0) return player;

    newTitles.forEach((title) => {
        logs.push({ type: 'system', text: MSG.TITLE_UNLOCKED(getTitleLabel(title)) });
    });
    return {
        ...player,
        titles: [...new Set([...(player.titles || []), ...newTitles])],
        activeTitle: player.activeTitle || newTitles[0],
    };
};

export interface DailyProtocolReward {
    completedCount: number;
    essence: number;
    items: string[];
    relicShards: number;
    convertedRelic: Relic | null;
}

type DailyProtocolItemEntropy = {
    rng?: () => number;
    now?: () => number;
};

const emptyDailyProtocolReward = (): DailyProtocolReward => ({
    completedCount: 0,
    essence: 0,
    items: [],
    relicShards: 0,
    convertedRelic: null,
});

/**
 * 오늘의 임무 진행과 보상을 한 번에 확정합니다.
 * UI는 이 결과만 읽어 실제 지급량과 유물 변환 결과를 안내합니다.
 */
export const resolveDailyProtocolProgress = (
    player: Player,
    type: any,
    amount: any,
    relicRoll?: number,
    itemEntropy?: DailyProtocolItemEntropy,
) => {
    const dp = (player.stats as any)?.dailyProtocol;
    if (!dp) return { player, reward: emptyDailyProtocolReward() };

    let essenceGain = 0;
    let relicShardGain = 0;
    let completedCount = 0;
    let newShards = dp.relicShards || 0;
    const itemRewards: any[] = [];

    const updatedMissions = dp.missions.map((mission: any) => {
        if (mission.type !== type || mission.done) return mission;

        const progress = Math.min(mission.goal, (mission.progress || 0) + amount);
        const justDone = progress >= mission.goal && !mission.done;
        if (justDone) {
            completedCount += 1;
            if (mission.reward?.essence) essenceGain += mission.reward.essence;
            if (mission.reward?.item) itemRewards.push(mission.reward.item);
            if (mission.reward?.relicShard) {
                relicShardGain += mission.reward.relicShard;
                newShards += mission.reward.relicShard;
            }
        }

        return { ...mission, progress, done: progress >= mission.goal };
    });

    // cycle 232: relicShards 5/5 conversion 메커니즘 — UI에 'X/5 조각' 표시되지만 변환 코드 0건
    //   이던 dead reward chain. 5개 도달 시 1 random 유물 자동 변환 (cap 도달 시 보존).
    let convertedRelicAdded: Relic | null = null;
    let postConvertShards = newShards;
    if (newShards >= 5 && (player.relics || []).length < MAX_RELICS_PER_RUN) {
        const ownedIds = new Set((player.relics || []).map((r: any) => r?.id));
        const candidates = RELICS.filter((r: any) => !ownedIds.has(r.id));
        if (candidates.length > 0) {
            const roll = Number.isFinite(relicRoll)
                ? Math.min(0.999999, Math.max(0, relicRoll as number))
                : Math.random();
            const pick = candidates[Math.floor(roll * candidates.length)];
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

    let grantedEssence = 0;
    if (essenceGain > 0) {
        // 지급처 간 일관성 (2026-07, 에테르 거울 후속): 전투/승천 경로
        // (CombatEngine.outcome.ts)와 동일하게 프레스티지 rank essenceMult ×
        // 거울 essence_flow 배율을 곱연산 적용 — 일일 프로토콜만 원액 지급하던 불일치 해소.
        const baseMeta: Record<string, any> = nextPlayer.meta || {};
        const essenceMult = getPrestigeUnlocks(baseMeta.prestigeRank).essenceMult
            * getMirrorEffects(baseMeta).essenceFlowMult;
        grantedEssence = Math.max(1, Math.floor(essenceGain * essenceMult));
        const nextMeta: Record<string, any> = {
            ...baseMeta,
            essence: (baseMeta.essence || 0) + grantedEssence,
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

    const rewardedItems = itemRewards
        .map((name: any) => findItemByName(name))
        .filter(Boolean)
        .map((item: any) => makeItem(item, itemEntropy?.rng, itemEntropy?.now));
    if (rewardedItems.length > 0) {
        nextPlayer.inv = [...(nextPlayer.inv || []), ...rewardedItems];
    }

    return {
        player: nextPlayer as Player,
        reward: {
            completedCount,
            essence: grantedEssence,
            items: rewardedItems.map((item: any) => item.name),
            relicShards: relicShardGain,
            convertedRelic: convertedRelicAdded,
        },
    };
};

export const advanceDailyProtocol = (
    player: Player,
    type: any,
    amount: any,
    relicRoll?: number,
    now?: number,
    itemRng?: () => number,
) => {
    const dailyProtocol = getCurrentDailyProtocol(
        player,
        Number.isFinite(now) ? new Date(now as number) : new Date(),
    );
    const currentPlayer = {
        ...player,
        stats: { ...player.stats, dailyProtocol },
    };
    return resolveDailyProtocolProgress(currentPlayer, type, amount, relicRoll, {
        rng: itemRng,
        now: Number.isFinite(now) ? () => now as number : undefined,
    });
};

export const getDailyProtocolRewardLogs = (reward: DailyProtocolReward) => {
    const parts: string[] = [];
    if (reward.essence > 0) parts.push(`에센스 +${reward.essence}`);
    reward.items.forEach((name) => parts.push(`${name} 획득`));
    if (reward.relicShards > 0) parts.push(`유물 파편 +${reward.relicShards}`);

    const logs: Array<{ type: string; text: string }> = [];
    if (reward.completedCount > 0 && parts.length > 0) {
        logs.push({ type: 'success', text: MSG.DAILY_PROTOCOL_DONE(reward.completedCount, parts.join(' · ')) });
    }
    if (reward.convertedRelic) {
        logs.push({
            type: 'success',
            text: MSG.DAILY_PROTOCOL_RELIC_COMPLETE(reward.convertedRelic.name || '새 유물'),
        });
    }
    return logs;
};
