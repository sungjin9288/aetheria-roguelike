import { DB } from '../../data/db';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { AT } from '../../reducers/actionTypes';
import { MSG } from '../../data/messages';
import { makeItem } from '../../utils/gameUtils';
import { RELICS, pickWeightedRelics } from '../../data/relics';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import type { Player } from '../../types';
import type { AddLog, GameActionDeps } from '../actionDeps';
export { resolveEndgameVictory } from '../../systems/endgameSettlement';

/**
 * 무한 심연 층 진행. 현재 위치가 심연 맵이 아니면 player를 그대로 반환.
 * @returns {object} 업데이트된 player
 */
export const applyAbyssFloorAdvance = (
    p: Player,
    dispatch: GameActionDeps['dispatch'],
    addLog: AddLog,
    rng: () => number = Math.random,
    now: () => number = Date.now,
) => {
    if (p.loc !== CONSTANTS.ABYSS_MAP_NAME) return p;
    // 2026-09 Wave 35: `abyssFloor`는 돌파한 층 수다 — 지금 싸운 층(`abyssFloor + 1`)을 이기면 그 층을 돌파한다.
    //   `|| 1`이던 동안 첫 돌파가 0 → 2였다(2층 전투가 없고 기록 · 칭호 · 유물 층 보너스가 한 층 앞섰다).
    const newDepth = (p.stats?.abyssFloor || 0) + 1;
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
            const ownedRelics = updated.relics || [];
            const available = RELICS.filter((r) => !ownedRelics.some((pr) => pr.id === r.id));
            // PR #8: 프레스티지 rank≥2면 선택지 4지선다.
            const unlocks = getPrestigeUnlocks(updated.meta?.prestigeRank);
            if (available.length > 0) {
                // Wave 77 후속: 칸이 가득 찼으면 교체하면 나아지는 카드를 먼저 보인다.
                const atCapacity = ownedRelics.length >= unlocks.maxRelics;
                dispatch({
                    type: AT.SET_PENDING_RELICS,
                    payload: pickWeightedRelics(available, unlocks.relicChoices, {
                        rng, replacing: atCapacity ? ownedRelics : undefined,
                    }),
                });
            }
        } else if (milestone.type === 'legendary_item') {
            // cycle 179: DB.ITEMS는 object — `.flat()` 호출은 TypeError. abyss 50/100/300층
            //   milestone 처리 중 예외 발생해 abyss 진행 끊기던 잠복 회귀 fix.
            const allItems = Object.values(DB.ITEMS).flat().filter((i) => i && typeof i === 'object');
            const legendaryPool = allItems.filter((i) => i.tier === 5);
            if (legendaryPool.length > 0) {
                const item = makeItem(
                    legendaryPool[Math.floor(rng() * legendaryPool.length)],
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
