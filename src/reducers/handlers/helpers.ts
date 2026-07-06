import { findItemByName, makeItem } from '../../utils/gameUtils';
import { RELICS, MAX_RELICS_PER_RUN } from '../../data/relics';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { getMirrorEffects } from '../../systems/mirrorUpgrades';
import type { Player } from '../../types/index.js';

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

/**
 * 데일리 프로토콜 미션 진행도를 업데이트하고, 완료 시 에센스/아이템 보상을 지급합니다.
 */
// cycle 538: amount default 1 제거 — 1 production caller (protocolHandlers
//   :20) + 6 test caller 모두 명시 전달 (1)이라 default 도달 불가.
//   util/component/hook/system/reducer default 청소 메가 시리즈 34번째,
//   reducers/ 진입.
export const applyDailyProtocolProgress = (player: Player, type: any, amount: any) => {
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
        // 지급처 간 일관성 (2026-07, 에테르 거울 후속): 전투/승천 경로
        // (CombatEngine.outcome.ts)와 동일하게 프레스티지 rank essenceMult ×
        // 거울 essence_flow 배율을 곱연산 적용 — 일일 프로토콜만 원액 지급하던 불일치 해소.
        const baseMeta: Record<string, any> = nextPlayer.meta || {};
        const essenceMult = getPrestigeUnlocks(baseMeta.prestigeRank).essenceMult
            * getMirrorEffects(baseMeta).essenceFlowMult;
        const grantedEssence = Math.max(1, Math.floor(essenceGain * essenceMult));
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
