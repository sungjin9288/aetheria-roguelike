import { DB } from '../../data/db';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { AT } from '../../reducers/actionTypes';
import { MSG } from '../../data/messages';
import { makeItem } from '../../utils/gameUtils';
import { RELICS, pickWeightedRelics } from '../../data/relics';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
export { resolveEndgameVictory } from '../../systems/endgameSettlement';

/**
 * 무한 심연 층 진행. 현재 위치가 심연 맵이 아니면 player를 그대로 반환.
 * @returns {object} 업데이트된 player
 */
export const applyAbyssFloorAdvance = (
    p: any,
    dispatch: any,
    addLog: any,
    rng: () => number = Math.random,
    now: () => number = Date.now,
) => {
    if (p.loc !== CONSTANTS.ABYSS_MAP_NAME) return p;
    const newDepth = (p.stats?.abyssFloor || 1) + 1;
    const prevRecord = p.stats?.abyssRecord || 0;
    const newRecord = Math.max(prevRecord, newDepth);
    let updated = {
        ...p,
        stats: { ...(p.stats || {}), abyssFloor: newDepth, abyssRecord: newRecord },
    };
    if (newDepth > prevRecord) {
        addLog('system', MSG.ABYSS_RECORD(newDepth));
    }
    addLog('system', MSG.ABYSS_DESCEND(newDepth));
    const milestone = BALANCE.ABYSS_MILESTONE_REWARDS[newDepth];
    if (milestone) {
        addLog('event', MSG.ABYSS_MILESTONE(newDepth));
        if (milestone.type === 'relic_choice') {
            const available = RELICS.filter((r: any) => !(updated.relics || []).some((pr: any) => pr.id === r.id));
            // PR #8: 프레스티지 rank≥2면 선택지 4지선다.
            const choices = getPrestigeUnlocks(updated.meta?.prestigeRank).relicChoices;
            if (available.length > 0) {
                dispatch({
                    type: AT.SET_PENDING_RELICS,
                    payload: pickWeightedRelics(available, choices, { rng }),
                });
            }
        } else if (milestone.type === 'legendary_item') {
            // cycle 179: DB.ITEMS는 object — `.flat()` 호출은 TypeError. abyss 50/100/300층
            //   milestone 처리 중 예외 발생해 abyss 진행 끊기던 잠복 회귀 fix.
            const allItems: any[] = (Object.values(DB.ITEMS) as any[]).flat().filter((i: any) => i && typeof i === 'object');
            const legendaryPool = allItems.filter((i: any) => i.tier === 5);
            if (legendaryPool.length > 0) {
                const item = makeItem(
                    legendaryPool[Math.floor(rng() * legendaryPool.length)] as any,
                    rng,
                    now,
                );
                updated = { ...updated, inv: [...(updated.inv || []), item] };
                addLog('success', MSG.ABYSS_LEGENDARY_ITEM(item.name));
            }
        }
        // cycle 194: 'prestige_points' 핸들러 제거 — player.prestigePoints가 spend/UI 미구현
        //   상태로 dead currency였음. constants.ts ABYSS_MILESTONE_REWARDS에서 75/200/500을
        //   relic_choice/legendary_item으로 교체해 visible 보상 보장.
    }
    return updated;
};
